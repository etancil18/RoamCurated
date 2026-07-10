// lib/outings/sequenceScoring/bias.ts

import type {
  Budget,
  Mobility,
  PlanningContext,
  PlanningSlot,
  SelectionPass,
  StopRole,
  VenueRecord,
} from "../types"

import {
  getDiscouragedTypesForGroupSize,
  getPreferredTypesForGroupSize,
} from "../groupSizePresets"

import {
  normalizePrice,
  normalizeVenueTypes,
  priceToInt,
} from "./helpers"

import {
  computeCandidateScore,
  type CandidateScoreResult,
  type CandidateScoreVenue,
} from "./candidateScore"

import {
  getDistanceBetweenVenues,
  getMaxAfterInterstopMeters,
  getMaxAfterLocalFallbackMeters,
  isAfterSequenceDirectionallyConsistent,
} from "./geometry"

// -----------------------------------------------------------------------------
// Compatibility types
// -----------------------------------------------------------------------------

type CandidateVenueLike = VenueRecord & {
  inferredRoles: StopRole[]
  distanceMeters: number | null
  score: number
}

export type SequentialCandidateScoreResult = {
  score: number
  result: CandidateScoreResult
}

// -----------------------------------------------------------------------------
// Canonical sequential scoring entry point
// -----------------------------------------------------------------------------

/**
 * Canonical sequential candidate score.
 *
 * All semantic, archetype, vibe, time, geometry, and sequence scoring is
 * composed inside candidateScore.ts.
 *
 * Do not append legacy archetype, vibe, temporal, geometry, or sequence
 * bonuses after calling this function.
 */
export function computeSequentialCandidateScore<
  TCandidate extends CandidateVenueLike
>(
  candidate: TCandidate,
  selectedSoFar: TCandidate[],
  slot: PlanningSlot,
  context: PlanningContext,
  selectedPass: SelectionPass | null = null
): number {
  return computeSequentialCandidateScoreResult(
    candidate,
    selectedSoFar,
    slot,
    context,
    selectedPass
  ).score
}

/**
 * Diagnostic variant of computeSequentialCandidateScore.
 *
 * Use this when selection diagnostics or persisted metadata need the complete
 * scoring breakdown.
 */
export function computeSequentialCandidateScoreResult<
  TCandidate extends CandidateVenueLike
>(
  candidate: TCandidate,
  selectedSoFar: TCandidate[],
  slot: PlanningSlot,
  context: PlanningContext,
  selectedPass: SelectionPass | null = null
): SequentialCandidateScoreResult {
  const previousVenue =
    selectedSoFar[selectedSoFar.length - 1] ?? null

  const result = computeCandidateScore({
    venue: toCandidateScoreVenue(candidate),
    context,
    slot,
    selectedSoFar: selectedSoFar.map(toCandidateScoreVenue),
    previousVenue: previousVenue
      ? toCandidateScoreVenue(previousVenue)
      : null,
    sourceScore: candidate.score,
    selectedPass,
  })

  return {
    score: result.score,
    result,
  }
}

// -----------------------------------------------------------------------------
// Distance compatibility helpers
// -----------------------------------------------------------------------------

/**
 * Legacy helper retained for compatibility.
 *
 * This must not be added after computeSequentialCandidateScore because geometry
 * is already represented by geometryFit.ts.
 */
export function computeBeforeFirstStopDistanceBonus(
  anchorDistance: number | null,
  mobility: Mobility
): number {
  if (anchorDistance == null) return 0

  if (mobility === "walk") {
    if (anchorDistance >= 250 && anchorDistance <= 1000) return 18
    if (anchorDistance <= 1400) return 8
    return -30
  }

  if (mobility === "short_ride") {
    if (anchorDistance >= 400 && anchorDistance <= 1800) return 20
    if (anchorDistance <= 2600) return 8
    return -24
  }

  if (anchorDistance <= 2800) return 12
  if (anchorDistance <= 4000) return 4

  return -16
}

/**
 * Legacy helper retained for compatibility.
 *
 * Sequence direction and movement coherence are now composed by
 * sequenceFit.ts and geometryFit.ts.
 */
