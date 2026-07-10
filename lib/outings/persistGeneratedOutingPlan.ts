// lib/outings/persistGeneratedOutingPlan.ts

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  Budget,
  EventRecord,
  GenerateEventOutingPlanResult,
  GeneratedOutingStop,
  LeaveEarlyByHours,
  Mobility,
  PlanMode,
  SelectionPass,
  VenueRecord,
} from "./types"

// -----------------------------------------------------------------------------
// Persistence contracts
// -----------------------------------------------------------------------------

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

type PlannedOutingStopInsertRow = {
  planned_outing_id: string
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

  is_locked: boolean
  was_swapped: boolean

  metadata: Record<string, unknown>
}

export type PersistGeneratedOutingPlanResult = {
  plannedOuting: PersistedPlannedOuting
  insertedStops: PersistedPlannedOutingStop[]
}

// -----------------------------------------------------------------------------
// Planner version
// -----------------------------------------------------------------------------

const GENERATION_VERSION =
  "v2.0.0-semantic-sequence-outing-planner"

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

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
  validatePersistenceInput({
    userId,
    city,
    mode,
    generatedPlan,
  })

  const selectionPassCounts =
    countSelectionPasses(generatedPlan)

  const effectiveLeaveEarlyByHours =
    generatedPlan.leaveEarlyByHours ??
    leaveEarlyByHours ??
    null

  const effectivePlannedExitAt =
    generatedPlan.plannedExitAt ??
    plannedExitAt ??
    null

  const effectiveExitAt =
    generatedPlan.effectiveExitAt ??
    effectivePlannedExitAt ??
    generatedPlan.estimatedEndAt

  const stopRows = generatedPlan.stops.map(
    (stop): PlannedOutingStopInsertRow =>
      buildPendingStopRow({
        stop,
        generatedPlan,
      })
  )

  validateGeneratedPlanStops(stopRows)

  const outingInsertPayload = {
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
    vibe_tags: normalizeStringList(vibeTags),

    anchor_title: event.title,
    anchor_starts_at: event.starts_at,
    anchor_ends_at: generatedPlan.estimatedEndAt,

    planned_start_at: generatedPlan.plannedStartAt,
    planned_end_at: generatedPlan.plannedEndAt,

    generation_version: GENERATION_VERSION,
    confidence_score: generatedPlan.confidenceScore,

    score_breakdown: {
      ...generatedPlan.scoreBreakdown,
      selectionPassCounts,
      generationVersion: GENERATION_VERSION,
    },

    plan_summary: generatedPlan.summary,

    metadata: {
      generationVersion: GENERATION_VERSION,

      anchorVenue: anchorVenue
        ? {
            id: anchorVenue.id,
            name: anchorVenue.name,
            city: anchorVenue.city,
            address: anchorVenue.address,
            lat: anchorVenue.lat,
            lon: anchorVenue.lon,
            types: normalizeStringCollection(anchorVenue.type),
            tags: normalizeStringCollection(anchorVenue.tags),
            vibes: normalizeStringCollection(anchorVenue.vibe),
            timeCategories: normalizeStringCollection(
              anchorVenue.time_category
            ),
          }
        : null,

      request: {
        mode,
        groupSize: groupSize ?? null,
        budget: budget ?? null,
        mobility: mobility ?? null,
        vibeTags: normalizeStringList(vibeTags),
        leaveEarlyByHours: effectiveLeaveEarlyByHours,
        plannedExitAt: effectivePlannedExitAt,
      },

      timing: {
        eventStartsAt: event.starts_at,
        eventEstimatedEndAt: generatedPlan.estimatedEndAt,
        plannedStartAt: generatedPlan.plannedStartAt,
        plannedEndAt: generatedPlan.plannedEndAt,
        plannedExitAt: effectivePlannedExitAt,
        effectiveExitAt,
      },

      planner: {
        source: generatedPlan.source,
        mode: generatedPlan.mode,

        eventArchetype:
          generatedPlan.eventArchetype,

        eventTags:
          normalizeStringList(generatedPlan.eventTags),

        selectedStopCount:
          generatedPlan.stops.length,

        candidatePoolSize:
          generatedPlan.scoreBreakdown.candidatePoolSize,

        preparedCandidateCount:
          generatedPlan.scoreBreakdown.preparedCandidateCount,

        intendedStopCount:
          generatedPlan.scoreBreakdown.intendedStopCount,

        effectiveIntendedStopCount:
          generatedPlan.scoreBreakdown.effectiveIntendedStopCount,

        completionRate:
          generatedPlan.scoreBreakdown.completionRate,

        failedToGenerateStops:
          generatedPlan.scoreBreakdown.failedToGenerateStops,

        reducedBeforeSingleStopFallbackApplied:
          generatedPlan.scoreBreakdown
            .reducedBeforeSingleStopFallbackApplied,

        selectionPassCounts,
        emergencyStopCount:
          selectionPassCounts.emergency,

        confidenceScore:
          generatedPlan.confidenceScore,

        routeVibeConfidence:
          generatedPlan.scoreBreakdown
            .routeVibeConfidence ??
          null,

        routeSemanticConfidence:
          generatedPlan.scoreBreakdown
            .routeSemanticConfidence ??
          null,

        averageSelectedSemanticScore:
          generatedPlan.scoreBreakdown
            .averageSelectedSemanticScore ??
          null,

        averageSelectedVibeScore:
          generatedPlan.scoreBreakdown
            .averageSelectedVibeScore ??
          null,

        averageSelectedTagScore:
          generatedPlan.scoreBreakdown
            .averageSelectedTagScore ??
          null,

        leaveEarlyByHours:
          effectiveLeaveEarlyByHours,

        plannedExitAt:
          effectivePlannedExitAt,

        effectiveExitAt,

        debug:
          generatedPlan.debug ?? null,
      },
    },
  }

  const {
    data: plannedOuting,
    error: outingInsertError,
  } = await supabase
    .from("planned_outings")
    .insert(outingInsertPayload)
    .select(
      `
        id,
        status,
        confidence_score,
        plan_summary
      `
    )
    .single<PersistedPlannedOuting>()

  if (outingInsertError || !plannedOuting) {
    throw new Error(
      outingInsertError?.message ??
        "Failed to create planned outing"
    )
  }

  const finalizedStopRows =
    stopRows.map((row) => ({
      ...row,
      planned_outing_id: plannedOuting.id,
    }))

  const {
    data: insertedStops,
    error: stopsInsertError,
  } = await supabase
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
    await cleanupFailedOutingInsert(
      supabase,
      plannedOuting.id
    )

    throw new Error(
      `Failed to persist planned outing stops: ${stopsInsertError.message}`
    )
  }

  const normalizedInsertedStops =
    insertedStops ?? []

  if (
    normalizedInsertedStops.length !==
    finalizedStopRows.length
  ) {
    await cleanupFailedOutingInsert(
      supabase,
      plannedOuting.id
    )

    throw new Error(
      [
        "Planned outing stop insertion was incomplete.",
        `Expected ${finalizedStopRows.length} stops,`,
        `received ${normalizedInsertedStops.length}.`,
      ].join(" ")
    )
  }

  validatePersistedStopOrders(
    normalizedInsertedStops,
    finalizedStopRows.length
  )

  return {
    plannedOuting,
    insertedStops:
      normalizedInsertedStops,
  }
}

