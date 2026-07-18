// app/map-wrapper.tsx

'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useCityData } from '@/hooks/useCityData'
import { ControlPanel } from '@/components/ControlPanel'
import { useUser } from '@/hooks/useUser'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Venue } from '@/types/venue'
import {
  getHref,
  inBrowser,
} from '@/lib/browser'

import {
  CrawlControl,
  LeafletSetup,
  MapCanvas,
} from '@/components/maps/map-dynamic-wrapper'

type Tier =
  | 'commit'
  | 'constrain'
  | 'clarify'

type RouteIngestionOptions = {
  city?: string | null
  syncUrl?: boolean
}

const MIN_QUALITY_STOPS = 3

function normalizeSearchableList(
  value:
    | string
    | string[]
    | undefined
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item.trim()
      )
      .filter(Boolean)
  }

  if (
    typeof value === 'string'
  ) {
    return value
      .split(',')
      .map((item) =>
        item.trim()
      )
      .filter(Boolean)
  }

  return []
}

function extractRouteVenueIds(
  input: unknown
): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  const ids =
    input
      .map((item) => {
        if (
          typeof item ===
          'string'
        ) {
          return item.trim()
        }

        if (
          !item ||
          typeof item !==
            'object'
        ) {
          return ''
        }

        const record =
          item as Record<
            string,
            unknown
          >

        if (
          typeof record.id ===
            'string'
        ) {
          return record.id.trim()
        }

        const nestedVenue =
          record.venue

        if (
          nestedVenue &&
          typeof nestedVenue ===
            'object'
        ) {
          const venueRecord =
            nestedVenue as Record<
              string,
              unknown
            >

          if (
            typeof venueRecord.id ===
              'string'
          ) {
            return venueRecord.id.trim()
          }
        }

        return ''
      })
      .filter(Boolean)

  return Array.from(
    new Set(ids)
  )
}

