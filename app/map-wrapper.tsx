// Updated for SSR-safety
'use client'


import dynamic from 'next/dynamic'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useCityData } from '@/hooks/useCityData'
import CrawlControl from '@/components/maps/CrawlControl'
import { ControlPanel } from '@/components/ControlPanel'
import { useUser } from '@/hooks/useUser'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Venue } from '@/types/venue'
import LeafletSetup from '@/components/maps/LeafletSetup'
import { inBrowser, getHref } from '@/lib/browser'


const MapCanvas = dynamic(() => import('@/components/maps/MapCanvas'), {
ssr: false,
})


export default function MapWrapper() {
const [selectedCity, setSelectedCity] = useState<string | null>(null)
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
const [isPanelOpen, setIsPanelOpen] = useState(false)
const [hasMounted, setHasMounted] = useState(false)


const { user } = useUser()
const userId = user?.id
const supabase = supabaseBrowser()


const {
venues = [],
eventsByVenueId = {},
} = useCityData(selectedCity ?? '', { showLiveEventsOnly })


useEffect(() => {
setHasMounted(true)
}, [])


useEffect(() => {
if (!venues.length || !inBrowser()) return
const params = new URLSearchParams(window.location.search)
const routeParam = params.get('route')
if (!routeParam) return


const ids = routeParam.split(',')
const matched = ids
.map((id) => venues.find((v) => v.id === id || v.name === id))
.filter((v): v is Venue => !!v)


if (matched.length > 0) {
setRoute(matched)
}
}, [venues])


const filteredVenues = useMemo(() => {
return venues.filter((v) => {
const matchesSearch =
!searchTerm ||
v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
v.vibe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
v.tags?.toLowerCase().includes(searchTerm.toLowerCase()) ||
String(v.type ?? '').toLowerCase().includes(searchTerm.toLowerCase())


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
alert('Custom start location set. Generate your crawl when ready.')
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
}, [])

  const handleGenerateRoute = async () => {
    if (!selectedCity) return

    const fallbackCoords: Record<string, { lat: number; lon: number }> = {
      atl: { lat: 33.749, lon: -84.388 },
      nyc: { lat: 40.73061, lon: -73.935242 },
    }

    const startLat = customStart?.lat ?? fallbackCoords[selectedCity]?.lat ?? 37.8
    const startLon = customStart?.lon ?? fallbackCoords[selectedCity]?.lon ?? -96.9
    const plannedStartAt = computePlannedStartAt()

    try {
      let data: any = null
      let finalRoute: Venue[] | null = null

      const options: any = {
        maxStops: 6,
        filterOpen: true,
        customStart: customStart ?? undefined,
        startTime: plannedStartAt,
        tightness,
        city: selectedCity,
      }

      if (searchPrompt?.trim()) {
        try {
          const parseRes = await fetch('/api/parseprompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: searchPrompt }),
          })
          const parsed = await parseRes.json()
          const stages = parsed?.data?.stages

          if (Array.isArray(stages) && stages.length > 0) {
            const aiRes = await fetch('/api/generate-crawl', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ venues: visibleVenues, userLat: startLat, userLon: startLon, city: selectedCity, options, stages }),
            })
            data = await aiRes.json()
            if (aiRes.ok && Array.isArray(data.route)) finalRoute = data.route
          }
        } catch (err) {
          console.warn('⚠️ AI crawl failed:', err)
        }
      }

      if (!finalRoute && selectedThemeId) {
        const response = await fetch('/api/generate-theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            themeId: selectedThemeId,
            userLat: startLat,
            userLon: startLon,
            venues: visibleVenues,
            city: selectedCity,
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
          if (Array.isArray(data.route)) finalRoute = data.route
        }
      }

      if (!finalRoute) {
        const fallbackRes = await fetch('/api/generate-crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venues: visibleVenues, userLat: startLat, userLon: startLon, city: selectedCity, options }),
        })
        data = await fallbackRes.json()
        if (fallbackRes.ok && Array.isArray(data.route)) finalRoute = data.route
      }

      if (!finalRoute) throw new Error('No route generated')

      setRoute(finalRoute)
      setRouteErrorMessage(null)

      const ids = finalRoute.map((v) => v.id ?? v.name).join(',')

      if (hasMounted) {
        const href = window.location.href
        const url = new URL(href)
        url.searchParams.set('route', ids)
        window.history.replaceState(null, '', url.toString())
      }

      const origin = { lat: finalRoute[0].lat, lng: finalRoute[0].lon }
      const destination = { lat: finalRoute.at(-1)?.lat ?? 0, lng: finalRoute.at(-1)?.lon ?? 0 }
      const waypoints = finalRoute.slice(1, -1).map((v) => ({ lat: v.lat, lng: v.lon }))

      if (userId && plannedStartAt) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
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
            city: selectedCity,
            stops: finalRoute.length,
          },
        }),
      })
    } catch (err) {
      console.error('Generate Crawl Error:', err)
      alert('Something went wrong. Try again.')
    }
  }

  return (
<main className="h-screen w-screen relative overflow-hidden">
<LeafletSetup />
<button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-2 left-2 z-[1100] bg-white px-3 py-1 rounded shadow text-sm">
{isPanelOpen ? 'Hide Panel' : 'Show Panel'}
</button>


{isPanelOpen && (
<ControlPanel
city={selectedCity as 'atl' | 'nyc' | null}
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
city={selectedCity as 'atl' | 'nyc' | null}
onGenerateRoute={handleGenerateRoute}
/>


{hasMounted && (
<Suspense fallback={<div className="text-center p-4 text-white">Loading map…</div>}>
<MapCanvas
route={route}
onMapClick={handleMapClick}
themeId={selectedThemeId}
travelMode={travelMode}
showLiveEventsOnly={showLiveEventsOnly}
onCityChange={handleCityChange}
/>
</Suspense>
)}
</main>
)
}