'use client'

import type { VenueProfileData } from '@/types/venue-profile'

type Props = {
  venue: VenueProfileData
}

export default function HeroBanner({ venue }: Props) {
  if (!venue.cover) return null

  return (
    <div className="relative h-64 md:h-72 w-full rounded-xl overflow-hidden shadow-md border border-gray-300 dark:border-gray-700">
      <img
        src={`/${venue.cover}`}
        alt={venue.name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

      {/* Title */}
      <div className="absolute bottom-0 p-5 text-white">
        <h1 className="text-2xl md:text-3xl font-bold">{venue.name}</h1>

        {venue.tags && venue.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {venue.tags.map((tag) => (
              <span
                key={tag}
                className="bg-white/20 text-xs px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
