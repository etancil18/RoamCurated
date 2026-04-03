import Link from 'next/link'
import { DateTime } from 'luxon'

import { createServerClient } from '@/lib/supabase/server'
import { CITY_CONFIGS } from '@/config/cities'
import { Card, CardContent } from '@/components/ui/card'
import CrawlMap from '../crawl/CrawlMap'
import { logEventServer } from '@/lib/logEventServer'

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
    event_end_at?: string
    route_title?: string
    route_style?: string
    recommended_start_at?: string
    recommended_arrival_at?: string
    arrival_buffer_minutes?: string
    selection_reason_summary?: string
    arrival_policy?: string
    arrival_preference?: string
  }>
}

type RouteVenue = {
  id: string
  name: string
  lat: number
  lon: number
  city?: string
  link: string
  description?: string | null
}

function cleanText(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function sentenceCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function humanizeRouteStyle(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === 'direct') return 'Go straight there'
  if (normalized === 'quick_stop' || normalized === 'quick stop') {
    return 'Quick stop before the event'
  }
  if (normalized === 'balanced_pregame' || normalized === 'balanced pregame') {
    return 'Balanced pregame'
  }
  if (normalized === 'full_pregame' || normalized === 'full pregame') {
    return 'Full pregame'
  }

  return cleanText(value) ? sentenceCase(String(value)) : null
}

function formatEventDateTime(iso: string | null | undefined, timezone: string) {
  if (!iso) return null

  const dt = DateTime.fromISO(iso).setZone(timezone)
  if (!dt.isValid) return null

  return dt.toFormat('M/d h:mm a')
}

function formatEventDateTimeRange({
  startISO,
  endISO,
  timezone,
}: {
  startISO: string | null | undefined
  endISO: string | null | undefined
  timezone: string
}) {
  const start = startISO ? DateTime.fromISO(startISO).setZone(timezone) : null
  const end = endISO ? DateTime.fromISO(endISO).setZone(timezone) : null

  if (!start?.isValid) return null
  if (!end?.isValid) return start.toFormat('M/d h:mm a')

  if (start.hasSame(end, 'day')) {
    return `${start.toFormat('M/d h:mm a')} – ${end.toFormat('h:mm a')}`
  }

  return `${start.toFormat('M/d h:mm a')} – ${end.toFormat('M/d h:mm a')}`
}

function formatClockTime(iso: string | null | undefined, timezone: string) {
  if (!iso) return null

  const dt = DateTime.fromISO(iso).setZone(timezone)
  if (!dt.isValid) return null

  return dt.toFormat('h:mm a')
}

