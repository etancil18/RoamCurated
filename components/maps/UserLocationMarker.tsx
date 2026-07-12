'use client'

import { Marker, Popup } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { DivIcon } from 'leaflet'

import { getUserLocationIcon } from '@/lib/maps/icons'

type Props = {
  position: [number, number] | null

  /**
   * Optional initiative-ready visual inputs.
   *
   * Existing callers require no changes.
   */
  following?: boolean
  markerScale?: number
}

export default function UserLocationMarker({
  position,
  following = false,
  markerScale = 1,
}: Props) {
  const [icon, setIcon] = useState<DivIcon | null>(null)

  useEffect(() => {
    let active = true

    void getUserLocationIcon({
      following,
      scale: markerScale,
      interactive: true,
    })
      .then((nextIcon) => {
        if (active) {
          setIcon(nextIcon)
        }
      })
      .catch((error: unknown) => {
        if (
          active &&
          process.env.NODE_ENV === 'development'
        ) {
          console.error(
            '[UserLocationMarker] Failed to create user-location icon',
            error
          )
        }
      })

    return () => {
      active = false
    }
  }, [following, markerScale])

  if (!position || !icon) return null

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={700}
    >
      <Popup>You are here</Popup>
    </Marker>
  )
}