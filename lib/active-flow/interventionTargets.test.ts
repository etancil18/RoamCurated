import {
  describe,
  expect,
  it,
} from 'vitest'

import type {
  ActiveFlowOpportunityRuntimeStop,
} from '@/lib/active-flow/opportunityCandidates'

import {
  resolveActiveFlowInterventionTargets,
} from '@/lib/active-flow/interventionTargets'


function makeStop({
  id,
  position,
  executionIndex,
  kind = 'base',
  completed = false,
  beforeFlowStopId = null,
}: {
  id: string
  position: number | null
  executionIndex: number
  kind?: 'base' | 'detour'
  completed?: boolean
  beforeFlowStopId?: string | null
}): ActiveFlowOpportunityRuntimeStop {
  return {
    id,
    venueId:
      `venue-${id}`,

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
        `venue-${id}`,

      name:
        id,

      lat:
        33.75,

      lon:
        -84.38,
    },
  }
}


describe(
  'resolveActiveFlowInterventionTargets',
  () => {
    it(
      'returns no targets when there is no current stop',
      () => {
        expect(
          resolveActiveFlowInterventionTargets({
            currentStop: null,
            remainingStops: [],
          })
        ).toEqual({
          currentStop: null,
          swapTarget: null,
          detourAnchor: null,
        })
      }
    )


    it(
      'uses the immediate next executable stop for Swap',
      () => {
        const current =
          makeStop({
            id: 'a',
            position: 0,
            executionIndex: 0,
          })

        const next =
          makeStop({
            id: 'b',
            position: 1,
            executionIndex: 1,
          })

        const later =
          makeStop({
            id: 'c',
            position: 2,
            executionIndex: 2,
          })

        const result =
          resolveActiveFlowInterventionTargets({
            currentStop:
              current,

            remainingStops: [
              current,
              next,
              later,
            ],
          })

        expect(
          result.swapTarget?.id
        ).toBe(
          'b'
        )

        expect(
          result.detourAnchor?.id
        ).toBe(
          'b'
        )
      }
    )


    it(
      'allows the immediate next Detour to be the Swap target but skips it for the Detour anchor',
      () => {
        const current =
          makeStop({
            id: 'a',
            position: 0,
            executionIndex: 0,
          })

        const insertedDetour =
          makeStop({
            id: 'x',
            position: null,
            executionIndex: 1,
            kind: 'detour',
            beforeFlowStopId:
              'b',
          })

        const baseAnchor =
          makeStop({
            id: 'b',
            position: 1,
            executionIndex: 2,
          })

        const result =
          resolveActiveFlowInterventionTargets({
            currentStop:
              current,

            remainingStops: [
              current,
              insertedDetour,
              baseAnchor,
            ],
          })

        expect(
          result.swapTarget?.id
        ).toBe(
          'x'
        )

        expect(
          result.detourAnchor?.id
        ).toBe(
          'b'
        )
      }
    )


    it(
      'returns no Detour anchor when no subsequent base stop exists',
      () => {
        const current =
          makeStop({
            id: 'a',
            position: 0,
            executionIndex: 0,
          })

        const insertedDetour =
          makeStop({
            id: 'x',
            position: null,
            executionIndex: 1,
            kind: 'detour',
            beforeFlowStopId:
              'missing-base',
          })

        const result =
          resolveActiveFlowInterventionTargets({
            currentStop:
              current,

            remainingStops: [
              current,
              insertedDetour,
            ],
          })

        expect(
          result.swapTarget?.id
        ).toBe(
          'x'
        )

        expect(
          result.detourAnchor
        ).toBeNull()
      }
    )


    it(
      'fails closed when currentStop is absent from remainingStops',
      () => {
        const current =
          makeStop({
            id: 'a',
            position: 0,
            executionIndex: 0,
          })

        const other =
          makeStop({
            id: 'b',
            position: 1,
            executionIndex: 1,
          })

        expect(
          () =>
            resolveActiveFlowInterventionTargets({
              currentStop:
                current,

              remainingStops: [
                other,
              ],
            })
        ).toThrow(
          'Active Flow runtime context is inconsistent.'
        )
      }
    )
  }
)