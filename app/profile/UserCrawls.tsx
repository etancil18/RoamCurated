'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

type Crawl = {
  id: string
  title: string
  slug: string
  datetime: string | null
  city: string | null
}

export default function UserCrawls() {
  const [hosted, setHosted] = useState<Crawl[]>([])
  const [rsvpd, setRsvpd] = useState<Crawl[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCrawls() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

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

      setHosted(hostedData ?? [])
      setRsvpd(formattedRsvps)
      setLoading(false)
    }

    loadCrawls()
  }, [])

  if (loading) return <p>Loading crawls...</p>

  return (
    <div className="space-y-8">
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

      {/* RSVP’d */}
      <section>
        <h2 className="text-xl font-semibold mb-3">🗓️ Upcoming Crawls</h2>

        {rsvpd.length === 0 && (
          <p className="text-muted-foreground text-sm">
            You haven’t joined any crawls yet.
          </p>
        )}

        <div className="grid gap-3">
          {rsvpd.map((crawl) => (
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
    </div>
  )
}