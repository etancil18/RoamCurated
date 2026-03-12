'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Crawl = {
  id: string
  title: string
  slug: string
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

export default function UserCrawls() {
  const [hosted, setHosted] = useState<Crawl[]>([])
  const [upcoming, setUpcoming] = useState<Crawl[]>([])
  const [past, setPast] = useState<Crawl[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCrawls() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Hosted Crawls
      const { data: hostedData } = await supabase
        .from('crawl_events')
        .select('id, title, slug, datetime, city')
        .eq('creator_id', user.id)
        .order('datetime', { ascending: true })

      // RSVP’d Crawls
      const { data: rsvpData } = await supabase
        .from('crawl_rsvps')
        .select(`
          crawl_id,
          crawl_events (
            id,
            title,
            slug,
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

  // ✅ Remove RSVP
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

    // Update UI immediately
    setUpcoming((prev) => prev.filter((c) => c.id !== crawlId))
  }

  if (loading) return <p>Loading crawls...</p>

  const nextCrawl = upcoming[0]

  return (
    <div className="space-y-10">

      {/* Hosted */}
      <section>
        <h2 className="text-xl font-semibold mb-3">🎉 Hosted Crawls</h2>

        {hosted.length === 0 && (
          <p className="text-muted-foreground text-sm">
            You haven’t hosted any crawls yet.
          </p>
        )}

        <div className="grid gap-3">
          {hosted.map((crawl) => (
            <Link key={crawl.id} href={`/sponsor/${crawl.slug}`}>
              <Card className="hover:shadow-md transition cursor-pointer">
                <CardContent className="p-4">
                  <p className="font-medium">{crawl.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {crawl.city} •{' '}
                    {crawl.datetime
                      ? new Date(crawl.datetime).toLocaleDateString()
                      : 'No date'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Crawls */}
      <section>
        <h2 className="text-xl font-semibold mb-3">🗓️ Upcoming Crawls</h2>

        {upcoming.length === 0 && (
          <p className="text-muted-foreground text-sm">
            You haven’t joined any upcoming crawls.
          </p>
        )}

        <div className="grid gap-3">
          {upcoming.map((crawl) => {
            const isNext = nextCrawl?.id === crawl.id
            const countdown = formatCountdown(crawl.datetime)

            return (
              <Link key={crawl.id} href={`/sponsor/${crawl.slug}`}>
                <Card
                  className={`hover:shadow-md transition cursor-pointer ${
                    isNext ? 'border-blue-500 border-2' : ''
                  }`}
                >
                  <CardContent className="p-4 space-y-2">

                    <p className="font-medium">{crawl.title}</p>

                    <p className="text-xs text-muted-foreground">
                      {crawl.city} •{' '}
                      {crawl.datetime
                        ? new Date(crawl.datetime).toLocaleDateString()
                        : 'No date'}
                    </p>

                    {countdown && (
                      <p className="text-xs text-blue-600">
                        Starts in {countdown}
                      </p>
                    )}

                    {isNext && (
                      <p className="text-xs font-semibold text-blue-600">
                        Your next crawl
                      </p>
                    )}

                    {/* ✅ RSVP Removal */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        removeRsvp(crawl.id)
                      }}
                    >
                      Remove RSVP
                    </Button>

                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Past Crawls */}
      <section>
        <h2 className="text-xl font-semibold mb-3">📜 Past Crawls</h2>

        {past.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No past crawls yet.
          </p>
        )}

        <div className="grid gap-3">
          {past.map((crawl) => (
            <Link key={crawl.id} href={`/sponsor/${crawl.slug}`}>
              <Card className="hover:shadow-md transition cursor-pointer opacity-80">
                <CardContent className="p-4">
                  <p className="font-medium">{crawl.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {crawl.city} •{' '}
                    {crawl.datetime
                      ? new Date(crawl.datetime).toLocaleDateString()
                      : 'No date'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}