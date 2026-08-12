'use client'

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

export type PublicRoamRoutePoint = {
  lat: number
  lon: number
}

export type PublicRoamRouteStop = {
  id?: string | null
  venueId?: string | null
  stopIndex?: number | null
  stopOrder?: number | null
  title?: string | null
  name?: string | null
  city?: string | null
  lat?: number | null
  lon?: number | null
  visitedAt?: string | null
  checkedInAt?: string | null
}

type Props = {
  stops: PublicRoamRouteStop[]
  routeLine?: PublicRoamRoutePoint[] | null
  title?: string | null
  city?: string | null
  className?: string
  showStopLabels?: boolean
  showHeader?: boolean
  compact?: boolean
  aspectRatio?: 'wide' | 'square' | 'portrait'
}

type NormalizedStop = {
  key: string
  title: string
  lat: number | null
  lon: number | null
  order: number
}

type RoutableStop =
  NormalizedStop & {
    lat: number
    lon: number
  }

type ProjectedPoint = {
  x: number
  y: number
}

type ProjectedStop =
  NormalizedStop & {
    x: number
    y: number
  }

const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 620

const MAP_PADDING_X = 90
const MAP_PADDING_TOP = 85
const MAP_PADDING_BOTTOM = 95

/*
 * Keep public replay previews aligned with the existing
 * active-flow routing behavior.
 *
 * The important change here is that route geometry comes from
 * Mapbox rather than interpolating directly between venue
 * coordinates.
 */
const PUBLIC_ROAM_TRAVEL_MODE =
  'walking'

const DEFAULT_ROUTE_POINTS:
  ProjectedPoint[] = [
    {
      x: 115,
      y: 420,
    },
    {
      x: 230,
      y: 320,
    },
    {
      x: 370,
      y: 365,
    },
    {
      x: 520,
      y: 215,
    },
    {
      x: 680,
      y: 270,
    },
    {
      x: 860,
      y: 150,
    },
  ]

