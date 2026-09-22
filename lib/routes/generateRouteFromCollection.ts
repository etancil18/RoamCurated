// lib/routes/generateRouteFromCollection.ts

import {
  addMinutes,
  estimateArrivalTime,
  getLocalHour,
} from './arrivalTime'
import { buildRouteContext } from './buildContext'
import {
  buildCollectionRouteContext,
  type CollectionRouteContextCollection,
} from './collectionRouteContext'
import {
  buildCollectionCandidatePool,
  type CollectionCandidatePoolVenue,
} from './collectionCandidatePool'
import { evaluateCollectionCandidateViability } from './collectionViability'
import { explainRoute } from './explainRoute'
import {
  scorePersonalization,
  type UserRoutePersonalization,
} from './personalization'
import {
  scoreCollectionCandidate,
  type CollectionCandidateScoreResult,
} from './scoreCollectionCandidate'
import {
  ROUTE_STAGES,
  type RouteStage,
  getStageTypeSet,
  isHourWithinStageWindow,
  normalizeStageType,
} from './routeStages'
import { normalizeVenueTypes } from './venueTypeNormalization'
import type {
  GeneratedRoute,
  RouteGenerationDebug,
  RouteStop,
  RouteTightness,
  RouteTravelMode,
  RouteVenue,
} from '@/types/route'

export type GenerateRouteFromCollectionVenue = Omit<RouteVenue, 'id'> & {
  id?: string | null
  is_active?: boolean | null
  active?: boolean | null
  permanently_closed?: boolean | null
  closed?: boolean | null
}

export type GenerateRouteFromCollectionParams = {
  collection: CollectionRouteContextCollection
  collectionVenues: GenerateRouteFromCollectionVenue[]
  venues: GenerateRouteFromCollectionVenue[]
  city?: string | null
  plannedStartAt?: Date | string | null
  travelMode?: RouteTravelMode
  tightness?: RouteTightness
  maxStops?: number
  preferredVibes?: string[]
  preferredTags?: string[]
  personalization?: UserRoutePersonalization | null
  includeDebug?: boolean
  timezone?: string | null
}

type ScoredCollectionCandidate = {
  candidate: GenerateRouteFromCollectionVenue
  arrivalEstimate: ReturnType<typeof estimateArrivalTime>
  collectionScore: CollectionCandidateScoreResult
  personalizationScore: ReturnType<typeof scorePersonalization>
  finalScore: number
}

type StageSelectionResult = {
  stage: RouteStage
  pool: ReturnType<typeof buildCollectionCandidatePool>
  scoredCollectionCandidates: ScoredCollectionCandidate[]
  scoredFallbackCandidates: ScoredCollectionCandidate[]
  bestCollectionCandidate: ScoredCollectionCandidate | null
  bestFallbackCandidate: ScoredCollectionCandidate | null
}

type MealStageId =
  | 'breakfast_brunch'
  | 'lunch'
  | 'dinner'

const DEFAULT_MAX_STOPS = 5
const MIN_VIABLE_SCORE = 0
const COLLECTION_CAPACITY_TARGET = 2
const DESTINATION_BRIDGE_SCORE_TOLERANCE = 24
const EARLIEST_MUSIC_HOUR = 17

