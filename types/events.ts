import type { Json, Database } from './supabase'

export type ValidatedEventsInsert = {
  venue_id: string
  title: string | null
  source: string | null
  permalink: string | null
  starts_at: string | null
  ends_at: string | null
  description: string | null
  tags: string[] | null
  price_info: string | null
  source_type: string | null
  raw_payload: Json | null
  timezone: string | null
  is_active: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export type InterestedEventWithVenue = {
  id: string
  title: string
  starts_at: string | null
  ends_at: string | null
  tags: string[] | null
  price_info: string | null
  venue: {
    id: string
    name: string
    slug: string
    lat: number
    lon: number
    city: string
    cover: string | null
  } | null
}
