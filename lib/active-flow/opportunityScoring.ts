import type {
  ActiveFlowOpportunityCandidate,
  ActiveFlowOpportunityContext,
  ActiveFlowOpportunityRuntimeStop,
  ActiveFlowOpportunityTravelMode,
} from '@/lib/active-flow/opportunityCandidates'

/**
 * 013C — Live Signal Opportunity Scoring
 *
 * This module is deliberately pure.
 *
 * It answers:
 *
 * "Given an already-trusted Community Signal candidate and the
 * canonical runtime state of an adaptive Active Flow, how useful is
 * this opportunity to this Flow right now?"
 *
 * It does NOT:
 *
 * - establish Community Signal truth
 * - alter confidence
 * - read from the database
 * - use live GPS
 * - call a routing provider
 * - mutate active_flow_stops
 * - mutate active_flow_progress
 * - mutate active_flow_sessions
 * - create venue_visit
 * - create event participation/check-ins
 * - create event interest
 * - perform Detour / Swap / Reroute
 * - make a user-facing recommendation
 *
 * Authority remains separated:
 *
 * 012B / 013B
 *   → candidate trust + runtime context
 *
 * 022D.3 / 013C
 *   → deterministic contextual admission + opportunity relevance
 *
 * 014
 *   → user-facing opportunity surfacing
 *
 * 015
 *   → user-approved route mutation
 */

export const ACTIVE_FLOW_OPPORTUNITY_HORIZON_MINUTES =
  6 * 60

export const OPPORTUNITY_SCORE_WEIGHTS = {
  temporal: 0.6,
  route: 0.4,
} as const

/**
 * Straight-line geographic distance is only a deterministic v1 proxy
 * for route disruption.
 *
 * These thresholds therefore represent tolerated incremental
 * geographic displacement, not actual walking/cycling/driving route
 * distance.
 *
 * A routing provider can replace the distance model later without
 * changing the scorer's public contract.
 */
export const MAX_INCREMENTAL_DISTANCE_METERS_BY_TRAVEL_MODE = {
  walking: 2_000,
  cycling: 5_000,
  driving: 10_000,
} satisfies Record<
  ActiveFlowOpportunityTravelMode,
  number
>

export type ActiveFlowOpportunityIneligibleReason =
  | 'expired'
  | 'too_early'
  | 'contextual_mismatch'
  | 'insufficient_route_context'
  | 'excessive_route_cost'
  | null

export type ActiveFlowOpportunityScoreBreakdown = {
  temporalFit: number | null
  routeFit: number | null

  minutesUntilStart: number | null
  minutesUntilEnd: number | null

  directDistanceMeters: number | null
  incrementalDistanceMeters: number | null

  /**
   * Runtime stop used as the geographic origin for route scoring.
   *
   * This is canonical Flow execution context, not inferred user GPS.
   */
  routeOriginStopId: string | null

  /**
   * The remaining runtime stop used as the route continuation point.
   *
   * Null means the candidate is being evaluated at the terminal edge
   * of the remaining Flow and therefore has no following route leg.
   */
  routeContinuationStopId: string | null

  /**
   * When the candidate venue already exists later in the remaining
   * runtime route, this records that canonical execution position.
   *
   * This is derived execution order, not active_flow_stops.position.
   */
  existingFlowPosition: number | null

  /**
   * Geographic proxy threshold used for this Flow's travel mode.
   */
  maxIncrementalDistanceMeters: number
}

export type ScoredActiveFlowOpportunity = {
  candidate: ActiveFlowOpportunityCandidate

  actionable: boolean

  ineligibleReason:
    ActiveFlowOpportunityIneligibleReason

  /**
   * Normalized 0–100 opportunity relevance.
   *
   * Null means the candidate failed a hard feasibility gate and was
   * therefore not scored.
   */
  score: number | null

  breakdown: ActiveFlowOpportunityScoreBreakdown
}

type Coordinates = {
  lat: number
  lon: number
}

