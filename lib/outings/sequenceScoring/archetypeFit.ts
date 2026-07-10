// lib/outings/sequenceScoring/archetypeFit.ts

import type {
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  VenueRecord,
} from "../types"

import {
  getEventArchetypePlanningProfile,
  normalizeEventArchetypeForPlanner,
  type EventArchetype,
  type EventArchetypePlanningProfile,
} from "../eventArchetypes"

import {
  normalizeFeatureValues,
} from "../venueFeatures"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type ArchetypeFitConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type ArchetypeFitBreakdown = {
  tagFit: number
  vibeFit: number
  typeFit: number
  phaseFit: number
  roleFit: number
  semanticFit: number
  conflictPenalty: number
  dataQualityAdjustment: number
  energyRampAdjustment: number
}

export type ArchetypeFitEvidence = {
  archetype: EventArchetype
  phase: SlotPhase

  normalizedTags: string[]
  normalizedVibes: string[]
  normalizedTypes: string[]
  normalizedEnergyRamp: string[]

  preferredTypes: string[]
  preferredVibes: string[]
  discouragedTypes: string[]

  matchedTags: string[]
  matchedVibes: string[]
  matchedTypes: string[]
  matchedPreferredTypes: string[]
  matchedPreferredVibes: string[]
  matchedSemanticTokens: string[]

  conflictingTypes: string[]
  conflictingTokens: string[]

  expectedSemanticRole: string | null
  expectedRole: string | null

  hasTagEvidence: boolean
  hasVibeEvidence: boolean
  hasTypeEvidence: boolean
  hasEnergyRampEvidence: boolean
}

export type ArchetypeFitResult = {
  score: number
  confidence: ArchetypeFitConfidence
  confidenceScore: number

  isStrongFit: boolean
  isWeakFit: boolean
  isHardConflict: boolean

  breakdown: ArchetypeFitBreakdown
  evidence: ArchetypeFitEvidence
}

export type ComputeArchetypeFitInput = {
  venue: Pick<
    VenueRecord,
    "type" | "tags" | "vibe" | "time_category" | "energy_ramp"
  >
  context: PlanningContext
  slot?: PlanningSlot
}

// -----------------------------------------------------------------------------
// Scoring constants
// -----------------------------------------------------------------------------

const MAX_ARCHETYPE_SCORE = 80
const MIN_ARCHETYPE_SCORE = -90

const TAG_MATCH_SCORE = 12
const VIBE_MATCH_SCORE = 11
const TYPE_MATCH_SCORE = 7

const PROFILE_TYPE_MATCH_SCORE = 12
const PROFILE_VIBE_MATCH_SCORE = 10

const SEMANTIC_MATCH_SCORE = 10
const ROLE_MATCH_SCORE = 7
const PHASE_MATCH_SCORE = 5

const DISCOURAGED_TYPE_PENALTY = 24
const STRONG_CONFLICT_PENALTY = 38

const ENERGY_RAMP_MATCH_SCORE = 3
const ENERGY_RAMP_CONFLICT_PENALTY = 4

// -----------------------------------------------------------------------------
// Archetype vocabulary
// -----------------------------------------------------------------------------

type ArchetypeVocabulary = {
  positiveTags: string[]
  positiveVibes: string[]
  positiveTypes: string[]
  negativeTags: string[]
  negativeVibes: string[]
  negativeTypes: string[]
  beforeTokens: string[]
  afterTokens: string[]
  roleTokens: Partial<Record<string, string[]>>
  strongConflictTypes: string[]
}

const ARCHETYPE_VOCABULARY: Record<
  EventArchetype,
  ArchetypeVocabulary
