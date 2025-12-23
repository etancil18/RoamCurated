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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Upcoming Events
      </h2>

      {/* — Mobile Carousel — */}
      <div
        ref={scrollRef}
        className="flex space-x-4 overflow-x-auto md:hidden pb-2 -mx-1"
      >
        {events.map((ev) => (
          <div key={ev.id} className="px-1">
            <EventCard event={ev} />
          </div>
        ))}
      </div>

      {/* — Desktop Grid — */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => (
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

  return (
    <div className="min-w-[250px] max-w-sm rounded-xl border border-gray-300 dark:border-gray-700 p-4 shadow-sm bg-white dark:bg-gray-900">
      <p className="font-semibold text-base text-gray-900 dark:text-white mb-1">
        {title}
      </p>

      {isRecurring ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Recurs: <span className="capitalize">{recurrence_rule}</span>
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {starts_at ? formatDate(starts_at) : ''} •{' '}
          {starts_at && ends_at
            ? `${formatTime(starts_at)} – ${formatTime(ends_at)}`
            : ''}
        </p>
      )}
    </div>
  )
}
