'use client'

import { useMemo } from 'react'

import { CITY_CONFIGS } from '@/config/cities'
import type { CitySlug } from '@/lib/maps/mapTypes'

type Props = {
  selectedCity: CitySlug | null
  onSelectCity: (city: CitySlug | null) => void
  panelOpen?: boolean
}

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0
    )
    .join(' ')
}

export default function CitySelector({
  selectedCity,
  onSelectCity,
  panelOpen = false,
}: Props) {
  const cities = useMemo(
    () =>
      Object.entries(CITY_CONFIGS) as Array<
        [CitySlug, (typeof CITY_CONFIGS)[CitySlug]]
      >,
    []
  )

  return (
    <section
      aria-label="Choose a city"
      className={joinClassNames(
        `
          pointer-events-auto
          fixed
          left-1/2
          z-[1000]
          w-[min(calc(100vw-1.5rem),460px)]
          -translate-x-1/2
          rounded-[24px]
          border
          border-white/10
          bg-zinc-950/88
          px-3
          py-3
          text-white
          shadow-[0_20px_70px_rgba(0,0,0,0.48)]
          backdrop-blur-2xl
          transition-[bottom,transform,opacity]
          duration-200
        `,
        panelOpen
          ? 'bottom-[calc(env(safe-area-inset-bottom)+11.5rem)]'
          : 'bottom-[calc(env(safe-area-inset-bottom)+3.25rem)]'
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Explore
          </p>

          <p className="truncate text-sm font-bold text-zinc-100">
            Choose a city
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectCity(null)}
          aria-pressed={selectedCity === null}
          className={joinClassNames(
            `
              shrink-0
              rounded-full
              border
              px-3
              py-1.5
              text-xs
              font-bold
              transition
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-cyan-300
              focus-visible:ring-offset-2
              focus-visible:ring-offset-zinc-950
            `,
            selectedCity === null
              ? `
                  border-white
                  bg-white
                  text-zinc-950
                  shadow-[0_6px_18px_rgba(255,255,255,0.12)]
                `
              : `
                  border-white/10
                  bg-white/[0.055]
                  text-zinc-300
                  hover:border-white/20
                  hover:bg-white/10
                  hover:text-white
                `
          )}
        >
          All cities
        </button>
      </div>

      <div
        role="list"
        aria-label="Available cities"
        className="
          -mx-1
          flex
          max-w-full
          gap-2
          overflow-x-auto
          px-1
          pb-1
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {cities.map(([slug, city]) => {
          const isActive = slug === selectedCity

          return (
            <button
              key={slug}
              type="button"
              role="listitem"
              onClick={() => onSelectCity(slug)}
              aria-pressed={isActive}
              className={joinClassNames(
                `
                  relative
                  shrink-0
                  rounded-full
                  border
                  px-3.5
                  py-2
                  text-sm
                  font-bold
                  transition
                  duration-150
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-cyan-300
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-zinc-950
                `,
                isActive
                  ? `
                      border-cyan-300/40
                      bg-cyan-300/15
                      text-cyan-100
                      shadow-[0_0_22px_rgba(34,211,238,0.12)]
                    `
                  : `
                      border-white/10
                      bg-white/[0.055]
                      text-zinc-300
                      hover:border-white/20
                      hover:bg-white/10
                      hover:text-white
                    `
              )}
            >
              {city.name}

              {isActive && (
                <span
                  aria-hidden="true"
                  className="
                    absolute
                    bottom-1
                    left-1/2
                    h-1
                    w-1
                    -translate-x-1/2
                    rounded-full
                    bg-cyan-300
                    shadow-[0_0_8px_rgba(34,211,238,0.9)]
                  "
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}