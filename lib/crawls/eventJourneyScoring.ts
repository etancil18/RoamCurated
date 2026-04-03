import type { Venue } from '@/types/venue'
import { DateTime } from 'luxon'
import {
  getVenueTypes,
  venueMatchesAnyType,
} from '@/lib/venues/typeMatching'
import {
  daypartAllowedAtTime,
  isVenueOpenAtTime,
  isVenueOpenWithinWindow,
} from '@/utils/timeUtils'

type LatLon = {
  lat: number
  lon: number
}

type EventJourneySignals = {
  vibes?: string[] | null
  tags?: string[] | null
}

export type EventJourneyRouteRole =
  | 'warmup'
  | 'meal'
  | 'drinks'
  | 'final_stop'
  | 'browse'
  | 'reset'
  | 'dynamic'

export type EventJourneyScoringInput = {
  venue: Venue
  current: LatLon
  destination: LatLon
  allowedTypes?: readonly string[]
  signals?: EventJourneySignals
  maxLegDistanceMeters?: number
  progressWeight?: number
  proximityWeight?: number
  directionWeight?: number
  vibeWeight?: number
  tagWeight?: number
  offRouteWeight?: number

  projectedArrivalTime?: DateTime
  projectedWindowMinutes?: number
  openAtArrivalWeight?: number
  daypartMatchWeight?: number
  opensWithinWindowWeight?: number
  closedAtArrivalPenalty?: number
  daypartMismatchPenalty?: number

  routeRole?: EventJourneyRouteRole
  stopOrder?: number
  remainingStops?: number

  /* ---------------------------------------------- */
  /* Optional sequence-diversity context            */
  /* ---------------------------------------------- */

  previousMatchedType?: string | null
  previousExperienceBucket?: string | null
}

export type EventJourneyScoreConfidence = 'high' | 'medium' | 'low'

export type EventJourneyScoreBreakdown = {
  total: number

  progressScore: number
  proximityScore: number
  directionScore: number
  vibeScore: number
  tagScore: number
  temporalScore: number
  openAtArrivalScore: number
  openSoonScore: number
  daypartScore: number
  offRoutePenalty: number
  legDistancePenalty: number
  temporalPenalty: number

  geographicScore: number
  semanticScore: number
  typeScore: number
  riskPenalty: number

  /* ---------------------------------------------- */
  /* Sequence-diversity additions                   */
  /* ---------------------------------------------- */

  experientialBucket: string | null
  repetitionPenalty: number
  repeatedExperienceBucket: boolean

  matchedType: string | null
  confidence: EventJourneyScoreConfidence
  wonOn:
    | 'geographic fit'
    | 'temporal fit'
    | 'semantic fit'
    | 'type fit'
    | 'balanced fit'
  tradeoff: string | null
  riskFlags: string[]
}

const EXPERIENCE_REPETITION_PENALTY = 4

function toRad(value: number) {
  return (value * Math.PI) / 180
}

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3

  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lon2 - lon1)

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function dot(ax: number, ay: number, bx: number, by: number) {
  return ax * bx + ay * by
}

function magnitude(x: number, y: number) {
  return Math.sqrt(x * x + y * y)
}

function normalizedSimilarity(
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const magA = magnitude(ax, ay)
  const magB = magnitude(bx, by)

  if (magA === 0 || magB === 0) return 0

  const cosine = dot(ax, ay, bx, by) / (magA * magB)

  return Math.max(-1, Math.min(1, cosine))
}

function approxXYMeters(
  origin: LatLon,
  point: LatLon
): { x: number; y: number } {
  const meanLat = toRad((origin.lat + point.lat) / 2)
  const metersPerDegLat = 111320
  const metersPerDegLon = 111320 * Math.cos(meanLat)

  return {
    x: (point.lon - origin.lon) * metersPerDegLon,
    y: (point.lat - origin.lat) * metersPerDegLat,
  }
}

