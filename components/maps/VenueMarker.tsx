'use client'

import { Marker, Popup, Tooltip } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { MutableRefObject } from 'react'
import type {
  DivIcon,
  Marker as LeafletMarker,
} from 'leaflet'
import type { DateTime } from 'luxon'
import { DateTime as LuxonDateTime } from 'luxon'

import type { Venue } from '@/types/venue'
import type { RouteStopRole } from '@/lib/maps/mapTypes'

import { isVenueOpenNow } from '@/utils/timeUtils'
import { coverCandidates } from '@/utils/imageUtils'
import { logVenueImpression } from '@/lib/logVenue'
import { FavoritesButton } from '@/components/FavoritesButton'
import { CITY_CONFIGS } from '@/config/cities'
import { getVenueMarkerEmoji } from '@/lib/maps/getVenueMarkerEmoji'
import {
  getVenueIcon,
  getVenueIconZIndex,
  resolveVenueIconVisualState,
} from '@/lib/maps/icons'

type Props = {
  venue: Venue
  index: number
  city: string
  nowForCity: DateTime
  isRouteMode: boolean
  markerRefs: MutableRefObject<Record<string, LeafletMarker>>
  eventsByVenueId: Record<string, any[]>

  /**
   * Premium marker-state inputs.
   *
   * All are optional so current MapCanvas callers continue to work while the
   * initiative is rolled out incrementally.
   */
  selected?: boolean
  markerScale?: number
  routeIndex?: number
  routeRole?: RouteStopRole
  routeLength?: number
  hasLiveEvent?: boolean
  hasUpcomingEvent?: boolean
  isSearchMatch?: boolean
  isDimmed?: boolean
  onSelect?: (venue: Venue) => void

  /**
   * Allows parent map surfaces to suppress the Leaflet popup when another
   * venue-detail surface, such as VenuePreviewSheet, owns the interaction.
   *
   * Defaults to true to preserve existing behavior everywhere else.
   */
  showPopup?: boolean
}

const daypartAccentColorMap: Record<string, string> = {
  M: '#3b82f6',
  MD: '#10b981',
  A: '#f97316',
  HH: '#f59e0b',
  E: '#8b5cf6',
  L: '#f43f5e',
}

function formatListValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
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

function getVenueKey(venue: Venue) {
  return venue.id ?? venue.slug ?? venue.name ?? null
}

function resolveRouteRole({
  routeIndex,
  routeLength,
  explicitRole,
}: {
  routeIndex: number
  routeLength?: number
  explicitRole?: RouteStopRole
}): RouteStopRole {
  if (explicitRole) return explicitRole
  if (routeIndex <= 0) return 'start'

  if (
    typeof routeLength === 'number' &&
    Number.isFinite(routeLength) &&
    routeLength > 0 &&
    routeIndex >= routeLength - 1
  ) {
    return 'end'
  }

  return 'middle'
}

