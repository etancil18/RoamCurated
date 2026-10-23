
import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  rebuildPublicPassportStats,
} from '@/lib/passport/rebuildPublicPassportStats'

import {
  safelyRefreshCreatorReputation,
} from '@/lib/reputation/safelyRefreshCreatorReputation'

// ============================================================
// ROUTE CONTRACT
// ============================================================

type RouteContext = {
  params: Promise<{
    venueId: string
  }>
}

// ============================================================
// REQUEST CONTRACT
// ============================================================

type HistoricalVisitRequestBody = {
  user_id?: unknown
  visited_at?: unknown
  venue_timezone?: unknown
  reason?: unknown
}

// ============================================================
// RPC CONTRACT
// ============================================================

type HistoricalVisitRpcRow = {
  assertion_id: string
  venue_visit_id: string
  user_id: string
  venue_id: string
  visited_at: string
  visit_date: string
  geo_verified: boolean
  check_in_source: string
  created: boolean
}

// ============================================================
// ADMIN ACCESS
// ============================================================

const ALLOWED_ADMIN_EMAILS =
  new Set([
    'evantancil@gmail.com',
    'etancil92@gmail.com',
    'evantancil@roamcurated.com',
    'fyejono@gmail.com',
    'jonathangordon@roamcurated.com',
  ])

