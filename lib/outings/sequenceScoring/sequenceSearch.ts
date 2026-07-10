// lib/outings/sequenceScoring/sequenceSearch.ts

import type {
  PlanningContext,
  PlanningSlot,
  SelectionPass,
} from "../types"
import type { CandidateVenue } from "./types"

import {
  candidateSupportsSlot,
  computeSlotRoleFitBonus,
} from "./roles"

import {
  getDistanceBetweenVenues,
} from "./geometry"

import {
  computeSequentialCandidateScore,
} from "./bias"

import {
  evaluateCandidateEligibilityForSlot,
  evaluateTemporalEligibility,
  type SelectedSlotVenue,
} from "./selection"

import {
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
} from "./helpers"

import {
  resolvePlannerTimeZone,
} from "./time"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type SequenceSearchOptions = {
  /**
   * Maximum number of partial routes retained after each slot.
   *
   * A modest beam performs well for the planner's small stop counts while
   * avoiding exhaustive combinatorial search.
   */
  beamWidth?: number

  /**
   * Maximum number of candidates considered per slot and search pass.
   *
   * Candidates are pre-ranked before branching so weak tail candidates do not
   * create unnecessary search work.
   */
  maxCandidatesPerSlot?: number

  /**
   * Maximum number of complete sequence alternatives returned.
   */
  maxResults?: number

  /**
   * Allows search to return a partial sequence when no complete route can be
   * produced.
   */
  allowPartialSequences?: boolean

  /**
   * Minimum number of selected stops required for a partial result.
   */
  minimumPartialStops?: number

  /**
   * Optional minimum final sequence score.
   */
  minimumSequenceScore?: number | null

  /**
   * Enables the emergency search pass.
   */
  includeEmergencyPass?: boolean
}

export type SequenceSearchCandidateScore = {
  venueId: string
  slotIndex: number
  pass: SelectionPass
  baseScore: number
  roleFitScore: number
  semanticContinuityScore: number
  diversityScore: number
  geometryContinuityScore: number
  missingDataPenalty: number
  passPenalty: number
  totalScore: number
}

export type SequenceSearchStep = {
  venue: CandidateVenue
  slot: PlanningSlot
  selectedPass: SelectionPass
  scoreBreakdown: SequenceSearchCandidateScore
}

export type SequenceSearchResult = {
  selected: SelectedSlotVenue[]
  score: number
  complete: boolean
  completedSlotCount: number
  intendedSlotCount: number
  selectedVenueIds: string[]
  steps: SequenceSearchStep[]
}

export type SequenceSearchDebug = {
  beamWidth: number
  maxCandidatesPerSlot: number
  intendedSlotCount: number
  completedSequenceCount: number
  partialSequenceCount: number
  expandedStateCount: number
  prunedStateCount: number
  passAttempts: Record<SelectionPass, number>
  passSelections: Record<SelectionPass, number>
  slotDiagnostics: SequenceSearchSlotDebug[]
}

export type SequenceSearchSlotDebug = {
  slotIndex: number
  candidateCount: number
  eligibleCandidateCount: number
  expandedStateCount: number
  retainedStateCount: number
  rejectionCounts: {
    used: number
    role: number
    geometry: number
    temporal: number
    hours: number
    missing_data: number
  }
}

export type SequenceSearchOutput = {
  best: SequenceSearchResult | null
  alternatives: SequenceSearchResult[]
  debug: SequenceSearchDebug
}

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

type SearchPassConfig = {
  name: SelectionPass
  relaxedRole: boolean
  relaxedGeometry: boolean
  relaxedTemporal: boolean
  allowWeakRoleMatch: boolean
  bypassLateNightNightlifeType: boolean
  allowMissingOrUncertainHours: boolean
  penalty: number
}

type SearchState = {
  steps: SequenceSearchStep[]
  selectedVenues: CandidateVenue[]
  usedVenueIds: Set<string>
  score: number
  completedSlotCount: number
}

type CandidateExpansion = {
  venue: CandidateVenue
  pass: SearchPassConfig
  scoreBreakdown: SequenceSearchCandidateScore
}

type SlotSearchCounters = {
  candidateCount: number
  eligibleCandidateCount: number
  expandedStateCount: number
  retainedStateCount: number
  rejectionCounts: {
    used: number
    role: number
    geometry: number
    temporal: number
    hours: number
    missing_data: number
  }
}

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

