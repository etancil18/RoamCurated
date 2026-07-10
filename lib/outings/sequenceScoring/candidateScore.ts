// lib/outings/sequenceScoring/candidateScore.ts

import type {
  PlanningContext,
  PlanningSlot,
  SelectionPass,
  StopRole,
  VenueRecord,
} from "../types"

import type { CandidateVenue } from "./types"

import {
  computeSemanticFit,
  type SemanticFitResult,
} from "./semanticFit"

import {
  computeArchetypeFit,
  type ArchetypeFitResult,
} from "./archetypeFit"

import {
  computeVibeFit,
  type VibeFitResult,
} from "./vibeFit"

import {
  computeTimeFit,
  type TimeFitResult,
} from "./timeFit"

import {
  computeGeometryFit,
  type GeometryFitResult,
} from "./geometryFit"

import {
  computeSequenceFit,
  type SequenceFitResult,
  type SequenceVenueLike,
} from "./sequenceFit"

import {
  getDistanceBetweenVenues,
} from "./geometry"

import {
  normalizeVenueTypes,
} from "./helpers"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type CandidateScoreConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type CandidateScoreVenue = VenueRecord & {
  inferredRoles?: StopRole[]
  distanceMeters?: number | null
  score?: number | null

  assignedRole?: StopRole | null
  slotRole?: StopRole | null
  phase?: "before" | "after" | null
  slotPhase?: "before" | "after" | null
  slotIndex?: number | null

  /*
   * This field currently has incomplete coverage.
   * It is intentionally used only as weak supporting evidence.
   */
  energy_ramp?: string | number | null
}

export type CandidateScoreWeights = {
  semantic: number
  archetype: number
  vibe: number
  time: number
  geometry: number
  sequence: number
}

export type CandidateScoreBreakdown = {
  semantic: number
  archetype: number
  vibe: number
  time: number
  geometry: number
  sequence: number

  dataQualityAdjustment: number
  sourceScoreAdjustment: number
  softConflictPenalty: number
  hardConflictPenalty: number

  totalBeforeClamp: number
  total: number
}

export type CandidateScoreEvidence = {
  venueId: string
  venueName: string | null

  slotIndex: number
  slotRole: StopRole
  slotPhase: "before" | "after"

  selectedVenueCount: number
  previousVenueId: string | null

  hasTypeData: boolean
  hasTagData: boolean
  hasVibeData: boolean
  hasTimeCategoryData: boolean
  hasCoordinateData: boolean
  hasHoursData: boolean
  hasEnergyRampData: boolean

  hardConflictReasons: string[]
  softConflictReasons: string[]

  sourceScoreUsed: number
  selectedPass: SelectionPass | null
}

export type CandidateScoreResult = {
  score: number
  confidence: CandidateScoreConfidence
  confidenceScore: number

  eligible: boolean
  isStrongCandidate: boolean
  isWeakCandidate: boolean
  isHardConflict: boolean

  selectedPass: SelectionPass | null

  breakdown: CandidateScoreBreakdown
  evidence: CandidateScoreEvidence

  fits: {
    semantic: SemanticFitResult
    archetype: ArchetypeFitResult
    vibe: VibeFitResult
    time: TimeFitResult
    geometry: GeometryFitResult
    sequence: SequenceFitResult
  }
}

export type ComputeCandidateScoreInput = {
  venue: CandidateScoreVenue
  context: PlanningContext
  slot: PlanningSlot

  selectedSoFar?: CandidateScoreVenue[]
  previousVenue?: CandidateScoreVenue | null

  /**
   * Optional legacy or upstream score.
   *
   * This is deliberately capped so an old score cannot overwhelm the new
   * semantic-first scoring system.
   */
  sourceScore?: number | null

  /**
   * Selection pass may relax soft thresholds, but must never bypass true hard
   * conflicts such as duplicate venues or impossible temporal availability.
   */
  selectedPass?: SelectionPass | null

  weights?: Partial<CandidateScoreWeights>
}

export type RankCandidatesForSlotInput = {
  venues: CandidateScoreVenue[]
  context: PlanningContext
  slot: PlanningSlot
  selectedSoFar?: CandidateScoreVenue[]
  previousVenue?: CandidateScoreVenue | null
  selectedPass?: SelectionPass | null
  weights?: Partial<CandidateScoreWeights>
}

export type RankedCandidateScore = {
  venue: CandidateScoreVenue
  result: CandidateScoreResult
}

