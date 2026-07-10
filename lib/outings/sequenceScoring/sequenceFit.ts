// lib/outings/sequenceScoring/sequenceFit.ts

import type {
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  StopRole,
  VenueRecord,
} from "../types"

import {
  hasAnyType,
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
} from "./helpers"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type SequenceFitConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type SequenceVenueLike = Pick<
  VenueRecord,
  "id" | "name" | "type" | "tags" | "vibe" | "time_category"
> & {
  inferredRoles?: StopRole[]
  assignedRole?: StopRole | null
  slotRole?: StopRole | null
  phase?: SlotPhase | null
  slotPhase?: SlotPhase | null
  slotIndex?: number | null

  /*
   * energy_ramp is intentionally optional and weakly weighted.
   * The planner must remain stable while venue coverage is incomplete.
   */
  energy_ramp?: string | number | null
}

export type SequenceFitBreakdown = {
  roleProgression: number
  typeTransition: number
  vibeContinuity: number
  tagContinuity: number
  timeCategoryContinuity: number
  variety: number
  repetitionPenalty: number
  phaseCoherence: number
  archetypeProgression: number
  energyProgression: number
  routeShape: number
}

export type SequenceFitEvidence = {
  phase: SlotPhase
  slotIndex: number
  currentRole: StopRole
  previousRole: StopRole | null

  selectedVenueCount: number
  previousVenueId: string | null

  sharedTypes: string[]
  sharedVibes: string[]
  sharedTags: string[]
  sharedTimeCategories: string[]

  candidateTypeFamilies: string[]
  previousTypeFamilies: string[]

  candidateEnergyLevel: number | null
  previousEnergyLevel: number | null
  energyEvidenceUsed: boolean

  duplicateVenue: boolean
  repeatedTypeFamilyCount: number
  repeatedPrimaryTypeCount: number

  isFullModePhaseTransition: boolean
  sequenceDirection: "toward_event" | "away_from_event"
}

export type SequenceFitResult = {
  score: number
  confidence: SequenceFitConfidence
  confidenceScore: number

  isStrongFit: boolean
  isWeakFit: boolean
  isHardConflict: boolean

  breakdown: SequenceFitBreakdown
  evidence: SequenceFitEvidence
}

export type ComputeSequenceFitInput = {
  venue: SequenceVenueLike
  context: PlanningContext
  slot: PlanningSlot
  selectedSoFar?: SequenceVenueLike[]
  previousVenue?: SequenceVenueLike | null
}

// -----------------------------------------------------------------------------
// Score boundaries
// -----------------------------------------------------------------------------

const MAX_SEQUENCE_SCORE = 34
const MIN_SEQUENCE_SCORE = -48

/*
 * Sequence fit should influence the final ranking without overpowering
 * semantic fit, archetype fit, vibe fit, or time fit.
 */
const DUPLICATE_VENUE_PENALTY = 48
const REPEATED_PRIMARY_TYPE_PENALTY = 10
const REPEATED_FAMILY_PENALTY = 6

const STRONG_ROLE_PROGRESSION_BONUS = 10
const ACCEPTABLE_ROLE_PROGRESSION_BONUS = 5
const AWKWARD_ROLE_PROGRESSION_PENALTY = 10

const STRONG_TYPE_TRANSITION_BONUS = 8
const ACCEPTABLE_TYPE_TRANSITION_BONUS = 4
const TYPE_TRANSITION_CLASH_PENALTY = 8

const VIBE_CONTINUITY_MAX_BONUS = 6
const TAG_CONTINUITY_MAX_BONUS = 3
const TIME_CONTINUITY_MAX_BONUS = 4

const HEALTHY_VARIETY_BONUS = 5
const EXCESSIVE_VARIETY_PENALTY = 5

const PHASE_COHERENCE_BONUS = 5
const PHASE_COHERENCE_PENALTY = 7

const ARCHETYPE_PROGRESSION_BONUS = 6
const ARCHETYPE_PROGRESSION_PENALTY = 6

/*
 * Energy remains deliberately weak until energy_ramp coverage improves.
 */
