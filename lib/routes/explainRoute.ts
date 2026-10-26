
// lib/routes/explainRoute.ts

import type { RouteStage } from './routeStages'
import type { VenueScoreReason } from './scoreVenue'
import {
  formatRouteMinutes,
} from './routeUtils'
import {
  formatVenueTypeLabel,
  normalizeVenueTypes,
} from './venueTypeNormalization'
import type { RouteStopOrigin } from '@/types/route'

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
  origin?: RouteStopOrigin
}

export type ExplainRouteParams = {
  anchorVenue: ExplainRouteVenue
  stops: ExplainedRouteStop[]
  startedAt?: Date | string | null
  travelMode?: 'walking' | 'cycling' | 'driving'
  city?: string | null
  collectionTitle?: string | null
  collectionCreatorName?: string | null
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
  origin?: RouteStopOrigin
  provenanceLabel?: string | null
}

export function explainRoute({
  anchorVenue,
  stops,
  startedAt = null,
  travelMode = 'walking',
  city = null,
  collectionTitle = null,
  collectionCreatorName = null,
}: ExplainRouteParams): RouteExplanation {
  const routeStops = stops.filter((stop) => stop?.venue)

  const headline = buildHeadline({
    anchorVenue,
    stops: routeStops,
    city,
    collectionTitle,
  })

  const summary = buildSummary({
    anchorVenue,
    stops: routeStops,
    startedAt,
    travelMode,
    collectionTitle,
    collectionCreatorName,
  })

  const stopExplanations = routeStops.map((stop, index) =>
    explainRouteStop({
      stop,
      index,
      anchorVenue,
      previousStop: index > 0 ? routeStops[index - 1] : null,
      collectionCreatorName,
    })
  )

  const bullets = buildRouteBullets({
    stops: routeStops,
    travelMode,
    collectionTitle,
    collectionCreatorName,
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
  collectionCreatorName = null,
}: {
  stop: ExplainedRouteStop
  index: number
  anchorVenue: ExplainRouteVenue
  previousStop?: ExplainedRouteStop | null
  collectionCreatorName?: string | null
}): RouteStopExplanation {
  const venueName = stop.venue.name ?? `Stop ${index + 1}`
  const stageLabel = stop.stage?.label ?? null

  // Keep the established response shape while avoiding
  // the display of scheduled arrival times.
  const arrivalLabel = null

  const reasonLabels = buildReasonLabels(stop.reasons ?? [])

  const previousName =
    previousStop?.venue?.name ?? anchorVenue.name ?? 'your starting point'

  const stagePhrase = stageLabel
    ? `It fits the ${stageLabel.toLowerCase()} moment`
    : 'It fits the next part of the route'

  const distanceText = formatExplanationMiles(
    stop.distanceMetersFromPrevious
  )

  const travelText = formatRouteMinutes(
    stop.travelMinutesFromPrevious
  )

  const movementPhrase =
    distanceText && travelText
      ? `and keeps the move from ${previousName} manageable at about ${distanceText} / ${travelText}`
      : `after ${previousName}`

  const bestReason = pickBestReason(stop.reasons ?? [])
  const provenanceLabel = buildProvenanceLabel({
    origin: stop.origin,
    collectionCreatorName,
  })

  const explanation = [
    `${venueName} was selected because ${stagePhrase}`,
    movementPhrase,
    bestReason ? `with an extra boost because ${bestReason.toLowerCase()}` : null,
    stop.origin === 'collection'
      ? collectionCreatorName
        ? `and comes directly from ${collectionCreatorName}'s Collection`
        : 'and comes directly from the Collection'
      : stop.origin === 'roam_fill'
        ? 'and was added by Roam to complete the Flow'
        : null,
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
    ...(stop.origin ? { origin: stop.origin } : {}),
    ...(provenanceLabel ? { provenanceLabel } : {}),
  }
}

export function buildHeadline({
  anchorVenue,
  stops,
  city,
  collectionTitle = null,
}: {
  anchorVenue: ExplainRouteVenue
  stops: ExplainedRouteStop[]
  city?: string | null
  collectionTitle?: string | null
}) {
  // Preserve the exported function and return type
  // without displaying route titles.
  void anchorVenue
  void stops
  void city
  void collectionTitle

  return ''
}

export function buildSummary({
  anchorVenue,
  stops,
  startedAt,
  travelMode,
  collectionTitle = null,
  collectionCreatorName = null,
}: {
  anchorVenue: ExplainRouteVenue
  stops: ExplainedRouteStop[]
  startedAt?: Date | string | null
  travelMode: 'walking' | 'cycling' | 'driving'
  collectionTitle?: string | null
  collectionCreatorName?: string | null
}) {
  // The overview uses route bullets instead of
  // a narrative or potentially misleading start time.
  // Preserve the function signature for callers.
  void anchorVenue
  void stops
  void startedAt
  void travelMode
  void collectionTitle
  void collectionCreatorName

  return ''
}

export function buildRouteBullets({
  stops,
  travelMode,
  collectionTitle = null,
  collectionCreatorName = null,
}: {
  stops: ExplainedRouteStop[]
  travelMode: 'walking' | 'cycling' | 'driving'
  collectionTitle?: string | null
  collectionCreatorName?: string | null
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

  // Keep parameters for backward-compatible callers.
  void collectionTitle
  void collectionCreatorName

  return [
    totalTravelMinutes > 0
      ? `Estimated ${travelMode} time: ${formatRouteMinutes(totalTravelMinutes)}`
      : null,
    totalDistanceMeters > 0
      ? `Estimated distance: ${formatExplanationMiles(totalDistanceMeters)}`
      : null,
  ].filter((item): item is string => Boolean(item))
}

/**
 * Present route distances in miles without changing
 * the underlying meter-based route calculations.
 */
function formatExplanationMiles(
  meters: number | null | undefined
): string | null {
  if (
    typeof meters !== 'number' ||
    !Number.isFinite(meters) ||
    meters < 0
  ) {
    return null
  }

  const miles = meters / 1609.344

  if (miles > 0 && miles < 0.05) {
    return 'Under 0.1 mi'
  }

  return `${miles.toFixed(1)} mi`
}

function buildProvenanceLabel({
  origin,
  collectionCreatorName,
}: {
  origin?: RouteStopOrigin
  collectionCreatorName?: string | null
}) {
  if (origin === 'collection') {
    return collectionCreatorName
      ? `From ${collectionCreatorName}'s Collection`
      : 'From the Collection'
  }

  if (origin === 'roam_fill') {
    return 'Added by Roam to complete the Flow'
  }

  return null
}

function formatStopCount(count: number) {
  return `${count} ${count === 1 ? 'stop' : 'stops'}`
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
