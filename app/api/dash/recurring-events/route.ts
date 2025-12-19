import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

/**
 * Recurring Events API Route
 * Supports:
 *   - GET    /api/dash/recurring-events
 *   - POST   /api/dash/recurring-events
 *   - PATCH  /api/dash/recurring-events?id=…
 *   - DELETE /api/dash/recurring-events?id=…
 */

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerApi()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: venueUser } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (!venueUser) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    const { data: recurringEvents, error } = await supabase
      .from('recurring_events')
      .select('*')
      .eq('venue_id', venueUser.venue_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(recurringEvents)
  } catch (err: any) {
    console.error('[recurring-events GET] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerApi()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: venueUser } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (!venueUser) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      title,
      description,
      tags,
      price_info,
      recurrence_rule,
      start_time,
      end_time,
      starts_on,
      ends_on,
    } = body

    const { data: created, error } = await supabase
      .from('recurring_events')
      .insert([
        {
          venue_id: venueUser.venue_id,
          title,
          description,
          tags,
          price_info,
          recurrence_rule,
          start_time,
          end_time,
          starts_on,
          ends_on,
        },
      ])
      .single()

    if (error) {
      console.error('[recurring-events POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(created)
  } catch (err: any) {
    console.error('[recurring-events POST] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await supabaseServerApi()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: venueUser } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (!venueUser) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const body = await req.json()
    const { error } = await supabase
      .from('recurring_events')
      .update(body)
      .eq('id', id)
      .eq('venue_id', venueUser.venue_id)

    if (error) {
      console.error('[recurring-events PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[recurring-events PATCH] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await supabaseServerApi()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: venueUser } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (!venueUser) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('recurring_events')
      .delete()
      .eq('id', id)
      .eq('venue_id', venueUser.venue_id)

    if (error) {
      console.error('[recurring-events DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[recurring-events DELETE] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
