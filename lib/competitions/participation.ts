import 'server-only'

import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

// ============================================================
// TYPES
// ============================================================

type CompetitionFlowBridgeRow = {
  competition_id: string
  competition_entry_id: string
  flow_session_id: string
  user_id: string
}

type CompetitionEntryRouteRow = {
  id: string
  competition_id: string
  user_id: string
  venue_ids: string[] | null
  status: string
}

type ActiveFlowSessionRow = {
  id: string
  user_id: string
  venue_ids: string[] | null
  status: 'active' | 'completed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
}

type ActiveFlowProgressEvidenceRow = {
  id: string
  session_id: string
  user_id: string
  venue_id: string
  stop_index: number
  checked_in_at: string | null
  geo_verified: boolean
  check_in_source: string | null
}

type VenueVisitEvidenceRow = {
  id: string
  user_id: string
  venue_id: string
  visited_at: string
  geo_verified: boolean
  check_in_source: string
}

type CompetitionParticipationRow = {
  id: string
  competition_id: string
  competition_entry_id: string
  user_id: string
  flow_session_id: string | null

  verified_stop_count: number
  total_stop_count: number

  qualified: boolean

  started_at: string
  completed_at: string | null

  created_at: string
  updated_at: string
}

export type CompetitionParticipationReconciliationResult = {
  linked: boolean

  repaired: boolean

  competitionId: string | null
  competitionEntryId: string | null

  flowSessionId: string
  participationId: string | null

  userId: string

  flowStatus:
    | 'active'
    | 'completed'
    | 'cancelled'
    | null

  totalStopCount: number
  verifiedStopCount: number
  requiredVerifiedStopCount: number

  flowCompleted: boolean
  qualified: boolean

  completedAt: string | null

  verifiedStopIndexes: number[]
}

type ReconcileCompetitionParticipationInput = {
  flowSessionId: string
  userId: string

  /**
   * Optional dependency injection.
   *
   * Normal callers should omit this and allow the helper to create
   * its own trusted service-role client.
   *
   * Tests or other trusted server orchestration may inject a client.
   */
  serviceSupabase?: SupabaseClient<any>
}

// ============================================================
// QUALIFICATION RULE
// ============================================================

/**
 * Competition qualification rule v1.
 *
 * Canonical mapping:
 *
 * 3  -> 3
 * 4  -> 4
 * 5  -> 4
 * 6  -> 5
 * 7  -> 6
 * 8  -> 6
 * 9  -> 7
 * 10 -> 8
 *
 * For routes >= 5 stops:
 *   ceil(total * 0.75)
 *
 * with a minimum of 4 verified stops.
 *
 * Routes below 3 stops are not competition-eligible.
 */
export function getRequiredVerifiedStopsV1(
  totalStopCount: number
): number {
  if (
    !Number.isInteger(
      totalStopCount
    ) ||
    totalStopCount < 3
  ) {
    return 0
  }

  if (
    totalStopCount === 3
  ) {
    return 3
  }

  if (
    totalStopCount === 4
  ) {
    return 4
  }

  return Math.max(
    4,
    Math.ceil(
      totalStopCount *
        0.75
    )
  )
}

// ============================================================
// PUBLIC RECONCILIATION API
// ============================================================

/**
 * Reconcile one competition participation from canonical evidence.
 *
 * Evidence chain:
 *
 *   active_flow_sessions
 *          +
 *   competition_flow_sessions
 *          +
 *   competition_entries.venue_ids
 *          +
 *   active_flow_progress.geo_verified
 *          +
 *   matching venue_visits.geo_verified
 *          ↓
 *   competition_participations
 *
 * A stop counts as verified only when:
 *
 *   1. active_flow_progress belongs to this exact session/user
 *   2. geo_verified = true
 *   3. stop_index is valid
 *   4. route[stop_index] === progress.venue_id
 *   5. checked_in_at exists
 *   6. an existing venue_visits row exists for the same:
 *        - user
 *        - venue
 *        - visited_at === checked_in_at
 *        - geo_verified = true
 *        - check_in_source = 'active_flow'
 *
 * No venue_visits rows are created here.
 *
 * Qualification is true only when:
 *
 *   - the Active Flow is canonically completed
 *   - the verified evidence count satisfies qualification v1
 *
 * This helper is intentionally idempotent and monotonic.
 */
