
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
  DivIcon,
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
import '@/components/maps/map-markers.css'

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
   * Optional canonical city key supplied by the property
   * guide (for example, "atl" instead of "Atlanta").
   *
   * Existing callers remain compatible because the
   * property city is retained as the fallback.
   */
  normalizedCity?: string

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

/* ------------------------------------------------ */
/* Property map search/filter helpers — NEW         */
/* ------------------------------------------------ */

/**
 * Venue type, vibe, and tags support both strings
 * and string arrays.
 *
 * Comma-separated strings are also supported.
 */
function getVenueFilterValues(
  value: string | string[] | undefined
): string[] {
  if (!value) {
    return []
  }

  const values =
    Array.isArray(value)
      ? value
      : [value]

  return values
    .flatMap((item) =>
      item.split(',')
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean)
}

function normalizeFilterText(
  value: string
): string {
  return value
    .trim()
    .toLocaleLowerCase()
}

function getVenueFilterOptions(
  venues: Venue[],
  field: 'type' | 'vibe' | 'tags'
): string[] {
  const distinctValues =
    new Map<string, string>()

  for (const venue of venues) {
    const values =
      getVenueFilterValues(
        venue[field]
      )

    for (const value of values) {
      const normalized =
        normalizeFilterText(value)

      if (
        normalized &&
        !distinctValues.has(
          normalized
        )
      ) {
        distinctValues.set(
          normalized,
          value
        )
      }
    }
  }

  return Array.from(
    distinctValues.values()
  ).sort((a, b) =>
    a.localeCompare(b)
  )
}

function matchesVenueFilter(
  value: string | string[] | undefined,
  selectedValue: string
): boolean {
  if (!selectedValue) {
    return true
  }

  const normalizedSelected =
    normalizeFilterText(
      selectedValue
    )

  return getVenueFilterValues(
    value
  ).some(
    (item) =>
      normalizeFilterText(
        item
      ) === normalizedSelected
  )
}

