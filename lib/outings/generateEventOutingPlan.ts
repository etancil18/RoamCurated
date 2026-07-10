// lib/outings/generateEventOutingPlan.ts

import { buildPlanningContext } from "./planningContext"
import {
  buildPlanSummary,
  buildSelectionDebug,
  computeConfidenceScore,
  generatePlanStops,
  rankVenueCandidates,
} from "./sequenceScoring"
import {
  estimateTravelMinutes,
  getDistanceBetweenVenues,
  inferTravelMode,
} from "./sequenceScoring/geometry"
import { qualifiesForReducedBeforeSingleStopFallback } from "./sequenceScoring/daytime"
import type {
  GenerateEventOutingPlanInput,
  GenerateEventOutingPlanResult,
  GeneratedOutingStop,
  PlanMode,
  PlanningContext,
  SelectionPass,
  SlotPhase,
} from "./types"

type RouteQualityDiagnostics = {
  generatedStopCount: number
  retainedStopCount: number
  removedSpatialOutlierCount: number
  strictStopCount: number
  balancedStopCount: number
  relaxedStopCount: number
  emergencyStopCount: number
  routeVibeConfidence: number | null
}

function annotateBookingRecommendations({
  mode,
  stops,
}: {
  mode: PlanMode
  stops: GeneratedOutingStop[]
}): GeneratedOutingStop[] {
  const normalizedStops = stops.map((stop) => ({
    ...stop,
    reservationRecommended: false,
    recommendedReservationAt: null,
  }))

  if (mode === "after") return normalizedStops

  const firstReservableFoodIndex = normalizedStops.findIndex(
    (stop) =>
      stop.phase === "before" &&
      stop.role === "food" &&
      Array.isArray(stop.bookingOptions) &&
      stop.bookingOptions.length > 0
  )

  if (firstReservableFoodIndex === -1) {
    return normalizedStops
  }

  return normalizedStops.map((stop, index) =>
    index === firstReservableFoodIndex
      ? {
          ...stop,
          reservationRecommended: true,
          recommendedReservationAt: stop.plannedArrivalAt ?? null,
        }
      : stop
  )
}

function annotateArchetypeMetadata({
  stops,
  eventArchetype,
}: {
  stops: GeneratedOutingStop[]
  eventArchetype: string
}): GeneratedOutingStop[] {
  return stops.map((stop) => ({
    ...stop,
    metadata: {
      ...(stop.metadata ?? {}),
      eventArchetype:
        stop.metadata?.eventArchetype ??
        eventArchetype,
      semanticRole:
        stop.metadata?.semanticRole ??
        null,
      slotPhase:
        stop.metadata?.slotPhase ??
        stop.phase ??
        null,
      slotIndex:
        stop.metadata?.slotIndex ??
        stop.stopOrder - 1,
    },
  }))
}

function annotateVibeMetadata({
  stops,
  context,
}: {
  stops: GeneratedOutingStop[]
  context: PlanningContext
}): GeneratedOutingStop[] {
  if (context.vibeTags.length === 0 && !context.vibePlanning) {
    return stops
  }

  const requestedTokens = new Set(
    normalizeTokens([
      ...context.vibeTags,
      ...(context.vibePlanning?.preferredTypes ?? []),
      ...(context.vibePlanning?.requiredAnyTypes ?? []),
    ])
  )

  return stops.map((stop) => {
    const candidateTokens = normalizeTokens([
      ...(stop.metadata?.venueTypes ?? []),
      stop.metadata?.venueType ?? "",
      stop.metadata?.displayType ?? "",
      stop.displayType ?? "",
      stop.venueType ?? "",
      stop.role,
    ])

    const matchedTokens = uniqueStrings(
      candidateTokens.filter((token) => requestedTokens.has(token))
    )

    const matchedRequiredType =
      context.vibePlanning?.requiredAnyTypes?.length
        ? candidateTokens.some((token) =>
            context.vibePlanning?.requiredAnyTypes.includes(token)
          )
        : true

    const matchedPreferredType =
      context.vibePlanning?.preferredTypes?.length
        ? candidateTokens.some((token) =>
            context.vibePlanning?.preferredTypes.includes(token)
          )
        : matchedTokens.length > 0

    const matchedDiscouragedType =
      context.vibePlanning?.stronglyDiscouragedTypes?.some((type) =>
        candidateTokens.includes(type)
      ) ?? false

    const vibeScore =
      Math.min(matchedTokens.length, 4) * 0.15 +
      (matchedRequiredType ? 0.2 : 0) +
      (matchedPreferredType ? 0.2 : 0) -
      (matchedDiscouragedType ? 0.35 : 0)

    const vibeConfidence = clamp01(vibeScore)

    return {
      ...stop,
      metadata: {
        ...(stop.metadata ?? {}),
        vibeMatchedTypes: matchedTokens,
        vibeScore: Number(vibeScore.toFixed(2)),
        vibeConfidence: Number(vibeConfidence.toFixed(2)),
      },
    }
  })
}

