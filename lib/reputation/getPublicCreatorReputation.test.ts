
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
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}))

vi.mock('@/lib/cities/normalizeCity', () => ({
  normalizeCityKey(value: unknown): string {
    if (typeof value !== 'string') {
      return ''
    }

    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  },

  getCityLabel(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')

    if (!normalized) {
      return null
    }

    return normalized.replace(
      /\b\w/g,
      (character) => character.toUpperCase()
    )
  },
}))

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
    | 'order'
    | 'range'
    | 'not'
  args: unknown[]
}

type MockQueryBuilder = {
  operations: QueryOperation[]
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  then: Promise<QueryResult>['then']
}

type MockSupabaseAdmin = {
  from: ReturnType<typeof vi.fn>
}

type QueryResultResolver = (
  operations: QueryOperation[]
) => QueryResult

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
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    user_id: USER_ID,
    category_id: 'coffee',
    scope: 'city',
    city_key: 'atlanta',
    policy_version: 2,
    reputation_level: 'expert',
    reputation_score: 82.5,
    verified_venue_count: 17,
    weighted_venue_count: 15.5,
    public_collection_count: 4,
    curated_venue_count: 12,
    public_snapshot_count: 3,
    completed_flow_count: 8,
    city_count: 2,
    rank: 4,
    eligible_creator_count: 40,
    top_percent: 10,
    rank_label: '#4',
    ranking_calculated_at: CALCULATED_AT,
    calculated_at: CALCULATED_AT,
    updated_at: CALCULATED_AT,
    ...overrides,
  }
}

function createCategoryRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'coffee',
    label: 'Coffee Explorer',
    short_label: 'Coffee',
    description:
      'Verified coffee venue exploration.',
    sort_order: 10,
    is_active: true,
    ...overrides,
  }
}

/* =========================================================
 * Canonical ranking population fixtures
 *
 * Public standings must be calculated from actual
 * reputation rows and public/discoverable profiles.
 *
 * Stored rank, percentile, and population fields must
 * not override the canonical calculation.
 * ======================================================= */

function createRankingPopulation({
  count,
  targetRank,
  targetRow,
  categoryId = 'coffee',
  cityKey = 'atlanta',
}: {
  count: number
  targetRank: number
  targetRow?: Record<string, unknown>
  categoryId?: string
  cityKey?: string
}): {
  rankingStatsResult: QueryResult
  profilesResult: QueryResult
} {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isInteger(targetRank) ||
    targetRank < 1 ||
    targetRank > count
  ) {
    throw new Error(
      'Invalid canonical ranking population fixture'
    )
  }

  const canonicalTargetRow = createStatsRow({
    category_id: categoryId,
    city_key: cityKey,
    ...targetRow,
  })

  const targetScore = Number(
    canonicalTargetRow.reputation_score
  )

  if (!Number.isFinite(targetScore)) {
    throw new Error(
      'Canonical ranking target must have a numeric score'
    )
  }

  const rows: Record<string, unknown>[] = []
  const profiles: Record<string, unknown>[] = []

  for (
    let position = 1;
    position <= count;
    position++
  ) {
    const isTarget =
      position === targetRank

    const userId = isTarget
      ? USER_ID
      : `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`

    /*
     * Keep reputation levels and evidence consistent.
     * Distinct scores determine the intended positions
     * without relying on persisted rank columns.
     */
    const reputationScore = isTarget
      ? targetScore
      : targetScore + (targetRank - position)

    rows.push(
      isTarget
        ? {
            ...canonicalTargetRow,
            user_id: USER_ID,
          }
        : createStatsRow({
            user_id: userId,
            category_id: categoryId,
            city_key: cityKey,
            policy_version:
              canonicalTargetRow.policy_version,
            scope:
              canonicalTargetRow.scope,
            reputation_level:
              canonicalTargetRow.reputation_level,
            reputation_score: reputationScore,
            verified_venue_count:
              canonicalTargetRow.verified_venue_count,
            weighted_venue_count:
              canonicalTargetRow.weighted_venue_count,
            public_collection_count:
              canonicalTargetRow.public_collection_count,
            curated_venue_count:
              canonicalTargetRow.curated_venue_count,
            public_snapshot_count:
              canonicalTargetRow.public_snapshot_count,
            completed_flow_count:
              canonicalTargetRow.completed_flow_count,
            city_count:
              canonicalTargetRow.city_count,
            calculated_at:
              canonicalTargetRow.calculated_at,
          })
    )

    profiles.push({
      id: userId,
      username: `creator_${position}`,
      is_public: true,
      is_discoverable: true,
    })
  }

  return {
    rankingStatsResult: {
      data: rows,
      error: null,
    },
    profilesResult: {
      data: profiles,
      error: null,
    },
  }
}

