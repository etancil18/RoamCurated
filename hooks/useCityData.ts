'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Venue } from '@/types/venue'
import { normalizeRawVenue } from '@/lib/venues/normalizeVenue'

// Import raw city data (not typed yet)
import atlantaData from '@/data/atlanta'
import nycData from '@/data/nyc'
import portoData from '@/data/porto'
import lisbonData from '@/data/lisbon'
import londonData from '@/data/london'
import losAngelesData from '@/data/losangeles'

// Raw data remains untrusted until normalized
const RAW_CITY_DATA: Record<string, readonly unknown[]> = {
  atl: atlantaData,
  nyc: nycData,
  porto: portoData,
  lisbon: lisbonData,
  london: londonData,
  la: losAngelesData,
}

type Event = {
  id: string
  starts_at?: string
  title: string
  venue?: { id: string }
}

type UseCityDataOptions = {
  daysAhead?: number
  showLiveEventsOnly?: boolean
}

export function useCityData(
  city: string | null,
  options: UseCityDataOptions = {}
) {
  const { daysAhead = 7, showLiveEventsOnly = false } = options
  const safeCity = city ?? ''

  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const venues: Venue[] = useMemo(() => {
    const raw = RAW_CITY_DATA[safeCity] ?? []

    return raw
      .map((venue) =>
        normalizeRawVenue(venue, {
          city: safeCity || undefined,
        })
      )
      .filter((venue): venue is Venue => venue !== null)
  }, [safeCity])

  useEffect(() => {
    if (!safeCity) return

    async function load() {
      setLoading(true)

      try {
        const from = new Date()
        const to = new Date()
        to.setDate(to.getDate() + daysAhead)

        const params = new URLSearchParams({
          city: safeCity,
          from: from.toISOString(),
          to: to.toISOString(),
        })

        const res = await fetch(`/api/events?${params.toString()}`)
        const json = await res.json()

        setEvents(json.events ?? [])
      } catch (err) {
        console.error('[useCityData] Failed to fetch events:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [safeCity, daysAhead])

  const eventsByVenueId = useMemo(() => {
    const grouped: Record<string, Event[]> = {}

    for (const ev of events) {
      const vId = ev.venue?.id

      if (!vId) continue
      if (!grouped[vId]) grouped[vId] = []

      grouped[vId].push(ev)
    }

    return grouped
  }, [events])

  const visibleVenues = useMemo(() => {
    if (!showLiveEventsOnly) return venues

    return venues.filter((v) => {
      const evs = eventsByVenueId[v.id] ?? []

      return evs.some((ev) => !!ev.starts_at)
    })
  }, [venues, eventsByVenueId, showLiveEventsOnly])

  return {
    venues: visibleVenues,
    allVenues: venues,
    events,
    eventsByVenueId,
    loading,
  }
}