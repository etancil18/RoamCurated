'use client'

import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useMap } from 'react-leaflet'
import type {
  LatLngBoundsExpression,
  LeafletMouseEvent,
  Map as LeafletMap,
} from 'leaflet'

import type { Venue } from '@/types/venue'
import { logEvent } from '@/lib/logEvent'

type Props = {
  city: string
  route?: Venue[]
  onMapClick?: (
    lat: number,
    lon: number
  ) => void
  defaultCenter: [
    number,
    number,
  ]
  setUserPosition: (
    pos: [
      number,
      number,
    ]
  ) => void
  mapRef: React.MutableRefObject<LeafletMap | null>
}

const USA_CENTER: [
  number,
  number,
] = [37.8, -96.9]

const USA_ZOOM = 4
const CITY_ZOOM = 12

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

export default function MapEffectController({
  city,
  route,
  onMapClick,
  defaultCenter,
  setUserPosition,
  mapRef,
}: Props) {
  const map = useMap()

  const hasAppliedPinFocusRef =
    useRef(false)

  const lastCityViewSignatureRef =
    useRef<string | null>(null)

  const lastRouteSignatureRef =
    useRef<string | null>(null)

  const lastGeolocationSignatureRef =
    useRef<string | null>(null)

  const setUserPositionRef =
    useRef(setUserPosition)

  const defaultLatitude =
    defaultCenter[0]

  const defaultLongitude =
    defaultCenter[1]

  const stableDefaultCenter =
    useMemo<
      [number, number]
    >(
      () => [
        defaultLatitude,
        defaultLongitude,
      ],
      [
        defaultLatitude,
        defaultLongitude,
      ]
    )

  const defaultCenterSignature =
    useMemo(
      () =>
        `${defaultLatitude.toFixed(6)}:${defaultLongitude.toFixed(6)}`,
      [
        defaultLatitude,
        defaultLongitude,
      ]
    )

  const isPinnedCenter =
    defaultLatitude !==
      USA_CENTER[0] ||
    defaultLongitude !==
      USA_CENTER[1]

  const validRoutePoints =
    useMemo<
      Array<
        [number, number]
      >
    >(() => {
      if (!route) {
        return []
      }

      return route
        .filter((venue) =>
          isValidCoordinate(
            venue.lat,
            venue.lon
          )
        )
        .map((venue) => [
          venue.lat,
          venue.lon,
        ])
    }, [route])

  const routeSignature =
    useMemo(
      () =>
        validRoutePoints
          .map(
            ([lat, lon]) =>
              `${lat.toFixed(6)},${lon.toFixed(6)}`
          )
          .join(';'),
      [validRoutePoints]
    )

  /*
   * Keep the latest parent callback available without making geolocation
   * restart whenever the callback identity changes.
   */
  useEffect(() => {
    setUserPositionRef.current =
      setUserPosition
  }, [setUserPosition])

  useEffect(() => {
    mapRef.current = map

    return () => {
      if (
        mapRef.current === map
      ) {
        mapRef.current =
          null
      }
    }
  }, [map, mapRef])

  useEffect(() => {
    const cityViewSignature =
      [
        city || 'usa',
        defaultCenterSignature,
        isPinnedCenter
          ? 'pinned'
          : 'standard',
      ].join(':')

    if (
      lastCityViewSignatureRef.current ===
      cityViewSignature
    ) {
      return
    }

    lastCityViewSignatureRef.current =
      cityViewSignature

    if (!city) {
      hasAppliedPinFocusRef.current =
        false

      lastRouteSignatureRef.current =
        null

      map.flyTo(
        USA_CENTER,
        USA_ZOOM,
        {
          animate: true,
          duration: 1.5,
        }
      )

      return
    }

    if (isPinnedCenter) {
      hasAppliedPinFocusRef.current =
        true

      return
    }

    hasAppliedPinFocusRef.current =
      false

    const timeout =
      window.setTimeout(() => {
        map.flyTo(
          stableDefaultCenter,
          CITY_ZOOM,
          {
            animate: true,
            duration: 1.75,
          }
        )
      }, 300)

    return () => {
      window.clearTimeout(
        timeout
      )
    }
  }, [
    city,
    map,
    stableDefaultCenter,
    defaultCenterSignature,
    isPinnedCenter,
  ])

  useEffect(() => {
    if (
      validRoutePoints.length <
      2
    ) {
      lastRouteSignatureRef.current =
        null

      return
    }

    if (
      hasAppliedPinFocusRef.current ||
      isPinnedCenter
    ) {
      return
    }

    if (
      lastRouteSignatureRef.current ===
      routeSignature
    ) {
      return
    }

    lastRouteSignatureRef.current =
      routeSignature

    const bounds:
      LatLngBoundsExpression =
        validRoutePoints

    map.flyToBounds(bounds, {
      paddingTopLeft: [
        50,
        88,
      ],
      paddingBottomRight: [
        50,
        96,
      ],
      animate: true,
      duration: 0.9,
    })
  }, [
    map,
    validRoutePoints,
    routeSignature,
    isPinnedCenter,
  ])

  useEffect(() => {
    if (!onMapClick) {
      return
    }

    const handleMapClick = (
      event: LeafletMouseEvent
    ) => {
      onMapClick(
        event.latlng.lat,
        event.latlng.lng
      )
    }

    map.on(
      'click',
      handleMapClick
    )

    return () => {
      map.off(
        'click',
        handleMapClick
      )
    }
  }, [
    map,
    onMapClick,
  ])

  useEffect(() => {
    const geolocationSignature =
      [
        city || 'usa',
        defaultCenterSignature,
      ].join(':')

    if (
      lastGeolocationSignatureRef.current ===
      geolocationSignature
    ) {
      return
    }

    lastGeolocationSignatureRef.current =
      geolocationSignature

    if (
      typeof window ===
        'undefined' ||
      !window.navigator
        ?.geolocation
    ) {
      setUserPositionRef.current(
        stableDefaultCenter
      )

      return
    }

    let active = true

    const geolocation =
      window.navigator
        .geolocation

    geolocation.getCurrentPosition(
      (position) => {
        if (!active) {
          return
        }

        setUserPositionRef.current(
          [
            position.coords
              .latitude,
            position.coords
              .longitude,
          ]
        )
      },
      (error) => {
        if (!active) {
          return
        }

        console.warn(
          'Geolocation error:',
          error
        )

        setUserPositionRef.current(
          stableDefaultCenter
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )

    return () => {
      active = false
    }
  }, [
    city,
    defaultCenterSignature,
    stableDefaultCenter,
  ])

  useEffect(() => {
    logEvent(
      'map_opened',
      {
        metadata: {
          screen: 'map',
          city,
        },
      }
    )
  }, [city])

  return null
}