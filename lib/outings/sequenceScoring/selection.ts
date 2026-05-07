// lib/outings/sequenceScoring/selection.ts

import type {
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  StopRole,
} from "../types"
import type { CandidateVenue, VenueWithHours } from "./types"

import {
  candidateSupportsSlot,
  computeSlotRoleFitBonus,
  pickRoleForSlot,
} from "./roles"

import {
  getDistanceBetweenVenues,
  getMaxAfterInterstopMeters,
  getMaxAfterLocalFallbackMeters,
  getMaxBeforeInterstopMeters,
  isTooFarForAfterFirstStop,
  isTooFarForBeforeFirstStop,
} from "./geometry"

import {
  isLateNightAfterFallbackContext,
  isLateNightNightlifeType,
} from "./lateNight"

import {
  computeTemporalFitPenalty,
  isLateNightFallbackVenueTemporallyEligible,
  isRoleTemporallyCompatible,
  isVenueOpenForWindow,
  isVenueOpenUntilAtLeastTwoAm,
} from "./temporal"

import {
  hasAnyType,
  isCoffeeLikeVenue,
  isMealLikeVenue,
  normalizeVenueTypes,
} from "./helpers"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

import { computeSequentialCandidateScore } from "./bias"

type SelectionPass = "strict" | "balanced" | "relaxed" | "emergency"

type RejectionCounts = {
  used: number
  role: number
  geometry: number
  temporal: number
  type_time: number
  hours: number
  missing_data: number
}

type SelectionPassConfig = {
  name: SelectionPass
  relaxedRole: boolean
  relaxedGeometry: boolean
  relaxedTemporal: boolean
  allowWeakRoleMatch?: boolean
  bypassLateNightNightlifeType?: boolean
  allowMissingOrUncertainHours?: boolean
}

export type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: "before" | "after"
  selectedVenueId: string | null
  selectedPass: SelectionPass | null
  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: RejectionCounts
}

export type SelectedSlotVenue = {
  venue: CandidateVenue
  slot: PlanningSlot
  selectedPass: SelectionPass
}

export type SelectionDebugResult = {
  selected: SelectedSlotVenue[]
  slotDiagnostics: SlotSelectionDebug[]
}

const SELECTION_PASSES: SelectionPassConfig[] = [
  {
    name: "strict",
    relaxedRole: false,
    relaxedGeometry: false,
    relaxedTemporal: false,
  },
  {
    name: "balanced",
    relaxedRole: true,
    relaxedGeometry: false,
    relaxedTemporal: false,
  },
  {
    name: "relaxed",
    relaxedRole: true,
    relaxedGeometry: true,
    relaxedTemporal: true,
  },
  {
    name: "emergency",
    relaxedRole: true,
    relaxedGeometry: true,
    relaxedTemporal: true,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: true,
    allowMissingOrUncertainHours: true,
  },
]

const DINNER_MINIMUM_LOCAL_HOUR = 17.5

const ALLOWED_AFTER_BACK_TO_BACK_TYPES = ["bar", "cocktail"]

function hasDisallowedBackToBackType(
  previous: CandidateVenue | null,
  candidate: CandidateVenue,
  slot: PlanningSlot
): boolean {
  if (!previous) return false

  const previousTypes = normalizeVenueTypes(previous.type)
  const candidateTypes = normalizeVenueTypes(candidate.type)

  const sharedTypes = previousTypes.filter((type) =>
    candidateTypes.includes(type)
  )

  if (sharedTypes.length === 0) return false

  return sharedTypes.some((type) => {
    if (
      slot.phase === "after" &&
      ALLOWED_AFTER_BACK_TO_BACK_TYPES.includes(type)
    ) {
      return false
    }

    return true
  })
}

