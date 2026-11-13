/**
 * Cuentas y sesión. Con Supabase usa Supabase Auth (email + contraseña, verificación por email,
 * recuperación de contraseña y magic link); la sesión persiste en el navegador y se renueva sola.
 * Sin credenciales ("modo demo", solo desarrollo) simula las cuentas en localStorage.
 */
import { useEffect, useState } from 'react'
import { initialLinkError, supabase } from './supabase'

export interface User { id: string; email: string; plan_tier: 'free' | 'premium'; display_name: string }
export interface AuthState { user: User | null; ready: boolean; recovery: boolean }

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d } }
const write = (k: string, v: unknown) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* modo privado */ } }

let state: AuthState = { user: supabase ? null : read<User | null>('pz_demo_user', null), ready: !supabase, recovery: false }
const listeners = new Set<(s: AuthState) => void>()
const set = (patch: Partial<AuthState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l(state)) }
export const currentUser = () => state.user

/** URL absoluta dentro de la app (respeta la base de GitHub Pages, p. ej. /Planazo/). */
export const appUrl = (path = '') => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`

// ---------- sesión de Supabase ----------
type SbUser = { id: string; email?: string; user_metadata?: Record<string, unknown> }
async function loadProfile(u: SbUser | null) {
  if (!u) return set({ user: null, ready: true })
  let tier: User['plan_tier'] = 'free'
  let name = String(u.user_metadata?.display_name ?? '') || (u.email ?? '').split('@')[0]
  try {
    const { data } = await supabase!.from('profiles').select('plan_tier, display_name').eq('id', u.id).maybeSingle()
    if (data) { tier = (data.plan_tier as User['plan_tier']) ?? 'free'; name = data.display_name || name }
  } catch { /* sin perfil: valores por defecto */ }
  set({ user: { id: u.id, email: u.email ?? '', plan_tier: tier, display_name: name }, ready: true })
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user ?? null)).catch(() => set({ ready: true }))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') set({ recovery: true })
    if (event === 'SIGNED_OUT') return set({ user: null, ready: true, recovery: false })
    if (event === 'INITIAL_SESSION') return // lo resuelve getSession()
    // Supabase recomienda no llamar a la API dentro de este callback: se difiere.
    setTimeout(() => loadProfile(session?.user ?? null), 0)
  })
}

export function useAuth() {
  const [s, setS] = useState<AuthState>(state)
  useEffect(() => { listeners.add(setS); setS(state); return () => { listeners.delete(setS) } }, [])
  return s
}
export const useUser = () => useAuth().user

// ---------- errores en español ----------
export type AuthErrorCode = 'invalid_credentials' | 'email_not_confirmed' | 'weak_password' | 'same_password' | 'rate_limit' | 'network' | 'expired' | 'unknown'
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) { super(code); this.code = code }
}
export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'El email o la contraseña no son correctos.',
  email_not_confirmed: 'Aún no has verificado tu email. Abre el enlace que te enviamos o pide otro.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.',
  network: 'No he podido conectar. Revisa tu conexión e inténtalo de nuevo.',
  expired: 'El enlace ha caducado o ya se usó. Pide uno nuevo.',
  unknown: 'Algo ha fallado. Inténtalo de nuevo en un momento.',
}
function toAuthError(e: unknown): AuthError {
  const err = e as { code?: string; message?: string; status?: number; name?: string }
  const c = `${err?.code ?? ''} ${err?.message ?? ''}`.toLowerCase()
  if (/invalid_credentials|invalid login credentials/.test(c)) return new AuthError('invalid_credentials')
  if (/email_not_confirmed|email not confirmed/.test(c)) return new AuthError('email_not_confirmed')
  if (/same_password|should be different/.test(c)) return new AuthError('same_password')
  if (/weak_password|password should|pwned|at least/.test(c)) return new AuthError('weak_password')
  if (/rate_limit|rate limit|too many|over_email_send|security purposes/.test(c) || err?.status === 429) return new AuthError('rate_limit')
  if (/otp_expired|expired|invalid.*token|flow_state/.test(c)) return new AuthError('expired')
  if (/fetch|network|load failed/.test(c) || err?.name === 'AuthRetryableFetchError') return new AuthError('network')
  return new AuthError('unknown')
}
const run = async <R extends { data: unknown; error: unknown }>(fn: () => Promise<R>): Promise<R['data']> => {
  let r: R
  try { r = await fn() } catch (e) { throw toAuthError(e) }
  if (r.error) throw toAuthError(r.error)
  return r.data
}

/** Reglas mínimas de contraseña (también configurables en Supabase → Authentication → Policies). */
export const passwordIssues = (p: string) => [
  p.length < 8 && 'al menos 8 caracteres',
  !/[a-záéíóúñü]/i.test(p) && 'una letra',
  !/\d/.test(p) && 'un número',
].filter(Boolean) as string[]

// ---------- modo demo (sin Supabase) ----------
type DemoAccount = { hash: string; name: string; id: string }
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('planazo:' + t)))).map((b) => b.toString(16).padStart(2, '0')).join('')
const demoAccounts = () => read<Record<string, DemoAccount>>('pz_demo_accounts', {})
const demoLogin = (email: string, a: DemoAccount) => {
  const u: User = { id: a.id, email, plan_tier: 'free', display_name: a.name }
  write('pz_demo_user', u)
  set({ user: u, ready: true })
}

// ---------- acciones ----------
const norm = (e: string) => e.trim().toLowerCase()

/** Registro. Devuelve 'verify' si hay que confirmar el email (lo normal) o 'signed_in' si Supabase no lo exige. */
export async function signUp(email: string, password: string, name: string): Promise<'verify' | 'signed_in'> {
  email = norm(email)
  if (passwordIssues(password).length) throw new AuthError('weak_password')
  if (!supabase) {
    const all = demoAccounts()
    if (!all[email]) all[email] = { hash: await sha(password), name: name.trim() || email.split('@')[0], id: 'demo-' + email }
    write('pz_demo_accounts', all)
    demoLogin(email, all[email])
    return 'signed_in'
  }
  // Si el email ya existe, Supabase responde igual que si fuera nuevo (no revela qué cuentas existen).
  const data = await run(() => supabase!.auth.signUp({ email, password, options: { emailRedirectTo: appUrl('entrar?verificado=1'), data: { display_name: name.trim().slice(0, 60) } } }))
  return data.session ? 'signed_in' : 'verify'
}

export async function signInWithPassword(email: string, password: string) {
  email = norm(email)
  if (!supabase) {
    const a = demoAccounts()[email]
    if (!a || a.hash !== (await sha(password))) throw new AuthError('invalid_credentials')
    return demoLogin(email, a)
  }
  const data = await run(() => supabase!.auth.signInWithPassword({ email, password }))
  await loadProfile(data.user)
}

export async function resendVerification(email: string) {
  if (!supabase) return
  await run(() => supabase!.auth.resend({ type: 'signup', email: norm(email), options: { emailRedirectTo: appUrl('entrar?verificado=1') } }))
}

/** Envía el email para crear una contraseña nueva. Responde igual exista o no la cuenta. */
export async function requestPasswordReset(email: string) {
  if (!supabase) return
  await run(() => supabase!.auth.resetPasswordForEmail(norm(email), { redirectTo: appUrl('restablecer') }))
}

export async function updatePassword(password: string) {
  if (passwordIssues(password).length) throw new AuthError('weak_password')
  if (!supabase) {
    const u = state.user; if (!u) throw new AuthError('expired')
    const all = demoAccounts(); if (all[u.email]) { all[u.email].hash = await sha(password); write('pz_demo_accounts', all) }
    return
  }
  await run(() => supabase!.auth.updateUser({ password }))
  set({ recovery: false })
}

export async function updateDisplayName(name: string) {
  const u = state.user; if (!u) return
  const display_name = name.trim().slice(0, 60) || u.email.split('@')[0]
  if (supabase) await run(async () => { const r = await supabase!.from('profiles').update({ display_name }).eq('id', u.id); return { data: null, error: r.error } })
  else { const all = demoAccounts(); if (all[u.email]) { all[u.email].name = display_name; write('pz_demo_accounts', all) } write('pz_demo_user', { ...u, display_name }) }
  set({ user: { ...u, display_name } })
}

/** Borra la cuenta y todos sus planes (función segura en la base de datos). */
export async function deleteAccount() {
  const u = state.user; if (!u) return
  if (supabase) {
    await run(async () => { const r = await supabase!.rpc('delete_my_account'); return { data: null, error: r.error } })
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } else {
    const all = demoAccounts(); delete all[u.email]; write('pz_demo_accounts', all); write(`pz_saved_${u.id}`, null)
  }
  write('pz_demo_user', null)
  set({ user: null, recovery: false })
}

/** Acceso sin contraseña con un enlace por email (se mantiene como alternativa). */
export async function signIn(email: string, next = window.location.href): Promise<'sent' | 'demo'> {
  if (supabase) {
    await run(() => supabase!.auth.signInWithOtp({ email: norm(email), options: { emailRedirectTo: next } }))
    return 'sent'
  }
  const all = demoAccounts()
  const a = all[norm(email)] ?? { hash: '', name: norm(email).split('@')[0], id: 'demo-' + norm(email) }
  all[norm(email)] = a; write('pz_demo_accounts', all)
  demoLogin(norm(email), a)
  return 'demo'
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut().catch(() => supabase!.auth.signOut({ scope: 'local' }))
  write('pz_demo_user', null)
  set({ user: null, recovery: false })
}

/** Error de un enlace de email que llegó en la URL al abrir la app (#error_code=otp_expired…). Se consume una vez. */
let linkError = initialLinkError
export function linkErrorFromUrl(): AuthErrorCode | null {
  const code = linkError
  linkError = null
  if (!code) return null
  return /expired|invalid|denied/.test(code) ? 'expired' : 'unknown'
}
