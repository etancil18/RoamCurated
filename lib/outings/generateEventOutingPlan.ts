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
} from "./types"

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

  if (firstReservableFoodIndex === -1) return normalizedStops

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
      eventArchetype: stop.metadata?.eventArchetype ?? eventArchetype,
      semanticRole: stop.metadata?.semanticRole ?? null,
      slotPhase: stop.metadata?.slotPhase ?? stop.phase ?? null,
      slotIndex: stop.metadata?.slotIndex ?? stop.stopOrder - 1,
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
  if (!context.vibeTags.length && !context.vibePlanning) return stops

  return stops.map((stop) => ({
    ...stop,
    metadata: {
      ...(stop.metadata ?? {}),
      vibeTags: context.vibeTags,
      vibePreferredTypes: context.vibePlanning?.preferredTypes ?? [],
      vibeDiscouragedTypes: context.vibePlanning?.discouragedTypes ?? [],
      vibeRequiredAnyTypes: context.vibePlanning?.requiredAnyTypes ?? [],
    },
  }))
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
      context.mode === "full" && stop.phase === "after" && !hasSeenAfterStop

    if (stop.phase === "after") {
      hasSeenAfterStop = true
    }

    if (!isFirstAfterStopInFullMode || !context.anchorVenue) {
      return stop
    }

    const distanceFromAnchor = getDistanceBetweenVenues(context.anchorVenue, {
      lat: stop.lat ?? null,
      lon: stop.lon ?? null,
    })

    return {
      ...stop,
      distanceMetersFromPrev: distanceFromAnchor,
      travelMode: inferTravelMode(context.mobility, distanceFromAnchor, context),
      travelMinutesFromPrev: estimateTravelMinutes(
        context.mobility,
        distanceFromAnchor,
        context
      ),
    }
  })
}

function enforceSpatialCoherence({
  stops,
  context,
}: {
  stops: GeneratedOutingStop[]
  context: PlanningContext
}): GeneratedOutingStop[] {
  const coherentStops: GeneratedOutingStop[] = []

  for (const stop of stops) {
    if (isStopSpatiallyCoherent(stop, coherentStops, context)) {
      coherentStops.push(stop)
    }
  }

  return coherentStops.map((stop, index) => ({
    ...stop,
    stopOrder: index + 1,
  }))
}

function isStopSpatiallyCoherent(
  stop: GeneratedOutingStop,
  acceptedStops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (stop.distanceMetersFromPrev == null) return true

  const previousAccepted = acceptedStops[acceptedStops.length - 1] ?? null

  if (!previousAccepted) {
    return stop.distanceMetersFromPrev <= getMaxAnchorDistanceMeters(context)
  }

  if (stop.phase === "after") {
    return stop.distanceMetersFromPrev <= getMaxAfterInterstopMeters(context)
  }

  return stop.distanceMetersFromPrev <= getMaxBeforeInterstopMeters(context)
}

function getMaxAnchorDistanceMeters(context: PlanningContext): number {
  const cityValue =
    context.cityPlanning?.distances.maxAnchorDistanceMeters[context.mobility]

  if (typeof cityValue === "number" && Number.isFinite(cityValue)) {
    return cityValue
  }

  if (context.mobility === "walk") return 1400
  if (context.mobility === "short_ride") return 2800
  return 4500
}

function getMaxBeforeInterstopMeters(context: PlanningContext): number {
  const cityValue = context.cityPlanning?.distances.beforeInterstopMeters.strict

  if (typeof cityValue === "number" && Number.isFinite(cityValue)) {
    return cityValue
  }

  if (context.mobility === "walk") return 2400
  if (context.mobility === "short_ride") return 3500
  return 5000
}

function getMaxAfterInterstopMeters(context: PlanningContext): number {
  const cityValue = context.cityPlanning?.distances.afterInterstopMeters.strict

  if (typeof cityValue === "number" && Number.isFinite(cityValue)) {
    return cityValue
  }

  if (context.mobility === "walk") return 900
  if (context.mobility === "short_ride") return 1600
  return 2400
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

  const rankedCandidates = rankVenueCandidates(input.candidateVenues, context)

  const rawStops = generatePlanStops(rankedCandidates, context)

  const routeNormalizedStops = normalizeFullModeAfterTransitions({
    stops: rawStops,
    context,
  })

  const coherentStops = enforceSpatialCoherence({
    stops: routeNormalizedStops,
    context,
  })

  const archetypeAnnotatedStops = annotateArchetypeMetadata({
    stops: coherentStops,
    eventArchetype: context.eventArchetype,
  })

  const vibeAnnotatedStops = annotateVibeMetadata({
    stops: archetypeAnnotatedStops,
    context,
  })

  const stops = annotateBookingRecommendations({
    mode: input.mode,
    stops: vibeAnnotatedStops,
  })

  const debug = buildSelectionDebug(rankedCandidates, context)
  const confidenceScore = computeConfidenceScore(stops, context)

  const intendedStopCount =
    context.slots?.length ?? context.desiredRoles.length

  const failedToGenerateStops =
    intendedStopCount > 0 && stops.length === 0

  const reducedBeforeSingleStopFallbackApplied =
    qualifiesForReducedBeforeSingleStopFallback(stops, context)

  const effectiveIntendedStopCount = reducedBeforeSingleStopFallbackApplied
    ? Math.min(intendedStopCount, 1)
    : intendedStopCount

  const completionRate =
    effectiveIntendedStopCount > 0
      ? Number((stops.length / effectiveIntendedStopCount).toFixed(2))
      : 0

  return {
  source: input.event.tags?.length ? "event" : "venue_fallback",
  mode: input.mode,
  eventArchetype: context.eventArchetype,
  eventTags: context.eventTags,
  confidenceScore,
  plannedStartAt: context.plannedStartAt.toISOString(),
  plannedEndAt: context.plannedEndAt.toISOString(),
  estimatedEndAt: context.estimatedEndAt.toISOString(),
  leaveEarlyByHours: context.leaveEarlyByHours ?? null,
  plannedExitAt: context.plannedExitAt?.toISOString() ?? null,
  effectiveExitAt: context.effectiveExitAt?.toISOString() ?? null,
  summary: buildPlanSummary({
    mode: input.mode,
    eventTitle: input.event.title,
    venueName: input.anchorVenue?.name ?? null,
    stops,
    planningContext: context,
  }),
  stops,
  debug,
  scoreBreakdown: {
    mode: input.mode,
    city: input.anchorVenue?.city ?? null,
    eventTags: context.eventTags,
    eventArchetype: context.eventArchetype,
    candidatePoolSize: rankedCandidates.length,
    selectedStops: stops.length,
    preparedCandidateCount: rankedCandidates.length,
    intendedStopCount,
    effectiveIntendedStopCount,
    completionRate,
    failedToGenerateStops,
    reducedBeforeSingleStopFallbackApplied,
    leaveEarlyByHours: context.leaveEarlyByHours ?? null,
    plannedExitAt: context.plannedExitAt?.toISOString() ?? null,
    effectiveExitAt: context.effectiveExitAt?.toISOString() ?? null,
    vibeTags: context.vibeTags,
    vibePreferredTypes: context.vibePlanning?.preferredTypes ?? [],
    vibeDiscouragedTypes: context.vibePlanning?.discouragedTypes ?? [],
  },
}
}