export type RankVenueCandidatesInput = {
  venues: VenueRecord[]
  context: PlanningContext
}

// -----------------------------------------------------------------------------
// Score policy
// -----------------------------------------------------------------------------

/**
 * Semantic compatibility is the highest-value signal.
 *
 * Archetype and vibe provide contextual meaning.
 * Time and geometry verify feasibility.
 * Sequence evaluates whether the venue works with already selected stops.
 */
export const DEFAULT_CANDIDATE_SCORE_WEIGHTS: CandidateScoreWeights = {
  semantic: 1.3,
  archetype: 1.05,
  vibe: 1.15,
  time: 1,
  geometry: 0.8,
  sequence: 0.75,
}

const MIN_CANDIDATE_SCORE = -120
const MAX_CANDIDATE_SCORE = 140

const HARD_CONFLICT_PENALTY = 100
const MAX_SOURCE_SCORE_CONTRIBUTION = 8

const STRONG_CANDIDATE_SCORE = 36
const WEAK_CANDIDATE_SCORE = -10

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeCandidateScore({
  venue,
  context,
  slot,
  selectedSoFar = [],
  previousVenue: explicitPreviousVenue,
  sourceScore,
  selectedPass = null,
  weights: weightOverrides,
}: ComputeCandidateScoreInput): CandidateScoreResult {
  const previousVenue =
    explicitPreviousVenue ??
    selectedSoFar[selectedSoFar.length - 1] ??
    null

  const weights: CandidateScoreWeights = {
    ...DEFAULT_CANDIDATE_SCORE_WEIGHTS,
    ...(weightOverrides ?? {}),
  }

  const semantic = computeSemanticFit({
    venue,
    context,
    slot,
  })

  const archetype = computeArchetypeFit({
    venue,
    context,
    slot,
  })

  const vibe = computeVibeFit({
    venue,
    context,
    slot,
  })

  const time = computeTimeFit({
    venue,
    context,
    slot,
  })

  const geometry = computeGeometryFit({
    venue,
    context,
    slot,
    previousVenue,
    selectedSoFar,
  })

  const sequence = computeSequenceFit({
    venue: toSequenceVenue(venue),
    context,
    slot,
    selectedSoFar: selectedSoFar.map(toSequenceVenue),
    previousVenue: previousVenue
      ? toSequenceVenue(previousVenue)
      : null,
  })

  const hardConflictReasons = collectHardConflictReasons({
    semantic,
    archetype,
    vibe,
    time,
    geometry,
    sequence,
  })

  const softConflictReasons = collectSoftConflictReasons({
    semantic,
    archetype,
    vibe,
    time,
    geometry,
    sequence,
  })

  const isHardConflict = hardConflictReasons.length > 0

  const semanticScore = weightedScore(
    semantic.score,
    weights.semantic
  )

  const archetypeScore = weightedScore(
    archetype.score,
    weights.archetype
  )

  const vibeScore = weightedScore(
    vibe.score,
    weights.vibe
  )

  const timeScore = weightedScore(
    time.score,
    weights.time
  )

  const geometryScore = weightedScore(
    geometry.score,
    weights.geometry
  )

  const sequenceScore = weightedScore(
    sequence.score,
    weights.sequence
  )

  const dataQualityAdjustment =
    computeDataQualityAdjustment(venue)

  const resolvedSourceScore =
    sourceScore ??
    venue.score ??
    0

  const sourceScoreAdjustment = clamp(
    finiteNumber(resolvedSourceScore),
    -MAX_SOURCE_SCORE_CONTRIBUTION,
    MAX_SOURCE_SCORE_CONTRIBUTION
  )

  const softConflictPenalty = computeSoftConflictPenalty({
    count: softConflictReasons.length,
    selectedPass,
  })

  const hardConflictPenalty = isHardConflict
    ? -HARD_CONFLICT_PENALTY
    : 0

  const totalBeforeClamp =
    semanticScore +
    archetypeScore +
    vibeScore +
    timeScore +
    geometryScore +
    sequenceScore +
    dataQualityAdjustment +
    sourceScoreAdjustment +
    softConflictPenalty +
    hardConflictPenalty

  const score = clamp(
    Math.round(totalBeforeClamp),
    MIN_CANDIDATE_SCORE,
    MAX_CANDIDATE_SCORE
  )

  const confidenceScore = computeCandidateConfidence({
    venue,
    semantic,
    archetype,
    vibe,
    time,
    geometry,
    sequence,
  })

  const confidence =
    resolveCandidateConfidence(confidenceScore)

  const eligible =
    !isHardConflict &&
    passesMinimumScoreForPass(
      score,
      selectedPass
    )

  return {
    score,
    confidence,
    confidenceScore,

    eligible,

    isStrongCandidate:
      eligible &&
      score >= STRONG_CANDIDATE_SCORE &&
      confidenceScore >= 0.6,

    isWeakCandidate:
      !eligible ||
      score <= WEAK_CANDIDATE_SCORE ||
      confidenceScore < 0.35,

    isHardConflict,
    selectedPass,

    breakdown: {
      semantic: semanticScore,
      archetype: archetypeScore,
      vibe: vibeScore,
      time: timeScore,
      geometry: geometryScore,
      sequence: sequenceScore,

      dataQualityAdjustment,
      sourceScoreAdjustment,
      softConflictPenalty,
      hardConflictPenalty,

      totalBeforeClamp,
      total: score,
    },

    evidence: {
      venueId: venue.id,
      venueName: venue.name ?? null,

      slotIndex: slot.index,
      slotRole: slot.role,
      slotPhase: slot.phase,

      selectedVenueCount: selectedSoFar.length,
      previousVenueId: previousVenue?.id ?? null,

      hasTypeData: hasValues(venue.type),
      hasTagData: hasValues(venue.tags),
      hasVibeData: hasValues(venue.vibe),
      hasTimeCategoryData:
        hasValues(venue.time_category),

      hasCoordinateData:
        isFiniteNumber(venue.lat) &&
        isFiniteNumber(venue.lon),

      hasHoursData:
        hasUsableHours(venue.hours),

      hasEnergyRampData:
        hasEnergyRamp(venue.energy_ramp),

      hardConflictReasons,
      softConflictReasons,

      sourceScoreUsed: sourceScoreAdjustment,
      selectedPass,
    },

    fits: {
      semantic,
      archetype,
      vibe,
      time,
      geometry,
      sequence,
    },
  }
}