export function generateRouteFromCollection({
  collection,
  collectionVenues,
  venues,
  city = null,
  plannedStartAt = null,
  travelMode = 'walking',
  tightness = 'medium',
  maxStops = DEFAULT_MAX_STOPS,
  preferredVibes = [],
  preferredTags = [],
  personalization = null,
  includeDebug = true,
  timezone = null,
}: GenerateRouteFromCollectionParams): GeneratedRoute {
  const safeMaxStops = sanitizeMaxStops(maxStops)

  const collectionContext = buildCollectionRouteContext({
    collection: {
      ...collection,
      city: city ?? collection.city ?? null,
    },
    collectionVenues,
    plannedStartAt,
    travelMode,
    tightness,
    maxStops: safeMaxStops,
    preferredVibes,
    preferredTags,
    personalization,
    timezone,
  })

  const collectionAnchorVenue = collectionContext.anchorSeedVenue as
    | GenerateRouteFromCollectionVenue
    | null

  const normalizedCollectionVenues = dedupeVenues(
    collectionContext.usableCollectionVenues as GenerateRouteFromCollectionVenue[]
  )

  const fallbackAnchorVenue = collectionAnchorVenue
    ? null
    : selectRoamFallbackAnchor({
        venues,
        city:
          city ??
          collection.city ??
          collectionContext.city ??
          null,
        startingStage: collectionContext.startingStage,
        collectionDestinations: normalizedCollectionVenues,
        plannedStartAt: collectionContext.plannedStartAt,
        timezone,
      })

  const anchorVenue =
    collectionAnchorVenue ??
    fallbackAnchorVenue

  const anchorOrigin: 'collection' | 'roam_fill' =
    collectionAnchorVenue
      ? 'collection'
      : 'roam_fill'

  const anchorKey = getVenueKey(anchorVenue)
  const resolvedCity =
    city ??
    collection.city ??
    collectionContext.city ??
    anchorVenue?.city ??
    null

  if (!anchorVenue || !anchorKey) {
    return buildFailedCollectionRoute({
      collection,
      context: collectionContext,
      city: resolvedCity,
      travelMode,
      tightness,
      maxStops: safeMaxStops,
      includeDebug,
      warning:
        'No usable Collection or Roam venue was available to seed this Flow.',
    })
  }

  const routeContext =
    collectionContext.anchorSeedContext ??
    buildRouteContext({
      anchorVenue,
      city: resolvedCity,
      plannedStartAt: collectionContext.plannedStartAt,
      travelMode,
      tightness,
      maxStops: safeMaxStops,
      preferredVibes: collectionContext.preferredVibes,
      preferredTags: collectionContext.preferredTags,
      timezone,
    })

  const selectedVenueIds = new Set<string>([anchorKey])
  const selectedStops: RouteStop[] = []

  const collectionRouteKeys = new Set(
    normalizedCollectionVenues
      .map(getVenueKey)
      .filter((key): key is string => Boolean(key))
  )

  const fallbackVenues = dedupeVenues(venues).filter((venue) => {
    const key = getVenueKey(venue)
    return key ? !collectionRouteKeys.has(key) : false
  })

  const anchorStage = routeContext.startingStage
  const anchorArriveAt = collectionContext.plannedStartAt
  const anchorDepartAt = addMinutes(
    anchorArriveAt,
    anchorStage.dwellMinutes
  )

  let previousStop: GenerateRouteFromCollectionVenue = anchorVenue
  let currentStartAt: Date = anchorArriveAt
  let previousStopDwellMinutes = anchorStage.dwellMinutes
  let previousStage = anchorStage
  let collectionHandoffReached =
    anchorOrigin === 'collection'

  let totalDistanceMeters = 0
  let totalTravelMinutes = 0
  let totalDwellMinutes = anchorStage.dwellMinutes
  let rejectedCount = 0
  let candidateCount = 0
  let collectionCandidateCount = 0
  let collectionSelectedCount =
    anchorOrigin === 'collection' ? 1 : 0
  let roamFillSelectedCount =
    anchorOrigin === 'roam_fill' ? 1 : 0

  const stageAttempts: NonNullable<RouteGenerationDebug['stageAttempts']> = []
  const warnings: string[] = []

  while (selectedStops.length < safeMaxStops - 1) {
    const readyAt = addMinutes(
      currentStartAt,
      previousStopDwellMinutes
    )

    const planningStages = getPlanningStages({
      readyAt,
      timezone,
      previousStage,
    })

    if (planningStages.length === 0) {
      warnings.push(
        'No contextually appropriate route stage remained for the current time.'
      )
      break
    }

    const futureCollectionDestinations =
      getFutureCollectionDestinationVenues({
        collectionVenues: normalizedCollectionVenues,
        selectedVenueIds,
        readyAt,
        timezone,
      })

    const stageResults = planningStages.map((stage) =>
      evaluateStage({
        stage,
        normalizedCollectionVenues,
        fallbackVenues,
        anchorVenue,
        previousStop,
        currentStartAt,
        previousStopDwellMinutes,
        selectedStops,
        selectedVenueIds,
        travelMode,
        preferredVibes: collectionContext.preferredVibes,
        preferredTags: collectionContext.preferredTags,
        personalization,
        maxDistanceMeters: routeContext.maxDistanceMeters,
        idealDistanceMeters: routeContext.idealDistanceMeters,
        timezone,
        collectionDestinations: futureCollectionDestinations,
      })
    )

    for (const result of stageResults) {
      rejectedCount +=
        result.pool.collectionRejected.length +
        result.pool.fallbackRejected.length

      candidateCount +=
        result.pool.collectionCandidates.length +
        result.pool.fallbackCandidates.length

      collectionCandidateCount +=
        result.pool.collectionCandidates.length
    }

    const collectionStageResult =
      selectBestCollectionStageResult({
        stageResults,
        collectionHandoffReached,
      })

    const mealStageResult =
      selectRequiredMealStageResult({
        stageResults,
        readyAt,
        timezone,
        anchorStage,
        selectedStops,
      })

    const remainingSlots =
      safeMaxStops - (selectedStops.length + 1)

    const futureCollectionOpportunityCount =
      countFutureCollectionOpportunities({
        collectionVenues: normalizedCollectionVenues,
        selectedVenueIds,
        readyAt,
        timezone,
      })

    const reservedCollectionSlots = Math.min(
      COLLECTION_CAPACITY_TARGET,
      futureCollectionOpportunityCount,
      remainingSlots
    )

    const shouldPreserveCollectionCapacity =
      !collectionStageResult &&
      reservedCollectionSlots > 0 &&
      remainingSlots <= reservedCollectionSlots

    const selectedStageResult =
      collectionStageResult ??
      mealStageResult ??
      (
        shouldPreserveCollectionCapacity
          ? null
          : selectBestFallbackStageResult({
              stageResults,
              previousStage,
              selectedStops,
              anchorVenue,
            })
      )

    if (!selectedStageResult) {
      for (const result of stageResults) {
        stageAttempts.push(
          buildStageAttemptDebug(result, null)
        )
      }

      if (shouldPreserveCollectionCapacity) {
        warnings.push(
          'Roam stopped adding filler to preserve remaining capacity for contextually useful Collection venues.'
        )
      } else {
        warnings.push(
          'No strong Collection or Roam candidate was available for the current route moment.'
        )
      }

      break
    }

    const selected =
      selectedStageResult.bestCollectionCandidate ??
      selectedStageResult.bestFallbackCandidate

    for (const result of stageResults) {
      stageAttempts.push(
        buildStageAttemptDebug(
          result,
          result === selectedStageResult ? selected : null
        )
      )
    }

    const selectedCandidateKey = getVenueKey(selected?.candidate)

    if (!selected || !selectedCandidateKey) {
      warnings.push(
        `No strong Collection or Roam candidate selected for ${selectedStageResult.stage.label}.`
      )
      break
    }

    selectedVenueIds.add(selectedCandidateKey)

    if (selected.collectionScore.origin === 'collection') {
      collectionSelectedCount += 1
      collectionHandoffReached = true
    } else {
      roamFillSelectedCount += 1
    }

    const selectedCandidate = selected.candidate
    const scoreResult = selected.collectionScore.scoreResult
    const selectedStage = selectedStageResult.stage
    const selectedArriveAt = selected.arrivalEstimate.arriveAt
    const selectedDepartAt = addMinutes(
      selectedArriveAt,
      selectedStage.dwellMinutes
    )

    const routeStop: RouteStop = {
      id: `${anchorKey}-${selectedCandidateKey}-${selectedStops.length + 1}`,
      stopOrder: selectedStops.length + 2,
      venue: normalizeRouteVenue(selectedCandidate),
      stageId: selectedStage.id,
      stageLabel: selectedStage.label,
      arriveAt: selectedArriveAt.toISOString(),
      departAt: selectedDepartAt.toISOString(),
      dwellMinutes: selectedStage.dwellMinutes,
      travelMinutesFromPrevious: selected.arrivalEstimate.travelMinutes,
      distanceMetersFromPrevious: selected.arrivalEstimate.distanceMeters,
      score: selected.finalScore,
      normalizedScore: selected.collectionScore.normalizedScore,
      openConfidence: scoreResult.openConfidence,
      candidateTypes: scoreResult.candidateTypes,
      reasons: scoreResult.reasons,
      personalizationReasons: selected.personalizationScore.reasons,
      origin: selected.collectionScore.origin,
    }

    selectedStops.push(routeStop)

    totalDistanceMeters += selected.arrivalEstimate.distanceMeters ?? 0
    totalTravelMinutes += selected.arrivalEstimate.travelMinutes
    totalDwellMinutes += selectedStage.dwellMinutes

    previousStop = selectedCandidate
    currentStartAt = selectedArriveAt
    previousStopDwellMinutes = selectedStage.dwellMinutes
    previousStage = selectedStage
  }

  const anchorStop: RouteStop = {
    id: `${anchorKey}-anchor`,
    stopOrder: 1,
    venue: normalizeRouteVenue(anchorVenue),
    stageId: anchorStage.id,
    stageLabel: anchorStage.label,
    arriveAt: anchorArriveAt.toISOString(),
    departAt: anchorDepartAt.toISOString(),
    dwellMinutes: anchorStage.dwellMinutes,
    travelMinutesFromPrevious: null,
    distanceMetersFromPrevious: null,
    score: 100,
    normalizedScore: 100,
    openConfidence: 'unknown',
    candidateTypes: normalizeVenueTypes(anchorVenue),
    reasons: [],
    personalizationReasons: [],
    origin: anchorOrigin,
  }

  const stops = [anchorStop, ...selectedStops]

  const explanation = explainRoute({
    anchorVenue,
    stops: selectedStops.map((stop) => ({
      venue: stop.venue,
      stage: ROUTE_STAGES.find(
        (stage) => stage.id === stop.stageId
      ),
      arriveAt: stop.arriveAt,
      departAt: stop.departAt,
      dwellMinutes: stop.dwellMinutes,
      travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
      distanceMetersFromPrevious: stop.distanceMetersFromPrevious,
      score: stop.score,
      reasons: stop.reasons,
    })),
    startedAt: collectionContext.plannedStartAt,
    travelMode,
    city: resolvedCity,
  })

  return {
    status: selectedStops.length > 0 ? 'success' : 'failed',
    source: 'creator_collection',
    context: {
      anchorVenueId: anchorKey,
      anchorVenueName: anchorVenue.name,
      anchorTypes: normalizeVenueTypes(anchorVenue),
      city: resolvedCity,
      plannedStartAt: collectionContext.plannedStartAt.toISOString(),
      weekdayKey: collectionContext.weekdayKey,
      localHour: collectionContext.localHour,
      travelMode,
      tightness,
      maxStops: safeMaxStops,
      maxDistanceMeters: routeContext.maxDistanceMeters,
      idealDistanceMeters: routeContext.idealDistanceMeters,
      startingStageId: anchorStage.id,
      candidateStageIds: collectionContext.candidateStages.map(
        (stage) => stage.id
      ),
      source: 'creator_collection',
      collectionId: collection.id,
      collectionCreatorUserId: collection.creatorUserId,
      collectionTitle: collection.title,
    },
    anchorVenue: normalizeRouteVenue(anchorVenue),
    stops,
    explanation,
    totalStops: stops.length,
    totalDistanceMeters,
    totalTravelMinutes,
    totalDwellMinutes,
    totalRouteMinutes: totalTravelMinutes + totalDwellMinutes,
    createdAt: new Date().toISOString(),
    debug: includeDebug
      ? {
          rejectedCount,
          candidateCount,
          selectedCount: selectedStops.length,
          collectionCandidateCount,
          collectionSelectedCount,
          roamFillSelectedCount,
          stageAttempts,
          warnings:
            selectedStops.length === 0
              ? [
                  'No strong contextual stops were selected from the Collection or Roam inventory.',
                  ...warnings,
                ]
              : warnings,
        }
      : undefined,
  }
}

