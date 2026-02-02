'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useMemo, useState } from 'react'
import atlantaData from '@/data/atlanta'
import nycData from '@/data/nyc'
import type { Venue } from '@/types/venue'
import CrawlControl from '@/components/maps/CrawlControl'
import { ControlPanel } from '@/components/ControlPanel'
import { useUser } from '@/hooks/useUser'
import { supabaseBrowser } from '@/lib/supabase/client'

const MapCanvas = dynamic(() => import('@/components/maps/MapCanvas'), {
  ssr: false,
})

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}

function validateUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)
}

function normalizeVenues(data: any[]): Venue[] {
  return data.map((d) => {
    const slug = d.slug || slugify(d.name || d.title || 'unknown')
    const id = d.id && validateUUID(d.id)
      ? d.id
      : slugify(`${slug}-${d.neighborhood || d.city || 'unknown'}`)

    return {
      ...d,
      id,
      slug,
      lat: typeof d.lat === 'string' ? parseFloat(d.lat) : d.lat,
      lon: typeof d.lon === 'string' ? parseFloat(d.lon) : d.lon,
      neighborhood: d.neighborhood ?? '',
      price: d.price ?? '',
      vibe: typeof d.vibe === 'string' ? d.vibe : undefined,
      tags: d.tags ?? '',
      type: d.type ?? '',
    }
  }) as Venue[]
}

