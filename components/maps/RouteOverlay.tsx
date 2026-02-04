'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import type { Venue } from '@/types/venue'
import { THEME_COLORS } from '@/config/themeColors'

type Props = {
  route: Venue[]
  travelMode: 'walking' | 'cycling' | 'driving'
  themeId?: string
  color?: string
}

export default function RouteOverlay({
  route,
  travelMode,
  themeId,
  color = 'blue',
}: Props) {
  const map = useMap()

  useEffect(() => {
    if (!map || route.length < 2) return

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!MAPBOX_TOKEN) {
      console.error('[RouteOverlay] Missing Mapbox access token')
      return
    }

    const waypoints = route.map((v) => L.latLng(v.lat, v.lon))

    const resolvedColor =
      (themeId && THEME_COLORS[themeId]) || color || 'cyan'

    const plan = L.Routing.plan(waypoints, {
      createMarker: () => false,
    })

    const control = L.Routing.control({
      plan,
      lineOptions: {
        styles: [
          {
            color: resolvedColor,
            weight: 5,
            opacity: 0.9,
          },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 10,
      },
      router: L.Routing.mapbox(MAPBOX_TOKEN, {
        profile: `mapbox/${travelMode}`,
      }),
      addWaypoints: false,
      fitSelectedRoutes: false,
      routeWhileDragging: false,
      show: false,
    })

    control.addTo(map)

    return () => {
      map.removeControl(control)
    }
  }, [map, route, travelMode, themeId, color])

  return null
}
