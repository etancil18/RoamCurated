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

export default function UserCrawls() {

  const [hosted, setHosted] = useState<Crawl[]>([])
  const [upcoming, setUpcoming] = useState<Crawl[]>([])
  const [past, setPast] = useState<Crawl[]>([])
  const [loading, setLoading] = useState(true)

  const [showAllHosted,setShowAllHosted] = useState(false)
  const [showAllUpcoming,setShowAllUpcoming] = useState(false)
  const [showAllPast,setShowAllPast] = useState(false)

  useEffect(() => {

    async function loadCrawls() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const today = new Date()
      today.setHours(0,0,0,0)

      const { data: hostedData } = await supabase
        .from('crawl_events')
        .select('id, title, slug, public_id, datetime, city')
        .eq('creator_id', user.id)
        .order('datetime',{ ascending:true })

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
        rsvpData?.map((r:any)=>r.crawl_events).filter(Boolean) ?? []

      const upcomingCrawls:Crawl[] = []
      const pastCrawls:Crawl[] = []

      formattedRsvps.forEach((crawl)=>{

        if(!crawl.datetime){
          upcomingCrawls.push(crawl)
        } else if(new Date(crawl.datetime) >= today){
          upcomingCrawls.push(crawl)
        } else {
          pastCrawls.push(crawl)
        }

      })

      upcomingCrawls.sort(
        (a,b)=>
          new Date(a.datetime ?? '').getTime() -
          new Date(b.datetime ?? '').getTime()
      )

      pastCrawls.sort(
        (a,b)=>
          new Date(b.datetime ?? '').getTime() -
          new Date(a.datetime ?? '').getTime()
      )

      setHosted(hostedData ?? [])
      setUpcoming(upcomingCrawls)
      setPast(pastCrawls)
      setLoading(false)

    }

    loadCrawls()

  },[])

  const removeRsvp = async (crawlId:string) => {

    const {
      data:{ user },
    } = await supabase.auth.getUser()

    if(!user) return

    const { error } = await supabase
      .from('crawl_rsvps')
      .delete()
      .eq('crawl_id',crawlId)
      .eq('user_id',user.id)

    if(error){
      console.error('Failed to remove RSVP:',error)
      return
    }

    setUpcoming(prev => prev.filter(c => c.id !== crawlId))

  }

  if(loading){
    return (
      <p className="text-sm text-muted-foreground">
        Loading your crawls…
      </p>
    )
  }

  const nextCrawl = upcoming[0]

  const hostedVisible = showAllHosted ? hosted : hosted.slice(0,3)
  const upcomingVisible = showAllUpcoming ? upcoming : upcoming.slice(0,3)
  const pastVisible = showAllPast ? past : past.slice(0,3)

  return (

    <div className="space-y-12">

      {/* Hosted */}

      <section className="space-y-4">

        <h2 className="text-lg font-semibold">
          🎉 Hosted Crawls
        </h2>

        {hosted.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You haven’t hosted any crawls yet.
          </p>
        )}

        <div className="grid gap-3">

          {hostedVisible.map((crawl)=>(
            <Link key={crawl.id} href={`/sponsor/${crawl.public_id ?? crawl.slug}`}>

              <Card className="hover:shadow-md transition cursor-pointer">

                <CardContent className="p-4">

                  <p className="font-medium text-foreground">
                    {crawl.title}
                  </p>

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

        {hosted.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={()=>setShowAllHosted(!showAllHosted)}
          >
            {showAllHosted ? 'Show less' : 'See more'}
          </Button>
        )}

      </section>

      {/* Upcoming */}

      <section className="space-y-4">

        <h2 className="text-lg font-semibold">
          🗓️ Upcoming Crawls
        </h2>

        {upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You haven’t joined any upcoming crawls.
          </p>
        )}

        <div className="grid gap-3">

          {upcomingVisible.map((crawl)=>{

            const isNext = nextCrawl?.id === crawl.id
            const countdown = formatCountdown(crawl.datetime)

            return (

              <Link key={crawl.id} href={`/sponsor/${crawl.public_id ?? crawl.slug}`}>

                <Card
                  className={`transition cursor-pointer hover:shadow-md ${
                    isNext ? 'border-primary' : ''
                  }`}
                >

                  <CardContent className="p-4 space-y-1">

                    <p className="font-medium text-foreground">
                      {crawl.title}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {crawl.city} •{' '}
                      {crawl.datetime
                        ? new Date(crawl.datetime).toLocaleDateString()
                        : 'No date'}
                    </p>

                    {countdown && (
                      <p className="text-xs text-primary">
                        Starts in {countdown}
                      </p>
                    )}

                    {isNext && (
                      <p className="text-xs font-semibold text-primary">
                        Your next crawl
                      </p>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={(e)=>{
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

        {upcoming.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={()=>setShowAllUpcoming(!showAllUpcoming)}
          >
            {showAllUpcoming ? 'Show less' : 'See more'}
          </Button>
        )}

      </section>

      {/* Past */}

      <section className="space-y-4">

        <h2 className="text-lg font-semibold">
          📜 Past Crawls
        </h2>

        {past.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No past crawls yet.
          </p>
        )}

        <div className="grid gap-3">

          {pastVisible.map((crawl)=>(
            <Link key={crawl.id} href={`/sponsor/${crawl.public_id ?? crawl.slug}`}>

              <Card className="hover:shadow-md transition cursor-pointer opacity-80">

                <CardContent className="p-4">

                  <p className="font-medium text-foreground">
                    {crawl.title}
                  </p>

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

        {past.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={()=>setShowAllPast(!showAllPast)}
          >
            {showAllPast ? 'Show less' : 'See more'}
          </Button>
        )}

      </section>

    </div>
  )
}