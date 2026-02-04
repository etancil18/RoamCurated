'use client'

import { useEffect } from 'react'
import { Map as LeafletMap } from 'leaflet'

/**
 * Applies initial map behaviors like scroll, drag, and zoom controls
 * based on device size or UX rules
 */
export function useMapInitialization(map: LeafletMap | null) {
  useEffect(() => {
    if (!map) return

    const applyControls = () => {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

      // Enable everything by default
      const controls = {
        scroll: isDesktop,
        drag: true,
        touch: true,
        doubleClick: isDesktop,
      }

      // Only set controls if they differ from current state
      controls.scroll
        ? map.scrollWheelZoom.enable()
        : map.scrollWheelZoom.disable()

      controls.drag
        ? map.dragging.enable()
        : map.dragging.disable()

      controls.touch
        ? map.touchZoom.enable()
        : map.touchZoom.disable()

      controls.doubleClick
        ? map.doubleClickZoom.enable()
        : map.doubleClickZoom.disable()
    }

    applyControls()

    // Debounced resize listener to re-apply controls on window size change
    let resizeTimeout: number
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(applyControls, 200)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [map])
}
