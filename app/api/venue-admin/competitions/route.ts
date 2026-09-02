import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

type CreateCompetitionBody = {
  title?: unknown
  description?: unknown
  city?: unknown
  category?: unknown

  competition_type?: unknown
  taste_duel_execution_mode?: unknown

  status?: unknown

  starts_at?: unknown
  ends_at?: unknown

  max_entries?: unknown

  minimum_qualified_participants?: unknown
  minimum_cross_completers?: unknown

  xp_reward?: unknown

  anonymous_entries?: unknown
}

const ALLOWED_STATUSES = new Set([
  'draft',
  'scheduled',
  'live',
  'scoring',
  'completed',
  'cancelled',
])

const ALLOWED_COMPETITION_TYPES = new Set([
  'taste_duel',
])

const ALLOWED_TASTE_DUEL_EXECUTION_MODES =
  new Set([
    'itinerary',
    'venue_participation',
  ])

// ============================================================
// GET
// ============================================================

export async function GET() {
  try {
    const auth =
      await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    const {
      data,
      error,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .select(`
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
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      )

    if (error) {
      console.error(
        '[venue-admin/competitions] GET failed:',
        error
      )

      return NextResponse.json(
        {
          error:
            'Could not load competitions.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(
      {
        competitions:
          data ?? [],
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions] GET unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error loading competitions.',
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const auth =
      await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as CreateCompetitionBody

    const title =
      readRequiredString(
        body.title
      )

    if (!title) {
      return NextResponse.json(
        {
          error:
            'title is required.',
        },
        {
          status: 400,
        }
      )
    }

    const description =
      readOptionalString(
        body.description
      )

    const city =
      readOptionalString(
        body.city
      )

    const category =
      readOptionalString(
        body.category
      )

    const competitionType =
      readOptionalString(
        body.competition_type
      ) ??
      'taste_duel'

    if (
      !ALLOWED_COMPETITION_TYPES.has(
        competitionType
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid competition_type.',
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // TASTE DUEL EXECUTION MODE
    // ========================================================
    //
    // Preserve existing creation behavior:
    //
    //   omitted -> itinerary
    //
    // Venue participation must be selected explicitly.
    // ========================================================

    const tasteDuelExecutionMode =
      readOptionalString(
        body.taste_duel_execution_mode
      ) ??
      'itinerary'

    if (
      !ALLOWED_TASTE_DUEL_EXECUTION_MODES.has(
        tasteDuelExecutionMode
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid taste_duel_execution_mode.',
        },
        {
          status: 400,
        }
      )
    }

    const status =
      readOptionalString(
        body.status
      ) ??
      'draft'

    if (
      !ALLOWED_STATUSES.has(
        status
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid status.',
        },
        {
          status: 400,
        }
      )
    }

    const startsAt =
      readOptionalDateTime(
        body.starts_at
      )

    if (
      body.starts_at != null &&
      !startsAt
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid starts_at.',
        },
        {
          status: 400,
        }
      )
    }

    const endsAt =
      readOptionalDateTime(
        body.ends_at
      )

    if (
      body.ends_at != null &&
      !endsAt
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid ends_at.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      startsAt &&
      endsAt &&
      new Date(
        endsAt
      ).getTime() <=
        new Date(
          startsAt
        ).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            'ends_at must be after starts_at.',
        },
        {
          status: 400,
        }
      )
    }

    const maxEntries =
      readIntegerInRange(
        body.max_entries,
        2,
        4,
        2
      )

    if (
      maxEntries ===
      null
    ) {
      return NextResponse.json(
        {
          error:
            'max_entries must be an integer between 2 and 4.',
        },
        {
          status: 400,
        }
      )
    }

    const minimumQualifiedParticipants =
      readNonNegativeInteger(
        body.minimum_qualified_participants,
        0
      )

    if (
      minimumQualifiedParticipants ===
      null
    ) {
      return NextResponse.json(
        {
          error:
            'minimum_qualified_participants must be a non-negative integer.',
        },
        {
          status: 400,
        }
      )
    }

    const minimumCrossCompleters =
      readNonNegativeInteger(
        body.minimum_cross_completers,
        0
      )

    if (
      minimumCrossCompleters ===
      null
    ) {
      return NextResponse.json(
        {
          error:
            'minimum_cross_completers must be a non-negative integer.',
        },
        {
          status: 400,
        }
      )
    }

    const xpReward =
      readNonNegativeInteger(
        body.xp_reward,
        0
      )

    if (
      xpReward ===
      null
    ) {
      return NextResponse.json(
        {
          error:
            'xp_reward must be a non-negative integer.',
        },
        {
          status: 400,
        }
      )
    }

    const anonymousEntries =
      typeof body.anonymous_entries ===
        'boolean'
        ? body.anonymous_entries
        : true

    const serviceSupabase =
      createCompetitionServiceClient()

    const {
      data:
        competition,
      error:
        insertError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .insert({
        competition_type:
          competitionType,

        taste_duel_execution_mode:
          tasteDuelExecutionMode,

        title,

        description,

        city,

        category,

        status,

        starts_at:
          startsAt,

        ends_at:
          endsAt,

        max_entries:
          maxEntries,

        minimum_qualified_participants:
          minimumQualifiedParticipants,

        minimum_cross_completers:
          minimumCrossCompleters,

        xp_reward:
          xpReward,

        anonymous_entries:
          anonymousEntries,

        created_by:
          auth.user.id,
      })
      .select(`
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
      `)
      .single()

    if (
      insertError ||
      !competition
    ) {
      console.error(
        '[venue-admin/competitions] POST failed:',
        {
          adminUserId:
            auth.user.id,

          error:
            insertError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not create competition.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(
      {
        competition,
      },
      {
        status: 201,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions] POST unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error creating competition.',
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
        NextResponse.json(
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
        NextResponse.json(
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
// NORMALIZATION
// ============================================================

function readRequiredString(
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

function readOptionalString(
  value: unknown
): string | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null
  }

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

function readOptionalDateTime(
  value: unknown
): string | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null
  }

  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date.toISOString()
}

function readIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return fallback
  }

  if (
    typeof value !==
      'number' ||
    !Number.isSafeInteger(
      value
    ) ||
    value <
      min ||
    value >
      max
  ) {
    return null
  }

  return value
}

function readNonNegativeInteger(
  value: unknown,
  fallback: number
): number | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return fallback
  }

  if (
    typeof value !==
      'number' ||
    !Number.isSafeInteger(
      value
    ) ||
    value <
      0
  ) {
    return null
  }

  return value
}