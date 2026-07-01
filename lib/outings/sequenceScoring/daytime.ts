// lib/outings/sequenceScoring/daytime.ts

import type {
  GeneratedOutingStop,
  PlanningContext,
  StopRole,
} from "../types"
import { normalizeVenueType, normalizeVenueTypes, hasAnyType } from "./helpers"
import { getHourFractionInTimeZone, resolvePlannerTimeZone } from "./time"

type MorningTypedStop = Pick<
  GeneratedOutingStop,
  "role" | "venueType" | "displayType" | "metadata"
>

const MORNING_COMPATIBLE_STOP_ROLES: StopRole[] = ["coffee", "food", "activity"]

const MORNING_COMPATIBLE_VENUE_TYPES = [
  "coffee",
  "cafe",
  "café",
  "bakery",
  "breakfast",
  "brunch",
  "tea",
  "juice",
  "matcha",
  "wellness",
  "yoga",
  "pilates",
]

const SOCIAL_SPORTS_DAYTIME_COMPATIBLE_TYPES = [
  "coffee",
  "cafe",
  "café",
  "bakery",
  "breakfast",
  "brunch",
  "lunch",
  "restaurant",
  "sports bar",
  "brewery",
  "bar",
  "patio",
]

const SOCIAL_SPORTS_EVENING_COMPATIBLE_TYPES = [
  "restaurant",
  "dinner",
  "bar",
  "sports bar",
  "brewery",
  "pub",
  "rooftop",
  "lounge",
  "late night",
]

export function qualifiesForReducedBeforeSingleStopFallback(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (context.mode !== "before") return false
  if (stops.length !== 1) return false

  const stop = stops[0]
  if (stop.phase !== "before") return false
  if (stop.metadata?.selectedPass === "emergency") return false

  if (isSocialSportsBeforeEventContext(context)) {
    return isSocialSportsCompatibleStop(stop, context)
  }

  if (isEarlyDayBeforeEventContext(context)) {
    return isMorningCompatibleStop(stop)
  }

  if (isLateNightMusicBeforeEventContext(context)) {
    return stop.role === "food" || stop.role === "drink"
  }

  if (isNetworkingBeforeEventContext(context)) {
    return stop.role === "coffee" || stop.role === "food" || stop.role === "drink"
  }

  if (isGeneralEveningBeforeEventContext(context)) {
    return stop.role === "food" || stop.role === "drink"
  }

  return false
}

export function qualifiesForDaytimeCultureReducedFullFallback(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (context.mode !== "full") return false

  if (normalizeDaytimeArchetype(context.eventArchetype) === "social_sports") {
    return qualifiesForSocialSportsReducedFullFallback(stops, context)
  }

  if (context.eventArchetype !== "art" && context.eventArchetype !== "networking") {
    return false
  }
  if (stops.length < 1) return false

  const beforeStops = stops.filter((stop) => stop.phase === "before")
  if (beforeStops.length < 1) return false

  const hasEmergencyStop = stops.some(
    (stop) => stop.metadata?.selectedPass === "emergency"
  )

  if (hasEmergencyStop) return false

  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)
  const eventEndHour = getHourFractionInTimeZone(
    context.effectiveExitAt ?? context.estimatedEndAt,
    timeZone
  )

  if (context.eventArchetype === "networking") {
    return eventStartHour <= 17.5 && eventEndHour <= 22
  }

  return eventStartHour <= 12.5 && eventEndHour <= 18.5
}

export function isEarlyDayBeforeEventContext(context: PlanningContext): boolean {
  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)

  return eventStartHour <= 12.5
}

function isSocialSportsBeforeEventContext(context: PlanningContext): boolean {
  const archetype = normalizeDaytimeArchetype(context.eventArchetype)
  return archetype === "social_sports"
}

