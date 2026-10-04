// app/api/events/[eventId]/plan-outing/route.ts
// Fully ready to drop in.

import { NextResponse } from "next/server"

import { CITY_CONFIGS } from "@/config/cities"
import { generateEventOutingPlan } from "@/lib/outings/generateEventOutingPlan"
import { buildPlanningContext } from "@/lib/outings/planningContext"
import { persistGeneratedOutingPlan } from "@/lib/outings/persistGeneratedOutingPlan"
import {
  qualifiesForLateNightReducedFullFallback,
  qualifiesForLateNightSingleStopFallback,
} from "@/lib/outings/sequenceScoring"
import {
  qualifiesForDaytimeCultureReducedFullFallback,
  qualifiesForReducedBeforeSingleStopFallback,
} from "@/lib/outings/sequenceScoring/daytime"
import { supabaseServerApi } from "@/lib/supabase/server-api"
import {
  extractVenueFeatures,
  normalizeFeatureValues,
} from "@/lib/outings/venueFeatures"

import type {
  Budget,
  EventRecord,
  LeaveEarlyByHours,
  Mobility,
  PlanMode,
  PlanOutingRequestBody,
  VenueBookingOption,
  VenueRecord,
} from "@/lib/outings/types"

const ALLOWED_MODES: PlanMode[] = ["before", "after", "full"]
const ALLOWED_BUDGETS: Budget[] = ["$", "$$", "$$$", "$$$$"]
const ALLOWED_MOBILITY: Mobility[] = ["walk", "short_ride", "any"]
const ALLOWED_LEAVE_EARLY_BY_HOURS: LeaveEarlyByHours[] = [1, 2, 3, 4]

const MAX_CITY_CANDIDATES = 1000

type PlannerFailureCode =
  | "late_night_low_coverage"
  | "insufficient_venue_coverage"

type VenueBookingRow = {
  provider: string | null
  url: string | null
}

type VenueRecordWithPlannerFields = Omit<
  VenueRecord,
  "type" | "vibe" | "tags" | "time_category" | "hours"
> & {
  type?: string[] | string | null
  vibe?: string[] | string | null
  tags?: string[] | string | null
  time_category?: string[] | string | null
  energy_ramp?: string[] | string | number | null
  hours?:
    | Record<string, { open?: string | null; close?: string | null }>
    | string
    | null
  venue_bookings?: VenueBookingRow[] | null
}

type EventWithVenueRecord = EventRecord & {
  venue:
    | VenueRecordWithPlannerFields
    | VenueRecordWithPlannerFields[]
    | null
}

type CandidateCoverageSummary = {
  totalFetched: number
  totalEligible: number
  rejectedMissingCoordinates: number
  rejectedMissingSemanticData: number
  withTypeData: number
  withVibeData: number
  withTagData: number
  withTimeCategoryData: number
  withEnergyRampData: number
  highSemanticConfidence: number
  mediumSemanticConfidence: number
  lowSemanticConfidence: number
  averageSemanticCompleteness: number
  averageTemporalCompleteness: number
  averageFeatureConfidence: number
}

