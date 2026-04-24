// lib/outings/persistGeneratedOutingPlan.ts

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Budget,
  EventRecord,
  GenerateEventOutingPlanResult,
  LeaveEarlyByHours,
  Mobility,
  PlanMode,
  SelectionPass,
  VenueRecord,
} from "./types"

type PersistGeneratedOutingPlanInput = {
  supabase: SupabaseClient
  userId: string
  event: EventRecord
  anchorVenue: VenueRecord | null
  city: string
  mode: PlanMode
  groupSize?: number | null
  budget?: Budget | null
  mobility?: Mobility
  vibeTags?: string[]
  plannedExitAt?: string | null
  leaveEarlyByHours?: LeaveEarlyByHours | null
  generatedPlan: GenerateEventOutingPlanResult
}

type PersistedPlannedOuting = {
  id: string
  status: string
  confidence_score: number | null
  plan_summary: string | null
}

type PersistedPlannedOutingStop = {
  id: string
  venue_id: string
  stop_order: number
  role: string
  title: string | null
  rationale: string | null
  planned_arrival_at: string | null
  planned_departure_at: string | null
  dwell_minutes: number | null
  travel_mode: string | null
  travel_minutes_from_prev: number | null
  distance_meters_from_prev: number | null
}

export type PersistGeneratedOutingPlanResult = {
  plannedOuting: PersistedPlannedOuting
  insertedStops: PersistedPlannedOutingStop[]
}

export async function persistGeneratedOutingPlan({
  supabase,
  userId,
  event,
  anchorVenue,
  city,
  mode,
  groupSize,
  budget,
  mobility,
  vibeTags = [],
  plannedExitAt,
  leaveEarlyByHours,
  generatedPlan,
}: PersistGeneratedOutingPlanInput): Promise<PersistGeneratedOutingPlanResult> {
  if (!generatedPlan.stops.length) {
    throw new Error("Cannot persist a planned outing with zero stops")
  }

  const selectionPassCounts = countSelectionPasses(generatedPlan)

  const stopRows = generatedPlan.stops.map((stop) => ({
    planned_outing_id: "__PENDING_OUTING_ID__",
    venue_id: stop.venueId,
    stop_order: stop.stopOrder,
    role: stop.role,
    title: stop.title,
    rationale: stop.rationale,
    planned_arrival_at: stop.plannedArrivalAt,
    planned_departure_at: stop.plannedDepartureAt,
    dwell_minutes: stop.dwellMinutes,
    travel_mode: stop.travelMode,
    travel_minutes_from_prev: stop.travelMinutesFromPrev,
    distance_meters_from_prev: stop.distanceMetersFromPrev,
    is_locked: false,
    was_swapped: false,
    metadata: {
      ...(stop.metadata ?? {}),
      venueType: stop.venueType ?? stop.metadata?.venueType ?? null,
      displayType: stop.displayType ?? stop.metadata?.displayType ?? null,
      selectedPass: stop.metadata?.selectedPass ?? null,
      phase: stop.phase ?? null,
      bookingOptions: stop.bookingOptions ?? null,
      reservationRecommended: stop.reservationRecommended ?? false,
      recommendedReservationAt: stop.recommendedReservationAt ?? null,
    },
  }))

  validateGeneratedPlanStops(stopRows)

  const { data: plannedOuting, error: outingInsertError } = await supabase
    .from("planned_outings")
    .insert({
      user_id: userId,
      event_id: event.id,
      venue_id: anchorVenue?.id ?? null,
      city,
      source: generatedPlan.source,
      mode,
      status: "generated",
      group_size: groupSize ?? null,
      budget: budget ?? null,
      mobility: mobility ?? null,
      vibe_tags: vibeTags,
      anchor_title: event.title,
      anchor_starts_at: event.starts_at,
      anchor_ends_at: generatedPlan.estimatedEndAt,
      planned_start_at: generatedPlan.plannedStartAt,
      planned_end_at: generatedPlan.plannedEndAt,
      generation_version: "v1.3.0-booking-annotated-outings",
      confidence_score: generatedPlan.confidenceScore,
      score_breakdown: {
        ...generatedPlan.scoreBreakdown,
        selectionPassCounts,
      },
      plan_summary: generatedPlan.summary,
      metadata: {
        anchorVenue: anchorVenue
          ? {
              id: anchorVenue.id,
              name: anchorVenue.name,
              city: anchorVenue.city,
              lat: anchorVenue.lat,
              lon: anchorVenue.lon,
            }
          : null,
        request: {
          groupSize: groupSize ?? null,
          budget: budget ?? null,
          mobility: mobility ?? null,
          vibeTags,
          leaveEarlyByHours: leaveEarlyByHours ?? null,
          plannedExitAt: plannedExitAt ?? null,
        },
        planner: {
          mode: generatedPlan.mode,
          eventArchetype: generatedPlan.eventArchetype,
          eventTags: generatedPlan.eventTags,
          selectedStopCount: generatedPlan.stops.length,
          candidatePoolSize: generatedPlan.scoreBreakdown.candidatePoolSize,
          preparedCandidateCount:
            generatedPlan.scoreBreakdown.preparedCandidateCount ?? null,
          completionRate: generatedPlan.scoreBreakdown.completionRate ?? null,
          selectionPassCounts,
          emergencyStopCount: selectionPassCounts.emergency,
          leaveEarlyByHours:
            generatedPlan.leaveEarlyByHours ?? leaveEarlyByHours ?? null,
          plannedExitAt: generatedPlan.plannedExitAt ?? plannedExitAt ?? null,
          effectiveExitAt: generatedPlan.effectiveExitAt ?? null,
          debug: generatedPlan.debug ?? null,
        },
      },
    })
    .select("id, status, confidence_score, plan_summary")
    .single<PersistedPlannedOuting>()

  if (outingInsertError || !plannedOuting) {
    throw new Error(
      outingInsertError?.message ?? "Failed to create planned outing"
    )
  }

  const finalizedStopRows = stopRows.map((row) => ({
    ...row,
    planned_outing_id: plannedOuting.id,
  }))

  const { data: insertedStops, error: stopsInsertError } = await supabase
    .from("planned_outing_stops")
    .insert(finalizedStopRows)
    .select(
      `
        id,
        venue_id,
        stop_order,
        role,
        title,
        rationale,
        planned_arrival_at,
        planned_departure_at,
        dwell_minutes,
        travel_mode,
        travel_minutes_from_prev,
        distance_meters_from_prev
      `
    )
    .returns<PersistedPlannedOutingStop[]>()

  if (stopsInsertError) {
    await supabase.from("planned_outings").delete().eq("id", plannedOuting.id)
    throw new Error(stopsInsertError.message)
  }

  return {
    plannedOuting,
    insertedStops: insertedStops ?? [],
  }
}

