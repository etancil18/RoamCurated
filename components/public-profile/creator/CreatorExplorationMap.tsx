'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  MutableRefObject,
} from 'react'

import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet'

import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
} from 'leaflet'

import {
  CARTO_DARK_BASEMAP_URL,
  CARTO_BASEMAP_ATTRIBUTION,
} from '@/lib/maps/basemaps'

import {
  DateTime,
} from 'luxon'

import type {
  Venue,
} from '@/types/venue'

import type {
  PublicCreatorMapData,
  PublicCreatorMapVenue,
} from '@/lib/creator/mapTypes'

import type {
  CitySlug,
} from '@/lib/maps/mapTypes'

import {
  CITY_CONFIGS,
} from '@/config/cities'

import {
  useMapInitialization,
} from '@/hooks/useMapInitialization'

import CitySelector from '@/components/maps/CitySelector'
import VenueMarker from '@/components/maps/VenueMarker'
import VenuePreviewSheet from '@/components/maps/VenuePreviewSheet'

import {
  CreatorMapVenueProvider,
  useCreatorMapVenue,
  type CreatorMapVenueSelection,
} from './CreatorMapVenueContext'

import 'leaflet/dist/leaflet.css'
import '@/components/maps/map-markers.css'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorExplorationMapProps = {
  /**
   * Sanitized, server-loaded public map payload.
   *
   * Never pass raw venue_visits rows into this component.
   */
  map: PublicCreatorMapData

  /**
   * Human-readable creator name used in accessible labels and
   * empty-state presentation.
   */
  creatorName: string

  /**
   * Optional fallback city used when a venue does not include one.
   */
  primaryCity?: string | null

  /**
   * Optional initial selected venue.
   *
   * The ID is accepted only when it exists in the public map payload.
   */
  initialSelectedVenueId?: string | null

  /**
   * Parent-owned Flow generation.
   *
   * The component deliberately does not call private route APIs itself.
   */
  onGenerateFlow?: (
    venue: Venue
  ) => void | Promise<void>

  isGeneratingFlow?: boolean
  generateFlowError?: string | null

  /**
   * Optional analytics or URL-state synchronization.
   */
  onSelectionChange?: (
    selection:
      CreatorMapVenueSelection | null,
    venue:
      Venue | null
  ) => void

  /**
   * Optional callback fired before navigation to a venue profile.
   */
  onViewVenue?: (
    venue: Venue
  ) => void

  /**
   * Optional callback fired after Leaflet has initialized and the
   * initial public venue viewport has been applied.
   */
  onMapReady?: (
    data: {
      venueCount: number
      exploredCount: number
      recommendedCount: number
    }
  ) => void

  /**
   * Map presentation configuration.
   */
  minimumHeight?: number
  initialZoom?: number
  maximumZoom?: number
  scrollWheelZoom?: boolean

  className?: string
}

/* =========================================================
 * Constants
 * ======================================================= */

const DEFAULT_CENTER:
  [number, number] = [
    39.8283,
    -98.5795,
  ]

const DEFAULT_INITIAL_ZOOM =
  4

const DEFAULT_MAXIMUM_ZOOM =
  18

const DEFAULT_MINIMUM_HEIGHT =
  440

const SINGLE_VENUE_ZOOM =
  14

const MULTI_VENUE_MAX_FIT_ZOOM =
  14

const SELECTED_VENUE_ZOOM =
  16

const EMPTY_EVENTS:
  Record<
    string,
    any[]
  > = {}

/* =========================================================
 * Main public component
 * ======================================================= */

