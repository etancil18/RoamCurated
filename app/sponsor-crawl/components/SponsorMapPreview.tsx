'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SponsorVenue } from '@/types/sponsor'

type Props = {
  venues: SponsorVenue[]
  mapboxAccessToken?: string
  heightPx?: number
  useStreetPolyline?: boolean
  themeTag?: string
  travelMode?: 'walking' | 'cycling' | 'driving'
}

const vibeColorMap: Record<string, string> = {
  'Date Night': '#ec4899',
  'Bar Crawl': '#f59e0b',
  'Coffee Tour': '#10b981',
  'Art Walk': '#8b5cf6',
  Default: '#6366f1',
}

const mapboxProfileMap = {
  walking: 'walking',
  cycling: 'cycling',
  driving: 'driving',
} as const

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function SponsorMapPreview({
  venues,
  mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
  heightPx = 300,
  useStreetPolyline = true,
  themeTag = 'Default',
  travelMode = 'walking',
}: Props) {
  const [path, setPath] = useState<[number, number][]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  const coords = useMemo(
    () =>
      venues
        .filter((v) => typeof v.lat === 'number' && typeof v.lon === 'number')
        .map((v) => [v.lon, v.lat] as [number, number]),
    [venues]
  )

  useEffect(() => {
    const fallbackPath = coords.map(([lng, lat]) => [lat, lng] as [number, number])

    if (!useStreetPolyline || !mapboxAccessToken || coords.length < 2) {
      setPath(fallbackPath)
      return
    }

    async function fetchPolyline() {
      try {
        const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
        const profile = mapboxProfileMap[travelMode] ?? 'walking'

        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?geometries=geojson&overview=full&access_token=${mapboxAccessToken}`
        )

        const json = await res.json()
        const geometry = json.routes?.[0]?.geometry?.coordinates

        if (geometry?.length) {
          setPath(
            geometry.map(([lng, lat]: [number, number]) => [lat, lng])
          )
        } else {
          setPath(fallbackPath)
        }
      } catch {
        setPath(fallbackPath)
      }
    }

    fetchPolyline()
  }, [coords, mapboxAccessToken, useStreetPolyline, travelMode])

  const routeColor = vibeColorMap[themeTag] ?? vibeColorMap.Default

  function FitBounds() {
    const map = useMap()
    const didFitRef = useRef(false)

    useEffect(() => {
      if (!path.length || didFitRef.current) return

      const timeout = setTimeout(() => {
        map.invalidateSize()
        map.fitBounds(path, { padding: [40, 40] })
        didFitRef.current = true
      }, 200)

      return () => clearTimeout(timeout)
    }, [map])

    return null
  }

  if (!coords.length) return null

  return (
    <div
      ref={containerRef}
      style={{ height: heightPx }}
      className="rounded-xl overflow-hidden border"
    >
      <MapContainer
        center={[venues[0].lat, venues[0].lon]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FitBounds />
        <Polyline positions={path} color={routeColor} weight={4} />

        {venues.map((v, i) => (
          <Marker key={v.id} position={[v.lat, v.lon]}>
            <Popup>
              <strong>{i + 1}. {v.name}</strong>
              <br />
              {v.city}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}