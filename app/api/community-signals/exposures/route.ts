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
// 026E — Community Signal exposure collector
//
// Exposure = presentation telemetry only.
//
// It MUST NOT:
// - create Community Signal evidence
// - change place truth
// - change occurrence confidence
// - change discovery eligibility
// - create visits or check-ins
// - create interests
// - change Active Flow
// - change City Market state
//
// Authentication is opportunistic.
// Anonymous exposure remains valid telemetry.
// ============================================================


const MAX_SIGNAL_KEY_LENGTH =
  220

const MAX_SESSION_TOKEN_LENGTH =
  100

const MAX_CITY_SLUG_LENGTH =
  100

const MAX_SNAPSHOT_BYTES =
  12_000


const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i


const ALLOWED_EXPOSURE_TYPES =
  new Set([
    'signal_impression',
  ])


const ALLOWED_SIGNAL_DOMAINS =
  new Set([
    'place_state',
    'happening',
  ])


const ALLOWED_SURFACES =
  new Set([
    'map_venue_preview',
  ])


const ALLOWED_PLACE_SIGNAL_TYPES =
  new Set([
    'line',
    'temporary_closure',
  ])


type ExposureBody = {
  client_event_id?: unknown

  exposure_type?: unknown

  signal_domain?: unknown
  signal_key?: unknown

  venue_id?: unknown

  occurrence_id?: unknown
  canonical_event_id?: unknown

  session_token?: unknown

  surface?: unknown

  city_slug?: unknown

  signal_state_snapshot?: unknown

  occurred_at?: unknown
}


type OccurrenceRow = {
  id: string
  venue_id: string
  resolved_event_id: string | null
}


function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}


function normalizeRequiredText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    normalized.length ===
      0 ||
    normalized.length >
      maxLength
  ) {
    return null
  }

  return normalized
}


function normalizeOptionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }

  return normalizeRequiredText(
    value,
    maxLength
  )
}


function normalizeUuid(
  value: unknown
): string | null {
  const normalized =
    normalizeRequiredText(
      value,
      100
    )

  if (
    !normalized ||
    !UUID_PATTERN.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}


function normalizeTimestamp(
  value: unknown
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const parsed =
    new Date(
      value
    )

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null
  }

  return parsed.toISOString()
}


