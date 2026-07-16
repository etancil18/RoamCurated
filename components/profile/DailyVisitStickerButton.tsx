'use client'

import { useState } from 'react'
import FlowRouteSticker from '@/app/flow/[session_id]/components/FlowRouteSticker'
import StickerComposer from '@/components/flows/StickerComposer'

type RouteLinePoint = {
  lat: number
  lon: number
}

export type DailyVisitStickerVisit = {
  id: string
  venueId: string
  venueName: string
  city?: string | null
  visitedAt: string
  lat: number | null
  lon: number | null
}

type StickerStop = {
  id: string
  venueId: string
  stopOrder: number
  title: string | null
  city?: string | null
  checkedInAt?: string | null
  lat?: number | null
  lon?: number | null
}

type ExportIntent = 'save' | 'share'

type Props = {
  city: string
  date: string
  dateLabel?: string | null
  visits: DailyVisitStickerVisit[]
  className?: string
  disabled?: boolean
  defaultIntent?: ExportIntent
  buttonLabel?: string
  shareButtonLabel?: string
  showShareButton?: boolean
  onError?: (message: string) => void
}

export default function DailyVisitStickerButton({
  city,
  date,
  dateLabel = null,
  visits,
  className = '',
  disabled = false,
  defaultIntent = 'save',
  buttonLabel = 'Create Day Sticker',
  shareButtonLabel = 'Share Sticker',
  showShareButton = true,
  onError,
}: Props) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [routeLine, setRouteLine] = useState<RouteLinePoint[]>([])
  const [stickerStops, setStickerStops] = useState<StickerStop[]>([])
  const [intent, setIntent] = useState<ExportIntent>(defaultIntent)
  const [buildingRoute, setBuildingRoute] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligibleVisits = visits
    .filter(hasValidVisitCoordinate)
    .sort(
      (a, b) =>
        new Date(a.visitedAt).getTime() -
        new Date(b.visitedAt).getTime()
    )

  const canCreateSticker = eligibleVisits.length >= 2
  const busy = buildingRoute || exporting

  const openSticker = async (nextIntent: ExportIntent) => {
    if (disabled || busy) return

    if (!canCreateSticker) {
      reportError(
        'At least two mapped visits from the same day are required to create a route sticker.'
      )
      return
    }

    setBuildingRoute(true)
    setError(null)
    setIntent(nextIntent)

    const nextStops: StickerStop[] = eligibleVisits.map(
      (visit, index) => ({
        id: visit.id,
        venueId: visit.venueId,
        stopOrder: index + 1,
        title: visit.venueName,
        city: visit.city ?? city,
        checkedInAt: visit.visitedAt,
        lat: visit.lat,
        lon: visit.lon,
      })
    )

    try {
      const nextRouteLine = await fetchRouteLine(nextStops)

      setStickerStops(nextStops)
      setRouteLine(nextRouteLine)
      setComposerOpen(true)
    } catch (err) {
      console.error(
        '[DailyVisitStickerButton] Failed to build route:',
        err
      )

      reportError(
        err instanceof Error
          ? err.message
          : 'Failed to build your day route.'
      )
    } finally {
      setBuildingRoute(false)
    }
  }

  const exportSticker = async (target: HTMLElement) => {
    if (exporting || !composerOpen) return

    setExporting(true)
    setError(null)

    try {
      await waitForFonts()

      const { toBlob } = await import('html-to-image')

      const blob = await toBlob(target, {
        pixelRatio: 3,
        backgroundColor: 'transparent',
        cacheBust: true,
      })

      if (!blob) {
        throw new Error('Failed to create route sticker image.')
      }

      const fileName = buildFileName({
        city,
        date,
      })

      const file = new File([blob], fileName, {
        type: 'image/png',
      })

      if (
        intent === 'share' &&
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: `${city} Roam Route`,
          text: buildShareText({
            city,
            dateLabel,
            visitCount: stickerStops.length,
          }),
          files: [file],
        })

        return
      }

      downloadBlob(blob, fileName)
    } catch (err) {
      if (isShareCancellation(err)) return

      console.error(
        '[DailyVisitStickerButton] Sticker export failed:',
        err
      )

      reportError(
        err instanceof Error
          ? err.message
          : 'Failed to export your route sticker.'
      )
    } finally {
      setExporting(false)
    }
  }

  const closeComposer = () => {
    if (exporting) return

    setComposerOpen(false)
    setRouteLine([])
    setStickerStops([])
  }

  function reportError(message: string) {
    setError(message)
    onError?.(message)
  }

  return (
    <>
      <div
        className={[
          'space-y-2',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openSticker('save')}
            disabled={
              disabled ||
              busy ||
              !canCreateSticker
            }
            className="inline-flex items-center justify-center rounded-xl border border-cyan-700 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buildingRoute
              ? 'Building Route…'
              : buttonLabel}
          </button>

          {showShareButton ? (
            <button
              type="button"
              onClick={() => void openSticker('share')}
              disabled={
                disabled ||
                busy ||
                !canCreateSticker
              }
              className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buildingRoute
                ? 'Building Route…'
                : shareButtonLabel}
            </button>
          ) : null}
        </div>

        {!canCreateSticker ? (
          <p className="text-xs leading-5 text-neutral-500">
            Two mapped visits from the same day are required.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="max-w-sm text-xs leading-5 text-red-400"
          >
            {error}
          </p>
        ) : null}
      </div>

      <StickerComposer
        open={composerOpen}
        title={`${city} Day Route`}
        exporting={exporting}
        onClose={closeComposer}
        onExport={exportSticker}
        sticker={
          <FlowRouteSticker
            title={buildStickerTitle({
              city,
              dateLabel,
            })}
            city={city}
            stops={stickerStops}
            routeLine={routeLine}
          />
        }
      />
    </>
  )
}