/**
 * Numeric convenience wrapper for selection and sorting.
 */
export function scoreCandidateForSlot(
  venue: CandidateScoreVenue,
  context: PlanningContext,
  slot: PlanningSlot,
  selectedSoFar: CandidateScoreVenue[] = [],
  previousVenue?: CandidateScoreVenue | null,
  selectedPass?: SelectionPass | null
): number {
  return computeCandidateScore({
    venue,
    context,
    slot,
    selectedSoFar,
    previousVenue,
    selectedPass,
  }).score
}

/**
 * Scores and sorts a candidate pool for one planning slot.
 *
 * Ineligible candidates are retained at the bottom for diagnostics. Consumers
 * that need only usable venues can filter by result.eligible.
 */
export function rankCandidatesForSlot({
  venues,
  context,
  slot,
  selectedSoFar = [],
  previousVenue,
  selectedPass = null,
  weights,
}: RankCandidatesForSlotInput): RankedCandidateScore[] {
  return venues
    .map((venue) => ({
      venue,
      result: computeCandidateScore({
        venue,
        context,
        slot,
        selectedSoFar,
        previousVenue,
        sourceScore: venue.score,
        selectedPass,
        weights,
      }),
    }))
    .sort(compareRankedCandidates)
}

/**
 * Returns only candidates that remain eligible for the requested pass.
 */
export function getEligibleCandidatesForSlot(
  input: RankCandidatesForSlotInput
): RankedCandidateScore[] {
  return rankCandidatesForSlot(input).filter(
    ({ result }) => result.eligible
  )
}

/**
 * Prepares and ranks the raw venue pool before slot-aware selection begins.
 *
 * This function intentionally does not perform final semantic, archetype,
 * vibe, time, geometry, or sequence scoring. Those signals depend on the
 * planning slot and previously selected venues and remain inside
 * computeCandidateScore().
 */
export function rankVenueCandidates(
  venues: VenueRecord[],
  context: PlanningContext
): CandidateVenue[] {
  return venues
    .map((venue): CandidateVenue => {
      const distanceMeters =
        context.anchorVenue != null
          ? getDistanceBetweenVenues(
              context.anchorVenue,
              venue
            )
          : null

      const inferredRoles =
        inferPreparationRolesForVenue(venue)

      return {
        ...venue,
        inferredRoles,
        distanceMeters,
        score: computeCandidatePreparationScore({
          venue,
          inferredRoles,
          distanceMeters,
          context,
        }),
      }
    })
    .sort(comparePreparedCandidates)
}

