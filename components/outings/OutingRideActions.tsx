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
  const firstStop = stops[0] ?? null

  const routeStartSegment = firstStop
    ? {
        from: null,
        to: firstStop,
        kind: "route_start" as const,
      }
    : null

  const interstopRideSegments = stops
    .map((stop, index) => {
      const previousStop = index > 0 ? stops[index - 1] : null
      if (!previousStop) return null

      return {
        from: previousStop,
        to: stop,
        kind: "interstop" as const,
      }
    })
    .filter(Boolean) as Array<{
    from: OutingRideStop
    to: OutingRideStop
    kind: "interstop"
  }>

  const rideSegments = [
    ...(routeStartSegment ? [routeStartSegment] : []),
    ...interstopRideSegments,
  ]

  useEffect(() => {
    if (rideSegments.length === 0) return

    try {
      void Promise.resolve(
        logEvent("outing_ride_options_viewed", {
          metadata: {
            planned_outing_id: plannedOutingId,
            event_id: eventId,
            eligible_ride_segments: rideSegments.length,
            has_route_start_ride: Boolean(routeStartSegment),
            segments: rideSegments.map((segment) => ({
              kind: segment.kind,
              from_venue_id: segment.from?.venueId ?? null,
              to_venue_id: segment.to.venueId,
              from_title: segment.from?.title ?? null,
              to_title: segment.to.title,
              travel_minutes: segment.to.travelMinutesFromPrev ?? null,
            })),
          },
        })
      )
    } catch (error) {
      console.warn("Failed to log outing_ride_options_viewed", error)
    }
  }, [rideSegments, routeStartSegment, plannedOutingId, eventId])

  if (rideSegments.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <p className="font-medium text-foreground">Ride options</p>
        <p className="text-sm text-muted-foreground">
          Open Uber to start your itinerary or move between stops.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {rideSegments.map((segment) => {
          const { from, to, kind } = segment
          const isRouteStart = kind === "route_start"

          return (
            <div
              key={isRouteStart ? `route-start-${to.id}` : `${from?.id}-${to.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {isRouteStart
                    ? `Ride to first stop: ${to.title}`
                    : `${from?.title} → ${to.title}`}
                </p>

                <p className="text-xs text-muted-foreground">
                  {isRouteStart
                    ? "Uber will use your current location as pickup."
                    : to.travelMinutesFromPrev != null
                    ? `${to.travelMinutesFromPrev} min from previous`
                    : "Ride between itinerary stops"}
                </p>
              </div>

              <UberRideButton
                pickup={
                  isRouteStart
                    ? null
                    : {
                        name: from.title,
                        address: from.address,
                        lat: from.lat,
                        lon: from.lon,
                      }
                }
                dropoff={{
                  name: to.title,
                  address: to.address,
                  lat: to.lat,
                  lon: to.lon,
                }}
                travelMinutes={isRouteStart ? 8 : to.travelMinutesFromPrev}
                plannedOutingId={plannedOutingId}
                eventId={eventId}
                fromVenueId={from?.venueId ?? null}
                toVenueId={to.venueId}
                compact
                metadata={{
                  ride_context: isRouteStart ? "route_start" : "interstop",
                  route_started_signal: isRouteStart,
                }}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}