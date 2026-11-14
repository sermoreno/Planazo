/**
 * Escapadas de un día por la Comunidad de Madrid. Sin dependencias de mapas para poder usarlo en cualquier página.
 * "Cómo llegar" son estimaciones de líneas y tiempos: hay que confirmarlas en crtm.es o renfe.com.
 * El `neighborhood` de cada lugar del seed (scripts/places.escapadas.mjs) debe coincidir con uno de `neighborhoods`.
 */
export interface Escapada {
  id: string
  name: string
  blurb: string
  access: string
  hub: { label: string; lat: number; lng: number }
  neighborhoods: string[]
  /** Nombre corto y lado de la etiqueta en el mapa de escapadas (para que no se pisen). */
  short: string
  side: 'left' | 'right' | 'top' | 'bottom'
}

export const ESCAPADAS: Escapada[] = [
  {
    id: 'escorial', short: 'El Escorial', side: 'left', name: 'San Lorenzo de El Escorial', blurb: 'El monasterio de Felipe II y la Silla del rey entre robles y castaños.',
    access: 'Autobuses 661 y 664 desde Moncloa (~1 h) o Cercanías C-3 hasta El Escorial.',
    hub: { label: 'Centro de San Lorenzo', lat: 40.5936, lng: -4.1428 }, neighborhoods: ['San Lorenzo de El Escorial', 'El Escorial'],
  },
  {
    id: 'aranjuez', short: 'Aranjuez', side: 'right', name: 'Aranjuez', blurb: 'Palacio real, jardines junto al Tajo y fresones en temporada.',
    access: 'Cercanías C-3 desde Atocha o Sol (~45 min).',
    hub: { label: 'Estación de Aranjuez', lat: 40.035, lng: -3.6191 }, neighborhoods: ['Aranjuez'],
  },
  {
    id: 'alcala', short: 'Alcalá', side: 'right', name: 'Alcalá de Henares', blurb: 'Universidad renacentista, la casa de Cervantes y tapa con cada caña.',
    access: 'Cercanías C-2 y C-7 desde Atocha (~35 min).',
    hub: { label: 'Estación de Alcalá de Henares', lat: 40.4889, lng: -3.3663 }, neighborhoods: ['Alcalá de Henares'],
  },
  {
    id: 'chinchon', short: 'Chinchón', side: 'right', name: 'Chinchón', blurb: 'Una plaza mayor de balcones de madera, mesones y anís.',
    access: 'Autobús 337 desde Conde de Casal (~50 min).',
    hub: { label: 'Plaza Mayor de Chinchón', lat: 40.1401, lng: -3.4225 }, neighborhoods: ['Chinchón'],
  },
  {
    id: 'manzanares', short: 'Manzanares', side: 'right', name: 'Manzanares el Real y La Pedriza', blurb: 'Un castillo de cuento a los pies de La Pedriza y el embalse de Santillana.',
    access: 'Autobús 724 desde Plaza de Castilla (~50 min).',
    hub: { label: 'Centro de Manzanares el Real', lat: 40.7266, lng: -3.8616 }, neighborhoods: ['Manzanares el Real'],
  },
  {
    id: 'cercedilla', short: 'Cercedilla', side: 'left', name: 'Cercedilla y la Fuenfría', blurb: 'Pinares de la sierra, merenderos y una calzada romana.',
    access: 'Cercanías C-8 hasta Cercedilla (~1 h desde Chamartín).',
    hub: { label: 'Centro de Cercedilla', lat: 40.7375, lng: -4.0631 }, neighborhoods: ['Cercedilla'],
  },
  {
    id: 'paular', short: 'Rascafría', side: 'left', name: 'Rascafría y El Paular', blurb: 'El valle del Lozoya: monasterio, arboreto y río.',
    access: 'Mejor en coche (~1 h 15). En autobús, línea 194 desde Plaza de Castilla, con pocos servicios.',
    hub: { label: 'Centro de Rascafría', lat: 40.9047, lng: -3.8794 }, neighborhoods: ['Rascafría'],
  },
  {
    id: 'buitrago', short: 'Buitrago', side: 'right', name: 'Buitrago del Lozoya', blurb: 'Villa amurallada en un meandro del río y un museo con obra de Picasso.',
    access: 'Autobús 191 desde Plaza de Castilla (~1 h 15).',
    hub: { label: 'Centro de Buitrago', lat: 40.9925, lng: -3.6375 }, neighborhoods: ['Buitrago del Lozoya'],
  },
  {
    id: 'patones', short: 'Patones', side: 'right', name: 'Patones de Arriba', blurb: 'Arquitectura negra de pizarra y restaurantes en casas de piedra.',
    access: 'Mejor en coche (~1 h por la A-1); el coche se deja a la entrada del pueblo.',
    hub: { label: 'Entrada de Patones de Arriba', lat: 40.865, lng: -3.4915 }, neighborhoods: ['Patones'],
  },
]

export const ACCESS_NOTE = 'Confirma horarios en crtm.es o renfe.com.'

/** Escapada a la que pertenece un lugar (por su `neighborhood`), o undefined si está en Madrid ciudad. */
export const escapadaOf = (neighborhood: string | undefined) => (neighborhood ? ESCAPADAS.find((e) => e.neighborhoods.includes(neighborhood)) : undefined)
