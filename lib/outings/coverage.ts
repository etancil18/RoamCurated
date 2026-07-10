// lib/outings/coverage.ts

import type {
  GeneratedOutingStop,
  LeaveEarlyByHours,
  PlanMode,
  PlanningContext,
  SelectionPass,
  SlotPhase,
} from "./types"

import {
  qualifiesForLateNightReducedFullFallback,
  qualifiesForLateNightSingleStopFallback,
} from "./sequenceScoring/lateNight"

import {
  qualifiesForDaytimeCultureReducedFullFallback,
  qualifiesForReducedBeforeSingleStopFallback,
} from "./sequenceScoring/daytime"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type PlannerFailureCode =
  | "late_night_low_coverage"
  | "insufficient_venue_coverage"
  | "low_contextual_confidence"

export type CoverageReason =
  | "complete"
  | "late_night_single_stop"
  | "late_night_reduced_full"
  | "reduced_before_single_stop"
  | "daytime_culture_reduced_full"
  | "social_sports_single_stop"
  | "leave_early_reduced"
  | "reduced_full"
  | "insufficient_stop_count"
  | "no_credible_stops"
  | "low_contextual_confidence"

export type CoverageStopAssessment = {
  venueId: string
  stopOrder: number
  phase: SlotPhase | null
  selectedPass: SelectionPass | null

  hasValidVenueId: boolean
  hasValidPhase: boolean
  isEmergency: boolean

  semanticConfidence: number | null
  vibeConfidence: number | null
  archetypeConfidence: number | null
  temporalConfidence: number | null
  geometryConfidence: number | null

  contextualConfidence: number | null
  credible: boolean
}

export type CoverageEvaluation = {
  accepted: boolean
  reason: CoverageReason

  mode: PlanMode

  intendedStopCount: number
  effectiveIntendedStopCount: number
  minimumRequiredStops: number

  selectedStopCount: number
  credibleStopCount: number
  beforeStopCount: number
  afterStopCount: number
  credibleBeforeStopCount: number
  credibleAfterStopCount: number

  completionRate: number
  credibleCompletionRate: number
  routeContextualConfidence: number | null

  failedToGenerateStops: boolean
  hasEmergencyStop: boolean
  allStopsEmergency: boolean

  plannerCoverageComplete: boolean
  reducedFullCoverageSufficient: boolean
  leaveEarlyCoverageSufficient: boolean
  lateNightSingleStopFallbackApplied: boolean
  lateNightReducedFullFallbackApplied: boolean
  reducedBeforeSingleStopFallbackApplied: boolean
  daytimeCultureReducedFullFallbackApplied: boolean
  socialSportsSingleStopFallbackApplied: boolean

  failureCode: PlannerFailureCode | null
  suggestedModes: PlanMode[]

  stopAssessments: CoverageStopAssessment[]
}

export type EvaluateCoverageInput = {
  stops: GeneratedOutingStop[]
  context: PlanningContext

  intendedStopCount?: number | null
  effectiveIntendedStopCount?: number | null
  completionRate?: number | null
  failedToGenerateStops?: boolean

  minimumContextualConfidence?: number
  requireContextualEvidence?: boolean
}

// -----------------------------------------------------------------------------
// Confidence defaults
// -----------------------------------------------------------------------------

const DEFAULT_MINIMUM_CONTEXTUAL_CONFIDENCE = 0.42
const STRICT_CONTEXTUAL_CONFIDENCE = 0.58

const PASS_CONFIDENCE: Record<SelectionPass, number> = {
  strict: 1,
  balanced: 0.82,
  relaxed: 0.6,
  emergency: 0.2,
}

// -----------------------------------------------------------------------------
// Main evaluation
// -----------------------------------------------------------------------------

