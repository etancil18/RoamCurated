import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

/* =========================================================
 * Hoisted dependency state
 * ======================================================= */

const mocks = vi.hoisted(() => {
  const supabaseClient =
    createMockSupabaseClient()

  return {
    supabaseClient,

    getSupabaseAdmin:
      vi.fn(
        () =>
          supabaseClient
      ),

    calculateCreatorReputation:
      vi.fn(),

    validateReputationEvidence:
      vi.fn(),

    isEligibleForReputation:
      vi.fn(),

    rebuildReputationRankings:
      vi.fn(),
  }
})

/* =========================================================
 * Dependency mocks
 * ======================================================= */

vi.mock(
  '@/lib/supabase/admin',
  () => ({
    supabaseAdmin:
      mocks.supabaseClient,

    getSupabaseAdmin:
      mocks.getSupabaseAdmin,
  })
)

vi.mock(
  '@/lib/reputation/calculateCreatorReputation',
  () => ({
    calculateCreatorReputation:
      mocks.calculateCreatorReputation,
  })
)

vi.mock(
  '@/lib/reputation/validateReputationEvidence',
  () => ({
    validateReputationEvidence:
      mocks.validateReputationEvidence,
  })
)

vi.mock(
  '@/lib/reputation/isEligibleForReputation',
  () => ({
    isEligibleForReputation:
      mocks.isEligibleForReputation,
  })
)

vi.mock(
  '@/lib/reputation/rebuildReputationRankings',
  () => ({
    rebuildReputationRankings:
      mocks.rebuildReputationRankings,
  })
)

/* =========================================================
 * Subject under test
 * ======================================================= */

import * as rebuildModule from '@/lib/reputation/rebuildCreatorReputation'

/* =========================================================
 * Test-local contracts
 * ======================================================= */

type UnknownRecord = Record<
  string,
  unknown
>

type RebuildFunction = (
  ...args: unknown[]
) => unknown

type QueryResponse = {
  data: unknown
  error: unknown
  count?: number | null
}

type QueryOperation = {
  table: string
  operation:
    | 'select'
    | 'insert'
    | 'upsert'
    | 'update'
    | 'delete'
  payload?: unknown
  options?: unknown
  filters: Array<{
    type: string
    column?: string
    value?: unknown
  }>
}

type QueryFixture = {
  table: string
  response:
    | QueryResponse
    | ((
        operation:
          QueryOperation
      ) => QueryResponse)
}

type MockSupabaseClient = {
  from:
    ReturnType<
      typeof vi.fn
    >

  auth: {
    admin: {
      getUserById:
        ReturnType<
          typeof vi.fn
        >
    }
  }

  __operations:
    QueryOperation[]

  __setFixtures: (
    fixtures:
      readonly QueryFixture[]
  ) => void

  __reset: () => void
}

/* =========================================================
 * Supported public exports
 * ======================================================= */

const REBUILD_EXPORT_NAMES = [
  'rebuildCreatorReputation',
  'rebuildCreatorReputationForUser',
] as const

const rebuildCreatorReputation =
  loadRequiredFunction(
    rebuildModule as UnknownRecord,
    REBUILD_EXPORT_NAMES
  )

/* =========================================================
 * Canonical fixtures
 * ======================================================= */

const USER_ID =
  'b25fbdac-8385-48fa-8133-fe57f03bd4e2'

const OTHER_USER_ID =
  '30eb3fc1-a66a-4f38-a7f5-2eac31c2d3ef'

const VENUE_ID =
  '53e6df3f-8a26-4422-96b2-f943636240ae'

const POLICY_VERSION =
  1

const CALCULATED_AT =
  '2026-07-29T12:00:00.000Z'

const DEFAULT_EVIDENCE = {
  verifiedVenueCount:
    5,

  weightedVenueCount:
    7,

  publicCollectionCount:
    2,

  curatedVenueCount:
    12,

  publicSnapshotCount:
    3,

  completedFlowCount:
    4,

  cityCount:
    1,
}

const DEFAULT_CALCULATION = {
  reputationScore:
    42.5,

  reputationLevel:
    'established',

  verifiedVenueCount:
    5,

  weightedVenueCount:
    7,

  publicCollectionCount:
    2,

  curatedVenueCount:
    12,

  publicSnapshotCount:
    3,

  completedFlowCount:
    4,

  cityCount:
    1,
}