> = {
  social_sports: {
    positiveTags: [
      "sports",
      "sport",
      "soccer",
      "football",
      "basketball",
      "baseball",
      "match",
      "matchday",
      "watch party",
      "watchparty",
      "game day",
      "gameday",
      "tailgate",
      "team",
      "fans",
      "group",
      "communal",
      "patio",
      "beer garden",
    ],
    positiveVibes: [
      "lively",
      "casual",
      "group friendly",
      "social",
      "communal",
      "fun",
      "energetic",
      "neighborhood",
      "outdoor",
      "patio",
      "walkable",
    ],
    positiveTypes: [
      "sports bar",
      "brewery",
      "pub",
      "bar",
      "restaurant",
      "brunch",
      "lunch",
      "breakfast",
      "coffee",
      "cafe",
      "food hall",
      "beer garden",
      "patio",
    ],
    negativeTags: [
      "silent",
      "meditative",
      "formal",
      "exclusive",
    ],
    negativeVibes: [
      "silent",
      "isolated",
      "formal",
      "ultra intimate",
    ],
    negativeTypes: [
      "spa",
      "library",
      "showroom",
      "fine dining",
      "club",
    ],
    beforeTokens: [
      "coffee",
      "breakfast",
      "brunch",
      "lunch",
      "group",
      "pregame",
      "warmup",
    ],
    afterTokens: [
      "brunch",
      "lunch",
      "bar",
      "brewery",
      "pub",
      "food",
      "drinks",
      "patio",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe", "breakfast", "bakery", "tea"],
      food: ["breakfast", "brunch", "lunch", "restaurant", "food hall"],
      drink: ["sports bar", "bar", "brewery", "pub", "beer garden"],
      activity: ["sports", "game", "watch party", "patio"],
      dessert: ["dessert", "bakery", "ice cream"],
    },
    strongConflictTypes: ["spa", "library"],
  },

  music: {
    positiveTags: [
      "music",
      "concert",
      "live music",
      "live",
      "dj",
      "show",
      "performance",
      "dance",
      "dancing",
      "vinyl",
      "sound",
      "listening",
      "night out",
    ],
    positiveVibes: [
      "lively",
      "social",
      "energetic",
      "high energy",
      "buzzy",
      "atmospheric",
      "moody",
      "creative",
    ],
    positiveTypes: [
      "restaurant",
      "dinner",
      "bar",
      "cocktail",
      "wine bar",
      "lounge",
      "rooftop",
      "club",
      "speakeasy",
      "late night",
      "music",
    ],
    negativeTags: [
      "silent",
      "meditation",
      "study",
    ],
    negativeVibes: [
      "silent",
      "clinical",
      "isolated",
    ],
    negativeTypes: [
      "library",
      "spa",
      "fitness",
    ],
    beforeTokens: [
      "dinner",
      "restaurant",
      "cocktail",
      "wine",
      "bar",
      "lounge",
      "pre show",
    ],
    afterTokens: [
      "bar",
      "cocktail",
      "lounge",
      "rooftop",
      "club",
      "late night",
      "dessert",
      "after hours",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe"],
      food: ["restaurant", "dinner", "late night food"],
      drink: ["bar", "cocktail", "wine bar", "lounge", "speakeasy"],
      activity: ["music", "live music", "dance", "performance"],
      dessert: ["dessert", "bakery"],
    },
    strongConflictTypes: ["library", "spa"],
  },

  networking: {
    positiveTags: [
      "networking",
      "professional",
      "business",
      "founders",
      "startup",
      "industry",
      "community",
      "conversation",
      "meeting",
      "coworking",
      "social",
      "mixer",
    ],
    positiveVibes: [
      "conversation friendly",
      "professional",
      "polished",
      "quiet",
      "social",
      "welcoming",
      "refined",
      "intimate",
    ],
    positiveTypes: [
      "coffee",
      "cafe",
      "coworking",
      "hotel lobby",
      "hotel bar",
      "restaurant",
      "lunch",
      "dinner",
      "wine bar",
      "cocktail",
      "lounge",
      "social club",
    ],
    negativeTags: [
      "rowdy",
      "mosh",
      "dance floor",
      "silent",
    ],
    negativeVibes: [
      "rowdy",
      "chaotic",
      "too loud",
      "high stimulation",
    ],
    negativeTypes: [
      "club",
      "sports bar",
      "fitness",
      "spa",
      "library",
      "showroom",
    ],
    beforeTokens: [
      "coffee",
      "cafe",
      "lunch",
      "restaurant",
      "wine bar",
      "conversation",
      "meeting",
    ],
    afterTokens: [
      "cocktail",
      "wine bar",
      "hotel bar",
      "lounge",
      "restaurant",
      "conversation",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe", "coworking", "hotel lobby"],
      food: ["lunch", "dinner", "restaurant"],
      drink: ["wine bar", "cocktail", "lounge", "hotel bar"],
      activity: ["coworking", "social club", "meeting"],
      dessert: ["dessert", "cafe"],
    },
    strongConflictTypes: ["club"],
  },

  food_drink: {
    positiveTags: [
      "food",
      "drink",
      "culinary",
      "chef",
      "tasting",
      "pairing",
      "wine",
      "cocktail",
      "dessert",
      "restaurant",
      "dining",
      "menu",
      "small plates",
      "aperitif",
      "digestif",
    ],
    positiveVibes: [
      "culinary",
      "cozy",
      "social",
      "date night",
      "intimate",
      "upscale",
      "casual",
      "neighborhood",
    ],
    positiveTypes: [
      "restaurant",
      "dinner",
      "lunch",
      "brunch",
      "wine bar",
      "cocktail",
      "bar",
      "lounge",
      "dessert",
      "bakery",
      "cafe",
    ],
    negativeTags: [
      "workout",
      "fitness class",
      "study only",
    ],
    negativeVibes: [
      "clinical",
      "silent",
      "high intensity fitness",
    ],
    negativeTypes: [
      "fitness",
      "library",
      "showroom",
    ],
    beforeTokens: [
      "aperitif",
      "wine",
      "cocktail",
      "bar",
      "cafe",
      "bakery",
      "small plates",
    ],
    afterTokens: [
      "dessert",
      "digestif",
      "wine bar",
      "cocktail",
      "lounge",
      "bar",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe", "bakery"],
      food: ["restaurant", "dinner", "lunch", "brunch", "small plates"],
      drink: ["wine bar", "cocktail", "bar", "lounge"],
      activity: ["tasting", "pairing", "market"],
      dessert: ["dessert", "bakery", "ice cream"],
    },
    strongConflictTypes: ["fitness"],
  },

  arts_culture: {
    positiveTags: [
      "art",
      "arts",
      "gallery",
      "museum",
      "exhibit",
      "exhibition",
      "design",
      "architecture",
      "culture",
      "creative",
      "literary",
      "bookstore",
      "cinema",
      "film",
      "theater",
      "performance",
      "studio",
      "curated",
    ],
    positiveVibes: [
      "creative",
      "cultured",
      "intimate",
      "thoughtful",
      "artful",
      "design forward",
      "curated",
      "stylish",
      "inspiring",
      "conversation friendly",
    ],
    positiveTypes: [
      "gallery",
      "museum",
      "bookstore",
      "cinema",
      "theater",
      "studio",
      "showroom",
      "cafe",
      "wine bar",
      "cocktail",
      "restaurant",
      "dinner",
      "lounge",
      "dessert",
    ],
    negativeTags: [
      "sports watch party",
      "tailgate",
      "dance club",
    ],
    negativeVibes: [
      "rowdy",
      "chaotic",
      "sports focused",
    ],
    negativeTypes: [
      "sports bar",
      "club",
      "fitness",
    ],
    beforeTokens: [
      "gallery",
      "museum",
      "bookstore",
      "cafe",
      "wine bar",
      "cocktail",
      "creative",
    ],
    afterTokens: [
      "restaurant",
      "dinner",
      "wine bar",
      "cocktail",
      "lounge",
      "dessert",
      "conversation",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe", "bookstore"],
      food: ["restaurant", "dinner", "lunch"],
      drink: ["wine bar", "cocktail", "lounge"],
      activity: ["gallery", "museum", "bookstore", "cinema", "theater"],
      dessert: ["dessert", "bakery", "cafe"],
    },
    strongConflictTypes: ["sports bar", "club"],
  },

  wellness: {
    positiveTags: [
      "wellness",
      "healthy",
      "fitness",
      "yoga",
      "pilates",
      "meditation",
      "breathwork",
      "juice",
      "smoothie",
      "salad",
      "park",
      "garden",
      "outdoor",
      "mindful",
      "recovery",
    ],
    positiveVibes: [
      "calm",
      "healthy",
      "peaceful",
      "outdoors",
      "low stimulation",
      "mindful",
      "restorative",
      "clean",
      "serene",
    ],
    positiveTypes: [
      "juice",
      "smoothie",
      "salad",
      "healthy",
      "coffee",
      "tea",
      "cafe",
      "bakery",
      "park",
      "garden",
      "spa",
      "yoga",
      "pilates",
      "fitness",
    ],
    negativeTags: [
      "party",
      "shots",
      "late night club",
    ],
    negativeVibes: [
      "rowdy",
      "chaotic",
      "high alcohol",
    ],
    negativeTypes: [
      "club",
      "sports bar",
      "dive bar",
      "speakeasy",
    ],
    beforeTokens: [
      "coffee",
      "tea",
      "juice",
      "smoothie",
      "bakery",
      "light",
      "healthy",
    ],
    afterTokens: [
      "healthy",
      "salad",
      "juice",
      "smoothie",
      "park",
      "garden",
      "recovery",
    ],
    roleTokens: {
      coffee: ["coffee", "tea", "juice", "smoothie"],
      food: ["healthy", "salad", "light food"],
      drink: ["juice", "smoothie", "tea"],
      activity: ["park", "garden", "yoga", "pilates", "fitness", "spa"],
      dessert: ["fruit", "healthy dessert", "bakery"],
    },
    strongConflictTypes: ["club", "dive bar"],
  },

  nightlife: {
    positiveTags: [
      "nightlife",
      "party",
      "dj",
      "dance",
      "dancing",
      "cocktail",
      "bar",
      "late night",
      "after hours",
      "club",
      "rooftop",
      "lounge",
      "night out",
      "buzzy",
    ],
    positiveVibes: [
      "high energy",
      "lively",
      "social",
      "buzzy",
      "moody",
      "late night",
      "vibrant",
      "party",
    ],
    positiveTypes: [
      "bar",
      "cocktail",
      "lounge",
      "rooftop",
      "club",
      "speakeasy",
      "restaurant",
      "dinner",
      "late night",
    ],
    negativeTags: [
      "study",
      "silent",
      "meditation",
    ],
    negativeVibes: [
      "silent",
      "clinical",
      "isolated",
    ],
    negativeTypes: [
      "breakfast",
      "library",
      "spa",
      "yoga",
      "pilates",
    ],
    beforeTokens: [
      "restaurant",
      "dinner",
      "cocktail",
      "bar",
      "wine bar",
      "lounge",
      "pre game",
    ],
    afterTokens: [
      "club",
      "bar",
      "cocktail",
      "lounge",
      "speakeasy",
      "late night",
      "after hours",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe"],
      food: ["restaurant", "dinner", "late night food"],
      drink: ["bar", "cocktail", "lounge", "rooftop", "speakeasy"],
      activity: ["club", "dance", "music"],
      dessert: ["dessert", "late night dessert"],
    },
    strongConflictTypes: ["library", "spa"],
  },

  community: {
    positiveTags: [
      "community",
      "local",
      "neighborhood",
      "meetup",
      "group",
      "social",
      "public",
      "inclusive",
      "family friendly",
      "casual",
      "gathering",
    ],
    positiveVibes: [
      "casual",
      "local",
      "group friendly",
      "welcoming",
      "friendly",
      "social",
      "approachable",
      "neighborhood",
    ],
    positiveTypes: [
      "coffee",
      "cafe",
      "restaurant",
      "brewery",
      "bar",
      "park",
      "bookstore",
      "market",
      "dessert",
    ],
    negativeTags: [
      "exclusive",
      "members only",
      "ultra formal",
    ],
    negativeVibes: [
      "exclusive",
      "intimidating",
      "ultra formal",
    ],
    negativeTypes: [
      "club",
      "speakeasy",
    ],
    beforeTokens: [
      "coffee",
      "cafe",
      "restaurant",
      "park",
      "bookstore",
      "local",
    ],
    afterTokens: [
      "restaurant",
      "bar",
      "brewery",
      "coffee",
      "dessert",
      "group",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe", "bookstore"],
      food: ["restaurant", "lunch", "dinner"],
      drink: ["bar", "brewery"],
      activity: ["park", "market", "community space"],
      dessert: ["dessert", "bakery"],
    },
    strongConflictTypes: ["club"],
  },

  comedy: {
    positiveTags: [
      "comedy",
      "standup",
      "stand up",
      "improv",
      "funny",
      "show",
      "laugh",
      "entertainment",
      "night out",
    ],
    positiveVibes: [
      "fun",
      "social",
      "casual",
      "lively",
      "playful",
      "relaxed",
    ],
    positiveTypes: [
      "restaurant",
      "dinner",
      "bar",
      "cocktail",
      "brewery",
      "lounge",
      "dessert",
      "late night",
    ],
    negativeTags: [
      "silent",
      "meditation",
      "study",
    ],
    negativeVibes: [
      "silent",
      "clinical",
      "isolated",
    ],
    negativeTypes: [
      "breakfast",
      "library",
      "spa",
    ],
    beforeTokens: [
      "restaurant",
      "dinner",
      "bar",
      "cocktail",
      "brewery",
    ],
    afterTokens: [
      "bar",
      "cocktail",
      "lounge",
      "dessert",
      "late night",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe"],
      food: ["restaurant", "dinner", "late night food"],
      drink: ["bar", "cocktail", "brewery", "lounge"],
      activity: ["comedy", "improv", "entertainment"],
      dessert: ["dessert", "bakery"],
    },
    strongConflictTypes: ["library", "spa"],
  },

  market: {
    positiveTags: [
      "market",
      "festival",
      "fair",
      "vendor",
      "makers",
      "maker",
      "craft",
      "vintage",
      "flea",
      "bazaar",
      "outdoor",
      "local",
      "walkable",
      "daytime",
    ],
    positiveVibes: [
      "daytime",
      "walkable",
      "local",
      "casual",
      "outdoor",
      "creative",
      "neighborhood",
      "relaxed",
    ],
    positiveTypes: [
      "coffee",
      "cafe",
      "bakery",
      "breakfast",
      "brunch",
      "lunch",
      "market",
      "bookstore",
      "park",
      "garden",
      "gallery",
      "dessert",
    ],
    negativeTags: [
      "after hours",
      "late night club",
    ],
    negativeVibes: [
      "rowdy",
      "late night",
      "high stimulation",
    ],
    negativeTypes: [
      "club",
      "speakeasy",
      "sports bar",
    ],
    beforeTokens: [
      "coffee",
      "cafe",
      "bakery",
      "breakfast",
      "brunch",
      "light bite",
    ],
    afterTokens: [
      "brunch",
      "lunch",
      "cafe",
      "bookstore",
      "park",
      "garden",
      "gallery",
      "dessert",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe", "bakery"],
      food: ["breakfast", "brunch", "lunch"],
      drink: ["coffee", "tea", "juice"],
      activity: ["market", "park", "garden", "gallery", "bookstore"],
      dessert: ["dessert", "bakery"],
    },
    strongConflictTypes: ["club"],
  },

  other: {
    positiveTags: [
      "social",
      "local",
      "convenient",
      "casual",
      "nearby",
      "walkable",
    ],
    positiveVibes: [
      "social",
      "convenient",
      "casual",
      "welcoming",
      "local",
    ],
    positiveTypes: [
      "coffee",
      "cafe",
      "restaurant",
      "bar",
      "dessert",
    ],
    negativeTags: [],
    negativeVibes: [],
    negativeTypes: [],
    beforeTokens: [
      "coffee",
      "cafe",
      "restaurant",
      "bar",
    ],
    afterTokens: [
      "restaurant",
      "bar",
      "dessert",
      "coffee",
    ],
    roleTokens: {
      coffee: ["coffee", "cafe"],
      food: ["restaurant", "food"],
      drink: ["bar", "cocktail", "lounge"],
      activity: ["activity", "market", "gallery"],
      dessert: ["dessert", "bakery"],
    },
    strongConflictTypes: [],
  },
}

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeArchetypeFit({
  venue,
  context,
  slot,
}: ComputeArchetypeFitInput): ArchetypeFitResult {
  const archetype = normalizeEventArchetypeForPlanner(
    context.eventArchetype
  )

  const profile = getEventArchetypePlanningProfile(archetype)
  const vocabulary = ARCHETYPE_VOCABULARY[archetype]

  const phase = resolvePhase(context, slot)
  const expectedRole = slot?.role ?? null
  const expectedSemanticRole = slot?.semanticRole ?? null

  const normalizedTags = normalizeSemanticValues(venue.tags)
  const normalizedVibes = normalizeSemanticValues(venue.vibe)
  const normalizedTypes = normalizeSemanticValues(venue.type)
  const normalizedEnergyRamp = normalizeSemanticValues(
    venue.energy_ramp
  )

  const preferredTypes = normalizeSemanticValues(
    phase === "before"
      ? profile.preferredBeforeVenueTypes
      : profile.preferredAfterVenueTypes
  )

  const preferredVibes = normalizeSemanticValues(
    profile.preferredVibes
  )

  const discouragedTypes = normalizeSemanticValues(
    profile.discouragedVenueTypes
  )

  const allVenueTokens = uniqueStrings([
    ...normalizedTags,
    ...normalizedVibes,
    ...normalizedTypes,
  ])

  const matchedTags = findMatches(
    normalizedTags,
    vocabulary.positiveTags
  )

  const matchedVibes = findMatches(
    normalizedVibes,
    vocabulary.positiveVibes
  )

  const matchedTypes = findMatches(
    normalizedTypes,
    vocabulary.positiveTypes
  )

  const matchedPreferredTypes = findMatches(
    normalizedTypes,
    preferredTypes
  )

  const matchedPreferredVibes = findMatches(
    normalizedVibes,
    preferredVibes
  )

  const semanticTokens = buildSemanticRoleTokens({
    expectedSemanticRole,
    expectedRole,
    vocabulary,
  })

  const matchedSemanticTokens = findMatches(
    allVenueTokens,
    semanticTokens
  )

  const conflictingTypes = uniqueStrings([
    ...findMatches(normalizedTypes, discouragedTypes),
    ...findMatches(normalizedTypes, vocabulary.negativeTypes),
  ])

  const conflictingTokens = uniqueStrings([
    ...findMatches(normalizedTags, vocabulary.negativeTags),
    ...findMatches(normalizedVibes, vocabulary.negativeVibes),
  ])

  const strongConflictTypes = findMatches(
    normalizedTypes,
    vocabulary.strongConflictTypes
  )

  const tagFit = calculateCappedMatchScore(
    matchedTags.length,
    TAG_MATCH_SCORE,
    30
  )

  const vibeFit =
    calculateCappedMatchScore(
      matchedVibes.length,
      VIBE_MATCH_SCORE,
      28
    ) +
    calculateCappedMatchScore(
      matchedPreferredVibes.length,
      PROFILE_VIBE_MATCH_SCORE,
      20
    )

  const typeFit =
    calculateCappedMatchScore(
      matchedTypes.length,
      TYPE_MATCH_SCORE,
      18
    ) +
    calculateCappedMatchScore(
      matchedPreferredTypes.length,
      PROFILE_TYPE_MATCH_SCORE,
      24
    )

  const phaseFit = calculatePhaseFit({
    allVenueTokens,
    phase,
    vocabulary,
  })

  const roleFit = calculateRoleFit({
    allVenueTokens,
    expectedRole,
    vocabulary,
  })

  const semanticFit = calculateCappedMatchScore(
    matchedSemanticTokens.length,
    SEMANTIC_MATCH_SCORE,
    20
  )

  const conflictPenalty =
    Math.min(
      conflictingTypes.length * DISCOURAGED_TYPE_PENALTY,
      48
    ) +
    Math.min(
      conflictingTokens.length * 10,
      20
    ) +
    Math.min(
      strongConflictTypes.length * STRONG_CONFLICT_PENALTY,
      60
    )

  const dataQualityAdjustment =
    calculateDataQualityAdjustment({
      tagCount: normalizedTags.length,
      vibeCount: normalizedVibes.length,
      typeCount: normalizedTypes.length,
    })

  const energyRampAdjustment =
    calculateEnergyRampAdjustment({
      archetype,
      phase,
      energyRamp: normalizedEnergyRamp,
    })

  const breakdown: ArchetypeFitBreakdown = {
    tagFit,
    vibeFit,
    typeFit,
    phaseFit,
    roleFit,
    semanticFit,
    conflictPenalty,
    dataQualityAdjustment,
    energyRampAdjustment,
  }

  const rawScore =
    tagFit +
    vibeFit +
    typeFit +
    phaseFit +
    roleFit +
    semanticFit +
    dataQualityAdjustment +
    energyRampAdjustment -
    conflictPenalty

  const score = clamp(
    Math.round(rawScore),
    MIN_ARCHETYPE_SCORE,
    MAX_ARCHETYPE_SCORE
  )

  const isHardConflict =
    strongConflictTypes.length > 0 &&
    matchedTags.length === 0 &&
    matchedVibes.length === 0 &&
    matchedPreferredTypes.length === 0

  const confidenceScore = calculateConfidenceScore({
    normalizedTags,
    normalizedVibes,
    normalizedTypes,
    matchedTags,
    matchedVibes,
    matchedTypes,
    matchedPreferredTypes,
    matchedPreferredVibes,
    conflictingTypes,
    conflictingTokens,
  })

  const confidence = resolveConfidence({
    confidenceScore,
    hasEvidence:
      normalizedTags.length > 0 ||
      normalizedVibes.length > 0 ||
      normalizedTypes.length > 0,
  })

  return {
    score,
    confidence,
    confidenceScore,
    isStrongFit:
      !isHardConflict &&
      score >= 28 &&
      confidenceScore >= 0.55,
    isWeakFit:
      score < 8 ||
      confidenceScore < 0.3,
    isHardConflict,
    breakdown,
    evidence: {
      archetype,
      phase,
      normalizedTags,
      normalizedVibes,
      normalizedTypes,
      normalizedEnergyRamp,
      preferredTypes,
      preferredVibes,
      discouragedTypes,
      matchedTags,
      matchedVibes,
      matchedTypes,
      matchedPreferredTypes,
      matchedPreferredVibes,
      matchedSemanticTokens,
      conflictingTypes,
      conflictingTokens,
      expectedSemanticRole,
      expectedRole,
      hasTagEvidence: normalizedTags.length > 0,
      hasVibeEvidence: normalizedVibes.length > 0,
      hasTypeEvidence: normalizedTypes.length > 0,
      hasEnergyRampEvidence: normalizedEnergyRamp.length > 0,
    },
  }
}

