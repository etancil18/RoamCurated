// lib/outings/sequenceScoring/selection.ts

import type {
  PlanningContext,
  PlanningSlot,
  SelectionPass,
  SlotPhase,
  StopRole,
} from "../types"
import type {
  CandidateVenue,
  VenueWithHours,
} from "./types"

import {
  candidateSupportsSlot,
  computeSlotRoleFitBonus,
  pickRoleForSlot,
} from "./roles"

import {
  getDistanceBetweenVenues,
  getMaxAfterInterstopMeters,
  getMaxAfterLocalFallbackMeters,
  getMaxBeforeInterstopMeters,
  isTooFarForAfterFirstStop,
  isTooFarForBeforeFirstStop,
} from "./geometry"

import {
  isLateNightAfterFallbackContext,
  isLateNightNightlifeType,
} from "./lateNight"

import {
  computeTemporalFitPenalty,
  isLateNightFallbackVenueTemporallyEligible,
  isRoleTemporallyCompatible,
  isVenueOpenForWindow,
  isVenueOpenUntilAtLeastTwoAm,
} from "./temporal"

import {
  hasAnyType,
  normalizePrice,
  normalizeStringArray,
  normalizeVenueTypes,
  priceToInt,
  uniqueStrings,
} from "./helpers"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

import {
  computeSequentialCandidateScore,
} from "./bias"

// -----------------------------------------------------------------------------
// Internal selection types
// -----------------------------------------------------------------------------

type RejectionCounts = {
  used: number
  role: number
  geometry: number
  temporal: number
  type_time: number
  hours: number
  missing_data: number
  vibe_required: number
  vibe_discouraged: number
}

type SelectionPassConfig = {
  name: SelectionPass

  /**
   * Allows the slot's flexible role and adjacent hospitality roles to compete.
   */
  relaxedRole: boolean

  /**
   * Uses relaxed city distance limits instead of strict limits.
   */
  relaxedGeometry: boolean

  /**
   * Softens role/daypart compatibility but never permits a venue known to be
   * closed for the requested window.
   */
  relaxedTemporal: boolean

  /**
   * Allows candidates with weak inferred-role coverage when their venue
   * features still make them plausible for the slot.
   */
  allowWeakRoleMatch: boolean

  /**
   * Allows a non-nightlife-labeled venue into a late-night fallback when its
   * hours and hospitality identity still support the window.
   */
  bypassLateNightNightlifeType: boolean

  /**
   * Allows unknown or incomplete venue hours. Known-closed venues remain
   * ineligible.
   */
  allowMissingOrUncertainHours: boolean

  /**
   * Penalty applied after canonical candidate scoring so earlier passes win
   * when quality is otherwise similar.
   */
  passPenalty: number
}

type CandidateEvaluation = {
  eligible: boolean
  reason?:
    | "used"
    | "role"
    | "geometry"
    | "temporal"
    | "type_time"
    | "hours"
    | "missing_data"
    | "vibe_required"
    | "vibe_discouraged"
}

type RankedCandidateForPass = {
  venue: CandidateVenue
  score: number
}

type VibeMatchEvidence = {
  active: boolean
  requiredMatches: string[]
  preferredMatches: string[]
  requestedTokenMatches: string[]
  discouragedMatches: string[]
  stronglyDiscouragedMatches: string[]
}

type MealOccasion =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"

export type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: SlotPhase
  selectedVenueId: string | null
  selectedPass: SelectionPass | null
  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: RejectionCounts
}

export type SelectedSlotVenue = {
  venue: CandidateVenue
  slot: PlanningSlot
  selectedPass: SelectionPass
}

export type SelectionDebugResult = {
  selected: SelectedSlotVenue[]
  slotDiagnostics: SlotSelectionDebug[]
}

// -----------------------------------------------------------------------------
// Selection passes
// -----------------------------------------------------------------------------

const SELECTION_PASSES: SelectionPassConfig[] = [
  {
    name: "strict",
    relaxedRole: false,
    relaxedGeometry: false,
    relaxedTemporal: false,
    allowWeakRoleMatch: false,
    bypassLateNightNightlifeType: false,
    allowMissingOrUncertainHours: true,
    passPenalty: 0,
  },
  {
    name: "balanced",
    relaxedRole: true,
    relaxedGeometry: false,
    relaxedTemporal: false,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: false,
    allowMissingOrUncertainHours: true,
    passPenalty: 5,
  },
  {
    name: "relaxed",
    relaxedRole: true,
    relaxedGeometry: true,
    relaxedTemporal: true,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: true,
    allowMissingOrUncertainHours: true,
    passPenalty: 12,
  },
  {
    name: "emergency",
    relaxedRole: true,
    relaxedGeometry: true,
    relaxedTemporal: true,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: true,
    allowMissingOrUncertainHours: true,
    passPenalty: 24,
  },
]

const DINNER_MINIMUM_LOCAL_HOUR = 17.5

// -----------------------------------------------------------------------------
// Public selection entrypoint
// -----------------------------------------------------------------------------

export function selectCandidates(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext,
  slots: PlanningSlot[]
): SelectionDebugResult {
  const selected: SelectedSlotVenue[] = []
  const usedIds = new Set<string>()
  const slotDiagnostics: SlotSelectionDebug[] = []
  const timeZone = resolvePlannerTimeZone(context)

  for (const slot of slots) {
    let aggregateRejections = emptyRejectionCounts()
    let aggregateMatchedRole = 0
    let aggregatePassedHardConstraints = 0

    let selectedForSlot: {
      venue: CandidateVenue
      pass: SelectionPass
      matchedRole: number
      passedHardConstraints: number
      rejectionCounts: RejectionCounts
    } | null = null

    for (const pass of SELECTION_PASSES) {
      const attempt = selectBestCandidateForPass({
        rankedCandidates,
        selected,
        usedIds,
        slot,
        context,
        timeZone,
        pass,
      })

      aggregateRejections = mergeRejectionCounts(
        aggregateRejections,
        attempt.rejectionCounts
      )

      aggregateMatchedRole += attempt.matchedRole
      aggregatePassedHardConstraints += attempt.passedHardConstraints

      if (!attempt.best) continue

      selectedForSlot = {
        venue: attempt.best,
        pass: pass.name,
        matchedRole: attempt.matchedRole,
        passedHardConstraints: attempt.passedHardConstraints,
        rejectionCounts: attempt.rejectionCounts,
      }

      break
    }

    if (selectedForSlot) {
      selected.push({
        venue: selectedForSlot.venue,
        slot,
        selectedPass: selectedForSlot.pass,
      })

      usedIds.add(selectedForSlot.venue.id)

      slotDiagnostics.push({
        slotIndex: slot.index,
        role: slot.role,
        phase: slot.phase,
        selectedVenueId: selectedForSlot.venue.id,
        selectedPass: selectedForSlot.pass,
        candidatesTotal: rankedCandidates.length,
        matchedRole: selectedForSlot.matchedRole,
        passedHardConstraints: selectedForSlot.passedHardConstraints,
        rejectionCounts: selectedForSlot.rejectionCounts,
      })

      continue
    }

    slotDiagnostics.push({
      slotIndex: slot.index,
      role: slot.role,
      phase: slot.phase,
      selectedVenueId: null,
      selectedPass: null,
      candidatesTotal: rankedCandidates.length,
      matchedRole: aggregateMatchedRole,
      passedHardConstraints: aggregatePassedHardConstraints,
      rejectionCounts: aggregateRejections,
    })
  }

  return {
    selected,
    slotDiagnostics,
  }
}

