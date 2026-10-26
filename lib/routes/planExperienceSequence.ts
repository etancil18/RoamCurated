
// lib/routes/planExperienceSequence.ts

import { DateTime } from 'luxon'

import {
  evaluateExperienceSuitability,
  getExperienceRoleDefinition,
  getVenueExperienceCapabilities,
  isExperienceRoleTimeCompatible,
  isSameExperienceFamily,
  isSubstantialMealRole,
  type ExperienceRole,
  type ExperienceVenue,
  type ExperienceVenueFormatFamily,
} from './experienceRoles'

import {
  ROUTE_STAGES,
  isHourWithinStageWindow,
  type RouteStage,
  type RouteStageId,
} from './routeStages'

/**
 * RoamCurated — Contextual Experience Sequence Planning
 *
 * Produces ranked, inventory-aware alternatives to the
 * fixed route-stage progression.
 *
 * The planner:
 * - Preserves the existing RouteStage definitions.
 * - Uses actual venue capability classifications.
 * - Plans relative to the anchor's current experience.
 * - Respects local time windows and expected dwell.
 * - Avoids consecutive substantial meals.
 * - Enforces approximate meal-start spacing.
 * - Discourages repeated roles, stages and venue formats.
 * - Allows shorter, better sequences.
 * - Returns multiple alternatives for downstream selection.
 * - Never mutates supplied venue data.
 *
 * The planner does NOT:
 * - Select final itinerary venues.
 * - Verify opening hours unless supplied a callback.
 * - Compute pedestrian-network routes.
 * - Replace candidateFilter, scoreVenue or personalization.
 * - Guarantee geographic feasibility.
 * - Change existing endpoint behavior on import.
 *
 * Final candidate selection must still enforce opening
 * hours, cumulative distance, contextual constraints,
 * chronology and route quality.
 */

export type ExperienceSequenceVenue = ExperienceVenue & {
  id: string
  lat?: number | null
  lon?: number | null
}

export type ExperienceSequenceIntent =
  | 'standard'
  | 'food_crawl'

export type ExperienceSequenceAvailabilityCheck = (
  venue: ExperienceSequenceVenue,
  arrivalAt: Date,
  role: ExperienceRole
) => boolean

export type ExperienceSequenceTravelEstimate = (
  fromVenue: ExperienceSequenceVenue,
  toVenue: ExperienceSequenceVenue
) => number | null

export type PlanExperienceSequenceParams = {
  anchorVenue: ExperienceSequenceVenue
  anchorRole: ExperienceRole

  plannedStartAt: Date | string
  timezone: string

  /**
   * Includes the anchor.
   */
  maxStops?: number

  /**
   * Candidate inventory, preferably already scoped to
   * the anchor's city and relevant geographic area.
   */
  venues: readonly ExperienceSequenceVenue[]

  /**
   * Approximate time at the anchor.
   * Defaults to the role-specific dwell duration.
   */
  anchorDwellMinutes?: number

  /**
   * Maximum total estimated Flow time including the anchor.
   */
  maxRouteMinutes?: number

  /**
   * Assumed travel between stages when exact locations
   * have not yet been selected.
   */
  estimatedLegTravelMinutes?: number

  /**
   * Optional travel estimate between actual venue objects.
   * Return null for an unavailable leg.
   *
   * The planner uses this only as an estimate.
   * Final routing remains the endpoint's responsibility.
   */
  estimateTravelMinutes?: ExperienceSequenceTravelEstimate

  /**
   * Optional availability check at approximate arrival.
   * Supply the existing opening-hours checker through
   * an adapter if inventory-aware time checks are wanted.
   *
   * This callback must be synchronous and deterministic.
   */
  isVenueAvailable?: ExperienceSequenceAvailabilityCheck

  /**
   * Restrict inventory to venues inside this approximate
   * straight-line radius from the anchor.
   *
   * Omit to use the caller's existing inventory scope.
   */
  maxRadiusMeters?: number

  /**
   * Maximum ranked alternatives returned.
   */
  maxAlternatives?: number

  /**
   * Beam width limits exploratory state growth.
   */
  beamWidth?: number

  /**
   * How many inventory candidates to consider per
   * role during a planning expansion.
   */
  candidatesPerRole?: number

  /**
   * Preserve a user explicitly requesting a food crawl.
   * Standard is the default and never inferred.
   */
  flowIntent?: ExperienceSequenceIntent

  /**
   * Minimum start-to-start gap between full meals.
   */
  minimumMealSpacingMinutes?: number
}

