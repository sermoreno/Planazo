/**
 * Tiempo con Open-Meteo (https://open-meteo.com): gratis, sin clave y con CORS, así que se pide desde el navegador.
 * Licencia de los datos: CC BY 4.0, hay que citar "Open-Meteo.com" (ver WeatherCredit).
 * El plan gratuito es para uso no comercial; si Planazo cobra, hay que pasar a su API comercial (VITE_WEATHER_URL).
 * Caché de 1 hora en el navegador para no repetir peticiones.
 */
import { useEffect, useState } from 'react'
import type { Day } from './types'

const TZ = 'Europe/Madrid'
const API = (import.meta.env.VITE_WEATHER_URL as string | undefined) || 'https://api.open-meteo.com/v1/forecast'
const TTL = 60 * 60 * 1000
export const MADRID = { lat: 40.4168, lng: -3.7038 }

export interface DayWx { date: string; code: number; max: number; min: number; rainProb: number | null; rainMm: number }
export interface HourWx { time: string; temp: number; rainProb: number | null; code: number; isDay: boolean }
export interface Forecast { days: DayWx[]; hours: Record<string, HourWx>; fetchedAt: number }

// ---------- fechas en hora de Madrid ----------
const ymd = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: TZ })
/** Fecha (AAAA-MM-DD) del próximo sábado o domingo, o de hoy si ya lo es. */
export function dateFor(day: Day, now = new Date()): string {
  const [y, m, d] = ymd(now).split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + (((day === 'sat' ? 6 : 0) - base.getUTCDay() + 7) % 7))
  return base.toISOString().slice(0, 10)
}
export const dayNumber = (date: string) => Number(date.slice(8, 10))

// ---------- códigos WMO → texto e icono ----------
export type WxKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'
const CODES: Record<number, [WxKind, string]> = {
  0: ['clear', 'Despejado'], 1: ['clear', 'Casi despejado'], 2: ['partly', 'Intervalos de nubes'], 3: ['cloudy', 'Nublado'],
  45: ['fog', 'Niebla'], 48: ['fog', 'Niebla con escarcha'],
  51: ['drizzle', 'Llovizna débil'], 53: ['drizzle', 'Llovizna'], 55: ['drizzle', 'Llovizna intensa'], 56: ['drizzle', 'Llovizna helada'], 57: ['drizzle', 'Llovizna helada'],
  61: ['rain', 'Lluvia débil'], 63: ['rain', 'Lluvia'], 65: ['rain', 'Lluvia fuerte'], 66: ['rain', 'Lluvia helada'], 67: ['rain', 'Lluvia helada fuerte'],
  71: ['snow', 'Nieve débil'], 73: ['snow', 'Nieve'], 75: ['snow', 'Nieve fuerte'], 77: ['snow', 'Granizo fino'],
  80: ['rain', 'Chubascos débiles'], 81: ['rain', 'Chubascos'], 82: ['rain', 'Chubascos fuertes'], 85: ['snow', 'Chubascos de nieve'], 86: ['snow', 'Chubascos de nieve'],
  95: ['storm', 'Tormenta'], 96: ['storm', 'Tormenta con granizo'], 99: ['storm', 'Tormenta con granizo'],
}
export const wxKind = (code: number): WxKind => CODES[code]?.[0] ?? 'cloudy'
export const wxLabel = (code: number) => CODES[code]?.[1] ?? 'Variable'
const WET: WxKind[] = ['drizzle', 'rain', 'snow', 'storm']

/** ¿Hay que proteger el plan de la lluvia? Probabilidad ≥ 50 % o un código de lluvia/nieve/tormenta. */
export const wetHour = (h: HourWx | undefined) => !!h && ((h.rainProb ?? 0) >= 50 || WET.includes(wxKind(h.code)))
export function rainRisk(d: DayWx | undefined): 'alta' | 'posible' | 'baja' | null {
  if (!d) return null
  const p = d.rainProb ?? (WET.includes(wxKind(d.code)) ? 60 : 0)
  if (p >= 50 || (d.rainMm >= 2 && p >= 30)) return 'alta'
  if (p >= 25 || d.rainMm >= 0.5) return 'posible'
  return 'baja'
}
export const HOT = 32
export const COLD = 5

// ---------- petición y caché ----------
const memo = new Map<string, Promise<Forecast>>()
const readCache = (): Record<string, Forecast> => { try { return JSON.parse(localStorage.getItem('pz_wx') ?? '{}') } catch { return {} } }
const writeCache = (k: string, f: Forecast) => {
  try {
    const all = { ...readCache(), [k]: f }
    const keep = Object.entries(all).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, 6)
    localStorage.setItem('pz_wx', JSON.stringify(Object.fromEntries(keep)))
  } catch { /* sin almacenamiento */ }
}

type Raw = {
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[]; is_day: number[] }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[]; precipitation_sum: (number | null)[] }
}
function parse(r: Raw): Forecast {
  const hours: Record<string, HourWx> = {}
  r.hourly.time.forEach((t, i) => { hours[t] = { time: t, temp: r.hourly.temperature_2m[i], rainProb: r.hourly.precipitation_probability[i] ?? null, code: r.hourly.weather_code[i], isDay: r.hourly.is_day[i] === 1 } })
  const days = r.daily.time.map((date, i) => ({
    date, code: r.daily.weather_code[i], max: r.daily.temperature_2m_max[i], min: r.daily.temperature_2m_min[i],
    rainProb: r.daily.precipitation_probability_max[i] ?? null, rainMm: r.daily.precipitation_sum[i] ?? 0,
  }))
  return { days, hours, fetchedAt: Date.now() }
}

/** Previsión de 16 días (diaria y por horas) para un punto. Se redondea a ~1 km para compartir caché. */
export function getForecast(lat = MADRID.lat, lng = MADRID.lng): Promise<Forecast> {
  const k = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = readCache()[k]
  if (cached && Date.now() - cached.fetchedAt < TTL) return Promise.resolve(cached)
  if (memo.has(k)) return memo.get(k)!
  const q = new URLSearchParams({
    latitude: lat.toFixed(2), longitude: lng.toFixed(2), timezone: TZ, forecast_days: '16',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
  })
  const p = fetch(`${API}?${q}`, { signal: AbortSignal.timeout?.(8000) })
    .then((r) => { if (!r.ok) throw new Error('WEATHER_' + r.status); return r.json() as Promise<Raw> })
    .then((raw) => { const f = parse(raw); writeCache(k, f); return f })
    .catch((e) => { memo.delete(k); if (cached) return cached; throw e }) // sin red: la última previsión guardada
  memo.set(k, p)
  return p
}

export const dayWx = (f: Forecast | null | undefined, date: string) => f?.days.find((d) => d.date === date)
/** Tiempo a la hora de una parada (HH:MM → hora en punto). */
export const hourWx = (f: Forecast | null | undefined, date: string, time: string) => f?.hours[`${date}T${time.slice(0, 2)}:00`]

/** Hook: undefined mientras carga, null si falla. */
export function useForecast(lat?: number, lng?: number) {
  const [f, setF] = useState<Forecast | null | undefined>(undefined)
  const k = lat != null && lng != null ? `${lat.toFixed(2)},${lng.toFixed(2)}` : 'madrid'
  useEffect(() => {
    let live = true
    setF(undefined)
    getForecast(lat ?? MADRID.lat, lng ?? MADRID.lng).then((x) => live && setF(x)).catch(() => live && setF(null))
    return () => { live = false }
  }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  return f
}
