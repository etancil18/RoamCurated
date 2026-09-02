import 'server-only'

import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

import {
  DEFAULT_VENUE_PARTICIPATION_DEPTH_RULE_VERSION,
  getVenueParticipationDepthWeightV1,
  type VenueParticipationDepthRuleVersion,
} from './venueParticipationScoring'

// ============================================================
// DOMAIN CONSTANTS
// ============================================================

const MIN_RATING = 1
const MAX_RATING = 5

// ============================================================
// DATABASE ROW TYPES
// ============================================================

type CompetitionRow = {
  id: string

  competition_type: string
  taste_duel_execution_mode: string | null

  status: string

  starts_at: string | null
  ends_at: string | null
}

type CompetitionEntryRow = {
  id: string
  competition_id: string

  contender_slot: number

  venue_ids: string[] | null

  status: string
}

type VenueParticipationEventRow = {
  id: string

  competition_id: string
  competition_entry_id: string

  user_id: string
  venue_id: string
  venue_visit_id: string

  occurred_at: string
  created_at: string
}

type VenueVisitRow = {
  id: string

  user_id: string
  venue_id: string

  /**
   * Canonical rating source for venue-participation evidence.
   *
   * Venue-participation Taste Duels do not maintain a separate
   * competition-specific rating record.
   */
  rating: number | null

  visited_at: string

  geo_verified: boolean
  check_in_source: string
}

// ============================================================
// PUBLIC INPUT
// ============================================================

export interface LoadVenueParticipationEvidenceInput {
  competitionId: string

  /**
   * Optional trusted Supabase client.
   *
   * Normal server callers may omit this.
   *
   * Tests/reconciliation jobs may inject an existing trusted
   * service-role client.
   */
  serviceSupabase?: SupabaseClient<any>
}

// ============================================================
// PUBLIC OUTPUT TYPES
// ============================================================

export interface VenueParticipationDepthContribution {
  eventId: string

  userId: string
  venueId: string
  venueVisitId: string

  /**
   * 1-based order of this user's distinct qualifying venues
   * within this competition entry / side.
   */
  distinctVenueOrdinal: number

  /**
   * Diminishing depth weight produced by the versioned scoring
   * rule in venueParticipationScoring.ts.
   */
  weight: number

  occurredAt: string

  rating: number | null
}

export interface VenueParticipationVenueEvidence {
  venueId: string

  /**
   * Number of distinct qualifying users at this venue.
   */
  uniqueParticipantCount: number

  /**
   * Number of immutable qualifying evidence rows.
   *
   * Under the current database uniqueness invariant:
   *
   *   competition_id + user_id + venue_id
   *
   * this should equal uniqueParticipantCount.
   *
   * We keep both concepts explicit for auditability.
   */
  verifiedVisitCount: number

  ratingCount: number

  averageRating: number | null
}

export interface VenueParticipationEntryEvidence {
  competitionId: string
  competitionEntryId: string

  contenderSlot: number

  // ----------------------------------------------------------
  // SIDE CONFIGURATION
  // ----------------------------------------------------------

  /**
   * Total number of configured venues belonging to this side.
   *
   * Definition:
   *
   *   cardinality(competition_entries.venue_ids)
   */
  venueCount: number

  /**
   * Canonical configured venue IDs for this side.
   */
  venueIds: string[]

  // ----------------------------------------------------------
  // PARTICIPATION REACH
  // ----------------------------------------------------------

  /**
   * Number of distinct users who produced at least one qualifying
   * immutable venue-participation event for this side.
   *
   * Definition:
   *
   *   count(distinct user_id)
   */
  uniqueParticipantCount: number

  /**
   * Number of distinct qualifying user + venue pairs.
   *
   * Definition:
   *
   *   count(distinct (user_id, venue_id))
   *
   * Under the current database uniqueness invariant:
   *
   *   competition_id + user_id + venue_id
   *
   * this currently equals verifiedVenueCheckInCount.
   *
   * Keep this metric separate because the concepts are different
   * and may diverge in a future evidence model.
   */
  uniqueVenueVisitorCount: number

  /**
   * Number of canonical qualifying immutable evidence rows used
   * after validation and defensive deduplication.
   *
   * Definition:
   *
   *   count(accepted immutable evidence rows)
   */
  verifiedVenueCheckInCount: number

  // ----------------------------------------------------------
  // DEPTH
  // ----------------------------------------------------------

  /**
   * Diminishing participation depth across all users on this side.
   *
   * For each:
   *
   *   competition
   *   + competition entry / side
   *   + user
   *
   * order the user's distinct qualifying venues by:
   *
   *   first qualifying occurred_at ASC
   *   event_id ASC as deterministic tie-breaker
   *
   * assign ordinal:
   *
   *   1..N
   *
   * then:
   *
   *   weight = 1 / sqrt(ordinal)
   *
   * weightedParticipation =
   *
   *   sum(all resulting depth weights)
   */
  weightedParticipation: number

  /**
   * Exact version of the depth weighting rule used to derive the
   * contribution weights included in this evidence object.
   */
  depthRuleVersion: VenueParticipationDepthRuleVersion

  // ----------------------------------------------------------
  // RATINGS
  // ----------------------------------------------------------

  /**
   * Number of qualifying immutable evidence rows whose referenced
   * canonical venue_visits row contains a valid 1–5 rating.
   *
   * Canonical path:
   *
   *   event.venue_visit_id
   *      -> venue_visits.id
   *      -> venue_visits.rating
   *
   * One user may legitimately contribute multiple ratings to one
   * side by visiting and rating multiple distinct venues.
   */
  ratingCount: number

  /**
   * Number of distinct users represented among rating evidence.
   *
   * Definition:
   *
   *   count(distinct user_id)
   *
   * among accepted evidence rows carrying a valid rating.
   */
  ratedParticipantCount: number

