// lib/outings/sequenceScoring/bias.ts

import type { Budget, Mobility, PlanningContext, PlanningSlot, StopRole, VenueRecord } from "../types"
import {
  getDiscouragedTypesForGroupSize,
  getPreferredTypesForGroupSize,
} from "../groupSizePresets"
import {
  expandVibeTags,
  getDiscouragedTypesForVibe,
  getPreferredTypesForVibe,
} from "../vibePresets"
import {
  hasAnyType,
  isCoffeeLikeVenue,
  isMealLikeVenue,
  normalizePrice,
  normalizeStringArray,
  normalizeVenueTypes,
  priceToInt,
  uniqueStrings,
} from "./helpers"
import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"
import {
  getDistanceBetweenVenues,
  getMaxAfterInterstopMeters,
  getMaxAfterLocalFallbackMeters,
  isAfterSequenceDirectionallyConsistent,
} from "./geometry"
import { isLateNightAfterFallbackContext } from "./lateNight"

type CandidateVenueLike = VenueRecord & {
  inferredRoles: StopRole[]
  distanceMeters: number | null
  score: number
}

const SOCIAL_SPORTS_DAYTIME_TYPES = [
  "coffee",
  "cafe",
  "café",
  "bakery",
  "breakfast",
  "brunch",
  "tea",
  "juice",
  "matcha",
  "lunch",
  "restaurant",
  "patio",
  "market",
]

const SOCIAL_SPORTS_GROUP_TYPES = [
  "sports bar",
  "bar",
  "brewery",
  "pub",
  "beer garden",
  "restaurant",
  "lunch",
  "brunch",
  "casual food",
  "patio",
]

const SOCIAL_SPORTS_BAD_MORNING_TYPES = [
  "club",
  "speakeasy",
  "dive bar",
  "late night",
  "fine dining",
  "spa",
  "library",
  "showroom",
]

export function computeSequentialCandidateScore<TCandidate extends CandidateVenueLike>(
  candidate: TCandidate,
  selectedSoFar: TCandidate[],
  slot: PlanningSlot,
  context: PlanningContext
): number {
  let score = candidate.score
  const anchorDistance = candidate.distanceMeters
  const previous = selectedSoFar[selectedSoFar.length - 1] ?? null
  const previousAnchorDistance = previous?.distanceMeters ?? null
  const previousToCandidateDistance =
    previous != null ? getDistanceBetweenVenues(previous, candidate) : null

  if (slot.phase === "before") {
    if (slot.index === 0) {
      score += computeBeforeFirstStopDistanceBonus(anchorDistance, context.mobility)
    } else {
      score += computeBeforeProgressionBonus(
        anchorDistance,
        previousAnchorDistance,
        previousToCandidateDistance
      )
      score += computeBeforeConsumptionProgressionScore(previous, candidate)
    }
  }

  if (slot.phase === "after") {
    const isImmediatePostEvent =
      slot.index === 0 || (context.mode === "full" && slot.index === 1)

    if (isImmediatePostEvent) {
      score += computeAfterFirstStopDistanceBonus(anchorDistance, context.mobility)
    } else {
      score += computeAfterExpansionBonus(
        previousToCandidateDistance,
        anchorDistance,
        context.mobility,
        context
      )
      score += computeAfterDirectionalConsistencyBonus(
        selectedSoFar,
        candidate,
        context,
        slot,
        previousToCandidateDistance
      )
    }
  }

  score += computeVenueSequenceCoherenceScore(previous, candidate, slot, context)
  score += computeModeSpecificVenueBias(candidate, slot, context)
  score += scoreArchetypeFit(candidate, context, slot)
  score += computePhaseAwarePreferenceBias(candidate, slot, context)

  return score
}

export function computeBeforeFirstStopDistanceBonus(
  anchorDistance: number | null,
  mobility: Mobility
): number {
  if (anchorDistance == null) return 0

  if (mobility === "walk") {
    if (anchorDistance >= 250 && anchorDistance <= 1000) return 18
    if (anchorDistance <= 1400) return 8
    return -30
  }

  if (mobility === "short_ride") {
    if (anchorDistance >= 400 && anchorDistance <= 1800) return 20
    if (anchorDistance <= 2600) return 8
    return -24
  }

  if (anchorDistance <= 2800) return 12
  if (anchorDistance <= 4000) return 4
  return -16
}

