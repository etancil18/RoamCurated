// lib/outings/sequenceScoring/groupFit.ts

import type {
  PlanningContext,
  PlanningSlot,
  VenueRecord,
} from "../types"

import {
  getGroupSizePreset,
} from "../groupSizePresets"

import {
  normalizeVenueTypes,
} from "./helpers"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type GroupFitResult = {
  score: number
  confidenceScore: number

  isWeakFit: boolean
  isHardConflict: boolean

  matchedPreferredTypes: string[]
  matchedDiscouragedTypes: string[]

  reasons: string[]
}

export type ComputeGroupFitInput = {
  venue: Pick<
    VenueRecord,
    "type" | "tags" | "vibe"
  >
  context: PlanningContext
  slot: PlanningSlot
}

// -----------------------------------------------------------------------------
// Score policy
// -----------------------------------------------------------------------------

const MIN_GROUP_FIT_SCORE = -30
const MAX_GROUP_FIT_SCORE = 24

const PREFERRED_TYPE_SCORE = 9
const ADDITIONAL_PREFERRED_TYPE_SCORE = 4

const DISCOURAGED_TYPE_PENALTY = 10
const ADDITIONAL_DISCOURAGED_TYPE_PENALTY = 5

const WEAK_FIT_THRESHOLD = -8

const MEDIUM_GROUP_MINIMUM_SIZE = 5
const LARGE_GROUP_MINIMUM_SIZE = 9

const MEDIUM_GROUP_MISSING_POSITIVE_EVIDENCE_PENALTY = 4
const LARGE_GROUP_MISSING_POSITIVE_EVIDENCE_PENALTY = 9

/*
 * Group-size hard conflicts must remain deliberately conservative.
 *
 * Roam currently has semantic venue metadata, not verified seating-capacity
 * data. A venue therefore becomes a hard group conflict only when:
 *
 * - the user selected a genuinely large group;
 * - the venue has no preferred group-size evidence;
 * - multiple distinct discouraged signals are present;
 * - at least one discouraged signal comes from the venue's explicit type;
 * - metadata confidence is sufficiently strong.
 *
 * Medium groups and smaller groups remain score-driven rather than hard-gated.
 */
const LARGE_GROUP_HARD_CONFLICT_MINIMUM_SIZE = 9
const HARD_CONFLICT_MINIMUM_DISCOURAGED_MATCHES = 2
const HARD_CONFLICT_MINIMUM_CONFIDENCE = 0.7

/*
 * Fitness-style venues are a separate group-feasibility case.
 *
 * They may remain viable for solo or duo outings, but should not be treated as
 * spontaneous group outing stops once the party reaches three people.
 */
const FITNESS_GROUP_HARD_CONFLICT_MINIMUM_SIZE = 3