/* =========================================================
 * Supabase query mocks
 * ======================================================= */

function findOperation(
  operations: QueryOperation[],
  method: QueryOperation['method'],
  column?: string
): QueryOperation | undefined {
  return operations.find(
    (operation) =>
      operation.method === method &&
      (
        column === undefined ||
        operation.args[0] === column
      )
  )
}

function filterRows(
  rows: Record<string, unknown>[],
  operations: QueryOperation[]
): Record<string, unknown>[] {
  let filtered = [...rows]

  for (const operation of operations) {
    const [column, value, thirdArgument] =
      operation.args

    if (typeof column !== 'string') {
      continue
    }

    if (operation.method === 'eq') {
      filtered = filtered.filter(
        (row) => row[column] === value
      )
    }

    if (
      operation.method === 'in' &&
      Array.isArray(value)
    ) {
      filtered = filtered.filter(
        (row) => value.includes(row[column])
      )
    }

    if (
      operation.method === 'not' &&
      value === 'is' &&
      thirdArgument === null
    ) {
      filtered = filtered.filter(
        (row) =>
          row[column] !== null &&
          row[column] !== undefined
      )
    }
  }

  /*
   * Apply deterministic ordering before pagination.
   * Supabase supports multiple chained .order() calls.
   */
  const ordering = operations.filter(
    (operation) =>
      operation.method === 'order'
  )

  if (ordering.length > 0) {
    filtered.sort((first, second) => {
      for (const operation of ordering) {
        const column = operation.args[0]

        if (typeof column !== 'string') {
          continue
        }

        const options = operation.args[1] as
          | { ascending?: boolean }
          | undefined

        const ascending =
          options?.ascending !== false

        const firstValue =
          first[column]

        const secondValue =
          second[column]

        const comparison =
          String(firstValue ?? '').localeCompare(
            String(secondValue ?? '')
          )

        if (comparison !== 0) {
          return ascending
            ? comparison
            : -comparison
        }
      }

      return 0
    })
  }

  const range = findOperation(
    operations,
    'range'
  )

  if (range) {
    const start = Number(range.args[0])
    const end = Number(range.args[1])

    if (
      Number.isInteger(start) &&
      Number.isInteger(end)
    ) {
      filtered = filtered.slice(
        start,
        end + 1
      )
    }
  }

  return filtered
}

function createQueryBuilder(
  result:
    | QueryResult
    | QueryResultResolver
): MockQueryBuilder {
  const operations: QueryOperation[] = []

  const builder =
    {} as MockQueryBuilder

  builder.operations = operations

  function record(
    method: QueryOperation['method'],
    args: unknown[]
  ) {
    operations.push({
      method,
      args,
    })

    return builder
  }

  builder.select = vi.fn(
    (...args: unknown[]) =>
      record('select', args)
  )

  builder.eq = vi.fn(
    (...args: unknown[]) =>
      record('eq', args)
  )

  builder.in = vi.fn(
    (...args: unknown[]) =>
      record('in', args)
  )

  builder.order = vi.fn(
    (...args: unknown[]) =>
      record('order', args)
  )

  builder.range = vi.fn(
    (...args: unknown[]) =>
      record('range', args)
  )

  builder.not = vi.fn(
    (...args: unknown[]) =>
      record('not', args)
  )

  /*
   * Evaluate each query when awaited, not when the
   * builder is constructed. This makes filters and
   * pagination meaningful in canonical ranking tests.
   */
  builder.then = (
    onfulfilled,
    onrejected
  ) => {
    const resolved =
      typeof result === 'function'
        ? result(operations)
        : result

    return Promise.resolve(
      resolved
    ).then(
      onfulfilled,
      onrejected
    )
  }

  return builder
}

