// lib/routes/collectionCandidatePool.ts

import type { RouteStage } from './routeStages'
import {
  filterRouteCandidates,
  summarizeRejections,
  type CandidateFilterReason,
  type CandidateFilterRejectedVenue,
  type CandidateFilterTravelMode,
  type CandidateFilterVenue,
} from './candidateFilter'

export type CollectionCandidateOrigin = 'collection' | 'roam_fill'

export type CollectionCandidatePoolVenue = CandidateFilterVenue

export type CollectionCandidatePool = {
  collectionCandidates: CollectionCandidatePoolVenue[]
  fallbackCandidates: CollectionCandidatePoolVenue[]
  collectionRejected: CandidateFilterRejectedVenue[]
  fallbackRejected: CandidateFilterRejectedVenue[]
  collectionRejectionCounts: Partial<Record<CandidateFilterReason, number>>
  fallbackRejectionCounts: Partial<Record<CandidateFilterReason, number>>
  collectionMaxDistanceMeters: number
  fallbackMaxDistanceMeters: number
}

export type BuildCollectionCandidatePoolParams = {
  collectionVenues: CollectionCandidatePoolVenue[]
  fallbackVenues: CollectionCandidatePoolVenue[]
  anchorVenue: CollectionCandidatePoolVenue
  previousStop?: CollectionCandidatePoolVenue | null
  stage: RouteStage
  arrivalAt: Date
  selectedVenueIds?: Set<string>
  excludedVenueIds?: Set<string> | string[]
  travelMode?: CandidateFilterTravelMode
  maxDistanceMeters: number
  collectionDistanceMultiplier?: number
  timezone?: string | null
}

export const DEFAULT_COLLECTION_DISTANCE_MULTIPLIER = 1.25
export const MAX_COLLECTION_DISTANCE_MULTIPLIER = 1.5

export function buildCollectionCandidatePool({
  collectionVenues,
  fallbackVenues,
  anchorVenue,
  previousStop = null,
  stage,
  arrivalAt,
  selectedVenueIds = new Set<string>(),
  excludedVenueIds = new Set<string>(),
  travelMode = 'walking',
  maxDistanceMeters,
  collectionDistanceMultiplier = DEFAULT_COLLECTION_DISTANCE_MULTIPLIER,
  timezone = null,
}: BuildCollectionCandidatePoolParams): CollectionCandidatePool {
  const safeMaxDistanceMeters = sanitizeMaxDistanceMeters(maxDistanceMeters)
  const safeCollectionDistanceMultiplier =
    sanitizeCollectionDistanceMultiplier(collectionDistanceMultiplier)

  const collectionMaxDistanceMeters =
    safeMaxDistanceMeters * safeCollectionDistanceMultiplier

  const collectionResult = filterRouteCandidates({
    venues: collectionVenues,
    anchorVenue,
    previousStop,
    stage,
    arrivalAt,
    selectedVenueIds,
    excludedVenueIds,
    travelMode,
    maxDistanceMeters: collectionMaxDistanceMeters,
    requireStageMatch: true,
    excludeLikelyClosed: true,
    timezone,
  })

  const fallbackResult = filterRouteCandidates({
    venues: fallbackVenues,
    anchorVenue,
    previousStop,
    stage,
    arrivalAt,
    selectedVenueIds,
    excludedVenueIds,
    travelMode,
    maxDistanceMeters: safeMaxDistanceMeters,
    requireStageMatch: true,
    excludeLikelyClosed: true,
    timezone,
  })

  return {
    collectionCandidates: collectionResult.candidates,
    fallbackCandidates: fallbackResult.candidates,
    collectionRejected: collectionResult.rejected,
    fallbackRejected: fallbackResult.rejected,
    collectionRejectionCounts: summarizeRejections(collectionResult.rejected),
    fallbackRejectionCounts: summarizeRejections(fallbackResult.rejected),
    collectionMaxDistanceMeters,
    fallbackMaxDistanceMeters: safeMaxDistanceMeters,
  }
}

export function hasCollectionCandidates(
  pool: CollectionCandidatePool
): boolean {
  return pool.collectionCandidates.length > 0
}

export function hasFallbackCandidates(
  pool: CollectionCandidatePool
): boolean {
  return pool.fallbackCandidates.length > 0
}

export function hasAnyCollectionCandidatePoolCandidates(
  pool: CollectionCandidatePool
): boolean {
  return hasCollectionCandidates(pool) || hasFallbackCandidates(pool)
}

export function getCollectionCandidateOrigin(
  venue: CollectionCandidatePoolVenue,
  collectionVenueIds: Set<string>
): CollectionCandidateOrigin {
  return venue.id && collectionVenueIds.has(venue.id)
    ? 'collection'
    : 'roam_fill'
}

function sanitizeMaxDistanceMeters(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      'buildCollectionCandidatePool requires a positive maxDistanceMeters.'
    )
  }

  return value
}

function sanitizeCollectionDistanceMultiplier(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_COLLECTION_DISTANCE_MULTIPLIER
  }

  return Math.min(value, MAX_COLLECTION_DISTANCE_MULTIPLIER)
}