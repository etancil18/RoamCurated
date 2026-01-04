'use client'

import React from 'react'
import { Map, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getEmojiForType } from '@/utils/emoji'
import type { SavedRouteRecord } from '@/types/supabase'
import type { RouteStop } from '@/validators/favorite'
import { logVenueImpression } from '@/lib/logVenue'

type ParsedRoute = SavedRouteRecord & { stops: RouteStop[] }

export default function SavedCrawlsList({
  routes,
  onDeleteRoute,
}: {
  routes: ParsedRoute[]
  onDeleteRoute?: (routeId: string) => void
}) {
  const router = useRouter()

  if (!routes.length) {
    return <p className="text-sm text-gray-500">No saved crawls yet.</p>
  }

  return (
    <ul className="space-y-6">
      {routes.map((route) => (
        <li
          key={route.id}
          className="bg-white rounded-2xl shadow p-4 border border-gray-200"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-base mb-1">🏷️ {route.name}</h3>
              <p className="text-xs text-gray-500 mb-2">City: {route.city || 'Unknown'}</p>
              <ul className="space-y-1 text-sm">
                {route.stops.map((stop, i) => (
                  <li key={i} className="flex gap-2 items-center">
                    <span className="text-lg">{getEmojiForType((stop as any)?.type)}</span>
                    <span>{(stop as any)?.name}</span>
                    {(stop as any)?.type && (
                      <span className="text-xs italic text-gray-500">{(stop as any).type}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2 items-end">
              {route.slug && (
                <button
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={() => {
                    route.stops.forEach((stop, index) => {
                      const venueId = (stop as any)?.id
                      if (!venueId) return

                      logVenueImpression('saved_crawl_clicked', {
                        venue_id: venueId,
                        metadata: {
                          screen: 'saved_crawls_list',
                          city: route.city,
                          position_in_crawl: index,
                          crawl_id: route.id,
                        },
                      })
                    })
                    router.push(`/crawl/${route.slug}`)
                  }}
                >
                  <Map size={14} /> Load on Map
                </button>
              )}
              {onDeleteRoute && (
                <button
                  className="text-xs text-red-600 hover:underline flex items-center gap-1"
                  onClick={() => onDeleteRoute(route.id)}
                >
                  <Trash2 size={14} /> Delete Crawl
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
