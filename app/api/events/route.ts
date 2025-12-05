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

  // Log incoming params
  console.log('📥 Incoming /api/events params:', {
    city,
    from,
    to,
    tags,
    onlyActive,
    limit,
  })

  // Log warning if essential filters are missing
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
      venue:venues!events_venue_id_fkey (
        id,
        name,
        slug,
        lat,
        lon,
        city,
        cover
      )
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

  query = query.order('starts_at', { ascending: true }).limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('❌ Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error.message },
      { status: 500 }
    )
  }

  // Log returned data key fields
  console.log(
    '📤 Events returned from Supabase:',
    data?.map((ev) => ({
      id: ev.id,
      title: ev.title,
      starts_at: ev.starts_at,
      venue_city: ev.venue?.city,
      is_active: ev.is_active,
    })) ?? []
  )

  const response = {
    events: data,
    meta: {
      count: data?.length ?? 0,
      city,
      from,
      to,
      active: isActive,
      tags: tags?.split(',') ?? [],
      limit,
      fetched_at: new Date().toISOString(),
    },
  }

  console.log(`✅ Returned ${response.meta.count} events for city: ${city}`)

  return NextResponse.json(response)
}
