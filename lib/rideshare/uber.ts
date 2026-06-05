// lib/rideshare/uber.ts

export type UberRidePoint = {
  name?: string | null
  address?: string | null
  lat?: number | null
  lon?: number | null
}

type BuildUberRideUrlInput = {
  pickup: UberRidePoint | null
  dropoff: UberRidePoint
}

const UBER_BASE_URL = "https://m.uber.com/ul/"

export function buildUberRideUrl({
  pickup,
  dropoff,
}: BuildUberRideUrlInput): string | null {
  if (
    typeof dropoff.lat !== "number" ||
    typeof dropoff.lon !== "number"
  ) {
    return null
  }

  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID?.trim()

  if (!clientId) {
    console.warn(
      "Missing NEXT_PUBLIC_UBER_CLIENT_ID environment variable"
    )

    return null
  }

  const url = new URL(UBER_BASE_URL)

  url.searchParams.set("action", "setPickup")
  url.searchParams.set("client_id", clientId)

  // Pickup
  // If pickup is omitted, Uber uses the rider's live/current location.
  if (
    pickup &&
    typeof pickup.lat === "number" &&
    typeof pickup.lon === "number"
  ) {
    url.searchParams.set("pickup[latitude]", String(pickup.lat))
    url.searchParams.set("pickup[longitude]", String(pickup.lon))

    if (pickup.name) {
      url.searchParams.set("pickup[nickname]", pickup.name)
    }

    if (pickup.address) {
      url.searchParams.set(
        "pickup[formatted_address]",
        pickup.address
      )
    }
  } else {
    url.searchParams.set("pickup", "my_location")
  }

  // Dropoff
  url.searchParams.set("dropoff[latitude]", String(dropoff.lat))
  url.searchParams.set("dropoff[longitude]", String(dropoff.lon))

  if (dropoff.name) {
    url.searchParams.set("dropoff[nickname]", dropoff.name)
  }

  if (dropoff.address) {
    url.searchParams.set(
      "dropoff[formatted_address]",
      dropoff.address
    )
  }

  return url.toString()
}

export function shouldShowUberRideButton(
  travelMinutes?: number | null
): boolean {
  if (!Number.isFinite(travelMinutes)) return false

  return Number(travelMinutes) > 5
}