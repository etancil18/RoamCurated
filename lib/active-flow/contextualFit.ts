import {
  getEventArchetypePlanningProfile,
} from '@/lib/outings/eventArchetypes'

import type {
  ActiveFlowContextualFit,
  ActiveFlowEventSemantics,
  ActiveFlowSemanticRouteStop,
  ActiveFlowVenueSemantics,
} from '@/lib/active-flow/contextualIntelligence'

export type ActiveFlowContextualFitReason =
  | 'strong_semantic_alignment'
  | 'affirmative_semantic_conflict'
  | 'insufficient_semantic_evidence'

export type ActiveFlowContextualFitEvidence = {
  /**
   * Strong positive evidence.
   *
   * Vibes and tags are the primary contextual evidence domains.
   */
  alignedVibes: string[]
  alignedTags: string[]

  /**
   * Broad category evidence.
   *
   * Type overlap is diagnostic/supporting evidence only and cannot,
   * by itself, establish contextual compatibility.
   */
  alignedTypes: string[]

  /**
   * Explicit directional conflicts.
   *
   * These are intentionally limited to semantic vibe/tag evidence
   * supported by the event archetype planning profile.
   */
  conflictingVibes: string[]
  conflictingTags: string[]

  /**
   * Number of remaining canonical runtime stops that contain at least
   * one structured semantic signal.
   */
  routeSemanticStopCount: number

  /**
   * Whether the candidate event contributes any usable semantic
   * evidence of its own.
   *
   * This includes candidate venue semantics, event tags, or a known
   * non-"other" event archetype.
   */
  eventHasSemanticEvidence: boolean
}

export type ActiveFlowContextualFitResult = {
  fit: ActiveFlowContextualFit
  reason: ActiveFlowContextualFitReason
  evidence: ActiveFlowContextualFitEvidence
}

export type EvaluateActiveFlowContextualFitInput = {
  event: ActiveFlowEventSemantics

  /**
   * Canonical current + remaining executable runtime route.
   *
   * The caller owns runtime-route authority. This evaluator does not
   * reconstruct route ordering, progress, or historical stops.
   */
  remainingStops: ActiveFlowSemanticRouteStop[]
}

type SemanticProfile = {
  preferredVibes: string[]
  preferredTags: string[]
  discouragedVibes: string[]
  discouragedTags: string[]
}

function normalizeSemanticValue(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
}

function normalizeSemanticValues(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values?.length) {
    return []
  }

  return [
    ...new Set(
      values
        .map(normalizeSemanticValue)
        .filter(Boolean),
    ),
  ].sort()
}

function intersectSemanticValues(
  left: readonly string[],
  right: readonly string[],
): string[] {
  if (
    left.length === 0 ||
    right.length === 0
  ) {
    return []
  }

  const rightValues =
    new Set(right)

  return [
    ...new Set(
      left.filter(
        (value) =>
          rightValues.has(value),
      ),
    ),
  ].sort()
}

function unionSemanticValues(
  ...collections: Array<
    readonly string[] | null | undefined
  >
): string[] {
  return normalizeSemanticValues(
    collections.flatMap(
      (collection) =>
        collection ?? [],
    ),
  )
}

function hasVenueSemanticEvidence(
  venue: ActiveFlowVenueSemantics,
): boolean {
  return (
    venue.types.length > 0 ||
    venue.vibes.length > 0 ||
    venue.tags.length > 0 ||
    venue.timeCategories.length > 0
  )
}

/**
 * Only use an archetype when it represents affirmative semantic
 * information.
 *
 * "other" is deliberately treated as absence of archetype evidence.
 * The planner/storage normalizer may use "other" as a fallback, but
 * Active Flow contextual judgment must not manufacture meaning from
 * an unknown or missing archetype.
 */
function hasUsableEventArchetype(
  event: ActiveFlowEventSemantics,
): boolean {
  return (
    event.archetype != null &&
    event.archetype !== 'other'
  )
}

function getEventSemanticProfile(
  event: ActiveFlowEventSemantics,
): SemanticProfile | null {
  if (
    !hasUsableEventArchetype(
      event,
    )
  ) {
    return null
  }

  const profile =
    getEventArchetypePlanningProfile(
      event.archetype,
    )

  return {
    preferredVibes:
      normalizeSemanticValues(
        profile.preferredVibes,
      ),

    preferredTags:
      normalizeSemanticValues(
        profile.preferredTags,
      ),

    discouragedVibes:
      normalizeSemanticValues(
        profile.discouragedVibes,
      ),

    discouragedTags:
      normalizeSemanticValues(
        profile.discouragedTags,
      ),
  }
}

