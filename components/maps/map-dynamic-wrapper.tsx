// map-dynamic-wrapper.tsx
'use client'

import dynamic from 'next/dynamic'
import React from 'react'

// ✅ MapCanvas dynamically imported, SSR disabled
export const MapCanvas = dynamic(
  () => import('@/components/maps/MapCanvas'),
  { ssr: false }
)

// ✅ MapCanvasSaved dynamically imported, SSR disabled
export const MapCanvasSaved = dynamic(
  () => import('@/components/maps/MapCanvasSaved'),
  { ssr: false }
)

export const CityOverviewMarkers = dynamic(
  () => import('@/components/maps/CityOverviewMarkers'),
  { ssr: false }
)

export const CrawlControl = dynamic(
  () => import('@/components/maps/CrawlControl'),
  { ssr: false }
)

export const LeafletSetup = dynamic(
  () => import('@/components/maps/LeafletSetup'),
  { ssr: false }
)

export const MapEffectController = dynamic(
  () => import('@/components/maps/MapEffectController'),
  { ssr: false }
)

export const RouteOverlay = dynamic(
  () => import('@/components/maps/RouteOverlay'),
  { ssr: false }
)

export const UserLocationMarker = dynamic(
  () => import('@/components/maps/UserLocationMarker'),
  { ssr: false }
)

export const VenueMarker = dynamic(
  () => import('@/components/maps/VenueMarker'),
  { ssr: false }
)

// ✅ Branded venue cluster marker, SSR disabled
export const VenueClusterMarker = dynamic(
  () => import('@/components/maps/VenueClusterMarker'),
  { ssr: false }
)

export const SponsorMapPreview = dynamic(
  () => import('app/sponsor-crawl/components/SponsorMapPreview'),
  { ssr: false }
)

export const RouteControl = dynamic(
  () => import('@/components/RouteControl'),
  { ssr: false }
)

export const RoutePolyline = dynamic(
  () => import('@/components/RoutePolyline'),
  { ssr: false }
)

export const SimpleMap = dynamic(
  () => import('@/components/Map'), // keep your filename
  { ssr: false }
)

// Add additional maps below as needed in future:
// export const SomeOtherMap = dynamic(() => import('...'), { ssr: false })