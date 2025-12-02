'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useEvents } from '@/hooks/useEvents'

const AVAILABLE_CITIES = ['atl', 'nyc']
const AVAILABLE_TAGS = ['music', 'rooftop', 'gallery', 'food', 'comedy']

export default function EventsPage() {
  const [city, setCity] = useState('atl')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('roam-city')
    if (saved && AVAILABLE_CITIES.includes(saved.toLowerCase())) {
      setCity(saved.toLowerCase())
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('roam-city', city)
  }, [city])

  const { events, loading, error, refetch } = useEvents(
    city as 'atl' | 'nyc',
    7,
    selectedTags,
    true,
    30
  )

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🗓️ Upcoming Events</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <label className="text-sm font-medium mr-2">City:</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="border rounded p-2 bg-neutral-900 text-white"
          >
            {AVAILABLE_CITIES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium mr-1">Tags:</label>
          {AVAILABLE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-1 rounded border text-sm ${
                selectedTags.includes(tag)
                  ? 'bg-cyan-500 text-white'
                  : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <button
          onClick={refetch}
          className="ml-auto text-sm px-3 py-1 bg-blue-600 text-white rounded"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="mb-4 text-sm text-neutral-400">
        {loading
          ? 'Loading events...'
          : error
          ? 'Failed to load events.'
          : `${events.length} events found in ${city.toUpperCase()}`}
      </div>

      {!loading && !error && events.length === 0 && (
        <div className="text-center text-neutral-500 mt-10">
          😕 No upcoming events found for your filters.
        </div>
      )}

      <div className="space-y-4">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="border rounded-lg p-4 bg-neutral-900 text-neutral-100"
          >
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

            <div className="mt-3">
              <button className="text-sm bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded text-white">
                ➕ Add to Crawl
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
