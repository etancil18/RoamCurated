
import 'server-only'

import {
  createClient,
} from '@supabase/supabase-js'

type ReplayAttestationInput = {
  sessionId: string
  replayUserId: string
  snapshotId: string
  flowStopId: string
  progressId: string
  stopIndex: number
  venueId: string
  verifiedAt: string
}

type TrustedReplayPersistenceInput =
  ReplayAttestationInput & {
    venueVisitId: string
  }

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  )
}

/**
 * Builds the canonical identity payload for a future
 * server-only Replay attestation write.
 *
 * This is not an authorization decision.
 *
 * The caller must independently verify:
 * - authenticated session ownership
 * - flow_snapshot source and snapshot identity
 * - immutable snapshot stop mapping
 * - successful GPS validation
 * - successfully persisted verified progress
 * - successfully persisted venue visit
 *
 * This function does not write to Supabase.
 */
export function prepareTrustedReplayAttestation(
  input: ReplayAttestationInput
) {
  if (
    !isNonEmptyString(input.sessionId) ||
    !isNonEmptyString(input.replayUserId) ||
    !isNonEmptyString(input.snapshotId) ||
    !isNonEmptyString(input.flowStopId) ||
    !isNonEmptyString(input.progressId) ||
    !isNonEmptyString(input.venueId)
  ) {
    throw new Error(
      'Trusted Replay attestation identity is incomplete.'
    )
  }

  if (
    !Number.isInteger(input.stopIndex) ||
    input.stopIndex < 0
  ) {
    throw new Error(
      'Trusted Replay attestation stop index is invalid.'
    )
  }

  if (
    !isNonEmptyString(input.verifiedAt) ||
    !Number.isFinite(Date.parse(input.verifiedAt))
  ) {
    throw new Error(
      'Trusted Replay attestation timestamp is invalid.'
    )
  }

  return {
    session_id: input.sessionId,
    replay_user_id: input.replayUserId,
    snapshot_id: input.snapshotId,
    flow_stop_id: input.flowStopId,
    progress_id: input.progressId,
    stop_index: input.stopIndex,
    venue_id: input.venueId,
    verified_at: input.verifiedAt,
  }
}

/**
 * Trusted Replay attestation persistence.
 *
 * This function is intended to be called only by the
 * fresh GPS-validated Active Flow check-in branch,
 * after both progress and venue-visit persistence succeed.
 *
 * It must never be invoked by:
 * - an existing-progress retry or legacy repair
 * - a public browser-facing RPC
 * - an administrative historical visit creation workflow
 *
 * The function checks database relationships before
 * inserting protected evidence.
 *
 * IMPORTANT:
 * Database consistency checks do not independently prove
 * physical GPS presence. The caller's fresh, successful
 * GPS verification is a required part of the trust boundary.
 *
 * Do not enable until the attestation migration and
 * downstream Replay attribution rules are coordinated.
 */