/**
 * Object-argument compatibility wrapper for callers that prefer a named
 * parameter contract.
 */
export function rankVenueCandidatesFromInput({
  venues,
  context,
}: RankVenueCandidatesInput): CandidateVenue[] {
  return rankVenueCandidates(
    venues,
    context
  )
}

/**
 * Maps the result back into the existing CandidateVenue shape.
 */
export function applyCandidateScore<
  TVenue extends CandidateScoreVenue
>(
  venue: TVenue,
  result: CandidateScoreResult
): TVenue & CandidateVenue {
  return {
    ...venue,

    inferredRoles:
      normalizeRoles(venue.inferredRoles),

    distanceMeters:
      typeof venue.distanceMeters === "number" &&
      Number.isFinite(venue.distanceMeters)
        ? venue.distanceMeters
        : null,

    score: result.score,
  }
}

/**
 * Metadata suitable for diagnostics or persisted planner metadata.
 */
export function getCandidateScoreMetadata(
  result: CandidateScoreResult
): {
  candidateScore: number
  candidateEligible: boolean
  candidateConfidence: number
  candidateConfidenceLabel: CandidateScoreConfidence
  candidateStrongFit: boolean
  candidateWeakFit: boolean
  candidateHardConflict: boolean
  selectedPass: SelectionPass | null

  semanticScore: number
  archetypeScore: number
  vibeScore: number
  timeScore: number
  geometryScore: number
  sequenceScore: number

  hardConflictReasons: string[]
  softConflictReasons: string[]

  candidateScoreBreakdown: CandidateScoreBreakdown
} {
  return {
    candidateScore: result.score,
    candidateEligible: result.eligible,
    candidateConfidence: result.confidenceScore,
    candidateConfidenceLabel: result.confidence,
    candidateStrongFit: result.isStrongCandidate,
    candidateWeakFit: result.isWeakCandidate,
    candidateHardConflict: result.isHardConflict,
    selectedPass: result.selectedPass,

    semanticScore:
      result.breakdown.semantic,

    archetypeScore:
      result.breakdown.archetype,

    vibeScore:
      result.breakdown.vibe,

    timeScore:
      result.breakdown.time,

    geometryScore:
      result.breakdown.geometry,

    sequenceScore:
      result.breakdown.sequence,

    hardConflictReasons:
      result.evidence.hardConflictReasons,

    softConflictReasons:
      result.evidence.softConflictReasons,

    candidateScoreBreakdown:
      result.breakdown,
  }
}

// -----------------------------------------------------------------------------
// Ranking policy
// -----------------------------------------------------------------------------

function compareRankedCandidates(
  first: RankedCandidateScore,
  second: RankedCandidateScore
): number {
  if (
    first.result.eligible !==
    second.result.eligible
  ) {
    return first.result.eligible
      ? -1
      : 1
  }

  if (
    first.result.score !==
    second.result.score
  ) {
    return (
      second.result.score -
      first.result.score
    )
  }

  if (
    first.result.confidenceScore !==
    second.result.confidenceScore
  ) {
    return (
      second.result.confidenceScore -
      first.result.confidenceScore
    )
  }

  /*
   * Semantic fit is the primary tie-breaker.
   */
  if (
    first.result.breakdown.semantic !==
    second.result.breakdown.semantic
  ) {
    return (
      second.result.breakdown.semantic -
      first.result.breakdown.semantic
    )
  }

  /*
   * Contextual vibe and archetype fit outrank geometry once a candidate has
   * already passed feasibility checks.
   */
  const firstContextScore =
    first.result.breakdown.vibe +
    first.result.breakdown.archetype

  const secondContextScore =
    second.result.breakdown.vibe +
    second.result.breakdown.archetype

  if (
    firstContextScore !==
    secondContextScore
  ) {
    return (
      secondContextScore -
      firstContextScore
    )
  }

  if (
    first.result.breakdown.time !==
    second.result.breakdown.time
  ) {
    return (
      second.result.breakdown.time -
      first.result.breakdown.time
    )
  }

  if (
    first.result.breakdown.geometry !==
    second.result.breakdown.geometry
  ) {
    return (
      second.result.breakdown.geometry -
      first.result.breakdown.geometry
    )
  }

  return first.venue.id.localeCompare(
    second.venue.id
  )
}

