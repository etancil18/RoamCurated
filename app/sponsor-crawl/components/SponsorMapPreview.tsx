'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
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
}

const vibeColorMap: Record<string, string> = {
  'Date Night': '#ec4899',
  'Bar Crawl': '#f59e0b',
  'Coffee Tour': '#10b981',
  'Art Walk': '#8b5cf6',
  Default: '#6366f1',
}

export default function SponsorMapPreview({
  venues,
  mapboxAccessToken,
  heightPx = 300,
  useStreetPolyline = true,
  themeTag = 'Default',
}: Props) {
  const [path, setPath] = useState<[number, number][]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  /* ----------------------------------------------------------
     SAFE LEAFLET ICON FIX (CLIENT-ONLY)
  ----------------------------------------------------------- */
  useEffect(() => {
    if (typeof window === 'undefined') return

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  const coords = useMemo(
    () =>
      venues
        .filter(v => typeof v.lat === 'number' && typeof v.lon === 'number')
        .map(v => [v.lon, v.lat] as [number, number]),
    [venues]
  )

  /* ----------------------------------------------------------
     MAPBOX POLYLINE FETCH
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!coords.length) {
      setPath([])
      return
    }

    if (!useStreetPolyline || !mapboxAccessToken || coords.length < 2) {
      setPath(coords.map(([lng, lat]) => [lat, lng]))
      return
    }

    let cancelled = false

    async function fetchPolyline() {
      try {
        const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordStr}?geometries=geojson&access_token=${mapboxAccessToken}`
        )
        const json = await res.json()
        const g = json.routes?.[0]?.geometry?.coordinates

        if (!cancelled && g?.length) {
          setPath(g.map(([lng, lat]: [number, number]) => [lat, lng]))
        }
      } catch {
        if (!cancelled) {
          setPath(coords.map(([lng, lat]) => [lat, lng]))
        }
      }
    }

    fetchPolyline()

    return () => {
      cancelled = true
    }
  }, [coords, mapboxAccessToken, useStreetPolyline])

  const routeColor = vibeColorMap[themeTag] ?? vibeColorMap.Default

  function FitBounds() {
    const map = useMap()

    useEffect(() => {
      if (!path.length) return

      const timeout = setTimeout(() => {
        map.invalidateSize()
        map.fitBounds(path, { padding: [40, 40] })
      }, 250)

      return () => clearTimeout(timeout)
    }, [map, path])

    return null
  }

  if (!coords.length) return null

  const safeCenter: [number, number] = [coords[0][1], coords[0][0]]

  return (
    <div
      ref={containerRef}
      style={{ height: heightPx }}
      className="rounded-xl overflow-hidden border"
    >
      <MapContainer
        center={safeCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FitBounds />

        {path.length > 1 && (
          <Polyline positions={path} color={routeColor} weight={4} />
        )}

        {venues.map((v, i) => (
          typeof v.lat === 'number' &&
          typeof v.lon === 'number' && (
            <Marker key={v.id} position={[v.lat, v.lon]}>
              <Popup>
                <strong>
                  {i + 1}. {v.name}
                </strong>
                <br />
                {v.city}
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  )
}