// lib/outings/sequenceScoring/geometryFit.ts

import type {
  Mobility,
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  VenueRecord,
} from "../types"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type GeometryFitConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type GeometryVenueLike = Pick<
  VenueRecord,
  "id" | "name" | "lat" | "lon"
> & {
  distanceMeters?: number | null
}

export type GeometryDistanceLimits = {
  anchorPreferredMeters: number
  anchorRelaxedMeters: number
  anchorHardMaximumMeters: number

  interstopPreferredMeters: number
  interstopRelaxedMeters: number
  interstopHardMaximumMeters: number
}

export type GeometryFitBreakdown = {
  anchorProximity: number
  interstopProximity: number
  beforeProgression: number
  afterLocality: number
  directionalConsistency: number
  routeCompactness: number
  phaseTransitionFit: number
  missingCoordinateAdjustment: number
}

export type GeometryFitEvidence = {
  phase: SlotPhase
  slotIndex: number
  mobility: Mobility

  anchorDistanceMeters: number | null
  previousDistanceMeters: number | null
  previousAnchorDistanceMeters: number | null

  selectedVenueCount: number
  totalKnownRouteDistanceMeters: number

  movesTowardAnchor: boolean | null
  remainsNearAnchor: boolean | null
  isLocalFromPrevious: boolean | null
  isFullModePhaseTransition: boolean

  hasAnchorCoordinates: boolean
  hasCandidateCoordinates: boolean
  hasPreviousCoordinates: boolean

  limits: GeometryDistanceLimits
}

export type GeometryFitResult = {
  score: number
  confidence: GeometryFitConfidence
  confidenceScore: number

  isStrongFit: boolean
  isWeakFit: boolean
  isHardConflict: boolean
  isWithinRelaxedLimits: boolean

  breakdown: GeometryFitBreakdown
  evidence: GeometryFitEvidence
}

export type ComputeGeometryFitInput = {
  venue: GeometryVenueLike
  context: PlanningContext
  slot: PlanningSlot
  previousVenue?: GeometryVenueLike | null
  selectedSoFar?: GeometryVenueLike[]
}

// -----------------------------------------------------------------------------
// Score boundaries
// -----------------------------------------------------------------------------

const MAX_GEOMETRY_SCORE = 38
const MIN_GEOMETRY_SCORE = -70

/*
 * Geometry remains deliberately lower-weight than semantic, vibe, archetype,
 * and time fit. It should break close ties and prevent broken routes, not turn
 * the nearest mediocre venue into the winner.
 */
const STRONG_ANCHOR_BONUS = 12
const ACCEPTABLE_ANCHOR_BONUS = 6
const RELAXED_ANCHOR_BONUS = 1
const FAR_ANCHOR_PENALTY = 12

const STRONG_INTERSTOP_BONUS = 10
const ACCEPTABLE_INTERSTOP_BONUS = 5
const RELAXED_INTERSTOP_BONUS = 1
const FAR_INTERSTOP_PENALTY = 14

const BEFORE_PROGRESS_BONUS = 8
const BEFORE_FLAT_PROGRESS_BONUS = 2
const BEFORE_BACKTRACK_PENALTY = 10

const AFTER_LOCALITY_BONUS = 6
const AFTER_EXPANSION_PENALTY = 8

const DIRECTIONAL_CONSISTENCY_BONUS = 5
const DIRECTIONAL_REVERSAL_PENALTY = 7

const COMPACT_ROUTE_BONUS = 4
const SPRAWLING_ROUTE_PENALTY = 6

const FULL_PHASE_TRANSITION_BONUS = 5
const FULL_PHASE_TRANSITION_PENALTY = 8

