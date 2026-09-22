// lib/routes/collectionRouteContext.ts

import {
  buildRouteContext,
  type RouteContext,
  type RouteContextTravelMode,
  type RouteTightness,
} from './buildContext'
import {
  type RouteStage,
  getCandidateStagesAfter,
  getDayKindFromWeekday,
  getRouteStageForHour,
} from './routeStages'
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
import {
  extractStringList,
  normalizeSearchKey,
  uniqueStrings,
} from './routeUtils'
import type { UserRoutePersonalization } from './personalization'

export type CollectionRouteContextVenue = {
  id?: string | null
  name?: string | null
  slug?: string | null
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
  is_active?: boolean | null
  active?: boolean | null
  permanently_closed?: boolean | null
  closed?: boolean | null
}

export type CollectionRouteContextCollection = {
  id: string
  creatorUserId: string
  title: string
  description?: string | null
  city?: string | null
}

export type CollectionStageInventory = {
  stage: RouteStage
  matchingVenueIds: string[]
  matchingVenueCount: number
}

export type CollectionRouteContext = {
  collectionId: string
  collectionCreatorUserId: string
  collectionTitle: string
  collectionDescription: string | null
  city: string | null
  plannedStartAt: Date
  weekdayKey: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  localHour: number
  travelMode: RouteContextTravelMode
  tightness: RouteTightness
  maxStops: number
  usableCollectionVenues: CollectionRouteContextVenue[]
  freshCollectionVenues: CollectionRouteContextVenue[]
  experiencedCollectionVenues: CollectionRouteContextVenue[]
  collectionVenueIds: Set<string>
  freshCollectionVenueIds: Set<string>
  experiencedCollectionVenueIds: Set<string>
  dominantTypes: NormalizedVenueType[]
  preferredVibes: string[]
  preferredTags: string[]
  startingStage: RouteStage
  candidateStages: RouteStage[]
  stageInventory: CollectionStageInventory[]
  hasUsableCollectionCoordinates: boolean
  anchorSeedVenue: CollectionRouteContextVenue | null
  anchorSeedContext: RouteContext | null
}

export type BuildCollectionRouteContextParams = {
  collection: CollectionRouteContextCollection
  collectionVenues: CollectionRouteContextVenue[]
  plannedStartAt?: Date | string | null
  travelMode?: RouteContextTravelMode
  tightness?: RouteTightness
  maxStops?: number
  preferredVibes?: string[]
  preferredTags?: string[]
  personalization?: UserRoutePersonalization | null
  timezone?: string | null
}

const DEFAULT_MAX_STOPS = 5

