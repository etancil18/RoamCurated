// lib/outings/sequenceScoring/debug.ts

import type {
  PlanningContext,
  PlanningSlot,
  SelectionDebug,
  SelectionPass,
  SlotPhase,
  SlotSelectionDebug,
  StopRole,
  VibeDaypart,
} from "../types"

import type { CandidateVenue } from "./types"

import {
  selectCandidates,
  type SelectedSlotVenue,
} from "./selection"

import {
  expandVibeTags,
  getDiscouragedDaypartsForVibe,
  getDiscouragedTypesForVibe,
  getPreferredDaypartsForVibe,
  getPreferredTypesForVibe,
  getRequiredAnyTypesForVibe,
  getStronglyDiscouragedTypesForVibe,
} from "../vibePresets"

import {
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
} from "./helpers"

export type CandidateDebugSnapshot = {
  venueId: string
  venueName: string | null
  score: number
  distanceMeters: number | null
  inferredRoles: StopRole[]
  normalizedTypes: string[]
  normalizedTags: string[]
  normalizedVibes: string[]
  normalizedTimeCategories: string[]
  selected: boolean
  selectedSlotIndex: number | null
  selectedPhase: SlotPhase | null
  selectedPass: SelectionPass | null
  vibeMatchedTokens: string[]
  vibePreferredTypeMatches: string[]
  vibeRequiredTypeMatches: string[]
  vibeDiscouragedTypeMatches: string[]
  vibeStronglyDiscouragedTypeMatches: string[]
  vibeMatchConfidence: number | null
  hasCoordinates: boolean
  hasKnownHours: boolean
}

export type SelectionPassSummary = {
  strict: number
  balanced: number
  relaxed: number
  emergency: number
  unselected: number
}

export type RejectionSummary = {
  used: number
  role: number
  geometry: number
  temporal: number
  type_time: number
  hours: number
  missing_data: number
  vibe_required: number
  vibe_discouraged: number
}

export type PlannerDebugSummary = SelectionDebug & {
  intendedStopCount: number
  selectedPassSummary: SelectionPassSummary
  rejectionSummary: RejectionSummary
  candidateSnapshots: CandidateDebugSnapshot[]
  selectedVenueIds: string[]
  strictSelectionRate: number
  emergencySelectionRate: number
  routeVibeConfidence: number | null
  qualityFlags: string[]
}

type BuildPlannerDebugInput = {
  rankedCandidates: CandidateVenue[]
  context: PlanningContext
  slots?: PlanningSlot[]
  selected?: SelectedSlotVenue[]
  includeCandidateSnapshots?: boolean
  maxCandidateSnapshots?: number
}

const DEFAULT_MAX_CANDIDATE_SNAPSHOTS = 100

export function buildSelectionDebug(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext
): SelectionDebug {
  const slots = resolvePlanningSlots(context)
  const selection = selectCandidates(
    rankedCandidates,
    context,
    slots
  )

  const intendedStopCount = slots.length
  const selectedStopCount = selection.selected.length
  const completionRate =
    intendedStopCount > 0
      ? Number(
          (
            selectedStopCount /
            intendedStopCount
          ).toFixed(2)
        )
      : 0

  return {
    candidatePoolSize: rankedCandidates.length,
    preparedCandidateCount: rankedCandidates.length,
    selectedStopCount,
    completionRate,
    slotDiagnostics: selection.slotDiagnostics,
    vibeDiagnostics: buildVibeDiagnostics({
      rankedCandidates,
      selected: selection.selected,
      context,
    }),
  }
}

