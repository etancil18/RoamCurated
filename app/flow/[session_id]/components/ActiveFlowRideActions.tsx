'use client'

import UberRideButton from '@/components/rideshare/UberRideButton'
import { logEvent } from '@/lib/logEvent'

type Venue = {
  id: string
  name: string
  city?: string | null
  lat?: number | null
  lon?: number | null
  instagram_handle?: string | null
}

type ProgressRow = {
  venue_id: string
}

type Props = {
  sessionId: string
  venues: Venue[]
  progress: ProgressRow[]
}

export default function ActiveFlowRideActions({
  sessionId,
  venues,
  progress,
}: Props) {
  const checkedVenueIds = new Set(progress.map((row) => row.venue_id))

  const currentVenue =
    venues.find((venue) => !checkedVenueIds.has(venue.id)) ?? null

  if (!currentVenue) return null

  if (
    typeof currentVenue.lat !== 'number' ||
    typeof currentVenue.lon !== 'number'
  ) {
    return null
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-white">
          Need a ride?
        </p>

        <p className="text-xs text-neutral-400">
          Open Uber to get to your current flow stop.
        </p>
      </div>

      <UberRideButton
        pickup={null}
        dropoff={{
          name: currentVenue.name,
          address: currentVenue.city ?? null,
          lat: currentVenue.lat,
          lon: currentVenue.lon,
        }}
        travelMinutes={5}
        fromVenueId={null}
        toVenueId={currentVenue.id}
        compact
        className="w-full"
        metadata={{
          ride_context: 'active_flow_current_stop',
          active_flow_session_id: sessionId,
          destination_name: currentVenue.name,
        }}
      />
    </div>
  )
}