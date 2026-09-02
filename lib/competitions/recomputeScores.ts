// lib/competitions/recomputeScores.ts

import 'server-only'

import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

import {
  scoreCompetitionEntry,
  toCompetitionScoreSnapshotFields,
  type CompetitionEntryScoringEvidence,
  type CompetitionEntryScoringResult,
  type CompetitionScoringAlgorithmVersion,
  COMPETITION_SCORING_ALGORITHM_VERSION,
} from './scoring'

import {
  loadVenueParticipationEvidence,
  type VenueParticipationEntryEvidence,
} from './venueParticipationEvidence'

import {
  scoreVenueParticipationEntryV1,
  VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION,
  type VenueParticipationScoringAlgorithmVersion,
  type VenueParticipationScoringEvidence,
  type VenueParticipationScoringResult,
} from './venueParticipationScoring'

// ============================================================
// PUBLIC CONTRACT
// ============================================================

export type CompetitionRecomputeAlgorithmVersion =
  | CompetitionScoringAlgorithmVersion
  | VenueParticipationScoringAlgorithmVersion

export type RecomputedCompetitionScoringResult =
  | CompetitionEntryScoringResult
  | VenueParticipationScoringResult

export interface RecomputeCompetitionScoresInput {
  competitionId: string

  /**
   * Snapshot lifecycle label.
   *
   * Examples:
   *
   *   live
   *   scoring
   *   settlement
   *
   * The value should match whatever snapshot_type constraint your
   * database migration allows.
   */
  snapshotType: string

  /**
   * Optional explicit algorithm version.
   *
   * When omitted, the canonical algorithm is selected from the
   * Taste Duel execution mode:
   *
   *   itinerary
   *     -> taste_duel_v1
   *
   *   venue_participation
   *     -> taste_duel_venue_participation_v1
   *
   * A caller may never force an algorithm belonging to a different
   * execution mode.
   */
  algorithmVersion?:
    CompetitionRecomputeAlgorithmVersion

  /**
   * Optional trusted service client for reuse/tests.
   */
  serviceSupabase?: SupabaseClient
}

export interface RecomputedCompetitionEntryScore {
  entryId: string
  contenderSlot: number

  result:
    RecomputedCompetitionScoringResult

  snapshotId: string
  snapshotType: string
  calculatedAt: string
}

export interface RecomputeCompetitionScoresResult {
  competitionId: string

  algorithmVersion:
    CompetitionRecomputeAlgorithmVersion

  snapshotType: string
  calculatedAt: string

  entryCount: number

  entries:
    RecomputedCompetitionEntryScore[]
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
}

type CompetitionEntryRow = {
  id: string
  competition_id: string
  contender_slot: number
  status: string
}

type CompetitionParticipationRow = {
  id: string

  competition_id: string
  competition_entry_id: string
  user_id: string

  completion_ratio: number

  qualified: boolean

  completed_at: string | null
}

type CompetitionRatingRow = {
  id: string

  competition_id: string
  competition_entry_id: string
  user_id: string

  rating: number
}

type CompetitionPreferenceRow = {
  id: string

  competition_id: string
  user_id: string

  entry_a_id: string
  entry_b_id: string
  preferred_entry_id: string
}

type CompetitionScoreSnapshotRow = {
  id: string

  competition_id: string
  entry_id: string

  snapshot_type: string
  calculated_at: string

  algorithm_version: string
}

// ============================================================
// INTERNAL RECOMPUTATION CONTRACT
// ============================================================

type RecomputeModeInput = {
  competitionId: string

  snapshotType: string

  algorithmVersion?:
    CompetitionRecomputeAlgorithmVersion

  serviceSupabase:
    SupabaseClient
}

// ============================================================
// CONSTANTS
// ============================================================

const SCORABLE_COMPETITION_STATUSES =
  new Set([
    'live',
    'scoring',
    'completed',
  ])

const TASTE_DUEL_COMPETITION_TYPE =
  'taste_duel' as const

const TASTE_DUEL_EXECUTION_MODE = {
  ITINERARY:
    'itinerary',

  VENUE_PARTICIPATION:
    'venue_participation',
} as const

const MIN_RATING = 1
const MAX_RATING = 5

// ============================================================
// MAIN RECOMPUTATION / MODE DISPATCH
// ============================================================

/**
 * Canonical score recomputation entry point.
 *
 * This function deliberately owns only:
 *
 *   - public input validation
 *   - competition loading
 *   - scoreable-status validation
 *   - execution-mode dispatch
 *
 * Mode-specific evidence loading, scoring, and snapshot persistence
 * belong entirely inside their respective recomputation functions.
 */
