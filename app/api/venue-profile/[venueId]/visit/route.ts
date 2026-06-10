import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    venueId: string
  }>
}

function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { visited: false, rating: null },
      { status: 200 }
    )
  }

  const { data, error } = await supabase
    .from('venue_visits')
    .select('id, rating, visited_at, created_at, updated_at')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[venue visit][GET] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to load venue visit status' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    visited: Boolean(data),
    rating: data?.rating ?? null,
    visit: data ?? null,
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { rating } = body

  if (!isValidRating(rating)) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('venue_visits')
    .upsert(
      {
        user_id: user.id,
        venue_id: venueId,
        rating,
        visited_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,venue_id',
      }
    )
    .select('id, rating, visited_at, created_at, updated_at')
    .single()

  if (error) {
    console.error('[venue visit][POST] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to save venue visit' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    visited: true,
    rating: data.rating,
    visit: data,
  })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { rating } = body

  if (!isValidRating(rating)) {
    return NextResponse.json(
      { error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('venue_visits')
    .update({
      rating,
      updated_at: new Date().toISOString(),
    })
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .select('id, rating, visited_at, created_at, updated_at')
    .maybeSingle()

  if (error) {
    console.error('[venue visit][PATCH] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to update venue rating' },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Visit not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    visited: true,
    rating: data.rating,
    visit: data,
  })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('venue_visits')
    .delete()
    .eq('venue_id', venueId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[venue visit][DELETE] Failed:', error)

    return NextResponse.json(
      { error: 'Failed to remove venue visit' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    visited: false,
    rating: null,
  })
}