export function buildPlannerDebugSummary({
  rankedCandidates,
  context,
  slots = resolvePlanningSlots(context),
  selected,
  includeCandidateSnapshots = true,
  maxCandidateSnapshots = DEFAULT_MAX_CANDIDATE_SNAPSHOTS,
}: BuildPlannerDebugInput): PlannerDebugSummary {
  const selection =
    selected != null
      ? {
          selected,
          slotDiagnostics: buildSyntheticSlotDiagnostics({
            slots,
            selected,
            candidateCount: rankedCandidates.length,
          }),
        }
      : selectCandidates(
          rankedCandidates,
          context,
          slots
        )

  const intendedStopCount = slots.length
  const selectedStopCount = selection.selected.length
  const completionRate =
    intendedStopCount > 0
      ? Number(
          Math.min(
            selectedStopCount /
              intendedStopCount,
            1
          ).toFixed(2)
        )
      : 0

  const selectedPassSummary =
    summarizeSelectionPasses(
      selection.selected,
      intendedStopCount
    )

  const rejectionSummary =
    summarizeRejections(
      selection.slotDiagnostics
    )

  const routeVibeConfidence =
    computeRouteVibeConfidence({
      selected: selection.selected,
      context,
    })

  const candidateSnapshots =
    includeCandidateSnapshots
      ? buildCandidateDebugSnapshots({
          rankedCandidates,
          selected: selection.selected,
          context,
          maxCandidates: maxCandidateSnapshots,
        })
      : []

  const selectedVenueIds =
    selection.selected.map(
      (entry) => entry.venue.id
    )

  const strictSelectionRate =
    selectedStopCount > 0
      ? Number(
          (
            selectedPassSummary.strict /
            selectedStopCount
          ).toFixed(2)
        )
      : 0

  const emergencySelectionRate =
    selectedStopCount > 0
      ? Number(
          (
            selectedPassSummary.emergency /
            selectedStopCount
          ).toFixed(2)
        )
      : 0

  return {
    candidatePoolSize:
      rankedCandidates.length,
    preparedCandidateCount:
      rankedCandidates.length,
    selectedStopCount,
    completionRate,
    slotDiagnostics:
      selection.slotDiagnostics,
    vibeDiagnostics:
      buildVibeDiagnostics({
        rankedCandidates,
        selected: selection.selected,
        context,
        routeVibeConfidence,
      }),
    intendedStopCount,
    selectedPassSummary,
    rejectionSummary,
    candidateSnapshots,
    selectedVenueIds,
    strictSelectionRate,
    emergencySelectionRate,
    routeVibeConfidence,
    qualityFlags: buildQualityFlags({
      rankedCandidates,
      selected: selection.selected,
      slotDiagnostics:
        selection.slotDiagnostics,
      intendedStopCount,
      routeVibeConfidence,
    }),
  }
}

