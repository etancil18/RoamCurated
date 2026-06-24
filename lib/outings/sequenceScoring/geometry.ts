// lib/outings/sequenceScoring/geometry.ts

import type {
  CityPlanningConfig,
  Mobility,
  PlanningContext,
  PlanningSlot,
  VenueRecord,
} from "../types"

type PlanningDistanceSource =
  | PlanningContext
  | CityPlanningConfig
  | null
  | undefined

type NormalizedPlanningArchetype =
  | "social_sports"
  | "music"
  | "networking"
  | "food_drink"
  | "arts_culture"
  | "wellness"
  | "nightlife"
  | "community"
  | "comedy"
  | "market"
  | "other"

const FULL_FLOW_BEFORE_INTERSTOP_COHERENCE_METERS: Record<
  Mobility,
  { strict: number; relaxed: number }
> = {
  walk: { strict: 1600, relaxed: 2200 },
  short_ride: { strict: 2600, relaxed: 3200 },
  any: { strict: 4200, relaxed: 5200 },
}

const FULL_FLOW_AFTER_INTERSTOP_COHERENCE_METERS: Record<
  Mobility,
  { strict: number; relaxed: number }
> = {
  walk: { strict: 1200, relaxed: 1700 },
  short_ride: { strict: 2200, relaxed: 3000 },
  any: { strict: 3600, relaxed: 4600 },
}

const ARCHETYPE_DISTANCE_MULTIPLIERS: Record<
  NormalizedPlanningArchetype,
  { before: number; after: number }
> = {
  social_sports: { before: 1.05, after: 1.05 },
  music: { before: 1, after: 1.05 },
  networking: { before: 0.9, after: 0.9 },
  food_drink: { before: 0.9, after: 0.9 },
  arts_culture: { before: 0.95, after: 0.95 },
  wellness: { before: 0.85, after: 0.85 },
  nightlife: { before: 0.95, after: 1.1 },
  community: { before: 0.9, after: 0.9 },
  comedy: { before: 1, after: 1 },
  market: { before: 0.85, after: 0.85 },
  other: { before: 1, after: 1 },
}

function isCityPlanningConfig(value: unknown): value is CityPlanningConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "distances" in value
  )
}

function isPlanningContext(value: unknown): value is PlanningContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "mode" in value &&
    "mobility" in value &&
    "eventArchetype" in value
  )
}

function resolveCityPlanning(
  source?: PlanningDistanceSource
): CityPlanningConfig | null {
  if (!source) return null

  if (isCityPlanningConfig(source)) {
    return source
  }

  return source.cityPlanning ?? null
}

function resolvePlanningContext(
  source?: PlanningDistanceSource
): PlanningContext | null {
  return isPlanningContext(source) ? source : null
}

function applyRelaxedDistance(base: number, relaxed = false): number {
  return relaxed ? Math.round(base * 1.35) : base
}

function getAnchorDistanceLimit(
  mobility: Mobility,
  source?: PlanningDistanceSource
): number | null {
  const cityPlanning = resolveCityPlanning(source)
  const value = cityPlanning?.distances.maxAnchorDistanceMeters[mobility]

  return typeof value === "number" && Number.isFinite(value) ? value : null
}

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
  distanceMeters: number | null,
  source?: PlanningDistanceSource
): "walk" | "drive" | "transit" | "rideshare" {
  const walkableMeters =
    getAnchorDistanceLimit("walk", source) ?? 1200

  if (mobility === "walk") return "walk"
  if (distanceMeters != null && distanceMeters < walkableMeters) return "walk"
  if (mobility === "short_ride") return "rideshare"
  return "drive"
}

export function estimateTravelMinutes(
  mobility: Mobility,
  distanceMeters: number | null,
  source?: PlanningDistanceSource
): number | null {
  if (distanceMeters == null) return null

  const walkableMeters =
    getAnchorDistanceLimit("walk", source) ?? 1200

  if (mobility === "walk") {
    return Math.max(5, Math.round(distanceMeters / 75))
  }

  if (mobility === "short_ride") {
    if (distanceMeters < walkableMeters) {
      return Math.max(5, Math.round(distanceMeters / 75))
    }

    return Math.max(6, Math.round(distanceMeters / 300))
  }

  return Math.max(6, Math.round(distanceMeters / 350))
}

export function isTooFarForBeforeFirstStop(
  anchorDistance: number | null,
  mobility: Mobility,
  relaxed = false,
  source?: PlanningDistanceSource
): boolean {
  if (anchorDistance == null) return false

  const override = getAnchorDistanceLimit(mobility, source)

  if (override != null) {
    return anchorDistance > applyRelaxedDistance(override, relaxed)
  }

  if (mobility === "walk") return anchorDistance > (relaxed ? 2000 : 1400)
  if (mobility === "short_ride") return anchorDistance > (relaxed ? 3800 : 2800)
  return anchorDistance > (relaxed ? 5500 : 4500)
}

