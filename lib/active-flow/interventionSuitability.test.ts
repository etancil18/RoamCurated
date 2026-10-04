import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  evaluateActiveFlowInterventionSuitability,
} from './interventionSuitability'

import type {
  ActiveFlowInterventionSemanticContext,
} from './interventionSuitability'

import type {
  ActiveFlowContextualFitResult,
} from './contextualFit'

import type {
  ActiveFlowEventSemantics,
  ActiveFlowSemanticRouteStop,
  ActiveFlowVenueSemantics,
} from './contextualIntelligence'

import type {
  ActiveFlowInterventionTargets,
} from './interventionTargets'

import type {
  ActiveFlowOpportunityRuntimeStop,
} from './opportunityCandidates'


function createVenueSemantics({
  venueId,
  name = null,
  types = [],
  vibes = [],
  tags = [],
  timeCategories = [],
}: {
  venueId: string
  name?: string | null
  types?: string[]
  vibes?: string[]
  tags?: string[]
  timeCategories?: string[]
}): ActiveFlowVenueSemantics {
  return {
    venueId,
    name,
    types,
    vibes,
    tags,
    timeCategories,
  }
}


function createSemanticRouteStop({
  flowStopId,
  executionIndex,
  venue,
  kind = 'base',
}: {
  flowStopId: string
  executionIndex: number
  venue: ActiveFlowVenueSemantics
  kind?: 'base' | 'detour'
}): ActiveFlowSemanticRouteStop {
  return {
    flowStopId,
    executionIndex,
    kind,
    venue,
  }
}


function createRuntimeStop({
  id,
  venueId,
  executionIndex,
  position = executionIndex,
  kind = 'base',
  completed = false,
}: {
  id: string
  venueId: string
  executionIndex: number
  position?: number | null
  kind?: 'base' | 'detour'
  completed?: boolean
}): ActiveFlowOpportunityRuntimeStop {
  return {
    id,
    venueId,
    position,
    executionIndex,
    kind,

    beforeFlowStopId:
      null,

    status:
      completed
        ? 'completed'
        : 'planned',

    origin:
      kind === 'base'
        ? 'original'
        : 'community_signal',

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
        -84.39,
    },
  }
}


function createEvent({
  archetype = 'music',
  tags = [],
  venue,
}: {
  archetype?: ActiveFlowEventSemantics['archetype']
  tags?: string[]
  venue?: ActiveFlowVenueSemantics
} = {}): ActiveFlowEventSemantics {
  return {
    eventId:
      'event-1',

    title:
      'Community Event',

    description:
      null,

    archetype,

    tags,

    startsAt:
      '2026-10-03T20:00:00.000Z',

    endsAt:
      '2026-10-03T22:00:00.000Z',

    venue:
      venue ??
      createVenueSemantics({
        venueId:
          'event-venue',
      }),
  }
}


function createContextualFit(
  fit:
    ActiveFlowContextualFitResult['fit']
): ActiveFlowContextualFitResult {
  if (
    fit ===
    'compatible'
  ) {
    return {
      fit:
        'compatible',

      reason:
        'strong_semantic_alignment',

      evidence: {
        alignedVibes: [
          'lively',
        ],

        alignedTags: [],
        alignedTypes: [],
        conflictingVibes: [],
        conflictingTags: [],

        routeSemanticStopCount:
          1,

        eventHasSemanticEvidence:
          true,
      },
    }
  }

  if (
    fit ===
    'incompatible'
  ) {
    return {
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

        conflictingTags: [
          'members-only',
        ],

        routeSemanticStopCount:
          1,

        eventHasSemanticEvidence:
          true,
      },
    }
  }

  return {
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
        true,
    },
  }
}


/**
 * 022E.4A — Test fixture for the minimum canonical semantic route
 * evidence consumed by intervention suitability.
 *
 * The production evaluator no longer requires callers to fabricate a
 * complete ActiveFlowSemanticContext containing Flow/local/event fields
 * that the suitability policy does not consume.
 */
