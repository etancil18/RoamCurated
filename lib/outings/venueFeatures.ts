// lib/outings/venueFeatures.ts

import type { VenueRecord } from "./types"

export type VenueFeatureSource =
  | "vibe"
  | "tags"
  | "type"
  | "time_category"
  | "energy_ramp"

export type VenueFeatureSignal = {
  token: string
  source: VenueFeatureSource
  weight: number
}

export type VenueEnergyBand =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high"
  | "unknown"

export type VenueSocialBand =
  | "solo"
  | "intimate"
  | "small_group"
  | "group"
  | "large_group"
  | "unknown"

export type VenueFeatureProfile = {
  venueId: string
  venueName: string | null

  types: string[]
  vibes: string[]
  tags: string[]
  timeCategories: string[]
  energyRamp: string[]

  typeTokens: string[]
  vibeTokens: string[]
  tagTokens: string[]
  timeCategoryTokens: string[]
  energyRampTokens: string[]

  primaryTokens: string[]
  secondaryTokens: string[]
  allTokens: string[]

  signals: VenueFeatureSignal[]

  inferredEnergy: VenueEnergyBand
  inferredSociality: VenueSocialBand

  conversationFriendly: boolean
  groupFriendly: boolean
  dateFriendly: boolean
  quietFriendly: boolean
  outdoorFriendly: boolean
  cultureFriendly: boolean
  nightlifeFriendly: boolean
  foodFriendly: boolean
  coffeeFriendly: boolean
  wellnessFriendly: boolean

  hasTypeData: boolean
  hasVibeData: boolean
  hasTagData: boolean
  hasTimeCategoryData: boolean
  hasEnergyRampData: boolean

  semanticDataCompleteness: number
  temporalDataCompleteness: number
  overallFeatureConfidence: number
}

export type VenueFeatureAffinityInput = {
  preferredTypes?: string[]
  preferredVibes?: string[]
  preferredTags?: string[]
  preferredTokens?: string[]

  requiredAnyTypes?: string[]
  requiredAnyTokens?: string[]

  discouragedTypes?: string[]
  discouragedTokens?: string[]

  stronglyDiscouragedTypes?: string[]
  stronglyDiscouragedTokens?: string[]

  preferredTimeCategories?: string[]
  discouragedTimeCategories?: string[]

  targetEnergy?: VenueEnergyBand | null
}

export type VenueFeatureAffinityBreakdown = {
  score: number

  typeScore: number
  vibeScore: number
  tagScore: number
  tokenScore: number
  temporalScore: number
  energyScore: number
  penaltyScore: number

  matchedTypes: string[]
  matchedVibes: string[]
  matchedTags: string[]
  matchedTokens: string[]
  matchedTimeCategories: string[]

  missingRequiredTypes: string[]
  missingRequiredTokens: string[]

  discouragedMatches: string[]
  stronglyDiscouragedMatches: string[]

  semanticConfidence: number
  temporalConfidence: number
}

type VenueRecordWithFlexibleFeatures = VenueRecord & {
  type?: string[] | string | null
  vibe?: string[] | string | null
  tags?: string[] | string | null
  time_category?: string[] | string | null
  energy_ramp?: string[] | string | number | null
}

const FEATURE_SOURCE_WEIGHTS: Record<VenueFeatureSource, number> = {
  vibe: 1.2,
  tags: 1,
  type: 0.72,
  time_category: 0.38,

  /*
   * energy_ramp is intentionally low-weight because the column is not yet
   * consistently populated across the venue dataset.
   */
  energy_ramp: 0.15,
}

