import { DateTime } from 'luxon'

import type { EventJourneyCard } from '@/lib/property/getPropertyGuideData'

export type EventJourneyStopVM = {
  id: string
  order: number
  venueId: string
  venueName: string
  venueHref: string
  description: string | null
  roleLabel: string
  typeLabel: string | null
  isCurated: boolean
  walkTimeFromPreviousLabel: string | null
  distanceFromPreviousMeters: number | null
  confidenceLabel: string | null
  selectionReason: string | null
  tradeoffLabel: string | null
}

export type EventJourneyVM = {
  id: string
  title: string
  subtitle: string
  eventName: string
  eventTimeLabel: string
  eventDateLabel: string
  destinationName: string
  destinationLabel: string
  statusLabel: string
  routeStyleLabel: string
  recommendedStartLabel: string | null
  arrivalLabel: string | null
  countdownLabel: string | null
  totalStopsLabel: string
  totalWalkLabel: string | null
  confidenceLabel: string | null
  degradedLabel: string | null
  selectionReasonSummary: string | null
  href?: string
  ctaLabel: string
  isAvailableToday: boolean
  stops: EventJourneyStopVM[]
}

type BuildEventJourneyVMOptions = {
  timezone?: string
  now?: DateTime
  defaultArrivalBufferMinutes?: number
  fallbackPerStopMinutes?: number
  fallbackTransitionMinutes?: number
}

type JourneyResultStop = {
  role?: string | null
  isLocked?: boolean
  locked?: boolean
  isCurated?: boolean
  matchedType?: string | null
  distanceFromPreviousMeters?: number | null
  walkMinutesFromPrevious?: number | null
  arrivalAtISO?: string | null
  dwellMinutes?: number | null
  selectionReason?: string | null
  confidence?: 'high' | 'medium' | 'low' | null
  tradeoff?: string | null
  venue: {
    id: string
    name: string
    city?: string | null
    description?: string | null
    link?: string | null
  }
}

type JourneyResult = {
  strategy?: string | null
  routeStyle?: 'direct' | 'quick_stop' | 'balanced_pregame' | 'full_pregame' | null
  stops?: JourneyResultStop[]
  arrivalBufferMinutes?: number | null
  recommendedStartAtISO?: string | null
  recommendedArrivalAtISO?: string | null
  plannedStops?: number | null
  fulfilledStops?: number | null
  degraded?: boolean | null
  degradationReasons?: string[] | null
  confidence?: 'high' | 'medium' | 'low' | null
  selectionReasonSummary?: string | null
}

const DEFAULT_ARRIVAL_BUFFER_MINUTES = 20
const DEFAULT_PER_STOP_MINUTES = 45
const DEFAULT_TRANSITION_MINUTES = 8

