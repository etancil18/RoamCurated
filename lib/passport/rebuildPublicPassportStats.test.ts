import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  getPassportSnapshot: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin:
    mocks.getSupabaseAdmin,
}))

vi.mock('@/lib/passport/score', () => ({
  getPassportSnapshot:
    mocks.getPassportSnapshot,
}))

import type {
  getPassportSnapshot as GetPassportSnapshot,
} from '@/lib/passport/score'
import type {
  getSupabaseAdmin as GetSupabaseAdmin,
} from '@/lib/supabase/admin'

import {
  rebuildPublicPassportStats,
} from './rebuildPublicPassportStats'

type QueryError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

type QueryResult = {
  data?: unknown
  error?: QueryError | null
  count?: number | null
}

type QueryFilter = {
  method: 'eq' | 'in'
  column: string
  value: unknown
}

type SelectCall = {
  table: string
  method: 'select'
  columns: string
  options?: Record<string, unknown>
  filters: QueryFilter[]
}

type UpsertCall = {
  table: string
  method: 'upsert'
  values: unknown
  options?: Record<string, unknown>
  filters: QueryFilter[]
}

type QueryCall =
  | SelectCall
  | UpsertCall

type TablePlan = {
  selectResults?: QueryResult[]
  upsertResults?: QueryResult[]
}

type QueryBuilder =
  PromiseLike<QueryResult> & {
    select: (
      columns?: string,
      options?: Record<
        string,
        unknown
      >
    ) => QueryBuilder

    eq: (
      column: string,
      value: unknown
    ) => QueryBuilder

    in: (
      column: string,
      values: unknown[]
    ) => QueryBuilder

    upsert: (
      values: unknown,
      options?: Record<
        string,
        unknown
      >
    ) => QueryBuilder
  }

type MockSupabase = {
  client: {
    from: (
      table: string
    ) => QueryBuilder
  }
  calls: QueryCall[]
}

function createDefaultPlans(
  overrides: Record<
    string,
    TablePlan
  > = {}
): Record<string, TablePlan> {
  return {
    crawl_events: {
      selectResults: [
        {
          data: null,
          error: null,
          count: 0,
        },
      ],
    },

    crawl_rsvps: {
      selectResults: [
        {
          data: [],
          error: null,
        },
      ],
    },

    saved_properties: {
      selectResults: [
        {
          data: null,
          error: null,
          count: 0,
        },
      ],
    },

    active_flow_sessions: {
      selectResults: [
        {
          data: [],
          error: null,
        },
      ],
    },

    venue_visits: {
      selectResults: [
        {
          data: [],
          error: null,
        },
      ],
    },

    crawl_progress: {
      selectResults: [
        {
          data: [],
          error: null,
        },
      ],
    },

    event_xp_ledger: {
      selectResults: [
        {
          data: [],
          error: null,
        },
      ],
    },

    event_checkins: {
      selectResults: [
        {
          data: null,
          error: null,
          count: 0,
        },
      ],
    },

    profile_public_stats: {
      upsertResults: [
        {
          data: null,
          error: null,
        },
      ],
    },

    ...overrides,
  }
}

function createSupabaseMock(
  plans: Record<
    string,
    TablePlan
  >
): MockSupabase {
  const calls: QueryCall[] = []

  const selectResultIndexes =
    new Map<string, number>()

  const upsertResultIndexes =
    new Map<string, number>()

  function consumeResult({
    table,
    method,
  }: {
    table: string
    method: 'select' | 'upsert'
  }): QueryResult {
    const tablePlan =
      plans[table] ?? {}

    if (method === 'select') {
      const index =
        selectResultIndexes.get(
          table
        ) ?? 0

      selectResultIndexes.set(
        table,
        index + 1
      )

      return (
        tablePlan
          .selectResults?.[
          index
        ] ?? {
          data: [],
          error: null,
          count: 0,
        }
      )
    }

    const index =
      upsertResultIndexes.get(
        table
      ) ?? 0

    upsertResultIndexes.set(
      table,
      index + 1
    )

    return (
      tablePlan
        .upsertResults?.[
        index
      ] ?? {
        data: null,
        error: null,
      }
    )
  }

  const client = {
    from(
      table: string
    ): QueryBuilder {
      let activeCall:
        | QueryCall
        | null = null

      let activeResult:
        QueryResult = {
          data: [],
          error: null,
          count: 0,
        }

      const builder: QueryBuilder = {
        select(
          columns = '*',
          options
        ) {
          activeCall = {
            table,
            method: 'select',
            columns,
            options,
            filters: [],
          }

          calls.push(
            activeCall
          )

          activeResult =
            consumeResult({
              table,
              method: 'select',
            })

          return builder
        },

        eq(
          column,
          value
        ) {
          if (!activeCall) {
            throw new Error(
              `[test Supabase mock] eq() called before select() or upsert() for ${table}.`
            )
          }

          activeCall.filters.push({
            method: 'eq',
            column,
            value,
          })

          return builder
        },

        in(
          column,
          values
        ) {
          if (!activeCall) {
            throw new Error(
              `[test Supabase mock] in() called before select() or upsert() for ${table}.`
            )
          }

          activeCall.filters.push({
            method: 'in',
            column,
            value: values,
          })

          return builder
        },

        upsert(
          values,
          options
        ) {
          activeCall = {
            table,
            method: 'upsert',
            values,
            options,
            filters: [],
          }

          calls.push(
            activeCall
          )

          activeResult =
            consumeResult({
              table,
              method: 'upsert',
            })

          return builder
        },

        then(
          onFulfilled,
          onRejected
        ) {
          return Promise.resolve(
            activeResult
          ).then(
            onFulfilled,
            onRejected
          )
        },
      }

      return builder
    },
  }

  return {
    client,
    calls,
  }
}