function hasAbsurdTimeOfDayMismatch(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  timeZone: string
): boolean {
  const types = normalizeVenueTypes([
    ...(candidate.type ?? []),
    ...(candidate.tags ?? []),
    ...(candidate.vibe ?? []),
    ...(candidate.time_category ?? []),
    candidate.name ?? "",
  ])

  const hour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)

  const hasLateNightIdentity = hasAnyType(types, [
    "bar",
    "cocktail",
    "cocktails",
    "wine bar",
    "lounge",
    "speakeasy",
    "club",
    "brewery",
    "rooftop",
    "sports bar",
    "late night",
    "dessert bar",
    "restaurant",
    "dinner",
    "gastropub",
  ])

  const isMorningOnly = hasAnyType(types, ["bakery", "breakfast"])
  const isBrunchOnly = hasAnyType(types, ["brunch"])
  const isDaytimeCafe = hasAnyType(types, ["coffee", "tea", "cafe", "café"])

  const isCocktailLike = hasAnyType(types, [
    "cocktail",
    "cocktails",
    "wine bar",
    "bar",
    "lounge",
    "speakeasy",
    "club",
    "brewery",
    "rooftop",
    "sports bar",
  ])

  if (
    slot.role === "drink" &&
    slot.phase === "after" &&
    hasLateNightIdentity
  ) {
    return false
  }

  if (isCocktailLike && hour >= 6 && hour < 12) {
    return true
  }

  if (hasLateNightIdentity) {
    return false
  }

  if (isMorningOnly) {
    return hour < 6 || hour >= 12
  }

  if (isBrunchOnly) {
    return hour < 9 || hour >= 14
  }

  if (isDaytimeCafe) {
    return hour < 6 || hour >= 17
  }

  return false
}

function unwrapSelectedVenues(
  selected: SelectedSlotVenue[] | CandidateVenue[]
): CandidateVenue[] {
  return selected.map((entry) =>
    "venue" in entry ? entry.venue : entry
  )
}

function unwrapSelectedSlotVenues(
  selected: SelectedSlotVenue[] | CandidateVenue[]
): SelectedSlotVenue[] {
  return selected.filter(
    (entry): entry is SelectedSlotVenue =>
      typeof entry === "object" &&
      entry != null &&
      "venue" in entry &&
      "slot" in entry
  )
}

function emptyRejectionCounts(): RejectionCounts {
  return {
    used: 0,
    role: 0,
    geometry: 0,
    temporal: 0,
    type_time: 0,
    hours: 0,
    missing_data: 0,
  }
}

function mergeRejectionCounts(
  a: RejectionCounts,
  b: RejectionCounts
): RejectionCounts {
  return {
    used: a.used + b.used,
    role: a.role + b.role,
    geometry: a.geometry + b.geometry,
    temporal: a.temporal + b.temporal,
    type_time: a.type_time + b.type_time,
    hours: a.hours + b.hours,
    missing_data: a.missing_data + b.missing_data,
  }
}

export function selectCandidates(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext,
  slots: PlanningSlot[]
): SelectionDebugResult {
  const selected: SelectedSlotVenue[] = []
  const usedIds = new Set<string>()
  const slotDiagnostics: SlotSelectionDebug[] = []
  const timeZone = resolvePlannerTimeZone(context)

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]

    let aggregateRejections = emptyRejectionCounts()
    let aggregateMatchedRole = 0
    let aggregatePassedHardConstraints = 0

    let selectedForSlot: {
      venue: CandidateVenue
      pass: SelectionPass
      matchedRole: number
      passedHardConstraints: number
      rejectionCounts: RejectionCounts
    } | null = null

    for (const pass of SELECTION_PASSES) {
      const attempt = selectBestCandidateForPass({
        rankedCandidates,
        selected,
        usedIds,
        slot,
        context,
        timeZone,
        pass,
      })

      aggregateRejections = mergeRejectionCounts(
        aggregateRejections,
        attempt.rejectionCounts
      )
      aggregateMatchedRole += attempt.matchedRole
      aggregatePassedHardConstraints += attempt.passedHardConstraints

      if (attempt.best) {
        selectedForSlot = {
          venue: attempt.best,
          pass: pass.name,
          matchedRole: attempt.matchedRole,
          passedHardConstraints: attempt.passedHardConstraints,
          rejectionCounts: attempt.rejectionCounts,
        }
        break
      }
    }

    if (selectedForSlot) {
      selected.push({
        venue: selectedForSlot.venue,
        slot,
        selectedPass: selectedForSlot.pass,
      })

      usedIds.add(selectedForSlot.venue.id)

      slotDiagnostics.push({
        slotIndex: slot.index,
        role: slot.role,
        phase: slot.phase,
        selectedVenueId: selectedForSlot.venue.id,
        selectedPass: selectedForSlot.pass,
        candidatesTotal: rankedCandidates.length,
        matchedRole: selectedForSlot.matchedRole,
        passedHardConstraints: selectedForSlot.passedHardConstraints,
        rejectionCounts: selectedForSlot.rejectionCounts,
      })

      continue
    }

    slotDiagnostics.push({
      slotIndex: slot.index,
      role: slot.role,
      phase: slot.phase,
      selectedVenueId: null,
      selectedPass: null,
      candidatesTotal: rankedCandidates.length,
      matchedRole: aggregateMatchedRole,
      passedHardConstraints: aggregatePassedHardConstraints,
      rejectionCounts: aggregateRejections,
    })
  }

  return { selected, slotDiagnostics }
}

