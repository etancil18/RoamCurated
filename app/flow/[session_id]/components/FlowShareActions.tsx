'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { logEvent } from '@/lib/logEvent'
import FlowShareCard from './FlowShareCard'
import FlowPassportSticker from './FlowPassportSticker'
import FlowRouteSticker from './FlowRouteSticker'
import StickerComposer from '@/components/flows/StickerComposer'

type RouteLinePoint = {
  lat: number
  lon: number
}

type ActiveFlowSession = {
  id: string
  title: string | null
  city: string | null
  status: 'active' | 'completed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
  travel_mode: 'walking' | 'cycling' | 'driving' | null
  venue_ids: string[]
}

type Venue = {
  id: string
  name: string
  city?: string | null
  lat?: number | null
  lon?: number | null
}

type ProgressRow = {
  venue_id: string
  stop_index: number
  checked_in_at: string
}

type FlowShareStop = {
  id: string
  venueId: string
  stopOrder: number
  title: string | null
  city?: string | null
  checkedInAt?: string | null
  lat?: number | null
  lon?: number | null
}

type SnapshotVisibility = 'public' | 'private'

type SavedSnapshot = {
  id: string
  visibility: SnapshotVisibility
}

type SaveSnapshotResponse = {
  snapshot?: SavedSnapshot
  saved?: boolean
  created?: boolean
  visibilityPreserved?: boolean
  coverImageUrl?: string
  error?: string
  details?: string
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
    void Promise.resolve(logEvent(eventName, { metadata }))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function FlowShareActions({
  session,
  venues,
  progress,
}: Props) {
  const exportRef = useRef<HTMLDivElement>(null)
  const transparentRouteStickerRef = useRef<HTMLDivElement>(null)

  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [routeLine, setRouteLine] = useState<RouteLinePoint[]>([])
  const [routeLineLoading, setRouteLineLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [snapshotSaved, setSnapshotSaved] = useState(false)
  const [savedSnapshotVisibility, setSavedSnapshotVisibility] =
    useState<SnapshotVisibility | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [stickerType, setStickerType] = useState<'passport' | 'route'>(
    'passport'
  )
  const [stickerExportIntent, setStickerExportIntent] = useState<
    'save' | 'share'
  >('save')

  const checkedVenueIds = useMemo(() => {
    return new Set(progress.map((row) => row.venue_id))
  }, [progress])

  const checkedStops = useMemo(() => {
    return session.venue_ids.reduce<FlowShareStop[]>(
      (acc, venueId, index) => {
        const venue = venues.find((item) => item.id === venueId)
        const progressRow = progress.find(
          (row) => row.venue_id === venueId
        )

        if (!venue) return acc

        const includeStop =
          session.status === 'completed' ||
          checkedVenueIds.has(venue.id)

        if (!includeStop) return acc

        acc.push({
          id: `${session.id}-${venue.id}`,
          venueId: venue.id,
          stopOrder: index + 1,
          title: venue.name ?? 'Roam stop',
          city: venue.city ?? session.city,
          checkedInAt: progressRow?.checked_in_at ?? null,
          lat: venue.lat ?? null,
          lon: venue.lon ?? null,
        })

        return acc
      },
      []
    )
  }, [session, venues, progress, checkedVenueIds])

  const checkedInCount = checkedStops.length
  const totalStops = session.venue_ids.length

  const canShareSnapshot =
    session.status === 'completed' ||
    checkedInCount >= 3

  const snapshotStatus =
    session.status === 'completed'
      ? 'completed'
      : session.status === 'cancelled'
        ? 'cancelled'
        : 'partial'

  const shareTitle = session.title
    ? `My Roam Flow: ${session.title}`
    : 'My Roam Flow'

  const shareText =
    session.status === 'completed'
      ? `I completed ${checkedInCount} stops on Roam.`
      : `I checked in to ${checkedInCount} stops on Roam.`

  const routeSummary = checkedStops
    .map(
      (stop) =>
        stop.title ?? `Stop ${stop.stopOrder}`
    )
    .join(' → ')

  useEffect(() => {
    if (!canShareSnapshot) return

    safeLogEvent('flow_share_actions_viewed', {
      session_id: session.id,
      city: session.city,
      status: session.status,
      checked_in_count: checkedInCount,
      total_stops: totalStops,
    })
  }, [
    canShareSnapshot,
    checkedInCount,
    session.city,
    session.id,
    session.status,
    totalStops,
  ])

  const fetchSnapshotRouteLine =
    async (): Promise<RouteLinePoint[]> => {
      setRouteLineLoading(true)

      try {
        const validStops =
          checkedStops.filter(hasValidStopCoordinate)

        if (validStops.length < 2) {
          setRouteLine([])
          return []
        }

        const originStop = validStops[0]
        const destinationStop =
          validStops[validStops.length - 1]
        const waypointStops = validStops.slice(1, -1)

        const fullRouteRes = await fetch('/api/mapbox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin: {
              lat: originStop.lat,
              lng: originStop.lon,
            },
            destination: {
              lat: destinationStop.lat,
              lng: destinationStop.lon,
            },
            waypoints: waypointStops.map((stop) => ({
              lat: stop.lat,
              lng: stop.lon,
            })),
            travelMode:
              session.travel_mode ?? 'walking',
            geometries: 'geojson',
            overview: 'full',
          }),
        })

        const fullRouteData = await fullRouteRes
          .json()
          .catch(() => null)

        const fullRouteLine =
          extractRouteLineFromMapboxResponse(
            fullRouteData
          )

        if (
          fullRouteRes.ok &&
          fullRouteLine.length >= 2
        ) {
          setRouteLine(fullRouteLine)

          safeLogEvent(
            'flow_snapshot_route_loaded',
            {
              session_id: session.id,
              city: session.city,
              status: session.status,
              checked_in_count: checkedInCount,
              total_stops: totalStops,
              route_point_count:
                fullRouteLine.length,
              travel_mode:
                session.travel_mode ?? 'walking',
              route_source:
                'mapbox_full_route',
            }
          )

          return fullRouteLine
        }

        const routedLine: RouteLinePoint[] = []

        for (
          let index = 1;
          index < validStops.length;
          index += 1
        ) {
          const from = validStops[index - 1]
          const to = validStops[index]

          const response = await fetch(
            '/api/mapbox',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
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
                travelMode:
                  session.travel_mode ??
                  'walking',
                geometries: 'geojson',
                overview: 'full',
              }),
            }
          )

          const payload = await response
            .json()
            .catch(() => null)

          if (!response.ok) {
            throw new Error(
              getPayloadError(
                payload,
                'Failed to build flow route segment'
              )
            )
          }

          const segmentLine =
            extractRouteLineFromMapboxResponse(
              payload
            )

          if (segmentLine.length < 2) {
            throw new Error(
              'Mapbox route geometry missing or invalid'
            )
          }

          routedLine.push(
            ...(routedLine.length > 0
              ? segmentLine.slice(1)
              : segmentLine)
          )
        }

        if (routedLine.length < 2) {
          throw new Error(
            'Mapbox route line could not be built'
          )
        }

        setRouteLine(routedLine)

        safeLogEvent(
          'flow_snapshot_route_loaded',
          {
            session_id: session.id,
            city: session.city,
            status: session.status,
            checked_in_count: checkedInCount,
            total_stops: totalStops,
            route_point_count:
              routedLine.length,
            travel_mode:
              session.travel_mode ?? 'walking',
            route_source:
              'mapbox_segment_route',
          }
        )

        return routedLine
      } catch (err) {
        const fallbackRoute = checkedStops
          .filter(hasValidStopCoordinate)
          .map((stop) => ({
            lat: stop.lat,
            lon: stop.lon,
          }))

        setRouteLine(fallbackRoute)

        safeLogEvent(
          'flow_snapshot_route_failed',
          {
            session_id: session.id,
            city: session.city,
            status: session.status,
            checked_in_count: checkedInCount,
            total_stops: totalStops,
            message:
              err instanceof Error
                ? err.message
                : 'Unknown route error',
          }
        )

        return fallbackRoute
      } finally {
        setRouteLineLoading(false)
      }
    }

  const ensureRouteLine = async () => {
    if (routeLine.length >= 2) {
      return routeLine
    }

    return fetchSnapshotRouteLine()
  }

  const openStickerComposer = async ({
    type,
    intent,
  }: {
    type: 'passport' | 'route'
    intent: 'save' | 'share'
  }) => {
    if (exporting || routeLineLoading) return

    setStickerType(type)
    setStickerExportIntent(intent)
    setError(null)

    if (type === 'route') {
      await ensureRouteLine()
    }

    setStickerOpen(true)

    safeLogEvent(
      'flow_sticker_composer_opened',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        sticker_type: type,
        export_intent: intent,
      }
    )
  }

  const getSnapshotBlob =
    async (): Promise<Blob | null> => {
      if (!exportRef.current) {
        return null
      }

      await waitForFontsAndPaint()

      const { toBlob } = await import(
        'html-to-image'
      )

      return toBlob(exportRef.current, {
        width: 1080,
        height: 1920,
        canvasWidth: 1080,
        canvasHeight: 1920,
        pixelRatio: 2,
        backgroundColor: '#020617',
        cacheBust: true,
      })
    }

  const exportTransparentRouteSticker = async (
    share = false
  ) => {
    if (exporting || routeLineLoading) return

    setExporting(true)
    setError(null)

    safeLogEvent(
      'flow_transparent_route_export_started',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        export_intent: share
          ? 'share'
          : 'save',
      }
    )

    try {
      const resolvedRoute =
        await ensureRouteLine()

      if (resolvedRoute.length < 2) {
        throw new Error(
          'At least two mapped stops are required to export a route sticker.'
        )
      }

      await waitForFontsAndPaint()

      if (!transparentRouteStickerRef.current) {
        throw new Error(
          'Route sticker export target not found'
        )
      }

      const { toBlob } = await import(
        'html-to-image'
      )

      const blob = await toBlob(
        transparentRouteStickerRef.current,
        {
          width: 1080,
          height: 1080,
          canvasWidth: 1080,
          canvasHeight: 1080,
          pixelRatio: 3,
          backgroundColor: 'transparent',
          cacheBust: true,
        }
      )

      if (!blob) {
        throw new Error(
          'Failed to create transparent route sticker'
        )
      }

      const fileName =
        `roam-route-sticker-clear-style-` +
        `${session.id}.png`

      const file = new File(
        [blob],
        fileName,
        {
          type: 'image/png',
        }
      )

      if (
        share &&
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: shareTitle,
          text:
            'Add this Roam route sticker over your video.',
          files: [file],
        })

        safeLogEvent(
          'flow_transparent_route_shared',
          {
            session_id: session.id,
            city: session.city,
            checked_in_count:
              checkedInCount,
            total_stops: totalStops,
          }
        )

        return
      }

      downloadBlob(blob, fileName)

      safeLogEvent(
        share
          ? 'flow_transparent_route_share_fallback'
          : 'flow_transparent_route_saved',
        {
          session_id: session.id,
          city: session.city,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
        }
      )
    } catch (err) {
      if (isShareCancellation(err)) return

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to export transparent route sticker'

      setError(message)

      safeLogEvent(
        'flow_transparent_route_export_failed',
        {
          session_id: session.id,
          city: session.city,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
          export_intent: share
            ? 'share'
            : 'save',
          message,
        }
      )
    } finally {
      setExporting(false)
    }
  }

  const exportStickerTarget = async (
    target: HTMLElement,
    fileName: string,
    share = false
  ) => {
    if (exporting) return

    setExporting(true)
    setError(null)

    safeLogEvent(
      'flow_sticker_export_started',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        sticker_type: stickerType,
        export_intent: share
          ? 'share'
          : 'save',
      }
    )

    try {
      await waitForFontsAndPaint()

      const { toBlob } = await import(
        'html-to-image'
      )

      const blob = await toBlob(target, {
        pixelRatio: 3,
        backgroundColor: 'transparent',
        cacheBust: true,
      })

      if (!blob) {
        throw new Error(
          'Failed to create sticker image'
        )
      }

      const file = new File(
        [blob],
        fileName,
        {
          type: 'image/png',
        }
      )

      if (
        share &&
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })

        safeLogEvent(
          'flow_sticker_shared',
          {
            session_id: session.id,
            city: session.city,
            status: session.status,
            checked_in_count:
              checkedInCount,
            total_stops: totalStops,
            sticker_type: stickerType,
          }
        )

        return
      }

      downloadBlob(blob, fileName)

      safeLogEvent(
        share
          ? 'flow_sticker_share_download_fallback'
          : 'flow_sticker_saved',
        {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
          sticker_type: stickerType,
        }
      )
    } catch (err) {
      if (isShareCancellation(err)) return

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to export sticker'

      setError(message)

      safeLogEvent(
        'flow_sticker_export_failed',
        {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
          sticker_type: stickerType,
          export_intent: share
            ? 'share'
            : 'save',
          message,
        }
      )
    } finally {
      setExporting(false)
    }
  }

  const saveSnapshotToProfile = async () => {
    if (exporting) return

    setExporting(true)
    setError(null)
    setSnapshotSaved(false)
    setSavedSnapshotVisibility(null)

    safeLogEvent(
      'flow_snapshot_save_to_profile_clicked',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
      }
    )

    try {
      await ensureRouteLine()

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error(
          'Failed to create snapshot image'
        )
      }

      const file = new File(
        [blob],
        `roam-flow-${session.id}.png`,
        {
          type: 'image/png',
        }
      )

      const formData = new FormData()

      formData.append('file', file)
      formData.append(
        'source_type',
        'active_flow'
      )
      formData.append(
        'source_id',
        session.id
      )
      formData.append(
        'title',
        session.title ?? 'Roam Flow'
      )
      formData.append(
        'city',
        session.city ?? ''
      )
      formData.append(
        'status',
        snapshotStatus
      )
      formData.append(
        'route_summary',
        routeSummary
      )
      formData.append(
        'checked_in_count',
        String(checkedInCount)
      )
      formData.append(
        'total_stops',
        String(totalStops)
      )

      /*
       * New snapshots default to public.
       * The API preserves an existing snapshot's current
       * public/private visibility during subsequent saves.
       */
      formData.append(
        'visibility',
        'public'
      )

      const response = await fetch(
        '/api/flow-snapshots/save',
        {
          method: 'POST',
          body: formData,
        }
      )

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | SaveSnapshotResponse
          | null

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            'Failed to save snapshot'
        )
      }

      if (
        payload?.saved !== true ||
        !payload.snapshot
      ) {
        throw new Error(
          'The server did not confirm that the snapshot was saved.'
        )
      }

      const visibility =
        payload.snapshot.visibility ===
        'private'
          ? 'private'
          : 'public'

      setSavedSnapshotVisibility(visibility)
      setSnapshotSaved(true)

      safeLogEvent(
        'flow_snapshot_saved_to_profile',
        {
          session_id: session.id,
          snapshot_id:
            payload.snapshot.id,
          city: session.city,
          status: session.status,
          checked_in_count:
            checkedInCount,
          total_stops: totalStops,
          visibility,
          created:
            payload.created === true,
          visibility_preserved:
            payload.visibilityPreserved ===
            true,
        }
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save snapshot'

      setError(message)

      safeLogEvent(
        'flow_snapshot_save_to_profile_failed',
        {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
          message,
        }
      )
    } finally {
      setExporting(false)
    }
  }

  const shareSnapshotImage = async () => {
    if (exporting) return

    setExporting(true)
    setError(null)

    safeLogEvent(
      'flow_snapshot_share_clicked',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
      }
    )

    try {
      await ensureRouteLine()

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error(
          'Failed to create snapshot image'
        )
      }

      const fileName =
        `roam-flow-${session.id}.png`

      const file = new File(
        [blob],
        fileName,
        {
          type: 'image/png',
        }
      )

      if (
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })

        safeLogEvent(
          'flow_snapshot_shared',
          {
            session_id: session.id,
            city: session.city,
            status: session.status,
            checked_in_count:
              checkedInCount,
            total_stops: totalStops,
          }
        )

        return
      }

      downloadBlob(blob, fileName)

      safeLogEvent(
        'flow_snapshot_share_download_fallback',
        {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
        }
      )
    } catch (err) {
      if (isShareCancellation(err)) return

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to share snapshot'

      setError(message)

      safeLogEvent(
        'flow_snapshot_share_failed',
        {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
          message,
        }
      )
    } finally {
      setExporting(false)
    }
  }

  const openSnapshotPreview = () => {
    setSnapshotOpen(true)
    setError(null)

    safeLogEvent(
      'flow_snapshot_previewed',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
      }
    )

    void ensureRouteLine()
  }

  const closeSnapshotPreview = () => {
    setSnapshotOpen(false)

    safeLogEvent(
      'flow_snapshot_preview_closed',
      {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
      }
    )
  }

  if (!canShareSnapshot) return null

  return (
    <>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-300">
              Share your flow
            </p>

            <p className="mt-1 max-w-md text-sm text-neutral-400">
              Post a snapshot, save it to your
              profile, or export a transparent
              route sticker for videos.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  void shareSnapshotImage()
                }
                disabled={exporting}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting
                  ? 'Preparing…'
                  : 'Share Snapshot'}
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveSnapshotToProfile()
                }
                disabled={exporting}
                className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting
                  ? 'Saving…'
                  : snapshotSaved
                    ? 'Saved'
                    : 'Save to Profile'}
              </button>

              <button
                type="button"
                onClick={() =>
                  void exportTransparentRouteSticker(
                    false
                  )
                }
                disabled={
                  exporting ||
                  routeLineLoading
                }
                className="rounded-xl border border-cyan-700 bg-cyan-950/50 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {routeLineLoading
                  ? 'Loading Route…'
                  : 'Route Sticker'}
              </button>
            </div>

            <details className="group w-full sm:w-auto">
              <summary className="cursor-pointer list-none text-right text-xs font-medium text-neutral-500 transition hover:text-neutral-300">
                More options
              </summary>

              <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-neutral-800 bg-black/30 p-3">
                <button
                  type="button"
                  onClick={
                    openSnapshotPreview
                  }
                  className="rounded-lg border border-indigo-800 bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-900/60"
                >
                  Preview Snapshot
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void openStickerComposer({
                      type: 'passport',
                      intent: 'save',
                    })
                  }
                  disabled={
                    exporting ||
                    routeLineLoading
                  }
                  className="rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Passport Stamp
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void exportTransparentRouteSticker(
                      true
                    )
                  }
                  disabled={
                    exporting ||
                    routeLineLoading
                  }
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Share Route PNG
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void openStickerComposer({
                      type: 'route',
                      intent: 'share',
                    })
                  }
                  disabled={
                    exporting ||
                    routeLineLoading
                  }
                  className="rounded-lg border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Story Composer
                </button>
              </div>
            </details>
          </div>
        </div>

        {snapshotSaved ? (
          <p className="mt-3 text-sm text-emerald-400">
            {savedSnapshotVisibility ===
            'private'
              ? 'Snapshot saved privately. You can make it public from your profile snapshot library.'
              : 'Snapshot saved to your public profile.'}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 text-sm text-red-400"
          >
            {error}
          </p>
        ) : null}
      </section>

      <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
        <div ref={exportRef}>
          <FlowShareCard
            city={session.city}
            title={session.title}
            status={snapshotStatus}
            startedAt={session.started_at}
            completedAt={
              session.completed_at
            }
            checkedInCount={checkedInCount}
            totalStops={totalStops}
            stops={checkedStops}
            routeLine={routeLine}
            variant="export"
          />
        </div>
      </div>

      <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
        <div
          ref={transparentRouteStickerRef}
          style={{
            width: 1080,
            height: 1080,
            background: 'transparent',
          }}
        >
          <FlowRouteSticker
            title={session.title}
            city={session.city}
            stops={checkedStops}
            routeLine={routeLine}
            width={1080}
            height={1080}
            variant="transparent-export"
          />
        </div>
      </div>

      <StickerComposer
        open={stickerOpen}
        title={
          stickerType === 'route'
            ? 'Route Sticker Preview'
            : 'Passport Sticker Preview'
        }
        exporting={exporting}
        onClose={() => {
          if (exporting) return

          setStickerOpen(false)

          safeLogEvent(
            'flow_sticker_composer_closed',
            {
              session_id: session.id,
              city: session.city,
              status: session.status,
              checked_in_count:
                checkedInCount,
              total_stops: totalStops,
              sticker_type: stickerType,
              export_intent:
                stickerExportIntent,
            }
          )
        }}
        onExport={(target) =>
          exportStickerTarget(
            target,
            stickerType === 'route'
              ? `roam-route-sticker-${session.id}.png`
              : `roam-passport-sticker-${session.id}.png`,
            stickerExportIntent === 'share'
          )
        }
        sticker={
          stickerType === 'route' ? (
            <FlowRouteSticker
              title={session.title}
              city={session.city}
              stops={checkedStops}
              routeLine={routeLine}
            />
          ) : (
            <FlowPassportSticker
              title={session.title}
              city={session.city}
              completedAt={
                session.completed_at
              }
              checkedInCount={
                checkedInCount
              }
              totalStops={totalStops}
              stops={checkedStops}
              xpEarned={
                checkedInCount * 25
              }
            />
          )
        }
      />

      {snapshotOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flow-snapshot-preview-title"
          onClick={closeSnapshotPreview}
        >
          <div
            className="relative z-[10000] max-h-[92vh] w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <div>
                <p
                  id="flow-snapshot-preview-title"
                  className="text-sm font-semibold text-white"
                >
                  Flow Snapshot Preview
                </p>

                <p className="text-xs text-neutral-400">
                  {routeLineLoading
                    ? 'Loading routed line...'
                    : 'Story-style flow card'}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeSnapshotPreview
                }
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                Close
              </button>
            </div>

            <div className="flex items-center justify-center bg-neutral-950 p-4">
              <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-neutral-800 bg-black">
                <div
                  className="relative mx-auto"
                  style={{
                    width: 320,
                    height: 568,
                  }}
                >
                  <div
                    className="absolute left-1/2 top-0"
                    style={{
                      width: 1080,
                      transform:
                        'translateX(-50%) scale(0.2963)',
                      transformOrigin:
                        'top center',
                    }}
                  >
                    <FlowShareCard
                      city={session.city}
                      title={session.title}
                      status={
                        snapshotStatus
                      }
                      startedAt={
                        session.started_at
                      }
                      completedAt={
                        session.completed_at
                      }
                      checkedInCount={
                        checkedInCount
                      }
                      totalStops={
                        totalStops
                      }
                      stops={checkedStops}
                      routeLine={
                        routeLine
                      }
                      variant="preview"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function hasValidStopCoordinate(
  stop: FlowShareStop
): stop is FlowShareStop & {
  lat: number
  lon: number
} {
  return (
    typeof stop.lat === 'number' &&
    Number.isFinite(stop.lat) &&
    Math.abs(stop.lat) <= 90 &&
    typeof stop.lon === 'number' &&
    Number.isFinite(stop.lon) &&
    Math.abs(stop.lon) <= 180
  )
}

