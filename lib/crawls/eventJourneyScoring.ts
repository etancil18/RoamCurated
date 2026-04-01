import type { Venue } from '@/types/venue'
import {
  getVenueTypes,
  venueMatchesAnyType,
} from '@/lib/venues/typeMatching'

type LatLon = {
  lat: number
  lon: number
}

type EventJourneySignals = {
  vibes?: string[] | null
  tags?: string[] | null
}

type EventJourneyScoringInput = {
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
}

export type EventJourneyScoreBreakdown = {
  total: number
  progressScore: number
  proximityScore: number
  directionScore: number
  vibeScore: number
  tagScore: number
  offRoutePenalty: number
  legDistancePenalty: number
}

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

/* ------------------------------------------------ */
/* Signal normalization                             */
/* ------------------------------------------------ */

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
}: EventJourneyScoringInput): EventJourneyScoreBreakdown {
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

  const currentVector = approxXYMeters(current, destination)
  const candidateVector = approxXYMeters(current, {
    lat: venue.lat,
    lon: venue.lon,
  })

  const cosineSimilarity = normalizedSimilarity(
    currentVector.x,
    currentVector.y,
    candidateVector.x,
    candidateVector.y
  )

  const directionScore = Math.max(0, cosineSimilarity) * directionWeight

  const offRouteMeters = perpendicularDistanceToCorridorMeters(
    current,
    destination,
    {
      lat: venue.lat,
      lon: venue.lon,
    }
  )

  const offRoutePenalty = offRouteMeters * offRouteWeight

  const proximityScore = Math.max(
    0,
    (maxLegDistanceMeters - legDistance) * proximityWeight
  )

  const progressScore = Math.max(0, progressMeters * progressWeight)

  const { vibeMatches, tagMatches } = venueMatchesEventSignals(
    venue,
    signals
  )

  const vibeScore = vibeMatches * vibeWeight
  const tagScore = tagMatches * tagWeight

  let legDistancePenalty = 0
  if (legDistance > maxLegDistanceMeters) {
    legDistancePenalty =
      ((legDistance - maxLegDistanceMeters) / 100) * 1.25
  }

  let total =
    proximityScore +
    progressScore +
    directionScore +
    vibeScore +
    tagScore -
    offRoutePenalty -
    legDistancePenalty

  if (
    allowedTypes &&
    allowedTypes.length > 0 &&
    !venueMatchesAnyType(venue, allowedTypes)
  ) {
    total -= 100
  }

  const venueTypes = getVenueTypes(venue)
  if (
    allowedTypes &&
    allowedTypes.length > 0 &&
    venueTypes.some((type) => allowedTypes.includes(type))
  ) {
    total += 2
  }

  if (progressMeters <= 0 && currentToDestination > 250) {
    total -= 6
  }

  return {
    total,
    progressScore,
    proximityScore,
    directionScore,
    vibeScore,
    tagScore,
    offRoutePenalty,
    legDistancePenalty,
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