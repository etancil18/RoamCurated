'use client'

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
import { logEvent } from '@/lib/logEvent'
import { getOrigin, inBrowser } from '@/lib/browser'

export type CrawlControlProps = {
  venues: Venue[]
  route?: Venue[]
  onRoute: (route: Venue[]) => void
  selectedThemeId: string
  customStart?: { lat: number; lon: number } | null
  city: 'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la' | null
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
        <div className="fixed bottom-3 left-3 z-[2000] w-[45vw] max-w-xs bg-black/70 backdrop-blur-sm text-white px-2 py-2 rounded-lg shadow-lg text-xs">
          <div className="space-y-1">
            <h3 className="font-medium uppercase tracking-wide opacity-80">
              Your Stops:
            </h3>

            {themeName && (
              <p className="text-[10px] text-gray-300 italic">
                Theme: {themeName}
              </p>
            )}

            <ol className="list-decimal pl-4 space-y-0.5 max-h-32 overflow-y-auto">
              {route?.map((stop, i) => (
                <li key={i} className="flex items-center justify-between gap-1 text-xs">
                  <a
                    href={stop.link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 truncate max-w-[140px]"
                  >
                    {stop.name}
                  </a>
                  <button
                    onClick={() => handleModifyStop(stop, i)}
                    className="text-red-400 text-[10px] ml-1"
                  >
                    ❌
                  </button>
                </li>
              ))}
            </ol>

           <div className="grid grid-cols-3 gap-2 border-t border-white/20 pt-2">
              <button
                onClick={handleSaveToCloud}
                className="rounded bg-blue-500 px-3 py-2 text-[11px] font-semibold"
              >
                Save
              </button>

              <button
                onClick={() => setShowFavoritesModal(true)}
                className="rounded bg-yellow-500 px-3 py-2 text-[11px] font-semibold text-black"
              >
                Favorites
              </button>

              <button
                onClick={() => setShowEventsModal(true)}
                className="rounded bg-fuchsia-700 px-3 py-2 text-[11px] font-semibold"
              >
                Events
              </button>
            </div>
          </div>

          <ReplaceStopModal {...{ modalData, handleReplaceStop, handleRemoveStop, setModalData }} />
          <FavoritesModal show={showFavoritesModal} favorites={favorites} loading={loadingFavorites} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertFavoriteAt} onClose={() => setShowFavoritesModal(false)} />
          <EventsModal show={showEventsModal} interestedEvents={interestedEvents} loading={loadingEvents} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertEventAt} onClose={() => setShowEventsModal(false)} />
        </div>
      ) : (
        <div className="fixed bottom-3 left-3 z-[2000]">
          <button
            onClick={() => setShowCrawlInfo(true)}
            className="bg-black/80 text-white px-2 py-1 rounded text-xs shadow"
          >
            📋 Crawl
          </button>
        </div>
      )}
    </>
  )
}