// -----------------------------------------------------------------------------
// Conflict collection
// -----------------------------------------------------------------------------

function collectHardConflictReasons({
  semantic,
  archetype,
  vibe,
  time,
  geometry,
  sequence,
}: {
  semantic: SemanticFitResult
  archetype: ArchetypeFitResult
  vibe: VibeFitResult
  time: TimeFitResult
  geometry: GeometryFitResult
  sequence: SequenceFitResult
}): string[] {
  const reasons: string[] = []

  if (hasExplicitHardConflict(semantic)) {
    reasons.push("semantic_conflict")
  }

  if (hasExplicitHardConflict(time)) {
    reasons.push("temporal_conflict")
  }

  if (geometry.isHardConflict) {
    reasons.push("geometry_conflict")
  }

  if (sequence.isHardConflict) {
    reasons.push("sequence_conflict")
  }

  /*
   * Archetype and vibe should normally remain soft ranking signals.
   * They become hard conflicts only when their modules explicitly classify
   * them that way.
   */
  if (archetype.isHardConflict) {
    reasons.push("archetype_conflict")
  }

  if (vibe.isHardConflict) {
    reasons.push("vibe_conflict")
  }

  return uniqueStrings(reasons)
}

function collectSoftConflictReasons({
  semantic,
  archetype,
  vibe,
  time,
  geometry,
  sequence,
}: {
  semantic: SemanticFitResult
  archetype: ArchetypeFitResult
  vibe: VibeFitResult
  time: TimeFitResult
  geometry: GeometryFitResult
  sequence: SequenceFitResult
}): string[] {
  const reasons: string[] = []

  if (
    hasExplicitWeakFit(semantic) &&
    !hasExplicitHardConflict(semantic)
  ) {
    reasons.push("weak_semantic_fit")
  }

  if (
    archetype.isWeakFit &&
    !archetype.isHardConflict
  ) {
    reasons.push("weak_archetype_fit")
  }

  if (
    vibe.isWeakFit &&
    !vibe.isHardConflict
  ) {
    reasons.push("weak_vibe_fit")
  }

  if (
    hasExplicitWeakFit(time) &&
    !hasExplicitHardConflict(time)
  ) {
    reasons.push("weak_time_fit")
  }

  if (
    geometry.isWeakFit &&
    !geometry.isHardConflict
  ) {
    reasons.push("weak_geometry_fit")
  }

  if (
    sequence.isWeakFit &&
    !sequence.isHardConflict
  ) {
    reasons.push("weak_sequence_fit")
  }

  return uniqueStrings(reasons)
}

/**
 * Normalizes fit modules that do not yet share a single result contract.
 *
 * This avoids coupling candidateScore.ts to properties that are absent from
 * SemanticFitResult or TimeFitResult while still respecting those properties
 * if either module adds them later.
 */
function hasExplicitHardConflict(
  result: unknown
): boolean {
  if (!isRecord(result)) return false

  if (result.isHardConflict === true) {
    return true
  }

  if (result.hardConflict === true) {
    return true
  }

  if (result.eligible === false) {
    return true
  }

  return false
}

/**
 * Uses explicit weak-fit metadata when available. Otherwise, falls back to the
 * module's numeric score without inventing a hard conflict.
 */
function hasExplicitWeakFit(
  result: unknown
): boolean {
  if (!isRecord(result)) return false

  if (result.isWeakFit === true) {
    return true
  }

  if (result.weakFit === true) {
    return true
  }

  if (
    typeof result.score === "number" &&
    Number.isFinite(result.score)
  ) {
    return result.score <= -10
  }

  return false
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
}

// -----------------------------------------------------------------------------
// Score adjustments
// -----------------------------------------------------------------------------

function computeDataQualityAdjustment(
  venue: CandidateScoreVenue
): number {
  let score = 0

  const hasType =
    hasValues(venue.type)

  const hasTags =
    hasValues(venue.tags)

  const hasVibe =
    hasValues(venue.vibe)

  const hasTimeCategory =
    hasValues(venue.time_category)

  const hasCoordinates =
    isFiniteNumber(venue.lat) &&
    isFiniteNumber(venue.lon)

  /*
   * Tags and vibes are the venue's defining contextual attributes. Complete
   * records receive a modest reward; missing fields are not automatically
   * rejected because historical data may be incomplete.
   */
  if (
    hasType &&
    hasTags &&
    hasVibe
  ) {
    score += 5
  } else if (
    hasType &&
    (hasTags || hasVibe)
  ) {
    score += 2
  }

  if (!hasType) {
    score -= 8
  }

  if (
    !hasTags &&
    !hasVibe
  ) {
    score -= 8
  }

  if (hasTimeCategory) {
    score += 2
  }

  if (hasCoordinates) {
    score += 1
  }

  /*
   * No adjustment is applied for energy_ramp. Coverage is not mature enough
   * for missing values to reduce a venue's ranking.
   */
  return score
}

