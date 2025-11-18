'use client';

import dynamic from 'next/dynamic';
import { Suspense, useMemo, useState } from 'react';
import atlantaData from '@/data/atlanta';
import nycData from '@/data/nyc';
import type { Venue } from '@/types/venue';

const MapCanvas = dynamic(() => import('@/components/maps/MapCanvas'), {
  ssr: false,
});

function normalizeData(data: any[]): Venue[] {
  return data.map((d) => ({
    ...d,
    lat: typeof d.lat === 'string' ? parseFloat(d.lat) : d.lat,
    lon: typeof d.lon === 'string' ? parseFloat(d.lon) : d.lon,
  }));
}

export default function MapPage() {
  const [city, setCity] = useState<'atl' | 'nyc'>('atl');

  const venues = useMemo(() => {
    const raw = city === 'atl' ? atlantaData : nycData;
    return normalizeData(raw);
  }, [city]);

  return (
    <main className="h-screen w-screen">
      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow p-2 space-x-2">
        <button
          onClick={() => setCity('atl')}
          className={`px-4 py-1 rounded ${city === 'atl' ? 'bg-black text-white' : 'bg-gray-200'}`}
        >
          ATL
        </button>
        <button
          onClick={() => setCity('nyc')}
          className={`px-4 py-1 rounded ${city === 'nyc' ? 'bg-black text-white' : 'bg-gray-200'}`}
        >
          NYC
        </button>
      </div>

      <Suspense fallback={<div className="text-center p-4">Loading map...</div>}>
        <MapCanvas
  venues={venues}
  city={city}
  travelMode="walking" // or state
/>

      </Suspense>
    </main>
  );
}