export async function POST(
  req: Request,
  context: {
    params: Promise<{
      eventId: string
    }>
  }
) {
  try {
    const { eventId } = await context.params

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      )
    }

    const body = (await safeJson(req)) as PlanOutingRequestBody

    const mode = normalizeMode(body.mode)
    const groupSize = normalizeGroupSize(body.groupSize)
    const budget = normalizeBudget(body.budget)
    const mobility = normalizeMobility(body.mobility)

    /*
     * Preserve the user's original preset IDs here.
     *
     * Do not call expandVibeTags() in the API route. PlanningContext and the
     * feature-scoring layer need the canonical preset ID, such as "chill" or
     * "romantic", so they can retrieve the correct preset configuration.
     */
    const vibeTags = normalizeVibeTags(body.vibeTags)

    const leaveEarlyByHours = normalizeLeaveEarlyByHours(
      body.leaveEarlyByHours
    )

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        `
          id,
          title,
          description,
          archetype,
          starts_at,
          ends_at,
          tags,
          venue_id,
          venue:venues (
            id,
            name,
            slug,
            city,
            lat,
            lon,
            address,
            tags,
            vibe,
            type,
            time_category,
            energy_ramp,
            price,
            hours,
            venue_bookings (
              provider,
              url
            )
          )
        `
      )
      .eq("id", eventId)
      .single<EventWithVenueRecord>()

    if (eventError || !event) {
      return NextResponse.json(
        {
          error: "Event not found",
        },
        {
          status: 404,
        }
      )
    }

    const plannedExitAt = derivePlannedExitAtFromLeaveEarlyByHours(
      event.ends_at,
      leaveEarlyByHours
    )

    const anchorVenueRaw = normalizeVenueRelation(event.venue)
    const anchorVenue = enrichVenueWithBookingOptions(anchorVenueRaw)
    const city = anchorVenue?.city?.trim()

    if (!city) {
      return NextResponse.json(
        {
          error: "Event venue city is required to plan an outing",
        },
        {
          status: 422,
        }
      )
    }

    if (
      !anchorVenue ||
      anchorVenue.lat == null ||
      anchorVenue.lon == null
    ) {
      return NextResponse.json(
        {
          error: "Event venue coordinates are required to plan an outing",
        },
        {
          status: 422,
        }
      )
    }

    const cityKey = city.toLowerCase()
    const cityConfig = CITY_CONFIGS[cityKey]
    const timeZone =
      cityConfig?.timezone ?? "America/New_York"
    const cityPlanning =
      cityConfig?.planning ?? null

    console.log(
      "OUTING_EVENT_TIME_DEBUG",
      JSON.stringify(
        {
          eventId: event.id,
          rawStartsAt: event.starts_at,
          parsedStartsAt: safeIsoString(event.starts_at),
          rawEndsAt: event.ends_at,
          parsedEndsAt: safeIsoString(event.ends_at),
          leaveEarlyByHours,
          plannedExitAt,
          title: event.title,
          tags: event.tags,
          requestedVibePresets: vibeTags,
          city,
          timeZone,
          cityPlanning,
        },
        null,
        2
      )
    )

    /*
     * Do not require type or vibe at the database-query layer.
     *
     * A venue can still be contextually useful when its strongest evidence
     * exists in tags. Requiring both type and vibe was silently removing
     * potentially strong candidates before semantic scoring.
     */
    const {
      data: venueCandidatesRaw,
      error: venuesError,
    } = await supabase
      .from("venues")
      .select(
        `
          id,
          name,
          slug,
          city,
          lat,
          lon,
          address,
          tags,
          vibe,
          type,
          time_category,
          energy_ramp,
          price,
          hours,
          venue_bookings (
            provider,
            url
          )
        `
      )
      .eq("city", city)
      .neq("id", anchorVenue.id)
      .not("lat", "is", null)
      .not("lon", "is", null)
      .limit(MAX_CITY_CANDIDATES)

    if (venuesError) {
      return NextResponse.json(
        {
          error: `Failed to fetch nearby venues: ${venuesError.message}`,
        },
        {
          status: 500,
        }
      )
    }

    const normalizedVenueCandidates = (
      (venueCandidatesRaw ?? []) as VenueRecordWithPlannerFields[]
    )
      .map(enrichVenueWithBookingOptions)
      .filter((venue): venue is VenueRecord => venue != null)

    /*
     * This is the only semantic candidate exclusion performed in this route:
     * venues with no type, no vibe, and no tags cannot support a contextual
     * recommendation.
     *
     * Everything else—including archetype fit, vibe fit, budget fit,
     * time-category fit, and geometry—must be handled by the scoring and
     * selection layers.
     */
    const venueCandidates = normalizedVenueCandidates.filter(
      hasMinimumSemanticPlanningData
    )

    const candidateCoverage = buildCandidateCoverageSummary({
      fetchedCandidates: normalizedVenueCandidates,
      eligibleCandidates: venueCandidates,
    })

    const debugPlanningContext = buildPlanningContext({
      mode,
      event,
      anchorVenue,
      groupSize,
      budget,
      mobility,
      vibeTags,
      timeZone,
      leaveEarlyByHours,
      cityPlanning,
    })

    console.log(
      "OUTING_CONTEXT_DEBUG",
      JSON.stringify(
        {
          eventId: event.id,
          mode: debugPlanningContext.mode,
          startsAt:
            debugPlanningContext.startsAt?.toISOString?.(),
          estimatedEndAt:
            debugPlanningContext.estimatedEndAt?.toISOString?.(),
          leaveEarlyByHours:
            debugPlanningContext.leaveEarlyByHours ?? null,
          plannedExitAt:
            debugPlanningContext.plannedExitAt?.toISOString?.() ??
            null,
          effectiveExitAt:
            debugPlanningContext.effectiveExitAt?.toISOString?.() ??
            null,
          plannedStartAt:
            debugPlanningContext.plannedStartAt?.toISOString?.(),
          plannedEndAt:
            debugPlanningContext.plannedEndAt?.toISOString?.(),
          eventArchetype:
            debugPlanningContext.eventArchetype,
          desiredRoles:
            debugPlanningContext.desiredRoles,
          requestedVibePresets:
            vibeTags,
          vibePlanning:
            debugPlanningContext.vibePlanning ?? null,
          candidateCoverage,
          city,
          timeZone,
          cityPlanning:
            debugPlanningContext.cityPlanning ??
            cityPlanning,
          slots:
            debugPlanningContext.slots?.map((slot) => ({
              index: slot.index,
              role: slot.role,
              phase: slot.phase,
              arrival:
                slot.targetArrivalAt?.toISOString?.(),
              departure:
                slot.targetDepartureAt?.toISOString?.(),
              flexibleRole:
                slot.flexibleRole,
              semanticRole:
                slot.semanticRole ?? null,
              vibePreferredTypes:
                slot.vibePreferredTypes ?? [],
              vibeRequiredAnyTypes:
                slot.vibeRequiredAnyTypes ?? [],
              vibeDiscouragedTypes:
                slot.vibeDiscouragedTypes ?? [],
            })) ?? [],
        },
        null,
        2
      )
    )

    /*
     * No archetype hard-filtering occurs here.
     *
     * Archetype compatibility is a weighted feature signal. It must not remove
     * a venue before tags, vibes, temporal compatibility, role fit, and route
     * coherence are evaluated together.
     */
    const generatedPlan = generateEventOutingPlan({
      mode,
      event,
      anchorVenue,
      candidateVenues: venueCandidates,
      groupSize,
      budget,
      mobility,
      vibeTags,
      timeZone,
      leaveEarlyByHours,
      cityPlanning,
    })

    const lateNightSingleStopFallbackApplied =
      qualifiesForLateNightSingleStopFallback(
        generatedPlan.stops,
        debugPlanningContext
      )

    const lateNightReducedFullFallbackApplied =
      qualifiesForLateNightReducedFullFallback(
        generatedPlan.stops,
        debugPlanningContext
      )

    const reducedBeforeSingleStopFallbackApplied =
      qualifiesForReducedBeforeSingleStopFallback(
        generatedPlan.stops,
        debugPlanningContext
      )

    const daytimeCultureReducedFullFallbackApplied =
      qualifiesForDaytimeCultureReducedFullFallback(
        generatedPlan.stops,
        debugPlanningContext
      )

    const socialSportsSingleStopFallbackApplied =
      qualifiesForSocialSportsSingleStopFallback(
        generatedPlan.stops,
        debugPlanningContext
      )

    const leaveEarlyCoverageSufficient =
      qualifiesForLeaveEarlyCoverage(
        generatedPlan.stops,
        mode,
        leaveEarlyByHours
      )

    const reducedFullCoverageSufficient =
      qualifiesForReducedFullCoverage(
        generatedPlan.stops,
        mode
      )

    const hasEmergencyStop =
      generatedPlan.stops.some(
        (stop) =>
          stop.metadata?.selectedPass === "emergency"
      )

    const plannerCoverageComplete =
      generatedPlan.scoreBreakdown.completionRate >= 1 &&
      generatedPlan.stops.length >= 1

    const minimumRequiredStops =
      plannerCoverageComplete ||
      hasEmergencyStop ||
      reducedFullCoverageSufficient ||
      daytimeCultureReducedFullFallbackApplied ||
      lateNightSingleStopFallbackApplied ||
      lateNightReducedFullFallbackApplied ||
      reducedBeforeSingleStopFallbackApplied ||
      socialSportsSingleStopFallbackApplied ||
      leaveEarlyCoverageSufficient
        ? Math.max(generatedPlan.stops.length, 1)
        : minimumStopsForMode(mode)

    const failedToGenerateStops =
      generatedPlan.scoreBreakdown.failedToGenerateStops ||
      generatedPlan.stops.length === 0

    console.log(
      "generated outing plan",
      JSON.stringify(
        {
          eventId,
          mode,
          city,
          timeZone,
          cityPlanning,
          requestedGroupSize: groupSize,
          requestedBudget: budget,
          requestedMobility: mobility,
          requestedVibePresets: vibeTags,
          requestedLeaveEarlyByHours: leaveEarlyByHours,
          derivedPlannedExitAt: plannedExitAt,
          generatedPlannedExitAt:
            generatedPlan.plannedExitAt ?? null,
          effectiveExitAt:
            generatedPlan.effectiveExitAt ??
            debugPlanningContext.effectiveExitAt
              ?.toISOString?.() ??
            null,
          fetchedCandidateVenueCount:
            normalizedVenueCandidates.length,
          eligibleCandidateVenueCount:
            venueCandidates.length,
          candidateCoverage,
          generatedStopCount:
            generatedPlan.stops.length,
          minimumRequiredStops,
          reducedFullCoverageSufficient,
          plannerCoverageComplete,
          hasEmergencyStop,
          failedToGenerateStops,
          lateNightSingleStopFallbackApplied,
          lateNightReducedFullFallbackApplied,
          reducedBeforeSingleStopFallbackApplied,
          socialSportsSingleStopFallbackApplied,
          leaveEarlyCoverageSufficient,
          daytimeCultureReducedFullFallbackApplied,
          eventArchetype:
            generatedPlan.eventArchetype,
          semanticRoles:
            generatedPlan.stops.map(
              (stop) =>
                stop.metadata?.semanticRole ?? null
            ),
          scoreBreakdown:
            generatedPlan.scoreBreakdown,
          debug:
            generatedPlan.debug ?? null,
        },
        null,
        2
      )
    )

    if (
      failedToGenerateStops ||
      generatedPlan.stops.length < minimumRequiredStops
    ) {
      const plannerFailureCode =
        resolvePlannerFailureCode({
          mode,
          startsAt:
            debugPlanningContext.startsAt,
          estimatedEndAt:
            debugPlanningContext.estimatedEndAt,
          effectiveExitAt:
            debugPlanningContext.effectiveExitAt ??
            null,
          timeZone,
          generatedStopCount:
            generatedPlan.stops.length,
          minimumRequiredStops,
          failedToGenerateStops,
        })

      const plannerSuggestedModes =
        getSuggestedModesForPlannerFailure({
          code: plannerFailureCode,
          mode,
        })

      const plannerErrorMessage =
        plannerFailureCode ===
        "late_night_low_coverage"
          ? "Late-night venue coverage is limited around this event. There may not be enough reliable options open after it ends."
          : "Insufficient venue coverage to generate a credible outing plan for this event"

      console.warn(
        "insufficient outing coverage",
        JSON.stringify(
          {
            eventId,
            mode,
            plannerFailureCode,
            suggestedModes:
              plannerSuggestedModes,
            minimumRequiredStops,
            failedToGenerateStops,
            lateNightSingleStopFallbackApplied,
            lateNightReducedFullFallbackApplied,
            reducedBeforeSingleStopFallbackApplied,
            socialSportsSingleStopFallbackApplied,
            leaveEarlyCoverageSufficient,
            reducedFullCoverageSufficient,
            leaveEarlyByHours,
            plannerCoverageComplete,
            hasEmergencyStop,
            plannedExitAt,
            generatedPlannedExitAt:
              generatedPlan.plannedExitAt ?? null,
            effectiveExitAt:
              generatedPlan.effectiveExitAt ??
              debugPlanningContext.effectiveExitAt
                ?.toISOString?.() ??
              null,
            generatedStopCount:
              generatedPlan.stops.length,
            fetchedCandidateVenueCount:
              normalizedVenueCandidates.length,
            eligibleCandidateVenueCount:
              venueCandidates.length,
            candidateCoverage,
            city,
            timeZone,
            cityPlanning,
            daytimeCultureReducedFullFallbackApplied,
            eventArchetype:
              generatedPlan.eventArchetype,
            semanticRoles:
              generatedPlan.stops.map(
                (stop) =>
                  stop.metadata?.semanticRole ??
                  null
              ),
            scoreBreakdown:
              generatedPlan.scoreBreakdown,
            debug:
              generatedPlan.debug ?? null,
          },
          null,
          2
        )
      )

      return NextResponse.json(
        {
          error: plannerErrorMessage,
          code: plannerFailureCode,
          suggestedModes:
            plannerSuggestedModes,
          debug:
            generatedPlan.debug ?? null,
          scoreBreakdown:
            generatedPlan.scoreBreakdown,
          candidateCoverage,
        },
        {
          status: 422,
        }
      )
    }

    const {
      plannedOuting,
      insertedStops,
    } = await persistGeneratedOutingPlan({
      supabase,
      userId: user.id,
      event,
      anchorVenue,
      city,
      mode,
      groupSize,
      budget,
      mobility,
      vibeTags,
      generatedPlan,
      leaveEarlyByHours,
      plannedExitAt:
        generatedPlan.plannedExitAt ??
        plannedExitAt,
    })

    await supabase
      .from("planned_outing_events")
      .insert({
        planned_outing_id:
          plannedOuting.id,
        user_id:
          user.id,
        event_type:
          "plan_generated",
        metadata: {
          mode,
          city,
          timeZone,
          cityPlanning,
          eventArchetype:
            generatedPlan.eventArchetype,
          semanticRoles:
            generatedPlan.stops.map(
              (stop) =>
                stop.metadata?.semanticRole ??
                null
            ),
          requestedVibePresets:
            vibeTags,
          leaveEarlyByHours,
          plannedExitAt:
            generatedPlan.plannedExitAt ??
            plannedExitAt,
          effectiveExitAt:
            generatedPlan.effectiveExitAt ??
            debugPlanningContext.effectiveExitAt
              ?.toISOString?.() ??
            null,
          stopCount:
            insertedStops.length,
          confidenceScore:
            generatedPlan.confidenceScore,
          completionRate:
            generatedPlan.scoreBreakdown
              .completionRate ?? null,
          candidatePoolSize:
            generatedPlan.scoreBreakdown
              .candidatePoolSize,
          preparedCandidateCount:
            generatedPlan.scoreBreakdown
              .preparedCandidateCount ?? null,
          intendedStopCount:
            generatedPlan.scoreBreakdown
              .intendedStopCount,
          effectiveIntendedStopCount:
            generatedPlan.scoreBreakdown
              .effectiveIntendedStopCount,
          failedToGenerateStops,
          reducedFullCoverageSufficient,
          hasEmergencyStop,
          minimumRequiredStops,
          lateNightSingleStopFallbackApplied,
          lateNightReducedFullFallbackApplied,
          reducedBeforeSingleStopFallbackApplied,
          socialSportsSingleStopFallbackApplied,
          leaveEarlyCoverageSufficient,
          daytimeCultureReducedFullFallbackApplied,
          candidateCoverage,
        },
      })

    const insertedStopIdsByOrder =
      new Map<number, string>(
        insertedStops.map((stop) => [
          stop.stop_order,
          stop.id,
        ])
      )

    const responseStops =
      generatedPlan.stops.map((stop) => ({
        id:
          insertedStopIdsByOrder.get(
            stop.stopOrder
          ) ??
          `${plannedOuting.id}:${stop.stopOrder}`,
        venueId:
          stop.venueId,
        stopOrder:
          stop.stopOrder,
        role:
          stop.role,
        phase:
          stop.phase ?? null,
        venueType:
          stop.venueType ??
          stop.metadata?.venueType ??
          null,
        displayType:
          stop.displayType ??
          stop.metadata?.displayType ??
          null,
        title:
          stop.title,
        rationale:
          stop.rationale,
        plannedArrivalAt:
          stop.plannedArrivalAt,
        plannedDepartureAt:
          stop.plannedDepartureAt,
        dwellMinutes:
          stop.dwellMinutes,
        travelMode:
          stop.travelMode,
        travelMinutesFromPrev:
          stop.travelMinutesFromPrev,
        distanceMetersFromPrev:
          stop.distanceMetersFromPrev,
        lat:
          stop.lat ?? null,
        lon:
          stop.lon ?? null,
        address:
          stop.address ?? null,
        bookingOptions:
          stop.bookingOptions ?? null,
        reservationRecommended:
          stop.reservationRecommended ?? false,
        recommendedReservationAt:
          stop.recommendedReservationAt ?? null,
        eventArchetype:
          stop.metadata?.eventArchetype ??
          generatedPlan.eventArchetype,
        semanticRole:
          stop.metadata?.semanticRole ?? null,
        slotPhase:
          stop.metadata?.slotPhase ??
          stop.phase ??
          null,
        slotIndex:
          stop.metadata?.slotIndex ??
          stop.stopOrder - 1,
        vibeMatchedTypes:
          stop.metadata?.vibeMatchedTypes ?? [],
        vibeScore:
          stop.metadata?.vibeScore ?? null,
        vibeConfidence:
          stop.metadata?.vibeConfidence ?? null,
      }))

    return NextResponse.json({
      success: true,
      plannedOutingId:
        plannedOuting.id,
      status:
        plannedOuting.status,
      mode,
      summary:
        plannedOuting.plan_summary,
      confidenceScore:
        plannedOuting.confidence_score,
      anchor: {
        eventId:
          event.id,
        title:
          event.title,
        startsAt:
          event.starts_at,
        endsAt:
          generatedPlan.estimatedEndAt,
        leaveEarlyByHours,
        plannedExitAt:
          generatedPlan.plannedExitAt ??
          plannedExitAt,
        effectiveExitAt:
          generatedPlan.effectiveExitAt ??
          debugPlanningContext.effectiveExitAt
            ?.toISOString?.() ??
          null,
        timeZone,
        cityPlanning,
        venue: {
          id:
            anchorVenue.id,
          name:
            anchorVenue.name,
          city:
            anchorVenue.city,
          address:
            anchorVenue.address,
          lat:
            anchorVenue.lat,
          lon:
            anchorVenue.lon,
        },
      },
      stops:
        responseStops,
      candidateCoverage,
      debug:
        generatedPlan.debug ?? undefined,
      scoreBreakdown:
        generatedPlan.scoreBreakdown,
    })
  } catch (error) {
    console.error(
      "plan-outing POST error:",
      error
    )

    return NextResponse.json(
      {
        error: "Failed to generate outing plan",
      },
      {
        status: 500,
      }
    )
  }
}