// -----------------------------------------------------------------------------
// Stop-row construction
// -----------------------------------------------------------------------------

function buildPendingStopRow({
  stop,
  generatedPlan,
}: {
  stop: GeneratedOutingStop
  generatedPlan: GenerateEventOutingPlanResult
}): PlannedOutingStopInsertRow {
  const metadata =
    stop.metadata ?? {}

  return {
    planned_outing_id:
      "__PENDING_OUTING_ID__",

    venue_id:
      stop.venueId,

    stop_order:
      stop.stopOrder,

    role:
      stop.role,

    title:
      normalizeNullableString(stop.title),

    rationale:
      normalizeNullableString(stop.rationale),

    planned_arrival_at:
      normalizeNullableIsoDate(
        stop.plannedArrivalAt
      ),

    planned_departure_at:
      normalizeNullableIsoDate(
        stop.plannedDepartureAt
      ),

    dwell_minutes:
      normalizeNullableNonNegativeNumber(
        stop.dwellMinutes
      ),

    travel_mode:
      stop.travelMode ?? null,

    travel_minutes_from_prev:
      normalizeNullableNonNegativeNumber(
        stop.travelMinutesFromPrev
      ),

    distance_meters_from_prev:
      normalizeNullableNonNegativeNumber(
        stop.distanceMetersFromPrev
      ),

    is_locked: false,
    was_swapped: false,

    metadata: compactRecord({
      ...metadata,

      venueType:
        stop.venueType ??
        metadata.venueType ??
        null,

      displayType:
        stop.displayType ??
        metadata.displayType ??
        null,

      selectedPass:
        metadata.selectedPass ??
        null,

      phase:
        stop.phase ??
        null,

      eventArchetype:
        metadata.eventArchetype ??
        generatedPlan.eventArchetype,

      semanticRole:
        metadata.semanticRole ??
        null,

      slotPhase:
        metadata.slotPhase ??
        stop.phase ??
        null,

      slotIndex:
        metadata.slotIndex ??
        stop.stopOrder - 1,

      venueTypes:
        normalizeStringList(
          metadata.venueTypes
        ),

      venueTags:
        normalizeStringList(
          metadata.venueTags
        ),

      venueVibes:
        normalizeStringList(
          metadata.venueVibes
        ),

      venueTimeCategories:
        normalizeStringList(
          metadata.venueTimeCategories
        ),

      vibeTags:
        normalizeStringList(
          metadata.vibeTags
        ),

      vibePreferredTypes:
        normalizeStringList(
          metadata.vibePreferredTypes
        ),

      vibeRequiredAnyTypes:
        normalizeStringList(
          metadata.vibeRequiredAnyTypes
        ),

      vibeDiscouragedTypes:
        normalizeStringList(
          metadata.vibeDiscouragedTypes
        ),

      vibeMatchedTypes:
        normalizeStringList(
          metadata.vibeMatchedTypes
        ),

      vibeMatchedTokens:
        normalizeStringList(
          metadata.vibeMatchedTokens
        ),

      matchedEventTags:
        normalizeStringList(
          metadata.matchedEventTags
        ),

      matchedVenueTags:
        normalizeStringList(
          metadata.matchedVenueTags
        ),

      matchedVenueVibes:
        normalizeStringList(
          metadata.matchedVenueVibes
        ),

      matchedVenueTypes:
        normalizeStringList(
          metadata.matchedVenueTypes
        ),

      matchedTimeCategories:
        normalizeStringList(
          metadata.matchedTimeCategories
        ),

      semanticScore:
        normalizeNullableFiniteNumber(
          metadata.semanticScore
        ),

      semanticConfidence:
        normalizeNullableFiniteNumber(
          metadata.semanticConfidence
        ),

      vibeScore:
        normalizeNullableFiniteNumber(
          metadata.vibeScore
        ),

      vibeConfidence:
        normalizeNullableFiniteNumber(
          metadata.vibeConfidence
        ),

      energyScore:
        normalizeNullableFiniteNumber(
          metadata.energyScore
        ),

      score:
        normalizeNullableFiniteNumber(
          metadata.score
        ),

      scoreComponents:
        metadata.scoreComponents ??
        null,

      bookingOptions:
        stop.bookingOptions ??
        null,

      reservationRecommended:
        stop.reservationRecommended ??
        false,

      recommendedReservationAt:
        normalizeNullableIsoDate(
          stop.recommendedReservationAt
        ),
    }),
  }
}

