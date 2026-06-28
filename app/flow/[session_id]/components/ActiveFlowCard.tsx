'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import UberRideButton from '@/components/rideshare/UberRideButton'
import VenueBookingButtons from '@/components/venue-profile/VenueBookingButtons'
import FlowShareActions from './FlowShareActions'
import FlowVenueRatingPrompt from './FlowVenueRatingPrompt'

type ActiveFlowSession = {
  id: string
  user_id: string
  title: string | null
  city: string | null
  source: string | null
  theme_id: string | null
  travel_mode: 'walking' | 'cycling' | 'driving' | null
  venue_ids: string[]
  status: 'active' | 'completed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
}

type Venue = {
  id: string
  name: string
  city?: string | null
  lat?: number | null
  lon?: number | null
  instagram_handle?: string | null
  address?: string | null
  description?: string | null
  contact?: string[] | string | null
  booking_options?: {
    provider: string
    url: string
  }[] | null
}

type ProgressRow = {
  id: string
  session_id: string
  user_id: string
  venue_id: string
  stop_index: number
  checked_in_at: string
}

type GeoLocationPayload = {
  user_lat: number
  user_lon: number
  location_accuracy_meters: number | null
  device_timestamp: string
}

type Props = {
  session: ActiveFlowSession
  venues: Venue[]
  progress: ProgressRow[]
}

function getCurrentLocationForCheckIn(): Promise<GeoLocationPayload> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          user_lat: position.coords.latitude,
          user_lon: position.coords.longitude,
          location_accuracy_meters:
            typeof position.coords.accuracy === 'number'
              ? position.coords.accuracy
              : null,
          device_timestamp: new Date(position.timestamp).toISOString(),
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission is required to check in.'))
          return
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(
            new Error(
              'We could not confirm your location. Try again near the venue entrance.'
            )
          )
          return
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error('Location check timed out. Please try again.'))
          return
        }

        reject(new Error('Could not get your current location.'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  })
}