export function computeBeforeProgressionBonus(
  anchorDistance: number | null,
  previousAnchorDistance: number | null,
  previousToCandidateDistance: number | null
): number {
  if (
    anchorDistance == null ||
    previousAnchorDistance == null
  ) {
    return 0
  }

  let score = 0

  if (anchorDistance < previousAnchorDistance - 200) {
    score += 24
  } else if (anchorDistance <= previousAnchorDistance + 100) {
    score += 6
  } else {
    score -= 26
  }

  if (previousToCandidateDistance != null) {
    if (previousToCandidateDistance < 1000) {
      score += 8
    } else if (previousToCandidateDistance < 2000) {
      score += 3
    } else if (previousToCandidateDistance > 3200) {
      score -= 14
    }
  }

  return score
}

/**
 * Legacy consumption progression helper retained for compatibility.
 *
 * The canonical candidate path evaluates this inside sequenceFit.ts.
 */
export function computeBeforeConsumptionProgressionScore<
  TCandidate extends Pick<VenueRecord, "type">
>(
  previous: TCandidate | null,
  candidate: TCandidate
): number {
  if (!previous) return 0

  const previousTypes = normalizeVenueTypes(previous.type)
  const candidateTypes = normalizeVenueTypes(candidate.type)

  const previousIsCoffeeLike = hasAnyNormalizedType(
    previousTypes,
    [
      "coffee",
      "cafe",
      "café",
      "tea",
      "bakery",
      "breakfast",
    ]
  )

  const previousIsMealLike = hasAnyNormalizedType(
    previousTypes,
    [
      "restaurant",
      "food",
      "lunch",
      "brunch",
      "dinner",
      "breakfast",
    ]
  )

  const candidateIsCoffeeLike = hasAnyNormalizedType(
    candidateTypes,
    [
      "coffee",
      "cafe",
      "café",
      "tea",
      "bakery",
      "breakfast",
    ]
  )

  const candidateIsMealLike = hasAnyNormalizedType(
    candidateTypes,
    [
      "restaurant",
      "food",
      "lunch",
      "brunch",
      "dinner",
      "breakfast",
    ]
  )

  let score = 0

  if (previousIsCoffeeLike && candidateIsMealLike) {
    score += 10
  }

  if (previousIsCoffeeLike && candidateIsCoffeeLike) {
    score -= 18
  }

  if (previousIsMealLike && candidateIsCoffeeLike) {
    score -= 22
  }

  return score
}

/**
 * Legacy helper retained for compatibility.
 *
 * Immediate post-event geometry is already evaluated by geometryFit.ts in the
 * canonical scoring path.
 */
export function computeAfterFirstStopDistanceBonus(
  anchorDistance: number | null,
  mobility: Mobility
): number {
  if (anchorDistance == null) return 0

  if (mobility === "walk") {
    if (anchorDistance < 700) return 26
    if (anchorDistance < 1200) return 16
    if (anchorDistance < 1800) return 4
    return -28
  }

  if (mobility === "short_ride") {
    if (anchorDistance < 1200) return 24
    if (anchorDistance < 2200) return 14
    if (anchorDistance < 3200) return 4
    return -24
  }

  if (anchorDistance < 1800) return 18
  if (anchorDistance < 3000) return 8
  if (anchorDistance < 4500) return 2

  return -14
}

/**
 * Legacy helper retained for compatibility.
 */
export function computeAfterExpansionBonus(
  previousToCandidateDistance: number | null,
  anchorDistance: number | null,
  mobility: Mobility,
  context?: PlanningContext
): number {
  let score = 0

  if (previousToCandidateDistance != null) {
    const strictMax = getMaxAfterInterstopMeters(
      mobility,
      false,
      context
    )

    if (previousToCandidateDistance <= strictMax * 0.5) {
      score += 12
    } else if (
      previousToCandidateDistance <= strictMax * 0.8
    ) {
      score += 6
    } else if (previousToCandidateDistance > strictMax) {
      score -= 30
    }
  }

  if (
    anchorDistance != null &&
    anchorDistance > 6000
  ) {
    score -= 10
  }

  return score
}

/**
 * Legacy helper retained for compatibility.
 */
export function computeAfterDirectionalConsistencyBonus<
  TCandidate extends VenueRecord & {
    distanceMeters?: number | null
  }
