// lib/outings/sequenceScoring/transitions.ts

import type {
  PlanningContext,
  PlanningSlot,
  StopRole,
  VenueRecord,
} from "../types"

import {
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
} from "./helpers"

import {
  getDistanceBetweenVenues,
} from "./geometry"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type TransitionVenue = Pick<
  VenueRecord,
  | "id"
  | "name"
  | "type"
  | "tags"
  | "vibe"
  | "time_category"
  | "lat"
  | "lon"
  | "energy_ramp"
> & {
  inferredRoles?: StopRole[]
  distanceMeters?: number | null
}

export type TransitionScoreBreakdown = {
  roleProgression: number
  typeProgression: number
  semanticContinuity: number
  timeCompatibility: number
  phaseCompatibility: number
  distanceContinuity: number
  energyContinuity: number
  duplicationPenalty: number
  clashPenalty: number
}

export type TransitionScoreResult = {
  score: number
  breakdown: TransitionScoreBreakdown
  reasons: string[]
  previousToCandidateDistanceMeters: number | null
  isHardConflict: boolean
}

export type ComputeTransitionScoreInput = {
  previous: TransitionVenue | null
  candidate: TransitionVenue
  slot: PlanningSlot
  context: PlanningContext
}

// -----------------------------------------------------------------------------
// Main transition scorer
// -----------------------------------------------------------------------------

export function computeTransitionScore({
  previous,
  candidate,
  slot,
  context,
}: ComputeTransitionScoreInput): TransitionScoreResult {
  if (!previous) {
    return emptyTransitionResult()
  }

  const previousTypes = normalizeVenueTypes(previous.type)
  const candidateTypes = normalizeVenueTypes(candidate.type)

  const previousTags = normalizeVenueTokens(previous)
  const candidateTags = normalizeVenueTokens(candidate)

  const previousRoles = previous.inferredRoles ?? []
  const candidateRoles = candidate.inferredRoles ?? []

  const referenceHour = getHourFractionInTimeZone(
    slot.targetArrivalAt,
    resolvePlannerTimeZone(context)
  )

  const previousToCandidateDistanceMeters =
    getDistanceBetweenVenues(previous, candidate)

  const reasons: string[] = []

  const roleProgression = scoreRoleProgression({
    previousRoles,
    candidateRoles,
    slotRole: slot.role,
    slotPhase: slot.phase,
    referenceHour,
    reasons,
  })

  const typeProgression = scoreTypeProgression({
    previousTypes,
    candidateTypes,
    slot,
    context,
    referenceHour,
    reasons,
  })

  const semanticContinuity = scoreSemanticContinuity({
    previousTokens: previousTags,
    candidateTokens: candidateTags,
    reasons,
  })

  const timeCompatibility = scoreTransitionTimeCompatibility({
    previous,
    candidate,
    previousTypes,
    candidateTypes,
    referenceHour,
    slot,
    reasons,
  })

  const phaseCompatibility = scorePhaseCompatibility({
    previousTypes,
    candidateTypes,
    slot,
    context,
    reasons,
  })

  const distanceContinuity = scoreDistanceContinuity({
    distanceMeters: previousToCandidateDistanceMeters,
    slot,
    context,
    reasons,
  })

  const energyContinuity = scoreEnergyContinuity({
    previous,
    candidate,
    slot,
    reasons,
  })

  const duplicationPenalty = scoreDuplicationPenalty({
    previousTypes,
    candidateTypes,
    previousRoles,
    candidateRoles,
    previousTokens: previousTags,
    candidateTokens: candidateTags,
    reasons,
  })

  const clashPenalty = scoreTransitionClashPenalty({
    previousTypes,
    candidateTypes,
    previousTokens: previousTags,
    candidateTokens: candidateTags,
    slot,
    referenceHour,
    reasons,
  })

  const breakdown: TransitionScoreBreakdown = {
    roleProgression,
    typeProgression,
    semanticContinuity,
    timeCompatibility,
    phaseCompatibility,
    distanceContinuity,
    energyContinuity,
    duplicationPenalty,
    clashPenalty,
  }

  const rawScore =
    roleProgression +
    typeProgression +
    semanticContinuity +
    timeCompatibility +
    phaseCompatibility +
    distanceContinuity +
    energyContinuity -
    duplicationPenalty -
    clashPenalty

  const isHardConflict =
    clashPenalty >= 24 ||
    distanceContinuity <= -24 ||
    timeCompatibility <= -24

  return {
    score: clamp(rawScore, -40, 40),
    breakdown,
    reasons: uniqueStrings(reasons),
    previousToCandidateDistanceMeters,
    isHardConflict,
  }
}