  /**
   * Rating-count-weighted side average.
   *
   * Definition:
   *
   *   sum(valid qualifying venue_visits.rating values)
   *   /
   *   ratingCount
   *
   * Because this is calculated from raw qualifying visit ratings,
   * it is mathematically equivalent to:
   *
   *   sum(venueAverage * venueRatingCount)
   *   /
   *   sum(venueRatingCount)
   *
   * null when ratingCount === 0.
   */
  averageRating: number | null

  // ----------------------------------------------------------
  // VENUE BREADTH
  // ----------------------------------------------------------

  /**
   * Number of configured venues on this side with at least one
   * qualifying participant.
   *
   * Definition:
   *
   *   count(distinct venue_id)
   *
   * among accepted immutable evidence rows.
   */
  visitedVenueCount: number

  /**
   * Distribution of participation across the configured side.
   *
   * Definition:
   *
   *   visitedVenueCount / venueCount
   *
   * Range:
   *
   *   0..1
   *
   * This is tracked in v1 even if it is not yet scored.
   */
  breadthRate: number | null

  // ----------------------------------------------------------
  // Audit breakdowns
  // ----------------------------------------------------------

  venues: VenueParticipationVenueEvidence[]

  depthContributions:
    VenueParticipationDepthContribution[]
}

export interface VenueParticipationCompetitionEvidence {
  competitionId: string

  competitionType: 'taste_duel'

  executionMode: 'venue_participation'

  entryCount: number

  entries: VenueParticipationEntryEvidence[]

  /**
   * Number of raw immutable ledger rows loaded before defensive
   * validation/deduplication.
   */
  rawEventCount: number

  /**
   * Number of canonical event rows actually used.
   */
  acceptedEventCount: number

  /**
   * Number of malformed/inconsistent rows excluded defensively.
   *
   * In a healthy production database this should always be zero.
   */
  rejectedEventCount: number
}

// ============================================================
// PRIMARY PUBLIC API
// ============================================================

/**
 * Loads canonical venue-participation evidence for one competition.
 *
 * This adapter:
 *
 *   - reads immutable participation events
 *   - joins canonical venue_visits evidence
 *   - defensively revalidates provenance
 *   - defensively deduplicates user + venue evidence
 *   - calculates unique side participation
 *   - orders each user's distinct venues chronologically
 *   - applies the centralized versioned depth-weight rule
 *   - calculates venue + side rating metrics
 *   - calculates breadth
 *
 * It does NOT:
 *
 *   - write database state
 *   - define the depth formula
 *   - compute official score
 *   - calculate confidence
 *   - choose a winner
 *   - create snapshots
 */
