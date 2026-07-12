'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import type { DateTime } from 'luxon'
import { DateTime as LuxonDateTime } from 'luxon'

import type { Venue } from '@/types/venue'
import { CITY_CONFIGS } from '@/config/cities'
import { FavoritesButton } from '@/components/FavoritesButton'
import { coverCandidates } from '@/utils/imageUtils'
import { isVenueOpenNow } from '@/utils/timeUtils'

export type VenuePreviewEvent = {
  id: string | number
  title: string
  starts_at: string
  ends_at?: string | null
}

type Props = {
  venue: Venue | null
  city: string | null
  nowForCity?: DateTime | null
  events?: readonly VenuePreviewEvent[]

  onClose: () => void

  /**
   * Flow generation remains owned by the parent.
   *
   * The callback may be synchronous or asynchronous.
   */
  onGenerateFlow?: (
    venue: Venue
  ) => void | Promise<void>

  isGeneratingFlow?: boolean
  generateFlowError?: string | null

  /**
   * Optional callback for analytics or selection synchronization before the
   * user navigates to the venue profile.
   */
  onViewVenue?: (venue: Venue) => void
}

type UpcomingEvent = {
  event: VenuePreviewEvent
  startsAt: DateTime
}

function formatListValue(
  value: unknown
): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        String(item).trim()
      )
      .filter(Boolean)
      .join(', ')
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ')
  }

  return ''
}

function getTodayHours(
  venue: Venue,
  nowForCity: DateTime
): string | null {
  if (!Array.isArray(venue.hours)) {
    return null
  }

  const today = nowForCity
    .setLocale('en-US')
    .toFormat('cccc')
    .toLowerCase()

  const match = venue.hours.find(
    (line: string) =>
      line
        .trim()
        .toLowerCase()
        .startsWith(today)
  )

  if (!match) {
    return null
  }

  const [, ...rest] = match.split(': ')

  return rest.join(': ').trim() || null
}

function getPrimaryImage(
  venue: Venue
): {
  primary: string | null
  fallback: string | null
} {
  const candidates =
    coverCandidates(venue)

  const fallback =
    candidates[0] ?? null

  const primary = venue.slug
    ? `/img/venues/${venue.slug}.jpg`
    : fallback

  return {
    primary,
    fallback:
      fallback &&
      fallback !== primary
        ? fallback
        : null,
  }
}

function getCityTimezone(
  city: string | null
): string {
  if (
    !city ||
    !(city in CITY_CONFIGS)
  ) {
    return 'UTC'
  }

  return (
    CITY_CONFIGS[
      city as keyof typeof CITY_CONFIGS
    ]?.timezone ?? 'UTC'
  )
}

