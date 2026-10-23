
/**
 * lib/explore/trending.ts
 *
 * Pure, deterministic scoring for RoamCurated Explore
 * Places trending rankings.
 *
 * IMPORTANT:
 *
 * This module does not query the database.
 *
 * It consumes venue-level aggregates derived from
 * canonical, geo-verified venue_visits.
 *
 * Aggregation must happen on the server/database.
 * Do not send raw visitor IDs, individual visit
 * histories, or user coordinates to the browser.
 *
 * Scoring principles:
 *
 * 1. Unique verified visitors drive the score.
 * 2. Repeated visits contribute only a small bonus.
 * 3. Recent activity matters.
 * 4. Week-over-week growth provides momentum.
 * 5. Tiny samples must not receive trending labels.
 * 6. No verified evidence means no trending ranking.
 * 7. Rankings are deterministic for a given input
 *    and evaluation timestamp.
 *
 * This module has no side effects.
 */

/* =========================================================
 * Configuration
 * ======================================================= */

export const EXPLORE_TRENDING_WINDOW_DAYS = 7

export const EXPLORE_TRENDING_LOOKBACK_DAYS = 14

export const EXPLORE_TRENDING_MIN_UNIQUE_VISITORS = 5

export const EXPLORE_TRENDING_MIN_VERIFIED_VISITS = 5

export const EXPLORE_TRENDING_RECENT_HOURS = 48

const DAY_MS = 24 * 60 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000

const MAX_REPEAT_BONUS = 6

const MAX_GROWTH_BONUS = 18

const MAX_RECENCY_BONUS = 12

const MAX_RECENT_ACTIVITY_BONUS = 8

const MAX_UNIQUE_VISITOR_SCORE = 80

/* =========================================================
 * Input contracts
 * ======================================================= */

/**
 * Aggregates must represent the same fixed,
 * non-overlapping time windows.
 *
 * Current window:
 * [now - 7 days, now)
 *
 * Previous window:
 * [now - 14 days, now - 7 days)
 *
 * recentVerifiedVisits represents verified visits
 * during the final 48 hours of the current window.
 *
 * All unique-visitor counts must be calculated using
 * COUNT(DISTINCT user_id) over the COMPLETE window.
 *
 * Do not sum daily unique visitor counts: that would
 * count returning visitors more than once.
 *
 * All visit counts must come from records satisfying
 * geo_verified = true.
 */
export type ExploreTrendingVenueAggregate = {
  venueId: string

  currentUniqueVisitors: number
  previousUniqueVisitors: number

  currentVerifiedVisits: number
  previousVerifiedVisits: number

  recentVerifiedVisits: number

  /**
   * Latest verified visit timestamp within the
   * current seven-day window.
   *
   * ISO-8601 timestamp or null.
   */
  lastVerifiedVisitAt: string | null
}

/**
 * Optional evaluation settings.
 *
 * now is explicit to support deterministic tests
 * and database aggregation consistency.
 */
export type ExploreTrendingOptions = {
  now?: Date | string | number
  limit?: number
  minimumUniqueVisitors?: number
  minimumVerifiedVisits?: number
}

/* =========================================================
 * Output contracts
 * ======================================================= */

export type ExploreTrendingStatus =
  | 'trending'
  | 'insufficient_data'

export type ExploreTrendingInsufficientReason =
  | 'invalid_aggregate'
  | 'insufficient_unique_visitors'
  | 'insufficient_verified_visits'
  | 'no_recent_activity'

export type ExploreTrendingScoreBreakdown = {
  uniqueVisitors: number
  repeatVisits: number
  growth: number
  recency: number
  recentActivity: number
}

export type ExploreTrendingGrowth = {
  absoluteChange: number

  /**
   * Null when previousUniqueVisitors = 0.
   * A zero baseline has no meaningful percentage
   * denominator.
   */
  percentageChange: number | null

  /**
   * True when a venue had no verified unique
   * visitors in the previous window.
   */
  newActivity: boolean
}