type TemporalEvaluation = {
  actionable: boolean
  reason:
    | 'expired'
    | 'too_early'
    | null

  temporalFit: number | null

  minutesUntilStart: number | null
  minutesUntilEnd: number | null
}

type RouteEvaluation = {
  actionable: boolean
  reason:
    | 'insufficient_route_context'
    | 'excessive_route_cost'
    | null

  routeFit: number | null

  directDistanceMeters: number | null
  incrementalDistanceMeters: number | null

  routeOriginStopId: string | null
  routeContinuationStopId: string | null
  existingFlowPosition: number | null
}

const EARTH_RADIUS_METERS =
  6_371_000

const MILLISECONDS_PER_MINUTE =
  60_000

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  )
}

function roundScore(
  value: number
): number {
  return Math.round(
    clamp(
      value,
      0,
      100
    ) * 100
  ) / 100
}

function roundDistance(
  value: number
): number {
  return Math.round(
    Math.max(
      0,
      value
    )
  )
}

function roundMinutes(
  value: number
): number {
  return Math.round(
    value * 100
  ) / 100
}

function parseTimestamp(
  value: string | null
): number | null {
  if (!value) {
    return null
  }

  const timestamp =
    Date.parse(value)

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null
}

function isFiniteCoordinate(
  value: number | null
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  )
}

function getCoordinates(
  venue: {
    lat: number | null
    lon: number | null
  }
): Coordinates | null {
  if (
    !isFiniteCoordinate(
      venue.lat
    ) ||
    !isFiniteCoordinate(
      venue.lon
    )
  ) {
    return null
  }

  if (
    venue.lat < -90 ||
    venue.lat > 90 ||
    venue.lon < -180 ||
    venue.lon > 180
  ) {
    return null
  }

  return {
    lat: venue.lat,
    lon: venue.lon,
  }
}

function degreesToRadians(
  degrees: number
): number {
  return (
    degrees *
    Math.PI
  ) / 180
}

/**
 * Deterministic great-circle distance.
 *
 * This intentionally does not claim to be route distance.
 */
export function haversineDistanceMeters(
  a: Coordinates,
  b: Coordinates
): number {
  const lat1 =
    degreesToRadians(
      a.lat
    )

  const lat2 =
    degreesToRadians(
      b.lat
    )

  const deltaLat =
    degreesToRadians(
      b.lat - a.lat
    )

  const deltaLon =
    degreesToRadians(
      b.lon - a.lon
    )

  const sinLat =
    Math.sin(
      deltaLat / 2
    )

  const sinLon =
    Math.sin(
      deltaLon / 2
    )

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLon *
      sinLon

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(
        haversine
      ),
      Math.sqrt(
        Math.max(
          0,
          1 - haversine
        )
      )
    )

  return (
    EARTH_RADIUS_METERS *
    centralAngle
  )
}