/**
 * Convenience wrapper for ranking pipelines.
 */
export function scoreArchetypeFit(
  venue: ComputeArchetypeFitInput["venue"],
  context: PlanningContext,
  slot?: PlanningSlot
): number {
  return computeArchetypeFit({
    venue,
    context,
    slot,
  }).score
}

/**
 * Hard conflicts should be used sparingly.
 *
 * A discouraged type alone is not enough to reject a venue. Rejection is only
 * appropriate when the venue has a strong conflicting type and no meaningful
 * positive tag, vibe, or preferred-type evidence.
 */
export function isArchetypeHardConflict(
  venue: ComputeArchetypeFitInput["venue"],
  context: PlanningContext,
  slot?: PlanningSlot
): boolean {
  return computeArchetypeFit({
    venue,
    context,
    slot,
  }).isHardConflict
}

/**
 * Returns conservative metadata for diagnostics or persisted stop metadata.
 */
export function getArchetypeFitMetadata(
  result: ArchetypeFitResult
): {
  archetypeFitScore: number
  archetypeFitConfidence: number
  archetypeFitConfidenceLabel: ArchetypeFitConfidence
  archetypeStrongFit: boolean
  archetypeHardConflict: boolean
  archetypeMatchedTags: string[]
  archetypeMatchedVibes: string[]
  archetypeMatchedTypes: string[]
  archetypeMatchedPreferredTypes: string[]
  archetypeMatchedPreferredVibes: string[]
  archetypeMatchedSemanticTokens: string[]
  archetypeConflictingTypes: string[]
  archetypeBreakdown: ArchetypeFitBreakdown
} {
  return {
    archetypeFitScore: result.score,
    archetypeFitConfidence: result.confidenceScore,
    archetypeFitConfidenceLabel: result.confidence,
    archetypeStrongFit: result.isStrongFit,
    archetypeHardConflict: result.isHardConflict,
    archetypeMatchedTags: result.evidence.matchedTags,
    archetypeMatchedVibes: result.evidence.matchedVibes,
    archetypeMatchedTypes: result.evidence.matchedTypes,
    archetypeMatchedPreferredTypes:
      result.evidence.matchedPreferredTypes,
    archetypeMatchedPreferredVibes:
      result.evidence.matchedPreferredVibes,
    archetypeMatchedSemanticTokens:
      result.evidence.matchedSemanticTokens,
    archetypeConflictingTypes:
      result.evidence.conflictingTypes,
    archetypeBreakdown: result.breakdown,
  }
}

