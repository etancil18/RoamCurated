import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

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

    const [
      { data: xpRows },
      { data: followRows },
      { data: followingRows },
      { data: completedFlowRows },
      { data: checkinRows },
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
        .select('user_id')
        .eq('status', 'completed')
        .in('user_id', profileIds),

      supabase
        .from('event_checkins')
        .select('user_id')
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
    for (const row of completedFlowRows ?? []) {
      const userId = row.user_id as string

      completedFlowsByUserId.set(
        userId,
        (completedFlowsByUserId.get(userId) ?? 0) + 1
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

    const followingIds = new Set(
      (followingRows ?? []).map((row) => row.following_id as string)
    )

    const rankedUsers: LeaderboardUser[] = profiles
      .filter((profile) => profile.id !== user?.id)
      .map((profile) => {
        const hiddenXp = xpByUserId.get(profile.id) ?? 0
        const passportLevel = Math.max(1, Math.floor(hiddenXp / 250) + 1)

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
          followers_count: followersByUserId.get(profile.id) ?? 0,
          completed_flows_count: completedFlowsByUserId.get(profile.id) ?? 0,
          checkins_count: checkinsByUserId.get(profile.id) ?? 0,
          is_following: followingIds.has(profile.id),
          rank: 0,
        }
      })
      .sort((a, b) => {
        const levelDelta = b.passport_level - a.passport_level
        if (levelDelta !== 0) return levelDelta

        const followersDelta = b.followers_count - a.followers_count
        if (followersDelta !== 0) return followersDelta

        const flowsDelta = b.completed_flows_count - a.completed_flows_count
        if (flowsDelta !== 0) return flowsDelta

        const checkinsDelta = b.checkins_count - a.checkins_count
        if (checkinsDelta !== 0) return checkinsDelta

        return (a.full_name ?? a.username ?? '').localeCompare(
          b.full_name ?? b.username ?? ''
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
    console.error('Unexpected discover leaderboard error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}