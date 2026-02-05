'use client';

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { CITY_CONFIGS } from '@/config/cities'

type Props = {
  onSelectCity: (slug: string) => void
  excludedCity?: string | null
}

export default function CityOverviewMarkers({
  onSelectCity,
  excludedCity = null,
}: Props) {
  const cityIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    iconSize: [20, 32],
    iconAnchor: [10, 32],
    popupAnchor: [1, -32],
    shadowSize: [32, 32],
  })

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
