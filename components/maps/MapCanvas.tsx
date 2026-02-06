'use client'

import {
  MapContainer,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

import {
  VenueMarker,
  RouteControl,
  UserLocationMarker,
  MapEffectController,
  CityOverviewMarkers,
} from '@/components/maps/map-dynamic-wrapper'

import CitySelector from './CitySelector'

import { useUserLocation } from '@/hooks/useUserLocation'
import { useMapInitialization } from '@/hooks/useMapInitialization'
import { useCityData } from '@/hooks/useCityData'

import { CITY_CONFIGS } from '@/config/cities'
import { THEME_COLORS } from '@/config/themeColors'

import type { Venue } from '@/types/venue'

import 'leaflet/dist/leaflet.css'

const USA_CENTER: [number, number] = [37.8, -96.9]
const USA_ZOOM = 4

function MapRefSetter({
  mapRef,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()
  useMapInitialization(map)

  useEffect(() => {
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 300)

    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])

  return null
}

type Props = {
  route?: Venue[]
  travelMode: 'walking' | 'cycling' | 'driving'
  themeId?: string
  showLiveEventsOnly?: boolean
  onCityChange?: (city: string | null) => void
  onMapClick?: (lat: number, lon: number) => void
}

export default function MapCanvas({
  route,
  travelMode,
  themeId,
  showLiveEventsOnly = false,
  onCityChange,
  onMapClick,
}: Props) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showCitySelector, setShowCitySelector] = useState(true)
  const [enableScrollZoom, setEnableScrollZoom] = useState(false)

  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Record<string, LeafletMarker>>({})

  // ✅ SSR-safe Leaflet icon patch
  useEffect(() => {
    if (typeof window === 'undefined') return

    const L = require('leaflet')
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    })
  }, [])

  const handleSelectCity = useCallback(
    (slug: string | null) => {
      setSelectedCity(slug)
      setShowCitySelector(false)
      onCityChange?.(slug)
    },
    [onCityChange]
  )

  const cityConfig = selectedCity ? CITY_CONFIGS[selectedCity] : null
  const mapCenter = cityConfig?.center ?? USA_CENTER
  const mapZoom = cityConfig?.zoom ?? USA_ZOOM

  const {
    venues = [],
    eventsByVenueId = {},
  } = useCityData(selectedCity, { showLiveEventsOnly })

  const userPosition = useUserLocation({ fallback: mapCenter })

  const visibleRoute =
    route && route.length > 1 ? route : []

  const lineColor =
    THEME_COLORS[themeId ?? ''] ?? 'cyan'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setEnableScrollZoom(window.innerWidth >= 768)
    }
  }, [])

  useEffect(() => {
    if (!selectedCity || !mapRef.current) return
    const config = CITY_CONFIGS[selectedCity]
    if (config) {
      mapRef.current.setView(config.center, config.zoom)
    }
  }, [selectedCity])

  return (
    <div className="h-screen w-screen relative">
      <div className="absolute bottom-11 right-4 z-[1100]">
        <button
          onClick={() => setShowCitySelector(prev => !prev)}
          className="bg-black/80 text-white px-3 py-1 rounded-md shadow"
        >
          {showCitySelector ? 'Hide Cities' : '🌆 Choose City'}
        </button>
      </div>

      {showCitySelector && (
        <CitySelector
          selectedCity={selectedCity}
          onSelectCity={handleSelectCity}
        />
      )}

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100vh', width: '100vw' }}
        zoomControl={false}
        scrollWheelZoom={enableScrollZoom}
        dragging
      >
        <MapRefSetter mapRef={mapRef} />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />

        <MapEffectController
          city={selectedCity ?? ''}
          route={visibleRoute}
          defaultCenter={mapCenter}
          setUserPosition={() => {}}
          mapRef={mapRef}
          onMapClick={onMapClick}
        />

        {!selectedCity && (
          <CityOverviewMarkers
            onSelectCity={handleSelectCity}
            excludedCity={selectedCity}
          />
        )}

        {selectedCity &&
          (visibleRoute.length > 1 ? visibleRoute : venues).map(
            (venue: Venue, idx: number) => (
              <VenueMarker
                key={venue.id}
                venue={venue}
                index={idx}
                city={selectedCity}
                isRouteMode={visibleRoute.length > 0}
                markerRefs={markerRefs}
                eventsByVenueId={eventsByVenueId}
              />
            )
          )}

        {userPosition && (
          <UserLocationMarker position={userPosition} />
        )}

        {visibleRoute.length > 1 && mapRef.current && (
          <RouteControl
            map={mapRef.current}
            route={visibleRoute}
            travelMode={travelMode}
            color={lineColor}
          />
        )}
      </MapContainer>
    </div>
  )
}
