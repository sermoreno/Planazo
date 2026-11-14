import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ExternalLink, Footprints, MapPin, RefreshCw, Trash2, Wallet } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from './MapView'
import { PlanWeather, StopWeather, type PlanWxSummary } from './Weather'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { getPlace } from '@/lib/places'
import { credit, placePhoto } from '@/lib/photos'
import { totalCost, totalMinutes } from '@/lib/planner'
import { walkingRoute } from '@/lib/routing'
import type { Day, Itinerary, Place, Slot } from '@/lib/types'
import { cn, DAY_LABEL, durationLabel, euros, toMin } from '@/lib/utils'
import { dateFor, dayWx, HOT, hourWx, useForecast, wetHour, type Forecast, type HourWx } from '@/lib/weather'

/** Horas en punto que ocupa una parada (10:30–12:15 → 10, 11, 12). */
const hoursOf = (s: Slot) => { const a = Math.floor(toMin(s.start_time) / 60), b = Math.max(a, Math.ceil(toMin(s.end_time) / 60) - 1); return Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(2, '0') + ':00') }

/** Tiempo del plan: resumen por día y, por parada, la hora de inicio y si le pilla lluvia o calor estando al aire libre. */
function planWeather(it: Itinerary, days: Day[], f: Forecast | null | undefined) {
  const perSlot: Record<string, HourWx | undefined> = {}
  const summary: PlanWxSummary[] = []
  for (const d of days) {
    const date = dateFor(d), wx = dayWx(f, date)
    if (!wx) continue
    const item: PlanWxSummary = { day: d, wx, wetOutdoor: [], hotOutdoor: [], coldest: null }
    for (const s of it.slots.filter((x) => x.day === d)) {
      const p = getPlace(s.place_id)!
      const hs = hoursOf(s).map((h) => hourWx(f, date, h)).filter(Boolean) as HourWx[]
      perSlot[s.id] = hourWx(f, date, s.start_time)
      if (!hs.length) continue
      const max = Math.max(...hs.map((h) => h.temp)), min = Math.min(...hs.map((h) => h.temp))
      item.coldest = Math.min(item.coldest ?? 99, min)
      if (!p.indoor && hs.some(wetHour)) item.wetOutdoor.push(p.name)
      else if (!p.indoor && max >= HOT) item.hotOutdoor.push({ name: p.name, temp: max })
    }
    summary.push(item)
  }
  return { perSlot, summary }
}

export interface EditHandlers {
  alternatives: (slotId: string) => Place[]
  onReplace: (slotId: string, placeId: string) => void
  onRemove: (slotId: string) => void
}