>(
  selectedSoFar: TCandidate[],
  candidate: TCandidate,
  context: PlanningContext,
  slot: PlanningSlot,
  previousToCandidateDistance: number | null
): number {
  const maxLocalFallbackMeters =
    getMaxAfterLocalFallbackMeters(
      context.mobility,
      context
    )

  const previous =
    selectedSoFar[selectedSoFar.length - 1] ?? null

  if (
    previousToCandidateDistance != null &&
    previousToCandidateDistance <= maxLocalFallbackMeters
  ) {
    if (
      previous?.distanceMeters != null &&
      candidate.distanceMeters != null &&
      candidate.distanceMeters + 250 <
        previous.distanceMeters
    ) {
      return -8
    }

    return 8
  }

  if (
    isAfterSequenceDirectionallyConsistent(
      selectedSoFar,
      candidate,
      context,
      slot
    )
  ) {
    return 12
  }

  return -24
}

// -----------------------------------------------------------------------------
// Legacy aggregate-scoring compatibility exports
// -----------------------------------------------------------------------------

/**
 * Canonical sequence coherence now lives in sequenceFit.ts.
 *
 * Returning zero prevents old callers from double-counting sequence fit after
 * computeSequentialCandidateScore.
 */
export function computeVenueSequenceCoherenceScore(
  _previous: Pick<
    VenueRecord,
    "type" | "tags" | "vibe"
  > | null,
  _candidate: Pick<
    VenueRecord,
    "type" | "tags" | "vibe"
  >,
  _slot: PlanningSlot,
  _context: PlanningContext
): number {
  return 0
}

/**
 * Canonical time and phase compatibility now lives in timeFit.ts.
 */
export function computeModeSpecificVenueBias(
  _candidate: Pick<VenueRecord, "type">,
  _slot: PlanningSlot,
  _context: PlanningContext
): number {
  return 0
}

/**
 * Canonical phase-aware semantic preference now lives in semanticFit.ts.
 */
export function computePhaseAwarePreferenceBias(
  _candidate: Pick<
    VenueRecord,
    "type" | "tags" | "vibe"
  >,
  _slot: PlanningSlot,
  _context: PlanningContext
): number {
  return 0
}

/**
 * Canonical archetype scoring now lives in archetypeFit.ts.
 *
 * This compatibility export intentionally returns zero so legacy ranking code
 * cannot append archetype scoring twice.
 */
export function scoreArchetypeFit(
  _venue: Pick<
    VenueRecord,
    "type" | "vibe" | "tags"
  >,
  _context: PlanningContext,
  _slot?: PlanningSlot
): number {
  return 0
}

/**
 * Canonical vibe scoring now lives in vibeFit.ts.
 *
 * This compatibility export intentionally returns zero so legacy ranking code
 * cannot append vibe scoring twice.
 */
export function scoreVibeFit(
  _venue: Pick<
    VenueRecord,
    "tags" | "vibe" | "type"
  >,
  _vibeTags: string[],
  _context?: PlanningContext
): number {
  return 0
}

// -----------------------------------------------------------------------------
// Base-score compatibility helpers
// -----------------------------------------------------------------------------

/**
 * Lightweight base distance score retained for candidate preparation.
 *
 * candidateScore.ts caps the contribution of an upstream source score, so this
 * cannot overpower semantic, vibe, archetype, or temporal fit.
 */
export function scoreDistanceFromAnchor(
  distanceMeters: number | null,
  mobility: Mobility
): number {
  if (distanceMeters == null) return 0

  if (mobility === "walk") {
    if (distanceMeters < 800) return 24
    if (distanceMeters < 1400) return 12
    return -18
  }

  if (mobility === "short_ride") {
    if (distanceMeters < 1800) return 20
    if (distanceMeters < 3200) return 10
    return -14
  }

  if (distanceMeters < 5000) return 10
  if (distanceMeters < 8000) return 2

  return -10
}

/**
 * Budget remains a constraint-level base signal rather than a contextual
 * semantic signal.
 */
export function scoreBudgetFit(
  value: string | number | null | undefined,
  budget: Budget | null
): number {
  if (!budget) return 0

  const priceString = normalizePrice(value)
  if (!priceString) return 0

  const venuePrice = priceToInt(priceString)
  const selectedBudget = priceToInt(budget)

  if (!venuePrice || !selectedBudget) return 0

  if (budget === "$$$$") {
    if (
      venuePrice >= 2 &&
      venuePrice <= 4
    ) {
      if (venuePrice === 4) return 16
      if (venuePrice === 3) return 12
      return 8
    }

    return -40
  }

  if (venuePrice <= selectedBudget) {
    const difference =
      selectedBudget - venuePrice

    if (difference === 0) return 16
    if (difference === 1) return 10
    if (difference === 2) return 4

    return 0
  }

  return -40
}

