'use client'

import { CITY_CONFIGS } from '@/config/cities'

type Props = {
  selectedCity: string | null
  onSelectCity: (city: string | null) => void
  panelOpen?: boolean
}

export default function CitySelector({
  selectedCity,
  onSelectCity,
  panelOpen = false,
}: Props) {
  const cities = Object.entries(CITY_CONFIGS)

  return (
    <div
      className={`
        fixed left-1/2 z-[3900] -translate-x-1/2
        ${
          panelOpen
            ? 'bottom-[calc(env(safe-area-inset-bottom)+11.5rem)]'
            : 'bottom-[calc(env(safe-area-inset-bottom)+3.25rem)]'
        }
        w-[min(calc(100vw-1.5rem),420px)]
        rounded-2xl border border-neutral-700
        bg-neutral-900/90 px-3 py-2
        shadow-2xl backdrop-blur-md
        transition-all duration-200
      `}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          City
        </span>

        <button
          onClick={() => onSelectCity(null)}
          className={`
            rounded-full px-2.5 py-1 text-xs transition
            ${
              selectedCity === null
                ? 'bg-white text-black font-semibold'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }
          `}
        >
          All
        </button>
      </div>

      <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {cities.map(([slug, city]) => {
          const isActive = slug === selectedCity

          return (
            <button
              key={slug}
              onClick={() => onSelectCity(slug)}
              className={`
                shrink-0 rounded-full px-3 py-1.5 text-sm transition
                ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }
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