export async function loadVenueParticipationEvidence({
  competitionId,
  serviceSupabase,
}: LoadVenueParticipationEvidenceInput): Promise<VenueParticipationCompetitionEvidence> {
  assertUuid(
    competitionId,
    'competitionId',
  )

  const supabase =
    serviceSupabase ??
    createCompetitionServiceClient()

  // ==========================================================
  // COMPETITION
  // ==========================================================

  const {
    data: competitionData,
    error: competitionError,
  } = await supabase
    .from(
      'competitions',
    )
    .select(`
      id,
      competition_type,
      taste_duel_execution_mode,
      status,
      starts_at,
      ends_at
    `)
    .eq(
      'id',
      competitionId,
    )
    .maybeSingle<CompetitionRow>()

  if (competitionError) {
    throw createEvidenceError(
      'COMPETITION_LOOKUP_FAILED',
      'Could not load venue-participation competition.',
      {
        competitionId,
        cause:
          competitionError,
      },
    )
  }

  const competition =
    competitionData

  if (!competition) {
    throw createEvidenceError(
      'COMPETITION_NOT_FOUND',
      'Competition not found.',
      {
        competitionId,
      },
    )
  }

  if (
    competition.competition_type !==
      'taste_duel'
  ) {
    throw createEvidenceError(
      'INVALID_COMPETITION_TYPE',
      'Venue-participation evidence requires a Taste Duel competition.',
      {
        competitionId,
        competitionType:
          competition.competition_type,
      },
    )
  }

  if (
    competition.taste_duel_execution_mode !==
      'venue_participation'
  ) {
    throw createEvidenceError(
      'INVALID_EXECUTION_MODE',
      'Competition is not configured for venue participation.',
      {
        competitionId,
        executionMode:
          competition.taste_duel_execution_mode,
      },
    )
  }

  // ==========================================================
  // APPROVED ENTRIES
  // ==========================================================

  const {
    data: entryData,
    error: entryError,
  } = await supabase
    .from(
      'competition_entries',
    )
    .select(`
      id,
      competition_id,
      contender_slot,
      venue_ids,
      status
    `)
    .eq(
      'competition_id',
      competitionId,
    )
    .eq(
      'status',
      'approved',
    )
    .order(
      'contender_slot',
      {
        ascending:
          true,
      },
    )

  if (entryError) {
    throw createEvidenceError(
      'ENTRY_LOOKUP_FAILED',
      'Could not load approved venue-participation entries.',
      {
        competitionId,
        cause:
          entryError,
      },
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
    throw createEvidenceError(
      'INVALID_ENTRY_COUNT',
      `Venue-participation Taste Duel requires 2–4 approved entries. Found ${entries.length}.`,
      {
        competitionId,
        entryCount:
          entries.length,
      },
    )
  }

  validateEntries(
    entries,
    competitionId,
  )

  const entryById =
    new Map(
      entries.map(
        (
          entry,
        ) => [
          entry.id,
          entry,
        ],
      ),
    )

  // ==========================================================
  // IMMUTABLE PARTICIPATION EVENTS
  // ==========================================================

  const {
    data: eventData,
    error: eventError,
  } = await supabase
    .from(
      'competition_venue_participation_events',
    )
    .select(`
      id,
      competition_id,
      competition_entry_id,
      user_id,
      venue_id,
      venue_visit_id,
      occurred_at,
      created_at
    `)
    .eq(
      'competition_id',
      competitionId,
    )
    .order(
      'occurred_at',
      {
        ascending:
          true,
      },
    )
    .order(
      'id',
      {
        ascending:
          true,
      },
    )

  if (eventError) {
    throw createEvidenceError(
      'EVENT_LOOKUP_FAILED',
      'Could not load venue-participation evidence events.',
      {
        competitionId,
        cause:
          eventError,
      },
    )
  }

  const rawEvents =
    (
      eventData ??
      []
    ) as VenueParticipationEventRow[]

  // ==========================================================
  // LOAD CANONICAL VENUE VISITS
  // ==========================================================
  //
  // Venue-participation rating evidence comes exclusively from
  // the canonical venue_visit referenced by each immutable event.
  //
  // No competition-specific rating table participates in this
  // execution mode.
  // ==========================================================

  const visitIds =
    [
      ...new Set(
        rawEvents
          .map(
            (
              event,
            ) =>
              event.venue_visit_id,
          )
          .filter(
            isNonEmptyString,
          ),
      ),
    ]

  let visits:
    VenueVisitRow[] =
    []

  if (
    visitIds.length >
      0
  ) {
    const {
      data: visitData,
      error: visitError,
    } = await supabase
      .from(
        'venue_visits',
      )
      .select(`
        id,
        user_id,
        venue_id,
        rating,
        visited_at,
        geo_verified,
        check_in_source
      `)
      .in(
        'id',
        visitIds,
      )

    if (visitError) {
      throw createEvidenceError(
        'VENUE_VISIT_LOOKUP_FAILED',
        'Could not load canonical venue visit evidence.',
        {
          competitionId,
          cause:
            visitError,
        },
      )
    }

    visits =
      (
        visitData ??
        []
      ) as VenueVisitRow[]
  }

  const visitById =
    new Map(
      visits.map(
        (
          visit,
        ) => [
          visit.id,
          visit,
        ],
      ),
    )

  // ==========================================================
  // DEFENSIVE EVENT VALIDATION
  // ==========================================================
  //
  // The database trigger already guarantees these invariants.
  //
  // We intentionally re-prove them here before scoring input is
  // constructed so corrupted/imported/legacy rows cannot silently
  // influence official results.
  // ==========================================================

  const acceptedCandidates:
    CanonicalEvidenceRow[] =
    []

  let rejectedEventCount =
    0

  for (
    const event
    of rawEvents
  ) {
    const entry =
      entryById.get(
        event.competition_entry_id,
      )

    const visit =
      visitById.get(
        event.venue_visit_id,
      )

    if (
      !entry ||
      !visit
    ) {
      rejectedEventCount +=
        1

      continue
    }

    if (
      event.competition_id !==
        competitionId ||
      entry.competition_id !==
        competitionId
    ) {
      rejectedEventCount +=
        1

      continue
    }

    if (
      visit.geo_verified !==
        true
    ) {
      rejectedEventCount +=
        1

      continue
    }

    if (
      visit.user_id !==
        event.user_id ||
      visit.venue_id !==
        event.venue_id
    ) {
      rejectedEventCount +=
        1

      continue
    }

    if (
      !timestampsEqual(
        visit.visited_at,
        event.occurred_at,
      )
    ) {
      rejectedEventCount +=
        1

      continue
    }

    const configuredVenueIds =
      normalizeVenueIds(
        entry.venue_ids,
      )

    if (
      !configuredVenueIds.includes(
        event.venue_id,
      )
    ) {
      rejectedEventCount +=
        1

      continue
    }

    if (
      competition.starts_at &&
      compareTimestamp(
        event.occurred_at,
        competition.starts_at,
      ) <
        0
    ) {
      rejectedEventCount +=
        1

      continue
    }

    if (
      competition.ends_at &&
      compareTimestamp(
        event.occurred_at,
        competition.ends_at,
      ) >=
        0
    ) {
      rejectedEventCount +=
        1

      continue
    }

    acceptedCandidates.push({
      event,
      visit,
      entry,
    })
  }

  // ==========================================================
  // DEFENSIVE DEDUPLICATION
  // ==========================================================
  //
  // Database uniqueness already guarantees:
  //
  //   competition + user + venue
  //
  // and:
  //
  //   competition + venue_visit
  //
  // Official scoring still re-applies both invariants so malformed
  // legacy/imported evidence cannot influence results.
  //
  // The chronologically earliest canonical row wins.
  // ==========================================================

  const canonicalEvidence =
    defensivelyDedupeEvidence(
      acceptedCandidates,
    )

  rejectedEventCount +=
    acceptedCandidates.length -
    canonicalEvidence.length

  // ==========================================================
  // GROUP BY COMPETITION ENTRY
  // ==========================================================

  const evidenceByEntryId =
    new Map<
      string,
      CanonicalEvidenceRow[]
    >()

  for (
    const entry
    of entries
  ) {
    evidenceByEntryId.set(
      entry.id,
      [],
    )
  }

  for (
    const evidence
    of canonicalEvidence
  ) {
    const bucket =
      evidenceByEntryId.get(
        evidence.entry.id,
      )

    if (!bucket) {
      /**
       * Should be impossible because accepted evidence is already
       * entry-validated.
       */
      rejectedEventCount +=
        1

      continue
    }

    bucket.push(
      evidence,
    )
  }

  // ==========================================================
  // BUILD ENTRY EVIDENCE
  // ==========================================================

  const aggregatedEntries =
    entries.map(
      (
        entry,
      ) =>
        buildEntryEvidence({
          competitionId,
          entry,
          evidence:
            evidenceByEntryId.get(
              entry.id,
            ) ??
            [],
        }),
    )

  // ==========================================================
  // RESPONSE
  // ==========================================================

  const acceptedEventCount =
    aggregatedEntries.reduce(
      (
        total,
        entry,
      ) =>
        total +
        entry.verifiedVenueCheckInCount,
      0,
    )

  /**
   * Defensive accounting invariant.
   *
   * Every raw event must end up either accepted or rejected.
   */
  if (
    acceptedEventCount +
      rejectedEventCount !==
    rawEvents.length
  ) {
    throw createEvidenceError(
      'EVIDENCE_ACCOUNTING_MISMATCH',
      'Venue-participation evidence accounting is inconsistent.',
      {
        competitionId,
        rawEventCount:
          rawEvents.length,
        acceptedEventCount,
        rejectedEventCount,
      },
    )
  }

  return {
    competitionId,

    competitionType:
      'taste_duel',

    executionMode:
      'venue_participation',

    entryCount:
      aggregatedEntries.length,

    entries:
      aggregatedEntries,

    rawEventCount:
      rawEvents.length,

    acceptedEventCount,

    rejectedEventCount,
  }
}

// ============================================================
// CANONICAL INTERNAL EVIDENCE
// ============================================================

type CanonicalEvidenceRow = {
  event:
    VenueParticipationEventRow

  visit:
    VenueVisitRow

  entry:
    CompetitionEntryRow
}

// ============================================================
// ENTRY AGGREGATION
// ============================================================

function buildEntryEvidence({
  competitionId,
  entry,
  evidence,
}: {
  competitionId: string

  entry:
    CompetitionEntryRow

  evidence:
    CanonicalEvidenceRow[]
}): VenueParticipationEntryEvidence {
  const venueIds =
    normalizeVenueIds(
      entry.venue_ids,
    )

  // ==========================================================
  // STABLE CHRONOLOGICAL ORDER
  // ==========================================================

  const orderedEvidence =
    [...evidence].sort(
      compareCanonicalEvidence,
    )

  // ==========================================================
  // UNIQUE PARTICIPANTS
  // ==========================================================

  const uniqueParticipantIds =
    new Set<string>()

  const uniqueUserVenueKeys =
    new Set<string>()

  const visitedVenueIds =
    new Set<string>()

  for (
    const row
    of orderedEvidence
  ) {
    uniqueParticipantIds.add(
      row.event.user_id,
    )

    uniqueUserVenueKeys.add(
      createUserVenueKey(
        row.event.user_id,
        row.event.venue_id,
      ),
    )

    visitedVenueIds.add(
      row.event.venue_id,
    )
  }

  // ==========================================================
  // PER-USER DISTINCT-VENUE DEPTH
  // ==========================================================
  //
  // This file owns ordinal derivation.
  //
  // venueParticipationScoring.ts owns the meaning/weight of each
  // ordinal.
  //
  // For each user + side:
  //
  //   1. collect qualifying immutable evidence
  //   2. retain the first qualifying event per distinct venue
  //   3. order those venue-first events by:
  //
  //        occurred_at ASC
  //        event_id ASC
  //
  //   4. assign ordinal 1..N
  //   5. apply the centralized depth formula
  //
  // Repeated visits to the same venue can never advance the
  // user's depth ordinal.
  // ==========================================================

  const evidenceByUser =
    new Map<
      string,
      CanonicalEvidenceRow[]
    >()

  for (
    const row
    of orderedEvidence
  ) {
    let userRows =
      evidenceByUser.get(
        row.event.user_id,
      )

    if (!userRows) {
      userRows =
        []

      evidenceByUser.set(
        row.event.user_id,
        userRows,
      )
    }

    userRows.push(
      row,
    )
  }

  const depthContributions:
    VenueParticipationDepthContribution[] =
    []

  for (
    const [
      userId,
      userEvidence,
    ]
    of evidenceByUser
  ) {
    const firstEvidenceByVenue =
      new Map<
        string,
        CanonicalEvidenceRow
      >()

    for (
      const row
      of [...userEvidence].sort(
        compareCanonicalEvidence,
      )
    ) {
      if (
        !firstEvidenceByVenue.has(
          row.event.venue_id,
        )
      ) {
        firstEvidenceByVenue.set(
          row.event.venue_id,
          row,
        )
      }
    }

    const distinctVenueEvidence =
      [
        ...firstEvidenceByVenue.values(),
      ].sort(
        compareCanonicalEvidence,
      )

    for (
      let index = 0;
      index <
      distinctVenueEvidence.length;
      index += 1
    ) {
      const row =
        distinctVenueEvidence[
          index
        ]

      if (!row) {
        throw createEvidenceError(
          'DEPTH_SEQUENCE_INVARIANT_FAILED',
          'Distinct venue evidence sequence unexpectedly contains a missing row.',
          {
            competitionId,
            competitionEntryId:
              entry.id,
            userId,
            index,
          },
        )
      }

      const distinctVenueOrdinal =
        index +
        1

      depthContributions.push({
        eventId:
          row.event.id,

        userId,

        venueId:
          row.event.venue_id,

        venueVisitId:
          row.event.venue_visit_id,

        distinctVenueOrdinal,

        weight:
          roundTo(
            getVenueParticipationDepthWeightV1(
              distinctVenueOrdinal,
            ),
            8,
          ),

        occurredAt:
          row.event.occurred_at,

        rating:
          normalizeRating(
            row.visit.rating,
          ),
      })
    }
  }

  depthContributions.sort(
    (
      left,
      right,
    ) => {
      const timeComparison =
        compareTimestamp(
          left.occurredAt,
          right.occurredAt,
        )

      if (
        timeComparison !==
        0
      ) {
        return timeComparison
      }

      return left.eventId.localeCompare(
        right.eventId,
      )
    },
  )

  // ==========================================================
  // CORE PARTICIPATION METRICS
  // ==========================================================

  const uniqueParticipantCount =
    uniqueParticipantIds.size

  const uniqueVenueVisitorCount =
    uniqueUserVenueKeys.size

  const verifiedVenueCheckInCount =
    orderedEvidence.length

  // ==========================================================
  // WEIGHTED PARTICIPATION
  // ==========================================================

  const weightedParticipation =
    roundTo(
      depthContributions.reduce(
        (
          total,
          contribution,
        ) =>
          total +
          contribution.weight,
        0,
      ),
      8,
    )

  // ==========================================================
  // RATING METRICS
  // ==========================================================
  //
  // CANONICAL RATING SOURCE:
  //
  //   competition_venue_participation_events.venue_visit_id
  //                         ↓
  //                 venue_visits.id
  //                         ↓
  //                venue_visits.rating
  //
  // There is intentionally no venue-participation-specific rating
  // table.
  //
  // An accepted participation event contributes rating evidence
  // only when its referenced canonical venue_visit carries a valid
  // non-null 1–5 rating.
  //
  // Null ratings remain valid participation evidence but do not
  // contribute to ratingCount or averageRating.
  //
  // Entry average:
  //
  //   sum(all qualifying rating values)
  //   /
  //   ratingCount
  //
  // This is naturally rating-count weighted across venues and is
  // mathematically equivalent to weighting each venue average by
  // that venue's qualifying rating count.
  // ==========================================================

  const ratingEvidence =
    orderedEvidence
      .map(
        (
          row,
        ) => {
          const rating =
            normalizeRating(
              row.visit.rating,
            )

          if (
            rating ===
            null
          ) {
            return null
          }

          return {
            eventId:
              row.event.id,

            userId:
              row.event.user_id,

            venueId:
              row.event.venue_id,

            venueVisitId:
              row.event.venue_visit_id,

            rating,
          }
        },
      )
      .filter(
        (
          row,
        ): row is {
          eventId: string
          userId: string
          venueId: string
          venueVisitId: string
          rating: number
        } =>
          row !==
          null,
      )

  const ratingCount =
    ratingEvidence.length

  const ratingValueSum =
    ratingEvidence.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.rating,
      0,
    )

  const averageRating =
    ratingCount >
      0
      ? roundTo(
          ratingValueSum /
            ratingCount,
          4,
        )
      : null

  const ratedParticipantCount =
    new Set(
      ratingEvidence.map(
        (
          row,
        ) =>
          row.userId,
      ),
    ).size

  // ==========================================================
  // VENUE BREAKDOWNS
  // ==========================================================
  //
  // Venue-level rating metrics are derived from the exact same
  // accepted canonical evidence population.
  //
  // They exist for analytics, debugging, observability, and future
  // distribution/breadth work.
  //
  // They are not independently averaged into the side score.
  //
  // Side averageRating remains:
  //
  //   average(all qualifying raw venue_visits.rating values)
  // ==========================================================

  const evidenceByVenueId =
    new Map<
      string,
      CanonicalEvidenceRow[]
    >()

  for (
    const venueId
    of venueIds
  ) {
    evidenceByVenueId.set(
      venueId,
      [],
    )
  }

  for (
    const row
    of orderedEvidence
  ) {
    const bucket =
      evidenceByVenueId.get(
        row.event.venue_id,
      )

    if (!bucket) {
      /**
       * The event was already checked against entry.venue_ids.
       * Reaching this branch would indicate an internal adapter
       * inconsistency.
       */
      throw createEvidenceError(
        'VENUE_AGGREGATION_MISMATCH',
        'Accepted evidence references a venue outside the configured entry.',
        {
          competitionId,
          competitionEntryId:
            entry.id,
          venueId:
            row.event.venue_id,
          eventId:
            row.event.id,
        },
      )
    }

    bucket.push(
      row,
    )
  }

  const venues =
    venueIds.map(
      (
        venueId,
      ) =>
        buildVenueEvidence({
          venueId,

          evidence:
            evidenceByVenueId.get(
              venueId,
            ) ??
            [],
        }),
    )

  // ==========================================================
  // RATING ROLLUP CONSISTENCY
  // ==========================================================
  //
  // Prove that the venue analytics breakdown reconciles exactly
  // to the canonical raw-rating entry aggregation.
  //
  // We compare raw rating counts and raw rating values rather than
  // recomputing from rounded venue averages.
  // ==========================================================

  const venueRatingCount =
    venues.reduce(
      (
        total,
        venue,
      ) =>
        total +
        venue.ratingCount,
      0,
    )

  const venueRatingValueSum =
    venueIds.reduce(
      (
        total,
        venueId,
      ) => {
        const venueEvidence =
          evidenceByVenueId.get(
            venueId,
          ) ??
          []

        return (
          total +
          venueEvidence.reduce(
            (
              venueTotal,
              row,
            ) => {
              const rating =
                normalizeRating(
                  row.visit.rating,
                )

              return (
                venueTotal +
                (
                  rating ??
                  0
                )
              )
            },
            0,
          )
        )
      },
      0,
    )

  if (
    venueRatingCount !==
      ratingCount
  ) {
    throw createEvidenceError(
      'VENUE_RATING_COUNT_ROLLUP_MISMATCH',
      'Venue rating counts do not reconcile to the entry rating count.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        ratingCount,
        venueRatingCount,
      },
    )
  }

  if (
    venueRatingValueSum !==
      ratingValueSum
  ) {
    throw createEvidenceError(
      'VENUE_RATING_VALUE_ROLLUP_MISMATCH',
      'Venue rating values do not reconcile to the canonical entry rating sum.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        ratingValueSum,
        venueRatingValueSum,
      },
    )
  }

  // ==========================================================
  // BREADTH
  // ==========================================================

  const venueCount =
    venueIds.length

  const visitedVenueCount =
    visitedVenueIds.size

  const breadthRate =
    venueCount >
      0
      ? roundTo(
          visitedVenueCount /
            venueCount,
          8,
        )
      : null

  // ==========================================================
  // DEFENSIVE ENTRY POSTCONDITIONS
  // ==========================================================

  if (
    uniqueParticipantCount >
      uniqueVenueVisitorCount
  ) {
    throw createEvidenceError(
      'PARTICIPATION_REACH_INVARIANT_FAILED',
      'Unique participant count cannot exceed unique user/venue participation count.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        uniqueParticipantCount,
        uniqueVenueVisitorCount,
      },
    )
  }

  /**
   * Under the current immutable evidence uniqueness model:
   *
   *   competition + user + venue
   *
   * every accepted evidence row corresponds to exactly one unique
   * user/venue pair.
   *
   * These remain separate metrics intentionally even though they
   * are equal under the current schema.
   */
  if (
    uniqueVenueVisitorCount !==
      verifiedVenueCheckInCount
  ) {
    throw createEvidenceError(
      'USER_VENUE_CHECKIN_INVARIANT_FAILED',
      'Current evidence model requires one accepted check-in per unique user/venue pair.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        uniqueVenueVisitorCount,
        verifiedVenueCheckInCount,
      },
    )
  }

  if (
    depthContributions.length !==
      uniqueVenueVisitorCount
  ) {
    throw createEvidenceError(
      'DEPTH_CONTRIBUTION_INVARIANT_FAILED',
      'Each distinct qualifying user/venue pair must produce exactly one depth contribution.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        depthContributionCount:
          depthContributions.length,
        uniqueVenueVisitorCount,
      },
    )
  }

  if (
    ratingCount >
      verifiedVenueCheckInCount
  ) {
    throw createEvidenceError(
      'RATING_COUNT_INVARIANT_FAILED',
      'Rating count cannot exceed verified venue check-in count.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        ratingCount,
        verifiedVenueCheckInCount,
      },
    )
  }

  if (
    (
      ratingCount ===
        0 &&
      averageRating !==
        null
    ) ||
    (
      ratingCount >
        0 &&
      averageRating ===
        null
    )
  ) {
    throw createEvidenceError(
      'RATING_AVERAGE_INVARIANT_FAILED',
      'Average rating must be null exactly when rating count is zero.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        ratingCount,
        averageRating,
      },
    )
  }

  if (
    averageRating !==
      null &&
    (
      averageRating <
        MIN_RATING ||
      averageRating >
        MAX_RATING
    )
  ) {
    throw createEvidenceError(
      'RATING_AVERAGE_RANGE_INVARIANT_FAILED',
      'Average rating must remain within the canonical 1–5 rating range.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        ratingCount,
        averageRating,
      },
    )
  }

  if (
    ratedParticipantCount >
      uniqueParticipantCount
  ) {
    throw createEvidenceError(
      'RATING_PARTICIPANT_INVARIANT_FAILED',
      'Rated participant count cannot exceed unique participant count.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        ratedParticipantCount,
        uniqueParticipantCount,
      },
    )
  }

  if (
    visitedVenueCount >
      venueCount
  ) {
    throw createEvidenceError(
      'BREADTH_COUNT_INVARIANT_FAILED',
      'Visited venue count cannot exceed configured venue count.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        visitedVenueCount,
        venueCount,
      },
    )
  }

  if (
    breadthRate !==
      null &&
    (
      breadthRate <
        0 ||
      breadthRate >
        1
    )
  ) {
    throw createEvidenceError(
      'BREADTH_RATE_INVARIANT_FAILED',
      'Breadth rate must remain between 0 and 1.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        breadthRate,
      },
    )
  }

  if (
    uniqueParticipantCount ===
      0 &&
    (
      uniqueVenueVisitorCount !==
        0 ||
      verifiedVenueCheckInCount !==
        0 ||
      weightedParticipation !==
        0 ||
      visitedVenueCount !==
        0 ||
      ratingCount !==
        0
    )
  ) {
    throw createEvidenceError(
      'ZERO_PARTICIPATION_INVARIANT_FAILED',
      'An entry with zero participants cannot contain participation, breadth, or rating evidence.',
      {
        competitionId,
        competitionEntryId:
          entry.id,
        uniqueParticipantCount,
        uniqueVenueVisitorCount,
        verifiedVenueCheckInCount,
        weightedParticipation,
        visitedVenueCount,
        ratingCount,
      },
    )
  }

  return {
    competitionId,

    competitionEntryId:
      entry.id,

    contenderSlot:
      entry.contender_slot,

    venueCount,

    venueIds,

    uniqueParticipantCount,

    uniqueVenueVisitorCount,

    verifiedVenueCheckInCount,

    weightedParticipation,

    depthRuleVersion:
      DEFAULT_VENUE_PARTICIPATION_DEPTH_RULE_VERSION,

    ratingCount,

    ratedParticipantCount,

    averageRating,

    visitedVenueCount,

    breadthRate,

    venues,

    depthContributions,
  }
}

