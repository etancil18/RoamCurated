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
  created_at?: string | null
}

type DiscoverUser = ProfileRow & {
  followers_count: number
  is_following: boolean
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const rawQuery = searchParams.get('q')
    const suggested = searchParams.get('suggested') === 'true'
    const query = cleanQuery(rawQuery)

    if (!suggested && (!query || query.length < 2)) {
      return NextResponse.json(
        {
          users: [],
          currentUserId: user?.id ?? null,
        },
        { status: 200 }
      )
    }

    let profilesQuery = supabase
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
        is_public,
        created_at
      `)
      .eq('is_public', true)
      .not('username', 'is', null)
      .limit(12)

    if (query) {
      profilesQuery = profilesQuery.or(
        `username.ilike.%${escapeIlike(query)}%,full_name.ilike.%${escapeIlike(query)}%`
      )
    } else {
      profilesQuery = profilesQuery.order('created_at', { ascending: false })
    }

    const { data: profilesRaw, error: profilesError } = await profilesQuery.returns<
      ProfileRow[]
    >()

    if (profilesError) {
      console.error('Discover users lookup error:', profilesError)

      return NextResponse.json(
        {
          error: 'Failed to load users',
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

    const [{ data: followRows }, { data: followingRows }] = await Promise.all([
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
    ])

    const followerCountByProfileId = new Map<string, number>()

    for (const row of followRows ?? []) {
      const followingId = row.following_id as string
      followerCountByProfileId.set(
        followingId,
        (followerCountByProfileId.get(followingId) ?? 0) + 1
      )
    }

    const followingIds = new Set(
      (followingRows ?? []).map((row) => row.following_id as string)
    )

    const users: DiscoverUser[] = profiles
      .filter((profile) => profile.id !== user?.id)
      .map((profile) => ({
        ...profile,
        followers_count: followerCountByProfileId.get(profile.id) ?? 0,
        is_following: followingIds.has(profile.id),
      }))
      .sort((a, b) => {
        if (suggested) {
          const followerDelta = b.followers_count - a.followers_count
          if (followerDelta !== 0) return followerDelta
        }

        return (a.full_name ?? a.username ?? '').localeCompare(
          b.full_name ?? b.username ?? ''
        )
      })

    return NextResponse.json(
      {
        users,
        currentUserId: user?.id ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected discover users error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function cleanQuery(value: string | null): string | null {
  if (!value) return null

  const cleaned = value.trim().replace(/^@+/, '')

  return cleaned.length > 0 ? cleaned : null
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&')
}