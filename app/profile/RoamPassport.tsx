'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import {
  supabaseBrowser,
  getCurrentUserId,
} from '@/lib/supabase/client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import type {
  PublicCreatorReputationSnapshot,
} from '@/lib/reputation/publicTypes'

type PassportStats = {
  hostedCrawls: number
  joinedCrawls: number
  pastCrawls: number
  savedProperties: number
  completedFlows: number
  completedFlowStops: number
  hostedFlowStops: number
  completedHostedFlows: number
  venueVisits: number
  eventXp: number
  eventCheckins: number
}

type PassportSnapshot = {
  xp: number
  level: number
  progressToNextLevel: number
  progressPercent: number
}

type ProfilePublicStatsRow = {
  hosted_crawls: number | null
  joined_crawls: number | null
  past_crawls: number | null
  saved_properties: number | null
  completed_flows: number | null
  completed_flow_stops: number | null
  hosted_flow_stops: number | null
  completed_hosted_flows: number | null
  venue_visits: number | null
  event_xp: number | null
  event_checkins: number | null
  passport_xp: number | null
  passport_level: number | null
  passport_progress: number | null
  passport_progress_percent:
    | number
    | string
    | null
}

type ActiveFlow = {
  id: string
  title: string | null
  city: string | null
  venue_ids: string[] | null
  started_at: string | null
}

type ReputationTier =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

type ReputationOverview = {
  tier: ReputationTier
  tierLabel: string
  score: number | null

  cityStanding: string
  strongestCategory: string

  eligibilityCurrent: number
  eligibilityRequired: number | null
  eligibilityPercent: number | null
  eligibilityLabel: string

  hasReputation: boolean
}

const EMPTY_STATS: PassportStats = {
  hostedCrawls: 0,
  joinedCrawls: 0,
  pastCrawls: 0,
  savedProperties: 0,
  completedFlows: 0,
  completedFlowStops: 0,
  hostedFlowStops: 0,
  completedHostedFlows: 0,
  venueVisits: 0,
  eventXp: 0,
  eventCheckins: 0,
}

const EMPTY_SNAPSHOT: PassportSnapshot = {
  xp: 0,
  level: 1,
  progressToNextLevel: 0,
  progressPercent: 0,
}

const REPUTATION_TIER_LABELS = {
  unranked: 'Building',
  emerging: 'Emerging',
  established: 'Established',
  expert: 'Expert',
  elite: 'Elite',
} as const satisfies Record<
  ReputationTier,
  string
>

const REPUTATION_TIER_RANK = {
  unranked: 0,
  emerging: 1,
  established: 2,
  expert: 3,
  elite: 4,
} as const satisfies Record<
  ReputationTier,
  number
>

const REPUTATION_TIER_STYLES = {
  unranked:
    'bg-white/[0.05] text-zinc-400 ring-1 ring-white/[0.08]',

  emerging:
    'bg-cyan-300/[0.09] text-cyan-200 ring-1 ring-cyan-300/20',

  established:
    'bg-indigo-400/[0.1] text-indigo-200 ring-1 ring-indigo-300/20',

  expert:
    'bg-violet-400/[0.1] text-violet-200 ring-1 ring-violet-300/20',

  elite:
    'bg-amber-300/[0.1] text-amber-200 ring-1 ring-amber-300/20',
} as const satisfies Record<
  ReputationTier,
  string
>

