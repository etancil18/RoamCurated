// lib/relay/queries.ts

import 'server-only'

import { normalizeCityKey } from '@/lib/cities/normalizeCity'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type {
  RelayArtifact,
  RelayArtifactSlot,
  RelayBatonState,
  RelayCompletionModel,
  RelayDefinition,
  RelayId,
  RelayPublicDetailModel,
  RelayRewardMode,
  RelayRewardPolicyDisplay,
  RelaySlotTemplate,
  RelayTeam,
  RelayTeamId,
  RelayTeamMember,
  RelayTeamPageModel,
  RelayTeamReadiness,
  RelayTeamReadinessBlocker,
  RelayTeamSlot,
  RelayVenueSummary,
  RelayViewerTeamState,
  RoamRelayArtifactRow,
  RoamRelayArtifactSlotRow,
  RoamRelayRow,
  RoamRelaySlotRow,
  RoamRelayTeamMemberRow,
  RoamRelayTeamRow,
  RoamRelayTeamSlotRow,
  UserId,
} from '@/lib/relay/types'


type SupabaseAdminClient =
  ReturnType<
    typeof getSupabaseAdmin
  >


type RelayCompetitionRewardQueryRow = {
  id: string
  competition_type: string | null
  relay_id: string | null
  xp_reward:
    number | string | null
  relay_reward_mode:
    string | null
}


export type RelayReplaySnapshotLookup = {
  id: string
  sourceType: string
  sourceId: string
  title: string | null
  city: string | null
  status: string
  visibility: string
  replayable: boolean
  totalStops: number
  checkedInCount: number
  createdAt: string
  updatedAt: string
}


export type RelayArtifactReplayLookup = {
  artifact:
    RelayArtifact | null

  snapshot:
    RelayReplaySnapshotLookup | null
}


export type CurrentUserRelayTeamResult = {
  team:
    RelayTeam | null

  viewerMember:
    RelayTeamMember | null

  viewerTeamSlot:
    RelayTeamSlot | null
}


/* ============================================================
 * ERROR HANDLING
 * ============================================================
 */

function throwIfQueryFailed(
  queryName: string,
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
    `[relay/queries] ${queryName} failed: ${details}`
  )
}


/* ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeRequiredId(
  value: string,
  label: string
): string {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      `[relay/queries] ${label} is required.`
    )
  }

  return normalized
}


function normalizeCount(
  value: unknown
): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      Math.floor(value)
    )
  }

  if (
    typeof value === 'string' &&
    value.trim().length > 0
  ) {
    const parsed =
      Number(value)

    if (
      Number.isFinite(parsed)
    ) {
      return Math.max(
        0,
        Math.floor(parsed)
      )
    }
  }

  return 0
}


function normalizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(
      (
        item
      ): item is string =>
        typeof item ===
        'string'
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean)
}


function isRelayRewardModeValue(
  value: unknown
): value is RelayRewardMode {
  return (
    value === 'per_member' ||
    value === 'team_pool'
  )
}


/* ============================================================
 * RAW ROW -> DOMAIN MAPPERS
 * ============================================================
 */

function mapRelaySlotRow(
  row: RoamRelaySlotRow
): RelaySlotTemplate {
  return {
    id:
      row.id,

    relayId:
      row.relay_id,

    slotIndex:
      normalizeCount(
        row.slot_index
      ),

    label:
      row.label,

    prompt:
      row.prompt,

    selectionMode:
      row.selection_mode,

    categoryConstraint:
      row.category_constraint,

    exactVenueId:
      row.exact_venue_id,

    eligibleVenueIds:
      normalizeStringArray(
        row.eligible_venue_ids
      ),

    requiredGeoVerified:
      row.required_geo_verified,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  }
}


function mapRelayDefinition(
  relayRow: RoamRelayRow,
  slotRows: RoamRelaySlotRow[]
): RelayDefinition {
  const slots =
    [...slotRows]
      .sort(
        (
          left,
          right
        ) =>
          left.slot_index -
          right.slot_index
      )
      .map(
        mapRelaySlotRow
      )

  return {
    id:
      relayRow.id,

    title:
      relayRow.title,

    description:
      relayRow.description,

    city:
      relayRow.city,

    theme:
      relayRow.theme,

    status:
      relayRow.status,

    executionMode:
      relayRow.execution_mode,

    minTeamSize:
      normalizeCount(
        relayRow.min_team_size
      ),

    maxTeamSize:
      normalizeCount(
        relayRow.max_team_size
      ),

    startsAt:
      relayRow.starts_at,

    endsAt:
      relayRow.ends_at,

    partnerCampaignId:
      relayRow.partner_campaign_id,

    createdBy:
      relayRow.created_by,

    slots,

    createdAt:
      relayRow.created_at,

    updatedAt:
      relayRow.updated_at,
  }
}


