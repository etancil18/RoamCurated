// app/property/[city]/[slug]/page.tsx
import { Metadata } from 'next'
import Link from 'next/link'
import { DateTime } from 'luxon'
import type { ReactNode } from 'react'

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

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://roam-curated.vercel.app'

  const guideUrl = `${baseUrl}/open/property/${city}/${slug}`

  const guideQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(
    guideUrl
  )}`

  const guide = await getPropertyGuideData({ city, slug })

  if (!guide.property) {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-24 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl">
          <h2 className="text-xl font-bold">Property not found</h2>
          <p className="mt-2 text-sm text-neutral-400">
            This guide may not exist or may have been removed.
          </p>
        </div>
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

  const nearbySwapVenues = guide.nearbyVenues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    link: venue.link,
    description:
      typeof venue.description === 'string' ? venue.description : null,
    type: venue.type ?? null,
    lat: venue.lat,
    lon: venue.lon,
  }))

  const hasFlexibleEventJourneys = guide.eventJourneyCards.some((journey) => {
    const policy = String(journey.arrivalPolicy ?? '').trim().toLowerCase()
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
  ])

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_70%_10%,_rgba(99,102,241,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.13),_transparent_34%)]" />

      <div className="relative z-10 mx-auto max-w-6xl space-y-10 px-5 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] md:px-8">
        <section>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur">
            <div className="relative p-6 md:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Pill>Roam Stay Guide</Pill>
                    <Pill>{guide.property.city}</Pill>
                    {guide.property.host_name ? (
                      <Pill>Hosted by {guide.property.host_name}</Pill>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-white md:text-6xl">
                      {guide.property.name}
                    </h1>

                    <p className="max-w-2xl text-base leading-7 text-neutral-300 md:text-lg">
                      Unlock the neighborhood around your stay. Start a local
                      flow, check into nearby spots, and turn movement into
                      Passport progress.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <HeroStat
                      label="Launchable flows"
                      value={String(guide.propertyCrawlCards.length)}
                    />
                    <HeroStat
                      label="Nearby stops"
                      value={String(mapVenuesForMap.length)}
                    />
                    <HeroStat
                      label="Event routes"
                      value={String(eventJourneyVMs.length)}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3">
                  <SavePropertyButton
                    propertyId={guide.property.id}
                    city={guide.property.city}
                    slug={guide.property.slug}
                  />

                  <a
                    href="#guide-qr-modal"
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    View QR
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div
          id="guide-qr-modal"
          className="fixed inset-0 z-[9999] hidden items-center justify-center bg-black/85 px-4 py-8 target:flex"
        >
          <a href="#" aria-label="Close QR modal" className="absolute inset-0" />

          <Card className="relative z-[10000] w-full max-w-sm overflow-hidden border-white/10 bg-neutral-950 text-white">
            <CardContent className="space-y-5 p-6 text-center">
              <div className="flex items-start justify-between gap-4 text-left">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Guest QR Code</h2>
                  <p className="text-sm text-neutral-400">
                    Guests can scan this code to open this neighborhood guide
                    instantly on their phone.
                  </p>
                </div>

                <a
                  href="#"
                  aria-label="Close QR modal"
                  className="rounded-full border border-white/15 px-3 py-1 text-sm font-medium text-white hover:bg-white/10"
                >
                  ×
                </a>
              </div>

              <div className="flex justify-center">
                <div className="rounded-2xl bg-white p-4">
                  <img
                    src={guideQrImageUrl}
                    alt={`QR code for ${guide.property.name}`}
                    className="h-[220px] w-[220px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">{guide.property.name}</p>
                <p className="break-all text-xs text-neutral-500">{guideUrl}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {guide.property.welcome_description && (
          <SectionShell eyebrow="Welcome" title="Your local launchpad">
            <Card className="border-white/10 bg-white/[0.04] text-white backdrop-blur">
              <CardContent className="p-6">
                <p className="whitespace-pre-line text-sm leading-7 text-neutral-300">
                  {guide.property.welcome_description}
                </p>
              </CardContent>
            </Card>
          </SectionShell>
        )}

        <SectionShell
          eyebrow="Neighborhood Map"
          title="See what’s unlockable nearby"
          subtitle="A visual layer of the closest places, host picks, and neighborhood options around this stay."
        >
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-2xl">
            <div className="h-[430px]">
              <PropertyMap
                property={guide.property}
                venues={mapVenuesForMap as any}
              />
            </div>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Start a Local Flow"
          title="Pick an experience, then move"
          subtitle="Ready-to-go routes become active flows with check-ins, progress, and completion credit."
          id="suggested-crawls"
        >
          <PropertyCrawls
            property={guide.property}
            crawls={guide.propertyCrawlCards}
            nearbyVenues={nearbySwapVenues}
          />
        </SectionShell>

        {eventJourneyVMs.length > 0 && (
          <SectionShell
            eyebrow="Event Journeys"
            title="Make the event part of the roam"
            subtitle={eventJourneyIntroCopy}
            id="event-journeys"
          >
            <EventJourneys
              journeys={eventJourneyVMs}
              property={{
                id: guide.property.id,
                name: guide.property.name,
                slug: guide.property.slug,
                city: guide.property.city,
              }}
            />
          </SectionShell>
        )}

        <section id="explore-one-stop" className="space-y-8">
          <SectionHeader
            eyebrow="Nearby Check-ins"
            title="Explore one stop at a time"
            subtitle="Not every guest wants a full route. Check into individual places and still build proof of movement."
          />

          <div className="space-y-8">
            {hostPickCards.length > 0 && (
              <VenueSection
                title="Host Picks"
                subtitle="High-trust local recommendations curated for this property."
                venues={hostPickCards.slice(0, 6)}
                property={guide.property}
              />
            )}

            {coffeeCards.length > 0 && (
              <VenueSection
                title="☕ Coffee Nearby"
                subtitle="Good coffee, quick breakfast, and easy daytime starts."
                venues={coffeeCards.slice(0, 5)}
                property={guide.property}
              />
            )}

            {barCards.length > 0 && (
              <VenueSection
                title="🍸 Bars Nearby"
                subtitle="Strong nearby options for drinks before or after dinner."
                venues={barCards.slice(0, 5)}
                property={guide.property}
              />
            )}

            {dinnerCards.length > 0 && (
              <VenueSection
                title="🍽 Dinner Nearby"
                subtitle="Best nearby places for a full meal or an easy evening out."
                venues={dinnerCards.slice(0, 5)}
                property={guide.property}
              />
            )}

            {wellnessCards.length > 0 && (
              <VenueSection
                title="🧘 Wellness Nearby"
                subtitle="Reset, move, or recharge close to the property."
                venues={wellnessCards.slice(0, 5)}
                property={guide.property}
              />
            )}
          </div>
        </section>

        {guide.nearbyEvents.length > 0 && (
          <SectionShell
            eyebrow="Events Nearby"
            title="Happening around this stay"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {guide.nearbyEvents.map((ev: any) => (
                <Card
                  key={ev.id}
                  className="border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.07]"
                >
                  <CardContent className="space-y-2 p-4">
                    <p className="font-semibold">{ev.title}</p>
                    <p className="text-xs text-neutral-400">{ev.venue_name}</p>
                    <p className="text-xs text-neutral-400">
                      {DateTime.fromISO(ev.starts_at)
                        .setZone(guide.timezone)
                        .toFormat('M/d h:mm a')}
                    </p>

                    <Link
                      href={`/venue-profile/${ev.venue_id}`}
                      className="text-xs font-medium text-cyan-300 underline underline-offset-4"
                    >
                      View Venue
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionShell>
        )}
      </div>
    </main>
  )
}

function SectionShell({
  eyebrow,
  title,
  subtitle,
  id,
  children,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="space-y-4">
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {children}
    </section>
  )
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="max-w-3xl text-sm leading-6 text-neutral-400">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-400">{label}</p>
    </div>
  )
}

function VenueSection({
  title,
  subtitle,
  venues,
  property,
}: {
  title: string
  subtitle?: string
  venues: VenueCardVM[]
  property: {
    id: string
    name: string
    city: string
    slug: string
  }
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {subtitle ? <p className="text-sm text-neutral-400">{subtitle}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {venues.map((venue) => (
          <Card
            key={venue.id}
            className="group h-full overflow-hidden border-white/10 bg-white/[0.04] text-white transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
          >
            <CardContent className="flex items-start gap-3 p-4">
              <Link href={venue.href} className="shrink-0">
                <img
                  src={venue.imageUrl || '/placeholder-venue.jpg'}
                  className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10"
                  alt={venue.name}
                />
              </Link>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <Link href={venue.href} className="block hover:underline">
                    <p className="text-sm font-bold text-white">{venue.name}</p>
                  </Link>

                  {venue.description && (
                    <p className="line-clamp-2 text-xs leading-5 text-neutral-400">
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

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={venue.href}
                    className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-100">
      {children}
    </span>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-300">
      {children}
    </span>
  )
}