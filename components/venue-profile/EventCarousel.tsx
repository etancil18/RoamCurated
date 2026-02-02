'use client'

import { useEffect, useRef } from 'react'
import { VenueEvent } from '@/types/venue-profile'

type Props = {
  events: VenueEvent[]
}

export default function EventCarousel({ events }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0
    }
  }, [])

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
        Upcoming Events
      </h2>

      {/* — Mobile Carousel — */}
      <div
        ref={scrollRef}
        className="flex space-x-4 overflow-x-auto md:hidden pb-2 -mx-1 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700"
      >
        {upcoming.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>

      {/* — Desktop Grid — */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {upcoming.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  )
}

function EventCard({ event }: { event: VenueEvent }) {
  const {
    title,
    isRecurring,
    recurrence_rule,
    starts_at,
    ends_at,
    start_time,
  } = event

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
    if (!recurrence_rule) return "Recurring"

    const parts = recurrence_rule.split(";")
    const freq = parts.find(p => p.startsWith("FREQ="))?.split("=")[1]
    const byDay = parts.find(p => p.startsWith("BYDAY="))?.split("=")[1]

    const dayMap: Record<string, string> = {
      MO: "Monday",
      TU: "Tuesday",
      WE: "Wednesday",
      TH: "Thursday",
      FR: "Friday",
      SA: "Saturday",
      SU: "Sunday",
    }

    const friendlyDay = byDay ? byDay.split(",").map(d => dayMap[d] || d).join(", ") : ""

    const freqText = freq === "DAILY"
      ? "Every day"
      : freq === "WEEKLY" && friendlyDay
      ? `Every ${friendlyDay}`
      : freq === "MONTHLY"
      ? "Every month"
      : "Recurring"

    const timeText = start_time
  ? ` at ${new Date(`1970-01-01T${start_time}`).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`
  : ""

    return `${freqText}${timeText}`
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
          {starts_at ? formatDate(starts_at) : ''}{' '}
          {starts_at && ends_at && (
            <> • {formatTime(starts_at)} – {formatTime(ends_at)}</>
          )}
        </p>
      )}
    </div>
  )
}