function countSelectionPasses(
  generatedPlan: GenerateEventOutingPlanResult
): Record<SelectionPass, number> {
  return generatedPlan.stops.reduce<Record<SelectionPass, number>>(
    (counts, stop) => {
      const selectedPass = stop.metadata?.selectedPass

      if (isSelectionPass(selectedPass)) {
        counts[selectedPass] += 1
      }

      return counts
    },
    {
      strict: 0,
      balanced: 0,
      relaxed: 0,
      emergency: 0,
    }
  )
}

function isSelectionPass(value: unknown): value is SelectionPass {
  return (
    value === "strict" ||
    value === "balanced" ||
    value === "relaxed" ||
    value === "emergency"
  )
}

type StopRowForValidation = {
  planned_outing_id: string
  venue_id: string
  stop_order: number
  role: string
  title: string | null | undefined
  rationale: string | null | undefined
  planned_arrival_at: string | null | undefined
  planned_departure_at: string | null | undefined
  dwell_minutes: number | null | undefined
  travel_mode: string | null | undefined
  travel_minutes_from_prev: number | null | undefined
  distance_meters_from_prev: number | null | undefined
  is_locked: boolean
  was_swapped: boolean
  metadata: unknown
}

function validateGeneratedPlanStops(stops: StopRowForValidation[]): void {
  if (!stops.length) {
    throw new Error("Cannot persist empty stop rows")
  }

  const sorted = [...stops].sort((a, b) => a.stop_order - b.stop_order)

  for (let index = 0; index < sorted.length; index += 1) {
    const stop = sorted[index]
    const expectedOrder = index + 1

    if (!stop.venue_id) {
      throw new Error(`Stop ${expectedOrder} is missing a venue_id`)
    }

    if (!stop.role) {
      throw new Error(`Stop ${expectedOrder} is missing a role`)
    }

    if (stop.stop_order !== expectedOrder) {
      throw new Error(
        `Stop ordering is invalid. Expected ${expectedOrder}, received ${stop.stop_order}`
      )
    }

    if (
      stop.planned_arrival_at &&
      stop.planned_departure_at &&
      new Date(stop.planned_departure_at).getTime() <
        new Date(stop.planned_arrival_at).getTime()
    ) {
      throw new Error(
        `Stop ${expectedOrder} has a departure time earlier than its arrival time`
      )
    }
  }
}