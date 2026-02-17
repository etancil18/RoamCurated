// lib/getCityNow.ts

import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'

/**
 * Returns a Luxon DateTime representing "now"
 * in the selected city's local timezone.
 *
 * This is the canonical way to derive city-relative time.
 * All marker, open/closed, and event logic should flow from here.
 */
export function getCityNow(city: string | null | undefined): DateTime {
  if (!city) {
    // Fallback to system/local time if no city selected
    return DateTime.local()
  }

  const timezone = CITY_CONFIGS[city]?.timezone

  if (!timezone) {
    // Defensive fallback — prevents runtime crashes
    console.warn(`Unknown city slug passed to getCityNow(): ${city}`)
    return DateTime.utc()
  }

  return DateTime.now().setZone(timezone)
}