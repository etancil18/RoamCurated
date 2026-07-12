'use client'

// 🚨 Tripwire — this file must never be evaluated during SSR
if (typeof window === 'undefined') {
  throw new Error(
    'RoutePolyline.tsx must only be imported via a client-only Leaflet boundary.'
  )
}

import type { ReactNode } from 'react'
import type { LatLngExpression } from 'leaflet'

type RoutePolylineRenderProps = {
  positions: LatLngExpression[]
  color: string
}

type RoutePolylineProps = {
  coords: LatLngExpression[]
  color: string
  render: (
    props: RoutePolylineRenderProps
  ) => ReactNode
}

function hasRenderableCoordinates(
  coords: LatLngExpression[]
): boolean {
  return coords.length > 0
}

export default function RoutePolyline({
  coords,
  color,
  render,
}: RoutePolylineProps) {
  if (!hasRenderableCoordinates(coords)) {
    return null
  }

  return render({
    positions: coords,
    color,
  })
}