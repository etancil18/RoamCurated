// app/api/events/route.ts

import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import type { Database } from '@/types/supabase'

type EventRow = Database['public']['Tables']['events']['Row']

export async function GET(req: Request) {
  const supabase = await supabaseServerApi()

  const url = new URL(req.url)
  const city = url.searchParams.get('city')        // "atl" | "nyc" | null
  const from = url.searchParams.get('from')        // ISO string or null
  const to = url.searchParams.get('to')            // ISO string or null
  const tags = url.searchParams.get('tags')        // e.g. "music,art"
  const onlyActive = url.searchParams.get('active') // "true" | "false"

  // Base query with venue join
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
      venue:venues (
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

  // Only active events (default)
  if (onlyActive !== 'false') {
    query = query.eq('is_active', true)
  }

  // Time range filtering
  if (from) query = query.gte('starts_at', from)
  if (to) query = query.lte('starts_at', to)

  // City filtering (if venue.city exists)
  if (city) {
    query = query.eq('venue.city', city)
  }

  // Tag filtering (array overlap)
  if (tags) {
    const list = tags.split(',').map((t) => t.trim())
    query = query.overlaps('tags', list)
  }

  const { data, error } = await query

  if (error) {
    console.error('❌ Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ events: data })
}
