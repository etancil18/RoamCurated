'use client'

import {
  useMemo,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { logEvent } from '@/lib/logEvent'

type TravelMode =
  | 'walking'
  | 'cycling'
  | 'driving'

type FlowRouteVenue = {
  id: string
  name: string
  address?: string | null
  city?: string | null
  lat?: number | null
  lon?: number | null
}

type Props = {
  venues: FlowRouteVenue[]
  travelMode?: TravelMode
  flowId?: string | null
  source?:
    | 'active_flow'
    | 'event_flow'
    | 'hosted_flow'
    | 'guide_flow'
  className?: string
}

function safeLogEvent(
  eventName: string,
  metadata: Record<
    string,
    unknown
  > = {}
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn(
      'logEvent failed:',
      eventName,
      error
    )
  }
}

function hasCoordinates(
  venue: FlowRouteVenue
) {
  return (
    typeof venue.lat ===
      'number' &&
    Number.isFinite(
      venue.lat
    ) &&
    typeof venue.lon ===
      'number' &&
    Number.isFinite(
      venue.lon
    )
  )
}

function getVenueSearchLabel(
  venue: FlowRouteVenue
) {
  const name =
    venue.name?.trim()

  const address =
    venue.address?.trim()

  const city =
    venue.city?.trim()

  if (
    name &&
    address &&
    city
  ) {
    return `${name}, ${address}, ${city}`
  }

  if (
    name &&
    address
  ) {
    return `${name}, ${address}`
  }

  if (
    name &&
    city
  ) {
    return `${name}, ${city}`
  }

  return (
    name ||
    address ||
    city ||
    ''
  )
}

function getVenueRouteValue(
  venue: FlowRouteVenue
) {
  if (
    hasCoordinates(venue)
  ) {
    return `${venue.lat},${venue.lon}`
  }

  return getVenueSearchLabel(
    venue
  )
}

function getVenueDisplayAddress(
  venue: FlowRouteVenue
) {
  const address =
    venue.address?.trim()

  const city =
    venue.city?.trim()

  if (
    address &&
    city
  ) {
    return `${address}, ${city}`
  }

  return (
    address ||
    city ||
    null
  )
}

function getTravelModeLabel(
  travelMode: TravelMode
) {
  if (
    travelMode ===
    'cycling'
  ) {
    return 'Cycling'
  }

  if (
    travelMode ===
    'driving'
  ) {
    return 'Driving'
  }

  return 'Walking'
}

