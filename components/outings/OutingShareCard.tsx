// components/outings/OutingShareCard.tsx

"use client"

type RouteLinePoint = {
  lat: number
  lon: number
}

type OutingShareAnchorVenue = {
  id?: string | null
  name?: string | null
  title?: string | null
  lat?: number | null
  lon?: number | null
  city?: string | null
}

type OutingShareStop = {
  id: string
  venueId?: string | null
  stopOrder: number
  role: string
  title: string | null
  displayType?: string | null
  venueType?: string | null
  plannedArrivalAt?: string | null
  plannedDepartureAt?: string | null
  lat?: number | null
  lon?: number | null
}

type Props = {
  city?: string | null
  mode: "before" | "after" | "full"
  summary?: string | null
  anchorTitle?: string | null
  anchorVenue?: OutingShareAnchorVenue | null
  eventStartsAt?: string | null
  stops: OutingShareStop[]
  routeLine?: RouteLinePoint[]
}

type RoutePoint = {
  id: string
  label: string
  x: number
  y: number
  stopOrder: number | "EVENT"
  kind: "stop" | "event"
}

export default function OutingShareCard({
  city = null,
  mode,
  summary = null,
  anchorTitle = null,
  anchorVenue = null,
  eventStartsAt = null,
  stops,
  routeLine = [],
}: Props) {
  const routeLabel = buildRouteLabel(stops)
  const dateLabel = eventStartsAt ? formatDate(eventStartsAt) : null
  const plottedRoute = buildPlottedRoute({
    mode,
    stops: stops.slice(0, 5),
    anchorVenue,
    routeLine,
  })

  return (
    <div
      className="relative flex h-[1920px] w-[1080px] overflow-hidden bg-neutral-950 text-white"
      style={{
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.28),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.25),_transparent_35%)]" />

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-20">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-4xl font-black tracking-tight">Roam</p>
            <p className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-2xl font-semibold uppercase tracking-[0.2em] text-cyan-200">
              {humanizeMode(mode)}
            </p>
          </div>

          <div className="mt-28">
            <p className="text-3xl font-semibold uppercase tracking-[0.28em] text-cyan-300">
              {city ? city.toUpperCase() : "Night Plan"}
            </p>

            <h1 className="mt-8 text-7xl font-black leading-[0.98] tracking-tight">
              {anchorTitle ?? "Your Roam Itinerary"}
            </h1>

            {dateLabel ? (
              <p className="mt-8 text-3xl font-medium text-neutral-300">
                {dateLabel}
              </p>
            ) : null}

            {summary ? (
              <p className="mt-10 max-w-[860px] text-3xl leading-snug text-neutral-300">
                {summary}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[3rem] border border-white/10 bg-black/35 p-10 shadow-2xl backdrop-blur">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-3xl font-bold">Route</p>
            <p className="rounded-full bg-cyan-500/20 px-5 py-2 text-2xl font-semibold text-cyan-200">
              {stops.length} stop{stops.length === 1 ? "" : "s"}
            </p>
          </div>

          {plottedRoute.routePoints.length >= 2 ? (
            <div className="mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/70 p-4">
              <svg
                viewBox="0 0 860 360"
                className="h-[360px] w-full"
                role="img"
                aria-label="Route line connecting itinerary stops and event"
              >
                <defs>
                  <linearGradient id="routeLineGradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <filter id="routeGlow">
                    <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <rect
                  x="0"
                  y="0"
                  width="860"
                  height="360"
                  rx="34"
                  fill="rgba(15,23,42,0.72)"
                />

                <polyline
                  points={plottedRoute.routeLinePoints
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  fill="none"
                  stroke="url(#routeLineGradient)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#routeGlow)"
                />

                {plottedRoute.routePoints
                  .filter((point) => point.kind === "stop")
                  .map((point) => (
                    <g key={point.id}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="27"
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth="6"
                      />
                      <text
                        x={point.x}
                        y={point.y + 9}
                        textAnchor="middle"
                        fontSize="28"
                        fontWeight="900"
                        fill="white"
                      >
                        {point.stopOrder}
                      </text>
                    </g>
                  ))}

                {plottedRoute.routePoints
                  .filter((point) => point.kind === "event")
                  .map((point) => (
                    <g key={point.id}>
                      <rect
                        x={point.x - 58}
                        y={point.y - 25}
                        width="116"
                        height="50"
                        rx="25"
                        fill="#f97316"
                        stroke="white"
                        strokeWidth="6"
                      />
                      <text
                        x={point.x}
                        y={point.y + 8}
                        textAnchor="middle"
                        fontSize="22"
                        fontWeight="900"
                        fill="white"
                      >
                        EVENT
                      </text>
                    </g>
                  ))}

                {plottedRoute.routePoints.map((point) => (
                  <text
                    key={`${point.id}-label`}
                    x={clamp(point.x, 100, 760)}
                    y={point.y > 300 ? point.y - 46 : point.y + 64}
                    textAnchor="middle"
                    fontSize="21"
                    fontWeight="700"
                    fill="rgba(255,255,255,0.86)"
                  >
                    {truncate(point.label, 22)}
                  </text>
                ))}
              </svg>
            </div>
          ) : null}

          <div className="space-y-6">
            {stops.length > 0 ? (
              stops.slice(0, 5).map((stop, index) => (
                <div key={stop.id} className="flex gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-3xl font-black text-white">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 border-b border-white/10 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-4xl font-bold leading-tight">
                          {stop.title ?? "Roam stop"}
                        </p>
                        <p className="mt-2 text-2xl font-medium text-neutral-400">
                          {humanizeLabel(
                            stop.displayType ?? stop.venueType ?? stop.role
                          )}
                        </p>
                      </div>

                      {stop.plannedArrivalAt ? (
                        <p className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-xl font-semibold text-neutral-200">
                          {formatTime(stop.plannedArrivalAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-3xl text-neutral-300">
                Your route is ready in Roam.
              </p>
            )}
          </div>

          {routeLabel ? (
            <p className="mt-10 text-2xl leading-snug text-neutral-400">
              {routeLabel}
            </p>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="text-2xl font-semibold text-neutral-400">
              Generated by Roam
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
              Context-aware plans around events
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 px-8 py-5 text-right">
            <p className="text-xl uppercase tracking-[0.24em] text-neutral-400">
              Share your night
            </p>
            <p className="mt-2 text-3xl font-black">roamapp.io</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildPlottedRoute({
  mode,
  stops,
  anchorVenue,
  routeLine,
}: {
  mode: Props["mode"]
  stops: OutingShareStop[]
  anchorVenue?: OutingShareAnchorVenue | null
  routeLine: RouteLinePoint[]
}): {
  routeLinePoints: Array<{ x: number; y: number }>
  routePoints: RoutePoint[]
} {
  const displayPoints = buildDisplayPoints({ mode, stops, anchorVenue })
  const usableRouteLine =
    routeLine.length >= 2
      ? routeLine.filter(hasValidCoordinate)
      : displayPoints.map((point) => ({ lat: point.lat, lon: point.lon }))

  const allCoordinates = [
    ...usableRouteLine,
    ...displayPoints.map((point) => ({ lat: point.lat, lon: point.lon })),
  ].filter(hasValidCoordinate)

  if (allCoordinates.length < 2 || displayPoints.length < 2) {
    return {
      routeLinePoints: [],
      routePoints: [],
    }
  }

  const project = createProjector(allCoordinates)

  return {
    routeLinePoints: usableRouteLine.map(project),
    routePoints: displayPoints.map((point) => ({
      id: point.id,
      label: point.label,
      x: project(point).x,
      y: project(point).y,
      stopOrder: point.stopOrder,
      kind: point.kind,
    })),
  }
}

function buildDisplayPoints({
  mode,
  stops,
  anchorVenue,
}: {
  mode: Props["mode"]
  stops: OutingShareStop[]
  anchorVenue?: OutingShareAnchorVenue | null
}): Array<{
  id: string
  label: string
  lat: number
  lon: number
  stopOrder: number | "EVENT"
  kind: "stop" | "event"
}> {
  const stopPoints = stops
    .filter(hasValidStopCoordinate)
    .map((stop, index) => ({
      id: stop.id,
      label: stop.title ?? humanizeLabel(stop.role),
      lat: stop.lat as number,
      lon: stop.lon as number,
      stopOrder: index + 1,
      kind: "stop" as const,
    }))

  const eventPoint =
    anchorVenue &&
    typeof anchorVenue.lat === "number" &&
    Number.isFinite(anchorVenue.lat) &&
    typeof anchorVenue.lon === "number" &&
    Number.isFinite(anchorVenue.lon)
      ? {
          id: anchorVenue.id ?? "anchor-event",
          label: anchorVenue.name ?? anchorVenue.title ?? "Event",
          lat: anchorVenue.lat,
          lon: anchorVenue.lon,
          stopOrder: "EVENT" as const,
          kind: "event" as const,
        }
      : null

  if (!eventPoint) return stopPoints
  if (mode === "before") return [...stopPoints, eventPoint]
  if (mode === "after") return [eventPoint, ...stopPoints]

  const [firstStop, ...remainingStops] = stopPoints
  return firstStop ? [firstStop, eventPoint, ...remainingStops] : [eventPoint]
}

function createProjector(
  coordinates: RouteLinePoint[]
): (point: RouteLinePoint) => { x: number; y: number } {
  const lats = coordinates.map((point) => point.lat)
  const lons = coordinates.map((point) => point.lon)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const latRange = Math.max(maxLat - minLat, 0.0001)
  const lonRange = Math.max(maxLon - minLon, 0.0001)

  const width = 860
  const height = 360
  const padding = 72

  return (point: RouteLinePoint) => ({
    x: padding + ((point.lon - minLon) / lonRange) * (width - padding * 2),
    y: padding + ((maxLat - point.lat) / latRange) * (height - padding * 2),
  })
}

function hasValidCoordinate(point: RouteLinePoint): boolean {
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon)
  )
}

function hasValidStopCoordinate(stop: OutingShareStop): boolean {
  return (
    typeof stop.lat === "number" &&
    Number.isFinite(stop.lat) &&
    typeof stop.lon === "number" &&
    Number.isFinite(stop.lon)
  )
}

function buildRouteLabel(stops: OutingShareStop[]): string | null {
  if (!stops.length) return null

  return stops
    .slice(0, 5)
    .map((stop) => stop.title ?? humanizeLabel(stop.role))
    .join(" → ")
}

function humanizeMode(mode: Props["mode"]): string {
  if (mode === "before") return "Before"
  if (mode === "after") return "After"
  return "Full Night"
}

function humanizeLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}