const ENERGY_PROGRESS_MAX_BONUS = 3
const ENERGY_PROGRESS_MAX_PENALTY = 4

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeSequenceFit({
  venue,
  context,
  slot,
  selectedSoFar = [],
  previousVenue: explicitPreviousVenue,
}: ComputeSequenceFitInput): SequenceFitResult {
  const previousVenue =
    explicitPreviousVenue ??
    selectedSoFar[selectedSoFar.length - 1] ??
    null

  const candidateTypes = normalizeVenueTypes(venue.type)
  const previousTypes = previousVenue
    ? normalizeVenueTypes(previousVenue.type)
    : []

  const candidateVibes = normalizeValues(venue.vibe)
  const previousVibes = previousVenue
    ? normalizeValues(previousVenue.vibe)
    : []

  const candidateTags = normalizeValues(venue.tags)
  const previousTags = previousVenue
    ? normalizeValues(previousVenue.tags)
    : []

  const candidateTimeCategories = normalizeValues(venue.time_category)
  const previousTimeCategories = previousVenue
    ? normalizeValues(previousVenue.time_category)
    : []

  const candidateTypeFamilies = getTypeFamilies(candidateTypes)
  const previousTypeFamilies = getTypeFamilies(previousTypes)

  const sharedTypes = intersect(candidateTypes, previousTypes)
  const sharedVibes = intersect(candidateVibes, previousVibes)
  const sharedTags = intersect(candidateTags, previousTags)
  const sharedTimeCategories = intersect(
    candidateTimeCategories,
    previousTimeCategories
  )

  const currentRole = slot.role
  const previousRole = resolveSelectedRole(previousVenue)

  const duplicateVenue = selectedSoFar.some(
    (selected) => selected.id === venue.id
  )

  const repeatedTypeFamilyCount = countRepeatedTypeFamilies(
    candidateTypeFamilies,
    selectedSoFar
  )

  const repeatedPrimaryTypeCount = countRepeatedPrimaryTypes(
    candidateTypes,
    selectedSoFar
  )

  const isFullModePhaseTransition =
    context.mode === "full" &&
    slot.phase === "after" &&
    selectedSoFar.some((selected) => resolveSelectedPhase(selected) === "before")

  const candidateEnergyLevel = readEnergyLevel(venue)
  const previousEnergyLevel = readEnergyLevel(previousVenue)
  const energyEvidenceUsed =
    candidateEnergyLevel != null && previousEnergyLevel != null

  const roleProgression = scoreRoleProgression({
    previousRole,
    currentRole,
    phase: slot.phase,
    context,
  })

  const typeTransition = scoreTypeTransition({
    previousTypes,
    candidateTypes,
    previousFamilies: previousTypeFamilies,
    candidateFamilies: candidateTypeFamilies,
    phase: slot.phase,
    context,
  })

  const vibeContinuity = scoreSharedContinuity(
    sharedVibes.length,
    VIBE_CONTINUITY_MAX_BONUS
  )

  const tagContinuity = scoreSharedContinuity(
    sharedTags.length,
    TAG_CONTINUITY_MAX_BONUS
  )

  const timeCategoryContinuity = scoreTimeCategoryContinuity({
    sharedTimeCategories,
    candidateTimeCategories,
    previousTimeCategories,
  })

  const variety = scoreSequenceVariety({
    selectedSoFar,
    candidateTypes,
    candidateFamilies: candidateTypeFamilies,
  })

  const repetitionPenalty = scoreRepetitionPenalty({
    duplicateVenue,
    repeatedTypeFamilyCount,
    repeatedPrimaryTypeCount,
  })

  const phaseCoherence = scorePhaseCoherence({
    slot,
    context,
    previousVenue,
    currentRole,
    previousRole,
    isFullModePhaseTransition,
  })

  const archetypeProgression = scoreArchetypeProgression({
    previousTypes,
    candidateTypes,
    previousRole,
    currentRole,
    context,
    phase: slot.phase,
  })

  const energyProgression = scoreEnergyProgression({
    previousEnergyLevel,
    candidateEnergyLevel,
    phase: slot.phase,
    archetype: normalizeArchetype(context.eventArchetype),
  })

  const routeShape = scoreRouteShape({
    selectedSoFar,
    candidateTypes,
    candidateFamilies: candidateTypeFamilies,
    currentRole,
  })

  const breakdown: SequenceFitBreakdown = {
    roleProgression,
    typeTransition,
    vibeContinuity,
    tagContinuity,
    timeCategoryContinuity,
    variety,
    repetitionPenalty,
    phaseCoherence,
    archetypeProgression,
    energyProgression,
    routeShape,
  }

  const rawScore =
    roleProgression +
    typeTransition +
    vibeContinuity +
    tagContinuity +
    timeCategoryContinuity +
    variety +
    repetitionPenalty +
    phaseCoherence +
    archetypeProgression +
    energyProgression +
    routeShape

  const score = clamp(
    Math.round(rawScore),
    MIN_SEQUENCE_SCORE,
    MAX_SEQUENCE_SCORE
  )

  const isHardConflict = duplicateVenue

  const confidenceScore = calculateSequenceConfidence({
    hasPreviousVenue: previousVenue != null,
    candidateTypes,
    previousTypes,
    candidateVibes,
    previousVibes,
    selectedVenueCount: selectedSoFar.length,
    hasAssignedPreviousRole: previousRole != null,
    energyEvidenceUsed,
  })

  const confidence = resolveSequenceConfidence({
    confidenceScore,
    hasPreviousVenue: previousVenue != null,
  })

  return {
    score,
    confidence,
    confidenceScore,
    isStrongFit:
      !isHardConflict &&
      score >= 12 &&
      confidenceScore >= 0.55,
    isWeakFit:
      isHardConflict ||
      score <= -10,
    isHardConflict,
    breakdown,
    evidence: {
      phase: slot.phase,
      slotIndex: slot.index,
      currentRole,
      previousRole,
      selectedVenueCount: selectedSoFar.length,
      previousVenueId: previousVenue?.id ?? null,
      sharedTypes,
      sharedVibes,
      sharedTags,
      sharedTimeCategories,
      candidateTypeFamilies,
      previousTypeFamilies,
      candidateEnergyLevel,
      previousEnergyLevel,
      energyEvidenceUsed,
      duplicateVenue,
      repeatedTypeFamilyCount,
      repeatedPrimaryTypeCount,
      isFullModePhaseTransition,
      sequenceDirection:
        slot.phase === "before"
          ? "toward_event"
          : "away_from_event",
    },
  }
}