function evaluateTemporalFit({
  candidate,
  asOfMs,
}: {
  candidate: ActiveFlowOpportunityCandidate
  asOfMs: number
}): TemporalEvaluation {
  const startsAtMs =
    parseTimestamp(
      candidate.startsAt
    )

  const endsAtMs =
    parseTimestamp(
      candidate.endsAt
    )

  /**
   * 013B should already guarantee a valid start time.
   *
   * If malformed data nevertheless reaches this pure scorer, fail
   * closed rather than manufacture temporal relevance.
   */
  if (startsAtMs == null) {
    return {
      actionable: false,
      reason: 'expired',
      temporalFit: null,
      minutesUntilStart: null,
      minutesUntilEnd:
        endsAtMs == null
          ? null
          : roundMinutes(
              (
                endsAtMs -
                asOfMs
              ) /
                MILLISECONDS_PER_MINUTE
            ),
    }
  }

  const minutesUntilStart =
    (
      startsAtMs -
      asOfMs
    ) /
    MILLISECONDS_PER_MINUTE

  const minutesUntilEnd =
    endsAtMs == null
      ? null
      : (
          endsAtMs -
          asOfMs
        ) /
        MILLISECONDS_PER_MINUTE

  /**
   * Known event end at or before asOf means the opportunity is over.
   */
  if (
    endsAtMs != null &&
    endsAtMs <= asOfMs
  ) {
    return {
      actionable: false,
      reason: 'expired',
      temporalFit: null,
      minutesUntilStart:
        roundMinutes(
          minutesUntilStart
        ),
      minutesUntilEnd:
        minutesUntilEnd == null
          ? null
          : roundMinutes(
              minutesUntilEnd
            ),
    }
  }

  /**
   * Event is already underway.
   */
  if (
    startsAtMs <= asOfMs
  ) {
    /**
     * Without a known end, we know the trusted event has started and
     * has not been excluded upstream. Do not invent an end time.
     */
    if (endsAtMs == null) {
      return {
        actionable: true,
        reason: null,
        temporalFit: 100,
        minutesUntilStart:
          roundMinutes(
            minutesUntilStart
          ),
        minutesUntilEnd: null,
      }
    }

    const totalDurationMs =
      endsAtMs -
      startsAtMs

    const remainingDurationMs =
      endsAtMs -
      asOfMs

    if (
      totalDurationMs <= 0 ||
      remainingDurationMs <= 0
    ) {
      return {
        actionable: false,
        reason: 'expired',
        temporalFit: null,
        minutesUntilStart:
          roundMinutes(
            minutesUntilStart
          ),
        minutesUntilEnd:
          minutesUntilEnd == null
            ? null
            : roundMinutes(
                minutesUntilEnd
              ),
      }
    }

    /**
     * Running events are scored by the fraction of their known
     * duration still remaining.
     *
     * Just started       → near 100
     * Half remaining     → 50
     * Almost finished    → near 0
     */
    const remainingFraction =
      clamp(
        remainingDurationMs /
          totalDurationMs,
        0,
        1
      )

    return {
      actionable: true,
      reason: null,
      temporalFit:
        roundScore(
          remainingFraction *
            100
        ),
      minutesUntilStart:
        roundMinutes(
          minutesUntilStart
        ),
      minutesUntilEnd:
        minutesUntilEnd == null
          ? null
          : roundMinutes(
              minutesUntilEnd
            ),
    }
  }

  const horizonMs =
    ACTIVE_FLOW_OPPORTUNITY_HORIZON_MINUTES *
    MILLISECONDS_PER_MINUTE

  const timeUntilStartMs =
    startsAtMs -
    asOfMs

  if (
    timeUntilStartMs >
    horizonMs
  ) {
    return {
      actionable: false,
      reason: 'too_early',
      temporalFit: null,
      minutesUntilStart:
        roundMinutes(
          minutesUntilStart
        ),
      minutesUntilEnd:
        minutesUntilEnd == null
          ? null
          : roundMinutes(
              minutesUntilEnd
            ),
    }
  }

  /**
   * Upcoming event inside the six-hour Active Flow horizon.
   *
   * Starts now → 100
   * Starts at horizon → 0
   */
  const temporalFit =
    100 *
    (
      1 -
      timeUntilStartMs /
        horizonMs
    )

  return {
    actionable: true,
    reason: null,
    temporalFit:
      roundScore(
        temporalFit
      ),
    minutesUntilStart:
      roundMinutes(
        minutesUntilStart
      ),
    minutesUntilEnd:
      minutesUntilEnd == null
        ? null
        : roundMinutes(
            minutesUntilEnd
          ),
  }
}

/**
 * Resolve a stop by canonical derived execution order.
 *
 * executionIndex is deliberately separate from active_flow_stops.position.
 * Base position remains the immutable legacy stop_index compatibility
 * namespace; Detours participate only in execution order.
 */
function findStopAtPosition({
  remainingStops,
  position,
}: {
  remainingStops: ActiveFlowOpportunityRuntimeStop[]
  position: number
}): ActiveFlowOpportunityRuntimeStop | null {
  return (
    remainingStops.find(
      (stop) =>
        stop.executionIndex ===
        position
    ) ??
    null
  )
}

