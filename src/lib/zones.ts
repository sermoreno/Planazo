/** Zonas de Madrid para el explorador: se agrupan los barrios del seed y se teselan con Voronoi. */
import { Delaunay } from 'd3-delaunay'
import { PLACES } from './places'
import type { Place } from './types'
import { distanceKm } from './utils'

export interface Zone {
  id: string
  name: string
  blurb: string
  hub: { label: string; lat: number; lng: number }
  neighborhoods: string[]
  places: Place[]
  center: { lat: number; lng: number }
  polygon: [number, number][]
}

const DEFS: Omit<Zone, 'places' | 'center' | 'polygon'>[] = [
  { id: 'sol', name: 'Sol y Madrid de los Austrias', blurb: 'El Madrid de postal: plazas, palacio y tabernas centenarias.', hub: { label: 'Metro Sol', lat: 40.4169, lng: -3.7035 }, neighborhoods: ['Sol', 'Palacio', 'Centro'] },
  { id: 'latina', name: 'La Latina', blurb: 'Cañas en la Cava Baja, el Rastro del domingo y flamenco.', hub: { label: 'Metro La Latina', lat: 40.4113, lng: -3.7083 }, neighborhoods: ['La Latina'] },
  { id: 'lavapies', name: 'Lavapiés y Embajadores', blurb: 'Multicultural y alternativo, con mercados de barrio y el Reina Sofía.', hub: { label: 'Metro Lavapiés', lat: 40.4089, lng: -3.7009 }, neighborhoods: ['Lavapiés', 'Embajadores'] },
  { id: 'letras', name: 'Barrio de las Letras', blurb: 'Calles literarias, bares con historia y jazz en directo.', hub: { label: 'Plaza de Santa Ana', lat: 40.4148, lng: -3.7012 }, neighborhoods: ['Huertas'] },
  { id: 'prado', name: 'Paseo del Prado', blurb: 'El triángulo del arte: Prado, Thyssen, CaixaForum y el Botánico.', hub: { label: 'Metro Estación del Arte', lat: 40.4089, lng: -3.6939 }, neighborhoods: ['Cortes'] },
  { id: 'retiro', name: 'El Retiro', blurb: 'El gran parque de Madrid: barcas, palacios de cristal y paseos.', hub: { label: 'Metro Retiro', lat: 40.4206, lng: -3.6866 }, neighborhoods: ['Retiro'] },
  { id: 'malasana', name: 'Malasaña', blurb: 'Ambiente joven, vermú, tiendas vintage y vida nocturna.', hub: { label: 'Metro Tribunal', lat: 40.4262, lng: -3.7012 }, neighborhoods: ['Malasaña'] },
  { id: 'moncloa', name: 'Moncloa y Templo de Debod', blurb: 'Atardeceres, rosaleda y las mejores vistas del oeste.', hub: { label: 'Metro Plaza de España', lat: 40.4233, lng: -3.7122 }, neighborhoods: ['Argüelles', 'Moncloa'] },
  { id: 'salamanca', name: 'Salamanca, Recoletos y Chamberí', blurb: 'Museos tranquilos, cafés literarios y bulevares elegantes.', hub: { label: 'Metro Colón', lat: 40.4251, lng: -3.6904 }, neighborhoods: ['Salamanca', 'Recoletos', 'Chamberí'] },
  { id: 'rio', name: 'Madrid Río y Matadero', blurb: 'Paseos junto al Manzanares, cultura contemporánea y mercadillos.', hub: { label: 'Metro Legazpi', lat: 40.3913, lng: -3.695 }, neighborhoods: ['Arganzuela', 'Delicias'] },
  { id: 'casadecampo', name: 'Casa de Campo', blurb: 'El bosque de la ciudad, con lago y vistas al skyline.', hub: { label: 'Metro Lago', lat: 40.4176, lng: -3.736 }, neighborhoods: ['Casa de Campo'] },
  { id: 'chamartin', name: 'Chamartín', blurb: 'El templo del fútbol y la Castellana.', hub: { label: 'Metro Santiago Bernabéu', lat: 40.4504, lng: -3.6922 }, neighborhoods: ['Chamartín'] },
  { id: 'vallecas', name: 'Vallecas', blurb: 'Barrio auténtico con uno de los miradores más queridos.', hub: { label: 'Metro Buenos Aires', lat: 40.3943, lng: -3.6545 }, neighborhoods: ['Vallecas'] },
  { id: 'este', name: 'Barajas y El Capricho', blurb: 'Grandes parques para un día de naturaleza y bici.', hub: { label: 'Metro El Capricho', lat: 40.4466, lng: -3.6008 }, neighborhoods: ['Alameda de Osuna', 'Barajas'] },
]

const K = Math.cos((40.42 * Math.PI) / 180) // proyección local: x = lng·cos(lat)
const toXY = (lat: number, lng: number): [number, number] => [lng * K, lat]
const toLatLng = ([x, y]: [number, number]): [number, number] => [y, x / K]

/** Recorte Sutherland–Hodgman de un polígono convexo contra otro convexo (sentido antihorario). */
function clip(subject: [number, number][], clipper: [number, number][]) {
  let out = subject
  for (let i = 0; i < clipper.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length]
    const inside = (p: [number, number]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0
    const inter = (p: [number, number], q: [number, number]): [number, number] => {
      const a1 = b[1] - a[1], b1 = a[0] - b[0], c1 = a1 * a[0] + b1 * a[1]
      const a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1]
      const d = a1 * b2 - a2 * b1
      return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d]
    }
    const input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length]
      if (inside(q)) { if (!inside(p)) out.push(inter(p, q)); out.push(q) } else if (inside(p)) out.push(inter(p, q))
    }
    if (!out.length) break
  }
  return out
}

function build(): Zone[] {
  const zones = DEFS.map((d) => {
    const places = PLACES.filter((p) => d.neighborhoods.includes(p.neighborhood))
    const center = { lat: places.reduce((a, p) => a + p.lat, 0) / places.length, lng: places.reduce((a, p) => a + p.lng, 0) / places.length }
    return { ...d, places, center, polygon: [] as [number, number][] }
  })
  const seeds = zones.map((z) => toXY(z.center.lat, z.center.lng))
  const v = Delaunay.from(seeds).voronoi([-3.85 * K, 40.33, -3.5 * K, 40.52])
  zones.forEach((z, i) => {
    const cell = (v.cellPolygon(i) ?? []).slice(0, -1) as [number, number][]
    const km = Math.max(0.55, ...z.places.map((p) => distanceKm(z.center, p) + 0.35), distanceKm(z.center, z.hub) + 0.2)
    const r = km / 111 // grados aprox.
    const circle: [number, number][] = Array.from({ length: 48 }, (_, k) => {
      const t = (k / 48) * 2 * Math.PI
      return [seeds[i][0] + r * Math.cos(t), seeds[i][1] + r * Math.sin(t)]
    })
    // d3 devuelve celdas en sentido horario en coordenadas y-arriba → invertimos para el recorte
    z.polygon = clip(cell.slice().reverse(), circle).map(toLatLng)
  })
  return zones
}

export const ZONES = build()
export const zoneOf = (p: Place) => ZONES.find((z) => z.neighborhoods.includes(p.neighborhood))
