import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    // fetch application user record
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        subscription_status,
        subscription_tier
      `)
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('User fetch error:', error)

      return NextResponse.json(
        { error: 'User record not found' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: data.id,
        email: data.email,
        subscription_status: data.subscription_status,
        subscription_tier: data.subscription_tier,
      },
    })
  } catch (err) {
    console.error('API /me error:', err)

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    )
  }
}