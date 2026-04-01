import { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import PropertyMap from '@/components/maps/PropertyMap'
import { Card, CardContent } from '@/components/ui/card'
import { DateTime } from 'luxon'
import { CITY_CONFIGS } from '@/config/cities'
import PropertyCrawls from '@/app/property/components/PropertyCrawls'
import EventJourneys from '@/app/property/components/EventJourneys'
import { venueMatchesAnyType } from '@/lib/venues/typeMatching'
import { loadCityVenues } from '@/lib/venues/loadCityVenues'
import { generateEventJourney } from '@/lib/crawls/generateEventJourney'
import SavePropertyButton from '../../components/SavePropertyButton'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    city: string
    slug: string
  }>
}

type EventJourneyRecord = {
  id: string
  city: string
  title: string
  slug: string
  event_id: string | null
  property_id: string | null
  event_name: string
  event_start_at: string
  destination_name: string
  destination_venue_id: string | null
  destination_lat: number
  destination_lon: number
  vibes: string[] | null
  tags: string[] | null
  ideal_stop_duration_minutes: number | null
  range_expansion_pct: number | null
  max_dynamic_stops: number | null
  status: string | null
  notes: string | null
  created_at?: string | null
  updated_at?: string | null
}

type EventJourneyStopRow = {
  id: string
  event_journey_id: string
  venue_id: string
  stop_order: number
  role: string
  is_locked: boolean
  created_at?: string | null
}

type EventJourneyPropertyLinkRow = {
  id: string
  event_journey_id: string
  property_id: string
  created_at?: string | null
}

export const metadata: Metadata = {
  title: 'Property Guide | Roam',
  description: 'Local neighborhood guide powered by Roam',
}

/* ------------------------------------------------ */
/* Normalize city                                   */
/* ------------------------------------------------ */

