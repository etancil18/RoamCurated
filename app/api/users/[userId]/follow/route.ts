import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    userId: string
  }>
}

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { userId } = await context.params

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.id === userId) {
      return NextResponse.json(
        { error: 'You cannot follow yourself' },
        { status: 400 }
      )
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, is_public')
      .eq('id', userId)
      .maybeSingle()

    if (targetError) {
      console.error('Follow target lookup error:', targetError)

      return NextResponse.json(
        { error: 'Failed to load target user', details: targetError.message },
        { status: 500 }
      )
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (targetProfile.is_public === false) {
      return NextResponse.json(
        { error: 'Cannot follow a private profile' },
        { status: 403 }
      )
    }

    const { error: followError } = await supabase
      .from('user_follows')
      .upsert(
        {
          follower_id: user.id,
          following_id: userId,
        },
        {
          onConflict: 'follower_id,following_id',
        }
      )

    if (followError) {
      console.error('Follow insert error:', followError)

      return NextResponse.json(
        { error: 'Failed to follow user', details: followError.message },
        { status: 500 }
      )
    }

    const { count: followersCount } = await supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId)

    return NextResponse.json(
      {
        isFollowing: true,
        followersCount: followersCount ?? 0,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected follow error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}