export async function reconcileCompetitionParticipation({
  flowSessionId,
  userId,
  serviceSupabase,
}: ReconcileCompetitionParticipationInput): Promise<CompetitionParticipationReconciliationResult> {
  assertNonEmptyString(
    flowSessionId,
    'flowSessionId'
  )

  assertNonEmptyString(
    userId,
    'userId'
  )

  const supabase =
    serviceSupabase ??
    createCompetitionServiceClient()

  // ==========================================================
  // BRIDGE CONTEXT
  // ==========================================================

  const {
    data: bridge,
    error: bridgeError,
  } = await supabase
    .from(
      'competition_flow_sessions'
    )
    .select(`
      competition_id,
      competition_entry_id,
      flow_session_id,
      user_id
    `)
    .eq(
      'flow_session_id',
      flowSessionId
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle<CompetitionFlowBridgeRow>()

  if (bridgeError) {
    throw createReconciliationError(
      'BRIDGE_LOOKUP_FAILED',
      'Could not resolve competition Flow bridge.',
      {
        flowSessionId,
        userId,
        cause:
          bridgeError,
      }
    )
  }

  /**
   * Ordinary Active Flow.
   *
   * This is not an error. Most Active Flows are not expected to be
   * linked to competition participation.
   */
  if (!bridge) {
    return {
      linked:
        false,

      repaired:
        false,

      competitionId:
        null,

      competitionEntryId:
        null,

      flowSessionId,

      participationId:
        null,

      userId,

      flowStatus:
        null,

      totalStopCount:
        0,

      verifiedStopCount:
        0,

      requiredVerifiedStopCount:
        0,

      flowCompleted:
        false,

      qualified:
        false,

      completedAt:
        null,

      verifiedStopIndexes:
        [],
    }
  }

  // ==========================================================
  // LOAD CANONICAL FLOW + ENTRY + PARTICIPATION
  // ==========================================================

  const [
    flowResult,
    entryResult,
    participationResult,
  ] = await Promise.all([
    supabase
      .from(
        'active_flow_sessions'
      )
      .select(`
        id,
        user_id,
        venue_ids,
        status,
        started_at,
        completed_at
      `)
      .eq(
        'id',
        flowSessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle<ActiveFlowSessionRow>(),

    supabase
      .from(
        'competition_entries'
      )
      .select(`
        id,
        competition_id,
        user_id,
        venue_ids,
        status
      `)
      .eq(
        'id',
        bridge.competition_entry_id
      )
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .maybeSingle<CompetitionEntryRouteRow>(),

    supabase
      .from(
        'competition_participations'
      )
      .select(`
        id,
        competition_id,
        competition_entry_id,
        user_id,
        flow_session_id,
        verified_stop_count,
        total_stop_count,
        qualified,
        started_at,
        completed_at,
        created_at,
        updated_at
      `)
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .eq(
        'competition_entry_id',
        bridge.competition_entry_id
      )
      .eq(
        'flow_session_id',
        flowSessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle<CompetitionParticipationRow>(),
  ])

  if (
    flowResult.error
  ) {
    throw createReconciliationError(
      'FLOW_LOOKUP_FAILED',
      'Could not load canonical Active Flow session.',
      {
        flowSessionId,
        userId,
        cause:
          flowResult.error,
      }
    )
  }

  if (
    entryResult.error
  ) {
    throw createReconciliationError(
      'ENTRY_LOOKUP_FAILED',
      'Could not load canonical competition entry.',
      {
        flowSessionId,
        userId,
        competitionId:
          bridge.competition_id,
        competitionEntryId:
          bridge.competition_entry_id,
        cause:
          entryResult.error,
      }
    )
  }

  if (
    participationResult.error
  ) {
    throw createReconciliationError(
      'PARTICIPATION_LOOKUP_FAILED',
      'Could not load linked competition participation.',
      {
        flowSessionId,
        userId,
        competitionId:
          bridge.competition_id,
        competitionEntryId:
          bridge.competition_entry_id,
        cause:
          participationResult.error,
      }
    )
  }

  const flowSession =
    flowResult.data

  const entry =
    entryResult.data

  const participation =
    participationResult.data

  if (!flowSession) {
    throw createReconciliationError(
      'FLOW_MISSING',
      'Competition bridge references a missing Active Flow session.',
      {
        flowSessionId,
        userId,
      }
    )
  }

  if (!entry) {
    throw createReconciliationError(
      'ENTRY_MISSING',
      'Competition bridge references a missing competition entry.',
      {
        flowSessionId,
        userId,
        competitionId:
          bridge.competition_id,
        competitionEntryId:
          bridge.competition_entry_id,
      }
    )
  }

  if (!participation) {
    throw createReconciliationError(
      'PARTICIPATION_MISSING',
      'Competition bridge exists without its linked participation.',
      {
        flowSessionId,
        userId,
        competitionId:
          bridge.competition_id,
        competitionEntryId:
          bridge.competition_entry_id,
      }
    )
  }

  // ==========================================================
  // IDENTITY CONSISTENCY
  // ==========================================================

  if (
    bridge.flow_session_id !==
      flowSessionId ||
    bridge.user_id !==
      userId ||
    participation.flow_session_id !==
      flowSessionId ||
    participation.user_id !==
      userId ||
    participation.competition_id !==
      bridge.competition_id ||
    participation.competition_entry_id !==
      bridge.competition_entry_id
  ) {
    throw createReconciliationError(
      'IDENTITY_MISMATCH',
      'Competition participation identity is inconsistent with its Flow bridge.',
      {
        flowSessionId,
        userId,
        bridge,
        participationId:
          participation.id,
      }
    )
  }

  // ==========================================================
  // CANONICAL ROUTE
  // ==========================================================

  const entryVenueIds =
    normalizeVenueIds(
      entry.venue_ids
    )

  const flowVenueIds =
    normalizeVenueIds(
      flowSession.venue_ids
    )

  if (
    entryVenueIds.length <
      3
  ) {
    throw createReconciliationError(
      'INVALID_ENTRY_ROUTE',
      'Competition entry has fewer than 3 canonical route stops.',
      {
        flowSessionId,
        userId,
        competitionEntryId:
          bridge.competition_entry_id,
      }
    )
  }

  /**
   * The competition entry snapshot is the immutable competition
   * route. The generic Active Flow created from it must still match
   * exactly, including ordering.
   */
  if (
    !arraysEqual(
      entryVenueIds,
      flowVenueIds
    )
  ) {
    throw createReconciliationError(
      'ROUTE_MISMATCH',
      'Active Flow route no longer matches the competition entry snapshot.',
      {
        flowSessionId,
        userId,
        competitionEntryId:
          bridge.competition_entry_id,
      }
    )
  }

  const totalStopCount =
    entryVenueIds.length

  if (
    participation.total_stop_count !==
      totalStopCount
  ) {
    throw createReconciliationError(
      'TOTAL_STOP_COUNT_MISMATCH',
      'Competition participation total stop count does not match its canonical entry route.',
      {
        flowSessionId,
        userId,
        participationId:
          participation.id,
        participationTotalStopCount:
          participation.total_stop_count,
        canonicalTotalStopCount:
          totalStopCount,
      }
    )
  }

  // ==========================================================
  // ACTIVE FLOW PROGRESS EVIDENCE
  // ==========================================================

  const {
    data: progressRows,
    error: progressError,
  } = await supabase
    .from(
      'active_flow_progress'
    )
    .select(`
      id,
      session_id,
      user_id,
      venue_id,
      stop_index,
      checked_in_at,
      geo_verified,
      check_in_source
    `)
    .eq(
      'session_id',
      flowSessionId
    )
    .eq(
      'user_id',
      userId
    )
    .eq(
      'geo_verified',
      true
    )
    .order(
      'stop_index',
      {
        ascending:
          true,
      }
    )

  if (progressError) {
    throw createReconciliationError(
      'PROGRESS_LOOKUP_FAILED',
      'Could not load verified Active Flow progress.',
      {
        flowSessionId,
        userId,
        cause:
          progressError,
      }
    )
  }

  const candidateProgress =
    (
      progressRows ??
      []
    ).filter(
      isCanonicalProgressCandidate
    )

  // ==========================================================
  // VENUE VISIT EVIDENCE
  // ==========================================================

  /**
   * Only load potential venue-history evidence for venues that
   * actually appear in the competition route.
   */
  const uniqueRouteVenueIds =
    [
      ...new Set(
        entryVenueIds
      ),
    ]

  let venueVisitRows:
    VenueVisitEvidenceRow[] =
    []

  if (
    uniqueRouteVenueIds.length >
      0
  ) {
    const {
      data:
        venueVisitData,
      error:
        venueVisitError,
    } = await supabase
      .from(
        'venue_visits'
      )
      .select(`
        id,
        user_id,
        venue_id,
        visited_at,
        geo_verified,
        check_in_source
      `)
      .eq(
        'user_id',
        userId
      )
      .eq(
        'geo_verified',
        true
      )
      .eq(
        'check_in_source',
        'active_flow'
      )
      .in(
        'venue_id',
        uniqueRouteVenueIds
      )

    if (venueVisitError) {
      throw createReconciliationError(
        'VENUE_VISIT_LOOKUP_FAILED',
        'Could not load canonical venue visit evidence.',
        {
          flowSessionId,
          userId,
          cause:
            venueVisitError,
        }
      )
    }

    venueVisitRows =
      (
        venueVisitData ??
        []
      ) as VenueVisitEvidenceRow[]
  }

  // ==========================================================
  // CROSS-PROVE VERIFIED STOPS
  // ==========================================================

  /**
   * venue_visits has no flow_session_id.
   *
   * The canonical Active Flow writer uses the same timestamp for:
   *
   *   active_flow_progress.checked_in_at
   *   venue_visits.visited_at
   *
   * Legacy repair preserves the same timestamp.
   *
   * That exact tuple lets us reuse the existing venue_visits event
   * without creating a competition-specific duplicate:
   *
   *   user + venue + timestamp + active_flow source
   */
  const venueVisitEvidenceKeys =
    new Set(
      venueVisitRows
        .filter(
          (
            row
          ) =>
            row.geo_verified ===
              true &&
            row.check_in_source ===
              'active_flow' &&
            typeof row.visited_at ===
              'string'
        )
        .map(
          (
            row
          ) =>
            createVisitEvidenceKey(
              row.venue_id,
              row.visited_at
            )
        )
    )

  const verifiedStopIndexes =
    new Set<number>()

  for (
    const progress
    of candidateProgress
  ) {
    if (
      progress.session_id !==
        flowSessionId ||
      progress.user_id !==
        userId
    ) {
      continue
    }

    if (
      progress.geo_verified !==
        true
    ) {
      continue
    }

    if (
      !Number.isInteger(
        progress.stop_index
      ) ||
      progress.stop_index <
        0 ||
      progress.stop_index >=
        totalStopCount
    ) {
      continue
    }

    /**
     * Route order is canonical.
     *
     * A progress event cannot claim stop 2 while carrying the venue
     * assigned to stop 4.
     */
    if (
      entryVenueIds[
        progress.stop_index
      ] !==
      progress.venue_id
    ) {
      continue
    }

    if (
      typeof progress.checked_in_at !==
        'string' ||
      progress.checked_in_at
        .trim()
        .length ===
        0
    ) {
      continue
    }

    const visitEvidenceKey =
      createVisitEvidenceKey(
        progress.venue_id,
        progress.checked_in_at
      )

    if (
      !venueVisitEvidenceKeys.has(
        visitEvidenceKey
      )
    ) {
      continue
    }

    verifiedStopIndexes.add(
      progress.stop_index
    )
  }

  const sortedVerifiedStopIndexes =
    [
      ...verifiedStopIndexes,
    ].sort(
      (
        left,
        right
      ) =>
        left -
        right
    )

  const verifiedStopCount =
    Math.min(
      sortedVerifiedStopIndexes.length,
      totalStopCount
    )

  const requiredVerifiedStopCount =
    getRequiredVerifiedStopsV1(
      totalStopCount
    )

  // ==========================================================
  // QUALIFIED COMPLETION
  // ==========================================================

  /**
   * Evidence volume alone does not complete participation.
   *
   * The generic Active Flow must itself be canonically completed.
   */
  const flowCompleted =
    flowSession.status ===
      'completed' &&
    typeof flowSession.completed_at ===
      'string' &&
    flowSession.completed_at
      .trim()
      .length >
      0

  const canonicallyQualified =
    flowCompleted &&
    requiredVerifiedStopCount >
      0 &&
    verifiedStopCount >=
      requiredVerifiedStopCount

  const canonicalCompletedAt =
    flowCompleted
      ? flowSession.completed_at
      : null

  // ==========================================================
  // MONOTONIC AGGREGATE UPDATE
  // ==========================================================

  /**
   * participation is a derived aggregate, not raw evidence.
   *
   * Existing schema invariants intentionally prohibit progress
   * regressions, so this reconciliation only moves forward.
   */
  const nextVerifiedStopCount =
    Math.max(
      participation.verified_stop_count,
      verifiedStopCount
    )

  const nextQualified =
    participation.qualified ||
    canonicallyQualified

  const nextCompletedAt =
    participation.completed_at ??
    canonicalCompletedAt

  const needsUpdate =
    nextVerifiedStopCount !==
      participation.verified_stop_count ||
    nextQualified !==
      participation.qualified ||
    nextCompletedAt !==
      participation.completed_at

  let repaired =
    false

  if (needsUpdate) {
    const updatePayload: {
      verified_stop_count: number
      qualified: boolean
      completed_at: string | null
      updated_at: string
    } = {
      verified_stop_count:
        nextVerifiedStopCount,

      qualified:
        nextQualified,

      completed_at:
        nextCompletedAt,

      updated_at:
        new Date()
          .toISOString(),
    }

    /**
     * verified_stop_count <= nextVerifiedStopCount prevents a stale
     * reconciliation request from overwriting newer progress with a
     * lower value during concurrent check-ins.
     */
    const {
      data:
        updatedParticipation,
      error:
        updateError,
    } = await supabase
      .from(
        'competition_participations'
      )
      .update(
        updatePayload
      )
      .eq(
        'id',
        participation.id
      )
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .eq(
        'competition_entry_id',
        bridge.competition_entry_id
      )
      .eq(
        'flow_session_id',
        flowSessionId
      )
      .eq(
        'user_id',
        userId
      )
      .lte(
        'verified_stop_count',
        nextVerifiedStopCount
      )
      .select(`
        id,
        competition_id,
        competition_entry_id,
        user_id,
        flow_session_id,
        verified_stop_count,
        total_stop_count,
        qualified,
        started_at,
        completed_at,
        created_at,
        updated_at
      `)
      .maybeSingle<CompetitionParticipationRow>()

    if (updateError) {
      throw createReconciliationError(
        'PARTICIPATION_UPDATE_FAILED',
        'Could not reconcile competition participation.',
        {
          flowSessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          participationId:
            participation.id,
          verifiedStopCount:
            nextVerifiedStopCount,
          qualified:
            nextQualified,
          cause:
            updateError,
        }
      )
    }

    /**
     * A concurrent reconciliation may already have advanced the row
     * beyond our stale snapshot. In that case the guarded UPDATE can
     * legitimately match nothing.
     */
    repaired =
      Boolean(
        updatedParticipation
      )
  }

  return {
    linked:
      true,

    repaired,

    competitionId:
      bridge.competition_id,

    competitionEntryId:
      bridge.competition_entry_id,

    flowSessionId,

    participationId:
      participation.id,

    userId,

    flowStatus:
      flowSession.status,

    totalStopCount,

    verifiedStopCount,

    requiredVerifiedStopCount,

    flowCompleted,

    qualified:
      canonicallyQualified,

    completedAt:
      canonicalCompletedAt,

    verifiedStopIndexes:
      sortedVerifiedStopIndexes,
  }
}

// ============================================================
// BEST-EFFORT WRAPPER
// ============================================================

/**
 * Safe wrapper for check-in / legacy-repair endpoints.
 *
 * A verified physical check-in must not be invalidated because the
 * downstream competition aggregate temporarily failed to refresh.
 */
export async function safelyReconcileCompetitionParticipation({
  flowSessionId,
  userId,
  serviceSupabase,
}: ReconcileCompetitionParticipationInput): Promise<
  CompetitionParticipationReconciliationResult | null
> {
  try {
    return await reconcileCompetitionParticipation({
      flowSessionId,
      userId,
      serviceSupabase,
    })
  } catch (error) {
    console.error(
      '[competitions/participation] Reconciliation failed:',
      {
        flowSessionId,
        userId,
        error,
      }
    )

    return null
  }
}

// ============================================================
// SERVICE CLIENT
// ============================================================

function createCompetitionServiceClient(): SupabaseClient<any> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    supabaseUrl
      .trim()
      .length ===
      0
  ) {
    throw createReconciliationError(
      'MISSING_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL is not configured.',
      {}
    )
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey
      .trim()
      .length ===
      0
  ) {
    throw createReconciliationError(
      'MISSING_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY is not configured.',
      {}
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
// INTERNAL HELPERS
// ============================================================

function normalizeVenueIds(
  value: unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  return value.map(
    (
      venueId
    ) =>
      typeof venueId ===
        'string'
        ? venueId.trim()
        : ''
  )
}

function arraysEqual(
  left: string[],
  right: string[]
): boolean {
  if (
    left.length !==
    right.length
  ) {
    return false
  }

  for (
    let index = 0;
    index <
    left.length;
    index += 1
  ) {
    if (
      left[index] !==
      right[index]
    ) {
      return false
    }
  }

  return true
}

function isCanonicalProgressCandidate(
  value: unknown
): value is ActiveFlowProgressEvidenceRow {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const row =
    value as Record<
      string,
      unknown
    >

  return (
    typeof row.id ===
      'string' &&
    typeof row.session_id ===
      'string' &&
    typeof row.user_id ===
      'string' &&
    typeof row.venue_id ===
      'string' &&
    typeof row.stop_index ===
      'number' &&
    Number.isInteger(
      row.stop_index
    ) &&
    typeof row.geo_verified ===
      'boolean' &&
    (
      row.checked_in_at ===
        null ||
      typeof row.checked_in_at ===
        'string'
    ) &&
    (
      row.check_in_source ===
        null ||
      typeof row.check_in_source ===
        'string'
    )
  )
}

function createVisitEvidenceKey(
  venueId: string,
  timestamp: string
): string {
  return `${venueId}::${timestamp}`
}

function assertNonEmptyString(
  value: string,
  name: string
): void {
  if (
    typeof value !==
      'string' ||
    value
      .trim()
      .length ===
      0
  ) {
    throw createReconciliationError(
      'INVALID_ARGUMENT',
      `${name} is required.`,
      {
        argument:
          name,
      }
    )
  }
}

// ============================================================
// ERROR TYPE
// ============================================================

export class CompetitionParticipationReconciliationError
  extends Error {
  readonly code: string
  readonly context: Record<
    string,
    unknown
  >

  constructor({
    code,
    message,
    context,
  }: {
    code: string
    message: string
    context: Record<
      string,
      unknown
    >
  }) {
    super(
      message
    )

    this.name =
      'CompetitionParticipationReconciliationError'

    this.code =
      code

    this.context =
      context
  }
}

function createReconciliationError(
  code: string,
  message: string,
  context: Record<
    string,
    unknown
  >
): CompetitionParticipationReconciliationError {
  return new CompetitionParticipationReconciliationError({
    code,
    message,
    context,
  })
}