// types/venue-profile.ts

/**
 * ============================
 * Venue Profile — UI Layer Types
 * ============================
 * Used by components like HeroBanner, VenueHours, EventCarousel, etc.
 * Do NOT include backend-only logic like crawl sorting, scores, etc.
 */

// ========== HOURS ==========

export type VenueHours = Record<
  string,
  | {
      open: string
      close: string
    }
  | null
>

// ========== VENUE PROFILE (NORMALIZED FROM SUPABASE) ==========

export type VenueProfileData = {
  id: string
  name: string
  description?: string | null
  city?: string | null
  cover?: string | null
  contact?: string[] | null
  tags?: string[] // ✅ must be normalized before passing
  hours?: VenueHours
}

// ========== LIVE STATUS ==========

export type VenueLiveStatus = {
  is_open_for_dropins: boolean
  status_tags?: string[]
}

// ========== EVENTS (ONE-TIME + RECURRING MERGED) ==========

export type VenueEvent = {
  id: string
  title: string

  // One-time events
  starts_at?: string
  ends_at?: string

  // Recurring
  start_time?: string
  end_time?: string
  recurrence_rule?: string
  starts_on?: string
  ends_on?: string

  // UI helper
  isRecurring?: boolean

  // Metadata
  tags?: string[]
}