export default function PropertyMap({
  property,
  venues,
  travelMode = 'walking',
  normalizedCity,
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

  /* ------------------------------------------------ */
  /* Property map search and filters — NEW           */
  /* ------------------------------------------------ */

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('')

  const [
    selectedType,
    setSelectedType,
  ] = useState('')

  const [
    selectedVibe,
    setSelectedVibe,
  ] = useState('')

  const [
    selectedTag,
    setSelectedTag,
  ] = useState('')

  const [
    filtersExpanded,
    setFiltersExpanded,
  ] = useState(false)

  const typeOptions =
    useMemo(
      () =>
        getVenueFilterOptions(
          venues,
          'type'
        ),
      [venues]
    )

  const vibeOptions =
    useMemo(
      () =>
        getVenueFilterOptions(
          venues,
          'vibe'
        ),
      [venues]
    )

  const tagOptions =
    useMemo(
      () =>
        getVenueFilterOptions(
          venues,
          'tags'
        ),
      [venues]
    )

  const filteredVenues =
    useMemo(() => {
      const normalizedSearch =
        normalizeFilterText(
          searchQuery
        )

      return venues.filter(
        (venue) => {
          if (
            !matchesVenueFilter(
              venue.type,
              selectedType
            )
          ) {
            return false
          }

          if (
            !matchesVenueFilter(
              venue.vibe,
              selectedVibe
            )
          ) {
            return false
          }

          if (
            !matchesVenueFilter(
              venue.tags,
              selectedTag
            )
          ) {
            return false
          }

          if (
            !normalizedSearch
          ) {
            return true
          }

          const searchableValues = [
            venue.name,
            ...getVenueFilterValues(
              venue.type
            ),
            ...getVenueFilterValues(
              venue.vibe
            ),
            ...getVenueFilterValues(
              venue.tags
            ),
          ]

          return searchableValues.some(
            (value) =>
              normalizeFilterText(
                value
              ).includes(
                normalizedSearch
              )
          )
        }
      )
    }, [
      venues,
      searchQuery,
      selectedType,
      selectedVibe,
      selectedTag,
    ])

  const hasActiveFilters =
    Boolean(
      searchQuery.trim() ||
      selectedType ||
      selectedVibe ||
      selectedTag
    )

  const activeDropdownFilterCount =
    [
      selectedType,
      selectedVibe,
      selectedTag,
    ].filter(Boolean).length

  function clearFilters() {
    setSearchQuery('')
    setSelectedType('')
    setSelectedVibe('')
    setSelectedTag('')
  }

  /**
   * Prefer the normalized city key when available.
   * Preserve the original property city as fallback.
   */
  const mapCity =
    normalizedCity ||
    property.city

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
        mapCity
      )
    }, [mapCity])

  /* ------------------------------------------------ */
  /* User location                                    */
  /* ------------------------------------------------ */

  const userLocation =
    useUserLocation({
      fallback: propertyCenter,
    })

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
  /* Property icon — dedicated Home Base marker       */
  /* ------------------------------------------------ */

  /**
   * The property is the guest's home base, not an
   * ordinary venue or a route-start waypoint.
   *
   * Use a property-only Leaflet DivIcon so this map
   * has a visually dominant gold marker without
   * changing shared Roam marker factories or CSS.
   *
   * The geographic anchor is the bottom tip of the
   * pin, so the larger marker remains accurately
   * positioned at the property's latitude/longitude.
   */
  const [
    propertyIcon,
    setPropertyIcon,
  ] = useState<DivIcon | null>(null)

  useEffect(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return
    }

    try {
      const L = require('leaflet')

      const icon = L.divIcon({
        className:
          'roam-leaflet-div-icon roam-leaflet-div-icon--property',

        iconSize: [
          120,
          90,
        ],

        iconAnchor: [
          60,
          82,
        ],

        popupAnchor: [
          0,
          -65,
        ],

        html: `
          <div
            style="
              position: relative;
              width: 120px;
              height: 90px;
              overflow: visible;
              pointer-events: none;
              user-select: none;
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="120"
              height="90"
              viewBox="0 0 120 90"
              fill="none"
              aria-hidden="true"
              style="
                display: block;
                overflow: visible;
                filter: drop-shadow(0 7px 13px rgba(0,0,0,0.55));
              "
            >
              <defs>
                <radialGradient
                  id="roam-property-home-halo"
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <stop
                    offset="0%"
                    stop-color="#e7c88e"
                    stop-opacity="0.34"
                  />
                  <stop
                    offset="100%"
                    stop-color="#e7c88e"
                    stop-opacity="0"
                  />
                </radialGradient>

                <linearGradient
                  id="roam-property-home-pin"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stop-color="#f4dfb5"
                  />
                  <stop
                    offset="55%"
                    stop-color="#dfbd80"
                  />
                  <stop
                    offset="100%"
                    stop-color="#b78e54"
                  />
                </linearGradient>

                <linearGradient
                  id="roam-property-home-shell"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stop-color="#242b2b"
                  />
                  <stop
                    offset="100%"
                    stop-color="#101615"
                  />
                </linearGradient>
              </defs>

              <!-- Soft separation from surrounding markers -->
              <circle
                cx="60"
                cy="51"
                r="45"
                fill="url(#roam-property-home-halo)"
              />

              <!-- Permanent Home Base label -->
              <rect
                x="17"
                y="1"
                width="86"
                height="20"
                rx="10"
                fill="#e8cc97"
                stroke="#fff1cf"
                stroke-width="0.8"
              />

              <text
                x="60"
                y="14.3"
                text-anchor="middle"
                fill="#242019"
                font-family="Arial, Helvetica, sans-serif"
                font-size="9"
                font-weight="800"
                letter-spacing="1.15"
              >
                HOME BASE
              </text>

              <!-- Dark silhouette for map contrast -->
              <path
                d="
                  M60 24
                  C42.5 24 29 37.5 29 54
                  C29 66.5 40 75.5 60 82
                  C80 75.5 91 66.5 91 54
                  C91 37.5 77.5 24 60 24
                  Z
                "
                fill="url(#roam-property-home-shell)"
                stroke="#f1d6a2"
                stroke-width="2.6"
                stroke-linejoin="round"
              />

              <!-- Property identity circle -->
              <circle
                cx="60"
                cy="51"
                r="22"
                fill="url(#roam-property-home-pin)"
                stroke="#fff1cf"
                stroke-width="1.2"
              />

              <!-- House glyph -->
              <path
                d="
                  M47 51
                  L60 40
                  L73 51
                  M50 49
                  V63
                  H70
                  V49
                  M57 63
                  V54
                  H63
                  V63
                "
                stroke="#242019"
                stroke-width="2.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        `,
      })

      setPropertyIcon(icon)
    } catch (error: unknown) {
      if (
        process.env.NODE_ENV ===
        'development'
      ) {
        console.error(
          '[PropertyMap] Failed to create property marker icon',
          error
        )
      }
    }
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
  /* Map with search/filter controls                  */
  /* ------------------------------------------------ */

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141b]">

      {/* -------------------------------------------- */}
      {/* Compact search and filters — VISUAL UPDATE  */}
      {/* -------------------------------------------- */}

      <div className="relative z-[500] shrink-0 border-b border-white/10 bg-[#10141b] px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">

          {/* Search — compact charcoal/gold treatment */}

          <div className="relative min-w-0 flex-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d6ba83]"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />

              <path d="m20 20-4-4" />
            </svg>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder="Find a place, vibe, or tag..."
              aria-label="Search venues on the property map"
              className="min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] py-2 pl-10 pr-3 text-base text-white placeholder:text-zinc-400 outline-none transition focus:border-[#d6ba83]/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#d6ba83]/15 sm:text-sm"
            />
          </div>

          {/* Filters — compact charcoal/gold treatment */}

          <button
            type="button"
            onClick={() =>
              setFiltersExpanded(
                (current) =>
                  !current
              )
            }
            aria-expanded={
              filtersExpanded
            }
            aria-controls="roam-property-map-filters"
            className={[
              'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition',
              filtersExpanded ||
              activeDropdownFilterCount > 0
                ? 'border-[#d6ba83]/60 bg-[#d6ba83]/15 text-[#e8d2ac]'
                : 'border-white/10 bg-white/[0.06] text-zinc-200 hover:border-[#d6ba83]/40 hover:bg-white/[0.10]',
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-[#d6ba83]"
            >
              <path d="M4 7h16M7 12h10M10 17h4" />
            </svg>

            Filters

            {activeDropdownFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d6ba83] px-1 text-[10px] font-bold text-[#17191e]">
                {activeDropdownFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded filters — retain existing functionality */}

        {filtersExpanded && (
          <div
            id="roam-property-map-filters"
            className="mt-2 grid grid-cols-1 gap-2 border-t border-white/10 pt-2 sm:grid-cols-3"
          >
            <label className="block min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#d6ba83]">
                Type
              </span>

              <select
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(
                    event.target.value
                  )
                }
                className="min-h-10 w-full rounded-lg border border-white/10 bg-[#202630] px-3 text-sm text-white outline-none transition focus:border-[#d6ba83]/70 focus:ring-2 focus:ring-[#d6ba83]/15"
              >
                <option value="">
                  All types
                </option>

                {typeOptions.map(
                  (option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#d6ba83]">
                Vibe
              </span>

              <select
                value={selectedVibe}
                onChange={(event) =>
                  setSelectedVibe(
                    event.target.value
                  )
                }
                className="min-h-10 w-full rounded-lg border border-white/10 bg-[#202630] px-3 text-sm text-white outline-none transition focus:border-[#d6ba83]/70 focus:ring-2 focus:ring-[#d6ba83]/15"
              >
                <option value="">
                  All vibes
                </option>

                {vibeOptions.map(
                  (option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block min-w-0 space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#d6ba83]">
                Tag
              </span>

              <select
                value={selectedTag}
                onChange={(event) =>
                  setSelectedTag(
                    event.target.value
                  )
                }
                className="min-h-10 w-full rounded-lg border border-white/10 bg-[#202630] px-3 text-sm text-white outline-none transition focus:border-[#d6ba83]/70 focus:ring-2 focus:ring-[#d6ba83]/15"
              >
                <option value="">
                  All tags
                </option>

                {tagOptions.map(
                  (option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
        )}

        {/* Only allocate a second row when filters
            actually need a Clear action. This removes
            the empty whitespace in the default state. */}

        {hasActiveFilters && (
          <div className="mt-1 flex min-h-4 items-center justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-semibold text-[#d6ba83] underline-offset-4 transition hover:text-[#e8d2ac] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------- */}
      {/* Existing Leaflet map — preserved             */}
      {/* -------------------------------------------- */}

      <div className="relative min-h-0 flex-1">
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
              zIndexOffset={2000}
              title={`${property.name} — Home Base`}
            />
          )}

          {/* Venue markers — filtered selection */}

          {filteredVenues.map(
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
                    mapCity
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

        {/* Existing empty-state feedback — preserved */}

        {hasActiveFilters &&
          filteredVenues.length === 0 && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-[500] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-950/90 px-4 py-3 text-center shadow-xl backdrop-blur-md">
              <p className="text-sm font-semibold text-white">
                No matching places
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-300">
                Try another venue name, type, vibe, or tag.
              </p>
            </div>
          )}
      </div>
    </div>
  )
}
