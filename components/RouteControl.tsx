'use client'

import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet'
import 'leaflet-routing-machine'
import 'lrm-mapbox'

import type { Venue } from '@/types/venue'
import RoutePolyline from './RoutePolyline'

type RouteControlProps = {
  route: Venue[]
  color?: string
  travelMode: 'walking' | 'cycling' | 'driving'
}

/**
 * Normalize coordinates to [lat, lon] — safely handles flipped pairs.
 */
function normalizeCoords(lat: number, lon: number): [number, number] {
  const needsFlip = lat < -90 || lat > 90
  return needsFlip ? [lon, lat] : [lat, lon]
}

/**
 * RouteControl dynamically creates and manages a Leaflet Routing Machine control.
 * It fully tears down and rebuilds the routing layer whenever route or travel mode changes.
 */
export default function RouteControl({
  route,
  color = 'cyan',
  travelMode,
}: RouteControlProps) {
  const map = useMap() as LeafletMap
  const controlRef = useRef<any>(null)
  const [polylineCoords, setPolylineCoords] = useState<LatLngExpression[]>([])

  useEffect(() => {
    // Guard: must have valid map + at least two stops
    if (!map || !route || route.length < 2) return

    // 🔥 Remove any previous routing instance before creating a new one
    if (controlRef.current) {
      try {
        map.removeControl(controlRef.current)
      } catch (err) {
        console.warn('⚠️ Cleanup warning: failed to remove old route control', err)
      }
      controlRef.current = null
    }

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!MAPBOX_TOKEN) {
      console.error('❌ Missing Mapbox token')
      return
    }

    // Prepare valid waypoints
    const validWaypoints = route
      .map((v) => normalizeCoords(v.lat, v.lon))
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))

    const latLngs = validWaypoints.map(([lat, lon]) => L.latLng(lat, lon))

    // Create router instance
    const router = (L.Routing as any).mapbox(MAPBOX_TOKEN, {
      profile: `mapbox/${travelMode}`,
      language: 'en',
      polylinePrecision: 5,
    })

    // Build control instance
    const control = L.Routing.control({
      waypoints: latLngs,
      router,
      routeWhileDragging: false,
      addWaypoints: false,
      show: false,
      plan: L.Routing.plan(latLngs, {
        createMarker: () => null as any,
      }),
      lineOptions: {
        styles: [{ color, weight: 4, opacity: 0.9 }],
        extendToWaypoints: true,
        missingRouteTolerance: 10,
      },
    })

    controlRef.current = control

    // ✅ Handle routing results
    control.on('routesfound', (e: any) => {
      const coords = e.routes[0].coordinates.map(
        (c: any) => [c.lat, c.lng] as [number, number]
      )
      setPolylineCoords(coords)

      // Fit map bounds to route
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] })
    })

    // 🚨 Handle routing errors
    control.on('routingerror', (e: any) => {
      console.error('🚨 Routing error:', e?.error || e)
      setPolylineCoords([])
    })

    // Add to map
    control.addTo(map)

    // Cleanup on unmount or dependency change
    return () => {
      try {
        if (controlRef.current) {
          map.removeControl(controlRef.current)
          controlRef.current = null
        }
      } catch (err) {
        console.warn('⚠️ Failed to clean up RouteControl:', err)
      }
      setPolylineCoords([])
    }
  }, [map, route, travelMode, color])

  // Only render polyline once coordinates exist
  if (polylineCoords.length === 0) return null

  return <RoutePolyline coords={polylineCoords} color={color} />
}
