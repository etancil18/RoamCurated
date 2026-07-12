// lib/maps/viewport.ts

import type { Venue } from '@/types/venue'
import type {
  MapBounds,
  MapCameraIntent,
  MapCoordinate,
  MapDensityMode,
  MapInsetContext,
  MapInsets,
  MapPoint,
  RouteCoordinate,
} from '@/lib/maps/mapTypes'

const USA_CENTER: MapCoordinate = [37.8, -96.9]
const USA_ZOOM = 4

/**
 * Centralized viewport constants.
 *
 * Values are expressed in CSS pixels unless otherwise noted.
 */
export const MAP_VIEWPORT_CONFIG = {
  overview: {
    center: USA_CENTER,
    zoom: USA_ZOOM,
  },

  zoom: {
    cityFallback: 12,
    venueFocus: 16,
    customStartFocus: 16,
    userLocationFocus: 16,
    routeMax: 16,
    routeMin: 11,
  },

  animation: {
    overviewDurationSeconds: 0.85,
    cityDurationSeconds: 0.8,
    venueDurationSeconds: 0.65,
    customStartDurationSeconds: 0.65,
    userLocationDurationSeconds: 0.65,
    routeDurationSeconds: 0.8,
  },

  insets: {
    desktop: {
      topNavigation: 72,
      topControls: 64,
      rightBase: 32,
      bottomBase: 40,
      leftBase: 32,
      panelWidth: 380,
      previewSheet: 210,
      routeControls: 76,
    },

    mobile: {
      topNavigation: 64,
      topControls: 56,
      rightBase: 20,
      bottomBase: 24,
      leftBase: 20,
      panelWidth: 0,
      previewSheet: 230,
      routeControls: 84,
    },
  },

  focusOffset: {
    desktop: {
      selectedVenueVertical: 90,
      selectedVenueWithPreview: 150,
      customStartVertical: 48,
      userLocationVertical: 48,
    },

    mobile: {
      selectedVenueVertical: 110,
      selectedVenueWithPreview: 220,
      customStartVertical: 70,
      userLocationVertical: 70,
    },
  },
} as const

export type RouteFitOptions = {
  paddingTopLeft: [number, number]
  paddingBottomRight: [number, number]
  maxZoom: number
  animate: boolean
  duration: number
}

export type FlyToOptions = {
  animate: boolean
  duration: number
}

export type VenueFocusOptions = {
  center: MapCoordinate
  zoom: number
  offsetPixels: {
    x: number
    y: number
  }
  flyToOptions: FlyToOptions
}

export type RouteBoundsResult = {
  bounds: MapBounds
  coordinates: RouteCoordinate[]
}

export type ResolveCameraIntentInput = {
  selectedVenue?: Venue | null
  route?: Venue[]
  routeGeometry?: RouteCoordinate[] | null
  customStart?: MapPoint | null
  userLocation?: MapPoint | null
  shouldFocusUserLocation?: boolean
  selectedCity?: string | null
  cityCenter?: MapCoordinate | null
  cityZoom?: number | null
  currentZoom?: number
  overviewCenter?: MapCoordinate
  overviewZoom?: number
}

export type MapViewportSize = {
  width: number
  height: number
}

export type VisibleMapArea = {
  width: number
  height: number
  centerOffsetX: number
  centerOffsetY: number
}

/**
 * Calculate all UI obstruction insets for the current map state.
 *
 * These values should be shared by route fitting, venue focusing and map
 * recentering so every camera action respects the same visible map area.
 */
export function getMapInsets(
  context: MapInsetContext
): MapInsets {
  const config = context.isMobile
    ? MAP_VIEWPORT_CONFIG.insets.mobile
    : MAP_VIEWPORT_CONFIG.insets.desktop

  const top =
    config.topControls +
    (context.hasTopNavigation === false
      ? 0
      : config.topNavigation)

  const left =
    config.leftBase +
    (!context.isMobile && context.isPanelOpen
      ? config.panelWidth
      : 0)

  const bottom =
    config.bottomBase +
    (context.hasPreviewSheet
      ? config.previewSheet
      : 0) +
    (context.hasRouteControls
      ? config.routeControls
      : 0)

  return {
    top,
    right: config.rightBase,
    bottom,
    left,
  }
}

/**
 * Return Leaflet-compatible route-fit options.
 */
