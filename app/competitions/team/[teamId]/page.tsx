import Link from 'next/link'

import {
  revalidatePath,
} from 'next/cache'

import {
  notFound,
  redirect,
} from 'next/navigation'

import RelayDetailHeader from '@/components/relay/RelayDetailHeader'
import ShareRelayTeamButton from '@/components/relay/ShareRelayTeamButton'
import RelayTeamInviteUser from '@/components/relay/RelayTeamInviteUser'
import RelayActiveLegLauncher, {
  type RelayActiveLegVenueOption,
} from '@/components/relay/RelayActiveLegLauncher'
import RelayTeamSlotAssignmentControl, {
  type RelayAssignableMember,
} from '@/components/relay/RelayTeamSlotAssignmentControl'
import RelayTeamLifecycleControls from '@/components/relay/RelayTeamLifecycleControls'

import {
  assignRelayTeamSlot,
  assignRelayTeamSlots,
  setRelayTeamReady,
  startRelaySlotFlow,
  startRelayTeam,
} from '@/lib/relay/actions'

import {
  getRelayVenueOptions,
} from '@/lib/relay/queries'

import {
  createServerClient,
} from '@/lib/supabase/server'


export const dynamic =
  'force-dynamic'


/* ============================================================
 * ROUTE CONTRACT
 * ============================================================
 */

type RelayTeamPageProps = {
  params:
    Promise<{
      teamId:
        string
    }>
}


/* ============================================================
 * DATABASE READ MODELS
 * ============================================================
 */

type RelayStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'cancelled'


type RelayTeamStatus =
  | 'forming'
  | 'ready'
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'disqualified'


type RelayMemberStatus =
  | 'invited'
  | 'joined'
  | 'declined'
  | 'left'
  | 'removed'


type RelayTeamSlotStatus =
  | 'locked'
  | 'active'
  | 'completed'
  | 'skipped'


type RelaySlotSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'


type RelayRow = {
  id: string
  title: string
  description: string | null
  city: string
  theme: string | null
  status: RelayStatus
  execution_mode: 'sequential'
  minimum_team_size: number
  maximum_team_size: number
  starts_at: string | null
  ends_at: string | null
  partner_campaign_id: string | null
  created_at: string
  updated_at: string
}


type RelaySlotRow = {
  id: string
  relay_id: string
  slot_index: number
  label: string
  prompt: string
  selection_mode: RelaySlotSelectionMode
  category_constraint: string | null
  exact_venue_id: string | null
  eligible_venue_ids: string[] | null
  required_geo_verified: boolean
  created_at: string
  updated_at: string
}


type RelayTeamRow = {
  id: string
  relay_id: string
  captain_user_id: string
  status: RelayTeamStatus
  opted_in_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}


type RelayTeamMemberRow = {
  id: string
  team_id: string
  user_id: string
  member_status: RelayMemberStatus
  joined_at: string | null
  left_at: string | null
  created_at: string
  updated_at: string
}


type RelayTeamSlotRow = {
  id: string
  team_id: string
  relay_slot_id: string
  slot_index: number
  assigned_user_id: string | null
  status: RelayTeamSlotStatus
  venue_id: string | null
  flow_session_id: string | null
  checked_in_at: string | null
  completed_at: string | null
  geo_verified: boolean
  created_at: string
  updated_at: string
}


type RelayTeamMemberProfileRow = {
  id: string
  username: string | null
  full_name: string | null
}