export default function CreatorExplorationMap({
  map,
  creatorName,
  primaryCity = null,
  initialSelectedVenueId = null,
  onGenerateFlow,
  isGeneratingFlow = false,
  generateFlowError = null,
  onSelectionChange,
  onViewVenue,
  onMapReady,
  minimumHeight =
    DEFAULT_MINIMUM_HEIGHT,
  initialZoom =
    DEFAULT_INITIAL_ZOOM,
  maximumZoom =
    DEFAULT_MAXIMUM_ZOOM,
  scrollWheelZoom = true,
  className,
}: CreatorExplorationMapProps) {
  const venues =
    useMemo(
      () =>
        map.venues
          .map(
            (
              venue:
                PublicCreatorMapVenue
            ) =>
              adaptPublicCreatorMapVenue(
                venue
              )
          )
          .filter(
            (
              venue
            ): venue is Venue =>
              venue !== null
          ),
      [
        map.venues,
      ]
    )

  /**
   * Temporary compatibility boundary for legacy explored-only
   * loader payloads that contain `venueCount` but not `counts`.
   *
   * The canonical map contract remains:
   *
   * {
   *   venues,
   *   counts: {
   *     explored,
   *     recommended
   *   }
   * }
   */
  const resolvedCounts =
    useMemo(
      () =>
        resolvePublicCreatorMapCounts(
          map
        ),
      [
        map,
      ]
    )

  const safeMinimumHeight =
    normalizeInteger({
      value:
        minimumHeight,
      minimum:
        320,
      maximum:
        900,
      fallback:
        DEFAULT_MINIMUM_HEIGHT,
    })

  const safeMaximumZoom =
    normalizeInteger({
      value:
        maximumZoom,
      minimum:
        8,
      maximum:
        22,
      fallback:
        DEFAULT_MAXIMUM_ZOOM,
    })

  const safeInitialZoom =
    normalizeInteger({
      value:
        initialZoom,
      minimum:
        1,
      maximum:
        safeMaximumZoom,
      fallback:
        Math.min(
          DEFAULT_INITIAL_ZOOM,
          safeMaximumZoom
        ),
    })

  const resolvedCreatorName =
    normalizeText(
      creatorName
    ) ??
    'This creator'

  if (
    venues.length ===
    0
  ) {
    return (
      <CreatorExplorationMapEmptyState
        creatorName={
          resolvedCreatorName
        }
        className={
          className
        }
      />
    )
  }

  return (
    <CreatorMapVenueProvider
      venues={
        venues
      }
      initialSelectedVenueId={
        initialSelectedVenueId
      }
      onSelectionChange={
        onSelectionChange
      }
    >
      <CreatorExplorationMapSurface
        creatorName={
          resolvedCreatorName
        }
        venues={
          venues
        }
        exploredCount={
          resolvedCounts.explored
        }
        recommendedCount={
          resolvedCounts.recommended
        }
        primaryCity={
          primaryCity
        }
        onGenerateFlow={
          onGenerateFlow
        }
        isGeneratingFlow={
          isGeneratingFlow
        }
        generateFlowError={
          generateFlowError
        }
        onViewVenue={
          onViewVenue
        }
        onMapReady={
          onMapReady
        }
        minimumHeight={
          safeMinimumHeight
        }
        initialZoom={
          safeInitialZoom
        }
        maximumZoom={
          safeMaximumZoom
        }
        scrollWheelZoom={
          scrollWheelZoom
        }
        className={
          className
        }
      />
    </CreatorMapVenueProvider>
  )
}

/* =========================================================
 * Map surface
 * ======================================================= */

