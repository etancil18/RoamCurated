import { DateTime } from 'luxon'
import type { Venue } from '@/types/venue'

import {
  scoreEventJourneyVenue,
  distanceMeters,
} from './eventJourneyScoring'

import {
  getVenueTypes,
  venueMatchesAnyType,
} from '@/lib/venues/typeMatching'

import {
  sequencedStagesForNow,
  fallbackFlowFromStage,
} from '@/utils/stageUtils'

import {
  daypartAllowedAtTime,
  isVenueOpenAtTime,
  isVenueOpenWithinWindow,
} from '@/utils/timeUtils'

type LatLon = {
  lat: number
  lon: number
}

export type EventJourneySignals = {
  vibes?: string[] | null
  tags?: string[] | null
}

export type EventJourneyLockedStop = {
  venueId: string
  stopOrder: number
  role?: string | null
  isLocked?: boolean
}

export type EventJourneyDestination = {
  name: string
  lat: number
  lon: number
  venueId?: string | null
}

export type EventJourneyInput = {
  property: {
    lat: number
    lon: number
    city: string
    name?: string
  }
  destination: EventJourneyDestination
  eventStartAtISO: string
  eventEndAtISO?: string
  eventType?: string | null
  arrivalPolicy?: 'by_start' | 'midpoint_deadline' | 'window' | 'custom'
  arrivalPreference?: 'early' | 'on_time' | 'fashionably_late' | 'late_ok'
  venues: Venue[]
  now: DateTime
  signals?: EventJourneySignals
  lockedStops?: EventJourneyLockedStop[]
  allowedTypesByStop?: readonly (readonly string[])[]
  idealStopDurationMinutes?: number
  rangeExpansionPct?: number
  maxDynamicStops?: number
}

export type EventJourneyConfidence = 'high' | 'medium' | 'low'

export type EventJourneyRouteStyle =
  | 'direct'
  | 'quick_stop'
  | 'balanced_pregame'
  | 'full_pregame'

export type EventJourneyStop = {
  stopOrder: number
  role: string
  venue: Venue
  matchedType: string | null
  locked: boolean
  isCurated: boolean
  distanceFromPreviousMeters: number
  distanceToDestinationMeters: number
  walkMinutesFromPrevious: number
  arrivalAtISO: string | null
  dwellMinutes: number
  selectionReason: string | null
  confidence: EventJourneyConfidence
  tradeoff: string | null
}

export type EventJourneyResult = {
  strategy: '3-stop' | '2-stop' | '1-stop' | 'direct'
  routeStyle: EventJourneyRouteStyle
  hoursUntilEvent: number
  stopBudget: number
  plannedStops: number
  fulfilledStops: number
  arrivalBufferMinutes: number
  recommendedStartAtISO: string | null
  recommendedArrivalAtISO: string | null
  degraded: boolean
  degradationReasons: string[]
  confidence: EventJourneyConfidence
  selectionReasonSummary: string | null
  stops: EventJourneyStop[]
  destination: EventJourneyDestination
}

type StopWindowPlan = {
  stopOrder: number
  preferredTypes: string[]
  targetStart: DateTime
  targetEnd: DateTime
  targetArrival: DateTime
  dwellMinutes: number
  role: string
  locked: boolean
}

type LockedStopResolved = {
  stopOrder: number
  role: string
  venue: Venue
  locked: boolean
}

type CandidateEvaluation = {
  venue: Venue
  total: number
  matchedType: string | null
  projectedArrivalTime: DateTime
  projectedDepartureTime: DateTime
  legDistance: number
  distanceToDestinationMeters: number
  arrivalWindowFit: number
  usedFallbackTypes: boolean
  reason: string
  confidence: EventJourneyConfidence
  tradeoff: string | null
  experientialBucket: string | null
  repeatedExperienceBucket: boolean
}

const DEFAULT_ALLOWED_TYPES_BY_STOP: readonly (readonly string[])[] = [
  ['coffee', 'cafe', 'bakery', 'breakfast'],
  ['lunch', 'restaurant', 'wine bar', 'bar', 'cocktail', 'lifestyle'],
  ['bar', 'cocktail', 'wine bar', 'restaurant', 'music'],
]

const REPETITION_PENALTY = 5
const REPETITION_SUBSTITUTION_THRESHOLD = 2.5

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getMatchedType(venue: Venue, allowedTypes?: readonly string[]) {
  const venueTypes = getVenueTypes(venue)

  if (allowedTypes?.length) {
    for (const type of allowedTypes) {
      if (venueTypes.includes(type)) return type
    }
  }

  return venueTypes[0] ?? null
}

