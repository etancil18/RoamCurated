// supabase/functions/mark-no-shows/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('ROAM_SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or ROAM_SUPABASE_SERVICE_ROLE_KEY')
  throw new Error('Missing required environment variables')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

Deno.serve(async () => {
  try {
    // 1 hour ago cutoff
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Find RSVPs that should be marked as no-show
    const { data: rsvps, error } = await supabase
      .from('crawl_rsvps')
      .select('id')
      .eq('status', 'Confirmed')
      .is('checked_in_at', null)
      .lt('datetime', oneHourAgo)

    if (error) {
      console.error('Fetch error:', error)
      return new Response('Failed to fetch RSVPs', { status: 500 })
    }

    if (!rsvps || rsvps.length === 0) {
      return new Response('No RSVPs to mark', { status: 200 })
    }

    const ids = rsvps.map((r: { id: string }) => r.id)

    // Update all matching RSVPs in one query
    const { error: updateError } = await supabase
      .from('crawl_rsvps')
      .update({ status: 'Did Not Attend' })
      .in('id', ids)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response('Failed to update RSVPs', { status: 500 })
    }

    return new Response(
      `Marked ${ids.length} RSVP(s) as Did Not Attend`,
      { status: 200 }
    )
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response('Unhandled error', { status: 500 })
  }
})