/**
 * Use this before presenting archetype-based user-facing copy.
 */
export function hasConfidentArchetypeFit(
  result: ArchetypeFitResult,
  minimumConfidence = 0.6
): boolean {
  return (
    result.confidenceScore >= minimumConfidence &&
    result.score >= 20 &&
    !result.isHardConflict
  )
}

// -----------------------------------------------------------------------------
// Score helpers
// -----------------------------------------------------------------------------

function calculatePhaseFit({
  allVenueTokens,
  phase,
  vocabulary,
}: {
  allVenueTokens: string[]
  phase: SlotPhase
  vocabulary: ArchetypeVocabulary
}): number {
  const phaseTokens =
    phase === "before"
      ? vocabulary.beforeTokens
      : vocabulary.afterTokens

  const matches = findMatches(
    allVenueTokens,
    phaseTokens
  )

  return calculateCappedMatchScore(
    matches.length,
    PHASE_MATCH_SCORE,
    15
  )
}

function calculateRoleFit({
  allVenueTokens,
  expectedRole,
  vocabulary,
}: {
  allVenueTokens: string[]
  expectedRole: string | null
  vocabulary: ArchetypeVocabulary
}): number {
  if (!expectedRole) return 0

  const roleTokens =
    vocabulary.roleTokens[expectedRole] ?? []

  const matches = findMatches(
    allVenueTokens,
    roleTokens
  )

  return calculateCappedMatchScore(
    matches.length,
    ROLE_MATCH_SCORE,
    14
  )
}