export default function PublicRoamRoutePreview({
  stops,
  routeLine = null,
  title = null,
  city = null,
  className = '',
  showStopLabels = true,
  showHeader = true,
  compact = false,
  aspectRatio = 'wide',
}: Props) {
  const normalizedStops =
    useMemo(
      () =>
        normalizeStops(
          stops
        ),
      [
        stops,
      ]
    )

  const suppliedRouteLine =
    useMemo(
      () =>
        normalizeRouteLine(
          routeLine
        ),
      [
        routeLine,
      ]
    )

  const routableStops =
    useMemo(
      () =>
        normalizedStops.filter(
          isRoutableStop
        ),
      [
        normalizedStops,
      ]
    )

  const [
    resolvedRouteLine,
    setResolvedRouteLine,
  ] = useState<
    PublicRoamRoutePoint[]
  >([])

  /*
   * Public route preview initiative:
   *
   * If canonical routed geometry was supplied by the caller,
   * use it exactly as supplied.
   *
   * Otherwise, when every canonical stop has valid coordinates,
   * resolve the ordered route through the existing Mapbox API.
   *
   * We never reorder stops here. The immutable stop ordering
   * supplied by flow_snapshot_stops remains authoritative.
   */
  useEffect(() => {
    if (
      suppliedRouteLine.length >=
      2
    ) {
      setResolvedRouteLine(
        []
      )

      return
    }

    if (
      routableStops.length <
        2 ||
      routableStops.length !==
        normalizedStops.length
    ) {
      setResolvedRouteLine(
        []
      )

      return
    }

    const controller =
      new AbortController()

    let cancelled =
      false

    async function resolveRoute() {
      try {
        const routedLine =
          await fetchCanonicalRouteLine(
            routableStops,
            controller.signal
          )

        if (
          cancelled
        ) {
          return
        }

        setResolvedRouteLine(
          routedLine
        )
      } catch (error) {
        if (
          cancelled ||
          isAbortError(
            error
          )
        ) {
          return
        }

        console.warn(
          '[PublicRoamRoutePreview] Routed street geometry unavailable; falling back to canonical stop coordinates:',
          error
        )

        setResolvedRouteLine(
          []
        )
      }
    }

    void resolveRoute()

    return () => {
      cancelled =
        true

      controller.abort()
    }
  }, [
    normalizedStops,
    routableStops,
    suppliedRouteLine,
  ])

  /*
   * Route source precedence:
   *
   * 1. Explicit immutable/routed line supplied by the caller.
   * 2. Fresh Mapbox route resolved from canonical ordered stops.
   * 3. Canonical stop coordinates as a degraded fallback.
   *
   * Only #1 and #2 are considered real routed geometry.
   */
  const activeRoutedLine =
    suppliedRouteLine.length >=
    2
      ? suppliedRouteLine
      : resolvedRouteLine.length >=
          2
        ? resolvedRouteLine
        : []

  const isStreetRouted =
    activeRoutedLine.length >=
    2

  const routeCoordinates =
    isStreetRouted
      ? activeRoutedLine
      : routableStops.map(
          (
            stop
          ) => ({
            lat:
              stop.lat,

            lon:
              stop.lon,
          })
        )

  const projectionSource =
    buildProjectionSource({
      routeCoordinates,
      stops:
        normalizedStops,
    })

  const projection =
    createProjection(
      projectionSource
    )

  const projectedRoute =
    routeCoordinates.length >=
    2
      ? routeCoordinates.map(
          (
            point
          ) =>
            projection(
              point
            )
        )
      : buildFallbackRoute(
          normalizedStops.length
        )

  const projectedStops =
    projectStops({
      stops:
        normalizedStops,
      projection,
      fallbackRoute:
        projectedRoute,
    })

  /*
   * Do NOT smooth routed Mapbox geometry.
   *
   * Quadratic smoothing can cut across corners and visually leave
   * the actual street network.
   *
   * A routed line therefore uses exact point-to-point segments.
   * The old smooth treatment remains only for the synthetic visual
   * fallback where no street geometry is available.
   */
  const pathData =
    isStreetRouted
      ? buildExactPath(
          projectedRoute
        )
      : buildSmoothPath(
          projectedRoute
        )

  const resolvedTitle =
    normalizeText(
      title
    )

  const resolvedCity =
    normalizeText(
      city
    )

  const aspectClass =
    aspectRatio ===
    'square'
      ? 'aspect-square'
      : aspectRatio ===
          'portrait'
        ? 'aspect-[4/5]'
        : 'aspect-[16/10]'

  return (
    <div
      className={[
        'relative isolate w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#050814]',
        aspectClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={
          {
            background:
              [
                'radial-gradient(circle at 16% 18%, rgba(34,211,238,0.13), transparent 32%)',
                'radial-gradient(circle at 84% 82%, rgba(99,102,241,0.16), transparent 36%)',
                'linear-gradient(145deg, #070a14 0%, #03050b 52%, #070811 100%)',
              ].join(
                ', '
              ),
          } as CSSProperties
        }
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            [
              'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
            ].join(
              ', '
            ),

          backgroundSize:
            '42px 42px',
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_45%,rgba(0,0,0,0.34)_100%)]"
      />

      {showHeader &&
      (
        resolvedTitle ||
        resolvedCity ||
        normalizedStops.length >
          0
      ) ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            {resolvedTitle ? (
              <p className="truncate text-xs font-semibold text-white/85">
                {
                  resolvedTitle
                }
              </p>
            ) : null}

            {resolvedCity ? (
              <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                {
                  resolvedCity
                }
              </p>
            ) : null}
          </div>

          {normalizedStops.length >
          0 ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-indigo-400/20 bg-indigo-500/[0.12] px-2.5 py-1 text-[10px] font-semibold text-indigo-100 backdrop-blur-md">
              {
                normalizedStops.length
              }
              /
              {
                normalizedStops.length
              }{' '}
              {normalizedStops.length ===
              1
                ? 'stop'
                : 'stops'}
            </span>
          ) : null}
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={
          normalizedStops.length >
          0
            ? `Route preview with ${normalizedStops.length} stops`
            : 'Roam route preview'
        }
      >
        <defs>
          <linearGradient
            id="public-roam-route-gradient"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#60a5fa"
            />

            <stop
              offset="45%"
              stopColor="#67e8f9"
            />

            <stop
              offset="100%"
              stopColor="#34d399"
            />
          </linearGradient>

          <linearGradient
            id="public-roam-route-gradient-soft"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#6366f1"
              stopOpacity="0.7"
            />

            <stop
              offset="48%"
              stopColor="#22d3ee"
              stopOpacity="0.75"
            />

            <stop
              offset="100%"
              stopColor="#10b981"
              stopOpacity="0.72"
            />
          </linearGradient>

          <filter
            id="public-roam-route-glow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur
              stdDeviation="12"
              result="blur"
            />

            <feMerge>
              <feMergeNode
                in="blur"
              />

              <feMergeNode
                in="SourceGraphic"
              />
            </feMerge>
          </filter>

          <filter
            id="public-roam-marker-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur
              stdDeviation="5"
              result="blur"
            />

            <feMerge>
              <feMergeNode
                in="blur"
              />

              <feMergeNode
                in="SourceGraphic"
              />
            </feMerge>
          </filter>
        </defs>

        {pathData ? (
          <>
            <path
              d={
                pathData
              }
              fill="none"
              stroke="url(#public-roam-route-gradient-soft)"
              strokeWidth={
                compact
                  ? 16
                  : 19
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.18"
              filter="url(#public-roam-route-glow)"
            />

            <path
              d={
                pathData
              }
              fill="none"
              stroke="#020617"
              strokeWidth={
                compact
                  ? 10
                  : 12
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />

            <path
              d={
                pathData
              }
              fill="none"
              stroke="url(#public-roam-route-gradient)"
              strokeWidth={
                compact
                  ? 5
                  : 6
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.97"
              filter="url(#public-roam-route-glow)"
            />

            <path
              d={
                pathData
              }
              fill="none"
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.65"
            />
          </>
        ) : null}

        {projectedStops.map(
          (
            stop
          ) => {
            const markerRadius =
              compact
                ? 22
                : 25

            return (
              <g
                key={
                  stop.key
                }
                transform={`translate(${stop.x} ${stop.y})`}
              >
                <circle
                  r={
                    markerRadius +
                    8
                  }
                  fill="rgba(99,102,241,0.16)"
                  filter="url(#public-roam-marker-glow)"
                />

                <circle
                  r={
                    markerRadius
                  }
                  fill="#090b17"
                  stroke="rgba(255,255,255,0.82)"
                  strokeWidth="4"
                />

                <circle
                  r={
                    markerRadius -
                    6
                  }
                  fill="#6366f1"
                  stroke="#818cf8"
                  strokeWidth="2"
                />

                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={
                    compact
                      ? 21
                      : 23
                  }
                  fontWeight="700"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                >
                  {
                    stop.order
                  }
                </text>

                {showStopLabels &&
                !compact ? (
                  <StopLabel
                    stop={
                      stop
                    }
                  />
                ) : null}
              </g>
            )
          }
        )}
      </svg>

      {!showStopLabels &&
      normalizedStops.length >
        0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-12">
          <p className="truncate text-[11px] text-neutral-400">
            {
              normalizedStops
                .slice(
                  0,
                  3
                )
                .map(
                  (
                    stop
                  ) =>
                    stop.title
                )
                .join(
                  ' → '
                )
            }

            {normalizedStops.length >
            3
              ? ' → …'
              : ''}
          </p>
        </div>
      ) : null}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.035]"
      />
    </div>
  )
}

function StopLabel({
  stop,
}: {
  stop: ProjectedStop
}) {
  const placeLabelAbove =
    stop.y >
    VIEWBOX_HEIGHT *
      0.63

  const labelY =
    placeLabelAbove
      ? -48
      : 50

  return (
    <g
      transform={`translate(0 ${labelY})`}
    >
      <rect
        x="-88"
        y="-18"
        width="176"
        height="36"
        rx="18"
        fill="rgba(3,7,18,0.86)"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1"
      />

      <text
        x="0"
        y="1"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.78)"
        fontSize="14"
        fontWeight="500"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      >
        {
          truncateSvgLabel(
            stop.title,
            20
          )
        }
      </text>
    </g>
  )
}

