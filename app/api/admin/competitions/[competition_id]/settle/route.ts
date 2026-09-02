import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

import {
  recomputeCompetitionScores,
  CompetitionScoreRecomputeError,
  type RecomputedCompetitionEntryScore,
  type CompetitionRecomputeAlgorithmVersion,
} from '@/lib/competitions/recomputeScores'

import {
  rankCompetitionEntryScores,
  COMPETITION_SCORING_ALGORITHM_VERSION,
  type CompetitionEntryScoringResult,
} from '@/lib/competitions/scoring'

import {
  VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION,
  type VenueParticipationScoringResult,
} from '@/lib/competitions/venueParticipationScoring'

// ============================================================
// ROUTE CONTRACT
// ============================================================

type RouteContext = {
  params: Promise<{
    competition_id: string
  }>
}

// ============================================================
// DATABASE ROWS
// ============================================================

type CompetitionRow = {
  id: string

  competition_type: string

  taste_duel_execution_mode:
    | 'itinerary'
    | 'venue_participation'
    | null

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

// ============================================================
// SETTLEMENT CONTRACT
// ============================================================

type SettlementResultStatus =
  | 'winner'
  | 'tie'
  | 'insufficient_evidence'

type SettlementDecisionReason =
  | 'winner'
  | 'exact_score_tie'
  | 'minimum_qualified_participants'
  | 'minimum_cross_completers'
  | 'minimum_venue_participants'
  | 'minimum_venue_ratings'
  | 'minimum_venue_confidence'

type SettlementDecision = {
  resultStatus: SettlementResultStatus

  winnerEntryId:
    string | null

  reason:
    SettlementDecisionReason
}

type SettlementRpcResponse = {
  competition_id: string

  result_status:
    SettlementResultStatus

  winner_entry_id:
    string | null

  settled_at:
    string
}

// ============================================================
// MODE-SPECIFIC SETTLEMENT EVIDENCE
// ============================================================

type ItinerarySettlementEntry = {
  entryId: string

  finalScore: number
  confidenceScore: number

  qualifiedParticipantCount: number
  crossCompleterCount: number
}

type VenueParticipationSettlementEntry = {
  entryId: string

  finalScore: number
  confidenceScore: number

  uniqueParticipantCount: number
  uniqueVenueVisitorCount: number

  weightedParticipation: number

  ratingCount: number
  averageRating: number | null

  venueCount: number
  visitedVenueCount: number
  breadthRate: number | null
}

// ============================================================
// VENUE-PARTICIPATION SETTLEMENT POLICY
// ============================================================

/**
 * Official settlement eligibility for:
 *
 *   taste_duel_venue_participation_v1
 *
 * IMPORTANT:
 *
 * These are SETTLEMENT thresholds.
 *
 * They are deliberately separate from:
 *
 *   minimum_qualified_participants
 *   minimum_cross_completers
 *
 * because those competition fields belong to itinerary semantics.
 *
 * Each contender must independently satisfy every threshold before
 * a venue-participation Taste Duel may declare an official winner
 * or tie.
 *
 * Changing these values changes settlement policy, not scoring
 * mathematics.
 */
const VENUE_PARTICIPATION_SETTLEMENT_MINIMUMS = {
  /**
   * Require multiple independent people before declaring an
   * official result.
   */
  uniqueParticipants:
    3,

  /**
   * Require enough direct quality observations that settlement is
   * not driven by one or two ratings.
   */
  ratings:
    3,

  /**
   * Combined evidence-confidence floor.
   *
   * This incorporates:
   *
   *   independent participants
   *   rating volume
   *   diminishing venue depth
   *
   * without converting traffic into quality points.
   */
  confidence:
    0.25,
} as const

// ============================================================
// ADMIN ACCESS
// ============================================================

const ALLOWED_ADMIN_EMAILS =
  new Set([
    'evantancil@gmail.com',
    'etancil92@gmail.com',
    'evantancil@roamcurated.com',
    'fyejono@gmail.com',
    'jonathangordon@roamcurated.com',
  ])

// ============================================================
// ROUTE
// ============================================================

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
        competition_type,
        taste_duel_execution_mode,
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
     * Canonical recomputation boundary.
     *
     * recomputeCompetitionScores() now dispatches by execution
     * mode before loading evidence:
     *
     *   itinerary
     *     -> competition_participations
     *     -> competition_entry_ratings
     *     -> itinerary scoring
     *
     *   venue_participation
     *     -> immutable venue participation events
     *     -> venue_visits
     *     -> venue-participation scoring
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
    // VERIFY EXECUTION MODE / ALGORITHM PAIR
    // =========================================================

    assertSettlementAlgorithmMatchesExecutionMode({
      competition,

      algorithmVersion:
        recomputed.algorithmVersion,
    })

    // =========================================================
    // DERIVE RESULT
    // =========================================================
    //
    // IMPORTANT:
    //
    // Settlement policy dispatches by immutable scoring algorithm.
    //
    // Itinerary settlement retains its existing evidence rules.
    //
    // Venue participation receives independent evidence rules and
    // never reads:
    //
    //   qualifiedParticipantCount
    //   crossCompleterCount
    //   completionScore
    //   repeatScore
    //   comparativeScore
    // =========================================================

    const decision =
      deriveSettlementDecision({
        competition,

        algorithmVersion:
          recomputed.algorithmVersion,

        scoredEntries:
          recomputed.entries,
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
     *
     *        status='completed'
     *        result_status=<decision>
     *        winner_entry_id=<winner/null>
     *        anonymous_entries=false
     *
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

          algorithmVersion:
            recomputed.algorithmVersion,

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
              ) =>
                serializeSettlementEntry({
                  algorithmVersion:
                    recomputed.algorithmVersion,

                  entry,
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
// SETTLEMENT DISPATCH
// ============================================================

function deriveSettlementDecision({
  competition,
  algorithmVersion,
  scoredEntries,
}: {
  competition: CompetitionRow

  algorithmVersion:
    CompetitionRecomputeAlgorithmVersion

  scoredEntries:
    RecomputedCompetitionEntryScore[]
}): SettlementDecision {
  switch (
    algorithmVersion
  ) {
    case COMPETITION_SCORING_ALGORITHM_VERSION.V1:
      return deriveItinerarySettlementDecision({
        competition,

        scoredEntries:
          scoredEntries.map(
            (
              entry
            ) =>
              toItinerarySettlementEntry(
                entry
              )
          ),
      })

    case VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION:
      return deriveVenueParticipationSettlementDecision({
        scoredEntries:
          scoredEntries.map(
            (
              entry
            ) =>
              toVenueParticipationSettlementEntry(
                entry
              )
          ),
      })

    default:
      throw new Error(
        `Unsupported settlement algorithm version: ${String(
          algorithmVersion
        )}.`
      )
  }
}

// ============================================================
// ITINERARY SETTLEMENT
// ============================================================
//
// EXISTING taste_duel_v1 BEHAVIOR.
//
// Do not reuse these evidence thresholds for venue participation.
// ============================================================

function deriveItinerarySettlementDecision({
  competition,
  scoredEntries,
}: {
  competition: Pick<
    CompetitionRow,
    | 'minimum_qualified_participants'
    | 'minimum_cross_completers'
  >

  scoredEntries:
    ItinerarySettlementEntry[]
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
   * Preserve existing taste_duel_v1 settlement behavior exactly.
   *
   * An exact final-score tie remains a tie.
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
// VENUE-PARTICIPATION SETTLEMENT
// ============================================================

function deriveVenueParticipationSettlementDecision({
  scoredEntries,
}: {
  scoredEntries:
    VenueParticipationSettlementEntry[]
}): SettlementDecision {
  // ==========================================================
  // MINIMUM UNIQUE PARTICIPANTS
  // ==========================================================

  const lacksParticipantMinimum =
    scoredEntries.some(
      (
        entry
      ) =>
        entry.uniqueParticipantCount <
        VENUE_PARTICIPATION_SETTLEMENT_MINIMUMS
          .uniqueParticipants
    )

  if (
    lacksParticipantMinimum
  ) {
    return {
      resultStatus:
        'insufficient_evidence',

      winnerEntryId:
        null,

      reason:
        'minimum_venue_participants',
    }
  }

  // ==========================================================
  // MINIMUM RATINGS
  // ==========================================================

  const lacksRatingMinimum =
    scoredEntries.some(
      (
        entry
      ) =>
        entry.ratingCount <
        VENUE_PARTICIPATION_SETTLEMENT_MINIMUMS
          .ratings
    )

  if (
    lacksRatingMinimum
  ) {
    return {
      resultStatus:
        'insufficient_evidence',

      winnerEntryId:
        null,

      reason:
        'minimum_venue_ratings',
    }
  }

  // ==========================================================
  // MINIMUM COMBINED CONFIDENCE
  // ==========================================================

  const lacksConfidenceMinimum =
    scoredEntries.some(
      (
        entry
      ) =>
        entry.confidenceScore <
        VENUE_PARTICIPATION_SETTLEMENT_MINIMUMS
          .confidence
    )

  if (
    lacksConfidenceMinimum
  ) {
    return {
      resultStatus:
        'insufficient_evidence',

      winnerEntryId:
        null,

      reason:
        'minimum_venue_confidence',
    }
  }

  // ==========================================================
  // AUTHORITATIVE RANKING
  // ==========================================================
  //
  // Venue participation does NOT use itinerary ranking evidence.
  //
  // Authoritative settlement ordering:
  //
  //   1. finalScore DESC
  //   2. confidenceScore DESC
  //   3. entryId lexical ASC
  //
  // An exact finalScore tie between the top two entries remains an
  // official tie.
  //
  // Confidence therefore produces deterministic ordering/auditing
  // but does not secretly turn equal official scores into a win.
  // ==========================================================

  const ranked =
    rankVenueParticipationSettlementEntries(
      scoredEntries
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
      'Venue-participation settlement ranking requires at least two entries.'
    )
  }

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
// VENUE-PARTICIPATION RANKING
// ============================================================

function rankVenueParticipationSettlementEntries(
  entries:
    readonly VenueParticipationSettlementEntry[]
): VenueParticipationSettlementEntry[] {
  return [
    ...entries,
  ].sort(
    (
      left,
      right
    ) => {
      if (
        right.finalScore !==
        left.finalScore
      ) {
        return (
          right.finalScore -
          left.finalScore
        )
      }

      if (
        right.confidenceScore !==
        left.confidenceScore
      ) {
        return (
          right.confidenceScore -
          left.confidenceScore
        )
      }

      return left.entryId.localeCompare(
        right.entryId
      )
    }
  )
}

// ============================================================
// MODE-SPECIFIC RESULT ADAPTERS
// ============================================================

function toItinerarySettlementEntry(
  entry:
    RecomputedCompetitionEntryScore
): ItinerarySettlementEntry {
  const result =
    entry.result

  if (
    !isItineraryScoringResult(
      result
    )
  ) {
    throw new Error(
      `Entry "${entry.entryId}" does not contain itinerary scoring evidence.`
    )
  }

  return {
    entryId:
      entry.entryId,

    finalScore:
      result.finalScore,

    confidenceScore:
      result.confidenceScore,

    qualifiedParticipantCount:
      result.qualifiedParticipantCount,

    crossCompleterCount:
      result.crossCompleterCount,
  }
}

function toVenueParticipationSettlementEntry(
  entry:
    RecomputedCompetitionEntryScore
): VenueParticipationSettlementEntry {
  const result =
    entry.result

  if (
    !isVenueParticipationScoringResult(
      result
    )
  ) {
    throw new Error(
      `Entry "${entry.entryId}" does not contain venue-participation scoring evidence.`
    )
  }

  return {
    entryId:
      entry.entryId,

    finalScore:
      result.finalScore,

    confidenceScore:
      result.confidenceScore,

    uniqueParticipantCount:
      result.uniqueParticipantCount,

    uniqueVenueVisitorCount:
      result.uniqueVenueVisitorCount,

    weightedParticipation:
      result.weightedParticipation,

    ratingCount:
      result.ratingCount,

    averageRating:
      result.averageRating,

    venueCount:
      result.venueCount,

    visitedVenueCount:
      result.visitedVenueCount,

    breadthRate:
      result.breadthRate,
  }
}

// ============================================================
// RESULT TYPE GUARDS
// ============================================================

function isItineraryScoringResult(
  result:
    CompetitionEntryScoringResult |
    VenueParticipationScoringResult
): result is CompetitionEntryScoringResult {
  return (
    result.algorithmVersion ===
      COMPETITION_SCORING_ALGORITHM_VERSION
        .V1
  )
}

function isVenueParticipationScoringResult(
  result:
    CompetitionEntryScoringResult |
    VenueParticipationScoringResult
): result is VenueParticipationScoringResult {
  return (
    result.algorithmVersion ===
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION
  )
}

// ============================================================
// EXECUTION MODE / ALGORITHM INVARIANT
// ============================================================

function assertSettlementAlgorithmMatchesExecutionMode({
  competition,
  algorithmVersion,
}: {
  competition: Pick<
    CompetitionRow,
    | 'competition_type'
    | 'taste_duel_execution_mode'
  >

  algorithmVersion:
    CompetitionRecomputeAlgorithmVersion
}): void {
  if (
    competition.competition_type !==
      'taste_duel'
  ) {
    throw new Error(
      `Unsupported competition type "${competition.competition_type}" for Taste Duel settlement.`
    )
  }

  switch (
    competition.taste_duel_execution_mode
  ) {
    case 'itinerary':
      if (
        algorithmVersion !==
          COMPETITION_SCORING_ALGORITHM_VERSION
            .V1
      ) {
        throw new Error(
          `Itinerary Taste Duel cannot settle algorithm "${algorithmVersion}".`
        )
      }

      return

    case 'venue_participation':
      if (
        algorithmVersion !==
          VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION
      ) {
        throw new Error(
          `Venue-participation Taste Duel cannot settle algorithm "${algorithmVersion}".`
        )
      }

      return

    default:
      throw new Error(
        `Taste Duel has invalid execution mode "${String(
          competition.taste_duel_execution_mode
        )}".`
      )
  }
}

// ============================================================
// SETTLEMENT RESPONSE SERIALIZATION
// ============================================================
//
// Avoid exposing fabricated itinerary evidence for venue mode.
// ============================================================

function serializeSettlementEntry({
  algorithmVersion,
  entry,
}: {
  algorithmVersion:
    CompetitionRecomputeAlgorithmVersion

  entry:
    RecomputedCompetitionEntryScore
}) {
  switch (
    algorithmVersion
  ) {
    case COMPETITION_SCORING_ALGORITHM_VERSION.V1: {
      const result =
        entry.result

      if (
        !isItineraryScoringResult(
          result
        )
      ) {
        throw new Error(
          `Entry "${entry.entryId}" contains the wrong scoring result for itinerary settlement.`
        )
      }

      return {
        entryId:
          entry.entryId,

        contenderSlot:
          entry.contenderSlot,

        finalScore:
          result.finalScore,

        confidenceScore:
          result.confidenceScore,

        qualifiedParticipantCount:
          result.qualifiedParticipantCount,

        crossCompleterCount:
          result.crossCompleterCount,

        snapshotId:
          entry.snapshotId,
      }
    }

    case VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION: {
      const result =
        entry.result

      if (
        !isVenueParticipationScoringResult(
          result
        )
      ) {
        throw new Error(
          `Entry "${entry.entryId}" contains the wrong scoring result for venue-participation settlement.`
        )
      }

      return {
        entryId:
          entry.entryId,

        contenderSlot:
          entry.contenderSlot,

        finalScore:
          result.finalScore,

        confidenceScore:
          result.confidenceScore,

        uniqueParticipantCount:
          result.uniqueParticipantCount,

        uniqueVenueVisitorCount:
          result.uniqueVenueVisitorCount,

        weightedParticipation:
          result.weightedParticipation,

        ratingCount:
          result.ratingCount,

        averageRating:
          result.averageRating,

        venueCount:
          result.venueCount,

        visitedVenueCount:
          result.visitedVenueCount,

        breadthRate:
          result.breadthRate,

        participantConfidence:
          result.participantConfidence,

        ratingConfidence:
          result.ratingConfidence,

        depthConfidence:
          result.depthConfidence,

        snapshotId:
          entry.snapshotId,
      }
    }

    default:
      throw new Error(
        `Unsupported settlement algorithm version: ${String(
          algorithmVersion
        )}.`
      )
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
  switch (
    value
  ) {
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
//
// ITINERARY SETTLEMENT ONLY.
//
// Venue-participation settlement deliberately does not read these
// thresholds.
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