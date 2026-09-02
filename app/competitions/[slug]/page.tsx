// app/competitions/[slug]/page.tsx

import 'server-only'

import Link from 'next/link'

import {
  createClient,
} from '@supabase/supabase-js'

import {
  notFound,
  redirect,
} from 'next/navigation'

import StartCompetitionEntryButton from '@/components/competitions/StartCompetitionEntryButton'

import RelayRewardSummary from '@/components/relay/RelayRewardSummary'
import RelaySlotList from '@/components/relay/RelaySlotList'
import RelayStatusBadge from '@/components/relay/RelayStatusBadge'

import {
  createRelayTeam,
} from '@/lib/relay/actions'

import {
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'

import {
  getCurrentUserRelayTeam,
  getRelayDefinition,
  getRelayRewardPolicyDisplay,
} from '@/lib/relay/queries'

import type {
  RelayDefinition,
  RelayTeam,
} from '@/lib/relay/types'

import {
  createServerClient,
} from '@/lib/supabase/server'


export const dynamic =
  'force-dynamic'

export const revalidate =
  0


// ============================================================
// TYPES
// ============================================================

type CompetitionStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'scoring'
  | 'completed'
  | 'cancelled'


type CompetitionResultStatus =
  | 'pending'
  | 'winner'
  | 'tie'
  | 'insufficient_evidence'
  | 'void'


type TasteDuelExecutionMode =
  | 'itinerary'
  | 'venue_participation'


type CompetitionRow = {
  id:
    string

  competition_type:
    string

  taste_duel_execution_mode:
    TasteDuelExecutionMode | null

  relay_id:
    string | null

  title:
    string

  description:
    string | null

  city:
    string | null

  category:
    string | null

  status:
    CompetitionStatus

  starts_at:
    string | null

  ends_at:
    string | null

  max_entries:
    number

  minimum_qualified_participants:
    number

  winner_entry_id:
    string | null

  result_status:
    CompetitionResultStatus

  xp_reward:
    number

  anonymous_entries:
    boolean

  created_at:
    string

  updated_at:
    string
}


type SanitizedCompetitionEntryRow = {
  id:
    string

  competition_id:
    string

  contender_slot:
    number

  venue_ids:
    string[]

  status:
    string
}


type VenueRow = {
  id:
    string

  name:
    string | null

  city:
    string | null
}


type RouteContext = {
  params:
    Promise<{
      slug:
        string
    }>

  searchParams?:
    Promise<{
      start_error?:
        | string
        | string[]
    }>
}


type ResolvedContender = {
  id:
    string

  slot:
    number

  label:
    string

  venueIds:
    string[]

  venues:
    {
      id:
        string

      name:
        string

      city:
        string | null
    }[]

  isWinner:
    boolean
}


// ============================================================
// RELAY TYPES
// ============================================================

type PublicRelayStatus =
  | 'scheduled'
  | 'live'
  | 'completed'


type RelayWindowState =
  | 'upcoming'
  | 'open'
  | 'ended'
  | 'unscheduled'


type RelayEligibilityPresentation = {
  label:
    string

  description:
    string

  tone:
    | 'open'
    | 'upcoming'
    | 'closed'
    | 'neutral'

  canFormTeam:
    boolean
}


type CompletedRelayTeamRow = {
  id:
    string

  completed_at:
    string | null
}


// ============================================================
// PAGE
// ============================================================

export default async function CompetitionDetailPage({
  params,
  searchParams,
}: RouteContext) {
  const {
    slug,
  } =
    await params


  const competitionId =
    extractCompetitionId(
      slug
    )


  if (
    !competitionId
  ) {
    notFound()
  }


  const supabase =
    await createServerClient()


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  // ==========================================================
  // PUBLIC COMPETITION
  // ==========================================================

  const {
    data:
      competition,
    error:
      competitionError,
  } =
    await supabase
      .from(
        'competitions'
      )
      .select(`
        id,
        competition_type,
        taste_duel_execution_mode,
        relay_id,
        title,
        description,
        city,
        category,
        status,
        starts_at,
        ends_at,
        max_entries,
        minimum_qualified_participants,
        winner_entry_id,
        result_status,
        xp_reward,
        anonymous_entries,
        created_at,
        updated_at
      `)
      .eq(
        'id',
        competitionId
      )
      .maybeSingle<CompetitionRow>()


  if (
    competitionError
  ) {
    console.error(
      '[competitions/[slug]] Competition fetch failed:',
      {
        competitionId,

        error:
          competitionError,
      }
    )


    return (
      <CompetitionLoadError />
    )
  }


  if (
    !competition
  ) {
    notFound()
  }


  if (
    !isPublicCompetitionStatus(
      competition.status
    )
  ) {
    notFound()
  }


  // ==========================================================
  // CANONICAL SLUG
  // ==========================================================

  const canonicalSlug =
    buildCompetitionSlug(
      competition
    )


  /**
   * Raw UUID URLs remain supported for backwards compatibility,
   * but normalize them onto the stable human-readable route.
   */
  if (
    slug !==
      canonicalSlug &&
    slug ===
      competition.id
  ) {
    redirect(
      `/competitions/${canonicalSlug}`
    )
  }


  // ==========================================================
  // RELAY COMPETITION
  // ==========================================================
  //
  // Relay competitions use the competition row for discovery,
  // status, slugging, and competition ownership, but their detail
  // experience is backed by the canonical Relay definition.
  //
  // Do not treat competitions.id as roam_relays.id.
  // ==========================================================

  if (
    competition.competition_type ===
    'roam_relay'
  ) {
    if (
      !competition.relay_id
    ) {
      console.error(
        '[competitions/[slug]] Relay competition is missing relay_id:',
        {
          competitionId:
            competition.id,
        }
      )


      notFound()
    }


    const relay =
      await getRelayDefinition(
        competition.relay_id
      )


    if (
      !relay ||
      !isPublicRelayStatus(
        relay.status
      )
    ) {
      notFound()
    }


    const [
      rewardPolicy,
      currentUserTeamResult,
      completedTeam,
    ] =
      await Promise.all([
        getRelayRewardPolicyDisplay(
          relay.id
        ),

        user
          ? getCurrentUserRelayTeam(
              relay.id,
              user.id
            )
          : Promise.resolve(
              null
            ),

        user
          ? getLatestCompletedRelayTeamForUser({
              supabase,
              relayId:
                relay.id,
              userId:
                user.id,
            })
          : Promise.resolve(
              null
            ),
      ])


    const existingTeam =
      currentUserTeamResult
        ?.team ??
      null


    const eligibility =
      getRelayEligibilityPresentation({
        relay,

        signedIn:
          Boolean(
            user
          ),

        existingTeam,
      })


    const relayIdForAction =
      relay.id


    async function createTeamAction() {
      'use server'


      const result =
        await createRelayTeam(
          relayIdForAction
        )


      if (
        !result.team?.id
      ) {
        throw new Error(
          'Relay team creation completed without returning a team.'
        )
      }


      redirect(
        `/competitions/team/${result.team.id}`
      )
    }


    return (
      <RelayCompetitionDetail
        relay={
          relay
        }
        rewardPolicy={
          rewardPolicy
        }
        existingTeam={
          existingTeam
        }
        completedTeamId={
          completedTeam
            ?.id ??
          null
        }
        eligibility={
          eligibility
        }
        signedIn={
          Boolean(
            user
          )
        }
        createTeamAction={
          createTeamAction
        }
      />
    )
  }


  // ==========================================================
  // SANITIZED CONTENDERS
  // ==========================================================

  const serviceSupabase =
    createCompetitionServiceClient()


  /**
   * IMPORTANT:
   *
   * Never select user_id here.
   *
   * This page deliberately bypasses user-facing RLS only so the
   * public competition can expose approved contender route
   * snapshots without exposing the entrant identity attached to
   * competition_entries.
   */
  const {
    data:
      entryRows,
    error:
      entriesError,
  } =
    await serviceSupabase
      .from(
        'competition_entries'
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
        competition.id
      )
      .eq(
        'status',
        'approved'
      )
      .order(
        'contender_slot',
        {
          ascending:
            true,
        }
      )


  if (
    entriesError
  ) {
    console.error(
      '[competitions/[slug]] Sanitized contender fetch failed:',
      {
        competitionId:
          competition.id,

        error:
          entriesError,
      }
    )
  }


  const sanitizedEntries =
    (
      entryRows ??
      []
    )
      .map(
        normalizeEntry
      )
      .filter(
        (
          entry
        ): entry is SanitizedCompetitionEntryRow =>
          entry !==
          null
      )


  // ==========================================================
  // VENUE LABELS
  // ==========================================================

  const allVenueIds =
    [
      ...new Set(
        sanitizedEntries.flatMap(
          (
            entry
          ) =>
            entry.venue_ids
        )
      ),
    ]


  let venueRows:
    VenueRow[] =
    []


  if (
    allVenueIds.length >
      0
  ) {
    const {
      data:
        venueData,
      error:
        venueError,
    } =
      await serviceSupabase
        .from(
          'venues'
        )
        .select(
          'id, name, city'
        )
        .in(
          'id',
          allVenueIds
        )


    if (
      venueError
    ) {
      console.error(
        '[competitions/[slug]] Venue label fetch failed:',
        {
          competitionId:
            competition.id,

          error:
            venueError,
        }
      )
    } else {
      venueRows =
        (
          venueData ??
          []
        ) as VenueRow[]
    }
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


  const contenders:
    ResolvedContender[] =
    sanitizedEntries.map(
      (
        entry
      ) => ({
        id:
          entry.id,

        slot:
          entry.contender_slot,

        label:
          getContenderLabel(
            entry.contender_slot
          ),

        venueIds:
          entry.venue_ids,

        venues:
          entry.venue_ids.map(
            (
              venueId
            ) => {
              const venue =
                venueById.get(
                  venueId
                )


              return {
                id:
                  venueId,

                name:
                  venue?.name
                    ?.trim() ||
                  'Roam stop',

                city:
                  venue?.city ??
                  null,
              }
            }
          ),

        isWinner:
          competition.status ===
            'completed' &&
          competition.result_status ===
            'winner' &&
          competition.winner_entry_id ===
            entry.id,
      })
    )


  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : {}


  const startError =
    firstSearchParam(
      resolvedSearchParams
        .start_error
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
        <div className="mb-7">
          <Link
            href="/competitions"
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/[0.025] px-3.5 py-2 text-xs font-bold text-zinc-500 ring-1 ring-white/[0.06] transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            <span
              aria-hidden="true"
            >
              ←
            </span>

            Competitions
          </Link>
        </div>


        <CompetitionHero
          competition={
            competition
          }
          contenderCount={
            contenders.length
          }
        />


        {startError ? (
          <div className="mt-6 rounded-[1.4rem] bg-red-400/[0.045] px-4 py-3 text-sm text-red-100 ring-1 ring-red-400/15">
            {startError}
          </div>
        ) : null}


        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <SectionHeading
              eyebrow={
                competition.status ===
                  'completed'
                  ? 'Results'
                  : isVenueParticipationTasteDuel(
                      competition
                    )
                    ? 'Matchup'
                    : 'Routes'
              }
              title={
                getContenderSectionTitle(
                  competition
                )
              }
              description={
                getContenderSectionDescription(
                  competition
                )
              }
            />


            {entriesError ? (
              <div className="mt-6 rounded-[1.75rem] bg-white/[0.025] p-6 ring-1 ring-white/[0.07]">
                <p className="text-sm text-zinc-500">
                  {isVenueParticipationTasteDuel(
                    competition
                  )
                    ? 'The competing venues could not be loaded right now.'
                    : 'The competing routes could not be loaded right now.'}
                </p>
              </div>
            ) : contenders.length >
              0 ? (
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {contenders.map(
                  (
                    contender
                  ) => (
                    <ContenderCard
                      key={
                        contender.id
                      }
                      competition={
                        competition
                      }
                      contender={
                        contender
                      }
                      signedIn={
                        Boolean(
                          user
                        )
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyContenders
                competition={
                  competition
                }
              />
            )}
          </section>


          <aside className="space-y-5">
            <CompetitionFacts
              competition={
                competition
              }
              contenderCount={
                contenders.length
              }
            />

            <FairnessCard
              competition={
                competition
              }
            />
          </aside>
        </div>
      </div>
    </main>
  )
}


// ============================================================
// RELAY DETAIL
// ============================================================

function RelayCompetitionDetail({
  relay,
  rewardPolicy,
  existingTeam,
  completedTeamId,
  eligibility,
  signedIn,
  createTeamAction,
}: {
  relay:
    RelayDefinition

  rewardPolicy:
    Awaited<
      ReturnType<
        typeof getRelayRewardPolicyDisplay
      >
    >

  existingTeam:
    RelayTeam | null

  completedTeamId:
    string | null

  eligibility:
    RelayEligibilityPresentation

  signedIn:
    boolean

  createTeamAction:
    () => Promise<void>
}) {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-7">
          <Link
            href="/competitions"
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/[0.025] px-3.5 py-2 text-xs font-bold text-zinc-500 ring-1 ring-white/[0.06] transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            <span
              aria-hidden="true"
            >
              ←
            </span>

            Competitions
          </Link>
        </div>


        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.06] via-white/[0.028] to-indigo-400/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

            <div className="absolute -bottom-28 right-[-4rem] h-72 w-72 rounded-full bg-indigo-400/[0.05] blur-[110px]" />

            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-300/[0.045] blur-[110px]" />
          </div>


          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <RelayStatusBadge
                kind="relay"
                status={
                  relay.status
                }
              />


              {relay.partnerCampaignId ? (
                <span className="inline-flex items-center rounded-full bg-violet-300/[0.055] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-violet-100/75 ring-1 ring-violet-300/15">
                  Partner Relay
                </span>
              ) : null}


              <span className="inline-flex items-center rounded-full bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-zinc-500 ring-1 ring-white/[0.07]">
                One leg at a time
              </span>
            </div>


            <div className="mt-5 flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                {[
                  relay.city,
                  relay.theme,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ' · '
                  )}
              </p>
            </div>


            <h1 className="mt-4 max-w-3xl text-balance text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.03]">
              {relay.title}
            </h1>


            {relay.description ? (
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
                {
                  relay.description
                }
              </p>
            ) : (
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
                Build one route together. Each teammate owns one
                leg, completes it in the city, and passes the baton
                to the next person.
              </p>
            )}


            <dl className="mt-7 grid gap-2 sm:grid-cols-3">
              <RelayDetailMetric
                label="Team"
                value={
                  formatRelayTeamSize(
                    relay.minTeamSize,
                    relay.maxTeamSize
                  )
                }
              />

              <RelayDetailMetric
                label="Route"
                value={`${relay.slots.length} ${
                  relay.slots.length ===
                  1
                    ? 'leg'
                    : 'legs'
                }`}
              />

              <RelayDetailMetric
                label="When"
                value={
                  formatRelayTimeWindow(
                    relay.startsAt,
                    relay.endsAt
                  )
                }
              />
            </dl>
          </div>
        </header>


        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                How it works
              </p>
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
              One team. One route. One leg at a time.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
              Each teammate takes one Relay leg. When it&apos;s your
              turn, visit your stop and check in there. Once your stop
              is complete, the baton passes to the next teammate.
            </p>


            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <RelayBriefStep
                number="01"
                title="Form the team"
                description="Get enough teammates to cover every leg."
              />

              <RelayBriefStep
                number="02"
                title="Choose each leg"
                description="Give each teammate one part of the route."
              />

              <RelayBriefStep
                number="03"
                title="Pass the baton"
                description="Complete each leg in order until your team finishes."
              />
            </div>
          </section>


          <RelayEligibilityCard
            eligibility={
              eligibility
            }
            existingTeam={
              existingTeam
            }
            completedTeamId={
              completedTeamId
            }
            signedIn={
              signedIn
            }
            createTeamAction={
              createTeamAction
            }
          />
        </div>


        <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Your Relay route
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                The route your team will build
              </h2>
            </div>


            <p className="max-w-md text-sm leading-6 text-zinc-500">
              Each leg has its own venue options. Visit the chosen stop
              in person and check in there to complete it.
            </p>
          </div>


          <RelaySlotList
            slots={
              relay.slots
            }
            variant="default"
            showPrompts
            showConstraints
          />
        </section>


        {rewardPolicy ? (
          <section className="mt-8 rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-amber-300/[0.02] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Competition reward
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                What the winning team earns
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Winning XP is a competition reward. You can still earn
                your regular exploration and Relay XP along the way.
              </p>
            </div>


            <RelayRewardSummary
              policy={
                rewardPolicy
              }
              variant="default"
            />
          </section>
        ) : null}


        <footer className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-zinc-700">
            Your team&apos;s progress is saved as you go. Roam checks
            that team setup, check-ins, and completed legs meet the
            Relay&apos;s rules before progress moves forward.
          </p>
        </footer>
      </div>
    </main>
  )
}


// ============================================================
// RELAY DETAIL METRIC
// ============================================================

function RelayDetailMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-0 rounded-[1.1rem] bg-black/20 px-4 py-4 ring-1 ring-white/[0.055] sm:px-5">
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-700">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-bold leading-6 text-zinc-300">
        {value}
      </dd>
    </div>
  )
}