const MISSING_CANDIDATE_COORDINATES_PENALTY = 8
const MISSING_ANCHOR_COORDINATES_PENALTY = 3

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeGeometryFit({
  venue,
  context,
  slot,
  previousVenue = null,
  selectedSoFar = [],
}: ComputeGeometryFitInput): GeometryFitResult {
  const phase = slot.phase
  const limits = getGeometryDistanceLimits(context, phase)

  const anchorVenue = context.anchorVenue
  const anchorDistanceMeters = distanceBetween(anchorVenue, venue)
  const previousDistanceMeters = distanceBetween(previousVenue, venue)
  const previousAnchorDistanceMeters = distanceBetween(
    anchorVenue,
    previousVenue
  )

  const hasAnchorCoordinates = hasCoordinates(anchorVenue)
  const hasCandidateCoordinates = hasCoordinates(venue)
  const hasPreviousCoordinates = hasCoordinates(previousVenue)

  const isFullModePhaseTransition =
    context.mode === "full" &&
    phase === "after" &&
    selectedSoFar.some((selected) => {
      const selectedPhase = readSelectedPhase(selected)
      return selectedPhase === "before"
    })

  const movesTowardAnchor =
    anchorDistanceMeters != null &&
    previousAnchorDistanceMeters != null
      ? anchorDistanceMeters <= previousAnchorDistanceMeters + 125
      : null

  const remainsNearAnchor =
    anchorDistanceMeters != null
      ? anchorDistanceMeters <= limits.anchorRelaxedMeters
      : null

  const isLocalFromPrevious =
    previousDistanceMeters != null
      ? previousDistanceMeters <= limits.interstopRelaxedMeters
      : null

  const totalKnownRouteDistanceMeters = computeKnownRouteDistance({
    selectedSoFar,
    candidate: venue,
    anchorVenue,
    phase,
    mode: context.mode,
  })

  const anchorProximity = scoreAnchorProximity({
    anchorDistanceMeters,
    limits,
    phase,
    slotIndex: slot.index,
    mode: context.mode,
  })

  const interstopProximity = scoreInterstopProximity({
    previousDistanceMeters,
    limits,
    hasPreviousVenue: previousVenue != null,
  })

  const beforeProgression = scoreBeforeProgression({
    phase,
    slotIndex: slot.index,
    anchorDistanceMeters,
    previousAnchorDistanceMeters,
  })

  const afterLocality = scoreAfterLocality({
    phase,
    previousDistanceMeters,
    anchorDistanceMeters,
    limits,
  })

  const directionalConsistency = scoreDirectionalConsistency({
    selectedSoFar,
    candidate: venue,
    anchorVenue,
    previousVenue,
    phase,
  })

  const routeCompactness = scoreRouteCompactness({
    totalKnownRouteDistanceMeters,
    selectedVenueCount: selectedSoFar.length + 1,
    mobility: context.mobility,
  })

  const phaseTransitionFit = scorePhaseTransitionFit({
    context,
    slot,
    anchorDistanceMeters,
    previousDistanceMeters,
    limits,
    isFullModePhaseTransition,
  })

  const missingCoordinateAdjustment = scoreMissingCoordinateAdjustment({
    hasAnchorCoordinates,
    hasCandidateCoordinates,
  })

  const breakdown: GeometryFitBreakdown = {
    anchorProximity,
    interstopProximity,
    beforeProgression,
    afterLocality,
    directionalConsistency,
    routeCompactness,
    phaseTransitionFit,
    missingCoordinateAdjustment,
  }

  const rawScore =
    anchorProximity +
    interstopProximity +
    beforeProgression +
    afterLocality +
    directionalConsistency +
    routeCompactness +
    phaseTransitionFit +
    missingCoordinateAdjustment

  const score = clamp(
    Math.round(rawScore),
    MIN_GEOMETRY_SCORE,
    MAX_GEOMETRY_SCORE
  )

  const isAnchorHardConflict =
    anchorDistanceMeters != null &&
    anchorDistanceMeters > limits.anchorHardMaximumMeters

  const isInterstopHardConflict =
    previousDistanceMeters != null &&
    previousDistanceMeters > limits.interstopHardMaximumMeters

  /*
   * First before and first after stops are judged primarily against the anchor.
   * Later stops are judged primarily against the previous selected venue.
   */
  const isAnchorPrimary =
    previousVenue == null ||
    slot.index === 0 ||
    isFullModePhaseTransition

  const isHardConflict = isAnchorPrimary
    ? isAnchorHardConflict
    : isInterstopHardConflict || isAnchorHardConflict

  const isWithinRelaxedLimits =
    (!isAnchorPrimary ||
      anchorDistanceMeters == null ||
      anchorDistanceMeters <= limits.anchorRelaxedMeters) &&
    (isAnchorPrimary ||
      previousDistanceMeters == null ||
      previousDistanceMeters <= limits.interstopRelaxedMeters)

  const confidenceScore = calculateGeometryConfidence({
    hasAnchorCoordinates,
    hasCandidateCoordinates,
    hasPreviousCoordinates,
    hasPreviousVenue: previousVenue != null,
    anchorDistanceMeters,
    previousDistanceMeters,
    isHardConflict,
  })

  const confidence = resolveGeometryConfidence({
    confidenceScore,
    hasCandidateCoordinates,
  })

  return {
    score,
    confidence,
    confidenceScore,
    isStrongFit:
      !isHardConflict &&
      isWithinRelaxedLimits &&
      score >= 14 &&
      confidenceScore >= 0.6,
    isWeakFit:
      isHardConflict ||
      score <= -10 ||
      confidenceScore < 0.25,
    isHardConflict,
    isWithinRelaxedLimits,
    breakdown,
    evidence: {
      phase,
      slotIndex: slot.index,
      mobility: context.mobility,
      anchorDistanceMeters,
      previousDistanceMeters,
      previousAnchorDistanceMeters,
      selectedVenueCount: selectedSoFar.length,
      totalKnownRouteDistanceMeters,
      movesTowardAnchor,
      remainsNearAnchor,
      isLocalFromPrevious,
      isFullModePhaseTransition,
      hasAnchorCoordinates,
      hasCandidateCoordinates,
      hasPreviousCoordinates,
      limits,
    },
  }
}

