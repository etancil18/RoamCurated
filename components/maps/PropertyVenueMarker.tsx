'use client'

import { Marker, Popup, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'
import type { Marker as LeafletMarker, Icon, DivIcon } from 'leaflet'
import { DateTime } from 'luxon'

import type { Venue } from '@/types/venue'
import { isVenueOpenNow } from '@/utils/timeUtils'
import { coverCandidates, slugifyName } from '@/utils/imageUtils'
import { getVenueMarkerEmoji } from '@/lib/maps/getVenueMarkerEmoji'

type Props = {
  venue: Venue
  index: number
  city: string
  nowForCity: DateTime
  isRouteMode: boolean
  markerDisplayMode?: 'color' | 'emoji'
  markerRefs: React.MutableRefObject<Record<string, LeafletMarker>>
}

const daypartColorMap: Record<string, string> = {
  M: 'blue',
  MD: 'green',
  A: 'orange',
  HH: 'gold',
  E: 'violet',
  L: 'red',
}

/* ------------------------------------------------ */
/* Marker Component                                 */
/* ------------------------------------------------ */

export default function PropertyVenueMarker({
  venue: v,
  index,
  city,
  nowForCity,
  isRouteMode,
  markerDisplayMode = 'emoji',
  markerRefs,
}: Props) {
  void city

  const lat = typeof v.lat === 'string' ? parseFloat(v.lat) : v.lat
  const lon = typeof v.lon === 'string' ? parseFloat(v.lon) : v.lon

  const isOpen = useMemo(() => isVenueOpenNow(v, nowForCity), [v, nowForCity])

  const markerEmoji = useMemo(
    () => getVenueMarkerEmoji((v as any).type ?? (v as any).types ?? null),
    [v]
  )

  /* ------------------------------------------------ */
  /* Icon Logic                                       */
  /* ------------------------------------------------ */

  const icon = useMemo<Icon | DivIcon | null>(() => {
    if (typeof window === 'undefined') return null

    const L = require('leaflet')

    const weekdayIndex = nowForCity.weekday % 7

    const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][weekdayIndex]

    const dp = v.dayParts?.[todayKey] || ''

    /* OPEN venues = bright color by daypart
       CLOSED venues = neutral grey */

    const color = isOpen ? daypartColorMap[dp] || 'green' : 'grey'

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
        grey: '#6b7280',
        gray: '#6b7280',
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
    isOpen,
    markerDisplayMode,
    markerEmoji,
    nowForCity.weekday,
    v.dayParts,
  ])

  if (!icon) return null

  /* ------------------------------------------------ */
  /* Image Logic (Improved Resolver)                  */
  /* ------------------------------------------------ */

  const candidates = coverCandidates(v)

  const normalizedSlug = slugifyName(v.name)

  const smartFallbacks = [
    `/img/venues/${normalizedSlug}.webp`,
    `/img/venues/${normalizedSlug}.jpg`,
    `/img/venues/${normalizedSlug}.jpeg`,
    `/img/venues/${normalizedSlug}.png`,
  ]

  const allCandidates = [...candidates, ...smartFallbacks]

  const primaryImage = allCandidates[0] || '/img/venue-placeholder.jpg'

  const slugKey = v.slug ?? v.id

  /* ------------------------------------------------ */
  /* Render                                           */
  /* ------------------------------------------------ */

  return (
    <Marker
      position={[lat, lon]}
      icon={icon}
      ref={(ref) => {
        if (slugKey && ref) {
          markerRefs.current[slugKey] = ref
        }
      }}
    >
      <Tooltip>{v.name}</Tooltip>

      <Popup maxWidth={260}>
        <div style={{ fontSize: 14 }}>
          <strong>{v.name}</strong>

          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              overflow: 'hidden',
              borderRadius: 8,
              margin: '6px 0',
              background: '#222',
            }}
          >
            <img
              src={primaryImage}
              alt={v.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                const img = e.currentTarget
                const next = allCandidates.shift()

                if (next) {
                  img.src = next
                } else {
                  img.src = '/img/venue-placeholder.jpg'
                }
              }}
            />
          </div>

          {v.vibe && (
            <div>
              <em>Vibe:</em> {v.vibe}
            </div>
          )}

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
        </div>
      </Popup>
    </Marker>
  )
}