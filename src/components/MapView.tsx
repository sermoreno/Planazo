import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { getPlace } from '@/lib/places'
import { TILES, TILES_ATTR, TILES_MAX_ZOOM, TILES_SUBDOMAINS } from '@/lib/tiles'
import type { Slot } from '@/lib/types'


const icon = (n: number, active: boolean) =>
  L.divIcon({ className: '', html: `<div class="pz-marker${active ? ' active' : ''}">${n}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] })

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap()
  const key = pts.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

function InvalidateOnResize({ dep }: { dep: unknown }) {
  const map = useMap()
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 250); return () => clearTimeout(t) }, [dep, map])
  return null
}

export function MapView({ slots, lines, activeId, onSelect, resizeKey }: {
  slots: Slot[]; lines: [number, number][][]; activeId: string | null; onSelect: (id: string) => void; resizeKey?: unknown
}) {
  const pts = useMemo(() => slots.map((s) => getPlace(s.place_id)!).map((p) => [p.lat, p.lng] as [number, number]), [slots])
  return (
    <MapContainer center={[40.4168, -3.7038]} zoom={13} scrollWheelZoom className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer url={TILES} attribution={TILES_ATTR} subdomains={TILES_SUBDOMAINS} maxZoom={TILES_MAX_ZOOM} />
      {lines.map((l, i) => (
        <Polyline key={i} positions={l} pathOptions={{ color: '#1E2A4A', weight: 4, opacity: 0.75, dashArray: '2 8', lineCap: 'round' }} />
      ))}
      {slots.map((s, i) => (
        <Marker
          key={s.id}
          position={pts[i]}
          icon={icon(i + 1, s.id === activeId)}
          zIndexOffset={s.id === activeId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(s.id), mouseover: () => onSelect(s.id) }}
          title={s.title}
          alt={`Parada ${i + 1}: ${s.title}`}
        />
      ))}
      <FitBounds pts={pts} />
      <InvalidateOnResize dep={resizeKey} />
    </MapContainer>
  )
}
