'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L, { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import 'leaflet-extra-markers/dist/css/leaflet.extra-markers.min.css'
import { logEvent } from '@/lib/logEvent'
import { logVenueImpression } from '@/lib/logVenue'
import type { Venue } from '@/types/venue'
import RouteControl from '@/components/RouteControl'
import { isVenueOpenNow } from '@/utils/timeUtils'
import { coverCandidates } from '@/utils/imageUtils'
import { themeById } from '@/lib/crawlConfig'
import { FavoritesButton } from '@/components/FavoritesButton'

/* ============================================================
   EVENT FETCHING HOOK (Embedded Version)
   ============================================================ */

function useEvents(city: 'atl' | 'nyc', daysAhead = 7) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const from = new Date()
      const to = new Date()
      to.setDate(to.getDate() + daysAhead)

      const params = new URLSearchParams({
        city,
        from: from.toISOString(),
        to: to.toISOString(),
      })

      try {
        const res = await fetch(`/api/events?${params.toString()}`)
        const json = await res.json()
        setEvents(json.events ?? [])
      } catch (err) {
        console.error('Error fetching events:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [city, daysAhead])

  return { events, loading }
}

/* ============================================================
   ORIGINAL CONSTANTS
   ============================================================ */

const daypartColorMap: Record<string, string> = {
  M: 'blue',
  MD: 'green',
  A: 'orange',
  HH: 'gold',
  E: 'violet',
  L: 'red',
}

const themeColorMap: Record<string, string> = {
  'cheap-cheerful': 'green',
  'chill-hang': 'blue',
  'creative-kickstart': 'orange',
  'date-night': 'purple',
  'friends-night-out': 'red',
  'gallery-crawl': 'teal',
  'gameday-vibes': 'brown',
  'saturday-surge': 'gold',
  'solo-explorer': 'gray',
  'active-all-day': 'violet',
  'sunday-reset': 'olive',
  'work-session': 'cyan',
}

const userLocationIcon = L.divIcon({
  className: 'custom-dot-marker',
  iconSize: [12, 12],
})

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map])

  return null
}

