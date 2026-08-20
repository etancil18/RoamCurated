import Link from 'next/link'

import CompetitionSubmitButton from '@/components/competitions/CompetitionSubmitButton'
import RelayCard from '@/components/relay/RelayCard'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CompetitionsPageSearchParams = {
  submit_source?: string | string[]
  flow_session_id?: string | string[]
  visit_date?: string | string[]
}

type CompetitionsPageProps = {
  searchParams?: Promise<CompetitionsPageSearchParams>
}

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
  id: string
  competition_type: string
  title: string
  description: string | null
  city: string | null
  category: string | null
  status: CompetitionStatus
  starts_at: string | null
  ends_at: string | null
  max_entries: number
  result_status: CompetitionResultStatus
  xp_reward: number
  anonymous_entries: boolean
  relay_id: string | null
  created_at: string
}

type RelayStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'cancelled'

type PublicRelayStatus =
  | 'scheduled'
  | 'live'
  | 'completed'

type RelayRow = {
  id: string
  title: string
  description: string | null
  city: string
  theme: string | null
  status: RelayStatus
  min_team_size: number
  max_team_size: number
  starts_at: string | null
  ends_at: string | null
  partner_campaign_id: string | null
  created_at: string
}

type RelaySlotCountRow = {
  relay_id: string
}

type SubmissionIntent =
  | {
      source: 'active_flow'
      flowSessionId: string
      visitDate: null
    }
  | {
      source: 'visit_history'
      flowSessionId: null
      visitDate: string
    }

const STATUS_PRIORITY: Record<
  CompetitionStatus,
  number
> = {
  live: 0,
  scheduled: 1,
  scoring: 2,
  completed: 3,
  draft: 4,
  cancelled: 5,
}

const PUBLIC_STATUSES: CompetitionStatus[] = [
  'live',
  'scheduled',
  'scoring',
  'completed',
]

