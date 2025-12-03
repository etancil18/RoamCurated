'use client'

import { useState, useEffect, useCallback } from 'react'

export type InterestedEvent = {
  id: string
  title: string
  starts_at: string | null
  ends_at: string | null
  tags: string[] | null
  price_info: string | null
  venue: {
    id: string
    name: string
    slug: string
    lat: number
    lon: number
    city: string
    cover: string | null
  } | null
}

interface UseInterestedEvents {
  interested: InterestedEvent[]
  loading: boolean
  error: Error | null
  markInterest: (eventId: string) => Promise<void>
  removeInterest: (eventId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useInterestedEvents(): UseInterestedEvents {
  const [interested, setInterested] = useState<InterestedEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchInterested = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events/interested')
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const json = await res.json()
      setInterested(json.events ?? [])
    } catch (err: any) {
      console.error('✅ useInterestedEvents fetch error:', err)
      setError(err)
      setInterested([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInterested()
  }, [fetchInterested])

  const markInterest = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/interest`, { method: 'POST' })
      if (!res.ok) throw new Error(`Mark interest failed: ${res.status}`)
      await fetchInterested()
    } catch (err: any) {
      console.error('✅ useInterestedEvents markInterest error:', err)
      throw err
    }
  }, [fetchInterested])

  const removeInterest = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/interest`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Remove interest failed: ${res.status}`)
      await fetchInterested()
    } catch (err: any) {
      console.error('✅ useInterestedEvents removeInterest error:', err)
      throw err
    }
  }, [fetchInterested])

  return {
    interested,
    loading,
    error,
    markInterest,
    removeInterest,
    refresh: fetchInterested,
  }
}

export default useInterestedEvents
