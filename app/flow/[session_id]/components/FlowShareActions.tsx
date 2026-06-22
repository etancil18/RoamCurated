'use client'

import { useMemo, useRef, useState } from 'react'
import { logEvent } from '@/lib/logEvent'
import FlowShareCard from './FlowShareCard'

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

type Props = {
  session: ActiveFlowSession
  venues: Venue[]
  progress: ProgressRow[]
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
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

  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [routeLine, setRouteLine] = useState<RouteLinePoint[]>([])
  const [routeLineLoading, setRouteLineLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [snapshotSaved, setSnapshotSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkedVenueIds = useMemo(() => {
    return new Set(progress.map((row) => row.venue_id))
  }, [progress])

  const checkedStops = useMemo(() => {
    return session.venue_ids.reduce<FlowShareStop[]>((acc, venueId, index) => {
      const venue = venues.find((item) => item.id === venueId)
      const progressRow = progress.find((row) => row.venue_id === venueId)

      if (!venue) return acc

      const includeStop =
        session.status === 'completed' || checkedVenueIds.has(venue.id)

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
    }, [])
  }, [session, venues, progress, checkedVenueIds])

  const checkedInCount = checkedStops.length
  const totalStops = session.venue_ids.length
  const canShareSnapshot = session.status === 'completed' || checkedInCount >= 3

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
    .map((stop) => stop.title ?? `Stop ${stop.stopOrder}`)
    .join(' → ')

  const fetchSnapshotRouteLine = async () => {
    setRouteLineLoading(true)

    try {
      const validStops = checkedStops.filter(
        (stop) =>
          typeof stop.lat === 'number' &&
          Number.isFinite(stop.lat) &&
          typeof stop.lon === 'number' &&
          Number.isFinite(stop.lon)
      )

      if (validStops.length < 2) {
        setRouteLine([])
        return
      }

      const originStop = validStops[0]
      const destinationStop = validStops[validStops.length - 1]
      const waypointStops = validStops.slice(1, -1)

      const fullRouteRes = await fetch('/api/mapbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          travelMode: session.travel_mode ?? 'walking',
          geometries: 'geojson',
          overview: 'full',
        }),
      })

      const fullRouteData = await fullRouteRes.json().catch(() => null)
      const fullRouteLine = extractRouteLineFromMapboxResponse(fullRouteData)

      if (fullRouteRes.ok && fullRouteLine.length > validStops.length) {
        setRouteLine(fullRouteLine)

        safeLogEvent('flow_snapshot_route_loaded', {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
          route_point_count: fullRouteLine.length,
          travel_mode: session.travel_mode ?? 'walking',
          route_source: 'mapbox_full_route',
        })

        return
      }

      const routedLine: RouteLinePoint[] = []

      for (let i = 1; i < validStops.length; i++) {
        const from = validStops[i - 1]
        const to = validStops[i]

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
            travelMode: session.travel_mode ?? 'walking',
            geometries: 'geojson',
            overview: 'full',
          }),
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to build flow route segment')
        }

        const segmentLine = extractRouteLineFromMapboxResponse(data)

        if (segmentLine.length < 2) {
          throw new Error('Mapbox route geometry missing or invalid')
        }

        routedLine.push(
          ...(routedLine.length > 0 ? segmentLine.slice(1) : segmentLine)
        )
      }

      if (routedLine.length < 2) {
        throw new Error('Mapbox route line could not be built')
      }

      setRouteLine(routedLine)

      safeLogEvent('flow_snapshot_route_loaded', {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        route_point_count: routedLine.length,
        travel_mode: session.travel_mode ?? 'walking',
        route_source: 'mapbox_segment_route',
      })
    } catch (err) {
      setRouteLine(
        checkedStops
          .filter(
            (stop) =>
              typeof stop.lat === 'number' &&
              Number.isFinite(stop.lat) &&
              typeof stop.lon === 'number' &&
              Number.isFinite(stop.lon)
          )
          .map((stop) => ({
            lat: stop.lat as number,
            lon: stop.lon as number,
          }))
      )

      safeLogEvent('flow_snapshot_route_failed', {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        message: err instanceof Error ? err.message : 'Unknown route error',
      })
    } finally {
      setRouteLineLoading(false)
    }
  }

  const getSnapshotBlob = async (): Promise<Blob | null> => {
    if (!exportRef.current) return null

    const { toBlob } = await import('html-to-image')

    return await toBlob(exportRef.current, {
      width: 1080,
      height: 1920,
      pixelRatio: 2,
      backgroundColor: '#020617',
      cacheBust: true,
    })
  }

  const saveSnapshotToProfile = async () => {
    setExporting(true)
    setError(null)
    setSnapshotSaved(false)

    try {
      if (routeLine.length === 0) {
        await fetchSnapshotRouteLine()
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150))

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error('Failed to create snapshot image')
      }

      const file = new File([blob], `roam-flow-${session.id}.png`, {
        type: 'image/png',
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('source_type', 'active_flow')
      formData.append('source_id', session.id)
      formData.append('title', session.title ?? 'Roam Flow')
      formData.append('city', session.city ?? '')
      formData.append('status', snapshotStatus)
      formData.append('route_summary', routeSummary)
      formData.append('checked_in_count', String(checkedInCount))
      formData.append('total_stops', String(totalStops))
      formData.append('visibility', 'public')

      const res = await fetch('/api/flow-snapshots/save', {
        method: 'POST',
        body: formData,
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to save snapshot')
      }

      setSnapshotSaved(true)

      safeLogEvent('flow_snapshot_saved_to_profile', {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save snapshot'

      setError(message)

      safeLogEvent('flow_snapshot_save_to_profile_failed', {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  const shareSnapshotImage = async () => {
    setExporting(true)
    setError(null)

    try {
      if (routeLine.length === 0) {
        await fetchSnapshotRouteLine()
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150))

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error('Failed to create snapshot image')
      }

      const file = new File([blob], `roam-flow-${session.id}.png`, {
        type: 'image/png',
      })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })

        safeLogEvent('flow_snapshot_shared', {
          session_id: session.id,
          city: session.city,
          status: session.status,
          checked_in_count: checkedInCount,
          total_stops: totalStops,
        })

        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `roam-flow-${session.id}.png`
      link.click()
      URL.revokeObjectURL(url)

      safeLogEvent('flow_snapshot_share_download_fallback', {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to share snapshot'

      setError(message)

      safeLogEvent('flow_snapshot_share_failed', {
        session_id: session.id,
        city: session.city,
        status: session.status,
        checked_in_count: checkedInCount,
        total_stops: totalStops,
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  const openSnapshotPreview = () => {
    setSnapshotOpen(true)

    safeLogEvent('flow_snapshot_previewed', {
      session_id: session.id,
      city: session.city,
      status: session.status,
      checked_in_count: checkedInCount,
      total_stops: totalStops,
    })

    void fetchSnapshotRouteLine()
  }

  const closeSnapshotPreview = () => {
    setSnapshotOpen(false)
  }

  if (!canShareSnapshot) return null

  return (
    <>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-300">
              Share your flow
            </p>

            <p className="mt-1 text-sm text-neutral-400">
              Save or share a story-style snapshot of your route.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openSnapshotPreview}
              className="rounded-lg border border-indigo-800 bg-indigo-950/50 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-900/60"
            >
              Open Snapshot Preview
            </button>

            <button
              type="button"
              onClick={() => void shareSnapshotImage()}
              disabled={exporting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? 'Preparing...' : 'Share Snapshot'}
            </button>

            <button
              type="button"
              onClick={() => void saveSnapshotToProfile()}
              disabled={exporting}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting
                ? 'Saving...'
                : snapshotSaved
                  ? 'Saved to Profile'
                  : 'Save Snapshot'}
            </button>
          </div>
        </div>

        {snapshotSaved ? (
          <p className="mt-3 text-sm text-emerald-400">
            Snapshot saved to your public profile.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        ) : null}
      </section>

      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <div ref={exportRef}>
          <FlowShareCard
            city={session.city}
            title={session.title}
            status={snapshotStatus}
            startedAt={session.started_at}
            completedAt={session.completed_at}
            checkedInCount={checkedInCount}
            totalStops={totalStops}
            stops={checkedStops}
            routeLine={routeLine}
            variant="export"
          />
        </div>
      </div>

      {snapshotOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeSnapshotPreview}
        >
          <div
            className="relative z-[10000] max-h-[92vh] w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
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
                onClick={closeSnapshotPreview}
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
                      transform: 'translateX(-50%) scale(0.2963)',
                      transformOrigin: 'top center',
                    }}
                  >
                    <FlowShareCard
                      city={session.city}
                      title={session.title}
                      status={snapshotStatus}
                      startedAt={session.started_at}
                      completedAt={session.completed_at}
                      checkedInCount={checkedInCount}
                      totalStops={totalStops}
                      stops={checkedStops}
                      routeLine={routeLine}
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

function extractRouteLineFromMapboxResponse(data: any): RouteLinePoint[] {
  const candidates = [
    data?.geometry?.coordinates,
    data?.routeGeometry?.coordinates,
    data?.route?.geometry?.coordinates,
    data?.routes?.[0]?.geometry?.coordinates,
    data?.routes?.[0]?.geometry,
    data?.geometry,
  ]

  for (const candidate of candidates) {
    const parsed = parseRouteGeometry(candidate)

    if (parsed.length >= 2) {
      return parsed
    }
  }

  return []
}

function parseRouteGeometry(value: unknown): RouteLinePoint[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value
      .map((coord) => {
        if (
          Array.isArray(coord) &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number'
        ) {
          return {
            lon: coord[0],
            lat: coord[1],
          }
        }

        return null
      })
      .filter((point: RouteLinePoint | null): point is RouteLinePoint =>
        Boolean(point)
      )
  }

  if (typeof value === 'object' && value !== null) {
    const objectValue = value as {
      type?: string
      coordinates?: unknown
      geometry?: unknown
    }

    if (objectValue.type === 'LineString') {
      return parseRouteGeometry(objectValue.coordinates)
    }

    if (objectValue.geometry) {
      return parseRouteGeometry(objectValue.geometry)
    }

    if (objectValue.coordinates) {
      return parseRouteGeometry(objectValue.coordinates)
    }
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const polyline6 = decodePolyline(value, 6)
    if (polyline6.length >= 2) return polyline6

    const polyline5 = decodePolyline(value, 5)
    if (polyline5.length >= 2) return polyline5
  }

  return []
}

function decodePolyline(encoded: string, precision: number): RouteLinePoint[] {
  const coordinates: RouteLinePoint[] = []
  const factor = Math.pow(10, precision)

  let index = 0
  let lat = 0
  let lon = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    result = 0
    shift = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)

    const deltaLon = result & 1 ? ~(result >> 1) : result >> 1
    lon += deltaLon

    const nextPoint = {
      lat: lat / factor,
      lon: lon / factor,
    }

    if (
      Number.isFinite(nextPoint.lat) &&
      Number.isFinite(nextPoint.lon) &&
      Math.abs(nextPoint.lat) <= 90 &&
      Math.abs(nextPoint.lon) <= 180
    ) {
      coordinates.push(nextPoint)
    }
  }

  return coordinates
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}