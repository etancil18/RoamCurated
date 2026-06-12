import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type OnboardingProfilePayload = {
  full_name?: unknown
  instagram_handle?: unknown
  age_range?: unknown
  home_neighborhood?: unknown
  preferred_vibes?: unknown
  interest_categories?: unknown
  frequency?: unknown
  crawl_type?: unknown
  days_out?: unknown
  intent_level?: unknown
  personality_style?: unknown
  social_comfort?: unknown
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as OnboardingProfilePayload

    const payload = {
      id: user.id,
      full_name: cleanString(body.full_name),
      instagram_handle: cleanInstagram(body.instagram_handle),
      age_range: cleanString(body.age_range),
      home_neighborhood: cleanString(body.home_neighborhood),
      preferred_vibes: cleanStringArray(body.preferred_vibes),
      interest_categories: cleanStringArray(body.interest_categories),
      frequency: cleanString(body.frequency),
      crawl_type: cleanString(body.crawl_type),
      days_out: cleanStringArray(body.days_out),
      intent_level: cleanString(body.intent_level),
      personality_style: cleanString(body.personality_style),
      social_comfort: cleanString(body.social_comfort),
      has_seen_roam_intro: true,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, {
        onConflict: 'id',
      })
      .select('*')
      .single()

    if (error) {
      console.error('Profile onboarding upsert error:', error)

      return NextResponse.json(
        {
          error: 'Failed to save onboarding profile',
          details: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile: data }, { status: 200 })
  } catch (error) {
    console.error('Unexpected profile onboarding error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : null
}

function cleanInstagram(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const cleaned = value
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')

  return cleaned.length > 0 ? cleaned : null
}

function cleanStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const cleaned = value
    .map((item) => String(item).trim())
    .filter(Boolean)

  return cleaned.length > 0 ? cleaned : null
}