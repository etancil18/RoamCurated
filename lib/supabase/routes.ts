// lib/supabase/routes.ts

import { createServerClient } from './server'
import type { Database, Json, SavedRouteInsert, SavedRouteRecord } from '@/types/supabase'

// UUID enforcement
type UUID = string & { __uuidBrand: never }

export async function saveRoute({
  userId,
  name,
  stops,
  city,
  sourceUrl,
  slug,
}: {
  userId: UUID
  name: string
  stops: Json
  city?: string
  sourceUrl?: string
  slug: string
}) {
  const supabase = await createServerClient() as unknown as import('@supabase/supabase-js').SupabaseClient<Database>

  const payload: SavedRouteInsert = {
    user_id: userId,
    name,
    stops,
    city: city ?? null,
    source_url: sourceUrl ?? null,
    slug,
  }

  const { error } = await supabase.from('saved_routes').insert([payload])

  if (error) {
    console.error('[saveRoute] Supabase insert error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw new Error(`Failed to save route: ${error.message}`)
  }

  return { success: true, slug }
}

export async function getSavedRoutes(userId: UUID): Promise<SavedRouteRecord[]> {
  const supabase = await createServerClient() as unknown as import('@supabase/supabase-js').SupabaseClient<Database>

  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, stops, city, slug, created_at, source_url, user_id')
    .eq('user_id', userId)

  if (error) {
    console.error('[getSavedRoutes] Supabase fetch error:', {
      message: error.message,
      details: error.details,
    })
    throw new Error('Failed to fetch saved routes')
  }

  const filtered = (data ?? []).filter((r) => typeof r.slug === 'string' && r.slug.length > 0)

  return filtered as SavedRouteRecord[]
}

export async function getRouteBySlug(slug: string): Promise<SavedRouteRecord> {
  const supabase = await createServerClient() as unknown as import('@supabase/supabase-js').SupabaseClient<Database>

  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, stops, city, slug, created_at, source_url, user_id')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.error('[getRouteBySlug] Error:', error?.message)
    throw new Error('Route not found')
  }

  return data as SavedRouteRecord
}
