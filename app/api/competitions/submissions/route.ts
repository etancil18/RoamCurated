import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type ActiveFlowSubmissionBody = {
  competition_id?: string
  submission_source?: 'active_flow'
  flow_session_id?: string
}

type VisitHistorySubmissionBody = {
  competition_id?: string
  submission_source?: 'visit_history'
  visit_date?: string
}

type CompetitionSubmissionBody =
  | ActiveFlowSubmissionBody
  | VisitHistorySubmissionBody

type CompetitionRow = {
  id: string
  title: string
  city: string | null
  category: string | null
  status:
    | 'draft'
    | 'scheduled'
    | 'live'
    | 'scoring'
    | 'completed'
    | 'cancelled'
  starts_at: string | null
  ends_at: string | null
  max_entries: number
}

type ActiveFlowSessionRow = {
  id: string
  user_id: string
  title: string | null
  city: string | null
  venue_ids: string[]
  status: string
  started_at: string
  completed_at: string | null
  completed_stops: number
}

type ActiveFlowProgressRow = {
  venue_id: string
}

type VenueVisitRow = {
  id: string
  user_id: string
  venue_id: string
  visited_at: string
  visit_date: string | null
}

type CompetitionSubmissionInsert = {
  competition_id: string
  user_id: string

  submission_source:
    | 'active_flow'
    | 'visit_history'

  flow_session_id: string | null
  visit_date: string | null

  venue_ids: string[]

  route_title: string | null
  route_city: string | null

  route_started_at: string | null
  route_completed_at: string | null

  verified_venue_count: number

  status: 'pending'

  reviewed_by: null
  reviewed_at: null
  rejection_reason: null
  competition_entry_id: null
}


// ============================================================
// CONSTANTS
// ============================================================

const MIN_COMPETITION_ROUTE_STOPS = 3

const ACCEPTING_SUBMISSION_STATUSES =
  new Set<
    CompetitionRow['status']
  >([
    'scheduled',
    'live',
  ])


// ============================================================
// RESPONSE HELPERS
// ============================================================

function badRequest(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 400,
    }
  )
}

function conflict(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 409,
    }
  )
}

function forbidden(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  )
}

function notFound(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 404,
    }
  )
}

function internalError(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 500,
    }
  )
}


// ============================================================
// VALIDATION HELPERS
// ============================================================

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value ===
      'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

function isIsoDate(
  value: unknown
): value is string {
  if (
    typeof value !==
    'string'
  ) {
    return false
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false
  }

  return (
    date
      .toISOString()
      .slice(
        0,
        10
      ) ===
    value
  )
}

