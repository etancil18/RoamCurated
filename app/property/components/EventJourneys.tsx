'use client'

import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { DateTime } from 'luxon'

type EventJourneyStop = {
  stopOrder: number
  role: string
  matchedType: string | null
  locked: boolean
  distanceFromPreviousMeters: number
  distanceToDestinationMeters: number
  venue: {
    id: string
    name: string
    city?: string | null
    description?: string | null
  }
}

type EventJourneyResult = {
  strategy: '3-stop' | '2-stop' | '1-stop' | 'direct'
  hoursUntilEvent: number
  stopBudget: number
  stops: EventJourneyStop[]
  destination: {
    name: string
    lat: number
    lon: number
    venueId?: string | null
  }
}

type EventJourneyCard = {
  id: string
  title: string
  eventName: string
  eventStartAt: string
  destinationName: string
  status?: string | null
  result: EventJourneyResult
  href?: string
}

type Props = {
  journeys: EventJourneyCard[]
}

/* ------------------------------------------------ */
/* Helpers                                          */
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

function formatStageLabel(label?: string | null) {
  if (!label) return null

  return label
    .replace('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatEventTime(iso: string) {
  const dt = DateTime.fromISO(iso)
  if (!dt.isValid) return 'Date TBD'
  return dt.toFormat('M/d • h:mm a')
}

function formatHoursUntilEvent(hours: number) {
  if (!Number.isFinite(hours)) return 'Upcoming'

  if (hours <= 0) return 'Starting now'

  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}m to go`
  }

  const rounded = Math.round(hours * 10) / 10

  if (Number.isInteger(rounded)) {
    return `${rounded}h to go`
  }

  return `${rounded}h to go`
}

function getStrategyCopy(strategy: EventJourneyResult['strategy']) {
  const labels: Record<EventJourneyResult['strategy'], string> = {
    '3-stop': '3-stop route',
    '2-stop': '2-stop route',
    '1-stop': '1-stop route',
    direct: 'Direct route',
  }

  return labels[strategy]
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function EventJourneys({ journeys }: Props) {
  const safeJourneys = (journeys ?? [])
    .filter(
      (journey): journey is EventJourneyCard =>
        Boolean(
          journey &&
          journey.id &&
          journey.title &&
          journey.eventName &&
          journey.eventStartAt &&
          journey.destinationName &&
          journey.result
        )
    )
    .map((journey) => ({
      ...journey,
      result: {
        ...journey.result,
        stops: (journey.result.stops ?? []).map((stop) => ({
          ...stop,
          venue: {
            ...stop.venue,
            city: stop.venue.city
              ? normalizeCityKey(stop.venue.city)
              : stop.venue.city,
          },
        })),
      },
    }))
    .sort((a, b) => {
      const aTime = DateTime.fromISO(a.eventStartAt).toMillis()
      const bTime = DateTime.fromISO(b.eventStartAt).toMillis()
      return aTime - bTime
    })

  if (safeJourneys.length === 0) return null

  return (
    <section className="space-y-4">

      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Heading to a Big Event?
        </h2>

        <p className="text-sm text-muted-foreground">
          Timed routes that move you from the property toward a major nearby destination.
        </p>
      </div>

      <div className="grid gap-4">
        {safeJourneys.map((journey) => (
          <Card key={journey.id}>
            <CardContent className="p-5 space-y-4">

              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">
                    {journey.title}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {journey.eventName} • {formatEventTime(journey.eventStartAt)}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Destination • {journey.destinationName}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                    {getStrategyCopy(journey.result.strategy)}
                  </span>

                  <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                    {formatHoursUntilEvent(journey.result.hoursUntilEvent)}
                  </span>

                  {journey.status && (
                    <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                      {journey.status}
                    </span>
                  )}
                </div>
              </div>

              {journey.result.stops.length > 0 ? (
                <div className="space-y-2">
                  {journey.result.stops.map((stop) => {
                    const stageLabel = formatStageLabel(stop.matchedType)
                    const briefDescription =
                      typeof stop.venue.description === 'string' &&
                      stop.venue.description.trim().length > 0
                        ? stop.venue.description.trim()
                        : null

                    return (
                      <div
                        key={`${journey.id}-${stop.stopOrder}-${stop.venue.id}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-0.5 w-5 text-xs font-semibold text-muted-foreground">
                          {stop.stopOrder}.
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {stageLabel && (
                              <span className="text-xs text-muted-foreground">
                                {stageLabel} —
                              </span>
                            )}

                            <Link
                              href={`/venue-profile/${stop.venue.id}`}
                              className="font-medium hover:underline"
                            >
                              {stop.venue.name}
                            </Link>

                            {stop.locked && (
                              <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                                Preset
                              </span>
                            )}
                          </div>

                          {briefDescription && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {briefDescription}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground">
                            {Math.round(stop.distanceFromPreviousMeters)}m from previous stop
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex items-start gap-2 text-sm pt-1">
                    <span className="mt-0.5 w-5 text-xs font-semibold text-muted-foreground">
                      →
                    </span>

                    <div className="min-w-0">
                      <p className="font-medium">
                        {journey.destinationName}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Final destination
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Go direct to the destination from the property.
                </div>
              )}

              <div className="pt-1">
                {journey.href ? (
                  <Link
                    href={journey.href}
                    className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
                  >
                    Start Event Route
                  </Link>
                ) : (
                  <div className="inline-flex items-center rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Route available day of event
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        ))}
      </div>

    </section>
  )
}