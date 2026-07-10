// lib/outings/sequenceScoring/semanticFit.ts

import type {
  PlanningContext,
  PlanningSlot,
  StopRole,
  VenueRecord,
} from "../types"

import {
  getEventArchetypePlanningProfile,
} from "../eventArchetypes"

import {
  expandVibeTags,
} from "../vibePresets"

import {
  normalizeFeatureValues,
} from "../venueFeatures"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type SemanticFitConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type SemanticFitBreakdown = {
  roleFit: number
  archetypeTypeFit: number
  archetypeVibeFit: number
  requestedVibeFit: number
  slotPreferenceFit: number
  contextualTagFit: number
  contradictionPenalty: number
  semanticDataAdjustment: number
  energyRampAdjustment: number
}

export type SemanticFitEvidence = {
  normalizedTypes: string[]
  normalizedVibes: string[]
  normalizedTags: string[]
  normalizedTimeCategories: string[]
  normalizedEnergyRamp: string[]

  matchedRoleTypes: string[]
  matchedArchetypeTypes: string[]
  matchedArchetypeVibes: string[]
  matchedRequestedVibes: string[]
  matchedSlotPreferredTypes: string[]
  matchedEventTags: string[]

  discouragedTypeMatches: string[]
  stronglyDiscouragedTypeMatches: string[]
  conflictingVibeMatches: string[]
}

export type SemanticFitResult = {
  score: number
  confidence: SemanticFitConfidence
  confidenceScore: number

  hasMinimumSemanticEvidence: boolean
  semanticCompleteness: number

  matchedTypes: string[]
  matchedVibes: string[]
  matchedTags: string[]

  breakdown: SemanticFitBreakdown
  evidence: SemanticFitEvidence
}

export type ComputeSemanticFitInput = {
  venue: Pick<
    VenueRecord,
    | "type"
    | "vibe"
    | "tags"
    | "time_category"
    | "energy_ramp"
  >
  slot: PlanningSlot
  context: PlanningContext
}

// -----------------------------------------------------------------------------
// Scoring constants
// -----------------------------------------------------------------------------

const MAX_ROLE_FIT_SCORE = 28
const MAX_ARCHETYPE_TYPE_SCORE = 22
const MAX_ARCHETYPE_VIBE_SCORE = 24
const MAX_REQUESTED_VIBE_SCORE = 34
const MAX_SLOT_PREFERENCE_SCORE = 24
const MAX_CONTEXTUAL_TAG_SCORE = 16

/*
 * Energy ramp is intentionally capped at a negligible level.
 *
 * Your venue coverage is incomplete, so this field must not materially alter
 * ranking until the underlying data becomes reliable.
 */
const MAX_ENERGY_RAMP_ADJUSTMENT = 3

const ROLE_TYPE_FAMILIES: Record<StopRole, string[]> = {
  coffee: [
    "coffee",
    "coffee shop",
    "coffeehouse",
    "cafe",
    "café",
    "tea",
    "tea house",
    "matcha",
    "bakery",
    "breakfast",
    "juice",
  ],

  food: [
    "restaurant",
    "dinner",
    "lunch",
    "brunch",
    "breakfast",
    "food",
    "food hall",
    "casual food",
    "fine dining",
    "bistro",
    "eatery",
    "diner",
    "supper",
    "tasting",
  ],

  drink: [
    "bar",
    "cocktail",
    "cocktail bar",
    "wine bar",
    "lounge",
    "rooftop",
    "hotel bar",
    "speakeasy",
    "brewery",
    "pub",
    "beer garden",
    "sports bar",
    "dive bar",
    "club",
  ],

  activity: [
    "activity",
    "gallery",
    "museum",
    "bookstore",
    "library",
    "market",
    "park",
    "garden",
    "music",
    "showroom",
    "lifestyle",
    "fitness",
    "yoga",
    "pilates",
    "spa",
    "theater",
    "cinema",
    "bowling",
    "arcade",
  ],

  dessert: [
    "dessert",
    "bakery",
    "pastry",
    "ice cream",
    "gelato",
    "chocolate",
    "cafe",
    "café",
    "coffee",
    "tea",
  ],
}

