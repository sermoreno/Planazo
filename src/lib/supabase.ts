import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Error de un enlace de email caducado (#error_code=otp_expired…). Se lee ANTES de crear el cliente, que limpia la URL. */
const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.replace(/^#/, '') + '&' + window.location.search.replace(/^\?/, ''))
export const initialLinkError: string | null = params?.get('error_code') ?? params?.get('error') ?? null

/** null = modo demo local (sin credenciales): todo se guarda en este navegador. */
// Sesión persistente en el navegador con renovación automática. Flujo "implicit": los enlaces del email
// (verificación, recuperación) funcionan aunque se abran en otro dispositivo o navegador.
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : null
export const isDemo = !supabase