export async function recomputeCompetitionScores({
  competitionId,
  snapshotType,
  algorithmVersion,
  serviceSupabase,
}: RecomputeCompetitionScoresInput): Promise<RecomputeCompetitionScoresResult> {
  if (
    !isUuid(
      competitionId
    )
  ) {
    throw new CompetitionScoreRecomputeError(
      'INVALID_COMPETITION_ID',
      'A valid competition UUID is required.'
    )
  }

  const normalizedSnapshotType =
    normalizeSnapshotType(
      snapshotType
    )

  if (
    !normalizedSnapshotType
  ) {
    throw new CompetitionScoreRecomputeError(
      'INVALID_SNAPSHOT_TYPE',
      'snapshotType is required.'
    )
  }

  const supabase =
    serviceSupabase ??
    createCompetitionServiceClient()

  // ==========================================================
  // COMPETITION
  // ==========================================================

  const {
    data:
      competition,
    error:
      competitionError,
  } = await supabase
    .from(
      'competitions'
    )
    .select(`
      id,
      competition_type,
      taste_duel_execution_mode,
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
    throw new CompetitionScoreRecomputeError(
      'COMPETITION_LOOKUP_FAILED',
      'Could not load competition.',
      competitionError
    )
  }

  if (
    !competition
  ) {
    throw new CompetitionScoreRecomputeError(
      'COMPETITION_NOT_FOUND',
      'Competition not found.'
    )
  }

  if (
    !SCORABLE_COMPETITION_STATUSES.has(
      competition.status
    )
  ) {
    throw new CompetitionScoreRecomputeError(
      'COMPETITION_NOT_SCORABLE',
      `Competition status "${competition.status}" cannot be scored.`
    )
  }

  // ==========================================================
  // TASTE DUEL EXECUTION-MODE DISPATCH
  // ==========================================================
  //
  // This boundary exists before any mode-specific evidence table
  // is queried.
  //
  // itinerary:
  //
  //   competition_participations
  //   competition_entry_ratings
  //   competition_head_to_head_preferences
  //
  // venue_participation:
  //
  //   competition_venue_participation_events
  //   venue_visits
  //
  // Never mix those evidence systems.
  // ==========================================================

  if (
    competition.competition_type ===
      TASTE_DUEL_COMPETITION_TYPE
  ) {
    switch (
      competition.taste_duel_execution_mode
    ) {
      case TASTE_DUEL_EXECUTION_MODE.ITINERARY:
        return recomputeItineraryCompetitionScores({
          competitionId,

          snapshotType:
            normalizedSnapshotType,

          algorithmVersion,

          serviceSupabase:
            supabase,
        })

      case TASTE_DUEL_EXECUTION_MODE.VENUE_PARTICIPATION:
        return recomputeVenueParticipationCompetitionScores({
          competitionId,

          snapshotType:
            normalizedSnapshotType,

          algorithmVersion,

          serviceSupabase:
            supabase,
        })

      default:
        throw new CompetitionScoreRecomputeError(
          'INVALID_TASTE_DUEL_EXECUTION_MODE',
          `Taste Duel has invalid execution mode "${String(
            competition.taste_duel_execution_mode
          )}".`
        )
    }
  }

  /**
   * Preserve the pre-existing behavior for any non-Taste-Duel
   * caller reaching this service.
   *
   * No unrelated competition-type semantics are changed by this
   * execution-mode refactor.
   */
  return recomputeItineraryCompetitionScores({
    competitionId,

    snapshotType:
      normalizedSnapshotType,

    algorithmVersion,

    serviceSupabase:
      supabase,
  })
}

// ============================================================
// ITINERARY RECOMPUTATION
// ============================================================
//
// ITINERARY MODE ONLY.
//
// Canonical evidence:
//
//   competition_participations
//   competition_entry_ratings
//   competition_head_to_head_preferences
//
// Canonical scoring:
//
//   scoring.ts
//
// Venue-participation evidence must never be introduced here.
// ============================================================

