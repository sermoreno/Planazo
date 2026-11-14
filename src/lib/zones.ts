/**
 * Zonas para el explorador. En la ciudad se agrupan los barrios del seed y se teselan con Voronoi;
 * las escapadas por la Comunidad de Madrid son pueblos sueltos, con un círculo alrededor de sus sitios.
 */
import { Delaunay } from 'd3-delaunay'
import { ESCAPADAS } from './escapadas'
import { PLACES } from './places'
import type { Place } from './types'
import { distanceKm } from './utils'

export type Region = 'ciudad' | 'escapada'
export interface Zone {
  id: string
  name: string
  blurb: string
  region: Region
  /** Cómo llegar desde Madrid (solo escapadas). Estimación: confirmar en crtm.es o renfe.com. */
  access?: string
  /** Kilómetros en línea recta desde la Puerta del Sol (solo escapadas). */
  km?: number
  /** Etiqueta corta en el mapa de escapadas. */
  short?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
  hub: { label: string; lat: number; lng: number }
  neighborhoods: string[]
  places: Place[]
  center: { lat: number; lng: number }
  polygon: [number, number][]
}

const CITY: Omit<Zone, 'places' | 'center' | 'polygon' | 'region'>[] = [
  { id: 'sol', name: 'Sol y Madrid de los Austrias', blurb: 'El Madrid de postal: plazas, palacio y tabernas centenarias.', hub: { label: 'Metro Sol', lat: 40.4169, lng: -3.7035 }, neighborhoods: ['Sol', 'Palacio', 'Centro'] },
  { id: 'latina', name: 'La Latina', blurb: 'Cañas en la Cava Baja, el Rastro del domingo y flamenco.', hub: { label: 'Metro La Latina', lat: 40.4113, lng: -3.7083 }, neighborhoods: ['La Latina'] },
  { id: 'lavapies', name: 'Lavapiés y Embajadores', blurb: 'Multicultural y alternativo, con mercados de barrio y el Reina Sofía.', hub: { label: 'Metro Lavapiés', lat: 40.4089, lng: -3.7009 }, neighborhoods: ['Lavapiés', 'Embajadores'] },
  { id: 'letras', name: 'Barrio de las Letras', blurb: 'Calles literarias, bares con historia y jazz en directo.', hub: { label: 'Plaza de Santa Ana', lat: 40.4148, lng: -3.7012 }, neighborhoods: ['Huertas'] },
  { id: 'prado', name: 'Paseo del Prado', blurb: 'El triángulo del arte: Prado, Thyssen, CaixaForum y el Botánico.', hub: { label: 'Metro Estación del Arte', lat: 40.4089, lng: -3.6939 }, neighborhoods: ['Cortes'] },
  { id: 'retiro', name: 'El Retiro', blurb: 'El gran parque de Madrid: barcas, palacios de cristal y paseos.', hub: { label: 'Metro Retiro', lat: 40.4206, lng: -3.6866 }, neighborhoods: ['Retiro'] },
  { id: 'malasana', name: 'Malasaña y Chueca', blurb: 'Ambiente joven, vermú, tiendas vintage y vida nocturna.', hub: { label: 'Metro Tribunal', lat: 40.4262, lng: -3.7012 }, neighborhoods: ['Malasaña', 'Chueca'] },
  { id: 'moncloa', name: 'Moncloa y Templo de Debod', blurb: 'Atardeceres, rosaleda y las mejores vistas del oeste.', hub: { label: 'Metro Plaza de España', lat: 40.4233, lng: -3.7122 }, neighborhoods: ['Argüelles', 'Moncloa'] },
  { id: 'salamanca', name: 'Salamanca, Recoletos y Chamberí', blurb: 'Museos tranquilos, cafés literarios y bulevares elegantes.', hub: { label: 'Metro Colón', lat: 40.4251, lng: -3.6904 }, neighborhoods: ['Salamanca', 'Recoletos', 'Chamberí'] },
  { id: 'rio', name: 'Madrid Río y Matadero', blurb: 'Paseos junto al Manzanares, Planetario, trenes históricos y cultura contemporánea.', hub: { label: 'Metro Legazpi', lat: 40.3913, lng: -3.695 }, neighborhoods: ['Arganzuela', 'Delicias'] },
  { id: 'casadecampo', name: 'Casa de Campo', blurb: 'El bosque de la ciudad: lago, zoo, parque de atracciones y teleférico.', hub: { label: 'Metro Lago', lat: 40.4176, lng: -3.736 }, neighborhoods: ['Casa de Campo'] },
  { id: 'chamartin', name: 'Chamartín', blurb: 'Dinosaurios en Ciencias Naturales, el Bernabéu y parques de barrio.', hub: { label: 'Metro Santiago Bernabéu', lat: 40.4504, lng: -3.6922 }, neighborhoods: ['Chamartín'] },
  { id: 'vallecas', name: 'Vallecas', blurb: 'Barrio auténtico con uno de los miradores más queridos.', hub: { label: 'Metro Buenos Aires', lat: 40.3943, lng: -3.6545 }, neighborhoods: ['Vallecas'] },
  { id: 'este', name: 'Hortaleza, Barajas y El Capricho', blurb: 'Grandes parques para un día de naturaleza, bici y patinaje sobre hielo.', hub: { label: 'Metro El Capricho', lat: 40.4466, lng: -3.6008 }, neighborhoods: ['Alameda de Osuna', 'Barajas', 'Hortaleza'] },
  { id: 'norte', name: 'Tetuán y Dehesa de la Villa', blurb: 'Pinares con merenderos y un mercado enorme con sabor latino.', hub: { label: 'Metro Francos Rodríguez', lat: 40.4572, lng: -3.7119 }, neighborhoods: ['Tetuán', 'Dehesa de la Villa'] },
  { id: 'sanblas', name: 'San Blas y el Metropolitano', blurb: 'Almendros en flor y el estadio del Atlético.', hub: { label: 'Metro Estadio Metropolitano', lat: 40.4334, lng: -3.6002 }, neighborhoods: ['San Blas'] },
  { id: 'faunia', name: 'Faunia y Valdebernardo', blurb: 'Pingüinos, selva tropical y granja para un día entero en familia.', hub: { label: 'Metro Valdebernardo', lat: 40.3991, lng: -3.6219 }, neighborhoods: ['Valdebernardo'] },
  { id: 'sur', name: 'Usera y Parque Lineal', blurb: 'Los grandes parques del sur, con lagos y carril bici junto al río.', hub: { label: 'Metro Almendrales', lat: 40.3833, lng: -3.6982 }, neighborhoods: ['Usera', 'Villaverde'] },
  { id: 'cuatrovientos', name: 'Cuatro Vientos', blurb: 'Más de 150 aviones en el Museo del Aire.', hub: { label: 'Estación de Cuatro Vientos', lat: 40.3776, lng: -3.7916 }, neighborhoods: ['Cuatro Vientos'] },
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

const withPlaces = (d: Omit<Zone, 'places' | 'center' | 'polygon'>): Zone => {
  const places = PLACES.filter((p) => d.neighborhoods.includes(p.neighborhood))
  const center = { lat: places.reduce((a, p) => a + p.lat, 0) / places.length, lng: places.reduce((a, p) => a + p.lng, 0) / places.length }
  return { ...d, places, center, polygon: [] }
}
const circleAround = (z: Zone, minKm: number): [number, number][] => {
  const km = Math.max(minKm, ...z.places.map((p) => distanceKm(z.center, p) + 0.5), distanceKm(z.center, z.hub) + 0.3)
  return Array.from({ length: 48 }, (_, k) => {
    const t = (k / 48) * 2 * Math.PI
    return toLatLng([z.center.lng * K + (km / 111) * Math.cos(t), z.center.lat + (km / 111) * Math.sin(t)])
  })
}

function build(): Zone[] {
  const zones = CITY.map((d) => withPlaces({ ...d, region: 'ciudad' }))
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
  const trips = ESCAPADAS.map((d) => withPlaces({ ...d, region: 'escapada' })).filter((z) => z.places.length)
  trips.forEach((z) => { z.polygon = circleAround(z, 0.9); z.km = Math.round(distanceKm({ lat: 40.4169, lng: -3.7035 }, z.center) / 5) * 5 })
  return [...zones, ...trips]
}

export const ZONES = build()
export const zoneOf = (p: Place) => ZONES.find((z) => z.neighborhoods.includes(p.neighborhood))