function computeSoftConflictPenalty({
  count,
  selectedPass,
}: {
  count: number
  selectedPass: SelectionPass | null
}): number {
  if (count <= 0) return 0

  const penaltyPerConflict =
    selectedPass === "emergency"
      ? 2
      : selectedPass === "relaxed"
        ? 3
        : selectedPass === "balanced"
          ? 4
          : 5

  return -(
    Math.min(count, 5) *
    penaltyPerConflict
  )
}

function passesMinimumScoreForPass(
  score: number,
  selectedPass: SelectionPass | null
): boolean {
  if (selectedPass === "emergency") {
    return score >= -45
  }

  if (selectedPass === "relaxed") {
    return score >= -20
  }

  if (selectedPass === "balanced") {
    return score >= -8
  }

  return score >= 0
}

// -----------------------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------------------

function computeCandidateConfidence({
  venue,
  semantic,
  archetype,
  vibe,
  time,
  geometry,
  sequence,
}: {
  venue: CandidateScoreVenue
  semantic: SemanticFitResult
  archetype: ArchetypeFitResult
  vibe: VibeFitResult
  time: TimeFitResult
  geometry: GeometryFitResult
  sequence: SequenceFitResult
}): number {
  let confidence = 0.18

  if (hasValues(venue.type)) {
    confidence += 0.1
  }

  if (hasValues(venue.tags)) {
    confidence += 0.11
  }

  if (hasValues(venue.vibe)) {
    confidence += 0.11
  }

  if (hasValues(venue.time_category)) {
    confidence += 0.07
  }

  if (
    isFiniteNumber(venue.lat) &&
    isFiniteNumber(venue.lon)
  ) {
    confidence += 0.07
  }

  if (hasUsableHours(venue.hours)) {
    confidence += 0.08
  }

  confidence +=
    normalizedFitConfidence(
      semantic.confidenceScore
    ) * 0.12

  confidence +=
    normalizedFitConfidence(
      archetype.confidenceScore
    ) * 0.08

  confidence +=
    normalizedFitConfidence(
      vibe.confidenceScore
    ) * 0.1

  confidence +=
    normalizedFitConfidence(
      time.confidenceScore
    ) * 0.07

  confidence +=
    normalizedFitConfidence(
      geometry.confidenceScore
    ) * 0.05

  confidence +=
    normalizedFitConfidence(
      sequence.confidenceScore
    ) * 0.04

  /*
   * energy_ramp may add only a negligible confidence increase while coverage
   * remains incomplete.
   */
  if (hasEnergyRamp(venue.energy_ramp)) {
    confidence += 0.01
  }

  return Number(
    clamp(
      confidence,
      0,
      0.99
    ).toFixed(2)
  )
}

function resolveCandidateConfidence(
  confidenceScore: number
): CandidateScoreConfidence {
  if (confidenceScore >= 0.76) {
    return "high"
  }

  if (confidenceScore >= 0.52) {
    return "medium"
  }

  if (confidenceScore >= 0.3) {
    return "low"
  }

  return "insufficient"
}

// -----------------------------------------------------------------------------
// Candidate-pool preparation
// -----------------------------------------------------------------------------

