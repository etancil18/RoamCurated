// lib/outings/planningIntent.ts

import type {
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  StopRole,
  VenueRecord,
  VibeDaypart,
} from "./types"

import {
  getEventArchetypePlanningProfile,
  getSemanticRoleForSlot,
} from "./eventArchetypes"

import {
  getDiscouragedTypesForVibeDaypart,
  getPreferredTypesForVibeDaypart,
  getPreferredTypesForVibeRole,
  resolveVibePresetProfile,
  type ResolvedVibePresetProfile,
  type VibePresetId,
} from "./vibePresets"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./sequenceScoring/time"

import {
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
} from "./sequenceScoring/helpers"

// -----------------------------------------------------------------------------
// Intent Model
// -----------------------------------------------------------------------------

export type PlanningIntentWeights = {
  preferredVibeMatch: number
  preferredTagMatch: number
  eventContextMatch: number
  archetypeVibeMatch: number

  roleTypeMatch: number
  daypartTypeMatch: number
  preferredTypeMatch: number
  requiredTypeMatch: number
  requiredTypeMiss: number

  discouragedVibeMatch: number
  discouragedTagMatch: number
  discouragedTypeMatch: number
  stronglyDiscouragedTypeMatch: number
  contextualExclusionMatch: number
}

export type PlanningSlotIntent = {
  slotIndex: number
  role: StopRole
  phase: SlotPhase
  semanticRole: string | null
  daypart: VibeDaypart
  targetArrivalAt: Date
  targetDepartureAt: Date

  /**
   * Semantic signals should carry the most weight.
   * They are sourced from venue.vibe and venue.tags.
   */
  preferredVibes: string[]
  preferredTags: string[]
  discouragedVibes: string[]
  discouragedTags: string[]

  /**
   * Type remains useful for role compatibility and broad category control,
   * but it should not independently define whether a venue feels right.
   */
  rolePreferredTypes: string[]
  daypartPreferredTypes: string[]
  archetypePreferredTypes: string[]
  preferredTypes: string[]
  requiredAnyTypes: string[]

  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]

  /**
   * Contextual exclusions are combinations that are usually inappropriate
   * for this exact slot, such as a park during an evening nightlife sequence.
   *
   * These are not unconditional database-level exclusions. Downstream
   * selection should reject them only when the venue has no strong semantic
   * evidence supporting the requested experience.
   */
  contextualExclusionTypes: string[]

  /**
   * Event tokens are supporting context, not hard requirements.
   */
  eventContextTokens: string[]
  requestedVibeTokens: string[]
}

export type PlanningIntent = {
  mode: PlanningContext["mode"]
  timeZone: string
  eventArchetype: string
  eventContextTokens: string[]

  requestedVibePresetIds: VibePresetId[]
  requestedVibeTokens: string[]

  slots: PlanningSlotIntent[]
  weights: PlanningIntentWeights
}

export type VenueIntentScoreBreakdown = {
  preferredVibe: number
  preferredTag: number
  eventContext: number
  archetypeVibe: number

  roleType: number
  daypartType: number
  preferredType: number
  requiredType: number

  discouragedVibe: number
  discouragedTag: number
  discouragedType: number
  stronglyDiscouragedType: number
  contextualExclusion: number

  total: number

  matchedPreferredVibes: string[]
  matchedPreferredTags: string[]
  matchedEventContextTokens: string[]
  matchedArchetypeVibes: string[]

  matchedRoleTypes: string[]
  matchedDaypartTypes: string[]
  matchedPreferredTypes: string[]
  matchedRequiredTypes: string[]

  matchedDiscouragedVibes: string[]
  matchedDiscouragedTags: string[]
  matchedDiscouragedTypes: string[]
  matchedStronglyDiscouragedTypes: string[]
  matchedContextualExclusionTypes: string[]

  semanticPositiveMatchCount: number
  semanticNegativeMatchCount: number
  typePositiveMatchCount: number
  typeNegativeMatchCount: number

  semanticConfidence: number
}

export type VenueIntentEvaluation = {
  score: number
  semanticConfidence: number
  hasPositiveSemanticEvidence: boolean
  hasStrongSemanticEvidence: boolean
  hasContextualConflict: boolean
  shouldReject: boolean
  breakdown: VenueIntentScoreBreakdown
}

