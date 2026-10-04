import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  supabaseServerApi,
} from '@/lib/supabase/server-api'


// ============================================================
// Community Signals V2 — simple place-signal writer
//
// A place signal is a lightweight, time-sensitive observation
// about a venue.
//
// Initial V2 signals:
//
// line
//   present / absent
//
// temporary_closure
//   present / absent
//
// This route MUST NOT:
//
// - create or update events
// - create event occurrences
// - create event reports
// - create venue visits
// - create event check-ins / participation
// - create event interests
// - mutate Active Flow stops
// - mutate Active Flow progress
// - infer current signal truth
// - calculate confidence
// - calculate freshness / expiry
//
// Current belief is derived later from observation evidence.
// ============================================================


const MAX_REASONABLE_ACCURACY_METERS =
  250

/**
 * Proximity strengthens an observation.
 *
 * It is NOT required to submit a signal and is NOT proof of
 * venue visitation or event participation.
 */
const SIGNAL_PROXIMITY_RADIUS_METERS =
  250


const ALLOWED_SIGNAL_TYPES =
  new Set([
    'line',
    'temporary_closure',
  ])


const ALLOWED_SIGNAL_STATES =
  new Set([
    'present',
    'absent',
  ])


type CommunityPlaceSignalBody = {
  venue_id?: unknown

  signal_type?: unknown
  signal_state?: unknown

  observed_at?: unknown

  user_lat?: unknown
  user_lon?: unknown
  location_accuracy_meters?: unknown
}


type VenueRow = {
  id: string
  lat: number | null
  lon: number | null
}


function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}


function normalizeRequiredText(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (
    normalized.length === 0 ||
    normalized.length > maxLength
  ) {
    return null
  }

  return normalized
}


function normalizeSignalType(
  value: unknown
): 'line' | 'temporary_closure' | null {
  const normalized =
    normalizeRequiredText(
      value,
      50
    )

  if (
    !normalized ||
    !ALLOWED_SIGNAL_TYPES.has(
      normalized
    )
  ) {
    return null
  }

  return normalized as
    | 'line'
    | 'temporary_closure'
}


function normalizeSignalState(
  value: unknown
): 'present' | 'absent' | null {
  const normalized =
    normalizeRequiredText(
      value,
      20
    )

  if (
    !normalized ||
    !ALLOWED_SIGNAL_STATES.has(
      normalized
    )
  ) {
    return null
  }

  return normalized as
    | 'present'
    | 'absent'
}


function normalizeOptionalTimestamp(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const timestamp =
    Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}


function isValidLatitude(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  )
}


function isValidLongitude(
  value: unknown
): value is number {
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
}): number {
  const earthRadiusMeters =
    6_371_000

  const toRadians = (
    degrees: number
  ) =>
    (
      degrees *
      Math.PI
    ) /
    180

  const lat1 =
    toRadians(
      fromLat
    )

  const lat2 =
    toRadians(
      toLat
    )

  const deltaLat =
    toRadians(
      toLat -
        fromLat
    )

  const deltaLon =
    toRadians(
      toLon -
        fromLon
    )

  const a =
    Math.sin(
      deltaLat / 2
    ) **
      2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(
        deltaLon / 2
      ) **
        2

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

  return (
    earthRadiusMeters *
    c
  )
}


