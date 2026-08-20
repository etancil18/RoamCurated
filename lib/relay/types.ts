// lib/relay/types.ts

/**
 * Shared Roam Relay domain types.
 *
 * Rules:
 *
 * - `*Row` types represent database-shaped records.
 * - UI/domain models use camelCase.
 * - This file contains no Supabase calls.
 * - This file contains no state-transition logic.
 * - This file contains no XP calculations.
 * - Database state remains authoritative.
 */


/* ============================================================
 * PRIMITIVES
 * ============================================================
 */

export type RelayId = string
export type RelaySlotId = string
export type RelayTeamId = string
export type RelayTeamMemberId = string
export type RelayTeamSlotId = string
export type RelayArtifactId = string
export type RelayArtifactSlotId = string
export type FlowSnapshotId = string
export type ActiveFlowSessionId = string
export type UserId = string
export type VenueId = string
export type CompetitionId = string
export type CompetitionRelayEntryId = string
export type PartnerCampaignId = string


/* ============================================================
 * RELAY STATE
 * ============================================================
 */

export type RelayStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'cancelled'

export type RelayExecutionMode =
  'sequential'

export type RelaySlotSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'

export type RelayTeamStatus =
  | 'forming'
  | 'ready'
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'disqualified'

export type RelayMemberStatus =
  | 'invited'
  | 'joined'
  | 'declined'
  | 'left'
  | 'removed'

export type RelayTeamSlotStatus =
  | 'locked'
  | 'active'
  | 'completed'
  | 'skipped'

export type RelayRewardMode =
  | 'per_member'
  | 'team_pool'


/* ============================================================
 * DATABASE ROW TYPES
 * ============================================================
 *
 * These intentionally retain database snake_case naming.
 *
 * They exist to keep database-shaped values visibly separate
 * from UI/domain models.
 * ============================================================
 */

export type RoamRelayRow = {
  id: RelayId

  title: string
  description: string | null

  city: string | null
  theme: string | null

  status: RelayStatus
  execution_mode: RelayExecutionMode

  min_team_size: number
  max_team_size: number

  starts_at: string | null
  ends_at: string | null

  partner_campaign_id:
    | PartnerCampaignId
    | null

  created_by: UserId

  created_at: string
  updated_at: string
}


export type RoamRelaySlotRow = {
  id: RelaySlotId
  relay_id: RelayId

  slot_index: number

  label: string
  prompt: string | null

  selection_mode:
    RelaySlotSelectionMode

  category_constraint:
    string | null

  exact_venue_id:
    VenueId | null

  eligible_venue_ids:
    VenueId[]

  required_geo_verified:
    boolean

  created_at: string
  updated_at: string
}


export type RoamRelayTeamRow = {
  id: RelayTeamId
  relay_id: RelayId

  captain_user_id:
    UserId

  status:
    RelayTeamStatus

  opted_in_at:
    string | null

  started_at:
    string | null

  completed_at:
    string | null

  created_at: string
  updated_at: string
}


export type RoamRelayTeamMemberRow = {
  id: RelayTeamMemberId
  team_id: RelayTeamId
  user_id: UserId

  member_status:
    RelayMemberStatus

  joined_at:
    string | null

  left_at:
    string | null

  created_at: string
  updated_at: string
}


export type RoamRelayTeamSlotRow = {
  id: RelayTeamSlotId
  team_id: RelayTeamId
  relay_slot_id: RelaySlotId

  slot_index: number

  assigned_user_id:
    UserId | null

  status:
    RelayTeamSlotStatus

  venue_id:
    VenueId | null

  flow_session_id:
    ActiveFlowSessionId | null

  checked_in_at:
    string | null

  completed_at:
    string | null

  geo_verified:
    boolean

  created_at: string
  updated_at: string
}


export type RoamRelayArtifactRow = {
  id: RelayArtifactId

  relay_id: RelayId
  team_id: RelayTeamId

  title: string
  city: string | null
  theme: string | null

  venue_ids:
    VenueId[]

  contributor_user_ids:
    UserId[]

  public_flow_snapshot_id:
    FlowSnapshotId | null

  completed_at:
    string

  created_at:
    string
}


export type RoamRelayArtifactSlotRow = {
  id: RelayArtifactSlotId

  artifact_id:
    RelayArtifactId

  relay_slot_id:
    RelaySlotId

  team_slot_id:
    RelayTeamSlotId

  slot_index:
    number

  contributor_user_id:
    UserId

  venue_id:
    VenueId

  flow_session_id:
    ActiveFlowSessionId

  checked_in_at:
    string

  completed_at:
    string

  created_at:
    string
}


