'use client'

import React from 'react'
import { Map, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getEmojiForType } from '@/utils/emoji'
import type { SavedRouteRecord } from '@/types/supabase'
import type { RouteStop } from '@/validators/favorite'
import { logVenueImpression } from '@/lib/logVenue'

type ParsedRoute = SavedRouteRecord & {
  stops: RouteStop[]
}

export default function SavedCrawlsList({
  routes,
  onDeleteRoute,
}: {
  routes: ParsedRoute[]
  onDeleteRoute?: (routeId: string) => void
}) {
  const router = useRouter()

  if (!routes.length) {
    return (
      <p className="text-sm text-gray-500">
        No saved crawls yet.
      </p>
    )
  }

  return (
    <ul className="w-full min-w-0 space-y-6">
      {routes.map((route) => (
        <li
          key={route.id}
          className="w-full min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow"
        >
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 break-words text-base font-semibold">
                🏷️ {route.name}
              </h3>

              <p className="mb-2 break-words text-xs text-gray-500">
                City: {route.city || 'Unknown'}
              </p>

              <ul className="min-w-0 space-y-1 text-sm">
                {route.stops.map((stop, i) => (
                  <li
                    key={i}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span className="shrink-0 text-lg">
                      {getEmojiForType((stop as any)?.type)}
                    </span>

                    <span className="min-w-0 break-words">
                      {(stop as any)?.name}
                    </span>

                    {(stop as any)?.type && (
                      <span className="shrink-0 text-xs italic text-gray-500">
                        {(stop as any).type}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {route.slug && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-left text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    route.stops.forEach((stop, index) => {
                      const venueId = (stop as any)?.id

                      if (!venueId) return

                      logVenueImpression(
                        'saved_crawl_clicked',
                        {
                          venue_id: venueId,
                          metadata: {
                            screen: 'saved_crawls_list',
                            city: route.city,
                            position_in_crawl: index,
                            crawl_id: route.id,
                          },
                        }
                      )
                    })

                    router.push(`/crawl/${route.slug}`)
                  }}
                >
                  <Map size={14} />
                  Load on Map
                </button>
              )}

              {onDeleteRoute && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-left text-xs text-red-600 hover:underline"
                  onClick={() => onDeleteRoute(route.id)}
                >
                  <Trash2 size={14} />
                  Delete Crawl
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}