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
  }
)