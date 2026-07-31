import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

/* =========================================================
 * Hoisted module mocks
 * ======================================================= */

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin:
    vi.fn(),
}))

vi.mock(
  'server-only',
  () => ({})
)

vi.mock(
  '@/lib/supabase/admin',
  () => ({
    getSupabaseAdmin:
      mocks.getSupabaseAdmin,
  })
)

vi.mock(
  '@/lib/cities/normalizeCity',
  () => ({
    normalizeCityKey(
      value: unknown
    ): string {
      if (
        typeof value !==
        'string'
      ) {
        return ''
      }

      return value
        .normalize('NFKD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          '_'
        )
        .replace(
          /^_+|_+$/g,
          ''
        )
    },

    getCityLabel(
      value: unknown
    ): string | null {
      if (
        typeof value !==
        'string'
      ) {
        return null
      }

      const normalized =
        value
          .trim()
          .replace(
            /[_-]+/g,
            ' '
          )
          .replace(
            /\s+/g,
            ' '
          )

      if (!normalized) {
        return null
      }

      return normalized.replace(
        /\b\w/g,
        (
          character
        ) =>
          character.toUpperCase()
      )
    },
  })
)

import {
  getPublicCreatorReputation,
} from '@/lib/reputation/getPublicCreatorReputation'

/* =========================================================
 * Test contracts
 * ======================================================= */

type DatabaseError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

type QueryResult = {
  data: unknown
  error: DatabaseError | null
  count?: number | null
}

type QueryOperation = {
  method:
    | 'select'
    | 'eq'
    | 'in'

  args: unknown[]
}

type MockQueryBuilder = {
  operations: QueryOperation[]

  select:
    ReturnType<
      typeof vi.fn
    >

  eq:
    ReturnType<
      typeof vi.fn
    >

  in:
    ReturnType<
      typeof vi.fn
    >

  then:
    Promise<QueryResult>['then']
}

type MockSupabaseAdmin = {
  from:
    ReturnType<
      typeof vi.fn
    >
}

/* =========================================================
 * Canonical fixtures
 * ======================================================= */

const USER_ID =
  '11111111-1111-4111-8111-111111111111'

const OTHER_USER_ID =
  '22222222-2222-4222-8222-222222222222'

const CALCULATED_AT =
  '2026-07-20T12:00:00.000Z'

const NEWER_CALCULATED_AT =
  '2026-07-21T12:00:00.000Z'

function createStatsRow(
  overrides: Record<
    string,
    unknown
  > = {}
): Record<string, unknown> {
  return {
    user_id:
      USER_ID,

    category_id:
      'coffee',

    scope:
      'city',

    city_key:
      'atlanta',

    policy_version:
      2,

    reputation_level:
      'expert',

    reputation_score:
      82.5,

    verified_venue_count:
      17,

    weighted_venue_count:
      15.5,

    public_collection_count:
      4,

    curated_venue_count:
      12,

    public_snapshot_count:
      3,

    completed_flow_count:
      8,

    city_count:
      2,

    rank:
      4,

    eligible_creator_count:
      40,

    top_percent:
      10,

    rank_label:
      '#4',

    ranking_calculated_at:
      CALCULATED_AT,

    calculated_at:
      CALCULATED_AT,

    updated_at:
      CALCULATED_AT,

    ...overrides,
  }
}

function createCategoryRow(
  overrides: Record<
    string,
    unknown
  > = {}
): Record<string, unknown> {
  return {
    id:
      'coffee',

    label:
      'Coffee Explorer',

    short_label:
      'Coffee',

    description:
      'Verified coffee venue exploration.',

    sort_order:
      10,

    is_active:
      true,

    ...overrides,
  }
}

/* =========================================================
 * Supabase query mocks
 * ======================================================= */

