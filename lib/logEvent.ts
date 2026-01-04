'use client'

import { supabaseBrowser, getCurrentUserId } from '@/lib/supabase/client'

type LogEventArgs = {
  venue_id?: string
  crawl_id?: string
  impression_type?: string
  metadata?: Record<string, any>
}

/**
 * Client-side logger for user_impressions
 */
export async function logEvent(
  impression_type: string,
  { venue_id, crawl_id, metadata = {} }: LogEventArgs = {}
) {
  if (!impression_type) {
    console.warn('[logEvent] impression_type is required.')
    return
  }

  try {
    const supabase = supabaseBrowser()
    const userId = await getCurrentUserId()

    const payload = {
      impression_type,
      user_id: userId ?? null,
      venue_id: venue_id ?? null,
      crawl_id: crawl_id ?? null,
      metadata,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('user_impressions')
      .insert([payload], { returning: 'minimal' } as any) // ✅ Cast to `any`

    if (error) {
      console.error('[logEvent] insert failed:', error)
    }
  } catch (err) {
    console.error('[logEvent] unexpected error:', err)
  }
}