export type ExploreTrendingVenueResult = {
  venueId: string

  status: ExploreTrendingStatus

  score: number

  currentUniqueVisitors: number
  previousUniqueVisitors: number

  currentVerifiedVisits: number
  previousVerifiedVisits: number

  recentVerifiedVisits: number

  lastVerifiedVisitAt: string | null

  growth: ExploreTrendingGrowth

  breakdown: ExploreTrendingScoreBreakdown

  insufficientReason:
    | ExploreTrendingInsufficientReason
    | null
}

export type RankedExploreTrendingVenue =
  ExploreTrendingVenueResult & {
    status: 'trending'
    rank: number
  }

/* =========================================================
 * Public scoring API
 * ======================================================= */

/**
 * Evaluate one venue's aggregated verified activity.
 *
 * Insufficient evidence produces score = 0 and
 * status = 'insufficient_data'.
 *
 * It does not generate placeholder momentum,
 * synthetic visits, or fallback popularity.
 */
export function scoreExploreTrendingVenue(
  aggregate: ExploreTrendingVenueAggregate,
  options: ExploreTrendingOptions = {}
): ExploreTrendingVenueResult {
  const now = resolveNow(options.now)

  const minimumUniqueVisitors =
    resolveMinimum(
      options.minimumUniqueVisitors,
      EXPLORE_TRENDING_MIN_UNIQUE_VISITORS
    )

  const minimumVerifiedVisits =
    resolveMinimum(
      options.minimumVerifiedVisits,
      EXPLORE_TRENDING_MIN_VERIFIED_VISITS
    )

  const base = createBaseResult(aggregate)

  if (!isValidAggregate(aggregate, now)) {
    return insufficient(
      base,
      'invalid_aggregate'
    )
  }

  if (
    aggregate.currentUniqueVisitors <
    minimumUniqueVisitors
  ) {
    return insufficient(
      base,
      'insufficient_unique_visitors'
    )
  }

  if (
    aggregate.currentVerifiedVisits <
    minimumVerifiedVisits
  ) {
    return insufficient(
      base,
      'insufficient_verified_visits'
    )
  }

  if (!aggregate.lastVerifiedVisitAt) {
    return insufficient(
      base,
      'no_recent_activity'
    )
  }

  const elapsedHours =
    getElapsedHours(
      aggregate.lastVerifiedVisitAt,
      now
    )

  if (
    elapsedHours === null ||
    elapsedHours >=
      EXPLORE_TRENDING_WINDOW_DAYS * 24
  ) {
    return insufficient(
      base,
      'no_recent_activity'
    )
  }

  /**
   * Unique visitors are the dominant signal.
   *
   * Logarithmic scaling prevents large venues from
   * overwhelming the entire ranking through sheer
   * size alone, while still rewarding genuine reach.
   */
  const uniqueVisitorScore =
    clamp(
      18 *
        Math.log2(
          aggregate.currentUniqueVisitors + 1
        ),
      0,
      MAX_UNIQUE_VISITOR_SCORE
    )

  /**
   * Repeated check-ins contribute modestly.
   *
   * Repeat visits = verified visits - unique visitors.
   *
   * The ratio is capped, ensuring one user checking
   * in repeatedly cannot dominate the ranking.
   */
  const repeatVisits = Math.max(
    0,
    aggregate.currentVerifiedVisits -
      aggregate.currentUniqueVisitors
  )

  const repeatRatio =
    repeatVisits /
    Math.max(
      1,
      aggregate.currentUniqueVisitors
    )

  const repeatVisitScore =
    clamp(
      repeatRatio * 2,
      0,
      MAX_REPEAT_BONUS
    )

  /**
   * Momentum is based on distinct visitor growth.
   *
   * Growth is intentionally secondary to unique
   * visitor volume.
   *
   * If the previous period has zero visitors,
   * calculate a limited new-activity bonus rather
   * than claiming infinite percentage growth.
   */
  const growthScore =
    calculateGrowthScore(
      aggregate.currentUniqueVisitors,
      aggregate.previousUniqueVisitors
    )

  /**
   * Recency:
   *
   * More recent verified check-ins earn a larger
   * bonus, declining linearly across seven days.
   */
  const recencyScore =
    clamp(
      MAX_RECENCY_BONUS *
        (
          1 -
          elapsedHours /
            (
              EXPLORE_TRENDING_WINDOW_DAYS *
              24
            )
        ),
      0,
      MAX_RECENCY_BONUS
    )

  /**
   * Activity in the final 48 hours provides
   * an additional small signal.
   *
   * The bonus is based on the fraction of verified
   * current-week visits that happened recently.
   */
  const recentActivityRatio =
    aggregate.recentVerifiedVisits /
    Math.max(
      1,
      aggregate.currentVerifiedVisits
    )

  const recentActivityScore =
    clamp(
      recentActivityRatio *
        MAX_RECENT_ACTIVITY_BONUS,
      0,
      MAX_RECENT_ACTIVITY_BONUS
    )

  const breakdown:
    ExploreTrendingScoreBreakdown = {
      uniqueVisitors:
        roundScore(uniqueVisitorScore),

      repeatVisits:
        roundScore(repeatVisitScore),

      growth:
        roundScore(growthScore),

      recency:
        roundScore(recencyScore),

      recentActivity:
        roundScore(recentActivityScore),
    }

  const score = roundScore(
    breakdown.uniqueVisitors +
      breakdown.repeatVisits +
      breakdown.growth +
      breakdown.recency +
      breakdown.recentActivity
  )

  return {
    ...base,

    status: 'trending',

    score,

    breakdown,

    insufficientReason: null,
  }
}