export function buildCandidateDebugSnapshots({
  rankedCandidates,
  selected,
  context,
  maxCandidates = DEFAULT_MAX_CANDIDATE_SNAPSHOTS,
}: {
  rankedCandidates: CandidateVenue[]
  selected: SelectedSlotVenue[]
  context: PlanningContext
  maxCandidates?: number
}): CandidateDebugSnapshot[] {
  const selectedByVenueId = new Map<
    string,
    SelectedSlotVenue
  >(
    selected.map((entry) => [
      entry.venue.id,
      entry,
    ])
  )

  const vibeReference =
    buildVibeReference(context)

  return rankedCandidates
    .slice(0, Math.max(0, maxCandidates))
    .map((candidate) => {
      const selectedEntry =
        selectedByVenueId.get(candidate.id) ??
        null

      const normalizedTypes =
        normalizeVenueTypes(candidate.type)

      const normalizedTags =
        uniqueStrings(
          normalizeStringArray(candidate.tags)
        )

      const normalizedVibes =
        uniqueStrings(
          normalizeStringArray(candidate.vibe)
        )

      const normalizedTimeCategories =
        uniqueStrings(
          normalizeStringArray(
            candidate.time_category
          )
        )

      const allTokens =
        uniqueStrings([
          ...normalizedTypes,
          ...normalizedTags,
          ...normalizedVibes,
          ...normalizedTimeCategories,
        ])

      const vibeMatchedTokens =
        intersect(
          allTokens,
          vibeReference.expandedTokens
        )

      const vibePreferredTypeMatches =
        intersect(
          normalizedTypes,
          vibeReference.preferredTypes
        )

      const vibeRequiredTypeMatches =
        intersect(
          normalizedTypes,
          vibeReference.requiredAnyTypes
        )

      const vibeDiscouragedTypeMatches =
        intersect(
          normalizedTypes,
          vibeReference.discouragedTypes
        )

      const vibeStronglyDiscouragedTypeMatches =
        intersect(
          normalizedTypes,
          vibeReference.stronglyDiscouragedTypes
        )

      return {
        venueId: candidate.id,
        venueName: candidate.name ?? null,
        score: candidate.score,
        distanceMeters:
          candidate.distanceMeters ?? null,
        inferredRoles:
          candidate.inferredRoles ?? [],
        normalizedTypes,
        normalizedTags,
        normalizedVibes,
        normalizedTimeCategories,
        selected: selectedEntry != null,
        selectedSlotIndex:
          selectedEntry?.slot.index ?? null,
        selectedPhase:
          selectedEntry?.slot.phase ?? null,
        selectedPass:
          selectedEntry?.selectedPass ?? null,
        vibeMatchedTokens,
        vibePreferredTypeMatches,
        vibeRequiredTypeMatches,
        vibeDiscouragedTypeMatches,
        vibeStronglyDiscouragedTypeMatches,
        vibeMatchConfidence:
          computeCandidateVibeConfidence({
            allTokens,
            normalizedTypes,
            preferredTypes:
              vibeReference.preferredTypes,
            requiredAnyTypes:
              vibeReference.requiredAnyTypes,
            discouragedTypes:
              vibeReference.discouragedTypes,
            stronglyDiscouragedTypes:
              vibeReference.stronglyDiscouragedTypes,
            expandedTokens:
              vibeReference.expandedTokens,
          }),
        hasCoordinates:
          typeof candidate.lat === "number" &&
          Number.isFinite(candidate.lat) &&
          typeof candidate.lon === "number" &&
          Number.isFinite(candidate.lon),
        hasKnownHours:
          hasKnownHours(candidate.hours),
      }
    })
}

export function summarizeSelectionPasses(
  selected: SelectedSlotVenue[],
  intendedStopCount = selected.length
): SelectionPassSummary {
  const summary: SelectionPassSummary = {
    strict: 0,
    balanced: 0,
    relaxed: 0,
    emergency: 0,
    unselected: Math.max(
      intendedStopCount - selected.length,
      0
    ),
  }

  for (const entry of selected) {
    if (entry.selectedPass === "strict") {
      summary.strict += 1
      continue
    }

    if (entry.selectedPass === "balanced") {
      summary.balanced += 1
      continue
    }

    if (entry.selectedPass === "relaxed") {
      summary.relaxed += 1
      continue
    }

    if (entry.selectedPass === "emergency") {
      summary.emergency += 1
    }
  }

  return summary
}

export function summarizeRejections(
  slotDiagnostics: SlotSelectionDebug[]
): RejectionSummary {
  return slotDiagnostics.reduce<RejectionSummary>(
    (summary, diagnostic) => {
      const counts =
        diagnostic.rejectionCounts

      summary.used += counts.used ?? 0
      summary.role += counts.role ?? 0
      summary.geometry +=
        counts.geometry ?? 0
      summary.temporal +=
        counts.temporal ?? 0
      summary.type_time +=
        counts.type_time ?? 0
      summary.hours += counts.hours ?? 0
      summary.missing_data +=
        counts.missing_data ?? 0
      summary.vibe_required +=
        counts.vibe_required ?? 0
      summary.vibe_discouraged +=
        counts.vibe_discouraged ?? 0

      return summary
    },
    {
      used: 0,
      role: 0,
      geometry: 0,
      temporal: 0,
      type_time: 0,
      hours: 0,
      missing_data: 0,
      vibe_required: 0,
      vibe_discouraged: 0,
    }
  )
}

