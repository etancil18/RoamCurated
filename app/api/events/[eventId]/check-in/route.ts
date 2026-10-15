
import { NextResponse } from 'next/server'

import { supabaseServerApi } from '@/lib/supabase/server-api'

import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'

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

type AtomicEventCheckInResult = {
  checkedIn: boolean
  alreadyCheckedIn: boolean
  xpAwarded: number
  geoVerified?: boolean
  distanceMeters?: number
  eventCheckinId?: string
  venueVisitId?: string | null
  venueVisit?: {
    id: string
    venue_id: string
    rating: number | null
    visited_at: string
    geo_verified: boolean
    check_in_source: string
  } | null
  visitDate?: string
  venueTimeZone?: string
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
     * Preserve the existing event check-in rating requirement.
     *
     * Validate the genuine user-supplied rating before
     * invoking the atomic database transaction.
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

    /**
     * Atomic event check-in.
     *
     * The PostgreSQL RPC owns all persistence:
     *
     * - event_checkins
     * - canonical venue_visits
     * - event_checkins.venue_visit_id
     * - event_xp_ledger (only when XP > 0)
     *
     * XP policy is enforced by the database:
     *
     * - venue-admin: configured event XP
     * - imported events: 25 XP for eligible partners
     * - community/dash: existing configured XP
     *
     * Event eligibility is enforced by the database:
     *
     * - active events only
     * - opens 1 hour before event start
     * - closes 1 hour after a valid event end
     * - without a valid end, closes 4 hours after start
     *
     * The RPC also handles duplicate attendance.
     *
     * Do not insert into any of these tables
     * separately in this route.
     */
    const {
      data: atomicResult,
      error: atomicError,
    } =
      await supabase.rpc(
        'record_roam_event_checkin',
        {
          p_event_id:
            eventId,

          p_rating:
            rating,

          p_user_lat:
            userLat,

          p_user_lon:
            userLon,

          p_accuracy_meters:
            normalizedLocationAccuracyMeters ??
            undefined,

          p_device_timestamp:
            normalizedDeviceTimestamp ??
            undefined,
        }
      )

    if (
      atomicError
    ) {
      /**
       * Expected RPC eligibility errors are client
       * failures, not internal server failures.
       *
       * Keep the error mapping limited to messages
       * explicitly raised by this RPC.
       */
      const eligibilityErrors =
        new Set([
          'Event is not active',
          'Event check-in has not opened yet',
          'Event check-in window has closed',
          'Event check-in is disabled',
        ])

      const validationErrors =
        new Set([
          'Event ID is required',
          'Rating must be between 1 and 5',
          'Valid geographic coordinates are required',
          'Location accuracy is insufficient',
          'Event start time is unavailable',
          'Event has no check-in venue',
          'Event venue not found',
          'Venue has invalid coordinates',
          'You need to be closer to the event venue',
        ])

      if (
        eligibilityErrors.has(
          atomicError.message
        )
      ) {
        return NextResponse.json(
          {
            error:
              atomicError.message,
          },
          {
            status: 403,
          }
        )
      }

      if (
        validationErrors.has(
          atomicError.message
        )
      ) {
        return NextResponse.json(
          {
            error:
              atomicError.message,
          },
          {
            status: 400,
          }
        )
      }

      if (
        atomicError.message ===
        'Event not found'
      ) {
        return NextResponse.json(
          {
            error:
              atomicError.message,
          },
          {
            status: 404,
          }
        )
      }

      if (
        atomicError.message ===
        'Authentication required'
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

      console.error(
        '[events/check-in] Atomic check-in failed:',
        {
          eventId,
          userId:
            user.id,
          code:
            atomicError.code,
          message:
            atomicError.message,
          details:
            atomicError.details,
        }
      )

      return NextResponse.json(
        {
          error:
            'Failed to complete event check-in.',

          details:
            atomicError.message,
        },
        {
          status: 500,
        }
      )
    }

    if (
      !atomicResult ||
      typeof atomicResult !== 'object' ||
      Array.isArray(atomicResult)
    ) {
      console.error(
        '[events/check-in] Unexpected atomic RPC response:',
        atomicResult
      )

      return NextResponse.json(
        {
          error:
            'Unexpected event check-in response.',
        },
        {
          status: 500,
        }
      )
    }

    const result =
      atomicResult as AtomicEventCheckInResult

    if (
      result.checkedIn !== true ||
      typeof result.alreadyCheckedIn !== 'boolean' ||
      typeof result.xpAwarded !== 'number'
    ) {
      console.error(
        '[events/check-in] Invalid atomic RPC result:',
        atomicResult
      )

      return NextResponse.json(
        {
          error:
            'Invalid event check-in result.',
        },
        {
          status: 500,
        }
      )
    }

    /**
     * Maintain the existing route response shape.
     *
     * The RPC includes venueVisit on a new check-in.
     * For an existing check-in, the RPC returns the
     * associated venueVisitId. Load that visit when
     * a canonical relationship already exists.
     *
     * Never create a historical repair visit here:
     * that would bypass the atomic transaction.
     */
    let venueVisit =
      result.venueVisit ??
      null

    if (
      !venueVisit &&
      result.venueVisitId
    ) {
      const {
        data: linkedVisit,
        error: linkedVisitError,
      } =
        await supabase
          .from(
            'venue_visits'
          )
          .select(`
            id,
            venue_id,
            rating,
            visited_at,
            geo_verified,
            check_in_source
          `)
          .eq(
            'id',
            result.venueVisitId
          )
          .maybeSingle()

      if (
        linkedVisitError
      ) {
        console.error(
          '[events/check-in] Failed to load linked Passport visit:',
          linkedVisitError
        )
      } else {
        venueVisit =
          linkedVisit
      }
    }

    /**
     * Refresh derived statistics only after
     * the atomic RPC has committed successfully.
     */
    await refreshPublicPassportStats(
      user.id
    )

    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          result.alreadyCheckedIn
            ? 'event_check_in_existing'
            : 'event_check_in',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          now,
      }
    )

    if (
      result.alreadyCheckedIn
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

    return NextResponse.json({
      checkedIn:
        true,

      alreadyCheckedIn:
        false,

      xpAwarded:
        result.xpAwarded,

      geoVerified:
        true,

      distanceMeters:
        typeof result.distanceMeters ===
          'number'
          ? result.distanceMeters
          : Math.round(
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
