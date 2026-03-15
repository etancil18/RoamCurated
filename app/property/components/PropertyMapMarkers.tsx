'use client'

import { DateTime } from 'luxon'
import { useMemo, useRef } from 'react'
import { VenueMarker } from '@/components/maps/map-dynamic-wrapper'

type Props = {
  venues: any[]
  property: any
  city: string
  nowISO: string
}

export default function PropertyMapMarkers({
  venues,
  property,
  city,
  nowISO,
}: Props) {
  const nowForCity = useMemo(() => DateTime.fromISO(nowISO), [nowISO])

  const markerRefs = useRef<Record<string, any>>({})

  return (
    <>
      {/* Property marker */}
      <VenueMarker
        venue={{
          id: 'property',
          name: property.name,
          lat: property.lat,
          lon: property.lon,
          city: property.city,
          link: '#',
          slug: 'property',
        }}
        index={0}
        city={city}
        nowForCity={nowForCity}
        isRouteMode={false}
        markerRefs={markerRefs}
        eventsByVenueId={{}}
      />

      {venues.map((v, i) => (
        <VenueMarker
          key={v.id}
          venue={v}
          index={i + 1}
          city={city}
          nowForCity={nowForCity}
          isRouteMode={false}
          markerRefs={markerRefs}
          eventsByVenueId={{}}
        />
      ))}
    </>
  )
}