function normalizeFullModeAfterTransitions({
  stops,
  context,
}: {
  stops: GeneratedOutingStop[]
  context: PlanningContext
}): GeneratedOutingStop[] {
  let hasSeenAfterStop = false

  return stops.map((stop) => {
    const isFirstAfterStopInFullMode =
      context.mode === "full" &&
      stop.phase === "after" &&
      !hasSeenAfterStop

    if (stop.phase === "after") {
      hasSeenAfterStop = true
    }

    if (
      !isFirstAfterStopInFullMode ||
      !context.anchorVenue
    ) {
      return stop
    }

    const distanceFromAnchor = getDistanceBetweenVenues(
      context.anchorVenue,
      {
        lat: stop.lat ?? null,
        lon: stop.lon ?? null,
      }
    )

    return {
      ...stop,
      distanceMetersFromPrev: distanceFromAnchor,
      travelMode: inferTravelMode(
        context.mobility,
        distanceFromAnchor,
        context
      ),
      travelMinutesFromPrev: estimateTravelMinutes(
        context.mobility,
        distanceFromAnchor,
        context
      ),
    }
  })
}

function normalizeStopTransitions({
  stops,
  context,
}: {
  stops: GeneratedOutingStop[]
  context: PlanningContext
}): GeneratedOutingStop[] {
  let previousBeforeStop: GeneratedOutingStop | null = null
  let previousAfterStop: GeneratedOutingStop | null = null

  return stops.map((stop, index) => {
    const isFirstStop = index === 0
    const isFirstAfterStop =
      stop.phase === "after" &&
      previousAfterStop == null

    let distanceFromPrev = stop.distanceMetersFromPrev ?? null

    if (
      isFirstAfterStop &&
      context.anchorVenue
    ) {
      distanceFromPrev = getDistanceBetweenVenues(
        context.anchorVenue,
        {
          lat: stop.lat ?? null,
          lon: stop.lon ?? null,
        }
      )
    } else if (
      stop.phase === "before" &&
      previousBeforeStop
    ) {
      distanceFromPrev = getDistanceBetweenVenues(
        {
          lat: previousBeforeStop.lat ?? null,
          lon: previousBeforeStop.lon ?? null,
        },
        {
          lat: stop.lat ?? null,
          lon: stop.lon ?? null,
        }
      )
    } else if (
      stop.phase === "after" &&
      previousAfterStop
    ) {
      distanceFromPrev = getDistanceBetweenVenues(
        {
          lat: previousAfterStop.lat ?? null,
          lon: previousAfterStop.lon ?? null,
        },
        {
          lat: stop.lat ?? null,
          lon: stop.lon ?? null,
        }
      )
    }

    const normalizedStop: GeneratedOutingStop = {
      ...stop,
      stopOrder: index + 1,
      distanceMetersFromPrev: distanceFromPrev,
      travelMode: inferTravelMode(
        context.mobility,
        distanceFromPrev,
        context
      ),
      travelMinutesFromPrev:
        isFirstStop && stop.phase === "before"
          ? null
          : estimateTravelMinutes(
              context.mobility,
              distanceFromPrev,
              context
            ),
    }

    if (stop.phase === "before") {
      previousBeforeStop = normalizedStop
    }

    if (stop.phase === "after") {
      previousAfterStop = normalizedStop
    }

    return normalizedStop
  })
}

