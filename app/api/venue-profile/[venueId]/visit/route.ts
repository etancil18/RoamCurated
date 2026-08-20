import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'

import { getRoamDay } from '@/lib/roam/roamDay'

import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    venueId: string
  }>
}

type VenueVisitBody = {
  rating?: unknown
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number | null
  device_timestamp?: string
}

type CompetitionFlowBridgeRow = {
  competition_id: string
  competition_entry_id: string
  flow_session_id: string
  user_id: string
}

type CompetitionParticipationProgressRow = {
  id: string
  verified_stop_count: number
  total_stop_count: number
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250

function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  )
}

function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  )
}

function isSameRoamDay(
  firstValue: string,
  secondValue: string,
  city: string
): boolean {
  const firstRoamDay = getRoamDay(
    firstValue,
    city
  )

  const secondRoamDay = getRoamDay(
    secondValue,
    city
  )

  return (
    firstRoamDay !== null &&
    secondRoamDay !== null &&
    firstRoamDay === secondRoamDay
  )
}

function calculateDistanceMeters({
  fromLat,
  fromLon,
  toLat,
  toLon,
}: {
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}) {
  const earthRadiusMeters = 6371000

  const fromLatRad = degreesToRadians(fromLat)
  const toLatRad = degreesToRadians(toLat)
  const deltaLatRad = degreesToRadians(toLat - fromLat)
  const deltaLonRad = degreesToRadians(toLon - fromLon)

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2)

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

  return earthRadiusMeters * c
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

async function refreshPublicPassportStats(
  userId: string,
  mutation: string
): Promise<void> {
  try {
    await rebuildPublicPassportStats(userId)
  } catch (error) {
    console.error(
      `[venue visit][${mutation}] Failed to rebuild public Passport stats:`,
      error
    )
  }
}

/**
 * Legacy Active Flow competition reconciliation.
 *
 * This runs only from the historical Active Flow repair path below,
 * after the canonical venue_visits event has either already been
 * found or has just been repaired.
 *
 * No venue_visits rows are created here.
 *
 * active_flow_progress remains the canonical raw competition
 * evidence. competition_participations stores only the aggregate
 * verified-stop count.
 *
 * Failure here is intentionally non-fatal to the already-successful
 * venue-history repair/rating mutation.
 */
async function repairCompetitionParticipationFromActiveFlow({
  sessionId,
  userId,
}: {
  sessionId: string
  userId: string
}): Promise<void> {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        '[venue visit][PATCH] Competition participation repair unavailable: missing Supabase service-role configuration.'
      )

      return
    }

    const serviceSupabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

    const {
      data: bridge,
      error: bridgeError,
    } = await serviceSupabase
      .from(
        'competition_flow_sessions'
      )
      .select(`
        competition_id,
        competition_entry_id,
        flow_session_id,
        user_id
      `)
      .eq(
        'flow_session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle<CompetitionFlowBridgeRow>()

    if (bridgeError) {
      console.error(
        '[venue visit][PATCH] Competition Flow bridge repair lookup failed:',
        {
          sessionId,
          userId,
          error: bridgeError,
        }
      )

      return
    }

    if (!bridge) {
      return
    }

    const {
      data: flowSession,
      error: flowSessionError,
    } = await serviceSupabase
      .from(
        'active_flow_sessions'
      )
      .select(
        'venue_ids'
      )
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle()

    if (flowSessionError) {
      console.error(
        '[venue visit][PATCH] Competition Active Flow route repair lookup failed:',
        {
          sessionId,
          userId,
          error: flowSessionError,
        }
      )

      return
    }

    if (
      !flowSession ||
      !Array.isArray(
        flowSession.venue_ids
      )
    ) {
      console.error(
        '[venue visit][PATCH] Competition Active Flow route is missing during participation repair:',
        {
          sessionId,
          userId,
        }
      )

      return
    }

    const canonicalRouteVenueIds =
      new Set(
        flowSession.venue_ids.filter(
          (
            routeVenueId
          ): routeVenueId is string =>
            typeof routeVenueId ===
              'string' &&
            routeVenueId.length >
              0
        )
      )

    const {
      data: participation,
      error: participationError,
    } = await serviceSupabase
      .from(
        'competition_participations'
      )
      .select(`
        id,
        verified_stop_count,
        total_stop_count
      `)
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .eq(
        'competition_entry_id',
        bridge.competition_entry_id
      )
      .eq(
        'flow_session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle<CompetitionParticipationProgressRow>()

    if (participationError) {
      console.error(
        '[venue visit][PATCH] Competition participation repair lookup failed:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          error:
            participationError,
        }
      )

      return
    }

    if (!participation) {
      console.error(
        '[venue visit][PATCH] Competition Flow bridge exists without linked participation during repair:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
        }
      )

      return
    }

    const {
      data: verifiedProgressRows,
      error: verifiedProgressError,
    } = await serviceSupabase
      .from(
        'active_flow_progress'
      )
      .select(
        'venue_id'
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'geo_verified',
        true
      )

    if (verifiedProgressError) {
      console.error(
        '[venue visit][PATCH] Competition verified progress repair lookup failed:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          error:
            verifiedProgressError,
        }
      )

      return
    }

    const verifiedVenueIds =
      new Set(
        (
          verifiedProgressRows ??
          []
        )
          .map(
            (
              row
            ) =>
              row.venue_id
          )
          .filter(
            (
              progressVenueId
            ): progressVenueId is string =>
              typeof progressVenueId ===
                'string' &&
              canonicalRouteVenueIds.has(
                progressVenueId
              )
          )
      )

    const canonicalVerifiedStopCount =
      Math.min(
        verifiedVenueIds.size,
        participation.total_stop_count
      )

    if (
      canonicalVerifiedStopCount <=
      participation.verified_stop_count
    ) {
      return
    }

    const {
      error: updateError,
    } = await serviceSupabase
      .from(
        'competition_participations'
      )
      .update({
        verified_stop_count:
          canonicalVerifiedStopCount,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        participation.id
      )
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .eq(
        'competition_entry_id',
        bridge.competition_entry_id
      )
      .eq(
        'flow_session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )

    if (updateError) {
      console.error(
        '[venue visit][PATCH] Competition participation verified-stop repair failed:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          participationId:
            participation.id,
          verifiedStopCount:
            canonicalVerifiedStopCount,
          error:
            updateError,
        }
      )
    }
  } catch (error) {
    console.error(
      '[venue visit][PATCH] Unexpected competition participation repair failure:',
      {
        sessionId,
        userId,
        error,
      }
    )
  }
}