// ============================================================
// VENUE AGGREGATION
// ============================================================
//
// Venue-level metrics are derived from the same accepted canonical
// evidence used by the entry-level aggregate.
//
// These metrics are diagnostic/analytical breakdowns. The official
// entry average is derived directly from raw qualifying
// venue_visits.rating values.
// ============================================================

function buildVenueEvidence({
  venueId,
  evidence,
}: {
  venueId: string

  evidence:
    CanonicalEvidenceRow[]
}): VenueParticipationVenueEvidence {
  const uniqueParticipantIds =
    new Set(
      evidence.map(
        (
          row,
        ) =>
          row.event.user_id,
      ),
    )

  const ratings =
    evidence
      .map(
        (
          row,
        ) =>
          normalizeRating(
            row.visit.rating,
          ),
      )
      .filter(
        (
          rating,
        ): rating is number =>
          rating !==
          null,
      )

  if (
    uniqueParticipantIds.size >
      evidence.length
  ) {
    throw createEvidenceError(
      'VENUE_PARTICIPANT_INVARIANT_FAILED',
      'Venue unique participant count cannot exceed verified visit count.',
      {
        venueId,
        uniqueParticipantCount:
          uniqueParticipantIds.size,
        verifiedVisitCount:
          evidence.length,
      },
    )
  }

  return {
    venueId,

    uniqueParticipantCount:
      uniqueParticipantIds.size,

    verifiedVisitCount:
      evidence.length,

    ratingCount:
      ratings.length,

    averageRating:
      ratings.length >
        0
        ? roundTo(
            average(
              ratings,
            ),
            4,
          )
        : null,
  }
}