/**
 * Numeric wrapper used by candidate ranking.
 */
export function scoreSequenceFit(
  venue: SequenceVenueLike,
  context: PlanningContext,
  slot: PlanningSlot,
  selectedSoFar: SequenceVenueLike[] = [],
  previousVenue?: SequenceVenueLike | null
): number {
  return computeSequenceFit({
    venue,
    context,
    slot,
    selectedSoFar,
    previousVenue,
  }).score
}

/**
 * The only default hard sequence conflict is selecting the same venue twice.
 *
 * Awkward progressions should be penalized, not categorically removed, because
 * incomplete venue coverage can otherwise make the planner brittle.
 */
export function isSequenceHardConflict(
  venue: SequenceVenueLike,
  context: PlanningContext,
  slot: PlanningSlot,
  selectedSoFar: SequenceVenueLike[] = [],
  previousVenue?: SequenceVenueLike | null
): boolean {
  return computeSequenceFit({
    venue,
    context,
    slot,
    selectedSoFar,
    previousVenue,
  }).isHardConflict
}

/**
 * Diagnostic and persisted metadata helper.
 */
export function getSequenceFitMetadata(
  result: SequenceFitResult
): {
  sequenceFitScore: number
  sequenceFitConfidence: number
  sequenceFitConfidenceLabel: SequenceFitConfidence
  sequenceStrongFit: boolean
  sequenceWeakFit: boolean
  sequenceHardConflict: boolean
  previousVenueId: string | null
  previousRole: StopRole | null
  sharedTypes: string[]
  sharedVibes: string[]
  sharedTags: string[]
  sharedTimeCategories: string[]
  candidateTypeFamilies: string[]
  previousTypeFamilies: string[]
  repeatedTypeFamilyCount: number
  repeatedPrimaryTypeCount: number
  energyEvidenceUsed: boolean
  candidateEnergyLevel: number | null
  previousEnergyLevel: number | null
  sequenceBreakdown: SequenceFitBreakdown
} {
  return {
    sequenceFitScore: result.score,
    sequenceFitConfidence: result.confidenceScore,
    sequenceFitConfidenceLabel: result.confidence,
    sequenceStrongFit: result.isStrongFit,
    sequenceWeakFit: result.isWeakFit,
    sequenceHardConflict: result.isHardConflict,
    previousVenueId: result.evidence.previousVenueId,
    previousRole: result.evidence.previousRole,
    sharedTypes: result.evidence.sharedTypes,
    sharedVibes: result.evidence.sharedVibes,
    sharedTags: result.evidence.sharedTags,
    sharedTimeCategories: result.evidence.sharedTimeCategories,
    candidateTypeFamilies: result.evidence.candidateTypeFamilies,
    previousTypeFamilies: result.evidence.previousTypeFamilies,
    repeatedTypeFamilyCount: result.evidence.repeatedTypeFamilyCount,
    repeatedPrimaryTypeCount: result.evidence.repeatedPrimaryTypeCount,
    energyEvidenceUsed: result.evidence.energyEvidenceUsed,
    candidateEnergyLevel: result.evidence.candidateEnergyLevel,
    previousEnergyLevel: result.evidence.previousEnergyLevel,
    sequenceBreakdown: result.breakdown,
  }
}

export function hasAcceptableSequenceFit(
  result: SequenceFitResult,
  minimumConfidence = 0.35
): boolean {
  return (
    !result.isHardConflict &&
    result.confidenceScore >= minimumConfidence &&
    result.score > -10
  )
}

// -----------------------------------------------------------------------------
// Role progression
// -----------------------------------------------------------------------------

