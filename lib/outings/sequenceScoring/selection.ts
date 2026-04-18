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
  isAfterSequenceDirectionallyConsistent,
  isTooFarForAfterFirstStop,
  isTooFarForBeforeFirstStop,
} from "./geometry"

import {
  isLateNightAfterFallbackContext,
  isLateNightNightlifeType,
} from "./lateNight"

import {
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

export type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: "before" | "after"
  selectedVenueId: string | null
  selectedPass: "strict" | "balanced" | "relaxed" | null
  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: {
    used: number
    role: number
    geometry: number
    temporal: number
    hours: number
    missing_data: number
  }
}

export type SelectionDebugResult = {
  selected: CandidateVenue[]
  slotDiagnostics: SlotSelectionDebug[]
}

export function selectCandidates(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext,
  slots: PlanningSlot[]
): SelectionDebugResult {
  const selected: CandidateVenue[] = []
  const usedIds = new Set<string>()
  const slotDiagnostics: SlotSelectionDebug[] = []
  const timeZone = resolvePlannerTimeZone(context)

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]

    const strictRejections = {
      used: 0,
      role: 0,
      geometry: 0,
      temporal: 0,
      hours: 0,
      missing_data: 0,
    }

    let strictMatchedRole = 0
    let strictPassedHardConstraints = 0

    const matches = rankedCandidates
      .filter((candidate) => {
        if (usedIds.has(candidate.id)) {
          strictRejections.used += 1
          return false
        }

        if (!candidateSupportsSlot(candidate, slot, context, false)) {
          strictRejections.role += 1
          return false
        }
        strictMatchedRole += 1

        const eligibility = evaluateCandidateEligibilityForSlot(
          candidate,
          selected,
          slot,
          context,
          false,
          timeZone
        )

        if (!eligibility.eligible) {
          if (eligibility.reason === "missing_data") {
            strictRejections.missing_data += 1
          } else {
            strictRejections.geometry += 1
          }
          return false
        }

        strictPassedHardConstraints += 1

        const temporal = evaluateTemporalEligibility(
          candidate,
          slot,
          context,
          timeZone,
          false
        )

        if (!temporal.eligible) {
          if (temporal.reason === "hours") strictRejections.hours += 1
          else strictRejections.temporal += 1
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

      slotDiagnostics.push({
        slotIndex: slot.index,
        role: slot.role,
        phase: slot.phase,
        selectedVenueId: best.id,
        selectedPass: "strict",
        candidatesTotal: rankedCandidates.length,
        matchedRole: strictMatchedRole,
        passedHardConstraints: strictPassedHardConstraints,
        rejectionCounts: strictRejections,
      })

      continue
    }

    const relaxedRejections = {
      used: 0,
      role: 0,
      geometry: 0,
      temporal: 0,
      hours: 0,
      missing_data: 0,
    }

    let relaxedMatchedRole = 0
    let relaxedPassedHardConstraints = 0

    const fallbackMatches = rankedCandidates
      .filter((candidate) => {
        if (usedIds.has(candidate.id)) {
          relaxedRejections.used += 1
          return false
        }

        if (!candidateSupportsSlot(candidate, slot, context, true)) {
          relaxedRejections.role += 1
          return false
        }
        relaxedMatchedRole += 1

        const eligibility = evaluateCandidateEligibilityForSlot(
          candidate,
          selected,
          slot,
          context,
          true,
          timeZone
        )

        if (!eligibility.eligible) {
          if (eligibility.reason === "missing_data") {
            relaxedRejections.missing_data += 1
          } else {
            relaxedRejections.geometry += 1
          }
          return false
        }

        relaxedPassedHardConstraints += 1

        const temporal = evaluateTemporalEligibility(
          candidate,
          slot,
          context,
          timeZone,
          true
        )

        if (!temporal.eligible) {
          if (temporal.reason === "hours") relaxedRejections.hours += 1
          else relaxedRejections.temporal += 1
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

      slotDiagnostics.push({
        slotIndex: slot.index,
        role: slot.role,
        phase: slot.phase,
        selectedVenueId: fallbackBest.id,
        selectedPass: "relaxed",
        candidatesTotal: rankedCandidates.length,
        matchedRole: relaxedMatchedRole,
        passedHardConstraints: relaxedPassedHardConstraints,
        rejectionCounts: relaxedRejections,
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
      matchedRole: relaxedMatchedRole || strictMatchedRole,
      passedHardConstraints:
        relaxedPassedHardConstraints || strictPassedHardConstraints,
      rejectionCounts: {
        used: strictRejections.used + relaxedRejections.used,
        role: strictRejections.role + relaxedRejections.role,
        geometry: strictRejections.geometry + relaxedRejections.geometry,
        temporal: strictRejections.temporal + relaxedRejections.temporal,
        hours: strictRejections.hours + relaxedRejections.hours,
        missing_data:
          strictRejections.missing_data + relaxedRejections.missing_data,
      },
    })
  }

  if (context.mode === "full" && selected.length < 2) {
    return { selected, slotDiagnostics }
  }

  return { selected, slotDiagnostics }
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
  selectedSoFar: CandidateVenue[],
  slot: PlanningSlot,
  context: PlanningContext,
  relaxed = false,
  timeZone = resolvePlannerTimeZone(context)
): { eligible: boolean; reason?: "geometry" | "missing_data" } {
  const eligible = isCandidateEligibleForSlot(
    candidate,
    selectedSoFar,
    slot,
    context,
    relaxed,
    timeZone
  )

  return { eligible, reason: eligible ? undefined : "geometry" }
}

export function evaluateTemporalEligibility(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  timeZone: string,
  relaxed = false
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
    }

    return { eligible: lateNightEligibleOverall, reason: lateNightEligibleOverall ? undefined : "hours" }
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
    return { eligible: false, reason: "temporal" }
  }

  const openForWindow = isVenueOpenForWindow(
    candidate,
    slot.targetArrivalAt,
    slot.targetDepartureAt,
    timeZone,
    relaxed
  )

  return {
    eligible: openForWindow,
    reason: openForWindow ? undefined : "hours",
  }
}

export function isCandidateEligibleForSlot(
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

    if (
      slot.index === 0 &&
      isTooFarForBeforeFirstStop(anchorDistance, context.mobility, relaxed)
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
    const isImmediatePostEvent =
      slot.index === 0 || (context.mode === "full" && slot.index === 1)
    const maxInterstop = getMaxAfterInterstopMeters(context.mobility, relaxed)
    const lateNightFallback = isLateNightAfterFallbackContext(context, slot)

    if (
      isImmediatePostEvent &&
      isTooFarForAfterFirstStop(
        anchorDistance,
        context.mobility,
        lateNightFallback ? true : relaxed
      )
    ) {
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

  const types = normalizeVenueTypes(candidate.type)
  const referenceHour = getHourFractionInTimeZone(slot.targetArrivalAt, timeZone)
  const effectiveRole = pickRoleForSlot(slot, candidate.inferredRoles)

  if (effectiveRole === "food" && hasAnyType(types, ["dinner"]) && referenceHour < 12) {
    return false
  }

  if (!relaxed && effectiveRole === "coffee" && referenceHour >= 18) {
    return false
  }

  if (isLateNightAfterFallbackContext(context, slot)) {
    if (!isLateNightNightlifeType(candidate)) return false
  }

  return true
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