'use client'

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import type {
  DivIcon,
  Map as LeafletMap,
} from 'leaflet'
import {
  CARTO_DARK_BASEMAP_URL,
  CARTO_BASEMAP_ATTRIBUTION,
} from '@/lib/maps/basemaps'
import type { Venue } from '@/types/venue'
import { logEvent } from '@/lib/logEvent'
import { getRouteStopRole } from '@/lib/maps/markerScoring'

import 'leaflet/dist/leaflet.css'
import '@/components/maps/map-markers.css'

type SavedMapCity =
  | 'atl'
  | 'nyc'
  | 'lisbon'
  | 'porto'
  | 'london'
  | 'la'

type MapboxDirectionsResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: Array<
        [longitude: number, latitude: number]
      >
    }
  }>
}

const defaultCenter: Record<
  SavedMapCity,
  [number, number]
> = {
  atl: [33.749, -84.388],
  nyc: [40.73061, -73.935242],
  lisbon: [38.7223, -9.1393],
  porto: [41.1579, -8.6291],
  london: [51.5072, -0.1276],
  la: [34.0522, -118.2437],
}

function isValidCoordinate(
  venue: Venue
): boolean {
  return (
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lon) &&
    venue.lat >= -90 &&
    venue.lat <= 90 &&
    venue.lon >= -180 &&
    venue.lon <= 180
  )
}

function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !==
      'function'
  ) {
    return false
  }

  return window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
}