/**
 * Rank a collection of venue-level aggregates.
 *
 * Only venues with sufficient verified evidence
 * appear in this list.
 *
 * Ranking order:
 *
 * 1. Highest trending score
 * 2. Most unique verified visitors
 * 3. Most recent verified visit
 * 4. Stable venue ID tie-break
 *
 * No data or insufficient data returns [].
 */
export function rankExploreTrendingVenues(
  aggregates:
    readonly ExploreTrendingVenueAggregate[],
  options: ExploreTrendingOptions = {}
): RankedExploreTrendingVenue[] {
  const limit =
    resolveLimit(options.limit)

  if (
    limit === 0 ||
    aggregates.length === 0
  ) {
    return []
  }

  const scored = aggregates
    .map((aggregate) =>
      scoreExploreTrendingVenue(
        aggregate,
        options
      )
    )
    .filter(
      isTrendingResult
    )

  scored.sort(
    compareTrendingResults
  )

  return scored
    .slice(0, limit)
    .map(
      (result, index) => ({
        ...result,
        rank: index + 1,
      })
    )
}

/**
 * Evaluate all supplied aggregates without discarding
 * insufficient-data results.
 *
 * Useful for server diagnostics and deciding whether
 * a specific venue qualifies for a trending badge.
 *
 * Returns one result per input aggregate.
 */
export function evaluateExploreTrendingVenues(
  aggregates:
    readonly ExploreTrendingVenueAggregate[],
  options: ExploreTrendingOptions = {}
): ExploreTrendingVenueResult[] {
  return aggregates.map(
    (aggregate) =>
      scoreExploreTrendingVenue(
        aggregate,
        options
      )
  )
}

/**
 * Convenience helper for a single venue.
 */
export function isExploreVenueTrending(
  aggregate: ExploreTrendingVenueAggregate,
  options: ExploreTrendingOptions = {}
): boolean {
  return (
    scoreExploreTrendingVenue(
      aggregate,
      options
    ).status === 'trending'
  )
}

/* =========================================================
 * Growth
 * ======================================================= */

/**
 * Calculate week-over-week unique visitor growth.
 *
 * Percentage change is intentionally null when
 * the previous period is zero.
 */
export function calculateExploreTrendingGrowth(
  currentUniqueVisitors: number,
  previousUniqueVisitors: number
): ExploreTrendingGrowth {
  const absoluteChange =
    currentUniqueVisitors -
    previousUniqueVisitors

  if (
    previousUniqueVisitors === 0
  ) {
    return {
      absoluteChange,
      percentageChange: null,
      newActivity:
        currentUniqueVisitors > 0,
    }
  }

  return {
    absoluteChange,

    percentageChange:
      roundScore(
        (
          absoluteChange /
          previousUniqueVisitors
        ) * 100
      ),

    newActivity: false,
  }
}

