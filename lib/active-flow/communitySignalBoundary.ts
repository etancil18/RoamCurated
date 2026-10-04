/**
 * 021B — Active Flow Community Signal geographic boundary.
 *
 * A Community Signal may influence an Active Flow only when its venue
 * is within 350 meters of at least one relevant remaining executable
 * runtime stop.
 *
 * This module is deliberately pure.
 *
 * It does NOT:
 *
 * - establish Community Signal truth
 * - establish freshness
 * - inspect user GPS
 * - inspect active_flow_sessions.venue_ids
 * - inspect active_flow_stops.position
 * - score route disruption
 * - apply travel-mode thresholds
 * - evaluate semantic/contextual fit
 * - evaluate Swap / Detour feasibility
 * - mutate the runtime route
 * - create physical-experience evidence
 */

export const ACTIVE_FLOW_COMMUNITY_SIGNAL_RADIUS_METERS =
  350

export type ActiveFlowBoundaryCoordinates = {
  lat: number | null
  lon: number | null
}

export type ActiveFlowCommunitySignalBoundaryStop = {
  id: string

  venue: ActiveFlowBoundaryCoordinates
}

export type ActiveFlowCommunitySignalBoundaryReason =
  | 'missing_signal_coordinates'
  | 'no_remaining_stops'
  | 'no_remaining_stop_coordinates'
  | 'outside_350m'
  | null

export type ActiveFlowCommunitySignalBoundaryResult = {
  eligible: boolean

  nearestStopId: string | null

  /**
   * Rounded straight-line distance to the nearest remaining runtime
   * stop with usable coordinates.
   *
   * Diagnostic only. Eligibility is evaluated against the unrounded
   * Haversine distance.
   */
  distanceMeters: number | null

  reason:
    ActiveFlowCommunitySignalBoundaryReason
}

type ValidCoordinates = {
  lat: number
  lon: number
}

const EARTH_RADIUS_METERS =
  6_371_000

function degreesToRadians(
  degrees: number
): number {
  return (
    degrees *
    Math.PI
  ) / 180
}

function getValidCoordinates(
  coordinates: ActiveFlowBoundaryCoordinates
): ValidCoordinates | null {
  const {
    lat,
    lon,
  } = coordinates

  if (
    typeof lat !== 'number' ||
    !Number.isFinite(lat) ||
    typeof lon !== 'number' ||
    !Number.isFinite(lon)
  ) {
    return null
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null
  }

  return {
    lat,
    lon,
  }
}

/**
 * Deterministic great-circle distance.
 *
 * This is geographic distance, not walking/driving route distance.
 */
export function activeFlowHaversineDistanceMeters(
  a: ValidCoordinates,
  b: ValidCoordinates
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

  const boundedHaversine =
    Math.min(
      1,
      Math.max(
        0,
        haversine
      )
    )

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(
        boundedHaversine
      ),
      Math.sqrt(
        1 -
          boundedHaversine
      )
    )

  return (
    EARTH_RADIUS_METERS *
    centralAngle
  )
}

/**
 * Evaluate the hard geographic eligibility boundary for one Community
 * Signal venue against canonical remaining executable runtime stops.
 *
 * Caller authority:
 *
 * `remainingStops` must already represent canonical uncompleted
 * executable runtime stops. This primitive deliberately does not
 * reconstruct runtime-route semantics.
 */
export function evaluateActiveFlowCommunitySignalBoundary({
  signalVenue,
  remainingStops,
}: {
  signalVenue: ActiveFlowBoundaryCoordinates

  remainingStops:
    readonly ActiveFlowCommunitySignalBoundaryStop[]
}): ActiveFlowCommunitySignalBoundaryResult {
  const signalCoordinates =
    getValidCoordinates(
      signalVenue
    )

  if (!signalCoordinates) {
    return {
      eligible: false,
      nearestStopId: null,
      distanceMeters: null,
      reason:
        'missing_signal_coordinates',
    }
  }

  if (
    remainingStops.length ===
    0
  ) {
    return {
      eligible: false,
      nearestStopId: null,
      distanceMeters: null,
      reason:
        'no_remaining_stops',
    }
  }

  let nearestStopId:
    string | null =
    null

  let nearestDistanceMeters =
    Number.POSITIVE_INFINITY

  for (
    const stop of
      remainingStops
  ) {
    const stopCoordinates =
      getValidCoordinates(
        stop.venue
      )

    if (
      !stopCoordinates
    ) {
      continue
    }

    const distanceMeters =
      activeFlowHaversineDistanceMeters(
        signalCoordinates,
        stopCoordinates
      )

    if (
      distanceMeters <
      nearestDistanceMeters
    ) {
      nearestDistanceMeters =
        distanceMeters

      nearestStopId =
        stop.id
    }
  }

  if (
    nearestStopId ===
      null ||
    !Number.isFinite(
      nearestDistanceMeters
    )
  ) {
    return {
      eligible: false,
      nearestStopId: null,
      distanceMeters: null,
      reason:
        'no_remaining_stop_coordinates',
    }
  }

  const eligible =
    nearestDistanceMeters <=
    ACTIVE_FLOW_COMMUNITY_SIGNAL_RADIUS_METERS

  return {
    eligible,

    nearestStopId,

    distanceMeters:
      Math.round(
        Math.max(
          0,
          nearestDistanceMeters
        )
      ),

    reason:
      eligible
        ? null
        : 'outside_350m',
  }
}