function createSupabaseMock({
  statsResult,
  rankingStatsResult,
  categoryResult,
  profilesResult,
}: {
  statsResult?: QueryResult
  rankingStatsResult?: QueryResult
  categoryResult?: QueryResult
  profilesResult?: QueryResult
} = {}) {
  const selectedStatsResult =
    statsResult ?? {
      data: [],
      error: null,
    }

  const selectedRankingStatsResult =
    rankingStatsResult ??
    selectedStatsResult

  const selectedCategoryResult =
    categoryResult ?? {
      data: [],
      error: null,
    }

  const selectedProfilesResult =
    profilesResult ?? {
      data: [
        {
          id: USER_ID,
          username: 'test_roamer',
          is_public: true,
          is_discoverable: true,
        },
      ],
      error: null,
    }

  /*
   * The same table serves two different purposes:
   *
   * 1. Load one creator's reputation using user_id.
   * 2. Load the entire eligible ranking population
   *    using policy_version/category_id.
   *
   * Route by query predicates, never by call count.
   */
  const resolveStats: QueryResultResolver =
    (operations) => {
      const isCreatorLookup =
        Boolean(
          findOperation(
            operations,
            'eq',
            'user_id'
          )
        )

      const source = isCreatorLookup
        ? selectedStatsResult
        : selectedRankingStatsResult

      if (
        source.error ||
        !Array.isArray(source.data)
      ) {
        return source
      }

      /*
       * Preserve existing fixture behavior for the
       * individual creator lookup. The production
       * reader already validates malformed records,
       * wrong users, and policy versions.
       */
      if (isCreatorLookup) {
        return source
      }

      return {
        ...source,
        data: filterRows(
          source.data as Record<string, unknown>[],
          operations
        ),
      }
    }

  const resolveCategories: QueryResultResolver =
    () => selectedCategoryResult

  const resolveProfiles: QueryResultResolver =
    (operations) => {
      if (
        selectedProfilesResult.error ||
        !Array.isArray(
          selectedProfilesResult.data
        )
      ) {
        return selectedProfilesResult
      }

      return {
        ...selectedProfilesResult,
        data: filterRows(
          selectedProfilesResult.data as Record<
            string,
            unknown
          >[],
          operations
        ),
      }
    }

  const statsBuilder =
    createQueryBuilder(resolveStats)

  const categoryBuilder =
    createQueryBuilder(resolveCategories)

  const profilesBuilder =
    createQueryBuilder(resolveProfiles)

  let statsBuilderUsed = false
  let categoryBuilderUsed = false
  let profilesBuilderUsed = false

  const supabase: MockSupabaseAdmin = {
    from: vi.fn((table: string) => {
      if (
        table ===
        'creator_reputation_stats'
      ) {
        /*
         * Give each additional request independent
         * query operations while preserving the
         * original statsBuilder for assertions.
         */
        if (!statsBuilderUsed) {
          statsBuilderUsed = true
          return statsBuilder
        }

        return createQueryBuilder(
          resolveStats
        )
      }

      if (
        table ===
        'reputation_categories'
      ) {
        if (!categoryBuilderUsed) {
          categoryBuilderUsed = true
          return categoryBuilder
        }

        return createQueryBuilder(
          resolveCategories
        )
      }

      if (table === 'profiles') {
        if (!profilesBuilderUsed) {
          profilesBuilderUsed = true
          return profilesBuilder
        }

        return createQueryBuilder(
          resolveProfiles
        )
      }

      throw new Error(
        `Unexpected Supabase table: ${table}`
      )
    }),
  }

  return {
    supabase,
    statsBuilder,
    categoryBuilder,
    profilesBuilder,
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

        expect(result).toEqual({
          reputation: {
            userId: '',
            primaryCityKey: null,
            primaryCityLabel: null,
            primaryCategory: null,
            categories: [],
            evidence: {
              verifiedVenueCount: 0,
              weightedVenueCount: 0,
              publicCollectionCount: 0,
              curatedVenueCount: 0,
              publicSnapshotCount: 0,
              completedFlowCount: 0,
              cityCount: 0,
            },
            highestLevel: 'unranked',
            headline: null,
            summary: null,
            policyVersion: 0,
            calculatedAt: null,
          },
          found: false,
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
              policyVersion: 7,
              includeGlobal: false,
              includeCity: false,
            }
          )

        expect(result).toMatchObject({
          found: false,
          reputation: {
            userId: USER_ID,
            policyVersion: 7,
            highestLevel: 'unranked',
            categories: [],
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
        const { supabase } =
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

        expect(result).toMatchObject({
          found: false,
          reputation: {
            userId: USER_ID,
            policyVersion: 0,
            highestLevel: 'unranked',
            headline: null,
            calculatedAt: null,
            categories: [],
          },
        })

        expect(
          supabase.from
        ).toHaveBeenCalledTimes(1)

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
            data: null,
            error: {
              message: 'permission denied',
              code: '42501',
              details: 'service role unavailable',
              hint: 'check credentials',
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
                policy_version: 1,
                reputation_level: 'elite',
                reputation_score: 99,
              }),
              createStatsRow({
                policy_version: 3,
                reputation_level: 'emerging',
                reputation_score: 35,
                calculated_at:
                  NEWER_CALCULATED_AT,
              }),
              createStatsRow({
                policy_version: 2,
                reputation_level: 'expert',
                reputation_score: 82.5,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(result.found).toBe(true)

        expect(
          result.reputation.policyVersion
        ).toBe(3)

        expect(
          result.reputation.highestLevel
        ).toBe('emerging')

        expect(
          result.reputation.primaryCategory
            ?.reputationScore
        ).toBe(35)

        expect(
          result.reputation.calculatedAt
        ).toBe(NEWER_CALCULATED_AT)
      }
    )

    it(
      'applies an explicitly requested policy version to the Supabase query',
      async () => {
        const { statsBuilder } =
          installSupabaseMock({
            statsResult: {
              data: [
                createStatsRow({
                  policy_version: 4,
                }),
              ],
              error: null,
            },
            categoryResult: {
              data: [
                createCategoryRow(),
              ],
              error: null,
            },
          })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              policyVersion: 4,
            }
          )

        expect(
          result.reputation.policyVersion
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
        const { supabase } =
          installSupabaseMock({
            statsResult: {
              data: [
                createStatsRow({
                  reputation_level:
                    'unranked',
                }),
              ],
              error: null,
            },
          })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(result.found).toBe(false)

        expect(
          result.reputation.categories
        ).toEqual([])

        expect(
          supabase.from
        ).toHaveBeenCalledTimes(1)
      }
    )

    it(
      'includes unranked category rows when explicitly requested',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                reputation_level: 'unranked',
                reputation_score: 4,
                rank: null,
                eligible_creator_count: 0,
                top_percent: null,
                rank_label: null,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              includeUnranked: true,
            }
          )

        expect(result.found).toBe(true)

        expect(
          result.reputation.highestLevel
        ).toBe('unranked')

        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          categoryId: 'coffee',
          primaryLabel: 'Atlanta Coffee',
          compactLabel: 'Coffee',
          reputationLevel: 'unranked',
          rankLabel: null,
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
                category_id: 'restaurants',
                scope: 'global',
                city_key:
                  'must_not_be_exposed',
                reputation_level: 'elite',
                reputation_score: 96,
              }),
              createStatsRow({
                category_id: 'coffee',
                scope: 'city',
                city_key: 'atlanta',
                reputation_level: 'expert',
                reputation_score: 82,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow({
                id: 'restaurants',
                label:
                  'Restaurant Explorer',
                short_label: 'Restaurants',
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              includeGlobal: true,
              includeCity: false,
            }
          )

        expect(
          result.reputation.categories
        ).toHaveLength(1)

        expect(
          result.reputation.categories[0]
        ).toMatchObject({
          categoryId: 'restaurants',
          scope: 'global',
          cityKey: null,
          cityLabel: null,
        })

        expect(
          result.reputation.primaryCityKey
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
                category_id: 'restaurants',
                scope: 'global',
                city_key: null,
                reputation_level: 'elite',
              }),
              createStatsRow({
                category_id: 'coffee',
                scope: 'city',
                city_key: 'atlanta',
                reputation_level: 'expert',
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID,
            {
              includeGlobal: false,
              includeCity: true,
            }
          )

        expect(
          result.reputation.categories
        ).toHaveLength(1)

        expect(
          result.reputation.categories[0]
        ).toMatchObject({
          categoryId: 'coffee',
          scope: 'city',
          cityKey: 'atlanta',
          cityLabel: 'Atlanta',
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
                user_id: OTHER_USER_ID,
                category_id: 'restaurants',
              }),
              createStatsRow({
                policy_version: 1,
                category_id: 'nightlife',
              }),
              createStatsRow({
                category_id: '',
              }),
              createStatsRow({
                scope: 'invalid',
              }),
              createStatsRow({
                scope: 'city',
                city_key: '   ',
              }),
              createStatsRow({
                calculated_at: 'invalid-date',
                updated_at: 'also-invalid',
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(result.found).toBe(true)

        expect(
          result.reputation.categories
        ).toHaveLength(1)

        expect(
          result.reputation.primaryCategory
            ?.categoryId
        ).toBe('coffee')
      }
    )

    it(
      'loads only active category metadata and excludes missing categories',
      async () => {
        const { categoryBuilder } =
          installSupabaseMock({
            statsResult: {
              data: [
                createStatsRow({
                  category_id: 'coffee',
                }),
                createStatsRow({
                  category_id: 'restaurants',
                }),
                createStatsRow({
                  category_id:
                    'missing_category',
                }),
              ],
              error: null,
            },
            categoryResult: {
              data: [
                createCategoryRow({
                  id: 'coffee',
                }),
                createCategoryRow({
                  id: 'restaurants',
                  label:
                    'Restaurant Explorer',
                  short_label:
                    'Restaurants',
                  is_active: false,
                }),
              ],
              error: null,
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
          result.reputation.categories.map(
            (category) =>
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
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow({
                is_active: false,
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(result).toMatchObject({
          found: false,
          reputation: {
            userId: USER_ID,
            categories: [],
            policyVersion: 2,
            highestLevel: 'unranked',
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
            error: null,
          },
          categoryResult: {
            data: null,
            error: {
              message:
                'category lookup failed',
              code: 'XX001',
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
                category_id: 'coffee',
                city_key: 'atlanta',
                reputation_level: 'expert',
                reputation_score: 80,
              }),
              createStatsRow({
                category_id: 'coffee',
                city_key: 'chicago',
                reputation_level: 'elite',
                reputation_score: 95,
              }),
              createStatsRow({
                category_id: 'restaurants',
                city_key: 'chicago',
                reputation_level:
                  'established',
                reputation_score: 70,
              }),
              createStatsRow({
                category_id: 'restaurants',
                scope: 'global',
                city_key: null,
                reputation_level: 'elite',
                reputation_score: 99,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
              createCategoryRow({
                id: 'restaurants',
                label:
                  'Restaurant Explorer',
                short_label: 'Restaurants',
                sort_order: 20,
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.primaryCityKey
        ).toBe('chicago')

        expect(
          result.reputation.primaryCityLabel
        ).toBe('Chicago')

        const categories = new Map(
          result.reputation.categories.map(
            (category) => [
              category.categoryId,
              category,
            ]
          )
        )

        expect(
          categories.get('coffee')
        ).toMatchObject({
          scope: 'city',
          cityKey: 'chicago',
          reputationLevel: 'elite',
        })

        expect(
          categories.get('restaurants')
        ).toMatchObject({
          scope: 'city',
          cityKey: 'chicago',
          reputationLevel:
            'established',
        })
      }
    )

    it(
      'orders categories by level, score, canonical rank, and category sort order',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id: 'coffee',
                reputation_level: 'expert',
                reputation_score: 80,
                rank: 5,
              }),
              createStatsRow({
                category_id: 'restaurants',
                reputation_level: 'elite',
                reputation_score: 60,
                rank: 20,
              }),
              createStatsRow({
                category_id: 'arts',
                reputation_level: 'expert',
                reputation_score: 80,
                rank: 2,
              }),
              createStatsRow({
                category_id: 'nightlife',
                reputation_level: 'expert',
                reputation_score: 80,
                rank: 2,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow({
                id: 'coffee',
                sort_order: 30,
              }),
              createCategoryRow({
                id: 'restaurants',
                label:
                  'Restaurant Explorer',
                short_label: 'Restaurants',
                sort_order: 40,
              }),
              createCategoryRow({
                id: 'arts',
                label: 'Arts Explorer',
                short_label: 'Arts',
                sort_order: 20,
              }),
              createCategoryRow({
                id: 'nightlife',
                label: 'Nightlife Explorer',
                short_label: 'Nightlife',
                sort_order: 10,
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        /*
         * Persisted ranks do not determine the order.
         * Canonical standings are attached first.
         */
        expect(
          result.reputation.categories.map(
            (category) =>
              category.categoryId
          )
        ).toEqual([
          'restaurants',
          'nightlife',
          'coffee',
          'arts',
        ])

        expect(
          result.reputation.primaryCategory
            ?.categoryId
        ).toBe('restaurants')

        expect(
          result.reputation.highestLevel
        ).toBe('elite')
      }
    )

    it(
      'normalizes numeric fields and uses maximum evidence values rather than summing duplicate category evidence',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                category_id: 'coffee',
                reputation_score: '81.25',
                verified_venue_count: '17',
                weighted_venue_count: '14.75',
                public_collection_count: '4',
                curated_venue_count: '12',
                public_snapshot_count: '3',
                completed_flow_count: '8',
                city_count: '2',
              }),
              createStatsRow({
                category_id: 'restaurants',
                reputation_score: -50,
                verified_venue_count: 12,
                weighted_venue_count: 11,
                public_collection_count: 6,
                curated_venue_count: 10,
                public_snapshot_count: 2,
                completed_flow_count: 5,
                city_count: 3,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
              createCategoryRow({
                id: 'restaurants',
                label:
                  'Restaurant Explorer',
                short_label: 'Restaurants',
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.evidence
        ).toEqual({
          verifiedVenueCount: 17,
          weightedVenueCount: 14.75,
          publicCollectionCount: 6,
          curatedVenueCount: 12,
          publicSnapshotCount: 3,
          completedFlowCount: 8,
          cityCount: 3,
        })

        expect(
          result.reputation.summary
        ).toBe(
          '17 verified venues · 6 public collections · 3 public snapshots'
        )

        const restaurant =
          result.reputation.categories.find(
            (category) =>
              category.categoryId ===
              'restaurants'
          )

        expect(
          restaurant?.reputationScore
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
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.primaryCategory
            ?.calculatedAt
        ).toBe(NEWER_CALCULATED_AT)

        expect(
          result.reputation.calculatedAt
        ).toBe(NEWER_CALCULATED_AT)
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
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow({
                label: 'Coffee Explorer',
                short_label: null,
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          categoryLabel: 'Coffee Explorer',
          categoryShortLabel: 'Coffee',
          primaryLabel:
            'Atlanta Coffee Expert',
          compactLabel: 'Coffee Expert',
        })
      }
    )

    it(
      'calculates third place from ten eligible public creators',
      async () => {
        const population =
          createRankingPopulation({
            count: 10,
            targetRank: 3,
          })

        installSupabaseMock({
          ...population,
          statsResult: {
            data: [
              createStatsRow(),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          rank: 3,
          eligibleCreatorCount: 10,
          topPercent: 30,
        })

        expect(
          result.reputation.primaryCategory
            ?.rankLabel
        ).toEqual(expect.any(String))
      }
    )

    it(
      'calculates second place from seven eligible public creators',
      async () => {
        const population =
          createRankingPopulation({
            count: 7,
            targetRank: 2,
          })

        installSupabaseMock({
          ...population,
          statsResult: {
            data: [
              createStatsRow(),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          rank: 2,
          eligibleCreatorCount: 7,
        })

        expect(
          result.reputation.primaryCategory
            ?.topPercent
        ).toBeCloseTo(28.6, 1)

        expect(
          result.reputation.primaryCategory
            ?.rankLabel
        ).toEqual(expect.any(String))
      }
    )

    it(
      'uses canonical public standings for small eligible populations',
      async () => {
        const population =
          createRankingPopulation({
            count: 4,
            targetRank: 1,
          })

        installSupabaseMock({
          ...population,
          statsResult: {
            data: [
              createStatsRow({
                rank: 1,
                eligible_creator_count: 4,
                top_percent: 25,
                rank_label: '#1',
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        /*
         * Ordinary numerical Top X% claims are allowed
         * by the canonical policy even for small
         * eligible populations.
         */
        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          rank: 1,
          eligibleCreatorCount: 4,
          topPercent: 25,
        })

        expect(
          result.reputation.primaryCategory
            ?.rankLabel
        ).toEqual(expect.any(String))
      }
    )

    it(
      'does not allow legacy ranking fields to override canonical public standings',
      async () => {
        installSupabaseMock({
          statsResult: {
            data: [
              createStatsRow({
                eligible_creator_count: null,
                eligible_user_count: '6',
                top_percent: null,
                percentile: '12.5',
                rank: null,
                rank_label: null,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        /*
         * Only one creator exists in this fixture.
         * The old six-person population and legacy
         * percentile must not be used publicly.
         */
        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          rank: 1,
          eligibleCreatorCount: 1,
          topPercent: 100,
          rankLabel: 'Top 100%',
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
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.primaryCityKey
        ).toBe('new_york_city')

        expect(
          result.reputation.primaryCityLabel
        ).toBe('New York City')

        expect(
          result.reputation.primaryCategory
        ).toMatchObject({
          cityKey: 'new_york_city',
          cityLabel: 'New York City',
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
                category_id: 'coffee',
                calculated_at: CALCULATED_AT,
              }),
              createStatsRow({
                category_id: 'restaurants',
                calculated_at:
                  NEWER_CALCULATED_AT,
              }),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
              createCategoryRow({
                id: 'restaurants',
                label:
                  'Restaurant Explorer',
                short_label: 'Restaurants',
              }),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        expect(
          result.reputation.calculatedAt
        ).toBe(NEWER_CALCULATED_AT)
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
                  visitWeight: 4,
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
                hidden_eligibility_threshold: 5,
              }),
            ],
            error: null,
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
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            USER_ID
          )

        const serialized =
          JSON.stringify(result)

        expect(serialized).not.toContain(
          'internal_weights'
        )

        expect(serialized).not.toContain(
          'fraud_signals'
        )

        expect(serialized).not.toContain(
          'moderation_flags'
        )

        expect(serialized).not.toContain(
          'raw_evidence_ids'
        )

        expect(serialized).not.toContain(
          'administrative_notes'
        )

        expect(serialized).not.toContain(
          'hidden_eligibility_threshold'
        )

        expect(serialized).not.toContain(
          'secret-evidence-id'
        )

        expect(serialized).not.toContain(
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
            short_label: null,
          }),
        ]

        const originalStatsRows =
          JSON.parse(
            JSON.stringify(statsRows)
          )

        const originalCategoryRows =
          JSON.parse(
            JSON.stringify(categoryRows)
          )

        installSupabaseMock({
          statsResult: {
            data: statsRows,
            error: null,
          },
          categoryResult: {
            data: categoryRows,
            error: null,
          },
        })

        await getPublicCreatorReputation(
          USER_ID
        )

        expect(
          statsRows
        ).toEqual(originalStatsRows)

        expect(
          categoryRows
        ).toEqual(originalCategoryRows)
      }
    )

    it(
      'returns the canonical public snapshot for a representative creator',
      async () => {
        const population =
          createRankingPopulation({
            count: 40,
            targetRank: 4,
          })

        installSupabaseMock({
          ...population,
          statsResult: {
            data: [
              createStatsRow(),
            ],
            error: null,
          },
          categoryResult: {
            data: [
              createCategoryRow(),
            ],
            error: null,
          },
        })

        const result =
          await getPublicCreatorReputation(
            ` ${USER_ID} `
          )

        expect(result).toEqual({
          found: true,
          reputation: {
            userId: USER_ID,
            primaryCityKey: 'atlanta',
            primaryCityLabel: 'Atlanta',
            primaryCategory: {
              categoryId: 'coffee',
              categoryLabel:
                'Coffee Explorer',
              categoryShortLabel: 'Coffee',
              scope: 'city',
              cityKey: 'atlanta',
              cityLabel: 'Atlanta',
              reputationLevel: 'expert',
              reputationScore: 82.5,
              primaryLabel:
                'Atlanta Coffee Expert',
              compactLabel:
                'Coffee Expert',
              verifiedVenueCount: 17,
              weightedVenueCount: 15.5,
              rank: 4,
              eligibleCreatorCount: 40,
              topPercent: 10,
              rankLabel:
                expect.any(String),
              calculatedAt: CALCULATED_AT,
            },
            categories: [
              {
                categoryId: 'coffee',
                categoryLabel:
                  'Coffee Explorer',
                categoryShortLabel: 'Coffee',
                scope: 'city',
                cityKey: 'atlanta',
                cityLabel: 'Atlanta',
                reputationLevel: 'expert',
                reputationScore: 82.5,
                primaryLabel:
                  'Atlanta Coffee Expert',
                compactLabel:
                  'Coffee Expert',
                verifiedVenueCount: 17,
                weightedVenueCount: 15.5,
                rank: 4,
                eligibleCreatorCount: 40,
                topPercent: 10,
                rankLabel:
                  expect.any(String),
                calculatedAt:
                  CALCULATED_AT,
              },
            ],
            evidence: {
              verifiedVenueCount: 17,
              weightedVenueCount: 15.5,
              publicCollectionCount: 4,
              curatedVenueCount: 12,
              publicSnapshotCount: 3,
              completedFlowCount: 8,
              cityCount: 2,
            },
            highestLevel: 'expert',
            headline:
              'Atlanta Coffee Expert',
            summary:
              '17 verified venues · 4 public collections · 3 public snapshots',
            policyVersion: 2,
            calculatedAt:
              CALCULATED_AT,
          },
        })
      }
    )
  }
)
