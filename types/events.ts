// types/events.ts

import type { Json, Database } from "./supabase"

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
  timezone: string
  is_active: boolean
}