function inferExperienceBucket(
  matchedType: string | null | undefined,
  role?: string | null,
  venue?: Venue
) {
  const normalizedRole = String(role ?? '').trim().toLowerCase()
  const normalizedType = String(matchedType ?? '').trim().toLowerCase()
  const venueTypes = venue
    ? getVenueTypes(venue).map((type) => type.toLowerCase())
    : []

  if (normalizedRole.includes('preset')) return 'curated'
  if (normalizedRole.includes('coffee')) return 'coffee'
  if (normalizedRole.includes('meal') || normalizedRole.includes('dinner')) {
    return 'meal'
  }
  if (normalizedRole.includes('drink')) return 'drinks'
  if (normalizedRole.includes('browse')) return 'browse'
  if (normalizedRole.includes('reset')) return 'reset'

  const type = normalizedType || venueTypes[0] || ''

  if (['coffee', 'cafe', 'café', 'bakery', 'breakfast', 'brunch'].includes(type)) {
    return 'coffee'
  }

  if (['lunch', 'dinner', 'restaurant', 'kitchen', 'bbq'].includes(type)) {
    return 'meal'
  }

  if (
    ['bar', 'cocktail', 'wine bar', 'pub', 'brewery', 'music', 'lounge'].includes(type)
  ) {
    return 'drinks'
  }

  if (['gallery', 'museum', 'shop', 'retail', 'lifestyle', 'activity'].includes(type)) {
    return 'browse'
  }

  if (['fitness', 'yoga', 'spa', 'wellness'].includes(type)) {
    return 'reset'
  }

  return normalizedType || (venueTypes[0] ?? null)
}

function resolveArrivalPlan({
  now,
  eventStartAtISO,
  eventEndAtISO,
  arrivalPolicy,
  arrivalPreference,
}: {
  now: DateTime
  eventStartAtISO: string
  eventEndAtISO?: string
  arrivalPolicy?: string | null
  arrivalPreference?: string | null
}) {
  const start = DateTime.fromISO(eventStartAtISO)
  const end = eventEndAtISO ? DateTime.fromISO(eventEndAtISO) : null

  let targetArrival = start

  if (arrivalPolicy === 'midpoint_deadline' && end?.isValid) {
    const midpointOffsetMinutes = end.diff(start).shiftTo('minutes').minutes / 2
    targetArrival = start.plus({ minutes: midpointOffsetMinutes })
  } else if (arrivalPolicy === 'window' && end?.isValid) {
    targetArrival = start.plus({ minutes: 60 })
  } else {
    targetArrival = start
  }

  if (arrivalPreference === 'early') {
    targetArrival = targetArrival.minus({ minutes: 30 })
  } else if (arrivalPreference === 'fashionably_late') {
    targetArrival = targetArrival.plus({ minutes: 20 })
  } else if (arrivalPreference === 'late_ok') {
    targetArrival = targetArrival.plus({ minutes: 45 })
  }

  const hoursUntilEvent = targetArrival.diff(now, 'hours').hours

  const arrivalBufferMinutes =
    hoursUntilEvent >= 6 ? 45 : hoursUntilEvent >= 3 ? 40 : 30

  const latestUsefulArrival = targetArrival.minus({
    minutes: arrivalBufferMinutes,
  })

  const clampedLatestUsefulArrival =
    latestUsefulArrival < now ? now : latestUsefulArrival

  return {
    targetArrival,
    latestUsefulArrival: clampedLatestUsefulArrival,
    arrivalBufferMinutes,
    hoursUntilEvent,
  }
}

function getStopBudget(hoursUntilEvent: number, maxDynamicStops = 3) {
  let base = 0

  if (hoursUntilEvent >= 6) base = 3
  else if (hoursUntilEvent >= 4) base = 2
  else if (hoursUntilEvent >= 2) base = 1
  else base = 0

  return Math.max(0, Math.min(base, maxDynamicStops))
}

function getStrategyLabel(stopCount: number): EventJourneyResult['strategy'] {
  if (stopCount >= 3) return '3-stop'
  if (stopCount === 2) return '2-stop'
  if (stopCount === 1) return '1-stop'
  return 'direct'
}

function getRouteStyle(stopCount: number): EventJourneyRouteStyle {
  if (stopCount >= 3) return 'full_pregame'
  if (stopCount === 2) return 'balanced_pregame'
  if (stopCount === 1) return 'quick_stop'
  return 'direct'
}

function getMaxLegDistanceMeters(
  hoursUntilEvent: number,
  rangeExpansionPct = 0.3
) {
  const base = 900

  if (hoursUntilEvent >= 6) return base
  if (hoursUntilEvent >= 4) return Math.round(base * (1 + rangeExpansionPct))
  if (hoursUntilEvent >= 2) {
    return Math.round(base * (1 + rangeExpansionPct * 2))
  }

  return Math.round(base * (1 + rangeExpansionPct * 3))
}

