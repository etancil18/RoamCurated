// lib/outings/sequenceScoring.ts

import { CITY_CONFIGS } from "@/config/cities"
import type {
  Budget,
  GeneratedOutingStop,
  Mobility,
  PlanMode,
  PlanningContext,
  PlanningSlot,
  StopRole,
  VenueRecord,
} from "./types"
import {
  getDiscouragedTypesForGroupSize,
  getPreferredTypesForGroupSize,
} from "./groupSizePresets"
import {
  expandVibeTags,
  getDiscouragedTypesForVibe,
  getPreferredTypesForVibe,
} from "./vibePresets"

type VenueHoursEntry = {
  open?: string | null
  close?: string | null
}

type VenueWithHours = VenueRecord & {
  hours?: Record<string, VenueHoursEntry> | string | null
  type?: string | string[] | null
  vibe?: string | string[] | null
  tags?: string[] | string | null
}

export type CandidateVenue = VenueRecord & {
  inferredRoles: StopRole[]
  distanceMeters: number | null
  score: number
}

const DEFAULT_TIME_ZONE = "America/New_York"

export function rankVenueCandidates(
  venues: VenueRecord[],
  context: PlanningContext
): CandidateVenue[] {
  const anchorLat = context.anchorVenue?.lat ?? null
  const anchorLon = context.anchorVenue?.lon ?? null
  const desiredRoles = getDesiredRolesForRanking(context)

  return venues
    .map((venue) => {
      const inferredRoles = inferVenueRoles(venue)
      const distanceMeters =
        anchorLat != null &&
        anchorLon != null &&
        venue.lat != null &&
        venue.lon != null
          ? haversineMeters(anchorLat, anchorLon, venue.lat, venue.lon)
          : null

      let score = 0

      score += inferredRoles.filter((role) => desiredRoles.includes(role)).length * 30
      score += scoreDistanceFromAnchor(distanceMeters, context.mobility)
      score += scoreBudgetFit(venue.price, context.budget)
      score += scoreVibeFit(venue, context.vibeTags)
      score += scoreArchetypeFit(venue, context)
      score += scoreGroupFit(venue, context.groupSize)

      return {
        ...venue,
        inferredRoles,
        distanceMeters,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function generatePlanStops(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext
): GeneratedOutingStop[] {
  const slots = getPlanningSlots(context)
  const selected = selectCandidates(rankedCandidates, context, slots)
  const timeZone = resolvePlannerTimeZone(context)

  return selected.map((venue, index) => {
    const slot = slots[index] ?? fallbackSlotForIndex(index, context)
    const role = pickRoleForSlot(slot, venue.inferredRoles)
    const previousVenue = index > 0 ? selected[index - 1] : null
    const distanceFromPrev =
      previousVenue != null
        ? getDistanceBetweenVenues(previousVenue, venue)
        : venue.distanceMeters

    const venueTypes = normalizeVenueTypes((venue as VenueWithHours).type)
    const venueType = normalizeDisplayVenueType((venue as VenueWithHours).type)
    const displayType =
      pickBestDisplayTypeForRole(slot, role, venueTypes, timeZone) ?? venueType ?? role

    return {
      venueId: venue.id,
      stopOrder: index + 1,
      role,
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
      metadata: {
        venueName: venue.name,
        venueAddress: venue.address,
        score: venue.score,
        inferredRoles: venue.inferredRoles,
        venueTypes,
        venueType,
        displayType,
        appliedDisplayType: displayType,
      },
    }
  })
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

  return [
    `A ${modeLabel} plan for ${eventTitle ?? "this event"}`,
    venueName ? `anchored around ${venueName}` : null,
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

  if (stops.length >= minimumStopsForMode(context.mode)) score += 0.2
  else if (context.mode === "full" && stops.length >= 2) score += 0.1

  if (context.anchorVenue?.lat != null && context.anchorVenue?.lon != null) score += 0.1
  if (context.eventTags.length > 0) score += 0.1
  if (stops.every((s) => s.distanceMetersFromPrev == null || s.distanceMetersFromPrev < 3000)) {
    score += 0.1
  }

  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))))
}

export function inferVenueRoles(venue: VenueRecord): StopRole[] {
  const types = normalizeVenueTypes((venue as VenueWithHours).type)
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
    const arrival = addMinutes(context.estimatedEndAt, 20 + index * 80)
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

  const arrival = addMinutes(context.estimatedEndAt, 20 + (index - 1) * 80)
  const departure = addMinutes(arrival, dwellMinutes)

  return {
    arrival,
    departure,
    dwellMinutes,
    travelMinutesFromPrev: index === 1 ? 20 : 12,
  }
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

export function pickRoleForIndex(
  index: number,
  candidateRoles: StopRole[],
  desiredRoles: StopRole[]
): StopRole {
  const desiredRole = desiredRoles[index]
  if (desiredRole && candidateRoles.includes(desiredRole)) return desiredRole
  return candidateRoles[0] ?? "activity"
}

export function inferTravelMode(
  mobility: Mobility,
  distanceMeters: number | null
): "walk" | "drive" | "transit" | "rideshare" {
  if (mobility === "walk") return "walk"
  if (distanceMeters != null && distanceMeters < 1200) return "walk"
  if (mobility === "short_ride") return "rideshare"
  return "drive"
}

export function normalizePrice(
  value: string | number | null | undefined
): Budget | null {
  const allowedBudgets: Budget[] = ["$", "$$", "$$$", "$$$$"]

  if (typeof value === "number") {
    const n = Math.max(1, Math.min(4, Math.round(value)))
    return "$".repeat(n) as Budget
  }

  if (typeof value === "string") {
    const cleaned = value.trim()
    if (allowedBudgets.includes(cleaned as Budget)) return cleaned as Budget

    const dollarCount = cleaned.replace(/[^$]/g, "").length
    if (dollarCount >= 1 && dollarCount <= 4) {
      return "$".repeat(dollarCount) as Budget
    }
  }

  return null
}

export function priceToInt(value: Budget | null): number {
  return value ? value.length : 0
}

export function normalizeTags(values: string[]): string[] {
  return values
    .flatMap((value) => String(value).toLowerCase().split(/[\s,./|_-]+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function humanizeRole(role: StopRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusMeters = 6371e3

  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const deltaPhi = toRad(lat2 - lat1)
  const deltaLambda = toRad(lon2 - lon1)

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(earthRadiusMeters * c)
}

function selectCandidates(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext,
  slots: PlanningSlot[]
): CandidateVenue[] {
  const selected: CandidateVenue[] = []
  const usedIds = new Set<string>()
  const timeZone = resolvePlannerTimeZone(context)

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]

    const matches = rankedCandidates
      .filter((candidate) => {
        if (usedIds.has(candidate.id)) return false
        if (!candidateSupportsSlot(candidate, slot, context, false)) return false
        if (!isCandidateEligibleForSlot(candidate, selected, slot, context, false, timeZone)) {
          return false
        }
        if (
          !isVenueTemporallyEligible(
            candidate,
            pickRoleForSlot(slot, candidate.inferredRoles),
            slot.targetArrivalAt,
            slot.targetDepartureAt,
            slot.phase,
            timeZone,
            false
          )
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        const scoreA =
          computeSequentialCandidateScore(a, selected, slot, context) +
          computeSlotRoleFitBonus(a, slot)
        const scoreB =
          computeSequentialCandidateScore(b, selected, slot, context) +
          computeSlotRoleFitBonus(b, slot)
        return scoreB - scoreA
      })

    const best = matches[0]
    if (best) {
      selected.push(best)
      usedIds.add(best.id)
      continue
    }

    const fallbackMatches = rankedCandidates
      .filter((candidate) => {
        if (usedIds.has(candidate.id)) return false
        if (!candidateSupportsSlot(candidate, slot, context, true)) return false
        if (!isCandidateEligibleForSlot(candidate, selected, slot, context, true, timeZone)) {
          return false
        }
        if (
          !isVenueTemporallyEligible(
            candidate,
            pickRoleForSlot(slot, candidate.inferredRoles),
            slot.targetArrivalAt,
            slot.targetDepartureAt,
            slot.phase,
            timeZone,
            true
          )
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        const scoreA =
          computeSequentialCandidateScore(a, selected, slot, context) +
          computeSlotRoleFitBonus(a, slot)
        const scoreB =
          computeSequentialCandidateScore(b, selected, slot, context) +
          computeSlotRoleFitBonus(b, slot)
        return scoreB - scoreA
      })

    const fallbackBest = fallbackMatches[0]
    if (fallbackBest) {
      selected.push(fallbackBest)
      usedIds.add(fallbackBest.id)
    }
  }

  if (context.mode === "full" && selected.length < 2) {
    return selected
  }

  return selected
}

function candidateSupportsSlot(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false
): boolean {
  const acceptableRoles = getAcceptableRolesForSlot(slot, candidate, context, relaxed)
  return acceptableRoles.some((role) => candidate.inferredRoles.includes(role))
}

function getAcceptableRolesForSlot(
  slot: PlanningSlot,
  candidate: CandidateVenue,
  context: PlanningContext,
  relaxed = false
): StopRole[] {
  const roles: StopRole[] = [slot.role]
  const types = normalizeVenueTypes((candidate as VenueWithHours).type)
  const hour = getHourFractionInTimeZone(slot.targetArrivalAt, resolvePlannerTimeZone(context))

  if (slot.flexibleRole) {
    roles.push(slot.flexibleRole)
  }

  if (slot.phase === "before" && slot.role === "food") {
    if (hour < 12.5 && hasAnyType(types, ["breakfast", "brunch", "cafe", "café"])) {
      roles.push("coffee")
    }

    if (relaxed && hour < 12.5 && hasAnyType(types, ["bakery"])) {
      roles.push("coffee")
    }
  }

  if (slot.phase === "before" && slot.role === "coffee") {
    if (hour < 13 && hasAnyType(types, ["breakfast", "brunch", "cafe", "café"])) {
      roles.push("food")
    }
  }

  return uniqueRoles(roles)
}

function computeSlotRoleFitBonus(
  candidate: CandidateVenue,
  slot: PlanningSlot
): number {
  if (candidate.inferredRoles.includes(slot.role)) return 14
  if (slot.flexibleRole && candidate.inferredRoles.includes(slot.flexibleRole)) return 6
  return 0
}

function isCandidateEligibleForSlot(
  candidate: CandidateVenue,
  selectedSoFar: CandidateVenue[],
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false,
  timeZone = resolvePlannerTimeZone(context)
): boolean {
  const anchorDistance = candidate.distanceMeters
  const previous = selectedSoFar[selectedSoFar.length - 1] ?? null
  const prevToCandidate = previous ? getDistanceBetweenVenues(previous, candidate) : null

  if (slot.phase === "before") {
    const maxInterstop = relaxed ? 4500 : 3500

    if (slot.index === 0 && isTooFarForBeforeFirstStop(anchorDistance, context.mobility, relaxed)) {
      return false
    }

    if (slot.index > 0) {
      if (
        slot.strictProgression &&
        !relaxed &&
        anchorDistance != null &&
        previous?.distanceMeters != null &&
        anchorDistance > previous.distanceMeters + 250
      ) {
        return false
      }

      if (prevToCandidate != null && prevToCandidate > maxInterstop) {
        return false
      }

      const previousTypes = normalizeVenueTypes((previous as VenueWithHours).type)
      const candidateTypes = normalizeVenueTypes((candidate as VenueWithHours).type)

      const previousIsCoffeeLike = isCoffeeLikeVenue(previousTypes)
      const previousIsMealLike = isMealLikeVenue(previousTypes)
      const candidateIsCoffeeLike = isCoffeeLikeVenue(candidateTypes)

      if (previousIsCoffeeLike && candidateIsCoffeeLike) {
        return false
      }

      if (previousIsMealLike && candidateIsCoffeeLike) {
        return false
      }
    }
  }

  if (slot.phase === "after") {
    const isImmediatePostEvent = slot.index === 0 || (context.mode === "full" && slot.index === 1)
    const maxInterstop = getMaxAfterInterstopMeters(context.mobility, relaxed)

    if (isImmediatePostEvent && isTooFarForAfterFirstStop(anchorDistance, context.mobility, relaxed)) {
      return false
    }

    if (!isImmediatePostEvent && prevToCandidate != null && prevToCandidate > maxInterstop) {
      return false
    }

    if (!isImmediatePostEvent) {
      const sameDirection = isAfterSequenceDirectionallyConsistent(
        selectedSoFar,
        candidate,
        context,
        slot
      )
      const maxLocalFallbackMeters = getMaxAfterLocalFallbackMeters(context.mobility)

      if (!sameDirection && prevToCandidate != null && prevToCandidate > maxLocalFallbackMeters) {
        return false
      }

      if (
        previous?.distanceMeters != null &&
        anchorDistance != null &&
        anchorDistance + 250 < previous.distanceMeters &&
        (prevToCandidate == null || prevToCandidate > maxLocalFallbackMeters)
      ) {
        return false
      }
    }
  }

  const types = normalizeVenueTypes((candidate as VenueWithHours).type)
  const referenceHour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)
  const effectiveRole = pickRoleForSlot(slot, candidate.inferredRoles)

  if (effectiveRole === "food" && hasAnyType(types, ["dinner"]) && referenceHour < 12) return false
  if (!relaxed && effectiveRole === "coffee" && referenceHour >= 18) return false

  return true
}

function isTooFarForBeforeFirstStop(
  anchorDistance: number | null,
  mobility: Mobility,
  relaxed = false
): boolean {
  if (anchorDistance == null) return false
  if (mobility === "walk") return anchorDistance > (relaxed ? 2000 : 1400)
  if (mobility === "short_ride") return anchorDistance > (relaxed ? 3800 : 2800)
  return anchorDistance > (relaxed ? 5500 : 4500)
}

function isTooFarForAfterFirstStop(
  anchorDistance: number | null,
  mobility: Mobility,
  relaxed = false
): boolean {
  if (anchorDistance == null) return false
  if (mobility === "walk") return anchorDistance > (relaxed ? 2200 : 1600)
  if (mobility === "short_ride") return anchorDistance > (relaxed ? 4200 : 3200)
  return anchorDistance > (relaxed ? 6000 : 5000)
}

function computeSequentialCandidateScore(
  candidate: CandidateVenue,
  selectedSoFar: CandidateVenue[],
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
    const isImmediatePostEvent = slot.index === 0 || (context.mode === "full" && slot.index === 1)

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

  return score
}

function computeBeforeFirstStopDistanceBonus(
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

function computeBeforeProgressionBonus(
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

function computeBeforeConsumptionProgressionScore(
  previous: CandidateVenue | null,
  candidate: CandidateVenue
): number {
  if (!previous) return 0

  const previousTypes = normalizeVenueTypes((previous as VenueWithHours).type)
  const candidateTypes = normalizeVenueTypes((candidate as VenueWithHours).type)

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

function computeAfterFirstStopDistanceBonus(
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

function computeAfterExpansionBonus(
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

function computeAfterDirectionalConsistencyBonus(
  selectedSoFar: CandidateVenue[],
  candidate: CandidateVenue,
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

function computeModeSpecificVenueBias(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): number {
  const types = normalizeVenueTypes((candidate as VenueWithHours).type)
  const referenceHour = getHourFractionInTimeZone(
    slot.targetArrivalAt,
    resolvePlannerTimeZone(context)
  )

  if (slot.phase === "before") {
    if (referenceHour < 11) {
      if (hasAnyType(types, ["coffee", "cafe", "café", "tea", "bakery", "breakfast", "brunch"])) {
        return 16
      }
      if (hasAnyType(types, ["dinner"])) return -26
    } else if (referenceHour < 15) {
      if (hasAnyType(types, ["lunch", "brunch", "breakfast", "cafe", "café", "bookstore", "gallery"])) {
        return 14
      }
      if (hasAnyType(types, ["dinner"])) return -18
    } else if (referenceHour < 18) {
      if (hasAnyType(types, ["lunch", "brunch", "gallery", "museum", "park", "garden"])) return 10
    } else {
      if (hasAnyType(types, ["dinner", "cocktail", "wine bar", "rooftop", "bar"])) return 12
      if (hasAnyType(types, ["coffee", "tea", "breakfast"])) return -12
    }
  }

  if (slot.phase === "after") {
    if (referenceHour >= 21) {
      if (hasAnyType(types, ["bar", "cocktail", "lounge", "club", "speakeasy", "brewery", "dessert"])) {
        return 16
      }
      if (hasAnyType(types, ["breakfast", "lunch", "coffee", "tea", "library"])) return -24
    } else if (referenceHour >= 17) {
      if (hasAnyType(types, ["dinner", "bar", "cocktail", "wine bar", "rooftop", "brewery", "dessert"])) {
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

function scoreDistanceFromAnchor(
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

function scoreBudgetFit(
  value: string | number | null | undefined,
  budget: Budget | null
): number {
  if (!budget) return 0
  const priceString = normalizePrice(value)
  if (priceString === budget) return 10
  if (Math.abs(priceToInt(priceString) - priceToInt(budget)) === 1) return 5
  return 0
}

function scoreVibeFit(venue: VenueRecord, vibeTags: string[]): number {
  if (vibeTags.length === 0) return 0

  const expandedVibeTags = expandVibeTags(vibeTags)
  const preferredTypes = getPreferredTypesForVibe(vibeTags)
  const discouragedTypes = getDiscouragedTypesForVibe(vibeTags)

  const normalizedVenueTags = uniqueStrings([
    ...normalizeStringArray((venue as VenueWithHours).tags),
    ...normalizeStringArray((venue as VenueWithHours).vibe),
    ...normalizeStringArray((venue as VenueWithHours).type),
  ])
  const venueTypes = normalizeVenueTypes((venue as VenueWithHours).type)

  let score = 0

  score += expandedVibeTags.filter((tag) => normalizedVenueTags.includes(tag)).length * 8

  if (preferredTypes.length > 0) {
    score += preferredTypes.filter((type) => venueTypes.includes(type)).length * 6
  }

  if (discouragedTypes.length > 0) {
    score -= discouragedTypes.filter((type) => venueTypes.includes(type)).length * 6
  }

  return score
}

function scoreGroupFit(venue: VenueRecord, groupSize: number | null): number {
  if (!groupSize) return 0

  const preferredTypes = getPreferredTypesForGroupSize(groupSize)
  const discouragedTypes = getDiscouragedTypesForGroupSize(groupSize)
  const venueTypes = normalizeVenueTypes((venue as VenueWithHours).type)

  let score = 0

  if (preferredTypes.length > 0) {
    score += preferredTypes.filter((type) => venueTypes.includes(type)).length * 6
  }

  if (discouragedTypes.length > 0) {
    score -= discouragedTypes.filter((type) => venueTypes.includes(type)).length * 6
  }

  return score
}

function scoreArchetypeFit(venue: VenueRecord, context: PlanningContext): number {
  if (context.mode === "before") return 0

  const types = normalizeVenueTypes((venue as VenueWithHours).type)
  const tags = uniqueStrings([
    ...normalizeStringArray((venue as VenueWithHours).type),
    ...normalizeStringArray((venue as VenueWithHours).vibe),
    ...normalizeStringArray((venue as VenueWithHours).tags),
  ])
  let score = 0

  if (context.eventArchetype === "music") {
    if (hasAnyType(types, ["club", "cocktail", "bar", "lounge", "rooftop", "music"])) score += 8
    if (tags.some((t) => ["live", "music", "show"].includes(t))) score += 4
  }

  if (context.eventArchetype === "art") {
    if (hasAnyType(types, ["gallery", "museum", "bookstore", "wine", "wine bar"])) score += 8
  }

  if (context.eventArchetype === "sports") {
    if (hasAnyType(types, ["sports bar", "bar", "brewery"])) score += 8
  }

  if (context.eventArchetype === "festival") {
    if (hasAnyType(types, ["market", "club", "music", "dessert"])) score += 6
  }

  return score
}

function isVenueTemporallyEligible(
  venue: CandidateVenue,
  role: StopRole,
  arrival: Date,
  departure: Date,
  phase: "before" | "after",
  timeZone: string,
  relaxed = false
): boolean {
  if (!isRoleTemporallyCompatible(venue, role, arrival, phase, timeZone, relaxed)) return false

  const minimumOpenUntil =
    phase === "after" ? addMinutes(arrival, relaxed ? 60 : 90) : departure

  return isVenueOpenForWindow(venue as VenueWithHours, arrival, minimumOpenUntil, timeZone, relaxed)
}

function isRoleTemporallyCompatible(
  venue: CandidateVenue,
  role: StopRole,
  arrival: Date,
  phase: "before" | "after",
  timeZone: string,
  relaxed = false
): boolean {
  const hour = getHourFractionInTimeZone(arrival, timeZone)
  const types = normalizeVenueTypes((venue as VenueWithHours).type)

  if (hasAnyType(types, ["breakfast"])) return hour >= 6 && hour <= (relaxed ? 12.5 : 11.5)
  if (hasAnyType(types, ["lunch"])) return hour >= 11 && hour <= (relaxed ? 16.5 : 15.5)
  if (hasAnyType(types, ["dinner"])) return hour >= (relaxed ? 15.5 : 16.5)
  if (hasAnyType(types, ["brunch"])) return hour >= 9 && hour <= (relaxed ? 14 : 13.5)

  if (hasAnyType(types, ["coffee", "cafe", "café", "tea"])) {
    if (!relaxed && phase !== "before" && hour >= 18) return false
    return hour >= 6 && hour <= (relaxed ? 19 : 18)
  }

  if (hasAnyType(types, ["bakery"])) return hour >= 7 && hour <= (relaxed ? 18 : 17)
  if (hasAnyType(types, ["dessert"])) return hour >= 12
  if (hasAnyType(types, ["gallery", "museum", "bookstore", "library"])) {
    return hour >= 10 && hour <= (relaxed ? 21 : 20)
  }
  if (
    hasAnyType(types, [
      "bar",
      "sports bar",
      "cocktail",
      "lounge",
      "speakeasy",
      "club",
      "brewery",
      "rooftop",
      "wine bar",
    ])
  ) {
    return hour >= (relaxed ? 14 : 15)
  }

  if (!relaxed && role === "coffee" && hour >= 18) return false
  if (role === "food" && hour < (relaxed ? 9 : 10)) return false
  if (role === "drink" && hour < (relaxed ? 13 : 14)) return false

  return true
}

function isVenueOpenForWindow(
  venue: VenueWithHours,
  start: Date,
  end: Date,
  timeZone: string,
  relaxed = false
): boolean {
  const hours = normalizeVenueHours(venue.hours)
  if (!hours) return true

  const entry = hours[getDayKey(start, timeZone)]
  if (!entry?.open || !entry?.close) return false

  const openMinutes = parseTimeToMinutes(entry.open)
  let closeMinutes = parseTimeToMinutes(entry.close)
  if (openMinutes == null || closeMinutes == null) return false

  const startMinutes = getLocalMinutesInDay(start, timeZone)
  let endMinutes = getLocalMinutesInDay(end, timeZone)

  const crossesMidnight =
    closeMinutes <= openMinutes || entry.close.toLowerCase().includes("12:00 am")

  if (crossesMidnight) {
    closeMinutes += 24 * 60
    if (startMinutes < openMinutes) {
      endMinutes += 24 * 60
      const shiftedStart = startMinutes + 24 * 60
      return relaxed
        ? shiftedStart >= openMinutes && shiftedStart <= closeMinutes
        : shiftedStart >= openMinutes && endMinutes <= closeMinutes
    }
    return relaxed
      ? startMinutes >= openMinutes && startMinutes <= closeMinutes
      : startMinutes >= openMinutes && endMinutes <= closeMinutes
  }

  return relaxed
    ? startMinutes >= openMinutes && startMinutes <= closeMinutes
    : startMinutes >= openMinutes && endMinutes <= closeMinutes
}

function parseTimeToMinutes(value: string): number | null {
  const raw = value.trim().toLowerCase()
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3]

  if (hours === 12) {
    hours = period === "am" ? 0 : 12
  } else if (period === "pm") {
    hours += 12
  }

  return hours * 60 + minutes
}

function getDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date)
}

function getDesiredRolesForRanking(context: PlanningContext): StopRole[] {
  if (context.slots?.length) {
    return uniqueRoles(
      context.slots.flatMap((slot) =>
        slot.flexibleRole ? [slot.role, slot.flexibleRole] : [slot.role]
      )
    )
  }

  return getDesiredRoles(context)
}

function getDesiredRoles(context: PlanningContext): StopRole[] {
  if (context.slots?.length) {
    return context.slots.map((slot) => slot.role)
  }

  return context.desiredRoles
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
    const arrival = addMinutes(context.estimatedEndAt, 20 + index * 80)
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

  const arrival = addMinutes(context.estimatedEndAt, 20 + (index - 1) * 80)
  const departure = addMinutes(arrival, dwellMinutes)

  return {
    arrival,
    departure,
    dwellMinutes,
  }
}

function pickRoleForSlot(slot: PlanningSlot, candidateRoles: StopRole[]): StopRole {
  if (candidateRoles.includes(slot.role)) return slot.role
  if (slot.flexibleRole && candidateRoles.includes(slot.flexibleRole)) return slot.flexibleRole
  return candidateRoles[0] ?? slot.role
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

function normalizeVenueType(value: string | string[] | null | undefined): string {
  return normalizeVenueTypes(value)[0] ?? ""
}

function normalizeVenueTypes(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeTags([String(entry)]))
      .filter(Boolean)
  }

  const normalized = String(value ?? "").trim()
  if (!normalized) return []

  return normalizeTags([normalized])
}

function normalizeDisplayVenueType(value: string | string[] | null | undefined): string | null {
  const types = normalizeVenueTypes(value)
  return types[0] ?? null
}

function pickBestDisplayTypeForRole(
  slot: PlanningSlot,
  role: StopRole,
  venueTypes: string[],
  timeZone: string
): string | null {
  const arrivalHour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)

  const orderedCandidates =
    role === "coffee"
      ? ["coffee", "tea", "cafe", "café", "bakery", "breakfast", "brunch"]
      : role === "food"
      ? arrivalHour < 11
        ? ["breakfast", "brunch", "lunch", "dinner", "cafe", "café"]
        : arrivalHour < 15
        ? ["lunch", "brunch", "breakfast", "dinner", "cafe", "café"]
        : ["dinner", "lunch", "brunch", "breakfast"]
      : role === "drink"
      ? ["cocktail", "wine bar", "bar", "lounge", "speakeasy", "brewery", "rooftop", "club", "sports bar"]
      : role === "dessert"
      ? ["dessert", "bakery"]
      : ["gallery", "museum", "bookstore", "library", "park", "garden", "music", "market", "showroom", "lifestyle", "spa"]

  return orderedCandidates.find((type) => venueTypes.includes(type)) ?? null
}

function normalizeStringArray(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeTags([String(entry)]))
  }

  if (value == null) return []

  return normalizeTags([String(value)])
}

function normalizeVenueHours(
  value: Record<string, VenueHoursEntry> | string | null | undefined
): Record<string, VenueHoursEntry> | null {
  if (!value) return null

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, VenueHoursEntry>
      return parsed && typeof parsed === "object" ? parsed : null
    } catch {
      return null
    }
  }

  return value
}

function hasAnyType(
  venueTypes: string[],
  expectedTypes: string[]
): boolean {
  return expectedTypes.some((type) => venueTypes.includes(type))
}

function isCoffeeLikeVenue(venueTypes: string[]): boolean {
  return hasAnyType(venueTypes, ["coffee", "tea", "cafe", "café", "bakery"])
}

function isMealLikeVenue(venueTypes: string[]): boolean {
  return hasAnyType(venueTypes, ["breakfast", "brunch", "lunch", "dinner"])
}

function resolvePlannerTimeZone(context: PlanningContext): string {
  const cityKey = context.anchorVenue?.city?.trim().toLowerCase()
  if (!cityKey) return DEFAULT_TIME_ZONE
  return CITY_CONFIGS[cityKey]?.timezone ?? DEFAULT_TIME_ZONE
}

function getHourFractionInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "0"
  const minutePart = parts.find((part) => part.type === "minute")?.value ?? "0"

  return Number(hourPart) + Number(minutePart) / 60
}

function getLocalMinutesInDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hourPart = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minutePart = Number(parts.find((part) => part.type === "minute")?.value ?? "0")

  return hourPart * 60 + minutePart
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function uniqueRoles(roles: StopRole[]): StopRole[] {
  return Array.from(new Set(roles))
}

function getDistanceBetweenVenues(
  from: Pick<VenueRecord, "lat" | "lon">,
  to: Pick<VenueRecord, "lat" | "lon">
): number | null {
  if (
    from.lat == null ||
    from.lon == null ||
    to.lat == null ||
    to.lon == null
  ) {
    return null
  }

  return haversineMeters(from.lat, from.lon, to.lat, to.lon)
}

function estimateTravelMinutes(
  mobility: Mobility,
  distanceMeters: number | null
): number | null {
  if (distanceMeters == null) return null

  if (mobility === "walk") {
    return Math.max(5, Math.round(distanceMeters / 75))
  }

  if (mobility === "short_ride") {
    if (distanceMeters < 1200) {
      return Math.max(5, Math.round(distanceMeters / 75))
    }
    return Math.max(6, Math.round(distanceMeters / 300))
  }

  return Math.max(6, Math.round(distanceMeters / 350))
}

function getMaxAfterInterstopMeters(
  mobility: Mobility,
  relaxed = false
): number {
  if (mobility === "walk") return relaxed ? 1200 : 900
  if (mobility === "short_ride") return relaxed ? 2200 : 1600
  return relaxed ? 3200 : 2400
}

function getMaxAfterLocalFallbackMeters(mobility: Mobility): number {
  if (mobility === "walk") return 700
  if (mobility === "short_ride") return 1400
  return 2200
}

function getFirstPostEventSelectedStop(
  selectedSoFar: CandidateVenue[],
  context: PlanningContext
): CandidateVenue | null {
  if (context.mode === "after") {
    return selectedSoFar[0] ?? null
  }

  if (context.mode === "full") {
    return selectedSoFar[1] ?? null
  }

  return null
}

function isAfterSequenceDirectionallyConsistent(
  selectedSoFar: CandidateVenue[],
  candidate: CandidateVenue,
  context: PlanningContext,
  slot: PlanningSlot
): boolean {
  if (slot.phase !== "after") return true

  const anchor = context.anchorVenue
  const previous = selectedSoFar[selectedSoFar.length - 1] ?? null
  const firstPostEventStop = getFirstPostEventSelectedStop(selectedSoFar, context)

  if (!anchor || !previous || !firstPostEventStop) return true
  if (
    anchor.lat == null ||
    anchor.lon == null ||
    firstPostEventStop.lat == null ||
    firstPostEventStop.lon == null ||
    previous.lat == null ||
    previous.lon == null ||
    candidate.lat == null ||
    candidate.lon == null
  ) {
    return false
  }

  const outboundX = firstPostEventStop.lon - anchor.lon
  const outboundY = firstPostEventStop.lat - anchor.lat
  const stepX = candidate.lon - previous.lon
  const stepY = candidate.lat - previous.lat

  const outboundMagnitude = Math.hypot(outboundX, outboundY)
  const stepMagnitude = Math.hypot(stepX, stepY)

  if (outboundMagnitude === 0 || stepMagnitude === 0) return true

  const dot =
    (outboundX * stepX + outboundY * stepY) /
    (outboundMagnitude * stepMagnitude)

  return dot >= 0.42
}