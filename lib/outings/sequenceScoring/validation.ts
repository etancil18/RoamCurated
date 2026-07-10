// lib/outings/sequenceScoring/validation.ts

import type {
  GeneratedOutingStop,
  PlanningContext,
  PlanningSlot,
  SelectionPass,
  SlotPhase,
  StopRole,
  VenueRecord,
} from "../types"

import type { CandidateVenue } from "./types"

import {
  getDistanceBetweenVenues,
  getMaxAfterInterstopMeters,
  getMaxBeforeInterstopMeters,
  isTooFarForAfterFirstStop,
  isTooFarForBeforeFirstStop,
} from "./geometry"

import {
  hasAnyType,
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
} from "./helpers"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

import {
  isRoleTemporallyCompatible,
  isVenueOpenForWindow,
} from "./temporal"

import {
  candidateSupportsSlot,
  pickRoleForSlot,
} from "./roles"

import {
  getEventArchetypePlanningProfile,
} from "../eventArchetypes"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type ValidationSeverity = "warning" | "error"

export type ValidationIssueCode =
  | "missing_venue_id"
  | "duplicate_venue"
  | "missing_coordinates"
  | "missing_type"
  | "missing_contextual_data"
  | "missing_hours"
  | "venue_closed"
  | "temporal_role_mismatch"
  | "slot_role_mismatch"
  | "anchor_distance_exceeded"
  | "interstop_distance_exceeded"
  | "before_route_backtracks"
  | "after_route_backtracks"
  | "before_club"
  | "club_as_first_after_stop"
  | "daypart_type_mismatch"
  | "strong_vibe_conflict"
  | "weak_vibe_alignment"
  | "archetype_conflict"
  | "sequence_repetition"
  | "sequence_energy_clash"
  | "insufficient_contextual_confidence"
  | "emergency_selection"
  | "incomplete_route"
  | "phase_order_invalid"
  | "invalid_stop_order"
  | "invalid_timing"
  | "event_anchor_missing"
  | "route_score_below_threshold"

export type ValidationIssue = {
  code: ValidationIssueCode
  severity: ValidationSeverity
  message: string
  stopIndex?: number | null
  slotIndex?: number | null
  venueId?: string | null
  details?: Record<string, unknown>
}

export type StopValidationInput = {
  venue: CandidateVenue
  slot: PlanningSlot
  selectedPass?: SelectionPass | null
}

export type RouteValidationOptions = {
  /**
   * Whether unknown operating hours should invalidate a route.
   *
   * The default is false because venue-hours coverage may be incomplete.
   * Unknown hours still produce a warning and reduce confidence.
   */
  requireKnownHours?: boolean

  /**
   * Whether an emergency-pass stop should invalidate the route.
   *
   * By default emergency stops are allowed but heavily penalized.
   */
  rejectEmergencySelections?: boolean

  /**
   * Minimum number of selected stops required.
   *
   * Defaults to the number of planning slots.
   */
  minimumStops?: number

  /**
   * Allows a valid reduced route even if all planned slots were not filled.
   */
  allowPartialRoute?: boolean

  /**
   * Minimum contextual confidence required for the route.
   */
  minimumContextualConfidence?: number

  /**
   * Minimum overall validation confidence required for the route.
   */
  minimumOverallConfidence?: number

  /**
   * Optional sequence-search score threshold.
   */
  minimumSequenceScore?: number | null

  /**
   * Score produced by sequence search, when available.
   */
  sequenceScore?: number | null
}

export type StopValidationResult = {
  valid: boolean
  stopIndex: number
  slotIndex: number
  venueId: string
  issues: ValidationIssue[]
  confidence: {
    role: number
    temporal: number
    geometry: number
    vibe: number
    archetype: number
    data: number
    overall: number
  }
}

export type RouteValidationResult = {
  valid: boolean
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  stopResults: StopValidationResult[]
  confidence: {
    completeness: number
    role: number
    temporal: number
    geometry: number
    vibe: number
    archetype: number
    sequence: number
    data: number
    overall: number
  }
  metrics: {
    selectedStopCount: number
    intendedStopCount: number
    emergencyStopCount: number
    duplicateVenueCount: number
    knownHoursCount: number
    contextualDataCount: number
    maximumInterstopMeters: number | null
    maximumAnchorDistanceMeters: number | null
  }
}

export type GeneratedStopValidationInput = {
  stop: GeneratedOutingStop
  slot?: PlanningSlot | null
  venue?: VenueRecord | null
}

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

const DEFAULT_MINIMUM_CONTEXTUAL_CONFIDENCE = 0.42
const DEFAULT_MINIMUM_OVERALL_CONFIDENCE = 0.56

const STRONG_ENERGY_TOKENS = [
  "high-energy",
  "high energy",
  "loud",
  "party",
  "rowdy",
  "wild",
  "club",
  "dance",
  "dancing",
  "packed",
  "hype",
]

const LOW_ENERGY_TOKENS = [
  "quiet",
  "calm",
  "relaxed",
  "peaceful",
  "chill",
  "cozy",
  "intimate",
  "low-key",
  "low key",
  "serene",
  "tranquil",
]

const MORNING_TYPES = [
  "coffee",
  "cafe",
  "café",
  "tea",
  "bakery",
  "breakfast",
  "brunch",
  "juice",
  "matcha",
]

const EVENING_TYPES = [
  "dinner",
  "bar",
  "cocktail",
  "wine bar",
  "lounge",
  "speakeasy",
  "rooftop",
  "club",
  "late night",
]

const ACTIVITY_TYPES = [
  "gallery",
  "museum",
  "bookstore",
  "library",
  "park",
  "garden",
  "market",
  "showroom",
  "lifestyle",
  "activity",
  "music",
  "theater",
  "cinema",
]

