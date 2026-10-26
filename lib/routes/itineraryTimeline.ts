
// lib/routes/itineraryTimeline.ts

import {
  addMinutes,
  calculateDistanceMeters,
  coerceDate,
  estimateTravelMinutes,
  hasValidCoordinates,
  type ArrivalTimeTravelMode,
  type ArrivalVenue,
} from './arrivalTime'

import {
  getExperienceRoleDefinition,
  type ExperienceRole,
  type ExperienceRoleResolution,
} from './experienceRoles'

/**
 * RoamCurated — Itinerary Timeline
 *
 * A deterministic scheduling layer for venue-generated Flows.
 *
 * Guarantees for valid inputs:
 *
 *   stop.departAt = stop.arriveAt + stop.dwellMinutes
 *
 *   next.arriveAt =
 *     previous.departAt + next.travelMinutesFromPrevious
 *
 * Notes:
 * - Time calculations use absolute UTC timestamps.
 * - IANA timezones are only required when interpreting
 *   local scheduling rules outside this module.
 * - Travel duration is estimated, not live traffic or
 *   pedestrian-network routing.
 * - No Supabase calls, state mutation, or side effects.
 *
 * Existing arrivalTime.ts behavior is not changed.
 */

export type ItineraryTimelineVenue =
  ArrivalVenue & {
    city?: string | null
  }

export type ItineraryTimelineVisitInput = {
  venue: ItineraryTimelineVenue

  /**
   * Visit's intended primary experience, if resolved.
   */
  role?: ExperienceRole | ExperienceRoleResolution | null

  /**
   * Explicit visit duration overrides the role default.
   */
  dwellMinutes?: number | null
}

export type ItineraryTimelineStop = {
  venue: ItineraryTimelineVenue

  role: ExperienceRole | null

  stopOrder: number

  arriveAt: string
  departAt: string

  dwellMinutes: number

  /**
   * Travel required to reach this stop.
   * Null for the anchor.
   */
  travelMinutesFromPrevious: number | null

  /**
   * Straight-line distance from the previous stop.
   * Null for the anchor or unavailable coordinates.
   */
  distanceMetersFromPrevious: number | null
}

export type ItineraryTimelineTotals = {
  totalStops: number

  /**
   * Sum of estimated distances for legs with coordinates.
   */
  totalDistanceMeters: number

  totalTravelMinutes: number
  totalDwellMinutes: number

  /**
   * Elapsed time from anchor arrival through final
   * departure, including dwell and travel.
   */
  totalRouteMinutes: number

  startedAt: string
  endsAt: string
}

export type ItineraryTimeline = {
  stops: ItineraryTimelineStop[]
  totals: ItineraryTimelineTotals
}

export type TimelineTravelFallbackPolicy =
  | 'estimate'
  | 'reject'

export type BuildItineraryTimelineParams = {
  /**
   * All planned visits, including anchor as first item.
   */
  visits: readonly ItineraryTimelineVisitInput[]

  /**
   * Arrival time at the first venue.
   */
  plannedStartAt: Date | string

  travelMode?: ArrivalTimeTravelMode

  /**
   * Used when consecutive venues lack usable coordinates.
   * "estimate" assigns a conservative fallback duration.
   * "reject" throws an error.
   */
  missingCoordinatesPolicy?: TimelineTravelFallbackPolicy

  /**
   * Minutes of travel used when coordinates are unavailable.
   */
  fallbackTravelMinutes?: number
}

export type AppendItineraryStopParams = {
  /**
   * Previous visit's timeline stop.
   */
  previousStop: ItineraryTimelineStop

  /**
   * The proposed next visit.
   */
  nextVisit: ItineraryTimelineVisitInput

  travelMode?: ArrivalTimeTravelMode

  missingCoordinatesPolicy?: TimelineTravelFallbackPolicy
  fallbackTravelMinutes?: number
}

