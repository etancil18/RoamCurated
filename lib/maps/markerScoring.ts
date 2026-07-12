// lib/maps/markerScoring.ts

import type { Venue } from '@/types/venue'
import type {
  MapDensityMode,
  MapPoint,
  RouteStopRole,
  VenueMarkerVisualState,
} from '@/lib/maps/mapTypes'

/**
 * Centralized marker-ranking weights.
 *
 * Explicit user intent must always outrank passive system signals.
 * Keep these values named and centralized so future tuning remains auditable.
 */
export const MARKER_SCORE_WEIGHTS = {
  selectedVenue: 10_000,
  routeStop: 9_000,
  exactNameMatch: 7_500,
  searchMatch: 6_000,
  liveEvent: 3_000,
  upcomingEvent: 1_500,
  partnerVenue: 1_000,
  openNow: 700,
  savedVenue: 500,
  editorialPriority: 400,
  trendingVenue: 300,
} as const

/**
 * Hard distance penalty applied after semantic ranking.
 *
 * Distance should improve local relevance without defeating route membership,
 * selection, or explicit search intent.
 */
export const DISTANCE_SCORE_CONFIG = {
  penaltyPerKilometer: 18,
  maximumPenalty: 2_500,
} as const

export type VenueSearchIndex = {
  name: string
  type: string[]
  vibe: string[]
  tags: string[]
  combined: string
}

export type VenueScoringSignals = {
  selected?: boolean
  routeIndex?: number | null
  searchTerm?: string
  hasLiveEvent?: boolean
  hasUpcomingEvent?: boolean
  isPartner?: boolean
  isOpenNow?: boolean
  isSaved?: boolean
  isTrending?: boolean
  editorialPriority?: number
}

export type ScoreVenueInput = {
  venue: Venue
  center?: MapPoint | null
  signals?: VenueScoringSignals
}

export type VenueScoreBreakdown = {
  selectedBoost: number
  routeBoost: number
  exactNameMatchBoost: number
  searchBoost: number
  liveEventBoost: number
  upcomingEventBoost: number
  partnerBoost: number
  openNowBoost: number
  savedBoost: number
  trendingBoost: number
  editorialBoost: number
  distancePenalty: number
}

export type ScoredVenue = {
  venue: Venue
  score: number
  distanceMeters: number | null
  visualState: VenueMarkerVisualState
  breakdown: VenueScoreBreakdown
}

export type RankVenuesInput = {
  venues: Venue[]
  center?: MapPoint | null
  searchTerm?: string
  selectedVenueId?: string | null
  routeIndexByVenueId?: ReadonlyMap<string, number>
  liveEventVenueIds?: ReadonlySet<string>
  upcomingEventVenueIds?: ReadonlySet<string>
  partnerVenueIds?: ReadonlySet<string>
  openVenueIds?: ReadonlySet<string>
  savedVenueIds?: ReadonlySet<string>
  trendingVenueIds?: ReadonlySet<string>
  editorialPriorityByVenueId?: ReadonlyMap<string, number>
}

export type GetRenderedVenuesInput = RankVenuesInput & {
  zoom: number
  densityMode?: MapDensityMode
  renderLimit?: number
}

/**
 * Normalize comma-delimited or array-backed venue metadata.
 */
export function normalizeSearchableList(
  value: string | string[] | null | undefined
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

/**
 * Build a normalized venue search index once per scoring operation.
 */
export function buildVenueSearchIndex(venue: Venue): VenueSearchIndex {
  const name = normalizeSearchText(venue.name ?? '')
  const type = normalizeSearchableList(venue.type).map(normalizeSearchText)
  const vibe = normalizeSearchableList(venue.vibe).map(normalizeSearchText)
  const tags = normalizeSearchableList(venue.tags).map(normalizeSearchText)

  return {
    name,
    type,
    vibe,
    tags,
    combined: [name, ...type, ...vibe, ...tags]
      .filter(Boolean)
      .join(' '),
  }
}

/**
 * Return whether a venue matches an explicit search query.
 */
export function venueMatchesSearch(
  venue: Venue,
  searchTerm: string
): boolean {
  const normalizedTerm = normalizeSearchText(searchTerm)

  if (!normalizedTerm) return true

  return buildVenueSearchIndex(venue).combined.includes(normalizedTerm)
}

/**
 * Return whether the normalized venue name exactly matches the query.
 */
export function venueNameExactlyMatchesSearch(
  venue: Venue,
  searchTerm: string
): boolean {
  const normalizedTerm = normalizeSearchText(searchTerm)

  if (!normalizedTerm) return false

  return buildVenueSearchIndex(venue).name === normalizedTerm
}

/**
 * Validate coordinates before routing, ranking or rendering.
 */
export function hasValidVenueCoordinates(venue: Venue): boolean {
  return (
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lon) &&
    venue.lat >= -90 &&
    venue.lat <= 90 &&
    venue.lon >= -180 &&
    venue.lon <= 180
  )
}

