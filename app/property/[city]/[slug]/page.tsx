import { Metadata } from 'next'
import Link from 'next/link'
import { DateTime } from 'luxon'

import PropertyMap from '@/components/maps/PropertyMap'
import { Card, CardContent } from '@/components/ui/card'
import PropertyCrawls from '@/app/property/components/PropertyCrawls'
import EventJourneys from '@/app/property/components/EventJourneys'
import SavePropertyButton from '../../components/SavePropertyButton'

import { getPropertyGuideData } from '@/lib/property/getPropertyGuideData'
import { buildEventJourneyVMs } from '@/lib/view-models/buildEventJourneyVM'
import {
  buildVenueCardVMs,
  type VenueCardVM,
} from '@/lib/view-models/buildVenueCardVM'
import { logEventServer } from '@/lib/logEventServer'

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

export default async function PropertyPage({ params }: PageProps) {
  const { city, slug } = await params

  const guide = await getPropertyGuideData({ city, slug })

  if (!guide.property) {
    return (
      <div className="max-w-2xl mx-auto text-center p-6">
        <h2 className="text-xl font-bold">Property not found</h2>
        <p className="text-muted-foreground">
          This guide may not exist or may have been removed.
        </p>
      </div>
    )
  }

  const origin = {
    lat: guide.property.lat,
    lon: guide.property.lon,
  }

  const hostPickCards = buildVenueCardVMs(guide.favoriteVenues, {
    origin,
    hostPickIds: guide.favoriteVenues.map((v) => v.id),
  })

  const coffeeCards = buildVenueCardVMs(guide.coffeeNearby, { origin })
  const barCards = buildVenueCardVMs(guide.barsNearby, { origin })
  const dinnerCards = buildVenueCardVMs(guide.dinnerNearby, { origin })
  const wellnessCards = buildVenueCardVMs(guide.wellnessNearby, { origin })

  const eventJourneyVMs = buildEventJourneyVMs(guide.eventJourneyCards, {
    timezone: guide.timezone,
    now: guide.nowForCity,
  })

  const mapVenuesForMap = guide.mapVenues.map((venue) => ({
    ...venue,
    slug: venue.slug ?? undefined,
  }))

  const hasFlexibleEventJourneys = guide.eventJourneyCards.some((journey) => {
    const policy = String(journey.arrivalPolicy ?? '')
      .trim()
      .toLowerCase()

    return policy === 'midpoint_deadline' || policy === 'window'
  })

  const eventJourneyIntroCopy = hasFlexibleEventJourneys
    ? 'Smart routes for concerts, games, festivals, and flexible event windows near this property.'
    : 'Smart routes for concerts, games, and major local events near this property.'

  const totalVenueCards =
    hostPickCards.length +
    coffeeCards.length +
    barCards.length +
    dinnerCards.length +
    wellnessCards.length

  await Promise.all([
    logEventServer({
      impression_type: 'property_page_viewed',
      metadata: {
        property_id: guide.property.id,
        property_slug: guide.property.slug,
        property_name: guide.property.name,
        city: guide.property.city,
        has_event_journeys: eventJourneyVMs.length > 0,
        num_event_journeys: eventJourneyVMs.length,
        num_property_crawls: guide.propertyCrawlCards.length,
        num_nearby_events: guide.nearbyEvents.length,
        num_rendered_venue_cards: totalVenueCards,
        num_map_venues: mapVenuesForMap.length,
      },
    }),

    ...(eventJourneyVMs.length > 0
      ? [
          logEventServer({
            impression_type: 'event_journeys_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_journeys: eventJourneyVMs.length,
              journey_ids: eventJourneyVMs.map((journey) => journey.id),
            },
          }),
        ]
      : []),

    ...(guide.propertyCrawlCards.length > 0
      ? [
          logEventServer({
            impression_type: 'property_crawls_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_property_crawls: guide.propertyCrawlCards.length,
              crawl_ids: guide.propertyCrawlCards.map((crawl) => crawl.id),
            },
          }),
        ]
      : []),

    ...(mapVenuesForMap.length > 0
      ? [
          logEventServer({
            impression_type: 'property_map_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_map_venues: mapVenuesForMap.length,
            },
          }),
        ]
      : []),

    ...(guide.nearbyEvents.length > 0
      ? [
          logEventServer({
            impression_type: 'property_nearby_events_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_nearby_events: guide.nearbyEvents.length,
              nearby_event_ids: guide.nearbyEvents
                .map((event: any) => event?.id)
                .filter(Boolean),
            },
          }),
        ]
      : []),

    ...(hostPickCards.length > 0
      ? [
          logEventServer({
            impression_type: 'property_host_picks_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_venues: hostPickCards.length,
              venue_ids: hostPickCards.map((venue) => venue.id),
            },
          }),
        ]
      : []),

    ...(coffeeCards.length > 0
      ? [
          logEventServer({
            impression_type: 'property_coffee_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_venues: coffeeCards.length,
              venue_ids: coffeeCards.map((venue) => venue.id),
            },
          }),
        ]
      : []),

    ...(barCards.length > 0
      ? [
          logEventServer({
            impression_type: 'property_bars_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_venues: barCards.length,
              venue_ids: barCards.map((venue) => venue.id),
            },
          }),
        ]
      : []),

    ...(dinnerCards.length > 0
      ? [
          logEventServer({
            impression_type: 'property_dinner_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_venues: dinnerCards.length,
              venue_ids: dinnerCards.map((venue) => venue.id),
            },
          }),
        ]
      : []),

    ...(wellnessCards.length > 0
      ? [
          logEventServer({
            impression_type: 'property_wellness_section_impression',
            metadata: {
              property_id: guide.property.id,
              property_slug: guide.property.slug,
              property_name: guide.property.name,
              city: guide.property.city,
              num_venues: wellnessCards.length,
              venue_ids: wellnessCards.map((venue) => venue.id),
            },
          }),
        ]
      : []),
  ])

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-10">
      <section>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold">{guide.property.name}</h1>

                <p className="text-muted-foreground">
                  {guide.property.city}
                  {typeof guide.property.host_name === 'string' &&
                    guide.property.host_name.trim().length > 0 &&
                    ` • Hosted by ${guide.property.host_name}`}
                </p>

                <p className="text-sm text-muted-foreground max-w-2xl">
                  Best coffee, dinner, bars, and event routes within walking
                  distance.
                </p>
              </div>

              <SavePropertyButton
                propertyId={guide.property.id}
                city={guide.property.city}
                slug={guide.property.slug}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {eventJourneyVMs.length > 0 ? (
                <a
                  href="#event-journeys"
                  className="inline-flex items-center rounded-full bg-black text-white px-4 py-2 text-sm font-medium hover:opacity-90"
                >
                  View event routes
                </a>
              ) : (
                <a
                  href="#suggested-crawls"
                  className="inline-flex items-center rounded-full bg-black text-white px-4 py-2 text-sm font-medium hover:opacity-90"
                >
                  Start nearby route
                </a>
              )}

              <a
                href="#neighborhood-map"
                className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                View map
              </a>
            </div>
          </CardContent>
        </Card>
      </section>

      {guide.property.welcome_description && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Welcome
          </h2>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm leading-7 text-muted-foreground whitespace-pre-line">
                {guide.property.welcome_description}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {eventJourneyVMs.length > 0 && (
        <section id="event-journeys" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Event Journeys
            </h2>
            <p className="text-sm text-muted-foreground">
              {eventJourneyIntroCopy}
            </p>
          </div>

          <EventJourneys journeys={eventJourneyVMs} />
        </section>
      )}

      <section id="neighborhood-map" className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Neighborhood Map
        </h2>

        <div className="rounded-xl overflow-hidden border h-[420px]">
          <PropertyMap property={guide.property} venues={mapVenuesForMap as any} />
        </div>
      </section>

      <section id="suggested-crawls" className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested Routes
          </h2>
          <p className="text-sm text-muted-foreground">
            Ready-to-go nearby plans for coffee, dinner, drinks, and easy local
            exploration.
          </p>
        </div>

        <PropertyCrawls
          property={guide.property}
          crawls={guide.propertyCrawlCards}
        />
      </section>

      {guide.nearbyEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Events Nearby
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            {guide.nearbyEvents.map((ev: any) => (
              <Card key={ev.id}>
                <CardContent className="p-4 space-y-1">
                  <p className="font-medium">{ev.title}</p>

                  <p className="text-xs text-muted-foreground">
                    {ev.venue_name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {DateTime.fromISO(ev.starts_at)
                      .setZone(guide.timezone)
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

      {hostPickCards.length > 0 && (
        <VenueSection
          title="Host Picks"
          subtitle="High-trust local recommendations curated for this property."
          venues={hostPickCards.slice(0, 6)}
        />
      )}

      <section className="space-y-6">
        {coffeeCards.length > 0 && (
          <VenueSection
            title="☕ Coffee Nearby"
            subtitle="Good coffee, quick breakfast, and easy daytime starts."
            venues={coffeeCards.slice(0, 5)}
          />
        )}

        {barCards.length > 0 && (
          <VenueSection
            title="🍸 Bars Nearby"
            subtitle="Strong nearby options for drinks before or after dinner."
            venues={barCards.slice(0, 5)}
          />
        )}

        {dinnerCards.length > 0 && (
          <VenueSection
            title="🍽 Dinner Nearby"
            subtitle="Best nearby places for a full meal or an easy evening out."
            venues={dinnerCards.slice(0, 5)}
          />
        )}

        {wellnessCards.length > 0 && (
          <VenueSection
            title="🧘 Wellness Nearby"
            subtitle="Reset, move, or recharge close to the property."
            venues={wellnessCards.slice(0, 5)}
          />
        )}
      </section>
    </main>
  )
}

function VenueSection({
  title,
  subtitle,
  venues,
}: {
  title: string
  subtitle?: string
  venues: VenueCardVM[]
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {venues.map((venue) => (
          <Link key={venue.id} href={venue.href}>
            <Card className="h-full cursor-pointer transition hover:shadow-md">
              <CardContent className="flex items-start gap-3 p-4">
                <img
                  src={venue.imageUrl || '/placeholder-venue.jpg'}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  alt={venue.name}
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{venue.name}</p>

                    {venue.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {venue.description}
                      </p>
                    )}
                  </div>

                  {venue.chips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {venue.chips.map((chip) => (
                        <Chip key={chip}>{chip}</Chip>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}