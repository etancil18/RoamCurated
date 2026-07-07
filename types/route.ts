// types/route.ts

import type { RouteStage, RouteStageId } from '@/lib/routes/routeStages'
import type { NormalizedVenueType } from '@/lib/routes/venueTypeNormalization'
import type { OpenConfidence, VenueScoreReason } from '@/lib/routes/scoreVenue'
import type { PersonalizationReason } from '@/lib/routes/personalization'

export type RouteTravelMode = 'walking' | 'cycling' | 'driving'
export type RouteTightness = 'tight' | 'medium' | 'loose'

export type RouteGenerationSource =
  | 'map_marker'
  | 'property_guide'
  | 'venue_profile'
  | 'active_flow'
  | 'planned_outing'
  | 'api'

export type RouteGenerationStatus =
  | 'success'
  | 'partial'
  | 'failed'

export type RouteVenue = {
  id: string
  name: string
  slug?: string | null
  city?: string | null
  address?: string | null
  lat: number
  lon: number
  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown
  tags?: unknown
  vibe?: unknown
  price?: string | null
  hours?: unknown
  dayParts?: Record<string, string> | null
  image_url?: string | null
  link?: string | null
}

export type RouteContext = {
  anchorVenueId: string
  anchorVenueName: string
  anchorTypes: NormalizedVenueType[]
  city: string | null
  plannedStartAt: string
  weekdayKey: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  localHour: number
  travelMode: RouteTravelMode
  tightness: RouteTightness
  maxStops: number
  maxDistanceMeters: number
  idealDistanceMeters: number
  startingStageId: RouteStageId
  candidateStageIds: RouteStageId[]
  source: RouteGenerationSource
}

export type RouteCandidate = {
  venue: RouteVenue
  stage: RouteStage
  score: number
  normalizedScore: number
  personalizedScore?: number
  reasons: VenueScoreReason[]
  personalizationReasons?: PersonalizationReason[]
  candidateTypes: NormalizedVenueType[]
  openConfidence: OpenConfidence
  distanceMeters: number | null
  estimatedTravelMinutes: number | null
  arrivalEstimate?: RouteArrivalEstimate | null
}

export type RouteArrivalEstimate = {
  departAt: string
  arriveAt: string
  dwellMinutes: number
  travelMinutes: number
  distanceMeters: number | null
  travelMode: RouteTravelMode
}

export type RouteStop = {
  id: string
  stopOrder: number
  venue: RouteVenue
  stageId: RouteStageId
  stageLabel: string
  arriveAt: string | null
  departAt: string | null
  dwellMinutes: number
  travelMinutesFromPrevious: number | null
  distanceMetersFromPrevious: number | null
  score: number
  normalizedScore: number
  openConfidence: OpenConfidence
  candidateTypes: NormalizedVenueType[]
  reasons: VenueScoreReason[]
  personalizationReasons?: PersonalizationReason[]
}

export type RouteExplanationStop = {
  venueId: string | null
  venueName: string
  stageLabel: string | null
  arrivalLabel: string | null
  explanation: string
  reasonLabels: string[]
}

export type RouteExplanation = {
  headline: string
  summary: string
  bullets: string[]
  stopExplanations: RouteExplanationStop[]
}

export type GeneratedRoute = {
  id?: string
  status: RouteGenerationStatus
  source: RouteGenerationSource
  context: RouteContext
  anchorVenue: RouteVenue
  stops: RouteStop[]
  explanation: RouteExplanation
  totalStops: number
  totalDistanceMeters: number
  totalTravelMinutes: number
  totalDwellMinutes: number
  totalRouteMinutes: number
  createdAt: string
  debug?: RouteGenerationDebug | undefined
}

export type RouteGenerationDebug = {
  rejectedCount?: number
  candidateCount?: number
  selectedCount?: number
  stageAttempts?: Array<{
    stageId: RouteStageId
    stageLabel: string
    candidateCount: number
    selectedVenueId?: string | null
    selectedVenueName?: string | null
  }>
  warnings?: string[]
}

export type GenerateRouteFromVenueRequest = {
  venueId: string
  city?: string | null
  plannedStartAt?: string | null
  travelMode?: RouteTravelMode
  tightness?: RouteTightness
  maxStops?: number
  source?: RouteGenerationSource
  preferredVibes?: string[]
  preferredTags?: string[]
}

export type GenerateRouteFromVenueResponse = {
  route: GeneratedRoute | null
  error?: string | null
}