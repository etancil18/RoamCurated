// lib/outings/sequenceScoring/lateNight.ts

import type {
  GeneratedOutingStop,
  PlanningContext,
  PlanningSlot,
  VenueRecord,
} from "../types"
import { normalizeVenueType, normalizeVenueTypes, hasAnyType } from "./helpers"
import {
  getCalendarDayKey,
  getLocalMinutesInDay,
  resolvePlannerTimeZone,
} from "./time"

type NightlifeTypedVenue = Pick<VenueRecord, "type">

export function qualifiesForLateNightSingleStopFallback(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (context.mode !== "after") return false
  if (stops.length !== 1) return false

  const timeZone = resolvePlannerTimeZone(context)
  if (!endsAfterMidnight(context, timeZone)) return false

  const stop = stops[0]
  return isQualifyingLateNightStop(stop, timeZone)
}

export function qualifiesForLateNightReducedFullFallback(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (context.mode !== "full") return false

  const timeZone = resolvePlannerTimeZone(context)
  if (!endsAfterMidnight(context, timeZone)) return false

  if (stops.length === 2) {
    return true
  }

  if (stops.length === 3) {
    const lastStop = stops[2]
    return isQualifyingLateNightStop(lastStop, timeZone)
  }

  return false
}

export function isLateNightAfterFallbackContext(
  context: PlanningContext,
  slot: PlanningSlot
): boolean {
  if (slot.phase !== "after") return false

  const isFirstPostEventSlot =
    (context.mode === "after" && slot.index === 0) ||
    (context.mode === "full" && slot.index === 2)

  if (!isFirstPostEventSlot) return false

  const timeZone = resolvePlannerTimeZone(context)
  return endsAfterMidnight(context, timeZone)
}

export function isLateNightNightlifeType(
  venue: NightlifeTypedVenue
): boolean {
  const types = normalizeVenueTypes(venue.type)
  return hasAnyType(types, [
    "bar",
    "lounge",
    "club",
    "cocktail",
    "speakeasy",
    "rooftop",
  ])
}

export function endsAfterMidnight(
  context: Pick<PlanningContext, "startsAt" | "estimatedEndAt">,
  timeZone: string
): boolean {
  const startDayKey = getCalendarDayKey(context.startsAt, timeZone)
  const endDayKey = getCalendarDayKey(context.estimatedEndAt, timeZone)

  if (startDayKey !== endDayKey) return true

  const endMinutes = getLocalMinutesInDay(context.estimatedEndAt, timeZone)
  return endMinutes < 4 * 60
}

function isQualifyingLateNightStop(
  stop: GeneratedOutingStop,
  timeZone: string
): boolean {
  const appliedType = normalizeVenueType(stop.displayType ?? stop.venueType ?? null)

  if (!["bar", "lounge", "club", "cocktail", "speakeasy", "rooftop"].includes(appliedType)) {
    return false
  }

  const plannedDeparture = stop.plannedDepartureAt
    ? new Date(stop.plannedDepartureAt)
    : null

  if (!plannedDeparture) return false

  const departureMinutes = getLocalMinutesInDay(plannedDeparture, timeZone)
  return departureMinutes >= 2 * 60
}

function isBeforeEventStop(
  stop: GeneratedOutingStop,
  context: PlanningContext
): boolean {
  const plannedDeparture = stop.plannedDepartureAt
    ? new Date(stop.plannedDepartureAt)
    : null

  if (!plannedDeparture) return false

  return plannedDeparture.getTime() <= context.startsAt.getTime()
}

function isAfterEventStop(
  stop: GeneratedOutingStop,
  context: PlanningContext
): boolean {
  const plannedArrival = stop.plannedArrivalAt
    ? new Date(stop.plannedArrivalAt)
    : null

  if (!plannedArrival) return false

  return plannedArrival.getTime() >= context.estimatedEndAt.getTime()
}