export default function MapWrapper() {
  const [
    selectedCity,
    setSelectedCity,
  ] = useState<string | null>(
    null
  )

  const [
    routeVenueIds,
    setRouteVenueIds,
  ] = useState<string[]>([])

  const [
    pendingRouteVenueIds,
    setPendingRouteVenueIds,
  ] = useState<
    string[] | null
  >(null)

  const [
    hasHydratedRouteFromUrl,
    setHasHydratedRouteFromUrl,
  ] = useState(false)

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    selectedThemeId,
    setSelectedThemeId,
  ] = useState('')

  const [
    selectedPrice,
    setSelectedPrice,
  ] = useState('')

  const [
    travelMode,
    setTravelMode,
  ] = useState<
    | 'walking'
    | 'cycling'
    | 'driving'
  >('walking')

  const [
    customStart,
    setCustomStart,
  ] = useState<{
    lat: number
    lon: number
  } | null>(null)

  const [
    tightness,
    setTightness,
  ] = useState<
    | 'tight'
    | 'medium'
    | 'loose'
  >('medium')

  const [
    showLiveEventsOnly,
    setShowLiveEventsOnly,
  ] = useState(false)

  const [
    routeErrorMessage,
    setRouteErrorMessage,
  ] = useState<string | null>(
    null
  )

  const [
    crawlDate,
    setCrawlDate,
  ] = useState('')

  const [
    crawlTime,
    setCrawlTime,
  ] = useState('')

  const [
    searchPrompt,
    setSearchPrompt,
  ] = useState('')

  const [
    isPanelOpen,
    setIsPanelOpen,
  ] = useState(false)

  const [
    hasMounted,
    setHasMounted,
  ] = useState(false)

  const [
    confidenceTier,
    setConfidenceTier,
  ] = useState<Tier | null>(
    null
  )

  const [
    generatedRouteContext,
    setGeneratedRouteContext,
  ] = useState<any>(null)

  const [
    generatedRouteRetryAttempt,
    setGeneratedRouteRetryAttempt,
  ] = useState(0)

  const { user } = useUser()

  const userId = user?.id

  const supabase =
    supabaseBrowser()

  const {
    venues = [],
    eventsByVenueId = {},
  } = useCityData(
    selectedCity ?? '',
    {
      showLiveEventsOnly,
    }
  )

  const venueById =
    useMemo(() => {
      return new Map<
        string,
        Venue
      >(
        venues.map(
          (venue) => [
            venue.id,
            venue,
          ]
        )
      )
    }, [venues])

  const route =
    useMemo(() => {
      return routeVenueIds
        .map((id) =>
          venueById.get(id)
        )
        .filter(
          (
            venue
          ): venue is Venue =>
            Boolean(venue)
        )
    }, [
      routeVenueIds,
      venueById,
    ])

  const routeForProps =
    route.length > 0
      ? route
      : undefined

  const ingestRoute =
    useCallback(
      (
        input: unknown,
        options:
          RouteIngestionOptions = {}
      ): string[] => {
        const ids =
          extractRouteVenueIds(
            input
          )

        if (ids.length === 0) {
          setPendingRouteVenueIds(
            null
          )
          setRouteVenueIds([])

          if (
            options.syncUrl &&
            inBrowser()
          ) {
            const url =
              new URL(
                window.location.href
              )

            url.searchParams.delete(
              'route'
            )

            window.history.replaceState(
              null,
              '',
              url.toString()
            )
          }

          return []
        }

        setPendingRouteVenueIds(
          ids
        )

        const nextCity =
          typeof options.city ===
            'string' &&
          options.city.trim()
            ? options.city.trim()
            : null

        if (
          nextCity &&
          nextCity !== selectedCity
        ) {
          setSelectedCity(
            nextCity
          )
        }

        if (
          options.syncUrl &&
          inBrowser()
        ) {
          const url =
            new URL(
              window.location.href
            )

          url.searchParams.set(
            'route',
            ids.join(',')
          )

          if (nextCity) {
            url.searchParams.set(
              'city',
              nextCity
            )
          }

          window.history.replaceState(
            null,
            '',
            url.toString()
          )
        }

        return ids
      },
      [selectedCity]
    )

  const handleRouteFromControl =
    useCallback(
      (
        nextRoute:
          | Venue[]
          | undefined
      ) => {
        ingestRoute(
          nextRoute ?? [],
          {
            syncUrl: true,
          }
        )
      },
      [ingestRoute]
    )

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (
      route.length > 1
    ) {
      setIsPanelOpen(false)
    }
  }, [route])

  useEffect(() => {
    if (!inBrowser()) {
      return
    }

    const params =
      new URLSearchParams(
        window.location.search
      )

    const cityParam =
      params.get('city')

    const latParam =
      params.get('lat')

    const lonParam =
      params.get('lon')

    if (cityParam) {
      setSelectedCity(
        cityParam
      )

      setIsPanelOpen(true)
    }

    if (
      latParam &&
      lonParam
    ) {
      const lat =
        parseFloat(latParam)

      const lon =
        parseFloat(lonParam)

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon)
      ) {
        setCustomStart({
          lat,
          lon,
        })
      }
    }
  }, [])

  useEffect(() => {
    if (
      hasHydratedRouteFromUrl ||
      !inBrowser()
    ) {
      return
    }

    const params =
      new URLSearchParams(
        window.location.search
      )

    const routeParam =
      params.get('route')

    const cityParam =
      params.get('city')

    setHasHydratedRouteFromUrl(
      true
    )

    if (
      typeof routeParam !==
        'string' ||
      routeParam.trim().length ===
        0
    ) {
      return
    }

    ingestRoute(
      routeParam.split(','),
      {
        city: cityParam,
      }
    )
  }, [
    hasHydratedRouteFromUrl,
    ingestRoute,
  ])

  useEffect(() => {
    if (
      !pendingRouteVenueIds ||
      pendingRouteVenueIds.length ===
        0 ||
      venues.length === 0
    ) {
      return
    }

    const canonicalIds =
      pendingRouteVenueIds.filter(
        (id) =>
          venueById.has(id)
      )

    if (
      canonicalIds.length === 0
    ) {
      return
    }

    setRouteVenueIds(
      canonicalIds
    )

    setPendingRouteVenueIds(
      null
    )
  }, [
    pendingRouteVenueIds,
    venueById,
    venues.length,
  ])

  const filteredVenues =
    useMemo(() => {
      return venues.filter(
        (venue) => {
          const search =
            searchTerm.toLowerCase()

          const vibeArray =
            normalizeSearchableList(
              venue.vibe
            )

          const tagsArray =
            normalizeSearchableList(
              venue.tags
            )

          const typeArray =
            normalizeSearchableList(
              venue.type
            )

          const matchesSearch =
            !searchTerm ||
            venue.name
              ?.toLowerCase()
              .includes(search) ||
            vibeArray.some(
              (item) =>
                item
                  .toLowerCase()
                  .includes(search)
            ) ||
            tagsArray.some(
              (item) =>
                item
                  .toLowerCase()
                  .includes(search)
            ) ||
            typeArray.some(
              (item) =>
                item
                  .toLowerCase()
                  .includes(search)
            )

          const priceRank: Record<
            string,
            number
          > = {
            $: 1,
            $$: 2,
            $$$: 3,
            $$$$: 4,
          }

          const venuePriceRank =
            venue.price &&
            priceRank[venue.price]
              ? priceRank[
                  venue.price
                ]
              : Infinity

          const selectedPriceRank =
            selectedPrice &&
            priceRank[
              selectedPrice
            ]
              ? priceRank[
                  selectedPrice
                ]
              : Infinity

          const matchesPrice =
            !selectedPrice ||
            venuePriceRank <=
              selectedPriceRank

          return (
            matchesSearch &&
            matchesPrice
          )
        }
      )
    }, [
      venues,
      searchTerm,
      selectedPrice,
    ])

  const visibleVenues =
    useMemo(() => {
      if (
        !showLiveEventsOnly
      ) {
        return filteredVenues
      }

      return filteredVenues.filter(
        (venue) =>
          eventsByVenueId[
            venue.id
          ]?.length > 0
      )
    }, [
      filteredVenues,
      showLiveEventsOnly,
      eventsByVenueId,
    ])

  const handleMapClick =
    useCallback(
      (
        lat: number,
        lon: number
      ) => {
        setCustomStart({
          lat,
          lon,
        })
      },
      []
    )

  const handleRequestClosePanel =
    useCallback(() => {
      setIsPanelOpen(false)
    }, [])

  const computePlannedStartAt =
    () => {
      if (
        crawlDate &&
        crawlTime
      ) {
        const timestamp =
          new Date(
            `${crawlDate}T${crawlTime}`
          )

        return isNaN(
          timestamp.getTime()
        )
          ? new Date().toISOString()
          : timestamp.toISOString()
      }

      return new Date().toISOString()
    }

  const handleClearRoute =
    useCallback(() => {
      setRouteVenueIds([])
      setPendingRouteVenueIds(
        null
      )
      setCustomStart(null)
      setRouteErrorMessage(null)
      setConfidenceTier(null)
      setGeneratedRouteContext(
        null
      )
      setGeneratedRouteRetryAttempt(
        0
      )

      if (inBrowser()) {
        const href =
          getHref()

        const url =
          new URL(href)

        url.searchParams.delete(
          'route'
        )

        window.history.replaceState(
          null,
          '',
          url.toString()
        )
      }
    }, [])

  const handleCityChange =
    useCallback(
      (
        slug: string | null
      ) => {
        setSelectedCity(slug)
        setRouteVenueIds([])
        setPendingRouteVenueIds(
          null
        )
        setCustomStart(null)
        setRouteErrorMessage(null)
        setConfidenceTier(null)
        setGeneratedRouteContext(
          null
        )
        setGeneratedRouteRetryAttempt(
          0
        )

        if (slug) {
          setIsPanelOpen(true)
        }
      },
      []
    )

  const handleGeneratedRouteFromVenue =
    useCallback(
      (
        nextRoute: Venue[],
        generatedRoute?: any,
        options: {
          preserveRetryAttempt?: boolean
        } = {}
      ) => {
        const fallbackRoute =
          generatedRoute?.stops
            ?.map(
              (stop: any) =>
                stop?.venue
            )
            .filter(Boolean)

        const sourceRoute =
          Array.isArray(
            nextRoute
          ) &&
          nextRoute.length > 0
            ? nextRoute
            : fallbackRoute

        console.log(
          '[MapWrapper received generated route]',
          {
            nextRouteLength:
              Array.isArray(
                nextRoute
              )
                ? nextRoute.length
                : 0,
            fallbackRouteLength:
              Array.isArray(
                fallbackRoute
              )
                ? fallbackRoute.length
                : 0,
            generatedRoute,
          }
        )

        const ids =
          extractRouteVenueIds(
            sourceRoute
          )

        if (ids.length < 2) {
          setRouteErrorMessage(
            'Generated route was missing canonical venue IDs.'
          )

          return
        }

        const generatedCity =
          generatedRoute
            ?.context?.city

        ingestRoute(ids, {
          city:
            typeof generatedCity ===
              'string'
              ? generatedCity
              : null,
          syncUrl: true,
        })

        setGeneratedRouteContext(
          generatedRoute ?? null
        )

        setRouteErrorMessage(
          null
        )

        setConfidenceTier(null)
        setCustomStart(null)
        setIsPanelOpen(false)

        if (
          !options.preserveRetryAttempt
        ) {
          setGeneratedRouteRetryAttempt(
            0
          )
        }
      },
      [ingestRoute]
    )

  const retryGeneratedRouteFromVenue =
    useCallback(
      async () => {
        const anchorVenue =
          generatedRouteContext
            ?.anchorVenue ??
          route[0]

        if (!anchorVenue) {
          return false
        }

        const source =
          generatedRouteContext
            ?.source

        const hasVenueAnchor =
          source ===
            'map_marker' ||
          generatedRouteContext
            ?.context
            ?.anchorVenueId ||
          generatedRouteContext
            ?.anchorVenue?.id

        if (!hasVenueAnchor) {
          return false
        }

        const nextAttempt =
          generatedRouteRetryAttempt +
          1

        const generatedCity =
          generatedRouteContext
            ?.context?.city ??
          anchorVenue.city ??
          selectedCity

        try {
          setRouteErrorMessage(
            null
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
                  JSON.stringify(
                    {
                      venueId:
                        anchorVenue.id ??
                        generatedRouteContext
                          ?.context
                          ?.anchorVenueId ??
                        null,
                      venueSlug:
                        anchorVenue.slug ??
                        null,
                      venueName:
                        anchorVenue.name ??
                        generatedRouteContext
                          ?.context
                          ?.anchorVenueName ??
                        null,
                      city:
                        generatedCity,
                      plannedStartAt:
                        generatedRouteContext
                          ?.context
                          ?.plannedStartAt ??
                        computePlannedStartAt(),
                      travelMode:
                        generatedRouteContext
                          ?.context
                          ?.travelMode ??
                        travelMode,
                      tightness:
                        generatedRouteContext
                          ?.context
                          ?.tightness ??
                        tightness,
                      maxStops:
                        generatedRouteContext
                          ?.context
                          ?.maxStops ??
                        route.length ??
                        5,
                      source:
                        generatedRouteContext
                          ?.source ??
                        'map_marker',
                      retrySeed:
                        generatedRouteContext
                          ?.context
                          ?.anchorVenueId ??
                        anchorVenue.id,
                      retryAttempt:
                        nextAttempt,
                      debug: true,
                    }
                  ),
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
            !payload?.route
              ?.stops?.length
          ) {
            throw new Error(
              payload?.error ||
                'Could not retry this route.'
            )
          }

          handleGeneratedRouteFromVenue(
            [],
            payload.route,
            {
              preserveRetryAttempt:
                true,
            }
          )

          setGeneratedRouteRetryAttempt(
            nextAttempt
          )

          return true
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Could not retry this route.'

          console.error(
            'Retry Generated Route From Venue Error:',
            error
          )

          setRouteErrorMessage(
            message
          )

          return true
        }
      },
      [
        generatedRouteContext,
        generatedRouteRetryAttempt,
        route,
        selectedCity,
        travelMode,
        tightness,
        handleGeneratedRouteFromVenue,
      ]
    )

  const handleStartGeneratedFlow =
    async () => {
      if (
        route.length < 2
      ) {
        return
      }

      try {
        const response =
          await fetch(
            '/api/active-flow/start',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  city:
                    selectedCity,
                  title:
                    selectedThemeId
                      ? `${selectedThemeId} Flow`
                      : 'Roam Flow',
                  source: 'map',
                  venue_ids:
                    routeVenueIds,
                  theme_id:
                    selectedThemeId ||
                    null,
                  travel_mode:
                    travelMode,
                }),
            }
          )

        const json =
          await response.json()

        if (!response.ok) {
          if (
            response.status ===
              409 &&
            json.activeSession
              ?.id &&
            inBrowser()
          ) {
            window.location.href =
              `/flow/${json.activeSession.id}`

            return
          }

          alert(
            json.error ??
              'Could not start flow.'
          )

          return
        }

        if (
          json.session?.id &&
          inBrowser()
        ) {
          window.location.href =
            `/flow/${json.session.id}`
        }
      } catch (error) {
        console.error(
          'Start Flow Error:',
          error
        )

        alert(
          'Something went wrong starting this flow.'
        )
      }
    }

  const handleHostGeneratedFlow =
    () => {
      if (
        route.length < 2
      ) {
        return
      }

      const slugs =
        route
          .map(
            (venue) =>
              venue.slug ??
              venue.id
          )
          .filter(Boolean)
          .join(',')

      if (inBrowser()) {
        window.location.href =
          `/sponsor-crawl?slugs=${slugs}`
      }
    }

  const handleGenerateRoute =
    async () => {
      if (!selectedCity) {
        return
      }

      setRouteErrorMessage(
        null
      )

      setGeneratedRouteContext(
        null
      )

      setGeneratedRouteRetryAttempt(
        0
      )

      const fallbackCoords: Record<
        string,
        {
          lat: number
          lon: number
        }
      > = {
        atl: {
          lat: 33.749,
          lon: -84.388,
        },
        nyc: {
          lat: 40.73061,
          lon: -73.935242,
        },
        lisbon: {
          lat: 38.7223,
          lon: -9.1393,
        },
        porto: {
          lat: 41.1579,
          lon: -8.6291,
        },
        london: {
          lat: 51.5072,
          lon: -0.1276,
        },
        la: {
          lat: 34.0522,
          lon: -118.2437,
        },
      }

      const startLat =
        customStart?.lat ??
        fallbackCoords[
          selectedCity
        ]?.lat ??
        37.8

      const startLon =
        customStart?.lon ??
        fallbackCoords[
          selectedCity
        ]?.lon ??
        -96.9

      const plannedStartAt =
        computePlannedStartAt()

      try {
        let finalRoute:
          | Venue[]
          | null = null

        let tierUsed:
          | Tier
          | null = null

        const options: any = {
          maxStops: 6,
          filterOpen: true,
          customStart:
            customStart ??
            undefined,
          startTime:
            plannedStartAt,
          tightness,
          city:
            selectedCity,
        }

        let stages:
          | any[]
          | undefined

        let tier: Tier =
          'commit'

        if (
          searchPrompt?.trim()
        ) {
          const parseResponse =
            await fetch(
              '/api/parseprompt',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body:
                  JSON.stringify({
                    prompt:
                      searchPrompt,
                  }),
              }
            )

          const parsed =
            await parseResponse.json()

          tier =
            parsed?.data?.tier ??
            'constrain'

          stages =
            parsed?.data?.stages

          tierUsed = tier

          setConfidenceTier(
            tier
          )

          const crawlResponse =
            await fetch(
              '/api/generate-crawl',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body:
                  JSON.stringify({
                    venues:
                      visibleVenues,
                    userLat:
                      startLat,
                    userLon:
                      startLon,
                    city:
                      selectedCity,
                    plannedStartAt,
                    options,
                    stages,
                    tier,
                  }),
              }
            )

          const data =
            await crawlResponse.json()

          if (
            crawlResponse.ok &&
            Array.isArray(
              data.route
            ) &&
            data.route.length >=
              MIN_QUALITY_STOPS
          ) {
            finalRoute =
              data.route

            tierUsed =
              data.tier ??
              tier
          }
        }

        if (
          !finalRoute &&
          selectedThemeId
        ) {
          const themeResponse =
            await fetch(
              '/api/generate-theme',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body:
                  JSON.stringify({
                    themeId:
                      selectedThemeId,
                    userLat:
                      startLat,
                    userLon:
                      startLon,
                    venues:
                      visibleVenues,
                    city:
                      selectedCity,
                    plannedStartAt,
                    options,
                  }),
              }
            )

          const data =
            await themeResponse.json()

          if (
            themeResponse.ok &&
            Array.isArray(
              data.route
            ) &&
            data.route.length >=
              MIN_QUALITY_STOPS
          ) {
            finalRoute =
              data.route

            tierUsed = null

            setConfidenceTier(
              null
            )
          }
        }

        if (!finalRoute) {
          const crawlResponse =
            await fetch(
              '/api/generate-crawl',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body:
                  JSON.stringify({
                    venues:
                      visibleVenues,
                    userLat:
                      startLat,
                    userLon:
                      startLon,
                    city:
                      selectedCity,
                    plannedStartAt,
                    options,
                    tier:
                      'commit',
                  }),
              }
            )

          const data =
            await crawlResponse.json()

          if (
            crawlResponse.ok &&
            Array.isArray(
              data.route
            ) &&
            data.route.length >=
              MIN_QUALITY_STOPS
          ) {
            finalRoute =
              data.route

            tierUsed =
              data.tier ??
              'commit'

            setConfidenceTier(
              tierUsed
            )
          }
        }

        if (
          !finalRoute ||
          finalRoute.length <
            MIN_QUALITY_STOPS
        ) {
          setRouteVenueIds([])
          setPendingRouteVenueIds(
            null
          )

          setRouteErrorMessage(
            'We couldn’t build a strong enough crawl nearby. Try a looser distance setting, a different start point, or another theme.'
          )

          return
        }

        const finalRouteIds =
          extractRouteVenueIds(
            finalRoute
          )

        const canonicalFinalRoute =
          finalRouteIds
            .map((id) =>
              venueById.get(id)
            )
            .filter(
              (
                venue
              ): venue is Venue =>
                Boolean(venue)
            )

        if (
          canonicalFinalRoute.length <
          MIN_QUALITY_STOPS
        ) {
          setRouteVenueIds([])
          setPendingRouteVenueIds(
            null
          )

          setRouteErrorMessage(
            'Generated route did not resolve to enough canonical venues.'
          )

          return
        }

        ingestRoute(
          finalRouteIds,
          {
            syncUrl:
              hasMounted,
          }
        )

        setRouteErrorMessage(
          null
        )

        setConfidenceTier(
          tierUsed
        )

        const origin = {
          lat:
            canonicalFinalRoute[0]
              .lat,
          lng:
            canonicalFinalRoute[0]
              .lon,
        }

        const destination = {
          lat:
            canonicalFinalRoute.at(
              -1
            )!.lat,
          lng:
            canonicalFinalRoute.at(
              -1
            )!.lon,
        }

        const waypoints =
          canonicalFinalRoute
            .slice(1, -1)
            .map((venue) => ({
              lat: venue.lat,
              lng: venue.lon,
            }))

        if (userId) {
          const proxyResponse =
            await fetch(
              '/api/mapbox',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body:
                  JSON.stringify({
                    origin,
                    destination,
                    waypoints,
                    travelMode,
                  }),
              }
            )

          const routeData =
            await proxyResponse.json()

          await fetch(
            '/api/logRoute',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  userId,
                  crawlTheme:
                    selectedThemeId ||
                    'manual',
                  origin,
                  destination,
                  waypoints,
                  routeDuration:
                    routeData.duration,
                  routeDistance:
                    routeData.distance,
                  routeGeometry:
                    routeData.geometry,
                  routeMetadata: {
                    travelMode,
                    city:
                      selectedCity,
                    stops:
                      canonicalFinalRoute.length,
                    confidenceTier:
                      tierUsed ??
                      undefined,
                    usedPrompt:
                      Boolean(
                        searchPrompt?.trim()
                      ),
                  },
                }),
            }
          )
        }
      } catch (error) {
        console.error(
          'Generate Crawl Error:',
          error
        )

        setRouteErrorMessage(
          'Something went wrong. Try again.'
        )
      }
    }

  const handleRetryAwareGenerateRoute =
    useCallback(
      async () => {
        const handledVenueRetry =
          await retryGeneratedRouteFromVenue()

        if (
          handledVenueRetry
        ) {
          return
        }

        await handleGenerateRoute()
      },
      [
        retryGeneratedRouteFromVenue,
        handleGenerateRoute,
      ]
    )

  const hasGeneratedRoute =
    route.length > 1

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <LeafletSetup />

      <button
        type="button"
        onClick={() => {
          setIsPanelOpen(
            (previous) =>
              !previous
          )
        }}
        aria-expanded={
          isPanelOpen
        }
        aria-controls="roam-map-control-panel"
        className="
          fixed
          left-3
          top-20
          z-[4600]
          rounded-lg
          bg-black/80
          px-3
          py-2
          text-xs
          font-medium
          text-white
          shadow-lg
          backdrop-blur-sm
          transition
          hover:bg-black/90
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-cyan-300
        "
      >
        {isPanelOpen
          ? 'Hide Panel'
          : 'Show Panel'}
      </button>

      {isPanelOpen && (
        <div id="roam-map-control-panel">
          <ControlPanel
            city={
              selectedCity as
                | 'atl'
                | 'nyc'
                | 'lisbon'
                | 'porto'
                | 'london'
                | 'la'
                | null
            }
            onCityChange={
              handleCityChange
            }
            searchTerm={
              searchTerm
            }
            setSearchTerm={
              setSearchTerm
            }
            searchPrompt={
              searchPrompt
            }
            setSearchPrompt={
              setSearchPrompt
            }
            selectedThemeId={
              selectedThemeId
            }
            setSelectedThemeId={
              setSelectedThemeId
            }
            selectedPrice={
              selectedPrice
            }
            setSelectedPrice={
              setSelectedPrice
            }
            travelMode={
              travelMode
            }
            setTravelMode={
              setTravelMode
            }
            onGenerateRoute={
              handleGenerateRoute
            }
            onClearRoute={
              handleClearRoute
            }
            tightness={
              tightness
            }
            setTightness={
              setTightness
            }
            crawlDate={
              crawlDate
            }
            setCrawlDate={
              setCrawlDate
            }
            crawlTime={
              crawlTime
            }
            setCrawlTime={
              setCrawlTime
            }
            hasCustomStart={
              Boolean(customStart)
            }
            hasGeneratedRoute={
              hasGeneratedRoute
            }
            generatedRouteStopCount={
              route.length
            }
            onStartGeneratedFlow={
              handleStartGeneratedFlow
            }
            onHostGeneratedFlow={
              handleHostGeneratedFlow
            }
          />
        </div>
      )}

      {routeErrorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="
            absolute
            left-1/2
            top-20
            z-[4700]
            max-w-md
            -translate-x-1/2
            rounded
            bg-red-100
            px-4
            py-2
            text-center
            text-sm
            text-red-800
            shadow
          "
        >
          {routeErrorMessage}
        </div>
      )}

      <CrawlControl
        venues={
          visibleVenues
        }
        route={
          routeForProps
        }
        onRoute={
          handleRouteFromControl
        }
        selectedThemeId={
          selectedThemeId
        }
        customStart={
          customStart
        }
        city={
          selectedCity as
            | 'atl'
            | 'nyc'
            | 'lisbon'
            | 'porto'
            | 'london'
            | 'la'
            | null
        }
        onGenerateRoute={
          handleRetryAwareGenerateRoute
        }
        hasGeneratedRoute={
          hasGeneratedRoute
        }
        generatedRouteStopCount={
          route.length
        }
        generatedRouteContext={
          generatedRouteContext
        }
        onStartGeneratedFlow={
          handleStartGeneratedFlow
        }
        onHostGeneratedFlow={
          handleHostGeneratedFlow
        }
        onClearRoute={
          handleClearRoute
        }
      />

      {hasMounted && (
        <Suspense
          fallback={
            <div
              role="status"
              aria-live="polite"
              className="
                absolute
                inset-0
                z-[900]
                grid
                place-items-center
                bg-zinc-950
                text-sm
                font-semibold
                text-zinc-300
              "
            >
              Loading map…
            </div>
          }
        >
          <MapCanvas
            route={
              routeForProps
            }
            onMapClick={
              handleMapClick
            }
            customStart={
              customStart
            }
            themeId={
              selectedThemeId
            }
            travelMode={
              travelMode
            }
            showLiveEventsOnly={
              showLiveEventsOnly
            }
            onCityChange={
              handleCityChange
            }
            onGeneratedRouteCityChange={
              setSelectedCity
            }
            onGeneratedRouteFromVenue={
              handleGeneratedRouteFromVenue
            }
            searchTerm={
              searchTerm
            }
            isPanelOpen={
              isPanelOpen
            }
            onRequestClosePanel={
              handleRequestClosePanel
            }
          />
        </Suspense>
      )}
    </main>
  )
}