export type ExperienceSequenceStep = {
  stageId: RouteStageId
  stage: RouteStage

  /**
   * Targeted visit role, not a claim that the chosen
   * venue will necessarily support this exact experience.
   */
  role: ExperienceRole

  /**
   * Approximate UTC planning arrival.
   * Actual arrival is calculated by itineraryTimeline.ts.
   */
  estimatedArrivalAt: string

  estimatedDepartureAt: string
  estimatedDwellMinutes: number
  estimatedTravelMinutes: number

  /**
   * Supply available for this role at this estimated time,
   * after excluding the anchor and provisionally reserved
   * venues in the current planning branch.
   */
  availableVenueCount: number

  /**
   * A provisional inventory reference used to make sure
   * sequence planning does not reuse the same venue.
   *
   * This is NOT a final venue selection.
   */
  representativeVenueId: string

  /**
   * The representative venue's approximate broad format.
   */
  venueFormatFamily: ExperienceVenueFormatFamily
}

export type ExperienceSequenceAlternative = {
  id: string

  /**
   * Ordered stages after the anchor.
   */
  steps: ExperienceSequenceStep[]

  stageIds: RouteStageId[]
  roles: ExperienceRole[]

  totalStops: number

  estimatedTotalMinutes: number
  estimatedEndAt: string

  /**
   * Relative planning score; not equivalent to scoreVenue.
   */
  score: number

  reasons: string[]
}

export type ExperienceSequencePlan = {
  anchorRole: ExperienceRole
  plannedStartAt: string
  timezone: string
  requestedMaxStops: number

  /**
   * True only when at least one additional plausible
   * experience sequence was found.
   */
  hasAlternatives: boolean

  /**
   * Highest-ranked alternative, or null.
   */
  recommended: ExperienceSequenceAlternative | null

  alternatives: ExperienceSequenceAlternative[]

  /**
   * Useful diagnostics; these do not alter the API's
   * existing route-generation debug contract.
   */
  diagnostics: {
    inventoryCount: number
    eligibleInventoryCount: number
    exploredStates: number
    rejectedForTime: number
    rejectedForSupply: number
    rejectedForMealRules: number
    rejectedForDuration: number
    maxStopsRequested: number
    longestPlannedStops: number
  }
}

type NormalizedSettings = {
  maxStops: number
  maxRouteMinutes: number
  anchorDwellMinutes: number
  estimatedLegTravelMinutes: number
  maxAlternatives: number
  beamWidth: number
  candidatesPerRole: number
  minimumMealSpacingMinutes: number
  flowIntent: ExperienceSequenceIntent
}

type InventoryEntry = {
  venue: ExperienceSequenceVenue
  roles: readonly ExperienceRole[]
  formatFamily: ExperienceVenueFormatFamily
}

type PlanningState = {
  steps: ExperienceSequenceStep[]
  usedVenueIds: Set<string>
  usedStageIds: Set<RouteStageId>
  usedRoles: ExperienceRole[]
  lastRole: ExperienceRole
  lastVenue: ExperienceSequenceVenue
  lastMealStartedAt: number | null
  previousDiningFormatCount: number
  currentDepartureMs: number
  score: number
  reasons: string[]
}

type PlanningDiagnostics = ExperienceSequencePlan['diagnostics']

type ExpansionCandidate = {
  entry: InventoryEntry
  travelMinutes: number
  arrivalMs: number
  departureMs: number
  suitabilityScore: number
}