/**
 * Numeric wrapper for candidate ranking.
 */
export function scoreGeometryFit(
  venue: GeometryVenueLike,
  context: PlanningContext,
  slot: PlanningSlot,
  previousVenue?: GeometryVenueLike | null,
  selectedSoFar: GeometryVenueLike[] = []
): number {
  return computeGeometryFit({
    venue,
    context,
    slot,
    previousVenue,
    selectedSoFar,
  }).score
}

/**
 * Use only in hard-constraint selection passes.
 *
 * A venue should not be rejected merely because it is not the closest option.
 * This becomes true only when the route is genuinely outside the configured
 * practical maximum.
 */
export function isGeometryHardConflict(
  venue: GeometryVenueLike,
  context: PlanningContext,
  slot: PlanningSlot,
  previousVenue?: GeometryVenueLike | null,
  selectedSoFar: GeometryVenueLike[] = []
): boolean {
  return computeGeometryFit({
    venue,
    context,
    slot,
    previousVenue,
    selectedSoFar,
  }).isHardConflict
}

/**
 * Conservative metadata for diagnostics and persisted stop metadata.
 */
export function getGeometryFitMetadata(
  result: GeometryFitResult
): {
  geometryFitScore: number
  geometryFitConfidence: number
  geometryFitConfidenceLabel: GeometryFitConfidence
  geometryStrongFit: boolean
  geometryHardConflict: boolean
  geometryWithinRelaxedLimits: boolean
  anchorDistanceMeters: number | null
  previousDistanceMeters: number | null
  previousAnchorDistanceMeters: number | null
  movesTowardAnchor: boolean | null
  remainsNearAnchor: boolean | null
  isLocalFromPrevious: boolean | null
  geometryLimits: GeometryDistanceLimits
  geometryBreakdown: GeometryFitBreakdown
} {
  return {
    geometryFitScore: result.score,
    geometryFitConfidence: result.confidenceScore,
    geometryFitConfidenceLabel: result.confidence,
    geometryStrongFit: result.isStrongFit,
    geometryHardConflict: result.isHardConflict,
    geometryWithinRelaxedLimits: result.isWithinRelaxedLimits,
    anchorDistanceMeters: result.evidence.anchorDistanceMeters,
    previousDistanceMeters: result.evidence.previousDistanceMeters,
    previousAnchorDistanceMeters:
      result.evidence.previousAnchorDistanceMeters,
    movesTowardAnchor: result.evidence.movesTowardAnchor,
    remainsNearAnchor: result.evidence.remainsNearAnchor,
    isLocalFromPrevious: result.evidence.isLocalFromPrevious,
    geometryLimits: result.evidence.limits,
    geometryBreakdown: result.breakdown,
  }
}

/**
 * Useful for final route validation.
 */
export function hasAcceptableGeometryFit(
  result: GeometryFitResult,
  minimumConfidence = 0.4
): boolean {
  return (
    !result.isHardConflict &&
    result.confidenceScore >= minimumConfidence &&
    result.score > -10
  )
}

// -----------------------------------------------------------------------------
// Distance limits
// -----------------------------------------------------------------------------

