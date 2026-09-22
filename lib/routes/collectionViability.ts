// lib/routes/collectionViability.ts

import type { RouteStage } from './routeStages'
import type {
  VenueScoreReason,
  VenueScoreResult,
} from './scoreVenue'
import type { RouteStop } from '@/types/route'

export type CollectionViabilityReason =
  | 'viable'
  | 'below_minimum_score'
  | 'likely_closed'
  | 'severe_contextual_mismatch'
  | 'severe_stage_mismatch'
  | 'missing_required_geography'
  | 'duplicate_venue'
  | 'excessive_category_repetition'

export type CollectionCandidateViabilityResult = {
  viable: boolean
  reasons: CollectionViabilityReason[]
  minimumScore: number
  effectiveScore: number
}

export type EvaluateCollectionCandidateViabilityParams = {
  candidateVenueId?: string | null
  finalScore: number
  scoreResult: VenueScoreResult
  stage: RouteStage
  selectedStops?: RouteStop[]
  selectedVenueIds?: Set<string>
  minimumScore?: number
  maxConsecutiveTypeRepeats?: number
}

export const DEFAULT_COLLECTION_MINIMUM_VIABLE_SCORE = 0
export const DEFAULT_MAX_CONSECUTIVE_TYPE_REPEATS = 2

const SEVERE_CONTEXTUAL_MISMATCH_THRESHOLD = -36
const SEVERE_STAGE_MISMATCH_THRESHOLD = -40

export function evaluateCollectionCandidateViability({
  candidateVenueId = null,
  finalScore,
  scoreResult,
  stage,
  selectedStops = [],
  selectedVenueIds = new Set<string>(),
  minimumScore = DEFAULT_COLLECTION_MINIMUM_VIABLE_SCORE,
  maxConsecutiveTypeRepeats = DEFAULT_MAX_CONSECUTIVE_TYPE_REPEATS,
}: EvaluateCollectionCandidateViabilityParams): CollectionCandidateViabilityResult {
  const safeMinimumScore = sanitizeMinimumScore(minimumScore)
  const safeMaxConsecutiveTypeRepeats =
    sanitizeMaxConsecutiveTypeRepeats(maxConsecutiveTypeRepeats)

  const reasons: CollectionViabilityReason[] = []

  if (!Number.isFinite(finalScore) || finalScore < safeMinimumScore) {
    reasons.push('below_minimum_score')
  }

  if (scoreResult.openConfidence === 'likely_closed') {
    reasons.push('likely_closed')
  }

  if (scoreResult.distanceMeters === null) {
    reasons.push('missing_required_geography')
  }

  if (
    candidateVenueId &&
    selectedVenueIds.has(candidateVenueId)
  ) {
    reasons.push('duplicate_venue')
  }

  if (
    hasReasonAtOrBelow(
      scoreResult.reasons,
      'contextual_mismatch',
      SEVERE_CONTEXTUAL_MISMATCH_THRESHOLD
    )
  ) {
    reasons.push('severe_contextual_mismatch')
  }

  if (
    hasReasonAtOrBelow(
      scoreResult.reasons,
      'stage_fit',
      SEVERE_STAGE_MISMATCH_THRESHOLD
    )
  ) {
    reasons.push('severe_stage_mismatch')
  }

  if (
    createsExcessiveCategoryRepetition({
      candidateTypes: scoreResult.candidateTypes,
      selectedStops,
      maxConsecutiveTypeRepeats: safeMaxConsecutiveTypeRepeats,
      stage,
    })
  ) {
    reasons.push('excessive_category_repetition')
  }

  const uniqueReasons = Array.from(new Set(reasons))

  return {
    viable: uniqueReasons.length === 0,
    reasons:
      uniqueReasons.length > 0
        ? uniqueReasons
        : ['viable'],
    minimumScore: safeMinimumScore,
    effectiveScore: finalScore,
  }
}

export function isCollectionCandidateViable(
  params: EvaluateCollectionCandidateViabilityParams
): boolean {
  return evaluateCollectionCandidateViability(params).viable
}

function createsExcessiveCategoryRepetition({
  candidateTypes,
  selectedStops,
  maxConsecutiveTypeRepeats,
  stage,
}: {
  candidateTypes: VenueScoreResult['candidateTypes']
  selectedStops: RouteStop[]
  maxConsecutiveTypeRepeats: number
  stage: RouteStage
}): boolean {
  if (
    candidateTypes.length === 0 ||
    selectedStops.length === 0 ||
    maxConsecutiveTypeRepeats < 1
  ) {
    return false
  }

  const candidateTypeSet = new Set(candidateTypes)

  let consecutiveMatchingStops = 0

  for (let index = selectedStops.length - 1; index >= 0; index -= 1) {
    const stop = selectedStops[index]

    if (
      !stop.candidateTypes.some((type) =>
        candidateTypeSet.has(type)
      )
    ) {
      break
    }

    consecutiveMatchingStops += 1
  }

  if (consecutiveMatchingStops < maxConsecutiveTypeRepeats) {
    return false
  }

  return !stageExplicitlySupportsRepeatedType({
    candidateTypes,
    stage,
  })
}

function stageExplicitlySupportsRepeatedType({
  candidateTypes,
  stage,
}: {
  candidateTypes: VenueScoreResult['candidateTypes']
  stage: RouteStage
}): boolean {
  if (!stage.maxRepeats || stage.maxRepeats <= 1) {
    return false
  }

  const stageTypeSet = new Set(
    stage.types.map(normalizeTypeKey).filter(Boolean)
  )

  return candidateTypes.some((type) =>
    stageTypeSet.has(normalizeTypeKey(type))
  )
}

function hasReasonAtOrBelow(
  reasons: VenueScoreReason[],
  key: VenueScoreReason['key'],
  threshold: number
): boolean {
  return reasons.some(
    (reason) =>
      reason.key === key &&
      reason.delta <= threshold
  )
}

function sanitizeMinimumScore(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COLLECTION_MINIMUM_VIABLE_SCORE
  }

  return value
}

function sanitizeMaxConsecutiveTypeRepeats(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_CONSECUTIVE_TYPE_REPEATS
  }

  return Math.max(1, Math.min(4, Math.round(value)))
}

function normalizeTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[–—-]/g, '-')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}