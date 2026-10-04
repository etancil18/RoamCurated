import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  evaluateActiveFlowContextualFit,
} from './contextualFit'

import type {
  ActiveFlowEventSemantics,
  ActiveFlowSemanticRouteStop,
  ActiveFlowVenueSemantics,
} from './contextualIntelligence'

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

function createRouteStop({
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

function createEvent({
  archetype = null,
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

describe(
  'evaluateActiveFlowContextualFit',
  () => {
    it(
      'keeps direct event-venue vibe overlap as diagnostic evidence without independently establishing compatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    vibes: [
                      'intimate',
                      'atmospheric',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'romantic',
                      'intimate',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.alignedVibes,
        ).toEqual([
          'intimate',
        ])

        expect(
          result.evidence.alignedTags,
        ).toEqual([])

        expect(
          result.evidence.conflictingVibes,
        ).toEqual([])

        expect(
          result.evidence.conflictingTags,
        ).toEqual([])
      },
    )

    it(
      'keeps arbitrary event and route tag overlap as diagnostic evidence without independently establishing compatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                tags: [
                  'live music',
                  'local',
                ],

                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    tags: [
                      'performance',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    tags: [
                      'local',
                      'cocktails',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.alignedTags,
        ).toEqual([
          'local',
        ])
      },
    )

    it(
      'keeps exact cross-field vibe-to-tag alignment as diagnostic evidence without independently establishing compatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                tags: [
                  'intimate',
                ],
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'intimate',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.alignedTags,
        ).toEqual([
          'intimate',
        ])
      },
    )

    it(
      'keeps exact cross-field tag-to-vibe alignment as diagnostic evidence without independently establishing compatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    vibes: [
                      'social',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    tags: [
                      'social',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.alignedVibes,
        ).toEqual([
          'social',
        ])
      },
    )

    it(
      'does not treat type-only overlap as sufficient contextual compatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    types: [
                      'restaurant',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    types: [
                      'restaurant',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.alignedTypes,
        ).toEqual([
          'restaurant',
        ])

        expect(
          result.evidence.alignedVibes,
        ).toEqual([])

        expect(
          result.evidence.alignedTags,
        ).toEqual([])
      },
    )

    it(
      'does not infer incompatibility merely because event and route venue types differ',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    types: [
                      'gallery',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    types: [
                      'restaurant',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.conflictingVibes,
        ).toEqual([])

        expect(
          result.evidence.conflictingTags,
        ).toEqual([])
      },
    )

    it(
      'returns insufficient context when the route has semantic evidence but the event is semantically empty',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent(),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'romantic',
                    ],

                    tags: [
                      'date night',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.evidence.routeSemanticStopCount,
        ).toBe(1)

        expect(
          result.evidence.eventHasSemanticEvidence,
        ).toBe(false)
      },
    )

    it(
      'returns insufficient context when the event has semantic evidence but the remaining route is semantically empty',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                tags: [
                  'live music',
                ],

                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    vibes: [
                      'lively',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.evidence.routeSemanticStopCount,
        ).toBe(0)

        expect(
          result.evidence.eventHasSemanticEvidence,
        ).toBe(true)
      },
    )

    it(
      'returns insufficient context when both event and route lack semantic evidence',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent(),

            remainingStops: [],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence,
        ).toEqual({
          alignedVibes: [],
          alignedTags: [],
          alignedTypes: [],

          conflictingVibes: [],
          conflictingTags: [],

          routeSemanticStopCount:
            0,

          eventHasSemanticEvidence:
            false,
        })
      },
    )

    it(
      'uses a known event archetype profile as curated positive semantic authority',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'music',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'lively',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'compatible',
        )

        expect(
          result.reason,
        ).toBe(
          'strong_semantic_alignment',
        )

        expect(
          result.evidence.alignedVibes,
        ).toContain(
          'lively',
        )

        expect(
          result.evidence.eventHasSemanticEvidence,
        ).toBe(true)
      },
    )

    it(
      'treats the other archetype as absence of archetype evidence rather than fabricated semantic meaning',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'other',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'social',
                    ],

                    tags: [
                      'local',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.evidence.eventHasSemanticEvidence,
        ).toBe(false)

        expect(
          result.evidence.alignedVibes,
        ).toEqual([])

        expect(
          result.evidence.alignedTags,
        ).toEqual([])

        expect(
          result.evidence.conflictingVibes,
        ).toEqual([])

        expect(
          result.evidence.conflictingTags,
        ).toEqual([])
      },
    )

    it(
      'treats a missing archetype as absence of evidence rather than normalizing it to other',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  null,
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'lively',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.evidence.eventHasSemanticEvidence,
        ).toBe(false)
      },
    )

    it(
      'does not establish incompatibility from a single discouraged vibe dimension',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'social_sports',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'silent',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.conflictingVibes,
        ).toContain(
          'silent',
        )

        expect(
          result.evidence.conflictingTags,
        ).toEqual([])
      },
    )

    it(
      'does not establish incompatibility from a single discouraged tag dimension',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'social_sports',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    tags: [
                      'members-only',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.conflictingVibes,
        ).toEqual([])

        expect(
          result.evidence.conflictingTags,
        ).toContain(
          'members-only',
        )
      },
    )

    it(
      'returns incompatible when discouraged vibe and tag evidence corroborate without curated positive alignment',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'social_sports',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'silent',
                    ],

                    tags: [
                      'members-only',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.evidence.conflictingVibes,
        ).toContain(
          'silent',
        )

        expect(
          result.evidence.conflictingTags,
        ).toContain(
          'members-only',
        )

        expect(
          result.fit,
        ).toBe(
          'incompatible',
        )

        expect(
          result.reason,
        ).toBe(
          'affirmative_semantic_conflict',
        )
      },
    )

    it(
      'returns insufficient context when corroborated conflict coexists with curated positive alignment',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'social_sports',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'social',
                      'silent',
                    ],

                    tags: [
                      'members-only',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.evidence.alignedVibes,
        ).toContain(
          'social',
        )

        expect(
          result.evidence.conflictingVibes,
        ).toContain(
          'silent',
        )

        expect(
          result.evidence.conflictingTags,
        ).toContain(
          'members-only',
        )

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )
      },
    )

    it(
      'does not convert archetype discouraged venue types into broad Flow incompatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                archetype:
                  'social_sports',
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    types: [
                      'spa',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).not.toBe(
          'incompatible',
        )

        expect(
          result.evidence.conflictingVibes,
        ).toEqual([])

        expect(
          result.evidence.conflictingTags,
        ).toEqual([])
      },
    )

    it(
      'counts only remaining stops with structured semantic evidence',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent(),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'cozy',
                    ],
                  }),
              }),

              createRouteStop({
                flowStopId:
                  'stop-2',

                executionIndex:
                  1,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-2',
                  }),
              }),

              createRouteStop({
                flowStopId:
                  'stop-3',

                executionIndex:
                  2,

                kind:
                  'detour',

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-3',

                    timeCategories: [
                      'evening',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.evidence.routeSemanticStopCount,
        ).toBe(2)
      },
    )

    it(
      'normalizes duplicate and differently-cased semantic values deterministically without promoting arbitrary overlap to compatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                tags: [
                  ' LOCAL ',
                  'local',
                  'INTIMATE',
                ],

                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    vibes: [
                      ' SOCIAL ',
                      'social',
                    ],

                    tags: [
                      'Local',
                    ],

                    types: [
                      ' BAR ',
                      'bar',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'social',
                      'SOCIAL',
                    ],

                    tags: [
                      'local',
                      ' LOCAL ',
                    ],

                    types: [
                      'bar',
                      'BAR',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.evidence.alignedVibes,
        ).toEqual([
          'social',
        ])

        expect(
          result.evidence.alignedTags,
        ).toEqual([
          'local',
        ])

        expect(
          result.evidence.alignedTypes,
        ).toEqual([
          'bar',
        ])
      },
    )

    it(
      'produces deterministic semantic evidence regardless of remaining-stop input order',
      () => {
        const event =
          createEvent({
            tags: [
              'local',
              'music',
            ],

            venue:
              createVenueSemantics({
                venueId:
                  'event-venue',

                vibes: [
                  'social',
                  'intimate',
                ],

                types: [
                  'bar',
                ],
              }),
          })

        const firstStop =
          createRouteStop({
            flowStopId:
              'stop-1',

            executionIndex:
              0,

            venue:
              createVenueSemantics({
                venueId:
                  'route-venue-1',

                vibes: [
                  'intimate',
                ],

                tags: [
                  'local',
                ],

                types: [
                  'bar',
                ],
              }),
          })

        const secondStop =
          createRouteStop({
            flowStopId:
              'stop-2',

            executionIndex:
              1,

            venue:
              createVenueSemantics({
                venueId:
                  'route-venue-2',

                vibes: [
                  'social',
                ],

                tags: [
                  'music',
                ],
              }),
          })

        const forward =
          evaluateActiveFlowContextualFit({
            event,

            remainingStops: [
              firstStop,
              secondStop,
            ],
          })

        const reversed =
          evaluateActiveFlowContextualFit({
            event,

            remainingStops: [
              secondStop,
              firstStop,
            ],
          })

        expect(
          reversed,
        ).toEqual(
          forward,
        )
      },
    )

    it(
      'does not invent synonym equivalence between related but non-identical semantic values',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    vibes: [
                      'energetic',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    vibes: [
                      'lively',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.evidence.alignedVibes,
        ).toEqual([])
      },
    )

    it(
      'does not use time-category evidence alone to manufacture compatibility or incompatibility',
      () => {
        const result =
          evaluateActiveFlowContextualFit({
            event:
              createEvent({
                venue:
                  createVenueSemantics({
                    venueId:
                      'event-venue',

                    timeCategories: [
                      'evening',
                    ],
                  }),
              }),

            remainingStops: [
              createRouteStop({
                flowStopId:
                  'stop-1',

                executionIndex:
                  0,

                venue:
                  createVenueSemantics({
                    venueId:
                      'route-venue-1',

                    timeCategories: [
                      'evening',
                    ],
                  }),
              }),
            ],
          })

        expect(
          result.fit,
        ).toBe(
          'insufficient_context',
        )

        expect(
          result.reason,
        ).toBe(
          'insufficient_semantic_evidence',
        )

        expect(
          result.evidence.routeSemanticStopCount,
        ).toBe(1)

        expect(
          result.evidence.eventHasSemanticEvidence,
        ).toBe(false)
      },
    )
  },
)