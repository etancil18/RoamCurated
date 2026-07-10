// lib/outings/sequenceScoring/output.ts

import type {
  GeneratedOutingStop,
  PlanMode,
  PlanningContext,
  PlanningSlot,
  SelectionPass,
  StopRole,
  VenueRecord,
} from "../types"

import type { CandidateVenue } from "./types"

import {
  addMinutes,
  resolvePlannerTimeZone,
} from "./time"

import {
  humanizeRole,
  normalizeDisplayVenueType,
  normalizeStringArray,
  normalizeVenueTypes,
  uniqueStrings,
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

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

type CandidateScoreComponents = {
  roleFit?: number
  semantic?: number
  temporal?: number
  time?: number
  distance?: number
  geometry?: number
  budget?: number
  vibe?: number
  archetype?: number
  group?: number
  sequence?: number
  transition?: number
  dataQuality?: number
  hours?: number
  energy?: number
  vibeRequired?: number
  vibeDaypart?: number
  vibePenalty?: number
}

type CandidateWithPlannerEvidence = CandidateVenue & {
  scoreComponents?: CandidateScoreComponents | null
  normalizedType?: string | null
  normalizedTypes?: string[] | null
  normalizedTags?: string[] | null
  normalizedVibes?: string[] | null
  normalizedTimeCategories?: string[] | null
  semanticFitScore?: number | null
  vibeFitScore?: number | null
  vibeConfidence?: number | null
  archetypeFitScore?: number | null
  timeFitScore?: number | null
  geometryFitScore?: number | null
  sequenceFitScore?: number | null
  dataQualityScore?: number | null
  energyRamp?: string | number | null
}

type SelectedCandidateWithSlot = {
  venue: CandidateVenue
  slot: PlanningSlot
  selectedPass: SelectionPass
}

// -----------------------------------------------------------------------------
// Stop generation
// -----------------------------------------------------------------------------

export function generatePlanStops(
  rankedCandidates: CandidateVenue[],
  context: PlanningContext
): GeneratedOutingStop[] {
  const slots = getPlanningSlots(context)
  const selection = selectCandidates(rankedCandidates, context, slots)
  const timeZone = resolvePlannerTimeZone(context)

  const selectedStopsWithSlots =
    selection.selected as SelectedCandidateWithSlot[]

  return selectedStopsWithSlots.map(
    ({ venue, slot, selectedPass }, index) => {
      const candidate = venue as CandidateWithPlannerEvidence
      const role = pickRoleForSlot(slot, candidate.inferredRoles)

      const previousVenue =
        index > 0
          ? selectedStopsWithSlots[index - 1]?.venue ?? null
          : null

      const distanceFromPrev =
        previousVenue != null
          ? getDistanceBetweenVenues(previousVenue, candidate)
          : candidate.distanceMeters

      const venueTypes = resolveVenueTypes(candidate)
      const venueType =
        resolvePrimaryVenueType(candidate, venueTypes)

      const displayType = resolveDisplayTypeForSlot({
        slot,
        role,
        venueTypes,
        venueType,
        timeZone,
      })

      const vibeMatchedTypes = resolveVibeMatchedTypes({
        candidate,
        context,
        slot,
      })

      const vibeScore = resolveVibeScore(candidate)
      const vibeConfidence = resolveVibeConfidence({
        candidate,
        vibeMatchedTypes,
        context,
        slot,
      })

      const scoreComponents =
        normalizeScoreComponents(candidate.scoreComponents)

      return {
        venueId: candidate.id,
        stopOrder: index + 1,
        role,
        phase: slot.phase,
        venueType,
        displayType,
        title:
          normalizeVenueName(candidate.name) ??
          humanizeRole(role),

        rationale: buildRationale({
          venueName: candidate.name,
          role,
          distanceMeters:
            index === 0
              ? candidate.distanceMeters
              : distanceFromPrev,
          eventArchetype: context.eventArchetype,
          mode: context.mode,
          venueTypes,
          vibeMatchedTypes,
          selectedPass,
        }),

        plannedArrivalAt:
          slot.targetArrivalAt.toISOString(),

        plannedDepartureAt:
          slot.targetDepartureAt.toISOString(),

        dwellMinutes:
          slot.dwellMinutes,

        travelMode:
          inferTravelMode(
            context.mobility,
            distanceFromPrev,
            context
          ),

        travelMinutesFromPrev:
          index === 0
            ? defaultTravelMinutesForFirstSlot(
                context,
                slot
              )
            : estimateTravelMinutes(
                context.mobility,
                distanceFromPrev,
                context
              ),

        distanceMetersFromPrev:
          distanceFromPrev,

        lat:
          candidate.lat ?? null,

        lon:
          candidate.lon ?? null,

        address:
          candidate.address ?? null,

        bookingOptions:
          candidate.bookingOptions ?? null,

        metadata: {
          venueName:
            candidate.name ?? null,

          venueAddress:
            candidate.address ?? null,

          score:
            finiteNumberOrNull(candidate.score),

          inferredRoles:
            candidate.inferredRoles,

          venueTypes,
          venueType,
          displayType,
          appliedDisplayType:
            displayType,

          selectedPass:
            selectedPass ?? null,

          eventArchetype:
            context.eventArchetype,

          semanticRole:
            slot.semanticRole ?? null,

          slotPhase:
            slot.phase,

          slotIndex:
            slot.index,

          vibeMatchedTypes,
          vibeScore,
          vibeConfidence,

          scoreComponents,
          semanticFitScore:
            finiteNumberOrNull(
              candidate.semanticFitScore ??
                scoreComponents.semantic
            ),

          archetypeFitScore:
            finiteNumberOrNull(
              candidate.archetypeFitScore ??
                scoreComponents.archetype
            ),

          timeFitScore:
            finiteNumberOrNull(
              candidate.timeFitScore ??
                scoreComponents.temporal ??
                scoreComponents.time
            ),

          geometryFitScore:
            finiteNumberOrNull(
              candidate.geometryFitScore ??
                scoreComponents.geometry ??
                scoreComponents.distance
            ),

          sequenceFitScore:
            finiteNumberOrNull(
              candidate.sequenceFitScore ??
                scoreComponents.sequence ??
                scoreComponents.transition
            ),

          dataQualityScore:
            finiteNumberOrNull(
              candidate.dataQualityScore ??
                scoreComponents.dataQuality
            ),

          /*
           * Energy ramp remains informational only.
           * It is intentionally not converted into a user-facing claim
           * or confidence multiplier until venue coverage is stronger.
           */
          energyRamp:
            candidate.energyRamp ?? null,
        },
      }
    }
  )
}

// -----------------------------------------------------------------------------
// Timing compatibility
// -----------------------------------------------------------------------------

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
      travelMinutesFromPrev:
        defaultTravelMinutesForSlotIndex(
          context,
          index
        ),
    }
  }

  const dwellMinutes =
    role === "food"
      ? 75
      : role === "drink"
        ? 60
        : role === "activity"
          ? 60
          : role === "coffee"
            ? 40
            : 45

  if (context.mode === "before") {
    const finalDeparture =
      addMinutes(context.startsAt, -35)

    const reverseOffset =
      totalStops - index - 1

    const departure =
      addMinutes(
        finalDeparture,
        -(reverseOffset * 75)
      )

    const arrival =
      addMinutes(
        departure,
        -dwellMinutes
      )

    return {
      arrival,
      departure,
      dwellMinutes,
      travelMinutesFromPrev:
        index === 0 ? null : 12,
    }
  }

  if (context.mode === "after") {
    const arrival =
      addMinutes(
        effectiveExitAt,
        20 + index * 80
      )

    const departure =
      addMinutes(
        arrival,
        dwellMinutes
      )

    return {
      arrival,
      departure,
      dwellMinutes,
      travelMinutesFromPrev:
        index === 0 ? 20 : 12,
    }
  }

  if (index === 0) {
    const departure =
      addMinutes(context.startsAt, -35)

    const arrival =
      addMinutes(
        departure,
        -dwellMinutes
      )

    return {
      arrival,
      departure,
      dwellMinutes,
      travelMinutesFromPrev: null,
    }
  }

  const arrival =
    addMinutes(
      effectiveExitAt,
      20 + (index - 1) * 80
    )

  const departure =
    addMinutes(
      arrival,
      dwellMinutes
    )

  return {
    arrival,
    departure,
    dwellMinutes,
    travelMinutesFromPrev:
      index === 1 ? 20 : 12,
  }
}

