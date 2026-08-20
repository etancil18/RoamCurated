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
  }>
}

type CreateEntryBody = {
  submission_id?: unknown
  contender_slot?: unknown
}

type CompetitionStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'scoring'
  | 'completed'
  | 'cancelled'

type CompetitionRow = {
  id: string
  status: CompetitionStatus
  max_entries: number
}

type SubmissionSource =
  | 'active_flow'
  | 'visit_history'

type SubmissionRow = {
  id: string
  competition_id: string
  user_id: string
  submission_source: SubmissionSource
  flow_session_id: string | null
  visit_date: string | null
  venue_ids: string[]
  status: string
  submitted_at: string
  competition_entry_id: string | null
}

// ============================================================
// CONSTANTS
// ============================================================

const ENTRY_SELECT = `
  id,
  competition_id,
  user_id,
  contender_slot,
  source_type,
  source_flow_session_id,
  source_visit_date,
  venue_ids,
  status,
  submitted_at,
  approved_at,
  withdrawn_at,
  disqualified_at,
  created_at,
  updated_at
`

const SUBMISSION_SELECT = `
  id,
  competition_id,
  user_id,
  submission_source,
  flow_session_id,
  visit_date,
  venue_ids,
  status,
  submitted_at,
  competition_entry_id
`

const PROMOTABLE_COMPETITION_STATUSES =
  new Set<CompetitionStatus>([
    'draft',
    'scheduled',
    'live',
  ])

// ============================================================
// POST
// POST /api/venue-admin/competitions/[competitionId]/entries
// ============================================================

