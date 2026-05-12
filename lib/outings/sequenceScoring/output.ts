// lib/outings/sequenceScoring/output.ts

import type {
  GeneratedOutingStop,
  PlanMode,
  PlanningContext,
  PlanningSlot,
  StopRole,
} from "../types"
import type { CandidateVenue } from "./types"

import {
  addMinutes,
  resolvePlannerTimeZone,
} from "./time"

import {
  humanizeRole,
  normalizeDisplayVenueType,
  normalizeVenueTypes,
} from "./helpers"

import {
  pickBestDisplayTypeForRole,
  pickRoleForSlot,
} from "./roles"

import {
  estimateTravelMinutes,
  getDistanceBetweenVenues,
  inferTravelMode,
} from "./geometry"

import { selectCandidates } from "./selection"
import { qualifiesForLateNightSingleStopFallback } from "./lateNight"
import { qualifiesForReducedBeforeSingleStopFallback } from "./daytime"

export function generatePlanStops(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext
): GeneratedOutingStop[] {
  const slots = getPlanningSlots(context)
  const selection = selectCandidates(rankedCandidates, context, slots)
  const timeZone = resolvePlannerTimeZone(context)

  const selectedStopsWithSlots = selection.selected

  return selectedStopsWithSlots.map(({ venue, slot }, index) => {
    const role = pickRoleForSlot(slot, venue.inferredRoles)
    const previousVenue =
      index > 0 ? selectedStopsWithSlots[index - 1]?.venue ?? null : null
    const distanceFromPrev =
      previousVenue != null
        ? getDistanceBetweenVenues(previousVenue, venue)
        : venue.distanceMeters

    const venueTypes = normalizeVenueTypes(venue.type)
const venueType = normalizeDisplayVenueType(venue.type)
const displayType = resolveDisplayTypeForSlot({
  slot,
  role,
  venueTypes,
  venueType,
  timeZone,
})

    return {
      venueId: venue.id,
      stopOrder: index + 1,
      role,
      phase: slot.phase,
      venueType,
      displayType,
      title: venue.name ?? humanizeRole(role),
      rationale: buildRationale({
        venueName: venue.name,
        role,
        distanceMeters: index === 0 ? venue.distanceMeters : distanceFromPrev,
        eventArchetype: context.eventArchetype,
        mode: context.mode,
      }),
      plannedArrivalAt: slot.targetArrivalAt.toISOString(),
      plannedDepartureAt: slot.targetDepartureAt.toISOString(),
      dwellMinutes: slot.dwellMinutes,
      travelMode: inferTravelMode(context.mobility, distanceFromPrev),
      travelMinutesFromPrev:
        index === 0
          ? defaultTravelMinutesForFirstSlot(context, slot)
          : estimateTravelMinutes(context.mobility, distanceFromPrev),
      distanceMetersFromPrev: distanceFromPrev,
      lat: venue.lat ?? null,
      lon: venue.lon ?? null,
      address: venue.address ?? null,
      bookingOptions: venue.bookingOptions ?? null,
      metadata: {
        venueName: venue.name,
        venueAddress: venue.address,
        score: venue.score,
        inferredRoles: venue.inferredRoles,
        venueTypes,
        venueType,
        displayType,
        appliedDisplayType: displayType,
        selectedPass: selectedStopsWithSlots[index]?.selectedPass ?? null,
      },
    }
  })
}

export function computeStopTiming(
  index: number,
  totalStops: number,
  role: StopRole,
  context: PlanningContext
): {
  arrival: Date
  departure: Date
  dwellMinutes: number
  travelMinutesFromPrev: number | null
} {
  const slots = getPlanningSlots(context)
  const slot = slots[index]
  const effectiveExitAt = getEffectiveExitAt(context)

  if (slot) {
    return {
      arrival: slot.targetArrivalAt,
      departure: slot.targetDepartureAt,
      dwellMinutes: slot.dwellMinutes,
      travelMinutesFromPrev: defaultTravelMinutesForSlotIndex(context, index),
    }
  }

  const dwellMinutes =
    role === "food" ? 75 : role === "drink" ? 60 : role === "activity" ? 60 : 45

  if (context.mode === "before") {
    const finalDeparture = addMinutes(context.startsAt, -35)
    const reverseOffset = totalStops - index - 1
    const departure = addMinutes(finalDeparture, -(reverseOffset * 75))
    const arrival = addMinutes(departure, -dwellMinutes)

    return {
      arrival,
      departure,
      dwellMinutes,
      travelMinutesFromPrev: index === 0 ? null : 12,
    }
  }

  if (context.mode === "after") {
    const arrival = addMinutes(effectiveExitAt, 20 + index * 80)
    const departure = addMinutes(arrival, dwellMinutes)

    return {
      arrival,
      departure,
      dwellMinutes,
      travelMinutesFromPrev: index === 0 ? 20 : 12,
    }
  }

  if (index === 0) {
    const departure = addMinutes(context.startsAt, -35)
    const arrival = addMinutes(departure, -dwellMinutes)

    return {
      arrival,
      departure,
      dwellMinutes,
      travelMinutesFromPrev: null,
    }
  }

  const arrival = addMinutes(effectiveExitAt, 20 + (index - 1) * 80)
  const departure = addMinutes(arrival, dwellMinutes)

  return {
    arrival,
    departure,
    dwellMinutes,
    travelMinutesFromPrev: index === 1 ? 20 : 12,
  }
}

