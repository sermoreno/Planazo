export type Day = 'sat' | 'sun'
export type DayChoice = Day | 'both'
export type Companions = 'solo' | 'pareja' | 'amigos' | 'familia'
export type Pace = 'tranquilo' | 'equilibrado' | 'intenso'
export type Interest = 'cultura' | 'naturaleza' | 'gastronomia' | 'nocturno' | 'deporte' | 'mercadillos'

export interface Place {
  id: string
  name: string
  category: string
  description: string
  address: string
  lat: number
  lng: number
  neighborhood: string
  price_level: number
  avg_cost_eur: number
  avg_duration_min: number
  opening_hours: Partial<Record<Day, [string, string]>>
  indoor: boolean
  tags: string[]
  external_url: string
  is_verified: boolean
}

export interface Constraints {
  cheaper?: boolean
  calmer?: boolean
  rain?: boolean
  avoidNeighborhoods?: string[]
  startTime?: string
  endTime?: string
  origin?: { label: string; lat: number; lng: number }
}

export interface Preferences {
  day: DayChoice
  companions: Companions | null
  budget: number
  pace: Pace | null
  interests: Interest[]
  mood: string
  constraints: Constraints
}

export interface Slot {
  id: string
  day: Day
  place_id: string
  start_time: string
  end_time: string
  title: string
  reason: string
  est_cost: number
  duration_min: number
  verify_note: string
  travel_min_from_prev: number | null
}

export interface Itinerary {
  id: string
  title: string
  prefs: Preferences
  slots: Slot[]
  created_at: string
  status: 'draft' | 'saved'
  share_slug: string | null
  is_public: boolean
  source: 'ia' | 'local' | 'mock'
  agent_message?: string
}