function calculateDataQualityAdjustment({
  tagCount,
  vibeCount,
  typeCount,
}: {
  tagCount: number
  vibeCount: number
  typeCount: number
}): number {
  if (
    tagCount > 0 &&
    vibeCount > 0 &&
    typeCount > 0
  ) {
    return 5
  }

  if (
    (tagCount > 0 && vibeCount > 0) ||
    (tagCount > 0 && typeCount > 0) ||
    (vibeCount > 0 && typeCount > 0)
  ) {
    return 2
  }

  if (
    tagCount === 0 &&
    vibeCount === 0 &&
    typeCount === 0
  ) {
    return -8
  }

  return -2
}

/**
 * energy_ramp is intentionally low-weight because venue coverage is incomplete.
 *
 * Missing energy_ramp data has no penalty.
 */
function calculateEnergyRampAdjustment({
  archetype,
  phase,
  energyRamp,
}: {
  archetype: EventArchetype
  phase: SlotPhase
  energyRamp: string[]
}): number {
  if (energyRamp.length === 0) return 0

  const desiredTokens = resolveDesiredEnergyRamp({
    archetype,
    phase,
  })

  const conflictingTokens = resolveConflictingEnergyRamp({
    archetype,
    phase,
  })

  const matches = findMatches(
    energyRamp,
    desiredTokens
  )

  const conflicts = findMatches(
    energyRamp,
    conflictingTokens
  )

  return clamp(
    matches.length * ENERGY_RAMP_MATCH_SCORE -
      conflicts.length * ENERGY_RAMP_CONFLICT_PENALTY,
    -6,
    6
  )
}