// -----------------------------------------------------------------------------
// Pass execution
// -----------------------------------------------------------------------------

function selectBestCandidateForPass({
  rankedCandidates,
  selected,
  usedIds,
  slot,
  context,
  timeZone,
  pass,
}: {
  rankedCandidates: CandidateVenue[]
  selected: SelectedSlotVenue[]
  usedIds: Set<string>
  slot: PlanningSlot
  context: PlanningContext
  timeZone: string
  pass: SelectionPassConfig
}): {
  best: CandidateVenue | null
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: RejectionCounts
} {
  const rejectionCounts = emptyRejectionCounts()
  const selectedVenues = unwrapSelectedVenues(selected)

  let matchedRole = 0
  let passedHardConstraints = 0

  const eligibleCandidates: RankedCandidateForPass[] = []

  for (const candidate of rankedCandidates) {
    const evaluation = evaluateCandidateForPass({
      candidate,
      rankedCandidates,
      selected,
      usedIds,
      slot,
      context,
      timeZone,
      pass,
    })

    if (!evaluation.eligible) {
      incrementRejectionCount(
        rejectionCounts,
        evaluation.reason
      )

      continue
    }

    const supportsRole = candidateSupportsSlot(
      candidate,
      slot,
      context,
      pass.relaxedRole
    )

    if (
      supportsRole ||
      isContextuallyCompatibleForSlot(
        candidate,
        slot,
        context
      )
    ) {
      matchedRole += 1
    }

    passedHardConstraints += 1

    const canonicalScore = computeSequentialCandidateScore(
      candidate,
      selectedVenues,
      slot,
      context,
      pass.name
    )

    const roleFitScore =
      computeSlotRoleFitBonus(
        candidate,
        slot
      ) +
      computeContextualRoleFitBonus(
        candidate,
        slot,
        context,
        pass
      )

    const vibeAdjustment =
      computeSelectionVibeAdjustment({
        candidate,
        slot,
        context,
        pass,
      })

    const temporalPenalty =
      computeSelectionTemporalPenalty({
        candidate,
        slot,
        timeZone,
        pass,
      })

    const dataQualityPenalty =
      computeMissingDataPenalty(
        candidate,
        pass
      )

    const passScore =
      canonicalScore +
      roleFitScore +
      vibeAdjustment -
      temporalPenalty -
      dataQualityPenalty -
      pass.passPenalty

    eligibleCandidates.push({
      venue: candidate,
      score: passScore,
    })
  }

  eligibleCandidates.sort(
    compareRankedCandidates
  )

  return {
    best:
      eligibleCandidates[0]?.venue ??
      null,

    matchedRole,
    passedHardConstraints,
    rejectionCounts,
  }
}

// -----------------------------------------------------------------------------
// Candidate pass evaluation
// -----------------------------------------------------------------------------

function evaluateCandidateForPass({
  candidate,
  rankedCandidates,
  selected,
  usedIds,
  slot,
  context,
  timeZone,
  pass,
}: {
  candidate: CandidateVenue
  rankedCandidates: CandidateVenue[]
  selected: SelectedSlotVenue[]
  usedIds: Set<string>
  slot: PlanningSlot
  context: PlanningContext
  timeZone: string
  pass: SelectionPassConfig
}): CandidateEvaluation {
  if (
    usedIds.has(
      candidate.id
    )
  ) {
    return {
      eligible: false,
      reason: "used",
    }
  }

  if (
    !hasUsableCoreVenueData(
      candidate
    )
  ) {
    return {
      eligible: false,
      reason: "missing_data",
    }
  }

  /*
   * Meal occasions are mutually exclusive across one planned outing.
   *
   * A route may contain multiple hospitality stops, but it must never contain
   * two breakfasts, two brunches, two lunches, or two dinners.
   */
  if (
    hasDuplicateMealOccasion({
      candidate,
      selected,
      slot,
      timeZone,
    })
  ) {
    return {
      eligible: false,
      reason: "role",
    }
  }

  const supportsRole =
    candidateSupportsSlot(
      candidate,
      slot,
      context,
      pass.relaxedRole
    ) ||
    isContextuallyCompatibleForSlot(
      candidate,
      slot,
      context
    ) ||
    isBeforeDinnerFallbackCandidate({
      candidate,
      rankedCandidates,
      slot,
      timeZone,
    }) ||
    (
      pass.allowWeakRoleMatch &&
      isWeaklyCompatibleForSlot(
        candidate,
        slot,
        context
      )
    )

  if (!supportsRole) {
    return {
      eligible: false,
      reason: "role",
    }
  }

  if (
    !pass.relaxedTemporal &&
    hasImpossibleTimeOfDayMismatch(
      candidate,
      slot,
      timeZone
    )
  ) {
    return {
      eligible: false,
      reason: "type_time",
    }
  }

  if (
    isStronglyDiscouragedForSlot(
      candidate,
      slot,
      context
    ) &&
    pass.name !== "emergency"
  ) {
    return {
      eligible: false,
      reason: "vibe_discouraged",
    }
  }

  if (
    !passesVibeEligibilityForPass({
      candidate,
      slot,
      context,
      pass,
    })
  ) {
    return {
      eligible: false,
      reason: "vibe_required",
    }
  }

  /*
   * Price is part of the meaning of a vibe.
   *
   * A casual request must not return a $$$$ venue during normal selection.
   * The emergency pass may preserve coverage, but the candidate still receives
   * a severe price mismatch penalty.
   */
  if (
    !passesVibePriceEligibility({
      candidate,
      context,
      pass,
    })
  ) {
    return {
      eligible: false,
      reason: "vibe_discouraged",
    }
  }

  const spatialEligibility =
    evaluateCandidateEligibilityForSlot(
      candidate,
      selected,
      slot,
      context,
      pass.relaxedGeometry,
      timeZone,
      pass.bypassLateNightNightlifeType
    )

  if (!spatialEligibility.eligible) {
    return {
      eligible: false,
      reason:
        spatialEligibility.reason ??
        "geometry",
    }
  }

  const temporalEligibility =
    evaluateTemporalEligibility(
      candidate,
      slot,
      context,
      timeZone,
      pass.relaxedTemporal,
      pass.allowMissingOrUncertainHours
    )

  if (!temporalEligibility.eligible) {
    return {
      eligible: false,
      reason:
        temporalEligibility.reason ??
        "temporal",
    }
  }

  return {
    eligible: true,
  }
}

// -----------------------------------------------------------------------------
// Public diagnostics builder
// -----------------------------------------------------------------------------

