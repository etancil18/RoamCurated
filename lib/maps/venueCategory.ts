// lib/maps/venueCategory.ts

import type {
  Venue,
  VenueMarkerTemporalProfile,
} from '@/types/venue'

export type VenueCategory =
  | 'coffee'
  | 'dining'
  | 'wine'
  | 'cocktails'
  | 'nightlife'
  | 'culture'
  | 'shopping'
  | 'outdoors'
  | 'wellness'
  | 'hotel'
  | 'event'
  | 'other'

export type ResolveVenueCategoryOptions = {
  /**
   * Time used only for venues that explicitly declare
   * `markerTemporalProfile`.
   */
  now?: Date

  /**
   * Optional local hour override.
   *
   * Use this when the venue's local timezone differs from the
   * browser timezone. Values must be between 0 and 23.
   */
  localHour?: number
}

const CATEGORY_PRIORITY: readonly VenueCategory[] = [
  'event',
  'coffee',
  'dining',
  'wine',
  'cocktails',
  'nightlife',
  'culture',
  'shopping',
  'outdoors',
  'wellness',
  'hotel',
  'other',
]

const CATEGORY_ALIASES: Readonly<Record<string, VenueCategory>> = {
  // Coffee
  cafe: 'coffee',
  café: 'coffee',
  cafes: 'coffee',
  cafés: 'coffee',
  coffee: 'coffee',
  coffeeshop: 'coffee',
  'coffee-shop': 'coffee',
  'coffee shop': 'coffee',
  bakery: 'coffee',
  patisserie: 'coffee',

  // Dining
  dining: 'dining',
  restaurant: 'dining',
  restaurants: 'dining',
  food: 'dining',
  eatery: 'dining',
  brunch: 'dining',
  lunch: 'dining',
  dinner: 'dining',
  bistro: 'dining',
  trattoria: 'dining',
  pizzeria: 'dining',

  // Wine
  wine: 'wine',
  winery: 'wine',
  winebar: 'wine',
  'wine-bar': 'wine',
  'wine bar': 'wine',
  enoteca: 'wine',

  // Cocktails
  cocktail: 'cocktails',
  cocktails: 'cocktails',
  cocktailbar: 'cocktails',
  'cocktail-bar': 'cocktails',
  'cocktail bar': 'cocktails',
  bar: 'cocktails',
  speakeasy: 'cocktails',

  // Nightlife
  nightlife: 'nightlife',
  nightclub: 'nightlife',
  club: 'nightlife',
  disco: 'nightlife',
  dancing: 'nightlife',
  'late-night': 'nightlife',
  'late night': 'nightlife',

  // Culture
  culture: 'culture',
  museum: 'culture',
  gallery: 'culture',
  art: 'culture',
  theater: 'culture',
  theatre: 'culture',
  cinema: 'culture',
  music: 'culture',
  concert: 'culture',
  performance: 'culture',

  // Shopping
  shopping: 'shopping',
  shop: 'shopping',
  store: 'shopping',
  retail: 'shopping',
  boutique: 'shopping',
  market: 'shopping',

  // Outdoors
  outdoors: 'outdoors',
  outdoor: 'outdoors',
  park: 'outdoors',
  garden: 'outdoors',
  beach: 'outdoors',
  nature: 'outdoors',
  viewpoint: 'outdoors',
  landmark: 'outdoors',

  // Wellness
  wellness: 'wellness',
  spa: 'wellness',
  fitness: 'wellness',
  gym: 'wellness',
  yoga: 'wellness',
  sauna: 'wellness',

  // Hotels
  hotel: 'hotel',
  hotels: 'hotel',
  lodging: 'hotel',
  accommodation: 'hotel',
  resort: 'hotel',
  hostel: 'hotel',

  // Events
  event: 'event',
  events: 'event',
  festival: 'event',
  exhibition: 'event',
  popup: 'event',
  'pop-up': 'event',

  // Fallback
  other: 'other',
}

const TEMPORAL_PROFILE_CATEGORIES: Readonly<
  Record<
    VenueMarkerTemporalProfile,
    {
      daytime: VenueCategory
      evening: VenueCategory
      eveningStartsAt: number
    }
  >
> = {
  'coffee-dining': {
    daytime: 'coffee',
    evening: 'dining',
    eveningStartsAt: 17,
  },
  'coffee-wine': {
    daytime: 'coffee',
    evening: 'wine',
    eveningStartsAt: 17,
  },
}

function normalizeCategoryToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, '-')
    .replace(/\s+/g, ' ')
}

function collectTypeValues(value: Venue['type']): string[] {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .flatMap((item) =>
      typeof item === 'string'
        ? item.split(',')
        : []
    )
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveAlias(value: string): VenueCategory | null {
  const normalized = normalizeCategoryToken(value)

  if (!normalized) {
    return null
  }

  const directMatch = CATEGORY_ALIASES[normalized]

  if (directMatch) {
    return directMatch
  }

  const compact = normalized.replace(/[\s-]+/g, '')
  const compactMatch = CATEGORY_ALIASES[compact]

  return compactMatch ?? null
}

function resolveLocalHour(
  options: ResolveVenueCategoryOptions
): number {
  const { localHour } = options

  if (
    typeof localHour === 'number' &&
    Number.isInteger(localHour) &&
    localHour >= 0 &&
    localHour <= 23
  ) {
    return localHour
  }

  return (options.now ?? new Date()).getHours()
}

/**
 * Returns every canonical category represented by `venue.type`.
 *
 * Legacy category fields are intentionally not inspected here.
 * Raw data must be normalized into canonical `Venue.type` before
 * reaching this resolver.
 */
export function getVenueCategories(
  venue: Pick<Venue, 'type'>
): VenueCategory[] {
  const categories = new Set<VenueCategory>()

  for (const value of collectTypeValues(venue.type)) {
    const category = resolveAlias(value)

    if (category) {
      categories.add(category)
    }
  }

  return CATEGORY_PRIORITY.filter((category) =>
    categories.has(category)
  )
}

/**
 * Resolves the venue's stable canonical category.
 *
 * This function does not apply time-sensitive marker behavior.
 */
export function resolveBaseVenueCategory(
  venue: Pick<Venue, 'type'>
): VenueCategory {
  return getVenueCategories(venue)[0] ?? 'other'
}

/**
 * Resolves the category used by the marker glyph.
 *
 * Temporal switching is opt-in only. A venue changes category by
 * time of day exclusively when `markerTemporalProfile` is present.
 * Otherwise, the canonical category remains stable.
 */
export function resolveVenueCategory(
  venue: Pick<Venue, 'type' | 'markerTemporalProfile'>,
  options: ResolveVenueCategoryOptions = {}
): VenueCategory {
  const profile = venue.markerTemporalProfile

  if (!profile) {
    return resolveBaseVenueCategory(venue)
  }

  const temporalCategories =
    TEMPORAL_PROFILE_CATEGORIES[profile]

  const hour = resolveLocalHour(options)

  return hour >= temporalCategories.eveningStartsAt
    ? temporalCategories.evening
    : temporalCategories.daytime
}

/**
 * Convenience predicate for category-based marker decorations,
 * filters, and scoring.
 */
export function venueHasCategory(
  venue: Pick<Venue, 'type'>,
  category: VenueCategory
): boolean {
  return getVenueCategories(venue).includes(category)
}