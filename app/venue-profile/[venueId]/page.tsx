import { notFound } from 'next/navigation'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import Link from 'next/link'
import FollowButton from '@/components/venue-profile/FollowButton'

type Params = { venueId: string }

export default async function VenueProfilePage({
  params,
}: {
  params: Params
}) {
  // 👇 Destructure via await to satisfy Next.js dynamic API rules
  const { venueId } = await params
  const supabase = await supabaseServerApi()

  // ————— Fetch Venue Info —————
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      description,
      tags,
      contact,
      hours,
      city,
      cover,
      slug
    `)
    .eq('id', venueId)
    .single()

  if (venueError || !venue) {
    notFound()
  }

  // ————— Fetch Live Status —————
  const { data: liveStatus } = await supabase
    .from('venue_live_status')
    .select('is_open_for_dropins, status_tags')
    .eq('venue_id', venueId)
    .single()

  // ————— Fetch One‑Time Events —————
  const { data: events } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, tags')
    .eq('venue_id', venueId)
    .order('starts_at', { ascending: true })

  // ————— Fetch Recurring Events —————
  const { data: recurringEvents } = await supabase
    .from('recurring_events')
    .select(
      'id, title, start_time, end_time, recurrence_rule, starts_on, ends_on'
    )
    .eq('venue_id', venueId)

  const upcomingEvents = [
    ...(events ?? []),
    ...(recurringEvents ?? []).map((rec) => ({
      ...rec,
      isRecurring: true,
    })),
  ]

  const hoursObject =
    venue.hours &&
    typeof venue.hours === 'object' &&
    !Array.isArray(venue.hours)
      ? (venue.hours as Record<string, any>)
      : null

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      {/* ————— Header ————— */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{venue.name}</h1>
        {venue.description && (
          <p className="text-gray-700 dark:text-gray-300">
            {venue.description}
          </p>
        )}
      </div>

      {/* ————— Social / Contact ————— */}
      {Array.isArray(venue.contact) && venue.contact.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Connect with them</h2>
          <div className="flex flex-wrap gap-4">
            {venue.contact.map((url: string) => {
              let label = 'Website'
              const lower = url.toLowerCase()

              if (lower.includes('instagram.com')) {
                label = 'Instagram'
              } else if (lower.includes('tiktok.com')) {
                label = 'TikTok'
              } else if (lower.includes('facebook.com')) {
                label = 'Facebook'
              } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
                label = 'Twitter'
              } else if (lower.includes('linktr.ee')) {
                label = 'Linktree'
              }

              return (
                <Link
                key={url}
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                >
                {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ————— Vibe Tags ————— */}
      {(venue.tags?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Tags &amp; Vibe</h2>
          <div className="flex flex-wrap gap-2">
            {(venue.tags ?? []).map((tag: string) => (
              <span
                key={tag}
                className="bg-gray-200 dark:bg-gray-700 text-sm px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ————— Hours of Operation ————— */}
      {hoursObject && (
        <div>
          <h2 className="text-lg font-semibold">Hours</h2>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            {Object.entries(hoursObject).map(([day, value]) => (
              <li key={day}>
                <span className="capitalize font-medium">{day}:</span>{' '}
                {value?.open && value?.close
                  ? `${value.open} – ${value.close}`
                  : 'Closed'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ————— Live Status ————— */}
      {liveStatus && (
        <div>
          <h2 className="text-lg font-semibold">Current Status</h2>
          <p>
            {liveStatus.is_open_for_dropins ? (
              <span className="text-green-600 font-medium">
                Open for drop‑ins
              </span>
            ) : (
              <span className="text-red-600 font-medium">
                Closed for drop‑ins
              </span>
            )}
          </p>

          {(liveStatus.status_tags?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(liveStatus.status_tags ?? []).map((tag: string) => (
                <span
                  key={tag}
                  className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ————— Events ————— */}
      {upcomingEvents.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <ul className="space-y-4">
            {upcomingEvents.map((ev: any) => (
              <li
                key={ev.id}
                className="border border-gray-300 dark:border-gray-700 rounded p-4"
              >
                <p className="font-medium text-lg">{ev.title}</p>
                {ev.isRecurring ? (
                  <p className="text-sm text-gray-500">
                    Recurs: {ev.recurrence_rule}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {new Date(ev.starts_at).toLocaleDateString()} •{' '}
                    {new Date(ev.starts_at).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    –{' '}
                    {new Date(ev.ends_at).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-gray-500">No upcoming events.</p>
      )}

      {/* ————— Follow Button ————— */}
      <FollowButton venueId={venueId} />
    </div>
  )
}