const DEFAULT_BEAM_WIDTH = 24
const DEFAULT_MAX_CANDIDATES_PER_SLOT = 18
const DEFAULT_MAX_RESULTS = 5
const DEFAULT_MINIMUM_PARTIAL_STOPS = 1

const SEARCH_PASSES: SearchPassConfig[] = [
  {
    name: "strict",
    relaxedRole: false,
    relaxedGeometry: false,
    relaxedTemporal: false,
    allowWeakRoleMatch: false,
    bypassLateNightNightlifeType: false,
    allowMissingOrUncertainHours: true,
    penalty: 0,
  },
  {
    name: "balanced",
    relaxedRole: true,
    relaxedGeometry: false,
    relaxedTemporal: false,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: false,
    allowMissingOrUncertainHours: true,
    penalty: 6,
  },
  {
    name: "relaxed",
    relaxedRole: true,
    relaxedGeometry: true,
    relaxedTemporal: true,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: true,
    allowMissingOrUncertainHours: true,
    penalty: 14,
  },
  {
    name: "emergency",
    relaxedRole: true,
    relaxedGeometry: true,
    relaxedTemporal: true,
    allowWeakRoleMatch: true,
    bypassLateNightNightlifeType: true,
    allowMissingOrUncertainHours: true,
    penalty: 28,
  },
]

// -----------------------------------------------------------------------------
// Public search entrypoint
// -----------------------------------------------------------------------------

export function searchCandidateSequences(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext,
  slots: PlanningSlot[],
  options: SequenceSearchOptions = {}
): SequenceSearchOutput {
  const beamWidth = normalizePositiveInteger(
    options.beamWidth,
    DEFAULT_BEAM_WIDTH
  )

  const maxCandidatesPerSlot = normalizePositiveInteger(
    options.maxCandidatesPerSlot,
    DEFAULT_MAX_CANDIDATES_PER_SLOT
  )

  const maxResults = normalizePositiveInteger(
    options.maxResults,
    DEFAULT_MAX_RESULTS
  )

  const minimumPartialStops = normalizePositiveInteger(
    options.minimumPartialStops,
    DEFAULT_MINIMUM_PARTIAL_STOPS
  )

  const allowPartialSequences =
    options.allowPartialSequences ?? true

  const minimumSequenceScore =
    typeof options.minimumSequenceScore === "number" &&
    Number.isFinite(options.minimumSequenceScore)
      ? options.minimumSequenceScore
      : null

  const includeEmergencyPass =
    options.includeEmergencyPass ?? true

  const passes = includeEmergencyPass
    ? SEARCH_PASSES
    : SEARCH_PASSES.filter((pass) => pass.name !== "emergency")

  const passAttempts = createEmptyPassCounter()
  const passSelections = createEmptyPassCounter()
  const slotDiagnostics: SequenceSearchSlotDebug[] = []

  let expandedStateCount = 0
  let prunedStateCount = 0

  if (slots.length === 0 || rankedCandidates.length === 0) {
    return {
      best: null,
      alternatives: [],
      debug: {
        beamWidth,
        maxCandidatesPerSlot,
        intendedSlotCount: slots.length,
        completedSequenceCount: 0,
        partialSequenceCount: 0,
        expandedStateCount: 0,
        prunedStateCount: 0,
        passAttempts,
        passSelections,
        slotDiagnostics,
      },
    }
  }

  let beam: SearchState[] = [
    {
      steps: [],
      selectedVenues: [],
      usedVenueIds: new Set<string>(),
      score: 0,
      completedSlotCount: 0,
    },
  ]

  const partialStates: SearchState[] = []

  for (const slot of slots) {
    const slotCounters = createSlotSearchCounters(
      slot.index,
      rankedCandidates.length
    )

    const nextBeam: SearchState[] = []

    for (const state of beam) {
      const expansions = buildCandidateExpansions({
        rankedCandidates,
        state,
        slot,
        context,
        passes,
        maxCandidatesPerSlot,
        passAttempts,
        passSelections,
        slotCounters,
      })

      if (expansions.length === 0) {
        if (
          allowPartialSequences &&
          state.completedSlotCount >= minimumPartialStops
        ) {
          partialStates.push(state)
        }

        continue
      }

      for (const expansion of expansions) {
        expandedStateCount += 1
        slotCounters.expandedStateCount += 1

        nextBeam.push(
          appendExpansionToState({
            state,
            slot,
            expansion,
          })
        )
      }
    }

    const deduplicated = deduplicateSearchStates(nextBeam)
    const sorted = deduplicated.sort(compareSearchStates)

    if (sorted.length > beamWidth) {
      prunedStateCount += sorted.length - beamWidth
    }

    beam = sorted.slice(0, beamWidth)
    slotCounters.retainedStateCount = beam.length

    slotDiagnostics.push({
      slotIndex: slot.index,
      candidateCount: slotCounters.candidateCount,
      eligibleCandidateCount: slotCounters.eligibleCandidateCount,
      expandedStateCount: slotCounters.expandedStateCount,
      retainedStateCount: slotCounters.retainedStateCount,
      rejectionCounts: slotCounters.rejectionCounts,
    })

    if (beam.length === 0) {
      break
    }
  }

  const completeStates = beam.filter(
    (state) => state.completedSlotCount === slots.length
  )

  const incompleteBeamStates = beam.filter(
    (state) =>
      state.completedSlotCount < slots.length &&
      state.completedSlotCount >= minimumPartialStops
  )

  const allPartialStates = deduplicateSearchStates([
    ...partialStates,
    ...incompleteBeamStates,
  ])

  const preferredStates =
    completeStates.length > 0
      ? completeStates
      : allowPartialSequences
        ? allPartialStates
        : []

  const finalStates = preferredStates
    .filter((state) =>
      minimumSequenceScore == null
        ? true
        : state.score >= minimumSequenceScore
    )
    .sort(compareSearchStates)
    .slice(0, maxResults)

  const alternatives = finalStates.map((state) =>
    buildSequenceSearchResult(state, slots.length)
  )

  return {
    best: alternatives[0] ?? null,
    alternatives,
    debug: {
      beamWidth,
      maxCandidatesPerSlot,
      intendedSlotCount: slots.length,
      completedSequenceCount: completeStates.length,
      partialSequenceCount: allPartialStates.length,
      expandedStateCount,
      prunedStateCount,
      passAttempts,
      passSelections,
      slotDiagnostics,
    },
  }
}

