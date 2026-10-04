import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock(
  'server-only',
  () => ({})
)

vi.mock(
  '@/lib/active-flow/executionPolicy',
  () => ({
    getActiveFlowExecutionPolicy:
      vi.fn(),

    isActiveFlowAdaptiveEligible:
      vi.fn(),
  })
)

vi.mock(
  '@/lib/active-flow/runtimeRoute.server',
  () => ({
    loadActiveFlowRuntimeRoute:
      vi.fn(),
  })
)

vi.mock(
  '@/lib/supabase/admin-runtime',
  () => ({
    getSupabaseAdmin:
      vi.fn(),
  })
)

import {
  getActiveFlowExecutionPolicy,
  isActiveFlowAdaptiveEligible,
} from '@/lib/active-flow/executionPolicy'

import {
  getActiveFlowOpportunityCandidates,
} from '@/lib/active-flow/opportunityCandidates'

import {
  loadActiveFlowRuntimeRoute,
} from '@/lib/active-flow/runtimeRoute.server'

const SESSION_ID =
  '11111111-1111-4111-8111-111111111111'

const USER_ID =
  '22222222-2222-4222-8222-222222222222'

const EVENT_ID =
  '33333333-3333-4333-8333-333333333333'

const OCCURRENCE_ID =
  '44444444-4444-4444-8444-444444444444'

const EVENT_VENUE_ID =
  '55555555-5555-4555-8555-555555555555'

const COMPLETED_VENUE_ID =
  '66666666-6666-4666-8666-666666666666'

const REMAINING_VENUE_ID =
  '77777777-7777-4777-8777-777777777777'

const COMPLETED_STOP_ID =
  '88888888-8888-4888-8888-888888888888'

const REMAINING_STOP_ID =
  '99999999-9999-4999-8999-999999999999'

const AS_OF =
  new Date(
    '2026-10-02T19:00:00.000Z'
  )

const EVENT_STARTS_AT =
  '2026-10-02T20:00:00.000Z'

/**
 * Keep all test geometry on the equator so the fixtures remain easy
 * to reason about.
 */
const METERS_PER_LATITUDE_DEGREE =
  111_194.92664455874

function latitudeOffsetForMeters(
  meters: number
): number {
  return (
    meters /
    METERS_PER_LATITUDE_DEGREE
  )
}

type QueryResult = {
  data: unknown
  error: unknown
}

type VenueFixture = {
  id: string
  name: string
  lat: number | null
  lon: number | null
}

type SupabaseFixture = {
  runtimeVenues: VenueFixture[]
  candidateVenue: VenueFixture
}

function createQueryBuilder(
  result: QueryResult
) {
  const builder:
    Record<string, any> =
    {}

  const chain = () =>
    builder

  builder.select =
    vi.fn(chain)

  builder.eq =
    vi.fn(chain)

  builder.in =
    vi.fn(chain)

  builder.returns =
    vi.fn(
      async () =>
        result
    )

  builder.maybeSingle =
    vi.fn(
      async () =>
        result
    )

  /**
   * Supabase builders are PromiseLike.
   *
   * Some chains in the loader terminate through maybeSingle()/returns(),
   * while this keeps the mock faithful if a directly-awaited builder is
   * introduced without changing the meaning of these tests.
   */
  builder.then = (
    resolve: (
      value: QueryResult
    ) => unknown,
    reject?: (
      reason: unknown
    ) => unknown
  ) =>
    Promise.resolve(
      result
    ).then(
      resolve,
      reject
    )

  return builder
}

