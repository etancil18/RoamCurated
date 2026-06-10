import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseServerApi } from '@/lib/supabase/server-api'

import HeroBanner from '@/components/venue-profile/HeroBanner'
import SocialLinks from '@/components/venue-profile/SocialLinks'
import VenueHours from '@/components/venue-profile/VenueHours'
import LiveStatusPill from '@/components/venue-profile/LiveStatusPill'
import EventCarousel from '@/components/venue-profile/EventCarousel'
import VenueVisitButton from '@/components/venue-profile/VenueVisitButton'
import VenueBookingButtons from '@/components/venue-profile/VenueBookingButtons'

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
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export default async function VenueProfilePage({ params }: { params: Params }) {
  const { venueId } = await params
  const supabase = await supabaseServerApi()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: venue, error: venueError } = await supabase
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

  if (venueError || !venue || !venue.name) {
    notFound()
  }

  const normalizedVenue: VenueProfileData = {
    id: venue.id,
    name: venue.name ?? 'Unnamed Venue',
    description: venue.description ?? null,
    city: venue.city ?? null,
    cover: venue.cover ?? null,
    address: venue.address ?? null,
    contact: Array.isArray(venue.contact) ? venue.contact : null,
    tags:
      typeof venue.tags === 'string'
        ? (venue.tags as string).split(',').map((tag) => tag.trim())
        : [],
    hours:
      venue.hours &&
      typeof venue.hours === 'object' &&
      !Array.isArray(venue.hours)
        ? (venue.hours as Record<
            string,
            { open: string; close: string } | null
          >)
        : undefined,
  }

  const normalizedCity = normalizeCityKey(venue.city)
  const venueLat = toNumberOrNull(venue.lat)
  const venueLon = toNumberOrNull(venue.lon)

  const backToMapHref =
    normalizedCity && venueLat !== null && venueLon !== null
      ? `/?city=${encodeURIComponent(normalizedCity)}&lat=${encodeURIComponent(
          String(venueLat)
        )}&lon=${encodeURIComponent(
          String(venueLon)
        )}&venueId=${encodeURIComponent(venue.id)}&zoom=16`
      : normalizedCity
        ? `/?city=${encodeURIComponent(normalizedCity)}`
        : '/'

  const { data: liveStatusRaw } = await supabase
    .from('venue_live_status')
    .select('is_open_for_dropins, status_tags')
    .eq('venue_id', venueId)
    .single()

  const liveStatus: VenueLiveStatus | undefined = liveStatusRaw
    ? {
        is_open_for_dropins: !!liveStatusRaw.is_open_for_dropins,
        status_tags: liveStatusRaw.status_tags ?? [],
      }
    : undefined

  const { data: venueBookings } = await supabase
    .from('venue_bookings')
    .select('provider, url')
    .eq('venue_id', venueId)

  const bookingOptions =
    (venueBookings ?? []).filter(
      (row): row is { provider: string; url: string } =>
        typeof row?.provider === 'string' && typeof row?.url === 'string'
    )

  const { data: events } = await supabase
    .from('events')
    .select('id, title, description, starts_at, ends_at, tags, ticket_link')
    .eq('venue_id', venueId)
    .order('starts_at', { ascending: true })

  const { data: recurringEvents } = await supabase
    .from('recurring_events')
    .select(
      'id, title, start_time, end_time, recurrence_rule, starts_on, ends_on'
    )
    .eq('venue_id', venueId)

  const standardEventIds = (events ?? []).map((e) => e.id)

  let interestedEventIds: string[] = []

  if (user && standardEventIds.length > 0) {
    const { data: interestRows } = await supabase
      .from('event_interests')
      .select('event_id')
      .eq('user_id', user.id)
      .in('event_id', standardEventIds)

    interestedEventIds = (interestRows ?? [])
      .map((row) => row.event_id)
      .filter((value): value is string => typeof value === 'string')
  }

  const upcomingEvents: VenueEvent[] = [
    ...(events ?? [])
      .filter((e) => e.title)
      .map((e) => ({
        id: e.id,
        title: e.title ?? 'Untitled Event',
        description: e.description ?? undefined,
        starts_at: e.starts_at ?? undefined,
        ends_at: e.ends_at ?? undefined,
        tags: e.tags ?? [],
        ticket_link: e.ticket_link ?? undefined,
      })),
    ...(recurringEvents ?? [])
      .filter((e) => e.title)
      .map((rec) => {
        let startsAt: string | undefined = undefined
        if (rec.starts_on && rec.start_time) {
          startsAt = `${rec.starts_on}T${rec.start_time}`
        }

        return {
          id: rec.id,
          title: rec.title ?? 'Recurring Event',
          starts_at: startsAt,
          ends_at: undefined,
          start_time: rec.start_time,
          end_time: rec.end_time ?? undefined,
          recurrence_rule: rec.recurrence_rule,
          starts_on: rec.starts_on,
          ends_on: rec.ends_on ?? undefined,
          isRecurring: true,
        }
      }),
  ]

  return (
    <div
      className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pt-24 pb-6 space-y-10
           bg-white text-gray-900
           dark:bg-neutral-950 dark:text-gray-100"
    >
      <div className="sticky top-16 z-30 -mx-4 bg-white/95 px-4 py-3 backdrop-blur dark:bg-neutral-950/95 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <Link
          href={backToMapHref}
          className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium
               text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800
               dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400 dark:hover:bg-zinc-800 dark:hover:text-blue-300"
        >
          ← Back to {normalizedVenue.city ?? 'Map'}
        </Link>
      </div>

      <HeroBanner venue={normalizedVenue} />

      <VenueVisitButton
        venueId={venueId}
        venueName={normalizedVenue.name}
      />

      {normalizedVenue.description && (
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          {normalizedVenue.description}
        </p>
      )}

      {normalizedVenue.address && (
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
          {normalizedVenue.address}
        </p>
      )}

      {liveStatus && <LiveStatusPill status={liveStatus} />}

      {bookingOptions.length > 0 && (
        <VenueBookingButtons bookingOptions={bookingOptions} />
      )}
      
      <SocialLinks contact={normalizedVenue.contact} />

      <VenueHours
        hours={normalizedVenue.hours}
        isOpen={liveStatus?.is_open_for_dropins}
      />

      {upcomingEvents.length > 0 && (
        <EventCarousel
          events={upcomingEvents}
          interestedEventIds={interestedEventIds}
        />
      )}
    </div>
  )
}