// -----------------------------------------------------------------------------
// Selection-pass diagnostics
// -----------------------------------------------------------------------------

function countSelectionPasses(
  generatedPlan: GenerateEventOutingPlanResult
): Record<SelectionPass, number> {
  return generatedPlan.stops.reduce<
    Record<SelectionPass, number>
  >(
    (counts, stop) => {
      const selectedPass =
        stop.metadata?.selectedPass

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

function isSelectionPass(
  value: unknown
): value is SelectionPass {
  return (
    value === "strict" ||
    value === "balanced" ||
    value === "relaxed" ||
    value === "emergency"
  )
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

function validatePersistenceInput({
  userId,
  city,
  mode,
  generatedPlan,
}: {
  userId: string
  city: string
  mode: PlanMode
  generatedPlan: GenerateEventOutingPlanResult
}): void {
  if (!userId.trim()) {
    throw new Error(
      "Cannot persist a planned outing without a user id"
    )
  }

  if (!city.trim()) {
    throw new Error(
      "Cannot persist a planned outing without a city"
    )
  }

  if (
    mode !== "before" &&
    mode !== "after" &&
    mode !== "full"
  ) {
    throw new Error(
      `Cannot persist unsupported outing mode: ${String(mode)}`
    )
  }

  if (!generatedPlan.stops.length) {
    throw new Error(
      "Cannot persist a planned outing with zero stops"
    )
  }

  if (
    generatedPlan.mode !== mode
  ) {
    throw new Error(
      [
        "Generated plan mode does not match persistence mode.",
        `Generated: ${generatedPlan.mode}.`,
        `Persisted: ${mode}.`,
      ].join(" ")
    )
  }

  assertValidIsoDate(
    generatedPlan.plannedStartAt,
    "plannedStartAt"
  )

  assertValidIsoDate(
    generatedPlan.plannedEndAt,
    "plannedEndAt"
  )

  assertValidIsoDate(
    generatedPlan.estimatedEndAt,
    "estimatedEndAt"
  )

  if (
    new Date(
      generatedPlan.plannedEndAt
    ).getTime() <
    new Date(
      generatedPlan.plannedStartAt
    ).getTime()
  ) {
    throw new Error(
      "Generated plan end time is earlier than its start time"
    )
  }

  if (
    !Number.isFinite(
      generatedPlan.confidenceScore
    )
  ) {
    throw new Error(
      "Generated plan confidence score must be finite"
    )
  }
}

function validateGeneratedPlanStops(
  stops: PlannedOutingStopInsertRow[]
): void {
  if (!stops.length) {
    throw new Error(
      "Cannot persist empty stop rows"
    )
  }

  const sorted =
    [...stops].sort(
      (first, second) =>
        first.stop_order -
        second.stop_order
    )

  const seenOrders =
    new Set<number>()

  const seenVenueIds =
    new Set<string>()

  for (
    let index = 0;
    index < sorted.length;
    index += 1
  ) {
    const stop = sorted[index]
    const expectedOrder = index + 1

    if (!stop.venue_id.trim()) {
      throw new Error(
        `Stop ${expectedOrder} is missing a venue_id`
      )
    }

    if (!stop.role.trim()) {
      throw new Error(
        `Stop ${expectedOrder} is missing a role`
      )
    }

    if (
      !Number.isInteger(stop.stop_order) ||
      stop.stop_order < 1
    ) {
      throw new Error(
        `Stop ${expectedOrder} has an invalid stop_order`
      )
    }

    if (
      seenOrders.has(stop.stop_order)
    ) {
      throw new Error(
        `Duplicate stop_order detected: ${stop.stop_order}`
      )
    }

    seenOrders.add(stop.stop_order)

    if (
      stop.stop_order !== expectedOrder
    ) {
      throw new Error(
        [
          "Stop ordering is invalid.",
          `Expected ${expectedOrder},`,
          `received ${stop.stop_order}.`,
        ].join(" ")
      )
    }

    if (
      seenVenueIds.has(stop.venue_id)
    ) {
      throw new Error(
        `Venue ${stop.venue_id} appears more than once in the generated outing`
      )
    }

    seenVenueIds.add(stop.venue_id)

    validateOptionalStopDate(
      stop.planned_arrival_at,
      expectedOrder,
      "arrival"
    )

    validateOptionalStopDate(
      stop.planned_departure_at,
      expectedOrder,
      "departure"
    )

    if (
      stop.planned_arrival_at &&
      stop.planned_departure_at
    ) {
      const arrivalTime =
        new Date(
          stop.planned_arrival_at
        ).getTime()

      const departureTime =
        new Date(
          stop.planned_departure_at
        ).getTime()

      if (
        departureTime < arrivalTime
      ) {
        throw new Error(
          `Stop ${expectedOrder} has a departure time earlier than its arrival time`
        )
      }
    }

    validateOptionalNonNegativeNumber(
      stop.dwell_minutes,
      expectedOrder,
      "dwell_minutes"
    )

    validateOptionalNonNegativeNumber(
      stop.travel_minutes_from_prev,
      expectedOrder,
      "travel_minutes_from_prev"
    )

    validateOptionalNonNegativeNumber(
      stop.distance_meters_from_prev,
      expectedOrder,
      "distance_meters_from_prev"
    )
  }
}

function validatePersistedStopOrders(
  insertedStops: PersistedPlannedOutingStop[],
  expectedCount: number
): void {
  const sorted =
    [...insertedStops].sort(
      (first, second) =>
        first.stop_order -
        second.stop_order
    )

  if (
    sorted.length !== expectedCount
  ) {
    throw new Error(
      "Persisted stop count does not match the generated stop count"
    )
  }

  for (
    let index = 0;
    index < sorted.length;
    index += 1
  ) {
    const expectedOrder =
      index + 1

    if (
      sorted[index].stop_order !==
      expectedOrder
    ) {
      throw new Error(
        [
          "Persisted stop ordering is invalid.",
          `Expected ${expectedOrder},`,
          `received ${sorted[index].stop_order}.`,
        ].join(" ")
      )
    }
  }
}

function validateOptionalStopDate(
  value: string | null,
  stopOrder: number,
  label: string
): void {
  if (!value) return

  if (
    Number.isNaN(
      new Date(value).getTime()
    )
  ) {
    throw new Error(
      `Stop ${stopOrder} has an invalid ${label} time`
    )
  }
}

function validateOptionalNonNegativeNumber(
  value: number | null,
  stopOrder: number,
  fieldName: string
): void {
  if (value == null) return

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `Stop ${stopOrder} has an invalid ${fieldName} value`
    )
  }
}

function assertValidIsoDate(
  value: string,
  fieldName: string
): void {
  if (
    !value ||
    Number.isNaN(
      new Date(value).getTime()
    )
  ) {
    throw new Error(
      `Generated plan contains an invalid ${fieldName}`
    )
  }
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

async function cleanupFailedOutingInsert(
  supabase: SupabaseClient,
  plannedOutingId: string
): Promise<void> {
  const {
    error: stopCleanupError,
  } = await supabase
    .from("planned_outing_stops")
    .delete()
    .eq(
      "planned_outing_id",
      plannedOutingId
    )

  if (stopCleanupError) {
    console.error(
      "Failed to clean up planned outing stops after persistence failure:",
      stopCleanupError
    )
  }

  const {
    error: outingCleanupError,
  } = await supabase
    .from("planned_outings")
    .delete()
    .eq(
      "id",
      plannedOutingId
    )

  if (outingCleanupError) {
    console.error(
      "Failed to clean up planned outing after persistence failure:",
      outingCleanupError
    )
  }
}

// -----------------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------------

function normalizeNullableString(
  value: string | null | undefined
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

function normalizeNullableIsoDate(
  value: string | null | undefined
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null
  }

  const parsed =
    new Date(value)

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null
  }

  return parsed.toISOString()
}

function normalizeNullableFiniteNumber(
  value: unknown
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null
}

function normalizeNullableNonNegativeNumber(
  value: number | null | undefined
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? value
    : null
}

function normalizeStringList(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter(
          (entry): entry is string =>
            typeof entry === "string"
        )
        .map((entry) =>
          entry.trim()
        )
        .filter(Boolean)
    )
  )
}

function normalizeStringCollection(
  value:
    | string
    | string[]
    | null
    | undefined
): string[] {
  if (Array.isArray(value)) {
    return normalizeStringList(value)
  }

  if (
    typeof value !== "string"
  ) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(/[,/|;]+/)
        .map((entry) =>
          entry.trim()
        )
        .filter(Boolean)
    )
  )
}

function compactRecord(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) =>
        entry !== undefined
    )
  )
}