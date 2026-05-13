// app/api/property/crawl/route-polyline/route.ts

import { NextResponse } from "next/server"
import {
  buildRouteVenueFromCoordinates,
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
  travelMode?: TravelMode
  stops?: RoutePointInput[]
}

type RouteCoordinate = {
  lat: number
  lon: number
}

export async function POST(req: Request) {
  try {
    const body = (await safeJson(req)) as RoutePolylineRequestBody
    const travelMode = normalizeTravelMode(body.travelMode)

    const orderedPoints = (body.stops ?? [])
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

    if (orderedPoints.length < 2) {
      return NextResponse.json(
        {
          error: "At least two valid crawl stops are required to build the route polyline",
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
      travelMode,
      orderedPoints,
      routeLine,
      source: mapboxRoute.length >= 2 ? "mapbox" : "fallback",
    })
  } catch (error) {
    console.error("property crawl route-polyline POST error:", error)

    return NextResponse.json(
      {
        error: "Failed to build property crawl route polyline",
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
  const token =
    process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN

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
    console.warn("Property crawl Mapbox route fetch failed:", res.status, await res.text())
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

function normalizeTravelMode(value?: string | null): TravelMode {
  return value === "driving" ? "driving" : "walking"
}