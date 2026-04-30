// lib/outings/buildDisplayRoute.ts

export type DisplayRouteMode = "before" | "after" | "full"

export type DisplayRouteVenue = {
  id: string
  name: string
  lat: number
  lon: number
  city?: string | null
  link?: string | null
}

export function buildDisplayRoute({
  mode,
  anchorVenue,
  routeStops,
}: {
  mode: DisplayRouteMode
  anchorVenue: DisplayRouteVenue
  routeStops: DisplayRouteVenue[]
}): DisplayRouteVenue[] {
  const validAnchor = hasValidRouteVenue(anchorVenue) ? anchorVenue : null
  const validStops = routeStops.filter(hasValidRouteVenue)

  if (!validAnchor) {
    return validStops
  }

  if (mode === "before") {
    return [...validStops, validAnchor]
  }

  if (mode === "after") {
    return [validAnchor, ...validStops]
  }

  if (validStops.length === 0) {
    return [validAnchor]
  }

  const [firstStop, ...remainingStops] = validStops
  return [firstStop, validAnchor, ...remainingStops]
}

export function hasValidRouteVenue(
  venue: DisplayRouteVenue | null | undefined
): venue is DisplayRouteVenue {
  return (
    venue != null &&
    typeof venue.id === "string" &&
    venue.id.length > 0 &&
    typeof venue.name === "string" &&
    venue.name.length > 0 &&
    typeof venue.lat === "number" &&
    Number.isFinite(venue.lat) &&
    typeof venue.lon === "number" &&
    Number.isFinite(venue.lon)
  )
}

export function buildRouteVenueFromCoordinates({
  id,
  name,
  lat,
  lon,
  city = null,
  link = "#",
}: {
  id?: string | null
  name?: string | null
  lat?: number | null
  lon?: number | null
  city?: string | null
  link?: string | null
}): DisplayRouteVenue | null {
  if (
    !id ||
    !name ||
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lon !== "number" ||
    !Number.isFinite(lon)
  ) {
    return null
  }

  return {
    id,
    name,
    lat,
    lon,
    city,
    link,
  }
}