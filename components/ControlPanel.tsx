'use client'

import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
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
  onGenerateRoute: (plannedStartAt?: string | Date) => void
  onClearRoute: () => void
  hasCustomStart: boolean
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
  searchTerm,
  setSearchTerm,
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
  onGenerateRoute,
  hasCustomStart,
}: ControlPanelProps) {
  const [isScheduled, setIsScheduled] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const selectedThemeLabel =
    themes.find((theme) => theme.id === selectedThemeId)?.label ??
    'Free explore'

  const travelModeLabel =
    travelMode === 'walking'
      ? 'Walk'
      : travelMode === 'cycling'
        ? 'Bike'
        : 'Drive'

  const tightnessLabel =
    tightness === 'tight'
      ? 'Compact'
      : tightness === 'loose'
        ? 'Spread out'
        : 'Balanced'

  const handleTravelModeChange = (val: string) => {
    if (!val) return

    setTravelMode(val as 'walking' | 'cycling' | 'driving')

    logEvent('travel_mode_changed', {
      metadata: {
        travel_mode: val,
        city,
      },
    })
  }

  const handleGenerateClick = async () => {
    if (!hasCustomStart) {
      logEvent('generate_blocked_missing_start', {
        metadata: {
          city,
          selectedThemeId,
        },
      })

      return
    }

    const plannedStartAt =
      isScheduled && crawlDate && crawlTime
        ? (() => {
            const [year, month, day] = crawlDate.split('-').map(Number)
            const [hour, minute] = crawlTime.split(':').map(Number)

            return new Date(
              year,
              month - 1,
              day,
              hour,
              minute
            ).toISOString()
          })()
        : undefined

    setAdvancedOpen(false)

    logEvent('generate_clicked', {
      metadata: {
        city,
        plannedStartAt,
      },
    })

    onGenerateRoute(plannedStartAt)
  }

  const inputBase =
    'h-11 w-full rounded-xl border border-white/10 bg-white/[0.07] px-3 text-sm ' +
    'font-medium text-white shadow-sm outline-none transition ' +
    'placeholder:text-zinc-500 hover:border-white/20 hover:bg-white/[0.09] ' +
    'focus:border-cyan-300/60 focus:bg-white/[0.1] focus:ring-2 focus:ring-cyan-300/20 ' +
    '[color-scheme:dark]'

  const labelBase =
    'text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500'

  const summaryPill =
    'inline-flex items-center rounded-full border border-white/8 bg-white/[0.055] ' +
    'px-2.5 py-1 text-[10px] font-semibold text-zinc-300'

  return (
    <div
      className="
        fixed
        bottom-[max(1rem,env(safe-area-inset-bottom))]
        left-1/2
        z-[4000]
        w-[min(calc(100vw-1.5rem),420px)]
        -translate-x-1/2
        md:w-[540px]
      "
    >
      <div
        className="
          overflow-hidden
          rounded-[26px]
          border
          border-white/10
          bg-zinc-950/88
          p-3
          text-xs
          text-white
          shadow-[0_24px_80px_rgba(0,0,0,0.55)]
          backdrop-blur-2xl
          md:p-4
        "
      >
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
          <div className="relative">
            <span
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                left-3.5
                top-1/2
                -translate-y-1/2
                text-zinc-500
              "
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.4-3.4" />
              </svg>
            </span>

            <input
              type="text"
              placeholder="Search places, vibes, food, music..."
              value={searchTerm}
              onChange={(event) => {
                const value = event.target.value

                setSearchTerm(value)

                logEvent('search_updated', {
                  metadata: {
                    value,
                    city,
                  },
                })
              }}
              className={`${inputBase} pl-10`}
              aria-label="Search venues"
            />
          </div>

          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls="roam-map-advanced-controls"
            onClick={() => {
              setAdvancedOpen((previous) => !previous)

              logEvent('control_panel_advanced_toggled', {
                metadata: {
                  city,
                  open: !advancedOpen,
                },
              })
            }}
            className="
              flex
              h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-white/10
              bg-white/[0.06]
              px-3
              text-xs
              font-bold
              text-zinc-200
              shadow-sm
              transition
              hover:border-white/20
              hover:bg-white/10
              hover:text-white
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-cyan-300
            "
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16" />
              <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
              <path d="M4 12h16" />
              <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
              <path d="M4 18h16" />
              <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
            </svg>

            {advancedOpen ? 'Hide' : 'Filters'}
          </button>
        </div>

        {advancedOpen && (
          <div
            id="roam-map-advanced-controls"
            className="animate-in fade-in slide-in-from-bottom-1 duration-200"
          >
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={summaryPill}>
                {selectedThemeLabel}
              </span>

              <span className={summaryPill}>
                {travelModeLabel}
              </span>

              <span className={summaryPill}>
                {tightnessLabel}
              </span>

              <span className={summaryPill}>
                {isScheduled ? 'Later' : 'Now'}
              </span>
            </div>

            <div
              className="
                mt-3
                grid
                max-h-[min(52dvh,430px)]
                grid-cols-2
                gap-3
                overflow-y-auto
                overscroll-contain
                border-t
                border-white/8
                pt-4
                [scrollbar-width:thin]
                [scrollbar-color:rgba(255,255,255,0.15)_transparent]
                md:grid-cols-4
              "
            >
              <div className="col-span-2 space-y-1.5 md:col-span-2">
                <Label className={labelBase}>
                  Theme
                </Label>

                <select
                  value={selectedThemeId}
                  onChange={(event) => {
                    setSelectedThemeId(event.target.value)

                    logEvent('theme_selected', {
                      metadata: {
                        themeId: event.target.value,
                        city,
                      },
                    })
                  }}
                  className={inputBase}
                  aria-label="Theme"
                >
                  <option value="">Pick vibe</option>

                  {themes.map((theme) => (
                    <option
                      key={theme.id}
                      value={theme.id}
                    >
                      {theme.label}
                    </option>
                  ))}
                </select>

                <div
                  id="theme-start-point-status"
                  role="status"
                  aria-live="polite"
                  className={`
                    rounded-xl
                    border
                    px-3
                    py-2.5
                    transition
                    ${
                      hasCustomStart
                        ? 'border-emerald-400/20 bg-emerald-400/10'
                        : 'border-amber-300/25 bg-amber-300/10'
                    }
                  `}
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 text-sm"
                    >
                      {hasCustomStart ? '✓' : '📍'}
                    </span>

                    <div>
                      <p
                        className={`
                          text-xs
                          font-bold
                          ${
                            hasCustomStart
                              ? 'text-emerald-200'
                              : 'text-amber-100'
                          }
                        `}
                      >
                        {hasCustomStart
                          ? 'Starting point selected'
                          : 'Drop a pin to continue'}
                      </p>

                      {!hasCustomStart && (
                        <p className="mt-0.5 text-[11px] leading-4 text-zinc-400">
                          Tap anywhere on the map to choose where your themed
                          route begins.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={labelBase}>
                  Mode
                </Label>

                <select
                  value={travelMode}
                  onChange={(event) =>
                    handleTravelModeChange(event.target.value)
                  }
                  className={inputBase}
                  aria-label="Travel mode"
                >
                  <option value="walking">Walk</option>
                  <option value="cycling">Bike</option>
                  <option value="driving">Drive</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className={labelBase}>
                  Route
                </Label>

                <Button
                  type="button"
                  onClick={handleGenerateClick}
                  disabled={!hasCustomStart}
                  aria-describedby="theme-start-point-status"
                  title={
                    hasCustomStart
                      ? 'Generate route'
                      : 'Drop a pin on the map first'
                  }
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border-0
                    bg-gradient-to-r
                    from-indigo-500
                    via-violet-500
                    to-cyan-500
                    px-3
                    text-xs
                    font-black
                    text-white
                    shadow-[0_10px_28px_rgba(34,211,238,0.18)]
                    transition
                    hover:brightness-110
                    disabled:cursor-not-allowed
                    disabled:from-zinc-700
                    disabled:via-zinc-700
                    disabled:to-zinc-700
                    disabled:text-zinc-400
                    disabled:shadow-none
                    disabled:hover:brightness-100
                    focus-visible:ring-2
                    focus-visible:ring-cyan-300
                    focus-visible:ring-offset-2
                    focus-visible:ring-offset-zinc-950
                  "
                >
                  {hasCustomStart ? 'Generate' : 'Drop Pin First'}
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className={labelBase}>
                  Price
                </Label>

                <select
                  value={selectedPrice}
                  onChange={(event) => {
                    setSelectedPrice(event.target.value)

                    logEvent('price_selected', {
                      metadata: {
                        price: event.target.value,
                        city,
                      },
                    })
                  }}
                  className={inputBase}
                  aria-label="Maximum price"
                >
                  <option value="">Any</option>

                  {prices.slice(1).map((price) => (
                    <option
                      key={price}
                      value={price}
                    >
                      {price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className={labelBase}>
                  Distance
                </Label>

                <select
                  value={tightness}
                  onChange={(event) => {
                    setTightness(
                      event.target.value as 'tight' | 'medium' | 'loose'
                    )

                    logEvent('tightness_changed', {
                      metadata: {
                        tightness: event.target.value,
                        city,
                      },
                    })
                  }}
                  className={inputBase}
                  aria-label="Route distance"
                >
                  <option value="tight">Compact</option>
                  <option value="medium">Balanced</option>
                  <option value="loose">Spread out</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1.5 md:col-span-2">
                <Label className={labelBase}>
                  When
                </Label>

                <ToggleGroup
                  type="single"
                  value={isScheduled ? 'scheduled' : 'now'}
                  onValueChange={(value) => {
                    if (!value) return

                    setIsScheduled(value === 'scheduled')

                    logEvent('crawl_mode_toggled', {
                      metadata: {
                        mode: value,
                        city,
                      },
                    })
                  }}
                  className="
                    grid
                    h-11
                    w-full
                    grid-cols-2
                    gap-1
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.045]
                    p-1
                  "
                >
                  <ToggleGroupItem
                    value="now"
                    className="
                      h-full
                      rounded-lg
                      border-0
                      text-xs
                      font-bold
                      text-zinc-400
                      transition
                      hover:bg-white/[0.07]
                      hover:text-white
                      data-[state=on]:bg-white
                      data-[state=on]:text-zinc-950
                      data-[state=on]:shadow-sm
                    "
                  >
                    Now
                  </ToggleGroupItem>

                  <ToggleGroupItem
                    value="scheduled"
                    className="
                      h-full
                      rounded-lg
                      border-0
                      text-xs
                      font-bold
                      text-zinc-400
                      transition
                      hover:bg-white/[0.07]
                      hover:text-white
                      data-[state=on]:bg-white
                      data-[state=on]:text-zinc-950
                      data-[state=on]:shadow-sm
                    "
                  >
                    Later
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {isScheduled && (
                <>
                  <div className="space-y-1.5">
                    <Label className={labelBase}>
                      Date
                    </Label>

                    <input
                      type="date"
                      value={crawlDate}
                      onChange={(event) =>
                        setCrawlDate(event.target.value)
                      }
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelBase}>
                      Time
                    </Label>

                    <input
                      type="time"
                      value={crawlTime}
                      onChange={(event) =>
                        setCrawlTime(event.target.value)
                      }
                      className={inputBase}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}