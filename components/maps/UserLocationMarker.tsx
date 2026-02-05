'use client'

import { Marker, Popup } from 'react-leaflet'
import { useMemo } from 'react'
import type { DivIcon } from 'leaflet'

type Props = {
  position: [number, number] | null
}

export default function UserLocationMarker({ position }: Props) {
  const icon = useMemo<DivIcon | null>(() => {
    if (typeof window === 'undefined') return null

    // ⛑️ Import Leaflet ONLY on the client
    const L = require('leaflet')

    return L.divIcon({
      className: 'custom-dot-marker',
      iconSize: [12, 12],
      html: `
        <div style="
          width:12px;
          height:12px;
          border-radius:50%;
          background-color:rgba(0, 255, 255, 0.9);
          box-shadow:0 0 4px rgba(0,255,255,0.75);
          border: 2px solid white;
        "></div>
      `,
    })
  }, [])

  if (!position || !icon) return null

  return (
    <Marker position={position} icon={icon}>
      <Popup>You are here</Popup>
    </Marker>
  )
}
