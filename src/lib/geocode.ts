/** Geocodificación con Nominatim: máx. 1 petición/s y caché (Supabase `geocode_cache` o localStorage). */
import { supabase } from './supabase'

let last = 0
const LS = 'pz_geocode'
const local = (): Record<string, [number, number]> => { try { return JSON.parse(localStorage.getItem(LS) ?? '{}') } catch { return {} } }

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim().toLowerCase()
  const l = local()[q]
  if (l) return { lat: l[0], lng: l[1] }
  if (supabase) {
    const { data } = await supabase.from('geocode_cache').select('lat,lng').eq('query', q).maybeSingle()
    if (data) return data
  }
  const wait = Math.max(0, last + 1100 - Date.now())
  if (wait) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q=${encodeURIComponent(query + ', Madrid')}`
  const r = await fetch(url, { headers: { 'Accept-Language': 'es' } }).catch(() => null)
  const j = r?.ok ? await r.json() : []
  if (!j[0]) return null
  const res = { lat: Number(j[0].lat), lng: Number(j[0].lon) }
  try { localStorage.setItem(LS, JSON.stringify({ ...local(), [q]: [res.lat, res.lng] })) } catch { /* sin almacenamiento */ }
  if (supabase) await supabase.from('geocode_cache').upsert({ query: q, ...res, updated_at: new Date().toISOString() })
  return res
}