export type ItineraryTimelineValidationCode =
  | 'empty_itinerary'
  | 'invalid_arrival'
  | 'invalid_departure'
  | 'negative_dwell'
  | 'invalid_duration'
  | 'chronological_overlap'
  | 'travel_time_mismatch'
  | 'invalid_stop_order'

export type ItineraryTimelineValidationIssue = {
  code: ItineraryTimelineValidationCode
  stopOrder: number | null
  message: string
}

export type ItineraryTimelineValidationResult = {
  valid: boolean
  issues: ItineraryTimelineValidationIssue[]
}

const DEFAULT_DWELL_MINUTES = 45

const DEFAULT_FALLBACK_TRAVEL_MINUTES: Record<
  ArrivalTimeTravelMode,
  number
> = {
  walking: 12,
  cycling: 8,
  driving: 10,
}

/**
 * Build a complete chronological itinerary.
 *
 * Stop 1 is always the anchor venue.
 * Every later arrival derives from the preceding stop's
 * departure, never from the original planned start time.
 */
export function buildItineraryTimeline({
  visits,
  plannedStartAt,
  travelMode = 'walking',
  missingCoordinatesPolicy = 'estimate',
  fallbackTravelMinutes,
}: BuildItineraryTimelineParams): ItineraryTimeline {
  if (visits.length === 0) {
    throw new Error(
      '[itineraryTimeline] At least one visit is required.'
    )
  }

  const anchor = createAnchorTimelineStop({
    anchor: visits[0],
    plannedStartAt,
  })

  const stops: ItineraryTimelineStop[] = [anchor]

  for (let index = 1; index < visits.length; index += 1) {
    const nextStop = appendItineraryTimelineStop({
      previousStop: stops[stops.length - 1],
      nextVisit: visits[index],
      travelMode,
      missingCoordinatesPolicy,
      fallbackTravelMinutes,
    })

    stops.push(nextStop)
  }

  return {
    stops,
    totals: summarizeItineraryTimeline(stops),
  }
}

/**
 * Create the anchor stop with a real departure time.
 *
 * Unlike the current generator's original anchor object,
 * the anchor's departure is NOT equal to its arrival
 * unless its explicitly selected dwell duration is zero.
 */
export function createAnchorTimelineStop({
  anchor,
  plannedStartAt,
}: {
  anchor: ItineraryTimelineVisitInput
  plannedStartAt: Date | string
}): ItineraryTimelineStop {
  const start = parseRequiredDate(
    plannedStartAt,
    'plannedStartAt'
  )

  const dwellMinutes = resolveDwellMinutes(anchor)

  const depart = addMinutes(
    start,
    dwellMinutes
  )

  return {
    venue: anchor.venue,
    role: readExperienceRole(anchor.role),
    stopOrder: 1,
    arriveAt: start.toISOString(),
    departAt: depart.toISOString(),
    dwellMinutes,
    travelMinutesFromPrevious: null,
    distanceMetersFromPrevious: null,
  }
}

/**
 * Append a visit after an already scheduled stop.
 *
 * This is the primary helper the route generator can use
 * while evaluating candidate venues.
 *
 * The new visit's timeline is based on:
 *
 *   previousStop.departAt
 *     + travel duration
 *     = candidate.arriveAt
 *
 *   candidate.arriveAt
 *     + candidate dwell
 *     = candidate.departAt
 */