/**
 * Relay-specific competition reward fields currently owned by
 * the competition row.
 *
 * This deliberately does not attempt to model the entire
 * competitions table.
 */
export type RelayCompetitionRewardRow = {
  id: CompetitionId

  competition_type:
    'roam_relay'

  xp_reward:
    number

  relay_reward_mode:
    RelayRewardMode

  relay_winner_entry_id:
    CompetitionRelayEntryId | null
}


/* ============================================================
 * BASIC PUBLIC ENTITY REFERENCES
 * ============================================================
 *
 * Relay UI should not require entire venue/profile database
 * records merely to render a card.
 * ============================================================
 */

export type RelayVenueSummary = {
  id: VenueId
  name: string

  category?: string | null

  neighborhood?: string | null
  city?: string | null

  imageUrl?: string | null
}


export type RelayUserSummary = {
  id: UserId

  displayName:
    string | null

  avatarUrl:
    string | null
}


/* ============================================================
 * RELAY SLOT TEMPLATE — UI MODEL
 * ============================================================
 */

export type RelaySlotTemplate = {
  id: RelaySlotId
  relayId: RelayId

  slotIndex: number

  label: string
  prompt: string | null

  selectionMode:
    RelaySlotSelectionMode

  categoryConstraint:
    string | null

  exactVenueId:
    VenueId | null

  eligibleVenueIds:
    VenueId[]

  requiredGeoVerified:
    boolean

  /**
   * Optional resolved display data.
   *
   * Query layers may provide these so presentation components
   * do not need to perform their own venue lookups.
   */
  exactVenue?:
    RelayVenueSummary | null

  eligibleVenues?:
    RelayVenueSummary[]

  createdAt: string
  updatedAt: string
}


/* ============================================================
 * RELAY DEFINITION — UI MODEL
 * ============================================================
 */

export type RelayDefinition = {
  id: RelayId

  title: string
  description: string | null

  city: string | null
  theme: string | null

  status: RelayStatus

  executionMode:
    RelayExecutionMode

  minTeamSize: number
  maxTeamSize: number

  startsAt: string | null
  endsAt: string | null

  partnerCampaignId:
    PartnerCampaignId | null

  createdBy:
    UserId

  slots:
    RelaySlotTemplate[]

  createdAt: string
  updatedAt: string
}


/* ============================================================
 * TEAM MEMBER — UI MODEL
 * ============================================================
 */

export type RelayTeamMember = {
  id: RelayTeamMemberId

  teamId: RelayTeamId
  userId: UserId

  memberStatus:
    RelayMemberStatus

  joinedAt:
    string | null

  leftAt:
    string | null

  createdAt: string
  updatedAt: string

  /**
   * Optional presentation-only profile data.
   */
  user?:
    RelayUserSummary | null

  /**
   * Derived by trusted query/view-model code.
   *
   * Never treat this flag as authorization.
   */
  isCaptain:
    boolean
}


/* ============================================================
 * TEAM SLOT — UI MODEL
 * ============================================================
 */

export type RelayTeamSlot = {
  id: RelayTeamSlotId

  teamId: RelayTeamId

  relaySlotId:
    RelaySlotId

  slotIndex:
    number

  assignedUserId:
    UserId | null

  status:
    RelayTeamSlotStatus

  venueId:
    VenueId | null

  flowSessionId:
    ActiveFlowSessionId | null

  checkedInAt:
    string | null

  completedAt:
    string | null

  geoVerified:
    boolean

  createdAt: string
  updatedAt: string

  /**
   * Resolved immutable template information.
   */
  template:
    RelaySlotTemplate

  /**
   * Optional display-only relations.
   */
  assignedUser?:
    RelayUserSummary | null

  venue?:
    RelayVenueSummary | null
}


/* ============================================================
 * BATON STATE
 * ============================================================
 */

export type RelayBatonState =
  | {
      state: 'not_started'
      activeTeamSlotId: null
      activeSlotIndex: null
      activeUserId: null
    }
  | {
      state: 'active'
      activeTeamSlotId: RelayTeamSlotId
      activeSlotIndex: number
      activeUserId: UserId
    }
  | {
      state: 'completed'
      activeTeamSlotId: null
      activeSlotIndex: null
      activeUserId: null
    }
  | {
      state: 'unavailable'
      activeTeamSlotId: null
      activeSlotIndex: null
      activeUserId: null
    }


/* ============================================================
 * TEAM READINESS
 * ============================================================
 */

export type RelayTeamReadinessBlocker =
  | 'team_not_forming'
  | 'relay_not_available'
  | 'relay_window_ended'
  | 'no_slots'
  | 'slot_template_mismatch'
  | 'team_size_below_minimum'
  | 'team_size_above_maximum'
  | 'member_slot_count_mismatch'
  | 'unassigned_slot'
  | 'duplicate_assignment'
  | 'assigned_user_not_joined'
  | 'joined_member_without_slot'


