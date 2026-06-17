'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser, getCurrentUserId } from '@/lib/supabase/client'
import { getPassportSnapshot } from '@/lib/passport/score'
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

type ActiveFlow = {
  id: string
  title: string | null
  city: string | null
  venue_ids: string[] | null
  started_at: string | null
}

export default function RoamPassport() {
  const [supabase] = useState(() => supabaseBrowser())

  const [stats, setStats] = useState<PassportStats>({
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
  })

  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null)
  const [activeFlowCompletedStops, setActiveFlowCompletedStops] = useState(0)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPassport() {
      const userId = await getCurrentUserId()

      if (!userId) {
        setLoading(false)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [
        { data: hosted },
        { data: rsvps },
        { data: properties },
        { data: activeFlowData },
        { data: completedFlows },
        { data: venueVisits },
        { data: crawlProgress },
        { data: eventXpLedger },
        { data: eventCheckins },
      ] =
        await Promise.all([
          supabase
            .from('crawl_events')
            .select('id')
            .eq('creator_id', userId),

          supabase
            .from('crawl_rsvps')
            .select(`
              crawl_id,
              crawl_events (
                id,
                datetime
              )
            `)
            .eq('user_id', userId),

          supabase
            .from('saved_properties')
            .select('property_id')
            .eq('user_id', userId),

          supabase
            .from('active_flow_sessions')
            .select('id, title, city, venue_ids, started_at')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle(),

          supabase
            .from('active_flow_sessions')
            .select('id, venue_ids')
            .eq('user_id', userId)
            .eq('status', 'completed'),

          supabase
            .from('venue_visits')
            .select('id')
            .eq('user_id', userId),

          supabase
            .from('crawl_progress')
            .select('crawl_id')
            .eq('user_id', userId),

          supabase
            .from('event_xp_ledger')
            .select('xp_amount')
            .eq('user_id', userId),

          supabase
            .from('event_checkins')
            .select('id')
            .eq('user_id', userId),
        ])

      const joined = rsvps ?? []

      const past = joined.filter((r: any) => {
        const crawl = r.crawl_events
        if (!crawl?.datetime) return false
        return new Date(crawl.datetime) < today
      })

      let completedActiveStops = 0

      if (activeFlowData?.id) {
        const { data: activeProgress } = await supabase
          .from('active_flow_progress')
          .select('venue_id')
          .eq('session_id', activeFlowData.id)
          .eq('user_id', userId)

        completedActiveStops = activeProgress?.length ?? 0
      }

      const completedFlowStops =
        completedFlows?.reduce((sum, flow: any) => {
          return sum + (Array.isArray(flow.venue_ids) ? flow.venue_ids.length : 0)
        }, 0) ?? 0

      const hostedFlowStops = crawlProgress?.length ?? 0

      const eventXp =
        eventXpLedger?.reduce((sum, row: any) => {
          return sum + (typeof row.xp_amount === 'number' ? row.xp_amount : 0)
        }, 0) ?? 0

      const crawlIds = [
        ...new Set(
          (crawlProgress ?? [])
            .map((row: any) => row.crawl_id)
            .filter(Boolean)
        ),
      ]

      let completedHostedFlows = 0

      if (crawlIds.length > 0) {
        const { data: crawlEvents } = await supabase
          .from('crawl_events')
          .select('id, venue_ids')
          .in('id', crawlIds)

        completedHostedFlows =
          crawlEvents?.filter((crawl: any) => {
            const requiredStops = Array.isArray(crawl.venue_ids)
              ? crawl.venue_ids.length
              : 0

            const completedStops =
              crawlProgress?.filter(
                (progressRow: any) => progressRow.crawl_id === crawl.id
              ).length ?? 0

            return requiredStops > 0 && completedStops >= requiredStops
          }).length ?? 0
      }

      setStats({
        hostedCrawls: hosted?.length ?? 0,
        joinedCrawls: joined.length,
        pastCrawls: past.length,
        savedProperties: properties?.length ?? 0,
        completedFlows: completedFlows?.length ?? 0,
        completedFlowStops,
        hostedFlowStops,
        completedHostedFlows,
        venueVisits: venueVisits?.length ?? 0,
        eventXp,
        eventCheckins: eventCheckins?.length ?? 0,
      })

      setActiveFlow(activeFlowData ?? null)
      setActiveFlowCompletedStops(completedActiveStops)

      setLoading(false)
    }

    loadPassport()
  }, [supabase])

  const {
    xp,
    level,
    progressToNextLevel,
    progressPercent,
  } = useMemo(() => getPassportSnapshot(stats), [stats])

  const activeFlowTotalStops = activeFlow?.venue_ids?.length ?? 0
  const activeFlowProgressPercent =
    activeFlowTotalStops > 0
      ? Math.round((activeFlowCompletedStops / activeFlowTotalStops) * 100)
      : 0

  const badges = [
    {
      label: 'Roaming',
      unlocked: stats.joinedCrawls > 0 || stats.hostedCrawls > 0 || stats.eventCheckins > 0,
    },
    {
      label: 'Event Explorer',
      unlocked: stats.eventCheckins > 0,
    },
    {
      label: 'Flow Creator',
      unlocked: stats.hostedCrawls > 0,
    },
    {
      label: 'Crawl Finisher',
      unlocked: stats.pastCrawls > 0 || stats.completedHostedFlows > 0,
    },
    {
      label: 'Flow Finisher',
      unlocked: stats.completedFlows > 0,
    },
    {
      label: 'Guide Saver',
      unlocked: stats.savedProperties > 0,
    },
    {
      label: 'Taste Builder',
      unlocked: stats.venueVisits > 0,
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
              Your movement, events, hosted crawls, saved guides, venue visits, and city progress.
            </p>
          </div>

          <div className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-semibold">
            {xp} XP
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-xs text-neutral-500">
            <span>{progressToNextLevel} / 250 XP</span>
            <span>Next level</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${progressPercent}%` }}
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
              {activeFlow.title ?? 'Roam Flow'}
            </h3>

            <p className="mt-1 text-sm text-neutral-400">
              {activeFlow.city ?? 'City'} • {activeFlowCompletedStops} of{' '}
              {activeFlowTotalStops} stops complete
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${activeFlowProgressPercent}%` }}
              />
            </div>

            <p className="mt-3 text-sm font-medium text-indigo-300">
              Resume Flow →
            </p>
          </div>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-6">
        <StatCard label="Hosted" value={stats.hostedCrawls} />
        <StatCard label="Joined" value={stats.joinedCrawls} />
        <StatCard label="Completed" value={stats.pastCrawls + stats.completedFlows + stats.completedHostedFlows} />
        <StatCard label="Event Check-ins" value={stats.eventCheckins} />
        <StatCard label="Visited" value={stats.venueVisits} />
        <StatCard label="Saved Guides" value={stats.savedProperties} />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Badges
        </h3>

        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Badge
              key={badge.label}
              variant={badge.unlocked ? 'default' : 'outline'}
              className={
                badge.unlocked
                  ? ''
                  : 'border-neutral-700 text-neutral-500'
              }
            >
              {badge.unlocked ? '✓ ' : '🔒 '}
              {badge.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
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
    <Card className="border-neutral-800 bg-neutral-950">
      <CardContent className="p-4">
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-xs text-neutral-500">{label}</p>
      </CardContent>
    </Card>
  )
}