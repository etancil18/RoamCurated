// lib/outings/sequenceScoring/vibeFit.ts

import type {
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  StopRole,
  VenueRecord,
  VibeDaypart,
} from "../types"

import {
  expandVibeTags,
  getDiscouragedDaypartsForVibe,
  getDiscouragedTypesForVibe,
  getFallbackTypePriorityForVibe,
  getPreferredDaypartsForVibe,
  getPreferredTypesForVibe,
  getRequiredAnyTypesForVibe,
  getSequenceTemplatesForVibe,
  getStronglyDiscouragedTypesForVibe,
} from "../vibePresets"

import { normalizeFeatureValues } from "../venueFeatures"

import {
  normalizePrice,
  priceToInt,
} from "./helpers"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type VibeFitConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type VibeFitBreakdown = {
  directVibeMatch: number
  tagMatch: number
  typeMatch: number
  requiredTypeFit: number
  slotTypeFit: number
  roleFit: number
  daypartFit: number
  contextualFit: number
  priceContextAdjustment: number
  energyRampAdjustment: number
  discouragedTypePenalty: number
  stronglyDiscouragedTypePenalty: number
  conflictingVibePenalty: number
  dataQualityAdjustment: number
}

export type VibeFitEvidence = {
  requestedVibes: string[]
  expandedRequestedVibes: string[]

  normalizedVenueVibes: string[]
  normalizedVenueTags: string[]
  normalizedVenueTypes: string[]
  normalizedTimeCategories: string[]
  normalizedEnergyRamp: string[]

  normalizedPrice: string | null
  priceLevel: number | null
  priceContextTokens: string[]

  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]
  fallbackTypePriority: string[]

  slotPreferredTypes: string[]
  slotRequiredAnyTypes: string[]
  slotDiscouragedTypes: string[]

  matchedVenueVibes: string[]
  matchedVenueTags: string[]
  matchedPreferredTypes: string[]
  matchedRequiredTypes: string[]
  matchedSlotPreferredTypes: string[]
  matchedRoleTypes: string[]
  matchedContextualTokens: string[]

  discouragedTypeMatches: string[]
  stronglyDiscouragedTypeMatches: string[]
  conflictingVibeMatches: string[]

  referenceDaypart: VibeDaypart
  preferredDayparts: VibeDaypart[]
  discouragedDayparts: VibeDaypart[]

  phase: SlotPhase
  role: StopRole | null

  hasVibeEvidence: boolean
  hasTagEvidence: boolean
  hasTypeEvidence: boolean
  hasEnergyRampEvidence: boolean
  hasPriceEvidence: boolean
}

export type VibeFitResult = {
  score: number
  confidence: VibeFitConfidence
  confidenceScore: number

  isStrongFit: boolean
  isWeakFit: boolean
  isHardConflict: boolean
  satisfiesRequiredTypes: boolean

  breakdown: VibeFitBreakdown
  evidence: VibeFitEvidence
}

export type ComputeVibeFitInput = {
  venue: Pick<
    VenueRecord,
    | "type"
    | "tags"
    | "vibe"
    | "time_category"
    | "energy_ramp"
    | "price"
  >
  context: PlanningContext
  slot?: PlanningSlot
}

// -----------------------------------------------------------------------------
// Score configuration
// -----------------------------------------------------------------------------

const MAX_VIBE_SCORE = 90
const MIN_VIBE_SCORE = -100

/*
 * Primary evidence:
 * - venue.vibe
 * - venue.tags
 *
 * Secondary evidence:
 * - venue.type
 * - role/type compatibility
 * - daypart
 * - price context
 *
 * Low-weight experimental evidence:
 * - energy_ramp
 */
const DIRECT_VIBE_MATCH_POINTS = 15
const TAG_MATCH_POINTS = 10
const PREFERRED_TYPE_MATCH_POINTS = 6
const REQUIRED_TYPE_MATCH_POINTS = 12
const SLOT_TYPE_MATCH_POINTS = 9
const ROLE_TYPE_MATCH_POINTS = 6
const CONTEXTUAL_MATCH_POINTS = 7

const DISCOURAGED_TYPE_PENALTY = 18
const STRONGLY_DISCOURAGED_TYPE_PENALTY = 32
const CONFLICTING_VIBE_PENALTY = 18

const DAYPART_MATCH_SCORE = 8
const DAYPART_CONFLICT_PENALTY = 12

const ENERGY_RAMP_MATCH_SCORE = 2
const ENERGY_RAMP_CONFLICT_PENALTY = 3

// -----------------------------------------------------------------------------
// Contextual vocabulary
// -----------------------------------------------------------------------------

type VibeContextVocabulary = {
  positiveTokens: string[]
  conflictingTokens: string[]
  preferredTypesByDaypart?: Partial<Record<VibeDaypart, string[]>>
  discouragedTypesByDaypart?: Partial<Record<VibeDaypart, string[]>>
}

