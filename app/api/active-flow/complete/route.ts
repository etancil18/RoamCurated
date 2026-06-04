import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type CompleteActiveFlowBody = {
  session_id?: string
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

    const body = (await req.json()) as CompleteActiveFlowBody
    const sessionId = body.session_id

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id.' },
        { status: 400 }
      )
    }

    const { data: session, error: sessionError } = await supabase
      .from('active_flow_sessions')
      .select('id, user_id, venue_ids, status, completed_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError) {
      console.error('[active-flow/complete] Session fetch failed:', sessionError)

      return NextResponse.json(
        { error: 'Could not fetch active flow.' },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Flow not found.' },
        { status: 404 }
      )
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { session, message: 'Flow already completed.' },
        { status: 200 }
      )
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active flows can be completed.' },
        { status: 400 }
      )
    }

    const venueIds = Array.isArray(session.venue_ids)
      ? session.venue_ids.filter(Boolean)
      : []

    if (venueIds.length < 2) {
      return NextResponse.json(
        { error: 'Invalid flow: not enough stops.' },
        { status: 400 }
      )
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('active_flow_progress')
      .select('venue_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    if (progressError) {
      console.error('[active-flow/complete] Progress fetch failed:', progressError)

      return NextResponse.json(
        { error: 'Could not verify flow progress.' },
        { status: 500 }
      )
    }

    const completedVenueIds = new Set(
      (progressRows ?? [])
        .map((row) => row.venue_id)
        .filter(Boolean)
    )

    const missingVenueIds = venueIds.filter(
      (venueId) => !completedVenueIds.has(venueId)
    )

    if (missingVenueIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Flow is not complete yet.',
          completedStops: completedVenueIds.size,
          totalStops: venueIds.length,
          missingVenueIds,
        },
        { status: 409 }
      )
    }

    const completedAt = new Date().toISOString()

    const { data: updatedSession, error: updateError } = await supabase
      .from('active_flow_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError || !updatedSession) {
      console.error('[active-flow/complete] Completion update failed:', updateError)

      return NextResponse.json(
        { error: 'Could not complete flow.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        session: updatedSession,
        xpEarned: venueIds.length * 25 + 100,
        badgeUnlocked: 'Flow Finisher',
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[active-flow/complete] Unexpected error:', err)

    return NextResponse.json(
      { error: 'Unexpected error completing flow.' },
      { status: 500 }
    )
  }
}