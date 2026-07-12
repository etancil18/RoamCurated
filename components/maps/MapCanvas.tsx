'use client'

import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  DivIcon,
  LatLngBounds,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from 'leaflet'

import {
  CityOverviewMarkers,
  MapEffectController,
  RouteControl,
  UserLocationMarker,
  VenueClusterMarker,
  VenueMarker,
} from '@/components/maps/map-dynamic-wrapper'

import CitySelector from './CitySelector'
import MapControlRail from './MapControlRail'
import VenuePreviewSheet, {
  type VenuePreviewEvent,
} from './VenuePreviewSheet'

import { useCityData } from '@/hooks/useCityData'
import { useMapInitialization } from '@/hooks/useMapInitialization'
import { useUserLocation } from '@/hooks/useUserLocation'

import { CITY_CONFIGS } from '@/config/cities'
import { THEME_COLORS } from '@/config/themeColors'
import { getCityNow } from '@/lib/getCityNow'
import { getCustomStartIcon } from '@/lib/maps/icons'
import {
  clusterVenuesByGrid,
  type ClusterVenuesResult,
} from '@/lib/maps/clustering'
import {
  buildRouteIndexByVenueId,
  getMapDensityMode,
  getMarkerScale,
  getRouteStopRole,
} from '@/lib/maps/markerScoring'
import {
  getMapInsets,
  getRouteFitOptions,
  getVenueFocusOptions,
} from '@/lib/maps/viewport'

import type {
  CitySlug,
  MapDensityMode,
} from '@/lib/maps/mapTypes'
import type { Venue } from '@/types/venue'

import 'leaflet/dist/leaflet.css'
import '@/components/maps/map-markers.css'

const USA_CENTER: [number, number] = [37.8, -96.9]
const USA_ZOOM = 4

const CITY_OVERVIEW_MAX_ZOOM = 11
const CLUSTER_ONLY_MAX_ZOOM = 12.5
const HYBRID_CLUSTER_MAX_ZOOM = 14
const PRIORITY_MARKER_MAX_ZOOM = 15
const MAX_FULL_MARKERS = 220
const MAX_HYBRID_CRITICAL_MARKERS = 28
const MAX_INITIAL_CITY_MARKERS = 8

const EMPTY_VENUES: Venue[] = []

const EMPTY_CLUSTER_RESULT: ClusterVenuesResult = {
  clusters: [],
  unclusteredVenues: [],
}

function normalizeSearchableList(
  value: string | string[] | undefined
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item: string) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean)
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

  if (
    !Number.isFinite(venue.lat) ||
    !Number.isFinite(venue.lon)
  ) {
    return -100000
  }

  const latDiff = venue.lat - center.lat
  const lonDiff = venue.lon - center.lng

  return -Math.sqrt(
    latDiff * latDiff +
      lonDiff * lonDiff
  )
}

function isCitySlug(
  value: string
): value is CitySlug {
  return value in CITY_CONFIGS
}

function getVenueId(
  venue: Venue
): string | null {
  if (
    typeof venue.id === 'string' &&
    venue.id.trim()
  ) {
    return venue.id
  }

  return null
}