const ROLE_TAG_FAMILIES: Record<StopRole, string[]> = {
  coffee: [
    "coffee",
    "espresso",
    "latte",
    "matcha",
    "tea",
    "pastry",
    "bakery",
    "breakfast",
    "morning",
    "coffeehouse",
  ],

  food: [
    "food",
    "meal",
    "dinner",
    "lunch",
    "brunch",
    "breakfast",
    "restaurant",
    "chef",
    "tasting",
    "supper",
    "menu",
    "culinary",
    "shareable",
  ],

  drink: [
    "drinks",
    "cocktail",
    "cocktails",
    "wine",
    "beer",
    "bar",
    "lounge",
    "nightcap",
    "mixology",
    "brewery",
    "pub",
    "happy hour",
  ],

  activity: [
    "art",
    "gallery",
    "museum",
    "culture",
    "creative",
    "exhibit",
    "installation",
    "books",
    "bookstore",
    "music",
    "performance",
    "outdoors",
    "garden",
    "park",
    "market",
    "fitness",
    "wellness",
  ],

  dessert: [
    "dessert",
    "sweet",
    "sweets",
    "pastry",
    "bakery",
    "ice cream",
    "gelato",
    "chocolate",
    "cake",
    "cookies",
  ],
}

const QUIET_VIBE_TOKENS = [
  "quiet",
  "calm",
  "chill",
  "relaxed",
  "peaceful",
  "intimate",
  "cozy",
  "low key",
  "laid back",
  "conversation",
  "soft",
  "tranquil",
  "serene",
]

const HIGH_ENERGY_VIBE_TOKENS = [
  "high energy",
  "energetic",
  "party",
  "lively",
  "loud",
  "rowdy",
  "buzzy",
  "crowded",
  "dancing",
  "dj",
  "nightlife",
  "wild",
]

const POLISHED_VIBE_TOKENS = [
  "upscale",
  "polished",
  "refined",
  "elegant",
  "sophisticated",
  "luxury",
  "stylish",
  "chic",
  "exclusive",
]