const DEFAULT_MAX_STOPS = 5
const MAX_SUPPORTED_STOPS = 8
const DEFAULT_MAX_ROUTE_MINUTES = 360
const DEFAULT_LEG_MINUTES = 10
const DEFAULT_BEAM_WIDTH = 24
const DEFAULT_ALTERNATIVES = 5
const DEFAULT_CANDIDATES_PER_ROLE = 4
const DEFAULT_MEAL_SPACING_MINUTES = 180

const MIN_VISIT_MINUTES = 15

const PLANNABLE_ROLES: readonly ExperienceRole[] = [
  'coffee_tea',
  'bakery_light_bite',
  'breakfast_brunch',
  'lunch',
  'dinner',
  'dessert',
  'drinks',
  'culture',
  'discovery',
  'outdoors',
  'wellness',
  'entertainment',
]

const STAGE_BY_ID = new Map<RouteStageId, RouteStage>(
  ROUTE_STAGES.map((stage) => [stage.id, stage])
)

/**
 * Build multiple feasible high-level experience sequences.
 *
 * Example:
 *
 * const result = planExperienceSequence({
 *   anchorVenue,
 *   anchorRole: anchorExperience.role,
 *   plannedStartAt: context.plannedStartAt,
 *   timezone: 'America/New_York',
 *   maxStops: 5,
 *   venues,
 * })
 *
 * result.recommended?.stageIds
 * result.recommended?.roles
 *
 * Do not replace the existing route context with this
 * result without explicit endpoint integration.
 */
export function planExperienceSequence(
  params: PlanExperienceSequenceParams
): ExperienceSequencePlan {
  const settings = normalizeSettings(params)

  const startMs = parseRequiredTimestamp(
    params.plannedStartAt
  )

  assertTimezone(params.timezone)

  if (!params.anchorVenue?.id) {
    throw new Error(
      '[planExperienceSequence] anchorVenue.id is required.'
    )
  }

  const anchorDepartureMs =
    startMs + settings.anchorDwellMinutes * 60000

  const anchorDeadlineMs =
    startMs + settings.maxRouteMinutes * 60000

  const inventory = buildInventory(
    params.venues,
    params.anchorVenue,
    params.maxRadiusMeters
  )

  const initialDiningCount =
    isDiningFormat(params.anchorVenue) ? 1 : 0

  const initialState: PlanningState = {
    steps: [],
    usedVenueIds: new Set([params.anchorVenue.id]),
    usedStageIds: new Set(),
    usedRoles: [params.anchorRole],
    lastRole: params.anchorRole,
    lastVenue: params.anchorVenue,
    lastMealStartedAt:
      isSubstantialMealRole(params.anchorRole)
        ? startMs
        : null,
    previousDiningFormatCount: initialDiningCount,
    currentDepartureMs: anchorDepartureMs,
    score: 0,
    reasons: [],
  }

  const diagnostics: PlanningDiagnostics = {
    inventoryCount: params.venues.length,
    eligibleInventoryCount: inventory.length,
    exploredStates: 0,
    rejectedForTime: 0,
    rejectedForSupply: 0,
    rejectedForMealRules: 0,
    rejectedForDuration: 0,
    maxStopsRequested: settings.maxStops,
    longestPlannedStops: 1,
  }

  let beam: PlanningState[] = [initialState]

  const completed: PlanningState[] = []

  for (
    let depth = 1;
    depth < settings.maxStops;
    depth += 1
  ) {
    const expanded: PlanningState[] = []

    for (const state of beam) {
      const next = expandState({
        state,
        inventory,
        params,
        settings,
        anchorDeadlineMs,
        diagnostics,
      })

      expanded.push(...next)

      // A valid partial itinerary remains a viable
      // outcome even if additional stops are possible.
      if (state.steps.length > 0) {
        completed.push(state)
      }
    }

    if (expanded.length === 0) {
      break
    }

    expanded.sort(comparePlanningStates)

    beam = deduplicatePlanningStates(
      expanded
    ).slice(0, settings.beamWidth)

    diagnostics.longestPlannedStops = Math.max(
      diagnostics.longestPlannedStops,
      ...beam.map((state) => state.steps.length + 1)
    )
  }

  completed.push(
    ...beam.filter((state) => state.steps.length > 0)
  )

  const alternatives = deduplicateAlternatives(
    completed
      .map((state) =>
        toAlternative(state, startMs)
      )
      .sort(compareAlternatives)
  ).slice(0, settings.maxAlternatives)

  return {
    anchorRole: params.anchorRole,
    plannedStartAt: new Date(startMs).toISOString(),
    timezone: params.timezone,
    requestedMaxStops: settings.maxStops,
    hasAlternatives: alternatives.length > 0,
    recommended: alternatives[0] ?? null,
    alternatives,
    diagnostics,
  }
}

