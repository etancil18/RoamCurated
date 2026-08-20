import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    competition_id: string
  }>
}

type RateCompetitionEntryBody = {
  entry_id?: unknown
  rating?: unknown
}

type CompetitionEntryRow = {
  id: string
  competition_id: string
  status: string
}

type CompetitionParticipationRow = {
  id: string
  competition_id: string
  competition_entry_id: string
  user_id: string
  qualified: boolean
  completed_at: string | null
}

type CompetitionEntryRatingRow = {
  id: string
  competition_id: string
  competition_entry_id: string
  user_id: string
  rating: number
  created_at: string
  updated_at: string
}

const MIN_RATING = 1
const MAX_RATING = 5

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

    const body =
      (await req
        .json()
        .catch(
          () => ({})
        )) as RateCompetitionEntryBody

    const entryId =
      typeof body.entry_id ===
        'string'
        ? body.entry_id.trim()
        : ''

    const rating =
      body.rating

    if (
      !isUuid(
        entryId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid entry_id.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !isValidRating(
        rating
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}.`,
        },
        {
          status: 400,
        }
      )
    }

    /**
     * Use a trusted server-only client for the authorization and
     * write boundary.
     *
     * The browser never receives the service-role credential.
     */
    const serviceSupabase =
      createCompetitionServiceClient()

    // =========================================================
    // VERIFY ENTRY BELONGS TO THIS COMPETITION
    // =========================================================

    const {
      data:
        entry,
      error:
        entryError,
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
        'id',
        entryId
      )
      .eq(
        'competition_id',
        competitionId
      )
      .maybeSingle<CompetitionEntryRow>()

    if (entryError) {
      console.error(
        '[competitions/rate] Competition entry lookup failed:',
        {
          competitionId,
          entryId,
          userId:
            user.id,
          error:
            entryError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not verify competition entry.',
        },
        {
          status: 500,
        }
      )
    }

    if (!entry) {
      return NextResponse.json(
        {
          error:
            'Competition entry not found.',
        },
        {
          status: 404,
        }
      )
    }

    if (
      entry.status !==
      'approved'
    ) {
      return NextResponse.json(
        {
          error:
            'This competition entry is not available for rating.',
        },
        {
          status: 409,
        }
      )
    }

    // =========================================================
    // AUTHORITATIVE QUALIFICATION CHECK
    // =========================================================

    const {
      data:
        participation,
      error:
        participationError,
    } = await serviceSupabase
      .from(
        'competition_participations'
      )
      .select(`
        id,
        competition_id,
        competition_entry_id,
        user_id,
        qualified,
        completed_at
      `)
      .eq(
        'competition_id',
        competitionId
      )
      .eq(
        'competition_entry_id',
        entryId
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle<CompetitionParticipationRow>()

    if (
      participationError
    ) {
      console.error(
        '[competitions/rate] Participation lookup failed:',
        {
          competitionId,
          entryId,
          userId:
            user.id,
          error:
            participationError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not verify competition participation.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !participation
    ) {
      return NextResponse.json(
        {
          error:
            'You must participate in this contender before rating it.',
        },
        {
          status: 403,
        }
      )
    }

    if (
      participation.qualified !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            'Only qualified participation can rate this contender.',
        },
        {
          status: 403,
        }
      )
    }

    /**
     * Qualified competition participation is finalized from a
     * completed Active Flow. Keep this defensive check so malformed
     * or manually-edited participation data cannot authorize a
     * rating merely by flipping qualified=true.
     */
    if (
      !participation.completed_at
    ) {
      console.error(
        '[competitions/rate] Qualified participation is missing completed_at:',
        {
          competitionId,
          entryId,
          userId:
            user.id,
          participationId:
            participation.id,
        }
      )

      return NextResponse.json(
        {
          error:
            'Competition participation is not finalized.',
        },
        {
          status: 409,
        }
      )
    }

    // =========================================================
    // CREATE / REPLACE THE USER'S RATING
    // =========================================================

    const now =
      new Date()
        .toISOString()

    /**
     * One canonical rating per qualified participant per contender.
     *
     * Re-submitting changes the existing rating instead of creating
     * duplicate scoring evidence.
     */
    const {
      data:
        savedRating,
      error:
        ratingError,
    } = await serviceSupabase
      .from(
        'competition_entry_ratings'
      )
      .upsert(
        {
          competition_id:
            competitionId,

          competition_entry_id:
            entryId,

          user_id:
            user.id,

          rating,

          updated_at:
            now,
        },
        {
          onConflict:
            'competition_entry_id,user_id',
        }
      )
      .select(`
        id,
        competition_id,
        competition_entry_id,
        user_id,
        rating,
        created_at,
        updated_at
      `)
      .single<CompetitionEntryRatingRow>()

    if (
      ratingError ||
      !savedRating
    ) {
      console.error(
        '[competitions/rate] Rating write failed:',
        {
          competitionId,
          entryId,
          userId:
            user.id,
          participationId:
            participation.id,
          error:
            ratingError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not save competition rating.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(
      {
        rating: {
          id:
            savedRating.id,

          competitionId:
            savedRating.competition_id,

          competitionEntryId:
            savedRating.competition_entry_id,

          rating:
            savedRating.rating,

          updatedAt:
            savedRating.updated_at,
        },

        qualifiedParticipation: true,
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[competitions/rate] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error saving competition rating.',
      },
      {
        status: 500,
      }
    )
  }
}

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

function isValidRating(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >=
      MIN_RATING &&
    value <=
      MAX_RATING
  )
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}