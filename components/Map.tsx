'use client'

// 🚨 Tripwire: fail immediately if this file is ever imported on the server
if (typeof window === 'undefined') {
  throw new Error(
    'Map.tsx was imported during SSR. This file MUST be loaded via next/dynamic({ ssr: false }).'
  )
}

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const position: [number, number] = [33.7490, -84.3880] // Atlanta coords

export default function Map() {
  return (
    <MapContainer
      center={position}
      zoom={13}
      scrollWheelZoom
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={position}>
        <Popup>
          Welcome to Roam ATL x NYC.
        </Popup>
      </Marker>
    </MapContainer>
  )
}
