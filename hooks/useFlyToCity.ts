'use client'

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { CITY_CONFIGS } from '@/config/cities'

const USA_CENTER: [number, number] = [37.8, -96.9]
const USA_ZOOM = 4
const CITY_ZOOM = 12

type Options = {
  mapRef: MutableRefObject<LeafletMap | null>
  city: string | null
  disabled?: boolean
}

export function useFlyToCity({ mapRef, city, disabled = false }: Options) {
  useEffect(() => {
    if (!mapRef.current || !city || disabled) return

    const map = mapRef.current
    const cityConfig = CITY_CONFIGS[city]
    if (!cityConfig) return

    // Zoom out to national first
    map.flyTo(map.getCenter(), USA_ZOOM, {
      animate: true,
      duration: 1.25,
    })

    const timeout = setTimeout(() => {
      map.flyTo(cityConfig.center, cityConfig.zoom ?? CITY_ZOOM, {
        animate: true,
        duration: 1.75,
      })
    }, 600)

    return () => clearTimeout(timeout)
  }, [mapRef, city, disabled])
}
