'use client'

import type { Venue } from '@/types/venue'
import type { InterestedEvent } from '@/hooks/useInterestedEvents'
import React from 'react'

export type EventsModalProps = {
  show: boolean
  interestedEvents: (InterestedEvent | null | undefined)[]
  loading: boolean
  route: Venue[]
  city: 'atl' | 'nyc'
  onInsert: (venue: Venue, index: number) => void
  onClose: () => void
}

export default function EventsModal({
  show,
  interestedEvents,
  loading,
  route,
  city,
  onInsert,
  onClose,
}: EventsModalProps) {
  if (!show) return null

  // ✅ Filter: keep valid events, even if venue data is incomplete
  const filtered = (interestedEvents ?? [])
    .filter((e): e is InterestedEvent => !!e)
    .filter((e) => !e.venue || e.venue.city === city)

  return (
    <div className="absolute bottom-24 left-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3 w-72 z-[2100] overflow-y-auto max-h-[70vh]">
      <p className="font-semibold mb-2 text-gray-800">Add stop from your interested events</p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading interested events…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No interested events yet.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((ev, idx) => {
            const v0 = ev.venue

            // ✅ Create a fallback venue object if missing
            const v: Venue = {
              id: v0?.id ?? `temp-${idx}`,
              name: v0?.name ?? 'Unknown Venue',
              slug: v0?.slug ?? `temp-${idx}`,
              lat: v0?.lat ?? 0,
              lon: v0?.lon ?? 0,
              city: v0?.city ?? city,
              cover: v0?.cover ?? undefined,
              link: v0?.slug ? `/venue/${v0.slug}` : '#',
            }

            const alreadyInCrawl = route.some((r) => r.slug === v.slug)

            return (
              <li key={idx} className="border border-gray-200 rounded p-2">
                <p className="font-semibold text-sm text-gray-800">
                  {ev.title || 'Untitled Event'}
                </p>
                <p className="text-xs text-gray-500 mb-1">{v.name}</p>

                {alreadyInCrawl ? (
                  <p className="text-xs italic text-gray-500 mt-1">
                    Already in crawl
                  </p>
                ) : route.length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {route.map((stop, i) => (
                      <div key={i} className="flex gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => onInsert(v, i)}
                        >
                          ➕ Before {stop.name}
                        </button>
                        <button
                          className="text-xs text-green-600 hover:underline"
                          onClick={() => onInsert(v, i + 1)}
                        >
                          ➕ After {stop.name}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    No crawl generated yet.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <button
        className="w-full py-1 mt-4 rounded border border-gray-400 hover:bg-gray-50"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  )
}
