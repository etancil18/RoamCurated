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
    <div className="absolute bottom-24 left-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3 w-72 z-[2100] overflow-y-auto max-h-[70vh]">
      <p className="font-semibold mb-2 text-gray-800">Add stop from favorites</p>
      {loading ? (
        <p className="text-sm text-gray-500">Loading favorites…</p>
      ) : favorites.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No favorites found.</p>
      ) : (
        <ul className="space-y-4">
          {favorites
            .filter((f) => f.city === city)
            .map((fav, fIdx) => {
              const alreadyInCrawl = route?.some((v) => v.slug === fav.slug)

              return (
                <li key={fIdx} className="border border-gray-200 rounded p-2">
                  <p className="font-semibold text-sm text-gray-800">{fav.name}</p>
                  {alreadyInCrawl ? (
                    <p className="text-xs italic text-gray-500 mt-1">
                      Already in crawl
                    </p>
                  ) : route && route.length > 0 ? (
                    <div className="space-y-1 mt-2">
                      {route.map((stop, i) => (
                        <div key={i} className="flex gap-2">
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => onInsert(fav, i)}
                          >
                            ➕ Before {stop.name}
                          </button>
                          <button
                            className="text-xs text-green-600 hover:underline"
                            onClick={() => onInsert(fav, i + 1)}
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
