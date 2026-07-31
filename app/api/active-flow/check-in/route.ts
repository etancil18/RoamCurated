import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'
import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'

type CheckInActiveFlowBody = {
  session_id?: string
  venue_id?: string
  stop_index?: number
  rating?: unknown
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number
  device_timestamp?: string
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250

async function refreshPublicPassportStats(userId: string) {
  try {
    await rebuildPublicPassportStats(userId)
  } catch (error) {
    console.error(
      '[active-flow/check-in] Failed to rebuild public Passport stats:',
      error
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const body =
      (await req.json()) as CheckInActiveFlowBody

    const sessionId =
      body.session_id

    const venueId =
      body.venue_id

    const stopIndex =
      body.stop_index

    const rating =
      body.rating

    const userLat =
      body.user_lat

    const userLon =
      body.user_lon

    const locationAccuracyMeters =
      body.location_accuracy_meters

    const deviceTimestamp =
      body.device_timestamp

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'Missing session_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (!venueId) {
      return NextResponse.json(
        {
          error:
            'Missing venue_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      typeof stopIndex !==
        'number' ||
      !Number.isInteger(
        stopIndex
      ) ||
      stopIndex < 0
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid stop_index.',
        },
        {
          status: 400,
        }
      )
    }

    /**
     * venue_visits.rating is required.
     *
     * Validate the real user-supplied rating before either
     * active_flow_progress or venue_visits is written.
     */
    if (!isValidRating(rating)) {
      return NextResponse.json(
        {
          error:
            'Rating must be an integer between 1 and 5.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !isValidLatitude(
        userLat
      ) ||
      !isValidLongitude(
        userLon
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Location is required to check in.',
        },
        {
          status: 400,
        }
      )
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
      return NextResponse.json(
        {
          error:
            'We could not confirm your location accurately enough. Try again closer to the venue entrance.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .select(
        'id, user_id, venue_ids, status, source, source_id, title, city, metadata, completed_stops'
      )
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle()

    if (sessionError) {
      console.error(
        '[active-flow/check-in] Session fetch failed:',
        sessionError
      )

      return NextResponse.json(
        {
          error:
            'Could not fetch active flow.',
        },
        {
          status: 500,
        }
      )
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            'Flow not found.',
        },
        {
          status: 404,
        }
      )
    }

    if (
      session.status !==
      'active'
    ) {
      return NextResponse.json(
        {
          error:
            'Only active flows can be checked into.',
        },
        {
          status: 400,
        }
      )
    }

    const venueIds =
      Array.isArray(
        session.venue_ids
      )
        ? session.venue_ids.filter(
            Boolean
          )
        : []

    if (
      !venueIds.includes(
        venueId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Venue is not part of this flow.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      venueIds[
        stopIndex
      ] !== venueId
    ) {
      return NextResponse.json(
        {
          error:
            'Stop index does not match this venue.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: venue,
      error: venueError,
    } = await supabase
      .from(
        'venues'
      )
      .select(
        'id, lat, lon'
      )
      .eq(
        'id',
        venueId
      )
      .maybeSingle()

    if (venueError) {
      console.error(
        '[active-flow/check-in] Venue fetch failed:',
        venueError
      )

      return NextResponse.json(
        {
          error:
            'Could not verify venue location.',
        },
        {
          status: 500,
        }
      )
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
      return NextResponse.json(
        {
          error:
            'This venue does not have a valid check-in location.',
        },
        {
          status: 400,
        }
      )
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
      return NextResponse.json(
        {
          error:
            'You need to be closer to this venue to check in.',

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
      )
    }

    const now =
      new Date().toISOString()

    const normalizedLocationAccuracyMeters =
      typeof locationAccuracyMeters ===
        'number' &&
      Number.isFinite(
        locationAccuracyMeters
      )
        ? locationAccuracyMeters
        : null

    const normalizedDeviceTimestamp =
      typeof deviceTimestamp ===
        'string' &&
      deviceTimestamp
        .trim()
        .length > 0
        ? deviceTimestamp
        : null

    const {
      data: progress,
      error: upsertError,
    } = await supabase
      .from(
        'active_flow_progress'
      )
      .upsert(
        {
          session_id:
            sessionId,

          user_id:
            user.id,

          venue_id:
            venueId,

          stop_index:
            stopIndex,

          checked_in_at:
            now,

          user_lat:
            userLat,

          user_lon:
            userLon,

          distance_meters:
            distanceMeters,

          location_accuracy_meters:
            normalizedLocationAccuracyMeters,

          geo_verified:
            true,

          check_in_source:
            'geo',

          device_timestamp:
            normalizedDeviceTimestamp,
        },
        {
          onConflict:
            'session_id,user_id,venue_id',
        }
      )
      .select(
        '*'
      )
      .single()

    if (
      upsertError ||
      !progress
    ) {
      console.error(
        '[active-flow/check-in] Check-in upsert failed:',
        upsertError
      )

      return NextResponse.json(
        {
          error:
            'Could not check in.',
        },
        {
          status: 500,
        }
      )
    }

    /**
     * Synchronize the verified active-flow check-in into the
     * canonical venue_visits relationship used by Passport stats
     * and public Creator Exploration Maps.
     *
     * A real rating is included because venue_visits.rating is
     * intentionally non-nullable.
     */
    const {
      data: venueVisit,
      error: venueVisitError,
    } = await supabase
      .from(
        'venue_visits'
      )
      .upsert(
        {
          user_id:
            user.id,

          venue_id:
            venueId,

          rating,

          visited_at:
            now,

          user_lat:
            userLat,

          user_lon:
            userLon,

          distance_meters:
            distanceMeters,

          location_accuracy_meters:
            normalizedLocationAccuracyMeters,

          geo_verified:
            true,

          check_in_source:
            'active_flow',

          device_timestamp:
            normalizedDeviceTimestamp,

          updated_at:
            now,
        },
        {
          onConflict:
            'user_id,venue_id',
        }
      )
      .select(`
        id,
        venue_id,
        rating,
        visited_at,
        geo_verified,
        check_in_source
      `)
      .single()

    if (
      venueVisitError ||
      !venueVisit
    ) {
      console.error(
        '[active-flow/check-in] Venue visit sync failed:',
        {
          userId:
            user.id,

          venueId,

          sessionId,

          stopIndex,

          error:
            venueVisitError,
        }
      )

      return NextResponse.json(
        {
          error:
            'The check-in was verified, but the venue visit could not be recorded.',
        },
        {
          status: 500,
        }
      )
    }

    const {
      data: progressRows,
      error: progressError,
    } = await supabase
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
        user.id
      )

    if (progressError) {
      console.error(
        '[active-flow/check-in] Progress refresh failed:',
        progressError
      )

      return NextResponse.json(
        {
          error:
            'Check-in saved, but progress could not be refreshed.',
        },
        {
          status: 500,
        }
      )
    }

    const completedVenueIds =
      new Set(
        (
          progressRows ??
          []
        )
          .map(
            (
              row
            ) =>
              row.venue_id
          )
          .filter(
            Boolean
          )
      )

    const completedStops =
      completedVenueIds.size

    const totalStops =
      venueIds.length

    const flowCompleted =
      completedStops ===
      totalStops

    const {
      error:
        sessionProgressUpdateError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .update({
        completed_stops:
          completedStops,

        updated_at:
          now,
      } as any)
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )

    if (
      sessionProgressUpdateError
    ) {
      console.error(
        '[active-flow/check-in] Session completed_stops cache update failed:',
        sessionProgressUpdateError
      )
    }

    await refreshPublicPassportStats(
      user.id
    )

    /**
     * Refresh creator reputation only after the canonical
     * verified venue visit and active-flow progress writes have
     * succeeded.
     *
     * The safe refresh boundary records failures without
     * invalidating the completed user check-in.
     */
    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          'active_flow_check_in',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          now,
      }
    )

    return NextResponse.json(
      {
        progress,

        venueVisit,

        completedStops,

        totalStops,

        flowCompleted,

        xpEarned:
          25,

        geoVerified:
          true,

        distanceMeters:
          Math.round(
            distanceMeters
          ),

        source:
          session.source ??
          null,

        sourceId:
          session.source_id ??
          null,
      },
      {
        status: 200,
      }
    )
  } catch (err) {
    console.error(
      '[active-flow/check-in] Unexpected error:',
      err
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error checking in.',
      },
      {
        status: 500,
      }
    )
  }
}

function isValidRating(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >= 1 &&
    value <= 5
  )
}

function isValidLatitude(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -90 &&
    value <= 90
  )
}

function isValidLongitude(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -180 &&
    value <= 180
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
  const earthRadiusMeters =
    6371000

  const fromLatRad =
    degreesToRadians(
      fromLat
    )

  const toLatRad =
    degreesToRadians(
      toLat
    )

  const deltaLatRad =
    degreesToRadians(
      toLat -
        fromLat
    )

  const deltaLonRad =
    degreesToRadians(
      toLon -
        fromLon
    )

  const a =
    Math.sin(
      deltaLatRad /
        2
    ) *
      Math.sin(
        deltaLatRad /
          2
      ) +
    Math.cos(
      fromLatRad
    ) *
      Math.cos(
        toLatRad
      ) *
      Math.sin(
        deltaLonRad /
          2
      ) *
      Math.sin(
        deltaLonRad /
          2
      )

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        a
      ),
      Math.sqrt(
        1 -
          a
      )
    )

  return (
    earthRadiusMeters *
    c
  )
}

function degreesToRadians(
  value: number
) {
  return (
    value *
    Math.PI
  ) / 180
}