function scoreRoleProgression({
  previousRole,
  currentRole,
  phase,
  context,
}: {
  previousRole: StopRole | null
  currentRole: StopRole
  phase: SlotPhase
  context: PlanningContext
}): number {
  if (!previousRole) return 0

  const archetype = normalizeArchetype(context.eventArchetype)

  if (previousRole === currentRole) {
    if (currentRole === "drink" && phase === "after") {
      return archetype === "nightlife" || archetype === "music"
        ? ACCEPTABLE_ROLE_PROGRESSION_BONUS
        : -4
    }

    if (currentRole === "activity") {
      return -6
    }

    return -AWKWARD_ROLE_PROGRESSION_PENALTY
  }

  const transition = `${previousRole}->${currentRole}`

  const strongTransitions = new Set([
    "coffee->food",
    "coffee->activity",
    "activity->food",
    "activity->drink",
    "food->drink",
    "food->dessert",
    "drink->food",
    "drink->dessert",
    "dessert->drink",
  ])

  const acceptableTransitions = new Set([
    "coffee->drink",
    "food->activity",
    "drink->activity",
    "dessert->food",
    "activity->coffee",
  ])

  const awkwardTransitions = new Set([
    "food->coffee",
    "drink->coffee",
    "dessert->coffee",
    "dessert->activity",
  ])

  if (strongTransitions.has(transition)) {
    return STRONG_ROLE_PROGRESSION_BONUS
  }

  if (acceptableTransitions.has(transition)) {
    return ACCEPTABLE_ROLE_PROGRESSION_BONUS
  }

  if (awkwardTransitions.has(transition)) {
    return -AWKWARD_ROLE_PROGRESSION_PENALTY
  }

  return 0
}

// -----------------------------------------------------------------------------
// Type transitions
// -----------------------------------------------------------------------------

function scoreTypeTransition({
  previousTypes,
  candidateTypes,
  previousFamilies,
  candidateFamilies,
  phase,
  context,
}: {
  previousTypes: string[]
  candidateTypes: string[]
  previousFamilies: string[]
  candidateFamilies: string[]
  phase: SlotPhase
  context: PlanningContext
}): number {
  if (previousTypes.length === 0 || candidateTypes.length === 0) {
    return 0
  }

  const archetype = normalizeArchetype(context.eventArchetype)

  const previousMeal = previousFamilies.includes("meal")
  const candidateMeal = candidateFamilies.includes("meal")

  const previousDrinks = previousFamilies.includes("drinks")
  const candidateDrinks = candidateFamilies.includes("drinks")

  const previousCoffee = previousFamilies.includes("coffee")
  const candidateCoffee = candidateFamilies.includes("coffee")

  const previousCulture = previousFamilies.includes("culture")
  const candidateCulture = candidateFamilies.includes("culture")

  const previousWellness = previousFamilies.includes("wellness")
  const candidateNightlife = candidateFamilies.includes("nightlife")

  const previousNightlife = previousFamilies.includes("nightlife")
  const candidateQuiet = candidateFamilies.includes("quiet")

  if (
    (previousMeal && candidateDrinks) ||
    (previousDrinks && candidateMeal) ||
    (previousCoffee && candidateMeal) ||
    (previousCulture && candidateMeal) ||
    (previousCulture && candidateDrinks)
  ) {
    return STRONG_TYPE_TRANSITION_BONUS
  }

  if (
    archetype === "arts_culture" &&
    previousCulture &&
    (candidateMeal || candidateDrinks)
  ) {
    return STRONG_TYPE_TRANSITION_BONUS
  }

  if (
    archetype === "nightlife" &&
    phase === "before" &&
    previousMeal &&
    candidateDrinks
  ) {
    return STRONG_TYPE_TRANSITION_BONUS
  }

  if (
    archetype === "nightlife" &&
    phase === "after" &&
    previousDrinks &&
    candidateDrinks
  ) {
    return ACCEPTABLE_TYPE_TRANSITION_BONUS
  }

  if (
    previousWellness &&
    candidateNightlife
  ) {
    return -TYPE_TRANSITION_CLASH_PENALTY
  }

  if (
    previousNightlife &&
    candidateQuiet
  ) {
    return -TYPE_TRANSITION_CLASH_PENALTY
  }

  if (
    previousCoffee &&
    candidateCoffee
  ) {
    return -6
  }

  if (
    previousMeal &&
    candidateMeal
  ) {
    return -5
  }

  if (
    intersect(previousFamilies, candidateFamilies).length > 0
  ) {
    return ACCEPTABLE_TYPE_TRANSITION_BONUS
  }

  return 0
}

// -----------------------------------------------------------------------------
// Continuity
// -----------------------------------------------------------------------------

function scoreSharedContinuity(
  sharedCount: number,
  maximumBonus: number
): number {
  if (sharedCount <= 0) return 0

  return Math.min(sharedCount * 2, maximumBonus)
}

