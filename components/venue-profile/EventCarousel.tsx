'use client'

import { useEffect, useRef, useState } from 'react'
import { VenueEvent } from '@/types/venue-profile'
import { logEvent } from '@/lib/logEvent'

type Props = {
  events: VenueEvent[]
  interestedEventIds?: string[]
  onToggleInterested?: (event: VenueEvent) => Promise<void> | void
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function EventCarousel({
  events,
  interestedEventIds = [],
  onToggleInterested,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [localInterestedIds, setLocalInterestedIds] = useState<string[]>(interestedEventIds)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0
    }
  }, [])

  useEffect(() => {
    setLocalInterestedIds(interestedEventIds)
  }, [interestedEventIds])

  if (!events || events.length === 0) return null

  const now = Date.now()

  const upcoming = events.filter((ev) => {
    if (ev.isRecurring) return true
    if (ev.ends_at) {
      const endTs = new Date(ev.ends_at).getTime()
      return endTs >= now
    }
    return false
  })

  if (upcoming.length === 0) return null

  const handleToggleInterested = async (event: VenueEvent) => {
    if (event.isRecurring) return

    const isInterested = localInterestedIds.includes(event.id)
    const method = isInterested ? 'DELETE' : 'POST'

    safeLogEvent('venue_event_interest_clicked', {
      event_id: event.id,
      event_title: event.title ?? null,
      action: isInterested ? 'remove_interest' : 'add_interest',
      is_recurring: false,
    })

    const res = await fetch(`/api/events/${event.id}/interest`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const json = await res.json().catch(() => null)

      safeLogEvent('venue_event_interest_failed', {
        event_id: event.id,
        event_title: event.title ?? null,
        action: isInterested ? 'remove_interest' : 'add_interest',
        status: res.status,
        error: json,
      })

      throw new Error(json?.error || 'Failed to update interest')
    }

    setLocalInterestedIds((prev) =>
      isInterested ? prev.filter((id) => id !== event.id) : [...prev, event.id]
    )

    safeLogEvent('venue_event_interest_updated', {
      event_id: event.id,
      event_title: event.title ?? null,
      action: isInterested ? 'remove_interest' : 'add_interest',
    })

    if (onToggleInterested) {
      await onToggleInterested(event)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
        Upcoming Events
      </h2>

      <div
        ref={scrollRef}
        className="flex space-x-4 overflow-x-auto md:hidden pb-2 -mx-1 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700"
      >
        {upcoming.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            isInterested={localInterestedIds.includes(ev.id)}
            onToggleInterested={handleToggleInterested}
          />
        ))}
      </div>

      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {upcoming.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            isInterested={localInterestedIds.includes(ev.id)}
            onToggleInterested={handleToggleInterested}
          />
        ))}
      </div>
    </div>
  )
}

function EventCard({
  event,
  isInterested,
  onToggleInterested,
}: {
  event: VenueEvent
  isInterested: boolean
  onToggleInterested?: (event: VenueEvent) => Promise<void> | void
}) {
  const {
    title,
    description,
    isRecurring,
    recurrence_rule,
    starts_at,
    ends_at,
    start_time,
    ticket_link,
  } = event as VenueEvent & {
    description?: string | null
    ticket_link?: string | null
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMoreInfo, setShowMoreInfo] = useState(false)

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

  const formatRecurring = () => {
    if (!recurrence_rule) return 'Recurring'

    const parts = recurrence_rule.split(';')
    const freq = parts.find((p) => p.startsWith('FREQ='))?.split('=')[1]
    const byDay = parts.find((p) => p.startsWith('BYDAY='))?.split('=')[1]

    const dayMap: Record<string, string> = {
      MO: 'Monday',
      TU: 'Tuesday',
      WE: 'Wednesday',
      TH: 'Thursday',
      FR: 'Friday',
      SA: 'Saturday',
      SU: 'Sunday',
    }

    const friendlyDay = byDay
      ? byDay.split(',').map((d) => dayMap[d] || d).join(', ')
      : ''

    const freqText =
      freq === 'DAILY'
        ? 'Every day'
        : freq === 'WEEKLY' && friendlyDay
        ? `Every ${friendlyDay}`
        : freq === 'MONTHLY'
        ? 'Every month'
        : 'Recurring'

    const timeText = start_time
      ? ` at ${new Date(`1970-01-01T${start_time}`).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : ''

    return `${freqText}${timeText}`
  }

  const handleInterestedClick = async () => {
    if (!onToggleInterested || submitting || isRecurring) return

    try {
      setSubmitting(true)
      setError(null)
      await onToggleInterested(event)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save interest')

      safeLogEvent('venue_event_interest_error', {
        event_id: event.id,
        event_title: title ?? null,
        message: err instanceof Error ? err.message : 'Failed to save interest',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleMoreInfoClick = () => {
    const nextShowMoreInfo = !showMoreInfo
    setShowMoreInfo(nextShowMoreInfo)

    safeLogEvent(
      nextShowMoreInfo ? 'venue_event_details_expanded' : 'venue_event_details_collapsed',
      {
        event_id: event.id,
        event_title: title ?? null,
        is_recurring: Boolean(isRecurring),
      }
    )
  }

  const handleTicketClick = () => {
    safeLogEvent('venue_event_ticket_click', {
      event_id: event.id,
      event_title: title ?? null,
      ticket_link: ticket_link ?? null,
      is_recurring: Boolean(isRecurring),
    })
  }

  return (
    <div className="min-w-[250px] max-w-sm flex-shrink-0 transition-shadow hover:shadow-lg rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <p className="font-semibold text-lg text-gray-900 dark:text-white truncate">
        {title}
      </p>

      {isRecurring ? (
        <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
          {formatRecurring()}
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {starts_at ? formatDate(starts_at) : ''}
          {starts_at && ends_at && (
            <> • {formatTime(starts_at)} – {formatTime(ends_at)}</>
          )}
        </p>
      )}

      {description ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleMoreInfoClick}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showMoreInfo ? 'Less info' : 'More info'}
          </button>

          {showMoreInfo && (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleInterestedClick}
          disabled={!onToggleInterested || submitting || isRecurring}
          className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition ${
            isInterested
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
          } disabled:opacity-50`}
        >
          {submitting
            ? 'Saving...'
            : isRecurring
            ? 'Recurring Event'
            : isInterested
            ? 'Interested ✓'
            : "I'm Interested"}
        </button>

        {ticket_link ? (
          <a
            href={ticket_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleTicketClick}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700 transition"
          >
            RSVP / Tickets
          </a>
        ) : null}

        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    </div>
  )
}