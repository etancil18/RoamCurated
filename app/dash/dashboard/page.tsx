import { createServerClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import DashboardMetrics from '@/components/dash/DashboardMetrics'

export default async function DashDashboardPage() {
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

  // Live Status
  const { data: liveStatus } = await supabase
    .from('venue_live_status')
    .select('is_open_for_dropins, status_tags, updated_at')
    .eq('venue_id', venueId)
    .single()

  // Upcoming RSVPs (Today and future only)
  const nowISO = new Date().toISOString()

  const { data: rsvps } = await supabase
    .from('venue_rsvps_view')
    .select('crawl_rsvp_id, note, joined_at, datetime')
    .eq('venue_id', venueId)
    .gte('datetime', nowISO)
    .order('datetime', { ascending: true })
    .limit(10)

  return (
    <div className="space-y-8">
      {/* Live Status */}
      <section>
        <h1 className="text-2xl font-bold mb-2">Live Status</h1>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p>
            <span className="font-semibold">Open for Drop‑Ins:</span>{' '}
            <span className={liveStatus?.is_open_for_dropins ? 'text-green-500' : 'text-red-500'}>
              {liveStatus?.is_open_for_dropins ? 'Yes' : 'No'}
            </span>
          </p>
          {(liveStatus?.status_tags ?? []).length > 0 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Tags:</span>{' '}
              {(liveStatus?.status_tags ?? []).join(', ')}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Last updated: {format(new Date(liveStatus?.updated_at ?? Date.now()), 'PPpp')}
          </p>
        </div>
      </section>

      {/* Metrics (Client‑Rendered with Filters) */}
      <DashboardMetrics venueId={venueId} />

      {/* Upcoming Crawl RSVPs */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Upcoming Crawl RSVPs</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          {rsvps && rsvps.length > 0 ? (
            <ul className="space-y-4">
              {rsvps.map((rsvp) => (
                <li key={rsvp.crawl_rsvp_id} className="text-sm">
                  <p>
                    <span className="font-semibold">Arrival Time:</span>{' '}
                    {rsvp.datetime ? format(new Date(rsvp.datetime), 'PPPp') : 'Unknown'}
                  </p>
                  {rsvp.note && (
                    <p className="italic text-gray-500 mt-1">“{rsvp.note}”</p>
                  )}
                  {rsvp.joined_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      RSVP’d: {format(new Date(rsvp.joined_at), 'PPPp')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No upcoming RSVPs.</p>
          )}
        </div>
      </section>
    </div>
  )
}
