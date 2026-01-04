import { createServerClient } from '@/lib/supabase/server'

type LogEventServerArgs = {
  impression_type: string // ✅ REQUIRED
  user_id?: string | null
  venue_id?: string
  crawl_id?: string
  metadata?: Record<string, any>
}

/**
 * Server-side logger for user_impressions (SSR-safe)
 */
export async function logEventServer({
  impression_type,
  user_id = null,
  venue_id,
  crawl_id,
  metadata = {},
}: LogEventServerArgs) {
  if (!impression_type) {
    console.warn('[logEventServer] impression_type is required')
    return
  }

  try {
    const supabase = await createServerClient()

    const payload = {
      impression_type,
      user_id,
      venue_id: venue_id ?? null,
      crawl_id: crawl_id ?? null,
      metadata,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('user_impressions')
      .insert([payload], { returning: 'minimal' } as any) // ✅ Cast to `any`

    if (error) {
      console.error('[logEventServer] insert failed:', error)
    }
  } catch (err) {
    console.error('[logEventServer] unexpected error:', err)
  }
}
