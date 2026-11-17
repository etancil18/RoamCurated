
'use client'

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type Props = {
  children: ReactNode
  label: string
  className?: string
}

export default function CreatorContentCarousel({
  children,
  label,
  className = '',
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  const slides = Children.toArray(children)

  const [activeIndex, setActiveIndex] = useState(0)
  const [canScrollPrevious, setCanScrollPrevious] =
    useState(false)
  const [canScrollNext, setCanScrollNext] =
    useState(false)

  const updatePosition = useCallback(() => {
    const track = trackRef.current

    if (!track) return

    const elements = Array.from(
      track.children,
    ) as HTMLElement[]

    if (elements.length === 0) {
      setActiveIndex(0)
      setCanScrollPrevious(false)
      setCanScrollNext(false)
      return
    }

    const trackLeft =
      track.getBoundingClientRect().left

    let closestIndex = 0
    let closestDistance = Infinity

    elements.forEach((element, index) => {
      const distance = Math.abs(
        element.getBoundingClientRect().left -
          trackLeft,
      )

      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    const maxScroll =
      track.scrollWidth - track.clientWidth

    setActiveIndex(closestIndex)
    setCanScrollPrevious(track.scrollLeft > 2)
    setCanScrollNext(
      track.scrollLeft < maxScroll - 2,
    )
  }, [])

  useEffect(() => {
    const track = trackRef.current

    if (!track) return

    updatePosition()

    const observer = new ResizeObserver(
      updatePosition,
    )

    observer.observe(track)

    Array.from(track.children).forEach(
      (element) => observer.observe(element),
    )

    return () => observer.disconnect()
  }, [updatePosition, slides.length])

  function scrollToIndex(index: number) {
    const track = trackRef.current

    if (!track) return

    const elements = Array.from(
      track.children,
    ) as HTMLElement[]

    const target = elements[index]

    if (!target) return

    const distance =
      target.getBoundingClientRect().left -
      track.getBoundingClientRect().left

    track.scrollTo({
      left: track.scrollLeft + distance,
      behavior: 'smooth',
    })
  }

  function scrollPrevious() {
    scrollToIndex(
      Math.max(0, activeIndex - 1),
    )
  }

  function scrollNext() {
    scrollToIndex(
      Math.min(
        slides.length - 1,
        activeIndex + 1,
      ),
    )
  }

  if (slides.length === 0) {
    return null
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        onScroll={updatePosition}
        className={[
          'flex min-w-0 gap-4',
          'overflow-x-auto overscroll-x-contain',
          'snap-x snap-mandatory scroll-smooth',
          'pb-3',
          '[scrollbar-width:none]',
          '[&::-webkit-scrollbar]:hidden',
        ].join(' ')}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
            className={[
              'min-w-0 shrink-0 snap-start',
              'w-[88%] sm:w-[calc(50%-0.5rem)]',
              'lg:w-[calc(50%-0.5rem)]',
            ].join(' ')}
          >
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-zinc-400">
              {activeIndex + 1}
              <span className="mx-1.5 text-zinc-600">
                /
              </span>
              {slides.length}
            </span>

            <span
              aria-hidden="true"
              className="hidden text-[11px] text-zinc-600 sm:inline"
            >
              Swipe to explore
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scrollPrevious}
              disabled={!canScrollPrevious}
              aria-label={`Previous ${label}`}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-zinc-300 transition hover:border-cyan-300/25 hover:bg-white/[0.09] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>

            <button
              type="button"
              onClick={scrollNext}
              disabled={!canScrollNext}
              aria-label={`Next ${label}`}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-zinc-300 transition hover:border-cyan-300/25 hover:bg-white/[0.09] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