function resolveDesiredEnergyRamp({
  archetype,
  phase,
}: {
  archetype: EventArchetype
  phase: SlotPhase
}): string[] {
  if (
    archetype === "nightlife" ||
    archetype === "music" ||
    archetype === "comedy"
  ) {
    return phase === "before"
      ? ["building", "social", "medium", "rising"]
      : ["high", "extended", "late night", "energetic"]
  }

  if (
    archetype === "wellness" ||
    archetype === "arts_culture"
  ) {
    return [
      "low",
      "calm",
      "steady",
      "gentle",
      "relaxed",
    ]
  }

  if (archetype === "social_sports") {
    return [
      "social",
      "medium",
      "lively",
      "building",
    ]
  }

  return [
    "steady",
    "medium",
    "social",
  ]
}

function resolveConflictingEnergyRamp({
  archetype,
}: {
  archetype: EventArchetype
  phase: SlotPhase
}): string[] {
  if (
    archetype === "wellness" ||
    archetype === "arts_culture"
  ) {
    return [
      "extreme",
      "chaotic",
      "rowdy",
      "high intensity",
    ]
  }

  if (
    archetype === "nightlife" ||
    archetype === "music"
  ) {
    return [
      "silent",
      "very low",
      "meditative",
    ]
  }

  return []
}