function mapRelayTeamMember(
  row: RoamRelayTeamMemberRow,
  captainUserId: UserId
): RelayTeamMember {
  return {
    id:
      row.id,

    teamId:
      row.team_id,

    userId:
      row.user_id,

    memberStatus:
      row.member_status,

    joinedAt:
      row.joined_at,

    leftAt:
      row.left_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    isCaptain:
      row.user_id ===
      captainUserId,
  }
}


function mapRelayTeamSlot(
  row: RoamRelayTeamSlotRow,
  template:
    RelaySlotTemplate
): RelayTeamSlot {
  return {
    id:
      row.id,

    teamId:
      row.team_id,

    relaySlotId:
      row.relay_slot_id,

    slotIndex:
      normalizeCount(
        row.slot_index
      ),

    assignedUserId:
      row.assigned_user_id,

    status:
      row.status,

    venueId:
      row.venue_id,

    flowSessionId:
      row.flow_session_id,

    checkedInAt:
      row.checked_in_at,

    completedAt:
      row.completed_at,

    geoVerified:
      row.geo_verified,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    template,
  }
}


function mapRelayArtifactSlot(
  row: RoamRelayArtifactSlotRow
): RelayArtifactSlot {
  return {
    id:
      row.id,

    artifactId:
      row.artifact_id,

    relaySlotId:
      row.relay_slot_id,

    teamSlotId:
      row.team_slot_id,

    slotIndex:
      normalizeCount(
        row.slot_index
      ),

    contributorUserId:
      row.contributor_user_id,

    venueId:
      row.venue_id,

    flowSessionId:
      row.flow_session_id,

    checkedInAt:
      row.checked_in_at,

    completedAt:
      row.completed_at,

    createdAt:
      row.created_at,
  }
}


function mapRelayArtifact(
  row: RoamRelayArtifactRow,
  slotRows:
    RoamRelayArtifactSlotRow[],
  canReplay: boolean
): RelayArtifact {
  const slots =
    [...slotRows]
      .sort(
        (
          left,
          right
        ) =>
          left.slot_index -
          right.slot_index
      )
      .map(
        mapRelayArtifactSlot
      )

  return {
    id:
      row.id,

    relayId:
      row.relay_id,

    teamId:
      row.team_id,

    title:
      row.title,

    city:
      row.city,

    theme:
      row.theme,

    venueIds:
      normalizeStringArray(
        row.venue_ids
      ),

    contributorUserIds:
      normalizeStringArray(
        row.contributor_user_ids
      ),

    publicFlowSnapshotId:
      row.public_flow_snapshot_id,

    completedAt:
      row.completed_at,

    createdAt:
      row.created_at,

    slots,

    canReplay,
  }
}


/* ============================================================
 * DERIVED UI STATE
 * ============================================================
 *
 * These values are presentation helpers only.
 *
 * Database state / RPC validation remains authoritative.
 * ============================================================
 */

function deriveRelayBatonState(
  teamStatus:
    RoamRelayTeamRow['status'],
  slots:
    RelayTeamSlot[]
): RelayBatonState {
  if (
    teamStatus ===
    'completed'
  ) {
    return {
      state:
        'completed',

      activeTeamSlotId:
        null,

      activeSlotIndex:
        null,

      activeUserId:
        null,
    }
  }

  if (
    teamStatus ===
      'forming' ||
    teamStatus ===
      'ready'
  ) {
    return {
      state:
        'not_started',

      activeTeamSlotId:
        null,

      activeSlotIndex:
        null,

      activeUserId:
        null,
    }
  }

  if (
    teamStatus !==
    'active'
  ) {
    return {
      state:
        'unavailable',

      activeTeamSlotId:
        null,

      activeSlotIndex:
        null,

      activeUserId:
        null,
    }
  }

  const activeSlots =
    slots.filter(
      (slot) =>
        slot.status ===
        'active'
    )

  if (
    activeSlots.length !==
    1
  ) {
    return {
      state:
        'unavailable',

      activeTeamSlotId:
        null,

      activeSlotIndex:
        null,

      activeUserId:
        null,
    }
  }

  const activeSlot =
    activeSlots[0]

  if (
    !activeSlot.assignedUserId
  ) {
    return {
      state:
        'unavailable',

      activeTeamSlotId:
        null,

      activeSlotIndex:
        null,

      activeUserId:
        null,
    }
  }

  return {
    state:
      'active',

    activeTeamSlotId:
      activeSlot.id,

    activeSlotIndex:
      activeSlot.slotIndex,

    activeUserId:
      activeSlot.assignedUserId,
  }
}


