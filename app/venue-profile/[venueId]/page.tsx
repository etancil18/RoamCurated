// app/venue-profile/[venueId]/page.tsx

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseServerApi } from '@/lib/supabase/server-api'

import HeroBanner from '@/components/venue-profile/HeroBanner'
import SocialLinks from '@/components/venue-profile/SocialLinks'
import VenueHours from '@/components/venue-profile/VenueHours'
import EventCarousel from '@/components/venue-profile/EventCarousel'
import VenueVisitButton from '@/components/venue-profile/VenueVisitButton'
import VenueBookingButtons from '@/components/venue-profile/VenueBookingButtons'
import VenuePartnerBadge from '@/components/venue-profile/VenuePartnerBadge'

import {
  VenueProfileData,
  VenueEvent,
  VenueLiveStatus,
} from '@/types/venue-profile'

type Params = { venueId: string }

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
    la: 'la',
    'los angeles': 'la',
    'los-angeles': 'la',
    hollywood: 'la',
    'west hollywood': 'la',
    weho: 'la',
    venice: 'la',
    'santa monica': 'la',
    dtla: 'la',
    london: 'london',
    ldn: 'london',
    'greater london': 'london',
    shoreditch: 'london',
    camden: 'london',
    hackney: 'london',
    soho: 'london',
    chelsea: 'london',
    porto: 'porto',
    oporto: 'porto',
    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

