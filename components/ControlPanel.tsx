'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ControlPanelProps {
  city: 'atl' | 'nyc'
  onCityChange: (city: 'atl' | 'nyc') => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedThemeId: string
  setSelectedThemeId: (themeId: string) => void
  selectedPrice: string
  setSelectedPrice: (price: string) => void
  travelMode: 'walking' | 'cycling' | 'driving'
  setTravelMode: (mode: 'walking' | 'cycling' | 'driving') => void
  tightness: 'tight' | 'medium' | 'loose'
  setTightness: (value: 'tight' | 'medium' | 'loose') => void
  onGenerateRoute: () => void
  onClearRoute: () => void
  showLiveEventsOnly: boolean
  setShowLiveEventsOnly: (val: boolean) => void
}

const themes = [
  { id: 'active-all-day', label: 'Active All Day' },
  { id: 'cheap-cheerful', label: 'Cheap & Cheerful' },
  { id: 'chill-hang', label: 'Chill Hang' },
  { id: 'creative-kickstart', label: 'Creative Kickstart' },
  { id: 'date-night', label: 'Date Night' },
  { id: 'december-crawl', label: 'December Crawl' },
  { id: 'friends-night-out', label: 'Friends Night Out' },
  { id: 'gallery-crawl', label: 'Gallery Crawl' },
  { id: 'last-call', label: 'Last Call' },
  { id: 'midday-recharge', label: 'Midday Recharge' },
  { id: 'mindful-mornings', label: 'Mindful Mornings' },
  { id: 'pages-to-pours', label: 'Pages to Pours' },
  { id: 'party-time', label: 'Party Time' },
  { id: 'post-work-wind-down', label: 'Post-Work Wind Down' },
  { id: 'saturday-surge', label: 'Saturday Surge' },
  { id: 'self-care', label: 'Self-Care' },
  { id: 'solo-explorer', label: 'Solo Explorer' },
  { id: 'sunrise-start', label: 'Sunrise Start' },
  { id: 'sunday-reset', label: 'Sunday Reset' },
  { id: 'work-session', label: 'Work Session' },
]

const prices = ['', '$', '$$', '$$$', '$$$$']

export function ControlPanel({
  city,
  onCityChange,
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
  onGenerateRoute,
  onClearRoute,
  showLiveEventsOnly,
  setShowLiveEventsOnly,
}: ControlPanelProps) {
  const handleTravelModeChange = (val: string) => {
    if (val) {
      setTravelMode(val as 'walking' | 'cycling' | 'driving')
    }
  }

  return (
    <div className="w-full fixed top-0 left-0 z-[1000] bg-white dark:bg-zinc-950 border-b border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-center rounded-b-xl shadow-sm">
      <div className="flex gap-2">
        <Button
          variant={city === 'atl' ? 'default' : 'outline'}
          onClick={() => onCityChange('atl')}
          className="h-8 text-sm"
        >
          ATL
        </Button>
        <Button
          variant={city === 'nyc' ? 'default' : 'outline'}
          onClick={() => onCityChange('nyc')}
          className="h-8 text-sm"
        >
          NYC
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Mode</Label>
        <ToggleGroup
          type="single"
          value={travelMode}
          onValueChange={handleTravelModeChange}
          className="w-full justify-between gap-2"
        >
          <ToggleGroupItem
            value="walking"
            className="flex-1 text-center border border-zinc-400 dark:border-zinc-600 rounded-md text-sm h-8 data-[state=on]:bg-blue-500 data-[state=on]:text-white"
          >
            🚶
          </ToggleGroupItem>
          <ToggleGroupItem
            value="cycling"
            className="flex-1 text-center border border-zinc-400 dark:border-zinc-600 rounded-md text-sm h-8 data-[state=on]:bg-blue-500 data-[state=on]:text-white"
          >
            🚲
          </ToggleGroupItem>
          <ToggleGroupItem
            value="driving"
            className="flex-1 text-center border border-zinc-400 dark:border-zinc-600 rounded-md text-sm h-8 data-[state=on]:bg-blue-500 data-[state=on]:text-white"
          >
            🚗
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Search</Label>
        <input
          type="text"
          placeholder="Search vibe or tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-8 px-2 py-1 border rounded text-sm bg-white text-black dark:bg-zinc-900 dark:text-white"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Theme</Label>
        <select
          value={selectedThemeId}
          onChange={(e) => setSelectedThemeId(e.target.value)}
          className="w-full h-8 px-2 py-1 border rounded text-sm bg-white text-black dark:bg-zinc-900 dark:text-white"
        >
          <option value="">Select Theme</option>
          {themes.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Price</Label>
        <select
          value={selectedPrice}
          onChange={(e) => setSelectedPrice(e.target.value)}
          className="w-full h-8 px-2 py-1 border rounded text-sm bg-white text-black dark:bg-zinc-900 dark:text-white"
        >
          <option value="">Any Price</option>
          {prices.slice(1).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Route Tightness</Label>
        <select
          value={tightness}
          onChange={(e) => setTightness(e.target.value as 'tight' | 'medium' | 'loose')}
          className="w-full h-8 px-2 py-1 border rounded text-sm bg-white text-black dark:bg-zinc-900 dark:text-white"
        >
          <option value="tight">Compact (Walkable)</option>
          <option value="medium">Balanced</option>
          <option value="loose">Spread Out (Explore More)</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Live Events Only</Label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLiveEventsOnly}
            onChange={(e) => setShowLiveEventsOnly(e.target.checked)}
          />
        </div>
      </div>

      <div className="space-y-1 pt-1">
        <Button className="w-full h-8 text-sm" onClick={onGenerateRoute}>
          Generate Crawl
        </Button>
        <Button variant="outline" className="w-full h-8 text-sm" onClick={onClearRoute}>
          Clear Route
        </Button>
      </div>
    </div>
  )
}