function findSelectCall({
  calls,
  table,
  occurrence = 0,
}: {
  calls: QueryCall[]
  table: string
  occurrence?: number
}): SelectCall {
  const matches = calls.filter(
    (
      call
    ): call is SelectCall =>
      call.table === table &&
      call.method === 'select'
  )

  const call =
    matches[occurrence]

  if (!call) {
    throw new Error(
      `Expected select call ${occurrence + 1} for ${table}.`
    )
  }

  return call
}

function findUpsertCall({
  calls,
  table,
}: {
  calls: QueryCall[]
  table: string
}): UpsertCall {
  const call = calls.find(
    (
      candidate
    ): candidate is UpsertCall =>
      candidate.table === table &&
      candidate.method ===
        'upsert'
  )

  if (!call) {
    throw new Error(
      `Expected upsert call for ${table}.`
    )
  }

  return call
}

function installSupabaseMock(
  plans: Record<
    string,
    TablePlan
  >
): MockSupabase {
  const supabase =
    createSupabaseMock(plans)

  mocks.getSupabaseAdmin.mockReturnValue(
    supabase.client as unknown as ReturnType<
      typeof GetSupabaseAdmin
    >
  )

  return supabase
}

describe(
  'rebuildPublicPassportStats',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.getPassportSnapshot
        .mockReturnValue({
          xp: 125,
          level: 2,
          progressToNextLevel: 25,
          progressPercent: 25,
        } as ReturnType<
          typeof GetPassportSnapshot
        >)
    })

    it(
      'queries only geo-verified venue visits',
      async () => {
        const supabase =
          installSupabaseMock(
            createDefaultPlans()
          )

        await rebuildPublicPassportStats(
          'user-123'
        )

        const call =
          findSelectCall({
            calls:
              supabase.calls,
            table:
              'venue_visits',
          })

        expect(
          call.columns
        ).toBe(
          'venue_id, geo_verified'
        )

        expect(
          call.filters
        ).toEqual([
          {
            method: 'eq',
            column:
              'user_id',
            value:
              'user-123',
          },
          {
            method: 'eq',
            column:
              'geo_verified',
            value: true,
          },
        ])
      }
    )

    it(
      'counts unique verified venue relationships only',
      async () => {
        installSupabaseMock(
          createDefaultPlans({
            venue_visits: {
              selectResults: [
                {
                  data: [
                    {
                      venue_id:
                        'venue-a',
                      geo_verified:
                        true,
                    },
                    {
                      venue_id:
                        'venue-a',
                      geo_verified:
                        true,
                    },
                    {
                      venue_id:
                        'venue-b',
                      geo_verified:
                        true,
                    },
                    {
                      venue_id:
                        'venue-c',
                      geo_verified:
                        false,
                    },
                    {
                      venue_id:
                        'venue-d',
                      geo_verified:
                        null,
                    },
                    {
                      venue_id:
                        'venue-e',
                    },
                    {
                      venue_id:
                        null,
                      geo_verified:
                        true,
                    },
                    {
                      venue_id:
                        '',
                      geo_verified:
                        true,
                    },
                    {
                      venue_id:
                        '   ',
                      geo_verified:
                        true,
                    },
                  ],
                  error: null,
                },
              ],
            },
          })
        )

        const result =
          await rebuildPublicPassportStats(
            'user-123'
          )

        expect(
          result.stats
            .venueVisits
        ).toBe(2)
      }
    )

    it(
      'defensively excludes unverified rows even if Supabase returns them despite the query filter',
      async () => {
        installSupabaseMock(
          createDefaultPlans({
            venue_visits: {
              selectResults: [
                {
                  data: [
                    {
                      venue_id:
                        'verified',
                      geo_verified:
                        true,
                    },
                    {
                      venue_id:
                        'unverified',
                      geo_verified:
                        false,
                    },
                    {
                      venue_id:
                        'missing-proof',
                    },
                  ],
                  error: null,
                },
              ],
            },
          })
        )

        const result =
          await rebuildPublicPassportStats(
            'user-123'
          )

        expect(
          result.stats
            .venueVisits
        ).toBe(1)
      }
    )

    it(
      'preserves unrelated Passport calculations and writes the canonical snapshot',
      async () => {
        const supabase =
          installSupabaseMock(
            createDefaultPlans({
              crawl_events: {
                selectResults: [
                  {
                    data: null,
                    error: null,
                    count: 2,
                  },
                  {
                    data: [
                      {
                        id:
                          'crawl-a',
                        venue_ids: [
                          'venue-1',
                          'venue-2',
                        ],
                      },
                    ],
                    error: null,
                  },
                ],
              },

              crawl_rsvps: {
                selectResults: [
                  {
                    data: [
                      {
                        crawl_id:
                          'crawl-past',
                        crawl_events:
                          {
                            id:
                              'crawl-past',
                            datetime:
                              '2020-01-01T00:00:00.000Z',
                          },
                      },
                      {
                        crawl_id:
                          'crawl-future',
                        crawl_events:
                          {
                            id:
                              'crawl-future',
                            datetime:
                              '2999-01-01T00:00:00.000Z',
                          },
                      },
                    ],
                    error: null,
                  },
                ],
              },

              saved_properties: {
                selectResults: [
                  {
                    data: null,
                    error: null,
                    count: 3,
                  },
                ],
              },

              active_flow_sessions: {
                selectResults: [
                  {
                    data: [
                      {
                        id:
                          'flow-a',
                        venue_ids: [
                          'venue-1',
                          'venue-2',
                          'venue-3',
                        ],
                      },
                      {
                        id:
                          'flow-b',
                        venue_ids: [
                          'venue-4',
                        ],
                      },
                    ],
                    error: null,
                  },
                ],
              },

              venue_visits: {
                selectResults: [
                  {
                    data: [
                      {
                        venue_id:
                          'venue-1',
                        geo_verified:
                          true,
                      },
                      {
                        venue_id:
                          'venue-2',
                        geo_verified:
                          true,
                      },
                    ],
                    error: null,
                  },
                ],
              },

              crawl_progress: {
                selectResults: [
                  {
                    data: [
                      {
                        crawl_id:
                          'crawl-a',
                      },
                      {
                        crawl_id:
                          'crawl-a',
                      },
                    ],
                    error: null,
                  },
                ],
              },

              event_xp_ledger: {
                selectResults: [
                  {
                    data: [
                      {
                        xp_amount:
                          10,
                      },
                      {
                        xp_amount:
                          '15',
                      },
                      {
                        xp_amount:
                          -5,
                      },
                      {
                        xp_amount:
                          'invalid',
                      },
                    ],
                    error: null,
                  },
                ],
              },

              event_checkins: {
                selectResults: [
                  {
                    data: null,
                    error: null,
                    count: 4,
                  },
                ],
              },
            })
          )

        const result =
          await rebuildPublicPassportStats(
            ' user-123 '
          )

        expect(
          result.stats
        ).toEqual({
          hostedCrawls: 2,
          joinedCrawls: 2,
          pastCrawls: 1,
          savedProperties: 3,
          completedFlows: 2,
          completedFlowStops: 4,
          hostedFlowStops: 2,
          completedHostedFlows: 1,
          venueVisits: 2,
          eventXp: 25,
          eventCheckins: 4,
        })

        expect(
          mocks.getPassportSnapshot
        ).toHaveBeenCalledTimes(
          1
        )

        expect(
          mocks.getPassportSnapshot
        ).toHaveBeenCalledWith(
          result.stats
        )

        const completionLookup =
          findSelectCall({
            calls:
              supabase.calls,
            table:
              'crawl_events',
            occurrence: 1,
          })

        expect(
          completionLookup.columns
        ).toBe(
          'id, venue_ids'
        )

        expect(
          completionLookup.filters
        ).toEqual([
          {
            method: 'in',
            column: 'id',
            value: [
              'crawl-a',
            ],
          },
        ])

        const upsertCall =
          findUpsertCall({
            calls:
              supabase.calls,
            table:
              'profile_public_stats',
          })

        expect(
          upsertCall.options
        ).toEqual({
          onConflict:
            'user_id',
        })

        expect(
          upsertCall.values
        ).toEqual(
          expect.objectContaining({
            user_id:
              'user-123',

            hosted_crawls:
              2,

            joined_crawls:
              2,

            past_crawls:
              1,

            saved_properties:
              3,

            completed_flows:
              2,

            completed_flow_stops:
              4,

            hosted_flow_stops:
              2,

            completed_hosted_flows:
              1,

            venue_visits:
              2,

            event_xp:
              25,

            event_checkins:
              4,

            passport_xp:
              125,

            passport_level:
              2,

            passport_progress:
              25,

            passport_progress_percent:
              25,

            updated_at:
              expect.any(
                String
              ),
          })
        )

        expect(
          result.snapshot
        ).toEqual({
          xp: 125,
          level: 2,
          progressToNextLevel:
            25,
          progressPercent:
            25,
        })

        expect(
          result.updatedAt
        ).toEqual(
          (
            upsertCall.values as {
              updated_at:
                string
            }
          ).updated_at
        )

        expect(
          Number.isNaN(
            Date.parse(
              result.updatedAt
            )
          )
        ).toBe(false)
      }
    )

    it(
      'writes zero verified venue visits when no eligible rows exist',
      async () => {
        const supabase =
          installSupabaseMock(
            createDefaultPlans({
              venue_visits: {
                selectResults: [
                  {
                    data: [
                      {
                        venue_id:
                          'venue-a',
                        geo_verified:
                          false,
                      },
                      {
                        venue_id:
                          'venue-b',
                        geo_verified:
                          null,
                      },
                    ],
                    error: null,
                  },
                ],
              },
            })
          )

        const result =
          await rebuildPublicPassportStats(
            'user-123'
          )

        expect(
          result.stats
            .venueVisits
        ).toBe(0)

        const upsertCall =
          findUpsertCall({
            calls:
              supabase.calls,
            table:
              'profile_public_stats',
          })

        expect(
          upsertCall.values
        ).toEqual(
          expect.objectContaining({
            venue_visits: 0,
          })
        )
      }
    )

    it(
      'rejects an empty user ID before creating the admin client',
      async () => {
        await expect(
          rebuildPublicPassportStats(
            '   '
          )
        ).rejects.toThrow(
          '[rebuildPublicPassportStats] A valid userId is required.'
        )

        expect(
          mocks.getSupabaseAdmin
        ).not.toHaveBeenCalled()

        expect(
          mocks.getPassportSnapshot
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'throws a contextual error when the venue visits query fails',
      async () => {
        installSupabaseMock(
          createDefaultPlans({
            venue_visits: {
              selectResults: [
                {
                  data: null,
                  error: {
                    message:
                      'Database unavailable',
                    code: 'XX000',
                    details:
                      'Test failure',
                    hint:
                      'Retry later',
                  },
                },
              ],
            },
          })
        )

        await expect(
          rebuildPublicPassportStats(
            'user-123'
          )
        ).rejects.toThrow(
          '[rebuildPublicPassportStats] venue_visits failed: Database unavailable | code=XX000 | details=Test failure | hint=Retry later'
        )

        expect(
          mocks.getPassportSnapshot
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'throws a contextual error when the canonical stats upsert fails',
      async () => {
        installSupabaseMock(
          createDefaultPlans({
            profile_public_stats: {
              upsertResults: [
                {
                  data: null,
                  error: {
                    message:
                      'Upsert failed',
                    code: '23505',
                  },
                },
              ],
            },
          })
        )

        await expect(
          rebuildPublicPassportStats(
            'user-123'
          )
        ).rejects.toThrow(
          '[rebuildPublicPassportStats] profile_public_stats upsert failed: Upsert failed | code=23505'
        )

        expect(
          mocks.getPassportSnapshot
        ).toHaveBeenCalledTimes(
          1
        )
      }
    )
  }
)