const TOKEN_ALIASES: Record<string, string> = {
  cafés: "cafe",
  café: "cafe",
  cafes: "cafe",

  coffeeshop: "coffee shop",
  coffeehouse: "coffee shop",

  cocktailbar: "cocktail bar",
  winebar: "wine bar",
  sportsbar: "sports bar",
  divebar: "dive bar",
  hotelbar: "hotel bar",
  rooftopbar: "rooftop",

  foodhall: "food hall",
  beerhall: "beer hall",
  beergarden: "beer garden",

  latenight: "late night",
  afterhours: "after hours",

  datefriendly: "date friendly",
  groupfriendly: "group friendly",
  familyfriendly: "family friendly",
  solofriendly: "solo friendly",

  lowkey: "low key",
  laidback: "laid back",
  highenergy: "high energy",

  outdoors: "outdoor",
  outside: "outdoor",

  conversations: "conversation",
  conversational: "conversation",

  cocktails: "cocktail",
  drinks: "drink",
  breweries: "brewery",
  restaurants: "restaurant",
  galleries: "gallery",
  museums: "museum",
  bookstores: "bookstore",
  bakeries: "bakery",
  lounges: "lounge",
  rooftops: "rooftop",
  patios: "patio",
  gardens: "garden",
  parks: "park",
}

const QUIET_TOKENS = [
  "quiet",
  "calm",
  "peaceful",
  "serene",
  "tranquil",
  "low stimulation",
  "low key",
  "laid back",
  "relaxed",
  "cozy",
  "intimate",
  "conversation",
  "soft lighting",
  "ambient",
]

const HIGH_ENERGY_TOKENS = [
  "high energy",
  "energetic",
  "hype",
  "electric",
  "lively",
  "buzzy",
  "party",
  "club",
  "dance",
  "dancing",
  "dj",
  "rowdy",
  "loud",
  "packed",
  "after hours",
  "late night",
]

const VERY_HIGH_ENERGY_TOKENS = [
  "club",
  "rave",
  "dance club",
  "nightclub",
  "after hours",
  "party",
  "high energy",
  "rowdy",
]

const LOW_ENERGY_TOKENS = [
  ...QUIET_TOKENS,
  "coffee",
  "coffee shop",
  "tea",
  "bookstore",
  "library",
  "garden",
  "park",
  "spa",
  "wellness",
  "bakery",
]

const GROUP_TOKENS = [
  "group friendly",
  "communal",
  "social",
  "shareable",
  "large group",
  "birthday",
  "celebration",
  "sports bar",
  "brewery",
  "beer hall",
  "food hall",
  "patio",
]

const INTIMATE_TOKENS = [
  "intimate",
  "romantic",
  "date friendly",
  "date night",
  "cozy",
  "candlelit",
  "quiet",
  "private",
  "small plates",
  "wine bar",
  "speakeasy",
]

const CONVERSATION_TOKENS = [
  "conversation",
  "conversation friendly",
  "quiet",
  "calm",
  "intimate",
  "cozy",
  "low key",
  "laid back",
  "wine bar",
  "lounge",
  "hotel bar",
  "hotel lobby",
  "cafe",
  "coffee",
  "coffee shop",
  "bookstore",
]

const OUTDOOR_TOKENS = [
  "outdoor",
  "patio",
  "courtyard",
  "rooftop",
  "garden",
  "park",
  "terrace",
  "beer garden",
  "green space",
]

const CULTURE_TOKENS = [
  "gallery",
  "museum",
  "art",
  "artsy",
  "creative",
  "culture",
  "cultural",
  "design",
  "bookstore",
  "literary",
  "cinema",
  "film",
  "theater",
  "theatre",
  "performance",
  "installation",
  "exhibit",
]

const NIGHTLIFE_TOKENS = [
  "bar",
  "cocktail",
  "cocktail bar",
  "wine bar",
  "lounge",
  "rooftop",
  "club",
  "nightclub",
  "speakeasy",
  "late night",
  "after hours",
  "dj",
  "dance",
  "nightlife",
]

const FOOD_TOKENS = [
  "restaurant",
  "food",
  "dinner",
  "lunch",
  "brunch",
  "breakfast",
  "bakery",
  "dessert",
  "small plates",
  "tapas",
  "food hall",
  "casual food",
  "fine dining",
]

const COFFEE_TOKENS = [
  "coffee",
  "coffee shop",
  "cafe",
  "tea",
  "matcha",
  "bakery",
  "breakfast",
]