function CreatorExplorationMapSurface({
  creatorName,
  venues,
  exploredCount,
  recommendedCount,
  primaryCity,
  onGenerateFlow,
  isGeneratingFlow,
  generateFlowError,
  onViewVenue,
  onMapReady,
  minimumHeight,
  initialZoom,
  maximumZoom,
  scrollWheelZoom,
  className,
}: {
  creatorName: string
  venues: Venue[]
  exploredCount: number
  recommendedCount: number
  primaryCity: string | null

  onGenerateFlow?: (
    venue: Venue
  ) => void | Promise<void>

  isGeneratingFlow: boolean
  generateFlowError: string | null

  onViewVenue?: (
    venue: Venue
  ) => void

  onMapReady?: (
    data: {
      venueCount: number
      exploredCount: number
      recommendedCount: number
    }
  ) => void

  minimumHeight: number
  initialZoom: number
  maximumZoom: number
  scrollWheelZoom: boolean
  className?: string
}) {
  const mapRef =
    useRef<
      LeafletMap | null
    >(
      null
    )

  const markerRefs =
    useRef<
      Record<
        string,
        LeafletMarker
      >
    >({})

  const [
    selectedCity,
    setSelectedCity,
  ] = useState<
    CitySlug | null
  >(
    null
  )

  const {
    selectedVenue,
    selectedVenueId,
    selectVenue,
    clearSelection,
  } =
    useCreatorMapVenue()

  /**
   * Only cities represented by this creator's sanitized public
   * venue payload appear in the embedded selector.
   */
  const availableCities =
    useMemo<
      CitySlug[]
    >(
      () => {
        const representedCities =
          new Set<
            CitySlug
          >()

        for (
          const venue of
          venues
        ) {
          const citySlug =
            resolveVenueCitySlug(
              venue.city
            )

          if (citySlug) {
            representedCities.add(
              citySlug
            )
          }
        }

        return (
          Object.keys(
            CITY_CONFIGS
          ) as CitySlug[]
        ).filter(
          (
            citySlug
          ) =>
            representedCities.has(
              citySlug
            )
        )
      },
      [
        venues,
      ]
    )

  /**
   * City selection affects only the public venue projection
   * already supplied to this component. It never triggers a
   * private venue or visit query.
   */
  const visibleVenues =
    useMemo(
      () => {
        if (
          selectedCity ===
          null
        ) {
          return venues
        }

        return venues.filter(
          (
            venue
          ) =>
            resolveVenueCitySlug(
              venue.city
            ) ===
            selectedCity
        )
      },
      [
        selectedCity,
        venues,
      ]
    )

  const mapCenter =
    useMemo<
      [number, number]
    >(
      () =>
        selectedCity
          ? CITY_CONFIGS[
              selectedCity
            ]?.center ??
            resolveMapCenter(
              visibleVenues
            )
          : resolveMapCenter(
              visibleVenues
            ),
      [
        selectedCity,
        visibleVenues,
      ]
    )

  const selectedVenueCity =
    useMemo(
      () =>
        selectedVenue
          ? resolveVenueCity({
              venue:
                selectedVenue,
              fallbackCity:
                primaryCity,
            })
          : null,
      [
        primaryCity,
        selectedVenue,
      ]
    )

  const selectedVenueNow =
    useMemo(
      () =>
        selectedVenueCity
          ? resolveNowForCity(
              selectedVenueCity
            )
          : null,
      [
        selectedVenueCity,
      ]
    )

  const handleMapInitialized =
    useCallback(
      () => {
        onMapReady?.({
          venueCount:
            venues.length,

          exploredCount,

          recommendedCount,
        })
      },
      [
        exploredCount,
        onMapReady,
        recommendedCount,
        venues.length,
      ]
    )

  const handleSelectCity =
    useCallback(
      (
        city:
          CitySlug | null
      ) => {
        clearSelection()
        setSelectedCity(
          city
        )
      },
      [
        clearSelection,
      ]
    )

  return (
    <section
      aria-label={`${creatorName}'s exploration map`}
      data-roam-map-context="creator-exploration-map"
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950',
        className,
      ]
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
              'string' &&
            value.trim().length >
              0
        )
        .join(
          ' '
        )}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-[900] max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-white shadow-xl backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Exploration map
        </p>

        <p className="mt-1 text-sm font-semibold">
          {visibleVenues.length.toLocaleString()}{' '}
          {visibleVenues.length ===
          1
            ? 'place'
            : 'places'}{' '}
          mapped
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
          {exploredCount > 0 ? (
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-cyan-200">
              {exploredCount.toLocaleString()}{' '}
              explored
            </span>
          ) : null}

          {recommendedCount > 0 ? (
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-violet-200">
              {recommendedCount.toLocaleString()}{' '}
              recommended
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          height:
            `${minimumHeight}px`,
        }}
        className="relative w-full overflow-hidden"
      >
        <MapContainer
            center={
                mapCenter
            }
            zoom={
                initialZoom
            }
            maxZoom={
                maximumZoom
            }
            zoomControl={false}
            scrollWheelZoom={
                scrollWheelZoom
            }
            zoomSnap={
                0.25
            }
            zoomDelta={
                0.5
            }
            wheelPxPerZoomLevel={
                90
            }
            preferCanvas
            className="absolute inset-0"
            style={{
                height:
                '100%',
                width:
                '100%',
            }}
            >
            <ZoomControl position="topright" />

            <CreatorMapLifecycleController
                mapRef={
                mapRef
                }
                venues={
                visibleVenues
                }
                selectedVenue={
                selectedVenue
                }
                maximumZoom={
                maximumZoom
                }
                selectedCity={
                selectedCity
                }
                onInitialized={
                handleMapInitialized
                }
            />
          <CreatorMapLifecycleController
            mapRef={
              mapRef
            }
            venues={
              visibleVenues
            }
            selectedVenue={
              selectedVenue
            }
            maximumZoom={
              maximumZoom
            }
            selectedCity={
              selectedCity
            }
            onInitialized={
              handleMapInitialized
            }
          />

          <TileLayer
            url={CARTO_DARK_BASEMAP_URL}
            attribution={CARTO_BASEMAP_ATTRIBUTION}
            maxZoom={
              maximumZoom
            }
          />

          {visibleVenues.map(
            (
              venue,
              index
            ) => {
              const venueCity =
                resolveVenueCity({
                  venue,
                  fallbackCity:
                    primaryCity,
                })

              const nowForCity =
                resolveNowForCity(
                  venueCity
                )

              return (
                <VenueMarker
                  key={
                    venue.id ??
                    venue.slug ??
                    `${venue.name}-${venue.lat}-${venue.lon}-${index}`
                  }
                  venue={
                    venue
                  }
                  index={
                    index
                  }
                  city={
                    venueCity
                  }
                  nowForCity={
                    nowForCity
                  }
                  isRouteMode={
                    false
                  }
                  markerRefs={
                    markerRefs
                  }
                  eventsByVenueId={
                    EMPTY_EVENTS
                  }
                  selected={
                    Boolean(
                      venue.id &&
                      venue.id ===
                        selectedVenueId
                    )
                  }
                  showPopup={
                    false
                  }
                  interactionContext="creator-exploration-map"
                  onSelect={
                    (
                      nextVenue
                    ) => {
                      selectVenue(
                        nextVenue,
                        'marker'
                      )
                    }
                  }
                />
              )
            }
          )}
        </MapContainer>

        {availableCities.length >
        0 ? (
          <CitySelector
            selectedCity={
              selectedCity
            }
            onSelectCity={
              handleSelectCity
            }
            availableCities={
              availableCities
            }
            variant="embedded"
          />
        ) : null}
      </div>

      <VenuePreviewSheet
        venue={
          selectedVenue
        }
        city={
          selectedVenueCity
        }
        nowForCity={
          selectedVenueNow
        }
        events={
          []
        }
        onClose={
          clearSelection
        }
        onGenerateFlow={
          onGenerateFlow
        }
        isGeneratingFlow={
          isGeneratingFlow
        }
        generateFlowError={
          generateFlowError
        }
        onViewVenue={
          onViewVenue
        }
        interactionContext="creator-exploration-map"
      />
    </section>
  )
}

