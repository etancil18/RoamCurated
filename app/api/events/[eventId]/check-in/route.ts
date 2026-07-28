import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

type RouteContext = {
  params: Promise<{
    eventId: string
  }>
}

type EventCheckInBody = {
  rating?: unknown
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number | null
  device_timestamp?: string
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250

async function refreshPublicPassportStats(
  userId: string
) {
  try {
    await rebuildPublicPassportStats(
      userId
    )
  } catch (error) {
    console.error(
      '[events/check-in] Failed to rebuild public Passport stats:',
      error
    )
  }
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { eventId } =
      await context.params

    if (!eventId) {
      return NextResponse.json(
        {
          error:
            'Missing eventId',
        },
        {
          status: 400,
        }
      )
    }

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as EventCheckInBody

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

    /**
     * venue_visits.rating is intentionally non-nullable.
     *
     * Validate the genuine user-supplied rating before creating
     * either the event check-in or its canonical venue visit.
     */
    if (
      !isValidRating(
        rating
      )
    ) {
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
            'We could not confirm your location accurately enough. Try again closer to the event venue.',
        },
        {
          status: 400,
        }
      )
    }

    const supabase =
      await supabaseServerApi()

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser()

    console.log(
      'event check-in auth:',
      {
        userId:
          user?.id ??
          null,

        email:
          user?.email ??
          null,

        userError:
          userError?.message ??
          null,
      }
    )

    if (
      userError ||
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
      data: event,
      error:
        eventError,
    } =
      await supabase
        .from(
          'events'
        )
        .select(
          'id, venue_id, social_group_id, xp_reward, checkin_enabled'
        )
        .eq(
          'id',
          eventId
        )
        .maybeSingle()

    if (
      eventError
    ) {
      console.error(
        'Check-in event lookup error:',
        eventError
      )

      return NextResponse.json(
        {
          error:
            'Failed to load event',

          details:
            eventError.message,
        },
        {
          status: 500,
        }
      )
    }

    if (
      !event
    ) {
      return NextResponse.json(
        {
          error:
            'Event not found',
        },
        {
          status: 404,
        }
      )
    }

    if (
      event.checkin_enabled ===
      false
    ) {
      return NextResponse.json(
        {
          error:
            'Check-in is disabled for this event',
        },
        {
          status: 403,
        }
      )
    }

    if (
      !event.venue_id
    ) {
      return NextResponse.json(
        {
          error:
            'This event does not have a venue location for check-in.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: venue,
      error:
        venueError,
    } =
      await supabase
        .from(
          'venues'
        )
        .select(
          'id, lat, lon'
        )
        .eq(
          'id',
          event.venue_id
        )
        .maybeSingle()

    if (
      venueError
    ) {
      console.error(
        'Check-in venue lookup error:',
        venueError
      )

      return NextResponse.json(
        {
          error:
            'Failed to verify event venue',

          details:
            venueError.message,
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
            'This event venue does not have a valid check-in location.',
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

    if (
      !geoVerified
    ) {
      return NextResponse.json(
        {
          error:
            'You need to be closer to the event venue to check in.',

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

    const now =
      new Date().toISOString()

    const xpAwarded =
      typeof event.xp_reward ===
        'number' &&
      event.xp_reward > 0
        ? event.xp_reward
        : 25

    const {
      data:
        existingCheckin,
      error:
        existingCheckinError,
    } =
      await supabase
        .from(
          'event_checkins'
        )
        .select(
          'id'
        )
        .eq(
          'event_id',
          eventId
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle()

    if (
      existingCheckinError
    ) {
      console.error(
        'Existing check-in lookup error:',
        existingCheckinError
      )

      return NextResponse.json(
        {
          error:
            'Failed to verify check-in status',

          details:
            existingCheckinError.message,
        },
        {
          status: 500,
        }
      )
    }

    /**
     * Existing event attendance may still be missing its
     * canonical venue_visits relationship because older versions
     * of this endpoint did not synchronize it.
     */
    if (
      existingCheckin
    ) {
      const {
        data:
          venueVisit,
        error:
          venueVisitError,
      } =
        await upsertEventVenueVisit({
          supabase,
          userId:
            user.id,
          venueId:
            event.venue_id,
          rating,
          visitedAt:
            now,
          userLat,
          userLon,
          distanceMeters,
          locationAccuracyMeters:
            normalizedLocationAccuracyMeters,
          deviceTimestamp:
            normalizedDeviceTimestamp,
        })

      if (
        venueVisitError ||
        !venueVisit
      ) {
        console.error(
          '[events/check-in] Existing event check-in venue visit sync failed:',
          {
            userId:
              user.id,

            eventId,

            venueId:
              event.venue_id,

            error:
              venueVisitError,
          }
        )

        return NextResponse.json(
          {
            error:
              'The event check-in exists, but its venue visit could not be recorded.',
          },
          {
            status: 500,
          }
        )
      }

      await refreshPublicPassportStats(
        user.id
      )

      return NextResponse.json({
        checkedIn:
          true,

        alreadyCheckedIn:
          true,

        xpAwarded:
          0,

        message:
          'Already checked in',

        venueVisit,
      })
    }

    const {
      error:
        checkinError,
    } =
      await supabase
        .from(
          'event_checkins'
        )
        .insert({
          event_id:
            eventId,

          user_id:
            user.id,

          social_group_id:
            event.social_group_id ??
            null,

          source:
            'event_page',

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
        } as any)

    if (
      checkinError
    ) {
      console.error(
        'Event check-in insert error:',
        checkinError
      )

      if (
        checkinError.code ===
        '23505'
      ) {
        const {
          data:
            venueVisit,
          error:
            venueVisitError,
        } =
          await upsertEventVenueVisit({
            supabase,
            userId:
              user.id,
            venueId:
              event.venue_id,
            rating,
            visitedAt:
              now,
            userLat,
            userLon,
            distanceMeters,
            locationAccuracyMeters:
              normalizedLocationAccuracyMeters,
            deviceTimestamp:
              normalizedDeviceTimestamp,
          })

        if (
          venueVisitError ||
          !venueVisit
        ) {
          console.error(
            '[events/check-in] Duplicate event check-in venue visit sync failed:',
            {
              userId:
                user.id,

              eventId,

              venueId:
                event.venue_id,

              error:
                venueVisitError,
            }
          )

          return NextResponse.json(
            {
              error:
                'The event check-in exists, but its venue visit could not be recorded.',
            },
            {
              status: 500,
            }
          )
        }

        await refreshPublicPassportStats(
          user.id
        )

        return NextResponse.json({
          checkedIn:
            true,

          alreadyCheckedIn:
            true,

          xpAwarded:
            0,

          message:
            'Already checked in',

          venueVisit,
        })
      }

      return NextResponse.json(
        {
          error:
            'Failed to check in',

          details:
            checkinError.message,
        },
        {
          status: 500,
        }
      )
    }

    /**
     * Synchronize the verified event check-in into the canonical
     * venue_visits relationship used by Passport stats and the
     * public Creator Exploration Map.
     */
    const {
      data:
        venueVisit,
      error:
        venueVisitError,
    } =
      await upsertEventVenueVisit({
        supabase,
        userId:
          user.id,
        venueId:
          event.venue_id,
        rating,
        visitedAt:
          now,
        userLat,
        userLon,
        distanceMeters,
        locationAccuracyMeters:
          normalizedLocationAccuracyMeters,
        deviceTimestamp:
          normalizedDeviceTimestamp,
      })

    if (
      venueVisitError ||
      !venueVisit
    ) {
      console.error(
        '[events/check-in] Venue visit sync failed:',
        {
          userId:
            user.id,

          eventId,

          venueId:
            event.venue_id,

          error:
            venueVisitError,
        }
      )

      return NextResponse.json(
        {
          error:
            'The event check-in was verified, but the venue visit could not be recorded.',
        },
        {
          status: 500,
        }
      )
    }

    const {
      error:
        xpError,
    } =
      await supabase
        .from(
          'event_xp_ledger'
        )
        .insert({
          user_id:
            user.id,

          event_id:
            eventId,

          social_group_id:
            event.social_group_id ??
            null,

          xp_amount:
            xpAwarded,

          reason:
            'event_checkin',
        })

    if (
      xpError
    ) {
      console.error(
        'Event XP ledger insert error:',
        xpError
      )

      await refreshPublicPassportStats(
        user.id
      )

      if (
        xpError.code ===
        '23505'
      ) {
        return NextResponse.json({
          checkedIn:
            true,

          alreadyCheckedIn:
            true,

          xpAwarded:
            0,

          message:
            'Already checked in',

          venueVisit,
        })
      }

      return NextResponse.json(
        {
          checkedIn:
            true,

          xpAwarded:
            0,

          warning:
            'Checked in, but XP was not awarded',

          details:
            xpError.message,

          venueVisit,
        },
        {
          status: 207,
        }
      )
    }

    await refreshPublicPassportStats(
      user.id
    )

    return NextResponse.json({
      checkedIn:
        true,

      alreadyCheckedIn:
        false,

      xpAwarded,

      geoVerified:
        true,

      distanceMeters:
        Math.round(
          distanceMeters
        ),

      venueVisit,
    })
  } catch (
    error
  ) {
    console.error(
      'Unexpected event check-in error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected server error',

        details:
          error instanceof
          Error
            ? error.message
            : 'Unknown error',
      },
      {
        status: 500,
      }
    )
  }
}

/* =========================================================
 * Canonical venue-visit synchronization
 * ======================================================= */

async function upsertEventVenueVisit({
  supabase,
  userId,
  venueId,
  rating,
  visitedAt,
  userLat,
  userLon,
  distanceMeters,
  locationAccuracyMeters,
  deviceTimestamp,
}: {
  supabase:
    Awaited<
      ReturnType<
        typeof supabaseServerApi
      >
    >
  userId: string
  venueId: string
  rating: number
  visitedAt: string
  userLat: number
  userLon: number
  distanceMeters: number
  locationAccuracyMeters:
    number | null
  deviceTimestamp:
    string | null
}) {
  return supabase
    .from(
      'venue_visits'
    )
    .upsert(
      {
        user_id:
          userId,

        venue_id:
          venueId,

        rating,

        visited_at:
          visitedAt,

        user_lat:
          userLat,

        user_lon:
          userLon,

        distance_meters:
          distanceMeters,

        location_accuracy_meters:
          locationAccuracyMeters,

        geo_verified:
          true,

        check_in_source:
          'event_checkin',

        device_timestamp:
          deviceTimestamp,

        updated_at:
          visitedAt,
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
}

/* =========================================================
 * Validation and geo helpers
 * ======================================================= */

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