function selectBestCandidateForPass({
  rankedCandidates,
  selected,
  usedIds,
  slot,
  context,
  timeZone,
  pass,
}: {
  rankedCandidates: CandidateVenue[]
  selected: SelectedSlotVenue[]
  usedIds: Set<string>
  slot: PlanningSlot
  context: PlanningContext
  timeZone: string
  pass: SelectionPassConfig
}): {
  best: CandidateVenue | null
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: RejectionCounts
} {
  const rejectionCounts = emptyRejectionCounts()
  let matchedRole = 0
  let passedHardConstraints = 0

  const matches = rankedCandidates
    .filter((candidate) => {
      if (usedIds.has(candidate.id)) {
        rejectionCounts.used += 1
        return false
      }

      const supportsRole =
        candidateSupportsSlot(candidate, slot, context, pass.relaxedRole) ||
        isDaytimeArtFlexibleSlotMatch(candidate, slot, context, timeZone) ||
        isBeforeDinnerFallbackDrinkCandidate({
          candidate,
          rankedCandidates,
          slot,
          timeZone,
        }) ||
        Boolean(pass.allowWeakRoleMatch && isEmergencyCompatibleForSlot(candidate, slot))

      if (!supportsRole) {
        rejectionCounts.role += 1
        return false
      }

      matchedRole += 1

      if (hasAbsurdTimeOfDayMismatch(candidate, slot, timeZone)) {
        rejectionCounts.type_time += 1
        return false
      }

      const dinnerTimingOk = satisfiesBeforeDinnerTimingRule({
        candidate,
        rankedCandidates,
        slot,
        timeZone,
      })

      if (!dinnerTimingOk && !pass.relaxedTemporal) {
        rejectionCounts.temporal += 1
        return false
      }

      const eligibility = evaluateCandidateEligibilityForSlot(
        candidate,
        selected,
        slot,
        context,
        pass.relaxedGeometry,
        timeZone,
        pass.bypassLateNightNightlifeType
      )

      if (!eligibility.eligible) {
        if (eligibility.reason === "missing_data") {
          rejectionCounts.missing_data += 1
        } else {
          rejectionCounts.geometry += 1
        }
        return false
      }

      passedHardConstraints += 1

      const temporal = evaluateTemporalEligibility(
        candidate,
        slot,
        context,
        timeZone,
        pass.relaxedTemporal,
        pass.allowMissingOrUncertainHours
      )

      if (!temporal.eligible) {
        if (temporal.reason === "hours") rejectionCounts.hours += 1
        else rejectionCounts.temporal += 1
        return false
      }

      return true
    })
    .sort((a, b) => {
      const selectedVenues = unwrapSelectedVenues(selected)

      const scoreA =
        computeSequentialCandidateScore(a, selectedVenues, slot, context) +
        computeSlotRoleFitBonus(a, slot) +
        emergencyRoleFitBonus(a, slot, pass) +
        beforeDinnerTimingScoreBonus(a, slot, timeZone) -
        relaxedTemporalPenalty(a, slot, timeZone, pass) -
        beforeDinnerTimingScorePenalty(a, slot, timeZone, pass)

      const scoreB =
        computeSequentialCandidateScore(b, selectedVenues, slot, context) +
        computeSlotRoleFitBonus(b, slot) +
        emergencyRoleFitBonus(b, slot, pass) +
        beforeDinnerTimingScoreBonus(b, slot, timeZone) -
        relaxedTemporalPenalty(b, slot, timeZone, pass) -
        beforeDinnerTimingScorePenalty(b, slot, timeZone, pass)

      const scoreDelta = scoreB - scoreA
      if (Math.abs(scoreDelta) > 0.001) return scoreDelta

      const distanceA = a.distanceMeters ?? Number.POSITIVE_INFINITY
      const distanceB = b.distanceMeters ?? Number.POSITIVE_INFINITY
      const distanceDelta = distanceA - distanceB
      if (Math.abs(distanceDelta) > 1) return distanceDelta

      return a.id.localeCompare(b.id)
    })

  return {
    best: matches[0] ?? null,
    matchedRole,
    passedHardConstraints,
    rejectionCounts,
  }
}