async function fetchRouteLine(
  stops: StickerStop[]
): Promise<RouteLinePoint[]> {
  const validStops = stops.filter(hasValidStopCoordinate)

  if (validStops.length < 2) {
    throw new Error(
      'At least two mapped visits are required to build a route.'
    )
  }

  const origin = validStops[0]
  const destination =
    validStops[validStops.length - 1]
  const waypoints = validStops.slice(1, -1)

  const fullRouteResponse = await fetch('/api/mapbox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: {
        lat: origin.lat,
        lng: origin.lon,
      },
      destination: {
        lat: destination.lat,
        lng: destination.lon,
      },
      waypoints: waypoints.map((stop) => ({
        lat: stop.lat,
        lng: stop.lon,
      })),
      travelMode: 'walking',
      geometries: 'geojson',
      overview: 'full',
    }),
  })

  const fullRoutePayload = await fullRouteResponse
    .json()
    .catch(() => null)

  const fullRouteLine =
    extractRouteLineFromMapboxResponse(
      fullRoutePayload
    )

  if (
    fullRouteResponse.ok &&
    fullRouteLine.length >= 2
  ) {
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

    const response = await fetch('/api/mapbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        travelMode: 'walking',
        geometries: 'geojson',
        overview: 'full',
      }),
    })

    const payload = await response
      .json()
      .catch(() => null)

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          'Failed to build the route between visits.'
      )
    }

    const segment =
      extractRouteLineFromMapboxResponse(payload)

    if (segment.length < 2) {
      throw new Error(
        'Mapbox route geometry was unavailable.'
      )
    }

    routedLine.push(
      ...(routedLine.length > 0
        ? segment.slice(1)
        : segment)
    )
  }

  if (routedLine.length < 2) {
    throw new Error(
      'The visit route could not be generated.'
    )
  }

  return routedLine
}

function extractRouteLineFromMapboxResponse(
  data: unknown
): RouteLinePoint[] {
  const payload = data as {
    geometry?: unknown
    routeGeometry?: unknown
    route?: {
      geometry?: unknown
    }
    routes?: Array<{
      geometry?: unknown
    }>
  } | null

  const candidates = [
    getCoordinates(payload?.geometry),
    getCoordinates(payload?.routeGeometry),
    getCoordinates(payload?.route?.geometry),
    getCoordinates(payload?.routes?.[0]?.geometry),
    payload?.geometry,
  ]

  for (const candidate of candidates) {
    const parsed = parseRouteGeometry(candidate)

    if (parsed.length >= 2) {
      return parsed
    }
  }

  return []
}

function getCoordinates(value: unknown): unknown {
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
          typeof coordinate[0] === 'number' &&
          typeof coordinate[1] === 'number'
        ) {
          return {
            lon: coordinate[0],
            lat: coordinate[1],
          }
        }

        return null
      })
      .filter(
        (point): point is RouteLinePoint => {
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

function hasValidVisitCoordinate(
  visit: DailyVisitStickerVisit
): boolean {
  return (
    typeof visit.lat === 'number' &&
    Number.isFinite(visit.lat) &&
    Math.abs(visit.lat) <= 90 &&
    typeof visit.lon === 'number' &&
    Number.isFinite(visit.lon) &&
    Math.abs(visit.lon) <= 180
  )
}

function hasValidStopCoordinate(
  stop: StickerStop
): stop is StickerStop & {
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

function buildStickerTitle({
  city,
  dateLabel,
}: {
  city: string
  dateLabel: string | null
}) {
  return dateLabel?.trim()
    ? `${city} · ${dateLabel.trim()}`
    : `${city} Day Route`
}

function buildShareText({
  city,
  dateLabel,
  visitCount,
}: {
  city: string
  dateLabel: string | null
  visitCount: number
}) {
  const dateText = dateLabel?.trim()
    ? ` on ${dateLabel.trim()}`
    : ''

  return `I visited ${visitCount} places across ${city}${dateText}.`
}

function buildFileName({
  city,
  date,
}: {
  city: string
  date: string
}) {
  const safeCity =
    slugify(city) || 'city'

  const safeDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : 'day'

  return `roam-${safeCity}-${safeDate}-route-sticker.png`
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

async function waitForFonts() {
  if (
    typeof document !== 'undefined' &&
    'fonts' in document
  ) {
    await document.fonts.ready
  }

  await new Promise((resolve) =>
    window.setTimeout(resolve, 100)
  )
}

function isShareCancellation(
  error: unknown
) {
  return (
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
}