export function buildSelectionDebug(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext
): {
  candidatePoolSize: number
  preparedCandidateCount: number
  selectedStopCount: number
  completionRate: number
  slotDiagnostics: SlotSelectionDebug[]
} {
  const slots: PlanningSlot[] =
    context.slots?.length
      ? context.slots
      : context.desiredRoles.map(
          (role, index) => {
            const phase: SlotPhase =
              context.mode === "before"
                ? "before"
                : context.mode === "after"
                  ? "after"
                  : index === 0
                    ? "before"
                    : "after"

            return {
              index,
              role,
              phase,
              targetArrivalAt:
                context.plannedStartAt,
              targetDepartureAt:
                context.plannedEndAt,
              dwellMinutes: 45,
              strictProgression: false,
              flexibleRole: null,
            }
          }
        )

  const selection = selectCandidates(
    rankedCandidates,
    context,
    slots
  )

  const intendedStopCount =
    slots.length ||
    context.desiredRoles.length

  return {
    candidatePoolSize:
      rankedCandidates.length,

    preparedCandidateCount:
      rankedCandidates.length,

    selectedStopCount:
      selection.selected.length,

    completionRate:
      intendedStopCount > 0
        ? Number(
            (
              selection.selected.length /
              intendedStopCount
            ).toFixed(2)
          )
        : 0,

    slotDiagnostics:
      selection.slotDiagnostics,
  }
}

// -----------------------------------------------------------------------------
// Geometry eligibility
// -----------------------------------------------------------------------------

export function evaluateCandidateEligibilityForSlot(
  candidate: CandidateVenue,
  selectedSoFar: SelectedSlotVenue[] | CandidateVenue[],
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false,
  timeZone = resolvePlannerTimeZone(context),
  bypassLateNightNightlifeType = false
): {
  eligible: boolean
  reason?: "geometry" | "missing_data"
} {
  if (
    candidate.lat == null ||
    candidate.lon == null ||
    !Number.isFinite(candidate.lat) ||
    !Number.isFinite(candidate.lon)
  ) {
    return {
      eligible: false,
      reason: "missing_data",
    }
  }

  const eligible =
    isCandidateEligibleForSlot(
      candidate,
      selectedSoFar,
      slot,
      context,
      relaxed,
      timeZone,
      bypassLateNightNightlifeType
    )

  return {
    eligible,
    reason:
      eligible
        ? undefined
        : "geometry",
  }
}

export function isCandidateEligibleForSlot(
  candidate: CandidateVenue,
  selectedSoFar: SelectedSlotVenue[] | CandidateVenue[],
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false,
  timeZone = resolvePlannerTimeZone(context),
  bypassLateNightNightlifeType = false
): boolean {
  const selectedVenues =
    unwrapSelectedVenues(
      selectedSoFar
    )

  const selectedSlotVenues =
    unwrapSelectedSlotVenues(
      selectedSoFar
    )

  if (
    selectedVenues.some(
      (venue) =>
        venue.id === candidate.id
    )
  ) {
    return false
  }

  const anchorDistance =
    candidate.distanceMeters

  const previous =
    selectedVenues[
      selectedVenues.length - 1
    ] ?? null

  const previousToCandidateDistance =
    previous
      ? getDistanceBetweenVenues(
          previous,
          candidate
        )
      : null

  if (
    !passesSpatialCoherenceGate({
      candidate,
      previous,
      previousDistanceMeters:
        previousToCandidateDistance,
      slot,
      context,
      relaxed,
      selectedSlotVenues,
    })
  ) {
    return false
  }

  if (slot.phase === "before") {
    if (
      slot.index === 0 &&
      isTooFarForBeforeFirstStop(
        anchorDistance,
        context.mobility,
        relaxed,
        context
      )
    ) {
      return false
    }

    if (
      slot.index > 0 &&
      previousToCandidateDistance != null &&
      previousToCandidateDistance >
        getMaxBeforeInterstopMeters(
          context.mobility,
          relaxed,
          context
        )
    ) {
      return false
    }

    if (
      slot.index > 0 &&
      slot.strictProgression &&
      !relaxed &&
      anchorDistance != null &&
      previous?.distanceMeters != null &&
      anchorDistance >
        previous.distanceMeters + 500
    ) {
      return false
    }
  }

  if (slot.phase === "after") {
    const afterSelections =
      selectedSlotVenues.filter(
        (selection) =>
          selection.slot.phase ===
          "after"
      )

    const previousAfterVenue =
      afterSelections[
        afterSelections.length - 1
      ]?.venue ?? null

    const isImmediatePostEvent =
      afterSelections.length === 0

    const lateNightFallback =
      isLateNightAfterFallbackContext(
        context,
        slot
      )

    if (
      isImmediatePostEvent &&
      isTooFarForAfterFirstStop(
        anchorDistance,
        context.mobility,
        lateNightFallback
          ? true
          : relaxed,
        context
      )
    ) {
      return false
    }

    if (!isImmediatePostEvent) {
      const afterPreviousDistance =
        previousAfterVenue
          ? getDistanceBetweenVenues(
              previousAfterVenue,
              candidate
            )
          : previousToCandidateDistance

      const maxInterstop =
        getMaxAfterInterstopMeters(
          context.mobility,
          relaxed,
          context
        )

      if (
        afterPreviousDistance != null &&
        afterPreviousDistance >
          maxInterstop
      ) {
        return false
      }

      const directionallyConsistent =
        isDirectionallyConsistentFromAfterStops(
          afterSelections,
          candidate,
          context
        )

      const localFallbackLimit =
        getMaxAfterLocalFallbackMeters(
          context.mobility,
          context
        )

      if (
        !directionallyConsistent &&
        afterPreviousDistance != null &&
        afterPreviousDistance >
          localFallbackLimit
      ) {
        return false
      }
    }
  }

  const types =
    normalizeVenueTypes(
      candidate.type
    )

  const referenceHour =
    getHourFractionInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  const effectiveRole =
    pickRoleForSlot(
      slot,
      candidate.inferredRoles
    )

  if (
    slot.phase === "before" &&
    hasAnyType(
      types,
      [
        "club",
        "nightclub",
      ]
    ) &&
    referenceHour < 20
  ) {
    return false
  }

  if (
    effectiveRole === "food" &&
    hasAnyType(
      types,
      ["dinner"]
    ) &&
    referenceHour < 11
  ) {
    return false
  }

  if (
    isLateNightAfterFallbackContext(
      context,
      slot
    ) &&
    !bypassLateNightNightlifeType &&
    !isLateNightNightlifeType(
      candidate
    )
  ) {
    return false
  }

  return true
}

function passesSpatialCoherenceGate({
  candidate,
  previous,
  previousDistanceMeters,
  slot,
  context,
  relaxed,
  selectedSlotVenues,
}: {
  candidate: CandidateVenue
  previous: CandidateVenue | null
  previousDistanceMeters: number | null
  slot: PlanningSlot
  context: PlanningContext
  relaxed: boolean
  selectedSlotVenues: SelectedSlotVenue[]
}): boolean {
  if (
    !previous ||
    previousDistanceMeters == null
  ) {
    return true
  }

  const maxInterstop =
    slot.phase === "before"
      ? getMaxBeforeInterstopMeters(
          context.mobility,
          relaxed,
          context
        )
      : getMaxAfterInterstopMeters(
          context.mobility,
          relaxed,
          context
        )

  if (
    previousDistanceMeters >
    maxInterstop
  ) {
    return false
  }

  if (
    slot.phase === "before" &&
    slot.strictProgression &&
    !relaxed &&
    candidate.distanceMeters != null &&
    previous.distanceMeters != null &&
    candidate.distanceMeters >
      previous.distanceMeters + 500
  ) {
    return false
  }

  if (slot.phase === "after") {
    const afterSelections =
      selectedSlotVenues.filter(
        (selection) =>
          selection.slot.phase ===
          "after"
      )

    const previousAfterVenue =
      afterSelections[
        afterSelections.length - 1
      ]?.venue ?? null

    if (previousAfterVenue) {
      const afterDistance =
        getDistanceBetweenVenues(
          previousAfterVenue,
          candidate
        )

      if (
        afterDistance != null &&
        afterDistance >
          getMaxAfterInterstopMeters(
            context.mobility,
            relaxed,
            context
          )
      ) {
        return false
      }
    }
  }

  return true
}