export default function RoamPassport() {
  const [supabase] = useState(
    () => supabaseBrowser()
  )

  const [stats, setStats] =
    useState<PassportStats>(
      EMPTY_STATS
    )

  const [
    passportSnapshot,
    setPassportSnapshot,
  ] =
    useState<PassportSnapshot>(
      EMPTY_SNAPSHOT
    )

  const [
    reputation,
    setReputation,
  ] = useState<
    PublicCreatorReputationSnapshot | null
  >(null)

  const [
    reputationDetails,
    setReputationDetails,
  ] = useState<
    readonly unknown[]
  >([])

  const [
    reputationWarning,
    setReputationWarning,
  ] = useState<
    string | null
  >(null)

  const [
    reputationError,
    setReputationError,
  ] = useState<
    string | null
  >(null)

  const [activeFlow, setActiveFlow] =
    useState<ActiveFlow | null>(
      null
    )

  const [
    activeFlowCompletedStops,
    setActiveFlowCompletedStops,
  ] = useState(0)

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadPassport() {
      try {
        const userId =
          await getCurrentUserId()

        if (!userId) {
          return
        }

        const [
          publicStatsResult,
          activeFlowResult,
          reputationResult,
        ] = await Promise.all([
          supabase
            .from(
              'profile_public_stats'
            )
            .select(`
              hosted_crawls,
              joined_crawls,
              past_crawls,
              saved_properties,
              completed_flows,
              completed_flow_stops,
              hosted_flow_stops,
              completed_hosted_flows,
              venue_visits,
              event_xp,
              event_checkins,
              passport_xp,
              passport_level,
              passport_progress,
              passport_progress_percent
            `)
            .eq(
              'user_id',
              userId
            )
            .maybeSingle<ProfilePublicStatsRow>(),

          supabase
            .from(
              'active_flow_sessions'
            )
            .select(
              'id, title, city, venue_ids, started_at'
            )
            .eq(
              'user_id',
              userId
            )
            .eq(
              'status',
              'active'
            )
            .maybeSingle<ActiveFlow>(),

          loadProfileReputation(),
        ])

        if (
          publicStatsResult.error
        ) {
          console.error(
            '[RoamPassport] Failed to load canonical Passport stats:',
            publicStatsResult.error
          )
        }

        if (
          activeFlowResult.error
        ) {
          console.error(
            '[RoamPassport] Failed to load active flow:',
            activeFlowResult.error
          )
        }

        const publicStats =
          publicStatsResult.data

        const activeFlowData =
          activeFlowResult.data

        let completedActiveStops =
          0

        if (activeFlowData?.id) {
          const activeProgressResult =
            await supabase
              .from(
                'active_flow_progress'
              )
              .select(
                'venue_id',
                {
                  count: 'exact',
                  head: true,
                }
              )
              .eq(
                'session_id',
                activeFlowData.id
              )
              .eq(
                'user_id',
                userId
              )

          if (
            activeProgressResult.error
          ) {
            console.error(
              '[RoamPassport] Failed to load active flow progress:',
              activeProgressResult.error
            )
          }

          completedActiveStops =
            activeProgressResult.count ??
            0
        }

        if (!isMounted) {
          return
        }

        if (publicStats) {
          setStats({
            hostedCrawls:
              normalizeCount(
                publicStats
                  .hosted_crawls
              ),

            joinedCrawls:
              normalizeCount(
                publicStats
                  .joined_crawls
              ),

            pastCrawls:
              normalizeCount(
                publicStats
                  .past_crawls
              ),

            savedProperties:
              normalizeCount(
                publicStats
                  .saved_properties
              ),

            completedFlows:
              normalizeCount(
                publicStats
                  .completed_flows
              ),

            completedFlowStops:
              normalizeCount(
                publicStats
                  .completed_flow_stops
              ),

            hostedFlowStops:
              normalizeCount(
                publicStats
                  .hosted_flow_stops
              ),

            completedHostedFlows:
              normalizeCount(
                publicStats
                  .completed_hosted_flows
              ),

            venueVisits:
              normalizeCount(
                publicStats
                  .venue_visits
              ),

            eventXp:
              normalizeCount(
                publicStats
                  .event_xp
              ),

            eventCheckins:
              normalizeCount(
                publicStats
                  .event_checkins
              ),
          })

          setPassportSnapshot({
            xp:
              normalizeCount(
                publicStats
                  .passport_xp
              ),

            level:
              Math.max(
                1,
                normalizeCount(
                  publicStats
                    .passport_level
                )
              ),

            progressToNextLevel:
              normalizeProgress(
                publicStats
                  .passport_progress
              ),

            progressPercent:
              normalizePercent(
                publicStats
                  .passport_progress_percent
              ),
          })
        } else {
          setStats(
            EMPTY_STATS
          )

          setPassportSnapshot(
            EMPTY_SNAPSHOT
          )
        }

        setReputation(
          reputationResult.reputation
        )

        setReputationDetails(
          reputationResult.details
        )

        setReputationWarning(
          reputationResult.warning
        )

        setReputationError(
          reputationResult.error
        )

        setActiveFlow(
          activeFlowData ??
            null
        )

        setActiveFlowCompletedStops(
          completedActiveStops
        )
      } catch (error) {
        console.error(
          '[RoamPassport] Unexpected Passport load failure:',
          error
        )
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadPassport()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const {
    xp,
    level,
    progressToNextLevel,
    progressPercent,
  } = passportSnapshot

  const reputationOverview =
    buildReputationOverview({
      reputation,
      details:
        reputationDetails,
    })

  const activeFlowTotalStops =
    activeFlow?.venue_ids
      ?.length ?? 0

  const activeFlowProgressPercent =
    activeFlowTotalStops > 0
      ? Math.round(
          (
            activeFlowCompletedStops /
            activeFlowTotalStops
          ) * 100
        )
      : 0

  const badges = [
    {
      label: 'Roaming',
      unlocked:
        stats.joinedCrawls >
          0 ||
        stats.hostedCrawls >
          0 ||
        stats.eventCheckins >
          0,
    },
    {
      label:
        'Event Explorer',
      unlocked:
        stats.eventCheckins >
        0,
    },
    {
      label:
        'Flow Creator',
      unlocked:
        stats.hostedCrawls >
        0,
    },
    {
      label:
        'Crawl Finisher',
      unlocked:
        stats.pastCrawls >
          0 ||
        stats.completedHostedFlows >
          0,
    },
    {
      label:
        'Flow Finisher',
      unlocked:
        stats.completedFlows >
        0,
    },
    {
      label:
        'Guide Saver',
      unlocked:
        stats.savedProperties >
        0,
    },
    {
      label:
        'Taste Builder',
      unlocked:
        stats.venueVisits >
        0,
    },
  ]

  if (loading) {
    return (
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 ring-1 ring-white/[0.07]">
        <div className="animate-pulse">
          <div className="h-3 w-28 rounded-full bg-white/[0.08]" />

          <div className="mt-4 h-8 w-56 max-w-full rounded-lg bg-white/[0.08]" />

          <div className="mt-3 h-4 w-80 max-w-full rounded bg-white/[0.04]" />

          <div className="mt-8 h-2 w-full rounded-full bg-white/[0.06]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-white/[0.075] via-white/[0.035] to-transparent p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.075] sm:p-7">
        <div className="pointer-events-none absolute right-[-5rem] top-[-7rem] h-64 w-64 rounded-full bg-cyan-400/[0.1] blur-[90px]" />

        <div className="pointer-events-none absolute bottom-[-8rem] left-[18%] h-64 w-64 rounded-full bg-indigo-500/[0.09] blur-[100px]" />

        <div className="relative z-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 ring-1 ring-white/[0.07]">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  Roam Passport
                </p>
              </div>

              <h2 className="mt-5 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
                Level {level} Explorer
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                Every place you visit,
                Flow you finish, event you
                check into, and guide you
                save adds another layer to
                your city story.
              </p>
            </div>

            <div className="flex w-fit shrink-0 items-baseline gap-1.5 rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/[0.07]">
              <span className="text-2xl font-black tracking-tight text-white">
                {xp}
              </span>

              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                XP
              </span>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
                  Next chapter
                </p>

                <p className="mt-1 text-xs font-semibold text-zinc-400">
                  {progressToNextLevel} of
                  250 XP
                </p>
              </div>

              <p className="text-xs font-black text-cyan-200">
                {Math.round(
                  progressPercent
                )}
                %
              </p>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-400 to-violet-400 shadow-[0_0_18px_rgba(103,232,249,0.32)] transition-[width] duration-500"
                style={{
                  width:
                    `${progressPercent}%`,
                }}
              />
            </div>

            <p className="mt-3 text-[11px] leading-5 text-zinc-600">
              Keep exploring. Your
              Passport becomes more useful
              as your real-world history
              grows.
            </p>
          </div>
        </div>
      </section>

      {activeFlow && (
        <Link
          href={`/flow/${activeFlow.id}`}
          className="group block"
        >
          <div className="relative overflow-hidden rounded-[1.75rem] bg-indigo-400/[0.075] p-5 ring-1 ring-indigo-300/20 transition duration-200 hover:bg-indigo-400/[0.11] sm:p-6">
            <div className="pointer-events-none absolute right-[-3rem] top-[-4rem] h-36 w-36 rounded-full bg-indigo-400/10 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-300 opacity-50" />

                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-300" />
                    </span>

                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                      In progress
                    </p>
                  </div>

                  <h3 className="mt-3 text-xl font-black tracking-tight text-white">
                    {activeFlow.title ??
                      'Roam Flow'}
                  </h3>

                  <p className="mt-1.5 text-sm text-zinc-400">
                    {activeFlow.city ??
                      'City'}{' '}
                    ·{' '}
                    {
                      activeFlowCompletedStops
                    }{' '}
                    of{' '}
                    {
                      activeFlowTotalStops
                    }{' '}
                    stops
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg text-black transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-300 to-cyan-300"
                  style={{
                    width:
                      `${activeFlowProgressPercent}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-xs font-bold text-indigo-200">
                Pick up where you left off
              </p>
            </div>
          </div>
        </Link>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Your footprint
            </p>

            <h3 className="mt-1.5 text-lg font-black tracking-tight text-white">
              The city you have actually
              lived
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Hosted"
            value={
              stats.hostedCrawls
            }
          />

          <StatCard
            label="Joined"
            value={
              stats.joinedCrawls
            }
          />

          <StatCard
            label="Completed"
            value={
              stats.pastCrawls +
              stats.completedFlows +
              stats.completedHostedFlows
            }
          />

          <StatCard
            label="Event check-ins"
            value={
              stats.eventCheckins
            }
          />

          <StatCard
            label="Places visited"
            value={
              stats.venueVisits
            }
          />

          <StatCard
            label="Guides saved"
            value={
              stats.savedProperties
            }
          />
        </div>
      </section>

      <RoamReputationSection
        overview={
          reputationOverview
        }
        warning={
          reputationWarning
        }
        error={
          reputationError
        }
      />

      <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-white/[0.045] to-white/[0.02] p-5 ring-1 ring-white/[0.065] sm:p-6">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
            Milestones
          </p>

          <h3 className="mt-1.5 text-lg font-black tracking-tight text-white">
            What you have unlocked
          </h3>

          <p className="mt-1.5 text-xs leading-5 text-zinc-500">
            Small markers of how your Roam
            history is taking shape.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {badges.map(
            (badge) => (
              <Badge
                key={
                  badge.label
                }
                variant="outline"
                className={
                  badge.unlocked
                    ? 'rounded-full border-transparent bg-white px-3 py-1.5 font-bold text-black shadow-none'
                    : 'rounded-full border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-zinc-600'
                }
              >
                {badge.unlocked
                  ? '✓ '
                  : '○ '}
                {badge.label}
              </Badge>
            )
          )}
        </div>
      </section>
    </div>
  )
}

/* =========================================================
 * Reputation presentation
 * ======================================================= */

function RoamReputationSection({
  overview,
  warning,
  error,
}: {
  overview:
    ReputationOverview
  warning: string | null
  error: string | null
}) {
  return (
    <section
      aria-labelledby="roam-reputation-title"
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-300/[0.06] via-white/[0.03] to-indigo-400/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.07]"
    >
      <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-56 w-56 rounded-full bg-cyan-300/[0.08] blur-[90px]" />

      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            What you know
          </p>

          <h2
            id="roam-reputation-title"
            className="mt-2 text-2xl font-black tracking-[-0.035em] text-white"
          >
            Your Roam Reputation
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Passport records what you have
            done. Reputation reflects where
            your verified city experience
            is becoming genuinely
            meaningful.
          </p>
        </div>

        <span
          className={[
            'inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-black',
            REPUTATION_TIER_STYLES[
              overview.tier
            ],
          ].join(' ')}
        >
          {overview.tierLabel}
        </span>
      </div>

      <div className="relative z-10 grid min-w-0 grid-cols-1 gap-2.5 px-5 pb-5 sm:grid-cols-3 sm:px-6 sm:pb-6">
        <ReputationMetric
          label="Your level"
          value={
            overview.tierLabel
          }
          detail={
            overview.score !==
            null
              ? `${formatReputationNumber(
                  overview.score
                )} reputation score`
              : 'Your signal is still taking shape'
          }
        />

        <ReputationMetric
          label="City standing"
          value={
            overview.cityStanding
          }
          detail="How your strongest eligible city activity compares"
        />

        <ReputationMetric
          label="Your lane"
          value={
            overview.strongestCategory
          }
          detail="The category where your verified experience is strongest"
        />
      </div>

      <div className="relative z-10 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
              Reputation progress
            </p>

            <p className="mt-1.5 text-sm font-bold text-white">
              {
                overview.eligibilityLabel
              }
            </p>
          </div>

          {overview.eligibilityPercent !==
          null ? (
            <p className="text-sm font-black text-cyan-200">
              {
                overview.eligibilityPercent
              }
              %
            </p>
          ) : null}
        </div>

        {overview.eligibilityPercent !==
        null ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-400 to-violet-400"
              style={{
                width:
                  `${overview.eligibilityPercent}%`,
              }}
            />
          </div>
        ) : null}

        <div className="mt-2.5 flex justify-between gap-4 text-[11px] text-zinc-600">
          <span>
            {
              overview.eligibilityCurrent
            }{' '}
            verified{' '}
            {overview.eligibilityCurrent ===
            1
              ? 'place'
              : 'places'}
          </span>

          {overview.eligibilityRequired !==
          null ? (
            <span>
              {
                overview.eligibilityRequired
              }{' '}
              required
            </span>
          ) : (
            <span>
              Still taking shape
            </span>
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-950/20 px-3 py-2.5 text-xs leading-5 text-red-300 ring-1 ring-red-500/20">
            {error}
          </p>
        ) : warning ? (
          <p className="mt-4 rounded-xl bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-100/70 ring-1 ring-amber-300/15">
            {warning}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-zinc-600">
            Your reputation is earned from
            verified activity—not how often
            you post or how many followers
            you have.
          </p>

          <Link
            href="/profile/creator"
            className="group inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-cyan-200"
          >
            Shape your public identity

            <span
              aria-hidden="true"
              className="ml-2 transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function ReputationMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="min-w-0 rounded-[1.4rem] bg-black/25 p-4 ring-1 ring-white/[0.055]">
      <p className="text-[9px] font-black uppercase tracking-[0.17em] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 break-words text-lg font-black tracking-tight text-white">
        {value}
      </p>

      <p className="mt-1.5 text-[11px] leading-5 text-zinc-600">
        {detail}
      </p>
    </div>
  )
}

/* =========================================================
 * Reputation loading and normalization
 * ======================================================= */

async function loadProfileReputation(): Promise<{
  reputation:
    | PublicCreatorReputationSnapshot
    | null
  details: readonly unknown[]
  warning: string | null
  error: string | null
}> {
  try {
    const response =
      await fetch(
        '/api/profile/reputation',
        {
          method: 'GET',
          credentials:
            'same-origin',
          cache: 'no-store',
          headers: {
            Accept:
              'application/json',
          },
        }
      )

    const payload =
      (await response
        .json()
        .catch(
          () => null
        )) as unknown

    if (!response.ok) {
      const message =
        readNestedNullableText(
          payload,
          [
            ['error'],
            ['message'],
            ['data', 'error'],
          ]
        ) ??
        'Your reputation could not be loaded.'

      console.error(
        '[RoamPassport] Reputation request failed:',
        {
          status:
            response.status,
          message,
          payload,
        }
      )

      return {
        reputation: null,
        details: [],
        warning: null,
        error: message,
      }
    }

    if (!isRecord(payload)) {
      console.error(
        '[RoamPassport] Reputation endpoint returned a non-object payload:',
        payload
      )

      return {
        reputation: null,
        details: [],
        warning:
          'Your reputation response was incomplete.',
        error: null,
      }
    }

    const reputation =
      extractPublicReputationSnapshot(
        payload
      )

    const details =
      extractReputationDetails(
        payload
      )

    const warning =
      readNestedNullableText(
        payload,
        [
          ['warning'],
          ['data', 'warning'],
          [
            'reputation',
            'warning',
          ],
        ]
      )

    const error =
      readNestedNullableText(
        payload,
        [
          ['error'],
          ['data', 'error'],
        ]
      )

    if (!reputation) {
      console.error(
        '[RoamPassport] Reputation endpoint returned no canonical public snapshot:',
        payload
      )
    }

    return {
      reputation,
      details,
      warning,
      error,
    }
  } catch (error) {
    console.error(
      '[RoamPassport] Unexpected reputation load failure:',
      error
    )

    return {
      reputation: null,
      details: [],
      warning: null,
      error:
        'Your reputation could not be loaded.',
    }
  }
}

function extractPublicReputationSnapshot(
  payload: Record<
    string,
    unknown
  >
): PublicCreatorReputationSnapshot | null {
  const candidates: unknown[] = [
    payload.reputation,

    isRecord(
      payload.reputation
    )
      ? payload.reputation
          .reputation
      : null,

    isRecord(
      payload.data
    )
      ? payload.data
          .reputation
      : null,

    isRecord(
      payload.data
    ) &&
    isRecord(
      payload.data
        .reputation
    )
      ? payload.data
          .reputation
          .reputation
      : null,
  ]

  for (const candidate of candidates) {
    if (
      isPublicCreatorReputationSnapshot(
        candidate
      )
    ) {
      return candidate
    }
  }

  return null
}

function extractReputationDetails(
  payload: Record<
    string,
    unknown
  >
): readonly unknown[] {
  const candidates: unknown[] = [
    payload.details,

    isRecord(
      payload.data
    )
      ? payload.data
          .details
      : null,

    isRecord(
      payload.reputation
    )
      ? payload.reputation
          .details
      : null,
  ]

  for (const candidate of candidates) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate
    }
  }

  return []
}

function isPublicCreatorReputationSnapshot(
  value: unknown
): value is PublicCreatorReputationSnapshot {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.userId !==
      'string' ||
    !value.userId.trim()
  ) {
    return false
  }

  if (
    !Array.isArray(
      value.categories
    )
  ) {
    return false
  }

  if (
    !isRecord(
      value.evidence
    )
  ) {
    return false
  }

  if (
    !isReputationTier(
      value.highestLevel
    )
  ) {
    return false
  }

  if (
    typeof value.policyVersion !==
      'number' ||
    !Number.isFinite(
      value.policyVersion
    )
  ) {
    return false
  }

  return true
}

function readNestedNullableText(
  value: unknown,
  paths:
    readonly (
      readonly string[]
    )[]
): string | null {
  for (const path of paths) {
    let current:
      unknown =
      value

    for (const segment of path) {
      if (!isRecord(current)) {
        current =
          null

        break
      }

      current =
        current[
          segment
        ]
    }

    const normalized =
      normalizeNullableText(
        current
      )

    if (normalized) {
      return normalized
    }
  }

  return null
}

function buildReputationOverview({
  reputation,
  details,
}: {
  reputation:
    | PublicCreatorReputationSnapshot
    | null
  details: readonly unknown[]
}): ReputationOverview {
  const candidates =
    collectReputationCandidates({
      reputation,
      details,
    })

  const strongest =
    candidates
      .slice()
      .sort(
        compareReputationCandidates
      )[0] ??
    null

  const strongestCity =
    candidates
      .filter(
        (candidate) =>
          candidate.scope ===
          'city'
      )
      .sort(
        compareReputationCandidates
      )[0] ??
    null

  const tier =
    strongest?.tier ??
    normalizeReputationTier(
      reputation
        ?.highestLevel
    )

  const score =
    strongest?.score ??
    normalizeNonNegativeNumber(
      reputation
        ?.primaryCategory
        ?.reputationScore
    )

  const eligibility =
    deriveEligibility({
      reputation,
      details,
      candidates,
    })

  return {
    tier,

    tierLabel:
      REPUTATION_TIER_LABELS[
        tier
      ],

    score,

    cityStanding:
      buildCityStanding(
        strongestCity
      ),

    strongestCategory:
      strongest
        ?.categoryLabel ??
      reputation
        ?.primaryCategory
        ?.categoryLabel ??
      'Still building',

    eligibilityCurrent:
      eligibility.current,

    eligibilityRequired:
      eligibility.required,

    eligibilityPercent:
      eligibility.percent,

    eligibilityLabel:
      eligibility.label,

    hasReputation:
      candidates.length > 0 ||
      tier !== 'unranked',
  }
}

type ReputationCandidate = {
  key: string
  categoryLabel: string
  scope:
    | 'global'
    | 'city'
  cityLabel: string | null
  tier: ReputationTier
  score: number
  rank: number | null
  eligibleCount: number | null
  topPercent: number | null
  verifiedVenueCount: number
  weightedVenueCount: number
}

function collectReputationCandidates({
  reputation,
  details,
}: {
  reputation:
    | PublicCreatorReputationSnapshot
    | null
  details: readonly unknown[]
}): ReputationCandidate[] {
  const rawCandidates: unknown[] =
    []

  if (
    reputation &&
    Array.isArray(
      reputation.categories
    )
  ) {
    rawCandidates.push(
      ...reputation.categories
    )
  }

  rawCandidates.push(
    ...details
  )

  const candidates:
    ReputationCandidate[] =
    []

  const seen =
    new Set<string>()

  for (
    const rawCandidate of
      rawCandidates
  ) {
    const candidate =
      normalizeReputationCandidate(
        rawCandidate
      )

    if (
      !candidate ||
      seen.has(candidate.key)
    ) {
      continue
    }

    seen.add(candidate.key)
    candidates.push(candidate)
  }

  return candidates
}

function normalizeReputationCandidate(
  value: unknown
): ReputationCandidate | null {
  if (!isRecord(value)) {
    return null
  }

  const categoryId =
    normalizeNullableText(
      firstDefined(
        value.categoryId,
        value.category_id,
        value.id
      )
    )

  const categoryLabel =
    normalizeNullableText(
      firstDefined(
        value.categoryLabel,
        value.category_label,
        value.label,
        value.categoryShortLabel,
        value.category_short_label
      )
    ) ??
    (categoryId
      ? formatIdentifier(
          categoryId
        )
      : null)

  if (!categoryLabel) {
    return null
  }

  const rawScope =
    normalizeNullableText(
      value.scope
    )

  const scope =
    rawScope === 'city'
      ? 'city'
      : 'global'

  const cityKey =
    normalizeNullableText(
      firstDefined(
        value.cityKey,
        value.city_key
      )
    )

  const cityLabel =
    normalizeNullableText(
      firstDefined(
        value.cityLabel,
        value.city_label
      )
    ) ??
    (cityKey
      ? formatIdentifier(
          cityKey
        )
      : null)

  const ranking =
    isRecord(
      value.ranking
    )
      ? value.ranking
      : null

  const evidence =
    isRecord(
      value.evidence
    )
      ? value.evidence
      : null

  const tier =
    normalizeReputationTier(
      firstDefined(
        value.reputationTier,
        value.reputation_tier,
        value.reputationLevel,
        value.reputation_level,
        value.level,
        value.tier
      )
    )

  const score =
    normalizeNonNegativeNumber(
      firstDefined(
        value.reputationScore,
        value.reputation_score,
        value.score
      )
    ) ?? 0

  const rank =
    normalizePositiveInteger(
      firstDefined(
        value.rank,
        value.cityRank,
        value.city_rank,
        ranking?.rank
      )
    )

  const eligibleCount =
    normalizeNonNegativeInteger(
      firstDefined(
        value.eligibleCreatorCount,
        value.eligible_creator_count,
        value.eligibleUserCount,
        value.eligible_user_count,
        ranking
          ?.eligibleCreatorCount,
        ranking
          ?.eligible_creator_count,
        ranking
          ?.eligibleUserCount,
        ranking
          ?.eligible_user_count
      )
    )

  const topPercent =
    normalizePercentage(
      firstDefined(
        value.topPercent,
        value.top_percent,
        value.percentile,
        ranking?.topPercent,
        ranking?.top_percent,
        ranking?.percentile
      )
    )

  const verifiedVenueCount =
    normalizeNonNegativeInteger(
      firstDefined(
        value.verifiedVenueCount,
        value.verified_venue_count,
        evidence
          ?.verifiedVenueCount,
        evidence
          ?.verified_venue_count
      )
    ) ?? 0

  const weightedVenueCount =
    normalizeNonNegativeNumber(
      firstDefined(
        value.weightedVenueCount,
        value.weighted_venue_count,
        evidence
          ?.weightedVenueCount,
        evidence
          ?.weighted_venue_count
      )
    ) ?? 0

  const key = [
    categoryId ??
      categoryLabel,
    scope,
    cityKey ??
      '__global__',
  ].join(':')

  return {
    key,
    categoryLabel,
    scope,
    cityLabel,
    tier,
    score,
    rank,
    eligibleCount,
    topPercent,
    verifiedVenueCount,
    weightedVenueCount,
  }
}

function compareReputationCandidates(
  first:
    ReputationCandidate,
  second:
    ReputationCandidate
): number {
  const tierDifference =
    REPUTATION_TIER_RANK[
      second.tier
    ] -
    REPUTATION_TIER_RANK[
      first.tier
    ]

  if (tierDifference !== 0) {
    return tierDifference
  }

  if (
    first.score !==
    second.score
  ) {
    return (
      second.score -
      first.score
    )
  }

  if (
    first.rank !== null &&
    second.rank !== null &&
    first.rank !==
      second.rank
  ) {
    return (
      first.rank -
      second.rank
    )
  }

  if (
    first.rank !== null &&
    second.rank === null
  ) {
    return -1
  }

  if (
    first.rank === null &&
    second.rank !== null
  ) {
    return 1
  }

  return first.categoryLabel.localeCompare(
    second.categoryLabel,
    'en-US',
    {
      sensitivity:
        'base',
    }
  )
}

function buildCityStanding(
  candidate:
    | ReputationCandidate
    | null
): string {
  if (!candidate) {
    return 'No city status yet'
  }

  const city =
    candidate.cityLabel ??
    'Your city'

  if (
    candidate.rank !== null &&
    candidate.eligibleCount !==
      null &&
    candidate.eligibleCount > 0
  ) {
    return `#${candidate.rank.toLocaleString(
      'en-US'
    )} of ${candidate.eligibleCount.toLocaleString(
      'en-US'
    )} in ${city}`
  }

  if (
    candidate.rank !== null
  ) {
    return `#${candidate.rank.toLocaleString(
      'en-US'
    )} in ${city}`
  }

  if (
    candidate.topPercent !==
    null
  ) {
    return `Top ${formatReputationNumber(
      candidate.topPercent
    )}% in ${city}`
  }

  return `${REPUTATION_TIER_LABELS[
    candidate.tier
  ]} in ${city}`
}

function deriveEligibility({
  reputation,
  details,
  candidates,
}: {
  reputation:
    | PublicCreatorReputationSnapshot
    | null
  details: readonly unknown[]
  candidates:
    ReputationCandidate[]
}): {
  current: number
  required: number | null
  percent: number | null
  label: string
} {
  const possibleRecords: unknown[] =
    [
      reputation,
      ...details,
    ]

  let explicitCurrent:
    number | null =
    null

  let explicitRequired:
    number | null =
    null

  let explicitPercent:
    number | null =
    null

  let explicitEligible:
    boolean | null =
    null

  for (
    const possibleRecord of
      possibleRecords
  ) {
    if (!isRecord(possibleRecord)) {
      continue
    }

    const eligibility =
      isRecord(
        possibleRecord.eligibility
      )
        ? possibleRecord.eligibility
        : null

    explicitCurrent ??=
      normalizeNonNegativeInteger(
        firstDefined(
          possibleRecord.eligibilityCurrent,
          possibleRecord.eligibility_current,
          possibleRecord.currentEvidenceCount,
          possibleRecord.current_evidence_count,
          possibleRecord.verifiedVenueCount,
          possibleRecord.verified_venue_count,
          eligibility?.current,
          eligibility?.currentCount,
          eligibility?.current_count
        )
      )

    explicitRequired ??=
      normalizePositiveInteger(
        firstDefined(
          possibleRecord.eligibilityRequired,
          possibleRecord.eligibility_required,
          possibleRecord.requiredEvidenceCount,
          possibleRecord.required_evidence_count,
          possibleRecord.minimumVerifiedVenueCount,
          possibleRecord.minimum_verified_venue_count,
          eligibility?.required,
          eligibility?.requiredCount,
          eligibility?.required_count
        )
      )

    explicitPercent ??=
      normalizePercentage(
        firstDefined(
          possibleRecord.eligibilityPercent,
          possibleRecord.eligibility_percent,
          eligibility?.percent,
          eligibility?.progressPercent,
          eligibility?.progress_percent
        )
      )

    if (
      explicitEligible ===
      null
    ) {
      const eligibleValue =
        firstDefined(
          possibleRecord.eligible,
          possibleRecord.isEligible,
          possibleRecord.is_eligible,
          eligibility?.eligible,
          eligibility?.isEligible,
          eligibility?.is_eligible
        )

      if (
        typeof eligibleValue ===
        'boolean'
      ) {
        explicitEligible =
          eligibleValue
      }
    }
  }

  const strongestEvidence =
    candidates.reduce(
      (
        maximum,
        candidate
      ) =>
        Math.max(
          maximum,
          candidate
            .verifiedVenueCount
        ),
      reputation
        ?.evidence
        ?.verifiedVenueCount ??
        0
    )

  const current =
    explicitCurrent ??
    strongestEvidence

  const eligible =
    explicitEligible ??
    (
      candidates.some(
        (candidate) =>
          candidate.tier !==
          'unranked'
      ) ||
      (
        reputation !==
          null &&
        reputation.highestLevel !==
          'unranked'
      )
    )

  const required =
    explicitRequired

  const percent =
    eligible
      ? 100
      : explicitPercent ??
        (
          required !== null &&
          required > 0
            ? Math.min(
                100,
                Math.round(
                  (
                    current /
                    required
                  ) *
                    100
                )
              )
            : null
        )

  const hasRankingPopulation =
    candidates.some(
      (candidate) =>
        candidate.eligibleCount !==
          null &&
        candidate.eligibleCount >
          0
    )

  const label =
    eligible
      ? hasRankingPopulation
        ? 'Eligible for reputation ranking'
        : 'Public reputation status earned'
      : required !== null
        ? current <= 0
          ? 'Complete verified activity to begin qualifying'
          : `${Math.max(
              0,
              required -
                current
            ).toLocaleString(
              'en-US'
            )} more verified ${
              required -
                current ===
              1
                ? 'venue'
                : 'venues'
            } needed`
        : current > 0
          ? 'Building verified reputation'
          : 'Complete verified activity to begin qualifying'

  return {
    current,
    required,
    percent,
    label,
  }
}

/* =========================================================
 * Passport normalization
 * ======================================================= */

function normalizeCount(
  value:
    | number
    | null
    | undefined
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    return 0
  }

  return Math.floor(
    value
  )
}

function normalizeProgress(
  value:
    | number
    | null
    | undefined
): number {
  return Math.min(
    249,
    normalizeCount(
      value
    )
  )
}

function normalizePercent(
  value:
    | number
    | string
    | null
    | undefined
): number {
  const parsed =
    typeof value ===
      'number'
      ? value
      : typeof value ===
          'string'
        ? Number(
            value
          )
        : 0

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0
  }

  return Math.min(
    100,
    Math.max(
      0,
      parsed
    )
  )
}

/* =========================================================
 * Reputation primitive helpers
 * ======================================================= */

function normalizeReputationTier(
  value: unknown
): ReputationTier {
  if (
    typeof value !==
    'string'
  ) {
    return 'unranked'
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        '_'
      )

  if (
    normalized ===
      'emerging' ||
    normalized ===
      'established' ||
    normalized ===
      'expert' ||
    normalized ===
      'elite'
  ) {
    return normalized
  }

  return 'unranked'
}

function isReputationTier(
  value: unknown
): value is ReputationTier {
  return (
    value === 'unranked' ||
    value === 'emerging' ||
    value === 'established' ||
    value === 'expert' ||
    value === 'elite'
  )
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}

function normalizeFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    )
  ) {
    return value
  }

  if (
    typeof value ===
      'string' &&
    value.trim().length >
      0
  ) {
    const parsed =
      Number(
        value
      )

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function normalizeNonNegativeNumber(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return normalized
}

function normalizeNonNegativeInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeNonNegativeNumber(
      value
    )

  return normalized === null
    ? null
    : Math.trunc(
        normalized
      )
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizePercentage(
  value: unknown
): number | null {
  const normalized =
    normalizeNonNegativeNumber(
      value
    )

  if (
    normalized === null
  ) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

function firstDefined(
  ...values: unknown[]
): unknown {
  for (
    const value of values
  ) {
    if (
      value !== null &&
      value !== undefined
    ) {
      return value
    }
  }

  return null
}

function formatIdentifier(
  value: string
): string {
  return value
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    )
}

function formatReputationNumber(
  value: number
): string {
  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        value < 1
          ? 1
          : 0,
    }
  )
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

/* =========================================================
 * Existing stat card
 * ======================================================= */

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <Card className="border-0 bg-white/[0.035] shadow-none ring-1 ring-white/[0.06]">
      <CardContent className="flex min-h-[96px] flex-col justify-between p-4 sm:min-h-[104px]">
        <p className="text-[2rem] font-black leading-none tracking-[-0.04em] text-white sm:text-3xl">
          {value}
        </p>

        <p className="mt-3 text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-zinc-600 sm:text-[11px]">
          {label}
        </p>
      </CardContent>
    </Card>
  )
}