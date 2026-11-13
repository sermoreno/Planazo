/**
 * Planificador local (fallback sin IA). Elige SOLO lugares de la tabla `places`,
 * ordena por proximidad y respeta presupuesto y horario de apertura.
 * La Edge Function `generate-plan` usa el mismo contrato de salida (slots).
 */
import { PLACES, getPlace } from './places'
import type { Day, Interest, Itinerary, Place, Preferences, Slot } from './types'
import { distanceKm, toMin, toTime, uid, walkMinutes } from './utils'

const FOOD = new Set(['restaurante', 'bar', 'mercado', 'cafetería'])
const NIGHT = new Set(['club de jazz', 'tablao'])
const SOL = { lat: 40.4169, lng: -3.7035 }
const VERIFY = 'Estimación: confirma horario y precio antes de ir.'

const MOOD_RULES: [RegExp, string, string][] = [
  [/relaj|tranquil|descon|calma|paz|descans/i, 'tranquilo', 'desconectar'],
  [/aventur|activ|energ|movern|deport|sudar/i, 'activo', 'moverte'],
  [/rom[aá]nt|pareja|especial|cita/i, 'pareja', 'un plan especial'],
  [/cultur|inspir|aprend|arte|museo/i, 'cultura', 'inspirarte'],
  [/fiesta|noche|marcha|bailar|copas/i, 'nocturno', 'salir de noche'],
  [/comer|gastr|tapas|hambre|comida/i, 'gastronomia', 'comer bien'],
  [/natur|aire libre|verde|sol|campo/i, 'naturaleza', 'aire libre'],
  [/sorpr|distint|nuevo|diferente|alternativ/i, 'alternativo', 'algo diferente'],
  [/niñ|peque|hij|famil|cr[ií]as|chaval/i, 'niños', 'disfrutar con los peques'],
  [/animal|zoo|acuario|delf/i, 'animales', 'ver animales'],
]

const INTEREST_LABEL: Record<Interest, string> = {
  cultura: 'cultura', naturaleza: 'naturaleza', gastronomia: 'buena mesa', nocturno: 'plan nocturno', deporte: 'moverte', mercadillos: 'mercadillos',
}

export function moodTags(mood: string) {
  return MOOD_RULES.filter(([re]) => re.test(mood)).map(([, tag, label]) => ({ tag, label }))
}

const startFor = (pace: Preferences['pace']) => (pace === 'tranquilo' ? '11:00' : pace === 'intenso' ? '10:00' : '10:30')
const gapFor = (pace: Preferences['pace']) => (pace === 'tranquilo' ? 25 : pace === 'intenso' ? 5 : 15)

export function isOpen(p: Place, day: Day, start: number, end: number) {
  const h = p.opening_hours[day]
  if (!h) return false
  const close = toMin(h[1]) === toMin('23:59') ? 24 * 60 : toMin(h[1])
  return start >= toMin(h[0]) && end <= close
}

/** Coste por persona estimado según compañía (familia: algo menos por niños). */
const costFor = (p: Place, prefs: Preferences) => Math.round(p.avg_cost_eur * (prefs.companions === 'familia' ? 0.85 : 1))

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function score(p: Place, prefs: Preferences, mood: { tag: string }[], clock: number, rand: () => number) {
  let s = 0
  for (const i of prefs.interests) if (p.tags.includes(i)) s += 3
  for (const m of mood) if (p.tags.includes(m.tag)) s += m.tag === 'animales' ? 4 : 2 // 'animales' es un deseo muy concreto
  if (prefs.companions && p.tags.includes(prefs.companions)) s += 1.5
  if (prefs.companions === 'familia') s += p.tags.includes('niños') ? 2.5 : p.tags.includes('familia') ? 0 : -1.5
  else if (p.tags.includes('dia-completo') && !prefs.interests.length) s -= 1.5 // los parques temáticos, solo si encajan
  if (prefs.constraints.calmer || prefs.pace === 'tranquilo') s += p.tags.includes('tranquilo') ? 1.5 : 0
  if (prefs.pace === 'intenso' && p.tags.includes('activo')) s += 1
  if (prefs.constraints.rain) s += p.indoor ? 3 : -6
  if (prefs.constraints.cheaper) s -= p.price_level * 1.2
  if (clock >= 18 * 60 && (p.tags.includes('atardecer') || p.tags.includes('nocturno'))) s += 2.5
  if (clock < 18 * 60 && p.category === 'tablao') s -= 4
  if (prefs.interests.length === 0 && mood.length === 0) s += rand() * 3 // Sorpréndeme
  return s + rand() * 0.8
}