// -----------------------------------------------------------------------------
// Role progression
// -----------------------------------------------------------------------------

function scoreRoleProgression({
  previousRoles,
  candidateRoles,
  slotRole,
  slotPhase,
  referenceHour,
  reasons,
}: {
  previousRoles: StopRole[]
  candidateRoles: StopRole[]
  slotRole: StopRole
  slotPhase: "before" | "after"
  referenceHour: number
  reasons: string[]
}): number {
  const previousPrimaryRole = previousRoles[0] ?? null
  const candidateMatchesSlot = candidateRoles.includes(slotRole)

  let score = 0

  if (candidateMatchesSlot) {
    score += 8
    reasons.push("candidate role matches the intended slot")
  }

  if (!previousPrimaryRole) {
    return score
  }

  if (
    previousPrimaryRole === "coffee" &&
    candidateRoles.some((role) => role === "food")
  ) {
    score += referenceHour < 16 ? 10 : 4
    reasons.push("coffee naturally progresses into food")
  }

  if (
    previousPrimaryRole === "food" &&
    candidateRoles.some((role) => role === "drink")
  ) {
    score += referenceHour >= 16 ? 12 : 5
    reasons.push("meal-to-drink progression is coherent")
  }

  if (
    previousPrimaryRole === "drink" &&
    candidateRoles.some((role) => role === "food")
  ) {
    score += slotPhase === "after" ? 9 : 5
    reasons.push("drink-to-food progression provides a practical next step")
  }

  if (
    previousPrimaryRole === "drink" &&
    candidateRoles.some((role) => role === "dessert")
  ) {
    score += 8
    reasons.push("drink-to-dessert progression creates a softer close")
  }

  if (
    previousPrimaryRole === "activity" &&
    candidateRoles.some((role) => role === "food" || role === "drink")
  ) {
    score += 8
    reasons.push("activity-to-hospitality progression is natural")
  }

  if (
    previousPrimaryRole === "food" &&
    candidateRoles.some((role) => role === "activity")
  ) {
    score += slotPhase === "before" ? 5 : 1
  }

  if (
    previousPrimaryRole === slotRole &&
    candidateRoles.includes(slotRole)
  ) {
    score -= 7
    reasons.push("the transition repeats the same functional role")
  }

  return clamp(score, -12, 16)
}

// -----------------------------------------------------------------------------
// Type progression
// -----------------------------------------------------------------------------

function scoreTypeProgression({
  previousTypes,
  candidateTypes,
  slot,
  context,
  referenceHour,
  reasons,
}: {
  previousTypes: string[]
  candidateTypes: string[]
  slot: PlanningSlot
  context: PlanningContext
  referenceHour: number
  reasons: string[]
}): number {
  let score = 0

  const previousIsMeal = hasAny(previousTypes, MEAL_TYPES)
  const candidateIsMeal = hasAny(candidateTypes, MEAL_TYPES)

  const previousIsDrink = hasAny(previousTypes, DRINK_TYPES)
  const candidateIsDrink = hasAny(candidateTypes, DRINK_TYPES)

  const previousIsCoffee = hasAny(previousTypes, COFFEE_TYPES)
  const candidateIsCoffee = hasAny(candidateTypes, COFFEE_TYPES)

  const previousIsCulture = hasAny(previousTypes, CULTURE_TYPES)
  const candidateIsCulture = hasAny(candidateTypes, CULTURE_TYPES)

  const previousIsOutdoor = hasAny(previousTypes, OUTDOOR_TYPES)
  const candidateIsOutdoor = hasAny(candidateTypes, OUTDOOR_TYPES)

  if (previousIsCoffee && candidateIsMeal) {
    score += 10
    reasons.push("venue types support a coffee-to-meal progression")
  }

  if (previousIsMeal && candidateIsDrink) {
    score += 12
    reasons.push("venue types support a meal-to-drink progression")
  }

  if (previousIsDrink && candidateIsMeal) {
    score += slot.phase === "after" ? 9 : 5
  }

  if (previousIsCulture && (candidateIsMeal || candidateIsDrink)) {
    score += 8
    reasons.push("the route transitions from an experience into hospitality")
  }

  if (
    previousIsMeal &&
    candidateIsCulture &&
    slot.phase === "before" &&
    referenceHour < 19
  ) {
    score += 5
  }

  if (
    previousIsOutdoor &&
    candidateIsMeal &&
    referenceHour < 18
  ) {
    score += 6
  }

  if (
    previousIsMeal &&
    candidateIsOutdoor &&
    referenceHour >= 18
  ) {
    score -= 18
    reasons.push("an evening meal-to-outdoor transition is contextually weak")
  }

  if (
    context.eventArchetype === "nightlife" &&
    slot.phase === "before" &&
    candidateIsDrink
  ) {
    score += 5
  }

  if (
    context.eventArchetype === "arts_culture" &&
    previousIsCulture &&
    candidateIsCulture
  ) {
    score += 3
  }

  if (
    previousIsCoffee &&
    candidateIsCoffee
  ) {
    score -= 12
    reasons.push("the transition duplicates coffee-oriented venue types")
  }

  if (
    previousIsMeal &&
    candidateIsMeal
  ) {
    score -= 10
    reasons.push("the transition duplicates meal-oriented venue types")
  }

  if (
    previousIsDrink &&
    candidateIsDrink
  ) {
    score -= slot.phase === "after" ? 3 : 7
  }

  if (
    previousIsCulture &&
    candidateIsCulture
  ) {
    score -= context.eventArchetype === "arts_culture" ? 1 : 7
  }

  return clamp(score, -24, 18)
}