/* =========================================================
 * Leaflet lifecycle and viewport control
 * ======================================================= */

function CreatorMapLifecycleController({
  mapRef,
  venues,
  selectedVenue,
  maximumZoom,
  selectedCity,
  onInitialized,
}: {
  mapRef:
    MutableRefObject<
      LeafletMap | null
    >

  venues: Venue[]
  selectedVenue:
    Venue | null
  maximumZoom: number
  selectedCity:
    CitySlug | null
  onInitialized: () => void
}) {
  const map =
    useMap()

  const hasInitializedRef =
    useRef(
      false
    )

  const selectedVenueIdRef =
    useRef<
      string | null
    >(
      null
    )

  useMapInitialization(
    map
  )

  const coordinateSignature =
    useMemo(
      () =>
        [
          selectedCity ??
            'all',

          ...venues
            .filter(
              hasValidCoordinates
            )
            .map(
              (
                venue
              ) =>
                [
                  venue.id ??
                    venue.slug ??
                    venue.name,
                  venue.lat,
                  venue.lon,
                ].join(
                  ':'
                )
            ),
        ].join(
          '|'
        ),
      [
        selectedCity,
        venues,
      ]
    )

  useEffect(
    () => {
      mapRef.current =
        map

      const invalidateMap =
        () => {
          map.invalidateSize({
            animate:
              false,
            pan:
              false,
          })
        }

      const initialFrame =
        window.requestAnimationFrame(
          invalidateMap
        )

      const initialTimeout =
        window.setTimeout(
          invalidateMap,
          300
        )

      let resizeFrame:
        number | null =
          null

      const handleResize =
        () => {
          if (
            resizeFrame !==
            null
          ) {
            window.cancelAnimationFrame(
              resizeFrame
            )
          }

          resizeFrame =
            window.requestAnimationFrame(
              invalidateMap
            )
        }

      window.addEventListener(
        'resize',
        handleResize
      )

      const mapContainer =
        map.getContainer()

      const resizeObserver =
        typeof ResizeObserver !==
        'undefined'
          ? new ResizeObserver(
              handleResize
            )
          : null

      resizeObserver?.observe(
        mapContainer
      )

      return () => {
        window.cancelAnimationFrame(
          initialFrame
        )

        window.clearTimeout(
          initialTimeout
        )

        if (
          resizeFrame !==
          null
        ) {
          window.cancelAnimationFrame(
            resizeFrame
          )
        }

        window.removeEventListener(
          'resize',
          handleResize
        )

        resizeObserver?.disconnect()

        if (
          mapRef.current ===
          map
        ) {
          mapRef.current =
            null
        }
      }
    },
    [
      map,
      mapRef,
    ]
  )

  useEffect(
    () => {
      const validVenues =
        venues.filter(
          hasValidCoordinates
        )

      const reducedMotion =
        prefersReducedMotion()

      const applyInitialViewport =
        () => {
          map.invalidateSize({
            animate:
              false,
            pan:
              false,
          })

          if (
            validVenues.length ===
              0 &&
            selectedCity
          ) {
            const cityConfig =
              CITY_CONFIGS[
                selectedCity
              ]

            if (cityConfig) {
              map.setView(
                cityConfig.center,
                Math.min(
                  cityConfig.zoom,
                  maximumZoom
                ),
                {
                  animate:
                    false,
                }
              )
            }

            return
          }

          if (
            validVenues.length ===
            0
          ) {
            return
          }

          if (
            validVenues.length ===
            1
          ) {
            const venue =
              validVenues[0]

            map.setView(
              [
                venue.lat,
                venue.lon,
              ],
              Math.min(
                SINGLE_VENUE_ZOOM,
                maximumZoom
              ),
              {
                animate:
                  false,
              }
            )
          } else {
            const coordinates:
              [number, number][] =
                validVenues.map(
                  (
                    venue
                  ) => [
                    venue.lat,
                    venue.lon,
                  ]
                )

            map.fitBounds(
              coordinates,
              {
                paddingTopLeft: [
                  40,
                  104,
                ],

                paddingBottomRight: [
                  40,
                  160,
                ],

                maxZoom:
                  Math.min(
                    MULTI_VENUE_MAX_FIT_ZOOM,
                    maximumZoom
                  ),

                animate:
                  false,
              }
            )
          }

          if (
            !hasInitializedRef.current
          ) {
            hasInitializedRef.current =
              true

            onInitialized()
          }

          if (
            reducedMotion
          ) {
            map.stop()
          }
        }

      let innerFrame:
        number | null =
          null

      const outerFrame =
        window.requestAnimationFrame(
          () => {
            innerFrame =
              window.requestAnimationFrame(
                applyInitialViewport
              )
          }
        )

      const timeout =
        window.setTimeout(
          applyInitialViewport,
          350
        )

      return () => {
        window.cancelAnimationFrame(
          outerFrame
        )

        if (
          innerFrame !==
          null
        ) {
          window.cancelAnimationFrame(
            innerFrame
          )
        }

        window.clearTimeout(
          timeout
        )
      }
    },
    [
      coordinateSignature,
      map,
      maximumZoom,
      onInitialized,
      selectedCity,
      venues,
    ]
  )

  useEffect(
    () => {
      if (
        !selectedVenue ||
        !hasValidCoordinates(
          selectedVenue
        )
      ) {
        selectedVenueIdRef.current =
          null

        return
      }

      const venueId =
        getVenueIdentifier(
          selectedVenue
        )

      if (
        venueId &&
        selectedVenueIdRef.current ===
          venueId
      ) {
        return
      }

      selectedVenueIdRef.current =
        venueId

      const reducedMotion =
        prefersReducedMotion()

      const targetZoom =
        Math.min(
          Math.max(
            map.getZoom(),
            SELECTED_VENUE_ZOOM
          ),
          maximumZoom
        )

      map.flyTo(
        [
          selectedVenue.lat,
          selectedVenue.lon,
        ],
        targetZoom,
        {
          animate:
            !reducedMotion,

          duration:
            reducedMotion
              ? 0
              : 0.45,
        }
      )
    },
    [
      map,
      maximumZoom,
      selectedVenue,
    ]
  )

  return null
}

