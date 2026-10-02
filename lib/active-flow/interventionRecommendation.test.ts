import {
  describe,
  expect,
  it,
} from 'vitest'

import type {
  ActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'

import {
  recommendActiveFlowIntervention,
} from '@/lib/active-flow/interventionRecommendation'


function feasibility({
  swap,
  detour,
}: {
  swap: boolean
  detour: boolean
}): ActiveFlowInterventionFeasibility {
  return {
    swap: swap
      ? {
          feasible: true,
          reason: null,
        }
      : {
          feasible: false,
          reason: 'no_target',
        },

    detour: detour
      ? {
          feasible: true,
          reason: null,
        }
      : {
          feasible: false,
          reason: 'no_target',
        },
  }
}


describe(
  'recommendActiveFlowIntervention',
  () => {
    it(
      'prefers Detour when both interventions are feasible',
      () => {
        expect(
          recommendActiveFlowIntervention(
            feasibility({
              swap: true,
              detour: true,
            })
          )
        ).toEqual({
          kind: 'detour',
          reason:
            'preserve_original_route',
        })
      }
    )

    it(
      'recommends Detour when only Detour is feasible',
      () => {
        expect(
          recommendActiveFlowIntervention(
            feasibility({
              swap: false,
              detour: true,
            })
          )
        ).toEqual({
          kind: 'detour',
          reason:
            'preserve_original_route',
        })
      }
    )

    it(
      'recommends Swap when Detour is unavailable and Swap is feasible',
      () => {
        expect(
          recommendActiveFlowIntervention(
            feasibility({
              swap: true,
              detour: false,
            })
          )
        ).toEqual({
          kind: 'swap',
          reason:
            'detour_unavailable',
        })
      }
    )

    it(
      'recommends no intervention when neither intervention is feasible',
      () => {
        expect(
          recommendActiveFlowIntervention(
            feasibility({
              swap: false,
              detour: false,
            })
          )
        ).toEqual({
          kind: 'none',
          reason:
            'no_feasible_intervention',
        })
      }
    )
  }
)