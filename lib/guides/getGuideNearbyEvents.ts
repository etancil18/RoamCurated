// lib/guides/getGuideNearbyEvents.ts

import 'server-only'

import { normalizeGuideAssetUrl } from '@/lib/guides/normalizeGuideAssetUrl'

import {
  getNearbyVenuesData,
  type NearbyVenue,
  type RoamCity,
} from '@/lib/property/getNearbyVenues'

import {
  buildNearbyEventVM,
  type NearbyEventInput,
  type NearbyEventVM,
} from '@/lib/view-models/buildNearbyEventVM'

import { createServerClient } from '@/lib/supabase/server'

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_RADIUS_METERS = 1_600
const DEFAULT_LIMIT = 12
const DEFAULT_NEARBY_VENUE_LIMIT = 250
const DEFAULT_EVENT_CANDIDATE_LIMIT = 1_000

const DEFAULT_LOOKBACK_MINUTES = 360
const DEFAULT_LOOKAHEAD_DAYS = 30

const MIN_RADIUS_METERS = 1
const MAX_RADIUS_METERS = 50_000

const MIN_LIMIT = 1
const MAX_LIMIT = 100

const MIN_NEARBY_VENUE_LIMIT = 1
const MAX_NEARBY_VENUE_LIMIT = 500

const MIN_EVENT_CANDIDATE_LIMIT = 1
const MAX_EVENT_CANDIDATE_LIMIT = 5_000

const MIN_LOOKBACK_MINUTES = 0
const MAX_LOOKBACK_MINUTES = 10_080

const MIN_LOOKAHEAD_DAYS = 1
const MAX_LOOKAHEAD_DAYS = 365

const EVENT_VENUE_ID_CHUNK_SIZE = 200

const MILLISECONDS_PER_MINUTE = 60_000
const MILLISECONDS_PER_DAY = 86_400_000

/* ------------------------------------------------ */
/* Public input                                     */
/* ------------------------------------------------ */

export type GetGuideNearbyEventsParams = {
  /**
   * Property used to resolve the nearby-event origin.
   *
   * Required unless explicit lat and lon coordinates are supplied.
   */
  propertyId?: string | null

  /**
   * Explicit latitude used instead of property coordinates.
   *
   * Must be supplied together with lon.
   */
  lat?: number | string | null

  /**
   * Explicit longitude used instead of property coordinates.
   *
   * Must be supplied together with lat.
   */
  lon?: number | string | null

  /**
   * Optional exact Roam city filter forwarded to getNearbyVenuesData().
   *
   * Supported values are defined by getNearbyVenues.ts.
   */
  city?: RoamCity | string | null

  /**
   * Nearby venue search radius.
   *
   * Defaults to 1,600 meters.
   */
  radiusMeters?: number

  /**
   * Maximum number of event cards returned.
   *
   * Defaults to 12.
   */
  limit?: number

  /**
   * Maximum number of nearby venues considered for event discovery.
   *
   * Defaults to 250.
   */
  nearbyVenueLimit?: number

  /**
   * Maximum number of event rows loaded before VM filtering and sorting.
   *
   * Defaults to 1,000.
   */
  eventCandidateLimit?: number

  /**
   * Allows recently started events to be loaded so currently live events
   * are not excluded.
   *
   * Defaults to six hours.
   */
  lookbackMinutes?: number

  /**
   * Maximum future event horizon.
   *
   * Defaults to 30 days.
   */
  lookaheadDays?: number

  /**
   * Timestamp used for event-window filtering and presentation labels.
   */
  now?: Date

  /**
   * Fallback timezone used when an event row has no valid timezone.
   */
  defaultTimezone?: string | null

  /**
   * Locale forwarded to buildNearbyEventVM().
   */
  locale?: string

  /**
   * Maximum number of ordinary event tags represented as chips.
   */
  maxTagChips?: number

  /**
   * Whether inactive events should be loaded.
   *
   * Public guides should leave this false.
   * Intended primarily for authenticated preview and diagnostics.
   */
  includeInactive?: boolean

  /**
   * Whether events already classified as ended should be included.
   *
   * Public guides should normally leave this false.
   */
  includeEnded?: boolean

  /**
   * Venue IDs that should be excluded from event discovery.
   */
  excludeVenueIds?: string[]

  /**
   * Event IDs that should not be returned.
   */
  excludeEventIds?: string[]

  /**
   * Optional additional presentation-level eligibility predicate.
   *
   * Runs after buildNearbyEventVM() and before final sorting and limiting.
   */
  filter?: (event: NearbyEventVM) => boolean
}

