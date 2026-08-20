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


type CompetitionRow = {
  id:
    string

  competition_type:
    string

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
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-24 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mb-7">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/45 transition hover:text-white"
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
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-100">
            {startError}
          </div>
        ) : null}


        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <SectionHeading
              eyebrow={
                competition.status ===
                'completed'
                  ? 'Results'
                  : 'Routes'
              }
              title={
                competition.status ===
                'live'
                  ? 'Choose a route to explore'
                  : competition.status ===
                      'scheduled'
                    ? 'Routes in this competition'
                    : competition.status ===
                        'scoring'
                      ? 'Results are being reviewed'
                      : 'Competition results'
              }
              description={
                getContenderSectionDescription(
                  competition
                )
              }
            />


            {entriesError ? (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.025] p-6">
                <p className="text-sm text-white/50">
                  Contender routes could not be loaded right now.
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
                status={
                  competition.status
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

  eligibility:
    RelayEligibilityPresentation

  signedIn:
    boolean

  createTeamAction:
    () => Promise<void>
}) {
  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-24 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mb-7">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/45 transition hover:text-white"
          >
            <span
              aria-hidden="true"
            >
              ←
            </span>

            Competitions
          </Link>
        </div>


        {/* ====================================================
         * HERO
         * ==================================================== */}

        <header className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-5 sm:p-7 lg:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-300/[0.06] blur-3xl"
          />


          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <RelayStatusBadge
                kind="relay"
                status={
                  relay.status
                }
              />


              {relay.partnerCampaignId ? (
                <span className="inline-flex items-center rounded-full border border-violet-300/15 bg-violet-300/[0.055] px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.13em] text-violet-100/75">
                  Partner Relay
                </span>
              ) : null}


              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.13em] text-white/38">
                One leg at a time
              </span>
            </div>


            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/45">
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


            <h1 className="mt-2 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              {relay.title}
            </h1>


            {relay.description ? (
              <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/50 sm:text-base">
                {
                  relay.description
                }
              </p>
            ) : (
              <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/42 sm:text-base">
                Build one route together. Each teammate owns one
                leg, completes it in the city, and passes the baton
                to the next person.
              </p>
            )}


            <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
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


        {/* ====================================================
         * BRIEF + ELIGIBILITY
         * ==================================================== */}

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
              How it works
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              One team. One route. One leg at a time.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
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
            signedIn={
              signedIn
            }
            createTeamAction={
              createTeamAction
            }
          />
        </div>

