// lib/maps/mapTypes.ts

import type { CITY_CONFIGS } from '@/config/cities'
import type { Venue } from '@/types/venue'

/**
 * Canonical city identifier used across all map surfaces.
 *
 * This type is derived directly from CITY_CONFIGS so adding or removing a city
 * updates the map system automatically.
 */
export type CitySlug = keyof typeof CITY_CONFIGS

/**
 * Product-level travel modes.
 *
 * Keep these independent from any routing provider's profile names.
 * Provider-specific mappings belong in the routing integration layer.
 */
export type TravelMode = 'walking' | 'cycling' | 'driving'

/**
 * User-selectable venue marker presentation.
 *
 * `brand` should become the premium default.
 * `category` may display a controlled category glyph inside the branded shell.
 *
 * Legacy values can be handled at component boundaries during migration.
 */
export type MarkerDisplayMode = 'brand' | 'category'

/**
 * Defines how much map detail should be rendered for the current viewport.
 */
export type MapDensityMode =
  | 'city-overview'
  | 'clusters'
  | 'priority'
  | 'full'

/**
 * High-level visual state for a venue marker.
 *
 * Marker priority should be resolved before rendering so one primary state
 * controls the marker's dominant appearance.
 */
export type VenueMarkerVisualState =
  | 'default'
  | 'upcoming-event'
  | 'live-event'
  | 'search-match'
  | 'selected'
  | 'route-stop'

/**
 * Route-stop role used to visually distinguish the beginning, middle and end
 * of a Flow.
 */
export type RouteStopRole = 'start' | 'middle' | 'end'

/**
 * Location source and permission status.
 *
 * A `fallback` coordinate may be used for camera initialization, but it must
 * never be presented to the user as their actual location.
 */
export type UserLocationStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'fallback'

/**
 * Structured user-location result returned by the geolocation hook.
 */
export type UserLocationResult = {
  position: MapCoordinate | null
  status: UserLocationStatus
  accuracyMeters: number | null
  error: string | null
}

/**
 * Standard latitude/longitude tuple used by Leaflet-facing map components.
 *
 * Tuple order is always:
 * [latitude, longitude]
 */
export type MapCoordinate = readonly [latitude: number, longitude: number]

/**
 * Mutable coordinate object used by application state and API payloads.
 */
export type MapPoint = {
  lat: number
  lon: number
}

/**
 * Leaflet-style coordinate object used when an API or map method expects
 * `lng` rather than `lon`.
 */
export type LeafletPoint = {
  lat: number
  lng: number
}

/**
 * Padding around the usable map viewport.
 *
 * Values are expressed in CSS pixels.
 */
export type MapInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Context used to calculate obstruction-aware map insets.
 */
export type MapInsetContext = {
  isMobile: boolean
  isPanelOpen: boolean
  hasPreviewSheet: boolean
  hasRouteControls: boolean
  hasTopNavigation?: boolean
}

/**
 * Current viewport snapshot reported by the Leaflet map.
 *
 * Bounds are intentionally represented as serializable numeric values rather
 * than a Leaflet LatLngBounds instance so this type remains framework-agnostic.
 */
export type MapViewport = {
  zoom: number
  center: LeafletPoint
  bounds: MapBounds
}

/**
 * Serializable geographic bounds.
 */
export type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

/**
 * Explicit camera instruction.
 *
 * The map camera controller should execute exactly one current intent.
 * Product state must never be inferred from coordinate comparisons.
 */
export type MapCameraIntent =
  | {
      type: 'overview'
      center: MapCoordinate
      zoom: number
    }
  | {
      type: 'city'
      city: CitySlug
      center: MapCoordinate
      zoom: number
    }
  | {
      type: 'route'
      route: Venue[]
      geometry?: RouteCoordinate[]
    }
  | {
      type: 'venue'
      venueId: string
      position: MapCoordinate
      zoom: number
    }
  | {
      type: 'custom-start'
      position: MapCoordinate
      zoom: number
    }
  | {
      type: 'user-location'
      position: MapCoordinate
      zoom: number
    }