function deriveRelayTeamReadiness(
  relay:
    RelayDefinition,
  team:
    RoamRelayTeamRow,
  members:
    RelayTeamMember[],
  slots:
    RelayTeamSlot[],
  now:
    Date
): RelayTeamReadiness {
  const blockers:
    RelayTeamReadinessBlocker[] =
      []

  const joinedMembers =
    members.filter(
      (member) =>
        member.memberStatus ===
        'joined'
    )

  const assignedSlots =
    slots.filter(
      (slot) =>
        Boolean(
          slot.assignedUserId
        )
    )

  if (
    team.status !==
    'forming'
  ) {
    blockers.push(
      'team_not_forming'
    )
  }

  if (
    relay.status !==
      'scheduled' &&
    relay.status !==
      'live'
  ) {
    blockers.push(
      'relay_not_available'
    )
  }

  if (
    relay.endsAt
  ) {
    const endsAt =
      new Date(
        relay.endsAt
      )

    if (
      !Number.isNaN(
        endsAt.getTime()
      ) &&
      now.getTime() >=
        endsAt.getTime()
    ) {
      blockers.push(
        'relay_window_ended'
      )
    }
  }

  if (
    relay.slots.length ===
    0
  ) {
    blockers.push(
      'no_slots'
    )
  }

  if (
    slots.length !==
    relay.slots.length
  ) {
    blockers.push(
      'slot_template_mismatch'
    )
  }

  if (
    joinedMembers.length <
    relay.minTeamSize
  ) {
    blockers.push(
      'team_size_below_minimum'
    )
  }

  if (
    joinedMembers.length >
    relay.maxTeamSize
  ) {
    blockers.push(
      'team_size_above_maximum'
    )
  }

  if (
    joinedMembers.length !==
    slots.length
  ) {
    blockers.push(
      'member_slot_count_mismatch'
    )
  }

  if (
    assignedSlots.length !==
    slots.length
  ) {
    blockers.push(
      'unassigned_slot'
    )
  }

  const assignedUserIds =
    assignedSlots
      .map(
        (slot) =>
          slot.assignedUserId
      )
      .filter(
        (
          userId
        ): userId is string =>
          Boolean(userId)
      )

  if (
    new Set(
      assignedUserIds
    ).size !==
    assignedUserIds.length
  ) {
    blockers.push(
      'duplicate_assignment'
    )
  }

  const joinedUserIds =
    new Set(
      joinedMembers.map(
        (member) =>
          member.userId
      )
    )

  if (
    assignedUserIds.some(
      (userId) =>
        !joinedUserIds.has(
          userId
        )
    )
  ) {
    blockers.push(
      'assigned_user_not_joined'
    )
  }

  const assignedUserIdSet =
    new Set(
      assignedUserIds
    )

  if (
    joinedMembers.some(
      (member) =>
        !assignedUserIdSet.has(
          member.userId
        )
    )
  ) {
    blockers.push(
      'joined_member_without_slot'
    )
  }

  return {
    isReady:
      blockers.length ===
      0,

    blockers: [
      ...new Set(
        blockers
      ),
    ],

    joinedMemberCount:
      joinedMembers.length,

    slotCount:
      slots.length,

    assignedSlotCount:
      assignedSlots.length,
  }
}


function buildRewardPolicyDisplay(
  mode: RelayRewardMode,
  xpReward: number
): RelayRewardPolicyDisplay {
  if (
    mode ===
    'team_pool'
  ) {
    return {
      mode:
        'team_pool',

      xpReward,

      title:
        'Team XP pool',

      description:
        `${xpReward} XP is shared across the canonical contributors on the winning Relay.`,

      perMemberXp:
        null,

      totalPoolXp:
        xpReward,
    }
  }

  return {
    mode:
      'per_member',

    xpReward,

    title:
      'XP per winning teammate',

    description:
      `Each canonical contributor on the winning Relay earns ${xpReward} XP.`,

    perMemberXp:
      xpReward,

    totalPoolXp:
      null,
  }
}


/* ============================================================
 * RELAY DEFINITION
 * ============================================================
 */