// -----------------------------------------------------------------------------
// Candidate expansion
// -----------------------------------------------------------------------------

function buildCandidateExpansions({
  rankedCandidates,
  state,
  slot,
  context,
  passes,
  maxCandidatesPerSlot,
  passAttempts,
  passSelections,
  slotCounters,
}: {
  rankedCandidates: CandidateVenue[]
  state: SearchState
  slot: PlanningSlot
  context: PlanningContext
  passes: SearchPassConfig[]
  maxCandidatesPerSlot: number
  passAttempts: Record<SelectionPass, number>
  passSelections: Record<SelectionPass, number>
  slotCounters: SlotSearchCounters
}): CandidateExpansion[] {
  const timeZone = resolvePlannerTimeZone(context)

  for (const pass of passes) {
    passAttempts[pass.name] += 1

    const eligible: CandidateExpansion[] = []

    for (const candidate of rankedCandidates) {
      if (state.usedVenueIds.has(candidate.id)) {
        slotCounters.rejectionCounts.used += 1
        continue
      }

      if (!hasUsableCoreVenueData(candidate)) {
        slotCounters.rejectionCounts.missing_data += 1
        continue
      }

      if (
        !candidateSupportsSearchSlot(
          candidate,
          slot,
          context,
          pass
        )
      ) {
        slotCounters.rejectionCounts.role += 1
        continue
      }

      const geometryEligibility =
        evaluateCandidateEligibilityForSlot(
          candidate,
          state.selectedVenues,
          slot,
          context,
          pass.relaxedGeometry,
          timeZone,
          pass.bypassLateNightNightlifeType
        )

      if (!geometryEligibility.eligible) {
        if (geometryEligibility.reason === "missing_data") {
          slotCounters.rejectionCounts.missing_data += 1
        } else {
          slotCounters.rejectionCounts.geometry += 1
        }

        continue
      }

      const temporalEligibility =
        evaluateTemporalEligibility(
          candidate,
          slot,
          context,
          timeZone,
          pass.relaxedTemporal,
          pass.allowMissingOrUncertainHours
        )

      if (!temporalEligibility.eligible) {
        if (temporalEligibility.reason === "hours") {
          slotCounters.rejectionCounts.hours += 1
        } else {
          slotCounters.rejectionCounts.temporal += 1
        }

        continue
      }

      slotCounters.eligibleCandidateCount += 1

      const scoreBreakdown =
        computeExpansionScore({
          candidate,
          state,
          slot,
          context,
          pass,
        })

      eligible.push({
        venue: candidate,
        pass,
        scoreBreakdown,
      })
    }

    if (eligible.length === 0) {
      continue
    }

    eligible.sort(compareCandidateExpansions)

    const retained = eligible.slice(
      0,
      maxCandidatesPerSlot
    )

    passSelections[pass.name] += retained.length

    return retained
  }

  return []
}