function isDirectionallyConsistentFromAfterStops(
  afterSelections: SelectedSlotVenue[],
  candidate: CandidateVenue,
  context: PlanningContext
): boolean {
  const anchor =
    context.anchorVenue

  const firstAfterVenue =
    afterSelections[0]?.venue ??
    null

  const previous =
    afterSelections[
      afterSelections.length - 1
    ]?.venue ?? null

  if (
    !anchor ||
    !firstAfterVenue ||
    !previous ||
    afterSelections.length < 1
  ) {
    return true
  }

  if (
    anchor.lat == null ||
    anchor.lon == null ||
    firstAfterVenue.lat == null ||
    firstAfterVenue.lon == null ||
    previous.lat == null ||
    previous.lon == null ||
    candidate.lat == null ||
    candidate.lon == null
  ) {
    return true
  }

  const outboundX =
    firstAfterVenue.lon -
    anchor.lon

  const outboundY =
    firstAfterVenue.lat -
    anchor.lat

  const nextStepX =
    candidate.lon -
    previous.lon

  const nextStepY =
    candidate.lat -
    previous.lat

  const outboundMagnitude =
    Math.hypot(
      outboundX,
      outboundY
    )

  const nextStepMagnitude =
    Math.hypot(
      nextStepX,
      nextStepY
    )

  if (
    outboundMagnitude === 0 ||
    nextStepMagnitude === 0
  ) {
    return true
  }

  const directionalSimilarity =
    (
      outboundX * nextStepX +
      outboundY * nextStepY
    ) /
    (
      outboundMagnitude *
      nextStepMagnitude
    )

  return (
    directionalSimilarity >= 0.2
  )
}

// -----------------------------------------------------------------------------
// Temporal eligibility
// -----------------------------------------------------------------------------

export function evaluateTemporalEligibility(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  timeZone: string,
  relaxed = false,
  allowMissingOrUncertainHours = false
): {
  eligible: boolean
  reason?: "temporal" | "hours"
} {
  const role =
    pickRoleForSlot(
      slot,
      candidate.inferredRoles
    )

  const hasKnownHours =
    hasUsableVenueHours(
      candidate
    )

  if (
    !hasKnownHours &&
    allowMissingOrUncertainHours
  ) {
    const roleCompatible =
      isRoleTemporallyCompatible(
        candidate,
        role,
        slot.targetArrivalAt,
        slot.phase,
        timeZone,
        relaxed
      )

    return {
      eligible:
        roleCompatible ||
        relaxed,

      reason:
        roleCompatible ||
        relaxed
          ? undefined
          : "temporal",
    }
  }

  if (
    !hasKnownHours &&
    !allowMissingOrUncertainHours
  ) {
    return {
      eligible: false,
      reason: "hours",
    }
  }

  if (
    isLateNightAfterFallbackContext(
      context,
      slot
    )
  ) {
    const lateNightEligible =
      isLateNightFallbackVenueTemporallyEligible(
        candidate,
        slot,
        context,
        timeZone
      )

    if (!lateNightEligible) {
      logLateNightTemporalRejection({
        candidate,
        slot,
        context,
        timeZone,
        relaxed,
        role,
        lateNightEligibleOverall:
          false,
      })

      return {
        eligible: false,
        reason: "hours",
      }
    }

    return {
      eligible: true,
    }
  }

  const roleCompatible =
    isRoleTemporallyCompatible(
      candidate,
      role,
      slot.targetArrivalAt,
      slot.phase,
      timeZone,
      relaxed
    )

  if (
    !roleCompatible &&
    !relaxed
  ) {
    return {
      eligible: false,
      reason: "temporal",
    }
  }

  const openForWindow =
    isVenueOpenForWindow(
      candidate,
      slot.targetArrivalAt,
      slot.targetDepartureAt,
      timeZone,
      relaxed
    )

  if (!openForWindow) {
    return {
      eligible: false,
      reason: "hours",
    }
  }

  return {
    eligible: true,
  }
}

// -----------------------------------------------------------------------------
// Contextual role compatibility
// -----------------------------------------------------------------------------

function isContextuallyCompatibleForSlot(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): boolean {
  const roles =
    candidate.inferredRoles ??
    []

  const tokens =
    getCandidateTokens(
      candidate
    )

  if (
    roles.includes(
      slot.role
    )
  ) {
    return true
  }

  if (
    slot.flexibleRole &&
    roles.includes(
      slot.flexibleRole
    )
  ) {
    return true
  }

  const preferredTypes =
    uniqueStrings([
      ...(
        slot.vibePreferredTypes ??
        []
      ),
      ...getArchetypeSlotTypeHints(
        context.eventArchetype,
        slot.phase
      ),
    ])

  if (
    preferredTypes.length > 0 &&
    hasAnyType(
      tokens,
      preferredTypes
    )
  ) {
    return true
  }

  if (slot.role === "coffee") {
    return hasAnyType(
      tokens,
      [
        "coffee",
        "cafe",
        "café",
        "tea",
        "matcha",
        "bakery",
        "breakfast",
        "hotel lobby",
        "bookstore",
      ]
    )
  }

  if (slot.role === "food") {
    return hasAnyType(
      tokens,
      [
        "restaurant",
        "food",
        "breakfast",
        "brunch",
        "lunch",
        "dinner",
        "food hall",
        "gastropub",
        "bakery",
        "cafe",
        "café",
      ]
    )
  }

  if (slot.role === "drink") {
    return hasAnyType(
      tokens,
      [
        "bar",
        "cocktail",
        "wine bar",
        "lounge",
        "speakeasy",
        "brewery",
        "pub",
        "rooftop",
        "hotel bar",
        "restaurant",
      ]
    )
  }

  if (slot.role === "dessert") {
    return hasAnyType(
      tokens,
      [
        "dessert",
        "bakery",
        "ice cream",
        "gelato",
        "pastry",
        "cafe",
        "café",
        "wine bar",
        "cocktail",
        "lounge",
      ]
    )
  }

  if (slot.role === "activity") {
    return hasAnyType(
      tokens,
      [
        "gallery",
        "museum",
        "bookstore",
        "market",
        "park",
        "garden",
        "showroom",
        "lifestyle",
        "music",
        "cinema",
        "theater",
        "activity",
      ]
    )
  }

  return false
}

function isWeaklyCompatibleForSlot(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): boolean {
  const roles =
    candidate.inferredRoles ??
    []

  if (roles.length === 0) {
    return (
      getCandidateTokens(
        candidate
      ).length > 0
    )
  }

  if (
    slot.role === "food" ||
    slot.role === "drink" ||
    slot.role === "coffee" ||
    slot.role === "dessert"
  ) {
    return roles.some(
      (role) =>
        [
          "food",
          "drink",
          "coffee",
          "dessert",
        ].includes(role)
    )
  }

  if (slot.role === "activity") {
    return (
      roles.includes("activity") ||
      isContextuallyCompatibleForSlot(
        candidate,
        slot,
        context
      )
    )
  }

  return false
}

