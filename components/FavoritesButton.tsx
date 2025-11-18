'use client'

import { useState } from 'react'
import type { Venue } from '@/types/venue'

export function FavoritesButton({ venue }: { venue: Venue }) {
  const [isFavoriting, setIsFavoriting] = useState(false)

  async function handleAddToFavorites() {
    console.log('🔍 Venue received in FavoritesButton:', venue)

    if (!venue || !venue.slug || !venue.id) {
      console.warn('⚠️ Venue is incomplete:', {
        hasVenue: !!venue,
        slug: venue?.slug,
        id: venue?.id,
      })
      alert('Venue data is incomplete or missing.')
      return
    }

    setIsFavoriting(true)

    try {
      const payload = {
  slug: venue.slug,
  venue_id: venue.id,
  data: {
    name: venue.name,
    lat: Number(venue.lat),
    lon: Number(venue.lon),
    instagram_handle: (venue as any).instagram_handle ?? null,
    type: (venue as any).type ?? undefined,
    image_url: (venue as any).image_url ?? null,
    vibe_tags: Array.isArray((venue as any).vibe_tags)
      ? (venue as any).vibe_tags
      : typeof (venue as any).vibe_tags === 'string'
      ? (venue as any).vibe_tags.split(',').map((s: string) => s.trim())
      : [],
    price_tier: typeof (venue as any).price_tier === 'number'
      ? (venue as any).price_tier
      : parseInt((venue as any).price_tier, 10) || undefined,
  },
}


      console.log('📦 Payload to be sent to /api/favorites/add:', payload)

      const res = await fetch('/api/favorites/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text()
      console.log('📨 Raw response text from /api/favorites/add:', text)

      if (!res.ok) {
        throw new Error(text || 'Unknown error')
      }

      alert(`⭐ Added "${venue.name}" to favorites`)
    } catch (err: any) {
      console.error('❌ Failed to add favorite:', err)
      alert('❌ Could not add to favorites: ' + err.message)
    } finally {
      setIsFavoriting(false)
    }
  }

  return (
    <button
      onClick={handleAddToFavorites}
      disabled={isFavoriting}
      className="mt-2 w-full px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {isFavoriting ? 'Adding...' : 'Add to Favorites'}
    </button>
  )
}