export default function VenueMarker({
  venue: v,
  index,
  city,
  nowForCity,
  isRouteMode,
  markerRefs,
  eventsByVenueId,
  selected = false,
  markerScale = 1,
  routeIndex,
  routeRole,
  routeLength,
  hasLiveEvent,
  hasUpcomingEvent,
  isSearchMatch = false,
  isDimmed = false,
  onSelect,
  showPopup = true,
}: Props) {
  const [generatingRoute, setGeneratingRoute] = useState(false)

  const [generateRouteError, setGenerateRouteError] =
    useState<string | null>(null)

  const [icon, setIcon] = useState<DivIcon | null>(null)

  const venueKey = getVenueKey(v)
  const canGenerateRoute = Boolean(venueKey)

  const isOpen = useMemo(
    () => isVenueOpenNow(v, nowForCity),
    [v, nowForCity]
  )

  const markerEmoji = useMemo(
    () =>
      getVenueMarkerEmoji(
        (v as any).type ??
          (v as any).types ??
          null,
        nowForCity
      ),
    [
      v.type,
      (v as any).types,
      nowForCity.hour,
    ]
  )

  const vibeLabel = useMemo(
    () => formatListValue(v.vibe),
    [v.vibe]
  )

  const todayHours = useMemo(() => {
    if (!Array.isArray(v.hours)) return null

    const today = nowForCity
      .setLocale('en-US')
      .toFormat('cccc')

    const match = v.hours.find(
      (line: string) =>
        line
          .toLowerCase()
          .startsWith(today.toLowerCase())
    )

    return match
      ? match.split(': ').slice(1).join(': ')
      : null
  }, [v.hours, nowForCity])

  const venueEvents =
    eventsByVenueId[v.id] ?? []

  const upcomingEvents = useMemo(() => {
    const nowMillis = nowForCity.toMillis()

    return venueEvents
      .filter((ev) => {
        if (!ev.starts_at) return false

        return (
          LuxonDateTime
            .fromISO(ev.starts_at)
            .toMillis() >= nowMillis
        )
      })
      .sort(
        (a, b) =>
          LuxonDateTime
            .fromISO(a.starts_at)
            .toMillis() -
          LuxonDateTime
            .fromISO(b.starts_at)
            .toMillis()
      )
  }, [venueEvents, nowForCity])

  const resolvedHasLiveEvent =
    hasLiveEvent ??
    venueEvents.some((event) => {
      if (!event?.starts_at) return false

      const start = LuxonDateTime.fromISO(
        event.starts_at
      )

      if (!start.isValid) return false

      const end = event.ends_at
        ? LuxonDateTime.fromISO(event.ends_at)
        : start.plus({ hours: 3 })

      if (!end.isValid) return false

      const nowMillis =
        nowForCity.toMillis()

      return (
        start.toMillis() <= nowMillis &&
        end.toMillis() >= nowMillis
      )
    })

  const resolvedHasUpcomingEvent =
    hasUpcomingEvent ??
    upcomingEvents.length > 0

  const resolvedRouteIndex =
    isRouteMode
      ? routeIndex ?? index
      : null

  const resolvedRouteRole =
    resolvedRouteIndex !== null
      ? resolveRouteRole({
          routeIndex: resolvedRouteIndex,
          routeLength,
          explicitRole: routeRole,
        })
      : null

  const visualState = useMemo(
    () =>
      resolveVenueIconVisualState({
        routeIndex: resolvedRouteIndex,
        selected,
        isSearchMatch,
        hasLiveEvent:
          resolvedHasLiveEvent,
        hasUpcomingEvent:
          resolvedHasUpcomingEvent,
      }),
    [
      resolvedRouteIndex,
      selected,
      isSearchMatch,
      resolvedHasLiveEvent,
      resolvedHasUpcomingEvent,
    ]
  )

  const accentColor = useMemo(() => {
    const weekdayIndex =
      nowForCity.weekday % 7

    const todayKey = [
      'sun',
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
    ][weekdayIndex]

    const daypart =
      v.dayParts?.[todayKey] || ''

    if (!isOpen) {
      return '#64748b'
    }

    return (
      daypartAccentColorMap[daypart] ??
      '#22d3ee'
    )
  }, [v.dayParts, isOpen, nowForCity])

  useEffect(() => {
    let active = true

    void getVenueIcon({
      visualState,
      categoryGlyph: markerEmoji,
      accentColor,
      openNow: isOpen,
      selected,
      dimmed: isDimmed,
      scale: markerScale,
      routeIndex: resolvedRouteIndex,
      routeRole: resolvedRouteRole,
      hasLiveEvent:
        resolvedHasLiveEvent,
      hasUpcomingEvent:
        resolvedHasUpcomingEvent,
      isSearchMatch,
      interactive: true,
    })
      .then((nextIcon) => {
        if (active) {
          setIcon(nextIcon)
        }
      })
      .catch((error: unknown) => {
        if (
          active &&
          process.env.NODE_ENV ===
            'development'
        ) {
          console.error(
            '[VenueMarker] Failed to create marker icon',
            {
              venueId: v.id,
              venueSlug: v.slug,
              error,
            }
          )
        }
      })

    return () => {
      active = false
    }
  }, [
    visualState,
    markerEmoji,
    accentColor,
    isOpen,
    selected,
    isDimmed,
    markerScale,
    resolvedRouteIndex,
    resolvedRouteRole,
    resolvedHasLiveEvent,
    resolvedHasUpcomingEvent,
    isSearchMatch,
    v.id,
    v.slug,
  ])

  const markerZIndex = getVenueIconZIndex({
    routeIndex: resolvedRouteIndex,
    selected,
    hasLiveEvent:
      resolvedHasLiveEvent,
    isSearchMatch,
    dimmed: isDimmed,
  })

  const firstCandidate =
    coverCandidates(v)[0]

  const timezone =
    CITY_CONFIGS[city]?.timezone ??
    'UTC'

  const primaryImage = v.slug
    ? `/img/venues/${v.slug}.jpg`
    : firstCandidate

  const generateRouteFromVenue =
    async () => {
      if (generatingRoute) return

      if (!canGenerateRoute) {
        setGenerateRouteError(
          'This venue is missing an id, slug, and name.'
        )

        console.warn(
          '[generateRouteFromVenue] missing venue identifier',
          v
        )

        return
      }

      console.log(
        '[generate route click]',
        {
          id: v.id,
          slug: v.slug,
          name: v.name,
          city,
        }
      )

      setGeneratingRoute(true)
      setGenerateRouteError(null)

      let payload: any = null

      try {
        logVenueImpression(
          'generate_from_venue_clicked',
          {
            venue_id:
              venueKey ?? 'unknown',
            metadata: {
              city,
              name: v.name,
              slug: v.slug ?? null,
              source:
                'map_marker_popup',
            },
          }
        )

        const res = await fetch(
          '/api/generate-from-venue',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              venueId: v.id ?? null,
              venueSlug:
                v.slug ?? null,
              venueName:
                v.name ?? null,
              city,
              plannedStartAt:
                nowForCity
                  .plus({
                    minutes: 15,
                  })
                  .toISO(),
              travelMode: 'walking',
              tightness: 'medium',
              maxStops: 5,
              source: 'map_marker',
              debug: true,
            }),
          }
        )

        payload = await res
          .json()
          .catch(() => null)

        console.log(
          '[generate route payload]',
          payload
        )

        console.log(
          '[generate route response]',
          {
            ok: res.ok,
            status: res.status,
            statusText:
              res.statusText,
          }
        )

        if (
          !res.ok ||
          !payload?.route?.stops
            ?.length
        ) {
          throw new Error(
            payload?.error ||
              'Could not generate a route from this venue.'
          )
        }

        const generatedVenues =
          payload.route.stops
            .map(
              (stop: any) =>
                stop.venue
            )
            .filter(Boolean)

        console.log(
          '[generated venues before dispatch]',
          generatedVenues
        )

        try {
          window.dispatchEvent(
            new CustomEvent(
              'roam:generated-route-from-venue',
              {
                detail: {
                  route:
                    generatedVenues,
                  generatedRoute:
                    payload.route,
                  anchorVenueId:
                    venueKey,
                  city,
                },
              }
            )
          )

          console.log(
            '[generated route event dispatched]'
          )
        } catch (dispatchError) {
          console.error(
            '[generated route dispatch failed]',
            dispatchError
          )

          throw dispatchError
        }

        logVenueImpression(
          'generate_from_venue_succeeded',
          {
            venue_id:
              venueKey ?? 'unknown',
            metadata: {
              city,
              name: v.name,
              slug: v.slug ?? null,
              stop_count:
                generatedVenues.length,
              debug:
                payload?.route
                  ?.debug ?? null,
            },
          }
        )
      } catch (error) {
        console.error(
          '[generate route from venue failed after payload]',
          error,
          payload
        )

        const message =
          error instanceof Error
            ? error.message
            : 'Could not generate a route from this venue.'

        setGenerateRouteError(message)

        logVenueImpression(
          'generate_from_venue_failed',
          {
            venue_id:
              venueKey ?? 'unknown',
            metadata: {
              city,
              name: v.name,
              slug: v.slug ?? null,
              message,
              debug:
                payload?.route
                  ?.debug ?? null,
            },
          }
        )
      } finally {
        setGeneratingRoute(false)
      }
    }

  if (!icon) return null

  return (
    <Marker
      position={[v.lat, v.lon]}
      icon={icon}
      zIndexOffset={markerZIndex}
      ref={(ref) => {
        if (!v.slug) return

        if (ref) {
          markerRefs.current[v.slug] =
            ref
        } else {
          delete markerRefs.current[
            v.slug
          ]
        }
      }}
      eventHandlers={{
        click: () => {
          onSelect?.(v)

          if (venueKey) {
            logVenueImpression(
              'map_marker_click',
              {
                venue_id: venueKey,
                metadata: {
                  screen:
                    'map_marker',
                  city,
                  name: v.name,
                  slug:
                    v.slug ?? null,
                },
              }
            )
          }
        },
      }}
    >
      <Tooltip>{v.name}</Tooltip>

      {showPopup && (
        <Popup>
          <div className="w-[230px] overflow-hidden rounded-xl bg-white text-[13px] text-zinc-900">
            <div className="space-y-2">
              <div>
                <strong className="block text-base leading-tight text-zinc-950">
                  {v.name}
                </strong>

                {primaryImage && (
                  <img
                    src={primaryImage}
                    alt={v.name}
                    className="mt-2 h-[132px] w-full rounded-xl object-cover"
                    onError={(e) => {
                      const img =
                        e.currentTarget

                      if (
                        firstCandidate &&
                        img.src !==
                          firstCandidate
                      ) {
                        img.src =
                          firstCandidate
                      }
                    }}
                  />
                )}
              </div>

              <div className="space-y-1 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                {vibeLabel && (
                  <div className="leading-5">
                    <span className="font-semibold text-zinc-700">
                      Vibe:
                    </span>{' '}
                    <span className="text-zinc-600">
                      {vibeLabel}
                    </span>
                  </div>
                )}

                {v.price && (
                  <div>
                    <span className="font-semibold text-zinc-700">
                      Price:
                    </span>{' '}
                    <span className="text-zinc-600">
                      {v.price}
                    </span>
                  </div>
                )}

                <div>
                  <span className="font-semibold text-zinc-700">
                    Status:
                  </span>{' '}
                  <span
                    className={
                      isOpen
                        ? 'font-semibold text-emerald-600'
                        : 'font-semibold text-red-600'
                    }
                  >
                    {isOpen
                      ? 'Open'
                      : 'Closed'}
                  </span>
                </div>

                {todayHours && (
                  <div className="leading-5">
                    <span className="font-semibold text-zinc-700">
                      Hours:
                    </span>{' '}
                    <span className="text-zinc-600">
                      {todayHours}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()

                    void generateRouteFromVenue()
                  }}
                  disabled={
                    generatingRoute ||
                    !canGenerateRoute
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:from-indigo-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {generatingRoute
                      ? 'Building…'
                      : canGenerateRoute
                        ? '✨ Generate Route'
                        : 'Missing Venue ID'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {v.id && (
                    <a
                      href={`/venue-profile/${v.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 transition hover:bg-zinc-100"
                    >
                      More Info
                    </a>
                  )}

                  <div className="flex min-h-[34px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold text-zinc-800 transition hover:bg-zinc-100">
                    <FavoritesButton
                      venue={
                        v as Venue & {
                          id: string
                        }
                      }
                    />
                  </div>
                </div>

                {generateRouteError ? (
                  <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs leading-4 text-red-600">
                    {generateRouteError}
                  </p>
                ) : null}
              </div>

              {upcomingEvents.length >
                0 && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                  <strong className="text-xs uppercase tracking-wide text-zinc-500">
                    Upcoming Events
                  </strong>

                  <ul className="mt-2 space-y-1.5 pl-4 text-xs text-zinc-700">
                    {upcomingEvents.map(
                      (ev) => (
                        <li key={ev.id}>
                          {LuxonDateTime
                            .fromISO(
                              ev.starts_at
                            )
                            .setZone(
                              timezone
                            )
                            .toFormat(
                              'M/d h:mm a'
                            )}{' '}
                          — {ev.title}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Popup>
      )}
    </Marker>
  )
}