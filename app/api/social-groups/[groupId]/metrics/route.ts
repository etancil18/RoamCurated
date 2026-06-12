import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    groupId: string
  }>
}

type EventRow = {
  id: string
  title: string | null
  starts_at: string | null
}

type CheckinRow = {
  id: string
  event_id: string
  user_id: string
  checked_in_at: string
}

type XpLedgerRow = {
  id: string
  event_id: string
  user_id: string
  xp_amount: number
  created_at: string
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { groupId } = await context.params

    if (!groupId) {
      return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('social_group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Group metrics membership lookup error:', membershipError)

      return NextResponse.json(
        { error: 'Failed to verify group access', details: membershipError.message },
        { status: 500 }
      )
    }

    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [
      { data: group, error: groupError },
      { data: events, error: eventsError },
      { data: checkins, error: checkinsError },
      { data: xpLedger, error: xpLedgerError },
    ] = await Promise.all([
      supabase
        .from('social_groups')
        .select('id, name, slug, description, logo_url')
        .eq('id', groupId)
        .maybeSingle(),

      supabase
        .from('events')
        .select('id, title, starts_at')
        .eq('social_group_id', groupId)
        .order('starts_at', { ascending: false }),

      supabase
        .from('event_checkins')
        .select('id, event_id, user_id, checked_in_at')
        .eq('social_group_id', groupId)
        .order('checked_in_at', { ascending: false }),

      supabase
        .from('event_xp_ledger')
        .select('id, event_id, user_id, xp_amount, created_at')
        .eq('social_group_id', groupId)
        .order('created_at', { ascending: false }),
    ])

    if (groupError) {
      console.error('Group metrics group lookup error:', groupError)
      return NextResponse.json(
        { error: 'Failed to load group', details: groupError.message },
        { status: 500 }
      )
    }

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    if (eventsError) {
      console.error('Group metrics events lookup error:', eventsError)
      return NextResponse.json(
        { error: 'Failed to load group events', details: eventsError.message },
        { status: 500 }
      )
    }

    if (checkinsError) {
      console.error('Group metrics checkins lookup error:', checkinsError)
      return NextResponse.json(
        { error: 'Failed to load check-ins', details: checkinsError.message },
        { status: 500 }
      )
    }

    if (xpLedgerError) {
      console.error('Group metrics XP lookup error:', xpLedgerError)
      return NextResponse.json(
        { error: 'Failed to load XP ledger', details: xpLedgerError.message },
        { status: 500 }
      )
    }

    const safeEvents = (events ?? []) as EventRow[]
    const safeCheckins = (checkins ?? []) as CheckinRow[]
    const safeXpLedger = (xpLedger ?? []) as XpLedgerRow[]

    const uniqueAttendeeIds = new Set(safeCheckins.map((row) => row.user_id))

    const checkinsByUser = safeCheckins.reduce<Record<string, number>>((acc, row) => {
      acc[row.user_id] = (acc[row.user_id] ?? 0) + 1
      return acc
    }, {})

    const repeatAttendees = Object.values(checkinsByUser).filter((count) => count > 1).length

    const xpByEvent = safeXpLedger.reduce<Record<string, number>>((acc, row) => {
      acc[row.event_id] = (acc[row.event_id] ?? 0) + (row.xp_amount ?? 0)
      return acc
    }, {})

    const checkinsByEvent = safeCheckins.reduce<Record<string, CheckinRow[]>>((acc, row) => {
      if (!acc[row.event_id]) acc[row.event_id] = []
      acc[row.event_id].push(row)
      return acc
    }, {})

    const xpByUser = safeXpLedger.reduce<Record<string, number>>((acc, row) => {
      acc[row.user_id] = (acc[row.user_id] ?? 0) + (row.xp_amount ?? 0)
      return acc
    }, {})

    const totalXpAwarded = safeXpLedger.reduce((sum, row) => {
      return sum + (row.xp_amount ?? 0)
    }, 0)

    const eventMetrics = safeEvents.map((event) => {
      const eventCheckins = checkinsByEvent[event.id] ?? []
      const eventUniqueAttendees = new Set(eventCheckins.map((row) => row.user_id))

      return {
        eventId: event.id,
        title: event.title,
        startsAt: event.starts_at,
        checkins: eventCheckins.length,
        uniqueAttendees: eventUniqueAttendees.size,
        xpAwarded: xpByEvent[event.id] ?? 0,
      }
    })

    const attendeeInsights = Object.entries(checkinsByUser)
      .map(([userId, checkinCount]) => {
        const userCheckins = safeCheckins
          .filter((row) => row.user_id === userId)
          .sort((a, b) => {
            return new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
          })

        return {
          userId,
          checkins: checkinCount,
          xpEarned: xpByUser[userId] ?? 0,
          firstCheckinAt: userCheckins[0]?.checked_in_at ?? null,
          lastCheckinAt: userCheckins[userCheckins.length - 1]?.checked_in_at ?? null,
        }
      })
      .sort((a, b) => b.checkins - a.checkins)

    return NextResponse.json({
      group,
      metrics: {
        groupId,
        totalEvents: safeEvents.length,
        totalCheckins: safeCheckins.length,
        uniqueAttendees: uniqueAttendeeIds.size,
        repeatAttendees,
        totalXpAwarded,
      },
      events: eventMetrics,
      attendees: attendeeInsights,
    })
  } catch (error) {
    console.error('Unexpected group metrics error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}