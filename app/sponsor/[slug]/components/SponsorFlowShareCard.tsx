'use client'

import { useEffect, useMemo, useState } from 'react'

type RouteLinePoint = {
  lat: number
  lon: number
}

type SponsorFlowShareStop = {
  id: string
  venueId?: string | null
  stopOrder: number
  title: string | null
  city?: string | null
  checkedInAt?: string | null
  lat?: number | null
  lon?: number | null
}

type Props = {
  city?: string | null
  title?: string | null
  status?: 'active' | 'completed' | 'cancelled' | 'partial'
  datetime?: string | null
  completedAt?: string | null
  checkedInCount?: number
  totalStops?: number
  stops: SponsorFlowShareStop[]
  routeLine?: RouteLinePoint[]
  variant?: 'preview' | 'export'
}

type RoutePoint = {
  id: string
  label: string
  x: number
  y: number
  stopOrder: number
}

export default function SponsorFlowShareCard({
  city = null,
  title = null,
  status = 'completed',
  datetime = null,
  completedAt = null,
  checkedInCount,
  totalStops,
  stops,
  routeLine = [],
  variant = 'export',
}: Props) {
  const displayStops = stops
  const [mapboxRouteLine, setMapboxRouteLine] = useState<RouteLinePoint[]>([])

  const validStops = useMemo(() => {
    return displayStops.filter(hasValidStopCoordinate)
  }, [displayStops])

  useEffect(() => {
    async function loadMapboxRouteLine() {
      if (routeLine.length >= 2 || validStops.length < 2) return

      try {
        const routedLine: RouteLinePoint[] = []

        for (let i = 1; i < validStops.length; i++) {
          const from = validStops[i - 1]
          const to = validStops[i]

          const res = await fetch('/api/mapbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: {
                lat: from.lat,
                lng: from.lon,
              },
              destination: {
                lat: to.lat,
                lng: to.lon,
              },
              waypoints: [],
              travelMode: 'walking',
            }),
          })

          const data = await res.json().catch(() => null)

          if (!res.ok) {
            throw new Error(data?.error || 'Failed to build hosted flow route line')
          }

          const coordinates = data?.geometry?.coordinates

          if (!Array.isArray(coordinates) || coordinates.length === 0) {
            throw new Error('Missing Mapbox geometry coordinates')
          }

          const segmentLine = coordinates
            .map((coord: unknown) => {
              if (
                Array.isArray(coord) &&
                typeof coord[0] === 'number' &&
                typeof coord[1] === 'number'
              ) {
                return {
                  lon: coord[0],
                  lat: coord[1],
                }
              }

              return null
            })
            .filter((point: RouteLinePoint | null): point is RouteLinePoint =>
              Boolean(point)
            )

          routedLine.push(
            ...(routedLine.length > 0 ? segmentLine.slice(1) : segmentLine)
          )
        }

        if (routedLine.length >= 2) {
          setMapboxRouteLine(routedLine)
        }
      } catch (error) {
        console.warn('[SponsorFlowShareCard] Mapbox snapshot route failed:', error)
      }
    }

    loadMapboxRouteLine()
  }, [routeLine.length, validStops])

  const effectiveRouteLine =
    routeLine.length >= 2
      ? routeLine
      : mapboxRouteLine.length >= 2
        ? mapboxRouteLine
        : []

  const plottedRoute = buildPlottedRoute({
    stops: displayStops,
    routeLine: effectiveRouteLine,
  })

  const dateLabel = completedAt
    ? formatDate(completedAt)
    : datetime
      ? formatDate(datetime)
      : null

  const routeLabel = buildRouteLabel(displayStops)
  const finalCheckedInCount = checkedInCount ?? stops.length
  const finalTotalStops = totalStops ?? stops.length

  return (
    <div
      data-roam-sponsor-flow-share-card
      data-roam-share-variant={variant}
      className="relative flex w-[1080px] overflow-hidden bg-neutral-950 text-white"
      style={{
        minHeight: variant === 'export' ? 1920 : undefined,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.28),_transparent_38%)]" />

      <div
        className={`relative z-10 flex w-full flex-col p-20 ${
          variant === 'export' ? 'min-h-[1920px] justify-between gap-16' : 'gap-16'
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <p className="text-4xl font-black tracking-tight">Roam</p>

            <p className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-2xl font-semibold uppercase tracking-[0.2em] text-cyan-200">
              {humanizeStatus(status)}
            </p>
          </div>

          <div className="mt-28">
            <p className="text-3xl font-semibold uppercase tracking-[0.28em] text-cyan-300">
              {city ? city.toUpperCase() : 'Hosted Flow'}
            </p>

            <h1 className="mt-8 text-7xl font-black leading-[0.98] tracking-tight">
              {title ?? 'My Hosted Roam Flow'}
            </h1>

            {dateLabel ? (
              <p className="mt-8 text-3xl font-medium text-neutral-300">
                {dateLabel}
              </p>
            ) : null}

            <p className="mt-10 max-w-[860px] text-3xl leading-snug text-neutral-300">
              {buildSummary({
                status,
                checkedInCount: finalCheckedInCount,
                totalStops: finalTotalStops,
              })}
            </p>
          </div>
        </div>

        <div className="rounded-[3rem] border border-white/10 bg-black/35 p-10 shadow-2xl backdrop-blur">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-3xl font-bold">Hosted Flow Snapshot</p>

            <p className="rounded-full bg-cyan-500/20 px-5 py-2 text-2xl font-semibold text-cyan-200">
              {finalCheckedInCount}/{finalTotalStops} stops
            </p>
          </div>

          {plottedRoute.routePoints.length >= 2 ? (
            <div className="mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/70 p-4">
              <svg
                viewBox="0 0 860 360"
                className="h-[360px] w-full"
                role="img"
                aria-label="Route line connecting hosted Roam flow stops"
              >
                <defs>
                  <linearGradient id="sponsorFlowRouteLineGradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>

                  <filter id="sponsorFlowRouteGlow">
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
                    .join(' ')}
                  fill="none"
                  stroke="url(#sponsorFlowRouteLineGradient)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#sponsorFlowRouteGlow)"
                />

                {plottedRoute.routePoints.map((point) => (
                  <g key={point.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="27"
                      fill="#0891b2"
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
            {displayStops.length > 0 ? (
              displayStops.map((stop, index) => (
                <div key={stop.id} className="flex gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-3xl font-black text-white">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 border-b border-white/10 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-4xl font-bold leading-tight">
                          {stop.title ?? 'Roam stop'}
                        </p>

                        <p className="mt-2 text-2xl font-medium text-neutral-400">
                          {stop.city ?? 'Hosted stop'}
                        </p>
                      </div>

                      {stop.checkedInAt ? (
                        <p className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-xl font-semibold text-neutral-200">
                          {formatTime(stop.checkedInAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-3xl text-neutral-300">
                This hosted Roam flow is ready to share.
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
              Hosted city flows worth remembering
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 px-8 py-5 text-right">
            <p className="text-xl uppercase tracking-[0.24em] text-neutral-400">
              Share this flow
            </p>

            <p className="mt-2 text-3xl font-black">roamapp.io</p>
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
  stops: SponsorFlowShareStop[]
  routeLine: RouteLinePoint[]
}) {
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

function createProjector(coordinates: RouteLinePoint[]) {
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
  const padding = 44

  return (point: RouteLinePoint) => ({
    x: padding + ((point.lon - minLon) / lonRange) * (width - padding * 2),
    y: padding + ((maxLat - point.lat) / latRange) * (height - padding * 2),
  })
}

function hasValidCoordinate(point: RouteLinePoint): boolean {
  return (
    typeof point.lat === 'number' &&
    Number.isFinite(point.lat) &&
    typeof point.lon === 'number' &&
    Number.isFinite(point.lon)
  )
}

function hasValidStopCoordinate(stop: SponsorFlowShareStop): boolean {
  return (
    typeof stop.lat === 'number' &&
    Number.isFinite(stop.lat) &&
    typeof stop.lon === 'number' &&
    Number.isFinite(stop.lon)
  )
}

function buildRouteLabel(stops: SponsorFlowShareStop[]): string | null {
  if (!stops.length) return null

  return stops
    .slice(0, 6)
    .map((stop) => stop.title ?? `Stop ${stop.stopOrder}`)
    .join(' → ')
}

function buildSummary({
  status,
  checkedInCount,
  totalStops,
}: {
  status: Props['status']
  checkedInCount: number
  totalStops: number
}): string {
  if (status === 'completed') {
    return `Completed ${checkedInCount} of ${totalStops} stops on this hosted Roam Flow.`
  }

  if (status === 'cancelled' || status === 'partial') {
    return `Checked in to ${checkedInCount} of ${totalStops} stops on this hosted Roam Flow.`
  }

  return `Currently roaming through ${checkedInCount} of ${totalStops} hosted stops.`
}

function humanizeStatus(status: Props['status']): string {
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Ended'
  if (status === 'partial') return 'Snapshot'
  return 'In Progress'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}