function normalizeStops(
  value:
    PublicRoamRouteStop[]
): NormalizedStop[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(
      (
        stop,
        index
      ): NormalizedStop | null => {
        if (
          !stop ||
          typeof stop !==
            'object'
        ) {
          return null
        }

        const title =
          normalizeText(
            stop.title
          ) ??
          normalizeText(
            stop.name
          ) ??
          `Stop ${index + 1}`

        const lat =
          normalizeLatitude(
            stop.lat
          )

        const lon =
          normalizeLongitude(
            stop.lon
          )

        return {
          key:
            normalizeText(
              stop.id
            ) ??
            normalizeText(
              stop.venueId
            ) ??
            `${index}-${title}`,

          title,

          lat,

          lon,

          order:
            index + 1,
        }
      }
    )
    .filter(
      (
        stop
      ): stop is NormalizedStop =>
        stop !== null
    )
}

function isRoutableStop(
  stop:
    NormalizedStop
): stop is RoutableStop {
  return (
    stop.lat !==
      null &&
    stop.lon !==
      null
  )
}

function normalizeRouteLine(
  value:
    | PublicRoamRoutePoint[]
    | null
    | undefined
): PublicRoamRoutePoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (
      point
    ): point is PublicRoamRoutePoint =>
      Boolean(
        point
      ) &&
      typeof point.lat ===
        'number' &&
      Number.isFinite(
        point.lat
      ) &&
      Math.abs(
        point.lat
      ) <=
        90 &&
      typeof point.lon ===
        'number' &&
      Number.isFinite(
        point.lon
      ) &&
      Math.abs(
        point.lon
      ) <=
        180
  )
}

