import { useEffect, useState, useCallback } from 'react'

type Event = {
  id: string
  title: string
  starts_at: string | null
  ends_at: string | null
  tags: string[] | null
  price_info: string | null
  description?: string | null
  is_active: boolean
  interest_count?: number
  venue: {
    id: string
    name: string
    slug: string
    lat: number
    lon: number
    city: string
    cover: string | null
    link?: string | null
  } | null
}

export function useEvents(
  city: 'atl' | 'nyc' | 'lisbon' | 'porto' | null,
  daysAhead = 7,
  tags?: string[],
  activeOnly = true,
  limit = 30
) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchEvents = useCallback(async () => {
    // 🔥 Do not fetch without a valid city
    if (!city) {
      setEvents([])
      return
    }

    setLoading(true)
    setError(null)

    const from = new Date()
    from.setUTCHours(0, 0, 0, 0)

    const to = new Date()
    to.setDate(to.getDate() + daysAhead)

    const params = new URLSearchParams({
      city, // now guaranteed non-null
      from: from.toISOString(),
      to: to.toISOString(),
      limit: limit.toString(),
    })

    if (!activeOnly) {
      params.set('active', 'false')
    }

    if (tags && tags.length > 0) {
      params.set('tags', tags.join(','))
    }

    try {
      const res = await fetch(`/api/events?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch events')
      }

      console.log(
        `🎟️ useEvents fetched ${json.events?.length ?? 0} events for city: ${city}`
      )

      setEvents(json.events ?? [])
    } catch (err: any) {
      console.error('❌ useEvents error:', err)
      setEvents([])
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [city, daysAhead, tags?.join(','), activeOnly, limit])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
  }
}