/**
 * Group-size suitability remains a lightweight base signal.
 */
export function scoreGroupFit(
  venue: Pick<VenueRecord, "type">,
  groupSize: number | null
): number {
  if (!groupSize) return 0

  const preferredTypes =
    getPreferredTypesForGroupSize(groupSize)

  const discouragedTypes =
    getDiscouragedTypesForGroupSize(groupSize)

  const venueTypes =
    normalizeVenueTypes(venue.type)

  let score = 0

  if (preferredTypes.length > 0) {
    score += preferredTypes.filter((type) =>
      venueTypes.includes(type)
    ).length * 10
  }

  if (discouragedTypes.length > 0) {
    score -= discouragedTypes.filter((type) =>
      venueTypes.includes(type)
    ).length * 12
  }

  if (groupSize >= 6) {
    if (
      hasAnyNormalizedType(
        venueTypes,
        [
          "speakeasy",
          "cocktail",
          "coffee",
          "bakery",
        ]
      )
    ) {
      score -= 8
    }

    if (
      hasAnyNormalizedType(
        venueTypes,
        [
          "brewery",
          "restaurant",
          "bar",
          "sports bar",
          "rooftop",
        ]
      )
    ) {
      score += 8
    }
  }

  if (groupSize <= 2) {
    if (
      hasAnyNormalizedType(
        venueTypes,
        [
          "speakeasy",
          "cocktail",
          "wine bar",
          "gallery",
        ]
      )
    ) {
      score += 6
    }

    if (
      hasAnyNormalizedType(
        venueTypes,
        [
          "sports bar",
          "brewery",
        ]
      )
    ) {
      score -= 4
    }
  }

  return score
}

// -----------------------------------------------------------------------------
// Diagnostics and adapters
// -----------------------------------------------------------------------------

/**
 * Returns the complete canonical score breakdown without changing the
 * candidate.
 */
export function getSequentialCandidateDiagnostics<
  TCandidate extends CandidateVenueLike
>(
  candidate: TCandidate,
  selectedSoFar: TCandidate[],
  slot: PlanningSlot,
  context: PlanningContext,
  selectedPass: SelectionPass | null = null
): CandidateScoreResult {
  return computeSequentialCandidateScoreResult(
    candidate,
    selectedSoFar,
    slot,
    context,
    selectedPass
  ).result
}

/**
 * Convenience helper for callers that need previous-to-candidate distance but
 * do not want to depend directly on geometry.ts.
 */
export function getSequentialCandidateDistance(
  previous: Pick<
    VenueRecord,
    "lat" | "lon"
  > | null,
  candidate: Pick<
    VenueRecord,
    "lat" | "lon"
  >
): number | null {
  if (!previous) return null

  return getDistanceBetweenVenues(
    previous,
    candidate
  )
}

function toCandidateScoreVenue<
  TCandidate extends CandidateVenueLike
>(
  candidate: TCandidate
): CandidateScoreVenue {
  const candidateWithOptionalFields =
    candidate as TCandidate & {
      assignedRole?: StopRole | null
      slotRole?: StopRole | null
      phase?: "before" | "after" | null
      slotPhase?: "before" | "after" | null
      slotIndex?: number | null
      energy_ramp?: string | number | null
    }

  return {
    ...candidate,
    inferredRoles: candidate.inferredRoles,
    distanceMeters: candidate.distanceMeters,
    score: candidate.score,
    assignedRole:
      candidateWithOptionalFields.assignedRole ?? null,
    slotRole:
      candidateWithOptionalFields.slotRole ?? null,
    phase:
      candidateWithOptionalFields.phase ?? null,
    slotPhase:
      candidateWithOptionalFields.slotPhase ?? null,
    slotIndex:
      candidateWithOptionalFields.slotIndex ?? null,
    energy_ramp:
      candidateWithOptionalFields.energy_ramp ?? null,
  }
}

function hasAnyNormalizedType(
  venueTypes: string[],
  expectedTypes: string[]
): boolean {
  if (
    venueTypes.length === 0 ||
    expectedTypes.length === 0
  ) {
    return false
  }

  const expectedSet =
    new Set(expectedTypes)

  return venueTypes.some((type) =>
    expectedSet.has(type)
  )
}