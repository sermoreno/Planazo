/** Rutas a pie con OSRM (gratuito). Si falla, se dibuja una línea recta y se estiman minutos. */
import { distanceKm, walkMinutes } from './utils'

const OSRM = import.meta.env.VITE_OSRM_URL ?? 'https://router.project-osrm.org/route/v1/foot'
type LatLng = { lat: number; lng: number }
export interface Route { line: [number, number][]; legMinutes: number[]; legKm: number[]; exact: boolean }

const cache = new Map<string, Route>()

export async function walkingRoute(points: LatLng[], signal?: AbortSignal): Promise<Route> {
  const fallback: Route = {
    line: points.map((p) => [p.lat, p.lng]),
    legMinutes: points.slice(1).map((p, i) => walkMinutes(distanceKm(points[i], p))),
    legKm: points.slice(1).map((p, i) => Math.round(distanceKm(points[i], p) * 1.3 * 10) / 10),
    exact: false,
  }
  if (points.length < 2) return fallback
  const coords = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';')
  if (cache.has(coords)) return cache.get(coords)!
  try {
    const r = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`, { signal })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json()
    const route = j.routes?.[0]
    if (!route) throw new Error('sin ruta')
    // Minutos a partir de la distancia a pie (~75 m/min): el servidor demo puede devolver duraciones de coche.
    const res: Route = {
      line: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
      legMinutes: route.legs.map((l: { distance: number }) => Math.max(3, Math.round(l.distance / 75))),
      legKm: route.legs.map((l: { distance: number }) => Math.round(l.distance / 100) / 10),
      exact: true,
    }
    cache.set(coords, res)
    return res
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    return fallback
  }
}