function applySpatialSafetyGate({
  stops,
  context,
}: {
  stops: GeneratedOutingStop[]
  context: PlanningContext
}): {
  stops: GeneratedOutingStop[]
  removedSpatialOutlierCount: number
} {
  const retainedStops: GeneratedOutingStop[] = []
  let removedSpatialOutlierCount = 0

  for (const stop of stops) {
    if (
      isStopWithinAbsoluteSpatialLimit(
        stop,
        retainedStops,
        context
      )
    ) {
      retainedStops.push(stop)
    } else {
      removedSpatialOutlierCount += 1
    }
  }

  return {
    stops: retainedStops.map((stop, index) => ({
      ...stop,
      stopOrder: index + 1,
    })),
    removedSpatialOutlierCount,
  }
}

function isStopWithinAbsoluteSpatialLimit(
  stop: GeneratedOutingStop,
  acceptedStops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (stop.distanceMetersFromPrev == null) {
    return true
  }

  const previousAccepted =
    acceptedStops[acceptedStops.length - 1] ??
    null

  if (!previousAccepted) {
    return (
      stop.distanceMetersFromPrev <=
      getAbsoluteAnchorDistanceLimit(context)
    )
  }

  if (stop.phase === "after") {
    return (
      stop.distanceMetersFromPrev <=
      getAbsoluteAfterInterstopLimit(context)
    )
  }

  return (
    stop.distanceMetersFromPrev <=
    getAbsoluteBeforeInterstopLimit(context)
  )
}

function getAbsoluteAnchorDistanceLimit(
  context: PlanningContext
): number {
  const configured =
    context.cityPlanning?.distances
      .maxAnchorDistanceMeters[context.mobility]

  if (
    typeof configured === "number" &&
    Number.isFinite(configured)
  ) {
    return Math.round(configured * 1.35)
  }

  if (context.mobility === "walk") return 1900
  if (context.mobility === "short_ride") return 4200

  return 6500
}

function getAbsoluteBeforeInterstopLimit(
  context: PlanningContext
): number {
  const configured =
    context.cityPlanning?.distances
      .beforeInterstopMeters.relaxed

  if (
    typeof configured === "number" &&
    Number.isFinite(configured)
  ) {
    return Math.round(configured * 1.2)
  }

  if (context.mobility === "walk") return 2900
  if (context.mobility === "short_ride") return 5400

  return 7200
}

function getAbsoluteAfterInterstopLimit(
  context: PlanningContext
): number {
  const configured =
    context.cityPlanning?.distances
      .afterInterstopMeters.relaxed

  if (
    typeof configured === "number" &&
    Number.isFinite(configured)
  ) {
    return Math.round(configured * 1.2)
  }

  if (context.mobility === "walk") return 1800
  if (context.mobility === "short_ride") return 3200

  return 4800
}

function computeRouteVibeConfidence(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): number | null {
  if (
    context.vibeTags.length === 0 &&
    !context.vibePlanning
  ) {
    return null
  }

  if (stops.length === 0) {
    return 0
  }

  const stopConfidences = stops.map((stop) => {
    const value = stop.metadata?.vibeConfidence

    return typeof value === "number" &&
      Number.isFinite(value)
      ? clamp01(value)
      : 0
  })

  const average =
    stopConfidences.reduce(
      (sum, value) => sum + value,
      0
    ) / stopConfidences.length

  const weakestStop = Math.min(...stopConfidences)

  return Number(
    clamp01(
      average * 0.75 +
        weakestStop * 0.25
    ).toFixed(2)
  )
}

function countSelectionPasses(
  stops: GeneratedOutingStop[]
): Record<SelectionPass, number> {
  const counts: Record<SelectionPass, number> = {
    strict: 0,
    balanced: 0,
    relaxed: 0,
    emergency: 0,
  }

  for (const stop of stops) {
    const selectedPass =
      stop.metadata?.selectedPass

    if (
      selectedPass === "strict" ||
      selectedPass === "balanced" ||
      selectedPass === "relaxed" ||
      selectedPass === "emergency"
    ) {
      counts[selectedPass] += 1
    }
  }

  return counts
}

