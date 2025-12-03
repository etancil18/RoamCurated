export type HoursNumeric = Record<string, { open: number; close: number } | null>

export type DateEvent = {
  date: string
  title: string
  time: string
}

export type Venue = {
  id: string // 🔒 REQUIRED — used in favorites, crawls, and routing
  name: string
  lat: number
  lon: number
  link: string

  // Metadata
  slug?: string
  vibe?: string
  type?: string | string[]
  cover?: string
  instagram_handle?: string
  tags?: string 
  tier?: string
  city?: string
  neighborhood?: string

  // Time logic
  openNow?: boolean | string
  hours?: string[]
  hoursNumeric?: HoursNumeric
  dayParts?: Record<string, string>
  timeCategory?: string
  energyRamp?: number

  // UX filters
  price?: string // e.g., "$", "$$", "$$$"
  duration?: number // in hours

  // Events
  dateEvents?: DateEvent[]
  _has_upcoming_events?: boolean
}

// StaticVenue extends Venue with guaranteed fields from static data
export type StaticVenue = Omit<Venue, 'id'> & {
  slug: string
  name: string
  lat: number
  lon: number
  link: string
}