function candidateSupportsSearchSlot(
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext,
  pass: SearchPassConfig
): boolean {
  if (
    candidateSupportsSlot(
      candidate,
      slot,
      context,
      pass.relaxedRole
    )
  ) {
    return true
  }

  if (
    slot.flexibleRole &&
    candidate.inferredRoles.includes(slot.flexibleRole)
  ) {
    return true
  }

  if (!pass.allowWeakRoleMatch) {
    return false
  }

  const roles = candidate.inferredRoles ?? []

  if (roles.length === 0) {
    return getCandidateSemanticTokens(candidate).length > 0
  }

  if (slot.role === "activity") {
    return roles.includes("activity")
  }

  return roles.some((role) =>
    ["coffee", "food", "drink", "dessert"].includes(role)
  )
}

// -----------------------------------------------------------------------------
// Expansion scoring
// -----------------------------------------------------------------------------

function computeExpansionScore({
  candidate,
  state,
  slot,
  context,
  pass,
}: {
  candidate: CandidateVenue
  state: SearchState
  slot: PlanningSlot
  context: PlanningContext
  pass: SearchPassConfig
}): SequenceSearchCandidateScore {
  const previous =
    state.selectedVenues[state.selectedVenues.length - 1] ?? null

  const baseScore = computeSequentialCandidateScore(
    candidate,
    state.selectedVenues,
    slot,
    context
  )

  const roleFitScore = computeSlotRoleFitBonus(
    candidate,
    slot
  )

  const semanticContinuityScore =
    computeSemanticContinuityScore(
      previous,
      candidate,
      slot,
      context
    )

  const diversityScore =
    computeSequenceDiversityScore(
      state.selectedVenues,
      candidate,
      slot
    )

  const geometryContinuityScore =
    computeGeometryContinuityScore(
      previous,
      candidate,
      slot,
      context
    )

  const missingDataPenalty =
    computeMissingCandidateDataPenalty(candidate)

  const totalScore =
    baseScore +
    roleFitScore +
    semanticContinuityScore +
    diversityScore +
    geometryContinuityScore -
    missingDataPenalty -
    pass.penalty

  return {
    venueId: candidate.id,
    slotIndex: slot.index,
    pass: pass.name,
    baseScore,
    roleFitScore,
    semanticContinuityScore,
    diversityScore,
    geometryContinuityScore,
    missingDataPenalty,
    passPenalty: pass.penalty,
    totalScore,
  }
}

function computeSemanticContinuityScore(
  previous: CandidateVenue | null,
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): number {
  const candidateTokens =
    getCandidateSemanticTokens(candidate)

  const requestedTokens = uniqueStrings([
    ...context.vibeTags,
    ...(slot.vibePreferredTypes ?? []),
  ])

  const requestedMatches =
    countSharedValues(
      candidateTokens,
      requestedTokens
    )

  let score = Math.min(requestedMatches, 5) * 3

  if (!previous) {
    return score
  }

  const previousTokens =
    getCandidateSemanticTokens(previous)

  const shared =
    countSharedValues(
      previousTokens,
      candidateTokens
    )

  score += Math.min(shared, 4) * 2

  return Math.min(score, 20)
}

