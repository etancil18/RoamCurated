// app/api/generate-from-venue/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { CITY_CONFIGS } from '@/config/cities'
import { buildRouteContext } from '@/lib/routes/buildContext'
import { getLocalHour } from '@/lib/routes/arrivalTime'
import {
  filterRouteCandidates,
  summarizeRejections,
  venueMatchesStage,
  isLikelyClosedAtArrival,
} from '@/lib/routes/candidateFilter'
import { explainRoute } from '@/lib/routes/explainRoute'
import { scorePersonalization } from '@/lib/routes/personalization'
import { scoreVenue } from '@/lib/routes/scoreVenue'
import {
  ROUTE_STAGES,
  isHourWithinStageWindow,
  type RouteStage,
} from '@/lib/routes/routeStages'
import { normalizeVenueTypes } from '@/lib/routes/venueTypeNormalization'

/* =========================================================
 * CONTEXTUAL FLOW INTELLIGENCE
 * ======================================================= */

import {
  resolveExperienceRole,
  evaluateExperienceSuitability,
} from '@/lib/routes/experienceRoles'

import {
  evaluateContextualConstraints,
  type ContextualExperienceVisit,
} from '@/lib/routes/contextualConstraints'

import {
  createAnchorTimelineStop,
  appendItineraryTimelineStop,
  summarizeItineraryTimeline,
  validateItineraryTimeline,
  type ItineraryTimelineStop,
} from '@/lib/routes/itineraryTimeline'

import type {
  GeneratedRoute,
  GenerateRouteFromVenueRequest,
  GenerateRouteFromVenueResponse,
  RouteGenerationDebug,
  RouteStop,
  RouteTravelMode,
  RouteTightness,
} from '@/types/route'

export const dynamic = 'force-dynamic'

type VenueRow = {
  id: string
  name: string
  slug?: string | null
  city?: string | null
  address?: string | null
  lat: number | null
  lon: number | null
  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown
  tags?: unknown
  vibe?: unknown
  price?: string | null
  hours?: unknown
  dayParts?: Record<string, string> | null
  image_url?: string | null
  link?: string | null
  is_active?: boolean | null
  active?: boolean | null
  permanently_closed?: boolean | null
  closed?: boolean | null
}

type GenerateRouteFromVenueRequestWithRetry =
  GenerateRouteFromVenueRequest & {
    retrySeed?: string | number | null
    retryAttempt?: number | null
  }

const DEFAULT_MAX_STOPS = 5

/* =========================================================
 * ROUTE QUALITY: Whole-route walking budget
 *
 * Preserve the existing configured distances.
 * These are straight-line estimates, not pedestrian
 * routing-network distances.
 *
 * Cycling and driving remain unchanged.
 * ======================================================= */

const WALKING_DISTANCE_BUDGET_METERS: Record<
  RouteTightness,
  number
> = {
  tight: .5 * 1609.344,
  medium: 1 * 1609.344,
  loose: 2.25 * 1609.344,
}

/* =========================================================
 * ROUTE QUALITY: Geographic progression
 *
 * Preserve the existing direction-change penalty.
 * ======================================================= */

function getDirectionChangePenalty({
  previousPreviousStop,
  previousStop,
  candidate,
}: {
  previousPreviousStop: VenueRow | null
  previousStop: VenueRow
  candidate: VenueRow
}): number {
  if (
    !previousPreviousStop ||
    !hasUsableCoordinates(previousPreviousStop) ||
    !hasUsableCoordinates(previousStop) ||
    !hasUsableCoordinates(candidate)
  ) {
    return 0
  }

  const latitudeRadians =
    (previousStop.lat! * Math.PI) / 180

  const longitudeScale =
    Math.cos(latitudeRadians)

  const firstX =
    (previousStop.lon! - previousPreviousStop.lon!) *
    longitudeScale

  const firstY =
    previousStop.lat! - previousPreviousStop.lat!

  const secondX =
    (candidate.lon! - previousStop.lon!) *
    longitudeScale

  const secondY =
    candidate.lat! - previousStop.lat!

  const firstLength =
    Math.hypot(firstX, firstY)

  const secondLength =
    Math.hypot(secondX, secondY)

  if (
    firstLength < 0.000001 ||
    secondLength < 0.000001
  ) {
    return 0
  }

  const cosine =
    Math.max(
      -1,
      Math.min(
        1,
        (
          firstX * secondX +
          firstY * secondY
        ) / (firstLength * secondLength)
      )
    )

  if (cosine <= -0.5) {
    return -42
  }

  if (cosine < 0) {
    return -18
  }

  return 0
}