export function getGeometryDistanceLimits(
  context: PlanningContext,
  phase: SlotPhase
): GeometryDistanceLimits {
  const mobility = context.mobility
  const cityPlanning = context.cityPlanning

  const configuredAnchorMaximum =
    cityPlanning?.distances.maxAnchorDistanceMeters[mobility]

  const configuredInterstop =
    phase === "after"
      ? cityPlanning?.distances.afterInterstopMeters
      : cityPlanning?.distances.beforeInterstopMeters

  const anchorPreferredMeters = getDefaultAnchorPreferredMeters(
    mobility,
    phase
  )

  const anchorRelaxedMeters =
    typeof configuredAnchorMaximum === "number" &&
    Number.isFinite(configuredAnchorMaximum)
      ? configuredAnchorMaximum
      : getDefaultAnchorRelaxedMeters(mobility, phase)

  const anchorHardMaximumMeters = Math.round(
    anchorRelaxedMeters * getHardLimitMultiplier(mobility)
  )

  const interstopPreferredMeters =
    typeof configuredInterstop?.strict === "number" &&
    Number.isFinite(configuredInterstop.strict)
      ? configuredInterstop.strict
      : getDefaultInterstopPreferredMeters(mobility, phase)

  const interstopRelaxedMeters =
    typeof configuredInterstop?.relaxed === "number" &&
    Number.isFinite(configuredInterstop.relaxed)
      ? configuredInterstop.relaxed
      : getDefaultInterstopRelaxedMeters(mobility, phase)

  const interstopHardMaximumMeters = Math.round(
    interstopRelaxedMeters * getHardLimitMultiplier(mobility)
  )

  return {
    anchorPreferredMeters,
    anchorRelaxedMeters: Math.max(
      anchorPreferredMeters,
      anchorRelaxedMeters
    ),
    anchorHardMaximumMeters: Math.max(
      anchorRelaxedMeters,
      anchorHardMaximumMeters
    ),
    interstopPreferredMeters,
    interstopRelaxedMeters: Math.max(
      interstopPreferredMeters,
      interstopRelaxedMeters
    ),
    interstopHardMaximumMeters: Math.max(
      interstopRelaxedMeters,
      interstopHardMaximumMeters
    ),
  }
}

function getDefaultAnchorPreferredMeters(
  mobility: Mobility,
  phase: SlotPhase
): number {
  if (mobility === "walk") {
    return phase === "after" ? 700 : 900
  }

  if (mobility === "short_ride") {
    return phase === "after" ? 1400 : 1800
  }

  return phase === "after" ? 2200 : 3000
}

function getDefaultAnchorRelaxedMeters(
  mobility: Mobility,
  phase: SlotPhase
): number {
  if (mobility === "walk") {
    return phase === "after" ? 1400 : 1800
  }

  if (mobility === "short_ride") {
    return phase === "after" ? 2800 : 3600
  }

  return phase === "after" ? 4500 : 6000
}

function getDefaultInterstopPreferredMeters(
  mobility: Mobility,
  phase: SlotPhase
): number {
  if (mobility === "walk") {
    return phase === "after" ? 650 : 1000
  }

  if (mobility === "short_ride") {
    return phase === "after" ? 1200 : 1800
  }

  return phase === "after" ? 2000 : 3000
}

function getDefaultInterstopRelaxedMeters(
  mobility: Mobility,
  phase: SlotPhase
): number {
  if (mobility === "walk") {
    return phase === "after" ? 1200 : 2000
  }

  if (mobility === "short_ride") {
    return phase === "after" ? 2200 : 3800
  }

  return phase === "after" ? 3600 : 5500
}

function getHardLimitMultiplier(mobility: Mobility): number {
  if (mobility === "walk") return 1.35
  if (mobility === "short_ride") return 1.5
  return 1.65
}

// -----------------------------------------------------------------------------
// Component scoring
// -----------------------------------------------------------------------------

