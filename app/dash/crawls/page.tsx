// app/dash/crawls/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import InteractiveRSVPCard from '@/components/dash/InteractiveRSVPCard'

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

  const { data: rsvps } = await supabase
    .from('venue_rsvps_view')
    .select(`
      crawl_rsvp_id,
      user_id,
      crawl_id,
      instagram_handle,
      profile_name,
      note,
      joined_at,
      datetime,
      vibe_tags,
      status,
      checked_in_at,
      crawl_name
    `)
    .eq('venue_id', venueUser.venue_id)
    .order('datetime', { ascending: true })

  if (!rsvps) return null

  const validRsvps = rsvps.filter((r) => !!r.crawl_rsvp_id)

  const stats = {
    confirmed: validRsvps.filter((r) => r.status === 'Confirmed').length,
    checkedIn: validRsvps.filter((r) => r.status === 'Checked In').length,
    noShow: validRsvps.filter((r) => r.status === 'Did Not Attend').length,
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Upcoming RSVPs</h1>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          Confirmed: {stats.confirmed} | Checked In: {stats.checkedIn} | No Show: {stats.noShow}
        </p>
      </div>

      {validRsvps.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No upcoming RSVPs at this time.
        </p>
      ) : (
        validRsvps.map((rsvp) => (
          <InteractiveRSVPCard
            key={rsvp.crawl_rsvp_id!}
            rsvp={rsvp as any} // Safe due to field filtering
          />
        ))
      )}
    </div>
  )
}
