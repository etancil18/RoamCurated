'use client'

import React from 'react'
import type { Venue } from '@/types/venue'

interface FavoritesModalProps {
  show: boolean
  favorites: Venue[]
  loading: boolean
  route?: Venue[]
  city: 'atl' | 'nyc' | 'lisbon' | 'porto'
  onInsert: (venue: Venue, index: number) => void
  onClose: () => void
}

export default function FavoritesModal({
  show,
  favorites,
  loading,
  route,
  city,
  onInsert,
  onClose,
}: FavoritesModalProps) {
  if (!show) return null

  return (
    <div
      className="
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
      "
    >
      <p className="font-semibold mb-2 text-sm">
        Add stop from favorites
      </p>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading favorites…
        </p>
      ) : favorites.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No favorites found.
        </p>
      ) : (
        <ul className="space-y-3">
          {favorites
            .filter((f) => f.city === city)
            .map((fav, fIdx) => {
              const alreadyInCrawl = route?.some((v) => v.slug === fav.slug)

              return (
                <li
                  key={fIdx}
                  className="border border-gray-200 dark:border-zinc-700 rounded-lg p-2 bg-gray-50 dark:bg-zinc-800"
                >
                  <p className="font-semibold text-sm">
                    {fav.name}
                  </p>

                  {alreadyInCrawl ? (
                    <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-1">
                      Already in crawl
                    </p>
                  ) : route && route.length > 0 ? (
                    <div className="space-y-1 mt-2">
                      {route.map((stop, i) => (
                        <div key={i} className="flex flex-wrap gap-2">
                          <button
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={() => onInsert(fav, i)}
                          >
                            ➕ Before {stop.name}
                          </button>
                          <button
                            className="text-xs text-green-600 dark:text-green-400 hover:underline"
                            onClick={() => onInsert(fav, i + 1)}
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