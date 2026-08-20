'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import {
  getRelayTeam,
} from '@/lib/relay/queries'
import type {
  ActiveFlowSessionId,
  RelayId,
  RelaySlotId,
  RelayTeam,
  RelayTeamId,
  RelayTeamSlotId,
  UserId,
  VenueId,
} from '@/lib/relay/types'


/* ============================================================
 * ACTION RESULT TYPES
 * ============================================================
 */

type RelayTeamMutationResult = {
  team: RelayTeam
}


type StartRelaySlotFlowResult = {
  team: RelayTeam

  sessionId:
    ActiveFlowSessionId
}


type CompleteRelaySlotResult = {
  team: RelayTeam

  completedTeamSlotId:
    RelayTeamSlotId
}


type FinalizeRelayTeamResult = {
  team: RelayTeam

  fullyCompleted:
    boolean
}


/* ============================================================
 * BULK SLOT ASSIGNMENT INPUT
 * ============================================================
 */

export type RelayTeamSlotAssignmentInput = {
  slotId:
    RelaySlotId

  userId:
    UserId
}


/* ============================================================
 * INTERNAL TYPES
 * ============================================================
 */

type ActiveFlowSessionLookupRow = {
  id: string
  user_id: string
  source: string
  source_id: string | null
  status: string
}


/* ============================================================
 * INPUT NORMALIZATION
 * ============================================================
 */

function normalizeRequiredValue(
  value: string,
  label: string
): string {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      `[relay/actions] ${label} is required.`
    )
  }

  return normalized
}


/* ============================================================
 * ERROR HANDLING
 * ============================================================
 */

function throwIfMutationFailed(
  actionName: string,
  error: {
    message?: string
    code?: string
    details?: string
    hint?: string
  } | null
): void {
  if (!error) {
    return
  }

  const details = [
    error.message,

    error.code
      ? `code=${error.code}`
      : null,

    error.details
      ? `details=${error.details}`
      : null,

    error.hint
      ? `hint=${error.hint}`
      : null,
  ]
    .filter(Boolean)
    .join(' | ')

  throw new Error(
    `[relay/actions] ${actionName} failed: ${details}`
  )
}


/* ============================================================
 * AUTHENTICATION
 * ============================================================
 */

async function getAuthenticatedRelayClient() {
  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !user
  ) {
    throw new Error(
      '[relay/actions] Authentication required.'
    )
  }

  return {
    supabase,
    userId:
      user.id as UserId,
  }
}


/* ============================================================
 * CANONICAL READ-BACK
 * ============================================================
 *
 * Mutation RPC responses are deliberately not treated as the
 * source of UI state.
 *
 * After mutation, reload the canonical team from the database.
 * ============================================================
 */

async function requireRelayTeam(
  teamId: RelayTeamId
): Promise<RelayTeam> {
  const team =
    await getRelayTeam(
      teamId
    )

  if (!team) {
    throw new Error(
      `[relay/actions] Relay team ${teamId} was not found after mutation.`
    )
  }

  return team
}


/* ============================================================
 * TEAM ACCESS FOR SERVICE-ROLE RECONCILIATION
 * ============================================================
 *
 * finalize/reconcile RPCs are intentionally service-role only.
 *
 * Before invoking them with the admin client, prove that the
 * authenticated caller is a canonical joined team participant.
 * ============================================================
 */

async function requireJoinedTeamAccess(
  teamId: RelayTeamId,
  userId: UserId
): Promise<RelayTeam> {
  const team =
    await requireRelayTeam(
      teamId
    )

  const member =
    team.members.find(
      (candidate) =>
        candidate.userId ===
          userId &&
        candidate.memberStatus ===
          'joined'
    )

  if (!member) {
    throw new Error(
      '[relay/actions] You are not an active member of this Relay team.'
    )
  }

  return team
}


/* ============================================================
 * TEAM SLOT LOOKUP
 * ============================================================
 */