function findExistingCandidateStop({
  candidate,
  remainingStops,
}: {
  candidate: ActiveFlowOpportunityCandidate
  remainingStops: ActiveFlowOpportunityRuntimeStop[]
}): ActiveFlowOpportunityRuntimeStop | null {
  if (
    !candidate.venueAlreadyInRemainingFlow ||
    candidate.remainingFlowPosition ==
      null
  ) {
    return null
  }

  return (
    findStopAtPosition({
      remainingStops:
        remainingStops.filter(
          (stop) =>
            stop.venueId ===
            candidate.venueId
        ),
      position:
        candidate.remainingFlowPosition,
    })
  )
}

function evaluateRouteFit({
  candidate,
  currentStop,
  remainingStops,
  travelMode,
}: {
  candidate: ActiveFlowOpportunityCandidate
  currentStop: ActiveFlowOpportunityRuntimeStop | null
  remainingStops: ActiveFlowOpportunityRuntimeStop[]
  travelMode: ActiveFlowOpportunityTravelMode
}): RouteEvaluation {
  const maxIncrementalDistanceMeters =
    MAX_INCREMENTAL_DISTANCE_METERS_BY_TRAVEL_MODE[
      travelMode
    ]

  if (!currentStop) {
    return {
      actionable: false,
      reason:
        'insufficient_route_context',
      routeFit: null,
      directDistanceMeters: null,
      incrementalDistanceMeters: null,
      routeOriginStopId: null,
      routeContinuationStopId: null,
      existingFlowPosition:
        candidate.remainingFlowPosition,
    }
  }

  const originCoordinates =
    getCoordinates(
      currentStop.venue
    )

  const candidateCoordinates =
    getCoordinates(
      candidate.venue
    )

  if (
    !originCoordinates ||
    !candidateCoordinates
  ) {
    return {
      actionable: false,
      reason:
        'insufficient_route_context',
      routeFit: null,
      directDistanceMeters: null,
      incrementalDistanceMeters: null,
      routeOriginStopId:
        currentStop.id,
      routeContinuationStopId: null,
      existingFlowPosition:
        candidate.remainingFlowPosition,
    }
  }

  const directDistanceMeters =
    haversineDistanceMeters(
      originCoordinates,
      candidateCoordinates
    )

  /**
   * If the candidate is the current runtime stop's own venue, there
   * is no route disruption at all.
   */
  if (
    candidate.venueId ===
    currentStop.venueId
  ) {
    return {
      actionable: true,
      reason: null,
      routeFit: 100,
      directDistanceMeters:
        roundDistance(
          directDistanceMeters
        ),
      incrementalDistanceMeters: 0,
      routeOriginStopId:
        currentStop.id,
      routeContinuationStopId:
        currentStop.id,
      existingFlowPosition:
        currentStop.executionIndex,
    }
  }

  const existingCandidateStop =
    findExistingCandidateStop({
      candidate,
      remainingStops,
    })

  /**
   * Candidate already belongs to the remaining Flow.
   *
   * Reaching it may eventually become a reorder/reroute operation,
   * but 013C must not perform that mutation.
   *
   * For scoring, compare:
   *
   * current → normal next stop
   *
   * against:
   *
   * current → candidate → normal next stop
   *
   * This estimates the immediate disruption of pulling that existing
   * stop forward.
   */
  const normalContinuationStop =
    findStopAtPosition({
      remainingStops,
      position:
        currentStop.executionIndex +
        1,
    })

  /**
   * If the candidate is already the immediate next route destination,
   * it has zero incremental route cost.
   */
  if (
    existingCandidateStop &&
    normalContinuationStop &&
    existingCandidateStop.id ===
      normalContinuationStop.id
  ) {
    return {
      actionable: true,
      reason: null,
      routeFit: 100,
      directDistanceMeters:
        roundDistance(
          directDistanceMeters
        ),
      incrementalDistanceMeters: 0,
      routeOriginStopId:
        currentStop.id,
      routeContinuationStopId:
        existingCandidateStop.id,
      existingFlowPosition:
        existingCandidateStop.executionIndex,
    }
  }

  /**
   * Terminal edge: there is no remaining stop after the current
   * execution position.
   *
   * In that case the opportunity's route cost is simply the distance
   * from the current runtime stop to the candidate.
   */
  if (!normalContinuationStop) {
    const incrementalDistanceMeters =
      directDistanceMeters

    const routeFit =
      100 *
      (
        1 -
        incrementalDistanceMeters /
          maxIncrementalDistanceMeters
      )

    if (
      incrementalDistanceMeters >
      maxIncrementalDistanceMeters
    ) {
      return {
        actionable: false,
        reason:
          'excessive_route_cost',
        routeFit: null,
        directDistanceMeters:
          roundDistance(
            directDistanceMeters
          ),
        incrementalDistanceMeters:
          roundDistance(
            incrementalDistanceMeters
          ),
        routeOriginStopId:
          currentStop.id,
        routeContinuationStopId: null,
        existingFlowPosition:
          existingCandidateStop?.executionIndex ??
          candidate.remainingFlowPosition,
      }
    }

    return {
      actionable: true,
      reason: null,
      routeFit:
        roundScore(
          routeFit
        ),
      directDistanceMeters:
        roundDistance(
          directDistanceMeters
        ),
      incrementalDistanceMeters:
        roundDistance(
          incrementalDistanceMeters
        ),
      routeOriginStopId:
        currentStop.id,
      routeContinuationStopId: null,
      existingFlowPosition:
        existingCandidateStop?.executionIndex ??
        candidate.remainingFlowPosition,
    }
  }

  const continuationCoordinates =
    getCoordinates(
      normalContinuationStop.venue
    )

  if (!continuationCoordinates) {
    return {
      actionable: false,
      reason:
        'insufficient_route_context',
      routeFit: null,
      directDistanceMeters:
        roundDistance(
          directDistanceMeters
        ),
      incrementalDistanceMeters: null,
      routeOriginStopId:
        currentStop.id,
      routeContinuationStopId:
        normalContinuationStop.id,
      existingFlowPosition:
        existingCandidateStop?.executionIndex ??
        candidate.remainingFlowPosition,
    }
  }

  const normalLegDistanceMeters =
    haversineDistanceMeters(
      originCoordinates,
      continuationCoordinates
    )

  const candidateToContinuationDistanceMeters =
    haversineDistanceMeters(
      candidateCoordinates,
      continuationCoordinates
    )

  /**
   * Geographic detour proxy:
   *
   * current → candidate
   * + candidate → normal continuation
   * - current → normal continuation
   *
   * Triangle inequality should keep this non-negative, but clamp
   * defensively against floating-point noise.
   */
  const incrementalDistanceMeters =
    Math.max(
      0,
      directDistanceMeters +
        candidateToContinuationDistanceMeters -
        normalLegDistanceMeters
    )

  if (
    incrementalDistanceMeters >
    maxIncrementalDistanceMeters
  ) {
    return {
      actionable: false,
      reason:
        'excessive_route_cost',
      routeFit: null,
      directDistanceMeters:
        roundDistance(
          directDistanceMeters
        ),
      incrementalDistanceMeters:
        roundDistance(
          incrementalDistanceMeters
        ),
      routeOriginStopId:
        currentStop.id,
      routeContinuationStopId:
        normalContinuationStop.id,
      existingFlowPosition:
        existingCandidateStop?.executionIndex ??
        candidate.remainingFlowPosition,
    }
  }

  const routeFit =
    100 *
    (
      1 -
      incrementalDistanceMeters /
        maxIncrementalDistanceMeters
    )

  return {
    actionable: true,
    reason: null,
    routeFit:
      roundScore(
        routeFit
      ),
    directDistanceMeters:
      roundDistance(
        directDistanceMeters
      ),
    incrementalDistanceMeters:
      roundDistance(
        incrementalDistanceMeters
      ),
    routeOriginStopId:
      currentStop.id,
    routeContinuationStopId:
      normalContinuationStop.id,
    existingFlowPosition:
      existingCandidateStop?.executionIndex ??
      candidate.remainingFlowPosition,
  }
}