export function buildEventJourneyVM(
  card: EventJourneyCard,
  options: BuildEventJourneyVMOptions = {}
): EventJourneyVM {
  const timezone = options.timezone ?? 'UTC'
  const now = options.now ?? DateTime.now().setZone(timezone)
  const defaultArrivalBufferMinutes =
    options.defaultArrivalBufferMinutes ?? DEFAULT_ARRIVAL_BUFFER_MINUTES
  const fallbackPerStopMinutes =
    options.fallbackPerStopMinutes ?? DEFAULT_PER_STOP_MINUTES
  const fallbackTransitionMinutes =
    options.fallbackTransitionMinutes ?? DEFAULT_TRANSITION_MINUTES

  const result = (card.result ?? {}) as JourneyResult
  const rawStops = Array.isArray(result.stops) ? result.stops : []

  const eventStart = DateTime.fromISO(card.eventStartAt).setZone(timezone)
  const eventEnd =
    card.eventEndAt && card.eventEndAt.trim().length > 0
      ? DateTime.fromISO(card.eventEndAt).setZone(timezone)
      : null

  const isAvailableToday =
    now.hasSame(eventStart, 'day') ||
    (eventEnd ? now >= eventStart && now <= eventEnd : false)

  const arrivalBufferMinutes = positiveIntOrFallback(
    result.arrivalBufferMinutes,
    defaultArrivalBufferMinutes
  )

  const estimatedWalkMinutes = sumEstimatedWalkMinutes(rawStops)
  const estimatedExperienceMinutes = estimateExperienceMinutes(
    rawStops,
    fallbackPerStopMinutes,
    fallbackTransitionMinutes,
    estimatedWalkMinutes
  )

  const recommendedArrivalAt =
    parseISOInZone(result.recommendedArrivalAtISO, timezone) ??
    eventStart.minus({ minutes: arrivalBufferMinutes })

  const recommendedStartAt =
    parseISOInZone(result.recommendedStartAtISO, timezone) ??
    recommendedArrivalAt.minus({ minutes: estimatedExperienceMinutes })

  const stops = rawStops.map((stop, index) =>
    buildStopVM({
      stop,
      index,
    })
  )

  const routeStyleLabel = getRouteStyleLabel(
    result.routeStyle,
    result.strategy,
    rawStops.length
  )

  const subtitle = getRouteSubtitle({
    card,
    routeStyleLabel,
    stopCount: rawStops.length,
    destinationName: card.destinationName,
    selectionReasonSummary: cleanText(result.selectionReasonSummary),
  })

  const totalWalkLabel =
    estimatedWalkMinutes > 0 ? `~${estimatedWalkMinutes} min walking` : null

  const confidenceLabel = humanizeConfidenceLabel(result.confidence)
  const degradedLabel = getDegradedLabel(
    Boolean(result.degraded),
    result.degradationReasons
  )

  return {
    id: card.id,
    title: card.title,
    subtitle,
    eventName: card.eventName,
    eventTimeLabel: buildEventTimeLabel(eventStart, eventEnd),
    eventDateLabel: formatEventDateLabel(eventStart, eventEnd),
    destinationName: card.destinationName,
    destinationLabel: `Ends at ${card.destinationName}`,
    statusLabel: getStatusLabel(card.status, isAvailableToday),
    routeStyleLabel,
    recommendedStartLabel: isAvailableToday
      ? `Leave around ${formatClockTime(recommendedStartAt)}`
      : null,
    arrivalLabel: buildArrivalLabel({
      policy: card.arrivalPolicy,
      preference: card.arrivalPreference,
      arrivalTime: recommendedArrivalAt,
      buffer: arrivalBufferMinutes,
      eventStart,
      eventEnd,
    }),
    countdownLabel: formatCountdownLabel(now, eventStart),
    totalStopsLabel: formatStopCountLabel(
      positiveIntOrFallback(result.fulfilledStops, rawStops.length)
    ),
    totalWalkLabel,
    confidenceLabel,
    degradedLabel,
    selectionReasonSummary: cleanText(result.selectionReasonSummary),
    href: card.href,
    ctaLabel: card.href ? 'View Route' : 'Available on Event Day',
    isAvailableToday,
    stops,
  }
}

export function buildEventJourneyVMs(
  cards: EventJourneyCard[],
  options: BuildEventJourneyVMOptions = {}
): EventJourneyVM[] {
  return (cards ?? [])
    .map((card) => buildEventJourneyVM(card, options))
    .filter((vm): vm is EventJourneyVM => Boolean(vm && vm.id))
}

function buildStopVM({
  stop,
  index,
}: {
  stop: JourneyResultStop
  index: number
}): EventJourneyStopVM {
  const distanceFromPreviousMeters = toNumberOrNull(stop.distanceFromPreviousMeters)
  const walkMinutes =
    positiveIntOrNull(stop.walkMinutesFromPrevious) ??
    (distanceFromPreviousMeters !== null
      ? estimateWalkMinutes(distanceFromPreviousMeters)
      : null)

  return {
    id: `${stop.venue?.id ?? 'stop'}-${index + 1}`,
    order: index + 1,
    venueId: String(stop.venue?.id ?? ''),
    venueName: String(stop.venue?.name ?? 'Unknown venue'),
    venueHref: stop.venue?.link || `/venue-profile/${stop.venue?.id ?? ''}`,
    description:
      typeof stop.venue?.description === 'string' &&
      stop.venue.description.trim().length > 0
        ? stop.venue.description.trim()
        : null,
    roleLabel: humanizeStopRole(stop.role, stop.matchedType, index),
    typeLabel: humanizeTypeLabel(stop.matchedType),
    isCurated: Boolean(stop.isCurated ?? stop.isLocked ?? stop.locked),
    walkTimeFromPreviousLabel:
      index === 0 ? null : formatWalkTimeMinutesLabel(walkMinutes),
    distanceFromPreviousMeters,
    confidenceLabel: humanizeConfidenceLabel(stop.confidence),
    selectionReason: cleanText(stop.selectionReason),
    tradeoffLabel: humanizeTradeoffLabel(stop.tradeoff),
  }
}