export default async function VenueProfilePage({
  params,
}: {
  params: Params
}) {
  const { venueId } = await params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const {
    data: venue,
    error: venueError,
  } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      description,
      tags,
      contact,
      hours,
      city,
      cover,
      address,
      lat,
      lon
    `)
    .eq('id', venueId)
    .single()

  if (
    venueError ||
    !venue ||
    !venue.name
  ) {
    notFound()
  }

  const normalizedVenue: VenueProfileData = {
    id: venue.id,
    name:
      venue.name ??
      'Unnamed Venue',
    description:
      venue.description ??
      null,
    city:
      venue.city ??
      null,
    cover:
      venue.cover ??
      null,
    address:
      venue.address ??
      null,
    contact:
      Array.isArray(
        venue.contact
      )
        ? venue.contact
        : null,
    tags:
      typeof venue.tags ===
      'string'
        ? (
            venue.tags as string
          )
            .split(',')
            .map((tag) =>
              tag.trim()
            )
        : [],
    hours:
      venue.hours &&
      typeof venue.hours ===
        'object' &&
      !Array.isArray(
        venue.hours
      )
        ? (venue.hours as Record<
            string,
            {
              open: string
              close: string
            } | null
          >)
        : undefined,
  }

  const normalizedCity =
    normalizeCityKey(
      venue.city
    )

  const venueLat =
    toNumberOrNull(
      venue.lat
    )

  const venueLon =
    toNumberOrNull(
      venue.lon
    )

  const backToMapHref =
    normalizedCity &&
    venueLat !== null &&
    venueLon !== null
      ? `/?city=${encodeURIComponent(
          normalizedCity
        )}&lat=${encodeURIComponent(
          String(venueLat)
        )}&lon=${encodeURIComponent(
          String(venueLon)
        )}&venueId=${encodeURIComponent(
          venue.id
        )}&zoom=16`
      : normalizedCity
        ? `/?city=${encodeURIComponent(
            normalizedCity
          )}`
        : '/'

  const venueAddress =
    typeof normalizedVenue.address ===
      'string' &&
    normalizedVenue.address.trim().length >
      0
      ? normalizedVenue.address.trim()
      : null

  const venueMapsQuery =
  venueAddress ??
  (
    [
      normalizedVenue.name,
      normalizedVenue.city,
    ]
      .filter(
        (
          value
        ): value is string =>
          typeof value === 'string' &&
          value.trim().length > 0
      )
      .join(', ') ||
    (
      venueLat !== null &&
      venueLon !== null
        ? `${venueLat},${venueLon}`
        : normalizedVenue.name
    )
  )

const venueMapsHref =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venueMapsQuery
  )}`

  const nowIso =
    new Date().toISOString()

  const { data: partnership } =
    await supabase
      .from(
        'venue_partnerships'
      )
      .select(
        'badge_label, offer_title, offer_description, terms, partner_since'
      )
      .eq(
        'venue_id',
        venueId
      )
      .eq(
        'status',
        'active'
      )
      .or(
        `starts_at.is.null,starts_at.lte.${nowIso}`
      )
      .or(
        `ends_at.is.null,ends_at.gte.${nowIso}`
      )
      .maybeSingle()

  const {
    data: liveStatusRaw,
  } = await supabase
    .from(
      'venue_live_status'
    )
    .select(
      'is_open_for_dropins, status_tags'
    )
    .eq(
      'venue_id',
      venueId
    )
    .single()

  const liveStatus:
    | VenueLiveStatus
    | undefined =
    liveStatusRaw
      ? {
          is_open_for_dropins:
            Boolean(
              liveStatusRaw.is_open_for_dropins
            ),
          status_tags:
            liveStatusRaw.status_tags ??
            [],
        }
      : undefined

  const {
    data: venueBookings,
  } = await supabase
    .from(
      'venue_bookings'
    )
    .select(
      'provider, url'
    )
    .eq(
      'venue_id',
      venueId
    )

  const bookingOptions =
    (
      venueBookings ?? []
    ).filter(
      (
        row
      ): row is {
        provider: string
        url: string
      } =>
        typeof row?.provider ===
          'string' &&
        typeof row?.url ===
          'string'
    )

  const { data: events } =
    await supabase
      .from('events')
      .select(
        'id, title, description, starts_at, ends_at, tags, ticket_link'
      )
      .eq(
        'venue_id',
        venueId
      )
      .order(
        'starts_at',
        {
          ascending: true,
        }
      )

  const {
    data: recurringEvents,
  } = await supabase
    .from(
      'recurring_events'
    )
    .select(
      'id, title, start_time, end_time, recurrence_rule, starts_on, ends_on'
    )
    .eq(
      'venue_id',
      venueId
    )

  const standardEventIds =
    (
      events ?? []
    ).map(
      (event) =>
        event.id
    )

  let interestedEventIds:
    string[] = []

  if (
    user &&
    standardEventIds.length >
      0
  ) {
    const {
      data: interestRows,
    } = await supabase
      .from(
        'event_interests'
      )
      .select(
        'event_id'
      )
      .eq(
        'user_id',
        user.id
      )
      .in(
        'event_id',
        standardEventIds
      )

    interestedEventIds =
      (
        interestRows ?? []
      )
        .map(
          (row) =>
            row.event_id
        )
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
            'string'
        )
  }

  const upcomingEvents:
    VenueEvent[] = [
    ...(
      events ?? []
    )
      .filter(
        (event) =>
          event.title
      )
      .map(
        (event) => ({
          id: event.id,
          title:
            event.title ??
            'Untitled Event',
          description:
            event.description ??
            undefined,
          starts_at:
            event.starts_at ??
            undefined,
          ends_at:
            event.ends_at ??
            undefined,
          tags:
            event.tags ??
            [],
          ticket_link:
            event.ticket_link ??
            undefined,
        })
      ),

    ...(
      recurringEvents ?? []
    )
      .filter(
        (event) =>
          event.title
      )
      .map((recurringEvent) => {
        let startsAt:
          | string
          | undefined =
          undefined

        if (
          recurringEvent.starts_on &&
          recurringEvent.start_time
        ) {
          startsAt =
            `${recurringEvent.starts_on}T${recurringEvent.start_time}`
        }

        return {
          id:
            recurringEvent.id,
          title:
            recurringEvent.title ??
            'Recurring Event',
          starts_at:
            startsAt,
          ends_at:
            undefined,
          start_time:
            recurringEvent.start_time,
          end_time:
            recurringEvent.end_time ??
            undefined,
          recurrence_rule:
            recurringEvent.recurrence_rule,
          starts_on:
            recurringEvent.starts_on,
          ends_on:
            recurringEvent.ends_on ??
            undefined,
          isRecurring: true,
        }
      }),
  ]

  return (
    <main className="min-h-screen overflow-hidden bg-black pb-12 pt-16 text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-12%] h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl" />

        <div className="absolute right-[-12%] top-[8%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="absolute bottom-[-20%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="sticky top-16 z-[4500] border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
          <Link
            href={
              backToMapHref
            }
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-cyan-200 shadow-lg transition hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
          >
            ← Back to{' '}
            {normalizedVenue.city ??
              'Map'}
          </Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 pt-10 sm:px-6 md:pt-16">
        <div className="space-y-7">
          <section className="rounded-[2.25rem] border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.035] p-2 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-3">
            <div className="overflow-hidden rounded-[1.75rem]">
              <HeroBanner
                venue={
                  normalizedVenue
                }
              />
            </div>
          </section>

          {partnership && (
            <section className="rounded-[1.75rem] border border-indigo-400/25 bg-indigo-500/10 p-5 shadow-2xl backdrop-blur-xl">
              <VenuePartnerBadge
                partnership={
                  partnership
                }
              />
            </section>
          )}

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-4">
                {normalizedVenue.city && (
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
                    {
                      normalizedVenue.city
                    }
                  </p>
                )}

                {normalizedVenue.description && (
                  <p className="whitespace-pre-line text-base leading-8 text-slate-300">
                    {
                      normalizedVenue.description
                    }
                  </p>
                )}

                {(
                  normalizedVenue.tags ??
                  []
                ).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(
                      normalizedVenue.tags ??
                      []
                    )
                      .slice(0, 8)
                      .map(
                        (tag) => (
                          <span
                            key={
                              tag
                            }
                            className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-bold text-slate-400"
                          >
                            {
                              tag
                            }
                          </span>
                        )
                      )}
                  </div>
                )}

                {normalizedVenue.address && (
                  <a
                    href={venueMapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${normalizedVenue.name} in Google Maps`}
                    className="block whitespace-pre-line rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-slate-300 transition hover:border-cyan-400/40 hover:bg-white/[0.07] hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    📍{' '}
                    {
                      normalizedVenue.address
                    }
                  </a>
                )}
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 sm:w-64">
                <div
                  className="
                    rounded-2xl
                    border
                    border-white/10
                    bg-black/30
                    p-3
                    shadow-lg
                    shadow-black/20
                  "
                >
                  <VenueVisitButton
                    venueId={
                      venueId
                    }
                    venueName={
                      normalizedVenue.name
                    }
                  />
                </div>

                {bookingOptions.length >
                  0 && (
                  <div
                    className="
                      rounded-2xl
                      border
                      border-white/10
                      bg-black/30
                      p-3
                      text-slate-100
                      shadow-lg
                      shadow-black/20
                      [&_h2]:hidden
                      [&_h3]:hidden
                      [&_p]:text-sm
                      [&_p]:text-slate-400
                    "
                  >
                    <p
                      className="
                        mb-2
                        text-[10px]
                        font-black
                        uppercase
                        tracking-[0.22em]
                        text-slate-400
                      "
                    >
                      Reservations
                    </p>

                    <VenueBookingButtons
                      bookingOptions={
                        bookingOptions
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 text-slate-100 shadow-2xl backdrop-blur-xl [&_*]:text-slate-100 [&_a]:text-cyan-300 [&_a:hover]:text-cyan-200 [&_h2]:text-white [&_h3]:text-white [&_p]:text-slate-300">
            <SocialLinks
              contact={
                normalizedVenue.contact
              }
            />
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 text-slate-100 shadow-2xl backdrop-blur-xl [&_*]:text-slate-100 [&_h2]:text-white [&_h3]:text-white [&_p]:text-slate-300">
            <VenueHours
              hours={
                normalizedVenue.hours
              }
              isOpen={
                liveStatus?.is_open_for_dropins
              }
            />
          </section>

          {upcomingEvents.length >
            0 && (
            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-white">
                Upcoming Events
              </h2>

              <EventCarousel
                events={
                  upcomingEvents
                }
                interestedEventIds={
                  interestedEventIds
                }
              />
            </section>
          )}
        </div>
      </div>
    </main>
  )
}