function estimateTravelMinutes(distanceMetersValue: number) {
  const walkingMinutes = distanceMetersValue / 80
  const transitionOverheadMinutes = distanceMetersValue > 0 ? 3 : 0
  return Math.max(4, Math.round(walkingMinutes + transitionOverheadMinutes))
}

function getProjectedArrivalTime(
  baseTime: DateTime,
  currentPoint: LatLon,
  venue: Pick<Venue, 'lat' | 'lon'>
) {
  const legDistance = distanceMeters(
    currentPoint.lat,
    currentPoint.lon,
    venue.lat,
    venue.lon
  )

  return baseTime.plus({
    minutes: estimateTravelMinutes(legDistance),
  })
}

function normalizeLockedStops(
  lockedStops: EventJourneyLockedStop[] | undefined,
  venues: Venue[]
) {
  const venueMap = new Map(venues.map((v) => [v.id, v]))

  return (lockedStops ?? [])
    .map((stop) => {
      const venue = venueMap.get(stop.venueId)
      if (!venue) return null

      return {
        stopOrder: stop.stopOrder,
        role: stop.role ?? 'preset',
        venue,
        locked: stop.isLocked ?? true,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.stopOrder - b!.stopOrder) as LockedStopResolved[]
}

function resolveLockedStopsForRoute({
  lockedStops,
  dynamicStopBudget,
}: {
  lockedStops: LockedStopResolved[]
  dynamicStopBudget: number
}) {
  if (lockedStops.length === 0) {
    return {
      totalStops: dynamicStopBudget,
      lockedByOrder: new Map<number, LockedStopResolved>(),
    }
  }

  const highestLockedOrder = Math.max(...lockedStops.map((stop) => stop.stopOrder))
  const shouldAnchorToRouteEnd = highestLockedOrder <= lockedStops.length

  if (!shouldAnchorToRouteEnd) {
    return {
      totalStops: Math.max(dynamicStopBudget, highestLockedOrder),
      lockedByOrder: new Map(
        lockedStops.map((stop) => [stop.stopOrder, stop] as const)
      ),
    }
  }

  const lockedByOrder = new Map<number, LockedStopResolved>()
  const totalStops = dynamicStopBudget + highestLockedOrder

  lockedStops.forEach((stop) => {
    const anchoredOrder = dynamicStopBudget + stop.stopOrder
    lockedByOrder.set(anchoredOrder, {
      ...stop,
      stopOrder: anchoredOrder,
    })
  })

  return {
    totalStops,
    lockedByOrder,
  }
}

function uniqueById(venues: Venue[]) {
  const seen = new Set<string>()
  return venues.filter((venue) => {
    if (seen.has(venue.id)) return false
    seen.add(venue.id)
    return true
  })
}

function filterUsableVenues(
  venues: Venue[],
  usedIds: Set<string>,
  destination: EventJourneyDestination
) {
  return uniqueById(venues).filter((venue) => {
    if (usedIds.has(venue.id)) return false
    if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lon)) return false

    const sameAsDestinationCoords =
      venue.lat === destination.lat && venue.lon === destination.lon

    if (sameAsDestinationCoords) return false

    return true
  })
}

function estimateStopDwellMinutes(
  preferredTypes: readonly string[],
  idealStopDurationMinutes: number
) {
  const types = preferredTypes.map((t) => t.toLowerCase())

  if (
    types.some((t) =>
      ['coffee', 'cafe', 'bakery', 'tea', 'breakfast'].includes(t)
    )
  ) {
    return 45
  }

  if (
    types.some((t) =>
      [
        'gallery',
        'bookstore',
        'lifestyle',
        'activity',
        'museum',
        'showroom',
        'library',
        'class',
        'park',
        'garden',
      ].includes(t)
    )
  ) {
    return 60
  }

  if (types.some((t) => ['brunch', 'lunch'].includes(t))) {
    return 75
  }

  if (types.some((t) => ['dinner', 'restaurant', 'wine bar'].includes(t))) {
    return 90
  }

  if (
    types.some((t) =>
      [
        'bar',
        'cocktail',
        'cocktails',
        'lounge',
        'speakeasy',
        'music',
        'club',
      ].includes(t)
    )
  ) {
    return 75
  }

  return Math.max(45, Math.min(idealStopDurationMinutes, 90))
}