function buildArrivalLabel({
  policy,
  preference,
  arrivalTime,
  buffer,
  eventStart,
  eventEnd,
}: {
  policy:
    | 'by_start'
    | 'midpoint_deadline'
    | 'window'
    | 'custom'
    | null
    | undefined
  preference:
    | 'early'
    | 'on_time'
    | 'fashionably_late'
    | 'late_ok'
    | null
    | undefined
  arrivalTime: DateTime
  buffer: number
  eventStart: DateTime
  eventEnd: DateTime | null
}) {
  const normalizedPolicy = String(policy ?? '').trim().toLowerCase()
  const normalizedPreference = String(preference ?? '').trim().toLowerCase()

  if (normalizedPolicy === 'midpoint_deadline' && eventEnd?.isValid) {
    return `Arrive by ~${formatClockTime(arrivalTime)} (before midpoint)`
  }

  if (normalizedPolicy === 'window' && eventEnd?.isValid) {
    return `Arrive anytime before ~${formatClockTime(arrivalTime)}`
  }

  if (normalizedPolicy === 'by_start') {
    if (normalizedPreference === 'early') {
      return `Arrive early (~${buffer} min before start)`
    }

    if (normalizedPreference === 'fashionably_late') {
      return `Arrive slightly late (~${formatClockTime(arrivalTime)})`
    }

    if (normalizedPreference === 'late_ok') {
      return `Late arrival is acceptable (~${formatClockTime(arrivalTime)})`
    }

    return `Arrive ~${buffer} min before start`
  }

  if (eventStart.isValid) {
    return `Arrive around ${formatClockTime(arrivalTime)}`
  }

  return null
}

function buildEventTimeLabel(start: DateTime, end: DateTime | null) {
  if (end?.isValid) {
    if (start.hasSame(end, 'day')) {
      return `${start.toFormat('EEE • h:mm a')} – ${end.toFormat('h:mm a')}`
    }

    return `${start.toFormat('EEE • h:mm a')} – ${end.toFormat('EEE • h:mm a')}`
  }

  return start.toFormat('EEE • h:mm a')
}

function formatEventDateLabel(start: DateTime, end: DateTime | null) {
  if (end?.isValid && !start.hasSame(end, 'day')) {
    return `${start.toFormat('LLLL d')} – ${end.toFormat('LLLL d')}`
  }

  return start.toFormat('LLLL d')
}

function getRouteStyleLabel(
  routeStyle: string | null | undefined,
  strategy: string | null | undefined,
  stopCount: number
) {
  const normalizedRouteStyle = String(routeStyle ?? '').trim().toLowerCase()
  const normalizedStrategy = String(strategy ?? '').trim().toLowerCase()

  if (normalizedRouteStyle === 'direct') return 'Go straight there'
  if (normalizedRouteStyle === 'quick_stop') return 'Quick stop before the event'
  if (normalizedRouteStyle === 'balanced_pregame') return 'Balanced pregame'
  if (normalizedRouteStyle === 'full_pregame') return 'Full pregame'

  if (normalizedStrategy.includes('direct')) return 'Go straight there'
  if (normalizedStrategy.includes('1-stop') || normalizedStrategy.includes('1 stop')) {
    return 'Quick stop before the event'
  }
  if (normalizedStrategy.includes('2-stop') || normalizedStrategy.includes('2 stop')) {
    return 'Balanced pregame'
  }
  if (normalizedStrategy.includes('3-stop') || normalizedStrategy.includes('3 stop')) {
    return 'Full pregame'
  }

  if (stopCount <= 0) return 'Go straight there'
  if (stopCount === 1) return 'Quick stop before the event'
  if (stopCount === 2) return 'Balanced pregame'
  return 'Full pregame'
}