/**
 * Convenience API for integrations that need only the
 * best available planned sequence.
 */
export function getRecommendedExperienceSequence(
  params: PlanExperienceSequenceParams
): ExperienceSequenceAlternative | null {
  return planExperienceSequence(params).recommended
}

/**
 * Convert a planned sequence into the existing stage
 * definitions without manufacturing new RouteStage values.
 */
export function getExperienceSequenceStages(
  sequence: ExperienceSequenceAlternative
): RouteStage[] {
  return sequence.steps.map((step) => step.stage)
}

/* =========================================================
 * Candidate expansion
 * ======================================================= */

function expandState({
  state,
  inventory,
  params,
  settings,
  anchorDeadlineMs,
  diagnostics,
}: {
  state: PlanningState
  inventory: readonly InventoryEntry[]
  params: PlanExperienceSequenceParams
  settings: NormalizedSettings
  anchorDeadlineMs: number
  diagnostics: PlanningDiagnostics
}): PlanningState[] {
  const results: PlanningState[] = []

  for (const role of PLANNABLE_ROLES) {
    const definition = getExperienceRoleDefinition(role)

    for (const stageId of definition.stageIds) {
      const stage = STAGE_BY_ID.get(stageId)

      if (!stage) {
        continue
      }

      // Keep one occurrence of a stage within a plan.
      // Different roles may still compete for the same
      // stage in separate planning branches.
      if (state.usedStageIds.has(stageId)) {
        continue
      }

      if (
        !isSequenceRoleTransitionAllowed({
          previousRole: state.lastRole,
          nextRole: role,
          flowIntent: settings.flowIntent,
        })
      ) {
        diagnostics.rejectedForMealRules += 1
        continue
      }

      const visitMinutes = Math.max(
        MIN_VISIT_MINUTES,
        definition.defaultDwellMinutes
      )

      const candidates: ExpansionCandidate[] = []

      for (const entry of inventory) {
        if (
          state.usedVenueIds.has(entry.venue.id) ||
          !entry.roles.includes(role)
        ) {
          continue
        }

        const travelMinutes =
          resolveEstimatedTravelMinutes({
            fromVenue: state.lastVenue,
            toVenue: entry.venue,
            fallbackMinutes:
              settings.estimatedLegTravelMinutes,
            estimateTravelMinutes:
              params.estimateTravelMinutes,
          })

        if (travelMinutes === null) {
          continue
        }

        const arrivalMs =
          state.currentDepartureMs +
          travelMinutes * 60000

        const departureMs =
          arrivalMs + visitMinutes * 60000

        if (departureMs > anchorDeadlineMs) {
          diagnostics.rejectedForDuration += 1
          continue
        }

        const localHour = getLocalHourAtTimestamp(
          arrivalMs,
          params.timezone
        )

        if (
          !isHourWithinStageWindow(localHour, stage) ||
          !isExperienceRoleTimeCompatible(
            role,
            localHour
          )
        ) {
          diagnostics.rejectedForTime += 1
          continue
        }

        if (
          settings.flowIntent !== 'food_crawl' &&
          isSubstantialMealRole(role) &&
          state.lastMealStartedAt !== null &&
          arrivalMs -
            state.lastMealStartedAt <
            settings.minimumMealSpacingMinutes * 60000
        ) {
          diagnostics.rejectedForMealRules += 1
          continue
        }

        if (params.isVenueAvailable) {
          let available = false

          try {
            available = params.isVenueAvailable(
              entry.venue,
              new Date(arrivalMs),
              role
            )
          } catch {
            // A caller-supplied availability checker
            // must not crash all sequence exploration.
            available = false
          }

          if (!available) {
            continue
          }
        }

        const suitability =
          evaluateExperienceSuitability({
            venue: entry.venue,
            role,
          })

        candidates.push({
          entry,
          travelMinutes,
          arrivalMs,
          departureMs,
          suitabilityScore:
            suitability.scoreAdjustment,
        })
      }

      if (candidates.length === 0) {
        diagnostics.rejectedForSupply += 1
        continue
      }

      // Prefer venues that genuinely fit the role.
      // Penalize excessive estimated travel rather
      // than assuming the nearest venue is always best.
      candidates.sort((a, b) => {
        const aValue =
          a.suitabilityScore -
          a.travelMinutes * 0.8

        const bValue =
          b.suitabilityScore -
          b.travelMinutes * 0.8

        if (bValue !== aValue) {
          return bValue - aValue
        }

        return a.entry.venue.id.localeCompare(
          b.entry.venue.id
        )
      })

      const availableVenueCount = candidates.length

      for (
        const candidate of candidates.slice(
          0,
          settings.candidatesPerRole
        )
      ) {
        const experienceScore =
          scoreSequenceTransition({
            state,
            nextRole: role,
            nextFormatFamily:
              candidate.entry.formatFamily,
            suitabilityScore:
              candidate.suitabilityScore,
            travelMinutes:
              candidate.travelMinutes,
            availableVenueCount,
            flowIntent: settings.flowIntent,
          })

        const nextStep: ExperienceSequenceStep = {
          stageId,
          stage,
          role,
          estimatedArrivalAt:
            new Date(candidate.arrivalMs).toISOString(),
          estimatedDepartureAt:
            new Date(candidate.departureMs).toISOString(),
          estimatedDwellMinutes:
            visitMinutes,
          estimatedTravelMinutes:
            candidate.travelMinutes,
          availableVenueCount,
          representativeVenueId:
            candidate.entry.venue.id,
          venueFormatFamily:
            candidate.entry.formatFamily,
        }

        const nextUsedVenueIds = new Set(
          state.usedVenueIds
        )

        nextUsedVenueIds.add(
          candidate.entry.venue.id
        )

        const nextUsedStageIds = new Set(
          state.usedStageIds
        )

        nextUsedStageIds.add(stageId)

        const nextSteps = [
          ...state.steps,
          nextStep,
        ]

        const nextReasons = [
          ...state.reasons,
          `${definition.shortLabel} fits the planned arrival time and has ${availableVenueCount} available candidate venue${availableVenueCount === 1 ? '' : 's'}.`,
        ]

        results.push({
          steps: nextSteps,
          usedVenueIds: nextUsedVenueIds,
          usedStageIds: nextUsedStageIds,
          usedRoles: [
            ...state.usedRoles,
            role,
          ],
          lastRole: role,
          lastVenue:
            candidate.entry.venue,
          lastMealStartedAt:
            isSubstantialMealRole(role)
              ? candidate.arrivalMs
              : state.lastMealStartedAt,
          previousDiningFormatCount:
            state.previousDiningFormatCount +
            (
              candidate.entry.formatFamily === 'dining'
                ? 1
                : 0
            ),
          currentDepartureMs:
            candidate.departureMs,
          score:
            state.score + experienceScore,
          reasons: nextReasons,
        })

        diagnostics.exploredStates += 1
      }
    }
  }

  return results
}