function createBreakdown({
  temporal,
  route,
  maxIncrementalDistanceMeters,
}: {
  temporal: TemporalEvaluation
  route: RouteEvaluation
  maxIncrementalDistanceMeters: number
}): ActiveFlowOpportunityScoreBreakdown {
  return {
    temporalFit:
      temporal.temporalFit,

    routeFit:
      route.routeFit,

    minutesUntilStart:
      temporal.minutesUntilStart,

    minutesUntilEnd:
      temporal.minutesUntilEnd,

    directDistanceMeters:
      route.directDistanceMeters,

    incrementalDistanceMeters:
      route.incrementalDistanceMeters,

    routeOriginStopId:
      route.routeOriginStopId,

    routeContinuationStopId:
      route.routeContinuationStopId,

    existingFlowPosition:
      route.existingFlowPosition,

    maxIncrementalDistanceMeters,
  }
}

/**
 * Score one already-trusted 013B candidate.
 *
 * Hard gates are evaluated before weighted scoring:
 *
 * 1. temporal feasibility
 * 2. broad contextual compatibility
 * 3. route feasibility
 * 4. normalized weighted score
 *
 * Contextual fit is additive at the shared candidate boundary:
 *
 * - incompatible         → hard rejection
 * - compatible           → continue
 * - insufficient_context → continue
 * - absent               → preserve historical scorer behavior
 *
 * Confidence is intentionally not a score input. A candidate must
 * already have crossed the frozen trust/discovery boundary before it
 * reaches this function.
 */
