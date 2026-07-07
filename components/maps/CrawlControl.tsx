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
  onClearRoute?: () => void
  hasGeneratedRoute?: boolean
  generatedRouteStopCount?: number
  generatedRouteContext?: any
  onStartGeneratedFlow?: () => void
  onHostGeneratedFlow?: () => void
}

export default function CrawlControl({
  venues,
  route,
  onRoute,
  selectedThemeId,
  customStart,
  city,
  onGenerateRoute,
  onClearRoute,
  hasGeneratedRoute = false,
  generatedRouteStopCount = 0,
  generatedRouteContext = null,
  onStartGeneratedFlow,
  onHostGeneratedFlow,
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
  const [panelHidden, setPanelHidden] = useState(false)

  const { favorites, loading: loadingFavorites } = useFavorites(city ?? 'atl')

  const {
    interested: interestedEvents,
    loading: loadingEvents,
  } = useInterestedEvents()

  async function handleGenerate() {
    setLoading(true)
    try {
      await onGenerateRoute()
    } finally {
      setLoading(false)
    }
  }

  function handleClearRoute() {
    if (onClearRoute) {
      onClearRoute()
    } else {
      onRoute([])
    }

    setShowCrawlInfo(false)
    setPanelHidden(false)

    logEvent('route_cleared', {
      metadata: {
        city,
        source: 'crawl_control',
        route_length: route?.length ?? 0,
      },
    })
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

  const themeName = selectedThemeId
    ? themeById[selectedThemeId]?.description
    : null

  const hasRoute = Array.isArray(route) && route.length > 0
  const shouldShowPanel = !panelHidden && (hasRoute || showCrawlInfo || hasGeneratedRoute)
  const stopCount = generatedRouteStopCount || route?.length || 0
  const availableXp = stopCount * 25 + 100

  const routeHeadline =
    generatedRouteContext?.explanation?.headline ??
    generatedRouteContext?.headline ??
    null

  const routeSummary =
    generatedRouteContext?.explanation?.summary ??
    generatedRouteContext?.summary ??
    null

  const routeBullets: string[] =
    generatedRouteContext?.explanation?.bullets ??
    generatedRouteContext?.bullets ??
    []

  if (panelHidden) {
    return (
      <>
        <div className="fixed bottom-3 left-3 z-[2000]">
          <button
            onClick={() => {
              setPanelHidden(false)
              setShowCrawlInfo(true)
              logEvent('crawl_control_panel_shown', {
                metadata: { city, route_length: route?.length ?? 0 },
              })
            }}
            className="rounded-full border border-white/15 bg-black/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
          >
            Show Panel
          </button>
        </div>

        <ReplaceStopModal {...{ modalData, handleReplaceStop, handleRemoveStop, setModalData }} />
        <FavoritesModal show={showFavoritesModal} favorites={favorites} loading={loadingFavorites} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertFavoriteAt} onClose={() => setShowFavoritesModal(false)} />
        <EventsModal show={showEventsModal} interestedEvents={interestedEvents} loading={loadingEvents} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertEventAt} onClose={() => setShowEventsModal(false)} />
      </>
    )
  }

  return (
    <>
      {shouldShowPanel ? (
        <div className="fixed bottom-3 left-3 z-[2000] w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 text-xs text-white shadow-2xl backdrop-blur-xl">
          <div className="bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-indigo-500/[0.08] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="mt-1 text-sm font-black uppercase tracking-wide text-white">
                  Your Stops
                </h3>

                {themeName && (
                  <p className="mt-1 line-clamp-2 text-[11px] italic leading-5 text-white/65">
                    {themeName}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPanelHidden(true)
                  logEvent('crawl_control_panel_hidden', {
                    metadata: { city, route_length: route?.length ?? 0 },
                  })
                }}
                className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-medium text-white/70 hover:bg-white/10"
              >
                Hide
              </button>
            </div>

            {(routeHeadline || routeSummary || routeBullets.length > 0) && (
              <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  Contextual Route
                </p>

                {routeHeadline ? (
                  <p className="mt-1 text-sm font-black leading-5 text-white">
                    {routeHeadline}
                  </p>
                ) : null}

                {routeSummary ? (
                  <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-white/65">
                    {routeSummary}
                  </p>
                ) : null}

                {routeBullets.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {routeBullets.slice(0, 3).map((bullet) => (
                      <span
                        key={bullet}
                        className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold text-white/70"
                      >
                        {bullet}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {hasRoute ? (
              <ol className="mt-3 max-h-36 space-y-1.5 overflow-y-auto">
                {route?.map((stop, i) => (
                  <li
                    key={i}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-2.5 py-2"
                  >
                    <a
                      href={stop.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 text-blue-300"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-black text-white">
                        {i + 1}
                      </span>
                      <span className="truncate">{stop.name}</span>
                    </a>

                    <button
                      onClick={() => handleModifyStop(stop, i)}
                      className="shrink-0 rounded-full px-1.5 text-sm text-red-400 hover:bg-red-500/10"
                      aria-label={`Modify ${stop.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                Generate a route to see your stops here.
              </p>
            )}

            {hasGeneratedRoute ? (
              <div className="mt-4 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
                  Flow Ready
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  {stopCount} stops • +{availableXp} XP
                </p>

                <p className="mt-0.5 text-[11px] text-white/55">
                  Start now, retry the route, or host it.
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onStartGeneratedFlow?.()
                      logEvent('generated_flow_started', {
                        metadata: { city, stops: stopCount },
                      })
                    }}
                    disabled={!onStartGeneratedFlow}
                    className="rounded-xl bg-indigo-500 px-3 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ▶ Start
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      logEvent('generated_route_retry_clicked', {
                        metadata: { city, stops: stopCount },
                      })
                      void handleGenerate()
                    }}
                    disabled={loading}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Retrying…' : 'Retry'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onHostGeneratedFlow?.()
                      logEvent('generated_flow_host_clicked', {
                        metadata: { city, stops: stopCount },
                      })
                    }}
                    disabled={!onHostGeneratedFlow}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Host
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
                Route Tools
              </p>

              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={handleSaveToCloud}
                  className="rounded-xl bg-blue-500 px-2 py-2.5 text-[11px] font-bold text-white hover:bg-blue-400"
                >
                  Save
                </button>

                <button
                  onClick={() => setShowFavoritesModal(true)}
                  className="rounded-xl bg-yellow-400 px-2 py-2.5 text-[11px] font-bold text-black hover:bg-yellow-300"
                >
                  Favorites
                </button>

                <button
                  onClick={() => setShowEventsModal(true)}
                  className="rounded-xl bg-fuchsia-600 px-2 py-2.5 text-[11px] font-bold text-white hover:bg-fuchsia-500"
                >
                  Events
                </button>

                <button
                  onClick={handleClearRoute}
                  disabled={!hasRoute && !hasGeneratedRoute}
                  className="rounded-xl border border-red-400/30 bg-red-500/10 px-2 py-2.5 text-[11px] font-bold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <ReplaceStopModal {...{ modalData, handleReplaceStop, handleRemoveStop, setModalData }} />
          <FavoritesModal show={showFavoritesModal} favorites={favorites} loading={loadingFavorites} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertFavoriteAt} onClose={() => setShowFavoritesModal(false)} />
          <EventsModal show={showEventsModal} interestedEvents={interestedEvents} loading={loadingEvents} route={route ?? []} city={city ?? 'atl'} onInsert={handleInsertEventAt} onClose={() => setShowEventsModal(false)} />
        </div>
      ) : (
        <div className="fixed bottom-3 left-3 z-[2000]">
          <button
            onClick={() => {
              setShowCrawlInfo(true)
              setPanelHidden(false)
            }}
            className="rounded-full bg-black/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
          >
            📋 Flow
          </button>
        </div>
      )}
    </>
  )
}