/* =========================================================
 * Setup
 * ======================================================= */

beforeEach(() => {
  vi.clearAllMocks()

  mocks.supabaseClient
    .__reset()

  mocks.getSupabaseAdmin
    .mockReturnValue(
      mocks.supabaseClient
    )

  mocks.validateReputationEvidence
    .mockReturnValue(
      DEFAULT_EVIDENCE
    )

  mocks.isEligibleForReputation
    .mockReturnValue({
      eligible:
        true,

      statusEligible:
        true,

      rankingEligible:
        true,

      missingRequirements:
        [],
  })

  mocks.calculateCreatorReputation
    .mockReturnValue(
      DEFAULT_CALCULATION
    )

  mocks.rebuildReputationRankings
    .mockResolvedValue({
      rebuilt:
        true,
  })

  installDefaultFixtures()
})

/* =========================================================
 * Export contract
 * ======================================================= */

describe(
  'rebuildCreatorReputation export contract',
  () => {
    it(
      'exports the canonical rebuild function',
      () => {
        expect(
          rebuildCreatorReputation
        ).toBeTypeOf(
          'function'
        )
      }
    )
  }
)

/* =========================================================
 * Input validation
 * ======================================================= */

describe(
  'rebuildCreatorReputation input validation',
  () => {
    it.each([
      null,
      undefined,
      '',
      '   ',
      'not-a-uuid',
      123,
      {},
      [],
    ])(
      'rejects an invalid user ID: %o',
      async (
        invalidUserId
      ) => {
        await expect(
          invokeRebuild({
            userId:
              invalidUserId,
          })
        ).rejects.toThrow()

        expect(
          mocks.supabaseClient
            .from
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'accepts a canonical UUID user ID',
      async () => {
        await expect(
          invokeRebuild({
            userId:
              USER_ID,
          })
        ).resolves.toBeDefined()
      }
    )

    it(
      'rejects an invalid policy version',
      async () => {
        await expect(
          invokeRebuild({
            userId:
              USER_ID,

            policyVersion:
              -1,
          })
        ).rejects.toThrow()
      }
    )
  }
)

/* =========================================================
 * Canonical evidence loading
 * ======================================================= */

describe(
  'canonical evidence loading',
  () => {
    it(
      'loads reputation evidence only for the requested user',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const userFilters =
          mocks.supabaseClient
            .__operations
            .flatMap(
              (
                operation
              ) =>
                operation.filters
            )
            .filter(
              (
                filter
              ) =>
                filter.column ===
                'user_id'
            )

        expect(
          userFilters.length
        ).toBeGreaterThan(0)

        expect(
          userFilters.every(
            (
              filter
            ) =>
              filter.value ===
              USER_ID
          )
        ).toBe(true)
      }
    )

    it(
      'does not read another user while rebuilding the target user',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const serialized =
          JSON.stringify(
            mocks.supabaseClient
              .__operations
          )

        expect(
          serialized
        ).not.toContain(
          OTHER_USER_ID
        )
      }
    )

    it(
      'uses geo-verified venue visits as canonical visit evidence',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const venueVisitOperations =
          operationsForTable(
            'venue_visits'
          )

        expect(
          venueVisitOperations.length
        ).toBeGreaterThan(0)

        expect(
          venueVisitOperations.some(
            (
              operation
            ) =>
              operation.filters.some(
                (
                  filter
                ) =>
                  filter.column ===
                    'geo_verified' &&
                  filter.value ===
                    true
              )
          )
        ).toBe(true)
      }
    )

    it(
      'loads venue category assignments needed for category reputation',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const categoryTables = [
          'venue_reputation_categories',
          'venue_reputation_category_assignments',
          'venue_categories',
        ]

        expect(
          mocks.supabaseClient
            .__operations
            .some(
              (
                operation
              ) =>
                categoryTables.includes(
                  operation.table
                )
            )
        ).toBe(true)
      }
    )
  }
)

/* =========================================================
 * Validation and calculation delegation
 * ======================================================= */

