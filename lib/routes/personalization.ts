// lib/routes/personalization.ts

import {
  type NormalizedVenueType,
  hasAnyVenueType,
  normalizeVenueTypes,
} from './venueTypeNormalization'
import {
  extractStringList,
  normalizeSearchKey,
} from './routeUtils'

export type PersonalizationVenue = {
  id?: string | null
  slug?: string | null
  name?: string | null
  city?: string | null
  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown
  tags?: unknown
  vibe?: unknown
  price?: string | null
}

export type UserRoutePersonalization = {
  preferredVibes?: string[] | null
  interestCategories?: string[] | null
  savedVenueIds?: string[] | null
  savedVenueSlugs?: string[] | null
  visitedVenueIds?: string[] | null
  visitedVenueSlugs?: string[] | null
  dislikedVenueIds?: string[] | null
  dislikedVenueSlugs?: string[] | null
  completedVenueIds?: string[] | null
  completedVenueSlugs?: string[] | null
  preferredTypes?: string[] | null
  avoidedTypes?: string[] | null
  preferredPrice?: string | null
  homeCity?: string | null
}

export type PersonalizationReason = {
  key:
    | 'preferred_vibe'
    | 'interest_match'
    | 'saved_venue'
    | 'visited_venue'
    | 'completed_venue'
    | 'disliked_venue'
    | 'preferred_type'
    | 'avoided_type'
    | 'price_preference'
    | 'home_city'
  label: string
  delta: number
}

export type PersonalizationScore = {
  score: number
  reasons: PersonalizationReason[]
}

const MAX_PERSONALIZATION_BOOST = 34
const MAX_PERSONALIZATION_PENALTY = -42

export function scorePersonalization({
  venue,
  personalization,
}: {
  venue: PersonalizationVenue
  personalization?: UserRoutePersonalization | null
}): PersonalizationScore {
  if (!personalization) {
    return {
      score: 0,
      reasons: [],
    }
  }

  const reasons: PersonalizationReason[] = []

  const venueId = venue.id ?? null
  const venueSlug = venue.slug ?? null
  const venueTypes = normalizeVenueTypes(venue)

  const preferredVibeScore = scoreStringOverlap({
    candidateValues: extractStringList(venue.vibe),
    preferredValues: personalization.preferredVibes ?? [],
    maxScore: 10,
  })

  if (preferredVibeScore > 0) {
    reasons.push({
      key: 'preferred_vibe',
      label: 'Matches preferred vibe.',
      delta: preferredVibeScore,
    })
  }

  const interestScore = scoreStringOverlap({
    candidateValues: [
      ...extractStringList(venue.tags),
      ...extractStringList(venue.category),
      ...extractStringList(venue.categories),
      ...venueTypes,
    ],
    preferredValues: personalization.interestCategories ?? [],
    maxScore: 10,
  })

  if (interestScore > 0) {
    reasons.push({
      key: 'interest_match',
      label: 'Matches stated interests.',
      delta: interestScore,
    })
  }

  if (
    isInList(venueId, personalization.savedVenueIds) ||
    isInList(venueSlug, personalization.savedVenueSlugs)
  ) {
    reasons.push({
      key: 'saved_venue',
      label: 'User saved this venue before.',
      delta: 12,
    })
  }

  if (
    isInList(venueId, personalization.visitedVenueIds) ||
    isInList(venueSlug, personalization.visitedVenueSlugs)
  ) {
    reasons.push({
      key: 'visited_venue',
      label: 'User has visited this venue before.',
      delta: -8,
    })
  }

  if (
    isInList(venueId, personalization.completedVenueIds) ||
    isInList(venueSlug, personalization.completedVenueSlugs)
  ) {
    reasons.push({
      key: 'completed_venue',
      label: 'User already completed this venue in a prior route.',
      delta: -10,
    })
  }

  if (
    isInList(venueId, personalization.dislikedVenueIds) ||
    isInList(venueSlug, personalization.dislikedVenueSlugs)
  ) {
    reasons.push({
      key: 'disliked_venue',
      label: 'User has negatively signaled this venue.',
      delta: -40,
    })
  }

  const preferredTypes = normalizePersonalizationTypes(
    personalization.preferredTypes
  )

  if (preferredTypes.length > 0 && hasAnyVenueType(venue, preferredTypes)) {
    reasons.push({
      key: 'preferred_type',
      label: 'Matches preferred venue type.',
      delta: 8,
    })
  }

  const avoidedTypes = normalizePersonalizationTypes(
    personalization.avoidedTypes
  )

  if (avoidedTypes.length > 0 && hasAnyVenueType(venue, avoidedTypes)) {
    reasons.push({
      key: 'avoided_type',
      label: 'Matches avoided venue type.',
      delta: -22,
    })
  }

  const priceScore = scorePreferredPrice({
    venuePrice: venue.price,
    preferredPrice: personalization.preferredPrice,
  })

  if (priceScore !== 0) {
    reasons.push({
      key: 'price_preference',
      label:
        priceScore > 0
          ? 'Matches preferred price range.'
          : 'Outside preferred price range.',
      delta: priceScore,
    })
  }

  if (
    personalization.homeCity &&
    venue.city &&
    normalizeSearchKey(personalization.homeCity) === normalizeSearchKey(venue.city)
  ) {
    reasons.push({
      key: 'home_city',
      label: 'Fits user home city context.',
      delta: 3,
    })
  }

  const rawScore = reasons.reduce((sum, reason) => sum + reason.delta, 0)

  return {
    score: clampPersonalizationScore(rawScore),
    reasons,
  }
}

