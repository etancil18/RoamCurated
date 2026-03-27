'use client'

// 🚨 Tripwire — this file must never be evaluated during SSR
if (typeof window === 'undefined') {
  throw new Error(
    'RouteControl.tsx must only be imported via dynamic({ ssr: false })'
  )
}

import { useEffect, useState } from 'react'
import type { LatLngExpression, Map as LeafletMap } from 'leaflet'
import { Polyline } from 'react-leaflet'

import type { Venue } from '@/types/venue'
import RoutePolyline from './RoutePolyline'
import { logEvent } from '@/lib/logEvent'

type RouteControlProps = {
  map: LeafletMap
  route: Venue[]
  color?: string
  travelMode: 'walking' | 'cycling' | 'driving'
}

function normalizeCoords(lat: number, lon: number): [number, number] {
  const needsFlip = lat < -90 || lat > 90
  return needsFlip ? [lon, lat] : [lat, lon]
}

export default function RouteControl({
  map,
  route,
  color = 'cyan',
  travelMode,
}: RouteControlProps) {
  const [polylineCoords, setPolylineCoords] = useState<LatLngExpression[]>([])

  useEffect(() => {
    if (!map || route.length < 2) return

    const MAPBOX_TOKEN: string = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
    if (!MAPBOX_TOKEN) {
      console.error('❌ Missing Mapbox token')
      setPolylineCoords([])
      return
    }

    const controller = new AbortController()
    let cancelled = false

    async function loadRoute() {
      try {
        const validWaypoints = route
          .map((v) => normalizeCoords(v.lat, v.lon))
          .filter(
            ([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon)
          )

        if (validWaypoints.length < 2) {
          setPolylineCoords([])
          return
        }

        const coordinates = validWaypoints
          .map(([lat, lon]) => `${lon},${lat}`)
          .join(';')

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/${travelMode}/${coordinates}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`

        const res = await fetch(url, {
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(`Mapbox directions failed: ${res.status}`)
        }

        const data = await res.json()

        const coords =
          data?.routes?.[0]?.geometry?.coordinates?.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          ) ?? []

        if (cancelled) return

        if (coords.length === 0) {
          setPolylineCoords([])
          return
        }

        setPolylineCoords(coords)

        const leaflet = await import('leaflet')
        const L = leaflet.default ?? leaflet

        if (cancelled) return

        const bounds = L.latLngBounds(coords)
        map.fitBounds(bounds, { padding: [50, 50] })

        logEvent('route_rendered', {
          metadata: {
            num_stops: route.length,
            travel_mode: travelMode,
            polyline_length: coords.length,
          },
        })
      } catch (error: any) {
        if (error?.name === 'AbortError') return

        console.error('Routing error:', error)
        if (!cancelled) {
          setPolylineCoords([])
        }
      }
    }

    loadRoute()

    return () => {
      cancelled = true
      controller.abort()
      setPolylineCoords([])
    }
  }, [map, route, travelMode, color])

  if (polylineCoords.length === 0) return null

  return (
    <RoutePolyline
      coords={polylineCoords}
      color={color}
      render={({ positions, color }) => (
        <Polyline
          positions={positions}
          pathOptions={{ color, weight: 5, opacity: 0.9 }}
        />
      )}
    />
  )
}