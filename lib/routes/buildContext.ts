// lib/routes/buildContext.ts

import {
  type RouteStage,
  type RouteStageId,
  getCandidateStagesAfter,
  getDayKindFromWeekday,
} from './routeStages'
import {
  inferStartingStage as inferStartingStageDetailed,
} from './inferStartingStage'
import {
  type NormalizedVenueType,
  normalizeVenueTypes,
} from './venueTypeNormalization'
import {
  coerceDate,
  getLocalDayKey,
  getLocalHour,
  hasValidCoordinates,
} from './arrivalTime'

export type RouteContextTravelMode = 'walking' | 'cycling' | 'driving'
export type RouteTightness = 'tight' | 'medium' | 'loose'

export type RouteContextVenue = {
  id?: string | null
  name?: string | null
  city?: string | null
  lat?: number | null
  lon?: number | null
  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown
  tags?: unknown
  vibe?: unknown
  price?: string | null
  hours?: unknown
  dayParts?: Record<string, string> | null
}

export type RouteContext = {
  anchorVenue: RouteContextVenue
  anchorVenueId: string | null
  anchorVenueName: string | null
  anchorTypes: NormalizedVenueType[]
  city: string | null
  plannedStartAt: Date
  weekdayKey: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  localHour: number
  travelMode: RouteContextTravelMode
  tightness: RouteTightness
  maxStops: number
  maxDistanceMeters: number
  idealDistanceMeters: number
  startingStage: RouteStage
  candidateStages: RouteStage[]
  preferredVibes: string[]
  preferredTags: string[]
  hasUsableAnchorCoordinates: boolean
}

export type BuildRouteContextParams = {
  anchorVenue: RouteContextVenue
  city?: string | null
  plannedStartAt?: Date | string | null
  travelMode?: RouteContextTravelMode
  tightness?: RouteTightness
  maxStops?: number
  preferredVibes?: string[]
  preferredTags?: string[]
}

const DEFAULT_MAX_STOPS = 5

const DISTANCE_BY_TIGHTNESS_AND_MODE: Record<
  RouteContextTravelMode,
  Record<RouteTightness, { idealDistanceMeters: number; maxDistanceMeters: number }>
> = {
  walking: {
    tight: { idealDistanceMeters: 450, maxDistanceMeters: 1200 },
    medium: { idealDistanceMeters: 700, maxDistanceMeters: 2200 },
    loose: { idealDistanceMeters: 1000, maxDistanceMeters: 3500 },
  },
  cycling: {
    tight: { idealDistanceMeters: 1200, maxDistanceMeters: 3500 },
    medium: { idealDistanceMeters: 2200, maxDistanceMeters: 6000 },
    loose: { idealDistanceMeters: 3500, maxDistanceMeters: 9000 },
  },
  driving: {
    tight: { idealDistanceMeters: 2500, maxDistanceMeters: 7000 },
    medium: { idealDistanceMeters: 4500, maxDistanceMeters: 12000 },
    loose: { idealDistanceMeters: 7000, maxDistanceMeters: 20000 },
  },
}

export function buildRouteContext({
  anchorVenue,
  city = null,
  plannedStartAt = null,
  travelMode = 'walking',
  tightness = 'medium',
  maxStops = DEFAULT_MAX_STOPS,
  preferredVibes = [],
  preferredTags = [],
}: BuildRouteContextParams): RouteContext {
  const safePlannedStartAt = coerceDate(plannedStartAt ?? new Date())
  const localHour = getLocalHour(safePlannedStartAt)
  const weekdayKey = getLocalDayKey(safePlannedStartAt)
  const dayKind = getDayKindFromWeekday(
    safePlannedStartAt.getDay() === 0 ? 7 : safePlannedStartAt.getDay()
  )
  const anchorTypes = normalizeVenueTypes(anchorVenue)

  const startingStageResult = inferStartingStageDetailed({
    anchorVenue,
    plannedStartAt: safePlannedStartAt,
  })

  const startingStage = startingStageResult.stage

  const safeMaxStops = sanitizeMaxStops(maxStops)
  const distanceConfig = DISTANCE_BY_TIGHTNESS_AND_MODE[travelMode][tightness]

  return {
    anchorVenue,
    anchorVenueId: anchorVenue.id ?? null,
    anchorVenueName: anchorVenue.name ?? null,
    anchorTypes,
    city: city ?? anchorVenue.city ?? null,
    plannedStartAt: safePlannedStartAt,
    weekdayKey,
    localHour,
    travelMode,
    tightness,
    maxStops: safeMaxStops,
    maxDistanceMeters: distanceConfig.maxDistanceMeters,
    idealDistanceMeters: distanceConfig.idealDistanceMeters,
    startingStage,
    candidateStages: getCandidateStagesForContext({
      startingStage,
      localHour,
      maxStops: safeMaxStops,
      dayKind,
    }),
    preferredVibes,
    preferredTags,
    hasUsableAnchorCoordinates: hasValidCoordinates(anchorVenue),
  }
}

export function inferStartingStage({
  anchorTypes,
  plannedStartAt,
}: {
  anchorTypes: NormalizedVenueType[]
  plannedStartAt: Date | string
}): RouteStage {
  return inferStartingStageDetailed({
    anchorVenue: {
      types: anchorTypes,
    },
    plannedStartAt,
  }).stage
}

export function getCandidateStagesForContext({
  startingStage,
  localHour,
  maxStops,
  dayKind = null,
}: {
  startingStage: RouteStage
  localHour: number
  maxStops: number
  dayKind?: 'weekday' | 'weekend' | null
}): RouteStage[] {
  const stagesAfterCurrent = getCandidateStagesAfter({
    stageId: startingStage.id as RouteStageId,
    maxStages: Math.max(1, maxStops - 1),
    includeCurrentStage: false,
    dayKind,
    startHour: localHour,
  })

  const timeRelevantStages = stagesAfterCurrent.filter((stage) => {
    if (stage.preferredEndHour < stage.preferredStartHour) {
      return true
    }

    return stage.preferredEndHour >= localHour
  })

  return timeRelevantStages.length > 0
    ? timeRelevantStages.slice(0, Math.max(1, maxStops - 1))
    : stagesAfterCurrent
}

export function getContextSummary(context: RouteContext): string {
  return [
    context.anchorVenueName
      ? `Starting from ${context.anchorVenueName}`
      : 'Starting from selected venue',
    `around ${formatHour(context.localHour)}`,
    `with ${context.travelMode} travel`,
    `using a ${context.tightness} route radius`,
  ].join(' ')
}

function sanitizeMaxStops(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_STOPS
  return Math.max(2, Math.min(8, Math.round(value)))
}

function formatHour(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM'
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12

  return `${displayHour}${suffix}`
}