// -----------------------------------------------------------------------------
// Main route validation
// -----------------------------------------------------------------------------

export function validateSelectedRoute(
  selected: StopValidationInput[],
  context: PlanningContext,
  options: RouteValidationOptions = {}
): RouteValidationResult {
  const issues: ValidationIssue[] = []
  const stopResults: StopValidationResult[] = []

  const intendedStopCount =
    context.slots?.length ??
    context.desiredRoles.length

  const minimumStops =
    typeof options.minimumStops === "number" &&
    Number.isFinite(options.minimumStops)
      ? Math.max(0, Math.floor(options.minimumStops))
      : intendedStopCount

  const allowPartialRoute =
    options.allowPartialRoute ?? false

  const requireKnownHours =
    options.requireKnownHours ?? false

  const rejectEmergencySelections =
    options.rejectEmergencySelections ?? false

  const minimumContextualConfidence =
    normalizeConfidenceThreshold(
      options.minimumContextualConfidence,
      DEFAULT_MINIMUM_CONTEXTUAL_CONFIDENCE
    )

  const minimumOverallConfidence =
    normalizeConfidenceThreshold(
      options.minimumOverallConfidence,
      DEFAULT_MINIMUM_OVERALL_CONFIDENCE
    )

  if (!context.anchorVenue) {
    issues.push({
      code: "event_anchor_missing",
      severity: "error",
      message: "The event venue is missing, so route geometry cannot be validated.",
    })
  }

  if (
    !allowPartialRoute &&
    selected.length < minimumStops
  ) {
    issues.push({
      code: "incomplete_route",
      severity: "error",
      message: `The route contains ${selected.length} stop${
        selected.length === 1 ? "" : "s"
      }, but at least ${minimumStops} are required.`,
      details: {
        selectedStopCount: selected.length,
        minimumStops,
        intendedStopCount,
      },
    })
  } else if (
    selected.length < minimumStops
  ) {
    issues.push({
      code: "incomplete_route",
      severity: "warning",
      message: `The route is shorter than planned and contains ${selected.length} of ${minimumStops} expected stops.`,
      details: {
        selectedStopCount: selected.length,
        minimumStops,
        intendedStopCount,
      },
    })
  }

  validatePhaseOrder(selected, issues)

  const seenVenueIds = new Set<string>()
  let duplicateVenueCount = 0
  let emergencyStopCount = 0
  let knownHoursCount = 0
  let contextualDataCount = 0
  let maximumInterstopMeters: number | null = null
  let maximumAnchorDistanceMeters: number | null = null

  for (let index = 0; index < selected.length; index += 1) {
    const item = selected[index]
    const previous =
      index > 0
        ? selected[index - 1]?.venue ?? null
        : null

    if (seenVenueIds.has(item.venue.id)) {
      duplicateVenueCount += 1

      issues.push({
        code: "duplicate_venue",
        severity: "error",
        stopIndex: index,
        slotIndex: item.slot.index,
        venueId: item.venue.id,
        message: `${item.venue.name ?? "This venue"} appears more than once in the route.`,
      })
    }

    seenVenueIds.add(item.venue.id)

    if (item.selectedPass === "emergency") {
      emergencyStopCount += 1

      issues.push({
        code: "emergency_selection",
        severity: rejectEmergencySelections ? "error" : "warning",
        stopIndex: index,
        slotIndex: item.slot.index,
        venueId: item.venue.id,
        message: `${item.venue.name ?? "This stop"} was selected using the emergency fallback.`,
      })
    }

    if (hasUsableHours(item.venue)) {
      knownHoursCount += 1
    }

    if (hasContextualVenueData(item.venue)) {
      contextualDataCount += 1
    }

    const anchorDistance =
      item.venue.distanceMeters

    if (
      anchorDistance != null &&
      (
        maximumAnchorDistanceMeters == null ||
        anchorDistance > maximumAnchorDistanceMeters
      )
    ) {
      maximumAnchorDistanceMeters = anchorDistance
    }

    if (previous) {
      const interstopDistance =
        getDistanceBetweenVenues(previous, item.venue)

      if (
        interstopDistance != null &&
        (
          maximumInterstopMeters == null ||
          interstopDistance > maximumInterstopMeters
        )
      ) {
        maximumInterstopMeters = interstopDistance
      }
    }

    const stopResult = validateSelectedStop({
      input: item,
      previous,
      selectedBefore: selected.slice(0, index),
      context,
      stopIndex: index,
      requireKnownHours,
    })

    stopResults.push(stopResult)
    issues.push(...stopResult.issues)
  }

  validateSequenceRepetition(selected, issues)
  validateSequenceEnergy(selected, issues)
  validateBeforeProgression(selected, issues)
  validateAfterProgression(selected, issues)

  if (
    typeof options.minimumSequenceScore === "number" &&
    Number.isFinite(options.minimumSequenceScore) &&
    typeof options.sequenceScore === "number" &&
    Number.isFinite(options.sequenceScore) &&
    options.sequenceScore < options.minimumSequenceScore
  ) {
    issues.push({
      code: "route_score_below_threshold",
      severity: "error",
      message: "The route's sequence score is below the minimum quality threshold.",
      details: {
        sequenceScore: options.sequenceScore,
        minimumSequenceScore: options.minimumSequenceScore,
      },
    })
  }

  const confidence =
    computeRouteValidationConfidence({
      selected,
      stopResults,
      intendedStopCount,
      duplicateVenueCount,
      emergencyStopCount,
      knownHoursCount,
      contextualDataCount,
      issues,
    })

  if (
    confidence.vibe < minimumContextualConfidence
  ) {
    issues.push({
      code: "insufficient_contextual_confidence",
      severity: "error",
      message: "The selected route does not align strongly enough with the requested vibe.",
      details: {
        vibeConfidence: confidence.vibe,
        minimumContextualConfidence,
      },
    })
  }

  const recalculatedConfidence =
    computeRouteValidationConfidence({
      selected,
      stopResults,
      intendedStopCount,
      duplicateVenueCount,
      emergencyStopCount,
      knownHoursCount,
      contextualDataCount,
      issues,
    })

  if (
    recalculatedConfidence.overall <
    minimumOverallConfidence
  ) {
    issues.push({
      code: "insufficient_contextual_confidence",
      severity: "error",
      message: "The route does not meet the minimum overall quality threshold.",
      details: {
        overallConfidence:
          recalculatedConfidence.overall,
        minimumOverallConfidence,
      },
    })
  }

  const errors = issues.filter(
    (issue) => issue.severity === "error"
  )

  const warnings = issues.filter(
    (issue) => issue.severity === "warning"
  )

  const finalConfidence =
    computeRouteValidationConfidence({
      selected,
      stopResults,
      intendedStopCount,
      duplicateVenueCount,
      emergencyStopCount,
      knownHoursCount,
      contextualDataCount,
      issues,
    })

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
    stopResults,
    confidence: finalConfidence,
    metrics: {
      selectedStopCount: selected.length,
      intendedStopCount,
      emergencyStopCount,
      duplicateVenueCount,
      knownHoursCount,
      contextualDataCount,
      maximumInterstopMeters,
      maximumAnchorDistanceMeters,
    },
  }
}

