// app/api/outings/[outingId]/route-polyline/route.ts

import { NextResponse } from "next/server"
import {
  buildDisplayRoute,
  buildRouteVenueFromCoordinates,
  type DisplayRouteMode,
  type DisplayRouteVenue,
} from "@/lib/outings/buildDisplayRoute"

type TravelMode = "walking" | "driving"

type RoutePointInput = {
  id?: string | null
  name?: string | null
  lat?: number | null
  lon?: number | null
  city?: string | null
  link?: string | null
}

type RoutePolylineRequestBody = {
  mode?: DisplayRouteMode
  travelMode?: TravelMode
  anchorVenue?: RoutePointInput | null
  stops?: RoutePointInput[]
}

type RouteCoordinate = {
  lat: number
  lon: number
}

export async function POST(
  req: Request,
  context: { params: Promise<{ outingId: string }> }
) {
  const { outingId } = await context.params

  try {
    const body = (await safeJson(req)) as RoutePolylineRequestBody

    const mode = normalizeMode(body.mode)
    const travelMode = normalizeTravelMode(body.travelMode)

    const anchorVenue = buildRouteVenueFromCoordinates({
      id: body.anchorVenue?.id ?? "anchor-event",
      name: body.anchorVenue?.name ?? "Event",
      lat: body.anchorVenue?.lat ?? null,
      lon: body.anchorVenue?.lon ?? null,
      city: body.anchorVenue?.city ?? null,
      link: body.anchorVenue?.link ?? "#",
    })

    const routeStops = (body.stops ?? [])
      .map((stop, index) =>
        buildRouteVenueFromCoordinates({
          id: stop.id ?? `stop-${index + 1}`,
          name: stop.name ?? `Stop ${index + 1}`,
          lat: stop.lat ?? null,
          lon: stop.lon ?? null,
          city: stop.city ?? null,
          link: stop.link ?? "#",
        })
      )
      .filter((stop): stop is DisplayRouteVenue => stop != null)

    if (!anchorVenue) {
      return NextResponse.json(
        {
          error: "A valid event anchor venue is required to build the route polyline",
          outingId,
        },
        { status: 422 }
      )
    }

    if (routeStops.length < 1) {
      return NextResponse.json(
        {
          error: "At least one valid stop is required to build the route polyline",
          outingId,
        },
        { status: 422 }
      )
    }

    const orderedPoints = buildDisplayRoute({
      mode,
      anchorVenue,
      routeStops,
    })

    if (orderedPoints.length < 2) {
      return NextResponse.json(
        {
          error: "At least two valid ordered route points are required",
          outingId,
          orderedPoints,
        },
        { status: 422 }
      )
    }

    const mapboxRoute = await fetchMapboxRoute({
      orderedPoints,
      travelMode,
    })

    const routeLine =
      mapboxRoute.length >= 2
        ? mapboxRoute
        : orderedPoints.map((point) => ({
            lat: point.lat,
            lon: point.lon,
          }))

    return NextResponse.json({
      success: true,
      outingId,
      mode,
      travelMode,
      orderedPoints,
      routeLine,
      source: mapboxRoute.length >= 2 ? "mapbox" : "fallback",
    })
  } catch (error) {
    console.error("route-polyline POST error:", error)

    return NextResponse.json(
      {
        error: "Failed to build route polyline",
        outingId,
      },
      { status: 500 }
    )
  }
}

async function fetchMapboxRoute({
  orderedPoints,
  travelMode,
}: {
  orderedPoints: DisplayRouteVenue[]
  travelMode: TravelMode
}): Promise<RouteCoordinate[]> {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) return []

  const profile = travelMode === "driving" ? "driving" : "walking"

  const coordinates = orderedPoints
    .map((point) => `${point.lon},${point.lat}`)
    .join(";")

  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`
  )

  url.searchParams.set("geometries", "geojson")
  url.searchParams.set("overview", "full")
  url.searchParams.set("steps", "false")
  url.searchParams.set("access_token", token)

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  })

  if (!res.ok) {
    console.warn("Mapbox route fetch failed:", res.status, await res.text())
    return []
  }

  const data = (await res.json().catch(() => null)) as
    | {
        routes?: Array<{
          geometry?: {
            coordinates?: Array<[number, number]>
          }
        }>
      }
    | null

  const coordinatesResult = data?.routes?.[0]?.geometry?.coordinates

  if (!Array.isArray(coordinatesResult)) return []

  return coordinatesResult
    .map(([lon, lat]) => ({
      lat,
      lon,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lon)
    )
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function normalizeMode(mode?: string | null): DisplayRouteMode {
  if (mode === "before" || mode === "after" || mode === "full") return mode
  return "full"
}

function normalizeTravelMode(value?: string | null): TravelMode {
  return value === "driving" ? "driving" : "walking"
}