function collectRouteSemantics(
  remainingStops:
    ActiveFlowSemanticRouteStop[],
): {
  vibes: string[]
  tags: string[]
  types: string[]
  semanticStopCount: number
} {
  const vibes: string[] = []
  const tags: string[] = []
  const types: string[] = []

  let semanticStopCount = 0

  for (
    const stop of
    remainingStops
  ) {
    if (
      hasVenueSemanticEvidence(
        stop.venue,
      )
    ) {
      semanticStopCount += 1
    }

    vibes.push(
      ...stop.venue.vibes,
    )

    tags.push(
      ...stop.venue.tags,
    )

    types.push(
      ...stop.venue.types,
    )
  }

  return {
    vibes:
      normalizeSemanticValues(
        vibes,
      ),

    tags:
      normalizeSemanticValues(
        tags,
      ),

    types:
      normalizeSemanticValues(
        types,
      ),

    semanticStopCount,
  }
}

/**
 * Broad Active Flow contextual-fit policy.
 *
 * This evaluator answers only:
 *
 *   "Does this Community Event broadly belong in the experience
 *    represented by the remaining canonical Active Flow?"
 *
 * It deliberately does NOT answer:
 *
 * - whether the event is trusted
 * - whether the event is fresh
 * - whether the event is within 350m
 * - whether route cost is acceptable
 * - whether Detour is appropriate
 * - whether Swap is appropriate
 * - whether the event should replace a specific stop
 * - whether any route mutation should occur
 *
 * Those decisions belong to their existing authority boundaries.
 *
 * Policy:
 *
 * 1. Missing evidence is never a mismatch.
 * 2. Venue vibe/tag semantics are primary contextual evidence.
 * 3. Venue type is broad supporting evidence only.
 * 4. A known event archetype supplies the curated semantic vocabulary
 *    required for a decisive compatibility or incompatibility judgment.
 * 5. Arbitrary candidate/route semantic overlap remains diagnostic only
 *    and cannot independently establish compatibility.
 * 6. A single discouraged semantic dimension is negative evidence, not
 *    enough by itself to establish incompatibility.
 * 7. Incompatibility requires corroborated vibe + tag contradiction and
 *    no positive curated archetype alignment.
 * 8. Type difference alone can never establish incompatibility.
 * 9. "other" archetype contributes no semantic authority.
 * 10. energy_ramp is intentionally absent from this contract.
 *
 * The result is intentionally categorical rather than numeric.
 */
