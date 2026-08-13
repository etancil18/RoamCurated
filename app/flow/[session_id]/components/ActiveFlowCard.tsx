'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import UberRideButton from '@/components/rideshare/UberRideButton'
import VenueBookingButtons from '@/components/venue-profile/VenueBookingButtons'
import FlowShareActions from './FlowShareActions'
import FlowVenueRatingPrompt from './FlowVenueRatingPrompt'
import { logEvent } from '@/lib/logEvent'

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

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
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

function getCurrentLocationForCheckIn(): Promise<GeoLocationPayload> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.geolocation
      ) {
        reject(
          new Error(
            'Location is not available on this device.'
          )
        )

        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            user_lat:
              position.coords.latitude,

            user_lon:
              position.coords.longitude,

            location_accuracy_meters:
              typeof position.coords.accuracy ===
              'number'
                ? position.coords.accuracy
                : null,

            device_timestamp:
              new Date(
                position.timestamp
              ).toISOString(),
          })
        },
        (error) => {
          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            reject(
              new Error(
                'Location permission is required to check in.'
              )
            )

            return
          }

          if (
            error.code ===
            error.POSITION_UNAVAILABLE
          ) {
            reject(
              new Error(
                'We could not confirm your location. Try again near the venue entrance.'
              )
            )

            return
          }

          if (
            error.code ===
            error.TIMEOUT
          ) {
            reject(
              new Error(
                'Location check timed out. Please try again.'
              )
            )

            return
          }

          reject(
            new Error(
              'Could not get your current location.'
            )
          )
        },
        {
          enableHighAccuracy:
            true,
          timeout:
            15000,
          maximumAge:
            0,
        }
      )
    }
  )
}

function normalizeExternalUrl(
  value: string
): string | null {
  const trimmed =
    value.trim()

  if (!trimmed) {
    return null
  }

  if (
    trimmed.startsWith('@')
  ) {
    return `https://instagram.com/${trimmed.slice(
      1
    )}`
  }

  if (
    trimmed.includes(
      'instagram.com/'
    ) ||
    trimmed.includes(
      'www.instagram.com/'
    )
  ) {
    return trimmed.startsWith(
      'http'
    )
      ? trimmed
      : `https://${trimmed}`
  }

  if (
    trimmed.startsWith(
      'http://'
    ) ||
    trimmed.startsWith(
      'https://'
    )
  ) {
    return trimmed
  }

  if (
    trimmed.includes('.') &&
    !trimmed.includes(' ')
  ) {
    return `https://${trimmed.replace(
      /^\/+/,
      ''
    )}`
  }

  return null
}

function getVenuePrimaryUrl(
  venue: Venue
): string | null {
  if (
    venue.instagram_handle?.trim()
  ) {
    return normalizeExternalUrl(
      venue.instagram_handle.startsWith(
        '@'
      )
        ? venue.instagram_handle
        : `@${venue.instagram_handle}`
    )
  }

  const contactValues =
    Array.isArray(
      venue.contact
    )
      ? venue.contact
      : typeof venue.contact ===
          'string'
        ? [
            venue.contact,
          ]
        : []

  for (
    const value of
      contactValues
  ) {
    const url =
      normalizeExternalUrl(
        value
      )

    if (url) {
      return url
    }
  }

  return null
}