// -----------------------------------------------------------------------------
// User-facing summary
// -----------------------------------------------------------------------------

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
  const safeEventTitle =
    cleanDisplayText(eventTitle) ??
    "your event"

  const safeVenueName =
    cleanDisplayText(venueName)

  const stopNames =
    stops
      .map((stop) =>
        cleanDisplayText(stop.title)
      )
      .filter(
        (value): value is string =>
          value != null
      )

  const routeText =
    formatRouteNames(stopNames)

  const timingText =
    buildFriendlyExitText({
      mode,
      planningContext,
    })

  const anchorText =
    safeVenueName &&
    safeVenueName.toLowerCase() !==
      safeEventTitle.toLowerCase()
      ? ` at ${safeVenueName}`
      : ""

  if (stops.length === 0) {
    return `${safeEventTitle}${anchorText}`
  }

  if (mode === "before") {
    return timingText
      ? `${routeText} before ${safeEventTitle}${anchorText}, ${timingText}.`
      : `${routeText} before ${safeEventTitle}${anchorText}.`
  }

  if (mode === "after") {
    return timingText
      ? `${safeEventTitle}${anchorText}, then ${routeText} ${timingText}.`
      : `${safeEventTitle}${anchorText}, then ${routeText}.`
  }

  const beforeStops =
    stops.filter(
      (stop) => stop.phase === "before"
    )

  const afterStops =
    stops.filter(
      (stop) => stop.phase === "after"
    )

  const beforeNames =
    beforeStops
      .map((stop) =>
        cleanDisplayText(stop.title)
      )
      .filter(
        (value): value is string =>
          value != null
      )

  const afterNames =
    afterStops
      .map((stop) =>
        cleanDisplayText(stop.title)
      )
      .filter(
        (value): value is string =>
          value != null
      )

  if (
    beforeNames.length > 0 &&
    afterNames.length > 0
  ) {
    return `${formatRouteNames(
      beforeNames
    )} before ${safeEventTitle}${anchorText}, then ${formatRouteNames(
      afterNames
    )} afterward.`
  }

  if (beforeNames.length > 0) {
    return `${formatRouteNames(
      beforeNames
    )} before ${safeEventTitle}${anchorText}.`
  }

  if (afterNames.length > 0) {
    return `${safeEventTitle}${anchorText}, then ${formatRouteNames(
      afterNames
    )} afterward.`
  }

  return `${safeEventTitle}${anchorText} with ${routeText}.`
}

