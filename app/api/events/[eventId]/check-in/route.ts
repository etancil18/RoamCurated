import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    eventId: string
  }>
}

type EventCheckInBody = {
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number | null
  device_timestamp?: string
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250

export async function POST(request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as EventCheckInBody

    const userLat = body.user_lat
    const userLon = body.user_lon
    const locationAccuracyMeters = body.location_accuracy_meters
    const deviceTimestamp = body.device_timestamp

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
            'We could not confirm your location accurately enough. Try again closer to the event venue.',
        },
        { status: 400 }
      )
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log('event check-in auth:', {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      userError: userError?.message ?? null,
    })

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, venue_id, social_group_id, xp_reward, checkin_enabled')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) {
      console.error('Check-in event lookup error:', eventError)
      return NextResponse.json(
        { error: 'Failed to load event', details: eventError.message },
        { status: 500 }
      )
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.checkin_enabled === false) {
      return NextResponse.json(
        { error: 'Check-in is disabled for this event' },
        { status: 403 }
      )
    }

    if (!event.venue_id) {
      return NextResponse.json(
        { error: 'This event does not have a venue location for check-in.' },
        { status: 400 }
      )
    }

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('id, lat, lon')
      .eq('id', event.venue_id)
      .maybeSingle()

    if (venueError) {
      console.error('Check-in venue lookup error:', venueError)
      return NextResponse.json(
        { error: 'Failed to verify event venue', details: venueError.message },
        { status: 500 }
      )
    }

    if (!venue || !isValidLatitude(venue.lat) || !isValidLongitude(venue.lon)) {
      return NextResponse.json(
        { error: 'This event venue does not have a valid check-in location.' },
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
          error: 'You need to be closer to the event venue to check in.',
          distanceMeters: Math.round(distanceMeters),
          requiredDistanceMeters: BASE_CHECK_IN_RADIUS_METERS,
        },
        { status: 400 }
      )
    }

    const xpAwarded =
      typeof event.xp_reward === 'number' && event.xp_reward > 0
        ? event.xp_reward
        : 25

    const { data: existingCheckin, error: existingCheckinError } = await supabase
      .from('event_checkins')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingCheckinError) {
      console.error('Existing check-in lookup error:', existingCheckinError)
      return NextResponse.json(
        { error: 'Failed to verify check-in status', details: existingCheckinError.message },
        { status: 500 }
      )
    }

    if (existingCheckin) {
      return NextResponse.json({
        checkedIn: true,
        alreadyCheckedIn: true,
        xpAwarded: 0,
        message: 'Already checked in',
      })
    }

    const { error: checkinError } = await supabase
      .from('event_checkins')
      .insert({
        event_id: eventId,
        user_id: user.id,
        social_group_id: event.social_group_id ?? null,
        source: 'event_page',
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
      } as any)

    if (checkinError) {
      console.error('Event check-in insert error:', checkinError)

      if (checkinError.code === '23505') {
        return NextResponse.json({
          checkedIn: true,
          alreadyCheckedIn: true,
          xpAwarded: 0,
          message: 'Already checked in',
        })
      }

      return NextResponse.json(
        { error: 'Failed to check in', details: checkinError.message },
        { status: 500 }
      )
    }

    const { error: xpError } = await supabase
      .from('event_xp_ledger')
      .insert({
        user_id: user.id,
        event_id: eventId,
        social_group_id: event.social_group_id ?? null,
        xp_amount: xpAwarded,
        reason: 'event_checkin',
      })

    if (xpError) {
      console.error('Event XP ledger insert error:', xpError)

      if (xpError.code === '23505') {
        return NextResponse.json({
          checkedIn: true,
          alreadyCheckedIn: true,
          xpAwarded: 0,
          message: 'Already checked in',
        })
      }

      return NextResponse.json(
        {
          checkedIn: true,
          xpAwarded: 0,
          warning: 'Checked in, but XP was not awarded',
          details: xpError.message,
        },
        { status: 207 }
      )
    }

    return NextResponse.json({
      checkedIn: true,
      alreadyCheckedIn: false,
      xpAwarded,
      geoVerified: true,
      distanceMeters: Math.round(distanceMeters),
    })
  } catch (error) {
    console.error('Unexpected event check-in error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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