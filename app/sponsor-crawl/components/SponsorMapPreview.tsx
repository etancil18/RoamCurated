'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import { SponsorVenue } from '@/types/sponsor';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: (markerIcon as any).src ?? markerIcon,
  shadowUrl: (markerShadow as any).src ?? markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type Props = {
  venues: SponsorVenue[];
  mapboxAccessToken?: string;
  mapboxStyle?: string;
  heightPx?: number;
  useStreetPolyline?: boolean;
  themeTag?: string;
};

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [positions, map]);
  return null;
}

async function fetchStreetPolyline(
  coords: [number, number][],
  token: string
): Promise<[number, number][]> {
  try {
    const coordsStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordsStr}?geometries=geojson&access_token=${token}`;

    const res = await fetch(url);
    const data = await res.json();

    return (
      data.routes?.[0]?.geometry?.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      ) || []
    );
  } catch (err) {
    console.error('[SponsorMapPreview] Failed to fetch polyline:', err);
    return [];
  }
}

const vibeColorMap: Record<string, string> = {
  'Date Night': '#ec4899',
  'Bar Crawl': '#f59e0b',
  'Coffee Tour': '#10b981',
  'Art Walk': '#8b5cf6',
  Default: '#6366f1',
};

export default function SponsorMapPreview({
  venues,
  mapboxAccessToken,
  mapboxStyle,
  heightPx = 300,
  useStreetPolyline = false,
  themeTag = 'Default',
}: Props) {
  const coords = useMemo(
    () => venues.map((v) => [v.lng, v.lat] as [number, number]),
    [venues]
  );

  const [path, setPath] = useState<[number, number][]>([]);

  useEffect(() => {
    if (useStreetPolyline && mapboxAccessToken && coords.length > 1) {
      fetchStreetPolyline(coords, mapboxAccessToken).then(setPath);
    } else {
      setPath(coords.map(([lng, lat]) => [lat, lng]));
    }
  }, [coords, useStreetPolyline, mapboxAccessToken]);

  if (!venues.length || !coords.length) return null;

  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const tileAttribution = '&copy; <a href="https://carto.com/">CARTO</a>';

  const routeColor = vibeColorMap[themeTag] || vibeColorMap.Default;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border shadow"
      style={{ height: heightPx }}
    >
      <MapContainer
        center={[venues[0].lat, venues[0].lng]}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tileUrl} attribution={tileAttribution} />
        <FitBounds positions={path} />
        <Polyline positions={path} color={routeColor} weight={4} />

        {venues.map((v, i) => (
          <Marker key={v.id} position={[v.lat, v.lng]}>
            <Popup>
              <strong>{i + 1}. {v.name}</strong><br />
              {v.city}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {themeTag && (
        <div className="absolute top-2 right-2 bg-white bg-opacity-80 px-3 py-1 rounded text-xs shadow">
          Theme: {themeTag}
        </div>
      )}
    </div>
  );
}