export function evaluateOutingCoverage(
  input: EvaluateCoverageInput
): CoverageEvaluation {
  const {
    stops,
    context,
  } = input

  const intendedStopCount =
    normalizePositiveInteger(
      input.intendedStopCount ??
        context.slots?.length ??
        context.desiredRoles.length
    )

  const failedToGenerateStops =
    input.failedToGenerateStops === true ||
    (intendedStopCount > 0 && stops.length === 0)

  const minimumContextualConfidence =
    clamp01(input.minimumContextualConfidence) ??
    DEFAULT_MINIMUM_CONTEXTUAL_CONFIDENCE

  const requireContextualEvidence =
    input.requireContextualEvidence ?? true

  const stopAssessments = stops.map((stop) =>
    assessCoverageStop({
      stop,
      minimumContextualConfidence,
      requireContextualEvidence,
    })
  )

  const credibleStops = stopAssessments.filter(
    (assessment) => assessment.credible
  )

  const selectedStopCount = stops.length
  const credibleStopCount = credibleStops.length

  const beforeStopCount = stops.filter(
    (stop) => stop.phase === "before"
  ).length

  const afterStopCount = stops.filter(
    (stop) => stop.phase === "after"
  ).length

  const credibleBeforeStopCount = credibleStops.filter(
    (assessment) => assessment.phase === "before"
  ).length

  const credibleAfterStopCount = credibleStops.filter(
    (assessment) => assessment.phase === "after"
  ).length

  const hasEmergencyStop = stopAssessments.some(
    (assessment) => assessment.isEmergency
  )

  const allStopsEmergency =
    stopAssessments.length > 0 &&
    stopAssessments.every((assessment) => assessment.isEmergency)

  const reducedBeforeSingleStopFallbackApplied =
    qualifiesForReducedBeforeSingleStopFallback(stops, context)

  const lateNightSingleStopFallbackApplied =
    qualifiesForLateNightSingleStopFallback(stops, context)

  const lateNightReducedFullFallbackApplied =
    qualifiesForLateNightReducedFullFallback(stops, context)

  const daytimeCultureReducedFullFallbackApplied =
    qualifiesForDaytimeCultureReducedFullFallback(stops, context)

  const socialSportsSingleStopFallbackApplied =
    qualifiesForSocialSportsSingleStopFallback(stops, context)

  const leaveEarlyCoverageSufficient =
    qualifiesForLeaveEarlyCoverage({
      stops,
      mode: context.mode,
      leaveEarlyByHours: context.leaveEarlyByHours,
    })

  const reducedFullCoverageSufficient =
    qualifiesForReducedFullCoverage({
      stops,
      mode: context.mode,
    })

  const effectiveIntendedStopCount =
    resolveEffectiveIntendedStopCount({
      explicitValue: input.effectiveIntendedStopCount,
      intendedStopCount,
      reducedBeforeSingleStopFallbackApplied,
      lateNightSingleStopFallbackApplied,
      socialSportsSingleStopFallbackApplied,
    })

  const completionRate =
    normalizeCompletionRate(
      input.completionRate,
      selectedStopCount,
      effectiveIntendedStopCount
    )

  const credibleCompletionRate =
    effectiveIntendedStopCount > 0
      ? roundToTwo(
          Math.min(
            1,
            credibleStopCount / effectiveIntendedStopCount
          )
        )
      : credibleStopCount > 0
        ? 1
        : 0

  const routeContextualConfidence =
    averageKnown(
      credibleStops.map(
        (assessment) => assessment.contextualConfidence
      )
    )

  const plannerCoverageComplete =
    credibleCompletionRate >= 1 &&
    credibleStopCount >= 1 &&
    !allStopsEmergency

  const minimumRequiredStops = resolveMinimumRequiredStops({
    mode: context.mode,
    selectedStopCount,
    credibleStopCount,
    plannerCoverageComplete,
    reducedFullCoverageSufficient,
    daytimeCultureReducedFullFallbackApplied,
    lateNightSingleStopFallbackApplied,
    lateNightReducedFullFallbackApplied,
    reducedBeforeSingleStopFallbackApplied,
    socialSportsSingleStopFallbackApplied,
    leaveEarlyCoverageSufficient,
  })

  const acceptedCoverageReason = resolveAcceptedCoverageReason({
    plannerCoverageComplete,
    lateNightSingleStopFallbackApplied,
    lateNightReducedFullFallbackApplied,
    reducedBeforeSingleStopFallbackApplied,
    daytimeCultureReducedFullFallbackApplied,
    socialSportsSingleStopFallbackApplied,
    leaveEarlyCoverageSufficient,
    reducedFullCoverageSufficient,
    credibleStopCount,
    minimumRequiredStops,
  })

  const hasEnoughCredibleStops =
    credibleStopCount >= minimumRequiredStops

  const hasContextualConfidence =
    routeContextualConfidence == null
      ? !requireContextualEvidence
      : routeContextualConfidence >= minimumContextualConfidence

  const accepted =
    !failedToGenerateStops &&
    !allStopsEmergency &&
    hasEnoughCredibleStops &&
    hasContextualConfidence &&
    acceptedCoverageReason != null

  const reason = resolveFinalCoverageReason({
    accepted,
    acceptedCoverageReason,
    failedToGenerateStops,
    selectedStopCount,
    credibleStopCount,
    minimumRequiredStops,
    hasContextualConfidence,
  })

  const failureCode = accepted
    ? null
    : resolvePlannerFailureCode({
        mode: context.mode,
        startsAt: context.startsAt,
        estimatedEndAt: context.estimatedEndAt,
        effectiveExitAt: context.effectiveExitAt ?? null,
        timeZone: context.timeZone,
        selectedStopCount,
        credibleStopCount,
        minimumRequiredStops,
        failedToGenerateStops,
        hasContextualConfidence,
      })

  return {
    accepted,
    reason,

    mode: context.mode,

    intendedStopCount,
    effectiveIntendedStopCount,
    minimumRequiredStops,

    selectedStopCount,
    credibleStopCount,
    beforeStopCount,
    afterStopCount,
    credibleBeforeStopCount,
    credibleAfterStopCount,

    completionRate,
    credibleCompletionRate,
    routeContextualConfidence,

    failedToGenerateStops,
    hasEmergencyStop,
    allStopsEmergency,

    plannerCoverageComplete,
    reducedFullCoverageSufficient,
    leaveEarlyCoverageSufficient,
    lateNightSingleStopFallbackApplied,
    lateNightReducedFullFallbackApplied,
    reducedBeforeSingleStopFallbackApplied,
    daytimeCultureReducedFullFallbackApplied,
    socialSportsSingleStopFallbackApplied,

    failureCode,
    suggestedModes: failureCode
      ? getSuggestedModesForPlannerFailure({
          code: failureCode,
          mode: context.mode,
        })
      : [],

    stopAssessments,
  }
}