/* =========================================================
 * Experiential policy
 * ======================================================= */

function isSequenceRoleTransitionAllowed({
  previousRole,
  nextRole,
  flowIntent,
}: {
  previousRole: ExperienceRole
  nextRole: ExperienceRole
  flowIntent: ExperienceSequenceIntent
}): boolean {
  if (flowIntent === 'food_crawl') {
    return true
  }

  if (
    isSubstantialMealRole(previousRole) &&
    isSubstantialMealRole(nextRole)
  ) {
    return false
  }

  if (
    previousRole === 'coffee_tea' &&
    nextRole === 'coffee_tea'
  ) {
    return false
  }

  return true
}

function scoreSequenceTransition({
  state,
  nextRole,
  nextFormatFamily,
  suitabilityScore,
  travelMinutes,
  availableVenueCount,
  flowIntent,
}: {
  state: PlanningState
  nextRole: ExperienceRole
  nextFormatFamily: ExperienceVenueFormatFamily
  suitabilityScore: number
  travelMinutes: number
  availableVenueCount: number
  flowIntent: ExperienceSequenceIntent
}): number {
  let score = 30

  // A venue offering this experience as a primary
  // destination is more valuable than one providing
  // the same experience incidentally.
  score += suitabilityScore

  // Distinct experience roles are preferred.
  if (state.lastRole !== nextRole) {
    score += 12
  } else if (flowIntent !== 'food_crawl') {
    score -= 24
  }

  // Changing broad experience families is desirable.
  if (
    state.lastRole !== 'unknown' &&
    nextRole !== 'unknown' &&
    !isSameExperienceFamily(
      state.lastRole,
      nextRole
    )
  ) {
    score += 12
  }

  // Encourage role diversity across the entire Flow.
  const previousUses = state.usedRoles.filter(
    (role) => role === nextRole
  ).length

  if (flowIntent !== 'food_crawl') {
    score -= previousUses * 16
  }

  // Especially avoid drinks -> dinner -> drinks where
  // each stop is actually another restaurant.
  if (
    flowIntent !== 'food_crawl' &&
    nextFormatFamily === 'dining'
  ) {
    if (state.previousDiningFormatCount >= 2) {
      score -= 34
    } else if (
      state.previousDiningFormatCount === 1
    ) {
      score -= 14
    }
  }

  // Reward naturally complementary transitions.
  if (
    isSubstantialMealRole(state.lastRole) &&
    nextRole === 'dessert'
  ) {
    score += 18
  } else if (
    isSubstantialMealRole(state.lastRole) &&
    (
      nextRole === 'entertainment' ||
      nextRole === 'culture'
    )
  ) {
    score += 16
  } else if (
    state.lastRole === 'drinks' &&
    isSubstantialMealRole(nextRole)
  ) {
    score += 12
  }

  // Venue supply provides evidence of feasibility,
  // but should not overwhelm experiential quality.
  score += Math.min(
    10,
    Math.log2(availableVenueCount + 1) * 3
  )

  // Short travel is preferred, but not at the expense
  // of meaningful venue-format differences.
  score -= Math.min(25, travelMinutes * 0.8)

  return score
}

