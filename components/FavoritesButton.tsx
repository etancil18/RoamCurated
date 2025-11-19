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
    venue_id: venue.id, // MUST be a UUID string
    data: {
      name: venue.name,
      lat: Number(venue.lat),
      lon: Number(venue.lon),
      instagram_handle: typeof venue.instagram_handle === 'string' ? venue.instagram_handle : undefined,
      type: venue.type ?? undefined,
      image_url: typeof venue.cover === 'string' ? venue.cover : undefined,
      vibe_tags: typeof venue.vibe === 'string'
        ? venue.vibe.split(',').map((s: string) => s.trim())
        : undefined,
      price_tier: (() => {
        if (typeof venue.price === 'number') return venue.price;
        if (typeof venue.price === 'string') {
          const num = parseInt(venue.price.replace(/\$/g, '').trim(), 10);
          return isNaN(num) ? undefined : num;
        }
        return undefined;
      })(),
      city: venue.city ?? undefined,
    }
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