/**
 * Controls what a click on an otherwise empty section of the map should do.
 */
export type MapClickMode = 'browse' | 'set-custom-start'

/**
 * Normalized route coordinate.
 *
 * Tuple order is always:
 * [latitude, longitude]
 */
export type RouteCoordinate = MapCoordinate

/**
 * Normalized route geometry shared by the main map, saved map and snapshots.
 */
export type RouteGeometry = {
  coordinates: RouteCoordinate[]
  distanceMeters: number | null
  durationSeconds: number | null
  provider: string | null
  isFallback: boolean
}

/**
 * Route-geometry request lifecycle.
 */
export type RouteGeometryStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'

/**
 * Result returned by the shared route-geometry hook.
 */
export type RouteGeometryResult = {
  geometry: RouteGeometry | null
  status: RouteGeometryStatus
  error: string | null
}

/**
 * Product-level route-generation confidence tier.
 */
export type FlowConfidenceTier = 'commit' | 'constrain' | 'clarify'

/**
 * Product-level route tightness preference.
 */
export type FlowTightness = 'tight' | 'medium' | 'loose'

/**
 * Lifecycle of Flow generation.
 */
export type FlowGenerationStatus =
  | 'idle'
  | 'parsing'
  | 'generating'
  | 'routing'
  | 'saving'
  | 'success'
  | 'error'

/**
 * Identifies how a generated Flow was initiated.
 */
export type FlowGenerationSource =
  | 'map'
  | 'map-marker'
  | 'venue-profile'
  | 'saved-guide'
  | 'event'
  | 'social-group'
  | 'shared-flow'
  | 'unknown'

/**
 * Context retained for Flow retries and analytics.
 *
 * This intentionally stores product-level context only. Provider responses and
 * debug payloads belong in provider-specific or API-specific type files.
 */
export type GeneratedFlowContext = {
  city: CitySlug | null
  source: FlowGenerationSource
  anchorVenueId: string | null
  anchorVenueName: string | null
  plannedStartAt: string | null
  travelMode: TravelMode
  tightness: FlowTightness
  maxStops: number
  retryAttempt: number
}

/**
 * Stable route membership information prepared by MapCanvas before markers
 * render.
 */
export type RouteVenueState = {
  routeIndex: number
  role: RouteStopRole
}

/**
 * Marker state prepared by the map orchestrator.
 *
 * VenueMarker should receive this resolved state rather than recomputing route,
 * search, event or selection logic independently.
 */
export type VenueMarkerState = {
  visualState: VenueMarkerVisualState
  selected: boolean
  markerScale: number
  route: RouteVenueState | null
  hasLiveEvent: boolean
  hasUpcomingEvent: boolean
  isSearchMatch: boolean
  isDimmed: boolean
}

/**
 * Branded city-overview marker activity.
 */
export type CityActivitySummary = {
  venueCount: number | null
  liveEventCount: number
  availableFlowCount: number | null
}

/**
 * Activity data keyed by city.
 */
export type CityActivityBySlug = Partial<
  Record<CitySlug, CityActivitySummary>
>

/**
 * State displayed by the map's contextual empty-state layer.
 */
export type MapEmptyStateKind =
  | 'choose-city'
  | 'zoom-in'
  | 'no-results'
  | 'no-live-events'
  | 'loading'
  | 'error'
  | null

/**
 * Clustering result shared by pure clustering logic and cluster-marker
 * presentation.
 */
export type VenueCluster = {
  id: string
  center: MapCoordinate
  venueIds: string[]
  count: number
  liveEventCount: number
  bounds: MapBounds
}

/**
 * Canonical map z-index hierarchy.
 *
 * Leaflet panes and global application modals may define their own layers,
 * but map UI should use these semantic levels instead of arbitrary values.
 */
export const MAP_Z_INDEX = {
  decorativeOverlay: 400,
  mapControls: 1000,
  previewSheet: 1100,
  panel: 1200,
  errorBanner: 1300,
  dialog: 2000,
} as const

export type MapZIndexLayer = keyof typeof MAP_Z_INDEX