// -----------------------------------------------------------------------------
// Single-stop validation
// -----------------------------------------------------------------------------

export function validateSelectedStop({
  input,
  previous,
  selectedBefore,
  context,
  stopIndex,
  requireKnownHours = false,
}: {
  input: StopValidationInput
  previous: CandidateVenue | null
  selectedBefore: StopValidationInput[]
  context: PlanningContext
  stopIndex: number
  requireKnownHours?: boolean
}): StopValidationResult {
  const issues: ValidationIssue[] = []
  const venue = input.venue
  const slot = input.slot
  const timeZone = resolvePlannerTimeZone(context)

  if (!venue.id?.trim()) {
    issues.push({
      code: "missing_venue_id",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id ?? null,
      message: "The selected stop does not have a valid venue identifier.",
    })
  }

  if (
    venue.lat == null ||
    venue.lon == null ||
    !Number.isFinite(venue.lat) ||
    !Number.isFinite(venue.lon)
  ) {
    issues.push({
      code: "missing_coordinates",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} does not have valid map coordinates.`,
    })
  }

  const venueTypes =
    normalizeVenueTypes(venue.type)

  if (venueTypes.length === 0) {
    issues.push({
      code: "missing_type",
      severity: "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} has no usable venue type.`,
    })
  }

  if (!hasContextualVenueData(venue)) {
    issues.push({
      code: "missing_contextual_data",
      severity: "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} has limited tags and vibe data.`,
    })
  }

  const hasHours = hasUsableHours(venue)

  if (!hasHours) {
    issues.push({
      code: "missing_hours",
      severity: requireKnownHours ? "error" : "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `Operating hours are not available for ${venue.name ?? "this venue"}.`,
    })
  } else {
    const openForWindow = isVenueOpenForWindow(
      venue,
      slot.targetArrivalAt,
      slot.targetDepartureAt,
      timeZone,
      false
    )

    if (!openForWindow) {
      issues.push({
        code: "venue_closed",
        severity: "error",
        stopIndex,
        slotIndex: slot.index,
        venueId: venue.id,
        message: `${venue.name ?? "This venue"} does not appear to be open for the planned visit window.`,
        details: {
          targetArrivalAt:
            slot.targetArrivalAt.toISOString(),
          targetDepartureAt:
            slot.targetDepartureAt.toISOString(),
          timeZone,
        },
      })
    }
  }

  const supportsSlot = candidateSupportsSlot(
    venue,
    slot,
    context,
    false
  )

  const supportsFlexibleRole =
    slot.flexibleRole != null &&
    venue.inferredRoles.includes(slot.flexibleRole)

  if (!supportsSlot && !supportsFlexibleRole) {
    issues.push({
      code: "slot_role_mismatch",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} does not credibly support the planned ${slot.role} stop.`,
      details: {
        requestedRole: slot.role,
        flexibleRole: slot.flexibleRole ?? null,
        inferredRoles: venue.inferredRoles,
      },
    })
  }

  const effectiveRole =
    pickRoleForSlot(slot, venue.inferredRoles)

  if (
    !isRoleTemporallyCompatible(
      venue,
      effectiveRole,
      slot.targetArrivalAt,
      slot.phase,
      timeZone,
      false
    )
  ) {
    issues.push({
      code: "temporal_role_mismatch",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} does not fit the planned time of day for a ${effectiveRole} stop.`,
      details: {
        role: effectiveRole,
        targetArrivalAt:
          slot.targetArrivalAt.toISOString(),
      },
    })
  }

  validateDaypartTypeMatch({
    venue,
    slot,
    context,
    stopIndex,
    issues,
  })

  validateGeometry({
    venue,
    previous,
    selectedBefore,
    slot,
    context,
    stopIndex,
    issues,
  })

  validateVibeAlignment({
    venue,
    slot,
    context,
    stopIndex,
    issues,
  })

  validateArchetypeAlignment({
    venue,
    slot,
    context,
    stopIndex,
    issues,
  })

  validateClubPosition({
    venue,
    slot,
    selectedBefore,
    stopIndex,
    issues,
  })

  const confidence =
    computeStopValidationConfidence({
      venue,
      slot,
      context,
      issues,
    })

  return {
    valid: !issues.some(
      (issue) => issue.severity === "error"
    ),
    stopIndex,
    slotIndex: slot.index,
    venueId: venue.id,
    issues,
    confidence,
  }
}

