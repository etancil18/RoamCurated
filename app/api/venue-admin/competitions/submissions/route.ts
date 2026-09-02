import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

// ============================================================
// ADMIN CONFIG
// ============================================================

const ALLOWED_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

// ============================================================
// TYPES
// ============================================================

type SubmissionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'

type CompetitionExecutionMode =
  | 'itinerary'
  | 'venue_participation'

type CompetitionRow = {
  id: string
  competition_type: string
  taste_duel_execution_mode:
    CompetitionExecutionMode | null
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_LIMIT =
  50

const MAX_LIMIT =
  100

const ALLOWED_SUBMISSION_STATUSES =
  new Set<SubmissionStatus>([
    'pending',
    'approved',
    'rejected',
  ])

const SUBMISSION_SELECT = `
  id,
  competition_id,
  user_id,
  submission_source,
  flow_session_id,
  visit_date,
  venue_ids,
  route_title,
  route_city,
  route_started_at,
  route_completed_at,
  verified_venue_count,
  status,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  competition_entry_id,
  submitted_at,
  created_at,
  updated_at
`

// ============================================================
// GET
// GET /api/venue-admin/competitions/submissions
//
// Supported query parameters:
//
//   competitionId=<uuid>
//   status=pending|approved|rejected
//   limit=1..100
//   offset=0+
//
// competitionId is intentionally required.
//
// Venue-participation Taste Duels do not use submissions and
// therefore return a successful empty collection.
// ============================================================

export async function GET(
  request: Request
) {
  try {
    const auth =
      await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const url =
      new URL(
        request.url
      )

    // ========================================================
    // COMPETITION ID
    // ========================================================

    const rawCompetitionId =
      url.searchParams.get(
        'competitionId'
      ) ??
      url.searchParams.get(
        'competition_id'
      )

    const competitionId =
      rawCompetitionId
        ?.trim()
        .toLowerCase() ??
      ''

    if (
      !competitionId ||
      !isValidUuid(
        competitionId
      )
    ) {
      return noStoreJson(
        {
          error:
            'A valid competitionId is required.',
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // STATUS FILTER
    // ========================================================

    const rawStatus =
      url.searchParams.get(
        'status'
      )

    const status =
      rawStatus
        ?.trim()
        .toLowerCase() ??
      null

    if (
      status !==
        null &&
      status !==
        '' &&
      !ALLOWED_SUBMISSION_STATUSES.has(
        status as SubmissionStatus
      )
    ) {
      return noStoreJson(
        {
          error:
            'status must be pending, approved, or rejected.',
        },
        {
          status: 400,
        }
      )
    }

    const normalizedStatus =
      status &&
      ALLOWED_SUBMISSION_STATUSES.has(
        status as SubmissionStatus
      )
        ? status as SubmissionStatus
        : null

    // ========================================================
    // PAGINATION
    // ========================================================

    const limit =
      readIntegerQueryParameter({
        value:
          url.searchParams.get(
            'limit'
          ),

        fallback:
          DEFAULT_LIMIT,

        minimum:
          1,

        maximum:
          MAX_LIMIT,
      })

    if (
      limit ===
      null
    ) {
      return noStoreJson(
        {
          error:
            `limit must be an integer between 1 and ${MAX_LIMIT}.`,
        },
        {
          status: 400,
        }
      )
    }

    const offset =
      readIntegerQueryParameter({
        value:
          url.searchParams.get(
            'offset'
          ),

        fallback:
          0,

        minimum:
          0,

        maximum:
          Number.MAX_SAFE_INTEGER,
      })

    if (
      offset ===
      null
    ) {
      return noStoreJson(
        {
          error:
            'offset must be a non-negative integer.',
        },
        {
          status: 400,
        }
      )
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    // ========================================================
    // VERIFY PARENT COMPETITION + EXECUTION MODE
    // ========================================================

    const {
      data:
        competitionData,
      error:
        competitionError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .select(`
        id,
        competition_type,
        taste_duel_execution_mode
      `)
      .eq(
        'id',
        competitionId
      )
      .maybeSingle()

    if (
      competitionError
    ) {
      console.error(
        '[venue-admin/competitions/submissions] Competition lookup failed:',
        {
          competitionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            competitionError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not validate competition.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !competitionData
    ) {
      return noStoreJson(
        {
          error:
            'Competition not found.',
        },
        {
          status: 404,
        }
      )
    }

    const competition =
      competitionData as
        CompetitionRow

    // ========================================================
    // EXECUTION-MODE CONTRACT
    // ========================================================
    //
    // competition_submissions belongs exclusively to itinerary
    // Taste Duels.
    //
    // A collection read for venue-participation mode is harmless
    // and intentionally resolves to an empty collection rather
    // than producing a client-visible error.
    //
    // Mutation routes remain responsible for rejecting attempts
    // to moderate/promote submissions for venue participation.
    // ========================================================

    if (
      competition.competition_type ===
        'taste_duel' &&
      competition.taste_duel_execution_mode ===
        'venue_participation'
    ) {
      return noStoreJson(
        {
          submissions:
            [],

          limit,

          offset,

          hasMore:
            false,
        },
        {
          status: 200,
        }
      )
    }

    if (
      competition.competition_type !==
        'taste_duel'
    ) {
      return noStoreJson(
        {
          error:
            'Competition submissions are supported only for Taste Duels.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      competition.taste_duel_execution_mode !==
        'itinerary'
    ) {
      return noStoreJson(
        {
          error:
            'Competition has an unsupported Taste Duel execution mode.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // QUERY SUBMISSIONS
    // ========================================================
    //
    // Fetch one extra row so hasMore can be derived without a
    // second count query.
    // ========================================================

    let query =
      serviceSupabase
        .from(
          'competition_submissions'
        )
        .select(
          SUBMISSION_SELECT
        )
        .eq(
          'competition_id',
          competitionId
        )
        .order(
          'submitted_at',
          {
            ascending:
              false,
          }
        )
        .range(
          offset,
          offset +
            limit
        )

    if (
      normalizedStatus
    ) {
      query =
        query.eq(
          'status',
          normalizedStatus
        )
    }

    const {
      data:
        submissionData,
      error:
        submissionsError,
    } = await query

    if (
      submissionsError
    ) {
      console.error(
        '[venue-admin/competitions/submissions] Submission query failed:',
        {
          competitionId,

          status:
            normalizedStatus,

          limit,

          offset,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            submissionsError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not load competition submissions.',
        },
        {
          status: 500,
        }
      )
    }

    const rows =
      submissionData ??
      []

    const hasMore =
      rows.length >
      limit

    const submissions =
      hasMore
        ? rows.slice(
            0,
            limit
          )
        : rows

    // ========================================================
    // SUCCESS
    // ========================================================

    return noStoreJson(
      {
        submissions,

        limit,

        offset,

        hasMore,
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions/submissions] GET unexpected error:',
      error
    )

    return noStoreJson(
      {
        error:
          'Unexpected error loading competition submissions.',
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// ADMIN AUTH
// ============================================================

async function requireAdmin(): Promise<
  | {
      ok: true
      user: {
        id: string
        email: string
      }
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !user
  ) {
    return {
      ok: false,

      response:
        noStoreJson(
          {
            error:
              'User not authenticated.',
          },
          {
            status: 401,
          }
        ),
    }
  }

  const email =
    user.email
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    !email ||
    !ALLOWED_ADMIN_EMAILS.has(
      email
    )
  ) {
    return {
      ok: false,

      response:
        noStoreJson(
          {
            error:
              'Admin access required.',
          },
          {
            status: 403,
          }
        ),
    }
  }

  return {
    ok: true,

    user: {
      id:
        user.id,

      email,
    },
  }
}

// ============================================================
// SERVICE CLIENT
// ============================================================

function createCompetitionServiceClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    supabaseUrl
      .trim()
      .length ===
      0
  ) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not configured.'
    )
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey
      .trim()
      .length ===
      0
  ) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured.'
    )
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    }
  )
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function noStoreJson(
  body: unknown,
  init: {
    status: number
  }
) {
  return NextResponse.json(
    body,
    {
      status:
        init.status,

      headers: {
        'Cache-Control':
          'no-store, max-age=0',
      },
    }
  )
}

// ============================================================
// QUERY VALIDATION
// ============================================================

function readIntegerQueryParameter({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value: string | null
  fallback: number
  minimum: number
  maximum: number
}): number | null {
  if (
    value ===
      null ||
    value.trim() ===
      ''
  ) {
    return fallback
  }

  const normalized =
    value.trim()

  if (
    !/^\d+$/.test(
      normalized
    )
  ) {
    return null
  }

  const parsed =
    Number(
      normalized
    )

  if (
    !Number.isSafeInteger(
      parsed
    ) ||
    parsed <
      minimum ||
    parsed >
      maximum
  ) {
    return null
  }

  return parsed
}

// ============================================================
// IDENTIFIERS
// ============================================================

function isValidUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}