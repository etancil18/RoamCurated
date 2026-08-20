// app/relay/team/[teamId]/complete/page.tsx

import Link from 'next/link'

import {
  notFound,
  redirect,
} from 'next/navigation'

import RelayCompletionSummary from '@/components/relay/RelayCompletionSummary'
import RelayDetailHeader from '@/components/relay/RelayDetailHeader'

import {
  createServerClient,
} from '@/lib/supabase/server'


export const dynamic =
  'force-dynamic'


/* ============================================================
 * ROUTE CONTRACT
 * ============================================================
 */

type RelayCompletionPageProps = {
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
  id:
    string

  title:
    string

  description:
    string | null

  city:
    string

  theme:
    string | null

  status:
    RelayStatus

  execution_mode:
    'sequential'

  minimum_team_size:
    number

  maximum_team_size:
    number

  starts_at:
    string | null

  ends_at:
    string | null

  partner_campaign_id:
    string | null

  created_at:
    string

  updated_at:
    string
}


type RelaySlotRow = {
  id:
    string

  relay_id:
    string

  slot_index:
    number

  label:
    string

  prompt:
    string

  selection_mode:
    RelaySlotSelectionMode

  category_constraint:
    string | null

  exact_venue_id:
    string | null

  eligible_venue_ids:
    string[] | null

  required_geo_verified:
    boolean

  created_at:
    string

  updated_at:
    string
}


type RelayTeamRow = {
  id:
    string

  relay_id:
    string

  captain_user_id:
    string

  status:
    RelayTeamStatus

  opted_in_at:
    string | null

  started_at:
    string | null

  completed_at:
    string | null

  created_at:
    string

  updated_at:
    string
}


type RelayTeamMemberRow = {
  id:
    string

  team_id:
    string

  user_id:
    string

  member_status:
    RelayMemberStatus

  joined_at:
    string | null

  left_at:
    string | null

  created_at:
    string

  updated_at:
    string
}


type RelayTeamSlotRow = {
  id:
    string

  team_id:
    string

  relay_slot_id:
    string

  slot_index:
    number

  assigned_user_id:
    string | null

  status:
    RelayTeamSlotStatus

  venue_id:
    string | null

  flow_session_id:
    string | null

  checked_in_at:
    string | null

  completed_at:
    string | null

  geo_verified:
    boolean

  created_at:
    string

  updated_at:
    string
}


type RelayVenueRow = {
  id:
    string

  name:
    string | null

  city:
    string | null

  address:
    string | null
}


