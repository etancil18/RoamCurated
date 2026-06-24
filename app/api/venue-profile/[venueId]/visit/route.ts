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

export async function GET(req: NextRequest, context: RouteContext) {
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

  const url = new URL(req.url)
  const checkProximity = url.searchParams.get('check_proximity') === '1'

  if (checkProximity) {
    const userLat = Number(url.searchParams.get('user_lat'))
    const userLon = Number(url.searchParams.get('user_lon'))
    const rawAccuracy = url.searchParams.get('location_accuracy_meters')
    const locationAccuracyMeters =
      rawAccuracy && rawAccuracy.trim().length > 0
        ? Number(rawAccuracy)
        : null

    const geoResult = await verifyVenueLocation({
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
      proximityVerified: true,
      geoVerified: true,
      distanceMeters: Math.round(geoResult.distanceMeters),
    })
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

  if (data) {
    return NextResponse.json({
      visited: true,
      rating: data.rating ?? null,
      visit: data,
      proofSource: 'venue_visits',
    })
  }

  const { data: activeFlowProof, error: activeFlowProofError } = await supabase
    .from('active_flow_progress')
    .select('id, checked_in_at, venue_id, user_id')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeFlowProofError) {
    console.error(
      '[venue visit][GET] Active flow proof check failed:',
      activeFlowProofError
    )

    return NextResponse.json(
      { error: 'Failed to verify flow check-in status' },
      { status: 500 }
    )
  }

  if (activeFlowProof) {
    return NextResponse.json({
      visited: true,
      rating: null,
      visit: null,
      proofSource: 'active_flow_progress',
    })
  }

  return NextResponse.json({
    visited: false,
    rating: null,
    visit: null,
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
  const { rating } = body

  if (!isValidRating(rating)) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  const { data: existingVisit, error: existingVisitError } = await supabase
    .from('venue_visits')
    .select('id')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingVisitError) {
    console.error('[venue visit][PATCH] Existing visit check failed:', existingVisitError)

    return NextResponse.json(
      { error: 'Failed to verify existing venue visit' },
      { status: 500 }
    )
  }

  if (existingVisit) {
    const { data, error } = await supabase
      .from('venue_visits')
      .update({
        rating,
        updated_at: now,
      })
      .eq('id', existingVisit.id)
      .select('id, rating, visited_at, created_at, updated_at')
      .maybeSingle()

    if (error) {
      console.error('[venue visit][PATCH] Failed:', error)

      return NextResponse.json(
        { error: 'Failed to update venue rating' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      visited: true,
      rating: data?.rating ?? rating,
      visit: data,
    })
  }

  const { data: activeFlowProof, error: activeFlowProofError } = await supabase
    .from('active_flow_progress')
    .select(
      'id, checked_in_at, user_lat, user_lon, distance_meters, location_accuracy_meters, geo_verified, check_in_source, device_timestamp'
    )
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeFlowProofError) {
    console.error(
      '[venue visit][PATCH] Active flow proof check failed:',
      activeFlowProofError
    )

    return NextResponse.json(
      { error: 'Failed to verify flow check-in proof' },
      { status: 500 }
    )
  }

  if (activeFlowProof) {
    const visitedAt =
      typeof activeFlowProof.checked_in_at === 'string' &&
      activeFlowProof.checked_in_at.trim().length > 0
        ? activeFlowProof.checked_in_at
        : now

    const { data, error } = await supabase
      .from('venue_visits')
      .upsert(
        {
          user_id: user.id,
          venue_id: venueId,
          rating,
          visited_at: visitedAt,
          user_lat: activeFlowProof.user_lat ?? null,
          user_lon: activeFlowProof.user_lon ?? null,
          distance_meters: activeFlowProof.distance_meters ?? null,
          location_accuracy_meters:
            activeFlowProof.location_accuracy_meters ?? null,
          geo_verified: activeFlowProof.geo_verified === true,
          check_in_source: 'active_flow',
          device_timestamp: activeFlowProof.device_timestamp ?? null,
          updated_at: now,
        } as any,
        {
          onConflict: 'user_id,venue_id',
        }
      )
      .select('id, rating, visited_at, created_at, updated_at')
      .single()

    if (error) {
      console.error(
        '[venue visit][PATCH] Failed to backfill venue visit from active flow:',
        error
      )

      return NextResponse.json(
        { error: 'Failed to save venue rating from flow check-in' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      visited: true,
      rating: data.rating,
      visit: data,
      proofSource: 'active_flow_progress',
    })
  }

  return NextResponse.json(
    {
      error:
        'Visit not found. Check in at this venue before rating it.',
    },
    { status: 404 }
  )
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