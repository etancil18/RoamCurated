// lib/getCityNow.ts

import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'

/**
 * Optional alias mapping to normalize
 * long-form city slugs used in URLs.
 */
const CITY_SLUG_ALIASES: Record<string, string> = {
  atlanta: 'atl',
  'new-york': 'nyc',
  newyork: 'nyc',
  'new-york-city': 'nyc',
  losangeles: 'la',
  'los-angeles': 'la',
  miami: 'mia',
}

/**
 * Normalize incoming city slug
 * to the canonical key used in CITY_CONFIGS.
 */
function resolveCitySlug(city: string): string {
  const normalized = city.toLowerCase()

  if (CITY_CONFIGS[normalized]) {
    return normalized
  }

  if (CITY_SLUG_ALIASES[normalized]) {
    return CITY_SLUG_ALIASES[normalized]
  }

  return normalized
}

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

  const resolvedCity = resolveCitySlug(city)

  const timezone = CITY_CONFIGS[resolvedCity]?.timezone

  if (!timezone) {
    // Defensive fallback — prevents runtime crashes
    console.warn(`Unknown city slug passed to getCityNow(): ${city}`)
    return DateTime.utc()
  }

  return DateTime.now().setZone(timezone)
}