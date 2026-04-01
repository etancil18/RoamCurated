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
  venues: Venue[]
  now: DateTime
  signals?: EventJourneySignals
  lockedStops?: EventJourneyLockedStop[]
  allowedTypesByStop?: readonly (readonly string[])[]
  idealStopDurationMinutes?: number
  rangeExpansionPct?: number
  maxDynamicStops?: number
}

export type EventJourneyStop = {
  stopOrder: number
  role: string
  venue: Venue
  matchedType: string | null
  locked: boolean
  distanceFromPreviousMeters: number
  distanceToDestinationMeters: number
}

export type EventJourneyResult = {
  strategy: '3-stop' | '2-stop' | '1-stop' | 'direct'
  hoursUntilEvent: number
  stopBudget: number
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

const DEFAULT_ALLOWED_TYPES_BY_STOP: readonly (readonly string[])[] = [
  ['coffee', 'cafe', 'bakery', 'breakfast'],
  ['lunch', 'restaurant', 'wine bar', 'bar', 'cocktail', 'lifestyle'],
  ['bar', 'cocktail', 'wine bar', 'restaurant', 'music'],
]

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getMatchedType(
  venue: Venue,
  allowedTypes?: readonly string[]
) {
  const venueTypes = getVenueTypes(venue)

  if (allowedTypes?.length) {
    for (const type of allowedTypes) {
      if (venueTypes.includes(type)) return type
    }
  }

  return venueTypes[0] ?? null
}

function getHoursUntilEvent(
  now: DateTime,
  eventStartAtISO: string
) {
  const eventTime = DateTime.fromISO(eventStartAtISO)
  return eventTime.diff(now, 'hours').hours
}

function getStopBudget(
  hoursUntilEvent: number,
  maxDynamicStops = 3
) {
  let base = 0

  if (hoursUntilEvent >= 6) base = 3
  else if (hoursUntilEvent >= 4) base = 2
  else if (hoursUntilEvent >= 2) base = 1
  else base = 0

  return Math.max(0, Math.min(base, maxDynamicStops))
}

function getStrategyLabel(stopBudget: number): EventJourneyResult['strategy'] {
  if (stopBudget >= 3) return '3-stop'
  if (stopBudget === 2) return '2-stop'
  if (stopBudget === 1) return '1-stop'
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

function getArrivalBufferMinutes(hoursUntilEvent: number) {
  if (hoursUntilEvent >= 6) return 45
  if (hoursUntilEvent >= 3) return 40
  return 30
}

function estimateTravelMinutes(distanceMetersValue: number) {
  const walkingMinutes = distanceMetersValue / 80
  return Math.max(8, Math.round(walkingMinutes))
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
    .sort((a, b) => a!.stopOrder - b!.stopOrder) as Array<{
      stopOrder: number
      role: string
      venue: Venue
      locked: boolean
    }>
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

  if (types.some((t) => ['coffee', 'cafe', 'bakery', 'tea', 'breakfast'].includes(t))) {
    return 45
  }

  if (types.some((t) => ['gallery', 'bookstore', 'lifestyle', 'activity', 'museum', 'showroom', 'library', 'class', 'park', 'garden'].includes(t))) {
    return 60
  }

  if (types.some((t) => ['brunch', 'lunch'].includes(t))) {
    return 75
  }

  if (types.some((t) => ['dinner', 'restaurant', 'wine bar'].includes(t))) {
    return 90
  }

  if (types.some((t) => ['bar', 'cocktail', 'cocktails', 'lounge', 'speakeasy', 'music', 'club'].includes(t))) {
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
  if (!preferredTypes?.length) return usableCandidates

  const widened = new Set<string>(preferredTypes)

  for (const stageType of preferredTypes) {
    fallbackFlowFromStage(stageType, 4).forEach((type) => widened.add(type))
  }

  const widenedCandidates = usableCandidates.filter((venue) =>
    venueMatchesAnyType(venue, Array.from(widened))
  )

  return widenedCandidates.length > 0
    ? widenedCandidates
    : usableCandidates
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
  lockedByOrder: Map<number, {
    stopOrder: number
    role: string
    venue: Venue
    locked: boolean
  }>
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

function getArrivalWindowFitScore(
  actualArrival: DateTime,
  plan: StopWindowPlan
) {
  if (actualArrival >= plan.targetStart && actualArrival <= plan.targetEnd) {
    const diffMinutes = Math.abs(actualArrival.diff(plan.targetArrival, 'minutes').minutes)
    return Math.max(0, 3 - diffMinutes / 20)
  }

  if (actualArrival < plan.targetStart) {
    const earlyBy = Math.abs(actualArrival.diff(plan.targetStart, 'minutes').minutes)
    return Math.max(-1.5, 1 - earlyBy / 30)
  }

  const lateBy = Math.abs(actualArrival.diff(plan.targetEnd, 'minutes').minutes)
  return -Math.min(6, lateBy / 10)
}

function pickBestVenueForStage({
  candidates,
  current,
  destination,
  signals,
  allowedTypes,
  maxLegDistanceMeters,
  plan,
}: {
  candidates: Venue[]
  current: LatLon
  destination: EventJourneyDestination
  signals?: EventJourneySignals
  allowedTypes?: readonly string[]
  maxLegDistanceMeters: number
  plan: StopWindowPlan
}) {
  const ranked = candidates
    .map((venue) => {
      const projectedArrivalTime = getProjectedArrivalTime(
        plan.targetStart.minus({ minutes: 20 }),
        current,
        venue
      )

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

      return {
        venue,
        total: baseScore.total + arrivalWindowFit,
      }
    })
    .sort((a, b) => b.total - a.total)

  return ranked[0]?.venue ?? null
}

export function generateEventJourney({
  property,
  destination,
  eventStartAtISO,
  venues,
  now,
  signals,
  lockedStops = [],
  allowedTypesByStop = DEFAULT_ALLOWED_TYPES_BY_STOP,
  idealStopDurationMinutes = 120,
  rangeExpansionPct = 0.3,
  maxDynamicStops = 3,
}: EventJourneyInput): EventJourneyResult | null {
  const hoursUntilEvent = getHoursUntilEvent(now, eventStartAtISO)

  const computedBudget = getStopBudget(hoursUntilEvent, maxDynamicStops)
  const strategy = getStrategyLabel(computedBudget)

  const normalizedLockedStops = normalizeLockedStops(lockedStops, venues)

  const lockedByOrder = new Map(
    normalizedLockedStops.map((stop) => [stop.stopOrder, stop])
  )

  const highestLockedOrder = normalizedLockedStops.length
    ? Math.max(...normalizedLockedStops.map((stop) => stop.stopOrder))
    : 0

  const totalStops = Math.max(computedBudget, highestLockedOrder)
  const usedIds = new Set<string>(
    normalizedLockedStops.map((stop) => stop.venue.id)
  )

  const resultStops: EventJourneyStop[] = []
  let currentPoint: LatLon = {
    lat: property.lat,
    lon: property.lon,
  }

  const maxLegDistanceMeters = getMaxLegDistanceMeters(
    hoursUntilEvent,
    rangeExpansionPct
  )

  const eventTime = DateTime.fromISO(eventStartAtISO)
  const arrivalBufferMinutes = getArrivalBufferMinutes(hoursUntilEvent)
  const latestUsefulArrival = eventTime.minus({ minutes: arrivalBufferMinutes })

  let rollingTime = now

  if (totalStops === 0) {
    return {
      strategy,
      hoursUntilEvent,
      stopBudget: 0,
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
        matchedType: getMatchedType(
          lockedStop.venue,
          plan.preferredTypes
        ),
        locked: lockedStop.locked,
        distanceFromPreviousMeters,
        distanceToDestinationMeters,
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

    const candidatePool =
      typedCandidates.length > 0
        ? typedCandidates
        : getFallbackCandidatePool(usableCandidates, allowedTypes)

    const chosen = pickBestVenueForStage({
      candidates: candidatePool,
      current: currentPoint,
      destination,
      signals,
      allowedTypes,
      maxLegDistanceMeters,
      plan,
    })

    if (!chosen) continue

    usedIds.add(chosen.id)

    const distanceFromPreviousMeters = distanceMeters(
      currentPoint.lat,
      currentPoint.lon,
      chosen.lat,
      chosen.lon
    )

    const distanceToDestinationMeters = distanceMeters(
      chosen.lat,
      chosen.lon,
      destination.lat,
      destination.lon
    )

    const chosenArrivalTime = getProjectedArrivalTime(
      rollingTime,
      currentPoint,
      chosen
    )

    resultStops.push({
      stopOrder: i,
      role: 'dynamic',
      venue: chosen,
      matchedType: getMatchedType(chosen, allowedTypes),
      locked: false,
      distanceFromPreviousMeters,
      distanceToDestinationMeters,
    })

    currentPoint = {
      lat: chosen.lat,
      lon: chosen.lon,
    }

    rollingTime = chosenArrivalTime.plus({
      minutes: plan.dwellMinutes,
    })
  }

  const hardStopCap = Math.max(
    totalStops,
    Math.ceil(
      (Math.max(hoursUntilEvent, 0) * 60) /
        Math.max(idealStopDurationMinutes, 1)
    )
  )

  const trimmedStops = resultStops.slice(0, Math.max(totalStops, hardStopCap))

  return {
    strategy,
    hoursUntilEvent,
    stopBudget: totalStops,
    stops: trimmedStops,
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