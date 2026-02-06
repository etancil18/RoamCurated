'use client'

// 🚨 Tripwire — this file must never be evaluated during SSR
if (typeof window === 'undefined') {
  throw new Error(
    'RouteControl.tsx must only be imported via dynamic({ ssr: false })'
  )
}

import { useEffect, useRef, useState } from 'react'
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
  const controlRef = useRef<any>(null)
  const [polylineCoords, setPolylineCoords] = useState<LatLngExpression[]>([])

  useEffect(() => {
    if (!map || route.length < 2) return

    let L: any

    async function initRouting() {
      // 🔒 Runtime-only imports (no SSR side effects)
      const leaflet = await import('leaflet')
      await import('leaflet-routing-machine')
      await import('lrm-mapbox')

      L = leaflet.default ?? leaflet

      if (controlRef.current) {
        try {
          map.removeControl(controlRef.current)
        } catch {}
        controlRef.current = null
      }

      const MAPBOX_TOKEN: string = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
      if (!MAPBOX_TOKEN) {
        console.error('❌ Missing Mapbox token')
        return
      }

      const validWaypoints = route
        .map((v) => normalizeCoords(v.lat, v.lon))
        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))

      if (validWaypoints.length < 2) return

      const latLngs = validWaypoints.map(([lat, lon]) =>
        L.latLng(lat, lon)
      )

      const router = L.Routing.mapbox(MAPBOX_TOKEN, {
        profile: `mapbox/${travelMode}`,
        language: 'en',
      })

      const control = L.Routing.control({
        waypoints: latLngs,
        router,
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        plan: L.Routing.plan(latLngs, {
          createMarker: () => null,
        }),
        lineOptions: {
          styles: [{ color, weight: 4, opacity: 0.9 }],
        },
      })

      control.on('routesfound', (e: any) => {
        const coords = e.routes[0].coordinates.map(
          (c: any) => [c.lat, c.lng] as [number, number]
        )

        setPolylineCoords(coords)

        const bounds = L.latLngBounds(coords)
        map.fitBounds(bounds, { padding: [50, 50] })

        logEvent('route_rendered', {
          metadata: {
            num_stops: route.length,
            travel_mode: travelMode,
            polyline_length: coords.length,
          },
        })
      })

      control.on('routingerror', () => {
        setPolylineCoords([])
      })

      control.addTo(map)
      controlRef.current = control
    }

    initRouting()

    return () => {
      try {
        if (controlRef.current) {
          map.removeControl(controlRef.current)
          controlRef.current = null
        }
      } catch {}
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