export function getRouteFitOptions(
  insets: MapInsets,
  overrides: Partial<{
    maxZoom: number
    duration: number
    animate: boolean
  }> = {}
): RouteFitOptions {
  return {
    paddingTopLeft: [
      sanitizeInset(insets.left),
      sanitizeInset(insets.top),
    ],
    paddingBottomRight: [
      sanitizeInset(insets.right),
      sanitizeInset(insets.bottom),
    ],
    maxZoom:
      overrides.maxZoom ??
      MAP_VIEWPORT_CONFIG.zoom.routeMax,
    animate: overrides.animate ?? true,
    duration:
      overrides.duration ??
      MAP_VIEWPORT_CONFIG.animation
        .routeDurationSeconds,
  }
}

/**
 * Return a venue focus configuration that accounts for panels and sheets.
 *
 * The offset is returned separately because Leaflet's flyTo does not support
 * pixel offsets directly. The camera controller can apply it with
 * map.project()/map.unproject() or map.panBy() after zooming.
 */
export function getVenueFocusOptions({
  position,
  currentZoom,
  isMobile,
  hasPreviewSheet,
  isPanelOpen,
}: {
  position: MapCoordinate
  currentZoom: number
  isMobile: boolean
  hasPreviewSheet: boolean
  isPanelOpen: boolean
}): VenueFocusOptions {
  const offsetConfig = isMobile
    ? MAP_VIEWPORT_CONFIG.focusOffset.mobile
    : MAP_VIEWPORT_CONFIG.focusOffset.desktop

  const verticalOffset = hasPreviewSheet
    ? offsetConfig.selectedVenueWithPreview
    : offsetConfig.selectedVenueVertical

  const horizontalOffset =
    !isMobile && isPanelOpen
      ? Math.round(
          MAP_VIEWPORT_CONFIG.insets.desktop
            .panelWidth / 2
        )
      : 0

  return {
    center: position,
    zoom: Math.max(
      sanitizeZoom(currentZoom),
      MAP_VIEWPORT_CONFIG.zoom.venueFocus
    ),
    offsetPixels: {
      x: horizontalOffset,
      y: verticalOffset,
    },
    flyToOptions: {
      animate: true,
      duration:
        MAP_VIEWPORT_CONFIG.animation
          .venueDurationSeconds,
    },
  }
}

/**
 * Return the pixel offset used when centering a custom start.
 */
export function getCustomStartFocusOffset({
  isMobile,
  isPanelOpen,
}: {
  isMobile: boolean
  isPanelOpen: boolean
}): {
  x: number
  y: number
} {
  const config = isMobile
    ? MAP_VIEWPORT_CONFIG.focusOffset.mobile
    : MAP_VIEWPORT_CONFIG.focusOffset.desktop

  return {
    x:
      !isMobile && isPanelOpen
        ? Math.round(
            MAP_VIEWPORT_CONFIG.insets.desktop
              .panelWidth / 2
          )
        : 0,
    y: config.customStartVertical,
  }
}

/**
 * Return the pixel offset used when centering the user location.
 */
export function getUserLocationFocusOffset({
  isMobile,
  isPanelOpen,
}: {
  isMobile: boolean
  isPanelOpen: boolean
}): {
  x: number
  y: number
} {
  const config = isMobile
    ? MAP_VIEWPORT_CONFIG.focusOffset.mobile
    : MAP_VIEWPORT_CONFIG.focusOffset.desktop

  return {
    x:
      !isMobile && isPanelOpen
        ? Math.round(
            MAP_VIEWPORT_CONFIG.insets.desktop
              .panelWidth / 2
          )
        : 0,
    y: config.userLocationVertical,
  }
}

/**
 * Resolve one explicit camera intent from current product state.
 *
 * Priority:
 * 1. Selected venue
 * 2. Active route
 * 3. Explicit user-location focus
 * 4. Custom start
 * 5. Selected city
 * 6. National overview
 */