/* ------------------------------------------------ */
/* Public result                                    */
/* ------------------------------------------------ */

export type GuideNearbyEventsData = {
  events: NearbyEventVM[]

  radiusMeters: number

  /**
   * Nearby venues returned by the shared geographic loader.
   */
  nearbyVenueCount: number

  /**
   * Nearby venues that currently have at least one loaded event candidate.
   */
  eventVenueCount: number

  /**
   * Event rows loaded before normalization and final filtering.
   */
  eventCandidateCount: number

  /**
   * Number of presentation-ready events returned after filtering and limit.
   */
  eventCount: number

  windowStart: string
  windowEnd: string
}

/* ------------------------------------------------ */
/* Database contracts                               */
/* ------------------------------------------------ */

type EventRow = {
  id: unknown
  venue_id: unknown

  title: unknown
  source: unknown
  permalink: unknown

  starts_at: unknown
  ends_at: unknown

  description: unknown
  tags: unknown

  price_info: unknown
  source_type: unknown
  timezone: unknown

  created_at: unknown
  updated_at: unknown

  is_active: unknown
  ticket_link: unknown
  social_group_id: unknown

  xp_reward: unknown
  checkin_enabled: unknown
  archetype: unknown

  [key: string]: unknown
}

/* ------------------------------------------------ */
/* Public API                                       */
/* ------------------------------------------------ */

/**
 * Returns presentation-ready nearby event view models.
 */
export async function getGuideNearbyEvents(
  params: GetGuideNearbyEventsParams
): Promise<NearbyEventVM[]> {
  const data = await getGuideNearbyEventsData(params)

  return data.events
}

/**
 * Loads nearby events for one property-guide origin.
 *
 * Processing sequence:
 *
 * 1. Resolve nearby venues through getNearbyVenuesData().
 * 2. Query active event rows whose venue_id belongs to those venues.
 * 3. Restrict events to the configured time window.
 * 4. Attach each event to its resolved nearby venue.
 * 5. Convert each pair through buildNearbyEventVM().
 * 6. Exclude inactive, ended, malformed, and explicitly excluded events.
 * 7. Sort live events first, then upcoming events chronologically.
 * 8. Apply the configured presentation limit.
 */