type RelayActiveLegVenueRow = {
  id: string
  name: string | null
  city: string | null
  address: string | null
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default async function RelayTeamPage({
  params,
}: RelayTeamPageProps) {
  const {
    teamId,
  } =
    await params


  const supabase =
    await createServerClient()


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  if (
    !user
  ) {
    redirect(
      '/competitions'
    )
  }

  const userId =
  user.id

  /* ==========================================================
   * TEAM
   * ========================================================== */

  const {
    data: teamData,
    error: teamError,
  } =
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
        teamId
      )
      .maybeSingle()


  if (
    teamError
  ) {
    console.error(
      '[relay/team] Team fetch failed:',
      teamError
    )
  }


  if (
    !teamData
  ) {
    notFound()
  }


  const team =
    teamData as RelayTeamRow


  /* ==========================================================
   * VIEWER AUTHORIZATION
   *
   * RLS remains authoritative, but this route also verifies the
   * viewer belongs to the private team before rendering team state.
   * ========================================================== */

  const {
    data: viewerMembershipData,
    error: viewerMembershipError,
  } =
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
        'team_id',
        team.id
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle()


  if (
    viewerMembershipError
  ) {
    console.error(
      '[relay/team] Viewer membership fetch failed:',
      viewerMembershipError
    )
  }


  const viewerMembership =
    viewerMembershipData as
      | RelayTeamMemberRow
      | null


  const viewerIsCaptain =
    team.captain_user_id ===
    user.id


  const viewerIsJoinedMember =
    viewerMembership
      ?.member_status ===
    'joined'


  if (
    !viewerIsCaptain &&
    !viewerIsJoinedMember
  ) {
    notFound()
  }


  /* ==========================================================
   * CANONICAL TEAM STATE
   * ========================================================== */

  const [
    relayResult,
    relaySlotsResult,
    membersResult,
    teamSlotsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'roam_relays'
        )
        .select(`
          id,
          title,
          description,
          city,
          theme,
          status,
          execution_mode,
          minimum_team_size,
          maximum_team_size,
          starts_at,
          ends_at,
          partner_campaign_id,
          created_at,
          updated_at
        `)
        .eq(
          'id',
          team.relay_id
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
          team.relay_id
        )
        .order(
          'slot_index',
          {
            ascending:
              true,
          }
        ),

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
          team.id
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
          team.id
        )
        .order(
          'slot_index',
          {
            ascending:
              true,
          }
        ),
    ])


  if (
    relayResult.error
  ) {
    console.error(
      '[relay/team] Relay fetch failed:',
      relayResult.error
    )
  }


  if (
    relaySlotsResult.error
  ) {
    console.error(
      '[relay/team] Relay slots fetch failed:',
      relaySlotsResult.error
    )
  }


  if (
    membersResult.error
  ) {
    console.error(
      '[relay/team] Team members fetch failed:',
      membersResult.error
    )
  }


  if (
    teamSlotsResult.error
  ) {
    console.error(
      '[relay/team] Team slots fetch failed:',
      teamSlotsResult.error
    )
  }


  if (
    !relayResult.data
  ) {
    notFound()
  }


  const relay =
    relayResult.data as RelayRow


  const relaySlots =
    (
      relaySlotsResult.data ??
      []
    ) as RelaySlotRow[]


  const members =
    (
      membersResult.data ??
      []
    ) as RelayTeamMemberRow[]


  const teamSlots =
    (
      teamSlotsResult.data ??
      []
    ) as RelayTeamSlotRow[]


  /* ==========================================================
   * DERIVED STATE
   * ========================================================== */

  const joinedMembers =
    members.filter(
      (
        member
      ) =>
        member.member_status ===
        'joined'
    )


  const invitedMembers =
    members.filter(
      (
        member
      ) =>
        member.member_status ===
        'invited'
    )


  const existingInviteUserIds =
    members
      .filter(
        (
          member
        ) =>
          member.member_status ===
            'joined' ||
          member.member_status ===
            'invited'
      )
      .map(
        (
          member
        ) =>
          member.user_id
      )


  const joinedMemberUserIds =
    joinedMembers.map(
      (
        member
      ) =>
        member.user_id
    )


  let joinedMemberProfiles:
    RelayTeamMemberProfileRow[] =
      []


  if (
    joinedMemberUserIds.length >
    0
  ) {
    const {
      data:
        joinedMemberProfilesData,
      error:
        joinedMemberProfilesError,
    } =
      await supabase
        .from(
          'profiles'
        )
        .select(`
          id,
          username,
          full_name
        `)
        .in(
          'id',
          joinedMemberUserIds
        )


    if (
      joinedMemberProfilesError
    ) {
      console.error(
        '[relay/team] Joined member profiles fetch failed:',
        joinedMemberProfilesError
      )
    }


    joinedMemberProfiles =
      (
        joinedMemberProfilesData ??
        []
      ) as RelayTeamMemberProfileRow[]
  }


  const joinedMemberProfileById =
    new Map(
      joinedMemberProfiles.map(
        (
          profile
        ) => [
          profile.id,
          profile,
        ]
      )
    )


  const assignableMembers:
    RelayAssignableMember[] =
      joinedMembers.map(
        (
          member
        ) => {
          const profile =
            joinedMemberProfileById.get(
              member.user_id
            ) ??
            null


          return {
            userId:
              member.user_id,

            username:
              profile?.username ??
              null,

            fullName:
              profile?.full_name ??
              null,

            isCaptain:
              member.user_id ===
              team.captain_user_id,
          }
        }
      )


  const assignedSlots =
    teamSlots.filter(
      (
        slot
      ) =>
        Boolean(
          slot.assigned_user_id
        )
    )


  const completedSlots =
    teamSlots.filter(
      (
        slot
      ) =>
        slot.status ===
        'completed'
    )


  const activeSlot =
    teamSlots.find(
      (
        slot
      ) =>
        slot.status ===
        'active'
    ) ??
    null


  const viewerSlot =
    teamSlots.find(
      (
        slot
      ) =>
        slot.assigned_user_id ===
        user.id
    ) ??
    null


  const activeRelaySlot =
    activeSlot
      ? relaySlots.find(
          (
            slot
          ) =>
            slot.id ===
            activeSlot.relay_slot_id
        ) ??
        null
      : null


  const activeLegVenueIds =
    Array.from(
      new Set(
        [
          activeSlot
            ?.venue_id ??
            null,

          activeRelaySlot
            ?.exact_venue_id ??
            null,

          ...(
            activeRelaySlot
              ?.eligible_venue_ids ??
            []
          ),
        ].filter(
          (
            venueId
          ): venueId is string =>
            typeof venueId ===
              'string' &&
            venueId.trim().length >
              0
        )
      )
    )


  let activeLegVenues:
    RelayActiveLegVenueOption[] =
      []


  if (
    activeRelaySlot
      ?.selection_mode ===
    'open'
  ) {
    const openVenueOptions =
      await getRelayVenueOptions(
        relay.city
      )


    activeLegVenues =
      openVenueOptions.map(
        (
          venue
        ) => ({
          id:
            venue.id,

          name:
            venue.name,

          city:
            venue.city,

          address:
            venue.neighborhood,

          category:
            venue.category,
        })
      )
  } else if (
    activeLegVenueIds.length >
    0
  ) {
    const {
      data:
        activeLegVenueData,
      error:
        activeLegVenueError,
    } =
      await supabase
        .from(
          'venues'
        )
        .select(`
          id,
          name,
          city,
          address
        `)
        .in(
          'id',
          activeLegVenueIds
        )


    if (
      activeLegVenueError
    ) {
      console.error(
        '[relay/team] Active Relay leg venues fetch failed:',
        activeLegVenueError
      )
    }


    activeLegVenues =
      (
        activeLegVenueData ??
        []
      )
        .map(
          (
            venue
          ) =>
            venue as RelayActiveLegVenueRow
        )
        .filter(
          (
            venue
          ) =>
            typeof venue.id ===
              'string' &&
            typeof venue.name ===
              'string' &&
            venue.name.trim().length >
              0
        )
        .map(
          (
            venue
          ) => ({
            id:
              venue.id,

            name:
              venue.name
                ?.trim() ??
              '',

            city:
              venue.city,

            address:
              venue.address,
          })
        )
  }


  const totalSlots =
    teamSlots.length >
      0
      ? teamSlots.length
      : relaySlots.length


  const teamReadyRequirementsMet =
    joinedMembers.length ===
      totalSlots &&
    assignedSlots.length ===
      totalSlots &&
    totalSlots >
      0


  const progressLabel =
    totalSlots >
      0
      ? `${completedSlots.length}/${totalSlots} legs complete`
      : 'No Relay legs'


  const headerRelay = {
    id:
      relay.id,

    title:
      relay.title,

    description:
      relay.description,

    city:
      relay.city,

    theme:
      relay.theme,

    status:
      relay.status,

    executionMode:
      relay.execution_mode,

    minTeamSize:
      relay.minimum_team_size,

    maxTeamSize:
      relay.maximum_team_size,

    startsAt:
      relay.starts_at,

    endsAt:
      relay.ends_at,

    partnerCampaignId:
      relay.partner_campaign_id,

    slots:
      relaySlots.map(
        (
          slot
        ) => ({
          id:
            slot.id,

          relayId:
            slot.relay_id,

          slotIndex:
            slot.slot_index,

          label:
            slot.label,

          prompt:
            slot.prompt,

          selectionMode:
            slot.selection_mode,

          categoryConstraint:
            slot.category_constraint,

          exactVenueId:
            slot.exact_venue_id,

          eligibleVenueIds:
            slot.eligible_venue_ids ??
            [],

          requiredGeoVerified:
            slot.required_geo_verified,

          createdAt:
            slot.created_at,

          updatedAt:
            slot.updated_at,
        })
      ),
  }


  /* ==========================================================
   * CONTROL ACTION WIRING
   * ========================================================== */

  async function assignTeamSlotFromControl(
    teamSlotId:
      string,
    assignedUserId:
      string | null
  ): Promise<void> {
    'use server'


    if (
      !assignedUserId
    ) {
      throw new Error(
        '[relay/team] A joined teammate is required for Relay leg assignment.'
      )
    }


    const teamSlot =
      teamSlots.find(
        (
          slot
        ) =>
          slot.id ===
          teamSlotId
      ) ??
      null


    if (
      !teamSlot
    ) {
      throw new Error(
        '[relay/team] Relay team slot was not found.'
      )
    }


    if (
      teamSlot.assigned_user_id ===
      assignedUserId
    ) {
      return
    }


    const existingUserSlot =
      teamSlots.find(
        (
          slot
        ) =>
          slot.id !==
            teamSlot.id &&
          slot.assigned_user_id ===
            assignedUserId
      ) ??
      null


    if (
      existingUserSlot
    ) {
      const currentAssignedUserId =
        teamSlot.assigned_user_id


      if (
        !currentAssignedUserId
      ) {
        throw new Error(
          '[relay/team] That teammate already owns another Relay leg. Assign an unassigned teammate to this leg first.'
        )
      }


      const assignments =
        teamSlots.map(
          (
            slot
          ) => {
            if (
              slot.id ===
              teamSlot.id
            ) {
              return {
                slotId:
                  slot.relay_slot_id,

                userId:
                  assignedUserId,
              }
            }


            if (
              slot.id ===
              existingUserSlot.id
            ) {
              return {
                slotId:
                  slot.relay_slot_id,

                userId:
                  currentAssignedUserId,
              }
            }


            if (
              !slot.assigned_user_id
            ) {
              throw new Error(
                '[relay/team] Atomic Relay assignment swap requires every Relay leg to already have an assigned teammate.'
              )
            }


            return {
              slotId:
                slot.relay_slot_id,

              userId:
                slot.assigned_user_id,
            }
          }
        )


      await assignRelayTeamSlots(
        team.id as Parameters<
          typeof assignRelayTeamSlots
        >[0],

        assignments as Parameters<
          typeof assignRelayTeamSlots
        >[1]
      )
    } else {
      await assignRelayTeamSlot(
        team.id as Parameters<
          typeof assignRelayTeamSlot
        >[0],

        teamSlot
          .relay_slot_id as Parameters<
            typeof assignRelayTeamSlot
          >[1],

        assignedUserId as Parameters<
          typeof assignRelayTeamSlot
        >[2]
      )
    }


    revalidatePath(
      `/competitions/team/${team.id}`
    )
  }


  async function readyTeamFromControl(
    requestedTeamId:
      string
  ): Promise<void> {
    'use server'


    if (
      requestedTeamId !==
      team.id
    ) {
      throw new Error(
        '[relay/team] Relay team identity mismatch.'
      )
    }


    await setRelayTeamReady(
      requestedTeamId as Parameters<
        typeof setRelayTeamReady
      >[0]
    )


    revalidatePath(
      `/competitions/team/${team.id}`
    )
  }


  async function startTeamFromControl(
    requestedTeamId:
      string
  ): Promise<void> {
    'use server'


    if (
      requestedTeamId !==
      team.id
    ) {
      throw new Error(
        '[relay/team] Relay team identity mismatch.'
      )
    }


    await startRelayTeam(
      requestedTeamId as Parameters<
        typeof startRelayTeam
      >[0]
    )


    revalidatePath(
      `/competitions/team/${team.id}`
    )
  }


  async function startActiveLegFromControl(
    requestedTeamSlotId:
      string,
    venueId:
      string
  ): Promise<{
    sessionId:
      string
  }> {
    'use server'


    if (
      !activeSlot
    ) {
      throw new Error(
        '[relay/team] No active Relay baton is available.'
      )
    }


    if (
      requestedTeamSlotId !==
      activeSlot.id
    ) {
      throw new Error(
        '[relay/team] Relay team slot is no longer the active baton.'
      )
    }


    if (
  activeSlot.assigned_user_id !==
  userId
  ) {
      throw new Error(
        '[relay/team] Only the teammate holding the active Relay baton may start this leg.'
      )
    }


    const result =
      await startRelaySlotFlow(
        requestedTeamSlotId as Parameters<
          typeof startRelaySlotFlow
        >[0],

        venueId as Parameters<
          typeof startRelaySlotFlow
        >[1]
      )


    revalidatePath(
      `/competitions/team/${team.id}`
    )


    return {
      sessionId:
        result.sessionId,
    }
  }


  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        {/* ====================================================
         * SHARED RELAY HEADER
         * ==================================================== */}

        <RelayDetailHeader
          relay={
            headerRelay
          }
          context={{
            label:
              getTeamContextLabel(
                team.status
              ),

            tone:
              getTeamContextTone(
                team.status
              ),
          }}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ShareRelayTeamButton
                teamId={
                  team.id as Parameters<
                    typeof ShareRelayTeamButton
                  >[0]['teamId']
                }
                relayTitle={
                  relay.title
                }
              />

              <Link
                href={
                  `/competitions/${relay.id}`
                }
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
              >
                View Relay
              </Link>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
            <span>
              {progressLabel}
            </span>

            <span>
              {joinedMembers.length}{' '}
              joined
            </span>

            {invitedMembers.length >
            0 ? (
              <span>
                {invitedMembers.length}{' '}
                invited
              </span>
            ) : null}

            {viewerIsCaptain ? (
              <span className="font-bold text-amber-200/70">
                You are captain
              </span>
            ) : null}
          </div>
        </RelayDetailHeader>

        {/* ====================================================
         * PRIMARY TEAM STATE
         * ==================================================== */}

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-px w-5 bg-cyan-300/60" />

                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                    Team progress
                  </p>
                </div>

                <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                  {getTeamStateTitle(
                    team.status
                  )}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                  {getTeamStateDescription(
                    team.status
                  )}
                </p>
              </div>

              <TeamStatusBadge
                status={
                  team.status
                }
              />
            </div>


            <dl className="mt-6 grid gap-2 sm:grid-cols-4">
              <TeamMetric
                label="Teammates"
                value={`${joinedMembers.length}/${totalSlots}`}
              />

              <TeamMetric
                label="Legs assigned"
                value={`${assignedSlots.length}/${totalSlots}`}
              />

              <TeamMetric
                label="Legs finished"
                value={`${completedSlots.length}/${totalSlots}`}
              />

              <TeamMetric
                label="Ready to start"
                value={
                  teamReadyRequirementsMet
                    ? 'Yes'
                    : 'Not yet'
                }
              />
            </dl>
          </section>

          {/* ==================================================
           * VIEWER STATE
           * ================================================== */}

          <aside className="rounded-[1.75rem] bg-violet-300/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-violet-300/12">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Your Relay
              </p>
            </div>

            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
              {viewerIsCaptain
                ? 'Team captain'
                : 'Team member'}
            </h2>

            {viewerSlot ? (
              <>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Your assigned leg is{' '}
                  {viewerSlot.slot_index}.
                </p>

                <div className="mt-5 rounded-[1.1rem] bg-black/20 p-4 ring-1 ring-white/[0.055]">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-700">
                    Your leg
                  </p>

                  <p className="mt-1.5 text-sm font-black text-white">
                    {getRelaySlotLabel(
                      viewerSlot,
                      relaySlots
                    )}
                  </p>

                  <p className="mt-1 text-xs capitalize leading-5 text-zinc-600">
                    {formatStatus(
                      viewerSlot.status
                    )}
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                You do not have a Relay leg assigned yet.
              </p>
            )}

            {activeSlot ? (
              <div className="mt-4 rounded-[1.1rem] bg-emerald-300/[0.035] p-4 ring-1 ring-emerald-300/12">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100/55">
                  Current turn
                </p>

                <p className="mt-1.5 text-sm font-black text-white">
                  Leg {activeSlot.slot_index} is up now
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  {activeSlot.assigned_user_id ===
                  user.id
                    ? 'It’s your turn to complete this leg.'
                    : 'It’s another teammate’s turn right now.'}
                </p>
              </div>
            ) : null}
          </aside>
        </div>

