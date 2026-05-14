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
        context.mobility
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

  score += computeModeSpecificVenueBias(candidate, slot, context)
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
  mobility: Mobility
): number {
  let score = 0

  if (previousToCandidateDistance != null) {
    const strictMax = getMaxAfterInterstopMeters(mobility, false)
    if (previousToCandidateDistance <= strictMax * 0.5) score += 12
    else if (previousToCandidateDistance <= strictMax * 0.8) score += 6
    else if (previousToCandidateDistance > strictMax) score -= 18
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
  const maxLocalFallbackMeters = getMaxAfterLocalFallbackMeters(context.mobility)
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

  return -18
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
  context: PlanningContext
): number {
  if (context.mode === "before") return 0

  const types = normalizeVenueTypes(venue.type)
  const tags = uniqueStrings([
    ...normalizeStringArray(venue.type),
    ...normalizeStringArray(venue.vibe),
    ...normalizeStringArray(venue.tags),
  ])

  let score = 0

  if (context.eventArchetype === "music") {
    if (hasAnyType(types, ["club", "cocktail", "bar", "lounge", "rooftop", "music"])) {
      score += 8
    }
    if (tags.some((t) => ["live", "music", "show"].includes(t))) score += 4
  }

  if (context.eventArchetype === "art") {
    if (hasAnyType(types, ["gallery", "museum", "bookstore", "wine", "wine bar"])) {
      score += 8
    }
  }

  if (context.eventArchetype === "sports") {
    if (hasAnyType(types, ["sports bar", "bar", "brewery"])) score += 8
  }

  if (context.eventArchetype === "festival") {
    if (hasAnyType(types, ["market", "club", "music", "dessert"])) score += 6
  }

  if (context.eventArchetype === "networking") {
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
      "dinner",
      "lunch",
    ])
  ) {
    score += 10
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
    score -= 100
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

  return score
}