// -----------------------------------------------------------------------------
// Individual stop assessment
// -----------------------------------------------------------------------------

export function assessCoverageStop({
  stop,
  minimumContextualConfidence = DEFAULT_MINIMUM_CONTEXTUAL_CONFIDENCE,
  requireContextualEvidence = true,
}: {
  stop: GeneratedOutingStop
  minimumContextualConfidence?: number
  requireContextualEvidence?: boolean
}): CoverageStopAssessment {
  const selectedPass =
    normalizeSelectionPass(stop.metadata?.selectedPass)

  const isEmergency =
    selectedPass === "emergency"

  const semanticConfidence =
    normalizeComponentConfidence(
      readMetadataNumber(stop, "semanticFitScore")
    )

  const vibeConfidence =
    clamp01(
      readMetadataNumber(stop, "vibeConfidence")
    )

  const archetypeConfidence =
    normalizeComponentConfidence(
      readMetadataNumber(stop, "archetypeFitScore")
    )

  const temporalConfidence =
    normalizeComponentConfidence(
      readMetadataNumber(stop, "timeFitScore")
    )

  const geometryConfidence =
    normalizeComponentConfidence(
      readMetadataNumber(stop, "geometryFitScore")
    )

  const passConfidence =
    selectedPass
      ? PASS_CONFIDENCE[selectedPass]
      : 0.5

  const contextualConfidence =
    weightedKnownAverage([
      [semanticConfidence, 0.27],
      [vibeConfidence, 0.27],
      [archetypeConfidence, 0.2],
      [temporalConfidence, 0.12],
      [geometryConfidence, 0.08],
      [passConfidence, 0.06],
    ])

  const hasValidVenueId =
    typeof stop.venueId === "string" &&
    stop.venueId.trim().length > 0

  const hasValidPhase =
    stop.phase === "before" ||
    stop.phase === "after"

  const hasContextualEvidence =
    [
      semanticConfidence,
      vibeConfidence,
      archetypeConfidence,
      temporalConfidence,
    ].some((value) => value != null)

  const credible =
    hasValidVenueId &&
    hasValidPhase &&
    !isEmergency &&
    (
      contextualConfidence == null
        ? !requireContextualEvidence
        : contextualConfidence >= minimumContextualConfidence
    ) &&
    (
      !requireContextualEvidence ||
      hasContextualEvidence
    )

  return {
    venueId: stop.venueId,
    stopOrder: stop.stopOrder,
    phase: normalizePhase(stop.phase),
    selectedPass,

    hasValidVenueId,
    hasValidPhase,
    isEmergency,

    semanticConfidence,
    vibeConfidence,
    archetypeConfidence,
    temporalConfidence,
    geometryConfidence,

    contextualConfidence,
    credible,
  }
}

