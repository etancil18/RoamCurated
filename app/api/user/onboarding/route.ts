import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

import {
  evaluateOnboardingNextPath,
  type OnboardingRoutingResult,
} from '@/lib/onboarding/getOnboardingNextPath'

const PROFILE_ONBOARDING_COLUMNS = `
  id,
  full_name,
  username,
  home_neighborhood,
  preferred_vibes,
  interest_categories,
  deleted_at,
  has_seen_roam_intro,
  onboarding_path,
  creator_onboarding_completed_at
` as const

type OnboardingStatusResponse = {
  hasSeenRoamIntro: boolean
  onboardingPath: OnboardingRoutingResult['onboardingPath']
  profileCompleted: boolean
  creatorOnboardingCompleted: boolean
  nextPath: string
}

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
    .schema('public')
    .from('profiles')
    .select(PROFILE_ONBOARDING_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[user/onboarding][GET] Profile fetch failed:', error)

    return NextResponse.json(
      { error: 'Failed to load onboarding status' },
      { status: 500 }
    )
  }

  /**
   * Preserve the existing behavior for authenticated users whose profile row
   * has not been created yet.
   *
   * They have not seen the intro, have not selected a path, and should begin
   * at the Welcome page.
   */
  if (!profile) {
    return NextResponse.json({
      hasSeenRoamIntro: false,
      onboardingPath: null,
      profileCompleted: false,
      creatorOnboardingCompleted: false,
      nextPath: '/welcome',
    } satisfies OnboardingStatusResponse)
  }

  const routing =
    evaluateOnboardingNextPath(profile)

  return NextResponse.json({
    hasSeenRoamIntro:
      routing.hasSeenRoamIntro,

    onboardingPath:
      routing.onboardingPath,

    profileCompleted:
      routing.profileCompleted,

    creatorOnboardingCompleted:
      routing.creatorOnboardingCompleted,

    nextPath:
      routing.nextPath,
  } satisfies OnboardingStatusResponse)
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
    .schema('public')
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
    .select(PROFILE_ONBOARDING_COLUMNS)
    .single()

  if (error) {
    console.error('[user/onboarding][POST] Profile update failed:', error)

    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }

  const routing =
    evaluateOnboardingNextPath(data)

  return NextResponse.json({
    success: true,

    hasSeenRoamIntro:
      routing.hasSeenRoamIntro,

    onboardingPath:
      routing.onboardingPath,

    profileCompleted:
      routing.profileCompleted,

    creatorOnboardingCompleted:
      routing.creatorOnboardingCompleted,

    nextPath:
      routing.nextPath,
  })
}