/*
 * Resolve one canonical routed line through every ordered stop.
 *
 * First attempt a single origin + waypoints + destination route.
 *
 * If the route API cannot return one complete geometry, resolve
 * every adjacent pair separately and concatenate those exact
 * routed segments.
 */
async function fetchCanonicalRouteLine(
  stops:
    RoutableStop[],
  signal:
    AbortSignal
): Promise<
  PublicRoamRoutePoint[]
> {
  if (
    stops.length <
    2
  ) {
    return []
  }

  const origin =
    stops[0]

  const destination =
    stops[
      stops.length -
        1
    ]

  const waypoints =
    stops.slice(
      1,
      -1
    )

  const fullRouteResponse =
    await fetch(
      '/api/mapbox',
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            origin: {
              lat:
                origin.lat,

              lng:
                origin.lon,
            },

            destination: {
              lat:
                destination.lat,

              lng:
                destination.lon,
            },

            waypoints:
              waypoints.map(
                (
                  stop
                ) => ({
                  lat:
                    stop.lat,

                  lng:
                    stop.lon,
                })
              ),

            travelMode:
              PUBLIC_ROAM_TRAVEL_MODE,

            geometries:
              'geojson',

            overview:
              'full',
          }),

        signal,
      }
    )

  const fullRoutePayload =
    await fullRouteResponse
      .json()
      .catch(
        () => null
      )

  const fullRouteLine =
    extractRouteLineFromMapboxResponse(
      fullRoutePayload
    )

  if (
    fullRouteResponse.ok &&
    fullRouteLine.length >=
      2
  ) {
    return fullRouteLine
  }

  const routedLine:
    PublicRoamRoutePoint[] =
    []

  for (
    let index = 1;
    index <
    stops.length;
    index += 1
  ) {
    const from =
      stops[
        index - 1
      ]

    const to =
      stops[
        index
      ]

    const response =
      await fetch(
        '/api/mapbox',
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              origin: {
                lat:
                  from.lat,

                lng:
                  from.lon,
              },

              destination: {
                lat:
                  to.lat,

                lng:
                  to.lon,
              },

              waypoints:
                [],

              travelMode:
                PUBLIC_ROAM_TRAVEL_MODE,

              geometries:
                'geojson',

              overview:
                'full',
            }),

          signal,
        }
      )

    const payload =
      await response
        .json()
        .catch(
          () => null
        )

    if (
      !response.ok
    ) {
      throw new Error(
        extractMapboxError(
          payload
        ) ??
        'Failed to build routed public Roam preview.'
      )
    }

    const segment =
      extractRouteLineFromMapboxResponse(
        payload
      )

    if (
      segment.length <
      2
    ) {
      throw new Error(
        'Mapbox route geometry was unavailable.'
      )
    }

    routedLine.push(
      ...(routedLine.length >
      0
        ? segment.slice(
            1
          )
        : segment)
    )
  }

  if (
    routedLine.length <
    2
  ) {
    throw new Error(
      'The public Roam route could not be generated.'
    )
  }

  return routedLine
}