function computeContextualRoleFitBonus(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  pass: SelectionPassConfig
): number {
  if (
    candidate.inferredRoles.includes(
      slot.role
    )
  ) {
    return 10
  }

  if (
    slot.flexibleRole &&
    candidate.inferredRoles.includes(
      slot.flexibleRole
    )
  ) {
    return 5
  }

  if (
    isContextuallyCompatibleForSlot(
      candidate,
      slot,
      context
    )
  ) {
    return (
      pass.name === "strict"
        ? 3
        : 1
    )
  }

  if (
    pass.allowWeakRoleMatch &&
    isWeaklyCompatibleForSlot(
      candidate,
      slot,
      context
    )
  ) {
    return -4
  }

  return -10
}

// -----------------------------------------------------------------------------
// Meal-occasion uniqueness
// -----------------------------------------------------------------------------

function hasDuplicateMealOccasion({
  candidate,
  selected,
  slot,
  timeZone,
}: {
  candidate: CandidateVenue
  selected: SelectedSlotVenue[]
  slot: PlanningSlot
  timeZone: string
}): boolean {
  const candidateOccasion =
    getMealOccasionForCandidate(
      candidate,
      slot,
      timeZone
    )

  if (!candidateOccasion) {
    return false
  }

  return selected.some(
    (selection) => {
      const selectedOccasion =
        getMealOccasionForCandidate(
          selection.venue,
          selection.slot,
          timeZone
        )

      return (
        selectedOccasion ===
        candidateOccasion
      )
    }
  )
}

function getMealOccasionForCandidate(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  timeZone: string
): MealOccasion | null {
  const tokens =
    getNormalizedCandidateTokens(
      candidate
    )

  const isMealLike =
    candidate.inferredRoles.includes(
      "food"
    ) ||
    hasAnyType(
      tokens,
      [
        "food",
        "restaurant",
        "breakfast",
        "brunch",
        "lunch",
        "dinner",
        "supper",
        "food hall",
        "gastropub",
        "fine dining",
        "casual dining",
        "small plates",
        "bakery",
        "cafe",
        "café",
      ]
    )

  if (!isMealLike) {
    return null
  }

  /*
   * Explicit venue identity wins over inferred arrival time.
   */
  if (
    hasAnyType(
      tokens,
      ["breakfast"]
    )
  ) {
    return "breakfast"
  }

  if (
    hasAnyType(
      tokens,
      ["brunch"]
    )
  ) {
    return "brunch"
  }

  if (
    hasAnyType(
      tokens,
      ["lunch"]
    )
  ) {
    return "lunch"
  }

  if (
    hasAnyType(
      tokens,
      [
        "dinner",
        "supper",
        "fine dining",
      ]
    )
  ) {
    return "dinner"
  }

  const hour =
    getHourFractionInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  /*
   * Post-midnight food belongs to the prior evening's dinner/late-night meal
   * occasion rather than becoming a second breakfast.
   */
  if (hour < 4) {
    return "dinner"
  }

  if (hour < 10.5) {
    return "breakfast"
  }

  if (hour < 12.5) {
    return "brunch"
  }

  if (
    hour <
    DINNER_MINIMUM_LOCAL_HOUR
  ) {
    return "lunch"
  }

  return "dinner"
}

// -----------------------------------------------------------------------------
// Vibe safeguards and displacement scoring
// -----------------------------------------------------------------------------

function passesVibeEligibilityForPass({
  candidate,
  slot,
  context,
  pass,
}: {
  candidate: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  pass: SelectionPassConfig
}): boolean {
  const evidence =
    getVibeMatchEvidence(
      candidate,
      slot,
      context
    )

  if (!evidence.active) {
    return true
  }

  if (
    pass.name === "emergency"
  ) {
    return true
  }

  if (
    pass.name === "relaxed"
  ) {
    return true
  }

  if (
    pass.name === "strict"
  ) {
    if (
      getRequiredVibeTypes(
        slot,
        context
      ).length > 0
    ) {
      return (
        evidence.requiredMatches.length >
        0
      )
    }

    return (
      evidence.preferredMatches.length >
        0 ||
      evidence.requestedTokenMatches.length >=
        2
    )
  }

  return (
    evidence.requiredMatches.length >
      0 ||
    evidence.preferredMatches.length >
      0 ||
    evidence.requestedTokenMatches.length >=
      2
  )
}

function passesVibePriceEligibility({
  candidate,
  context,
  pass,
}: {
  candidate: CandidateVenue
  context: PlanningContext
  pass: SelectionPassConfig
}): boolean {
  const priceLevel =
    getCandidatePriceLevel(
      candidate
    )

  if (!priceLevel) {
    return true
  }

  const intentTokens =
    getVibeIntentTokens(
      context
    )

  const isCasual =
    hasAnyType(
      intentTokens,
      [
        "casual",
        "laid back",
        "chill",
        "low key",
        "easygoing",
        "affordable",
        "budget friendly",
        "neighborhood",
      ]
    )

  if (
    isCasual &&
    priceLevel === 4 &&
    pass.name !== "emergency"
  ) {
    return false
  }

  return true
}

function computeSelectionVibeAdjustment({
  candidate,
  slot,
  context,
  pass,
}: {
  candidate: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  pass: SelectionPassConfig
}): number {
  const evidence =
    getVibeMatchEvidence(
      candidate,
      slot,
      context
    )

  let score = 0

  if (evidence.active) {
    if (
      evidence.requiredMatches.length >
      0
    ) {
      score += 18

      if (
        evidence.requiredMatches.length >
        1
      ) {
        score += Math.min(
          (
            evidence.requiredMatches.length -
            1
          ) * 3,
          6
        )
      }
    } else if (
      getRequiredVibeTypes(
        slot,
        context
      ).length > 0
    ) {
      score -=
        pass.name === "emergency"
          ? 4
          : pass.name === "relaxed"
            ? 12
            : 18
    }

    if (
      evidence.preferredMatches.length >=
      2
    ) {
      score += 10
    } else if (
      evidence.preferredMatches.length ===
      1
    ) {
      score += 6
    }

    if (
      evidence.requestedTokenMatches.length >=
      3
    ) {
      score += 8
    } else if (
      evidence.requestedTokenMatches.length ===
      2
    ) {
      score += 5
    } else if (
      evidence.requestedTokenMatches.length ===
      1
    ) {
      score += 2
    }

    if (
      evidence.discouragedMatches.length >
      0
    ) {
      score -= Math.min(
        evidence.discouragedMatches.length *
          7,
        18
      )
    }

    if (
      evidence.stronglyDiscouragedMatches.length >
      0
    ) {
      score -= Math.min(
        evidence
          .stronglyDiscouragedMatches
          .length * 12,
        30
      )
    }

    const hasPositiveMatch =
      evidence.requiredMatches.length >
        0 ||
      evidence.preferredMatches.length >
        0 ||
      evidence.requestedTokenMatches.length >
        0

    if (!hasPositiveMatch) {
      score -=
        pass.name === "emergency"
          ? 4
          : pass.name === "relaxed"
            ? 12
            : 16
    }
  }

  /*
   * Price is scored separately from token overlap because it represents a
   * concrete experiential consequence of the selected vibe.
   */
  score += computeVibePriceAdjustment({
    candidate,
    context,
    pass,
  })

  return score
}

