
/**
 * lib/server/flows/toPublicGeneratedRoute.test.ts
 *
 * RoamCurated — Public Generated Flow Security Tests
 *
 * PURPOSE
 * -------
 * Verify that the server-side public response mapper:
 *
 * 1. Preserves the browser-facing Flow contract.
 * 2. Never exposes proprietary engine scoring.
 * 3. Never exposes candidate evaluation diagnostics.
 * 4. Never exposes personalization scoring details.
 * 5. Never leaks additional Supabase venue columns.
 * 6. Handles success, failed, and null-route responses.
 * 7. Does not mutate the internal GeneratedRoute.
 *
 * These tests deliberately inject sensitive information
 * into the internal route to catch accidental leakage.
 *
 * The tests do not execute route generation, access
 * Supabase, or modify the existing Flow algorithm.
 */

import { describe, expect, it, vi } from 'vitest'

import type {
  GeneratedRoute,
  GenerateRouteFromVenueResponse,
} from '@/types/route'

/**
 * The mapper uses `import 'server-only'`.
 *
 * Mock that marker for the test environment.
 * The production server-only boundary remains intact.
 */
vi.mock('server-only', () => ({}))

import {
  toPublicGeneratedRoute,
  toPublicGenerateRouteFromVenueResponse,
} from './toPublicGeneratedRoute'

/* =========================================================
 * TEST FIXTURE
 * ======================================================= */