function computeSequenceDiversityScore(
  selectedVenues: CandidateVenue[],
  candidate: CandidateVenue,
  slot: PlanningSlot
): number {
  if (selectedVenues.length === 0) {
    return 0
  }

  const candidateTypes =
    normalizeVenueTypes(candidate.type)

  const priorTypes = uniqueStrings(
    selectedVenues.flatMap((venue) =>
      normalizeVenueTypes(venue.type)
    )
  )

  const repeatedTypeCount =
    candidateTypes.filter((type) =>
      priorTypes.includes(type)
    ).length

  let score = 0

  if (repeatedTypeCount === 0) {
    score += 5
  } else {
    score -= Math.min(repeatedTypeCount, 3) * 3
  }

  const previous =
    selectedVenues[selectedVenues.length - 1]

  const previousRoles =
    previous?.inferredRoles ?? []

  const candidateRoles =
    candidate.inferredRoles ?? []

  const repeatedRole =
    previousRoles.some((role) =>
      candidateRoles.includes(role)
    )

  if (repeatedRole) {
    score -= slot.phase === "after" ? 1 : 4
  }

  return Math.max(-10, Math.min(8, score))
}

function computeGeometryContinuityScore(
  previous: CandidateVenue | null,
  candidate: CandidateVenue,
  slot: PlanningSlot,
  context: PlanningContext
): number {
  if (!previous) {
    const anchorDistance =
      candidate.distanceMeters

    if (anchorDistance == null) {
      return -2
    }

    if (context.mobility === "walk") {
      if (anchorDistance <= 700) return 8
      if (anchorDistance <= 1200) return 4
      return 0
    }

    if (context.mobility === "short_ride") {
      if (anchorDistance <= 1600) return 7
      if (anchorDistance <= 2600) return 3
      return 0
    }

    if (anchorDistance <= 3000) return 5
    return 0
  }

  const distance =
    getDistanceBetweenVenues(previous, candidate)

  if (distance == null) {
    return -2
  }

  if (slot.phase === "before") {
    if (distance <= 700) return 8
    if (distance <= 1400) return 4
    if (distance <= 2400) return 1
    return -4
  }

  if (distance <= 600) return 9
  if (distance <= 1200) return 5
  if (distance <= 2000) return 1
  return -5
}

function computeMissingCandidateDataPenalty(
  candidate: CandidateVenue
): number {
  let penalty = 0

  if (!candidate.name?.trim()) {
    penalty += 8
  }

  if (
    normalizeVenueTypes(candidate.type).length === 0
  ) {
    penalty += 8
  }

  if (
    normalizeStringArray(candidate.tags).length === 0
  ) {
    penalty += 3
  }

  if (
    normalizeStringArray(candidate.vibe).length === 0
  ) {
    penalty += 4
  }

  if (!hasUsableHours(candidate)) {
    penalty += 3
  }

  return penalty
}

// -----------------------------------------------------------------------------
// Search-state construction
// -----------------------------------------------------------------------------

function appendExpansionToState({
  state,
  slot,
  expansion,
}: {
  state: SearchState
  slot: PlanningSlot
  expansion: CandidateExpansion
}): SearchState {
  const nextUsedIds = new Set(
    state.usedVenueIds
  )

  nextUsedIds.add(expansion.venue.id)

  return {
    steps: [
      ...state.steps,
      {
        venue: expansion.venue,
        slot,
        selectedPass: expansion.pass.name,
        scoreBreakdown:
          expansion.scoreBreakdown,
      },
    ],
    selectedVenues: [
      ...state.selectedVenues,
      expansion.venue,
    ],
    usedVenueIds: nextUsedIds,
    score:
      state.score +
      expansion.scoreBreakdown.totalScore,
    completedSlotCount:
      state.completedSlotCount + 1,
  }
}

function buildSequenceSearchResult(
  state: SearchState,
  intendedSlotCount: number
): SequenceSearchResult {
  const selected: SelectedSlotVenue[] =
    state.steps.map((step) => ({
      venue: step.venue,
      slot: step.slot,
      selectedPass: step.selectedPass,
    }))

  return {
    selected,
    score: Number(state.score.toFixed(3)),
    complete:
      state.completedSlotCount === intendedSlotCount,
    completedSlotCount:
      state.completedSlotCount,
    intendedSlotCount,
    selectedVenueIds:
      state.selectedVenues.map((venue) => venue.id),
    steps: state.steps,
  }
}

// -----------------------------------------------------------------------------
// Search ordering and deduplication
// -----------------------------------------------------------------------------