const VIBE_CONTEXT_VOCABULARY: Record<string, VibeContextVocabulary> = {
  romantic: {
    positiveTokens: [
      "romantic",
      "intimate",
      "date night",
      "candlelit",
      "moody",
      "atmospheric",
      "elegant",
      "refined",
      "stylish",
      "quiet",
      "private",
      "cozy",
      "wine",
      "cocktail",
      "dessert",
      "lounge",
    ],
    conflictingTokens: [
      "rowdy",
      "sports focused",
      "family chaos",
      "high stimulation",
      "dive",
    ],
    preferredTypesByDaypart: {
      morning: ["cafe", "coffee", "tea", "brunch"],
      midday: ["brunch", "cafe", "restaurant"],
      afternoon: ["wine bar", "cafe", "dessert"],
      evening: [
        "dinner",
        "wine bar",
        "cocktail",
        "lounge",
        "rooftop",
        "dessert",
      ],
      late_night: [
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "sports bar"],
      morning: ["club", "sports bar"],
    },
  },

  social: {
    positiveTokens: [
      "social",
      "group friendly",
      "friends",
      "communal",
      "shareable",
      "celebration",
      "buzzy",
      "lively",
      "energetic",
      "fun",
      "playful",
      "patio",
      "rooftop",
      "hangout",
    ],
    conflictingTokens: [
      "isolated",
      "silent",
      "meditative",
      "solo only",
      "formal",
    ],
    preferredTypesByDaypart: {
      morning: ["coffee", "cafe", "brunch", "breakfast"],
      midday: ["brunch", "lunch", "restaurant", "patio"],
      afternoon: ["brewery", "restaurant", "bar", "patio"],
      evening: [
        "restaurant",
        "dinner",
        "bar",
        "brewery",
        "rooftop",
        "lounge",
      ],
      late_night: [
        "bar",
        "club",
        "lounge",
        "cocktail",
        "rooftop",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "speakeasy", "late night"],
      morning: ["club", "speakeasy", "late night"],
    },
  },

  cozy: {
    positiveTokens: [
      "cozy",
      "warm",
      "welcoming",
      "comfortable",
      "soft lighting",
      "intimate",
      "quiet",
      "calm",
      "relaxed",
      "low key",
      "homey",
      "bookish",
      "charming",
      "neighborhood",
      "hidden gem",
    ],
    conflictingTokens: [
      "rowdy",
      "chaotic",
      "high energy",
      "packed",
      "clubby",
    ],
    preferredTypesByDaypart: {
      morning: ["coffee", "cafe", "tea", "bakery"],
      midday: ["cafe", "bakery", "bookstore", "lunch"],
      afternoon: ["cafe", "tea", "bookstore", "dessert"],
      evening: [
        "wine bar",
        "lounge",
        "dessert",
        "dinner",
        "restaurant",
      ],
      late_night: ["wine bar", "lounge", "dessert"],
    },
    discouragedTypesByDaypart: {
      evening: ["park", "garden", "library"],
      late_night: [
        "park",
        "garden",
        "library",
        "bookstore",
        "bakery",
      ],
    },
  },

  casual: {
    positiveTokens: [
      "casual",
      "easygoing",
      "laid back",
      "relaxed",
      "comfortable",
      "low pressure",
      "unpretentious",
      "friendly",
      "approachable",
      "local",
      "neighborhood",
      "walk in",
      "affordable",
      "patio",
    ],
    conflictingTokens: [
      "formal",
      "exclusive",
      "white tablecloth",
      "members only",
      "ultra refined",
    ],
    preferredTypesByDaypart: {
      morning: ["coffee", "cafe", "breakfast", "bakery"],
      midday: [
        "brunch",
        "lunch",
        "market",
        "restaurant",
        "cafe",
      ],
      afternoon: [
        "restaurant",
        "brewery",
        "market",
        "park",
        "patio",
      ],
      evening: [
        "restaurant",
        "bar",
        "brewery",
        "dinner",
        "patio",
      ],
      late_night: ["bar", "restaurant", "late night"],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "speakeasy"],
      morning: ["club", "speakeasy"],
    },
  },

  upscale: {
    positiveTokens: [
      "upscale",
      "luxury",
      "premium",
      "high end",
      "exclusive",
      "elevated",
      "elegant",
      "refined",
      "polished",
      "sophisticated",
      "chic",
      "stylish",
      "chef driven",
      "reservation",
      "white tablecloth",
      "mixology",
    ],
    conflictingTokens: [
      "dive",
      "counter service",
      "fast casual",
      "rowdy",
      "sports focused",
      "cheap",
    ],
    preferredTypesByDaypart: {
      morning: ["brunch", "cafe"],
      midday: ["brunch", "lunch", "restaurant"],
      afternoon: ["wine bar", "rooftop", "cocktail"],
      evening: [
        "dinner",
        "cocktail",
        "wine bar",
        "rooftop",
        "lounge",
        "speakeasy",
      ],
      late_night: [
        "cocktail",
        "wine bar",
        "lounge",
        "speakeasy",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "late night"],
      morning: ["club", "late night"],
    },
  },

  high_energy: {
    positiveTokens: [
      "high energy",
      "energetic",
      "hype",
      "electric",
      "fast paced",
      "party",
      "turn up",
      "wild",
      "crowded",
      "packed",
      "buzzy",
      "lively",
      "vibrant",
      "dj",
      "dance",
      "dancing",
      "late night",
    ],
    conflictingTokens: [
      "silent",
      "meditative",
      "tranquil",
      "low stimulation",
      "sleepy",
      "study",
    ],
    preferredTypesByDaypart: {
      afternoon: ["brewery", "rooftop", "bar"],
      evening: [
        "bar",
        "club",
        "rooftop",
        "lounge",
        "cocktail",
        "music",
      ],
      late_night: [
        "club",
        "bar",
        "lounge",
        "speakeasy",
        "late night",
        "music",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: [
        "club",
        "late night",
        "speakeasy",
      ],
      morning: [
        "club",
        "late night",
        "speakeasy",
      ],
      midday: ["club", "late night"],
    },
  },

  creative: {
    positiveTokens: [
      "creative",
      "art",
      "artsy",
      "artistic",
      "gallery",
      "museum",
      "design",
      "architecture",
      "aesthetic",
      "curated",
      "thoughtful",
      "maker",
      "studio",
      "boutique",
      "concept",
      "fashion",
      "vintage",
      "indie",
      "experimental",
      "literary",
      "culture",
    ],
    conflictingTokens: [
      "generic",
      "chain",
      "sports focused",
      "corporate",
      "mass market",
    ],
    preferredTypesByDaypart: {
      morning: [
        "cafe",
        "coffee",
        "bookstore",
        "gallery",
      ],
      midday: [
        "gallery",
        "museum",
        "bookstore",
        "cafe",
      ],
      afternoon: [
        "gallery",
        "museum",
        "bookstore",
        "wine bar",
      ],
      evening: [
        "wine bar",
        "cocktail",
        "lounge",
        "music",
        "cinema",
        "theater",
      ],
      late_night: [
        "wine bar",
        "cocktail",
        "music",
        "lounge",
      ],
    },
    discouragedTypesByDaypart: {
      late_night: ["library", "museum", "bookstore"],
    },
  },

  chill: {
    positiveTokens: [
      "chill",
      "relaxed",
      "calm",
      "quiet",
      "peaceful",
      "easygoing",
      "laid back",
      "low key",
      "soft",
      "gentle",
      "cozy",
      "comfortable",
      "ambient",
      "tranquil",
      "serene",
      "conversation friendly",
      "low energy",
      "quiet bar",
      "hidden gem",
      "neighborhood",
      "unwind",
      "decompress",
    ],
    conflictingTokens: [
      "rowdy",
      "chaotic",
      "high energy",
      "party",
      "packed",
      "loud",
      "sports focused",
      "dance floor",
    ],
    preferredTypesByDaypart: {
      early_morning: [
        "coffee",
        "cafe",
        "tea",
        "bakery",
        "breakfast",
      ],
      morning: [
        "coffee",
        "cafe",
        "tea",
        "bakery",
        "breakfast",
        "park",
        "garden",
      ],
      midday: [
        "cafe",
        "tea",
        "bakery",
        "lunch",
        "bookstore",
        "park",
        "garden",
      ],
      afternoon: [
        "cafe",
        "tea",
        "dessert",
        "bookstore",
        "park",
        "garden",
        "gallery",
      ],
      evening: [
        "wine bar",
        "cocktail",
        "lounge",
        "restaurant",
        "dinner",
        "dessert",
      ],
      late_night: [
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: [
        "club",
        "sports bar",
        "dive bar",
      ],
      morning: [
        "club",
        "sports bar",
        "dive bar",
      ],
      midday: [
        "club",
        "late night",
      ],
      evening: [
        "park",
        "garden",
        "library",
        "bookstore",
        "yoga",
        "pilates",
        "fitness",
      ],
      late_night: [
        "park",
        "garden",
        "library",
        "bookstore",
        "gallery",
        "museum",
        "yoga",
        "pilates",
        "fitness",
      ],
    },
  },
}

// -----------------------------------------------------------------------------
// Role compatibility
// -----------------------------------------------------------------------------

const ROLE_TYPE_PREFERENCES: Record<StopRole, string[]> = {
  coffee: [
    "coffee",
    "cafe",
    "café",
    "tea",
    "bakery",
    "breakfast",
  ],
  food: [
    "restaurant",
    "dinner",
    "lunch",
    "brunch",
    "breakfast",
    "food hall",
    "casual food",
  ],
  drink: [
    "bar",
    "cocktail",
    "wine bar",
    "lounge",
    "brewery",
    "pub",
    "speakeasy",
    "rooftop",
  ],
  activity: [
    "gallery",
    "museum",
    "bookstore",
    "market",
    "park",
    "garden",
    "music",
    "cinema",
    "theater",
    "activity",
  ],
  dessert: [
    "dessert",
    "bakery",
    "ice cream",
    "cafe",
    "café",
  ],
}

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeVibeFit({
  venue,
  context,
  slot,
}: ComputeVibeFitInput): VibeFitResult {
  const requestedVibes = normalizePresetIdentifiers(
    context.vibeTags
  )

  const expandedRequestedVibes =
    normalizeSemanticValues(
      expandVibeTags(
        context.vibeTags
      )
    )

  const normalizedVenueVibes =
    normalizeSemanticValues(
      venue.vibe
    )

  const normalizedVenueTags =
    normalizeSemanticValues(
      venue.tags
    )

  const normalizedVenueTypes =
    normalizeSemanticValues(
      venue.type
    )

  const normalizedTimeCategories =
    normalizeSemanticValues(
      venue.time_category
    )

  const normalizedEnergyRamp =
    normalizeSemanticValues(
      venue.energy_ramp
    )

  const normalizedPrice =
    normalizePrice(
      venue.price
    )

  const priceLevel =
    normalizedPrice
      ? normalizePriceLevel(
          priceToInt(
            normalizedPrice
          )
        )
      : null

  const priceContextTokens =
    resolvePriceContextTokens(
      context,
      requestedVibes,
      expandedRequestedVibes
    )

  const preferredTypes =
    normalizeSemanticValues(
      context.vibePlanning?.preferredTypes?.length
        ? context.vibePlanning.preferredTypes
        : getPreferredTypesForVibe(
            context.vibeTags
          )
    )

  const requiredAnyTypes =
    normalizeSemanticValues(
      context.vibePlanning?.requiredAnyTypes?.length
        ? context.vibePlanning.requiredAnyTypes
        : getRequiredAnyTypesForVibe(
            context.vibeTags
          )
    )

  const discouragedTypes =
    normalizeSemanticValues(
      context.vibePlanning?.discouragedTypes?.length
        ? context.vibePlanning.discouragedTypes
        : getDiscouragedTypesForVibe(
            context.vibeTags
          )
    )

  const stronglyDiscouragedTypes =
    normalizeSemanticValues(
      context.vibePlanning?.stronglyDiscouragedTypes?.length
        ? context.vibePlanning.stronglyDiscouragedTypes
        : getStronglyDiscouragedTypesForVibe(
            context.vibeTags
          )
    )

  const fallbackTypePriority =
    normalizeSemanticValues(
      context.vibePlanning?.fallbackTypePriority?.length
        ? context.vibePlanning.fallbackTypePriority
        : getFallbackTypePriorityForVibe(
            context.vibeTags
          )
    )

  const preferredDayparts =
    context.vibePlanning?.preferredDayparts?.length
      ? context.vibePlanning.preferredDayparts
      : getPreferredDaypartsForVibe(
          context.vibeTags
        )

  const discouragedDayparts =
    context.vibePlanning?.discouragedDayparts?.length
      ? context.vibePlanning.discouragedDayparts
      : getDiscouragedDaypartsForVibe(
          context.vibeTags
        )

  const phase = resolvePhase(
    context,
    slot
  )

  const role =
    slot?.role ??
    null

  const referenceDaypart =
    resolveReferenceDaypart(
      context,
      slot
    )

  const slotPreferredTypes =
    normalizeSemanticValues(
      slot?.vibePreferredTypes ??
      []
    )

  const slotRequiredAnyTypes =
    normalizeSemanticValues(
      slot?.vibeRequiredAnyTypes ??
      []
    )

  const slotDiscouragedTypes =
    normalizeSemanticValues(
      slot?.vibeDiscouragedTypes ??
      []
    )

  const contextualVocabulary =
    combineContextVocabulary(
      requestedVibes
    )

  const contextualPreferredTypes =
    normalizeSemanticValues(
      contextualVocabulary
        .preferredTypesByDaypart?.[
          referenceDaypart
        ] ?? []
    )

  const contextualDiscouragedTypes =
    normalizeSemanticValues(
      contextualVocabulary
        .discouragedTypesByDaypart?.[
          referenceDaypart
        ] ?? []
    )

  const effectivePreferredTypes =
    uniqueStrings([
      ...preferredTypes,
      ...slotPreferredTypes,
      ...contextualPreferredTypes,
    ])

  const effectiveDiscouragedTypes =
    uniqueStrings([
      ...discouragedTypes,
      ...slotDiscouragedTypes,
      ...contextualDiscouragedTypes,
    ])

  const effectiveRequiredTypes =
    uniqueStrings([
      ...requiredAnyTypes,
      ...slotRequiredAnyTypes,
    ])

  const matchedVenueVibes =
    findMatches(
      normalizedVenueVibes,
      uniqueStrings([
        ...expandedRequestedVibes,
        ...contextualVocabulary.positiveTokens,
      ])
    )

  const matchedVenueTags =
    findMatches(
      normalizedVenueTags,
      uniqueStrings([
        ...expandedRequestedVibes,
        ...contextualVocabulary.positiveTokens,
      ])
    )

  const matchedPreferredTypes =
    findMatches(
      normalizedVenueTypes,
      effectivePreferredTypes
    )

  const matchedRequiredTypes =
    findMatches(
      normalizedVenueTypes,
      effectiveRequiredTypes
    )

  const matchedSlotPreferredTypes =
    findMatches(
      normalizedVenueTypes,
      uniqueStrings([
        ...slotPreferredTypes,
        ...contextualPreferredTypes,
      ])
    )

  const rolePreferredTypes =
    role != null
      ? ROLE_TYPE_PREFERENCES[
          role
        ]
      : []

  const matchedRoleTypes =
    findMatches(
      normalizedVenueTypes,
      rolePreferredTypes
    )

  const venueSemanticTokens =
    uniqueStrings([
      ...normalizedVenueVibes,
      ...normalizedVenueTags,
      ...normalizedVenueTypes,
      ...normalizedTimeCategories,
    ])

  const matchedContextualTokens =
    findMatches(
      venueSemanticTokens,
      contextualVocabulary.positiveTokens
    )

  const discouragedTypeMatches =
    findMatches(
      normalizedVenueTypes,
      effectiveDiscouragedTypes
    )

  const stronglyDiscouragedTypeMatches =
    findMatches(
      normalizedVenueTypes,
      stronglyDiscouragedTypes
    )

  const conflictingVibeMatches =
    findMatches(
      uniqueStrings([
        ...normalizedVenueVibes,
        ...normalizedVenueTags,
      ]),
      contextualVocabulary.conflictingTokens
    )

  const satisfiesRequiredTypes =
    effectiveRequiredTypes.length === 0 ||
    matchedRequiredTypes.length > 0

  const directVibeMatch =
    calculateCappedMatchScore(
      matchedVenueVibes.length,
      DIRECT_VIBE_MATCH_POINTS,
      36
    )

  const tagMatch =
    calculateCappedMatchScore(
      matchedVenueTags.length,
      TAG_MATCH_POINTS,
      30
    )

  const typeMatch =
    calculateCappedMatchScore(
      matchedPreferredTypes.length,
      PREFERRED_TYPE_MATCH_POINTS,
      18
    )

  const requiredTypeFit =
    effectiveRequiredTypes.length === 0
      ? 0
      : satisfiesRequiredTypes
        ? REQUIRED_TYPE_MATCH_POINTS
        : -10

  const slotTypeFit =
    calculateCappedMatchScore(
      matchedSlotPreferredTypes.length,
      SLOT_TYPE_MATCH_POINTS,
      18
    )

  const roleFit =
    calculateCappedMatchScore(
      matchedRoleTypes.length,
      ROLE_TYPE_MATCH_POINTS,
      12
    )

  const daypartFit =
    calculateDaypartFit({
      referenceDaypart,
      preferredDayparts,
      discouragedDayparts,
      normalizedTimeCategories,
    })

  const contextualFit =
    calculateCappedMatchScore(
      matchedContextualTokens.length,
      CONTEXTUAL_MATCH_POINTS,
      21
    )

  const priceContextAdjustment =
    calculatePriceContextAdjustment({
      priceLevel,
      priceContextTokens,
    })

  const energyRampAdjustment =
    calculateEnergyRampAdjustment({
      requestedVibes,
      normalizedEnergyRamp,
      referenceDaypart,
    })

  const discouragedTypePenalty =
    Math.min(
      discouragedTypeMatches.length *
        DISCOURAGED_TYPE_PENALTY,
      45
    )

  const stronglyDiscouragedTypePenalty =
    Math.min(
      stronglyDiscouragedTypeMatches.length *
        STRONGLY_DISCOURAGED_TYPE_PENALTY,
      64
    )

  const conflictingVibePenalty =
    Math.min(
      conflictingVibeMatches.length *
        CONFLICTING_VIBE_PENALTY,
      42
    )

  const dataQualityAdjustment =
    calculateDataQualityAdjustment({
      vibeCount:
        normalizedVenueVibes.length,

      tagCount:
        normalizedVenueTags.length,

      typeCount:
        normalizedVenueTypes.length,
    })

  const breakdown: VibeFitBreakdown = {
    directVibeMatch,
    tagMatch,
    typeMatch,
    requiredTypeFit,
    slotTypeFit,
    roleFit,
    daypartFit,
    contextualFit,
    priceContextAdjustment,
    energyRampAdjustment,
    discouragedTypePenalty,
    stronglyDiscouragedTypePenalty,
    conflictingVibePenalty,
    dataQualityAdjustment,
  }

  const rawScore =
    directVibeMatch +
    tagMatch +
    typeMatch +
    requiredTypeFit +
    slotTypeFit +
    roleFit +
    daypartFit +
    contextualFit +
    priceContextAdjustment +
    energyRampAdjustment +
    dataQualityAdjustment -
    discouragedTypePenalty -
    stronglyDiscouragedTypePenalty -
    conflictingVibePenalty

  const score =
    clamp(
      Math.round(
        rawScore
      ),
      MIN_VIBE_SCORE,
      MAX_VIBE_SCORE
    )

  /*
   * A strong type conflict alone is not enough to reject a venue when
   * its tags or vibes provide strong positive contextual evidence.
   *
   * Price mismatch remains a scoring signal here rather than a hard conflict.
   * The selection layer owns pass-aware price rejection so an emergency pass
   * can preserve route coverage when necessary.
   */
  const positiveSemanticEvidence =
    matchedVenueVibes.length +
    matchedVenueTags.length +
    matchedContextualTokens.length

  const isHardConflict =
    stronglyDiscouragedTypeMatches.length > 0 &&
    conflictingVibeMatches.length > 0 &&
    positiveSemanticEvidence === 0

  const confidenceScore =
    calculateConfidenceScore({
      normalizedVenueVibes,
      normalizedVenueTags,
      normalizedVenueTypes,
      matchedVenueVibes,
      matchedVenueTags,
      matchedPreferredTypes,
      matchedRequiredTypes,
      matchedContextualTokens,
      discouragedTypeMatches,
      stronglyDiscouragedTypeMatches,
      conflictingVibeMatches,
      satisfiesRequiredTypes,
      hasPriceEvidence:
        priceLevel != null,

      hasPriceContext:
        priceContextTokens.length >
        0,
    })

  const confidence =
    resolveConfidence({
      confidenceScore,

      hasEvidence:
        normalizedVenueVibes.length > 0 ||
        normalizedVenueTags.length > 0 ||
        normalizedVenueTypes.length > 0 ||
        priceLevel != null,
    })

  return {
    score,
    confidence,
    confidenceScore,

    isStrongFit:
      !isHardConflict &&
      score >= 30 &&
      confidenceScore >= 0.58,

    isWeakFit:
      score < 8 ||
      confidenceScore < 0.3,

    isHardConflict,
    satisfiesRequiredTypes,

    breakdown,

    evidence: {
      requestedVibes,
      expandedRequestedVibes,

      normalizedVenueVibes,
      normalizedVenueTags,
      normalizedVenueTypes,
      normalizedTimeCategories,
      normalizedEnergyRamp,

      normalizedPrice,
      priceLevel,
      priceContextTokens,

      preferredTypes,
      requiredAnyTypes,
      discouragedTypes,
      stronglyDiscouragedTypes,
      fallbackTypePriority,

      slotPreferredTypes,
      slotRequiredAnyTypes,
      slotDiscouragedTypes,

      matchedVenueVibes,
      matchedVenueTags,
      matchedPreferredTypes,
      matchedRequiredTypes,
      matchedSlotPreferredTypes,
      matchedRoleTypes,
      matchedContextualTokens,

      discouragedTypeMatches,
      stronglyDiscouragedTypeMatches,
      conflictingVibeMatches,

      referenceDaypart,
      preferredDayparts,
      discouragedDayparts,

      phase,
      role,

      hasVibeEvidence:
        normalizedVenueVibes.length >
        0,

      hasTagEvidence:
        normalizedVenueTags.length >
        0,

      hasTypeEvidence:
        normalizedVenueTypes.length >
        0,

      hasEnergyRampEvidence:
        normalizedEnergyRamp.length >
        0,

      hasPriceEvidence:
        priceLevel != null,
    },
  }
}

/**
 * Drop-in numeric scoring wrapper.
 */
export function scoreVibeFit(
  venue: ComputeVibeFitInput["venue"],
  context: PlanningContext,
  slot?: PlanningSlot
): number {
  return computeVibeFit({
    venue,
    context,
    slot,
  }).score
}

/**
 * Use this only for hard-constraint selection passes.
 *
 * Most vibe mismatches should remain penalties rather than outright
 * rejections.
 */
export function isVibeHardConflict(
  venue: ComputeVibeFitInput["venue"],
  context: PlanningContext,
  slot?: PlanningSlot
): boolean {
  return computeVibeFit({
    venue,
    context,
    slot,
  }).isHardConflict
}

/**
 * Returns conservative metadata for persisted stops and diagnostics.
 */
export function getVibeFitMetadata(
  result: VibeFitResult
): {
  vibeFitScore: number
  vibeFitConfidence: number
  vibeFitConfidenceLabel: VibeFitConfidence
  vibeStrongFit: boolean
  vibeHardConflict: boolean
  vibeSatisfiesRequiredTypes: boolean
  vibeMatchedVibes: string[]
  vibeMatchedTags: string[]
  vibeMatchedTypes: string[]
  vibeMatchedRequiredTypes: string[]
  vibeMatchedContextualTokens: string[]
  vibeDiscouragedTypeMatches: string[]
  vibeStronglyDiscouragedTypeMatches: string[]
  vibeConflictingTokens: string[]
  vibeReferenceDaypart: VibeDaypart
  vibePriceLevel: number | null
  vibePriceContextAdjustment: number
  vibeBreakdown: VibeFitBreakdown
} {
  return {
    vibeFitScore:
      result.score,

    vibeFitConfidence:
      result.confidenceScore,

    vibeFitConfidenceLabel:
      result.confidence,

    vibeStrongFit:
      result.isStrongFit,

    vibeHardConflict:
      result.isHardConflict,

    vibeSatisfiesRequiredTypes:
      result.satisfiesRequiredTypes,

    vibeMatchedVibes:
      result.evidence.matchedVenueVibes,

    vibeMatchedTags:
      result.evidence.matchedVenueTags,

    vibeMatchedTypes:
      result.evidence.matchedPreferredTypes,

    vibeMatchedRequiredTypes:
      result.evidence.matchedRequiredTypes,

    vibeMatchedContextualTokens:
      result.evidence.matchedContextualTokens,

    vibeDiscouragedTypeMatches:
      result.evidence.discouragedTypeMatches,

    vibeStronglyDiscouragedTypeMatches:
      result.evidence
        .stronglyDiscouragedTypeMatches,

    vibeConflictingTokens:
      result.evidence.conflictingVibeMatches,

    vibeReferenceDaypart:
      result.evidence.referenceDaypart,

    vibePriceLevel:
      result.evidence.priceLevel,

    vibePriceContextAdjustment:
      result.breakdown
        .priceContextAdjustment,

    vibeBreakdown:
      result.breakdown,
  }
}

/**
 * Use this threshold before generating user-facing claims such as
 * "perfect for a chill evening."
 */
export function hasConfidentVibeFit(
  result: VibeFitResult,
  minimumConfidence = 0.62
): boolean {
  return (
    result.confidenceScore >=
      minimumConfidence &&
    result.score >= 24 &&
    !result.isHardConflict
  )
}

/**
 * Returns the preferred venue types for the active slot and daypart.
 * Useful for candidate diagnostics and fallback ordering.
 */
export function getContextualPreferredTypesForVibe(
  context: PlanningContext,
  slot?: PlanningSlot
): string[] {
  const requestedVibes =
    normalizePresetIdentifiers(
      context.vibeTags
    )

  const daypart =
    resolveReferenceDaypart(
      context,
      slot
    )

  const vocabulary =
    combineContextVocabulary(
      requestedVibes
    )

  const templateTypes =
    getTemplatePreferredTypes({
      context,
      slot,
    })

  return uniqueStrings([
    ...normalizeSemanticValues(
      context.vibePlanning?.preferredTypes?.length
        ? context.vibePlanning.preferredTypes
        : getPreferredTypesForVibe(
            context.vibeTags
          )
    ),

    ...normalizeSemanticValues(
      slot?.vibePreferredTypes ??
      []
    ),

    ...normalizeSemanticValues(
      vocabulary
        .preferredTypesByDaypart?.[
          daypart
        ] ?? []
    ),

    ...templateTypes,
  ])
}

// -----------------------------------------------------------------------------
// Context and scoring helpers
// -----------------------------------------------------------------------------

function calculateDaypartFit({
  referenceDaypart,
  preferredDayparts,
  discouragedDayparts,
  normalizedTimeCategories,
}: {
  referenceDaypart: VibeDaypart
  preferredDayparts: VibeDaypart[]
  discouragedDayparts: VibeDaypart[]
  normalizedTimeCategories: string[]
}): number {
  let score = 0

  if (
    preferredDayparts.includes(
      referenceDaypart
    )
  ) {
    score +=
      DAYPART_MATCH_SCORE
  }

  if (
    discouragedDayparts.includes(
      referenceDaypart
    )
  ) {
    score -=
      DAYPART_CONFLICT_PENALTY
  }

  if (
    normalizedTimeCategories.length > 0 &&
    findMatches(
      normalizedTimeCategories,
      daypartTokens(
        referenceDaypart
      )
    ).length > 0
  ) {
    score += 4
  }

  return clamp(
    score,
    -16,
    12
  )
}

function calculateDataQualityAdjustment({
  vibeCount,
  tagCount,
  typeCount,
}: {
  vibeCount: number
  tagCount: number
  typeCount: number
}): number {
  if (
    vibeCount > 0 &&
    tagCount > 0
  ) {
    return 6
  }

  if (
    vibeCount > 0 ||
    tagCount > 0
  ) {
    return 2
  }

  if (typeCount > 0) {
    /*
     * Type-only candidates remain eligible, but should not receive
     * high-confidence vibe claims.
     */
    return -4
  }

  return -10
}

// -----------------------------------------------------------------------------
// Price-context scoring
// -----------------------------------------------------------------------------

function calculatePriceContextAdjustment({
  priceLevel,
  priceContextTokens,
}: {
  priceLevel: number | null
  priceContextTokens: string[]
}): number {
  if (
    priceLevel == null ||
    priceContextTokens.length === 0
  ) {
    return 0
  }

  const casualIntent =
    hasAnySemanticToken(
      priceContextTokens,
      [
        "casual",
        "chill",
        "laid back",
        "low key",
        "easygoing",
        "affordable",
        "budget friendly",
        "unpretentious",
        "approachable",
        "neighborhood",
        "walk in",
      ]
    )

  if (casualIntent) {
    if (priceLevel === 1) {
      return 14
    }

    if (priceLevel === 2) {
      return 9
    }

    if (priceLevel === 3) {
      return -14
    }

    return -42
  }

  const upscaleIntent =
    hasAnySemanticToken(
      priceContextTokens,
      [
        "upscale",
        "luxury",
        "premium",
        "high end",
        "exclusive",
        "elevated",
        "elegant",
        "refined",
        "polished",
        "sophisticated",
        "white tablecloth",
        "splurge",
      ]
    )

  if (upscaleIntent) {
    if (priceLevel === 4) {
      return 16
    }

    if (priceLevel === 3) {
      return 11
    }

    if (priceLevel === 2) {
      return 0
    }

    return -10
  }

  const romanticIntent =
    hasAnySemanticToken(
      priceContextTokens,
      [
        "romantic",
        "date night",
        "intimate",
        "candlelit",
        "elegant",
        "wine",
        "cozy date",
      ]
    )

  if (romanticIntent) {
    if (priceLevel === 3) {
      return 9
    }

    if (priceLevel === 4) {
      return 6
    }

    if (priceLevel === 2) {
      return 5
    }

    return -4
  }

  const cozyIntent =
    hasAnySemanticToken(
      priceContextTokens,
      [
        "cozy",
        "warm",
        "quiet",
        "comfortable",
        "relaxed",
        "homey",
        "neighborhood",
        "hidden gem",
      ]
    )

  if (cozyIntent) {
    if (
      priceLevel === 1 ||
      priceLevel === 2
    ) {
      return 6
    }

    if (priceLevel === 3) {
      return 2
    }

    return -8
  }

  const socialIntent =
    hasAnySemanticToken(
      priceContextTokens,
      [
        "social",
        "group friendly",
        "friends",
        "communal",
        "shareable",
        "hangout",
        "celebration",
      ]
    )

  if (socialIntent) {
    if (
      priceLevel === 1 ||
      priceLevel === 2
    ) {
      return 4
    }

    if (priceLevel === 3) {
      return 2
    }

    return -6
  }

  const wellnessIntent =
    hasAnySemanticToken(
      priceContextTokens,
      [
        "wellness",
        "healthy",
        "clean",
        "restorative",
        "mindful",
        "calm",
        "daytime",
      ]
    )

  if (wellnessIntent) {
    if (
      priceLevel === 1 ||
      priceLevel === 2
    ) {
      return 5
    }

    if (priceLevel === 3) {
      return -4
    }

    return -12
  }

  /*
   * High-energy and creative presets should be differentiated primarily by
   * venue identity, energy, tags, types, and daypart—not by price.
   */
  return 0
}

function resolvePriceContextTokens(
  context: PlanningContext,
  requestedVibes: string[],
  expandedRequestedVibes: string[]
): string[] {
  return uniqueStrings([
    ...normalizeSemanticValues(
      requestedVibes
    ),

    ...normalizeSemanticValues(
      expandedRequestedVibes
    ),

    ...normalizeSemanticValues(
      context.vibePlanning
        ?.expandedTokens ??
        []
    ),

    ...normalizeSemanticValues(
      context.vibePlanning
        ?.matchedPresetIds ??
        []
    ),
  ])
}

function normalizePriceLevel(
  value: number
): number | null {
  if (
    !Number.isFinite(value) ||
    value < 1 ||
    value > 4
  ) {
    return null
  }

  return Math.round(
    value
  )
}

function hasAnySemanticToken(
  sourceValues: string[],
  expectedValues: string[]
): boolean {
  return (
    findMatches(
      sourceValues,
      expectedValues
    ).length > 0
  )
}

/**
 * energy_ramp remains intentionally low-weight.
 *
 * Missing values receive no penalty. A present value can only move the
 * result a few points in either direction.
 */
function calculateEnergyRampAdjustment({
  requestedVibes,
  normalizedEnergyRamp,
  referenceDaypart,
}: {
  requestedVibes: string[]
  normalizedEnergyRamp: string[]
  referenceDaypart: VibeDaypart
}): number {
  if (
    normalizedEnergyRamp.length === 0
  ) {
    return 0
  }

  const desiredEnergyTokens =
    resolveDesiredEnergyTokens(
      requestedVibes,
      referenceDaypart
    )

  const conflictingEnergyTokens =
    resolveConflictingEnergyTokens(
      requestedVibes,
      referenceDaypart
    )

  const matches =
    findMatches(
      normalizedEnergyRamp,
      desiredEnergyTokens
    )

  const conflicts =
    findMatches(
      normalizedEnergyRamp,
      conflictingEnergyTokens
    )

  return clamp(
    matches.length *
      ENERGY_RAMP_MATCH_SCORE -
      conflicts.length *
        ENERGY_RAMP_CONFLICT_PENALTY,
    -5,
    5
  )
}

function resolveDesiredEnergyTokens(
  requestedVibes: string[],
  referenceDaypart: VibeDaypart
): string[] {
  if (
    requestedVibes.includes(
      "high energy"
    ) ||
    requestedVibes.includes(
      "high_energy"
    ) ||
    requestedVibes.includes(
      "social"
    )
  ) {
    return [
      "medium",
      "building",
      "lively",
      "high",
      "social",
      "energetic",
    ]
  }

  if (
    requestedVibes.includes(
      "chill"
    ) ||
    requestedVibes.includes(
      "cozy"
    ) ||
    requestedVibes.includes(
      "romantic"
    )
  ) {
    return (
      referenceDaypart === "evening" ||
      referenceDaypart === "late_night"
    )
      ? [
          "low",
          "steady",
          "soft",
          "calm",
          "intimate",
          "low energy",
        ]
      : [
          "low",
          "steady",
          "gentle",
          "calm",
          "relaxed",
        ]
  }

  return [
    "steady",
    "medium",
    "balanced",
  ]
}

function resolveConflictingEnergyTokens(
  requestedVibes: string[],
  referenceDaypart: VibeDaypart
): string[] {
  if (
    requestedVibes.includes(
      "chill"
    ) ||
    requestedVibes.includes(
      "cozy"
    ) ||
    requestedVibes.includes(
      "romantic"
    )
  ) {
    return [
      "extreme",
      "chaotic",
      "rowdy",
      "very high",
      "high intensity",
    ]
  }

  if (
    requestedVibes.includes(
      "high energy"
    ) ||
    requestedVibes.includes(
      "high_energy"
    )
  ) {
    return (
      referenceDaypart === "evening" ||
      referenceDaypart === "late_night"
    )
      ? [
          "silent",
          "very low",
          "meditative",
        ]
      : []
  }

  return []
}

function calculateConfidenceScore({
  normalizedVenueVibes,
  normalizedVenueTags,
  normalizedVenueTypes,
  matchedVenueVibes,
  matchedVenueTags,
  matchedPreferredTypes,
  matchedRequiredTypes,
  matchedContextualTokens,
  discouragedTypeMatches,
  stronglyDiscouragedTypeMatches,
  conflictingVibeMatches,
  satisfiesRequiredTypes,
  hasPriceEvidence,
  hasPriceContext,
}: {
  normalizedVenueVibes: string[]
  normalizedVenueTags: string[]
  normalizedVenueTypes: string[]
  matchedVenueVibes: string[]
  matchedVenueTags: string[]
  matchedPreferredTypes: string[]
  matchedRequiredTypes: string[]
  matchedContextualTokens: string[]
  discouragedTypeMatches: string[]
  stronglyDiscouragedTypeMatches: string[]
  conflictingVibeMatches: string[]
  satisfiesRequiredTypes: boolean
  hasPriceEvidence: boolean
  hasPriceContext: boolean
}): number {
  let confidence = 0

  if (
    normalizedVenueVibes.length >
    0
  ) {
    confidence += 0.26
  }

  if (
    normalizedVenueTags.length >
    0
  ) {
    confidence += 0.22
  }

  if (
    normalizedVenueTypes.length >
    0
  ) {
    confidence += 0.08
  }

  if (
    matchedVenueVibes.length >
    0
  ) {
    confidence += 0.18
  }

  if (
    matchedVenueTags.length >
    0
  ) {
    confidence += 0.14
  }

  if (
    matchedPreferredTypes.length >
    0
  ) {
    confidence += 0.06
  }

  if (
    matchedRequiredTypes.length >
    0
  ) {
    confidence += 0.06
  }

  if (
    matchedContextualTokens.length >
    0
  ) {
    confidence += 0.08
  }

  /*
   * Price is supporting context only. It must not create a confident vibe
   * classification when tags and vibes are otherwise absent.
   */
  if (
    hasPriceEvidence &&
    hasPriceContext
  ) {
    confidence += 0.03
  }

  if (
    !satisfiesRequiredTypes
  ) {
    confidence -= 0.08
  }

  if (
    discouragedTypeMatches.length >
    0
  ) {
    confidence -= 0.06
  }

  if (
    stronglyDiscouragedTypeMatches.length >
    0
  ) {
    confidence -= 0.12
  }

  if (
    conflictingVibeMatches.length >
    0
  ) {
    confidence -= 0.12
  }

  /*
   * Type-only or price-only evidence must never produce a high-confidence
   * vibe claim.
   */
  if (
    normalizedVenueVibes.length === 0 &&
    normalizedVenueTags.length === 0
  ) {
    confidence =
      Math.min(
        confidence,
        0.32
      )
  }

  return Number(
    clamp(
      confidence,
      0,
      0.99
    ).toFixed(2)
  )
}

function resolveConfidence({
  confidenceScore,
  hasEvidence,
}: {
  confidenceScore: number
  hasEvidence: boolean
}): VibeFitConfidence {
  if (!hasEvidence) {
    return "insufficient"
  }

  if (
    confidenceScore >= 0.72
  ) {
    return "high"
  }

  if (
    confidenceScore >= 0.46
  ) {
    return "medium"
  }

  return "low"
}

function combineContextVocabulary(
  requestedVibes: string[]
): VibeContextVocabulary {
  const vocabularies =
    requestedVibes
      .map(
        (vibe) =>
          VIBE_CONTEXT_VOCABULARY[
            vibe
          ]
      )
      .filter(
        (
          value
        ): value is VibeContextVocabulary =>
          value != null
      )

  if (
    vocabularies.length === 0
  ) {
    return {
      positiveTokens: [],
      conflictingTokens: [],
      preferredTypesByDaypart: {},
      discouragedTypesByDaypart: {},
    }
  }

  const preferredTypesByDaypart: Partial<
    Record<VibeDaypart, string[]>
  > = {}

  const discouragedTypesByDaypart: Partial<
    Record<VibeDaypart, string[]>
  > = {}

  for (
    const vocabulary of
    vocabularies
  ) {
    for (
      const daypart of
      ALL_DAYPARTS
    ) {
      preferredTypesByDaypart[
        daypart
      ] = uniqueStrings([
        ...(
          preferredTypesByDaypart[
            daypart
          ] ?? []
        ),
        ...(
          vocabulary
            .preferredTypesByDaypart?.[
              daypart
            ] ?? []
        ),
      ])

      discouragedTypesByDaypart[
        daypart
      ] = uniqueStrings([
        ...(
          discouragedTypesByDaypart[
            daypart
          ] ?? []
        ),
        ...(
          vocabulary
            .discouragedTypesByDaypart?.[
              daypart
            ] ?? []
        ),
      ])
    }
  }

  return {
    positiveTokens:
      uniqueStrings(
        vocabularies.flatMap(
          (vocabulary) =>
            vocabulary.positiveTokens
        )
      ),

    conflictingTokens:
      uniqueStrings(
        vocabularies.flatMap(
          (vocabulary) =>
            vocabulary.conflictingTokens
        )
      ),

    preferredTypesByDaypart,
    discouragedTypesByDaypart,
  }
}

function getTemplatePreferredTypes({
  context,
  slot,
}: {
  context: PlanningContext
  slot?: PlanningSlot
}): string[] {
  if (!slot) {
    return []
  }

  const templates =
    context.vibePlanning
      ?.sequenceTemplates
      ?.length
      ? context.vibePlanning
          .sequenceTemplates
      : getSequenceTemplatesForVibe(
          context.vibeTags
        )

  const matchingTemplate =
    templates.find(
      (template) =>
        template.mode ===
          context.mode ||
        (
          context.mode === "full" &&
          template.mode === "full"
        )
    )

  if (!matchingTemplate) {
    return []
  }

  return normalizeSemanticValues(
    matchingTemplate
      .preferredTypesByRole?.[
        slot.role
      ] ?? []
  )
}

function resolvePhase(
  context: PlanningContext,
  slot?: PlanningSlot
): SlotPhase {
  if (
    slot?.phase
  ) {
    return slot.phase
  }

  return (
    context.mode === "before"
      ? "before"
      : "after"
  )
}

function resolveReferenceDaypart(
  context: PlanningContext,
  slot?: PlanningSlot
): VibeDaypart {
  const referenceDate =
    slot?.targetArrivalAt ??
    (
      context.mode === "before"
        ? context.plannedStartAt
        : context.effectiveExitAt ??
          context.estimatedEndAt
    )

  const hour =
    getHourFractionInTimeZone(
      referenceDate,
      resolvePlannerTimeZone(
        context
      )
    )

  if (hour < 7) {
    return "early_morning"
  }

  if (hour < 11) {
    return "morning"
  }

  if (hour < 14) {
    return "midday"
  }

  if (hour < 17) {
    return "afternoon"
  }

  if (hour < 22) {
    return "evening"
  }

  return "late_night"
}

function daypartTokens(
  daypart: VibeDaypart
): string[] {
  if (
    daypart === "early_morning"
  ) {
    return [
      "early morning",
      "breakfast",
      "morning",
    ]
  }

  if (
    daypart === "morning"
  ) {
    return [
      "morning",
      "breakfast",
      "brunch",
    ]
  }

  if (
    daypart === "midday"
  ) {
    return [
      "midday",
      "lunch",
      "brunch",
      "daytime",
    ]
  }

  if (
    daypart === "afternoon"
  ) {
    return [
      "afternoon",
      "daytime",
      "lunch",
    ]
  }

  if (
    daypart === "evening"
  ) {
    return [
      "evening",
      "dinner",
      "night",
    ]
  }

  return [
    "late night",
    "after hours",
    "night",
  ]
}

// -----------------------------------------------------------------------------
// Normalization and matching
// -----------------------------------------------------------------------------

const ALL_DAYPARTS: VibeDaypart[] = [
  "early_morning",
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late_night",
]

function normalizePresetIdentifiers(
  values: string[]
): string[] {
  return uniqueStrings(
    values
      .map(
        (value) =>
          String(
            value
          )
            .trim()
            .toLowerCase()
            .replace(
              /[\s-]+/g,
              "_"
            )
      )
      .filter(Boolean)
      .map(
        (value) =>
          value === "high_energy"
            ? "high_energy"
            : value.replace(
                /_/g,
                " "
              )
      )
  )
}

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
              (
                entry
              ): entry is string | number =>
                typeof entry === "string" ||
                typeof entry === "number"
            )
            .map(
              (entry) =>
                String(
                  entry
                )
            )
        : undefined

  return uniqueStrings(
    normalizeFeatureValues(
      normalizedInput
    )
      .flatMap(
        (entry) => {
          const phrase =
            canonicalizeToken(
              entry
            )

          if (!phrase) {
            return []
          }

          const individualTokens =
            phrase
              .split(" ")
              .filter(
                (token) =>
                  token.length >= 3
              )

          return [
            phrase,
            ...individualTokens,
          ]
        }
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      )
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

  const source =
    uniqueStrings(
      sourceValues
        .map(
          canonicalizeToken
        )
        .filter(Boolean)
    )

  const targets =
    uniqueStrings(
      targetValues
        .map(
          canonicalizeToken
        )
        .filter(Boolean)
    )

  return uniqueStrings(
    targets.filter(
      (target) =>
        source.some(
          (sourceValue) =>
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
  if (
    source === target
  ) {
    return true
  }

  const sourceWords =
    source.split(" ")

  const targetWords =
    target.split(" ")

  if (
    sourceWords.length > 1 &&
    targetWords.length > 1
  ) {
    const targetSet =
      new Set(
        targetWords
      )

    const sharedWords =
      sourceWords.filter(
        (word) =>
          targetSet.has(
            word
          )
      )

    const minimumSharedWords =
      Math.min(
        sourceWords.length,
        targetWords.length
      )

    if (
      sharedWords.length >=
      minimumSharedWords
    ) {
      return true
    }
  }

  if (
    source.length >= 5 &&
    target.length >= 5
  ) {
    if (
      source.includes(
        target
      )
    ) {
      return true
    }

    if (
      target.includes(
        source
      )
    ) {
      return true
    }
  }

  return false
}

function canonicalizeToken(
  value: unknown
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[’']/g,
      ""
    )
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[_–—-]+/g,
      " "
    )
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
}

function calculateCappedMatchScore(
  matchCount: number,
  scorePerMatch: number,
  maximum: number
): number {
  return Math.min(
    matchCount *
      scorePerMatch,
    maximum
  )
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values.filter(
        Boolean
      )
    )
  )
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  )
}