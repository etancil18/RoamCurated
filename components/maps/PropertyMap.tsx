'use client'

import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from 'react-leaflet'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
} from 'leaflet'
import {
  CARTO_DARK_BASEMAP_URL,
  CARTO_BASEMAP_ATTRIBUTION,
} from '@/lib/maps/basemaps'
import { DateTime } from 'luxon'

import { UserLocationMarker } from '@/components/maps/map-dynamic-wrapper'

import VenueMarker from '@/components/maps/VenueMarker'
import PropertyRouteControl from '@/components/maps/PropertyRouteControl'

import { getCityNow } from '@/lib/getCityNow'
import { useUserLocation } from '@/hooks/useUserLocation'

import type { Venue } from '@/types/venue'

import 'leaflet/dist/leaflet.css'

type Property = {
  id: string
  name: string
  lat: number
  lon: number
  city: string
}

type Props = {
  property: Property
  venues: Venue[]
  travelMode?: 'walking' | 'cycling' | 'driving'

  /**
   * Retained for compatibility with existing callers.
   *
   * Property venue markers now always use the shared
   * type-derived emoji marker initiative.
   */
  markerDisplayMode?: 'color' | 'emoji'

  /**
   * Retained for compatibility with existing callers.
   *
   * VenueMarker currently owns the shared popup
   * presentation, so this value is not forwarded.
   */
  venueMarkerVariant?: 'default' | 'guide'
}

const DEFAULT_ZOOM = 15
const MAX_ROUTE_STOPS = 10

const EMPTY_EVENTS_BY_VENUE_ID: Record<
  string,
  any[]
> = {}

/* ------------------------------------------------ */
/* MapRefSetter — React-Leaflet safe map reference  */
/* ------------------------------------------------ */

function MapRefSetter({
  mapRef,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])

  return null
}

function getVenueKey(
  venue: Venue
): string | null {
  const key =
    venue.id ??
    venue.slug ??
    venue.name ??
    null

  return key === null
    ? null
    : String(key)
}

