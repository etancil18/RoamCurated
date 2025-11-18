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
}

const themes = [
  { id: 'cheap-cheerful', label: 'Cheap & Cheerful' },
  { id: 'chill-hang', label: 'Chill Hang' },
  { id: 'creative-kickstart', label: 'Creative Kickstart' },
  { id: 'date-night', label: 'Date Night' },
  { id: 'friends-night-out', label: 'Friends Night Out' },
  { id: 'gallery-crawl', label: 'Gallery Crawl' },
  { id: 'last-call', label: 'Last Call' },
  { id: 'midday-recharge', label: 'Midday Recharge' },
  { id: 'mindful-mornings', label: 'Mindful Mornings' },
  { id: 'pages-to-pours', label: 'Pages to Pours' },
  { id: 'party-time', label: 'Party Time' },
  { id: 'patio-perfection', label: 'Patio Perfection' },
  { id: 'post-work-wind-down', label: 'Post-Work Wind Down' },
  { id: 'saturday-surge', label: 'Saturday Surge' },
  { id: 'self-care', label: 'Self-Care' },
  { id: 'solo-explorer', label: 'Solo Explorer' },
  { id: 'sunrise-start', label: 'Sunrise Start' },
  { id: 'sunset-lovers', label: 'Sunset Lovers' },
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
}: ControlPanelProps) {
  const handleTravelModeChange = (val: string) => {
    if (val) {
      setTravelMode(val as 'walking' | 'cycling' | 'driving')
    }
  }

  return (
    <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow p-4 w-72 space-y-4">
      {/* 🌆 City toggle */}
      <div className="flex gap-2">
        <Button
          variant={city === 'atl' ? 'default' : 'outline'}
          onClick={() => onCityChange('atl')}
        >
          ATL
        </Button>
        <Button
          variant={city === 'nyc' ? 'default' : 'outline'}
          onClick={() => onCityChange('nyc')}
        >
          NYC
        </Button>
      </div>

      {/* 🚦 Travel mode */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Mode</Label>
        <ToggleGroup
          type="single"
          value={travelMode}
          onValueChange={handleTravelModeChange}
          className="w-full justify-between"
        >
          <ToggleGroupItem value="walking" className="flex-1 text-center">Walk</ToggleGroupItem>
          <ToggleGroupItem value="cycling" className="flex-1 text-center">Bike</ToggleGroupItem>
          <ToggleGroupItem value="driving" className="flex-1 text-center">Drive</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 🔍 Search */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Search</Label>
        <input
          type="text"
          placeholder="Search vibe or tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 border rounded"
        />
      </div>

      {/* 🎨 Theme */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Theme</Label>
        <select
          value={selectedThemeId}
          onChange={(e) => setSelectedThemeId(e.target.value)}
          className="w-full px-2 py-1 border rounded"
        >
          <option value="">Select Theme</option>
          {themes.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {/* 💰 Price */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Price</Label>
        <select
          value={selectedPrice}
          onChange={(e) => setSelectedPrice(e.target.value)}
          className="w-full px-2 py-1 border rounded"
        >
          <option value="">Any Price</option>
          {prices.slice(1).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* 📏 Route Distance */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Route Tightness</Label>
        <select
          value={tightness}
          onChange={(e) => setTightness(e.target.value as 'tight' | 'medium' | 'loose')}
          className="w-full px-2 py-1 border rounded"
        >
          <option value="tight">Compact (Walkable)</option>
          <option value="medium">Balanced</option>
          <option value="loose">Spread Out (Explore More)</option>
        </select>
      </div>

      {/* ⚙️ Actions */}
      <div className="space-y-2 pt-2">
        <Button className="w-full" onClick={onGenerateRoute}>
          Generate Crawl
        </Button>
        <Button variant="outline" className="w-full" onClick={onClearRoute}>
          Clear Route
        </Button>
      </div>
    </div>
  )
}