describe(
  'evidence validation and calculation',
  () => {
    it(
      'validates evidence before calculating reputation',
      async () => {
        const callOrder:
          string[] = []

        mocks.validateReputationEvidence
          .mockImplementation(
            (
              value
            ) => {
              callOrder.push(
                'validate'
              )

              return value
            }
          )

        mocks.calculateCreatorReputation
          .mockImplementation(
            () => {
              callOrder.push(
                'calculate'
              )

              return DEFAULT_CALCULATION
            }
          )

        await invokeRebuild({
          userId:
            USER_ID,
        })

        expect(
          callOrder.indexOf(
            'validate'
          )
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          callOrder.indexOf(
            'calculate'
          )
        ).toBeGreaterThan(
          callOrder.indexOf(
            'validate'
          )
        )
      }
    )

    it(
      'checks reputation eligibility',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        expect(
          mocks.isEligibleForReputation
        ).toHaveBeenCalled()
      }
    )

    it(
      'calculates reputation using validated evidence',
      async () => {
        const validatedEvidence = {
          ...DEFAULT_EVIDENCE,

          verifiedVenueCount:
            9,
        }

        mocks.validateReputationEvidence
          .mockReturnValue(
            validatedEvidence
          )

        await invokeRebuild({
          userId:
            USER_ID,
        })

        expect(
          mocks.calculateCreatorReputation
        ).toHaveBeenCalled()

        const calculationCalls =
          mocks.calculateCreatorReputation
            .mock.calls

        expect(
          calculationCalls.some(
            (
              call
            ) =>
              containsNestedValue(
                call,
                'verifiedVenueCount',
                9
              )
          )
        ).toBe(true)
      }
    )

    it(
      'does not persist calculated reputation when evidence validation fails',
      async () => {
        mocks.validateReputationEvidence
          .mockImplementation(
            () => {
              throw new Error(
                'Invalid reputation evidence'
              )
            }
          )

        await expect(
          invokeRebuild({
            userId:
              USER_ID,
          })
        ).rejects.toThrow(
          'Invalid reputation evidence'
        )

        expect(
          writeOperationsForTable(
            'creator_reputation_stats'
          )
        ).toHaveLength(0)
      }
    )
  }
)

/* =========================================================
 * Canonical writes
 * ======================================================= */

describe(
  'creator reputation canonical writes',
  () => {
    it(
      'writes creator reputation stats after successful calculation',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const writes =
          writeOperationsForTable(
            'creator_reputation_stats'
          )

        expect(
          writes.length
        ).toBeGreaterThan(0)
      }
    )

    it(
      'writes the requested user ID and policy version',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,

          policyVersion:
            POLICY_VERSION,
        })

        const serializedWrites =
          JSON.stringify(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        expect(
          serializedWrites
        ).toContain(
          USER_ID
        )

        expect(
          serializedWrites
        ).toContain(
          `"policy_version":${POLICY_VERSION}`
        )
      }
    )

    it(
      'persists calculated score and level',
      async () => {
        mocks.calculateCreatorReputation
          .mockReturnValue({
            ...DEFAULT_CALCULATION,

            reputationScore:
              73.25,

            reputationLevel:
              'expert',
          })

        await invokeRebuild({
          userId:
            USER_ID,
        })

        const serializedWrites =
          JSON.stringify(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        expect(
          serializedWrites
        ).toContain(
          '"reputation_score":73.25'
        )

        expect(
          serializedWrites
        ).toContain(
          '"reputation_level":"expert"'
        )
      }
    )

    it(
      'persists evidence counts separately from the interpreted score',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const serializedWrites =
          JSON.stringify(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        expect(
          serializedWrites
        ).toContain(
          '"verified_venue_count":5'
        )

        expect(
          serializedWrites
        ).toContain(
          '"weighted_venue_count":7'
        )

        expect(
          serializedWrites
        ).toContain(
          '"public_collection_count":2'
        )

        expect(
          serializedWrites
        ).toContain(
          '"curated_venue_count":12'
        )

        expect(
          serializedWrites
        ).toContain(
          '"public_snapshot_count":3'
        )

        expect(
          serializedWrites
        ).toContain(
          '"completed_flow_count":4'
        )
      }
    )

    it(
      'uses an upsert or conflict-safe equivalent for idempotency',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const writes =
          writeOperationsForTable(
            'creator_reputation_stats'
          )

        expect(
          writes.some(
            (
              operation
            ) =>
              operation.operation ===
              'upsert'
          )
        ).toBe(true)
      }
    )

    it(
      'includes the canonical reputation identity in conflict handling',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,
        })

        const upsert =
          writeOperationsForTable(
            'creator_reputation_stats'
          ).find(
            (
              operation
            ) =>
              operation.operation ===
              'upsert'
          )

        expect(
          upsert
        ).toBeDefined()

        const serializedOptions =
          JSON.stringify(
            upsert?.options ??
              {}
          )

        expect(
          serializedOptions
        ).toContain(
          'user_id'
        )

        expect(
          serializedOptions
        ).toContain(
          'category_id'
        )

        expect(
          serializedOptions
        ).toContain(
          'scope'
        )

        expect(
          serializedOptions
        ).toContain(
          'policy_version'
        )
      }
    )

    it(
      'does not write before calculation succeeds',
      async () => {
        mocks.calculateCreatorReputation
          .mockImplementation(
            () => {
              throw new Error(
                'Calculation failed'
              )
            }
          )

        await expect(
          invokeRebuild({
            userId:
              USER_ID,
          })
        ).rejects.toThrow(
          'Calculation failed'
        )

        expect(
          writeOperationsForTable(
            'creator_reputation_stats'
          )
        ).toHaveLength(0)
      }
    )
  }
)