function createSupabaseMock({
  runtimeVenues,
  candidateVenue,
}: SupabaseFixture) {
  let venueQueryIndex = 0

  const sessionResult:
    QueryResult = {
      data: {
        id:
          SESSION_ID,

        user_id:
          USER_ID,

        status:
          'active',

        travel_mode:
          'walking',
      },

      error:
        null,
    }

  const eventResult:
    QueryResult = {
      data: [
        {
          id:
            EVENT_ID,

          venue_id:
            EVENT_VENUE_ID,

          title:
            'Community event',

          /**
           * 022C.2 — Explicitly model absent semantic evidence.
           *
           * In particular, a NULL stored archetype must remain NULL
           * rather than being manufactured into the planner's
           * fallback "other" archetype.
           */
          description:
            null,

          archetype:
            null,

          tags:
            null,

          starts_at:
            EVENT_STARTS_AT,

          ends_at:
            null,

          timezone:
            'America/New_York',

          is_active:
            true,

          source:
            'community',

          source_type:
            'community_signal',
        },
      ],

      error:
        null,
    }

  const from =
    vi.fn(
      (
        table: string
      ) => {
        if (
          table ===
          'active_flow_sessions'
        ) {
          return createQueryBuilder(
            sessionResult
          )
        }

        if (
          table ===
          'events'
        ) {
          return createQueryBuilder(
            eventResult
          )
        }

        if (
          table ===
          'venues'
        ) {
          const result =
            venueQueryIndex ===
            0
              ? {
                  data:
                    runtimeVenues,

                  error:
                    null,
                }
              : {
                  data: [
                    candidateVenue,
                  ],

                  error:
                    null,
                }

          venueQueryIndex +=
            1

          return createQueryBuilder(
            result
          )
        }

        return createQueryBuilder({
          data: [],
          error: null,
        })
      }
    )

  const rpc =
    vi.fn(
      async (
        functionName:
          string
      ) => {
        if (
          functionName ===
          'get_discoverable_community_event_ids'
        ) {
          return {
            data: [
              {
                event_id:
                  EVENT_ID,

                occurrence_id:
                  OCCURRENCE_ID,

                confidence_band:
                  'supported',
              },
            ],

            error:
              null,
          }
        }

        throw new Error(
          `Unexpected RPC: ${functionName}`
        )
      }
    )

  return {
    from,
    rpc,
  }
}

function createRuntimeStop({
  id,
  venueId,
  position,
  executionIndex,
  completed,
}: {
  id: string
  venueId: string
  position: number
  executionIndex: number
  completed: boolean
}) {
  return {
    id,

    sessionId:
      SESSION_ID,

    venueId,

    position,

    executionIndex,

    kind:
      'base' as const,

    beforeFlowStopId:
      null,

    status:
      completed
        ? ('completed' as const)
        : ('planned' as const),

    origin:
      'original',

    originalStopId:
      null,

    completed,
  }
}

function createVenue({
  id,
  metersNorth,
}: {
  id: string
  metersNorth: number
}): VenueFixture {
  return {
    id,

    name:
      `Venue ${id}`,

    lat:
      latitudeOffsetForMeters(
        metersNorth
      ),

    lon:
      0,
  }
}

beforeEach(() => {
  vi.mocked(
    getActiveFlowExecutionPolicy
  ).mockResolvedValue({
    canInsertStop:
      true,

    canReplaceStop:
      true,

    canRemoveStop:
      true,

    canReorderStops:
      true,

    canReroute:
      true,

    constraints:
      [],
  })

  vi.mocked(
    isActiveFlowAdaptiveEligible
  ).mockReturnValue(
    true
  )
})