function reasonFor(p: Place, prefs: Preferences, mood: { tag: string; label: string }[], isMeal: boolean, start = 12 * 60) {
  const interest = prefs.interests.find((i) => p.tags.includes(i))
  const m = mood.filter((x) => start >= 19 * 60 || x.tag !== 'nocturno').find((x) => p.tags.includes(x.tag))
  const sunset = p.tags.includes('atardecer') && Math.abs(start - sunsetMin()) <= 90
  const who = prefs.companions && p.tags.includes(prefs.companions) ? { solo: 'para ir a tu aire', pareja: 'para disfrutar en pareja', amigos: 'para compartir con amigos', familia: 'para ir en familia' }[prefs.companions] : ''
  const cost = p.avg_cost_eur === 0 ? 'es gratis' : p.price_level <= 1 ? 'cuida tu presupuesto' : 'encaja en tu presupuesto'
  const why = p.tags.includes('dia-completo') ? 'llena el día y se come dentro del parque' : isMeal ? 'te pilla a la hora de comer' : sunset ? 'es buen sitio para ver el atardecer' : m ? `te ayuda a ${m.label}` : interest ? `suma ${INTEREST_LABEL[interest]}` : prefs.constraints.rain && p.indoor ? 'es a cubierto si llueve' : 'queda de camino'
  return `Encaja porque ${why}${who ? ', ' + who : ''} y ${cost}.`
}

interface BuildOpts { seed?: number; exclude?: Set<string> }

/** Genera los slots de un día. */
/** Hora aproximada de puesta de sol en Madrid por mes (hora local). */
const SUNSET = [18.0, 18.6, 19.25, 20.85, 21.4, 21.75, 21.75, 21.25, 20.5, 19.6, 18.0, 17.85]
export const sunsetMin = (d = new Date()) => Math.round(SUNSET[d.getMonth()] * 60)

type Anchor = { at: number; kind: 'free' | 'meal' | 'sunset' | 'night' }
/** Franjas del día según ritmo: tranquilo 3, equilibrado 4, intenso 5-6 paradas. */
function anchorsFor(pace: Preferences['pace'], startTime: number, prefs: Preferences): Anchor[] {
  const sun = Math.max(sunsetMin() - 45, 16 * 60 + 30)
  const morning: Anchor = { at: startTime, kind: 'free' }
  const lunch: Anchor = { at: 14 * 60, kind: 'meal' }
  const afternoon: Anchor = { at: Math.min(16 * 60 + 30, sun - 60), kind: 'free' }
  const sunset: Anchor = { at: sun, kind: 'sunset' }
  const night: Anchor = { at: 21 * 60, kind: 'night' }
  if (pace === 'tranquilo') return [morning, lunch, sunset]
  if (pace === 'intenso') return [morning, { at: startTime + 120, kind: 'free' }, lunch, afternoon, sunset, ...(prefs.interests.includes('nocturno') || prefs.companions === 'amigos' ? [night] : [])]
  return [morning, lunch, afternoon, sunset]
}