{/* ====================================================
         * TEAM LIFECYCLE CONTROLS
         * ==================================================== */}

        <div className="mt-8">
          <RelayTeamLifecycleControls
            teamId={
              team.id
            }
            status={
              team.status
            }
            viewerIsCaptain={
              viewerIsCaptain
            }
            teamReadyRequirementsMet={
              teamReadyRequirementsMet
            }
            joinedMemberCount={
              joinedMembers.length
            }
            requiredMemberCount={
              totalSlots
            }
            assignedSlotCount={
              assignedSlots.length
            }
            totalSlotCount={
              totalSlots
            }
            activeSlotIndex={
              activeSlot
                ?.slot_index ??
              null
            }
            viewerOwnsActiveSlot={
              activeSlot
                ?.assigned_user_id ===
              user.id
            }
            viewerHasAssignedSlot={
              Boolean(
                viewerSlot
              )
            }
            onReadyTeam={
              readyTeamFromControl
            }
            onStartTeam={
              startTeamFromControl
            }
          />
        </div>


        {team.status ===
        'completed' ? (
          <div className="mt-4">
            <Link
              href={
                `/competitions/team/${team.id}/complete`
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
            >
              See your completed Relay
            </Link>
          </div>
        ) : null}

        {/* ====================================================
         * BATON / EXECUTION
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Current turn
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                {activeSlot
                  ? `Leg ${activeSlot.slot_index} is up now`
                  : getNoActiveBatonTitle(
                      team.status
                    )}
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-zinc-500">
              Your team completes the Relay one leg at a time. When one
              teammate finishes, the next teammate gets their turn.
            </p>
          </div>


          {activeSlot ? (
            <>
              <div className="mt-5 rounded-[1.2rem] bg-emerald-300/[0.035] p-5 ring-1 ring-emerald-300/12">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/55">
                      Current leg
                    </p>

                    <h3 className="mt-2 text-lg font-black text-white">
                      {getRelaySlotLabel(
                        activeSlot,
                        relaySlots
                      )}
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      {activeSlot.assigned_user_id ===
                      user.id
                        ? 'It’s your turn. Start this leg when you’re ready.'
                        : 'Waiting for the assigned teammate to finish this leg.'}
                    </p>
                  </div>

                  <span className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-emerald-300/[0.06] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/70 ring-1 ring-emerald-300/15">
                    In progress
                  </span>
                </div>
              </div>


              {activeRelaySlot ? (
                <div className="mt-5">
                  <RelayActiveLegLauncher
                    teamSlotId={
                      activeSlot.id
                    }
                    slotIndex={
                      activeSlot.slot_index
                    }
                    slotLabel={
                      getRelaySlotLabel(
                        activeSlot,
                        relaySlots
                      )
                    }
                    selectionMode={
                      activeRelaySlot.selection_mode
                    }
                    categoryConstraint={
                      activeRelaySlot.category_constraint
                    }
                    exactVenueId={
                      activeRelaySlot.exact_venue_id
                    }
                    eligibleVenueIds={
                      activeRelaySlot.eligible_venue_ids ??
                      []
                    }
                    selectedVenueId={
                      activeSlot.venue_id
                    }
                    venues={
                      activeLegVenues
                    }
                    viewerOwnsActiveSlot={
                      activeSlot.assigned_user_id ===
                      user.id
                    }
                    existingFlowSessionId={
                      activeSlot.flow_session_id
                    }
                    onStart={
                      startActiveLegFromControl
                    }
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-[1.2rem] bg-black/20 p-5 text-sm leading-6 text-zinc-500 ring-1 ring-white/[0.055]">
              {getNoActiveBatonDescription(
                team.status
              )}
            </div>
          )}
        </section>


        {/* ====================================================
         * ROSTER
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Your team
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                {joinedMembers.length} teammate
                {joinedMembers.length ===
                1
                  ? ''
                  : 's'}{' '}
                joined
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-zinc-500">
              Each Relay leg needs one teammate before your team can
              start.
            </p>
          </div>


          {viewerIsCaptain ? (
            <div className="mt-5">
              <RelayTeamInviteUser
                teamId={
                  team.id
                }
                currentUserId={
                  user.id
                }
                existingUserIds={
                  existingInviteUserIds
                }
              />
            </div>
          ) : null}


          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {members.map(
              (
                member
              ) => {
                const assignedSlot =
                  teamSlots.find(
                    (
                      slot
                    ) =>
                      slot.assigned_user_id ===
                      member.user_id
                  ) ??
                  null

                return (
                  <RosterMemberCard
                    key={
                      member.id
                    }
                    member={
                      member
                    }
                    isCaptain={
                      member.user_id ===
                      team.captain_user_id
                    }
                    isViewer={
                      member.user_id ===
                      user.id
                    }
                    assignedSlot={
                      assignedSlot
                    }
                    relaySlots={
                      relaySlots
                    }
                  />
                )
              }
            )}
          </div>
        </section>


        {/* ====================================================
         * MATERIALIZED TEAM ROUTE
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Team route
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                Who&apos;s doing each leg
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-zinc-500">
              See every leg in order, who it belongs to, and how far
              your team has progressed.
            </p>
          </div>


          {teamSlots.length >
          0 ? (
            <ol className="mt-5 space-y-3">
              {teamSlots.map(
                (
                  slot
                ) => (
                  <TeamSlotCard
                    key={
                      slot.id
                    }
                    slot={
                      slot
                    }
                    relaySlots={
                      relaySlots
                    }
                    isViewerSlot={
                      slot.assigned_user_id ===
                      user.id
                    }
                    isCaptainSlot={
                      slot.assigned_user_id ===
                      team.captain_user_id
                    }
                    canAssign={
                      viewerIsCaptain &&
                      team.status ===
                        'forming'
                    }
                    assignableMembers={
                      assignableMembers
                    }
                    onAssign={
                      assignTeamSlotFromControl
                    }
                  />
                )
              )}
            </ol>
          ) : (
            <div className="mt-5 rounded-[1.2rem] border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-zinc-600">
              Your team&apos;s Relay legs are not available yet.
            </div>
          )}
        </section>

        {/* ====================================================
         * TEAM TIMELINE
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-cyan-300/60" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Team timeline
            </p>
          </div>

          <dl className="mt-5 grid gap-2 sm:grid-cols-4">
            <TeamMetric
              label="Team created"
              value={
                formatDate(
                  team.created_at
                )
              }
            />

            <TeamMetric
              label="Ready"
              value={
                formatDate(
                  team.opted_in_at
                )
              }
            />

            <TeamMetric
              label="Started"
              value={
                formatDate(
                  team.started_at
                )
              }
            />

            <TeamMetric
              label="Finished"
              value={
                formatDate(
                  team.completed_at
                )
              }
            />
          </dl>
        </section>


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        <footer className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-zinc-700">
            Your team&apos;s progress is saved as you go. Roam checks
            assignments, check-ins, and completed legs before moving
            the Relay forward.
          </p>
        </footer>
      </div>
    </main>
  )
}


/* ============================================================
 * ROSTER CARD
 * ============================================================
 */

function RosterMemberCard({
  member,
  isCaptain,
  isViewer,
  assignedSlot,
  relaySlots,
}: {
  member:
    RelayTeamMemberRow

  isCaptain:
    boolean

  isViewer:
    boolean

  assignedSlot:
    RelayTeamSlotRow | null

  relaySlots:
    RelaySlotRow[]
}) {
  return (
    <article className="rounded-[1.2rem] bg-black/20 p-4 ring-1 ring-white/[0.055]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-white">
              {isViewer
                ? 'You'
                : isCaptain
                  ? 'Captain'
                  : 'Teammate'}
            </p>

            {isCaptain ? (
              <span className="rounded-full bg-amber-300/[0.045] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100/65 ring-1 ring-amber-300/12">
                Captain
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs capitalize text-zinc-600">
            {formatStatus(
              member.member_status
            )}
          </p>
        </div>

        <MemberStatusDot
          status={
            member.member_status
          }
        />
      </div>


      <div className="mt-4 border-t border-white/[0.06] pt-3">
        {assignedSlot ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">
              Their leg
            </p>

            <p className="mt-1 text-sm font-bold text-zinc-300">
              {getRelaySlotLabel(
                assignedSlot,
                relaySlots
              )}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-700">
            No leg assigned yet
          </p>
        )}
      </div>
    </article>
  )
}


/* ============================================================
 * TEAM SLOT CARD
 * ============================================================
 */

function TeamSlotCard({
  slot,
  relaySlots,
  isViewerSlot,
  isCaptainSlot,
  canAssign,
  assignableMembers,
  onAssign,
}: {
  slot:
    RelayTeamSlotRow

  relaySlots:
    RelaySlotRow[]

  isViewerSlot:
    boolean

  isCaptainSlot:
    boolean

  canAssign:
    boolean

  assignableMembers:
    RelayAssignableMember[]

  onAssign:
    (
      teamSlotId:
        string,
      userId:
        string | null
    ) =>
      Promise<void>
}) {
  const templateSlot =
    relaySlots.find(
      (
        candidate
      ) =>
        candidate.id ===
        slot.relay_slot_id
    ) ??
    null


  const slotLabel =
    templateSlot
      ?.label ??
    `Relay leg ${slot.slot_index}`


  return (
    <li className="rounded-[1.2rem] bg-black/20 p-4 ring-1 ring-white/[0.055] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-700">
              Leg {slot.slot_index}
            </span>

            <TeamSlotStatusBadge
              status={
                slot.status
              }
            />

            {slot.geo_verified ? (
              <span className="rounded-full bg-emerald-300/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-100/65 ring-1 ring-emerald-300/12">
                Check-in verified
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 text-lg font-black text-white">
            {slotLabel}
          </h3>

          {templateSlot
            ?.prompt ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">
              {
                templateSlot.prompt
              }
            </p>
          ) : null}


          <div className="mt-3 flex flex-wrap gap-2">
            <SmallChip
              value={
                getSlotAssignmentLabel({
                  assigned:
                    Boolean(
                      slot.assigned_user_id
                    ),

                  isViewerSlot,

                  isCaptainSlot,
                })
              }
            />

            {templateSlot ? (
              <SmallChip
                value={
                  formatSelectionMode(
                    templateSlot.selection_mode
                  )
                }
              />
            ) : null}

            {slot.venue_id ? (
              <SmallChip
                value="Venue chosen"
              />
            ) : null}
          </div>
        </div>


        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">
            Finished
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {formatDate(
              slot.completed_at
            )}
          </p>
        </div>
      </div>


      {canAssign ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <RelayTeamSlotAssignmentControl
            teamSlotId={
              slot.id
            }
            slotIndex={
              slot.slot_index
            }
            slotLabel={
              slotLabel
            }
            assignedUserId={
              slot.assigned_user_id
            }
            members={
              assignableMembers
            }
            onAssign={
              onAssign
            }
            allowUnassign={
              false
            }
          />
        </div>
      ) : null}
    </li>
  )
}


/* ============================================================
 * STATUS COMPONENTS
 * ============================================================
 */

function TeamStatusBadge({
  status,
}: {
  status:
    RelayTeamStatus
}) {
  const className =
    status ===
    'active'
      ? 'bg-emerald-300/[0.05] text-emerald-100/70 ring-emerald-300/16'
      : status ===
          'ready'
        ? 'bg-amber-300/[0.05] text-amber-100/70 ring-amber-300/16'
        : status ===
            'completed'
          ? 'bg-violet-300/[0.05] text-violet-100/70 ring-violet-300/16'
          : status ===
                'abandoned' ||
              status ===
                'disqualified'
            ? 'bg-red-300/[0.04] text-red-100/60 ring-red-300/14'
            : 'bg-white/[0.03] text-zinc-500 ring-white/[0.08]'


  return (
    <span
      className={[
        'inline-flex',
        'min-h-8',
        'items-center',
        'justify-center',
        'rounded-full',
        'px-3',
        'text-[10px]',
        'font-bold',
        'uppercase',
        'tracking-[0.14em]',
        'ring-1',
        className,
      ].join(' ')}
    >
      {formatStatus(
        status
      )}
    </span>
  )
}


function TeamSlotStatusBadge({
  status,
}: {
  status:
    RelayTeamSlotStatus
}) {
  const className =
    status ===
    'active'
      ? 'bg-emerald-300/[0.045] text-emerald-100/65 ring-emerald-300/14'
      : status ===
          'completed'
        ? 'bg-violet-300/[0.045] text-violet-100/65 ring-violet-300/14'
        : status ===
            'skipped'
          ? 'bg-red-300/[0.035] text-red-100/55 ring-red-300/12'
          : 'bg-white/[0.025] text-zinc-600 ring-white/[0.07]'


  return (
    <span
      className={[
        'rounded-full',
        'px-2',
        'py-0.5',
        'text-[9px]',
        'font-bold',
        'uppercase',
        'tracking-[0.12em]',
        'ring-1',
        className,
      ].join(' ')}
    >
      {formatStatus(
        status
      )}
    </span>
  )
}


function MemberStatusDot({
  status,
}: {
  status:
    RelayMemberStatus
}) {
  const className =
    status ===
    'joined'
      ? 'bg-emerald-300'
      : status ===
          'invited'
        ? 'bg-amber-300'
        : 'bg-white/20'


  return (
    <span
      aria-label={
        formatStatus(
          status
        )
      }
      title={
        formatStatus(
          status
        )
      }
      className={[
        'mt-1',
        'h-2',
        'w-2',
        'shrink-0',
        'rounded-full',
        className,
      ].join(' ')}
    />
  )
}


/* ============================================================
 * METRIC
 * ============================================================
 */

function TeamMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-0 rounded-[1.1rem] bg-black/20 px-4 py-4 ring-1 ring-white/[0.055]">
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-700">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-black text-zinc-300">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * SMALL CHIP
 * ============================================================
 */

function SmallChip({
  value,
}: {
  value:
    string
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-zinc-500 ring-1 ring-white/[0.06]">
      {value}
    </span>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getRelaySlotLabel(
  teamSlot:
    RelayTeamSlotRow,
  relaySlots:
    RelaySlotRow[]
): string {
  const templateSlot =
    relaySlots.find(
      (
        slot
      ) =>
        slot.id ===
        teamSlot.relay_slot_id
    )


  return (
    templateSlot
      ?.label ??
    `Relay leg ${teamSlot.slot_index}`
  )
}


function getSlotAssignmentLabel({
  assigned,
  isViewerSlot,
  isCaptainSlot,
}: {
  assigned:
    boolean

  isViewerSlot:
    boolean

  isCaptainSlot:
    boolean
}): string {
  if (
    !assigned
  ) {
    return 'Needs a teammate'
  }

  if (
    isViewerSlot
  ) {
    return 'Your leg'
  }

  if (
    isCaptainSlot
  ) {
    return 'Captain’s leg'
  }

  return 'Teammate assigned'
}


function formatSelectionMode(
  value:
    RelaySlotSelectionMode
): string {
  switch (
    value
  ) {
    case 'open':
      return 'Choose any venue'

    case 'category':
      return 'Choose by category'

    case 'venue_pool':
      return 'Choose from the list'

    case 'exact_venue':
      return 'Specific venue'
  }
}


function formatStatus(
  value:
    string
): string {
  return value
    .replace(
      /_/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    )
}


function formatDate(
  value:
    string | null
): string {
  if (
    !value
  ) {
    return '—'
  }


  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }


  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',

      hour:
        'numeric',

      minute:
        '2-digit',
    }
  ).format(
    date
  )
}


function getTeamContextLabel(
  status:
    RelayTeamStatus
): string {
  switch (
    status
  ) {
    case 'forming':
      return 'Building your team'

    case 'ready':
      return 'Ready to start'

    case 'active':
      return 'Relay in progress'

    case 'completed':
      return 'Relay complete'

    case 'abandoned':
      return 'Relay ended'

    case 'disqualified':
      return 'Team disqualified'
  }
}


function getTeamContextTone(
  status:
    RelayTeamStatus
):
  | 'neutral'
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'red' {
  switch (
    status
  ) {
    case 'forming':
      return 'neutral'

    case 'ready':
      return 'amber'

    case 'active':
      return 'emerald'

    case 'completed':
      return 'violet'

    case 'abandoned':
    case 'disqualified':
      return 'red'
  }
}


function getTeamStateTitle(
  status:
    RelayTeamStatus
): string {
  switch (
    status
  ) {
    case 'forming':
      return 'Add your teammates and give everyone a leg.'

    case 'ready':
      return 'Your team is ready to go.'

    case 'active':
      return 'Your Relay is underway.'

    case 'completed':
      return 'Your team finished the Relay.'

    case 'abandoned':
      return 'This Relay has ended for your team.'

    case 'disqualified':
      return 'This team can no longer continue.'
  }
}


function getTeamStateDescription(
  status:
    RelayTeamStatus
): string {
  switch (
    status
  ) {
    case 'forming':
      return 'Make sure every leg has one teammate assigned. Once everyone has a leg, your team can get ready to start.'

    case 'ready':
      return 'Everyone has a leg and your team is set. The captain can start the Relay when you’re ready.'

    case 'active':
      return 'Complete the route one leg at a time. When a teammate finishes their leg, the next teammate gets their turn.'

    case 'completed':
      return 'Your team finished every required leg and completed the route together.'

    case 'abandoned':
      return 'This team is no longer taking part in the Relay.'

    case 'disqualified':
      return 'This team cannot continue in the Relay or receive a competition result.'
  }
}


function getNoActiveBatonTitle(
  status:
    RelayTeamStatus
): string {
  switch (
    status
  ) {
    case 'forming':
      return 'Finish setting up your team.'

    case 'ready':
      return 'Ready for the first leg.'

    case 'active':
      return 'Waiting for the next leg.'

    case 'completed':
      return 'Your team reached the finish.'

    case 'abandoned':
      return 'The Relay has stopped.'

    case 'disqualified':
      return 'This Relay can’t continue.'
  }
}


function getNoActiveBatonDescription(
  status:
    RelayTeamStatus
): string {
  switch (
    status
  ) {
    case 'forming':
      return 'Add the remaining teammates and make sure every leg is assigned before your team starts.'

    case 'ready':
      return 'Your team is ready. The first leg will appear here once the Relay starts.'

    case 'active':
      return 'The Relay is in progress, but the next leg is not available yet. Refresh the page in a moment.'

    case 'completed':
      return 'Your team has finished every required Relay leg.'

    case 'abandoned':
      return 'This team is no longer taking part in the Relay.'

    case 'disqualified':
      return 'This team can no longer continue in the Relay.'
  }
}