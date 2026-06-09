'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { logEvent } from '@/lib/logEvent'

type TravelMode = 'walking' | 'cycling' | 'driving'

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
  source?: 'active_flow' | 'event_flow' | 'hosted_flow' | 'guide_flow'
  className?: string
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function FlowRouteLauncher({
  venues,
  travelMode = 'walking',
  flowId = null,
  source = 'active_flow',
  className = '',
}: Props) {
  const [routeChooserOpen, setRouteChooserOpen] = useState(false)

  const routeVenues = useMemo(() => {
    return venues.filter(
      (venue) =>
        typeof venue.lat === 'number' &&
        Number.isFinite(venue.lat) &&
        typeof venue.lon === 'number' &&
        Number.isFinite(venue.lon)
    )
  }, [venues])

  const canLaunchRoute = routeVenues.length >= 2

  function baseLogMetadata(): Record<string, unknown> {
    return {
      flow_id: flowId,
      source,
      travel_mode: travelMode,
      stop_count: routeVenues.length,
    }
  }

  function openExternalUrl(url: string) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')

    if (!opened) {
      window.location.href = url
    }
  }

  function openGoogleMaps() {
    if (!canLaunchRoute) return

    safeLogEvent('flow_route_google_maps_clicked', baseLogMetadata())

    const origin = routeVenues[0]
    const destination = routeVenues[routeVenues.length - 1]
    const waypoints = routeVenues
      .slice(1, -1)
      .map((venue) => `${venue.lat},${venue.lon}`)
      .join('|')

    const url = new URL('https://www.google.com/maps/dir/')
    url.searchParams.set('api', '1')
    url.searchParams.set('origin', `${origin.lat},${origin.lon}`)
    url.searchParams.set('destination', `${destination.lat},${destination.lon}`)
    url.searchParams.set(
      'travelmode',
      travelMode === 'cycling' ? 'bicycling' : travelMode
    )

    if (waypoints) {
      url.searchParams.set('waypoints', waypoints)
    }

    openExternalUrl(url.toString())
  }

  function openAppleMaps() {
    if (!canLaunchRoute) return

    safeLogEvent('flow_route_apple_maps_clicked', baseLogMetadata())

    const origin = routeVenues[0]
    const destination = routeVenues[routeVenues.length - 1]
    const dirFlag =
      travelMode === 'driving' ? 'd' : travelMode === 'walking' ? 'w' : 'r'

    const url =
      `https://maps.apple.com/?saddr=${origin.lat},${origin.lon}` +
      `&daddr=${destination.lat},${destination.lon}` +
      `&dirflg=${dirFlag}`

    openExternalUrl(url)
  }

  return (
    <div
      className={[
        'rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
            Route Actions
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Open this flow in your preferred maps app.
          </p>
        </div>

        <Button
          type="button"
          disabled={!canLaunchRoute}
          onClick={() => {
            safeLogEvent('flow_start_route_clicked', baseLogMetadata())
            setRouteChooserOpen(true)
          }}
          className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Google/Apple Maps
        </Button>
      </div>

      {!canLaunchRoute ? (
        <p className="mt-3 text-xs text-neutral-500">
          Add at least two stops with coordinates to launch a route.
        </p>
      ) : null}

      {routeChooserOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:items-center sm:pb-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            safeLogEvent('flow_route_chooser_cancelled', {
              ...baseLogMetadata(),
              cancel_source: 'backdrop',
            })
            setRouteChooserOpen(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-950 p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <p className="text-lg font-semibold text-white">Start route</p>
              <p className="mt-1 text-sm leading-5 text-neutral-300">
                Choose your preferred maps app.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRouteChooserOpen(false)
                  openGoogleMaps()
                }}
                className="h-12 w-full justify-start border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
              >
                Open in Google Maps
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setRouteChooserOpen(false)
                  openAppleMaps()
                }}
                className="h-12 w-full justify-start border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
              >
                Open in Apple Maps
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  safeLogEvent('flow_route_chooser_cancelled', {
                    ...baseLogMetadata(),
                    cancel_source: 'button',
                  })
                  setRouteChooserOpen(false)
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