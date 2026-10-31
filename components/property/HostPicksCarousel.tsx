
'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'

import type {
  VenueCardVM,
} from '@/lib/view-models/buildVenueCardVM'

type HostPicksCarouselProps = {
  venues: VenueCardVM[]
  citySlug: string
}

export default function HostPicksCarousel({
  venues,
  citySlug,
}: HostPicksCarouselProps) {
  const scrollerRef =
    useRef<HTMLDivElement>(null)

  const [activeIndex, setActiveIndex] =
    useState(0)

  const [showAll, setShowAll] =
    useState(false)

  const count = venues.length

  const updateActiveIndex =
    useCallback(() => {
      const scroller = scrollerRef.current

      if (!scroller) return

      const slides = Array.from(
        scroller.querySelectorAll<HTMLElement>(
          '[data-host-pick-slide]'
        )
      )

      if (!slides.length) return

      const viewportLeft =
        scroller.getBoundingClientRect().left

      let closestIndex = 0
      let closestDistance = Infinity

      slides.forEach((slide, index) => {
        const distance = Math.abs(
          slide.getBoundingClientRect().left -
          viewportLeft
        )

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      setActiveIndex(closestIndex)
    }, [])

  useEffect(() => {
    const scroller = scrollerRef.current

    if (!scroller) return

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateActiveIndex)
        : null

    observer?.observe(scroller)

    const slides =
      scroller.querySelectorAll<HTMLElement>(
        '[data-host-pick-slide]'
      )

    slides.forEach((slide) => {
      observer?.observe(slide)
    })

    updateActiveIndex()

    return () => {
      observer?.disconnect()
    }
  }, [count, updateActiveIndex])

  const goTo = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current

      if (!scroller) return

      const slides = Array.from(
        scroller.querySelectorAll<HTMLElement>(
          '[data-host-pick-slide]'
        )
      )

      const nextIndex = Math.max(
        0,
        Math.min(index, slides.length - 1)
      )

      const target = slides[nextIndex]

      if (!target) return

      const offset =
        target.offsetLeft - scroller.offsetLeft

      const reducedMotion =
        window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches

      scroller.scrollTo({
        left: offset,
        behavior: reducedMotion
          ? 'instant'
          : 'smooth',
      })

      setActiveIndex(nextIndex)
    },
    []
  )

  if (count === 0) {
    return null
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[#c5a57a]/20 bg-[#151a19] px-4 pb-5 pt-5 shadow-2xl shadow-black/20 sm:px-6 sm:pb-6 sm:pt-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(197,165,122,0.09),_transparent_58%)]"
        />

        <div className="relative">
          <div
            ref={scrollerRef}
            onScroll={updateActiveIndex}
            role="region"
            aria-label="Host Picks carousel"
            aria-roledescription="carousel"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                goTo(activeIndex + 1)
              }

              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                goTo(activeIndex - 1)
              }
            }}
            className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-6 outline-none scroll-smooth [scrollbar-color:#766248_transparent] [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-[#c5a57a] motion-reduce:scroll-auto sm:gap-5 sm:pr-8"
          >
            {venues.map((venue, index) => {
              const flowParams =
                new URLSearchParams({
                  city: citySlug,
                  venue: venue.id,
                  buildFlow: '1',
                })

              const buildFlowHref =
                `/?${flowParams.toString()}`

              return (
                <article
                  key={venue.id}
                  data-host-pick-slide
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${count}: ${venue.name}`}
                  className="group relative min-w-0 w-[87%] shrink-0 snap-start overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#101514] shadow-xl shadow-black/25 sm:w-[69%] lg:w-[calc(50%-0.625rem)]"
                >
                  <Link
                    href={venue.href}
                    aria-label={`Explore ${venue.name}`}
                    className="relative block aspect-[4/3] overflow-hidden bg-[#242824] sm:aspect-[5/4]"
                  >
                    <img
                      src={
                        venue.imageUrl ||
                        '/placeholder-venue.jpg'
                      }
                      alt={venue.name}
                      loading={
                        index === 0
                          ? 'eager'
                          : 'lazy'
                      }
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
                    />

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10"
                    />

                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-[#e7d0ac]/30 bg-[#101514]/85 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#f1dfc4] backdrop-blur-md">
                      <span
                        aria-hidden="true"
                        className="text-[#e7d0ac]"
                      >
                        ✦
                      </span>
                      Host Pick {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="font-serif text-[1.7rem] leading-tight tracking-tight text-white drop-shadow-md sm:text-[2rem]">
                        {venue.name}
                      </h3>
                    </div>
                  </Link>

                  <div className="flex h-[220px] flex-col p-4 sm:h-[230px] sm:p-5">
                    <div className="min-h-0 flex-1">
                      {venue.chips.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {venue.chips.slice(0, 3).map(
                            (chip) => (
                              <span
                                key={chip}
                                className="rounded-full border border-[#c5a57a]/20 bg-[#c5a57a]/[0.06] px-2.5 py-1 text-[10px] font-medium text-[#d7c6a9]"
                              >
                                {chip}
                              </span>
                            )
                          )}
                        </div>
                      )}

                      {venue.description ? (
                        <p className="line-clamp-3 text-sm leading-6 text-[#c9c7c1]">
                          {venue.description}
                        </p>
                      ) : (
                        <p className="text-sm leading-6 text-[#b9b5ac]">
                          A favorite selected for your stay.
                          Discover what makes it worth a visit.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <Link
                        href={venue.href}
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-[#c5a57a]/30 bg-[#c5a57a]/10 px-4 text-xs font-bold text-[#f1dfc4] transition hover:bg-[#c5a57a]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5a57a]"
                      >
                        Explore place ↗
                      </Link>

                      <Link
                        href={buildFlowHref}
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 px-4 text-xs font-bold text-white transition hover:from-indigo-500 hover:to-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                      >
                        Build a Flow →
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {count > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div
                aria-label={`Showing Host Pick ${activeIndex + 1} of ${count}`}
                className="flex max-w-full items-center gap-1.5"
              >
                {venues.map((venue, index) => (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => goTo(index)}
                    aria-label={`Go to Host Pick ${index + 1}: ${venue.name}`}
                    aria-current={
                      index === activeIndex
                        ? 'true'
                        : undefined
                    }
                    className={[
                      'h-1.5 rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5a57a]',
                      index === activeIndex
                        ? 'w-7 bg-[#c5a57a]'
                        : 'w-2.5 bg-[#c5a57a]/25 hover:bg-[#c5a57a]/60',
                    ].join(' ')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {count > 2 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() =>
              setShowAll((current) => !current)
            }
            aria-expanded={showAll}
            aria-controls="host-picks-all"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c5a57a]/25 bg-[#c5a57a]/[0.06] px-5 text-xs font-bold text-[#e7d0ac] transition hover:border-[#c5a57a]/50 hover:bg-[#c5a57a]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5a57a]"
          >
            {showAll
              ? 'Hide full shortlist'
              : `View all ${count} Host Picks`}
            <span aria-hidden="true">
              {showAll ? '↑' : '↓'}
            </span>
          </button>

          {showAll && (
            <div
              id="host-picks-all"
              className="grid gap-2 sm:grid-cols-2"
            >
              {venues.map((venue, index) => (
                <Link
                  key={venue.id}
                  href={venue.href}
                  className="group/list flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-[#c5a57a]/35 hover:bg-white/[0.06]"
                >
                  <img
                    src={
                      venue.imageUrl ||
                      '/placeholder-venue.jpg'
                    }
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#c5a57a]">
                      Pick {index + 1}
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {venue.name}
                    </p>
                  </div>

                  <span
                    aria-hidden="true"
                    className="text-[#c5a57a]"
                  >
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