function extractRouteLineFromMapboxResponse(
  data: unknown
): RouteLinePoint[] {
  const payload = data as
    | {
        geometry?: unknown
        routeGeometry?: unknown
        route?: {
          geometry?: unknown
        }
        routes?: Array<{
          geometry?: unknown
        }>
      }
    | null

  const candidates = [
    getCoordinates(payload?.geometry),
    getCoordinates(
      payload?.routeGeometry
    ),
    getCoordinates(
      payload?.route?.geometry
    ),
    getCoordinates(
      payload?.routes?.[0]?.geometry
    ),
    payload?.geometry,
  ]

  for (const candidate of candidates) {
    const parsed =
      parseRouteGeometry(candidate)

    if (parsed.length >= 2) {
      return parsed
    }
  }

  return []
}

function getCoordinates(
  value: unknown
): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    'coordinates' in value
  ) {
    return (
      value as {
        coordinates?: unknown
      }
    ).coordinates
  }

  return value
}

function parseRouteGeometry(
  value: unknown
): RouteLinePoint[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value
      .map((coordinate) => {
        if (
          Array.isArray(coordinate) &&
          typeof coordinate[0] ===
            'number' &&
          typeof coordinate[1] ===
            'number'
        ) {
          return {
            lon: coordinate[0],
            lat: coordinate[1],
          }
        }

        return null
      })
      .filter(
        (
          point
        ): point is RouteLinePoint => {
          if (!point) return false

          return (
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon) &&
            Math.abs(point.lat) <= 90 &&
            Math.abs(point.lon) <= 180
          )
        }
      )
  }

  if (
    typeof value === 'object' &&
    value !== null
  ) {
    const objectValue = value as {
      type?: string
      coordinates?: unknown
      geometry?: unknown
    }

    if (
      objectValue.type === 'LineString'
    ) {
      return parseRouteGeometry(
        objectValue.coordinates
      )
    }

    if (objectValue.geometry) {
      return parseRouteGeometry(
        objectValue.geometry
      )
    }

    if (objectValue.coordinates) {
      return parseRouteGeometry(
        objectValue.coordinates
      )
    }
  }

  if (
    typeof value === 'string' &&
    value.trim().length > 0
  ) {
    const polyline6 = decodePolyline(
      value,
      6
    )

    if (polyline6.length >= 2) {
      return polyline6
    }

    const polyline5 = decodePolyline(
      value,
      5
    )

    if (polyline5.length >= 2) {
      return polyline5
    }
  }

  return []
}