/* =========================================================
 * ROUTE QUALITY: Display rhythm from selected venue types
 *
 * Preserve the existing explanation-stage fallback.
 * ======================================================= */

function getExplanationStage({
  venue,
  assignedStage,
  arriveAt,
  timezone,
}: {
  venue: VenueRow
  assignedStage: RouteStage | undefined
  arriveAt: string | null
  timezone: string | null
}): RouteStage | undefined {
  if (
    assignedStage &&
    venueMatchesStage(venue, assignedStage)
  ) {
    return assignedStage
  }

  if (!arriveAt) {
    return assignedStage
  }

  const localHour = getLocalHour(
    new Date(arriveAt),
    timezone
  )

  const matchingStages = ROUTE_STAGES.filter(
    (stage) =>
      venueMatchesStage(venue, stage) &&
      isHourWithinStageWindow(localHour, stage)
  )

  if (matchingStages.length === 0) {
    return assignedStage
  }

  if (!assignedStage) {
    return matchingStages[0]
  }

  return [...matchingStages].sort(
    (a, b) =>
      Math.abs(a.order - assignedStage.order) -
      Math.abs(b.order - assignedStage.order)
  )[0]
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | GenerateRouteFromVenueRequestWithRetry
      | null

    if (!body?.venueId && !body?.venueSlug && !body?.venueName) {
      return errorResponse('Missing venue identifier', 400)
    }

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const travelMode = sanitizeTravelMode(body.travelMode)
    const tightness = sanitizeTightness(body.tightness)
    const maxStops = sanitizeMaxStops(body.maxStops)
    const retryAttempt = sanitizeRetryAttempt(body.retryAttempt)
    const retrySeed =
      body.retrySeed ??
      `${body.venueId ?? body.venueSlug ?? body.venueName ?? 'venue'}:${body.plannedStartAt ?? 'now'}`

    let anchorQuery = supabase.from('venues').select('*')

    if (body.venueId) {
      anchorQuery = anchorQuery.eq('id', body.venueId)
    } else if (body.venueSlug) {
      anchorQuery = anchorQuery.eq('slug', body.venueSlug)
    } else if (body.venueName) {
      anchorQuery = anchorQuery.eq('name', body.venueName)
    }

    const { data: anchorVenue, error: anchorError } =
      await anchorQuery.maybeSingle<VenueRow>()

    if (anchorError || !anchorVenue) {
      return errorResponse('Starting venue not found', 404)
    }

    if (!hasUsableCoordinates(anchorVenue)) {
      return errorResponse('Starting venue is missing coordinates', 400)
    }

    const city = body.city ?? anchorVenue.city ?? null

    const timezone =
      city && CITY_CONFIGS[city]?.timezone
        ? CITY_CONFIGS[city].timezone
        : null

    // The map uses canonical city slugs (e.g. "la"),
    // while venue rows may store full city names
    // (e.g. "los angeles").
    const venueQueryCity =
      anchorVenue.city?.trim() || city

    let venuesQuery = supabase.from('venues').select('*')

    if (venueQueryCity) {
      venuesQuery = venuesQuery.eq('city', venueQueryCity)
    }

    const { data: venuesData, error: venuesError } =
      await venuesQuery

    if (venuesError) {
      return errorResponse('Failed to load venues', 500)
    }

    const venues = ((venuesData ?? []) as VenueRow[]).filter(
      hasUsableCoordinates
    )

    const personalization = user
      ? await loadUserPersonalization({
          supabase,
          userId: user.id,
        })
      : null

    const context = buildRouteContext({
      anchorVenue,
      timezone,
      city,
      plannedStartAt: body.plannedStartAt ?? new Date().toISOString(),
      travelMode,
      tightness,
      maxStops,
      preferredVibes:
        body.preferredVibes ??
        personalization?.preferredVibes ??
        [],
      preferredTags:
        body.preferredTags ??
        personalization?.interestCategories ??
        [],
    })

    /* =====================================================
     * CONTEXTUAL FLOW INTELLIGENCE:
     * Resolve the anchor's actual visit role.
     *
     * Do not confuse all available venue types with
     * what the guest is doing at this particular time.
     * =================================================== */

    const anchorExperience = resolveExperienceRole({
      venue: anchorVenue,
      arrivalAt: context.plannedStartAt,
      timezone,
      stage: context.startingStage,
    })

    /* =====================================================
     * CONTEXTUAL FLOW INTELLIGENCE:
     * Schedule the anchor before considering candidates.
     *
     * This fixes the old zero-dwell anchor and prevents
     * next-stop arrivals before the anchor visit ends.
     * =================================================== */

    const anchorTimelineStop =
      createAnchorTimelineStop({
        anchor: {
          venue: anchorVenue,
          role: anchorExperience,
        },
        plannedStartAt: context.plannedStartAt,
      })

    let previousTimelineStop: ItineraryTimelineStop =
      anchorTimelineStop

    const timelineStops: ItineraryTimelineStop[] = [
      anchorTimelineStop,
    ]

    /* =====================================================
     * CONTEXTUAL FLOW INTELLIGENCE:
     * Maintain the primary experience at every prior stop.
     *
     * The anchor must be included so the FIRST transition
     * is checked, including dinner-to-dinner.
     * =================================================== */

    const contextualVisits: ContextualExperienceVisit[] = [
      {
        venueId: anchorVenue.id,
        venue: anchorVenue,
        role: anchorExperience,
        arriveAt: anchorTimelineStop.arriveAt,
        departAt: anchorTimelineStop.departAt,
        dwellMinutes: anchorTimelineStop.dwellMinutes,
      },
    ]

    const selectedVenueIds = new Set<string>([anchorVenue.id])
    const selectedStops: RouteStop[] = []
    const stageAttempts: NonNullable<
      RouteGenerationDebug['stageAttempts']
    > = []

    let previousStop: VenueRow = anchorVenue

    let totalDistanceMeters = 0
    let totalTravelMinutes = 0

    // Include the anchor's real dwell duration.
    let totalDwellMinutes =
      anchorTimelineStop.dwellMinutes

    let rejectedCount = 0
    let candidateCount = 0

    /* =====================================================
     * ROUTE QUALITY: Track geographic direction and budget
     * =================================================== */

    let previousPreviousStop: VenueRow | null = null

    const walkingDistanceBudget =
      travelMode === 'walking'
        ? WALKING_DISTANCE_BUDGET_METERS[tightness]
        : null

    for (const stage of context.candidateStages) {
      if (selectedStops.length >= maxStops - 1) break

      /* ===================================================
       * ROUTE QUALITY: Stop expanding an exhausted route.
       * ================================================= */

      const remainingWalkingDistance =
        walkingDistanceBudget === null
          ? null
          : walkingDistanceBudget - totalDistanceMeters

      if (
        remainingWalkingDistance !== null &&
        remainingWalkingDistance <= 0
      ) {
        break
      }

      /* ===================================================
       * CONTEXTUAL FLOW INTELLIGENCE:
       * The next available travel period starts when the
       * previous venue visit actually ends.
       *
       * The exact next arrival depends on each candidate's
       * distance and is calculated separately below.
       * ================================================= */

      const previousDepartureAt =
        new Date(previousTimelineStop.departAt)

      const passes = [
        {
          label: 'strict',
          requireStageMatch: true,
          excludeLikelyClosed: true,
          maxDistanceMeters: context.maxDistanceMeters,
        },
        {
          label: 'relaxed_stage',
          requireStageMatch: false,
          excludeLikelyClosed: true,
          maxDistanceMeters: context.maxDistanceMeters,
        },
        {
          label: 'wider_fallback',
          requireStageMatch: false,
          excludeLikelyClosed: true,
          maxDistanceMeters: Math.round(
            context.maxDistanceMeters * 1.5
          ),
        },
      ]

      let selected: any = null
      let selectedPass: string | null = null

      const passDebug: NonNullable<
        NonNullable<
          RouteGenerationDebug['stageAttempts']
        >[number]['passes']
      > = []

      for (const pass of passes) {
        /* =================================================
         * ROUTE QUALITY: Enforce remaining walking budget
         * at the existing candidate-filter boundary.
         * =============================================== */

        const effectiveMaxDistanceMeters =
          remainingWalkingDistance === null
            ? pass.maxDistanceMeters
            : Math.min(
                pass.maxDistanceMeters,
                remainingWalkingDistance
              )

        /* =================================================
         * CONTEXTUAL FLOW INTELLIGENCE:
         *
         * Preserve all existing candidate eligibility
         * checks except premature opening-hours exclusion.
         *
         * Opening hours are checked below using each
         * candidate's projected arrival, not an estimated
         * arrival at the previous venue.
         * =============================================== */

        const { candidates, rejected } =
          filterRouteCandidates({
            venues,
            anchorVenue,
            previousStop,
            stage,
            arrivalAt: previousDepartureAt,
            selectedVenueIds,
            travelMode,
            maxDistanceMeters:
              effectiveMaxDistanceMeters,
            requireStageMatch:
              pass.requireStageMatch,
            excludeLikelyClosed: false,
            timezone,
          })

        rejectedCount += rejected.length
        candidateCount += candidates.length

        let contextualRejectedCount = 0
        let closedAtArrivalCount = 0

        /* =================================================
         * CONTEXTUAL FLOW INTELLIGENCE:
         * Build and evaluate complete candidate visits.
         *
         * flatMap allows ineligible candidates to be
         * excluded BEFORE any winner is selected.
         * =============================================== */

        const scored = candidates
          .flatMap((candidate) => {
            const candidateVenue =
              candidate as VenueRow

            /* =============================================
             * Compute expected arrival from the previous
             * venue's actual departure.
             *
             * The initial role is used to assign a duration.
             * Arrival itself does not depend on that duration.
             * =========================================== */

            const initialExperience =
              resolveExperienceRole({
                venue: candidateVenue,
                arrivalAt: previousDepartureAt,
                timezone,
                stage,
              })

            const initialTimelineStop =
              appendItineraryTimelineStop({
                previousStop: previousTimelineStop,
                nextVisit: {
                  venue: candidateVenue,
                  role: initialExperience,
                },
                travelMode,
                missingCoordinatesPolicy: 'reject',
              })

            /* =============================================
             * Resolve the visit role at ACTUAL arrival time.
             *
             * This matters for mixed-use places serving
             * different experiences across the day.
             * =========================================== */

            const candidateExperience =
              resolveExperienceRole({
                venue: candidateVenue,
                arrivalAt:
                  initialTimelineStop.arriveAt,
                timezone,
                stage,
              })

            const candidateTimelineStop =
              appendItineraryTimelineStop({
                previousStop: previousTimelineStop,
                nextVisit: {
                  venue: candidateVenue,
                  role: candidateExperience,
                },
                travelMode,
                missingCoordinatesPolicy: 'reject',
              })

            const candidateArrivalAt =
              new Date(candidateTimelineStop.arriveAt)

            /* =============================================
             * Check the venue's opening hours at its
             * actual anticipated arrival time.
             *
             * Existing strict missing-hours behavior
             * remains unchanged.
             * =========================================== */

            if (
              pass.excludeLikelyClosed &&
              isLikelyClosedAtArrival(
                candidateVenue,
                candidateArrivalAt,
                timezone
              )
            ) {
              closedAtArrivalCount += 1
              return []
            }

            /* =============================================
             * Prevent invalid experiential sequences.
             *
             * Includes:
             * - Duplicate substantial meals
             * - Insufficient spacing between meals
             * - Consecutive coffee experiences
             * - Invalid chronology
             * - Repeated venues
             *
             * Standard Flow policy is used deliberately.
             * No food-crawl behavior is inferred.
             * =========================================== */

            const contextualDecision =
              evaluateContextualConstraints({
                previousVisits: contextualVisits,
                candidate: {
                  venueId: candidateVenue.id,
                  venue: candidateVenue,
                  role: candidateExperience,
                  arriveAt:
                    candidateTimelineStop.arriveAt,
                  departAt:
                    candidateTimelineStop.departAt,
                  dwellMinutes:
                    candidateTimelineStop.dwellMinutes,
                },
                flowIntent: 'standard',
              })

            if (!contextualDecision.eligible) {
              contextualRejectedCount += 1
              return []
            }

            /* =============================================
             * Preserve the existing venue scoring system.
             *
             * Use the actual candidate arrival timestamp.
             * =========================================== */

            const baseScore = scoreVenue({
              candidate,
              previousStop,
              anchorVenue,
              stage,
              arrivalAt: candidateArrivalAt,
              travelMode,
              selectedVenueIds,
              previousRouteTypes:
                selectedStops.flatMap(
                  (stop) =>
                    stop.candidateTypes
                ),
              preferredVibes:
                context.preferredVibes,
              preferredTags:
                context.preferredTags,
              maxDistanceMeters:
                pass.maxDistanceMeters,
              idealDistanceMeters:
                context.idealDistanceMeters,
              timezone,
              retrySeed,
              retryAttempt,
            })

            const personalizationScore =
              scorePersonalization({
                venue: candidate,
                personalization,
              })

            /* =================================================
              * CONTEXTUAL FLOW INTELLIGENCE:
              * Prefer venues whose primary format genuinely
              * suits the assigned experience role.
              *
              * Example:
              * A dedicated cocktail destination should generally
              * outrank a restaurant that merely serves cocktails,
              * assuming other scoring factors are comparable.
              * ================================================= */

              const experienceSuitability =
                evaluateExperienceSuitability({
                  venue: candidateVenue,
                  role: candidateExperience,
                })

            /* =============================================
             * Preserve geographic direction scoring.
             * =========================================== */

            const directionPenalty =
              travelMode === 'walking'
                ? getDirectionChangePenalty({
                    previousPreviousStop,
                    previousStop,
                    candidate: candidateVenue,
                  })
                : 0

            /* =============================================
             * Add contextual preference adjustments.
             *
             * This rewards natural experiential contrast
             * without replacing existing scores.
             * =========================================== */

            return [
              {
                candidate,
                candidateExperience,
                candidateTimelineStop,
                baseScore,
                finalScore:
                  baseScore.score +
                  personalizationScore.score +
                  directionPenalty +
                  contextualDecision.scoreAdjustment +
                  experienceSuitability.scoreAdjustment,
                personalizationReasons:
                  personalizationScore.reasons,
              },
            ]
          })
          .sort(
            (a, b) =>
              b.finalScore -
              a.finalScore
          )

        const top = scored[0] ?? null

        passDebug.push({
          pass: pass.label,
          candidateCount:
            candidates.length,
          rejectedCount:
            rejected.length +
            contextualRejectedCount +
            closedAtArrivalCount,
          rejectionCounts: {
            ...summarizeRejections(rejected),
            likely_closed:
              (summarizeRejections(rejected).likely_closed ?? 0) +
              closedAtArrivalCount,
          },
          topScore:
            top?.finalScore ??
            null,
          topVenueId:
            top?.candidate.id ??
            null,
          topVenueName:
            top?.candidate.name ??
            null,
        })

        rejectedCount +=
          contextualRejectedCount +
          closedAtArrivalCount

        if (
          top &&
          top.finalScore >= 0
        ) {
          selected = top
          selectedPass =
            pass.label
          break
        }
      }

      stageAttempts.push({
        stageId: stage.id,
        stageLabel: stage.label,
        candidateCount:
          passDebug.reduce(
            (sum, pass) =>
              sum +
              pass.candidateCount,
            0
          ),
        selectedVenueId:
          selected?.candidate.id ??
          null,
        selectedVenueName:
          selected?.candidate.name ??
          null,
        selectedPass,
        passes: passDebug,
      })

      if (
        !selected ||
        selected.finalScore < 0
      ) {
        continue
      }

      if (!selected.candidate.id) {
        continue
      }

      /* ===================================================
       * ROUTE QUALITY: Keep the actual selected leg within
       * the whole-route walking budget.
       * ================================================= */

      if (
        walkingDistanceBudget !== null &&
        totalDistanceMeters +
          (
            selected.candidateTimelineStop
              .distanceMetersFromPrevious ?? 0
          ) >
          walkingDistanceBudget
      ) {
        continue
      }

      selectedVenueIds.add(
        selected.candidate.id
      )

      const selectedCandidate =
        selected.candidate as VenueRow

      /* ===================================================
       * CONTEXTUAL FLOW INTELLIGENCE:
       * The selected timeline belongs to THIS venue.
       *
       * Its arrival, departure and dwell times are now
       * chronologically consistent.
       * ================================================= */

      const selectedTimelineStop =
        selected.candidateTimelineStop as ItineraryTimelineStop

      const routeStop: RouteStop = {
        id: `${anchorVenue.id}-${selected.candidate.id}-${selectedStops.length + 1}`,
        stopOrder:
          selectedStops.length + 2,
        venue:
          normalizeRouteVenue(
            selectedCandidate
          ),
        stageId: stage.id,
        stageLabel: stage.label,
        arriveAt:
          selectedTimelineStop.arriveAt,
        departAt:
          selectedTimelineStop.departAt,
        dwellMinutes:
          selectedTimelineStop.dwellMinutes,
        travelMinutesFromPrevious:
          selectedTimelineStop.travelMinutesFromPrevious,
        distanceMetersFromPrevious:
          selectedTimelineStop.distanceMetersFromPrevious,
        score:
          selected.finalScore,
        normalizedScore:
          selected.baseScore.normalizedScore,
        openConfidence:
          selected.baseScore.openConfidence,
        candidateTypes:
          selected.baseScore.candidateTypes,
        reasons:
          selected.baseScore.reasons,
        personalizationReasons:
          selected.personalizationReasons,
      }

      selectedStops.push(
        routeStop
      )

      /* ===================================================
       * CONTEXTUAL FLOW INTELLIGENCE:
       * Record the selected experience for future stops.
       * ================================================= */

      contextualVisits.push({
        venueId: selectedCandidate.id,
        venue: selectedCandidate,
        role: selected.candidateExperience,
        arriveAt:
          selectedTimelineStop.arriveAt,
        departAt:
          selectedTimelineStop.departAt,
        dwellMinutes:
          selectedTimelineStop.dwellMinutes,
      })

      timelineStops.push(
        selectedTimelineStop
      )

      previousTimelineStop =
        selectedTimelineStop

      totalDistanceMeters +=
        selectedTimelineStop
          .distanceMetersFromPrevious ?? 0

      totalTravelMinutes +=
        selectedTimelineStop
          .travelMinutesFromPrevious ?? 0

      totalDwellMinutes +=
        selectedTimelineStop.dwellMinutes

      /* ===================================================
       * ROUTE QUALITY: Retain the last two locations for
       * geographic progression scoring on the next leg.
       * ================================================= */

      previousPreviousStop = previousStop

      previousStop =
        selectedCandidate
    }

    /* =====================================================
     * CONTEXTUAL FLOW INTELLIGENCE:
     * The anchor now uses its real scheduled timeline.
     * =================================================== */

    const anchorStop: RouteStop = {
      id: `${anchorVenue.id}-anchor`,
      stopOrder: 1,
      venue:
        normalizeRouteVenue(
          anchorVenue
        ),
      stageId:
        context.startingStage.id,
      stageLabel:
        context.startingStage.label,
      arriveAt:
        anchorTimelineStop.arriveAt,
      departAt:
        anchorTimelineStop.departAt,
      dwellMinutes:
        anchorTimelineStop.dwellMinutes,
      travelMinutesFromPrevious:
        null,
      distanceMetersFromPrevious:
        null,
      score: 100,
      normalizedScore: 100,
      openConfidence:
        'unknown',
      candidateTypes:
        normalizeVenueTypes(
          anchorVenue
        ),
      reasons: [],
      personalizationReasons: [],
    }

    const stops = [
      anchorStop,
      ...selectedStops,
    ]

    /* =====================================================
     * CONTEXTUAL FLOW INTELLIGENCE:
     * Validate itinerary chronology before responding.
     * =================================================== */

    const timelineValidation =
      validateItineraryTimeline(
        timelineStops
      )

    if (!timelineValidation.valid) {
      console.error(
        '[generate-from-venue] Invalid itinerary timeline:',
        timelineValidation.issues
      )

      return errorResponse(
        'Generated route has an invalid itinerary timeline',
        500
      )
    }

    /* =====================================================
     * CONTEXTUAL FLOW INTELLIGENCE:
     * Calculate route totals from the actual visit schedule.
     *
     * This includes the starting venue's dwell time.
     * =================================================== */

    const timelineTotals =
      summarizeItineraryTimeline(
        timelineStops
      )

    const explanation = explainRoute({
      anchorVenue,
      stops: selectedStops.map(
        (stop) => {
          const assignedStage =
            context.candidateStages.find(
              (stage) =>
                stage.id === stop.stageId
            )

          /* ===============================================
           * ROUTE QUALITY: Explain the venue actually
           * chosen, particularly after relaxed matching.
           * ============================================= */

          const explanationStage =
            getExplanationStage({
              venue: stop.venue as VenueRow,
              assignedStage,
              arriveAt: stop.arriveAt,
              timezone,
            })

          return {
            venue: stop.venue,
            stage: explanationStage,
            arriveAt:
              stop.arriveAt,
            departAt:
              stop.departAt,
            dwellMinutes:
              stop.dwellMinutes,
            travelMinutesFromPrevious:
              stop.travelMinutesFromPrevious,
            distanceMetersFromPrevious:
              stop.distanceMetersFromPrevious,
            score:
              stop.score,
            reasons:
              stop.reasons,
          }
        }
      ),
      startedAt:
        context.plannedStartAt,
      travelMode,
      city,
    })

    const route: GeneratedRoute = {
      status:
        selectedStops.length > 0
          ? 'success'
          : 'failed',
      source:
        body.source ??
        'map_marker',
      context: {
        anchorVenueId:
          anchorVenue.id,
        anchorVenueName:
          anchorVenue.name,
        anchorTypes:
          context.anchorTypes,
        city,
        plannedStartAt:
          context.plannedStartAt.toISOString(),
        weekdayKey:
          context.weekdayKey,
        localHour:
          context.localHour,
        travelMode,
        tightness,
        maxStops,
        maxDistanceMeters:
          context.maxDistanceMeters,
        idealDistanceMeters:
          context.idealDistanceMeters,
        startingStageId:
          context.startingStage.id,
        candidateStageIds:
          context.candidateStages.map(
            (stage) =>
              stage.id
          ),
        source:
          body.source ??
          'map_marker',
      },
      anchorVenue:
        normalizeRouteVenue(
          anchorVenue
        ),
      stops,
      explanation,
      totalStops:
        stops.length,

      /* =================================================
       * CONTEXTUAL FLOW INTELLIGENCE:
       * Use internally consistent itinerary aggregates.
       * =============================================== */

      totalDistanceMeters:
        timelineTotals.totalDistanceMeters,
      totalTravelMinutes:
        timelineTotals.totalTravelMinutes,
      totalDwellMinutes:
        timelineTotals.totalDwellMinutes,
      totalRouteMinutes:
        timelineTotals.totalRouteMinutes,

      createdAt:
        new Date().toISOString(),
      debug:
        body.debug === false
          ? undefined
          : {
              rejectedCount,
              candidateCount,
              selectedCount:
                selectedStops.length,
              stageAttempts,
              warnings:
                selectedStops.length ===
                0
                  ? [
                      'No strong contextual stops were selected.',
                    ]
                  : [],
            },
    }

    return NextResponse.json({
      route,
      error:
        route.status ===
        'failed'
          ? 'No strong contextual route found'
          : null,
    } satisfies GenerateRouteFromVenueResponse)
  } catch (error) {
    console.error(
      'generate-from-venue error:',
      error
    )

    return errorResponse(
      'Failed to generate route from venue',
      500
    )
  }
}