const WELLNESS_TOKENS = [
  "wellness",
  "healthy",
  "fitness",
  "yoga",
  "pilates",
  "meditation",
  "spa",
  "juice",
  "smoothie",
  "salad",
  "mindful",
]

export function extractVenueFeatures(
  venue: VenueRecordWithFlexibleFeatures
): VenueFeatureProfile {
  const types = normalizeFeatureValues(venue.type)
  const vibes = normalizeFeatureValues(venue.vibe)
  const tags = normalizeFeatureValues(venue.tags)
  const timeCategories = normalizeFeatureValues(venue.time_category)
  const energyRamp = normalizeEnergyRampValues(venue.energy_ramp)

  const typeTokens = expandFeatureTokens(types)
  const vibeTokens = expandFeatureTokens(vibes)
  const tagTokens = expandFeatureTokens(tags)
  const timeCategoryTokens = expandFeatureTokens(timeCategories)
  const energyRampTokens = expandFeatureTokens(energyRamp)

  /*
   * Vibes and tags are the primary semantic identity of the venue.
   * Type is supporting categorical context.
   * Time category and energy ramp are secondary planning evidence.
   */
  const primaryTokens = uniqueStrings([
    ...vibeTokens,
    ...tagTokens,
  ])

  const secondaryTokens = uniqueStrings([
    ...typeTokens,
    ...timeCategoryTokens,
    ...energyRampTokens,
  ])

  const allTokens = uniqueStrings([
    ...primaryTokens,
    ...secondaryTokens,
  ])

  const signals = buildFeatureSignals({
    types,
    vibes,
    tags,
    timeCategories,
    energyRamp,
  })

  const hasTypeData = types.length > 0
  const hasVibeData = vibes.length > 0
  const hasTagData = tags.length > 0
  const hasTimeCategoryData = timeCategories.length > 0
  const hasEnergyRampData = energyRamp.length > 0

  const semanticDataCompleteness = calculateSemanticDataCompleteness({
    hasTypeData,
    hasVibeData,
    hasTagData,
  })

  const temporalDataCompleteness = calculateTemporalDataCompleteness({
    hasTimeCategoryData,
    hasEnergyRampData,
  })

  const overallFeatureConfidence = clampScore(
    semanticDataCompleteness * 0.82 +
      temporalDataCompleteness * 0.18
  )

  return {
    venueId: venue.id,
    venueName: venue.name,

    types,
    vibes,
    tags,
    timeCategories,
    energyRamp,

    typeTokens,
    vibeTokens,
    tagTokens,
    timeCategoryTokens,
    energyRampTokens,

    primaryTokens,
    secondaryTokens,
    allTokens,

    signals,

    inferredEnergy: inferVenueEnergy({
      allTokens,
      energyRampTokens,
    }),

    inferredSociality: inferVenueSociality(allTokens),

    conversationFriendly: hasAnyFeatureToken(
      allTokens,
      CONVERSATION_TOKENS
    ),

    groupFriendly: hasAnyFeatureToken(
      allTokens,
      GROUP_TOKENS
    ),

    dateFriendly: hasAnyFeatureToken(
      allTokens,
      INTIMATE_TOKENS
    ),

    quietFriendly:
      hasAnyFeatureToken(allTokens, QUIET_TOKENS) &&
      !hasAnyFeatureToken(allTokens, VERY_HIGH_ENERGY_TOKENS),

    outdoorFriendly: hasAnyFeatureToken(
      allTokens,
      OUTDOOR_TOKENS
    ),

    cultureFriendly: hasAnyFeatureToken(
      allTokens,
      CULTURE_TOKENS
    ),

    nightlifeFriendly: hasAnyFeatureToken(
      allTokens,
      NIGHTLIFE_TOKENS
    ),

    foodFriendly: hasAnyFeatureToken(
      allTokens,
      FOOD_TOKENS
    ),

    coffeeFriendly: hasAnyFeatureToken(
      allTokens,
      COFFEE_TOKENS
    ),

    wellnessFriendly: hasAnyFeatureToken(
      allTokens,
      WELLNESS_TOKENS
    ),

    hasTypeData,
    hasVibeData,
    hasTagData,
    hasTimeCategoryData,
    hasEnergyRampData,

    semanticDataCompleteness,
    temporalDataCompleteness,
    overallFeatureConfidence,
  }
}