function positiveIntOrNull(value: string | null | undefined) {
  if (!value) return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatStopCountLabel(stopCount: number) {
  if (stopCount <= 0) return 'Direct route'
  if (stopCount === 1) return '1 stop'
  return `${stopCount} stops`
}

function buildArrivalLabel({
  arrivalPolicy,
  arrivalPreference,
  recommendedArrivalLabel,
  arrivalBufferMinutes,
}: {
  arrivalPolicy: string | null
  arrivalPreference: string | null
  recommendedArrivalLabel: string | null
  arrivalBufferMinutes: number | null
}) {
  const normalizedPolicy = String(arrivalPolicy ?? '').trim().toLowerCase()
  const normalizedPreference = String(arrivalPreference ?? '').trim().toLowerCase()

  if (normalizedPolicy === 'midpoint_deadline') {
    if (recommendedArrivalLabel) {
      return `Arrive by ~${recommendedArrivalLabel} (before midpoint)`
    }
    return 'Arrive before the midpoint of the event'
  }

  if (normalizedPolicy === 'window') {
    if (recommendedArrivalLabel) {
      return `Arrive anytime before ~${recommendedArrivalLabel}`
    }
    return 'Flexible arrival window'
  }

  if (normalizedPolicy === 'by_start') {
    if (normalizedPreference === 'early' && arrivalBufferMinutes) {
      return `Arrive early (~${arrivalBufferMinutes} min before start)`
    }

    if (normalizedPreference === 'fashionably_late' && recommendedArrivalLabel) {
      return `Arrive slightly late (~${recommendedArrivalLabel})`
    }

    if (normalizedPreference === 'late_ok' && recommendedArrivalLabel) {
      return `Late arrival is acceptable (~${recommendedArrivalLabel})`
    }

    if (arrivalBufferMinutes) {
      return `Arrive ~${arrivalBufferMinutes} min before start`
    }
  }

  if (recommendedArrivalLabel) {
    return `Aim to arrive by ${recommendedArrivalLabel}`
  }

  return null
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function StopDescription({ description }: { description: string }) {
  return (
    <details className="group space-y-1">
      <summary className="list-none cursor-pointer">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground line-clamp-2 group-open:line-clamp-none">
            {description}
          </p>
          <span className="text-xs font-medium text-muted-foreground underline underline-offset-2 group-open:hidden">
            Show more
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground underline underline-offset-2 group-open:inline">
            Show less
          </span>
        </div>
      </summary>
    </details>
  )
}

export default async function PropertyEventRoutePage({ searchParams }: Props) {
  const supabase = await createServerClient()
  const resolvedSearchParams = await searchParams

  const city = resolvedSearchParams.city ?? ''
  const venueIds = (resolvedSearchParams.venues ?? '')
    .split(',')
    .map((id) => id.trim())
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

  const hasDestinationCoords =
    Number.isFinite(destinationLat) && Number.isFinite(destinationLon)

  const eventName = cleanText(resolvedSearchParams.event_name)
  const eventStartAt = cleanText(resolvedSearchParams.event_start_at)
  const eventEndAt = cleanText(resolvedSearchParams.event_end_at)

  const routeTitle =
    cleanText(resolvedSearchParams.route_title) || 'Event Journey'
  const routeStyleLabel = humanizeRouteStyle(resolvedSearchParams.route_style)

  const timezone = CITY_CONFIGS[city]?.timezone ?? 'UTC'

  const recommendedStartLabel = formatClockTime(
    resolvedSearchParams.recommended_start_at,
    timezone
  )
  const recommendedArrivalLabel = formatClockTime(
    resolvedSearchParams.recommended_arrival_at,
    timezone
  )
  const arrivalBufferMinutes = positiveIntOrNull(
    resolvedSearchParams.arrival_buffer_minutes
  )
  const selectionReasonSummary = cleanText(
    resolvedSearchParams.selection_reason_summary
  )
  const arrivalPolicy = cleanText(resolvedSearchParams.arrival_policy)
  const arrivalPreference = cleanText(resolvedSearchParams.arrival_preference)

  const arrivalLabel = buildArrivalLabel({
    arrivalPolicy,
    arrivalPreference,
    recommendedArrivalLabel,
    arrivalBufferMinutes,
  })

  const { data } = await supabase.from('venues').select('*').in('id', venueIds)

  const venueMap = new Map(
    (data ?? []).map((v: any) => [
      v.id,
      {
        ...v,
        lat: typeof v.lat === 'number' ? v.lat : parseFloat(v.lat),
        lon: typeof v.lon === 'number' ? v.lon : parseFloat(v.lon),
        link: `/venue-profile/${v.id}`,
      } satisfies RouteVenue,
    ])
  )

  const venues = venueIds
    .map((id) => venueMap.get(id))
    .filter(Boolean) as RouteVenue[]

  const destinationVenue: RouteVenue | null = hasDestinationCoords
    ? {
        id: 'event-destination',
        name: destinationName,
        lat: destinationLat as number,
        lon: destinationLon as number,
        city,
        link: '#',
      }
    : null

  const routeVenues: RouteVenue[] = destinationVenue
    ? [...venues, destinationVenue]
    : venues

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

  const nowISO =
    DateTime.now().setZone(timezone).toISO() ?? new Date().toISOString()

  const formattedEventRange = formatEventDateTimeRange({
    startISO: eventStartAt,
    endISO: eventEndAt,
    timezone,
  })

  const markerRefs = { current: {} as Record<string, any> }

  const stopCount = venues.length
  const propertyHref =
    propertySlug && city
      ? `/property/${encodeURIComponent(city)}/${encodeURIComponent(propertySlug)}`
      : null

  await Promise.all([
    logEventServer({
      impression_type: 'event_journey_route_viewed',
      metadata: {
        property_id: propertyId ?? null,
        property_slug: propertySlug ?? property.slug ?? null,
        property_name: property.name,
        city,
        route_title: routeTitle,
        route_style: cleanText(resolvedSearchParams.route_style),
        route_style_label: routeStyleLabel,
        event_name: eventName,
        event_start_at: eventStartAt,
        event_end_at: eventEndAt,
        formatted_event_range: formattedEventRange,
        recommended_start_at: cleanText(resolvedSearchParams.recommended_start_at),
        recommended_arrival_at: cleanText(
          resolvedSearchParams.recommended_arrival_at
        ),
        recommended_start_label: recommendedStartLabel,
        recommended_arrival_label: recommendedArrivalLabel,
        arrival_policy: arrivalPolicy,
        arrival_preference: arrivalPreference,
        arrival_label: arrivalLabel,
        arrival_buffer_minutes: arrivalBufferMinutes,
        selection_reason_summary: selectionReasonSummary,
        stop_count: stopCount,
        stop_ids: venues.map((venue) => venue.id),
        destination_name: destinationName,
        has_destination_coords: hasDestinationCoords,
      },
    }),

    ...(venues.length > 0
      ? [
          logEventServer({
            impression_type: 'event_journey_route_stops_section_impression',
            metadata: {
              property_id: propertyId ?? null,
              property_slug: propertySlug ?? property.slug ?? null,
              city,
              route_title: routeTitle,
              event_name: eventName,
              stop_count: stopCount,
              stop_ids: venues.map((venue) => venue.id),
            },
          }),
        ]
      : []),

    logEventServer({
      impression_type: 'event_journey_route_map_impression',
      metadata: {
        property_id: propertyId ?? null,
        property_slug: propertySlug ?? property.slug ?? null,
        city,
        route_title: routeTitle,
        event_name: eventName,
        stop_count: stopCount,
        route_venue_count: routeVenues.length,
        has_destination_coords: hasDestinationCoords,
      },
    }),

    ...(venues.length > 0
      ? venues.map((venue, index) =>
          logEventServer({
            impression_type: 'event_journey_route_stop_impression',
            venue_id: venue.id,
            metadata: {
              property_id: propertyId ?? null,
              property_slug: propertySlug ?? property.slug ?? null,
              city,
              route_title: routeTitle,
              event_name: eventName,
              destination_name: destinationName,
              stop_id: venue.id,
              stop_name: venue.name,
              stop_order: index + 1,
              stop_count: stopCount,
              venue_href: venue.link,
            },
          })
        )
      : []),

    logEventServer({
      impression_type: 'event_journey_route_destination_impression',
      metadata: {
        property_id: propertyId ?? null,
        property_slug: propertySlug ?? property.slug ?? null,
        city,
        route_title: routeTitle,
        event_name: eventName,
        destination_name: destinationName,
        has_destination_coords: hasDestinationCoords,
        destination_lat: hasDestinationCoords ? destinationLat : null,
        destination_lon: hasDestinationCoords ? destinationLon : null,
      },
    }),
  ])

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="space-y-3">
        {propertyHref && (
          <Link
            href={propertyHref}
            className="inline-flex items-center text-sm text-muted-foreground hover:underline"
          >
            ← Back to property guide
          </Link>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{routeTitle}</h1>

          <div className="space-y-1 text-sm text-muted-foreground">
            {eventName && <p>{eventName}</p>}
            <p>Destination: {destinationName}</p>
            {formattedEventRange && <p>Event window: {formattedEventRange}</p>}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {routeStyleLabel && <Chip>{routeStyleLabel}</Chip>}
            <Chip>{formatStopCountLabel(stopCount)}</Chip>
            {arrivalLabel && <Chip>{arrivalLabel}</Chip>}
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            {recommendedStartLabel && <p>Leave around {recommendedStartLabel}</p>}
            {recommendedArrivalLabel && !arrivalLabel && (
              <p>Aim to arrive by {recommendedArrivalLabel}</p>
            )}
          </div>

          {selectionReasonSummary && (
            <p className="text-sm text-muted-foreground">
              {selectionReasonSummary}
            </p>
          )}
        </CardContent>
      </Card>

      {venues.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Route stops
              </h2>
              <p className="text-sm text-muted-foreground">
                Follow this sequence before heading into the event.
              </p>
            </div>

            <div className="space-y-3">
              {venues.map((venue, index) => (
                <div
                  key={venue.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={venue.link}
                      className="font-medium hover:underline"
                    >
                      {venue.name}
                    </Link>

                    {cleanText(venue.description) && (
                      <StopDescription description={venue.description!} />
                    )}
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Final destination:{' '}
                <span className="font-medium text-foreground">
                  {destinationName}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <CrawlMap
            venues={routeVenues}
            property={property}
            city={city}
            nowISO={nowISO}
            markerRefs={markerRefs}
            propertySlug={propertySlug ?? property.slug}
          />
        </CardContent>
      </Card>
    </main>
  )
}