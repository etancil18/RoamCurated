// app/api/generate-from-venue/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { CITY_CONFIGS } from '@/config/cities'
import { buildRouteContext } from '@/lib/routes/buildContext'
import { estimateArrivalTime } from '@/lib/routes/arrivalTime'
import {
  filterRouteCandidates,
  summarizeRejections,
} from '@/lib/routes/candidateFilter'
import { explainRoute } from '@/lib/routes/explainRoute'
import { scorePersonalization } from '@/lib/routes/personalization'
import { scoreVenue } from '@/lib/routes/scoreVenue'
import { normalizeVenueTypes } from '@/lib/routes/venueTypeNormalization'
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

const DEFAULT_MAX_STOPS = 5

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | GenerateRouteFromVenueRequest
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

    let venuesQuery = supabase.from('venues').select('*')

    if (city) {
      venuesQuery = venuesQuery.eq('city', city)
    }

    const { data: venuesData, error: venuesError } = await venuesQuery

    if (venuesError) {
      return errorResponse('Failed to load venues', 500)
    }

    const venues = ((venuesData ?? []) as VenueRow[]).filter(hasUsableCoordinates)

    const personalization = user
      ? await loadUserPersonalization({
          supabase,
          userId: user.id,
        })
      : null

    const context = buildRouteContext({
      anchorVenue,
      city,
      plannedStartAt: body.plannedStartAt ?? new Date().toISOString(),
      travelMode,
      tightness,
      maxStops,
      preferredVibes: body.preferredVibes ?? personalization?.preferredVibes ?? [],
      preferredTags: body.preferredTags ?? personalization?.interestCategories ?? [],
    })

    const selectedVenueIds = new Set<string>([anchorVenue.id])
    const selectedStops: RouteStop[] = []
    const stageAttempts: NonNullable<RouteGenerationDebug['stageAttempts']> = []

    let previousStop: VenueRow = anchorVenue
    let currentStartAt = context.plannedStartAt
    let totalDistanceMeters = 0
    let totalTravelMinutes = 0
    let totalDwellMinutes = 0
    let rejectedCount = 0
    let candidateCount = 0

    for (const stage of context.candidateStages) {
      if (selectedStops.length >= maxStops - 1) break

      const arrivalSeed = estimateArrivalTime({
        fromVenue: previousStop,
        toVenue: previousStop,
        startAt: currentStartAt,
        dwellMinutes: selectedStops.length === 0 ? 0 : stage.dwellMinutes,
        travelMode,
      })

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
          maxDistanceMeters: Math.round(context.maxDistanceMeters * 1.5),
        },
      ]

      let selected: any = null
      let selectedPass: string | null = null
      const passDebug: NonNullable<
        NonNullable<RouteGenerationDebug['stageAttempts']>[number]['passes']
      > = []

      for (const pass of passes) {
        const { candidates, rejected } = filterRouteCandidates({
          venues,
          anchorVenue,
          previousStop,
          stage,
          arrivalAt: arrivalSeed.arriveAt,
          selectedVenueIds,
          travelMode,
          maxDistanceMeters: pass.maxDistanceMeters,
          requireStageMatch: pass.requireStageMatch,
          excludeLikelyClosed: pass.excludeLikelyClosed,
          timezone,
        })

        rejectedCount += rejected.length
        candidateCount += candidates.length

        const scored = candidates
          .map((candidate) => {
            const arrivalEstimate = estimateArrivalTime({
              fromVenue: previousStop,
              toVenue: candidate,
              startAt: currentStartAt,
              dwellMinutes: selectedStops.length === 0 ? 0 : stage.dwellMinutes,
              travelMode,
            })

            const baseScore = scoreVenue({
              candidate,
              previousStop,
              anchorVenue,
              stage,
              arrivalAt: arrivalEstimate.arriveAt,
              travelMode,
              selectedVenueIds,
              previousRouteTypes: selectedStops.flatMap((stop) => stop.candidateTypes),
              preferredVibes: context.preferredVibes,
              preferredTags: context.preferredTags,
              maxDistanceMeters: pass.maxDistanceMeters,
              idealDistanceMeters: context.idealDistanceMeters,
              timezone,
            })

            const personalizationScore = scorePersonalization({
              venue: candidate,
              personalization,
            })

            return {
              candidate,
              arrivalEstimate,
              baseScore,
              finalScore: baseScore.score + personalizationScore.score,
              personalizationReasons: personalizationScore.reasons,
            }
          })
          .sort((a, b) => b.finalScore - a.finalScore)

        const top = scored[0] ?? null

        passDebug.push({
          pass: pass.label,
          candidateCount: candidates.length,
          rejectedCount: rejected.length,
          rejectionCounts: summarizeRejections(rejected),
          topScore: top?.finalScore ?? null,
          topVenueId: top?.candidate.id ?? null,
          topVenueName: top?.candidate.name ?? null,
        })

        if (top && top.finalScore >= 0) {
          selected = top
          selectedPass = pass.label
          break
        }
      }

      stageAttempts.push({
        stageId: stage.id,
        stageLabel: stage.label,
        candidateCount: passDebug.reduce((sum, pass) => sum + pass.candidateCount, 0),
        selectedVenueId: selected?.candidate.id ?? null,
        selectedVenueName: selected?.candidate.name ?? null,
        selectedPass,
        passes: passDebug,
      })

      if (!selected || selected.finalScore < 0) {
        continue
      }

      if (!selected.candidate.id) continue

      selectedVenueIds.add(selected.candidate.id)

      const selectedCandidate = selected.candidate as VenueRow

      const routeStop: RouteStop = {
        id: `${anchorVenue.id}-${selected.candidate.id}-${selectedStops.length + 1}`,
        stopOrder: selectedStops.length + 2,
        venue: normalizeRouteVenue(selectedCandidate),
        stageId: stage.id,
        stageLabel: stage.label,
        arriveAt: selected.arrivalEstimate.arriveAt.toISOString(),
        departAt: selected.arrivalEstimate.departAt.toISOString(),
        dwellMinutes: selected.arrivalEstimate.dwellMinutes,
        travelMinutesFromPrevious: selected.arrivalEstimate.travelMinutes,
        distanceMetersFromPrevious: selected.arrivalEstimate.distanceMeters,
        score: selected.finalScore,
        normalizedScore: selected.baseScore.normalizedScore,
        openConfidence: selected.baseScore.openConfidence,
        candidateTypes: selected.baseScore.candidateTypes,
        reasons: selected.baseScore.reasons,
        personalizationReasons: selected.personalizationReasons,
      }

      selectedStops.push(routeStop)

      totalDistanceMeters += selected.arrivalEstimate.distanceMeters ?? 0
      totalTravelMinutes += selected.arrivalEstimate.travelMinutes
      totalDwellMinutes += selected.arrivalEstimate.dwellMinutes

      previousStop = selectedCandidate
      currentStartAt = selected.arrivalEstimate.arriveAt
    }

    const anchorStop: RouteStop = {
      id: `${anchorVenue.id}-anchor`,
      stopOrder: 1,
      venue: normalizeRouteVenue(anchorVenue),
      stageId: context.startingStage.id,
      stageLabel: context.startingStage.label,
      arriveAt: context.plannedStartAt.toISOString(),
      departAt: context.plannedStartAt.toISOString(),
      dwellMinutes: context.startingStage.dwellMinutes,
      travelMinutesFromPrevious: null,
      distanceMetersFromPrevious: null,
      score: 100,
      normalizedScore: 100,
      openConfidence: 'unknown',
      candidateTypes: normalizeVenueTypes(anchorVenue),
      reasons: [],
      personalizationReasons: [],
    }

    const stops = [anchorStop, ...selectedStops]

    const explanation = explainRoute({
      anchorVenue,
      stops: selectedStops.map((stop) => ({
        venue: stop.venue,
        stage: context.candidateStages.find((stage) => stage.id === stop.stageId),
        arriveAt: stop.arriveAt,
        departAt: stop.departAt,
        dwellMinutes: stop.dwellMinutes,
        travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
        distanceMetersFromPrevious: stop.distanceMetersFromPrevious,
        score: stop.score,
        reasons: stop.reasons,
      })),
      startedAt: context.plannedStartAt,
      travelMode,
      city,
    })

    const route: GeneratedRoute = {
      status: selectedStops.length > 0 ? 'success' : 'failed',
      source: body.source ?? 'map_marker',
      context: {
        anchorVenueId: anchorVenue.id,
        anchorVenueName: anchorVenue.name,
        anchorTypes: context.anchorTypes,
        city,
        plannedStartAt: context.plannedStartAt.toISOString(),
        weekdayKey: context.weekdayKey,
        localHour: context.localHour,
        travelMode,
        tightness,
        maxStops,
        maxDistanceMeters: context.maxDistanceMeters,
        idealDistanceMeters: context.idealDistanceMeters,
        startingStageId: context.startingStage.id,
        candidateStageIds: context.candidateStages.map((stage) => stage.id),
        source: body.source ?? 'map_marker',
      },
      anchorVenue: normalizeRouteVenue(anchorVenue),
      stops,
      explanation,
      totalStops: stops.length,
      totalDistanceMeters,
      totalTravelMinutes,
      totalDwellMinutes,
      totalRouteMinutes: totalTravelMinutes + totalDwellMinutes,
      createdAt: new Date().toISOString(),
      debug: body.debug === false
        ? undefined
        : {
            rejectedCount,
            candidateCount,
            selectedCount: selectedStops.length,
            stageAttempts,
            warnings:
              selectedStops.length === 0
                ? ['No strong contextual stops were selected.']
                : [],
          },
    }

    return NextResponse.json({
      route,
      error: route.status === 'failed' ? 'No strong contextual route found' : null,
    } satisfies GenerateRouteFromVenueResponse)
  } catch (error) {
    console.error('generate-from-venue error:', error)
    return errorResponse('Failed to generate route from venue', 500)
  }
}

