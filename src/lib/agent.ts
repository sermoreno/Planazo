/** Agente conversacional: preguntas que faltan, generación (IA vía Edge Function o planificador local). */
import { getPlace, PLACES } from './places'
import { generateLocal, titleFor } from './planner'
import { supabase } from './supabase'
import type { Companions, Interest, Itinerary, Pace, Preferences, Slot } from './types'
import { distanceKm, toMin, uid, walkMinutes } from './utils'

export interface Question { key: 'companions' | 'pace' | 'interests'; text: string; options: { label: string; value: string }[] }

export const COMPANIONS: { label: string; value: Companions }[] = [
  { label: 'Solo', value: 'solo' }, { label: 'En pareja', value: 'pareja' }, { label: 'Con amigos', value: 'amigos' }, { label: 'En familia', value: 'familia' },
]
export const PACES: { label: string; value: Pace }[] = [
  { label: 'Tranquilo', value: 'tranquilo' }, { label: 'Equilibrado', value: 'equilibrado' }, { label: 'Intenso', value: 'intenso' },
]
export const INTERESTS: { label: string; value: Interest }[] = [
  { label: 'Cultura', value: 'cultura' }, { label: 'Naturaleza', value: 'naturaleza' }, { label: 'Gastronomía', value: 'gastronomia' },
  { label: 'Nocturno', value: 'nocturno' }, { label: 'Deporte', value: 'deporte' }, { label: 'Mercadillos', value: 'mercadillos' },
]

/** El agente pregunta solo lo que falta, como máximo 2 preguntas. */
export function missingQuestions(p: Preferences): Question[] {
  const q: Question[] = []
  if (!p.companions) q.push({ key: 'companions', text: '¿Con quién vas a hacer el plan?', options: COMPANIONS })
  if (p.interests.length === 0 && !p.mood.trim()) q.push({ key: 'interests', text: '¿Qué te apetece más este finde?', options: INTERESTS })
  if (!p.pace) q.push({ key: 'pace', text: '¿Qué ritmo te va mejor?', options: PACES.map((x) => ({ ...x, label: { tranquilo: 'Tranquilo, sin prisas', equilibrado: 'Equilibrado', intenso: 'Intenso, aprovechar al máximo' }[x.value] })) })
  return q.slice(0, 2)
}

export function greeting(p: Preferences) {
  const mood = p.mood.trim()
  return mood ? `¡Genial! Me apunto lo de "${mood.length > 60 ? mood.slice(0, 60) + '…' : mood}". Solo un par de cosas para afinar.` : '¡Vamos a por ese planazo! Un par de preguntas rápidas.'
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
export function surprise(base: Preferences): Preferences {
  const interests = [...INTERESTS].sort(() => Math.random() - 0.5).slice(0, 2).map((x) => x.value)
  return {
    ...base, companions: base.companions ?? pick(COMPANIONS).value, pace: base.pace ?? 'equilibrado', interests: base.interests.length ? base.interests : interests,
    mood: base.mood || pick(['Quiero descubrir algo nuevo', 'Me apetece desconectar', 'Quiero un día con energía', 'Me apetece inspirarme']),
  }
}

export interface GenResult { it: Itinerary; message: string }

/** Genera el plan con IA si hay Supabase + Edge Function; si no (o si falla), con el planificador local. */
export async function generatePlan(prefs: Preferences): Promise<GenResult> {
  // La función de IA se activa al desplegarla (VITE_AI_FUNCTION=1); mientras, planificador local sin esperas.
  if (supabase && import.meta.env.VITE_AI_FUNCTION === '1') {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 50_000)
      const { data, error } = await supabase.functions.invoke('generate-plan', { body: { prefs }, signal: ctrl.signal } as never)
      clearTimeout(t)
      if (!error && data?.slots?.length) return { it: fromAI(prefs, data.slots), message: data.message ?? '¡Aquí tienes tu plan!' }
    } catch { /* fallback local */ }
  }
  await new Promise((r) => setTimeout(r, 900)) // da tiempo a ver el skeleton
  const it = generateLocal(prefs)
  const n = it.slots.length
  return { it, message: n ? `Te he preparado ${n} paradas cerca unas de otras, dentro de tu presupuesto. Revisa horarios y precios antes de salir.` : 'No he encontrado lugares abiertos con esas condiciones. Prueba a subir el presupuesto o cambiar el día.' }
}

function fromAI(prefs: Preferences, raw: Omit<Slot, 'id' | 'travel_min_from_prev'>[]): Itinerary {
  const valid = raw.filter((s) => getPlace(s.place_id))
  const slots: Slot[] = valid.map((s, i) => {
    const prev = valid[i - 1]
    const p = getPlace(s.place_id)!
    const travel = prev && prev.day === s.day ? walkMinutes(distanceKm(getPlace(prev.place_id)!, p)) : null
    return { ...s, id: uid(), title: p.name, duration_min: s.duration_min || toMin(s.end_time) - toMin(s.start_time), travel_min_from_prev: travel }
  })
  return { id: uid(), title: titleFor(prefs), prefs, slots, created_at: new Date().toISOString(), status: 'draft', share_slug: null, is_public: false, source: 'ia' }
}

export const placesCount = PLACES.length
