import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    competitionId: string
    entryId: string
  }>
}

type StartCompetitionEntryFlowRpcRow = {
  competition_id: string
  competition_entry_id: string

  flow_session_id: string
  participation_id: string

  user_id: string

  created: boolean

  flow_title: string | null
  flow_city: string | null
  flow_venue_ids: string[]

  flow_status:
    | 'active'
    | 'completed'
    | 'cancelled'

  flow_started_at: string
  flow_completed_at: string | null

  verified_stop_count: number
  total_stop_count: number

  qualified: boolean

  participation_started_at: string
  participation_completed_at: string | null
}

type RpcErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

function isStartRpcRow(
  value: unknown
): value is StartCompetitionEntryFlowRpcRow {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false
  }

  const row =
    value as Record<string, unknown>

  return (
    isUuid(
      row.competition_id
    ) &&
    isUuid(
      row.competition_entry_id
    ) &&
    isUuid(
      row.flow_session_id
    ) &&
    isUuid(
      row.participation_id
    ) &&
    isUuid(
      row.user_id
    ) &&
    typeof row.created ===
      'boolean' &&
    (
      row.flow_title ===
        null ||
      typeof row.flow_title ===
        'string'
    ) &&
    (
      row.flow_city ===
        null ||
      typeof row.flow_city ===
        'string'
    ) &&
    Array.isArray(
      row.flow_venue_ids
    ) &&
    row.flow_venue_ids.every(
      (
        venueId
      ) =>
        typeof venueId ===
        'string'
    ) &&
    (
      row.flow_status ===
        'active' ||
      row.flow_status ===
        'completed' ||
      row.flow_status ===
        'cancelled'
    ) &&
    typeof row.flow_started_at ===
      'string' &&
    (
      row.flow_completed_at ===
        null ||
      typeof row.flow_completed_at ===
        'string'
    ) &&
    typeof row.verified_stop_count ===
      'number' &&
    typeof row.total_stop_count ===
      'number' &&
    typeof row.qualified ===
      'boolean' &&
    typeof row.participation_started_at ===
      'string' &&
    (
      row.participation_completed_at ===
        null ||
      typeof row.participation_completed_at ===
        'string'
    )
  )
}

function getRpcErrorCode(
  error: unknown
): string | null {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return null
  }

  const candidate =
    error as RpcErrorLike

  return typeof candidate.code ===
    'string'
    ? candidate.code
    : null
}

function getRpcErrorMessage(
  error: unknown
): string | null {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return null
  }

  const candidate =
    error as RpcErrorLike

  return typeof candidate.message ===
    'string'
    ? candidate.message
    : null
}

function normalizeRpcMessage(
  message: string | null
): string {
  const normalized =
    message
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    normalized.includes(
      'competition is not live'
    )
  ) {
    return 'This competition is not currently live.'
  }

  if (
    normalized.includes(
      'competition entry is not approved'
    )
  ) {
    return 'This contender is not available for participation.'
  }

  if (
    normalized.includes(
      'cannot participate in own entry'
    )
  ) {
    return 'You cannot participate in your own competition entry.'
  }

  if (
    normalized.includes(
      'competition not found'
    )
  ) {
    return 'Competition not found.'
  }

  if (
    normalized.includes(
      'competition entry not found'
    )
  ) {
    return 'Competition entry not found.'
  }

  if (
    normalized.includes(
      'fewer than 3 stops'
    ) ||
    normalized.includes(
      'route has no stops'
    )
  ) {
    return 'This competition entry does not contain a valid route.'
  }

  if (
    normalized.includes(
      'missing its active flow session'
    ) ||
    normalized.includes(
      'missing its canonical active flow'
    ) ||
    normalized.includes(
      'missing its competition flow bridge'
    )
  ) {
    return 'This existing competition participation has inconsistent state.'
  }

  if (
    normalized.includes(
      'not authenticated'
    )
  ) {
    return 'User not authenticated.'
  }

  return (
    message?.trim() ||
    'Could not start competition entry.'
  )
}

