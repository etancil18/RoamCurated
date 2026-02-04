'use client'

import { useMemo } from 'react'

type Event = {
  id: string
  venue?: {
    id: string
  }
  [key: string]: any
}

/**
 * Groups events by their venue.id
 */
export function useGroupedEvents(events: Event[]) {
  return useMemo(() => {
    const map: Record<string, Event[]> = {}

    for (const ev of events) {
      const venueId = ev.venue?.id
      if (!venueId) continue

      if (!map[venueId]) {
        map[venueId] = []
      }

      map[venueId].push(ev)
    }

    return map
  }, [events])
}
