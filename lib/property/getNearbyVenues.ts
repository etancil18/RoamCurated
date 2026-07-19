// lib/property/getNearbyVenues.ts

import 'server-only'

import { createServerClient } from '@/lib/supabase/server'

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const EARTH_RADIUS_METERS = 6_371_000
const METERS_PER_LATITUDE_DEGREE = 111_320

const DEFAULT_RADIUS_METERS = 1_600
const DEFAULT_LIMIT = 100
const DEFAULT_CANDIDATE_LIMIT = 2_000

const MIN_RADIUS_METERS = 1
const MAX_RADIUS_METERS = 50_000

const MIN_LIMIT = 1
const MAX_LIMIT = 500

const MIN_CANDIDATE_LIMIT = 1
const MAX_CANDIDATE_LIMIT = 5_000

export const ROAM_CITIES = [
  'atl',
  'nyc',
  'london',
  'lisbon',
  'porto',
  'los angeles',
] as const

export type RoamCity =
  (typeof ROAM_CITIES)[number]

/* ------------------------------------------------ */
/* Public types                                     */
/* ------------------------------------------------ */

export type NearbyVenueOrigin = {
  propertyId: string | null
  propertyName: string | null
  propertySlug: string | null
  city: RoamCity | null
  lat: number
  lon: number
}

export type NearbyVenue = {
  id: string
  name: string

  city: RoamCity | null
  slug: string | null
  link: string

  description: string | null
  cover: string | null
  type: string | string[] | null

  lat: number
  lon: number

  /**
   * Straight-line distance from the resolved origin.
   */
  distanceMeters: number

  /**
   * Original venue database row.
   *
   * Existing crawl and guide loaders can continue accessing additional
   * venue columns without this shared loader duplicating the full schema.
   */
  raw: Record<string, unknown>
}

export type GetNearbyVenuesParams = {
  /**
   * Property used to resolve the search origin.
   *
   * Required unless both lat and lon are supplied.
   */
  propertyId?: string | null

  /**
   * Explicit search-origin latitude.
   *
   * Must be supplied together with lon.
   */
  lat?: number | string | null

  /**
   * Explicit search-origin longitude.
   *
   * Must be supplied together with lat.
   */
  lon?: number | string | null

  /**
   * Optional exact Roam city filter.
   *
   * Supported venue-table values:
   *
   * atl
   * nyc
   * london
   * lisbon
   * porto
   * los angeles
   *
   * When omitted, the loader relies on the geographic bounding box and
   * exact distance calculation. It does not automatically impose the
   * property's city as a hard filter.
   */
  city?: RoamCity | string | null

  /**
   * Search radius in meters.
   *
   * Defaults to 1,600 meters and is capped at 50 kilometers.
   */
  radiusMeters?: number

  /**
   * Maximum number of nearby venues returned after exact distance sorting.
   */
  limit?: number

  /**
   * Maximum number of bounding-box candidates loaded before exact distance
   * filtering.
   */
  candidateLimit?: number

  /**
   * Venue IDs that should not be returned.
   */
  excludeVenueIds?: string[]

  /**
   * Optional additional eligibility predicate.
   *
   * Runs after normalization and exact distance calculation, but before
   * final sorting and limiting.
   */
  filter?: (venue: NearbyVenue) => boolean
}

export type NearbyVenuesData = {
  origin: NearbyVenueOrigin
  venues: NearbyVenue[]

  radiusMeters: number
  candidateCount: number
  nearbyVenueCount: number
}

/* ------------------------------------------------ */
/* Database row contracts                           */
/* ------------------------------------------------ */

type PropertyOriginRow = {
  id: unknown
  name: unknown
  slug: unknown
  city: unknown
  lat: unknown
  lon: unknown
}

type VenueRow = {
  id: unknown
  name: unknown

  city?: unknown
  slug?: unknown
  link?: unknown

  description?: unknown
  cover?: unknown
  type?: unknown

  lat?: unknown
  lon?: unknown

  [key: string]: unknown
}

/* ------------------------------------------------ */
/* Public API                                       */
/* ------------------------------------------------ */

/**
 * Returns normalized nearby venues ordered from nearest to farthest.
 */
export async function getNearbyVenues(
  params: GetNearbyVenuesParams
): Promise<NearbyVenue[]> {
  const data = await getNearbyVenuesData(params)

  return data.venues
}

