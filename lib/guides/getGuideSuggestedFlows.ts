import { DateTime } from 'luxon'

import { CITY_CONFIGS } from '@/config/cities'
import {
  buildPropertyCrawlCards,
  type PropertyCrawlCard,
  type PropertyCrawlVenue,
  type PropertyCrawlVenueSource,
} from '@/lib/property/buildPropertyCrawlCards'
import { createServerClient } from '@/lib/supabase/server'
import { loadCityVenues } from '@/lib/venues/loadCityVenues'

/* ------------------------------------------------ */
/* Public types                                     */
/* ------------------------------------------------ */

export type GetGuideSuggestedFlowsParams = {
  /**
   * Preferred property resolver when the guide already has a property ID.
   */
  propertyId?: string | null

  /**
   * Used with propertySlug when propertyId is unavailable.
   */
  city?: string | null

  /**
   * Used with city when propertyId is unavailable.
   */
  propertySlug?: string | null

  /**
   * Maximum straight-line distance from the property.
   *
   * Defaults to 3,000 meters.
   */
  radiusMeters?: number

  /**
   * Optional crawl-theme allowlist.
   *
   * Filtering happens after the shared crawl builder runs so generation,
   * hydration, ranking, and presentation remain identical to the existing
   * property guide.
   */
  themes?: readonly string[] | null

  /**
   * Maximum number of flow cards returned.
   *
   * Defaults to 4.
   */
  limit?: number

  /**
   * Optional injected time for previews, testing, or scheduled guide views.
   *
   * When omitted, the current time in the property's city timezone is used.
   */
  now?: DateTime | null
}

export type GuideSuggestedFlowsResult = {
  property: GuideSuggestedFlowsProperty
  normalizedCity: string
  timezone: string
  nowForCity: DateTime
  radiusMeters: number
  nearbyVenueCount: number
  flows: PropertyCrawlCard[]
}

export type GuideSuggestedFlowsProperty = {
  id: string
  name: string
  slug: string
  city: string
  lat: number
  lon: number
}

/* ------------------------------------------------ */
/* Internal database types                          */
/* ------------------------------------------------ */

type PropertyRow = {
  id: string
  name: string
  slug: string
  city: string
  lat: number | string
  lon: number | string
}

type VenueRow = {
  id: string
  name: string
  lat: number | string
  lon: number | string
  city?: string | null
  slug?: string | null
  cover?: string | null
  type?: string | string[] | null
  description?: string | null
  link?: string | null
  label?: string | null
  [key: string]: unknown
}

/* ------------------------------------------------ */
/* Defaults                                         */
/* ------------------------------------------------ */

const DEFAULT_RADIUS_METERS = 3_000
const DEFAULT_FLOW_LIMIT = 4
const MAX_FLOW_LIMIT = 20
const MAX_RADIUS_METERS = 20_000

/* ------------------------------------------------ */
/* Public loader                                    */
/* ------------------------------------------------ */

/**
 * Loads suggested neighborhood flows for a white-label property guide.
 *
 * This loader deliberately reuses the same shared crawl-building pipeline as
 * the existing property guide:
 *
 * city venues
 *   -> nearby venues
 *   -> buildPropertyCrawlCards()
 *   -> optional guide filtering
 *
 * It does not load favorites, events, event journeys, maps, or page-specific
 * property-guide data.
 */
export async function getGuideSuggestedFlows(
  params: GetGuideSuggestedFlowsParams
): Promise<PropertyCrawlCard[]> {
  const result = await getGuideSuggestedFlowsData(params)
  return result?.flows ?? []
}

/**
 * Extended loader for callers that also need the resolved property, timezone,
 * effective time, radius, or nearby venue count.
 */
