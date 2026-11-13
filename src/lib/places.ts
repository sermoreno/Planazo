import raw from '@/data/places.json'
import type { Place } from './types'

export const PLACES = raw as unknown as Place[]
const byId = new Map(PLACES.map((p) => [p.id, p]))
export const getPlace = (id: string) => byId.get(id)