/**
 * Returns nearby venues plus origin and query metadata.
 *
 * Processing sequence:
 *
 * 1. Validate the supplied origin and optional city.
 * 2. Resolve an explicit or property-based origin.
 * 3. Calculate a geographic bounding box.
 * 4. Optionally restrict candidates to one approved Roam city.
 * 5. Load venue candidates inside the bounding box.
 * 6. Calculate exact Haversine distances.
 * 7. Remove venues outside the requested radius.
 * 8. Apply exclusions and optional eligibility filtering.
 * 9. Sort nearest-first and enforce the requested limit.
 */
export async function getNearbyVenuesData(
  params: GetNearbyVenuesParams
): Promise<NearbyVenuesData> {
  const radiusMeters = normalizeIntegerWithinRange({
    value: params.radiusMeters,
    fallback: DEFAULT_RADIUS_METERS,
    minimum: MIN_RADIUS_METERS,
    maximum: MAX_RADIUS_METERS,
  })

  const limit = normalizeIntegerWithinRange({
    value: params.limit,
    fallback: DEFAULT_LIMIT,
    minimum: MIN_LIMIT,
    maximum: MAX_LIMIT,
  })

  const candidateLimit = normalizeIntegerWithinRange({
    value: params.candidateLimit,
    fallback: Math.max(
      DEFAULT_CANDIDATE_LIMIT,
      limit * 10
    ),
    minimum: MIN_CANDIDATE_LIMIT,
    maximum: MAX_CANDIDATE_LIMIT,
  })

  const explicitLat = toFiniteNumber(params.lat)
  const explicitLon = toFiniteNumber(params.lon)

  const hasExplicitLat = explicitLat !== null
  const hasExplicitLon = explicitLon !== null

  if (hasExplicitLat !== hasExplicitLon) {
    throw new Error(
      'getNearbyVenues requires both lat and lon when using an explicit origin.'
    )
  }

  if (
    explicitLat !== null &&
    !isValidLatitude(explicitLat)
  ) {
    throw new Error(
      `Invalid nearby-venue latitude "${explicitLat}".`
    )
  }

  if (
    explicitLon !== null &&
    !isValidLongitude(explicitLon)
  ) {
    throw new Error(
      `Invalid nearby-venue longitude "${explicitLon}".`
    )
  }

  const propertyId = cleanText(params.propertyId)

  const suppliedCity = cleanText(params.city)
  const cityFilter = normalizeRoamCity(params.city)

  if (suppliedCity && !cityFilter) {
    throw new Error(
      `Unsupported Roam city "${suppliedCity}". Expected one of: ${ROAM_CITIES.join(
        ', '
      )}.`
    )
  }

  if (
    explicitLat === null &&
    explicitLon === null &&
    !propertyId
  ) {
    throw new Error(
      'getNearbyVenues requires propertyId or an explicit lat/lon origin.'
    )
  }

  const supabase = await createServerClient()

  const origin =
    explicitLat !== null && explicitLon !== null
      ? buildExplicitOrigin({
          propertyId,
          city: cityFilter,
          lat: explicitLat,
          lon: explicitLon,
        })
      : await resolvePropertyOrigin({
          supabase,
          propertyId: propertyId as string,
        })

  const boundingBox = buildBoundingBox({
    lat: origin.lat,
    lon: origin.lon,
    radiusMeters,
  })

  let query = supabase
    .from('venues')
    .select('*')
    .not('lat', 'is', null)
    .not('lon', 'is', null)
    .gte('lat', boundingBox.minLat)
    .lte('lat', boundingBox.maxLat)
    .limit(candidateLimit)

  if (boundingBox.crossesAntimeridian) {
    query = query.or(
      [
        `lon.gte.${boundingBox.minLon}`,
        `lon.lte.${boundingBox.maxLon}`,
      ].join(',')
    )
  } else {
    query = query
      .gte('lon', boundingBox.minLon)
      .lte('lon', boundingBox.maxLon)
  }

  if (cityFilter) {
    query = query.eq('city', cityFilter)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(
      `Failed to load nearby venues: ${error.message}`
    )
  }

  const candidateRows = rowsFrom<VenueRow>(data)

  const excludedVenueIds = new Set(
    uniqueStrings(params.excludeVenueIds ?? [])
  )

  const venues = candidateRows
    .map((row) =>
      normalizeNearbyVenue({
        row,
        origin,
      })
    )
    .filter(
      (venue): venue is NearbyVenue =>
        venue !== null
    )
    .filter(
      (venue) =>
        venue.distanceMeters <= radiusMeters
    )
    .filter(
      (venue) =>
        !excludedVenueIds.has(venue.id)
    )
    .filter((venue) =>
      params.filter
        ? params.filter(venue)
        : true
    )
    .sort(compareNearbyVenues)
    .slice(0, limit)

  return {
    origin,
    venues,

    radiusMeters,
    candidateCount: candidateRows.length,
    nearbyVenueCount: venues.length,
  }
}