export function computeBeforeProgressionBonus(
  anchorDistance: number | null,
  previousAnchorDistance: number | null,
  previousToCandidateDistance: number | null
): number {
  let score = 0
  if (anchorDistance == null || previousAnchorDistance == null) return score

  if (anchorDistance < previousAnchorDistance - 200) score += 24
  else if (anchorDistance <= previousAnchorDistance + 100) score += 6
  else score -= 26

  if (previousToCandidateDistance != null) {
    if (previousToCandidateDistance < 1000) score += 8
    else if (previousToCandidateDistance < 2000) score += 3
    else if (previousToCandidateDistance > 3200) score -= 14
  }

  return score
}

export function computeBeforeConsumptionProgressionScore<
  TCandidate extends Pick<VenueRecord, "type">
>(
  previous: TCandidate | null,
  candidate: TCandidate
): number {
  if (!previous) return 0

  const previousTypes = normalizeVenueTypes(previous.type)
  const candidateTypes = normalizeVenueTypes(candidate.type)

  const previousIsCoffeeLike = isCoffeeLikeVenue(previousTypes)
  const previousIsMealLike = isMealLikeVenue(previousTypes)
  const candidateIsCoffeeLike = isCoffeeLikeVenue(candidateTypes)
  const candidateIsMealLike = isMealLikeVenue(candidateTypes)

  let score = 0

  if (previousIsCoffeeLike && candidateIsMealLike) score += 10
  if (previousIsCoffeeLike && candidateIsCoffeeLike) score -= 18
  if (previousIsMealLike && candidateIsCoffeeLike) score -= 22

  return score
}

export function computeAfterFirstStopDistanceBonus(
  anchorDistance: number | null,
  mobility: Mobility
): number {
  if (anchorDistance == null) return 0

  if (mobility === "walk") {
    if (anchorDistance < 700) return 26
    if (anchorDistance < 1200) return 16
    if (anchorDistance < 1800) return 4
    return -28
  }

  if (mobility === "short_ride") {
    if (anchorDistance < 1200) return 24
    if (anchorDistance < 2200) return 14
    if (anchorDistance < 3200) return 4
    return -24
  }

  if (anchorDistance < 1800) return 18
  if (anchorDistance < 3000) return 8
  if (anchorDistance < 4500) return 2
  return -14
}

export function computeAfterExpansionBonus(
  previousToCandidateDistance: number | null,
  anchorDistance: number | null,
  mobility: Mobility,
  context?: PlanningContext
): number {
  let score = 0

  if (previousToCandidateDistance != null) {
    const strictMax = getMaxAfterInterstopMeters(mobility, false, context)

    if (previousToCandidateDistance <= strictMax * 0.5) score += 12
    else if (previousToCandidateDistance <= strictMax * 0.8) score += 6
    else if (previousToCandidateDistance > strictMax) score -= 30
  }

  if (anchorDistance != null && anchorDistance > 6000) score -= 10
  return score
}

export function computeAfterDirectionalConsistencyBonus<
  TCandidate extends VenueRecord & { distanceMeters?: number | null }
>(
  selectedSoFar: TCandidate[],
  candidate: TCandidate,
  context: PlanningContext,
  slot: PlanningSlot,
  previousToCandidateDistance: number | null
): number {
  const maxLocalFallbackMeters = getMaxAfterLocalFallbackMeters(
    context.mobility,
    context
  )
  const previous = selectedSoFar[selectedSoFar.length - 1] ?? null

  if (
    previousToCandidateDistance != null &&
    previousToCandidateDistance <= maxLocalFallbackMeters
  ) {
    if (
      previous?.distanceMeters != null &&
      candidate.distanceMeters != null &&
      candidate.distanceMeters + 250 < previous.distanceMeters
    ) {
      return -8
    }

    return 8
  }

  if (isAfterSequenceDirectionallyConsistent(selectedSoFar, candidate, context, slot)) {
    return 12
  }

  return -24
}