export async function getGuideNearbyEventsData(
  params: GetGuideNearbyEventsParams
): Promise<GuideNearbyEventsData> {
  const now = normalizeDate(params.now)

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

  const nearbyVenueLimit = normalizeIntegerWithinRange({
    value: params.nearbyVenueLimit,
    fallback: DEFAULT_NEARBY_VENUE_LIMIT,
    minimum: MIN_NEARBY_VENUE_LIMIT,
    maximum: MAX_NEARBY_VENUE_LIMIT,
  })

  const eventCandidateLimit = normalizeIntegerWithinRange({
    value: params.eventCandidateLimit,
    fallback: DEFAULT_EVENT_CANDIDATE_LIMIT,
    minimum: MIN_EVENT_CANDIDATE_LIMIT,
    maximum: MAX_EVENT_CANDIDATE_LIMIT,
  })

  const lookbackMinutes = normalizeIntegerWithinRange({
    value: params.lookbackMinutes,
    fallback: DEFAULT_LOOKBACK_MINUTES,
    minimum: MIN_LOOKBACK_MINUTES,
    maximum: MAX_LOOKBACK_MINUTES,
  })

  const lookaheadDays = normalizeIntegerWithinRange({
    value: params.lookaheadDays,
    fallback: DEFAULT_LOOKAHEAD_DAYS,
    minimum: MIN_LOOKAHEAD_DAYS,
    maximum: MAX_LOOKAHEAD_DAYS,
  })

  const windowStart = new Date(
    now.getTime() -
      lookbackMinutes * MILLISECONDS_PER_MINUTE
  )

  const windowEnd = new Date(
    now.getTime() +
      lookaheadDays * MILLISECONDS_PER_DAY
  )

  const nearbyData = await getNearbyVenuesData({
    propertyId: params.propertyId,
    lat: params.lat,
    lon: params.lon,
    city: params.city,
    radiusMeters,
    limit: nearbyVenueLimit,
    excludeVenueIds: params.excludeVenueIds,
  })

  const nearbyVenues = nearbyData.venues

  if (nearbyVenues.length === 0) {
    return buildEmptyResult({
      radiusMeters,
      nearbyVenueCount: 0,
      windowStart,
      windowEnd,
    })
  }

  const venueById = new Map(
    nearbyVenues.map((venue) => [
      venue.id,
      venue,
    ])
  )

  const eventRows = await loadNearbyEventRows({
    venueIds: nearbyVenues.map((venue) => venue.id),
    windowStart,
    windowEnd,
    includeInactive: params.includeInactive === true,
    candidateLimit: eventCandidateLimit,
  })

  const excludedEventIds = new Set(
    uniqueStrings(params.excludeEventIds ?? [])
  )

  const events: NearbyEventVM[] = []

  for (const row of eventRows) {
    const normalizedEvent = normalizeEventInput(row)

    if (!normalizedEvent) {
      continue
    }

    if (excludedEventIds.has(normalizedEvent.id)) {
      continue
    }

    const venueId =
      cleanText(normalizedEvent.venueId) ??
      cleanText(normalizedEvent.venue_id)

    if (!venueId) {
      continue
    }

    const venue = venueById.get(venueId)

    if (!venue) {
      continue
    }

    let eventVM: NearbyEventVM

    try {
      eventVM = buildNearbyEventVM({
        event: normalizedEvent,
        venue: buildEventVenueInput(venue),
        now,
        defaultTimezone: params.defaultTimezone,
        locale: params.locale,
        maxTagChips: params.maxTagChips,
      })
    } catch {
      /*
       * One malformed event must not make the entire guide unavailable.
       *
       * Invalid rows are skipped here after strict normalization and the
       * view-model builder's own required-field validation.
       */
      continue
    }

    if (
      !params.includeInactive &&
      eventVM.timing.status === 'inactive'
    ) {
      continue
    }

    if (
      !params.includeEnded &&
      eventVM.timing.status === 'ended'
    ) {
      continue
    }

    if (
      params.filter &&
      !params.filter(eventVM)
    ) {
      continue
    }

    events.push(eventVM)
  }

  const visibleEvents = deduplicateEvents(events)
    .sort(compareNearbyEvents)
    .slice(0, limit)

  const eventVenueCount = new Set(
    eventRows
      .map((row) => cleanText(row.venue_id))
      .filter(
        (venueId): venueId is string =>
          venueId !== null &&
          venueById.has(venueId)
      )
  ).size

  return {
    events: visibleEvents,

    radiusMeters: nearbyData.radiusMeters,

    nearbyVenueCount:
      nearbyData.nearbyVenueCount,

    eventVenueCount,

    eventCandidateCount:
      eventRows.length,

    eventCount:
      visibleEvents.length,

    windowStart:
      windowStart.toISOString(),

    windowEnd:
      windowEnd.toISOString(),
  }
}

/* ------------------------------------------------ */
/* Event loading                                    */
/* ------------------------------------------------ */