/* ------------------------------------------------ */
/* Property-origin resolution                       */
/* ------------------------------------------------ */

async function resolvePropertyOrigin({
  supabase,
  propertyId,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  propertyId: string
}): Promise<NearbyVenueOrigin> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      [
        'id',
        'name',
        'slug',
        'city',
        'lat',
        'lon',
      ].join(',')
    )
    .eq('id', propertyId)
    .limit(1)

  if (error) {
    throw new Error(
      `Failed to resolve nearby-venue origin for property "${propertyId}": ${error.message}`
    )
  }

  const row = firstRow<PropertyOriginRow>(data)

  if (!row) {
    throw new Error(
      `Property "${propertyId}" could not be found while resolving nearby venues.`
    )
  }

  const id = cleanText(row.id)
  const lat = toFiniteNumber(row.lat)
  const lon = toFiniteNumber(row.lon)

  if (!id) {
    throw new Error(
      `Property "${propertyId}" has no valid identifier.`
    )
  }

  if (
    lat === null ||
    lon === null ||
    !isValidLatitude(lat) ||
    !isValidLongitude(lon)
  ) {
    throw new Error(
      `Property "${propertyId}" does not have valid latitude and longitude coordinates.`
    )
  }

  return {
    propertyId: id,
    propertyName: cleanText(row.name),
    propertySlug: cleanText(row.slug),
    city: normalizeRoamCity(row.city),
    lat,
    lon,
  }
}

function buildExplicitOrigin({
  propertyId,
  city,
  lat,
  lon,
}: {
  propertyId: string | null
  city: RoamCity | null
  lat: number
  lon: number
}): NearbyVenueOrigin {
  return {
    propertyId,
    propertyName: null,
    propertySlug: null,
    city,
    lat,
    lon,
  }
}

/* ------------------------------------------------ */
/* Bounding-box calculation                         */
/* ------------------------------------------------ */

type GeographicBoundingBox = {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
  crossesAntimeridian: boolean
}

function buildBoundingBox({
  lat,
  lon,
  radiusMeters,
}: {
  lat: number
  lon: number
  radiusMeters: number
}): GeographicBoundingBox {
  const latitudeDelta =
    radiusMeters /
    METERS_PER_LATITUDE_DEGREE

  const latitudeRadians = toRadians(lat)

  const longitudeScale =
    Math.cos(latitudeRadians)

  const longitudeDelta =
    Math.abs(longitudeScale) < 0.000001
      ? 180
      : Math.min(
          180,
          radiusMeters /
            (
              METERS_PER_LATITUDE_DEGREE *
              Math.abs(longitudeScale)
            )
        )

  const minLat = clamp(
    lat - latitudeDelta,
    -90,
    90
  )

  const maxLat = clamp(
    lat + latitudeDelta,
    -90,
    90
  )

  const rawMinLon = lon - longitudeDelta
  const rawMaxLon = lon + longitudeDelta

  const crossesAntimeridian =
    rawMinLon < -180 ||
    rawMaxLon > 180

  return {
    minLat,
    maxLat,
    minLon: normalizeLongitude(rawMinLon),
    maxLon: normalizeLongitude(rawMaxLon),
    crossesAntimeridian,
  }
}

/* ------------------------------------------------ */
/* Venue normalization                              */
/* ------------------------------------------------ */

function normalizeNearbyVenue({
  row,
  origin,
}: {
  row: VenueRow
  origin: NearbyVenueOrigin
}): NearbyVenue | null {
  const id = cleanText(row.id)
  const name = cleanText(row.name)

  const lat = toFiniteNumber(row.lat)
  const lon = toFiniteNumber(row.lon)

  if (
    !id ||
    !name ||
    lat === null ||
    lon === null ||
    !isValidLatitude(lat) ||
    !isValidLongitude(lon)
  ) {
    return null
  }

  const explicitLink = cleanText(row.link)

  const distanceMeters = calculateDistanceMeters({
    fromLat: origin.lat,
    fromLon: origin.lon,
    toLat: lat,
    toLon: lon,
  })

  if (!Number.isFinite(distanceMeters)) {
    return null
  }

  return {
    id,
    name,

    city: normalizeRoamCity(row.city),
    slug: cleanText(row.slug),

    link:
      explicitLink ??
      `/venue-profile/${encodeURIComponent(id)}`,

    description: cleanText(row.description),
    cover: normalizeAssetPath(row.cover),
    type: normalizeVenueType(row.type),

    lat,
    lon,

    distanceMeters:
      Math.round(distanceMeters),

    raw: { ...row },
  }
}

