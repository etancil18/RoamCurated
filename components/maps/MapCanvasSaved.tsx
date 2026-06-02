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
import 'leaflet/dist/leaflet.css'

import type { Venue } from '@/types/venue'
import { logEvent } from '@/lib/logEvent'

const defaultCenter: Record<
  'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la',
  [number, number]
> = {
  atl: [33.749, -84.388],
  nyc: [40.73061, -73.935242],
  lisbon: [38.7223, -9.1393],
  porto: [41.1579, -8.6291],
  london: [51.5072, -0.1276],
  la: [34.0522, -118.2437],
}

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<any> }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map])

  return null
}

export default function MapCanvasSaved({
  venues,
  city,
}: {
  venues: Venue[]
  city: 'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la'
}) {
  const mapRef = useRef<any>(null)
  const [polyline, setPolyline] = useState<[number, number][]>([])
  const [enableScrollZoom, setEnableScrollZoom] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [tileToken, setTileToken] = useState<string | null>(null)

  // ✅ Only import Leaflet on client
  const numberedMarkerIcon = (number: number) => {
    if (typeof window === 'undefined') return undefined
    const L = require('leaflet')
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

    const line = json.routes[0].geometry
    return line.coordinates.map((c: any) => [c[1], c[0]])
  }

  // ✅ Setup map and route on mount
  useEffect(() => {
    setHasMounted(true)

    if (typeof window !== 'undefined') {
      setEnableScrollZoom(window.innerWidth >= 768)
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (token) {
      setTileToken(token)
      if (venues.length) {
        fetchRoutePolyline(venues, token).then(setPolyline).catch(console.error)
      }
    }
  }, [venues])

  // ✅ Fit map bounds client-side
  useEffect(() => {
    if (!mapRef.current || !hasMounted) return
    const L = require('leaflet')

    const bounds = L.latLngBounds(venues.map((v) => [v.lat, v.lon]))
    if (polyline.length > 0) {
      bounds.extend(polyline)
    }

    mapRef.current.fitBounds(bounds, { padding: [50, 50] })
  }, [venues, polyline, hasMounted])

  // ✅ Log venue impressions
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

  if (!hasMounted || !tileToken) return null

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
          url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${tileToken}`}
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
