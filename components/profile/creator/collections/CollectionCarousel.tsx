'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CollectionCarouselMedia = {
  id: string

  mediaType:
    | 'image'
    | 'video'

  url: string

  posterUrl:
    | string
    | null

  caption:
    | string
    | null

  altText:
    | string
    | null

  width:
    | number
    | null

  height:
    | number
    | null

  durationSeconds:
    | number
    | null
}

type Props = {
  media:
    CollectionCarouselMedia[]

  collectionTitle: string

  className?: string
}

/* =========================================================
 * Constants
 * ======================================================= */

const SWIPE_THRESHOLD_PX = 48

const SWIPE_DOMINANCE_RATIO = 1.15

/* =========================================================
 * Component
 * ======================================================= */

export default function CollectionCarousel({
  media,
  collectionTitle,
  className,
}: Props) {
  const normalizedMedia =
    normalizeCarouselMedia(
      media
    )

  const [activeIndex, setActiveIndex] =
    useState(0)

  const touchStartRef =
    useRef<{
      x: number
      y: number
    } | null>(null)

  const touchCurrentRef =
    useRef<{
      x: number
      y: number
    } | null>(null)

  const videoRefs =
    useRef<
      Map<
        string,
        HTMLVideoElement
      >
    >(
      new Map()
    )

  const headingId =
    useId()

  const slideCount =
    normalizedMedia.length

  const hasMultipleSlides =
    slideCount > 1

  /*
   * Keep the selected slide valid if the server-provided media
   * changes after navigation or a refresh.
   */
  useEffect(() => {
    setActiveIndex(
      (currentIndex) => {
        if (
          slideCount === 0
        ) {
          return 0
        }

        return Math.min(
          currentIndex,
          slideCount - 1
        )
      }
    )
  }, [
    slideCount,
  ])

  /*
   * Videos that are no longer active should never continue
   * playing in the background.
   */
  useEffect(() => {
    for (
      const [
        mediaId,
        video,
      ] of videoRefs.current
    ) {
      const activeMedia =
        normalizedMedia[
          activeIndex
        ]

      if (
        !activeMedia ||
        mediaId !==
          activeMedia.id
      ) {
        video.pause()
      }
    }
  }, [
    activeIndex,
    normalizedMedia,
  ])

  const goToSlide =
    useCallback(
      (
        nextIndex: number
      ) => {
        if (
          slideCount <= 0
        ) {
          return
        }

        const wrappedIndex =
          (
            nextIndex +
            slideCount
          ) %
          slideCount

        setActiveIndex(
          wrappedIndex
        )
      },
      [
        slideCount,
      ]
    )

  const goPrevious =
    useCallback(() => {
      goToSlide(
        activeIndex - 1
      )
    }, [
      activeIndex,
      goToSlide,
    ])

  const goNext =
    useCallback(() => {
      goToSlide(
        activeIndex + 1
      )
    }, [
      activeIndex,
      goToSlide,
    ])

  const handleKeyDown =
    useCallback(
      (
        event:
          React.KeyboardEvent<HTMLElement>
      ) => {
        if (
          !hasMultipleSlides
        ) {
          return
        }

        if (
          event.key ===
          'ArrowLeft'
        ) {
          event.preventDefault()
          goPrevious()
          return
        }

        if (
          event.key ===
          'ArrowRight'
        ) {
          event.preventDefault()
          goNext()
          return
        }

        if (
          event.key ===
          'Home'
        ) {
          event.preventDefault()
          goToSlide(0)
          return
        }

        if (
          event.key ===
          'End'
        ) {
          event.preventDefault()

          goToSlide(
            slideCount - 1
          )
        }
      },
      [
        goNext,
        goPrevious,
        goToSlide,
        hasMultipleSlides,
        slideCount,
      ]
    )

  const handleTouchStart =
    useCallback(
      (
        event:
          React.TouchEvent<HTMLElement>
      ) => {
        if (
          !hasMultipleSlides
        ) {
          return
        }

        const touch =
          event.touches[0]

        if (!touch) {
          return
        }

        const point = {
          x:
            touch.clientX,
          y:
            touch.clientY,
        }

        touchStartRef.current =
          point

        touchCurrentRef.current =
          point
      },
      [
        hasMultipleSlides,
      ]
    )

  const handleTouchMove =
    useCallback(
      (
        event:
          React.TouchEvent<HTMLElement>
      ) => {
        if (
          !hasMultipleSlides
        ) {
          return
        }

        const touch =
          event.touches[0]

        if (!touch) {
          return
        }

        touchCurrentRef.current =
          {
            x:
              touch.clientX,
            y:
              touch.clientY,
          }
      },
      [
        hasMultipleSlides,
      ]
    )

  const handleTouchEnd =
    useCallback(() => {
      if (
        !hasMultipleSlides
      ) {
        resetTouchTracking()
        return
      }

      const start =
        touchStartRef.current

      const end =
        touchCurrentRef.current

      resetTouchTracking()

      if (
        !start ||
        !end
      ) {
        return
      }

      const deltaX =
        end.x - start.x

      const deltaY =
        end.y - start.y

      const horizontalDistance =
        Math.abs(
          deltaX
        )

      const verticalDistance =
        Math.abs(
          deltaY
        )

      /*
       * Require a meaningful, predominantly horizontal gesture.
       * Vertical page scrolling should remain completely natural.
       */
      if (
        horizontalDistance <
          SWIPE_THRESHOLD_PX ||
        horizontalDistance <
          verticalDistance *
            SWIPE_DOMINANCE_RATIO
      ) {
        return
      }

      if (deltaX < 0) {
        goNext()
        return
      }

      goPrevious()
    }, [
      goNext,
      goPrevious,
      hasMultipleSlides,
    ])

  const resetTouchTracking =
    useCallback(() => {
      touchStartRef.current =
        null

      touchCurrentRef.current =
        null
    }, [])

  if (
    normalizedMedia.length ===
    0
  ) {
    return null
  }

  const activeMedia =
    normalizedMedia[
      activeIndex
    ] ??
    normalizedMedia[0]

  return (
    <section
      aria-labelledby={
        headingId
      }
      aria-roledescription="carousel"
      className={[
        'w-full min-w-0',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-3 flex min-w-0 items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Creator story
          </p>

          <h2
            id={headingId}
            className="mt-1 text-xl font-semibold text-white sm:text-2xl"
          >
            Photos & videos
          </h2>
        </div>

        {hasMultipleSlides ? (
          <p
            aria-live="polite"
            aria-atomic="true"
            className="shrink-0 text-xs font-medium tabular-nums text-neutral-500"
          >
            {(
              activeIndex + 1
            ).toLocaleString()}
            {' / '}
            {slideCount.toLocaleString()}
          </p>
        ) : null}
      </div>

      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${activeIndex + 1} of ${slideCount}`}
        tabIndex={
          hasMultipleSlides
            ? 0
            : undefined
        }
        onKeyDown={
          handleKeyDown
        }
        onTouchStart={
          handleTouchStart
        }
        onTouchMove={
          handleTouchMove
        }
        onTouchEnd={
          handleTouchEnd
        }
        onTouchCancel={
          resetTouchTracking
        }
        className={[
          'group/carousel relative min-w-0 overflow-hidden rounded-[2rem]',
          'border border-neutral-800/90 bg-neutral-950',
          'shadow-2xl shadow-black/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50',
        ].join(' ')}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-black sm:aspect-[16/10] lg:aspect-[16/9]">
          {normalizedMedia.map(
            (
              item,
              index
            ) => {
              const isActive =
                index ===
                activeIndex

              return (
                <CarouselSlide
                  key={
                    item.id
                  }
                  media={
                    item
                  }
                  collectionTitle={
                    collectionTitle
                  }
                  position={
                    index + 1
                  }
                  isActive={
                    isActive
                  }
                  videoRefs={
                    videoRefs
                  }
                />
              )
            }
          )}

          {hasMultipleSlides ? (
            <>
              <button
                type="button"
                onClick={
                  goPrevious
                }
                aria-label="Show previous media"
                className={[
                  'absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full',
                  'border border-white/15 bg-black/55 text-xl text-white shadow-lg backdrop-blur-md',
                  'transition hover:border-white/30 hover:bg-black/75',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  'sm:left-4',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="-translate-x-px"
                >
                  ‹
                </span>
              </button>

              <button
                type="button"
                onClick={
                  goNext
                }
                aria-label="Show next media"
                className={[
                  'absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full',
                  'border border-white/15 bg-black/55 text-xl text-white shadow-lg backdrop-blur-md',
                  'transition hover:border-white/30 hover:bg-black/75',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  'sm:right-4',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="translate-x-px"
                >
                  ›
                </span>
              </button>
            </>
          ) : null}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
          />

          {hasMultipleSlides ? (
            <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center px-16">
              <div className="flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
                {normalizedMedia.map(
                  (
                    item,
                    index
                  ) => {
                    const isActive =
                      index ===
                      activeIndex

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          goToSlide(
                            index
                          )
                        }
                        aria-label={`Show media ${index + 1} of ${slideCount}`}
                        aria-current={
                          isActive
                            ? 'true'
                            : undefined
                        }
                        className="flex h-5 w-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        <span
                          aria-hidden="true"
                          className={[
                            'block rounded-full transition-[width,background-color,opacity] duration-200 motion-reduce:transition-none',
                            isActive
                              ? 'h-1.5 w-5 bg-white'
                              : 'h-1.5 w-1.5 bg-white/45 hover:bg-white/75',
                          ].join(
                            ' '
                          )}
                        />
                      </button>
                    )
                  }
                )}
              </div>
            </div>
          ) : null}

          <span className="absolute right-3 top-3 z-20 inline-flex items-center rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md sm:right-4 sm:top-4">
            {activeMedia.mediaType ===
            'video'
              ? 'Video'
              : 'Photo'}
          </span>
        </div>

        {activeMedia.caption ? (
          <div className="border-t border-neutral-800/80 bg-neutral-950 px-4 py-4 sm:px-5">
            <p className="break-words text-sm leading-6 text-neutral-300">
              {
                activeMedia.caption
              }
            </p>
          </div>
        ) : null}
      </div>

      {hasMultipleSlides ? (
        <p className="mt-2 px-1 text-[11px] leading-5 text-neutral-600 sm:hidden">
          Swipe left or right to
          explore the collection.
        </p>
      ) : null}
    </section>
  )
}

/* =========================================================
 * Slide
 * ======================================================= */

function CarouselSlide({
  media,
  collectionTitle,
  position,
  isActive,
  videoRefs,
}: {
  media:
    CollectionCarouselMedia

  collectionTitle: string

  position: number

  isActive: boolean

  videoRefs:
    React.MutableRefObject<
      Map<
        string,
        HTMLVideoElement
      >
    >
}) {
  const altText =
    normalizeAltText(
      media.altText
    ) ??
    `${collectionTitle} photo ${position}`

  return (
    <div
      aria-hidden={
        !isActive
      }
      className={[
        'absolute inset-0',
        isActive
          ? 'z-10 opacity-100'
          : 'pointer-events-none z-0 opacity-0',
        'transition-opacity duration-300 motion-reduce:transition-none',
      ].join(' ')}
    >
      {media.mediaType ===
      'image' ? (
        <img
          src={media.url}
          alt={altText}
          loading={
            position === 1
              ? 'eager'
              : 'lazy'
          }
          decoding="async"
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      ) : (
        <video
          ref={(
            element
          ) => {
            if (element) {
              videoRefs.current.set(
                media.id,
                element
              )
              return
            }

            videoRefs.current.delete(
              media.id
            )
          }}
          src={
            isActive
              ? media.url
              : undefined
          }
          poster={
            media.posterUrl ??
            undefined
          }
          controls
          playsInline
          preload="metadata"
          aria-label={
            normalizeAltText(
              media.altText
            ) ??
            `${collectionTitle} video ${position}`
          }
          tabIndex={
            isActive
              ? 0
              : -1
          }
          className="h-full w-full bg-black object-contain"
        />
      )}
    </div>
  )
}

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizeCarouselMedia(
  media:
    CollectionCarouselMedia[]
): CollectionCarouselMedia[] {
  if (
    !Array.isArray(
      media
    )
  ) {
    return []
  }

  const byId =
    new Map<
      string,
      CollectionCarouselMedia
    >()

  for (
    const item of media
  ) {
    const normalized =
      normalizeCarouselMediaItem(
        item
      )

    if (
      !normalized ||
      byId.has(
        normalized.id
      )
    ) {
      continue
    }

    byId.set(
      normalized.id,
      normalized
    )
  }

  return [
    ...byId.values(),
  ]
}

function normalizeCarouselMediaItem(
  value: unknown
): CollectionCarouselMedia | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeRequiredText(
      value.id,
      200
    )

  const url =
    normalizePublicMediaUrl(
      value.url
    )

  const mediaType =
    value.mediaType ===
      'image' ||
    value.mediaType ===
      'video'
      ? value.mediaType
      : null

  if (
    !id ||
    !url ||
    !mediaType
  ) {
    return null
  }

  return {
    id,
    mediaType,
    url,

    posterUrl:
      normalizePublicMediaUrl(
        value.posterUrl
      ),

    caption:
      normalizeOptionalText(
        value.caption,
        1_000
      ),

    altText:
      normalizeOptionalText(
        value.altText,
        500
      ),

    width:
      normalizePositiveInteger(
        value.width
      ),

    height:
      normalizePositiveInteger(
        value.height
      ),

    durationSeconds:
      normalizeNonNegativeNumber(
        value.durationSeconds
      ),
  }
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeAltText(
  value: unknown
): string | null {
  return normalizeOptionalText(
    value,
    500
  )
}

function normalizeRequiredText(
  value: unknown,
  maximumLength: number
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.length >
      maximumLength
  ) {
    return null
  }

  return normalized
}

function normalizeOptionalText(
  value: unknown,
  maximumLength: number
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    maximumLength
  )
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return null
  }

  const normalized =
    Math.trunc(
      value
    )

  return normalized > 0
    ? normalized
    : null
}

function normalizeNonNegativeNumber(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < 0
  ) {
    return null
  }

  return value
}

function normalizePublicMediaUrl(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  try {
    const parsed =
      new URL(
        normalized
      )

    if (
      parsed.protocol !==
        'https:' &&
      parsed.protocol !==
        'http:'
    ) {
      return null
    }

    if (
      parsed.username ||
      parsed.password ||
      !parsed.hostname ||
      isPrivateOrLocalHostname(
        parsed.hostname
      )
    ) {
      return null
    }

    parsed.hash = ''

    return parsed.toString()
  } catch {
    return null
  }
}

function isPrivateOrLocalHostname(
  hostname: string
): boolean {
  const normalized =
    hostname
      .trim()
      .toLowerCase()
      .replace(
        /^\[|\]$/g,
        ''
      )
      .replace(
        /\.$/,
        ''
      )

  if (
    !normalized ||
    normalized ===
      'localhost' ||
    normalized.endsWith(
      '.localhost'
    ) ||
    normalized.endsWith(
      '.local'
    )
  ) {
    return true
  }

  if (
    /^10\./.test(
      normalized
    ) ||
    /^127\./.test(
      normalized
    ) ||
    /^169\.254\./.test(
      normalized
    ) ||
    /^192\.168\./.test(
      normalized
    ) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      normalized
    )
  ) {
    return true
  }

  if (
    normalized === '::1' ||
    normalized.startsWith(
      'fc'
    ) ||
    normalized.startsWith(
      'fd'
    ) ||
    normalized.startsWith(
      'fe80'
    )
  ) {
    return true
  }

  return false
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}