// -----------------------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------------------

export function computeConfidenceScore(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): number {
  if (stops.length === 0) return 0

  const intendedStopCount =
    context.slots?.length ??
    context.desiredRoles.length

  const completionRatio =
    intendedStopCount > 0
      ? Math.min(
          1,
          stops.length /
            intendedStopCount
        )
      : 1

  const qualifiesLateNightSingleStop =
    qualifiesForLateNightSingleStopFallback(
      stops,
      context
    )

  const qualifiesReducedBeforeSingleStop =
    qualifiesForReducedBeforeSingleStopFallback(
      stops,
      context
    )

  const qualifiesLeaveEarlyReducedCoverage =
    qualifiesForLeaveEarlyReducedCoverage(
      stops,
      context
    )

  const validReducedRoute =
    qualifiesLateNightSingleStop ||
    qualifiesReducedBeforeSingleStop ||
    qualifiesLeaveEarlyReducedCoverage

  const effectiveCompletion =
    validReducedRoute
      ? 1
      : completionRatio

  const semanticConfidence =
    averageKnownValues(
      stops.map((stop) =>
        normalizeScoreConfidence(
          readStopMetadataNumber(
            stop,
            "semanticFitScore"
          )
        )
      )
    )

  const vibeConfidence =
    averageKnownValues(
      stops.map((stop) =>
        clamp01(
          readStopMetadataNumber(
            stop,
            "vibeConfidence"
          )
        )
      )
    )

  const archetypeConfidence =
    averageKnownValues(
      stops.map((stop) =>
        normalizeScoreConfidence(
          readStopMetadataNumber(
            stop,
            "archetypeFitScore"
          )
        )
      )
    )

  const temporalConfidence =
    averageKnownValues(
      stops.map((stop) =>
        normalizeScoreConfidence(
          readStopMetadataNumber(
            stop,
            "timeFitScore"
          )
        )
      )
    )

  const geometryConfidence =
    stops.every((stop) =>
      stopDistanceIsCoherent(
        stop,
        context
      )
    )
      ? 1
      : 0.35

  const selectionPassConfidence =
    averageKnownValues(
      stops.map((stop) =>
        selectionPassConfidenceFor(
          stop.metadata?.selectedPass ??
            null
        )
      )
    )

  const contextualDataConfidence =
    averageKnownValues(
      stops.map((stop) =>
        computeStopContextDataConfidence(
          stop
        )
      )
    )

  const anchorConfidence =
    context.anchorVenue?.lat != null &&
    context.anchorVenue?.lon != null
      ? 1
      : 0.35

  const confidence = weightedAverage([
    [effectiveCompletion, 0.18],
    [semanticConfidence, 0.17],
    [vibeConfidence, 0.18],
    [archetypeConfidence, 0.14],
    [temporalConfidence, 0.12],
    [geometryConfidence, 0.1],
    [selectionPassConfidence, 0.06],
    [contextualDataConfidence, 0.03],
    [anchorConfidence, 0.02],
  ])

  return Number(
    Math.max(
      0,
      Math.min(0.99, confidence)
    ).toFixed(2)
  )
}