async function loadUserPersonalization({
  supabase,
  userId,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  userId: string
}) {
  const [
    { data: profile },
    { data: savedProperties },
    { data: venueVisits },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'preferred_vibes, interest_categories, home_neighborhood'
      )
      .eq('id', userId)
      .maybeSingle(),

    supabase
      .from(
        'saved_properties'
      )
      .select(
        'property_id, slug, city'
      )
      .eq(
        'user_id',
        userId
      ),

    supabase
      .from(
        'venue_visits'
      )
      .select(
        'venue_id'
      )
      .eq(
        'user_id',
        userId
      ),
  ])

  return {
    preferredVibes:
      profile?.preferred_vibes ??
      [],

    interestCategories:
      profile?.interest_categories ??
      [],

    homeCity:
      profile?.home_neighborhood ??
      null,

    savedVenueIds:
      savedProperties
        ?.map(
          (item: any) =>
            item.property_id
        )
        .filter(
          Boolean
        ) ?? [],

    savedVenueSlugs:
      savedProperties
        ?.map(
          (item: any) =>
            item.slug
        )
        .filter(
          Boolean
        ) ?? [],

    /*
     * venue_visits is append-only historical activity.
     *
     * Personalization needs the set of venues the user has
     * visited, not one entry for every historical visit event.
     */
    visitedVenueIds: [
      ...new Set(
        venueVisits
          ?.map(
            (item: any) =>
              item.venue_id
          )
          .filter(
            Boolean
          ) ?? []
      ),
    ],
  }
}

