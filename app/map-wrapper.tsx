'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useMemo, useState } from 'react'
import atlantaData from '@/data/atlanta'
import nycData from '@/data/nyc'
import type { Venue } from '@/types/venue'
import CrawlControl from '@/components/maps/CrawlControl'
import type { RouteOptions } from '@/lib/routeEngine'
import { ControlPanel } from '@/components/ControlPanel'
import { useUser } from '@/hooks/useUser'

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

  const { user } = useUser()
  const userId = user?.id

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

  const handleGenerateRoute = async () => {
    const fallbackCoords: Record<'atl' | 'nyc', { lat: number; lon: number }> = {
      atl: { lat: 33.749, lon: -84.388 },
      nyc: { lat: 40.73061, lon: -73.935242 },
    }

    const startLat = customStart?.lat ?? fallbackCoords[city].lat
    const startLon = customStart?.lon ?? fallbackCoords[city].lon

    try {
      let data

      if (selectedThemeId) {
        const response = await fetch('/api/generate-theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            themeId: selectedThemeId,
            userLat: startLat,
            userLon: startLon,
            venues: visibleVenues,
            city,
            options: {
              maxStops: 6,
              filterOpen: true,
              tightness,
              city,
            },
          }),
        })
        data = await response.json()
      } else {
        const options: RouteOptions = {
          maxStops: 6,
          filterOpen: true,
          customStart: customStart ?? undefined,
          startTime: new Date(),
          tightness,
          city,
        }

        const response = await fetch('/api/generate-crawl', {
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
        data = await response.json()
      }

      if (!Array.isArray(data.route) || data.route.length < 2) {
        const reason =
          data.reason ||
          (data.route?.length === 1
            ? 'Only one stop matched your filters.'
            : 'No venues matched your filters or location.')

        setRoute(undefined)
        setRouteErrorMessage(
          `🛑 Couldn’t build a full route: ${reason} Routes are time-sensitive — try adjusting filters, starting location, or generating earlier in the day when more places are open.`
        )
        return
      }

      setRouteErrorMessage(null)
      setRoute(data.route)

      const ids = data.route.map((v: Venue) => v.id ?? v.name).join(',')
      const url = new URL(window.location.href)
      url.searchParams.set('route', ids)
      window.history.replaceState(null, '', url.toString())

      const origin = { lat: data.route[0].lat, lng: data.route[0].lon }
      const destination = { lat: data.route[data.route.length - 1].lat, lng: data.route[data.route.length - 1].lon }
      const waypoints = data.route.slice(1, -1).map((v: Venue) => ({ lat: v.lat, lng: v.lon }))

      if (!userId) {
        console.warn('No user session found — skipping route log')
        return
      }

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
            stops: data.route.length,
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
          showLiveEventsOnly={showLiveEventsOnly}
          setShowLiveEventsOnly={setShowLiveEventsOnly}
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
        <MapCanvas
          venues={visibleVenues}
          route={route}
          city={city}
          onMapClick={handleMapClick}
          themeId={selectedThemeId}
          travelMode={travelMode}
          showLiveEventsOnly={showLiveEventsOnly}
        />
      </Suspense>
    </main>
  )
}
