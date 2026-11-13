/**
 * Capa de datos. Con credenciales de Supabase usa Auth + Postgres (RLS).
 * Sin credenciales funciona en "modo demo": borradores, sesión y planes guardados en localStorage.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Day, Itinerary, Preferences, Slot } from './types'
import { slug, toMin } from './utils'

export const FREE_LIMIT = 3

// ---------- almacenamiento local seguro ----------
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* modo privado */ } }

// ---------- sesión ----------
export interface User { id: string; email: string; plan_tier: 'free' | 'premium' }
type Listener = (u: User | null) => void
const listeners = new Set<Listener>()
let current: User | null = supabase ? null : read<User | null>('pz_demo_user', null)
const emit = () => listeners.forEach((l) => l(current))

if (supabase) {
  supabase.auth.getSession().then(({ data }) => setFromSupabase(data.session?.user ?? null))
  supabase.auth.onAuthStateChange((_e, s) => setFromSupabase(s?.user ?? null))
}
async function setFromSupabase(u: { id: string; email?: string } | null) {
  if (!u) { current = null; return emit() }
  const { data } = await supabase!.from('profiles').select('plan_tier').eq('id', u.id).maybeSingle()
  current = { id: u.id, email: u.email ?? '', plan_tier: (data?.plan_tier as User['plan_tier']) ?? 'free' }
  emit()
}

export function useUser() {
  const [u, setU] = useState<User | null>(current)
  useEffect(() => { listeners.add(setU); setU(current); return () => { listeners.delete(setU) } }, [])
  return u
}

/** Envía un magic link. En modo demo inicia sesión al momento (simulado). */
export async function signIn(email: string): Promise<'sent' | 'demo'> {
  if (supabase) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
    if (error) throw error
    return 'sent'
  }
  current = { id: 'demo-' + email, email, plan_tier: 'free' }
  write('pz_demo_user', current)
  emit()
  return 'demo'
}
export async function signOut() {
  if (supabase) await supabase.auth.signOut()
  current = null
  write('pz_demo_user', null)
  emit()
}

// ---------- borradores (sesión del navegador, también para anónimos) ----------
export const getDraft = (id: string) => read<Record<string, Itinerary>>('pz_drafts', {})[id] ?? null
export const putDraft = (it: Itinerary) => write('pz_drafts', { ...read<Record<string, Itinerary>>('pz_drafts', {}), [it.id]: it })

// ---------- planes guardados ----------
const demoKey = () => `pz_saved_${current?.id}`

function nextDate(day: Day) {
  const d = new Date(); const target = day === 'sat' ? 6 : 0
  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7))
  return d.toISOString().slice(0, 10)
}