export async function getRelayDefinition(
  relayId: RelayId
): Promise<RelayDefinition | null> {
  const normalizedRelayId =
    normalizeRequiredId(
      relayId,
      'relayId'
    )

  const supabase =
    getSupabaseAdmin()

  const [
    relayResult,
    slotsResult,
  ] = await Promise.all([
    supabase
      .from('roam_relays')
      .select(`
        id,
        title,
        description,
        city,
        theme,
        status,
        execution_mode,
        min_team_size,
        max_team_size,
        starts_at,
        ends_at,
        partner_campaign_id,
        created_by,
        created_at,
        updated_at
      `)
      .eq(
        'id',
        normalizedRelayId
      )
      .maybeSingle(),

    supabase
      .from(
        'roam_relay_slots'
      )
      .select(`
        id,
        relay_id,
        slot_index,
        label,
        prompt,
        selection_mode,
        category_constraint,
        exact_venue_id,
        eligible_venue_ids,
        required_geo_verified,
        created_at,
        updated_at
      `)
      .eq(
        'relay_id',
        normalizedRelayId
      )
      .order(
        'slot_index',
        {
          ascending:
            true,
        }
      ),
  ])

  throwIfQueryFailed(
    'roam_relays definition',
    relayResult.error
  )

  throwIfQueryFailed(
    'roam_relay_slots definition',
    slotsResult.error
  )

  if (!relayResult.data) {
    return null
  }

  return mapRelayDefinition(
    relayResult.data as
      RoamRelayRow,

    (
      slotsResult.data ??
      []
    ) as RoamRelaySlotRow[]
  )
}

/* ============================================================
 * RELAY VENUE OPTIONS
 * ============================================================
 *
 * Admin authoring helper only.
 *
 * The supplied city is normalized through the canonical Roam
 * city vocabulary before filtering venues.canonical_city.
 *
 * Presentation components receive human-readable venue data,
 * while persisted Relay slot constraints continue to store only
 * canonical venue IDs.
 * ============================================================
 */

export async function getRelayVenueOptions(
  city?: string | null
): Promise<RelayVenueSummary[]> {
  const normalizedCity =
    normalizeCityKey(
      city
    )

  if (!normalizedCity) {
    return []
  }

  const supabase =
    getSupabaseAdmin()

  const result =
    await supabase
      .from(
        'venues'
      )
      .select(`
        id,
        name,
        canonical_city,
        type,
        address
      `)
      .eq(
        'canonical_city',
        normalizedCity
      )
      .order(
        'name',
        {
          ascending:
            true,
        }
      )

  throwIfQueryFailed(
    'Relay venue options',
    result.error
  )

  return (
    result.data ??
    []
  )
    .map(
      (
        row
      ): RelayVenueSummary | null => {
        const id =
          typeof row.id ===
            'string'
            ? row.id.trim()
            : ''

        const name =
          typeof row.name ===
            'string'
            ? row.name.trim()
            : ''

        if (
          !id ||
          !name
        ) {
          return null
        }

        const venueTypes =
          normalizeStringArray(
            row.type
          )

        const canonicalCity =
          typeof row.canonical_city ===
            'string'
            ? row.canonical_city.trim()
            : null

        const address =
          typeof row.address ===
            'string'
            ? row.address.trim() ||
              null
            : null

        return {
          id,

          name,

          category:
            venueTypes.length >
              0
              ? venueTypes.join(
                  ' · '
                )
              : null,

          neighborhood:
            address,

          city:
            canonicalCity,

          imageUrl:
            null,
        }
      }
    )
    .filter(
      (
        venue
      ): venue is RelayVenueSummary =>
        venue !==
        null
    )
}


/* ============================================================
 * REWARD POLICY LOOKUP
 * ============================================================
 *
 * A Relay can exist independently from competition.
 *
 * Therefore absence of a Relay competition reward policy is a
 * valid result.
 * ============================================================
 */