function normalizeCityKey(input?: string | null) {
  const raw = (input ?? '').trim().toLowerCase()

  const aliases: Record<string, string> = {
    atl: 'atl',
    atlanta: 'atl',
    'atlanta ga': 'atl',

    nyc: 'nyc',
    'new york': 'nyc',
    'new york city': 'nyc',
    manhattan: 'nyc',

    porto: 'porto',
    oporto: 'porto',

    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
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
  const adminDb = supabase as any

  const normalizedCity = normalizeCityKey(city)
  const timezone =
    CITY_CONFIGS[normalizedCity]?.timezone ??
    CITY_CONFIGS[city]?.timezone ??
    'UTC'

  const nowForCity = DateTime.now().setZone(timezone)

  /* ------------------------------------------------ */
  /* Fetch property                                   */
  /* ------------------------------------------------ */

  const { data: propertyData } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', slug)

  const property =
    propertyData?.find((p: any) => normalizeCityKey(p.city) === normalizedCity) ?? null

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

  const { data: allVenuesData } = await supabase
    .from('venues')
    .select('*')

  const cityVenues =
    (allVenuesData ?? []).filter(
      (v: any) => normalizeCityKey(v.city) === normalizedCity
    )

  const allCityVenues = loadCityVenues(
    normalizedCity,
    cityVenues ?? []
  )

  const dbCityVenueById = new Map(
    cityVenues.map((venue: any) => [venue.id, venue])
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

  /* ------------------------------------------------ */
  /* Event journeys (within next 7 days)              */
  /* ------------------------------------------------ */

  const sevenDaysFromNow = nowForCity.plus({ days: 7 }).toISO()

  const { data: candidateEventJourneysData } = await adminDb
    .from('event_journeys')
    .select('*')
    .eq('status', 'active')
    .gte('event_start_at', nowForCity.toISO())
    .lte('event_start_at', sevenDaysFromNow)
    .order('event_start_at', { ascending: true })

  const candidateEventJourneys =
    ((candidateEventJourneysData as EventJourneyRecord[] | null) ?? [])
      .filter((journey) => normalizeCityKey(journey.city) === normalizedCity)

  let eventJourneys: EventJourneyRecord[] = []

  if (candidateEventJourneys.length > 0) {
    const candidateJourneyIds = candidateEventJourneys.map((journey) => journey.id)

    const { data: eventJourneyPropertyLinksData } = await adminDb
      .from('event_journey_properties')
      .select('*')
      .in('event_journey_id', candidateJourneyIds)

    const eventJourneyPropertyLinks =
      (eventJourneyPropertyLinksData as EventJourneyPropertyLinkRow[] | null) ?? []

    const linksByJourneyId = new Map<string, EventJourneyPropertyLinkRow[]>()

    eventJourneyPropertyLinks.forEach((link) => {
      const existing = linksByJourneyId.get(link.event_journey_id) ?? []
      existing.push(link)
      linksByJourneyId.set(link.event_journey_id, existing)
    })

    eventJourneys = candidateEventJourneys.filter((journey) => {
      const links = linksByJourneyId.get(journey.id) ?? []

      if (links.length === 0) {
        return true
      }

      return links.some((link) => link.property_id === property.id)
    })
  }

  let eventJourneyStops: EventJourneyStopRow[] = []

  if (eventJourneys.length > 0) {
    const eventJourneyIds = eventJourneys.map((journey) => journey.id)

    const { data: eventJourneyStopsData } = await adminDb
      .from('event_journey_stops')
      .select('*')
      .in('event_journey_id', eventJourneyIds)
      .order('stop_order', { ascending: true })

    eventJourneyStops = (eventJourneyStopsData as EventJourneyStopRow[] | null) ?? []
  }

  const eventJourneyCards = eventJourneys
    .map((journey) => {

      const lockedStops = eventJourneyStops
        .filter((stop) => stop.event_journey_id === journey.id)
        .map((stop) => ({
          venueId: stop.venue_id,
          stopOrder: stop.stop_order,
          role: stop.role,
          isLocked: stop.is_locked,
        }))

      const result = generateEventJourney({
        property: {
          lat: property.lat,
          lon: property.lon,
          city: normalizeCityKey(property.city),
          name: property.name,
        },
        destination: {
          name: journey.destination_name,
          lat: journey.destination_lat,
          lon: journey.destination_lon,
          venueId: journey.destination_venue_id,
        },
        eventStartAtISO: journey.event_start_at,
        venues: allCityVenues,
        now: nowForCity,
        signals: {
          vibes: journey.vibes,
          tags: journey.tags,
        },
        lockedStops,
        idealStopDurationMinutes: journey.ideal_stop_duration_minutes ?? 120,
        rangeExpansionPct: journey.range_expansion_pct ?? 0.3,
        maxDynamicStops: journey.max_dynamic_stops ?? 3,
      })

      if (!result) return null

      const hydratedResult = {
        ...result,
        stops: result.stops.map((stop) => {
          const dbVenue = dbCityVenueById.get(stop.venue.id) as any

          return {
            ...stop,
            venue: {
              ...stop.venue,
              city: normalizeCityKey(dbVenue?.city ?? stop.venue.city),
              description:
                typeof dbVenue?.description === 'string'
                  ? dbVenue.description
                  : null,
            },
          }
        }),
      }

      const eventTime = DateTime.fromISO(journey.event_start_at).setZone(timezone)
      const canStartToday = nowForCity.hasSame(eventTime, 'day')
      const stopIds = hydratedResult.stops.map((stop) => stop.venue.id).join(',')

      const href =
        canStartToday
          ? `/property/event-route?city=${encodeURIComponent(city)}&venues=${encodeURIComponent(
              stopIds
            )}&property_id=${encodeURIComponent(property.id)}&property_slug=${encodeURIComponent(
              property.slug
            )}&destination_name=${encodeURIComponent(journey.destination_name)}&destination_lat=${encodeURIComponent(
              String(journey.destination_lat)
            )}&destination_lon=${encodeURIComponent(
              String(journey.destination_lon)
            )}&event_name=${encodeURIComponent(
              journey.event_name
            )}&event_start_at=${encodeURIComponent(journey.event_start_at)}`
          : undefined

      return {
        id: journey.id,
        title: journey.title,
        eventName: journey.event_name,
        eventStartAt: journey.event_start_at,
        destinationName: journey.destination_name,
        status: canStartToday ? 'route available today' : 'available day of event',
        result: hydratedResult,
        href,
      }
    })
    .filter(Boolean)

  return (

    <main className="max-w-5xl mx-auto p-6 space-y-10">

     {/* Hero */}

<section>

  <Card>

    <CardContent className="p-6 space-y-3">

      <div className="flex items-start justify-between gap-4">

        <div className="space-y-2">

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

        </div>

        <SavePropertyButton
          propertyId={property.id}
          city={property.city}
          slug={property.slug}
        />

      </div>

    </CardContent>

  </Card>

</section>

      {/* Welcome Description */}

      {property.welcome_description && (
        <section className="space-y-3">

          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Welcome
          </h2>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm leading-7 text-muted-foreground whitespace-pre-line">
                {property.welcome_description}
              </p>
            </CardContent>
          </Card>

        </section>
      )}

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

      {/* Event Journeys */}

      {eventJourneyCards.length > 0 && (
        <EventJourneys journeys={eventJourneyCards as any} />
      )}

      {/* Suggested Crawls */}

      <PropertyCrawls
        property={property}
        venues={nearbyVenues}
        city={property.city}
      />

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