export async function listSaved(): Promise<Itinerary[]> {
  if (!current) return []
  if (!supabase) return read<Itinerary[]>(demoKey(), [])
  const { data, error } = await supabase.from('itineraries').select('*, preferences(*), itinerary_items(*)').eq('user_id', current.id).eq('status', 'saved').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export class FreeLimitError extends Error { constructor() { super('FREE_LIMIT') } }

export async function saveItinerary(it: Itinerary): Promise<Itinerary> {
  if (!current) throw new Error('LOGIN_REQUIRED')
  const saved = await listSaved()
  const exists = saved.some((s) => s.id === it.id)
  if (!exists && current.plan_tier === 'free' && saved.length >= FREE_LIMIT) throw new FreeLimitError()
  const next: Itinerary = { ...it, status: 'saved' }
  if (!supabase) {
    write(demoKey(), [next, ...saved.filter((s) => s.id !== it.id)])
    putDraft(next)
    return next
  }
  const p = it.prefs
  const days: Day[] = p.day === 'both' ? ['sat', 'sun'] : [p.day]
  const { data: pref, error: e1 } = await supabase.from('preferences').insert({
    user_id: current.id, date_range: `[${nextDate(days[0])},${nextDate(days[days.length - 1])}]`, companions: p.companions, budget_pp: p.budget,
    pace: p.pace, interests: p.interests, mood_text: p.mood, constraints: { ...p.constraints, day: p.day },
  }).select('id').single()
  if (e1) throw e1
  const row = { id: it.id, user_id: current.id, preference_id: pref.id, title: it.title, plan_date: nextDate(days[0]), total_cost: it.slots.reduce((a, s) => a + s.est_cost, 0), status: 'saved', share_slug: it.share_slug, is_public: it.is_public }
  const { error: e2 } = await supabase.from('itineraries').upsert(row)
  if (e2) { if (/FREE_LIMIT/.test(e2.message)) throw new FreeLimitError(); throw e2 }
  await supabase.from('itinerary_items').delete().eq('itinerary_id', it.id)
  const { error: e3 } = await supabase.from('itinerary_items').insert(it.slots.map((s, i) => ({
    itinerary_id: it.id, place_id: s.place_id, position: i, day: s.day, start_time: s.start_time, end_time: s.end_time, reason: s.reason, est_cost: s.est_cost, travel_min_from_prev: s.travel_min_from_prev, verify_note: s.verify_note,
  })))
  if (e3) throw e3
  putDraft(next)
  return next
}

export async function deleteSaved(id: string) {
  if (!supabase) return write(demoKey(), read<Itinerary[]>(demoKey(), []).filter((s) => s.id !== id))
  await supabase.from('itineraries').delete().eq('id', id)
}

/** Publica el plan en modo solo lectura y devuelve el slug. */
export async function sharePlan(it: Itinerary): Promise<Itinerary> {
  const next: Itinerary = { ...it, is_public: true, share_slug: it.share_slug ?? slug() }
  if (!supabase) {
    write('pz_public', { ...read<Record<string, Itinerary>>('pz_public', {}), [next.share_slug!]: next })
    return saveItinerary(next)
  }
  const saved = await saveItinerary(next)
  return saved
}

export async function getShared(s: string): Promise<Itinerary | null> {
  if (!supabase) return read<Record<string, Itinerary>>('pz_public', {})[s] ?? null
  const { data } = await supabase.from('itineraries').select('*, preferences(*), itinerary_items(*)').eq('share_slug', s).eq('is_public', true).maybeSingle()
  return data ? fromRow(data) : null
}

// ---------- mapeo de filas ----------
interface Row {
  id: string; title: string; created_at: string; status: 'draft' | 'saved'; share_slug: string | null; is_public: boolean
  preferences: { companions: Preferences['companions']; budget_pp: number; pace: Preferences['pace']; interests: Preferences['interests']; mood_text: string; constraints: Preferences['constraints'] & { day?: Preferences['day'] } } | null
  itinerary_items: { id: string; place_id: string; position: number; day?: Day; start_time: string; end_time: string; reason: string; est_cost: number; travel_min_from_prev: number | null; verify_note: string }[]
}
function fromRow(r: Row): Itinerary {
  const pr = r.preferences
  const prefs: Preferences = { day: pr?.constraints?.day ?? 'sat', companions: pr?.companions ?? null, budget: Number(pr?.budget_pp ?? 60), pace: pr?.pace ?? 'equilibrado', interests: pr?.interests ?? [], mood: pr?.mood_text ?? '', constraints: pr?.constraints ?? {} }
  const slots: Slot[] = [...r.itinerary_items].sort((a, b) => a.position - b.position).map((i) => ({
    id: i.id, day: i.day ?? 'sat', place_id: i.place_id, start_time: i.start_time.slice(0, 5), end_time: i.end_time.slice(0, 5), title: '', reason: i.reason,
    est_cost: Number(i.est_cost), duration_min: toMin(i.end_time.slice(0, 5)) - toMin(i.start_time.slice(0, 5)), verify_note: i.verify_note, travel_min_from_prev: i.travel_min_from_prev,
  }))
  return { id: r.id, title: r.title, prefs, slots, created_at: r.created_at, status: r.status, share_slug: r.share_slug, is_public: r.is_public, source: 'local' }
}
