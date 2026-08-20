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

type RouteContext = {
  params: Promise<{
    competitionId: string
    submissionId: string
  }>
}

type UpdateSubmissionBody = {
  status?: unknown
  rejection_reason?: unknown
}

type SubmissionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'

// ============================================================
// CONSTANTS
// ============================================================

const ALLOWED_MODERATION_STATUSES =
  new Set<SubmissionStatus>([
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
// PATCH
// PATCH /api/venue-admin/competitions/
//   [competitionId]/submissions/[submissionId]
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const {
      competitionId,
      submissionId,
    } = await context.params

    const normalizedCompetitionId =
      competitionId
        ?.trim()
        .toLowerCase()

    const normalizedSubmissionId =
      submissionId
        ?.trim()
        .toLowerCase()

    if (
      !normalizedCompetitionId ||
      !isValidUuid(
        normalizedCompetitionId
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid competition ID.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !normalizedSubmissionId ||
      !isValidUuid(
        normalizedSubmissionId
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid submission ID.',
        },
        {
          status: 400,
        }
      )
    }

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as UpdateSubmissionBody

    const requestedStatus =
      typeof body.status ===
        'string'
        ? body.status
            .trim()
            .toLowerCase()
        : null

    if (
      !requestedStatus ||
      !ALLOWED_MODERATION_STATUSES.has(
        requestedStatus as
          SubmissionStatus
      )
    ) {
      return noStoreJson(
        {
          error:
            'status must be approved or rejected.',
        },
        {
          status: 400,
        }
      )
    }

    const status =
      requestedStatus as
        Exclude<
          SubmissionStatus,
          'pending'
        >

    const rejectionReason =
      normalizeOptionalString(
        body.rejection_reason
      )

    const serviceSupabase =
      createCompetitionServiceClient()

    // ========================================================
    // VERIFY COMPETITION
    // ========================================================

    const {
      data:
        competition,
      error:
        competitionError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .select(
        'id, status'
      )
      .eq(
        'id',
        normalizedCompetitionId
      )
      .maybeSingle()

    if (
      competitionError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/submissions/[submissionId]] Competition lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId:
            normalizedSubmissionId,

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

    if (!competition) {
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

    // ========================================================
    // LOAD SUBMISSION
    // ========================================================

    const {
      data:
        existingSubmission,
      error:
        submissionError,
    } = await serviceSupabase
      .from(
        'competition_submissions'
      )
      .select(
        SUBMISSION_SELECT
      )
      .eq(
        'id',
        normalizedSubmissionId
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .maybeSingle()

    if (
      submissionError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/submissions/[submissionId]] Submission lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId:
            normalizedSubmissionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            submissionError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not load competition submission.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !existingSubmission
    ) {
      return noStoreJson(
        {
          error:
            'Competition submission not found.',
        },
        {
          status: 404,
        }
      )
    }

    // ========================================================
    // PROTECT PROMOTED SUBMISSIONS
    // ========================================================

    if (
      existingSubmission
        .competition_entry_id
    ) {
      return noStoreJson(
        {
          error:
            'This submission has already been promoted to an official competition entry and can no longer be moderated.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // IDEMPOTENT SAME-STATE REQUEST
    // ========================================================

    if (
      existingSubmission.status ===
      status
    ) {
      return noStoreJson(
        {
          submission:
            existingSubmission,
        },
        {
          status: 200,
        }
      )
    }

    // ========================================================
    // MODERATION TRANSITION
    // ========================================================

    if (
      existingSubmission.status !==
      'pending'
    ) {
      return noStoreJson(
        {
          error:
            `Submission cannot move from ${existingSubmission.status} to ${status}.`,
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // UPDATE
    // ========================================================

    const reviewedAt =
      new Date().toISOString()

    const {
      data:
        submission,
      error:
        updateError,
    } = await serviceSupabase
      .from(
        'competition_submissions'
      )
      .update({
        status,

        reviewed_by:
          auth.user.id,

        reviewed_at:
          reviewedAt,

        rejection_reason:
          status ===
            'rejected'
            ? rejectionReason
            : null,

        updated_at:
          reviewedAt,
      })
      .eq(
        'id',
        normalizedSubmissionId
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .eq(
        'status',
        'pending'
      )
      .is(
        'competition_entry_id',
        null
      )
      .select(
        SUBMISSION_SELECT
      )
      .maybeSingle()

    if (
      updateError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/submissions/[submissionId]] PATCH failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId:
            normalizedSubmissionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          requestedStatus:
            status,

          error:
            updateError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not update competition submission.',
        },
        {
          status: 500,
        }
      )
    }

    /**
     * If no row was returned, the submission changed between the
     * initial lookup and the guarded update.
     *
     * Treat this as a conflict rather than overwriting newer state.
     */
    if (!submission) {
      return noStoreJson(
        {
          error:
            'Competition submission changed before moderation could be completed. Refresh and try again.',
        },
        {
          status: 409,
        }
      )
    }

    return noStoreJson(
      {
        submission,

        message:
          status ===
            'approved'
            ? 'Competition submission approved.'
            : 'Competition submission rejected.',
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions/[competitionId]/submissions/[submissionId]] PATCH unexpected error:',
      error
    )

    return noStoreJson(
      {
        error:
          'Unexpected error updating competition submission.',
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
// VALIDATION
// ============================================================

function isValidUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function normalizeOptionalString(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length >
    0
    ? normalized
    : null
}