function normalizeRouteVenue(
  venue: VenueRow
) {
  return {
    ...venue,
    id: venue.id,
    name: venue.name,
    slug:
      venue.slug ??
      null,
    city:
      venue.city ??
      null,
    address:
      venue.address ??
      null,
    lat:
      venue.lat as number,
    lon:
      venue.lon as number,
    type:
      normalizeListLikeValue(
        venue.type
      ),
    types:
      normalizeListLikeValue(
        venue.types
      ),
    venue_type:
      normalizeListLikeValue(
        venue.venue_type
      ),
    venue_types:
      normalizeListLikeValue(
        venue.venue_types
      ),
    category:
      normalizeListLikeValue(
        venue.category
      ),
    categories:
      normalizeListLikeValue(
        venue.categories
      ),
    tags:
      normalizeListLikeValue(
        venue.tags
      ),
    vibe:
      normalizeListLikeValue(
        venue.vibe
      ),
    price:
      venue.price ??
      null,
    hours:
      Array.isArray(
        venue.hours
      )
        ? venue.hours
        : venue.hours ??
          null,
    dayParts:
      venue.dayParts ??
      null,
    image_url:
      venue.image_url ??
      null,
    link:
      venue.link ??
      null,
  }
}

function normalizeListLikeValue(
  value: unknown
): any {
  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        (item) =>
          String(
            item
          ).trim()
      )
      .filter(
        Boolean
      )
  }

  if (
    typeof value ===
    'string'
  ) {
    const trimmed =
      value.trim()

    if (!trimmed) {
      return null
    }

    if (
      trimmed.includes(
        ','
      )
    ) {
      return trimmed
        .split(',')
        .map(
          (item) =>
            item.trim()
        )
        .filter(
          Boolean
        )
    }

    return trimmed
  }

  return value ?? null
}