function compareCandidateExpansions(
  a: CandidateExpansion,
  b: CandidateExpansion
): number {
  const scoreDelta =
    b.scoreBreakdown.totalScore -
    a.scoreBreakdown.totalScore

  if (Math.abs(scoreDelta) > 0.001) {
    return scoreDelta
  }

  const distanceA =
    a.venue.distanceMeters ??
    Number.POSITIVE_INFINITY

  const distanceB =
    b.venue.distanceMeters ??
    Number.POSITIVE_INFINITY

  if (Math.abs(distanceA - distanceB) > 1) {
    return distanceA - distanceB
  }

  return a.venue.id.localeCompare(b.venue.id)
}

function compareSearchStates(
  a: SearchState,
  b: SearchState
): number {
  if (
    a.completedSlotCount !==
    b.completedSlotCount
  ) {
    return (
      b.completedSlotCount -
      a.completedSlotCount
    )
  }

  const normalizedScoreA =
    normalizeStateScore(a)

  const normalizedScoreB =
    normalizeStateScore(b)

  const normalizedDelta =
    normalizedScoreB -
    normalizedScoreA

  if (Math.abs(normalizedDelta) > 0.001) {
    return normalizedDelta
  }

  const rawDelta = b.score - a.score

  if (Math.abs(rawDelta) > 0.001) {
    return rawDelta
  }

  return buildStateKey(a).localeCompare(
    buildStateKey(b)
  )
}

function normalizeStateScore(
  state: SearchState
): number {
  if (state.completedSlotCount === 0) {
    return Number.NEGATIVE_INFINITY
  }

  return state.score / state.completedSlotCount
}

function deduplicateSearchStates(
  states: SearchState[]
): SearchState[] {
  const bestByKey =
    new Map<string, SearchState>()

  for (const state of states) {
    const key = buildStateKey(state)
    const current = bestByKey.get(key)

    if (
      !current ||
      compareSearchStates(state, current) < 0
    ) {
      bestByKey.set(key, state)
    }
  }

  return Array.from(bestByKey.values())
}

function buildStateKey(
  state: SearchState
): string {
  return state.steps
    .map(
      (step) =>
        `${step.slot.index}:${step.venue.id}`
    )
    .join("|")
}

// -----------------------------------------------------------------------------
// Candidate data helpers
// -----------------------------------------------------------------------------

function getCandidateSemanticTokens(
  candidate: CandidateVenue
): string[] {
  return uniqueStrings([
    ...normalizeVenueTypes(candidate.type),
    ...normalizeStringArray(candidate.tags),
    ...normalizeStringArray(candidate.vibe),
    ...normalizeStringArray(
      candidate.time_category
    ),
  ])
}

function countSharedValues(
  a: string[],
  b: string[]
): number {
  if (a.length === 0 || b.length === 0) {
    return 0
  }

  const bSet = new Set(b)

  return uniqueStrings(a).filter((value) =>
    bSet.has(value)
  ).length
}

function hasUsableCoreVenueData(
  candidate: CandidateVenue
): boolean {
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lon === "number" &&
    Number.isFinite(candidate.lon)
  )
}

function hasUsableHours(
  candidate: CandidateVenue
): boolean {
  const hours = (
    candidate as CandidateVenue & {
      hours?: unknown
    }
  ).hours

  if (!hours) return false

  if (typeof hours === "string") {
    const normalized = hours.trim()

    return (
      normalized.length > 0 &&
      normalized !== "{}" &&
      normalized !== "null"
    )
  }

  if (
    typeof hours === "object" &&
    !Array.isArray(hours)
  ) {
    return Object.keys(hours).length > 0
  }

  return false
}

// -----------------------------------------------------------------------------
// Debug helpers
// -----------------------------------------------------------------------------

function createEmptyPassCounter(): Record<
  SelectionPass,
  number
> {
  return {
    strict: 0,
    balanced: 0,
    relaxed: 0,
    emergency: 0,
  }
}

function createSlotSearchCounters(
  _slotIndex: number,
  candidateCount: number
): SlotSearchCounters {
  return {
    candidateCount,
    eligibleCandidateCount: 0,
    expandedStateCount: 0,
    retainedStateCount: 0,
    rejectionCounts: {
      used: 0,
      role: 0,
      geometry: 0,
      temporal: 0,
      hours: 0,
      missing_data: 0,
    },
  }
}

// -----------------------------------------------------------------------------
// General helpers
// -----------------------------------------------------------------------------

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback
  }

  const normalized = Math.floor(value)

  return normalized > 0
    ? normalized
    : fallback
}