export default function VenuePreviewSheet({
  venue,
  city,
  nowForCity = null,
  events = [],
  onClose,
  onGenerateFlow,
  isGeneratingFlow = false,
  generateFlowError = null,
  onViewVenue,
}: Props) {
  const titleId = useId()
  const descriptionId = useId()

  const [
    imageSource,
    setImageSource,
  ] = useState<string | null>(null)

  const [
    hasUsedImageFallback,
    setHasUsedImageFallback,
  ] = useState(false)

  const [
    localGenerating,
    setLocalGenerating,
  ] = useState(false)

  const [
    localGenerateError,
    setLocalGenerateError,
  ] = useState<string | null>(null)

  const timezone = useMemo(
    () => getCityTimezone(city),
    [city]
  )

  const resolvedNow = useMemo(
    () =>
      nowForCity ??
      LuxonDateTime.now().setZone(
        timezone
      ),
    [
      nowForCity,
      timezone,
    ]
  )

  const image = useMemo(
    () =>
      venue
        ? getPrimaryImage(venue)
        : {
            primary: null,
            fallback: null,
          },
    [venue]
  )

  useEffect(() => {
    setImageSource(image.primary)
    setHasUsedImageFallback(false)
    setLocalGenerateError(null)
    setLocalGenerating(false)
  }, [
    venue?.id,
    venue?.slug,
    image.primary,
  ])

  const isOpen = useMemo(
    () =>
      venue
        ? isVenueOpenNow(
            venue,
            resolvedNow
          )
        : false,
    [
      venue,
      resolvedNow,
    ]
  )

  const vibeLabel = useMemo(
    () =>
      venue
        ? formatListValue(
            venue.vibe
          )
        : '',
    [venue]
  )

  const typeLabel = useMemo(
    () =>
      venue
        ? formatListValue(
            venue.type
          )
        : '',
    [venue]
  )

  const todayHours = useMemo(
    () =>
      venue
        ? getTodayHours(
            venue,
            resolvedNow
          )
        : null,
    [
      venue,
      resolvedNow,
    ]
  )

  const upcomingEvents =
    useMemo<UpcomingEvent[]>(() => {
      const nowMillis =
        resolvedNow.toMillis()

      return events
        .map(
          (
            event
          ): UpcomingEvent | null => {
            const startsAt =
              LuxonDateTime.fromISO(
                event.starts_at,
                {
                  setZone: true,
                }
              ).setZone(timezone)

            if (!startsAt.isValid) {
              return null
            }

            return {
              event,
              startsAt,
            }
          }
        )
        .filter(
          (
            item
          ): item is UpcomingEvent => {
            if (item === null) {
              return false
            }

            return (
              item.startsAt.toMillis() >=
              nowMillis
            )
          }
        )
        .sort(
          (first, second) =>
            first.startsAt.toMillis() -
            second.startsAt.toMillis()
        )
        .slice(0, 3)
    }, [
      events,
      resolvedNow,
      timezone,
    ])

  if (!venue) {
    return null
  }

  const isGenerating =
    isGeneratingFlow ||
    localGenerating

  const resolvedGenerateError =
    generateFlowError ??
    localGenerateError

  const canGenerateFlow =
    Boolean(onGenerateFlow) &&
    !isGenerating

  const favoritableVenue =
    venue.id
      ? (venue as Venue & {
          id: string
        })
      : null

  const handleGenerateFlow =
    async () => {
      if (
        !onGenerateFlow ||
        isGenerating
      ) {
        return
      }

      setLocalGenerating(true)
      setLocalGenerateError(null)

      try {
        await onGenerateFlow(venue)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not build a Flow from this venue.'

        setLocalGenerateError(
          message
        )
      } finally {
        setLocalGenerating(false)
      }
    }

  return (
    <div
      className="
        pointer-events-none
        fixed
        inset-x-0
        bottom-0
        z-[1100]
        flex
        justify-center
        px-3
        pb-[max(0.75rem,env(safe-area-inset-bottom))]
        md:inset-x-auto
        md:right-4
        md:w-[380px]
        md:px-0
        md:pb-4
      "
    >
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={
          descriptionId
        }
        className="
          pointer-events-auto
          relative
          w-full
          max-w-lg
          overflow-hidden
          rounded-[24px]
          border
          border-white/10
          bg-zinc-950/[0.94]
          text-white
          shadow-[0_24px_80px_rgba(0,0,0,0.55)]
          backdrop-blur-2xl
          md:max-w-none
        "
      >
        <div
          className="
            flex
            justify-center
            pb-1
            pt-2
            md:hidden
          "
          aria-hidden="true"
        >
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close venue preview"
          className="
            absolute
            right-3
            top-3
            z-20
            grid
            h-9
            w-9
            place-items-center
            rounded-full
            border
            border-white/10
            bg-black/55
            text-lg
            font-medium
            text-white
            shadow-lg
            backdrop-blur-md
            transition
            hover:bg-black/75
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-cyan-300
          "
        >
          ×
        </button>

        <div
          className="
            max-h-[min(72dvh,620px)]
            overflow-y-auto
            overscroll-contain
          "
        >
          {imageSource && (
            <div className="relative h-40 w-full overflow-hidden md:h-44">
              <img
                src={imageSource}
                alt=""
                width={760}
                height={352}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                onError={() => {
                  if (
                    image.fallback &&
                    !hasUsedImageFallback
                  ) {
                    setHasUsedImageFallback(
                      true
                    )

                    setImageSource(
                      image.fallback
                    )

                    return
                  }

                  setImageSource(null)
                }}
              />

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-gradient-to-t
                  from-zinc-950
                  via-zinc-950/10
                  to-black/20
                "
              />
            </div>
          )}

          <div
            className={
              imageSource
                ? 'relative -mt-8 space-y-4 px-4 pb-4'
                : 'relative space-y-4 px-4 pb-4 pt-5'
            }
          >
            <header className="pr-11">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={
                    isOpen
                      ? 'rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300'
                      : 'rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[11px] font-bold text-rose-300'
                  }
                >
                  {isOpen
                    ? 'Open now'
                    : 'Closed'}
                </span>

                {venue.price && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                    {venue.price}
                  </span>
                )}

                {upcomingEvents.length >
                  0 && (
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                    Event upcoming
                  </span>
                )}
              </div>

              <h2
                id={titleId}
                className="
                  text-xl
                  font-black
                  leading-tight
                  tracking-tight
                  text-white
                  md:text-2xl
                "
              >
                {venue.name}
              </h2>

              <p
                id={descriptionId}
                className="mt-1 text-sm leading-5 text-zinc-400"
              >
                {[
                  typeLabel,
                  vibeLabel,
                ]
                  .filter(Boolean)
                  .join(' · ') ||
                  'Curated Roam venue'}
              </p>
            </header>

            {(todayHours ||
              vibeLabel) && (
              <div
                className="
                  grid
                  gap-2
                  rounded-2xl
                  border
                  border-white/[0.08]
                  bg-white/[0.045]
                  p-3
                  text-sm
                "
              >
                {todayHours && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-zinc-400">
                      Today
                    </span>

                    <span className="text-right font-medium text-zinc-100">
                      {todayHours}
                    </span>
                  </div>
                )}

                {vibeLabel && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-zinc-400">
                      Vibe
                    </span>

                    <span className="max-w-[68%] text-right font-medium text-zinc-100">
                      {vibeLabel}
                    </span>
                  </div>
                )}
              </div>
            )}

            {upcomingEvents.length >
              0 && (
              <div
                className="
                  rounded-2xl
                  border
                  border-white/[0.08]
                  bg-white/[0.045]
                  p-3
                "
              >
                <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                  Upcoming events
                </h3>

                <ul className="mt-2 space-y-2">
                  {upcomingEvents.map(
                    ({
                      event,
                      startsAt,
                    }) => (
                      <li
                        key={event.id}
                        className="flex items-start gap-3 text-sm"
                      >
                        <time
                          dateTime={
                            event.starts_at
                          }
                          className="
                            min-w-[72px]
                            rounded-lg
                            bg-violet-400/10
                            px-2
                            py-1
                            text-center
                            text-[11px]
                            font-bold
                            text-violet-200
                          "
                        >
                          {startsAt.toFormat(
                            'MMM d · h:mm a'
                          )}
                        </time>

                        <span className="pt-0.5 font-medium leading-5 text-zinc-200">
                          {event.title}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  void handleGenerateFlow()
                }}
                disabled={
                  !canGenerateFlow
                }
                aria-busy={
                  isGenerating
                }
                className="
                  flex
                  min-h-12
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-gradient-to-r
                  from-indigo-500
                  via-violet-500
                  to-cyan-500
                  px-4
                  py-3
                  text-sm
                  font-black
                  text-white
                  shadow-[0_12px_30px_rgba(34,211,238,0.16)]
                  transition
                  hover:brightness-110
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-cyan-300
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-zinc-950
                  disabled:cursor-not-allowed
                  disabled:opacity-55
                "
              >
                {isGenerating
                  ? 'Building your Flow…'
                  : 'Build a Flow from here'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                {venue.id ? (
                  <Link
                    href={`/venue-profile/${venue.id}`}
                    onClick={() =>
                      onViewVenue?.(
                        venue
                      )
                    }
                    className="
                      flex
                      min-h-11
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.055]
                      px-3
                      py-2
                      text-center
                      text-xs
                      font-bold
                      text-zinc-100
                      transition
                      hover:bg-white/10
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-cyan-300
                    "
                  >
                    View venue
                  </Link>
                ) : (
                  <div
                    aria-hidden="true"
                    className="
                      min-h-11
                      rounded-2xl
                      border
                      border-white/5
                      bg-white/[0.025]
                    "
                  />
                )}

                <div className="min-h-11">
                {favoritableVenue ? (
                    <FavoritesButton venue={favoritableVenue} />
                ) : (
                    <div
                    className="
                        flex
                        min-h-11
                        w-full
                        items-center
                        justify-center
                        rounded-2xl
                        border
                        border-white/10
                        bg-white/[0.055]
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-zinc-500
                    "
                    >
                    Save unavailable
                    </div>
                )}
                </div>
              </div>

              {resolvedGenerateError && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="
                    rounded-xl
                    border
                    border-rose-400/20
                    bg-rose-400/10
                    px-3
                    py-2
                    text-xs
                    leading-5
                    text-rose-200
                  "
                >
                  {resolvedGenerateError}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}