async function safeJson(
  req: Request
): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function normalizeMode(
  mode?: string | null
): PlanMode {
  return ALLOWED_MODES.includes(
    mode as PlanMode
  )
    ? (mode as PlanMode)
    : "full"
}

function normalizeBudget(
  budget?: string | null
): Budget | null {
  return ALLOWED_BUDGETS.includes(
    budget as Budget
  )
    ? (budget as Budget)
    : null
}

function normalizeMobility(
  mobility?: string | null
): Mobility {
  return ALLOWED_MOBILITY.includes(
    mobility as Mobility
  )
    ? (mobility as Mobility)
    : "short_ride"
}

function normalizeGroupSize(
  groupSize?: number | null
): number | null {
  if (!Number.isFinite(groupSize)) {
    return null
  }

  const normalized =
    Math.floor(Number(groupSize))

  if (normalized < 1) return 1
  if (normalized > 20) return 20

  return normalized
}

function normalizeVibeTags(
  vibeTags?: string[] | string | null
): string[] {
  const rawValues = Array.isArray(vibeTags)
    ? vibeTags
    : typeof vibeTags === "string"
      ? vibeTags.split(",")
      : []

  return Array.from(
    new Set(
      rawValues
        .map((tag) =>
          String(tag)
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_")
        )
        .filter(Boolean)
    )
  ).slice(0, 8)
}