function dedupePreservingOrder(
  venueIds: string[]
): string[] {
  const seen =
    new Set<string>()

  const result: string[] =
    []

  for (
    const venueId
    of venueIds
  ) {
    if (
      !venueId ||
      seen.has(
        venueId
      )
    ) {
      continue
    }

    seen.add(
      venueId
    )

    result.push(
      venueId
    )
  }

  return result
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


// ============================================================
// COMPETITION VALIDATION
// ============================================================

function validateCompetitionAcceptsSubmissions(
  competition: CompetitionRow
): NextResponse | null {
  if (
    !ACCEPTING_SUBMISSION_STATUSES.has(
      competition.status
    )
  ) {
    return conflict(
      'This competition is not accepting submissions.'
    )
  }

  const now =
    Date.now()

  if (
    competition.ends_at
  ) {
    const endsAt =
      new Date(
        competition.ends_at
      ).getTime()

    if (
      !Number.isNaN(
        endsAt
      ) &&
      now > endsAt
    ) {
      return conflict(
        'This competition has already ended.'
      )
    }
  }

  return null
}


// ============================================================
// ACTIVE FLOW SOURCE
// ============================================================

async function buildActiveFlowSubmission({
  supabase,
  competition,
  userId,
  sessionId,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  competition: CompetitionRow
  userId: string
  sessionId: string
}): Promise<
  | {
      ok: true
      submission:
        CompetitionSubmissionInsert
    }
  | {
      ok: false
      response:
        NextResponse
    }
> {
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from(
      'active_flow_sessions'
    )
    .select(
      'id, user_id, title, city, venue_ids, status, started_at, completed_at, completed_stops'
    )
    .eq(
      'id',
      sessionId
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle()

  if (sessionError) {
    console.error(
      '[competitions/submissions] Active Flow fetch failed:',
      {
        competitionId:
          competition.id,
        userId,
        sessionId,
        error:
          sessionError,
      }
    )

    return {
      ok: false,
      response:
        internalError(
          'Could not validate Active Flow.'
        ),
    }
  }

  if (!session) {
    return {
      ok: false,
      response:
        notFound(
          'Completed Active Flow not found.'
        ),
    }
  }

  const flow =
    session as
      ActiveFlowSessionRow

  if (
    flow.status !==
      'completed' ||
    !flow.completed_at
  ) {
    return {
      ok: false,
      response:
        conflict(
          'Only completed Active Flows can be submitted.'
        ),
    }
  }

  const venueIds =
    dedupePreservingOrder(
      Array.isArray(
        flow.venue_ids
      )
        ? flow.venue_ids.filter(
            (
              venueId
            ): venueId is string =>
              typeof venueId ===
                'string' &&
              venueId.length >
                0
          )
        : []
    )

  if (
    venueIds.length <
    MIN_COMPETITION_ROUTE_STOPS
  ) {
    return {
      ok: false,
      response:
        conflict(
          `Competition routes require at least ${MIN_COMPETITION_ROUTE_STOPS} venues.`
        ),
    }
  }

  /**
   * Re-read canonical progress instead of trusting
   * active_flow_sessions.completed_stops.
   *
   * The completion endpoint already requires every route stop to
   * have progress evidence, but this endpoint independently
   * validates that invariant before creating a competition
   * submission snapshot.
   */
  const {
    data: progressRows,
    error: progressError,
  } = await supabase
    .from(
      'active_flow_progress'
    )
    .select(
      'venue_id'
    )
    .eq(
      'session_id',
      sessionId
    )
    .eq(
      'user_id',
      userId
    )

  if (progressError) {
    console.error(
      '[competitions/submissions] Active Flow progress validation failed:',
      {
        competitionId:
          competition.id,
        userId,
        sessionId,
        error:
          progressError,
      }
    )

    return {
      ok: false,
      response:
        internalError(
          'Could not validate Active Flow progress.'
        ),
    }
  }

  const routeVenueSet =
    new Set(
      venueIds
    )

  const verifiedVenueIds =
    new Set(
      (
        progressRows ??
        []
      )
        .map(
          (
            row
          ) =>
            (
              row as
                ActiveFlowProgressRow
            ).venue_id
        )
        .filter(
          (
            venueId
          ): venueId is string =>
            typeof venueId ===
              'string' &&
            routeVenueSet.has(
              venueId
            )
        )
    )

  if (
    verifiedVenueIds.size <
    venueIds.length
  ) {
    return {
      ok: false,
      response:
        conflict(
          'Active Flow completion evidence is incomplete.'
        ),
    }
  }

  return {
    ok: true,

    submission: {
      competition_id:
        competition.id,

      user_id:
        userId,

      submission_source:
        'active_flow',

      flow_session_id:
        sessionId,

      visit_date:
        null,

      venue_ids:
        venueIds,

      route_title:
        flow.title ??
        null,

      route_city:
        flow.city ??
        competition.city ??
        null,

      route_started_at:
        flow.started_at ??
        null,

      route_completed_at:
        flow.completed_at,

      verified_venue_count:
        verifiedVenueIds.size,

      status:
        'pending',

      reviewed_by:
        null,

      reviewed_at:
        null,

      rejection_reason:
        null,

      competition_entry_id:
        null,
    },
  }
}


// ============================================================
// VISIT HISTORY SOURCE
// ============================================================

async function buildVisitHistorySubmission({
  supabase,
  competition,
  userId,
  visitDate,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  competition: CompetitionRow
  userId: string
  visitDate: string
}): Promise<
  | {
      ok: true
      submission:
        CompetitionSubmissionInsert
    }
  | {
      ok: false
      response:
        NextResponse
    }
> {
  /**
   * venue_visits has a canonical visit_date column.
   *
   * Use it instead of deriving a calendar date from visited_at;
   * that avoids timezone ambiguity in a day-based Visit History
   * submission.
   */
  const {
    data: visits,
    error: visitsError,
  } = await supabase
    .from(
      'venue_visits'
    )
    .select(
      'id, user_id, venue_id, visited_at, visit_date'
    )
    .eq(
      'user_id',
      userId
    )
    .eq(
      'visit_date',
      visitDate
    )
    .order(
      'visited_at',
      {
        ascending:
          true,
      }
    )
    .order(
      'created_at',
      {
        ascending:
          true,
      }
    )

  if (visitsError) {
    console.error(
      '[competitions/submissions] Visit History fetch failed:',
      {
        competitionId:
          competition.id,
        userId,
        visitDate,
        error:
          visitsError,
      }
    )

    return {
      ok: false,
      response:
        internalError(
          'Could not validate Visit History.'
        ),
    }
  }

  const visitRows =
    (
      visits ??
      []
    ) as VenueVisitRow[]

  /**
   * venue_visits is already the canonical persisted Visit History
   * record. We therefore treat each unique persisted venue visit
   * for that day as competition route evidence.
   *
   * We intentionally do not require geo_verified=true here:
   * Active Flow completion itself can include canonical check-in
   * evidence from multiple supported sources, and competition
   * qualification is based on canonical visit evidence rather
   * than GPS alone.
   */
  const venueIds =
    dedupePreservingOrder(
      visitRows.map(
        (
          visit
        ) =>
          String(
            visit.venue_id
          )
      )
    )

  if (
    venueIds.length <
    MIN_COMPETITION_ROUTE_STOPS
  ) {
    return {
      ok: false,
      response:
        conflict(
          `Visit History requires at least ${MIN_COMPETITION_ROUTE_STOPS} visited venues on the selected day.`
        ),
    }
  }

  const routeStartedAt =
    visitRows[0]
      ?.visited_at ??
    null

  const routeCompletedAt =
    visitRows[
      visitRows.length - 1
    ]
      ?.visited_at ??
    null

  return {
    ok: true,

    submission: {
      competition_id:
        competition.id,

      user_id:
        userId,

      submission_source:
        'visit_history',

      flow_session_id:
        null,

      visit_date:
        visitDate,

      venue_ids:
        venueIds,

      /**
       * Visit History routes do not currently have a canonical
       * route title stored in venue_visits.
       */
      route_title:
        null,

      route_city:
        competition.city ??
        null,

      route_started_at:
        routeStartedAt,

      route_completed_at:
        routeCompletedAt,

      /**
       * This represents canonical competition evidence count,
       * not GPS-only verification count.
       *
       * The competition_submissions schema requires this count to
       * be >= 3 and <= cardinality(venue_ids).
       */
      verified_venue_count:
        venueIds.length,

      status:
        'pending',

      reviewed_by:
        null,

      reviewed_at:
        null,

      rejection_reason:
        null,

      competition_entry_id:
        null,
    },
  }
}


// ============================================================
// POST
// ============================================================

export async function POST(
  req: Request
) {
  try {
    const supabase =
      await createServerClient()

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'User not authenticated.',
        },
        {
          status:
            401,
        }
      )
    }

    let body:
      CompetitionSubmissionBody

    try {
      body =
        (await req.json()) as
          CompetitionSubmissionBody
    } catch {
      return badRequest(
        'Invalid JSON body.'
      )
    }

    const competitionId =
      body.competition_id

    const source =
      body.submission_source

    if (
      !isUuid(
        competitionId
      )
    ) {
      return badRequest(
        'Invalid or missing competition_id.'
      )
    }

    if (
      source !==
        'active_flow' &&
      source !==
        'visit_history'
    ) {
      return badRequest(
        'submission_source must be active_flow or visit_history.'
      )
    }

    const {
      data: competition,
      error:
        competitionError,
    } = await supabase
      .from(
        'competitions'
      )
      .select(
        'id, title, city, category, status, starts_at, ends_at, max_entries'
      )
      .eq(
        'id',
        competitionId
      )
      .maybeSingle()

    if (
      competitionError
    ) {
      console.error(
        '[competitions/submissions] Competition fetch failed:',
        {
          competitionId,
          userId:
            user.id,
          error:
            competitionError,
        }
      )

      return internalError(
        'Could not validate competition.'
      )
    }

    if (!competition) {
      return notFound(
        'Competition not found.'
      )
    }

    const competitionRow =
      competition as
        CompetitionRow

    const competitionStateError =
      validateCompetitionAcceptsSubmissions(
        competitionRow
      )

    if (
      competitionStateError
    ) {
      return competitionStateError
    }


    // ========================================================
    // RECONSTRUCT CANONICAL SOURCE EVIDENCE
    // ========================================================

    let builtSubmission:
      | {
          ok: true
          submission:
            CompetitionSubmissionInsert
        }
      | {
          ok: false
          response:
            NextResponse
        }


    if (
      source ===
      'active_flow'
    ) {
      const sessionId =
        (
          body as
            ActiveFlowSubmissionBody
        ).flow_session_id

      if (
        !isUuid(
          sessionId
        )
      ) {
        return badRequest(
          'Invalid or missing flow_session_id.'
        )
      }

      builtSubmission =
        await buildActiveFlowSubmission({
          supabase,

          competition:
            competitionRow,

          userId:
            user.id,

          sessionId,
        })
    } else {
      const visitDate =
        (
          body as
            VisitHistorySubmissionBody
        ).visit_date

      if (
        !isIsoDate(
          visitDate
        )
      ) {
        return badRequest(
          'Invalid or missing visit_date. Expected YYYY-MM-DD.'
        )
      }

      builtSubmission =
        await buildVisitHistorySubmission({
          supabase,

          competition:
            competitionRow,

          userId:
            user.id,

          visitDate,
        })
    }


    if (
      !builtSubmission.ok
    ) {
      return builtSubmission.response
    }


    // ========================================================
    // DUPLICATE PRECHECK
    // ========================================================

    /**
     * The database unique indexes remain the real concurrency
     * boundary.
     *
     * This precheck exists only to return a clearer API response
     * during ordinary use.
     */
    let duplicateQuery =
      supabase
        .from(
          'competition_submissions'
        )
        .select(
          'id, status, competition_entry_id'
        )
        .eq(
          'competition_id',
          competitionId
        )
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'submission_source',
          source
        )


    if (
  source ===
  'active_flow'
) {
  const flowSessionId =
    builtSubmission
      .submission
      .flow_session_id

  if (!flowSessionId) {
    console.error(
      '[competitions/submissions] Canonical Active Flow submission is missing flow_session_id:',
      {
        competitionId,
        userId:
          user.id,
      }
    )

    return internalError(
      'Canonical Active Flow submission state is invalid.'
    )
  }

  duplicateQuery =
    duplicateQuery.eq(
      'flow_session_id',
      flowSessionId
    )
} else {
  const visitDate =
    builtSubmission
      .submission
      .visit_date

  if (!visitDate) {
    console.error(
      '[competitions/submissions] Canonical Visit History submission is missing visit_date:',
      {
        competitionId,
        userId:
          user.id,
      }
    )

    return internalError(
      'Canonical Visit History submission state is invalid.'
    )
  }

  duplicateQuery =
    duplicateQuery.eq(
      'visit_date',
      visitDate
    )
}


    const {
      data:
        existingSubmission,
      error:
        duplicateError,
    } =
      await duplicateQuery
        .maybeSingle()


    if (
      duplicateError
    ) {
      console.error(
        '[competitions/submissions] Duplicate precheck failed:',
        {
          competitionId,
          userId:
            user.id,
          source,
          error:
            duplicateError,
        }
      )

      return internalError(
        'Could not validate duplicate submission state.'
      )
    }


    if (
      existingSubmission
    ) {
      return NextResponse.json(
        {
          error:
            'This route has already been submitted to this competition.',

          submission:
            existingSubmission,
        },
        {
          status:
            409,
        }
      )
    }


    // ========================================================
    // INSERT
    // ========================================================

    const {
      data: submission,
      error:
        insertError,
    } = await supabase
      .from(
        'competition_submissions'
      )
      .insert(
        builtSubmission
          .submission as any
      )
      .select(
        '*'
      )
      .single()


    if (
      insertError
    ) {
      const code =
        getPostgresErrorCode(
          insertError
        )

      /**
       * Concurrent duplicate requests can race past the friendly
       * precheck. The database uniqueness constraints remain the
       * final authority.
       */
      if (
        code ===
        '23505'
      ) {
        return conflict(
          'This route has already been submitted to this competition.'
        )
      }

      /**
       * Database checks/triggers may reject stale competition or
       * source state even after application validation.
       */
      if (
        code ===
          '23514' ||
        code ===
          'P0001'
      ) {
        console.warn(
          '[competitions/submissions] Submission rejected by database invariant:',
          {
            competitionId,
            userId:
              user.id,
            source,
            error:
              insertError,
          }
        )

        return conflict(
          'This route is no longer eligible for submission.'
        )
      }

      /**
       * RLS should permit only the authenticated user's own
       * pending submission. If it rejects the request, preserve
       * the security boundary rather than retrying with elevated
       * privileges.
       */
      if (
        code ===
        '42501'
      ) {
        console.warn(
          '[competitions/submissions] Submission blocked by authorization policy:',
          {
            competitionId,
            userId:
              user.id,
            source,
            error:
              insertError,
          }
        )

        return forbidden(
          'You are not allowed to create this submission.'
        )
      }

      console.error(
        '[competitions/submissions] Submission insert failed:',
        {
          competitionId,
          userId:
            user.id,
          source,
          error:
            insertError,
        }
      )

      return internalError(
        'Could not create competition submission.'
      )
    }


    return NextResponse.json(
      {
        submission,

        message:
          'Competition submission created and sent for review.',
      },
      {
        status:
          201,
      }
    )
  } catch (error) {
    console.error(
      '[competitions/submissions] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error creating competition submission.',
      },
      {
        status:
          500,
      }
    )
  }
}