/* =========================================================
 * Inventory preparation
 * ======================================================= */

function buildInventory(
  venues: readonly ExperienceSequenceVenue[],
  anchorVenue: ExperienceSequenceVenue,
  maxRadiusMeters: number | undefined
): InventoryEntry[] {
  const seen = new Set<string>([
    anchorVenue.id,
  ])

  const entries: InventoryEntry[] = []

  const hasRadius =
    typeof maxRadiusMeters === 'number' &&
    Number.isFinite(maxRadiusMeters) &&
    maxRadiusMeters >= 0

  for (const venue of venues) {
    if (!venue?.id || seen.has(venue.id)) {
      continue
    }

    seen.add(venue.id)

    if (hasRadius) {
      const distance = getStraightLineDistance(
        anchorVenue,
        venue
      )

      if (
        distance === null ||
        distance > maxRadiusMeters
      ) {
        continue
      }
    }

    const roles =
      getVenueExperienceCapabilities(venue)

    if (roles.length === 0) {
      continue
    }

    entries.push({
      venue,
      roles,
      formatFamily:
        evaluateExperienceSuitability({
          venue,
          role: roles[0],
        }).venueFormatFamily,
    })
  }

  return entries
}

/* =========================================================
 * Travel and time utilities
 * ======================================================= */

