import {
  describe,
  expect,
  it,
} from 'vitest'

import type {
  ActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'

import type {
  ActiveFlowInterventionSuitability,
  ActiveFlowInterventionSuitabilityResult,
} from '@/lib/active-flow/interventionSuitability'

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


function suitability({
  swap,
  detour,
}: {
  swap:
    ActiveFlowInterventionSuitability

  detour:
    ActiveFlowInterventionSuitability
}): ActiveFlowInterventionSuitabilityResult {
  return {
    swap: {
      suitability:
        swap,

      reason:
        swap === 'suitable'
          ? 'contextually_coherent'
          : swap === 'uncertain'
            ? 'insufficient_context'
            : 'replacement_context_conflict',
    },

    detour: {
      suitability:
        detour,

      reason:
        detour === 'suitable'
          ? 'contextually_coherent'
          : detour === 'uncertain'
            ? 'insufficient_context'
            : 'additive_context_conflict',
    },
  }
}


describe(
  'recommendActiveFlowIntervention',
  () => {
    describe(
      '017 historical behavior without suitability',
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
              kind:
                'detour',

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
              kind:
                'detour',

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
              kind:
                'swap',

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
              kind:
                'none',

              reason:
                'no_feasible_intervention',
            })
          }
        )
      }
    )

    describe(
      '022E suitability-aware behavior',
      () => {
        it(
          'preserves Detour preference when both interventions are feasible and suitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'suitable',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'preserves Detour preference when Detour suitability is uncertain',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'suitable',
                  detour: 'uncertain',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'preserves Detour preference when Swap suitability is uncertain',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'uncertain',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'preserves Detour preference when both suitability judgments are uncertain',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'uncertain',
                  detour: 'uncertain',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'recommends Swap when Detour is feasible but contextually unsuitable and Swap remains suitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'suitable',
                  detour: 'unsuitable',
                })
              )
            ).toEqual({
              kind:
                'swap',

              reason:
                'detour_contextually_unsuitable',
            })
          }
        )

        it(
          'recommends Swap when Detour is contextually unsuitable and Swap suitability is uncertain',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'uncertain',
                  detour: 'unsuitable',
                })
              )
            ).toEqual({
              kind:
                'swap',

              reason:
                'detour_contextually_unsuitable',
            })
          }
        )

        it(
          'keeps Detour when Swap is contextually unsuitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'unsuitable',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'keeps an uncertain Detour when Swap is contextually unsuitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'unsuitable',
                  detour: 'uncertain',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'recommends no intervention when both feasible interventions are contextually unsuitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: true,
                }),

                suitability({
                  swap: 'unsuitable',
                  detour: 'unsuitable',
                })
              )
            ).toEqual({
              kind:
                'none',

              reason:
                'no_suitable_intervention',
            })
          }
        )

        it(
          'recommends Swap when Detour is structurally infeasible and Swap is suitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: false,
                }),

                suitability({
                  swap: 'suitable',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'swap',

              reason:
                'detour_unavailable',
            })
          }
        )

        it(
          'recommends Swap when Detour is structurally infeasible and Swap suitability is uncertain',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: false,
                }),

                suitability({
                  swap: 'uncertain',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'swap',

              reason:
                'detour_unavailable',
            })
          }
        )

        it(
          'recommends Detour when Swap is structurally infeasible and Detour is suitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: false,
                  detour: true,
                }),

                suitability({
                  swap: 'suitable',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'detour',

              reason:
                'preserve_original_route',
            })
          }
        )

        it(
          'does not let suitability resurrect structurally infeasible interventions',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: false,
                  detour: false,
                }),

                suitability({
                  swap: 'suitable',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'none',

              reason:
                'no_feasible_intervention',
            })
          }
        )

        it(
          'returns no suitable intervention when the only structurally feasible option is unsuitable',
          () => {
            expect(
              recommendActiveFlowIntervention(
                feasibility({
                  swap: true,
                  detour: false,
                }),

                suitability({
                  swap: 'unsuitable',
                  detour: 'suitable',
                })
              )
            ).toEqual({
              kind:
                'none',

              reason:
                'no_suitable_intervention',
            })
          }
        )
      }
    )
  }
)