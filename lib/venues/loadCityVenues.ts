import type { Venue } from '@/types/venue'

import { mergeStaticWithDb } from '@/lib/venues/mergeStaticWithDb'

/* ------------------------------------------------ */
/* Lightweight venue normalization (SSR safe)       */
/* ------------------------------------------------ */

function normalizeVenue(v: any): Venue {

  const lat =
    typeof v.lat === 'string'
      ? parseFloat(v.lat)
      : v.lat ?? 0

  const lon =
    typeof v.lon === 'string'
      ? parseFloat(v.lon)
      : v.lon ?? 0

  const types =
    Array.isArray(v.type)
      ? v.type
      : typeof v.type === 'string'
        ? v.type.split(',').map((t: string) => t.trim())
        : []

  return {
    ...v,
    lat,
    lon,
    type: types
  }
}

/* ------------------------------------------------ */
/* Static city datasets                             */
/* ------------------------------------------------ */

import ATLANTA_VENUES from '@/data/atlanta'
import NYC_VENUES from '@/data/nyc'
import LISBON_VENUES from '@/data/lisbon'
import PORTO_VENUES from '@/data/porto'

/* ------------------------------------------------ */
/* Dataset registry                                 */
/* ------------------------------------------------ */

const STATIC_CITY_DATASETS: Record<string, any[]> = {

  atlanta: ATLANTA_VENUES,
  atl: ATLANTA_VENUES,

  nyc: NYC_VENUES,
  'new-york': NYC_VENUES,
  'new-york-city': NYC_VENUES,

  lisbon: LISBON_VENUES,
  lisboa: LISBON_VENUES,

  porto: PORTO_VENUES,
}

/* ------------------------------------------------ */
/* Normalize city slug                              */
/* ------------------------------------------------ */

function normalizeCitySlug(city?: string): string {

  if (!city) return ''

  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
}

/* ------------------------------------------------ */
/* Main loader (SSR safe)                           */
/* ------------------------------------------------ */

export function loadCityVenues(
  city: string | undefined,
  dbVenues: any[]
): Venue[] {

  const normalizedCity =
    normalizeCitySlug(city)

  const staticVenues =
    STATIC_CITY_DATASETS[normalizedCity]

  /* ----------------------------------------------- */
  /* Static + DB merge                               */
  /* ----------------------------------------------- */

  if (staticVenues && staticVenues.length > 0) {

    const merged = mergeStaticWithDb(
      staticVenues,
      dbVenues ?? []
    )

    return merged.map(normalizeVenue)
  }

  /* ----------------------------------------------- */
  /* DB fallback                                     */
  /* ----------------------------------------------- */

  if (dbVenues && dbVenues.length > 0) {

    return dbVenues.map(normalizeVenue)
  }

  return []
}