export function computeRouteVibeConfidence({
  selected,
  context,
}: {
  selected: SelectedSlotVenue[]
  context: PlanningContext
}): number | null {
  const vibeReference =
    buildVibeReference(context)

  const hasVibeIntent =
    context.vibeTags.length > 0 ||
    vibeReference.preferredTypes.length > 0 ||
    vibeReference.requiredAnyTypes.length > 0

  if (!hasVibeIntent) {
    return null
  }

  if (selected.length === 0) {
    return 0
  }

  const candidateScores =
    selected.map(({ venue }) => {
      const normalizedTypes =
        normalizeVenueTypes(venue.type)

      const allTokens =
        uniqueStrings([
          ...normalizedTypes,
          ...normalizeStringArray(
            venue.tags
          ),
          ...normalizeStringArray(
            venue.vibe
          ),
          ...normalizeStringArray(
            venue.time_category
          ),
        ])

      return (
        computeCandidateVibeConfidence({
          allTokens,
          normalizedTypes,
          preferredTypes:
            vibeReference.preferredTypes,
          requiredAnyTypes:
            vibeReference.requiredAnyTypes,
          discouragedTypes:
            vibeReference.discouragedTypes,
          stronglyDiscouragedTypes:
            vibeReference.stronglyDiscouragedTypes,
          expandedTokens:
            vibeReference.expandedTokens,
        }) ?? 0
      )
    })

  const average =
    candidateScores.reduce(
      (sum, score) => sum + score,
      0
    ) / candidateScores.length

  const weakest =
    Math.min(...candidateScores)

  return Number(
    clamp01(
      average * 0.75 +
        weakest * 0.25
    ).toFixed(2)
  )
}

function buildVibeDiagnostics({
  rankedCandidates,
  selected,
  context,
  routeVibeConfidence = computeRouteVibeConfidence({
    selected,
    context,
  }),
}: {
  rankedCandidates: CandidateVenue[]
  selected: SelectedSlotVenue[]
  context: PlanningContext
  routeVibeConfidence?: number | null
}): SelectionDebug["vibeDiagnostics"] {
  const vibeReference =
    buildVibeReference(context)

  const hasVibeIntent =
    context.vibeTags.length > 0 ||
    vibeReference.preferredTypes.length > 0 ||
    vibeReference.requiredAnyTypes.length > 0

  if (!hasVibeIntent) {
    return null
  }

  const matchingCandidateCount =
    rankedCandidates.filter((candidate) => {
      const normalizedTypes =
        normalizeVenueTypes(candidate.type)

      const allTokens =
        uniqueStrings([
          ...normalizedTypes,
          ...normalizeStringArray(
            candidate.tags
          ),
          ...normalizeStringArray(
            candidate.vibe
          ),
          ...normalizeStringArray(
            candidate.time_category
          ),
        ])

      return (
        intersect(
          allTokens,
          vibeReference.expandedTokens
        ).length > 0 ||
        intersect(
          normalizedTypes,
          vibeReference.preferredTypes
        ).length > 0
      )
    }).length

  const selectedMatchingCount =
    selected.filter(({ venue }) => {
      const normalizedTypes =
        normalizeVenueTypes(venue.type)

      const allTokens =
        uniqueStrings([
          ...normalizedTypes,
          ...normalizeStringArray(
            venue.tags
          ),
          ...normalizeStringArray(
            venue.vibe
          ),
          ...normalizeStringArray(
            venue.time_category
          ),
        ])

      return (
        intersect(
          allTokens,
          vibeReference.expandedTokens
        ).length > 0 ||
        intersect(
          normalizedTypes,
          vibeReference.preferredTypes
        ).length > 0
      )
    }).length

  return {
    requestedVibes: context.vibeTags,
    preferredTypes:
      vibeReference.preferredTypes,
    requiredAnyTypes:
      vibeReference.requiredAnyTypes,
    discouragedTypes:
      vibeReference.discouragedTypes,
    stronglyDiscouragedTypes:
      vibeReference.stronglyDiscouragedTypes,
    preferredDayparts:
      vibeReference.preferredDayparts,
    discouragedDayparts:
      vibeReference.discouragedDayparts,
    matchedCandidateCount:
      matchingCandidateCount,
    rejectedCandidateCount:
      Math.max(
        matchingCandidateCount -
          selectedMatchingCount,
        0
      ),
    routeVibeConfidence,
  }
}