function isEmergencyCompatibleForSlot(
  candidate: CandidateVenue,
  slot: PlanningSlot
): boolean {
  const roles = candidate.inferredRoles ?? []
  const types = normalizeVenueTypes(candidate.type)

  if (roles.includes(slot.role)) return true
  if (slot.flexibleRole && roles.includes(slot.flexibleRole)) return true

  if (slot.role === "drink") {
    return (
      roles.includes("drink") ||
      roles.includes("food") ||
      hasAnyType(types, [
        "bar",
        "wine bar",
        "cocktail",
        "lounge",
        "speakeasy",
        "brewery",
        "rooftop",
        "sports bar",
        "club",
        "restaurant",
        "dinner",
        "gastropub",
        "late night",
      ])
    )
  }

  if (slot.role === "food") {
    return (
      roles.includes("food") ||
      roles.includes("drink") ||
      roles.includes("coffee") ||
      hasAnyType(types, [
        "restaurant",
        "dinner",
        "lunch",
        "cafe",
        "café",
        "gastropub",
      ])
    )
  }

  if (slot.role === "coffee") {
    return (
      roles.includes("coffee") ||
      roles.includes("food") ||
      hasAnyType(types, [
        "coffee",
        "tea",
        "cafe",
        "café",
      ])
    )
  }

  if (slot.role === "dessert") {
    return (
      roles.includes("dessert") ||
      roles.includes("drink") ||
      hasAnyType(types, [
        "dessert",
        "dessert bar",
        "cocktail",
        "wine bar",
        "bar",
        "lounge",
      ])
    )
  }

  if (slot.role === "activity") {
    return (
      roles.includes("activity") ||
      roles.includes("food") ||
      roles.includes("coffee")
    )
  }

  return roles.length > 0
}

function isDaytimeArtFlexibleSlotMatch(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  timeZone: string
): boolean {
  if (context.mode !== "full") return false
  if (context.eventArchetype !== "art") return false

  const types = normalizeVenueTypes([
    ...(candidate.type ?? []),
    ...(candidate.tags ?? []),
    ...(candidate.vibe ?? []),
    ...(candidate.time_category ?? []),
    candidate.name ?? "",
  ])

  const hour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)

  if (slot.index === 0 && slot.role === "coffee") {
    return hasAnyType(types, [
      "coffee",
      "cafe",
      "café",
      "bakery",
      "breakfast",
      "brunch",
      "tea",
      "matcha",
    ])
  }

  if (slot.index === 1 && slot.role === "food") {
    return hasAnyType(types, [
      "restaurant",
      "lunch",
      "brunch",
      "cafe",
      "café",
      "park",
      "garden",
      "bookstore",
      "library",
      "lifestyle",
      "shop",
      "gallery",
      "museum",
      "activity",
    ])
  }

  if (slot.index === 2 && slot.role === "dessert") {
    if (hour < 16) {
      return hasAnyType(types, [
        "dessert",
        "cafe",
        "café",
        "bakery",
        "ice cream",
        "gelato",
      ])
    }

    return hasAnyType(types, [
      "dessert",
      "dessert bar",
      "wine bar",
      "cocktail",
      "bar",
      "lounge",
      "ice cream",
      "gelato",
    ])
  }

  return false
}

function emergencyRoleFitBonus(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  pass: SelectionPassConfig
): number {
  if (pass.name !== "emergency") return 0
  if (candidate.inferredRoles.includes(slot.role)) return 8
  if (slot.flexibleRole && candidate.inferredRoles.includes(slot.flexibleRole)) return 4
  if (isEmergencyCompatibleForSlot(candidate, slot)) return 2
  return 0
}