export async function getGuideSuggestedFlowsData(
  params: GetGuideSuggestedFlowsParams
): Promise<GuideSuggestedFlowsResult | null> {
  const propertyId = cleanText(params.propertyId)
  const requestedCity = cleanText(params.city)
  const propertySlug = cleanText(params.propertySlug)

  if (!propertyId && (!requestedCity || !propertySlug)) {
    return null
  }

  const supabase = await createServerClient()

  const property = await resolveProperty({
    supabase,
    propertyId,
    city: requestedCity,
    propertySlug,
  })

  if (!property) {
    return null
  }

  const normalizedCity = normalizeCityKey(property.city)

  const timezone =
    CITY_CONFIGS[normalizedCity]?.timezone ??
    CITY_CONFIGS[property.city]?.timezone ??
    'UTC'

  const nowForCity = resolveNowForCity(params.now, timezone)
  const radiusMeters = normalizeRadiusMeters(params.radiusMeters)
  const flowLimit = normalizeFlowLimit(params.limit)
  const allowedThemes = normalizeThemeFilter(params.themes)

  const { data: allVenuesData } = await supabase
    .from('venues')
    .select('*')

  const databaseCityVenues = (
    (allVenuesData as VenueRow[] | null) ?? []
  ).filter(
    (venue) =>
      normalizeCityKey(venue.city) === normalizedCity
  )

  const normalizedDatabaseCityVenues =
    databaseCityVenues
      .map(normalizeVenueSource)
      .filter(
        (
          venue
        ): venue is PropertyCrawlVenueSource =>
          venue !== null
      )

  const loadedCityVenues = (
    loadCityVenues(
      normalizedCity,
      normalizedDatabaseCityVenues as any
    ) ?? []
  )
    .map((venue) =>
      normalizeCrawlVenue(venue as VenueRow)
    )
    .filter(
      (
        venue
      ): venue is PropertyCrawlVenue =>
        venue !== null
    )

  const allCityVenues = uniqueById(loadedCityVenues)

  const dbCityVenueById = new Map<
    string,
    PropertyCrawlVenueSource
  >(
    normalizedDatabaseCityVenues.map((venue) => [
      venue.id,
      venue,
    ])
  )

  const allCityVenueById = new Map<
    string,
    PropertyCrawlVenue
  >(
    allCityVenues.map((venue) => [
      venue.id,
      venue,
    ])
  )

  const nearbyVenues = allCityVenues
    .map((venue) => ({
      venue,
      distanceMeters: haversineDistanceMeters(
        property.lat,
        property.lon,
        venue.lat,
        venue.lon
      ),
    }))
    .filter(
      ({ distanceMeters }) =>
        distanceMeters <= radiusMeters
    )
    .sort(
      (a, b) =>
        a.distanceMeters - b.distanceMeters
    )
    .map(({ venue }) => venue)

  if (nearbyVenues.length === 0) {
    return {
      property,
      normalizedCity,
      timezone,
      nowForCity,
      radiusMeters,
      nearbyVenueCount: 0,
      flows: [],
    }
  }

  const generatedFlows = buildPropertyCrawlCards({
    nearbyVenues,
    property: {
      id: property.id,
      lat: property.lat,
      lon: property.lon,
      city: property.city,
      slug: property.slug,
    },
    now: nowForCity,
    allCityVenueById,
    dbCityVenueById,
  })

  const filteredFlows =
    allowedThemes === null
      ? generatedFlows
      : generatedFlows.filter((card) =>
          allowedThemes.has(
            normalizeThemeName(card.theme)
          )
        )

  return {
    property,
    normalizedCity,
    timezone,
    nowForCity,
    radiusMeters,
    nearbyVenueCount: nearbyVenues.length,
    flows: filteredFlows.slice(0, flowLimit),
  }
}

/* ------------------------------------------------ */
/* Property resolution                              */
/* ------------------------------------------------ */

async function resolveProperty({
  supabase,
  propertyId,
  city,
  propertySlug,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  propertyId: string | null
  city: string | null
  propertySlug: string | null
}): Promise<GuideSuggestedFlowsProperty | null> {
  if (propertyId) {
    const { data } = await supabase
      .from('properties')
      .select('id, name, slug, city, lat, lon')
      .eq('id', propertyId)
      .limit(1)

    const row =
      ((data as PropertyRow[] | null) ?? [])[0] ??
      null

    return row ? normalizeProperty(row) : null
  }

  if (!city || !propertySlug) {
    return null
  }

  const normalizedRequestedCity =
    normalizeCityKey(city)

  const { data } = await supabase
    .from('properties')
    .select('id, name, slug, city, lat, lon')
    .eq('slug', propertySlug)

  const matchedRow =
    ((data as PropertyRow[] | null) ?? []).find(
      (row) =>
        normalizeCityKey(row.city) ===
        normalizedRequestedCity
    ) ?? null

  return matchedRow
    ? normalizeProperty(matchedRow)
    : null
}

function normalizeProperty(
  row: PropertyRow
): GuideSuggestedFlowsProperty | null {
  const id = cleanText(row.id)
  const name = cleanText(row.name)
  const slug = cleanText(row.slug)
  const city = cleanText(row.city)
  const lat = toFiniteNumber(row.lat)
  const lon = toFiniteNumber(row.lon)

  if (
    !id ||
    !name ||
    !slug ||
    !city ||
    lat === null ||
    lon === null
  ) {
    return null
  }

  return {
    id,
    name,
    slug,
    city,
    lat,
    lon,
  }
}