function computeFinalConfidenceScore({
  stops,
  context,
  intendedStopCount,
  effectiveIntendedStopCount,
  routeVibeConfidence,
  removedSpatialOutlierCount,
}: {
  stops: GeneratedOutingStop[]
  context: PlanningContext
  intendedStopCount: number
  effectiveIntendedStopCount: number
  routeVibeConfidence: number | null
  removedSpatialOutlierCount: number
}): number {
  const baseConfidence =
    computeConfidenceScore(stops, context)

  const completionRate =
    effectiveIntendedStopCount > 0
      ? Math.min(
          stops.length / effectiveIntendedStopCount,
          1
        )
      : 0

  const passCounts = countSelectionPasses(stops)
  const stopCount = Math.max(stops.length, 1)

  const strictRatio =
    passCounts.strict / stopCount

  const balancedRatio =
    passCounts.balanced / stopCount

  const relaxedRatio =
    passCounts.relaxed / stopCount

  const emergencyRatio =
    passCounts.emergency / stopCount

  let qualityScore =
    strictRatio * 1 +
    balancedRatio * 0.82 +
    relaxedRatio * 0.62 +
    emergencyRatio * 0.28

  if (stops.length === 0) {
    qualityScore = 0
  }

  const vibeScore =
    routeVibeConfidence ?? 0.7

  const coverageWeight =
    intendedStopCount > 0
      ? 0.3
      : 0.15

  let score =
    baseConfidence * 0.35 +
    completionRate * coverageWeight +
    qualityScore * 0.2 +
    vibeScore * 0.15

  if (removedSpatialOutlierCount > 0) {
    score -= Math.min(
      removedSpatialOutlierCount * 0.08,
      0.2
    )
  }

  if (passCounts.emergency > 0) {
    score -= Math.min(
      passCounts.emergency * 0.1,
      0.25
    )
  }

  if (completionRate < 1) {
    score -= (1 - completionRate) * 0.15
  }

  return Number(
    clamp(
      score,
      0,
      0.99
    ).toFixed(2)
  )
}

function buildRouteQualityDiagnostics({
  rawStops,
  finalStops,
  removedSpatialOutlierCount,
  routeVibeConfidence,
}: {
  rawStops: GeneratedOutingStop[]
  finalStops: GeneratedOutingStop[]
  removedSpatialOutlierCount: number
  routeVibeConfidence: number | null
}): RouteQualityDiagnostics {
  const passCounts =
    countSelectionPasses(finalStops)

  return {
    generatedStopCount: rawStops.length,
    retainedStopCount: finalStops.length,
    removedSpatialOutlierCount,
    strictStopCount: passCounts.strict,
    balancedStopCount: passCounts.balanced,
    relaxedStopCount: passCounts.relaxed,
    emergencyStopCount: passCounts.emergency,
    routeVibeConfidence,
  }
}

function normalizeTokens(
  values: Array<string | null | undefined>
): string[] {
  return uniqueStrings(
    values.flatMap((value) => {
      if (!value) return []

      const normalizedValue = String(value)
        .trim()
        .toLowerCase()

      if (!normalizedValue) return []

      return [
        normalizedValue,
        ...normalizedValue
          .split(/[\s,./|_\-–—]+/)
          .map((token) => token.trim())
          .filter(Boolean),
      ]
    })
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  )
}

