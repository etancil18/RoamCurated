'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const MapCanvas = dynamic(() => import('@/components/maps/MapCanvas'), {
  ssr: false,
})

export default function MapPage() {
  return (
    <main className="h-screen w-screen">
      <Suspense fallback={<div className="text-center p-4">Loading map...</div>}>
        <MapCanvas
          travelMode="walking"
          showLiveEventsOnly={false}
        />
      </Suspense>
    </main>
  )
}
