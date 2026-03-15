import type { Venue } from '@/types/venue'

/* ------------------------------------------------ */
/* Normalize venue types                            */
/* ------------------------------------------------ */

export function getVenueTypes(venue: Venue): string[] {
  if (!venue?.type) return []

  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()

  if (Array.isArray(venue.type)) {
    return venue.type
      .flatMap((t) => String(t).split(','))
      .map(normalize)
      .filter(Boolean)
  }

  if (typeof venue.type === 'string') {
    return venue.type
      .split(',')
      .map(normalize)
      .filter(Boolean)
  }

  return []
}

/* ------------------------------------------------ */
/* Type exclusions (prevents obvious mis-matches)   */
/* ------------------------------------------------ */

const TYPE_EXCLUSIONS: Record<string, string[]> = {

  club: ['bakery', 'coffee', 'dessert', 'cafe'],
  nightclub: ['bakery', 'coffee', 'dessert', 'cafe'],
  bar: ['bakery', 'coffee'],
  cocktail: ['bakery', 'coffee']

}

/* ------------------------------------------------ */
/* Type match helpers                               */
/* ------------------------------------------------ */

export function venueMatchesType(
  venue: Venue,
  targetType: string
): boolean {

  const types = getVenueTypes(venue)
  const target = targetType.toLowerCase()

  if (TYPE_EXCLUSIONS[target]?.some(t => types.includes(t))) {
    return false
  }

  return types.includes(target)
}

export function venueMatchesAnyType(
  venue: Venue,
  targetTypes: readonly string[]
): boolean {

  const types = getVenueTypes(venue)

  return targetTypes.some((target) => {

    const normalized = target.toLowerCase()

    if (
      TYPE_EXCLUSIONS[normalized]?.some(t =>
        types.includes(t)
      )
    ) {
      return false
    }

    return types.includes(normalized)

  })
}

/* ------------------------------------------------ */
/* Canonical venue categories                       */
/* ------------------------------------------------ */

export const VENUE_TYPE_GROUPS = {

  coffee: ['coffee', 'cafe', 'bakery'],

  breakfast: ['breakfast', 'brunch'],

  lunch: ['lunch', 'restaurant', 'deli'],

  dinner: ['dinner', 'restaurant', 'steakhouse'],

  bar: ['bar', 'pub', 'taproom'],

  cocktail: ['cocktail', 'cocktail bar'],

  wine: ['wine bar', 'wine'],

  dessert: ['dessert', 'ice cream', 'gelato'],

  nightlife: [
    'club',
    'lounge',
    'speakeasy',
    'bar',
    'nightclub'
  ],

  culture: [
    'gallery',
    'museum',
    'theater',
    'music venue',
    'live music'
  ],

  outdoors: [
    'park',
    'garden',
    'trail'
  ],

  lifestyle: [
    'bookstore',
    'market'
  ],

  wellness: [
    'fitness',
    'gym',
    'yoga',
    'pilates',
    'spa',
    'sauna'
  ],

  brunch: [
    'brunch',
    'breakfast',
    'cafe'
  ],

  retail: [
    'market',
    'boutique',
    'shop'
  ],

  music: [
    'music venue',
    'live music',
    'concert hall'
  ]

} as const

/* ------------------------------------------------ */
/* Group matching helpers                           */
/* ------------------------------------------------ */

export function venueMatchesGroup(
  venue: Venue,
  group: keyof typeof VENUE_TYPE_GROUPS
): boolean {

  const groupTypes = VENUE_TYPE_GROUPS[group]

  return venueMatchesAnyType(
    venue,
    groupTypes
  )
}

export function filterVenuesByGroup(
  venues: Venue[],
  group: keyof typeof VENUE_TYPE_GROUPS
): Venue[] {

  const groupTypes = VENUE_TYPE_GROUPS[group]

  return venues.filter((v) =>
    venueMatchesAnyType(v, groupTypes)
  )
}

/* ------------------------------------------------ */
/* Daypart logic                                    */
/* ------------------------------------------------ */

export const DAYPART_TYPE_MAP = {

  morning: [
    'coffee',
    'bakery',
    'breakfast',
    'fitness',
    'yoga',
    'spa'
  ],

  midday: [
    'bookstore',
    'gallery',
    'lunch',
    'brunch',
    'park',
    'garden',
    'museum'
  ],

  evening: [
    'dinner',
    'wine bar',
    'cocktail',
    'bar',
    'dessert',
    'music venue'
  ],

  latenight: [
    'club',
    'lounge',
    'speakeasy',
    'bar',
    'nightclub'
  ]

} as const

export type DayPart =
  | 'morning'
  | 'midday'
  | 'evening'
  | 'latenight'

export function venueMatchesDayPart(
  venue: Venue,
  dayPart: DayPart
): boolean {
  const types = DAYPART_TYPE_MAP[dayPart]
  return venueMatchesAnyType(venue, types)
}

/* ------------------------------------------------ */
/* Venue filtering utilities                        */
/* ------------------------------------------------ */

export function filterVenuesByTypes(
  venues: Venue[],
  types: string[]
): Venue[] {
  return venues.filter((v) =>
    venueMatchesAnyType(v, types)
  )
}

export function filterVenuesByDayPart(
  venues: Venue[],
  dayPart: DayPart
): Venue[] {
  return venues.filter((v) =>
    venueMatchesDayPart(v, dayPart)
  )
}

/* ------------------------------------------------ */
/* Distance sorting                                 */
/* ------------------------------------------------ */

export function sortVenuesByDistance(
  venues: Venue[],
  lat: number,
  lon: number
): Venue[] {
  return [...venues].sort((a, b) => {
    const d1 = distanceMeters(lat, lon, a.lat, a.lon)
    const d2 = distanceMeters(lat, lon, b.lat, b.lon)
    return d1 - d2
  })
}

/* ------------------------------------------------ */
/* Haversine distance                               */
/* ------------------------------------------------ */

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {

  const R = 6371000

  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

  return R * c
}