function computeVibePriceAdjustment({
  candidate,
  context,
  pass,
}: {
  candidate: CandidateVenue
  context: PlanningContext
  pass: SelectionPassConfig
}): number {
  const priceLevel =
    getCandidatePriceLevel(
      candidate
    )

  if (!priceLevel) {
    return 0
  }

  const intentTokens =
    getVibeIntentTokens(
      context
    )

  const isCasual =
    hasAnyType(
      intentTokens,
      [
        "casual",
        "laid back",
        "chill",
        "low key",
        "easygoing",
        "affordable",
        "budget friendly",
        "neighborhood",
      ]
    )

  if (isCasual) {
    if (priceLevel === 1) {
      return 14
    }

    if (priceLevel === 2) {
      return 9
    }

    if (priceLevel === 3) {
      return -14
    }

    return (
      pass.name === "emergency"
        ? -24
        : -42
    )
  }

  const isUpscale =
    hasAnyType(
      intentTokens,
      [
        "upscale",
        "luxury",
        "premium",
        "elegant",
        "glamorous",
        "special occasion",
        "fine dining",
        "splurge",
      ]
    )

  if (isUpscale) {
    if (priceLevel === 4) {
      return 16
    }

    if (priceLevel === 3) {
      return 11
    }

    if (priceLevel === 2) {
      return 0
    }

    return -10
  }

  const isRomantic =
    hasAnyType(
      intentTokens,
      [
        "romantic",
        "date night",
        "intimate",
        "candlelit",
        "wine",
        "cozy date",
      ]
    )

  if (isRomantic) {
    if (priceLevel === 3) {
      return 9
    }

    if (priceLevel === 4) {
      return 6
    }

    if (priceLevel === 2) {
      return 5
    }

    return -4
  }

  const isWellness =
    hasAnyType(
      intentTokens,
      [
        "wellness",
        "healthy",
        "clean",
        "restorative",
        "mindful",
        "daytime",
      ]
    )

  if (isWellness) {
    if (
      priceLevel === 1 ||
      priceLevel === 2
    ) {
      return 5
    }

    if (priceLevel === 3) {
      return -4
    }

    return -12
  }

  const isCozy =
    hasAnyType(
      intentTokens,
      [
        "cozy",
        "warm",
        "quiet",
        "comfortable",
        "relaxed",
        "low energy",
      ]
    )

  if (isCozy) {
    if (
      priceLevel === 1 ||
      priceLevel === 2
    ) {
      return 6
    }

    if (priceLevel === 3) {
      return 2
    }

    return -8
  }

  const isGroupFriendly =
    hasAnyType(
      intentTokens,
      [
        "group friendly",
        "group",
        "social",
        "communal",
        "friends",
        "crew",
      ]
    )

  if (isGroupFriendly) {
    if (
      priceLevel === 1 ||
      priceLevel === 2
    ) {
      return 4
    }

    if (priceLevel === 3) {
      return 2
    }

    return -6
  }

  /*
   * High-energy and creative presets should primarily displace venues through
   * type, tags, vibe, time, and sequence signals rather than price.
   */
  return 0
}

function isStronglyDiscouragedForSlot(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): boolean {
  const evidence =
    getVibeMatchEvidence(
      candidate,
      slot,
      context
    )

  if (!evidence.active) {
    return false
  }

  const hasPositiveMatch =
    evidence.requiredMatches.length >
      0 ||
    evidence.preferredMatches.length >
      0 ||
    evidence.requestedTokenMatches.length >=
      2

  if (
    evidence.stronglyDiscouragedMatches.length >
    0 &&
    !hasPositiveMatch
  ) {
    return true
  }

  return (
    evidence.discouragedMatches.length >=
      2 &&
    !hasPositiveMatch
  )
}

function getVibeMatchEvidence(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): VibeMatchEvidence {
  const candidateTokens =
    getNormalizedCandidateTokens(
      candidate
    )

  const requiredTypes =
    getRequiredVibeTypes(
      slot,
      context
    )

  const preferredTypes =
    getPreferredVibeTypes(
      slot,
      context
    )

  const requestedTokens =
    getRequestedVibeTokens(
      context
    )

  const discouragedTypes =
    normalizeSelectionTokens([
      ...(
        slot.vibeDiscouragedTypes ??
        []
      ),
      ...(
        context.vibePlanning
          ?.discouragedTypes ??
        []
      ),
    ])

  const stronglyDiscouragedTypes =
    normalizeSelectionTokens(
      context.vibePlanning
        ?.stronglyDiscouragedTypes ??
        []
    )

  return {
    active:
      requiredTypes.length > 0 ||
      preferredTypes.length > 0 ||
      requestedTokens.length > 0 ||
      discouragedTypes.length > 0 ||
      stronglyDiscouragedTypes.length > 0,

    requiredMatches:
      intersectNormalizedTokens(
        candidateTokens,
        requiredTypes
      ),

    preferredMatches:
      intersectNormalizedTokens(
        candidateTokens,
        preferredTypes
      ),

    requestedTokenMatches:
      intersectNormalizedTokens(
        candidateTokens,
        requestedTokens
      ),

    discouragedMatches:
      intersectNormalizedTokens(
        candidateTokens,
        discouragedTypes
      ),

    stronglyDiscouragedMatches:
      intersectNormalizedTokens(
        candidateTokens,
        stronglyDiscouragedTypes
      ),
  }
}

function getRequiredVibeTypes(
  slot: PlanningSlot,
  context: PlanningContext
): string[] {
  return normalizeSelectionTokens([
    ...(
      slot.vibeRequiredAnyTypes ??
      []
    ),
    ...(
      context.vibePlanning
        ?.requiredAnyTypes ??
      []
    ),
  ])
}

function getPreferredVibeTypes(
  slot: PlanningSlot,
  context: PlanningContext
): string[] {
  return normalizeSelectionTokens([
    ...(
      slot.vibePreferredTypes ??
      []
    ),
    ...(
      context.vibePlanning
        ?.preferredTypes ??
      []
    ),
  ])
}

function getRequestedVibeTokens(
  context: PlanningContext
): string[] {
  return normalizeSelectionTokens([
    ...context.vibeTags,
    ...(
      context.vibePlanning
        ?.expandedTokens ??
      []
    ),
  ])
}

function getVibeIntentTokens(
  context: PlanningContext
): string[] {
  return normalizeSelectionTokens([
    ...context.vibeTags,
    ...(
      context.vibePlanning
        ?.expandedTokens ??
      []
    ),
    ...(
      context.vibePlanning
        ?.matchedPresetIds ??
      []
    ),
  ])
}

function getCandidatePriceLevel(
  candidate: CandidateVenue
): number | null {
  const normalizedPrice =
    normalizePrice(
      candidate.price
    )

  if (!normalizedPrice) {
    return null
  }

  const priceLevel =
    priceToInt(
      normalizedPrice
    )

  return (
    priceLevel > 0
      ? priceLevel
      : null
  )
}

// -----------------------------------------------------------------------------
// Time-of-day safety
// -----------------------------------------------------------------------------