function normalizeLeaveEarlyByHours(
  value?: number | null
): LeaveEarlyByHours | null {
  if (!Number.isFinite(value)) {
    return null
  }

  const hours = Math.floor(
    Number(value)
  ) as LeaveEarlyByHours

  return ALLOWED_LEAVE_EARLY_BY_HOURS.includes(
    hours
  )
    ? hours
    : null
}

function derivePlannedExitAtFromLeaveEarlyByHours(
  eventEndsAt?: string | null,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): string | null {
  if (!eventEndsAt || !leaveEarlyByHours) {
    return null
  }

  const parsedEndsAt =
    new Date(eventEndsAt)

  if (
    Number.isNaN(
      parsedEndsAt.getTime()
    )
  ) {
    return null
  }

  return new Date(
    parsedEndsAt.getTime() -
      leaveEarlyByHours *
        60 *
        60 *
        1000
  ).toISOString()
}

function hasMinimumSemanticPlanningData(
  venue: VenueRecord
): boolean {
  const types =
    normalizeFeatureValues(venue.type)

  const vibes =
    normalizeFeatureValues(venue.vibe)

  const tags =
    normalizeFeatureValues(venue.tags)

  return (
    types.length > 0 ||
    vibes.length > 0 ||
    tags.length > 0
  )
}

