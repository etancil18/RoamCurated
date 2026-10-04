'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import type {
  DateTime,
} from 'luxon'
import {
  DateTime as LuxonDateTime,
} from 'luxon'

import type {
  Venue,
} from '@/types/venue'
import {
  CITY_CONFIGS,
} from '@/config/cities'
import {
  FavoritesButton,
} from '@/components/FavoritesButton'
import VenueSignalReporter from '@/components/maps/VenueSignalReporter'
import type {
  CommunityPlaceSignalIntelligence,
} from '@/lib/community-signals/liveIntelligence'
import {
  isCommunityEventSignal,
} from '@/lib/community-signals/presentation'
import {
  coverCandidates,
} from '@/utils/imageUtils'
import {
  isVenueOpenNow,
} from '@/utils/timeUtils'

export type VenuePreviewEvent = {
  id: string | number
  title: string
  starts_at: string
  ends_at?: string | null
  source_type?: string | null
  occurrence_id?: string
  confidence_band?: string
  confirming_contributors?: number
}

export type VenuePreviewSheetInteractionContext =
  | 'default'
  | 'creator-exploration-map'

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
  onViewVenue?: (
    venue: Venue
  ) => void

  /**
   * Identifies the map surface that owns this preview.
   *
   * Creator Exploration Map callers should pass:
   *
   *   interactionContext="creator-exploration-map"
   *
   * Existing callers may omit this prop and preserve all current behavior.
   */
  interactionContext?:
    VenuePreviewSheetInteractionContext

  onRefreshEvents?: () =>
    void | Promise<void>
}

type UpcomingEvent = {
  event: VenuePreviewEvent
  startsAt: DateTime
  endsAt: DateTime | null
}

type CommunityLiveResponse = {
  place_signals?:
    CommunityPlaceSignalIntelligence[]
  error?: string
}

function formatListValue(
  value: unknown
): string {
  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        (
          item
        ) =>
          String(
            item
          ).trim()
      )
      .filter(
        Boolean
      )
      .join(
        ', '
      )
  }

  if (
    typeof value ===
    'string'
  ) {
    return value
      .split(
        ','
      )
      .map(
        (
          item
        ) =>
          item.trim()
      )
      .filter(
        Boolean
      )
      .join(
        ', '
      )
  }

  return ''
}

function getTodayHours(
  venue: Venue,
  nowForCity: DateTime
): string | null {
  if (
    !Array.isArray(
      venue.hours
    )
  ) {
    return null
  }

  const today =
    nowForCity
      .setLocale(
        'en-US'
      )
      .toFormat(
        'cccc'
      )
      .toLowerCase()

  const match =
    venue.hours.find(
      (
        line:
          string
      ) =>
        line
          .trim()
          .toLowerCase()
          .startsWith(
            today
          )
    )

  if (
    !match
  ) {
    return null
  }

  const [
    ,
    ...rest
  ] =
    match.split(
      ': '
    )

  return (
    rest
      .join(
        ': '
      )
      .trim() ||
    null
  )
}

function getPrimaryImage(
  venue: Venue,
  {
    preferCanonicalCover = false,
  }: {
    preferCanonicalCover?: boolean
  } = {}
): {
  primary: string | null
  fallback: string | null
} {
  const canonicalCover =
    typeof venue.cover ===
      'string'
      ? venue.cover.trim()
      : ''

  const candidateImages =
    coverCandidates(
      venue
    )
      .map(
        (
          candidate
        ) =>
          typeof candidate ===
            'string'
            ? candidate.trim()
            : ''
      )
      .filter(
        (
          candidate
        ): candidate is string =>
          candidate.length >
          0
      )

  const uniqueCandidates =
    Array.from(
      new Set([
        canonicalCover,
        ...candidateImages,
      ].filter(Boolean))
    )

  /**
   * Creator Exploration Map venues should prefer the sanitized
   * canonical cover supplied by the public loader.
   *
   * Some existing venue records still rely on the shared image
   * candidate resolver, so retain those candidates as a fallback
   * rather than rendering an empty image state immediately.
   */
  if (
    preferCanonicalCover
  ) {
    return {
      primary:
        uniqueCandidates[0] ??
        null,

      fallback:
        uniqueCandidates[1] ??
        null,
    }
  }

  const fallback =
    candidateImages[0] ??
    null

  const primary =
    venue.slug
      ? `/img/venues/${venue.slug}.jpg`
      : fallback

  return {
    primary,

    fallback:
      fallback &&
      fallback !==
        primary
        ? fallback
        : null,
  }
}

