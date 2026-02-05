'use client'

import { useEffect } from 'react'
import L, { Map as LeafletMap } from 'leaflet'
import { useMap } from 'react-leaflet'
import type { Venue } from '@/types/venue'
import { logEvent } from '@/lib/logEvent'

type Props = {
  city: string
  route?: Venue[]
  onMapClick?: (lat: number, lon: number) => void
  defaultCenter: [number, number]
  setUserPosition: (pos: [number, number]) => void
  mapRef: React.MutableRefObject<LeafletMap | null>
}

const USA_CENTER: [number, number] = [37.8, -96.9]
const USA_ZOOM = 4
const CITY_ZOOM = 12

export default function MapEffectController({
  city,
  route,
  onMapClick,
  defaultCenter,
  setUserPosition,
  mapRef,
}: Props) {
  const map = useMap()

  // ✅ Store Leaflet map ref
  useEffect(() => {
    if (map) {
      mapRef.current = map
    }

    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])

  // ✅ Fly to city or USA fallback
  useEffect(() => {
    if (!map) return

    if (!city || city === '') {
      map.flyTo(USA_CENTER, USA_ZOOM, {
        animate: true,
        duration: 1.5,
      })
      return
    }

    const timeout = setTimeout(() => {
      map.flyTo(defaultCenter, CITY_ZOOM, {
        animate: true,
        duration: 1.75,
      })
    }, 300)

    return () => clearTimeout(timeout)
  }, [city, map, defaultCenter])

  // ✅ Fit bounds if route exists
  useEffect(() => {
    if (!map || !route || route.length < 2) return

    const bounds = L.latLngBounds(route.map((v) => [v.lat, v.lon]))
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [map, route])

  // ✅ Click handler propagation
  useEffect(() => {
    if (!map || !onMapClick) return

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, onMapClick])

  // ✅ SSR-safe geolocation
  useEffect(() => {
    if (typeof window === 'undefined' || !window.navigator?.geolocation) {
      setUserPosition(defaultCenter)
      return
    }

    const geo = window.navigator.geolocation
    geo.getCurrentPosition(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude])
      },
      (err) => {
        console.warn('Geolocation error:', err)
        setUserPosition(defaultCenter)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }, [city, defaultCenter, setUserPosition])

  // ✅ Log analytics
  useEffect(() => {
    logEvent('map_opened', {
      metadata: {
        screen: 'map',
        city,
      },
    })
  }, [city])

  return null
}
