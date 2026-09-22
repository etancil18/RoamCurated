// lib/routes/scoreCollectionCandidate.ts

import {
  scoreVenue,
  type ScoreVenueInputVenue,
  type ScoreVenueParams,
  type VenueScoreResult,
} from './scoreVenue'
import type { RouteStopOrigin } from '@/types/route'

export type CollectionCandidateScoreResult = {
  baseScore: number
  baseNormalizedScore: number
  collectionAdjustment: number
  finalScore: number
  normalizedScore: number
  origin: RouteStopOrigin
  scoreResult: VenueScoreResult
}

export type ScoreCollectionCandidateParams = ScoreVenueParams & {
  origin: RouteStopOrigin
  collectionScoreAdjustment?: number
}

export const DEFAULT_COLLECTION_SCORE_ADJUSTMENT = 8
export const MAX_COLLECTION_SCORE_ADJUSTMENT = 12

const NORMALIZED_SCORE_MIN = -80
const NORMALIZED_SCORE_MAX = 150

export function scoreCollectionCandidate({
  origin,
  collectionScoreAdjustment = DEFAULT_COLLECTION_SCORE_ADJUSTMENT,
  ...scoreVenueParams
}: ScoreCollectionCandidateParams): CollectionCandidateScoreResult {
  const scoreResult = scoreVenue(scoreVenueParams)
  const collectionAdjustment =
    origin === 'collection'
      ? sanitizeCollectionScoreAdjustment(collectionScoreAdjustment)
      : 0

  const finalScore = scoreResult.score + collectionAdjustment

  return {
    baseScore: scoreResult.score,
    baseNormalizedScore: scoreResult.normalizedScore,
    collectionAdjustment,
    finalScore,
    normalizedScore: normalizeCollectionScore(finalScore),
    origin,
    scoreResult,
  }
}

export function scoreCollectionCandidatePool({
  candidates,
  origin,
  scoreParams,
  collectionScoreAdjustment = DEFAULT_COLLECTION_SCORE_ADJUSTMENT,
}: {
  candidates: ScoreVenueInputVenue[]
  origin: RouteStopOrigin
  scoreParams: Omit<ScoreVenueParams, 'candidate'>
  collectionScoreAdjustment?: number
}): CollectionCandidateScoreResult[] {
  return candidates
    .map((candidate) =>
      scoreCollectionCandidate({
        ...scoreParams,
        candidate,
        origin,
        collectionScoreAdjustment,
      })
    )
    .sort(compareCollectionCandidateScores)
}

export function compareCollectionCandidateScores(
  a: CollectionCandidateScoreResult,
  b: CollectionCandidateScoreResult
): number {
  if (a.finalScore !== b.finalScore) {
    return b.finalScore - a.finalScore
  }

  if (a.baseScore !== b.baseScore) {
    return b.baseScore - a.baseScore
  }

  const aDistance = normalizeDistanceForSort(a.scoreResult.distanceMeters)
  const bDistance = normalizeDistanceForSort(b.scoreResult.distanceMeters)

  if (aDistance !== bDistance) {
    return aDistance - bDistance
  }

  return getStableVenueKey(a.scoreResult, a.origin).localeCompare(
    getStableVenueKey(b.scoreResult, b.origin)
  )
}

function sanitizeCollectionScoreAdjustment(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_COLLECTION_SCORE_ADJUSTMENT
  }

  return Math.min(value, MAX_COLLECTION_SCORE_ADJUSTMENT)
}

function normalizeCollectionScore(score: number): number {
  const clamped = Math.max(
    NORMALIZED_SCORE_MIN,
    Math.min(NORMALIZED_SCORE_MAX, score)
  )

  return Math.round(
    ((clamped - NORMALIZED_SCORE_MIN) /
      (NORMALIZED_SCORE_MAX - NORMALIZED_SCORE_MIN)) *
      100
  )
}

function normalizeDistanceForSort(distanceMeters: number | null): number {
  return typeof distanceMeters === 'number' &&
    Number.isFinite(distanceMeters)
    ? distanceMeters
    : Number.POSITIVE_INFINITY
}

function getStableVenueKey(
  scoreResult: VenueScoreResult,
  origin: RouteStopOrigin
): string {
  const candidateTypes = scoreResult.candidateTypes.join('|')

  return [
    origin,
    candidateTypes,
    scoreResult.distanceMeters ?? '',
    scoreResult.estimatedTravelMinutes ?? '',
  ].join(':')
}