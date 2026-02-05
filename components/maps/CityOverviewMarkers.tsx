'use client'

import { useEffect, useState, useMemo } from 'react'
import { CITY_CONFIGS } from '@/config/cities'

type Props = {
  onSelectCity: (slug: string) => void
  excludedCity?: string | null
}

export default function CityOverviewMarkers({
  onSelectCity,
  excludedCity = null,
}: Props) {
  const [leaflet, setLeaflet] = useState<any>(null)
  const [RL, setRL] = useState<any>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const L = (await import('leaflet')).default
      const RL = await import('react-leaflet')
      if (active) {
        setLeaflet(L)
        setRL(RL)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const cityIcon = useMemo(() => {
    if (!leaflet) return null
    return new leaflet.Icon({
      iconUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
      iconSize: [20, 32],
      iconAnchor: [10, 32],
      popupAnchor: [1, -32],
      shadowSize: [32, 32],
    })
  }, [leaflet])

  if (!leaflet || !RL || !cityIcon) return null

  const { Marker, Tooltip } = RL

  return (
    <>
      {Object.entries(CITY_CONFIGS)
        .filter(([slug]) => slug !== excludedCity)
        .map(([slug, config]) => (
          <Marker
            key={slug}
            position={config.center}
            icon={cityIcon}
            eventHandlers={{
              click: () => onSelectCity(slug),
            }}
          >
            <Tooltip>{config.name}</Tooltip>
          </Marker>
        ))}
    </>
  )
}
