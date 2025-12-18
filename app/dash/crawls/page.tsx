// app/dash/crawls/page.tsx

import { createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'
import { format } from 'date-fns'

export default async function DashCrawlsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const { data: venueUser } = await supabase
    .from('venue_users')
    .select('venue_id')
    .eq('email', user.email)
    .single()

  if (!venueUser) return null

  const venueId = venueUser.venue_id

  const { data: rsvps } = await supabase
    .from('venue_rsvps_view')
    .select(`
      crawl_rsvp_id,
      user_id,
      crawl_id,
      instagram_handle,
      note,
      joined_at,
      datetime,
      vibe_tags
    `)
    .eq('venue_id', venueId)
    .order('datetime', { ascending: true })
    .limit(20)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Upcoming Crawl RSVPs</h1>

      <div className="space-y-4">
        {rsvps && rsvps.length > 0 ? (
          rsvps.map((rsvp) => (
            <div
              key={rsvp.crawl_rsvp_id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  <p>
                    <span className="font-semibold">Arrival Time:</span>{' '}
                    {rsvp.datetime
                      ? format(new Date(rsvp.datetime), 'PPpp')
                      : 'Unknown'}
                  </p>
                </div>

                {rsvp.joined_at && (
                  <p className="text-xs text-gray-400">
                    RSVP’d: {format(new Date(rsvp.joined_at), 'PPpp')}
                  </p>
                )}
              </div>

              {rsvp.note && (
                <p className="mt-3 text-sm italic text-gray-500 dark:text-gray-400">
                  “{rsvp.note}”
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No crawl RSVPs yet. This list updates automatically when guests add your venue to their route.
          </p>
        )}
      </div>
    </div>
  )
}
