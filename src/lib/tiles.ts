/** Fondo de mapa gratuito: teselas CARTO Voyager sobre datos de OpenStreetMap. */
export const TILES = import.meta.env.VITE_TILES_URL ?? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
export const TILES_SUBDOMAINS = 'abcd'
export const TILES_MAX_ZOOM = 19
export const TILES_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