function evaluateStage({
  stage,
  normalizedCollectionVenues,
  fallbackVenues,
  anchorVenue,
  previousStop,
  currentStartAt,
  previousStopDwellMinutes,
  selectedStops,
  selectedVenueIds,
  travelMode,
  preferredVibes,
  preferredTags,
  personalization,
  maxDistanceMeters,
  idealDistanceMeters,
  timezone,
  collectionDestinations,
}: {
  stage: RouteStage
  normalizedCollectionVenues: GenerateRouteFromCollectionVenue[]
  fallbackVenues: GenerateRouteFromCollectionVenue[]
  anchorVenue: GenerateRouteFromCollectionVenue
  previousStop: GenerateRouteFromCollectionVenue
  currentStartAt: Date | string
  previousStopDwellMinutes: number
  selectedStops: RouteStop[]
  selectedVenueIds: Set<string>
  travelMode: RouteTravelMode
  preferredVibes: string[]
  preferredTags: string[]
  personalization: UserRoutePersonalization | null
  maxDistanceMeters: number
  idealDistanceMeters: number
  timezone: string | null
  collectionDestinations: GenerateRouteFromCollectionVenue[]
}): StageSelectionResult {
  const readyAt = addMinutes(
    currentStartAt,
    previousStopDwellMinutes
  )

  const pool = buildCollectionCandidatePool({
    collectionVenues: normalizedCollectionVenues,
    fallbackVenues,
    anchorVenue,
    previousStop,
    stage,
    arrivalAt: readyAt,
    selectedVenueIds,
    travelMode,
    maxDistanceMeters,
    timezone,
  })

  const scoredCollectionCandidates = scoreCandidatePool({
    candidates: pool.collectionCandidates,
    origin: 'collection',
    previousStop,
    anchorVenue,
    stage,
    currentStartAt,
    previousStopDwellMinutes,
    selectedStops,
    selectedVenueIds,
    travelMode,
    preferredVibes,
    preferredTags,
    personalization,
    maxDistanceMeters: pool.collectionMaxDistanceMeters,
    idealDistanceMeters,
    timezone,
  })

  const scoredFallbackCandidates = scoreCandidatePool({
    candidates: pool.fallbackCandidates,
    origin: 'roam_fill',
    previousStop,
    anchorVenue,
    stage,
    currentStartAt,
    previousStopDwellMinutes,
    selectedStops,
    selectedVenueIds,
    travelMode,
    preferredVibes,
    preferredTags,
    personalization,
    maxDistanceMeters: pool.fallbackMaxDistanceMeters,
    idealDistanceMeters,
    timezone,
  })

  const bestCollectionCandidate =
    scoredCollectionCandidates.find((candidate) => {
      const candidateVenueId = getVenueKey(candidate.candidate)

      return evaluateCollectionCandidateViability({
        candidateVenueId,
        finalScore: candidate.finalScore,
        scoreResult: candidate.collectionScore.scoreResult,
        stage,
        selectedStops,
        selectedVenueIds,
      }).viable
    }) ?? null

  const bestFallbackCandidate =
    selectDestinationAwareFallbackCandidate({
      candidates: scoredFallbackCandidates,
      previousStop,
      collectionDestinations,
    })

  return {
    stage,
    pool,
    scoredCollectionCandidates,
    scoredFallbackCandidates,
    bestCollectionCandidate,
    bestFallbackCandidate,
  }
}