// -----------------------------------------------------------------------------
// Rationale
// -----------------------------------------------------------------------------

export function buildRationale({
  venueName,
  role,
  distanceMeters,
  eventArchetype,
  mode,
  venueTypes = [],
  vibeMatchedTypes = [],
  selectedPass = null,
}: {
  venueName: string | null
  role: StopRole
  distanceMeters: number | null
  eventArchetype: string
  mode: PlanMode
  venueTypes?: string[]
  vibeMatchedTypes?: string[]
  selectedPass?: SelectionPass | null
}): string {
  const safeName =
    cleanDisplayText(venueName) ??
    "This stop"

  const roleText =
    buildRoleRationale(role)

  const proximityText =
    buildProximityRationale(
      distanceMeters
    )

  const contextualText =
    buildContextualRationale({
      eventArchetype,
      venueTypes,
      vibeMatchedTypes,
    })

  const confidenceText =
    selectedPass === "emergency"
      ? "It is a practical fallback based on the available nearby options."
      : selectedPass === "relaxed"
        ? "It is a flexible match based on the available nearby options."
        : null

  return [
    `${safeName} ${roleText}`,
    proximityText,
    contextualText,
    confidenceText,
  ]
    .filter(
      (value): value is string =>
        Boolean(value)
    )
    .join(" ")
}

// -----------------------------------------------------------------------------
// Minimum stop count
// -----------------------------------------------------------------------------

export function minimumStopsForMode(
  mode: PlanMode
): number {
  return mode === "full" ? 3 : 2
}

// -----------------------------------------------------------------------------
// Planning-slot fallback
// -----------------------------------------------------------------------------

function getPlanningSlots(
  context: PlanningContext
): PlanningSlot[] {
  if (context.slots?.length) {
    return context.slots
  }

  return context.desiredRoles.map(
    (role, index) =>
      fallbackSlotForIndex(
        index,
        context,
        role,
        context.desiredRoles.length
      )
  )
}

