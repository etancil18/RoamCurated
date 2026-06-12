import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    eventId: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log('event check-in auth:', {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      userError: userError?.message ?? null,
    })

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, social_group_id, xp_reward, checkin_enabled')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) {
      console.error('Check-in event lookup error:', eventError)
      return NextResponse.json(
        { error: 'Failed to load event', details: eventError.message },
        { status: 500 }
      )
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.checkin_enabled === false) {
      return NextResponse.json(
        { error: 'Check-in is disabled for this event' },
        { status: 403 }
      )
    }

    const xpAwarded =
      typeof event.xp_reward === 'number' && event.xp_reward > 0
        ? event.xp_reward
        : 25

    const { data: existingCheckin, error: existingCheckinError } = await supabase
      .from('event_checkins')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingCheckinError) {
      console.error('Existing check-in lookup error:', existingCheckinError)
      return NextResponse.json(
        { error: 'Failed to verify check-in status', details: existingCheckinError.message },
        { status: 500 }
      )
    }

    if (existingCheckin) {
      return NextResponse.json({
        checkedIn: true,
        alreadyCheckedIn: true,
        xpAwarded: 0,
        message: 'Already checked in',
      })
    }

    const { error: checkinError } = await supabase
      .from('event_checkins')
      .insert({
        event_id: eventId,
        user_id: user.id,
        social_group_id: event.social_group_id ?? null,
        source: 'event_page',
      })

    if (checkinError) {
      console.error('Event check-in insert error:', checkinError)

      if (checkinError.code === '23505') {
        return NextResponse.json({
          checkedIn: true,
          alreadyCheckedIn: true,
          xpAwarded: 0,
          message: 'Already checked in',
        })
      }

      return NextResponse.json(
        { error: 'Failed to check in', details: checkinError.message },
        { status: 500 }
      )
    }

    const { error: xpError } = await supabase
      .from('event_xp_ledger')
      .insert({
        user_id: user.id,
        event_id: eventId,
        social_group_id: event.social_group_id ?? null,
        xp_amount: xpAwarded,
        reason: 'event_checkin',
      })

    if (xpError) {
      console.error('Event XP ledger insert error:', xpError)

      if (xpError.code === '23505') {
        return NextResponse.json({
          checkedIn: true,
          alreadyCheckedIn: true,
          xpAwarded: 0,
          message: 'Already checked in',
        })
      }

      return NextResponse.json(
        {
          checkedIn: true,
          xpAwarded: 0,
          warning: 'Checked in, but XP was not awarded',
          details: xpError.message,
        },
        { status: 207 }
      )
    }

    return NextResponse.json({
      checkedIn: true,
      alreadyCheckedIn: false,
      xpAwarded,
    })
  } catch (error) {
    console.error('Unexpected event check-in error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}