function resolveEstimatedTravelMinutes({
  fromVenue,
  toVenue,
  fallbackMinutes,
  estimateTravelMinutes,
}: {
  fromVenue: ExperienceSequenceVenue
  toVenue: ExperienceSequenceVenue
  fallbackMinutes: number
  estimateTravelMinutes?:
    ExperienceSequenceTravelEstimate
}): number | null {
  if (!estimateTravelMinutes) {
    return fallbackMinutes
  }

  let minutes: number | null

  try {
    minutes = estimateTravelMinutes(
      fromVenue,
      toVenue
    )
  } catch {
    return null
  }

  if (
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes < 0
  ) {
    return null
  }

  return Math.ceil(minutes)
}

function getLocalHourAtTimestamp(
  timestamp: number,
  timezone: string
): number {
  return DateTime.fromMillis(
    timestamp,
    { zone: 'utc' }
  ).setZone(timezone).hour
}

function getStraightLineDistance(
  from: ExperienceSequenceVenue,
  to: ExperienceSequenceVenue
): number | null {
  const fromLat = from.lat
  const fromLon = from.lon
  const toLat = to.lat
  const toLon = to.lon

  if (
    !isValidLatitude(fromLat) ||
    !isValidLongitude(fromLon) ||
    !isValidLatitude(toLat) ||
    !isValidLongitude(toLon)
  ) {
    return null
  }

  const toRadians = Math.PI / 180

  const deltaLat =
    (toLat - fromLat) * toRadians

  const deltaLon =
    (toLon - fromLon) * toRadians

  const latitude1 = fromLat * toRadians
  const latitude2 = toLat * toRadians

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLon / 2) ** 2

  return (
    6371000 *
    2 *
    Math.atan2(
      Math.sqrt(Math.max(0, haversine)),
      Math.sqrt(Math.max(0, 1 - haversine))
    )
  )
}

function isValidLatitude(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= 90
  )
}

function isValidLongitude(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= 180
  )
}

function isDiningFormat(
  venue: ExperienceSequenceVenue
): boolean {
  const roles =
    getVenueExperienceCapabilities(venue)

  if (roles.length === 0) {
    return false
  }

  return (
    evaluateExperienceSuitability({
      venue,
      role: roles[0],
    }).venueFormatFamily === 'dining'
  )
}

/* =========================================================
 * Alternative ranking
 * ======================================================= */

function comparePlanningStates(
  a: PlanningState,
  b: PlanningState
): number {
  const aRank = getStateRank(a)
  const bRank = getStateRank(b)

  if (bRank !== aRank) {
    return bRank - aRank
  }

  return getStateSignature(a).localeCompare(
    getStateSignature(b)
  )
}

function getStateRank(
  state: PlanningState
): number {
  const uniqueRoles = new Set(
    state.usedRoles.filter(
      (role) => role !== 'unknown'
    )
  ).size

  return (
    state.score +
    uniqueRoles * 6
  )
}

function toAlternative(
  state: PlanningState,
  startMs: number
): ExperienceSequenceAlternative {
  const endMs =
    state.currentDepartureMs

  const totalMinutes =
    Math.round(
      (endMs - startMs) / 60000
    )

  const distinctRoles = new Set(
    state.usedRoles.filter(
      (role) => role !== 'unknown'
    )
  ).size

  // Favor rich, differentiated itineraries without
  // rewarding the addition of arbitrary low-value stops.
  const finalScore =
    state.score +
    distinctRoles * 6 -
    Math.max(
      0,
      state.steps.length - 3
    ) * 12

  return {
    id: `experience-sequence-${state.steps
      .map((step) => step.stageId)
      .join('-')}-${state.steps
      .map((step) => step.role)
      .join('-')}`,
    steps: state.steps,
    stageIds: state.steps.map(
      (step) => step.stageId
    ),
    roles: state.steps.map(
      (step) => step.role
    ),
    totalStops: state.steps.length + 1,
    estimatedTotalMinutes: totalMinutes,
    estimatedEndAt:
      new Date(endMs).toISOString(),
    score:
      Math.round(finalScore * 100) / 100,
    reasons: state.reasons,
  }
}