// -----------------------------------------------------------------------------
// Semantic continuity
// -----------------------------------------------------------------------------

function scoreSemanticContinuity({
  previousTokens,
  candidateTokens,
  reasons,
}: {
  previousTokens: string[]
  candidateTokens: string[]
  reasons: string[]
}): number {
  if (
    previousTokens.length === 0 ||
    candidateTokens.length === 0
  ) {
    return 0
  }

  const previousSet = new Set(previousTokens)
  const sharedTokens = candidateTokens.filter((token) =>
    previousSet.has(token)
  )

  const meaningfulSharedTokens = sharedTokens.filter(
    (token) => !GENERIC_TOKENS.has(token)
  )

  if (meaningfulSharedTokens.length === 0) {
    return 0
  }

  const score = Math.min(meaningfulSharedTokens.length, 4) * 2

  reasons.push(
    `venues share contextual signals: ${meaningfulSharedTokens
      .slice(0, 3)
      .join(", ")}`
  )

  return score
}

// -----------------------------------------------------------------------------
// Time compatibility
// -----------------------------------------------------------------------------

function scoreTransitionTimeCompatibility({
  previous,
  candidate,
  previousTypes,
  candidateTypes,
  referenceHour,
  slot,
  reasons,
}: {
  previous: TransitionVenue
  candidate: TransitionVenue
  previousTypes: string[]
  candidateTypes: string[]
  referenceHour: number
  slot: PlanningSlot
  reasons: string[]
}): number {
  let score = 0

  const candidateTimeCategories = normalizeStringArray(
    candidate.time_category
  )

  const previousTimeCategories = normalizeStringArray(
    previous.time_category
  )

  const currentDaypart = getTransitionDaypart(referenceHour)

  if (candidateTimeCategories.includes(currentDaypart)) {
    score += 8
    reasons.push("candidate aligns with the current daypart")
  }

  if (
    candidateTimeCategories.length > 0 &&
    !candidateTimeCategories.includes(currentDaypart)
  ) {
    score -= 10
  }

  if (
    previousTimeCategories.includes(currentDaypart) &&
    candidateTimeCategories.includes(currentDaypart)
  ) {
    score += 3
  }

  if (
    referenceHour >= 18 &&
    hasAny(candidateTypes, OUTDOOR_TYPES)
  ) {
    score -= 18
    reasons.push("outdoor venue type is weak for the evening slot")
  }

  if (
    referenceHour >= 21 &&
    hasAny(candidateTypes, DAYTIME_ONLY_TYPES)
  ) {
    score -= 24
    reasons.push("candidate is strongly mismatched with a late slot")
  }

  if (
    referenceHour < 11 &&
    hasAny(candidateTypes, LATE_NIGHT_TYPES)
  ) {
    score -= 24
  }

  if (
    slot.phase === "after" &&
    referenceHour >= 21 &&
    hasAny(candidateTypes, NIGHT_COMPATIBLE_TYPES)
  ) {
    score += 8
  }

  if (
    referenceHour >= 18 &&
    hasAny(previousTypes, MEAL_TYPES) &&
    hasAny(candidateTypes, DRINK_TYPES)
  ) {
    score += 5
  }

  return clamp(score, -28, 16)
}