// -----------------------------------------------------------------------------
// Default Weighting
// -----------------------------------------------------------------------------

export const DEFAULT_PLANNING_INTENT_WEIGHTS: PlanningIntentWeights = {
  preferredVibeMatch: 14,
  preferredTagMatch: 11,
  eventContextMatch: 4,
  archetypeVibeMatch: 8,

  roleTypeMatch: 8,
  daypartTypeMatch: 7,
  preferredTypeMatch: 5,
  requiredTypeMatch: 5,
  requiredTypeMiss: -6,

  discouragedVibeMatch: -16,
  discouragedTagMatch: -12,
  discouragedTypeMatch: -10,
  stronglyDiscouragedTypeMatch: -24,
  contextualExclusionMatch: -30,
}

// -----------------------------------------------------------------------------
// Public Intent Builders
// -----------------------------------------------------------------------------

export function buildPlanningIntent(
  context: PlanningContext,
  weights: PlanningIntentWeights = DEFAULT_PLANNING_INTENT_WEIGHTS
): PlanningIntent {
  const timeZone = resolvePlannerTimeZone(context)
  const vibeProfile = resolveVibePresetProfile(context.vibeTags)
  const eventProfile = getEventArchetypePlanningProfile(
    context.eventArchetype
  )

  const eventContextTokens = uniqueStrings([
    ...normalizeSemanticValues(context.eventTags),
    ...normalizeSemanticValues(eventProfile.preferredVibes),
    normalizeSemanticValue(context.eventArchetype),
    normalizeSemanticValue(eventProfile.label),
  ])

  const slots = getPlanningSlots(context).map((slot) =>
    buildPlanningSlotIntent({
      slot,
      context,
      timeZone,
      vibeProfile,
      eventContextTokens,
    })
  )

  return {
    mode: context.mode,
    timeZone,
    eventArchetype: context.eventArchetype,
    eventContextTokens,
    requestedVibePresetIds: vibeProfile.presetIds,
    requestedVibeTokens: vibeProfile.expandedTokens,
    slots,
    weights,
  }
}