export async function POST(
  req: NextRequest
) {
  // ----------------------------------------------------------
  // 1. Authenticate through normal user authority.
  // ----------------------------------------------------------

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
    error: authError,
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


  // ----------------------------------------------------------
  // 2. Parse object payload.
  // ----------------------------------------------------------

  const rawBody =
    await req
      .json()
      .catch(
        () => null
      )

  if (
    !isRecord(
      rawBody
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Invalid request body.',
      },
      {
        status: 400,
      }
    )
  }

  const body =
    rawBody as CommunityPlaceSignalBody


  // ----------------------------------------------------------
  // 3. Validate venue.
  // ----------------------------------------------------------

  const venueId =
    normalizeRequiredText(
      body.venue_id,
      100
    )

  if (!venueId) {
    return NextResponse.json(
      {
        error:
          'A venue is required.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 4. Validate tiny signal vocabulary.
  // ----------------------------------------------------------

  const signalType =
    normalizeSignalType(
      body.signal_type
    )

  if (!signalType) {
    return NextResponse.json(
      {
        error:
          'Signal type is invalid.',
      },
      {
        status: 400,
      }
    )
  }

  const signalState =
    normalizeSignalState(
      body.signal_state
    )

  if (!signalState) {
    return NextResponse.json(
      {
        error:
          'Signal state is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 5. Observation time.
  //
  // Omitted => server receipt time.
  // ----------------------------------------------------------

  const now =
    new Date()

  let observedAt =
    now.toISOString()

  if (
    body.observed_at !== undefined &&
    body.observed_at !== null &&
    body.observed_at !== ''
  ) {
    const normalizedObservedAt =
      normalizeOptionalTimestamp(
        body.observed_at
      )

    if (
      !normalizedObservedAt
    ) {
      return NextResponse.json(
        {
          error:
            'Observation time is invalid.',
        },
        {
          status: 400,
        }
      )
    }

    const futureToleranceMs =
      5 *
      60 *
      1000

    if (
      new Date(
        normalizedObservedAt
      ).getTime() >
      now.getTime() +
        futureToleranceMs
    ) {
      return NextResponse.json(
        {
          error:
            'Observation time cannot be in the future.',
        },
        {
          status: 400,
        }
      )
    }

    observedAt =
      normalizedObservedAt
  }


  // ----------------------------------------------------------
  // 6. Validate venue through authenticated read authority.
  // ----------------------------------------------------------

  const {
    data: venue,
    error: venueError,
  } =
    await supabase
      .from('venues')
      .select(
        'id, lat, lon'
      )
      .eq(
        'id',
        venueId
      )
      .maybeSingle<VenueRow>()

  if (venueError) {
    console.error(
      '[community-signals/place][POST] Venue lookup failed:',
      {
        venueId,
        userId:
          user.id,
        error:
          venueError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Could not validate venue.',
      },
      {
        status: 500,
      }
    )
  }

  if (!venue) {
    return NextResponse.json(
      {
        error:
          'Venue not found.',
      },
      {
        status: 404,
      }
    )
  }


  // ----------------------------------------------------------
  // 7. Optional proximity evidence.
  //
  // Failure to verify proximity does NOT reject the signal.
  // Proximity does NOT create venue_visit or participation.
  // ----------------------------------------------------------

  let userLat:
    number | null =
      null

  let userLon:
    number | null =
      null

  let locationAccuracyMeters:
    number | null =
      null

  let distanceMeters:
    number | null =
      null

  let proximityVerified =
    false

  const hasAnyCoordinate =
    body.user_lat !==
      undefined ||
    body.user_lon !==
      undefined

  if (hasAnyCoordinate) {
    if (
      !isValidLatitude(
        body.user_lat
      ) ||
      !isValidLongitude(
        body.user_lon
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Location coordinates are invalid.',
        },
        {
          status: 400,
        }
      )
    }

    userLat =
      body.user_lat

    userLon =
      body.user_lon

    if (
      body.location_accuracy_meters !==
        undefined &&
      body.location_accuracy_meters !==
        null
    ) {
      if (
        typeof body.location_accuracy_meters !==
          'number' ||
        !Number.isFinite(
          body.location_accuracy_meters
        ) ||
        body.location_accuracy_meters <
          0
      ) {
        return NextResponse.json(
          {
            error:
              'Location accuracy is invalid.',
          },
          {
            status: 400,
          }
        )
      }

      locationAccuracyMeters =
        body.location_accuracy_meters
    }

    if (
      isValidLatitude(
        venue.lat
      ) &&
      isValidLongitude(
        venue.lon
      )
    ) {
      distanceMeters =
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

      /**
       * Keep the same evidence discipline as Community Event
       * reporting: useful device accuracy is required before
       * proximity can be marked verified.
       *
       * If the client did not provide accuracy, distance may still
       * be recorded but proximity is not promoted to verified.
       */
      const accuracyIsUsable =
        locationAccuracyMeters !==
          null &&
        locationAccuracyMeters <=
          MAX_REASONABLE_ACCURACY_METERS

      proximityVerified =
        accuracyIsUsable &&
        distanceMeters <=
          SIGNAL_PROXIMITY_RADIUS_METERS
    }
  } else if (
    body.location_accuracy_meters !==
      undefined &&
    body.location_accuracy_meters !==
      null
  ) {
    return NextResponse.json(
      {
        error:
          'Location accuracy cannot be supplied without coordinates.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 8. Trusted append-only insert.
  //
  // Client has no authority over:
  //
  // reporter_user_id
  // report_source
  // distance_meters
  // proximity_verified
  // moderation_status
  //
  // No current-state/trust/freshness inference occurs here.
  // ----------------------------------------------------------

  const supabaseAdmin =
    getSupabaseAdmin()

  const {
    data: observation,
    error: insertError,
  } =
    await supabaseAdmin
      .from(
        'community_place_signal_observations'
      )
      .insert({
        reporter_user_id:
          user.id,

        venue_id:
          venue.id,

        signal_type:
          signalType,

        signal_state:
          signalState,

        observed_at:
          observedAt,

        report_source:
          'community',

        user_lat:
          userLat,

        user_lon:
          userLon,

        location_accuracy_meters:
          locationAccuracyMeters,

        distance_meters:
          distanceMeters,

        proximity_verified:
          proximityVerified,

        moderation_status:
          'pending',
      })
      .select(`
        id,
        venue_id,
        signal_type,
        signal_state,
        observed_at,
        proximity_verified,
        moderation_status,
        created_at
      `)
      .single()

  if (
    insertError ||
    !observation
  ) {
    console.error(
      '[community-signals/place][POST] Insert failed:',
      {
        userId:
          user.id,
        venueId:
          venue.id,
        signalType,
        signalState,
        error:
          insertError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Failed to submit signal.',
      },
      {
        status: 500,
      }
    )
  }


  return NextResponse.json(
    {
      observation,
    },
    {
      status: 201,
    }
  )
}