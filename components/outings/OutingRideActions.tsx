"use client"

import { useEffect } from "react"

import UberRideButton from "@/components/rideshare/UberRideButton"
import { logEvent } from "@/lib/logEvent"

type OutingRideStop = {
  id: string
  venueId: string
  title: string
  address: string | null
  lat: number | null
  lon: number | null
  travelMinutesFromPrev: number | null
}

type Props = {
  plannedOutingId: string
  eventId: string
  stops: OutingRideStop[]
}

export default function OutingRideActions({
  plannedOutingId,
  eventId,
  stops,
}: Props) {
  const rideSegments = stops
    .map((stop, index) => {
      const previousStop = index > 0 ? stops[index - 1] : null
      if (!previousStop) return null

      return {
        from: previousStop,
        to: stop,
      }
    })
    .filter(Boolean) as Array<{
    from: OutingRideStop
    to: OutingRideStop
  }>

  useEffect(() => {
    if (rideSegments.length === 0) return

    try {
      void Promise.resolve(
        logEvent("outing_ride_options_viewed", {
          metadata: {
            planned_outing_id: plannedOutingId,
            event_id: eventId,
            eligible_ride_segments: rideSegments.length,
            segments: rideSegments.map(({ from, to }) => ({
              from_venue_id: from.venueId,
              to_venue_id: to.venueId,
              from_title: from.title,
              to_title: to.title,
              travel_minutes: to.travelMinutesFromPrev ?? null,
            })),
          },
        })
      )
    } catch (error) {
      console.warn("Failed to log outing_ride_options_viewed", error)
    }
  }, [rideSegments, plannedOutingId, eventId])

  if (rideSegments.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <p className="font-medium text-foreground">Ride options</p>
        <p className="text-sm text-muted-foreground">
          Uber appears for route legs over 12 minutes with valid coordinates.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {rideSegments.map(({ from, to }) => (
          <div
            key={`${from.id}-${to.id}`}
            className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {from.title} → {to.title}
              </p>

              {to.travelMinutesFromPrev != null ? (
                <p className="text-xs text-muted-foreground">
                  {to.travelMinutesFromPrev} min from previous
                </p>
              ) : null}
            </div>

            <UberRideButton
              pickup={{
                name: from.title,
                address: from.address,
                lat: from.lat,
                lon: from.lon,
              }}
              dropoff={{
                name: to.title,
                address: to.address,
                lat: to.lat,
                lon: to.lon,
              }}
              travelMinutes={to.travelMinutesFromPrev}
              plannedOutingId={plannedOutingId}
              eventId={eventId}
              fromVenueId={from.venueId}
              toVenueId={to.venueId}
              compact
            />
          </div>
        ))}
      </div>
    </section>
  )
}