function buildCandidateCoverageSummary({
  fetchedCandidates,
  eligibleCandidates,
}: {
  fetchedCandidates: VenueRecord[]
  eligibleCandidates: VenueRecord[]
}): CandidateCoverageSummary {
  const fetchedIds = new Set(
    fetchedCandidates.map((venue) => venue.id)
  )

  const eligibleIds = new Set(
    eligibleCandidates.map((venue) => venue.id)
  )

  let rejectedMissingCoordinates = 0
  let rejectedMissingSemanticData = 0

  for (const venue of fetchedCandidates) {
    if (
      venue.lat == null ||
      venue.lon == null
    ) {
      rejectedMissingCoordinates += 1
      continue
    }

    if (
      !eligibleIds.has(venue.id) &&
      !hasMinimumSemanticPlanningData(venue)
    ) {
      rejectedMissingSemanticData += 1
    }
  }

  const featureProfiles =
    eligibleCandidates.map((venue) =>
      extractVenueFeatures(venue)
    )

  const withTypeData =
    featureProfiles.filter(
      (profile) => profile.hasTypeData
    ).length

  const withVibeData =
    featureProfiles.filter(
      (profile) => profile.hasVibeData
    ).length

  const withTagData =
    featureProfiles.filter(
      (profile) => profile.hasTagData
    ).length

  const withTimeCategoryData =
    featureProfiles.filter(
      (profile) =>
        profile.hasTimeCategoryData
    ).length

  const withEnergyRampData =
    featureProfiles.filter(
      (profile) =>
        profile.hasEnergyRampData
    ).length

  const highSemanticConfidence =
    featureProfiles.filter(
      (profile) =>
        profile.semanticDataCompleteness >= 0.8
    ).length

  const mediumSemanticConfidence =
    featureProfiles.filter(
      (profile) =>
        profile.semanticDataCompleteness >= 0.45 &&
        profile.semanticDataCompleteness < 0.8
    ).length

  const lowSemanticConfidence =
    featureProfiles.filter(
      (profile) =>
        profile.semanticDataCompleteness < 0.45
    ).length

  return {
    totalFetched:
      fetchedIds.size,
    totalEligible:
      eligibleIds.size,
    rejectedMissingCoordinates,
    rejectedMissingSemanticData,
    withTypeData,
    withVibeData,
    withTagData,
    withTimeCategoryData,
    withEnergyRampData,
    highSemanticConfidence,
    mediumSemanticConfidence,
    lowSemanticConfidence,
    averageSemanticCompleteness:
      average(
        featureProfiles.map(
          (profile) =>
            profile.semanticDataCompleteness
        )
      ),
    averageTemporalCompleteness:
      average(
        featureProfiles.map(
          (profile) =>
            profile.temporalDataCompleteness
        )
      ),
    averageFeatureConfidence:
      average(
        featureProfiles.map(
          (profile) =>
            profile.overallFeatureConfidence
        )
      ),
  }
}