// -----------------------------------------------------------------------------
// Generated-stop compatibility validation
// -----------------------------------------------------------------------------

export function validateGeneratedStops(
  generatedStops: GeneratedStopValidationInput[],
  context: PlanningContext,
  options: RouteValidationOptions = {}
): RouteValidationResult {
  const normalizedInputs: StopValidationInput[] =
    generatedStops
      .map((entry, index) =>
        normalizeGeneratedStopValidationInput(
          entry,
          context,
          index
        )
      )
      .filter(
        (
          entry
        ): entry is StopValidationInput =>
          entry != null
      )

  return validateSelectedRoute(
    normalizedInputs,
    context,
    options
  )
}

function normalizeGeneratedStopValidationInput(
  entry: GeneratedStopValidationInput,
  context: PlanningContext,
  index: number
): StopValidationInput | null {
  const slot =
    entry.slot ??
    context.slots?.[index] ??
    null

  if (!slot) return null

  const sourceVenue = entry.venue

  const venue: CandidateVenue = {
    id:
      sourceVenue?.id ??
      entry.stop.venueId,
    name:
      sourceVenue?.name ??
      entry.stop.title ??
      null,
    slug:
      sourceVenue?.slug ??
      null,
    city:
      sourceVenue?.city ??
      context.anchorVenue?.city ??
      null,
    lat:
      sourceVenue?.lat ??
      entry.stop.lat ??
      null,
    lon:
      sourceVenue?.lon ??
      entry.stop.lon ??
      null,
    address:
      sourceVenue?.address ??
      entry.stop.address ??
      null,
    tags:
      sourceVenue?.tags ??
      [],
    vibe:
      sourceVenue?.vibe ??
      [],
    type:
      sourceVenue?.type ??
      (
        entry.stop.metadata?.venueTypes ??
        (
          entry.stop.venueType
            ? [entry.stop.venueType]
            : []
        )
      ),
    time_category:
      sourceVenue?.time_category ??
      [],
    price:
      sourceVenue?.price ??
      null,
    hours:
      sourceVenue?.hours ??
      null,
    bookingOptions:
      sourceVenue?.bookingOptions ??
      entry.stop.bookingOptions ??
      null,
    inferredRoles:
      entry.stop.metadata?.inferredRoles ??
      [entry.stop.role],
    distanceMeters:
      index === 0
        ? entry.stop.distanceMetersFromPrev ?? null
        : context.anchorVenue
          ? getDistanceBetweenVenues(
              context.anchorVenue,
              {
                lat:
                  sourceVenue?.lat ??
                  entry.stop.lat ??
                  null,
                lon:
                  sourceVenue?.lon ??
                  entry.stop.lon ??
                  null,
              }
            )
          : null,
    score:
      entry.stop.metadata?.score ??
      0,
  }

  return {
    venue,
    slot,
    selectedPass:
      entry.stop.metadata?.selectedPass ??
      null,
  }
}

// -----------------------------------------------------------------------------
// Geometry validation
// -----------------------------------------------------------------------------

function validateGeometry({
  venue,
  previous,
  selectedBefore,
  slot,
  context,
  stopIndex,
  issues,
}: {
  venue: CandidateVenue
  previous: CandidateVenue | null
  selectedBefore: StopValidationInput[]
  slot: PlanningSlot
  context: PlanningContext
  stopIndex: number
  issues: ValidationIssue[]
}): void {
  const anchorDistance =
    venue.distanceMeters

  if (
    slot.phase === "before" &&
    slot.index === 0 &&
    isTooFarForBeforeFirstStop(
      anchorDistance,
      context.mobility,
      false,
      context
    )
  ) {
    issues.push({
      code: "anchor_distance_exceeded",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This stop"} is too far from the event for the selected mobility preference.`,
      details: {
        anchorDistanceMeters:
          anchorDistance,
        mobility: context.mobility,
        phase: slot.phase,
      },
    })
  }

  const selectedAfter =
    selectedBefore.filter(
      (entry) => entry.slot.phase === "after"
    )

  const isImmediateAfter =
    slot.phase === "after" &&
    selectedAfter.length === 0

  if (
    isImmediateAfter &&
    isTooFarForAfterFirstStop(
      anchorDistance,
      context.mobility,
      false,
      context
    )
  ) {
    issues.push({
      code: "anchor_distance_exceeded",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This stop"} is too far from the event for an immediate post-event stop.`,
      details: {
        anchorDistanceMeters:
          anchorDistance,
        mobility: context.mobility,
        phase: slot.phase,
      },
    })
  }

  if (!previous) return

  const previousToVenue =
    getDistanceBetweenVenues(previous, venue)

  if (previousToVenue == null) return

  const maximum =
    slot.phase === "before"
      ? getMaxBeforeInterstopMeters(
          context.mobility,
          false,
          context
        )
      : getMaxAfterInterstopMeters(
          context.mobility,
          false,
          context
        )

  if (previousToVenue > maximum) {
    issues.push({
      code: "interstop_distance_exceeded",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This stop"} creates too large a move from the previous stop.`,
      details: {
        distanceMeters: previousToVenue,
        maximumMeters: maximum,
        phase: slot.phase,
        mobility: context.mobility,
      },
    })
  }
}

// -----------------------------------------------------------------------------
// Time and daypart validation
// -----------------------------------------------------------------------------

