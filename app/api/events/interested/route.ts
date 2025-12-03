// app/api/events/interested/route.ts

import { supabaseServerApi } from '@/lib/supabase/server-api'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await supabaseServerApi()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.warn('🚫 /interested: no user logged in')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 1: Get list of event_ids the user marked interest in
  const { data: interestData, error: interestError } = await supabase
    .from('event_interests')
    .select('event_id')
    .eq('user_id', user.id)

  if (interestError) {
    console.error('❌ Error fetching interested event IDs:', interestError)
    return NextResponse.json({ error: 'Failed to fetch interested events' }, { status: 500 })
  }

  const eventIds = interestData
    .map((entry) => entry.event_id)
    .filter((id): id is string => typeof id === 'string' && !!id)

  console.log('👉 event_interests for user', user.id, '→', eventIds)

  if (eventIds.length === 0) {
    return NextResponse.json({ events: [] })
  }

  // Step 2: Fetch full event details with venue info
  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select(`
      id,
      title,
      starts_at,
      ends_at,
      tags,
      price_info,
      venue:venues (
        id,
        name,
        slug,
        lat,
        lon,
        city,
        cover
      )
    `)
    .in('id', eventIds)

  if (eventsError) {
    console.error('❌ Error fetching full event data:', eventsError)
    return NextResponse.json({ error: 'Failed to fetch event details' }, { status: 500 })
  }

  console.log('✅ eventsData returned for interested events:', eventsData)

  // Return events — even if venue is null, so front‑end can inspect
  return NextResponse.json({ events: eventsData ?? [] })
}
