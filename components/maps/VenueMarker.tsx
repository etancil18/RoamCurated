'use client'

import { Marker, Popup, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'
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
  const isOpen = useMemo(() => isVenueOpenNow(v, nowForCity), [v, nowForCity])

  const markerEmoji = useMemo(
    () => getVenueMarkerEmoji((v as any).type ?? (v as any).types ?? null),
    [v]
  )

  // ✅ Today’s hours (city-aware)
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

  // Deterministic primary image from slug
  const primaryImage = v.slug ? `/img/venues/${v.slug}.jpg` : firstCandidate

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
          if (v?.id) {
            logVenueImpression('map_marker_click', {
              venue_id: v.id,
              metadata: {
                screen: 'map_marker',
                city,
                name: v.name,
                marker_display_mode: markerDisplayMode,
              },
            })
          }
        },
      }}
    >
      <Tooltip>{v.name}</Tooltip>

      <Popup>
        <div style={{ fontSize: 14 }}>
          <strong>{v.name}</strong>

          {primaryImage && (
            <img
              src={primaryImage}
              alt={v.name}
              style={{
                width: '100%',
                maxHeight: 140,
                objectFit: 'cover',
                margin: '6px 0',
              }}
              onError={(e) => {
                const img = e.currentTarget
                if (firstCandidate && img.src !== firstCandidate) {
                  img.src = firstCandidate
                }
              }}
            />
          )}

          <div>
            <em>Vibe:</em> {v.vibe}
          </div>
          {v.price && (
            <div>
              <em>Price:</em> {v.price}
            </div>
          )}

          <div>
            <em>Status:</em>{' '}
            <span style={{ color: isOpen ? 'green' : 'red' }}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          {/* 🔥 Today’s Hours */}
          {todayHours && (
            <div>
              <em>Hours:</em> {todayHours}
            </div>
          )}

          {v.id && (
            <a
              href={`/venue-profile/${v.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              More Info
            </a>
          )}

          <FavoritesButton venue={v as Venue & { id: string }} />

          {upcomingEvents.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Upcoming Events:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
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
      </Popup>
    </Marker>
  )
}