export function scoreActiveFlowOpportunity({
  candidate,
  context,
}: {
  candidate: ActiveFlowOpportunityCandidate
  context: ActiveFlowOpportunityContext
}): ScoredActiveFlowOpportunity {
  const asOfMs =
    Date.parse(
      context.asOf
    )

  const maxIncrementalDistanceMeters =
    MAX_INCREMENTAL_DISTANCE_METERS_BY_TRAVEL_MODE[
      context.travelMode
    ]

  /**
   * Invalid context time is a failure of route/scoring context, not
   * evidence that the event itself is expired.
   */
  if (
    !Number.isFinite(
      asOfMs
    )
  ) {
    return {
      candidate,
      actionable: false,
      ineligibleReason:
        'insufficient_route_context',
      score: null,

      breakdown: {
        temporalFit: null,
        routeFit: null,
        minutesUntilStart: null,
        minutesUntilEnd: null,
        directDistanceMeters: null,
        incrementalDistanceMeters: null,
        routeOriginStopId:
          context.currentStop?.id ??
          null,
        routeContinuationStopId: null,
        existingFlowPosition:
          candidate.remainingFlowPosition,
        maxIncrementalDistanceMeters,
      },
    }
  }

  const temporal =
    evaluateTemporalFit({
      candidate,
      asOfMs,
    })

  /**
   * Temporal feasibility is a hard gate.
   *
   * Do not spend route relevance on an opportunity that cannot matter
   * during this Active Flow's useful time horizon.
   */
  if (
    !temporal.actionable
  ) {
    return {
      candidate,
      actionable: false,
      ineligibleReason:
        temporal.reason,
      score: null,

      breakdown: {
        temporalFit:
          temporal.temporalFit,
        routeFit: null,

        minutesUntilStart:
          temporal.minutesUntilStart,
        minutesUntilEnd:
          temporal.minutesUntilEnd,

        directDistanceMeters: null,
        incrementalDistanceMeters: null,

        routeOriginStopId:
          context.currentStop?.id ??
          null,

        routeContinuationStopId: null,

        existingFlowPosition:
          candidate.remainingFlowPosition,

        maxIncrementalDistanceMeters,
      },
    }
  }

  /**
   * 022D.3 — Broad contextual compatibility.
   *
   * Only affirmative incompatibility is a hard rejection.
   *
   * Missing contextual evidence is deliberately permissive:
   *
   * - compatible           → continue
   * - insufficient_context → continue
   * - absent               → continue for backward compatibility
   * - incompatible         → reject before route-cost scoring
   *
   * This preserves the frozen contextual invariant:
   *
   * missing evidence != mismatch
   */
  if (
    candidate.contextualFit?.fit ===
    'incompatible'
  ) {
    return {
      candidate,
      actionable: false,
      ineligibleReason:
        'contextual_mismatch',
      score: null,

      breakdown: {
        /**
         * Temporal evaluation has already succeeded, so preserve its
         * valid evidence.
         */
        temporalFit:
          temporal.temporalFit,

        /**
         * Route-cost evaluation deliberately does not occur after an
         * affirmative contextual rejection.
         */
        routeFit: null,

        minutesUntilStart:
          temporal.minutesUntilStart,

        minutesUntilEnd:
          temporal.minutesUntilEnd,

        directDistanceMeters: null,

        incrementalDistanceMeters: null,

        routeOriginStopId:
          context.currentStop?.id ??
          null,

        routeContinuationStopId: null,

        existingFlowPosition:
          candidate.remainingFlowPosition,

        maxIncrementalDistanceMeters,
      },
    }
  }

  const route =
    evaluateRouteFit({
      candidate,
      currentStop:
        context.currentStop,
      remainingStops:
        context.remainingStops,
      travelMode:
        context.travelMode,
    })

  if (
    !route.actionable
  ) {
    return {
      candidate,
      actionable: false,
      ineligibleReason:
        route.reason,
      score: null,

      breakdown:
        createBreakdown({
          temporal,
          route,
          maxIncrementalDistanceMeters,
        }),
    }
  }

  if (
    temporal.temporalFit == null ||
    route.routeFit == null
  ) {
    return {
      candidate,
      actionable: false,
      ineligibleReason:
        'insufficient_route_context',
      score: null,

      breakdown:
        createBreakdown({
          temporal,
          route,
          maxIncrementalDistanceMeters,
        }),
    }
  }

  const score =
    temporal.temporalFit *
      OPPORTUNITY_SCORE_WEIGHTS.temporal +
    route.routeFit *
      OPPORTUNITY_SCORE_WEIGHTS.route

  return {
    candidate,
    actionable: true,
    ineligibleReason: null,
    score:
      roundScore(
        score
      ),

    breakdown:
      createBreakdown({
        temporal,
        route,
        maxIncrementalDistanceMeters,
      }),
  }
}

