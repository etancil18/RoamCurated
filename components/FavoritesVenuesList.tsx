'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Tag } from 'lucide-react'
import { removeFavoriteAction } from '@/app/favorites/actions'
import type { FavoriteVenueData } from '@/validators/favorite'
import type { FavoriteRecord } from '@/types/supabase'
import { logVenueImpression } from '@/lib/logVenue' // ✅ LOGGING IMPORT

type FavoriteWithParsedData = FavoriteRecord & { data: FavoriteVenueData }

export default function FavoritesVenuesList({
  venues,
}: {
  venues: FavoriteWithParsedData[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleRemove(venueId: string) {
    const confirmDelete = confirm('Are you sure you want to remove this favorite?')
    if (!confirmDelete) return

    startTransition(async () => {
      try {
        await removeFavoriteAction(venueId)
        router.refresh()
      } catch (error) {
        console.error('❌ Failed to remove favorite:', error)
        alert('Something went wrong removing this favorite.')
      }
    })
  }

  if (!venues.length) {
    return <p className="text-sm text-gray-500">No favorited venues yet.</p>
  }

  return (
    <ul className="space-y-4">
      {venues.map((fav, index) => {
        const { name, lat, lon, type, image_url, vibe_tags } = fav.data

        if (!fav.data) {
          console.warn('⚠️ fav missing data:', fav)
          return null
        }

        return (
          <li
            key={fav.id}
            className="bg-white rounded-2xl shadow p-4 flex items-start gap-4 border border-gray-200"
          >
            <img
              src={
                image_url ||
                `https://maps.googleapis.com/maps/api/streetview?size=120x120&location=${lat},${lon}&key=YOUR_GOOGLE_MAPS_API_KEY`
              }
              alt={name}
              className="w-16 h-16 rounded-lg object-cover"
            />

            <div className="flex-1">
              <h3 className="font-semibold text-base">{name}</h3>
              <p className="text-sm text-gray-500 capitalize">
                {type || 'Unknown type'}
              </p>

              {vibe_tags?.length ? (
                <div className="flex gap-1 flex-wrap mt-1">
                  {vibe_tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                    >
                      <Tag size={12} /> {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex gap-3 flex-wrap">
                <button
                  className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                  onClick={() => {
                    // ✅ LOG VENUE IMPRESSION BEFORE NAVIGATING
                    logVenueImpression('favorite_profile_clicked', {
                      venue_id: fav.venue_id,
                      metadata: {
                        screen: 'favorites_list',
                        position_in_list: index,
                        name,
                      },
                    })

                    router.push(`/venue-profile/${fav.venue_id}`)
                  }}
                >
                  View Profile
                </button>

                <button
                  className={`text-xs flex items-center gap-1 ${
                    isPending
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-red-600 hover:underline'
                  }`}
                  onClick={() => handleRemove(fav.venue_id)}
                  disabled={isPending}
                >
                  <Trash2 size={14} /> {isPending ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
