// lib/logVenue.ts

'use client'

import { supabaseBrowser, getCurrentUserId } from '@/lib/supabase/client'

type LogVenueImpressionArgs = {
  venue_id: string
  metadata?: Record<string, any>
}

/**
 * Client-side logger for venue_impressions
 */
export async function logVenueImpression(
  impression_type: string,
  { venue_id, metadata = {} }: LogVenueImpressionArgs
) {
  if (!impression_type) {
    console.warn('[logVenueImpression] impression_type is required')
    return
  }

  try {
    const supabase = supabaseBrowser()
    const userId = await getCurrentUserId()

    const payload = {
      impression_type,          // ✅ REQUIRED BY SCHEMA
      user_id: userId ?? null,
      venue_id,
      metadata,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('venue_impressions')
      .insert([payload])        // ✅ MUST be array

    if (error) {
      console.error('[logVenueImpression] insert failed:', error)
    }
  } catch (err) {
    console.error('[logVenueImpression] unexpected error:', err)
  }
}
