'use client'

// Prevent SSR evaluation
if (typeof window === 'undefined') {
  throw new Error(
    'PropertyRouteControl must only be imported on the client'
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, LatLngExpression } from 'leaflet'
import { Polyline } from 'react-leaflet'

import type { Venue } from '@/types/venue'
import RoutePolyline from '@/components/RoutePolyline'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type Property = {
  name: string
  lat: number
  lon: number
  city?: string
}

type Props = {
  map: LeafletMap
  property: Property
  venues: Venue[]
  color?: string
  travelMode?: 'walking' | 'cycling' | 'driving'
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const MAX_ROUTE_STOPS = 10

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function normalizeCoords(
  lat: number,
  lon: number
): [number, number] {
  const needsFlip = lat < -90 || lat > 90
  return needsFlip ? [lon, lat] : [lat, lon]
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function PropertyRouteControl({
  map,
  property,
  venues,
  color = 'cyan',
  travelMode = 'walking',
}: Props) {

  const controlRef = useRef<any>(null)

  const [polylineCoords, setPolylineCoords] = useState<
    LatLngExpression[]
  >([])

  useEffect(() => {

    if (!map) return

    const stops = venues.slice(0, MAX_ROUTE_STOPS)

    if (stops.length === 0) return

    let L: any

    async function initRouting() {

      const leaflet = await import('leaflet')
      await import('leaflet-routing-machine')

      // TS workaround for untyped package
      const mapboxRouting: any = await import('lrm-mapbox')

      L = leaflet.default ?? leaflet

      if (controlRef.current) {
        try {
          map.removeControl(controlRef.current)
        } catch {}
        controlRef.current = null
      }

      const token =
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

      if (!token) {
        console.error('Missing Mapbox token')
        return
      }

      const routeStops = [
        {
          lat: property.lat,
          lon: property.lon,
        },
        ...stops.map((v) => ({
          lat: v.lat,
          lon: v.lon,
        })),
      ]

      const validWaypoints = routeStops
        .map((v) => normalizeCoords(v.lat, v.lon))
        .filter(
          ([lat, lon]) =>
            Number.isFinite(lat) && Number.isFinite(lon)
        )

      if (validWaypoints.length < 2) return

      const latLngs = validWaypoints.map(
        ([lat, lon]) => L.latLng(lat, lon)
      )

      const router = L.Routing.mapbox(token, {
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

        map.fitBounds(bounds, {
          padding: [60, 60],
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

  }, [map, venues, property, travelMode, color])

  if (polylineCoords.length === 0) return null

  return (
    <RoutePolyline
      coords={polylineCoords}
      color={color}
      render={({
        positions,
        color,
      }: {
        positions: LatLngExpression[]
        color: string
      }) => (
        <Polyline
          positions={positions}
          pathOptions={{
            color,
            weight: 5,
            opacity: 0.9,
          }}
        />
      )}
    />
  )
}