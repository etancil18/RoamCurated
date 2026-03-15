import { createServerClient } from '@/lib/supabase/server'
import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'
import CrawlMap from './CrawlMap'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: {
    city: string
    venues: string
    property_id?: string
  }
}

export default async function PropertyCrawlPage({ searchParams }: Props) {
  const supabase = await createServerClient()

  const venueIds = searchParams.venues.split(',')

  /* ------------------------------------------------ */
  /* Fetch venues                                     */
  /* ------------------------------------------------ */

  const { data } = await supabase
    .from('venues')
    .select('*')
    .in('id', venueIds)

  const venues =
    data?.map((v: any) => ({
      ...v,
      link: `/venue-profile/${v.id}`,
    })) ?? []

  /* ------------------------------------------------ */
  /* Fetch property (if provided)                     */
  /* ------------------------------------------------ */

  let property = {
    name: 'Property',
    lat: venues[0]?.lat ?? 0,
    lon: venues[0]?.lon ?? 0,
    city: searchParams.city,
  }

  if (searchParams.property_id) {
    const { data: propertyData } = await supabase
      .from('properties')
      .select('name, lat, lon, city')
      .eq('id', searchParams.property_id)
      .limit(1)

    if (propertyData?.[0]) {
      property = propertyData[0]
    }
  }

  /* ------------------------------------------------ */
  /* City-aware time                                  */
  /* ------------------------------------------------ */

  const timezone = CITY_CONFIGS[searchParams.city]?.timezone ?? 'UTC'

  const nowISO =
    DateTime.now()
      .setZone(timezone)
      .toISO() ?? new Date().toISOString()

  /* ------------------------------------------------ */
  /* Marker refs                                      */
  /* ------------------------------------------------ */

  const markerRefs = { current: {} as Record<string, any> }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">

      <h1 className="text-xl font-bold">
        Crawl Route
      </h1>

      <CrawlMap
        venues={venues}
        property={property}
        city={searchParams.city}
        nowISO={nowISO}
        markerRefs={markerRefs}
      />

    </main>
  )
}