export function buildCollectionRouteContext({
  collection,
  collectionVenues,
  plannedStartAt = null,
  travelMode = 'walking',
  tightness = 'medium',
  maxStops = DEFAULT_MAX_STOPS,
  preferredVibes = [],
  preferredTags = [],
  personalization = null,
  timezone = null,
}: BuildCollectionRouteContextParams): CollectionRouteContext {
  const safePlannedStartAt = coerceDate(plannedStartAt ?? new Date())
  const safeMaxStops = sanitizeMaxStops(maxStops)
  const weekdayKey = getLocalDayKey(safePlannedStartAt, timezone)
  const localHour = getLocalHour(safePlannedStartAt, timezone)
  const dayKind = getDayKindFromWeekday(dayKeyToIsoWeekday(weekdayKey))

  const usableCollectionVenues = dedupeCollectionVenues(
    collectionVenues.filter(isUsableCollectionVenue)
  )

  const collectionVenueIds = new Set(
    usableCollectionVenues
      .map(getVenueIdentity)
      .filter((id): id is string => Boolean(id))
  )

  const experiencedCollectionVenues = usableCollectionVenues.filter((venue) =>
    isExperiencedVenue(venue, personalization)
  )

  const experiencedCollectionVenueIds = new Set(
    experiencedCollectionVenues
      .map(getVenueIdentity)
      .filter((id): id is string => Boolean(id))
  )

  const freshCollectionVenues = usableCollectionVenues.filter(
    (venue) => !isExperiencedVenue(venue, personalization)
  )

  const freshCollectionVenueIds = new Set(
    freshCollectionVenues
      .map(getVenueIdentity)
      .filter((id): id is string => Boolean(id))
  )

  const dominantTypes = getDominantCollectionTypes(usableCollectionVenues)

  const collectionPreferredVibes = deriveCollectionValues(
    usableCollectionVenues.map((venue) => venue.vibe)
  )

  const collectionPreferredTags = deriveCollectionValues(
    usableCollectionVenues.flatMap((venue) => [
      venue.tags,
      venue.category,
      venue.categories,
    ])
  )

  const resolvedPreferredVibes = mergePreferenceValues(
    preferredVibes,
    collectionPreferredVibes
  )

  const resolvedPreferredTags = mergePreferenceValues(
    preferredTags,
    collectionPreferredTags
  )

  const anchorSeedVenue = selectAnchorSeedVenue({
    venues:
      freshCollectionVenues.length > 0
        ? freshCollectionVenues
        : usableCollectionVenues,
    localHour,
  })

  const anchorSeedContext = anchorSeedVenue
    ? buildRouteContext({
        anchorVenue: anchorSeedVenue,
        city: collection.city ?? anchorSeedVenue.city ?? null,
        plannedStartAt: safePlannedStartAt,
        travelMode,
        tightness,
        maxStops: safeMaxStops,
        preferredVibes: resolvedPreferredVibes,
        preferredTags: resolvedPreferredTags,
      })
    : null

  const startingStage =
    anchorSeedContext?.startingStage ?? getRouteStageForHour(localHour)

  const candidateStages = getCandidateStagesAfter({
    stageId: startingStage.id,
    maxStages: safeMaxStops,
    includeCurrentStage: true,
    dayKind,
    startHour: localHour,
  })

  const stageInventory = candidateStages.map((stage) =>
    buildStageInventory(stage, usableCollectionVenues)
  )

  return {
    collectionId: collection.id,
    collectionCreatorUserId: collection.creatorUserId,
    collectionTitle: collection.title,
    collectionDescription: collection.description ?? null,
    city:
      collection.city ??
      anchorSeedVenue?.city ??
      inferCollectionCity(usableCollectionVenues),
    plannedStartAt: safePlannedStartAt,
    weekdayKey,
    localHour,
    travelMode,
    tightness,
    maxStops: safeMaxStops,
    usableCollectionVenues,
    freshCollectionVenues,
    experiencedCollectionVenues,
    collectionVenueIds,
    freshCollectionVenueIds,
    experiencedCollectionVenueIds,
    dominantTypes,
    preferredVibes: resolvedPreferredVibes,
    preferredTags: resolvedPreferredTags,
    startingStage,
    candidateStages,
    stageInventory,
    hasUsableCollectionCoordinates: usableCollectionVenues.some((venue) =>
      hasValidCoordinates(venue)
    ),
    anchorSeedVenue,
    anchorSeedContext,
  }
}

export function getCollectionStageInventory(
  context: CollectionRouteContext,
  stage: RouteStage
): CollectionStageInventory {
  return (
    context.stageInventory.find((item) => item.stage.id === stage.id) ??
    buildStageInventory(stage, context.usableCollectionVenues)
  )
}

export function getFreshCollectionStageVenues(
  context: CollectionRouteContext,
  stage: RouteStage
): CollectionRouteContextVenue[] {
  return context.freshCollectionVenues.filter((venue) =>
    venueMatchesCollectionStage(venue, stage)
  )
}

export function venueMatchesCollectionStage(
  venue: CollectionRouteContextVenue,
  stage: RouteStage
): boolean {
  const venueTypes = normalizeVenueTypes(venue)

  if (venueTypes.length === 0 || stage.types.length === 0) {
    return false
  }

  const stageTypeKeys = new Set(
    stage.types.map(normalizeSearchKey).filter(Boolean)
  )

  return venueTypes.some((type) =>
    stageTypeKeys.has(normalizeSearchKey(type))
  )
}

function buildStageInventory(
  stage: RouteStage,
  venues: CollectionRouteContextVenue[]
): CollectionStageInventory {
  const matchingVenueIds = venues
    .filter((venue) => venueMatchesCollectionStage(venue, stage))
    .map(getVenueIdentity)
    .filter((id): id is string => Boolean(id))

  return {
    stage,
    matchingVenueIds,
    matchingVenueCount: matchingVenueIds.length,
  }
}

function selectAnchorSeedVenue({
  venues,
  localHour,
}: {
  venues: CollectionRouteContextVenue[]
  localHour: number
}): CollectionRouteContextVenue | null {
  if (venues.length === 0) return null

  const timeStage = getRouteStageForHour(localHour)
  const contextualMatches = venues.filter((venue) =>
    venueMatchesCollectionStage(venue, timeStage)
  )

  if (contextualMatches.length === 0) {
    return null
  }

  return (
    [...contextualMatches].sort((a, b) => {
      const aCoordinates = hasValidCoordinates(a) ? 1 : 0
      const bCoordinates = hasValidCoordinates(b) ? 1 : 0

      if (aCoordinates !== bCoordinates) {
        return bCoordinates - aCoordinates
      }

      const aTypeCount = normalizeVenueTypes(a).length
      const bTypeCount = normalizeVenueTypes(b).length

      if (aTypeCount !== bTypeCount) {
        return bTypeCount - aTypeCount
      }

      return getStableVenueKey(a).localeCompare(getStableVenueKey(b))
    })[0] ?? null
  )
}

