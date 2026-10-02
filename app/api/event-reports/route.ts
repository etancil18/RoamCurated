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
// Community Signals — event report writer
//
// event_report = observation / claim
//
// This route MUST NOT:
// - create or update events
// - create or update venue_visits
// - create or update event_checkins
// - create or update event_interests
// - touch Active Flow progress
//
// Canonicalization happens later.
// ============================================================


const MAX_TITLE_LENGTH = 160
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_SOURCE_URL_LENGTH = 2048

const MAX_TAG_COUNT = 12
const MAX_TAG_LENGTH = 50

const MAX_REASONABLE_ACCURACY_METERS = 250

/**
 * Community reporting has different semantics from a venue check-in.
 *
 * This threshold establishes only whether proximity may strengthen
 * the observation. Being outside it does NOT prevent reporting.
 *
 * Do not reuse venue-visit/check-in semantics here.
 */
const REPORT_PROXIMITY_RADIUS_METERS = 250

const ALLOWED_ARCHETYPES = new Set([
  'social_sports',
  'music',
  'networking',
  'food_drink',
  'arts_culture',
  'wellness',
  'nightlife',
  'community',
  'comedy',
  'market',
  'other',
])

type EventReportBody = {
  venue_id?: unknown

  reported_title?: unknown
  reported_description?: unknown
  reported_starts_at?: unknown
  reported_ends_at?: unknown
  reported_tags?: unknown
  reported_archetype?: unknown

  observed_at?: unknown

  source_url?: unknown

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

function normalizeOptionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (normalized.length === 0) {
    return null
  }

  if (
    normalized.length >
    maxLength
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

function normalizeTags(
  value: unknown
): string[] | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  if (!Array.isArray(value)) {
    return null
  }

  if (
    value.length >
    MAX_TAG_COUNT
  ) {
    return null
  }

  const normalized: string[] = []

  for (const rawTag of value) {
    if (
      typeof rawTag !==
      'string'
    ) {
      return null
    }

    const tag =
      rawTag
        .trim()
        .toLowerCase()

    if (
      tag.length === 0 ||
      tag.length >
        MAX_TAG_LENGTH
    ) {
      return null
    }

    if (
      !normalized.includes(tag)
    ) {
      normalized.push(tag)
    }
  }

  return normalized
}

function normalizeArchetype(
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

  const normalized =
    value.trim()

  if (
    !ALLOWED_ARCHETYPES.has(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeSourceUrl(
  value: unknown
): string | null {
  const normalized =
    normalizeOptionalText(
      value,
      MAX_SOURCE_URL_LENGTH
    )

  if (!normalized) {
    return null
  }

  try {
    const url =
      new URL(normalized)

    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
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
  req: NextRequest
) {
  // ----------------------------------------------------------
  // 1. Authenticate through the user's normal RLS-bound client.
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
  // 2. Parse only an object payload.
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
    rawBody as EventReportBody

  // ----------------------------------------------------------
  // 3. Validate venue identity.
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
  // 4. Validate the raw observation.
  // ----------------------------------------------------------

  const reportedTitle =
    normalizeRequiredText(
      body.reported_title,
      MAX_TITLE_LENGTH
    )

  if (!reportedTitle) {
    return NextResponse.json(
      {
        error:
          'Report title is required and must be 160 characters or fewer.',
      },
      {
        status: 400,
      }
    )
  }

  const reportedDescription =
    normalizeOptionalText(
      body.reported_description,
      MAX_DESCRIPTION_LENGTH
    )

  if (
    body.reported_description !==
      undefined &&
    body.reported_description !==
      null &&
    typeof body.reported_description !==
      'string'
  ) {
    return NextResponse.json(
      {
        error:
          'Report description is invalid.',
      },
      {
        status: 400,
      }
    )
  }

  if (
    typeof body.reported_description ===
      'string' &&
    body.reported_description
      .trim()
      .length >
      MAX_DESCRIPTION_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          'Report description is too long.',
      },
      {
        status: 400,
      }
    )
  }

  const reportedStartsAt =
    normalizeOptionalTimestamp(
      body.reported_starts_at
    )

  if (
    body.reported_starts_at !==
      undefined &&
    body.reported_starts_at !==
      null &&
    body.reported_starts_at !==
      '' &&
    !reportedStartsAt
  ) {
    return NextResponse.json(
      {
        error:
          'Reported start time is invalid.',
      },
      {
        status: 400,
      }
    )
  }

  const reportedEndsAt =
    normalizeOptionalTimestamp(
      body.reported_ends_at
    )

  if (
    body.reported_ends_at !==
      undefined &&
    body.reported_ends_at !==
      null &&
    body.reported_ends_at !==
      '' &&
    !reportedEndsAt
  ) {
    return NextResponse.json(
      {
        error:
          'Reported end time is invalid.',
      },
      {
        status: 400,
      }
    )
  }

  if (
    reportedStartsAt &&
    reportedEndsAt &&
    new Date(
      reportedEndsAt
    ).getTime() <=
      new Date(
        reportedStartsAt
      ).getTime()
  ) {
    return NextResponse.json(
      {
        error:
          'Reported end time must be after the reported start time.',
      },
      {
        status: 400,
      }
    )
  }

  const reportedTags =
    normalizeTags(
      body.reported_tags
    )

  if (
    body.reported_tags !==
      undefined &&
    body.reported_tags !==
      null &&
    reportedTags === null
  ) {
    return NextResponse.json(
      {
        error:
          'Reported tags are invalid.',
      },
      {
        status: 400,
      }
    )
  }

  const reportedArchetype =
    normalizeArchetype(
      body.reported_archetype
    )

  if (
    body.reported_archetype !==
      undefined &&
    body.reported_archetype !==
      null &&
    body.reported_archetype !==
      '' &&
    !reportedArchetype
  ) {
    return NextResponse.json(
      {
        error:
          'Reported archetype is invalid.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 5. Validate observation time.
  //
  // If omitted, server receipt time becomes the observation time.
  // ----------------------------------------------------------

  const now =
    new Date()

  let observedAt =
    now.toISOString()

  if (
    body.observed_at !==
      undefined &&
    body.observed_at !==
      null &&
    body.observed_at !==
      ''
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

    /**
     * Do not allow a client to claim an observation materially
     * in the future.
     *
     * Five minutes tolerates ordinary device clock skew.
     */
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
  // 6. Validate optional external source.
  // ----------------------------------------------------------

  const sourceUrl =
    normalizeSourceUrl(
      body.source_url
    )

  if (
    body.source_url !==
      undefined &&
    body.source_url !==
      null &&
    body.source_url !==
      '' &&
    !sourceUrl
  ) {
    return NextResponse.json(
      {
        error:
          'Source URL must be a valid HTTP or HTTPS URL.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 7. Fetch venue through the authenticated client.
  //
  // This proves the referenced venue exists and gives us the
  // canonical coordinates used for proximity calculation.
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
      '[event-reports][POST] Venue lookup failed:',
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
  // 8. Evaluate optional proximity evidence.
  //
  // IMPORTANT:
  // Failure to verify proximity does NOT reject the report.
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
        locationAccuracyMeters ===
          null ||
        locationAccuracyMeters <=
          MAX_REASONABLE_ACCURACY_METERS

      proximityVerified =
        accuracyIsUsable &&
        distanceMeters <=
          REPORT_PROXIMITY_RADIUS_METERS
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
  // 9. Trusted insert.
  //
  // From this point onward the client has no authority over:
  //
  // reporter_user_id
  // report_source
  // evidence_metadata
  // distance_meters
  // proximity_verified
  // event_id
  // resolution state
  // moderation state
  //
  // Service role is used ONLY after normal user authentication
  // and validation have completed.
  // ----------------------------------------------------------

  const supabaseAdmin =
    getSupabaseAdmin()

  const {
    data: report,
    error: insertError,
  } =
    await supabaseAdmin
      .from(
        'event_reports'
      )
      .insert({
        reporter_user_id:
          user.id,

        venue_id:
          venue.id,

        reported_title:
          reportedTitle,

        reported_description:
          reportedDescription,

        reported_starts_at:
          reportedStartsAt,

        reported_ends_at:
          reportedEndsAt,

        reported_tags:
          reportedTags,

        reported_archetype:
          reportedArchetype,

        observed_at:
          observedAt,

        report_source:
          'community',

        source_url:
          sourceUrl,

        /**
         * Reserved for trusted server-generated evidence.
         * Do not pass arbitrary client JSON through here.
         */
        evidence_metadata:
          {},

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

        /**
         * Canonicalization does NOT happen during submission.
         */
        event_id:
          null,

        resolution_status:
          'pending',

        resolved_at:
          null,

        resolved_by:
          null,

        resolution_reason:
          null,

        moderation_status:
          'pending',
      })
      .select(`
        id,
        venue_id,
        reported_title,
        reported_description,
        reported_starts_at,
        reported_ends_at,
        reported_tags,
        reported_archetype,
        observed_at,
        source_url,
        proximity_verified,
        resolution_status,
        moderation_status,
        created_at
      `)
      .single()

  if (insertError) {
    console.error(
      '[event-reports][POST] Insert failed:',
      {
        userId:
          user.id,
        venueId:
          venue.id,
        error:
          insertError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Failed to submit event report.',
      },
      {
        status: 500,
      }
    )
  }

  // ----------------------------------------------------------
  // 10. Establish occurrence membership.
  //
  // Occurrence establishment is intentionally delegated to one
  // transactional database boundary.
  //
  // The RPC:
  //
  // - locks the report
  // - serializes establishment for this venue
  // - rechecks candidates after acquiring the venue lock
  // - creates a new occurrence when no candidate exists
  // - attaches to exactly one strong candidate
  // - preserves ambiguity for possible / weak candidates or
  //   multiple strong candidates
  //
  // This closes the concurrent first-report race where two
  // independent requests could previously both observe zero
  // candidates and create separate occurrences.
  //
  // This step does NOT canonicalize an event and does NOT
  // mutate report resolution state.
  // ----------------------------------------------------------

  const {
    error: establishmentError,
  } =
    await supabaseAdmin.rpc(
      'establish_event_occurrence_for_report',
      {
        p_report_id:
          report.id,

        p_time_window_minutes:
          120,

        p_observation_window_minutes:
          60,

        p_limit:
          10,
      }
    )

  if (establishmentError) {
    console.error(
      '[event-reports][POST] Occurrence establishment failed:',
      {
        userId:
          user.id,
        reportId:
          report.id,
        venueId:
          venue.id,
        error:
          establishmentError,
      }
    )

    /**
     * The report itself was successfully persisted.
     *
     * Do not convert an occurrence-establishment failure into
     * a failed submission response. Doing so could encourage
     * the client to retry an observation that already exists.
     *
     * The persisted pending report remains available for later
     * repair / processing.
     */
  }


  // ----------------------------------------------------------
  // 11. Return a deliberately limited representation.
  //
  // Raw user coordinates and internal trust fields are not
  // echoed back unnecessarily.
  // ----------------------------------------------------------

  return NextResponse.json(
    {
      report,
    },
    {
      status: 201,
    }
  )
}


// ============================================================
// Community Signals — authenticated report reader
//
// Returns only the authenticated user's own reports.
//
// Reads deliberately use the normal RLS-bound Supabase client,
// NOT the service-role client.
//
// The API projection intentionally excludes private/internal
// evidence including:
// - reporter_user_id
// - user_lat
// - user_lon
// - location_accuracy_meters
// - distance_meters
// - evidence_metadata
// - resolved_by
// - resolution_reason
//
// event_id is intentionally exposed once a report is resolved
// so the client can understand which canonical event the report
// contributed to.
// ============================================================

const DEFAULT_REPORT_LIMIT = 25
const MAX_REPORT_LIMIT = 50

function parseReportLimit(
  value: string | null
): number {
  if (!value) {
    return DEFAULT_REPORT_LIMIT
  }

  const parsed =
    Number.parseInt(
      value,
      10
    )

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return DEFAULT_REPORT_LIMIT
  }

  return Math.min(
    parsed,
    MAX_REPORT_LIMIT
  )
}

export async function GET(
  req: NextRequest
) {
  // ----------------------------------------------------------
  // 1. Authenticate through the user's normal RLS-bound client.
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
  // 2. Parse bounded pagination.
  //
  // v1 intentionally supports only a bounded limit.
  // Cursor pagination can be added when actual product usage
  // requires it.
  // ----------------------------------------------------------

  const url =
    new URL(req.url)

  const limit =
    parseReportLimit(
      url.searchParams.get(
        'limit'
      )
    )


  // ----------------------------------------------------------
  // 3. Read through RLS.
  //
  // Do NOT use getSupabaseAdmin() here.
  //
  // event_reports_select_own enforces:
  // auth.uid() = reporter_user_id
  //
  // The explicit projection is also a privacy boundary.
  // ----------------------------------------------------------

  const {
    data: reports,
    error,
  } =
    await supabase
      .from(
        'event_reports'
      )
      .select(`
        id,
        venue_id,
        reported_title,
        reported_description,
        reported_starts_at,
        reported_ends_at,
        reported_tags,
        reported_archetype,
        observed_at,
        source_url,
        proximity_verified,
        event_id,
        resolution_status,
        moderation_status,
        created_at,
        updated_at
      `)
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(limit)

  if (error) {
    console.error(
      '[event-reports][GET] Read failed:',
      {
        userId:
          user.id,
        error,
      }
    )

    return NextResponse.json(
      {
        error:
          'Failed to load event reports.',
      },
      {
        status: 500,
      }
    )
  }


  // ----------------------------------------------------------
  // 4. Return a stable, deliberately limited representation.
  // ----------------------------------------------------------

  return NextResponse.json(
    {
      reports:
        reports ?? [],
    },
    {
      status: 200,
    }
  )
}