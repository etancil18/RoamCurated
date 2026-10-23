
import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import { createClient } from '@supabase/supabase-js'

import {
  evaluateExploreVenueEligibility,
} from '@/lib/explore/venueEligibility'

import {
  EXPLORE_TRENDING_WINDOW_DAYS,
  rankExploreTrendingVenues,
  type ExploreTrendingVenueAggregate,
} from '@/lib/explore/trending'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* =========================================================
 * Configuration
 * ======================================================= */

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
}

const PUBLIC_VENUE_COLUMNS =
  'id,name,city,cover,type,vibe,tags,lat,lon' as const

/* =========================================================
 * Database result contracts
 * ======================================================= */

type TrendingDatabaseRow = {
  venue_id: unknown
  current_unique_visitors: unknown
  previous_unique_visitors: unknown
  current_verified_visits: unknown
  previous_verified_visits: unknown
  recent_verified_visits: unknown
  last_verified_visit_at: unknown
}

type TrendingVenueMetadata = {
  id: unknown
  name: unknown
  city: unknown
  cover: unknown
  type: unknown
  vibe: unknown
  tags: unknown
  lat: unknown
  lon: unknown
}

/* =========================================================
 * Public response contracts
 * ======================================================= */

type PublicTrendingVenue = {
  id: string
  name: string
  city: string
  cover: string | null
  type: string[]
  vibe: string[]
  tags: string[]

  lat: number | null
  lon: number | null

  rank: number
  score: number

  currentUniqueVisitors: number
  previousUniqueVisitors: number

  currentVerifiedVisits: number
  previousVerifiedVisits: number

  recentVerifiedVisits: number

  growth: {
    absoluteChange: number
    percentageChange: number | null
    newActivity: boolean
  }

  lastVerifiedVisitAt: string

  profileHref: string
  flowBuilderHref: string
}

type TrendingResponseStatus =
  | 'trending'
  | 'insufficient_data'

/* =========================================================
 * Response helpers
 * ======================================================= */

function jsonResponse(
  body: unknown,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

function insufficientDataResponse(
  asOf: string
) {
  return jsonResponse({
    status: 'insufficient_data' as TrendingResponseStatus,
    venues: [] as PublicTrendingVenue[],
    count: 0,
    windowDays: EXPLORE_TRENDING_WINDOW_DAYS,
    asOf,
  })
}

/* =========================================================
 * Server-only Supabase client
 * ======================================================= */

/**
 * Uses the service-role key exclusively on the server.
 *
 * This key must never be exposed to client components,
 * browser bundles, or NEXT_PUBLIC_* environment variables.
 *
 * We intentionally do not use a cookie/session-based
 * client: the SQL function is accessible only to
 * service_role.
 */
function createTrendingSupabaseClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Explore trending database configuration is missing.'
    )
  }

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

/* =========================================================
 * Aggregate parsing
 * ======================================================= */

/**
 * PostgreSQL bigint values may arrive as numbers or
 * decimal strings, depending on the transport.
 *
 * We only accept nonnegative safe integers.
 *
 * Never silently round, truncate, or clamp counts:
 * doing so could change a venue's trending eligibility.
 */
function parseSafeCount(
  value: unknown
): number | null {
  if (typeof value === 'number') {
    return (
      Number.isSafeInteger(value) &&
      value >= 0
    )
      ? value
      : null
  }

  if (typeof value !== 'string') {
    return null
  }

  if (!/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number(value)

  return (
    Number.isSafeInteger(parsed) &&
    parsed >= 0
  )
    ? parsed
    : null
}

/**
 * Parse one aggregate row into the exact input type
 * expected by lib/explore/trending.ts.
 *
 * All columns are validated before being scored.
 */
function parseAggregate(
  row: TrendingDatabaseRow
): ExploreTrendingVenueAggregate | null {
  if (
    typeof row.venue_id !== 'string' ||
    !row.venue_id.trim()
  ) {
    return null
  }

  const currentUniqueVisitors = parseSafeCount(
    row.current_unique_visitors
  )

  const previousUniqueVisitors = parseSafeCount(
    row.previous_unique_visitors
  )

  const currentVerifiedVisits = parseSafeCount(
    row.current_verified_visits
  )

  const previousVerifiedVisits = parseSafeCount(
    row.previous_verified_visits
  )

  const recentVerifiedVisits = parseSafeCount(
    row.recent_verified_visits
  )

  if (
    currentUniqueVisitors === null ||
    previousUniqueVisitors === null ||
    currentVerifiedVisits === null ||
    previousVerifiedVisits === null ||
    recentVerifiedVisits === null
  ) {
    return null
  }

  if (
    currentUniqueVisitors > currentVerifiedVisits ||
    previousUniqueVisitors > previousVerifiedVisits ||
    recentVerifiedVisits > currentVerifiedVisits
  ) {
    return null
  }

  const timestamp = row.last_verified_visit_at

  if (
    timestamp !== null &&
    (
      typeof timestamp !== 'string' ||
      !Number.isFinite(Date.parse(timestamp))
    )
  ) {
    return null
  }

  if (
    currentVerifiedVisits > 0 &&
    timestamp === null
  ) {
    return null
  }

  if (
    currentVerifiedVisits === 0 &&
    timestamp !== null
  ) {
    return null
  }

  return {
    venueId: row.venue_id.trim(),

    currentUniqueVisitors,
    previousUniqueVisitors,

    currentVerifiedVisits,
    previousVerifiedVisits,

    recentVerifiedVisits,

    lastVerifiedVisitAt: timestamp,
  }
}

/* =========================================================
 * Venue metadata normalization
 * ======================================================= */

function optionalText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  return normalized || null
}

function stringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const output: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    for (const part of item.split(',')) {
      const normalized = part.trim()

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
  }

  return output
}

/* =========================================================
 * Request validation
 * ======================================================= */

function parseLimit(
  value: string | null
): number | null {
  if (value === null) {
    return DEFAULT_LIMIT
  }

  const normalized = value.trim()

  if (!/^[1-9]\d*$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > MAX_LIMIT
  ) {
    return null
  }

  return parsed
}

/* =========================================================
 * GET /api/explore/trending
 *
 * Public route.
 *
 * Database aggregation is performed through a private
 * service-role-only SQL function.
 *
 * Supported parameters:
 *
 * limit: integer between 1 and 100; default 20
 *
 * No authentication required to view the sanitized
 * response.
 *
 * No check-in writes, rewards, XP, or venue mutations.
 * ======================================================= */

export async function GET(
  request: NextRequest
) {
  const limit = parseLimit(
    request.nextUrl.searchParams.get('limit')
  )

  if (limit === null) {
    return jsonResponse(
      {
        error:
          'Limit must be an integer between 1 and 100.',
      },
      400
    )
  }

  /**
   * This timestamp is shared by the SQL aggregation
   * and the TypeScript scorer.
   *
   * It guarantees that the seven-day, fourteen-day,
   * and 48-hour windows are evaluated consistently.
   */
  const asOf = new Date().toISOString()

  try {
    const supabase =
      createTrendingSupabaseClient()

    /* -----------------------------------------------------
     * Step 1: Fetch verified venue-level aggregates.
     *
     * The database function:
     *
     * - Filters geo_verified = true
     * - Excludes OOB venues
     * - Counts distinct user IDs server-side
     * - Uses nonoverlapping seven-day windows
     * - Returns no individual visit records
     * --------------------------------------------------- */

    const {
      data: aggregateData,
      error: aggregateError,
    } = await supabase.rpc(
      'get_explore_trending_aggregates',
      {
        p_as_of: asOf,
      }
    )

    if (aggregateError) {
      console.error(
        '[api/explore/trending] Aggregate query failed:',
        aggregateError
      )

      return jsonResponse(
        {
          error:
            'Unable to load trending places.',
        },
        500
      )
    }

    if (!Array.isArray(aggregateData)) {
      console.error(
        '[api/explore/trending] Invalid aggregate result shape.'
      )

      return jsonResponse(
        {
          error:
            'Unable to process trending places.',
        },
        502
      )
    }

    /* -----------------------------------------------------
     * Step 2: Validate aggregate values.
     *
     * Fail closed on corrupt or unexpected database
     * output instead of publishing misleading rankings.
     * --------------------------------------------------- */

    const aggregates:
      ExploreTrendingVenueAggregate[] = []

    const seenVenueIds = new Set<string>()

    for (const rawRow of aggregateData) {
      if (
        rawRow === null ||
        typeof rawRow !== 'object' ||
        Array.isArray(rawRow)
      ) {
        console.error(
          '[api/explore/trending] Invalid aggregate row.'
        )

        return jsonResponse(
          {
            error:
              'Unable to process trending places.',
          },
          502
        )
      }

      const aggregate = parseAggregate(
        rawRow as TrendingDatabaseRow
      )

      if (!aggregate) {
        console.error(
          '[api/explore/trending] Malformed aggregate values.'
        )

        return jsonResponse(
          {
            error:
              'Unable to process trending places.',
          },
          502
        )
      }

      const normalizedId =
        aggregate.venueId.toLowerCase()

      if (seenVenueIds.has(normalizedId)) {
        console.error(
          '[api/explore/trending] Duplicate venue aggregate.'
        )

        return jsonResponse(
          {
            error:
              'Unable to process trending places.',
          },
          502
        )
      }

      seenVenueIds.add(normalizedId)

      aggregates.push(aggregate)
    }

    /* -----------------------------------------------------
     * Step 3: Score and rank using the tested pure module.
     *
     * The scoring module enforces:
     *
     * - Minimum five unique verified visitors
     * - Minimum five verified visits
     * - Valid recent activity timestamps
     * - Repeat-visit bonus caps
     * - Unique visitor dominance
     * - Deterministic ranking
     *
     * Never weaken those thresholds here.
     * --------------------------------------------------- */

    const ranked = rankExploreTrendingVenues(
      aggregates,
      {
        now: asOf,
        limit,
      }
    )

    if (ranked.length === 0) {
      return insufficientDataResponse(asOf)
    }

    /* -----------------------------------------------------
     * Step 4: Fetch safe venue metadata.
     *
     * Only public-facing columns are selected.
     *
     * In particular, do not select:
     *
     * - access_token
     * - contact
     * - internal administrative fields
     * - raw venue_visits
     * --------------------------------------------------- */

    const venueIds = ranked.map(
      (result) => result.venueId
    )

    const {
      data: venueData,
      error: venueError,
    } = await supabase
      .from('venues')
      .select(PUBLIC_VENUE_COLUMNS)
      .in('id', venueIds)

    if (venueError || !Array.isArray(venueData)) {
      console.error(
        '[api/explore/trending] Venue metadata query failed:',
        venueError
      )

      return jsonResponse(
        {
          error:
            'Unable to load trending venue details.',
        },
        500
      )
    }

    /* -----------------------------------------------------
     * Step 5: Recheck Explore eligibility.
     *
     * The database function excludes OOB venues, but
     * this application-level check provides a second
     * boundary against inconsistent or stale data.
     * --------------------------------------------------- */

    const venueMetadata = new Map<
      string,
      {
        id: string
        name: string
        city: string
        cover: string | null
        type: string[]
        vibe: string[]
        tags: string[]
        lat: number | null
        lon: number | null
      }
    >()

    for (const row of venueData) {
        const eligibility =
            evaluateExploreVenueEligibility(row)

      if (!eligibility.eligible) {
        continue
      }

      const venue = eligibility.venue

      venueMetadata.set(venue.id, {
        id: venue.id,
        name: venue.name,
        city: venue.city,

        cover: optionalText(row.cover),

        type: stringArray(row.type),
        vibe: stringArray(row.vibe),
        tags: stringArray(row.tags),

        lat: venue.coordinates?.lat ?? null,
        lon: venue.coordinates?.lon ?? null,
      })
    }

    /* -----------------------------------------------------
     * Step 6: Build the public response.
     *
     * Only qualifying venues are returned.
     *
     * No user IDs, raw visit records, personal
     * coordinates, or privileged credentials appear
     * in the response.
     * --------------------------------------------------- */

    const venues: PublicTrendingVenue[] = []

    for (const result of ranked) {
      const metadata = venueMetadata.get(
        result.venueId.toLowerCase()
      )

      if (!metadata) {
        continue
      }

      if (!result.lastVerifiedVisitAt) {
        continue
      }

      const id = metadata.id

      venues.push({
        ...metadata,

        rank: venues.length + 1,

        score: result.score,

        currentUniqueVisitors:
          result.currentUniqueVisitors,

        previousUniqueVisitors:
          result.previousUniqueVisitors,

        currentVerifiedVisits:
          result.currentVerifiedVisits,

        previousVerifiedVisits:
          result.previousVerifiedVisits,

        recentVerifiedVisits:
          result.recentVerifiedVisits,

        growth: result.growth,

        lastVerifiedVisitAt:
          result.lastVerifiedVisitAt,

        profileHref:
          `/venue-profile/${encodeURIComponent(id)}`,

        flowBuilderHref:
          `/sponsor-crawl?venueId=${encodeURIComponent(id)}`,
      })
    }

    if (venues.length === 0) {
      return insufficientDataResponse(asOf)
    }

    return jsonResponse({
      status: 'trending' as TrendingResponseStatus,

      venues,

      count: venues.length,

      windowDays:
        EXPLORE_TRENDING_WINDOW_DAYS,

      asOf,
    })
  } catch (error) {
    console.error(
      '[api/explore/trending] Unexpected error:',
      error
    )

    return jsonResponse(
      {
        error:
          'Unexpected error loading trending places.',
      },
      500
    )
  }
}