function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('@')) {
    return `https://instagram.com/${trimmed.slice(1)}`
  }

  if (
    trimmed.includes('instagram.com/') ||
    trimmed.includes('www.instagram.com/')
  ) {
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed.replace(/^\/+/, '')}`
  }

  return null
}

function getVenuePrimaryUrl(venue: Venue): string | null {
  if (venue.instagram_handle?.trim()) {
    return normalizeExternalUrl(
      venue.instagram_handle.startsWith('@')
        ? venue.instagram_handle
        : `@${venue.instagram_handle}`
    )
  }

  const contactValues = Array.isArray(venue.contact)
    ? venue.contact
    : typeof venue.contact === 'string'
      ? [venue.contact]
      : []

  for (const value of contactValues) {
    const url = normalizeExternalUrl(value)
    if (url) return url
  }

  return null
}

export default function ActiveFlowCard({
  session,
  venues,
  progress,
}: Props) {
  const router = useRouter()

  const [checkingInVenueId, setCheckingInVenueId] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [localProgress, setLocalProgress] = useState<ProgressRow[]>(progress)
  const [segmentMinutesByVenueId, setSegmentMinutesByVenueId] = useState<Record<string, number>>({})
  const [expandedDescriptionVenueIds, setExpandedDescriptionVenueIds] =
    useState<Set<string>>(new Set())

  const checkedVenueIds = useMemo(() => {
    return new Set(localProgress.map((row) => row.venue_id))
  }, [localProgress])

  const completedStops = checkedVenueIds.size
  const totalStops = session.venue_ids.length
  const progressPercent =
    totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0

  const flowCompleted = session.status === 'completed'
  const flowCancelled = session.status === 'cancelled'
  const allStopsChecked = totalStops > 0 && completedStops === totalStops

  const orderedVenues = useMemo(() => {
    return session.venue_ids
      .map((venueId) => venues.find((venue) => venue.id === venueId))
      .filter((venue): venue is Venue => Boolean(venue))
  }, [session.venue_ids, venues])

  const currentVenue = orderedVenues.find(
    (venue) => !checkedVenueIds.has(venue.id)
  )

  useEffect(() => {
    async function loadSegmentDurations() {
      if (orderedVenues.length < 2) return

      const nextDurations: Record<string, number> = {}

      for (let i = 1; i < orderedVenues.length; i++) {
        const from = orderedVenues[i - 1]
        const to = orderedVenues[i]

        if (
          typeof from.lat !== 'number' ||
          typeof from.lon !== 'number' ||
          typeof to.lat !== 'number' ||
          typeof to.lon !== 'number'
        ) {
          continue
        }

        try {
          const res = await fetch('/api/mapbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: {
                lat: from.lat,
                lng: from.lon,
              },
              destination: {
                lat: to.lat,
                lng: to.lon,
              },
              waypoints: [],
              travelMode: 'driving',
            }),
          })

          const json = await res.json()

          if (res.ok && typeof json.duration === 'number') {
            nextDurations[to.id] = Math.round(json.duration / 60)
          }
        } catch (err) {
          console.error('[ActiveFlowCard] Failed to load segment duration:', err)
        }
      }

      setSegmentMinutesByVenueId(nextDurations)
    }

    loadSegmentDurations()
  }, [orderedVenues])

  const toggleVenueDescription = (venueId: string) => {
    setExpandedDescriptionVenueIds((prev) => {
      const next = new Set(prev)

      if (next.has(venueId)) {
        next.delete(venueId)
      } else {
        next.add(venueId)
      }

      return next
    })
  }

  const handleCheckIn = async (venueId: string, stopIndex: number) => {
    if (flowCompleted || flowCancelled) return

    setCheckingInVenueId(venueId)

    try {
      const location = await getCurrentLocationForCheckIn()

      const res = await fetch('/api/active-flow/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          venue_id: venueId,
          stop_index: stopIndex,
          user_lat: location.user_lat,
          user_lon: location.user_lon,
          location_accuracy_meters: location.location_accuracy_meters,
          device_timestamp: location.device_timestamp,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        alert(json.error ?? 'Could not check in.')
        return
      }

      setLocalProgress((prev) => {
        const exists = prev.some((row) => row.venue_id === venueId)
        if (exists) return prev

        return [
          ...prev,
          {
            id: json.progress.id,
            session_id: json.progress.session_id,
            user_id: json.progress.user_id,
            venue_id: json.progress.venue_id,
            stop_index: json.progress.stop_index,
            checked_in_at: json.progress.checked_in_at,
          },
        ]
      })

      router.refresh()
    } catch (err) {
      console.error('[ActiveFlowCard] Check-in failed:', err)
      alert(
        err instanceof Error
          ? err.message
          : 'Unexpected error checking in.'
      )
    } finally {
      setCheckingInVenueId(null)
    }
  }

  const handleCompleteFlow = async () => {
    if (!allStopsChecked || flowCompleted || flowCancelled) return

    setCompleting(true)

    try {
      const res = await fetch('/api/active-flow/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        alert(json.error ?? 'Could not complete flow.')
        return
      }

      router.refresh()
    } catch (err) {
      console.error('[ActiveFlowCard] Complete failed:', err)
      alert('Unexpected error completing flow.')
    } finally {
      setCompleting(false)
    }
  }

  const handleCancelFlow = async () => {
    if (flowCompleted || flowCancelled) return

    const confirmed = window.confirm(
      'End this active flow? Your checked-in stops will remain saved, but the flow will no longer be active.'
    )

    if (!confirmed) return

    setCancelling(true)

    try {
      const res = await fetch('/api/active-flow/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        alert(json.error ?? 'Could not cancel flow.')
        return
      }

      router.refresh()
    } catch (err) {
      console.error('[ActiveFlowCard] Cancel failed:', err)
      alert('Unexpected error cancelling flow.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-neutral-800 bg-neutral-950 text-white">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">
                Active Flow
              </p>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {session.title ?? 'Roam Flow'}
              </h1>

              <p className="mt-1 text-sm text-neutral-400">
                {session.city ?? 'City'} • {session.travel_mode ?? 'walking'} •{' '}
                {totalStops} stops
              </p>
            </div>

            <div className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold">
              {session.status}
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-xs text-neutral-500">
              <span>
                {completedStops} / {totalStops} stops
              </span>
              <span>{progressPercent}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {!flowCompleted && !flowCancelled && currentVenue && (
            <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                Current Stop
              </p>

              <p className="mt-1 text-lg font-semibold">
                {currentVenue.name}
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Check in here to continue your flow.
              </p>
            </div>
          )}

          {flowCompleted && (
            <div className="rounded-xl border border-green-500/40 bg-green-950/30 p-4">
              <p className="text-sm font-semibold text-green-300">
                Flow complete. Badge unlocked: Flow Finisher.
              </p>

              <p className="mt-1 text-xs text-green-200/80">
                This completion now contributes to your Roam Passport.
              </p>
            </div>
          )}

          {flowCancelled && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4">
              <p className="text-sm font-semibold text-red-300">
                This flow was cancelled.
              </p>

              <p className="mt-1 text-xs text-red-200/80">
                Your past check-ins remain saved, but this flow is no longer active.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {(flowCompleted || flowCancelled) && completedStops >= 1 && (
        <FlowVenueRatingPrompt
          sessionId={session.id}
          venues={orderedVenues}
          progress={localProgress}
          flowCompleted={flowCompleted}
          flowCancelled={flowCancelled}
        />
      )}

      {(flowCompleted || completedStops >= 3) && (
        <FlowShareActions
          session={session}
          venues={orderedVenues}
          progress={localProgress}
        />
      )}

      <Card className="border-neutral-800 bg-neutral-950 text-white">
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Stops
          </h2>

          {orderedVenues.map((venue, index) => {
            const checked = checkedVenueIds.has(venue.id)
            const isCurrent = currentVenue?.id === venue.id
            const previousVenue = index > 0 ? orderedVenues[index - 1] : null
            const travelMinutes = segmentMinutesByVenueId[venue.id] ?? null
            const showUber =
              index > 0 &&
              typeof travelMinutes === 'number' &&
              travelMinutes > 5
            const venueUrl = getVenuePrimaryUrl(venue)
            const description = venue.description?.trim() ?? ''
            const hasDescription = description.length > 0
            const descriptionExpanded = expandedDescriptionVenueIds.has(venue.id)

            return (
              <div
                key={venue.id}
                className={`rounded-xl border p-4 ${
                  checked
                    ? 'border-green-500/40 bg-green-950/20'
                    : isCurrent
                      ? 'border-indigo-500/50 bg-indigo-950/30'
                      : 'border-neutral-800 bg-black/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500">
                      Stop {index + 1}
                    </p>

                    {venueUrl ? (
                      <a
                        href={venueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
                      >
                        {venue.name}
                      </a>
                    ) : (
                      <p className="mt-1 font-medium">
                        {venue.name}
                      </p>
                    )}

                    {hasDescription && (
                      <div className="mt-2">
                        <p
                          className={`text-xs leading-5 text-neutral-400 ${
                            descriptionExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {description}
                        </p>

                        {description.length > 120 && (
                          <button
                            type="button"
                            onClick={() => toggleVenueDescription(venue.id)}
                            className="mt-1 text-xs font-medium text-cyan-400 hover:text-cyan-300"
                          >
                            {descriptionExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}

                    {venue.city && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {venue.city}
                      </p>
                    )}
                  </div>

                  {checked ? (
                    <div className="shrink-0 rounded-full border border-green-500/40 px-3 py-1 text-xs text-green-300">
                      ✓ Checked in
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={
                        Boolean(checkingInVenueId) ||
                        flowCompleted ||
                        flowCancelled
                      }
                      onClick={() => handleCheckIn(venue.id, index)}
                    >
                      {checkingInVenueId === venue.id
                        ? 'Checking location...'
                        : 'Check In'}
                    </Button>
                  )}
                </div>

                <VenueBookingButtons
                  bookingOptions={venue.booking_options ?? null}
                  compact
                />

                {showUber && (
                  <div className="mt-3 border-t border-neutral-800 pt-3">
                    <UberRideButton
                      pickup={{
                        name: previousVenue?.name ?? null,
                        address:
                          previousVenue?.address ??
                          previousVenue?.city ??
                          null,
                        lat: previousVenue?.lat ?? null,
                        lon: previousVenue?.lon ?? null,
                      }}
                      dropoff={{
                        name: venue.name,
                        address: venue.address ?? venue.city ?? null,
                        lat: venue.lat ?? null,
                        lon: venue.lon ?? null,
                      }}
                      travelMinutes={travelMinutes}
                      fromVenueId={previousVenue?.id ?? null}
                      toVenueId={venue.id}
                      compact
                      className="w-full"
                      metadata={{
                        ride_context: 'active_flow_interstop',
                        active_flow_session_id: session.id,
                        stop_index: index,
                        travel_mode: session.travel_mode,
                        pickup_name: previousVenue?.name ?? null,
                        pickup_address:
                          previousVenue?.address ??
                          previousVenue?.city ??
                          null,
                        dropoff_name: venue.name,
                        dropoff_address: venue.address ?? venue.city ?? null,
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700"
          disabled={!allStopsChecked || flowCompleted || flowCancelled || completing}
          onClick={handleCompleteFlow}
        >
          {completing
            ? 'Completing...'
            : flowCompleted
              ? 'Flow Completed'
              : 'Complete Flow'}
        </Button>

        <Button
          variant="outline"
          className="flex-1 border-neutral-700 text-neutral-200"
          disabled={flowCompleted || flowCancelled || cancelling}
          onClick={handleCancelFlow}
        >
          {cancelling
            ? 'Ending...'
            : flowCancelled
              ? 'Flow Ended'
              : 'End Flow'}
        </Button>
      </div>
    </div>
  )
}