function getRouteSubtitle({
  card,
  routeStyleLabel,
  stopCount,
  destinationName,
  selectionReasonSummary,
}: {
  card: EventJourneyCard
  routeStyleLabel: string
  stopCount: number
  destinationName: string
  selectionReasonSummary: string | null
}) {
  if (selectionReasonSummary) return selectionReasonSummary

  if (card.arrivalPolicy === 'midpoint_deadline') {
    return `Build momentum before arriving at ${destinationName}.`
  }

  if (card.arrivalPolicy === 'window') {
    return `A flexible route toward ${destinationName}.`
  }

  if (routeStyleLabel === 'Go straight there' || stopCount === 0) {
    return `Head straight to ${destinationName} without extra stops.`
  }

  if (routeStyleLabel === 'Quick stop before the event') {
    return `One easy stop before heading into ${destinationName}.`
  }

  if (routeStyleLabel === 'Balanced pregame') {
    return `A shorter pre-event plan with time to settle in before ${destinationName}.`
  }

  return `A fuller pregame route that builds naturally toward ${destinationName}.`
}

function getStatusLabel(status: string | null | undefined, isAvailableToday: boolean) {
  const normalized = String(status ?? '').trim().toLowerCase()

  if (isAvailableToday) return 'Available today'
  if (normalized.includes('day of event')) return 'Unlocks on event day'
  if (normalized.length > 0) return sentenceCase(normalized)

  return 'Check back when the timing is right'
}

function getDegradedLabel(
  degraded: boolean,
  degradationReasons?: string[] | null
) {
  if (!degraded) return null

  const reasons = Array.isArray(degradationReasons)
    ? degradationReasons.filter(Boolean)
    : []

  if (reasons.length === 0) {
    return 'Built from the best available nearby options.'
  }

  return 'Built from the best available nearby options.'
}

function humanizeStopRole(
  role: string | null | undefined,
  matchedType: string | null | undefined,
  index: number
) {
  const normalizedRole = String(role ?? '').trim().toLowerCase()
  const normalizedType = String(matchedType ?? '').trim().toLowerCase()

  if (normalizedRole.includes('preset')) return 'Curated stop'
  if (normalizedRole.includes('final')) return 'Final stop'
  if (normalizedRole.includes('warm')) return 'Warm-up'
  if (normalizedRole.includes('drink')) return 'Drinks'
  if (normalizedRole.includes('dinner') || normalizedRole.includes('meal')) return 'Dinner'
  if (normalizedRole.includes('coffee')) return 'Coffee start'
  if (normalizedRole.includes('browse')) return 'Browse'
  if (normalizedRole.includes('reset')) return 'Reset'
  if (normalizedRole.includes('dynamic') && index === 0) return 'Start'
  if (normalizedRole.includes('dynamic')) return 'Next stop'

  if (matchesAny(normalizedType, ['coffee', 'cafe', 'café', 'bakery'])) {
    return index === 0 ? 'Coffee start' : 'Coffee stop'
  }

  if (matchesAny(normalizedType, ['restaurant', 'dinner', 'kitchen', 'lunch'])) {
    return 'Dinner'
  }

  if (matchesAny(normalizedType, ['bar', 'wine bar', 'cocktail', 'pub', 'brewery'])) {
    return index === 0 ? 'Drinks stop' : 'Pre-event drinks'
  }

  if (matchesAny(normalizedType, ['fitness', 'yoga', 'spa', 'wellness'])) {
    return 'Reset'
  }

  if (matchesAny(normalizedType, ['gallery', 'shop', 'retail', 'lifestyle', 'museum'])) {
    return 'Browse'
  }

  return index === 0 ? 'Start' : 'Stop'
}

function humanizeTypeLabel(type: string | null | undefined) {
  const normalized = String(type ?? '').trim().toLowerCase()
  if (!normalized) return null

  if (normalized === 'wine bar') return 'Wine bar'
  if (normalized === 'cocktail') return 'Cocktail bar'
  if (normalized === 'cafe' || normalized === 'café') return 'Cafe'
  if (normalized === 'restaurant') return 'Restaurant'
  if (normalized === 'fitness') return 'Fitness'
  if (normalized === 'lifestyle') return 'Lifestyle'

  return sentenceCase(normalized)
}