function inferPreferredTypesForTargetWindow(
  targetStart: DateTime,
  eventTime: DateTime
) {
  const hour = targetStart.hour + targetStart.minute / 60
  const eventHour = eventTime.hour + eventTime.minute / 60

  const nightEvent = eventHour >= 19
  const afternoonEvent = eventHour >= 13 && eventHour < 19
  const morningEvent = eventHour < 13

  if (nightEvent) {
    if (hour < 11) return ['coffee', 'cafe', 'bakery', 'breakfast']
    if (hour < 14.5) return ['brunch', 'lunch', 'cafe', 'gallery', 'lifestyle']
    if (hour < 17) return ['lunch', 'restaurant', 'gallery', 'lifestyle', 'activity']
    if (hour < 19) return ['dinner', 'restaurant', 'wine bar', 'cocktail']
    return ['bar', 'cocktail', 'wine bar', 'restaurant', 'music']
  }

  if (afternoonEvent) {
    if (hour < 10.5) return ['coffee', 'cafe', 'bakery', 'breakfast']
    if (hour < 12.5) return ['breakfast', 'brunch', 'coffee', 'cafe']
    if (hour < 15.5) return ['lunch', 'restaurant', 'gallery', 'lifestyle']
    return ['bar', 'wine bar', 'cocktail', 'restaurant']
  }

  if (morningEvent) {
    if (hour < 9.5) return ['coffee', 'cafe', 'bakery', 'breakfast']
    if (hour < 11) return ['breakfast', 'brunch', 'coffee']
    return ['lunch', 'cafe', 'lifestyle']
  }

  return ['lunch', 'restaurant', 'bar']
}

function buildTemporalAllowedTypesForWindow(
  targetStart: DateTime,
  eventTime: DateTime,
  fallbackAllowedTypes: readonly (readonly string[])[]
) {
  const inferred = inferPreferredTypesForTargetWindow(targetStart, eventTime)

  const sequenced = sequencedStagesForNow(targetStart.toJSDate(), {
    durationHours: 1,
    latestEndHour: eventTime.hour + eventTime.minute / 60,
  })

  const stagePlan = sequenced?.[0] ?? []
  const merged = uniq([...inferred, ...stagePlan])

  if (merged.length > 0) return merged

  return [...(fallbackAllowedTypes[0] ?? [])]
}

function getFallbackCandidatePool(
  usableCandidates: Venue[],
  preferredTypes?: readonly string[]
) {
  if (!preferredTypes?.length) {
    return { candidates: usableCandidates, usedFallbackTypes: false }
  }

  const widened = new Set<string>(preferredTypes)

  for (const stageType of preferredTypes) {
    fallbackFlowFromStage(stageType, 4).forEach((type) => widened.add(type))
  }

  const widenedCandidates = usableCandidates.filter((venue) =>
    venueMatchesAnyType(venue, Array.from(widened))
  )

  if (widenedCandidates.length > 0) {
    return {
      candidates: widenedCandidates,
      usedFallbackTypes: true,
    }
  }

  return {
    candidates: usableCandidates,
    usedFallbackTypes: true,
  }
}

function buildBackwardStopPlans({
  totalStops,
  latestUsefulArrival,
  eventTime,
  lockedByOrder,
  allowedTypesByStop,
  idealStopDurationMinutes,
}: {
  totalStops: number
  latestUsefulArrival: DateTime
  eventTime: DateTime
  lockedByOrder: Map<number, LockedStopResolved>
  allowedTypesByStop: readonly (readonly string[])[]
  idealStopDurationMinutes: number
}) {
  const plans: StopWindowPlan[] = []
  let cursor = latestUsefulArrival
  const interStopBufferMinutes = 15

  for (let order = totalStops; order >= 1; order--) {
    const lockedStop = lockedByOrder.get(order)

    const basePreferredTypes = lockedStop
      ? getVenueTypes(lockedStop.venue)
      : buildTemporalAllowedTypesForWindow(
          cursor.minus({ minutes: 45 }),
          eventTime,
          allowedTypesByStop
        )

    const fallbackPreferredTypes =
      allowedTypesByStop[Math.min(order - 1, allowedTypesByStop.length - 1)] ?? []

    const preferredTypes = uniq([
      ...basePreferredTypes,
      ...fallbackPreferredTypes,
    ])

    const dwellMinutes = estimateStopDwellMinutes(
      preferredTypes,
      idealStopDurationMinutes
    )

    const targetEnd = cursor
    const targetStart = targetEnd.minus({ minutes: dwellMinutes })
    const targetArrival = targetStart.plus({
      minutes: Math.min(20, Math.max(8, Math.floor(dwellMinutes / 4))),
    })

    plans.unshift({
      stopOrder: order,
      preferredTypes,
      targetStart,
      targetEnd,
      targetArrival,
      dwellMinutes,
      role: lockedStop?.role ?? 'dynamic',
      locked: lockedStop?.locked ?? false,
    })

    cursor = targetStart.minus({ minutes: interStopBufferMinutes })
  }

  return plans
}