export function perpendicularDistanceToCorridorMeters(
  origin: LatLon,
  destination: LatLon,
  point: LatLon
) {
  const a = { x: 0, y: 0 }
  const b = approxXYMeters(origin, destination)
  const p = approxXYMeters(origin, point)

  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y

  const abLenSq = abx * abx + aby * aby

  if (abLenSq === 0) {
    return magnitude(apx, apy)
  }

  const t = Math.max(0, Math.min(1, dot(apx, apy, abx, aby) / abLenSq))

  const projX = a.x + abx * t
  const projY = a.y + aby * t

  return magnitude(p.x - projX, p.y - projY)
}

function splitSignalValue(value: string) {
  return value
    .split(/[,;/|]/g)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

function normalizedTokens(values?: string[] | null) {
  return (values ?? [])
    .flatMap((value) => splitSignalValue(String(value)))
    .filter(Boolean)
}

function venueTagTokens(venue: Venue) {
  return normalizedTokens(
    Array.isArray(venue.tags)
      ? venue.tags.map(String)
      : typeof venue.tags === 'string'
      ? [venue.tags]
      : []
  )
}

function venueVibeTokens(venue: Venue) {
  return normalizedTokens(
    typeof venue.vibe === 'string'
      ? [venue.vibe]
      : Array.isArray((venue as any).vibe)
      ? (venue as any).vibe.map(String)
      : []
  )
}

function overlapCount(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0

  const setB = new Set(b)
  return a.reduce((count, value) => count + (setB.has(value) ? 1 : 0), 0)
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
  routeRole?: EventJourneyRouteRole,
  venue?: Venue
) {
  const role = String(routeRole ?? '').trim().toLowerCase()
  const normalizedType = String(matchedType ?? '').trim().toLowerCase()
  const venueTypes = venue ? getVenueTypes(venue).map((type) => type.toLowerCase()) : []

  if (role === 'meal') return 'meal'
  if (role === 'drinks' || role === 'final_stop') return 'drinks'
  if (role === 'browse') return 'browse'
  if (role === 'reset') return 'reset'
  if (role === 'warmup') return 'coffee'

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

function getRoleAdjustments(
  routeRole: EventJourneyRouteRole | undefined,
  stopOrder: number | undefined,
  remainingStops: number | undefined
) {
  const role = routeRole ?? 'dynamic'

  if (role === 'final_stop') {
    return {
      proximityMultiplier: 0.8,
      progressMultiplier: 1.2,
      directionMultiplier: 1.15,
      offRouteMultiplier: 1.35,
      temporalMultiplier: 1.2,
    }
  }

  if (role === 'warmup' || stopOrder === 1) {
    return {
      proximityMultiplier: 1,
      progressMultiplier: 0.9,
      directionMultiplier: 0.9,
      offRouteMultiplier: 0.8,
      temporalMultiplier: 1,
    }
  }

  if (role === 'meal') {
    return {
      proximityMultiplier: 0.95,
      progressMultiplier: 1,
      directionMultiplier: 1,
      offRouteMultiplier: 1,
      temporalMultiplier: 1.05,
    }
  }

  if (role === 'drinks' || remainingStops === 0) {
    return {
      proximityMultiplier: 0.9,
      progressMultiplier: 1.15,
      directionMultiplier: 1.1,
      offRouteMultiplier: 1.2,
      temporalMultiplier: 1.1,
    }
  }

  return {
    proximityMultiplier: 1,
    progressMultiplier: 1,
    directionMultiplier: 1,
    offRouteMultiplier: 1,
    temporalMultiplier: 1,
  }
}

function getTypeScore(venue: Venue, allowedTypes?: readonly string[]) {
  if (!allowedTypes || allowedTypes.length === 0) {
    return {
      typeScore: 0,
      matchedType: getMatchedType(venue),
      riskFlags: [] as string[],
    }
  }

  const matchedType = getMatchedType(venue, allowedTypes)
  const riskFlags: string[] = []

  if (matchedType) {
    return {
      typeScore: 8,
      matchedType,
      riskFlags,
    }
  }

  riskFlags.push('type mismatch')

  return {
    typeScore: -18,
    matchedType: getMatchedType(venue),
    riskFlags,
  }
}

function getTemporalFitBreakdown({
  venue,
  projectedArrivalTime,
  projectedWindowMinutes,
  openAtArrivalWeight,
  daypartMatchWeight,
  opensWithinWindowWeight,
  closedAtArrivalPenalty,
  daypartMismatchPenalty,
  temporalMultiplier,
}: {
  venue: Venue
  projectedArrivalTime?: DateTime
  projectedWindowMinutes: number
  openAtArrivalWeight: number
  daypartMatchWeight: number
  opensWithinWindowWeight: number
  closedAtArrivalPenalty: number
  daypartMismatchPenalty: number
  temporalMultiplier: number
}) {
  let openAtArrivalScore = 0
  let openSoonScore = 0
  let daypartScore = 0
  let temporalPenalty = 0
  const riskFlags: string[] = []

  if (projectedArrivalTime) {
    const openAtArrival = isVenueOpenAtTime(venue, projectedArrivalTime)
    const openSoon =
      !openAtArrival &&
      isVenueOpenWithinWindow(
        venue,
        projectedArrivalTime,
        projectedWindowMinutes
      )

    const daypartAllowed = daypartAllowedAtTime(venue, projectedArrivalTime)

    if (openAtArrival) {
      openAtArrivalScore = openAtArrivalWeight * temporalMultiplier
    } else if (openSoon) {
      openSoonScore = opensWithinWindowWeight * temporalMultiplier
      riskFlags.push('opens soon')
    } else {
      temporalPenalty += closedAtArrivalPenalty * temporalMultiplier
      riskFlags.push('closed at arrival')
    }

    if (daypartAllowed) {
      daypartScore += daypartMatchWeight * temporalMultiplier
    } else {
      temporalPenalty += daypartMismatchPenalty * temporalMultiplier
      riskFlags.push('daypart mismatch')
    }
  }

  return {
    openAtArrivalScore,
    openSoonScore,
    daypartScore,
    temporalPenalty,
    temporalScore: openAtArrivalScore + openSoonScore + daypartScore,
    riskFlags,
  }
}

function inferTradeoff({
  riskFlags,
  legDistance,
  maxLegDistanceMeters,
  offRouteMeters,
  repeatedExperienceBucket,
}: {
  riskFlags: string[]
  legDistance: number
  maxLegDistanceMeters: number
  offRouteMeters: number
  repeatedExperienceBucket: boolean
}) {
  if (riskFlags.includes('closed at arrival')) return 'closed at arrival'
  if (riskFlags.includes('opens soon')) return 'opens soon'
  if (riskFlags.includes('daypart mismatch')) return 'daypart mismatch'
  if (riskFlags.includes('type mismatch')) return 'weaker type fit'
  if (repeatedExperienceBucket) return 'repeated venue category'
  if (legDistance > maxLegDistanceMeters) return 'longer walk than ideal'
  if (offRouteMeters > 600) return 'slightly off-route'
  return null
}

function inferConfidence({
  total,
  riskFlags,
  matchedType,
}: {
  total: number
  riskFlags: string[]
  matchedType: string | null
}): EventJourneyScoreConfidence {
  if (riskFlags.includes('closed at arrival')) return 'low'
  if (riskFlags.includes('type mismatch')) return total >= 8 ? 'medium' : 'low'
  if (!matchedType) return total >= 10 ? 'medium' : 'low'
  if (riskFlags.length === 0 && total >= 18) return 'high'
  if (total >= 10) return 'medium'
  return 'low'
}

function inferWonOn({
  geographicScore,
  temporalScore,
  semanticScore,
  typeScore,
}: {
  geographicScore: number
  temporalScore: number
  semanticScore: number
  typeScore: number
}): EventJourneyScoreBreakdown['wonOn'] {
  const buckets = [
    { key: 'geographic fit' as const, value: geographicScore },
    { key: 'temporal fit' as const, value: temporalScore },
    { key: 'semantic fit' as const, value: semanticScore },
    { key: 'type fit' as const, value: typeScore },
  ].sort((a, b) => b.value - a.value)

  if (buckets.length < 2) return 'balanced fit'

  const top = buckets[0]
  const second = buckets[1]

  if (top.value - second.value < 2) return 'balanced fit'
  return top.key
}

export function venueMatchesEventSignals(
  venue: Venue,
  signals?: EventJourneySignals
) {
  const tags = normalizedTokens(signals?.tags)
  const vibes = normalizedTokens(signals?.vibes)

  const venueTags = venueTagTokens(venue)
  const venueVibes = venueVibeTokens(venue)

  return {
    tagMatches: overlapCount(venueTags, tags),
    vibeMatches: overlapCount(venueVibes, vibes),
  }
}

export function computeDirectionalProgressMeters(
  current: LatLon,
  destination: LatLon,
  venue: Pick<Venue, 'lat' | 'lon'>
) {
  const currentToDestination = distanceMeters(
    current.lat,
    current.lon,
    destination.lat,
    destination.lon
  )

  const venueToDestination = distanceMeters(
    venue.lat,
    venue.lon,
    destination.lat,
    destination.lon
  )

  return currentToDestination - venueToDestination
}

export function scoreEventJourneyVenue({
  venue,
  current,
  destination,
  allowedTypes,
  signals,
  maxLegDistanceMeters = 1200,
  progressWeight = 1 / 150,
  proximityWeight = 1 / 200,
  directionWeight = 4,
  vibeWeight = 2,
  tagWeight = 1.5,
  offRouteWeight = 1 / 250,

  projectedArrivalTime,
  projectedWindowMinutes = 30,
  openAtArrivalWeight = 4,
  daypartMatchWeight = 2,
  opensWithinWindowWeight = 1.5,
  closedAtArrivalPenalty = 6,
  daypartMismatchPenalty = 3,

  routeRole,
  stopOrder,
  remainingStops,
  previousMatchedType,
  previousExperienceBucket,
}: EventJourneyScoringInput): EventJourneyScoreBreakdown {
  const roleAdjustments = getRoleAdjustments(routeRole, stopOrder, remainingStops)

  const legDistance = distanceMeters(
    current.lat,
    current.lon,
    venue.lat,
    venue.lon
  )

  const progressMeters = computeDirectionalProgressMeters(
    current,
    destination,
    venue
  )

  const currentToDestination = distanceMeters(
    current.lat,
    current.lon,
    destination.lat,
    destination.lon
  )

  const currentVector = {
    x: destination.lon - current.lon,
    y: destination.lat - current.lat,
  }

  const candidateVector = {
    x: venue.lon - current.lon,
    y: venue.lat - current.lat,
  }

  const cosineSimilarity = normalizedSimilarity(
    currentVector.x,
    currentVector.y,
    candidateVector.x,
    candidateVector.y
  )

  const directionScore =
    Math.max(0, cosineSimilarity) *
    directionWeight *
    roleAdjustments.directionMultiplier

  const offRouteMeters = perpendicularDistanceToCorridorMeters(
    current,
    destination,
    {
      lat: venue.lat,
      lon: venue.lon,
    }
  )

  const offRoutePenalty =
    offRouteMeters *
    offRouteWeight *
    roleAdjustments.offRouteMultiplier

  const proximityScore =
    Math.max(0, (maxLegDistanceMeters - legDistance) * proximityWeight) *
    roleAdjustments.proximityMultiplier

  const progressScore =
    Math.max(0, progressMeters * progressWeight) *
    roleAdjustments.progressMultiplier

  const { vibeMatches, tagMatches } = venueMatchesEventSignals(venue, signals)

  const vibeScore = vibeMatches * vibeWeight
  const tagScore = tagMatches * tagWeight

  let legDistancePenalty = 0
  const riskFlags: string[] = []

  if (legDistance > maxLegDistanceMeters) {
    legDistancePenalty = ((legDistance - maxLegDistanceMeters) / 100) * 1.5
    riskFlags.push('long leg')
  }

  const temporalBreakdown = getTemporalFitBreakdown({
    venue,
    projectedArrivalTime,
    projectedWindowMinutes,
    openAtArrivalWeight,
    daypartMatchWeight,
    opensWithinWindowWeight,
    closedAtArrivalPenalty,
    daypartMismatchPenalty,
    temporalMultiplier: roleAdjustments.temporalMultiplier,
  })

  const typeBreakdown = getTypeScore(venue, allowedTypes)

  riskFlags.push(...typeBreakdown.riskFlags, ...temporalBreakdown.riskFlags)

  let geographicScore =
    proximityScore +
    progressScore +
    directionScore -
    offRoutePenalty -
    legDistancePenalty

  if (progressMeters <= 0 && currentToDestination > 250) {
    geographicScore -= 6
    riskFlags.push('weak forward progress')
  }

  const semanticScore = vibeScore + tagScore
  const typeScore = typeBreakdown.typeScore
  const temporalScore = temporalBreakdown.temporalScore

  const experientialBucket = inferExperienceBucket(
    typeBreakdown.matchedType,
    routeRole,
    venue
  )

  const normalizedPreviousBucket =
    previousExperienceBucket ??
    inferExperienceBucket(previousMatchedType, undefined, undefined)

  const repeatedExperienceBucket =
    Boolean(normalizedPreviousBucket) &&
    Boolean(experientialBucket) &&
    normalizedPreviousBucket === experientialBucket

  const repetitionPenalty = repeatedExperienceBucket
    ? EXPERIENCE_REPETITION_PENALTY
    : 0

  if (repeatedExperienceBucket) {
    riskFlags.push('repeated experience bucket')
  }

  const riskPenalty = temporalBreakdown.temporalPenalty + repetitionPenalty

  const total =
    geographicScore +
    semanticScore +
    typeScore +
    temporalScore -
    riskPenalty

  const tradeoff = inferTradeoff({
    riskFlags,
    legDistance,
    maxLegDistanceMeters,
    offRouteMeters,
    repeatedExperienceBucket,
  })

  const confidence = inferConfidence({
    total,
    riskFlags,
    matchedType: typeBreakdown.matchedType,
  })

  const wonOn = inferWonOn({
    geographicScore,
    temporalScore,
    semanticScore,
    typeScore,
  })

  return {
    total,

    progressScore,
    proximityScore,
    directionScore,
    vibeScore,
    tagScore,
    temporalScore,
    openAtArrivalScore: temporalBreakdown.openAtArrivalScore,
    openSoonScore: temporalBreakdown.openSoonScore,
    daypartScore: temporalBreakdown.daypartScore,
    offRoutePenalty,
    legDistancePenalty,
    temporalPenalty: temporalBreakdown.temporalPenalty,

    geographicScore,
    semanticScore,
    typeScore,
    riskPenalty,

    experientialBucket,
    repetitionPenalty,
    repeatedExperienceBucket,

    matchedType: typeBreakdown.matchedType,
    confidence,
    wonOn,
    tradeoff,
    riskFlags: Array.from(new Set(riskFlags)),
  }
}

export function rankEventJourneyVenues(
  venues: Venue[],
  input: Omit<EventJourneyScoringInput, 'venue'>
) {
  return venues
    .map((venue) => ({
      venue,
      score: scoreEventJourneyVenue({
        ...input,
        venue,
      }),
    }))
    .sort((a, b) => b.score.total - a.score.total)
}