export function appendItineraryTimelineStop({
  previousStop,
  nextVisit,
  travelMode = 'walking',
  missingCoordinatesPolicy = 'estimate',
  fallbackTravelMinutes,
}: AppendItineraryStopParams): ItineraryTimelineStop {
  const previousDeparture = parseRequiredDate(
    previousStop.departAt,
    'previousStop.departAt'
  )

  const distanceMeters =
    getDistanceBetweenVenues(
      previousStop.venue,
      nextVisit.venue
    )

  if (
    distanceMeters === null &&
    missingCoordinatesPolicy === 'reject'
  ) {
    throw new Error(
      '[itineraryTimeline] Missing coordinates for route leg.'
    )
  }

  const travelMinutes =
    distanceMeters !== null
      ? estimateTravelMinutes(
          distanceMeters,
          travelMode
        )
      : resolveFallbackTravelMinutes(
          travelMode,
          fallbackTravelMinutes
        )

  const arrival = addMinutes(
    previousDeparture,
    travelMinutes
  )

  const dwellMinutes =
    resolveDwellMinutes(nextVisit)

  const departure = addMinutes(
    arrival,
    dwellMinutes
  )

  return {
    venue: nextVisit.venue,
    role: readExperienceRole(nextVisit.role),
    stopOrder: previousStop.stopOrder + 1,
    arriveAt: arrival.toISOString(),
    departAt: departure.toISOString(),
    dwellMinutes,
    travelMinutesFromPrevious: travelMinutes,
    distanceMetersFromPrevious: distanceMeters,
  }
}

/**
 * Calculate route-level aggregates from scheduled stops.
 *
 * totalRouteMinutes includes anchor dwell and final dwell.
 */
export function summarizeItineraryTimeline(
  stops: readonly ItineraryTimelineStop[]
): ItineraryTimelineTotals {
  if (stops.length === 0) {
    throw new Error(
      '[itineraryTimeline] Cannot summarize an empty itinerary.'
    )
  }

  const start = parseRequiredDate(
    stops[0].arriveAt,
    'first stop arrival'
  )

  const end = parseRequiredDate(
    stops[stops.length - 1].departAt,
    'last stop departure'
  )

  return {
    totalStops: stops.length,

    totalDistanceMeters: stops.reduce(
      (sum, stop) =>
        sum + (stop.distanceMetersFromPrevious ?? 0),
      0
    ),

    totalTravelMinutes: stops.reduce(
      (sum, stop) =>
        sum + (stop.travelMinutesFromPrevious ?? 0),
      0
    ),

    totalDwellMinutes: stops.reduce(
      (sum, stop) =>
        sum + stop.dwellMinutes,
      0
    ),

    totalRouteMinutes: Math.max(
      0,
      Math.round(
        (end.getTime() - start.getTime()) / 60000
      )
    ),

    startedAt: start.toISOString(),
    endsAt: end.toISOString(),
  }
}

/**
 * Validate a planned timeline before sending it to the
 * client or persisting it.
 *
 * This function does not repair incorrect timestamps.
 */
