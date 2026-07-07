// lib/routes/venueTypeNormalization.ts

export type NormalizedVenueType =
  | 'activity'
  | 'afternoon_tea'
  | 'bakery'
  | 'bar'
  | 'bistro'
  | 'bookstore'
  | 'breakfast'
  | 'brewery'
  | 'brunch'
  | 'cafe'
  | 'cinema'
  | 'class'
  | 'club'
  | 'cocktail'
  | 'coffee'
  | 'comedy'
  | 'dessert'
  | 'dinner'
  | 'event_space'
  | 'event_venue'
  | 'fitness'
  | 'food_court'
  | 'gallery'
  | 'garden'
  | 'happy_hour'
  | 'juice_bar'
  | 'late_night'
  | 'library'
  | 'lifestyle'
  | 'lounge'
  | 'lunch'
  | 'market'
  | 'museum'
  | 'music'
  | 'nature'
  | 'park'
  | 'patio'
  | 'pilates'
  | 'pub'
  | 'random_gem'
  | 'restaurant'
  | 'rooftop'
  | 'show'
  | 'showroom'
  | 'smoothie'
  | 'spa'
  | 'speakeasy'
  | 'sports_bar'
  | 'stadium'
  | 'tea'
  | 'theater'
  | 'walk'
  | 'wellness'
  | 'wine_bar'
  | 'workspace'
  | 'yoga'

export const VENUE_TYPE_ALIASES: Record<string, NormalizedVenueType> = {
  activity: 'activity',
  afternoon_tea: 'afternoon_tea',
  bakery: 'bakery',
  bar: 'bar',
  bistrot: 'bistro',
  bistro: 'bistro',
  bookshop: 'bookstore',
  bookstore: 'bookstore',
  breakfast: 'breakfast',
  brewery: 'brewery',
  brunch: 'brunch',
  cafe: 'cafe',
  café: 'cafe',
  cinema: 'cinema',
  class: 'class',
  club: 'club',
  cocktail: 'cocktail',
  cocktails: 'cocktail',
  coffee: 'coffee',
  comedy: 'comedy',
  dessert: 'dessert',
  dinner: 'dinner',
  event_space: 'event_space',
  event_venue: 'event_venue',
  fitness: 'fitness',
  food_court: 'food_court',
  gallery: 'gallery',
  garden: 'garden',
  happy_hour: 'happy_hour',
  juice_bar: 'juice_bar',
  late_night: 'late_night',
  late_night_: 'late_night',
  library: 'library',
  lifestyle: 'lifestyle',
  live_music: 'music',
  lounge: 'lounge',
  lunch: 'lunch',
  market: 'market',
  museum: 'museum',
  music: 'music',
  nature: 'nature',
  park: 'park',
  patio: 'patio',
  pilates: 'pilates',
  pub: 'pub',
  random_gem: 'random_gem',
  restaurant: 'restaurant',
  rooftop: 'rooftop',
  show: 'show',
  showroom: 'showroom',
  smoothie: 'smoothie',
  spa: 'spa',
  speakeasy: 'speakeasy',
  sports_bar: 'sports_bar',
  stadium: 'stadium',
  tea: 'tea',
  theater: 'theater',
  theatre: 'theater',
  walk: 'walk',
  wellness: 'wellness',
  wine_bar: 'wine_bar',
  workspace: 'workspace',
  yoga: 'yoga',
}

const MEAL_TYPES = new Set<NormalizedVenueType>([
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'restaurant',
  'bistro',
  'food_court',
])

const DRINK_TYPES = new Set<NormalizedVenueType>([
  'bar',
  'cocktail',
  'wine_bar',
  'brewery',
  'pub',
  'lounge',
  'rooftop',
  'speakeasy',
  'sports_bar',
  'happy_hour',
  'late_night',
])

const CULTURE_TYPES = new Set<NormalizedVenueType>([
  'gallery',
  'museum',
  'bookstore',
  'library',
  'theater',
  'cinema',
  'show',
  'comedy',
  'music',
])