export async function POST(
  req: NextRequest
) {
  // ----------------------------------------------------------
  // 1. Resolve viewer identity when available.
  //
  // Exposure does NOT require authentication.
  // ----------------------------------------------------------

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()

  const viewerUserId =
    user?.id ??
    null


  // ----------------------------------------------------------
  // 2. Parse body.
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
    rawBody as
      ExposureBody


  // ----------------------------------------------------------
  // 3. Validate idempotency identity.
  // ----------------------------------------------------------

  const clientEventId =
    normalizeUuid(
      body.client_event_id
    )

  if (!clientEventId) {
    return NextResponse.json(
      {
        error:
          'client_event_id is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 4. Validate event taxonomy.
  // ----------------------------------------------------------

  const exposureType =
    normalizeRequiredText(
      body.exposure_type,
      50
    )

  if (
    !exposureType ||
    !ALLOWED_EXPOSURE_TYPES.has(
      exposureType
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Exposure type is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  const signalDomain =
    normalizeRequiredText(
      body.signal_domain,
      50
    )

  if (
    !signalDomain ||
    !ALLOWED_SIGNAL_DOMAINS.has(
      signalDomain
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Signal domain is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  const signalKey =
    normalizeRequiredText(
      body.signal_key,
      MAX_SIGNAL_KEY_LENGTH
    )

  if (!signalKey) {
    return NextResponse.json(
      {
        error:
          'Signal key is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  const surface =
    normalizeRequiredText(
      body.surface,
      80
    )

  if (
    !surface ||
    !ALLOWED_SURFACES.has(
      surface
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Exposure surface is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 5. Validate client chronology.
  // ----------------------------------------------------------

  const occurredAt =
    normalizeTimestamp(
      body.occurred_at
    )

  if (!occurredAt) {
    return NextResponse.json(
      {
        error:
          'Exposure time is invalid.',
      },
      {
        status: 400,
      }
    )
  }

  const now =
    Date.now()

  const occurredAtMs =
    new Date(
      occurredAt
    ).getTime()

  const futureToleranceMs =
    5 * 60 * 1000

  if (
    occurredAtMs >
    now +
      futureToleranceMs
  ) {
    return NextResponse.json(
      {
        error:
          'Exposure time cannot be in the future.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 6. Validate optional pseudonymous context.
  // ----------------------------------------------------------

  const sessionToken =
    normalizeOptionalText(
      body.session_token,
      MAX_SESSION_TOKEN_LENGTH
    )

  const citySlug =
    normalizeOptionalText(
      body.city_slug,
      MAX_CITY_SLUG_LENGTH
    )


  // ----------------------------------------------------------
  // 7. Validate immutable presentation snapshot.
  // ----------------------------------------------------------

  if (
    !isRecord(
      body.signal_state_snapshot
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Signal state snapshot must be an object.',
      },
      {
        status: 400,
      }
    )
  }

  const signalStateSnapshot =
    body.signal_state_snapshot

  const snapshotBytes =
    new TextEncoder()
      .encode(
        JSON.stringify(
          signalStateSnapshot
        )
      )
      .byteLength

  if (
    snapshotBytes >
    MAX_SNAPSHOT_BYTES
  ) {
    return NextResponse.json(
      {
        error:
          'Signal state snapshot is too large.',
      },
      {
        status: 413,
      }
    )
  }


  // ----------------------------------------------------------
  // 8. Resolve domain-specific identity.
  //
  // Happening venue/canonical linkage comes from the server.
  // The client cannot authoritatively declare those relationships.
  // ----------------------------------------------------------

  const supabaseAdmin =
    getSupabaseAdmin()

  let venueId:
    string

  let occurrenceId:
    string | null =
      null

  let canonicalEventId:
    string | null =
      null


  if (
    signalDomain ===
      'place_state'
  ) {
    const rawVenueId =
      normalizeUuid(
        body.venue_id
      )

    if (!rawVenueId) {
      return NextResponse.json(
        {
          error:
            'Venue is invalid.',
        },
        {
          status: 400,
        }
      )
    }

    const prefix =
      `place:${rawVenueId}:`

    if (
      !signalKey.startsWith(
        prefix
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Place signal identity is inconsistent.',
        },
        {
          status: 400,
        }
      )
    }

    const signalType =
      signalKey.slice(
        prefix.length
      )

    if (
      !ALLOWED_PLACE_SIGNAL_TYPES.has(
        signalType
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Place signal type is invalid.',
        },
        {
          status: 400,
        }
      )
    }

    venueId =
      rawVenueId
  } else {
    occurrenceId =
      normalizeUuid(
        body.occurrence_id
      )

    if (!occurrenceId) {
      return NextResponse.json(
        {
          error:
            'Occurrence is invalid.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      signalKey !==
      `occurrence:${occurrenceId}`
    ) {
      return NextResponse.json(
        {
          error:
            'Happening signal identity is inconsistent.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: occurrence,
      error:
        occurrenceError,
    } =
      await supabaseAdmin
        .from(
          'event_occurrences'
        )
        .select(`
          id,
          venue_id,
          resolved_event_id
        `)
        .eq(
          'id',
          occurrenceId
        )
        .maybeSingle<OccurrenceRow>()

    if (
      occurrenceError
    ) {
      console.error(
        '[community-signal-exposures][POST] Occurrence lookup failed:',
        {
          occurrenceId,
          viewerUserId,
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

    venueId =
      occurrence.venue_id

    canonicalEventId =
      occurrence
        .resolved_event_id
  }


  // ----------------------------------------------------------
  // 9. Trusted telemetry insert.
  //
  // Server owns:
  // - viewer_user_id
  // - received_at
  // - happening venue linkage
  // - happening canonical-event linkage
  //
  // Idempotency is client_event_id.
  // ----------------------------------------------------------

  const {
    error: insertError,
  } =
    await supabaseAdmin
      .from(
        'community_signal_exposure_events'
      )
      .upsert(
        {
          client_event_id:
            clientEventId,

          exposure_type:
            exposureType,

          signal_domain:
            signalDomain,

          signal_key:
            signalKey,

          venue_id:
            venueId,

          occurrence_id:
            occurrenceId,

          canonical_event_id:
            canonicalEventId,

          viewer_user_id:
            viewerUserId,

          session_token:
            sessionToken,

          surface,

          city_slug:
            citySlug,

          flow_id:
            null,

          route_stop_id:
            null,

          experiment_key:
            null,

          experiment_variant:
            null,

          signal_state_snapshot:
            signalStateSnapshot,

          occurred_at:
            occurredAt,

          metadata: {
            collector_version:
              'community_signal_exposure_collector_v1',

            identity_basis:
              signalDomain ===
                'happening'
                ? 'server_resolved_occurrence_linkage'
                : 'validated_place_signal_key',

            viewer_basis:
              viewerUserId
                ? 'authenticated_user'
                : 'anonymous',
          },
        },
        {
          onConflict:
            'client_event_id',

          ignoreDuplicates:
            true,
        }
      )

  if (insertError) {
    console.error(
      '[community-signal-exposures][POST] Insert failed:',
      {
        clientEventId,
        signalDomain,
        signalKey,
        viewerUserId,
        error:
          insertError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Failed to record exposure.',
      },
      {
        status: 500,
      }
    )
  }


  // ----------------------------------------------------------
  // 10. Deliberately minimal response.
  // ----------------------------------------------------------

  return NextResponse.json(
    {
      accepted: true,
    },
    {
      status: 202,
    }
  )
}