// lib/routes/scoreVenue.ts

import type { RouteStage } from './routeStages'
import {
  getStageTypeSet,
  isHourWithinStageWindow,
  normalizeStageType,
} from './routeStages'
import {
  type NormalizedVenueType,
  hasAnyVenueType,
  isCultureType,
  isDrinkType,
  isMealType,
  isOutdoorType,
  isWellnessType,
  normalizeVenueTypes,
} from './venueTypeNormalization'

export type ScoreVenueTravelMode = 'walking' | 'cycling' | 'driving'

export type ScoreVenueInputVenue = {
  id?: string | null
  name?: string | null
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

export type VenueScoreReason = {
  key:
    | 'stage_fit'
    | 'open_at_arrival'
    | 'time_fit'
    | 'distance'
    | 'vibe_match'
    | 'tag_match'
    | 'price_match'
    | 'category_progression'
    | 'duplicate_type_penalty'
    | 'route_backtrack_penalty'
    | 'missing_coordinates'
    | 'same_venue'
  label: string
  delta: number
}

export type VenueScoreResult = {
  score: number
  normalizedScore: number
  reasons: VenueScoreReason[]
  distanceMeters: number | null
  estimatedTravelMinutes: number | null
  candidateTypes: NormalizedVenueType[]
  openConfidence: OpenConfidence
}

export type OpenConfidence = 'confirmed_open' | 'likely_open' | 'unknown' | 'likely_closed'

export type ScoreVenueParams = {
  candidate: ScoreVenueInputVenue
  previousStop: ScoreVenueInputVenue | null
  anchorVenue?: ScoreVenueInputVenue | null
  stage: RouteStage
  arrivalAt: Date
  travelMode?: ScoreVenueTravelMode
  selectedVenueIds?: Set<string>
  previousRouteTypes?: string[]
  preferredVibes?: string[]
  preferredTags?: string[]
  maxDistanceMeters?: number
  idealDistanceMeters?: number
}

const DEFAULT_MAX_DISTANCE_METERS_BY_MODE: Record<ScoreVenueTravelMode, number> = {
  walking: 1800,
  cycling: 4500,
  driving: 9000,
}

const DEFAULT_IDEAL_DISTANCE_METERS_BY_MODE: Record<ScoreVenueTravelMode, number> = {
  walking: 650,
  cycling: 1800,
  driving: 3500,
}

const SCORE_BOUNDS = {
  min: -60,
  max: 140,
}

export function scoreVenue({
  candidate,
  previousStop,
  anchorVenue = null,
  stage,
  arrivalAt,
  travelMode = 'walking',
  selectedVenueIds = new Set<string>(),
  previousRouteTypes = [],
  preferredVibes = [],
  preferredTags = [],
  maxDistanceMeters = DEFAULT_MAX_DISTANCE_METERS_BY_MODE[travelMode],
  idealDistanceMeters = DEFAULT_IDEAL_DISTANCE_METERS_BY_MODE[travelMode],
}: ScoreVenueParams): VenueScoreResult {
  const reasons: VenueScoreReason[] = []
  const candidateId = candidate.id ?? null
  const previousId = previousStop?.id ?? null

  if (candidateId && selectedVenueIds.has(candidateId)) {
    reasons.push({
      key: 'same_venue',
      label: 'Already selected for this route.',
      delta: -100,
    })

    return buildScoreResult({
      rawScore: -100,
      reasons,
      distanceMeters: null,
      estimatedTravelMinutes: null,
      candidateTypes: normalizeVenueTypes(candidate),
      openConfidence: 'unknown',
    })
  }

  if (candidateId && previousId && candidateId === previousId) {
    reasons.push({
      key: 'same_venue',
      label: 'Same venue as the previous stop.',
      delta: -100,
    })

    return buildScoreResult({
      rawScore: -100,
      reasons,
      distanceMeters: null,
      estimatedTravelMinutes: null,
      candidateTypes: normalizeVenueTypes(candidate),
      openConfidence: 'unknown',
    })
  }

  if (!hasValidCoordinates(candidate)) {
    reasons.push({
      key: 'missing_coordinates',
      label: 'Missing usable coordinates.',
      delta: -90,
    })

    return buildScoreResult({
      rawScore: -90,
      reasons,
      distanceMeters: null,
      estimatedTravelMinutes: null,
      candidateTypes: normalizeVenueTypes(candidate),
      openConfidence: 'unknown',
    })
  }

  const candidateTypes = normalizeVenueTypes(candidate)
  const previousTypes = previousStop ? normalizeVenueTypes(previousStop) : []
  const anchorTypes = anchorVenue ? normalizeVenueTypes(anchorVenue) : []
  const stageFit = scoreStageFit(candidateTypes, stage)

  reasons.push({
    key: 'stage_fit',
    label:
      stageFit > 0
        ? `Fits the ${stage.shortLabel || stage.label} stage.`
        : `Weak fit for the ${stage.shortLabel || stage.label} stage.`,
    delta: stageFit,
  })

  const openConfidence = inferOpenConfidence(candidate, arrivalAt)
  const openScore = scoreOpenConfidence(openConfidence)

  reasons.push({
    key: 'open_at_arrival',
    label: getOpenConfidenceLabel(openConfidence),
    delta: openScore,
  })

  const hour = arrivalAt.getHours()
  const timeScore = isHourWithinStageWindow(hour, stage) ? 14 : -8

  reasons.push({
    key: 'time_fit',
    label:
      timeScore > 0
        ? 'Arrival time fits this type of stop.'
        : 'Arrival time is slightly outside the preferred window.',
    delta: timeScore,
  })

  const distanceMeters =
    previousStop && hasValidCoordinates(previousStop)
      ? calculateDistanceMeters({
          fromLat: previousStop.lat as number,
          fromLon: previousStop.lon as number,
          toLat: candidate.lat as number,
          toLon: candidate.lon as number,
        })
      : anchorVenue && hasValidCoordinates(anchorVenue)
        ? calculateDistanceMeters({
            fromLat: anchorVenue.lat as number,
            fromLon: anchorVenue.lon as number,
            toLat: candidate.lat as number,
            toLon: candidate.lon as number,
          })
        : null

  const distanceScore =
    distanceMeters === null
      ? 0
      : scoreDistance({
          distanceMeters,
          maxDistanceMeters,
          idealDistanceMeters,
        })

  reasons.push({
    key: 'distance',
    label:
      distanceMeters === null
        ? 'No distance comparison available.'
        : distanceScore >= 0
          ? 'Distance works for this route.'
          : 'Distance is less ideal for this route.',
    delta: distanceScore,
  })

  const estimatedTravelMinutes =
    distanceMeters === null
      ? null
      : estimateTravelMinutes(distanceMeters, travelMode)

  const vibeScore = scoreListOverlap({
    candidateValue: candidate.vibe,
    referenceValues: [
      ...extractSearchableValues(previousStop?.vibe),
      ...extractSearchableValues(anchorVenue?.vibe),
      ...preferredVibes,
    ],
    maxScore: 16,
  })

  if (vibeScore !== 0) {
    reasons.push({
      key: 'vibe_match',
      label: 'Vibe matches the route context.',
      delta: vibeScore,
    })
  }

  const tagScore = scoreListOverlap({
    candidateValue: candidate.tags,
    referenceValues: [
      ...extractSearchableValues(previousStop?.tags),
      ...extractSearchableValues(anchorVenue?.tags),
      ...preferredTags,
    ],
    maxScore: 12,
  })

  if (tagScore !== 0) {
    reasons.push({
      key: 'tag_match',
      label: 'Tags match nearby route context.',
      delta: tagScore,
    })
  }

  const priceScore = scorePriceCompatibility(candidate.price, previousStop?.price ?? anchorVenue?.price)

  if (priceScore !== 0) {
    reasons.push({
      key: 'price_match',
      label:
        priceScore > 0
          ? 'Price tier feels consistent with the route.'
          : 'Price tier is a jump from the surrounding route.',
      delta: priceScore,
    })
  }

  const progressionScore = scoreCategoryProgression({
    candidateTypes,
    previousTypes,
    anchorTypes,
    stage,
  })

  if (progressionScore !== 0) {
    reasons.push({
      key: 'category_progression',
      label:
        progressionScore > 0
          ? 'Creates a natural progression from the previous stop.'
          : 'Feels repetitive after the previous stop.',
      delta: progressionScore,
    })
  }

  const duplicatePenalty = scoreDuplicateTypePenalty({
    candidateTypes,
    previousRouteTypes,
  })

  if (duplicatePenalty !== 0) {
    reasons.push({
      key: 'duplicate_type_penalty',
      label: 'Penalized for repeating similar venue types too often.',
      delta: duplicatePenalty,
    })
  }

  const backtrackPenalty =
    previousStop && anchorVenue && hasValidCoordinates(previousStop) && hasValidCoordinates(anchorVenue)
      ? scoreBacktrackPenalty({
          candidate,
          previousStop,
          anchorVenue,
        })
      : 0

  if (backtrackPenalty !== 0) {
    reasons.push({
      key: 'route_backtrack_penalty',
      label: 'Penalized for pulling the route backward.',
      delta: backtrackPenalty,
    })
  }

  const rawScore = reasons.reduce((sum, reason) => sum + reason.delta, 0)

  return buildScoreResult({
    rawScore,
    reasons,
    distanceMeters,
    estimatedTravelMinutes,
    candidateTypes,
    openConfidence,
  })
}

function scoreStageFit(candidateTypes: NormalizedVenueType[], stage: RouteStage) {
  const stageTypeSet = getStageTypeSet(stage)
  const directMatches = candidateTypes.filter((type) =>
    stageTypeSet.has(normalizeStageType(type))
  )

  if (directMatches.length > 0) {
    return Math.min(42, 28 + directMatches.length * 7)
  }

  const stageTypes = Array.from(stageTypeSet)

  if (
    stageTypes.some((type) => ['lunch', 'dinner', 'breakfast', 'brunch', 'restaurant'].includes(type)) &&
    candidateTypes.some(isMealType)
  ) {
    return 18
  }

  if (
    stageTypes.some((type) => ['bar', 'cocktail', 'wine_bar', 'lounge'].includes(type)) &&
    candidateTypes.some(isDrinkType)
  ) {
    return 18
  }

  if (
    stageTypes.some((type) => ['gallery', 'museum', 'bookstore', 'park'].includes(type)) &&
    candidateTypes.some((type) => isCultureType(type) || isOutdoorType(type))
  ) {
    return 16
  }

  if (
    stageTypes.some((type) => ['fitness', 'wellness', 'yoga'].includes(type)) &&
    candidateTypes.some(isWellnessType)
  ) {
    return 16
  }

  return -14
}

function scoreOpenConfidence(openConfidence: OpenConfidence) {
  switch (openConfidence) {
    case 'confirmed_open':
      return 34
    case 'likely_open':
      return 18
    case 'unknown':
      return -2
    case 'likely_closed':
      return -42
  }
}

function getOpenConfidenceLabel(openConfidence: OpenConfidence) {
  switch (openConfidence) {
    case 'confirmed_open':
      return 'Expected to be open when you arrive.'
    case 'likely_open':
      return 'Likely open around your arrival time.'
    case 'unknown':
      return 'Opening hours are unknown.'
    case 'likely_closed':
      return 'Likely closed around your arrival time.'
  }
}

function scoreDistance({
  distanceMeters,
  maxDistanceMeters,
  idealDistanceMeters,
}: {
  distanceMeters: number
  maxDistanceMeters: number
  idealDistanceMeters: number
}) {
  if (!Number.isFinite(distanceMeters)) return 0

  if (distanceMeters <= idealDistanceMeters) {
    return 24
  }

  if (distanceMeters <= maxDistanceMeters) {
    const overIdeal = distanceMeters - idealDistanceMeters
    const range = Math.max(1, maxDistanceMeters - idealDistanceMeters)
    return Math.round(24 - (overIdeal / range) * 28)
  }

  const overMax = distanceMeters - maxDistanceMeters
  const penalty = Math.min(36, Math.round(overMax / 150))

  return -18 - penalty
}

function scoreCategoryProgression({
  candidateTypes,
  previousTypes,
  anchorTypes,
  stage,
}: {
  candidateTypes: NormalizedVenueType[]
  previousTypes: NormalizedVenueType[]
  anchorTypes: NormalizedVenueType[]
  stage: RouteStage
}) {
  if (previousTypes.length === 0 && anchorTypes.length === 0) return 0

  const previousMeal = previousTypes.some(isMealType)
  const previousDrink = previousTypes.some(isDrinkType)
  const previousCulture = previousTypes.some(isCultureType)
  const previousWellness = previousTypes.some(isWellnessType)

  const candidateMeal = candidateTypes.some(isMealType)
  const candidateDrink = candidateTypes.some(isDrinkType)
  const candidateCulture = candidateTypes.some(isCultureType)
  const candidateOutdoor = candidateTypes.some(isOutdoorType)
  const candidateWellness = candidateTypes.some(isWellnessType)

  if (previousMeal && (candidateCulture || candidateOutdoor)) return 14
  if (previousMeal && candidateDrink && stage.order >= 8) return 16
  if ((previousCulture || previousWellness) && candidateMeal) return 10
  if (previousDrink && candidateMeal && stage.order <= 9) return 8
  if (previousDrink && candidateDrink) return -10
  if (previousMeal && candidateMeal) return -12
  if (previousWellness && candidateWellness) return -8

  return 4
}

function scoreDuplicateTypePenalty({
  candidateTypes,
  previousRouteTypes,
}: {
  candidateTypes: NormalizedVenueType[]
  previousRouteTypes: string[]
}) {
  if (candidateTypes.length === 0 || previousRouteTypes.length === 0) return 0

  const previous = previousRouteTypes.map((type) => normalizeStageType(type))
  const candidate = candidateTypes.map((type) => normalizeStageType(type))

  const duplicateCount = candidate.filter((type) => previous.includes(type)).length

  if (duplicateCount === 0) return 0

  return -Math.min(24, duplicateCount * 8)
}

function scoreBacktrackPenalty({
  candidate,
  previousStop,
  anchorVenue,
}: {
  candidate: ScoreVenueInputVenue
  previousStop: ScoreVenueInputVenue
  anchorVenue: ScoreVenueInputVenue
}) {
  if (!hasValidCoordinates(candidate)) return 0

  const previousDistanceFromAnchor = calculateDistanceMeters({
    fromLat: anchorVenue.lat as number,
    fromLon: anchorVenue.lon as number,
    toLat: previousStop.lat as number,
    toLon: previousStop.lon as number,
  })

  const candidateDistanceFromAnchor = calculateDistanceMeters({
    fromLat: anchorVenue.lat as number,
    fromLon: anchorVenue.lon as number,
    toLat: candidate.lat as number,
    toLon: candidate.lon as number,
  })

  if (candidateDistanceFromAnchor + 250 < previousDistanceFromAnchor) {
    return -10
  }

  return 0
}

function scoreListOverlap({
  candidateValue,
  referenceValues,
  maxScore,
}: {
  candidateValue: unknown
  referenceValues: string[]
  maxScore: number
}) {
  const candidateValues = extractSearchableValues(candidateValue).map(normalizeSearchKey)
  const references = referenceValues.map(normalizeSearchKey).filter(Boolean)

  if (candidateValues.length === 0 || references.length === 0) return 0

  const matches = candidateValues.filter((value) => references.includes(value)).length

  if (matches === 0) return 0

  return Math.min(maxScore, matches * 4)
}

function scorePriceCompatibility(
  candidatePrice?: string | null,
  referencePrice?: string | null
) {
  const candidateRank = priceRank(candidatePrice)
  const referenceRank = priceRank(referencePrice)

  if (!candidateRank || !referenceRank) return 0

  const diff = Math.abs(candidateRank - referenceRank)

  if (diff === 0) return 6
  if (diff === 1) return 3
  if (diff === 2) return -4

  return -8
}

function priceRank(value?: string | null) {
  if (!value) return null

  const normalized = value.trim()

  if (normalized === '$') return 1
  if (normalized === '$$') return 2
  if (normalized === '$$$') return 3
  if (normalized === '$$$$') return 4

  return null
}

function inferOpenConfidence(
  venue: ScoreVenueInputVenue,
  arrivalAt: Date
): OpenConfidence {
  const dayParts = venue.dayParts

  if (dayParts && typeof dayParts === 'object') {
    const dayKey = getDayKey(arrivalAt)
    const dayPart = dayParts[dayKey]

    if (typeof dayPart === 'string' && dayPart.trim().length > 0) {
      return 'likely_open'
    }
  }

  if (!Array.isArray(venue.hours)) {
    return 'unknown'
  }

  const dayName = arrivalAt.toLocaleDateString('en-US', { weekday: 'long' })
  const todayLine = venue.hours.find(
    (line) =>
      typeof line === 'string' &&
      line.toLowerCase().startsWith(dayName.toLowerCase())
  )

  if (!todayLine || typeof todayLine !== 'string') {
    return 'unknown'
  }

  const lower = todayLine.toLowerCase()

  if (lower.includes('closed')) {
    return 'likely_closed'
  }

  const hourRanges = parseHourRanges(todayLine)

  if (hourRanges.length === 0) {
    return 'unknown'
  }

  const arrivalMinutes = arrivalAt.getHours() * 60 + arrivalAt.getMinutes()

  const isOpen = hourRanges.some(({ startMinutes, endMinutes }) => {
    if (startMinutes <= endMinutes) {
      return arrivalMinutes >= startMinutes && arrivalMinutes <= endMinutes
    }

    return arrivalMinutes >= startMinutes || arrivalMinutes <= endMinutes
  })

  return isOpen ? 'confirmed_open' : 'likely_closed'
}

function parseHourRanges(line: string): Array<{
  startMinutes: number
  endMinutes: number
}> {
  const afterColon = line.includes(':')
    ? line.split(':').slice(1).join(':')
    : line

  const ranges = afterColon
    .split(/,|;/)
    .map((part) => part.trim())
    .filter(Boolean)

  return ranges
    .map((range) => {
      const match = range.match(
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
      )

      if (!match) return null

      const [, startHourRaw, startMinuteRaw, startMeridiemRaw, endHourRaw, endMinuteRaw, endMeridiemRaw] = match

      const endMeridiem = endMeridiemRaw?.toLowerCase()
      const startMeridiem =
        startMeridiemRaw?.toLowerCase() ??
        inferStartMeridiem(Number(startHourRaw), Number(endHourRaw), endMeridiem)

      const startMinutes = toMinutes({
        hour: Number(startHourRaw),
        minute: Number(startMinuteRaw ?? 0),
        meridiem: startMeridiem,
      })

      const endMinutes = toMinutes({
        hour: Number(endHourRaw),
        minute: Number(endMinuteRaw ?? 0),
        meridiem: endMeridiem ?? startMeridiem,
      })

      return {
        startMinutes,
        endMinutes,
      }
    })
    .filter(
      (
        value
      ): value is {
        startMinutes: number
        endMinutes: number
      } => Boolean(value)
    )
}

function inferStartMeridiem(
  startHour: number,
  endHour: number,
  endMeridiem?: string
) {
  if (endMeridiem === 'am') return 'am'
  if (endMeridiem === 'pm') {
    if (startHour <= endHour && startHour !== 12) return 'pm'
    return 'am'
  }

  return startHour >= 7 && startHour <= 11 ? 'am' : 'pm'
}

function toMinutes({
  hour,
  minute,
  meridiem,
}: {
  hour: number
  minute: number
  meridiem?: string
}) {
  let normalizedHour = hour

  if (meridiem === 'am') {
    normalizedHour = hour === 12 ? 0 : hour
  }

  if (meridiem === 'pm') {
    normalizedHour = hour === 12 ? 12 : hour + 12
  }

  return normalizedHour * 60 + minute
}

function extractSearchableValues(value: unknown): string[] {
  if (!value) return []

  if (typeof value === 'string') {
    return value
      .split(/[,/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractSearchableValues)
  }

  return []
}

function normalizeSearchKey(value: string) {
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

function buildScoreResult({
  rawScore,
  reasons,
  distanceMeters,
  estimatedTravelMinutes,
  candidateTypes,
  openConfidence,
}: {
  rawScore: number
  reasons: VenueScoreReason[]
  distanceMeters: number | null
  estimatedTravelMinutes: number | null
  candidateTypes: NormalizedVenueType[]
  openConfidence: OpenConfidence
}): VenueScoreResult {
  const clamped = Math.max(SCORE_BOUNDS.min, Math.min(SCORE_BOUNDS.max, rawScore))
  const normalizedScore = Math.round(
    ((clamped - SCORE_BOUNDS.min) / (SCORE_BOUNDS.max - SCORE_BOUNDS.min)) * 100
  )

  return {
    score: rawScore,
    normalizedScore,
    reasons,
    distanceMeters,
    estimatedTravelMinutes,
    candidateTypes,
    openConfidence,
  }
}

function hasValidCoordinates(venue: ScoreVenueInputVenue | null | undefined) {
  return (
    typeof venue?.lat === 'number' &&
    Number.isFinite(venue.lat) &&
    Math.abs(venue.lat) <= 90 &&
    typeof venue?.lon === 'number' &&
    Number.isFinite(venue.lon) &&
    Math.abs(venue.lon) <= 180
  )
}

function calculateDistanceMeters({
  fromLat,
  fromLon,
  toLat,
  toLon,
}: {
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}) {
  const earthRadiusMeters = 6371000

  const fromLatRad = degreesToRadians(fromLat)
  const toLatRad = degreesToRadians(toLat)
  const deltaLatRad = degreesToRadians(toLat - fromLat)
  const deltaLonRad = degreesToRadians(toLon - fromLon)

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

function estimateTravelMinutes(
  distanceMeters: number,
  travelMode: ScoreVenueTravelMode
) {
  const metersPerMinute =
    travelMode === 'walking' ? 80 : travelMode === 'cycling' ? 240 : 500

  return Math.max(1, Math.round(distanceMeters / metersPerMinute))
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function getDayKey(date: Date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()]
}