export type RelayTeamReadiness = {
  isReady: boolean

  blockers:
    RelayTeamReadinessBlocker[]

  joinedMemberCount:
    number

  slotCount:
    number

  assignedSlotCount:
    number
}


/* ============================================================
 * RELAY TEAM — UI MODEL
 * ============================================================
 */

export type RelayTeam = {
  id: RelayTeamId
  relayId: RelayId

  captainUserId:
    UserId

  status:
    RelayTeamStatus

  optedInAt:
    string | null

  startedAt:
    string | null

  completedAt:
    string | null

  createdAt: string
  updatedAt: string

  members:
    RelayTeamMember[]

  slots:
    RelayTeamSlot[]

  baton:
    RelayBatonState

  readiness:
    RelayTeamReadiness
}


/* ============================================================
 * REWARD POLICY DISPLAY
 * ============================================================
 */

export type RelayRewardPolicy = {
  mode:
    RelayRewardMode

  /**
   * Configured competition XP reward.
   *
   * per_member:
   *   this amount is awarded to every winning contributor.
   *
   * team_pool:
   *   this amount is the total pool divided between winning
   *   contributors by canonical settlement logic.
   */
  xpReward:
    number
}


export type RelayRewardPolicyDisplay =
  | {
      mode: 'per_member'

      xpReward: number

      title: string

      description: string

      /**
       * Reward each canonical winning contributor receives.
       */
      perMemberXp:
        number

      totalPoolXp:
        null
    }
  | {
      mode: 'team_pool'

      xpReward: number

      title: string

      description: string

      perMemberXp:
        null

      /**
       * Total XP distributed across canonical winning
       * contributors.
       */
      totalPoolXp:
        number
    }


/* ============================================================
 * ARTIFACT — UI MODEL
 * ============================================================
 */

export type RelayArtifactSlot = {
  id: RelayArtifactSlotId

  artifactId:
    RelayArtifactId

  relaySlotId:
    RelaySlotId

  teamSlotId:
    RelayTeamSlotId

  slotIndex:
    number

  contributorUserId:
    UserId

  venueId:
    VenueId

  flowSessionId:
    ActiveFlowSessionId

  checkedInAt:
    string

  completedAt:
    string

  createdAt:
    string

  contributor?:
    RelayUserSummary | null

  venue?:
    RelayVenueSummary | null
}


export type RelayArtifact = {
  id: RelayArtifactId

  relayId:
    RelayId

  teamId:
    RelayTeamId

  title: string

  city:
    string | null

  theme:
    string | null

  venueIds:
    VenueId[]

  contributorUserIds:
    UserId[]

  publicFlowSnapshotId:
    FlowSnapshotId | null

  completedAt: string
  createdAt: string

  slots:
    RelayArtifactSlot[]

  /**
   * True only when a canonical public replayable Flow snapshot
   * is available to the current viewer.
   *
   * This is presentation state, not database authority.
   */
  canReplay:
    boolean
}


/* ============================================================
 * PUBLIC DISCOVERY CARD MODEL
 * ============================================================
 */

export type RelayPublicCardModel = {
  id: RelayId

  title: string

  description:
    string | null

  city:
    string | null

  theme:
    string | null

  status:
    RelayStatus

  startsAt:
    string | null

  endsAt:
    string | null

  slotCount:
    number

  minTeamSize:
    number

  maxTeamSize:
    number

  /**
   * Whether this Relay has Partner campaign context.
   *
   * Do not use this field to determine integrity or execution
   * eligibility.
   */
  isPartner:
    boolean

  partnerCampaignId:
    PartnerCampaignId | null

  rewardPolicy?:
    RelayRewardPolicyDisplay | null

  /**
   * Optional editorial/display image.
   *
   * Not part of Relay execution integrity.
   */
  imageUrl?:
    string | null
}


/* ============================================================
 * PUBLIC DETAIL MODEL
 * ============================================================
 */

export type RelayViewerTeamState =
  | {
      kind: 'none'
      teamId: null
      teamStatus: null
    }
  | {
      kind: 'invited'
      teamId: RelayTeamId
      teamStatus: RelayTeamStatus
    }
  | {
      kind: 'member'
      teamId: RelayTeamId
      teamStatus: RelayTeamStatus
    }
  | {
      kind: 'captain'
      teamId: RelayTeamId
      teamStatus: RelayTeamStatus
    }