const CASUAL_VIBE_TOKENS = [
  "casual",
  "easygoing",
  "laid back",
  "neighborhood",
  "local",
  "approachable",
  "friendly",
  "unpretentious",
  "walk in",
]

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeSemanticFit({
  venue,
  slot,
  context,
}: ComputeSemanticFitInput): SemanticFitResult {
  const types = normalizeSemanticValues(venue.type)
  const vibes = normalizeSemanticValues(venue.vibe)
  const tags = normalizeSemanticValues(venue.tags)
  const timeCategories = normalizeSemanticValues(venue.time_category)
  const energyRamp = normalizeSemanticValues(venue.energy_ramp)

  const profile = getEventArchetypePlanningProfile(
    context.eventArchetype
  )

  const requestedVibeTokens = normalizeSemanticValues(
    expandVibeTags(context.vibeTags)
  )

  const eventTokens = normalizeSemanticValues(context.eventTags)

  const preferredArchetypeTypes = normalizeSemanticValues(
    slot.phase === "before"
      ? profile.preferredBeforeVenueTypes
      : profile.preferredAfterVenueTypes
  )

  const preferredArchetypeVibes = normalizeSemanticValues(
    profile.preferredVibes
  )

  const discouragedArchetypeTypes = normalizeSemanticValues(
    profile.discouragedVenueTypes
  )

  const slotPreferredTypes = normalizeSemanticValues(
    slot.vibePreferredTypes ??
      context.vibePlanning?.preferredTypes ??
      []
  )

  const slotRequiredTypes = normalizeSemanticValues(
    slot.vibeRequiredAnyTypes ??
      context.vibePlanning?.requiredAnyTypes ??
      []
  )

  const slotDiscouragedTypes = normalizeSemanticValues(
    slot.vibeDiscouragedTypes ??
      context.vibePlanning?.discouragedTypes ??
      []
  )

  const stronglyDiscouragedTypes = normalizeSemanticValues(
    context.vibePlanning?.stronglyDiscouragedTypes ?? []
  )

  const roleTypeTokens = normalizeSemanticValues(
    ROLE_TYPE_FAMILIES[slot.role]
  )

  const roleTagTokens = normalizeSemanticValues(
    ROLE_TAG_FAMILIES[slot.role]
  )

  const venueSemanticTokens = uniqueStrings([
    ...types,
    ...vibes,
    ...tags,
  ])

  const matchedRoleTypes = findMatches(types, roleTypeTokens)
  const matchedRoleTags = findMatches(
    uniqueStrings([...tags, ...vibes]),
    roleTagTokens
  )

  const matchedArchetypeTypes = findMatches(
    types,
    preferredArchetypeTypes
  )

  const matchedArchetypeVibes = findMatches(
    uniqueStrings([...vibes, ...tags]),
    preferredArchetypeVibes
  )

  const matchedRequestedVibes = findMatches(
    venueSemanticTokens,
    requestedVibeTokens
  )

  const matchedRequestedVibesFromVibeColumn = findMatches(
    vibes,
    requestedVibeTokens
  )

  const matchedRequestedVibesFromTags = findMatches(
    tags,
    requestedVibeTokens
  )

  const matchedSlotPreferredTypes = findMatches(
    types,
    slotPreferredTypes
  )

  const matchedRequiredTypes = findMatches(
    types,
    slotRequiredTypes
  )

  const matchedEventTags = findMeaningfulEventMatches(
    venueSemanticTokens,
    eventTokens
  )

  const discouragedArchetypeMatches = findMatches(
    types,
    discouragedArchetypeTypes
  )

  const discouragedSlotMatches = findMatches(
    types,
    slotDiscouragedTypes
  )

  const stronglyDiscouragedTypeMatches = findMatches(
    types,
    stronglyDiscouragedTypes
  )

  const discouragedTypeMatches = uniqueStrings([
    ...discouragedArchetypeMatches,
    ...discouragedSlotMatches,
  ])

  const conflictingVibeMatches = findContextualVibeConflicts({
    venueVibes: uniqueStrings([...vibes, ...tags]),
    requestedVibes: requestedVibeTokens,
  })

  const roleFit = computeRoleFitScore({
    matchedTypeCount: matchedRoleTypes.length,
    matchedTagCount: matchedRoleTags.length,
  })

  const archetypeTypeFit = cappedMatchScore(
    matchedArchetypeTypes.length,
    11,
    MAX_ARCHETYPE_TYPE_SCORE
  )

  const archetypeVibeFit = cappedMatchScore(
    matchedArchetypeVibes.length,
    8,
    MAX_ARCHETYPE_VIBE_SCORE
  )

  const requestedVibeFit = computeRequestedVibeScore({
    allMatches: matchedRequestedVibes,
    vibeColumnMatches: matchedRequestedVibesFromVibeColumn,
    tagMatches: matchedRequestedVibesFromTags,
  })

  const slotPreferenceFit = computeSlotPreferenceScore({
    preferredMatches: matchedSlotPreferredTypes,
    requiredMatches: matchedRequiredTypes,
    hasRequiredTypes: slotRequiredTypes.length > 0,
  })

  const contextualTagFit = cappedMatchScore(
    matchedEventTags.length,
    4,
    MAX_CONTEXTUAL_TAG_SCORE
  )

  const contradictionPenalty = computeContradictionPenalty({
    discouragedTypeMatches,
    stronglyDiscouragedTypeMatches,
    conflictingVibeMatches,
    hasRequiredTypes: slotRequiredTypes.length > 0,
    matchedRequiredTypes,
  })

  const semanticCompleteness = computeSemanticCompleteness({
    types,
    vibes,
    tags,
  })

  /*
   * Missing semantic fields should reduce confidence, not automatically make a
   * venue bad. The adjustment remains small enough that a venue with strong
   * evidence in one source can still compete.
   */
  const semanticDataAdjustment =
    semanticCompleteness >= 0.95
      ? 6
      : semanticCompleteness >= 0.65
        ? 3
        : semanticCompleteness >= 0.35
          ? 0
          : -5

  const energyRampAdjustment = computeEnergyRampAdjustment({
    energyRamp,
    requestedVibes: requestedVibeTokens,
    slot,
  })

  const breakdown: SemanticFitBreakdown = {
    roleFit,
    archetypeTypeFit,
    archetypeVibeFit,
    requestedVibeFit,
    slotPreferenceFit,
    contextualTagFit,
    contradictionPenalty,
    semanticDataAdjustment,
    energyRampAdjustment,
  }

  const rawScore =
    roleFit +
    archetypeTypeFit +
    archetypeVibeFit +
    requestedVibeFit +
    slotPreferenceFit +
    contextualTagFit +
    semanticDataAdjustment +
    energyRampAdjustment -
    contradictionPenalty

  const score = clamp(Math.round(rawScore), -80, 140)

  const positiveEvidenceCount =
    matchedRoleTypes.length +
    matchedRoleTags.length +
    matchedArchetypeTypes.length +
    matchedArchetypeVibes.length +
    matchedRequestedVibes.length +
    matchedSlotPreferredTypes.length +
    matchedEventTags.length

  const hasMinimumSemanticEvidence =
    venueSemanticTokens.length > 0 &&
    positiveEvidenceCount > 0

  const confidenceScore = computeSemanticConfidenceScore({
    semanticCompleteness,
    positiveEvidenceCount,
    contradictionCount:
      discouragedTypeMatches.length +
      stronglyDiscouragedTypeMatches.length +
      conflictingVibeMatches.length,
    hasRequestedVibes: requestedVibeTokens.length > 0,
    requestedVibeMatchCount: matchedRequestedVibes.length,
  })

  const confidence = resolveSemanticFitConfidence({
    confidenceScore,
    hasMinimumSemanticEvidence,
  })

  return {
    score,
    confidence,
    confidenceScore,
    hasMinimumSemanticEvidence,
    semanticCompleteness,
    matchedTypes: uniqueStrings([
      ...matchedRoleTypes,
      ...matchedArchetypeTypes,
      ...matchedSlotPreferredTypes,
      ...matchedRequiredTypes,
    ]),
    matchedVibes: uniqueStrings([
      ...matchedRequestedVibesFromVibeColumn,
      ...matchedArchetypeVibes,
    ]),
    matchedTags: uniqueStrings([
      ...matchedRequestedVibesFromTags,
      ...matchedEventTags,
      ...matchedRoleTags,
    ]),
    breakdown,
    evidence: {
      normalizedTypes: types,
      normalizedVibes: vibes,
      normalizedTags: tags,
      normalizedTimeCategories: timeCategories,
      normalizedEnergyRamp: energyRamp,
      matchedRoleTypes,
      matchedArchetypeTypes,
      matchedArchetypeVibes,
      matchedRequestedVibes,
      matchedSlotPreferredTypes,
      matchedEventTags,
      discouragedTypeMatches,
      stronglyDiscouragedTypeMatches,
      conflictingVibeMatches,
    },
  }
}