function createInternalRoute(): GeneratedRoute {
  const anchorVenue = {
    id: 'venue-5church',
    name: '5Church Midtown',
    slug: '5church-midtown',
    city: 'atl',
    address: 'Midtown Atlanta',
    lat: 33.7870834,
    lon: -84.3828185,

    // Fields deliberately intended to stay internal.
    internal_quality_rating: 91,
    unpublished_editorial_notes: 'Private curator notes',
    private_supplier_reference: 'supplier-secret-123',
  }

  const dinnerVenue = {
    id: 'venue-holeman-finch',
    name: 'Holeman and Finch',
    slug: 'holeman-and-finch',
    city: 'atl',
    address: 'Midtown Atlanta',
    lat: 33.783,
    lon: -84.383,

    internal_quality_rating: 97,
    unpublished_editorial_notes: 'Private dinner assessment',
    private_supplier_reference: 'supplier-secret-456',
  }

  const cocktailVenue = {
    id: 'venue-bar-margot',
    name: 'Bar Margot',
    slug: 'bar-margot',
    city: 'atl',
    address: 'Midtown Atlanta',
    lat: 33.785,
    lon: -84.382,

    internal_quality_rating: 96,
    unpublished_editorial_notes: 'Private cocktail assessment',
    private_supplier_reference: 'supplier-secret-789',
  }

  return {
    status: 'success',
    source: 'map_marker',

    context: {
      anchorVenueId: anchorVenue.id,
      anchorVenueName: anchorVenue.name,
      anchorTypes: ['restaurant'],
      city: 'atl',
      plannedStartAt: '2026-10-26T22:32:46.558Z',
      weekdayKey: 'mon',
      localHour: 18,
      travelMode: 'walking',
      tightness: 'medium',
      maxStops: 5,
      maxDistanceMeters: 1609,
      idealDistanceMeters: 500,
      startingStageId: 'early_evening',
      candidateStageIds: ['dinner', 'night_out'],
      source: 'map_marker',

      // These are valid internal context fields but
      // are not needed by the public map interface.
      variationSeed: 'private-seed-123',
      excludedVenueIds: ['excluded-venue-1'],
    },

    anchorVenue,

    stops: [
      {
        id: 'stop-anchor',
        stopOrder: 1,
        venue: anchorVenue,
        stageId: 'early_evening',
        stageLabel: 'Early Evening',
        arriveAt: '2026-10-26T22:32:46.558Z',
        departAt: '2026-10-26T23:37:46.558Z',
        dwellMinutes: 65,
        travelMinutesFromPrevious: null,
        distanceMetersFromPrevious: null,
        score: 100,
        normalizedScore: 100,
        openConfidence: 'unknown',
        candidateTypes: ['restaurant'],
        reasons: [],
        personalizationReasons: [],
      },
      {
        id: 'stop-dinner',
        stopOrder: 2,
        venue: dinnerVenue,
        stageId: 'dinner',
        stageLabel: 'Dinner',
        arriveAt: '2026-10-26T23:45:46.558Z',
        departAt: '2026-10-27T01:30:46.558Z',
        dwellMinutes: 105,
        travelMinutesFromPrevious: 8,
        distanceMetersFromPrevious: 200,
        score: 187,
        normalizedScore: 100,
        openConfidence: 'confirmed_open',
        candidateTypes: ['dinner', 'restaurant'],
        reasons: [
          {
            key: 'stage_fit',
            label: 'Fits the dinner stage',
            delta: 52,
          },
        ],
        personalizationReasons: [],
      },
      {
        id: 'stop-cocktails',
        stopOrder: 3,
        venue: cocktailVenue,
        stageId: 'night_out',
        stageLabel: 'Night Out',
        arriveAt: '2026-10-27T01:35:46.558Z',
        departAt: '2026-10-27T02:40:46.558Z',
        dwellMinutes: 65,
        travelMinutesFromPrevious: 5,
        distanceMetersFromPrevious: 137,
        score: 205,
        normalizedScore: 100,
        openConfidence: 'confirmed_open',
        candidateTypes: ['cocktail', 'bar'],
        reasons: [
          {
            key: 'stage_fit',
            label: 'Fits the night stage',
            delta: 52,
          },
          {
            key: 'category_progression',
            label: 'Natural progression',
            delta: 16,
          },
        ],
        personalizationReasons: [],
      },
    ],

    explanation: {
      headline: 'A curated Midtown evening',
      summary: 'Start with drinks, enjoy dinner, then finish with cocktails.',
      bullets: [
        'Distinct experiences',
        'Comfortable walking distances',
      ],
      stopExplanations: [
        {
          venueId: dinnerVenue.id,
          venueName: dinnerVenue.name,
          stageLabel: 'Dinner',
          arrivalLabel: '7:45 PM',
          explanation: 'A natural dinner stop.',
          reasonLabels: ['Strong stage fit'],
        },
      ],
    },

    totalStops: 3,
    totalDistanceMeters: 337,
    totalTravelMinutes: 13,
    totalDwellMinutes: 235,
    totalRouteMinutes: 248,
    createdAt: '2026-10-26T22:17:52.184Z',

    debug: {
      rejectedCount: 2102,
      candidateCount: 70,
      selectedCount: 2,
      warnings: [],
      stageAttempts: [
        {
          stageId: 'dinner',
          stageLabel: 'Dinner',
          candidateCount: 35,
          selectedVenueId: dinnerVenue.id,
          selectedVenueName: dinnerVenue.name,
          selectedPass: 'strict',
          passes: [
            {
              pass: 'strict',
              candidateCount: 35,
              rejectedCount: 200,
              topScore: 187,
              topVenueId: dinnerVenue.id,
              topVenueName: dinnerVenue.name,
            },
          ],
        },
      ],
    },
  }
}

/* =========================================================
 * CONTRACT TESTS
 * ======================================================= */