describe(
  'getActiveFlowOpportunityCandidates — 350m Community Signal boundary',
  () => {
    it(
      'admits a trusted event 349m from a remaining executable stop',
      async () => {
        vi.mocked(
          loadActiveFlowRuntimeRoute
        ).mockResolvedValue([
          createRuntimeStop({
            id:
              REMAINING_STOP_ID,

            venueId:
              REMAINING_VENUE_ID,

            position:
              0,

            executionIndex:
              0,

            completed:
              false,
          }),
        ])

        const supabase =
          createSupabaseMock({
            runtimeVenues: [
              createVenue({
                id:
                  REMAINING_VENUE_ID,

                metersNorth:
                  349,
              }),
            ],

            candidateVenue:
              createVenue({
                id:
                  EVENT_VENUE_ID,

                metersNorth:
                  0,
              }),
          })

        const context =
          await getActiveFlowOpportunityCandidates({
            sessionId:
              SESSION_ID,

            userId:
              USER_ID,

            asOf:
              AS_OF,

            supabase:
              supabase as any,
          })

        expect(
          context.candidates
        ).toHaveLength(1)

        expect(
          context.candidates[0]
            ?.eventId
        ).toBe(
          EVENT_ID
        )

        expect(
          context.candidates[0]
            ?.venueId
        ).toBe(
          EVENT_VENUE_ID
        )
      }
    )

    it(
      'rejects a trusted event 351m from every remaining executable stop',
      async () => {
        vi.mocked(
          loadActiveFlowRuntimeRoute
        ).mockResolvedValue([
          createRuntimeStop({
            id:
              REMAINING_STOP_ID,

            venueId:
              REMAINING_VENUE_ID,

            position:
              0,

            executionIndex:
              0,

            completed:
              false,
          }),
        ])

        const supabase =
          createSupabaseMock({
            runtimeVenues: [
              createVenue({
                id:
                  REMAINING_VENUE_ID,

                metersNorth:
                  351,
              }),
            ],

            candidateVenue:
              createVenue({
                id:
                  EVENT_VENUE_ID,

                metersNorth:
                  0,
              }),
          })

        const context =
          await getActiveFlowOpportunityCandidates({
            sessionId:
              SESSION_ID,

            userId:
              USER_ID,

            asOf:
              AS_OF,

            supabase:
              supabase as any,
          })

        expect(
          context.candidates
        ).toEqual([])
      }
    )

    it(
      'does not use a nearby completed stop to satisfy the 350m boundary',
      async () => {
        vi.mocked(
          loadActiveFlowRuntimeRoute
        ).mockResolvedValue([
          createRuntimeStop({
            id:
              COMPLETED_STOP_ID,

            venueId:
              COMPLETED_VENUE_ID,

            position:
              0,

            executionIndex:
              0,

            completed:
              true,
          }),

          createRuntimeStop({
            id:
              REMAINING_STOP_ID,

            venueId:
              REMAINING_VENUE_ID,

            position:
              1,

            executionIndex:
              1,

            completed:
              false,
          }),
        ])

        const supabase =
          createSupabaseMock({
            runtimeVenues: [
              /**
               * This completed stop is only 100m from the event.
               *
               * It must NOT establish Active Flow eligibility.
               */
              createVenue({
                id:
                  COMPLETED_VENUE_ID,

                metersNorth:
                  100,
              }),

              /**
               * The actual remaining route is 351m away.
               */
              createVenue({
                id:
                  REMAINING_VENUE_ID,

                metersNorth:
                  351,
              }),
            ],

            candidateVenue:
              createVenue({
                id:
                  EVENT_VENUE_ID,

                metersNorth:
                  0,
              }),
          })

        const context =
          await getActiveFlowOpportunityCandidates({
            sessionId:
              SESSION_ID,

            userId:
              USER_ID,

            asOf:
              AS_OF,

            supabase:
              supabase as any,
          })

        expect(
          context.remainingStops.map(
            (stop) =>
              stop.id
          )
        ).toEqual([
          REMAINING_STOP_ID,
        ])

        expect(
          context.candidates
        ).toEqual([])
      }
    )

    /**
     * 022C.2 / 022D.3 — Production candidate-loader semantic bridge.
     *
     * The existing 349m / 351m tests above remain authoritative for
     * the frozen geographic admission boundary.
     *
     * This regression proves that once a trusted candidate crosses
     * that boundary, the loader carries normalized semantic evidence
     * into deterministic contextual-fit evaluation.
     */
    it(
      'hydrates semantic evidence and contextual fit only for an admitted candidate while preserving a null event archetype as missing evidence',
      async () => {
        vi.mocked(
          loadActiveFlowRuntimeRoute
        ).mockResolvedValue([
          createRuntimeStop({
            id:
              REMAINING_STOP_ID,

            venueId:
              REMAINING_VENUE_ID,

            position:
              0,

            executionIndex:
              0,

            completed:
              false,
          }),
        ])

        const supabase =
          createSupabaseMock({
            /**
             * 100m is comfortably inside the frozen 350m boundary.
             *
             * The candidate therefore reaches the semantic/contextual
             * layer rather than being rejected geographically.
             */
            runtimeVenues: [
              createVenue({
                id:
                  REMAINING_VENUE_ID,

                metersNorth:
                  100,
              }),
            ],

            candidateVenue:
              createVenue({
                id:
                  EVENT_VENUE_ID,

                metersNorth:
                  0,
              }),
          })

        const context =
          await getActiveFlowOpportunityCandidates({
            sessionId:
              SESSION_ID,

            userId:
              USER_ID,

            asOf:
              AS_OF,

            supabase:
              supabase as any,
          })

        expect(
          context.candidates
        ).toHaveLength(1)

        const candidate =
          context.candidates[0]

        expect(
          candidate
        ).toBeDefined()

        /**
         * 022C.2 — Candidate semantic hydration is present on the
         * production loader path after geographic admission.
         */
        expect(
          candidate?.eventSemantics
        ).toBeDefined()

        expect(
          candidate?.eventSemantics
            ?.eventId
        ).toBe(
          EVENT_ID
        )

        expect(
          candidate?.eventSemantics
            ?.title
        ).toBe(
          'Community event'
        )

        expect(
          candidate?.eventSemantics
            ?.description
        ).toBeNull()

        expect(
          candidate?.eventSemantics
            ?.tags
        ).toEqual([])

        /**
         * Critical missing-evidence invariant:
         *
         * events.archetype = NULL
         *
         * must remain:
         *
         * eventSemantics.archetype = null
         *
         * It must NOT be normalized into "other", because that would
         * manufacture semantic evidence that does not exist.
         */
        expect(
          candidate?.eventSemantics
            ?.archetype
        ).toBeNull()

        expect(
          candidate?.eventSemantics
            ?.venue.venueId
        ).toBe(
          EVENT_VENUE_ID
        )

        /**
         * 022D.3 — The admitted production candidate is evaluated by
         * the deterministic contextual-fit layer.
         *
         * These fixtures deliberately contain no curated semantic
         * vocabulary, so absence of evidence must remain permissive
         * rather than becoming an incompatibility.
         */
        expect(
          candidate?.contextualFit
        ).toBeDefined()

        expect(
          candidate?.contextualFit
            ?.fit
        ).toBe(
          'insufficient_context'
        )

        expect(
          candidate?.contextualFit
            ?.reason
        ).toBe(
          'insufficient_semantic_evidence'
        )

        expect(
          candidate?.contextualFit
            ?.evidence
            .eventHasSemanticEvidence
        ).toBe(false)

        expect(
          candidate?.contextualFit
            ?.evidence
            .alignedVibes
        ).toEqual([])

        expect(
          candidate?.contextualFit
            ?.evidence
            .alignedTags
        ).toEqual([])

        expect(
          candidate?.contextualFit
            ?.evidence
            .conflictingVibes
        ).toEqual([])

        expect(
          candidate?.contextualFit
            ?.evidence
            .conflictingTags
        ).toEqual([])

        /**
         * The additive semantic context is derived from the same
         * canonical remaining runtime route.
         */
        expect(
          context.semanticContext
            ?.remainingStops
        ).toHaveLength(1)

        expect(
          context.semanticContext
            ?.remainingStops[0]
            ?.flowStopId
        ).toBe(
          REMAINING_STOP_ID
        )

        expect(
          context.semanticContext
            ?.currentStop
            ?.flowStopId
        ).toBe(
          REMAINING_STOP_ID
        )
      }
    )
  }
)