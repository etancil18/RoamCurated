import { createServerClient } from '@/lib/supabase/server'
import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'
import CrawlMap from '../crawl/CrawlMap'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    city?: string
    venues?: string
    property_id?: string
    property_slug?: string
    destination_name?: string
    destination_lat?: string
    destination_lon?: string
    event_name?: string
    event_start_at?: string
  }>
}

export default async function PropertyEventRoutePage({ searchParams }: Props) {
  const supabase = await createServerClient()

  const resolvedSearchParams = await searchParams

  const city = resolvedSearchParams.city ?? ''
  const venueIds = (resolvedSearchParams.venues ?? '')
    .split(',')
    .filter(Boolean)

  const propertyId = resolvedSearchParams.property_id
  const propertySlug = resolvedSearchParams.property_slug

  const destinationName = resolvedSearchParams.destination_name ?? 'Destination'
  const destinationLat = resolvedSearchParams.destination_lat
    ? parseFloat(resolvedSearchParams.destination_lat)
    : null
  const destinationLon = resolvedSearchParams.destination_lon
    ? parseFloat(resolvedSearchParams.destination_lon)
    : null

  const eventName = resolvedSearchParams.event_name ?? null
  const eventStartAt = resolvedSearchParams.event_start_at ?? null

  /* ------------------------------------------------ */
  /* Fetch venues                                     */
  /* ------------------------------------------------ */

  const { data } = await supabase
    .from('venues')
    .select('*')
    .in('id', venueIds)

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
  /* Append final destination as last stop            */
  /* ------------------------------------------------ */

  const routeVenues =
    Number.isFinite(destinationLat) && Number.isFinite(destinationLon)
      ? [
          ...venues,
          {
            id: 'event-destination',
            name: destinationName,
            lat: destinationLat,
            lon: destinationLon,
            city,
            link: '#',
          },
        ]
      : venues

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

  const formattedEventStartAt =
    eventStartAt
      ? DateTime.fromISO(eventStartAt)
          .setZone(timezone)
          .toFormat('M/d h:mm a')
      : null

  /* ------------------------------------------------ */
  /* Marker refs                                      */
  /* ------------------------------------------------ */

  const markerRefs = { current: {} as Record<string, any> }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">

      <div className="space-y-1">
        <h1 className="text-xl font-bold">
          Event Route
        </h1>

        {(eventName || formattedEventStartAt || destinationName) && (
          <div className="text-sm text-muted-foreground space-y-1">
            {eventName && (
              <p>
                {eventName}
              </p>
            )}

            <p>
              Destination: {destinationName}
            </p>

            {formattedEventStartAt && (
              <p>
                Starts at {formattedEventStartAt}
              </p>
            )}
          </div>
        )}
      </div>

      <CrawlMap
        venues={routeVenues}
        property={property}
        city={city}
        nowISO={nowISO}
        markerRefs={markerRefs}
        propertySlug={propertySlug ?? property.slug}
      />

    </main>
  )
}