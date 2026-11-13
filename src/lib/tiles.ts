/**
 * Fondo de mapa gratuito y sin clave: teselas estándar de OpenStreetMap.
 * Para usar otro proveedor (por ejemplo CARTO con tu propia clave), define VITE_TILES_URL
 * y, si hace falta, VITE_TILES_ATTR al compilar.
 */
export const TILES = import.meta.env.VITE_TILES_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILES_SUBDOMAINS = 'abc'
export const TILES_MAX_ZOOM = 19
export const TILES_ATTR =
  import.meta.env.VITE_TILES_ATTR ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
