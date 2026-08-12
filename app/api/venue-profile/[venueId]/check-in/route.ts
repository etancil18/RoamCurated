import { NextRequest, NextResponse } from 'next/server'

import { supabaseServerApi } from '@/lib/supabase/server-api'

import { getCityNow } from '@/lib/getCityNow'

import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

type RouteContext = {
  params: Promise<{
    venueId: string
  }>
}

type VenueCheckInBody = {
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number | null
  device_timestamp?: string | null
  source?: string | null
  property_id?: string | null
  property_slug?: string | null
  property_name?: string | null
  city?: string | null
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250
const PROPERTY_GUIDE_SINGLE_VENUE_XP = 15
const GENERIC_SINGLE_VENUE_XP = 10

async function refreshPublicPassportStats(userId: string) {
  try {
    await rebuildPublicPassportStats(userId)
  } catch (error) {
    console.error(
      '[venue-profile/check-in] Failed to rebuild public Passport stats:',
      error
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

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
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

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function normalizeSource(value: unknown) {
  const source = normalizeString(value)

  if (!source) return 'geo'

  const allowed = new Set([
    'property_guide',
    'venue_profile',
    'map',
    'search',
    'geo',
  ])

  return allowed.has(source) ? source : 'geo'
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
        { error: 'Location is required to check in.' },
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

  /*
   * Selecting all venue columns preserves compatibility with the generated
   * Supabase venue type while allowing the canonical city configuration to
   * supply the venue timezone.
   */
  const { data: venue, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .maybeSingle()

  if (error) {
    console.error('[venue-profile/check-in] Venue fetch failed:', error)

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
          error: 'You need to be closer to this venue to check in.',
          distanceMeters: Math.round(distanceMeters),
          requiredDistanceMeters: BASE_CHECK_IN_RADIUS_METERS,
        },
        { status: 400 }
      ),
    }
  }

  return {
    ok: true as const,
    venue,
    distanceMeters,
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params

  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as VenueCheckInBody

  const userLat = body.user_lat
  const userLon = body.user_lon

  const locationAccuracyMeters =
    typeof body.location_accuracy_meters === 'number' &&
    Number.isFinite(body.location_accuracy_meters)
      ? body.location_accuracy_meters
      : null

  const deviceTimestamp = normalizeString(body.device_timestamp)
  const source = normalizeSource(body.source)
  const propertyId = normalizeString(body.property_id)
  const propertySlug = normalizeString(body.property_slug)
  const propertyName = normalizeString(body.property_name)
  const city = normalizeString(body.city)

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

  /*
   * Use the venue's configured city clock as the canonical source for both
   * the persisted UTC timestamp and the venue-local calendar date.
   */
  const cityNow = getCityNow(geoResult.venue.city)

  const now =
    cityNow.toUTC().toISO() ??
    new Date().toISOString()

  const visitDate =
    cityNow.toISODate() ??
    new Date(now).toISOString().slice(0, 10)

  const venueTimeZone = cityNow.zoneName

  const checkInSource =
    source === 'property_guide'
      ? 'property_guide'
      : 'geo'

  /*
   * Determine whether the user has ever visited this venue.
   *
   * We intentionally select only the oldest visit instead of using
   * maybeSingle() across all matching rows, because repeatable visits mean
   * multiple rows may now exist for this user and venue.
   */
  const {
    data: existingVisit,
    error: existingVisitError,
  } = await supabase
    .from('venue_visits')
    .select(
      'id, rating, visited_at, visit_date, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .order('visited_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingVisitError) {
    console.error(
      '[venue-profile/check-in] Existing visit check failed:',
      existingVisitError
    )

    return NextResponse.json(
      { error: 'Could not verify visit status.' },
      { status: 500 }
    )
  }

  const alreadyVisited = Boolean(existingVisit)

  /*
   * Prevent more than one successful check-in for the same venue-local day.
   *
   * The database unique index remains the final protection against two
   * simultaneous requests, but this check lets us return a clear response
   * before attempting the insert.
   */
  const {
    data: existingVisitToday,
    error: existingVisitTodayError,
  } = await supabase
    .from('venue_visits')
    .select(
      'id, rating, visited_at, visit_date, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .eq('visit_date', visitDate)
    .limit(1)
    .maybeSingle()

  if (existingVisitTodayError) {
    console.error(
      '[venue-profile/check-in] Daily visit check failed:',
      existingVisitTodayError
    )

    return NextResponse.json(
      { error: 'Could not verify today’s check-in status.' },
      { status: 500 }
    )
  }

  if (existingVisitToday) {
    return NextResponse.json(
      {
        error:
          'You have already checked in at this venue today.',
        visited: true,
        visitedToday: true,
        hasEverVisited: true,
        hasVisitedToday: true,
        alreadyVisited: true,
        firstVisit: false,
        visit: existingVisitToday,
        xpEarned: 0,
        geoVerified: true,
        proofSource: 'venue_visits',
        distanceMeters:
          Math.round(geoResult.distanceMeters),
        visitDate,
        venueTimeZone,
      },
      { status: 409 }
    )
  }

  /*
   * Every eligible check-in now creates a new historical visit row.
   *
   * Ratings are intentionally omitted so repeat visits cannot overwrite the
   * user's existing venue rating.
   */
  const {
    data: visit,
    error: insertError,
  } = await supabase
    .from('venue_visits')
    .insert({
      user_id: user.id,
      venue_id: venueId,
      visited_at: now,
      visit_date: visitDate,
      user_lat: userLat,
      user_lon: userLon,
      distance_meters:
        geoResult.distanceMeters,
      location_accuracy_meters:
        locationAccuracyMeters,
      geo_verified: true,
      check_in_source:
        checkInSource,
      device_timestamp:
        deviceTimestamp,
      updated_at: now,
    } as any)
    .select(
      'id, rating, visited_at, visit_date, created_at, updated_at'
    )
    .single()

  if (
    insertError ||
    !visit
  ) {
    /*
     * PostgreSQL error 23505 means the unique daily constraint rejected a
     * concurrent or duplicate same-day check-in.
     */
    if (
      insertError?.code ===
      '23505'
    ) {
      return NextResponse.json(
        {
          error:
            'You have already checked in at this venue today.',
          visited: true,
          visitedToday: true,
          hasEverVisited: true,
          hasVisitedToday: true,
          alreadyVisited: true,
          firstVisit: false,
          xpEarned: 0,
          geoVerified: true,
          proofSource:
            'venue_visits',
          distanceMeters:
            Math.round(
              geoResult.distanceMeters
            ),
          visitDate,
          venueTimeZone,
        },
        { status: 409 }
      )
    }

    console.error(
      '[venue-profile/check-in] Visit insert failed:',
      insertError
    )

    return NextResponse.json(
      {
        error:
          'Failed to save check-in.',
      },
      { status: 500 }
    )
  }

  const xpEarned =
    alreadyVisited
      ? 0
      : source ===
          'property_guide'
        ? PROPERTY_GUIDE_SINGLE_VENUE_XP
        : GENERIC_SINGLE_VENUE_XP

  if (xpEarned > 0) {
    const eventType =
      source ===
      'property_guide'
        ? 'property_guide_single_venue_check_in'
        : 'single_venue_check_in'

    const {
      error: xpError,
    } = await supabase
      .from('event_xp_ledger')
      .upsert(
        {
          user_id:
            user.id,

          event_type:
            eventType,

          xp:
            xpEarned,

          source,

          source_id:
            propertyId,

          venue_id:
            venueId,

          metadata: {
            city:
              city ??
              geoResult.venue
                .city ??
              null,

            venue_id:
              venueId,

            venue_name:
              geoResult.venue
                .name ??
              null,

            property_id:
              propertyId,

            property_slug:
              propertySlug,

            property_name:
              propertyName,

            geo_verified:
              true,

            distance_meters:
              Math.round(
                geoResult.distanceMeters
              ),

            check_in_source:
              checkInSource,

            visit_date:
              visitDate,

            venue_timezone:
              venueTimeZone,
          },

          created_at:
            now,
        } as any,
        {
          onConflict:
            'user_id,event_type,venue_id,source_id',
        }
      )

    if (xpError) {
      console.error(
        '[venue-profile/check-in] XP ledger insert failed:',
        xpError
      )
    }
  }

  await refreshPublicPassportStats(
    user.id
  )

  return NextResponse.json({
    visited: true,
    visitedToday: true,
    hasEverVisited: true,
    hasVisitedToday: true,
    alreadyVisited,
    firstVisit:
      !alreadyVisited,
    visit,
    rating:
      existingVisit?.rating ??
      null,
    xpEarned,
    geoVerified: true,
    proofSource:
      'venue_visits',
    distanceMeters:
      Math.round(
        geoResult.distanceMeters
      ),
    visitDate,
    venueTimeZone,
  })
}