function fallbackSlotForIndex(
  index: number,
  context: PlanningContext,
  role =
    context.desiredRoles[index] ??
    "activity",
  totalStops =
    context.desiredRoles.length
): PlanningSlot {
  const timing =
    computeLegacyStopTiming(
      index,
      totalStops,
      role,
      context
    )

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
    targetArrivalAt:
      timing.arrival,
    targetDepartureAt:
      timing.departure,
    dwellMinutes:
      timing.dwellMinutes,
    strictProgression:
      phase === "before"
        ? index > 0
        : context.mode === "after"
          ? index === 0
          : index === 1,
    flexibleRole: null,
    semanticRole: null,
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
    role === "food"
      ? 75
      : role === "drink"
        ? 60
        : role === "activity"
          ? 60
          : role === "coffee"
            ? 40
            : 45

  const effectiveExitAt =
    getEffectiveExitAt(context)

  if (context.mode === "before") {
    const finalDeparture =
      addMinutes(context.startsAt, -35)

    const reverseOffset =
      totalStops - index - 1

    const departure =
      addMinutes(
        finalDeparture,
        -(reverseOffset * 75)
      )

    const arrival =
      addMinutes(
        departure,
        -dwellMinutes
      )

    return {
      arrival,
      departure,
      dwellMinutes,
    }
  }

  if (context.mode === "after") {
    const arrival =
      addMinutes(
        effectiveExitAt,
        20 + index * 80
      )

    const departure =
      addMinutes(
        arrival,
        dwellMinutes
      )

    return {
      arrival,
      departure,
      dwellMinutes,
    }
  }

  if (index === 0) {
    const departure =
      addMinutes(context.startsAt, -35)

    const arrival =
      addMinutes(
        departure,
        -dwellMinutes
      )

    return {
      arrival,
      departure,
      dwellMinutes,
    }
  }

  const arrival =
    addMinutes(
      effectiveExitAt,
      20 + (index - 1) * 80
    )

  const departure =
    addMinutes(
      arrival,
      dwellMinutes
    )

  return {
    arrival,
    departure,
    dwellMinutes,
  }
}

// -----------------------------------------------------------------------------
// Display-type helpers
// -----------------------------------------------------------------------------

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
  const isWeekend =
    isWeekendInTimeZone(
      slot.targetArrivalAt,
      timeZone
    )

  const hasBrunch =
    venueTypes.includes("brunch")

  const hasLunch =
    venueTypes.includes("lunch")

  if (
    !isWeekend &&
    hasBrunch &&
    hasLunch
  ) {
    return "lunch"
  }

  if (
    isWeekend &&
    hasBrunch
  ) {
    return "brunch"
  }

  return (
    pickBestDisplayTypeForRole(
      slot,
      role,
      venueTypes,
      timeZone
    ) ??
    venueType ??
    role
  )
}

function resolveVenueTypes(
  candidate: CandidateWithPlannerEvidence
): string[] {
  const stored =
    candidate.normalizedTypes ??
    null

  if (
    Array.isArray(stored) &&
    stored.length > 0
  ) {
    return uniqueStrings(
      stored
        .map(normalizeToken)
        .filter(Boolean)
    )
  }

  return normalizeVenueTypes(
    candidate.type
  )
}

function resolvePrimaryVenueType(
  candidate: CandidateWithPlannerEvidence,
  venueTypes: string[]
): string | null {
  const explicit =
    cleanDisplayText(
      candidate.normalizedType
    )

  if (explicit) {
    return normalizeToken(explicit)
  }

  return (
    normalizeDisplayVenueType(
      candidate.type
    ) ??
    venueTypes[0] ??
    null
  )
}

function isWeekendInTimeZone(
  date: Date,
  timeZone: string
): boolean {
  const weekday =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        weekday: "short",
      }
    ).format(date)

  return (
    weekday === "Sat" ||
    weekday === "Sun"
  )
}

// -----------------------------------------------------------------------------
// Vibe evidence
// -----------------------------------------------------------------------------

function resolveVibeMatchedTypes({
  candidate,
  context,
  slot,
}: {
  candidate: CandidateWithPlannerEvidence
  context: PlanningContext
  slot: PlanningSlot
}): string[] {
  const candidateTokens =
    uniqueStrings([
      ...resolveVenueTypes(candidate),
      ...normalizeStringArray(
        candidate.tags
      ),
      ...normalizeStringArray(
        candidate.vibe
      ),
      ...normalizeStringArray(
        candidate.time_category
      ),
      ...(candidate.normalizedTags ?? []),
      ...(candidate.normalizedVibes ?? []),
      ...(candidate.normalizedTimeCategories ?? []),
    ].map(normalizeToken))

  const desiredTokens =
    uniqueStrings([
      ...context.vibeTags,
      ...(context.vibePlanning
        ?.preferredTypes ?? []),
      ...(context.vibePlanning
        ?.requiredAnyTypes ?? []),
      ...(slot.vibePreferredTypes ?? []),
      ...(slot.vibeRequiredAnyTypes ?? []),
    ].map(normalizeToken))

  if (
    candidateTokens.length === 0 ||
    desiredTokens.length === 0
  ) {
    return []
  }

  const candidateSet =
    new Set(candidateTokens)

  return desiredTokens.filter(
    (token) =>
      candidateSet.has(token)
  )
}