type RelayParticipantProfileRow = {
  id:
    string

  username:
    string | null

  full_name:
    string | null
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default async function RelayCompletionPage({
  params,
}: RelayCompletionPageProps) {
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
      '[relay/complete] Team fetch failed:',
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
      '[relay/complete] Viewer membership fetch failed:',
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
   * COMPLETION GATE
   * ========================================================== */

  if (
    team.status !==
    'completed'
  ) {
    redirect(
      `/competitions/team/${team.id}`
    )
  }


  /* ==========================================================
   * CANONICAL COMPLETED STATE
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
      '[relay/complete] Relay fetch failed:',
      relayResult.error
    )
  }


  if (
    relaySlotsResult.error
  ) {
    console.error(
      '[relay/complete] Relay slots fetch failed:',
      relaySlotsResult.error
    )
  }


  if (
    membersResult.error
  ) {
    console.error(
      '[relay/complete] Members fetch failed:',
      membersResult.error
    )
  }


  if (
    teamSlotsResult.error
  ) {
    console.error(
      '[relay/complete] Team slots fetch failed:',
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
   * COMPLETION PRESENTATION DATA
   *
   * Resolve the canonical venue IDs and teammate IDs already
   * attached to completed Relay legs into human-readable labels.
   *
   * These reads are presentation-only and do not alter Relay
   * completion state or evidence.
   * ========================================================== */

  const completedVenueIds =
    Array.from(
      new Set(
        teamSlots
          .map(
            (
              slot
            ) =>
              slot.venue_id
          )
          .filter(
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


  const participantUserIds =
    Array.from(
      new Set(
        teamSlots
          .map(
            (
              slot
            ) =>
              slot.assigned_user_id
          )
          .filter(
            (
              userId
            ): userId is string =>
              typeof userId ===
                'string' &&
              userId.trim().length >
                0
          )
      )
    )


  let venueRows:
    RelayVenueRow[] =
      []


  let participantProfiles:
    RelayParticipantProfileRow[] =
      []


  const [
    venuePresentationResult,
    participantPresentationResult,
  ] =
    await Promise.all([
      completedVenueIds.length >
        0
        ? supabase
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
              completedVenueIds
            )
        : Promise.resolve({
            data:
              [],
            error:
              null,
          }),

      participantUserIds.length >
        0
        ? supabase
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
              participantUserIds
            )
        : Promise.resolve({
            data:
              [],
            error:
              null,
          }),
    ])


  if (
    venuePresentationResult.error
  ) {
    console.error(
      '[relay/complete] Venue presentation fetch failed:',
      venuePresentationResult.error
    )
  } else {
    venueRows =
      (
        venuePresentationResult.data ??
        []
      ) as RelayVenueRow[]
  }


  if (
    participantPresentationResult.error
  ) {
    console.error(
      '[relay/complete] Participant presentation fetch failed:',
      participantPresentationResult.error
    )
  } else {
    participantProfiles =
      (
        participantPresentationResult.data ??
        []
      ) as RelayParticipantProfileRow[]
  }


  const venueById =
    new Map(
      venueRows.map(
        (
          venue
        ) => [
          venue.id,
          venue,
        ]
      )
    )


  const participantProfileById =
    new Map(
      participantProfiles.map(
        (
          profile
        ) => [
          profile.id,
          profile,
        ]
      )
    )


  /* ==========================================================
   * COMPLETION INTEGRITY
   *
   * The team itself is canonical authority for completion.
   * We still surface inconsistent slot state rather than silently
   * pretending every leg has a valid completed projection.
   * ========================================================== */

  const orderedTeamSlots =
    [...teamSlots].sort(
      (
        left,
        right
      ) =>
        left.slot_index -
        right.slot_index
    )


  const completedTeamSlots =
    orderedTeamSlots.filter(
      (
        slot
      ) =>
        slot.status ===
        'completed'
    )


  const skippedTeamSlots =
    orderedTeamSlots.filter(
      (
        slot
      ) =>
        slot.status ===
        'skipped'
    )


  const unresolvedTeamSlots =
    orderedTeamSlots.filter(
      (
        slot
      ) =>
        slot.status !==
          'completed' &&
        slot.status !==
          'skipped'
    )


  const integrityExceptionSlots =
    orderedTeamSlots.filter(
      (
        slot
      ) =>
        slot.status !==
        'completed'
    )


  const geoVerifiedCompletedSlots =
    completedTeamSlots.filter(
      (
        slot
      ) =>
        slot.geo_verified
    )


  const totalSlots =
    orderedTeamSlots.length >
      0
      ? orderedTeamSlots.length
      : relaySlots.length


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
   * COMPLETION SUMMARY
   * ========================================================== */

  const completionSummaryStops =
    completedTeamSlots.map(
      (
        teamSlot
      ) => {
        const relaySlot =
          relaySlots.find(
            (
              slot
            ) =>
              slot.id ===
              teamSlot.relay_slot_id
          ) ??
          null


        const member =
          teamSlot.assigned_user_id
            ? members.find(
                (
                  candidate
                ) =>
                  candidate.user_id ===
                  teamSlot.assigned_user_id
              ) ??
              null
            : null


        const contributorPresentation =
          getContributorPresentation({
            userId:
              teamSlot.assigned_user_id,

            viewerUserId:
              user.id,

            captainUserId:
              team.captain_user_id,

            member,
          })


        const participantProfile =
          teamSlot.assigned_user_id
            ? participantProfileById.get(
                teamSlot.assigned_user_id
              ) ??
              null
            : null


        const venue =
          teamSlot.venue_id
            ? venueById.get(
                teamSlot.venue_id
              ) ??
              null
            : null


        return {
          id:
            teamSlot.id,

          slotIndex:
            teamSlot.slot_index,

          label:
            relaySlot
              ?.label ??
            `Relay leg ${teamSlot.slot_index}`,

          prompt:
            relaySlot
              ?.prompt ??
            null,

          contributorLabel:
            getParticipantName({
              profile:
                participantProfile,

              fallback:
                contributorPresentation.label,
            }),

          contributorSecondaryLabel:
            contributorPresentation.secondaryLabel,

          contributorIsCaptain:
            contributorPresentation.isCaptain,

          contributorIsViewer:
            contributorPresentation.isViewer,

          venueId:
            teamSlot.venue_id,

          venueLabel:
            venue?.name
              ?.trim() ||
            (
              teamSlot.venue_id
                ? 'Relay venue'
                : 'Completed Relay stop'
            ),

          venueSecondaryLabel:
            getVenueLocationLabel(
              venue
            ) ??
            (
              teamSlot.geo_verified
                ? 'Check-in verified'
                : null
            ),

          completedAt:
            teamSlot.completed_at,

          checkedInAt:
            teamSlot.checked_in_at,

          geoVerified:
            teamSlot.geo_verified,

          requiredGeoVerified:
            relaySlot
              ?.required_geo_verified ??
            true,
        }
      }
    )


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
         * HEADER
         * ==================================================== */}

        <RelayDetailHeader
          relay={
            headerRelay
          }
          context={{
            label:
              'Team completed',

            tone:
              'violet',
          }}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={
                  `/competitions/team/${team.id}`
                }
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
              >
                Team hub
              </Link>

              <Link
                href={
                  `/competitions/${relay.id}`
                }
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-violet-300/[0.055] px-4 text-xs font-bold text-violet-100/80 ring-1 ring-violet-300/15 transition hover:bg-violet-300/[0.09] hover:text-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
              >
                View Relay
              </Link>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
            <span>
              {completedTeamSlots.length}
              {' / '}
              {totalSlots}
              {' completed'}
            </span>

            <span>
              {geoVerifiedCompletedSlots.length}
              {' verified'}
            </span>

            {skippedTeamSlots.length >
            0 ? (
              <span>
                {skippedTeamSlots.length}
                {' skipped'}
              </span>
            ) : null}

            {team.completed_at ? (
              <span>
                Finished{' '}
                {
                  formatDateTime(
                    team.completed_at
                  )
                }
              </span>
            ) : null}
          </div>
        </RelayDetailHeader>


        {/* ====================================================
         * COMPLETION HERO
         * ==================================================== */}

        <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-300/[0.08] via-white/[0.035] to-cyan-300/[0.025] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] ring-1 ring-violet-300/14 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/30 to-transparent" />

            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-300/[0.06] blur-[100px]" />

            <div className="absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-cyan-300/[0.045] blur-[100px]" />
          </div>

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center rounded-full bg-emerald-300/[0.07] px-3 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100/80 ring-1 ring-emerald-300/16">
                Relay complete
              </span>

              <span className="inline-flex min-h-7 items-center rounded-full bg-white/[0.035] px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 ring-1 ring-white/[0.07]">
                {relay.city}
              </span>
            </div>

            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
              Your team carried the baton all the way through.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Here&apos;s the finished route: every teammate, every
              completed leg, and every venue your team visited along
              the way.
            </p>

            <dl className="mt-6 grid gap-2 sm:grid-cols-3">
              <CompletionMetric
                label="Legs completed"
                value={`${completedTeamSlots.length}/${totalSlots}`}
              />

              <CompletionMetric
                label="Verified visits"
                value={`${geoVerifiedCompletedSlots.length}`}
              />

              <CompletionMetric
                label="Finished"
                value={
                  formatDateTime(
                    team.completed_at
                  )
                }
              />
            </dl>
          </div>
        </section>


        {/* ====================================================
         * COLLABORATIVE COMPLETION SUMMARY
         * ==================================================== */}

        <div className="mt-8">
          <RelayCompletionSummary
            teamId={
              team.id
            }
            relayId={
              relay.id
            }
            relayTitle={
              relay.title
            }
            relayCity={
              relay.city
            }
            relayTheme={
              relay.theme
            }
            stops={
              completionSummaryStops
            }
            completedAt={
              team.completed_at
            }
            title="Your team’s finished route"
            description="Each leg shows who carried the baton and the venue they visited before passing it to the next teammate."
          />
        </div>


        {/* ====================================================
         * FINISHED ROUTE
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-cyan-300/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Where your team went
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                Every teammate&apos;s stop
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-zinc-500">
              Your completed route stays in Relay order, from the first
              baton holder to the teammate who finished the final leg.
            </p>
          </div>


          <ol className="mt-6 space-y-3">
            {completedTeamSlots.map(
              (
                teamSlot,
                index
              ) => {
                const relaySlot =
                  relaySlots.find(
                    (
                      slot
                    ) =>
                      slot.id ===
                      teamSlot.relay_slot_id
                  ) ??
                  null


                const member =
                  teamSlot.assigned_user_id
                    ? members.find(
                        (
                          candidate
                        ) =>
                          candidate.user_id ===
                          teamSlot.assigned_user_id
                      ) ??
                      null
                    : null


                const contributorPresentation =
                  getContributorPresentation({
                    userId:
                      teamSlot.assigned_user_id,

                    viewerUserId:
                      user.id,

                    captainUserId:
                      team.captain_user_id,

                    member,
                  })


                const participantProfile =
                  teamSlot.assigned_user_id
                    ? participantProfileById.get(
                        teamSlot.assigned_user_id
                      ) ??
                      null
                    : null


                const participantName =
                  getParticipantName({
                    profile:
                      participantProfile,

                    fallback:
                      contributorPresentation.label,
                  })


                const venue =
                  teamSlot.venue_id
                    ? venueById.get(
                        teamSlot.venue_id
                      ) ??
                      null
                    : null


                const venueName =
                  venue?.name
                    ?.trim() ||
                  (
                    teamSlot.venue_id
                      ? 'Relay venue'
                      : 'Completed Relay stop'
                  )


                const venueLocation =
                  getVenueLocationLabel(
                    venue
                  )


                return (
                  <li
                    key={
                      teamSlot.id
                    }
                    className="relative overflow-hidden rounded-[1.35rem] bg-black/20 p-4 ring-1 ring-white/[0.06] sm:p-5"
                  >
                    <div className="flex gap-4">
                      <div className="flex shrink-0 flex-col items-center">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300/[0.07] text-xs font-black text-cyan-100 ring-1 ring-cyan-300/16">
                          {teamSlot.slot_index}
                        </span>

                        {index <
                        completedTeamSlots.length -
                          1 ? (
                          <span className="mt-2 h-full min-h-10 w-px bg-gradient-to-b from-cyan-300/20 to-transparent" />
                        ) : null}
                      </div>


                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                              Leg {teamSlot.slot_index}
                            </p>

                            <h3 className="mt-1.5 text-lg font-black text-white">
                              {relaySlot
                                ?.label ??
                                `Relay leg ${teamSlot.slot_index}`}
                            </h3>

                            {relaySlot
                              ?.prompt ? (
                              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-zinc-600">
                                {
                                  relaySlot.prompt
                                }
                              </p>
                            ) : null}
                          </div>


                          {teamSlot.geo_verified ? (
                            <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-emerald-300/[0.055] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-100/70 ring-1 ring-emerald-300/14">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />

                              Check-in verified
                            </span>
                          ) : null}
                        </div>


                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                          <div className="rounded-[1rem] bg-white/[0.025] px-4 py-3.5 ring-1 ring-white/[0.055]">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                              Teammate
                            </p>

                            <p className="mt-1.5 truncate text-sm font-black text-zinc-200">
                              {participantName}
                            </p>

                            {contributorPresentation.secondaryLabel ? (
                              <p className="mt-1 text-xs text-zinc-600">
                                {
                                  contributorPresentation.secondaryLabel
                                }
                              </p>
                            ) : null}
                          </div>


                          <div className="rounded-[1rem] bg-violet-300/[0.025] px-4 py-3.5 ring-1 ring-violet-300/10">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-200/40">
                              Venue visited
                            </p>

                            <p className="mt-1.5 text-sm font-black text-white">
                              {venueName}
                            </p>

                            {venueLocation ? (
                              <p className="mt-1 text-xs leading-5 text-zinc-500">
                                {venueLocation}
                              </p>
                            ) : null}
                          </div>
                        </div>


                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-zinc-700">
                          {teamSlot.checked_in_at ? (
                            <span>
                              Checked in{' '}
                              {
                                formatDateTime(
                                  teamSlot.checked_in_at
                                )
                              }
                            </span>
                          ) : null}

                          {teamSlot.completed_at ? (
                            <span>
                              Finished{' '}
                              {
                                formatDateTime(
                                  teamSlot.completed_at
                                )
                              }
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              }
            )}
          </ol>
        </section>


        {/* ====================================================
         * INTEGRITY WARNING
         * ==================================================== */}

        {integrityExceptionSlots.length >
        0 ? (
          <section className="mt-5 rounded-[1.75rem] bg-gradient-to-br from-amber-300/[0.055] via-white/[0.022] to-indigo-400/[0.015] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-amber-300/12 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="h-px w-5 bg-amber-300/60" />

                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/75">
                    Route check
                  </p>
                </div>

                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Your team is marked complete, but{' '}
                  {integrityExceptionSlots.length}{' '}
                  Relay leg
                  {integrityExceptionSlots.length ===
                  1
                    ? ''
                    : 's'}{' '}
                  still have an unusual saved status. They&apos;re shown
                  below so your finished route stays transparent.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {skippedTeamSlots.length >
                0 ? (
                  <IntegrityCount
                    label="Skipped"
                    value={
                      skippedTeamSlots.length
                    }
                  />
                ) : null}

                {unresolvedTeamSlots.length >
                0 ? (
                  <IntegrityCount
                    label="Unresolved"
                    value={
                      unresolvedTeamSlots.length
                    }
                  />
                ) : null}
              </div>
            </div>


            <ol className="mt-4 space-y-2 border-t border-amber-300/10 pt-4">
              {integrityExceptionSlots.map(
                (
                  teamSlot
                ) => {
                  const relaySlot =
                    relaySlots.find(
                      (
                        slot
                      ) =>
                        slot.id ===
                        teamSlot.relay_slot_id
                    ) ??
                    null


                  return (
                    <li
                      key={
                        teamSlot.id
                      }
                      className="flex flex-col gap-2 rounded-[1.1rem] bg-black/20 px-4 py-3 ring-1 ring-white/[0.055] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                          Relay leg{' '}
                          {
                            teamSlot.slot_index
                          }
                        </p>

                        <p className="mt-1 truncate text-sm font-bold text-zinc-300">
                          {relaySlot
                            ?.label ??
                            `Relay leg ${teamSlot.slot_index}`}
                        </p>
                      </div>

                      <span className="w-fit shrink-0 rounded-full bg-amber-300/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100/60 ring-1 ring-amber-300/12">
                        {formatStatus(
                          teamSlot.status
                        )}
                      </span>
                    </li>
                  )
                }
              )}
            </ol>
          </section>
        ) : null}


        {/* ====================================================
         * TEAM TIMELINE
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-cyan-300/60" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Relay timeline
            </p>
          </div>

          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
            From team-up to finish
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            A quick look back at when your team came together and
            completed the Relay.
          </p>

          <dl className="mt-5 grid gap-2 sm:grid-cols-4">
            <TimelineMetric
              label="Team created"
              value={
                formatDateTime(
                  team.created_at
                )
              }
            />

            <TimelineMetric
              label="Ready"
              value={
                formatDateTime(
                  team.opted_in_at
                )
              }
            />

            <TimelineMetric
              label="Started"
              value={
                formatDateTime(
                  team.started_at
                )
              }
            />

            <TimelineMetric
              label="Completed"
              value={
                formatDateTime(
                  team.completed_at
                )
              }
            />
          </dl>
        </section>


        {/* ====================================================
         * ARTIFACT BOUNDARY
         * ==================================================== */}

        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-cyan-300/60" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Your finished Relay
            </p>
          </div>

          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
            Your team&apos;s completed route stays here.
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-500">
            You can come back to see who completed each leg, which
            venues your team visited, and when the baton made it to the
            finish.
          </p>
        </section>


        {/* ====================================================
         * FOOTER
         * ==================================================== */}

        <footer className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-zinc-700">
            Completed Relay results are read-only. Your teammates,
            venues, verified check-ins, and completion times come from
            the saved Relay team record.
          </p>
        </footer>
      </div>
    </main>
  )
}


