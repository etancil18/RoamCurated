import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

export async function GET(_req: NextRequest) {
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('has_seen_roam_intro')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[user/onboarding][GET] Profile fetch failed:', error)

    return NextResponse.json(
      { error: 'Failed to load onboarding status' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    hasSeenRoamIntro: profile?.has_seen_roam_intro === true,
  })
}

export async function POST(_req: NextRequest) {
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        has_seen_roam_intro: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
      }
    )
    .select('id, has_seen_roam_intro')
    .single()

  if (error) {
    console.error('[user/onboarding][POST] Profile update failed:', error)

    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    hasSeenRoamIntro: data.has_seen_roam_intro === true,
  })
}