export async function persistTrustedReplayAttestation(
  input: TrustedReplayPersistenceInput
): Promise<void> {
  const payload = prepareTrustedReplayAttestation(input)

  if (!isNonEmptyString(input.venueVisitId)) {
    throw new Error(
      'Trusted Replay attestation venue-visit identity is incomplete.'
    )
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Trusted Replay attestation persistence configuration missing.'
    )
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  /**
   * Verify the Replay session is tied to the exact
   * authenticated explorer and canonical snapshot.
   */
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from('active_flow_sessions')
    .select('id, user_id, source, source_id')
    .eq('id', payload.session_id)
    .eq('user_id', payload.replay_user_id)
    .eq('source', 'flow_snapshot')
    .eq('source_id', payload.snapshot_id)
    .maybeSingle()

  if (sessionError || !session) {
    throw new Error(
      'Trusted Replay attestation session verification failed.'
    )
  }

  /**
   * Verify the exact immutable snapshot stop.
   * Snapshot venue IDs are UUIDs, while runtime
   * venue IDs are represented as text.
   */
  const {
    data: snapshotStop,
    error: snapshotStopError,
  } = await supabase
    .from('flow_snapshot_stops')
    .select('id, snapshot_id, stop_index, venue_id')
    .eq('snapshot_id', payload.snapshot_id)
    .eq('stop_index', payload.stop_index)
    .eq('venue_id', payload.venue_id)
    .maybeSingle()

  if (snapshotStopError || !snapshotStop) {
    throw new Error(
      'Trusted Replay attestation snapshot-stop verification failed.'
    )
  }

  /**
   * Verify the executable runtime stop belongs to
   * this Replay session and corresponds to the
   * original immutable snapshot stop position.
   */
  const {
    data: runtimeStop,
    error: runtimeStopError,
  } = await supabase
    .from('active_flow_stops')
    .select('id, session_id, venue_id, position')
    .eq('id', payload.flow_stop_id)
    .eq('session_id', payload.session_id)
    .eq('venue_id', payload.venue_id)
    .eq('position', payload.stop_index)
    .maybeSingle()

  if (runtimeStopError || !runtimeStop) {
    throw new Error(
      'Trusted Replay attestation runtime-stop verification failed.'
    )
  }

  /**
   * Verify progress is the exact successfully persisted
   * record associated with the same user, session,
   * canonical stop, venue and position.
   */
  const {
    data: progress,
    error: progressError,
  } = await supabase
    .from('active_flow_progress')
    .select(
      'id, session_id, user_id, flow_stop_id, venue_id, stop_index, checked_in_at, geo_verified'
    )
    .eq('id', payload.progress_id)
    .eq('session_id', payload.session_id)
    .eq('user_id', payload.replay_user_id)
    .eq('flow_stop_id', payload.flow_stop_id)
    .eq('venue_id', payload.venue_id)
    .eq('stop_index', payload.stop_index)
    .eq('geo_verified', true)
    .maybeSingle()

  if (progressError || !progress) {
    throw new Error(
      'Trusted Replay attestation progress verification failed.'
    )
  }

  if (
    new Date(progress.checked_in_at).getTime() !==
    new Date(payload.verified_at).getTime()
  ) {
    throw new Error(
      'Trusted Replay attestation timestamp does not match persisted progress.'
    )
  }

  /**
   * The caller must already have confirmed successful
   * venue-visit persistence. Recheck the exact visit
   * created by this fresh GPS-validated check-in.
   *
   * Do not assume progress.checked_in_at equals
   * venue_visits.visited_at.
   */
  const {
    data: venueVisit,
    error: venueVisitError,
  } = await supabase
    .from('venue_visits')
    .select(
      'id, user_id, venue_id, geo_verified, check_in_source'
    )
    .eq('id', input.venueVisitId)
    .eq('user_id', payload.replay_user_id)
    .eq('venue_id', payload.venue_id)
    .eq('check_in_source', 'active_flow')
    .eq('geo_verified', true)
    .maybeSingle()

  if (venueVisitError || !venueVisit) {
    throw new Error(
      'Trusted Replay attestation venue-visit verification failed.'
    )
  }

  /**
   * Insert only into the protected, service-role-writable
   * attestation table.
   *
   * Exact identity uniqueness is enforced by the migration.
   */

  const attestation = {
  ...payload,
  verified_at: progress.checked_in_at,
  snapshot_stop_id: snapshotStop.id,
  venue_visit_id: venueVisit.id,
}

  const { error: insertError } = await supabase
    .from('creator_replay_checkin_attestations')
    .insert(attestation)

  if (!insertError) {
    return
  }

  /**
   * An identical, previously certified event may already
   * exist after a network retry.
   *
   * Do not use UPSERT: changing certified evidence would
   * undermine the attestation's immutable identity.
   *
   * Only recognize PostgreSQL unique violations as
   * possible idempotent retries.
   */
  if (insertError.code !== '23505') {
    throw new Error(
      'Trusted Replay attestation persistence failed.'
    )
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from('creator_replay_checkin_attestations')
    .select(
      'id, session_id, replay_user_id, snapshot_id, snapshot_stop_id, flow_stop_id, progress_id, venue_visit_id, stop_index, venue_id, verified_at'
    )
    .eq('session_id', payload.session_id)
    .eq('stop_index', payload.stop_index)
    .maybeSingle()

  if (existingError || !existing) {
    throw new Error(
      'Trusted Replay attestation conflict could not be verified.'
    )
  }

  const sameAttestation =
    existing.session_id === payload.session_id &&
    existing.replay_user_id === payload.replay_user_id &&
    existing.snapshot_id === payload.snapshot_id &&
    existing.snapshot_stop_id === snapshotStop.id &&
    existing.flow_stop_id === payload.flow_stop_id &&
    existing.progress_id === payload.progress_id &&
    existing.venue_visit_id === input.venueVisitId &&
    existing.stop_index === payload.stop_index &&
    existing.venue_id === payload.venue_id &&
    typeof existing.verified_at === 'string' &&
    Date.parse(existing.verified_at) ===
      Date.parse(payload.verified_at)

  if (!sameAttestation) {
    throw new Error(
      'Trusted Replay attestation conflicts with existing evidence.'
    )
  }
}