/** Genera los slots de un día. */
export function buildDay(prefs: Preferences, day: Day, opts: BuildOpts = {}): Slot[] {
  const rand = rng(opts.seed ?? Date.now())
  const mood = moodTags(prefs.mood)
  const pace = prefs.constraints.calmer ? 'tranquilo' : prefs.pace
  const gap = gapFor(pace)
  const budget = (prefs.constraints.cheaper ? 0.6 : 1) * prefs.budget
  const avoid = new Set(prefs.constraints.avoidNeighborhoods ?? [])
  const used = new Set<string>(opts.exclude ?? [])
  const usedCats: string[] = []
  const slots: Slot[] = []
  const startTime = toMin(prefs.constraints.startTime ?? startFor(prefs.pace))
  const endLimit = toMin(prefs.constraints.endTime ?? '23:30')
  let clock = startTime
  let spent = 0
  let prev: Place | null = null

  for (const a of anchorsFor(pace, startTime, prefs)) {
    const remaining = budget - spent
    const isFood = (p: Place) => FOOD.has(p.category)
    const pick = (strict: boolean, maxTravel: number) =>
      PLACES.filter((p) => !used.has(p.id) && (!strict || !avoid.has(p.neighborhood)) && (!prefs.constraints.rain || p.indoor))
        .filter((p) => (a.kind === 'meal' ? isFood(p) && p.avg_cost_eur > 0 && p.category !== 'cafetería' : true))
        .filter((p) => costFor(p, prefs) <= Math.max(remaining, 0))
        .map((p) => {
          const travel = prev ? walkMinutes(distanceKm(prev, p)) : 0
          const fromOrigin = !prev && prefs.constraints.origin ? walkMinutes(distanceKm(prefs.constraints.origin, p)) : 0
          const start = Math.max(a.at, clock + travel)
          return { p, travel, fromOrigin, start, end: start + p.avg_duration_min }
        })
        .filter((c) => isOpen(c.p, day, c.start, c.end) && c.end <= endLimit && c.travel <= maxTravel && c.start - a.at <= 90)
        .map((c) => {
          let s = score(c.p, prefs, mood, c.start, rand) - c.travel / 6 - c.fromOrigin / 10
          if (!prev && !prefs.constraints.origin) s -= distanceKm(SOL, c.p) / (prefs.companions === 'familia' ? 3 : 1.5) // empezar cerca del centro (en familia se acepta ir más lejos)
          const late = c.start >= 19 * 60
          if (a.kind !== 'sunset' && c.p.tags.includes('atardecer')) s -= 2.5 // guardar miradores para el atardecer
          if (!late && a.kind !== 'meal' && (NIGHT.has(c.p.category) || (c.p.category === 'bar' && c.p.tags.includes('nocturno')))) s -= 3
          s -= usedCats.filter((k) => k === c.p.category).length * 2.5 // variedad
          if (a.kind !== 'meal' && isFood(c.p) && c.p.category !== 'mercado') s -= c.p.category === 'cafetería' && a.kind === 'free' ? 1.5 : 4
          if (prefs.companions === 'familia' && (c.p.category === 'bar' || NIGHT.has(c.p.category))) s -= 2.5
          if (a.kind === 'sunset') s += c.p.tags.includes('atardecer') ? 6 : c.p.category === 'mirador' ? 3 : 0
          if (a.kind === 'night') s += c.p.tags.includes('nocturno') ? 4 : isFood(c.p) ? 1 : -3
          return { ...c, s }
        })
        .filter((c) => a.kind !== 'night' || c.s > 0)
        .sort((x, y) => y.s - x.s)[0]
    const near = pace === 'intenso' ? 45 : 35
    const best = pick(true, near) ?? pick(false, near) ?? pick(false, 60) ?? (a.kind === 'meal' ? pick(false, 120) : undefined) // comer siempre, aunque toque metro
    if (!best) continue
    used.add(best.p.id)
    usedCats.push(best.p.category)
    spent += costFor(best.p, prefs)
    slots.push(makeSlot(best.p, prefs, day, best.start, best.travel, prev ? best.travel : null, reasonFor(best.p, prefs, mood, a.kind === 'meal', best.start)))
    clock = best.end + gap
    prev = best.p
  }
  return slots
}

function makeSlot(p: Place, prefs: Preferences, day: Day, start: number, _travel: number, travelFromPrev: number | null, reason: string): Slot {
  return {
    id: uid(), day, place_id: p.id, start_time: toTime(start), end_time: toTime(start + p.avg_duration_min),
    title: p.name, reason, est_cost: costFor(p, prefs), duration_min: p.avg_duration_min, verify_note: VERIFY,
    travel_min_from_prev: travelFromPrev,
  }
}

export function titleFor(prefs: Preferences) {
  const m = moodTags(prefs.mood)[0]?.label
  const who = { solo: 'a tu aire', pareja: 'en pareja', amigos: 'con amigos', familia: 'en familia' }[prefs.companions ?? 'solo']
  const day = prefs.day === 'both' ? 'Finde' : prefs.day === 'sat' ? 'Sábado' : 'Domingo'
  return m ? `${day} para ${m} ${who}` : `${day} en Madrid ${who}`
}

export function generateLocal(prefs: Preferences, seed = Date.now()): Itinerary {
  const days: Day[] = prefs.day === 'both' ? ['sat', 'sun'] : [prefs.day]
  const half = prefs.day === 'both' ? { ...prefs, budget: prefs.budget / 2 } : prefs
  let slots: Slot[] = []
  for (const d of days) slots = slots.concat(buildDay(half, d, { seed: seed + (d === 'sun' ? 7 : 0), exclude: new Set(slots.map((x) => x.place_id)) }))
  return { id: uid(), title: titleFor(prefs), prefs, slots, created_at: new Date().toISOString(), status: 'draft', share_slug: null, is_public: false, source: 'local' }
}