export function computeVenueFeatureAffinity(
  profile: VenueFeatureProfile,
  input: VenueFeatureAffinityInput
): VenueFeatureAffinityBreakdown {
  const preferredTypes = normalizeFeatureValues(input.preferredTypes)
  const preferredVibes = normalizeFeatureValues(input.preferredVibes)
  const preferredTags = normalizeFeatureValues(input.preferredTags)
  const preferredTokens = normalizeFeatureValues(input.preferredTokens)

  const requiredAnyTypes = normalizeFeatureValues(input.requiredAnyTypes)
  const requiredAnyTokens = normalizeFeatureValues(input.requiredAnyTokens)

  const discouragedTypes = normalizeFeatureValues(input.discouragedTypes)
  const discouragedTokens = normalizeFeatureValues(input.discouragedTokens)

  const stronglyDiscouragedTypes = normalizeFeatureValues(
    input.stronglyDiscouragedTypes
  )

  const stronglyDiscouragedTokens = normalizeFeatureValues(
    input.stronglyDiscouragedTokens
  )

  const preferredTimeCategories = normalizeFeatureValues(
    input.preferredTimeCategories
  )

  const discouragedTimeCategories = normalizeFeatureValues(
    input.discouragedTimeCategories
  )

  const matchedTypes = intersectFeatures(
    profile.typeTokens,
    expandFeatureTokens(preferredTypes)
  )

  const matchedVibes = intersectFeatures(
    profile.vibeTokens,
    expandFeatureTokens(preferredVibes)
  )

  const matchedTags = intersectFeatures(
    profile.tagTokens,
    expandFeatureTokens(preferredTags)
  )

  const matchedTokens = intersectFeatures(
    profile.primaryTokens,
    expandFeatureTokens(preferredTokens)
  )

  const matchedTimeCategories = intersectFeatures(
    profile.timeCategoryTokens,
    expandFeatureTokens(preferredTimeCategories)
  )

  const requiredTypeTokens = expandFeatureTokens(requiredAnyTypes)
  const requiredTokens = expandFeatureTokens(requiredAnyTokens)

  const missingRequiredTypes =
    requiredTypeTokens.length > 0 &&
    !hasAnyFeatureToken(profile.typeTokens, requiredTypeTokens)
      ? requiredTypeTokens
      : []

  const missingRequiredTokens =
    requiredTokens.length > 0 &&
    !hasAnyFeatureToken(profile.allTokens, requiredTokens)
      ? requiredTokens
      : []

  const discouragedMatches = uniqueStrings([
    ...intersectFeatures(
      profile.typeTokens,
      expandFeatureTokens(discouragedTypes)
    ),
    ...intersectFeatures(
      profile.allTokens,
      expandFeatureTokens(discouragedTokens)
    ),
    ...intersectFeatures(
      profile.timeCategoryTokens,
      expandFeatureTokens(discouragedTimeCategories)
    ),
  ])

  const stronglyDiscouragedMatches = uniqueStrings([
    ...intersectFeatures(
      profile.typeTokens,
      expandFeatureTokens(stronglyDiscouragedTypes)
    ),
    ...intersectFeatures(
      profile.allTokens,
      expandFeatureTokens(stronglyDiscouragedTokens)
    ),
  ])

  /*
   * Weight priority:
   *
   * 1. Venue vibe
   * 2. Venue tags
   * 3. General semantic token overlap
   * 4. Venue type
   * 5. Time category
   * 6. Energy ramp
   */
  const vibeScore = Math.min(matchedVibes.length, 5) * 14
  const tagScore = Math.min(matchedTags.length, 6) * 12
  const tokenScore = Math.min(matchedTokens.length, 6) * 8
  const typeScore = Math.min(matchedTypes.length, 4) * 7
  const temporalScore = Math.min(matchedTimeCategories.length, 3) * 4

  const energyScore = scoreEnergyAffinity(
    profile.inferredEnergy,
    input.targetEnergy ?? null,
    profile.hasEnergyRampData
  )

  let penaltyScore = 0

  penaltyScore -= discouragedMatches.length * 14
  penaltyScore -= stronglyDiscouragedMatches.length * 28

  /*
   * Required matches are strong preference checks, not automatic exclusions.
   * Hard rejection should happen only inside a deliberate strict selection
   * pass, not in the shared feature extraction layer.
   */
  if (missingRequiredTypes.length > 0) {
    penaltyScore -= 16
  }

  if (missingRequiredTokens.length > 0) {
    penaltyScore -= 18
  }

  const rawScore =
    typeScore +
    vibeScore +
    tagScore +
    tokenScore +
    temporalScore +
    energyScore +
    penaltyScore

  const confidenceAdjustment =
    0.72 + profile.overallFeatureConfidence * 0.28

  const score = Math.round(rawScore * confidenceAdjustment)

  return {
    score,

    typeScore,
    vibeScore,
    tagScore,
    tokenScore,
    temporalScore,
    energyScore,
    penaltyScore,

    matchedTypes,
    matchedVibes,
    matchedTags,
    matchedTokens,
    matchedTimeCategories,

    missingRequiredTypes,
    missingRequiredTokens,

    discouragedMatches,
    stronglyDiscouragedMatches,

    semanticConfidence: profile.semanticDataCompleteness,
    temporalConfidence: profile.temporalDataCompleteness,
  }
}