/**
 * Return the viewport density strategy for a given zoom.
 *
 * Fractional thresholds reduce abrupt visual changes at exact integer zooms.
 */
export function getMapDensityMode(zoom: number): MapDensityMode {
  if (!Number.isFinite(zoom) || zoom < 11) {
    return 'city-overview'
  }

  if (zoom < 13.25) {
    return 'clusters'
  }

  if (zoom < 15) {
    return 'priority'
  }

  return 'full'
}

/**
 * Maximum number of venue markers rendered at a given zoom.
 *
 * Route stops, selected venues and explicit search matches may be preserved
 * beyond this limit by getRenderedVenues().
 */
export function getVenueRenderLimit(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom < 11) return 0
  if (zoom < 12) return 12
  if (zoom < 13) return 28
  if (zoom < 14) return 48
  if (zoom < 15) return 80
  if (zoom < 16) return 130
  if (zoom < 17) return 190
  return 260
}

/**
 * Marker scaling applied by MapCanvas.
 */
export function getMarkerScale(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  if (zoom < 12) return 0.72
  if (zoom < 13.5) return 0.82
  if (zoom < 15) return 0.92
  if (zoom < 17) return 1
  return 1.1
}

/**
 * Return the semantic route role for a route index.
 */
export function getRouteStopRole(
  routeIndex: number,
  routeLength: number
): RouteStopRole {
  if (routeIndex <= 0) return 'start'
  if (routeIndex >= routeLength - 1) return 'end'
  return 'middle'
}

/**
 * Score one venue using explicit product signals and geographic relevance.
 */
export function scoreVenue({
  venue,
  center = null,
  signals = {},
}: ScoreVenueInput): ScoredVenue {
  const selected = signals.selected === true
  const routeIndex =
    typeof signals.routeIndex === 'number' &&
    Number.isFinite(signals.routeIndex)
      ? signals.routeIndex
      : null

  const normalizedSearchTerm = normalizeSearchText(
    signals.searchTerm ?? ''
  )

  const matchesSearch =
    normalizedSearchTerm.length > 0 &&
    venueMatchesSearch(venue, normalizedSearchTerm)

  const exactNameMatch =
    normalizedSearchTerm.length > 0 &&
    venueNameExactlyMatchesSearch(venue, normalizedSearchTerm)

  const editorialPriority = clamp(
    signals.editorialPriority ?? 0,
    0,
    1
  )

  const distanceMeters =
    center && hasValidVenueCoordinates(venue)
      ? haversineDistanceMeters(
          {
            lat: venue.lat,
            lon: venue.lon,
          },
          center
        )
      : null

  const distancePenalty =
    distanceMeters === null
      ? 0
      : Math.min(
          DISTANCE_SCORE_CONFIG.maximumPenalty,
          (distanceMeters / 1_000) *
            DISTANCE_SCORE_CONFIG.penaltyPerKilometer
        )

  const breakdown: VenueScoreBreakdown = {
    selectedBoost: selected
      ? MARKER_SCORE_WEIGHTS.selectedVenue
      : 0,

    routeBoost:
      routeIndex !== null
        ? MARKER_SCORE_WEIGHTS.routeStop
        : 0,

    exactNameMatchBoost: exactNameMatch
      ? MARKER_SCORE_WEIGHTS.exactNameMatch
      : 0,

    searchBoost:
      matchesSearch && !exactNameMatch
        ? MARKER_SCORE_WEIGHTS.searchMatch
        : 0,

    liveEventBoost: signals.hasLiveEvent
      ? MARKER_SCORE_WEIGHTS.liveEvent
      : 0,

    upcomingEventBoost:
      signals.hasUpcomingEvent && !signals.hasLiveEvent
        ? MARKER_SCORE_WEIGHTS.upcomingEvent
        : 0,

    partnerBoost: signals.isPartner
      ? MARKER_SCORE_WEIGHTS.partnerVenue
      : 0,

    openNowBoost: signals.isOpenNow
      ? MARKER_SCORE_WEIGHTS.openNow
      : 0,

    savedBoost: signals.isSaved
      ? MARKER_SCORE_WEIGHTS.savedVenue
      : 0,

    trendingBoost: signals.isTrending
      ? MARKER_SCORE_WEIGHTS.trendingVenue
      : 0,

    editorialBoost:
      editorialPriority *
      MARKER_SCORE_WEIGHTS.editorialPriority,

    distancePenalty,
  }

  const positiveScore =
    breakdown.selectedBoost +
    breakdown.routeBoost +
    breakdown.exactNameMatchBoost +
    breakdown.searchBoost +
    breakdown.liveEventBoost +
    breakdown.upcomingEventBoost +
    breakdown.partnerBoost +
    breakdown.openNowBoost +
    breakdown.savedBoost +
    breakdown.trendingBoost +
    breakdown.editorialBoost

  return {
    venue,
    score: positiveScore - breakdown.distancePenalty,
    distanceMeters,
    visualState: resolveVenueMarkerVisualState({
      selected,
      routeIndex,
      exactNameMatch,
      matchesSearch,
      hasLiveEvent: signals.hasLiveEvent === true,
      hasUpcomingEvent: signals.hasUpcomingEvent === true,
    }),
    breakdown,
  }
}