/**
 * Score every candidate in an already-established 013B context.
 *
 * Results remain deterministic:
 *
 * - actionable candidates first
 * - higher opportunity score first
 * - earlier event start as tie-breaker
 * - event ID as final stable tie-breaker
 *
 * This ordering is an internal relevance ordering only. It does not
 * itself authorize user-facing surfacing or route mutation.
 */
export function scoreActiveFlowOpportunities(
  context: ActiveFlowOpportunityContext
): ScoredActiveFlowOpportunity[] {
  const scored =
    context.candidates.map(
      (candidate) =>
        scoreActiveFlowOpportunity({
          candidate,
          context,
        })
    )

  scored.sort(
    (
      a,
      b
    ) => {
      if (
        a.actionable !==
        b.actionable
      ) {
        return a.actionable
          ? -1
          : 1
      }

      if (
        a.score != null &&
        b.score != null &&
        a.score !== b.score
      ) {
        return (
          b.score -
          a.score
        )
      }

      if (
        a.score != null &&
        b.score == null
      ) {
        return -1
      }

      if (
        a.score == null &&
        b.score != null
      ) {
        return 1
      }

      const aStart =
        parseTimestamp(
          a.candidate.startsAt
        ) ??
        Number.MAX_SAFE_INTEGER

      const bStart =
        parseTimestamp(
          b.candidate.startsAt
        ) ??
        Number.MAX_SAFE_INTEGER

      if (
        aStart !==
        bStart
      ) {
        return (
          aStart -
          bStart
        )
      }

      return a.candidate.eventId.localeCompare(
        b.candidate.eventId
      )
    }
  )

  return scored
}