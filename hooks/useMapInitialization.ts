'use client'

import { useEffect, useState } from 'react'
import { Map as LeafletMap } from 'leaflet'

export function useMapInitialization(map: LeafletMap | null) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // ✅ Guard for SSR
    if (typeof window === 'undefined') return

    const update = () => setIsDesktop(window.innerWidth >= 768)
    update()

    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!map) return

    // ✅ Do not assume window APIs are always available
    // Assume `isDesktop` is false by default
    if (isDesktop) {
      map.scrollWheelZoom.enable()
      map.doubleClickZoom.enable()
    } else {
      map.scrollWheelZoom.disable()
      map.doubleClickZoom.disable()
    }

    map.dragging.enable()
    map.touchZoom.enable()
  }, [map, isDesktop])
}