function scoreTimeCategoryContinuity({
  sharedTimeCategories,
  candidateTimeCategories,
  previousTimeCategories,
}: {
  sharedTimeCategories: string[]
  candidateTimeCategories: string[]
  previousTimeCategories: string[]
}): number {
  if (
    candidateTimeCategories.length === 0 ||
    previousTimeCategories.length === 0
  ) {
    return 0
  }

  if (sharedTimeCategories.length > 0) {
    return Math.min(
      sharedTimeCategories.length * 2,
      TIME_CONTINUITY_MAX_BONUS
    )
  }

  const previousLate = hasAnyValue(previousTimeCategories, [
    "late night",
    "late-night",
    "night",
  ])

  const candidateMorning = hasAnyValue(candidateTimeCategories, [
    "morning",
    "breakfast",
    "early morning",
    "early_morning",
  ])

  if (previousLate && candidateMorning) {
    return -6
  }

  return 0
}

// -----------------------------------------------------------------------------
// Variety and repetition
// -----------------------------------------------------------------------------

function scoreSequenceVariety({
  selectedSoFar,
  candidateTypes,
  candidateFamilies,
}: {
  selectedSoFar: SequenceVenueLike[]
  candidateTypes: string[]
  candidateFamilies: string[]
}): number {
  if (selectedSoFar.length === 0) return 0

  const selectedFamilies = uniqueStrings(
    selectedSoFar.flatMap((selected) =>
      getTypeFamilies(normalizeVenueTypes(selected.type))
    )
  )

  const selectedTypes = uniqueStrings(
    selectedSoFar.flatMap((selected) =>
      normalizeVenueTypes(selected.type)
    )
  )

  const addsNewFamily = candidateFamilies.some(
    (family) => !selectedFamilies.includes(family)
  )

  const addsNewType = candidateTypes.some(
    (type) => !selectedTypes.includes(type)
  )

  if (addsNewFamily && addsNewType) {
    return HEALTHY_VARIETY_BONUS
  }

  /*
   * Too much variety can feel random. Penalize only when a route already spans
   * several unrelated venue families.
   */
  if (
    selectedFamilies.length >= 3 &&
    candidateFamilies.every(
      (family) => !selectedFamilies.includes(family)
    )
  ) {
    return -EXCESSIVE_VARIETY_PENALTY
  }

  return 0
}

function scoreRepetitionPenalty({
  duplicateVenue,
  repeatedTypeFamilyCount,
  repeatedPrimaryTypeCount,
}: {
  duplicateVenue: boolean
  repeatedTypeFamilyCount: number
  repeatedPrimaryTypeCount: number
}): number {
  if (duplicateVenue) {
    return -DUPLICATE_VENUE_PENALTY
  }

  let penalty = 0

  if (repeatedPrimaryTypeCount >= 2) {
    penalty -= REPEATED_PRIMARY_TYPE_PENALTY
  } else if (repeatedPrimaryTypeCount === 1) {
    penalty -= 3
  }

  if (repeatedTypeFamilyCount >= 2) {
    penalty -= REPEATED_FAMILY_PENALTY
  }

  return penalty
}

// -----------------------------------------------------------------------------
// Phase and archetype progression
// -----------------------------------------------------------------------------

function scorePhaseCoherence({
  slot,
  context,
  previousVenue,
  currentRole,
  previousRole,
  isFullModePhaseTransition,
}: {
  slot: PlanningSlot
  context: PlanningContext
  previousVenue: SequenceVenueLike | null
  currentRole: StopRole
  previousRole: StopRole | null
  isFullModePhaseTransition: boolean
}): number {
  if (!previousVenue) return 0

  const previousPhase = resolveSelectedPhase(previousVenue)

  if (
    previousPhase &&
    previousPhase === slot.phase
  ) {
    return 1
  }

  if (isFullModePhaseTransition) {
    if (
      previousRole === "food" &&
      (currentRole === "drink" || currentRole === "dessert")
    ) {
      return PHASE_COHERENCE_BONUS
    }

    if (
      previousRole === "activity" &&
      (currentRole === "food" || currentRole === "drink")
    ) {
      return PHASE_COHERENCE_BONUS
    }

    if (
      previousRole === "coffee" &&
      currentRole === "coffee"
    ) {
      return -PHASE_COHERENCE_PENALTY
    }

    return 0
  }

  if (
    previousPhase === "after" &&
    slot.phase === "before"
  ) {
    return -PHASE_COHERENCE_PENALTY
  }

  return 0
}