export function normalizeFeatureValues(
  value:
    | string[]
    | string
    | number
    | null
    | undefined
): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.flatMap((entry) => parseFeatureValue(entry))
    )
  }

  if (value == null) return []

  return uniqueStrings(parseFeatureValue(value))
}

export function expandFeatureTokens(
  values: string[] | string | null | undefined
): string[] {
  const normalizedValues = normalizeFeatureValues(values)
  const tokens: string[] = []

  for (const value of normalizedValues) {
    const normalizedPhrase = normalizeFeatureToken(value)
    if (!normalizedPhrase) continue

    tokens.push(normalizedPhrase)

    const fragments = normalizedPhrase
      .split(/\s+/)
      .map((fragment) => normalizeFeatureToken(fragment))
      .filter(Boolean)

    tokens.push(...fragments)

    const alias = TOKEN_ALIASES[compactFeatureToken(normalizedPhrase)]
    if (alias) {
      tokens.push(normalizeFeatureToken(alias))
    }
  }

  return uniqueStrings(tokens)
}

export function normalizeFeatureToken(
  value: string
): string {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[_/|]+/g, " ")
    .replace(/[–—-]+/g, " ")
    .replace(/[()[\]{}:;,.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) return ""

  return (
    TOKEN_ALIASES[compactFeatureToken(normalized)] ??
    normalized
  )
}

export function hasAnyFeatureToken(
  candidateTokens: string[],
  expectedTokens: string[]
): boolean {
  if (
    candidateTokens.length === 0 ||
    expectedTokens.length === 0
  ) {
    return false
  }

  const candidateSet = new Set(
    candidateTokens.map(normalizeFeatureToken)
  )

  return expectedTokens.some((token) =>
    candidateSet.has(normalizeFeatureToken(token))
  )
}

export function countFeatureMatches(
  candidateTokens: string[],
  expectedTokens: string[]
): number {
  return intersectFeatures(
    candidateTokens,
    expectedTokens
  ).length
}