function getArrivalWindowFitScore(actualArrival: DateTime, plan: StopWindowPlan) {
  if (actualArrival >= plan.targetStart && actualArrival <= plan.targetEnd) {
    const diffMinutes = Math.abs(
      actualArrival.diff(plan.targetArrival, 'minutes').minutes
    )
    return Math.max(0, 3 - diffMinutes / 20)
  }

  if (actualArrival < plan.targetStart) {
    const earlyBy = Math.abs(actualArrival.diff(plan.targetStart, 'minutes').minutes)
    return Math.max(-1.5, 1 - earlyBy / 30)
  }

  const lateBy = Math.abs(actualArrival.diff(plan.targetEnd, 'minutes').minutes)
  return -Math.min(6, lateBy / 10)
}

function getConfidenceLabel(
  totalScore: number,
  tradeoff: string | null
): EventJourneyConfidence {
  if (tradeoff) return totalScore >= 10 ? 'medium' : 'low'
  if (totalScore >= 12) return 'high'
  if (totalScore >= 7) return 'medium'
  return 'low'
}

function buildSelectionReason({
  matchedType,
  legDistance,
  distanceToDestinationMeters,
  arrivalWindowFit,
  usedFallbackTypes,
  addsVariety,
}: {
  matchedType: string | null
  legDistance: number
  distanceToDestinationMeters: number
  arrivalWindowFit: number
  usedFallbackTypes: boolean
  addsVariety: boolean
}) {
  const reasons: string[] = []

  if (matchedType) {
    reasons.push(`${matchedType} fit`)
  }

  if (addsVariety) {
    reasons.push('adds variety to the route')
  }

  if (legDistance <= 500) {
    reasons.push('easy first move')
  } else if (legDistance <= 900) {
    reasons.push('reasonable detour')
  }

  if (distanceToDestinationMeters <= 1200) {
    reasons.push('keeps momentum toward event')
  }

  if (arrivalWindowFit >= 1.5) {
    reasons.push('timed well for this stage')
  }

  if (usedFallbackTypes) {
    reasons.push('best nearby fallback')
  }

  if (reasons.length === 0) {
    return 'Best available fit for this stage'
  }

  return reasons[0].charAt(0).toUpperCase() + reasons[0].slice(1)
}

function buildTradeoff({
  projectedArrivalTime,
  plan,
  usedFallbackTypes,
  legDistance,
  maxLegDistanceMeters,
  repeatedExperienceBucket,
}: {
  projectedArrivalTime: DateTime
  plan: StopWindowPlan
  usedFallbackTypes: boolean
  legDistance: number
  maxLegDistanceMeters: number
  repeatedExperienceBucket: boolean
}) {
  if (usedFallbackTypes) return 'used fallback venue types'
  if (projectedArrivalTime > plan.targetEnd) return 'tight timing fit'
  if (legDistance > maxLegDistanceMeters) return 'longer walk than ideal'
  if (repeatedExperienceBucket) return 'repeated venue category'
  return null
}

