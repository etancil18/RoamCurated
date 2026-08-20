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
            contributorPresentation.label,

          contributorSecondaryLabel:
            contributorPresentation.secondaryLabel,

          contributorIsCaptain:
            contributorPresentation.isCaptain,

          contributorIsViewer:
            contributorPresentation.isViewer,

          venueId:
            teamSlot.venue_id,

          venueLabel:
            teamSlot.venue_id
              ? 'Verified Relay venue'
              : 'Completed Relay stop',

          venueSecondaryLabel:
            teamSlot.geo_verified
              ? 'Physical verification recorded'
              : null,

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
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8">
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
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.09] bg-black/20 px-4 text-xs font-semibold text-white/55 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
              >
                Team hub
              </Link>

              <Link
                href={
                  `/competitions/${relay.id}`
                }
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-violet-300/14 bg-violet-300/[0.05] px-4 text-xs font-semibold text-violet-50/70 transition hover:border-violet-300/22 hover:bg-violet-300/[0.08] hover:text-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
              >
                View Relay
              </Link>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/38">
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
            title="The baton made it all the way through."
            description="Every completed stop stays attached to the teammate who carried that leg, preserving the team’s finished route in canonical Relay order."
          />
        </div>


        {/* ====================================================
         * INTEGRITY WARNING
         * ==================================================== */}

        {integrityExceptionSlots.length >
        0 ? (
          <section className="mt-5 rounded-[22px] border border-amber-300/14 bg-amber-300/[0.035] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/48">
                  Completion integrity
                </p>

                <p className="mt-2 text-sm leading-6 text-white/42">
                  The team is canonically marked completed, but{' '}
                  {integrityExceptionSlots.length}{' '}
                  materialized Relay leg
                  {integrityExceptionSlots.length ===
                  1
                    ? ''
                    : 's'}{' '}
                  do not have normal completed state. This page preserves
                  the canonical database result instead of inventing
                  completion evidence.
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
                      className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-black/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/24">
                          Relay leg{' '}
                          {
                            teamSlot.slot_index
                          }
                        </p>

                        <p className="mt-1 truncate text-sm font-medium text-white/58">
                          {relaySlot
                            ?.label ??
                            `Relay leg ${teamSlot.slot_index}`}
                        </p>
                      </div>

                      <span className="w-fit shrink-0 rounded-full border border-amber-300/12 bg-amber-300/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/50">
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

        <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            Relay timeline
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
            From formation to finish
          </h2>

          <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
            <TimelineMetric
              label="Team created"
              value={
                formatDateTime(
                  team.created_at
                )
              }
            />

            <TimelineMetric
              label="Opted in"
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

        <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            What happens next
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
            The route is complete. The replay artifact is a separate step.
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/40">
            This page is the canonical completed-team projection. It
            does not claim that a reusable collaborative Roam artifact
            has already been materialized. Artifact creation should
            consume this frozen ordered route through its own canonical
            materialization path.
          </p>
        </section>


        {/* ====================================================
         * FOOTER
         * ==================================================== */}

        <footer className="mt-8 border-t border-white/[0.07] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-white/27">
            Completed Relay execution is read-only here. Contributor,
            venue, verification, and completion state are projected
            from canonical Relay team and team-slot records rather than
            reconstructed in the browser.
          </p>
        </footer>
      </div>
    </main>
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
    <div className="bg-[#0b0b0b] px-4 py-4">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-medium text-white/60">
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
    <div className="min-w-[6.5rem] rounded-2xl border border-amber-300/10 bg-black/15 px-3.5 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-amber-100/35">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-white/62">
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