function getRpcHttpStatus(
  error: unknown
): 400 | 401 | 403 | 404 | 409 | 500 {
  const code =
    getRpcErrorCode(
      error
    )

  const message =
    getRpcErrorMessage(
      error
    )
      ?.toLowerCase() ??
    ''

  if (
    message.includes(
      'not authenticated'
    )
  ) {
    return 401
  }

  if (
    code ===
      '42501'
  ) {
    return 403
  }

  if (
    message.includes(
      'competition not found'
    ) ||
    message.includes(
      'competition entry not found'
    )
  ) {
    return 404
  }

  if (
    code ===
      '23505' ||
    code ===
      '23514' ||
    code ===
      'P0001'
  ) {
    return 409
  }

  return 500
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      competitionId,
      entryId,
    } =
      await context.params

    if (
      !isUuid(
        competitionId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid competition ID.',
        },
        {
          status:
            400,
        }
      )
    }

    if (
      !isUuid(
        entryId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid competition entry ID.',
        },
        {
          status:
            400,
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

    const {
      data,
      error:
        rpcError,
    } =
      await supabase.rpc(
        'start_competition_entry_flow',
        {
          p_competition_id:
            competitionId,

          p_competition_entry_id:
            entryId,
        } as never
      )

    if (
      rpcError
    ) {
      const status =
        getRpcHttpStatus(
          rpcError
        )

      const message =
        normalizeRpcMessage(
          getRpcErrorMessage(
            rpcError
          )
        )

      if (
        status >= 500
      ) {
        console.error(
          '[competitions/entry/start] RPC failed:',
          {
            competitionId,
            entryId,
            userId:
              user.id,
            code:
              getRpcErrorCode(
                rpcError
              ),
            message:
              getRpcErrorMessage(
                rpcError
              ),
            error:
              rpcError,
          }
        )
      } else {
        console.warn(
          '[competitions/entry/start] RPC rejected start:',
          {
            competitionId,
            entryId,
            userId:
              user.id,
            code:
              getRpcErrorCode(
                rpcError
              ),
            message:
              getRpcErrorMessage(
                rpcError
              ),
          }
        )
      }

      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status,
        }
      )
    }

    const rawRow =
      Array.isArray(
        data
      )
        ? data[0]
        : data

    if (
      !isStartRpcRow(
        rawRow
      )
    ) {
      console.error(
        '[competitions/entry/start] RPC returned invalid canonical state:',
        {
          competitionId,
          entryId,
          userId:
            user.id,
          data,
        }
      )

      return NextResponse.json(
        {
          error:
            'Competition entry start returned invalid state.',
        },
        {
          status:
            500,
        }
      )
    }

    if (
      rawRow.competition_id !==
        competitionId ||
      rawRow.competition_entry_id !==
        entryId ||
      rawRow.user_id !==
        user.id
    ) {
      console.error(
        '[competitions/entry/start] RPC returned mismatched identity:',
        {
          requestedCompetitionId:
            competitionId,
          returnedCompetitionId:
            rawRow.competition_id,

          requestedEntryId:
            entryId,
          returnedEntryId:
            rawRow.competition_entry_id,

          authenticatedUserId:
            user.id,
          returnedUserId:
            rawRow.user_id,
        }
      )

      return NextResponse.json(
        {
          error:
            'Competition entry start returned inconsistent state.',
        },
        {
          status:
            500,
        }
      )
    }

    if (
      rawRow.total_stop_count <
        3 ||
      rawRow.verified_stop_count <
        0 ||
      rawRow.verified_stop_count >
        rawRow.total_stop_count
    ) {
      console.error(
        '[competitions/entry/start] RPC returned invalid participation counts:',
        {
          competitionId,
          entryId,
          userId:
            user.id,
          verifiedStopCount:
            rawRow.verified_stop_count,
          totalStopCount:
            rawRow.total_stop_count,
        }
      )

      return NextResponse.json(
        {
          error:
            'Competition entry start returned invalid participation state.',
        },
        {
          status:
            500,
        }
      )
    }

    return NextResponse.json(
      {
        created:
          rawRow.created,

        competition: {
          id:
            rawRow.competition_id,
        },

        entry: {
          id:
            rawRow.competition_entry_id,
        },

        flowSession: {
          id:
            rawRow.flow_session_id,

          user_id:
            rawRow.user_id,

          title:
            rawRow.flow_title,

          city:
            rawRow.flow_city,

          venue_ids:
            rawRow.flow_venue_ids,

          status:
            rawRow.flow_status,

          started_at:
            rawRow.flow_started_at,

          completed_at:
            rawRow.flow_completed_at,
        },

        participation: {
          id:
            rawRow.participation_id,

          competition_id:
            rawRow.competition_id,

          competition_entry_id:
            rawRow.competition_entry_id,

          user_id:
            rawRow.user_id,

          flow_session_id:
            rawRow.flow_session_id,

          verified_stop_count:
            rawRow.verified_stop_count,

          total_stop_count:
            rawRow.total_stop_count,

          qualified:
            rawRow.qualified,

          started_at:
            rawRow.participation_started_at,

          completed_at:
            rawRow.participation_completed_at,
        },
      },
      {
        status:
          rawRow.created
            ? 201
            : 200,
      }
    )
  } catch (error) {
    console.error(
      '[competitions/entry/start] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error starting competition entry.',
      },
      {
        status:
          500,
      }
    )
  }
}