function average(
  values: number[]
): number {
  if (values.length === 0) return 0

  const total = values.reduce(
    (sum, value) => sum + value,
    0
  )

  return Number(
    (total / values.length).toFixed(2)
  )
}

function qualifiesForLeaveEarlyCoverage(
  stops: Array<{
    phase?: "before" | "after" | null
  }>,
  mode: PlanMode,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): boolean {
  if (!leaveEarlyByHours) {
    return false
  }

  const afterStops = stops.filter(
    (stop) => stop.phase === "after"
  ).length

  const beforeStops = stops.filter(
    (stop) => stop.phase === "before"
  ).length

  if (mode === "after") {
    return afterStops >= 1
  }

  if (mode === "full") {
    return (
      beforeStops >= 1 &&
      afterStops >= 1
    )
  }

  return false
}

function qualifiesForReducedFullCoverage(
  stops: Array<{
    phase?: "before" | "after" | null
  }>,
  mode: PlanMode
): boolean {
  if (mode !== "full") {
    return false
  }

  const beforeStops = stops.filter(
    (stop) => stop.phase === "before"
  ).length

  const afterStops = stops.filter(
    (stop) => stop.phase === "after"
  ).length

  if (
    beforeStops >= 1 &&
    afterStops >= 1
  ) {
    return true
  }

  return beforeStops >= 1
}