// -----------------------------------------------------------------------------
// Coverage rules
// -----------------------------------------------------------------------------

export function minimumStopsForMode(
  mode: PlanMode
): number {
  return mode === "full" ? 3 : 2
}

export function qualifiesForLeaveEarlyCoverage({
  stops,
  mode,
  leaveEarlyByHours,
}: {
  stops: GeneratedOutingStop[]
  mode: PlanMode
  leaveEarlyByHours?: LeaveEarlyByHours | null
}): boolean {
  if (!leaveEarlyByHours) return false

  const credibleStops =
    stops.filter(isNonEmergencyStop)

  const beforeStops =
    credibleStops.filter(
      (stop) => stop.phase === "before"
    ).length

  const afterStops =
    credibleStops.filter(
      (stop) => stop.phase === "after"
    ).length

  if (mode === "after") {
    return afterStops >= 1
  }

  if (mode === "full") {
    return beforeStops >= 1 && afterStops >= 1
  }

  return false
}

export function qualifiesForReducedFullCoverage({
  stops,
  mode,
}: {
  stops: GeneratedOutingStop[]
  mode: PlanMode
}): boolean {
  if (mode !== "full") return false

  const credibleStops =
    stops.filter(isNonEmergencyStop)

  const beforeStops =
    credibleStops.filter(
      (stop) => stop.phase === "before"
    ).length

  const afterStops =
    credibleStops.filter(
      (stop) => stop.phase === "after"
    ).length

  return (
    beforeStops >= 1 &&
    afterStops >= 1
  )
}

export function qualifiesForSocialSportsSingleStopFallback(
  stops: GeneratedOutingStop[],
  context: Pick<
    PlanningContext,
    "mode" | "eventArchetype"
  >
): boolean {
  if (
    context.eventArchetype !== "social_sports"
  ) {
    return false
  }

  if (stops.length !== 1) {
    return false
  }

  const stop = stops[0]

  if (!stop || !isNonEmergencyStop(stop)) {
    return false
  }

  if (
    stop.role !== "food" &&
    stop.role !== "drink" &&
    stop.role !== "coffee"
  ) {
    return false
  }

  if (context.mode === "before") {
    return stop.phase === "before"
  }

  if (context.mode === "after") {
    return stop.phase === "after"
  }

  return (
    stop.phase === "before" ||
    stop.phase === "after"
  )
}

// -----------------------------------------------------------------------------
// Failure resolution
// -----------------------------------------------------------------------------

export function resolvePlannerFailureCode({
  mode,
  startsAt,
  estimatedEndAt,
  effectiveExitAt,
  timeZone,
  selectedStopCount,
  credibleStopCount,
  minimumRequiredStops,
  failedToGenerateStops,
  hasContextualConfidence,
}: {
  mode: PlanMode
  startsAt?: Date | null
  estimatedEndAt?: Date | null
  effectiveExitAt?: Date | null
  timeZone: string
  selectedStopCount: number
  credibleStopCount: number
  minimumRequiredStops: number
  failedToGenerateStops: boolean
  hasContextualConfidence: boolean
}): PlannerFailureCode {
  if (
    selectedStopCount > 0 &&
    credibleStopCount < selectedStopCount &&
    !hasContextualConfidence
  ) {
    return "low_contextual_confidence"
  }

  if (
    mode !== "before" &&
    (
      failedToGenerateStops ||
      credibleStopCount < minimumRequiredStops
    ) &&
    isLateNightLowCoverageContext({
      startsAt,
      estimatedEndAt,
      effectiveExitAt,
      timeZone,
    })
  ) {
    return "late_night_low_coverage"
  }

  return "insufficient_venue_coverage"
}