/* =========================================================
 * Empty state
 * ======================================================= */

function CreatorExplorationMapEmptyState({
  creatorName,
  className,
}: {
  creatorName: string
  className?: string
}) {
  return (
    <section
      aria-label={`${creatorName}'s exploration map`}
      data-roam-map-context="creator-exploration-map"
      className={[
        'rounded-[2rem] border border-dashed border-neutral-800 bg-neutral-950/70 px-5 py-12 text-center text-white',
        className,
      ]
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
              'string' &&
            value.trim().length >
              0
        )
        .join(
          ' '
        )}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-2xl">
        🗺️
      </span>

      <h3 className="mt-4 text-lg font-semibold">
        Exploration map coming together
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        {creatorName} has published
        their exploration map but does
        not yet have any eligible
        verified places to display.
      </p>
    </section>
  )
}

/* =========================================================
 * Public-map adaptation
 * ======================================================= */

/**
 * Adapts the intentionally narrow public-map venue projection
 * to the existing shared map Venue contract.
 *
 * No private visit metadata is introduced here.
 */
function adaptPublicCreatorMapVenue(
  venue:
    PublicCreatorMapVenue
): Venue | null {
  const id =
    normalizeIdentifier(
      venue.id
    )

  const name =
    normalizeText(
      venue.name
    )

  if (
    !id ||
    !name ||
    !isValidLatitude(
      venue.lat
    ) ||
    !isValidLongitude(
      venue.lon
    )
  ) {
    return null
  }

  const slug =
    normalizeText(
      venue.slug
    )

  const city =
    normalizeText(
      venue.city
    )

  const category =
    normalizeText(
      venue.category
    )

  const coverImageUrl =
    normalizeText(
      venue.coverImageUrl
    )

  const adaptedVenue:
    Venue = {
    id,
    name,

    slug:
      slug ??
      undefined,

    city:
      city ??
      undefined,

    lat:
      venue.lat,

    lon:
      venue.lon,

    link:
      `/venue-profile/${encodeURIComponent(
        id
      )}`,

    cover:
      coverImageUrl ??
      undefined,

    tier:
      category ??
      undefined,

    type:
      category ??
      undefined,

    vibe: [],
    hours: [],
    dayParts: {},
  }

  return adaptedVenue
}