async function getTeamIdForTeamSlot(
  teamSlotId: RelayTeamSlotId
): Promise<RelayTeamId> {
  const admin =
    getSupabaseAdmin()

  const result =
    await admin
      .from(
        'roam_relay_team_slots'
      )
      .select(
        'team_id'
      )
      .eq(
        'id',
        teamSlotId
      )
      .maybeSingle()

  throwIfMutationFailed(
    'Relay team-slot lookup',
    result.error
  )

  if (
    !result.data?.team_id
  ) {
    throw new Error(
      `[relay/actions] Relay team slot ${teamSlotId} was not found.`
    )
  }

  return result.data
    .team_id
}


/* ============================================================
 * CREATE RELAY DEFINITION
 * ============================================================
 *
 * RPC:
 *
 *   create_roam_relay_definition(...)
 *
 * Database owns:
 *
 *   - authenticated Venue Admin authorization
 *   - Relay definition validation
 *   - Relay lifecycle defaults
 *   - Relay competition creation
 *   - execution_event participation mode
 *   - competition reward policy
 *   - atomic roam_relays + competitions creation
 *
 * Relay route slots are deliberately authored separately after
 * the canonical Relay definition has been created.
 * ============================================================
 */

export async function createRelayDefinition(
  input: {
    title: string
    description: string | null

    city: string | null
    theme: string | null

    startsAt: string | null
    endsAt: string | null

    minTeamSize: number
    maxTeamSize: number

    visibility: 'public'

    rewardMode:
      | 'per_member'
      | 'team_pool'

    xpReward: number
  }
): Promise<{
  relayId: RelayId
}> {
  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  /*
   * The RPC was added after the current generated Supabase type
   * snapshot. Keep this narrow compatibility cast at the RPC
   * boundary until types are regenerated.
   */
  const result =
    await (
      supabase.rpc as any
    )(
      'create_roam_relay_definition',
      {
        p_title:
          input.title,

        p_description:
          input.description,

        p_city:
          input.city,

        p_theme:
          input.theme,

        p_starts_at:
          input.startsAt,

        p_ends_at:
          input.endsAt,

        p_min_team_size:
          input.minTeamSize,

        p_max_team_size:
          input.maxTeamSize,

        p_visibility:
          input.visibility,

        p_reward_mode:
          input.rewardMode,

        p_xp_reward:
          input.xpReward,
      }
    )

  throwIfMutationFailed(
    'create_roam_relay_definition',
    result.error
  )

  const relayId =
    typeof result.data ===
      'string'
      ? result.data.trim()
      : ''

  if (!relayId) {
    throw new Error(
      '[relay/actions] Relay definition creation succeeded but no Relay ID was returned.'
    )
  }

  return {
    relayId:
      relayId as RelayId,
  }
}


/* ============================================================
 * SAVE RELAY TEMPLATE
 * ============================================================
 *
 * RPC:
 *
 *   save_roam_relay_template(
 *     relay_id,
 *     slots jsonb
 *   )
 *
 * Database owns:
 *
 *   - authenticated Venue Admin authorization
 *   - draft-only structural mutation
 *   - 3–5 leg invariant
 *   - canonical contiguous ordering
 *   - per-leg validation
 *   - selection-mode payload validation
 *   - canonical venue validation
 *   - required geo verification
 *   - atomic replacement of the complete route template
 *
 * This action deliberately submits the entire ordered template
 * through one RPC rather than mutating Relay slots individually.
 * ============================================================
 */

