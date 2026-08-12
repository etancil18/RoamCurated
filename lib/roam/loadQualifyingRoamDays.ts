// lib/roam/loadQualifyingRoamDays.ts

import { DateTime } from 'luxon'

import { CITY_CONFIGS } from '@/config/cities'

const ROAM_DAY_BOUNDARY_HOUR = 3
const MIN_QUALIFYING_VENUES = 3
const ROAM_HISTORY_SOURCE_TYPE = 'roam_history'

type SupabaseLikeClient = {
  from: (table: string) => any
}

type LoadQualifyingRoamDaysOptions = {
  supabase: SupabaseLikeClient
  userId: string

  /**
   * Optional maximum number of qualifying roam days to return.
   *
   * This limits the final grouped result, not the raw venue_visits
   * query, so a qualifying historical roam cannot be accidentally
   * truncated mid-day.
   */
  limit?: number

  /**
   * Optional lower bound for visit history.
   *
   * Must be an ISO timestamp.
   */
  visitedAfter?: string | null

  /**
   * Optional upper bound for visit history.
   *
   * Must be an ISO timestamp.
   */
  visitedBefore?: string | null
}

type VenueVisitRow = {
  id: string
  venue_id: string
  visited_at: string
  rating: number | null
  geo_verified: boolean
  check_in_source: string | null
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
  address: string | null
  lat: number | null
  lon: number | null
}

type ExistingRoamSnapshotRow = {
  id: string
  source_id: string
  visibility: 'public' | 'private'
  replayable: boolean
  status: string | null
  created_at: string
}

export type QualifyingRoamStop = {
  visitId: string
  venueId: string
  stopIndex: number
  visitedAt: string
  rating: number | null
  checkInSource: string | null

  venue: {
    id: string
    name: string | null
    city: string | null
    address: string | null
    lat: number | null
    lon: number | null
  }
}

export type QualifyingRoamSnapshot = {
  id: string
  visibility: 'public' | 'private'
  replayable: boolean
  status: string | null
  createdAt: string
}

export type QualifyingRoamDay = {
  /**
   * Stable canonical identifier used as flow_snapshots.source_id.
   *
   * Format:
   *
   *   YYYY-MM-DD__city-key
   *
   * Example:
   *
   *   2026-08-10__atl
   *
   * The date represents the roam day whose local window begins
   * at 03:00 on that date.
   */
  sourceId: string

  /**
   * Canonical local roam-day key.
   */
  roamDay: string

  /**
   * Canonical CITY_CONFIGS key when one can be resolved.
   */
  cityKey: string

  city: string | null
  timezone: string

  /**
   * Exact UTC boundaries corresponding to:
   *
   * local 03:00 -> following local 03:00
   */
  windowStartAt: string
  windowEndAt: string

  firstVisitedAt: string
  lastVisitedAt: string

  distinctVenueCount: number

  /**
   * Canonical ordered distinct venue IDs for this roam.
   *
   * This is derived server-side from append-only venue_visits and
   * preserves the same order as stops.
   */
  venueIds: string[]

  stops: QualifyingRoamStop[]

  snapshot: QualifyingRoamSnapshot | null
  alreadySnapshotted: boolean
}

type MutableRoamGroup = {
  sourceId: string
  roamDay: string
  cityKey: string
  city: string | null
  timezone: string
  windowStartAt: string
  windowEndAt: string
  visits: Array<{
    visit: VenueVisitRow
    venue: VenueRow
  }>
}

/**
 * Load historical visit groups that qualify to become roam-history
 * snapshots.
 *
 * Qualification rules:
 *
 * - visit belongs to the authenticated user supplied by the caller
 * - visit must be geo_verified
 * - visits are grouped using a local 03:00 -> 03:00 roam day
 * - repeated venue IDs within the same roam day count once
 * - venue order follows the earliest actual visited_at for that venue
 * - at least 3 distinct venues are required
 * - existing flow_snapshots are attached read-only
 *
 * This function intentionally performs no writes.
 */