function compareAlternatives(
  a: ExperienceSequenceAlternative,
  b: ExperienceSequenceAlternative
): number {
  if (b.score !== a.score) {
    return b.score - a.score
  }

  if (
    a.estimatedTotalMinutes !==
    b.estimatedTotalMinutes
  ) {
    return (
      a.estimatedTotalMinutes -
      b.estimatedTotalMinutes
    )
  }

  return a.id.localeCompare(b.id)
}

function getStateSignature(
  state: PlanningState
): string {
  return state.steps
    .map(
      (step) =>
        `${step.stageId}:${step.role}:${step.representativeVenueId}`
    )
    .join('|')
}

function deduplicatePlanningStates(
  states: PlanningState[]
): PlanningState[] {
  const seen = new Set<string>()

  return states.filter((state) => {
    const signature =
      getStateSignature(state)

    if (seen.has(signature)) {
      return false
    }

    seen.add(signature)

    return true
  })
}

function deduplicateAlternatives(
  alternatives: ExperienceSequenceAlternative[]
): ExperienceSequenceAlternative[] {
  const seen = new Set<string>()

  return alternatives.filter((alternative) => {
    // Distinct proposed venue reservations are useful
    // inside beam exploration; final recommendations
    // should prioritize different experience sequences.
    const signature = alternative.steps
      .map(
        (step) =>
          `${step.stageId}:${step.role}`
      )
      .join('|')

    if (seen.has(signature)) {
      return false
    }

    seen.add(signature)

    return true
  })
}

/* =========================================================
 * Settings validation
 * ======================================================= */

function normalizeSettings(
  params: PlanExperienceSequenceParams
): NormalizedSettings {
  const anchorDefinition =
    getExperienceRoleDefinition(
      params.anchorRole
    )

  return {
    maxStops: clampInteger(
      params.maxStops,
      DEFAULT_MAX_STOPS,
      1,
      MAX_SUPPORTED_STOPS
    ),
    maxRouteMinutes: clampInteger(
      params.maxRouteMinutes,
      DEFAULT_MAX_ROUTE_MINUTES,
      60,
      720
    ),
    anchorDwellMinutes: clampInteger(
      params.anchorDwellMinutes,
      anchorDefinition.defaultDwellMinutes,
      0,
      240
    ),
    estimatedLegTravelMinutes: clampInteger(
      params.estimatedLegTravelMinutes,
      DEFAULT_LEG_MINUTES,
      0,
      120
    ),
    maxAlternatives: clampInteger(
      params.maxAlternatives,
      DEFAULT_ALTERNATIVES,
      1,
      20
    ),
    beamWidth: clampInteger(
      params.beamWidth,
      DEFAULT_BEAM_WIDTH,
      1,
      100
    ),
    candidatesPerRole: clampInteger(
      params.candidatesPerRole,
      DEFAULT_CANDIDATES_PER_ROLE,
      1,
      12
    ),
    minimumMealSpacingMinutes: clampInteger(
      params.minimumMealSpacingMinutes,
      DEFAULT_MEAL_SPACING_MINUTES,
      1,
      600
    ),
    flowIntent:
      params.flowIntent === 'food_crawl'
        ? 'food_crawl'
        : 'standard',
  }
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return fallback
  }

  return Math.max(
    min,
    Math.min(
      max,
      Math.round(value)
    )
  )
}

function parseRequiredTimestamp(
  value: Date | string
): number {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      '[planExperienceSequence] Invalid plannedStartAt.'
    )
  }

  return timestamp
}

function assertTimezone(
  timezone: string
): void {
  if (
    !timezone ||
    !DateTime.now().setZone(timezone).isValid
  ) {
    throw new Error(
      '[planExperienceSequence] A valid IANA timezone is required.'
    )
  }
}
