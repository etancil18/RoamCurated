'use server'

import { createServerClient } from '@/lib/supabase/server'
import { removeFavorite } from '@/lib/supabase/favorites'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// --- UUID Type & Validator ---
type UUID = string & { __uuidBrand: never }

function validateUUID(uuid: string): uuid is UUID {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)
}

// --- Server Action: Remove Favorite Venue ---
export async function removeFavoriteAction(venueId: string): Promise<void> {
  const supabase = await createServerClient() as SupabaseClient<Database>

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('❌ Not authenticated')
    throw new Error('Not authenticated')
  }

  if (!validateUUID(venueId)) {
    console.error('❌ Invalid venue ID format:', venueId)
    throw new Error('Invalid venue ID format')
  }

  try {
    await removeFavorite({
      userId: user.id as UUID,
      venueId,
    })

    // ✅ Refresh favorites page after removal
    revalidatePath('/favorites')
  } catch (err) {
    console.error('❌ Failed to remove favorite:', err)
    throw new Error('Failed to remove favorite')
  }
}

// --- Server Action: Remove Saved Crawl (Route) ---
export async function removeSavedRouteAction(routeId: string): Promise<void> {
  const supabase = await createServerClient() as SupabaseClient<Database>

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('❌ Not authenticated')
    throw new Error('Not authenticated')
  }

  if (!validateUUID(routeId)) {
    console.error('❌ Invalid route ID format:', routeId)
    throw new Error('Invalid route ID format')
  }

  try {
    const { error } = await supabase
      .from('saved_routes')
      .delete()
      .eq('id', routeId as string)
      .eq('user_id', user.id as string)

    if (error) {
      console.error('[removeSavedRouteAction] Supabase error:', error)
      throw new Error('Failed to delete saved route')
    }

    // ✅ Refresh favorites page after deletion
    revalidatePath('/favorites')
  } catch (err) {
    console.error('❌ Failed to remove saved crawl:', err)
    throw new Error('Failed to remove saved crawl')
  }
}