export default async function CompetitionsPage({
  searchParams,
}: CompetitionsPageProps) {
  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : {}

  const submissionIntent =
    parseSubmissionIntent(
      resolvedSearchParams
    )

  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()

  const {
    data,
    error,
  } = await supabase
    .from(
      'competitions'
    )
    .select(`
      id,
      competition_type,
      title,
      description,
      city,
      category,
      status,
      starts_at,
      ends_at,
      max_entries,
      result_status,
      xp_reward,
      anonymous_entries,
      relay_id,
      created_at
    `)
    .in(
      'status',
      PUBLIC_STATUSES
    )

  if (error) {
    console.error(
      '[competitions/page] Competition fetch failed:',
      error
    )
  }

  const competitions =
    (
      data ??
      []
    ) as CompetitionRow[]

  const relayCompetitions =
    competitions.filter(
      (
        competition
      ): competition is CompetitionRow & {
        relay_id: string
        status: PublicRelayStatus
      } =>
        competition.competition_type ===
          'roam_relay' &&
        Boolean(
          competition.relay_id
        ) &&
        (
          competition.status ===
            'live' ||
          competition.status ===
            'scheduled' ||
          competition.status ===
            'completed'
        )
    )

  const sortedCompetitions =
    competitions
      .filter(
        (
          competition
        ) =>
          competition.competition_type !==
            'roam_relay' &&
          PUBLIC_STATUSES.includes(
            competition.status
          )
      )
      .sort(
        compareCompetitions
      )

  const liveCompetitions =
    sortedCompetitions.filter(
      (
        competition
      ) =>
        competition.status ===
        'live'
    )

  const scheduledCompetitions =
    sortedCompetitions.filter(
      (
        competition
      ) =>
        competition.status ===
        'scheduled'
    )

  const scoringCompetitions =
    sortedCompetitions.filter(
      (
        competition
      ) =>
        competition.status ===
        'scoring'
    )

  const completedCompetitions =
    sortedCompetitions.filter(
      (
        competition
      ) =>
        competition.status ===
        'completed'
    )

  // ==========================================================
  // RELAY DISCOVERY
  // ==========================================================
  //
  // Relay is intentionally discovered on the canonical
  // competitions surface rather than through a separate
  // /relay index.
  //
  // Public lifecycle comes from the associated competition row.
  //
  // This read path:
  //
  //   - uses the authenticated server client
  //   - respects Relay RLS
  //   - exposes only public lifecycle states
  //   - derives slot count without exposing team/member identity
  // ==========================================================

  const relayIds =
    relayCompetitions.map(
      (competition) =>
        competition.relay_id
    )

  let relayData:
    RelayRow[] = []

  let relayError:
    {
      message: string
    } | null = null

  if (
    relayIds.length >
    0
  ) {
    const result =
      await supabase
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
          min_team_size,
          max_team_size,
          starts_at,
          ends_at,
          partner_campaign_id,
          created_at
        `)
        .in(
          'id',
          relayIds
        )

    if (result.error) {
      console.error(
        '[competitions/page] Relay fetch failed:',
        result.error
      )

      relayError =
        result.error
    } else {
      relayData =
        (
          result.data ??
          []
        ) as RelayRow[]
    }
  }

  const relayRows =
    relayData

  let relaySlotCountRows:
    RelaySlotCountRow[] = []

  let relaySlotCountError:
    string | null = null

  if (
    relayIds.length >
    0
  ) {
    const {
      data: relaySlotData,
      error: slotError,
    } = await supabase
      .from(
        'roam_relay_slots'
      )
      .select(
        'relay_id'
      )
      .in(
        'relay_id',
        relayIds
      )

    if (slotError) {
      console.error(
        '[competitions/page] Relay slot-count fetch failed:',
        slotError
      )

      relaySlotCountError =
        slotError.message
    } else {
      relaySlotCountRows =
        (
          relaySlotData ??
          []
        ) as RelaySlotCountRow[]
    }
  }

  const relaySlotCountByRelayId =
    new Map<
      string,
      number
    >()

  for (
    const slot
    of relaySlotCountRows
  ) {
    relaySlotCountByRelayId.set(
      slot.relay_id,
      (
        relaySlotCountByRelayId.get(
          slot.relay_id
        ) ??
        0
      ) +
        1
    )
  }

  const relayCompetitionByRelayId =
    new Map(
      relayCompetitions.map(
        (competition) => [
          competition.relay_id,
          competition,
        ] as const
      )
    )

  const relays =
    relayRows
      .map(
        (relay) => {
          const competition =
            relayCompetitionByRelayId.get(
              relay.id
            )

          if (!competition) {
            return null
          }

          return {
            ...relay,

            competitionId:
              competition.id,

            /*
             * Public Relay lifecycle is owned by the canonical
             * competition wrapper.
             */
            status:
              competition.status,
          }
        }
      )
      .filter(
        (
          relay
        ): relay is RelayRow & {
          competitionId:
            string
          status:
            PublicRelayStatus
        } =>
          relay !==
            null &&
          isPublicRelayStatus(
            relay.status
          )
      )
      .sort(
        compareRelays
      )
      .map(
        (relay) => ({
          id:
            relay.id,

          competitionId:
            relay.competitionId,

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

          startsAt:
            relay.starts_at,

          endsAt:
            relay.ends_at,

          minTeamSize:
            relay.min_team_size,

          maxTeamSize:
            relay.max_team_size,

          slotCount:
            relaySlotCountByRelayId.get(
              relay.id
            ) ??
            0,

          hasPartner:
            Boolean(
              relay.partner_campaign_id
            ),
        })
      )

  const liveRelayCount =
    relays.filter(
      (
        relay
      ) =>
        relay.status ===
        'live'
    ).length

  const scheduledRelayCount =
    relays.filter(
      (
        relay
      ) =>
        relay.status ===
        'scheduled'
    ).length

  const completedRelayCount =
    relays.filter(
      (
        relay
      ) =>
        relay.status ===
        'completed'
    ).length

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.06] via-white/[0.028] to-indigo-400/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

            <div className="absolute -bottom-28 right-[-4rem] h-72 w-72 rounded-full bg-indigo-400/[0.05] blur-[110px]" />
          </div>

          <div className="relative z-10 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-px w-5 bg-cyan-300/60" />

                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300 sm:text-xs">
                    Roam Competitions
                  </p>
                </div>

                {liveCompetitions.length +
                  liveRelayCount >
                0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-red-400/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200 ring-1 ring-red-400/15">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />

                    {liveCompetitions.length +
                      liveRelayCount}{' '}
                    live
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.03]">
                Put your taste on
                the line.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
                Explore anonymous
                contender routes,
                complete them in the
                city, and help decide
                which taste holds up
                in the real world.
              </p>
            </div>

            <div className="min-w-0 rounded-[1.6rem] bg-black/25 p-4 ring-1 ring-white/[0.055] sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-300/[0.08] text-lg text-indigo-200 ring-1 ring-indigo-300/15"
                >
                  ✦
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-black tracking-tight text-white">
                    Competition board
                  </p>

                  <p className="mt-1.5 text-xs leading-5 text-zinc-600 sm:text-sm sm:leading-6">
                    See what is live,
                    what is coming next,
                    and which competitions
                    have already been
                    decided.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat
                  label="Live"
                  value={
                    liveCompetitions.length +
                    liveRelayCount
                  }
                  accent
                />

                <Stat
                  label="Upcoming"
                  value={
                    scheduledCompetitions.length +
                    scheduledRelayCount
                  }
                />

                <Stat
                  label="Settled"
                  value={
                    completedCompetitions.length +
                    completedRelayCount
                  }
                />
              </div>
            </div>
          </div>
        </header>

        {submissionIntent ? (
          <SubmissionIntentBanner
            intent={
              submissionIntent
            }
            signedIn={
              Boolean(user)
            }
          />
        ) : null}

        <RelayDiscoverySection
          relays={
            relays
          }
          loadError={
            relayError
              ?.message ??
            relaySlotCountError
          }
        />

        {error ? (
          <CompetitionLoadError />
        ) : (
          <div className="mt-14 space-y-16 sm:mt-16 sm:space-y-20">
            {liveCompetitions.length >
            0 ? (
              <CompetitionSection
                eyebrow="Happening now"
                title="Live duels"
                description="Routes are anonymous while the competition is live. Explore the contenders without follower counts, creator reputation, or identity shaping the result."
                competitions={
                  liveCompetitions
                }
                submissionIntent={
                  submissionIntent
                }
                signedIn={
                  Boolean(user)
                }
                live
              />
            ) : (
              <EmptyLiveState />
            )}

            {scheduledCompetitions.length >
            0 ? (
              <CompetitionSection
                eyebrow="On deck"
                title="Upcoming"
                description="See what is opening next and decide which competition deserves a night out."
                competitions={
                  scheduledCompetitions
                }
                submissionIntent={
                  submissionIntent
                }
                signedIn={
                  Boolean(user)
                }
              />
            ) : null}

            {scoringCompetitions.length >
            0 ? (
              <CompetitionSection
                eyebrow="Decision time"
                title="Scoring"
                description="Participation has closed. Evidence and contender scores are being resolved before identities are revealed."
                competitions={
                  scoringCompetitions
                }
                submissionIntent={
                  null
                }
                signedIn={
                  Boolean(user)
                }
              />
            ) : null}

            {completedCompetitions.length >
            0 ? (
              <CompetitionSection
                eyebrow="Archive"
                title="Settled"
                description="Finished competitions, resolved outcomes, and the routes that survived real-world exploration."
                competitions={
                  completedCompetitions
                    .slice(
                      0,
                      12
                    )
                }
                submissionIntent={
                  null
                }
                signedIn={
                  Boolean(user)
                }
              />
            ) : null}

            {sortedCompetitions.length ===
              0 &&
            relays.length ===
              0 ? (
              <EmptyCompetitionState />
            ) : null}
          </div>
        )}
      </div>
    </main>
  )
}

function RelayDiscoverySection({
  relays,
  loadError,
}: {
  relays: Array<{
    id: string
    competitionId: string
    title: string
    description: string | null
    city: string
    theme: string | null
    status: PublicRelayStatus
    startsAt: string | null
    endsAt: string | null
    minTeamSize: number
    maxTeamSize: number
    slotCount: number
    hasPartner: boolean
  }>
  loadError: string | null
}) {
  if (
    loadError &&
    relays.length ===
      0
  ) {
    return (
      <section className="mt-10 rounded-[2rem] bg-amber-300/[0.025] p-5 ring-1 ring-amber-300/10 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-amber-300/60" />

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/70">
            Roam Relay
          </p>
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
          Relays are temporarily unavailable.
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-500">
          The rest of the competition board is unaffected.
        </p>
      </section>
    )
  }

  if (
    relays.length ===
    0
  ) {
    return null
  }

  return (
    <section className="mt-14 sm:mt-16">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-cyan-300/60" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Team competition
            </p>
          </div>

          <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]">
            Roam Relay
          </h2>
        </div>

        <p className="max-w-xl text-sm leading-6 text-zinc-500">
          Build one route together. Each teammate owns one leg,
          completes it in the city, and passes the baton forward.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {relays.map(
          (relay) => (
            <RelayCard
              key={
                relay.id
              }
              relay={
                relay
              }
            />
          )
        )}
      </div>
    </section>
  )
}

function CompetitionSection({
  eyebrow,
  title,
  description,
  competitions,
  submissionIntent,
  signedIn,
  live = false,
}: {
  eyebrow: string
  title: string
  description: string
  competitions: CompetitionRow[]
  submissionIntent: SubmissionIntent | null
  signedIn: boolean
  live?: boolean
}) {
  return (
    <section>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
        </div>

        <p className="max-w-xl text-sm leading-6 text-zinc-500">
          {description}
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {competitions.map(
          (
            competition
          ) => (
            <CompetitionCard
              key={
                competition.id
              }
              competition={
                competition
              }
              submissionIntent={
                submissionIntent
              }
              signedIn={
                signedIn
              }
              emphasized={
                live
              }
            />
          )
        )}
      </div>
    </section>
  )
}

function CompetitionCard({
  competition,
  submissionIntent,
  signedIn,
  emphasized,
}: {
  competition: CompetitionRow
  submissionIntent: SubmissionIntent | null
  signedIn: boolean
  emphasized: boolean
}) {
  const status =
    getStatusPresentation(
      competition
    )

  const startLabel =
    formatCompetitionDate(
      competition.starts_at
    )

  const endLabel =
    formatCompetitionDate(
      competition.ends_at
    )

  return (
    <article
      className={[
        'group relative overflow-hidden rounded-[1.75rem] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 transition sm:p-6',
        emphasized
          ? 'bg-gradient-to-br from-red-400/[0.065] via-white/[0.032] to-indigo-400/[0.025] ring-red-300/15'
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
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]',
                status.className,
              ].join(
                ' '
              )}
            >
              {status.label}
            </span>

            <span className="rounded-full bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 ring-1 ring-white/[0.07]">
              {formatCompetitionType(
                competition.competition_type
              )}
            </span>
          </div>

          {competition.xp_reward >
          0 ? (
            <div className="shrink-0 text-right">
              <div className="text-sm font-black text-amber-200">
                +
                {
                  competition.xp_reward
                }{' '}
                XP
              </div>

              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                reward
              </div>
            </div>
          ) : null}
        </div>

        <h3 className="mt-6 text-2xl font-black tracking-[-0.035em] text-white">
          {competition.title}
        </h3>

        {competition.description ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-500">
            {
              competition.description
            }
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Anonymous routes.
            Verified exploration.
            Taste decided in the
            city.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {competition.city ? (
            <MetaChip
              value={
                competition.city
              }
            />
          ) : null}

          {competition.category ? (
            <MetaChip
              value={
                competition.category
              }
            />
          ) : null}

          <MetaChip
            value={`${competition.max_entries} contenders max`}
          />

          {competition.anonymous_entries ? (
            <MetaChip
              value="Anonymous live"
            />
          ) : null}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-2">
          <TimelineCell
            label="Starts"
            value={
              startLabel
            }
          />

          <TimelineCell
            label="Ends"
            value={
              endLabel
            }
          />
        </dl>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-zinc-600">
            {getCompetitionFooter(
              competition
            )}
          </p>

          <CompetitionAction
            competition={
              competition
            }
            submissionIntent={
              submissionIntent
            }
            signedIn={
              signedIn
            }
          />
        </div>
      </div>
    </article>
  )
}

function CompetitionAction({
  competition,
  submissionIntent,
  signedIn,
}: {
  competition: CompetitionRow
  submissionIntent: SubmissionIntent | null
  signedIn: boolean
}) {
  if (
    submissionIntent &&
    (
      competition.status ===
        'live' ||
      competition.status ===
        'scheduled'
    )
  ) {
    if (!signedIn) {
      return (
        <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-500 ring-1 ring-white/[0.07]">
          Sign in to submit
        </span>
      )
    }

    return (
      <CompetitionSubmitButton
        competitionId={
          competition.id
        }
        submissionIntent={
          submissionIntent
        }
      />
    )
  }

  const href =
    buildCompetitionDetailHref(
      competition
    )

  if (
    competition.status ===
    'live'
  ) {
    return (
      <Link
        href={href}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-red-400/[0.08] px-4 text-xs font-bold text-red-100 ring-1 ring-red-400/20 transition hover:bg-red-400/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
      >
        View live duel
      </Link>
    )
  }

  if (
    competition.status ===
    'scheduled'
  ) {
    return (
      <Link
        href={href}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
      >
        Preview contenders
      </Link>
    )
  }

  if (
    competition.status ===
    'scoring'
  ) {
    return (
      <Link
        href={href}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-violet-300/[0.05] px-4 text-xs font-bold text-violet-100/80 ring-1 ring-violet-300/15 transition hover:bg-violet-300/[0.09] hover:text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
      >
        View scoring
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-300/[0.035] px-4 text-xs font-bold text-emerald-100/70 ring-1 ring-emerald-300/15 transition hover:bg-emerald-300/[0.07] hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
    >
      View result
    </Link>
  )
}

function SubmissionIntentBanner({
  intent,
  signedIn,
}: {
  intent: SubmissionIntent
  signedIn: boolean
}) {
  const isActiveFlow =
    intent.source ===
    'active_flow'

  return (
    <section className="mt-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-amber-300/[0.08] via-white/[0.025] to-indigo-400/[0.025] p-5 ring-1 ring-amber-300/12 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-amber-300/60" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/75">
              Ready to enter
            </p>
          </div>

          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
            {isActiveFlow
              ? 'Choose a competition for this completed Roam.'
              : 'Choose a competition for this Visit History route.'}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {signedIn
              ? 'Your source stays attached while you choose. Final eligibility is revalidated by the competition submission API before anything enters moderation.'
              : 'Your route is ready, but you must be signed in before it can be submitted for moderation.'}
          </p>
        </div>

        <Link
          href="/competitions"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white"
        >
          Clear submission
        </Link>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div className="min-w-0 rounded-[1.1rem] bg-white/[0.025] px-3 py-3 text-left ring-1 ring-white/[0.05]">
      <div
        className={[
          'truncate text-sm font-black tracking-tight',
          accent
            ? 'text-red-300'
            : 'text-white',
        ].join(
          ' '
        )}
      >
        {value}
      </div>

      <div className="mt-1 truncate text-[9px] font-medium text-zinc-700">
        {label}
      </div>
    </div>
  )
}

function MetaChip({
  value,
}: {
  value: string
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-zinc-500 ring-1 ring-white/[0.06]">
      {value}
    </span>
  )
}

function TimelineCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-3.5 ring-1 ring-white/[0.055]">
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-700">
        {label}
      </dt>

      <dd className="mt-1.5 text-xs font-bold text-zinc-400">
        {value}
      </dd>
    </div>
  )
}

function EmptyLiveState() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.02] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-8 lg:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-300/[0.05] blur-[100px]" />
      </div>

      <div className="relative max-w-xl">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-cyan-300/60" />

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Between rounds
          </p>
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]">
          No duel is live right
          now.
        </h2>

        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Upcoming competitions
          will appear here before
          they open. Once live,
          contender identity stays
          hidden until settlement.
        </p>
      </div>
    </section>
  )
}

function EmptyCompetitionState() {
  return (
    <section className="rounded-[2rem] bg-white/[0.025] px-6 py-16 text-center ring-1 ring-white/[0.06]">
      <div className="mx-auto flex w-fit items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          No competitions yet
        </p>

        <span className="h-px w-5 bg-cyan-300/60" />
      </div>

      <h2 className="mx-auto mt-3 max-w-lg text-2xl font-black tracking-[-0.035em] text-white">
        The city is quiet for the
        moment.
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500">
        When the next Taste Duel
        opens, it will appear here.
      </p>
    </section>
  )
}

function CompetitionLoadError() {
  return (
    <section className="mt-10 rounded-[1.75rem] bg-red-400/[0.035] p-6 ring-1 ring-red-400/15">
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-red-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/70">
          Competitions unavailable
        </p>
      </div>

      <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
        The competition board
        could not be loaded.
      </h2>

      <p className="mt-2 text-sm leading-6 text-zinc-500">
        Try refreshing the page.
        No competition state was
        changed.
      </p>
    </section>
  )
}

function parseSubmissionIntent(
  searchParams: CompetitionsPageSearchParams
): SubmissionIntent | null {
  const source =
    firstSearchParam(
      searchParams.submit_source
    )

  if (
    source ===
    'active_flow'
  ) {
    const flowSessionId =
      firstSearchParam(
        searchParams.flow_session_id
      )

    if (
      flowSessionId &&
      isUuid(
        flowSessionId
      )
    ) {
      return {
        source:
          'active_flow',

        flowSessionId,

        visitDate:
          null,
      }
    }

    return null
  }

  if (
    source ===
    'visit_history'
  ) {
    const visitDate =
      firstSearchParam(
        searchParams.visit_date
      )

    if (
      visitDate &&
      isIsoDate(
        visitDate
      )
    ) {
      return {
        source:
          'visit_history',

        flowSessionId:
          null,

        visitDate,
      }
    }
  }

  return null
}

function buildCompetitionDetailHref(
  competition: Pick<
    CompetitionRow,
    'id' | 'title'
  >
): string {
  const titleSlug =
    slugify(
      competition.title
    ) ||
    'competition'

  return `/competitions/${titleSlug}--${competition.id}`
}

function slugify(
  value: string
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

function buildCompetitionSubmissionHref(
  competitionId: string,
  intent: SubmissionIntent
): string {
  const params =
    new URLSearchParams()

  params.set(
    'competition_id',
    competitionId
  )

  params.set(
    'submit_source',
    intent.source
  )

  if (
    intent.source ===
    'active_flow'
  ) {
    params.set(
      'flow_session_id',
      intent.flowSessionId
    )
  } else {
    params.set(
      'visit_date',
      intent.visitDate
    )
  }

  /**
   * This keeps competition selection explicit without directly
   * mutating submission state from the discovery page.
   *
   * The same page receives the selected competition ID so the next
   * submission UI layer can consume it without losing source
   * context.
   */
  return `/competitions?${params.toString()}`
}

function compareCompetitions(
  left: CompetitionRow,
  right: CompetitionRow
): number {
  const statusDifference =
    STATUS_PRIORITY[
      left.status
    ] -
    STATUS_PRIORITY[
      right.status
    ]

  if (
    statusDifference !==
    0
  ) {
    return statusDifference
  }

  if (
    left.status ===
      'completed' &&
    right.status ===
      'completed'
  ) {
    return (
      toTimestamp(
        right.ends_at ??
          right.created_at
      ) -
      toTimestamp(
        left.ends_at ??
          left.created_at
      )
    )
  }

  return (
    toTimestamp(
      left.starts_at ??
        left.created_at
    ) -
    toTimestamp(
      right.starts_at ??
        right.created_at
    )
  )
}

function compareRelays(
  left: RelayRow,
  right: RelayRow
): number {
  const priority:
    Record<
      RelayStatus,
      number
    > = {
      live:
        0,

      scheduled:
        1,

      completed:
        2,

      draft:
        3,

      cancelled:
        4,
    }

  const statusDifference =
    priority[
      left.status
    ] -
    priority[
      right.status
    ]

  if (
    statusDifference !==
    0
  ) {
    return statusDifference
  }

  if (
    left.status ===
      'completed' &&
    right.status ===
      'completed'
  ) {
    return (
      toTimestamp(
        right.ends_at ??
          right.created_at
      ) -
      toTimestamp(
        left.ends_at ??
          left.created_at
      )
    )
  }

  return (
    toTimestamp(
      left.starts_at ??
        left.created_at
    ) -
    toTimestamp(
      right.starts_at ??
        right.created_at
    )
  )
}

function isPublicRelayStatus(
  status: RelayStatus
): status is PublicRelayStatus {
  return (
    status === 'live' ||
    status === 'scheduled' ||
    status === 'completed'
  )
}

function getStatusPresentation(
  competition: CompetitionRow
): {
  label: string
  className: string
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
          'Scoring',

        className:
          'border-violet-300/15 bg-violet-300/[0.055] text-violet-100',
      }

    case 'completed':
      return {
        label:
          'Settled',

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

function getCompetitionFooter(
  competition: CompetitionRow
): string {
  if (
    competition.status ===
    'live'
  ) {
    return competition.anonymous_entries
      ? 'Contender identities reveal after settlement.'
      : 'Competition is currently open.'
  }

  if (
    competition.status ===
    'scheduled'
  ) {
    return 'Competition has not opened yet.'
  }

  if (
    competition.status ===
    'scoring'
  ) {
    return 'New participation is closed while the result is resolved.'
  }

  return formatResultStatus(
    competition.result_status
  )
}

function formatCompetitionType(
  value: string
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
  status: CompetitionResultStatus
): string {
  switch (status) {
    case 'winner':
      return 'Winner settled'

    case 'tie':
      return 'Settled as a tie'

    case 'insufficient_evidence':
      return 'Insufficient evidence'

    case 'void':
      return 'Competition voided'

    case 'pending':
    default:
      return 'Result pending'
  }
}

function formatCompetitionDate(
  value: string | null
): string {
  if (!value) {
    return 'TBA'
  }

  const date =
    new Date(value)

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

      hour:
        'numeric',

      minute:
        '2-digit',
    }
  ).format(
    date
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
    return value[0] ??
      null
  }

  return value ??
    null
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function isIsoDate(
  value: string
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`
    )

  return (
    !Number.isNaN(
      parsed.getTime()
    ) &&
    parsed
      .toISOString()
      .slice(
        0,
        10
      ) ===
      value
  )
}

function toTimestamp(
  value: string
): number {
  const timestamp =
    new Date(
      value
    ).getTime()

  return Number.isNaN(
    timestamp
  )
    ? Number.MAX_SAFE_INTEGER
    : timestamp
}