export function applyPersonalizationBoost<T extends { score: number }>({
  baseScore,
  personalizationScore,
}: {
  baseScore: T
  personalizationScore: PersonalizationScore
}): T & {
  personalizedScore: number
  personalizationReasons: PersonalizationReason[]
} {
  return {
    ...baseScore,
    personalizedScore: baseScore.score + personalizationScore.score,
    personalizationReasons: personalizationScore.reasons,
  }
}

export function buildUserRoutePersonalization(input: {
  preferredVibes?: string[] | null
  interestCategories?: string[] | null
  savedVenues?: PersonalizationVenue[] | null
  visitedVenues?: PersonalizationVenue[] | null
  completedVenues?: PersonalizationVenue[] | null
  dislikedVenues?: PersonalizationVenue[] | null
  preferredTypes?: string[] | null
  avoidedTypes?: string[] | null
  preferredPrice?: string | null
  homeCity?: string | null
}): UserRoutePersonalization {
  return {
    preferredVibes: input.preferredVibes ?? [],
    interestCategories: input.interestCategories ?? [],
    savedVenueIds: extractVenueIds(input.savedVenues),
    savedVenueSlugs: extractVenueSlugs(input.savedVenues),
    visitedVenueIds: extractVenueIds(input.visitedVenues),
    visitedVenueSlugs: extractVenueSlugs(input.visitedVenues),
    completedVenueIds: extractVenueIds(input.completedVenues),
    completedVenueSlugs: extractVenueSlugs(input.completedVenues),
    dislikedVenueIds: extractVenueIds(input.dislikedVenues),
    dislikedVenueSlugs: extractVenueSlugs(input.dislikedVenues),
    preferredTypes: input.preferredTypes ?? [],
    avoidedTypes: input.avoidedTypes ?? [],
    preferredPrice: input.preferredPrice ?? null,
    homeCity: input.homeCity ?? null,
  }
}

function scoreStringOverlap({
  candidateValues,
  preferredValues,
  maxScore,
}: {
  candidateValues: string[]
  preferredValues: string[]
  maxScore: number
}) {
  const candidateKeys = new Set(
    candidateValues.map(normalizeSearchKey).filter(Boolean)
  )

  const preferredKeys = preferredValues
    .map(normalizeSearchKey)
    .filter(Boolean)

  if (candidateKeys.size === 0 || preferredKeys.length === 0) return 0

  const matches = preferredKeys.filter((key) => candidateKeys.has(key)).length

  if (matches === 0) return 0

  return Math.min(maxScore, matches * 4)
}

function scorePreferredPrice({
  venuePrice,
  preferredPrice,
}: {
  venuePrice?: string | null
  preferredPrice?: string | null
}) {
  const venueRank = priceRank(venuePrice)
  const preferredRank = priceRank(preferredPrice)

  if (!venueRank || !preferredRank) return 0

  const diff = Math.abs(venueRank - preferredRank)

  if (diff === 0) return 5
  if (diff === 1) return 2
  if (diff === 2) return -4

  return -7
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

function normalizePersonalizationTypes(
  values?: string[] | null
): NormalizedVenueType[] {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(
      values
        .flatMap((value) => normalizeVenueTypes(value))
        .filter(Boolean)
    )
  )
}

function isInList(
  value: string | null,
  list?: string[] | null
): boolean {
  if (!value || !Array.isArray(list)) return false

  const normalizedValue = normalizeSearchKey(value)

  return list.some((item) => normalizeSearchKey(item) === normalizedValue)
}

function extractVenueIds(venues?: PersonalizationVenue[] | null) {
  if (!Array.isArray(venues)) return []

  return venues
    .map((venue) => venue.id)
    .filter((id): id is string => Boolean(id))
}

function extractVenueSlugs(venues?: PersonalizationVenue[] | null) {
  if (!Array.isArray(venues)) return []

  return venues
    .map((venue) => venue.slug)
    .filter((slug): slug is string => Boolean(slug))
}

function clampPersonalizationScore(value: number) {
  return Math.max(
    MAX_PERSONALIZATION_PENALTY,
    Math.min(MAX_PERSONALIZATION_BOOST, value)
  )
}