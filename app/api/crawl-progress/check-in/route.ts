import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

type CheckInCrawlProgressBody = {
  crawl_id?: string
  venue_id?: string
  stop_index?: number
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number | null
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

    const body = (await req.json()) as CheckInCrawlProgressBody

    const crawlId = body.crawl_id
    const venueId = body.venue_id
    const stopIndex = body.stop_index
    const userLat = body.user_lat
    const userLon = body.user_lon
    const locationAccuracyMeters = body.location_accuracy_meters
    const deviceTimestamp = body.device_timestamp

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

    if (!isValidLatitude(userLat) || !isValidLongitude(userLon)) {
      return NextResponse.json(
        { error: 'Location is required to check in.' },
        { status: 400 }
      )
    }

    if (
      typeof locationAccuracyMeters === 'number' &&
      Number.isFinite(locationAccuracyMeters) &&
      locationAccuracyMeters > MAX_REASONABLE_ACCURACY_METERS
    ) {
      return NextResponse.json(
        {
          error:
            'We could not confirm your location accurately enough. Try again closer to the venue entrance.',
        },
        { status: 400 }
      )
    }

    const { data: crawl, error: crawlError } = await supabase
      .from('crawl_events')
      .select('id, venue_ids')
      .eq('id', crawlId)
      .maybeSingle()

    if (crawlError) {
      console.error('[crawl-progress/check-in] Crawl fetch failed:', crawlError)

      return NextResponse.json(
        { error: 'Could not fetch hosted flow.' },
        { status: 500 }
      )
    }

    if (!crawl) {
      return NextResponse.json(
        { error: 'Hosted flow not found.' },
        { status: 404 }
      )
    }

    const venueIds = Array.isArray(crawl.venue_ids)
      ? crawl.venue_ids.filter(Boolean)
      : []

    if (!venueIds.includes(venueId)) {
      return NextResponse.json(
        { error: 'Venue is not part of this hosted flow.' },
        { status: 400 }
      )
    }

    if (venueIds[stopIndex] !== venueId) {
      return NextResponse.json(
        { error: 'Stop index does not match this venue.' },
        { status: 400 }
      )
    }

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('id, lat, lon')
      .eq('id', venueId)
      .maybeSingle()

    if (venueError) {
      console.error('[crawl-progress/check-in] Venue fetch failed:', venueError)

      return NextResponse.json(
        { error: 'Could not verify venue location.' },
        { status: 500 }
      )
    }

    if (!venue || !isValidLatitude(venue.lat) || !isValidLongitude(venue.lon)) {
      return NextResponse.json(
        { error: 'This venue does not have a valid check-in location.' },
        { status: 400 }
      )
    }

    const distanceMeters = calculateDistanceMeters({
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
      distanceMeters <= BASE_CHECK_IN_RADIUS_METERS ||
      distanceMeters <= FLEXIBLE_RADIUS_METERS + accuracyBuffer

    if (!geoVerified) {
      return NextResponse.json(
        {
          error: 'You need to be closer to this venue to check in.',
          distanceMeters: Math.round(distanceMeters),
          requiredDistanceMeters: BASE_CHECK_IN_RADIUS_METERS,
        },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const checkInPayload = {
      crawl_id: crawlId,
      user_id: user.id,
      venue_id: venueId,
      stop_index: stopIndex,
      completed_at: now,
      user_lat: userLat,
      user_lon: userLon,
      distance_meters: distanceMeters,
      location_accuracy_meters:
        typeof locationAccuracyMeters === 'number' &&
        Number.isFinite(locationAccuracyMeters)
          ? locationAccuracyMeters
          : null,
      geo_verified: true,
      check_in_source: 'geo',
      device_timestamp:
        typeof deviceTimestamp === 'string' && deviceTimestamp.trim().length > 0
          ? deviceTimestamp
          : null,
    }

    const { data: existingProgress, error: existingError } = await supabase
      .from('crawl_progress')
      .select('*')
      .eq('crawl_id', crawlId)
      .eq('user_id', user.id)
      .eq('stop_index', stopIndex)
      .maybeSingle()

    if (existingError) {
      console.error(
        '[crawl-progress/check-in] Existing progress check failed:',
        existingError
      )

      return NextResponse.json(
        { error: 'Could not check existing progress.' },
        { status: 500 }
      )
    }

    const { data: progress, error: progressError } = existingProgress
      ? await supabase
          .from('crawl_progress')
          .update(checkInPayload as any)
          .eq('id', existingProgress.id)
          .select('*')
          .single()
      : await supabase
          .from('crawl_progress')
          .insert(checkInPayload as any)
          .select('*')
          .single()

    if (progressError || !progress) {
      console.error(
        '[crawl-progress/check-in] Check-in write failed:',
        progressError
      )

      return NextResponse.json(
        { error: 'Could not check in.' },
        { status: 500 }
      )
    }

    const { error: rsvpUpdateError } = await supabase
      .from('crawl_rsvps')
      .update({
        checked_in_at: now,
      })
      .eq('crawl_id', crawlId)
      .eq('user_id', user.id)
      .is('checked_in_at', null)

    if (rsvpUpdateError) {
      console.error(
        '[crawl-progress/check-in] RSVP attendance summary update failed:',
        rsvpUpdateError
      )
    }

    const { data: progressRows, error: progressRowsError } = await supabase
      .from('crawl_progress')
      .select('stop_index')
      .eq('crawl_id', crawlId)
      .eq('user_id', user.id)

    if (progressRowsError) {
      console.error(
        '[crawl-progress/check-in] Progress refresh failed:',
        progressRowsError
      )

      return NextResponse.json(
        { error: 'Check-in saved, but progress could not be refreshed.' },
        { status: 500 }
      )
    }

    const completedStops = new Set(
      (progressRows ?? [])
        .map((row) => row.stop_index)
        .filter((value): value is number => typeof value === 'number')
    ).size

    const totalStops = venueIds.length
    const flowCompleted = completedStops === totalStops

    await refreshPublicPassportStats(user.id)

    return NextResponse.json(
      {
        progress,
        completedStops,
        totalStops,
        flowCompleted,
        xpEarned: 25,
        geoVerified: true,
        distanceMeters: Math.round(distanceMeters),
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[crawl-progress/check-in] Unexpected error:', err)

    return NextResponse.json(
      { error: 'Unexpected error checking in.' },
      { status: 500 }
    )
  }
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

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}