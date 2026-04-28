// lib/outings/sequenceScoring/geometry.ts

import type { Mobility, PlanningContext, PlanningSlot, VenueRecord } from "../types"

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusMeters = 6371e3

  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const deltaPhi = toRad(lat2 - lat1)
  const deltaLambda = toRad(lon2 - lon1)

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(earthRadiusMeters * c)
}

export function getDistanceBetweenVenues(
  from: Pick<VenueRecord, "lat" | "lon">,
  to: Pick<VenueRecord, "lat" | "lon">
): number | null {
  if (
    from.lat == null ||
    from.lon == null ||
    to.lat == null ||
    to.lon == null
  ) {
    return null
  }

  return haversineMeters(from.lat, from.lon, to.lat, to.lon)
}

export function inferTravelMode(
  mobility: Mobility,
  distanceMeters: number | null
): "walk" | "drive" | "transit" | "rideshare" {
  if (mobility === "walk") return "walk"
  if (distanceMeters != null && distanceMeters < 1200) return "walk"
  if (mobility === "short_ride") return "rideshare"
  return "drive"
}

export function estimateTravelMinutes(
  mobility: Mobility,
  distanceMeters: number | null
): number | null {
  if (distanceMeters == null) return null

  if (mobility === "walk") {
    return Math.max(5, Math.round(distanceMeters / 75))
  }

  if (mobility === "short_ride") {
    if (distanceMeters < 1200) {
      return Math.max(5, Math.round(distanceMeters / 75))
    }
    return Math.max(6, Math.round(distanceMeters / 300))
  }

  return Math.max(6, Math.round(distanceMeters / 350))
}

export function isTooFarForBeforeFirstStop(
  anchorDistance: number | null,
  mobility: Mobility,
  relaxed = false
): boolean {
  if (anchorDistance == null) return false
  if (mobility === "walk") return anchorDistance > (relaxed ? 2000 : 1400)
  if (mobility === "short_ride") return anchorDistance > (relaxed ? 3800 : 2800)
  return anchorDistance > (relaxed ? 5500 : 4500)
}

export function isTooFarForAfterFirstStop(
  anchorDistance: number | null,
  mobility: Mobility,
  relaxed = false
): boolean {
  if (anchorDistance == null) return false
  if (mobility === "walk") return anchorDistance > (relaxed ? 2200 : 1600)
  if (mobility === "short_ride") return anchorDistance > (relaxed ? 4200 : 3200)
  return anchorDistance > (relaxed ? 6000 : 5000)
}

export function getMaxAfterInterstopMeters(
  mobility: Mobility,
  relaxed = false
): number {
  if (mobility === "walk") return relaxed ? 1200 : 900
  if (mobility === "short_ride") return relaxed ? 2200 : 1600
  return relaxed ? 3200 : 2400
}

export function getMaxAfterLocalFallbackMeters(mobility: Mobility): number {
  if (mobility === "walk") return 700
  if (mobility === "short_ride") return 1400
  return 2200
}

export function shouldResetRouteAtEvent(
  context: PlanningContext,
  slot: PlanningSlot
): boolean {
  return context.mode === "full" && slot.phase === "after"
}

export function isFirstAfterSlotInFullMode(
  context: PlanningContext,
  slot: PlanningSlot,
  selectedAfterStopCount = 0
): boolean {
  return shouldResetRouteAtEvent(context, slot) && selectedAfterStopCount === 0
}

export function getFirstPostEventSelectedStop(
  selectedSoFar: VenueRecord[],
  context: PlanningContext
): VenueRecord | null {
  if (context.mode === "after") {
    return selectedSoFar[0] ?? null
  }

  if (context.mode === "full") {
    return selectedSoFar[1] ?? null
  }

  return null
}

export function isAfterSequenceDirectionallyConsistent(
  selectedSoFar: VenueRecord[],
  candidate: VenueRecord,
  context: PlanningContext,
  slot: PlanningSlot
): boolean {
  if (slot.phase !== "after") return true

  const anchor = context.anchorVenue
  const previous = selectedSoFar[selectedSoFar.length - 1] ?? null
  const firstPostEventStop = getFirstPostEventSelectedStop(selectedSoFar, context)

  if (!anchor || !previous || !firstPostEventStop) return true
  if (
    anchor.lat == null ||
    anchor.lon == null ||
    firstPostEventStop.lat == null ||
    firstPostEventStop.lon == null ||
    previous.lat == null ||
    previous.lon == null ||
    candidate.lat == null ||
    candidate.lon == null
  ) {
    return false
  }

  const outboundX = firstPostEventStop.lon - anchor.lon
  const outboundY = firstPostEventStop.lat - anchor.lat
  const stepX = candidate.lon - previous.lon
  const stepY = candidate.lat - previous.lat

  const outboundMagnitude = Math.hypot(outboundX, outboundY)
  const stepMagnitude = Math.hypot(stepX, stepY)

  if (outboundMagnitude === 0 || stepMagnitude === 0) return true

  const dot =
    (outboundX * stepX + outboundY * stepY) /
    (outboundMagnitude * stepMagnitude)

  return dot >= 0.42
}

export function isDirectionallyConsistentFromAnchorRoute({
  anchor,
  firstStop,
  previousStop,
  candidate,
  minimumDot = 0.42,
}: {
  anchor: Pick<VenueRecord, "lat" | "lon"> | null
  firstStop: Pick<VenueRecord, "lat" | "lon"> | null
  previousStop: Pick<VenueRecord, "lat" | "lon"> | null
  candidate: Pick<VenueRecord, "lat" | "lon">
  minimumDot?: number
}): boolean {
  if (!anchor || !firstStop || !previousStop) return true

  if (
    anchor.lat == null ||
    anchor.lon == null ||
    firstStop.lat == null ||
    firstStop.lon == null ||
    previousStop.lat == null ||
    previousStop.lon == null ||
    candidate.lat == null ||
    candidate.lon == null
  ) {
    return false
  }

  const outboundX = firstStop.lon - anchor.lon
  const outboundY = firstStop.lat - anchor.lat
  const stepX = candidate.lon - previousStop.lon
  const stepY = candidate.lat - previousStop.lat

  const outboundMagnitude = Math.hypot(outboundX, outboundY)
  const stepMagnitude = Math.hypot(stepX, stepY)

  if (outboundMagnitude === 0 || stepMagnitude === 0) return true

  const dot =
    (outboundX * stepX + outboundY * stepY) /
    (outboundMagnitude * stepMagnitude)

  return dot >= minimumDot
}