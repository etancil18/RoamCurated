'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser, getCurrentUserId } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type PassportStats = {
  hostedCrawls: number
  joinedCrawls: number
  pastCrawls: number
  savedProperties: number
}

export default function RoamPassport() {
  const [supabase] = useState(() => supabaseBrowser())

  const [stats, setStats] = useState<PassportStats>({
    hostedCrawls: 0,
    joinedCrawls: 0,
    pastCrawls: 0,
    savedProperties: 0,
  })

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

      const [{ data: hosted }, { data: rsvps }, { data: properties }] =
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
        ])

      const joined = rsvps ?? []

      const past = joined.filter((r: any) => {
        const crawl = r.crawl_events
        if (!crawl?.datetime) return false
        return new Date(crawl.datetime) < today
      })

      setStats({
        hostedCrawls: hosted?.length ?? 0,
        joinedCrawls: joined.length,
        pastCrawls: past.length,
        savedProperties: properties?.length ?? 0,
      })

      setLoading(false)
    }

    loadPassport()
  }, [supabase])

  const xp = useMemo(() => {
    return (
      stats.hostedCrawls * 75 +
      stats.joinedCrawls * 25 +
      stats.pastCrawls * 100 +
      stats.savedProperties * 10
    )
  }, [stats])

  const level = Math.max(1, Math.floor(xp / 250) + 1)
  const progressToNextLevel = xp % 250
  const progressPercent = (progressToNextLevel / 250) * 100

  const badges = [
    {
      label: 'Roaming',
      unlocked: stats.joinedCrawls > 0 || stats.hostedCrawls > 0,
    },
    {
      label: 'Flow Creator',
      unlocked: stats.hostedCrawls > 0,
    },
    {
      label: 'Crawl Finisher',
      unlocked: stats.pastCrawls > 0,
    },
    {
      label: 'Guide Saver',
      unlocked: stats.savedProperties > 0,
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
              Your movement, hosted crawls, saved guides, and city progress.
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

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Hosted" value={stats.hostedCrawls} />
        <StatCard label="Joined" value={stats.joinedCrawls} />
        <StatCard label="Completed" value={stats.pastCrawls} />
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