function hasImpossibleTimeOfDayMismatch(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  timeZone: string
): boolean {
  const tokens =
    getCandidateTokens(
      candidate
    )

  const hour =
    getHourFractionInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  const isWeekend =
    isWeekendInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  const hasBrunch =
    hasAnyType(
      tokens,
      ["brunch"]
    )

  const hasLunch =
    hasAnyType(
      tokens,
      ["lunch"]
    )

  const brunchOnly =
    hasBrunch &&
    !hasLunch

  if (brunchOnly) {
    if (!isWeekend) return true

    if (
      hour < 8 ||
      hour >= 15
    ) {
      return true
    }
  }

  if (
    hour < 10 &&
    hasAnyType(
      tokens,
      [
        "club",
        "nightclub",
        "late night",
        "speakeasy",
      ]
    )
  ) {
    return true
  }

  if (
    hour >= 21 &&
    hasAnyType(
      tokens,
      [
        "breakfast",
        "brunch",
        "library",
        "market",
        "yoga",
        "pilates",
      ]
    )
  ) {
    return true
  }

  return false
}

// -----------------------------------------------------------------------------
// Before-dinner fallback handling
// -----------------------------------------------------------------------------

function isBeforeDinnerFoodSlot({
  slot,
  timeZone,
}: {
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (
    slot.phase !== "before"
  ) {
    return false
  }

  if (
    slot.role !== "food"
  ) {
    return false
  }

  const hour =
    getHourFractionInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  return (
    hour <
    DINNER_MINIMUM_LOCAL_HOUR
  )
}

function isHybridDinnerDrinkVenue(
  candidate: CandidateVenue
): boolean {
  const types =
    normalizeVenueTypes(
      candidate.type
    )

  return (
    hasAnyType(
      types,
      [
        "restaurant",
        "dinner",
        "food",
      ]
    ) &&
    hasAnyType(
      types,
      [
        "cocktail",
        "bar",
        "wine bar",
        "lounge",
      ]
    )
  )
}

function isEarlyDinnerFallbackVenue(
  candidate: CandidateVenue
): boolean {
  const tokens =
    getCandidateTokens(
      candidate
    )

  return hasAnyType(
    tokens,
    [
      "restaurant",
      "lunch",
      "small plates",
      "wine bar",
      "cocktail",
      "cafe",
      "café",
    ]
  )
}

function hasHybridDinnerDrinkCandidate({
  rankedCandidates,
  slot,
  timeZone,
}: {
  rankedCandidates: CandidateVenue[]
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (
    !isBeforeDinnerFoodSlot({
      slot,
      timeZone,
    })
  ) {
    return false
  }

  return rankedCandidates.some(
    isHybridDinnerDrinkVenue
  )
}

function isBeforeDinnerFallbackCandidate({
  candidate,
  rankedCandidates,
  slot,
  timeZone,
}: {
  candidate: CandidateVenue
  rankedCandidates: CandidateVenue[]
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (
    !isBeforeDinnerFoodSlot({
      slot,
      timeZone,
    })
  ) {
    return false
  }

  if (
    hasHybridDinnerDrinkCandidate({
      rankedCandidates,
      slot,
      timeZone,
    })
  ) {
    return isHybridDinnerDrinkVenue(
      candidate
    )
  }

  return isEarlyDinnerFallbackVenue(
    candidate
  )
}

// -----------------------------------------------------------------------------
// Score adjustments
// -----------------------------------------------------------------------------

function computeSelectionTemporalPenalty({
  candidate,
  slot,
  timeZone,
  pass,
}: {
  candidate: CandidateVenue
  slot: PlanningSlot
  timeZone: string
  pass: SelectionPassConfig
}): number {
  const role =
    pickRoleForSlot(
      slot,
      candidate.inferredRoles
    )

  let penalty =
    computeTemporalFitPenalty(
      candidate,
      role,
      slot.targetArrivalAt,
      slot.phase,
      timeZone
    )

  if (!pass.relaxedTemporal) {
    penalty =
      Math.max(
        0,
        penalty
      )
  }

  if (
    !hasUsableVenueHours(
      candidate
    )
  ) {
    penalty +=
      pass.name === "strict"
        ? 5
        : pass.name === "balanced"
          ? 7
          : 10
  }

  return penalty
}

function computeMissingDataPenalty(
  candidate: CandidateVenue,
  pass: SelectionPassConfig
): number {
  let penalty = 0

  if (
    !candidate.name?.trim()
  ) {
    penalty += 8
  }

  if (
    normalizeVenueTypes(
      candidate.type
    ).length === 0
  ) {
    penalty += 8
  }

  if (
    normalizeStringArray(
      candidate.tags
    ).length === 0
  ) {
    penalty += 3
  }

  if (
    normalizeStringArray(
      candidate.vibe
    ).length === 0
  ) {
    penalty += 4
  }

  if (
    !hasUsableVenueHours(
      candidate
    )
  ) {
    penalty +=
      pass.name === "emergency"
        ? 4
        : 2
  }

  return penalty
}

// -----------------------------------------------------------------------------
// Venue-data helpers
// -----------------------------------------------------------------------------

function hasUsableCoreVenueData(
  candidate: CandidateVenue
): boolean {
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lon === "number" &&
    Number.isFinite(candidate.lon)
  )
}

function hasUsableVenueHours(
  candidate: CandidateVenue
): boolean {
  const hours = (
    candidate as CandidateVenue & {
      hours?: unknown
    }
  ).hours

  if (!hours) return false

  if (
    typeof hours === "string"
  ) {
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
      Object.keys(hours).length >
      0
    )
  }

  return false
}

function getCandidateTokens(
  candidate: CandidateVenue
): string[] {
  return uniqueStrings([
    ...normalizeVenueTypes(
      candidate.type
    ),
    ...normalizeStringArray(
      candidate.tags
    ),
    ...normalizeStringArray(
      candidate.vibe
    ),
    ...normalizeStringArray(
      candidate.time_category
    ),
    ...normalizeStringArray(
      candidate.name
    ),
  ])
}

function getNormalizedCandidateTokens(
  candidate: CandidateVenue
): string[] {
  return normalizeSelectionTokens(
    getCandidateTokens(
      candidate
    )
  )
}

function normalizeSelectionTokens(
  values: Array<
    string |
    number |
    null |
    undefined
  >
): string[] {
  return uniqueStrings(
    values
      .flatMap((value) => {
        if (
          value == null
        ) {
          return []
        }

        const normalized =
          String(value)
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")

        if (!normalized) {
          return []
        }

        const commaSeparated =
          normalized
            .split(/[,/|;]+/)
            .map((entry) =>
              entry.trim()
            )
            .filter(Boolean)

        return commaSeparated.flatMap(
          (entry) => {
            const individualTokens =
              entry
                .split(" ")
                .filter(
                  (token) =>
                    token.length >= 3
                )

            return [
              entry,
              ...individualTokens,
            ]
          }
        )
      })
      .filter(Boolean)
  )
}

function intersectNormalizedTokens(
  candidateTokens: string[],
  expectedTokens: string[]
): string[] {
  if (
    candidateTokens.length === 0 ||
    expectedTokens.length === 0
  ) {
    return []
  }

  const candidateSet =
    new Set(
      candidateTokens
    )

  return uniqueStrings(
    expectedTokens.filter(
      (token) =>
        candidateSet.has(token)
    )
  )
}

function getArchetypeSlotTypeHints(
  archetype: string,
  phase: SlotPhase
): string[] {
  const normalized =
    normalizeSelectionArchetype(
      archetype
    )

  if (
    normalized === "nightlife"
  ) {
    return phase === "before"
      ? [
          "restaurant",
          "dinner",
          "cocktail",
          "wine bar",
          "bar",
          "lounge",
        ]
      : [
          "bar",
          "cocktail",
          "lounge",
          "speakeasy",
          "club",
          "late night",
          "restaurant",
        ]
  }

  if (
    normalized === "music"
  ) {
    return phase === "before"
      ? [
          "restaurant",
          "food",
          "cocktail",
          "wine bar",
          "bar",
        ]
      : [
          "bar",
          "cocktail",
          "lounge",
          "late night",
          "restaurant",
          "dessert",
        ]
  }

  if (
    normalized ===
    "arts_culture"
  ) {
    return phase === "before"
      ? [
          "cafe",
          "café",
          "coffee",
          "bookstore",
          "gallery",
          "museum",
          "restaurant",
          "wine bar",
        ]
      : [
          "restaurant",
          "dinner",
          "wine bar",
          "cocktail",
          "lounge",
          "dessert",
        ]
  }

  if (
    normalized ===
    "networking"
  ) {
    return [
      "coffee",
      "cafe",
      "café",
      "restaurant",
      "wine bar",
      "cocktail",
      "lounge",
      "hotel lobby",
      "hotel bar",
      "coworking",
      "social club",
    ]
  }

  if (
    normalized ===
    "wellness"
  ) {
    return [
      "coffee",
      "tea",
      "juice",
      "smoothie",
      "healthy",
      "salad",
      "park",
      "garden",
      "cafe",
      "café",
    ]
  }

  if (
    normalized ===
    "social_sports"
  ) {
    return [
      "restaurant",
      "brunch",
      "lunch",
      "sports bar",
      "brewery",
      "bar",
      "pub",
      "patio",
      "coffee",
      "cafe",
      "café",
    ]
  }

  if (
    normalized === "market"
  ) {
    return [
      "coffee",
      "cafe",
      "café",
      "bakery",
      "breakfast",
      "brunch",
      "lunch",
      "bookstore",
      "park",
      "garden",
      "gallery",
    ]
  }

  return [
    "coffee",
    "cafe",
    "café",
    "restaurant",
    "bar",
    "dessert",
  ]
}

// -----------------------------------------------------------------------------
// Collection helpers
// -----------------------------------------------------------------------------

function unwrapSelectedVenues(
  selected: SelectedSlotVenue[] | CandidateVenue[]
): CandidateVenue[] {
  return selected.map(
    (entry) =>
      "venue" in entry
        ? entry.venue
        : entry
  )
}

function unwrapSelectedSlotVenues(
  selected: SelectedSlotVenue[] | CandidateVenue[]
): SelectedSlotVenue[] {
  return selected.filter(
    (
      entry
    ): entry is SelectedSlotVenue =>
      typeof entry === "object" &&
      entry != null &&
      "venue" in entry &&
      "slot" in entry
  )
}

function compareRankedCandidates(
  a: RankedCandidateForPass,
  b: RankedCandidateForPass
): number {
  const scoreDelta =
    b.score -
    a.score

  if (
    Math.abs(scoreDelta) >
    0.001
  ) {
    return scoreDelta
  }

  const aDistance =
    a.venue.distanceMeters ??
    Number.POSITIVE_INFINITY

  const bDistance =
    b.venue.distanceMeters ??
    Number.POSITIVE_INFINITY

  const distanceDelta =
    aDistance -
    bDistance

  if (
    Math.abs(distanceDelta) >
    1
  ) {
    return distanceDelta
  }

  return a.venue.id.localeCompare(
    b.venue.id
  )
}

// -----------------------------------------------------------------------------
// Diagnostics helpers
// -----------------------------------------------------------------------------

function emptyRejectionCounts(): RejectionCounts {
  return {
    used: 0,
    role: 0,
    geometry: 0,
    temporal: 0,
    type_time: 0,
    hours: 0,
    missing_data: 0,
    vibe_required: 0,
    vibe_discouraged: 0,
  }
}

function incrementRejectionCount(
  counts: RejectionCounts,
  reason?: CandidateEvaluation["reason"]
): void {
  if (!reason) return

  counts[reason] += 1
}

function mergeRejectionCounts(
  a: RejectionCounts,
  b: RejectionCounts
): RejectionCounts {
  return {
    used:
      a.used +
      b.used,

    role:
      a.role +
      b.role,

    geometry:
      a.geometry +
      b.geometry,

    temporal:
      a.temporal +
      b.temporal,

    type_time:
      a.type_time +
      b.type_time,

    hours:
      a.hours +
      b.hours,

    missing_data:
      a.missing_data +
      b.missing_data,

    vibe_required:
      a.vibe_required +
      b.vibe_required,

    vibe_discouraged:
      a.vibe_discouraged +
      b.vibe_discouraged,
  }
}

// -----------------------------------------------------------------------------
// General helpers
// -----------------------------------------------------------------------------

function isWeekendInTimeZone(
  date: Date,
  timeZone: string
): boolean {
  const weekday =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        weekday: "short",
      }
    ).format(date)

  return (
    weekday === "Sat" ||
    weekday === "Sun"
  )
}

