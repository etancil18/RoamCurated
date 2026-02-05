'use client';

import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

type Props = {
  position: [number, number] | null
}

const userLocationIcon = L.divIcon({
  className: 'custom-dot-marker',
  iconSize: [12, 12],
  html: `<div style="
    width:12px; height:12px; border-radius:50%;
    background-color:rgba(0, 255, 255, 0.9);
    box-shadow:0 0 4px rgba(0,255,255,0.75);
    border: 2px solid white;
  "></div>`,
})

export default function UserLocationMarker({ position }: Props) {
  if (!position) return null

  return (
    <Marker position={position} icon={userLocationIcon}>
      <Popup>You are here</Popup>
    </Marker>
  )
}