async function loadNearbyEventRows({
  venueIds,
  windowStart,
  windowEnd,
  includeInactive,
  candidateLimit,
}: {
  venueIds: string[]
  windowStart: Date
  windowEnd: Date
  includeInactive: boolean
  candidateLimit: number
}): Promise<EventRow[]> {
  const normalizedVenueIds =
    uniqueStrings(venueIds)

  if (normalizedVenueIds.length === 0) {
    return []
  }

  const supabase = await createServerClient()

  const venueIdChunks = chunkArray(
    normalizedVenueIds,
    EVENT_VENUE_ID_CHUNK_SIZE
  )

  const perChunkLimit = Math.max(
    1,
    Math.ceil(
      candidateLimit /
        venueIdChunks.length
    )
  )

  const results = await Promise.all(
    venueIdChunks.map(async (venueIdChunk) => {
      let query = supabase
        .from('events')
        .select(
          [
            'id',
            'venue_id',
            'title',
            'source',
            'permalink',
            'starts_at',
            'ends_at',
            'description',
            'tags',
            'price_info',
            'source_type',
            'timezone',
            'created_at',
            'updated_at',
            'is_active',
            'ticket_link',
            'social_group_id',
            'xp_reward',
            'checkin_enabled',
            'archetype',
          ].join(',')
        )
        .in('venue_id', venueIdChunk)
        .not('starts_at', 'is', null)
        .lte(
          'starts_at',
          windowEnd.toISOString()
        )
        .or(
          [
            `starts_at.gte.${windowStart.toISOString()}`,
            `ends_at.gte.${windowStart.toISOString()}`,
          ].join(',')
        )
        .order('starts_at', {
          ascending: true,
        })
        .limit(perChunkLimit)

      if (!includeInactive) {
        query = query.eq(
          'is_active',
          true
        )
      }

      const { data, error } = await query

      if (error) {
        throw new Error(
          `Failed to load nearby guide events: ${error.message}`
        )
      }

      return rowsFrom<EventRow>(data)
    })
  )

  return results
    .flat()
    .sort(compareEventRows)
    .slice(0, candidateLimit)
}

/* ------------------------------------------------ */
/* Event normalization                              */
/* ------------------------------------------------ */

function normalizeEventInput(
  row: EventRow
): NearbyEventInput | null {
  const id = cleanText(row.id)
  const venueId = cleanText(row.venue_id)
  const startsAt = toIsoString(row.starts_at)

  if (
    !id ||
    !venueId ||
    !startsAt
  ) {
    return null
  }

  return {
    id,
    venueId,

    title: cleanText(row.title),
    source: cleanText(row.source),
    permalink: normalizeHref(row.permalink),

    startsAt,
    endsAt: toIsoString(row.ends_at),

    description: cleanText(row.description),
    tags: normalizeTags(row.tags),

    priceInfo: cleanText(row.price_info),
    sourceType: cleanText(row.source_type),
    timezone: cleanText(row.timezone),

    isActive: toBoolean(
      row.is_active,
      true
    ),

    ticketLink: normalizeHref(
      row.ticket_link
    ),

    socialGroupId: cleanText(
      row.social_group_id
    ),

    xpReward: toNonNegativeInteger(
      row.xp_reward,
      0
    ),

    checkinEnabled: toBoolean(
      row.checkin_enabled,
      false
    ),

    archetype: cleanText(row.archetype),
  }
}

/* ------------------------------------------------ */
/* Venue adaptation                                 */
/* ------------------------------------------------ */

function buildEventVenueInput(
  venue: NearbyVenue
) {
  return {
    id: venue.id,
    name: venue.name,

    city: venue.city,
    slug: venue.slug,
    link: venue.link,

    address: cleanText(
      venue.raw.address
    ),

    cover: normalizeGuideAssetUrl(
      venue.cover
    ),

    description: venue.description,
    type: venue.type,

    lat: venue.lat,
    lon: venue.lon,

    distanceMeters:
      venue.distanceMeters,
  }
}

/* ------------------------------------------------ */
/* Sorting                                          */
/* ------------------------------------------------ */

function compareNearbyEvents(
  a: NearbyEventVM,
  b: NearbyEventVM
): number {
  const aStatusRank =
    getEventStatusRank(a)

  const bStatusRank =
    getEventStatusRank(b)

  if (aStatusRank !== bStatusRank) {
    return aStatusRank - bStatusRank
  }

  const aStartsAt =
    toTimestamp(a.timing.startsAt)

  const bStartsAt =
    toTimestamp(b.timing.startsAt)

  if (aStartsAt !== bStartsAt) {
    return aStartsAt - bStartsAt
  }

  const aDistance =
    a.venue.distanceMeters ??
    Number.POSITIVE_INFINITY

  const bDistance =
    b.venue.distanceMeters ??
    Number.POSITIVE_INFINITY

  if (aDistance !== bDistance) {
    return aDistance - bDistance
  }

  const titleComparison =
    a.title.localeCompare(
      b.title,
      undefined,
      {
        sensitivity: 'base',
      }
    )

  if (titleComparison !== 0) {
    return titleComparison
  }

  return a.id.localeCompare(b.id)
}

