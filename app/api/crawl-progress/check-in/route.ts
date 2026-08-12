import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'
import { getRoamDay } from '@/lib/roam/roamDay'

type CheckInCrawlProgressBody = {
  crawl_id?: string
  venue_id?: string
  stop_index?: number
  rating?: unknown
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number | null
  device_timestamp?: string
}

type HostedFlowVenueVisitRow = {
  id: string
  venue_id: string
  rating: number
  visited_at: string
  geo_verified: boolean
  check_in_source: string
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250

async function refreshPublicPassportStats(userId: string) {
  try {
    await rebuildPublicPassportStats(userId)
  } catch (error) {
    console.error(
      '[crawl-progress/check-in] Failed to rebuild public Passport stats:',
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
      (await req.json()) as CheckInCrawlProgressBody

    const crawlId = body.crawl_id
    const venueId = body.venue_id
    const stopIndex = body.stop_index
    const rating = body.rating
    const userLat = body.user_lat
    const userLon = body.user_lon
    const locationAccuracyMeters =
      body.location_accuracy_meters
    const deviceTimestamp =
      body.device_timestamp

    if (!crawlId) {
      return NextResponse.json(
        { error: 'Missing crawl_id.' },
        { status: 400 }
      )
    }

    if (!venueId) {
      return NextResponse.json(
        { error: 'Missing venue_id.' },
        { status: 400 }
      )
    }

    if (
      typeof stopIndex !== 'number' ||
      !Number.isInteger(stopIndex) ||
      stopIndex < 0
    ) {
      return NextResponse.json(
        { error: 'Invalid stop_index.' },
        { status: 400 }
      )
    }

    /**
     * venue_visits.rating is required.
     *
     * Hosted-flow check-ins therefore require the same genuine
     * user-supplied rating as the canonical active-flow visit path.
     */
    if (!isValidRating(rating)) {
      return NextResponse.json(
        {
          error:
            'Rating must be an integer between 1 and 5.',
        },
        { status: 400 }
      )
    }

    if (
      !isValidLatitude(userLat) ||
      !isValidLongitude(userLon)
    ) {
      return NextResponse.json(
        {
          error:
            'Location is required to check in.',
        },
        { status: 400 }
      )
    }

    if (
      typeof locationAccuracyMeters === 'number' &&
      Number.isFinite(locationAccuracyMeters) &&
      locationAccuracyMeters >
        MAX_REASONABLE_ACCURACY_METERS
    ) {
      return NextResponse.json(
        {
          error:
            'We could not confirm your location accurately enough. Try again closer to the venue entrance.',
        },
        { status: 400 }
      )
    }

    const {
      data: crawl,
      error: crawlError,
    } = await supabase
      .from('crawl_events')
      .select('id, venue_ids')
      .eq('id', crawlId)
      .maybeSingle()

    if (crawlError) {
      console.error(
        '[crawl-progress/check-in] Crawl fetch failed:',
        crawlError
      )

      return NextResponse.json(
        {
          error:
            'Could not fetch hosted flow.',
        },
        { status: 500 }
      )
    }

    if (!crawl) {
      return NextResponse.json(
        {
          error:
            'Hosted flow not found.',
        },
        { status: 404 }
      )
    }

    const venueIds =
      Array.isArray(crawl.venue_ids)
        ? crawl.venue_ids.filter(Boolean)
        : []

    if (!venueIds.includes(venueId)) {
      return NextResponse.json(
        {
          error:
            'Venue is not part of this hosted flow.',
        },
        { status: 400 }
      )
    }

    if (
      venueIds[stopIndex] !==
      venueId
    ) {
      return NextResponse.json(
        {
          error:
            'Stop index does not match this venue.',
        },
        { status: 400 }
      )
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
        '[crawl-progress/check-in] Venue fetch failed:',
        venueError
      )

      return NextResponse.json(
        {
          error:
            'Could not verify venue location.',
        },
        { status: 500 }
      )
    }

    if (
      !venue ||
      !isValidLatitude(venue.lat) ||
      !isValidLongitude(venue.lon)
    ) {
      return NextResponse.json(
        {
          error:
            'This venue does not have a valid check-in location.',
        },
        { status: 400 }
      )
    }

    const distanceMeters =
      calculateDistanceMeters({
        fromLat: userLat,
        fromLon: userLon,
        toLat: venue.lat,
        toLon: venue.lon,
      })

    const accuracyBuffer =
      typeof locationAccuracyMeters === 'number' &&
      Number.isFinite(locationAccuracyMeters)
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
            Math.round(distanceMeters),
          requiredDistanceMeters:
            BASE_CHECK_IN_RADIUS_METERS,
        },
        { status: 400 }
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
      deviceTimestamp.trim().length > 0
        ? deviceTimestamp
        : null

    const checkInPayload = {
      crawl_id:
        crawlId,
      user_id:
        user.id,
      venue_id:
        venueId,
      stop_index:
        stopIndex,
      completed_at:
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
    }

    const {
      data: existingProgress,
      error: existingError,
    } = await supabase
      .from('crawl_progress')
      .select('*')
      .eq(
        'crawl_id',
        crawlId
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'stop_index',
        stopIndex
      )
      .maybeSingle()

    if (existingError) {
      console.error(
        '[crawl-progress/check-in] Existing progress check failed:',
        existingError
      )

      return NextResponse.json(
        {
          error:
            'Could not check existing progress.',
        },
        { status: 500 }
      )
    }

    let progress:
      typeof existingProgress

    let venueVisit:
      HostedFlowVenueVisitRow | null =
      null

    let createdCanonicalVisit =
      false

    /**
     * Hosted-flow progress is the canonical stop-completion event.
     *
     * Once it exists, a retry must preserve its original
     * completed_at timestamp instead of rewriting historical
     * provenance.
     */
    if (existingProgress) {
      progress =
        existingProgress

      const canonicalVisitedAt =
        typeof existingProgress.completed_at ===
          'string' &&
        existingProgress.completed_at
          .trim()
          .length > 0
          ? existingProgress.completed_at
          : null

      if (canonicalVisitedAt) {
        const {
          data:
            existingVenueVisit,
          error:
            existingVenueVisitError,
        } = await supabase
          .from('venue_visits')
          .select(`
            id,
            venue_id,
            rating,
            visited_at,
            geo_verified,
            check_in_source
          `)
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
            'hosted_flow'
          )
          .eq(
            'visited_at',
            canonicalVisitedAt
          )
          .limit(1)
          .maybeSingle<HostedFlowVenueVisitRow>()

        if (
          existingVenueVisitError
        ) {
          console.error(
            '[crawl-progress/check-in] Existing canonical venue visit lookup failed:',
            existingVenueVisitError
          )

          return NextResponse.json(
            {
              error:
                'The hosted-flow check-in exists, but its venue visit could not be verified.',
            },
            { status: 500 }
          )
        }

        venueVisit =
          existingVenueVisit
      }

      /**
       * Legacy/partial-write repair.
       *
       * If crawl_progress exists but its canonical venue_visits
       * event does not, create the missing event exactly once.
       */
      if (!venueVisit) {
        const repairVisitedAt =
          canonicalVisitedAt ??
          now

        const {
          data:
            repairedVenueVisit,
          error:
            repairedVenueVisitError,
        } = await supabase
          .from('venue_visits')
          .insert({
            user_id:
              user.id,

            venue_id:
              venueId,

            rating,

            visited_at:
              repairVisitedAt,

            user_lat:
              typeof existingProgress.user_lat ===
                'number'
                ? existingProgress.user_lat
                : userLat,

            user_lon:
              typeof existingProgress.user_lon ===
                'number'
                ? existingProgress.user_lon
                : userLon,

            distance_meters:
              typeof existingProgress.distance_meters ===
                'number'
                ? existingProgress.distance_meters
                : distanceMeters,

            location_accuracy_meters:
              typeof existingProgress.location_accuracy_meters ===
                'number'
                ? existingProgress.location_accuracy_meters
                : normalizedLocationAccuracyMeters,

            geo_verified:
              existingProgress.geo_verified ===
              true,

            check_in_source:
              'hosted_flow',

            device_timestamp:
              typeof existingProgress.device_timestamp ===
                'string'
                ? existingProgress.device_timestamp
                : normalizedDeviceTimestamp,

            updated_at:
              now,
          })
          .select(`
            id,
            venue_id,
            rating,
            visited_at,
            geo_verified,
            check_in_source
          `)
          .single<HostedFlowVenueVisitRow>()

        if (
          repairedVenueVisitError ||
          !repairedVenueVisit
        ) {
          console.error(
            '[crawl-progress/check-in] Existing progress venue visit repair failed:',
            {
              userId:
                user.id,
              crawlId,
              venueId,
              stopIndex,
              error:
                repairedVenueVisitError,
            }
          )

          return NextResponse.json(
            {
              error:
                'The hosted-flow check-in exists, but its venue visit could not be recorded.',
            },
            { status: 500 }
          )
        }

        venueVisit =
          repairedVenueVisit

        createdCanonicalVisit =
          true
      }
    } else {
      /**
       * A genuinely new hosted-flow stop must not manufacture a
       * second historical venue visit during the same Roam day.
       *
       * This runs only after the retry/idempotency boundary above.
       */
      if (
        typeof venue.city === 'string' &&
        venue.city.trim().length > 0
      ) {
        const {
          data: latestVenueVisit,
          error: latestVenueVisitError,
        } = await supabase
          .from('venue_visits')
          .select('visited_at')
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'venue_id',
            venueId
          )
          .order(
            'visited_at',
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle()

        if (latestVenueVisitError) {
          console.error(
            '[crawl-progress/check-in] Latest venue visit lookup failed:',
            latestVenueVisitError
          )

          return NextResponse.json(
            {
              error:
                'Could not verify existing venue visit.',
            },
            { status: 500 }
          )
        }

        if (
          latestVenueVisit?.visited_at &&
          isSameRoamDay(
            latestVenueVisit.visited_at,
            now,
            venue.city
          )
        ) {
          return NextResponse.json(
            {
              error:
                'You have already checked in to this venue today. Try again on a different day.',
            },
            { status: 409 }
          )
        }
      }

      const {
        data:
          insertedProgress,
        error:
          progressError,
      } = await supabase
        .from('crawl_progress')
        .insert(
          checkInPayload as any
        )
        .select('*')
        .single()

      if (
        progressError ||
        !insertedProgress
      ) {
        console.error(
          '[crawl-progress/check-in] Check-in write failed:',
          progressError
        )

        return NextResponse.json(
          {
            error:
              'Could not check in.',
          },
          { status: 500 }
        )
      }

      progress =
        insertedProgress

      /**
       * Synchronize the newly completed hosted-flow stop into
       * canonical append-only venue history.
       */
      const {
        data:
          insertedVenueVisit,
        error:
          venueVisitError,
      } = await supabase
        .from('venue_visits')
        .insert({
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
            'hosted_flow',

          device_timestamp:
            normalizedDeviceTimestamp,

          updated_at:
            now,
        })
        .select(`
          id,
          venue_id,
          rating,
          visited_at,
          geo_verified,
          check_in_source
        `)
        .single<HostedFlowVenueVisitRow>()

      if (
        venueVisitError ||
        !insertedVenueVisit
      ) {
        console.error(
          '[crawl-progress/check-in] Venue visit sync failed:',
          {
            userId:
              user.id,
            crawlId,
            venueId,
            stopIndex,
            error:
              venueVisitError,
          }
        )

        return NextResponse.json(
          {
            error:
              'The hosted-flow check-in was verified, but the venue visit could not be recorded.',
          },
          { status: 500 }
        )
      }

      venueVisit =
        insertedVenueVisit

      createdCanonicalVisit =
        true
    }

    const {
      error:
        rsvpUpdateError,
    } = await supabase
      .from('crawl_rsvps')
      .update({
        checked_in_at:
          now,
      })
      .eq(
        'crawl_id',
        crawlId
      )
      .eq(
        'user_id',
        user.id
      )
      .is(
        'checked_in_at',
        null
      )

    if (rsvpUpdateError) {
      console.error(
        '[crawl-progress/check-in] RSVP attendance summary update failed:',
        rsvpUpdateError
      )
    }

    const {
      data: progressRows,
      error:
        progressRowsError,
    } = await supabase
      .from('crawl_progress')
      .select(
        'stop_index'
      )
      .eq(
        'crawl_id',
        crawlId
      )
      .eq(
        'user_id',
        user.id
      )

    if (progressRowsError) {
      console.error(
        '[crawl-progress/check-in] Progress refresh failed:',
        progressRowsError
      )

      return NextResponse.json(
        {
          error:
            'Check-in saved, but progress could not be refreshed.',
        },
        { status: 500 }
      )
    }

    const completedStops =
      new Set(
        (
          progressRows ??
          []
        )
          .map(
            (row) =>
              row.stop_index
          )
          .filter(
            (
              value
            ): value is number =>
              typeof value ===
              'number'
          )
      ).size

    const totalStops =
      venueIds.length

    const flowCompleted =
      completedStops ===
      totalStops

    /**
     * A pure retry has not created new canonical visit evidence.
     * Only refresh derived Passport stats when a venue_visits row
     * was actually created or repaired.
     */
    if (createdCanonicalVisit) {
      await refreshPublicPassportStats(
        user.id
      )
    }

    return NextResponse.json(
      {
        progress,

        venueVisit,

        completedStops,

        totalStops,

        flowCompleted,

        xpEarned:
          existingProgress
            ? 0
            : 25,

        geoVerified:
          true,

        distanceMeters:
          Math.round(
            distanceMeters
          ),
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(
      '[crawl-progress/check-in] Unexpected error:',
      err
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error checking in.',
      },
      { status: 500 }
    )
  }
}

function isSameRoamDay(
  firstValue: string,
  secondValue: string,
  city: string
): boolean {
  const firstRoamDay =
    getRoamDay(
      firstValue,
      city
    )

  const secondRoamDay =
    getRoamDay(
      secondValue,
      city
    )

  return (
    firstRoamDay !== null &&
    secondRoamDay !== null &&
    firstRoamDay ===
      secondRoamDay
  )
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