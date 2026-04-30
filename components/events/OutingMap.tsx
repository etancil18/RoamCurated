"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet"
import RouteControl from "@/components/RouteControl"
import { Button } from "@/components/ui/button"

import "leaflet/dist/leaflet.css"

type Anchor = {
  id: string | null
  title: string | null
  startsAt: string | null
  endsAt: string | null
  venue: {
    id: string | null
    name: string | null
    city: string | null
    lat: number | null
    lon: number | null
    address: string | null
    type?: string | null
  } | null
}

type Stop = {
  id: string
  venueId: string
  stopOrder: number
  role: string
  venueType: string | null
  displayType: string | null
  title: string | null
  rationale: string | null
  plannedArrivalAt: string | null
  plannedDepartureAt: string | null
  dwellMinutes: number | null
  travelMode: string | null
  travelMinutesFromPrev: number | null
  distanceMetersFromPrev: number | null
  venue: {
    id: string
    name: string | null
    city: string | null
    lat: number | null
    lon: number | null
    address: string | null
    type?: string | null
  } | null
}

type Props = {
  plannedOutingId: string
  eventId: string
  city: string
  mode: "before" | "after" | "full"
  status: string | null
  summary: string | null
  anchor: Anchor
  stops: Stop[]
}

type RouteVenue = {
  id: string
  name: string
  lat: number
  lon: number
  city: string
  link: string
}

function RoutingLayer({
  routeStops,
  anchorVenue,
  mode,
  travelMode,
}: {
  routeStops: RouteVenue[]
  anchorVenue: RouteVenue | null
  mode: "before" | "after" | "full"
  travelMode: "walking" | "driving"
}) {
  const map = useMap()

  if (!map || !anchorVenue || routeStops.length < 1) return null

  const route = buildDisplayRoute({
    mode,
    anchorVenue,
    routeStops,
  }).filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon))

  if (route.length < 2) return null

  return (
    <RouteControl
      map={map}
      route={route}
      travelMode={travelMode}
    />
  )
}