export async function getRelayRewardPolicyDisplay(
  relayId: RelayId
): Promise<RelayRewardPolicyDisplay | null> {
  const normalizedRelayId =
    normalizeRequiredId(
      relayId,
      'relayId'
    )

  const supabase =
    getSupabaseAdmin()

  const result =
    await supabase
      .from('competitions')
      .select(`
        id,
        competition_type,
        relay_id,
        xp_reward,
        relay_reward_mode
      `)
      .eq(
        'competition_type',
        'roam_relay'
      )
      .eq(
        'relay_id',
        normalizedRelayId
      )
      .in(
        'status',
        [
          'draft',
          'scheduled',
          'live',
          'scoring',
          'completed',
        ]
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle()

  throwIfQueryFailed(
    'Relay competition reward policy',
    result.error
  )

  if (!result.data) {
    return null
  }

  const row =
    result.data as
      RelayCompetitionRewardQueryRow

  if (
    !isRelayRewardModeValue(
      row.relay_reward_mode
    )
  ) {
    return null
  }

  return buildRewardPolicyDisplay(
    row.relay_reward_mode,
    normalizeCount(
      row.xp_reward
    )
  )
}

/* ============================================================
 * TEAM ROSTER / SLOTS
 * ============================================================
 */

export async function getRelayTeam(
  teamId: RelayTeamId
): Promise<RelayTeam | null> {
  const normalizedTeamId =
    normalizeRequiredId(
      teamId,
      'teamId'
    )

  const supabase =
    getSupabaseAdmin()

  const teamResult =
    await supabase
      .from(
        'roam_relay_teams'
      )
      .select(`
        id,
        relay_id,
        captain_user_id,
        status,
        opted_in_at,
        started_at,
        completed_at,
        created_at,
        updated_at
      `)
      .eq(
        'id',
        normalizedTeamId
      )
      .maybeSingle()

  throwIfQueryFailed(
    'roam_relay_teams',
    teamResult.error
  )

  if (!teamResult.data) {
    return null
  }

  const teamRow =
    teamResult.data as
      RoamRelayTeamRow

  const relay =
    await getRelayDefinition(
      teamRow.relay_id
    )

  if (!relay) {
    throw new Error(
      `[relay/queries] Relay ${teamRow.relay_id} referenced by team ${normalizedTeamId} was not found.`
    )
  }

  const [
    membersResult,
    teamSlotsResult,
  ] = await Promise.all([
    supabase
      .from(
        'roam_relay_team_members'
      )
      .select(`
        id,
        team_id,
        user_id,
        member_status,
        joined_at,
        left_at,
        created_at,
        updated_at
      `)
      .eq(
        'team_id',
        normalizedTeamId
      )
      .order(
        'created_at',
        {
          ascending:
            true,
        }
      ),

    supabase
      .from(
        'roam_relay_team_slots'
      )
      .select(`
        id,
        team_id,
        relay_slot_id,
        slot_index,
        assigned_user_id,
        status,
        venue_id,
        flow_session_id,
        checked_in_at,
        completed_at,
        geo_verified,
        created_at,
        updated_at
      `)
      .eq(
        'team_id',
        normalizedTeamId
      )
      .order(
        'slot_index',
        {
          ascending:
            true,
        }
      ),
  ])

  throwIfQueryFailed(
    'roam_relay_team_members',
    membersResult.error
  )

  throwIfQueryFailed(
    'roam_relay_team_slots',
    teamSlotsResult.error
  )

  const members =
    (
      membersResult.data ??
      []
    )
      .map(
        (row) =>
          mapRelayTeamMember(
            row as
              RoamRelayTeamMemberRow,

            teamRow.captain_user_id
          )
      )

  const templateById =
    new Map(
      relay.slots.map(
        (slot) => [
          slot.id,
          slot,
        ] as const
      )
    )

  const teamSlots =
    (
      teamSlotsResult.data ??
      []
    )
      .map(
        (row) => {
          const teamSlotRow =
            row as
              RoamRelayTeamSlotRow

          const template =
            templateById.get(
              teamSlotRow.relay_slot_id
            )

          if (!template) {
            throw new Error(
              `[relay/queries] Team slot ${teamSlotRow.id} references missing Relay template slot ${teamSlotRow.relay_slot_id}.`
            )
          }

          return mapRelayTeamSlot(
            teamSlotRow,
            template
          )
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          left.slotIndex -
          right.slotIndex
      )

  const baton =
    deriveRelayBatonState(
      teamRow.status,
      teamSlots
    )

  const readiness =
    deriveRelayTeamReadiness(
      relay,
      teamRow,
      members,
      teamSlots,
      new Date()
    )

  return {
    id:
      teamRow.id,

    relayId:
      teamRow.relay_id,

    captainUserId:
      teamRow.captain_user_id,

    status:
      teamRow.status,

    optedInAt:
      teamRow.opted_in_at,

    startedAt:
      teamRow.started_at,

    completedAt:
      teamRow.completed_at,

    createdAt:
      teamRow.created_at,

    updatedAt:
      teamRow.updated_at,

    members,

    slots:
      teamSlots,

    baton,

    readiness,
  }
}


/* ============================================================
 * CURRENT USER TEAM
 * ============================================================
 *
 * Order of precedence:
 *
 *   joined open team
 *   invited forming team
 *
 * A user should have at most one joined open team per Relay by
 * database invariant.
 * ============================================================
 */

export async function getCurrentUserRelayTeam(
  relayId: RelayId,
  userId: UserId
): Promise<CurrentUserRelayTeamResult> {
  const normalizedRelayId =
    normalizeRequiredId(
      relayId,
      'relayId'
    )

  const normalizedUserId =
    normalizeRequiredId(
      userId,
      'userId'
    )

  const supabase =
    getSupabaseAdmin()

  const membershipResult =
    await supabase
      .from(
        'roam_relay_team_members'
      )
      .select(`
        id,
        team_id,
        user_id,
        member_status,
        joined_at,
        left_at,
        created_at,
        updated_at
      `)
      .eq(
        'user_id',
        normalizedUserId
      )
      .in(
        'member_status',
        [
          'joined',
          'invited',
        ]
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      )

  throwIfQueryFailed(
    'current user Relay memberships',
    membershipResult.error
  )

  const memberships =
    (
      membershipResult.data ??
      []
    ) as RoamRelayTeamMemberRow[]

  if (
    memberships.length ===
    0
  ) {
    return {
      team:
        null,

      viewerMember:
        null,

      viewerTeamSlot:
        null,
    }
  }

  const candidateTeamIds =
    [
      ...new Set(
        memberships.map(
          (member) =>
            member.team_id
        )
      ),
    ]

  const teamsResult =
    await supabase
      .from(
        'roam_relay_teams'
      )
      .select(`
        id,
        relay_id,
        captain_user_id,
        status,
        opted_in_at,
        started_at,
        completed_at,
        created_at,
        updated_at
      `)
      .in(
        'id',
        candidateTeamIds
      )
      .eq(
        'relay_id',
        normalizedRelayId
      )
      .in(
        'status',
        [
          'forming',
          'ready',
          'active',
        ]
      )

  throwIfQueryFailed(
    'current user Relay teams',
    teamsResult.error
  )

  const teams =
    (
      teamsResult.data ??
      []
    ) as RoamRelayTeamRow[]

  if (
    teams.length ===
    0
  ) {
    return {
      team:
        null,

      viewerMember:
        null,

      viewerTeamSlot:
        null,
    }
  }

  const membershipByTeamId =
    new Map(
      memberships.map(
        (membership) => [
          membership.team_id,
          membership,
        ] as const
      )
    )

  const orderedCandidates =
    [...teams]
      .sort(
        (
          left,
          right
        ) => {
          const leftMembership =
            membershipByTeamId.get(
              left.id
            )

          const rightMembership =
            membershipByTeamId.get(
              right.id
            )

          const leftJoined =
            leftMembership
              ?.member_status ===
            'joined'

          const rightJoined =
            rightMembership
              ?.member_status ===
            'joined'

          if (
            leftJoined !==
            rightJoined
          ) {
            return leftJoined
              ? -1
              : 1
          }

          return (
            new Date(
              right.created_at
            ).getTime() -
            new Date(
              left.created_at
            ).getTime()
          )
        }
      )

  const selectedTeamRow =
    orderedCandidates[0]

  if (!selectedTeamRow) {
    return {
      team:
        null,

      viewerMember:
        null,

      viewerTeamSlot:
        null,
    }
  }

  const team =
    await getRelayTeam(
      selectedTeamRow.id
    )

  if (!team) {
    return {
      team:
        null,

      viewerMember:
        null,

      viewerTeamSlot:
        null,
    }
  }

  const viewerMember =
    team.members.find(
      (member) =>
        member.userId ===
        normalizedUserId
    ) ??
    null

  const viewerTeamSlot =
    team.slots.find(
      (slot) =>
        slot.assignedUserId ===
        normalizedUserId
    ) ??
    null

  return {
    team,
    viewerMember,
    viewerTeamSlot,
  }
}


/* ============================================================
 * VIEWER TEAM STATE
 * ============================================================
 */

export async function getRelayViewerTeamState(
  relayId: RelayId,
  userId:
    UserId | null
): Promise<RelayViewerTeamState> {
  if (!userId) {
    return {
      kind:
        'none',

      teamId:
        null,

      teamStatus:
        null,
    }
  }

  const current =
    await getCurrentUserRelayTeam(
      relayId,
      userId
    )

  if (
    !current.team ||
    !current.viewerMember
  ) {
    return {
      kind:
        'none',

      teamId:
        null,

      teamStatus:
        null,
    }
  }

  if (
    current.viewerMember
      .memberStatus ===
    'invited'
  ) {
    return {
      kind:
        'invited',

      teamId:
        current.team.id,

      teamStatus:
        current.team.status,
    }
  }

  if (
    current.team
      .captainUserId ===
    userId
  ) {
    return {
      kind:
        'captain',

      teamId:
        current.team.id,

      teamStatus:
        current.team.status,
    }
  }

  return {
    kind:
      'member',

    teamId:
      current.team.id,

    teamStatus:
      current.team.status,
  }
}

/* ============================================================
 * RELAY TEAM PAGE MODEL
 * ============================================================
 */

export async function getRelayTeamPageModel(
  teamId: RelayTeamId,
  viewerUserId: UserId
): Promise<RelayTeamPageModel | null> {
  const normalizedUserId =
    normalizeRequiredId(
      viewerUserId,
      'viewerUserId'
    )

  const team =
    await getRelayTeam(
      teamId
    )

  if (!team) {
    return null
  }

  const relay =
    await getRelayDefinition(
      team.relayId
    )

  if (!relay) {
    throw new Error(
      `[relay/queries] Relay ${team.relayId} referenced by team ${team.id} was not found.`
    )
  }

  const viewerMember =
    team.members.find(
      (member) =>
        member.userId ===
        normalizedUserId
    ) ??
    null

  const viewerTeamSlot =
    team.slots.find(
      (slot) =>
        slot.assignedUserId ===
        normalizedUserId
    ) ??
    null

  const isCaptain =
    team.captainUserId ===
    normalizedUserId

  const isJoined =
    viewerMember
      ?.memberStatus ===
    'joined'

  const canInvite =
    isCaptain &&
    team.status ===
      'forming'

  const canAssignSlots =
    isCaptain &&
    team.status ===
      'forming'

  const canMarkReady =
    isCaptain &&
    team.status ===
      'forming' &&
    team.readiness
      .isReady

  const canStartTeam =
    isCaptain &&
    team.status ===
      'ready' &&
    relay.status ===
      'live'

  const canActOnCurrentBaton =
    Boolean(
      isJoined &&
      viewerTeamSlot &&
      viewerTeamSlot.status ===
        'active' &&
      team.baton.state ===
        'active' &&
      team.baton
        .activeUserId ===
        normalizedUserId
    )

  return {
    relay,
    team,

    viewerUserId:
      normalizedUserId,

    viewerMember,
    viewerTeamSlot,

    isCaptain,

    canInvite,
    canAssignSlots,
    canMarkReady,
    canStartTeam,
    canActOnCurrentBaton,
  }
}


/* ============================================================
 * COMPLETED ARTIFACT
 * ============================================================
 */

export async function getRelayArtifactById(
  artifactId: string
): Promise<RelayArtifact | null> {
  const normalizedArtifactId =
    normalizeRequiredId(
      artifactId,
      'artifactId'
    )

  const supabase =
    getSupabaseAdmin()

  const artifactResult =
    await supabase
      .from(
        'roam_relay_artifacts'
      )
      .select(`
        id,
        relay_id,
        team_id,
        title,
        city,
        theme,
        venue_ids,
        contributor_user_ids,
        public_flow_snapshot_id,
        completed_at,
        created_at
      `)
      .eq(
        'id',
        normalizedArtifactId
      )
      .maybeSingle()

  throwIfQueryFailed(
    'roam_relay_artifacts by id',
    artifactResult.error
  )

  if (!artifactResult.data) {
    return null
  }

  const artifactRow =
    artifactResult.data as
      RoamRelayArtifactRow

  const slotsResult =
    await supabase
      .from(
        'roam_relay_artifact_slots'
      )
      .select(`
        id,
        artifact_id,
        relay_slot_id,
        team_slot_id,
        slot_index,
        contributor_user_id,
        venue_id,
        flow_session_id,
        checked_in_at,
        completed_at,
        created_at
      `)
      .eq(
        'artifact_id',
        normalizedArtifactId
      )
      .order(
        'slot_index',
        {
          ascending:
            true,
        }
      )

  throwIfQueryFailed(
    'roam_relay_artifact_slots by artifact',
    slotsResult.error
  )

  const snapshot =
    artifactRow
      .public_flow_snapshot_id
      ? await getRelayReplaySnapshot(
          artifactRow
            .public_flow_snapshot_id
        )
      : null

  return mapRelayArtifact(
    artifactRow,

    (
      slotsResult.data ??
      []
    ) as RoamRelayArtifactSlotRow[],

    snapshot !==
      null
  )
}


/* ============================================================
 * COMPLETED ARTIFACT BY TEAM
 * ============================================================
 */

export async function getCompletedRelayArtifactByTeam(
  teamId: RelayTeamId
): Promise<RelayArtifact | null> {
  const normalizedTeamId =
    normalizeRequiredId(
      teamId,
      'teamId'
    )

  const supabase =
    getSupabaseAdmin()

  const result =
    await supabase
      .from(
        'roam_relay_artifacts'
      )
      .select('id')
      .eq(
        'team_id',
        normalizedTeamId
      )
      .maybeSingle()

  throwIfQueryFailed(
    'completed Relay artifact by team',
    result.error
  )

  if (!result.data?.id) {
    return null
  }

  return getRelayArtifactById(
    result.data.id
  )
}


/* ============================================================
 * CANONICAL RELAY REPLAY SNAPSHOT
 * ============================================================
 *
 * This intentionally returns only a completed/public/replayable
 * Relay snapshot.
 *
 * The snapshot publisher user_id is deliberately not exposed
 * here because Relay authorship is per artifact slot.
 * ============================================================
 */

export async function getRelayReplaySnapshot(
  snapshotId: string
): Promise<RelayReplaySnapshotLookup | null> {
  const normalizedSnapshotId =
    normalizeRequiredId(
      snapshotId,
      'snapshotId'
    )

  const supabase =
    getSupabaseAdmin()

  const result =
    await supabase
      .from(
        'flow_snapshots'
      )
      .select(`
        id,
        source_type,
        source_id,
        title,
        city,
        status,
        visibility,
        replayable,
        total_stops,
        checked_in_count,
        created_at,
        updated_at
      `)
      .eq(
        'id',
        normalizedSnapshotId
      )
      .eq(
        'source_type',
        'roam_relay'
      )
      .eq(
        'status',
        'completed'
      )
      .eq(
        'visibility',
        'public'
      )
      .eq(
        'replayable',
        true
      )
      .maybeSingle()

  throwIfQueryFailed(
    'Relay replay snapshot',
    result.error
  )

  if (!result.data) {
    return null
  }

  return {
    id:
      result.data.id,

    sourceType:
      result.data
        .source_type,

    sourceId:
      result.data
        .source_id,

    title:
      result.data.title,

    city:
      result.data.city,

    status:
      result.data.status,

    visibility:
      result.data.visibility,

    replayable:
      result.data.replayable,

    totalStops:
      normalizeCount(
        result.data.total_stops
      ),

    checkedInCount:
      normalizeCount(
        result.data
          .checked_in_count
      ),

    createdAt:
      result.data
        .created_at,

    updatedAt:
      result.data
        .updated_at,
  }
}


/* ============================================================
 * ARTIFACT + SNAPSHOT LOOKUP
 * ============================================================
 */

export async function getRelayArtifactReplayLookup(
  artifactId: string
): Promise<RelayArtifactReplayLookup> {
  const artifact =
    await getRelayArtifactById(
      artifactId
    )

  if (
    !artifact ||
    !artifact.publicFlowSnapshotId
  ) {
    return {
      artifact,
      snapshot:
        null,
    }
  }

  const snapshot =
    await getRelayReplaySnapshot(
      artifact.publicFlowSnapshotId
    )

  return {
    artifact:
      snapshot
        ? {
            ...artifact,
            canReplay:
              true,
          }
        : {
            ...artifact,
            canReplay:
              false,
          },

    snapshot,
  }
}


/* ============================================================
 * RELAY COMPLETION MODEL
 * ============================================================
 */

export async function getRelayCompletionModel(
  teamId: RelayTeamId
): Promise<RelayCompletionModel | null> {
  const team =
    await getRelayTeam(
      teamId
    )

  if (!team) {
    return null
  }

  const relay =
    await getRelayDefinition(
      team.relayId
    )

  if (!relay) {
    throw new Error(
      `[relay/queries] Relay ${team.relayId} referenced by team ${team.id} was not found.`
    )
  }

  const artifact =
    await getCompletedRelayArtifactByTeam(
      team.id
    )

  return {
    relay,
    team,
    artifact,

    artifactPublished:
      Boolean(
        artifact &&
        artifact
          .publicFlowSnapshotId &&
        artifact.canReplay
      ),
  }
}

/* ============================================================
 * PUBLIC RELAY DETAIL
 * ============================================================
 */

export async function getRelayPublicDetail(
  relayId: RelayId,
  viewerUserId:
    UserId | null = null
): Promise<RelayPublicDetailModel | null> {
  const normalizedRelayId =
    normalizeRequiredId(
      relayId,
      'relayId'
    )

  const relay =
    await getRelayDefinition(
      normalizedRelayId
    )

  if (!relay) {
    return null
  }

  const [
    rewardPolicy,
    viewerTeam,
  ] = await Promise.all([
    getRelayRewardPolicyDisplay(
      normalizedRelayId
    ),

    getRelayViewerTeamState(
      normalizedRelayId,
      viewerUserId
    ),
  ])

  const supabase =
    getSupabaseAdmin()

  const [
    teamCountResult,
    completedTeamCountResult,
  ] = await Promise.all([
    supabase
      .from(
        'roam_relay_teams'
      )
      .select('id', {
        count:
          'exact',
        head:
          true,
      })
      .eq(
        'relay_id',
        normalizedRelayId
      ),

    supabase
      .from(
        'roam_relay_teams'
      )
      .select('id', {
        count:
          'exact',
        head:
          true,
      })
      .eq(
        'relay_id',
        normalizedRelayId
      )
      .eq(
        'status',
        'completed'
      ),
  ])

  throwIfQueryFailed(
    'Relay public team count',
    teamCountResult.error
  )

  throwIfQueryFailed(
    'Relay public completed-team count',
    completedTeamCountResult.error
  )

  return {
    relay,

    rewardPolicy,

    viewerTeam,

    teamCount:
      normalizeCount(
        teamCountResult.count
      ),

    completedTeamCount:
      normalizeCount(
        completedTeamCountResult
          .count
      ),
  }
}