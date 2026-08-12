import { NextRequest, NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    snapshotId: string
  }>
}

type ReplayableSnapshotRow = {
  id: string
  user_id: string
  source_type: string
  source_id: string
  title: string | null
  city: string | null
  status: string
  visibility: string
  replayable: boolean
  total_stops: number | null
}

type SnapshotStopRow = {
  venue_id: string
  stop_index: number
}

type ExistingActiveFlowRow = {
  id: string
  title: string | null
  city: string | null
  started_at: string
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { snapshotId: rawSnapshotId } =
      await context.params

    const snapshotId =
      normalizeUuid(rawSnapshotId)

    if (!snapshotId) {
      return NextResponse.json(
        {
          error:
            'Snapshot ID is invalid.',
        },
        { status: 400 }
      )
    }

    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            'Create a free Roam account to replay this Flow and unlock the full experience.',
          code:
            'AUTH_REQUIRED',
          authRequired:
            true,
          redirectTo:
            '/login',
        },
        { status: 401 }
      )
    }

    /*
     * Replay initiative:
     *
     * The browser supplies only snapshotId.
     *
     * Snapshot ownership, original creator attribution,
     * replayability, title, city, and route contents are all
     * derived from canonical server-side data.
     */
    const {
      data: snapshot,
      error: snapshotError,
    } = await supabase
      .from('flow_snapshots')
      .select(`
        id,
        user_id,
        source_type,
        source_id,
        title,
        city,
        status,
        visibility,
        replayable,
        total_stops
      `)
      .eq(
        'id',
        snapshotId
      )
      .maybeSingle<ReplayableSnapshotRow>()

    if (snapshotError) {
      console.error(
        '[flow-snapshots/[snapshotId]/replay] Snapshot fetch failed:',
        snapshotError
      )

      return NextResponse.json(
        {
          error:
            'Could not load this Flow snapshot.',
        },
        { status: 500 }
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        {
          error:
            'Flow snapshot not found.',
        },
        { status: 404 }
      )
    }

    if (
      snapshot.visibility !==
      'public'
    ) {
      return NextResponse.json(
        {
          error:
            'This Flow snapshot is not public.',
        },
        { status: 403 }
      )
    }

    if (
      snapshot.replayable !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            'This Flow snapshot is not available for replay.',
        },
        { status: 409 }
      )
    }

    if (
      snapshot.status !==
      'completed'
    ) {
      return NextResponse.json(
        {
          error:
            'Only completed Flow snapshots can be replayed.',
        },
        { status: 409 }
      )
    }

    /*
     * Load the immutable route captured when the snapshot was
     * originally created.
     *
     * Never recover the route from the original active flow or
     * hosted flow here. The snapshot stops are now the canonical
     * replay source.
     */
    const {
      data: snapshotStops,
      error: snapshotStopsError,
    } = await supabase
      .from(
        'flow_snapshot_stops'
      )
      .select(
        'venue_id, stop_index'
      )
      .eq(
        'snapshot_id',
        snapshot.id
      )
      .order(
        'stop_index',
        {
          ascending: true,
        }
      )

    if (snapshotStopsError) {
      console.error(
        '[flow-snapshots/[snapshotId]/replay] Snapshot stop fetch failed:',
        snapshotStopsError
      )

      return NextResponse.json(
        {
          error:
            'Could not load this Flow route.',
        },
        { status: 500 }
      )
    }

    const canonicalRoute =
      normalizeCanonicalSnapshotRoute(
        snapshotStops
      )

    if (!canonicalRoute) {
      console.error(
        '[flow-snapshots/[snapshotId]/replay] Snapshot route is invalid:',
        {
          snapshotId:
            snapshot.id,
          stopCount:
            snapshotStops?.length ??
            0,
        }
      )

      return NextResponse.json(
        {
          error:
            'This Flow snapshot does not have a valid replay route.',
        },
        { status: 409 }
      )
    }

    const venueIds =
      canonicalRoute.map(
        (stop) =>
          stop.venueId
      )

    /*
     * The persisted snapshot summary and immutable route should
     * agree. Refuse replay rather than silently executing an
     * inconsistent historical artifact.
     */
    if (
      typeof snapshot.total_stops ===
        'number' &&
      Number.isInteger(
        snapshot.total_stops
      ) &&
      snapshot.total_stops >=
        0 &&
      snapshot.total_stops !==
        venueIds.length
    ) {
      console.error(
        '[flow-snapshots/[snapshotId]/replay] Snapshot stop count mismatch:',
        {
          snapshotId:
            snapshot.id,
          snapshotTotalStops:
            snapshot.total_stops,
          canonicalStopCount:
            venueIds.length,
        }
      )

      return NextResponse.json(
        {
          error:
            'This Flow snapshot has inconsistent route data and cannot be replayed.',
        },
        { status: 409 }
      )
    }

    /*
     * Preserve the existing platform invariant:
     *
     * one active flow per user.
     */
    const {
      data: existingActiveFlow,
      error: existingActiveFlowError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .select(
        'id, title, city, started_at'
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'status',
        'active'
      )
      .maybeSingle<ExistingActiveFlowRow>()

    if (
      existingActiveFlowError
    ) {
      console.error(
        '[flow-snapshots/[snapshotId]/replay] Existing active flow check failed:',
        existingActiveFlowError
      )

      return NextResponse.json(
        {
          error:
            'Could not check your current active Flow.',
        },
        { status: 500 }
      )
    }

    if (existingActiveFlow) {
      return NextResponse.json(
        {
          error:
            'You already have an active Flow.',
          activeSession:
            existingActiveFlow,
          redirectTo:
            `/flow/${existingActiveFlow.id}`,
        },
        { status: 409 }
      )
    }

    const now =
      new Date().toISOString()

    /*
     * Create an ordinary active_flow_session.
     *
     * The existing active-flow check-in and completion engine
     * handles execution from this point forward.
     *
     * source_creator_user_id is deliberately persisted on the
     * session so attribution survives future snapshot
     * unpublishing or deletion.
     *
     * Self-replay is intentionally allowed. Zero creator
     * attribution for self-replay will be enforced later in the
     * reward/reputation layer.
     */
    const insertPayload = {
      user_id:
        user.id,

      title:
        normalizeNullableText(
          snapshot.title
        ) ??
        'Roam Flow',

      city:
        normalizeNullableText(
          snapshot.city
        ),

      source:
        'flow_snapshot',

      source_id:
        snapshot.id,

      source_creator_user_id:
        snapshot.user_id,

      venue_ids:
        venueIds,

      travel_mode:
        'walking',

      status:
        'active',

      started_at:
        now,

      metadata: {
        replay: true,
        snapshotSourceType:
          snapshot.source_type,
        snapshotSourceId:
          snapshot.source_id,
      },
    } as any

    const {
      data: session,
      error: insertError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .insert(
        insertPayload
      )
      .select('*')
      .single()

    if (
      insertError ||
      !session
    ) {
      /*
       * The partial unique index on active_flow_sessions
       * protects against two concurrent replay/start requests
       * creating more than one active session for the same user.
       */
      if (
        isUniqueConstraintViolation(
          insertError
        )
      ) {
        const {
          data:
            concurrentActiveFlow,
        } = await supabase
          .from(
            'active_flow_sessions'
          )
          .select(
            'id, title, city, started_at'
          )
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'status',
            'active'
          )
          .maybeSingle<ExistingActiveFlowRow>()

        return NextResponse.json(
          {
            error:
              'You already have an active Flow.',
            activeSession:
              concurrentActiveFlow ??
              null,
            redirectTo:
              concurrentActiveFlow
                ? `/flow/${concurrentActiveFlow.id}`
                : null,
          },
          { status: 409 }
        )
      }

      console.error(
        '[flow-snapshots/[snapshotId]/replay] Active flow creation failed:',
        insertError
      )

      return NextResponse.json(
        {
          error:
            'Could not start this Flow replay.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        session,
        redirectTo:
          `/flow/${session.id}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error(
      '[flow-snapshots/[snapshotId]/replay] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error starting Flow replay.',
      },
      { status: 500 }
    )
  }
}

function normalizeCanonicalSnapshotRoute(
  value: unknown
):
  | Array<{
      venueId: string
      stopIndex: number
    }>
  | null {
  if (
    !Array.isArray(value) ||
    value.length < 2
  ) {
    return null
  }

  const normalizedStops:
    Array<{
      venueId: string
      stopIndex: number
    }> = []

  const venueIds =
    new Set<string>()

  for (
    let expectedStopIndex = 0;
    expectedStopIndex <
    value.length;
    expectedStopIndex += 1
  ) {
    const row =
      value[
        expectedStopIndex
      ]

    if (
      typeof row !==
        'object' ||
      row === null ||
      Array.isArray(row)
    ) {
      return null
    }

    const record =
      row as Record<
        string,
        unknown
      >

    const venueId =
      normalizeUuid(
        record.venue_id
      )

    const stopIndex =
      record.stop_index

    if (
      !venueId ||
      typeof stopIndex !==
        'number' ||
      !Number.isInteger(
        stopIndex
      ) ||
      stopIndex !==
        expectedStopIndex
    ) {
      return null
    }

    if (
      venueIds.has(
        venueId
      )
    ) {
      return null
    }

    venueIds.add(
      venueId
    )

    normalizedStops.push({
      venueId,
      stopIndex,
    })
  }

  return normalizedStops
}

function normalizeUuid(
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

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? normalized
    : null
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}

function isUniqueConstraintViolation(
  error: unknown
): boolean {
  return (
    typeof error ===
      'object' &&
    error !== null &&
    !Array.isArray(
      error
    ) &&
    (
      error as Record<
        string,
        unknown
      >
    ).code ===
      '23505'
  )
}