/** Recalcula horas y traslados después de cambiar/quitar paradas (mantiene el orden). */
export function retime(it: Itinerary): Itinerary {
  const gap = gapFor(it.prefs.pace)
  const out: Slot[] = []
  for (const day of ['sat', 'sun'] as Day[]) {
    const ds = it.slots.filter((s) => s.day === day)
    let clock = ds.length ? toMin(ds[0].start_time) : 0
    let prev: Place | undefined
    for (const s of ds) {
      const p = getPlace(s.place_id)!
      const travel = prev ? walkMinutes(distanceKm(prev, p)) : null
      const start = prev ? Math.max(toMin(s.start_time), clock + (travel ?? 0)) : clock
      out.push({ ...s, start_time: toTime(start), end_time: toTime(start + s.duration_min), travel_min_from_prev: travel })
      clock = start + s.duration_min + gap
      prev = p
    }
  }
  return { ...it, slots: out }
}

/** 3 alternativas cercanas para una parada, abiertas a esa hora y dentro del presupuesto. */
export function alternativesFor(it: Itinerary, slotId: string): Place[] {
  const slot = it.slots.find((s) => s.id === slotId)
  if (!slot) return []
  const cur = getPlace(slot.place_id)!
  const used = new Set(it.slots.map((s) => s.place_id))
  const others = it.slots.filter((s) => s.id !== slotId).reduce((a, s) => a + s.est_cost, 0)
  const room = Math.max(it.prefs.budget - others, 0)
  const start = toMin(slot.start_time)
  const mood = moodTags(it.prefs.mood)
  const wantFood = FOOD.has(cur.category)
  return PLACES.filter((p) => !used.has(p.id) && costFor(p, it.prefs) <= room && isOpen(p, slot.day, start, start + p.avg_duration_min))
    .map((p) => ({ p, d: distanceKm(cur, p), s: score(p, it.prefs, mood, start, () => 0.5) + (FOOD.has(p.category) === wantFood ? 3 : 0) }))
    .sort((a, b) => a.d * 1.5 - a.s - (b.d * 1.5 - b.s))
    .slice(0, 3)
    .map((x) => x.p)
}

export function replaceSlot(it: Itinerary, slotId: string, placeId: string): Itinerary {
  const p = getPlace(placeId)!
  const mood = moodTags(it.prefs.mood)
  const slots = it.slots.map((s) => {
    if (s.id !== slotId) return s
    const isMeal = FOOD.has(p.category) && toMin(s.start_time) >= 13 * 60 && toMin(s.start_time) <= 15 * 60
    return { ...makeSlot(p, it.prefs, s.day, toMin(s.start_time), 0, s.travel_min_from_prev, reasonFor(p, it.prefs, mood, isMeal)), id: s.id }
  })
  return retime({ ...it, slots })
}

export const removeSlot = (it: Itinerary, slotId: string) => retime({ ...it, slots: it.slots.filter((s) => s.id !== slotId) })

export type GlobalAdjust = 'cheaper' | 'calmer' | 'zone' | 'rain'
export function adjustGlobal(it: Itinerary, kind: GlobalAdjust, seed = Date.now()): Itinerary {
  const c = { ...it.prefs.constraints }
  if (kind === 'cheaper') c.cheaper = true
  if (kind === 'calmer') c.calmer = true
  if (kind === 'rain') c.rain = true
  if (kind === 'zone') c.avoidNeighborhoods = [...new Set([...(c.avoidNeighborhoods ?? []), ...it.slots.map((s) => getPlace(s.place_id)!.neighborhood)])]
  const prefs = { ...it.prefs, constraints: c }
  const next = generateLocal(prefs, seed)
  return { ...it, prefs, slots: next.slots, title: next.title }
}

export const totalCost = (it: Itinerary) => it.slots.reduce((a, s) => a + s.est_cost, 0)
export const totalMinutes = (it: Itinerary) => {
  let t = 0
  for (const day of ['sat', 'sun'] as Day[]) {
    const ds = it.slots.filter((s) => s.day === day)
    if (ds.length) t += toMin(ds[ds.length - 1].end_time) - toMin(ds[0].start_time)
  }
  return t
}