function scoreAnchorProximity({
  anchorDistanceMeters,
  limits,
  phase,
  slotIndex,
  mode,
}: {
  anchorDistanceMeters: number | null
  limits: GeometryDistanceLimits
  phase: SlotPhase
  slotIndex: number
  mode: PlanningContext["mode"]
}): number {
  if (anchorDistanceMeters == null) return 0

  const anchorIsPrimary =
    slotIndex === 0 ||
    phase === "after" ||
    mode === "full"

  if (!anchorIsPrimary) {
    if (anchorDistanceMeters <= limits.anchorRelaxedMeters) {
      return 2
    }

    if (anchorDistanceMeters <= limits.anchorHardMaximumMeters) {
      return -3
    }

    return -FAR_ANCHOR_PENALTY
  }

  if (anchorDistanceMeters <= limits.anchorPreferredMeters * 0.55) {
    return STRONG_ANCHOR_BONUS
  }

  if (anchorDistanceMeters <= limits.anchorPreferredMeters) {
    return ACCEPTABLE_ANCHOR_BONUS
  }

  if (anchorDistanceMeters <= limits.anchorRelaxedMeters) {
    return RELAXED_ANCHOR_BONUS
  }

  if (anchorDistanceMeters <= limits.anchorHardMaximumMeters) {
    return -FAR_ANCHOR_PENALTY
  }

  return -FAR_ANCHOR_PENALTY * 2
}

function scoreInterstopProximity({
  previousDistanceMeters,
  limits,
  hasPreviousVenue,
}: {
  previousDistanceMeters: number | null
  limits: GeometryDistanceLimits
  hasPreviousVenue: boolean
}): number {
  if (!hasPreviousVenue || previousDistanceMeters == null) {
    return 0
  }

  if (
    previousDistanceMeters <=
    limits.interstopPreferredMeters * 0.55
  ) {
    return STRONG_INTERSTOP_BONUS
  }

  if (previousDistanceMeters <= limits.interstopPreferredMeters) {
    return ACCEPTABLE_INTERSTOP_BONUS
  }

  if (previousDistanceMeters <= limits.interstopRelaxedMeters) {
    return RELAXED_INTERSTOP_BONUS
  }

  if (previousDistanceMeters <= limits.interstopHardMaximumMeters) {
    return -FAR_INTERSTOP_PENALTY
  }

  return -FAR_INTERSTOP_PENALTY * 2
}

function scoreBeforeProgression({
  phase,
  slotIndex,
  anchorDistanceMeters,
  previousAnchorDistanceMeters,
}: {
  phase: SlotPhase
  slotIndex: number
  anchorDistanceMeters: number | null
  previousAnchorDistanceMeters: number | null
}): number {
  if (
    phase !== "before" ||
    slotIndex === 0 ||
    anchorDistanceMeters == null ||
    previousAnchorDistanceMeters == null
  ) {
    return 0
  }

  const delta = previousAnchorDistanceMeters - anchorDistanceMeters

  if (delta >= 250) return BEFORE_PROGRESS_BONUS
  if (delta >= -125) return BEFORE_FLAT_PROGRESS_BONUS
  if (delta >= -400) return -4

  return -BEFORE_BACKTRACK_PENALTY
}

function scoreAfterLocality({
  phase,
  previousDistanceMeters,
  anchorDistanceMeters,
  limits,
}: {
  phase: SlotPhase
  previousDistanceMeters: number | null
  anchorDistanceMeters: number | null
  limits: GeometryDistanceLimits
}): number {
  if (phase !== "after") return 0

  if (
    previousDistanceMeters != null &&
    previousDistanceMeters <= limits.interstopPreferredMeters
  ) {
    return AFTER_LOCALITY_BONUS
  }

  if (
    previousDistanceMeters != null &&
    previousDistanceMeters > limits.interstopRelaxedMeters
  ) {
    return -AFTER_EXPANSION_PENALTY
  }

  if (
    previousDistanceMeters == null &&
    anchorDistanceMeters != null &&
    anchorDistanceMeters <= limits.anchorPreferredMeters
  ) {
    return 4
  }

  return 0
}

