// lib/routes/generateRouteFromVenue.ts

import { buildRouteContext } from './buildContext'
import { estimateArrivalTime } from './arrivalTime'
import {
  filterRouteCandidates,
  summarizeRejections,
} from './candidateFilter'
import { explainRoute } from './explainRoute'
import { scorePersonalization, type UserRoutePersonalization } from './personalization'
import { scoreVenue } from './scoreVenue'
import { normalizeVenueTypes } from './venueTypeNormalization'
import type {
  GeneratedRoute,
  RouteGenerationDebug,
  RouteGenerationSource,
  RouteStop,
  RouteTightness,
  RouteTravelMode,
  RouteVenue,
} from '@/types/route'

export type GenerateRouteFromVenueVenue = Omit<RouteVenue, 'id'> & {
  id?: string | null
  is_active?: boolean | null
  active?: boolean | null
  permanently_closed?: boolean | null
  closed?: boolean | null
}

export type GenerateRouteFromVenueParams = {
  anchorVenue: GenerateRouteFromVenueVenue
  venues: GenerateRouteFromVenueVenue[]
  city?: string | null
  plannedStartAt?: Date | string | null
  travelMode?: RouteTravelMode
  tightness?: RouteTightness
  maxStops?: number
  source?: RouteGenerationSource
  preferredVibes?: string[]
  preferredTags?: string[]
  personalization?: UserRoutePersonalization | null
  includeDebug?: boolean
  timezone?: string | null
}

const DEFAULT_MAX_STOPS = 5