function qualifiesForSocialSportsSingleStopFallback(
  stops: Array<{
    role?: string | null
    phase?: "before" | "after" | null
    metadata?: {
      selectedPass?: string | null
    } | null
  }>,
  context: {
    mode: PlanMode
    eventArchetype?: string | null
  }
): boolean {
  if (
    context.eventArchetype !==
    "social_sports"
  ) {
    return false
  }

  if (stops.length !== 1) {
    return false
  }

  const stop = stops[0]

  if (
    stop.metadata?.selectedPass ===
    "emergency"
  ) {
    return false
  }

  if (context.mode === "before") {
    return (
      stop.phase === "before" &&
      (
        stop.role === "food" ||
        stop.role === "drink"
      )
    )
  }

  if (context.mode === "after") {
    return (
      stop.phase === "after" &&
      (
        stop.role === "food" ||
        stop.role === "drink"
      )
    )
  }

  if (context.mode === "full") {
    return (
      (
        stop.phase === "before" ||
        stop.phase === "after"
      ) &&
      (
        stop.role === "food" ||
        stop.role === "drink" ||
        stop.role === "coffee"
      )
    )
  }

  return false
}

function normalizeVenueRelation(
  venue: EventWithVenueRecord["venue"]
): VenueRecordWithPlannerFields | null {
  if (!venue) return null

  return Array.isArray(venue)
    ? venue[0] ?? null
    : venue
}