function calculateConfidenceScore({
  normalizedTags,
  normalizedVibes,
  normalizedTypes,
  matchedTags,
  matchedVibes,
  matchedTypes,
  matchedPreferredTypes,
  matchedPreferredVibes,
  conflictingTypes,
  conflictingTokens,
}: {
  normalizedTags: string[]
  normalizedVibes: string[]
  normalizedTypes: string[]
  matchedTags: string[]
  matchedVibes: string[]
  matchedTypes: string[]
  matchedPreferredTypes: string[]
  matchedPreferredVibes: string[]
  conflictingTypes: string[]
  conflictingTokens: string[]
}): number {
  let confidence = 0

  if (normalizedTags.length > 0) {
    confidence += 0.22
  }

  if (normalizedVibes.length > 0) {
    confidence += 0.24
  }

  if (normalizedTypes.length > 0) {
    confidence += 0.12
  }

  if (matchedTags.length > 0) {
    confidence += 0.14
  }

  if (matchedVibes.length > 0) {
    confidence += 0.14
  }

  if (
    matchedPreferredTypes.length > 0 ||
    matchedTypes.length > 0
  ) {
    confidence += 0.08
  }

  if (matchedPreferredVibes.length > 0) {
    confidence += 0.08
  }

  if (
    conflictingTypes.length > 0 ||
    conflictingTokens.length > 0
  ) {
    confidence -= 0.12
  }

  return Number(
    clamp(confidence, 0, 0.99).toFixed(2)
  )
}