// ============================================================
// RELAY BRIEF STEP
// ============================================================

function RelayBriefStep({
  number,
  title,
  description,
}: {
  number:
    string

  title:
    string

  description:
    string
}) {
  return (
    <div className="rounded-[1.1rem] bg-black/20 p-4 ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-black tracking-[0.14em] text-cyan-300/70">
        {number}
      </p>

      <p className="mt-2 text-sm font-black text-white">
        {title}
      </p>

      <p className="mt-1.5 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </div>
  )
}


// ============================================================
// RELAY ELIGIBILITY
// ============================================================

function RelayEligibilityCard({
  eligibility,
  existingTeam,
  completedTeamId,
  signedIn,
  createTeamAction,
}: {
  eligibility:
    RelayEligibilityPresentation

  existingTeam:
    RelayTeam | null

  completedTeamId:
    string | null

  signedIn:
    boolean

  createTeamAction:
    () => Promise<void>
}) {
  const toneClassName =
    eligibility.tone ===
    'open'
      ? 'bg-emerald-300/[0.035] ring-emerald-300/12'
      : eligibility.tone ===
          'upcoming'
        ? 'bg-amber-300/[0.035] ring-amber-300/12'
        : eligibility.tone ===
            'closed'
          ? 'bg-white/[0.02] ring-white/[0.06]'
          : 'bg-violet-300/[0.035] ring-violet-300/12'


  return (
    <aside
      className={[
        'rounded-[1.75rem]',
        'p-5',
        'ring-1',
        'shadow-[0_18px_60px_rgba(0,0,0,0.16)]',
        toneClassName,
      ].join(
        ' '
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          Your team
        </p>
      </div>


      <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
        {
          eligibility.label
        }
      </h2>


      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {
          eligibility.description
        }
      </p>


      {existingTeam ? (
        <div className="mt-5">
          <div className="rounded-[1.1rem] bg-black/20 px-4 py-4 ring-1 ring-white/[0.055]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
              Your team
            </p>

            <p className="mt-1.5 text-sm font-black capitalize text-white">
              {
                existingTeam.status
              }
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              You already have a team for this Relay. Open it to see
              your teammates, assignments, and progress.
            </p>
          </div>


          <Link
            href={`/competitions/team/${existingTeam.id}`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-violet-300/[0.07] px-5 text-sm font-bold text-violet-50 ring-1 ring-violet-300/15 transition hover:bg-violet-300/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
          >
            View your Relay team
          </Link>
        </div>
      ) : eligibility.canFormTeam ? (
        <>
          <form
            action={
              createTeamAction
            }
            className="mt-5"
          >
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
            >
              Form a Relay team
            </button>
          </form>

          {completedTeamId ? (
            <Link
              href={`/competitions/team/${completedTeamId}/complete`}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-violet-300/[0.07] px-5 text-sm font-bold text-violet-50 ring-1 ring-violet-300/15 transition hover:bg-violet-300/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
            >
              View completed Relay
            </Link>
          ) : null}
        </>
      ) : !signedIn ? (
        <Link
          href="/login"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white"
        >
          Sign in to form a team
        </Link>
      ) : (
        <div className="mt-5 rounded-[1.1rem] bg-black/20 px-4 py-3.5 text-center text-xs font-bold text-zinc-600 ring-1 ring-white/[0.055]">
          Team formation unavailable
        </div>
      )}


      <p className="mt-4 text-[10px] leading-5 text-zinc-700">
        We&apos;ll confirm your team can join when you continue.
      </p>
    </aside>
  )
}


// ============================================================
// RELAY PRESENTATION
// ============================================================

function isPublicRelayStatus(
  status:
    RelayDefinition['status']
): status is PublicRelayStatus {
  return (
    status ===
      'scheduled' ||
    status ===
      'live' ||
    status ===
      'completed'
  )
}


function getRelayWindowState(
  startsAt:
    string | null,
  endsAt:
    string | null,
  now =
    Date.now()
): RelayWindowState {
  const startTimestamp =
    startsAt
      ? new Date(
          startsAt
        ).getTime()
      : null


  const endTimestamp =
    endsAt
      ? new Date(
          endsAt
        ).getTime()
      : null


  if (
    startTimestamp !==
      null &&
    !Number.isNaN(
      startTimestamp
    ) &&
    startTimestamp >
      now
  ) {
    return 'upcoming'
  }


  if (
    endTimestamp !==
      null &&
    !Number.isNaN(
      endTimestamp
    ) &&
    endTimestamp <=
      now
  ) {
    return 'ended'
  }


  if (
    startTimestamp ===
      null &&
    endTimestamp ===
      null
  ) {
    return 'unscheduled'
  }


  return 'open'
}


function getRelayEligibilityPresentation({
  relay,
  signedIn,
  existingTeam,
}: {
  relay:
    RelayDefinition

  signedIn:
    boolean

  existingTeam:
    RelayTeam | null
}): RelayEligibilityPresentation {
  if (
    existingTeam
  ) {
    return {
      label:
        'You already have a team',

      description:
        `Your Relay team is currently ${existingTeam.status}.`,

      tone:
        'neutral',

      canFormTeam:
        false,
    }
  }


  if (
    relay.status ===
    'completed'
  ) {
    return {
      label:
        'Relay completed',

      description:
        'This Relay has finished, so new teams can no longer join.',

      tone:
        'closed',

      canFormTeam:
        false,
    }
  }


  const windowState =
    getRelayWindowState(
      relay.startsAt,
      relay.endsAt
    )


  if (
    windowState ===
    'ended'
  ) {
    return {
      label:
        'This Relay has ended',

      description:
        'The time to complete this Relay has passed.',

      tone:
        'closed',

      canFormTeam:
        false,
    }
  }


  if (
    !signedIn
  ) {
    return {
      label:
        relay.status ===
          'scheduled'
          ? 'Teams can start forming'
          : 'Open for teams',

      description:
        'Sign in to create or join a Relay team.',

      tone:
        relay.status ===
          'scheduled'
          ? 'upcoming'
          : 'open',

      canFormTeam:
        false,
    }
  }


  if (
    relay.status ===
    'scheduled'
  ) {
    return {
      label:
        'Form your team',

      description:
        'Invite your teammates and give each person one Relay leg before you start.',

      tone:
        'upcoming',

      canFormTeam:
        true,
    }
  }


  return {
    label:
      'Open for teams',

    description:
      'Create your team, give each teammate one leg, and complete the route together in order.',

    tone:
      'open',

    canFormTeam:
      true,
  }
}


// ============================================================
// HERO
// ============================================================

function CompetitionHero({
  competition,
  contenderCount,
}: {
  competition:
    CompetitionRow

  contenderCount:
    number
}) {
  const status =
    getStatusPresentation(
      competition
    )

  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )


  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.06] via-white/[0.028] to-indigo-400/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

        <div className="absolute -bottom-28 right-[-4rem] h-72 w-72 rounded-full bg-indigo-400/[0.05] blur-[110px]" />

        <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full bg-amber-300/[0.04] blur-[120px]" />
      </div>


      {competition.status ===
      'live' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-red-500/[0.045] blur-[110px]"
        />
      ) : null}


      <div className="relative z-10 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]',
              status.className,
            ].join(
              ' '
            )}
          >
            {
              status.label
            }
          </span>


          <span className="inline-flex items-center rounded-full bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 ring-1 ring-white/[0.07]">
            {formatCompetitionType(
              competition.competition_type
            )}
          </span>


          {competition.anonymous_entries &&
          competition.status !==
            'completed' ? (
            <span className="inline-flex items-center rounded-full bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 ring-1 ring-white/[0.07]">
              Identities hidden
            </span>
          ) : null}
        </div>


        <div className="mt-6 flex items-center gap-2">
          <span className="h-px w-5 bg-cyan-300/60" />

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Competition
          </p>
        </div>


        <h1 className="mt-4 max-w-3xl text-balance text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.03]">
          {
            competition.title
          }
        </h1>


        {competition.description ? (
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
            {
              competition.description
            }
          </p>
        ) : venueParticipation ? (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
            Pick a side, visit one of its venues, check in while
            you&apos;re there, and rate your experience. Every real
            visit helps decide which side wins.
          </p>
        ) : (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
            Try the competing routes for yourself. Your real-world
            check-ins help determine which route comes out on top.
          </p>
        )}


        <div className="mt-7 flex flex-wrap gap-2">
          {competition.city ? (
            <HeroChip>
              {
                competition.city
              }
            </HeroChip>
          ) : null}


          {competition.category ? (
            <HeroChip>
              {
                competition.category
              }
            </HeroChip>
          ) : null}


          <HeroChip>
            {contenderCount}{' '}
            {contenderCount ===
            1
              ? 'contender'
              : 'contenders'}
          </HeroChip>


          {competition.xp_reward >
          0 ? (
            <HeroChip>
              +
              {
                competition.xp_reward
              }{' '}
              XP reward
            </HeroChip>
          ) : null}
        </div>
      </div>
    </header>
  )
}