export function evaluateActiveFlowContextualFit({
  event,
  remainingStops,
}: EvaluateActiveFlowContextualFitInput): ActiveFlowContextualFitResult {
  const route =
    collectRouteSemantics(
      remainingStops,
    )

  const eventVenueVibes =
    normalizeSemanticValues(
      event.venue.vibes,
    )

  const eventVenueTags =
    normalizeSemanticValues(
      event.venue.tags,
    )

  const eventVenueTypes =
    normalizeSemanticValues(
      event.venue.types,
    )

  const eventTags =
    normalizeSemanticValues(
      event.tags,
    )

  const profile =
    getEventSemanticProfile(
      event,
    )

  /**
   * Candidate-side semantic vocabulary retained for diagnostic
   * alignment evidence.
   *
   * Direct candidate venue/event semantics may describe meaningful
   * similarity to the remaining route, but only curated archetype
   * vocabulary has authority to make a decisive contextual judgment.
   */
  const positiveVibes =
    unionSemanticValues(
      eventVenueVibes,
      profile?.preferredVibes,
    )

  const positiveTags =
    unionSemanticValues(
      eventVenueTags,
      eventTags,
      profile?.preferredTags,
    )

  /**
   * Direct same-domain alignment.
   */
  const directVibeAlignment =
    intersectSemanticValues(
      route.vibes,
      positiveVibes,
    )

  const directTagAlignment =
    intersectSemanticValues(
      route.tags,
      positiveTags,
    )

  /**
   * Cross-field vibe/tag alignment.
   *
   * Roam's existing semantic model treats vibe and tags as the
   * strongest contextual evidence domains, and real venue data may
   * store the same semantic concept in either field.
   */
  const routeVibeToEventTagAlignment =
    intersectSemanticValues(
      route.vibes,
      positiveTags,
    )

  const routeTagToEventVibeAlignment =
    intersectSemanticValues(
      route.tags,
      positiveVibes,
    )

  const alignedVibes =
    unionSemanticValues(
      directVibeAlignment,
      routeTagToEventVibeAlignment,
    )

  const alignedTags =
    unionSemanticValues(
      directTagAlignment,
      routeVibeToEventTagAlignment,
    )

  /**
   * Type alignment is retained only as diagnostic/supporting evidence.
   *
   * It must never independently establish compatibility because venue
   * category is not equivalent to experiential coherence.
   */
  const alignedTypes =
    intersectSemanticValues(
      route.types,
      eventVenueTypes,
    )

  /**
   * Curated positive semantic authority.
   *
   * Arbitrary candidate venue/event overlap is intentionally excluded
   * from this decisive signal. Compatibility requires the remaining
   * route to align with preferred semantic vocabulary supplied by a
   * known event archetype.
   *
   * Cross-field matching is retained because the same curated semantic
   * concept may legitimately be stored in venue.vibe or venue.tags.
   */
  const preferredVibeAlignment =
    profile
      ? unionSemanticValues(
          intersectSemanticValues(
            route.vibes,
            profile.preferredVibes,
          ),
          intersectSemanticValues(
            route.tags,
            profile.preferredVibes,
          ),
        )
      : []

  const preferredTagAlignment =
    profile
      ? unionSemanticValues(
          intersectSemanticValues(
            route.tags,
            profile.preferredTags,
          ),
          intersectSemanticValues(
            route.vibes,
            profile.preferredTags,
          ),
        )
      : []

  const hasCuratedPositiveAlignment =
    (
      preferredVibeAlignment.length > 0 ||
      preferredTagAlignment.length > 0
    )

  /**
   * Directional conflict evidence.
   *
   * We only use explicit discouraged vibe/tag vocabulary from the
   * candidate event's known archetype profile.
   *
   * We deliberately do NOT:
   *
   * - infer conflict from different venue types
   * - invert preferred-before/preferred-after relationships
   * - use discouraged venue types as a broad Flow rejection rule
   * - invent conflict from missing data
   */
  const conflictingVibes =
    profile
      ? intersectSemanticValues(
          route.vibes,
          profile.discouragedVibes,
        )
      : []

  const conflictingTags =
    profile
      ? intersectSemanticValues(
          route.tags,
          profile.discouragedTags,
        )
      : []

  const eventHasSemanticEvidence =
    (
      eventVenueVibes.length > 0 ||
      eventVenueTags.length > 0 ||
      eventVenueTypes.length > 0 ||
      eventTags.length > 0 ||
      hasUsableEventArchetype(
        event,
      )
    )

  const evidence:
    ActiveFlowContextualFitEvidence = {
      alignedVibes,
      alignedTags,
      alignedTypes,

      conflictingVibes,
      conflictingTags,

      routeSemanticStopCount:
        route.semanticStopCount,

      eventHasSemanticEvidence,
    }

  /**
   * Incompatibility requires corroborated contradiction across both
   * primary semantic evidence dimensions and no meaningful curated
   * positive alignment.
   *
   * A discouraged vibe alone or discouraged tag alone remains negative
   * evidence, but does not justify suppressing an Active Flow
   * opportunity.
   *
   * Mixed positive/negative evidence is intentionally treated as
   * uncertain rather than allowing negative evidence to automatically
   * outrank positive semantic support.
   */
  const hasCorroboratedSemanticConflict =
    (
      conflictingVibes.length > 0 &&
      conflictingTags.length > 0
    )

  if (
    hasCorroboratedSemanticConflict &&
    !hasCuratedPositiveAlignment
  ) {
    return {
      fit:
        'incompatible',

      reason:
        'affirmative_semantic_conflict',

      evidence,
    }
  }

  /**
   * Compatibility requires affirmative alignment with curated
   * archetype semantic vocabulary.
   *
   * Arbitrary event/venue tag equality, arbitrary vibe equality, and
   * type-only overlap remain diagnostic evidence and cannot
   * independently manufacture a strong contextual judgment.
   */
  if (
    hasCuratedPositiveAlignment &&
    !hasCorroboratedSemanticConflict
  ) {
    return {
      fit:
        'compatible',

      reason:
        'strong_semantic_alignment',

      evidence,
    }
  }

  /**
   * Everything else remains uncertain.
   *
   * This includes:
   *
   * - missing route semantics
   * - missing event semantics
   * - no usable event archetype
   * - arbitrary candidate/route semantic overlap without curated
   *   archetype alignment
   * - type-only overlap
   * - different types without an explicit conflict
   * - a single discouraged semantic dimension
   * - mixed positive and corroborated negative evidence
   * - a known archetype with no meaningful route relationship
   *
   * Per the frozen 022B contract:
   *
   *   missing evidence != mismatch
   */
  return {
    fit:
      'insufficient_context',

    reason:
      'insufficient_semantic_evidence',

    evidence,
  }
}