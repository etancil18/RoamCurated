'use client'

type RouteLinePoint = { lat: number; lon: number }

type FlowRouteStickerStop = {
  id: string
  venueId: string
  stopOrder: number
  title: string | null
  city?: string | null
  checkedInAt?: string | null
  lat?: number | null
  lon?: number | null
}

type FlowRouteStickerVariant = 'default' | 'transparent-export'
type RouteKind = 'personal' | 'themed' | 'hosted' | 'event'

type Props = {
  title?: string | null
  city?: string | null
  stops: FlowRouteStickerStop[]
  routeLine: RouteLinePoint[]
  width?: number
  height?: number
  variant?: FlowRouteStickerVariant
  routeKind?: RouteKind
  routeTheme?: string | null
  hostName?: string | null
  eventName?: string | null
}

type ProjectedPoint = { x: number; y: number }
type RoutePoint = ProjectedPoint & {
  id: string
  label: string
  stopOrder: number
}

function isValidCoordinate(lat?: number | null, lon?: number | null) {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    Math.abs(lon) <= 180
  )
}

function normalizeCity(city?: string | null) {
  return city ? city.toUpperCase() : 'ROAM'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function hasValidCoordinate(point: RouteLinePoint): boolean {
  return isValidCoordinate(point.lat, point.lon)
}

function getRouteContextLabel({
  routeKind,
  routeTheme,
  hostName,
  eventName,
  title,
}: {
  routeKind: RouteKind
  routeTheme?: string | null
  hostName?: string | null
  eventName?: string | null
  title?: string | null
}) {
  if (routeKind === 'event') {
    return `EVENT ROUTE${eventName ? ` · ${eventName}` : ''}`
  }

  if (routeKind === 'hosted') {
    return `HOSTED FLOW${hostName ? ` · ${hostName}` : ''}`
  }

  if (routeKind === 'themed') {
    return `THEMED FLOW${routeTheme || title ? ` · ${routeTheme ?? title}` : ''}`
  }

  return 'ROAM FLOW'
}

function buildOrderedStopList(stops: FlowRouteStickerStop[]) {
  return [...stops]
    .sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0))
    .map((stop, index) => ({
      order: stop.stopOrder || index + 1,
      label: truncate(stop.title?.trim() || `Stop ${index + 1}`, 20),
    }))
}

