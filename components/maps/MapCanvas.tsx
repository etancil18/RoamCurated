'use client'

import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  useMapEvents,
} from 'react-leaflet'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  LatLngBounds,
} from 'leaflet'

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

function normalizeSearchableList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item: string) => item.trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value.split(',').map((item: string) => item.trim()).filter(Boolean)
  }

  return []
}

function getVenueRenderLimit(zoom: number): number {
  if (zoom < 11) return 0
  if (zoom < 12) return 10
  if (zoom < 13) return 24
  if (zoom < 14) return 45
  if (zoom < 15) return 75
  if (zoom < 16) return 120
  return 220
}

function distanceScoreFromCenter(
  venue: Venue,
  center: { lat: number; lng: number } | null
): number {
  if (!center) return 0
  if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lon)) return -100000

  const latDiff = venue.lat - center.lat
  const lonDiff = venue.lon - center.lng
  return -Math.sqrt(latDiff * latDiff + lonDiff * lonDiff)
}

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

function MapViewportTracker({
  onViewportChange,
}: {
  onViewportChange: (viewport: {
    zoom: number
    bounds: LatLngBounds
    center: { lat: number; lng: number }
  }) => void
}) {
  const map = useMap()

  const updateViewport = useCallback(() => {
    const center = map.getCenter()

    onViewportChange({
      zoom: map.getZoom(),
      bounds: map.getBounds(),
      center: {
        lat: center.lat,
        lng: center.lng,
      },
    })
  }, [map, onViewportChange])

  useEffect(() => {
    updateViewport()
  }, [updateViewport])

  useMapEvents({
    zoomend: updateViewport,
    moveend: updateViewport,
  })

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
  isPanelOpen?: boolean
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
  isPanelOpen = false,
}: Props) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showCitySelector, setShowCitySelector] = useState(true)
  const [enableScrollZoom, setEnableScrollZoom] = useState(false)
  const [returnFocusZoom, setReturnFocusZoom] = useState<number | null>(null)
  const [currentZoom, setCurrentZoom] = useState(USA_ZOOM)
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null)
  const [mapCenterPoint, setMapCenterPoint] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const [minuteTick, setMinuteTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMinuteTick((prev) => prev + 1)
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Record<string, LeafletMarker>>({})
  const viewportSignatureRef = useRef<string | null>(null)

  const nowForCity = useMemo(() => {
    return selectedCity ? getCityNow(selectedCity) : null
  }, [selectedCity, minuteTick])

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

  const handleViewportChange = useCallback(
    ({
      zoom,
      bounds,
      center,
    }: {
      zoom: number
      bounds: LatLngBounds
      center: { lat: number; lng: number }
    }) => {
      const nextSignature = [
        zoom,
        bounds.toBBoxString(),
        center.lat.toFixed(5),
        center.lng.toFixed(5),
      ].join(':')

      if (viewportSignatureRef.current === nextSignature) return

      viewportSignatureRef.current = nextSignature
      setCurrentZoom(zoom)
      setMapBounds(bounds)
      setMapCenterPoint(center)
    },
    []
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setEnableScrollZoom(window.innerWidth >= 768)
    }
  }, [])

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

  useEffect(() => {
    if (!selectedCity || !mapRef.current || customStart) return
    const config = CITY_CONFIGS[selectedCity]
    if (config) {
      mapRef.current.setView(config.center, config.zoom)
    }
  }, [selectedCity, customStart])

  useEffect(() => {
    if (!mapRef.current || !customStart) return

    if (returnFocusZoom !== null) {
      const focusZoom =
        selectedCity ? Math.max(mapZoom, returnFocusZoom) : returnFocusZoom

      mapRef.current.setView([customStart.lat, customStart.lon], focusZoom, {
        animate: true,
      })
      return
    }

    mapRef.current.panTo([customStart.lat, customStart.lon], {
      animate: true,
    })
  }, [customStart, selectedCity, mapZoom, returnFocusZoom])

  useEffect(() => {
    if (!mapRef.current || visibleRoute.length < 2) return

    const avgLat =
      visibleRoute.reduce((sum, venue) => sum + venue.lat, 0) / visibleRoute.length
    const avgLon =
      visibleRoute.reduce((sum, venue) => sum + venue.lon, 0) / visibleRoute.length

    mapRef.current.panTo([avgLat, avgLon], {
      animate: true,
    })
  }, [visibleRoute])

  const filteredVenues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return venues

    return allVenues.filter((venue) => {
      const nameMatch = venue.name?.toLowerCase().includes(term)

      const vibeArray = normalizeSearchableList(venue.vibe)
      const vibeMatch = vibeArray.some((vibe: string) =>
        vibe.toLowerCase().includes(term)
      )

      const typeArray = normalizeSearchableList(venue.type)
      const typeMatch = typeArray.some((t: string) =>
        t.toLowerCase().includes(term)
      )

      const tagsArray = normalizeSearchableList(venue.tags)
      const tagsMatch = tagsArray.some((tag) =>
        tag.toLowerCase().includes(term)
      )

      return nameMatch || vibeMatch || typeMatch || tagsMatch
    })
  }, [allVenues, venues, searchTerm])

  const renderedVenues = useMemo(() => {
    if (visibleRoute.length > 1) return visibleRoute
    if (!selectedCity) return []

    const renderLimit = getVenueRenderLimit(currentZoom)
    if (renderLimit <= 0) return []

    const term = searchTerm.trim().toLowerCase()
    const hasSearch = term.length > 0

    const candidates = filteredVenues.filter((venue) => {
      if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lon)) {
        return false
      }

      if (!mapBounds) return true

      return mapBounds.contains([venue.lat, venue.lon])
    })

    return candidates
      .map((venue) => {
        const hasEvent = Boolean(eventsByVenueId[venue.id]?.length)
        const typeList = normalizeSearchableList(venue.type)
        const tagList = normalizeSearchableList(venue.tags)
        const vibeList = normalizeSearchableList(venue.vibe)

        const searchable = [
          venue.name ?? '',
          ...typeList,
          ...tagList,
          ...vibeList,
        ]
          .join(' ')
          .toLowerCase()

        const searchBoost = hasSearch && searchable.includes(term) ? 90 : 0
        const eventBoost = hasEvent ? 140 : 0
        const densityBoost = currentZoom >= 15 ? 20 : 0
        const centerScore = distanceScoreFromCenter(venue, mapCenterPoint) * 400

        return {
          venue,
          score: eventBoost + searchBoost + densityBoost + centerScore,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, renderLimit)
      .map((entry) => entry.venue)
  }, [
    visibleRoute,
    selectedCity,
    currentZoom,
    searchTerm,
    filteredVenues,
    mapBounds,
    mapCenterPoint,
    eventsByVenueId,
  ])

  return (
    <div className="h-screen w-screen relative">
      <div className="fixed left-3 top-[calc(4rem+3.25rem)] z-[4590]">
        <button
          type="button"
          onClick={() => setShowCitySelector((prev) => !prev)}
          className="rounded-lg bg-black/80 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90"
        >
          {showCitySelector ? 'Hide Cities' : '🌆 Choose City'}
        </button>
      </div>

      {showCitySelector && (
        <CitySelector
          selectedCity={selectedCity}
          onSelectCity={handleSelectCity}
          panelOpen={isPanelOpen}
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

        <MapViewportTracker onViewportChange={handleViewportChange} />

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
          renderedVenues.map((venue: Venue, idx: number) => (
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
          ))}

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