function scoreArchetypeProgression({
  previousTypes,
  candidateTypes,
  previousRole,
  currentRole,
  context,
  phase,
}: {
  previousTypes: string[]
  candidateTypes: string[]
  previousRole: StopRole | null
  currentRole: StopRole
  context: PlanningContext
  phase: SlotPhase
}): number {
  if (previousTypes.length === 0) return 0

  const archetype = normalizeArchetype(context.eventArchetype)

  if (archetype === "nightlife") {
    if (
      phase === "before" &&
      previousRole === "food" &&
      currentRole === "drink"
    ) {
      return ARCHETYPE_PROGRESSION_BONUS
    }

    if (
      phase === "after" &&
      hasAnyType(previousTypes, [
        "bar",
        "cocktail",
        "lounge",
        "club",
        "speakeasy",
      ]) &&
      hasAnyType(candidateTypes, [
        "bar",
        "cocktail",
        "lounge",
        "club",
        "speakeasy",
        "late night",
      ])
    ) {
      return 4
    }

    if (
      phase === "before" &&
      hasAnyType(candidateTypes, [
        "park",
        "garden",
        "library",
        "yoga",
        "pilates",
      ])
    ) {
      return -ARCHETYPE_PROGRESSION_PENALTY
    }
  }

  if (archetype === "arts_culture") {
    if (
      hasAnyType(previousTypes, [
        "gallery",
        "museum",
        "bookstore",
        "showroom",
      ]) &&
      hasAnyType(candidateTypes, [
        "restaurant",
        "dinner",
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
      ])
    ) {
      return ARCHETYPE_PROGRESSION_BONUS
    }
  }

  if (archetype === "networking") {
    if (
      hasAnyType(previousTypes, [
        "coffee",
        "cafe",
        "café",
        "restaurant",
        "lunch",
        "dinner",
      ]) &&
      hasAnyType(candidateTypes, [
        "wine bar",
        "cocktail",
        "lounge",
        "hotel bar",
        "hotel lobby",
      ])
    ) {
      return ARCHETYPE_PROGRESSION_BONUS
    }
  }

  if (archetype === "wellness") {
    if (
      hasAnyType(previousTypes, [
        "spa",
        "fitness",
        "yoga",
        "pilates",
        "park",
        "garden",
      ]) &&
      hasAnyType(candidateTypes, [
        "juice",
        "smoothie",
        "healthy",
        "salad",
        "coffee",
        "tea",
      ])
    ) {
      return ARCHETYPE_PROGRESSION_BONUS
    }
  }

  if (archetype === "food_drink") {
    if (
      previousRole === "drink" &&
      currentRole === "dessert"
    ) {
      return ARCHETYPE_PROGRESSION_BONUS
    }
  }

  return 0
}

// -----------------------------------------------------------------------------
// Energy progression
// -----------------------------------------------------------------------------

function scoreEnergyProgression({
  previousEnergyLevel,
  candidateEnergyLevel,
  phase,
  archetype,
}: {
  previousEnergyLevel: number | null
  candidateEnergyLevel: number | null
  phase: SlotPhase
  archetype: string
}): number {
  if (
    previousEnergyLevel == null ||
    candidateEnergyLevel == null
  ) {
    return 0
  }

  const delta = candidateEnergyLevel - previousEnergyLevel

  if (
    archetype === "nightlife" ||
    archetype === "music" ||
    archetype === "comedy"
  ) {
    if (phase === "before") {
      if (delta >= 0 && delta <= 2) {
        return ENERGY_PROGRESS_MAX_BONUS
      }

      if (delta <= -3) {
        return -ENERGY_PROGRESS_MAX_PENALTY
      }
    }

    if (phase === "after") {
      if (delta >= -1 && delta <= 2) {
        return ENERGY_PROGRESS_MAX_BONUS
      }

      if (delta <= -3) {
        return -ENERGY_PROGRESS_MAX_PENALTY
      }
    }
  }

  if (
    archetype === "wellness" ||
    archetype === "arts_culture" ||
    archetype === "networking"
  ) {
    if (Math.abs(delta) <= 1) {
      return 2
    }

    if (Math.abs(delta) >= 4) {
      return -3
    }
  }

  return 0
}

// -----------------------------------------------------------------------------
// Route-shape logic
// -----------------------------------------------------------------------------

