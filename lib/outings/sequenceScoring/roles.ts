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
        "hotel bar",
        "hotel lobby",
        "social club",
        "coworking",
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
        "coworking",
        "hotel lobby",
        "social club",
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

  if (
    context.eventArchetype === "networking" &&
    hasAnyType(types, [
      "coffee",
      "tea",
      "cafe",
      "café",
      "lunch",
      "dinner",
      "cocktail",
      "wine bar",
      "bar",
      "lounge",
      "hotel bar",
      "hotel lobby",
      "rooftop",
      "coworking",
      "social club",
      "bookstore",
      "lifestyle",
    ])
  ) {
    if (slot.role === "coffee") roles.push("food", "drink", "activity")
    if (slot.role === "food") roles.push("coffee", "drink", "activity")
    if (slot.role === "drink") roles.push("food", "coffee", "activity")
    if (slot.role === "activity") roles.push("coffee", "drink", "food")
  }

  if (
    slot.phase === "before" &&
    slot.role === "food" &&
    hour < DINNER_MINIMUM_LOCAL_HOUR &&
    isEarlyDinnerCompatibleVenueType(types)
  ) {
    roles.push("drink")
  }

  if (
    relaxed &&
    slot.role === "food" &&
    hour >= 13 &&
    hour < DINNER_MINIMUM_LOCAL_HOUR &&
    hasAnyType(types, [
      "gallery",
      "museum",
      "bookstore",
      "library",
      "park",
      "garden",
      "lifestyle",
      "showroom",
      "market",
    ])
  ) {
    roles.push("activity")
  }

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
          "hotel bar",
          "hotel lobby",
          "social club",
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
          "coworking",
          "hotel lobby",
          "social club",
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