export function getSuggestedModesForPlannerFailure({
  code,
  mode,
}: {
  code: PlannerFailureCode
  mode: PlanMode
}): PlanMode[] {
  if (code === "late_night_low_coverage") {
    if (mode === "after") {
      return ["before", "full"]
    }

    if (mode === "full") {
      return ["before"]
    }
  }

  if (code === "low_contextual_confidence") {
    if (mode === "full") {
      return ["before", "after"]
    }

    if (mode === "after") {
      return ["before"]
    }
  }

  return []
}

export function getPlannerFailureMessage(
  code: PlannerFailureCode
): string {
  if (code === "late_night_low_coverage") {
    return "There are not enough reliable late-night options nearby to build a strong route after this event."
  }

  if (code === "low_contextual_confidence") {
    return "Nearby venues were found, but the planner could not match them confidently enough to the event and selected vibe."
  }

  return "There are not enough suitable nearby venues to build a route we can recommend confidently."
}

// -----------------------------------------------------------------------------
// Internal coverage resolution
// -----------------------------------------------------------------------------

function resolveMinimumRequiredStops({
  mode,
  selectedStopCount,
  credibleStopCount,
  plannerCoverageComplete,
  reducedFullCoverageSufficient,
  daytimeCultureReducedFullFallbackApplied,
  lateNightSingleStopFallbackApplied,
  lateNightReducedFullFallbackApplied,
  reducedBeforeSingleStopFallbackApplied,
  socialSportsSingleStopFallbackApplied,
  leaveEarlyCoverageSufficient,
}: {
  mode: PlanMode
  selectedStopCount: number
  credibleStopCount: number
  plannerCoverageComplete: boolean
  reducedFullCoverageSufficient: boolean
  daytimeCultureReducedFullFallbackApplied: boolean
  lateNightSingleStopFallbackApplied: boolean
  lateNightReducedFullFallbackApplied: boolean
  reducedBeforeSingleStopFallbackApplied: boolean
  socialSportsSingleStopFallbackApplied: boolean
  leaveEarlyCoverageSufficient: boolean
}): number {
  const reducedCoverageAllowed =
    reducedFullCoverageSufficient ||
    daytimeCultureReducedFullFallbackApplied ||
    lateNightSingleStopFallbackApplied ||
    lateNightReducedFullFallbackApplied ||
    reducedBeforeSingleStopFallbackApplied ||
    socialSportsSingleStopFallbackApplied ||
    leaveEarlyCoverageSufficient

  if (
    plannerCoverageComplete ||
    reducedCoverageAllowed
  ) {
    return Math.max(
      Math.min(
        selectedStopCount,
        credibleStopCount
      ),
      1
    )
  }

  return minimumStopsForMode(mode)
}

