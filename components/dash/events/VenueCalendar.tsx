'use client'

import { useEffect, useState } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

type Event = {
  id: string
  title: string
  start: Date
  end: Date
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
})

export default function VenueCalendar({
  venueId,
  refreshKey = 0,
}: {
  venueId: string
  refreshKey?: number
}) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('week')

  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        const res = await fetch(`/api/dash/venue/${venueId}/calendar`)

        if (!res.ok) {
          console.error(
            'Calendar API error:',
            res.status,
            await res.text()
          )
          setEvents([])
          return
        }

        const json = await res.json()

        const parsed: Event[] = (json ?? []).map((e: any) => ({
          id: e.id,
          title: e.title,
          start: new Date(e.start),
          end: new Date(e.end),
        }))

        setEvents(parsed)
      } catch (err) {
        console.error('Error fetching calendar data:', err)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    if (venueId) {
      fetchCalendarData()
    }
  }, [venueId, refreshKey]) // 🔁 Refetches when venueId or refreshKey changes

  if (loading) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading calendar…
      </p>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mt-6">
      <h2 className="text-lg font-semibold mb-4">Venue Calendar</h2>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view} // ✅ this line fixes the toggle issue
        onView={setView}
        style={{ height: 500 }}
      />
    </div>
  )
}
