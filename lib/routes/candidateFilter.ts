// lib/routes/candidateFilter.ts

import { DateTime } from 'luxon'
import type { RouteStage } from './routeStages'
import {
  type NormalizedVenueType,
  hasAnyVenueType,
  normalizeVenueTypes,
} from './venueTypeNormalization'
import {
  hasHoursForDayFromHours,
  isVenueOpenAtTimeFromHours,
} from '@/utils/hoursTimeUtils'

export type CandidateFilterTravelMode = 'walking' | 'cycling' | 'driving'

export type CandidateFilterVenue = {
  id?: string | null
  name?: string | null
  slug?: string | null
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
  is_active?: boolean | null
  active?: boolean | null
  permanently_closed?: boolean | null
  closed?: boolean | null
}

export type CandidateFilterReason =
  | 'same_as_anchor'
  | 'already_selected'
  | 'explicitly_excluded'
  | 'missing_coordinates'
  | 'invalid_coordinates'
  | 'inactive'
  | 'permanently_closed'
  | 'too_far'
  | 'weak_stage_match'
  | 'likely_closed'

export type CandidateFilterRejectedVenue = {
  venue: CandidateFilterVenue
  reason: CandidateFilterReason
  distanceMeters: number | null
}

export type CandidateFilterResult = {
  candidates: CandidateFilterVenue[]
  rejected: CandidateFilterRejectedVenue[]
}

export type CandidateFilterParams = {
  venues: CandidateFilterVenue[]
  anchorVenue: CandidateFilterVenue
  previousStop?: CandidateFilterVenue | null
  stage?: RouteStage | null
  arrivalAt?: Date | null
  selectedVenueIds?: Set<string>
  excludedVenueIds?: Set<string> | string[]
  travelMode?: CandidateFilterTravelMode
  maxDistanceMeters?: number
  requireStageMatch?: boolean
  excludeLikelyClosed?: boolean
  timezone?: string | null
}

const DEFAULT_MAX_DISTANCE_METERS_BY_MODE: Record<
  CandidateFilterTravelMode,
  number
> = {
  walking: 2200,
  cycling: 5500,
  driving: 11000,
}

export function filterRouteCandidates({
  venues,
  anchorVenue,
  previousStop = null,
  stage = null,
  arrivalAt = null,
  selectedVenueIds = new Set<string>(),
  excludedVenueIds = new Set<string>(),
  travelMode = 'walking',
  maxDistanceMeters = DEFAULT_MAX_DISTANCE_METERS_BY_MODE[travelMode],
  requireStageMatch = false,
  excludeLikelyClosed = false,
  timezone = null,
}: CandidateFilterParams): CandidateFilterResult {
  const candidates: CandidateFilterVenue[] = []
  const rejected: CandidateFilterRejectedVenue[] = []

  const comparisonVenue = previousStop ?? anchorVenue
  const excludedVenueIdSet = normalizeIdSet(excludedVenueIds)

  for (const venue of venues) {
    const distanceMeters = getDistanceFromComparisonVenue(
      comparisonVenue,
      venue
    )

    const rejectionReason = getCandidateRejectionReason({
      venue,
      anchorVenue,
      stage,
      arrivalAt,
      selectedVenueIds,
      excludedVenueIds: excludedVenueIdSet,
      maxDistanceMeters,
      distanceMeters,
      requireStageMatch,
      excludeLikelyClosed,
      timezone,
    })

    if (rejectionReason) {
      rejected.push({
        venue,
        reason: rejectionReason,
        distanceMeters,
      })

      continue
    }

    candidates.push(venue)
  }

  return {
    candidates,
    rejected,
  }
}

export function summarizeRejections(
  rejected: CandidateFilterRejectedVenue[]
): Partial<Record<CandidateFilterReason, number>> {
  return rejected.reduce<Partial<Record<CandidateFilterReason, number>>>(
    (acc, item) => {
      acc[item.reason] = (acc[item.reason] ?? 0) + 1
      return acc
    },
    {}
  )
}

export function getCandidateRejectionReason({
  venue,
  anchorVenue,
  stage = null,
  arrivalAt = null,
  selectedVenueIds = new Set<string>(),
  excludedVenueIds = new Set<string>(),
  maxDistanceMeters,
  distanceMeters,
  requireStageMatch = false,
  excludeLikelyClosed = false,
  timezone = null,
}: {
  venue: CandidateFilterVenue
  anchorVenue: CandidateFilterVenue
  stage?: RouteStage | null
  arrivalAt?: Date | null
  selectedVenueIds?: Set<string>
  excludedVenueIds?: Set<string>
  maxDistanceMeters: number
  distanceMeters: number | null
  requireStageMatch?: boolean
  excludeLikelyClosed?: boolean
  timezone?: string | null
}): CandidateFilterReason | null {
  if (isSameVenue(venue, anchorVenue)) {
    return 'same_as_anchor'
  }

  if (venue.id && selectedVenueIds.has(venue.id)) {
    return 'already_selected'
  }

  if (venue.id && excludedVenueIds.has(venue.id)) {
    return 'explicitly_excluded'
  }

  if (!hasCoordinateFields(venue)) {
    return 'missing_coordinates'
  }

  if (!hasValidCoordinates(venue)) {
    return 'invalid_coordinates'
  }

  if (isInactiveVenue(venue)) {
    return 'inactive'
  }

  if (isPermanentlyClosedVenue(venue)) {
    return 'permanently_closed'
  }

  if (
    typeof distanceMeters === 'number' &&
    Number.isFinite(distanceMeters) &&
    distanceMeters > maxDistanceMeters
  ) {
    return 'too_far'
  }

  if (requireStageMatch && stage && !venueMatchesStage(venue, stage)) {
    return 'weak_stage_match'
  }

  if (
    excludeLikelyClosed &&
    arrivalAt &&
    isLikelyClosedAtArrival(venue, arrivalAt, timezone)
  ) {
    return 'likely_closed'
  }

  return null
}