export function resolveMapCameraIntent({
  selectedVenue = null,
  route = [],
  routeGeometry = null,
  customStart = null,
  userLocation = null,
  shouldFocusUserLocation = false,
  selectedCity = null,
  cityCenter = null,
  cityZoom = null,
  currentZoom = MAP_VIEWPORT_CONFIG.zoom.cityFallback,
  overviewCenter =
    MAP_VIEWPORT_CONFIG.overview.center,
  overviewZoom =
    MAP_VIEWPORT_CONFIG.overview.zoom,
}: ResolveCameraIntentInput): MapCameraIntent {
  if (
    selectedVenue &&
    hasValidVenueCoordinates(selectedVenue)
  ) {
    return {
      type: 'venue',
      venueId:
        getVenueIdentifier(selectedVenue) ??
        'unknown-venue',
      position: [
        selectedVenue.lat,
        selectedVenue.lon,
      ],
      zoom: Math.max(
        sanitizeZoom(currentZoom),
        MAP_VIEWPORT_CONFIG.zoom.venueFocus
      ),
    }
  }

  const validRoute = normalizeRouteVenues(route)

  if (validRoute.length >= 2) {
    return {
      type: 'route',
      route: validRoute,
      geometry:
        routeGeometry &&
        routeGeometry.length >= 2
          ? normalizeRouteCoordinates(
              routeGeometry
            )
          : undefined,
    }
  }

  if (
    shouldFocusUserLocation &&
    userLocation &&
    isValidMapPoint(userLocation)
  ) {
    return {
      type: 'user-location',
      position: [
        userLocation.lat,
        userLocation.lon,
      ],
      zoom:
        MAP_VIEWPORT_CONFIG.zoom
          .userLocationFocus,
    }
  }

  if (
    customStart &&
    isValidMapPoint(customStart)
  ) {
    return {
      type: 'custom-start',
      position: [
        customStart.lat,
        customStart.lon,
      ],
      zoom:
        MAP_VIEWPORT_CONFIG.zoom
          .customStartFocus,
    }
  }

  if (
    selectedCity &&
    cityCenter &&
    isValidCoordinate(cityCenter)
  ) {
    return {
      type: 'city',
      city: selectedCity as never,
      center: cityCenter,
      zoom:
        cityZoom !== null
          ? sanitizeZoom(cityZoom)
          : MAP_VIEWPORT_CONFIG.zoom
              .cityFallback,
    }
  }

  return {
    type: 'overview',
    center: overviewCenter,
    zoom: sanitizeZoom(overviewZoom),
  }
}

/**
 * Build geographic bounds from normalized route geometry.
 */
export function getRouteGeometryBounds(
  coordinates: RouteCoordinate[]
): RouteBoundsResult | null {
  const validCoordinates =
    normalizeRouteCoordinates(coordinates)

  if (validCoordinates.length < 2) {
    return null
  }

  return {
    coordinates: validCoordinates,
    bounds: getBoundsFromCoordinates(
      validCoordinates
    ),
  }
}

/**
 * Build geographic bounds from route venue coordinates.
 */
export function getRouteVenueBounds(
  route: Venue[]
): RouteBoundsResult | null {
  const coordinates = normalizeRouteVenues(
    route
  ).map(
    (venue) =>
      [venue.lat, venue.lon] as RouteCoordinate
  )

  if (coordinates.length < 2) {
    return null
  }

  return {
    coordinates,
    bounds: getBoundsFromCoordinates(
      coordinates
    ),
  }
}

/**
 * Resolve the strongest available bounds source.
 *
 * Provider route geometry is preferred because roads may extend beyond the
 * straight bounds created from stop coordinates.
 */
export function getPreferredRouteBounds({
  route,
  geometry,
}: {
  route: Venue[]
  geometry?: RouteCoordinate[] | null
}): RouteBoundsResult | null {
  if (geometry && geometry.length >= 2) {
    const geometryBounds =
      getRouteGeometryBounds(geometry)

    if (geometryBounds) {
      return geometryBounds
    }
  }

  return getRouteVenueBounds(route)
}

/**
 * Convert geographic bounds to a Leaflet-compatible coordinate pair.
 */
export function mapBoundsToLeafletBounds(
  bounds: MapBounds
): [
  [number, number],
  [number, number],
] {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ]
}

/**
 * Return the usable map area after UI obstruction.
 */
export function getVisibleMapArea(
  viewport: MapViewportSize,
  insets: MapInsets
): VisibleMapArea {
  const width = Math.max(
    0,
    viewport.width -
      insets.left -
      insets.right
  )

  const height = Math.max(
    0,
    viewport.height -
      insets.top -
      insets.bottom
  )

  return {
    width,
    height,
    centerOffsetX:
      (insets.left - insets.right) / 2,
    centerOffsetY:
      (insets.top - insets.bottom) / 2,
  }
}

/**
 * Return the pixel offset that moves a geographic target into the center of
 * the currently visible map area.
 *
 * Positive x pans the target right.
 * Positive y pans the target down.
 */
export function getVisibleAreaCenterOffset(
  insets: MapInsets
): {
  x: number
  y: number
} {
  return {
    x: (insets.left - insets.right) / 2,
    y: (insets.top - insets.bottom) / 2,
  }
}

/**
 * Return the appropriate zoom-responsive map density mode.
 *
 * This duplicates no marker ranking logic and exists here only for camera/UI
 * consumers that need the viewport density state.
 */