function getPlanningStages({
  readyAt,
  timezone,
  previousStage,
}: {
  readyAt: Date
  timezone: string | null
  previousStage: RouteStage
}): RouteStage[] {
  const localHour = getLocalHour(readyAt, timezone)

  const currentStages = ROUTE_STAGES
    .filter((stage) =>
      isHourWithinStageWindow(localHour, stage)
    )
    .filter((stage) =>
      stage.id === previousStage.id ||
      stage.order >= previousStage.order
    )

  if (currentStages.length > 0) {
    return currentStages
  }

  return ROUTE_STAGES.filter(
    (stage) => stage.order > previousStage.order
  ).filter((stage) => !isStageStale(stage, localHour))
}

function selectBestCollectionStageResult({
  stageResults,
  collectionHandoffReached,
}: {
  stageResults: StageSelectionResult[]
  collectionHandoffReached: boolean
}): StageSelectionResult | null {
  const withCollection = stageResults.filter(
    (result) => result.bestCollectionCandidate
  )

  if (withCollection.length === 0) {
    return null
  }

  if (collectionHandoffReached) {
    return [...withCollection].sort((a, b) => {
      const aScore =
        a.bestCollectionCandidate?.finalScore ??
        Number.NEGATIVE_INFINITY
      const bScore =
        b.bestCollectionCandidate?.finalScore ??
        Number.NEGATIVE_INFINITY

      if (aScore !== bScore) {
        return bScore - aScore
      }

      return a.stage.order - b.stage.order
    })[0] ?? null
  }

  return withCollection[0] ?? null
}

