'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [mounted, setMounted] = useState(false)
  const [Leaflet, setLeaflet] = useState<any>(null)
  const [RL, setRL] = useState<any>(null)
  const [path, setPath] = useState<[number, number][]>([])

  const coords = useMemo(
    () =>
      venues
        .filter(v => typeof v.lat === 'number' && typeof v.lon === 'number')
        .map(v => [v.lon, v.lat] as [number, number]),
    [venues]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // 🔒 Load Leaflet ONLY on client
  useEffect(() => {
    if (!mounted) return

    let active = true

    async function load() {
      const L = (await import('leaflet')).default
      await import('leaflet-arrowheads')
      const RL = await import('react-leaflet')

      if (!active) return

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      setLeaflet(L)
      setRL(RL)
    }

    load()
    return () => {
      active = false
    }
  }, [mounted])

  // Polyline logic
  useEffect(() => {
    if (!useStreetPolyline || !mapboxAccessToken || coords.length < 2) {
      setPath(coords.map(([lng, lat]) => [lat, lng]))
      return
    }

    async function fetchPolyline() {
      try {
        const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordStr}?geometries=geojson&access_token=${mapboxAccessToken}`
        )
        const json = await res.json()
        const g = json.routes?.[0]?.geometry?.coordinates
        if (g?.length) {
          setPath(g.map(([lng, lat]: [number, number]) => [lat, lng]))
        }
      } catch {
        setPath(coords.map(([lng, lat]) => [lat, lng]))
      }
    }

    fetchPolyline()
  }, [coords, mapboxAccessToken, useStreetPolyline])

  if (!mounted || !Leaflet || !RL || !coords.length) return null

  const {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    useMap,
  } = RL

  const routeColor = vibeColorMap[themeTag] ?? vibeColorMap.Default

  function FitBounds() {
    const map = useMap()
    useEffect(() => {
      if (!path.length) return
      map.fitBounds(path, { padding: [40, 40] })
    }, [map])
    return null
  }

  return (
    <div style={{ height: heightPx }} className="rounded-xl overflow-hidden border">
      <MapContainer
        center={[venues[0].lat, venues[0].lon]}
        zoom={13}
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