export function buildSelectionDebug(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext
): {
  candidatePoolSize: number
  preparedCandidateCount: number
  selectedStopCount: number
  completionRate: number
  slotDiagnostics: SlotSelectionDebug[]
} {
  const slots: PlanningSlot[] = context.slots?.length
    ? context.slots
    : context.desiredRoles.map((role, index) => {
        const phase: SlotPhase =
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
          targetArrivalAt: context.plannedStartAt,
          targetDepartureAt: context.plannedEndAt,
          dwellMinutes: 45,
          strictProgression: false,
          flexibleRole: null,
        }
      })

  const selection = selectCandidates(rankedCandidates, context, slots)
  const intendedStopCount = slots.length || context.desiredRoles.length

  return {
    candidatePoolSize: rankedCandidates.length,
    preparedCandidateCount: rankedCandidates.length,
    selectedStopCount: selection.selected.length,
    completionRate:
      intendedStopCount > 0
        ? Number((selection.selected.length / intendedStopCount).toFixed(2))
        : 0,
    slotDiagnostics: selection.slotDiagnostics,
  }
}

export function evaluateCandidateEligibilityForSlot(
  candidate: CandidateVenue,
  selectedSoFar: SelectedSlotVenue[] | CandidateVenue[],
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false,
  timeZone = resolvePlannerTimeZone(context),
  bypassLateNightNightlifeType = false
): { eligible: boolean; reason?: "geometry" | "missing_data" } {
  const eligible = isCandidateEligibleForSlot(
    candidate,
    selectedSoFar,
    slot,
    context,
    relaxed,
    timeZone,
    bypassLateNightNightlifeType
  )

  return { eligible, reason: eligible ? undefined : "geometry" }
}

export function evaluateTemporalEligibility(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  timeZone: string,
  relaxed = false,
  allowMissingOrUncertainHours = false
): { eligible: boolean; reason?: "temporal" | "hours" } {
  const role = pickRoleForSlot(slot, candidate.inferredRoles)

  if (isLateNightAfterFallbackContext(context, slot)) {
    const lateNightEligibleOverall = isLateNightFallbackVenueTemporallyEligible(
      candidate,
      slot,
      context,
      timeZone
    )

    if (!lateNightEligibleOverall) {
      logLateNightTemporalRejection({
        candidate,
        slot,
        context,
        timeZone,
        relaxed,
        role,
        lateNightEligibleOverall,
      })

      if (allowMissingOrUncertainHours) {
        return { eligible: true }
      }
    }

    return {
      eligible: lateNightEligibleOverall,
      reason: lateNightEligibleOverall ? undefined : "hours",
    }
  }

  const roleCompatible = isRoleTemporallyCompatible(
    candidate,
    role,
    slot.targetArrivalAt,
    slot.phase,
    timeZone,
    relaxed
  )

  if (!roleCompatible) {
    if (allowMissingOrUncertainHours) {
      return { eligible: true }
    }

    return { eligible: false, reason: "temporal" }
  }

  const openForWindow = isVenueOpenForWindow(
    candidate,
    slot.targetArrivalAt,
    slot.targetDepartureAt,
    timeZone,
    relaxed
  )

  if (!openForWindow && allowMissingOrUncertainHours) {
    return { eligible: true }
  }

  return {
    eligible: openForWindow,
    reason: openForWindow ? undefined : "hours",
  }
}