function calculateGrowthScore(
  currentUniqueVisitors: number,
  previousUniqueVisitors: number
): number {
  if (
    currentUniqueVisitors === 0
  ) {
    return 0
  }

  if (
    previousUniqueVisitors === 0
  ) {
    /**
     * A newly active venue gets a modest bonus,
     * not an unlimited growth multiplier.
     */
    return clamp(
      Math.log2(
        currentUniqueVisitors + 1
      ) * 2,
      0,
      MAX_GROWTH_BONUS / 2
    )
  }

  const growthRatio =
    (
      currentUniqueVisitors -
      previousUniqueVisitors
    ) /
    previousUniqueVisitors

  /**
   * Negative momentum does not subtract the
   * base score; it simply earns no growth bonus.
   */
  return clamp(
    Math.max(
      0,
      growthRatio
    ) * 6,
    0,
    MAX_GROWTH_BONUS
  )
}

/* =========================================================
 * Result construction
 * ======================================================= */

function createBaseResult(
  aggregate: ExploreTrendingVenueAggregate
): ExploreTrendingVenueResult {
  return {
    venueId: aggregate.venueId,

    status: 'insufficient_data',

    score: 0,

    currentUniqueVisitors:
      aggregate.currentUniqueVisitors,

    previousUniqueVisitors:
      aggregate.previousUniqueVisitors,

    currentVerifiedVisits:
      aggregate.currentVerifiedVisits,

    previousVerifiedVisits:
      aggregate.previousVerifiedVisits,

    recentVerifiedVisits:
      aggregate.recentVerifiedVisits,

    lastVerifiedVisitAt:
      aggregate.lastVerifiedVisitAt,

    growth:
      safeGrowth(
        aggregate.currentUniqueVisitors,
        aggregate.previousUniqueVisitors
      ),

    breakdown: {
      uniqueVisitors: 0,
      repeatVisits: 0,
      growth: 0,
      recency: 0,
      recentActivity: 0,
    },

    insufficientReason: null,
  }
}

function insufficient(
  base: ExploreTrendingVenueResult,
  reason: ExploreTrendingInsufficientReason
): ExploreTrendingVenueResult {
  return {
    ...base,

    status: 'insufficient_data',

    score: 0,

    insufficientReason: reason,
  }
}

function safeGrowth(
  current: number,
  previous: number
): ExploreTrendingGrowth {
  if (
    !isValidCount(current) ||
    !isValidCount(previous)
  ) {
    return {
      absoluteChange: 0,
      percentageChange: null,
      newActivity: false,
    }
  }

  return calculateExploreTrendingGrowth(
    current,
    previous
  )
}

/* =========================================================
 * Aggregate validation
 * ======================================================= */

function isValidAggregate(
  aggregate: ExploreTrendingVenueAggregate,
  now: Date
): boolean {
  if (
    !isValidVenueId(
      aggregate.venueId
    )
  ) {
    return false
  }

  const counts = [
    aggregate.currentUniqueVisitors,
    aggregate.previousUniqueVisitors,
    aggregate.currentVerifiedVisits,
    aggregate.previousVerifiedVisits,
    aggregate.recentVerifiedVisits,
  ]

  if (
    !counts.every(
      isValidCount
    )
  ) {
    return false
  }

  /**
   * Each distinct visitor must have at least
   * one verified visit in the corresponding window.
   */
  if (
    aggregate.currentUniqueVisitors >
      aggregate.currentVerifiedVisits ||
    aggregate.previousUniqueVisitors >
      aggregate.previousVerifiedVisits
  ) {
    return false
  }

  if (
    aggregate.recentVerifiedVisits >
    aggregate.currentVerifiedVisits
  ) {
    return false
  }

  /**
   * A current-week venue with verified activity
   * must have a current-window latest visit time.
   */
  if (
    aggregate.currentVerifiedVisits > 0 &&
    !aggregate.lastVerifiedVisitAt
  ) {
    return false
  }

  if (
    aggregate.currentVerifiedVisits === 0 &&
    aggregate.lastVerifiedVisitAt !== null
  ) {
    return false
  }

  if (
    aggregate.recentVerifiedVisits > 0 &&
    !aggregate.lastVerifiedVisitAt
  ) {
    return false
  }

  if (
    aggregate.lastVerifiedVisitAt !== null
  ) {
    const timestamp =
      Date.parse(
        aggregate.lastVerifiedVisitAt
      )

    if (
      !Number.isFinite(timestamp)
    ) {
      return false
    }

    /**
     * Future timestamps are invalid.
     * This prevents clock-skewed visit records
     * from earning artificial recency.
     */
    if (
      timestamp > now.getTime()
    ) {
      return false
    }

    const oldestAllowed =
      now.getTime() -
      EXPLORE_TRENDING_WINDOW_DAYS *
        DAY_MS

    if (
      timestamp < oldestAllowed
    ) {
      return false
    }

    /**
     * If a visit occurred in the last 48 hours,
     * the recentVerifiedVisits aggregate must
     * contain at least that one visit.
     */
    if (
      timestamp >=
        now.getTime() -
          EXPLORE_TRENDING_RECENT_HOURS *
            HOUR_MS &&
      aggregate.recentVerifiedVisits === 0
    ) {
      return false
    }

    /**
     * Conversely, any recently counted activity
     * requires a latest visit timestamp within
     * that 48-hour window.
     */
    if (
      aggregate.recentVerifiedVisits > 0 &&
      timestamp <
        now.getTime() -
          EXPLORE_TRENDING_RECENT_HOURS *
            HOUR_MS
    ) {
      return false
    }
  }

  return true
}