export function generateRouteFromVenue({
  anchorVenue,
  venues,
  city = null,
  plannedStartAt = null,
  travelMode = 'walking',
  tightness = 'medium',
  maxStops = DEFAULT_MAX_STOPS,
  source = 'api',
  preferredVibes = [],
  preferredTags = [],
  personalization = null,
  includeDebug = true,
  timezone = null,
}: GenerateRouteFromVenueParams): GeneratedRoute {
  const safeMaxStops = sanitizeMaxStops(maxStops)
  const anchorKey = getVenueKey(anchorVenue) ?? 'anchor'
  const selectedVenueIds = new Set<string>([anchorKey])
  const selectedStops: RouteStop[] = []

  const context = buildRouteContext({
    anchorVenue,
    city: city ?? anchorVenue.city ?? null,
    plannedStartAt: plannedStartAt ?? new Date().toISOString(),
    travelMode,
    tightness,
    maxStops: safeMaxStops,
    preferredVibes:
      preferredVibes.length > 0
        ? preferredVibes
        : personalization?.preferredVibes ?? [],
    preferredTags:
      preferredTags.length > 0
        ? preferredTags
        : personalization?.interestCategories ?? [],
  })

  let previousStop: GenerateRouteFromVenueVenue = anchorVenue
  let currentStartAt: Date | string = context.plannedStartAt

  let totalDistanceMeters = 0
  let totalTravelMinutes = 0
  let totalDwellMinutes = 0
  let rejectedCount = 0
  let candidateCount = 0

  const stageAttempts: NonNullable<RouteGenerationDebug['stageAttempts']> = []
  const warnings: string[] = []

  for (const stage of context.candidateStages) {
    if (selectedStops.length >= safeMaxStops - 1) break

    const arrivalSeed = estimateArrivalTime({
      fromVenue: previousStop,
      toVenue: previousStop,
      startAt: currentStartAt,
      dwellMinutes: selectedStops.length === 0 ? 0 : stage.dwellMinutes,
      travelMode,
    })

    const passes = [
      {
        label: 'strict',
        requireStageMatch: true,
        excludeLikelyClosed: true,
        maxDistanceMeters: context.maxDistanceMeters,
      },
      {
        label: 'relaxed_stage',
        requireStageMatch: false,
        excludeLikelyClosed: true,
        maxDistanceMeters: context.maxDistanceMeters,
      },
      {
        label: 'wider_fallback',
        requireStageMatch: false,
        excludeLikelyClosed: true,
        maxDistanceMeters: Math.round(context.maxDistanceMeters * 1.5),
      },
    ]

    let selected: any = null
    let selectedPass: string | null = null
    const passDebug: NonNullable<
      NonNullable<RouteGenerationDebug['stageAttempts']>[number]['passes']
    > = []

    for (const pass of passes) {
      const { candidates, rejected } = filterRouteCandidates({
        venues,
        anchorVenue,
        previousStop,
        stage,
        arrivalAt: arrivalSeed.arriveAt,
        selectedVenueIds,
        travelMode,
        maxDistanceMeters: pass.maxDistanceMeters,
        requireStageMatch: pass.requireStageMatch,
        excludeLikelyClosed: pass.excludeLikelyClosed,
        timezone,
      })

      rejectedCount += rejected.length
      candidateCount += candidates.length

      const scoredCandidates = candidates
        .filter((candidate) => {
          const candidateKey = getVenueKey(candidate)
          return candidateKey ? !selectedVenueIds.has(candidateKey) : false
        })
        .map((candidate) => {
          const arrivalEstimate = estimateArrivalTime({
            fromVenue: previousStop,
            toVenue: candidate,
            startAt: currentStartAt,
            dwellMinutes: selectedStops.length === 0 ? 0 : stage.dwellMinutes,
            travelMode,
          })

          const baseScore = scoreVenue({
            candidate,
            previousStop,
            anchorVenue,
            stage,
            arrivalAt: arrivalEstimate.arriveAt,
            travelMode,
            selectedVenueIds,
            previousRouteTypes: selectedStops.flatMap((stop) => stop.candidateTypes),
            preferredVibes: context.preferredVibes,
            preferredTags: context.preferredTags,
            maxDistanceMeters: pass.maxDistanceMeters,
            idealDistanceMeters: context.idealDistanceMeters,
            timezone,
          })

          const personalizationScore = scorePersonalization({
            venue: candidate,
            personalization,
          })

          return {
            candidate,
            arrivalEstimate,
            baseScore,
            personalizationScore,
            finalScore: baseScore.score + personalizationScore.score,
          }
        })
        .sort((a, b) => b.finalScore - a.finalScore)

      const top = scoredCandidates[0] ?? null

      passDebug.push({
        pass: pass.label,
        candidateCount: candidates.length,
        rejectedCount: rejected.length,
        rejectionCounts: summarizeRejections(rejected),
        topScore: top?.finalScore ?? null,
        topVenueId: getVenueKey(top?.candidate) ?? null,
        topVenueName: top?.candidate.name ?? null,
      })

      if (top && top.finalScore >= 0) {
        selected = top
        selectedPass = pass.label
        break
      }
    }

    const selectedCandidateKey = getVenueKey(selected?.candidate)

    stageAttempts.push({
      stageId: stage.id,
      stageLabel: stage.label,
      candidateCount: passDebug.reduce((sum, pass) => sum + pass.candidateCount, 0),
      selectedVenueId: selectedCandidateKey,
      selectedVenueName: selected?.candidate.name ?? null,
      selectedPass,
      passes: passDebug,
    })

    if (!selected || selected.finalScore < 0) {
      warnings.push(`No strong candidate selected for ${stage.label}.`)
      continue
    }

    if (!selectedCandidateKey) continue

    selectedVenueIds.add(selectedCandidateKey)

    const selectedCandidate = selected.candidate as GenerateRouteFromVenueVenue

    const routeStop: RouteStop = {
      id: `${anchorKey}-${selectedCandidateKey}-${selectedStops.length + 1}`,
      stopOrder: selectedStops.length + 2,
      venue: normalizeRouteVenue(selectedCandidate),
      stageId: stage.id,
      stageLabel: stage.label,
      arriveAt: selected.arrivalEstimate.arriveAt.toISOString(),
      departAt: selected.arrivalEstimate.departAt.toISOString(),
      dwellMinutes: selected.arrivalEstimate.dwellMinutes,
      travelMinutesFromPrevious: selected.arrivalEstimate.travelMinutes,
      distanceMetersFromPrevious: selected.arrivalEstimate.distanceMeters,
      score: selected.finalScore,
      normalizedScore: selected.baseScore.normalizedScore,
      openConfidence: selected.baseScore.openConfidence,
      candidateTypes: selected.baseScore.candidateTypes,
      reasons: selected.baseScore.reasons,
      personalizationReasons: selected.personalizationScore.reasons,
    }

    selectedStops.push(routeStop)

    totalDistanceMeters += selected.arrivalEstimate.distanceMeters ?? 0
    totalTravelMinutes += selected.arrivalEstimate.travelMinutes
    totalDwellMinutes += selected.arrivalEstimate.dwellMinutes

    previousStop = selectedCandidate
    currentStartAt = selected.arrivalEstimate.arriveAt
  }

  const anchorStop: RouteStop = {
    id: `${anchorKey}-anchor`,
    stopOrder: 1,
    venue: normalizeRouteVenue(anchorVenue),
    stageId: context.startingStage.id,
    stageLabel: context.startingStage.label,
    arriveAt: context.plannedStartAt.toISOString(),
    departAt: context.plannedStartAt.toISOString(),
    dwellMinutes: context.startingStage.dwellMinutes,
    travelMinutesFromPrevious: null,
    distanceMetersFromPrevious: null,
    score: 100,
    normalizedScore: 100,
    openConfidence: 'unknown',
    candidateTypes: normalizeVenueTypes(anchorVenue),
    reasons: [],
    personalizationReasons: [],
  }

  const stops = [anchorStop, ...selectedStops]

  const explanation = explainRoute({
    anchorVenue,
    stops: selectedStops.map((stop) => ({
      venue: stop.venue,
      stage: context.candidateStages.find((stage) => stage.id === stop.stageId),
      arriveAt: stop.arriveAt,
      departAt: stop.departAt,
      dwellMinutes: stop.dwellMinutes,
      travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
      distanceMetersFromPrevious: stop.distanceMetersFromPrevious,
      score: stop.score,
      reasons: stop.reasons,
    })),
    startedAt: context.plannedStartAt,
    travelMode,
    city: city ?? anchorVenue.city ?? null,
  })

  return {
    status: selectedStops.length > 0 ? 'success' : 'failed',
    source,
    context: {
      anchorVenueId: anchorKey,
      anchorVenueName: anchorVenue.name,
      anchorTypes: context.anchorTypes,
      city: city ?? anchorVenue.city ?? null,
      plannedStartAt: context.plannedStartAt.toISOString(),
      weekdayKey: context.weekdayKey,
      localHour: context.localHour,
      travelMode,
      tightness,
      maxStops: safeMaxStops,
      maxDistanceMeters: context.maxDistanceMeters,
      idealDistanceMeters: context.idealDistanceMeters,
      startingStageId: context.startingStage.id,
      candidateStageIds: context.candidateStages.map((stage) => stage.id),
      source,
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
          stageAttempts,
          warnings:
            selectedStops.length === 0
              ? ['No strong contextual stops were selected.', ...warnings]
              : warnings,
        }
      : undefined,
  }
}

function normalizeRouteVenue(venue: GenerateRouteFromVenueVenue): RouteVenue {
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
    hours: Array.isArray(venue.hours) ? venue.hours : venue.hours ?? null,
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

function getVenueKey(venue: {
  id?: string | null
  slug?: string | null
  name?: string | null
} | null | undefined) {
  return venue?.id ?? venue?.slug ?? venue?.name ?? null
}

function sanitizeMaxStops(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_STOPS
  return Math.max(3, Math.min(8, Math.round(value)))
}