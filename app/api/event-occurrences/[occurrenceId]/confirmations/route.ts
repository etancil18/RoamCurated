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
// Community Signals — occurrence confirmation writer
//
// event_confirmation =
// "I independently observed this occurrence too."
//
// This route MUST NOT:
// - create or update events
// - create or update event_occurrences
// - create or update event_reports
// - create or update venue_visits
// - create or update event_checkins
// - create or update event_interests
// - touch Active Flow progress
// - calculate canonical confidence
//
// Confirmation is evidence only.
// ============================================================


const MAX_REASONABLE_ACCURACY_METERS = 250

/**
 * Same geographic radius used by event reporting.
 *
 * This establishes only whether client-supplied location
 * evidence is geographically consistent with the occurrence's
 * venue.
 *
 * It is NOT:
 * - proof of attendance
 * - proof of venue visit
 * - proof of genuine GPS
 * - event participation
 */
const CONFIRMATION_PROXIMITY_RADIUS_METERS = 250


type ConfirmationBody = {
  observed_at?: unknown

  user_lat?: unknown
  user_lon?: unknown
  location_accuracy_meters?: unknown
}


type OccurrenceRow = {
  id: string
  venue_id: string
  resolution_status: string
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

  const parsed =
    new Date(value)

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null
  }

  return parsed.toISOString()
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


