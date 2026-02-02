'use client'

import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { logEvent } from '@/lib/logEvent'

interface ControlPanelProps {
  city: 'atl' | 'nyc'
  onCityChange: (city: 'atl' | 'nyc') => void
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
}

const themes = [
  { id: 'active-all-day', label: 'Active All Day' },
  { id: 'beltline-explorer', label: 'BeltLine Explorer' },
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
  onGenerateRoute,
  onClearRoute,
}: ControlPanelProps) {
  const [isScheduled, setIsScheduled] = useState(false)

  const handleTravelModeChange = (val: string) => {
    if (!val) return
    setTravelMode(val as 'walking' | 'cycling' | 'driving')
    logEvent('travel_mode_changed', { metadata: { travel_mode: val, city } })
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

    logEvent('generate_clicked', { metadata: { city, plannedStartAt } })
    onGenerateRoute(plannedStartAt)
  }

  const inputBase =
    'w-full h-8 px-2 py-1 border rounded text-sm bg-white text-zinc-900 ' +
    'dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-600 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="w-full fixed top-0 left-0 z-[1000] bg-white dark:bg-zinc-950 border-b border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-center rounded-b-xl shadow-sm">
      <div className="flex gap-2">
        <Button variant={city === 'atl' ? 'default' : 'outline'} onClick={() => { onCityChange('atl'); logEvent('city_changed', { metadata: { city: 'atl' } }) }} className="h-8 text-sm dark:text-white">ATL</Button>
        <Button variant={city === 'nyc' ? 'default' : 'outline'} onClick={() => { onCityChange('nyc'); logEvent('city_changed', { metadata: { city: 'nyc' } }) }} className="h-8 text-sm dark:text-white">NYC</Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Mode</Label>
        <ToggleGroup type="single" value={travelMode} onValueChange={handleTravelModeChange} className="w-full gap-2">
          {['walking', 'cycling', 'driving'].map((m, i) => (
            <ToggleGroupItem key={m} value={m} className="flex-1 h-8 dark:bg-zinc-800 dark:text-white border dark:border-zinc-600">
              {['🚶', '🚲', '🚗'][i]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AI Prompt</Label>
        <input
          type="text"
          placeholder="What should we do right now?"
          value={searchPrompt}
          onChange={(e) => {
            setSearchPrompt(e.target.value);
            logEvent('prompt_updated', { metadata: { prompt: e.target.value, city } });
          }}
          className={inputBase}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Theme</Label>
        <select value={selectedThemeId} onChange={(e) => {
          setSelectedThemeId(e.target.value);
          logEvent('theme_selected', { metadata: { themeId: e.target.value, city } })
        }} className={inputBase}>
          <option value="">Select Theme</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Price</Label>
        <select value={selectedPrice} onChange={(e) => {
          setSelectedPrice(e.target.value);
          logEvent('price_selected', { metadata: { price: e.target.value, city } })
        }} className={inputBase}>
          <option value="">Any Price</option>
          {prices.slice(1).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Route Tightness</Label>
        <select value={tightness} onChange={(e) => {
          setTightness(e.target.value as any);
          logEvent('tightness_changed', { metadata: { tightness: e.target.value, city } })
        }} className={inputBase}>
          <option value="tight">Compact</option>
          <option value="medium">Balanced</option>
          <option value="loose">Spread Out</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Crawl Mode</Label>
        <ToggleGroup type="single" value={isScheduled ? 'scheduled' : 'now'} onValueChange={(val) => {
          setIsScheduled(val === 'scheduled');
          logEvent('crawl_mode_toggled', { metadata: { mode: val, city } })
        }} className="w-full gap-2">
          <ToggleGroupItem value="now" className="flex-1 h-8 dark:bg-zinc-800 dark:text-white border dark:border-zinc-600">Now</ToggleGroupItem>
          <ToggleGroupItem value="scheduled" className="flex-1 h-8 dark:bg-zinc-800 dark:text-white border dark:border-zinc-600">Scheduled</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isScheduled && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Crawl Date</Label>
          <input type="date" value={crawlDate} onChange={(e) => {
            setCrawlDate(e.target.value);
            logEvent('crawl_date_selected', { metadata: { date: e.target.value, city } })
          }} className={inputBase} />
        </div>
      )}

      {isScheduled && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Crawl Time</Label>
          <input type="time" value={crawlTime} onChange={(e) => {
            setCrawlTime(e.target.value);
            logEvent('crawl_time_selected', { metadata: { time: e.target.value, city } })
          }} className={inputBase} />
        </div>
      )}

      <div className="space-y-1 pt-1">
        <Button className="w-full h-8 text-sm border border-blue-500 bg-blue-600 text-white hover:bg-blue-700" onClick={handleGenerateClick}>Generate Crawl</Button>
        <Button variant="outline" className="w-full h-8 text-sm border border-zinc-500 dark:border-zinc-600 dark:text-zinc-100" onClick={() => {
          onClearRoute();
          logEvent('route_cleared', { metadata: { city } });
        }}>Clear Route</Button>
      </div>
    </div>
  )
}
