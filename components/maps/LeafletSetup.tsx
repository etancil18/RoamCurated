'use client'

import { useEffect } from 'react'

export default function LeafletSetup() {
  useEffect(() => {
    let isMounted = true

    async function setupLeaflet() {
      if (typeof window === 'undefined') return

      const L = (await import('leaflet')).default

      if (!isMounted) return

      delete (L.Icon.Default.prototype as any)._getIconUrl

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
    }

    setupLeaflet()

    return () => {
      isMounted = false
    }
  }, [])

  return null
}