// ============================================================
// CONTENDER
// ============================================================

function ContenderCard({
  competition,
  contender,
  signedIn,
}: {
  competition:
    CompetitionRow

  contender:
    ResolvedContender

  signedIn:
    boolean
}) {
  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )

  const canStart =
    competition.status ===
      'live' &&
    !venueParticipation


  return (
    <article
      className={[
        'group relative overflow-hidden rounded-[1.75rem] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 sm:p-6',
        contender.isWinner
          ? 'bg-gradient-to-br from-amber-300/[0.08] via-white/[0.028] to-indigo-400/[0.018] ring-amber-300/20'
          : 'bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] ring-white/[0.07]',
      ].join(
        ' '
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-300/[0.05] blur-[100px]" />
      </div>


      <div className="relative">
        {contender.isWinner ? (
          <div className="mb-5 inline-flex rounded-full bg-amber-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100 ring-1 ring-amber-300/20">
            Winner
          </div>
        ) : null}


        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                {venueParticipation
                  ? 'Side'
                  : 'Route'}{' '}
                {
                  contender.slot
                }
              </p>
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
              {
                contender.label
              }
            </h2>
          </div>


          <div className="rounded-full bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-zinc-500 ring-1 ring-white/[0.07]">
            {
              contender.venueIds.length
            }{' '}
            {venueParticipation
              ? contender.venueIds.length ===
                  1
                ? 'venue'
                : 'venues'
              : contender.venueIds.length ===
                  1
                ? 'stop'
                : 'stops'}
          </div>
        </div>


        <ol className="mt-6 space-y-2.5">
          {contender.venues.map(
            (
              venue,
              index
            ) => (
              <li
                key={`${contender.id}:${index}:${venue.id}`}
                className="rounded-[1.1rem] bg-black/20 px-4 py-3 ring-1 ring-white/[0.055]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.025] text-[10px] font-bold text-zinc-600 ring-1 ring-white/[0.07]">
                    {index +
                      1}
                  </span>


                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/venue-profile/${encodeURIComponent(
                        venue.id
                      )}`}
                      className="block truncate text-sm font-bold text-zinc-200 underline decoration-white/15 underline-offset-4 transition hover:text-cyan-200 hover:decoration-cyan-300/50 focus-visible:outline-none focus-visible:text-cyan-200"
                    >
                      {
                        venue.name
                      }
                    </Link>


                    {venue.city ? (
                      <div className="mt-0.5 truncate text-[11px] text-zinc-700">
                        {
                          venue.city
                        }
                      </div>
                    ) : null}
                  </div>


                  {venueParticipation &&
                  competition.status ===
                    'live' ? (
                    signedIn ? (
                      <Link
                        href={`/venue-profile/${encodeURIComponent(
                          venue.id
                        )}`}
                        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-cyan-300/[0.07] px-3 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-300/15 transition hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      >
                        Check in &amp; rate
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] px-3 text-[11px] font-bold text-zinc-300 ring-1 ring-white/[0.08] transition hover:bg-white/[0.07] hover:text-white"
                      >
                        Sign in
                      </Link>
                    )
                  ) : null}
                </div>
              </li>
            )
          )}
        </ol>


        <div className="mt-6 border-t border-white/[0.06] pt-5">
          {venueParticipation &&
          competition.status ===
            'live' ? (
            <div className="rounded-[1rem] bg-cyan-300/[0.035] px-4 py-3 text-center text-xs font-bold leading-5 text-cyan-100/70 ring-1 ring-cyan-300/10">
              Choose a venue, check in when you&apos;re there, and rate
              your experience. Your visit helps this side in the
              competition.
            </div>
          ) : canStart ? (
            signedIn ? (
              <StartCompetitionEntryButton
                competitionId={
                  competition.id
                }
                entryId={
                  contender.id
                }
                label={`Roam ${contender.label}`}
              />
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Sign in to explore
              </Link>
            )
          ) : competition.status ===
            'scheduled' ? (
            <div className="text-center text-xs font-bold text-zinc-600">
              {venueParticipation
                ? 'Check-ins and ratings open when the competition goes live.'
                : 'You can start this route when the competition goes live.'}
            </div>
          ) : competition.status ===
            'scoring' ? (
            <div className="text-center text-xs font-bold text-violet-200/55">
              {venueParticipation
                ? 'Check-ins are closed while the final result is being worked out.'
                : 'Exploring is closed while the results are being reviewed.'}
            </div>
          ) : contender.isWinner ? (
            <div className="text-center text-xs font-black text-amber-100/75">
              {venueParticipation
                ? 'Winning side'
                : 'Winning route'}
            </div>
          ) : (
            <div className="text-center text-xs font-bold text-zinc-600">
              This competition has ended.
            </div>
          )}
        </div>
      </div>
    </article>
  )
}


// ============================================================
// SIDEBAR
// ============================================================

function CompetitionFacts({
  competition,
  contenderCount,
}: {
  competition:
    CompetitionRow

  contenderCount:
    number
}) {
  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )


  return (
    <section className="rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07]">
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          Competition details
        </p>
      </div>


      <dl className="mt-5 divide-y divide-white/[0.06]">
        <Fact
          label="Status"
          value={
            getStatusPresentation(
              competition
            ).label
          }
        />

        <Fact
          label="Starts"
          value={
            formatCompetitionDate(
              competition.starts_at
            )
          }
        />

        <Fact
          label="Ends"
          value={
            formatCompetitionDate(
              competition.ends_at
            )
          }
        />

        <Fact
          label={
            venueParticipation
              ? 'Sides'
              : 'Routes'
          }
          value={`${contenderCount}/${competition.max_entries}`}
        />

        <Fact
          label="Reward"
          value={
            competition.xp_reward >
            0
              ? `${competition.xp_reward} XP`
              : 'No XP reward'
          }
        />


        {competition.status ===
        'completed' ? (
          <Fact
            label="Result"
            value={
              formatResultStatus(
                competition.result_status
              )
            }
          />
        ) : null}
      </dl>
    </section>
  )
}


function FairnessCard({
  competition,
}: {
  competition:
    CompetitionRow
}) {
  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )


  return (
    <section className="rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07]">
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          How this works
        </p>
      </div>


      <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-500">
        {venueParticipation ? (
          <>
            <p>
              Visit a listed venue, check in while you&apos;re there,
              and rate your experience. Real visits help decide which
              side wins.
            </p>


            <p>
              The competition works best when lots of different people
              try different venues. Repeating the same visit over and
              over does not carry the same weight as broader
              participation.
            </p>


            <p>
              Ratings matter, but so does how each side performs across
              its different venues.
            </p>
          </>
        ) : (
          <>
            <p>
              Routes are judged by real-world visits and check-ins, not by
              follower count or audience size.
            </p>


            {competition.anonymous_entries &&
            competition.status !==
              'completed' ? (
              <p>
                Who created each route stays hidden while the competition
                is active.
              </p>
            ) : null}


            <p>
              A route only counts once enough of its stops have been
              completed and verified.
            </p>
          </>
        )}
      </div>
    </section>
  )
}


function Fact({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs text-zinc-700">
        {label}
      </dt>

      <dd className="text-right text-xs font-bold text-zinc-400">
        {value}
      </dd>
    </div>
  )
}


// ============================================================
// SUPPORTING UI
// ============================================================

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow:
    string

  title:
    string

  description:
    string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          {eyebrow}
        </p>
      </div>

      <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]">
        {title}
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        {description}
      </p>
    </div>
  )
}


function HeroChip({
  children,
}: {
  children:
    React.ReactNode
}) {
  return (
    <span className="inline-flex rounded-full bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-zinc-500 ring-1 ring-white/[0.06]">
      {children}
    </span>
  )
}


function EmptyContenders({
  competition,
}: {
  competition:
    CompetitionRow
}) {
  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )


  return (
    <div className="mt-6 rounded-[1.75rem] bg-white/[0.025] p-8 text-center ring-1 ring-white/[0.07]">
      <p className="text-sm font-bold text-zinc-500">
        {competition.status ===
        'scheduled'
          ? venueParticipation
            ? 'The competing venues have not been announced yet.'
            : 'Routes have not been published yet.'
          : venueParticipation
            ? 'There are no competing venues to show right now.'
            : 'No routes are available right now.'}
      </p>
    </div>
  )
}


function CompetitionLoadError() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 py-16 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto max-w-2xl rounded-[2rem] bg-red-400/[0.035] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-red-400/15">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-red-300/60" />

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/70">
            Competition unavailable
          </p>
        </div>

        <h1 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
          This competition could not be loaded.
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Nothing was changed. Try again in a moment.
        </p>

        <Link
          href="/competitions"
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-full bg-white/[0.035] px-4 py-2 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white"
        >
          Back to competitions
        </Link>
      </div>
    </main>
  )
}


// ============================================================
// DATA NORMALIZATION
// ============================================================

function normalizeEntry(
  value:
    unknown
): SanitizedCompetitionEntryRow | null {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }


  const row =
    value as Record<
      string,
      unknown
    >


  if (
    typeof row.id !==
      'string' ||
    typeof row.competition_id !==
      'string' ||
    typeof row.contender_slot !==
      'number' ||
    !Number.isInteger(
      row.contender_slot
    ) ||
    row.contender_slot <
      1 ||
    row.contender_slot >
      4
  ) {
    return null
  }


  const venueIds =
    Array.isArray(
      row.venue_ids
    )
      ? row.venue_ids
          .filter(
            (
              venueId
            ): venueId is string =>
              typeof venueId ===
                'string'
          )
          .map(
            (
              venueId
            ) =>
              venueId.trim()
          )
          .filter(
            Boolean
          )
      : []


  return {
    id:
      row.id,

    competition_id:
      row.competition_id,

    contender_slot:
      row.contender_slot,

    venue_ids:
      venueIds,

    status:
      typeof row.status ===
        'string'
        ? row.status
        : '',
  }
}


// ============================================================
// COMPLETED RELAY TEAM
// ============================================================

async function getLatestCompletedRelayTeamForUser({
  supabase,
  relayId,
  userId,
}: {
  supabase:
    Awaited<
      ReturnType<
        typeof createServerClient
      >
    >

  relayId:
    string

  userId:
    string
}): Promise<CompletedRelayTeamRow | null> {
  const {
    data:
      membershipRows,
    error:
      membershipError,
  } =
    await supabase
      .from(
        'roam_relay_team_members'
      )
      .select(
        'team_id'
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'member_status',
        'joined'
      )


  if (
    membershipError
  ) {
    console.error(
      '[competitions/[slug]] Completed Relay membership lookup failed:',
      {
        relayId,
        userId,
        error:
          membershipError,
      }
    )
  }


  const joinedTeamIds =
    (
      membershipRows ??
      []
    )
      .map(
        (
          row
        ) =>
          typeof row.team_id ===
            'string'
            ? row.team_id.trim()
            : ''
      )
      .filter(
        Boolean
      )


  const {
    data:
      captainTeamData,
    error:
      captainTeamError,
  } =
    await supabase
      .from(
        'roam_relay_teams'
      )
      .select(`
        id,
        completed_at
      `)
      .eq(
        'relay_id',
        relayId
      )
      .eq(
        'captain_user_id',
        userId
      )
      .eq(
        'status',
        'completed'
      )
      .order(
        'completed_at',
        {
          ascending:
            false,

          nullsFirst:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle()


  if (
    captainTeamError
  ) {
    console.error(
      '[competitions/[slug]] Completed Relay captain-team lookup failed:',
      {
        relayId,
        userId,
        error:
          captainTeamError,
      }
    )
  }


  let joinedTeam:
    CompletedRelayTeamRow | null =
      null


  if (
    joinedTeamIds.length >
    0
  ) {
    const {
      data:
        joinedTeamData,
      error:
        joinedTeamError,
    } =
      await supabase
        .from(
          'roam_relay_teams'
        )
        .select(`
          id,
          completed_at
        `)
        .eq(
          'relay_id',
          relayId
        )
        .eq(
          'status',
          'completed'
        )
        .in(
          'id',
          joinedTeamIds
        )
        .order(
          'completed_at',
          {
            ascending:
              false,

            nullsFirst:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle()


    if (
      joinedTeamError
    ) {
      console.error(
        '[competitions/[slug]] Completed Relay joined-team lookup failed:',
        {
          relayId,
          userId,
          error:
            joinedTeamError,
        }
      )
    }


    joinedTeam =
      joinedTeamData as
        | CompletedRelayTeamRow
        | null
  }


  const captainTeam =
    captainTeamData as
      | CompletedRelayTeamRow
      | null


  if (
    captainTeam &&
    joinedTeam
  ) {
    const captainCompletedAt =
      captainTeam.completed_at
        ? new Date(
            captainTeam.completed_at
          ).getTime()
        : 0


    const joinedCompletedAt =
      joinedTeam.completed_at
        ? new Date(
            joinedTeam.completed_at
          ).getTime()
        : 0


    return joinedCompletedAt >
      captainCompletedAt
      ? joinedTeam
      : captainTeam
  }


  return (
    captainTeam ??
    joinedTeam
  )
}


// ============================================================
// SLUG
// ============================================================

function extractCompetitionId(
  slug:
    string
): string | null {
  if (
    isUuid(
      slug
    )
  ) {
    return slug
  }


  const parts =
    slug.split(
      '--'
    )


  const candidate =
    parts[
      parts.length -
        1
    ]


  if (
    candidate &&
    isUuid(
      candidate
    )
  ) {
    return candidate
  }


  return null
}


function buildCompetitionSlug(
  competition:
    Pick<
      CompetitionRow,
      'id' | 'title'
    >
): string {
  const titleSlug =
    slugify(
      competition.title
    ) ||
    'competition'


  return `${titleSlug}--${competition.id}`
}


function slugify(
  value:
    string
): string {
  return value
    .normalize(
      'NFKD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
    .slice(
      0,
      80
    )
}


// ============================================================
// PRESENTATION
// ============================================================

function isVenueParticipationTasteDuel(
  competition:
    Pick<
      CompetitionRow,
      | 'competition_type'
      | 'taste_duel_execution_mode'
    >
): boolean {
  return (
    competition.competition_type ===
      'taste_duel' &&
    competition.taste_duel_execution_mode ===
      'venue_participation'
  )
}


function getContenderLabel(
  slot:
    number
): string {
  switch (
    slot
  ) {
    case 1:
      return 'Contender A'

    case 2:
      return 'Contender B'

    case 3:
      return 'Contender C'

    case 4:
      return 'Contender D'

    default:
      return `Contender ${slot}`
  }
}


function getContenderSectionTitle(
  competition:
    CompetitionRow
): string {
  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )


  switch (
    competition.status
  ) {
    case 'live':
      return venueParticipation
        ? 'Pick a side and visit a venue'
        : 'Choose a route to explore'

    case 'scheduled':
      return venueParticipation
        ? 'Meet the competing sides'
        : 'Routes in this competition'

    case 'scoring':
      return 'Results are being reviewed'

    case 'completed':
      return 'Competition results'

    default:
      return venueParticipation
        ? 'The matchup'
        : 'Competition routes'
  }
}


function getContenderSectionDescription(
  competition:
    CompetitionRow
): string {
  const venueParticipation =
    isVenueParticipationTasteDuel(
      competition
    )


  switch (
    competition.status
  ) {
    case 'live':
      if (
        venueParticipation
      ) {
        return 'Choose any venue from either side. Check in while you are there and rate your experience. Your real visit helps decide the winner.'
      }

      return competition.anonymous_entries
        ? 'Who created each route stays hidden for now. Choose the route that looks best to you.'
        : 'Choose a route and experience it for yourself in the city.'

    case 'scheduled':
      return venueParticipation
        ? 'See the venues going head-to-head before the competition begins.'
        : 'Take a look at the routes before the competition begins.'

    case 'scoring':
      return venueParticipation
        ? 'Check-ins are closed while the final result is being worked out.'
        : 'New attempts are closed while the results are being reviewed.'

    case 'completed':
      return venueParticipation
        ? 'The competition is over. The winning side is marked below.'
        : 'The competition is over. The winning route is marked below.'

    default:
      return venueParticipation
        ? 'See the venues competing against each other.'
        : 'Explore the routes in this competition.'
  }
}


function getStatusPresentation(
  competition:
    CompetitionRow
): {
  label:
    string

  className:
    string
} {
  switch (
    competition.status
  ) {
    case 'live':
      return {
        label:
          'Live',

        className:
          'border-red-400/20 bg-red-400/[0.07] text-red-200',
      }

    case 'scheduled':
      return {
        label:
          'Upcoming',

        className:
          'border-sky-300/15 bg-sky-300/[0.055] text-sky-100',
      }

    case 'scoring':
      return {
        label:
          'Reviewing results',

        className:
          'border-violet-300/15 bg-violet-300/[0.055] text-violet-100',
      }

    case 'completed':
      return {
        label:
          'Completed',

        className:
          'border-emerald-300/15 bg-emerald-300/[0.045] text-emerald-100',
      }

    default:
      return {
        label:
          competition.status,

        className:
          'border-white/[0.07] bg-white/[0.035] text-zinc-500',
      }
  }
}


function formatCompetitionType(
  value:
    string
): string {
  if (
    value ===
    'taste_duel'
  ) {
    return 'Taste Duel'
  }


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


function formatResultStatus(
  status:
    CompetitionResultStatus
): string {
  switch (
    status
  ) {
    case 'winner':
      return 'Winner selected'

    case 'tie':
      return 'Tie'

    case 'insufficient_evidence':
      return 'Not enough visits'

    case 'void':
      return 'No result'

    case 'pending':
    default:
      return 'Waiting for results'
  }
}


function formatCompetitionDate(
  value:
    string | null
): string {
  if (
    !value
  ) {
    return 'TBA'
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
    return 'TBA'
  }


  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',

      year:
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


// ============================================================
// SECURITY / HELPERS
// ============================================================

function createCompetitionServiceClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL


  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY


  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      'Competition service client is not configured.'
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


function isPublicCompetitionStatus(
  status:
    CompetitionStatus
): boolean {
  return (
    status ===
      'scheduled' ||
    status ===
      'live' ||
    status ===
      'scoring' ||
    status ===
      'completed'
  )
}


function isUuid(
  value:
    string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}


function firstSearchParam(
  value:
    | string
    | string[]
    | undefined
): string | null {
  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value[0] ??
      null
    )
  }


  return value ??
    null
}