{/* ====================================================
         * SLOT SEQUENCE
         * ==================================================== */}

        <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
                Your Relay route
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                The route your team will build
              </h2>
            </div>


            <p className="max-w-md text-sm leading-6 text-white/38">
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


        {/* ====================================================
         * REWARD
         * ==================================================== */}

        {rewardPolicy ? (
          <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
                Competition reward
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                What the winning team earns
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
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


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        <footer className="mt-8 border-t border-white/[0.07] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-white/28">
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
    <div className="bg-[#0b0b0b] px-4 py-4 sm:px-5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-medium leading-6 text-white/68">
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
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-amber-100/38">
        {number}
      </p>

      <p className="mt-2 text-sm font-semibold text-white/78">
        {title}
      </p>

      <p className="mt-1.5 text-xs leading-5 text-white/34">
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
  signedIn,
  createTeamAction,
}: {
  eligibility:
    RelayEligibilityPresentation

  existingTeam:
    RelayTeam | null

  signedIn:
    boolean

  createTeamAction:
    () => Promise<void>
}) {
  const toneClassName =
    eligibility.tone ===
    'open'
      ? 'border-emerald-300/14 bg-emerald-300/[0.045]'
      : eligibility.tone ===
          'upcoming'
        ? 'border-amber-300/14 bg-amber-300/[0.045]'
        : eligibility.tone ===
            'closed'
          ? 'border-white/[0.07] bg-white/[0.02]'
          : 'border-violet-300/12 bg-violet-300/[0.04]'


  return (
    <aside
      className={[
        'rounded-[26px]',
        'border',
        'p-5',
        toneClassName,
      ].join(
        ' '
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
        Your team
      </p>


      <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
        {
          eligibility.label
        }
      </h2>


      <p className="mt-2 text-sm leading-6 text-white/42">
        {
          eligibility.description
        }
      </p>


      {existingTeam ? (
        <div className="mt-5">
          <div className="rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
              Your team
            </p>

            <p className="mt-1.5 text-sm font-semibold capitalize text-white/72">
              {
                existingTeam.status
              }
            </p>

            <p className="mt-1 text-xs leading-5 text-white/32">
              You already have a team for this Relay. Open it to see
              your teammates, assignments, and progress.
            </p>
          </div>


          <Link
            href={`/competitions/team/${existingTeam.id}`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-violet-300/16 bg-violet-300/[0.055] px-5 text-sm font-semibold text-violet-50 transition hover:border-violet-300/25 hover:bg-violet-300/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
          >
            View your Relay team
          </Link>
        </div>
      ) : eligibility.canFormTeam ? (
        <form
          action={
            createTeamAction
          }
          className="mt-5"
        >
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/[0.09] px-5 text-sm font-semibold text-amber-50 transition hover:border-amber-300/30 hover:bg-amber-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
          >
            Form a Relay team
          </button>
        </form>
      ) : !signedIn ? (
        <Link
          href="/login"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/[0.08] bg-black/15 px-4 text-xs font-semibold text-white/48 transition hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/70"
        >
          Sign in to form a team
        </Link>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3.5 text-center text-xs font-medium text-white/38">
          Team formation unavailable
        </div>
      )}


      <p className="mt-4 text-[10px] leading-5 text-white/23">
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


  return (
    <header className="relative overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-transparent p-6 sm:p-8 lg:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 h-96 w-96 rounded-full bg-amber-300/[0.055] blur-3xl"
      />


      {competition.status ===
      'live' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-red-500/[0.055] blur-3xl"
        />
      ) : null}


      <div className="relative max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
              status.className,
            ].join(
              ' '
            )}
          >
            {
              status.label
            }
          </span>


          <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {formatCompetitionType(
              competition.competition_type
            )}
          </span>


          {competition.anonymous_entries &&
          competition.status !==
            'completed' ? (
            <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Identities hidden
            </span>
          ) : null}
        </div>


        <h1 className="mt-7 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
          {
            competition.title
          }
        </h1>


        {competition.description ? (
          <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/55 sm:text-base">
            {
              competition.description
            }
          </p>
        ) : (
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
            Try the competing routes for yourself. Your real-world
            check-ins help determine which route comes out on top.
          </p>
        )}


        <div className="mt-8 flex flex-wrap gap-2">
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
  const canStart =
    competition.status ===
    'live'


  return (
    <article
      className={[
        'relative overflow-hidden rounded-[26px] border p-5 sm:p-6',
        contender.isWinner
          ? 'border-amber-300/30 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.025] to-transparent'
          : 'border-white/10 bg-white/[0.025]',
      ].join(
        ' '
      )}
    >
      {contender.isWinner ? (
        <div className="mb-5 inline-flex rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
          Winner
        </div>
      ) : null}


      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
            Route{' '}
            {
              contender.slot
            }
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
            {
              contender.label
            }
          </h2>
        </div>


        <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/45">
          {
            contender.venueIds.length
          }{' '}
          stops
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
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold text-white/40">
                {index +
                  1}
              </span>


              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white/80">
                  {
                    venue.name
                  }
                </div>


                {venue.city ? (
                  <div className="mt-0.5 truncate text-[11px] text-white/30">
                    {
                      venue.city
                    }
                  </div>
                ) : null}
              </div>
            </li>
          )
        )}
      </ol>


      <div className="mt-6 border-t border-white/[0.07] pt-5">
        {canStart ? (
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
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100"
            >
              Sign in to explore
            </Link>
          )
        ) : competition.status ===
          'scheduled' ? (
          <div className="text-center text-xs font-medium text-white/35">
            You can start this route when the competition goes live.
          </div>
        ) : competition.status ===
          'scoring' ? (
          <div className="text-center text-xs font-medium text-violet-200/55">
            Exploring is closed while the results are being reviewed.
          </div>
        ) : contender.isWinner ? (
          <div className="text-center text-xs font-semibold text-amber-100/75">
            Winning route
          </div>
        ) : (
          <div className="text-center text-xs font-medium text-white/35">
            This competition has ended.
          </div>
        )}
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
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
        Competition details
      </p>


      <dl className="mt-5 divide-y divide-white/[0.07]">
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
          label="Routes"
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
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
        How this works
      </p>


      <div className="mt-4 space-y-4 text-sm leading-6 text-white/45">
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
      <dt className="text-xs text-white/30">
        {label}
      </dt>

      <dd className="text-right text-xs font-semibold text-white/65">
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
    <div className="border-b border-white/[0.08] pb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
        {title}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
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
    <span className="inline-flex rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[11px] font-medium text-white/45">
      {children}
    </span>
  )
}


function EmptyContenders({
  status,
}: {
  status:
    CompetitionStatus
}) {
  return (
    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.025] p-8 text-center">
      <p className="text-sm font-medium text-white/55">
        {status ===
        'scheduled'
          ? 'Routes have not been published yet.'
          : 'No routes are available right now.'}
      </p>
    </div>
  )
}


function CompetitionLoadError() {
  return (
    <main className="min-h-screen bg-[#070707] px-4 py-16 text-white">
      <div className="mx-auto max-w-2xl rounded-[26px] border border-red-400/15 bg-red-400/[0.04] p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-200/60">
          Competition unavailable
        </p>

        <h1 className="mt-3 text-2xl font-semibold">
          This competition could not be loaded.
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/45">
          Nothing was changed. Try again in a moment.
        </p>

        <Link
          href="/competitions"
          className="mt-6 inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05] hover:text-white"
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


function getContenderSectionDescription(
  competition:
    CompetitionRow
): string {
  switch (
    competition.status
  ) {
    case 'live':
      return competition.anonymous_entries
        ? 'Who created each route stays hidden for now. Choose the route that looks best to you.'
        : 'Choose a route and experience it for yourself in the city.'

    case 'scheduled':
      return 'Take a look at the routes before the competition begins.'

    case 'scoring':
      return 'New attempts are closed while the results are being reviewed.'

    case 'completed':
      return 'The competition is over. The winning route is marked below.'

    default:
      return 'Explore the routes in this competition.'
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
          'border-red-400/25 bg-red-400/[0.08] text-red-200',
      }

    case 'scheduled':
      return {
        label:
          'Upcoming',

        className:
          'border-sky-300/20 bg-sky-300/[0.06] text-sky-100',
      }

    case 'scoring':
      return {
        label:
          'Reviewing results',

        className:
          'border-violet-300/20 bg-violet-300/[0.06] text-violet-100',
      }

    case 'completed':
      return {
        label:
          'Completed',

        className:
          'border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-100',
      }

    default:
      return {
        label:
          competition.status,

        className:
          'border-white/10 bg-white/[0.04] text-white/50',
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
      return 'Not enough completed visits'

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