export function isCandidateEligibleForSlot(
  candidate: CandidateVenue,
  selectedSoFar: SelectedSlotVenue[] | CandidateVenue[],
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false,
  timeZone = resolvePlannerTimeZone(context),
  bypassLateNightNightlifeType = false
): boolean {
  const selectedVenues = unwrapSelectedVenues(selectedSoFar)
  const selectedSlotVenues = unwrapSelectedSlotVenues(selectedSoFar)

  if (selectedVenues.some((venue) => venue.id === candidate.id)) {
    return false
  }

  const anchorDistance = candidate.distanceMeters
  const previous = selectedVenues[selectedVenues.length - 1] ?? null
  const prevToCandidate = previous ? getDistanceBetweenVenues(previous, candidate) : null

  if (hasDisallowedBackToBackType(previous, candidate, slot)) {
  return false
}


  if (slot.phase === "before") {
    const maxInterstop = getMaxBeforeInterstopMeters(
      context.mobility,
      relaxed,
      context
    )

    if (
      slot.index === 0 &&
      isTooFarForBeforeFirstStop(anchorDistance, context.mobility, relaxed, context)
    ) {
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

      const previousTypes = normalizeVenueTypes(previous?.type)
      const candidateTypes = normalizeVenueTypes(candidate.type)

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
    const afterSelections = selectedSlotVenues.filter(
      (selection) => selection.slot.phase === "after"
    )
    const previousAfterVenue =
      afterSelections[afterSelections.length - 1]?.venue ?? null

    const isImmediatePostEvent = afterSelections.length === 0
    const maxInterstop = getMaxAfterInterstopMeters(
      context.mobility,
      relaxed,
      context
    )
    const lateNightFallback = isLateNightAfterFallbackContext(context, slot)

    if (
      isImmediatePostEvent &&
      isTooFarForAfterFirstStop(
        anchorDistance,
        context.mobility,
        lateNightFallback ? true : relaxed,
        context
      )
    ) {
      return false
    }

    if (!isImmediatePostEvent) {
      const afterPrevToCandidate = previousAfterVenue
        ? getDistanceBetweenVenues(previousAfterVenue, candidate)
        : prevToCandidate

      if (afterPrevToCandidate != null && afterPrevToCandidate > maxInterstop) {
        return false
      }

      const sameDirection = isDirectionallyConsistentFromAfterStops(
        afterSelections,
        candidate,
        context
      )
      const maxLocalFallbackMeters = getMaxAfterLocalFallbackMeters(
        context.mobility,
        context
      )

      if (
        !sameDirection &&
        afterPrevToCandidate != null &&
        afterPrevToCandidate > maxLocalFallbackMeters
      ) {
        return false
      }

      if (
        previousAfterVenue?.distanceMeters != null &&
        anchorDistance != null &&
        anchorDistance + 250 < previousAfterVenue.distanceMeters &&
        (afterPrevToCandidate == null || afterPrevToCandidate > maxLocalFallbackMeters)
      ) {
        return false
      }
    }
  }

  const types = normalizeVenueTypes(candidate.type)
  const referenceHour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)
  const effectiveRole = pickRoleForSlot(slot, candidate.inferredRoles)
  const isClubType = hasAnyType(types, ["club"])

  if (slot.phase === "before" && isClubType) {
    return false
  }

  if (slot.phase === "after" && isClubType) {
    const afterSelections = selectedSlotVenues.filter(
      (selection) => selection.slot.phase === "after"
    )

    if (afterSelections.length < 1) {
      return false
    }
  }

  if (effectiveRole === "food" && hasAnyType(types, ["dinner"]) && referenceHour < 12) {
    return false
  }

  if (!relaxed && effectiveRole === "coffee" && referenceHour >= 18) {
    return false
  }

  if (
    isLateNightAfterFallbackContext(context, slot) &&
    !bypassLateNightNightlifeType
  ) {
    if (!isLateNightNightlifeType(candidate)) return false
  }

  return true
}

