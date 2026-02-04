'use client'

import { useEffect, useState } from 'react'
import { Map as LeafletMap } from 'leaflet'

export function useMapInitialization(map: LeafletMap | null) {
  const [isDesktop, setIsDesktop] = useState(false)

  // ✅ Safe window usage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDesktop(window.innerWidth >= 768)

      const handleResize = () => {
        setIsDesktop(window.innerWidth >= 768)
      }

      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!map) return

    // Enable/disable controls based on device
    isDesktop ? map.scrollWheelZoom.enable() : map.scrollWheelZoom.disable()
    map.dragging.enable()
    map.touchZoom.enable()
    isDesktop ? map.doubleClickZoom.enable() : map.doubleClickZoom.disable()
  }, [map, isDesktop])
}