// -----------------------------------------------------------------------------
// Phase compatibility
// -----------------------------------------------------------------------------

function scorePhaseCompatibility({
  previousTypes,
  candidateTypes,
  slot,
  context,
  reasons,
}: {
  previousTypes: string[]
  candidateTypes: string[]
  slot: PlanningSlot
  context: PlanningContext
  reasons: string[]
}): number {
  let score = 0

  if (slot.phase === "before") {
    if (
      hasAny(previousTypes, MEAL_TYPES) &&
      hasAny(candidateTypes, DRINK_TYPES)
    ) {
      score += 6
    }

    if (
      context.eventArchetype === "nightlife" &&
      hasAny(candidateTypes, NIGHT_COMPATIBLE_TYPES)
    ) {
      score += 6
      reasons.push("candidate supports the lead-in to a nightlife event")
    }

    if (
      context.eventArchetype === "wellness" &&
      hasAny(candidateTypes, HIGH_STIMULATION_TYPES)
    ) {
      score -= 18
    }
  }

  if (slot.phase === "after") {
    if (
      hasAny(candidateTypes, COFFEE_TYPES) &&
      getHourFractionInTimeZone(
        slot.targetArrivalAt,
        resolvePlannerTimeZone(context)
      ) >= 20
    ) {
      score -= 12
    }

    if (
      hasAny(candidateTypes, DRINK_TYPES) ||
      hasAny(candidateTypes, DESSERT_TYPES) ||
      hasAny(candidateTypes, LATE_NIGHT_FOOD_TYPES)
    ) {
      score += 6
    }
  }

  return clamp(score, -20, 12)
}

// -----------------------------------------------------------------------------
// Distance continuity
// -----------------------------------------------------------------------------

function scoreDistanceContinuity({
  distanceMeters,
  slot,
  context,
  reasons,
}: {
  distanceMeters: number | null
  slot: PlanningSlot
  context: PlanningContext
  reasons: string[]
}): number {
  if (distanceMeters == null) return 0

  const strictLimit =
    slot.phase === "before"
      ? context.cityPlanning?.distances.beforeInterstopMeters.strict ??
        defaultBeforeStrictLimit(context)
      : context.cityPlanning?.distances.afterInterstopMeters.strict ??
        defaultAfterStrictLimit(context)

  const relaxedLimit =
    slot.phase === "before"
      ? context.cityPlanning?.distances.beforeInterstopMeters.relaxed ??
        defaultBeforeRelaxedLimit(context)
      : context.cityPlanning?.distances.afterInterstopMeters.relaxed ??
        defaultAfterRelaxedLimit(context)

  if (distanceMeters <= strictLimit * 0.5) {
    reasons.push("transition is very compact")
    return 10
  }

  if (distanceMeters <= strictLimit) {
    return 6
  }

  if (distanceMeters <= relaxedLimit) {
    return -4
  }

  reasons.push("transition exceeds the relaxed inter-stop distance")
  return -28
}

// -----------------------------------------------------------------------------
// Energy continuity
// -----------------------------------------------------------------------------

function scoreEnergyContinuity({
  previous,
  candidate,
  slot,
  reasons,
}: {
  previous: TransitionVenue
  candidate: TransitionVenue
  slot: PlanningSlot
  reasons: string[]
}): number {
  const previousEnergy = normalizeEnergyRamp(previous.energy_ramp)
  const candidateEnergy = normalizeEnergyRamp(candidate.energy_ramp)

  if (
    previousEnergy == null ||
    candidateEnergy == null
  ) {
    return 0
  }

  const difference = candidateEnergy - previousEnergy

  // energy_ramp is intentionally low-weight because coverage is incomplete.
  if (slot.phase === "before") {
    if (difference >= 0 && difference <= 1) {
      reasons.push("energy gently builds toward the event")
      return 3
    }

    if (difference < -1) {
      return -3
    }

    if (difference > 2) {
      return -2
    }
  }

  if (slot.phase === "after") {
    if (difference >= -1 && difference <= 1) {
      return 2
    }

    if (difference > 2) {
      return -2
    }

    if (difference < -2) {
      return -2
    }
  }

  return 0
}

// -----------------------------------------------------------------------------
// Duplication and clash penalties
// -----------------------------------------------------------------------------

