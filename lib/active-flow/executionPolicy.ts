import { createServerClient } from '@/lib/supabase/server'

export type ActiveFlowExecutionConstraint =
  | 'relay_execution'
  | 'competition_execution'
  | 'snapshot_replay'

export type ActiveFlowExecutionPolicy = {
  canInsertStop: boolean
  canReplaceStop: boolean
  canRemoveStop: boolean
  canReorderStops: boolean
  canReroute: boolean
  constraints: ActiveFlowExecutionConstraint[]
}

type SupabaseServerClient = Awaited<
  ReturnType<
    typeof createServerClient
  >
>

type ActiveFlowExecutionPolicySessionRow = {
  id: string
  user_id: string
  source: string
}

type CompetitionFlowSessionExistenceRow = {
  id: string
}

const FIXED_EXECUTION_CAPABILITIES = {
  canInsertStop: false,
  canReplaceStop: false,
  canRemoveStop: false,
  canReorderStops: false,
  canReroute: false,
} as const

const ADAPTIVE_EXECUTION_CAPABILITIES = {
  canInsertStop: true,
  canReplaceStop: true,
  canRemoveStop: true,
  canReorderStops: true,
  canReroute: true,
} as const

/**
 * Resolve the execution policy for an Active Flow session.
 *
 * This is the canonical application-layer boundary for deciding
 * whether an existing Active Flow is eligible for future adaptive
 * execution.
 *
 * A Flow is fixed when any of the following constraints apply:
 *
 *   - Relay execution:
 *       active_flow_sessions.source = 'roam_relay_team_slot'
 *
 *   - Snapshot replay:
 *       active_flow_sessions.source = 'flow_snapshot'
 *
 *   - Competition execution:
 *       at least one competition_flow_sessions row exists for the
 *       exact (flow_session_id, user_id) pair
 *
 * All other Active Flows are adaptive-eligible.
 *
 * Important:
 *
 *   - "Adaptive-eligible" does not itself mutate a Flow.
 *   - This function performs reads only.
 *   - It does not persist policy state.
 *   - It does not modify active_flow_sessions.
 *   - It does not modify active_flow_stops.
 *   - It does not modify active_flow_progress.
 *   - It does not modify venue_visits.
 *   - It does not alter Relay, competition, or replay semantics.
 *   - A future database mutation boundary must independently
 *     re-check fixed-execution constraints before mutating a Flow.
 *
 * The competition lookup intentionally uses limit(1) rather than
 * maybeSingle(). competition_flow_sessions does not currently
 * guarantee uniqueness for flow_session_id, and policy resolution
 * only needs to know whether at least one qualifying bridge exists.
 *
 * Failure semantics:
 *
 * Policy resolution fails closed. If the session cannot be loaded
 * or competition linkage cannot be determined reliably, this
 * function throws instead of incorrectly declaring the Flow
 * adaptive-eligible.
 */
export async function getActiveFlowExecutionPolicy({
  sessionId,
  userId,
  supabase: providedSupabase,
}: {
  sessionId: string
  userId: string
  supabase?: SupabaseServerClient
}): Promise<ActiveFlowExecutionPolicy> {
  const normalizedSessionId =
    sessionId.trim()

  const normalizedUserId =
    userId.trim()

  if (!normalizedSessionId) {
    throw new Error(
      '[active-flow/execution-policy] sessionId is required.'
    )
  }

  if (!normalizedUserId) {
    throw new Error(
      '[active-flow/execution-policy] userId is required.'
    )
  }

  const supabase =
    providedSupabase ??
    (await createServerClient())

  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from(
      'active_flow_sessions'
    )
    .select(
      'id, user_id, source'
    )
    .eq(
      'id',
      normalizedSessionId
    )
    .eq(
      'user_id',
      normalizedUserId
    )
    .maybeSingle<ActiveFlowExecutionPolicySessionRow>()

  if (sessionError) {
    console.error(
      '[active-flow/execution-policy] Active Flow session lookup failed:',
      {
        sessionId:
          normalizedSessionId,

        userId:
          normalizedUserId,

        error:
          sessionError,
      }
    )

    throw new Error(
      'Could not determine Active Flow execution policy.'
    )
  }

  if (!session) {
    console.error(
      '[active-flow/execution-policy] Active Flow session not found:',
      {
        sessionId:
          normalizedSessionId,

        userId:
          normalizedUserId,
      }
    )

    throw new Error(
      'Could not determine Active Flow execution policy.'
    )
  }

  const constraints:
    ActiveFlowExecutionConstraint[] =
    []

  if (
    session.source ===
    'roam_relay_team_slot'
  ) {
    constraints.push(
      'relay_execution'
    )
  }

  if (
    session.source ===
    'flow_snapshot'
  ) {
    constraints.push(
      'snapshot_replay'
    )
  }

  const {
    data: competitionFlowSessions,
    error: competitionFlowSessionsError,
  } = await supabase
    .from(
      'competition_flow_sessions'
    )
    .select(
      'id'
    )
    .eq(
      'flow_session_id',
      session.id
    )
    .eq(
      'user_id',
      session.user_id
    )
    .limit(
      1
    )

  if (
    competitionFlowSessionsError
  ) {
    console.error(
      '[active-flow/execution-policy] Competition execution lookup failed:',
      {
        sessionId:
          session.id,

        userId:
          session.user_id,

        error:
          competitionFlowSessionsError,
      }
    )

    /**
     * Fail closed.
     *
     * An inability to prove that no competition execution exists
     * must never cause a potentially fixed Flow to be classified
     * as adaptive-eligible.
     */
    throw new Error(
      'Could not determine Active Flow execution policy.'
    )
  }

  const competitionFlowSession =
    (
      competitionFlowSessions ??
      []
    )[0] as
      | CompetitionFlowSessionExistenceRow
      | undefined

  if (competitionFlowSession) {
    constraints.push(
      'competition_execution'
    )
  }

  const isFixedExecution =
    constraints.length > 0

  if (isFixedExecution) {
    return {
      ...FIXED_EXECUTION_CAPABILITIES,

      constraints,
    }
  }

  return {
    ...ADAPTIVE_EXECUTION_CAPABILITIES,

    constraints,
  }
}

/**
 * Convenience predicate for call sites that need a single
 * "may this Flow adapt at all?" answer while preserving the
 * granular capability model as the canonical policy.
 *
 * This function deliberately requires every adaptive capability
 * to be enabled. Future policy expansion can therefore disable
 * one capability without accidentally treating a partially
 * restricted Flow as fully adaptive.
 */
export function isActiveFlowAdaptiveEligible(
  policy: ActiveFlowExecutionPolicy
): boolean {
  return (
    policy.canInsertStop &&
    policy.canReplaceStop &&
    policy.canRemoveStop &&
    policy.canReorderStops &&
    policy.canReroute &&
    policy.constraints.length ===
      0
  )
}