function getDominantCollectionTypes(
  venues: CollectionRouteContextVenue[]
): NormalizedVenueType[] {
  const counts = new Map<NormalizedVenueType, number>()

  for (const venue of venues) {
    for (const type of normalizeVenueTypes(venue)) {
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .map(([type]) => type)
}

function deriveCollectionValues(values: unknown[]): string[] {
  const counts = new Map<string, { value: string; count: number }>()

  for (const rawValue of values) {
    for (const value of extractStringList(rawValue)) {
      const key = normalizeSearchKey(value)

      if (!key) continue

      const existing = counts.get(key)

      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, {
          value: value.trim(),
          count: 1,
        })
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (a[1].count !== b[1].count) {
        return b[1].count - a[1].count
      }

      return a[0].localeCompare(b[0])
    })
    .map(([, item]) => item.value)
}

function mergePreferenceValues(
  explicitValues: string[],
  collectionValues: string[]
): string[] {
  const explicit = uniqueStrings(
    explicitValues.map((value) => value.trim()).filter(Boolean)
  )

  if (explicit.length > 0) {
    return explicit
  }

  return collectionValues
}

function isUsableCollectionVenue(
  venue: CollectionRouteContextVenue
): boolean {
  if (!getVenueIdentity(venue)) return false
  if (venue.is_active === false) return false
  if (venue.active === false) return false
  if (venue.permanently_closed === true) return false
  if (venue.closed === true) return false

  return true
}

function isExperiencedVenue(
  venue: CollectionRouteContextVenue,
  personalization: UserRoutePersonalization | null
): boolean {
  if (!personalization) return false

  const id = normalizeOptionalIdentity(venue.id)
  const slug = normalizeOptionalIdentity(venue.slug)

  return (
    matchesPersonalizationIdentity(
      id,
      personalization.visitedVenueIds
    ) ||
    matchesPersonalizationIdentity(
      slug,
      personalization.visitedVenueSlugs
    ) ||
    matchesPersonalizationIdentity(
      id,
      personalization.completedVenueIds
    ) ||
    matchesPersonalizationIdentity(
      slug,
      personalization.completedVenueSlugs
    )
  )
}

function matchesPersonalizationIdentity(
  value: string | null,
  candidates?: string[] | null
): boolean {
  if (!value || !Array.isArray(candidates)) return false

  const normalizedValue = normalizeSearchKey(value)

  return candidates.some(
    (candidate) => normalizeSearchKey(candidate) === normalizedValue
  )
}

function dedupeCollectionVenues(
  venues: CollectionRouteContextVenue[]
): CollectionRouteContextVenue[] {
  const seen = new Set<string>()

  return venues.filter((venue) => {
    const key = getVenueIdentity(venue)

    if (!key) return false
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function getVenueIdentity(
  venue: CollectionRouteContextVenue
): string | null {
  const id = normalizeOptionalIdentity(venue.id)

  if (id) return `id:${normalizeSearchKey(id)}`

  const slug = normalizeOptionalIdentity(venue.slug)

  if (slug) return `slug:${normalizeSearchKey(slug)}`

  return null
}

function normalizeOptionalIdentity(value?: string | null): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

function getStableVenueKey(venue: CollectionRouteContextVenue): string {
  return (
    getVenueIdentity(venue) ??
    normalizeSearchKey(venue.name ?? '') ??
    ''
  )
}

function inferCollectionCity(
  venues: CollectionRouteContextVenue[]
): string | null {
  const cityCounts = new Map<string, { city: string; count: number }>()

  for (const venue of venues) {
    const city = venue.city?.trim()

    if (!city) continue

    const key = normalizeSearchKey(city)

    if (!key) continue

    const existing = cityCounts.get(key)

    if (existing) {
      existing.count += 1
    } else {
      cityCounts.set(key, {
        city,
        count: 1,
      })
    }
  }

  return (
    [...cityCounts.entries()]
      .sort((a, b) => {
        if (a[1].count !== b[1].count) {
          return b[1].count - a[1].count
        }

        return a[0].localeCompare(b[0])
      })[0]?.[1].city ?? null
  )
}

function dayKeyToIsoWeekday(
  dayKey: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
): number {
  switch (dayKey) {
    case 'mon':
      return 1
    case 'tue':
      return 2
    case 'wed':
      return 3
    case 'thu':
      return 4
    case 'fri':
      return 5
    case 'sat':
      return 6
    case 'sun':
      return 7
  }
}

function sanitizeMaxStops(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_STOPS
  return Math.max(3, Math.min(8, Math.round(value)))
}