function scoreDuplicationPenalty({
  previousTypes,
  candidateTypes,
  previousRoles,
  candidateRoles,
  previousTokens,
  candidateTokens,
  reasons,
}: {
  previousTypes: string[]
  candidateTypes: string[]
  previousRoles: StopRole[]
  candidateRoles: StopRole[]
  previousTokens: string[]
  candidateTokens: string[]
  reasons: string[]
}): number {
  let penalty = 0

  const sharedTypes = countShared(previousTypes, candidateTypes)
  const sharedRoles = countShared(previousRoles, candidateRoles)
  const sharedTokens = countShared(
    previousTokens.filter((token) => !GENERIC_TOKENS.has(token)),
    candidateTokens.filter((token) => !GENERIC_TOKENS.has(token))
  )

  if (sharedTypes >= 2) {
    penalty += 6
  }

  if (
    sharedRoles >= 1 &&
    sharedTypes >= 1
  ) {
    penalty += 5
  }

  if (sharedTokens >= 5) {
    penalty += 4
  }

  if (penalty >= 8) {
    reasons.push("the candidate is too similar to the previous stop")
  }

  return clamp(penalty, 0, 16)
}

function scoreTransitionClashPenalty({
  previousTypes,
  candidateTypes,
  previousTokens,
  candidateTokens,
  slot,
  referenceHour,
  reasons,
}: {
  previousTypes: string[]
  candidateTypes: string[]
  previousTokens: string[]
  candidateTokens: string[]
  slot: PlanningSlot
  referenceHour: number
  reasons: string[]
}): number {
  let penalty = 0

  const previousQuiet =
    hasAny(previousTypes, QUIET_TYPES) ||
    hasAny(previousTokens, QUIET_TOKENS)

  const candidateHighEnergy =
    hasAny(candidateTypes, HIGH_STIMULATION_TYPES) ||
    hasAny(candidateTokens, HIGH_ENERGY_TOKENS)

  const previousHighEnergy =
    hasAny(previousTypes, HIGH_STIMULATION_TYPES) ||
    hasAny(previousTokens, HIGH_ENERGY_TOKENS)

  const candidateQuiet =
    hasAny(candidateTypes, QUIET_TYPES) ||
    hasAny(candidateTokens, QUIET_TOKENS)

  if (
    previousQuiet &&
    candidateHighEnergy
  ) {
    penalty += 10
    reasons.push("transition jumps abruptly from quiet to high stimulation")
  }

  if (
    previousHighEnergy &&
    candidateQuiet &&
    slot.phase === "before"
  ) {
    penalty += 8
  }

  if (
    referenceHour >= 18 &&
    hasAny(candidateTypes, OUTDOOR_TYPES)
  ) {
    penalty += 12
  }

  if (
    hasAny(previousTypes, WELLNESS_TYPES) &&
    hasAny(candidateTypes, HIGH_STIMULATION_TYPES)
  ) {
    penalty += 14
  }

  if (
    hasAny(previousTypes, COFFEE_TYPES) &&
    hasAny(candidateTypes, LATE_NIGHT_TYPES) &&
    referenceHour < 17
  ) {
    penalty += 10
  }

  return clamp(penalty, 0, 30)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function emptyTransitionResult(): TransitionScoreResult {
  return {
    score: 0,
    breakdown: {
      roleProgression: 0,
      typeProgression: 0,
      semanticContinuity: 0,
      timeCompatibility: 0,
      phaseCompatibility: 0,
      distanceContinuity: 0,
      energyContinuity: 0,
      duplicationPenalty: 0,
      clashPenalty: 0,
    },
    reasons: [],
    previousToCandidateDistanceMeters: null,
    isHardConflict: false,
  }
}

function normalizeVenueTokens(
  venue: Pick<
    TransitionVenue,
    "type" | "tags" | "vibe"
  >
): string[] {
  return uniqueStrings([
    ...normalizeStringArray(venue.type),
    ...normalizeStringArray(venue.tags),
    ...normalizeStringArray(venue.vibe),
  ])
}

function normalizeEnergyRamp(
  value: string | number | null | undefined
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(value, 0, 5)
  }

  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (!normalized) return null

  const numeric = Number(normalized)

  if (Number.isFinite(numeric)) {
    return clamp(numeric, 0, 5)
  }

  if (
    normalized === "very low" ||
    normalized === "very_low"
  ) {
    return 1
  }

  if (normalized === "low") {
    return 2
  }

  if (
    normalized === "medium" ||
    normalized === "moderate"
  ) {
    return 3
  }

  if (normalized === "high") {
    return 4
  }

  if (
    normalized === "very high" ||
    normalized === "very_high"
  ) {
    return 5
  }

  return null
}