/**
 * Convenience wrapper for callers that only need a numeric score.
 */
export function scoreSemanticFit(
  venue: ComputeSemanticFitInput["venue"],
  slot: PlanningSlot,
  context: PlanningContext
): number {
  return computeSemanticFit({
    venue,
    slot,
    context,
  }).score
}

/**
 * Returns true only when semantic evidence is strong enough to support a
 * confident user-facing explanation.
 *
 * This should be used before displaying labels such as "gallery drinks",
 * "cultural warmup", or "low-key nightcap".
 */
export function hasConfidentSemanticFit(
  result: SemanticFitResult,
  minimumConfidence = 0.65
): boolean {
  return (
    result.hasMinimumSemanticEvidence &&
    result.confidenceScore >= minimumConfidence &&
    result.score > 0
  )
}

/**
 * Returns a conservative list of evidence that can safely be persisted for
 * debugging or later explanation generation.
 */
export function getSemanticFitMetadata(
  result: SemanticFitResult
): {
  semanticFitScore: number
  semanticFitConfidence: number
  semanticFitConfidenceLabel: SemanticFitConfidence
  semanticCompleteness: number
  semanticMatchedTypes: string[]
  semanticMatchedVibes: string[]
  semanticMatchedTags: string[]
  semanticBreakdown: SemanticFitBreakdown
} {
  return {
    semanticFitScore: result.score,
    semanticFitConfidence: result.confidenceScore,
    semanticFitConfidenceLabel: result.confidence,
    semanticCompleteness: result.semanticCompleteness,
    semanticMatchedTypes: result.matchedTypes,
    semanticMatchedVibes: result.matchedVibes,
    semanticMatchedTags: result.matchedTags,
    semanticBreakdown: result.breakdown,
  }
}