function resolveVibeScore(
  candidate: CandidateWithPlannerEvidence
): number | null {
  return finiteNumberOrNull(
    candidate.vibeFitScore ??
      candidate.scoreComponents?.vibe
  )
}

function resolveVibeConfidence({
  candidate,
  vibeMatchedTypes,
  context,
  slot,
}: {
  candidate: CandidateWithPlannerEvidence
  vibeMatchedTypes: string[]
  context: PlanningContext
  slot: PlanningSlot
}): number | null {
  const explicit =
    clamp01(candidate.vibeConfidence)

  if (explicit != null) {
    return explicit
  }

  const requested =
    uniqueStrings([
      ...context.vibeTags,
      ...(context.vibePlanning
        ?.requiredAnyTypes ?? []),
      ...(slot.vibeRequiredAnyTypes ?? []),
    ].map(normalizeToken))

  if (requested.length === 0) {
    return null
  }

  if (vibeMatchedTypes.length === 0) {
    return 0
  }

  return Number(
    Math.min(
      1,
      vibeMatchedTypes.length /
        Math.min(requested.length, 4)
    ).toFixed(3)
  )
}

// -----------------------------------------------------------------------------
// Friendly-copy helpers
// -----------------------------------------------------------------------------

function buildRoleRationale(
  role: StopRole
): string {
  if (role === "coffee") {
    return "offers an easy place to start"
  }

  if (role === "food") {
    return "gives you time for a proper bite"
  }

  if (role === "drink") {
    return "keeps the outing social and easy"
  }

  if (role === "dessert") {
    return "adds a simple final stop"
  }

  return "adds another experience to the route"
}

function buildProximityRationale(
  distanceMeters: number | null
): string | null {
  if (distanceMeters == null) {
    return null
  }

  if (distanceMeters < 500) {
    return "It is only a short walk away."
  }

  if (distanceMeters < 1200) {
    return "It is close enough to keep the route simple."
  }

  if (distanceMeters < 2500) {
    return "It is a manageable short move from the event."
  }

  return "It remains within the planned route area."
}

function buildContextualRationale({
  eventArchetype,
  venueTypes,
  vibeMatchedTypes,
}: {
  eventArchetype: string
  venueTypes: string[]
  vibeMatchedTypes: string[]
}): string | null {
  if (vibeMatchedTypes.length > 0) {
    const readable =
      formatReadableTokens(
        vibeMatchedTypes.slice(0, 2)
      )

    return readable
      ? `Its ${readable} qualities match the feel you selected.`
      : null
  }

  const contextualType =
    chooseSafeContextualType(
      venueTypes
    )

  if (!contextualType) {
    return null
  }

  const archetype =
    normalizeArchetype(
      eventArchetype
    )

  if (
    archetype === "nightlife" ||
    archetype === "music" ||
    archetype === "comedy"
  ) {
    return `Its ${contextualType} setting works naturally around an evening event.`
  }

  if (
    archetype === "arts_culture"
  ) {
    return `Its ${contextualType} setting complements the event without forcing a theme.`
  }

  if (
    archetype === "networking"
  ) {
    return `Its ${contextualType} setting gives you room to talk and settle in.`
  }

  return null
}

function chooseSafeContextualType(
  venueTypes: string[]
): string | null {
  const safeTypes = [
    "coffee",
    "cafe",
    "café",
    "restaurant",
    "dinner",
    "lunch",
    "brunch",
    "bar",
    "cocktail",
    "wine bar",
    "lounge",
    "bakery",
    "dessert",
    "gallery",
    "museum",
    "bookstore",
    "park",
    "garden",
    "brewery",
    "rooftop",
  ]

  const match =
    venueTypes.find((type) =>
      safeTypes.includes(type)
    )

  return match
    ? humanizeToken(match).toLowerCase()
    : null
}