function scoreRouteShape({
  selectedSoFar,
  candidateTypes,
  candidateFamilies,
  currentRole,
}: {
  selectedSoFar: SequenceVenueLike[]
  candidateTypes: string[]
  candidateFamilies: string[]
  currentRole: StopRole
}): number {
  if (selectedSoFar.length < 2) return 0

  const previous = selectedSoFar[selectedSoFar.length - 1]
  const prior = selectedSoFar[selectedSoFar.length - 2]

  const previousFamilies = getTypeFamilies(
    normalizeVenueTypes(previous.type)
  )

  const priorFamilies = getTypeFamilies(
    normalizeVenueTypes(prior.type)
  )

  const previousRole = resolveSelectedRole(previous)
  const priorRole = resolveSelectedRole(prior)

  /*
   * Prevent A → B → A style oscillation unless the current role meaningfully
   * changes the function of the venue.
   */
  const returnsToPriorFamily =
    intersect(candidateFamilies, priorFamilies).length > 0 &&
    intersect(candidateFamilies, previousFamilies).length === 0

  if (
    returnsToPriorFamily &&
    currentRole === priorRole
  ) {
    return -7
  }

  const threeRoleProgression =
    priorRole === "coffee" &&
    previousRole === "food" &&
    (currentRole === "drink" || currentRole === "activity")

  if (threeRoleProgression) {
    return 5
  }

  const mealDrinkFinish =
    priorRole === "food" &&
    previousRole === "drink" &&
    currentRole === "dessert"

  if (mealDrinkFinish) {
    return 5
  }

  const sameFamilyThreeTimes =
    candidateFamilies.some(
      (family) =>
        previousFamilies.includes(family) &&
        priorFamilies.includes(family)
    )

  if (sameFamilyThreeTimes) {
    return -8
  }

  const samePrimaryTypeThreeTimes =
    candidateTypes.some((type) => {
      const previousTypes = normalizeVenueTypes(previous.type)
      const priorTypes = normalizeVenueTypes(prior.type)

      return (
        previousTypes.includes(type) &&
        priorTypes.includes(type)
      )
    })

  if (samePrimaryTypeThreeTimes) {
    return -10
  }

  return 0
}

// -----------------------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------------------

function calculateSequenceConfidence({
  hasPreviousVenue,
  candidateTypes,
  previousTypes,
  candidateVibes,
  previousVibes,
  selectedVenueCount,
  hasAssignedPreviousRole,
  energyEvidenceUsed,
}: {
  hasPreviousVenue: boolean
  candidateTypes: string[]
  previousTypes: string[]
  candidateVibes: string[]
  previousVibes: string[]
  selectedVenueCount: number
  hasAssignedPreviousRole: boolean
  energyEvidenceUsed: boolean
}): number {
  if (!hasPreviousVenue) {
    return 0.25
  }

  let confidence = 0.32

  if (candidateTypes.length > 0) confidence += 0.14
  if (previousTypes.length > 0) confidence += 0.14

  if (candidateVibes.length > 0) confidence += 0.08
  if (previousVibes.length > 0) confidence += 0.08

  if (hasAssignedPreviousRole) confidence += 0.08
  if (selectedVenueCount >= 2) confidence += 0.07

  /*
   * Partial energy coverage can raise confidence only slightly.
   */
  if (energyEvidenceUsed) confidence += 0.03

  return Number(clamp(confidence, 0, 0.99).toFixed(2))
}

function resolveSequenceConfidence({
  confidenceScore,
  hasPreviousVenue,
}: {
  confidenceScore: number
  hasPreviousVenue: boolean
}): SequenceFitConfidence {
  if (!hasPreviousVenue) return "insufficient"
  if (confidenceScore >= 0.75) return "high"
  if (confidenceScore >= 0.5) return "medium"
  return "low"
}

// -----------------------------------------------------------------------------
// Type-family helpers
// -----------------------------------------------------------------------------

function getTypeFamilies(types: string[]): string[] {
  const families: string[] = []

  if (
    hasAnyType(types, [
      "coffee",
      "cafe",
      "café",
      "tea",
      "matcha",
      "bakery",
      "breakfast",
    ])
  ) {
    families.push("coffee")
  }

  if (
    hasAnyType(types, [
      "restaurant",
      "dinner",
      "lunch",
      "brunch",
      "food",
      "food hall",
      "casual food",
      "fine dining",
    ])
  ) {
    families.push("meal")
  }

  if (
    hasAnyType(types, [
      "bar",
      "cocktail",
      "wine bar",
      "lounge",
      "speakeasy",
      "brewery",
      "pub",
      "rooftop",
      "hotel bar",
    ])
  ) {
    families.push("drinks")
  }

  if (
    hasAnyType(types, [
      "club",
      "late night",
      "music",
      "dance",
      "nightlife",
      "karaoke",
    ])
  ) {
    families.push("nightlife")
  }

  if (
    hasAnyType(types, [
      "gallery",
      "museum",
      "bookstore",
      "library",
      "showroom",
      "cinema",
      "theater",
      "lifestyle",
    ])
  ) {
    families.push("culture")
  }

  if (
    hasAnyType(types, [
      "park",
      "garden",
      "outdoor",
      "market",
      "patio",
    ])
  ) {
    families.push("outdoor")
  }

  if (
    hasAnyType(types, [
      "spa",
      "fitness",
      "wellness",
      "yoga",
      "pilates",
      "meditation",
    ])
  ) {
    families.push("wellness")
  }

  if (
    hasAnyType(types, [
      "dessert",
      "ice cream",
      "pastry",
      "sweets",
    ])
  ) {
    families.push("dessert")
  }

  if (
    hasAnyType(types, [
      "library",
      "bookstore",
      "spa",
      "tea",
      "gallery",
      "museum",
    ])
  ) {
    families.push("quiet")
  }

  if (families.length === 0 && types.length > 0) {
    families.push("other")
  }

  return uniqueStrings(families)
}