function buildVibeReference(
  context: PlanningContext
): {
  expandedTokens: string[]
  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]
  preferredDayparts: VibeDaypart[]
  discouragedDayparts: VibeDaypart[]
} {
  const expandedTokens =
    uniqueStrings(
      expandVibeTags(
        context.vibeTags
      )
    )

  return {
    expandedTokens,
    preferredTypes:
      context.vibePlanning?.preferredTypes
        ?.length
        ? context.vibePlanning.preferredTypes
        : getPreferredTypesForVibe(
            context.vibeTags
          ),
    requiredAnyTypes:
      context.vibePlanning
        ?.requiredAnyTypes?.length
        ? context.vibePlanning.requiredAnyTypes
        : getRequiredAnyTypesForVibe(
            context.vibeTags
          ),
    discouragedTypes:
      context.vibePlanning
        ?.discouragedTypes?.length
        ? context.vibePlanning.discouragedTypes
        : getDiscouragedTypesForVibe(
            context.vibeTags
          ),
    stronglyDiscouragedTypes:
      context.vibePlanning
        ?.stronglyDiscouragedTypes
        ?.length
        ? context.vibePlanning
            .stronglyDiscouragedTypes
        : getStronglyDiscouragedTypesForVibe(
            context.vibeTags
          ),
    preferredDayparts:
      context.vibePlanning
        ?.preferredDayparts?.length
        ? context.vibePlanning.preferredDayparts
        : getPreferredDaypartsForVibe(
            context.vibeTags
          ),
    discouragedDayparts:
      context.vibePlanning
        ?.discouragedDayparts?.length
        ? context.vibePlanning.discouragedDayparts
        : getDiscouragedDaypartsForVibe(
            context.vibeTags
          ),
  }
}

function computeCandidateVibeConfidence({
  allTokens,
  normalizedTypes,
  preferredTypes,
  requiredAnyTypes,
  discouragedTypes,
  stronglyDiscouragedTypes,
  expandedTokens,
}: {
  allTokens: string[]
  normalizedTypes: string[]
  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]
  expandedTokens: string[]
}): number | null {
  const hasVibeIntent =
    preferredTypes.length > 0 ||
    requiredAnyTypes.length > 0 ||
    expandedTokens.length > 0

  if (!hasVibeIntent) {
    return null
  }

  const tokenMatches =
    intersect(
      allTokens,
      expandedTokens
    ).length

  const preferredMatches =
    intersect(
      normalizedTypes,
      preferredTypes
    ).length

  const requiredMatches =
    intersect(
      normalizedTypes,
      requiredAnyTypes
    ).length

  const discouragedMatches =
    intersect(
      normalizedTypes,
      discouragedTypes
    ).length

  const stronglyDiscouragedMatches =
    intersect(
      normalizedTypes,
      stronglyDiscouragedTypes
    ).length

  let score = 0

  score += Math.min(tokenMatches, 4) * 0.12
  score +=
    Math.min(preferredMatches, 2) * 0.18

  if (requiredAnyTypes.length > 0) {
    score +=
      requiredMatches > 0
        ? 0.2
        : -0.18
  }

  score -=
    Math.min(discouragedMatches, 2) *
    0.16

  score -=
    Math.min(
      stronglyDiscouragedMatches,
      2
    ) * 0.28

  return Number(
    clamp01(score).toFixed(2)
  )
}