function extractMapboxError(
  value: unknown
): string | null {
  if (
    typeof value !==
      'object' ||
    value === null ||
    Array.isArray(
      value
    )
  ) {
    return null
  }

  const record =
    value as Record<
      string,
      unknown
    >

  return (
    normalizeText(
      record.error
    ) ??
    normalizeText(
      record.message
    )
  )
}

function extractRouteLineFromMapboxResponse(
  data:
    unknown
): PublicRoamRoutePoint[] {
  const payload =
    data as
      | {
          geometry?:
            unknown

          routeGeometry?:
            unknown

          route?: {
            geometry?:
              unknown
          }

          routes?: Array<{
            geometry?:
              unknown
          }>
        }
      | null

  const candidates = [
    getGeometryCoordinates(
      payload?.geometry
    ),

    getGeometryCoordinates(
      payload
        ?.routeGeometry
    ),

    getGeometryCoordinates(
      payload?.route
        ?.geometry
    ),

    getGeometryCoordinates(
      payload?.routes?.[0]
        ?.geometry
    ),

    payload?.routes?.[0]
      ?.geometry,

    payload?.geometry,
  ]

  for (
    const candidate
    of candidates
  ) {
    const parsed =
      parseRouteGeometry(
        candidate
      )

    if (
      parsed.length >=
      2
    ) {
      return parsed
    }
  }

  return []
}

function getGeometryCoordinates(
  value:
    unknown
): unknown {
  if (
    typeof value ===
      'object' &&
    value !==
      null &&
    'coordinates' in
      value
  ) {
    return (
      value as {
        coordinates?:
          unknown
      }
    ).coordinates
  }

  return value
}