/** Vista dividida: timeline + mapa. En móvil, mapa arriba plegable y lista como bottom sheet. */
export function ItineraryView({ it, edit, toolbar, onRain }: { it: Itinerary; edit?: EditHandlers; toolbar?: React.ReactNode; onRain?: () => void }) {
  const [active, setActive] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(true)
  const [legs, setLegs] = useState<Record<string, number>>({})
  const [lines, setLines] = useState<[number, number][][]>([])
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const days = useMemo(() => (['sat', 'sun'] as Day[]).filter((d) => it.slots.some((s) => s.day === d)), [it.slots])
  const routeKey = it.slots.map((s) => s.place_id + s.day).join('|')

  // Tiempo (Open-Meteo) en el centro de las paradas del plan.
  const center = useMemo(() => {
    const ps = it.slots.map((s) => getPlace(s.place_id)).filter(Boolean) as Place[]
    return ps.length ? { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length } : undefined
  }, [routeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const forecast = useForecast(center?.lat, center?.lng)
  const weather = useMemo(() => planWeather(it, days, forecast), [it, days, forecast])

  // Ruta a pie OSRM por día; actualiza minutos de traslado entre tarjetas.
  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all(days.map(async (d) => {
      const ds = it.slots.filter((s) => s.day === d)
      const r = await walkingRoute(ds.map((s) => getPlace(s.place_id)!), ctrl.signal)
      return { ds, r }
    })).then((res) => {
      const l: Record<string, number> = {}
      res.forEach(({ ds, r }) => ds.slice(1).forEach((s, i) => { l[s.id] = r.legMinutes[i] }))
      setLegs(l)
      setLines(res.map(({ r }) => r.line))
    }).catch(() => {})
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  const select = (id: string, scroll = true) => {
    setActive(id)
    if (scroll) cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const cost = totalCost(it)
  const over = cost > it.prefs.budget
  const walk = Object.values(legs).reduce((a, b) => a + b, 0)

  return (
    <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6 lg:px-4 lg:py-6">
      {/* Mapa: arriba en móvil (plegable), derecha en escritorio (fijo) */}
      <div className="lg:order-2">
        <div className={cn('relative overflow-hidden transition-[height] duration-300 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:rounded-card lg:shadow-soft', mapOpen ? 'h-[42vh]' : 'h-0')}>
          <MapView slots={it.slots} lines={lines} activeId={active} onSelect={(id) => select(id)} resizeKey={mapOpen} />
        </div>
      </div>

      {/* Bottom sheet / timeline */}
      <div className="relative z-[500] lg:order-1">
        <div className="rounded-t-[24px] bg-crema px-4 pb-28 pt-1 shadow-[0_-8px_24px_rgba(30,42,74,0.08)] lg:shadow-none lg:rounded-none lg:p-0 lg:pb-8">
          <button
            onClick={() => setMapOpen((o) => !o)}
            className="mx-auto mb-2 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-noche-600 lg:hidden"
            aria-expanded={mapOpen}
          >
            <span className="mr-1 block h-1 w-8 rounded-full bg-noche/20" />
            {mapOpen ? <>Ocultar mapa <ChevronUp className="h-3.5 w-3.5" /></> : <>Ver mapa <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>

          <div className="mb-4">
            <p className="text-sm font-semibold text-coral-700">{DAY_LABEL[it.prefs.day]} · Madrid</p>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{it.title}</h1>
            {it.source === 'mock' && <p className="mt-1 text-sm text-noche-600">Ejemplo con datos de prueba para validar la vista.</p>}
          </div>

          {toolbar}
          <PlanWeather items={weather.summary} onRain={onRain} />

          {days.map((d) => (
            <section key={d} className="mt-2">
              {days.length > 1 && <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-noche-600">{DAY_LABEL[d]}</h2>}
              <ol className="space-y-0">
                <AnimatePresence initial={false}>
                  {it.slots.filter((s) => s.day === d).map((s, i, arr) => (
                    <motion.li key={s.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
                      {i > 0 && <TravelGap minutes={legs[s.id] ?? s.travel_min_from_prev ?? 0} free={toMin(s.start_time) - toMin(arr[i - 1].end_time) - (legs[s.id] ?? s.travel_min_from_prev ?? 0)} />}
                      <StopCard
                        ref={(el) => { cardRefs.current[s.id] = el }}
                        slot={s}
                        n={it.slots.indexOf(s) + 1}
                        active={active === s.id}
                        onActivate={() => select(s.id, false)}
                        edit={edit}
                        canRemove={arr.length > 1}
                        wx={weather.perSlot[s.id]}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </section>
          ))}
        </div>
      </div>

      {/* Barra resumen */}
      <div className="fixed inset-x-0 bottom-0 z-[1100] border-t border-noche/10 bg-white/95 backdrop-blur lg:sticky lg:top-16 lg:col-span-2 lg:mt-2 lg:rounded-card lg:border-0 lg:shadow-soft">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-1.5">
              <Wallet className="h-4 w-4 self-center text-noche-600" aria-hidden />
              <span className={cn('whitespace-nowrap text-lg font-extrabold', over && 'text-coral-700')}>{euros(cost)}</span>
              <span className="whitespace-nowrap text-sm text-noche-600">de {it.prefs.budget} € /persona</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-noche/10" role="progressbar" aria-valuenow={cost} aria-valuemax={it.prefs.budget} aria-label="Coste frente a presupuesto">
              <div className={cn('h-full rounded-full', over ? 'bg-coral-700' : 'bg-coral')} style={{ width: `${Math.min(100, (cost / Math.max(it.prefs.budget, 1)) * 100)}%` }} />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-lg font-extrabold"><Clock className="h-4 w-4 text-noche-600" aria-hidden />{durationLabel(totalMinutes(it))}</div>
            <div className="whitespace-nowrap text-sm text-noche-600">{it.slots.length} paradas · {walk} min a pie</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TravelGap({ minutes, free }: { minutes: number; free: number }) {
  return (
    <div className="flex items-center gap-2 py-2 pl-[22px] text-xs font-semibold text-noche-600">
      <span className="h-6 border-l-2 border-dashed border-noche/25" />
      <Footprints className="h-3.5 w-3.5" aria-hidden /> {minutes} min a pie {minutes > 30 && <span className="font-normal">(o en metro)</span>}
      {free >= 45 && <span className="rounded-full bg-noche/5 px-2 py-0.5 font-semibold">+ {durationLabel(free)} libres</span>}
    </div>
  )
}


const StopCard = forwardRef<HTMLDivElement, { slot: Slot; n: number; active: boolean; onActivate: () => void; edit?: EditHandlers; canRemove: boolean; wx?: HourWx }>(
  function StopCard({ slot, n, active, onActivate, edit, canRemove, wx }, ref) {
    const p = getPlace(slot.place_id)!
    const photo = placePhoto(p.name)
    const [alts, setAlts] = useState<Place[] | null>(null)
    return (
      <Card
        ref={ref}
        onMouseEnter={onActivate}
        onClick={onActivate}
        className={cn('relative overflow-hidden transition-shadow', active && 'ring-2 ring-noche')}
      >
        {photo && (
          <div className="relative h-36 overflow-hidden sm:h-44">
            <img src={photo.src} alt={p.name} loading="lazy" className={cn('h-full w-full object-cover transition-transform duration-700', active && 'scale-105')} />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,20,38,0)_45%,rgba(14,20,38,.7)_100%)]" />
            <a href={photo.page} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-2 right-3 max-w-[60%] truncate text-[10px] font-medium text-white/85 hover:text-white" title={credit(photo)}>
              Foto: {photo.artist || 'Wikimedia Commons'} · {photo.license}
            </a>
          </div>
        )}
        <div className="flex gap-3 p-4">
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold', active ? 'bg-noche text-white' : 'bg-coral text-noche')}>{n}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-noche-600">
              <span className="text-noche">{slot.start_time}–{slot.end_time}</span>
              <span aria-hidden>·</span><span>{durationLabel(slot.duration_min)}</span>
            </div>
            <h3 className="mt-0.5 text-lg font-extrabold leading-snug">{p.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge className="bg-noche/5 text-noche"><MapPin className="h-3 w-3" aria-hidden />{p.neighborhood}</Badge>
              <Badge>{euros(slot.est_cost)}{slot.est_cost > 0 && ' aprox.'}</Badge>
              <Badge className="bg-noche/5 capitalize text-noche">{p.category}</Badge>
              {p.indoor && <Badge className="bg-noche/5 text-noche">A cubierto</Badge>}
              <StopWeather wx={wx} indoor={p.indoor} />
            </div>
            <p className="mt-3 text-[15px] leading-relaxed"><span className="font-bold">Por qué encaja: </span>{slot.reason.replace(/^Encaja porque /, '')}</p>
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#FFF4D6] px-3 py-2 text-[13px] font-medium text-[#6B4E00]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Confirma horario y precio. {p.is_verified ? '' : 'Dato no verificado.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {edit && (
                <>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setAlts(alts ? null : edit.alternatives(slot.id)) }}>
                    <RefreshCw className="h-4 w-4" aria-hidden /> Cambiar esta parada
                  </Button>
                  {canRemove && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); edit.onRemove(slot.id) }}>
                      <Trash2 className="h-4 w-4" aria-hidden /> Quitar
                    </Button>
                  )}
                </>
              )}
              <a href={p.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-noche underline-offset-2 hover:underline">
                Más info <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
            <AnimatePresence>
              {alts && edit && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className="mt-3 text-sm font-bold">Alternativas cercanas</p>
                  {alts.length === 0 && <p className="mt-1 text-sm text-noche-600">No hay alternativas abiertas a esa hora dentro del presupuesto.</p>}
                  <ul className="mt-2 space-y-2">
                    {alts.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAlts(null); edit.onReplace(slot.id, a.id) }}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-noche/10 px-3 py-2.5 text-left hover:border-noche/40"
                        >
                          <span><span className="block font-bold">{a.name}</span><span className="text-sm text-noche-600">{a.neighborhood} · {a.category} · {durationLabel(a.avg_duration_min)}</span></span>
                          <span className="shrink-0 text-sm font-bold">{euros(a.avg_cost_eur)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    )
  },
)
