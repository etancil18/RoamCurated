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
  const anchorName = anchorVenue.name ?? 'your starting point'
  const stopCount = stops.length
  const cityLabel = city ?? anchorVenue.city ?? null

  if (collectionTitle && cityLabel) {
    return `${stopCount}-stop Flow from ${collectionTitle} in ${cityLabel}`
  }

  if (collectionTitle) {
    return `${stopCount}-stop Flow from ${collectionTitle}`
  }

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
  const anchorName = anchorVenue.name ?? 'your selected venue'
  const startLabel = startedAt ? ` around ${formatTime(startedAt)}` : ''
  const stageLabels = Array.from(
    new Set(stops.map((stop) => stop.stage?.shortLabel ?? stop.stage?.label).filter(Boolean))
  )

  const routeShape =
    stageLabels.length > 0
      ? `moves through ${formatList(stageLabels as string[])}`
      : 'builds a contextual sequence of nearby stops'

  if (collectionTitle) {
    const collectionLabel = collectionCreatorName
      ? `${collectionCreatorName}'s ${collectionTitle} Collection`
      : `the ${collectionTitle} Collection`

    return `Starting from ${anchorName}${startLabel}, Roam builds from ${collectionLabel} and ${routeShape}, filling contextual gaps when needed while using ${travelMode} distance, timing, venue type, and open-hour fit to keep the Flow coherent.`
  }

  return `Starting from ${anchorName}${startLabel}, Roam ${routeShape}, using ${travelMode} distance, timing, venue type, and open-hour fit to keep the plan coherent.`
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

  const venueTypes = Array.from(
    new Set(
      stops.flatMap((stop) =>
        normalizeVenueTypes(stop.venue).map((type) => formatVenueTypeLabel(type))
      )
    )
  ).slice(0, 5)

  const collectionStopCount = stops.filter(
    (stop) => stop.origin === 'collection'
  ).length

  const roamFillStopCount = stops.filter(
    (stop) => stop.origin === 'roam_fill'
  ).length

  const collectionSourceLabel = collectionTitle
    ? collectionCreatorName
      ? `${collectionCreatorName}'s ${collectionTitle}`
      : collectionTitle
    : null

  return [
    collectionSourceLabel && collectionStopCount > 0
      ? `From ${collectionSourceLabel}: ${formatStopCount(collectionStopCount)}`
      : null,
    collectionTitle && roamFillStopCount > 0
      ? `Added by Roam to complete the Flow: ${formatStopCount(roamFillStopCount)}`
      : null,
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