function resolveConfidence({
  confidenceScore,
  hasEvidence,
}: {
  confidenceScore: number
  hasEvidence: boolean
}): ArchetypeFitConfidence {
  if (!hasEvidence) return "insufficient"
  if (confidenceScore >= 0.72) return "high"
  if (confidenceScore >= 0.46) return "medium"
  return "low"
}

function calculateCappedMatchScore(
  matchCount: number,
  scorePerMatch: number,
  maximum: number
): number {
  return Math.min(
    matchCount * scorePerMatch,
    maximum
  )
}

// -----------------------------------------------------------------------------
// Semantic helpers
// -----------------------------------------------------------------------------

function buildSemanticRoleTokens({
  expectedSemanticRole,
  expectedRole,
  vocabulary,
}: {
  expectedSemanticRole: string | null
  expectedRole: string | null
  vocabulary: ArchetypeVocabulary
}): string[] {
  const semanticRoleTokens =
    expectedSemanticRole
      ? normalizeSemanticValues(expectedSemanticRole)
      : []

  const roleTokens =
    expectedRole
      ? vocabulary.roleTokens[expectedRole] ?? []
      : []

  return uniqueStrings([
    ...semanticRoleTokens,
    ...roleTokens,
  ])
}

function resolvePhase(
  context: PlanningContext,
  slot?: PlanningSlot
): SlotPhase {
  if (slot?.phase) return slot.phase
  return context.mode === "before"
    ? "before"
    : "after"
}

// -----------------------------------------------------------------------------
// Normalization and matching
// -----------------------------------------------------------------------------

function normalizeSemanticValues(
  value: unknown
): string[] {
  const normalizedInput:
    | string
    | number
    | string[]
    | null
    | undefined =
    typeof value === "string" ||
    typeof value === "number" ||
    value == null
      ? value
      : Array.isArray(value)
        ? value
            .filter(
              (entry): entry is string | number =>
                typeof entry === "string" ||
                typeof entry === "number"
            )
            .map((entry) => String(entry))
        : undefined

  return uniqueStrings(
    normalizeFeatureValues(normalizedInput)
      .flatMap((entry) => {
        const phrase = canonicalizeToken(entry)
        if (!phrase) return []

        const individualTokens = phrase
          .split(" ")
          .filter((token) => token.length >= 3)

        return [
          phrase,
          ...individualTokens,
        ]
      })
      .filter(Boolean)
  )
}

function findMatches(
  sourceValues: string[],
  targetValues: string[]
): string[] {
  if (
    sourceValues.length === 0 ||
    targetValues.length === 0
  ) {
    return []
  }

  const source = uniqueStrings(
    sourceValues
      .map(canonicalizeToken)
      .filter(Boolean)
  )

  const targets = uniqueStrings(
    targetValues
      .map(canonicalizeToken)
      .filter(Boolean)
  )

  return uniqueStrings(
    targets.filter((target) =>
      source.some((sourceValue) =>
        semanticTokensMatch(
          sourceValue,
          target
        )
      )
    )
  )
}

function semanticTokensMatch(
  source: string,
  target: string
): boolean {
  if (source === target) return true

  const sourceWords = source.split(" ")
  const targetWords = target.split(" ")

  if (
    sourceWords.length > 1 &&
    targetWords.length > 1
  ) {
    const targetSet = new Set(targetWords)
    const sharedWords = sourceWords.filter(
      (word) => targetSet.has(word)
    )

    if (
      sharedWords.length >=
      Math.min(sourceWords.length, targetWords.length)
    ) {
      return true
    }
  }

  if (
    source.length >= 5 &&
    target.length >= 5
  ) {
    if (source.includes(target)) return true
    if (target.includes(source)) return true
  }

  return false
}

function canonicalizeToken(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[_–—-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(values.filter(Boolean))
  )
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum
  )
}