export function buildPlanningSlotIntent({
  slot,
  context,
  timeZone = resolvePlannerTimeZone(context),
  vibeProfile = resolveVibePresetProfile(context.vibeTags),
  eventContextTokens,
}: {
  slot: PlanningSlot
  context: PlanningContext
  timeZone?: string
  vibeProfile?: ResolvedVibePresetProfile
  eventContextTokens?: string[]
}): PlanningSlotIntent {
  const eventProfile = getEventArchetypePlanningProfile(
    context.eventArchetype
  )

  const daypart = resolveIntentDaypart(slot.targetArrivalAt, timeZone)

  const archetypePreferredTypes =
    slot.phase === "before"
      ? eventProfile.preferredBeforeVenueTypes
      : eventProfile.preferredAfterVenueTypes

  const rolePreferredTypes = getPreferredTypesForVibeRole({
    vibePresetId: context.vibeTags,
    mode: context.mode,
    role: slot.role,
  })

  const daypartPreferredTypes = getPreferredTypesForVibeDaypart(
    context.vibeTags,
    daypart
  )

  const daypartDiscouragedTypes = getDiscouragedTypesForVibeDaypart(
    context.vibeTags,
    daypart
  )

  const slotPreferredTypes = normalizeSemanticValues(
    slot.vibePreferredTypes ?? []
  )

  const slotRequiredTypes = normalizeSemanticValues(
    slot.vibeRequiredAnyTypes ?? []
  )

  const slotDiscouragedTypes = normalizeSemanticValues(
    slot.vibeDiscouragedTypes ?? []
  )

  const preferredTypes = uniqueStrings([
    ...normalizeSemanticValues(rolePreferredTypes),
    ...normalizeSemanticValues(daypartPreferredTypes),
    ...normalizeSemanticValues(archetypePreferredTypes),
    ...slotPreferredTypes,
    ...normalizeSemanticValues(vibeProfile.preferredTypes),
  ])

  const requiredAnyTypes = uniqueStrings([
    ...slotRequiredTypes,
    ...normalizeSemanticValues(vibeProfile.requiredAnyTypes),
  ])

  const discouragedTypes = uniqueStrings([
    ...normalizeSemanticValues(eventProfile.discouragedVenueTypes),
    ...normalizeSemanticValues(vibeProfile.discouragedTypes),
    ...slotDiscouragedTypes,
    ...normalizeSemanticValues(daypartDiscouragedTypes),
  ])

  const stronglyDiscouragedTypes = uniqueStrings([
    ...normalizeSemanticValues(vibeProfile.stronglyDiscouragedTypes),
  ])

  const contextualExclusionTypes = resolveContextualExclusionTypes({
    context,
    slot,
    daypart,
    daypartDiscouragedTypes,
    stronglyDiscouragedTypes,
  })

  const resolvedEventContextTokens =
    eventContextTokens ??
    uniqueStrings([
      ...normalizeSemanticValues(context.eventTags),
      ...normalizeSemanticValues(eventProfile.preferredVibes),
      normalizeSemanticValue(context.eventArchetype),
      normalizeSemanticValue(eventProfile.label),
    ])

  return {
    slotIndex: slot.index,
    role: slot.role,
    phase: slot.phase,
    semanticRole:
      slot.semanticRole ??
      getSemanticRoleForSlot({
        archetype: context.eventArchetype,
        phase: slot.phase,
        index: slot.index,
      }),
    daypart,
    targetArrivalAt: slot.targetArrivalAt,
    targetDepartureAt: slot.targetDepartureAt,

    preferredVibes: uniqueStrings([
      ...normalizeSemanticValues(vibeProfile.preferredVibes),
      ...normalizeSemanticValues(eventProfile.preferredVibes),
    ]),
    preferredTags: uniqueStrings([
      ...normalizeSemanticValues(vibeProfile.preferredTags),
    ]),
    discouragedVibes: uniqueStrings([
      ...normalizeSemanticValues(vibeProfile.discouragedVibes),
    ]),
    discouragedTags: uniqueStrings([
      ...normalizeSemanticValues(vibeProfile.discouragedTags),
    ]),

    rolePreferredTypes: normalizeSemanticValues(rolePreferredTypes),
    daypartPreferredTypes: normalizeSemanticValues(
      daypartPreferredTypes
    ),
    archetypePreferredTypes: normalizeSemanticValues(
      archetypePreferredTypes
    ),
    preferredTypes,
    requiredAnyTypes,

    discouragedTypes,
    stronglyDiscouragedTypes,
    contextualExclusionTypes,

    eventContextTokens: resolvedEventContextTokens,
    requestedVibeTokens: vibeProfile.expandedTokens,
  }
}

export function getPlanningIntentForSlot(
  intent: PlanningIntent,
  slotIndex: number
): PlanningSlotIntent | null {
  return (
    intent.slots.find((slot) => slot.slotIndex === slotIndex) ??
    intent.slots[slotIndex] ??
    null
  )
}

// -----------------------------------------------------------------------------
// Venue Evaluation
// -----------------------------------------------------------------------------