export function getViewportDensityMode(
  zoom: number
): MapDensityMode {
  if (!Number.isFinite(zoom) || zoom < 11) {
    return 'city-overview'
  }

  if (zoom < 13.25) {
    return 'clusters'
  }

  if (zoom < 15) {
    return 'priority'
  }

  return 'full'
}

/**
 * Normalize route venues and reject malformed coordinates.
 */
export function normalizeRouteVenues(
  route: Venue[]
): Venue[] {
  if (!Array.isArray(route)) return []

  return route.filter(
    hasValidVenueCoordinates
  )
}

/**
 * Normalize route coordinates and reject malformed entries.
 */
export function normalizeRouteCoordinates(
  coordinates: RouteCoordinate[]
): RouteCoordinate[] {
  if (!Array.isArray(coordinates)) {
    return []
  }

  return coordinates.filter(
    isValidCoordinate
  )
}

/**
 * Return whether a geographic coordinate is valid.
 */
export function isValidCoordinate(
  coordinate: readonly [
    number,
    number,
  ]
): coordinate is MapCoordinate {
  const [latitude, longitude] =
    coordinate

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

/**
 * Return whether a map point is valid.
 */
export function isValidMapPoint(
  point: MapPoint
): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  )
}

/**
 * Return whether a venue has valid coordinates.
 */
export function hasValidVenueCoordinates(
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

/**
 * Ensure a zoom value is finite and within Leaflet's practical range.
 */
export function sanitizeZoom(
  zoom: number
): number {
  if (!Number.isFinite(zoom)) {
    return MAP_VIEWPORT_CONFIG.zoom
      .cityFallback
  }

  return clamp(zoom, 1, 22)
}

/**
 * Return whether two coordinate tuples are effectively equal.
 *
 * Useful for preventing repeated camera intents caused by insignificant
 * floating-point differences.
 */
export function areCoordinatesEqual(
  first: MapCoordinate,
  second: MapCoordinate,
  precision = 6
): boolean {
  const factor = 10 ** precision

  return (
    Math.round(first[0] * factor) ===
      Math.round(second[0] * factor) &&
    Math.round(first[1] * factor) ===
      Math.round(second[1] * factor)
  )
}

/**
 * Build a stable camera-intent signature for deduplication.
 */
export function getCameraIntentSignature(
  intent: MapCameraIntent
): string {
  switch (intent.type) {
    case 'overview':
      return [
        intent.type,
        formatCoordinate(intent.center),
        sanitizeZoom(intent.zoom),
      ].join(':')

    case 'city':
      return [
        intent.type,
        intent.city,
        formatCoordinate(intent.center),
        sanitizeZoom(intent.zoom),
      ].join(':')

    case 'venue':
      return [
        intent.type,
        intent.venueId,
        formatCoordinate(intent.position),
        sanitizeZoom(intent.zoom),
      ].join(':')

    case 'custom-start':
    case 'user-location':
      return [
        intent.type,
        formatCoordinate(intent.position),
        sanitizeZoom(intent.zoom),
      ].join(':')

    case 'route': {
      const routeSignature = intent.route
        .map((venue) => {
          const identifier =
            getVenueIdentifier(venue) ??
            'unknown'

          return [
            identifier,
            formatNumber(venue.lat),
            formatNumber(venue.lon),
          ].join('@')
        })
        .join('|')

      const geometrySignature =
        intent.geometry
          ?.map(formatCoordinate)
          .join('|') ?? ''

      return [
        intent.type,
        routeSignature,
        geometrySignature,
      ].join(':')
    }
  }
}

function getBoundsFromCoordinates(
  coordinates: RouteCoordinate[]
): MapBounds {
  let north = -90
  let south = 90
  let east = -180
  let west = 180

  for (const [
    latitude,
    longitude,
  ] of coordinates) {
    north = Math.max(north, latitude)
    south = Math.min(south, latitude)
    east = Math.max(east, longitude)
    west = Math.min(west, longitude)
  }

  return {
    north,
    south,
    east,
    west,
  }
}

function getVenueIdentifier(
  venue: Venue
): string | null {
  if (
    typeof venue.id === 'string' &&
    venue.id.trim()
  ) {
    return venue.id.trim()
  }

  if (
    typeof venue.slug === 'string' &&
    venue.slug.trim()
  ) {
    return venue.slug.trim()
  }

  return null
}

function sanitizeInset(
  value: number
): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function formatCoordinate(
  coordinate: MapCoordinate
): string {
  return [
    formatNumber(coordinate[0]),
    formatNumber(coordinate[1]),
  ].join(',')
}

function formatNumber(
  value: number
): string {
  return Number.isFinite(value)
    ? value.toFixed(6)
    : 'invalid'
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  )
}