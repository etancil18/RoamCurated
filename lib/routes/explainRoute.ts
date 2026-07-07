// lib/routes/explainRoute.ts

import type { RouteStage } from './routeStages'
import type { VenueScoreReason } from './scoreVenue'
import {
  formatRouteDistance,
  formatRouteMinutes,
} from './routeUtils'
import {
  formatVenueTypeLabel,
  normalizeVenueTypes,
} from './venueTypeNormalization'

export type ExplainRouteVenue = {
  id?: string | null
  name?: string | null
  city?: string | null
  lat?: number | null
  lon?: number | null
  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown
  tags?: unknown
  vibe?: unknown
  price?: string | null
}

export type ExplainedRouteStop = {
  venue: ExplainRouteVenue
  stage?: RouteStage | null
  arriveAt?: Date | string | null
  departAt?: Date | string | null
  dwellMinutes?: number | null
  travelMinutesFromPrevious?: number | null
  distanceMetersFromPrevious?: number | null
  score?: number | null
  reasons?: VenueScoreReason[]
}

export type ExplainRouteParams = {
  anchorVenue: ExplainRouteVenue
  stops: ExplainedRouteStop[]
  startedAt?: Date | string | null
  travelMode?: 'walking' | 'cycling' | 'driving'
  city?: string | null
}

export type RouteExplanation = {
  headline: string
  summary: string
  stopExplanations: RouteStopExplanation[]
  bullets: string[]
}

export type RouteStopExplanation = {
  venueId: string | null
  venueName: string
  stageLabel: string | null
  arrivalLabel: string | null
  explanation: string
  reasonLabels: string[]
}

export function explainRoute({
  anchorVenue,
  stops,
  startedAt = null,
  travelMode = 'walking',
  city = null,
}: ExplainRouteParams): RouteExplanation {
  const routeStops = stops.filter((stop) => stop?.venue)

  const headline = buildHeadline({
    anchorVenue,
    stops: routeStops,
    city,
  })

  const summary = buildSummary({
    anchorVenue,
    stops: routeStops,
    startedAt,
    travelMode,
  })

  const stopExplanations = routeStops.map((stop, index) =>
    explainRouteStop({
      stop,
      index,
      anchorVenue,
      previousStop: index > 0 ? routeStops[index - 1] : null,
    })
  )

  const bullets = buildRouteBullets({
    stops: routeStops,
    travelMode,
  })

  return {
    headline,
    summary,
    stopExplanations,
    bullets,
  }
}

export function explainRouteStop({
  stop,
  index,
  anchorVenue,
  previousStop = null,
}: {
  stop: ExplainedRouteStop
  index: number
  anchorVenue: ExplainRouteVenue
  previousStop?: ExplainedRouteStop | null
}): RouteStopExplanation {
  const venueName = stop.venue.name ?? `Stop ${index + 1}`
  const stageLabel = stop.stage?.label ?? null
  const arrivalLabel = stop.arriveAt ? formatTime(stop.arriveAt) : null
  const reasonLabels = buildReasonLabels(stop.reasons ?? [])

  const previousName =
    previousStop?.venue?.name ?? anchorVenue.name ?? 'your starting point'

  const stagePhrase = stageLabel
    ? `It fits the ${stageLabel.toLowerCase()} moment`
    : 'It fits the next part of the route'

  const distanceText = formatRouteDistance(stop.distanceMetersFromPrevious)
  const travelText = formatRouteMinutes(stop.travelMinutesFromPrevious)

  const movementPhrase =
    distanceText && travelText
      ? `and keeps the move from ${previousName} manageable at about ${distanceText} / ${travelText}`
      : `after ${previousName}`

  const bestReason = pickBestReason(stop.reasons ?? [])

  const explanation = [
    `${venueName} was selected because ${stagePhrase}`,
    movementPhrase,
    bestReason ? `with an extra boost because ${bestReason.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*$/, '') + '.'

  return {
    venueId: stop.venue.id ?? null,
    venueName,
    stageLabel,
    arrivalLabel,
    explanation,
    reasonLabels,
  }
}

export function buildHeadline({
  anchorVenue,
  stops,
  city,
}: {
  anchorVenue: ExplainRouteVenue
  stops: ExplainedRouteStop[]
  city?: string | null
}) {
  const anchorName = anchorVenue.name ?? 'your starting point'
  const stopCount = stops.length
  const cityLabel = city ?? anchorVenue.city ?? null

  if (cityLabel) {
    return `${stopCount}-stop route from ${anchorName} in ${cityLabel}`
  }

  return `${stopCount}-stop route from ${anchorName}`
}

export function buildSummary({
  anchorVenue,
  stops,
  startedAt,
  travelMode,
}: {
  anchorVenue: ExplainRouteVenue
  stops: ExplainedRouteStop[]
  startedAt?: Date | string | null
  travelMode: 'walking' | 'cycling' | 'driving'
}) {
  const anchorName = anchorVenue.name ?? 'your selected venue'
  const startLabel = startedAt ? ` around ${formatTime(startedAt)}` : ''
  const stageLabels = Array.from(
    new Set(stops.map((stop) => stop.stage?.shortLabel ?? stop.stage?.label).filter(Boolean))
  )

  const routeShape =
    stageLabels.length > 0
      ? `moves through ${formatList(stageLabels as string[])}`
      : 'builds a contextual sequence of nearby stops'

  return `Starting from ${anchorName}${startLabel}, Roam ${routeShape}, using ${travelMode} distance, timing, venue type, and open-hour fit to keep the plan coherent.`
}

export function buildRouteBullets({
  stops,
  travelMode,
}: {
  stops: ExplainedRouteStop[]
  travelMode: 'walking' | 'cycling' | 'driving'
}) {
  const totalTravelMinutes = stops.reduce((sum, stop) => {
    return sum + (typeof stop.travelMinutesFromPrevious === 'number' ? stop.travelMinutesFromPrevious : 0)
  }, 0)

  const totalDistanceMeters = stops.reduce((sum, stop) => {
    return sum + (typeof stop.distanceMetersFromPrevious === 'number' ? stop.distanceMetersFromPrevious : 0)
  }, 0)

  const stageLabels = Array.from(
    new Set(stops.map((stop) => stop.stage?.shortLabel ?? stop.stage?.label).filter(Boolean))
  ) as string[]

  const venueTypes = Array.from(
    new Set(
      stops.flatMap((stop) =>
        normalizeVenueTypes(stop.venue).map((type) => formatVenueTypeLabel(type))
      )
    )
  ).slice(0, 5)

  return [
    stageLabels.length > 0
      ? `Route rhythm: ${formatList(stageLabels)}`
      : null,
    totalTravelMinutes > 0
      ? `Estimated ${travelMode} time: ${formatRouteMinutes(totalTravelMinutes)}`
      : null,
    totalDistanceMeters > 0
      ? `Estimated distance: ${formatRouteDistance(totalDistanceMeters)}`
      : null,
    venueTypes.length > 0
      ? `Venue mix: ${formatList(venueTypes)}`
      : null,
  ].filter((item): item is string => Boolean(item))
}

function buildReasonLabels(reasons: VenueScoreReason[]) {
  return reasons
    .filter((reason) => reason.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((reason) => reason.label)
}

function pickBestReason(reasons: VenueScoreReason[]) {
  return reasons
    .filter((reason) => reason.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0]?.label ?? null
}

function formatTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatList(values: string[]) {
  const cleaned = values.filter(Boolean)

  if (cleaned.length === 0) return ''
  if (cleaned.length === 1) return cleaned[0]
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`

  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`
}