export function computeVenueSequenceCoherenceScore(
  previous: Pick<VenueRecord, "type" | "tags" | "vibe"> | null,
  candidate: Pick<VenueRecord, "type" | "tags" | "vibe">,
  slot: PlanningSlot,
  context: PlanningContext
): number {
  if (!previous) return 0

  const previousTypes = normalizeVenueTypes(previous.type)
  const candidateTypes = normalizeVenueTypes(candidate.type)

  const previousVibes = normalizeStringArray(previous.vibe)
  const candidateVibes = normalizeStringArray(candidate.vibe)

  const previousTags = normalizeStringArray(previous.tags)
  const candidateTags = normalizeStringArray(candidate.tags)

  const sharedVibes = countSharedValues(previousVibes, candidateVibes)
  const sharedTags = countSharedValues(previousTags, candidateTags)
  const sharedTypes = countSharedValues(previousTypes, candidateTypes)

  let score = 0

  score += Math.min(sharedVibes, 3) * 5
  score += Math.min(sharedTags, 3) * 3
  score += Math.min(sharedTypes, 2) * 2

  score += computeCompatibleTypeFamilyBonus(previousTypes, candidateTypes, slot, context)
  score += computeSocialSportsSequenceBonus(previousTypes, candidateTypes, slot, context)
  score -= computeSequenceClashPenalty(previousTypes, candidateTypes, previousVibes, candidateVibes)

  if (context.vibeTags.length > 0) {
    const expandedVibeTags = expandVibeTags(context.vibeTags)
    const candidateAffinity = countSharedValues(
      uniqueStrings([...candidateTypes, ...candidateTags, ...candidateVibes]),
      expandedVibeTags
    )
    const previousAffinity = countSharedValues(
      uniqueStrings([...previousTypes, ...previousTags, ...previousVibes]),
      expandedVibeTags
    )

    if (candidateAffinity > 0 && previousAffinity > 0) {
      score += Math.min(candidateAffinity + previousAffinity, 4)
    }
  }

  return Math.max(-18, Math.min(22, score))
}

function countSharedValues(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0

  const bSet = new Set(b)
  return uniqueStrings(a).filter((value) => bSet.has(value)).length
}

function computeCompatibleTypeFamilyBonus(
  previousTypes: string[],
  candidateTypes: string[],
  slot: PlanningSlot,
  context: PlanningContext
): number {
  let score = 0
  const archetype = normalizeScoringArchetype(context.eventArchetype)

  const bothNightlife =
    hasAnyType(previousTypes, [
      "bar",
      "cocktail",
      "lounge",
      "speakeasy",
      "rooftop",
      "club",
      "wine bar",
      "brewery",
    ]) &&
    hasAnyType(candidateTypes, [
      "bar",
      "cocktail",
      "lounge",
      "speakeasy",
      "rooftop",
      "club",
      "wine bar",
      "brewery",
    ])

  const bothConversationFriendly =
    hasAnyType(previousTypes, [
      "coffee",
      "cafe",
      "café",
      "wine bar",
      "cocktail",
      "lounge",
      "hotel lobby",
      "social club",
      "bookstore",
    ]) &&
    hasAnyType(candidateTypes, [
      "coffee",
      "cafe",
      "café",
      "wine bar",
      "cocktail",
      "lounge",
      "hotel lobby",
      "social club",
      "bookstore",
    ])

  const bothCulture =
    hasAnyType(previousTypes, ["gallery", "museum", "bookstore", "library", "lifestyle"]) &&
    hasAnyType(candidateTypes, ["gallery", "museum", "bookstore", "library", "lifestyle"])

  const mealToDrink =
    hasAnyType(previousTypes, ["restaurant", "dinner", "lunch", "brunch"]) &&
    hasAnyType(candidateTypes, ["bar", "cocktail", "wine bar", "lounge", "dessert"])

  const drinkToMeal =
    hasAnyType(previousTypes, ["bar", "cocktail", "wine bar", "lounge", "rooftop"]) &&
    hasAnyType(candidateTypes, ["restaurant", "dinner", "late night", "dessert"])

  if (slot.phase === "after" && bothNightlife) score += 8
  if (slot.phase === "before" && (mealToDrink || drinkToMeal)) score += 7
  if (archetype === "networking" && bothConversationFriendly) score += 8
  if (archetype === "arts_culture" && bothCulture) score += 6
  if (archetype === "nightlife" && bothNightlife) score += 6
  if (archetype === "food_drink" && (mealToDrink || drinkToMeal)) score += 6

  return score
}

