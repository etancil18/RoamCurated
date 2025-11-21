// app/events/page.tsx

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Minimal event type
type EventRecord = {
  id: string
  title: string | null
  starts_at: string | null
  ends_at: string | null
  venue: {
    id: string
    name: string | null
    lat: number | null
    lon: number | null
    slug: string | null
    city: string | null
  } | null
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const now = new Date()
      const to = new Date()
      to.setDate(to.getDate() + 7)

      const params = new URLSearchParams({
        from: now.toISOString(),
        to: to.toISOString(),
      })

      const res = await fetch(`/api/events?${params.toString()}`)
      const json = await res.json()
      setEvents(json.events || [])
      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upcoming Events (Next 7 Days)</h1>

      {loading && <p>Loading events...</p>}

      {!loading && events.length === 0 && (
        <p>No upcoming events found.</p>
      )}

      <div className="space-y-4 mt-4">
        {events.map((ev) => (
          <div key={ev.id} className="border rounded-lg p-4 bg-neutral-900 text-neutral-100">
            <h2 className="text-xl font-semibold">{ev.title}</h2>

            {ev.starts_at && (
              <p className="text-sm mt-1">
                {new Date(ev.starts_at).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}

            {ev.venue && (
              <div className="mt-2">
                <p className="text-sm opacity-80">At: {ev.venue.name}</p>
                <Link
                  href={`/map?focus=${ev.venue.slug}`}
                  className="text-cyan-400 hover:underline text-sm"
                >
                  View on Map
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
