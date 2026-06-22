import { NextRequest, NextResponse } from 'next/server'
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
        { error: 'Location is required to mark this venue as visited.' },
        { status: 400 }
      ),
    }
  }

  if (
    typeof locationAccuracyMeters === 'number' &&
    Number.isFinite(locationAccuracyMeters) &&
    locationAccuracyMeters > MAX_REASONABLE_ACCURACY_METERS
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'We could not confirm your location accurately enough. Try again closer to the venue entrance.',
        },
        { status: 400 }
      ),
    }
  }

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, lat, lon')
    .eq('id', venueId)
    .maybeSingle()

  if (venueError) {
    console.error('[venue visit][geo] Venue fetch failed:', venueError)

    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Could not verify venue location.' },
        { status: 500 }
      ),
    }
  }

  if (!venue || !isValidLatitude(venue.lat) || !isValidLongitude(venue.lon)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'This venue does not have a valid check-in location.' },
        { status: 400 }
      ),
    }
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
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'You need to be closer to this venue to mark it as visited.',
          distanceMeters: Math.round(distanceMeters),
          requiredDistanceMeters: BASE_CHECK_IN_RADIUS_METERS,
        },
        { status: 400 }
      ),
    }
  }

  return {
    ok: true as const,
    distanceMeters,
  }
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { visited: false, rating: null },
      { status: 200 }
    )
  }

  const { data, error } = await supabase
    .from('venue_visits')
    .select('id, rating, visited_at, created_at, updated_at')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[venue visit][GET] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to load venue visit status' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    visited: Boolean(data),
    rating: data?.rating ?? null,
    visit: data ?? null,
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as VenueVisitBody
  const {
    rating,
    user_lat: userLat,
    user_lon: userLon,
    location_accuracy_meters: locationAccuracyMeters,
    device_timestamp: deviceTimestamp,
  } = body

  if (!isValidRating(rating)) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  const geoResult = await verifyVenueLocation({
    supabase,
    venueId,
    userLat: userLat as number,
    userLon: userLon as number,
    locationAccuracyMeters,
  })

  if (!geoResult.ok) {
    return geoResult.response
  }

  const { data, error } = await supabase
    .from('venue_visits')
    .upsert(
      {
        user_id: user.id,
        venue_id: venueId,
        rating,
        visited_at: new Date().toISOString(),
        user_lat: userLat,
        user_lon: userLon,
        distance_meters: geoResult.distanceMeters,
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
      },
      {
        onConflict: 'user_id,venue_id',
      }
    )
    .select('id, rating, visited_at, created_at, updated_at')
    .single()

  if (error) {
    console.error('[venue visit][POST] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to save venue visit' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    visited: true,
    rating: data.rating,
    visit: data,
    geoVerified: true,
    distanceMeters: Math.round(geoResult.distanceMeters),
  })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as VenueVisitBody
  const {
    rating,
    user_lat: userLat,
    user_lon: userLon,
    location_accuracy_meters: locationAccuracyMeters,
    device_timestamp: deviceTimestamp,
  } = body

  if (!isValidRating(rating)) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  const geoResult = await verifyVenueLocation({
    supabase,
    venueId,
    userLat: userLat as number,
    userLon: userLon as number,
    locationAccuracyMeters,
  })

  if (!geoResult.ok) {
    return geoResult.response
  }

  const { data, error } = await supabase
    .from('venue_visits')
    .update({
      rating,
      updated_at: new Date().toISOString(),
      user_lat: userLat,
      user_lon: userLon,
      distance_meters: geoResult.distanceMeters,
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
    })
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .select('id, rating, visited_at, created_at, updated_at')
    .maybeSingle()

  if (error) {
    console.error('[venue visit][PATCH] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to update venue rating' },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Visit not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    visited: true,
    rating: data.rating,
    visit: data,
    geoVerified: true,
    distanceMeters: Math.round(geoResult.distanceMeters),
  })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('venue_visits')
    .delete()
    .eq('venue_id', venueId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[venue visit][DELETE] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to remove venue visit' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    visited: false,
    rating: null,
  })
}