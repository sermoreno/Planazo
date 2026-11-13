import data from '@/data/photos.json'

export interface Photo { src: string; w: number; h: number; title: string; artist: string; license: string; page: string }
const D = data as unknown as { hero?: Record<string, Photo>; places?: Record<string, Photo> }

const base = import.meta.env.BASE_URL
const withBase = (p: Photo): Photo => ({ ...p, src: base + p.src })

export const slugify = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Fotos de portada (orden de la secuencia animada) con el lugar que muestran. */
export const HERO_SET: { key: string; label: string }[] = [
  { key: 'debod', label: 'Templo de Debod al atardecer' },
  { key: 'retiro', label: 'Estanque del Retiro' },
  { key: 'granvia', label: 'Gran Vía de noche' },
  { key: 'cristal', label: 'Palacio de Cristal' },
  { key: 'plazamayor', label: 'Plaza Mayor' },
]
export const heroPhotos = () => HERO_SET.filter((h) => D.hero?.[h.key]).map((h) => ({ ...h, photo: withBase(D.hero![h.key]) }))
export const heroPhoto = (key: string) => (D.hero?.[key] ? withBase(D.hero[key]) : null)
const ALIAS: Record<string, string> = { 'templo-de-debod': 'debod', 'barcas-del-estanque-del-retiro': 'retiro', 'palacio-de-cristal': 'cristal', 'plaza-mayor': 'plazamayor' }
export const placePhoto = (name: string) => {
  const k = slugify(name)
  const p = D.places?.[k] ?? (ALIAS[k] ? D.hero?.[ALIAS[k]] : undefined)
  return p ? withBase(p) : null
}

export const credit = (p: Photo) => `${p.artist || 'Autor desconocido'} · ${p.license} · Wikimedia Commons`
export const allCredits = () => [
  ...Object.entries(D.hero ?? {}).map(([k, p]) => ({ k: 'hero-' + k, ...withBase(p) })),
  ...Object.entries(D.places ?? {}).map(([k, p]) => ({ k: 'place-' + k, ...withBase(p) })),
]