/**
 * Rank valid venues deterministically.
 *
 * Tie-breaking order:
 * 1. Higher score
 * 2. Shorter distance
 * 3. Stable venue key
 */
export function rankVenues({
  venues,
  center = null,
  searchTerm = '',
  selectedVenueId = null,
  routeIndexByVenueId = EMPTY_NUMBER_MAP,
  liveEventVenueIds = EMPTY_STRING_SET,
  upcomingEventVenueIds = EMPTY_STRING_SET,
  partnerVenueIds = EMPTY_STRING_SET,
  openVenueIds = EMPTY_STRING_SET,
  savedVenueIds = EMPTY_STRING_SET,
  trendingVenueIds = EMPTY_STRING_SET,
  editorialPriorityByVenueId = EMPTY_NUMBER_MAP,
}: RankVenuesInput): ScoredVenue[] {
  return venues
    .filter(hasValidVenueCoordinates)
    .map((venue) => {
      const venueKey = getVenueStableKey(venue)
      const routeIndex = venueKey
        ? routeIndexByVenueId.get(venueKey) ?? null
        : null

      return scoreVenue({
        venue,
        center,
        signals: {
          selected:
            selectedVenueId !== null &&
            venueKey === selectedVenueId,

          routeIndex,
          searchTerm,

          hasLiveEvent:
            venueKey !== null &&
            liveEventVenueIds.has(venueKey),

          hasUpcomingEvent:
            venueKey !== null &&
            upcomingEventVenueIds.has(venueKey),

          isPartner:
            venueKey !== null &&
            partnerVenueIds.has(venueKey),

          isOpenNow:
            venueKey !== null &&
            openVenueIds.has(venueKey),

          isSaved:
            venueKey !== null &&
            savedVenueIds.has(venueKey),

          isTrending:
            venueKey !== null &&
            trendingVenueIds.has(venueKey),

          editorialPriority:
            venueKey !== null
              ? editorialPriorityByVenueId.get(venueKey) ?? 0
              : 0,
        },
      })
    })
    .sort(compareScoredVenues)
}

/**
 * Produce the final venue list for rendering.
 *
 * Critical venues are preserved even when they fall outside the ordinary
 * ranking slice:
 * - selected venue
 * - route stops
 * - explicit search matches
 *
 * The final order remains score-based and deterministic.
 */