export async function loadQualifyingRoamDays({
  supabase,
  userId,
  limit = 30,
  visitedAfter = null,
  visitedBefore = null,
}: LoadQualifyingRoamDaysOptions): Promise<QualifyingRoamDay[]> {
  const normalizedUserId =
    normalizeRequiredString(userId)

  if (!normalizedUserId) {
    throw new Error(
      '[loadQualifyingRoamDays] Missing userId.'
    )
  }

  const normalizedLimit =
    normalizeResultLimit(limit)

  const normalizedVisitedAfter =
    normalizeOptionalIsoTimestamp(
      visitedAfter
    )

  const normalizedVisitedBefore =
    normalizeOptionalIsoTimestamp(
      visitedBefore
    )

  let visitsQuery = supabase
    .from('venue_visits')
    .select(`
      id,
      venue_id,
      visited_at,
      rating,
      geo_verified,
      check_in_source
    `)
    .eq(
      'user_id',
      normalizedUserId
    )
    .eq(
      'geo_verified',
      true
    )
    .order(
      'visited_at',
      {
        ascending: true,
      }
    )

  if (normalizedVisitedAfter) {
    visitsQuery =
      visitsQuery.gte(
        'visited_at',
        normalizedVisitedAfter
      )
  }

  if (normalizedVisitedBefore) {
    visitsQuery =
      visitsQuery.lt(
        'visited_at',
        normalizedVisitedBefore
      )
  }

  const {
    data: rawVisitRows,
    error: visitsError,
  } = await visitsQuery

  if (visitsError) {
    throw new Error(
      `[loadQualifyingRoamDays] Failed to load venue visits: ${
        visitsError.message ??
        'Unknown database error'
      }`
    )
  }

  const visitRows =
    normalizeVisitRows(
      rawVisitRows
    )

  if (visitRows.length === 0) {
    return []
  }

  const venueIds = [
    ...new Set(
      visitRows.map(
        (visit) =>
          visit.venue_id
      )
    ),
  ]

  const {
    data: rawVenueRows,
    error: venuesError,
  } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      city,
      address,
      lat,
      lon
    `)
    .in(
      'id',
      venueIds
    )

  if (venuesError) {
    throw new Error(
      `[loadQualifyingRoamDays] Failed to load visit venues: ${
        venuesError.message ??
        'Unknown database error'
      }`
    )
  }

  const venueRows =
    normalizeVenueRows(
      rawVenueRows
    )

  const venueById =
    new Map<
      string,
      VenueRow
    >()

  for (const venue of venueRows) {
    venueById.set(
      venue.id,
      venue
    )
  }

  const groups =
    new Map<
      string,
      MutableRoamGroup
    >()

  for (const visit of visitRows) {
    const venue =
      venueById.get(
        visit.venue_id
      )

    /**
     * A deleted/missing venue cannot form a canonical replay stop,
     * so exclude it from qualification rather than returning an
     * incomplete route.
     */
    if (!venue) {
      continue
    }

    const cityResolution =
      resolveVenueCityTimezone(
        venue.city
      )

    if (!cityResolution) {
      /**
       * We cannot safely assign a historical visit to a 03:00 local
       * roam day without a reliable timezone.
       */
      console.warn(
        '[loadQualifyingRoamDays] Skipping visit because venue city has no canonical timezone:',
        {
          visitId:
            visit.id,
          venueId:
            venue.id,
          city:
            venue.city,
        }
      )

      continue
    }

    const roamWindow =
      getRoamWindowForTimestamp({
        timestamp:
          visit.visited_at,
        timezone:
          cityResolution.timezone,
      })

    if (!roamWindow) {
      console.warn(
        '[loadQualifyingRoamDays] Skipping visit with invalid visited_at:',
        {
          visitId:
            visit.id,
          visitedAt:
            visit.visited_at,
        }
      )

      continue
    }

    const sourceId =
      buildRoamHistorySourceId({
        roamDay:
          roamWindow.roamDay,
        cityKey:
          cityResolution.cityKey,
      })

    const existingGroup =
      groups.get(
        sourceId
      )

    if (existingGroup) {
      existingGroup.visits.push({
        visit,
        venue,
      })

      continue
    }

    groups.set(
      sourceId,
      {
        sourceId,

        roamDay:
          roamWindow.roamDay,

        cityKey:
          cityResolution.cityKey,

        city:
          venue.city,

        timezone:
          cityResolution.timezone,

        windowStartAt:
          roamWindow.windowStartAt,

        windowEndAt:
          roamWindow.windowEndAt,

        visits: [
          {
            visit,
            venue,
          },
        ],
      }
    )
  }

  const qualifyingGroups =
    [...groups.values()]
      .map(
        buildQualifyingRoamDayWithoutSnapshot
      )
      .filter(
        (
          group
        ): group is Omit<
          QualifyingRoamDay,
          | 'snapshot'
          | 'alreadySnapshotted'
        > =>
          group !== null
      )
      .sort(
        (
          first,
          second
        ) =>
          Date.parse(
            second.firstVisitedAt
          ) -
          Date.parse(
            first.firstVisitedAt
          )
      )
      .slice(
        0,
        normalizedLimit
      )

  if (
    qualifyingGroups.length ===
    0
  ) {
    return []
  }

  const sourceIds =
    qualifyingGroups.map(
      (group) =>
        group.sourceId
    )

  const {
    data: rawSnapshotRows,
    error: snapshotsError,
  } = await supabase
    .from('flow_snapshots')
    .select(`
      id,
      source_id,
      visibility,
      replayable,
      status,
      created_at
    `)
    .eq(
      'user_id',
      normalizedUserId
    )
    .eq(
      'source_type',
      ROAM_HISTORY_SOURCE_TYPE
    )
    .in(
      'source_id',
      sourceIds
    )

  if (snapshotsError) {
    throw new Error(
      `[loadQualifyingRoamDays] Failed to load existing roam snapshots: ${
        snapshotsError.message ??
        'Unknown database error'
      }`
    )
  }

  const snapshotBySourceId =
    new Map<
      string,
      QualifyingRoamSnapshot
    >()

  for (
    const row
    of normalizeSnapshotRows(
      rawSnapshotRows
    )
  ) {
    snapshotBySourceId.set(
      row.source_id,
      {
        id:
          row.id,

        visibility:
          row.visibility,

        replayable:
          row.replayable,

        status:
          row.status,

        createdAt:
          row.created_at,
      }
    )
  }

  return qualifyingGroups.map(
    (group) => {
      const snapshot =
        snapshotBySourceId.get(
          group.sourceId
        ) ??
        null

      return {
        ...group,

        snapshot,

        alreadySnapshotted:
          Boolean(
            snapshot
          ),
      }
    }
  )
}

/**
 * Parse the canonical source identifier back into its two stable
 * components.
 *
 * This will be useful in the server-side snapshot save resolver,
 * where the browser should provide only source_id and the server
 * must reconstruct the exact visit window itself.
 */
export function parseRoamHistorySourceId(
  sourceId: string
): {
  roamDay: string
  cityKey: string
} | null {
  const normalized =
    normalizeRequiredString(
      sourceId
    )

  if (!normalized) {
    return null
  }

  const separatorIndex =
    normalized.lastIndexOf(
      '__'
    )

  if (
    separatorIndex <= 0 ||
    separatorIndex >=
      normalized.length - 2
  ) {
    return null
  }

  const roamDay =
    normalized.slice(
      0,
      separatorIndex
    )

  const cityKey =
    normalized.slice(
      separatorIndex + 2
    )

  if (
    !isIsoDate(
      roamDay
    ) ||
    !CITY_CONFIGS[
      cityKey
    ]?.timezone
  ) {
    return null
  }

  return {
    roamDay,
    cityKey,
  }
}

/**
 * Produce the exact UTC window represented by a canonical
 * roam-history source ID.
 *
 * Step #13 can reuse this directly rather than accepting venue IDs
 * or timestamps from the browser.
 */
export function getRoamHistorySourceWindow(
  sourceId: string
): {
  sourceId: string
  roamDay: string
  cityKey: string
  city: string
  timezone: string
  windowStartAt: string
  windowEndAt: string
} | null {
  const parsed =
    parseRoamHistorySourceId(
      sourceId
    )

  if (!parsed) {
    return null
  }

  const config =
    CITY_CONFIGS[
      parsed.cityKey
    ]

  if (!config?.timezone) {
    return null
  }

  const localStart =
    DateTime.fromISO(
      parsed.roamDay,
      {
        zone:
          config.timezone,
      }
    ).set({
      hour:
        ROAM_DAY_BOUNDARY_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    })

  if (!localStart.isValid) {
    return null
  }

  const localEnd =
    localStart.plus({
      days: 1,
    })

  return {
    sourceId,

    roamDay:
      parsed.roamDay,

    cityKey:
      parsed.cityKey,

    city:
      config.name,

    timezone:
      config.timezone,

    windowStartAt:
      localStart
        .toUTC()
        .toISO()!,

    windowEndAt:
      localEnd
        .toUTC()
        .toISO()!,
  }
}

function buildQualifyingRoamDayWithoutSnapshot(
  group: MutableRoamGroup
): Omit<
  QualifyingRoamDay,
  | 'snapshot'
  | 'alreadySnapshotted'
> | null {
  const orderedVisits =
    [...group.visits].sort(
      (
        first,
        second
      ) =>
        Date.parse(
          first.visit.visited_at
        ) -
        Date.parse(
          second.visit.visited_at
        )
    )

  /**
   * Only the first qualifying visit to a venue within the roam day
   * becomes a route stop.
   *
   * Example:
   *
   * A -> B -> A -> C
   *
   * becomes:
   *
   * A -> B -> C
   */
  const seenVenueIds =
    new Set<string>()

  const stops:
    QualifyingRoamStop[] =
    []

  for (
    const entry
    of orderedVisits
  ) {
    if (
      seenVenueIds.has(
        entry.visit.venue_id
      )
    ) {
      continue
    }

    seenVenueIds.add(
      entry.visit.venue_id
    )

    stops.push({
      visitId:
        entry.visit.id,

      venueId:
        entry.visit.venue_id,

      stopIndex:
        stops.length,

      visitedAt:
        entry.visit.visited_at,

      rating:
        entry.visit.rating,

      checkInSource:
        entry.visit.check_in_source,

      venue: {
        id:
          entry.venue.id,

        name:
          entry.venue.name,

        city:
          entry.venue.city,

        address:
          entry.venue.address,

        lat:
          entry.venue.lat,

        lon:
          entry.venue.lon,
      },
    })
  }

  if (
    stops.length <
    MIN_QUALIFYING_VENUES
  ) {
    return null
  }

  return {
    sourceId:
      group.sourceId,

    roamDay:
      group.roamDay,

    cityKey:
      group.cityKey,

    city:
      group.city,

    timezone:
      group.timezone,

    windowStartAt:
      group.windowStartAt,

    windowEndAt:
      group.windowEndAt,

    firstVisitedAt:
      stops[0].visitedAt,

    lastVisitedAt:
      stops[
        stops.length - 1
      ].visitedAt,

    distinctVenueCount:
      stops.length,

    /*
     * Snapshot save consumes this canonical ordered list directly.
     *
     * It is derived from the same deduplicated stop evidence above,
     * so the browser never supplies canonical roam venue IDs.
     */
    venueIds:
      stops.map(
        (stop) =>
          stop.venueId
      ),

    stops,
  }
}

function getRoamWindowForTimestamp({
  timestamp,
  timezone,
}: {
  timestamp: string
  timezone: string
}): {
  roamDay: string
  windowStartAt: string
  windowEndAt: string
} | null {
  const localTime =
    DateTime.fromISO(
      timestamp,
      {
        setZone: true,
      }
    ).setZone(
      timezone
    )

  if (!localTime.isValid) {
    return null
  }

  /**
   * Simple 03:00 boundary:
   *
   * shifting local time backward by three hours makes everything
   * from midnight through 02:59 belong to the preceding date.
   */
  const roamDay =
    localTime
      .minus({
        hours:
          ROAM_DAY_BOUNDARY_HOUR,
      })
      .toISODate()

  if (!roamDay) {
    return null
  }

  const localWindowStart =
    DateTime.fromISO(
      roamDay,
      {
        zone:
          timezone,
      }
    ).set({
      hour:
        ROAM_DAY_BOUNDARY_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    })

  if (
    !localWindowStart.isValid
  ) {
    return null
  }

  const localWindowEnd =
    localWindowStart.plus({
      days: 1,
    })

  const windowStartAt =
    localWindowStart
      .toUTC()
      .toISO()

  const windowEndAt =
    localWindowEnd
      .toUTC()
      .toISO()

  if (
    !windowStartAt ||
    !windowEndAt
  ) {
    return null
  }

  return {
    roamDay,
    windowStartAt,
    windowEndAt,
  }
}

function buildRoamHistorySourceId({
  roamDay,
  cityKey,
}: {
  roamDay: string
  cityKey: string
}) {
  return `${roamDay}__${cityKey}`
}

function resolveVenueCityTimezone(
  rawCity: string | null
): {
  cityKey: string
  timezone: string
} | null {
  const normalizedCity =
    normalizeCityValue(
      rawCity
    )

  if (!normalizedCity) {
    return null
  }

  if (
    CITY_CONFIGS[
      normalizedCity
    ]?.timezone
  ) {
    return {
      cityKey:
        normalizedCity,

      timezone:
        CITY_CONFIGS[
          normalizedCity
        ].timezone,
    }
  }

  /**
   * Support venue rows that store the display city name rather than
   * the canonical CITY_CONFIGS key.
   */
  for (
    const [
      cityKey,
      config,
    ]
    of Object.entries(
      CITY_CONFIGS
    )
  ) {
    if (
      normalizeCityValue(
        config.name
      ) ===
      normalizedCity
    ) {
      return {
        cityKey,

        timezone:
          config.timezone,
      }
    }
  }

  return null
}

function normalizeCityValue(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const trimmed =
    value
      .trim()
      .toLowerCase()

  if (!trimmed) {
    return null
  }

  const aliases:
    Record<
      string,
      string
    > = {
      atlanta:
        'atl',

      'new york':
        'nyc',

      'new york city':
        'nyc',

      'new-york':
        'nyc',

      'new-york-city':
        'nyc',

      newyork:
        'nyc',

      'los angeles':
        'la',

      'los-angeles':
        'la',

      losangeles:
        'la',

      miami:
        'mia',

      london:
        'london',

      lisbon:
        'lisbon',

      porto:
        'porto',

      rome:
        'rome',

      paris:
        'paris',
    }

  return (
    aliases[
      trimmed
    ] ??
    trimmed
  )
}

function normalizeVisitRows(
  value: unknown
): VenueVisitRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows:
    VenueVisitRow[] =
    []

  for (const raw of value) {
    if (
      !raw ||
      typeof raw !==
        'object'
    ) {
      continue
    }

    const row =
      raw as Record<
        string,
        unknown
      >

    if (
      typeof row.id !==
        'string' ||
      typeof row.venue_id !==
        'string' ||
      typeof row.visited_at !==
        'string' ||
      row.geo_verified !==
        true
    ) {
      continue
    }

    if (
      !Number.isFinite(
        Date.parse(
          row.visited_at
        )
      )
    ) {
      continue
    }

    rows.push({
      id:
        row.id,

      venue_id:
        row.venue_id,

      visited_at:
        row.visited_at,

      rating:
        typeof row.rating ===
          'number'
          ? row.rating
          : null,

      geo_verified:
        true,

      check_in_source:
        typeof row.check_in_source ===
          'string'
          ? row.check_in_source
          : null,
    })
  }

  return rows
}

function normalizeVenueRows(
  value: unknown
): VenueRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows:
    VenueRow[] =
    []

  for (const raw of value) {
    if (
      !raw ||
      typeof raw !==
        'object'
    ) {
      continue
    }

    const row =
      raw as Record<
        string,
        unknown
      >

    if (
      typeof row.id !==
      'string'
    ) {
      continue
    }

    rows.push({
      id:
        row.id,

      name:
        typeof row.name ===
          'string'
          ? row.name
          : null,

      city:
        typeof row.city ===
          'string'
          ? row.city
          : null,

      address:
        typeof row.address ===
          'string'
          ? row.address
          : null,

      lat:
        typeof row.lat ===
          'number' &&
        Number.isFinite(
          row.lat
        )
          ? row.lat
          : null,

      lon:
        typeof row.lon ===
          'number' &&
        Number.isFinite(
          row.lon
        )
          ? row.lon
          : null,
    })
  }

  return rows
}

function normalizeSnapshotRows(
  value: unknown
): ExistingRoamSnapshotRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows:
    ExistingRoamSnapshotRow[] =
    []

  for (const raw of value) {
    if (
      !raw ||
      typeof raw !==
        'object'
    ) {
      continue
    }

    const row =
      raw as Record<
        string,
        unknown
      >

    if (
      typeof row.id !==
        'string' ||
      typeof row.source_id !==
        'string' ||
      typeof row.created_at !==
        'string'
    ) {
      continue
    }

    if (
      row.visibility !==
        'public' &&
      row.visibility !==
        'private'
    ) {
      continue
    }

    rows.push({
      id:
        row.id,

      source_id:
        row.source_id,

      visibility:
        row.visibility,

      replayable:
        row.replayable ===
        true,

      status:
        typeof row.status ===
          'string'
          ? row.status
          : null,

      created_at:
        row.created_at,
    })
  }

  return rows
}

function normalizeRequiredString(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const trimmed =
    value.trim()

  return trimmed
    ? trimmed
    : null
}

function normalizeOptionalIsoTimestamp(
  value:
    | string
    | null
    | undefined
): string | null {
  if (!value) {
    return null
  }

  const trimmed =
    value.trim()

  if (!trimmed) {
    return null
  }

  const timestamp =
    Date.parse(
      trimmed
    )

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    throw new Error(
      `[loadQualifyingRoamDays] Invalid ISO timestamp: ${value}`
    )
  }

  return new Date(
    timestamp
  ).toISOString()
}

function normalizeResultLimit(
  value: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 30
  }

  return Math.max(
    1,
    Math.min(
      100,
      Math.floor(
        value
      )
    )
  )
}

function isIsoDate(
  value: string
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  return DateTime.fromISO(
    value
  ).isValid
}