function scoreDirectionalConsistency({
  selectedSoFar,
  candidate,
  anchorVenue,
  previousVenue,
  phase,
}: {
  selectedSoFar: GeometryVenueLike[]
  candidate: GeometryVenueLike
  anchorVenue: GeometryVenueLike | null
  previousVenue: GeometryVenueLike | null
  phase: SlotPhase
}): number {
  if (
    phase !== "after" ||
    selectedSoFar.length < 2 ||
    !hasCoordinates(candidate) ||
    !hasCoordinates(previousVenue) ||
    !hasCoordinates(anchorVenue)
  ) {
    return 0
  }

  const priorVenue =
    selectedSoFar[selectedSoFar.length - 2] ?? null

  if (!hasCoordinates(priorVenue)) return 0

  const previousBearing = bearingDegrees(
    priorVenue.lat,
    priorVenue.lon,
    previousVenue.lat,
    previousVenue.lon
  )

  const candidateBearing = bearingDegrees(
    previousVenue.lat,
    previousVenue.lon,
    candidate.lat,
    candidate.lon
  )

  const turnAngle = smallestAngleDifference(
    previousBearing,
    candidateBearing
  )

  if (turnAngle <= 75) {
    return DIRECTIONAL_CONSISTENCY_BONUS
  }

  if (turnAngle >= 145) {
    return -DIRECTIONAL_REVERSAL_PENALTY
  }

  return 0
}

function scoreRouteCompactness({
  totalKnownRouteDistanceMeters,
  selectedVenueCount,
  mobility,
}: {
  totalKnownRouteDistanceMeters: number
  selectedVenueCount: number
  mobility: Mobility
}): number {
  if (selectedVenueCount <= 1 || totalKnownRouteDistanceMeters <= 0) {
    return 0
  }

  const averageLegDistance =
    totalKnownRouteDistanceMeters / selectedVenueCount

  const compactThreshold =
    mobility === "walk"
      ? 900
      : mobility === "short_ride"
        ? 1700
        : 2800

  const sprawlingThreshold =
    mobility === "walk"
      ? 1900
      : mobility === "short_ride"
        ? 3600
        : 5500

  if (averageLegDistance <= compactThreshold) {
    return COMPACT_ROUTE_BONUS
  }

  if (averageLegDistance >= sprawlingThreshold) {
    return -SPRAWLING_ROUTE_PENALTY
  }

  return 0
}

function scorePhaseTransitionFit({
  context,
  slot,
  anchorDistanceMeters,
  previousDistanceMeters,
  limits,
  isFullModePhaseTransition,
}: {
  context: PlanningContext
  slot: PlanningSlot
  anchorDistanceMeters: number | null
  previousDistanceMeters: number | null
  limits: GeometryDistanceLimits
  isFullModePhaseTransition: boolean
}): number {
  if (
    context.mode !== "full" ||
    slot.phase !== "after" ||
    !isFullModePhaseTransition
  ) {
    return 0
  }

  /*
   * The first after-event stop starts from the event anchor, not from the final
   * before-event venue. Anchor distance is therefore the meaningful measure.
   */
  if (
    anchorDistanceMeters != null &&
    anchorDistanceMeters <= limits.anchorPreferredMeters
  ) {
    return FULL_PHASE_TRANSITION_BONUS
  }

  if (
    anchorDistanceMeters != null &&
    anchorDistanceMeters > limits.anchorRelaxedMeters
  ) {
    return -FULL_PHASE_TRANSITION_PENALTY
  }

  if (
    anchorDistanceMeters == null &&
    previousDistanceMeters != null &&
    previousDistanceMeters <= limits.interstopPreferredMeters
  ) {
    return 2
  }

  return 0
}

function scoreMissingCoordinateAdjustment({
  hasAnchorCoordinates,
  hasCandidateCoordinates,
}: {
  hasAnchorCoordinates: boolean
  hasCandidateCoordinates: boolean
}): number {
  if (!hasCandidateCoordinates) {
    return -MISSING_CANDIDATE_COORDINATES_PENALTY
  }

  if (!hasAnchorCoordinates) {
    return -MISSING_ANCHOR_COORDINATES_PENALTY
  }

  return 0
}

// -----------------------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------------------

function calculateGeometryConfidence({
  hasAnchorCoordinates,
  hasCandidateCoordinates,
  hasPreviousCoordinates,
  hasPreviousVenue,
  anchorDistanceMeters,
  previousDistanceMeters,
  isHardConflict,
}: {
  hasAnchorCoordinates: boolean
  hasCandidateCoordinates: boolean
  hasPreviousCoordinates: boolean
  hasPreviousVenue: boolean
  anchorDistanceMeters: number | null
  previousDistanceMeters: number | null
  isHardConflict: boolean
}): number {
  if (!hasCandidateCoordinates) return 0.08

  let confidence = 0.35

  if (hasAnchorCoordinates) confidence += 0.22
  if (anchorDistanceMeters != null) confidence += 0.16

  if (hasPreviousVenue && hasPreviousCoordinates) {
    confidence += 0.12
  }

  if (hasPreviousVenue && previousDistanceMeters != null) {
    confidence += 0.1
  }

  if (!hasPreviousVenue) {
    confidence += 0.05
  }

  if (isHardConflict) {
    confidence += 0.04
  }

  return Number(clamp(confidence, 0, 0.99).toFixed(2))
}