export default function ActiveFlowCard({
  session,
  venues,
  progress,
}: Props) {
  const router =
    useRouter()

  const [
    checkingInVenueId,
    setCheckingInVenueId,
  ] =
    useState<
      string | null
    >(null)

  const [
    completing,
    setCompleting,
  ] =
    useState(false)

  const [
    cancelling,
    setCancelling,
  ] =
    useState(false)

  const [
    localProgress,
    setLocalProgress,
  ] =
    useState<
      ProgressRow[]
    >(progress)

  const [
    segmentMinutesByVenueId,
    setSegmentMinutesByVenueId,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({})

  const [
    expandedDescriptionVenueIds,
    setExpandedDescriptionVenueIds,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    )

  const checkedVenueIds =
    useMemo(
      () => {
        return new Set(
          localProgress.map(
            (
              row
            ) =>
              row.venue_id
          )
        )
      },
      [
        localProgress,
      ]
    )

  const completedStops =
    checkedVenueIds.size

  const totalStops =
    session.venue_ids.length

  const progressPercent =
    totalStops > 0
      ? Math.round(
          (
            completedStops /
            totalStops
          ) *
            100
        )
      : 0

  const flowCompleted =
    session.status ===
    'completed'

  const flowCancelled =
    session.status ===
    'cancelled'

  const allStopsChecked =
    totalStops > 0 &&
    completedStops ===
      totalStops

  const orderedVenues =
    useMemo(
      () => {
        return session
          .venue_ids
          .map(
            (
              venueId
            ) =>
              venues.find(
                (
                  venue
                ) =>
                  venue.id ===
                  venueId
              )
          )
          .filter(
            (
              venue
            ): venue is Venue =>
              Boolean(
                venue
              )
          )
      },
      [
        session.venue_ids,
        venues,
      ]
    )

  const currentVenue =
    orderedVenues.find(
      (
        venue
      ) =>
        !checkedVenueIds.has(
          venue.id
        )
    )

  useEffect(() => {
    safeLogEvent(
      'active_flow_card_viewed',
      {
        session_id:
          session.id,

        city:
          session.city,

        source:
          session.source,

        status:
          session.status,

        travel_mode:
          session.travel_mode,

        stop_count:
          session.venue_ids
            .length,

        completed_stop_count:
          progress.length,
      }
    )
  }, [])

  useEffect(() => {
    async function loadSegmentDurations() {
      if (
        orderedVenues.length <
        2
      ) {
        return
      }

      const nextDurations:
        Record<
          string,
          number
        > = {}

      for (
        let i =
          1;
        i <
        orderedVenues.length;
        i++
      ) {
        const from =
          orderedVenues[
            i - 1
          ]

        const to =
          orderedVenues[i]

        if (
          typeof from.lat !==
            'number' ||
          typeof from.lon !==
            'number' ||
          typeof to.lat !==
            'number' ||
          typeof to.lon !==
            'number'
        ) {
          continue
        }

        try {
          const res =
            await fetch(
              '/api/mapbox',
              {
                method:
                  'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body:
                  JSON.stringify(
                    {
                      origin:
                        {
                          lat:
                            from.lat,

                          lng:
                            from.lon,
                        },

                      destination:
                        {
                          lat:
                            to.lat,

                          lng:
                            to.lon,
                        },

                      waypoints:
                        [],

                      travelMode:
                        'driving',
                    }
                  ),
              }
            )

          const json =
            await res.json()

          if (
            res.ok &&
            typeof json.duration ===
              'number'
          ) {
            nextDurations[
              to.id
            ] =
              Math.round(
                json.duration /
                  60
              )
          }
        } catch (err) {
          console.error(
            '[ActiveFlowCard] Failed to load segment duration:',
            err
          )
        }
      }

      setSegmentMinutesByVenueId(
        nextDurations
      )
    }

    loadSegmentDurations()
  }, [
    orderedVenues,
  ])

  const toggleVenueDescription =
    (
      venueId: string
    ) => {
      safeLogEvent(
        'active_flow_venue_description_toggled',
        {
          session_id:
            session.id,

          venue_id:
            venueId,

          city:
            session.city,
        }
      )

      setExpandedDescriptionVenueIds(
        (
          prev
        ) => {
          const next =
            new Set(
              prev
            )

          if (
            next.has(
              venueId
            )
          ) {
            next.delete(
              venueId
            )
          } else {
            next.add(
              venueId
            )
          }

          return next
        }
      )
    }

  const handleCheckIn =
    async (
      venueId: string,
      stopIndex: number
    ) => {
      if (
        flowCompleted ||
        flowCancelled
      ) {
        return
      }

      safeLogEvent(
        'active_flow_check_in_clicked',
        {
          session_id:
            session.id,

          venue_id:
            venueId,

          stop_index:
            stopIndex,

          city:
            session.city,
        }
      )

      setCheckingInVenueId(
        venueId
      )

      try {
        const location =
          await getCurrentLocationForCheckIn()

        const res =
          await fetch(
            '/api/active-flow/check-in',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  session_id:
                    session.id,

                  venue_id:
                    venueId,

                  stop_index:
                    stopIndex,

                  user_lat:
                    location.user_lat,

                  user_lon:
                    location.user_lon,

                  location_accuracy_meters:
                    location.location_accuracy_meters,

                  device_timestamp:
                    location.device_timestamp,
                }),
            }
          )

        const json =
          await res.json()

        if (!res.ok) {
          safeLogEvent(
            'active_flow_check_in_failed',
            {
              session_id:
                session.id,

              venue_id:
                venueId,

              stop_index:
                stopIndex,

              city:
                session.city,

              status:
                res.status,

              error:
                json.error ??
                null,
            }
          )

          alert(
            json.error ??
              'Could not check in.'
          )

          return
        }

        setLocalProgress(
          (
            prev
          ) => {
            const exists =
              prev.some(
                (
                  row
                ) =>
                  row.venue_id ===
                  venueId
              )

            if (
              exists
            ) {
              return prev
            }

            return [
              ...prev,
              {
                id:
                  json.progress.id,

                session_id:
                  json.progress
                    .session_id,

                user_id:
                  json.progress
                    .user_id,

                venue_id:
                  json.progress
                    .venue_id,

                stop_index:
                  json.progress
                    .stop_index,

                checked_in_at:
                  json.progress
                    .checked_in_at,
              },
            ]
          }
        )

        safeLogEvent(
          'active_flow_check_in_completed',
          {
            session_id:
              session.id,

            venue_id:
              venueId,

            stop_index:
              stopIndex,

            city:
              session.city,
          }
        )

        router.refresh()
      } catch (err) {
        safeLogEvent(
          'active_flow_check_in_error',
          {
            session_id:
              session.id,

            venue_id:
              venueId,

            stop_index:
              stopIndex,

            city:
              session.city,

            message:
              err instanceof
              Error
                ? err.message
                : 'Unexpected error',
          }
        )

        console.error(
          '[ActiveFlowCard] Check-in failed:',
          err
        )

        alert(
          err instanceof
          Error
            ? err.message
            : 'Unexpected error checking in.'
        )
      } finally {
        setCheckingInVenueId(
          null
        )
      }
    }

  const handleCompleteFlow =
    async () => {
      if (
        !allStopsChecked ||
        flowCompleted ||
        flowCancelled
      ) {
        return
      }

      safeLogEvent(
        'active_flow_complete_clicked',
        {
          session_id:
            session.id,

          city:
            session.city,

          completed_stop_count:
            completedStops,

          total_stop_count:
            totalStops,
        }
      )

      setCompleting(
        true
      )

      try {
        const res =
          await fetch(
            '/api/active-flow/complete',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  session_id:
                    session.id,
                }),
            }
          )

        const json =
          await res.json()

        if (!res.ok) {
          alert(
            json.error ??
              'Could not complete flow.'
          )

          return
        }

        safeLogEvent(
          'active_flow_completed',
          {
            session_id:
              session.id,

            city:
              session.city,

            completed_stop_count:
              completedStops,

            total_stop_count:
              totalStops,
          }
        )

        router.refresh()
      } catch (err) {
        console.error(
          '[ActiveFlowCard] Complete failed:',
          err
        )

        alert(
          'Unexpected error completing flow.'
        )
      } finally {
        setCompleting(
          false
        )
      }
    }

  const handleCancelFlow =
    async () => {
      if (
        flowCompleted ||
        flowCancelled
      ) {
        return
      }

      safeLogEvent(
        'active_flow_cancel_clicked',
        {
          session_id:
            session.id,

          city:
            session.city,

          completed_stop_count:
            completedStops,

          total_stop_count:
            totalStops,
        }
      )

      const confirmed =
        window.confirm(
          'End this active flow? Your checked-in stops will remain saved, but the flow will no longer be active.'
        )

      if (!confirmed) {
        safeLogEvent(
          'active_flow_cancel_aborted',
          {
            session_id:
              session.id,

            city:
              session.city,
          }
        )

        return
      }

      setCancelling(
        true
      )

      try {
        const res =
          await fetch(
            '/api/active-flow/cancel',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  session_id:
                    session.id,
                }),
            }
          )

        const json =
          await res.json()

        if (!res.ok) {
          alert(
            json.error ??
              'Could not cancel flow.'
          )

          return
        }

        safeLogEvent(
          'active_flow_cancelled',
          {
            session_id:
              session.id,

            city:
              session.city,

            completed_stop_count:
              completedStops,

            total_stop_count:
              totalStops,
          }
        )

        router.refresh()
      } catch (err) {
        console.error(
          '[ActiveFlowCard] Cancel failed:',
          err
        )

        alert(
          'Unexpected error cancelling flow.'
        )
      } finally {
        setCancelling(
          false
        )
      }
    }

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-indigo-400/[0.035] text-white shadow-[0_28px_90px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.07]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/25 to-transparent" />

          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-400/[0.06] blur-[100px]" />

          <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-cyan-300/[0.04] blur-[100px]" />
        </div>

        <CardContent className="relative z-10 space-y-6 p-5 sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-indigo-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">
                  Your active Roam
                </p>
              </div>

              <h2 className="mt-3 break-words text-2xl font-black tracking-[-0.04em] text-white sm:text-[1.8rem]">
                {session.title ??
                  'Roam Flow'}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-zinc-500">
                <span>
                  {session.city ??
                    'City'}
                </span>

                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-zinc-700"
                />

                <span className="capitalize">
                  {session.travel_mode ??
                    'walking'}
                </span>

                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-zinc-700"
                />

                <span>
                  {totalStops}{' '}
                  {totalStops ===
                  1
                    ? 'stop'
                    : 'stops'}
                </span>
              </div>
            </div>

            
          </div>

          <div>
            <div className="mb-2.5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                  Tonight&apos;s progress
                </p>

                <p className="mt-1 text-sm font-bold text-zinc-300">
                  {completedStops}{' '}
                  of{' '}
                  {totalStops}{' '}
                  stops
                </p>
              </div>

              <p className="text-2xl font-black leading-none tracking-[-0.04em] text-white">
                {progressPercent}
                <span className="ml-0.5 text-sm text-zinc-600">
                  %
                </span>
              </p>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-300 shadow-[0_0_16px_rgba(129,140,248,0.28)] transition-all duration-500"
                style={{
                  width:
                    `${progressPercent}%`,
                }}
              />
            </div>
          </div>

          {!flowCompleted &&
          !flowCancelled &&
          currentVenue ? (
            <div className="relative overflow-hidden rounded-[1.6rem] bg-indigo-300/[0.07] p-4 ring-1 ring-indigo-300/15 sm:p-5">
              <div
                aria-hidden="true"
                className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-indigo-300/[0.08] blur-[70px]"
              />

              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-300/[0.12] text-[10px] font-black text-indigo-200 ring-1 ring-indigo-300/15">
                    {completedStops +
                      1}
                  </span>

                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-indigo-300">
                    Up next
                  </p>
                </div>

                <p className="mt-3 break-words text-xl font-black tracking-[-0.025em] text-white">
                  {
                    currentVenue.name
                  }
                </p>

                <p className="mt-1.5 text-xs leading-5 text-indigo-100/55">
                  You&apos;re here next. Check in when you arrive to keep the night moving.
                </p>
              </div>
            </div>
          ) : null}

          {flowCompleted ? (
            <div className="rounded-[1.6rem] bg-emerald-300/[0.07] p-4 ring-1 ring-emerald-300/15 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-300/[0.1] text-sm font-black text-emerald-200 ring-1 ring-emerald-300/15">
                  ✓
                </span>

                <div>
                  <p className="text-base font-black tracking-tight text-emerald-100">
                    You finished the Roam.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-emerald-200/55">
                    Flow Finisher unlocked. This night now contributes to your Roam Passport.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {flowCancelled ? (
            <div className="rounded-[1.6rem] bg-red-400/[0.06] p-4 ring-1 ring-red-400/15 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-400/[0.08] text-sm font-black text-red-300 ring-1 ring-red-400/15">
                  ×
                </span>

                <div>
                  <p className="text-base font-black tracking-tight text-red-200">
                    This Roam has ended.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-200/55">
                    Your completed check-ins are still saved to your history.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(flowCompleted ||
        flowCancelled) &&
      completedStops >=
        1 ? (
        <FlowVenueRatingPrompt
          sessionId={
            session.id
          }
          venues={
            orderedVenues
          }
          progress={
            localProgress
          }
          flowCompleted={
            flowCompleted
          }
          flowCancelled={
            flowCancelled
          }
        />
      ) : null}

      {(flowCompleted ||
        completedStops >=
          3) ? (
        <FlowShareActions
          session={
            session
          }
          venues={
            orderedVenues
          }
          progress={
            localProgress
          }
        />
      ) : null}

      <Card className="overflow-hidden border-0 bg-transparent text-white shadow-none">
        <CardContent className="p-0">
          <div className="mb-4 flex min-w-0 items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-white/15" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  The route
                </p>
              </div>

              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-white">
                Your stops
              </h2>
            </div>

            <p className="shrink-0 text-[10px] font-bold text-zinc-700">
              {completedStops}
              {' / '}
              {totalStops}
            </p>
          </div>

          <div className="space-y-3">
            {orderedVenues.map(
              (
                venue,
                index
              ) => {
                const checked =
                  checkedVenueIds.has(
                    venue.id
                  )

                const isCurrent =
                  currentVenue?.id ===
                  venue.id

                const previousVenue =
                  index > 0
                    ? orderedVenues[
                        index - 1
                      ]
                    : null

                const travelMinutes =
                  segmentMinutesByVenueId[
                    venue.id
                  ] ??
                  null

                const showUber =
                  index >
                    0 &&
                  typeof travelMinutes ===
                    'number' &&
                  travelMinutes >
                    5

                const venueUrl =
                  getVenuePrimaryUrl(
                    venue
                  )

                const description =
                  venue.description?.trim() ??
                  ''

                const hasDescription =
                  description.length >
                  0

                const descriptionExpanded =
                  expandedDescriptionVenueIds.has(
                    venue.id
                  )

                return (
                  <div
                    key={
                      venue.id
                    }
                    className={[
                      'relative overflow-hidden rounded-[1.6rem] p-4 transition-all duration-200 ring-1 sm:p-5',
                      checked
                        ? 'bg-emerald-300/[0.035] ring-emerald-300/10'
                        : isCurrent
                          ? 'bg-indigo-300/[0.055] ring-indigo-300/15 shadow-[0_16px_50px_rgba(79,70,229,0.08)]'
                          : 'bg-white/[0.025] ring-white/[0.055]',
                    ].join(
                      ' '
                    )}
                  >
                    {isCurrent &&
                    !checked ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-14 -top-20 h-40 w-40 rounded-full bg-indigo-300/[0.06] blur-[80px]"
                      />
                    ) : null}

                    <div className="relative z-10">
                      <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className={[
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ring-1',
                              checked
                                ? 'bg-emerald-300/[0.08] text-emerald-200 ring-emerald-300/15'
                                : isCurrent
                                  ? 'bg-indigo-300/[0.1] text-indigo-200 ring-indigo-300/20'
                                  : 'bg-white/[0.035] text-zinc-500 ring-white/[0.055]',
                            ].join(
                              ' '
                            )}
                          >
                            {checked
                              ? '✓'
                              : index +
                                1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p
                                className={[
                                  'text-[9px] font-black uppercase tracking-[0.15em]',
                                  checked
                                    ? 'text-emerald-300/70'
                                    : isCurrent
                                      ? 'text-indigo-300'
                                      : 'text-zinc-700',
                                ].join(
                                  ' '
                                )}
                              >
                                {checked
                                  ? 'Visited'
                                  : isCurrent
                                    ? 'Up next'
                                    : `Stop ${index + 1}`}
                              </p>
                            </div>

                            {venueUrl ? (
                              <a
                                href={
                                  venueUrl
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() =>
                                  safeLogEvent(
                                    'active_flow_venue_link_clicked',
                                    {
                                      session_id:
                                        session.id,

                                      venue_id:
                                        venue.id,

                                      venue_name:
                                        venue.name,

                                      stop_index:
                                        index,

                                      city:
                                        session.city,
                                    }
                                  )
                                }
                                className="mt-1.5 block break-words text-base font-black tracking-[-0.02em] text-white transition hover:text-cyan-200"
                              >
                                {
                                  venue.name
                                }

                                <span
                                  aria-hidden="true"
                                  className="ml-1.5 text-xs font-medium text-zinc-600"
                                >
                                  ↗
                                </span>
                              </a>
                            ) : (
                              <p className="mt-1.5 break-words text-base font-black tracking-[-0.02em] text-white">
                                {
                                  venue.name
                                }
                              </p>
                            )}

                            {venue.city ? (
                              <p className="mt-1 text-[11px] font-medium text-zinc-600">
                                {
                                  venue.city
                                }
                              </p>
                            ) : null}

                            {hasDescription ? (
                              <div className="mt-3">
                                <p
                                  className={[
                                    'text-xs leading-5 text-zinc-500',
                                    descriptionExpanded
                                      ? ''
                                      : 'line-clamp-2',
                                  ].join(
                                    ' '
                                  )}
                                >
                                  {
                                    description
                                  }
                                </p>

                                {description.length >
                                120 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleVenueDescription(
                                        venue.id
                                      )
                                    }
                                    className="mt-1.5 text-[11px] font-bold text-cyan-300 transition hover:text-cyan-200"
                                  >
                                    {descriptionExpanded
                                      ? 'Show less'
                                      : 'Read more'}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {checked ? (
                          <div className="hidden shrink-0 rounded-full bg-emerald-300/[0.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-emerald-200 ring-1 ring-emerald-300/15 sm:inline-flex">
                            Checked in
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            disabled={
                              Boolean(
                                checkingInVenueId
                              ) ||
                              flowCompleted ||
                              flowCancelled
                            }
                            onClick={() =>
                              handleCheckIn(
                                venue.id,
                                index
                              )
                            }
                            className={[
                              'shrink-0 rounded-full border-0 px-4 font-black shadow-none',
                              isCurrent
                                ? 'bg-white text-black hover:bg-zinc-200'
                                : 'bg-white/[0.07] text-white ring-1 ring-white/[0.08] hover:bg-white/[0.11]',
                            ].join(
                              ' '
                            )}
                          >
                            {checkingInVenueId ===
                            venue.id
                              ? 'Checking…'
                              : 'Check in'}
                          </Button>
                        )}
                      </div>

                      <div className="mt-4">
                        <VenueBookingButtons
                          bookingOptions={
                            venue.booking_options ??
                            null
                          }
                          compact
                        />
                      </div>

                      {showUber ? (
                        <div className="mt-4 border-t border-white/[0.055] pt-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-700">
                              Getting here
                            </p>

                            <p className="text-[10px] font-bold text-zinc-600">
                              ~
                              {
                                travelMinutes
                              }{' '}
                              min drive
                            </p>
                          </div>

                          <UberRideButton
                            pickup={{
                              name:
                                previousVenue?.name ??
                                null,

                              address:
                                previousVenue?.address ??
                                previousVenue?.city ??
                                null,

                              lat:
                                previousVenue?.lat ??
                                null,

                              lon:
                                previousVenue?.lon ??
                                null,
                            }}
                            dropoff={{
                              name:
                                venue.name,

                              address:
                                venue.address ??
                                venue.city ??
                                null,

                              lat:
                                venue.lat ??
                                null,

                              lon:
                                venue.lon ??
                                null,
                            }}
                            travelMinutes={
                              travelMinutes
                            }
                            fromVenueId={
                              previousVenue?.id ??
                              null
                            }
                            toVenueId={
                              venue.id
                            }
                            compact
                            className="w-full"
                            metadata={{
                              ride_context:
                                'active_flow_interstop',

                              active_flow_session_id:
                                session.id,

                              stop_index:
                                index,

                              travel_mode:
                                session.travel_mode,

                              pickup_name:
                                previousVenue?.name ??
                                null,

                              pickup_address:
                                previousVenue?.address ??
                                previousVenue?.city ??
                                null,

                              dropoff_name:
                                venue.name,

                              dropoff_address:
                                venue.address ??
                                venue.city ??
                                null,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2.5 border-t border-white/[0.055] pt-5 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
        <Button
          className="min-h-12 w-full flex-1 rounded-full bg-white font-black text-black shadow-none transition hover:bg-zinc-200 disabled:bg-white/[0.06] disabled:text-zinc-700"
          disabled={
            !allStopsChecked ||
            flowCompleted ||
            flowCancelled ||
            completing
          }
          onClick={
            handleCompleteFlow
          }
        >
          {completing
            ? 'Completing…'
            : flowCompleted
              ? 'Roam completed'
              : 'Finish this Roam'}
        </Button>

        <Button
          variant="outline"
          className="min-h-12 w-full flex-1 rounded-full border-white/[0.08] bg-transparent font-bold text-zinc-500 shadow-none transition hover:border-white/[0.12] hover:bg-white/[0.035] hover:text-zinc-300"
          disabled={
            flowCompleted ||
            flowCancelled ||
            cancelling
          }
          onClick={
            handleCancelFlow
          }
        >
          {cancelling
            ? 'Ending…'
            : flowCancelled
              ? 'Roam ended'
              : 'End Roam'}
        </Button>
      </div>
    </div>
  )
}