// ============================================================
// ROUTE
// ============================================================

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const routeParams =
        await context.params

        console.log(
        '[admin/venues/historical-visits] route params:',
        routeParams
        )

        const rawVenueId =
        typeof routeParams?.venueId ===
            'string'
            ? routeParams.venueId
            : ''

        const venueId =
        rawVenueId.trim()

        console.log(
        '[admin/venues/historical-visits] normalized venueId:',
        {
            rawVenueId,
            venueId,
            length:
            venueId.length,
            valid:
            isUuid(
                venueId
            ),
        }
        )

        if (
        !isUuid(
            venueId
        )
        ) {
      return NextResponse.json(
        {
          error:
            'Invalid venueId.',
        },
        {
          status: 400,
        }
      )
    }

    // =========================================================
    // AUTHENTICATE ADMIN
    // =========================================================

    const supabase =
      await createServerClient()

    const {
      data: {
        user,
      },
      error:
        authError,
    } =
      await supabase.auth.getUser()

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'User not authenticated.',
        },
        {
          status: 401,
        }
      )
    }

    const normalizedEmail =
      user.email
        ?.trim()
        .toLowerCase() ??
      ''

    if (
      !normalizedEmail ||
      !ALLOWED_ADMIN_EMAILS.has(
        normalizedEmail
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Admin access required.',
        },
        {
          status: 403,
        }
      )
    }

    // =========================================================
    // REQUEST BODY
    // =========================================================

    let body:
      HistoricalVisitRequestBody

    try {
      body =
        (await request.json()) as
          HistoricalVisitRequestBody
    } catch {
      return NextResponse.json(
        {
          error:
            'Invalid JSON body.',
        },
        {
          status: 400,
        }
      )
    }

    const targetUserId =
      typeof body.user_id ===
        'string'
        ? body.user_id.trim()
        : ''

    const visitedAt =
      typeof body.visited_at ===
        'string'
        ? body.visited_at.trim()
        : ''

    const venueTimezone =
      typeof body.venue_timezone ===
        'string'
        ? body.venue_timezone.trim()
        : ''

    const reason =
      typeof body.reason ===
        'string'
        ? body.reason.trim()
        : ''

    // =========================================================
    // INPUT VALIDATION
    // =========================================================

    if (
      !isUuid(
        targetUserId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid user_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !visitedAt
    ) {
      return NextResponse.json(
        {
          error:
            'visited_at is required.',
        },
        {
          status: 400,
        }
      )
    }

    const parsedVisitedAt =
      new Date(
        visitedAt
      )

    if (
      Number.isNaN(
        parsedVisitedAt.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            'visited_at must be a valid timestamp.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      parsedVisitedAt.getTime() >=
      Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            'Historical visit must be in the past.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !venueTimezone
    ) {
      return NextResponse.json(
        {
          error:
            'venue_timezone is required.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !reason
    ) {
      return NextResponse.json(
        {
          error:
            'reason is required.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      reason.length >
      500
    ) {
      return NextResponse.json(
        {
          error:
            'reason must be 500 characters or fewer.',
        },
        {
          status: 400,
        }
      )
    }

// =========================================================
    // ATOMIC HISTORICAL VISIT WRITE
    //
    // IMPORTANT:
    //
    // Use the authenticated server client here.
    //
    // The SECURITY DEFINER RPC independently verifies:
    //
    //   auth.uid()
    //   auth.jwt()->>'email'
    //
    // so we must preserve the authenticated admin session rather
    // than calling this through a service-role-only client.
    //
    // The RPC atomically creates:
    //
    //   admin_historical_venue_visit_assertions
    //       +
    //   canonical venue_visits
    //
    // It does NOT create competition participation.
    // =========================================================

    const {
      data:
        rpcData,
      error:
        rpcError,
    } =
      await supabase.rpc(
        'create_admin_historical_venue_visit',
        {
          p_user_id:
            targetUserId,

          p_venue_id:
            venueId,

          p_visited_at:
            parsedVisitedAt.toISOString(),

          p_venue_timezone:
            venueTimezone,

          p_reason:
            reason,
        }
      )

    if (
      rpcError
    ) {
      console.error(
        '[admin/venues/historical-visits] Historical visit RPC failed:',
        {
          venueId,

          targetUserId,

          adminUserId:
            user.id,

          visitedAt:
            parsedVisitedAt.toISOString(),

          venueTimezone,

          code:
            rpcError.code,

          message:
            rpcError.message,

          details:
            rpcError.details,

          hint:
            rpcError.hint,
        }
      )

      return NextResponse.json(
        {
          error:
            mapHistoricalVisitRpcError(
              rpcError
            ),
        },
        {
          status:
            getHistoricalVisitRpcStatus(
              rpcError
            ),
        }
      )
    }

    const historicalVisit =
      readHistoricalVisitRpcRow(
        rpcData
      )

    if (
      !historicalVisit
    ) {
      console.error(
        '[admin/venues/historical-visits] Historical visit RPC returned invalid payload:',
        {
          venueId,

          targetUserId,

          adminUserId:
            user.id,

          rpcData,
        }
      )

      return NextResponse.json(
        {
          error:
            'Historical visit was written, but the database response was invalid.',
        },
        {
          status: 500,
        }
      )
    }

    // =========================================================
    // PASSPORT REBUILD
    //
    // venue_visits is now canonical.
    //
    // rebuildPublicPassportStats() uses its own trusted
    // service-role client and reads all geo_verified visits.
    //
    // Because admin_historical rows are intentionally
    // geo_verified=true, they participate normally in Passport
    // unique-venue XP.
    //
    // If this rebuild fails, the canonical visit remains safely
    // persisted. Retrying the same POST is safe because the RPC
    // is idempotent for the exact same historical visit and will
    // then retry this rebuild.
    // =========================================================

    try {
      await rebuildPublicPassportStats(
        targetUserId
      )
    } catch (
      passportError
    ) {
      console.error(
        '[admin/venues/historical-visits] Historical visit persisted but Passport rebuild failed:',
        {
          venueId,

          targetUserId,

          adminUserId:
            user.id,

          venueVisitId:
            historicalVisit.venue_visit_id,

          assertionId:
            historicalVisit.assertion_id,

          error:
            passportError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Historical visit was saved, but Passport stats could not be refreshed. Retry the same request.',

          historicalVisit:
            serializeHistoricalVisit(
              historicalVisit
            ),

          passportRebuilt:
            false,
        },
        {
          status: 500,
        }
      )
    }

    // =========================================================
    // CREATOR REPUTATION REFRESH
    //
    // The historical visit has persisted successfully.
    // Refresh the visited user's earned reputation when the
    // canonical visit is geo-verified.
    //
    // The RPC is idempotent, so a successful replay may also
    // repair stale reputation without creating another visit.
    //
    // Reputation refresh failures must not invalidate the
    // canonical historical visit or its Passport rebuild.
    // =========================================================

    if (historicalVisit.geo_verified) {
      const reputationRefresh =
        await safelyRefreshCreatorReputation(
          targetUserId,
          {
            mutation:
              'admin_historical_venue_visit',
          }
        )

      if (!reputationRefresh.ok) {
        console.error(
          '[admin/venues/historical-visits] Historical visit persisted but reputation refresh failed:',
          {
            venueId,

            targetUserId,

            venueVisitId:
              historicalVisit.venue_visit_id,

            stage:
              reputationRefresh.error.stage,

            message:
              reputationRefresh.error.message,
          }
        )
      }
    }

    // =========================================================
    // RESPONSE
    // =========================================================

    return NextResponse.json(
      {
        historicalVisit:
          serializeHistoricalVisit(
            historicalVisit
          ),

        passportRebuilt:
          true,
      },
      {
        status:
          historicalVisit.created
            ? 201
            : 200,
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[admin/venues/historical-visits] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error creating historical venue visit.',
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// RPC RESPONSE NORMALIZATION
// ============================================================

function readHistoricalVisitRpcRow(
  value: unknown
): HistoricalVisitRpcRow | null {
  const row =
    Array.isArray(
      value
    )
      ? value[0]
      : value

  if (
    !row ||
    typeof row !==
      'object'
  ) {
    return null
  }

  const record =
    row as Record<
      string,
      unknown
    >

  const assertionId =
    typeof record.assertion_id ===
      'string'
      ? record.assertion_id
      : null

  const venueVisitId =
    typeof record.venue_visit_id ===
      'string'
      ? record.venue_visit_id
      : null

  const userId =
    typeof record.user_id ===
      'string'
      ? record.user_id
      : null

  const venueId =
    typeof record.venue_id ===
      'string'
      ? record.venue_id
      : null

  const visitedAt =
    typeof record.visited_at ===
      'string'
      ? record.visited_at
      : null

  const visitDate =
    typeof record.visit_date ===
      'string'
      ? record.visit_date
      : null

  const geoVerified =
    typeof record.geo_verified ===
      'boolean'
      ? record.geo_verified
      : null

  const checkInSource =
    typeof record.check_in_source ===
      'string'
      ? record.check_in_source
      : null

  const created =
    typeof record.created ===
      'boolean'
      ? record.created
      : null

  if (
    !assertionId ||
    !venueVisitId ||
    !userId ||
    !venueId ||
    !visitedAt ||
    !visitDate ||
    geoVerified ===
      null ||
    !checkInSource ||
    created ===
      null
  ) {
    return null
  }

  return {
    assertion_id:
      assertionId,

    venue_visit_id:
      venueVisitId,

    user_id:
      userId,

    venue_id:
      venueId,

    visited_at:
      visitedAt,

    visit_date:
      visitDate,

    geo_verified:
      geoVerified,

    check_in_source:
      checkInSource,

    created,
  }
}

// ============================================================
// RESPONSE SERIALIZATION
// ============================================================

function serializeHistoricalVisit(
  row:
    HistoricalVisitRpcRow
) {
  return {
    assertionId:
      row.assertion_id,

    venueVisitId:
      row.venue_visit_id,

    userId:
      row.user_id,

    venueId:
      row.venue_id,

    visitedAt:
      row.visited_at,

    visitDate:
      row.visit_date,

    geoVerified:
      row.geo_verified,

    checkInSource:
      row.check_in_source,

    created:
      row.created,
  }
}

// ============================================================
// RPC ERROR MAPPING
// ============================================================

type SupabaseRpcError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function mapHistoricalVisitRpcError(
  error:
    SupabaseRpcError
): string {
  const message =
    error.message ??
    ''

  if (
    message.includes(
      'Authentication required.'
    )
  ) {
    return 'User not authenticated.'
  }

  if (
    message.includes(
      'Venue Admin authorization required.'
    )
  ) {
    return 'Admin access required.'
  }

  if (
    message.includes(
      'USER_ID_REQUIRED'
    )
  ) {
    return 'user_id is required.'
  }

  if (
    message.includes(
      'VENUE_ID_REQUIRED'
    )
  ) {
    return 'venueId is required.'
  }

  if (
    message.includes(
      'VISITED_AT_REQUIRED'
    )
  ) {
    return 'visited_at is required.'
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_MUST_BE_IN_THE_PAST'
    )
  ) {
    return 'Historical visit must be in the past.'
  }

  if (
    message.includes(
      'VENUE_TIMEZONE_REQUIRED'
    )
  ) {
    return 'venue_timezone is required.'
  }

  if (
    message.includes(
      'INVALID_VENUE_TIMEZONE'
    )
  ) {
    return 'venue_timezone must be a valid IANA timezone.'
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_REASON_REQUIRED'
    )
  ) {
    return 'reason is required.'
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_REASON_TOO_LONG'
    )
  ) {
    return 'reason must be 500 characters or fewer.'
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_USER_NOT_FOUND'
    )
  ) {
    return 'User not found.'
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_VENUE_NOT_FOUND'
    )
  ) {
    return 'Venue not found.'
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_ALREADY_EXISTS_FOR_USER_VENUE_DATE'
    ) ||
    error.code ===
      '23505'
  ) {
    return 'This user already has a visit recorded for this venue on that date.'
  }

  if (
    message.includes(
      'ADMIN_HISTORICAL_VISIT_AUDIT_LINK_MISSING'
    )
  ) {
    return 'Historical visit exists, but its audit record is missing.'
  }

  return 'Could not create historical venue visit.'
}

function getHistoricalVisitRpcStatus(
  error:
    SupabaseRpcError
): number {
  const message =
    error.message ??
    ''

  if (
    message.includes(
      'Authentication required.'
    )
  ) {
    return 401
  }

  if (
    message.includes(
      'Venue Admin authorization required.'
    )
  ) {
    return 403
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_USER_NOT_FOUND'
    ) ||
    message.includes(
      'HISTORICAL_VISIT_VENUE_NOT_FOUND'
    )
  ) {
    return 404
  }

  if (
    message.includes(
      'HISTORICAL_VISIT_ALREADY_EXISTS_FOR_USER_VENUE_DATE'
    ) ||
    error.code ===
      '23505'
  ) {
    return 409
  }

  if (
    message.includes(
      'USER_ID_REQUIRED'
    ) ||
    message.includes(
      'VENUE_ID_REQUIRED'
    ) ||
    message.includes(
      'VISITED_AT_REQUIRED'
    ) ||
    message.includes(
      'HISTORICAL_VISIT_MUST_BE_IN_THE_PAST'
    ) ||
    message.includes(
      'VENUE_TIMEZONE_REQUIRED'
    ) ||
    message.includes(
      'INVALID_VENUE_TIMEZONE'
    ) ||
    message.includes(
      'HISTORICAL_VISIT_REASON_REQUIRED'
    ) ||
    message.includes(
      'HISTORICAL_VISIT_REASON_TOO_LONG'
    )
  ) {
    return 400
  }

  return 500
}

// ============================================================
// IDENTIFIERS
// ============================================================

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}