const FITNESS_GROUP_HARD_CONFLICT_TYPES = [
  "fitness",
  "gym",
  "yoga",
  "pilates",
]

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function computeGroupFit({
  venue,
  context,
  slot,
}: ComputeGroupFitInput): GroupFitResult {
  /*
   * Slot is intentionally part of the canonical contract even though the first
   * operational group-fit initiative does not change behavior by slot.
   *
   * This keeps group fit compatible with the other slot-aware scoring modules
   * without prematurely coupling group size to route composition.
   */
  void slot

  const groupSize = context.groupSize

  if (
    groupSize == null ||
    !Number.isFinite(groupSize)
  ) {
    return neutralGroupFit()
  }

  const preset = getGroupSizePreset(groupSize)

  if (!preset) {
    return neutralGroupFit()
  }

  const typeTokens = normalizeTypeEvidence(
    venue.type
  )

  const tagTokens = normalizeMetadataEvidence(
    venue.tags
  )

  const vibeTokens = normalizeMetadataEvidence(
    venue.vibe
  )

  const allEvidence = uniqueStrings([
    ...typeTokens,
    ...tagTokens,
    ...vibeTokens,
  ])

  const hasFitnessGroupHardConflict =
    groupSize >=
      FITNESS_GROUP_HARD_CONFLICT_MINIMUM_SIZE &&
    FITNESS_GROUP_HARD_CONFLICT_TYPES.some(
      (type) =>
        allEvidence.includes(type)
    )

  const preferredTypes = uniqueStrings(
    preset.preferredTypes.map(normalizeToken)
  )

  const discouragedTypes = uniqueStrings(
    preset.discouragedTypes.map(normalizeToken)
  )

  const matchedPreferredTypes =
    preferredTypes.filter((type) =>
      allEvidence.includes(type)
    )

  const matchedDiscouragedTypes =
    discouragedTypes.filter((type) =>
      allEvidence.includes(type)
    )

  const typeLevelDiscouragedMatches =
    matchedDiscouragedTypes.filter((type) =>
      typeTokens.includes(type)
    )

  const confidenceScore =
    computeGroupFitConfidence({
      hasTypeData: typeTokens.length > 0,
      hasTagData: tagTokens.length > 0,
      hasVibeData: vibeTokens.length > 0,
      hasGroupSignal:
        matchedPreferredTypes.length > 0 ||
        matchedDiscouragedTypes.length > 0,
    })

  let score = 0
  const reasons: string[] = []

  if (matchedPreferredTypes.length > 0) {
    score += PREFERRED_TYPE_SCORE

    if (matchedPreferredTypes.length > 1) {
      score += Math.min(
        (
          matchedPreferredTypes.length - 1
        ) * ADDITIONAL_PREFERRED_TYPE_SCORE,
        12
      )
    }

    for (const type of matchedPreferredTypes) {
      reasons.push(
        `preferred_group_type:${type}`
      )
    }
  }

  if (matchedDiscouragedTypes.length > 0) {
    score -= DISCOURAGED_TYPE_PENALTY

    if (matchedDiscouragedTypes.length > 1) {
      score -= Math.min(
        (
          matchedDiscouragedTypes.length - 1
        ) * ADDITIONAL_DISCOURAGED_TYPE_PENALTY,
        15
      )
    }

    for (const type of matchedDiscouragedTypes) {
      reasons.push(
        `discouraged_group_type:${type}`
      )
    }
  }

  const hasPreferredEvidence =
    matchedPreferredTypes.length > 0

  if (!hasPreferredEvidence) {
    if (groupSize >= LARGE_GROUP_MINIMUM_SIZE) {
      score -=
        LARGE_GROUP_MISSING_POSITIVE_EVIDENCE_PENALTY

      reasons.push(
        "large_group_missing_positive_fit_evidence"
      )
    } else if (
      groupSize >= MEDIUM_GROUP_MINIMUM_SIZE
    ) {
      score -=
        MEDIUM_GROUP_MISSING_POSITIVE_EVIDENCE_PENALTY

      reasons.push(
        "medium_group_missing_positive_fit_evidence"
      )
    }
  }

  /*
   * Mixed evidence should remain mixed.
   *
   * A venue that carries both preferred and discouraged group-size signals is
   * not automatically classified as unsuitable. Its final score reflects the
   * competing evidence and lets the wider candidate scorer decide.
   */
  const hasMultipleDiscouragedSignals =
    matchedDiscouragedTypes.length >=
    HARD_CONFLICT_MINIMUM_DISCOURAGED_MATCHES

  const hasExplicitTypeConflict =
    typeLevelDiscouragedMatches.length > 0

  const hasLargeGroupStrongVenueMismatch =
    groupSize >=
      LARGE_GROUP_HARD_CONFLICT_MINIMUM_SIZE &&
    !hasPreferredEvidence &&
    hasMultipleDiscouragedSignals &&
    hasExplicitTypeConflict &&
    confidenceScore >=
      HARD_CONFLICT_MINIMUM_CONFIDENCE

  const isHardConflict =
    hasFitnessGroupHardConflict ||
    hasLargeGroupStrongVenueMismatch

  if (hasFitnessGroupHardConflict) {
    reasons.push(
      "group_fitness_venue_hard_conflict"
    )
  }

  if (hasLargeGroupStrongVenueMismatch) {
    reasons.push(
      "large_group_strong_venue_mismatch"
    )
  }

  const normalizedScore = clamp(
    score,
    MIN_GROUP_FIT_SCORE,
    MAX_GROUP_FIT_SCORE
  )

  const isWeakFit =
    !isHardConflict &&
    normalizedScore <= WEAK_FIT_THRESHOLD

  if (
    isWeakFit &&
    matchedDiscouragedTypes.length > 0
  ) {
    reasons.push("weak_group_fit")
  }

  return {
    score: normalizedScore,
    confidenceScore,

    isWeakFit,
    isHardConflict,

    matchedPreferredTypes,
    matchedDiscouragedTypes,

    reasons: uniqueStrings(reasons),
  }
}

// -----------------------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------------------

function computeGroupFitConfidence({
  hasTypeData,
  hasTagData,
  hasVibeData,
  hasGroupSignal,
}: {
  hasTypeData: boolean
  hasTagData: boolean
  hasVibeData: boolean
  hasGroupSignal: boolean
}): number {
  /*
   * Group suitability can be estimated from semantic venue data, but it should
   * never receive capacity-level certainty because verified seating/capacity is
   * not part of the current evidence model.
   */
  let confidence = 0.2

  if (hasTypeData) {
    confidence += 0.25
  }

  if (hasTagData) {
    confidence += 0.15
  }

  if (hasVibeData) {
    confidence += 0.15
  }

  if (hasGroupSignal) {
    confidence += 0.1
  }

  return Number(
    clamp(
      confidence,
      0,
      0.85
    ).toFixed(2)
  )
}

// -----------------------------------------------------------------------------
// Venue evidence normalization
// -----------------------------------------------------------------------------

function normalizeTypeEvidence(
  value: VenueRecord["type"]
): string[] {
  return uniqueStrings(
    normalizeVenueTypes(value)
      .map(normalizeToken)
      .filter(Boolean)
  )
}

function normalizeMetadataEvidence(
  value: VenueRecord["tags"] | VenueRecord["vibe"]
): string[] {
  if (value == null) {
    return []
  }

  if (Array.isArray(value)) {
    return uniqueStrings(
      value.flatMap((entry) =>
        normalizeMetadataEntry(
          String(entry)
        )
      )
    )
  }

  return uniqueStrings(
    normalizeMetadataEntry(
      String(value)
    )
  )
}

function normalizeMetadataEntry(
  value: string
): string[] {
  const raw = String(value)
    .trim()
    .toLowerCase()

  if (!raw) {
    return []
  }

  /*
   * Preserve the complete value so multi-word evidence such as "sports bar"
   * or "wine bar" remains matchable.
   *
   * Also split common list delimiters because historical metadata may arrive
   * either as arrays or serialized strings.
   */
  const values = [
    raw,
    ...raw.split(
      /[,|;/]+/
    ),
  ]

  return uniqueStrings(
    values
      .map(normalizeToken)
      .filter(Boolean)
  )
}

function normalizeToken(
  value: string
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
}

// -----------------------------------------------------------------------------
// Neutral result
// -----------------------------------------------------------------------------

function neutralGroupFit(): GroupFitResult {
  return {
    score: 0,
    confidenceScore: 0,

    isWeakFit: false,
    isHardConflict: false,

    matchedPreferredTypes: [],
    matchedDiscouragedTypes: [],

    reasons: [],
  }
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(values)
  )
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  )
}