/* =========================================================
 * Public-map compatibility
 * ======================================================= */

/**
 * Resolves canonical counts while remaining fail-safe for the
 * legacy explored-only public-map payload.
 *
 * The compatibility branch can be removed after every loader and
 * cached response returns the canonical `counts` object.
 */
function resolvePublicCreatorMapCounts(
  map:
    PublicCreatorMapData
): {
  explored: number
  recommended: number
} {
  const runtimeMap =
    map as unknown as {
      venues?:
        Array<
          Partial<
            PublicCreatorMapVenue
          >
        >

      counts?: {
        explored?: unknown
        recommended?: unknown
      }

      venueCount?: unknown
    }

  const runtimeVenues =
    Array.isArray(
      runtimeMap.venues
    )
      ? runtimeMap.venues
      : []

  const explicitExploredCount =
    normalizeNonNegativeCount(
      runtimeMap.counts
        ?.explored
    )

  const explicitRecommendedCount =
    normalizeNonNegativeCount(
      runtimeMap.counts
        ?.recommended
    )

  const legacyVenueCount =
    normalizeNonNegativeCount(
      runtimeMap.venueCount
    )

  const derivedExploredCount =
    runtimeVenues.reduce(
      (
        total,
        venue
      ) =>
        venue.explored ===
        false
          ? total
          : total + 1,
      0
    )

  const derivedRecommendedCount =
    runtimeVenues.reduce(
      (
        total,
        venue
      ) =>
        venue.recommended ===
        true
          ? total + 1
          : total,
      0
    )

  return {
    explored:
      explicitExploredCount ??
      legacyVenueCount ??
      derivedExploredCount,

    recommended:
      explicitRecommendedCount ??
      derivedRecommendedCount,
  }
}