function isDirectionallyConsistentFromAfterStops(
  afterSelections: SelectedSlotVenue[],
  candidate: CandidateVenue,
  context: PlanningContext
): boolean {
  const anchor = context.anchorVenue
  const firstPostEventStop = afterSelections[0]?.venue ?? null
  const previous = afterSelections[afterSelections.length - 1]?.venue ?? null

  if (!anchor || !firstPostEventStop || !previous) return true
  if (afterSelections.length < 1) return true

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

function isBeforeDinnerFoodSlot({
  slot,
  timeZone,
}: {
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (slot.phase !== "before") return false
  if (slot.role !== "food") return false

  const hour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)
  return hour < DINNER_MINIMUM_LOCAL_HOUR
}

function isHybridDinnerDrinkVenue(candidate: CandidateVenue): boolean {
  const types = normalizeVenueTypes(candidate.type)

  return (
    hasAnyType(types, ["dinner"]) &&
    hasAnyType(types, ["cocktail", "bar", "wine bar", "lounge"])
  )
}

function isEarlyDinnerFallbackDrinkVenue(candidate: CandidateVenue): boolean {
  const types = normalizeVenueTypes(candidate.type)
  return hasAnyType(types, ["cocktail", "wine bar"])
}

function hasHybridDinnerDrinkCandidate({
  rankedCandidates,
  slot,
  timeZone,
}: {
  rankedCandidates: CandidateVenue[]
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (!isBeforeDinnerFoodSlot({ slot, timeZone })) return false
  return rankedCandidates.some(isHybridDinnerDrinkVenue)
}

function isBeforeDinnerFallbackDrinkCandidate({
  candidate,
  rankedCandidates,
  slot,
  timeZone,
}: {
  candidate: CandidateVenue
  rankedCandidates: CandidateVenue[]
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (!isBeforeDinnerFoodSlot({ slot, timeZone })) return false
  if (hasHybridDinnerDrinkCandidate({ rankedCandidates, slot, timeZone })) return false

  return isEarlyDinnerFallbackDrinkVenue(candidate)
}

function satisfiesBeforeDinnerTimingRule({
  candidate,
  rankedCandidates,
  slot,
  timeZone,
}: {
  candidate: CandidateVenue
  rankedCandidates: CandidateVenue[]
  slot: PlanningSlot
  timeZone: string
}): boolean {
  if (!isBeforeDinnerFoodSlot({ slot, timeZone })) return true

  const hasHybrid = hasHybridDinnerDrinkCandidate({
    rankedCandidates,
    slot,
    timeZone,
  })

  if (hasHybrid) {
    return isHybridDinnerDrinkVenue(candidate)
  }

  if (isEarlyDinnerFallbackDrinkVenue(candidate)) {
    return true
  }

  const types = normalizeVenueTypes(candidate.type)

  if (hasAnyType(types, ["dinner"])) {
    return false
  }

  return false
}

function beforeDinnerTimingScoreBonus(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  timeZone: string
): number {
  if (!isBeforeDinnerFoodSlot({ slot, timeZone })) return 0
  if (isHybridDinnerDrinkVenue(candidate)) return 12
  if (isEarlyDinnerFallbackDrinkVenue(candidate)) return 6
  return 0
}

function relaxedTemporalPenalty(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  timeZone: string,
  pass: SelectionPassConfig
): number {
  if (!pass.relaxedTemporal) return 0

  const role = pickRoleForSlot(slot, candidate.inferredRoles)

  return computeTemporalFitPenalty(
    candidate,
    role,
    slot.targetArrivalAt,
    slot.phase,
    timeZone
  )
}

function beforeDinnerTimingScorePenalty(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  timeZone: string,
  pass: SelectionPassConfig
): number {
  if (!isBeforeDinnerFoodSlot({ slot, timeZone })) return 0

  const types = normalizeVenueTypes(candidate.type)

  if (isHybridDinnerDrinkVenue(candidate)) return 0
  if (isEarlyDinnerFallbackDrinkVenue(candidate)) return 2

  if (hasAnyType(types, ["dinner"])) {
    return pass.name === "relaxed" ? 10 : 16
  }

  return pass.name === "emergency" ? 6 : 12
}

function logLateNightTemporalRejection({
  candidate,
  slot,
  context,
  timeZone,
  relaxed,
  role,
  lateNightEligibleOverall,
}: {
  candidate: CandidateVenue
  slot: PlanningSlot
  context: PlanningContext
  timeZone: string
  relaxed: boolean
  role: StopRole
  lateNightEligibleOverall: boolean
}): void {
  const rawHours = (candidate as CandidateVenue & { hours?: unknown }).hours
  const passesTwoAm =
    rawHours != null
      ? isVenueOpenUntilAtLeastTwoAm(
          candidate as CandidateVenue & VenueWithHours,
          slot.targetArrivalAt,
          timeZone
        )
      : false

  console.log(
    "LATE_NIGHT_AFTER_HOURS_REJECTION",
    JSON.stringify(
      {
        venueId: candidate.id,
        venueName: candidate.name ?? null,
        venueType: candidate.type ?? null,
        inferredRoles: candidate.inferredRoles,
        chosenRole: role,
        slotIndex: slot.index,
        slotPhase: slot.phase,
        mode: context.mode,
        relaxed,
        arrival: slot.targetArrivalAt?.toISOString?.(),
        departure: slot.targetDepartureAt?.toISOString?.(),
        timeZone,
        lateNightEligibleOverall,
        passesTwoAm,
        rawHours,
      },
      null,
      2
    )
  )
}