function buildQualityFlags({
  rankedCandidates,
  selected,
  slotDiagnostics,
  intendedStopCount,
  routeVibeConfidence,
}: {
  rankedCandidates: CandidateVenue[]
  selected: SelectedSlotVenue[]
  slotDiagnostics: SlotSelectionDebug[]
  intendedStopCount: number
  routeVibeConfidence: number | null
}): string[] {
  const flags: string[] = []

  const passSummary =
    summarizeSelectionPasses(
      selected,
      intendedStopCount
    )

  const rejectionSummary =
    summarizeRejections(
      slotDiagnostics
    )

  if (rankedCandidates.length === 0) {
    flags.push("empty_candidate_pool")
  }

  if (selected.length === 0) {
    flags.push("no_stops_selected")
  }

  if (
    selected.length <
    intendedStopCount
  ) {
    flags.push("incomplete_route")
  }

  if (
    passSummary.emergency > 0
  ) {
    flags.push("emergency_pass_used")
  }

  if (
    passSummary.relaxed > 0
  ) {
    flags.push("relaxed_pass_used")
  }

  if (
    routeVibeConfidence != null &&
    routeVibeConfidence < 0.45
  ) {
    flags.push("low_vibe_confidence")
  }

  if (
    rejectionSummary.role >
    rejectionSummary.geometry &&
    rejectionSummary.role >
    rejectionSummary.temporal
  ) {
    flags.push("role_matching_bottleneck")
  }

  if (
    rejectionSummary.geometry >
    rejectionSummary.role &&
    rejectionSummary.geometry >
    rejectionSummary.temporal
  ) {
    flags.push("geometry_bottleneck")
  }

  if (
    rejectionSummary.hours +
      rejectionSummary.temporal >
    rejectionSummary.role +
      rejectionSummary.geometry
  ) {
    flags.push("temporal_coverage_bottleneck")
  }

  if (
    rejectionSummary.missing_data > 0
  ) {
    flags.push("missing_venue_data")
  }

  if (
    rejectionSummary.vibe_required > 0
  ) {
    flags.push("vibe_requirement_bottleneck")
  }

  if (
    rejectionSummary.vibe_discouraged > 0
  ) {
    flags.push("vibe_conflict_detected")
  }

  return uniqueStrings(flags)
}

function resolvePlanningSlots(
  context: PlanningContext
): PlanningSlot[] {
  if (context.slots?.length) {
    return context.slots
  }

  return context.desiredRoles.map(
    (role, index) => {
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
        targetArrivalAt:
          context.plannedStartAt,
        targetDepartureAt:
          context.plannedEndAt,
        dwellMinutes: 45,
        strictProgression: false,
        flexibleRole: null,
        semanticRole: null,
      }
    }
  )
}

function buildSyntheticSlotDiagnostics({
  slots,
  selected,
  candidateCount,
}: {
  slots: PlanningSlot[]
  selected: SelectedSlotVenue[]
  candidateCount: number
}): SlotSelectionDebug[] {
  const selectedBySlotIndex = new Map<
    number,
    SelectedSlotVenue
  >(
    selected.map((entry) => [
      entry.slot.index,
      entry,
    ])
  )

  return slots.map((slot) => {
    const selectedEntry =
      selectedBySlotIndex.get(slot.index) ??
      null

    return {
      slotIndex: slot.index,
      role: slot.role,
      phase: slot.phase,
      selectedVenueId:
        selectedEntry?.venue.id ?? null,
      selectedPass:
        selectedEntry?.selectedPass ?? null,
      candidatesTotal: candidateCount,
      matchedRole: 0,
      passedHardConstraints: 0,
      rejectionCounts: {
        used: 0,
        role: 0,
        geometry: 0,
        temporal: 0,
        type_time: 0,
        hours: 0,
        missing_data: 0,
        vibe_required: 0,
        vibe_discouraged: 0,
      },
    }
  })
}

function hasKnownHours(
  hours: CandidateVenue["hours"]
): boolean {
  if (!hours) return false

  if (typeof hours === "string") {
    return hours.trim().length > 0
  }

  if (
    typeof hours !== "object" ||
    Array.isArray(hours)
  ) {
    return false
  }

  return Object.keys(hours).length > 0
}

function intersect(
  values: string[],
  reference: string[]
): string[] {
  if (
    values.length === 0 ||
    reference.length === 0
  ) {
    return []
  }

  const referenceSet =
    new Set(reference)

  return uniqueStrings(
    values.filter((value) =>
      referenceSet.has(value)
    )
  )
}

function clamp01(
  value: number
): number {
  return Math.max(
    0,
    Math.min(1, value)
  )
}