/* =========================================================
 * General helpers
 * ======================================================= */

function resolveMapCenter(
  venues:
    Venue[]
): [
  number,
  number,
] {
  const firstValidVenue =
    venues.find(
      hasValidCoordinates
    )

  if (
    !firstValidVenue
  ) {
    return DEFAULT_CENTER
  }

  return [
    firstValidVenue.lat,
    firstValidVenue.lon,
  ]
}

function resolveVenueCity({
  venue,
  fallbackCity,
}: {
  venue: Venue
  fallbackCity:
    string | null
}): string {
  return (
    normalizeText(
      venue.city
    ) ??
    normalizeText(
      fallbackCity
    ) ??
    'unknown'
  )
}

/**
 * Resolves either a canonical city slug or a configured display
 * name such as "Atlanta" to the matching CitySlug.
 */
function resolveVenueCitySlug(
  value:
    unknown
): CitySlug | null {
  const normalizedCity =
    normalizeCityComparisonValue(
      value
    )

  if (!normalizedCity) {
    return null
  }

  const cityEntries =
    Object.entries(
      CITY_CONFIGS
    ) as Array<
      [
        CitySlug,
        (typeof CITY_CONFIGS)[CitySlug],
      ]
    >

  for (
    const [
      citySlug,
      cityConfig,
    ] of cityEntries
  ) {
    if (
      normalizeCityComparisonValue(
        citySlug
      ) ===
        normalizedCity ||
      normalizeCityComparisonValue(
        cityConfig.name
      ) ===
        normalizedCity
    ) {
      return citySlug
    }
  }

  return null
}

function normalizeCityComparisonValue(
  value:
    unknown
): string | null {
  const normalized =
    normalizeText(
      value
    )

  if (!normalized) {
    return null
  }

  return normalized
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .trim()
}

function resolveNowForCity(
  city:
    string
): DateTime {
  const timezone =
    getCityTimezone(
      city
    )

  return DateTime
    .now()
    .setZone(
      timezone
    )
}

function getCityTimezone(
  city:
    string
): string {
  const citySlug =
    resolveVenueCitySlug(
      city
    )

  if (citySlug) {
    return (
      CITY_CONFIGS[
        citySlug
      ]?.timezone ??
      'UTC'
    )
  }

  return 'UTC'
}

function getVenueIdentifier(
  venue:
    Venue
): string | null {
  return (
    normalizeIdentifier(
      venue.id
    ) ??
    normalizeIdentifier(
      venue.slug
    ) ??
    normalizeText(
      venue.name
    )
  )
}

function hasValidCoordinates(
  venue:
    Venue
): boolean {
  return (
    isValidLatitude(
      venue.lat
    ) &&
    isValidLongitude(
      venue.lon
    )
  )
}

function isValidLatitude(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -90 &&
    value <= 90
  )
}

function isValidLongitude(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -180 &&
    value <= 180
  )
}

function normalizeIdentifier(
  value:
    unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.length >
      200 ||
    /[\r\n]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeText(
  value:
    unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized ||
    null
}

function normalizeInteger({
  value,
  minimum,
  maximum,
  fallback,
}: {
  value: number
  minimum: number
  maximum: number
  fallback: number
}): number {
  if (
    !Number.isFinite(
      value
    ) ||
    !Number.isInteger(
      value
    )
  ) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  )
}

function normalizeNonNegativeCount(
  value:
    unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < 0
  ) {
    return null
  }

  return Math.floor(
    value
  )
}

function prefersReducedMotion():
  boolean {
  if (
    typeof window ===
      'undefined' ||
    typeof window.matchMedia !==
      'function'
  ) {
    return false
  }

  return window
    .matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    .matches
}