/* ------------------------------------------------ */
/* Venue normalization                              */
/* ------------------------------------------------ */

function normalizeVenueSource(
  venue: VenueRow
): PropertyCrawlVenueSource | null {
  const id = cleanText(venue.id)
  const name = cleanText(venue.name)
  const lat = toFiniteNumber(venue.lat)
  const lon = toFiniteNumber(venue.lon)

  if (
    !id ||
    !name ||
    lat === null ||
    lon === null
  ) {
    return null
  }

  return {
    ...venue,
    id,
    name,
    lat,
    lon,
    city: cleanText(venue.city),
    slug: cleanText(venue.slug),
    cover: normalizeImagePath(venue.cover),
    description: cleanText(venue.description),
    link:
      cleanText(venue.link) ??
      `/venue-profile/${id}`,
    label: cleanText(venue.label),
  }
}

function normalizeCrawlVenue(
  venue: VenueRow
): PropertyCrawlVenue | null {
  const source = normalizeVenueSource(venue)

  if (!source) {
    return null
  }

  return {
    ...source,
    lat: Number(source.lat),
    lon: Number(source.lon),
    slug: source.slug ?? undefined,
    cover: source.cover ?? null,
    link:
      cleanText(source.link) ??
      `/venue-profile/${source.id}`,
    description:
      cleanText(source.description),
    label: cleanText(source.label),
  }
}

function uniqueById<
  T extends {
    id: string
  },
>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    if (seen.has(item.id)) {
      continue
    }

    seen.add(item.id)
    result.push(item)
  }

  return result
}

/* ------------------------------------------------ */
/* Time and guide filtering                         */
/* ------------------------------------------------ */

function resolveNowForCity(
  injectedNow: DateTime | null | undefined,
  timezone: string
) {
  if (injectedNow?.isValid) {
    return injectedNow.setZone(timezone)
  }

  return DateTime.now().setZone(timezone)
}

function normalizeThemeFilter(
  themes: readonly string[] | null | undefined
): Set<string> | null {
  if (!themes || themes.length === 0) {
    return null
  }

  const normalizedThemes = themes
    .map(normalizeThemeName)
    .filter(Boolean)

  return normalizedThemes.length > 0
    ? new Set(normalizedThemes)
    : null
}

function normalizeThemeName(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function normalizeFlowLimit(
  value: number | null | undefined
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_FLOW_LIMIT
  }

  return Math.min(
    MAX_FLOW_LIMIT,
    Math.max(0, Math.floor(value))
  )
}

function normalizeRadiusMeters(
  value: number | null | undefined
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return DEFAULT_RADIUS_METERS
  }

  return Math.min(
    MAX_RADIUS_METERS,
    Math.round(value)
  )
}

/* ------------------------------------------------ */
/* Geographic distance                              */
/* ------------------------------------------------ */

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMeters = 6_371_000
  const latitude1 = degreesToRadians(lat1)
  const latitude2 = degreesToRadians(lat2)
  const latitudeDelta =
    degreesToRadians(lat2 - lat1)
  const longitudeDelta =
    degreesToRadians(lon2 - lon1)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )

  return Math.round(
    earthRadiusMeters * angularDistance
  )
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

/* ------------------------------------------------ */
/* Generic normalization                            */
/* ------------------------------------------------ */

function normalizeCityKey(
  input?: string | null
) {
  const raw = String(input ?? '')
    .trim()
    .toLowerCase()

  const aliases: Record<string, string> = {
    atl: 'atl',
    atlanta: 'atl',
    'atlanta ga': 'atl',

    nyc: 'nyc',
    'new york': 'nyc',
    'new york city': 'nyc',
    manhattan: 'nyc',

    la: 'la',
    'los angeles': 'la',
    'los-angeles': 'la',
    hollywood: 'la',
    'west hollywood': 'la',
    weho: 'la',
    venice: 'la',
    'santa monica': 'la',
    dtla: 'la',

    london: 'london',
    ldn: 'london',
    'greater london': 'london',
    shoreditch: 'london',
    camden: 'london',
    hackney: 'london',
    soho: 'london',
    chelsea: 'london',

    porto: 'porto',
    oporto: 'porto',

    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
}

function toFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

function cleanText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function normalizeImagePath(
  value: unknown
): string | null {
  const cleaned = cleanText(value)

  if (!cleaned) {
    return null
  }

  if (
    cleaned.startsWith('http://') ||
    cleaned.startsWith('https://') ||
    cleaned.startsWith('/')
  ) {
    return cleaned
  }

  return `/${cleaned}`
}