export function evaluateVenueAgainstPlanningIntent(
  venue: Pick<VenueRecord, "type" | "tags" | "vibe">,
  slotIntent: PlanningSlotIntent,
  weights: PlanningIntentWeights = DEFAULT_PLANNING_INTENT_WEIGHTS
): VenueIntentEvaluation {
  const venueTypes = normalizeSemanticValues(
    normalizeVenueTypes(venue.type)
  )

  const venueTags = normalizeSemanticValues(
    normalizeStringArray(venue.tags)
  )

  const venueVibes = normalizeSemanticValues(
    normalizeStringArray(venue.vibe)
  )

  const allSemanticSignals = uniqueStrings([
    ...venueVibes,
    ...venueTags,
  ])

  const allVenueSignals = uniqueStrings([
    ...venueTypes,
    ...venueVibes,
    ...venueTags,
  ])

  const matchedPreferredVibes = intersectSignals(
    venueVibes,
    slotIntent.preferredVibes
  )

  const matchedPreferredTags = intersectSignals(
    venueTags,
    slotIntent.preferredTags
  )

  const matchedEventContextTokens = intersectSignals(
    allSemanticSignals,
    slotIntent.eventContextTokens
  )

  const matchedArchetypeVibes = intersectSignals(
    allSemanticSignals,
    slotIntent.preferredVibes.filter((value) =>
      slotIntent.eventContextTokens.includes(value)
    )
  )

  const matchedRoleTypes = intersectSignals(
    venueTypes,
    slotIntent.rolePreferredTypes
  )

  const matchedDaypartTypes = intersectSignals(
    venueTypes,
    slotIntent.daypartPreferredTypes
  )

  const matchedPreferredTypes = intersectSignals(
    venueTypes,
    slotIntent.preferredTypes
  )

  const matchedRequiredTypes = intersectSignals(
    venueTypes,
    slotIntent.requiredAnyTypes
  )

  const matchedDiscouragedVibes = intersectSignals(
    venueVibes,
    slotIntent.discouragedVibes
  )

  const matchedDiscouragedTags = intersectSignals(
    venueTags,
    slotIntent.discouragedTags
  )

  const matchedDiscouragedTypes = intersectSignals(
    venueTypes,
    slotIntent.discouragedTypes
  )

  const matchedStronglyDiscouragedTypes = intersectSignals(
    venueTypes,
    slotIntent.stronglyDiscouragedTypes
  )

  const matchedContextualExclusionTypes = intersectSignals(
    venueTypes,
    slotIntent.contextualExclusionTypes
  )

  const preferredVibeScore =
    Math.min(matchedPreferredVibes.length, 3) *
    weights.preferredVibeMatch

  const preferredTagScore =
    Math.min(matchedPreferredTags.length, 3) *
    weights.preferredTagMatch

  const eventContextScore =
    Math.min(matchedEventContextTokens.length, 3) *
    weights.eventContextMatch

  const archetypeVibeScore =
    Math.min(matchedArchetypeVibes.length, 2) *
    weights.archetypeVibeMatch

  const roleTypeScore =
    Math.min(matchedRoleTypes.length, 2) *
    weights.roleTypeMatch

  const daypartTypeScore =
    Math.min(matchedDaypartTypes.length, 2) *
    weights.daypartTypeMatch

  const preferredTypeScore =
    Math.min(matchedPreferredTypes.length, 3) *
    weights.preferredTypeMatch

  const requiredTypeScore =
    slotIntent.requiredAnyTypes.length === 0
      ? 0
      : matchedRequiredTypes.length > 0
        ? weights.requiredTypeMatch
        : weights.requiredTypeMiss

  const discouragedVibeScore =
    Math.min(matchedDiscouragedVibes.length, 3) *
    weights.discouragedVibeMatch

  const discouragedTagScore =
    Math.min(matchedDiscouragedTags.length, 3) *
    weights.discouragedTagMatch

  const discouragedTypeScore =
    Math.min(matchedDiscouragedTypes.length, 3) *
    weights.discouragedTypeMatch

  const stronglyDiscouragedTypeScore =
    Math.min(matchedStronglyDiscouragedTypes.length, 2) *
    weights.stronglyDiscouragedTypeMatch

  const contextualExclusionScore =
    Math.min(matchedContextualExclusionTypes.length, 2) *
    weights.contextualExclusionMatch

  const total =
    preferredVibeScore +
    preferredTagScore +
    eventContextScore +
    archetypeVibeScore +
    roleTypeScore +
    daypartTypeScore +
    preferredTypeScore +
    requiredTypeScore +
    discouragedVibeScore +
    discouragedTagScore +
    discouragedTypeScore +
    stronglyDiscouragedTypeScore +
    contextualExclusionScore

  const semanticPositiveMatchCount = uniqueStrings([
    ...matchedPreferredVibes,
    ...matchedPreferredTags,
    ...matchedEventContextTokens,
    ...matchedArchetypeVibes,
  ]).length

  const semanticNegativeMatchCount = uniqueStrings([
    ...matchedDiscouragedVibes,
    ...matchedDiscouragedTags,
  ]).length

  const typePositiveMatchCount = uniqueStrings([
    ...matchedRoleTypes,
    ...matchedDaypartTypes,
    ...matchedPreferredTypes,
    ...matchedRequiredTypes,
  ]).length

  const typeNegativeMatchCount = uniqueStrings([
    ...matchedDiscouragedTypes,
    ...matchedStronglyDiscouragedTypes,
    ...matchedContextualExclusionTypes,
  ]).length

  const semanticConfidence = calculateSemanticConfidence({
    venueSemanticSignalCount: allSemanticSignals.length,
    semanticPositiveMatchCount,
    semanticNegativeMatchCount,
    requestedSemanticSignalCount:
      slotIntent.preferredVibes.length +
      slotIntent.preferredTags.length +
      slotIntent.eventContextTokens.length,
  })

  const hasPositiveSemanticEvidence =
    semanticPositiveMatchCount > 0

  const hasStrongSemanticEvidence =
    semanticPositiveMatchCount >= 2 ||
    semanticConfidence >= 0.55

  const hasContextualConflict =
    matchedContextualExclusionTypes.length > 0 ||
    matchedStronglyDiscouragedTypes.length > 0

  /**
   * A broad type conflict alone should not automatically eliminate a venue.
   * Rejection occurs only when the venue is contextually inappropriate and
   * lacks meaningful semantic evidence that it still fits the requested vibe.
   */
  const shouldReject =
    hasContextualConflict &&
    !hasStrongSemanticEvidence &&
    semanticNegativeMatchCount > 0

  const breakdown: VenueIntentScoreBreakdown = {
    preferredVibe: preferredVibeScore,
    preferredTag: preferredTagScore,
    eventContext: eventContextScore,
    archetypeVibe: archetypeVibeScore,

    roleType: roleTypeScore,
    daypartType: daypartTypeScore,
    preferredType: preferredTypeScore,
    requiredType: requiredTypeScore,

    discouragedVibe: discouragedVibeScore,
    discouragedTag: discouragedTagScore,
    discouragedType: discouragedTypeScore,
    stronglyDiscouragedType: stronglyDiscouragedTypeScore,
    contextualExclusion: contextualExclusionScore,

    total,

    matchedPreferredVibes,
    matchedPreferredTags,
    matchedEventContextTokens,
    matchedArchetypeVibes,

    matchedRoleTypes,
    matchedDaypartTypes,
    matchedPreferredTypes,
    matchedRequiredTypes,

    matchedDiscouragedVibes,
    matchedDiscouragedTags,
    matchedDiscouragedTypes,
    matchedStronglyDiscouragedTypes,
    matchedContextualExclusionTypes,

    semanticPositiveMatchCount,
    semanticNegativeMatchCount,
    typePositiveMatchCount,
    typeNegativeMatchCount,

    semanticConfidence,
  }

  return {
    score: total,
    semanticConfidence,
    hasPositiveSemanticEvidence,
    hasStrongSemanticEvidence,
    hasContextualConflict,
    shouldReject,
    breakdown,
  }
}

