import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

/**
 * API route: /api/dash/events
 * Methods supported:
 *   - GET      : list events for the current venue
 *   - POST     : create a new event
 *   - PATCH    : update an existing event (requires ?id=)
 *   - DELETE   : delete an event (requires ?id=)
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

    const { data: vuData, error: vuError } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (vuError || !vuData) {
      return NextResponse.json(
        { error: 'Venue access not found' },
        { status: 403 }
      )
    }

    const venueId = vuData.venue_id

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('venue_id', venueId)
      .order('starts_at', { ascending: true })

    if (error) {
      console.error('[events GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[events GET] Server error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Internal error' },
      { status: 500 }
    )
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

    const body = await req.json()
    const {
      title,
      description,
      tags,
      price_info,
      starts_at,
      ends_at,
      source,
      source_type,
    } = body

    const { data: vuData, error: vuError } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (vuError || !vuData) {
      return NextResponse.json(
        { error: 'Venue access not found' },
        { status: 403 }
      )
    }

    const venueId = vuData.venue_id

    const { data: newEvent, error } = await supabase
      .from('events')
      .insert([
        {
          venue_id: venueId,
          title,
          description,
          tags,
          price_info,
          starts_at,
          ends_at,
          source: source ?? 'dash',
          source_type: source_type ?? 'venue_event',
        },
      ])
      .single()

    if (error) {
      console.error('[events POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ✅ SURGICAL ADDITION: update live status
    await supabase
      .from('venue_live_status')
      .upsert(
        {
          venue_id: venueId,
          is_open_for_dropins: true,
          status_tags: ['event'],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'venue_id' }
      )

    return NextResponse.json(newEvent)
  } catch (err: any) {
    console.error('[events POST] Server error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Internal error' },
      { status: 500 }
    )
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

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
    }

    const body = await req.json()

    const { data: vuData, error: vuError } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (vuError || !vuData) {
      return NextResponse.json(
        { error: 'Venue access not found' },
        { status: 403 }
      )
    }

    const venueId = vuData.venue_id

    const { error } = await supabase
      .from('events')
      .update(body)
      .eq('id', id)
      .eq('venue_id', venueId)

    if (error) {
      console.error('[events PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[events PATCH] Server error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Internal error' },
      { status: 500 }
    )
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

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
    }

    const { data: vuData, error: vuError } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (vuError || !vuData) {
      return NextResponse.json(
        { error: 'Venue access not found' },
        { status: 403 }
      )
    }

    const venueId = vuData.venue_id

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('venue_id', venueId)

    if (error) {
      console.error('[events DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[events DELETE] Server error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Internal error' },
      { status: 500 }
    )
  }
}
