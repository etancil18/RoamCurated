
 // app/property/[city]/[slug]/page.tsx

import { Metadata } from 'next'
import Link from 'next/link'
import { DateTime } from 'luxon'
import type { ReactNode } from 'react'

import PropertyMap from '@/components/maps/PropertyMap'
import HostPicksCarousel from '@/components/property/HostPicksCarousel'
import PropertyGuideInteractionTracker from '@/components/property/PropertyGuideInteractionTracker'
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

export default async function PropertyPage({
  params,
}: PageProps) {
  const { city, slug } = await params

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://roam-curated.vercel.app'

  const guideUrl =
    `${baseUrl}/open/property/${city}/${slug}`

  const guideQrImageUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(
      guideUrl
    )}`

  const guide =
    await getPropertyGuideData({
      city,
      slug,
    })

  if (!guide.property) {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-24 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl">
          <h2 className="text-xl font-bold">
            Property not found
          </h2>

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

  const hostPickCards =
    buildVenueCardVMs(
      guide.favoriteVenues,
      {
        origin,
        hostPickIds:
          guide.favoriteVenues.map(
            (v) => v.id
          ),
      }
    )

  /* =========================================================
   * Nearby Check-ins
   *
   * Host Picks are featured separately above the map.
   * Exclude them only from the general nearby cards.
   *
   * Preserve the underlying map, nearby swap venues,
   * property crawls, and Host Picks data unchanged.
   * ======================================================= */

  const hostPickVenueIds = new Set(
    guide.favoriteVenues.map(
      (venue) => venue.id
    )
  )

  const coffeeCards =
    buildVenueCardVMs(
      guide.coffeeNearby.filter(
        (venue) =>
          !hostPickVenueIds.has(venue.id)
      ),
      {
        origin,
        context: 'coffee',
      }
    )

  const barCards =
    buildVenueCardVMs(
      guide.barsNearby.filter(
        (venue) =>
          !hostPickVenueIds.has(venue.id)
      ),
      {
        origin,
        context: 'drinks',
      }
    )

  const dinnerCards =
    buildVenueCardVMs(
      guide.dinnerNearby.filter(
        (venue) =>
          !hostPickVenueIds.has(venue.id)
      ),
      {
        origin,
        context: 'dinner',
      }
    )

  const wellnessCards =
    buildVenueCardVMs(
      guide.wellnessNearby.filter(
        (venue) =>
          !hostPickVenueIds.has(venue.id)
      ),
      {
        origin,
        context: 'wellness',
      }
    )

  const eventJourneyVMs =
    buildEventJourneyVMs(
      guide.eventJourneyCards,
      {
        timezone:
          guide.timezone,
        now:
          guide.nowForCity,
      }
    )

  const mapVenuesForMap =
    guide.mapVenues.map(
      (venue) => ({
        ...venue,
        slug:
          venue.slug ??
          undefined,
      })
    )

  const nearbySwapVenues =
    guide.nearbyVenues.map(
      (venue) => ({
        id:
          venue.id,
        name:
          venue.name,
        link:
          venue.link,
        description:
          typeof venue.description ===
          'string'
            ? venue.description
            : null,
        type:
          venue.type ??
          null,
        lat:
          venue.lat,
        lon:
          venue.lon,
      })
    )

  const hasFlexibleEventJourneys =
    guide.eventJourneyCards.some(
      (journey) => {
        const policy =
          String(
            journey.arrivalPolicy ??
              ''
          )
            .trim()
            .toLowerCase()

        return (
          policy ===
            'midpoint_deadline' ||
          policy ===
            'window'
        )
      }
    )

  const eventJourneyIntroCopy =
    hasFlexibleEventJourneys
      ? 'Smart routes for concerts, games, festivals, and flexible event windows near this property.'
      : 'Smart routes for concerts, games, and major local events near this property.'

  const totalVenueCards =
    hostPickCards.length +
    coffeeCards.length +
    barCards.length +
    dinnerCards.length +
    wellnessCards.length

  await logEventServer({
    impression_type: 'property_page_viewed',
    metadata: {
      property_id: guide.property.id,
      property_slug: guide.property.slug,
      city: guide.property.city,
    },
  })

  return (
    <PropertyGuideInteractionTracker
      propertyId={guide.property.id}
      propertyName={guide.property.name}
      propertySlug={guide.property.slug}
      city={guide.property.city}
    >
      <main className="min-h-screen bg-neutral-950 text-white">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_70%_10%,_rgba(99,102,241,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.13),_transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-6xl space-y-10 px-5 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] md:px-8">
          <section>
            <div className="relative overflow-hidden rounded-[2rem] border border-[#c5a57a]/20 bg-[#151a19] shadow-2xl shadow-black/40">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(197,165,122,0.12),_transparent_58%),radial-gradient(ellipse_at_bottom_left,_rgba(116,139,121,0.10),_transparent_52%)]" />

              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#c5a57a]/60 to-transparent" />

              <div className="relative p-6 sm:p-8 md:p-10 lg:p-12">
                <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl space-y-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#c5a57a]">
                        Your Roam Stay Guide
                      </span>

                      <span className="h-1 w-1 rounded-full bg-[#c5a57a]/60" />

                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d4cfc5]">
                        {
                          guide.property
                            .city
                        }
                      </span>
                    </div>

                    <div className="space-y-5">
                      <h1 className="font-serif text-4xl font-normal leading-[1.08] tracking-tight text-[#f7f0e5] sm:text-5xl md:text-6xl lg:text-7xl">
                        Welcome to{' '}
                        <span className="block italic text-[#e7d0ac]">
                          {
                            guide.property
                              .name
                          }
                        </span>
                      </h1>

                      {guide.property
                        .welcome_description && (
                        <div className="max-w-2xl border-l-2 border-[#c5a57a]/60 pl-4 sm:pl-5">
                          <p className="whitespace-pre-line text-sm leading-7 text-[#ded9cf] sm:text-base sm:leading-8">
                            {
                              guide.property
                                .welcome_description
                            }
                          </p>
                        </div>
                      )}
                    </div>

                    {guide.property
                      .host_name && (
                      <div className="flex items-center gap-3">
                        <div className="h-px w-8 bg-[#c5a57a]/50" />

                        <p className="text-xs font-medium tracking-wide text-[#bcb6ab]">
                          Thoughtfully hosted by{' '}
                          <span className="text-[#f0e5d3]">
                            {
                              guide.property
                                .host_name
                            }
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    className="flex shrink-0 flex-wrap gap-3 md:flex-col"
                    data-analytics-section="property_header"
                  >
                    <div data-analytics-action="save_property">
                      <SavePropertyButton
                        propertyId={
                          guide.property.id
                        }
                        city={
                          guide.property.city
                        }
                        slug={
                          guide.property.slug
                        }
                      />
                    </div>

                    <a
                      href="#guide-qr-modal"
                      data-analytics-action="view_qr"
                      className="inline-flex items-center justify-center rounded-full border border-[#c5a57a]/30 bg-[#c5a57a]/10 px-4 py-2 text-sm font-semibold text-[#f1dfc4] transition hover:border-[#c5a57a]/60 hover:bg-[#c5a57a]/20"
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
            data-analytics-section="guide_qr_modal"
            className="fixed inset-0 z-[9999] hidden items-center justify-center bg-black/85 px-4 py-8 target:flex"
          >
            <a
              href="#"
              aria-label="Close QR modal"
              data-analytics-action="close_qr"
              className="absolute inset-0"
            />

            <Card className="relative z-[10000] w-full max-w-sm overflow-hidden border-white/10 bg-neutral-950 text-white">
              <CardContent className="space-y-5 p-6 text-center">
                <div className="flex items-start justify-between gap-4 text-left">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">
                      Guest QR Code
                    </h2>

                    <p className="text-sm text-neutral-400">
                      Guests can scan this code to open this neighborhood guide
                      instantly on their phone.
                    </p>
                  </div>

                  <a
                    href="#"
                    aria-label="Close QR modal"
                    data-analytics-action="close_qr"
                    className="rounded-full border border-white/15 px-3 py-1 text-sm font-medium text-white hover:bg-white/10"
                  >
                    ×
                  </a>
                </div>

                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white p-4">
                    <img
                      src={
                        guideQrImageUrl
                      }
                      alt={`QR code for ${guide.property.name}`}
                      className="h-[220px] w-[220px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {
                      guide.property
                        .name
                    }
                  </p>

                  <p className="break-all text-xs text-neutral-500">
                    {guideUrl}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* =================================================
              HOST PICKS — EDITORIAL SHORTLIST
              Above the neighborhood map.
              ================================================= */}

          {hostPickCards.length > 0 && (
            <SectionShell
              eyebrow="Your host knows best"
              title="The Host's Shortlist"
              id="host-picks"
            >
              <div data-analytics-section="host_picks">
                <HostPicksCarousel
                  venues={hostPickCards}
                  citySlug={guide.normalizedCity}
                />
              </div>
            </SectionShell>
          )}

          <SectionShell
            eyebrow="Neighborhood Map"
            title="View what’s nearby your stay"
          >
            <div
              data-analytics-section="neighborhood_map"
              className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-2xl"
            >
              <div className="h-[430px]">
                <PropertyMap
                  property={
                    guide.property
                  }
                  venues={
                    mapVenuesForMap as any
                  }
                />
              </div>
            </div>
          </SectionShell>

          <SectionShell
            eyebrow="Start a Local Flow"
            title="Pick an experience, then move"
            id="suggested-crawls"
          >
            <div data-analytics-section="property_crawls">
              <PropertyCrawls
                property={
                  guide.property
                }
                crawls={
                  guide.propertyCrawlCards
                }
                nearbyVenues={
                  nearbySwapVenues
                }
              />
            </div>
          </SectionShell>

          {eventJourneyVMs.length >
            0 && (
            <SectionShell
              eyebrow="Event Journeys"
              title="Make the event part of the roam"
              subtitle={
                eventJourneyIntroCopy
              }
              id="event-journeys"
            >
              <div data-analytics-section="event_journeys">
                <EventJourneys
                  journeys={
                    eventJourneyVMs
                  }
                  property={{
                    id:
                      guide.property.id,
                    name:
                      guide.property.name,
                    slug:
                      guide.property.slug,
                    city:
                      guide.property.city,
                  }}
                />
              </div>
            </SectionShell>
          )}

          <section
            id="explore-one-stop"
            data-analytics-section="nearby_check_ins"
            className="space-y-8"
          >
            <SectionHeader
              eyebrow="Nearby Check-ins"
              title="Explore one stop at a time"
            />

            <div className="space-y-3">
              {coffeeCards.length >
                0 && (
                <VenueSection
                  title="☕ Coffee Nearby"
                  subtitle="Good coffee, quick breakfast, and easy daytime starts."
                  venues={coffeeCards.slice(
                    0,
                    5
                  )}
                  property={
                    guide.property
                  }
                  citySlug={
                    guide.normalizedCity
                  }
                />
              )}

              {barCards.length >
                0 && (
                <VenueSection
                  title="🍸 Bars Nearby"
                  subtitle="Strong nearby options for drinks before or after dinner."
                  venues={barCards.slice(
                    0,
                    5
                  )}
                  property={
                    guide.property
                  }
                  citySlug={
                    guide.normalizedCity
                  }
                />
              )}

              {dinnerCards.length >
                0 && (
                <VenueSection
                  title="🍽 Dinner Nearby"
                  subtitle="Best nearby places for a full meal or an easy evening out."
                  venues={dinnerCards.slice(
                    0,
                    5
                  )}
                  property={
                    guide.property
                  }
                  citySlug={
                    guide.normalizedCity
                  }
                />
              )}

              {wellnessCards.length >
                0 && (
                <VenueSection
                  title="🧘 Wellness Nearby"
                  subtitle="Reset, move, or recharge close to the property."
                  venues={wellnessCards.slice(
                    0,
                    5
                  )}
                  property={
                    guide.property
                  }
                  citySlug={
                    guide.normalizedCity
                  }
                />
              )}
            </div>
          </section>

          {guide.nearbyEvents.length >
            0 && (
            <SectionShell
              eyebrow="Events Nearby"
              title="Happening around this stay"
            >
              <div
                data-analytics-section="nearby_events"
                className="grid gap-3 md:grid-cols-2"
              >
                {guide.nearbyEvents.map(
                  (ev: any) => (
                    <Card
                      key={ev.id}
                      data-venue-id={ev.venue_id}
                      className="border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.07]"
                    >
                      <CardContent className="space-y-2 p-4">
                        <p className="font-semibold">
                          {ev.title}
                        </p>

                        <p className="text-xs text-neutral-400">
                          {
                            ev.venue_name
                          }
                        </p>

                        <p className="text-xs text-neutral-400">
                          {DateTime.fromISO(
                            ev.starts_at
                          )
                            .setZone(
                              guide.timezone
                            )
                            .toFormat(
                              'M/d h:mm a'
                            )}
                        </p>

                        <Link
                          href={`/venue-profile/${ev.venue_id}`}
                          data-analytics-action="view_event_venue"
                          data-venue-id={ev.venue_id}
                          className="text-xs font-medium text-cyan-300 underline underline-offset-4"
                        >
                          View Venue
                        </Link>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </SectionShell>
          )}
        </div>
      </main>
    </PropertyGuideInteractionTracker>
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
    <section
      id={id}
      className="space-y-4"
    >
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
      />

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

function VenueSection({
  title,
  subtitle,
  venues,
  property,
  citySlug,
  defaultExpanded = false,
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
  citySlug: string
  defaultExpanded?: boolean
}) {
  return (
    <details
      open={defaultExpanded}
      data-analytics-section={title}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-colors open:bg-white/[0.045]"
    >
      <summary
        data-analytics-action="toggle_nearby_category"
        className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300 [&::-webkit-details-marker]:hidden sm:p-5"
      >
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-bold text-white">
            {title}
          </h3>

          {subtitle ? (
            <p className="text-xs leading-5 text-neutral-400 sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-cyan-300 transition-transform duration-200 group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </summary>

      {/* =================================================
          EXPLORE-STYLE NEARBY VENUE CARDS
          Matches Explore's card hierarchy, without city.
          ================================================= */}

      <div className="border-t border-white/10 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {venues.map(
            (venue) => {
              const flowParams =
                new URLSearchParams({
                  city: citySlug,
                  venue: venue.id,
                  buildFlow: '1',
                })

              const buildFlowHref =
                `/?${flowParams.toString()}`

              const distance =
                venue.distanceLabel

              const typeChips =
                venue.types.slice(0, 2)

              const vibeChips =
                venue.vibes.slice(0, 2)

              return (
                <article
                  key={venue.id}
                  data-venue-id={venue.id}
                  className="group/card flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.065] to-white/[0.025] shadow-[0_18px_50px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.075] transition duration-200 hover:-translate-y-0.5 hover:ring-cyan-300/25"
                >
                  <Link
                    href={venue.href}
                    aria-label={`View ${venue.name}`}
                    data-analytics-action="view_place_image"
                    className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.035]">
                      <img
                        src={
                          venue.imageUrl ||
                          '/placeholder-venue.jpg'
                        }
                        alt={venue.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.04]"
                      />
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    {(distance || venue.price) && (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500">
                        {distance && (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                              <circle cx="12" cy="10" r="2.5" />
                            </svg>
                            {distance}
                          </span>
                        )}

                        {distance && venue.price && (
                          <span aria-hidden="true">·</span>
                        )}

                        {venue.price && (
                          <span>{venue.price}</span>
                        )}
                      </div>
                    )}

                    <Link
                      href={venue.href}
                      data-analytics-action="view_place_title"
                      className="w-fit rounded-sm text-lg font-semibold leading-snug tracking-tight text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    >
                      {venue.name}
                    </Link>

                    {venue.address && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                        {venue.address}
                      </p>
                    )}

                    {venue.description && (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-400">
                        {venue.description}
                      </p>
                    )}

                    {(typeChips.length > 0 ||
                      vibeChips.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {typeChips.map((type) => (
                          <span
                            key={`type-${type}`}
                            className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.085] px-2.5 py-1 text-[11px] font-medium text-cyan-200"
                          >
                            {type}
                          </span>
                        ))}

                        {vibeChips.map((vibe) => (
                          <span
                            key={`vibe-${vibe}`}
                            className="rounded-full border border-white/[0.075] bg-white/[0.045] px-2.5 py-1 text-[11px] font-medium text-neutral-300"
                          >
                            {vibe}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <Link
                        href={venue.href}
                        data-analytics-action="view_place"
                        className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] px-3 text-center text-sm font-semibold text-white transition hover:bg-white/[0.085] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                      >
                        View Place
                      </Link>

                      <Link
                        href={buildFlowHref}
                        data-analytics-action="build_flow"
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 px-3 text-center text-sm font-black text-white shadow-[0_12px_30px_rgba(34,211,238,0.12)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                      >
                        Build a Flow

                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 shrink-0"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </article>
              )
            }
          )}
        </div>
      </div>
    </details>
  )
}

function Pill({
  children,
}: {
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-100">
      {children}
    </span>
  )
}

function Chip({
  children,
}: {
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-300">
      {children}
    </span>
  )
}