function computeCandidatePreparationScore({
  venue,
  inferredRoles,
  distanceMeters,
  context,
}: {
  venue: VenueRecord
  inferredRoles: StopRole[]
  distanceMeters: number | null
  context: PlanningContext
}): number {
  let score = 0

  /*
   * Candidate preparation is deliberately lightweight.
   *
   * Final contextual scoring occurs later for each slot through
   * computeCandidateScore().
   */
  if (inferredRoles.length > 0) {
    score += 6
  } else {
    score -= 10
  }

  if (hasValues(venue.type)) {
    score += 4
  } else {
    score -= 8
  }

  /*
   * Tags and vibes are the defining contextual venue fields. Reward their
   * availability without trying to interpret them independently of a slot.
   */
  if (hasValues(venue.tags)) {
    score += 5
  }

  if (hasValues(venue.vibe)) {
    score += 5
  }

  if (
    !hasValues(venue.tags) &&
    !hasValues(venue.vibe)
  ) {
    score -= 8
  }

  if (hasValues(venue.time_category)) {
    score += 2
  }

  if (
    isFiniteNumber(venue.lat) &&
    isFiniteNumber(venue.lon)
  ) {
    score += 2
  }

  if (hasUsableHours(venue.hours)) {
    score += 2
  }

  score += computePreparationDistanceScore(
    distanceMeters,
    context
  )

  /*
   * Missing energy_ramp data receives no penalty. Coverage is not yet mature
   * enough for it to be a dependable preparation signal.
   */
  return clamp(
    Math.round(score),
    -40,
    40
  )
}

function computePreparationDistanceScore(
  distanceMeters: number | null,
  context: PlanningContext
): number {
  if (distanceMeters == null) {
    return 0
  }

  if (context.mobility === "walk") {
    if (distanceMeters <= 800) {
      return 8
    }

    if (distanceMeters <= 1400) {
      return 4
    }

    if (distanceMeters <= 2200) {
      return 0
    }

    return -6
  }

  if (context.mobility === "short_ride") {
    if (distanceMeters <= 1800) {
      return 7
    }

    if (distanceMeters <= 3200) {
      return 3
    }

    if (distanceMeters <= 5000) {
      return 0
    }

    return -5
  }

  if (distanceMeters <= 3500) {
    return 5
  }

  if (distanceMeters <= 6000) {
    return 2
  }

  if (distanceMeters <= 9000) {
    return 0
  }

  return -4
}

function comparePreparedCandidates(
  first: CandidateVenue,
  second: CandidateVenue
): number {
  if (first.score !== second.score) {
    return second.score - first.score
  }

  const firstContextFieldCount =
    Number(hasValues(first.tags)) +
    Number(hasValues(first.vibe)) +
    Number(hasValues(first.time_category))

  const secondContextFieldCount =
    Number(hasValues(second.tags)) +
    Number(hasValues(second.vibe)) +
    Number(hasValues(second.time_category))

  if (
    firstContextFieldCount !==
    secondContextFieldCount
  ) {
    return (
      secondContextFieldCount -
      firstContextFieldCount
    )
  }

  const firstDistance =
    first.distanceMeters ??
    Number.POSITIVE_INFINITY

  const secondDistance =
    second.distanceMeters ??
    Number.POSITIVE_INFINITY

  if (
    firstDistance !==
    secondDistance
  ) {
    return (
      firstDistance -
      secondDistance
    )
  }

  return first.id.localeCompare(
    second.id
  )
}

/**
 * Preparation-level role inference.
 *
 * This exists only to populate the legacy CandidateVenue contract before
 * slot-aware role evaluation. Slot compatibility remains authoritative in
 * roles.ts and the contextual scoring modules.
 */
function inferPreparationRolesForVenue(
  venue: VenueRecord
): StopRole[] {
  const tokens = normalizeVenueTypes([
    ...normalizeFeatureCollection(venue.type),
    ...normalizeFeatureCollection(venue.tags),
    ...normalizeFeatureCollection(venue.vibe),
    ...normalizeFeatureCollection(
      venue.time_category
    ),
    venue.name ?? "",
  ])

  const roles: StopRole[] = []

  if (
    hasAnyNormalizedValue(
      tokens,
      [
        "coffee",
        "cafe",
        "café",
        "coffee shop",
        "tea",
        "tea house",
        "matcha",
        "bakery",
        "breakfast",
        "espresso",
      ]
    )
  ) {
    roles.push("coffee")
  }

  if (
    hasAnyNormalizedValue(
      tokens,
      [
        "restaurant",
        "food",
        "food hall",
        "casual food",
        "fine dining",
        "breakfast",
        "brunch",
        "lunch",
        "dinner",
        "supper",
        "gastropub",
        "steakhouse",
        "pizzeria",
        "tacos",
        "burger",
        "sandwich",
      ]
    )
  ) {
    roles.push("food")
  }

  if (
    hasAnyNormalizedValue(
      tokens,
      [
        "bar",
        "cocktail",
        "cocktails",
        "wine bar",
        "lounge",
        "speakeasy",
        "brewery",
        "pub",
        "beer garden",
        "rooftop",
        "sports bar",
        "hotel bar",
        "social club",
        "club",
        "nightlife",
      ]
    )
  ) {
    roles.push("drink")
  }

  if (
    hasAnyNormalizedValue(
      tokens,
      [
        "gallery",
        "museum",
        "bookstore",
        "library",
        "showroom",
        "market",
        "park",
        "garden",
        "cinema",
        "theater",
        "theatre",
        "music",
        "live music",
        "karaoke",
        "bowling",
        "arcade",
        "activity",
        "fitness",
        "wellness",
        "yoga",
        "pilates",
        "spa",
      ]
    )
  ) {
    roles.push("activity")
  }

  if (
    hasAnyNormalizedValue(
      tokens,
      [
        "dessert",
        "dessert bar",
        "ice cream",
        "gelato",
        "pastry",
        "pastries",
        "sweets",
        "chocolate",
        "bakery",
      ]
    )
  ) {
    roles.push("dessert")
  }

  return uniqueRoles(roles)
}