export async function saveRelayTemplate(
  relayId: RelayId,
  slots: Array<{
    id:
      RelaySlotId | null

    slotIndex:
      number

    label:
      string

    prompt:
      string

    selectionMode:
      | 'open'
      | 'category'
      | 'venue_pool'
      | 'exact_venue'

    categoryConstraint:
      string

    exactVenueId:
      VenueId | null

    eligibleVenueIds:
      VenueId[]

    requiredGeoVerified:
      true
  }>
): Promise<{
  relayId: RelayId
}> {
  const normalizedRelayId =
    normalizeRequiredValue(
      relayId,
      'relayId'
    )

  if (
    !Array.isArray(
      slots
    )
  ) {
    throw new Error(
      '[relay/actions] Relay template slots must be an array.'
    )
  }

  const normalizedSlots =
    slots.map(
      (
        slot,
        index
      ) => {
        if (
          !slot ||
          typeof slot !==
            'object'
        ) {
          throw new Error(
            `[relay/actions] Relay template slot ${index + 1} is invalid.`
          )
        }

        return {
          id:
            slot.id,

          slotIndex:
            slot.slotIndex,

          label:
            slot.label,

          prompt:
            slot.prompt,

          selectionMode:
            slot.selectionMode,

          categoryConstraint:
            slot.categoryConstraint,

          exactVenueId:
            slot.exactVenueId,

          eligibleVenueIds:
            slot.eligibleVenueIds,

          requiredGeoVerified:
            slot.requiredGeoVerified,
        }
      }
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  /*
   * The RPC was added after the current generated Supabase type
   * snapshot. Keep this narrow compatibility cast at the RPC
   * boundary until types are regenerated.
   */
  const result =
    await (
      supabase.rpc as any
    )(
      'save_roam_relay_template',
      {
        p_relay_id:
          normalizedRelayId,

        p_slots:
          normalizedSlots,
      }
    )

  throwIfMutationFailed(
    'save_roam_relay_template',
    result.error
  )

  return {
    relayId:
      normalizedRelayId as RelayId,
  }
}


/* ============================================================
 * UPDATE RELAY DEFINITION
 * ============================================================
 */

export async function updateRelayDefinition(
  relayId: RelayId,
  input: {
    title: string
    description: string | null

    city: string | null
    theme: string | null

    startsAt: string | null
    endsAt: string | null

    minTeamSize: number
    maxTeamSize: number

    visibility: 'public'

    rewardMode:
      | 'per_member'
      | 'team_pool'

    xpReward: number
  }
): Promise<{
  relayId: RelayId
}> {
  const normalizedRelayId =
    normalizeRequiredValue(
      relayId,
      'relayId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  /*
   * The RPC was added after the current generated Supabase type
   * snapshot. Keep this narrow compatibility cast at the RPC
   * boundary until types are regenerated.
   */
  const result =
    await (
      supabase.rpc as any
    )(
      'update_roam_relay_definition',
      {
        p_relay_id:
          normalizedRelayId,

        p_title:
          input.title,

        p_description:
          input.description,

        p_city:
          input.city,

        p_theme:
          input.theme,

        p_starts_at:
          input.startsAt,

        p_ends_at:
          input.endsAt,

        p_min_team_size:
          input.minTeamSize,

        p_max_team_size:
          input.maxTeamSize,

        p_visibility:
          input.visibility,

        p_reward_mode:
          input.rewardMode,

        p_xp_reward:
          input.xpReward,
      }
    )

  throwIfMutationFailed(
    'update_roam_relay_definition',
    result.error
  )

  return {
    relayId:
      normalizedRelayId as RelayId,
  }
}


/* ============================================================
 * PUBLISH RELAY
 * ============================================================
 *
 * RPC:
 *
 *   publish_roam_relay(uuid)
 *
 * Database owns:
 *
 *   - authenticated Venue Admin authorization
 *   - draft-only publication
 *   - route-template readiness
 *   - geo-verification readiness
 *   - Relay / competition lifecycle synchronization
 *   - scheduled vs live target-state selection
 *   - atomic roam_relays + competitions transition
 * ============================================================
 */

export async function publishRelay(
  relayId: RelayId
): Promise<{
  relayId: RelayId
}> {
  const normalizedRelayId =
    normalizeRequiredValue(
      relayId,
      'relayId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  /*
   * The RPC was added after the current generated Supabase type
   * snapshot. Keep this narrow compatibility cast at the RPC
   * boundary until types are regenerated.
   */
  const result =
    await (
      supabase.rpc as any
    )(
      'publish_roam_relay',
      {
        p_relay_id:
          normalizedRelayId,
      }
    )

  throwIfMutationFailed(
    'publish_roam_relay',
    result.error
  )

  return {
    relayId:
      normalizedRelayId as RelayId,
  }
}


/* ============================================================
 * CREATE TEAM
 * ============================================================
 *
 * RPC:
 *
 *   create_roam_relay_team(uuid)
 *
 * Database owns:
 *
 *   - captain identity
 *   - one-open-team invariants
 *   - captain joined membership
 *   - team-slot materialization
 * ============================================================
 */

export async function createRelayTeam(
  relayId: RelayId
): Promise<RelayTeamMutationResult> {
  const normalizedRelayId =
    normalizeRequiredValue(
      relayId,
      'relayId'
    )

  const {
    supabase,
    userId,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'create_roam_relay_team',
      {
        p_relay_id:
          normalizedRelayId,
      }
    )

  throwIfMutationFailed(
    'create_roam_relay_team',
    result.error
  )

  /*
   * Resolve the canonical open team rather than trusting RPC
   * return payload shape.
   */
  const admin =
    getSupabaseAdmin()

  const teamResult =
    await admin
      .from(
        'roam_relay_teams'
      )
      .select('id')
      .eq(
        'relay_id',
        normalizedRelayId
      )
      .eq(
        'captain_user_id',
        userId
      )
      .in(
        'status',
        [
          'forming',
          'ready',
          'active',
        ]
      )
      .order(
        'created_at',
        {
          ascending:
            true,
        }
      )
      .limit(1)
      .maybeSingle()

  throwIfMutationFailed(
    'created Relay team lookup',
    teamResult.error
  )

  if (
    !teamResult.data?.id
  ) {
    throw new Error(
      '[relay/actions] Team creation succeeded but no canonical open team could be resolved.'
    )
  }

  return {
    team:
      await requireRelayTeam(
        teamResult.data.id
      ),
  }
}


/* ============================================================
 * INVITE TEAM MEMBER
 * ============================================================
 *
 * RPC:
 *
 *   invite_roam_relay_team_member(uuid, uuid)
 *
 * Captain authorization and forming-state checks live in DB.
 * ============================================================
 */

export async function inviteRelayTeamMember(
  teamId: RelayTeamId,
  invitedUserId: UserId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const normalizedInvitedUserId =
    normalizeRequiredValue(
      invitedUserId,
      'invitedUserId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'invite_roam_relay_team_member',
      {
        p_team_id:
          normalizedTeamId,

        p_user_id:
          normalizedInvitedUserId,
      }
    )

  throwIfMutationFailed(
    'invite_roam_relay_team_member',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * ACCEPT INVITATION / JOIN TEAM
 * ============================================================
 *
 * RPC:
 *
 *   join_roam_relay_team(uuid)
 *
 * Caller identity comes exclusively from auth.uid().
 * ============================================================
 */

export async function joinRelayTeam(
  teamId: RelayTeamId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'join_roam_relay_team',
      {
        p_team_id:
          normalizedTeamId,
      }
    )

  throwIfMutationFailed(
    'join_roam_relay_team',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * DECLINE INVITATION
 * ============================================================
 */

export async function declineRelayTeamInvitation(
  teamId: RelayTeamId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'decline_roam_relay_team_invitation',
      {
        p_team_id:
          normalizedTeamId,
      }
    )

  throwIfMutationFailed(
    'decline_roam_relay_team_invitation',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * REMOVE TEAM MEMBER
 * ============================================================
 *
 * RPC:
 *
 *   remove_roam_relay_team_member(
 *     team_id,
 *     user_id
 *   )
 *
 * Database owns:
 *
 *   - authenticated captain authorization
 *   - forming-only mutation
 *   - target membership validation
 *   - invited/joined-only removal
 *   - captain cannot remove themselves
 *   - assigned-slot cleanup in the same transaction
 *   - member_status -> removed
 *
 * This wrapper does not directly mutate membership or slot rows.
 * ============================================================
 */

export async function removeRelayTeamMember(
  teamId: RelayTeamId,
  userId: UserId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const normalizedUserId =
    normalizeRequiredValue(
      userId,
      'userId'
    )

  const {
    supabase,
    userId:
      authenticatedUserId,
  } =
    await getAuthenticatedRelayClient()


  /*
   * Reject self-removal early as a defensive API/action boundary.
   *
   * The database RPC must still independently enforce this rule.
   */
  if (
    normalizedUserId ===
    authenticatedUserId
  ) {
    throw new Error(
      '[relay/actions] A Relay captain cannot remove themselves through the member-removal operation.'
    )
  }


  const result =
    await supabase.rpc(
      'remove_roam_relay_team_member',
      {
        p_team_id:
          normalizedTeamId,

        p_user_id:
          normalizedUserId,
      }
    )


  throwIfMutationFailed(
    'remove_roam_relay_team_member',
    result.error
  )


  /*
   * Reload canonical state rather than trusting the RPC return
   * payload.
   */
  const team =
    await requireRelayTeam(
      normalizedTeamId
    )


  const removedMember =
    team.members.find(
      (
        member
      ) =>
        member.userId ===
        normalizedUserId
    ) ??
    null


  if (
    !removedMember
  ) {
    throw new Error(
      '[relay/actions] Relay member removal succeeded but the canonical membership record could not be resolved.'
    )
  }


  if (
    removedMember.memberStatus !==
      'removed'
  ) {
    throw new Error(
      '[relay/actions] Relay member removal RPC returned successfully but canonical membership state is not removed.'
    )
  }


  /*
   * Assignment cleanup is part of the same database transaction.
   *
   * Verify the canonical team projection contains no remaining
   * slot owned by the removed contributor.
   */
  const lingeringAssignment =
    team.slots.find(
      (
        slot
      ) =>
        slot.assignedUserId ===
        normalizedUserId
    ) ??
    null


  if (
    lingeringAssignment
  ) {
    throw new Error(
      `[relay/actions] Removed Relay member still owns team slot ${lingeringAssignment.id}.`
    )
  }


  return {
    team,
  }
}


/* ============================================================
 * ASSIGN TEAM SLOT
 * ============================================================
 *
 * RPC:
 *
 *   assign_roam_relay_team_slot(
 *     team_id,
 *     relay_slot_id,
 *     user_id
 *   )
 *
 * Database owns:
 *
 *   - captain-only mutation
 *   - forming-only mutation
 *   - joined-member requirement
 *   - one contributor per slot
 *   - one slot per contributor
 * ============================================================
 */

export async function assignRelayTeamSlot(
  teamId: RelayTeamId,
  relaySlotId: RelaySlotId,
  userId: UserId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const normalizedRelaySlotId =
    normalizeRequiredValue(
      relaySlotId,
      'relaySlotId'
    )

  const normalizedUserId =
    normalizeRequiredValue(
      userId,
      'userId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'assign_roam_relay_team_slot',
      {
        p_team_id:
          normalizedTeamId,

        p_relay_slot_id:
          normalizedRelaySlotId,

        p_user_id:
          normalizedUserId,
      }
    )

  throwIfMutationFailed(
    'assign_roam_relay_team_slot',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * ASSIGN TEAM SLOTS ATOMICALLY
 * ============================================================
 *
 * RPC:
 *
 *   assign_roam_relay_team_slots(
 *     team_id,
 *     assignments jsonb
 *   )
 *
 * This is the canonical full-roster assignment mutation.
 *
 * Database owns:
 *
 *   - captain-only authorization
 *   - forming-only mutation
 *   - exact team-slot ownership
 *   - joined-member requirement
 *   - complete slot coverage
 *   - complete joined-roster coverage
 *   - one user per slot
 *   - one slot per joined member
 *   - duplicate slot rejection
 *   - duplicate user rejection
 *   - atomic assignment update
 *
 * slotId refers to roam_relay_team_slots.relay_slot_id.
 * ============================================================
 */

export async function assignRelayTeamSlots(
  teamId: RelayTeamId,
  assignments: RelayTeamSlotAssignmentInput[]
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )


  if (
    !Array.isArray(
      assignments
    ) ||
    assignments.length ===
      0
  ) {
    throw new Error(
      '[relay/actions] assignments must contain at least one Relay slot assignment.'
    )
  }


  const normalizedAssignments =
    assignments.map(
      (
        assignment,
        index
      ) => {
        if (
          !assignment ||
          typeof assignment !==
            'object'
        ) {
          throw new Error(
            `[relay/actions] assignments[${index}] is invalid.`
          )
        }


        return {
          slotId:
            normalizeRequiredValue(
              assignment.slotId,
              `assignments[${index}].slotId`
            ),

          userId:
            normalizeRequiredValue(
              assignment.userId,
              `assignments[${index}].userId`
            ),
        }
      }
    )


  /*
   * Defensive payload-level duplicate detection.
   *
   * The database independently enforces both invariants inside
   * the canonical transaction.
   */
  const slotIds =
    normalizedAssignments.map(
      (
        assignment
      ) =>
        assignment.slotId
    )


  if (
    new Set(
      slotIds
    ).size !==
    slotIds.length
  ) {
    throw new Error(
      '[relay/actions] Each Relay slot may appear only once in assignments.'
    )
  }


  const userIds =
    normalizedAssignments.map(
      (
        assignment
      ) =>
        assignment.userId
    )


  if (
    new Set(
      userIds
    ).size !==
    userIds.length
  ) {
    throw new Error(
      '[relay/actions] Each Relay team member may appear only once in assignments.'
    )
  }


  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()


  /*
   * One RPC invocation is critical here.
   *
   * Do not replace this with a loop over assignRelayTeamSlot().
   * The entire roster mapping must succeed or fail as one
   * database transaction.
   */
  const result =
    await supabase.rpc(
      'assign_roam_relay_team_slots',
      {
        p_team_id:
          normalizedTeamId,

        p_assignments:
          normalizedAssignments,
      }
    )


  throwIfMutationFailed(
    'assign_roam_relay_team_slots',
    result.error
  )


  /*
   * Mutation RPC payloads are not canonical UI state.
   *
   * Reload the entire team after the atomic mutation.
   */
  const team =
    await requireRelayTeam(
      normalizedTeamId
    )


  /*
   * The bulk RPC represents a complete roster assignment.
   *
   * Verify every requested Relay slot resolves to the requested
   * joined contributor in canonical team state.
   */
  for (
    const assignment
    of normalizedAssignments
  ) {
    const teamSlot =
      team.slots.find(
        (
          slot
        ) =>
          slot.relaySlotId ===
          assignment.slotId
      ) ??
      null


    if (!teamSlot) {
      throw new Error(
        `[relay/actions] Atomic Relay roster assignment succeeded but Relay slot ${assignment.slotId} could not be resolved from canonical team state.`
      )
    }


    if (
      teamSlot.assignedUserId !==
      assignment.userId
    ) {
      throw new Error(
        `[relay/actions] Atomic Relay roster assignment succeeded but canonical assignment for Relay slot ${assignment.slotId} is inconsistent.`
      )
    }
  }


  /*
   * Because the RPC contract requires complete slot coverage,
   * canonical slot cardinality must equal request cardinality.
   */
  if (
    team.slots.length !==
    normalizedAssignments.length
  ) {
    throw new Error(
      '[relay/actions] Atomic Relay roster assignment succeeded but canonical slot cardinality does not match the submitted roster.'
    )
  }


  /*
   * Confirm every canonical slot is assigned and that canonical
   * contributor assignments remain one-to-one.
   */
  const canonicalAssignedUserIds =
    team.slots.map(
      (
        slot
      ) =>
        slot.assignedUserId
    )


  if (
    canonicalAssignedUserIds.some(
      (
        userId
      ) =>
        !userId
    )
  ) {
    throw new Error(
      '[relay/actions] Atomic Relay roster assignment succeeded but one or more canonical team slots remain unassigned.'
    )
  }


  if (
    new Set(
      canonicalAssignedUserIds
    ).size !==
    canonicalAssignedUserIds.length
  ) {
    throw new Error(
      '[relay/actions] Atomic Relay roster assignment succeeded but canonical contributors are not assigned one-to-one.'
    )
  }


  /*
   * Every canonical assignee must still be a joined member.
   */
  const joinedUserIds =
    new Set(
      team.members
        .filter(
          (
            member
          ) =>
            member.memberStatus ===
            'joined'
        )
        .map(
          (
            member
          ) =>
            member.userId
        )
    )


  if (
    canonicalAssignedUserIds.some(
      (
        userId
      ) =>
        !userId ||
        !joinedUserIds.has(
          userId
        )
    )
  ) {
    throw new Error(
      '[relay/actions] Atomic Relay roster assignment succeeded but canonical assignment contains a non-joined contributor.'
    )
  }


  return {
    team,
  }
}


/* ============================================================
 * MARK TEAM READY
 * ============================================================
 *
 * RPC:
 *
 *   set_roam_relay_team_ready(uuid)
 *
 * Readiness is revalidated transactionally by the database.
 * UI readiness calculations are presentation-only.
 * ============================================================
 */

export async function setRelayTeamReady(
  teamId: RelayTeamId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'set_roam_relay_team_ready',
      {
        p_team_id:
          normalizedTeamId,
      }
    )

  throwIfMutationFailed(
    'set_roam_relay_team_ready',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * START TEAM
 * ============================================================
 *
 * EXISTING RPC:
 *
 *   start_roam_relay_team(uuid)
 *
 * Database owns:
 *
 *   ready -> active
 *   first baton activation
 *   Relay live/window validation
 * ============================================================
 */

export async function startRelayTeam(
  teamId: RelayTeamId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const result =
    await supabase.rpc(
      'start_roam_relay_team',
      {
        p_team_id:
          normalizedTeamId,
      }
    )

  throwIfMutationFailed(
    'start_roam_relay_team',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * START ACTIVE RELAY LEG FLOW
 * ============================================================
 *
 * EXISTING RPC:
 *
 *   start_roam_relay_slot_flow(
 *     team_slot_id,
 *     venue_id
 *   )
 *
 * The resulting session remains a standard Active Flow:
 *
 *   source    = roam_relay_team_slot
 *   source_id = team_slot.id
 *
 * No parallel Relay execution system is created here.
 * ============================================================
 */

export async function startRelaySlotFlow(
  teamSlotId: RelayTeamSlotId,
  venueId: VenueId
): Promise<StartRelaySlotFlowResult> {
  const normalizedTeamSlotId =
    normalizeRequiredValue(
      teamSlotId,
      'teamSlotId'
    )

  const normalizedVenueId =
    normalizeRequiredValue(
      venueId,
      'venueId'
    )

  const {
    supabase,
    userId,
  } =
    await getAuthenticatedRelayClient()

  const teamId =
    await getTeamIdForTeamSlot(
      normalizedTeamSlotId
    )

  const result =
    await supabase.rpc(
      'start_roam_relay_slot_flow',
      {
        p_team_slot_id:
          normalizedTeamSlotId,

        p_venue_id:
          normalizedVenueId,
      }
    )

  throwIfMutationFailed(
    'start_roam_relay_slot_flow',
    result.error
  )

  /*
   * Read the canonical Active Flow back from its Relay
   * provenance instead of relying on the RPC payload shape.
   *
   * The database already owns the uniqueness boundary for:
   *
   *   source = roam_relay_team_slot
   *   source_id = team_slot.id
   */
  const sessionResult =
    await supabase
      .from(
        'active_flow_sessions'
      )
      .select(`
        id,
        user_id,
        source,
        source_id,
        status
      `)
      .eq(
        'user_id',
        userId
      )
      .eq(
        'source',
        'roam_relay_team_slot'
      )
      .eq(
        'source_id',
        normalizedTeamSlotId
      )
      .maybeSingle()

  throwIfMutationFailed(
    'Relay Active Flow lookup',
    sessionResult.error
  )

  if (!sessionResult.data) {
    throw new Error(
      '[relay/actions] Relay slot Flow start succeeded but no canonical Active Flow session could be resolved.'
    )
  }

  const session =
    sessionResult.data as
      ActiveFlowSessionLookupRow

  if (
    session.source !==
      'roam_relay_team_slot' ||
    session.source_id !==
      normalizedTeamSlotId ||
    session.user_id !==
      userId
  ) {
    throw new Error(
      '[relay/actions] Canonical Relay Active Flow provenance is inconsistent.'
    )
  }

  return {
    team:
      await requireRelayTeam(
        teamId
      ),

    sessionId:
      session.id,
  }
}


/* ============================================================
 * COMPLETE RELAY SLOT
 * ============================================================
 *
 * EXISTING RPC:
 *
 *   complete_roam_relay_slot(
 *     team_slot_id,
 *     venue_id,
 *     flow_session_id
 *   )
 *
 * Database owns:
 *
 *   - assigned-user authorization
 *   - active-baton requirement
 *   - venue constraints
 *   - canonical Active Flow provenance
 *   - geo verification
 *   - completion evidence
 *   - next baton activation
 *   - final team completion
 *   - idempotency
 * ============================================================
 */

export async function completeRelaySlot(
  teamSlotId: RelayTeamSlotId,
  venueId: VenueId,
  flowSessionId: ActiveFlowSessionId
): Promise<CompleteRelaySlotResult> {
  const normalizedTeamSlotId =
    normalizeRequiredValue(
      teamSlotId,
      'teamSlotId'
    )

  const normalizedVenueId =
    normalizeRequiredValue(
      venueId,
      'venueId'
    )

  const normalizedFlowSessionId =
    normalizeRequiredValue(
      flowSessionId,
      'flowSessionId'
    )

  const {
    supabase,
  } =
    await getAuthenticatedRelayClient()

  const teamId =
    await getTeamIdForTeamSlot(
      normalizedTeamSlotId
    )

  const result =
    await supabase.rpc(
      'complete_roam_relay_slot',
      {
        p_team_slot_id:
          normalizedTeamSlotId,

        p_venue_id:
          normalizedVenueId,

        p_flow_session_id:
          normalizedFlowSessionId,
      }
    )

  throwIfMutationFailed(
    'complete_roam_relay_slot',
    result.error
  )

  const team =
    await requireRelayTeam(
      teamId
    )

  const completedSlot =
    team.slots.find(
      (slot) =>
        slot.id ===
        normalizedTeamSlotId
    )

  if (!completedSlot) {
    throw new Error(
      '[relay/actions] Completed Relay team slot could not be resolved after mutation.'
    )
  }

  if (
    completedSlot.status !==
    'completed'
  ) {
    throw new Error(
      '[relay/actions] Relay completion RPC returned successfully but canonical team-slot state is not completed.'
    )
  }

  return {
    team,

    completedTeamSlotId:
      completedSlot.id,
  }
}


/* ============================================================
 * RECONCILE TEAM
 * ============================================================
 *
 * SERVICE-ROLE RPC:
 *
 *   reconcile_roam_relay_team(uuid)
 *
 * This is not an alternate completion API.
 *
 * It repairs derived Relay state only from trusted canonical
 * Active Flow evidence.
 *
 * Because the RPC is service-role-only, this wrapper first
 * authenticates the caller and proves joined-team access before
 * invoking the admin client.
 * ============================================================
 */

export async function reconcileRelayTeam(
  teamId: RelayTeamId
): Promise<RelayTeamMutationResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const {
    userId,
  } =
    await getAuthenticatedRelayClient()

  await requireJoinedTeamAccess(
    normalizedTeamId,
    userId
  )

  const admin =
    getSupabaseAdmin()

  const result =
    await admin.rpc(
      'reconcile_roam_relay_team',
      {
        p_team_id:
          normalizedTeamId,
      }
    )

  throwIfMutationFailed(
    'reconcile_roam_relay_team',
    result.error
  )

  return {
    team:
      await requireRelayTeam(
        normalizedTeamId
      ),
  }
}


/* ============================================================
 * FINALIZE TEAM
 * ============================================================
 *
 * SERVICE-ROLE RPC:
 *
 *   finalize_roam_relay_team(uuid)
 *
 * This wrapper does NOT force a team complete.
 *
 * The RPC delegates to canonical reconciliation and only reaches
 * completed state when trusted evidence proves every leg.
 * ============================================================
 */

export async function finalizeRelayTeam(
  teamId: RelayTeamId
): Promise<FinalizeRelayTeamResult> {
  const normalizedTeamId =
    normalizeRequiredValue(
      teamId,
      'teamId'
    )

  const {
    userId,
  } =
    await getAuthenticatedRelayClient()

  await requireJoinedTeamAccess(
    normalizedTeamId,
    userId
  )

  const admin =
    getSupabaseAdmin()

  const result =
    await admin.rpc(
      'finalize_roam_relay_team',
      {
        p_team_id:
          normalizedTeamId,
      }
    )

  throwIfMutationFailed(
    'finalize_roam_relay_team',
    result.error
  )

  const team =
    await requireRelayTeam(
      normalizedTeamId
    )

  const fullyCompleted =
    (
      team.status ===
        'completed' &&
      team.slots.length >
        0 &&
      team.slots.every(
        (slot) =>
          slot.status ===
          'completed'
      )
    )

  return {
    team,
    fullyCompleted,
  }
}