function parseRouteGeometry(
  value:
    unknown
): PublicRoamRoutePoint[] {
  if (!value) {
    return []
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        (
          coordinate
        ) => {
          if (
            Array.isArray(
              coordinate
            ) &&
            typeof coordinate[0] ===
              'number' &&
            typeof coordinate[1] ===
              'number'
          ) {
            return {
              lon:
                coordinate[0],

              lat:
                coordinate[1],
            }
          }

          return null
        }
      )
      .filter(
        (
          point
        ): point is PublicRoamRoutePoint => {
          if (!point) {
            return false
          }

          return (
            Number.isFinite(
              point.lat
            ) &&
            Number.isFinite(
              point.lon
            ) &&
            Math.abs(
              point.lat
            ) <=
              90 &&
            Math.abs(
              point.lon
            ) <=
              180
          )
        }
      )
  }

  if (
    typeof value ===
      'object' &&
    value !==
      null
  ) {
    const objectValue =
      value as {
        type?:
          string

        coordinates?:
          unknown

        geometry?:
          unknown
      }

    if (
      objectValue.type ===
      'LineString'
    ) {
      return parseRouteGeometry(
        objectValue.coordinates
      )
    }

    if (
      objectValue.geometry
    ) {
      return parseRouteGeometry(
        objectValue.geometry
      )
    }

    if (
      objectValue.coordinates
    ) {
      return parseRouteGeometry(
        objectValue.coordinates
      )
    }
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
      .length >
      0
  ) {
    const polyline6 =
      decodePolyline(
        value,
        6
      )

    if (
      polyline6.length >=
      2
    ) {
      return polyline6
    }

    const polyline5 =
      decodePolyline(
        value,
        5
      )

    if (
      polyline5.length >=
      2
    ) {
      return polyline5
    }
  }

  return []
}

function decodePolyline(
  encoded:
    string,
  precision:
    number
): PublicRoamRoutePoint[] {
  const coordinates:
    PublicRoamRoutePoint[] =
    []

  const factor =
    Math.pow(
      10,
      precision
    )

  let index =
    0

  let latitude =
    0

  let longitude =
    0

  while (
    index <
    encoded.length
  ) {
    let result =
      0

    let shift =
      0

    let byte =
      0

    do {
      byte =
        encoded.charCodeAt(
          index++
        ) -
        63

      result |=
        (
          byte &
          0x1f
        ) <<
        shift

      shift +=
        5
    } while (
      byte >=
        0x20 &&
      index <
        encoded.length
    )

    const latitudeDelta =
      result &
      1
        ? ~(
            result >>
            1
          )
        : result >>
          1

    latitude +=
      latitudeDelta

    result =
      0

    shift =
      0

    do {
      byte =
        encoded.charCodeAt(
          index++
        ) -
        63

      result |=
        (
          byte &
          0x1f
        ) <<
        shift

      shift +=
        5
    } while (
      byte >=
        0x20 &&
      index <
        encoded.length
    )

    const longitudeDelta =
      result &
      1
        ? ~(
            result >>
            1
          )
        : result >>
          1

    longitude +=
      longitudeDelta

    const point = {
      lat:
        latitude /
        factor,

      lon:
        longitude /
        factor,
    }

    if (
      Number.isFinite(
        point.lat
      ) &&
      Number.isFinite(
        point.lon
      ) &&
      Math.abs(
        point.lat
      ) <=
        90 &&
      Math.abs(
        point.lon
      ) <=
        180
    ) {
      coordinates.push(
        point
      )
    }
  }

  return coordinates
}

function buildProjectionSource({
  routeCoordinates,
  stops,
}: {
  routeCoordinates:
    PublicRoamRoutePoint[]

  stops:
    NormalizedStop[]
}): PublicRoamRoutePoint[] {
  const stopCoordinates =
    stops
      .filter(
        isRoutableStop
      )
      .map(
        (
          stop
        ) => ({
          lat:
            stop.lat,

          lon:
            stop.lon,
        })
      )

  return [
    ...routeCoordinates,
    ...stopCoordinates,
  ]
}

