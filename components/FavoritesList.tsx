'use client'

import React from 'react'
import type { CombinedFavorite } from '@/types/ui'
import SavedCrawlsList from './SavedCrawlsList'
import { getEmojiForType } from '@/utils/emoji'
import { useRouter } from 'next/navigation'
import { useRouteStore } from '@/lib/store/routeStore'
import { removeFavoriteAction } from '@/app/favorites/actions'

export default function FavoritesList({
  favorites,
  onDeleteCrawl,
}: {
  favorites: CombinedFavorite[]
  onDeleteCrawl?: (routeId: string) => void
}) {
  const venues = favorites.filter((f) => f.type === 'venue')
  const routes = favorites.filter((f) => f.type === 'route')
  const router = useRouter()

  async function handleRemove(venueId: string) {
    const confirmed = confirm('Are you sure you want to remove this favorite?')
    if (!confirmed) return

    try {
      await removeFavoriteAction(venueId)
    } catch (err) {
      console.error('❌ Error removing favorite:', err)
      alert('Failed to remove favorite')
    }
  }

  return (
    <div className="space-y-10">
      {routes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">🗺️ Saved Crawls</h2>
          <SavedCrawlsList
            routes={routes.map((r) => r.record)}
            onDeleteRoute={onDeleteCrawl}
          />
        </section>
      )}

      {venues.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">⭐ Favorite Venues</h2>
          <ul className="grid md:grid-cols-2 gap-4">
            {venues.map((v) => (
              <li
                key={v.record.id}
                className="bg-white rounded-xl p-4 shadow border border-gray-200"
              >
                <h3 className="font-semibold">{v.data.name}</h3>
                <p className="text-xs text-gray-500">{v.record.city}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-lg">{getEmojiForType(v.data.type)}</span>
                  <span className="text-sm">{v.data.type ?? 'Unknown type'}</span>
                </div>

                <div className="mt-3 flex gap-3 flex-wrap text-xs">
                  <button
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                    onClick={() =>
                      router.push(`/venue-profile/${v.record.venue_id}`)
                    }
                  >
                    View Profile
                  </button>

                  <button
                    className="flex items-center gap-1 text-red-600 hover:underline"
                    onClick={() => handleRemove(v.record.venue_id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {favorites.length === 0 && (
        <p className="text-sm text-gray-500">You haven’t saved anything yet.</p>
      )}
    </div>
  )
}
