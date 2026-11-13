import { AnimatePresence, motion } from 'framer-motion'
import L from 'leaflet'
import { Clock, Footprints, MapPin, Route as RouteIcon, Sparkles, TrainFront, UtensilsCrossed, Ticket, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { placePhoto } from '@/lib/photos'
import { walkingRoute, type Route } from '@/lib/routing'
import type { Place } from '@/lib/types'
import { TILES, TILES_ATTR, TILES_MAX_ZOOM, TILES_SUBDOMAINS } from '@/lib/tiles'
import { cn, distanceKm, durationLabel, euros } from '@/lib/utils'
import { ZONES, type Zone } from '@/lib/zones'

const FOOD = new Set(['restaurante', 'bar', 'mercado', 'cafetería'])
const isFood = (p: Place) => FOOD.has(p.category)
type Tab = 'comer' | 'ocio' | 'trayectos'

const SVG_FOOD = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11"/></svg>'
const SVG_FUN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L3 9.4l6.2-.9z"/></svg>'
const pin = (p: Place, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="pz-pin ${isFood(p) ? 'food' : 'fun'}${active ? ' active' : ''}">${isFood(p) ? SVG_FOOD : SVG_FUN}</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  })
const hubIcon = L.divIcon({ className: '', html: '<div class="pz-hub">M</div>', iconSize: [26, 26], iconAnchor: [13, 13] })

function ZoomWatch({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useEffect(() => { const h = () => onZoom(map.getZoom()); h(); map.on('zoomend', h); return () => { map.off('zoomend', h) } }, [map, onZoom])
  return null
}
const CENTRAL = new Set(['sol', 'latina', 'lavapies', 'letras', 'prado'])

function Fit({ zone }: { zone: Zone | null }) {
  const map = useMap()
  useEffect(() => {
    const pts = zone ? zone.polygon : ZONES.filter((z) => !['este', 'chamartin', 'vallecas', 'casadecampo', 'rio'].includes(z.id)).flatMap((z) => z.polygon)
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [20, zone ? 150 : 170], paddingBottomRight: [20, zone && window.innerWidth < 1024 ? Math.round(window.innerHeight * 0.45) : 20], maxZoom: 16 })
  }, [zone, map])
  return null
}

interface Trip { id: string; label: string; from: string; points: { lat: number; lng: number }[]; route?: Route }