function validateDaypartTypeMatch({
  venue,
  slot,
  context,
  stopIndex,
  issues,
}: {
  venue: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  stopIndex: number
  issues: ValidationIssue[]
}): void {
  const timeZone =
    resolvePlannerTimeZone(context)

  const hour =
    getHourFractionInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  const tokens =
    getVenueContextTokens(venue)

  const morningIdentity =
    hasAnyType(tokens, MORNING_TYPES)

  const eveningIdentity =
    hasAnyType(tokens, EVENING_TYPES)

  if (
    hour < 11 &&
    eveningIdentity &&
    !morningIdentity
  ) {
    issues.push({
      code: "daypart_type_mismatch",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} does not fit a morning stop.`,
      details: {
        localHour: hour,
        timeZone,
      },
    })
  }

  if (
    hour >= 18 &&
    morningIdentity &&
    !eveningIdentity
  ) {
    issues.push({
      code: "daypart_type_mismatch",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} is primarily daytime-oriented and does not fit the planned evening window.`,
      details: {
        localHour: hour,
        timeZone,
      },
    })
  }

  if (
    hour >= 20 &&
    hasAnyType(tokens, ACTIVITY_TYPES) &&
    !hasAnyType(tokens, [
      "music",
      "theater",
      "cinema",
      "late night",
      "bar",
      "restaurant",
      "dinner",
    ])
  ) {
    issues.push({
      code: "daypart_type_mismatch",
      severity: "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This activity"} may not be a reliable fit for the planned evening time.`,
      details: {
        localHour: hour,
        timeZone,
      },
    })
  }
}

// -----------------------------------------------------------------------------
// Vibe validation
// -----------------------------------------------------------------------------

function validateVibeAlignment({
  venue,
  slot,
  context,
  stopIndex,
  issues,
}: {
  venue: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  stopIndex: number
  issues: ValidationIssue[]
}): void {
  if (
    context.vibeTags.length === 0 &&
    !context.vibePlanning
  ) {
    return
  }

  const venueTokens =
    getVenueContextTokens(venue)

  const preferredTokens =
    uniqueStrings([
      ...context.vibeTags,
      ...(context.vibePlanning?.preferredTypes ?? []),
      ...(slot.vibePreferredTypes ?? []),
    ])

  const requiredTokens =
    uniqueStrings([
      ...(context.vibePlanning?.requiredAnyTypes ?? []),
      ...(slot.vibeRequiredAnyTypes ?? []),
    ])

  const discouragedTokens =
    uniqueStrings([
      ...(context.vibePlanning?.discouragedTypes ?? []),
      ...(slot.vibeDiscouragedTypes ?? []),
    ])

  const stronglyDiscouragedTokens =
    uniqueStrings(
      context.vibePlanning
        ?.stronglyDiscouragedTypes ??
      []
    )

  const preferredMatches =
    countTokenMatches(
      venueTokens,
      preferredTokens
    )

  const requiredMatches =
    countTokenMatches(
      venueTokens,
      requiredTokens
    )

  const discouragedMatches =
    intersectTokens(
      venueTokens,
      discouragedTokens
    )

  const strongMatches =
    intersectTokens(
      venueTokens,
      stronglyDiscouragedTokens
    )

  if (strongMatches.length > 0) {
    issues.push({
      code: "strong_vibe_conflict",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} strongly conflicts with the selected vibe.`,
      details: {
        matchedStronglyDiscouragedTokens:
          strongMatches,
      },
    })
  } else if (discouragedMatches.length > 0) {
    issues.push({
      code: "strong_vibe_conflict",
      severity: "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} has qualities that conflict with the selected vibe.`,
      details: {
        matchedDiscouragedTokens:
          discouragedMatches,
      },
    })
  }

  if (
    requiredTokens.length > 0 &&
    requiredMatches === 0
  ) {
    issues.push({
      code: "weak_vibe_alignment",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} does not satisfy the route's required vibe qualities.`,
      details: {
        requiredTokens,
      },
    })
  } else if (
    preferredTokens.length > 0 &&
    preferredMatches === 0
  ) {
    issues.push({
      code: "weak_vibe_alignment",
      severity: "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} has weak alignment with the selected vibe.`,
    })
  }
}

// -----------------------------------------------------------------------------
// Archetype validation
// -----------------------------------------------------------------------------

