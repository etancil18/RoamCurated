'use client'

import { MapCanvas } from '@/components/maps/map-dynamic-wrapper'
import { Suspense } from 'react'

export default function MapPage() {
  return (
    <main className="h-screen w-screen">
      <Suspense fallback={<div className="text-center p-4">Loading map...</div>}>
        <MapCanvas travelMode="walking" showLiveEventsOnly={false} />
      </Suspense>
    </main>
  )
}
