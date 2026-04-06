'use client'

import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
} from 'react-leaflet'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
import { getCityNow } from '@/lib/getCityNow'

import type { Venue } from '@/types/venue'

import 'leaflet/dist/leaflet.css'

const USA_CENTER: [number, number] = [37.8, -96.9]
const USA_ZOOM = 4
const DEFAULT_FOCUS_ZOOM = 16

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
  searchTerm?: string
  showLiveEventsOnly?: boolean
  markerDisplayMode?: 'color' | 'emoji'
  onCityChange?: (city: string | null) => void
  onMapClick?: (lat: number, lon: number) => void
  customStart?: { lat: number; lon: number } | null
}

export default function MapCanvas({
  route,
  travelMode,
  themeId,
  searchTerm = '',
  showLiveEventsOnly = false,
  markerDisplayMode = 'color',
  onCityChange,
  onMapClick,
  customStart,
}: Props) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showCitySelector, setShowCitySelector] = useState(true)
  const [enableScrollZoom, setEnableScrollZoom] = useState(false)
  const [returnFocusZoom, setReturnFocusZoom] = useState<number | null>(null)

  // 🔥 Live minute tick for real-time marker updates
  const [minuteTick, setMinuteTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMinuteTick((prev) => prev + 1)
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Record<string, LeafletMarker>>({})

  // ✅ Canonical city-relative time (single source of truth)
  const nowForCity = useMemo(() => {
    return selectedCity ? getCityNow(selectedCity) : null
  }, [selectedCity, minuteTick])

  // ✅ Custom Start Icon (hydration-safe)
  const customStartIcon = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const L = require('leaflet')

    return L.divIcon({
      className: '',
      html: `<div style="font-size: 28px;">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    })
  }, [])

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
    allVenues = [],
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

  // ✅ Restore city / zoom context from richer back URL
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const cityParam = params.get('city')
    const zoomParam = params.get('zoom')

    if (cityParam) {
      setSelectedCity(cityParam)
      setShowCitySelector(false)
      onCityChange?.(cityParam)
    }

    if (zoomParam) {
      const parsedZoom = parseInt(zoomParam, 10)
      if (Number.isFinite(parsedZoom)) {
        setReturnFocusZoom(parsedZoom)
      }
    }
  }, [onCityChange])

  // ✅ Default city centering when no explicit venue-focus coords are present
  useEffect(() => {
    if (!selectedCity || !mapRef.current || customStart) return
    const config = CITY_CONFIGS[selectedCity]
    if (config) {
      mapRef.current.setView(config.center, config.zoom)
    }
  }, [selectedCity, customStart])

  // ✅ Venue-return focus: center on explicit lat/lon when provided
  useEffect(() => {
    if (!mapRef.current || !customStart) return

    const focusZoom =
      returnFocusZoom ?? (selectedCity ? Math.max(mapZoom, DEFAULT_FOCUS_ZOOM) : DEFAULT_FOCUS_ZOOM)

    mapRef.current.setView([customStart.lat, customStart.lon], focusZoom)
  }, [customStart, selectedCity, mapZoom, returnFocusZoom])

  const filteredVenues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return venues

    return allVenues.filter((venue) => {
      const nameMatch = venue.name?.toLowerCase().includes(term)
      const vibeMatch = venue.vibe?.toLowerCase().includes(term)

      const typeArray = Array.isArray(venue.type)
        ? venue.type
        : typeof venue.type === 'string'
          ? venue.type.split(',').map((t) => t.trim())
          : []

      const typeMatch = typeArray.some((t) =>
        t.toLowerCase().includes(term)
      )

      const tagsArray = Array.isArray(venue.tags)
        ? venue.tags
        : typeof venue.tags === 'string'
          ? venue.tags.split(',').map((t) => t.trim())
          : []

      const tagsMatch = tagsArray.some((tag) =>
        tag.toLowerCase().includes(term)
      )

      return nameMatch || vibeMatch || typeMatch || tagsMatch
    })
  }, [allVenues, venues, searchTerm])

  return (
    <div className="h-screen w-screen relative">
      <div className="fixed bottom-3 right-3 z-[2000]">
        <button
          onClick={() => setShowCitySelector((prev) => !prev)}
          className="bg-black/80 text-white px-2 py-1 rounded text-xs shadow backdrop-blur-sm"
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
          defaultCenter={customStart ? [customStart.lat, customStart.lon] : mapCenter}
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
          nowForCity &&
          (visibleRoute.length > 1 ? visibleRoute : filteredVenues).map(
            (venue: Venue, idx: number) => (
              <VenueMarker
                key={venue.id}
                venue={venue}
                index={idx}
                city={selectedCity}
                nowForCity={nowForCity}
                isRouteMode={visibleRoute.length > 0}
                markerDisplayMode={markerDisplayMode}
                markerRefs={markerRefs}
                eventsByVenueId={eventsByVenueId}
              />
            )
          )}

        {userPosition && (
          <UserLocationMarker position={userPosition} />
        )}

        {customStart && customStartIcon && (
          <Marker
            position={[customStart.lat, customStart.lon]}
            icon={customStartIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onMapClick?.(lat, lng)
              },
            }}
          />
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