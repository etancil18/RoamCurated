// lib/outings/generateEventOutingPlan.ts

import { buildPlanningContext } from "./planningContext"
import {
  buildPlanSummary,
  buildSelectionDebug,
  computeConfidenceScore,
  generatePlanStops,
  rankVenueCandidates,
} from "./sequenceScoring"
import { qualifiesForReducedBeforeSingleStopFallback } from "./sequenceScoring/daytime"
import type {
  GenerateEventOutingPlanInput,
  GenerateEventOutingPlanResult,
  GeneratedOutingStop,
  PlanMode,
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
  })

  const rankedCandidates = rankVenueCandidates(input.candidateVenues, context)

  const rawStops = generatePlanStops(rankedCandidates, context)
  const stops = annotateBookingRecommendations({
    mode: input.mode,
    stops: rawStops,
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
    },
  }
}