export default function Explore() {
  const [zone, setZone] = useState<Zone | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('comer')
  const [place, setPlace] = useState<Place | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(13)
  const navigate = useNavigate()

  const food = useMemo(() => zone?.places.filter(isFood) ?? [], [zone])
  const fun = useMemo(() => zone?.places.filter((p) => !isFood(p)) ?? [], [zone])

  function selectZone(z: Zone | null) {
    setZone(z); setPlace(null); setTrip(null)
    if (z) setTab(z.places.some(isFood) ? 'comer' : 'ocio')
  }

  async function showTrip(t: Trip) {
    setTrip(t); setLoading(true)
    const route = await walkingRoute(t.points).catch(() => undefined)
    setTrip({ ...t, route }); setLoading(false)
  }
  const tripFromHub = (p: Place) => zone && showTrip({ id: 'hub-' + p.id, label: p.name, from: zone.hub.label, points: [zone.hub, p] })
  const loop = useMemo<Trip | null>(() => {
    if (!zone || zone.places.length < 2) return null
    // Paseo por la zona: vecino más cercano desde la salida de metro
    const rest = [...zone.places]; const order: Place[] = []
    let cur: { lat: number; lng: number } = zone.hub
    while (rest.length) { rest.sort((a, b) => distanceKm(cur, a) - distanceKm(cur, b)); cur = rest.shift()!; order.push(cur as Place) }
    return { id: 'loop', label: `Paseo por ${zone.name}`, from: zone.hub.label, points: [zone.hub, ...order] }
  }, [zone])

  function openPlace(p: Place) { setPlace(p); tripFromHub(p) }

  return (
    <main className="relative h-[calc(100svh-3.5rem)] overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* MAPA */}
      <div className="relative h-full">
        <MapContainer center={[40.418, -3.703]} zoom={13} className="h-full w-full" zoomControl={false}>
          <TileLayer url={TILES} attribution={TILES_ATTR} subdomains={TILES_SUBDOMAINS} maxZoom={TILES_MAX_ZOOM} />
          {ZONES.map((z) => {
            const sel = zone?.id === z.id, hov = hover === z.id
            return (
              <Polygon
                key={z.id}
                positions={z.polygon}
                pathOptions={{ color: sel ? '#1E2A4A' : '#FF6B4A', weight: sel ? 3 : hov ? 2.5 : 1.5, fillColor: sel ? '#FF6B4A' : '#FF6B4A', fillOpacity: sel ? 0.12 : hov ? 0.28 : zone ? 0.06 : 0.16, dashArray: sel ? undefined : '4 4' }}
                eventHandlers={{ click: () => selectZone(z), mouseover: () => setHover(z.id), mouseout: () => setHover(null) }}
              >
                {!zone && (zoom >= 15 || !CENTRAL.has(z.id)) && <Tooltip direction="center" permanent className="pz-zone-label">{z.name.split(/ y |,/)[0]}</Tooltip>}
              </Polygon>
            )
          })}
          {zone && (
            <>
              <Marker position={[zone.hub.lat, zone.hub.lng]} icon={hubIcon} title={zone.hub.label}><Tooltip direction="top" offset={[0, -12]}>{zone.hub.label}</Tooltip></Marker>
              {zone.places.filter((p) => tab === 'trayectos' || (tab === 'comer' ? isFood(p) : !isFood(p))).map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p, place?.id === p.id)} eventHandlers={{ click: () => openPlace(p) }} title={p.name}>
                  <Tooltip direction="top" offset={[0, -14]}>{p.name}</Tooltip>
                </Marker>
              ))}
            </>
          )}
          {trip?.route && <Polyline positions={trip.route.line} pathOptions={{ color: '#1E2A4A', weight: 5, opacity: 0.85, lineCap: 'round' }} />}
          <Fit zone={zone} />
          <ZoomWatch onZoom={setZoom} />
        </MapContainer>

        {/* Selector de zonas (también accesible por teclado) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
          <div className="pointer-events-auto rounded-[20px] bg-white/90 p-3 shadow-soft backdrop-blur-md lg:max-w-md">
            <h1 className="text-lg font-extrabold leading-tight">Explora Madrid por zonas</h1>
            <p className="text-sm text-noche-600">{zone ? 'Toca un sitio para ver cómo llegar a pie.' : 'Toca una zona del mapa para ver dónde comer, qué hacer y cómo moverte.'}</p>
            <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => selectZone(zone?.id === z.id ? null : z)}
                  aria-pressed={zone?.id === z.id}
                  className={cn('shrink-0 rounded-full border-2 px-3 py-1.5 text-[13px] font-semibold transition', zone?.id === z.id ? 'border-noche bg-noche text-white' : 'border-noche/15 bg-white text-noche hover:border-noche/40')}
                >
                  {z.name.split(/ y |,/)[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PANEL: bottom sheet en móvil, lateral en escritorio */}
      <AnimatePresence>
        {zone && (
          <motion.aside
            key={zone.id}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25 }}
            className="absolute inset-x-0 bottom-0 z-[600] flex max-h-[58%] flex-col rounded-t-[24px] bg-crema shadow-[0_-10px_30px_rgba(30,42,74,.18)] lg:static lg:max-h-none lg:rounded-none lg:shadow-[-8px_0_24px_rgba(30,42,74,.06)]"
            aria-label={`Zona ${zone.name}`}
          >
            <ZoneHeader zone={zone} onClose={() => selectZone(null)} />
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-noche/10 px-4 [scrollbar-width:none]" role="tablist">
              {([['comer', `Comer y beber · ${food.length}`, UtensilsCrossed], ['ocio', `Ocio · ${fun.length}`, Ticket], ['trayectos', 'Trayectos', RouteIcon]] as const).map(([k, label, I]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-[3px] px-2 py-2.5 text-sm font-bold', tab === k ? 'border-coral text-noche' : 'border-transparent text-noche-600 hover:text-noche')}>
                  <I className="h-4 w-4" aria-hidden />{label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
              {tab !== 'trayectos' && (
                <ul className="space-y-2.5">
                  {(tab === 'comer' ? food : fun).length === 0 && <li className="rounded-card bg-white p-4 text-sm text-noche-600 shadow-soft">En esta zona aún no tenemos sitios de este tipo. Prueba la otra pestaña o una zona vecina.</li>}
                  {(tab === 'comer' ? food : fun).map((p) => (
                    <li key={p.id}><PlaceRow p={p} zone={zone} active={place?.id === p.id} onClick={() => openPlace(p)} trip={trip?.id === 'hub-' + p.id ? trip : null} loading={loading && trip?.id === 'hub-' + p.id} /></li>
                  ))}
                </ul>
              )}
              {tab === 'trayectos' && (
                <div className="space-y-2.5">
                  <p className="text-sm text-noche-600">Rutas a pie calculadas sobre calles reales desde <strong className="text-noche">{zone.hub.label}</strong>.</p>
                  {loop && (
                    <TripCard title={loop.label} subtitle={`${loop.points.length - 1} paradas en orden de cercanía`} active={trip?.id === 'loop'} trip={trip?.id === 'loop' ? trip : null} loading={loading && trip?.id === 'loop'} onClick={() => showTrip(loop)} />
                  )}
                  {zone.places.map((p) => (
                    <TripCard key={p.id} title={`${zone.hub.label} → ${p.name}`} subtitle={`${p.category} · ${euros(p.avg_cost_eur)}`} active={trip?.id === 'hub-' + p.id} trip={trip?.id === 'hub-' + p.id ? trip : null} loading={loading && trip?.id === 'hub-' + p.id} onClick={() => { setPlace(p); tripFromHub(p) }} />
                  ))}
                </div>
              )}
              <Button className="mt-5 w-full" size="lg" onClick={() => navigate('/plan/nuevo', { state: { origin: { label: zone.hub.label, lat: zone.hub.lat, lng: zone.hub.lng } } })}>
                <Sparkles className="h-5 w-5" aria-hidden /> Crear un plan desde aquí
              </Button>
              <p className="mt-3 text-center text-xs text-noche-600">Horarios y precios son estimaciones: confírmalos antes de ir.</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  )
}

function ZoneHeader({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const photo = zone.places.map((p) => placePhoto(p.name)).find(Boolean)
  return (
    <div className="relative shrink-0 overflow-hidden rounded-t-[24px] lg:rounded-none">
      {photo && <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className={cn('absolute inset-0', photo ? 'bg-[linear-gradient(180deg,rgba(14,20,38,.25),rgba(14,20,38,.85))]' : 'bg-noche')} />
      <div className="relative px-4 pb-3 pt-4 text-white lg:pb-4 lg:pt-24">
        <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/30 backdrop-blur hover:bg-black/50" aria-label="Cerrar zona"><X className="h-4 w-4" /></button>
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/75">{zone.places.length} {zone.places.length === 1 ? 'sitio' : 'sitios'} · {zone.neighborhoods.join(', ')}</p>
        <h2 className="mt-0.5 pr-10 text-xl font-extrabold leading-tight lg:text-2xl">{zone.name}</h2>
        <p className="mt-1 hidden text-sm text-white/85 sm:block">{zone.blurb}</p>
      </div>
    </div>
  )
}

function PlaceRow({ p, zone, active, onClick, trip, loading }: { p: Place; zone: Zone; active: boolean; onClick: () => void; trip: Trip | null; loading: boolean }) {
  const ph = placePhoto(p.name)
  const est = Math.round(distanceKm(zone.hub, p) * 1.3 / 4.8 * 60)
  return (
    <button onClick={onClick} className={cn('flex w-full gap-3 rounded-card bg-white p-2.5 text-left shadow-soft transition', active && 'ring-2 ring-noche')}>
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-noche/10">
        {ph ? <img src={ph.src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-noche/30">{isFood(p) ? <UtensilsCrossed className="h-7 w-7" aria-hidden /> : <Ticket className="h-7 w-7" aria-hidden />}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{p.name}</p>
        <p className="truncate text-xs font-semibold text-noche-600">{p.category.charAt(0).toUpperCase() + p.category.slice(1)} · {euros(p.avg_cost_eur)}{p.avg_cost_eur > 0 && ' aprox.'} · {durationLabel(p.avg_duration_min)}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-noche-600">{p.description}</p>
        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-noche">
          <Footprints className="h-3.5 w-3.5" aria-hidden />
          {loading ? 'Calculando ruta…' : trip?.route ? `${trip.route.legMinutes[0]} min · ${trip.route.legKm[0]} km desde ${zone.hub.label}` : `~${Math.max(2, est)} min a pie desde ${zone.hub.label}`}
        </p>
      </div>
    </button>
  )
}

function TripCard({ title, subtitle, active, trip, loading, onClick }: { title: string; subtitle: string; active: boolean; trip: Trip | null; loading: boolean; onClick: () => void }) {
  const mins = trip?.route?.legMinutes.reduce((a, b) => a + b, 0)
  const km = trip?.route?.legKm.reduce((a, b) => a + b, 0)
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-card bg-white p-3 text-left shadow-soft', active && 'ring-2 ring-noche')}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral-50 text-coral-700">{title.startsWith('Paseo') ? <MapPin className="h-5 w-5" aria-hidden /> : <TrainFront className="h-5 w-5" aria-hidden />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{title}</span>
        <span className="block truncate text-xs text-noche-600">{subtitle.charAt(0).toUpperCase() + subtitle.slice(1)}</span>
      </span>
      <span className="shrink-0 text-right text-sm font-extrabold">
        {loading ? <span className="text-xs font-semibold text-noche-600">Calculando…</span> : mins != null ? <><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{mins} min</span><span className="block text-xs font-semibold text-noche-600">{km?.toFixed(1)} km{trip?.route && !trip.route.exact ? ' (aprox.)' : ''}</span></> : <span className="text-xs font-semibold text-noche-600">Ver ruta</span>}
      </span>
    </button>
  )
}