function selectRequiredMealStageResult({
  stageResults,
  readyAt,
  timezone,
  anchorStage,
  selectedStops,
}: {
  stageResults: StageSelectionResult[]
  readyAt: Date
  timezone: string | null
  anchorStage: RouteStage
  selectedStops: RouteStop[]
}): StageSelectionResult | null {
  const requiredMealStageId = getRequiredMealStageId({
    readyAt,
    timezone,
    anchorStage,
    selectedStops,
  })

  if (!requiredMealStageId) {
    return null
  }

  const mealStageResult =
    stageResults.find(
      (result) =>
        result.stage.id === requiredMealStageId &&
        (
          result.bestCollectionCandidate ||
          result.bestFallbackCandidate
        )
    ) ?? null

  return mealStageResult
}

function getRequiredMealStageId({
  readyAt,
  timezone,
  anchorStage,
  selectedStops,
}: {
  readyAt: Date
  timezone: string | null
  anchorStage: RouteStage
  selectedStops: RouteStop[]
}): MealStageId | null {
  const completedStageIds = new Set([
    anchorStage.id,
    ...selectedStops.map((stop) => stop.stageId),
  ])

  const localHour = getLocalHour(readyAt, timezone)

  if (
    localHour >= 17 &&
    localHour < 21 &&
    !completedStageIds.has('dinner')
  ) {
    return 'dinner'
  }

  if (
    localHour >= 11 &&
    localHour < 14 &&
    !completedStageIds.has('breakfast_brunch') &&
    !completedStageIds.has('lunch')
  ) {
    return 'lunch'
  }

  if (
    localHour >= 8 &&
    localHour < 11 &&
    !completedStageIds.has('breakfast_brunch')
  ) {
    return 'breakfast_brunch'
  }

  return null
}

function countFutureCollectionOpportunities({
  collectionVenues,
  selectedVenueIds,
  readyAt,
  timezone,
}: {
  collectionVenues: GenerateRouteFromCollectionVenue[]
  selectedVenueIds: Set<string>
  readyAt: Date
  timezone: string | null
}): number {
  return getFutureCollectionDestinationVenues({
    collectionVenues,
    selectedVenueIds,
    readyAt,
    timezone,
  }).length
}

function getFutureCollectionDestinationVenues({
  collectionVenues,
  selectedVenueIds,
  readyAt,
  timezone,
}: {
  collectionVenues: GenerateRouteFromCollectionVenue[]
  selectedVenueIds: Set<string>
  readyAt: Date
  timezone: string | null
}): GenerateRouteFromCollectionVenue[] {
  const localHour = getLocalHour(readyAt, timezone)

  const futureStages = ROUTE_STAGES.filter((stage) =>
    stageCanStillOccurToday(stage, localHour)
  )

  const futureStageTypeSets = futureStages.map(
    (stage) => getStageTypeSet(stage)
  )

  return collectionVenues.filter((venue) => {
    const venueKey = getVenueKey(venue)

    if (!venueKey || selectedVenueIds.has(venueKey)) {
      return false
    }

    const venueTypes = normalizeVenueTypes(venue)

    return futureStageTypeSets.some((stageTypeSet) =>
      venueTypes.some((type) =>
        stageTypeSet.has(normalizeStageType(type))
      )
    )
  })
}

function stageCanStillOccurToday(
  stage: RouteStage,
  localHour: number
): boolean {
  if (isHourWithinStageWindow(localHour, stage)) {
    return true
  }

  if (stage.preferredEndHour < stage.preferredStartHour) {
    return (
      localHour < stage.preferredEndHour ||
      localHour >= stage.preferredStartHour
    )
  }

  return localHour < stage.preferredEndHour
}

function selectDestinationAwareFallbackCandidate({
  candidates,
  previousStop,
  collectionDestinations,
}: {
  candidates: ScoredCollectionCandidate[]
  previousStop: GenerateRouteFromCollectionVenue
  collectionDestinations: GenerateRouteFromCollectionVenue[]
}): ScoredCollectionCandidate | null {
  const viableCandidates = candidates.filter(
    (candidate) => candidate.finalScore >= MIN_VIABLE_SCORE
  )

  const topCandidate = viableCandidates[0] ?? null

  if (
    !topCandidate ||
    collectionDestinations.length === 0
  ) {
    return topCandidate
  }

  const currentDestinationDistance =
    getNearestDestinationDistanceMeters(
      previousStop,
      collectionDestinations
    )

  if (!Number.isFinite(currentDestinationDistance)) {
    return topCandidate
  }

  const competitiveCandidates = viableCandidates.filter(
    (candidate) =>
      candidate.finalScore >=
      topCandidate.finalScore -
        DESTINATION_BRIDGE_SCORE_TOLERANCE
  )

  const destinationImprovingCandidates =
    competitiveCandidates
      .map((candidate) => ({
        candidate,
        destinationDistance:
          getNearestDestinationDistanceMeters(
            candidate.candidate,
            collectionDestinations
          ),
      }))
      .filter(
        (entry) =>
          Number.isFinite(entry.destinationDistance) &&
          entry.destinationDistance <
            currentDestinationDistance
      )
      .sort((a, b) => {
        if (
          a.destinationDistance !==
          b.destinationDistance
        ) {
          return (
            a.destinationDistance -
            b.destinationDistance
          )
        }

        return compareScoredCandidates(
          a.candidate,
          b.candidate
        )
      })

  return (
    destinationImprovingCandidates[0]?.candidate ??
    topCandidate
  )
}

