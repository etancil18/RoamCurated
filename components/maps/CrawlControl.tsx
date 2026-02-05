

import { useState } from 'react'
import type { Venue } from '@/types/venue'
import { themeById } from '@/lib/crawlConfig'
import { findSimilarVenuesNearby } from '@/utils/findSimilarVenues'
import { useFavorites } from '@/hooks/useFavorites'
import { useInterestedEvents } from '@/hooks/useInterestedEvents'
import { nanoid } from 'nanoid'
import ReplaceStopModal from '@/components/modals/ReplaceStopModal'
import FavoritesModal from '@/components/modals/FavoritesModal'
import EventsModal from '@/components/modals/EventsModal'
import HostCrawlModal from '@/components/modals/HostCrawlModal'
import { logEvent } from '@/lib/logEvent'
import { getHref, getOrigin, inBrowser } from '@/lib/browser'

export type CrawlControlProps = {
  venues: Venue[]
  route?: Venue[]
  onRoute: (route: Venue[]) => void
  selectedThemeId: string
  customStart?: { lat: number; lon: number } | null
  city: 'atl' | 'nyc' | null
  onGenerateRoute: () => Promise<void>
}

export default function CrawlControl({
  venues,
  route,
  onRoute,
  selectedThemeId,
  customStart,
  city,
  onGenerateRoute,
}: CrawlControlProps) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [modalData, setModalData] = useState({
    target: null,
    options: [],
    index: null,
  } as {
    target: Venue | null
    options: Venue[]
    index: number | null
  })
  const [showFavoritesModal, setShowFavoritesModal] = useState(false)
  const [showEventsModal, setShowEventsModal] = useState(false)
  const [showHostModal, setShowHostModal] = useState(false)
  const [showCrawlInfo, setShowCrawlInfo] = useState(false)

  const {
    favorites,
    loading: loadingFavorites,
  } = useFavorites(city ?? 'atl')

  const {
    interested: interestedEvents,
    loading: loadingEvents,
    error: interestError,
    markInterest,
    removeInterest,
    refresh,
  } = useInterestedEvents()

  async function handleGenerate() {
    setLoading(true)
    try {
      await onGenerateRoute()
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveToCloud() {
    if (!Array.isArray(route) || route.length < 2) {
      alert('Need at least 2 stops to save.')
      return
    }

    const name = prompt('Name this crawl?')
    if (!name) return

    const slugBase = name.toLowerCase().replace(/\s+/g, '-')
    const slug = `${slugBase}-${nanoid(6)}`
    const sourceUrl = inBrowser() ? `${getOrigin()}/crawl/${slug}` : ''

    try {
      const res = await fetch('/api/routes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stops: route, city, slug, sourceUrl }),
      })

      if (!res.ok) {
        const msg = await res.text()
        console.error('Save failed:', msg)
        throw new Error(msg)
      }

      logEvent('crawl_saved', {
        metadata: {
          num_stops: route.length,
          theme_id: selectedThemeId,
          city: city ?? 'all',
          route_ids: route.map((v) => v.id),
        },
      })

      alert('✅ Saved to your account!')
    } catch (err: any) {
      console.error(err)
      alert('❌ Error saving route.')
    }
  }

  function handleExportToMaps() {
    if (!Array.isArray(route) || route.length < 2) return

    logEvent('crawl_exported', {
      metadata: {
        num_stops: route.length,
        city,
        theme_id: selectedThemeId,
      },
    })

    const base = 'https://www.google.com/maps/dir/'
    const waypoints = route.map((v) => `${v.lat},${v.lon}`).join('/')

    if (inBrowser()) {
      window.open(`${base}${waypoints}`, '_blank')
    }
  }

  function handleInsertFavoriteAt(newVenue: Venue, index: number) {
    if (!route) return
    if (route.find((r) => r.slug === newVenue.slug)) {
      alert('This venue is already in your crawl.')
      return
    }

    const updated = [...route.slice(0, index), newVenue, ...route.slice(index)]
    onRoute(updated)
    setShowFavoritesModal(false)

    logEvent('favorite_added_to_crawl', {
      venue_id: newVenue.id,
      metadata: { index, city },
    })
  }

  function handleInsertEventAt(newVenue: Venue, index: number) {
    if (!route) return
    if (route.find((r) => r.slug === newVenue.slug)) {
      alert('This venue is already in your crawl.')
      return
    }

    const updated = [...route.slice(0, index), newVenue, ...route.slice(index)]
    onRoute(updated)
    setShowEventsModal(false)

    logEvent('event_added_to_crawl', {
      venue_id: newVenue.id,
      metadata: { index, city },
    })
  }

  function handleCopyLink() {
    if (!Array.isArray(route) || route.length === 0 || !inBrowser()) return

    const ids = route.map((v) => v.id ?? v.name).join(',')
    const href = getHref()
    const url = new URL(href)
    url.searchParams.set('route', ids)

    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })

    logEvent('crawl_link_copied', {
      metadata: {
        num_stops: route.length,
        city,
      },
    })
  }

  function handleClear() {
    onRoute([])
    setShowCrawlInfo(false)

    if (inBrowser()) {
      const href = getHref()
      const url = new URL(href)
      url.searchParams.delete('route')
      window.history.replaceState(null, '', url.toString())
    }

    setCopied(false)

    logEvent('crawl_cleared', {
      metadata: {
        previous_num_stops: route?.length ?? 0,
        city,
      },
    })
  }

  function handleModifyStop(stop: Venue, index: number) {
    const similar = findSimilarVenuesNearby(venues, stop, 3)
    setModalData({ target: stop, options: similar, index })
  }

  function handleReplaceStop(newVenue: Venue, index: number) {
    if (!route) return
    const updated = [...route]
    updated[index] = newVenue
    onRoute(updated)
    setModalData({ target: null, options: [], index: null })

    logEvent('stop_replaced', {
      venue_id: newVenue.id,
      metadata: { index, city },
    })
  }

  function handleRemoveStop(index: number) {
    if (!route) return

    logEvent('stop_removed', {
      venue_id: route[index].id,
      metadata: {
        index,
        removed_stop_id: route[index].id,
        city,
      },
    })

    const updated = route.filter((_, i) => i !== index)
    onRoute(updated)
    setModalData({ target: null, options: [], index: null })
  }

  const themeName = selectedThemeId ? themeById[selectedThemeId]?.description : null

  return (
    <>
      {(Array.isArray(route) && route.length > 0) || showCrawlInfo ? (
        <div className="absolute bottom-5 left-4 z-[2000] bg-black/60 text-white px-3 py-2 rounded-md shadow w-72">
          <div className="mt-1 space-y-2 text-sm">
            <h3 className="font-semibold text-white text-base">Your Stops:</h3>

            {themeName && (
              <p className="text-xs text-gray-300 italic text-center">
                Theme: {themeName}
              </p>
            )}

            <ol className="list-decimal pl-5 space-y-1 max-h-40 overflow-y-auto">
              {route?.map((stop, i) => (
                <li key={i} className="flex items-center justify-between">
                  <a
                    href={stop.link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {stop.name}
                  </a>
                  <button
                    onClick={() => handleModifyStop(stop, i)}
                    className="text-red-400 text-xs hover:text-red-600 ml-2"
                  >
                    ❌
                  </button>
                </li>
              ))}
            </ol>

            <div className="pt-2 border-t border-gray-400 space-y-1">
              <button onClick={handleSaveToCloud} className="w-full bg-blue-500 py-1 rounded">💾 Save</button>
              <button onClick={handleExportToMaps} className="w-full bg-green-500 py-1 rounded">🌍 Export</button>
              <button onClick={() => setShowFavoritesModal(true)} className="w-full bg-yellow-500 py-1 rounded">➕ Favorites</button>
              <button onClick={() => setShowEventsModal(true)} className="w-full bg-stone-700 py-1 rounded">🎟️ Events</button>
              <button onClick={() => setShowHostModal(true)} className="w-full bg-fuchsia-600 py-1 rounded">🏠 Host</button>
              <button onClick={handleCopyLink} className="w-full bg-purple-700 py-1 rounded">🔗 {copied ? 'Copied!' : 'Copy Link'}</button>
              <button onClick={handleClear} className="w-full bg-red-500 py-1 rounded">❌ Clear Route</button>
            </div>
          </div>

          <ReplaceStopModal {...{ modalData, handleReplaceStop, handleRemoveStop, setModalData }} />
          <FavoritesModal show={showFavoritesModal} favorites={favorites} loading={loadingFavorites} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertFavoriteAt} onClose={() => setShowFavoritesModal(false)} />
          <EventsModal show={showEventsModal} interestedEvents={interestedEvents} loading={loadingEvents} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertEventAt} onClose={() => setShowEventsModal(false)} />
          <HostCrawlModal show={showHostModal} route={route ?? []} onClose={() => setShowHostModal(false)} />
        </div>
      ) : (
        <div className="absolute bottom-10 left-4 z-[2000]">
          <button
            onClick={() => setShowCrawlInfo(true)}
            className="bg-black/80 text-white px-3 py-2 rounded-md shadow"
          >
            📋 Show Crawl Info
          </button>
        </div>
      )}
    </>
  )
}