export function intersectFeatures(
  candidateTokens: string[],
  expectedTokens: string[]
): string[] {
  if (
    candidateTokens.length === 0 ||
    expectedTokens.length === 0
  ) {
    return []
  }

  const candidateSet = new Set(
    candidateTokens.map(normalizeFeatureToken)
  )

  return uniqueStrings(
    expectedTokens
      .map(normalizeFeatureToken)
      .filter((token) => candidateSet.has(token))
  )
}

export function inferVenueEnergy({
  allTokens,
  energyRampTokens,
}: {
  allTokens: string[]
  energyRampTokens?: string[]
}): VenueEnergyBand {
  const normalizedEnergyRampTokens =
    energyRampTokens ?? []

  /*
   * energy_ramp is used only as supporting evidence. A populated value may
   * resolve ambiguity, but it does not override strong semantic evidence from
   * venue tags and vibes.
   */
  if (
    hasAnyFeatureToken(allTokens, VERY_HIGH_ENERGY_TOKENS)
  ) {
    return "very_high"
  }

  if (
    hasAnyFeatureToken(allTokens, HIGH_ENERGY_TOKENS)
  ) {
    return "high"
  }

  if (
    hasAnyFeatureToken(allTokens, LOW_ENERGY_TOKENS)
  ) {
    return "low"
  }

  if (
    hasAnyFeatureToken(normalizedEnergyRampTokens, [
      "very high",
      "peak",
      "maximum",
      "5",
    ])
  ) {
    return "very_high"
  }

  if (
    hasAnyFeatureToken(normalizedEnergyRampTokens, [
      "high",
      "4",
    ])
  ) {
    return "high"
  }

  if (
    hasAnyFeatureToken(normalizedEnergyRampTokens, [
      "low",
      "2",
    ])
  ) {
    return "low"
  }

  if (
    hasAnyFeatureToken(normalizedEnergyRampTokens, [
      "very low",
      "minimal",
      "1",
    ])
  ) {
    return "very_low"
  }

  if (
    hasAnyFeatureToken(normalizedEnergyRampTokens, [
      "medium",
      "moderate",
      "3",
    ])
  ) {
    return "medium"
  }

  if (allTokens.length > 0) return "medium"

  return "unknown"
}

export function inferVenueSociality(
  allTokens: string[]
): VenueSocialBand {
  if (
    hasAnyFeatureToken(allTokens, [
      "large group",
      "communal",
      "food hall",
      "beer hall",
      "sports bar",
      "watch party",
      "group friendly",
    ])
  ) {
    return "large_group"
  }

  if (
    hasAnyFeatureToken(allTokens, GROUP_TOKENS)
  ) {
    return "group"
  }

  if (
    hasAnyFeatureToken(allTokens, INTIMATE_TOKENS)
  ) {
    return "intimate"
  }

  if (
    hasAnyFeatureToken(allTokens, [
      "solo friendly",
      "quiet",
      "reading",
      "library",
      "bookstore",
      "coffee shop",
    ])
  ) {
    return "solo"
  }

  if (allTokens.length > 0) {
    return "small_group"
  }

  return "unknown"
}

function buildFeatureSignals({
  types,
  vibes,
  tags,
  timeCategories,
  energyRamp,
}: {
  types: string[]
  vibes: string[]
  tags: string[]
  timeCategories: string[]
  energyRamp: string[]
}): VenueFeatureSignal[] {
  return dedupeSignals([
    ...createSignals(
      vibes,
      "vibe",
      FEATURE_SOURCE_WEIGHTS.vibe
    ),
    ...createSignals(
      tags,
      "tags",
      FEATURE_SOURCE_WEIGHTS.tags
    ),
    ...createSignals(
      types,
      "type",
      FEATURE_SOURCE_WEIGHTS.type
    ),
    ...createSignals(
      timeCategories,
      "time_category",
      FEATURE_SOURCE_WEIGHTS.time_category
    ),
    ...createSignals(
      energyRamp,
      "energy_ramp",
      FEATURE_SOURCE_WEIGHTS.energy_ramp
    ),
  ])
}