function hasUsableCoordinates(
  venue:
    | VenueRow
    | null
    | undefined
): venue is VenueRow {
  return (
    Boolean(
      venue?.id
    ) &&
    Boolean(
      venue?.name
    ) &&
    typeof venue?.lat ===
      'number' &&
    Number.isFinite(
      venue.lat
    ) &&
    Math.abs(
      venue.lat
    ) <= 90 &&
    typeof venue?.lon ===
      'number' &&
    Number.isFinite(
      venue.lon
    ) &&
    Math.abs(
      venue.lon
    ) <= 180
  )
}

function sanitizeTravelMode(
  value: unknown
): RouteTravelMode {
  return value ===
    'cycling' ||
    value ===
      'driving' ||
    value ===
      'walking'
    ? value
    : 'walking'
}

function sanitizeTightness(
  value: unknown
): RouteTightness {
  return value ===
    'tight' ||
    value ===
      'loose' ||
    value ===
      'medium'
    ? value
    : 'medium'
}

function sanitizeMaxStops(
  value: unknown
) {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return DEFAULT_MAX_STOPS
  }

  return Math.max(
    3,
    Math.min(
      8,
      Math.round(
        value
      )
    )
  )
}

function sanitizeRetryAttempt(
  value: unknown
) {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.min(
      50,
      Math.round(
        value
      )
    )
  )
}

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      route: null,
      error: message,
    } satisfies GenerateRouteFromVenueResponse,
    { status }
  )
}
