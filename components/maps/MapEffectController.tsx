'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type { Venue } from '@/types/venue'
import { logEvent } from '@/lib/logEvent'

type Props = {
  city: string
  route?: Venue[]
  onMapClick?: (lat: number, lon: number) => void
  defaultCenter: [number, number]
  setUserPosition: (pos: [number, number]) => void
  mapRef: React.MutableRefObject<any>
}

const USA_CENTER: [number, number] = [37.8, -96.9]
const USA_ZOOM = 4
const CITY_ZOOM = 12
const PIN_FOCUS_ZOOM = 16

export default function MapEffectController({
  city,
  route,
  onMapClick,
  defaultCenter,
  setUserPosition,
  mapRef,
}: Props) {
  const map = useMap()
  const leafletRef = useRef<any>(null)
  const hasAppliedPinFocusRef = useRef(false)

  const isPinnedCenter =
    defaultCenter[0] !== USA_CENTER[0] || defaultCenter[1] !== USA_CENTER[1]

  // Dynamically load Leaflet
  useEffect(() => {
    import('leaflet').then((L) => {
      leafletRef.current = L
    })
  }, [])

  useEffect(() => {
    if (map) {
      mapRef.current = map
    }
    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])

  useEffect(() => {
    if (!map || !leafletRef.current) return

    if (!city || city === '') {
      hasAppliedPinFocusRef.current = false
      map.flyTo(USA_CENTER, USA_ZOOM, {
        animate: true,
        duration: 1.5,
      })
      return
    }

    if (isPinnedCenter) {
      hasAppliedPinFocusRef.current = true
      return
    }

    hasAppliedPinFocusRef.current = false

    const timeout = setTimeout(() => {
      map.flyTo(defaultCenter, CITY_ZOOM, {
        animate: true,
        duration: 1.75,
      })
    }, 300)

    return () => clearTimeout(timeout)
  }, [city, map, defaultCenter, isPinnedCenter])

  useEffect(() => {
    if (!map || !route || route.length < 2 || !leafletRef.current) return

    if (hasAppliedPinFocusRef.current || isPinnedCenter) return

    const L = leafletRef.current
    const bounds = L.latLngBounds(route.map((v: Venue) => [v.lat, v.lon]))
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [map, route, isPinnedCenter])

  useEffect(() => {
    if (!map || !onMapClick || !leafletRef.current) return

    const L = leafletRef.current
    const handler = (e: (typeof L)['LeafletMouseEvent']) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, onMapClick])

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