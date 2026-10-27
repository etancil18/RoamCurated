
// app/api/generate-from-venue/route.ts

import { NextRequest, NextResponse } from 'next/server'

import {
  generateFromVenue,
  type GenerateRouteFromVenueRequestWithRetry,
} from '@/lib/server/flows/generateFromVenue'

import {
  toPublicGenerateRouteFromVenueResponse,
} from '@/lib/server/flows/toPublicGeneratedRoute'

import type {
  GenerateRouteFromVenueResponse,
} from '@/types/route'

export const dynamic = 'force-dynamic'

/**
 * RoamCurated — Generate Flow from Venue
 *
 * HTTP boundary only.
 *
 * The server-only engine is responsible for:
 * - Supabase queries and user personalization
 * - Route context and stage progression
 * - Candidate filtering and scoring
 * - Contextual constraints and venue suitability
 * - Timeline construction and validation
 * - Route explanations and diagnostics
 *
 * This adapter preserves the existing endpoint URL,
 * request parsing behavior, response shape and statuses.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | GenerateRouteFromVenueRequestWithRetry
      | null

    const result = await generateFromVenue(body)

    return NextResponse.json(
      toPublicGenerateRouteFromVenueResponse(result.response),
      { status: result.status }
    )
  } catch (error) {
    console.error(
      'generate-from-venue error:',
      error
    )

    return NextResponse.json(
      {
        route: null,
        error: 'Failed to generate route from venue',
      } satisfies GenerateRouteFromVenueResponse,
      { status: 500 }
    )
  }
}
