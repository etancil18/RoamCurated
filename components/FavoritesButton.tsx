'use client'

import { useState } from 'react'
import { useUser } from '@/hooks/useUser'
import type { Venue } from '@/types/venue'

export function FavoritesButton({ venue }: { venue: Venue }) {
  const { user } = useUser()
  const [isFavoriting, setIsFavoriting] = useState(false)

  async function handleAddToFavorites() {
    if (!user) {
      alert('Please log in to add favorites.')
      return
    }

    if (!venue?.id || !venue?.slug) {
      console.warn('⚠️ Venue data missing:', venue)
      alert('Venue data is incomplete.')
      return
    }

    setIsFavoriting(true)

    try {
      // Build payload expected by /api/favorites/add (must match Zod schema)
      const payload = {
        slug: venue.slug,
        venue_id: venue.id, // ✅ REQUIRED for schema
        data: {
          name: venue.name,
          lat: Number(venue.lat),
          lon: Number(venue.lon),
          instagram_handle:
            typeof venue.instagram_handle === 'string'
              ? venue.instagram_handle
              : undefined,
          type: Array.isArray(venue.type)
            ? venue.type.join(', ')
            : venue.type ?? undefined,
          image_url:
            typeof venue.cover === 'string'
              ? venue.cover
              : undefined,
          vibe_tags:
            typeof venue.vibe === 'string'
              ? venue.vibe.split(',').map((s) => s.trim())
              : undefined,
          price_tier:
            typeof venue.price === 'number'
              ? venue.price
              : typeof venue.price === 'string'
              ? parseInt(venue.price.replace(/\$/g, ''), 10) || undefined
              : undefined,
          city: venue.city ?? undefined,
        },
      }

      console.log('📦 Sending favorite payload:', payload)

      const res = await fetch('/api/favorites/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text()
      console.log('📨 Server response:', text)

      if (!res.ok) {
        throw new Error(text || 'Unknown server error')
      }

      alert(`⭐ Added "${venue.name}" to favorites!`)
    } catch (err: any) {
      console.error('❌ Failed to add favorite:', err)
      alert('❌ Could not add to favorites: ' + err.message)
    } finally {
      setIsFavoriting(false)
    }
  }

  const isLoggedIn = !!user

  return (
    <button
      onClick={handleAddToFavorites}
      disabled={!isLoggedIn || isFavoriting}
      className="mt-2 w-full px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {isFavoriting
        ? 'Adding...'
        : isLoggedIn
        ? 'Add to Favorites'
        : 'Login to Favorite'}
    </button>
  )
}