function resolveAcceptedCoverageReason({
  plannerCoverageComplete,
  lateNightSingleStopFallbackApplied,
  lateNightReducedFullFallbackApplied,
  reducedBeforeSingleStopFallbackApplied,
  daytimeCultureReducedFullFallbackApplied,
  socialSportsSingleStopFallbackApplied,
  leaveEarlyCoverageSufficient,
  reducedFullCoverageSufficient,
  credibleStopCount,
  minimumRequiredStops,
}: {
  plannerCoverageComplete: boolean
  lateNightSingleStopFallbackApplied: boolean
  lateNightReducedFullFallbackApplied: boolean
  reducedBeforeSingleStopFallbackApplied: boolean
  daytimeCultureReducedFullFallbackApplied: boolean
  socialSportsSingleStopFallbackApplied: boolean
  leaveEarlyCoverageSufficient: boolean
  reducedFullCoverageSufficient: boolean
  credibleStopCount: number
  minimumRequiredStops: number
}): CoverageReason | null {
  if (credibleStopCount < minimumRequiredStops) {
    return null
  }

  if (plannerCoverageComplete) {
    return "complete"
  }

  if (lateNightSingleStopFallbackApplied) {
    return "late_night_single_stop"
  }

  if (lateNightReducedFullFallbackApplied) {
    return "late_night_reduced_full"
  }

  if (reducedBeforeSingleStopFallbackApplied) {
    return "reduced_before_single_stop"
  }

  if (daytimeCultureReducedFullFallbackApplied) {
    return "daytime_culture_reduced_full"
  }

  if (socialSportsSingleStopFallbackApplied) {
    return "social_sports_single_stop"
  }

  if (leaveEarlyCoverageSufficient) {
    return "leave_early_reduced"
  }

  if (reducedFullCoverageSufficient) {
    return "reduced_full"
  }

  return null
}

function resolveFinalCoverageReason({
  accepted,
  acceptedCoverageReason,
  failedToGenerateStops,
  selectedStopCount,
  credibleStopCount,
  minimumRequiredStops,
  hasContextualConfidence,
}: {
  accepted: boolean
  acceptedCoverageReason: CoverageReason | null
  failedToGenerateStops: boolean
  selectedStopCount: number
  credibleStopCount: number
  minimumRequiredStops: number
  hasContextualConfidence: boolean
}): CoverageReason {
  if (accepted && acceptedCoverageReason) {
    return acceptedCoverageReason
  }

  if (
    failedToGenerateStops ||
    selectedStopCount === 0
  ) {
    return "insufficient_stop_count"
  }

  if (credibleStopCount === 0) {
    return "no_credible_stops"
  }

  if (!hasContextualConfidence) {
    return "low_contextual_confidence"
  }

  if (credibleStopCount < minimumRequiredStops) {
    return "insufficient_stop_count"
  }

  return "low_contextual_confidence"
}

function resolveEffectiveIntendedStopCount({
  explicitValue,
  intendedStopCount,
  reducedBeforeSingleStopFallbackApplied,
  lateNightSingleStopFallbackApplied,
  socialSportsSingleStopFallbackApplied,
}: {
  explicitValue?: number | null
  intendedStopCount: number
  reducedBeforeSingleStopFallbackApplied: boolean
  lateNightSingleStopFallbackApplied: boolean
  socialSportsSingleStopFallbackApplied: boolean
}): number {
  const normalizedExplicit =
    normalizePositiveInteger(explicitValue)

  if (normalizedExplicit > 0) {
    return normalizedExplicit
  }

  if (
    reducedBeforeSingleStopFallbackApplied ||
    lateNightSingleStopFallbackApplied ||
    socialSportsSingleStopFallbackApplied
  ) {
    return Math.min(
      intendedStopCount || 1,
      1
    )
  }

  return intendedStopCount
}

// -----------------------------------------------------------------------------
// Late-night context
// -----------------------------------------------------------------------------

export function isLateNightLowCoverageContext({
  startsAt,
  estimatedEndAt,
  effectiveExitAt,
  timeZone,
}: {
  startsAt?: Date | null
  estimatedEndAt?: Date | null
  effectiveExitAt?: Date | null
  timeZone: string
}): boolean {
  const effectiveEndAt =
    effectiveExitAt ??
    estimatedEndAt ??
    null

  if (!startsAt || !effectiveEndAt) {
    return false
  }

  const startDay =
    getCalendarDayKey(
      startsAt,
      timeZone
    )

  const endDay =
    getCalendarDayKey(
      effectiveEndAt,
      timeZone
    )

  const endHour =
    getHourFractionInTimeZone(
      effectiveEndAt,
      timeZone
    )

  return (
    startDay !== endDay ||
    endHour < 4
  )
}

// -----------------------------------------------------------------------------
// Stop helpers
// -----------------------------------------------------------------------------