function humanizeConfidenceLabel(
  confidence: 'high' | 'medium' | 'low' | null | undefined
) {
  const normalized = String(confidence ?? '').trim().toLowerCase()

  if (normalized === 'high') return 'High confidence'
  if (normalized === 'medium') return 'Good fit'
  if (normalized === 'low') return 'Fallback fit'

  return null
}

function humanizeTradeoffLabel(tradeoff: string | null | undefined) {
  const normalized = cleanText(tradeoff)?.toLowerCase()
  if (!normalized) return null

  if (normalized === 'used fallback venue types') return 'Fallback pick'
  if (normalized === 'tight timing fit') return 'Tight timing'
  if (normalized === 'longer walk than ideal') return 'Longer walk'
  if (normalized === 'slightly off-route') return 'Slight detour'
  if (normalized === 'opens soon') return 'Opens soon'
  if (normalized === 'daypart mismatch') return 'Less ideal timing'
  if (normalized === 'closed at arrival') return 'Timing risk'
  if (normalized === 'weaker type fit') return 'Weaker type fit'
  if (normalized === 'repeated venue category') return 'Repeated category'

  return sentenceCase(normalized)
}

function formatWalkTimeMinutesLabel(walkMinutes: number | null) {
  if (walkMinutes === null || walkMinutes <= 0) return null
  if (walkMinutes <= 1) return '1 min walk'
  return `${walkMinutes} min walk`
}

function formatStopCountLabel(stopCount: number) {
  if (stopCount <= 0) return 'Direct route'
  if (stopCount === 1) return '1 stop'
  return `${stopCount} stops`
}

function formatClockTime(value: DateTime) {
  return value.toFormat('h:mm a')
}

function formatCountdownLabel(now: DateTime, eventTime: DateTime) {
  if (!eventTime.isValid || !now.isValid) return null

  const diffMinutes = Math.round(eventTime.diff(now, 'minutes').minutes)

  if (diffMinutes < 0) return 'Already started'
  if (diffMinutes <= 15) return 'Starting soon'
  if (diffMinutes < 60) return `${diffMinutes} min to go`

  const hours = Math.round((diffMinutes / 60) * 10) / 10

  if (hours === 1) return '1 hour to go'
  return `${hours} hours to go`
}

function estimateExperienceMinutes(
  stops: JourneyResultStop[],
  fallbackPerStopMinutes: number,
  fallbackTransitionMinutes: number,
  estimatedWalkMinutes: number
) {
  if (stops.length <= 0) return 0

  const dwellMinutes = stops.reduce((sum, stop) => {
    const dwell = positiveIntOrNull(stop.dwellMinutes)
    return sum + (dwell ?? fallbackPerStopMinutes)
  }, 0)

  const transitionCount = Math.max(stops.length - 1, 0)
  const overheadMinutes = transitionCount * fallbackTransitionMinutes

  return dwellMinutes + overheadMinutes + estimatedWalkMinutes
}

function sumEstimatedWalkMinutes(stops: JourneyResultStop[]) {
  return stops.reduce((sum, stop, index) => {
    if (index === 0) return sum

    const explicitWalk = positiveIntOrNull(stop.walkMinutesFromPrevious)
    if (explicitWalk !== null) return sum + explicitWalk

    const distance = toNumberOrNull(stop.distanceFromPreviousMeters)
    if (distance === null) return sum

    return sum + estimateWalkMinutes(distance)
  }, 0)
}

function estimateWalkMinutes(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0

  const rawMinutes = distanceMeters / 80
  return Math.max(1, Math.round(rawMinutes))
}

function parseISOInZone(value: string | null | undefined, timezone: string) {
  if (!value) return null

  const parsed = DateTime.fromISO(value).setZone(timezone)
  return parsed.isValid ? parsed : null
}

function positiveIntOrFallback(value: number | null | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.round(value)
}

function positiveIntOrNull(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.round(value)
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function matchesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value === candidate)
}

function cleanText(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function sentenceCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}