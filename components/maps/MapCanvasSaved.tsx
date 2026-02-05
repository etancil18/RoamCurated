'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { Venue } from '@/types/venue'
import { logEvent } from '@/lib/logEvent'
import { logVenueImpression } from '@/lib/logVenue'
import { inBrowser } from '@/lib/browser'

const defaultCenter: Record<'atl' | 'nyc', [number, number]> = {
  atl: [33.749, -84.388],
  nyc: [40.73061, -73.935242],
}

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map])

  return null
}

function numberedMarkerIcon(number: number): L.DivIcon {
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
        font-weight:600;
      ">
        ${number}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

async function fetchRoutePolyline(
  venues: Venue[],
  token: string
): Promise<[number, number][]> {
  const coords = venues.map((v) => `${v.lon},${v.lat}`).join(';')
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&access_token=${token}`

  const res = await fetch(url)
  const json = await res.json()
  if (!json.routes || json.routes.length === 0) return []

  const line: any = json.routes[0].geometry
  return line.coordinates.map((c: any) => [c[1], c[0]])
}

export default function MapCanvasSaved({
  venues,
  city,
}: {
  venues: Venue[]
  city: 'atl' | 'nyc'
}) {
  const mapRef = useRef<L.Map | null>(null)
  const [polyline, setPolyline] = useState<[number, number][]>([])
  const [enableScrollZoom, setEnableScrollZoom] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    fetchRoutePolyline(venues, token).then(setPolyline).catch(console.error)
  }, [venues])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const bounds = L.latLngBounds(
      venues.map((v) => [v.lat, v.lon] as [number, number])
    )

    if (polyline.length > 0) {
      bounds.extend(polyline)
    }

    map.fitBounds(bounds, { padding: [50, 50] })
  }, [venues, polyline])

  useEffect(() => {
    venues.forEach((v, index) => {
      if (!v?.id) return

      logEvent('saved_crawl_map_view', {
        venue_id: v.id,
        metadata: {
          screen: 'saved_crawl_map',
          city,
          position_in_crawl: index,
        },
      })
    })
  }, [venues, city])

  // ✅ Safe window guard
  useEffect(() => {
    if (inBrowser()) {
      setEnableScrollZoom(window.innerWidth >= 768)
    }
  }, [])

  return (
    <div className="h-screen w-screen relative">
      <MapContainer
        center={defaultCenter[city]}
        zoom={12}
        style={{ height: '100vh', width: '100%' }}
        scrollWheelZoom={enableScrollZoom}
        dragging
        zoomControl={false}
      >
        <MapRefSetter mapRef={mapRef} />

        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
        />

        {polyline.length > 0 && (
          <Polyline positions={polyline} color="cyan" weight={4} opacity={0.85} />
        )}

        {venues.map((v, idx) => (
          <Marker
            key={`${v.id}-${idx}`}
            position={[v.lat, v.lon]}
            icon={numberedMarkerIcon(idx + 1)}
          >
            <Tooltip>{v.name}</Tooltip>
            <Popup>
              <div style={{ fontSize: 14 }}>
                <strong>{v.name}</strong>
                {v.cover && (
                  <img
                    src={`/${v.cover}`}
                    alt={v.name}
                    style={{
                      width: '100%',
                      maxHeight: 140,
                      objectFit: 'cover',
                      margin: '6px 0',
                    }}
                  />
                )}
                <div>
                  <a
                    href={v.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    More Info
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