function selectBestFallbackStageResult({
  stageResults,
  previousStage,
  selectedStops,
  anchorVenue,
}: {
  stageResults: StageSelectionResult[]
  previousStage: RouteStage
  selectedStops: RouteStop[]
  anchorVenue: GenerateRouteFromCollectionVenue
}): StageSelectionResult | null {
  const withFallback = stageResults.filter(
    (result) => result.bestFallbackCandidate
  )

  if (withFallback.length === 0) {
    return null
  }

  const previousExperienceTypes = new Set([
    ...normalizeVenueTypes(anchorVenue),
    ...selectedStops.flatMap((stop) => stop.candidateTypes),
  ])

  const novelExperienceStage =
    withFallback.find((result) => {
      if (result.stage.id === previousStage.id) {
        return false
      }

      const candidate =
        result.bestFallbackCandidate?.candidate

      if (!candidate) {
        return false
      }

      const candidateTypes = normalizeVenueTypes(candidate)

      return candidateTypes.some(
        (type) => !previousExperienceTypes.has(type)
      )
    }) ?? null

  if (novelExperienceStage) {
    return novelExperienceStage
  }

  const nonRepeatedStage =
    withFallback.find(
      (result) => result.stage.id !== previousStage.id
    ) ?? null

  return nonRepeatedStage ?? withFallback[0] ?? null
}

function isStageStale(
  stage: RouteStage,
  localHour: number
): boolean {
  if (stage.preferredEndHour < stage.preferredStartHour) {
    return false
  }

  return localHour >= stage.preferredEndHour
}

function buildStageAttemptDebug(
  result: StageSelectionResult,
  selected: ScoredCollectionCandidate | null
): NonNullable<RouteGenerationDebug['stageAttempts']>[number] {
  const selectedCandidateKey = getVenueKey(selected?.candidate)

  return {
    stageId: result.stage.id,
    stageLabel: result.stage.label,
    candidateCount:
      result.pool.collectionCandidates.length +
      result.pool.fallbackCandidates.length,
    selectedVenueId: selectedCandidateKey,
    selectedVenueName: selected?.candidate.name ?? null,
    selectedPass: selected
      ? selected.collectionScore.origin === 'collection'
        ? 'collection'
        : 'roam_fill'
      : null,
    passes: [
      {
        pass: 'collection',
        candidateCount: result.pool.collectionCandidates.length,
        rejectedCount: result.pool.collectionRejected.length,
        rejectionCounts: result.pool.collectionRejectionCounts,
        topScore:
          result.scoredCollectionCandidates[0]?.finalScore ?? null,
        topVenueId:
          getVenueKey(
            result.scoredCollectionCandidates[0]?.candidate
          ) ?? null,
        topVenueName:
          result.scoredCollectionCandidates[0]?.candidate.name ?? null,
      },
      {
        pass: 'roam_fill',
        candidateCount: result.pool.fallbackCandidates.length,
        rejectedCount: result.pool.fallbackRejected.length,
        rejectionCounts: result.pool.fallbackRejectionCounts,
        topScore:
          result.scoredFallbackCandidates[0]?.finalScore ?? null,
        topVenueId:
          getVenueKey(
            result.scoredFallbackCandidates[0]?.candidate
          ) ?? null,
        topVenueName:
          result.scoredFallbackCandidates[0]?.candidate.name ?? null,
      },
    ],
  }
}

function scoreCandidatePool({
  candidates,
  origin,
  previousStop,
  anchorVenue,
  stage,
  currentStartAt,
  previousStopDwellMinutes,
  selectedStops,
  selectedVenueIds,
  travelMode,
  preferredVibes,
  preferredTags,
  personalization,
  maxDistanceMeters,
  idealDistanceMeters,
  timezone,
}: {
  candidates: CollectionCandidatePoolVenue[]
  origin: 'collection' | 'roam_fill'
  previousStop: GenerateRouteFromCollectionVenue
  anchorVenue: GenerateRouteFromCollectionVenue
  stage: Parameters<typeof scoreCollectionCandidate>[0]['stage']
  currentStartAt: Date | string
  previousStopDwellMinutes: number
  selectedStops: RouteStop[]
  selectedVenueIds: Set<string>
  travelMode: RouteTravelMode
  preferredVibes: string[]
  preferredTags: string[]
  personalization: UserRoutePersonalization | null
  maxDistanceMeters: number
  idealDistanceMeters: number
  timezone: string | null
}): ScoredCollectionCandidate[] {
  return candidates
    .filter((candidate) => {
      const candidateKey = getVenueKey(candidate)
      return candidateKey ? !selectedVenueIds.has(candidateKey) : false
    })
    .map((candidate) => {
      const typedCandidate =
        candidate as GenerateRouteFromCollectionVenue

      const arrivalEstimate = estimateArrivalTime({
        fromVenue: previousStop,
        toVenue: typedCandidate,
        startAt: currentStartAt,
        dwellMinutes: previousStopDwellMinutes,
        travelMode,
      })

      const collectionScore = scoreCollectionCandidate({
        candidate: typedCandidate,
        previousStop,
        anchorVenue,
        stage,
        arrivalAt: arrivalEstimate.arriveAt,
        travelMode,
        selectedVenueIds,
        previousRouteTypes: selectedStops.flatMap(
          (stop) => stop.candidateTypes
        ),
        preferredVibes,
        preferredTags,
        maxDistanceMeters,
        idealDistanceMeters,
        timezone,
        origin,
      })

      const personalizationScore = scorePersonalization({
        venue: typedCandidate,
        personalization,
      })

      return {
        candidate: typedCandidate,
        arrivalEstimate,
        collectionScore,
        personalizationScore,
        finalScore:
          collectionScore.finalScore +
          personalizationScore.score,
      }
    })
    .sort(compareScoredCandidates)
}