async function verifyVenueLocation({
  supabase,
  venueId,
  userLat,
  userLon,
  locationAccuracyMeters,
}: {
  supabase: Awaited<ReturnType<typeof supabaseServerApi>>
  venueId: string
  userLat: number
  userLon: number
  locationAccuracyMeters?: number | null
}) {
  if (!isValidLatitude(userLat) || !isValidLongitude(userLon)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'Location is required to mark this venue as visited.',
        },
        {
          status: 400,
        }
      ),
    }
  }

  if (
    typeof locationAccuracyMeters ===
      'number' &&
    Number.isFinite(
      locationAccuracyMeters
    ) &&
    locationAccuracyMeters >
      MAX_REASONABLE_ACCURACY_METERS
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'We could not confirm your location accurately enough. Try again closer to the venue entrance.',
        },
        {
          status: 400,
        }
      ),
    }
  }

  const {
    data: venue,
    error: venueError,
  } = await supabase
    .from('venues')
    .select('id, lat, lon, city')
    .eq('id', venueId)
    .maybeSingle()

  if (venueError) {
    console.error(
      '[venue visit][geo] Venue fetch failed:',
      venueError
    )

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'Could not verify venue location.',
        },
        {
          status: 500,
        }
      ),
    }
  }

  if (
    !venue ||
    !isValidLatitude(
      venue.lat
    ) ||
    !isValidLongitude(
      venue.lon
    )
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'This venue does not have a valid check-in location.',
        },
        {
          status: 400,
        }
      ),
    }
  }

  const distanceMeters =
    calculateDistanceMeters({
      fromLat:
        userLat,

      fromLon:
        userLon,

      toLat:
        venue.lat,

      toLon:
        venue.lon,
    })

  const accuracyBuffer =
    typeof locationAccuracyMeters ===
      'number' &&
    Number.isFinite(
      locationAccuracyMeters
    )
      ? locationAccuracyMeters
      : 0

  const geoVerified =
    distanceMeters <=
      BASE_CHECK_IN_RADIUS_METERS ||
    distanceMeters <=
      FLEXIBLE_RADIUS_METERS +
        accuracyBuffer

  if (!geoVerified) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'You need to be closer to this venue to mark it as visited.',

          distanceMeters:
            Math.round(
              distanceMeters
            ),

          requiredDistanceMeters:
            BASE_CHECK_IN_RADIUS_METERS,
        },
        {
          status: 400,
        }
      ),
    }
  }

  return {
    ok: true as const,
    distanceMeters,
    city: venue.city,
  }
}

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  const {
    venueId,
  } =
    await context.params

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser()

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        visited: false,
        rating: null,
      },
      {
        status: 200,
      }
    )
  }

  const url =
    new URL(
      req.url
    )

  const checkProximity =
    url.searchParams.get(
      'check_proximity'
    ) === '1'

  if (checkProximity) {
    const userLat =
      Number(
        url.searchParams.get(
          'user_lat'
        )
      )

    const userLon =
      Number(
        url.searchParams.get(
          'user_lon'
        )
      )

    const rawAccuracy =
      url.searchParams.get(
        'location_accuracy_meters'
      )

    const locationAccuracyMeters =
      rawAccuracy &&
      rawAccuracy
        .trim()
        .length > 0
        ? Number(
            rawAccuracy
          )
        : null

    const geoResult =
      await verifyVenueLocation({
        supabase,
        venueId,
        userLat,
        userLon,
        locationAccuracyMeters,
      })

    if (!geoResult.ok) {
      return geoResult.response
    }

    return NextResponse.json({
      proximityVerified:
        true,

      geoVerified:
        true,

      distanceMeters:
        Math.round(
          geoResult.distanceMeters
        ),
    })
  }

  /*
   * venue_visits is append-only historical data.
   *
   * Return the latest visit rather than assuming one lifetime
   * row per user and venue.
   */
  const {
    data,
    error,
  } = await supabase
    .from(
      'venue_visits'
    )
    .select(
      'id, rating, visited_at, created_at, updated_at'
    )
    .eq(
      'venue_id',
      venueId
    )
    .eq(
      'user_id',
      user.id
    )
    .order(
      'visited_at',
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      '[venue visit][GET] Failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Failed to load venue visit status',
      },
      {
        status: 500,
      }
    )
  }

  if (data) {
    let currentRating =
      data.rating ??
      null

    if (
      currentRating ===
      null
    ) {
      const {
        data:
          latestRatedVisit,
        error:
          latestRatedVisitError,
      } = await supabase
        .from(
          'venue_visits'
        )
        .select(
          'rating'
        )
        .eq(
          'venue_id',
          venueId
        )
        .eq(
          'user_id',
          user.id
        )
        .not(
          'rating',
          'is',
          null
        )
        .order(
          'visited_at',
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle()

      if (
        latestRatedVisitError
      ) {
        console.error(
          '[venue visit][GET] Rating lookup failed:',
          latestRatedVisitError
        )

        return NextResponse.json(
          {
            error:
              'Failed to load venue rating',
          },
          {
            status: 500,
          }
        )
      }

      currentRating =
        latestRatedVisit
          ?.rating ??
        null
    }

    return NextResponse.json({
      visited:
        true,

      rating:
        currentRating,

      visit:
        data,

      proofSource:
        'venue_visits',
    })
  }

  const {
    data:
      activeFlowProof,
    error:
      activeFlowProofError,
  } = await supabase
    .from(
      'active_flow_progress'
    )
    .select(
      'id, checked_in_at, venue_id, user_id'
    )
    .eq(
      'venue_id',
      venueId
    )
    .eq(
      'user_id',
      user.id
    )
    .order(
      'checked_in_at',
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle()

  if (
    activeFlowProofError
  ) {
    console.error(
      '[venue visit][GET] Active flow proof check failed:',
      activeFlowProofError
    )

    return NextResponse.json(
      {
        error:
          'Failed to verify flow check-in status',
      },
      {
        status: 500,
      }
    )
  }

  if (activeFlowProof) {
    return NextResponse.json({
      visited:
        true,

      rating:
        null,

      visit:
        null,

      proofSource:
        'active_flow_progress',
    })
  }

  return NextResponse.json({
    visited:
      false,

    rating:
      null,

    visit:
      null,
  })
}

export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  const {
    venueId,
  } =
    await context.params

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser()

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status: 401,
      }
    )
  }

  const body =
    (await req
      .json()
      .catch(
        () => ({})
      )) as VenueVisitBody

  const {
    rating,

    user_lat:
      userLat,

    user_lon:
      userLon,

    location_accuracy_meters:
      locationAccuracyMeters,

    device_timestamp:
      deviceTimestamp,
  } =
    body

  const now =
    new Date()
      .toISOString()

  /*
   * venue_visits is append-only historical data.
   *
   * The latest historical visit is the relevant row for current
   * eligibility.
   */
  const {
    data:
      existingVisit,
    error:
      existingVisitError,
  } = await supabase
    .from(
      'venue_visits'
    )
    .select(
      'id, rating, visited_at'
    )
    .eq(
      'venue_id',
      venueId
    )
    .eq(
      'user_id',
      user.id
    )
    .order(
      'visited_at',
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle()

  if (
    existingVisitError
  ) {
    console.error(
      '[venue visit][POST] Existing visit check failed:',
      existingVisitError
    )

    return NextResponse.json(
      {
        error:
          'Failed to verify existing venue visit',
      },
      {
        status: 500,
      }
    )
  }

  const ratingWasProvided =
    rating !==
      undefined &&
    rating !==
      null

  if (
    ratingWasProvided &&
    !isValidRating(
      rating
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Rating must be an integer between 1 and 5',
      },
      {
        status: 400,
      }
    )
  }

  if (
    !existingVisit &&
    !isValidRating(
      rating
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Rating must be an integer between 1 and 5 for your first check-in.',
      },
      {
        status: 400,
      }
    )
  }

  let existingRating:
    number | null =
      null

  if (
    existingVisit &&
    !isValidRating(
      rating
    )
  ) {
    const {
      data:
        latestRatedVisit,
      error:
        latestRatedVisitError,
    } = await supabase
      .from(
        'venue_visits'
      )
      .select(
        'rating'
      )
      .eq(
        'venue_id',
        venueId
      )
      .eq(
        'user_id',
        user.id
      )
      .not(
        'rating',
        'is',
        null
      )
      .order(
        'visited_at',
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle()

    if (
      latestRatedVisitError
    ) {
      console.error(
        '[venue visit][POST] Existing rating lookup failed:',
        latestRatedVisitError
      )

      return NextResponse.json(
        {
          error:
            'Failed to verify existing venue rating',
        },
        {
          status:
            500,
        }
      )
    }

    existingRating =
      latestRatedVisit
        ?.rating ??
      null
  }

  const ratingToSave =
    isValidRating(
      rating
    )
      ? rating
      : null

  const geoResult =
    await verifyVenueLocation({
      supabase,

      venueId,

      userLat:
        userLat as number,

      userLon:
        userLon as number,

      locationAccuracyMeters,
    })

  if (!geoResult.ok) {
    return geoResult.response
  }

  if (
    existingVisit
      ?.visited_at &&
    typeof geoResult.city ===
      'string' &&
    geoResult.city
      .trim()
      .length > 0 &&
    isSameRoamDay(
      existingVisit
        .visited_at,

      now,

      geoResult.city
    )
  ) {
    return NextResponse.json(
      {
        error:
          'You have already checked in to this venue today. Try again on a different day.',
      },
      {
        status: 409,
      }
    )
  }

const {
    data,
    error,
  } = await supabase
    .from(
      'venue_visits'
    )
    .insert({
      user_id:
        user.id,

      venue_id:
        venueId,

      rating:
        ratingToSave,

      visited_at:
        now,

      user_lat:
        userLat,

      user_lon:
        userLon,

      distance_meters:
        geoResult.distanceMeters,

      location_accuracy_meters:
        typeof locationAccuracyMeters ===
          'number' &&
        Number.isFinite(
          locationAccuracyMeters
        )
          ? locationAccuracyMeters
          : null,

      geo_verified:
        true,

      check_in_source:
        'geo',

      device_timestamp:
        typeof deviceTimestamp ===
          'string' &&
        deviceTimestamp
          .trim()
          .length > 0
          ? deviceTimestamp
          : null,
    })
    .select(
      'id, rating, visited_at, created_at, updated_at'
    )
    .single()

  if (error) {
    console.error(
      '[venue visit][POST] Failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Failed to save venue visit',
      },
      {
        status: 500,
      }
    )
  }

  await refreshPublicPassportStats(
    user.id,
    'POST'
  )

  await safelyRefreshCreatorReputation(
    user.id,
    {
      mutation:
        'venue_visit_post',

      rankingRefreshMode:
        'affected',

      calculatedAt:
        now,
    }
  )

  return NextResponse.json({
    visited:
      true,

    rating:
      data.rating ??
      existingRating,

    visit:
      data,

    geoVerified:
      true,

    distanceMeters:
      Math.round(
        geoResult.distanceMeters
      ),
  })
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const {
    venueId,
  } =
    await context.params

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser()

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status: 401,
      }
    )
  }

  const body =
    (await req
      .json()
      .catch(
        () => ({})
      )) as VenueVisitBody

  const {
    rating,
  } =
    body

  if (
    !isValidRating(
      rating
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Rating must be an integer between 1 and 5',
      },
      {
        status: 400,
      }
    )
  }

  const now =
    new Date()
      .toISOString()

  /*
   * Historical visit rows are append-only visit events, so multiple
   * venue_visits rows may exist for the same user and venue.
   *
   * Rating edits intentionally target only the latest visit.
   */
  const {
    data:
      existingVisit,
    error:
      existingVisitError,
  } = await supabase
    .from(
      'venue_visits'
    )
    .select(
      'id'
    )
    .eq(
      'venue_id',
      venueId
    )
    .eq(
      'user_id',
      user.id
    )
    .order(
      'visited_at',
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle()

  if (
    existingVisitError
  ) {
    console.error(
      '[venue visit][PATCH] Existing visit check failed:',
      existingVisitError
    )

    return NextResponse.json(
      {
        error:
          'Failed to verify existing venue visit',
      },
      {
        status: 500,
      }
    )
  }

  if (existingVisit) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'venue_visits'
      )
      .update({
        rating,
        updated_at:
          now,
      })
      .eq(
        'id',
        existingVisit.id
      )
      .select(
        'id, rating, visited_at, created_at, updated_at'
      )
      .maybeSingle()

    if (error) {
      console.error(
        '[venue visit][PATCH] Failed:',
        error
      )

      return NextResponse.json(
        {
          error:
            'Failed to update venue rating',
        },
        {
          status: 500,
        }
      )
    }

    await refreshPublicPassportStats(
      user.id,
      'PATCH'
    )

    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          'venue_visit_patch',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          now,
      }
    )

    return NextResponse.json({
      visited:
        true,

      rating:
        data?.rating ??
        rating,

      visit:
        data,
    })
  }

  const {
    data:
      activeFlowProof,
    error:
      activeFlowProofError,
  } = await supabase
    .from(
      'active_flow_progress'
    )
    .select(
      'id, session_id, checked_in_at, user_lat, user_lon, distance_meters, location_accuracy_meters, geo_verified, check_in_source, device_timestamp'
    )
    .eq(
      'venue_id',
      venueId
    )
    .eq(
      'user_id',
      user.id
    )
    .order(
      'checked_in_at',
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle()

  if (
    activeFlowProofError
  ) {
    console.error(
      '[venue visit][PATCH] Active flow proof check failed:',
      activeFlowProofError
    )

    return NextResponse.json(
      {
        error:
          'Failed to verify flow check-in proof',
      },
      {
        status: 500,
      }
    )
  }

  if (activeFlowProof) {
    const visitedAt =
      typeof activeFlowProof
        .checked_in_at ===
        'string' &&
      activeFlowProof
        .checked_in_at
        .trim()
        .length > 0
        ? activeFlowProof
            .checked_in_at
        : now

    /*
     * Active-flow check-ins now create venue_visits directly.
     *
     * Before backfilling an older active_flow_progress record,
     * look for the canonical visit generated by that exact
     * check-in so PATCH cannot manufacture a duplicate historical
     * visit event.
     */
    const {
      data:
        existingActiveFlowVisit,
      error:
        existingActiveFlowVisitError,
    } = await supabase
      .from(
        'venue_visits'
      )
      .select(
        'id, rating, visited_at, created_at, updated_at'
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'venue_id',
        venueId
      )
      .eq(
        'check_in_source',
        'active_flow'
      )
      .eq(
        'visited_at',
        visitedAt
      )
      .limit(1)
      .maybeSingle()

    if (
      existingActiveFlowVisitError
    ) {
      console.error(
        '[venue visit][PATCH] Existing active-flow venue visit lookup failed:',
        existingActiveFlowVisitError
      )

      return NextResponse.json(
        {
          error:
            'Failed to verify existing flow venue visit',
        },
        {
          status: 500,
        }
      )
    }

    if (
      existingActiveFlowVisit
    ) {
      const {
        data,
        error,
      } = await supabase
        .from(
          'venue_visits'
        )
        .update({
          rating,
          updated_at:
            now,
        })
        .eq(
          'id',
          existingActiveFlowVisit.id
        )
        .select(
          'id, rating, visited_at, created_at, updated_at'
        )
        .maybeSingle()

      if (error) {
        console.error(
          '[venue visit][PATCH] Failed to update existing active-flow venue visit:',
          error
        )

        return NextResponse.json(
          {
            error:
              'Failed to save venue rating from flow check-in',
          },
          {
            status: 500,
          }
        )
      }

      /**
       * Competition repair:
       *
       * Reuse the canonical Active Flow progress and already-existing
       * venue_visits row. No duplicate visit is created.
       */
      if (
        activeFlowProof.geo_verified ===
          true &&
        typeof activeFlowProof.session_id ===
          'string'
      ) {
        await repairCompetitionParticipationFromActiveFlow({
          sessionId:
            activeFlowProof.session_id,

          userId:
            user.id,
        })
      }

      await refreshPublicPassportStats(
        user.id,
        'PATCH_ACTIVE_FLOW'
      )

      await safelyRefreshCreatorReputation(
        user.id,
        {
          mutation:
            'venue_visit_patch_active_flow',

          rankingRefreshMode:
            'affected',

          calculatedAt:
            now,
        }
      )

      return NextResponse.json({
        visited:
          true,

        rating:
          data?.rating ??
          rating,

        visit:
          data,

        proofSource:
          'active_flow_progress',
      })
    }

    /*
     * Legacy repair only:
     *
     * No canonical active-flow venue visit exists for this exact
     * progress event, so create the missing historical row once.
     */
    const {
      data,
      error,
    } = await supabase
      .from(
        'venue_visits'
      )
      .insert({
        user_id:
          user.id,

        venue_id:
          venueId,

        rating,

        visited_at:
          visitedAt,

        user_lat:
          activeFlowProof
            .user_lat ??
          null,

        user_lon:
          activeFlowProof
            .user_lon ??
          null,

        distance_meters:
          activeFlowProof
            .distance_meters ??
          null,

        location_accuracy_meters:
          activeFlowProof
            .location_accuracy_meters ??
          null,

        geo_verified:
          activeFlowProof
            .geo_verified ===
          true,

        check_in_source:
          'active_flow',

        device_timestamp:
          activeFlowProof
            .device_timestamp ??
          null,

        updated_at:
          now,
      } as any)
      .select(
        'id, rating, visited_at, created_at, updated_at'
      )
      .single()

    if (error) {
      console.error(
        '[venue visit][PATCH] Failed to backfill venue visit from active flow:',
        error
      )

      return NextResponse.json(
        {
          error:
            'Failed to save venue rating from flow check-in',
        },
        {
          status: 500,
        }
      )
    }

    /**
     * Competition repair:
     *
     * The missing canonical venue_visits event has now been repaired.
     * If its Active Flow is competition-linked, repair the linked
     * participation aggregate from canonical geo-verified progress.
     */
    if (
      activeFlowProof.geo_verified ===
        true &&
      typeof activeFlowProof.session_id ===
        'string'
    ) {
      await repairCompetitionParticipationFromActiveFlow({
        sessionId:
          activeFlowProof.session_id,

        userId:
          user.id,
      })
    }

    await refreshPublicPassportStats(
      user.id,
      'PATCH_ACTIVE_FLOW'
    )

    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          'venue_visit_patch_active_flow',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          now,
      }
    )

    return NextResponse.json({
      visited:
        true,

      rating:
        data.rating,

      visit:
        data,

      proofSource:
        'active_flow_progress',
    })
  }

  return NextResponse.json(
    {
      error:
        'Visit not found. Check in at this venue before rating it.',
    },
    {
      status: 404,
    }
  )
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  const {
    venueId,
  } =
    await context.params

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser()

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status: 401,
      }
    )
  }

  const {
    error,
  } = await supabase
    .from(
      'venue_visits'
    )
    .delete()
    .eq(
      'venue_id',
      venueId
    )
    .eq(
      'user_id',
      user.id
    )

  if (error) {
    console.error(
      '[venue visit][DELETE] Failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Failed to remove venue visit',
      },
      {
        status: 500,
      }
    )
  }

  await refreshPublicPassportStats(
    user.id,
    'DELETE'
  )

  await safelyRefreshCreatorReputation(
    user.id,
    {
      mutation:
        'venue_visit_delete',

      rankingRefreshMode:
        'affected',
    }
  )

  return NextResponse.json({
    visited:
      false,

    rating:
      null,
  })
}