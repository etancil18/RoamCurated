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

type UpdateCompetitionBody = {
  status?: unknown

  taste_duel_execution_mode?: unknown
}

// ============================================================
// CONSTANTS
// ============================================================

const COMPETITION_SELECT = `
  id,
  competition_type,
  taste_duel_execution_mode,
  title,
  description,
  city,
  category,
  status,
  starts_at,
  ends_at,
  max_entries,
  minimum_qualified_participants,
  minimum_cross_completers,
  winner_entry_id,
  result_status,
  xp_reward,
  anonymous_entries,
  created_by,
  created_at,
  updated_at
`

const ALLOWED_STATUSES = new Set([
  'draft',
  'scheduled',
  'live',
  'scoring',
  'completed',
  'cancelled',
])

const ALLOWED_TASTE_DUEL_EXECUTION_MODES =
  new Set([
    'itinerary',
    'venue_participation',
  ])

// ============================================================
// GET
// GET /api/venue-admin/competitions/[competitionId]
// ============================================================

export async function GET(
  _request: Request,
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

    const serviceSupabase =
      createCompetitionServiceClient()

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
        COMPETITION_SELECT
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
        '[venue-admin/competitions/[competitionId]] GET failed:',
        {
          competitionId:
            normalizedCompetitionId,

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
            'Could not load competition.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !competition
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

    const [
      submissionsResult,
      entriesResult,
    ] = await Promise.all([
      serviceSupabase
        .from(
          'competition_submissions'
        )
        .select(`
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
        `)
        .eq(
          'competition_id',
          normalizedCompetitionId
        )
        .order(
          'submitted_at',
          {
            ascending:
              false,
          }
        ),

      serviceSupabase
        .from(
          'competition_entries'
        )
        .select(`
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
        `)
        .eq(
          'competition_id',
          normalizedCompetitionId
        )
        .order(
          'contender_slot',
          {
            ascending:
              true,
          }
        ),
    ])

    if (
      submissionsResult.error
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]] GET submissions failed:',
        {
          competitionId:
            normalizedCompetitionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            submissionsResult.error,
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

    if (
      entriesResult.error
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]] GET entries failed:',
        {
          competitionId:
            normalizedCompetitionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            entriesResult.error,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not load competition entries.',
        },
        {
          status: 500,
        }
      )
    }

    return noStoreJson(
      {
        competition,

        submissions:
          submissionsResult.data ??
          [],

        entries:
          entriesResult.data ??
          [],
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions/[competitionId]] GET unexpected error:',
      error
    )

    return noStoreJson(
      {
        error:
          'Unexpected error loading competition.',
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// PATCH
// PATCH /api/venue-admin/competitions/[competitionId]
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
        )) as UpdateCompetitionBody

    // ========================================================
    // OPTIONAL STATUS UPDATE
    // ========================================================

    const hasStatusUpdate =
      body.status !==
        undefined

    const status =
      hasStatusUpdate &&
      typeof body.status ===
        'string'
        ? body.status
            .trim()
            .toLowerCase()
        : null

    if (
      hasStatusUpdate &&
      (
        !status ||
        !ALLOWED_STATUSES.has(
          status
        )
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid status.',
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // OPTIONAL TASTE DUEL EXECUTION MODE UPDATE
    // ========================================================

    const hasExecutionModeUpdate =
      body.taste_duel_execution_mode !==
        undefined

    const tasteDuelExecutionMode =
      hasExecutionModeUpdate &&
      typeof body.taste_duel_execution_mode ===
        'string'
        ? body.taste_duel_execution_mode
            .trim()
            .toLowerCase()
        : null

    if (
      hasExecutionModeUpdate &&
      (
        !tasteDuelExecutionMode ||
        !ALLOWED_TASTE_DUEL_EXECUTION_MODES.has(
          tasteDuelExecutionMode
        )
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid taste_duel_execution_mode.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !hasStatusUpdate &&
      !hasExecutionModeUpdate
    ) {
      return noStoreJson(
        {
          error:
            'No supported competition update was provided.',
        },
        {
          status: 400,
        }
      )
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    const {
      data:
        existingCompetition,
      error:
        existingError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .select(
        COMPETITION_SELECT
      )
      .eq(
        'id',
        normalizedCompetitionId
      )
      .maybeSingle()

    if (
      existingError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]] PATCH lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            existingError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not load competition.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !existingCompetition
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

    // ========================================================
    // STATUS TRANSITION VALIDATION
    // ========================================================

    if (
      status &&
      !isAllowedStatusTransition(
        existingCompetition.status,
        status
      )
    ) {
      return noStoreJson(
        {
          error:
            `Competition cannot move from ${existingCompetition.status} to ${status}.`,
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // EXECUTION MODE IMMUTABILITY BOUNDARY
    // ========================================================
    //
    // An execution-mode change alters the competition's evidence,
    // scoring, recomputation, and settlement semantics.
    //
    // Therefore an actual mode change is allowed only while the
    // competition is still draft.
    //
    // Sending the existing value again remains harmless.
    // ========================================================

    const executionModeIsChanging =
      tasteDuelExecutionMode !==
        null &&
      tasteDuelExecutionMode !==
        existingCompetition
          .taste_duel_execution_mode

    if (
      executionModeIsChanging &&
      existingCompetition.status !==
        'draft'
    ) {
      return noStoreJson(
        {
          error:
            'taste_duel_execution_mode can only be changed while the competition is in draft status.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      executionModeIsChanging &&
      existingCompetition
        .competition_type !==
        'taste_duel'
    ) {
      return noStoreJson(
        {
          error:
            'taste_duel_execution_mode can only be changed for Taste Duel competitions.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // UPDATE PAYLOAD
    // ========================================================

    const updatePayload: {
      status?: string

      taste_duel_execution_mode?: string

      updated_at: string
    } = {
      updated_at:
        new Date().toISOString(),
    }

    if (
      status
    ) {
      updatePayload.status =
        status
    }

    if (
      tasteDuelExecutionMode
    ) {
      updatePayload
        .taste_duel_execution_mode =
        tasteDuelExecutionMode
    }

    const {
      data:
        competition,
      error:
        updateError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .update(
        updatePayload
      )
      .eq(
        'id',
        normalizedCompetitionId
      )
      .select(
        COMPETITION_SELECT
      )
      .single()

    if (
      updateError ||
      !competition
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]] PATCH failed:',
        {
          competitionId:
            normalizedCompetitionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          fromStatus:
            existingCompetition.status,

          toStatus:
            status,

          fromTasteDuelExecutionMode:
            existingCompetition
              .taste_duel_execution_mode,

          toTasteDuelExecutionMode:
            tasteDuelExecutionMode,

          error:
            updateError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not update competition.',
        },
        {
          status: 500,
        }
      )
    }

    return noStoreJson(
      {
        competition,
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions/[competitionId]] PATCH unexpected error:',
      error
    )

    return noStoreJson(
      {
        error:
          'Unexpected error updating competition.',
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

function isAllowedStatusTransition(
  currentStatus: string,
  nextStatus: string
): boolean {
  if (
    currentStatus ===
    nextStatus
  ) {
    return true
  }

  const transitions: Record<
    string,
    string[]
  > = {
    draft: [
      'scheduled',
      'live',
      'cancelled',
    ],

    scheduled: [
      'live',
      'cancelled',
    ],

    live: [
      'scoring',
      'cancelled',
    ],

    scoring: [
      'completed',
      'cancelled',
    ],

    completed: [],

    cancelled: [],
  }

  return (
    transitions[
      currentStatus
    ]?.includes(
      nextStatus
    ) ??
    false
  )
}