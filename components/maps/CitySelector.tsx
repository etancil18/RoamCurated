'use client'

import { CITY_CONFIGS } from '@/config/cities'

type Props = {
  selectedCity: string | null
  onSelectCity: (city: string | null) => void
}

export default function CitySelector({
  selectedCity,
  onSelectCity,
}: Props) {
  const cities = Object.entries(CITY_CONFIGS)

  return (
    <div
      className="
        absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
        bg-neutral-900/90 backdrop-blur-md
        border border-neutral-700
        rounded-xl shadow-xl
        px-4 py-3
        max-w-screen w-[95%] sm:w-auto
        overflow-x-auto
      "
    >
      <div className="flex gap-2 items-center flex-nowrap min-w-max">
        <span className="text-sm text-neutral-400 whitespace-nowrap mr-2">
          Select a city:
        </span>

        {/* 🔁 All Cities Button */}
        <button
          onClick={() => onSelectCity(null)}
          className={`
            px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition
            ${selectedCity === null
              ? 'bg-white text-black font-semibold'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}
          `}
        >
          🗺️ All Cities
        </button>

        {/* 🔁 Per-City Buttons */}
        {cities.map(([slug, city]) => {
          const isActive = slug === selectedCity

          return (
            <button
              key={slug}
              onClick={() => onSelectCity(slug)}
              className={`
                px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition
                ${isActive
                  ? 'bg-white text-black font-semibold'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}
              `}
            >
              {city.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