function compareScoredCandidates(
  a: ScoredCollectionCandidate,
  b: ScoredCollectionCandidate
): number {
  if (a.finalScore !== b.finalScore) {
    return b.finalScore - a.finalScore
  }

  if (a.collectionScore.finalScore !== b.collectionScore.finalScore) {
    return (
      b.collectionScore.finalScore -
      a.collectionScore.finalScore
    )
  }

  const aDistance = normalizeDistanceForSort(
    a.arrivalEstimate.distanceMeters
  )
  const bDistance = normalizeDistanceForSort(
    b.arrivalEstimate.distanceMeters
  )

  if (aDistance !== bDistance) {
    return aDistance - bDistance
  }

  return getStableVenueKey(a.candidate).localeCompare(
    getStableVenueKey(b.candidate)
  )
}

function selectRoamFallbackAnchor({
  venues,
  city,
  startingStage,
  collectionDestinations,
  plannedStartAt,
  timezone,
}: {
  venues: GenerateRouteFromCollectionVenue[]
  city: string | null
  startingStage: ReturnType<
    typeof buildCollectionRouteContext
  >['startingStage']
  collectionDestinations: GenerateRouteFromCollectionVenue[]
  plannedStartAt: Date
  timezone: string | null
}): GenerateRouteFromCollectionVenue | null {
  const normalizedCity = normalizeOptionalString(city)?.toLowerCase() ?? null
  const localHour = getLocalHour(plannedStartAt, timezone)
  const stageTypeSet = getStageTypeSet(startingStage)

  const candidates = dedupeVenues(venues)
    .filter((venue) => {
      if (
        !getVenueKey(venue) ||
        !Number.isFinite(venue.lat) ||
        !Number.isFinite(venue.lon)
      ) {
        return false
      }

      if (
        venue.is_active === false ||
        venue.active === false ||
        venue.permanently_closed === true ||
        venue.closed === true
      ) {
        return false
      }

      if (normalizedCity) {
        const venueCity =
          normalizeOptionalString(venue.city)?.toLowerCase() ?? null

        if (venueCity !== normalizedCity) {
          return false
        }
      }

      const venueTypes = normalizeVenueTypes(venue)
      const matchingStageTypes = venueTypes.filter((type) =>
        stageTypeSet.has(normalizeStageType(type))
      )

      if (matchingStageTypes.length === 0) {
        return false
      }

      if (
        localHour < EARLIEST_MUSIC_HOUR &&
        matchingStageTypes.every(
          (type) => normalizeStageType(type) === 'music'
        )
      ) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      if (collectionDestinations.length > 0) {
        const aDestinationDistance =
          getNearestDestinationDistanceMeters(
            a,
            collectionDestinations
          )
        const bDestinationDistance =
          getNearestDestinationDistanceMeters(
            b,
            collectionDestinations
          )

        if (
          aDestinationDistance !==
          bDestinationDistance
        ) {
          return (
            aDestinationDistance -
            bDestinationDistance
          )
        }
      }

      return getStableVenueKey(a).localeCompare(
        getStableVenueKey(b)
      )
    })

  return candidates[0] ?? null
}

function getNearestDestinationDistanceMeters(
  venue: GenerateRouteFromCollectionVenue,
  destinations: GenerateRouteFromCollectionVenue[]
): number {
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const destination of destinations) {
    const distance = getDistanceMeters(
      venue,
      destination
    )

    if (distance < nearestDistance) {
      nearestDistance = distance
    }
  }

  return nearestDistance
}

function getDistanceMeters(
  fromVenue: GenerateRouteFromCollectionVenue,
  toVenue: GenerateRouteFromCollectionVenue
): number {
  if (
    !Number.isFinite(fromVenue.lat) ||
    !Number.isFinite(fromVenue.lon) ||
    !Number.isFinite(toVenue.lat) ||
    !Number.isFinite(toVenue.lon)
  ) {
    return Number.POSITIVE_INFINITY
  }

  const earthRadiusMeters = 6371000
  const fromLatRadians =
    (fromVenue.lat * Math.PI) / 180
  const toLatRadians =
    (toVenue.lat * Math.PI) / 180
  const latitudeDelta =
    ((toVenue.lat - fromVenue.lat) * Math.PI) / 180
  const longitudeDelta =
    ((toVenue.lon - fromVenue.lon) * Math.PI) / 180

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatRadians) *
      Math.cos(toLatRadians) *
      Math.sin(longitudeDelta / 2) ** 2

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )
  )
}