async function loadUserPersonalization({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  userId: string
}) {
  const [
    { data: profile },
    { data: savedProperties },
    { data: venueVisits },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('preferred_vibes, interest_categories, home_neighborhood')
      .eq('id', userId)
      .maybeSingle(),

    supabase
      .from('saved_properties')
      .select('property_id, slug, city')
      .eq('user_id', userId),

    supabase
      .from('venue_visits')
      .select('venue_id')
      .eq('user_id', userId),
  ])

  return {
    preferredVibes: profile?.preferred_vibes ?? [],
    interestCategories: profile?.interest_categories ?? [],
    homeCity: profile?.home_neighborhood ?? null,
    savedVenueIds:
      savedProperties?.map((item: any) => item.property_id).filter(Boolean) ?? [],
    savedVenueSlugs:
      savedProperties?.map((item: any) => item.slug).filter(Boolean) ?? [],
    visitedVenueIds:
      venueVisits?.map((item: any) => item.venue_id).filter(Boolean) ?? [],
  }
}

function normalizeRouteVenue(venue: VenueRow) {
  return {
    ...venue,
    id: venue.id,
    name: venue.name,
    slug: venue.slug ?? null,
    city: venue.city ?? null,
    address: venue.address ?? null,
    lat: venue.lat as number,
    lon: venue.lon as number,
    type: normalizeListLikeValue(venue.type),
    types: normalizeListLikeValue(venue.types),
    venue_type: normalizeListLikeValue(venue.venue_type),
    venue_types: normalizeListLikeValue(venue.venue_types),
    category: normalizeListLikeValue(venue.category),
    categories: normalizeListLikeValue(venue.categories),
    tags: normalizeListLikeValue(venue.tags),
    vibe: normalizeListLikeValue(venue.vibe),
    price: venue.price ?? null,
    hours: Array.isArray(venue.hours) ? venue.hours : venue.hours ?? null,
    dayParts: venue.dayParts ?? null,
    image_url: venue.image_url ?? null,
    link: venue.link ?? null,
  }
}

function normalizeListLikeValue(value: unknown): any {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (trimmed.includes(',')) {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean)
    }

    return trimmed
  }

  return value ?? null
}

function hasUsableCoordinates(venue: VenueRow | null | undefined): venue is VenueRow {
  return (
    Boolean(venue?.id) &&
    Boolean(venue?.name) &&
    typeof venue?.lat === 'number' &&
    Number.isFinite(venue.lat) &&
    Math.abs(venue.lat) <= 90 &&
    typeof venue?.lon === 'number' &&
    Number.isFinite(venue.lon) &&
    Math.abs(venue.lon) <= 180
  )
}

function sanitizeTravelMode(value: unknown): RouteTravelMode {
  return value === 'cycling' || value === 'driving' || value === 'walking'
    ? value
    : 'walking'
}

function sanitizeTightness(value: unknown): RouteTightness {
  return value === 'tight' || value === 'loose' || value === 'medium'
    ? value
    : 'medium'
}

function sanitizeMaxStops(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_STOPS
  }

  return Math.max(3, Math.min(8, Math.round(value)))
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      route: null,
      error: message,
    } satisfies GenerateRouteFromVenueResponse,
    { status }
  )
}