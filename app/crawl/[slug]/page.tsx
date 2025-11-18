// app/crawl/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import MapCanvas from '@/components/maps/MapCanvas'
import type { Venue } from '@/types/venue'

export const dynamic = 'force-dynamic'

type SavedRouteResponse = {
  stops: {
    name: string
    lat: number
    lon: number
    type?: string
    image_url?: string
  }[]
  city: string | null
}

function normalizeCity(value: string | null): 'atl' | 'nyc' {
  if (!value) return 'nyc'

  const v = value.toLowerCase()

  if (v === 'atl' || v === 'atlanta') return 'atl'
  if (v === 'nyc' || v === 'new-york' || v === 'newyork' || v === 'ny') return 'nyc'

  // Default fallback
  return 'nyc'
}

export default async function CrawlPage({ params }: { params: { slug: string } }) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('saved_routes')
    .select('stops, city')
    .eq('slug', params.slug)
    .single<SavedRouteResponse>()

  if (error || !data || !Array.isArray(data.stops)) {
    console.error('[crawl/[slug]] Failed to load route for slug:', params.slug, error?.message)
    notFound()
  }

  const city = normalizeCity(data.city)

  const route: Venue[] = data.stops.map((stop) => ({
    id: stop.name,
    name: stop.name,
    slug: stop.name.toLowerCase().replace(/\s+/g, '-'),
    lat: stop.lat,
    lon: stop.lon,
    type: stop.type ?? undefined,
    cover: stop.image_url ?? undefined,
    link: '',
    instagram_handle: undefined,
    tags: undefined,
    tier: undefined,
    timeCategory: undefined,
    energyRamp: undefined,
    price: undefined,
    duration: undefined,
    city,
  }))

  return (
    <main className="h-screen w-screen">
      <MapCanvas
        venues={route}
        route={route}
        city={city}
        themeId={undefined}
        travelMode="walking"
      />
    </main>
  )
}