const WELLNESS_TYPES = new Set<NormalizedVenueType>([
  'fitness',
  'yoga',
  'pilates',
  'spa',
  'wellness',
  'walk',
  'nature',
])

const OUTDOOR_TYPES = new Set<NormalizedVenueType>([
  'park',
  'garden',
  'patio',
  'rooftop',
  'nature',
  'walk',
])

export function normalizeVenueType(value: unknown): NormalizedVenueType | null {
  if (typeof value !== 'string') return null

  const normalized = normalizeTypeKey(value)

  if (!normalized) return null

  return VENUE_TYPE_ALIASES[normalized] ?? null
}

export function normalizeVenueTypes(value: unknown): NormalizedVenueType[] {
  const rawValues = extractRawTypeValues(value)

  const normalized = rawValues
    .map(normalizeVenueType)
    .filter((type): type is NormalizedVenueType => Boolean(type))

  return Array.from(new Set(expandInferredTypes(normalized)))
}

export function getPrimaryVenueType(value: unknown): NormalizedVenueType | null {
  return normalizeVenueTypes(value)[0] ?? null
}

export function hasVenueType(
  value: unknown,
  targetType: NormalizedVenueType
): boolean {
  return normalizeVenueTypes(value).includes(targetType)
}

export function hasAnyVenueType(
  value: unknown,
  targetTypes: NormalizedVenueType[]
): boolean {
  const normalized = normalizeVenueTypes(value)
  return targetTypes.some((type) => normalized.includes(type))
}

export function normalizeTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[–—-]/g, '-')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function formatVenueTypeLabel(value: string | NormalizedVenueType): string {
  const normalized = normalizeVenueType(value) ?? normalizeTypeKey(value)

  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

export function isMealType(type: NormalizedVenueType): boolean {
  return MEAL_TYPES.has(type)
}

export function isDrinkType(type: NormalizedVenueType): boolean {
  return DRINK_TYPES.has(type)
}

export function isCultureType(type: NormalizedVenueType): boolean {
  return CULTURE_TYPES.has(type)
}

export function isWellnessType(type: NormalizedVenueType): boolean {
  return WELLNESS_TYPES.has(type)
}

export function isOutdoorType(type: NormalizedVenueType): boolean {
  return OUTDOOR_TYPES.has(type)
}

function extractRawTypeValues(value: unknown): string[] {
  if (!value) return []

  if (typeof value === 'string') {
    return value
      .split(/[,/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractRawTypeValues)
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>

    return [
      ...extractRawTypeValues(objectValue.type),
      ...extractRawTypeValues(objectValue.types),
      ...extractRawTypeValues(objectValue.venue_type),
      ...extractRawTypeValues(objectValue.venue_types),
      ...extractRawTypeValues(objectValue.category),
      ...extractRawTypeValues(objectValue.categories),
    ]
  }

  return []
}

function expandInferredTypes(
  types: NormalizedVenueType[]
): NormalizedVenueType[] {
  const expanded = [...types]

  if (
    types.includes('breakfast') ||
    types.includes('brunch') ||
    types.includes('lunch') ||
    types.includes('dinner') ||
    types.includes('bistro')
  ) {
    expanded.push('restaurant')
  }

  if (
    types.includes('cafe') ||
    types.includes('bakery') ||
    types.includes('tea') ||
    types.includes('juice_bar') ||
    types.includes('smoothie')
  ) {
    expanded.push('coffee')
  }

  if (
    types.includes('cocktail') ||
    types.includes('wine_bar') ||
    types.includes('speakeasy') ||
    types.includes('sports_bar') ||
    types.includes('late_night')
  ) {
    expanded.push('bar')
  }

  if (
    types.includes('yoga') ||
    types.includes('pilates') ||
    types.includes('spa')
  ) {
    expanded.push('wellness')
  }

  if (
    types.includes('live_music' as NormalizedVenueType) ||
    types.includes('club') ||
    types.includes('dj' as NormalizedVenueType)
  ) {
    expanded.push('music')
  }

  return Array.from(new Set(expanded))
}