/* ------------------------------------------------ */
/* Distance calculation                             */
/* ------------------------------------------------ */

export function calculateDistanceMeters({
  fromLat,
  fromLon,
  toLat,
  toLon,
}: {
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}): number {
  if (
    !isValidLatitude(fromLat) ||
    !isValidLongitude(fromLon) ||
    !isValidLatitude(toLat) ||
    !isValidLongitude(toLon)
  ) {
    return Number.POSITIVE_INFINITY
  }

  const fromLatitudeRadians =
    toRadians(fromLat)

  const toLatitudeRadians =
    toRadians(toLat)

  const latitudeDelta =
    toRadians(toLat - fromLat)

  const longitudeDelta =
    toRadians(toLon - fromLon)

  const sinLatitude =
    Math.sin(latitudeDelta / 2)

  const sinLongitude =
    Math.sin(longitudeDelta / 2)

  const haversine =
    sinLatitude * sinLatitude +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      sinLongitude *
      sinLongitude

  const boundedHaversine = clamp(
    haversine,
    0,
    1
  )

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(boundedHaversine),
      Math.sqrt(1 - boundedHaversine)
    )

  return (
    EARTH_RADIUS_METERS *
    angularDistance
  )
}

/* ------------------------------------------------ */
/* Sorting                                          */
/* ------------------------------------------------ */

function compareNearbyVenues(
  a: NearbyVenue,
  b: NearbyVenue
): number {
  if (a.distanceMeters !== b.distanceMeters) {
    return (
      a.distanceMeters -
      b.distanceMeters
    )
  }

  const nameComparison = a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: 'base',
    }
  )

  if (nameComparison !== 0) {
    return nameComparison
  }

  return a.id.localeCompare(b.id)
}

/* ------------------------------------------------ */
/* City assessment                                  */
/* ------------------------------------------------ */

export function normalizeRoamCity(
  value: unknown
): RoamCity | null {
  const normalized = cleanText(value)
    ?.toLowerCase()
    .replace(/\s+/g, ' ')

  if (!normalized) {
    return null
  }

  return ROAM_CITIES.includes(
    normalized as RoamCity
  )
    ? (normalized as RoamCity)
    : null
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function firstRow<T>(
  value: unknown
): T | null {
  return rowsFrom<T>(value)[0] ?? null
}

function rowsFrom<T>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : []
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
    const parsed = Number.parseFloat(
      value.trim()
    )

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

function normalizeVenueType(
  value: unknown
): string | string[] | null {
  if (Array.isArray(value)) {
    const normalized = value
      .map(cleanText)
      .filter(
        (entry): entry is string =>
          entry !== null
      )

    return normalized.length > 0
      ? normalized
      : null
  }

  return cleanText(value)
}

function normalizeAssetPath(
  value: unknown
): string | null {
  const path = cleanText(value)

  if (!path) {
    return null
  }

  if (
    path.startsWith('/') ||
    path.startsWith('https://') ||
    path.startsWith('http://')
  ) {
    return path
  }

  return `/${path}`
}

function uniqueStrings(
  values: Array<
    string | null | undefined
  >
): string[] {
  return Array.from(
    new Set(
      values
        .map(cleanText)
        .filter(
          (value): value is string =>
            value !== null
        )
    )
  )
}

function normalizeIntegerWithinRange({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value: number | undefined
  fallback: number
  minimum: number
  maximum: number
}): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return clamp(
      Math.trunc(fallback),
      minimum,
      maximum
    )
  }

  return clamp(
    Math.trunc(value),
    minimum,
    maximum
  )
}

function isValidLatitude(
  value: number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  )
}

function isValidLongitude(
  value: number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  )
}

function normalizeLongitude(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return (
    ((value + 180) % 360 + 360) %
      360 -
    180
  )
}

function toRadians(
  value: number
): number {
  return value * (Math.PI / 180)
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  )
}