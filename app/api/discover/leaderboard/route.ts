import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { getPassportSnapshot } from '@/lib/passport/score'

type ProfileRow = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  home_neighborhood: string | null
  preferred_vibes: string[] | null
  interest_categories: string[] | null
  is_public: boolean | null
}

type LeaderboardUser = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  home_neighborhood: string | null
  preferred_vibes: string[] | null
  interest_categories: string[] | null
  passport_level: number
  followers_count: number
  completed_flows_count: number
  venue_visits_count: number
  checkins_count: number
  is_following: boolean
  rank: number
}

export async function GET() {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: profilesRaw, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        bio,
        home_neighborhood,
        preferred_vibes,
        interest_categories,
        is_public
      `)
      .eq('is_public', true)
      .not('username', 'is', null)
      .limit(100)
      .returns<ProfileRow[]>()

    if (profilesError) {
      console.error('Leaderboard profiles lookup error:', profilesError)

      return NextResponse.json(
        {
          error: 'Failed to load leaderboard profiles',
          details: profilesError.message,
        },
        { status: 500 }
      )
    }

    const profiles = profilesRaw ?? []
    const profileIds = profiles.map((profile) => profile.id)

    if (profileIds.length === 0) {
      return NextResponse.json(
        {
          users: [],
          currentUserId: user?.id ?? null,
        },
        { status: 200 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      { data: xpRows },
      { data: followRows },
      { data: followingRows },
      { data: completedFlowRows },
      { data: checkinRows },
      { data: hostedRows },
      { data: rsvpRows },
      { data: savedPropertyRows },
      { data: venueVisitRows },
      { data: crawlProgressRows },
    ] = await Promise.all([
      supabase
        .from('event_xp_ledger')
        .select('user_id, xp_amount')
        .in('user_id', profileIds),

      supabase
        .from('user_follows')
        .select('following_id')
        .in('following_id', profileIds),

      user
        ? supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id)
            .in('following_id', profileIds)
        : Promise.resolve({ data: [] as Array<{ following_id: string }> }),

      supabase
        .from('active_flow_sessions')
        .select('user_id, venue_ids')
        .eq('status', 'completed')
        .in('user_id', profileIds),

      supabase
        .from('event_checkins')
        .select('user_id')
        .in('user_id', profileIds),

      supabase
        .from('crawl_events')
        .select('id, creator_id')
        .in('creator_id', profileIds),

      supabase
        .from('crawl_rsvps')
        .select(`
          user_id,
          crawl_id,
          crawl_events (
            id,
            datetime
          )
        `)
        .in('user_id', profileIds),

      supabase
        .from('saved_properties')
        .select('user_id, property_id')
        .in('user_id', profileIds),

      supabase
        .from('venue_visits')
        .select('user_id')
        .in('user_id', profileIds),

      supabase
        .from('crawl_progress')
        .select('user_id, crawl_id')
        .in('user_id', profileIds),
    ])

    const xpByUserId = new Map<string, number>()
    for (const row of xpRows ?? []) {
      const userId = row.user_id as string
      const amount = Number(row.xp_amount ?? 0)

      xpByUserId.set(userId, (xpByUserId.get(userId) ?? 0) + amount)
    }

    const followersByUserId = new Map<string, number>()
    for (const row of followRows ?? []) {
      const followingId = row.following_id as string

      followersByUserId.set(
        followingId,
        (followersByUserId.get(followingId) ?? 0) + 1
      )
    }

    const completedFlowsByUserId = new Map<string, number>()
    const completedFlowStopsByUserId = new Map<string, number>()

    for (const row of completedFlowRows ?? []) {
      const userId = row.user_id as string
      const stopCount = Array.isArray(row.venue_ids)
        ? row.venue_ids.length
        : 0

      completedFlowsByUserId.set(
        userId,
        (completedFlowsByUserId.get(userId) ?? 0) + 1
      )

      completedFlowStopsByUserId.set(
        userId,
        (completedFlowStopsByUserId.get(userId) ?? 0) + stopCount
      )
    }

    const checkinsByUserId = new Map<string, number>()

    for (const row of checkinRows ?? []) {
      const userId = row.user_id as string

      checkinsByUserId.set(
        userId,
        (checkinsByUserId.get(userId) ?? 0) + 1
      )
    }

    const hostedCrawlsByUserId = new Map<string, number>()

    for (const row of hostedRows ?? []) {
      const userId = row.creator_id as string

      hostedCrawlsByUserId.set(
        userId,
        (hostedCrawlsByUserId.get(userId) ?? 0) + 1
      )
    }

    const joinedCrawlsByUserId = new Map<string, number>()
    const pastCrawlsByUserId = new Map<string, number>()

    for (const row of rsvpRows ?? []) {
      const userId = row.user_id as string
      const crawl = (row as any).crawl_events

      joinedCrawlsByUserId.set(
        userId,
        (joinedCrawlsByUserId.get(userId) ?? 0) + 1
      )

      if (crawl?.datetime && new Date(crawl.datetime) < today) {
        pastCrawlsByUserId.set(
          userId,
          (pastCrawlsByUserId.get(userId) ?? 0) + 1
        )
      }
    }

    const savedPropertiesByUserId = new Map<string, number>()

    for (const row of savedPropertyRows ?? []) {
      const userId = row.user_id as string

      savedPropertiesByUserId.set(
        userId,
        (savedPropertiesByUserId.get(userId) ?? 0) + 1
      )
    }

    const venueVisitsByUserId = new Map<string, number>()

    for (const row of venueVisitRows ?? []) {
      const userId = row.user_id as string

      venueVisitsByUserId.set(
        userId,
        (venueVisitsByUserId.get(userId) ?? 0) + 1
      )
    }

    const hostedFlowStopsByUserId = new Map<string, number>()

    const crawlIds = [
      ...new Set(
        (crawlProgressRows ?? [])
          .map((row: any) => row.crawl_id)
          .filter(Boolean)
      ),
    ]

    for (const row of crawlProgressRows ?? []) {
      const userId = row.user_id as string

      hostedFlowStopsByUserId.set(
        userId,
        (hostedFlowStopsByUserId.get(userId) ?? 0) + 1
      )
    }

    const completedHostedFlowsByUserId = new Map<string, number>()

    if (crawlIds.length > 0) {
      const { data: crawlEvents } = await supabase
        .from('crawl_events')
        .select('id, venue_ids')
        .in('id', crawlIds)

      for (const profileId of profileIds) {
        const userProgressRows =
          crawlProgressRows?.filter(
            (row: any) => row.user_id === profileId
          ) ?? []

        const userCrawlIds = [
          ...new Set(
            userProgressRows
              .map((row: any) => row.crawl_id)
              .filter(Boolean)
          ),
        ]

        let completedHostedFlows = 0

        for (const crawlId of userCrawlIds) {
          const crawl = crawlEvents?.find(
            (row: any) => row.id === crawlId
          )

          const requiredStops = Array.isArray(
            (crawl as any)?.venue_ids
          )
            ? (crawl as any).venue_ids.length
            : 0

          const completedStops =
            userProgressRows.filter(
              (row: any) => row.crawl_id === crawlId
            ).length ?? 0

          if (
            requiredStops > 0 &&
            completedStops >= requiredStops
          ) {
            completedHostedFlows += 1
          }
        }

        completedHostedFlowsByUserId.set(
          profileId,
          completedHostedFlows
        )
      }
    }

    const followingIds = new Set(
      (followingRows ?? []).map(
        (row) => row.following_id as string
      )
    )

    const rankedUsers: LeaderboardUser[] = profiles
      .map((profile) => {
        const { level: passportLevel } = getPassportSnapshot({
          hostedCrawls:
            hostedCrawlsByUserId.get(profile.id) ?? 0,
          joinedCrawls:
            joinedCrawlsByUserId.get(profile.id) ?? 0,
          pastCrawls:
            pastCrawlsByUserId.get(profile.id) ?? 0,
          savedProperties:
            savedPropertiesByUserId.get(profile.id) ?? 0,
          completedFlows:
            completedFlowsByUserId.get(profile.id) ?? 0,
          completedFlowStops:
            completedFlowStopsByUserId.get(profile.id) ?? 0,
          hostedFlowStops:
            hostedFlowStopsByUserId.get(profile.id) ?? 0,
          completedHostedFlows:
            completedHostedFlowsByUserId.get(profile.id) ?? 0,
          venueVisits:
            venueVisitsByUserId.get(profile.id) ?? 0,
          eventXp:
            xpByUserId.get(profile.id) ?? 0,
          eventCheckins:
            checkinsByUserId.get(profile.id) ?? 0,
        })

        return {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          home_neighborhood: profile.home_neighborhood,
          preferred_vibes: profile.preferred_vibes,
          interest_categories: profile.interest_categories,
          passport_level: passportLevel,
          followers_count:
            followersByUserId.get(profile.id) ?? 0,
          completed_flows_count:
            completedFlowsByUserId.get(profile.id) ?? 0,
          venue_visits_count:
            venueVisitsByUserId.get(profile.id) ?? 0,
          checkins_count:
            checkinsByUserId.get(profile.id) ?? 0,
          is_following:
            followingIds.has(profile.id),
          rank: 0,
        }
      })
      .sort((a, b) => {
        const levelDelta =
          b.passport_level - a.passport_level

        if (levelDelta !== 0) return levelDelta

        const followersDelta =
          b.followers_count - a.followers_count

        if (followersDelta !== 0) return followersDelta

        const flowsDelta =
          b.completed_flows_count - a.completed_flows_count

        if (flowsDelta !== 0) return flowsDelta

        const checkinsDelta =
          b.checkins_count - a.checkins_count

        if (checkinsDelta !== 0) return checkinsDelta

        return (
          a.full_name ??
          a.username ??
          ''
        ).localeCompare(
          b.full_name ??
            b.username ??
            ''
        )
      })
      .slice(0, 25)
      .map((profile, index) => ({
        ...profile,
        rank: index + 1,
      }))

    return NextResponse.json(
      {
        users: rankedUsers,
        currentUserId: user?.id ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      'Unexpected discover leaderboard error:',
      error
    )

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}