export default function PropertyMap({
  property,
  venues,
  travelMode = 'walking',
  markerDisplayMode = 'emoji',
  venueMarkerVariant = 'default',
}: Props) {
  void markerDisplayMode
  void venueMarkerVariant

  const mapRef =
    useRef<LeafletMap | null>(null)

  const markerRefs =
    useRef<
      Record<string, LeafletMarker>
    >({})

  const [
    activeRoute,
    setActiveRoute,
  ] = useState<Venue[]>([])

  const [
    scrollZoom,
    setScrollZoom,
  ] = useState(false)

  const propertyCenter: [
    number,
    number,
  ] = [
    property.lat,
    property.lon,
  ]

  /* ------------------------------------------------ */
  /* City-aware time                                  */
  /* ------------------------------------------------ */

  const nowForCity: DateTime =
    useMemo(() => {
      return getCityNow(
        property.city
      )
    }, [property.city])

  /* ------------------------------------------------ */
  /* User location                                    */
  /* ------------------------------------------------ */

  const userLocation =
    useUserLocation({
      fallback: propertyCenter,
    })

  /* ------------------------------------------------ */
  /* Property venue diagnostics                      */
  /* ------------------------------------------------ */

  useEffect(() => {
    console.log(
      '[PropertyMap venues received]',
      {
        property:
          property.name,

        propertyLat:
          property.lat,

        propertyLon:
          property.lon,

        venueCount:
          venues.length,

        venues:
          venues.map(
            (venue) => ({
              id:
                venue.id,

              name:
                venue.name,

              lat:
                venue.lat,

              lon:
                venue.lon,
            })
          ),
      }
    )
  }, [
    property.name,
    property.lat,
    property.lon,
    venues,
  ])

  /* ------------------------------------------------ */
  /* Scroll zoom guard                                */
  /* ------------------------------------------------ */

  useEffect(() => {
    if (
      typeof window !==
      'undefined'
    ) {
      setScrollZoom(
        window.innerWidth >= 768
      )
    }
  }, [])

  /* ------------------------------------------------ */
  /* Leaflet icon patch                               */
  /* ------------------------------------------------ */

  useEffect(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return
    }

    const L = require('leaflet')

    delete (
      L.Icon.Default
        .prototype as any
    )._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    })
  }, [])

  /* ------------------------------------------------ */
  /* Property icon                                    */
  /* ------------------------------------------------ */

  const propertyIcon =
    useMemo(() => {
      if (
        typeof window ===
        'undefined'
      ) {
        return undefined
      }

      const L =
        require('leaflet')

      return L.divIcon({
        className: '',
        html:
          '<div style="font-size:28px;">📍</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      })
    }, [])

  /* ------------------------------------------------ */
  /* Active route                                     */
  /* ------------------------------------------------ */

  const visibleRoute =
    useMemo(() => {
      if (
        !activeRoute ||
        activeRoute.length < 2
      ) {
        return []
      }

      return activeRoute.slice(
        0,
        MAX_ROUTE_STOPS
      )
    }, [activeRoute])

  const routeIndexByVenueKey =
    useMemo(() => {
      const lookup =
        new Map<string, number>()

      visibleRoute.forEach(
        (venue, routeIndex) => {
          const venueKey =
            getVenueKey(venue)

          if (venueKey) {
            lookup.set(
              venueKey,
              routeIndex
            )
          }
        }
      )

      return lookup
    }, [visibleRoute])

  /* ------------------------------------------------ */
  /* Crawl preview event                              */
  /* ------------------------------------------------ */

  useEffect(() => {
    function handlePreviewRoute(
      e: any
    ) {
      const venues =
        e?.detail?.venues

      if (
        !Array.isArray(venues)
      ) {
        return
      }

      setActiveRoute(venues)
    }

    window.addEventListener(
      'preview-property-crawl',
      handlePreviewRoute
    )

    return () => {
      window.removeEventListener(
        'preview-property-crawl',
        handlePreviewRoute
      )
    }
  }, [])

  /* ------------------------------------------------ */

  return (
    <div className="h-[400px] w-full overflow-hidden rounded-xl border">
      <MapContainer
        center={propertyCenter}
        zoom={DEFAULT_ZOOM}
        style={{
          height: '100%',
          width: '100%',
        }}
        scrollWheelZoom={
          scrollZoom
        }
        zoomControl
      >
        <MapRefSetter
          mapRef={mapRef}
        />

        <TileLayer
          url={CARTO_DARK_BASEMAP_URL}
          attribution={CARTO_BASEMAP_ATTRIBUTION}
        />

        {/* Property marker */}

        {propertyIcon && (
          <Marker
            position={
              propertyCenter
            }
            icon={propertyIcon}
          />
        )}

        {/* Venue markers */}

        {venues.map(
          (v, i) => {
            const venueKey =
              getVenueKey(v)

            const routeIndex =
              venueKey
                ? routeIndexByVenueKey.get(
                    venueKey
                  )
                : undefined

            const isVenueInRoute =
              typeof routeIndex ===
              'number'

            const normalizedVenue = {
              ...v,
              lat:
                typeof v.lat ===
                  'string'
                  ? parseFloat(
                      v.lat
                    )
                  : v.lat,
              lon:
                typeof v.lon ===
                  'string'
                  ? parseFloat(
                      v.lon
                    )
                  : v.lon,
            } as Venue

            return (
              <VenueMarker
                key={
                  venueKey ??
                  `${v.name}-${i}`
                }
                venue={
                  normalizedVenue
                }
                index={i}
                city={
                  property.city
                }
                nowForCity={
                  nowForCity
                }
                isRouteMode={
                  isVenueInRoute
                }
                markerScale={1}
                routeIndex={
                  routeIndex
                }
                routeLength={
                  visibleRoute.length
                }
                markerRefs={
                  markerRefs
                }
                eventsByVenueId={
                  EMPTY_EVENTS_BY_VENUE_ID
                }
                popupVariant="property"
                showPopup
              />
            )
          }
        )}

        {/* User location */}

        {userLocation && (
          <UserLocationMarker
            position={
              userLocation
            }
          />
        )}

        {/* Route preview */}

        {visibleRoute.length >
          1 &&
          mapRef.current && (
            <PropertyRouteControl
              map={
                mapRef.current
              }
              property={
                property
              }
              venues={
                visibleRoute
              }
              travelMode={
                travelMode
              }
            />
          )}
      </MapContainer>
    </div>
  )
}