function countRepeatedTypeFamilies(
  candidateFamilies: string[],
  selectedSoFar: SequenceVenueLike[]
): number {
  if (
    candidateFamilies.length === 0 ||
    selectedSoFar.length === 0
  ) {
    return 0
  }

  return selectedSoFar.filter((selected) => {
    const selectedFamilies = getTypeFamilies(
      normalizeVenueTypes(selected.type)
    )

    return intersect(
      candidateFamilies,
      selectedFamilies
    ).length > 0
  }).length
}

function countRepeatedPrimaryTypes(
  candidateTypes: string[],
  selectedSoFar: SequenceVenueLike[]
): number {
  if (
    candidateTypes.length === 0 ||
    selectedSoFar.length === 0
  ) {
    return 0
  }

  return selectedSoFar.filter((selected) => {
    const selectedTypes = normalizeVenueTypes(selected.type)

    return intersect(
      candidateTypes,
      selectedTypes
    ).length > 0
  }).length
}

// -----------------------------------------------------------------------------
// Venue metadata helpers
// -----------------------------------------------------------------------------

function resolveSelectedRole(
  venue: SequenceVenueLike | null
): StopRole | null {
  if (!venue) return null

  if (isStopRole(venue.assignedRole)) {
    return venue.assignedRole
  }

  if (isStopRole(venue.slotRole)) {
    return venue.slotRole
  }

  if (
    Array.isArray(venue.inferredRoles) &&
    venue.inferredRoles.length === 1
  ) {
    return venue.inferredRoles[0]
  }

  return null
}

function resolveSelectedPhase(
  venue: SequenceVenueLike | null
): SlotPhase | null {
  if (!venue) return null

  if (venue.phase === "before" || venue.phase === "after") {
    return venue.phase
  }

  if (
    venue.slotPhase === "before" ||
    venue.slotPhase === "after"
  ) {
    return venue.slotPhase
  }

  return null
}

function readEnergyLevel(
  venue: SequenceVenueLike | null
): number | null {
  if (!venue) return null

  const rawValue = venue.energy_ramp

  if (
    typeof rawValue === "number" &&
    Number.isFinite(rawValue)
  ) {
    return clamp(rawValue, 1, 10)
  }

  if (typeof rawValue !== "string") {
    return null
  }

  const normalized = rawValue
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")

  if (!normalized) return null

  const numericValue = Number(normalized)

  if (Number.isFinite(numericValue)) {
    return clamp(numericValue, 1, 10)
  }

  const energyMap: Record<string, number> = {
    very_low: 1,
    "very low": 1,
    low: 2,
    calm: 2,
    quiet: 2,
    relaxed: 3,
    chill: 3,
    low_key: 3,
    "low key": 3,
    moderate: 5,
    medium: 5,
    balanced: 5,
    lively: 7,
    social: 7,
    energetic: 8,
    high: 8,
    high_energy: 9,
    "high energy": 9,
    party: 9,
    peak: 10,
  }

  return energyMap[normalized] ?? null
}

// -----------------------------------------------------------------------------
// Generic helpers
// -----------------------------------------------------------------------------

function normalizeValues(
  value: string[] | string | null | undefined
): string[] {
  return uniqueStrings(
    normalizeStringArray(value)
      .flatMap((entry) =>
        String(entry)
          .toLowerCase()
          .split(/[,/|;]+/)
      )
      .map((entry) =>
        entry
          .trim()
          .replace(/[_-]+/g, " ")
      )
      .filter(Boolean)
  )
}

function intersect(
  first: string[],
  second: string[]
): string[] {
  if (
    first.length === 0 ||
    second.length === 0
  ) {
    return []
  }

  const secondSet = new Set(second)

  return uniqueStrings(
    first.filter((value) => secondSet.has(value))
  )
}

function hasAnyValue(
  values: string[],
  expected: string[]
): boolean {
  const valueSet = new Set(values)

  return expected.some((value) =>
    valueSet.has(
      value
        .toLowerCase()
        .replace(/[_-]+/g, " ")
    )
  )
}

function isStopRole(
  value: unknown
): value is StopRole {
  return (
    value === "coffee" ||
    value === "food" ||
    value === "drink" ||
    value === "activity" ||
    value === "dessert"
  )
}

function normalizeArchetype(
  archetype: string | null | undefined
): string {
  if (archetype === "art") return "arts_culture"
  if (archetype === "sports") return "social_sports"
  if (archetype === "festival") return "market"
  if (archetype === "general") return "other"

  return archetype ?? "other"
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