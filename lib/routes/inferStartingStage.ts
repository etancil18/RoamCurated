// lib/routes/inferStartingStage.ts

import {
  ROUTE_STAGES,
  type RouteStage,
  getRouteStageForHour,
  isHourWithinStageWindow,
  getDayKindFromWeekday,
} from './routeStages'
import {
  type NormalizedVenueType,
  normalizeVenueTypes,
} from './venueTypeNormalization'
import { coerceDate } from './arrivalTime'

export type InferStartingStageVenue = {
  id?: string | null
  name?: string | null
  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown
}

export type InferStartingStageResult = {
  stage: RouteStage
  confidence: 'high' | 'medium' | 'low'
  reason: string
  anchorTypes: NormalizedVenueType[]
}

export function inferStartingStage({
  anchorVenue,
  plannedStartAt = new Date(),
}: {
  anchorVenue: InferStartingStageVenue
  plannedStartAt?: Date | string | null
}): InferStartingStageResult {
  const date = coerceDate(plannedStartAt ?? new Date())
  const hour = date.getHours()
  const dayKind = getDayKindFromWeekday(date.getDay() === 0 ? 7 : date.getDay())
  const anchorTypes = normalizeVenueTypes(anchorVenue)

  if (anchorTypes.length === 0) {
    return {
      stage: getRouteStageForHour(hour),
      confidence: 'low',
      reason: 'No usable venue type found, so Roam inferred the starting stage from time of day.',
      anchorTypes,
    }
  }

  const typeMatchedStages = ROUTE_STAGES.filter((stage) =>
    stage.types.some((stageType) =>
      anchorTypes.some((type) => normalizeKey(type) === normalizeKey(stageType))
    )
  ).filter((stage) => stageAllowedForContext(stage, hour, dayKind))

  if (typeMatchedStages.length === 0) {
    return {
      stage: getRouteStageForHour(hour),
      confidence: 'low',
      reason: 'Venue type did not match a contextual route stage, so Roam inferred the starting stage from time of day.',
      anchorTypes,
    }
  }

  const timeAndTypeMatchedStages = typeMatchedStages
    .filter((stage) => isHourWithinStageWindow(hour, stage))
    .sort((a, b) => {
      const aDistance = getHourDistanceToStageWindow(hour, a)
      const bDistance = getHourDistanceToStageWindow(hour, b)

      if (aDistance !== bDistance) return aDistance - bDistance

      return a.order - b.order
    })

  if (timeAndTypeMatchedStages[0]) {
    return {
      stage: timeAndTypeMatchedStages[0],
      confidence: 'high',
      reason: `Venue type, arrival time, and ${dayKind} context fit ${timeAndTypeMatchedStages[0].label}.`,
      anchorTypes,
    }
  }

  const nearestStage = getNearestStageByTime(typeMatchedStages, hour)

  if (nearestStage) {
    return {
      stage: nearestStage,
      confidence: 'medium',
      reason: `Venue type fits ${nearestStage.label}, adjusted for ${dayKind} context and selected time.`,
      anchorTypes,
    }
  }

  return {
    stage: getRouteStageForHour(hour),
    confidence: 'low',
    reason: 'Roam could not confidently match the venue to a stage, so it used the current time of day.',
    anchorTypes,
  }
}

export function inferStartingStageOnly(params: {
  anchorVenue: InferStartingStageVenue
  plannedStartAt?: Date | string | null
}): RouteStage {
  return inferStartingStage(params).stage
}

function stageAllowedForContext(
  stage: RouteStage,
  hour: number,
  dayKind: 'weekday' | 'weekend'
): boolean {
  const normalizedHour = normalizeHour(hour)

  if (stage.id === 'night_out' && normalizedHour < 17) return false
  if (stage.id === 'dinner' && normalizedHour < 14) return false
  if (stage.id === 'early_evening' && normalizedHour < 13) return false

  if (dayKind === 'weekday') {
    if (stage.id === 'night_out' && normalizedHour < 18) return false
  }

  return true
}

function getNearestStageByTime(stages: RouteStage[], hour: number) {
  return [...stages].sort((a, b) => {
    const aDistance = getHourDistanceToStageWindow(hour, a)
    const bDistance = getHourDistanceToStageWindow(hour, b)

    if (aDistance !== bDistance) return aDistance - bDistance

    return a.order - b.order
  })[0] ?? null
}

function getHourDistanceToStageWindow(hour: number, stage: RouteStage) {
  const normalizedHour = normalizeHour(hour)
  const start = normalizeHour(stage.preferredStartHour)
  const end = normalizeHour(stage.preferredEndHour)

  if (isHourWithinStageWindow(normalizedHour, stage)) return 0

  const distanceToStart = circularHourDistance(normalizedHour, start)
  const distanceToEnd = circularHourDistance(normalizedHour, end)

  return Math.min(distanceToStart, distanceToEnd)
}

function circularHourDistance(fromHour: number, toHour: number) {
  const forward = (toHour - fromHour + 24) % 24
  const backward = (fromHour - toHour + 24) % 24

  return Math.min(forward, backward)
}

function normalizeHour(hour: number) {
  if (!Number.isFinite(hour)) return 0
  return ((Math.floor(hour) % 24) + 24) % 24
}

function normalizeKey(value: string) {
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