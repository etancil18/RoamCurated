import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'
import {
  recomputeCompetitionScores,
  CompetitionScoreRecomputeError,
} from '@/lib/competitions/recomputeScores'
import {
  rankCompetitionEntryScores,
} from '@/lib/competitions/scoring'

type RouteContext = {
  params: Promise<{
    competition_id: string
  }>
}

type CompetitionRow = {
  id: string
  status: string

  minimum_qualified_participants: number
  minimum_cross_completers: number

  winner_entry_id: string | null
  result_status:
    | 'pending'
    | 'winner'
    | 'tie'
    | 'insufficient_evidence'
    | 'void'

  anonymous_entries: boolean
}

type SettlementResultStatus =
  | 'winner'
  | 'tie'
  | 'insufficient_evidence'

type SettlementDecision = {
  resultStatus: SettlementResultStatus
  winnerEntryId: string | null
  reason:
    | 'winner'
    | 'exact_score_tie'
    | 'minimum_qualified_participants'
    | 'minimum_cross_completers'
}

type SettlementRpcResponse = {
  competition_id: string
  result_status: SettlementResultStatus
  winner_entry_id: string | null
  settled_at: string
}

const ALLOWED_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

export async function POST(
  _request: Request,
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
    // AUTHENTICATE ADMIN
    // =========================================================

    const authSupabase =
      await createServerClient()

    const {
      data: {
        user,
      },
      error:
        authError,
    } =
      await authSupabase.auth.getUser()

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

    const normalizedEmail =
      user.email
        ?.trim()
        .toLowerCase() ??
      ''

    if (
      !normalizedEmail ||
      !ALLOWED_ADMIN_EMAILS.has(
        normalizedEmail
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Admin access required.',
        },
        {
          status: 403,
        }
      )
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    // =========================================================
    // LOAD COMPETITION
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
        status,
        minimum_qualified_participants,
        minimum_cross_completers,
        winner_entry_id,
        result_status,
        anonymous_entries
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
        '[admin/competitions/settle] Competition lookup failed:',
        {
          competitionId,
          adminUserId:
            user.id,
          error:
            competitionError,
        }
      )

      return NextResponse.json(
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

    // =========================================================
    // IDEMPOTENT COMPLETED CASE
    // =========================================================

    if (
      competition.status ===
      'completed'
    ) {
      return NextResponse.json(
        {
          competition: {
            id:
              competition.id,

            status:
              competition.status,

            resultStatus:
              competition.result_status,

            winnerEntryId:
              competition.winner_entry_id,

            identitiesRevealed:
              competition.anonymous_entries ===
              false,
          },

          alreadySettled:
            true,
        },
        {
          status: 200,
        }
      )
    }

    if (
      competition.status !==
      'scoring'
    ) {
      return NextResponse.json(
        {
          error:
            'Competition must be in scoring status before settlement.',
        },
        {
          status: 409,
        }
      )
    }

    // =========================================================
    // FREEZE FINAL SCORE SNAPSHOT
    // =========================================================

    /**
     * This is the canonical score recomputation boundary.
     *
     * It:
     *
     *   - derives evidence from trusted tables
     *   - calls scoring.ts
     *   - writes append-only score snapshots
     *
     * snapshot_type = settlement is the frozen score set used by
     * this settlement attempt.
     */
    const recomputed =
      await recomputeCompetitionScores({
        competitionId,

        snapshotType:
          'settlement',

        serviceSupabase,
      })

    if (
      recomputed.entries.length <
        2 ||
      recomputed.entries.length >
        4
    ) {
      return NextResponse.json(
        {
          error:
            'Settlement requires 2–4 scored competition entries.',
        },
        {
          status: 409,
        }
      )
    }

    // =========================================================
    // DERIVE RESULT
    // =========================================================

    const decision =
      deriveSettlementDecision({
        competition,

        scoredEntries:
          recomputed.entries.map(
            (
              entry
            ) => ({
              entryId:
                entry.entryId,

              finalScore:
                entry.result.finalScore,

              confidenceScore:
                entry.result.confidenceScore,

              qualifiedParticipantCount:
                entry.result
                  .qualifiedParticipantCount,

              crossCompleterCount:
                entry.result
                  .crossCompleterCount,
            })
          ),
      })

    // =========================================================
    // TRANSACTIONAL COMMIT
    // =========================================================

    /**
     * IMPORTANT:
     *
     * The RPC is the atomic settlement boundary.
     *
     * It must:
     *
     *   1. lock the competition row
     *   2. ensure status is still scoring
     *   3. verify all supplied snapshot IDs belong to the
     *      competition and are snapshot_type='settlement'
     *   4. insert exactly one competition_results record
     *   5. update competitions:
     *        status='completed'
     *        result_status=<decision>
     *        winner_entry_id=<winner/null>
     *        anonymous_entries=false
     *   6. commit all-or-nothing
     */
    const snapshotIds =
      recomputed.entries.map(
        (
          entry
        ) =>
          entry.snapshotId
      )

    const {
      data:
        settlementData,
      error:
        settlementError,
    } = await serviceSupabase
      .rpc(
        'settle_competition_from_snapshots',
        {
          p_competition_id:
            competitionId,

          p_result_status:
            decision.resultStatus,

          p_winner_entry_id:
            decision.winnerEntryId,

          p_snapshot_ids:
            snapshotIds,

          p_algorithm_version:
            recomputed.algorithmVersion,

          p_settled_by:
            user.id,
        }
      )

    if (
      settlementError
    ) {
      console.error(
        '[admin/competitions/settle] Settlement RPC failed:',
        {
          competitionId,

          adminUserId:
            user.id,

          decision,

          snapshotIds,

          error:
            settlementError,
        }
      )

      return NextResponse.json(
        {
          error:
            mapSettlementRpcError(
              settlementError.message
            ),
        },
        {
          status:
            getSettlementRpcStatus(
              settlementError.message
            ),
        }
      )
    }

    const settlement =
      readSettlementRpcResponse(
        settlementData
      )

    if (
      !settlement
    ) {
      console.error(
        '[admin/competitions/settle] Settlement RPC returned invalid payload:',
        {
          competitionId,
          settlementData,
        }
      )

      return NextResponse.json(
        {
          error:
            'Competition settled, but the settlement response was invalid.',
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
        competition: {
          id:
            settlement.competition_id,

          status:
            'completed',

          resultStatus:
            settlement.result_status,

          winnerEntryId:
            settlement.winner_entry_id,

          identitiesRevealed:
            true,

          settledAt:
            settlement.settled_at,
        },

        settlement: {
          reason:
            decision.reason,

          snapshotType:
            recomputed.snapshotType,

          algorithmVersion:
            recomputed.algorithmVersion,

          calculatedAt:
            recomputed.calculatedAt,

          entries:
            recomputed.entries.map(
              (
                entry
              ) => ({
                entryId:
                  entry.entryId,

                contenderSlot:
                  entry.contenderSlot,

                finalScore:
                  entry.result.finalScore,

                confidenceScore:
                  entry.result.confidenceScore,

                qualifiedParticipantCount:
                  entry.result
                    .qualifiedParticipantCount,

                crossCompleterCount:
                  entry.result
                    .crossCompleterCount,

                snapshotId:
                  entry.snapshotId,
              })
            ),
        },
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    if (
      error instanceof
      CompetitionScoreRecomputeError
    ) {
      console.error(
        '[admin/competitions/settle] Score recomputation failed:',
        {
          code:
            error.code,

          message:
            error.message,

          cause:
            error.cause,
        }
      )

      return NextResponse.json(
        {
          error:
            error.message,

          code:
            error.code,
        },
        {
          status: 409,
        }
      )
    }

    console.error(
      '[admin/competitions/settle] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error settling competition.',
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// RESULT DERIVATION
// ============================================================

function deriveSettlementDecision({
  competition,
  scoredEntries,
}: {
  competition: Pick<
    CompetitionRow,
    | 'minimum_qualified_participants'
    | 'minimum_cross_completers'
  >

  scoredEntries: {
    entryId: string
    finalScore: number
    confidenceScore: number
    qualifiedParticipantCount: number
    crossCompleterCount: number
  }[]
}): SettlementDecision {
  const minimumQualifiedParticipants =
    normalizeThreshold(
      competition
        .minimum_qualified_participants
    )

  const minimumCrossCompleters =
    normalizeThreshold(
      competition
        .minimum_cross_completers
    )

  /**
   * Thresholds are per contender.
   *
   * If any approved contender lacks the configured minimum evidence,
   * the competition does not have enough symmetric evidence to
   * declare a winner.
   */
  const lacksQualifiedMinimum =
    scoredEntries.some(
      (
        entry
      ) =>
        entry.qualifiedParticipantCount <
        minimumQualifiedParticipants
    )

  if (
    lacksQualifiedMinimum
  ) {
    return {
      resultStatus:
        'insufficient_evidence',

      winnerEntryId:
        null,

      reason:
        'minimum_qualified_participants',
    }
  }

  const lacksCrossCompleterMinimum =
    scoredEntries.some(
      (
        entry
      ) =>
        entry.crossCompleterCount <
        minimumCrossCompleters
    )

  if (
    lacksCrossCompleterMinimum
  ) {
    return {
      resultStatus:
        'insufficient_evidence',

      winnerEntryId:
        null,

      reason:
        'minimum_cross_completers',
    }
  }

  const ranked =
    rankCompetitionEntryScores(
      scoredEntries.map(
        (
          entry
        ) => ({
          entryId:
            entry.entryId,

          finalScore:
            entry.finalScore,

          confidenceScore:
            entry.confidenceScore,

          qualifiedParticipantCount:
            entry.qualifiedParticipantCount,
        })
      )
    )

  const first =
    ranked[0]

  const second =
    ranked[1]

  if (
    !first ||
    !second
  ) {
    throw new Error(
      'Settlement ranking requires at least two entries.'
    )
  }

  /**
   * V1 does not invent a score-margin threshold.
   *
   * An exact finalScore tie settles as a tie.
   *
   * Otherwise the canonical scoring rank determines the winner.
   *
   * If you later introduce a configurable "close enough = tie"
   * threshold, add it as explicit competition configuration rather
   * than burying a magic epsilon in this endpoint.
   */
  if (
    first.finalScore ===
    second.finalScore
  ) {
    return {
      resultStatus:
        'tie',

      winnerEntryId:
        null,

      reason:
        'exact_score_tie',
    }
  }

  return {
    resultStatus:
      'winner',

    winnerEntryId:
      first.entryId,

    reason:
      'winner',
  }
}

// ============================================================
// RPC RESPONSE
// ============================================================

function readSettlementRpcResponse(
  value: unknown
): SettlementRpcResponse | null {
  const row =
    Array.isArray(
      value
    )
      ? value[0]
      : value

  if (
    !row ||
    typeof row !==
      'object'
  ) {
    return null
  }

  const record =
    row as Record<
      string,
      unknown
    >

  const competitionId =
    typeof record.competition_id ===
      'string'
      ? record.competition_id
      : null

  const resultStatus =
    readResultStatus(
      record.result_status
    )

  const winnerEntryId =
    record.winner_entry_id ===
      null
      ? null
      : typeof record.winner_entry_id ===
          'string'
        ? record.winner_entry_id
        : undefined

  const settledAt =
    typeof record.settled_at ===
      'string'
      ? record.settled_at
      : null

  if (
    !competitionId ||
    !resultStatus ||
    winnerEntryId ===
      undefined ||
    !settledAt
  ) {
    return null
  }

  return {
    competition_id:
      competitionId,

    result_status:
      resultStatus,

    winner_entry_id:
      winnerEntryId,

    settled_at:
      settledAt,
  }
}

function readResultStatus(
  value: unknown
): SettlementResultStatus | null {
  switch (value) {
    case 'winner':
    case 'tie':
    case 'insufficient_evidence':
      return value

    default:
      return null
  }
}

// ============================================================
// RPC ERROR MAPPING
// ============================================================

function mapSettlementRpcError(
  message: string
): string {
  if (
    message.includes(
      'COMPETITION_ALREADY_SETTLED'
    )
  ) {
    return 'Competition is already settled.'
  }

  if (
    message.includes(
      'COMPETITION_NOT_SCORING'
    )
  ) {
    return 'Competition must still be in scoring status.'
  }

  if (
    message.includes(
      'INVALID_WINNER_ENTRY'
    )
  ) {
    return 'Winner entry does not belong to this competition.'
  }

  if (
    message.includes(
      'INVALID_SETTLEMENT_SNAPSHOTS'
    )
  ) {
    return 'Settlement score snapshots are invalid or incomplete.'
  }

  return 'Could not finalize competition settlement.'
}

function getSettlementRpcStatus(
  message: string
): number {
  if (
    message.includes(
      'COMPETITION_ALREADY_SETTLED'
    ) ||
    message.includes(
      'COMPETITION_NOT_SCORING'
    ) ||
    message.includes(
      'INVALID_WINNER_ENTRY'
    ) ||
    message.includes(
      'INVALID_SETTLEMENT_SNAPSHOTS'
    )
  ) {
    return 409
  }

  return 500
}

// ============================================================
// CONFIG NORMALIZATION
// ============================================================

function normalizeThreshold(
  value: unknown
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isSafeInteger(
      value
    ) ||
    value <
      0
  ) {
    throw new Error(
      'Competition contains invalid minimum participation configuration.'
    )
  }

  return value
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
// IDENTIFIERS
// ============================================================

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}