function createSignals(
  values: string[],
  source: VenueFeatureSource,
  weight: number
): VenueFeatureSignal[] {
  return expandFeatureTokens(values).map((token) => ({
    token,
    source,
    weight,
  }))
}

function dedupeSignals(
  signals: VenueFeatureSignal[]
): VenueFeatureSignal[] {
  const bestByTokenAndSource = new Map<
    string,
    VenueFeatureSignal
  >()

  for (const signal of signals) {
    const key = `${signal.source}:${signal.token}`
    const current = bestByTokenAndSource.get(key)

    if (
      !current ||
      signal.weight > current.weight
    ) {
      bestByTokenAndSource.set(key, signal)
    }
  }

  return Array.from(bestByTokenAndSource.values())
}

function parseFeatureValue(
  value: string | number
): string[] {
  const raw = String(value).trim()
  if (!raw) return []

  const parsedJson = tryParseJsonArray(raw)

  if (parsedJson) {
    return parsedJson
      .map((entry) => normalizeFeatureToken(entry))
      .filter(Boolean)
  }

  return raw
    .split(/[,;|]+/)
    .map((entry) => normalizeFeatureToken(entry))
    .filter(Boolean)
}

function tryParseJsonArray(
  value: string
): string[] | null {
  if (
    !value.startsWith("[") ||
    !value.endsWith("]")
  ) {
    return null
  }

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed
      .filter(
        (entry) =>
          typeof entry === "string" ||
          typeof entry === "number"
      )
      .map((entry) => String(entry))
  } catch {
    return null
  }
}

function normalizeEnergyRampValues(
  value:
    | string[]
    | string
    | number
    | null
    | undefined
): string[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)]
  }

  return normalizeFeatureValues(value)
}

function calculateSemanticDataCompleteness({
  hasTypeData,
  hasVibeData,
  hasTagData,
}: {
  hasTypeData: boolean
  hasVibeData: boolean
  hasTagData: boolean
}): number {
  let score = 0

  if (hasVibeData) score += 0.42
  if (hasTagData) score += 0.4
  if (hasTypeData) score += 0.18

  return clampScore(score)
}

function calculateTemporalDataCompleteness({
  hasTimeCategoryData,
  hasEnergyRampData,
}: {
  hasTimeCategoryData: boolean
  hasEnergyRampData: boolean
}): number {
  let score = 0

  if (hasTimeCategoryData) score += 0.85

  /*
   * Energy ramp contributes minimally until population coverage improves.
   */
  if (hasEnergyRampData) score += 0.15

  return clampScore(score)
}

function scoreEnergyAffinity(
  candidateEnergy: VenueEnergyBand,
  targetEnergy: VenueEnergyBand | null,
  hasEnergyRampData: boolean
): number {
  if (!targetEnergy || targetEnergy === "unknown") {
    return 0
  }

  if (candidateEnergy === "unknown") {
    return 0
  }

  const candidateRank =
    energyBandToRank(candidateEnergy)

  const targetRank =
    energyBandToRank(targetEnergy)

  const difference = Math.abs(
    candidateRank - targetRank
  )

  const baseScore =
    difference === 0
      ? 8
      : difference === 1
        ? 3
        : difference === 2
          ? -4
          : -8

  /*
   * Even when energy_ramp exists, energy remains supporting evidence rather
   * than a dominant ranking factor.
   */
  return hasEnergyRampData
    ? Math.round(baseScore * 0.5)
    : Math.round(baseScore * 0.35)
}

function energyBandToRank(
  energy: VenueEnergyBand
): number {
  if (energy === "very_low") return 1
  if (energy === "low") return 2
  if (energy === "medium") return 3
  if (energy === "high") return 4
  if (energy === "very_high") return 5

  return 3
}

function compactFeatureToken(
  value: string
): string {
  return value.replace(/\s+/g, "")
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeFeatureToken)
        .filter(Boolean)
    )
  )
}

function clampScore(
  value: number
): number {
  return Number(
    Math.max(0, Math.min(1, value)).toFixed(2)
  )
}