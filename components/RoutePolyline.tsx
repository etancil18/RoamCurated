'use client'

// 🚨 Tripwire — this file must never be evaluated during SSR
if (typeof window === 'undefined') {
  throw new Error(
    'RoutePolyline.tsx must only be imported via a client-only Leaflet boundary.'
  )
}

import type React from 'react'
import type { LatLngExpression } from 'leaflet'

type RoutePolylineProps = {
  coords: LatLngExpression[]
  color: string
  render: (props: {
    positions: LatLngExpression[]
    color: string
  }) => React.ReactNode
}

export default function RoutePolyline({
  coords,
  color,
  render,
}: RoutePolylineProps) {
  if (coords.length === 0) return null

  return render({
    positions: coords,
    color,
  })
}
