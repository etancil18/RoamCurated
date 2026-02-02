import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import type { Database } from '@/types/supabase'

type EventRow = Database['public']['Tables']['events']['Row']

export async function GET(req: Request) {
  const supabase = await supabaseServerApi()
  const url = new URL(req.url)

  const city = url.searchParams.get('city')?.toLowerCase() || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null
  const tags = url.searchParams.get('tags') || null
  const onlyActive = url.searchParams.get('active')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  if (process.env.NODE_ENV !== 'production') {
    console.debug('📥 Incoming /api/events params:', {
      city,
      from,
      to,
      tags,
      onlyActive,
      limit,
      offset,
    })
  }

  if (!city || !from || !to) {
    console.warn('⚠️ Missing filters in /api/events:', { city, from, to })
  }

  let query = supabase
    .from('events')
    .select(
      `
      id,
      title,
      description,
      starts_at,
      ends_at,
      tags,
      price_info,
      source_type,
      timezone,
      is_active,
      created_at,
      updated_at,
      ticket_link,
      venue:venues!events_venue_id_fkey (
        id,
        name,
        slug,
        lat,
        lon,
        city,
        cover
      ),
      event_interests(count)
    `
    )
    .not('venue', 'is', null)

  const activeParam = onlyActive?.toLowerCase()
  const isActive = activeParam !== 'false' && activeParam !== '0'
  if (isActive) {
    query = query.eq('is_active', true)
  }

  if (from) query = query.gte('starts_at', from)
  if (to) query = query.lte('starts_at', to)
  if (city) query = query.filter('venues.city', 'eq', city)

  if (tags) {
    const tagList = tags.split(',').map((t) => t.trim())
    query = query.overlaps('tags', tagList)
  }

  query = query.order('starts_at', { ascending: true }).range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    console.error('❌ Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error.message },
      { status: 500 }
    )
  }

  const eventsWithCounts = (data ?? []).map((event) => ({
    ...event,
    interest_count: event.event_interests?.[0]?.count ?? 0,
  }))

  if (process.env.NODE_ENV !== 'production') {
    console.debug(
      '📤 Events returned from Supabase:',
      eventsWithCounts.map((ev) => ({
        id: ev.id,
        title: ev.title,
        starts_at: ev.starts_at,
        venue_city: ev.venue?.city,
        is_active: ev.is_active,
        interest_count: ev.interest_count,
      }))
    )
  }

  const response = {
    events: eventsWithCounts,
    meta: {
      count: eventsWithCounts.length,
      city,
      from,
      to,
      active: isActive,
      tags: tags?.split(',') ?? [],
      limit,
      offset,
      fetched_at: new Date().toISOString(),
    },
  }

  return NextResponse.json(response)
}