/* =========================================================
 * Scope behavior
 * ======================================================= */

describe(
  'global and city scope behavior',
  () => {
    it(
      'supports rebuilding global reputation rows',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,

          scope:
            'global',

          cityKey:
            null,
        })

        const serializedWrites =
          JSON.stringify(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        expect(
          serializedWrites
        ).toContain(
          '"scope":"global"'
        )
      }
    )

    it(
      'supports rebuilding city reputation rows',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,

          scope:
            'city',

          cityKey:
            'atl',
        })

        const serializedWrites =
          JSON.stringify(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        expect(
          serializedWrites
        ).toContain(
          '"scope":"city"'
        )

        expect(
          serializedWrites
        ).toContain(
          '"city_key":"atl"'
        )
      }
    )

    it(
      'does not attach a city key to a global reputation identity',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,

          scope:
            'global',

          cityKey:
            null,
        })

        const writes =
          writeOperationsForTable(
            'creator_reputation_stats'
          )

        const globalPayloads =
          flattenPayloadRecords(
            writes
          ).filter(
            (
              payload
            ) =>
              payload.scope ===
              'global'
          )

        expect(
          globalPayloads.length
        ).toBeGreaterThan(0)

        expect(
          globalPayloads.every(
            (
              payload
            ) =>
              payload.city_key ===
                null ||
              payload.city_key ===
                undefined
          )
        ).toBe(true)
      }
    )
  }
)

/* =========================================================
 * Ranking refresh behavior
 * ======================================================= */

describe(
  'ranking refresh behavior',
  () => {
    it(
      'refreshes rankings only after reputation writes succeed',
      async () => {
        const callOrder:
          string[] = []

        mocks.supabaseClient
          .__setFixtures([
            ...defaultFixtures(),

            {
              table:
                'creator_reputation_stats',

              response: (
                operation
              ) => {
                if (
                  operation.operation ===
                    'upsert' ||
                  operation.operation ===
                    'insert' ||
                  operation.operation ===
                    'update'
                ) {
                  callOrder.push(
                    'write'
                  )
                }

                return {
                  data:
                    normalizeReturnedWriteData(
                      operation.payload
                    ),

                  error:
                    null,
                }
              },
            },
          ])

        mocks.rebuildReputationRankings
          .mockImplementation(
            async () => {
              callOrder.push(
                'rankings'
              )

              return {
                rebuilt:
                  true,
              }
            }
          )

        await invokeRebuild({
          userId:
            USER_ID,

          skipRankings:
            false,
        })

        if (
          mocks.rebuildReputationRankings
            .mock.calls.length >
          0
        ) {
          expect(
            callOrder.indexOf(
              'write'
            )
          ).toBeGreaterThanOrEqual(
            0
          )

          expect(
            callOrder.indexOf(
              'rankings'
            )
          ).toBeGreaterThan(
            callOrder.indexOf(
              'write'
            )
          )
        }
      }
    )

    it(
      'does not refresh rankings when skipRankings is enabled',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,

          skipRankings:
            true,
        })

        expect(
          mocks.rebuildReputationRankings
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'does not refresh rankings when the canonical write fails',
      async () => {
        mocks.supabaseClient
          .__setFixtures([
            ...defaultFixtures(),

            {
              table:
                'creator_reputation_stats',

              response: {
                data:
                  null,

                error: {
                  code:
                    'XX000',

                  message:
                    'Reputation write failed',
                },
              },
            },
          ])

        await expect(
          invokeRebuild({
            userId:
              USER_ID,

            skipRankings:
              false,
          })
        ).rejects.toThrow()

        expect(
          mocks.rebuildReputationRankings
        ).not.toHaveBeenCalled()
      }
    )
  }
)