function validateArchetypeAlignment({
  venue,
  slot,
  context,
  stopIndex,
  issues,
}: {
  venue: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  stopIndex: number
  issues: ValidationIssue[]
}): void {
  const profile =
    getEventArchetypePlanningProfile(
      context.eventArchetype
    )

  const venueTokens =
    getVenueContextTokens(venue)

  const preferredTypes =
    slot.phase === "before"
      ? profile.preferredBeforeVenueTypes
      : profile.preferredAfterVenueTypes

  const discouragedMatches =
    intersectTokens(
      venueTokens,
      profile.discouragedVenueTypes
    )

  const preferredMatches =
    countTokenMatches(
      venueTokens,
      preferredTypes
    )

  const preferredVibeMatches =
    countTokenMatches(
      venueTokens,
      profile.preferredVibes
    )

  if (discouragedMatches.length > 0) {
    issues.push({
      code: "archetype_conflict",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} conflicts with the event context.`,
      details: {
        eventArchetype:
          context.eventArchetype,
        matchedDiscouragedTypes:
          discouragedMatches,
      },
    })
  }

  if (
    preferredMatches === 0 &&
    preferredVibeMatches === 0
  ) {
    issues.push({
      code: "archetype_conflict",
      severity: "warning",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: `${venue.name ?? "This venue"} has weak contextual alignment with the event.`,
      details: {
        eventArchetype:
          context.eventArchetype,
        phase: slot.phase,
      },
    })
  }
}

// -----------------------------------------------------------------------------
// Club-position validation
// -----------------------------------------------------------------------------

function validateClubPosition({
  venue,
  slot,
  selectedBefore,
  stopIndex,
  issues,
}: {
  venue: CandidateVenue
  slot: PlanningSlot
  selectedBefore: StopValidationInput[]
  stopIndex: number
  issues: ValidationIssue[]
}): void {
  const types =
    normalizeVenueTypes(venue.type)

  if (!hasAnyType(types, ["club"])) {
    return
  }

  if (slot.phase === "before") {
    issues.push({
      code: "before_club",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: "A club should not be used as a before-event stop.",
    })

    return
  }

  const earlierAfterStops =
    selectedBefore.filter(
      (entry) => entry.slot.phase === "after"
    ).length

  if (earlierAfterStops === 0) {
    issues.push({
      code: "club_as_first_after_stop",
      severity: "error",
      stopIndex,
      slotIndex: slot.index,
      venueId: venue.id,
      message: "A club should not be the first stop immediately after the event.",
    })
  }
}

// -----------------------------------------------------------------------------
// Route-level sequence validation
// -----------------------------------------------------------------------------

function validatePhaseOrder(
  selected: StopValidationInput[],
  issues: ValidationIssue[]
): void {
  let hasSeenAfter = false

  for (let index = 0; index < selected.length; index += 1) {
    const phase =
      selected[index].slot.phase

    if (phase === "after") {
      hasSeenAfter = true
      continue
    }

    if (
      phase === "before" &&
      hasSeenAfter
    ) {
      issues.push({
        code: "phase_order_invalid",
        severity: "error",
        stopIndex: index,
        slotIndex:
          selected[index].slot.index,
        venueId:
          selected[index].venue.id,
        message: "A before-event stop appears after an after-event stop.",
      })
    }

    if (
      selected[index].slot.index !== index
    ) {
      issues.push({
        code: "invalid_stop_order",
        severity: "warning",
        stopIndex: index,
        slotIndex:
          selected[index].slot.index,
        venueId:
          selected[index].venue.id,
        message: "The route's stop order does not match its planning-slot order.",
      })
    }

    if (
      selected[index].slot.targetDepartureAt.getTime() <=
      selected[index].slot.targetArrivalAt.getTime()
    ) {
      issues.push({
        code: "invalid_timing",
        severity: "error",
        stopIndex: index,
        slotIndex:
          selected[index].slot.index,
        venueId:
          selected[index].venue.id,
        message: "The stop's departure time must be later than its arrival time.",
      })
    }
  }
}

function validateBeforeProgression(
  selected: StopValidationInput[],
  issues: ValidationIssue[]
): void {
  const beforeStops =
    selected.filter(
      (entry) => entry.slot.phase === "before"
    )

  for (
    let index = 1;
    index < beforeStops.length;
    index += 1
  ) {
    const previous =
      beforeStops[index - 1].venue

    const current =
      beforeStops[index].venue

    if (
      previous.distanceMeters == null ||
      current.distanceMeters == null
    ) {
      continue
    }

    if (
      current.distanceMeters >
      previous.distanceMeters + 350
    ) {
      issues.push({
        code: "before_route_backtracks",
        severity: "error",
        venueId: current.id,
        slotIndex:
          beforeStops[index].slot.index,
        message: `${current.name ?? "This stop"} moves away from the event instead of progressing toward it.`,
        details: {
          previousAnchorDistanceMeters:
            previous.distanceMeters,
          currentAnchorDistanceMeters:
            current.distanceMeters,
        },
      })
    }
  }
}

function validateAfterProgression(
  selected: StopValidationInput[],
  issues: ValidationIssue[]
): void {
  const afterStops =
    selected.filter(
      (entry) => entry.slot.phase === "after"
    )

  for (
    let index = 1;
    index < afterStops.length;
    index += 1
  ) {
    const previous =
      afterStops[index - 1].venue

    const current =
      afterStops[index].venue

    const interstopDistance =
      getDistanceBetweenVenues(
        previous,
        current
      )

    if (
      previous.distanceMeters == null ||
      current.distanceMeters == null ||
      interstopDistance == null
    ) {
      continue
    }

    if (
      current.distanceMeters + 300 <
        previous.distanceMeters &&
      interstopDistance > 1200
    ) {
      issues.push({
        code: "after_route_backtracks",
        severity: "warning",
        venueId: current.id,
        slotIndex:
          afterStops[index].slot.index,
        message: `${current.name ?? "This stop"} creates unnecessary backtracking after the event.`,
        details: {
          previousAnchorDistanceMeters:
            previous.distanceMeters,
          currentAnchorDistanceMeters:
            current.distanceMeters,
          interstopDistanceMeters:
            interstopDistance,
        },
      })
    }
  }
}

function validateSequenceRepetition(
  selected: StopValidationInput[],
  issues: ValidationIssue[]
): void {
  for (
    let index = 1;
    index < selected.length;
    index += 1
  ) {
    const previous =
      selected[index - 1]

    const current =
      selected[index]

    const previousTypes =
      normalizeVenueTypes(
        previous.venue.type
      )

    const currentTypes =
      normalizeVenueTypes(
        current.venue.type
      )

    const sharedTypes =
      intersectTokens(
        previousTypes,
        currentTypes
      )

    const bothDrinkStops =
      previous.slot.role === "drink" &&
      current.slot.role === "drink"

    const acceptableNightlifeRepeat =
      bothDrinkStops &&
      current.slot.phase === "after" &&
      sharedTypes.some((type) =>
        [
          "bar",
          "cocktail",
          "lounge",
          "wine bar",
        ].includes(type)
      )

    if (
      sharedTypes.length > 0 &&
      !acceptableNightlifeRepeat
    ) {
      issues.push({
        code: "sequence_repetition",
        severity: "warning",
        stopIndex: index,
        slotIndex:
          current.slot.index,
        venueId:
          current.venue.id,
        message: `${current.venue.name ?? "This stop"} is too similar to the previous stop.`,
        details: {
          sharedTypes,
        },
      })
    }
  }
}

function validateSequenceEnergy(
  selected: StopValidationInput[],
  issues: ValidationIssue[]
): void {
  for (
    let index = 1;
    index < selected.length;
    index += 1
  ) {
    const previous =
      selected[index - 1]

    const current =
      selected[index]

    const previousTokens =
      getVenueContextTokens(
        previous.venue
      )

    const currentTokens =
      getVenueContextTokens(
        current.venue
      )

    const previousIsHigh =
      hasAnyType(
        previousTokens,
        STRONG_ENERGY_TOKENS
      )

    const previousIsLow =
      hasAnyType(
        previousTokens,
        LOW_ENERGY_TOKENS
      )

    const currentIsHigh =
      hasAnyType(
        currentTokens,
        STRONG_ENERGY_TOKENS
      )

    const currentIsLow =
      hasAnyType(
        currentTokens,
        LOW_ENERGY_TOKENS
      )

    if (
      (previousIsLow && currentIsHigh) ||
      (previousIsHigh && currentIsLow)
    ) {
      issues.push({
        code: "sequence_energy_clash",
        severity: "warning",
        stopIndex: index,
        slotIndex:
          current.slot.index,
        venueId:
          current.venue.id,
        message: `${current.venue.name ?? "This stop"} creates an abrupt energy shift from the previous stop.`,
      })
    }
  }
}

// -----------------------------------------------------------------------------
// Confidence calculations
// -----------------------------------------------------------------------------

function computeStopValidationConfidence({
  venue,
  slot,
  context,
  issues,
}: {
  venue: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  issues: ValidationIssue[]
}): StopValidationResult["confidence"] {
  const role =
    confidenceFromIssues(
      issues,
      [
        "slot_role_mismatch",
      ]
    )

  const temporal =
    confidenceFromIssues(
      issues,
      [
        "venue_closed",
        "temporal_role_mismatch",
        "daypart_type_mismatch",
        "missing_hours",
      ]
    )

  const geometry =
    confidenceFromIssues(
      issues,
      [
        "anchor_distance_exceeded",
        "interstop_distance_exceeded",
        "before_route_backtracks",
        "after_route_backtracks",
      ]
    )

  const vibe =
    computeVenueVibeConfidence(
      venue,
      slot,
      context,
      issues
    )

  const archetype =
    confidenceFromIssues(
      issues,
      [
        "archetype_conflict",
      ]
    )

  const data =
    computeVenueDataConfidence(venue)

  const overall =
    weightedAverage([
      [role, 0.21],
      [temporal, 0.18],
      [geometry, 0.18],
      [vibe, 0.2],
      [archetype, 0.15],
      [data, 0.08],
    ])

  return {
    role,
    temporal,
    geometry,
    vibe,
    archetype,
    data,
    overall,
  }
}

function computeRouteValidationConfidence({
  selected,
  stopResults,
  intendedStopCount,
  duplicateVenueCount,
  emergencyStopCount,
  knownHoursCount,
  contextualDataCount,
  issues,
}: {
  selected: StopValidationInput[]
  stopResults: StopValidationResult[]
  intendedStopCount: number
  duplicateVenueCount: number
  emergencyStopCount: number
  knownHoursCount: number
  contextualDataCount: number
  issues: ValidationIssue[]
}): RouteValidationResult["confidence"] {
  const selectedCount =
    selected.length

  const completeness =
    intendedStopCount > 0
      ? clamp01(
          selectedCount /
          intendedStopCount
        )
      : selectedCount > 0
        ? 1
        : 0

  const role =
    averageConfidence(
      stopResults.map(
        (result) =>
          result.confidence.role
      )
    )

  const temporal =
    averageConfidence(
      stopResults.map(
        (result) =>
          result.confidence.temporal
      )
    )

  const geometry =
    averageConfidence(
      stopResults.map(
        (result) =>
          result.confidence.geometry
      )
    )

  const vibe =
    averageConfidence(
      stopResults.map(
        (result) =>
          result.confidence.vibe
      )
    )

  const archetype =
    averageConfidence(
      stopResults.map(
        (result) =>
          result.confidence.archetype
      )
    )

  const sequence =
    computeSequenceConfidence(
      issues,
      selectedCount,
      duplicateVenueCount,
      emergencyStopCount
    )

  const knownHoursRatio =
    selectedCount > 0
      ? knownHoursCount / selectedCount
      : 0

  const contextualRatio =
    selectedCount > 0
      ? contextualDataCount /
        selectedCount
      : 0

  const data =
    clamp01(
      knownHoursRatio * 0.45 +
      contextualRatio * 0.55
    )

  const overall =
    weightedAverage([
      [completeness, 0.12],
      [role, 0.15],
      [temporal, 0.14],
      [geometry, 0.14],
      [vibe, 0.2],
      [archetype, 0.13],
      [sequence, 0.08],
      [data, 0.04],
    ])

  return {
    completeness,
    role,
    temporal,
    geometry,
    vibe,
    archetype,
    sequence,
    data,
    overall,
  }
}

function computeVenueVibeConfidence(
  venue: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  issues: ValidationIssue[]
): number {
  if (
    context.vibeTags.length === 0 &&
    !context.vibePlanning
  ) {
    return 1
  }

  const venueTokens =
    getVenueContextTokens(venue)

  const preferred =
    uniqueStrings([
      ...context.vibeTags,
      ...(context.vibePlanning
        ?.preferredTypes ?? []),
      ...(slot.vibePreferredTypes ?? []),
    ])

  const required =
    uniqueStrings([
      ...(context.vibePlanning
        ?.requiredAnyTypes ?? []),
      ...(slot.vibeRequiredAnyTypes ?? []),
    ])

  const preferredMatchCount =
    countTokenMatches(
      venueTokens,
      preferred
    )

  const requiredMatchCount =
    countTokenMatches(
      venueTokens,
      required
    )

  const preferredScore =
    preferred.length > 0
      ? clamp01(
          preferredMatchCount /
          Math.min(
            preferred.length,
            4
          )
        )
      : 1

  const requiredScore =
    required.length > 0
      ? requiredMatchCount > 0
        ? 1
        : 0
      : 1

  const issuePenalty =
    issues.reduce(
      (penalty, issue) => {
        if (
          issue.code ===
          "strong_vibe_conflict"
        ) {
          return (
            penalty +
            (
              issue.severity === "error"
                ? 0.55
                : 0.22
            )
          )
        }

        if (
          issue.code ===
          "weak_vibe_alignment"
        ) {
          return (
            penalty +
            (
              issue.severity === "error"
                ? 0.4
                : 0.16
            )
          )
        }

        return penalty
      },
      0
    )

  return clamp01(
    preferredScore * 0.6 +
    requiredScore * 0.4 -
    issuePenalty
  )
}

function computeVenueDataConfidence(
  venue: CandidateVenue
): number {
  let score = 0

  if (venue.id?.trim()) score += 0.1

  if (
    venue.lat != null &&
    venue.lon != null &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lon)
  ) {
    score += 0.2
  }

  if (
    normalizeVenueTypes(venue.type)
      .length > 0
  ) {
    score += 0.2
  }

  if (
    normalizeStringArray(venue.tags)
      .length > 0
  ) {
    score += 0.2
  }

  if (
    normalizeStringArray(venue.vibe)
      .length > 0
  ) {
    score += 0.2
  }

  if (hasUsableHours(venue)) {
    score += 0.1
  }

  return clamp01(score)
}

function computeSequenceConfidence(
  issues: ValidationIssue[],
  selectedCount: number,
  duplicateVenueCount: number,
  emergencyStopCount: number
): number {
  if (selectedCount === 0) return 0

  let score = 1

  score -=
    duplicateVenueCount * 0.35

  score -=
    emergencyStopCount * 0.12

  for (const issue of issues) {
    if (
      issue.code ===
      "sequence_repetition"
    ) {
      score -=
        issue.severity === "error"
          ? 0.25
          : 0.1
    }

    if (
      issue.code ===
      "sequence_energy_clash"
    ) {
      score -=
        issue.severity === "error"
          ? 0.25
          : 0.1
    }

    if (
      issue.code ===
        "before_route_backtracks" ||
      issue.code ===
        "after_route_backtracks"
    ) {
      score -=
        issue.severity === "error"
          ? 0.3
          : 0.12
    }

    if (
      issue.code ===
      "phase_order_invalid"
    ) {
      score -= 0.5
    }
  }

  return clamp01(score)
}

function confidenceFromIssues(
  issues: ValidationIssue[],
  codes: ValidationIssueCode[]
): number {
  let score = 1

  for (const issue of issues) {
    if (!codes.includes(issue.code)) {
      continue
    }

    score -=
      issue.severity === "error"
        ? 0.55
        : 0.18
  }

  return clamp01(score)
}

// -----------------------------------------------------------------------------
// Data helpers
// -----------------------------------------------------------------------------

function hasContextualVenueData(
  venue: Pick<
    VenueRecord,
    "tags" | "vibe" | "type"
  >
): boolean {
  const tags =
    normalizeStringArray(venue.tags)

  const vibes =
    normalizeStringArray(venue.vibe)

  const types =
    normalizeVenueTypes(venue.type)

  return (
    types.length > 0 &&
    (
      tags.length > 0 ||
      vibes.length > 0
    )
  )
}

function hasUsableHours(
  venue: Pick<VenueRecord, "hours">
): boolean {
  const hours = venue.hours

  if (!hours) return false

  if (typeof hours === "string") {
    const normalized =
      hours.trim()

    return (
      normalized.length > 0 &&
      normalized !== "{}" &&
      normalized !== "null"
    )
  }

  if (
    typeof hours === "object" &&
    !Array.isArray(hours)
  ) {
    return (
      Object.keys(hours).length > 0
    )
  }

  return false
}

function getVenueContextTokens(
  venue: Pick<
    VenueRecord,
    "type" | "tags" | "vibe" | "time_category"
  >
): string[] {
  return uniqueStrings([
    ...normalizeVenueTypes(
      venue.type
    ),
    ...normalizeStringArray(
      venue.tags
    ),
    ...normalizeStringArray(
      venue.vibe
    ),
    ...normalizeStringArray(
      venue.time_category
    ),
  ])
}

function intersectTokens(
  source: string[],
  target: string[]
): string[] {
  if (
    source.length === 0 ||
    target.length === 0
  ) {
    return []
  }

  const targetSet =
    new Set(
      target.map(normalizeToken)
    )

  return uniqueStrings(
    source
      .map(normalizeToken)
      .filter((token) =>
        targetSet.has(token)
      )
  )
}

function countTokenMatches(
  source: string[],
  target: string[]
): number {
  return intersectTokens(
    source,
    target
  ).length
}

function normalizeToken(
  value: string
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

// -----------------------------------------------------------------------------
// Numeric helpers
// -----------------------------------------------------------------------------

function averageConfidence(
  values: number[]
): number {
  if (values.length === 0) {
    return 0
  }

  return clamp01(
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  )
}

function weightedAverage(
  values: Array<[number, number]>
): number {
  const totalWeight =
    values.reduce(
      (sum, [, weight]) =>
        sum + weight,
      0
    )

  if (totalWeight <= 0) {
    return 0
  }

  const weightedTotal =
    values.reduce(
      (
        sum,
        [value, weight]
      ) =>
        sum +
        clamp01(value) * weight,
      0
    )

  return Number(
    clamp01(
      weightedTotal / totalWeight
    ).toFixed(3)
  )
}

function normalizeConfidenceThreshold(
  value: number | null | undefined,
  fallback: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback
  }

  return clamp01(value)
}

function clamp01(
  value: number
): number {
  return Math.max(
    0,
    Math.min(1, value)
  )
}