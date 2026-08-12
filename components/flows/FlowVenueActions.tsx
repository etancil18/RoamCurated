'use client'

import VenueBookingButtons from '@/components/venue-profile/VenueBookingButtons'
import UberRideButton from '@/components/rideshare/UberRideButton'

type BookingOption = {
  provider: string
  url: string
}

type FlowVenue = {
  id: string
  name: string
  city?: string | null
  address?: string | null
  lat?: number | null
  lon?: number | null
  booking_options?: BookingOption[] | null
}

type Props = {
  venue: FlowVenue
  previousVenue?: FlowVenue | null
  travelMinutes?: number | null
  flowId?: string | null
  context?: 'active_flow' | 'hosted_flow'
  stopIndex?: number | null
  compact?: boolean
  showBookings?: boolean
  showRideshare?: boolean
  className?: string
}

export default function FlowVenueActions({
  venue,
  previousVenue = null,
  travelMinutes = null,
  flowId = null,
  context = 'hosted_flow',
  stopIndex = null,
  compact = true,
  showBookings = true,
  showRideshare = true,
  className = '',
}: Props) {
  const hasBookingOptions =
    Array.isArray(venue.booking_options) &&
    venue.booking_options.length > 0

  const showUber =
    showRideshare &&
    previousVenue &&
    typeof travelMinutes === 'number' &&
    travelMinutes > 5

  if (!showBookings && !showUber) return null
  if (!hasBookingOptions && !showUber) return null

  return (
    <div
      className={[
        'mt-3 space-y-3 border-t border-neutral-800 pt-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showBookings && hasBookingOptions && (
        <VenueBookingButtons
          bookingOptions={venue.booking_options ?? null}
          compact={compact}
        />
      )}

      {showUber && (
        <UberRideButton
          pickup={{
            name: previousVenue?.name ?? null,
            address:
              previousVenue?.address ??
              previousVenue?.city ??
              null,
            lat: previousVenue?.lat ?? null,
            lon: previousVenue?.lon ?? null,
          }}
          dropoff={{
            name: venue.name,
            address:
              venue.address ??
              venue.city ??
              null,
            lat: venue.lat ?? null,
            lon: venue.lon ?? null,
          }}
          travelMinutes={travelMinutes}
          fromVenueId={previousVenue?.id ?? null}
          toVenueId={venue.id}
          compact={compact}
          className="w-full"
          metadata={{
            ride_context: context,
            flow_id: flowId,
            stop_index: stopIndex,
            pickup_name:
              previousVenue?.name ??
              null,
            pickup_address:
              previousVenue?.address ??
              previousVenue?.city ??
              null,
            dropoff_name:
              venue.name,
            dropoff_address:
              venue.address ??
              venue.city ??
              null,
          }}
        />
      )}
    </div>
  )
}