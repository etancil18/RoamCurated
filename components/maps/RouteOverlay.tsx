'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
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
  const controlRef = useRef<any>(null)

  useEffect(() => {
    if (!map || route.length < 2) return

    // ✅ Freeze env var into a real string (TS-safe)
    const MAPBOX_TOKEN: string = process.env
      .NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''

    if (!MAPBOX_TOKEN) {
      console.error('[RouteOverlay] Missing Mapbox access token')
      return
    }

    let isMounted = true

    async function loadRouting() {
      const L = (await import('leaflet')).default
      await import('leaflet-routing-machine')
      await import('leaflet-routing-machine/dist/leaflet-routing-machine.css')

      if (!isMounted) return

      const waypoints = route.map((v) => L.latLng(v.lat, v.lon))

      const resolvedColor =
        (themeId && THEME_COLORS[themeId]) || color || 'cyan'

      const plan = L.Routing.plan(waypoints, {
        createMarker: () => false,
      })

      const control = L.Routing.control({
        plan,
        lineOptions: {
          styles: [{ color: resolvedColor, weight: 5, opacity: 0.9 }],
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
      controlRef.current = control
    }

    loadRouting()

    return () => {
      isMounted = false
      if (controlRef.current) {
        map.removeControl(controlRef.current)
        controlRef.current = null
      }
    }
  }, [map, route, travelMode, themeId, color])

  return null
}
