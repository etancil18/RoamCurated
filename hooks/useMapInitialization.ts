'use client'

import { useEffect, useState } from 'react'
import { Map as LeafletMap } from 'leaflet'

export function useMapInitialization(map: LeafletMap | null) {
  const [hasMounted, setHasMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  // ✅ Ensure this only runs on the client
  useEffect(() => {
    setHasMounted(true)
    const update = () => setIsDesktop(window.innerWidth >= 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!map || !hasMounted) return

    if (isDesktop) {
      map.scrollWheelZoom.enable()
      map.doubleClickZoom.enable()
    } else {
      map.scrollWheelZoom.disable()
      map.doubleClickZoom.disable()
    }

    map.dragging.enable()
    map.touchZoom.enable()
  }, [map, hasMounted, isDesktop])
}