// ============================================================
// DEFENSIVE DEDUPLICATION
// ============================================================

function defensivelyDedupeEvidence(
  evidence:
    readonly CanonicalEvidenceRow[],
): CanonicalEvidenceRow[] {
  const ordered =
    [...evidence].sort(
      compareCanonicalEvidence,
    )

  const seenUserVenueKeys =
    new Set<string>()

  const seenVisitKeys =
    new Set<string>()

  const result:
    CanonicalEvidenceRow[] =
    []

  for (
    const row
    of ordered
  ) {
    const userVenueKey =
      createUserVenueKey(
        row.event.user_id,
        row.event.venue_id,
      )

    const visitKey =
      createCompetitionVisitKey(
        row.event.competition_id,
        row.event.venue_visit_id,
      )

    if (
      seenUserVenueKeys.has(
        userVenueKey,
      ) ||
      seenVisitKeys.has(
        visitKey,
      )
    ) {
      continue
    }

    seenUserVenueKeys.add(
      userVenueKey,
    )

    seenVisitKeys.add(
      visitKey,
    )

    result.push(
      row,
    )
  }

  return result
}

// ============================================================
// ENTRY VALIDATION
// ============================================================

function validateEntries(
  entries:
    readonly CompetitionEntryRow[],
  competitionId: string,
): void {
  const ids =
    new Set<string>()

  const slots =
    new Set<number>()

  const globallyAssignedVenueIds =
    new Set<string>()

  for (
    const entry
    of entries
  ) {
    if (
      entry.competition_id !==
        competitionId
    ) {
      throw createEvidenceError(
        'ENTRY_COMPETITION_MISMATCH',
        'Competition entry belongs to a different competition.',
        {
          competitionId,
          entryId:
            entry.id,
          entryCompetitionId:
            entry.competition_id,
        },
      )
    }

    if (
      entry.status !==
        'approved'
    ) {
      throw createEvidenceError(
        'ENTRY_NOT_APPROVED',
        'Venue-participation evidence may only aggregate approved competition entries.',
        {
          competitionId,
          entryId:
            entry.id,
          status:
            entry.status,
        },
      )
    }

    assertUuid(
      entry.id,
      'entry.id',
    )

    if (
      ids.has(
        entry.id,
      )
    ) {
      throw createEvidenceError(
        'DUPLICATE_ENTRY',
        'Competition contains duplicate entry IDs.',
        {
          competitionId,
          entryId:
            entry.id,
        },
      )
    }

    ids.add(
      entry.id,
    )

    if (
      !Number.isSafeInteger(
        entry.contender_slot,
      ) ||
      entry.contender_slot <
        1 ||
      entry.contender_slot >
        4
    ) {
      throw createEvidenceError(
        'INVALID_CONTENDER_SLOT',
        'Competition entry has an invalid contender slot.',
        {
          competitionId,
          entryId:
            entry.id,
          contenderSlot:
            entry.contender_slot,
        },
      )
    }

    if (
      slots.has(
        entry.contender_slot,
      )
    ) {
      throw createEvidenceError(
        'DUPLICATE_CONTENDER_SLOT',
        'Competition contains duplicate contender slots.',
        {
          competitionId,
          contenderSlot:
            entry.contender_slot,
        },
      )
    }

    slots.add(
      entry.contender_slot,
    )

    const venueIds =
      normalizeVenueIds(
        entry.venue_ids,
      )

    if (
      venueIds.length <
        1
    ) {
      throw createEvidenceError(
        'ENTRY_HAS_NO_VENUES',
        'Venue-participation entry has no configured venues.',
        {
          competitionId,
          entryId:
            entry.id,
        },
      )
    }

    const localVenueIds =
      new Set<string>()

    for (
      const venueId
      of venueIds
    ) {
      if (
        localVenueIds.has(
          venueId,
        )
      ) {
        throw createEvidenceError(
          'DUPLICATE_VENUE_WITHIN_ENTRY',
          'Venue-participation entry contains the same venue more than once.',
          {
            competitionId,
            entryId:
              entry.id,
            venueId,
          },
        )
      }

      localVenueIds.add(
        venueId,
      )

      if (
        globallyAssignedVenueIds.has(
          venueId,
        )
      ) {
        throw createEvidenceError(
          'VENUE_ASSIGNED_TO_MULTIPLE_ENTRIES',
          'Venue is assigned to multiple approved entries in the same competition.',
          {
            competitionId,
            venueId,
          },
        )
      }

      globallyAssignedVenueIds.add(
        venueId,
      )
    }
  }
}

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeVenueIds(
  value: unknown,
): string[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return []
  }

  return value
    .filter(
      (
        item,
      ): item is string =>
        typeof item ===
        'string',
    )
    .map(
      (
        item,
      ) =>
        item.trim(),
    )
    .filter(
      (
        item,
      ) =>
        item.length >
        0,
    )
}

