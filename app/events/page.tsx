'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useEvents } from '@/hooks/useEvents'

const AVAILABLE_CITIES = ['atl', 'nyc']
const AVAILABLE_TAGS = ['music', 'rooftop', 'gallery', 'food', 'comedy']

export default function EventsPage() {
  const [city, setCity] = useState('atl')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [interestedIds, setInterestedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

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

  const markInterested = async (eventId: string) => {
    if (interestedIds.includes(eventId)) return
    try {
      const res = await fetch(`/api/events/${eventId}/interest`, {
        method: 'POST',
      })
      if (res.ok) {
        setInterestedIds((prev) => [...prev, eventId])
      } else {
        const err = await res.json()
        console.error('Error marking interest:', err)
      }
    } catch (err) {
      console.error('Error marking interest:', err)
    }
  }

  const filteredEvents = events.filter((ev) => {
    const query = debouncedSearch.toLowerCase()
    return (
      ev.title?.toLowerCase().includes(query) ||
      ev.venue?.name?.toLowerCase().includes(query) ||
      ev.description?.toLowerCase().includes(query) ||
      (Array.isArray(ev.tags) && ev.tags.some((tag) => tag.toLowerCase().includes(query)))
    )
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🗓️ Upcoming Events</h1>

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

        <div className="flex flex-wrap items-center gap-2">
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

      <div className="w-full mt-4 mb-6">
        <input
          type="text"
          placeholder="Search by title, venue, description, or tag..."
          className="w-full border bg-white-900 text-black p-2 rounded"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="mb-4 text-sm text-neutral-400">
        {loading
          ? 'Loading events...'
          : error
          ? 'Failed to load events.'
          : `${filteredEvents.length} events found in ${city.toUpperCase()}`}
      </div>

      {!loading && !error && filteredEvents.length === 0 && (
        <div className="text-center text-neutral-500 mt-10">
          😕 No upcoming events found for your filters.
        </div>
      )}

      <div className="space-y-6">
        {filteredEvents.map((ev) => (
          <div
            key={ev.id}
            className="border rounded-lg p-5 bg-neutral-900 text-neutral-100 shadow-sm"
          >
            <h2 className="text-2xl font-semibold mb-1">{ev.title}</h2>

            {ev.starts_at && (
              <p className="text-sm text-neutral-400 mb-2">
                {new Date(ev.starts_at).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}

            {ev.description && (
              <p className="text-sm text-neutral-200 mb-3 whitespace-pre-wrap">
                {ev.description}
              </p>
            )}

            <div className="text-sm text-neutral-300 mb-2">
              {ev.price_info && <p><strong>Price:</strong> {ev.price_info}</p>}
              {Array.isArray(ev.tags) && ev.tags.length > 0 && (
                <p className="text-sm mt-2 text-neutral-400">
                  <strong>Tags:</strong> {ev.tags.join(', ')}
                </p>
              )}
            </div>

            {ev.venue && (
              <div className="flex items-center justify-between text-sm mt-4">
                <span className="opacity-80">
                  📍 {ev.venue.name}
                </span>
                {ev.venue.link && (
                  <Link
                    href={ev.venue.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-medium"
                  >
                    More Info ↗
                  </Link>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
              <button
                className={`text-sm px-4 py-2 rounded font-medium text-white ${
                  interestedIds.includes(ev.id)
                    ? 'bg-gray-500 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                onClick={() => markInterested(ev.id)}
                disabled={interestedIds.includes(ev.id)}
              >
                {interestedIds.includes(ev.id) ? '⭐ Interested' : '⭐ I\'m Interested'}
              </button>

              {typeof ev.interest_count === 'number' && ev.interest_count > 0 && (
                <p className="text-sm text-neutral-400">
                  {ev.interest_count} {ev.interest_count === 1 ? 'person is' : 'people are'} interested
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