// -----------------------------------------------------------------------------
// Contextual Rules
// -----------------------------------------------------------------------------

function resolveContextualExclusionTypes({
  context,
  slot,
  daypart,
  daypartDiscouragedTypes,
  stronglyDiscouragedTypes,
}: {
  context: PlanningContext
  slot: PlanningSlot
  daypart: VibeDaypart
  daypartDiscouragedTypes: string[]
  stronglyDiscouragedTypes: string[]
}): string[] {
  const archetype = normalizeArchetype(context.eventArchetype)

  const contextualTypes = [
    ...normalizeSemanticValues(daypartDiscouragedTypes),
  ]

  if (
    (daypart === "evening" || daypart === "late_night") &&
    archetype === "nightlife"
  ) {
    contextualTypes.push(
      "park",
      "garden",
      "library",
      "bookstore",
      "museum",
      "gallery",
      "market",
      "fitness",
      "yoga",
      "pilates"
    )
  }

  if (
    daypart === "late_night" &&
    slot.phase === "after"
  ) {
    contextualTypes.push(
      "breakfast",
      "brunch",
      "lunch",
      "library",
      "museum",
      "gallery",
      "park",
      "garden",
      "market"
    )
  }

  if (
    (daypart === "early_morning" || daypart === "morning") &&
    slot.phase === "before"
  ) {
    contextualTypes.push(
      "club",
      "late night",
      "dive bar",
      "speakeasy"
    )
  }

  if (
    slot.role === "coffee" &&
    (daypart === "evening" || daypart === "late_night")
  ) {
    contextualTypes.push(
      "breakfast",
      "brunch"
    )
  }

  return uniqueStrings([
    ...normalizeSemanticValues(contextualTypes),
    ...normalizeSemanticValues(stronglyDiscouragedTypes).filter((type) =>
      contextualTypes
        .map(normalizeSemanticValue)
        .includes(normalizeSemanticValue(type))
    ),
  ])
}