function normalizeRating(
  value: unknown,
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isInteger(
      value,
    ) ||
    value <
      MIN_RATING ||
    value >
      MAX_RATING
  ) {
    return null
  }

  return value
}

// ============================================================
// SORTING / KEYS
// ============================================================

function compareCanonicalEvidence(
  left:
    CanonicalEvidenceRow,
  right:
    CanonicalEvidenceRow,
): number {
  const timeComparison =
    compareTimestamp(
      left.event.occurred_at,
      right.event.occurred_at,
    )

  if (
    timeComparison !==
      0
  ) {
    return timeComparison
  }

  return left.event.id.localeCompare(
    right.event.id,
  )
}

function createUserVenueKey(
  userId: string,
  venueId: string,
): string {
  return `${userId}::${venueId}`
}

function createCompetitionVisitKey(
  competitionId: string,
  venueVisitId: string,
): string {
  return `${competitionId}::${venueVisitId}`
}

// ============================================================
// TIMESTAMP HELPERS
// ============================================================

function compareTimestamp(
  left: string,
  right: string,
): number {
  const leftMs =
    Date.parse(
      left,
    )

  const rightMs =
    Date.parse(
      right,
    )

  if (
    !Number.isFinite(
      leftMs,
    ) ||
    !Number.isFinite(
      rightMs,
    )
  ) {
    return left.localeCompare(
      right,
    )
  }

  return (
    leftMs -
    rightMs
  )
}

