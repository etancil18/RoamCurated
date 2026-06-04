import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type CheckInActiveFlowBody = {
  session_id?: string
  venue_id?: string
  stop_index?: number
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

    const body = (await req.json()) as CheckInActiveFlowBody

    const sessionId = body.session_id
    const venueId = body.venue_id
    const stopIndex = body.stop_index

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id.' },
        { status: 400 }
      )
    }

    if (!venueId) {
      return NextResponse.json(
        { error: 'Missing venue_id.' },
        { status: 400 }
      )
    }

    if (
      typeof stopIndex !== 'number' ||
      !Number.isInteger(stopIndex) ||
      stopIndex < 0
    ) {
      return NextResponse.json(
        { error: 'Invalid stop_index.' },
        { status: 400 }
      )
    }

    const { data: session, error: sessionError } = await supabase
      .from('active_flow_sessions')
      .select('id, user_id, venue_ids, status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError) {
      console.error('[active-flow/check-in] Session fetch failed:', sessionError)

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

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active flows can be checked into.' },
        { status: 400 }
      )
    }

    const venueIds = Array.isArray(session.venue_ids)
      ? session.venue_ids.filter(Boolean)
      : []

    if (!venueIds.includes(venueId)) {
      return NextResponse.json(
        { error: 'Venue is not part of this flow.' },
        { status: 400 }
      )
    }

    if (venueIds[stopIndex] !== venueId) {
      return NextResponse.json(
        { error: 'Stop index does not match this venue.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const { data: progress, error: upsertError } = await supabase
      .from('active_flow_progress')
      .upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          venue_id: venueId,
          stop_index: stopIndex,
          checked_in_at: now,
        },
        {
          onConflict: 'session_id,user_id,venue_id',
        }
      )
      .select('*')
      .single()

    if (upsertError || !progress) {
      console.error('[active-flow/check-in] Check-in upsert failed:', upsertError)

      return NextResponse.json(
        { error: 'Could not check in.' },
        { status: 500 }
      )
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('active_flow_progress')
      .select('venue_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    if (progressError) {
      console.error('[active-flow/check-in] Progress refresh failed:', progressError)

      return NextResponse.json(
        { error: 'Check-in saved, but progress could not be refreshed.' },
        { status: 500 }
      )
    }

    const completedVenueIds = new Set(
      (progressRows ?? [])
        .map((row) => row.venue_id)
        .filter(Boolean)
    )

    const completedStops = completedVenueIds.size
    const totalStops = venueIds.length
    const flowCompleted = completedStops === totalStops

    return NextResponse.json(
      {
        progress,
        completedStops,
        totalStops,
        flowCompleted,
        xpEarned: 25,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[active-flow/check-in] Unexpected error:', err)

    return NextResponse.json(
      { error: 'Unexpected error checking in.' },
      { status: 500 }
    )
  }
}