export default function MapWrapper() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [city, setCity] = useState<'atl' | 'nyc'>('atl')
  const [venues, setVenues] = useState<Venue[]>([])
  const [route, setRoute] = useState<Venue[] | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [selectedPrice, setSelectedPrice] = useState('')
  const [travelMode, setTravelMode] = useState<'walking' | 'cycling' | 'driving'>('walking')
  const [customStart, setCustomStart] = useState<{ lat: number; lon: number } | null>(null)
  const [tightness, setTightness] = useState<'tight' | 'medium' | 'loose'>('medium')
  const [showLiveEventsOnly, setShowLiveEventsOnly] = useState(false)
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null)
  const [crawlDate, setCrawlDate] = useState('')
  const [crawlTime, setCrawlTime] = useState('')
  const [searchPrompt, setSearchPrompt] = useState('')

  const { user } = useUser()
  const userId = user?.id
  const supabase = supabaseBrowser()

  useEffect(() => {
    const raw = city === 'atl' ? atlantaData : nycData
    setVenues(normalizeVenues(raw))
    setRoute(undefined)
    setCustomStart(null)
  }, [city])

  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const matchesSearch =
        !searchTerm ||
        v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.vibe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.tags?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(v.type ?? '').toLowerCase().includes(searchTerm.toLowerCase())

      const priceRank: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 }

      const venuePriceKey = v.price && priceRank[v.price] ? v.price : undefined
      const selectedPriceKey = selectedPrice && priceRank[selectedPrice] ? selectedPrice : undefined

      const venuePriceRank = venuePriceKey ? priceRank[venuePriceKey] : Infinity
      const selectedPriceRank = selectedPriceKey ? priceRank[selectedPriceKey] : Infinity

      const matchesPrice = !selectedPriceKey || venuePriceRank <= selectedPriceRank

      return matchesSearch && matchesPrice
    })
  }, [venues, searchTerm, selectedPrice])

  const visibleVenues = useMemo(() => {
    if (!showLiveEventsOnly) return filteredVenues
    return filteredVenues.filter((v) => v._has_upcoming_events === true)
  }, [filteredVenues, showLiveEventsOnly])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const routeParam = params.get('route')
    if (!routeParam || venues.length === 0) return

    const ids = routeParam.split(',')
    const matched = ids
      .map((id) => venues.find((v) => v.id === id || v.name === id))
      .filter((v): v is Venue => !!v)

    if (matched.length > 0) {
      setRoute(matched)
    }
  }, [venues])

  const handleMapClick = (lat: number, lon: number) => {
    setCustomStart({ lat, lon })
    alert('Custom start location set. Generate your crawl when ready.')
  }

  const computePlannedStartAt = () => {
    if (crawlDate && crawlTime) {
      const timestamp = new Date(`${crawlDate}T${crawlTime}`)
      return isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString()
    }
    return new Date().toISOString()
  }

  const handleGenerateRoute = async () => {
    const fallbackCoords: Record<'atl' | 'nyc', { lat: number; lon: number }> = {
      atl: { lat: 33.749, lon: -84.388 },
      nyc: { lat: 40.73061, lon: -73.935242 },
    }

    const startLat = customStart?.lat ?? fallbackCoords[city].lat
    const startLon = customStart?.lon ?? fallbackCoords[city].lon
    const plannedStartAt = computePlannedStartAt()

    if (!Array.isArray(visibleVenues) || visibleVenues.length === 0) {
      setRouteErrorMessage(`🛑 No venues available — adjust filters or search to build a crawl.`)
      return
    }

    try {
  let data: any = null
  let finalRoute: Venue[] | null = null

  const options: any = {
    maxStops: 6,
    filterOpen: true,
    customStart: customStart ?? undefined,
    startTime: plannedStartAt,
    tightness,
    city,
  }

  // ─────────────────────────────
  // 1) AI PROMPT CRAWL
  // ─────────────────────────────
  if (searchPrompt && searchPrompt.trim().length > 0) {
    try {
      const parseRes = await fetch('/api/parseprompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: searchPrompt }),
      })

      const parsed = await parseRes.json()
      const stages = parsed?.data?.stages

      console.log('🎯 Parsed AI stages:', stages)

      if (Array.isArray(stages) && stages.length > 0) {
        const aiRes = await fetch('/api/generate-crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venues: visibleVenues,
            userLat: startLat,
            userLon: startLon,
            city,
            options,
            stages,
          }),
        })

        data = await aiRes.json()
        if (aiRes.ok && Array.isArray(data.route)) {
          finalRoute = data.route
        }
      }
    } catch (err) {
      console.warn('⚠️ AI crawl failed:', err)
    }
  }

  // ─────────────────────────────
  // 2) THEME CRAWL
  // ─────────────────────────────
  if (!finalRoute && selectedThemeId) {
    const response = await fetch('/api/generate-theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeId: selectedThemeId,
        userLat: startLat,
        userLon: startLon,
        venues: visibleVenues,
        city,
        plannedStartAt,
        options: {
          maxStops: 6,
          filterOpen: true,
          tightness,
        },
      }),
    })

    if (response.ok) {
      data = await response.json()
      if (Array.isArray(data.route)) {
        finalRoute = data.route
      }
    }
  }

  // ─────────────────────────────
  // 3) MANUAL FALLBACK
  // ─────────────────────────────
  if (!finalRoute) {
    const fallbackRes = await fetch('/api/generate-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venues: visibleVenues,
        userLat: startLat,
        userLon: startLon,
        city,
        options,
      }),
    })

    data = await fallbackRes.json()
    if (fallbackRes.ok && Array.isArray(data.route)) {
      finalRoute = data.route
    }
  }

  if (!finalRoute) {
    throw new Error('No route generated')
  }

  // ─────────────────────────────
  // 🔥 SHARED POST-PROCESSING
  // ─────────────────────────────

  setRoute(finalRoute)
  setRouteErrorMessage(null)

  const ids = finalRoute.map((v: Venue) => v.id ?? v.name).join(',')
  const url = new URL(window.location.href)
  url.searchParams.set('route', ids)
  window.history.replaceState(null, '', url.toString())

  const origin = { lat: finalRoute[0].lat, lng: finalRoute[0].lon }
  const destination = {
    lat: finalRoute[finalRoute.length - 1].lat,
    lng: finalRoute[finalRoute.length - 1].lon,
  }

  const waypoints = finalRoute
    .slice(1, -1)
    .map((v: Venue) => ({ lat: v.lat, lng: v.lon }))

  // Save scheduled crawl
  if (userId && plannedStartAt) {
    try {
      const browserSupabase = supabaseBrowser()
      const { data: { session } } = await browserSupabase.auth.getSession()

      const accessToken = session?.access_token

      if (accessToken) {
        await fetch('/api/scheduled-routes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            plannedStartAt,
            route: finalRoute,
            name: selectedThemeId
              ? `${selectedThemeId} @ ${new Date(plannedStartAt).toLocaleString()}`
              : `Crawl @ ${new Date(plannedStartAt).toLocaleString()}`,
          }),
        })
      }
    } catch (err) {
      console.error('❌ Scheduled save error:', err)
    }
  }

  if (!userId) return

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
        city,
        stops: finalRoute.length,
      },
    }),
  })

} catch (err) {
  console.error('Generate Crawl Error:', err)
  alert('Something went wrong. Try again.')
}
  }

  const handleClearRoute = () => {
    setRoute(undefined)
    setCustomStart(null)
    setRouteErrorMessage(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('route')
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-2 left-2 z-[1100] bg-white px-3 py-1 rounded shadow text-sm"
      >
        {isPanelOpen ? 'Hide Panel' : 'Show Panel'}
      </button>

      {isPanelOpen && (
        <ControlPanel
          city={city}
          onCityChange={setCity}
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
          onGenerateRoute={handleGenerateRoute}
          onClearRoute={handleClearRoute}
          tightness={tightness}
          setTightness={setTightness}
          crawlDate={crawlDate}
          setCrawlDate={setCrawlDate}
          crawlTime={crawlTime}
          setCrawlTime={setCrawlTime}
        />
      )}

      {routeErrorMessage && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-800 px-4 py-2 rounded shadow z-[1050] text-sm max-w-md text-center">
          {routeErrorMessage}
        </div>
      )}

      <CrawlControl
        venues={visibleVenues}
        route={route}
        onRoute={setRoute}
        selectedThemeId={selectedThemeId}
        customStart={customStart}
        city={city}
        onGenerateRoute={handleGenerateRoute}
      />

      <Suspense fallback={<div className="text-center p-4 text-white">Loading map…</div>}>
        {typeof window !== 'undefined' && (
          <MapCanvas
            venues={visibleVenues ?? []}
            route={route ?? []}
            city={city}
            onMapClick={handleMapClick}
            themeId={selectedThemeId}
            travelMode={travelMode}
            showLiveEventsOnly={showLiveEventsOnly}
          />
        )}
      </Suspense>
    </main>
  )
}