function resolveGeometryConfidence({
  confidenceScore,
  hasCandidateCoordinates,
}: {
  confidenceScore: number
  hasCandidateCoordinates: boolean
}): GeometryFitConfidence {
  if (!hasCandidateCoordinates) return "insufficient"
  if (confidenceScore >= 0.75) return "high"
  if (confidenceScore >= 0.5) return "medium"
  return "low"
}

// -----------------------------------------------------------------------------
// Route helpers
// -----------------------------------------------------------------------------

function computeKnownRouteDistance({
  selectedSoFar,
  candidate,
  anchorVenue,
  phase,
  mode,
}: {
  selectedSoFar: GeometryVenueLike[]
  candidate: GeometryVenueLike
  anchorVenue: GeometryVenueLike | null
  phase: SlotPhase
  mode: PlanningContext["mode"]
}): number {
  const route = [...selectedSoFar, candidate]

  if (route.length === 0) return 0

  let total = 0

  if (
    phase === "after" &&
    mode !== "before" &&
    selectedSoFar.length === 0
  ) {
    total += distanceBetween(anchorVenue, candidate) ?? 0
  }

  for (let index = 1; index < route.length; index += 1) {
    total +=
      distanceBetween(
        route[index - 1],
        route[index]
      ) ?? 0
  }

  if (phase === "before" && hasCoordinates(anchorVenue)) {
    total +=
      distanceBetween(
        route[route.length - 1],
        anchorVenue
      ) ?? 0
  }

  return Math.round(total)
}

/*
 * Supports callers that attach phase to diagnostic candidate objects without
 * requiring VenueRecord itself to own a phase field.
 */
function readSelectedPhase(
  venue: GeometryVenueLike
): SlotPhase | null {
  const value = (venue as GeometryVenueLike & {
    phase?: unknown
    slotPhase?: unknown
  }).phase ??
    (venue as GeometryVenueLike & {
      phase?: unknown
      slotPhase?: unknown
    }).slotPhase

  return value === "before" || value === "after"
    ? value
    : null
}

// -----------------------------------------------------------------------------
// Coordinate utilities
// -----------------------------------------------------------------------------

function distanceBetween(
  first:
    | Pick<VenueRecord, "lat" | "lon">
    | GeometryVenueLike
    | null
    | undefined,
  second:
    | Pick<VenueRecord, "lat" | "lon">
    | GeometryVenueLike
    | null
    | undefined
): number | null {
  if (!hasCoordinates(first) || !hasCoordinates(second)) {
    return null
  }

  return haversineMeters(
    first.lat,
    first.lon,
    second.lat,
    second.lon
  )
}

function hasCoordinates(
  venue:
    | Pick<VenueRecord, "lat" | "lon">
    | GeometryVenueLike
    | null
    | undefined
): venue is NonNullable<typeof venue> & {
  lat: number
  lon: number
} {
  return (
    venue != null &&
    typeof venue.lat === "number" &&
    Number.isFinite(venue.lat) &&
    typeof venue.lon === "number" &&
    Number.isFinite(venue.lon)
  )
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMeters = 6_371_000
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180

  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const deltaPhi = toRadians(lat2 - lat1)
  const deltaLambda = toRadians(lon2 - lon1)

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) ** 2

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

  return Math.round(earthRadiusMeters * c)
}

function bearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180

  const toDegrees = (radians: number) =>
    (radians * 180) / Math.PI

  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const lambda1 = toRadians(lon1)
  const lambda2 = toRadians(lon2)

  const y =
    Math.sin(lambda2 - lambda1) *
    Math.cos(phi2)

  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) *
      Math.cos(phi2) *
      Math.cos(lambda2 - lambda1)

  return (
    toDegrees(Math.atan2(y, x)) + 360
  ) % 360
}

function smallestAngleDifference(
  first: number,
  second: number
): number {
  const difference =
    Math.abs(first - second) % 360

  return difference > 180
    ? 360 - difference
    : difference
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