function numberedMarkerIcon(number: number) {
  return new L.DivIcon({
    className: 'numbered-marker',
    html: `<div style="background:#333;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

/* ============================================================
   MAP COMPONENT
   ============================================================ */

export default function MapCanvas({
  venues,
  route,
  city,
  onMapClick,
  themeId,
  travelMode,
  showLiveEventsOnly,
}: {
  venues: Venue[]
  route?: Venue[]
  city: 'atl' | 'nyc'
  onMapClick?: (lat: number, lon: number) => void
  themeId?: string
  travelMode: 'walking' | 'cycling' | 'driving'
   showLiveEventsOnly?: boolean 
}) {
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Record<string, L.Marker>>({})
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null)

  /* ============================================================
     🎉 FETCH EVENTS FOR THIS CITY
     ============================================================ */
  const { events } = useEvents(city)

// Group events by venue_id
const eventsByVenueId = useMemo(() => {
  const map: Record<string, any[]> = {}
  for (const ev of events) {
    if (!ev.venue?.id) continue
    const vId = ev.venue.id
    if (!map[vId]) map[vId] = []
    map[vId].push(ev)
  }
  return map
}, [events])

const defaultCenter: Record<'atl' | 'nyc', [number, number]> = {
  atl: [33.749, -84.388],
  nyc: [40.73061, -73.935242],
}

const visibleRoute = route?.length && route.length > 1 ? route : []

// ✅ Unified visibleVenues logic with live events filtering
const visibleVenues = useMemo(() => {
  const base = visibleRoute.length > 0 ? visibleRoute : venues

  if (showLiveEventsOnly) {
    return base.filter((v) => {
      const evs = eventsByVenueId[v.id] ?? []
      const hasValidEvent = evs.some((ev) => !!ev.venue?.id)
      if (!hasValidEvent) {
        console.warn(
          '[MapCanvas] Venue skipped (no matching event):', 
          v.id, v.name, evs
        )
      }
      return hasValidEvent
    })
  }

  return base
}, [venues, visibleRoute, eventsByVenueId, showLiveEventsOnly])



const lineColor = themeColorMap[themeId ?? ''] ?? 'cyan'

useEffect(() => {
  logEvent('map_opened', {
    metadata: {
      screen: 'map',
      city,
    },
  })
}, [city])


  /* ============================================================
     MAP TRANSITIONS & EFFECTS
     ============================================================ */

  useEffect(() => {
    const map = mapRef.current
    const newCenter = defaultCenter[city]

    if (!map) return

    map.flyTo(map.getCenter(), 4, { animate: true, duration: 1.25 })

    const id = setTimeout(() => {
      map.flyTo(newCenter, 12, { animate: true, duration: 1.75 })
    }, 600)

    return () => clearTimeout(id)
  }, [city])

  useEffect(() => {
    const map = mapRef.current
    if (!map || visibleRoute.length < 2) return

    const bounds = L.latLngBounds(visibleRoute.map((v) => [v.lat, v.lon]))
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [visibleRoute])

 useEffect(() => {
  const map = mapRef.current
  if (!map || !onMapClick) return

  const handler = (e: L.LeafletMouseEvent) => {
    onMapClick(e.latlng.lat, e.latlng.lng)
  }

  map.on('click', handler)

  // Cleanup must return ONLY a function (not a map, not undefined from inner calls)
  return () => {
    map.off('click', handler)
  }
}, [onMapClick])


  useEffect(() => {
  if (!navigator.geolocation) {
    setUserPosition(defaultCenter[city])
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setUserPosition([position.coords.latitude, position.coords.longitude])
    },
    (err) => {
      console.warn('Geolocation error:', err)
      setUserPosition(defaultCenter[city]) // ✅ fallback to city center
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  )
}, [city])


  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="h-screen w-screen relative">
      <MapContainer
        center={defaultCenter[city]}
        zoom={12}
        style={{ height: '100vh', width: '100%' }}
        scrollWheelZoom={typeof window !== 'undefined' && window.innerWidth >= 768}
        dragging={true}
        zoomControl={false}
      >
        <MapRefSetter mapRef={mapRef} />

        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {visibleVenues.map((v, idx) => {
          const today = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
          const isOpen = isVenueOpenNow(v)
          const dp = v.dayParts?.[today] || ''
          const color = isOpen ? daypartColorMap[dp] || 'gray' : 'black'
          const icon = visibleRoute.length
            ? numberedMarkerIcon(idx + 1)
            : new L.Icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
                shadowUrl:
                  'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
                iconSize: [18, 30],
                iconAnchor: [9, 30],
                popupAnchor: [1, -28],
                shadowSize: [30, 30],
              })
          const firstCandidate = coverCandidates(v)[0]

          const venueEvents = eventsByVenueId[v.id] ?? []

          return (
          <Marker
  key={v.slug ?? v.name}
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

                  {/* Hours */}
                  {Array.isArray(v.hours) && (() => {
                    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
                    const match = v.hours.find((line: string) => line.startsWith(today))
                    const todayHours = match ? match.split(': ').slice(1).join(': ') : 'N/A'
                    return <div><em>Hours:</em> {todayHours}</div>
                  })()}

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
    onClick={() => {
      logVenueImpression('map_more_info_click', {
        venue_id: v.id,
        metadata: {
          screen: 'map_more_info',
          city,
          name: v.name,
        },
      })
    }}
  >
    More Info
  </a>
)}



                  <FavoritesButton venue={v as Venue & { id: string }} />

                  {/* ============================================================
                      🎉 UPCOMING EVENTS SECTION
                      ============================================================ */}

                  {(() => {
                      const venueId = v.id
                      const venueEvents = eventsByVenueId[venueId] ?? []
                      const now = Date.now()

                      // ✅ Filter & sort only current or upcoming events
                      const upcoming = venueEvents
                        .filter((ev) => {
                          if (!ev.starts_at) {
                            console.warn('[MapCanvas] Event missing starts_at:', ev)
                            return false
                          }
                          const startTs = new Date(ev.starts_at).getTime()
                          return startTs >= now
                        })
                        .sort((a, b) => {
                          return new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime()
                        })

                      if (upcoming.length === 0) {
                        return null
                      }

                      return (
                        <div style={{ marginTop: 12 }}>
                          <strong>Upcoming Events:</strong>
                          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                            {upcoming.map((ev) => (
                              <li key={ev.id}>
                                {new Date(ev.starts_at!).toLocaleString('en-US', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}{' '}
                                @ {new Date(ev.starts_at!).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })} — {ev.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}

                </div>
              </Popup>
            </Marker>
          )
        })}

        {userPosition && (
          <Marker position={userPosition} icon={userLocationIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {visibleRoute.length > 1 && (
          <RouteControl
            key={`route-${travelMode}`}
            route={visibleRoute}
            color={lineColor}
            travelMode={travelMode}
          />
        )}
      </MapContainer>
    </div>
  )
}
