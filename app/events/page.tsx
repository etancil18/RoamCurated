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
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
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
      <main className="min-h-screen overflow-hidden bg-black px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute left-[-12%] top-[-12%] h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="absolute right-[-12%] top-[8%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute bottom-[-20%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl space-y-7">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                  Live city calendar
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Upcoming Events
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Discover events, earn XP through check-ins, join social groups, and build outings around what is happening nearby.
                </p>
              </div>

              <button
                onClick={handleRefresh}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 text-sm font-black text-white shadow-lg transition hover:border-cyan-400/40 hover:bg-white/15"
              >
                Refresh Events
              </button>
            </div>

            <div className="mt-7 grid gap-3 lg:grid-cols-[160px_1fr]">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  City
                </label>
                <select
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400/60"
                >
                  {AVAILABLE_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-4 py-2 text-xs font-black capitalize transition ${
                        selectedTags.includes(tag)
                          ? 'border-cyan-300 bg-cyan-400 text-black shadow-lg shadow-cyan-950/30'
                          : 'border-white/10 bg-white/[0.06] text-slate-300 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <input
                type="text"
                placeholder="Search by title, venue, description, or tag..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-black/65"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-400">
              {loading
                ? 'Loading events...'
                : error
                ? 'Failed to load events.'
                : `${filteredEvents.length} events found in ${city.toUpperCase()}`}
            </p>

            {selectedTags.length > 0 && (
              <p className="text-xs text-slate-500">
                Filtering by {selectedTags.join(', ')}
              </p>
            )}
          </div>

          {!loading && !error && filteredEvents.length === 0 && (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center shadow-2xl backdrop-blur-xl">
              <p className="text-4xl">🧭</p>
              <h2 className="mt-4 text-2xl font-black text-white">
                No events found.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Try another city, remove a tag, or refresh the calendar.
              </p>
            </section>
          )}

          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {filteredEvents.map((ev: EventWithTicket) => {
              const isExpanded = expandedEventId === ev.id

              return (
                <article
                  key={ev.id}
                  className="group flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-400/25 hover:bg-white/[0.065]"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <EventXPBadge xpReward={ev.xp_reward ?? 25} />

                      <EventSocialGroupBadge
                        socialGroupId={ev.social_group_id ?? ev.social_group?.id ?? null}
                        socialGroupName={ev.social_group?.name ?? null}
                        socialGroupSlug={ev.social_group?.slug ?? null}
                        logoUrl={ev.social_group?.logo_url ?? null}
                      />
                    </div>

                    <h2 className="text-2xl font-black leading-tight tracking-tight text-white">
                      {ev.title}
                    </h2>

                    {ev.starts_at && (
                      <p className="mt-2 text-sm font-semibold text-cyan-200">
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
                      <Link
                        href={`/venue-profile/${ev.venue.id}`}
                        className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
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
                    )}

                    {ev.description && (
                      <div className="mt-4">
                        <div
                          className={`space-y-3 text-sm leading-6 text-slate-300 transition-all duration-300 ease-in-out ${
                            isExpanded ? '' : 'line-clamp-4'
                          }`}
                        >
                          {ev.description
                            .split(/\n{2,}|\r?\n/)
                            .map((paragraph) => paragraph.trim())
                            .filter(Boolean)
                            .map((paragraph, index) => (
                              <p key={index}>
                                {paragraph}
                              </p>
                            ))}
                        </div>

                        {ev.description.length > 140 && (
                          <button
                            className="mt-2 text-xs font-black text-cyan-300 transition hover:text-cyan-200"
                            onClick={() => toggleExpandedEvent(ev, isExpanded)}
                          >
                            {isExpanded ? 'Show Less' : 'More Info'}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      {ev.price_info && (
                        <p className="text-sm text-slate-300">
                          <span className="font-bold text-slate-100">Price:</span>{' '}
                          {ev.price_info}
                        </p>
                      )}

                      {Array.isArray(ev.tags) && ev.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {ev.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-bold capitalize text-slate-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                          interestedIds.includes(ev.id)
                            ? 'cursor-default bg-slate-700 text-slate-300'
                            : 'bg-emerald-500 text-black hover:bg-emerald-400'
                        }`}
                        onClick={() => markInterested(ev.id)}
                        disabled={interestedIds.includes(ev.id)}
                      >
                        {interestedIds.includes(ev.id)
                          ? 'Interested'
                          : 'I’m Interested'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openPlanner(ev)}
                        className="rounded-xl bg-cyan-500 px-3 py-2.5 text-xs font-black text-black transition hover:bg-cyan-400"
                      >
                        Plan Outing
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ev.checkin_enabled === true && (
                        <div className="[&_button]:inline-flex [&_button]:min-h-[36px] [&_button]:items-center [&_button]:justify-center [&_button]:rounded-xl [&_button]:border [&_button]:border-amber-300/30 [&_button]:bg-amber-400 [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs [&_button]:font-black [&_button]:text-black [&_button]:transition [&_button:hover]:bg-amber-300">
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
                        </div>
                      )}

                      {ev.ticket_link && (
                        <a
                          href={ev.ticket_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleTicketClick(ev)}
                          className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-400"
                        >
                          Tickets / RSVP
                        </a>
                      )}
                    </div>

                    {typeof ev.interest_count === 'number' && ev.interest_count > 0 && (
                      <p className="text-xs text-slate-500">
                        {ev.interest_count} {ev.interest_count === 1 ? 'person is' : 'people are'} interested
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        </div>
      </main>

      <OutingPlannerModal
        open={plannerOpen}
        onClose={closePlanner}
        event={plannerEvent}
      />
    </>
  )
}