function createProjection(
  points:
    PublicRoamRoutePoint[]
): (
  point:
    PublicRoamRoutePoint
) => ProjectedPoint {
  if (
    points.length ===
    0
  ) {
    return () => ({
      x:
        VIEWBOX_WIDTH /
        2,

      y:
        VIEWBOX_HEIGHT /
        2,
    })
  }

  const latitudes =
    points.map(
      (
        point
      ) =>
        point.lat
    )

  const longitudes =
    points.map(
      (
        point
      ) =>
        point.lon
    )

  let minLat =
    Math.min(
      ...latitudes
    )

  let maxLat =
    Math.max(
      ...latitudes
    )

  let minLon =
    Math.min(
      ...longitudes
    )

  let maxLon =
    Math.max(
      ...longitudes
    )

  if (
    Math.abs(
      maxLat -
      minLat
    ) <
    0.00001
  ) {
    minLat -=
      0.0005

    maxLat +=
      0.0005
  }

  if (
    Math.abs(
      maxLon -
      minLon
    ) <
    0.00001
  ) {
    minLon -=
      0.0005

    maxLon +=
      0.0005
  }

  const availableWidth =
    VIEWBOX_WIDTH -
    MAP_PADDING_X *
      2

  const availableHeight =
    VIEWBOX_HEIGHT -
    MAP_PADDING_TOP -
    MAP_PADDING_BOTTOM

  const longitudeSpan =
    maxLon -
    minLon

  const latitudeSpan =
    maxLat -
    minLat

  const xScale =
    availableWidth /
    longitudeSpan

  const yScale =
    availableHeight /
    latitudeSpan

  const scale =
    Math.min(
      xScale,
      yScale
    )

  const renderedWidth =
    longitudeSpan *
    scale

  const renderedHeight =
    latitudeSpan *
    scale

  const offsetX =
    MAP_PADDING_X +
    (
      availableWidth -
      renderedWidth
    ) /
      2

  const offsetY =
    MAP_PADDING_TOP +
    (
      availableHeight -
      renderedHeight
    ) /
      2

  return (
    point:
      PublicRoamRoutePoint
  ) => ({
    x:
      offsetX +
      (
        point.lon -
        minLon
      ) *
        scale,

    y:
      offsetY +
      (
        maxLat -
        point.lat
      ) *
        scale,
  })
}

function projectStops({
  stops,
  projection,
  fallbackRoute,
}: {
  stops:
    NormalizedStop[]

  projection: (
    point:
      PublicRoamRoutePoint
  ) => ProjectedPoint

  fallbackRoute:
    ProjectedPoint[]
}): ProjectedStop[] {
  return stops.map(
    (
      stop,
      index
    ) => {
      if (
        stop.lat !==
          null &&
        stop.lon !==
          null
      ) {
        return {
          ...stop,

          ...projection({
            lat:
              stop.lat,

            lon:
              stop.lon,
          }),
        }
      }

      const fallbackPoint =
        getFallbackStopPoint(
          fallbackRoute,
          index,
          stops.length
        )

      return {
        ...stop,
        ...fallbackPoint,
      }
    }
  )
}

function getFallbackStopPoint(
  route:
    ProjectedPoint[],
  index:
    number,
  totalStops:
    number
): ProjectedPoint {
  if (
    route.length ===
    0
  ) {
    return {
      x:
        VIEWBOX_WIDTH /
        2,

      y:
        VIEWBOX_HEIGHT /
        2,
    }
  }

  if (
    totalStops <=
    1
  ) {
    return (
      route[
        Math.floor(
          route.length /
          2
        )
      ] ??
      route[0]
    )
  }

  const routeIndex =
    Math.round(
      (
        index /
        (
          totalStops -
          1
        )
      ) *
      (
        route.length -
        1
      )
    )

  return (
    route[
      routeIndex
    ] ??
    route[
      route.length -
      1
    ]
  )
}

function buildFallbackRoute(
  stopCount:
    number
): ProjectedPoint[] {
  const numberOfPoints =
    Math.max(
      2,
      Math.min(
        DEFAULT_ROUTE_POINTS.length,
        stopCount >
        0
          ? stopCount
          : 4
      )
    )

  if (
    numberOfPoints ===
    DEFAULT_ROUTE_POINTS.length
  ) {
    return DEFAULT_ROUTE_POINTS
  }

  return Array.from(
    {
      length:
        numberOfPoints,
    },
    (
      _,
      index
    ) => {
      const sourceIndex =
        Math.round(
          (
            index /
            Math.max(
              1,
              numberOfPoints -
              1
            )
          ) *
          (
            DEFAULT_ROUTE_POINTS.length -
            1
          )
        )

      return (
        DEFAULT_ROUTE_POINTS[
          sourceIndex
        ] ??
        DEFAULT_ROUTE_POINTS[0]
      )
    }
  )
}

