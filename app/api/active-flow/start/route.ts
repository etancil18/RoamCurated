import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type StartActiveFlowBody = {
  city?: string | null
  title?: string | null
  source?: string | null
  venue_ids?: string[]
  theme_id?: string | null
  travel_mode?: 'walking' | 'cycling' | 'driving'
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const body = (await req.json()) as StartActiveFlowBody

    const venueIds = Array.isArray(body.venue_ids)
      ? body.venue_ids.filter(Boolean)
      : []

    if (venueIds.length < 2) {
      return NextResponse.json(
        { error: 'A flow requires at least 2 stops.' },
        { status: 400 }
      )
    }

    const travelMode = body.travel_mode ?? 'walking'

    if (!['walking', 'cycling', 'driving'].includes(travelMode)) {
      return NextResponse.json(
        { error: 'Invalid travel mode.' },
        { status: 400 }
      )
    }

    const { data: existingActiveFlow, error: existingError } = await supabase
      .from('active_flow_sessions')
      .select('id, title, city, started_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingError) {
      console.error('[active-flow/start] Existing flow check failed:', existingError)

      return NextResponse.json(
        { error: 'Could not check existing active flow.' },
        { status: 500 }
      )
    }

    if (existingActiveFlow) {
      return NextResponse.json(
        {
          error: 'You already have an active flow.',
          activeSession: existingActiveFlow,
        },
        { status: 409 }
      )
    }

    const { data: session, error: insertError } = await supabase
      .from('active_flow_sessions')
      .insert({
        user_id: user.id,
        title: body.title?.trim() || 'Roam Flow',
        city: body.city ?? null,
        source: body.source ?? 'map',
        venue_ids: venueIds,
        theme_id: body.theme_id ?? null,
        travel_mode: travelMode,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertError || !session) {
      console.error('[active-flow/start] Insert failed:', insertError)

      return NextResponse.json(
        { error: 'Could not start flow.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        session,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[active-flow/start] Unexpected error:', err)

    return NextResponse.json(
      { error: 'Unexpected error starting flow.' },
      { status: 500 }
    )
  }
}