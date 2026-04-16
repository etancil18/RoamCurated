// lib/outings/generateEventOutingPlan.ts

import { buildPlanningContext } from "./planningContext"
import {
  buildPlanSummary,
  computeConfidenceScore,
  generatePlanStops,
  rankVenueCandidates,
} from "./sequenceScoring"
import type {
  GenerateEventOutingPlanInput,
  GenerateEventOutingPlanResult,
} from "./types"

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
  })

  const rankedCandidates = rankVenueCandidates(input.candidateVenues, context)
  const stops = generatePlanStops(rankedCandidates, context)
  const confidenceScore = computeConfidenceScore(stops, context)

  const intendedStopCount =
    context.slots?.length ?? context.desiredRoles.length

  const completionRate =
    intendedStopCount > 0
      ? Number((stops.length / intendedStopCount).toFixed(2))
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
    summary: buildPlanSummary({
      mode: input.mode,
      eventTitle: input.event.title,
      venueName: input.anchorVenue?.name ?? null,
      stops,
      planningContext: context,
    }),
    stops,
    scoreBreakdown: {
      mode: input.mode,
      city: input.anchorVenue?.city ?? null,
      eventTags: context.eventTags,
      eventArchetype: context.eventArchetype,
      candidatePoolSize: rankedCandidates.length,
      selectedStops: stops.length,
      preparedCandidateCount: rankedCandidates.length,
      completionRate,
    },
  }
}