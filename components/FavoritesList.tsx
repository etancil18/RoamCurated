'use client'

import React from 'react'
import type { CombinedFavorite } from '@/types/ui'
import SavedCrawlsList from './SavedCrawlsList'
import { getEmojiForType } from '@/utils/emoji'
import { removeFavoriteAction } from '@/app/favorites/actions'
import { logVenueImpression } from '@/lib/logVenue'

export default function FavoritesList({
  favorites,
  onDeleteCrawl,
}: {
  favorites: CombinedFavorite[]
  onDeleteCrawl?: (routeId: string) => void
}) {
  const venues = favorites.filter((f) => f.type === 'venue')
  const routes = favorites.filter((f) => f.type === 'route')

  async function handleRemove(venueId: string) {
    const confirmed = confirm(
      'Are you sure you want to remove this favorite?'
    )

    if (!confirmed) return

    try {
      await removeFavoriteAction(venueId)
    } catch (err) {
      console.error('❌ Error removing favorite:', err)
      alert('Failed to remove favorite')
    }
  }

  return (
    <div className="w-full min-w-0 space-y-10 overflow-x-hidden">
      {routes.length > 0 && (
        <section className="w-full min-w-0">
          <h2 className="mb-2 break-words text-lg font-semibold">
            🚩 Saved Crawls
          </h2>

          <div className="w-full min-w-0 overflow-x-hidden">
            <SavedCrawlsList
              routes={routes.map((r) => r.record)}
              onDeleteRoute={onDeleteCrawl}
            />
          </div>
        </section>
      )}

      {venues.length > 0 && (
        <section className="w-full min-w-0">
          <h2 className="mb-2 break-words text-lg font-semibold">
            ⭐ Favorite Venues
          </h2>

          <ul className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {venues.map((v, index) => (
              <li
                key={v.record.id}
                className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow"
              >
                <h3 className="break-words font-semibold">
                  {v.data.name}
                </h3>

                <p className="break-words text-xs text-gray-500">
                  {v.record.city}
                </p>

                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-lg">
                    {getEmojiForType(v.data.type)}
                  </span>

                  <span className="min-w-0 break-words text-sm">
                    {v.data.type ?? 'Unknown type'}
                  </span>
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap gap-3 text-xs">
                  <a
                    href={`/venue-profile/${v.record.venue_id}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                    onClick={() => {
                      logVenueImpression(
                        'favorite_view_profile_click',
                        {
                          venue_id: v.record.venue_id,
                          metadata: {
                            screen: 'favorites_list',
                            city: v.record.city,
                            position_in_list: index,
                            name: v.data.name,
                          },
                        }
                      )
                    }}
                  >
                    View Profile
                  </a>

                  <button
                    type="button"
                    className="flex items-center gap-1 text-red-600 hover:underline"
                    onClick={() =>
                      handleRemove(v.record.venue_id)
                    }
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
        <p className="break-words text-sm text-gray-500">
          You haven’t saved anything yet.
        </p>
      )}
    </div>
  )
}