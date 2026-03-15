import { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import PropertyMap from '@/components/maps/PropertyMap'
import { Card, CardContent } from '@/components/ui/card'
import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'
import PropertyCrawls from '@/app/property/components/PropertyCrawls'
import { venueMatchesAnyType } from '@/lib/venues/typeMatching'
import { loadCityVenues } from '@/lib/venues/loadCityVenues'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    city: string
    slug: string
  }>
}

export const metadata: Metadata = {
  title: 'Property Guide | Roam',
  description: 'Local neighborhood guide powered by Roam',
}

/* ------------------------------------------------ */
/* Normalize venue                                  */
/* ------------------------------------------------ */

function normalizeVenue(v: any) {

  let cover = v.cover

  if (cover && !cover.startsWith('/')) {
    cover = '/' + cover
  }

  return {
    ...v,
    cover,
    lat: typeof v.lat === 'string' ? parseFloat(v.lat) : v.lat,
    lon: typeof v.lon === 'string' ? parseFloat(v.lon) : v.lon,
    link: `/venue-profile/${v.id}`,
  }
}

/* ------------------------------------------------ */
/* Venue Card                                       */
/* ------------------------------------------------ */

function VenueCard({ v }: { v: any }) {

  const cover =
    v.cover && v.cover.startsWith('/')
      ? v.cover
      : v.cover
      ? '/' + v.cover
      : '/placeholder-venue.jpg'

  return (

    <Link href={`/venue-profile/${v.id}`}>

      <Card className="hover:shadow-md transition cursor-pointer">

        <CardContent className="p-3 flex gap-3 items-center">

          <img
            src={cover}
            className="w-16 h-16 rounded-lg object-cover"
            alt={v.name}
          />

          <div className="flex flex-col">

            <p className="font-medium text-sm">
              {v.name}
            </p>

            {v.description && (
              <p className="text-xs text-muted-foreground">
                {v.description}
              </p>
            )}

          </div>

        </CardContent>

      </Card>

    </Link>

  )
}

