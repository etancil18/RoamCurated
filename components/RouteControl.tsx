'use client'

// 🚨 Tripwire — this file must never be evaluated during SSR
if (typeof window === 'undefined') {
  throw new Error(
    'RouteControl.tsx must only be imported via dynamic({ ssr: false })'
  )
}

import { Fragment, useEffect, useMemo, useState } from 'react'
import type {
  LatLngExpression,
  Map as LeafletMap,
} from 'leaflet'
import { Polyline } from 'react-leaflet'

import type { Venue } from '@/types/venue'
import RoutePolyline from './RoutePolyline'
import { logEvent } from '@/lib/logEvent'

type RouteControlProps = {
  map: LeafletMap
  route: Venue[]
  color?: string
  travelMode: 'walking' | 'cycling' | 'driving'
}

type MapboxDirectionsResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: Array<
        [longitude: number, latitude: number]
      >
    }
  }>
}

const ROUTE_PANE_NAME = 'roam-route-pane'
const ROUTE_PANE_Z_INDEX = 420

function normalizeCoords(
  lat: number,
  lon: number
): [number, number] {
  const needsFlip =
    lat < -90 || lat > 90

  return needsFlip
    ? [lon, lat]
    : [lat, lon]
}

function isValidCoordinate(
  lat: number,
  lon: number
): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  )
}

function getRouteSignature(
  route: Venue[]
): string {
  return route
    .map((venue) => {
      const [lat, lon] =
        normalizeCoords(
          venue.lat,
          venue.lon
        )

      return `${lat.toFixed(6)},${lon.toFixed(6)}`
    })
    .join(';')
}

export default function RouteControl({
  map,
  route,
  color = 'cyan',
  travelMode,
}: RouteControlProps) {
  const [
    polylineCoords,
    setPolylineCoords,
  ] = useState<LatLngExpression[]>([])

  const routeSignature = useMemo(
    () => getRouteSignature(route),
    [route]
  )

  /*
   * Keep the route beneath Leaflet's marker pane.
   *
   * Leaflet's default marker pane uses z-index 600, so 420 keeps the route
   * clearly below venue, route-stop, user-location, and custom-start markers.
   */
  useEffect(() => {
    const existingPane =
      map.getPane(ROUTE_PANE_NAME)

    const routePane =
      existingPane ??
      map.createPane(
        ROUTE_PANE_NAME
      )

    routePane.style.zIndex =
      String(ROUTE_PANE_Z_INDEX)

    routePane.style.pointerEvents =
      'none'
  }, [map])

  useEffect(() => {
    if (
      !map ||
      route.length < 2
    ) {
      setPolylineCoords([])
      return
    }

    const MAPBOX_TOKEN: string =
      process.env
        .NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

    if (!MAPBOX_TOKEN) {
      console.error(
        '❌ Missing Mapbox token'
      )

      setPolylineCoords([])
      return
    }

    const controller =
      new AbortController()

    let cancelled = false

    async function loadRoute() {
      try {
        const validWaypoints =
          route
            .map((venue) =>
              normalizeCoords(
                venue.lat,
                venue.lon
              )
            )
            .filter(
              ([lat, lon]) =>
                isValidCoordinate(
                  lat,
                  lon
                )
            )

        if (
          validWaypoints.length < 2
        ) {
          setPolylineCoords([])
          return
        }

        const coordinates =
          validWaypoints
            .map(
              ([lat, lon]) =>
                `${lon},${lat}`
            )
            .join(';')

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/${travelMode}/${coordinates}` +
          `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`

        const response =
          await fetch(url, {
            signal:
              controller.signal,
          })

        if (!response.ok) {
          throw new Error(
            `Mapbox directions failed: ${response.status}`
          )
        }

        const data =
          (await response.json()) as MapboxDirectionsResponse

        const coords: Array<
          [number, number]
        > =
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
                coordinate.length >=
                  2 &&
                Number.isFinite(
                  coordinate[0]
                ) &&
                Number.isFinite(
                  coordinate[1]
                )
            )
            .map(
              ([lng, lat]) => [
                lat,
                lng,
              ]
            ) ?? []

        if (cancelled) {
          return
        }

        if (
          coords.length === 0
        ) {
          setPolylineCoords([])
          return
        }

        setPolylineCoords(
          coords
        )

        logEvent(
          'route_rendered',
          {
            metadata: {
              num_stops:
                route.length,
              travel_mode:
                travelMode,
              polyline_length:
                coords.length,
            },
          }
        )
      } catch (
        error: unknown
      ) {
        if (
          error instanceof DOMException &&
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
          'Routing error:',
          error
        )

        if (!cancelled) {
          setPolylineCoords([])
        }
      }
    }

    void loadRoute()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    map,
    route,
    routeSignature,
    travelMode,
  ])

  if (
    polylineCoords.length === 0
  ) {
    return null
  }

  return (
    <RoutePolyline
      coords={polylineCoords}
      color={color}
      render={({
        positions,
        color:
          resolvedColor,
      }) => (
        <Fragment>
          <Polyline
            pane={ROUTE_PANE_NAME}
            positions={
              positions
            }
            interactive={false}
            pathOptions={{
              color:
                'rgba(0, 0, 0, 0.72)',
              weight: 10,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />

          <Polyline
            pane={ROUTE_PANE_NAME}
            positions={
              positions
            }
            interactive={false}
            pathOptions={{
              color:
                resolvedColor,
              weight: 5,
              opacity: 0.96,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Fragment>
      )}
    />
  )
}