function isValidVenueId(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  )
}

function isValidCount(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

/* =========================================================
 * Ranking
 * ======================================================= */

function isTrendingResult(
  result: ExploreTrendingVenueResult
): result is ExploreTrendingVenueResult & {
  status: 'trending'
} {
  return (
    result.status === 'trending'
  )
}

function compareTrendingResults(
  a: ExploreTrendingVenueResult,
  b: ExploreTrendingVenueResult
): number {
  if (
    a.score !== b.score
  ) {
    return b.score - a.score
  }

  if (
    a.currentUniqueVisitors !==
    b.currentUniqueVisitors
  ) {
    return (
      b.currentUniqueVisitors -
      a.currentUniqueVisitors
    )
  }

  const timeA =
    a.lastVerifiedVisitAt
      ? Date.parse(
          a.lastVerifiedVisitAt
        )
      : 0

  const timeB =
    b.lastVerifiedVisitAt
      ? Date.parse(
          b.lastVerifiedVisitAt
        )
      : 0

  if (
    timeA !== timeB
  ) {
    return timeB - timeA
  }

  return a.venueId.localeCompare(
    b.venueId
  )
}

/* =========================================================
 * Time and option handling
 * ======================================================= */

function resolveNow(
  input: ExploreTrendingOptions['now']
): Date {
  const now =
    input === undefined
      ? new Date()
      : new Date(input)

  if (
    !Number.isFinite(
      now.getTime()
    )
  ) {
    throw new RangeError(
      'Invalid trending evaluation timestamp.'
    )
  }

  return now
}

function resolveMinimum(
  input: number | undefined,
  fallback: number
): number {
  if (
    input === undefined
  ) {
    return fallback
  }

  if (
    !Number.isSafeInteger(
      input
    ) ||
    input < fallback
  ) {
    throw new RangeError(
      `Trending minimum must be an integer >= ${fallback}.`
    )
  }

  return input
}

function resolveLimit(
  input: number | undefined
): number {
  if (
    input === undefined
  ) {
    return 20
  }

  if (
    !Number.isSafeInteger(
      input
    ) ||
    input < 0 ||
    input > 100
  ) {
    throw new RangeError(
      'Trending limit must be an integer between 0 and 100.'
    )
  }

  return input
}

function getElapsedHours(
  timestamp: string,
  now: Date
): number | null {
  const visitTime =
    Date.parse(
      timestamp
    )

  if (
    !Number.isFinite(
      visitTime
    )
  ) {
    return null
  }

  const difference =
    now.getTime() -
    visitTime

  if (
    difference < 0
  ) {
    return null
  }

  return (
    difference /
    HOUR_MS
  )
}

/* =========================================================
 * Numeric utilities
 * ======================================================= */

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  )
}

function roundScore(
  value: number
): number {
  return (
    Math.round(
      value * 100
    ) / 100
  )
}