function enrichVenueWithBookingOptions(
  venue: VenueRecordWithPlannerFields | null
): VenueRecord | null {
  if (!venue) return null

  const bookingRows =
    venue.venue_bookings ?? []

  const bookingOptions: VenueBookingOption[] =
    bookingRows
      .filter(
        (
          row
        ): row is {
          provider: string
          url: string
        } =>
          !!row &&
          typeof row.provider === "string" &&
          row.provider.trim().length > 0 &&
          typeof row.url === "string" &&
          row.url.trim().length > 0
      )
      .map((row) => ({
        provider:
          row.provider
            .trim()
            .toLowerCase(),
        url:
          row.url.trim(),
      }))

  const normalizedHours =
    normalizeVenueHours(venue.hours)

  return {
    id:
      venue.id,
    name:
      venue.name,
    slug:
      venue.slug ?? null,
    city:
      venue.city,
    lat:
      venue.lat,
    lon:
      venue.lon,
    address:
      venue.address,
    tags:
      normalizeFeatureValues(venue.tags),
    vibe:
      normalizeFeatureValues(venue.vibe),
    type:
      normalizeFeatureValues(venue.type),
    time_category:
      normalizeFeatureValues(
        venue.time_category
      ),
    energy_ramp:
      venue.energy_ramp ?? null,
    price:
      venue.price ?? null,
    hours:
      normalizedHours,
    bookingOptions:
      bookingOptions.length > 0
        ? bookingOptions
        : null,
  }
}

function normalizeVenueHours(
  value:
    | Record<
        string,
        {
          open?: string | null
          close?: string | null
        }
      >
    | string
    | null
    | undefined
): Record<
  string,
  {
    open?: string | null
    close?: string | null
  }
> | null {
  if (!value) return null

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value
  }

  if (typeof value !== "string") {
    return null
  }

  try {
    const parsed = JSON.parse(value)

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<
        string,
        {
          open?: string | null
          close?: string | null
        }
      >
    }
  } catch {
    return null
  }

  return null
}

function minimumStopsForMode(
  mode: PlanMode
): number {
  return mode === "full" ? 3 : 2
}

function resolvePlannerFailureCode({
  mode,
  startsAt,
  estimatedEndAt,
  effectiveExitAt,
  timeZone,
  generatedStopCount,
  minimumRequiredStops,
  failedToGenerateStops,
}: {
  mode: PlanMode
  startsAt?: Date | null
  estimatedEndAt?: Date | null
  effectiveExitAt?: Date | null
  timeZone: string
  generatedStopCount: number
  minimumRequiredStops: number
  failedToGenerateStops: boolean
}): PlannerFailureCode {
  if (
    mode !== "before" &&
    (
      failedToGenerateStops ||
      generatedStopCount <
        minimumRequiredStops
    ) &&
    isLateNightLowCoverageContext({
      startsAt,
      estimatedEndAt,
      effectiveExitAt,
      timeZone,
    })
  ) {
    return "late_night_low_coverage"
  }

  return "insufficient_venue_coverage"
}

function isLateNightLowCoverageContext({
  startsAt,
  estimatedEndAt,
  effectiveExitAt,
  timeZone,
}: {
  startsAt?: Date | null
  estimatedEndAt?: Date | null
  effectiveExitAt?: Date | null
  timeZone: string
}): boolean {
  const effectiveEndAt =
    effectiveExitAt ??
    estimatedEndAt ??
    null

  if (!startsAt || !effectiveEndAt) {
    return false
  }

  const startDay =
    getCalendarDayKey(
      startsAt,
      timeZone
    )

  const endDay =
    getCalendarDayKey(
      effectiveEndAt,
      timeZone
    )

  const endHour =
    getHourFractionInTimeZone(
      effectiveEndAt,
      timeZone
    )

  return (
    startDay !== endDay ||
    endHour < 4
  )
}

function getSuggestedModesForPlannerFailure({
  code,
  mode,
}: {
  code: PlannerFailureCode
  mode: PlanMode
}): PlanMode[] {
  if (
    code !== "late_night_low_coverage"
  ) {
    return []
  }

  if (mode === "after") {
    return ["before", "full"]
  }

  if (mode === "full") {
    return ["before"]
  }

  return []
}

function getCalendarDayKey(
  date: Date,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date)
}

function getHourFractionInTimeZone(
  date: Date,
  timeZone: string
): number {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).formatToParts(date)

  const hour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value ?? 0
  )

  const minute = Number(
    parts.find(
      (part) => part.type === "minute"
    )?.value ?? 0
  )

  return hour + minute / 60
}

function safeIsoString(
  value?: string | null
): string | null {
  if (!value) return null

  const date = new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return null
  }

  return date.toISOString()
}