function createSemanticContext({
  remainingStops,
}: {
  remainingStops:
    ActiveFlowSemanticRouteStop[]
}): ActiveFlowInterventionSemanticContext {
  return {
    remainingStops,
  }
}


function createTargets({
  currentStop,
  swapTarget,
  detourAnchor,
}: {
  currentStop?:
    ActiveFlowOpportunityRuntimeStop | null

  swapTarget?:
    ActiveFlowOpportunityRuntimeStop | null

  detourAnchor?:
    ActiveFlowOpportunityRuntimeStop | null
} = {}): ActiveFlowInterventionTargets {
  return {
    currentStop:
      currentStop ??
      null,

    swapTarget:
      swapTarget ??
      null,

    detourAnchor:
      detourAnchor ??
      null,
  }
}


describe(
  'evaluateActiveFlowInterventionSuitability',
  () => {
    it(
      'returns suitable for both Detour and Swap when broad context and exact replacement context are compatible',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'lively',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
                detourAnchor:
                  swapTarget,
              }),
          })

        expect(
          result,
        ).toEqual({
          detour: {
            suitability:
              'suitable',

            reason:
              'contextually_coherent',
          },

          swap: {
            suitability:
              'suitable',

            reason:
              'contextually_coherent',
          },
        })
      },
    )

    it(
      'keeps Detour suitable but returns Swap uncertain when replacement context is insufficient',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'quiet',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.detour,
        ).toEqual({
          suitability:
            'suitable',

          reason:
            'contextually_coherent',
        })

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })
      },
    )

    it(
      'keeps Detour suitable but returns Swap unsuitable when exact replacement context is affirmatively incompatible',
      () => {
        const event =
          createEvent({
            archetype:
              'social_sports',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'silent',
                ],

                tags: [
                  'members-only',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.detour,
        ).toEqual({
          suitability:
            'suitable',

          reason:
            'contextually_coherent',
        })

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'unsuitable',

          reason:
            'replacement_context_conflict',
        })
      },
    )

    it(
      'keeps Detour uncertain while allowing Swap to be suitable when broad context is insufficient but exact replacement context is compatible',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'lively',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'insufficient_context'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.detour,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'suitable',

          reason:
            'contextually_coherent',
        })
      },
    )

    it(
      'returns uncertain for both interventions when broad and replacement context are insufficient',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'quiet',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'insufficient_context'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result,
        ).toEqual({
          detour: {
            suitability:
              'uncertain',

            reason:
              'insufficient_context',
          },

          swap: {
            suitability:
              'uncertain',

            reason:
              'insufficient_context',
          },
        })
      },
    )

    it(
      'returns unsuitable for both interventions when broad contextual fit is affirmatively incompatible',
      () => {
        const event =
          createEvent({
            archetype:
              'social_sports',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        /**
         * This target is deliberately locally compatible with the event.
         *
         * Broad incompatibility must still short-circuit both intervention
         * forms rather than allowing local replacement evidence to override
         * an affirmative remaining-Flow contradiction.
         */
        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'social',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'incompatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result,
        ).toEqual({
          detour: {
            suitability:
              'unsuitable',

            reason:
              'additive_context_conflict',
          },

          swap: {
            suitability:
              'unsuitable',

            reason:
              'replacement_context_conflict',
          },
        })
      },
    )

    it(
      'does not fabricate replacement incompatibility when semantic context is absent',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              undefined,

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.detour.suitability,
        ).toBe(
          'suitable',
        )

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })
      },
    )

    it(
      'leaves Swap suitability uncertain when no structural Swap target exists',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [],
              }),

            targets:
              createTargets(),
          })

        expect(
          result.detour.suitability,
        ).toBe(
          'suitable',
        )

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })
      },
    )

    it(
      'leaves Swap suitability uncertain when the runtime target ID is absent from canonical semantic route context',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'shared-venue',

            executionIndex:
              1,
          })

        const wrongSemanticStop =
          createSemanticRouteStop({
            flowStopId:
              'different-stop-id',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'shared-venue',

                vibes: [
                  'lively',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  wrongSemanticStop,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })
      },
    )

    it(
      'matches replacement semantics by immutable flowStopId rather than venue ID, execution index, or array position',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'authoritative-target-id',

            venueId:
              'shared-venue',

            executionIndex:
              7,

            position:
              42,
          })

        /**
         * This stop deliberately shares the target venue and execution
         * index but has the wrong immutable runtime-stop identity.
         *
         * Its semantics would produce compatibility if identity matching
         * incorrectly fell back to venue/order.
         */
        const misleadingStop =
          createSemanticRouteStop({
            flowStopId:
              'wrong-stop-id',

            executionIndex:
              7,

            venue:
              createVenueSemantics({
                venueId:
                  'shared-venue',

                vibes: [
                  'lively',
                ],
              }),
          })

        /**
         * This is the actual target by immutable identity.
         *
         * Its semantics deliberately do not establish compatibility.
         */
        const authoritativeStop =
          createSemanticRouteStop({
            flowStopId:
              'authoritative-target-id',

            executionIndex:
              99,

            venue:
              createVenueSemantics({
                venueId:
                  'different-venue',

                vibes: [
                  'quiet',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  misleadingStop,
                  authoritativeStop,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })
      },
    )

    it(
      'produces deterministic suitability regardless of semantic remaining-stop input order',
      () => {
        const event =
          createEvent({
            archetype:
              'music',
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'lively',
                ],
              }),
          })

        const unrelatedStop =
          createSemanticRouteStop({
            flowStopId:
              'unrelated-stop',

            executionIndex:
              2,

            venue:
              createVenueSemantics({
                venueId:
                  'unrelated-venue',

                vibes: [
                  'silent',
                ],

                tags: [
                  'members-only',
                ],
              }),
          })

        const forward =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                  unrelatedStop,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        const reversed =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'compatible'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  unrelatedStop,
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          reversed,
        ).toEqual(
          forward,
        )

        expect(
          forward.swap.suitability,
        ).toBe(
          'suitable',
        )
      },
    )

    it(
      'does not promote type or time-category evidence into replacement compatibility',
      () => {
        const event =
          createEvent({
            archetype:
              null,

            venue:
              createVenueSemantics({
                venueId:
                  'event-venue',

                types: [
                  'bar',
                ],

                timeCategories: [
                  'evening',
                ],
              }),
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                types: [
                  'bar',
                ],

                timeCategories: [
                  'evening',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'insufficient_context'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result,
        ).toEqual({
          detour: {
            suitability:
              'uncertain',

            reason:
              'insufficient_context',
          },

          swap: {
            suitability:
              'uncertain',

            reason:
              'insufficient_context',
          },
        })
      },
    )

    it(
      'does not let arbitrary exact event-to-target semantic overlap manufacture Swap suitability without curated archetype authority',
      () => {
        const event =
          createEvent({
            archetype:
              null,

            tags: [
              'local',
            ],

            venue:
              createVenueSemantics({
                venueId:
                  'event-venue',

                vibes: [
                  'intimate',
                ],
              }),
          })

        const swapTarget =
          createRuntimeStop({
            id:
              'swap-target',

            venueId:
              'swap-venue',

            executionIndex:
              1,
          })

        const semanticSwapTarget =
          createSemanticRouteStop({
            flowStopId:
              'swap-target',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'swap-venue',

                vibes: [
                  'intimate',
                ],

                tags: [
                  'local',
                ],
              }),
          })

        const result =
          evaluateActiveFlowInterventionSuitability({
            event,

            contextualFit:
              createContextualFit(
                'insufficient_context'
              ),

            semanticContext:
              createSemanticContext({
                remainingStops: [
                  semanticSwapTarget,
                ],
              }),

            targets:
              createTargets({
                swapTarget,
              }),
          })

        expect(
          result.detour,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })

        expect(
          result.swap,
        ).toEqual({
          suitability:
            'uncertain',

          reason:
            'insufficient_context',
        })
      },
    )
  },
)