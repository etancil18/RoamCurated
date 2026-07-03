'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Crawl = {
  id: string
  title: string
  slug: string
  public_id: string | null
  datetime: string | null
  city: string | null
}

function formatCountdown(datetime: string | null) {
  if (!datetime) return null

  const diff = new Date(datetime).getTime() - Date.now()
  if (diff <= 0) return null

  const minutes = Math.floor(diff / 60000)
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = minutes % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  parts.push(`${mins}m`)

  return parts.join(' ')
}

function formatDate(datetime: string | null) {
  if (!datetime) return 'No date'

  return new Date(datetime).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCity(city: string | null) {
  if (!city) return 'City TBD'

  return city
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function UserCrawls() {
  const [hosted, setHosted] = useState<Crawl[]>([])
  const [upcoming, setUpcoming] = useState<Crawl[]>([])
  const [past, setPast] = useState<Crawl[]>([])
  const [loading, setLoading] = useState(true)

  const [showAllHosted, setShowAllHosted] = useState(false)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAllPast, setShowAllPast] = useState(false)

  useEffect(() => {
    async function loadCrawls() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: hostedData } = await supabase
        .from('crawl_events')
        .select('id, title, slug, public_id, datetime, city')
        .eq('creator_id', user.id)
        .order('datetime', { ascending: true })

      const { data: rsvpData } = await supabase
        .from('crawl_rsvps')
        .select(`
          crawl_id,
          crawl_events (
            id,
            title,
            slug,
            public_id,
            datetime,
            city
          )
        `)
        .eq('user_id', user.id)

      const formattedRsvps =
        rsvpData?.map((r: any) => r.crawl_events).filter(Boolean) ?? []

      const upcomingCrawls: Crawl[] = []
      const pastCrawls: Crawl[] = []

      formattedRsvps.forEach((crawl) => {
        if (!crawl.datetime) {
          upcomingCrawls.push(crawl)
        } else if (new Date(crawl.datetime) >= today) {
          upcomingCrawls.push(crawl)
        } else {
          pastCrawls.push(crawl)
        }
      })

      upcomingCrawls.sort(
        (a, b) =>
          new Date(a.datetime ?? '').getTime() -
          new Date(b.datetime ?? '').getTime()
      )

      pastCrawls.sort(
        (a, b) =>
          new Date(b.datetime ?? '').getTime() -
          new Date(a.datetime ?? '').getTime()
      )

      setHosted(hostedData ?? [])
      setUpcoming(upcomingCrawls)
      setPast(pastCrawls)
      setLoading(false)
    }

    loadCrawls()
  }, [])

  const removeRsvp = async (crawlId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('crawl_rsvps')
      .delete()
      .eq('crawl_id', crawlId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to remove RSVP:', error)
      return
    }

    setUpcoming((prev) => prev.filter((crawl) => crawl.id !== crawlId))
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-400">
        Loading your Flows…
      </p>
    )
  }

  const nextCrawl = upcoming[0]

  const hostedVisible = showAllHosted ? hosted : hosted.slice(0, 3)
  const upcomingVisible = showAllUpcoming ? upcoming : upcoming.slice(0, 3)
  const pastVisible = showAllPast ? past : past.slice(0, 3)

  return (
    <div className="space-y-4">
      <CrawlGroup
        title="Hosted"
        count={hosted.length}
        emptyText="You haven’t hosted any Flows yet."
        showMore={hosted.length > 3}
        expanded={showAllHosted}
        onToggle={() => setShowAllHosted((prev) => !prev)}
      >
        {hostedVisible.map((crawl) => (
          <CrawlRow
            key={crawl.id}
            crawl={crawl}
            href={`/sponsor/${crawl.public_id ?? crawl.slug}`}
          />
        ))}
      </CrawlGroup>

      <CrawlGroup
        title="Upcoming"
        count={upcoming.length}
        emptyText="You haven’t joined any upcoming Flows."
        showMore={upcoming.length > 3}
        expanded={showAllUpcoming}
        onToggle={() => setShowAllUpcoming((prev) => !prev)}
      >
        {upcomingVisible.map((crawl) => {
          const isNext = nextCrawl?.id === crawl.id
          const countdown = formatCountdown(crawl.datetime)

          return (
            <CrawlRow
              key={crawl.id}
              crawl={crawl}
              href={`/sponsor/${crawl.public_id ?? crawl.slug}`}
              eyebrow={isNext ? 'Your next Flow' : undefined}
              highlight={isNext}
              countdown={countdown}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full border-neutral-700 bg-black/30 px-3 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    removeRsvp(crawl.id)
                  }}
                >
                  Remove RSVP
                </Button>
              }
            />
          )
        })}
      </CrawlGroup>

      <CrawlGroup
        title="Past"
        count={past.length}
        emptyText="No past Flows yet."
        showMore={past.length > 3}
        expanded={showAllPast}
        onToggle={() => setShowAllPast((prev) => !prev)}
      >
        {pastVisible.map((crawl) => (
          <CrawlRow
            key={crawl.id}
            crawl={crawl}
            href={`/sponsor/${crawl.public_id ?? crawl.slug}`}
            muted
          />
        ))}
      </CrawlGroup>
    </div>
  )
}

function CrawlGroup({
  title,
  count,
  emptyText,
  children,
  showMore,
  expanded,
  onToggle,
}: {
  title: string
  count: number
  emptyText: string
  children: React.ReactNode
  showMore: boolean
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-black/25">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-900 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {count} {count === 1 ? 'Flow' : 'Flows'}
          </p>
        </div>

        {showMore ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-neutral-800 px-3 py-1 text-xs font-medium text-neutral-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            {expanded ? 'Show less' : 'See more'}
          </button>
        ) : null}
      </div>

      {count === 0 ? (
        <div className="px-4 py-5">
          <p className="text-sm text-neutral-500">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-900">{children}</div>
      )}
    </section>
  )
}

function CrawlRow({
  crawl,
  href,
  eyebrow,
  countdown,
  action,
  highlight = false,
  muted = false,
}: {
  crawl: Crawl
  href: string
  eyebrow?: string
  countdown?: string | null
  action?: React.ReactNode
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]',
        highlight ? 'bg-indigo-500/[0.07]' : '',
        muted ? 'opacity-80' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
            {eyebrow}
          </p>
        ) : null}

        <p className="truncate text-sm font-semibold text-neutral-100">
          {crawl.title}
        </p>

        <p className="mt-0.5 text-xs text-neutral-500">
          {formatCity(crawl.city)} • {formatDate(crawl.datetime)}
        </p>

        {countdown ? (
          <p className="mt-1 text-xs font-medium text-indigo-300">
            Starts in {countdown}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {action}

        <span className="hidden rounded-full border border-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-500 transition group-hover:border-cyan-400/40 group-hover:text-cyan-300 sm:inline-flex">
          Open →
        </span>
      </div>
    </Link>
  )
}