export function generateEventOutingPlan(
  input: GenerateEventOutingPlanInput
): GenerateEventOutingPlanResult {
  const context = buildPlanningContext({
    mode: input.mode,
    event: input.event,
    anchorVenue: input.anchorVenue,
    groupSize: input.groupSize,
    budget: input.budget,
    mobility: input.mobility,
    vibeTags: input.vibeTags,
    timeZone: input.timeZone,
    leaveEarlyByHours: input.leaveEarlyByHours,
    cityPlanning: input.cityPlanning,
  })

  const rankedCandidates = rankVenueCandidates(
    input.candidateVenues,
    context
  )

  const rawStops = generatePlanStops(
    rankedCandidates,
    context
  )

  const fullModeNormalizedStops =
    normalizeFullModeAfterTransitions({
      stops: rawStops,
      context,
    })

  const transitionNormalizedStops =
    normalizeStopTransitions({
      stops: fullModeNormalizedStops,
      context,
    })

  const spatialSafetyResult =
    applySpatialSafetyGate({
      stops: transitionNormalizedStops,
      context,
    })

  const archetypeAnnotatedStops =
    annotateArchetypeMetadata({
      stops: spatialSafetyResult.stops,
      eventArchetype: context.eventArchetype,
    })

  const vibeAnnotatedStops =
    annotateVibeMetadata({
      stops: archetypeAnnotatedStops,
      context,
    })

  const stops =
    annotateBookingRecommendations({
      mode: input.mode,
      stops: vibeAnnotatedStops,
    })

  const intendedStopCount =
    context.slots?.length ??
    context.desiredRoles.length

  const reducedBeforeSingleStopFallbackApplied =
    qualifiesForReducedBeforeSingleStopFallback(
      stops,
      context
    )

  const effectiveIntendedStopCount =
    reducedBeforeSingleStopFallbackApplied
      ? Math.min(intendedStopCount, 1)
      : intendedStopCount

  const completionRate =
    effectiveIntendedStopCount > 0
      ? Number(
          Math.min(
            stops.length /
              effectiveIntendedStopCount,
            1
          ).toFixed(2)
        )
      : 0

  const failedToGenerateStops =
    intendedStopCount > 0 &&
    stops.length === 0

  const routeVibeConfidence =
    computeRouteVibeConfidence(
      stops,
      context
    )

  const confidenceScore =
    computeFinalConfidenceScore({
      stops,
      context,
      intendedStopCount,
      effectiveIntendedStopCount,
      routeVibeConfidence,
      removedSpatialOutlierCount:
        spatialSafetyResult.removedSpatialOutlierCount,
    })

  const debug = buildSelectionDebug(
    rankedCandidates,
    context
  )

  const routeQuality =
    buildRouteQualityDiagnostics({
      rawStops,
      finalStops: stops,
      removedSpatialOutlierCount:
        spatialSafetyResult.removedSpatialOutlierCount,
      routeVibeConfidence,
    })

  return {
    source:
      input.event.tags?.length
        ? "event"
        : "venue_fallback",
    mode: input.mode,
    eventArchetype: context.eventArchetype,
    eventTags: context.eventTags,
    confidenceScore,
    plannedStartAt:
      context.plannedStartAt.toISOString(),
    plannedEndAt:
      context.plannedEndAt.toISOString(),
    estimatedEndAt:
      context.estimatedEndAt.toISOString(),
    leaveEarlyByHours:
      context.leaveEarlyByHours ?? null,
    plannedExitAt:
      context.plannedExitAt?.toISOString() ??
      null,
    effectiveExitAt:
      context.effectiveExitAt?.toISOString() ??
      null,
    summary: buildPlanSummary({
      mode: input.mode,
      eventTitle: input.event.title,
      venueName:
        input.anchorVenue?.name ?? null,
      stops,
      planningContext: context,
    }),
    stops,
    debug: {
      ...debug,
      completionRate,
      vibeDiagnostics: context.vibePlanning
        ? {
            requestedVibes: context.vibeTags,
            preferredTypes:
              context.vibePlanning.preferredTypes,
            requiredAnyTypes:
              context.vibePlanning.requiredAnyTypes,
            discouragedTypes:
              context.vibePlanning.discouragedTypes,
            stronglyDiscouragedTypes:
              context.vibePlanning.stronglyDiscouragedTypes,
            preferredDayparts:
              context.vibePlanning.preferredDayparts,
            discouragedDayparts:
              context.vibePlanning.discouragedDayparts,
            matchedCandidateCount:
              stops.filter(
                (stop) =>
                  (
                    stop.metadata
                      ?.vibeMatchedTypes
                      ?.length ?? 0
                  ) > 0
              ).length,
            rejectedCandidateCount:
              spatialSafetyResult
                .removedSpatialOutlierCount,
            routeVibeConfidence,
          }
        : null,
    },
    scoreBreakdown: {
      mode: input.mode,
      city:
        input.anchorVenue?.city ?? null,
      eventTags: context.eventTags,
      eventArchetype:
        context.eventArchetype,
      candidatePoolSize:
        input.candidateVenues.length,
      selectedStops: stops.length,
      preparedCandidateCount:
        rankedCandidates.length,
      intendedStopCount,
      effectiveIntendedStopCount,
      completionRate,
      failedToGenerateStops,
      reducedBeforeSingleStopFallbackApplied,
      leaveEarlyByHours:
        context.leaveEarlyByHours ?? null,
      plannedExitAt:
        context.plannedExitAt?.toISOString() ??
        null,
      effectiveExitAt:
        context.effectiveExitAt?.toISOString() ??
        null,
      vibeTags: context.vibeTags,
      vibePreferredTypes:
        context.vibePlanning?.preferredTypes ??
        [],
      vibeDiscouragedTypes:
        context.vibePlanning
          ?.discouragedTypes ?? [],
      routeVibeConfidence,
      routeQuality,
    },
  } as GenerateEventOutingPlanResult
}