// -----------------------------------------------------------------------------
// Adapters
// -----------------------------------------------------------------------------

function toSequenceVenue(
  venue: CandidateScoreVenue
): SequenceVenueLike {
  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    tags: venue.tags,
    vibe: venue.vibe,
    time_category: venue.time_category,
    inferredRoles: venue.inferredRoles,
    assignedRole: venue.assignedRole,
    slotRole: venue.slotRole,
    phase: venue.phase,
    slotPhase: venue.slotPhase,
    slotIndex: venue.slotIndex,
    energy_ramp: venue.energy_ramp,
  }
}

// -----------------------------------------------------------------------------
// Generic helpers
// -----------------------------------------------------------------------------

function weightedScore(
  value: number,
  weight: number
): number {
  return Math.round(
    finiteNumber(value) *
    finiteNumber(weight)
  )
}

function finiteNumber(
  value: number | null | undefined
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : 0
}

function normalizedFitConfidence(
  value: number | null | undefined
): number {
  return clamp(
    finiteNumber(value),
    0,
    1
  )
}

function normalizeRoles(
  roles: StopRole[] | null | undefined
): StopRole[] {
  if (!Array.isArray(roles)) {
    return []
  }

  return roles.filter(isStopRole)
}

function uniqueRoles(
  roles: StopRole[]
): StopRole[] {
  return Array.from(
    new Set(roles)
  )
}

function isStopRole(
  value: unknown
): value is StopRole {
  return (
    value === "coffee" ||
    value === "food" ||
    value === "drink" ||
    value === "activity" ||
    value === "dessert"
  )
}

function hasValues(
  value:
    | string[]
    | string
    | null
    | undefined
): boolean {
  if (Array.isArray(value)) {
    return value.some(
      (entry) =>
        typeof entry === "string" &&
        entry.trim().length > 0
    )
  }

  return (
    typeof value === "string" &&
    value.trim().length > 0
  )
}

function normalizeFeatureCollection(
  value:
    | string[]
    | string
    | null
    | undefined
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry))
      .filter(Boolean)
  }

  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return [value]
  }

  return []
}

function hasAnyNormalizedValue(
  values: string[],
  expectedValues: string[]
): boolean {
  if (
    values.length === 0 ||
    expectedValues.length === 0
  ) {
    return false
  }

  const normalizedValues =
    new Set(
      values.map(normalizeComparableValue)
    )

  return expectedValues.some((expected) =>
    normalizedValues.has(
      normalizeComparableValue(expected)
    )
  )
}

function normalizeComparableValue(
  value: string
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function hasUsableHours(
  hours:
    | Record<
        string,
        {
          open?: string | null
          close?: string | null
        }
      >
    | string
    | null
    | undefined
): boolean {
  if (typeof hours === "string") {
    return hours.trim().length > 0
  }

  if (
    !hours ||
    typeof hours !== "object" ||
    Array.isArray(hours)
  ) {
    return false
  }

  return Object.values(hours).some(
    (entry) =>
      !!entry &&
      (
        typeof entry.open === "string" ||
        typeof entry.close === "string"
      )
  )
}

function hasEnergyRamp(
  value:
    | string
    | number
    | null
    | undefined
): boolean {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return true
  }

  return (
    typeof value === "string" &&
    value.trim().length > 0
  )
}

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(values)
  )
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum
  )
}