function pickBestVenueForStage({
  candidates,
  current,
  destination,
  signals,
  allowedTypes,
  maxLegDistanceMeters,
  plan,
  rollingTime,
  usedFallbackTypes,
  previousStop,
}: {
  candidates: Venue[]
  current: LatLon
  destination: EventJourneyDestination
  signals?: EventJourneySignals
  allowedTypes?: readonly string[]
  maxLegDistanceMeters: number
  plan: StopWindowPlan
  rollingTime: DateTime
  usedFallbackTypes: boolean
  previousStop?: EventJourneyStop
}): CandidateEvaluation | null {
  const previousBucket = previousStop
    ? inferExperienceBucket(previousStop.matchedType, previousStop.role, previousStop.venue)
    : null

  const ranked = candidates
    .map((venue) => {
      const projectedArrivalTime = getProjectedArrivalTime(
        rollingTime,
        current,
        venue
      )

      const legDistance = distanceMeters(
        current.lat,
        current.lon,
        venue.lat,
        venue.lon
      )

      const distanceToDestinationMeters = distanceMeters(
        venue.lat,
        venue.lon,
        destination.lat,
        destination.lon
      )

      const projectedDepartureTime = projectedArrivalTime.plus({
        minutes: plan.dwellMinutes,
      })

      const baseScore = scoreEventJourneyVenue({
        venue,
        current,
        destination,
        allowedTypes,
        signals,
        maxLegDistanceMeters,
        projectedArrivalTime,
        projectedWindowMinutes: 30,
        openAtArrivalWeight: 4,
        daypartMatchWeight: 2,
        opensWithinWindowWeight: 1.5,
        closedAtArrivalPenalty: 6,
        daypartMismatchPenalty: 3,
      })

      const arrivalWindowFit = getArrivalWindowFitScore(
        projectedArrivalTime,
        plan
      )

      const matchedType = getMatchedType(venue, allowedTypes)
      const experientialBucket = inferExperienceBucket(
        matchedType,
        plan.role,
        venue
      )

      const repeatedExperienceBucket =
        Boolean(previousBucket) &&
        Boolean(experientialBucket) &&
        previousBucket === experientialBucket

      const repetitionPenalty = repeatedExperienceBucket
        ? REPETITION_PENALTY
        : 0

      const tradeoff = buildTradeoff({
        projectedArrivalTime,
        plan,
        usedFallbackTypes,
        legDistance,
        maxLegDistanceMeters,
        repeatedExperienceBucket,
      })

      const total = baseScore.total + arrivalWindowFit - repetitionPenalty
      const confidence = getConfidenceLabel(total, tradeoff)
      const reason = buildSelectionReason({
        matchedType,
        legDistance,
        distanceToDestinationMeters,
        arrivalWindowFit,
        usedFallbackTypes,
        addsVariety: Boolean(previousBucket) && !repeatedExperienceBucket,
      })

      return {
        venue,
        total,
        matchedType,
        projectedArrivalTime,
        projectedDepartureTime,
        legDistance,
        distanceToDestinationMeters,
        arrivalWindowFit,
        usedFallbackTypes,
        reason,
        confidence,
        tradeoff,
        experientialBucket,
        repeatedExperienceBucket,
      }
    })
    .sort((a, b) => b.total - a.total)

  const topChoice = ranked[0] ?? null

  if (!topChoice) return null

  if (!topChoice.repeatedExperienceBucket) {
    return topChoice
  }

  const alternative = ranked.find(
    (candidate) =>
      !candidate.repeatedExperienceBucket &&
      candidate.total >= topChoice.total - REPETITION_SUBSTITUTION_THRESHOLD
  )

  return alternative ?? topChoice
}

function getRecommendedStartTime({
  now,
  property,
  firstStop,
  firstPlan,
}: {
  now: DateTime
  property: EventJourneyInput['property']
  firstStop: EventJourneyStop | undefined
  firstPlan: StopWindowPlan | undefined
}) {
  if (!firstStop || !firstPlan) return now

  const travelMinutes = firstStop.walkMinutesFromPrevious
  const idealStart = firstPlan.targetStart.minus({ minutes: travelMinutes })

  return idealStart > now ? idealStart : now
}

function getRouteConfidence(
  stops: EventJourneyStop[],
  degraded: boolean
): EventJourneyConfidence {
  if (stops.length === 0) return 'medium'

  const lowCount = stops.filter((stop) => stop.confidence === 'low').length
  const mediumCount = stops.filter((stop) => stop.confidence === 'medium').length

  if (!degraded && lowCount === 0 && mediumCount <= 1) return 'high'
  if (lowCount >= 2) return 'low'
  if (degraded) return lowCount === 0 ? 'medium' : 'low'
  return 'medium'
}

function buildSelectionReasonSummary({
  routeStyle,
  confidence,
  degraded,
}: {
  routeStyle: EventJourneyRouteStyle
  confidence: EventJourneyConfidence
  degraded: boolean
}) {
  const styleCopy: Record<EventJourneyRouteStyle, string> = {
    direct: 'A direct route when extra stops are not worth forcing.',
    quick_stop: 'A quick pre-event stop that still keeps timing tight.',
    balanced_pregame: 'A balanced pregame with enough time to enjoy the lead-up.',
    full_pregame: 'A fuller pregame route that builds naturally toward the event.',
  }

  if (degraded) {
    if (confidence === 'low') {
      return 'A fallback route built from the best available nearby options.'
    }

    return 'A slightly compromised route that still fits the event clock.'
  }

  return styleCopy[routeStyle]
}