/* =========================================================
 * Error propagation
 * ======================================================= */

describe(
  'database error handling',
  () => {
    it(
      'propagates canonical evidence read failures',
      async () => {
        mocks.supabaseClient
          .__setFixtures([
            ...defaultFixtures(),

            {
              table:
                'venue_visits',

              response: {
                data:
                  null,

                error: {
                  code:
                    'XX000',

                  message:
                    'Venue visits unavailable',
                },
              },
            },
          ])

        await expect(
          invokeRebuild({
            userId:
              USER_ID,
          })
        ).rejects.toThrow()
      }
    )

    it(
      'does not silently report success after a canonical write failure',
      async () => {
        mocks.supabaseClient
          .__setFixtures([
            ...defaultFixtures(),

            {
              table:
                'creator_reputation_stats',

              response: {
                data:
                  null,

                error: {
                  code:
                    '23514',

                  message:
                    'Constraint violation',
                },
              },
            },
          ])

        await expect(
          invokeRebuild({
            userId:
              USER_ID,
          })
        ).rejects.toThrow()
      }
    )
  }
)

/* =========================================================
 * Idempotency
 * ======================================================= */

describe(
  'rebuild idempotency',
  () => {
    it(
      'produces equivalent canonical payloads for identical evidence',
      async () => {
        await invokeRebuild({
          userId:
            USER_ID,

          calculatedAt:
            CALCULATED_AT,

          skipRankings:
            true,
        })

        const firstPayloads =
          normalizeComparablePayloads(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        mocks.supabaseClient
          .__reset()

        installDefaultFixtures()

        await invokeRebuild({
          userId:
            USER_ID,

          calculatedAt:
            CALCULATED_AT,

          skipRankings:
            true,
        })

        const secondPayloads =
          normalizeComparablePayloads(
            writeOperationsForTable(
              'creator_reputation_stats'
            )
          )

        expect(
          secondPayloads
        ).toEqual(
          firstPayloads
        )
      }
    )
  }
)

/* =========================================================
 * Invocation adapter
 * ======================================================= */

async function invokeRebuild({
  userId,
  policyVersion =
    POLICY_VERSION,
  scope,
  cityKey,
  categoryId,
  calculatedAt =
    CALCULATED_AT,
  skipRankings =
    true,
}: {
  userId: unknown
  policyVersion?: unknown
  scope?:
    | 'global'
    | 'city'
  cityKey?:
    | string
    | null
  categoryId?: string
  calculatedAt?: string
  skipRankings?: boolean
}): Promise<unknown> {
  const options = {
    userId,
    user_id:
      userId,

    policyVersion,
    policy_version:
      policyVersion,

    calculatedAt,
    calculated_at:
      calculatedAt,

    skipRankings,
    skip_rankings:
      skipRankings,

    ...(scope
      ? {
          scope,
        }
      : {}),

    ...(cityKey !==
    undefined
      ? {
          cityKey,
          city_key:
            cityKey,
        }
      : {}),

    ...(categoryId
      ? {
          categoryId,
          category_id:
            categoryId,
        }
      : {}),
  }

  /**
   * Supported signatures:
   *
   * rebuildCreatorReputation({
   *   userId,
   *   policyVersion,
   *   ...
   * })
   *
   * rebuildCreatorReputation(
   *   userId,
   *   options
   * )
   */
  if (
    rebuildCreatorReputation.length >=
    2
  ) {
    return Promise.resolve(
      rebuildCreatorReputation(
        userId,
        options
      )
    )
  }

  return Promise.resolve(
    rebuildCreatorReputation(
      options
    )
  )
}

/* =========================================================
 * Supabase fixture setup
 * ======================================================= */

function installDefaultFixtures(): void {
  mocks.supabaseClient
    .__setFixtures(
      defaultFixtures()
    )
}

function defaultFixtures(): QueryFixture[] {
  return [
    {
      table:
        'profiles',

      response: {
        data: {
          id:
            USER_ID,

          username:
            'test-creator',
        },

        error:
          null,
      },
    },

    {
      table:
        'creator_profiles',

      response: {
        data: {
          user_id:
            USER_ID,

          primary_city:
            'atl',
        },

        error:
          null,
      },
    },

    {
      table:
        'venue_visits',

      response: {
        data: [
          {
            user_id:
              USER_ID,

            venue_id:
              VENUE_ID,

            geo_verified:
              true,

            visited_at:
              '2026-07-20T12:00:00.000Z',
          },
        ],

        error:
          null,
      },
    },

    {
      table:
        'venues',

      response: {
        data: [
          {
            id:
              VENUE_ID,

            city:
              'atl',

            tier:
              'coffee',
          },
        ],

        error:
          null,
      },
    },

    {
      table:
        'venue_reputation_categories',

      response: {
        data: [
          {
            venue_id:
              VENUE_ID,

            category_id:
              'coffee',

            weight:
              1,
          },
        ],

        error:
          null,
      },
    },

    {
      table:
        'venue_reputation_category_assignments',

      response: {
        data: [
          {
            venue_id:
              VENUE_ID,

            category_id:
              'coffee',

            weight:
              1,
          },
        ],

        error:
          null,
      },
    },

    {
      table:
        'venue_categories',

      response: {
        data: [
          {
            venue_id:
              VENUE_ID,

            category_id:
              'coffee',
          },
        ],

        error:
          null,
      },
    },

    {
      table:
        'creator_collections',

      response: {
        data: [
          {
            id:
              'c734a42b-d1af-41f6-8bc8-cecf26d41a7c',

            user_id:
              USER_ID,

            city:
              'atl',

            category:
              'coffee',

            visibility:
              'public',
          },
        ],

        error:
          null,

        count:
          1,
      },
    },

    {
      table:
        'creator_collection_venues',

      response: {
        data: [
          {
            collection_id:
              'c734a42b-d1af-41f6-8bc8-cecf26d41a7c',

            venue_id:
              VENUE_ID,
          },
        ],

        error:
          null,

        count:
          1,
      },
    },

    {
      table:
        'flow_snapshots',

      response: {
        data: [
          {
            id:
              '46e9949b-a56f-488e-ae07-131278cd3277',

            user_id:
              USER_ID,

            city:
              'atl',

            visibility:
              'public',

            status:
              'completed',
          },
        ],

        error:
          null,

        count:
          1,
      },
    },

    {
      table:
        'active_flow_sessions',

      response: {
        data: [
          {
            id:
              'fda73750-160e-42a1-ad51-8997dd56f409',

            user_id:
              USER_ID,

            city:
              'atl',

            status:
              'completed',
          },
        ],

        error:
          null,

        count:
          1,
      },
    },

    {
      table:
        'creator_reputation_stats',

      response: (
        operation
      ) => ({
        data:
          normalizeReturnedWriteData(
            operation.payload
          ),

        error:
          null,
      }),
    },

    {
      table:
        'creator_reputation_category_stats',

      response: (
        operation
      ) => ({
        data:
          normalizeReturnedWriteData(
            operation.payload
          ),

        error:
          null,
      }),
    },
  ]
}

/* =========================================================
 * Supabase mock implementation
 * ======================================================= */

function createMockSupabaseClient(): MockSupabaseClient {
  let fixtures:
    QueryFixture[] = []

  const operations:
    QueryOperation[] = []

  const client: MockSupabaseClient = {
    from:
      vi.fn(
        (
          table: string
        ) =>
          createQueryBuilder({
            table,
            fixtures: () =>
              fixtures,
            operations,
          })
      ),

    auth: {
      admin: {
        getUserById:
          vi.fn(
            async (
              userId: string
            ) => ({
              data: {
                user: {
                  id:
                    userId,
                },
              },

              error:
                null,
            })
          ),
      },
    },

    __operations:
      operations,

    __setFixtures:
      (
        nextFixtures
      ) => {
        fixtures = [
          ...nextFixtures,
        ]
      },

    __reset:
      () => {
        fixtures = []
        operations.splice(
          0,
          operations.length
        )

        client.from
          .mockClear()

        client.auth.admin
          .getUserById
          .mockClear()

        client.auth.admin
          .getUserById
          .mockImplementation(
            async (
              userId: string
            ) => ({
              data: {
                user: {
                  id:
                    userId,
                },
              },

              error:
                null,
            })
          )
      },
  }

  return client
}

function createQueryBuilder({
  table,
  fixtures,
  operations,
}: {
  table: string
  fixtures: () =>
    QueryFixture[]
  operations:
    QueryOperation[]
}) {
  const operation:
    QueryOperation = {
      table,
      operation:
        'select',
      filters: [],
  }

  let executed = false

  const execute =
    async (): Promise<QueryResponse> => {
      if (!executed) {
        operations.push(
          structuredCloneSafe(
            operation
          )
        )

        executed = true
      }

      const matchingFixture =
        findFixture(
          fixtures(),
          table
        )

      if (!matchingFixture) {
        return {
          data:
            defaultDataForOperation(
              operation
            ),

          error:
            null,

          count:
            operation.operation ===
              'select'
              ? 0
              : null,
        }
      }

      return typeof matchingFixture.response ===
        'function'
        ? matchingFixture.response(
            operation
          )
        : matchingFixture.response
    }

  const builder:
    UnknownRecord = {
    select(
      _columns?: unknown,
      _options?: unknown
    ) {
      if (
        operation.operation !==
          'insert' &&
        operation.operation !==
          'upsert' &&
        operation.operation !==
          'update' &&
        operation.operation !==
          'delete'
      ) {
        operation.operation =
          'select'
      }

      return builder
    },

    insert(
      payload: unknown,
      options?: unknown
    ) {
      operation.operation =
        'insert'

      operation.payload =
        payload

      operation.options =
        options

      return builder
    },

    upsert(
      payload: unknown,
      options?: unknown
    ) {
      operation.operation =
        'upsert'

      operation.payload =
        payload

      operation.options =
        options

      return builder
    },

    update(
      payload: unknown
    ) {
      operation.operation =
        'update'

      operation.payload =
        payload

      return builder
    },

    delete() {
      operation.operation =
        'delete'

      return builder
    },

    eq(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'eq',
        column,
        value,
      })

      return builder
    },

    neq(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'neq',
        column,
        value,
      })

      return builder
    },

    in(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'in',
        column,
        value,
      })

      return builder
    },

    is(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'is',
        column,
        value,
      })

      return builder
    },

    gt(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'gt',
        column,
        value,
      })

      return builder
    },

    gte(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'gte',
        column,
        value,
      })

      return builder
    },

    lt(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'lt',
        column,
        value,
      })

      return builder
    },

    lte(
      column: string,
      value: unknown
    ) {
      operation.filters.push({
        type:
          'lte',
        column,
        value,
      })

      return builder
    },

    order(
      column: string,
      options?: unknown
    ) {
      operation.filters.push({
        type:
          'order',
        column,
        value:
          options,
      })

      return builder
    },

    limit(
      value: number
    ) {
      operation.filters.push({
        type:
          'limit',
        value,
      })

      return builder
    },

    range(
      from: number,
      to: number
    ) {
      operation.filters.push({
        type:
          'range',
        value: [
          from,
          to,
        ],
      })

      return builder
    },

    maybeSingle:
      execute,

    single:
      execute,

    then(
      onFulfilled:
        (
          value:
            QueryResponse
        ) => unknown,
      onRejected?:
        (
          reason:
            unknown
        ) => unknown
    ) {
      return execute().then(
        onFulfilled,
        onRejected
      )
    },
  }

  return builder
}