function qualifiesForSocialSportsReducedFullFallback(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (stops.length < 1) return false

  const hasEmergencyStop = stops.some(
    (stop) => stop.metadata?.selectedPass === "emergency"
  )

  if (hasEmergencyStop) return false

  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)
  const eventEndHour = getHourFractionInTimeZone(
    context.effectiveExitAt ?? context.estimatedEndAt,
    timeZone
  )

  const beforeStops = stops.filter((stop) => stop.phase === "before")
  const afterStops = stops.filter((stop) => stop.phase === "after")

  const hasCompatibleBeforeStop = beforeStops.some((stop) =>
    isSocialSportsCompatibleStop(stop, context)
  )
  const hasCompatibleAfterStop = afterStops.some((stop) =>
    isSocialSportsCompatibleStop(stop, context)
  )

  if (eventStartHour < 12.5) {
    return hasCompatibleBeforeStop || hasCompatibleAfterStop
  }

  if (eventStartHour < 17) {
    return hasCompatibleBeforeStop || hasCompatibleAfterStop
  }

  if (eventStartHour >= 17 || eventEndHour >= 17) {
    return hasCompatibleBeforeStop || hasCompatibleAfterStop
  }

  return false
}

function isSocialSportsCompatibleStop(
  stop: MorningTypedStop,
  context: PlanningContext
): boolean {
  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)
  const eventEndHour = getHourFractionInTimeZone(
    context.effectiveExitAt ?? context.estimatedEndAt,
    timeZone
  )

  if (eventStartHour < 11) {
    return (
      stop.role === "coffee" ||
      isMorningCompatibleStop(stop) ||
      stopHasAnyVenueType(stop, SOCIAL_SPORTS_DAYTIME_COMPATIBLE_TYPES)
    )
  }

  if (eventStartHour < 17 && eventEndHour < 17) {
    return (
      stop.role === "food" ||
      stop.role === "coffee" ||
      stopHasAnyVenueType(stop, SOCIAL_SPORTS_DAYTIME_COMPATIBLE_TYPES)
    )
  }

  return (
    stop.role === "food" ||
    stop.role === "drink" ||
    stopHasAnyVenueType(stop, SOCIAL_SPORTS_EVENING_COMPATIBLE_TYPES)
  )
}

function isLateNightMusicBeforeEventContext(context: PlanningContext): boolean {
  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)

  return context.eventArchetype === "music" && eventStartHour >= 20
}

function isNetworkingBeforeEventContext(context: PlanningContext): boolean {
  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)

  return context.eventArchetype === "networking" && eventStartHour >= 15
}

function isGeneralEveningBeforeEventContext(context: PlanningContext): boolean {
  const timeZone = resolvePlannerTimeZone(context)
  const eventStartHour = getHourFractionInTimeZone(context.startsAt, timeZone)

  return eventStartHour >= 15
}

export function isMorningCompatibleStop(stop: MorningTypedStop): boolean {
  if (MORNING_COMPATIBLE_STOP_ROLES.includes(stop.role)) {
    if (stop.role === "coffee") return true
    if (stop.role === "activity") {
      return stopHasAnyVenueType(stop, ["wellness", "yoga", "pilates"])
    }

    if (stop.role === "food") {
      return stopHasAnyVenueType(stop, [
        "breakfast",
        "brunch",
        "bakery",
        "cafe",
        "café",
        "coffee",
        "tea",
        "juice",
        "matcha",
      ])
    }
  }

  return stopHasAnyVenueType(stop, MORNING_COMPATIBLE_VENUE_TYPES)
}

function stopHasAnyVenueType(
  stop: MorningTypedStop,
  expectedTypes: string[]
): boolean {
  const explicitType = normalizeVenueType(stop.displayType ?? stop.venueType ?? null)

  if (explicitType && expectedTypes.includes(explicitType)) {
    return true
  }

  const metadataTypes = Array.isArray(stop.metadata?.venueTypes)
    ? normalizeVenueTypes(stop.metadata.venueTypes)
    : []

  if (metadataTypes.length > 0 && hasAnyType(metadataTypes, expectedTypes)) {
    return true
  }

  const inferredTypes = normalizeVenueTypes([
    stop.displayType ?? "",
    stop.venueType ?? "",
    stop.metadata?.venueType ?? "",
    stop.metadata?.appliedDisplayType ?? "",
  ])

  return hasAnyType(inferredTypes, expectedTypes)
}

function normalizeDaytimeArchetype(archetype: string | null | undefined): string {
  if (archetype === "sports") return "social_sports"
  return archetype ?? "other"
}