function createQueryBuilder(
  result: QueryResult
): MockQueryBuilder {
  const operations:
    QueryOperation[] = []

  const builder =
    {} as MockQueryBuilder

  builder.operations =
    operations

  builder.select =
    vi.fn(
      (
        ...args: unknown[]
      ) => {
        operations.push({
          method:
            'select',

          args,
        })

        return builder
      }
    )

  builder.eq =
    vi.fn(
      (
        ...args: unknown[]
      ) => {
        operations.push({
          method:
            'eq',

          args,
        })

        return builder
      }
    )

  builder.in =
    vi.fn(
      (
        ...args: unknown[]
      ) => {
        operations.push({
          method:
            'in',

          args,
        })

        return builder
      }
    )

  const promise =
    Promise.resolve(
      result
    )

  builder.then =
    promise.then.bind(
      promise
    )

  return builder
}

function createSupabaseMock({
  statsResult,
  categoryResult,
}: {
  statsResult?: QueryResult
  categoryResult?: QueryResult
} = {}) {
  const statsBuilder =
    createQueryBuilder(
      statsResult ?? {
        data: [],
        error: null,
      }
    )

  const categoryBuilder =
    createQueryBuilder(
      categoryResult ?? {
        data: [],
        error: null,
      }
    )

  const supabase:
    MockSupabaseAdmin = {
    from:
      vi.fn(
        (
          table: string
        ) => {
          if (
            table ===
            'creator_reputation_stats'
          ) {
            return statsBuilder
          }

          if (
            table ===
            'reputation_categories'
          ) {
            return categoryBuilder
          }

          throw new Error(
            `Unexpected Supabase table: ${table}`
          )
        }
      ),
  }

  return {
    supabase,
    statsBuilder,
    categoryBuilder,
  }
}

function installSupabaseMock(
  configuration?: Parameters<
    typeof createSupabaseMock
  >[0]
) {
  const mock =
    createSupabaseMock(
      configuration
    )

  mocks.getSupabaseAdmin.mockReturnValue(
    mock.supabase
  )

  return mock
}

/* =========================================================
 * Tests
 * ======================================================= */