function dedupeVenues(
  venues: readonly Venue[]
): Venue[] {
  const seen = new Set<string>()
  const result: Venue[] = []

  venues.forEach((venue, index) => {
    const key =
      getVenueId(venue) ??
      venue.slug ??
      `${venue.name}-${venue.lat}-${venue.lon}-${index}`

    if (seen.has(key)) {
      return
    }

    seen.add(key)
    result.push(venue)
  })

  return result
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

    const timeout = window.setTimeout(
      () => map.invalidateSize(),
      300
    )

    return () => {
      window.clearTimeout(timeout)
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
    center: {
      lat: number
      lng: number
    }
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
  travelMode:
    | 'walking'
    | 'cycling'
    | 'driving'
  themeId?: string
  searchTerm?: string
  showLiveEventsOnly?: boolean
  markerDisplayMode?:
    | 'color'
    | 'emoji'
  onCityChange?: (
    city: string | null
  ) => void
  onGeneratedRouteCityChange?: (
    city: string | null
  ) => void
  onMapClick?: (
    lat: number,
    lon: number
  ) => void
  onGeneratedRouteFromVenue?: (
    route: Venue[],
    generatedRoute?: any
  ) => void
  customStart?: {
    lat: number
    lon: number
  } | null
  isPanelOpen?: boolean
  onRequestClosePanel?: () => void
}

export default function MapCanvas({
  route,
  travelMode,
  themeId,
  searchTerm = '',
  showLiveEventsOnly = false,
  markerDisplayMode = 'color',
  onCityChange,
  onGeneratedRouteCityChange,
  onMapClick,
  onGeneratedRouteFromVenue,
  customStart,
  isPanelOpen = false,
  onRequestClosePanel,
}: Props) {
  const [
    selectedCity,
    setSelectedCity,
  ] = useState<CitySlug | null>(null)

  const [
    selectedVenueId,
    setSelectedVenueId,
  ] = useState<string | null>(null)

  const [
    showCitySelector,
    setShowCitySelector,
  ] = useState(true)

  const [
    enableScrollZoom,
    setEnableScrollZoom,
  ] = useState(false)

  const [
    returnFocusZoom,
    setReturnFocusZoom,
  ] = useState<number | null>(null)

  const [
    currentZoom,
    setCurrentZoom,
  ] = useState(USA_ZOOM)

  const [
    mapBounds,
    setMapBounds,
  ] = useState<LatLngBounds | null>(null)

  const [
    mapCenterPoint,
    setMapCenterPoint,
  ] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const [
    minuteTick,
    setMinuteTick,
  ] = useState(0)

  const [
    isMobile,
    setIsMobile,
  ] = useState(false)

  const [
    customStartIcon,
    setCustomStartIcon,
  ] = useState<DivIcon | null>(null)

  const [
    isDraggingCustomStart,
    setIsDraggingCustomStart,
  ] = useState(false)

  useEffect(() => {
    const interval = window.setInterval(
      () => {
        setMinuteTick(
          (previous) => previous + 1
        )
      },
      60000
    )

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const mapRef =
    useRef<LeafletMap | null>(null)

  const markerRefs =
    useRef<Record<string, LeafletMarker>>({})

  const viewportSignatureRef =
    useRef<string | null>(null)

  const focusedVenueIdRef =
    useRef<string | null>(null)

  const nowForCity = useMemo(
    () =>
      selectedCity
        ? getCityNow(selectedCity)
        : null,
    [selectedCity, minuteTick]
  )

  useEffect(() => {
    if (!isPanelOpen) {
      return
    }

    focusedVenueIdRef.current = null
    setSelectedVenueId(null)
    setShowCitySelector(false)
  }, [isPanelOpen])

  useEffect(() => {
    let active = true

    if (!customStart) {
      setCustomStartIcon(null)
      setIsDraggingCustomStart(false)

      return () => {
        active = false
      }
    }

    void getCustomStartIcon({
      selected: true,
      dragging: isDraggingCustomStart,
      interactive: true,
      scale: 1,
    })
      .then((nextIcon) => {
        if (active) {
          setCustomStartIcon(nextIcon)
        }
      })
      .catch((error: unknown) => {
        if (
          active &&
          process.env.NODE_ENV === 'development'
        ) {
          console.error(
            '[MapCanvas] Failed to create custom-start icon',
            error
          )
        }
      })

    return () => {
      active = false
    }
  }, [
    customStart,
    isDraggingCustomStart,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleGeneratedRouteFromVenue =
      (event: Event) => {
        const customEvent =
          event as CustomEvent<{
            route?: Venue[]
            generatedRoute?: any
            anchorVenueId?: string
            city?: string
          }>

        console.log(
          '[MapCanvas received generated route event]',
          customEvent.detail
        )

        const directRoute =
          customEvent.detail?.route

        const fallbackRoute =
          customEvent.detail
            ?.generatedRoute?.stops
            ?.map(
              (stop: any) =>
                stop?.venue
            )
            .filter(Boolean)

        const nextRoute =
          Array.isArray(directRoute) &&
          directRoute.length > 0
            ? directRoute
            : fallbackRoute

        console.log(
          '[MapCanvas generated route resolved]',
          {
            directRouteLength:
              Array.isArray(directRoute)
                ? directRoute.length
                : 0,
            fallbackRouteLength:
              Array.isArray(fallbackRoute)
                ? fallbackRoute.length
                : 0,
            nextRouteLength:
              Array.isArray(nextRoute)
                ? nextRoute.length
                : 0,
          }
        )

        if (
          !Array.isArray(nextRoute) ||
          nextRoute.length < 2
        ) {
          return
        }

        onGeneratedRouteFromVenue?.(
          nextRoute,
          customEvent.detail
            ?.generatedRoute
        )

        const generatedCity =
          customEvent.detail?.city

        if (
          generatedCity &&
          isCitySlug(generatedCity)
        ) {
          setSelectedCity(generatedCity)
          setShowCitySelector(false)

          onGeneratedRouteCityChange?.(
            generatedCity
          )
        }

        focusedVenueIdRef.current = null
        setSelectedVenueId(null)

        const validRoute =
          nextRoute.filter(
            (venue) =>
              Number.isFinite(venue.lat) &&
              Number.isFinite(venue.lon)
          )

        if (
          mapRef.current &&
          validRoute.length > 1
        ) {
          const L = require('leaflet')

          const bounds =
            L.latLngBounds(
              validRoute.map(
                (venue) => [
                  venue.lat,
                  venue.lon,
                ]
              )
            )

          mapRef.current.fitBounds(
            bounds,
            {
              padding: [48, 48],
              animate: true,
            }
          )
        }
      }

    window.addEventListener(
      'roam:generated-route-from-venue',
      handleGeneratedRouteFromVenue
    )

    return () => {
      window.removeEventListener(
        'roam:generated-route-from-venue',
        handleGeneratedRouteFromVenue
      )
    }
  }, [
    onGeneratedRouteFromVenue,
    onGeneratedRouteCityChange,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const L = require('leaflet')

    delete (
      L.Icon.Default.prototype as any
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

  const handleSelectCity =
    useCallback(
      (
        slug: CitySlug | null
      ) => {
        focusedVenueIdRef.current = null
        setSelectedCity(slug)
        setSelectedVenueId(null)
        setShowCitySelector(false)
        onCityChange?.(slug)
      },
      [onCityChange]
    )

  const cityConfig =
    selectedCity
      ? CITY_CONFIGS[selectedCity]
      : null

  const mapCenter =
    cityConfig?.center ??
    USA_CENTER

  const mapZoom =
    cityConfig?.zoom ??
    USA_ZOOM

  const resolvedDefaultCenter =
    useMemo<[number, number]>(
      () =>
        customStart
          ? [
              customStart.lat,
              customStart.lon,
            ]
          : [
              mapCenter[0],
              mapCenter[1],
            ],
      [
        customStart?.lat,
        customStart?.lon,
        mapCenter[0],
        mapCenter[1],
      ]
    )

  const handleMapEffectUserPosition =
    useCallback(
      (
        _position: [
          number,
          number,
        ]
      ) => {},
      []
    )

  const {
    allVenues = [],
    venues = [],
    eventsByVenueId = {},
  } = useCityData(
    selectedCity,
    {
      showLiveEventsOnly,
    }
  )

  const selectedVenue = useMemo(
    () =>
      selectedVenueId
        ? allVenues.find(
            (venue) =>
              venue.id ===
              selectedVenueId
          ) ?? null
        : null,
    [
      allVenues,
      selectedVenueId,
    ]
  )

  const selectedVenueEvents =
    useMemo<VenuePreviewEvent[]>(() => {
      if (!selectedVenue?.id) {
        return []
      }

      const venueEvents =
        eventsByVenueId[
          selectedVenue.id
        ] ?? []

      return venueEvents.flatMap(
        (event, index) => {
          const title =
            typeof event?.title ===
            'string'
              ? event.title.trim()
              : ''

          const startsAt =
            typeof event?.starts_at ===
            'string'
              ? event.starts_at.trim()
              : ''

          if (
            title.length === 0 ||
            startsAt.length === 0
          ) {
            return []
          }

          const normalizedEvent:
            VenuePreviewEvent = {
              id:
                event.id ??
                `${selectedVenue.id}-${startsAt}-${index}`,
              title,
              starts_at: startsAt,
              ends_at: null,
            }

          return [normalizedEvent]
        }
      )
    }, [
      selectedVenue,
      eventsByVenueId,
    ])

  useEffect(() => {
    if (
      selectedVenueId &&
      !selectedVenue
    ) {
      focusedVenueIdRef.current = null
      setSelectedVenueId(null)
    }
  }, [
    selectedVenueId,
    selectedVenue,
  ])

  const userPosition =
    useUserLocation({
      fallback: mapCenter,
    })

  const visibleRoute =
    useMemo<Venue[]>(
      () =>
        route &&
        route.length > 1
          ? route
          : EMPTY_VENUES,
      [route]
    )

  const lineColor =
    THEME_COLORS[
      themeId ?? ''
    ] ?? 'cyan'

  const densityMode =
    useMemo<MapDensityMode>(
      () =>
        getMapDensityMode(
          currentZoom
        ),
      [currentZoom]
    )

  const markerScale =
    useMemo(
      () =>
        getMarkerScale(
          currentZoom
        ),
      [currentZoom]
    )

  const routeIndexByVenueId =
    useMemo(
      () =>
        buildRouteIndexByVenueId(
          visibleRoute
        ),
      [visibleRoute]
    )

  const routeVenueIds =
    useMemo(() => {
      const result =
        new Set<string>()

      visibleRoute.forEach(
        (venue) => {
          const venueId =
            getVenueId(venue)

          if (venueId) {
            result.add(venueId)
          }
        }
      )

      return result
    }, [visibleRoute])

  const liveEventVenueIds =
    useMemo(() => {
      const result =
        new Set<string>()

      Object.entries(
        eventsByVenueId
      ).forEach(
        ([venueId, venueEvents]) => {
          if (
            Array.isArray(
              venueEvents
            ) &&
            venueEvents.length > 0
          ) {
            result.add(venueId)
          }
        }
      )

      return result
    }, [eventsByVenueId])

  const liveEventCountByVenueId =
    useMemo(() => {
      const result =
        new Map<string, number>()

      Object.entries(
        eventsByVenueId
      ).forEach(
        ([venueId, venueEvents]) => {
          const count =
            Array.isArray(
              venueEvents
            )
              ? venueEvents.length
              : 0

          if (count > 0) {
            result.set(
              venueId,
              count
            )
          }
        }
      )

      return result
    }, [eventsByVenueId])

  const searchMatchVenueIds =
    useMemo(() => {
      const term =
        searchTerm
          .trim()
          .toLowerCase()

      const result =
        new Set<string>()

      if (!term) {
        return result
      }

      allVenues.forEach(
        (venue) => {
          const venueId =
            getVenueId(venue)

          if (!venueId) {
            return
          }

          const searchable = [
            venue.name ?? '',
            ...normalizeSearchableList(
              venue.type
            ),
            ...normalizeSearchableList(
              venue.tags
            ),
            ...normalizeSearchableList(
              venue.vibe
            ),
          ]
            .join(' ')
            .toLowerCase()

          if (
            searchable.includes(
              term
            )
          ) {
            result.add(
              venueId
            )
          }
        }
      )

      return result
    }, [
      allVenues,
      searchTerm,
    ])

  const previewSheetVisible =
    selectedVenue !== null

  const mapInsets = useMemo(
    () =>
      getMapInsets({
        isMobile,
        isPanelOpen,
        hasPreviewSheet:
          previewSheetVisible,
        hasRouteControls:
          visibleRoute.length > 1,
        hasTopNavigation: true,
      }),
    [
      isMobile,
      isPanelOpen,
      previewSheetVisible,
      visibleRoute.length,
    ]
  )

  const handleViewportChange =
    useCallback(
      ({
        zoom,
        bounds,
        center,
      }: {
        zoom: number
        bounds: LatLngBounds
        center: {
          lat: number
          lng: number
        }
      }) => {
        const nextSignature = [
          zoom,
          bounds.toBBoxString(),
          center.lat.toFixed(5),
          center.lng.toFixed(5),
        ].join(':')

        if (
          viewportSignatureRef
            .current ===
          nextSignature
        ) {
          return
        }

        viewportSignatureRef.current =
          nextSignature

        setCurrentZoom(zoom)
        setMapBounds(bounds)
        setMapCenterPoint(center)
      },
      []
    )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateViewportMode =
      () => {
        const mobile =
          window.innerWidth < 768

        setIsMobile(mobile)
        setEnableScrollZoom(
          !mobile
        )
      }

    updateViewportMode()

    window.addEventListener(
      'resize',
      updateViewportMode
    )

    return () => {
      window.removeEventListener(
        'resize',
        updateViewportMode
      )
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params =
      new URLSearchParams(
        window.location.search
      )

    const cityParam =
      params.get('city')

    const zoomParam =
      params.get('zoom')

    if (
      cityParam &&
      isCitySlug(cityParam)
    ) {
      setSelectedCity(
        cityParam
      )

      setShowCitySelector(false)

      onCityChange?.(
        cityParam
      )
    }

    if (zoomParam) {
      const parsedZoom =
        parseFloat(
          zoomParam
        )

      if (
        Number.isFinite(
          parsedZoom
        )
      ) {
        setReturnFocusZoom(
          parsedZoom
        )
      }
    }
  }, [onCityChange])

  useEffect(() => {
    if (
      !selectedCity ||
      !mapRef.current ||
      customStart
    ) {
      return
    }

    const config =
      CITY_CONFIGS[
        selectedCity
      ]

    if (config) {
      mapRef.current.setView(
        config.center,
        config.zoom
      )
    }
  }, [
    selectedCity,
    customStart,
  ])

  useEffect(() => {
    if (
      !mapRef.current ||
      !customStart
    ) {
      return
    }

    if (
      returnFocusZoom !== null
    ) {
      const focusZoom =
        selectedCity
          ? Math.max(
              mapZoom,
              returnFocusZoom
            )
          : returnFocusZoom

      mapRef.current.setView(
        [
          customStart.lat,
          customStart.lon,
        ],
        focusZoom,
        {
          animate: true,
        }
      )

      return
    }

    mapRef.current.panTo(
      [
        customStart.lat,
        customStart.lon,
      ],
      {
        animate: true,
      }
    )
  }, [
    customStart,
    selectedCity,
    mapZoom,
    returnFocusZoom,
  ])

  useEffect(() => {
    if (
      !mapRef.current ||
      visibleRoute.length < 2
    ) {
      return
    }

    const avgLat =
      visibleRoute.reduce(
        (
          sum,
          venue
        ) =>
          sum + venue.lat,
        0
      ) /
      visibleRoute.length

    const avgLon =
      visibleRoute.reduce(
        (
          sum,
          venue
        ) =>
          sum + venue.lon,
        0
      ) /
      visibleRoute.length

    mapRef.current.panTo(
      [avgLat, avgLon],
      {
        animate: true,
      }
    )
  }, [visibleRoute])

  useEffect(() => {
    if (
      !mapRef.current ||
      !selectedVenue
    ) {
      return
    }

    const venueId =
      getVenueId(
        selectedVenue
      )

    if (
      !venueId ||
      focusedVenueIdRef.current ===
        venueId
    ) {
      return
    }

    if (
      !Number.isFinite(
        selectedVenue.lat
      ) ||
      !Number.isFinite(
        selectedVenue.lon
      )
    ) {
      return
    }

    focusedVenueIdRef.current =
      venueId

    const map =
      mapRef.current

    const focusOptions =
      getVenueFocusOptions({
        position: [
          selectedVenue.lat,
          selectedVenue.lon,
        ],
        currentZoom:
          map.getZoom(),
        isMobile,
        hasPreviewSheet: true,
        isPanelOpen,
      })

    const applyOffset =
      () => {
        map.panBy(
          [
            -focusOptions
              .offsetPixels.x,
            focusOptions
              .offsetPixels.y,
          ],
          {
            animate: true,
            duration:
              focusOptions
                .flyToOptions
                .duration,
          }
        )
      }

    map.once(
      'moveend',
      applyOffset
    )

    const focusCenter: [
      number,
      number,
    ] = [
      focusOptions.center[0],
      focusOptions.center[1],
    ]

    map.flyTo(
      focusCenter,
      focusOptions.zoom,
      focusOptions.flyToOptions
    )

    return () => {
      map.off(
        'moveend',
        applyOffset
      )
    }
  }, [
    selectedVenue,
    isMobile,
    isPanelOpen,
  ])

  const handleSelectVenue =
    useCallback(
      (venue: Venue) => {
        const venueId =
          getVenueId(venue)

        if (!venueId) {
          return
        }

        if (
          focusedVenueIdRef.current !==
          venueId
        ) {
          focusedVenueIdRef.current =
            null
        }

        onRequestClosePanel?.()

        setSelectedVenueId(
          venueId
        )

        setShowCitySelector(
          false
        )
      },
      [onRequestClosePanel]
    )

  const handleCloseVenuePreview =
    useCallback(() => {
      focusedVenueIdRef.current = null
      setSelectedVenueId(null)
    }, [])

  const handleResetCityView =
    useCallback(() => {
      if (
        !mapRef.current ||
        !cityConfig
      ) {
        return
      }

      focusedVenueIdRef.current = null
      setSelectedVenueId(null)

      mapRef.current.flyTo(
        cityConfig.center,
        cityConfig.zoom,
        {
          animate: true,
          duration: 0.8,
        }
      )
    }, [cityConfig])

  const handleRecenterUser =
    useCallback(() => {
      if (
        !mapRef.current ||
        !userPosition
      ) {
        return
      }

      focusedVenueIdRef.current = null
      setSelectedVenueId(null)

      mapRef.current.flyTo(
        userPosition,
        Math.max(
          currentZoom,
          16
        ),
        {
          animate: true,
          duration: 0.7,
        }
      )
    }, [
      userPosition,
      currentZoom,
    ])

  const handleFitRoute =
    useCallback(() => {
      if (
        !mapRef.current ||
        visibleRoute.length < 2
      ) {
        return
      }

      const validRoute =
        visibleRoute.filter(
          (venue) =>
            Number.isFinite(
              venue.lat
            ) &&
            Number.isFinite(
              venue.lon
            )
        )

      if (
        validRoute.length < 2
      ) {
        return
      }

      focusedVenueIdRef.current = null
      setSelectedVenueId(null)

      const L =
        require('leaflet')

      const bounds =
        L.latLngBounds(
          validRoute.map(
            (venue) => [
              venue.lat,
              venue.lon,
            ]
          )
        )

      const fitOptions =
        getRouteFitOptions(
          mapInsets
        )

      mapRef.current.flyToBounds(
        bounds,
        fitOptions
      )
    }, [
      visibleRoute,
      mapInsets,
    ])

  const handleGenerateFlowFromPreview =
    useCallback(
      async (
        venue: Venue
      ) => {
        if (!selectedCity) {
          throw new Error(
            'Choose a city before building a Flow.'
          )
        }

        const venueKey =
          venue.id ??
          venue.slug ??
          venue.name

        if (!venueKey) {
          throw new Error(
            'This venue is missing an identifier.'
          )
        }

        const cityNow =
          nowForCity ??
          getCityNow(
            selectedCity
          )

        const response =
          await fetch(
            '/api/generate-from-venue',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  venueId:
                    venue.id ??
                    null,
                  venueSlug:
                    venue.slug ??
                    null,
                  venueName:
                    venue.name ??
                    null,
                  city:
                    selectedCity,
                  plannedStartAt:
                    cityNow
                      .plus({
                        minutes: 15,
                      })
                      .toISO(),
                  travelMode:
                    'walking',
                  tightness:
                    'medium',
                  maxStops: 5,
                  source:
                    'map_marker',
                  debug: true,
                }),
            }
          )

        const payload =
          await response
            .json()
            .catch(
              () => null
            )

        if (
          !response.ok ||
          !payload?.route?.stops
            ?.length
        ) {
          throw new Error(
            payload?.error ||
              'Could not generate a Flow from this venue.'
          )
        }

        const generatedVenues =
          payload.route.stops
            .map(
              (stop: any) =>
                stop?.venue
            )
            .filter(Boolean)

        window.dispatchEvent(
          new CustomEvent(
            'roam:generated-route-from-venue',
            {
              detail: {
                route:
                  generatedVenues,
                generatedRoute:
                  payload.route,
                anchorVenueId:
                  venueKey,
                city:
                  selectedCity,
              },
            }
          )
        )
      },
      [
        selectedCity,
        nowForCity,
      ]
    )

  const filteredVenues =
    useMemo(() => {
      const term =
        searchTerm
          .trim()
          .toLowerCase()

      if (!term) {
        return venues
      }

      return allVenues.filter(
        (venue) => {
          const nameMatch =
            venue.name
              ?.toLowerCase()
              .includes(term)

          const vibeArray =
            normalizeSearchableList(
              venue.vibe
            )

          const vibeMatch =
            vibeArray.some(
              (vibe: string) =>
                vibe
                  .toLowerCase()
                  .includes(term)
            )

          const typeArray =
            normalizeSearchableList(
              venue.type
            )

          const typeMatch =
            typeArray.some(
              (type: string) =>
                type
                  .toLowerCase()
                  .includes(term)
            )

          const tagsArray =
            normalizeSearchableList(
              venue.tags
            )

          const tagsMatch =
            tagsArray.some(
              (tag) =>
                tag
                  .toLowerCase()
                  .includes(term)
            )

          return (
            nameMatch ||
            vibeMatch ||
            typeMatch ||
            tagsMatch
          )
        }
      )
    }, [
      allVenues,
      venues,
      searchTerm,
    ])

  const viewportEligibleVenues =
    useMemo(() => {
      if (!selectedCity) {
        return []
      }

      return filteredVenues.filter(
        (venue) => {
          if (
            !Number.isFinite(
              venue.lat
            ) ||
            !Number.isFinite(
              venue.lon
            )
          ) {
            return false
          }

          if (!mapBounds) {
            return true
          }

          return mapBounds.contains(
            [
              venue.lat,
              venue.lon,
            ]
          )
        }
      )
    }, [
      selectedCity,
      filteredVenues,
      mapBounds,
    ])

  const rankedViewportVenues =
    useMemo(() => {
      const term =
        searchTerm
          .trim()
          .toLowerCase()

      const hasSearch =
        term.length > 0

      return viewportEligibleVenues
        .map((venue) => {
          const venueId =
            getVenueId(venue)

          const hasEvent =
            venueId
              ? liveEventVenueIds.has(
                  venueId
                )
              : false

          const typeList =
            normalizeSearchableList(
              venue.type
            )

          const tagList =
            normalizeSearchableList(
              venue.tags
            )

          const vibeList =
            normalizeSearchableList(
              venue.vibe
            )

          const searchable = [
            venue.name ?? '',
            ...typeList,
            ...tagList,
            ...vibeList,
          ]
            .join(' ')
            .toLowerCase()

          const searchBoost =
            hasSearch &&
            searchable.includes(
              term
            )
              ? 90
              : 0

          const eventBoost =
            hasEvent
              ? 140
              : 0

          const selectedBoost =
            venueId &&
            venueId ===
              selectedVenueId
              ? 500
              : 0

          const densityBoost =
            currentZoom >= 15
              ? 20
              : 0

          const centerScore =
            distanceScoreFromCenter(
              venue,
              mapCenterPoint
            ) * 400

          return {
            venue,
            score:
              selectedBoost +
              eventBoost +
              searchBoost +
              densityBoost +
              centerScore,
          }
        })
        .sort(
          (first, second) =>
            second.score -
            first.score
        )
    }, [
      viewportEligibleVenues,
      searchTerm,
      liveEventVenueIds,
      selectedVenueId,
      currentZoom,
      mapCenterPoint,
    ])

  const initialCityVenues =
    useMemo(() => {
      if (
        !selectedCity ||
        visibleRoute.length > 1 ||
        (
          mapBounds &&
          currentZoom >=
            CITY_OVERVIEW_MAX_ZOOM
        )
      ) {
        return []
      }

      const configuredCenter =
        cityConfig
          ? {
              lat:
                cityConfig.center[0],
              lng:
                cityConfig.center[1],
            }
          : null

      return allVenues
        .filter(
          (venue) =>
            Number.isFinite(
              venue.lat
            ) &&
            Number.isFinite(
              venue.lon
            )
        )
        .map((venue) => {
          const venueId =
            getVenueId(venue)

          const eventBoost =
            venueId &&
            liveEventVenueIds.has(
              venueId
            )
              ? 220
              : 0

          const searchBoost =
            venueId &&
            searchMatchVenueIds.has(
              venueId
            )
              ? 400
              : 0

          const centerScore =
            distanceScoreFromCenter(
              venue,
              configuredCenter
            ) * 400

          return {
            venue,
            score:
              searchBoost +
              eventBoost +
              centerScore,
          }
        })
        .sort(
          (first, second) =>
            second.score -
            first.score
        )
        .slice(
          0,
          MAX_INITIAL_CITY_MARKERS
        )
        .map(
          ({ venue }) =>
            venue
        )
    }, [
      selectedCity,
      visibleRoute.length,
      mapBounds,
      currentZoom,
      cityConfig,
      allVenues,
      liveEventVenueIds,
      searchMatchVenueIds,
    ])

  const criticalVenueIds =
    useMemo(() => {
      const result =
        new Set<string>()

      searchMatchVenueIds.forEach(
        (venueId) => {
          result.add(venueId)
        }
      )

      liveEventVenueIds.forEach(
        (venueId) => {
          result.add(venueId)
        }
      )

      routeVenueIds.forEach(
        (venueId) => {
          result.add(venueId)
        }
      )

      if (selectedVenueId) {
        result.add(
          selectedVenueId
        )
      }

      return result
    }, [
      searchMatchVenueIds,
      liveEventVenueIds,
      routeVenueIds,
      selectedVenueId,
    ])

  const isRouteMode =
    visibleRoute.length > 1

  const isClusterOnlyMode =
    !isRouteMode &&
    currentZoom >=
      CITY_OVERVIEW_MAX_ZOOM &&
    currentZoom <
      CLUSTER_ONLY_MAX_ZOOM

  const isHybridClusterMode =
    !isRouteMode &&
    currentZoom >=
      CLUSTER_ONLY_MAX_ZOOM &&
    currentZoom <
      HYBRID_CLUSTER_MAX_ZOOM

  const isPriorityMarkerMode =
    !isRouteMode &&
    currentZoom >=
      HYBRID_CLUSTER_MAX_ZOOM &&
    currentZoom <
      PRIORITY_MARKER_MAX_ZOOM

  const criticalVenues =
    useMemo(() => {
      if (!isHybridClusterMode) {
        return []
      }

      return rankedViewportVenues
        .filter(({ venue }) => {
          const venueId =
            getVenueId(venue)

          return (
            venueId !== null &&
            criticalVenueIds.has(
              venueId
            )
          )
        })
        .slice(
          0,
          MAX_HYBRID_CRITICAL_MARKERS
        )
        .map(
          ({ venue }) =>
            venue
        )
    }, [
      isHybridClusterMode,
      rankedViewportVenues,
      criticalVenueIds,
    ])

  const criticalVenueIdSet =
    useMemo(() => {
      const result =
        new Set<string>()

      criticalVenues.forEach(
        (venue) => {
          const venueId =
            getVenueId(venue)

          if (venueId) {
            result.add(venueId)
          }
        }
      )

      return result
    }, [criticalVenues])

  const clusterInputVenues =
    useMemo(() => {
      if (
        !isClusterOnlyMode &&
        !isHybridClusterMode
      ) {
        return []
      }

      if (isClusterOnlyMode) {
        return viewportEligibleVenues
      }

      return viewportEligibleVenues.filter(
        (venue) => {
          const venueId =
            getVenueId(venue)

          return (
            !venueId ||
            !criticalVenueIdSet.has(
              venueId
            )
          )
        }
      )
    }, [
      isClusterOnlyMode,
      isHybridClusterMode,
      viewportEligibleVenues,
      criticalVenueIdSet,
    ])

  const clusterResult =
    useMemo<ClusterVenuesResult>(() => {
      if (
        !isClusterOnlyMode &&
        !isHybridClusterMode
      ) {
        return EMPTY_CLUSTER_RESULT
      }

      return clusterVenuesByGrid(
        clusterInputVenues,
        {
          zoom: currentZoom,
          selectedVenueId,
          liveEventVenueIds,
          liveEventCountByVenueId,
          routeVenueIds,
          searchMatchVenueIds,
          minimumClusterSize: 2,
        }
      )
    }, [
      isClusterOnlyMode,
      isHybridClusterMode,
      clusterInputVenues,
      currentZoom,
      selectedVenueId,
      liveEventVenueIds,
      liveEventCountByVenueId,
      routeVenueIds,
      searchMatchVenueIds,
    ])

  const renderedVenues =
    useMemo(() => {
      if (isRouteMode) {
        return visibleRoute
      }

      if (!selectedCity) {
        return []
      }

      if (
        initialCityVenues.length >
        0
      ) {
        return initialCityVenues
      }

      if (
        currentZoom <
        CITY_OVERVIEW_MAX_ZOOM
      ) {
        return []
      }

      if (isClusterOnlyMode) {
        return clusterResult
          .unclusteredVenues
      }

      if (isHybridClusterMode) {
        return dedupeVenues([
          ...criticalVenues,
          ...clusterResult
            .unclusteredVenues,
        ])
      }

      const renderLimit =
        getVenueRenderLimit(
          currentZoom
        )

      if (
        renderLimit <= 0
      ) {
        return []
      }

      if (isPriorityMarkerMode) {
        return rankedViewportVenues
          .slice(
            0,
            renderLimit
          )
          .map(
            ({ venue }) =>
              venue
          )
      }

      if (
        viewportEligibleVenues.length <=
        MAX_FULL_MARKERS
      ) {
        return viewportEligibleVenues
      }

      return rankedViewportVenues
        .slice(
          0,
          MAX_FULL_MARKERS
        )
        .map(
          ({ venue }) =>
            venue
        )
    }, [
      isRouteMode,
      visibleRoute,
      selectedCity,
      initialCityVenues,
      currentZoom,
      isClusterOnlyMode,
      isHybridClusterMode,
      isPriorityMarkerMode,
      clusterResult,
      criticalVenues,
      rankedViewportVenues,
      viewportEligibleVenues,
    ])

  const showLowZoomState =
    Boolean(selectedCity) &&
    currentZoom <
      CITY_OVERVIEW_MAX_ZOOM &&
    !isRouteMode &&
    initialCityVenues.length === 0

  const showNoResultsState =
    Boolean(selectedCity) &&
    currentZoom >=
      CITY_OVERVIEW_MAX_ZOOM &&
    !isRouteMode &&
    renderedVenues.length === 0 &&
    clusterResult.clusters.length === 0

  const clusterPaddingTopLeft:
    [number, number] =
      isMobile
        ? [24, 88]
        : [72, 96]

  const clusterPaddingBottomRight:
    [number, number] =
      isMobile
        ? [
            24,
            previewSheetVisible
              ? 320
              : 112,
          ]
        : [
            previewSheetVisible
              ? 420
              : 72,
            112,
          ]

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="absolute inset-0"
        style={{
          height: '100%',
          width: '100%',
        }}
        zoomControl={false}
        scrollWheelZoom={
          enableScrollZoom
        }
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        dragging
      >
        <MapRefSetter
          mapRef={mapRef}
        />

        <MapViewportTracker
          onViewportChange={
            handleViewportChange
          }
        />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />

        <MapEffectController
          city={
            selectedCity ?? ''
          }
          route={visibleRoute}
          defaultCenter={
            resolvedDefaultCenter
          }
          setUserPosition={
            handleMapEffectUserPosition
          }
          mapRef={mapRef}
          onMapClick={onMapClick}
        />

        {!selectedCity && (
          <CityOverviewMarkers
            onSelectCity={
              handleSelectCity
            }
            excludedCity={
              selectedCity
            }
            selectedCity={
              selectedCity
            }
          />
        )}

        {selectedCity &&
          nowForCity &&
          clusterResult.clusters.map(
            (cluster) => (
              <VenueClusterMarker
                key={cluster.id}
                cluster={cluster}
                markerScale={
                  markerScale
                }
                selected={
                  cluster.hasSelectedVenue
                }
                paddingTopLeft={
                  clusterPaddingTopLeft
                }
                paddingBottomRight={
                  clusterPaddingBottomRight
                }
              />
            )
          )}

        {selectedCity &&
          nowForCity &&
          renderedVenues.map(
            (
              venue: Venue,
              index: number
            ) => {
              const venueId =
                getVenueId(venue)

              const routeIndex =
                venueId
                  ? routeIndexByVenueId.get(
                      venueId
                    ) ?? null
                  : null

              const isSelected =
                venueId !== null &&
                selectedVenueId ===
                  venueId

              const isSearchMatch =
                venueId !== null &&
                searchMatchVenueIds.has(
                  venueId
                )

              const isRouteStop =
                routeIndex !== null

              const isDimmed =
                Boolean(
                  selectedVenueId
                ) &&
                !isSelected &&
                !isRouteStop

              const venueEvents =
                venueId
                  ? eventsByVenueId[
                      venueId
                    ] ?? []
                  : []

              return (
                <VenueMarker
                  key={
                    venue.id ??
                    venue.slug ??
                    `${venue.name}-${index}`
                  }
                  venue={venue}
                  index={index}
                  city={
                    selectedCity
                  }
                  nowForCity={
                    nowForCity
                  }
                  isRouteMode={
                    visibleRoute.length >
                    0
                  }
                  markerDisplayMode={
                    markerDisplayMode
                  }
                  markerRefs={
                    markerRefs
                  }
                  eventsByVenueId={
                    eventsByVenueId
                  }
                  selected={
                    isSelected
                  }
                  markerScale={
                    markerScale
                  }
                  routeIndex={
                    routeIndex ??
                    undefined
                  }
                  routeRole={
                    routeIndex !== null
                      ? getRouteStopRole(
                          routeIndex,
                          visibleRoute.length
                        )
                      : undefined
                  }
                  routeLength={
                    visibleRoute.length
                  }
                  hasLiveEvent={
                    venueEvents.length >
                    0
                  }
                  hasUpcomingEvent={
                    venueEvents.length >
                    0
                  }
                  isSearchMatch={
                    isSearchMatch
                  }
                  isDimmed={
                    isDimmed
                  }
                  showPopup={false}
                  onSelect={
                    handleSelectVenue
                  }
                />
              )
            }
          )}

        {userPosition && (
          <UserLocationMarker
            position={
              userPosition
            }
          />
        )}

        {customStart &&
          customStartIcon && (
            <Marker
              position={[
                customStart.lat,
                customStart.lon,
              ]}
              icon={
                customStartIcon
              }
              zIndexOffset={800}
              draggable
              eventHandlers={{
                dragstart: () => {
                  setIsDraggingCustomStart(
                    true
                  )
                },

                dragend: (
                  event
                ) => {
                  setIsDraggingCustomStart(
                    false
                  )

                  const {
                    lat,
                    lng,
                  } =
                    event.target.getLatLng()

                  onMapClick?.(
                    lat,
                    lng
                  )
                },
              }}
            />
          )}

        {visibleRoute.length >
          1 &&
          mapRef.current && (
            <RouteControl
              map={
                mapRef.current
              }
              route={
                visibleRoute
              }
              travelMode={
                travelMode
              }
              color={
                lineColor
              }
            />
          )}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[400]">
        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_center,transparent_34%,rgba(0,0,0,0.34)_100%)]
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_50%_44%,rgba(34,211,238,0.065),transparent_43%)]
          "
        />

        <div
          className="
            absolute
            inset-x-0
            top-0
            h-32
            bg-gradient-to-b
            from-black/28
            to-transparent
          "
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1000]">
        <div className="pointer-events-auto">
          <MapControlRail
            onToggleCitySelector={() =>
              setShowCitySelector(
                (previous) =>
                  !previous
              )
            }
            isCitySelectorOpen={
              showCitySelector
            }
            cityLabel={
              cityConfig?.name ??
              null
            }
            onRecenterUser={
              handleRecenterUser
            }
            canRecenterUser={
              Boolean(
                userPosition
              )
            }
            onResetCityView={
              handleResetCityView
            }
            canResetCityView={
              Boolean(cityConfig)
            }
            onFitRoute={
              handleFitRoute
            }
            canFitRoute={
              visibleRoute.length >
              1
            }
            position="right"
          />
        </div>

        <div className="pointer-events-auto">
          {showCitySelector && (
            <CitySelector
              selectedCity={
                selectedCity
              }
              onSelectCity={
                handleSelectCity
              }
              panelOpen={
                isPanelOpen
              }
            />
          )}
        </div>

        <div className="pointer-events-auto">
          <VenuePreviewSheet
            venue={
              selectedVenue
            }
            city={
              selectedCity
            }
            nowForCity={
              nowForCity
            }
            events={
              selectedVenueEvents
            }
            onClose={
              handleCloseVenuePreview
            }
            onGenerateFlow={
              handleGenerateFlowFromPreview
            }
          />
        </div>

        {(showLowZoomState ||
          showNoResultsState) && (
          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-[calc(4rem+1rem)]
              -translate-x-1/2
            "
          >
            <div
              className="
                rounded-full
                border
                border-white/10
                bg-zinc-950/82
                px-4
                py-2
                text-center
                text-xs
                font-semibold
                text-zinc-200
                shadow-xl
                backdrop-blur-xl
              "
            >
              {showLowZoomState
                ? 'Zoom in to explore curated venues'
                : searchTerm.trim()
                  ? 'No places match this search in the current view'
                  : showLiveEventsOnly
                    ? 'No live-event venues are visible here'
                    : 'No curated venues are visible in this area'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}