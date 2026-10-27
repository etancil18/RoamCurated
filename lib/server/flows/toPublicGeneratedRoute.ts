// lib/server/flows/toPublicGeneratedRoute.ts

import 'server-only'

import type {
  GeneratedRoute,
  GenerateRouteFromVenueResponse,
  RouteGenerationSource,
  RouteGenerationStatus,
  RouteTravelMode,
  RouteTightness,
} from '@/types/route'

/* =========================================================
 * PUBLIC FLOW RESPONSE
 *
 * This module is the explicit security boundary between
 * the internal Flow engine and the browser.
 *
 * Do not:
 * - Spread internal route, stop, or venue objects.
 * - Return scoring data or internal reasons.
 * - Return engine diagnostics.
 * - Return raw Supabase records.
 * - Add fields without reviewing their public necessity.
 *
 * The engine itself remains unchanged.
 * ======================================================= */

export type PublicGeneratedFlowVenue = {
  id: string
  name: string
  slug: string | null
  city: string | null
  address: string | null
  lat: number
  lon: number
}

export type PublicGeneratedFlowStop = {
  venue: PublicGeneratedFlowVenue
}

export type PublicGeneratedFlowContext = {
  anchorVenueId: string
  anchorVenueName: string
  city: string | null
  plannedStartAt: string
  travelMode: RouteTravelMode
  tightness: RouteTightness
  maxStops: number
}

export type PublicGeneratedFlowExplanation = {
  headline: string
  summary: string
  bullets: string[]
}

export type PublicGeneratedFlow = {
  status: RouteGenerationStatus
  source: RouteGenerationSource
  context: PublicGeneratedFlowContext
  anchorVenue: Pick<
    PublicGeneratedFlowVenue,
    'id' | 'name' | 'slug' | 'city'
  >
  stops: PublicGeneratedFlowStop[]
  explanation: PublicGeneratedFlowExplanation
  totalStops: number
}

export type PublicGenerateRouteFromVenueResponse = {
  route: PublicGeneratedFlow | null
  error: string | null
}

/* =========================================================
 * VENUE ALLOWLIST
 *
 * Explicit construction is intentional.
 *
 * The internal normalizeRouteVenue() currently preserves
 * source columns using object spreading. This mapper
 * prevents those additional columns from crossing the
 * browser-facing API boundary.
 * ======================================================= */

function toPublicVenue(
  venue: GeneratedRoute['anchorVenue']
): PublicGeneratedFlowVenue {
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug ?? null,
    city: venue.city ?? null,
    address: venue.address ?? null,
    lat: venue.lat,
    lon: venue.lon,
  }
}

/* =========================================================
 * PUBLIC ROUTE MAPPER
 *
 * This is a pure projection:
 *
 * - No database access.
 * - No score recalculation.
 * - No route regeneration.
 * - No venue selection changes.
 * - No timeline modifications.
 *
 * Only explicitly permitted values are returned.
 * ======================================================= */

export function toPublicGeneratedRoute(
  route: GeneratedRoute
): PublicGeneratedFlow {
  return {
    status: route.status,
    source: route.source,

    context: {
      anchorVenueId: route.context.anchorVenueId,
      anchorVenueName: route.context.anchorVenueName,
      city: route.context.city,
      plannedStartAt: route.context.plannedStartAt,
      travelMode: route.context.travelMode,
      tightness: route.context.tightness,
      maxStops: route.context.maxStops,
    },

    anchorVenue: {
      id: route.anchorVenue.id,
      name: route.anchorVenue.name,
      slug: route.anchorVenue.slug ?? null,
      city: route.anchorVenue.city ?? null,
    },

    stops: route.stops.map((stop) => ({
      venue: toPublicVenue(stop.venue),
    })),

    explanation: {
      headline: route.explanation.headline,
      summary: route.explanation.summary,
      bullets: [...route.explanation.bullets],
    },

    totalStops: route.totalStops,
  }
}

/* =========================================================
 * PUBLIC API RESPONSE MAPPER
 *
 * The original API response shape remains:
 *
 * {
 *   route: ... | null,
 *   error: string | null
 * }
 *
 * The route contents are restricted to public fields.
 * Errors are preserved exactly.
 * ======================================================= */

export function toPublicGenerateRouteFromVenueResponse(
  response: GenerateRouteFromVenueResponse
): PublicGenerateRouteFromVenueResponse {
  return {
    route: response.route
      ? toPublicGeneratedRoute(response.route)
      : null,
    error: response.error ?? null,
  }
}