function normalizeSelectionArchetype(
  archetype: string | null | undefined
): string {
  if (
    archetype === "art"
  ) {
    return "arts_culture"
  }

  if (
    archetype === "sports"
  ) {
    return "social_sports"
  }

  if (
    archetype === "festival"
  ) {
    return "market"
  }

  if (
    archetype === "general"
  ) {
    return "other"
  }

  return (
    archetype ??
    "other"
  )
}

// -----------------------------------------------------------------------------
// Late-night diagnostics
// -----------------------------------------------------------------------------

function logLateNightTemporalRejection({
  candidate,
  slot,
  context,
  timeZone,
  relaxed,
  role,
  lateNightEligibleOverall,
}: {
  candidate: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  timeZone: string
  relaxed: boolean
  role: StopRole
  lateNightEligibleOverall: boolean
}): void {
  const rawHours = (
    candidate as CandidateVenue & {
      hours?: unknown
    }
  ).hours

  const passesTwoAm =
    rawHours != null
      ? isVenueOpenUntilAtLeastTwoAm(
          candidate as CandidateVenue &
            VenueWithHours,
          slot.targetArrivalAt,
          timeZone
        )
      : false

  console.log(
    "LATE_NIGHT_AFTER_HOURS_REJECTION",
    JSON.stringify(
      {
        venueId:
          candidate.id,

        venueName:
          candidate.name ??
          null,

        venueType:
          candidate.type ??
          null,

        inferredRoles:
          candidate.inferredRoles,

        chosenRole:
          role,

        slotIndex:
          slot.index,

        slotPhase:
          slot.phase,

        mode:
          context.mode,

        relaxed,

        arrival:
          slot.targetArrivalAt.toISOString(),

        departure:
          slot.targetDepartureAt.toISOString(),

        timeZone,

        lateNightEligibleOverall,

        passesTwoAm,

        rawHours,
      },
      null,
      2
    )
  )
}