// -----------------------------------------------------------------------------
// Dimension scoring
// -----------------------------------------------------------------------------

function computeRoleFitScore({
  matchedTypeCount,
  matchedTagCount,
}: {
  matchedTypeCount: number
  matchedTagCount: number
}): number {
  const typeScore = Math.min(matchedTypeCount, 2) * 11
  const tagScore = Math.min(matchedTagCount, 2) * 4

  return Math.min(
    typeScore + tagScore,
    MAX_ROLE_FIT_SCORE
  )
}

function computeRequestedVibeScore({
  allMatches,
  vibeColumnMatches,
  tagMatches,
}: {
  allMatches: string[]
  vibeColumnMatches: string[]
  tagMatches: string[]
}): number {
  if (allMatches.length === 0) return 0

  /*
   * A match in the dedicated vibe column is stronger evidence than a generic
   * tag match. Type-only matches are permitted but receive the smallest value.
   */
  const vibeColumnScore =
    Math.min(vibeColumnMatches.length, 3) * 9

  const tagScore =
    Math.min(tagMatches.length, 3) * 5

  const remainingMatches = Math.max(
    allMatches.length -
      vibeColumnMatches.length -
      tagMatches.length,
    0
  )

  const remainingScore =
    Math.min(remainingMatches, 2) * 2

  return Math.min(
    vibeColumnScore + tagScore + remainingScore,
    MAX_REQUESTED_VIBE_SCORE
  )
}

function computeSlotPreferenceScore({
  preferredMatches,
  requiredMatches,
  hasRequiredTypes,
}: {
  preferredMatches: string[]
  requiredMatches: string[]
  hasRequiredTypes: boolean
}): number {
  const preferredScore =
    Math.min(preferredMatches.length, 2) * 7

  /*
   * Required type groups are treated as strong preferences here rather than
   * hard gates. Hard filtering previously removed viable venues before their
   * tags and vibes could be evaluated.
   */
  const requiredScore =
    hasRequiredTypes && requiredMatches.length > 0
      ? 10
      : 0

  return Math.min(
    preferredScore + requiredScore,
    MAX_SLOT_PREFERENCE_SCORE
  )
}

function computeContradictionPenalty({
  discouragedTypeMatches,
  stronglyDiscouragedTypeMatches,
  conflictingVibeMatches,
  hasRequiredTypes,
  matchedRequiredTypes,
}: {
  discouragedTypeMatches: string[]
  stronglyDiscouragedTypeMatches: string[]
  conflictingVibeMatches: string[]
  hasRequiredTypes: boolean
  matchedRequiredTypes: string[]
}): number {
  let penalty = 0

  penalty +=
    Math.min(discouragedTypeMatches.length, 2) * 10

  penalty +=
    Math.min(stronglyDiscouragedTypeMatches.length, 2) * 16

  penalty +=
    Math.min(conflictingVibeMatches.length, 2) * 9

  /*
   * Missing a required type is a ranking penalty, not an automatic rejection.
   * This preserves strong tag/vibe candidates that have imperfect type data.
   */
  if (
    hasRequiredTypes &&
    matchedRequiredTypes.length === 0
  ) {
    penalty += 12
  }

  return Math.min(penalty, 60)
}