function getTransitionDaypart(
  referenceHour: number
): string {
  if (referenceHour < 8) return "early_morning"
  if (referenceHour < 11) return "morning"
  if (referenceHour < 14) return "midday"
  if (referenceHour < 17) return "afternoon"
  if (referenceHour < 22) return "evening"

  return "late_night"
}

function defaultBeforeStrictLimit(
  context: PlanningContext
): number {
  if (context.mobility === "walk") return 1800
  if (context.mobility === "short_ride") return 3200
  return 5000
}

function defaultBeforeRelaxedLimit(
  context: PlanningContext
): number {
  if (context.mobility === "walk") return 2400
  if (context.mobility === "short_ride") return 4500
  return 6500
}

function defaultAfterStrictLimit(
  context: PlanningContext
): number {
  if (context.mobility === "walk") return 1000
  if (context.mobility === "short_ride") return 1800
  return 2800
}

function defaultAfterRelaxedLimit(
  context: PlanningContext
): number {
  if (context.mobility === "walk") return 1500
  if (context.mobility === "short_ride") return 2600
  return 4000
}

function hasAny<T extends string>(
  values: T[],
  expected: readonly string[]
): boolean {
  if (
    values.length === 0 ||
    expected.length === 0
  ) {
    return false
  }

  const expectedSet = new Set(expected)

  return values.some((value) =>
    expectedSet.has(value)
  )
}

function countShared<T extends string>(
  first: T[],
  second: T[]
): number {
  if (
    first.length === 0 ||
    second.length === 0
  ) {
    return 0
  }

  const secondSet = new Set(second)

  return Array.from(new Set(first)).filter((value) =>
    secondSet.has(value)
  ).length
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.max(minimum, Math.min(maximum, value))
}

// -----------------------------------------------------------------------------
// Venue families
// -----------------------------------------------------------------------------

const COFFEE_TYPES = [
  "coffee",
  "cafe",
  "café",
  "tea",
  "matcha",
  "bakery",
  "breakfast",
]

const MEAL_TYPES = [
  "restaurant",
  "food",
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "casual food",
  "food hall",
]

const DRINK_TYPES = [
  "bar",
  "cocktail",
  "wine bar",
  "lounge",
  "speakeasy",
  "brewery",
  "pub",
  "rooftop",
  "hotel bar",
]

const DESSERT_TYPES = [
  "dessert",
  "bakery",
  "ice cream",
  "gelato",
]

const CULTURE_TYPES = [
  "gallery",
  "museum",
  "bookstore",
  "library",
  "showroom",
  "lifestyle",
  "theater",
  "cinema",
]

const OUTDOOR_TYPES = [
  "park",
  "garden",
  "green space",
  "outdoor",
  "trail",
]

const WELLNESS_TYPES = [
  "wellness",
  "spa",
  "yoga",
  "pilates",
  "fitness",
  "meditation",
]

const QUIET_TYPES = [
  "library",
  "bookstore",
  "museum",
  "gallery",
  "spa",
  "tea",
]

const HIGH_STIMULATION_TYPES = [
  "club",
  "sports bar",
  "dive bar",
  "music",
  "karaoke",
  "nightclub",
]

const LATE_NIGHT_TYPES = [
  "club",
  "nightclub",
  "late night",
  "speakeasy",
  "bar",
]

const LATE_NIGHT_FOOD_TYPES = [
  "late night",
  "restaurant",
  "diner",
  "food",
]

const NIGHT_COMPATIBLE_TYPES = [
  ...DRINK_TYPES,
  ...DESSERT_TYPES,
  ...LATE_NIGHT_FOOD_TYPES,
  "club",
  "nightclub",
]

const DAYTIME_ONLY_TYPES = [
  "breakfast",
  "brunch",
  "library",
  "market",
  "park",
  "garden",
  "yoga",
  "pilates",
]

const QUIET_TOKENS = [
  "quiet",
  "calm",
  "relaxed",
  "peaceful",
  "intimate",
  "cozy",
  "low-key",
  "lowkey",
  "serene",
]

const HIGH_ENERGY_TOKENS = [
  "high-energy",
  "energetic",
  "lively",
  "party",
  "rowdy",
  "loud",
  "hype",
  "electric",
  "buzzy",
]

const GENERIC_TOKENS = new Set([
  "restaurant",
  "bar",
  "food",
  "drink",
  "venue",
  "local",
  "atlanta",
  "atl",
  "social",
  "casual",
  "popular",
])