function isNonEmergencyStop(
  stop: GeneratedOutingStop
): boolean {
  return (
    normalizeSelectionPass(
      stop.metadata?.selectedPass
    ) !== "emergency"
  )
}

function normalizeSelectionPass(
  value: unknown
): SelectionPass | null {
  if (
    value === "strict" ||
    value === "balanced" ||
    value === "relaxed" ||
    value === "emergency"
  ) {
    return value
  }

  return null
}

function normalizePhase(
  value: unknown
): SlotPhase | null {
  if (
    value === "before" ||
    value === "after"
  ) {
    return value
  }

  return null
}

function readMetadataNumber(
  stop: GeneratedOutingStop,
  key: string
): number | null {
  const metadata =
    stop.metadata as
      | Record<string, unknown>
      | null
      | undefined

  if (!metadata) return null

  const value = metadata[key]

  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null
}

// -----------------------------------------------------------------------------
// Confidence normalization
// -----------------------------------------------------------------------------

function normalizeComponentConfidence(
  value: number | null
): number | null {
  if (value == null) return null

  if (value >= 0 && value <= 1) {
    return value
  }

  return Number(
    (
      1 /
      (1 + Math.exp(-value / 14))
    ).toFixed(3)
  )
}

function weightedKnownAverage(
  values: Array<[number | null, number]>
): number | null {
  const known = values.filter(
    (
      entry
    ): entry is [number, number] =>
      typeof entry[0] === "number" &&
      Number.isFinite(entry[0]) &&
      entry[1] > 0
  )

  if (known.length === 0) {
    return null
  }

  const totalWeight =
    known.reduce(
      (sum, [, weight]) =>
        sum + weight,
      0
    )

  if (totalWeight <= 0) {
    return null
  }

  return Number(
    (
      known.reduce(
        (
          sum,
          [value, weight]
        ) =>
          sum +
          clampNumber(value, 0, 1) *
            weight,
        0
      ) / totalWeight
    ).toFixed(3)
  )
}

function averageKnown(
  values: Array<number | null>
): number | null {
  const known =
    values.filter(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value)
    )

  if (known.length === 0) {
    return null
  }

  return Number(
    (
      known.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / known.length
    ).toFixed(3)
  )
}

// -----------------------------------------------------------------------------
// Generic normalization helpers
// -----------------------------------------------------------------------------

function normalizeCompletionRate(
  explicitValue: number | null | undefined,
  selectedStopCount: number,
  intendedStopCount: number
): number {
  const normalizedExplicit =
    clamp01(explicitValue)

  if (normalizedExplicit != null) {
    return roundToTwo(normalizedExplicit)
  }

  if (intendedStopCount <= 0) {
    return selectedStopCount > 0 ? 1 : 0
  }

  return roundToTwo(
    Math.min(
      1,
      selectedStopCount / intendedStopCount
    )
  )
}

function normalizePositiveInteger(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.floor(value)
  )
}

function clamp01(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return clampNumber(
    value,
    0,
    1
  )
}

function clampNumber(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  )
}

function roundToTwo(
  value: number
): number {
  return Number(value.toFixed(2))
}

// -----------------------------------------------------------------------------
// Time-zone helpers
// -----------------------------------------------------------------------------

function getCalendarDayKey(
  date: Date,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date)
}

function getHourFractionInTimeZone(
  date: Date,
  timeZone: string
): number {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).formatToParts(date)

  const hour =
    Number(
      parts.find(
        (part) => part.type === "hour"
      )?.value ?? 0
    )

  const minute =
    Number(
      parts.find(
        (part) => part.type === "minute"
      )?.value ?? 0
    )

  return hour + minute / 60
}

// -----------------------------------------------------------------------------
// Optional stricter acceptance helper
// -----------------------------------------------------------------------------

export function routeHasStrongContextualCoverage(
  evaluation: CoverageEvaluation
): boolean {
  return (
    evaluation.accepted &&
    !evaluation.hasEmergencyStop &&
    evaluation.credibleStopCount ===
      evaluation.selectedStopCount &&
    evaluation.routeContextualConfidence != null &&
    evaluation.routeContextualConfidence >=
      STRICT_CONTEXTUAL_CONFIDENCE
  )
}