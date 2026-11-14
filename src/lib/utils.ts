import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const toTime = (m: number) => { const mm = Math.round(m); return `${String(Math.floor(mm / 60) % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}` }

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** Minutos a pie estimados (factor 1,3 por trazado urbano, 4,8 km/h). */
export const walkMinutes = (km: number) => Math.max(3, Math.round(((km * 1.3) / 4.8) * 60))

export const euros = (n: number) => (n === 0 ? 'Gratis' : `${Math.round(n)} €`)
export const durationLabel = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min` }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
/** Enlace para compartir: 12 caracteres aleatorios criptográficos (no se puede adivinar). */
export const slug = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
export const DAY_LABEL: Record<string, string> = { sat: 'Sábado', sun: 'Domingo', both: 'Sábado y domingo' }