async function recomputeItineraryCompetitionScores({
  competitionId,
  snapshotType,
  algorithmVersion,
  serviceSupabase,
}: RecomputeModeInput): Promise<RecomputeCompetitionScoresResult> {
  // ==========================================================
  // ITINERARY ALGORITHM
  // ==========================================================

  const itineraryAlgorithmVersion =
    resolveItineraryAlgorithmVersion(
      algorithmVersion
    )

  // ==========================================================
  // APPROVED ENTRIES
  // ==========================================================

  const {
    data:
      entryData,
    error:
      entryError,
  } = await serviceSupabase
    .from(
      'competition_entries'
    )
    .select(`
      id,
      competition_id,
      contender_slot,
      status
    `)
    .eq(
      'competition_id',
      competitionId
    )
    .eq(
      'status',
      'approved'
    )
    .order(
      'contender_slot',
      {
        ascending:
          true,
      }
    )

  if (
    entryError
  ) {
    throw new CompetitionScoreRecomputeError(
      'ENTRY_LOOKUP_FAILED',
      'Could not load approved competition entries.',
      entryError
    )
  }

  const entries =
    (
      entryData ??
      []
    ) as CompetitionEntryRow[]

  if (
    entries.length <
      2 ||
    entries.length >
      4
  ) {
    throw new CompetitionScoreRecomputeError(
      'INVALID_ENTRY_COUNT',
      `Taste Duel scoring requires 2–4 approved entries. Found ${entries.length}.`
    )
  }

  assertValidEntries(
    entries
  )

  const entryIds =
    entries.map(
      (
        entry
      ) =>
        entry.id
    )

  const entryIdSet =
    new Set(
      entryIds
    )

  // ==========================================================
  // ALL PARTICIPATION
  // ==========================================================

  /**
   * ITINERARY MODE ONLY.
   *
   * We intentionally load all participation, not only qualified
   * participation.
   *
   * scoring.ts requires:
   *
   *   participationCount
   *   completedParticipantCount
   *   qualifiedParticipantCount
   *   completionRate
   *
   * completionRate therefore needs the complete participation
   * population for each entry.
   */
  const {
    data:
      participationData,
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
      completion_ratio,
      qualified,
      completed_at
    `)
    .eq(
      'competition_id',
      competitionId
    )
    .in(
      'competition_entry_id',
      entryIds
    )

  if (
    participationError
  ) {
    throw new CompetitionScoreRecomputeError(
      'PARTICIPATION_LOOKUP_FAILED',
      'Could not load competition participation.',
      participationError
    )
  }

  const participations =
    (
      participationData ??
      []
    ) as CompetitionParticipationRow[]

  // ==========================================================
  // RATINGS
  // ==========================================================
  //
  // ITINERARY MODE ONLY.
  //
  // Canonical itinerary rating source:
  //
  //   competition_entry_ratings
  //
  // Venue-participation rating evidence comes from:
  //
  //   competition_venue_participation_events.venue_visit_id
  //                         ↓
  //                 venue_visits.rating
  // ==========================================================

  const {
    data:
      ratingData,
    error:
      ratingError,
  } = await serviceSupabase
    .from(
      'competition_entry_ratings'
    )
    .select(`
      id,
      competition_id,
      competition_entry_id,
      user_id,
      rating
    `)
    .eq(
      'competition_id',
      competitionId
    )
    .in(
      'competition_entry_id',
      entryIds
    )

  if (
    ratingError
  ) {
    throw new CompetitionScoreRecomputeError(
      'RATING_LOOKUP_FAILED',
      'Could not load competition ratings.',
      ratingError
    )
  }

  const rawRatings =
    (
      ratingData ??
      []
    ) as CompetitionRatingRow[]

  // ==========================================================
  // HEAD-TO-HEAD PREFERENCES
  // ==========================================================
  //
  // ITINERARY MODE ONLY.
  // ==========================================================

  const {
    data:
      preferenceData,
    error:
      preferenceError,
  } = await serviceSupabase
    .from(
      'competition_head_to_head_preferences'
    )
    .select(`
      id,
      competition_id,
      user_id,
      entry_a_id,
      entry_b_id,
      preferred_entry_id
    `)
    .eq(
      'competition_id',
      competitionId
    )

  if (
    preferenceError
  ) {
    throw new CompetitionScoreRecomputeError(
      'PREFERENCE_LOOKUP_FAILED',
      'Could not load competition head-to-head preferences.',
      preferenceError
    )
  }

  const rawPreferences =
    (
      preferenceData ??
      []
    ) as CompetitionPreferenceRow[]

  // ==========================================================
  // QUALIFIED PARTICIPATION INDEX
  // ==========================================================

  const qualifiedEntriesByUser =
    buildQualifiedEntriesByUser(
      participations
    )

  // ==========================================================
  // DEFENSIVELY VALIDATE RATINGS
  // ==========================================================

  /**
   * Rating endpoint authorization is not trusted as the only
   * defense.
   *
   * A rating counts only when the same user has canonical
   * qualified completion on that exact entry.
   */
  const validRatings =
    rawRatings.filter(
      (
        rating
      ) =>
        entryIdSet.has(
          rating.competition_entry_id
        ) &&
        isValidRating(
          rating.rating
        ) &&
        qualifiedEntriesByUser
          .get(
            rating.user_id
          )
          ?.has(
            rating.competition_entry_id
          ) === true
    )

  // ==========================================================
  // DEFENSIVELY VALIDATE H2H PREFERENCES
  // ==========================================================

  /**
   * A comparative preference counts only when:
   *
   *   - A and B are approved entries in this competition
   *   - A != B
   *   - preferred entry is A or B
   *   - the user qualified on A
   *   - the user qualified on B
   */
  const validPreferences =
    rawPreferences.filter(
      (
        preference
      ) => {
        if (
          preference.entry_a_id ===
          preference.entry_b_id
        ) {
          return false
        }

        if (
          !entryIdSet.has(
            preference.entry_a_id
          ) ||
          !entryIdSet.has(
            preference.entry_b_id
          )
        ) {
          return false
        }

        if (
          preference.preferred_entry_id !==
            preference.entry_a_id &&
          preference.preferred_entry_id !==
            preference.entry_b_id
        ) {
          return false
        }

        const qualifiedEntries =
          qualifiedEntriesByUser.get(
            preference.user_id
          )

        if (
          !qualifiedEntries
        ) {
          return false
        }

        return (
          qualifiedEntries.has(
            preference.entry_a_id
          ) &&
          qualifiedEntries.has(
            preference.entry_b_id
          )
        )
      }
    )

  // ==========================================================
  // BUILD CANONICAL EVIDENCE + SCORE
  // ==========================================================

  const scoredEntries =
    entries.map(
      (
        entry
      ) => {
        const evidence =
          buildEntryScoringEvidence({
            entryId:
              entry.id,

            participations,

            validRatings,

            validPreferences,

            qualifiedEntriesByUser,
          })

        const result =
          scoreCompetitionEntry(
            evidence,
            itineraryAlgorithmVersion
          )

        return {
          entry,
          evidence,
          result,
        }
      }
    )

  // ==========================================================
  // SNAPSHOT TIMESTAMP
  // ==========================================================

  const calculatedAt =
    new Date()
      .toISOString()

  // ==========================================================
  // APPEND-ONLY SNAPSHOT INSERTS
  // ==========================================================

  /**
   * scoring.ts explicitly defines the insert-ready score fields.
   *
   * We add only the persistence/lifecycle fields that scoring.ts
   * intentionally leaves to this layer:
   *
   *   competition_id
   *   entry_id
   *   snapshot_type
   *   calculated_at
   */
  const snapshotInserts =
    scoredEntries.map(
      (
        scored
      ) => ({
        competition_id:
          competitionId,

        entry_id:
          scored.entry.id,

        snapshot_type:
          snapshotType,

        calculated_at:
          calculatedAt,

        ...toCompetitionScoreSnapshotFields(
          scored.result
        ),
      })
    )

  /**
   * One array insert results in one PostgreSQL INSERT statement.
   *
   * The snapshot table remains append-only:
   *
   *   no UPDATE
   *   no DELETE
   *   no upsert
   */
  const {
    data:
      snapshotData,
    error:
      snapshotError,
  } = await serviceSupabase
    .from(
      'competition_entry_score_snapshots'
    )
    .insert(
      snapshotInserts
    )
    .select(`
      id,
      competition_id,
      entry_id,
      snapshot_type,
      calculated_at,
      algorithm_version
    `)

  if (
    snapshotError
  ) {
    throw new CompetitionScoreRecomputeError(
      'SNAPSHOT_INSERT_FAILED',
      'Could not persist competition score snapshots.',
      snapshotError
    )
  }

  const savedSnapshots =
    (
      snapshotData ??
      []
    ) as CompetitionScoreSnapshotRow[]

  if (
    savedSnapshots.length !==
      scoredEntries.length
  ) {
    throw new CompetitionScoreRecomputeError(
      'SNAPSHOT_COUNT_MISMATCH',
      `Expected ${scoredEntries.length} score snapshots but received ${savedSnapshots.length}.`
    )
  }

  const snapshotByEntryId =
    new Map(
      savedSnapshots.map(
        (
          snapshot
        ) => [
          snapshot.entry_id,
          snapshot,
        ]
      )
    )

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return {
    competitionId,

    algorithmVersion:
      itineraryAlgorithmVersion,

    snapshotType,

    calculatedAt,

    entryCount:
      scoredEntries.length,

    entries:
      scoredEntries.map(
        (
          scored
        ) => {
          const snapshot =
            snapshotByEntryId.get(
              scored.entry.id
            )

          if (
            !snapshot
          ) {
            throw new CompetitionScoreRecomputeError(
              'SNAPSHOT_ENTRY_MISMATCH',
              `No persisted score snapshot was returned for entry "${scored.entry.id}".`
            )
          }

          return {
            entryId:
              scored.entry.id,

            contenderSlot:
              scored.entry
                .contender_slot,

            result:
              scored.result,

            snapshotId:
              snapshot.id,

            snapshotType:
              snapshot.snapshot_type,

            calculatedAt:
              snapshot.calculated_at,
          }
        }
      ),
  }
}

// ============================================================
// VENUE-PARTICIPATION RECOMPUTATION
// ============================================================
//
// VENUE-PARTICIPATION MODE ONLY.
//
// This branch deliberately does not query:
//
//   competition_participations
//   competition_entry_ratings
//   competition_head_to_head_preferences
//
// Canonical evidence is owned by:
//
//   venueParticipationEvidence.ts
//
// Canonical scoring is owned by:
//
//   venueParticipationScoring.ts
//
// The shared snapshot table preserves semantic boundaries:
//
// Shared concepts:
//
//   rating_count
//   average_rating
//   experience_score
//   confidence_score
//   final_score
//
// Venue-participation-specific concepts:
//
//   unique_venue_participant_count
//   unique_venue_visitor_count
//   weighted_participation
//   visited_venue_count
//   venue_count
//   venue_breadth_rate
//   participation_confidence
//   rating_confidence
//   depth_confidence
//
// Itinerary-only concepts remain explicitly:
//
//   0
//   or
//   NULL
//
// and are never repurposed for venue participation.
// ============================================================

async function recomputeVenueParticipationCompetitionScores({
  competitionId,
  snapshotType,
  algorithmVersion,
  serviceSupabase,
}: RecomputeModeInput): Promise<RecomputeCompetitionScoresResult> {
  const venueAlgorithmVersion =
    resolveVenueParticipationAlgorithmVersion(
      algorithmVersion
    )

  // ==========================================================
  // CANONICAL VENUE-PARTICIPATION EVIDENCE
  // ==========================================================

  const evidence =
    await loadVenueParticipationEvidence({
      competitionId,

      serviceSupabase,
    })

  // ==========================================================
  // SCORE EACH SIDE
  // ==========================================================

  const scoredEntries =
    evidence.entries.map(
      (
        entry
      ) => {
        const scoringEvidence =
          toVenueParticipationScoringEvidence(
            entry
          )

        const result =
          scoreVenueParticipationEntryV1(
            scoringEvidence
          )

        if (
          result.algorithmVersion !==
            venueAlgorithmVersion
        ) {
          throw new CompetitionScoreRecomputeError(
            'ALGORITHM_VERSION_MISMATCH',
            [
              'Venue-participation scorer returned algorithm',
              `"${result.algorithmVersion}" but recomputation`,
              `expected "${venueAlgorithmVersion}".`,
            ].join(' ')
          )
        }

        return {
          entry,
          result,
        }
      }
    )

  // ==========================================================
  // SNAPSHOT TIMESTAMP
  // ==========================================================

  const calculatedAt =
    new Date()
      .toISOString()

  // ==========================================================
  // VENUE-PARTICIPATION SNAPSHOT BRIDGE
  // ==========================================================

  const snapshotInserts =
    scoredEntries.map(
      (
        scored
      ) => ({
        // ------------------------------------------------------
        // Snapshot identity / lifecycle
        // ------------------------------------------------------

        competition_id:
          competitionId,

        entry_id:
          scored.entry
            .competitionEntryId,

        snapshot_type:
          snapshotType,

        calculated_at:
          calculatedAt,

        algorithm_version:
          scored.result
            .algorithmVersion,

        // ------------------------------------------------------
        // Itinerary-only participation semantics
        // ------------------------------------------------------

        participation_count:
          0,

        completed_participant_count:
          0,

        qualified_participant_count:
          0,

        cross_completer_count:
          0,

        completion_rate:
          null,

        // ------------------------------------------------------
        // Shared rating semantics
        // ------------------------------------------------------

        rating_count:
          scored.result
            .ratingCount,

        average_rating:
          scored.result
            .averageRating,

        // ------------------------------------------------------
        // Itinerary-only would-repeat semantics
        // ------------------------------------------------------

        would_repeat_response_count:
          0,

        would_repeat_count:
          0,

        would_repeat_rate:
          null,

        // ------------------------------------------------------
        // Itinerary-only comparative semantics
        // ------------------------------------------------------

        head_to_head_preference_count:
          0,

        head_to_head_eligible_count:
          0,

        head_to_head_preference_rate:
          null,

        // ------------------------------------------------------
        // Future generic metrics remain unused
        // ------------------------------------------------------

        replay_count:
          null,

        replay_rate:
          null,

        save_count:
          null,

        save_rate:
          null,

        // ------------------------------------------------------
        // Score components
        // ------------------------------------------------------

        completion_score:
          null,

        experience_score:
          scored.result
            .ratingScore,

        repeat_score:
          null,

        comparative_score:
          null,

        // ------------------------------------------------------
        // Official aggregate score
        // ------------------------------------------------------

        confidence_score:
          scored.result
            .confidenceScore,

        final_score:
          scored.result
            .finalScore,

        // ------------------------------------------------------
        // Venue-participation canonical evidence
        // ------------------------------------------------------

        unique_venue_participant_count:
          scored.result
            .uniqueParticipantCount,

        unique_venue_visitor_count:
          scored.result
            .uniqueVenueVisitorCount,

        weighted_participation:
          scored.result
            .weightedParticipation,

        visited_venue_count:
          scored.result
            .visitedVenueCount,

        venue_count:
          scored.result
            .venueCount,

        venue_breadth_rate:
          scored.result
            .breadthRate,

        // ------------------------------------------------------
        // Venue-participation confidence audit
        // ------------------------------------------------------

        participation_confidence:
          scored.result
            .participantConfidence,

        rating_confidence:
          scored.result
            .ratingConfidence,

        depth_confidence:
          scored.result
            .depthConfidence,
      })
    )

  // ==========================================================
  // APPEND-ONLY SNAPSHOT INSERT
  // ==========================================================

  const {
    data:
      snapshotData,
    error:
      snapshotError,
  } = await serviceSupabase
    .from(
      'competition_entry_score_snapshots'
    )
    .insert(
      snapshotInserts
    )
    .select(`
      id,
      competition_id,
      entry_id,
      snapshot_type,
      calculated_at,
      algorithm_version
    `)

  if (
    snapshotError
  ) {
    throw new CompetitionScoreRecomputeError(
      'SNAPSHOT_INSERT_FAILED',
      'Could not persist venue-participation score snapshots.',
      snapshotError
    )
  }

  const savedSnapshots =
    (
      snapshotData ??
      []
    ) as CompetitionScoreSnapshotRow[]

  if (
    savedSnapshots.length !==
      scoredEntries.length
  ) {
    throw new CompetitionScoreRecomputeError(
      'SNAPSHOT_COUNT_MISMATCH',
      `Expected ${scoredEntries.length} venue-participation score snapshots but received ${savedSnapshots.length}.`
    )
  }

  const snapshotByEntryId =
    new Map(
      savedSnapshots.map(
        (
          snapshot
        ) => [
          snapshot.entry_id,
          snapshot,
        ]
      )
    )

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return {
    competitionId,

    algorithmVersion:
      venueAlgorithmVersion,

    snapshotType,

    calculatedAt,

    entryCount:
      scoredEntries.length,

    entries:
      scoredEntries.map(
        (
          scored
        ) => {
          const snapshot =
            snapshotByEntryId.get(
              scored.entry
                .competitionEntryId
            )

          if (
            !snapshot
          ) {
            throw new CompetitionScoreRecomputeError(
              'SNAPSHOT_ENTRY_MISMATCH',
              `No persisted venue-participation score snapshot was returned for entry "${scored.entry.competitionEntryId}".`
            )
          }

          if (
            snapshot.algorithm_version !==
              scored.result
                .algorithmVersion
          ) {
            throw new CompetitionScoreRecomputeError(
              'SNAPSHOT_ALGORITHM_MISMATCH',
              [
                'Persisted venue-participation snapshot',
                `"${snapshot.id}" returned algorithm`,
                `"${snapshot.algorithm_version}" instead of`,
                `"${scored.result.algorithmVersion}".`,
              ].join(' ')
            )
          }

          return {
            entryId:
              scored.entry
                .competitionEntryId,

            contenderSlot:
              scored.entry
                .contenderSlot,

            result:
              scored.result,

            snapshotId:
              snapshot.id,

            snapshotType:
              snapshot.snapshot_type,

            calculatedAt:
              snapshot.calculated_at,
          }
        }
      ),
  }
}

// ============================================================
// VENUE-PARTICIPATION EVIDENCE ADAPTER
// ============================================================

function toVenueParticipationScoringEvidence(
  evidence:
    VenueParticipationEntryEvidence
): VenueParticipationScoringEvidence {
  return {
    uniqueParticipantCount:
      evidence.uniqueParticipantCount,

    uniqueVenueVisitorCount:
      evidence.uniqueVenueVisitorCount,

    weightedParticipation:
      evidence.weightedParticipation,

    ratingCount:
      evidence.ratingCount,

    averageRating:
      evidence.averageRating,

    venueCount:
      evidence.venueCount,

    visitedVenueCount:
      evidence.visitedVenueCount,

    breadthRate:
      evidence.breadthRate,
  }
}

// ============================================================
// EXECUTION-MODE ALGORITHM RESOLUTION
// ============================================================

function resolveItineraryAlgorithmVersion(
  requestedVersion?:
    CompetitionRecomputeAlgorithmVersion
): CompetitionScoringAlgorithmVersion {
  if (
    requestedVersion ===
      undefined
  ) {
    return (
      COMPETITION_SCORING_ALGORITHM_VERSION
        .V1
    )
  }

  if (
    requestedVersion !==
      COMPETITION_SCORING_ALGORITHM_VERSION
        .V1
  ) {
    throw new CompetitionScoreRecomputeError(
      'ALGORITHM_EXECUTION_MODE_MISMATCH',
      [
        `Algorithm "${requestedVersion}" cannot score`,
        'an itinerary Taste Duel.',
      ].join(' ')
    )
  }

  return requestedVersion
}

function resolveVenueParticipationAlgorithmVersion(
  requestedVersion?:
    CompetitionRecomputeAlgorithmVersion
): VenueParticipationScoringAlgorithmVersion {
  if (
    requestedVersion ===
      undefined
  ) {
    return (
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION
    )
  }

  if (
    requestedVersion !==
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION
  ) {
    throw new CompetitionScoreRecomputeError(
      'ALGORITHM_EXECUTION_MODE_MISMATCH',
      [
        `Algorithm "${requestedVersion}" cannot score`,
        'a venue-participation Taste Duel.',
      ].join(' ')
    )
  }

  return requestedVersion
}

// ============================================================
// EVIDENCE BUILDER
// ============================================================
//
// ITINERARY MODE ONLY.
//
// Venue-participation evidence is built by:
//
//   lib/competitions/venueParticipationEvidence.ts
//
// Do not extend this adapter with venue-participation semantics.
// ============================================================

function buildEntryScoringEvidence({
  entryId,
  participations,
  validRatings,
  validPreferences,
  qualifiedEntriesByUser,
}: {
  entryId: string

  participations:
    CompetitionParticipationRow[]

  validRatings:
    CompetitionRatingRow[]

  validPreferences:
    CompetitionPreferenceRow[]

  qualifiedEntriesByUser:
    Map<string, Set<string>>
}): CompetitionEntryScoringEvidence {
  const entryParticipations =
    participations.filter(
      (
        participation
      ) =>
        participation.competition_entry_id ===
        entryId
    )

  const completedParticipations =
    entryParticipations.filter(
      (
        participation
      ) =>
        Boolean(
          participation.completed_at
        )
    )

  const qualifiedParticipations =
    entryParticipations.filter(
      (
        participation
      ) =>
        participation.qualified ===
          true &&
        Boolean(
          participation.completed_at
        )
    )

  // ==========================================================
  // PARTICIPATION COUNTS
  // ==========================================================

  const participationCount =
    entryParticipations.length

  const completedParticipantCount =
    completedParticipations.length

  const qualifiedParticipantCount =
    qualifiedParticipations.length

  // ==========================================================
  // CROSS-COMPLETERS
  // ==========================================================

  /**
   * A cross-completer is a qualified user on this entry who has
   * also qualified on at least one other entry in the same duel.
   */
  const crossCompleterCount =
    qualifiedParticipations.filter(
      (
        participation
      ) => {
        const qualifiedEntries =
          qualifiedEntriesByUser.get(
            participation.user_id
          )

        if (
          !qualifiedEntries
        ) {
          return false
        }

        for (
          const qualifiedEntryId
          of qualifiedEntries
        ) {
          if (
            qualifiedEntryId !==
            entryId
          ) {
            return true
          }
        }

        return false
      }
    ).length

  // ==========================================================
  // COMPLETION RATE
  // ==========================================================

  /**
   * scoring.ts recommends:
   *
   * average(
   *   competition_participations.completion_ratio
   * )
   *
   * across the participation population represented in the
   * snapshot.
   */
  const validCompletionRatios =
    entryParticipations
      .map(
        (
          participation
        ) =>
          participation.completion_ratio
      )
      .filter(
        isValidUnitRate
      )

  const completionRate =
    validCompletionRatios.length >
      0
      ? average(
          validCompletionRatios
        )
      : null

  // ==========================================================
  // RATINGS
  // ==========================================================

  const entryRatings =
    validRatings.filter(
      (
        rating
      ) =>
        rating.competition_entry_id ===
        entryId
    )

  const ratingCount =
    entryRatings.length

  const averageRating =
    ratingCount >
      0
      ? average(
          entryRatings.map(
            (
              rating
            ) =>
              rating.rating
          )
        )
      : null

  // ==========================================================
  // WOULD-REPEAT
  // ==========================================================

  /**
   * Current canonical rating endpoint records only the 1–5 rating
   * evidence.
   *
   * No would-repeat database field is assumed here.
   *
   * Missing optional evidence is exactly what scoring.ts is built
   * to handle: the repeat component becomes null and available
   * weights are re-normalized rather than treating missing evidence
   * as a zero.
   *
   * When a canonical would-repeat field/table is introduced, this
   * is the only evidence adapter section that needs expansion.
   */
  const wouldRepeatResponseCount =
    0

  const wouldRepeatCount =
    0

  // ==========================================================
  // HEAD-TO-HEAD
  // ==========================================================

  /**
   * Each valid stored comparison involving this entry contributes
   * one comparative denominator observation.
   *
   * A win contributes one numerator observation.
   *
   * Example:
   *
   *   A preferred over B:
   *
   *   A -> 1 / 1
   *   B -> 0 / 1
   *
   * This avoids treating absence of a submitted comparison as a
   * loss.
   */
  const entryComparisons =
    validPreferences.filter(
      (
        preference
      ) =>
        preference.entry_a_id ===
          entryId ||
        preference.entry_b_id ===
          entryId
    )

  const headToHeadEligibleCount =
    entryComparisons.length

  const headToHeadPreferenceCount =
    entryComparisons.filter(
      (
        preference
      ) =>
        preference.preferred_entry_id ===
        entryId
    ).length

  // ==========================================================
  // CANONICAL SCORING INPUT
  // ==========================================================

  return {
    participationCount,

    completedParticipantCount,

    qualifiedParticipantCount,

    crossCompleterCount,

    completionRate,

    ratingCount,

    averageRating,

    wouldRepeatResponseCount,

    wouldRepeatCount,

    headToHeadPreferenceCount,

    headToHeadEligibleCount,
  }
}

// ============================================================
// QUALIFIED ENTRY INDEX
// ============================================================

function buildQualifiedEntriesByUser(
  participations:
    CompetitionParticipationRow[]
): Map<
  string,
  Set<string>
> {
  const result =
    new Map<
      string,
      Set<string>
    >()

  for (
    const participation
    of participations
  ) {
    if (
      participation.qualified !==
        true ||
      !participation.completed_at
    ) {
      continue
    }

    let entryIds =
      result.get(
        participation.user_id
      )

    if (
      !entryIds
    ) {
      entryIds =
        new Set<string>()

      result.set(
        participation.user_id,
        entryIds
      )
    }

    entryIds.add(
      participation.competition_entry_id
    )
  }

  return result
}

// ============================================================
// ENTRY VALIDATION
// ============================================================

function assertValidEntries(
  entries:
    CompetitionEntryRow[]
): void {
  const entryIds =
    new Set<string>()

  const contenderSlots =
    new Set<number>()

  for (
    const entry
    of entries
  ) {
    if (
      !isUuid(
        entry.id
      )
    ) {
      throw new CompetitionScoreRecomputeError(
        'INVALID_ENTRY_ID',
        'Competition contains an invalid entry ID.'
      )
    }

    if (
      entryIds.has(
        entry.id
      )
    ) {
      throw new CompetitionScoreRecomputeError(
        'DUPLICATE_ENTRY',
        `Competition entry "${entry.id}" appears more than once.`
      )
    }

    entryIds.add(
      entry.id
    )

    if (
      !Number.isSafeInteger(
        entry.contender_slot
      ) ||
      entry.contender_slot <
        1 ||
      entry.contender_slot >
        4
    ) {
      throw new CompetitionScoreRecomputeError(
        'INVALID_CONTENDER_SLOT',
        `Entry "${entry.id}" has invalid contender slot "${String(
          entry.contender_slot
        )}".`
      )
    }

    if (
      contenderSlots.has(
        entry.contender_slot
      )
    ) {
      throw new CompetitionScoreRecomputeError(
        'DUPLICATE_CONTENDER_SLOT',
        `Contender slot ${entry.contender_slot} appears more than once.`
      )
    }

    contenderSlots.add(
      entry.contender_slot
    )
  }
}