// -----------------------------------------------------------------------------
// Daypart Resolution
// -----------------------------------------------------------------------------

export function resolveIntentDaypart(
  date: Date,
  timeZone: string
): VibeDaypart {
  const hour = getHourFractionInTimeZone(date, timeZone)

  if (hour < 7) return "early_morning"
  if (hour < 11) return "morning"
  if (hour < 14) return "midday"
  if (hour < 17) return "afternoon"
  if (hour < 22) return "evening"

  return "late_night"
}

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

function getPlanningSlots(
  context: PlanningContext
): PlanningSlot[] {
  if (context.slots?.length) {
    return context.slots
  }

  return context.desiredRoles.map((role, index) => {
    const phase: SlotPhase =
      context.mode === "before"
        ? "before"
        : context.mode === "after"
          ? "after"
          : index === 0
            ? "before"
            : "after"

    const arrival =
      phase === "before"
        ? new Date(
            context.startsAt.getTime() -
            (context.desiredRoles.length - index) * 60 * 60 * 1000
          )
        : new Date(
            (context.effectiveExitAt ?? context.estimatedEndAt).getTime() +
            (index + 1) * 45 * 60 * 1000
          )

    const dwellMinutes =
      role === "food"
        ? 75
        : role === "drink"
          ? 60
          : role === "activity"
            ? 60
            : 40

    return {
      index,
      role,
      phase,
      targetArrivalAt: arrival,
      targetDepartureAt: new Date(
        arrival.getTime() + dwellMinutes * 60 * 1000
      ),
      dwellMinutes,
      strictProgression: index > 0,
      flexibleRole: null,
      semanticRole: getSemanticRoleForSlot({
        archetype: context.eventArchetype,
        phase,
        index,
      }),
    }
  })
}

function calculateSemanticConfidence({
  venueSemanticSignalCount,
  semanticPositiveMatchCount,
  semanticNegativeMatchCount,
  requestedSemanticSignalCount,
}: {
  venueSemanticSignalCount: number
  semanticPositiveMatchCount: number
  semanticNegativeMatchCount: number
  requestedSemanticSignalCount: number
}): number {
  if (
    venueSemanticSignalCount === 0 ||
    requestedSemanticSignalCount === 0
  ) {
    return 0
  }

  const positiveCoverage = Math.min(
    semanticPositiveMatchCount / 3,
    1
  )

  const dataCoverage = Math.min(
    venueSemanticSignalCount / 4,
    1
  )

  const negativePenalty = Math.min(
    semanticNegativeMatchCount * 0.2,
    0.6
  )

  const score =
    positiveCoverage * 0.7 +
    dataCoverage * 0.3 -
    negativePenalty

  return Number(
    Math.max(0, Math.min(1, score)).toFixed(2)
  )
}

function intersectSignals(
  candidateValues: string[],
  expectedValues: string[]
): string[] {
  if (
    candidateValues.length === 0 ||
    expectedValues.length === 0
  ) {
    return []
  }

  const candidateSet = new Set(
    candidateValues.map(normalizeSemanticValue)
  )

  return uniqueStrings(
    expectedValues
      .map(normalizeSemanticValue)
      .filter(Boolean)
      .filter((value) => candidateSet.has(value))
  )
}

function normalizeSemanticValues(
  values: string[]
): string[] {
  return uniqueStrings(
    values
      .map(normalizeSemanticValue)
      .filter(Boolean)
  )
}

function normalizeSemanticValue(
  value: string
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[_/|]+/g, " ")
    .replace(/-+/g, " ")
    .replace(/[.,;:!?()[\]{}"'`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeArchetype(
  value: string | null | undefined
): string {
  if (value === "art") return "arts_culture"
  if (value === "sports") return "social_sports"
  if (value === "festival") return "market"
  if (value === "general") return "other"

  return value ?? "other"
}