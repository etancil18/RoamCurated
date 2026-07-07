// app/map-wrapper.tsx

'use client'

import dynamic from 'next/dynamic'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useCityData } from '@/hooks/useCityData'
import { ControlPanel } from '@/components/ControlPanel'
import { useUser } from '@/hooks/useUser'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Venue } from '@/types/venue'
import { inBrowser, getHref } from '@/lib/browser'

import {
  CrawlControl,
  LeafletSetup,
  MapCanvas,
} from '@/components/maps/map-dynamic-wrapper'

type Tier = 'commit' | 'constrain' | 'clarify'

const MIN_QUALITY_STOPS = 3

function normalizeSearchableList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function coerceGeneratedVenue(venue: any): Venue | null {
  if (!venue) return null

  const lat = typeof venue.lat === 'string' ? parseFloat(venue.lat) : venue.lat
  const lon = typeof venue.lon === 'string' ? parseFloat(venue.lon) : venue.lon

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return {
    ...venue,
    id: venue.id ?? venue.slug ?? venue.name,
    lat,
    lon,
  } as Venue
}

function getVenueLookupKeys(venue: Venue): string[] {
  return [venue.id, venue.slug, venue.name].filter(Boolean) as string[]
}

export default function MapWrapper() {
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [route, setRoute] = useState<Venue[] | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [selectedPrice, setSelectedPrice] = useState('')
  const [travelMode, setTravelMode] = useState<'walking' | 'cycling' | 'driving'>('walking')
  const [markerDisplayMode, setMarkerDisplayMode] = useState<'color' | 'emoji'>('emoji')
  const [customStart, setCustomStart] = useState<{ lat: number; lon: number } | null>(null)
  const [tightness, setTightness] = useState<'tight' | 'medium' | 'loose'>('medium')
  const [showLiveEventsOnly, setShowLiveEventsOnly] = useState(false)
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null)
  const [crawlDate, setCrawlDate] = useState('')
  const [crawlTime, setCrawlTime] = useState('')
  const [searchPrompt, setSearchPrompt] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [confidenceTier, setConfidenceTier] = useState<Tier | null>(null)
  const [generatedRouteContext, setGeneratedRouteContext] = useState<any>(null)
  const [generatedRouteRetryAttempt, setGeneratedRouteRetryAttempt] = useState(0)

  const { user } = useUser()
  const userId = user?.id
  const supabase = supabaseBrowser()

  const { venues = [], eventsByVenueId = {} } = useCityData(selectedCity ?? '', {
    showLiveEventsOnly,
  })

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (route && route.length > 1) {
      setIsPanelOpen(false)
    }
  }, [route])

  useEffect(() => {
    if (!inBrowser()) return

    const params = new URLSearchParams(window.location.search)
    const cityParam = params.get('city')
    const latParam = params.get('lat')
    const lonParam = params.get('lon')

    if (cityParam) {
      setSelectedCity(cityParam)
      setIsPanelOpen(true)
    }

    if (latParam && lonParam) {
      const lat = parseFloat(latParam)
      const lon = parseFloat(lonParam)

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setCustomStart({ lat, lon })
      }
    }
  }, [])

  useEffect(() => {
    if (!venues.length || !inBrowser()) return

    const params = new URLSearchParams(window.location.search)
    const routeParam = params.get('route')

    if (typeof routeParam !== 'string' || routeParam.trim().length === 0) return

    const ids = routeParam.split(',').map((id) => id.trim()).filter(Boolean)
    if (ids.length === 0) return

    const matched = ids
      .map((id) => venues.find((v) => v.id === id || v.slug === id || v.name === id))
      .filter((v): v is Venue => !!v)

    if (matched.length > 0) setRoute(matched)
  }, [venues])

  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const search = searchTerm.toLowerCase()

      const vibeArray = normalizeSearchableList(v.vibe)
      const tagsArray = normalizeSearchableList(v.tags)
      const typeArray = normalizeSearchableList(v.type)

      const matchesSearch =
        !searchTerm ||
        v.name?.toLowerCase().includes(search) ||
        vibeArray.some((item) => item.toLowerCase().includes(search)) ||
        tagsArray.some((item) => item.toLowerCase().includes(search)) ||
        typeArray.some((item) => item.toLowerCase().includes(search))

      const priceRank: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 }
      const venuePriceRank = v.price && priceRank[v.price] ? priceRank[v.price] : Infinity
      const selectedPriceRank = selectedPrice && priceRank[selectedPrice] ? priceRank[selectedPrice] : Infinity
      const matchesPrice = !selectedPrice || venuePriceRank <= selectedPriceRank

      return matchesSearch && matchesPrice
    })
  }, [venues, searchTerm, selectedPrice])

  const visibleVenues = useMemo(() => {
    if (!showLiveEventsOnly) return filteredVenues
    return filteredVenues.filter((v) => eventsByVenueId[v.id]?.length > 0)
  }, [filteredVenues, showLiveEventsOnly, eventsByVenueId])

  const handleMapClick = (lat: number, lon: number) => {
    setCustomStart({ lat, lon })
  }

  const computePlannedStartAt = () => {
    if (crawlDate && crawlTime) {
      const timestamp = new Date(`${crawlDate}T${crawlTime}`)
      return isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString()
    }

    return new Date().toISOString()
  }

  const handleClearRoute = () => {
    setRoute(undefined)
    setCustomStart(null)
    setRouteErrorMessage(null)
    setConfidenceTier(null)
    setGeneratedRouteContext(null)
    setGeneratedRouteRetryAttempt(0)

    if (inBrowser()) {
      const href = getHref()
      const url = new URL(href)
      url.searchParams.delete('route')
      window.history.replaceState(null, '', url.toString())
    }
  }

  const handleCityChange = useCallback((slug: string | null) => {
    setSelectedCity(slug)
    setRoute(undefined)
    setCustomStart(null)
    setConfidenceTier(null)
    setGeneratedRouteContext(null)
    setGeneratedRouteRetryAttempt(0)

    if (slug) setIsPanelOpen(true)
  }, [])

  const handleGeneratedRouteFromVenue = useCallback(
    (
      nextRoute: Venue[],
      generatedRoute?: any,
      options: { preserveRetryAttempt?: boolean } = {}
    ) => {
      const fallbackRoute = generatedRoute?.stops
        ?.map((stop: any) => stop?.venue)
        .filter(Boolean)

      const sourceRoute =
        Array.isArray(nextRoute) && nextRoute.length > 0
          ? nextRoute
          : fallbackRoute

      console.log('[MapWrapper received generated route]', {
        nextRouteLength: Array.isArray(nextRoute) ? nextRoute.length : 0,
        fallbackRouteLength: Array.isArray(fallbackRoute) ? fallbackRoute.length : 0,
        generatedRoute,
      })

      if (!Array.isArray(sourceRoute) || sourceRoute.length < 2) return

      const cleanedRoute = sourceRoute
        .map(coerceGeneratedVenue)
        .filter((venue): venue is Venue => Boolean(venue))

      if (cleanedRoute.length < 2) {
        setRouteErrorMessage('Generated route was missing usable venue coordinates.')
        return
      }

      const generatedCity = generatedRoute?.context?.city
      if (typeof generatedCity === 'string' && generatedCity.trim()) {
        setSelectedCity(generatedCity)
      }

      const venueByKey = new Map<string, Venue>()

      venues.forEach((venue) => {
        getVenueLookupKeys(venue).forEach((key) => {
          venueByKey.set(key, venue)
        })
      })

      const hydratedRoute = cleanedRoute.map((venue) => {
        const canonicalVenue = getVenueLookupKeys(venue)
          .map((key) => venueByKey.get(key))
          .find(Boolean)

        return canonicalVenue
          ? {
              ...canonicalVenue,
              ...venue,
            }
          : venue
      })

      setRoute(hydratedRoute)
      setGeneratedRouteContext(generatedRoute ?? null)
      setRouteErrorMessage(null)
      setConfidenceTier(null)
      setCustomStart(null)
      setIsPanelOpen(false)

      if (!options.preserveRetryAttempt) {
        setGeneratedRouteRetryAttempt(0)
      }

      if (inBrowser()) {
        const url = new URL(window.location.href)
        url.searchParams.set(
          'route',
          hydratedRoute.map((venue) => venue.id ?? venue.slug ?? venue.name).join(',')
        )

        if (typeof generatedCity === 'string' && generatedCity.trim()) {
          url.searchParams.set('city', generatedCity)
        }

        window.history.replaceState(null, '', url.toString())
      }
    },
    [venues]
  )

  const retryGeneratedRouteFromVenue = useCallback(async () => {
    const anchorVenue = generatedRouteContext?.anchorVenue ?? route?.[0]

    if (!anchorVenue) return false

    const source = generatedRouteContext?.source
    const hasVenueAnchor =
      source === 'map_marker' ||
      generatedRouteContext?.context?.anchorVenueId ||
      generatedRouteContext?.anchorVenue?.id

    if (!hasVenueAnchor) return false

    const nextAttempt = generatedRouteRetryAttempt + 1
    const generatedCity =
      generatedRouteContext?.context?.city ?? anchorVenue.city ?? selectedCity

    try {
      setRouteErrorMessage(null)

      const res = await fetch('/api/generate-from-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: anchorVenue.id ?? generatedRouteContext?.context?.anchorVenueId ?? null,
          venueSlug: anchorVenue.slug ?? null,
          venueName: anchorVenue.name ?? generatedRouteContext?.context?.anchorVenueName ?? null,
          city: generatedCity,
          plannedStartAt:
            generatedRouteContext?.context?.plannedStartAt ?? computePlannedStartAt(),
          travelMode: generatedRouteContext?.context?.travelMode ?? travelMode,
          tightness: generatedRouteContext?.context?.tightness ?? tightness,
          maxStops: generatedRouteContext?.context?.maxStops ?? route?.length ?? 5,
          source: generatedRouteContext?.source ?? 'map_marker',
          retrySeed:
            generatedRouteContext?.context?.anchorVenueId ??
            anchorVenue.id ??
            anchorVenue.slug ??
            anchorVenue.name,
          retryAttempt: nextAttempt,
          debug: true,
        }),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok || !payload?.route?.stops?.length) {
        throw new Error(payload?.error || 'Could not retry this route.')
      }

      const generatedVenues = payload.route.stops
        .map((stop: any) => stop?.venue)
        .filter(Boolean)

      handleGeneratedRouteFromVenue(generatedVenues, payload.route, {
        preserveRetryAttempt: true,
      })

      setGeneratedRouteRetryAttempt(nextAttempt)
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not retry this route.'

      console.error('Retry Generated Route From Venue Error:', error)
      setRouteErrorMessage(message)
      return true
    }
  }, [
    generatedRouteContext,
    generatedRouteRetryAttempt,
    route,
    selectedCity,
    travelMode,
    tightness,
    handleGeneratedRouteFromVenue,
  ])

  const handleStartGeneratedFlow = async () => {
    if (!route || route.length < 2) return

    try {
      const res = await fetch('/api/active-flow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: selectedCity,
          title: selectedThemeId ? `${selectedThemeId} Flow` : 'Roam Flow',
          source: 'map',
          venue_ids: route.map((venue) => venue.id),
          theme_id: selectedThemeId || null,
          travel_mode: travelMode,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        if (res.status === 409 && json.activeSession?.id && inBrowser()) {
          window.location.href = `/flow/${json.activeSession.id}`
          return
        }

        alert(json.error ?? 'Could not start flow.')
        return
      }

      if (json.session?.id && inBrowser()) {
        window.location.href = `/flow/${json.session.id}`
      }
    } catch (err) {
      console.error('Start Flow Error:', err)
      alert('Something went wrong starting this flow.')
    }
  }

  const handleHostGeneratedFlow = () => {
    if (!route || route.length < 2) return

    const slugs = route.map((venue) => venue.slug ?? venue.id).filter(Boolean).join(',')

    if (inBrowser()) {
      window.location.href = `/sponsor-crawl?slugs=${slugs}`
    }
  }

  const handleGenerateRoute = async () => {
    if (!selectedCity) return

    setRouteErrorMessage(null)
    setGeneratedRouteContext(null)
    setGeneratedRouteRetryAttempt(0)

    const fallbackCoords: Record<string, { lat: number; lon: number }> = {
      atl: { lat: 33.749, lon: -84.388 },
      nyc: { lat: 40.73061, lon: -73.935242 },
      lisbon: { lat: 38.7223, lon: -9.1393 },
      porto: { lat: 41.1579, lon: -8.6291 },
      london: { lat: 51.5072, lon: -0.1276 },
      la: { lat: 34.0522, lon: -118.2437 },
    }

    const startLat = customStart?.lat ?? fallbackCoords[selectedCity]?.lat ?? 37.8
    const startLon = customStart?.lon ?? fallbackCoords[selectedCity]?.lon ?? -96.9
    const plannedStartAt = computePlannedStartAt()

    try {
      let finalRoute: Venue[] | null = null
      let tierUsed: Tier | null = null

      const options: any = {
        maxStops: 6,
        filterOpen: true,
        customStart: customStart ?? undefined,
        startTime: plannedStartAt,
        tightness,
        city: selectedCity,
      }

      let stages: any[] | undefined
      let tier: Tier = 'commit'

      if (searchPrompt?.trim()) {
        const parseRes = await fetch('/api/parseprompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: searchPrompt }),
        })

        const parsed = await parseRes.json()
        tier = parsed?.data?.tier ?? 'constrain'
        stages = parsed?.data?.stages
        tierUsed = tier
        setConfidenceTier(tier)

        const crawlRes = await fetch('/api/generate-crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venues: visibleVenues,
            userLat: startLat,
            userLon: startLon,
            city: selectedCity,
            plannedStartAt,
            options,
            stages,
            tier,
          }),
        })

        const data = await crawlRes.json()
        if (crawlRes.ok && Array.isArray(data.route) && data.route.length >= MIN_QUALITY_STOPS) {
          finalRoute = data.route
          tierUsed = data.tier ?? tier
        }
      }

      if (!finalRoute && selectedThemeId) {
        const themeRes = await fetch('/api/generate-theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            themeId: selectedThemeId,
            userLat: startLat,
            userLon: startLon,
            venues: visibleVenues,
            city: selectedCity,
            plannedStartAt,
            options,
          }),
        })

        const data = await themeRes.json()
        if (themeRes.ok && Array.isArray(data.route) && data.route.length >= MIN_QUALITY_STOPS) {
          finalRoute = data.route
          tierUsed = null
          setConfidenceTier(null)
        }
      }

      if (!finalRoute) {
        const crawlRes = await fetch('/api/generate-crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venues: visibleVenues,
            userLat: startLat,
            userLon: startLon,
            city: selectedCity,
            plannedStartAt,
            options,
            tier: 'commit',
          }),
        })

        const data = await crawlRes.json()
        if (crawlRes.ok && Array.isArray(data.route) && data.route.length >= MIN_QUALITY_STOPS) {
          finalRoute = data.route
          tierUsed = data.tier ?? 'commit'
          setConfidenceTier(tierUsed)
        }
      }

      if (!finalRoute || finalRoute.length < MIN_QUALITY_STOPS) {
        setRoute(undefined)
        setRouteErrorMessage(
          'We couldn’t build a strong enough crawl nearby. Try a looser distance setting, a different start point, or another theme.'
        )
        return
      }

      setRoute(finalRoute)
      setRouteErrorMessage(null)
      setConfidenceTier(tierUsed)

      const ids = finalRoute.map((v) => v.id ?? v.name).join(',')
      if (hasMounted) {
        const url = new URL(window.location.href)
        url.searchParams.set('route', ids)
        window.history.replaceState(null, '', url.toString())
      }

      const origin = { lat: finalRoute[0].lat, lng: finalRoute[0].lon }
      const destination = {
        lat: finalRoute.at(-1)!.lat,
        lng: finalRoute.at(-1)!.lon,
      }
      const waypoints = finalRoute.slice(1, -1).map((v) => ({
        lat: v.lat,
        lng: v.lon,
      }))

      if (userId) {
        const proxyRes = await fetch('/api/mapbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin, destination, waypoints, travelMode }),
        })

        const routeData = await proxyRes.json()

        await fetch('/api/logRoute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            crawlTheme: selectedThemeId || 'manual',
            origin,
            destination,
            waypoints,
            routeDuration: routeData.duration,
            routeDistance: routeData.distance,
            routeGeometry: routeData.geometry,
            routeMetadata: {
              travelMode,
              city: selectedCity,
              stops: finalRoute.length,
              confidenceTier: tierUsed ?? undefined,
              usedPrompt: Boolean(searchPrompt?.trim()),
            },
          }),
        })
      }
    } catch (err) {
      console.error('Generate Crawl Error:', err)
      setRouteErrorMessage('Something went wrong. Try again.')
    }
  }

  const handleRetryAwareGenerateRoute = useCallback(async () => {
    const handledVenueRetry = await retryGeneratedRouteFromVenue()

    if (handledVenueRetry) return

    await handleGenerateRoute()
  }, [retryGeneratedRouteFromVenue])

  const hasGeneratedRoute = !!route && route.length > 1

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      <LeafletSetup />

      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="fixed left-3 top-20 z-[4600] rounded-lg bg-black/80 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90"
      >
        {isPanelOpen ? 'Hide Panel' : 'Show Panel'}
      </button>

      {isPanelOpen && (
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
          onCityChange={setSelectedCity}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchPrompt={searchPrompt}
          setSearchPrompt={setSearchPrompt}
          selectedThemeId={selectedThemeId}
          setSelectedThemeId={setSelectedThemeId}
          selectedPrice={selectedPrice}
          setSelectedPrice={setSelectedPrice}
          travelMode={travelMode}
          setTravelMode={setTravelMode}
          markerDisplayMode={markerDisplayMode}
          setMarkerDisplayMode={setMarkerDisplayMode}
          onGenerateRoute={handleGenerateRoute}
          onClearRoute={handleClearRoute}
          tightness={tightness}
          setTightness={setTightness}
          crawlDate={crawlDate}
          setCrawlDate={setCrawlDate}
          crawlTime={crawlTime}
          setCrawlTime={setCrawlTime}
          hasGeneratedRoute={hasGeneratedRoute}
          generatedRouteStopCount={route?.length ?? 0}
          onStartGeneratedFlow={handleStartGeneratedFlow}
          onHostGeneratedFlow={handleHostGeneratedFlow}
        />
      )}

      {routeErrorMessage && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-800 px-4 py-2 rounded shadow z-[4700] text-sm max-w-md text-center">
          {routeErrorMessage}
        </div>
      )}

      <CrawlControl
        venues={visibleVenues}
        route={route}
        onRoute={setRoute}
        selectedThemeId={selectedThemeId}
        customStart={customStart}
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
        onGenerateRoute={handleRetryAwareGenerateRoute}
        hasGeneratedRoute={hasGeneratedRoute}
        generatedRouteStopCount={route?.length ?? 0}
        generatedRouteContext={generatedRouteContext}
        onStartGeneratedFlow={handleStartGeneratedFlow}
        onHostGeneratedFlow={handleHostGeneratedFlow}
        onClearRoute={handleClearRoute}
      />

      {hasMounted && (
        <Suspense fallback={<div className="text-center p-4 text-white">Loading map…</div>}>
          <MapCanvas
            route={route}
            onMapClick={handleMapClick}
            customStart={customStart}
            themeId={selectedThemeId}
            travelMode={travelMode}
            markerDisplayMode={markerDisplayMode}
            showLiveEventsOnly={showLiveEventsOnly}
            onCityChange={handleCityChange}
            onGeneratedRouteCityChange={setSelectedCity}
            onGeneratedRouteFromVenue={handleGeneratedRouteFromVenue}
            searchTerm={searchTerm}
            isPanelOpen={isPanelOpen}
          />
        </Suspense>
      )}
    </main>
  )
}