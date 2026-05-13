// components/property/PropertyCrawlShareCard.tsx

"use client"

type RouteLinePoint = {
  lat: number
  lon: number
}

type PropertyCrawlShareStop = {
  id: string
  title: string | null
  stopOrder: number
  venueType?: string | null
  displayType?: string | null
  lat?: number | null
  lon?: number | null
  address?: string | null
}

type Props = {
  city?: string | null
  propertyName?: string | null
  propertySlug?: string | null
  stops: PropertyCrawlShareStop[]
  routeLine?: RouteLinePoint[]
  variant?: "preview" | "export"
}

type RoutePoint = {
  id: string
  label: string
  x: number
  y: number
  stopOrder: number
}

export default function PropertyCrawlShareCard({
  city = null,
  propertyName = null,
  propertySlug = null,
  stops,
  routeLine = [],
  variant = "export",
}: Props) {
  const routeLabel = buildRouteLabel(stops)
  const plottedRoute = buildPlottedRoute({
    stops: stops.slice(0, 6),
    routeLine,
  })

  return (
    <div
      data-roam-property-crawl-share-card
      data-roam-share-variant={variant}
      className="relative flex w-[1080px] overflow-hidden bg-neutral-950 text-white"
      style={{
        minHeight: variant === "export" ? 1920 : undefined,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.28),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.22),_transparent_38%)]" />

      <div
        className={`relative z-10 flex w-full flex-col p-20 ${
          variant === "export" ? "min-h-[1920px] justify-between gap-16" : "gap-16"
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <p className="text-4xl font-black tracking-tight">Roam</p>
            <p className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-2xl font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Crawl Route
            </p>
          </div>

          <div className="mt-28">
            <p className="text-3xl font-semibold uppercase tracking-[0.28em] text-cyan-300">
              {city ? city.toUpperCase() : "Neighborhood Route"}
            </p>

            <h1 className="mt-8 text-7xl font-black leading-[0.98] tracking-tight">
              {propertyName ?? "Your Roam Crawl"}
            </h1>

            <p className="mt-10 max-w-[860px] text-3xl leading-snug text-neutral-300">
              A curated local route with {stops.length} stop
              {stops.length === 1 ? "" : "s"} nearby.
            </p>
          </div>
        </div>

        <div className="rounded-[3rem] border border-white/10 bg-black/35 p-10 shadow-2xl backdrop-blur">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-3xl font-bold">Route</p>
            <p className="rounded-full bg-emerald-500/20 px-5 py-2 text-2xl font-semibold text-emerald-200">
              {stops.length} stop{stops.length === 1 ? "" : "s"}
            </p>
          </div>

          {plottedRoute.routePoints.length >= 2 ? (
            <div className="mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/70 p-4">
              <svg
                viewBox="0 0 860 360"
                className="h-[360px] w-full"
                role="img"
                aria-label="Route line connecting crawl stops"
              >
                <defs>
                  <linearGradient id="propertyCrawlRouteLineGradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="propertyCrawlRouteGlow">
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
                  stroke="url(#propertyCrawlRouteLineGradient)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#propertyCrawlRouteGlow)"
                />

                {plottedRoute.routePoints.map((point) => (
                  <g key={point.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="27"
                      fill="#10b981"
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
              stops.slice(0, 6).map((stop, index) => (
                <div key={stop.id} className="flex gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-3xl font-black text-white">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 border-b border-white/10 pb-6">
                    <p className="text-4xl font-bold leading-tight">
                      {stop.title ?? `Stop ${index + 1}`}
                    </p>

                    <p className="mt-2 text-2xl font-medium text-neutral-400">
                      {humanizeLabel(stop.displayType ?? stop.venueType ?? "venue")}
                    </p>

                    {stop.address ? (
                      <p className="mt-2 text-xl leading-snug text-neutral-500">
                        {stop.address}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-3xl text-neutral-300">
                Your crawl route is ready in Roam.
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
              Local routes around where you stay
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 px-8 py-5 text-right">
            <p className="text-xl uppercase tracking-[0.24em] text-neutral-400">
              Share your route
            </p>
            <p className="mt-2 text-3xl font-black">
              {propertySlug ? "roamapp.io" : "roamapp.io"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildPlottedRoute({
  stops,
  routeLine,
}: {
  stops: PropertyCrawlShareStop[]
  routeLine: RouteLinePoint[]
}): {
  routeLinePoints: Array<{ x: number; y: number }>
  routePoints: RoutePoint[]
} {
  const displayPoints = stops
    .filter(hasValidStopCoordinate)
    .map((stop, index) => ({
      id: stop.id,
      label: stop.title ?? `Stop ${index + 1}`,
      lat: stop.lat as number,
      lon: stop.lon as number,
      stopOrder: index + 1,
    }))

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
    })),
  }
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

function hasValidStopCoordinate(stop: PropertyCrawlShareStop): boolean {
  return (
    typeof stop.lat === "number" &&
    Number.isFinite(stop.lat) &&
    typeof stop.lon === "number" &&
    Number.isFinite(stop.lon)
  )
}

function buildRouteLabel(stops: PropertyCrawlShareStop[]): string | null {
  if (!stops.length) return null

  return stops
    .slice(0, 6)
    .map((stop, index) => stop.title ?? `Stop ${index + 1}`)
    .join(" → ")
}

function humanizeLabel(value: unknown): string {
  if (typeof value !== "string") return "Venue"

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}