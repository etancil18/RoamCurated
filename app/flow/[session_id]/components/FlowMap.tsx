'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

type Venue = {
  id: string
  name: string
  city?: string | null
  lat?: number | null
  lon?: number | null
  instagram_handle?: string | null
}

type Props = {
  venues: Venue[]
  completedVenueIds?: string[]
  currentVenueId?: string | null
  heightPx?: number
  travelMode?: 'walking' | 'cycling' | 'driving'
}

const SponsorMapPreview = dynamic(
  () => import('@/app/sponsor-crawl/components/SponsorMapPreview'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-sm text-neutral-400">
        Loading flow map…
      </div>
    ),
  }
)

export default function FlowMap({
  venues,
  completedVenueIds = [],
  currentVenueId = null,
  heightPx = 280,
  travelMode = 'walking',
}: Props) {
  const validVenues = useMemo(() => {
    return venues
      .filter((venue) => {
        return (
          venue.id &&
          typeof venue.lat === 'number' &&
          typeof venue.lon === 'number'
        )
      })
      .map((venue) => ({
        id: venue.id,
        name: venue.name,
        city: venue.city ?? '',
        lat: venue.lat ?? 0,
        lon: venue.lon ?? 0,
        instagram_handle: venue.instagram_handle ?? null,
      }))
  }, [venues])

  const completedCount = completedVenueIds.length
  const totalCount = validVenues.length
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const currentVenue = useMemo(() => {
    if (!currentVenueId) return null
    return validVenues.find((venue) => venue.id === currentVenueId) ?? null
  }, [currentVenueId, validVenues])

  if (validVenues.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
        Flow map unavailable. This flow is missing venue coordinates.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
            Flow Map
          </p>

          <p className="mt-1 text-sm text-neutral-400">
            {completedCount} of {totalCount} stops checked in
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Mode: {travelMode}
          </p>

          {currentVenue && (
            <p className="mt-1 text-xs text-neutral-500">
              Current stop: {currentVenue.name}
            </p>
          )}
        </div>

        <div className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-300">
          {progressPercent}%
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <SponsorMapPreview
        venues={validVenues}
        useStreetPolyline
        travelMode={travelMode}
        heightPx={heightPx}
      />
    </div>
  )
}