export default async function PropertyPage({ params }: PageProps) {

  const { city, slug } = await params
  const supabase = await createServerClient()

  const timezone = CITY_CONFIGS[city]?.timezone ?? 'UTC'

  /* ------------------------------------------------ */
  /* Fetch property                                   */
  /* ------------------------------------------------ */

  const { data: propertyData } = await supabase
    .from('properties')
    .select('*')
    .eq('city', city)
    .eq('slug', slug)
    .limit(1)

  const property = propertyData?.[0] ?? null

  if (!property) {
    return (
      <div className="max-w-2xl mx-auto text-center p-6">
        <h2 className="text-xl font-bold">Property not found</h2>
        <p className="text-muted-foreground">
          This guide may not exist or may have been removed.
        </p>
      </div>
    )
  }

  /* ------------------------------------------------ */
  /* Host favorites                                   */
  /* ------------------------------------------------ */

  const { data: favorites } = await supabase
    .from('property_favorites')
    .select(`
      id,
      label,
      description,
      priority,
      venues (
        id,
        name,
        lat,
        lon,
        city,
        slug,
        cover,
        type
      )
    `)
    .eq('property_id', property.id)
    .order('priority', { ascending: true })

  const favoriteVenues =
    favorites?.map((f: any) =>
      normalizeVenue({
        ...f.venues,
        label: f.label,
        description: f.description,
      })
    ) ?? []

  /* ------------------------------------------------ */
  /* Load city venues                                 */
  /* ------------------------------------------------ */

  const { data: cityVenues } = await supabase
    .from('venues')
    .select('*')
    .eq('city', city)

  const allCityVenues = loadCityVenues(
    city,
    cityVenues ?? []
  )

  /* ------------------------------------------------ */
  /* Filter nearby venues                             */
  /* ------------------------------------------------ */

  const nearbyVenues = allCityVenues.filter((v) => {

    const latDiff = Math.abs(v.lat - property.lat)
    const lonDiff = Math.abs(v.lon - property.lon)

    return latDiff < 0.02 && lonDiff < 0.02
  })

  /* ------------------------------------------------ */
  /* Venue type filtering                             */
  /* ------------------------------------------------ */

  const coffeeNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v, ['coffee','cafe','café','bakery'])
  )

  const barsNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v, ['bar','wine bar','cocktail','pub','brewery'])
  )

  const dinnerNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v, ['restaurant','dinner','kitchen'])
  )

  const wellnessNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v, ['fitness','yoga','spa'])
  )

  /* ------------------------------------------------ */
  /* Map venues                                       */
  /* ------------------------------------------------ */

  const mapVenues = [...favoriteVenues,...nearbyVenues].slice(0,40)

  /* ------------------------------------------------ */
  /* Nearby events                                    */
  /* ------------------------------------------------ */

  const { data: nearbyEventsData } = await supabase.rpc(
    'get_nearby_events',
    {
      property_lat: property.lat,
      property_lon: property.lon,
      radius_meters: 3000,
      limit_count: 25,
    }
  )

  const nearbyEvents = nearbyEventsData ?? []

  return (

    <main className="max-w-5xl mx-auto p-6 space-y-10">

      {/* Hero */}

      <section>

        <Card>

          <CardContent className="p-6 space-y-2">

            <h1 className="text-3xl font-semibold">
              {property.name}
            </h1>

            <p className="text-muted-foreground">
              {property.city}
              {property.host_name && ` • Hosted by ${property.host_name}`}
            </p>

            <p className="text-sm text-muted-foreground">
              Discover coffee, dining, nightlife, and hidden gems within walking distance.
            </p>

          </CardContent>

        </Card>

      </section>

      {/* Map */}

      <section className="space-y-3">

        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Neighborhood Map
        </h2>

        <div className="rounded-xl overflow-hidden border h-[420px]">

          <PropertyMap
            property={property}
            venues={mapVenues}
          />

        </div>

      </section>

      {/* Suggested Crawls */}

      <PropertyCrawls
        property={property}
        venues={nearbyVenues}
        city={property.city}
      />

      {/* Host Favorites */}

      <section className="space-y-3">

        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Host Favorites
        </h2>

        {favoriteVenues.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Your host hasn't added favorites yet — explore nearby spots below.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {favoriteVenues.map((v) => (
            <VenueCard key={v.id} v={v} />
          ))}
        </div>

      </section>

      {/* Events */}

      {nearbyEvents.length > 0 && (

        <section className="space-y-3">

          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Events Nearby
          </h2>

          <div className="grid gap-3 md:grid-cols-2">

            {nearbyEvents.map((ev: any) => (

              <Card key={ev.id}>

                <CardContent className="p-4 space-y-1">

                  <p className="font-medium">
                    {ev.title}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {ev.venue_name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {DateTime.fromISO(ev.starts_at)
                      .setZone(timezone)
                      .toFormat('M/d h:mm a')}
                  </p>

                  <Link
                    href={`/venue-profile/${ev.venue_id}`}
                    className="text-xs text-blue-600 underline"
                  >
                    View Venue
                  </Link>

                </CardContent>

              </Card>

            ))}

          </div>

        </section>

      )}

      {/* Explore Nearby */}

      <section className="space-y-6">

        {coffeeNearby.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">☕ Coffee Nearby</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {coffeeNearby.slice(0,5).map(v => (
                <VenueCard key={v.id} v={v}/>
              ))}
            </div>
          </div>
        )}

        {barsNearby.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">🍸 Bars Nearby</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {barsNearby.slice(0,5).map(v => (
                <VenueCard key={v.id} v={v}/>
              ))}
            </div>
          </div>
        )}

        {dinnerNearby.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">🍽 Dinner Nearby</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {dinnerNearby.slice(0,5).map(v => (
                <VenueCard key={v.id} v={v}/>
              ))}
            </div>
          </div>
        )}

        {wellnessNearby.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">🧘 Wellness Nearby</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {wellnessNearby.slice(0,5).map(v => (
                <VenueCard key={v.id} v={v}/>
              ))}
            </div>
          </div>
        )}

      </section>

    </main>

  )

}