describe('toPublicGeneratedRoute', () => {
  it('preserves the required public Flow fields', () => {
    const internal = createInternalRoute()

    const result = toPublicGeneratedRoute(internal)

    expect(result).toEqual({
      status: 'success',
      source: 'map_marker',

      context: {
        anchorVenueId: 'venue-5church',
        anchorVenueName: '5Church Midtown',
        city: 'atl',
        plannedStartAt: '2026-10-26T22:32:46.558Z',
        travelMode: 'walking',
        tightness: 'medium',
        maxStops: 5,
      },

      anchorVenue: {
        id: 'venue-5church',
        name: '5Church Midtown',
        slug: '5church-midtown',
        city: 'atl',
      },

      stops: [
        {
          venue: {
            id: 'venue-5church',
            name: '5Church Midtown',
            slug: '5church-midtown',
            city: 'atl',
            address: 'Midtown Atlanta',
            lat: 33.7870834,
            lon: -84.3828185,
          },
        },
        {
          venue: {
            id: 'venue-holeman-finch',
            name: 'Holeman and Finch',
            slug: 'holeman-and-finch',
            city: 'atl',
            address: 'Midtown Atlanta',
            lat: 33.783,
            lon: -84.383,
          },
        },
        {
          venue: {
            id: 'venue-bar-margot',
            name: 'Bar Margot',
            slug: 'bar-margot',
            city: 'atl',
            address: 'Midtown Atlanta',
            lat: 33.785,
            lon: -84.382,
          },
        },
      ],

      explanation: {
        headline: 'A curated Midtown evening',
        summary: 'Start with drinks, enjoy dinner, then finish with cocktails.',
        bullets: [
          'Distinct experiences',
          'Comfortable walking distances',
        ],
      },

      totalStops: 3,
    })
  })

  it('preserves stop order for MapCanvas and MapWrapper', () => {
    const result = toPublicGeneratedRoute(
      createInternalRoute()
    )

    expect(
      result.stops.map((stop) => stop.venue.id)
    ).toEqual([
      'venue-5church',
      'venue-holeman-finch',
      'venue-bar-margot',
    ])
  })

  it('preserves the retry context', () => {
    const result = toPublicGeneratedRoute(
      createInternalRoute()
    )

    expect(result.source).toBe('map_marker')
    expect(result.context.anchorVenueId).toBe('venue-5church')
    expect(result.context.plannedStartAt).toBe(
      '2026-10-26T22:32:46.558Z'
    )
    expect(result.context.travelMode).toBe('walking')
    expect(result.context.tightness).toBe('medium')
    expect(result.context.maxStops).toBe(5)

    expect(result.anchorVenue).toEqual({
      id: 'venue-5church',
      name: '5Church Midtown',
      slug: '5church-midtown',
      city: 'atl',
    })
  })

  /* =====================================================
   * PROPRIETARY DATA SECURITY TESTS
   * =================================================== */

  it('never exposes engine scoring or diagnostics', () => {
    const internal = createInternalRoute()

    const result = toPublicGeneratedRoute(internal)

    const serialized = JSON.stringify(result)

    const forbiddenKeys = [
      '"debug"',
      '"score"',
      '"normalizedScore"',
      '"reasons"',
      '"personalizationReasons"',
      '"candidateTypes"',
      '"openConfidence"',
      '"stageAttempts"',
      '"candidateCount"',
      '"rejectedCount"',
      '"selectedCount"',
      '"rejectionCounts"',
      '"topScore"',
      '"directionPenalty"',
      '"scoreAdjustment"',
      '"retrySeed"',
      '"variationSeed"',
      '"excludedVenueIds"',
      '"createdAt"',
      '"stopExplanations"',
    ]

    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key)
    }
  })

  it('never exposes additional internal venue database columns', () => {
    const result = toPublicGeneratedRoute(
      createInternalRoute()
    )

    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('internal_quality_rating')
    expect(serialized).not.toContain('unpublished_editorial_notes')
    expect(serialized).not.toContain('private_supplier_reference')

    expect(serialized).not.toContain('supplier-secret-123')
    expect(serialized).not.toContain('supplier-secret-456')
    expect(serialized).not.toContain('supplier-secret-789')
  })

  it('does not leak newly introduced internal properties', () => {
    const internal = createInternalRoute()

    const enriched = internal as GeneratedRoute &
      Record<string, unknown>

    enriched.experimentalCandidateScores = [
      { venueId: 'venue-secret', score: 9999 },
    ]

    enriched.privateSelectionStrategy =
      'confidential-selection-logic'

    const result = toPublicGeneratedRoute(internal)

    expect(result).not.toHaveProperty(
      'experimentalCandidateScores'
    )

    expect(result).not.toHaveProperty(
      'privateSelectionStrategy'
    )

    expect(JSON.stringify(result)).not.toContain(
      'confidential-selection-logic'
    )
  })

  it('does not mutate the original internal route', () => {
    const internal = createInternalRoute()

    const before = structuredClone(internal)

    toPublicGeneratedRoute(internal)

    expect(internal).toEqual(before)
    expect(internal.debug?.candidateCount).toBe(70)
    expect(internal.stops[1].score).toBe(187)
  })

  it('creates independently owned public arrays', () => {
    const internal = createInternalRoute()

    const result = toPublicGeneratedRoute(internal)

    expect(result.stops).not.toBe(internal.stops)
    expect(result.explanation.bullets).not.toBe(
      internal.explanation.bullets
    )

    expect(result.stops[0].venue).not.toBe(
      internal.stops[0].venue
    )
  })

  /* =====================================================
   * NULLABILITY / EDGE CASE TESTS
   * =================================================== */

  it('normalizes optional venue fields to null', () => {
    const internal = createInternalRoute()

    internal.anchorVenue.slug = undefined
    internal.anchorVenue.city = undefined

    internal.stops[0].venue.slug = undefined
    internal.stops[0].venue.city = undefined
    internal.stops[0].venue.address = undefined

    const result = toPublicGeneratedRoute(internal)

    expect(result.anchorVenue.slug).toBeNull()
    expect(result.anchorVenue.city).toBeNull()

    expect(result.stops[0].venue.slug).toBeNull()
    expect(result.stops[0].venue.city).toBeNull()
    expect(result.stops[0].venue.address).toBeNull()
  })

  it('preserves failed route status without exposing diagnostics', () => {
    const internal = createInternalRoute()

    internal.status = 'failed'

    const result = toPublicGeneratedRoute(internal)

    expect(result.status).toBe('failed')
    expect(result).not.toHaveProperty('debug')
    expect(result.stops).toHaveLength(3)
  })
})

