import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type RangeType = '24h' | '7d' | '30d' | 'custom'

function computeDateRange(
  range: RangeType,
  start?: string | null,
  end?: string | null
) {
  const now = new Date()

  if (range === 'custom') {
    if (!start || !end) {
      throw new Error('Custom range requires start and end')
    }
    return {
      rangeStart: new Date(start).toISOString(),
      rangeEnd: new Date(end).toISOString(),
    }
  }

  let ms = 0
  if (range === '24h') ms = 24 * 60 * 60 * 1000
  if (range === '7d') ms = 7 * 24 * 60 * 60 * 1000
  if (range === '30d') ms = 30 * 24 * 60 * 60 * 1000

  return {
    rangeStart: new Date(now.getTime() - ms).toISOString(),
    rangeEnd: now.toISOString(),
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(req.url)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: venueUser } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (!venueUser) {
      return NextResponse.json(
        { error: 'Venue access not found' },
        { status: 403 }
      )
    }

    const venueId = venueUser.venue_id
    const range = (searchParams.get('range') as RangeType) ?? '7d'
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const { rangeStart, rangeEnd } = computeDateRange(range, start, end)

    // Basic KPI counts
    const [favRes, likeRes, crawlRes] = await Promise.all([
      supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),

      supabase
        .from('event_interests')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('interested_at', rangeStart)
        .lte('interested_at', rangeEnd),

      supabase
        .from('crawl_events')
        .select('*', { count: 'exact', head: true })
        .contains('venue_ids', [venueId])
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
    ])

    // Fetch venue coordinates
    const { data: venue } = await supabase
      .from('venues')
      .select('lat, lon')
      .eq('id', venueId)
      .single()

    if (venue?.lat == null || venue?.lon == null) {
      return NextResponse.json({
        favorites: favRes.count ?? 0,
        eventLikes: likeRes.count ?? 0,
        crawlInclusions: crawlRes.count ?? 0,
        crawlThemeBreakdown: [],
        crawlInclusionTimeline: [],
      })
    }

    // Round venue coords to 4 decimals
    const venueLat4 = Number(venue.lat.toFixed(4))
    const venueLon4 = Number(venue.lon.toFixed(4))

    // Fetch route requests
    const { data: routes } = await supabase
      .from('route_requests')
      .select('crawl_theme, waypoints, created_at')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)

    const themeCounts: Record<string, number> = {}
    const timelineMap: Record<string, number> = {}

    if (Array.isArray(routes)) {
      routes.forEach((route: any) => {
        if (!Array.isArray(route.waypoints)) return

        const venueIncluded = route.waypoints.some((wp: any) => {
          if (typeof wp?.lat !== 'number' || typeof wp?.lng !== 'number') {
            return false
          }

          const wpLat4 = Number(wp.lat.toFixed(4))
          const wpLng4 = Number(wp.lng.toFixed(4))

          return wpLat4 === venueLat4 && wpLng4 === venueLon4
        })

        if (!venueIncluded) return

        const theme = route.crawl_theme ?? 'Unknown'
        themeCounts[theme] = (themeCounts[theme] ?? 0) + 1

        const dateKey = new Date(route.created_at)
          .toISOString()
          .split('T')[0]
        timelineMap[dateKey] = (timelineMap[dateKey] ?? 0) + 1
      })
    }

    const crawlThemeBreakdown = Object.entries(themeCounts).map(
      ([theme, count]) => ({ theme, count })
    )

    const crawlInclusionTimeline = Object.entries(timelineMap)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, count]) => ({ date, count }))

    return NextResponse.json({
      favorites: favRes.count ?? 0,
      eventLikes: likeRes.count ?? 0,
      crawlInclusions: crawlRes.count ?? 0,
      rangeStart,
      rangeEnd,
      crawlThemeBreakdown,
      crawlInclusionTimeline,
    })
  } catch (err: any) {
    console.error('[dash/metrics]', err)
    return NextResponse.json(
      { error: err.message ?? 'Internal error' },
      { status: 500 }
    )
  }
}