function degreesToRadians(
  value: number
) {
  return (
    value *
    Math.PI /
    180
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
      toLat - fromLat
    )

  const deltaLonRad =
    degreesToRadians(
      toLon - fromLon
    )

  const a =
    Math.sin(
      deltaLatRad / 2
    ) *
      Math.sin(
        deltaLatRad / 2
      ) +
    Math.cos(
      fromLatRad
    ) *
      Math.cos(
        toLatRad
      ) *
      Math.sin(
        deltaLonRad / 2
      ) *
      Math.sin(
        deltaLonRad / 2
      )

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
  req: NextRequest,
  context: {
    params: Promise<{
      occurrenceId: string
    }>
  }
) {
  // ----------------------------------------------------------
  // 1. Authenticate through the user's normal client.
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
  // 2. Validate occurrence identity from the route.
  // ----------------------------------------------------------

  const {
    occurrenceId: rawOccurrenceId,
  } =
    await context.params

  const occurrenceId =
    normalizeRequiredText(
      rawOccurrenceId,
      100
    )

  if (!occurrenceId) {
    return NextResponse.json(
      {
        error:
          'Occurrence is required.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 3. Parse only an object payload.
  // ----------------------------------------------------------

  const rawBody =
    await req
      .json()
      .catch(
        () => null
      )

  if (
    !isRecord(rawBody)
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
    rawBody as ConfirmationBody


  // ----------------------------------------------------------
  // 4. Validate observation time.
  //
  // If omitted, server receipt time becomes observation time.
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
      5 * 60 * 1000

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
  // 5. Load occurrence through the service-role client.
  //
  // event_occurrences intentionally has RLS enabled with zero
  // client policies. It is an internal interpretation primitive.
  //
  // Service-role use here does NOT authorize the user. The user
  // was authenticated above; this lookup validates an internal
  // server-owned target.
  // ----------------------------------------------------------

  const supabaseAdmin =
    getSupabaseAdmin()

  const {
    data: occurrence,
    error: occurrenceError,
  } =
    await supabaseAdmin
      .from(
        'event_occurrences'
      )
      .select(`
        id,
        venue_id,
        resolution_status
      `)
      .eq(
        'id',
        occurrenceId
      )
      .maybeSingle<OccurrenceRow>()

  if (occurrenceError) {
    console.error(
      '[event-confirmations][POST] Occurrence lookup failed:',
      {
        occurrenceId,
        userId:
          user.id,
        error:
          occurrenceError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Could not validate occurrence.',
      },
      {
        status: 500,
      }
    )
  }

  if (!occurrence) {
    return NextResponse.json(
      {
        error:
          'Occurrence not found.',
      },
      {
        status: 404,
      }
    )
  }

  if (
    occurrence.resolution_status ===
    'rejected'
  ) {
    return NextResponse.json(
      {
        error:
          'This occurrence is no longer accepting community evidence.',
      },
      {
        status: 409,
      }
    )
  }


  // ----------------------------------------------------------
  // 6. Load the occurrence's canonical venue coordinates.
  // ----------------------------------------------------------

  const {
    data: venue,
    error: venueError,
  } =
    await supabaseAdmin
      .from('venues')
      .select(
        'id, lat, lon'
      )
      .eq(
        'id',
        occurrence.venue_id
      )
      .maybeSingle<VenueRow>()

  if (venueError) {
    console.error(
      '[event-confirmations][POST] Venue lookup failed:',
      {
        occurrenceId:
          occurrence.id,
        venueId:
          occurrence.venue_id,
        userId:
          user.id,
        error:
          venueError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Could not validate occurrence venue.',
      },
      {
        status: 500,
      }
    )
  }

  if (!venue) {
    console.error(
      '[event-confirmations][POST] Occurrence references missing venue:',
      {
        occurrenceId:
          occurrence.id,
        venueId:
          occurrence.venue_id,
        userId:
          user.id,
      }
    )

    return NextResponse.json(
      {
        error:
          'Could not validate occurrence venue.',
      },
      {
        status: 500,
      }
    )
  }


  // ----------------------------------------------------------
  // 7. Evaluate optional proximity evidence.
  //
  // IMPORTANT:
  // - lack of proximity does not reject confirmation
  // - coordinates without accuracy may still produce distance
  // - proximity_verified requires usable accuracy because the
  //   installed confirmation DB invariant requires it
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

      const accuracyIsUsable =
        locationAccuracyMeters !==
          null &&
        locationAccuracyMeters <=
          MAX_REASONABLE_ACCURACY_METERS

      proximityVerified =
        accuracyIsUsable &&
        distanceMeters <=
          CONFIRMATION_PROXIMITY_RADIUS_METERS
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
  // 8. Trusted insert.
  //
  // Client has no authority over:
  // - contributor_user_id
  // - evidence_source
  // - distance_meters
  // - proximity_verified
  // - moderation_status
  // ----------------------------------------------------------

  const {
    data: confirmation,
    error: insertError,
  } =
    await supabaseAdmin
      .from(
        'event_confirmations'
      )
      .insert({
        occurrence_id:
          occurrence.id,

        contributor_user_id:
          user.id,

        evidence_source:
          'community',

        observed_at:
          observedAt,

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
        occurrence_id,
        observed_at,
        proximity_verified,
        moderation_status,
        created_at
      `)
      .single()

  if (insertError) {
    /**
     * PostgreSQL unique_violation.
     *
     * One contributor may have at most one confirmation per
     * occurrence. Treat a repeated submission as an idempotent
     * request rather than evidence inflation.
     */
    if (
      insertError.code ===
      '23505'
    ) {
      const {
        data: existingConfirmation,
        error: existingError,
      } =
        await supabaseAdmin
          .from(
            'event_confirmations'
          )
          .select(`
            id,
            occurrence_id,
            observed_at,
            proximity_verified,
            moderation_status,
            created_at
          `)
          .eq(
            'occurrence_id',
            occurrence.id
          )
          .eq(
            'contributor_user_id',
            user.id
          )
          .maybeSingle()

      if (
        !existingError &&
        existingConfirmation
      ) {
        return NextResponse.json(
          {
            confirmation:
              existingConfirmation,
          },
          {
            status: 200,
          }
        )
      }
    }

    console.error(
      '[event-confirmations][POST] Insert failed:',
      {
        occurrenceId:
          occurrence.id,
        userId:
          user.id,
        error:
          insertError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Failed to submit confirmation.',
      },
      {
        status: 500,
      }
    )
  }


  // ----------------------------------------------------------
  // 9. Return deliberately limited evidence representation.
  //
  // Raw coordinates, accuracy, distance, contributor identity,
  // and internal provenance are not echoed back.
  // ----------------------------------------------------------

  return NextResponse.json(
    {
      confirmation,
    },
    {
      status: 201,
    }
  )
}