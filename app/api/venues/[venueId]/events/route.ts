import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'
import type { Json } from '@/types/supabase'

// Explicit event insert contract
export type ValidatedEventsInsert = {
  venue_id: string
  title: string | null
  source: string | null
  permalink: string | null
  starts_at: string | null
  ends_at: string | null
  description: string | null
  tags: string[] | null
  price_info: string | null
  source_type: string | null
  raw_payload: Json | null
  timezone: string | null
  is_active: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export async function POST(
  req: Request,
  { params }: { params: { venueId: string } }
) {
  const supabase = await createServerClient()
  const { venueId } = params
  const body = await req.json()

  const validated: ValidatedEventsInsert = {
    venue_id: venueId,
    title: body.title ?? null,
    source: body.source ?? 'portal',
    permalink: body.permalink ?? null,
    starts_at: body.starts_at ?? body.startsAt ?? null,
    ends_at: body.ends_at ?? body.endsAt ?? null,
    description: body.description ?? null,
    tags: body.tags ?? null,
    price_info: body.price_info ?? body.priceInfo ?? null,
    source_type: body.source_type ?? body.sourceType ?? 'portal',
    raw_payload: body.raw_payload ?? body.rawPayload ?? null,
    timezone: body.timezone ?? 'America/New_York',
    is_active: body.is_active ?? true,
    created_at: null,
    updated_at: null
  }

  const payload = validated as Database['public']['Tables']['events']['Insert']

  // 👇 Force TS to use the correct types and avoid "never"
  const { data, error } = await supabase
  // 👇 bypasses type system with any, only temporarily
  .from('events')
  .insert(payload as any)
  .select(`
    id,
    venue_id,
    title,
    description,
    starts_at,
    ends_at,
    tags,
    price_info,
    source_type,
    source,
    permalink,
    is_active,
    timezone,
    created_at,
    updated_at,
    venue:venues (
      id,
      name,
      slug,
      lat,
      lon,
      city
    )
  `)
  .single()



  if (error) {
    console.error('❌ Failed to insert event:', error)
    return NextResponse.json(
      { error: 'Failed to create event', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ event: data }, { status: 201 })
}