function decodePolyline(
  encoded: string,
  precision: number
): RouteLinePoint[] {
  const coordinates: RouteLinePoint[] = []
  const factor = Math.pow(10, precision)

  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte = 0

    do {
      byte =
        encoded.charCodeAt(index++) - 63
      result |=
        (byte & 0x1f) << shift
      shift += 5
    } while (
      byte >= 0x20 &&
      index < encoded.length
    )

    const latitudeDelta =
      result & 1
        ? ~(result >> 1)
        : result >> 1

    latitude += latitudeDelta
    result = 0
    shift = 0

    do {
      byte =
        encoded.charCodeAt(index++) - 63
      result |=
        (byte & 0x1f) << shift
      shift += 5
    } while (
      byte >= 0x20 &&
      index < encoded.length
    )

    const longitudeDelta =
      result & 1
        ? ~(result >> 1)
        : result >> 1

    longitude += longitudeDelta

    const point = {
      lat: latitude / factor,
      lon: longitude / factor,
    }

    if (
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lon) <= 180
    ) {
      coordinates.push(point)
    }
  }

  return coordinates
}

function getPayloadError(
  payload: unknown,
  fallback: string
) {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (
      payload as {
        error?: unknown
      }
    ).error === 'string'
  ) {
    return (
      payload as {
        error: string
      }
    ).error
  }

  return fallback
}

function downloadBlob(
  blob: Blob,
  fileName: string
) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

async function waitForFontsAndPaint() {
  if (
    typeof document !== 'undefined' &&
    'fonts' in document
  ) {
    await document.fonts.ready
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

function isShareCancellation(
  error: unknown
) {
  return (
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
}