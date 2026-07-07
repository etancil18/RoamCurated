'use client'

import { Marker, Popup, Tooltip } from 'react-leaflet'
import { useMemo, useState } from 'react'
import type { Venue } from '@/types/venue'
import { isVenueOpenNow } from '@/utils/timeUtils'
import { coverCandidates } from '@/utils/imageUtils'
import { logVenueImpression } from '@/lib/logVenue'
import { FavoritesButton } from '@/components/FavoritesButton'
import type { Marker as LeafletMarker, Icon, DivIcon } from 'leaflet'
import type { DateTime } from 'luxon'
import { DateTime as LuxonDateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'
import { getVenueMarkerEmoji } from '@/lib/maps/getVenueMarkerEmoji'

type Props = {
  venue: Venue
  index: number
  city: string
  nowForCity: DateTime
  isRouteMode: boolean
  markerDisplayMode?: 'color' | 'emoji'
  markerRefs: React.MutableRefObject<Record<string, LeafletMarker>>
  eventsByVenueId: Record<string, any[]>
}

const daypartColorMap: Record<string, string> = {
  M: 'blue',
  MD: 'green',
  A: 'orange',
  HH: 'gold',
  E: 'violet',
  L: 'red',
}

function formatListValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ')
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

export default function VenueMarker({
  venue: v,
  index,
  city,
  nowForCity,
  isRouteMode,
  markerDisplayMode = 'color',
  markerRefs,
  eventsByVenueId,
}: Props) {
  const [generatingRoute, setGeneratingRoute] = useState(false)
  const [generateRouteError, setGenerateRouteError] = useState<string | null>(null)

  const venueKey = getVenueKey(v)
  const canGenerateRoute = Boolean(venueKey)

  const isOpen = useMemo(() => isVenueOpenNow(v, nowForCity), [v, nowForCity])

  const markerEmoji = useMemo(
    () => getVenueMarkerEmoji((v as any).type ?? (v as any).types ?? null),
    [v]
  )

  const vibeLabel = useMemo(() => formatListValue(v.vibe), [v.vibe])

  const todayHours = useMemo(() => {
    if (!Array.isArray(v.hours)) return null

    const today = nowForCity.setLocale('en-US').toFormat('cccc')
    const match = v.hours.find((line: string) =>
      line.toLowerCase().startsWith(today.toLowerCase())
    )

    return match ? match.split(': ').slice(1).join(': ') : null
  }, [v.hours, nowForCity])

  const icon = useMemo<Icon | DivIcon | null>(() => {
    if (typeof window === 'undefined') return null

    const L = require('leaflet')

    const weekdayIndex = nowForCity.weekday % 7
    const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][weekdayIndex]

    const dp = v.dayParts?.[todayKey] || ''
    const color = isOpen ? daypartColorMap[dp] || 'gray' : 'black'

    if (isRouteMode) {
      return new L.DivIcon({
        className: 'numbered-marker',
        html: `
          <div style="
            background:#333;
            color:white;
            border-radius:50%;
            width:24px;
            height:24px;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:12px;
          ">
            ${index + 1}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      })
    }

    if (markerDisplayMode === 'emoji') {
      const borderColorMap: Record<string, string> = {
        blue: '#2563eb',
        green: '#16a34a',
        orange: '#ea580c',
        gold: '#ca8a04',
        violet: '#7c3aed',
        red: '#dc2626',
        gray: '#6b7280',
        black: '#374151',
      }

      const accentColor = borderColorMap[color] ?? '#6b7280'
      const backgroundColor = isOpen ? '#ffffff' : '#e5e7eb'
      const textColor = isOpen ? '#111827' : '#6b7280'

      return new L.DivIcon({
        className: 'emoji-marker',
        html: `
          <div style="
            width:30px;
            height:30px;
            border-radius:9999px;
            background:${backgroundColor};
            border:2px solid ${accentColor};
            box-shadow:0 1px 4px rgba(0,0,0,0.18);
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:16px;
            line-height:1;
            color:${textColor};
          ">
            ${markerEmoji}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [1, -28],
      })
    }

    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
      iconSize: [18, 30],
      iconAnchor: [9, 30],
      popupAnchor: [1, -28],
      shadowSize: [30, 30],
    })
  }, [
    index,
    isRouteMode,
    markerDisplayMode,
    markerEmoji,
    v.dayParts,
    isOpen,
    nowForCity,
  ])

  const venueEvents = eventsByVenueId[v.id] ?? []

  const upcomingEvents = useMemo(() => {
    const nowMillis = nowForCity.toMillis()

    return venueEvents
      .filter((ev) => {
        if (!ev.starts_at) return false
        return LuxonDateTime.fromISO(ev.starts_at).toMillis() >= nowMillis
      })
      .sort(
        (a, b) =>
          LuxonDateTime.fromISO(a.starts_at).toMillis() -
          LuxonDateTime.fromISO(b.starts_at).toMillis()
      )
  }, [venueEvents, nowForCity])

  const firstCandidate = coverCandidates(v)[0]
  const timezone = CITY_CONFIGS[city]?.timezone ?? 'UTC'
  const primaryImage = v.slug ? `/img/venues/${v.slug}.jpg` : firstCandidate

  const generateRouteFromVenue = async () => {
    if (generatingRoute) return

    if (!canGenerateRoute) {
      setGenerateRouteError('This venue is missing an id, slug, and name.')
      console.warn('[generateRouteFromVenue] missing venue identifier', v)
      return
    }

    console.log('[generate route click]', {
      id: v.id,
      slug: v.slug,
      name: v.name,
      city,
    })

    setGeneratingRoute(true)
    setGenerateRouteError(null)

    let payload: any = null

    try {
      logVenueImpression('generate_from_venue_clicked', {
        venue_id: venueKey ?? 'unknown',
        metadata: {
          city,
          name: v.name,
          slug: v.slug ?? null,
          source: 'map_marker_popup',
        },
      })

      const res = await fetch('/api/generate-from-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: v.id ?? null,
          venueSlug: v.slug ?? null,
          venueName: v.name ?? null,
          city,
          plannedStartAt: nowForCity.plus({ minutes: 15 }).toISO(),
          travelMode: 'walking',
          tightness: 'medium',
          maxStops: 5,
          source: 'map_marker',
          debug: true,
        }),
      })

      payload = await res.json().catch(() => null)

      console.log('[generate route payload]', payload)

      console.log('[generate route response]', {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
      })

      if (!res.ok || !payload?.route?.stops?.length) {
        throw new Error(payload?.error || 'Could not generate a route from this venue.')
      }

      const generatedVenues = payload.route.stops
        .map((stop: any) => stop.venue)
        .filter(Boolean)

      console.log('[generated venues before dispatch]', generatedVenues)

      try {
        window.dispatchEvent(
          new CustomEvent('roam:generated-route-from-venue', {
            detail: {
              route: generatedVenues,
              generatedRoute: payload.route,
              anchorVenueId: venueKey,
              city,
            },
          })
        )

        console.log('[generated route event dispatched]')
      } catch (dispatchError) {
        console.error('[generated route dispatch failed]', dispatchError)
        throw dispatchError
      }

      logVenueImpression('generate_from_venue_succeeded', {
        venue_id: venueKey ?? 'unknown',
        metadata: {
          city,
          name: v.name,
          slug: v.slug ?? null,
          stop_count: generatedVenues.length,
          debug: payload?.route?.debug ?? null,
        },
      })
    } catch (error) {
      console.error('[generate route from venue failed after payload]', error, payload)

      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate a route from this venue.'

      setGenerateRouteError(message)

      logVenueImpression('generate_from_venue_failed', {
        venue_id: venueKey ?? 'unknown',
        metadata: {
          city,
          name: v.name,
          slug: v.slug ?? null,
          message,
          debug: payload?.route?.debug ?? null,
        },
      })
    } finally {
      setGeneratingRoute(false)
    }
  }

  if (!icon) return null

  return (
    <Marker
      position={[v.lat, v.lon]}
      icon={icon}
      ref={(ref) => {
        if (v.slug && ref) markerRefs.current[v.slug] = ref
      }}
      eventHandlers={{
        click: () => {
          if (venueKey) {
            logVenueImpression('map_marker_click', {
              venue_id: venueKey,
              metadata: {
                screen: 'map_marker',
                city,
                name: v.name,
                slug: v.slug ?? null,
                marker_display_mode: markerDisplayMode,
              },
            })
          }
        },
      }}
    >
      <Tooltip>{v.name}</Tooltip>

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
                    const img = e.currentTarget
                    if (firstCandidate && img.src !== firstCandidate) {
                      img.src = firstCandidate
                    }
                  }}
                />
              )}
            </div>

            <div className="space-y-1 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
              {vibeLabel && (
                <div className="leading-5">
                  <span className="font-semibold text-zinc-700">Vibe:</span>{' '}
                  <span className="text-zinc-600">{vibeLabel}</span>
                </div>
              )}

              {v.price && (
                <div>
                  <span className="font-semibold text-zinc-700">Price:</span>{' '}
                  <span className="text-zinc-600">{v.price}</span>
                </div>
              )}

              <div>
                <span className="font-semibold text-zinc-700">Status:</span>{' '}
                <span
                  className={
                    isOpen
                      ? 'font-semibold text-emerald-600'
                      : 'font-semibold text-red-600'
                  }
                >
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              </div>

              {todayHours && (
                <div className="leading-5">
                  <span className="font-semibold text-zinc-700">Hours:</span>{' '}
                  <span className="text-zinc-600">{todayHours}</span>
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
                disabled={generatingRoute || !canGenerateRoute}
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
                  <FavoritesButton venue={v as Venue & { id: string }} />
                </div>
              </div>

              {generateRouteError ? (
                <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs leading-4 text-red-600">
                  {generateRouteError}
                </p>
              ) : null}
            </div>

            {upcomingEvents.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                <strong className="text-xs uppercase tracking-wide text-zinc-500">
                  Upcoming Events
                </strong>

                <ul className="mt-2 space-y-1.5 pl-4 text-xs text-zinc-700">
                  {upcomingEvents.map((ev) => (
                    <li key={ev.id}>
                      {LuxonDateTime.fromISO(ev.starts_at)
                        .setZone(timezone)
                        .toFormat('M/d h:mm a')}{' '}
                      — {ev.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}