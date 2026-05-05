import { createServerClient } from '@/lib/supabase/server'
import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'
import CrawlMap from './CrawlMap'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    city?: string
    venues?: string
    property_id?: string
    property_slug?: string
  }>
}

export default async function PropertyCrawlPage({ searchParams }: Props) {
  const supabase = await createServerClient()

  const resolvedSearchParams = await searchParams

  const city = resolvedSearchParams.city ?? ''
  const venueIds = (resolvedSearchParams.venues ?? '')
    .split(',')
    .filter(Boolean)
  const propertyId = resolvedSearchParams.property_id
  const propertySlug = resolvedSearchParams.property_slug

  /* ------------------------------------------------ */
  /* Fetch venues                                     */
  /* ------------------------------------------------ */

  const { data } = await supabase
    .from('venues')
    .select('*')
    .in('id', venueIds)

  // ✅ FIX: Preserve original crawl order
  const venueMap = new Map(
    (data ?? []).map((v: any) => [
      v.id,
      {
        ...v,
        link: `/venue-profile/${v.id}`,
      },
    ])
  )

  const venues = venueIds
    .map((id) => venueMap.get(id))
    .filter(Boolean)

  /* ------------------------------------------------ */
  /* Fetch property (if provided)                     */
  /* ------------------------------------------------ */

  let property = {
    name: 'Property',
    lat: venues[0]?.lat ?? 0,
    lon: venues[0]?.lon ?? 0,
    city,
    slug: propertySlug,
  }

  if (propertyId) {
    const { data: propertyData } = await supabase
      .from('properties')
      .select('name, lat, lon, city, slug')
      .eq('id', propertyId)
      .limit(1)

    if (propertyData?.[0]) {
      property = propertyData[0]
    }
  }

  /* ------------------------------------------------ */
  /* City-aware time                                  */
  /* ------------------------------------------------ */

  const timezone = CITY_CONFIGS[city]?.timezone ?? 'UTC'

  const nowISO =
    DateTime.now()
      .setZone(timezone)
      .toISO() ?? new Date().toISOString()

  /* ------------------------------------------------ */
  /* Marker refs                                      */
  /* ------------------------------------------------ */

  const markerRefs = { current: {} as Record<string, any> }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-4 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">

      <h1 className="text-xl font-bold">
        Crawl Route
      </h1>

      <CrawlMap
        venues={venues}
        property={property}
        city={city}
        nowISO={nowISO}
        markerRefs={markerRefs}
        propertySlug={propertySlug ?? property.slug}
      />

    </main>
  )
}