function findFixture(
  fixtures:
    readonly QueryFixture[],
  table: string
): QueryFixture | null {
  const matching =
    fixtures.filter(
      (
        fixture
      ) =>
        fixture.table ===
        table
    )

  return matching.length >
    0
    ? matching[
        matching.length -
        1
      ]
    : null
}

/* =========================================================
 * Operation helpers
 * ======================================================= */

function operationsForTable(
  table: string
): QueryOperation[] {
  return mocks.supabaseClient
    .__operations
    .filter(
      (
        operation
      ) =>
        operation.table ===
        table
    )
}

function writeOperationsForTable(
  table: string
): QueryOperation[] {
  return operationsForTable(
    table
  ).filter(
    (
      operation
    ) =>
      operation.operation ===
        'insert' ||
      operation.operation ===
        'upsert' ||
      operation.operation ===
        'update' ||
      operation.operation ===
        'delete'
  )
}

function flattenPayloadRecords(
  operations:
    readonly QueryOperation[]
): UnknownRecord[] {
  const records:
    UnknownRecord[] = []

  for (
    const operation of
      operations
  ) {
    if (
      Array.isArray(
        operation.payload
      )
    ) {
      for (
        const item of
          operation.payload
      ) {
        if (
          isRecord(item)
        ) {
          records.push(item)
        }
      }

      continue
    }

    if (
      isRecord(
        operation.payload
      )
    ) {
      records.push(
        operation.payload
      )
    }
  }

  return records
}

