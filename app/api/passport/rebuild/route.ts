import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
}

export async function POST() {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      if (userError) {
        console.error(
          '[passport/rebuild] Failed to authenticate user:',
          userError
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'User not authenticated.',
        },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        }
      )
    }

    const result = await rebuildPublicPassportStats(user.id)

    return NextResponse.json(
      {
        success: true,
        stats: result.stats,
        snapshot: result.snapshot,
        updatedAt: result.updatedAt,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    )
  } catch (error) {
    console.error(
      '[passport/rebuild] Failed to rebuild public Passport stats:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: 'Could not rebuild Passport stats.',
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    )
  }
}