export function buildPlanSummary({
  mode,
  eventTitle,
  venueName,
  stops,
  planningContext,
}: {
  mode: PlanMode
  eventTitle: string | null
  venueName: string | null
  stops: GeneratedOutingStop[]
  planningContext: PlanningContext
}): string {
  const stopNames = stops.map((s) => s.title).join(" → ")
  const modeLabel =
    mode === "before" ? "before-event" : mode === "after" ? "post-event" : "full-night"

  const exitAwareText =
    mode !== "before" && planningContext.plannedExitAt
      ? planningContext.leaveEarlyByHours
        ? `based on leaving ${planningContext.leaveEarlyByHours} hour${
            planningContext.leaveEarlyByHours === 1 ? "" : "s"
          } early around ${planningContext.plannedExitAt.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`
        : `based on leaving around ${planningContext.plannedExitAt.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`
      : null

  return [
    `A ${modeLabel} plan for ${eventTitle ?? "this event"}`,
    venueName ? `anchored around ${venueName}` : null,
    exitAwareText,
    `with ${stops.length} contextual stop${stops.length === 1 ? "" : "s"}`,
    `optimized for ${planningContext.eventArchetype} energy`,
    stopNames ? `and low-regret sequencing: ${stopNames}.` : null,
  ]
    .filter(Boolean)
    .join(" ")
}

export function computeConfidenceScore(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): number {
  let score = 0.4
  const qualifiesLateNightSingleStop =
    qualifiesForLateNightSingleStopFallback(stops, context)
  const qualifiesReducedBeforeSingleStop =
    qualifiesForReducedBeforeSingleStopFallback(stops, context)
  const qualifiesLeaveEarlyReducedAfterCoverage =
    qualifiesForLeaveEarlyReducedCoverage(stops, context)

  if (
    stops.length >= minimumStopsForMode(context.mode) ||
    qualifiesLateNightSingleStop ||
    qualifiesReducedBeforeSingleStop ||
    qualifiesLeaveEarlyReducedAfterCoverage
  ) {
    score += 0.2
  } else if (context.mode === "full" && stops.length >= 2) {
    score += 0.1
  }

  if (context.anchorVenue?.lat != null && context.anchorVenue?.lon != null) score += 0.1
  if (context.eventTags.length > 0) score += 0.1
  if (
    stops.every(
      (s) => s.distanceMetersFromPrev == null || s.distanceMetersFromPrev < 3000
    )
  ) {
    score += 0.1
  }

  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))))
}

export function buildRationale({
  venueName,
  role,
  distanceMeters,
  eventArchetype,
  mode,
}: {
  venueName: string | null
  role: StopRole
  distanceMeters: number | null
  eventArchetype: string
  mode: PlanMode
}): string {
  const distanceText =
    distanceMeters == null
      ? "a good fit nearby"
      : distanceMeters < 800
      ? "very close to the anchor"
      : distanceMeters < 1800
      ? "a practical short move from the anchor"
      : distanceMeters < 3000
      ? "still workable without breaking flow"
      : "closer to the edge of the outing window"

  const roleText =
    role === "food"
      ? "grounds the outing with a real meal"
      : role === "drink"
      ? "keeps the energy social without overcomplicating the route"
      : role === "coffee"
      ? "creates a low-friction starting point"
      : role === "dessert"
      ? "gives the night a clear closing beat"
      : "adds variety without breaking flow"

  return `${venueName ?? "This stop"} ${roleText}, is ${distanceText}, and fits a ${mode} plan around a ${eventArchetype} event.`
}