export default function FlowRouteLauncher({
  venues,
  travelMode = 'walking',
  flowId = null,
  source = 'active_flow',
  className = '',
}: Props) {
  const [
    routeChooserOpen,
    setRouteChooserOpen,
  ] = useState(false)

  const routeVenues =
    useMemo(() => {
      return venues.filter(
        (venue) =>
          Boolean(
            getVenueRouteValue(
              venue
            )
          )
      )
    }, [venues])

  const canLaunchRoute =
    routeVenues.length >= 2

  function baseLogMetadata(): Record<
    string,
    unknown
  > {
    return {
      flow_id: flowId,
      source,
      travel_mode:
        travelMode,
      stop_count:
        routeVenues.length,
    }
  }

  /**
   * Opens the destination outside the current Roam browsing context.
   *
   * Standard HTTPS universal links allow supported devices to hand the request
   * to an installed maps app while preserving the current Roam screen.
   */
  function openExternalUrl(
    url: string
  ) {
    const anchor =
      document.createElement(
        'a'
      )

    anchor.href = url
    anchor.target = '_blank'
    anchor.rel =
      'noopener noreferrer'
    anchor.style.display =
      'none'

    document.body.appendChild(
      anchor
    )

    anchor.click()
    anchor.remove()
  }

  function buildGoogleMapsWebUrl() {
    const origin =
      routeVenues[0]

    const destination =
      routeVenues[
        routeVenues.length - 1
      ]

    const waypoints =
      routeVenues
        .slice(1, -1)
        .map(
          getVenueRouteValue
        )
        .filter(Boolean)
        .join('|')

    const url =
      new URL(
        'https://www.google.com/maps/dir/'
      )

    url.searchParams.set(
      'api',
      '1'
    )

    url.searchParams.set(
      'origin',
      getVenueRouteValue(
        origin
      )
    )

    url.searchParams.set(
      'destination',
      getVenueRouteValue(
        destination
      )
    )

    url.searchParams.set(
      'travelmode',
      travelMode ===
        'cycling'
        ? 'bicycling'
        : travelMode
    )

    if (waypoints) {
      url.searchParams.set(
        'waypoints',
        waypoints
      )
    }

    return url.toString()
  }

  function buildAppleMapsUrl() {
    const origin =
      routeVenues[0]

    const destination =
      routeVenues[
        routeVenues.length - 1
      ]

    const waypoints =
      routeVenues.slice(
        1,
        -1
      )

    const url =
      new URL(
        'https://maps.apple.com/directions'
      )

    url.searchParams.set(
      'source',
      getVenueRouteValue(
        origin
      )
    )

    url.searchParams.set(
      'destination',
      getVenueRouteValue(
        destination
      )
    )

    waypoints.forEach(
      (venue) => {
        url.searchParams.append(
          'waypoint',
          getVenueRouteValue(
            venue
          )
        )
      }
    )

    url.searchParams.set(
      'mode',
      travelMode
    )

    return url.toString()
  }

  function openGoogleMaps() {
    if (!canLaunchRoute) {
      return
    }

    safeLogEvent(
      'flow_route_google_maps_clicked',
      baseLogMetadata()
    )

    openExternalUrl(
      buildGoogleMapsWebUrl()
    )
  }

  function openAppleMaps() {
    if (!canLaunchRoute) {
      return
    }

    safeLogEvent(
      'flow_route_apple_maps_clicked',
      {
        ...baseLogMetadata(),
        handoff_stop_count:
          routeVenues.length,
      }
    )

    openExternalUrl(
      buildAppleMapsUrl()
    )
  }

  return (
    <div
      className={[
        'rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                Navigation
              </p>

              <h3 className="mt-1 text-base font-semibold text-white">
                Continue your Flow
                in Maps
              </h3>
            </div>

            {canLaunchRoute ? (
              <div className="shrink-0 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-medium text-neutral-300">
                {
                  routeVenues.length
                }{' '}
                stops
              </div>
            ) : null}
          </div>

          <p className="mt-2 text-sm leading-5 text-neutral-400">
            Open your route in
            your preferred maps
            app. Your Flow stays
            active in Roam.
          </p>
        </div>

        {canLaunchRoute ? (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
            {routeVenues.map(
              (
                venue,
                index
              ) => {
                const displayAddress =
                  getVenueDisplayAddress(
                    venue
                  )

                return (
                  <div
                    key={
                      venue.id
                    }
                    className={[
                      'flex gap-3 px-3 py-3',
                      index > 0
                        ? 'border-t border-neutral-800'
                        : '',
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        ' '
                      )}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-300">
                      {index +
                        1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-100">
                        {
                          venue.name
                        }
                      </p>

                      {displayAddress ? (
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {
                            displayAddress
                          }
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              }
            )}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={
              !canLaunchRoute
            }
            onClick={() => {
              safeLogEvent(
                'flow_start_route_clicked',
                baseLogMetadata()
              )

              setRouteChooserOpen(
                true
              )
            }}
            className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Google/Apple Maps
          </Button>
        </div>
      </div>

      {routeChooserOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:items-center sm:pb-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flow-route-chooser-title"
          onClick={() => {
            safeLogEvent(
              'flow_route_chooser_cancelled',
              {
                ...baseLogMetadata(),
                cancel_source:
                  'backdrop',
              }
            )

            setRouteChooserOpen(
              false
            )
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-950 p-5 text-white shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="mb-5">
              <p
                id="flow-route-chooser-title"
                className="text-lg font-semibold text-white"
              >
                Continue in Maps
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRouteChooserOpen(
                    false
                  )

                  openGoogleMaps()
                }}
                className="h-auto min-h-14 w-full justify-start border-neutral-700 bg-neutral-900 px-4 py-3 text-left text-white hover:bg-neutral-800 hover:text-white"
              >
                <span>
                  <span className="block font-semibold">
                    Google Maps
                  </span>
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRouteChooserOpen(
                    false
                  )

                  openAppleMaps()
                }}
                className="h-auto min-h-14 w-full justify-start border-neutral-700 bg-neutral-900 px-4 py-3 text-left text-white hover:bg-neutral-800 hover:text-white"
              >
                <span>
                  <span className="block font-semibold">
                    Apple Maps
                  </span>
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  safeLogEvent(
                    'flow_route_chooser_cancelled',
                    {
                      ...baseLogMetadata(),
                      cancel_source:
                        'button',
                    }
                  )

                  setRouteChooserOpen(
                    false
                  )
                }}
                className="h-11 w-full text-neutral-300 hover:bg-neutral-900 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}