function computeSocialSportsSequenceBonus(
  previousTypes: string[],
  candidateTypes: string[],
  slot: PlanningSlot,
  context: PlanningContext
): number {
  if (normalizeScoringArchetype(context.eventArchetype) !== "social_sports") {
    return 0
  }

  const referenceHour = getHourFractionInTimeZone(
    slot.targetArrivalAt,
    resolvePlannerTimeZone(context)
  )

  const daytime = referenceHour < 17
  let score = 0

  const breakfastToMatchMeal =
    hasAnyType(previousTypes, ["coffee", "cafe", "café", "bakery", "breakfast", "tea"]) &&
    hasAnyType(candidateTypes, ["brunch", "lunch", "restaurant", "sports bar", "brewery", "pub"])

  const matchMealToSocial =
    hasAnyType(previousTypes, ["brunch", "lunch", "restaurant", "sports bar", "brewery", "pub"]) &&
    hasAnyType(candidateTypes, ["sports bar", "brewery", "bar", "pub", "patio", "beer garden", "restaurant"])

  const bothGroupCasual =
    hasAnyType(previousTypes, SOCIAL_SPORTS_GROUP_TYPES) &&
    hasAnyType(candidateTypes, SOCIAL_SPORTS_GROUP_TYPES)

  const bothDaytimeCompatible =
    hasAnyType(previousTypes, SOCIAL_SPORTS_DAYTIME_TYPES) &&
    hasAnyType(candidateTypes, SOCIAL_SPORTS_DAYTIME_TYPES)

  if (daytime && breakfastToMatchMeal) score += 10
  if (daytime && matchMealToSocial) score += 8
  if (daytime && bothDaytimeCompatible) score += 6
  if (bothGroupCasual) score += 7

  if (
    daytime &&
    hasAnyType(previousTypes, ["coffee", "breakfast", "bakery", "cafe", "café"]) &&
    hasAnyType(candidateTypes, ["club", "speakeasy", "late night"])
  ) {
    score -= 14
  }

  return score
}

function computeSequenceClashPenalty(
  previousTypes: string[],
  candidateTypes: string[],
  previousVibes: string[],
  candidateVibes: string[]
): number {
  let penalty = 0

  const previousQuiet =
    hasAnyType(previousTypes, ["library", "bookstore", "museum", "gallery", "spa"]) ||
    hasAnyType(previousVibes, ["quiet", "calm", "intimate", "relaxed"])

  const candidateHighEnergy =
    hasAnyType(candidateTypes, ["club", "sports bar", "dive bar"]) ||
    hasAnyType(candidateVibes, ["high-energy", "loud", "party", "rowdy"])

  const previousHighEnergy =
    hasAnyType(previousTypes, ["club", "sports bar", "dive bar"]) ||
    hasAnyType(previousVibes, ["high-energy", "loud", "party", "rowdy"])

  const candidateQuiet =
    hasAnyType(candidateTypes, ["library", "bookstore", "museum", "gallery", "spa"]) ||
    hasAnyType(candidateVibes, ["quiet", "calm", "intimate", "relaxed"])

  if (previousQuiet && candidateHighEnergy) penalty += 8
  if (previousHighEnergy && candidateQuiet) penalty += 8

  if (
    hasAnyType(previousTypes, ["wellness", "yoga", "pilates", "spa"]) &&
    hasAnyType(candidateTypes, ["club", "dive bar", "sports bar"])
  ) {
    penalty += 12
  }

  if (
    hasAnyType(previousTypes, ["coffee", "breakfast", "bakery"]) &&
    hasAnyType(candidateTypes, ["club", "speakeasy"])
  ) {
    penalty += 8
  }

  return penalty
}

