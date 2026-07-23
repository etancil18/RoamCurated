'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  supabaseBrowser,
  getCurrentUserId,
} from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  passport_progress_percent: number | string | null
}

type ActiveFlow = {
  id: string
  title: string | null
  city: string | null
  venue_ids: string[] | null
  started_at: string | null
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

export default function RoamPassport() {
  const [supabase] = useState(() => supabaseBrowser())

  const [stats, setStats] =
    useState<PassportStats>(EMPTY_STATS)

  const [passportSnapshot, setPassportSnapshot] =
    useState<PassportSnapshot>(EMPTY_SNAPSHOT)

  const [activeFlow, setActiveFlow] =
    useState<ActiveFlow | null>(null)

  const [
    activeFlowCompletedStops,
    setActiveFlowCompletedStops,
  ] = useState(0)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadPassport() {
      try {
        const userId = await getCurrentUserId()

        if (!userId) {
          return
        }

        const [
          publicStatsResult,
          activeFlowResult,
        ] = await Promise.all([
          supabase
            .from('profile_public_stats')
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
            .eq('user_id', userId)
            .maybeSingle<ProfilePublicStatsRow>(),

          supabase
            .from('active_flow_sessions')
            .select(
              'id, title, city, venue_ids, started_at'
            )
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle<ActiveFlow>(),
        ])

        if (publicStatsResult.error) {
          console.error(
            '[RoamPassport] Failed to load canonical Passport stats:',
            publicStatsResult.error
          )
        }

        if (activeFlowResult.error) {
          console.error(
            '[RoamPassport] Failed to load active flow:',
            activeFlowResult.error
          )
        }

        const publicStats =
          publicStatsResult.data

        const activeFlowData =
          activeFlowResult.data

        let completedActiveStops = 0

        if (activeFlowData?.id) {
          const activeProgressResult =
            await supabase
              .from('active_flow_progress')
              .select('venue_id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'session_id',
                activeFlowData.id
              )
              .eq('user_id', userId)

          if (activeProgressResult.error) {
            console.error(
              '[RoamPassport] Failed to load active flow progress:',
              activeProgressResult.error
            )
          }

          completedActiveStops =
            activeProgressResult.count ?? 0
        }

        if (!isMounted) {
          return
        }

        if (publicStats) {
          setStats({
            hostedCrawls: normalizeCount(
              publicStats.hosted_crawls
            ),
            joinedCrawls: normalizeCount(
              publicStats.joined_crawls
            ),
            pastCrawls: normalizeCount(
              publicStats.past_crawls
            ),
            savedProperties: normalizeCount(
              publicStats.saved_properties
            ),
            completedFlows: normalizeCount(
              publicStats.completed_flows
            ),
            completedFlowStops: normalizeCount(
              publicStats.completed_flow_stops
            ),
            hostedFlowStops: normalizeCount(
              publicStats.hosted_flow_stops
            ),
            completedHostedFlows: normalizeCount(
              publicStats.completed_hosted_flows
            ),
            venueVisits: normalizeCount(
              publicStats.venue_visits
            ),
            eventXp: normalizeCount(
              publicStats.event_xp
            ),
            eventCheckins: normalizeCount(
              publicStats.event_checkins
            ),
          })

          setPassportSnapshot({
            xp: normalizeCount(
              publicStats.passport_xp
            ),
            level: Math.max(
              1,
              normalizeCount(
                publicStats.passport_level
              )
            ),
            progressToNextLevel:
              normalizeProgress(
                publicStats.passport_progress
              ),
            progressPercent:
              normalizePercent(
                publicStats.passport_progress_percent
              ),
          })
        } else {
          setStats(EMPTY_STATS)
          setPassportSnapshot(
            EMPTY_SNAPSHOT
          )
        }

        setActiveFlow(
          activeFlowData ?? null
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

    loadPassport()

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

  const activeFlowTotalStops =
    activeFlow?.venue_ids?.length ?? 0

  const activeFlowProgressPercent =
    activeFlowTotalStops > 0
      ? Math.round(
          (activeFlowCompletedStops /
            activeFlowTotalStops) *
            100
        )
      : 0

  const badges = [
    {
      label: 'Roaming',
      unlocked:
        stats.joinedCrawls > 0 ||
        stats.hostedCrawls > 0 ||
        stats.eventCheckins > 0,
    },
    {
      label: 'Event Explorer',
      unlocked:
        stats.eventCheckins > 0,
    },
    {
      label: 'Flow Creator',
      unlocked:
        stats.hostedCrawls > 0,
    },
    {
      label: 'Crawl Finisher',
      unlocked:
        stats.pastCrawls > 0 ||
        stats.completedHostedFlows > 0,
    },
    {
      label: 'Flow Finisher',
      unlocked:
        stats.completedFlows > 0,
    },
    {
      label: 'Guide Saver',
      unlocked:
        stats.savedProperties > 0,
    },
    {
      label: 'Taste Builder',
      unlocked:
        stats.venueVisits > 0,
    },
  ]

  if (loading) {
    return (
      <p className="text-sm text-neutral-400">
        Loading your Passport…
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-black p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
              Roam Passport
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Level {level} Explorer
            </h2>

            <p className="mt-1 text-sm text-neutral-400">
              Your movement, events, hosted crawls, saved
              guides, venue visits, and city progress.
            </p>
          </div>

          <div className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-semibold">
            {xp} XP
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-xs text-neutral-500">
            <span>
              {progressToNextLevel} / 250 XP
            </span>

            <span>Next level</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>
        </div>
      </div>

      {activeFlow && (
        <Link href={`/flow/${activeFlow.id}`}>
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-5 transition hover:border-indigo-400/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
              Current Active Flow
            </p>

            <h3 className="mt-2 text-lg font-semibold text-white">
              {activeFlow.title ??
                'Roam Flow'}
            </h3>

            <p className="mt-1 text-sm text-neutral-400">
              {activeFlow.city ?? 'City'} •{' '}
              {activeFlowCompletedStops} of{' '}
              {activeFlowTotalStops} stops
              complete
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{
                  width: `${activeFlowProgressPercent}%`,
                }}
              />
            </div>

            <p className="mt-3 text-sm font-medium text-indigo-300">
              Resume Flow →
            </p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Hosted"
          value={stats.hostedCrawls}
        />

        <StatCard
          label="Joined"
          value={stats.joinedCrawls}
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
          label="Event Check-ins"
          value={stats.eventCheckins}
        />

        <StatCard
          label="Visited"
          value={stats.venueVisits}
        />

        <StatCard
          label="Saved Guides"
          value={stats.savedProperties}
        />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Badges
        </h3>

        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Badge
              key={badge.label}
              variant={
                badge.unlocked
                  ? 'default'
                  : 'outline'
              }
              className={
                badge.unlocked
                  ? ''
                  : 'border-neutral-700 text-neutral-500'
              }
            >
              {badge.unlocked
                ? '✓ '
                : '🔒 '}
              {badge.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

function normalizeCount(
  value: number | null | undefined
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0
  }

  return Math.floor(value)
}

function normalizeProgress(
  value: number | null | undefined
): number {
  return Math.min(
    249,
    normalizeCount(value)
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
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.min(
    100,
    Math.max(0, parsed)
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <Card className="border-neutral-800 bg-neutral-950/90">
      <CardContent className="flex min-h-[88px] flex-col justify-between p-3 sm:min-h-[96px] sm:p-4">
        <p className="text-2xl font-semibold leading-none text-white sm:text-3xl">
          {value}
        </p>

        <p className="mt-2 text-[11px] font-medium leading-tight text-neutral-500 sm:text-xs">
          {label}
        </p>
      </CardContent>
    </Card>
  )
}