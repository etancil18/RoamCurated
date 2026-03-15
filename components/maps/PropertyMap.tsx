'use client'

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import { DateTime } from 'luxon'

import { UserLocationMarker } from '@/components/maps/map-dynamic-wrapper'

import PropertyVenueMarker from '@/components/maps/PropertyVenueMarker'
import PropertyRouteControl from '@/components/maps/PropertyRouteControl'

import { getCityNow } from '@/lib/getCityNow'
import { useUserLocation } from '@/hooks/useUserLocation'

import type { Venue } from '@/types/venue'

import 'leaflet/dist/leaflet.css'

type Property = {
  id: string
  name: string
  lat: number
  lon: number
  city: string
}

type Props = {
  property: Property
  venues: Venue[]
  travelMode?: 'walking' | 'cycling' | 'driving'
}

const DEFAULT_ZOOM = 15
const MAX_ROUTE_STOPS = 10

/* ------------------------------------------------ */
/* MapRefSetter — React-Leaflet safe map reference  */
/* ------------------------------------------------ */

function MapRefSetter({
  mapRef
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])

  return null
}

export default function PropertyMap({
  property,
  venues,
  travelMode = 'walking'
}: Props) {

  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Record<string, LeafletMarker>>({})

  const [activeRoute, setActiveRoute] = useState<Venue[]>([])
  const [scrollZoom, setScrollZoom] = useState(false)

  const propertyCenter: [number, number] = [
    property.lat,
    property.lon
  ]

  /* ------------------------------------------------ */
  /* City-aware time                                  */
  /* ------------------------------------------------ */

  const nowForCity: DateTime = useMemo(() => {
    return getCityNow(property.city)
  }, [property.city])

  /* ------------------------------------------------ */
  /* User location                                    */
  /* ------------------------------------------------ */

  const userLocation = useUserLocation({
    fallback: propertyCenter
  })

  /* ------------------------------------------------ */
  /* Scroll zoom guard                                */
  /* ------------------------------------------------ */

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setScrollZoom(window.innerWidth >= 768)
    }
  }, [])

  /* ------------------------------------------------ */
  /* Leaflet icon patch                               */
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
  /* Property icon                                    */
  /* ------------------------------------------------ */

  const propertyIcon = useMemo(() => {

    if (typeof window === 'undefined') return undefined

    const L = require('leaflet')

    return L.divIcon({
      className: '',
      html: `<div style="font-size:28px;">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    })

  }, [])

  /* ------------------------------------------------ */
  /* Active route                                     */
  /* ------------------------------------------------ */

  const visibleRoute = useMemo(() => {

    if (!activeRoute || activeRoute.length < 2) return []

    return activeRoute.slice(0, MAX_ROUTE_STOPS)

  }, [activeRoute])

  /* ------------------------------------------------ */
  /* Crawl preview event                              */
  /* ------------------------------------------------ */

  useEffect(() => {

    function handlePreviewRoute(e: any) {

      const venues = e?.detail?.venues

      if (!Array.isArray(venues)) return

      setActiveRoute(venues)

    }

    window.addEventListener(
      'preview-property-crawl',
      handlePreviewRoute
    )

    return () => {
      window.removeEventListener(
        'preview-property-crawl',
        handlePreviewRoute
      )
    }

  }, [])

  /* ------------------------------------------------ */

  return (

    <div className="h-[400px] w-full rounded-xl overflow-hidden border">

      <MapContainer
        center={propertyCenter}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={scrollZoom}
        zoomControl={false}
      >

        <MapRefSetter mapRef={mapRef} />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />

        {/* Property marker */}

        {propertyIcon && (
          <Marker
            position={propertyCenter}
            icon={propertyIcon}
          />
        )}

        {/* Venue markers */}

        {venues.map((v, i) => (
          <PropertyVenueMarker
            key={v.id}
            venue={v}
            index={i}
            city={property.city}
            nowForCity={nowForCity}
            isRouteMode={visibleRoute.length > 0}
            markerRefs={markerRefs}
          />
        ))}

        {/* User location */}

        {userLocation && (
          <UserLocationMarker position={userLocation} />
        )}

        {/* Route preview */}

        {visibleRoute.length > 1 && mapRef.current && (
          <PropertyRouteControl
            map={mapRef.current}
            property={property}
            venues={visibleRoute}
            travelMode={travelMode}
          />
        )}

      </MapContainer>

    </div>
  )
}