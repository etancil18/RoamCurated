'use client'

import { useMemo } from 'react'
import { DateTime } from 'luxon'

import VenueMarker from '@/components/maps/VenueMarker'
import { enrichVenue } from '@/lib/venues/enrichVenue'

type Props = {
  venue: any
  index: number
  city: string
  nowISO: string
  isRouteMode: boolean
  markerRefs: any
  eventsByVenueId: Record<string, any[]>
}

export default function VenueMarkerClient({
  venue,
  index,
  city,
  nowISO,
  isRouteMode,
  markerRefs,
  eventsByVenueId,
}: Props) {

  /* ------------------------------------------------ */
  /* Normalize Venue Data                             */
  /* ------------------------------------------------ */

  const enrichedVenue = useMemo(() => {
    return enrichVenue({
      ...venue,
      city,
    })
  }, [venue, city])

  /* ------------------------------------------------ */
  /* Time Context                                     */
  /* ------------------------------------------------ */

  const nowForCity = useMemo(() => {
    return DateTime.fromISO(nowISO)
  }, [nowISO])

  /* ------------------------------------------------ */
  /* Render                                           */
  /* ------------------------------------------------ */

  return (
    <VenueMarker
      venue={enrichedVenue}
      index={index}
      city={city}
      nowForCity={nowForCity}
      isRouteMode={isRouteMode}
      markerRefs={markerRefs}
      eventsByVenueId={eventsByVenueId}
    />
  )
}