export function generateEventJourney({
  property,
  destination,
  eventStartAtISO,
  eventEndAtISO,
  eventType,
  arrivalPolicy,
  arrivalPreference,
  venues,
  now,
  signals,
  lockedStops = [],
  allowedTypesByStop = DEFAULT_ALLOWED_TYPES_BY_STOP,
  idealStopDurationMinutes = 120,
  rangeExpansionPct = 0.3,
  maxDynamicStops = 3,
}: EventJourneyInput): EventJourneyResult | null {
  void eventType

  const {
    targetArrival,
    latestUsefulArrival,
    arrivalBufferMinutes,
    hoursUntilEvent,
  } = resolveArrivalPlan({
    now,
    eventStartAtISO,
    eventEndAtISO,
    arrivalPolicy,
    arrivalPreference,
  })

  const computedBudget = getStopBudget(hoursUntilEvent, maxDynamicStops)
  const normalizedLockedStops = normalizeLockedStops(lockedStops, venues)

  const {
    totalStops,
    lockedByOrder,
  } = resolveLockedStopsForRoute({
    lockedStops: normalizedLockedStops,
    dynamicStopBudget: computedBudget,
  })

  const usedIds = new Set<string>(
    normalizedLockedStops.map((stop) => stop.venue.id)
  )

  const resultStops: EventJourneyStop[] = []
  const degradationReasons: string[] = []

  let currentPoint: LatLon = {
    lat: property.lat,
    lon: property.lon,
  }

  const maxLegDistanceMeters = getMaxLegDistanceMeters(
    hoursUntilEvent,
    rangeExpansionPct
  )

  const eventTime = targetArrival
  let rollingTime = now

  if (totalStops === 0) {
    return {
      strategy: 'direct',
      routeStyle: 'direct',
      hoursUntilEvent,
      stopBudget: 0,
      plannedStops: 0,
      fulfilledStops: 0,
      arrivalBufferMinutes,
      recommendedStartAtISO: now.toISO(),
      recommendedArrivalAtISO: latestUsefulArrival.toISO(),
      degraded: false,
      degradationReasons: [],
      confidence: 'medium',
      selectionReasonSummary:
        'A direct route when extra stops are not worth forcing.',
      stops: [],
      destination,
    }
  }

  const stopPlans = buildBackwardStopPlans({
    totalStops,
    latestUsefulArrival,
    eventTime,
    lockedByOrder,
    allowedTypesByStop,
    idealStopDurationMinutes,
  })

  for (let i = 1; i <= totalStops; i++) {
    const plan = stopPlans[i - 1]
    const lockedStop = lockedByOrder.get(i)

    if (lockedStop) {
      const distanceFromPreviousMeters = distanceMeters(
        currentPoint.lat,
        currentPoint.lon,
        lockedStop.venue.lat,
        lockedStop.venue.lon
      )

      const distanceToDestinationMeters = distanceMeters(
        lockedStop.venue.lat,
        lockedStop.venue.lon,
        destination.lat,
        destination.lon
      )

      const projectedArrivalTime = getProjectedArrivalTime(
        rollingTime,
        currentPoint,
        lockedStop.venue
      )

      resultStops.push({
        stopOrder: i,
        role: lockedStop.role,
        venue: lockedStop.venue,
        matchedType: getMatchedType(lockedStop.venue, plan.preferredTypes),
        locked: lockedStop.locked,
        isCurated: lockedStop.locked,
        distanceFromPreviousMeters,
        distanceToDestinationMeters,
        walkMinutesFromPrevious: estimateTravelMinutes(distanceFromPreviousMeters),
        arrivalAtISO: projectedArrivalTime.toISO(),
        dwellMinutes: plan.dwellMinutes,
        selectionReason: 'Curated stop locked into the route.',
        confidence: 'high',
        tradeoff: null,
      })

      currentPoint = {
        lat: lockedStop.venue.lat,
        lon: lockedStop.venue.lon,
      }

      rollingTime = projectedArrivalTime.plus({
        minutes: plan.dwellMinutes,
      })

      continue
    }

    const allowedTypes = plan.preferredTypes

    const usableCandidates = filterUsableVenues(
      venues,
      usedIds,
      destination
    ).filter((venue) => {
      const legDistance = distanceMeters(
        currentPoint.lat,
        currentPoint.lon,
        venue.lat,
        venue.lon
      )

      const remainingToDestination = distanceMeters(
        venue.lat,
        venue.lon,
        destination.lat,
        destination.lon
      )

      const currentToDestination = distanceMeters(
        currentPoint.lat,
        currentPoint.lon,
        destination.lat,
        destination.lon
      )

      const makesForwardProgress =
        remainingToDestination < currentToDestination || currentToDestination < 400

      const withinReasonableLeg =
        legDistance <= maxLegDistanceMeters * 1.5

      const projectedArrivalTime = getProjectedArrivalTime(
        rollingTime,
        currentPoint,
        venue
      )

      const projectedDepartureTime = projectedArrivalTime.plus({
        minutes: plan.dwellMinutes,
      })

      const nextPlan = stopPlans[i]
      const mustLeaveBefore = nextPlan?.targetStart ?? latestUsefulArrival

      const respectsCurrentWindow = projectedArrivalTime <= plan.targetEnd
      const respectsNextAnchor = projectedDepartureTime <= mustLeaveBefore

      const openAtArrival = isVenueOpenAtTime(venue, projectedArrivalTime)
      const openSoon = isVenueOpenWithinWindow(venue, projectedArrivalTime, 30)
      const daypartAllowed = daypartAllowedAtTime(venue, projectedArrivalTime)

      return (
        makesForwardProgress &&
        withinReasonableLeg &&
        respectsCurrentWindow &&
        respectsNextAnchor &&
        (openAtArrival || openSoon) &&
        daypartAllowed
      )
    })

    const typedCandidates =
      allowedTypes?.length
        ? usableCandidates.filter((venue) =>
            venueMatchesAnyType(venue, allowedTypes)
          )
        : usableCandidates

    const candidatePoolInfo =
      typedCandidates.length > 0
        ? {
            candidates: typedCandidates,
            usedFallbackTypes: false,
          }
        : getFallbackCandidatePool(usableCandidates, allowedTypes)

    const chosen = pickBestVenueForStage({
      candidates: candidatePoolInfo.candidates,
      current: currentPoint,
      destination,
      signals,
      allowedTypes,
      maxLegDistanceMeters,
      plan,
      rollingTime,
      usedFallbackTypes: candidatePoolInfo.usedFallbackTypes,
      previousStop: resultStops[resultStops.length - 1],
    })

    if (!chosen) {
      degradationReasons.push(`Could not place stop ${i} within route constraints.`)
      continue
    }

    if (chosen.usedFallbackTypes) {
      degradationReasons.push(`Stop ${i} used fallback venue types.`)
    }

    if (chosen.tradeoff) {
      degradationReasons.push(`Stop ${i} accepted tradeoff: ${chosen.tradeoff}.`)
    }

    if (chosen.repeatedExperienceBucket) {
      degradationReasons.push(`Stop ${i} repeated the prior venue category.`)
    }

    usedIds.add(chosen.venue.id)

    resultStops.push({
      stopOrder: i,
      role: 'dynamic',
      venue: chosen.venue,
      matchedType: chosen.matchedType,
      locked: false,
      isCurated: false,
      distanceFromPreviousMeters: chosen.legDistance,
      distanceToDestinationMeters: chosen.distanceToDestinationMeters,
      walkMinutesFromPrevious: estimateTravelMinutes(chosen.legDistance),
      arrivalAtISO: chosen.projectedArrivalTime.toISO(),
      dwellMinutes: plan.dwellMinutes,
      selectionReason: chosen.reason,
      confidence: chosen.confidence,
      tradeoff: chosen.tradeoff,
    })

    currentPoint = {
      lat: chosen.venue.lat,
      lon: chosen.venue.lon,
    }

    rollingTime = chosen.projectedDepartureTime
  }

  const fulfilledStops = resultStops.length
  const plannedStops = totalStops
  const degraded =
    fulfilledStops < plannedStops || degradationReasons.length > 0

  const finalStrategy = getStrategyLabel(fulfilledStops)
  const routeStyle = getRouteStyle(fulfilledStops)
  const recommendedStartAt = getRecommendedStartTime({
    now,
    property,
    firstStop: resultStops[0],
    firstPlan: stopPlans[0],
  })
  const confidence = getRouteConfidence(resultStops, degraded)
  const uniqueDegradationReasons = uniq(degradationReasons)
  const selectionReasonSummary = buildSelectionReasonSummary({
    routeStyle,
    confidence,
    degraded,
  })

  return {
    strategy: finalStrategy,
    routeStyle,
    hoursUntilEvent,
    stopBudget: plannedStops,
    plannedStops,
    fulfilledStops,
    arrivalBufferMinutes,
    recommendedStartAtISO: recommendedStartAt.toISO(),
    recommendedArrivalAtISO: latestUsefulArrival.toISO(),
    degraded,
    degradationReasons: uniqueDegradationReasons,
    confidence,
    selectionReasonSummary,
    stops: resultStops,
    destination,
  }
}

export function getEventJourneyStopBudget(
  hoursUntilEvent: number,
  maxDynamicStops = 3
) {
  return getStopBudget(hoursUntilEvent, maxDynamicStops)
}

export function getEventJourneyMaxLegDistanceMeters(
  hoursUntilEvent: number,
  rangeExpansionPct = 0.3
) {
  return getMaxLegDistanceMeters(hoursUntilEvent, rangeExpansionPct)
}