function buildFriendlyExitText({
  mode,
  planningContext,
}: {
  mode: PlanMode
  planningContext: PlanningContext
}): string | null {
  if (
    mode === "before" ||
    !planningContext.plannedExitAt
  ) {
    return null
  }

  const time =
    planningContext.plannedExitAt.toLocaleTimeString(
      "en-US",
      {
        timeZone:
          planningContext.timeZone,
        hour: "numeric",
        minute: "2-digit",
      }
    )

  if (
    planningContext.leaveEarlyByHours
  ) {
    return `based on leaving around ${time}`
  }

  return `after you leave around ${time}`
}

function formatRouteNames(
  names: string[]
): string {
  if (names.length === 0) {
    return "A simple route"
  }

  if (names.length === 1) {
    return names[0]
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`
  }

  return `${names
    .slice(0, -1)
    .join(", ")}, and ${
      names[names.length - 1]
    }`
}

function formatReadableTokens(
  values: string[]
): string | null {
  const readable =
    values
      .map(humanizeToken)
      .filter(Boolean)

  if (readable.length === 0) {
    return null
  }

  if (readable.length === 1) {
    return readable[0].toLowerCase()
  }

  return `${readable[0].toLowerCase()} and ${readable[1].toLowerCase()}`
}

// -----------------------------------------------------------------------------
// Confidence helpers
// -----------------------------------------------------------------------------

function computeStopContextDataConfidence(
  stop: GeneratedOutingStop
): number {
  let score = 0.35

  if (
    stop.metadata?.venueTypes?.length
  ) {
    score += 0.2
  }

  if (
    stop.metadata?.vibeMatchedTypes?.length
  ) {
    score += 0.2
  }

  if (
    typeof stop.metadata
      ?.semanticFitScore === "number"
  ) {
    score += 0.1
  }

  if (
    typeof stop.metadata
      ?.archetypeFitScore === "number"
  ) {
    score += 0.1
  }

  if (
    typeof stop.metadata
      ?.timeFitScore === "number"
  ) {
    score += 0.05
  }

  return Math.min(1, score)
}

function selectionPassConfidenceFor(
  selectedPass:
    | SelectionPass
    | null
    | undefined
): number {
  if (selectedPass === "strict") {
    return 1
  }

  if (selectedPass === "balanced") {
    return 0.82
  }

  if (selectedPass === "relaxed") {
    return 0.62
  }

  if (selectedPass === "emergency") {
    return 0.3
  }

  return 0.5
}

function normalizeScoreConfidence(
  value: number | null
): number | null {
  if (value == null) return null

  if (value >= 0 && value <= 1) {
    return value
  }

  /*
   * Most scoring components are additive point values.
   * Convert those to a bounded confidence signal without pretending
   * the score is a calibrated probability.
   */
  return Number(
    (
      1 /
      (1 + Math.exp(-value / 14))
    ).toFixed(3)
  )
}

function averageKnownValues(
  values: Array<number | null>
): number {
  const known =
    values.filter(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value)
    )

  if (known.length === 0) {
    return 0.5
  }

  return (
    known.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / known.length
  )
}

function weightedAverage(
  values: Array<[number, number]>
): number {
  const totalWeight =
    values.reduce(
      (sum, [, weight]) =>
        sum + weight,
      0
    )

  if (totalWeight <= 0) {
    return 0
  }

  return (
    values.reduce(
      (
        sum,
        [value, weight]
      ) =>
        sum +
        Math.max(
          0,
          Math.min(1, value)
        ) *
          weight,
      0
    ) / totalWeight
  )
}

// -----------------------------------------------------------------------------
// Route coherence
// -----------------------------------------------------------------------------

function stopDistanceIsCoherent(
  stop: GeneratedOutingStop,
  context: PlanningContext
): boolean {
  if (
    stop.distanceMetersFromPrev == null
  ) {
    return true
  }

  const cityPlanning =
    context.cityPlanning

  if (stop.phase === "after") {
    const afterLimit =
      cityPlanning
        ?.distances
        .afterInterstopMeters
        .relaxed ??
      (
        context.mobility === "walk"
          ? 1400
          : context.mobility ===
              "short_ride"
            ? 2200
            : 3200
      )

    return (
      stop.distanceMetersFromPrev <=
      afterLimit
    )
  }

  const beforeLimit =
    cityPlanning
      ?.distances
      .beforeInterstopMeters
      .relaxed ??
    (
      context.mobility === "walk"
        ? 2400
        : context.mobility ===
            "short_ride"
          ? 4500
          : 6000
    )

  return (
    stop.distanceMetersFromPrev <=
    beforeLimit
  )
}

// -----------------------------------------------------------------------------
// Reduced-coverage handling
// -----------------------------------------------------------------------------

function qualifiesForLeaveEarlyReducedCoverage(
  stops: GeneratedOutingStop[],
  context: PlanningContext
): boolean {
  if (!context.leaveEarlyByHours) {
    return false
  }

  const beforeStops =
    stops.filter(
      (stop) =>
        stop.phase === "before"
    ).length

  const afterStops =
    stops.filter(
      (stop) =>
        stop.phase === "after"
    ).length

  if (context.mode === "after") {
    return afterStops >= 1
  }

  if (context.mode === "full") {
    return (
      beforeStops >= 1 &&
      afterStops >= 1
    )
  }

  return false
}

// -----------------------------------------------------------------------------
// Travel defaults
// -----------------------------------------------------------------------------

function defaultTravelMinutesForSlotIndex(
  context: PlanningContext,
  index: number
): number | null {
  if (index === 0) {
    return context.mode === "after"
      ? 20
      : null
  }

  if (
    context.mode === "full" &&
    index === 1
  ) {
    return 20
  }

  return 12
}

function defaultTravelMinutesForFirstSlot(
  context: PlanningContext,
  slot: PlanningSlot
): number | null {
  if (slot.phase === "after") {
    return 20
  }

  if (context.mode === "after") {
    return 20
  }

  return null
}

function getEffectiveExitAt(
  context: PlanningContext
): Date {
  return (
    context.effectiveExitAt ??
    context.estimatedEndAt
  )
}

// -----------------------------------------------------------------------------
// Metadata helpers
// -----------------------------------------------------------------------------

function normalizeScoreComponents(
  components:
    | CandidateScoreComponents
    | null
    | undefined
): CandidateScoreComponents {
  if (
    !components ||
    typeof components !== "object"
  ) {
    return {}
  }

  const normalized:
    CandidateScoreComponents = {}

  for (const [
    key,
    value,
  ] of Object.entries(components)) {
    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      normalized[
        key as keyof CandidateScoreComponents
      ] = value
    }
  }

  return normalized
}

function readStopMetadataNumber(
  stop: GeneratedOutingStop,
  key: string
): number | null {
  const metadata =
    stop.metadata as
      | Record<string, unknown>
      | null
      | undefined

  if (!metadata) return null

  return finiteNumberOrNull(
    metadata[key]
  )
}

function finiteNumberOrNull(
  value: unknown
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null
}

function clamp01(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return Math.max(
    0,
    Math.min(1, value)
  )
}

// -----------------------------------------------------------------------------
// Text normalization
// -----------------------------------------------------------------------------

function normalizeVenueName(
  value: string | null | undefined
): string | null {
  return cleanDisplayText(value)
}

function cleanDisplayText(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null
  }

  const cleaned =
    value
      .replace(/\s+/g, " ")
      .trim()

  return cleaned.length > 0
    ? cleaned
    : null
}

function normalizeToken(
  value: string
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function humanizeToken(
  value: string
): string {
  return normalizeToken(value)
    .split(" ")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ")
}

function normalizeArchetype(
  value: string | null | undefined
): string {
  if (value === "art") {
    return "arts_culture"
  }

  if (value === "sports") {
    return "social_sports"
  }

  if (value === "festival") {
    return "market"
  }

  if (value === "general") {
    return "other"
  }

  return value ?? "other"
}