'use client'

import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import { DateTime } from 'luxon'
import type { Venue } from '@/types/venue'

import RouteControl from '@/components/RouteControl'

import 'leaflet/dist/leaflet.css'

type Property = {
  name: string
  lat: number
  lon: number
  city: string
}

type Props = {
  venues: Venue[]
  property: Property
  city: string
  nowISO: string
  markerRefs: any
}

/* ------------------------------------------------ */
/* Routing Layer                                    */
/* ------------------------------------------------ */

function RoutingLayer({
  venues,
  property,
}: {
  venues: Venue[]
  property: Property
}) {

  const map = useMap()

  if (!map || venues.length < 1) return null

  const propertyWaypoint: Venue = {
    id: 'property',
    name: property.name,
    lat: property.lat,
    lon: property.lon,
    city: property.city,
    link: '#',
  }

  const route = [propertyWaypoint, ...venues].filter(
    (v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)
  )

  if (route.length < 2) return null

  return (
    <RouteControl
      map={map}
      route={route}
      travelMode="walking"
    />
  )
}

/* ------------------------------------------------ */
/* Crawl Map                                        */
/* ------------------------------------------------ */

export default function CrawlMap({
  venues,
  property,
  city,
  nowISO,
}: Props) {

  const nowForCity = useMemo(
    () => DateTime.fromISO(nowISO),
    [nowISO]
  )

  const center: [number, number] = [
    property.lat,
    property.lon
  ]

  /* ------------------------------------------------ */
  /* Leaflet icon patch (fix marker 404s)             */
  /* ------------------------------------------------ */

  useEffect(() => {

    if (typeof window === 'undefined') return

    const L = require('leaflet')

    delete (L.Icon.Default.prototype as any)._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png'
    })

  }, [])

  /* ------------------------------------------------ */
  /* Numbered marker factory                          */
  /* ------------------------------------------------ */

  function numberedIcon(index: number) {

    const L = require('leaflet')

    return L.divIcon({
      className: 'crawl-marker',
      html: `
        <div style="
          background:#22c55e;
          color:white;
          border-radius:50%;
          width:28px;
          height:28px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:600;
          font-size:13px;
          border:2px solid white;
          box-shadow:0 0 4px rgba(0,0,0,0.4);
        ">
          ${index}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    })
  }

  return (
    <div className="h-[500px] rounded-xl overflow-hidden border">

      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />

        {/* Property Marker */}

        <Marker position={center}>
          <Tooltip>{property.name}</Tooltip>
        </Marker>

        {/* Venue Markers (Numbered Stops) */}

        {venues.map((v, i) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lon]}
            icon={numberedIcon(i + 1)}
          >
            <Tooltip>
              {i + 1}. {v.name}
            </Tooltip>
          </Marker>
        ))}

        {/* Routing */}

        <RoutingLayer
          venues={venues}
          property={property}
        />

      </MapContainer>

    </div>
  )
}