export function minimumStopsForMode(mode: PlanMode): number {
  return mode === "full" ? 3 : 2
}

function getPlanningSlots(context: PlanningContext): PlanningSlot[] {
  if (context.slots?.length) {
    return context.slots
  }

  return context.desiredRoles.map((role, index) =>
    fallbackSlotForIndex(index, context, role, context.desiredRoles.length)
  )
}

function fallbackSlotForIndex(
  index: number,
  context: PlanningContext,
  role = context.desiredRoles[index] ?? "activity",
  totalStops = context.desiredRoles.length
): PlanningSlot {
  const timing = computeLegacyStopTiming(index, totalStops, role, context)
  const phase =
    context.mode === "before"
      ? "before"
      : context.mode === "after"
      ? "after"
      : index === 0
      ? "before"
      : "after"

  return {
    index,
    role,
    phase,
    targetArrivalAt: timing.arrival,
    targetDepartureAt: timing.departure,
    dwellMinutes: timing.dwellMinutes,
    strictProgression:
      phase === "before" ? index > 0 : context.mode === "after" ? index === 0 : index === 1,
    flexibleRole: null,
  }
}

function computeLegacyStopTiming(
  index: number,
  totalStops: number,
  role: StopRole,
  context: PlanningContext
): {
  arrival: Date
  departure: Date
  dwellMinutes: number
} {
  const dwellMinutes =
    role === "food" ? 75 : role === "drink" ? 60 : role === "activity" ? 60 : 45
  const effectiveExitAt = getEffectiveExitAt(context)

  if (context.mode === "before") {
    const finalDeparture = addMinutes(context.startsAt, -35)
    const reverseOffset = totalStops - index - 1
    const departure = addMinutes(finalDeparture, -(reverseOffset * 75))
    const arrival = addMinutes(departure, -dwellMinutes)

    return {
      arrival,
      departure,
      dwellMinutes,
    }
  }

  if (context.mode === "after") {
    const arrival = addMinutes(effectiveExitAt, 20 + index * 80)
    const departure = addMinutes(arrival, dwellMinutes)

    return {
      arrival,
      departure,
      dwellMinutes,
    }
  }

  if (index === 0) {
    const departure = addMinutes(context.startsAt, -35)
    const arrival = addMinutes(departure, -dwellMinutes)

    return {
      arrival,
      departure,
      dwellMinutes,
    }
  }

  const arrival = addMinutes(effectiveExitAt, 20 + (index - 1) * 80)
  const departure = addMinutes(arrival, dwellMinutes)

  return {
    arrival,
    departure,
    dwellMinutes,
  }
}

function resolveDisplayTypeForSlot({
  slot,
  role,
  venueTypes,
  venueType,
  timeZone,
}: {
  slot: PlanningSlot
  role: StopRole
  venueTypes: string[]
  venueType: string | null
  timeZone: string
}): string {
  const isWeekend = isWeekendInTimeZone(slot.targetArrivalAt, timeZone)
  const hasBrunch = venueTypes.includes("brunch")
  const hasLunch = venueTypes.includes("lunch")

  if (!isWeekend && hasBrunch && hasLunch) {
    return "lunch"
  }

  if (isWeekend && hasBrunch) {
    return "brunch"
  }

  return (
    pickBestDisplayTypeForRole(slot, role, venueTypes, timeZone) ??
    venueType ??
    role
  )
}

function isWeekendInTimeZone(date: Date, timeZone: string): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date)

  return weekday === "Sat" || weekday === "Sun"
}

function defaultTravelMinutesForSlotIndex(
  context: PlanningContext,
  index: number
): number | null {
  if (index === 0) {
    return context.mode === "after" ? 20 : null
  }

  if (context.mode === "full" && index === 1) {
    return 20
  }

  return 12
}

function defaultTravelMinutesForFirstSlot(
  context: PlanningContext,
  slot: PlanningSlot
): number | null {
  if (slot.phase === "after") return 20
  if (context.mode === "after") return 20
  return null
}

function getEffectiveExitAt(context: PlanningContext): Date {
  return context.effectiveExitAt ?? context.estimatedEndAt
}

function qualifiesForLeaveEarlyReducedCoverage(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (!context.leaveEarlyByHours) return false

  const beforeStops = stops.filter((stop) => stop.phase === "before").length
  const afterStops = stops.filter((stop) => stop.phase === "after").length

  if (context.mode === "after") {
    return afterStops >= 1
  }

  if (context.mode === "full") {
    return beforeStops >= 1 && afterStops >= 1
  }

  return false
}