import { notFound } from 'next/navigation'
import { supabaseServerApi } from '@/lib/supabase/server-api'

import HeroBanner from '@/components/venue-profile/HeroBanner'
import SocialLinks from '@/components/venue-profile/SocialLinks'
import VenueHours from '@/components/venue-profile/VenueHours'
import LiveStatusPill from '@/components/venue-profile/LiveStatusPill'
import EventCarousel from '@/components/venue-profile/EventCarousel'
import FollowButton from '@/components/venue-profile/FollowButton'

import {
  VenueProfileData,
  VenueEvent,
  VenueLiveStatus,
} from '@/types/venue-profile'

type Params = { venueId: string }

export default async function VenueProfilePage({ params }: { params: Params }) {
  const { venueId } = await params
  const supabase = await supabaseServerApi()

  // ——— Fetch Venue Info ———
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
      cover
    `)
    .eq('id', venueId)
    .single()

  if (venueError || !venue || !venue.name) {
    notFound()
  }

  // ✅ Normalize venue (NULL → SAFE TYPES)
  const normalizedVenue: VenueProfileData = {
    id: venue.id,
    name: venue.name ?? 'Unnamed Venue',
    description: venue.description ?? null,
    city: venue.city ?? null,
    cover: venue.cover ?? null,
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

  // ——— Fetch Live Status ———
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

  // ——— Fetch Events ———
  const { data: events } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, tags')
    .eq('venue_id', venueId)
    .order('starts_at', { ascending: true })

  const { data: recurringEvents } = await supabase
    .from('recurring_events')
    .select(
      'id, title, start_time, end_time, recurrence_rule, starts_on, ends_on'
    )
    .eq('venue_id', venueId)

  // ✅ Normalize events (NULL → SAFE TYPES)
  const upcomingEvents: VenueEvent[] = [
    ...(events ?? [])
      .filter((e) => e.title)
      .map((e) => ({
        id: e.id,
        title: e.title ?? 'Untitled Event',
        starts_at: e.starts_at ?? undefined,
        ends_at: e.ends_at ?? undefined,
        tags: e.tags ?? [],
      })),
    ...(recurringEvents ?? [])
      .filter((e) => e.title)
      .map((rec) => ({
        id: rec.id,
        title: rec.title ?? 'Recurring Event',
        start_time: rec.start_time,
        end_time: rec.end_time ?? undefined,
        recurrence_rule: rec.recurrence_rule,
        starts_on: rec.starts_on,
        ends_on: rec.ends_on ?? undefined,
        isRecurring: true,
      })),
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-10">
      <HeroBanner venue={normalizedVenue} />

      {liveStatus && <LiveStatusPill status={liveStatus} />}

      <SocialLinks contact={normalizedVenue.contact} />

      <VenueHours
        hours={normalizedVenue.hours}
        isOpen={liveStatus?.is_open_for_dropins}
      />

      {upcomingEvents.length > 0 && (
        <EventCarousel events={upcomingEvents} />
      )}

      <FollowButton venueId={venueId} />
    </div>
  )
}