function normalizeComparablePayloads(
  operations:
    readonly QueryOperation[]
): UnknownRecord[] {
  return flattenPayloadRecords(
    operations
  )
    .map(
      (
        payload
      ) => {
        const comparable = {
          ...payload,
        }

        delete comparable.updated_at
        delete comparable.created_at

        return comparable
      }
    )
    .sort(
      (
        first,
        second
      ) =>
        JSON.stringify(
          first
        ).localeCompare(
          JSON.stringify(
            second
          )
        )
    )
}

function normalizeReturnedWriteData(
  payload: unknown
): unknown {
  if (
    Array.isArray(payload)
  ) {
    return payload
  }

  if (
    isRecord(payload)
  ) {
    return payload
  }

  return null
}

function defaultDataForOperation(
  operation:
    QueryOperation
): unknown {
  if (
    operation.operation ===
      'select'
  ) {
    return []
  }

  return normalizeReturnedWriteData(
    operation.payload
  )
}

/* =========================================================
 * Module loading
 * ======================================================= */

function loadRequiredFunction(
  moduleValue: UnknownRecord,
  exportNames:
    readonly string[]
): RebuildFunction {
  for (
    const exportName of
      exportNames
  ) {
    const candidate =
      moduleValue[
        exportName
      ]

    if (
      typeof candidate ===
      'function'
    ) {
      return candidate as RebuildFunction
    }
  }

  throw new Error(
    [
      'Unable to locate the creator reputation rebuild function.',
      `Expected one of: ${exportNames.join(
        ', '
      )}.`,
      `Available exports: ${Object.keys(
        moduleValue
      ).join(', ') || '(none)'}.`,
    ].join(' ')
  )
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function containsNestedValue(
  value: unknown,
  key: string,
  expected:
    unknown
): boolean {
  if (
    Array.isArray(value)
  ) {
    return value.some(
      (
        item
      ) =>
        containsNestedValue(
          item,
          key,
          expected
        )
    )
  }

  if (!isRecord(value)) {
    return false
  }

  if (
    value[key] ===
    expected
  ) {
    return true
  }

  return Object.values(
    value
  ).some(
    (
      item
    ) =>
      containsNestedValue(
        item,
        key,
        expected
      )
  )
}

function structuredCloneSafe<
  TValue,
>(
  value: TValue
): TValue {
  if (
    typeof structuredClone ===
    'function'
  ) {
    return structuredClone(
      value
    )
  }

  return JSON.parse(
    JSON.stringify(
      value
    )
  ) as TValue
}

function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}