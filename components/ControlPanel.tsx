'use client'

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { logEvent } from '@/lib/logEvent'

interface ControlPanelProps {
  city: 'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la' | null
  onCityChange: (
    city: 'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la'
  ) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  searchPrompt: string
  setSearchPrompt: (prompt: string) => void
  selectedThemeId: string
  setSelectedThemeId: (themeId: string) => void
  selectedPrice: string
  setSelectedPrice: (price: string) => void
  travelMode: 'walking' | 'cycling' | 'driving'
  setTravelMode: (mode: 'walking' | 'cycling' | 'driving') => void
  tightness: 'tight' | 'medium' | 'loose'
  setTightness: (value: 'tight' | 'medium' | 'loose') => void
  crawlDate: string
  setCrawlDate: (date: string) => void
  crawlTime: string
  setCrawlTime: (time: string) => void
  markerDisplayMode: 'color' | 'emoji'
  setMarkerDisplayMode: (mode: 'color' | 'emoji') => void
  onGenerateRoute: (plannedStartAt?: string | Date) => void
  onClearRoute: () => void
  hasGeneratedRoute?: boolean
  generatedRouteStopCount?: number
  onStartGeneratedFlow?: () => void
  onHostGeneratedFlow?: () => void
}

const themes = [
  { id: 'creative-outlet', label: 'Creative Outlet' },
  { id: 'date-night', label: 'Date Night' },
  { id: 'friends-night-out', label: 'Friends Night Out' },
  { id: 'gameday-vibes', label: 'Gameday Vibes' },
  { id: 'lofi-loop', label: 'Lofi Loop' },
  { id: 'midday-recharge', label: 'Midday Recharge' },
  { id: 'morning-flow', label: 'Morning Flow' },
  { id: 'night-mode', label: 'Night Mode' },
  { id: 'pages-to-pours', label: 'Pages to Pours' },
  { id: 'post-work-wind-down', label: 'Post-Work Wind Down' },
  { id: 'solo-explorer', label: 'Solo Explorer' },
]

const prices = ['', '$', '$$', '$$$', '$$$$']

