'use client'

import { useEffect, useRef, useState } from 'react'
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



import type { Venue } from '@/types/venue'
import RouteControl from '@/components/RouteControl'
import { isVenueOpenNow } from '@/utils/timeUtils'
import { coverCandidates } from '@/utils/imageUtils'
import { themeById } from '@/lib/crawlConfig'
import { FavoritesButton } from '@/components/FavoritesButton'

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
  'patio-perfection': 'pink',
  'saturday-surge': 'gold',
  'solo-explorer': 'gray',
  'sunset-lovers': 'violet',
  'sunday-reset': 'olive',
  'work-session': 'cyan',
}

const userLocationIcon = L.divIcon({
  className: 'custom-dot-marker',
  iconSize: [12, 12], // size of the dot
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

export default function MapCanvas({
  venues,
  route,
  city,
  onMapClick,
  themeId,
  travelMode,
}: {
  venues: Venue[]
  route?: Venue[]
  city: 'atl' | 'nyc'
  onMapClick?: (lat: number, lon: number) => void
  themeId?: string
  travelMode: 'walking' | 'cycling' | 'driving'
}) {
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<Record<string, L.Marker>>({})
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null)

  const defaultCenter: Record<'atl' | 'nyc', [number, number]> = {
    atl: [33.749, -84.388],
    nyc: [40.73061, -73.935242],
  }

  const visibleRoute = route?.length && route.length > 1 ? route : []
  const visibleVenues = visibleRoute.length > 0 ? visibleRoute : venues
  const themeName = themeId ? themeById[themeId]?.description : null
  const lineColor = themeColorMap[themeId ?? ''] ?? 'cyan'

  // 🌆 Smooth city transition animation
  useEffect(() => {
    const map = mapRef.current
    const newCenter = defaultCenter[city]

    if (!map) return

    map.flyTo(map.getCenter(), 4, { animate: true, duration: 1.25 })

    const id = setTimeout(() => {
      map.flyTo(newCenter, 12, { animate: true, duration: 1.75 })
    }, 600)

    return () => {
      clearTimeout(id)
    }
  }, [city])

  // 📍 Fit bounds to route when visibleRoute changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || visibleRoute.length < 2) return

    const bounds = L.latLngBounds(
      visibleRoute.map((v) => [v.lat, v.lon])
    )

    map.fitBounds(bounds, { padding: [50, 50] })
  }, [visibleRoute])

  // 🖱️ Map click handler
  useEffect(() => {
    const map = mapRef.current
    if (!map || !onMapClick) return

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handler)

    return () => {
      map.off('click', handler)
    }
  }, [onMapClick])

  // 📡 Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserPosition([latitude, longitude])
      },
      (error) => {
        console.warn("Geolocation error:", error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }, [])

  return (
    <div className="h-screen w-screen relative">
      {themeName && (
        <div className="absolute top-4 right-4 z-[1000] bg-white px-3 py-1 rounded shadow text-xs font-semibold">
          Theme: {themeName}
        </div>
      )}

      <MapContainer center={defaultCenter[city]} zoom={12} className="h-full w-full z-0">
        <MapRefSetter mapRef={mapRef} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {visibleVenues.map((v, idx) => {
          const today = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
          const isOpen = isVenueOpenNow(v)
          const dp = v.dayParts?.[today] || ''
          const color = isOpen ? daypartColorMap[dp] || 'gray' : 'black'

          const icon = visibleRoute.length > 0
            ? numberedMarkerIcon(idx + 1)
            : new L.Icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
                shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
              })

          const firstCandidate = coverCandidates(v)[0]

          return (
            <Marker
              key={v.slug ?? v.name}
              position={[v.lat, v.lon]}
              icon={icon}
              ref={(ref) => {
                if (v.slug && ref) markerRefs.current[v.slug] = ref
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

    <div><em>Vibe:</em> {v.vibe || 'N/A'}</div>

    {v.price && <div><em>Price:</em> {v.price}</div>}

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

    {v.link && (
      <a href={v.link} target="_blank" rel="noopener noreferrer">
        More Info
      </a>
    )}

    {!v.id && (() => {
      console.warn('⚠️ Venue missing id for favorites:', v);
      return null;
    })()}

    <FavoritesButton venue={v as Venue & { id: string }} />
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