function escapeHtml(
  value: string
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function createSavedRouteMarkerIcon(
  index: number,
  routeLength: number
): DivIcon | null {
  if (
    typeof window === 'undefined'
  ) {
    return null
  }

  const L = require('leaflet')

  const routeRole =
    getRouteStopRole(
      index,
      routeLength
    )

  const stopNumber =
    index + 1

  const roleLabel =
    routeRole === 'start'
      ? 'Start'
      : routeRole === 'end'
        ? 'Finish'
        : `Stop ${stopNumber}`

  const safeRoleLabel =
    escapeHtml(roleLabel)

  const roleClass =
    routeRole === 'start'
      ? 'roam-route-marker--start'
      : routeRole === 'end'
        ? 'roam-route-marker--end'
        : 'roam-route-marker--middle'

  const markerLabel =
    routeRole === 'start'
      ? 'S'
      : routeRole === 'end'
        ? '✓'
        : String(stopNumber)

  return L.divIcon({
    className:
      'roam-route-marker-container',
    html: `
      <div
        class="roam-route-marker ${roleClass}"
        role="img"
        aria-label="${safeRoleLabel}"
        title="${safeRoleLabel}"
      >
        <span
          class="roam-route-marker__halo"
          aria-hidden="true"
        ></span>

        <span
          class="roam-route-marker__surface"
          aria-hidden="true"
        >
          <span
            class="roam-route-marker__number"
          >
            ${markerLabel}
          </span>
        </span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
    tooltipAnchor: [0, -22],
  })
}

function MapRefSetter({
  mapRef,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map

    const routePane =
      map.getPane(
        'roam-saved-route-pane'
      ) ??
      map.createPane(
        'roam-saved-route-pane'
      )

    routePane.style.zIndex = '420'
    routePane.style.pointerEvents =
      'none'

    const timeout =
      window.setTimeout(
        () => {
          map.invalidateSize()
        },
        200
      )

    return () => {
      window.clearTimeout(
        timeout
      )

      mapRef.current = null
    }
  }, [map, mapRef])

  return null
}

async function fetchRoutePolyline(
  venues: readonly Venue[],
  token: string,
  signal: AbortSignal
): Promise<
  Array<[number, number]>
> {
  const validVenues =
    venues.filter(
      isValidCoordinate
    )

  if (
    validVenues.length < 2
  ) {
    return []
  }

  const coordinates =
    validVenues
      .map(
        (venue) =>
          `${venue.lon},${venue.lat}`
      )
      .join(';')

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${token}`

  const response =
    await fetch(url, {
      signal,
    })

  if (!response.ok) {
    throw new Error(
      `Mapbox directions failed: ${response.status}`
    )
  }

  const data =
    (await response.json()) as MapboxDirectionsResponse

  return (
    data.routes?.[0]
      ?.geometry
      ?.coordinates
      ?.filter(
        (
          coordinate
        ): coordinate is [
          number,
          number,
        ] =>
          Array.isArray(
            coordinate
          ) &&
          coordinate.length >= 2 &&
          Number.isFinite(
            coordinate[0]
          ) &&
          Number.isFinite(
            coordinate[1]
          )
      )
      .map(
        ([longitude, latitude]) => [
          latitude,
          longitude,
        ]
      ) ?? []
  )
}

export default function MapCanvasSaved({
  venues,
  city,
}: {
  venues: Venue[]
  city: SavedMapCity
}) {
  const mapRef =
    useRef<LeafletMap | null>(
      null
    )

  const [
    polyline,
    setPolyline,
  ] = useState<
    Array<[number, number]>
  >([])

  const [
    enableScrollZoom,
    setEnableScrollZoom,
  ] = useState(false)

  const [
    hasMounted,
    setHasMounted,
  ] = useState(false)

  const validVenues =
    useMemo(
      () =>
        venues.filter(
          isValidCoordinate
        ),
      [venues]
    )

  const markerIcons =
    useMemo(
      () =>
        validVenues.map(
          (
            _venue,
            index
          ) =>
            createSavedRouteMarkerIcon(
              index,
              validVenues.length
            )
        ),
      [validVenues]
    )

  useEffect(() => {
    setHasMounted(true)

    if (
      typeof window ===
      'undefined'
    ) {
      return
    }

    const updateScrollZoom =
      () => {
        setEnableScrollZoom(
          window.innerWidth >=
            768
        )
      }

    updateScrollZoom()

    window.addEventListener(
      'resize',
      updateScrollZoom
    )

    return () => {
      window.removeEventListener(
        'resize',
        updateScrollZoom
      )
    }
  }, [])

  useEffect(() => {
    const token =
      process.env
        .NEXT_PUBLIC_MAPBOX_TOKEN ??
      ''

    if (
      !token ||
      validVenues.length < 2
    ) {
      setPolyline([])
      return
    }

    const controller =
      new AbortController()

    let active = true

    void fetchRoutePolyline(
      validVenues,
      token,
      controller.signal
    )
      .then(
        (nextPolyline) => {
          if (active) {
            setPolyline(
              nextPolyline
            )
          }
        }
      )
      .catch(
        (error: unknown) => {
          if (
            error instanceof
              DOMException &&
            error.name ===
              'AbortError'
          ) {
            return
          }

          if (
            error instanceof Error &&
            error.name ===
              'AbortError'
          ) {
            return
          }

          console.error(
            '[MapCanvasSaved] Route fetch failed:',
            error
          )

          if (active) {
            setPolyline([])
          }
        }
      )

    return () => {
      active = false
      controller.abort()
    }
  }, [validVenues])

  useEffect(() => {
    if (
      !mapRef.current ||
      !hasMounted ||
      validVenues.length === 0
    ) {
      return
    }

    const L =
      require('leaflet')

    const bounds =
      L.latLngBounds(
        validVenues.map(
          (venue) => [
            venue.lat,
            venue.lon,
          ]
        )
      )

    if (
      polyline.length > 0
    ) {
      bounds.extend(
        polyline
      )
    }

    const reduceMotion =
      prefersReducedMotion()

    mapRef.current.fitBounds(
      bounds,
      {
        paddingTopLeft: [
          48,
          88,
        ],
        paddingBottomRight: [
          48,
          120,
        ],
        animate:
          !reduceMotion,
        duration:
          reduceMotion
            ? 0
            : 0.8,
        maxZoom: 16,
      }
    )
  }, [
    validVenues,
    polyline,
    hasMounted,
  ])

  useEffect(() => {
    venues.forEach(
      (
        venue,
        index
      ) => {
        if (!venue?.id) {
          return
        }

        logEvent(
          'saved_crawl_map_view',
          {
            venue_id:
              venue.id,
            metadata: {
              screen:
                'saved_crawl_map',
              city,
              position_in_crawl:
                index,
            },
          }
        )
      }
    )
  }, [venues, city])

  if (!hasMounted) {
    return null
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapContainer
        center={
          defaultCenter[city]
        }
        zoom={12}
        className="absolute inset-0"
        style={{
          height: '100%',
          width: '100%',
        }}
        scrollWheelZoom={
          enableScrollZoom
        }
        zoomControl={false}
        dragging
      >
        <MapRefSetter
          mapRef={mapRef}
        />

        <TileLayer
          url={CARTO_DARK_BASEMAP_URL}
          attribution={CARTO_BASEMAP_ATTRIBUTION}
        />

        {polyline.length >
          0 && (
          <Fragment>
            <Polyline
              pane="roam-saved-route-pane"
              positions={
                polyline
              }
              interactive={
                false
              }
              pathOptions={{
                color:
                  'rgba(0, 0, 0, 0.74)',
                weight: 10,
                opacity: 0.92,
                lineCap:
                  'round',
                lineJoin:
                  'round',
              }}
            />

            <Polyline
              pane="roam-saved-route-pane"
              positions={
                polyline
              }
              interactive={
                false
              }
              pathOptions={{
                color:
                  '#22d3ee',
                weight: 5,
                opacity: 0.97,
                lineCap:
                  'round',
                lineJoin:
                  'round',
              }}
            />
          </Fragment>
        )}

        {validVenues.map(
          (
            venue,
            index
          ) => {
            const icon =
              markerIcons[index]

            if (!icon) {
              return null
            }

            const routeRole =
              getRouteStopRole(
                index,
                validVenues.length
              )

            const tooltipLabel =
              routeRole ===
              'start'
                ? `Start · ${venue.name}`
                : routeRole ===
                    'end'
                  ? `Finish · ${venue.name}`
                  : `Stop ${index + 1} · ${venue.name}`

            return (
              <Marker
                key={
                  venue.id ??
                  venue.slug ??
                  `${venue.name}-${index}`
                }
                position={[
                  venue.lat,
                  venue.lon,
                ]}
                icon={icon}
                zIndexOffset={
                  routeRole ===
                  'start'
                    ? 700
                    : routeRole ===
                        'end'
                      ? 680
                      : 600
                }
                riseOnHover
                riseOffset={
                  250
                }
              >
                <Tooltip
                  direction="top"
                  offset={[
                    0,
                    -10,
                  ]}
                  opacity={
                    0.96
                  }
                >
                  {
                    tooltipLabel
                  }
                </Tooltip>

                <Popup>
                  <div className="w-52 space-y-2 text-sm text-zinc-900">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
                        {routeRole ===
                        'start'
                          ? 'Start'
                          : routeRole ===
                              'end'
                            ? 'Finish'
                            : `Stop ${index + 1}`}
                      </span>

                      <strong className="mt-0.5 block text-base leading-tight text-zinc-950">
                        {
                          venue.name
                        }
                      </strong>
                    </div>

                    {venue.cover && (
                      <img
                        src={
                          venue.cover.startsWith(
                            '/'
                          )
                            ? venue.cover
                            : `/${venue.cover}`
                        }
                        alt={
                          venue.name
                        }
                        className="h-32 w-full rounded-xl object-cover"
                      />
                    )}

                    {venue.link && (
                      <a
                        href={
                          venue.link
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
                      >
                        More Info
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          }
        )}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[400]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.3)_100%)]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(34,211,238,0.05),transparent_44%)]" />

        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/25 to-transparent" />
      </div>
    </div>
  )
}