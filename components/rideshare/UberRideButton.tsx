// components/rideshare/UberRideButton.tsx

"use client"

import { logEvent } from "@/lib/logEvent"
import {
  buildUberRideUrl,
  shouldShowUberRideButton,
  type UberRidePoint,
} from "@/lib/rideshare/uber"

type UberRideButtonProps = {
  pickup: UberRidePoint
  dropoff: UberRidePoint
  travelMinutes?: number | null

  plannedOutingId?: string | null
  eventId?: string | null

  fromVenueId?: string | null
  toVenueId?: string | null

  className?: string
  compact?: boolean
}

export default function UberRideButton({
  pickup,
  dropoff,
  travelMinutes,
  plannedOutingId = null,
  eventId = null,
  fromVenueId = null,
  toVenueId = null,
  className = "",
  compact = false,
}: UberRideButtonProps) {
  if (!shouldShowUberRideButton(travelMinutes)) {
    return null
  }

  const uberUrl = buildUberRideUrl({
    pickup,
    dropoff,
  })

  if (!uberUrl) {
    return null
  }

  const handleClick = () => {
    try {
      void Promise.resolve(
        logEvent("outing_uber_clicked", {
  metadata: {
    planned_outing_id: plannedOutingId,
    event_id: eventId,
    from_venue_id: fromVenueId,
    to_venue_id: toVenueId,
    travel_minutes: travelMinutes ?? null,
    pickup_name: pickup.name ?? null,
    dropoff_name: dropoff.name ?? null,
  },
})
      )
    } catch (error) {
      console.warn("Failed to log outing_uber_clicked", error)
    }
  }

  return (
    <a
      href={uberUrl}
      target="_blank"
      rel="noreferrer noopener"
      onClick={handleClick}
      aria-label={`Open Uber route from ${
        pickup.name ?? "pickup"
      } to ${dropoff.name ?? "destination"}`}
      className={[
        "inline-flex items-center justify-center rounded-lg border border-black bg-black font-medium text-white transition hover:bg-neutral-800",
        compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="mr-2">🚕</span>
      Ride Here
      {typeof travelMinutes === "number" ? (
        <span className="ml-2 text-white/70">
          · {Math.round(travelMinutes)} min
        </span>
      ) : null}
    </a>
  )
}