// ============================================================
// NUMERIC HELPERS
// ============================================================

function isValidUnitRate(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >=
      0 &&
    value <=
      1
  )
}

function isValidRating(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >=
      MIN_RATING &&
    value <=
      MAX_RATING
  )
}

function average(
  values:
    readonly number[]
): number {
  if (
    values.length ===
      0
  ) {
    throw new CompetitionScoreRecomputeError(
      'EMPTY_AVERAGE',
      'Cannot calculate an average from an empty value set.'
    )
  }

  const sum =
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    )

  return (
    sum /
    values.length
  )
}

// ============================================================
// SNAPSHOT TYPE
// ============================================================

function normalizeSnapshotType(
  value: string
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    normalized.length ===
      0 ||
    normalized.length >
      64
  ) {
    return null
  }

  return normalized
}

// ============================================================
// SERVICE CLIENT
// ============================================================

function createCompetitionServiceClient(): SupabaseClient {
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
    throw new CompetitionScoreRecomputeError(
      'SUPABASE_URL_MISSING',
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
    throw new CompetitionScoreRecomputeError(
      'SERVICE_ROLE_KEY_MISSING',
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

// ============================================================
// DOMAIN ERROR
// ============================================================

export class CompetitionScoreRecomputeError extends Error {
  readonly code:
    | 'INVALID_COMPETITION_ID'
    | 'INVALID_SNAPSHOT_TYPE'
    | 'COMPETITION_LOOKUP_FAILED'
    | 'COMPETITION_NOT_FOUND'
    | 'COMPETITION_NOT_SCORABLE'
    | 'INVALID_TASTE_DUEL_EXECUTION_MODE'
    | 'ALGORITHM_EXECUTION_MODE_MISMATCH'
    | 'ALGORITHM_VERSION_MISMATCH'
    | 'ENTRY_LOOKUP_FAILED'
    | 'INVALID_ENTRY_COUNT'
    | 'INVALID_ENTRY_ID'
    | 'DUPLICATE_ENTRY'
    | 'INVALID_CONTENDER_SLOT'
    | 'DUPLICATE_CONTENDER_SLOT'
    | 'PARTICIPATION_LOOKUP_FAILED'
    | 'RATING_LOOKUP_FAILED'
    | 'PREFERENCE_LOOKUP_FAILED'
    | 'SNAPSHOT_INSERT_FAILED'
    | 'SNAPSHOT_COUNT_MISMATCH'
    | 'SNAPSHOT_ENTRY_MISMATCH'
    | 'SNAPSHOT_ALGORITHM_MISMATCH'
    | 'EMPTY_AVERAGE'
    | 'SUPABASE_URL_MISSING'
    | 'SERVICE_ROLE_KEY_MISSING'

  readonly cause?: unknown

  constructor(
    code:
      CompetitionScoreRecomputeError['code'],
    message: string,
    cause?: unknown
  ) {
    super(
      message
    )

    this.name =
      'CompetitionScoreRecomputeError'

    this.code =
      code

    this.cause =
      cause
  }
}