export type RelayPublicDetailModel = {
  relay:
    RelayDefinition

  rewardPolicy:
    RelayRewardPolicyDisplay | null

  viewerTeam:
    RelayViewerTeamState

  /**
   * Aggregate presentation values only.
   *
   * These should come from trusted queries/views.
   */
  teamCount?:
    number

  completedTeamCount?:
    number

  /**
   * Completed public artifacts that the current viewer is
   * allowed to see.
   */
  artifacts?:
    RelayArtifact[]
}


/* ============================================================
 * TEAM PAGE MODEL
 * ============================================================
 */

export type RelayTeamPageModel = {
  relay:
    RelayDefinition

  team:
    RelayTeam

  viewerUserId:
    UserId

  viewerMember:
    RelayTeamMember | null

  viewerTeamSlot:
    RelayTeamSlot | null

  isCaptain:
    boolean

  canInvite:
    boolean

  canAssignSlots:
    boolean

  canMarkReady:
    boolean

  canStartTeam:
    boolean

  canActOnCurrentBaton:
    boolean
}


/* ============================================================
 * COMPLETION MODEL
 * ============================================================
 */

export type RelayCompletionModel = {
  relay:
    RelayDefinition

  team:
    RelayTeam

  artifact:
    RelayArtifact | null

  /**
   * Artifact publication is a separate canonical outcome from
   * team completion.
   *
   * This avoids pretending an artifact exists when the team is
   * complete but publication/materialization has not occurred.
   */
  artifactPublished:
    boolean
}


/* ============================================================
 * RPC RESULT MODELS
 * ============================================================
 *
 * These mirror the stable application-facing contracts from
 * the transactional Relay RPC layer.
 * ============================================================
 */

export type CreateRelayTeamResult = {
  teamId: RelayTeamId
  relayId: RelayId
  captainUserId: UserId
  teamStatus: RelayTeamStatus
  created: boolean
}


export type InviteRelayTeamMemberResult = {
  teamId: RelayTeamId
  invitedUserId: UserId
  memberStatus: RelayMemberStatus
  created: boolean
}


export type JoinRelayTeamResult = {
  teamId: RelayTeamId
  userId: UserId
  memberStatus: RelayMemberStatus
  joined: boolean
}


export type DeclineRelayInvitationResult = {
  teamId: RelayTeamId
  userId: UserId
  memberStatus: RelayMemberStatus
  changed: boolean
}


export type AssignRelayTeamSlotResult = {
  teamSlotId: RelayTeamSlotId
  teamId: RelayTeamId
  relaySlotId: RelaySlotId
  slotIndex: number
  assignedUserId: UserId
  slotStatus: RelayTeamSlotStatus
  changed: boolean
}


export type SetRelayTeamReadyResult = {
  teamId: RelayTeamId
  relayId: RelayId
  teamStatus: RelayTeamStatus
  joinedMemberCount: number
  slotCount: number
  changed: boolean
}


export type FinalizeRelayTeamResult = {
  teamId: RelayTeamId
  teamStatus: RelayTeamStatus
  completedSlotCount: number
  totalSlotCount: number
  activeSlotCount: number
  fullyCompleted: boolean
}


/* ============================================================
 * TYPE GUARDS
 * ============================================================
 *
 * These perform vocabulary validation only.
 *
 * They do not authorize transitions.
 * ============================================================
 */

export function isRelayStatus(
  value: unknown
): value is RelayStatus {
  return (
    value === 'draft' ||
    value === 'scheduled' ||
    value === 'live' ||
    value === 'completed' ||
    value === 'cancelled'
  )
}


export function isRelayTeamStatus(
  value: unknown
): value is RelayTeamStatus {
  return (
    value === 'forming' ||
    value === 'ready' ||
    value === 'active' ||
    value === 'completed' ||
    value === 'abandoned' ||
    value === 'disqualified'
  )
}


export function isRelayMemberStatus(
  value: unknown
): value is RelayMemberStatus {
  return (
    value === 'invited' ||
    value === 'joined' ||
    value === 'declined' ||
    value === 'left' ||
    value === 'removed'
  )
}


export function isRelayTeamSlotStatus(
  value: unknown
): value is RelayTeamSlotStatus {
  return (
    value === 'locked' ||
    value === 'active' ||
    value === 'completed' ||
    value === 'skipped'
  )
}


export function isRelaySlotSelectionMode(
  value: unknown
): value is RelaySlotSelectionMode {
  return (
    value === 'open' ||
    value === 'category' ||
    value === 'venue_pool' ||
    value === 'exact_venue'
  )
}


export function isRelayRewardMode(
  value: unknown
): value is RelayRewardMode {
  return (
    value === 'per_member' ||
    value === 'team_pool'
  )
}