/*
 * Exact routed geometry.
 *
 * Every Mapbox point is preserved with straight SVG segments
 * between adjacent geometry points. Because Mapbox returns a
 * dense route geometry, the displayed line follows the street
 * network instead of cutting across corners.
 */
function buildExactPath(
  points:
    ProjectedPoint[]
): string | null {
  if (
    points.length <
    2
  ) {
    return null
  }

  const commands = [
    `M ${roundCoordinate(
      points[0].x
    )} ${roundCoordinate(
      points[0].y
    )}`,
  ]

  for (
    let index = 1;
    index <
    points.length;
    index += 1
  ) {
    commands.push(
      `L ${roundCoordinate(
        points[index].x
      )} ${roundCoordinate(
        points[index].y
      )}`
    )
  }

  return commands.join(
    ' '
  )
}

/*
 * Synthetic fallback only.
 *
 * Keep the previous polished curve for states where no routed
 * geometry is available. This is never used once Mapbox has
 * returned actual street geometry.
 */
function buildSmoothPath(
  points:
    ProjectedPoint[]
): string | null {
  if (
    points.length <
    2
  ) {
    return null
  }

  if (
    points.length ===
    2
  ) {
    return [
      `M ${roundCoordinate(
        points[0].x
      )} ${roundCoordinate(
        points[0].y
      )}`,
      `L ${roundCoordinate(
        points[1].x
      )} ${roundCoordinate(
        points[1].y
      )}`,
    ].join(
      ' '
    )
  }

  const commands = [
    `M ${roundCoordinate(
      points[0].x
    )} ${roundCoordinate(
      points[0].y
    )}`,
  ]

  for (
    let index = 1;
    index <
    points.length -
      1;
    index += 1
  ) {
    const current =
      points[index]

    const next =
      points[
        index + 1
      ]

    const midpoint = {
      x:
        (
          current.x +
          next.x
        ) /
        2,

      y:
        (
          current.y +
          next.y
        ) /
        2,
    }

    commands.push(
      [
        'Q',
        roundCoordinate(
          current.x
        ),
        roundCoordinate(
          current.y
        ),
        roundCoordinate(
          midpoint.x
        ),
        roundCoordinate(
          midpoint.y
        ),
      ].join(
        ' '
      )
    )
  }

  const previous =
    points[
      points.length -
      2
    ]

  const last =
    points[
      points.length -
      1
    ]

  commands.push(
    [
      'Q',
      roundCoordinate(
        previous.x
      ),
      roundCoordinate(
        previous.y
      ),
      roundCoordinate(
        last.x
      ),
      roundCoordinate(
        last.y
      ),
    ].join(
      ' '
    )
  )

  return commands.join(
    ' '
  )
}

function roundCoordinate(
  value:
    number
): number {
  return (
    Math.round(
      value *
      100
    ) /
    100
  )
}

function normalizeText(
  value:
    unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}

function normalizeLatitude(
  value:
    unknown
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >=
      -90 &&
    value <=
      90
  )
    ? value
    : null
}

function normalizeLongitude(
  value:
    unknown
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >=
      -180 &&
    value <=
      180
  )
    ? value
    : null
}

function truncateSvgLabel(
  value:
    string,
  maxLength:
    number
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value
  }

  return `${value.slice(
    0,
    Math.max(
      1,
      maxLength -
      1
    )
  )}…`
}

function isAbortError(
  error:
    unknown
): boolean {
  return (
    error instanceof
      DOMException &&
    error.name ===
      'AbortError'
  )
}