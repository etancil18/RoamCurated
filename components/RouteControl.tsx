'use client'

import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'

import type { Venue } from '@/types/venue'
import RoutePolyline from './RoutePolyline'
import { logEvent } from '@/lib/logEvent'

type RouteControlProps = {
  route: Venue[]
  color?: string
  travelMode: 'walking' | 'cycling' | 'driving'
}

function normalizeCoords(lat: number, lon: number): [number, number] {
  const needsFlip = lat < -90 || lat > 90
  return needsFlip ? [lon, lat] : [lat, lon]
}

export default function RouteControl({
  route,
  color = 'cyan',
  travelMode,
}: RouteControlProps) {
  const map = useMap()
  const controlRef = useRef<any>(null)
  const [polylineCoords, setPolylineCoords] = useState<LatLngExpression[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!map || route.length < 2) return

    let L: any

    async function initRouting() {
      // 🔒 Dynamically import Leaflet + plugins
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

      const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!MAPBOX_TOKEN) {
        console.error('❌ Missing Mapbox token')
        return
      }

      const validWaypoints = route
        .map((v) => normalizeCoords(v.lat, v.lon))
        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))

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

  return <RoutePolyline coords={polylineCoords} color={color} />
}