export default function OutingMap({
  plannedOutingId,
  eventId,
  city,
  mode,
  anchor,
  stops,
}: Props) {
  const router = useRouter()

  const [travelMode, setTravelMode] = useState<"walking" | "driving">("walking")
  const [orderedStops, setOrderedStops] = useState<Stop[]>(stops)
  const [shareFeedback, setShareFeedback] = useState("Share Route")

  useEffect(() => {
    setOrderedStops(stops)
  }, [stops])

  useEffect(() => {
    if (typeof window === "undefined") return

    const L = require("leaflet")

    delete (L.Icon.Default.prototype as any)._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
      iconUrl:
        "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
    })
  }, [])

  function anchorIcon() {
    const L = require("leaflet")

    return L.divIcon({
      className: "outing-anchor-marker",
      html: `
        <div style="
          background:#06b6d4;
          color:white;
          border-radius:999px;
          min-width:54px;
          height:28px;
          padding:0 10px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:700;
          font-size:11px;
          letter-spacing:.04em;
          border:2px solid white;
          box-shadow:0 0 4px rgba(0,0,0,0.4);
        ">
          EVENT
        </div>
      `,
      iconSize: [54, 28],
      iconAnchor: [27, 28],
    })
  }

  function numberedIcon(index: number) {
    const L = require("leaflet")

    return L.divIcon({
      className: "outing-stop-marker",
      html: `
        <div style="
          background:#22c55e;
          color:white;
          border-radius:50%;
          width:28px;
          height:28px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:600;
          font-size:13px;
          border:2px solid white;
          box-shadow:0 0 4px rgba(0,0,0,0.4);
        ">
          ${index}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    })
  }

  const anchorVenue = useMemo<RouteVenue | null>(() => {
    if (
      anchor.venue?.lat == null ||
      anchor.venue?.lon == null
    ) {
      return null
    }

    return {
      id: anchor.venue.id ?? "anchor-event",
      name: anchor.venue.name ?? anchor.title ?? "Event",
      lat: anchor.venue.lat,
      lon: anchor.venue.lon,
      city: anchor.venue.city ?? city,
      link: "#",
    }
  }, [anchor, city])

  const routeStops = useMemo<RouteVenue[]>(() => {
    return orderedStops
      .map((stop) => {
        if (stop.venue?.lat == null || stop.venue?.lon == null) return null

        return {
          id: stop.id,
          name: stop.title ?? stop.venue.name ?? `Stop ${stop.stopOrder}`,
          lat: stop.venue.lat,
          lon: stop.venue.lon,
          city: stop.venue.city ?? city,
          link: "#",
        }
      })
      .filter(Boolean) as RouteVenue[]
  }, [orderedStops, city])

  const center: [number, number] = anchorVenue
    ? [anchorVenue.lat, anchorVenue.lon]
    : routeStops[0]
    ? [routeStops[0].lat, routeStops[0].lon]
    : [0, 0]

  function moveStopUp(index: number) {
    if (index === 0) return

    setOrderedStops((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp

      return next.map((stop, i) => ({
        ...stop,
        stopOrder: i + 1,
      }))
    })
  }

  function moveStopDown(index: number) {
    if (index === orderedStops.length - 1) return

    setOrderedStops((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp

      return next.map((stop, i) => ({
        ...stop,
        stopOrder: i + 1,
      }))
    })
  }

  function openGoogleMaps() {
    if (!anchorVenue || routeStops.length === 0) return

    const route = buildDisplayRoute({
      mode,
      anchorVenue,
      routeStops,
    })

    if (route.length < 2) return

    const origin = route[0]
    const destination = route[route.length - 1]
    const waypoints = route
      .slice(1, -1)
      .map((v) => `${v.lat},${v.lon}`)
      .join("|")

    const url = new URL("https://www.google.com/maps/dir/")
    url.searchParams.set("api", "1")
    url.searchParams.set("origin", `${origin.lat},${origin.lon}`)
    url.searchParams.set("destination", `${destination.lat},${destination.lon}`)
    url.searchParams.set("travelmode", travelMode)

    if (waypoints) {
      url.searchParams.set("waypoints", waypoints)
    }

    window.open(url.toString(), "_blank")
  }

  function openAppleMaps() {
    if (!anchorVenue || routeStops.length === 0) return

    const route = buildDisplayRoute({
      mode,
      anchorVenue,
      routeStops,
    })

    if (route.length < 2) return

    const origin = route[0]
    const destination = route[route.length - 1]
    const dirFlag = travelMode === "driving" ? "d" : "w"

    const url =
      `https://maps.apple.com/?saddr=${origin.lat},${origin.lon}` +
      `&daddr=${destination.lat},${destination.lon}` +
      `&dirflg=${dirFlag}`

    window.open(url, "_blank")
  }

  async function shareRoute() {
    if (typeof window === "undefined") return

    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: anchor.title ?? "Outing Route",
          text: `Check out this outing route in ${city}.`,
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
      setShareFeedback("Link Copied")
      window.setTimeout(() => {
        setShareFeedback("Share Route")
      }, 1800)
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setShareFeedback("Link Copied")
        window.setTimeout(() => {
          setShareFeedback("Share Route")
        }, 1800)
      } catch {
        setShareFeedback("Unable to Share")
        window.setTimeout(() => {
          setShareFeedback("Share Route")
        }, 1800)
      }
    }
  }

  function goBackToEvent() {
    router.push(`/events`)
  }

  function formatStopMeta(stop: Stop): string {
    const parts: string[] = []

    if (stop.displayType || stop.venueType || stop.role) {
      parts.push(humanizeStopType(stop.displayType ?? stop.venueType ?? stop.role))
    }

    if (stop.plannedArrivalAt) {
      parts.push(
        `Arrive ${new Date(stop.plannedArrivalAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}`
      )
    }

    if (typeof stop.travelMinutesFromPrev === "number") {
      parts.push(`${stop.travelMinutesFromPrev} min from previous`)
    }

    return parts.join(" • ")
  }

  return (
    <div className="space-y-4">
      <div className="h-[420px] sm:h-[500px] rounded-xl overflow-hidden border border-border bg-card">
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CartoDB"
          />

          {anchorVenue && (
            <Marker
              position={[anchorVenue.lat, anchorVenue.lon]}
              icon={anchorIcon()}
            >
              <Tooltip>
                {anchor.title ?? "Event"}
                {anchorVenue.name ? ` • ${anchorVenue.name}` : ""}
              </Tooltip>
            </Marker>
          )}

          {orderedStops.map((stop, i) => {
            if (!hasValidCoordinates(stop.venue)) return null

            const lat = stop.venue.lat
            const lon = stop.venue.lon

            return (
              <Marker
                key={stop.id}
                position={[lat, lon]}
                icon={numberedIcon(i + 1)}
              >
                <Tooltip>
                  {i + 1}. {stop.title ?? stop.venue.name ?? "Stop"}
                </Tooltip>
              </Marker>
            )
          })}

          <RoutingLayer
            routeStops={routeStops}
            anchorVenue={anchorVenue}
            mode={mode}
            travelMode={travelMode}
          />
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant={travelMode === "walking" ? "default" : "outline"}
          onClick={() => setTravelMode("walking")}
          className="w-full"
        >
          Walking Route
        </Button>

        <Button
          variant={travelMode === "driving" ? "default" : "outline"}
          onClick={() => setTravelMode("driving")}
          className="w-full"
        >
          Driving Route
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            Route Stops
          </p>
          <p className="text-sm text-muted-foreground">
            Adjust the order of your preset stops before you head out.
          </p>
        </div>

        {anchorVenue && (
          <div className="rounded-lg border border-cyan-500/30 bg-background px-3 py-3">
            <p className="text-sm font-medium text-foreground">
              Event Anchor
            </p>
            <p className="text-sm text-foreground mt-1">
              {anchor.title ?? anchorVenue.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {anchorVenue.name}
              {anchor.venue?.address ? ` • ${anchor.venue.address}` : ""}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {orderedStops.map((stop, i) => (
            <div
              key={`${stop.id}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {i + 1}. {stop.title ?? stop.venue?.name ?? "Stop"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatStopMeta(stop)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moveStopUp(i)}
                  disabled={i === 0}
                >
                  ↑
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moveStopDown(i)}
                  disabled={i === orderedStops.length - 1}
                >
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 justify-items-center">
        <Button
          variant="outline"
          onClick={openGoogleMaps}
          disabled={!anchorVenue || routeStops.length === 0}
          className="w-full"
        >
          Open in Google Maps
        </Button>

        <Button
          variant="outline"
          onClick={openAppleMaps}
          disabled={!anchorVenue || routeStops.length === 0}
          className="w-full"
        >
          Open in Apple Maps
        </Button>

        <Button
          variant="secondary"
          onClick={goBackToEvent}
          className="w-full"
        >
          Back to Events
        </Button>
      </div>

      {orderedStops.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No mapped outing stops available yet.
        </div>
      )}

    </div>
  )
}

function buildDisplayRoute({
  mode,
  anchorVenue,
  routeStops,
}: {
  mode: "before" | "after" | "full"
  anchorVenue: RouteVenue
  routeStops: RouteVenue[]
}): RouteVenue[] {
  if (mode === "before") {
    return [...routeStops, anchorVenue]
  }

  if (mode === "after") {
    return [anchorVenue, ...routeStops]
  }

  if (routeStops.length === 0) {
    return [anchorVenue]
  }

  const [firstStop, ...remainingStops] = routeStops
  return [firstStop, anchorVenue, ...remainingStops]
}

function hasValidCoordinates(
  venue: Stop["venue"] | Anchor["venue"] | null | undefined
): venue is NonNullable<Stop["venue"]> & { lat: number; lon: number } {
  return (
    venue != null &&
    typeof venue.lat === "number" &&
    Number.isFinite(venue.lat) &&
    typeof venue.lon === "number" &&
    Number.isFinite(venue.lon)
  )
}

function humanizeStopType(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}