export function isTooFarForAfterFirstStop(
  anchorDistance: number | null,
  mobility: Mobility,
  relaxed = false,
  source?: PlanningDistanceSource
): boolean {
  if (anchorDistance == null) return false

  const override = getAnchorDistanceLimit(mobility, source)

  if (override != null) {
    return anchorDistance > applyRelaxedDistance(override, relaxed)
  }

  if (mobility === "walk") return anchorDistance > (relaxed ? 2200 : 1600)
  if (mobility === "short_ride") return anchorDistance > (relaxed ? 4200 : 3200)
  return anchorDistance > (relaxed ? 6000 : 5000)
}

export function getMaxBeforeInterstopMeters(
  mobility: Mobility,
  relaxed = false,
  source?: PlanningDistanceSource
): number {
  const cityPlanning = resolveCityPlanning(source)
  const context = resolvePlanningContext(source)

  const value = relaxed
    ? cityPlanning?.distances.beforeInterstopMeters.relaxed
    : cityPlanning?.distances.beforeInterstopMeters.strict

  const cityLimit =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : relaxed
        ? 4500
        : 3500

  if (!context || context.mode !== "full") {
    return cityLimit
  }

  const coherenceLimit = getFullFlowInterstopCoherenceLimitMeters({
    context,
    phase: "before",
    relaxed,
  })

  return Math.min(cityLimit, coherenceLimit)
}

export function getMaxAfterInterstopMeters(
  mobility: Mobility,
  relaxed = false,
  source?: PlanningDistanceSource
): number {
  const cityPlanning = resolveCityPlanning(source)
  const context = resolvePlanningContext(source)

  const value = relaxed
    ? cityPlanning?.distances.afterInterstopMeters.relaxed
    : cityPlanning?.distances.afterInterstopMeters.strict

  const cityLimit =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : mobility === "walk"
        ? relaxed
          ? 1200
          : 900
        : mobility === "short_ride"
          ? relaxed
            ? 2200
            : 1600
          : relaxed
            ? 3200
            : 2400

  if (!context || context.mode !== "full") {
    return cityLimit
  }

  const coherenceLimit = getFullFlowInterstopCoherenceLimitMeters({
    context,
    phase: "after",
    relaxed,
  })

  return Math.min(cityLimit, coherenceLimit)
}

export function getMaxAfterLocalFallbackMeters(
  mobility: Mobility,
  source?: PlanningDistanceSource
): number {
  const cityPlanning = resolveCityPlanning(source)
  const afterStrict = cityPlanning?.distances.afterInterstopMeters.strict

  if (typeof afterStrict === "number" && Number.isFinite(afterStrict)) {
    return Math.round(afterStrict * 0.65)
  }

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

export function getFullFlowInterstopCoherenceLimitMeters({
  context,
  phase,
  relaxed = false,
}: {
  context: PlanningContext
  phase: "before" | "after"
  relaxed?: boolean
}): number {
  const table =
    phase === "before"
      ? FULL_FLOW_BEFORE_INTERSTOP_COHERENCE_METERS
      : FULL_FLOW_AFTER_INTERSTOP_COHERENCE_METERS

  const base = relaxed
    ? table[context.mobility].relaxed
    : table[context.mobility].strict

  const archetype = normalizePlanningArchetype(context.eventArchetype)
  const multiplier = ARCHETYPE_DISTANCE_MULTIPLIERS[archetype][phase]

  return Math.round(base * multiplier)
}

export function isSpatiallyCoherentInterstop({
  distanceMeters,
  context,
  slot,
  relaxed = false,
}: {
  distanceMeters: number | null
  context: PlanningContext
  slot: PlanningSlot
  relaxed?: boolean
}): boolean {
  if (distanceMeters == null) return true
  if (context.mode !== "full") return true

  const limit = getFullFlowInterstopCoherenceLimitMeters({
    context,
    phase: slot.phase,
    relaxed,
  })

  return distanceMeters <= limit
}

function normalizePlanningArchetype(
  value: string | null | undefined
): NormalizedPlanningArchetype {
  if (value === "art") return "arts_culture"
  if (value === "sports") return "social_sports"
  if (value === "festival") return "market"
  if (value === "general") return "other"

  if (
    value === "social_sports" ||
    value === "music" ||
    value === "networking" ||
    value === "food_drink" ||
    value === "arts_culture" ||
    value === "wellness" ||
    value === "nightlife" ||
    value === "community" ||
    value === "comedy" ||
    value === "market" ||
    value === "other"
  ) {
    return value
  }

  return "other"
}