import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    competition_id: string
  }>
}

type PreferenceRequestBody = {
  entry_a_id?: unknown
  entry_b_id?: unknown
  preferred_entry_id?: unknown
}

type CompetitionRow = {
  id: string
  status: string
}

type CompetitionEntryRow = {
  id: string
  competition_id: string
  status: string
}

type QualifiedParticipationRow = {
  competition_entry_id: string
  qualified: boolean
  completed_at: string | null
}

type PreferenceRow = {
  id: string
  competition_id: string
  user_id: string
  entry_a_id: string
  entry_b_id: string
  preferred_entry_id: string
  created_at: string
  updated_at: string
}

const PREFERENCE_ALLOWED_STATUSES = new Set([
  'live',
  'scoring',
])

export async function POST(
  req: Request,
  context: RouteContext
) {
  try {
    const {
      competition_id:
        competitionId,
    } = await context.params

    if (
      !isUuid(
        competitionId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid competition_id.',
        },
        {
          status: 400,
        }
      )
    }

    // =========================================================
    // AUTH
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

    // =========================================================
    // BODY
    // =========================================================

    const body =
      (await req
        .json()
        .catch(
          () => ({})
        )) as PreferenceRequestBody

    const entryAId =
      readUuid(
        body.entry_a_id
      )

    const entryBId =
      readUuid(
        body.entry_b_id
      )

    const preferredEntryId =
      readUuid(
        body.preferred_entry_id
      )

    if (!entryAId) {
      return NextResponse.json(
        {
          error:
            'Invalid entry_a_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (!entryBId) {
      return NextResponse.json(
        {
          error:
            'Invalid entry_b_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (!preferredEntryId) {
      return NextResponse.json(
        {
          error:
            'Invalid preferred_entry_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      entryAId ===
      entryBId
    ) {
      return NextResponse.json(
        {
          error:
            'A preference requires two different competition entries.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      preferredEntryId !==
        entryAId &&
      preferredEntryId !==
        entryBId
    ) {
      return NextResponse.json(
        {
          error:
            'preferred_entry_id must match one of the two compared entries.',
        },
        {
          status: 400,
        }
      )
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    // =========================================================
    // COMPETITION
    // =========================================================

    const {
      data:
        competition,
      error:
        competitionError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .select(`
        id,
        status
      `)
      .eq(
        'id',
        competitionId
      )
      .maybeSingle<CompetitionRow>()

    if (
      competitionError
    ) {
      console.error(
        '[competitions/preference] Competition lookup failed:',
        {
          competitionId,
          userId:
            user.id,
          error:
            competitionError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not verify competition.',
        },
        {
          status: 500,
        }
      )
    }

    if (!competition) {
      return NextResponse.json(
        {
          error:
            'Competition not found.',
        },
        {
          status: 404,
        }
      )
    }

    if (
      !PREFERENCE_ALLOWED_STATUSES.has(
        competition.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Preferences are not open for this competition.',
        },
        {
          status: 409,
        }
      )
    }

    // =========================================================
    // BOTH ENTRIES MUST BELONG TO THIS COMPETITION
    // =========================================================

    const {
      data:
        entryRows,
      error:
        entriesError,
    } = await serviceSupabase
      .from(
        'competition_entries'
      )
      .select(`
        id,
        competition_id,
        status
      `)
      .eq(
        'competition_id',
        competitionId
      )
      .in(
        'id',
        [
          entryAId,
          entryBId,
        ]
      )

    if (
      entriesError
    ) {
      console.error(
        '[competitions/preference] Entry lookup failed:',
        {
          competitionId,
          userId:
            user.id,
          entryAId,
          entryBId,
          error:
            entriesError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not verify competition entries.',
        },
        {
          status: 500,
        }
      )
    }

    const entries =
      (
        entryRows ??
        []
      ) as CompetitionEntryRow[]

    if (
      entries.length !==
      2
    ) {
      return NextResponse.json(
        {
          error:
            'One or more competition entries could not be found.',
        },
        {
          status: 404,
        }
      )
    }

    const invalidEntry =
      entries.find(
        (
          entry
        ) =>
          entry.competition_id !==
            competitionId ||
          entry.status !==
            'approved'
      )

    if (invalidEntry) {
      return NextResponse.json(
        {
          error:
            'Both entries must be approved contenders in this competition.',
        },
        {
          status: 409,
        }
      )
    }

    // =========================================================
    // AUTHORITATIVE QUALIFICATION CHECK
    // =========================================================

    /**
     * We intentionally load every qualified completion for this user
     * in the competition.
     *
     * This establishes both:
     *
     * 1. the user has qualified completion in at least two entries;
     * 2. the two entries being compared are specifically among those
     *    qualified completions.
     */
    const {
      data:
        participationRows,
      error:
        participationError,
    } = await serviceSupabase
      .from(
        'competition_participations'
      )
      .select(`
        competition_entry_id,
        qualified,
        completed_at
      `)
      .eq(
        'competition_id',
        competitionId
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'qualified',
        true
      )
      .not(
        'completed_at',
        'is',
        null
      )

    if (
      participationError
    ) {
      console.error(
        '[competitions/preference] Participation lookup failed:',
        {
          competitionId,
          userId:
            user.id,
          error:
            participationError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not verify qualified participation.',
        },
        {
          status: 500,
        }
      )
    }

    const qualifiedParticipations =
      (
        participationRows ??
        []
      ) as QualifiedParticipationRow[]

    const qualifiedEntryIds =
      new Set(
        qualifiedParticipations
          .filter(
            (
              participation
            ) =>
              participation.qualified ===
                true &&
              Boolean(
                participation.completed_at
              )
          )
          .map(
            (
              participation
            ) =>
              participation.competition_entry_id
          )
      )

    if (
      qualifiedEntryIds.size <
      2
    ) {
      return NextResponse.json(
        {
          error:
            'You must have qualified completion in at least two contenders before submitting a preference.',
        },
        {
          status: 403,
        }
      )
    }

    if (
      !qualifiedEntryIds.has(
        entryAId
      ) ||
      !qualifiedEntryIds.has(
        entryBId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'You may only compare contenders that you personally completed and qualified for.',
        },
        {
          status: 403,
        }
      )
    }

    // =========================================================
    // CANONICALIZE PAIR
    // =========================================================

    /**
     * The compared pair is unordered conceptually.
     *
     * Always persist the lexicographically smaller UUID as entry_a_id
     * so:
     *
     *   A vs B
     *
     * and:
     *
     *   B vs A
     *
     * resolve to the same database row.
     */
    const [
      canonicalEntryAId,
      canonicalEntryBId,
    ] =
      canonicalizeEntryPair(
        entryAId,
        entryBId
      )

    const now =
      new Date()
        .toISOString()

    // =========================================================
    // UPSERT PREFERENCE
    // =========================================================

    const {
      data:
        savedPreference,
      error:
        preferenceError,
    } = await serviceSupabase
      .from(
        'competition_head_to_head_preferences'
      )
      .upsert(
        {
          competition_id:
            competitionId,

          user_id:
            user.id,

          entry_a_id:
            canonicalEntryAId,

          entry_b_id:
            canonicalEntryBId,

          preferred_entry_id:
            preferredEntryId,

          updated_at:
            now,
        },
        {
          onConflict:
            'competition_id,user_id,entry_a_id,entry_b_id',
        }
      )
      .select(`
        id,
        competition_id,
        user_id,
        entry_a_id,
        entry_b_id,
        preferred_entry_id,
        created_at,
        updated_at
      `)
      .single<PreferenceRow>()

    if (
      preferenceError ||
      !savedPreference
    ) {
      console.error(
        '[competitions/preference] Preference write failed:',
        {
          competitionId,
          userId:
            user.id,
          entryAId:
            canonicalEntryAId,
          entryBId:
            canonicalEntryBId,
          preferredEntryId,
          error:
            preferenceError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not save competition preference.',
        },
        {
          status: 500,
        }
      )
    }

    // =========================================================
    // RESPONSE
    // =========================================================

    return NextResponse.json(
      {
        preference: {
          id:
            savedPreference.id,

          competitionId:
            savedPreference.competition_id,

          entryAId:
            savedPreference.entry_a_id,

          entryBId:
            savedPreference.entry_b_id,

          preferredEntryId:
            savedPreference.preferred_entry_id,

          updatedAt:
            savedPreference.updated_at,
        },

        qualifiedEntryCount:
          qualifiedEntryIds.size,
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[competitions/preference] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error saving competition preference.',
      },
      {
        status: 500,
      }
    )
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

function readUuid(
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

  return isUuid(
    normalized
  )
    ? normalized
    : null
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

// ============================================================
// PAIR CANONICALIZATION
// ============================================================

function canonicalizeEntryPair(
  firstEntryId: string,
  secondEntryId: string
): [
  string,
  string,
] {
  return firstEntryId.localeCompare(
    secondEntryId
  ) <= 0
    ? [
        firstEntryId,
        secondEntryId,
      ]
    : [
        secondEntryId,
        firstEntryId,
      ]
}