function buildFailedCollectionRoute({
  collection,
  context,
  city,
  travelMode,
  tightness,
  maxStops,
  includeDebug,
  warning,
}: {
  collection: CollectionRouteContextCollection
  context: ReturnType<typeof buildCollectionRouteContext>
  city: string | null
  travelMode: RouteTravelMode
  tightness: RouteTightness
  maxStops: number
  includeDebug: boolean
  warning: string
}): GeneratedRoute {
  const fallbackAnchor: RouteVenue = {
    id: `collection:${collection.id}`,
    name: collection.title,
    slug: null,
    city,
    address: null,
    lat: 0,
    lon: 0,
    type: null,
    types: null,
    venue_type: null,
    venue_types: null,
    category: null,
    categories: null,
    tags: null,
    vibe: null,
    price: null,
    hours: null,
    dayParts: null,
    image_url: null,
    link: null,
  }

  return {
    status: 'failed',
    source: 'creator_collection',
    context: {
      anchorVenueId: fallbackAnchor.id,
      anchorVenueName: fallbackAnchor.name,
      anchorTypes: [],
      city,
      plannedStartAt: context.plannedStartAt.toISOString(),
      weekdayKey: context.weekdayKey,
      localHour: context.localHour,
      travelMode,
      tightness,
      maxStops,
      maxDistanceMeters:
        context.anchorSeedContext?.maxDistanceMeters ?? 0,
      idealDistanceMeters:
        context.anchorSeedContext?.idealDistanceMeters ?? 0,
      startingStageId: context.startingStage.id,
      candidateStageIds: context.candidateStages.map(
        (stage) => stage.id
      ),
      source: 'creator_collection',
      collectionId: collection.id,
      collectionCreatorUserId: collection.creatorUserId,
      collectionTitle: collection.title,
    },
    anchorVenue: fallbackAnchor,
    stops: [],
    explanation: explainRoute({
      anchorVenue: fallbackAnchor,
      stops: [],
      startedAt: context.plannedStartAt,
      travelMode,
      city,
    }),
    totalStops: 0,
    totalDistanceMeters: 0,
    totalTravelMinutes: 0,
    totalDwellMinutes: 0,
    totalRouteMinutes: 0,
    createdAt: new Date().toISOString(),
    debug: includeDebug
      ? {
          rejectedCount: 0,
          candidateCount: 0,
          selectedCount: 0,
          collectionCandidateCount: 0,
          collectionSelectedCount: 0,
          roamFillSelectedCount: 0,
          stageAttempts: [],
          warnings: [warning],
        }
      : undefined,
  }
}

function normalizeRouteVenue(
  venue: GenerateRouteFromCollectionVenue
): RouteVenue {
  const venueKey = getVenueKey(venue) ?? 'unknown-venue'

  return {
    ...venue,
    id: venueKey,
    name: venue.name,
    slug: venue.slug ?? null,
    city: venue.city ?? null,
    address: venue.address ?? null,
    lat: venue.lat,
    lon: venue.lon,
    type: normalizeListLikeValue(venue.type),
    types: normalizeListLikeValue(venue.types),
    venue_type: normalizeListLikeValue(venue.venue_type),
    venue_types: normalizeListLikeValue(venue.venue_types),
    category: normalizeListLikeValue(venue.category),
    categories: normalizeListLikeValue(venue.categories),
    tags: normalizeListLikeValue(venue.tags),
    vibe: normalizeListLikeValue(venue.vibe),
    price: venue.price ?? null,
    hours: Array.isArray(venue.hours)
      ? venue.hours
      : venue.hours ?? null,
    dayParts: venue.dayParts ?? null,
    image_url: venue.image_url ?? null,
    link: venue.link ?? null,
  }
}

function normalizeListLikeValue(value: unknown): any {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }

    return trimmed
  }

  return value ?? null
}

function dedupeVenues(
  venues: GenerateRouteFromCollectionVenue[]
): GenerateRouteFromCollectionVenue[] {
  const seen = new Set<string>()

  return venues.filter((venue) => {
    const key = getVenueKey(venue)

    if (!key || seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function getVenueKey(
  venue:
    | {
        id?: string | null
        slug?: string | null
        name?: string | null
      }
    | null
    | undefined
): string | null {
  const id = normalizeOptionalString(venue?.id)
  if (id) return id

  const slug = normalizeOptionalString(venue?.slug)
  if (slug) return slug

  return normalizeOptionalString(venue?.name)
}

function getStableVenueKey(
  venue: GenerateRouteFromCollectionVenue
): string {
  return (
    normalizeOptionalString(venue.id) ??
    normalizeOptionalString(venue.slug) ??
    normalizeOptionalString(venue.name)?.toLowerCase() ??
    ''
  )
}

function normalizeOptionalString(
  value?: string | null
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

function normalizeDistanceForSort(
  distanceMeters: number | null
): number {
  return typeof distanceMeters === 'number' &&
    Number.isFinite(distanceMeters)
    ? distanceMeters
    : Number.POSITIVE_INFINITY
}

function sanitizeMaxStops(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_STOPS
  return Math.max(3, Math.min(8, Math.round(value)))
}