function getEventStatusRank(
  event: NearbyEventVM
): number {
  switch (event.timing.status) {
    case 'live':
      return 0

    case 'upcoming':
      return 1

    case 'unscheduled':
      return 2

    case 'ended':
      return 3

    case 'inactive':
      return 4

    default:
      return 5
  }
}

function compareEventRows(
  a: EventRow,
  b: EventRow
): number {
  const aStartsAt =
    toTimestamp(a.starts_at)

  const bStartsAt =
    toTimestamp(b.starts_at)

  if (aStartsAt !== bStartsAt) {
    return aStartsAt - bStartsAt
  }

  const aId = cleanText(a.id) ?? ''
  const bId = cleanText(b.id) ?? ''

  return aId.localeCompare(bId)
}

/* ------------------------------------------------ */
/* Deduplication                                    */
/* ------------------------------------------------ */

function deduplicateEvents(
  events: NearbyEventVM[]
): NearbyEventVM[] {
  const seenIds = new Set<string>()
  const deduplicated: NearbyEventVM[] = []

  for (const event of events) {
    if (seenIds.has(event.id)) {
      continue
    }

    seenIds.add(event.id)
    deduplicated.push(event)
  }

  return deduplicated
}

/* ------------------------------------------------ */
/* Empty result                                     */
/* ------------------------------------------------ */

function buildEmptyResult({
  radiusMeters,
  nearbyVenueCount,
  windowStart,
  windowEnd,
}: {
  radiusMeters: number
  nearbyVenueCount: number
  windowStart: Date
  windowEnd: Date
}): GuideNearbyEventsData {
  return {
    events: [],

    radiusMeters,
    nearbyVenueCount,

    eventVenueCount: 0,
    eventCandidateCount: 0,
    eventCount: 0,

    windowStart:
      windowStart.toISOString(),

    windowEnd:
      windowEnd.toISOString(),
  }
}

/* ------------------------------------------------ */
/* Tag normalization                                */
/* ------------------------------------------------ */

function normalizeTags(
  value: unknown
): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value
        .map(cleanText)
        .filter(
          (entry): entry is string =>
            entry !== null
        )
    )
  }

  const text = cleanText(value)

  if (!text) {
    return []
  }

  /*
   * Supports JSON-string arrays as well as simple comma-separated values.
   */
  try {
    const parsed = JSON.parse(text)

    if (Array.isArray(parsed)) {
      return uniqueStrings(
        parsed
          .map(cleanText)
          .filter(
            (entry): entry is string =>
              entry !== null
          )
      )
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return uniqueStrings(
    text
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
}

/* ------------------------------------------------ */
/* Date helpers                                     */
/* ------------------------------------------------ */

function normalizeDate(
  value: Date | undefined
): Date {
  if (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  ) {
    return new Date(value.getTime())
  }

  return new Date()
}

function toIsoString(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    !(value instanceof Date)
  ) {
    return null
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function toTimestamp(
  value: unknown
): number {
  const isoString = toIsoString(value)

  if (!isoString) {
    return Number.POSITIVE_INFINITY
  }

  return new Date(isoString).getTime()
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

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

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeHref(
  value: unknown
): string | null {
  const href = cleanText(value)

  if (!href) {
    return null
  }

  if (
    href.startsWith('/') ||
    href.startsWith('https://') ||
    href.startsWith('http://')
  ) {
    return href
  }

  return null
}

function toBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .toLowerCase()

    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes'
    ) {
      return true
    }

    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no'
    ) {
      return false
    }
  }

  return fallback
}

function toNonNegativeInteger(
  value: unknown,
  fallback: number
): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.max(
    0,
    Math.trunc(numericValue)
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

function uniqueStrings(
  values: Array<
    string | null | undefined
  >
): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const normalized = cleanText(value)

    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(normalized)
  }

  return output
}

function chunkArray<T>(
  values: T[],
  size: number
): T[][] {
  const normalizedSize = Math.max(
    1,
    Math.trunc(size)
  )

  const chunks: T[][] = []

  for (
    let index = 0;
    index < values.length;
    index += normalizedSize
  ) {
    chunks.push(
      values.slice(
        index,
        index + normalizedSize
      )
    )
  }

  return chunks
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