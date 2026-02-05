'use client'

import { Marker, Popup, Tooltip } from 'react-leaflet'
import { useMemo } from 'react'
import type { Venue } from '@/types/venue'
import { isVenueOpenNow } from '@/utils/timeUtils'
import { coverCandidates } from '@/utils/imageUtils'
import { logVenueImpression } from '@/lib/logVenue'
import { FavoritesButton } from '@/components/FavoritesButton'
import type { Marker as LeafletMarker, Icon, DivIcon } from 'leaflet'

type Props = {
  venue: Venue
  index: number
  city: string
  isRouteMode: boolean
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
  isRouteMode,
  markerRefs,
  eventsByVenueId,
}: Props) {
  const isOpen = isVenueOpenNow(v)

  const icon = useMemo<Icon | DivIcon | null>(() => {
    if (typeof window === 'undefined') return null

    // ⛑️ Import Leaflet ONLY on the client
    const L = require('leaflet')

    const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][
      new Date().getDay()
    ]
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

    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
      iconSize: [18, 30],
      iconAnchor: [9, 30],
      popupAnchor: [1, -28],
      shadowSize: [30, 30],
    })
  }, [index, isRouteMode, v.dayParts, isOpen])

  const venueEvents = eventsByVenueId[v.id] ?? []

  const upcomingEvents = useMemo(() => {
    const now = Date.now()
    return venueEvents
      .filter((ev) => ev.starts_at && new Date(ev.starts_at).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime()
      )
  }, [venueEvents])

  const firstCandidate = coverCandidates(v)[0]

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

          {(v.cover || firstCandidate) && (
            <img
              src={`/${v.cover || firstCandidate}`}
              alt={v.name}
              style={{
                width: '100%',
                maxHeight: 140,
                objectFit: 'cover',
                margin: '6px 0',
              }}
            />
          )}

          <div><em>Vibe:</em> {v.vibe}</div>
          {v.price && <div><em>Price:</em> {v.price}</div>}

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

          <FavoritesButton venue={v as Venue & { id: string }} />

          {upcomingEvents.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Upcoming Events:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                {upcomingEvents.map((ev) => (
                  <li key={ev.id}>
                    {new Date(ev.starts_at).toLocaleString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
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
