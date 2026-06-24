"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useEvents } from '@/hooks/useEvents'
import OutingPlannerModal from '@/components/events/OutingPlannerModal'
import EventCheckInButton from '@/components/events/EventCheckInButton'
import EventXPBadge from '@/components/events/EventXPBadge'
import EventSocialGroupBadge from '@/components/events/EventSocialGroupBadge'
import { logEvent } from '@/lib/logEvent'

type EventWithTicket = ReturnType<typeof useEvents>['events'][number] & {
  ticket_link?: string | null
  social_group_id?: string | null
  xp_reward?: number | null
  checkin_enabled?: boolean | null
  social_group?: {
    id?: string | null
    name?: string | null
    slug?: string | null
    logo_url?: string | null
  } | null
}

const AVAILABLE_CITIES = [
  'atl',
  'nyc',
  'lisbon',
  'porto',
  'london',
  'la',
]

const AVAILABLE_TAGS = ['music', 'rooftop', 'gallery', 'food', 'comedy']

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function EventsPage() {
  const [city, setCity] = useState('atl')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [interestedIds, setInterestedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [plannerEvent, setPlannerEvent] = useState<EventWithTicket | null>(null)

  useEffect(() => {
    safeLogEvent('events_page_viewed', { city })
  }, [])

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
    city as 'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la',
    7,
    selectedTags,
    true,
    30
  )

  const toggleTag = (tag: string) => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]

    setSelectedTags(nextTags)

    safeLogEvent('events_filter_tag_toggled', {
      city,
      tag,
      selected: nextTags.includes(tag),
      selected_tags: nextTags,
    })
  }

  const handleCityChange = (nextCity: string) => {
    setCity(nextCity)

    safeLogEvent('events_city_selected', {
      previous_city: city,
      city: nextCity,
    })
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    if (value.trim().length >= 2) {
      safeLogEvent('events_search_updated', {
        city,
        query_length: value.trim().length,
      })
    }
  }

  const handleRefresh = () => {
    safeLogEvent('events_refreshed', {
      city,
      selected_tags: selectedTags,
      search_active: debouncedSearch.trim().length > 0,
    })

    refetch()
  }

  const toggleExpandedEvent = (ev: EventWithTicket, isExpanded: boolean) => {
    const nextExpandedId = isExpanded ? null : ev.id
    setExpandedEventId(nextExpandedId)

    safeLogEvent(isExpanded ? 'event_details_collapsed' : 'event_details_expanded', {
      event_id: ev.id,
      event_title: ev.title ?? null,
      city,
      venue_id: ev.venue?.id ?? null,
      venue_name: ev.venue?.name ?? null,
    })
  }

  const markInterested = async (eventId: string) => {
    if (interestedIds.includes(eventId)) return

    safeLogEvent('event_interest_clicked', {
      event_id: eventId,
      city,
    })

    try {
      const res = await fetch(`/api/events/${eventId}/interest`, {
        method: 'POST',
      })

      if (res.ok) {
        setInterestedIds((prev) => [...prev, eventId])

        safeLogEvent('event_interest_saved', {
          event_id: eventId,
          city,
        })
      } else {
        const err = await res.json()
        console.error('Error marking interest:', err)

        safeLogEvent('event_interest_failed', {
          event_id: eventId,
          city,
          status: res.status,
          error: err,
        })
      }
    } catch (err) {
      console.error('Error marking interest:', err)

      safeLogEvent('event_interest_error', {
        event_id: eventId,
        city,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const openPlanner = (event: EventWithTicket) => {
    safeLogEvent('outing_planner_open_clicked', {
      event_id: event.id,
      event_title: event.title ?? null,
      city,
      venue_id: event.venue?.id ?? null,
      venue_name: event.venue?.name ?? null,
      starts_at: event.starts_at ?? null,
      tags: event.tags ?? [],
    })

    setPlannerEvent(event)
    setPlannerOpen(true)
  }

  const closePlanner = () => {
    safeLogEvent('outing_planner_closed', {
      event_id: plannerEvent?.id ?? null,
      city,
    })

    setPlannerOpen(false)
    setPlannerEvent(null)
  }

  const handleTicketClick = (ev: EventWithTicket) => {
    safeLogEvent('event_ticket_click', {
      event_id: ev.id,
      event_title: ev.title ?? null,
      city,
      venue_id: ev.venue?.id ?? null,
      venue_name: ev.venue?.name ?? null,
      ticket_link: ev.ticket_link ?? null,
    })
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

  useEffect(() => {
    if (loading || error) return

    safeLogEvent('events_results_loaded', {
      city,
      selected_tags: selectedTags,
      search_active: debouncedSearch.trim().length > 0,
      result_count: filteredEvents.length,
    })
  }, [loading, error, city, selectedTags, debouncedSearch, filteredEvents.length])

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🗓️ Upcoming Events</h1>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div>
            <label className="text-sm font-medium mr-2">City:</label>
            <select
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
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
            onClick={handleRefresh}
            className="ml-auto text-sm px-3 py-1 bg-blue-600 text-white rounded"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="w-full mt-4 mb-6">
          <input
            type="text"
            placeholder="Search by title, venue, description, or tag..."
            className="w-full border bg-neutral-900 text-white p-2 rounded"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {filteredEvents.map((ev: EventWithTicket) => {
            const isExpanded = expandedEventId === ev.id

            return (
              <div
                key={ev.id}
                className="border rounded-lg p-5 bg-neutral-900 text-neutral-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <EventXPBadge xpReward={ev.xp_reward ?? 25} />

                    <EventSocialGroupBadge
                      socialGroupId={ev.social_group_id ?? ev.social_group?.id ?? null}
                      socialGroupName={ev.social_group?.name ?? null}
                      socialGroupSlug={ev.social_group?.slug ?? null}
                      logoUrl={ev.social_group?.logo_url ?? null}
                    />
                  </div>

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
                    <>
                      <p
                        className={`text-sm text-neutral-200 mb-3 whitespace-pre-wrap transition-all duration-300 ease-in-out ${
                          isExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        {ev.description}
                      </p>
                      {ev.description.length > 140 && (
                        <button
                          className="text-cyan-400 text-sm hover:underline"
                          onClick={() => toggleExpandedEvent(ev, isExpanded)}
                        >
                          {isExpanded ? 'Show Less' : 'More Info'}
                        </button>
                      )}
                    </>
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
                      <Link
                        href={`/venue-profile/${ev.venue.id}`}
                        className="text-cyan-400 hover:underline font-medium"
                        onClick={() =>
                          safeLogEvent('event_venue_click', {
                            event_id: ev.id,
                            event_title: ev.title ?? null,
                            city,
                            venue_id: ev.venue?.id ?? null,
                            venue_name: ev.venue?.name ?? null,
                          })
                        }
                      >
                        📍 {ev.venue.name}
                      </Link>
                    </div>
                  )}
                </div>

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
                    {interestedIds.includes(ev.id)
                      ? '⭐ Interested'
                      : '⭐ I\'m Interested'}
                  </button>

                  {ev.checkin_enabled === true && (
                    <EventCheckInButton
                      eventId={ev.id}
                      xpReward={ev.xp_reward ?? 25}
                      socialGroupId={ev.social_group_id ?? null}
                      onCheckedIn={({ xpAwarded, alreadyCheckedIn, socialGroupId }) => {
                        safeLogEvent('event_checked_in_from_events_page', {
                          event_id: ev.id,
                          city,
                          xp_awarded: xpAwarded,
                          already_checked_in: alreadyCheckedIn,
                          social_group_id: socialGroupId,
                        })
                      }}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => openPlanner(ev)}
                    className="text-sm px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium"
                  >
                    🗺️ Plan Outing
                  </button>

                  {ev.ticket_link && (
                    <a
                      href={ev.ticket_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleTicketClick(ev)}
                      className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                    >
                      🎟️ Tickets/RSVP
                    </a>
                  )}

                  {typeof ev.interest_count === 'number' && ev.interest_count > 0 && (
                    <p className="text-sm text-neutral-400">
                      {ev.interest_count} {ev.interest_count === 1 ? 'person is' : 'people are'} interested
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <OutingPlannerModal
        open={plannerOpen}
        onClose={closePlanner}
        event={plannerEvent}
      />
    </>
  )
}