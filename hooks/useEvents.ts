// hooks/useEvents.ts
import { useEffect, useState } from 'react'

export function useEvents(city: 'atl' | 'nyc', daysAhead = 7) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const from = new Date()
      const to = new Date()
      to.setDate(to.getDate() + daysAhead)

      const params = new URLSearchParams({
        city,
        from: from.toISOString(),
        to: to.toISOString()
      })

      const res = await fetch(`/api/events?${params.toString()}`)
      const json = await res.json()
      setEvents(json.events ?? [])
      setLoading(false)
    }

    load()
  }, [city, daysAhead])

  return { events, loading }
}
