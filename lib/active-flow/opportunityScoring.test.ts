import {
  describe,
  expect,
  it,
} from 'vitest'

import type {
  ActiveFlowOpportunityCandidate,
  ActiveFlowOpportunityContext,
  ActiveFlowOpportunityRuntimeStop,
} from '@/lib/active-flow/opportunityCandidates'

import {
  MAX_INCREMENTAL_DISTANCE_METERS_BY_TRAVEL_MODE,
  scoreActiveFlowOpportunity,
} from '@/lib/active-flow/opportunityScoring'


/**
 * 013C — deterministic scorer boundary verification
 *
 * These tests exercise only the pure opportunity scorer.
 *
 * They deliberately do NOT:
 * - establish Community Signal trust
 * - read or write the database
 * - mutate an Active Flow
 * - create visits / participation / interest
 * - perform Detour / Swap / Reroute
 *
 * Production runtime verification separately proves the
 * 010C → 012B → 013B → 013C integration path.
 */


const AS_OF =
  '2026-09-29T16:00:00.000Z'


function createRuntimeStop({
  id,
  venueId,
  position,
  lat,
  lon,
}: {
  id: string
  venueId: string
  position: number
  lat: number
  lon: number
}): ActiveFlowOpportunityRuntimeStop {
  return {
    id,
    venueId,
    position,

    /**
     * 016C — these fixtures represent ordinary base-route stops.
     *
     * With no Detour present, canonical execution order is identical
     * to the immutable base-route position.
     */
    executionIndex: position,
    kind: 'base',
    beforeFlowStopId: null,

    status: 'planned',
    origin: 'original',
    originalStopId: null,
    completed: false,

    venue: {
      id: venueId,
      name: venueId,
      lat,
      lon,
    },
  }
}