describe(
  'getPublicCreatorReputation',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it(
      'returns an empty public snapshot without querying Supabase when userId is blank',
      async () => {
        const result =
          await getPublicCreatorReputation(
            '   '
          )

        expect(
          result
        ).toEqual({
          reputation: {
            userId:
              '',

            primaryCityKey:
              null,

            primaryCityLabel:
              null,

            primaryCategory:
              null,

            categories:
              [],

            evidence: {
              verifiedVenueCount:
                0,

              weightedVenueCount:
                0,

              publicCollectionCount:
                0,

              curatedVenueCount:
                0,

              publicSnapshotCount:
                0,

              completedFlowCount:
                0,

              cityCount:
                0,
            },

            highestLevel:
              'unranked',

            headline:
              null,

            summary:
              null,

            policyVersion:
              0,

            calculatedAt:
              null,
          },

          found:
            false,
        })

        expect(
          mocks.getSupabaseAdmin
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'returns an empty snapshot without querying Supabase when both scopes are disabled',
      async () => {
        const result =
          await getPublicCreatorReputation(
            ` ${USER_ID} `,
            {
              policyVersion:
                7,

              includeGlobal:
                false,

              includeCity:
                false,
            }
          )

        expect(
          result
        ).toMatchObject({
          found:
            false,

          reputation: {
            userId:
              USER_ID,

            policyVersion:
              7,

            highestLevel:
              'unranked',

            categories:
              [],
          },
        })

        expect(
          mocks.getSupabaseAdmin
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'returns an empty snapshot when no policy version exists',
      async () => {
        const {
          supabase,
        } =
          installSupabaseMock({
            statsResult: {
              data: [],
              error: null,
            },
          })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result
        ).toMatchObject({
          found:
            false,

          reputation: {
            userId:
              USER_ID,

            policyVersion:
              0,

            highestLevel:
              'unranked',

            headline:
              null,

            calculatedAt:
              null,

            categories:
              [],
          },
        })

        expect(
          supabase.from
        ).toHaveBeenCalledTimes(
          1
        )

        expect(
          supabase.from
        ).toHaveBeenCalledWith(
          'creator_reputation_stats'
        )
      }
    )

    it(
      'throws a descriptive error when reputation stats cannot be loaded',
      async () => {
        installSupabaseMock({
          statsResult: {
            data:
              null,

            error: {
              message:
                'permission denied',

              code:
                '42501',

              details:
                'service role unavailable',

              hint:
                'check credentials',
            },
          },
        })

        await expect(
          getPublicCreatorReputation(
            USER_ID
          )
        ).rejects.toThrow(
          '[getPublicCreatorReputation] Failed to load creator reputation stats: permission denied | code=42501 | details=service role unavailable | hint=check credentials'
        )
      }
    )

    it(
      'automatically selects the newest available policy version',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                policy_version:
                  1,

                reputation_level:
                  'elite',

                reputation_score:
                  99,
              }),

              createStatsRow({
                policy_version:
                  3,

                reputation_level:
                  'emerging',

                reputation_score:
                  35,

                calculated_at:
                  NEWER_CALCULATED_AT,
              }),

              createStatsRow({
                policy_version:
                  2,

                reputation_level:
                  'expert',

                reputation_score:
                  82.5,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.found
        ).toBe(true)

        expect(
          result.reputation
            .policyVersion
        ).toBe(3)

        expect(
          result.reputation
            .highestLevel
        ).toBe(
          'emerging'
        )

        expect(
          result.reputation
            .primaryCategory
            ?.reputationScore
        ).toBe(35)

        expect(
          result.reputation
            .calculatedAt
        ).toBe(
          NEWER_CALCULATED_AT
        )
      }
    )

    it(
      'applies an explicitly requested policy version to the Supabase query',
      async () => {
        const {
          statsBuilder,
        } =
          installSupabaseMock({
            statsResult: {
              data: [
                createStatsRow({
                  policy_version:
                    4,
                }),
              ],

              error:
                null,
            },

            categoryResult: {
              data: [
                createCategoryRow(),
              ],

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              policyVersion:
                4,
            }
          )

        expect(
          result.reputation
            .policyVersion
        ).toBe(4)

        expect(
          statsBuilder.eq
        ).toHaveBeenCalledWith(
          'user_id',
          USER_ID
        )

        expect(
          statsBuilder.eq
        ).toHaveBeenCalledWith(
          'policy_version',
          4
        )
      }
    )

    it(
      'excludes unranked category rows by default',
      async () => {
        const {
          supabase,
        } =
          installSupabaseMock({
            statsResult: {
              data: [
                createStatsRow({
                  reputation_level:
                    'unranked',
                }),
              ],

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.found
        ).toBe(false)

        expect(
          result.reputation
            .categories
        ).toEqual([])

        expect(
          supabase.from
        ).toHaveBeenCalledTimes(
          1
        )
      }
    )

    it(
      'includes unranked category rows when explicitly requested',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                reputation_level:
                  'unranked',

                reputation_score:
                  4,

                rank:
                  null,

                eligible_creator_count:
                  0,

                top_percent:
                  null,

                rank_label:
                  null,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              includeUnranked:
                true,
            }
          )

        expect(
          result.found
        ).toBe(true)

        expect(
          result.reputation
            .highestLevel
        ).toBe(
          'unranked'
        )

        expect(
          result.reputation
            .primaryCategory
        ).toMatchObject({
          categoryId:
            'coffee',

          primaryLabel:
            'Atlanta Coffee',

          compactLabel:
            'Coffee',

          reputationLevel:
            'unranked',

          rankLabel:
            null,
        })
      }
    )

    it(
      'honors global-only scope filtering',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id:
                  'restaurants',

                scope:
                  'global',

                city_key:
                  'must_not_be_exposed',

                reputation_level:
                  'elite',

                reputation_score:
                  96,
              }),

              createStatsRow({
                category_id:
                  'coffee',

                scope:
                  'city',

                city_key:
                  'atlanta',

                reputation_level:
                  'expert',

                reputation_score:
                  82,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow({
                id:
                  'restaurants',

                label:
                  'Restaurant Explorer',

                short_label:
                  'Restaurants',
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              includeGlobal:
                true,

              includeCity:
                false,
            }
          )

        expect(
          result.reputation
            .categories
        ).toHaveLength(1)

        expect(
          result.reputation
            .categories[0]
        ).toMatchObject({
          categoryId:
            'restaurants',

          scope:
            'global',

          cityKey:
            null,

          cityLabel:
            null,
        })

        expect(
          result.reputation
            .primaryCityKey
        ).toBeNull()
      }
    )

    it(
      'honors city-only scope filtering',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id:
                  'restaurants',

                scope:
                  'global',

                city_key:
                  null,

                reputation_level:
                  'elite',
              }),

              createStatsRow({
                category_id:
                  'coffee',

                scope:
                  'city',

                city_key:
                  'atlanta',

                reputation_level:
                  'expert',
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              includeGlobal:
                false,

              includeCity:
                true,
            }
          )

        expect(
          result.reputation
            .categories
        ).toHaveLength(1)

        expect(
          result.reputation
            .categories[0]
        ).toMatchObject({
          categoryId:
            'coffee',

          scope:
            'city',

          cityKey:
            'atlanta',

          cityLabel:
            'Atlanta',
        })
      }
    )

    it(
      'ignores malformed, wrong-user, wrong-policy, and invalid-city rows',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow(),

              createStatsRow({
                user_id:
                  OTHER_USER_ID,

                category_id:
                  'restaurants',
              }),

              createStatsRow({
                policy_version:
                  1,

                category_id:
                  'nightlife',
              }),

              createStatsRow({
                category_id:
                  '',
              }),

              createStatsRow({
                scope:
                  'invalid',
              }),

              createStatsRow({
                scope:
                  'city',

                city_key:
                  '   ',
              }),

              createStatsRow({
                calculated_at:
                  'invalid-date',

                updated_at:
                  'also-invalid',
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.found
        ).toBe(true)

        expect(
          result.reputation
            .categories
        ).toHaveLength(1)

        expect(
          result.reputation
            .primaryCategory
            ?.categoryId
        ).toBe(
          'coffee'
        )
      }
    )

    it(
      'loads only active category metadata and excludes missing categories',
      async () => {
        const {
          categoryBuilder,
        } =
          installSupabaseMock({
            statsResult: {
              data: [
                createStatsRow({
                  category_id:
                    'coffee',
                }),

                createStatsRow({
                  category_id:
                    'restaurants',
                }),

                createStatsRow({
                  category_id:
                    'missing_category',
                }),
              ],

              error:
                null,
            },

            categoryResult: {
              data: [
                createCategoryRow({
                  id:
                    'coffee',
                }),

                createCategoryRow({
                  id:
                    'restaurants',

                  label:
                    'Restaurant Explorer',

                  short_label:
                    'Restaurants',

                  is_active:
                    false,
                }),
              ],

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          categoryBuilder.in
        ).toHaveBeenCalledWith(
          'id',
          [
            'coffee',
            'restaurants',
            'missing_category',
          ]
        )

        expect(
          categoryBuilder.eq
        ).toHaveBeenCalledWith(
          'is_active',
          true
        )

        expect(
          result.reputation
            .categories
            .map(
              (
                category
              ) =>
                category.categoryId
            )
        ).toEqual([
          'coffee',
        ])
      }
    )

    it(
      'returns not found when no active category metadata remains',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow(),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow({
                is_active:
                  false,
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result
        ).toMatchObject({
          found:
            false,

          reputation: {
            userId:
              USER_ID,

            categories:
              [],

            policyVersion:
              2,

            highestLevel:
              'unranked',
          },
        })
      }
    )

    it(
      'throws a descriptive error when category metadata cannot be loaded',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow(),
            ],

            error:
              null,
          },

          categoryResult: {
            data:
              null,

            error: {
              message:
                'category lookup failed',

              code:
                'XX001',
            },
          },
        })

        await expect(
          getPublicCreatorReputation(
            USER_ID
          )
        ).rejects.toThrow(
          '[getPublicCreatorReputation] Failed to load reputation categories: category lookup failed | code=XX001'
        )
      }
    )

    it(
      'determines the strongest city and prefers that city row for each category',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id:
                  'coffee',

                city_key:
                  'atlanta',

                reputation_level:
                  'expert',

                reputation_score:
                  80,
              }),

              createStatsRow({
                category_id:
                  'coffee',

                city_key:
                  'chicago',

                reputation_level:
                  'elite',

                reputation_score:
                  95,
              }),

              createStatsRow({
                category_id:
                  'restaurants',

                city_key:
                  'chicago',

                reputation_level:
                  'established',

                reputation_score:
                  70,
              }),

              createStatsRow({
                category_id:
                  'restaurants',

                scope:
                  'global',

                city_key:
                  null,

                reputation_level:
                  'elite',

                reputation_score:
                  99,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),

              createCategoryRow({
                id:
                  'restaurants',

                label:
                  'Restaurant Explorer',

                short_label:
                  'Restaurants',

                sort_order:
                  20,
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCityKey
        ).toBe(
          'chicago'
        )

        expect(
          result.reputation
            .primaryCityLabel
        ).toBe(
          'Chicago'
        )

        const categories =
          new Map(
            result.reputation
              .categories.map(
                (
                  category
                ) => [
                  category.categoryId,
                  category,
                ]
              )
          )

        expect(
          categories.get(
            'coffee'
          )
        ).toMatchObject({
          scope:
            'city',

          cityKey:
            'chicago',

          reputationLevel:
            'elite',
        })

        expect(
          categories.get(
            'restaurants'
          )
        ).toMatchObject({
          scope:
            'city',

          cityKey:
            'chicago',

          reputationLevel:
            'established',
        })
      }
    )

    it(
      'orders categories by level, score, rank, and category sort order',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id:
                  'coffee',

                reputation_level:
                  'expert',

                reputation_score:
                  80,

                rank:
                  5,
              }),

              createStatsRow({
                category_id:
                  'restaurants',

                reputation_level:
                  'elite',

                reputation_score:
                  60,

                rank:
                  20,
              }),

              createStatsRow({
                category_id:
                  'arts',

                reputation_level:
                  'expert',

                reputation_score:
                  80,

                rank:
                  2,
              }),

              createStatsRow({
                category_id:
                  'nightlife',

                reputation_level:
                  'expert',

                reputation_score:
                  80,

                rank:
                  2,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow({
                id:
                  'coffee',

                sort_order:
                  30,
              }),

              createCategoryRow({
                id:
                  'restaurants',

                label:
                  'Restaurant Explorer',

                short_label:
                  'Restaurants',

                sort_order:
                  40,
              }),

              createCategoryRow({
                id:
                  'arts',

                label:
                  'Arts Explorer',

                short_label:
                  'Arts',

                sort_order:
                  20,
              }),

              createCategoryRow({
                id:
                  'nightlife',

                label:
                  'Nightlife Explorer',

                short_label:
                  'Nightlife',

                sort_order:
                  10,
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .categories.map(
              (
                category
              ) =>
                category.categoryId
            )
        ).toEqual([
          'restaurants',
          'nightlife',
          'arts',
          'coffee',
        ])

        expect(
          result.reputation
            .primaryCategory
            ?.categoryId
        ).toBe(
          'restaurants'
        )

        expect(
          result.reputation
            .highestLevel
        ).toBe(
          'elite'
        )
      }
    )

    it(
      'normalizes numeric fields and uses maximum evidence values rather than summing duplicate category evidence',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id:
                  'coffee',

                reputation_score:
                  '81.25',

                verified_venue_count:
                  '17',

                weighted_venue_count:
                  '14.75',

                public_collection_count:
                  '4',

                curated_venue_count:
                  '12',

                public_snapshot_count:
                  '3',

                completed_flow_count:
                  '8',

                city_count:
                  '2',
              }),

              createStatsRow({
                category_id:
                  'restaurants',

                reputation_score:
                  -50,

                verified_venue_count:
                  12,

                weighted_venue_count:
                  11,

                public_collection_count:
                  6,

                curated_venue_count:
                  10,

                public_snapshot_count:
                  2,

                completed_flow_count:
                  5,

                city_count:
                  3,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),

              createCategoryRow({
                id:
                  'restaurants',

                label:
                  'Restaurant Explorer',

                short_label:
                  'Restaurants',
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .evidence
        ).toEqual({
          verifiedVenueCount:
            17,

          weightedVenueCount:
            14.75,

          publicCollectionCount:
            6,

          curatedVenueCount:
            12,

          publicSnapshotCount:
            3,

          completedFlowCount:
            8,

          cityCount:
            3,
        })

        expect(
          result.reputation
            .summary
        ).toBe(
          '17 verified venues · 6 public collections · 3 public snapshots'
        )

        const restaurant =
          result.reputation
            .categories.find(
              (
                category
              ) =>
                category.categoryId ===
                'restaurants'
            )

        expect(
          restaurant
            ?.reputationScore
        ).toBe(0)
      }
    )

    it(
      'uses updated_at when calculated_at is not valid',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                calculated_at:
                  'not-a-date',

                updated_at:
                  NEWER_CALCULATED_AT,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCategory
            ?.calculatedAt
        ).toBe(
          NEWER_CALCULATED_AT
        )

        expect(
          result.reputation
            .calculatedAt
        ).toBe(
          NEWER_CALCULATED_AT
        )
      }
    )

    it(
      'derives a short category label when short_label is absent',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow(),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow({
                label:
                  'Coffee Explorer',

                short_label:
                  null,
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCategory
        ).toMatchObject({
          categoryLabel:
            'Coffee Explorer',

          categoryShortLabel:
            'Coffee',

          primaryLabel:
            'Atlanta Coffee Expert',

          compactLabel:
            'Coffee Expert',
        })
      }
    )

    it(
      'shows an exact rank for populations of at least ten creators',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                rank:
                  3,

                eligible_creator_count:
                  10,

                top_percent:
                  30,

                rank_label:
                  null,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCategory
            ?.rankLabel
        ).toBe(
          '#3'
        )
      }
    )

    it(
      'shows a percentile rank for populations between five and nine creators',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                rank:
                  2,

                eligible_creator_count:
                  7,

                top_percent:
                  28.6,

                rank_label:
                  null,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCategory
            ?.rankLabel
        ).toBe(
          'Top 28.6%'
        )
      }
    )

    it(
      'hides public ranking claims when the eligible population is too small',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                rank:
                  1,

                eligible_creator_count:
                  4,

                top_percent:
                  25,

                rank_label:
                  '#1',
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCategory
        ).toMatchObject({
          rank:
            1,

          eligibleCreatorCount:
            4,

          topPercent:
            25,

          rankLabel:
            null,
        })
      }
    )

    it(
      'supports eligible_user_count and percentile as backward-compatible fields',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                eligible_creator_count:
                  null,

                eligible_user_count:
                  '6',

                top_percent:
                  null,

                percentile:
                  '12.5',

                rank:
                  null,

                rank_label:
                  null,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCategory
        ).toMatchObject({
          eligibleCreatorCount:
            6,

          topPercent:
            12.5,

          rankLabel:
            'Top 12.5%',
        })
      }
    )

    it(
      'normalizes city keys before exposing them publicly',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                city_key:
                  '  New York City  ',
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .primaryCityKey
        ).toBe(
          'new_york_city'
        )

        expect(
          result.reputation
            .primaryCityLabel
        ).toBe(
          'New York City'
        )

        expect(
          result.reputation
            .primaryCategory
        ).toMatchObject({
          cityKey:
            'new_york_city',

          cityLabel:
            'New York City',

          primaryLabel:
            'New York City Coffee Expert',
        })
      }
    )

    it(
      'uses the newest calculated timestamp across qualifying rows',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id:
                  'coffee',

                calculated_at:
                  CALCULATED_AT,
              }),

              createStatsRow({
                category_id:
                  'restaurants',

                calculated_at:
                  NEWER_CALCULATED_AT,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),

              createCategoryRow({
                id:
                  'restaurants',

                label:
                  'Restaurant Explorer',

                short_label:
                  'Restaurants',
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation
            .calculatedAt
        ).toBe(
          NEWER_CALCULATED_AT
        )
      }
    )

    it(
      'does not expose internal database-only fields',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                internal_weights: {
                  visitWeight:
                    4,
                },

                fraud_signals: [
                  'internal-signal',
                ],

                moderation_flags: [
                  'manual-review',
                ],

                raw_evidence_ids: [
                  'secret-evidence-id',
                ],

                administrative_notes:
                  'Never expose this value.',

                hidden_eligibility_threshold:
                  5,
              }),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow({
                internal_slug:
                  'private-slug',

                administrative_notes:
                  'Private category note.',
              }),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        const serialized =
          JSON.stringify(
            result
          )

        expect(
          serialized
        ).not.toContain(
          'internal_weights'
        )

        expect(
          serialized
        ).not.toContain(
          'fraud_signals'
        )

        expect(
          serialized
        ).not.toContain(
          'moderation_flags'
        )

        expect(
          serialized
        ).not.toContain(
          'raw_evidence_ids'
        )

        expect(
          serialized
        ).not.toContain(
          'administrative_notes'
        )

        expect(
          serialized
        ).not.toContain(
          'hidden_eligibility_threshold'
        )

        expect(
          serialized
        ).not.toContain(
          'secret-evidence-id'
        )

        expect(
          serialized
        ).not.toContain(
          'Never expose this value.'
        )
      }
    )

    it(
      'does not mutate source rows while normalizing the response',
      async () => {
        const statsRows = [
          createStatsRow({
            city_key:
              '  New York City  ',
          }),
        ]

        const categoryRows = [
          createCategoryRow({
            short_label:
              null,
          }),
        ]

        const originalStatsRows =
          JSON.parse(
            JSON.stringify(
              statsRows
            )
          )

        const originalCategoryRows =
          JSON.parse(
            JSON.stringify(
              categoryRows
            )
          )

        installSupabaseMock({
          statsResult: {
            data:
              statsRows,

            error:
              null,
          },

          categoryResult: {
            data:
              categoryRows,

            error:
              null,
          },
        })

        await getPublicCreatorReputation(
          USER_ID
        )

        expect(
          statsRows
        ).toEqual(
          originalStatsRows
        )

        expect(
          categoryRows
        ).toEqual(
          originalCategoryRows
        )
      }
    )

    it(
      'returns the canonical public snapshot for a representative creator',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow(),
            ],

            error:
              null,
          },

          categoryResult: {
            data: [
              createCategoryRow(),
            ],

            error:
              null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            ` ${USER_ID} `
          )

        expect(
          result
        ).toEqual({
          found:
            true,

          reputation: {
            userId:
              USER_ID,

            primaryCityKey:
              'atlanta',

            primaryCityLabel:
              'Atlanta',

            primaryCategory: {
              categoryId:
                'coffee',

              categoryLabel:
                'Coffee Explorer',

              categoryShortLabel:
                'Coffee',

              scope:
                'city',

              cityKey:
                'atlanta',

              cityLabel:
                'Atlanta',

              reputationLevel:
                'expert',

              reputationScore:
                82.5,

              primaryLabel:
                'Atlanta Coffee Expert',

              compactLabel:
                'Coffee Expert',

              verifiedVenueCount:
                17,

              weightedVenueCount:
                15.5,

              rank:
                4,

              eligibleCreatorCount:
                40,

              topPercent:
                10,

              rankLabel:
                '#4',

              calculatedAt:
                CALCULATED_AT,
            },

            categories: [
              {
                categoryId:
                  'coffee',

                categoryLabel:
                  'Coffee Explorer',

                categoryShortLabel:
                  'Coffee',

                scope:
                  'city',

                cityKey:
                  'atlanta',

                cityLabel:
                  'Atlanta',

                reputationLevel:
                  'expert',

                reputationScore:
                  82.5,

                primaryLabel:
                  'Atlanta Coffee Expert',

                compactLabel:
                  'Coffee Expert',

                verifiedVenueCount:
                  17,

                weightedVenueCount:
                  15.5,

                rank:
                  4,

                eligibleCreatorCount:
                  40,

                topPercent:
                  10,

                rankLabel:
                  '#4',

                calculatedAt:
                  CALCULATED_AT,
              },
            ],

            evidence: {
              verifiedVenueCount:
                17,

              weightedVenueCount:
                15.5,

              publicCollectionCount:
                4,

              curatedVenueCount:
                12,

              publicSnapshotCount:
                3,

              completedFlowCount:
                8,

              cityCount:
                2,
            },

            highestLevel:
              'expert',

            headline:
              'Atlanta Coffee Expert',

            summary:
              '17 verified venues · 4 public collections · 3 public snapshots',

            policyVersion:
              2,

            calculatedAt:
              CALCULATED_AT,
          },
        })
      }
    )
  }
)