function timestampsEqual(
  left: string,
  right: string,
): boolean {
  const leftMs =
    Date.parse(
      left,
    )

  const rightMs =
    Date.parse(
      right,
    )

  if (
    Number.isFinite(
      leftMs,
    ) &&
    Number.isFinite(
      rightMs,
    )
  ) {
    return (
      leftMs ===
      rightMs
    )
  }

  return (
    left ===
    right
  )
}

// ============================================================
// NUMERIC HELPERS
// ============================================================

function average(
  values:
    readonly number[],
): number {
  if (
    values.length ===
      0
  ) {
    throw createEvidenceError(
      'EMPTY_AVERAGE',
      'Cannot average an empty numeric collection.',
      {},
    )
  }

  return (
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ) /
    values.length
  )
}

function roundTo(
  value: number,
  decimalPlaces: number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    throw createEvidenceError(
      'INVALID_NUMBER',
      'Cannot round a non-finite numeric value.',
      {
        value,
        decimalPlaces,
      },
    )
  }

  if (
    !Number.isSafeInteger(
      decimalPlaces,
    ) ||
    decimalPlaces <
      0 ||
    decimalPlaces >
      15
  ) {
    throw createEvidenceError(
      'INVALID_DECIMAL_PLACES',
      'decimalPlaces must be a safe integer between 0 and 15.',
      {
        value,
        decimalPlaces,
      },
    )
  }

  const factor =
    10 **
    decimalPlaces

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        factor,
    ) /
    factor
  )
}

