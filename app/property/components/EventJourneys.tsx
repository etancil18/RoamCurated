'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import StartFlowButton from '@/components/property/StartFlowButton'
import type { EventJourneyVM } from '@/lib/view-models/buildEventJourneyVM'
import { logEvent } from '@/lib/logEvent'

type Props = {
  journeys: EventJourneyVM[]
  property?: {
    id?: string | null
    name?: string | null
    slug?: string | null
    city?: string | null
  } | null
}

export default function EventJourneys({ journeys, property = null }: Props) {
  const safeJourneys = (journeys ?? []).filter(
    (journey): journey is EventJourneyVM =>
      Boolean(
        journey &&
          journey.id &&
          journey.title &&
          journey.eventName &&
          journey.eventTimeLabel &&
          journey.destinationName
      )
  )

  if (safeJourneys.length === 0) return null

  return (
    <div className="grid gap-4">
      {safeJourneys.map((journey, index) => (
        <EventJourneyCard
          key={journey.id}
          journey={journey}
          property={property}
          position={index}
          totalJourneys={safeJourneys.length}
        />
      ))}
    </div>
  )
}

function EventJourneyCard({
  journey,
  property,
  position,
  totalJourneys,
}: {
  journey: EventJourneyVM
  property?: Props['property']
  position: number
  totalJourneys: number
}) {
  const impressionLoggedRef = useRef(false)
  const venueIds = journey.stops.map((stop) => stop.id).filter(Boolean)
  const canStartFlow = venueIds.length >= 2

  useEffect(() => {
    if (impressionLoggedRef.current) return
    impressionLoggedRef.current = true

    void logEvent('event_journey_impression', {
      metadata: {
        journey_id: journey.id,
        journey_title: journey.title,
        event_name: journey.eventName,
        destination_name: journey.destinationName,
        status: journey.statusLabel,
        position,
        total_journeys: totalJourneys,
        has_href: Boolean(journey.href),
        can_start_flow: canStartFlow,
        stop_count: journey.stops.length,
        route_style_label: journey.routeStyleLabel,
        total_stops_label: journey.totalStopsLabel,
        property_id: property?.id ?? null,
        property_slug: property?.slug ?? null,
        property_name: property?.name ?? null,
      },
    })
  }, [journey, position, totalJourneys, canStartFlow, property])

  const handleJourneyClick = () => {
    void logEvent('event_journey_clicked', {
      metadata: {
        journey_id: journey.id,
        journey_title: journey.title,
        event_name: journey.eventName,
        destination_name: journey.destinationName,
        status: journey.statusLabel,
        position,
        total_journeys: totalJourneys,
        href: journey.href ?? null,
        cta_label: journey.ctaLabel,
        stop_count: journey.stops.length,
        route_style_label: journey.routeStyleLabel,
      },
    })
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Chip>{journey.routeStyleLabel}</Chip>
              <Chip>{journey.totalStopsLabel}</Chip>
              {journey.countdownLabel && <Chip>{journey.countdownLabel}</Chip>}
              {journey.confidenceLabel && <Chip>{journey.confidenceLabel}</Chip>}
              {journey.degradedLabel && <Chip>{journey.degradedLabel}</Chip>}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{journey.title}</h3>
              <p className="text-sm text-muted-foreground">{journey.subtitle}</p>
            </div>

            <div className="space-y-1 text-sm">
              <p className="font-medium">{journey.eventName}</p>
              <p className="text-muted-foreground">
                {journey.eventDateLabel} • {journey.eventTimeLabel}
              </p>
              <p className="text-muted-foreground">{journey.destinationLabel}</p>
            </div>

            {journey.selectionReasonSummary && (
              <p className="text-sm text-muted-foreground">
                {journey.selectionReasonSummary}
              </p>
            )}
          </div>

          <div className="space-y-2 md:text-right">
            <p className="text-sm font-medium">{journey.statusLabel}</p>

            {journey.recommendedStartLabel && (
              <p className="text-sm text-muted-foreground">
                {journey.recommendedStartLabel}
              </p>
            )}

            {journey.arrivalLabel && (
              <p className="text-sm text-muted-foreground">
                {journey.arrivalLabel}
              </p>
            )}

            {journey.totalWalkLabel && (
              <p className="text-sm text-muted-foreground">
                {journey.totalWalkLabel}
              </p>
            )}

            {canStartFlow && (
              <StartFlowButton
                title={journey.title}
                city={property?.city ?? null}
                propertyId={journey.id}
                propertySlug={property?.slug ?? null}
                venueIds={venueIds}
                source="property_event_journey"
                travelMode="walking"
                label="Start Event Flow"
                className="rounded-full px-4 py-2 text-sm"
                metadata={{
                  property_id: property?.id ?? null,
                  property_slug: property?.slug ?? null,
                  property_name: property?.name ?? null,
                  event_journey_id: journey.id,
                  event_name: journey.eventName,
                  destination_name: journey.destinationName,
                  route_style_label: journey.routeStyleLabel,
                  total_stops_label: journey.totalStopsLabel,
                  status_label: journey.statusLabel,
                  position,
                  total_journeys: totalJourneys,
                }}
              />
            )}

            {journey.href ? (
              <Link
                href={journey.href}
                onClick={handleJourneyClick}
                className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Preview Route
              </Link>
            ) : !canStartFlow ? (
              <div className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground">
                {journey.ctaLabel}
              </div>
            ) : null}
          </div>
        </div>

        {journey.stops.length > 0 ? (
          <div className="space-y-3 border-t pt-4">
            {journey.stops.map((stop) => (
              <div key={stop.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {stop.order}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stop.roleLabel}
                    </span>
                    {stop.isCurated && <Chip>Curated</Chip>}
                    {stop.walkTimeFromPreviousLabel && <Chip>{stop.walkTimeFromPreviousLabel}</Chip>}
                    {stop.confidenceLabel && <Chip>{stop.confidenceLabel}</Chip>}
                    {stop.tradeoffLabel && <Chip>{stop.tradeoffLabel}</Chip>}
                  </div>

                  <Link
                    href={stop.venueHref}
                    onClick={() => {
                      void logEvent('event_journey_stop_clicked', {
                        venue_id: stop.id,
                        metadata: {
                          journey_id: journey.id,
                          journey_title: journey.title,
                          event_name: journey.eventName,
                          destination_name: journey.destinationName,
                          stop_id: stop.id,
                          stop_order: stop.order,
                          stop_name: stop.venueName,
                          stop_role: stop.roleLabel,
                          is_curated: stop.isCurated,
                          venue_href: stop.venueHref,
                        },
                      })
                    }}
                    className="font-medium hover:underline"
                  >
                    {stop.venueName}
                  </Link>

                  {stop.description && (
                    <StopDescription
                      description={stop.description}
                      journeyId={journey.id}
                      journeyTitle={journey.title}
                      eventName={journey.eventName}
                      destinationName={journey.destinationName}
                      stopId={stop.id}
                      stopOrder={stop.order}
                      stopName={stop.venueName}
                    />
                  )}

                  {stop.selectionReason && (
                    <p className="text-xs text-muted-foreground">{stop.selectionReason}</p>
                  )}
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Final destination:{' '}
              <span className="font-medium text-foreground">
                {journey.destinationName}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Head straight to {journey.destinationName} from the property.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StopDescription({
  description,
  journeyId,
  journeyTitle,
  eventName,
  destinationName,
  stopId,
  stopOrder,
  stopName,
}: {
  description: string
  journeyId: string
  journeyTitle: string
  eventName: string
  destinationName: string
  stopId: string
  stopOrder: number
  stopName: string
}) {
  const [expanded, setExpanded] = useState(false)

  const handleToggle = () => {
    const nextExpanded = !expanded

    void logEvent(
      nextExpanded
        ? 'event_journey_description_expanded'
        : 'event_journey_description_collapsed',
      {
        venue_id: stopId,
        metadata: {
          journey_id: journeyId,
          journey_title: journeyTitle,
          event_name: eventName,
          destination_name: destinationName,
          stop_id: stopId,
          stop_order: stopOrder,
          stop_name: stopName,
          description_length: description.length,
        },
      }
    )

    setExpanded(nextExpanded)
  }

  return (
    <div className="space-y-1">
      <p className={`text-sm text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}>
        {description}
      </p>

      {description.length > 120 && (
        <button
          type="button"
          onClick={handleToggle}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
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