export async function POST(
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
    } = await context.params

    const normalizedCompetitionId =
      competitionId
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

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as CreateEntryBody

    const submissionId =
      typeof body.submission_id ===
        'string'
        ? body.submission_id
            .trim()
            .toLowerCase()
        : ''

    if (
      !submissionId ||
      !isValidUuid(
        submissionId
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid or missing submission_id.',
        },
        {
          status: 400,
        }
      )
    }

    const contenderSlot =
      body.contender_slot

    if (
      typeof contenderSlot !==
        'number' ||
      !Number.isSafeInteger(
        contenderSlot
      ) ||
      contenderSlot <
        1 ||
      contenderSlot >
        4
    ) {
      return noStoreJson(
        {
          error:
            'contender_slot must be an integer between 1 and 4.',
        },
        {
          status: 400,
        }
      )
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    // ========================================================
    // LOAD COMPETITION
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
      .select(
        'id, status, max_entries'
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
        '[venue-admin/competitions/[competitionId]/entries] Competition lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

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

    if (
      !PROMOTABLE_COMPETITION_STATUSES.has(
        competition.status
      )
    ) {
      return noStoreJson(
        {
          error:
            'This competition is no longer accepting official contenders.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      contenderSlot >
      competition.max_entries
    ) {
      return noStoreJson(
        {
          error:
            `Contender slot ${contenderSlot} is outside this competition's ${competition.max_entries}-entry limit.`,
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // LOAD APPROVED SUBMISSION
    // ========================================================

    const {
      data:
        submissionData,
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
        submissionId
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
        '[venue-admin/competitions/[competitionId]/entries] Submission lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

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
      !submissionData
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

    const submission =
      submissionData as
        SubmissionRow

    // ========================================================
    // IDEMPOTENT ALREADY-PROMOTED STATE
    // ========================================================

    if (
      submission.competition_entry_id
    ) {
      const {
        data:
          existingLinkedEntry,
        error:
          existingLinkedEntryError,
      } = await serviceSupabase
        .from(
          'competition_entries'
        )
        .select(
          ENTRY_SELECT
        )
        .eq(
          'id',
          submission.competition_entry_id
        )
        .eq(
          'competition_id',
          normalizedCompetitionId
        )
        .maybeSingle()

      if (
        existingLinkedEntryError
      ) {
        console.error(
          '[venue-admin/competitions/[competitionId]/entries] Existing linked entry lookup failed:',
          {
            competitionId:
              normalizedCompetitionId,

            submissionId,

            competitionEntryId:
              submission.competition_entry_id,

            adminUserId:
              auth.user.id,

            error:
              existingLinkedEntryError,
          }
        )

        return noStoreJson(
          {
            error:
              'Could not validate existing competition entry.',
          },
          {
            status: 500,
          }
        )
      }

      if (
        existingLinkedEntry
      ) {
        return noStoreJson(
          {
            entry:
              existingLinkedEntry,

            submission,

            message:
              'Submission is already an official competition entry.',
          },
          {
            status: 200,
          }
        )
      }

      /**
       * A linked entry ID without a corresponding entry is an
       * invalid persisted state. Do not silently create another.
       */
      return noStoreJson(
        {
          error:
            'Submission references an official entry that could not be found.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      submission.status !==
      'approved'
    ) {
      return noStoreJson(
        {
          error:
            'Only approved submissions can become official competition entries.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // VALIDATE CANONICAL SOURCE EVIDENCE
    // ========================================================

    if (
      !Array.isArray(
        submission.venue_ids
      ) ||
      submission.venue_ids.length <
        3
    ) {
      return noStoreJson(
        {
          error:
            'Submission does not contain enough route evidence to become an official entry.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      submission.submission_source ===
        'active_flow' &&
      !submission.flow_session_id
    ) {
      return noStoreJson(
        {
          error:
            'Approved Active Flow submission is missing its canonical Flow session.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      submission.submission_source ===
        'visit_history' &&
      !submission.visit_date
    ) {
      return noStoreJson(
        {
          error:
            'Approved Visit History submission is missing its canonical visit date.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // VALIDATE SLOT AVAILABILITY
    // ========================================================

    const {
      data:
        occupiedSlotEntry,
      error:
        occupiedSlotError,
    } = await serviceSupabase
      .from(
        'competition_entries'
      )
      .select(
        'id, status'
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .eq(
        'contender_slot',
        contenderSlot
      )
      .in(
        'status',
        [
          'pending',
          'approved',
        ]
      )
      .maybeSingle()

    if (
      occupiedSlotError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Slot validation failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          contenderSlot,

          adminUserId:
            auth.user.id,

          error:
            occupiedSlotError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not validate contender slot.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      occupiedSlotEntry
    ) {
      return noStoreJson(
        {
          error:
            `Contender slot ${contenderSlot} is already occupied.`,
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // PREVENT DUPLICATE ACTIVE ENTRY FOR SAME SUBMISSION SOURCE
    // ========================================================

    let duplicateEntryQuery =
      serviceSupabase
        .from(
          'competition_entries'
        )
        .select(
          'id, contender_slot, status'
        )
        .eq(
          'competition_id',
          normalizedCompetitionId
        )
        .eq(
          'user_id',
          submission.user_id
        )
        .eq(
          'source_type',
          submission.submission_source
        )
        .in(
          'status',
          [
            'pending',
            'approved',
          ]
        )

    if (
      submission.submission_source ===
      'active_flow'
    ) {
      duplicateEntryQuery =
        duplicateEntryQuery.eq(
          'source_flow_session_id',
          submission.flow_session_id
        )
    } else {
      duplicateEntryQuery =
        duplicateEntryQuery.eq(
          'source_visit_date',
          submission.visit_date
        )
    }

    const {
      data:
        duplicateEntry,
      error:
        duplicateEntryError,
    } = await duplicateEntryQuery
      .maybeSingle()

    if (
      duplicateEntryError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Duplicate entry validation failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          adminUserId:
            auth.user.id,

          error:
            duplicateEntryError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not validate existing competition entry state.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      duplicateEntry
    ) {
      return noStoreJson(
        {
          error:
            'This route is already an official contender in this competition.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // CREATE OFFICIAL ENTRY
    // ========================================================

    const now =
      new Date().toISOString()

    const {
      data:
        entry,
      error:
        insertError,
    } = await serviceSupabase
      .from(
        'competition_entries'
      )
      .insert({
        competition_id:
          normalizedCompetitionId,

        user_id:
          submission.user_id,

        contender_slot:
          contenderSlot,

        source_type:
          submission.submission_source,

        source_flow_session_id:
          submission.submission_source ===
            'active_flow'
            ? submission.flow_session_id
            : null,

        source_visit_date:
          submission.submission_source ===
            'visit_history'
            ? submission.visit_date
            : null,

        venue_ids:
          submission.venue_ids,

        /**
         * This route represents an explicit admin promotion of an
         * already-approved submission, so the resulting contender
         * is immediately approved.
         */
        status:
          'approved',

        submitted_at:
          submission.submitted_at,

        approved_at:
          now,

        withdrawn_at:
          null,

        disqualified_at:
          null,

        updated_at:
          now,
      })
      .select(
        ENTRY_SELECT
      )
      .single()

    if (
      insertError ||
      !entry
    ) {
      const errorCode =
        getPostgresErrorCode(
          insertError
        )

      /**
       * Unique constraints remain the final authority for races
       * between simultaneous admin requests.
       */
      if (
        errorCode ===
        '23505'
      ) {
        return noStoreJson(
          {
            error:
              'This contender slot or submission is already assigned to an official entry.',
          },
          {
            status: 409,
          }
        )
      }

      if (
        errorCode ===
          '23514' ||
        errorCode ===
          'P0001'
      ) {
        console.warn(
          '[venue-admin/competitions/[competitionId]/entries] Entry rejected by database invariant:',
          {
            competitionId:
              normalizedCompetitionId,

            submissionId,

            contenderSlot,

            adminUserId:
              auth.user.id,

            error:
              insertError,
          }
        )

        return noStoreJson(
          {
            error:
              'This submission is no longer eligible to become an official contender.',
          },
          {
            status: 409,
          }
        )
      }

      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Entry insert failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          contenderSlot,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            insertError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not create official competition entry.',
        },
        {
          status: 500,
        }
      )
    }

    // ========================================================
    // LINK SUBMISSION TO ENTRY
    // ========================================================

    const {
      data:
        updatedSubmission,
      error:
        submissionLinkError,
    } = await serviceSupabase
      .from(
        'competition_submissions'
      )
      .update({
        competition_entry_id:
          entry.id,

        updated_at:
          now,
      })
      .eq(
        'id',
        submissionId
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .eq(
        'status',
        'approved'
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
      submissionLinkError ||
      !updatedSubmission
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Submission link failed; rolling back entry:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          competitionEntryId:
            entry.id,

          adminUserId:
            auth.user.id,

          error:
            submissionLinkError,
        }
      )

      /**
       * Supabase client calls here are not one SQL transaction.
       * If linking the approved submission fails, remove the entry
       * we just created so the two canonical records cannot drift.
       */
      const {
        error:
          rollbackError,
      } = await serviceSupabase
        .from(
          'competition_entries'
        )
        .delete()
        .eq(
          'id',
          entry.id
        )
        .eq(
          'competition_id',
          normalizedCompetitionId
        )

      if (
        rollbackError
      ) {
        console.error(
          '[venue-admin/competitions/[competitionId]/entries] CRITICAL rollback failure:',
          {
            competitionId:
              normalizedCompetitionId,

            submissionId,

            competitionEntryId:
              entry.id,

            adminUserId:
              auth.user.id,

            error:
              rollbackError,
          }
        )

        return noStoreJson(
          {
            error:
              'Competition entry was created but could not be linked to its submission. Automatic rollback also failed. Manual reconciliation is required.',
          },
          {
            status: 500,
          }
        )
      }

      return noStoreJson(
        {
          error:
            'Submission changed before it could be promoted. Refresh and try again.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    return noStoreJson(
      {
        entry,

        submission:
          updatedSubmission,

        message:
          `Submission promoted to Contender ${contenderSlotLabel(
            contenderSlot
          )}.`,
      },
      {
        status: 201,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions/[competitionId]/entries] POST unexpected error:',
      error
    )

    return noStoreJson(
      {
        error:
          'Unexpected error creating official competition entry.',
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
// VALIDATION / HELPERS
// ============================================================

function isValidUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function getPostgresErrorCode(
  error: unknown
): string | null {
  if (
    !error ||
    typeof error !==
      'object'
  ) {
    return null
  }

  if (
    'code' in error &&
    typeof error.code ===
      'string'
  ) {
    return error.code
  }

  return null
}

function contenderSlotLabel(
  slot: number
): string {
  switch (slot) {
    case 1:
      return 'A'

    case 2:
      return 'B'

    case 3:
      return 'C'

    case 4:
      return 'D'

    default:
      return String(
        slot
      )
  }
}