/* ============================================================
 * COMPLETION METRIC
 * ============================================================
 */

function CompletionMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-0 rounded-[1.1rem] bg-black/20 px-4 py-4 ring-1 ring-white/[0.06]">
      <dt className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-black text-white">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * TIMELINE METRIC
 * ============================================================
 */

function TimelineMetric({
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
 * INTEGRITY COUNT
 * ============================================================
 */

function IntegrityCount({
  label,
  value,
}: {
  label:
    string

  value:
    number
}) {
  return (
    <div className="min-w-[6.5rem] rounded-[1.1rem] bg-black/20 px-3.5 py-3 ring-1 ring-amber-300/10">
      <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-amber-100/45">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-white">
        {value}
      </p>
    </div>
  )
}


/* ============================================================
 * CONTRIBUTOR PRESENTATION
 * ============================================================
 */

function getContributorPresentation({
  userId,
  viewerUserId,
  captainUserId,
  member,
}: {
  userId:
    string | null

  viewerUserId:
    string

  captainUserId:
    string

  member:
    RelayTeamMemberRow | null
}): {
  label:
    string

  secondaryLabel:
    string | null

  isCaptain:
    boolean

  isViewer:
    boolean
} {
  const isViewer =
    Boolean(
      userId &&
      userId ===
        viewerUserId
    )


  const isCaptain =
    Boolean(
      userId &&
      userId ===
        captainUserId
    )


  if (
    isViewer
  ) {
    return {
      label:
        'You',

      secondaryLabel:
        isCaptain
          ? 'Team captain'
          : 'Relay contributor',

      isCaptain,

      isViewer:
        true,
    }
  }


  if (
    isCaptain
  ) {
    return {
      label:
        'Captain',

      secondaryLabel:
        'Team captain',

      isCaptain:
        true,

      isViewer:
        false,
    }
  }


  if (
    !userId
  ) {
    return {
      label:
        'Contributor',

      secondaryLabel:
        'Assignment unavailable',

      isCaptain:
        false,

      isViewer:
        false,
    }
  }


  return {
    label:
      'Teammate',

    secondaryLabel:
      getMemberStatusSecondaryLabel(
        member
      ),

    isCaptain:
      false,

    isViewer:
      false,
  }
}


/* ============================================================
 * PARTICIPANT PRESENTATION
 * ============================================================
 */

function getParticipantName({
  profile,
  fallback,
}: {
  profile:
    RelayParticipantProfileRow | null

  fallback:
    string
}): string {
  const fullName =
    profile
      ?.full_name
      ?.trim() ??
    ''


  if (
    fullName
  ) {
    return fullName
  }


  const username =
    profile
      ?.username
      ?.trim() ??
    ''


  if (
    username
  ) {
    return `@${username}`
  }


  return fallback
}


/* ============================================================
 * VENUE PRESENTATION
 * ============================================================
 */

function getVenueLocationLabel(
  venue:
    RelayVenueRow | null
): string | null {
  if (
    !venue
  ) {
    return null
  }


  const parts =
    [
      venue.address,
      venue.city,
    ]
      .filter(
        (
          value
        ): value is string =>
          typeof value ===
            'string' &&
          value.trim().length >
            0
      )
      .map(
        (
          value
        ) =>
          value.trim()
      )


  if (
    parts.length ===
    0
  ) {
    return null
  }


  return Array.from(
    new Set(
      parts
    )
  ).join(
    ' · '
  )
}


/* ============================================================
 * MEMBER STATUS
 * ============================================================
 */

function getMemberStatusSecondaryLabel(
  member:
    RelayTeamMemberRow | null
): string | null {
  if (
    !member
  ) {
    return 'Relay contributor'
  }


  switch (
    member.member_status
  ) {
    case 'joined':
      return 'Relay contributor'

    case 'invited':
      return 'Invited teammate'

    case 'declined':
      return 'Former invitee'

    case 'left':
      return 'Former teammate'

    case 'removed':
      return 'Former teammate'
  }
}


/* ============================================================
 * DATE
 * ============================================================
 */

function formatDateTime(
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


/* ============================================================
 * STATUS
 * ============================================================
 */

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