export function validateItineraryTimeline(
  stops: readonly ItineraryTimelineStop[]
): ItineraryTimelineValidationResult {
  const issues: ItineraryTimelineValidationIssue[] = []

  if (stops.length === 0) {
    issues.push({
      code: 'empty_itinerary',
      stopOrder: null,
      message: 'The itinerary has no stops.',
    })

    return {
      valid: false,
      issues,
    }
  }

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]

    const arrival = parseOptionalDate(
      stop.arriveAt
    )

    const departure = parseOptionalDate(
      stop.departAt
    )

    const expectedOrder = index + 1

    if (stop.stopOrder !== expectedOrder) {
      issues.push({
        code: 'invalid_stop_order',
        stopOrder: stop.stopOrder,
        message:
          `Expected stop order ${expectedOrder}, ` +
          `received ${stop.stopOrder}.`,
      })
    }

    if (!arrival) {
      issues.push({
        code: 'invalid_arrival',
        stopOrder: stop.stopOrder,
        message: 'The stop has an invalid arrival timestamp.',
      })
    }

    if (!departure) {
      issues.push({
        code: 'invalid_departure',
        stopOrder: stop.stopOrder,
        message: 'The stop has an invalid departure timestamp.',
      })
    }

    if (
      !Number.isFinite(stop.dwellMinutes) ||
      stop.dwellMinutes < 0
    ) {
      issues.push({
        code: 'negative_dwell',
        stopOrder: stop.stopOrder,
        message: 'The stop has invalid dwell minutes.',
      })
    }

    if (
      arrival &&
      departure &&
      Number.isFinite(stop.dwellMinutes) &&
      stop.dwellMinutes >= 0
    ) {
      const actualDwellMinutes =
        (departure.getTime() - arrival.getTime()) /
        60000

      if (
        Math.abs(
          actualDwellMinutes - stop.dwellMinutes
        ) > 0.01
      ) {
        issues.push({
          code: 'invalid_duration',
          stopOrder: stop.stopOrder,
          message:
            'Departure does not match arrival plus dwell time.',
        })
      }
    }

    if (index === 0) {
      continue
    }

    const previousStop = stops[index - 1]
    const previousDeparture = parseOptionalDate(
      previousStop.departAt
    )

    if (
      arrival &&
      previousDeparture &&
      arrival < previousDeparture
    ) {
      issues.push({
        code: 'chronological_overlap',
        stopOrder: stop.stopOrder,
        message:
          'The stop begins before the previous visit ends.',
      })
    }

    if (
      arrival &&
      previousDeparture &&
      typeof stop.travelMinutesFromPrevious === 'number' &&
      Number.isFinite(stop.travelMinutesFromPrevious)
    ) {
      const actualTravelMinutes =
        (
          arrival.getTime() -
          previousDeparture.getTime()
        ) / 60000

      if (
        stop.travelMinutesFromPrevious < 0 ||
        Math.abs(
          actualTravelMinutes -
          stop.travelMinutesFromPrevious
        ) > 0.01
      ) {
        issues.push({
          code: 'travel_time_mismatch',
          stopOrder: stop.stopOrder,
          message:
            'Arrival does not match previous departure plus travel time.',
        })
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Calculate straight-line distance using the existing
 * route utility. No new distance model is introduced.
 */
export function getDistanceBetweenVenues(
  fromVenue: ItineraryTimelineVenue,
  toVenue: ItineraryTimelineVenue
): number | null {
  if (
    !hasValidCoordinates(fromVenue) ||
    !hasValidCoordinates(toVenue)
  ) {
    return null
  }

  return calculateDistanceMeters({
    fromLat: fromVenue.lat as number,
    fromLon: fromVenue.lon as number,
    toLat: toVenue.lat as number,
    toLon: toVenue.lon as number,
  })
}

/**
 * Resolve the duration of a visit without confusing it
 * with dwell time at the previous venue.
 *
 * Priority:
 * 1. Explicit nonnegative dwell duration.
 * 2. Resolved experience-role planning default.
 * 3. Generic fallback.
 */
export function resolveDwellMinutes(
  visit: ItineraryTimelineVisitInput
): number {
  if (
    typeof visit.dwellMinutes === 'number' &&
    Number.isFinite(visit.dwellMinutes) &&
    visit.dwellMinutes >= 0
  ) {
    return Math.round(
      visit.dwellMinutes
    )
  }

  const role = readExperienceRole(
    visit.role
  )

  if (role) {
    return getExperienceRoleDefinition(
      role
    ).defaultDwellMinutes
  }

  return DEFAULT_DWELL_MINUTES
}

/* =========================================================
 * Internal helpers
 * ======================================================= */

function readExperienceRole(
  role:
    | ExperienceRole
    | ExperienceRoleResolution
    | null
    | undefined
): ExperienceRole | null {
  if (!role) {
    return null
  }

  return typeof role === 'string'
    ? role
    : role.role
}

function resolveFallbackTravelMinutes(
  travelMode: ArrivalTimeTravelMode,
  override: number | undefined
): number {
  if (
    typeof override === 'number' &&
    Number.isFinite(override) &&
    override >= 0
  ) {
    return Math.round(override)
  }

  return DEFAULT_FALLBACK_TRAVEL_MINUTES[
    travelMode
  ]
}

function parseRequiredDate(
  value: Date | string,
  label: string
): Date {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value)

  if (
    !Number.isFinite(date.getTime())
  ) {
    throw new Error(
      `[itineraryTimeline] Invalid ${label}.`
    )
  }

  return date
}

function parseOptionalDate(
  value: Date | string | null | undefined
): Date | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value)

  return Number.isFinite(date.getTime())
    ? date
    : null
}
