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
  evaluateActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'


function makeStop({
  id,
  venueId,
  position,
  executionIndex,
  kind = 'base',
  completed = false,
  beforeFlowStopId = null,
}: {
  id: string
  venueId: string
  position: number | null
  executionIndex: number
  kind?: 'base' | 'detour'
  completed?: boolean
  beforeFlowStopId?: string | null
}): ActiveFlowOpportunityRuntimeStop {
  return {
    id,
    venueId,
    position,
    executionIndex,
    kind,
    beforeFlowStopId,

    status:
      'planned',

    origin:
      kind === 'detour'
        ? 'community_signal'
        : 'original',

    originalStopId:
      null,

    completed,

    venue: {
      id:
        venueId,

      name:
        `Venue ${venueId}`,

      lat:
        33.75,

      lon:
        -84.38,
    },
  }
}


function makeCandidate({
  venueId = 'venue-live',
}: {
  venueId?: string
} = {}): ActiveFlowOpportunityCandidate {
  return {
    eventId:
      'event-live',

    occurrenceId:
      'occurrence-live',

    confidenceBand:
      'supported',

    venueId,

    title:
      'Live Community Event',

    startsAt:
      '2026-10-01T14:00:00.000Z',

    endsAt:
      '2026-10-01T16:00:00.000Z',

    timezone:
      'America/New_York',

    venue: {
      id:
        venueId,

      name:
        `Venue ${venueId}`,

      lat:
        33.76,

      lon:
        -84.37,
    },

    venueAlreadyInRemainingFlow:
      false,

    remainingFlowPosition:
      null,
  }
}


function makeContext({
  runtimeStops,
  remainingStops,
  currentStop,
}: {
  runtimeStops:
    ActiveFlowOpportunityRuntimeStop[]

  remainingStops:
    ActiveFlowOpportunityRuntimeStop[]

  currentStop:
    ActiveFlowOpportunityRuntimeStop | null
}): ActiveFlowOpportunityContext {
  return {
    sessionId:
      'session-1',

    userId:
      'user-1',

    asOf:
      '2026-10-01T13:00:00.000Z',

    travelMode:
      'walking',

    runtimeStops,

    remainingStops,

    currentStop,

    candidates:
      [],
  }
}


function makeStandardRoute() {
  const current =
    makeStop({
      id: 'stop-a',
      venueId: 'venue-a',
      position: 0,
      executionIndex: 0,
    })

  const next =
    makeStop({
      id: 'stop-b',
      venueId: 'venue-b',
      position: 1,
      executionIndex: 1,
    })

  const later =
    makeStop({
      id: 'stop-c',
      venueId: 'venue-c',
      position: 2,
      executionIndex: 2,
    })

  const runtimeStops = [
    current,
    next,
    later,
  ]

  return {
    current,
    next,
    later,

    context:
      makeContext({
        runtimeStops,
        remainingStops:
          runtimeStops,

        currentStop:
          current,
      }),
  }
}


describe(
  'evaluateActiveFlowInterventionFeasibility',
  () => {
    it(
      'marks both interventions unavailable when the opportunity is not actionable',
      () => {
        const {
          context,
        } =
          makeStandardRoute()

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate(),

            actionable:
              false,

            occupiedDetourAnchorIds:
              new Set(),
          })

        expect(
          result
        ).toEqual({
          swap: {
            feasible:
              false,

            reason:
              'opportunity_not_actionable',
          },

          detour: {
            feasible:
              false,

            reason:
              'opportunity_not_actionable',
          },
        })
      }
    )


    it(
      'returns no_target when there is no subsequent intervention target',
      () => {
        const current =
          makeStop({
            id: 'stop-a',
            venueId: 'venue-a',
            position: 0,
            executionIndex: 0,
          })

        const context =
          makeContext({
            runtimeStops: [
              current,
            ],

            remainingStops: [
              current,
            ],

            currentStop:
              current,
          })

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate(),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set(),
          })

        expect(
          result.swap
        ).toEqual({
          feasible:
            false,

          reason:
            'no_target',
        })

        expect(
          result.detour
        ).toEqual({
          feasible:
            false,

          reason:
            'no_target',
        })
      }
    )


    it(
      'rejects Swap when the candidate venue is already the Swap target venue',
      () => {
        const {
          context,
          next,
        } =
          makeStandardRoute()

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate({
                venueId:
                  next.venueId,
              }),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set(),
          })

        expect(
          result.swap
        ).toEqual({
          feasible:
            false,

          reason:
            'same_venue',
        })
      }
    )


    it(
      'rejects Detour when the candidate venue is already the Detour anchor venue',
      () => {
        const {
          context,
          next,
        } =
          makeStandardRoute()

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate({
                venueId:
                  next.venueId,
              }),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set(),
          })

        expect(
          result.detour
        ).toEqual({
          feasible:
            false,

          reason:
            'same_venue',
        })
      }
    )


    it(
      'rejects both interventions when the candidate venue already exists elsewhere in the executable route',
      () => {
        const {
          context,
          later,
        } =
          makeStandardRoute()

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate({
                venueId:
                  later.venueId,
              }),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set(),
          })

        expect(
          result.swap
        ).toEqual({
          feasible:
            false,

          reason:
            'venue_already_executable',
        })

        expect(
          result.detour
        ).toEqual({
          feasible:
            false,

          reason:
            'venue_already_executable',
        })
      }
    )


    it(
      'rejects Swap when its immediate target already owns an active Detour',
      () => {
        const {
          context,
          next,
        } =
          makeStandardRoute()

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate(),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set([
                next.id,
              ]),
          })

        expect(
          result.swap
        ).toEqual({
          feasible:
            false,

          reason:
            'target_has_active_detour',
        })
      }
    )


    it(
      'rejects Detour when its base anchor already owns an active Detour while preserving a separately feasible Swap',
      () => {
        const current =
          makeStop({
            id: 'stop-a',
            venueId: 'venue-a',
            position: 0,
            executionIndex: 0,
          })

        const insertedDetour =
          makeStop({
            id: 'stop-x',
            venueId: 'venue-x',
            position: null,
            executionIndex: 1,
            kind: 'detour',
            beforeFlowStopId:
              'stop-b',
          })

        const baseAnchor =
          makeStop({
            id: 'stop-b',
            venueId: 'venue-b',
            position: 1,
            executionIndex: 2,
          })

        const later =
          makeStop({
            id: 'stop-c',
            venueId: 'venue-c',
            position: 2,
            executionIndex: 3,
          })

        const runtimeStops = [
          current,
          insertedDetour,
          baseAnchor,
          later,
        ]

        const context =
          makeContext({
            runtimeStops,

            remainingStops:
              runtimeStops,

            currentStop:
              current,
          })

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate(),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set([
                baseAnchor.id,
              ]),
          })

        expect(
          result.swap
        ).toEqual({
          feasible:
            true,

          reason:
            null,
        })

        expect(
          result.detour
        ).toEqual({
          feasible:
            false,

          reason:
            'target_has_active_detour',
        })
      }
    )


    it(
      'marks both interventions feasible for a novel actionable candidate with unoccupied targets',
      () => {
        const {
          context,
        } =
          makeStandardRoute()

        const result =
          evaluateActiveFlowInterventionFeasibility({
            context,

            candidate:
              makeCandidate(),

            actionable:
              true,

            occupiedDetourAnchorIds:
              new Set(),
          })

        expect(
          result
        ).toEqual({
          swap: {
            feasible:
              true,

            reason:
              null,
          },

          detour: {
            feasible:
              true,

            reason:
              null,
          },
        })
      }
    )
  }
)