function getCityTimezone(
  city: string | null
): string {
  if (
    !city ||
    !(
      city in
      CITY_CONFIGS
    )
  ) {
    return 'UTC'
  }

  return (
    CITY_CONFIGS[
      city as keyof typeof CITY_CONFIGS
    ]?.timezone ??
    'UTC'
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
  interactionContext =
    'default',
  onRefreshEvents,
}: Props) {
  const titleId =
    useId()

  const descriptionId =
    useId()

  const [
    imageSource,
    setImageSource,
  ] =
    useState<
      string | null
    >(
      null
    )

  const [
    hasUsedImageFallback,
    setHasUsedImageFallback,
  ] =
    useState(
      false
    )

  const [
    localGenerating,
    setLocalGenerating,
  ] =
    useState(
      false
    )

  const [
    localGenerateError,
    setLocalGenerateError,
  ] =
    useState<
      string | null
    >(
      null
    )

  const [
    isReportingSignal,
    setIsReportingSignal,
  ] =
    useState(
      false
    )

  const [
    signalReported,
    setSignalReported,
  ] =
    useState(
      false
    )

  const [
    placeSignals,
    setPlaceSignals,
  ] =
    useState<
      CommunityPlaceSignalIntelligence[]
    >(
      []
    )

  const [
    confirmingSignalId,
    setConfirmingSignalId,
  ] =
    useState<
      string | null
    >(
      null
    )

  const [
    confirmedSignalIds,
    setConfirmedSignalIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set<string>()
    )

  const [
    confirmationErrorBySignalId,
    setConfirmationErrorBySignalId,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    )

  const [
    reportingAbsentSignalId,
    setReportingAbsentSignalId,
  ] =
    useState<
      string | null
    >(
      null
    )

  const [
    reportedAbsentSignalIds,
    setReportedAbsentSignalIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set<string>()
    )

  const [
    absentReportErrorBySignalId,
    setAbsentReportErrorBySignalId,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    )

  const isCreatorExplorationMap =
    interactionContext ===
    'creator-exploration-map'

  const loadPlaceSignals =
    useCallback(
      async (
        signal?:
          AbortSignal
      ) => {
        const venueId =
          venue?.id

        if (
          !venueId ||
          isCreatorExplorationMap
        ) {
          setPlaceSignals(
            []
          )

          return
        }

        try {
          const response =
            await fetch(
              `/api/community-signals/live?venue_id=${encodeURIComponent(
                venueId
              )}`,
              {
                method:
                  'GET',

                credentials:
                  'include',

                cache:
                  'no-store',

                signal,
              }
            )

          let body:
            | CommunityLiveResponse
            | null = null

          try {
            body =
              (await response.json()) as
                CommunityLiveResponse
          } catch {
            body = null
          }

          if (!response.ok) {
            throw new Error(
              body?.error ??
                'Could not load community signals.'
            )
          }

          if (
            signal?.aborted
          ) {
            return
          }

          setPlaceSignals(
            Array.isArray(
              body?.place_signals
            )
              ? body.place_signals
              : []
          )
        } catch (error) {
          if (
            signal?.aborted
          ) {
            return
          }

          console.error(
            '[VenuePreviewSheet] Failed to load current place signals:',
            error
          )

          setPlaceSignals(
            []
          )
        }
      },
      [
        venue?.id,
        isCreatorExplorationMap,
      ]
    )

  const timezone =
    useMemo(
      () =>
        getCityTimezone(
          city
        ),
      [
        city,
      ]
    )

  const resolvedNow =
    useMemo(
      () =>
        nowForCity ??
        LuxonDateTime
          .now()
          .setZone(
            timezone
          ),
      [
        nowForCity,
        timezone,
      ]
    )

  const image =
    useMemo(
      () =>
        venue
          ? getPrimaryImage(
              venue,
              {
                preferCanonicalCover:
                  isCreatorExplorationMap,
              }
            )
          : {
              primary:
                null,

              fallback:
                null,
            },
      [
        venue,
        isCreatorExplorationMap,
      ]
    )

  useEffect(
    () => {
      setImageSource(
        image.primary
      )

      setHasUsedImageFallback(
        false
      )

      setLocalGenerateError(
        null
      )

      setLocalGenerating(
        false
      )

      setIsReportingSignal(
        false
      )

      setSignalReported(
        false
      )

      setConfirmingSignalId(
        null
      )

      setConfirmedSignalIds(
        new Set<string>()
      )

      setConfirmationErrorBySignalId(
        {}
      )

      setReportingAbsentSignalId(
        null
      )

      setReportedAbsentSignalIds(
        new Set<string>()
      )

      setAbsentReportErrorBySignalId(
        {}
      )
    },
    [
      venue?.id,
      venue?.slug,
      venue?.cover,
      image.primary,
      image.fallback,
    ]
  )

  useEffect(
    () => {
      setPlaceSignals(
        []
      )

      const controller =
        new AbortController()

      void loadPlaceSignals(
        controller.signal
      )

      return () => {
        controller.abort()
      }
    },
    [
      loadPlaceSignals,
    ]
  )

  const isOpen =
    useMemo(
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

  const vibeLabel =
    useMemo(
      () =>
        venue
          ? formatListValue(
              venue.vibe
            )
          : '',
      [
        venue,
      ]
    )

  const todayHours =
    useMemo(
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

  const presentPlaceSignals =
    useMemo(
      () =>
        placeSignals.filter(
          signal =>
            signal.signalState ===
            'present'
        ),
      [
        placeSignals,
      ]
    )

  const eventItems =
    useMemo<
      UpcomingEvent[]
    >(
      () => {
        return events
          .map(
            (
              event
            ):
              | UpcomingEvent
              | null => {
              const startsAt =
                LuxonDateTime
                  .fromISO(
                    event.starts_at,
                    {
                      setZone:
                        true,
                    }
                  )
                  .setZone(
                    timezone
                  )

              if (
                !startsAt.isValid
              ) {
                return null
              }

              const parsedEndsAt =
                typeof event.ends_at ===
                  'string'
                  ? LuxonDateTime
                      .fromISO(
                        event.ends_at,
                        {
                          setZone:
                            true,
                        }
                      )
                      .setZone(
                        timezone
                      )
                  : null

              const endsAt =
                parsedEndsAt?.isValid
                  ? parsedEndsAt
                  : null

              return {
                event,
                startsAt,
                endsAt,
              }
            }
          )
          .filter(
            (
              item
            ): item is UpcomingEvent =>
              item !== null
          )
          .sort(
            (
              first,
              second
            ) =>
              first.startsAt.toMillis() -
              second.startsAt.toMillis()
          )
      },
      [
        events,
        timezone,
      ]
    )

  const upcomingEvents =
    useMemo(
      () => {
        const nowMillis =
          resolvedNow.toMillis()

        return eventItems
          .filter(
            ({
              event,
              startsAt,
            }) =>
              !isCommunityEventSignal(
                event
              ) &&
              startsAt.toMillis() >=
                nowMillis
          )
          .slice(
            0,
            3
          )
      },
      [
        eventItems,
        resolvedNow,
      ]
    )

  const communitySignals =
    useMemo(
      () => {
        const nowMillis =
          resolvedNow.toMillis()

        return eventItems
          .filter(
            ({
              event,
              startsAt,
              endsAt,
            }) => {
              if (
                !isCommunityEventSignal(
                  event
                )
              ) {
                return false
              }

              const startsMillis =
                startsAt.toMillis()

              const endsMillis =
                endsAt?.toMillis() ??
                null

              const isUpcoming =
                startsMillis >
                nowMillis

              const isHappeningNow =
                startsMillis <=
                  nowMillis &&
                endsMillis !==
                  null &&
                endsMillis >
                  nowMillis

              return (
                isUpcoming ||
                isHappeningNow
              )
            }
          )
          .slice(
            0,
            3
          )
      },
      [
        eventItems,
        resolvedNow,
      ]
    )

  if (
    !venue
  ) {
    return null
  }

  const isGenerating =
    isGeneratingFlow ||
    localGenerating

  const resolvedGenerateError =
    generateFlowError ??
    localGenerateError

  const canGenerateFlow =
    Boolean(
      onGenerateFlow
    ) &&
    !isGenerating

  const favoritableVenue =
    venue.id
      ? (
          venue as
            Venue & {
              id: string
            }
        )
      : null

  const handleGenerateFlow =
    async () => {
      if (
        !onGenerateFlow ||
        isGenerating
      ) {
        return
      }

      setLocalGenerating(
        true
      )

      setLocalGenerateError(
        null
      )

      try {
        await onGenerateFlow(
          venue
        )
      } catch (
        error
      ) {
        const message =
          error instanceof
          Error
            ? error.message
            : 'Could not build a Flow from this venue.'

        setLocalGenerateError(
          message
        )
      } finally {
        setLocalGenerating(
          false
        )
      }
    }

  const handleStillHappening =
    async ({
      signalId,
      url,
      body,
      refresh,
    }: {
      signalId: string
      url: string
      body: Record<
        string,
        unknown
      >
      refresh?:
        | 'place'
        | 'events'
    }) => {
      if (
        confirmingSignalId !==
          null ||
        confirmedSignalIds.has(
          signalId
        )
      ) {
        return
      }

      setConfirmingSignalId(
        signalId
      )

      setConfirmationErrorBySignalId(
        current => {
          const next = {
            ...current,
          }

          delete next[
            signalId
          ]

          return next
        }
      )

      try {
        const response =
          await fetch(
            url,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify(
                  body
                ),
            }
          )

        let responseBody:
          | {
              error?: string
            }
          | null = null

        try {
          responseBody =
            (await response.json()) as {
              error?: string
            }
        } catch {
          responseBody =
            null
        }

        if (!response.ok) {
          throw new Error(
            responseBody?.error ??
              'Could not confirm this signal.'
          )
        }

        setConfirmedSignalIds(
          current => {
            const next =
              new Set(
                current
              )

            next.add(
              signalId
            )

            return next
          }
        )

        if (
          refresh ===
          'place'
        ) {
          await loadPlaceSignals()
        }

        if (
          refresh ===
            'events' &&
          onRefreshEvents
        ) {
          await onRefreshEvents()
        }
      } catch (error) {
        setConfirmationErrorBySignalId(
          current => ({
            ...current,

            [signalId]:
              error instanceof
              Error
                ? error.message
                : 'Could not confirm this signal.',
          })
        )
      } finally {
        setConfirmingSignalId(
          null
        )
      }
    }

  const handleNotThere =
    async ({
      signalId,
      url,
      body,
      refresh,
    }: {
      signalId: string
      url: string
      body: Record<
        string,
        unknown
      >
      refresh?:
        | 'place'
        | 'events'
    }) => {
      if (
        reportingAbsentSignalId !==
          null ||
        reportedAbsentSignalIds.has(
          signalId
        )
      ) {
        return
      }

      setReportingAbsentSignalId(
        signalId
      )

      setAbsentReportErrorBySignalId(
        current => {
          const next = {
            ...current,
          }

          delete next[
            signalId
          ]

          return next
        }
      )

      try {
        const response =
          await fetch(
            url,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify(
                  body
                ),
            }
          )

        let responseBody:
          | {
              error?: string
            }
          | null = null

        try {
          responseBody =
            (await response.json()) as {
              error?: string
            }
        } catch {
          responseBody =
            null
        }

        if (!response.ok) {
          throw new Error(
            responseBody?.error ??
              'Could not report this signal.'
          )
        }

        setReportedAbsentSignalIds(
          current => {
            const next =
              new Set(
                current
              )

            next.add(
              signalId
            )

            return next
          }
        )

        if (
          refresh ===
          'place'
        ) {
          await loadPlaceSignals()
        }

        if (
          refresh ===
            'events' &&
          onRefreshEvents
        ) {
          await onRefreshEvents()
        }
      } catch (error) {
        setAbsentReportErrorBySignalId(
          current => ({
            ...current,

            [signalId]:
              error instanceof
              Error
                ? error.message
                : 'Could not report this signal.',
          })
        )
      } finally {
        setReportingAbsentSignalId(
          null
        )
      }
    }

  /**
   * Creator Exploration Map previews deliberately expose only:
   *
   * - the Creator explored badge
   * - the canonical venue cover image
   * - the venue name
   * - a link to the canonical venue profile
   *
   * All default venue details and actions remain untouched for
   * every other map context.
   */
  if (
    isCreatorExplorationMap
  ) {
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
          aria-labelledby={
            titleId
          }
          aria-describedby={
            descriptionId
          }
          data-roam-map-context={
            interactionContext
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
          <h2
            id={
              titleId
            }
            className="sr-only"
          >
            {venue.name}
          </h2>

          <p
            id={
              descriptionId
            }
            className="sr-only"
          >
            {`${venue.name}, selected from this creator's public exploration map.`}
          </p>

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
            onClick={
              onClose
            }
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

          {imageSource ? (
            <div className="relative h-48 w-full overflow-hidden md:h-52">
              <img
                src={
                  imageSource
                }
                alt=""
                width={
                  760
                }
                height={
                  416
                }
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                onError={
                  () => {
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

                    setImageSource(
                      null
                    )
                  }
                }
              />

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-gradient-to-t
                  from-zinc-950
                  via-transparent
                  to-black/25
                "
              />

              <div
                className="
                  absolute
                  inset-x-0
                  bottom-0
                  z-10
                  space-y-2
                  px-4
                  pb-4
                  pr-16
                "
              >
                <span
                  className="
                    inline-flex
                    rounded-full
                    border
                    border-cyan-300/30
                    bg-zinc-950/85
                    px-3
                    py-1.5
                    text-[11px]
                    font-bold
                    text-cyan-200
                    shadow-lg
                    backdrop-blur-xl
                  "
                >
                  Creator explored
                </span>

                <p
                  aria-hidden="true"
                  className="
                    line-clamp-2
                    text-xl
                    font-black
                    leading-tight
                    tracking-tight
                    text-white
                    drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]
                    md:text-2xl
                  "
                >
                  {venue.name}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="
                relative
                flex
                h-32
                items-end
                bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_45%),#09090b]
                p-4
              "
            >
              <div className="space-y-2 pr-12">
                <span
                  className="
                    inline-flex
                    rounded-full
                    border
                    border-cyan-300/30
                    bg-zinc-950/85
                    px-3
                    py-1.5
                    text-[11px]
                    font-bold
                    text-cyan-200
                    shadow-lg
                    backdrop-blur-xl
                  "
                >
                  Creator explored
                </span>

                <p
                  aria-hidden="true"
                  className="
                    line-clamp-2
                    text-xl
                    font-black
                    leading-tight
                    tracking-tight
                    text-white
                    md:text-2xl
                  "
                >
                  {venue.name}
                </p>
              </div>
            </div>
          )}

          <div className="p-3">
            {venue.id ? (
              <Link
                href={`/venue-profile/${encodeURIComponent(
                  venue.id
                )}`}
                onClick={
                  () =>
                    onViewVenue?.(
                      venue
                    )
                }
                className="
                  flex
                  min-h-12
                  w-full
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-cyan-300/25
                  bg-cyan-300/10
                  px-4
                  py-3
                  text-center
                  text-sm
                  font-bold
                  text-cyan-100
                  transition
                  hover:border-cyan-300/45
                  hover:bg-cyan-300/15
                  hover:text-white
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-cyan-300
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-zinc-950
                "
              >
                View venue
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="
                  flex
                  min-h-12
                  w-full
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-zinc-500
                "
              >
                Venue profile unavailable
              </div>
            )}
          </div>
        </section>
      </div>
    )
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
        aria-labelledby={
          titleId
        }
        aria-describedby={
          descriptionId
        }
        data-roam-map-context={
          interactionContext
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
        <p
          id={
            descriptionId
          }
          className="sr-only"
        >
          {`Venue details for ${venue.name}.`}
        </p>

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
          onClick={
            onClose
          }
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
                src={
                  imageSource
                }
                alt=""
                width={
                  760
                }
                height={
                  352
                }
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                onError={
                  () => {
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

                    setImageSource(
                      null
                    )
                  }
                }
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
                    {
                      venue.price
                    }
                  </span>
                )}

                {upcomingEvents.length >
                  0 && (
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                    Event upcoming
                  </span>
                )}

                {(
                  communitySignals.length >
                    0 ||
                  presentPlaceSignals.length >
                    0
                ) && (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                    Community signal
                  </span>
                )}
              </div>

              <h2
                id={
                  titleId
                }
                className="
                  text-xl
                  font-black
                  leading-tight
                  tracking-tight
                  text-white
                  md:text-2xl
                "
              >
                {
                  venue.name
                }
              </h2>
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
                      {
                        todayHours
                      }
                    </span>
                  </div>
                )}

                {vibeLabel && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-zinc-400">
                      Vibe
                    </span>

                    <span className="max-w-[68%] text-right font-medium text-zinc-100">
                      {
                        vibeLabel
                      }
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
                        key={
                          event.id
                        }
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
                          {
                            event.title
                          }
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {(
              communitySignals.length >
                0 ||
              presentPlaceSignals.length >
                0
            ) && (
              <div
                className="
                  rounded-2xl
                  border
                  border-cyan-400/15
                  bg-cyan-400/[0.055]
                  p-3
                "
              >
                <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-300/80">
                  Community signals
                </h3>

                <ul className="mt-2 space-y-2">
                  {presentPlaceSignals.map(
                    signal => {
                      const label =
                        signal.signalType ===
                        'temporary_closure'
                          ? 'Temporary closure'
                          : 'Line'

                      const isConfirmed =
                        confirmedSignalIds.has(
                          signal.intelligenceId
                        )

                      return (
                        <li
                          key={
                            signal.intelligenceId
                          }
                          className="flex items-start gap-3 text-sm"
                        >
                          <div
                            className="
                              min-w-[88px]
                              rounded-lg
                              bg-cyan-400/10
                              px-2
                              py-1
                              text-center
                              text-[11px]
                              font-bold
                              text-cyan-200
                            "
                          >
                            Current
                          </div>

                          <div className="min-w-0 pt-0.5">
                            <div className="font-medium leading-5 text-zinc-200">
                              {label}
                            </div>

                            <div className="mt-0.5 text-[11px] font-semibold text-cyan-300/70">
                              {signal.supportingContributors >= 2
                                ? `Community · ${signal.supportingContributors} people confirm this`
                                : 'Community'}
                            </div>

                            <div className="mt-2">
                              <div className="flex flex-wrap gap-2">
                                {isConfirmed ? (
                                  <div className="text-[11px] font-bold text-emerald-300">
                                    Thanks — confirmed
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={
                                      confirmingSignalId !==
                                        null ||
                                      reportingAbsentSignalId !==
                                        null
                                    }
                                    onClick={() => {
                                      void handleStillHappening({
                                        signalId:
                                          signal.intelligenceId,

                                        url:
                                          '/api/community-signals/place',

                                        body: {
                                          venue_id:
                                            signal.venueId,

                                          signal_type:
                                            signal.signalType,

                                          signal_state:
                                            'present',
                                        },

                                        refresh:
                                          'place',
                                      })
                                    }}
                                    className="
                                      rounded-lg
                                      border
                                      border-cyan-300/20
                                      bg-cyan-300/[0.07]
                                      px-2.5
                                      py-1.5
                                      text-[11px]
                                      font-bold
                                      text-cyan-100
                                      transition
                                      hover:border-cyan-300/35
                                      hover:bg-cyan-300/10
                                      hover:text-white
                                      focus-visible:outline-none
                                      focus-visible:ring-2
                                      focus-visible:ring-cyan-300
                                      disabled:cursor-not-allowed
                                      disabled:opacity-50
                                    "
                                  >
                                    {confirmingSignalId ===
                                    signal.intelligenceId
                                      ? 'Confirming…'
                                      : 'Still happening'}
                                  </button>
                                )}

                                {reportedAbsentSignalIds.has(
                                  signal.intelligenceId
                                ) ? (
                                  <div className="text-[11px] font-bold text-emerald-300">
                                    Thanks — reported
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={
                                      confirmingSignalId !==
                                        null ||
                                      reportingAbsentSignalId !==
                                        null
                                    }
                                    onClick={() => {
                                      void handleNotThere({
                                        signalId:
                                          signal.intelligenceId,

                                        url:
                                          '/api/community-signals/place',

                                        body: {
                                          venue_id:
                                            signal.venueId,

                                          signal_type:
                                            signal.signalType,

                                          signal_state:
                                            'absent',
                                        },

                                        refresh:
                                          'place',
                                      })
                                    }}
                                    className="
                                      rounded-lg
                                      border
                                      border-rose-300/20
                                      bg-rose-300/[0.06]
                                      px-2.5
                                      py-1.5
                                      text-[11px]
                                      font-bold
                                      text-rose-100
                                      transition
                                      hover:border-rose-300/35
                                      hover:bg-rose-300/10
                                      hover:text-white
                                      focus-visible:outline-none
                                      focus-visible:ring-2
                                      focus-visible:ring-rose-300
                                      disabled:cursor-not-allowed
                                      disabled:opacity-50
                                    "
                                  >
                                    {reportingAbsentSignalId ===
                                    signal.intelligenceId
                                      ? 'Reporting…'
                                      : 'Not there'}
                                  </button>
                                )}
                              </div>

                              {confirmationErrorBySignalId[
                                signal.intelligenceId
                              ] ? (
                                <p
                                  role="alert"
                                  className="mt-1 text-[11px] leading-4 text-rose-300"
                                >
                                  {
                                    confirmationErrorBySignalId[
                                      signal.intelligenceId
                                    ]
                                  }
                                </p>
                              ) : null}

                              {absentReportErrorBySignalId[
                                signal.intelligenceId
                              ] ? (
                                <p
                                  role="alert"
                                  className="mt-1 text-[11px] leading-4 text-rose-300"
                                >
                                  {
                                    absentReportErrorBySignalId[
                                      signal.intelligenceId
                                    ]
                                  }
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      )
                    }
                  )}

                  {communitySignals.map(
                    ({
                      event,
                      startsAt,
                      endsAt,
                    }) => {
                      const nowMillis =
                        resolvedNow.toMillis()

                      const isHappeningNow =
                        startsAt.toMillis() <=
                          nowMillis &&
                        endsAt !==
                          null &&
                        endsAt.toMillis() >
                          nowMillis

                      const signalId =
                        `event:${event.id}`

                      const occurrenceId =
                        event.occurrence_id

                      const isConfirmed =
                        confirmedSignalIds.has(
                          signalId
                        )

                      return (
                        <li
                          key={
                            event.id
                          }
                          className="flex items-start gap-3 text-sm"
                        >
                          <div
                            className="
                              min-w-[88px]
                              rounded-lg
                              bg-cyan-400/10
                              px-2
                              py-1
                              text-center
                              text-[11px]
                              font-bold
                              text-cyan-200
                            "
                          >
                            {isHappeningNow
                              ? 'Happening now'
                              : startsAt.toFormat(
                                  'MMM d · h:mm a'
                                )}
                          </div>

                          <div className="min-w-0 pt-0.5">
                            <div className="font-medium leading-5 text-zinc-200">
                              {
                                event.title
                              }
                            </div>

                            <div className="mt-0.5 text-[11px] font-semibold text-cyan-300/70">
                              {typeof event.confirming_contributors ===
                                'number' &&
                              event.confirming_contributors >= 2
                                ? `Community · ${event.confirming_contributors} people confirm this`
                                : 'Community'}
                            </div>

                            <div className="mt-2">
                              <div className="flex flex-wrap gap-2">
                                {isConfirmed ? (
                                  <div className="text-[11px] font-bold text-emerald-300">
                                    Thanks — confirmed
                                  </div>
                                ) : occurrenceId ? (
                                  <button
                                    type="button"
                                    disabled={
                                      confirmingSignalId !==
                                        null ||
                                      reportingAbsentSignalId !==
                                        null
                                    }
                                    onClick={() => {
                                      void handleStillHappening({
                                        signalId,

                                        url:
                                          `/api/event-occurrences/${encodeURIComponent(
                                            occurrenceId
                                          )}/confirmations`,

                                        body: {},

                                        refresh:
                                          'events',
                                      })
                                    }}
                                    className="
                                      rounded-lg
                                      border
                                      border-cyan-300/20
                                      bg-cyan-300/[0.07]
                                      px-2.5
                                      py-1.5
                                      text-[11px]
                                      font-bold
                                      text-cyan-100
                                      transition
                                      hover:border-cyan-300/35
                                      hover:bg-cyan-300/10
                                      hover:text-white
                                      focus-visible:outline-none
                                      focus-visible:ring-2
                                      focus-visible:ring-cyan-300
                                      disabled:cursor-not-allowed
                                      disabled:opacity-50
                                    "
                                  >
                                    {confirmingSignalId ===
                                    signalId
                                      ? 'Confirming…'
                                      : 'Still happening'}
                                  </button>
                                ) : null}

                                {reportedAbsentSignalIds.has(
                                  signalId
                                ) ? (
                                  <div className="text-[11px] font-bold text-emerald-300">
                                    Thanks — reported
                                  </div>
                                ) : occurrenceId ? (
                                  <button
                                    type="button"
                                    disabled={
                                      confirmingSignalId !==
                                        null ||
                                      reportingAbsentSignalId !==
                                        null
                                    }
                                    onClick={() => {
                                      void handleNotThere({
                                        signalId,

                                        url:
                                          `/api/event-occurrences/${encodeURIComponent(
                                            occurrenceId
                                          )}/corrections`,

                                        body: {
                                          correction_type:
                                            'canceled',

                                          claim: {},
                                        },

                                        refresh:
                                          'events',
                                      })
                                    }}
                                    className="
                                      rounded-lg
                                      border
                                      border-rose-300/20
                                      bg-rose-300/[0.06]
                                      px-2.5
                                      py-1.5
                                      text-[11px]
                                      font-bold
                                      text-rose-100
                                      transition
                                      hover:border-rose-300/35
                                      hover:bg-rose-300/10
                                      hover:text-white
                                      focus-visible:outline-none
                                      focus-visible:ring-2
                                      focus-visible:ring-rose-300
                                      disabled:cursor-not-allowed
                                      disabled:opacity-50
                                    "
                                  >
                                    {reportingAbsentSignalId ===
                                    signalId
                                      ? 'Reporting…'
                                      : 'Not there'}
                                  </button>
                                ) : null}
                              </div>

                              {confirmationErrorBySignalId[
                                signalId
                              ] ? (
                                <p
                                  role="alert"
                                  className="mt-1 text-[11px] leading-4 text-rose-300"
                                >
                                  {
                                    confirmationErrorBySignalId[
                                      signalId
                                    ]
                                  }
                                </p>
                              ) : null}

                              {absentReportErrorBySignalId[
                                signalId
                              ] ? (
                                <p
                                  role="alert"
                                  className="mt-1 text-[11px] leading-4 text-rose-300"
                                >
                                  {
                                    absentReportErrorBySignalId[
                                      signalId
                                    ]
                                  }
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      )
                    }
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={
                  () => {
                    void handleGenerateFlow()
                  }
                }
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

              {venue.id && (
                <>
                  {isReportingSignal ? (
                    <VenueSignalReporter
                      venueId={
                        venue.id
                      }
                      venueName={
                        venue.name
                      }
                      onCancel={
                        () => {
                          setIsReportingSignal(
                            false
                          )
                        }
                      }
                      onReported={
                        () => {
                          setIsReportingSignal(
                            false
                          )

                          setSignalReported(
                            true
                          )
                        }
                      }
                    />
                  ) : signalReported ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="
                        rounded-2xl
                        border
                        border-emerald-400/20
                        bg-emerald-400/10
                        px-4
                        py-3
                        text-sm
                        font-semibold
                        leading-5
                        text-emerald-200
                      "
                    >
                      Thanks — Roam is checking this signal.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        () => {
                          setSignalReported(
                            false
                          )

                          setIsReportingSignal(
                            true
                          )
                        }
                      }
                      className="
                        flex
                        min-h-11
                        w-full
                        items-center
                        justify-center
                        rounded-2xl
                        border
                        border-cyan-300/20
                        bg-cyan-300/[0.07]
                        px-4
                        py-2.5
                        text-center
                        text-xs
                        font-bold
                        text-cyan-100
                        transition
                        hover:border-cyan-300/35
                        hover:bg-cyan-300/10
                        hover:text-white
                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-cyan-300
                      "
                    >
                      What&apos;s happening here?
                    </button>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                {venue.id ? (
                  <Link
                    href={`/venue-profile/${venue.id}`}
                    onClick={
                      () =>
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
                    <FavoritesButton
                      venue={
                        favoritableVenue
                      }
                    />
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
                  {
                    resolvedGenerateError
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}