function computeEnergyRampAdjustment({
  energyRamp,
  requestedVibes,
  slot,
}: {
  energyRamp: string[]
  requestedVibes: string[]
  slot: PlanningSlot
}): number {
  if (
    energyRamp.length === 0 ||
    requestedVibes.length === 0
  ) {
    return 0
  }

  const wantsHighEnergy = hasAnySemanticMatch(
    requestedVibes,
    HIGH_ENERGY_VIBE_TOKENS
  )

  const wantsLowEnergy = hasAnySemanticMatch(
    requestedVibes,
    QUIET_VIBE_TOKENS
  )

  const rampIsHigh = hasAnySemanticMatch(
    energyRamp,
    [
      "high",
      "high energy",
      "rising",
      "energetic",
      "party",
      "lively",
      "peak",
    ]
  )

  const rampIsLow = hasAnySemanticMatch(
    energyRamp,
    [
      "low",
      "low energy",
      "calm",
      "chill",
      "quiet",
      "relaxed",
      "soft",
    ]
  )

  let adjustment = 0

  if (wantsHighEnergy && rampIsHigh) adjustment += 2
  if (wantsLowEnergy && rampIsLow) adjustment += 2

  if (wantsHighEnergy && rampIsLow) adjustment -= 2
  if (wantsLowEnergy && rampIsHigh) adjustment -= 2

  /*
   * A later after-event slot can tolerate slightly more energy. This remains a
   * one-point signal because energy_ramp coverage is incomplete.
   */
  if (
    slot.phase === "after" &&
    slot.index > 0 &&
    wantsHighEnergy &&
    rampIsHigh
  ) {
    adjustment += 1
  }

  return clamp(
    adjustment,
    -MAX_ENERGY_RAMP_ADJUSTMENT,
    MAX_ENERGY_RAMP_ADJUSTMENT
  )
}

// -----------------------------------------------------------------------------
// Confidence and completeness
// -----------------------------------------------------------------------------

function computeSemanticCompleteness({
  types,
  vibes,
  tags,
}: {
  types: string[]
  vibes: string[]
  tags: string[]
}): number {
  let weightedCoverage = 0

  if (types.length > 0) weightedCoverage += 0.25
  if (vibes.length > 0) weightedCoverage += 0.4
  if (tags.length > 0) weightedCoverage += 0.35

  return Number(
    clamp(weightedCoverage, 0, 1).toFixed(2)
  )
}

function computeSemanticConfidenceScore({
  semanticCompleteness,
  positiveEvidenceCount,
  contradictionCount,
  hasRequestedVibes,
  requestedVibeMatchCount,
}: {
  semanticCompleteness: number
  positiveEvidenceCount: number
  contradictionCount: number
  hasRequestedVibes: boolean
  requestedVibeMatchCount: number
}): number {
  let confidence = semanticCompleteness * 0.55

  confidence +=
    Math.min(positiveEvidenceCount, 6) * 0.065

  if (
    hasRequestedVibes &&
    requestedVibeMatchCount > 0
  ) {
    confidence += 0.08
  }

  confidence -=
    Math.min(contradictionCount, 3) * 0.08

  return Number(
    clamp(confidence, 0, 0.99).toFixed(2)
  )
}

function resolveSemanticFitConfidence({
  confidenceScore,
  hasMinimumSemanticEvidence,
}: {
  confidenceScore: number
  hasMinimumSemanticEvidence: boolean
}): SemanticFitConfidence {
  if (!hasMinimumSemanticEvidence) {
    return "insufficient"
  }

  if (confidenceScore >= 0.78) return "high"
  if (confidenceScore >= 0.55) return "medium"
  return "low"
}

// -----------------------------------------------------------------------------
// Context conflict detection
// -----------------------------------------------------------------------------

