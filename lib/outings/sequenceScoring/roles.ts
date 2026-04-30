// lib/outings/sequenceScoring/roles.ts

import type {
  PlanningContext,
  PlanningSlot,
  StopRole,
  VenueRecord,
} from "../types"
import type { RoleCompatibleVenue } from "./types"

import {
  hasAnyType,
  normalizeDisplayVenueType,
  normalizeVenueTypes,
  uniqueRoles,
} from "./helpers"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

const DINNER_MINIMUM_LOCAL_HOUR = 17.5

export function inferVenueRoles(venue: VenueRecord): StopRole[] {
  const types = normalizeVenueTypes(venue.type)
  const roles: StopRole[] = []

  for (const type of types) {
    if (["coffee", "tea"].includes(type)) {
      roles.push("coffee")
    }

    if (["breakfast", "cafe", "café"].includes(type)) {
      roles.push("coffee", "food")
    }

    if (["lunch", "dinner"].includes(type)) {
      roles.push("food")
    }

    if (type === "brunch") {
      roles.push("food", "coffee")
    }

    if (type === "bakery") {
      roles.push("dessert", "coffee")
    }

    if (type === "dessert") {
      roles.push("dessert")
    }

    if (
      [
        "rooftop",
        "wine bar",
        "bar",
        "sports bar",
        "cocktail",
        "lounge",
        "speakeasy",
        "club",
        "brewery",
      ].includes(type)
    ) {
      roles.push("drink")
    }

    if (
      [
        "gallery",
        "museum",
        "lifestyle",
        "bookstore",
        "library",
        "park",
        "garden",
        "fitness",
        "pilates",
        "yoga",
        "activity",
        "random gem",
        "music",
        "market",
        "nature",
        "showroom",
        "spa",
      ].includes(type)
    ) {
      roles.push("activity")
    }
  }

  return roles.length > 0 ? uniqueRoles(roles) : ["activity"]
}

export function pickRoleForSlot(
  slot: PlanningSlot,
  candidateRoles: StopRole[]
): StopRole {
  if (candidateRoles.includes(slot.role)) return slot.role
  if (slot.flexibleRole && candidateRoles.includes(slot.flexibleRole)) {
    return slot.flexibleRole
  }
  return candidateRoles[0] ?? slot.role
}

export function pickRoleForIndex(
  index: number,
  candidateRoles: StopRole[],
  desiredRoles: StopRole[]
): StopRole {
  const desiredRole = desiredRoles[index]
  if (desiredRole && candidateRoles.includes(desiredRole)) return desiredRole
  return candidateRoles[0] ?? "activity"
}

export function candidateSupportsSlot(
  candidate: RoleCompatibleVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false
): boolean {
  const acceptableRoles = getAcceptableRolesForSlot(
    slot,
    candidate,
    context,
    relaxed
  )

  return acceptableRoles.some((role) =>
    candidate.inferredRoles.includes(role)
  )
}

export function getAcceptableRolesForSlot(
  slot: PlanningSlot,
  candidate: Pick<VenueRecord, "type">,
  context: PlanningContext,
  relaxed = false
): StopRole[] {
  const roles: StopRole[] = [slot.role]
  const types = normalizeVenueTypes(candidate.type)

  const timeZone = resolvePlannerTimeZone(context)
  const hour = getHourFractionInTimeZone(
    slot.targetArrivalAt,
    timeZone
  )

  if (slot.flexibleRole) {
    roles.push(slot.flexibleRole)
  }

  // Dinner-before-5:30p rule:
  // A before-event food slot that lands before 5:30p may flex to drink
  // only for dinner+cocktail/bar/wine-bar/lounge hybrids or cocktail/wine-bar fallback venues.
  if (
    slot.phase === "before" &&
    slot.role === "food" &&
    hour < DINNER_MINIMUM_LOCAL_HOUR &&
    isEarlyDinnerCompatibleVenueType(types)
  ) {
    roles.push("drink")
  }

  // Morning food can flex into coffee
  if (slot.phase === "before" && slot.role === "food") {
    if (
      hour < 12.5 &&
      hasAnyType(types, ["breakfast", "brunch", "cafe", "café"])
    ) {
      roles.push("coffee")
    }

    if (relaxed && hour < 12.5 && hasAnyType(types, ["bakery"])) {
      roles.push("coffee")
    }
  }

  // Coffee can flex into light food
  if (slot.phase === "before" && slot.role === "coffee") {
    if (
      hour < 13 &&
      hasAnyType(types, ["breakfast", "brunch", "cafe", "café"])
    ) {
      roles.push("food")
    }
  }

  return uniqueRoles(roles)
}

export function computeSlotRoleFitBonus(
  candidate: Pick<RoleCompatibleVenue, "inferredRoles">,
  slot: PlanningSlot
): number {
  if (candidate.inferredRoles.includes(slot.role)) return 14

  if (
    slot.flexibleRole &&
    candidate.inferredRoles.includes(slot.flexibleRole)
  ) {
    return 6
  }

  return 0
}

export function pickBestDisplayTypeForRole(
  slot: PlanningSlot,
  role: StopRole,
  venueTypes: string[],
  timeZone: string
): string | null {
  const arrivalHour = getHourFractionInTimeZone(
    slot.targetArrivalAt,
    timeZone
  )

  const orderedCandidates =
    role === "coffee"
      ? ["coffee", "tea", "cafe", "café", "bakery", "breakfast", "brunch"]
      : role === "food"
      ? arrivalHour < 11
        ? ["breakfast", "brunch", "lunch", "dinner", "cafe", "café"]
        : arrivalHour < 15
        ? ["lunch", "brunch", "breakfast", "dinner", "cafe", "café"]
        : arrivalHour < DINNER_MINIMUM_LOCAL_HOUR && slot.phase === "before"
        ? ["cocktail", "wine bar", "lounge", "bar", "dinner", "lunch", "brunch"]
        : ["dinner", "lunch", "brunch", "breakfast"]
      : role === "drink"
      ? [
          "cocktail",
          "wine bar",
          "bar",
          "lounge",
          "speakeasy",
          "brewery",
          "rooftop",
          "club",
          "sports bar",
        ]
      : role === "dessert"
      ? ["dessert", "bakery"]
      : [
          "gallery",
          "museum",
          "bookstore",
          "library",
          "park",
          "garden",
          "music",
          "market",
          "showroom",
          "lifestyle",
          "spa",
        ]

  return (
    orderedCandidates.find((type) => venueTypes.includes(type)) ??
    null
  )
}

export function getPrimaryDisplayVenueType(
  venue: Pick<VenueRecord, "type">
): string | null {
  return normalizeDisplayVenueType(venue.type)
}

function isEarlyDinnerCompatibleVenueType(types: string[]): boolean {
  const isHybridDinnerDrink =
    hasAnyType(types, ["dinner"]) &&
    hasAnyType(types, ["cocktail", "bar", "wine bar", "lounge"])

  const isFallbackDrink = hasAnyType(types, ["cocktail", "wine bar"])

  return isHybridDinnerDrink || isFallbackDrink
}