export function computeModeSpecificVenueBias(
  candidate: Pick<VenueRecord, "type">,
  slot: PlanningSlot,
  context: PlanningContext
): number {
  const types = normalizeVenueTypes(candidate.type)
  const referenceHour = getHourFractionInTimeZone(
    slot.targetArrivalAt,
    resolvePlannerTimeZone(context)
  )

  if (isLateNightAfterFallbackContext(context, slot)) {
    if (hasAnyType(types, ["bar", "lounge", "club"])) return 26
    if (hasAnyType(types, ["cocktail", "speakeasy", "rooftop"])) return 18
    if (
      hasAnyType(types, [
        "coffee",
        "tea",
        "breakfast",
        "lunch",
        "gallery",
        "museum",
        "library",
      ])
    ) {
      return -30
    }
  }

  if (normalizeScoringArchetype(context.eventArchetype) === "social_sports") {
    return computeSocialSportsModeSpecificVenueBias(types, slot, referenceHour)
  }

  if (slot.phase === "before") {
    if (referenceHour < 11) {
      if (
        hasAnyType(types, [
          "coffee",
          "cafe",
          "café",
          "tea",
          "bakery",
          "breakfast",
          "brunch",
        ])
      ) {
        return 16
      }
      if (hasAnyType(types, ["dinner"])) return -26
    } else if (referenceHour < 15) {
      if (
        hasAnyType(types, [
          "lunch",
          "brunch",
          "breakfast",
          "cafe",
          "café",
          "bookstore",
          "gallery",
        ])
      ) {
        return 14
      }
      if (hasAnyType(types, ["dinner"])) return -18
    } else if (referenceHour < 18) {
      if (hasAnyType(types, ["lunch", "gallery", "museum", "park", "garden"])) {
        return 10
      }
    } else {
      if (hasAnyType(types, ["dinner", "cocktail", "wine bar", "rooftop", "bar"])) {
        return 12
      }
      if (hasAnyType(types, ["coffee", "tea", "breakfast"])) return -12
    }
  }

  if (slot.phase === "after") {
    if (referenceHour >= 21) {
      if (
        hasAnyType(types, [
          "bar",
          "cocktail",
          "lounge",
          "club",
          "speakeasy",
          "brewery",
          "dessert",
        ])
      ) {
        return 16
      }
      if (hasAnyType(types, ["breakfast", "lunch", "coffee", "tea", "library"])) {
        return -24
      }
    } else if (referenceHour >= 17) {
      if (
        hasAnyType(types, [
          "dinner",
          "bar",
          "cocktail",
          "wine bar",
          "rooftop",
          "brewery",
          "dessert",
        ])
      ) {
        return 12
      }
      if (hasAnyType(types, ["breakfast", "coffee", "tea"])) return -14
    } else {
      if (hasAnyType(types, ["gallery", "museum", "bookstore", "park", "garden", "market"])) {
        return 8
      }
    }
  }

  return 0
}

function computeSocialSportsModeSpecificVenueBias(
  types: string[],
  slot: PlanningSlot,
  referenceHour: number
): number {
  const morning = referenceHour < 11
  const midday = referenceHour >= 11 && referenceHour < 15
  const afternoon = referenceHour >= 15 && referenceHour < 18
  const evening = referenceHour >= 18

  if (slot.phase === "before") {
    if (morning) {
      if (hasAnyType(types, ["coffee", "cafe", "café", "bakery", "breakfast", "brunch", "tea", "juice", "matcha"])) {
        return 24
      }
      if (hasAnyType(types, ["restaurant", "lunch", "sports bar", "brewery", "pub"])) {
        return 8
      }
      if (hasAnyType(types, SOCIAL_SPORTS_BAD_MORNING_TYPES)) {
        return -24
      }
    }

    if (midday) {
      if (hasAnyType(types, ["brunch", "lunch", "restaurant", "sports bar", "brewery", "pub", "patio"])) {
        return 22
      }
      if (hasAnyType(types, ["coffee", "cafe", "café", "bakery"])) {
        return 8
      }
      if (hasAnyType(types, ["club", "speakeasy", "late night"])) {
        return -18
      }
    }

    if (afternoon) {
      if (hasAnyType(types, ["lunch", "restaurant", "sports bar", "brewery", "bar", "pub", "patio"])) {
        return 18
      }
      if (hasAnyType(types, ["breakfast", "spa", "library"])) {
        return -14
      }
    }

    if (evening) {
      if (hasAnyType(types, ["sports bar", "brewery", "bar", "restaurant", "dinner", "pub"])) {
        return 18
      }
      if (hasAnyType(types, ["spa", "library", "showroom"])) {
        return -14
      }
    }
  }

  if (slot.phase === "after") {
    if (morning || midday) {
      if (hasAnyType(types, ["brunch", "lunch", "restaurant", "cafe", "café", "coffee", "bakery", "patio"])) {
        return 22
      }
      if (hasAnyType(types, ["sports bar", "brewery", "pub", "bar", "beer garden"])) {
        return 14
      }
      if (hasAnyType(types, ["club", "speakeasy", "late night", "dinner"])) {
        return -18
      }
    }

    if (afternoon) {
      if (hasAnyType(types, ["sports bar", "brewery", "bar", "pub", "restaurant", "lunch", "patio"])) {
        return 18
      }
      if (hasAnyType(types, ["coffee", "cafe", "café", "dessert"])) {
        return 8
      }
      if (hasAnyType(types, ["spa", "library", "showroom"])) {
        return -12
      }
    }

    if (evening) {
      if (hasAnyType(types, ["sports bar", "bar", "brewery", "pub", "restaurant", "dinner", "late night"])) {
        return 18
      }
      if (hasAnyType(types, ["breakfast", "library", "spa"])) {
        return -18
      }
    }
  }

  return 0
}