describe(
  'scoreActiveFlowOpportunity',
  () => {
    it(
      'rejects a temporally relevant walking opportunity when incremental route cost exceeds the walking threshold',
      () => {
        /**
         * Geometry is intentionally simple.
         *
         * Current stop:
         *   (0, 0)
         *
         * Normal continuation:
         *   (0, 0.01)
         *
         * Candidate:
         *   (0.05, 0)
         *
         * The candidate is several kilometers away from the
         * existing route, so:
         *
         * current → candidate
         * + candidate → continuation
         * - current → continuation
         *
         * is safely greater than the 2,000 m walking threshold.
         */

        const currentStop =
          createRuntimeStop({
            id: 'stop-current',
            venueId: 'venue-current',
            position: 1,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id: 'stop-continuation',
            venueId:
              'venue-continuation',
            position: 2,
            lat: 0,
            lon: 0.01,
          })

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-too-expensive',
            occurrenceId:
              'occurrence-too-expensive',

            confidenceBand:
              'supported',

            venueId:
              'venue-candidate',

            title:
              '013C Excessive Route Cost Test',

            /**
             * 90 minutes after AS_OF.
             *
             * This is deliberately inside the six-hour
             * temporal horizon so the candidate must reach
             * route evaluation.
             */
            startsAt:
              '2026-09-29T17:30:00.000Z',

            endsAt:
              '2026-09-29T19:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-candidate',
              name:
                'Far Candidate Venue',
              lat: 0.05,
              lon: 0,
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-test',

            userId:
              'user-test',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        /**
         * Temporal feasibility must have been evaluated.
         *
         * 90 minutes into a 360-minute horizon:
         *
         * 100 × (1 - 90 / 360) = 75
         */
        expect(
          result.breakdown.temporalFit
        ).toBe(75)

        expect(
          result.breakdown.minutesUntilStart
        ).toBe(90)

        /**
         * The important hard boundary:
         *
         * temporal relevance is valid, but route disruption
         * exceeds walking tolerance.
         */
        expect(
          result.breakdown
            .incrementalDistanceMeters
        ).not.toBeNull()

        expect(
          result.breakdown
            .incrementalDistanceMeters as number
        ).toBeGreaterThan(
          MAX_INCREMENTAL_DISTANCE_METERS_BY_TRAVEL_MODE
            .walking
        )

        expect(
          result.breakdown
            .maxIncrementalDistanceMeters
        ).toBe(2000)

        expect(
          result.actionable
        ).toBe(false)

        expect(
          result.ineligibleReason
        ).toBe(
          'excessive_route_cost'
        )

        /**
         * A failed hard route gate must never receive
         * normalized route relevance or a weighted score.
         */
        expect(
          result.breakdown.routeFit
        ).toBeNull()

        expect(
          result.score
        ).toBeNull()

        /**
         * Verify the scorer evaluated the intended canonical
         * Flow segment rather than some unrelated stop.
         */
        expect(
          result.breakdown
            .routeOriginStopId
        ).toBe(
          currentStop.id
        )

        expect(
          result.breakdown
            .routeContinuationStopId
        ).toBe(
          continuationStop.id
        )

        expect(
          result.breakdown
            .existingFlowPosition
        ).toBeNull()
      }
    )

    it(
      'uses canonical execution order so an inserted Detour becomes the immediate route continuation',
      () => {
        /**
         * Canonical execution route:
         *
         * Base A
         *   position=0
         *   executionIndex=0
         *
         * Detour X
         *   position=NULL
         *   executionIndex=1
         *   beforeFlowStopId=Base B
         *
         * Base B
         *   position=1
         *   executionIndex=2
         *
         * The scorer must therefore evaluate:
         *
         * Base A → candidate → Detour X
         *
         * rather than incorrectly skipping the Detour and evaluating:
         *
         * Base A → candidate → Base B
         */
        const currentStop =
          createRuntimeStop({
            id: 'stop-base-a',
            venueId: 'venue-base-a',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const baseContinuationStop:
          ActiveFlowOpportunityRuntimeStop =
          {
            id: 'stop-base-b',
            venueId: 'venue-base-b',
            position: 1,
            executionIndex: 2,
            kind: 'base',
            beforeFlowStopId: null,
            status: 'planned',
            origin: 'original',
            originalStopId: null,
            completed: false,

            venue: {
              id: 'venue-base-b',
              name: 'venue-base-b',
              lat: 0,
              lon: 0.02,
            },
          }

        const detourStop:
          ActiveFlowOpportunityRuntimeStop =
          {
            id: 'stop-detour-x',
            venueId: 'venue-detour-x',
            position: null,
            executionIndex: 1,
            kind: 'detour',
            beforeFlowStopId:
              baseContinuationStop.id,
            status: 'planned',
            origin:
              'community_signal',
            originalStopId: null,
            completed: false,

            venue: {
              id: 'venue-detour-x',
              name: 'venue-detour-x',
              lat: 0,
              lon: 0.01,
            },
          }

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-detour-order',
            occurrenceId:
              'occurrence-detour-order',

            confidenceBand:
              'supported',

            venueId:
              'venue-candidate-detour-order',

            title:
              '016C Detour Execution Order Test',

            startsAt:
              '2026-09-29T17:30:00.000Z',

            endsAt:
              '2026-09-29T19:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-candidate-detour-order',
              name:
                'Detour Order Candidate Venue',

              /**
               * Keep the candidate close enough to the canonical
               * continuation that route feasibility does not obscure
               * the execution-order assertion this test exists to prove.
               */
              lat: 0,
              lon: 0.005,
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-detour-order',

            userId:
              'user-detour-order',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              detourStop,
              baseContinuationStop,
            ],

            remainingStops: [
              currentStop,
              detourStop,
              baseContinuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        /**
         * 016C's critical scorer invariant:
         *
         * executionIndex determines the immediate continuation.
         * The NULL-position Detour must not be skipped in favor of
         * the next numbered base-route position.
         */
        expect(
          result.breakdown
            .routeOriginStopId
        ).toBe(
          currentStop.id
        )

        expect(
          result.breakdown
            .routeContinuationStopId
        ).toBe(
          detourStop.id
        )
      }
    )

    it(
      'makes the same opportunity non-actionable once its event window expires',
      () => {
        /**
         * 018F — Live Opportunity lifecycle regression.
         *
         * The event and Flow geometry remain identical.
         * Only authoritative time advances.
         *
         * This proves staleness is derived from current opportunity
         * state rather than persisted as a dismissal or mutation.
         */

        const currentStop =
          createRuntimeStop({
            id: 'stop-stale-current',
            venueId:
              'venue-stale-current',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id:
              'stop-stale-continuation',
            venueId:
              'venue-stale-continuation',
            position: 1,
            lat: 0,
            lon: 0.01,
          })

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-stale-lifecycle',

            occurrenceId:
              'occurrence-stale-lifecycle',

            confidenceBand:
              'supported',

            venueId:
              'venue-stale-candidate',

            title:
              '018F Temporal Staleness Test',

            /**
             * At T1 the event is currently happening.
             *
             * At T2 its explicit end time has passed.
             */
            startsAt:
              '2026-09-29T15:30:00.000Z',

            endsAt:
              '2026-09-29T16:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-stale-candidate',

              name:
                'Stale Lifecycle Candidate Venue',

              /**
               * Keep route geometry cheap enough that temporal
               * eligibility is the boundary under test.
               */
              lat: 0,
              lon: 0.005,
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const createContext =
          (
            asOf: string
          ): ActiveFlowOpportunityContext => ({
            sessionId:
              'session-stale-lifecycle',

            userId:
              'user-stale-lifecycle',

            asOf,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          })

        const whileActive =
          scoreActiveFlowOpportunity({
            candidate,

            context:
              createContext(
                '2026-09-29T16:00:00.000Z'
              ),
          })

        expect(
          whileActive.actionable
        ).toBe(true)

        expect(
          whileActive.ineligibleReason
        ).toBeNull()

        expect(
          whileActive.score
        ).not.toBeNull()

        const afterExpiration =
          scoreActiveFlowOpportunity({
            candidate,

            context:
              createContext(
                '2026-09-29T16:31:00.000Z'
              ),
          })

        expect(
          afterExpiration.actionable
        ).toBe(false)

        expect(
          afterExpiration.ineligibleReason
        ).toBe(
          'expired'
        )

        expect(
          afterExpiration.score
        ).toBeNull()
      }
    )

    /**
     * 022D.3 — Contextual-fit scorer integration.
     *
     * These regressions prove contextual fit is a categorical gate,
     * not another weighted score:
     *
     * temporal feasibility
     * → contextual compatibility
     * → route feasibility
     * → weighted score
     *
     * Missing or insufficient contextual evidence remains permissive.
     */

    it(
      'rejects an affirmatively incompatible opportunity before route scoring',
      () => {
        const currentStop =
          createRuntimeStop({
            id:
              'stop-context-current',
            venueId:
              'venue-context-current',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id:
              'stop-context-continuation',
            venueId:
              'venue-context-continuation',
            position: 1,
            lat: 0,
            lon: 0.01,
          })

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-context-incompatible',

            occurrenceId:
              'occurrence-context-incompatible',

            confidenceBand:
              'supported',

            venueId:
              'venue-context-candidate',

            title:
              '022D Contextual Mismatch Test',

            startsAt:
              '2026-09-29T17:30:00.000Z',

            endsAt:
              '2026-09-29T19:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-context-candidate',
              name:
                'Context Candidate Venue',

              /**
               * Route geometry is intentionally cheap.
               *
               * Without the contextual gate this candidate would
               * proceed through normal route scoring.
               */
              lat: 0,
              lon: 0.005,
            },

            contextualFit: {
              fit:
                'incompatible',

              reason:
                'affirmative_semantic_conflict',

              evidence: {
                alignedVibes: [],
                alignedTags: [],
                alignedTypes: [],

                conflictingVibes: [
                  'silent',
                ],

                conflictingTags: [],

                routeSemanticStopCount:
                  2,

                eventHasSemanticEvidence:
                  true,
              },
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-context-incompatible',

            userId:
              'user-context-incompatible',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        /**
         * Temporal evaluation still happens first.
         *
         * 90 minutes into the six-hour horizon = 75.
         */
        expect(
          result.breakdown.temporalFit
        ).toBe(75)

        expect(
          result.breakdown.minutesUntilStart
        ).toBe(90)

        expect(
          result.actionable
        ).toBe(false)

        expect(
          result.ineligibleReason
        ).toBe(
          'contextual_mismatch'
        )

        expect(
          result.score
        ).toBeNull()

        /**
         * Context rejected the opportunity before route-cost
         * evaluation. No route relevance may be manufactured.
         */
        expect(
          result.breakdown.routeFit
        ).toBeNull()

        expect(
          result.breakdown
            .directDistanceMeters
        ).toBeNull()

        expect(
          result.breakdown
            .incrementalDistanceMeters
        ).toBeNull()

        expect(
          result.breakdown
            .routeOriginStopId
        ).toBe(
          currentStop.id
        )

        expect(
          result.breakdown
            .routeContinuationStopId
        ).toBeNull()
      }
    )

    it(
      'preserves temporal rejection precedence over contextual incompatibility',
      () => {
        const currentStop =
          createRuntimeStop({
            id:
              'stop-context-expired-current',
            venueId:
              'venue-context-expired-current',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id:
              'stop-context-expired-continuation',
            venueId:
              'venue-context-expired-continuation',
            position: 1,
            lat: 0,
            lon: 0.01,
          })

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-context-expired',

            occurrenceId:
              'occurrence-context-expired',

            confidenceBand:
              'supported',

            venueId:
              'venue-context-expired-candidate',

            title:
              '022D Temporal Precedence Test',

            startsAt:
              '2026-09-29T14:00:00.000Z',

            endsAt:
              '2026-09-29T15:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-context-expired-candidate',
              name:
                'Expired Context Candidate',
              lat: 0,
              lon: 0.005,
            },

            contextualFit: {
              fit:
                'incompatible',

              reason:
                'affirmative_semantic_conflict',

              evidence: {
                alignedVibes: [],
                alignedTags: [],
                alignedTypes: [],
                conflictingVibes: [
                  'silent',
                ],
                conflictingTags: [],
                routeSemanticStopCount:
                  2,
                eventHasSemanticEvidence:
                  true,
              },
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-context-expired',

            userId:
              'user-context-expired',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        /**
         * Temporal feasibility is still the earlier hard gate.
         *
         * Context must not rewrite an already-expired opportunity
         * into contextual_mismatch.
         */
        expect(
          result.actionable
        ).toBe(false)

        expect(
          result.ineligibleReason
        ).toBe(
          'expired'
        )

        expect(
          result.score
        ).toBeNull()

        expect(
          result.breakdown.routeFit
        ).toBeNull()

        expect(
          result.breakdown
            .directDistanceMeters
        ).toBeNull()

        expect(
          result.breakdown
            .incrementalDistanceMeters
        ).toBeNull()
      }
    )

    it(
      'gives contextual incompatibility precedence over a route that would otherwise exceed the walking threshold',
      () => {
        const currentStop =
          createRuntimeStop({
            id:
              'stop-context-route-current',
            venueId:
              'venue-context-route-current',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id:
              'stop-context-route-continuation',
            venueId:
              'venue-context-route-continuation',
            position: 1,
            lat: 0,
            lon: 0.01,
          })

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-context-route-expensive',

            occurrenceId:
              'occurrence-context-route-expensive',

            confidenceBand:
              'supported',

            venueId:
              'venue-context-route-expensive',

            title:
              '022D Context Before Route Test',

            startsAt:
              '2026-09-29T17:30:00.000Z',

            endsAt:
              '2026-09-29T19:30:00.000Z',

            timezone:
              'America/New_York',

            /**
             * This is the same deliberately excessive geometry used
             * by the existing 013C route-cost regression.
             *
             * If route evaluation ran first, this would produce
             * excessive_route_cost.
             */
            venue: {
              id:
                'venue-context-route-expensive',
              name:
                'Far Context Candidate',
              lat: 0.05,
              lon: 0,
            },

            contextualFit: {
              fit:
                'incompatible',

              reason:
                'affirmative_semantic_conflict',

              evidence: {
                alignedVibes: [],
                alignedTags: [],
                alignedTypes: [],
                conflictingVibes: [
                  'silent',
                ],
                conflictingTags: [],
                routeSemanticStopCount:
                  2,
                eventHasSemanticEvidence:
                  true,
              },
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-context-route-expensive',

            userId:
              'user-context-route-expensive',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        expect(
          result.breakdown.temporalFit
        ).toBe(75)

        /**
         * 022D.3 must win before route-cost evaluation.
         */
        expect(
          result.actionable
        ).toBe(false)

        expect(
          result.ineligibleReason
        ).toBe(
          'contextual_mismatch'
        )

        expect(
          result.score
        ).toBeNull()

        expect(
          result.breakdown.routeFit
        ).toBeNull()

        expect(
          result.breakdown
            .directDistanceMeters
        ).toBeNull()

        expect(
          result.breakdown
            .incrementalDistanceMeters
        ).toBeNull()

        expect(
          result.breakdown
            .maxIncrementalDistanceMeters
        ).toBe(
          MAX_INCREMENTAL_DISTANCE_METERS_BY_TRAVEL_MODE
            .walking
        )
      }
    )

    it(
      'allows insufficient contextual evidence to continue through the existing route and weighted scoring path',
      () => {
        const currentStop =
          createRuntimeStop({
            id:
              'stop-context-insufficient-current',
            venueId:
              'venue-context-insufficient-current',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id:
              'stop-context-insufficient-continuation',
            venueId:
              'venue-context-insufficient-continuation',
            position: 1,
            lat: 0,
            lon: 0.01,
          })

        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-context-insufficient',

            occurrenceId:
              'occurrence-context-insufficient',

            confidenceBand:
              'supported',

            venueId:
              'venue-context-insufficient-candidate',

            title:
              '022D Insufficient Context Test',

            startsAt:
              '2026-09-29T17:30:00.000Z',

            endsAt:
              '2026-09-29T19:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-context-insufficient-candidate',
              name:
                'Insufficient Context Candidate',
              lat: 0,
              lon: 0.005,
            },

            contextualFit: {
              fit:
                'insufficient_context',

              reason:
                'insufficient_semantic_evidence',

              evidence: {
                alignedVibes: [],
                alignedTags: [],
                alignedTypes: [],
                conflictingVibes: [],
                conflictingTags: [],
                routeSemanticStopCount:
                  0,
                eventHasSemanticEvidence:
                  false,
              },
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-context-insufficient',

            userId:
              'user-context-insufficient',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        /**
         * Missing evidence is not mismatch.
         *
         * The candidate must traverse the exact pre-022D scoring path.
         */
        expect(
          result.actionable
        ).toBe(true)

        expect(
          result.ineligibleReason
        ).toBeNull()

        expect(
          result.breakdown.temporalFit
        ).toBe(75)

        expect(
          result.breakdown.routeFit
        ).not.toBeNull()

        expect(
          result.breakdown
            .directDistanceMeters
        ).not.toBeNull()

        expect(
          result.breakdown
            .incrementalDistanceMeters
        ).not.toBeNull()

        expect(
          result.score
        ).not.toBeNull()
      }
    )

    it(
      'preserves historical 013C behavior when contextual fit is absent',
      () => {
        const currentStop =
          createRuntimeStop({
            id:
              'stop-context-absent-current',
            venueId:
              'venue-context-absent-current',
            position: 0,
            lat: 0,
            lon: 0,
          })

        const continuationStop =
          createRuntimeStop({
            id:
              'stop-context-absent-continuation',
            venueId:
              'venue-context-absent-continuation',
            position: 1,
            lat: 0,
            lon: 0.01,
          })

        /**
         * Deliberately contains no contextualFit field.
         *
         * This represents frozen V1 fixtures/consumers and proves the
         * additive 022D contract does not silently make the new field
         * mandatory.
         */
        const candidate:
          ActiveFlowOpportunityCandidate =
          {
            eventId:
              'event-context-absent',

            occurrenceId:
              'occurrence-context-absent',

            confidenceBand:
              'supported',

            venueId:
              'venue-context-absent-candidate',

            title:
              '022D Backward Compatibility Test',

            startsAt:
              '2026-09-29T17:30:00.000Z',

            endsAt:
              '2026-09-29T19:30:00.000Z',

            timezone:
              'America/New_York',

            venue: {
              id:
                'venue-context-absent-candidate',
              name:
                'Historical Candidate',
              lat: 0,
              lon: 0.005,
            },

            venueAlreadyInRemainingFlow:
              false,

            remainingFlowPosition:
              null,
          }

        const context:
          ActiveFlowOpportunityContext =
          {
            sessionId:
              'session-context-absent',

            userId:
              'user-context-absent',

            asOf:
              AS_OF,

            travelMode:
              'walking',

            runtimeStops: [
              currentStop,
              continuationStop,
            ],

            remainingStops: [
              currentStop,
              continuationStop,
            ],

            currentStop,

            candidates: [
              candidate,
            ],
          }

        const result =
          scoreActiveFlowOpportunity({
            candidate,
            context,
          })

        expect(
          result.actionable
        ).toBe(true)

        expect(
          result.ineligibleReason
        ).toBeNull()

        expect(
          result.breakdown.temporalFit
        ).toBe(75)

        expect(
          result.breakdown.routeFit
        ).not.toBeNull()

        expect(
          result.breakdown
            .incrementalDistanceMeters
        ).not.toBeNull()

        expect(
          result.score
        ).not.toBeNull()
      }
    )
  }
)