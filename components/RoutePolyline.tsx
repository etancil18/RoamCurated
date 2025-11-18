'use client'

import { Polyline } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'

export default function RoutePolyline({
  coords,
  color,
}: {
  coords: LatLngExpression[]
  color: string
}) {
  return (
    <Polyline
      positions={coords}
      pathOptions={{ color, weight: 5, opacity: 0.9 }}
    />
  )
}