function computePhaseAwarePreferenceBias(
  candidate: Pick<VenueRecord, "type" | "tags" | "vibe">,
  slot: PlanningSlot,
  context: PlanningContext
): number {
  if (context.vibeTags.length === 0) return 0

  const types = normalizeVenueTypes(candidate.type)
  let score = 0

  if (
    slot.phase === "before" &&
    hasAnyType(types, ["coffee", "cafe", "café", "bookstore", "gallery", "lunch"])
  ) {
    score += 4
  }

  if (
    slot.phase === "after" &&
    hasAnyType(types, ["cocktail", "wine bar", "bar", "lounge", "rooftop"])
  ) {
    score += 6
  }

  if (normalizeScoringArchetype(context.eventArchetype) === "social_sports") {
    if (
      slot.phase === "before" &&
      hasAnyType(types, ["coffee", "cafe", "café", "bakery", "breakfast", "brunch", "lunch", "restaurant"])
    ) {
      score += 6
    }

    if (
      slot.phase === "after" &&
      hasAnyType(types, ["brunch", "lunch", "restaurant", "sports bar", "brewery", "bar", "pub", "patio"])
    ) {
      score += 6
    }
  }

  return score
}

export function scoreDistanceFromAnchor(
  distanceMeters: number | null,
  mobility: Mobility
): number {
  if (distanceMeters == null) return 0

  if (mobility === "walk") {
    if (distanceMeters < 800) return 24
    if (distanceMeters < 1400) return 12
    return -18
  }

  if (mobility === "short_ride") {
    if (distanceMeters < 1800) return 20
    if (distanceMeters < 3200) return 10
    return -14
  }

  if (distanceMeters < 5000) return 10
  if (distanceMeters < 8000) return 2
  return -10
}

export function scoreBudgetFit(
  value: string | number | null | undefined,
  budget: Budget | null
): number {
  if (!budget) return 0

  const priceString = normalizePrice(value)
  if (!priceString) return 0

  const venuePrice = priceToInt(priceString)
  const selectedBudget = priceToInt(budget)

  if (!venuePrice || !selectedBudget) return 0

  if (budget === "$$$$") {
    if (venuePrice >= 2 && venuePrice <= 4) {
      if (venuePrice === 4) return 16
      if (venuePrice === 3) return 12
      return 8
    }

    return -40
  }

  if (venuePrice <= selectedBudget) {
    const diff = selectedBudget - venuePrice

    if (diff === 0) return 16
    if (diff === 1) return 10
    if (diff === 2) return 4

    return 0
  }

  return -40
}

export function scoreVibeFit(
  venue: Pick<VenueRecord, "tags" | "vibe" | "type">,
  vibeTags: string[]
): number {
  if (vibeTags.length === 0) return 0

  const expandedVibeTags = expandVibeTags(vibeTags)
  const preferredTypes = getPreferredTypesForVibe(vibeTags)
  const discouragedTypes = getDiscouragedTypesForVibe(vibeTags)

  const normalizedVenueTags = uniqueStrings([
    ...normalizeStringArray(venue.tags),
    ...normalizeStringArray(venue.vibe),
    ...normalizeStringArray(venue.type),
  ])
  const venueTypes = normalizeVenueTypes(venue.type)

  let score = 0

  score += expandedVibeTags.filter((tag) => normalizedVenueTags.includes(tag)).length * 12

  if (preferredTypes.length > 0) {
    score += preferredTypes.filter((type) => venueTypes.includes(type)).length * 10
  }

  if (discouragedTypes.length > 0) {
    score -= discouragedTypes.filter((type) => venueTypes.includes(type)).length * 12
  }

  return score
}