function findContextualVibeConflicts({
  venueVibes,
  requestedVibes,
}: {
  venueVibes: string[]
  requestedVibes: string[]
}): string[] {
  const conflicts: string[] = []

  const wantsQuiet = hasAnySemanticMatch(
    requestedVibes,
    QUIET_VIBE_TOKENS
  )

  const wantsHighEnergy = hasAnySemanticMatch(
    requestedVibes,
    HIGH_ENERGY_VIBE_TOKENS
  )

  const wantsPolished = hasAnySemanticMatch(
    requestedVibes,
    POLISHED_VIBE_TOKENS
  )

  const wantsCasual = hasAnySemanticMatch(
    requestedVibes,
    CASUAL_VIBE_TOKENS
  )

  if (wantsQuiet) {
    conflicts.push(
      ...findMatches(
        venueVibes,
        HIGH_ENERGY_VIBE_TOKENS
      )
    )
  }

  if (wantsHighEnergy) {
    conflicts.push(
      ...findMatches(
        venueVibes,
        QUIET_VIBE_TOKENS
      )
    )
  }

  if (wantsPolished) {
    conflicts.push(
      ...findMatches(
        venueVibes,
        [
          "dive",
          "rowdy",
          "unpolished",
          "no frills",
          "rough",
        ]
      )
    )
  }

  if (wantsCasual) {
    conflicts.push(
      ...findMatches(
        venueVibes,
        [
          "formal",
          "exclusive",
          "white tablecloth",
          "dress code",
        ]
      )
    )
  }

  return uniqueStrings(conflicts)
}

// -----------------------------------------------------------------------------
// Event-token matching
// -----------------------------------------------------------------------------

function findMeaningfulEventMatches(
  venueTokens: string[],
  eventTokens: string[]
): string[] {
  const meaningfulEventTokens = eventTokens.filter(
    (token) => {
      if (token.length < 3) return false
      if (/^\d+$/.test(token)) return false
      return !EVENT_STOP_WORDS.has(token)
    }
  )

  return findMatches(
    venueTokens,
    meaningfulEventTokens
  ).slice(0, 4)
}

const EVENT_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "you",
  "our",
  "are",
  "was",
  "were",
  "will",
  "into",
  "about",
  "around",
  "event",
  "events",
  "atl",
  "atlanta",
  "vol",
  "volume",
  "present",
  "presents",
  "featuring",
  "feat",
  "live",
  "doors",
  "tickets",
  "ticket",
  "pm",
  "am",
])

// -----------------------------------------------------------------------------
// Token utilities
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

function expandCanonicalToken(
  token: string
): string[] {
  const values = [token]

  /*
   * Preserve the full phrase and add useful singular aliases without exploding
   * the token set into every individual word.
   */
  if (token.endsWith(" bars")) {
    values.push(token.slice(0, -1))
  }

  if (token.endsWith(" cafes")) {
    values.push(token.slice(0, -1))
  }

  if (token === "café") {
    values.push("cafe")
  }

  if (token === "cafe") {
    values.push("café")
  }

  if (token === "high energy") {
    values.push("energetic")
  }

  if (token === "low key") {
    values.push("chill")
  }

  if (token === "laid back") {
    values.push("relaxed")
  }

  return uniqueStrings(values)
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

function findMatches(
  source: string[],
  targets: string[]
): string[] {
  if (
    source.length === 0 ||
    targets.length === 0
  ) {
    return []
  }

  const normalizedSource =
    uniqueStrings(
      source.map(canonicalizeToken).filter(Boolean)
    )

  const normalizedTargets =
    uniqueStrings(
      targets.map(canonicalizeToken).filter(Boolean)
    )

  const matches: string[] = []

  for (const target of normalizedTargets) {
    if (
      normalizedSource.some((sourceValue) =>
        tokensAreEquivalent(sourceValue, target)
      )
    ) {
      matches.push(target)
    }
  }

  return uniqueStrings(matches)
}

function tokensAreEquivalent(
  source: string,
  target: string
): boolean {
  if (source === target) return true

  /*
   * Permit phrase containment only when both sides are sufficiently specific.
   * This prevents broad tokens such as "bar" from matching unrelated phrases
   * too aggressively.
   */
  if (
    source.length >= 5 &&
    target.length >= 5
  ) {
    if (source.includes(target)) return true
    if (target.includes(source)) return true
  }

  return false
}

function hasAnySemanticMatch(
  source: string[],
  targets: string[]
): boolean {
  return findMatches(source, targets).length > 0
}

function cappedMatchScore(
  matchCount: number,
  pointsPerMatch: number,
  maximum: number
): number {
  return Math.min(
    Math.max(matchCount, 0) * pointsPerMatch,
    maximum
  )
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