export function ControlPanel({
  city,
  onCityChange,
  searchTerm,
  setSearchTerm,
  searchPrompt,
  setSearchPrompt,
  selectedThemeId,
  setSelectedThemeId,
  selectedPrice,
  setSelectedPrice,
  travelMode,
  setTravelMode,
  tightness,
  setTightness,
  crawlDate,
  setCrawlDate,
  crawlTime,
  setCrawlTime,
  markerDisplayMode,
  setMarkerDisplayMode,
  onGenerateRoute,
  onClearRoute,
  hasGeneratedRoute = false,
  generatedRouteStopCount = 0,
  onStartGeneratedFlow,
  onHostGeneratedFlow,
}: ControlPanelProps) {
  const [isScheduled, setIsScheduled] = useState(false)
  const [flowReadyCollapsed, setFlowReadyCollapsed] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    if (!hasGeneratedRoute) {
      setFlowReadyCollapsed(false)
    }
  }, [hasGeneratedRoute])

  const showFlowReady = hasGeneratedRoute && !flowReadyCollapsed
  const showControlPanel = true

  const selectedThemeLabel =
    themes.find((theme) => theme.id === selectedThemeId)?.label ?? 'Pick vibe'

  const travelModeLabel =
    travelMode === 'walking' ? 'Walk' : travelMode === 'cycling' ? 'Bike' : 'Drive'

  const handleTravelModeChange = (val: string) => {
    if (!val) return
    setTravelMode(val as 'walking' | 'cycling' | 'driving')
    logEvent('travel_mode_changed', { metadata: { travel_mode: val, city } })
  }

  const handleMarkerDisplayModeChange = (val: string) => {
    if (!val) return
    setMarkerDisplayMode(val as 'color' | 'emoji')
    logEvent('marker_display_mode_changed', {
      metadata: { marker_display_mode: val, city },
    })
  }

  const handleGenerateClick = async () => {
    const plannedStartAt =
      isScheduled && crawlDate && crawlTime
        ? (() => {
            const [year, month, day] = crawlDate.split('-').map(Number)
            const [hour, minute] = crawlTime.split(':').map(Number)
            return new Date(year, month - 1, day, hour, minute).toISOString()
          })()
        : undefined

    setAdvancedOpen(false)
    setFlowReadyCollapsed(false)
    logEvent('generate_clicked', { metadata: { city, plannedStartAt } })
    onGenerateRoute(plannedStartAt)
  }

  const inputBase =
    'w-full h-9 px-2 border rounded-lg text-sm bg-white text-zinc-900 ' +
    'dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-600 ' +
    'focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <>
      {showFlowReady && (
        <div className="fixed left-3 right-3 bottom-[7.25rem] z-[4500] md:left-auto md:right-4 md:top-20 md:bottom-auto md:w-[440px]">
          <div className="rounded-2xl border border-indigo-500/40 bg-indigo-50/95 p-3 shadow-2xl backdrop-blur-md dark:bg-indigo-950/90">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  Flow Ready
                </p>

                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {generatedRouteStopCount} stops • +{generatedRouteStopCount * 25 + 100} XP available
                </p>

                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Start this route, retry it, or publish it as a crawl.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFlowReadyCollapsed(true)
                  logEvent('flow_ready_collapsed', {
                    metadata: { city, stops: generatedRouteStopCount },
                  })
                }}
                className="rounded-full border border-indigo-500/30 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                aria-label="Close Flow Ready panel"
              >
                ×
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button
                className="h-9 text-xs bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => {
                  onStartGeneratedFlow?.()
                  logEvent('generated_flow_started', {
                    metadata: { city, stops: generatedRouteStopCount },
                  })
                }}
              >
                ▶ Start
              </Button>

              <Button
                variant="outline"
                className="h-9 text-xs border-indigo-500 text-indigo-700 dark:text-indigo-300"
                onClick={() => {
                  logEvent('generated_route_retry_clicked', {
                    metadata: { city, stops: generatedRouteStopCount },
                  })
                  void handleGenerateClick()
                }}
              >
                Retry
              </Button>

              <Button
                variant="outline"
                className="h-9 text-xs border-indigo-500 text-indigo-700 dark:text-indigo-300"
                onClick={() => {
                  onHostGeneratedFlow?.()
                  logEvent('generated_flow_host_clicked', {
                    metadata: { city, stops: generatedRouteStopCount },
                  })
                }}
              >
                Host
              </Button>
            </div>
          </div>
        </div>
      )}

      {showControlPanel && (
        <div className="fixed left-1/2 bottom-5 z-[4000] w-[min(92vw,420px)] -translate-x-1/2 md:w-[720px]">
          <div className="rounded-2xl border border-zinc-300 bg-white/95 p-3 text-xs shadow-2xl backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95">
            <div className="grid grid-cols-[1fr_88px] gap-2 md:grid-cols-[1.2fr_120px_120px]">
              <select
                value={selectedThemeId}
                onChange={(e) => {
                  setSelectedThemeId(e.target.value)
                  logEvent('theme_selected', {
                    metadata: { themeId: e.target.value, city },
                  })
                }}
                className={inputBase}
                aria-label="Theme"
              >
                <option value="">Pick vibe</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </select>

              <select
                value={travelMode}
                onChange={(e) => handleTravelModeChange(e.target.value)}
                className={inputBase}
                aria-label="Travel mode"
              >
                <option value="walking">🚶 Walk</option>
                <option value="cycling">🚲 Bike</option>
                <option value="driving">🚗 Drive</option>
              </select>

              <Button
                className="col-span-2 h-9 text-xs bg-blue-600 text-white hover:bg-blue-700 md:col-span-1"
                onClick={handleGenerateClick}
              >
                Generate
              </Button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdvancedOpen((prev) => !prev)
                  logEvent('control_panel_advanced_toggled', {
                    metadata: { city, open: !advancedOpen },
                  })
                }}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {advancedOpen ? 'Hide filters' : 'Filters'}
              </button>

              <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {selectedThemeId ? selectedThemeLabel : 'Free explore'} · {travelModeLabel} · {tightness}
              </div>
            </div>

            {advancedOpen && (
              <div className="mt-3 grid max-h-[36vh] grid-cols-2 gap-2 overflow-y-auto border-t border-zinc-200 pt-3 dark:border-zinc-800 md:max-h-[44vh] md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Search
                  </Label>
                  <input
                    type="text"
                    placeholder="search..."
                    value={searchTerm}
                    onChange={(e) => {
                      const val = e.target.value
                      setSearchTerm(val)
                      logEvent('search_updated', { metadata: { value: val } })
                    }}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Price
                  </Label>
                  <select
                    value={selectedPrice}
                    onChange={(e) => {
                      setSelectedPrice(e.target.value)
                      logEvent('price_selected', {
                        metadata: { price: e.target.value, city },
                      })
                    }}
                    className={inputBase}
                  >
                    <option value="">Any</option>
                    {prices.slice(1).map((price) => (
                      <option key={price} value={price}>
                        {price}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Distance
                  </Label>
                  <select
                    value={tightness}
                    onChange={(e) => {
                      setTightness(e.target.value as any)
                      logEvent('tightness_changed', {
                        metadata: { tightness: e.target.value, city },
                      })
                    }}
                    className={inputBase}
                  >
                    <option value="tight">Compact</option>
                    <option value="medium">Balanced</option>
                    <option value="loose">Spread Out</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Marker
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={markerDisplayMode}
                    onValueChange={handleMarkerDisplayModeChange}
                    className="w-full gap-1"
                  >
                    <ToggleGroupItem
                      value="color"
                      className="h-9 flex-1 text-xs dark:bg-zinc-800 dark:text-white border dark:border-zinc-600"
                    >
                      Color
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="emoji"
                      className="h-9 flex-1 text-xs dark:bg-zinc-800 dark:text-white border dark:border-zinc-600"
                    >
                      Emoji
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Crawl
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={isScheduled ? 'scheduled' : 'now'}
                    onValueChange={(val) => {
                      if (!val) return
                      setIsScheduled(val === 'scheduled')
                      logEvent('crawl_mode_toggled', {
                        metadata: { mode: val, city },
                      })
                    }}
                    className="w-full gap-1"
                  >
                    <ToggleGroupItem
                      value="now"
                      className="h-9 flex-1 text-xs dark:bg-zinc-800 dark:text-white border dark:border-zinc-600"
                    >
                      Now
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="scheduled"
                      className="h-9 flex-1 text-xs dark:bg-zinc-800 dark:text-white border dark:border-zinc-600"
                    >
                      Later
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {isScheduled && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Date
                      </Label>
                      <input
                        type="date"
                        value={crawlDate}
                        onChange={(e) => {
                          setCrawlDate(e.target.value)
                          logEvent('crawl_date_selected', {
                            metadata: { date: e.target.value, city },
                          })
                        }}
                        className={inputBase}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Time
                      </Label>
                      <input
                        type="time"
                        value={crawlTime}
                        onChange={(e) => {
                          setCrawlTime(e.target.value)
                          logEvent('crawl_time_selected', {
                            metadata: { time: e.target.value, city },
                          })
                        }}
                        className={inputBase}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Route
                  </Label>
                  <Button
                    variant="outline"
                    className="h-9 w-full text-xs border border-zinc-500 dark:border-zinc-600 dark:text-zinc-100"
                    onClick={() => {
                      onClearRoute()
                      logEvent('route_cleared', { metadata: { city } })
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}