// ============================================================
// BASIC VALIDATION
// ============================================================

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value ===
      'string' &&
    value.trim().length >
      0
  )
}

function assertUuid(
  value: string,
  name: string,
): void {
  if (
    typeof value !==
      'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw createEvidenceError(
      'INVALID_UUID',
      `${name} must be a valid UUID.`,
      {
        field:
          name,
        value,
      },
    )
  }
}

// ============================================================
// SERVICE CLIENT
// ============================================================

function createCompetitionServiceClient(): SupabaseClient<any> {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    supabaseUrl.trim().length ===
      0
  ) {
    throw createEvidenceError(
      'SUPABASE_URL_MISSING',
      'NEXT_PUBLIC_SUPABASE_URL is not configured.',
      {},
    )
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey.trim().length ===
      0
  ) {
    throw createEvidenceError(
      'SERVICE_ROLE_KEY_MISSING',
      'SUPABASE_SERVICE_ROLE_KEY is not configured.',
      {},
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
    },
  )
}

// ============================================================
// DOMAIN ERROR
// ============================================================

export class VenueParticipationEvidenceError
  extends Error {
  readonly code:
    | 'INVALID_UUID'
    | 'COMPETITION_LOOKUP_FAILED'
    | 'COMPETITION_NOT_FOUND'
    | 'INVALID_COMPETITION_TYPE'
    | 'INVALID_EXECUTION_MODE'
    | 'ENTRY_LOOKUP_FAILED'
    | 'INVALID_ENTRY_COUNT'
    | 'ENTRY_COMPETITION_MISMATCH'
    | 'ENTRY_NOT_APPROVED'
    | 'DUPLICATE_ENTRY'
    | 'INVALID_CONTENDER_SLOT'
    | 'DUPLICATE_CONTENDER_SLOT'
    | 'ENTRY_HAS_NO_VENUES'
    | 'DUPLICATE_VENUE_WITHIN_ENTRY'
    | 'VENUE_ASSIGNED_TO_MULTIPLE_ENTRIES'
    | 'EVENT_LOOKUP_FAILED'
    | 'VENUE_VISIT_LOOKUP_FAILED'
    | 'EVIDENCE_ACCOUNTING_MISMATCH'
    | 'VENUE_AGGREGATION_MISMATCH'
    | 'ENTRY_DEDUPLICATION_INVARIANT_FAILED'
    | 'PARTICIPATION_REACH_INVARIANT_FAILED'
    | 'USER_VENUE_CHECKIN_INVARIANT_FAILED'
    | 'DEPTH_SEQUENCE_INVARIANT_FAILED'
    | 'DEPTH_CONTRIBUTION_INVARIANT_FAILED'
    | 'RATING_COUNT_INVARIANT_FAILED'
    | 'RATING_AVERAGE_INVARIANT_FAILED'
    | 'RATING_AVERAGE_RANGE_INVARIANT_FAILED'
    | 'RATING_PARTICIPANT_INVARIANT_FAILED'
    | 'VENUE_RATING_COUNT_ROLLUP_MISMATCH'
    | 'VENUE_RATING_VALUE_ROLLUP_MISMATCH'
    | 'BREADTH_COUNT_INVARIANT_FAILED'
    | 'BREADTH_RATE_INVARIANT_FAILED'
    | 'ZERO_PARTICIPATION_INVARIANT_FAILED'
    | 'VENUE_PARTICIPANT_INVARIANT_FAILED'
    | 'EMPTY_AVERAGE'
    | 'INVALID_NUMBER'
    | 'INVALID_DECIMAL_PLACES'
    | 'SUPABASE_URL_MISSING'
    | 'SERVICE_ROLE_KEY_MISSING'

  readonly context:
    Readonly<
      Record<
        string,
        unknown
      >
    >

  constructor({
    code,
    message,
    context,
  }: {
    code:
      VenueParticipationEvidenceError['code']

    message: string

    context:
      Record<
        string,
        unknown
      >
  }) {
    super(
      message,
    )

    this.name =
      'VenueParticipationEvidenceError'

    this.code =
      code

    this.context =
      Object.freeze({
        ...context,
      })
  }
}

function createEvidenceError(
  code:
    VenueParticipationEvidenceError['code'],
  message: string,
  context:
    Record<
      string,
      unknown
    >,
): VenueParticipationEvidenceError {
  return new VenueParticipationEvidenceError({
    code,
    message,
    context,
  })
}