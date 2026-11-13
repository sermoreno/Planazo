import { PLACES } from './places'
import type { Itinerary, Slot } from './types'
import { distanceKm, toMin, toTime, walkMinutes } from './utils'

/** Itinerario de ejemplo (formato del brief): sábado, dos personas, 60 €. */
const plan: [string, string, string][] = [
  ['Parque del Retiro', '10:30', 'Encaja porque querías empezar sin prisas: paseo verde y gratis para arrancar el día.'],
  ['Mercado de Antón Martín', '13:00', 'Encaja porque te pilla a la hora de comer y tiene barras para todos los gustos.'],
  ['CaixaForum Madrid', '16:00', 'Encaja porque suma cultura a cubierto en las horas de más calor y cuida tu presupuesto.'],
  ['Templo de Debod', '19:30', 'Encaja porque es el atardecer más bonito de Madrid, gratis y perfecto en pareja.'],
]

export function mockItinerary(): Itinerary {
  let prev: (typeof PLACES)[number] | null = null
  const slots: Slot[] = plan.map(([name, start, reason], i) => {
    const p = PLACES.find((x) => x.name === name)!
    const s: Slot = {
      id: `mock-${i}`, day: 'sat', place_id: p.id, start_time: start, end_time: toTime(toMin(start) + p.avg_duration_min), title: p.name, reason,
      est_cost: p.avg_cost_eur, duration_min: p.avg_duration_min, verify_note: 'Estimación: confirma horario y precio antes de ir.',
      travel_min_from_prev: prev ? walkMinutes(distanceKm(prev, p)) : null,
    }
    prev = p
    return s
  })
  return {
    id: 'demo', title: 'Sábado tranquilo en pareja', created_at: new Date().toISOString(), status: 'draft', share_slug: null, is_public: false, source: 'mock', slots,
    prefs: { day: 'sat', companions: 'pareja', budget: 60, pace: 'tranquilo', interests: ['cultura', 'naturaleza'], mood: 'Quiero desconectar y acabar viendo el atardecer', constraints: {} },
  }
}
