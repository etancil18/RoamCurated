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
        { error: 'You cannot unfollow yourself' },
        { status: 400 }
      )
    }

    const { error: unfollowError } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', userId)

    if (unfollowError) {
      console.error('Unfollow delete error:', unfollowError)

      return NextResponse.json(
        { error: 'Failed to unfollow user', details: unfollowError.message },
        { status: 500 }
      )
    }

    const { count: followersCount } = await supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId)

    return NextResponse.json(
      {
        isFollowing: false,
        followersCount: followersCount ?? 0,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected unfollow error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}