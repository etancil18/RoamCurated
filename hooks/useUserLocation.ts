'use client'

import { useEffect, useState } from 'react'

type Position = [number, number]

type UseUserLocationOptions = {
  fallback?: Position
  enabled?: boolean
}

/**
 * Handles geolocation logic and fallback to city center if unavailable
 */
export function useUserLocation(options: UseUserLocationOptions = {}) {
  const { fallback = [37.8, -96.9], enabled = true } = options

  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (!navigator.geolocation) {
      console.warn('[useUserLocation] Geolocation not supported')
      setPosition(fallback)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude])
      },
      (err) => {
        console.warn('[useUserLocation] Error:', err)
        setPosition(fallback)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }, [enabled, fallback])

  return position
}