/* =========================================================
 * API RESPONSE TESTS
 * ======================================================= */

describe('toPublicGenerateRouteFromVenueResponse', () => {
  it('maps a successful API response', () => {
    const response: GenerateRouteFromVenueResponse = {
      route: createInternalRoute(),
      error: null,
    }

    const result =
      toPublicGenerateRouteFromVenueResponse(response)

    expect(result.error).toBeNull()
    expect(result.route?.totalStops).toBe(3)
    expect(result.route).not.toHaveProperty('debug')
  })

  it('preserves a failed response with no route', () => {
    const response: GenerateRouteFromVenueResponse = {
      route: null,
      error: 'Starting venue not found',
    }

    const result =
      toPublicGenerateRouteFromVenueResponse(response)

    expect(result).toEqual({
      route: null,
      error: 'Starting venue not found',
    })
  })

  it('normalizes an omitted error to null', () => {
    const response: GenerateRouteFromVenueResponse = {
      route: null,
    }

    const result =
      toPublicGenerateRouteFromVenueResponse(response)

    expect(result).toEqual({
      route: null,
      error: null,
    })
  })

  it('does not expose a debug property even if sent at runtime', () => {
    const response = {
      route: createInternalRoute(),
      error: null,
      debug: {
        candidateCount: 9999,
        privateKey: 'hidden-debug-payload',
      },
    } as GenerateRouteFromVenueResponse

    const result =
      toPublicGenerateRouteFromVenueResponse(response)

    expect(result).not.toHaveProperty('debug')

    expect(JSON.stringify(result)).not.toContain(
      'hidden-debug-payload'
    )
  })
})
