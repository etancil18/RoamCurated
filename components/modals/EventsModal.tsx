'use client'

import type { Venue } from '@/types/venue'
import type { InterestedEvent } from '@/hooks/useInterestedEvents'
import React from 'react'

export type EventsModalProps = {
  show: boolean
  interestedEvents: (InterestedEvent | null | undefined)[]
  loading: boolean
  route: Venue[]
  city: 'atl' | 'nyc' | 'lisbon' | 'porto'
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

  const now = new Date()

  const filtered = (interestedEvents ?? [])
    .filter((e): e is InterestedEvent => !!e)
    .filter((e) => !e.venue || e.venue.city === city)
    .filter((e) => {
      if (!e.starts_at) return true
      const eventStart = new Date(e.starts_at)
      return eventStart >= now
    })

  return (
    <div className="
      fixed bottom-16 left-3 right-3
      max-w-md mx-auto
      bg-white dark:bg-zinc-900
      text-gray-900 dark:text-gray-100
      border border-gray-300 dark:border-zinc-700
      rounded-xl shadow-2xl
      p-3
      z-[2100]
      overflow-y-auto
      max-h-[75vh]
    ">
      <p className="font-semibold mb-2 text-sm">
        Add stop from your interested events
      </p>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading interested events…
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No current or upcoming interested events.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((ev, idx) => {
            const v0 = ev.venue

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

            const timeLabel = ev.starts_at
              ? new Date(ev.starts_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : null

            return (
              <li
                key={idx}
                className="border border-gray-200 dark:border-zinc-700 rounded-lg p-2 bg-gray-50 dark:bg-zinc-800"
              >
                <p className="font-semibold text-sm">
                  {ev.title || 'Untitled Event'}{' '}
                  {timeLabel && (
                    <span className="text-gray-500 dark:text-gray-400 font-normal">
                      ({timeLabel})
                    </span>
                  )}
                </p>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {v.name}
                </p>

                {alreadyInCrawl ? (
                  <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-1">
                    Already in crawl
                  </p>
                ) : route.length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {route.map((stop, i) => (
                      <div key={i} className="flex flex-wrap gap-2">
                        <button
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={() => onInsert(v, i)}
                        >
                          ➕ Before {stop.name}
                        </button>
                        <button
                          className="text-xs text-green-600 dark:text-green-400 hover:underline"
                          onClick={() => onInsert(v, i + 1)}
                        >
                          ➕ After {stop.name}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                    No crawl generated yet.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <button
        className="
          w-full py-1.5 mt-4 rounded-lg
          border border-gray-400 dark:border-zinc-600
          hover:bg-gray-100 dark:hover:bg-zinc-700
          text-sm
        "
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  )
}