export function scoreGroupFit(
  venue: Pick<VenueRecord, "type">,
  groupSize: number | null
): number {
  if (!groupSize) return 0

  const preferredTypes = getPreferredTypesForGroupSize(groupSize)
  const discouragedTypes = getDiscouragedTypesForGroupSize(groupSize)
  const venueTypes = normalizeVenueTypes(venue.type)

  let score = 0

  if (preferredTypes.length > 0) {
    score += preferredTypes.filter((type) => venueTypes.includes(type)).length * 10
  }

  if (discouragedTypes.length > 0) {
    score -= discouragedTypes.filter((type) => venueTypes.includes(type)).length * 12
  }

  if (groupSize >= 6) {
    if (hasAnyType(venueTypes, ["speakeasy", "cocktail", "coffee", "bakery"])) {
      score -= 8
    }

    if (hasAnyType(venueTypes, ["brewery", "restaurant", "bar", "sports bar", "rooftop"])) {
      score += 8
    }
  }

  if (groupSize <= 2) {
    if (hasAnyType(venueTypes, ["speakeasy", "cocktail", "wine bar", "gallery"])) {
      score += 6
    }

    if (hasAnyType(venueTypes, ["sports bar", "brewery"])) {
      score -= 4
    }
  }

  return score
}

export function scoreArchetypeFit(
  venue: Pick<VenueRecord, "type" | "vibe" | "tags">,
  context: PlanningContext,
  slot?: PlanningSlot
): number {
  const types = normalizeVenueTypes(venue.type)
  const tags = uniqueStrings([
    ...normalizeStringArray(venue.type),
    ...normalizeStringArray(venue.vibe),
    ...normalizeStringArray(venue.tags),
  ])

  const archetype = normalizeScoringArchetype(context.eventArchetype)
  const phase = slot?.phase ?? (context.mode === "before" ? "before" : "after")
  const referenceHour = slot
    ? getHourFractionInTimeZone(slot.targetArrivalAt, resolvePlannerTimeZone(context))
    : null

  let score = 0

  if (archetype === "music") {
    if (phase === "before") {
      if (hasAnyType(types, ["restaurant", "dinner", "cocktail", "bar", "wine bar", "lounge"])) {
        score += 12
      }
      if (hasAnyType(types, ["coffee", "breakfast", "library", "spa"])) score -= 10
    } else {
      if (hasAnyType(types, ["bar", "cocktail", "lounge", "rooftop", "late night", "club", "speakeasy"])) {
        score += 14
      }
      if (hasAnyType(types, ["coffee", "breakfast", "museum", "library", "spa"])) score -= 16
    }

    if (hasAnyType(types, ["music"])) score += 4
    if (tags.some((t) => ["live", "music", "show"].includes(t))) score += 4
  }

  if (archetype === "arts_culture") {
    if (phase === "before") {
      if (hasAnyType(types, ["gallery", "museum", "bookstore", "wine bar", "cocktail", "cafe", "café"])) {
        score += 12
      }
    } else {
      if (hasAnyType(types, ["restaurant", "dinner", "wine bar", "cocktail", "lounge", "dessert"])) {
        score += 12
      }
    }

    if (hasAnyType(types, ["sports bar", "club", "fitness"])) score -= 12
  }

  if (archetype === "social_sports") {
    const morningOrMidday = referenceHour == null || referenceHour < 15
    const daytime = referenceHour == null || referenceHour < 17

    if (phase === "before") {
      if (
        morningOrMidday &&
        hasAnyType(types, ["coffee", "cafe", "café", "bakery", "breakfast", "brunch", "tea", "juice", "matcha"])
      ) {
        score += 18
      }

      if (
        daytime &&
        hasAnyType(types, ["brunch", "lunch", "restaurant", "sports bar", "brewery", "pub", "patio"])
      ) {
        score += 14
      }

      if (
        !daytime &&
        hasAnyType(types, ["sports bar", "bar", "brewery", "restaurant", "dinner", "pub"])
      ) {
        score += 14
      }
    } else {
      if (
        daytime &&
        hasAnyType(types, ["brunch", "lunch", "restaurant", "cafe", "café", "coffee", "bakery", "patio"])
      ) {
        score += 16
      }

      if (
        hasAnyType(types, ["sports bar", "bar", "brewery", "pub", "restaurant", "casual food", "beer garden", "patio"])
      ) {
        score += 14
      }
    }

    if (
      tags.some((tag) =>
        [
          "sports",
          "soccer",
          "match",
          "matchday",
          "watch party",
          "watch-party",
          "game day",
          "gameday",
          "pub",
          "patio",
          "group-friendly",
          "casual",
          "lively",
        ].includes(tag)
      )
    ) {
      score += 8
    }

    if (hasAnyType(types, SOCIAL_SPORTS_BAD_MORNING_TYPES)) {
      score -= daytime ? 18 : 8
    }

    if (hasAnyType(types, ["spa", "library", "showroom", "fine dining"])) {
      score -= 14
    }
  }

  if (archetype === "market") {
    if (phase === "before") {
      if (hasAnyType(types, ["coffee", "cafe", "café", "bakery", "breakfast", "brunch"])) {
        score += 14
      }
    } else {
      if (hasAnyType(types, ["brunch", "lunch", "cafe", "café", "bookstore", "park", "garden", "gallery", "dessert"])) {
        score += 12
      }

      if (hasAnyType(types, ["club", "speakeasy", "sports bar"])) score -= 14
    }
  }

  if (archetype === "food_drink") {
    if (phase === "before") {
      if (hasAnyType(types, ["wine bar", "cocktail", "bar", "cafe", "café", "bakery", "restaurant"])) {
        score += 10
      }
    } else {
      if (hasAnyType(types, ["dessert", "wine bar", "cocktail", "lounge", "bar"])) {
        score += 12
      }
    }

    if (hasAnyType(types, ["fitness", "library", "showroom"])) score -= 10
  }

  if (archetype === "wellness") {
    if (hasAnyType(types, ["coffee", "tea", "cafe", "café", "juice", "smoothie", "salad", "healthy", "park", "garden"])) {
      score += 14
    }

    if (hasAnyType(types, ["club", "sports bar", "dive bar", "cocktail", "speakeasy"])) {
      score -= 20
    }
  }

  if (archetype === "nightlife") {
    if (phase === "before") {
      if (hasAnyType(types, ["cocktail", "bar", "restaurant", "dinner", "rooftop", "lounge"])) {
        score += 12
      }
    } else {
      if (hasAnyType(types, ["club", "bar", "cocktail", "lounge", "speakeasy", "late night", "rooftop"])) {
        score += 16
      }
    }

    if (hasAnyType(types, ["breakfast", "library", "spa"])) score -= 12
  }

  if (archetype === "community") {
    if (phase === "before") {
      if (hasAnyType(types, ["coffee", "cafe", "café", "restaurant", "park", "bookstore"])) {
        score += 8
      }
    } else {
      if (hasAnyType(types, ["restaurant", "bar", "brewery", "coffee", "dessert"])) {
        score += 8
      }
    }

    if (hasAnyType(types, ["club", "speakeasy"])) score -= 8
  }

  if (archetype === "comedy") {
    if (phase === "before") {
      if (hasAnyType(types, ["restaurant", "dinner", "bar", "cocktail", "brewery"])) {
        score += 12
      }
    } else {
      if (hasAnyType(types, ["bar", "cocktail", "lounge", "dessert", "late night"])) {
        score += 12
      }
    }

    if (hasAnyType(types, ["breakfast", "library", "spa"])) score -= 10
  }

  if (archetype === "networking") {
    if (
      hasAnyType(types, [
        "cocktail",
        "wine bar",
        "bar",
        "lounge",
        "rooftop",
        "hotel bar",
        "hotel lobby",
        "social club",
        "coworking",
        "speakeasy",
        "restaurant",
        "dinner",
        "lunch",
        "cafe",
        "café",
        "coffee",
      ])
    ) {
      score += 12
    }

    if (
      hasAnyType(types, [
        "activity",
        "lifestyle",
        "gallery",
        "museum",
        "bookstore",
        "library",
        "showroom",
      ])
    ) {
      score -= 30
    }

    if (
      tags.some((tag) =>
        [
          "networking",
          "mixer",
          "founders",
          "startup",
          "professional",
          "community",
          "meetup",
          "industry",
          "social",
          "conversation",
          "lounge",
        ].includes(tag)
      )
    ) {
      score += 6
    }

    if (hasAnyType(types, ["club", "sports bar", "fitness", "spa"])) {
      score -= 8
    }
  }

  if (tags.some((tag) => tag === archetype)) score += 4

  return score
}

function normalizeScoringArchetype(archetype: string | null | undefined): string {
  if (archetype === "art") return "arts_culture"
  if (archetype === "sports") return "social_sports"
  if (archetype === "festival") return "market"
  if (archetype === "general") return "other"

  return archetype ?? "other"
}