function buildTransparentPlottedRoute({
  stops,
  routeLine,
}: {
  stops: FlowRouteStickerStop[]
  routeLine: RouteLinePoint[]
}) {
  const displayPoints = stops
    .filter((stop) => isValidCoordinate(stop.lat, stop.lon))
    .sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0))
    .map((stop, index) => ({
      id: stop.id,
      label: stop.title ?? `Stop ${index + 1}`,
      lat: stop.lat as number,
      lon: stop.lon as number,
      stopOrder: stop.stopOrder || index + 1,
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
    return { routeLinePoints: [] as ProjectedPoint[], routePoints: [] as RoutePoint[] }
  }

  const project = createTransparentProjector(allCoordinates)

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

function createTransparentProjector(coordinates: RouteLinePoint[]) {
  const lats = coordinates.map((point) => point.lat)
  const lons = coordinates.map((point) => point.lon)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const latRange = Math.max(maxLat - minLat, 0.0001)
  const lonRange = Math.max(maxLon - minLon, 0.0001)

  const mapWidth = 860
  const mapHeight = 360
  const padding = 54

  return (point: RouteLinePoint) => ({
    x: padding + ((point.lon - minLon) / lonRange) * (mapWidth - padding * 2),
    y: padding + ((maxLat - point.lat) / latRange) * (mapHeight - padding * 2),
  })
}

function buildBounds(points: RouteLinePoint[]) {
  const lats = points.map((point) => point.lat)
  const lons = points.map((point) => point.lon)

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  }
}

function projectPoint({
  point,
  bounds,
  width,
  height,
  padding,
}: {
  point: RouteLinePoint
  bounds: ReturnType<typeof buildBounds>
  width: number
  height: number
  padding: number
}): ProjectedPoint {
  const lonRange = bounds.maxLon - bounds.minLon || 0.00001
  const latRange = bounds.maxLat - bounds.minLat || 0.00001

  return {
    x: padding + ((point.lon - bounds.minLon) / lonRange) * (width - padding * 2),
    y: padding + (1 - (point.lat - bounds.minLat) / latRange) * (height - padding * 2),
  }
}

function getProjectedRoute({
  routeLine,
  fallbackStops,
  width,
  height,
  padding,
}: {
  routeLine: RouteLinePoint[]
  fallbackStops: RouteLinePoint[]
  width: number
  height: number
  padding: number
}) {
  const sourcePoints = routeLine.length >= 2 ? routeLine : fallbackStops

  if (sourcePoints.length < 2) {
    return { routePoints: [], bounds: null }
  }

  const bounds = buildBounds(sourcePoints)

  return {
    routePoints: sourcePoints.map((point) =>
      projectPoint({ point, bounds, width, height, padding })
    ),
    bounds,
  }
}

function pointsToPath(points: ProjectedPoint[]) {
  if (points.length === 0) return ''

  return points
    .map((point, index) =>
      index === 0
        ? `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
        : `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ')
}

function formatStopLabel(title?: string | null) {
  if (!title) return null
  const trimmed = title.trim().replace(/\s+/g, ' ')
  return truncate(trimmed, 18)
}

export default function FlowRouteSticker({
  title = null,
  city = null,
  stops,
  routeLine,
  width = 520,
  height = 520,
  variant = 'default',
  routeKind = 'personal',
  routeTheme = null,
  hostName = null,
  eventName = null,
}: Props) {
  const isTransparentExport = variant === 'transparent-export'
  const cityLabel = normalizeCity(city)
  const displayTitle = title?.trim() || 'Roam Flow'

  if (isTransparentExport) {
    const plottedRoute = buildTransparentPlottedRoute({ stops, routeLine })
    const orderedStops = buildOrderedStopList(stops).slice(0, 6)
    const contextLabel = getRouteContextLabel({
      routeKind,
      routeTheme,
      hostName,
      eventName,
      title,
    })

    if (plottedRoute.routeLinePoints.length < 2) {
      return <div style={{ width, height, background: 'transparent' }} />
    }

    const mapScale = Math.min(width / 960, height / 620)
    const translateX = (width - 860 * mapScale) / 2
    const translateY = height * 0.18

    return (
      <div
        className="relative inline-flex items-center justify-center overflow-visible text-white"
        style={{ width, height, background: 'transparent' }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          role="img"
          aria-label="Transparent Roam route sticker"
        >
          <defs>
            <linearGradient id="roamTransparentRouteGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            <filter id="roamTransparentRouteShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#000000" floodOpacity="0.72" />
            </filter>
          </defs>

          <g transform={`translate(${translateX} ${translateY}) scale(${mapScale})`}>
            <polyline
              points={plottedRoute.routeLinePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgba(2,6,23,0.9)"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#roamTransparentRouteShadow)"
            />

            <polyline
              points={plottedRoute.routeLinePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.96)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <polyline
              points={plottedRoute.routeLinePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="url(#roamTransparentRouteGradient)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {plottedRoute.routePoints.map((point) => (
              <g key={point.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="29"
                  fill="#6366f1"
                  stroke="white"
                  strokeWidth="7"
                  filter="url(#roamTransparentRouteShadow)"
                />

                <text
                  x={point.x}
                  y={point.y + 10}
                  textAnchor="middle"
                  fontSize="30"
                  fontWeight="900"
                  fill="white"
                >
                  {point.stopOrder}
                </text>
              </g>
            ))}
          </g>

          <g transform={`translate(${width / 2} ${height * 0.66})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fontSize="28"
              fontWeight="900"
              fill="white"
              letterSpacing="5"
              style={{
                paintOrder: 'stroke',
                stroke: 'rgba(2,6,23,0.95)',
                strokeWidth: 8,
              }}
            >
              {truncate(contextLabel.toUpperCase(), 34)}
            </text>

            <text
              x="0"
              y="42"
              textAnchor="middle"
              fontSize="22"
              fontWeight="800"
              fill="rgba(255,255,255,0.92)"
              style={{
                paintOrder: 'stroke',
                stroke: 'rgba(2,6,23,0.92)',
                strokeWidth: 7,
              }}
            >
              {cityLabel}
            </text>
          </g>

          <g transform={`translate(${width / 2} ${height * 0.76})`}>
            {orderedStops.map((stop, index) => (
              <text
                key={`${stop.order}-${stop.label}`}
                x="0"
                y={index * 38}
                textAnchor="middle"
                fontSize="27"
                fontWeight="850"
                fill="white"
                style={{
                  paintOrder: 'stroke',
                  stroke: 'rgba(2,6,23,0.96)',
                  strokeWidth: 8,
                  strokeLinejoin: 'round',
                }}
              >
                {stop.order}. {stop.label}
              </text>
            ))}
          </g>

          <text
            x={width / 2}
            y={height - 42}
            textAnchor="middle"
            fontSize="18"
            fontWeight="900"
            fill="rgba(255,255,255,0.9)"
            letterSpacing="8"
            style={{
              paintOrder: 'stroke',
              stroke: 'rgba(2,6,23,0.9)',
              strokeWidth: 5,
            }}
          >
            ROAM
          </text>
        </svg>
      </div>
    )
  }

  const validStops = stops.filter((stop) =>
    isValidCoordinate(stop.lat, stop.lon)
  )

  const fallbackStopPoints: RouteLinePoint[] = validStops.map((stop) => ({
    lat: stop.lat as number,
    lon: stop.lon as number,
  }))

  const { routePoints, bounds } = getProjectedRoute({
    routeLine,
    fallbackStops: fallbackStopPoints,
    width,
    height,
    padding: 74,
  })

  const stopPoints =
    bounds && validStops.length > 0
      ? validStops.map((stop) => ({
          stop,
          point: projectPoint({
            point: { lat: stop.lat as number, lon: stop.lon as number },
            bounds,
            width,
            height,
            padding: 74,
          }),
        }))
      : []

  const path = pointsToPath(routePoints)

  if (routePoints.length < 2) {
    return (
      <div
        className="relative inline-flex items-center justify-center overflow-hidden text-white"
        style={{ width, height }}
      >
        <div className="rounded-[36px] border border-white/20 bg-black/35 px-8 py-6 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-200">
            {cityLabel}
          </p>

          <p className="mt-3 text-3xl font-black">Route unavailable</p>

          <p className="mt-2 text-sm text-white/60">
            Complete at least two mapped stops.
          </p>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
            ROAM
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative inline-flex items-center justify-center overflow-visible text-white"
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible drop-shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
      >
        <defs>
          <linearGradient id="roam-route-sticker-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="42%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>

          <filter id="roam-route-sticker-soft-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#000000" floodOpacity="0.42" />
          </filter>
        </defs>

        <path d={path} fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" filter="url(#roam-route-sticker-soft-shadow)" />
        <path d={path} fill="none" stroke="rgba(103,232,249,0.32)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="url(#roam-route-sticker-gradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

        {stopPoints.map(({ stop, point }, index) => {
          const isFirst = index === 0
          const isLast = index === stopPoints.length - 1
          const label = formatStopLabel(stop.title)
          const labelY = point.y < height / 2 ? point.y + 52 : point.y - 42
          const labelAnchor = point.x < width / 2 ? 'start' : 'end'
          const labelX =
            point.x < width / 2
              ? Math.min(point.x + 18, width - 120)
              : Math.max(point.x - 18, 120)

          return (
            <g key={stop.id}>
              <circle cx={point.x} cy={point.y} r={isFirst || isLast ? 22 : 18} fill="rgba(2,6,23,0.86)" stroke="rgba(255,255,255,0.95)" strokeWidth="5" filter="url(#roam-route-sticker-soft-shadow)" />
              <circle cx={point.x} cy={point.y} r={isFirst || isLast ? 13 : 10} fill={isFirst ? '#67e8f9' : isLast ? '#34d399' : '#818cf8'} />
              <text x={point.x} y={point.y + 5} textAnchor="middle" className="fill-white text-[16px] font-black">
                {stop.stopOrder}
              </text>

              {label ? (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAnchor}
                  className="fill-white text-[18px] font-black"
                  style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(2,6,23,0.82)',
                    strokeWidth: 8,
                    strokeLinejoin: 'round',
                  }}
                >
                  {label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-center shadow-xl backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200">
          {cityLabel}
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/35 px-5 py-2 text-center shadow-xl backdrop-blur-xl">
        <p className="max-w-[280px] truncate text-xs font-black uppercase tracking-[0.25em] text-white/80">
          {displayTitle}
        </p>

        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.35em] text-white/40">
          ROAM
        </p>
      </div>
    </div>
  )
}