export function getRenderedVenues({
  zoom,
  densityMode = getMapDensityMode(zoom),
  renderLimit = getVenueRenderLimit(zoom),
  ...rankInput
}: GetRenderedVenuesInput): ScoredVenue[] {
  if (
    densityMode === 'city-overview' ||
    renderLimit <= 0
  ) {
    return []
  }

  const ranked = rankVenues(rankInput)
  const normalizedSearchTerm = normalizeSearchText(
    rankInput.searchTerm ?? ''
  )

  const critical: ScoredVenue[] = []
  const ordinary: ScoredVenue[] = []

  for (const entry of ranked) {
    const venueKey = getVenueStableKey(entry.venue)

    const isSelected =
      rankInput.selectedVenueId !== null &&
      venueKey === rankInput.selectedVenueId

    const isRouteStop =
      venueKey !== null &&
      rankInput.routeIndexByVenueId?.has(venueKey)

    const isSearchMatch =
      normalizedSearchTerm.length > 0 &&
      venueMatchesSearch(
        entry.venue,
        normalizedSearchTerm
      )

    if (isSelected || isRouteStop || isSearchMatch) {
      critical.push(entry)
    } else {
      ordinary.push(entry)
    }
  }

  const ordinarySlots = Math.max(
    0,
    renderLimit - critical.length
  )

  return [...critical, ...ordinary.slice(0, ordinarySlots)]
    .sort(compareScoredVenues)
}

/**
 * Return one stable key for venue-indexed map state.
 *
 * Database ID remains authoritative. Slug is the only supported fallback.
 * Venue name is intentionally excluded because it is neither unique nor
 * durable.
 */
export function getVenueStableKey(
  venue: Venue
): string | null {
  const id =
    typeof venue.id === 'string'
      ? venue.id.trim()
      : ''

  if (id) return id

  const slug =
    typeof venue.slug === 'string'
      ? venue.slug.trim()
      : ''

  return slug || null
}

/**
 * Build route membership once in MapCanvas rather than repeatedly searching
 * the active route inside every marker render.
 */
export function buildRouteIndexByVenueId(
  route: Venue[]
): Map<string, number> {
  const result = new Map<string, number>()

  route.forEach((venue, index) => {
    const venueKey = getVenueStableKey(venue)

    if (venueKey) {
      result.set(venueKey, index)
    }
  })

  return result
}

/**
 * Convert an event lookup object into a stable venue-key set.
 */
export function buildVenueIdSetFromRecord<T>(
  record: Record<string, T[] | null | undefined>
): Set<string> {
  const result = new Set<string>()

  for (const [venueId, values] of Object.entries(record)) {
    if (Array.isArray(values) && values.length > 0) {
      result.add(venueId)
    }
  }

  return result
}

/**
 * Calculate geographic distance using the Haversine formula.
 */
export function haversineDistanceMeters(
  first: MapPoint,
  second: MapPoint
): number {
  if (
    !isValidMapPoint(first) ||
    !isValidMapPoint(second)
  ) {
    return Number.POSITIVE_INFINITY
  }

  const earthRadiusMeters = 6_371_000

  const firstLatitude = degreesToRadians(first.lat)
  const secondLatitude = degreesToRadians(second.lat)
  const latitudeDelta = degreesToRadians(
    second.lat - first.lat
  )
  const longitudeDelta = degreesToRadians(
    second.lon - first.lon
  )

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )

  return earthRadiusMeters * angularDistance
}

function resolveVenueMarkerVisualState({
  selected,
  routeIndex,
  exactNameMatch,
  matchesSearch,
  hasLiveEvent,
  hasUpcomingEvent,
}: {
  selected: boolean
  routeIndex: number | null
  exactNameMatch: boolean
  matchesSearch: boolean
  hasLiveEvent: boolean
  hasUpcomingEvent: boolean
}): VenueMarkerVisualState {
  if (routeIndex !== null) return 'route-stop'
  if (selected) return 'selected'
  if (exactNameMatch || matchesSearch) return 'search-match'
  if (hasLiveEvent) return 'live-event'
  if (hasUpcomingEvent) return 'upcoming-event'
  return 'default'
}

function compareScoredVenues(
  first: ScoredVenue,
  second: ScoredVenue
): number {
  if (second.score !== first.score) {
    return second.score - first.score
  }

  const firstDistance =
    first.distanceMeters ??
    Number.POSITIVE_INFINITY

  const secondDistance =
    second.distanceMeters ??
    Number.POSITIVE_INFINITY

  if (firstDistance !== secondDistance) {
    return firstDistance - secondDistance
  }

  return getVenueSortKey(first.venue).localeCompare(
    getVenueSortKey(second.venue)
  )
}

function getVenueSortKey(venue: Venue): string {
  return (
    getVenueStableKey(venue) ??
    normalizeSearchText(venue.name ?? '')
  )
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function isValidMapPoint(point: MapPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  )
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

const EMPTY_STRING_SET: ReadonlySet<string> =
  new Set<string>()

const EMPTY_NUMBER_MAP: ReadonlyMap<string, number> =
  new Map<string, number>()