export function venueMatchesStage(
  venue: CandidateFilterVenue,
  stage: RouteStage
): boolean {
  const venueTypes = normalizeVenueTypes(venue)
  const stageTypes = stage.types
    .map((type) => normalizeRouteStageType(type))
    .filter((type): type is NormalizedVenueType => Boolean(type))

  if (venueTypes.length === 0 || stageTypes.length === 0) {
    return false
  }

  return hasAnyVenueType(venue, stageTypes)
}

export function isLikelyClosedAtArrival(
  venue: CandidateFilterVenue,
  arrivalAt: Date,
  timezone: string | null = null
): boolean {
  if (!venue.hours) {
    return true
  }

  const arrivalDateTime = timezone
    ? DateTime.fromJSDate(arrivalAt).setZone(timezone)
    : DateTime.fromJSDate(arrivalAt)

  if (!arrivalDateTime.isValid) {
    return true
  }

  if (!hasHoursForDayFromHours(venue.hours, arrivalDateTime)) {
    return true
  }

  return !isVenueOpenAtTimeFromHours(venue, arrivalDateTime)
}

export function getDistanceFromComparisonVenue(
  comparisonVenue: CandidateFilterVenue | null | undefined,
  venue: CandidateFilterVenue
): number | null {
  if (!comparisonVenue) return null

  if (!hasValidCoordinates(comparisonVenue) || !hasValidCoordinates(venue)) {
    return null
  }

  return calculateDistanceMeters({
    fromLat: comparisonVenue.lat as number,
    fromLon: comparisonVenue.lon as number,
    toLat: venue.lat as number,
    toLon: venue.lon as number,
  })
}

export function hasValidCoordinates(
  venue: CandidateFilterVenue | null | undefined
): boolean {
  return (
    typeof venue?.lat === 'number' &&
    Number.isFinite(venue.lat) &&
    Math.abs(venue.lat) <= 90 &&
    typeof venue?.lon === 'number' &&
    Number.isFinite(venue.lon) &&
    Math.abs(venue.lon) <= 180
  )
}

function normalizeIdSet(value: Set<string> | string[]): Set<string> {
  if (value instanceof Set) {
    return value
  }

  if (Array.isArray(value)) {
    return new Set(value.map((item) => String(item).trim()).filter(Boolean))
  }

  return new Set<string>()
}

function hasCoordinateFields(
  venue: CandidateFilterVenue | null | undefined
): boolean {
  return venue?.lat !== undefined && venue?.lat !== null && venue?.lon !== undefined && venue?.lon !== null
}

function isSameVenue(
  venueA: CandidateFilterVenue,
  venueB: CandidateFilterVenue
): boolean {
  if (venueA.id && venueB.id && venueA.id === venueB.id) return true
  if (venueA.slug && venueB.slug && venueA.slug === venueB.slug) return true

  return false
}

function isInactiveVenue(venue: CandidateFilterVenue): boolean {
  if (venue.is_active === false) return true
  if (venue.active === false) return true

  return false
}

function isPermanentlyClosedVenue(venue: CandidateFilterVenue): boolean {
  if (venue.permanently_closed === true) return true
  if (venue.closed === true) return true

  return false
}

function normalizeRouteStageType(value: string): NormalizedVenueType | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[–—-]/g, '-')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const aliases: Record<string, NormalizedVenueType> = {
    activity: 'activity',
    afternoon_tea: 'afternoon_tea',
    bakery: 'bakery',
    bar: 'bar',
    bistro: 'bistro',
    bistrot: 'bistro',
    bookshop: 'bookstore',
    bookstore: 'bookstore',
    breakfast: 'breakfast',
    brewery: 'brewery',
    brunch: 'brunch',
    cafe: 'cafe',
    café: 'cafe',
    cinema: 'cinema',
    class: 'class',
    club: 'club',
    cocktail: 'cocktail',
    cocktails: 'cocktail',
    coffee: 'coffee',
    comedy: 'comedy',
    dessert: 'dessert',
    dinner: 'dinner',
    event_space: 'event_space',
    event_venue: 'event_venue',
    fitness: 'fitness',
    food_court: 'food_court',
    gallery: 'gallery',
    garden: 'garden',
    happy_hour: 'happy_hour',
    juice_bar: 'juice_bar',
    late_night: 'late_night',
    late_night_: 'late_night',
    library: 'library',
    lifestyle: 'lifestyle',
    live_music: 'music',
    lounge: 'lounge',
    lunch: 'lunch',
    market: 'market',
    museum: 'museum',
    music: 'music',
    nature: 'nature',
    park: 'park',
    patio: 'patio',
    pilates: 'pilates',
    pub: 'pub',
    random_gem: 'random_gem',
    restaurant: 'restaurant',
    rooftop: 'rooftop',
    show: 'show',
    showroom: 'showroom',
    smoothie: 'smoothie',
    spa: 'spa',
    speakeasy: 'speakeasy',
    sports_bar: 'sports_bar',
    stadium: 'stadium',
    tea: 'tea',
    theater: 'theater',
    theatre: 'theater',
    walk: 'walk',
    wellness: 'wellness',
    wine_bar: 'wine_bar',
    workspace: 'workspace',
    yoga: 'yoga',
  }

  return aliases[normalized] ?? null
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

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}