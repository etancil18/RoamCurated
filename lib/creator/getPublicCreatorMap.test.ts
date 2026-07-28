import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock(
  'server-only',
  () => ({})
)

vi.mock(
  '@/lib/supabase/admin',
  () => ({
    getSupabaseAdmin:
      vi.fn(),
  })
)

vi.mock(
  '@/lib/venues/publicVenueEligibility',
  () => ({
    evaluatePublicVenueEligibility:
      vi.fn(),
  })
)

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin'

import {
  evaluatePublicVenueEligibility,
} from '@/lib/venues/publicVenueEligibility'

import {
  getPublicCreatorMap,
  PublicCreatorMapLoadError,
} from './getPublicCreatorMap'

/* =========================================================
 * Test constants
 * ======================================================= */

const CREATOR_USER_ID =
  '11111111-1111-4111-8111-111111111111'

const VENUE_ID_ONE =
  '22222222-2222-4222-8222-222222222222'

const VENUE_ID_TWO =
  '33333333-3333-4333-8333-333333333333'

const VENUE_ID_THREE =
  '44444444-4444-4444-8444-444444444444'

/* =========================================================
 * Test contracts
 * ======================================================= */

type QueryError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type QueryResult = {
  data: unknown
  error: QueryError | null
}

type RecordedQuery = {
  table: string
  select?: string
  filters: Array<{
    column: string
    value: unknown
  }>
  inFilters: Array<{
    column: string
    values: unknown[]
  }>
}

type SupabaseMockOptions = {
  profileResult?: QueryResult
  visitsResult?: QueryResult
  venueResults?: QueryResult[]
}

/* =========================================================
 * Fixtures
 * ======================================================= */

function createPublishedProfile({
  isPublic = true,
  creatorModeEnabled = true,
  showPublicExplorationMap = true,
}: {
  isPublic?: boolean | null
  creatorModeEnabled?: boolean
  showPublicExplorationMap?: boolean
} = {}) {
  return {
    id:
      CREATOR_USER_ID,

    is_public:
      isPublic,

    creator_mode_enabled:
      creatorModeEnabled,

    show_public_exploration_map:
      showPublicExplorationMap,
  }
}

function createVenueRow({
  id = VENUE_ID_ONE,
  name = '  Alpha   Cafe  ',
  slug = 'alpha-cafe',
  city = 'Atlanta',
  category = 'Tier 1',
  description = '  A neighborhood   favorite.  ',
  coverImageUrl =
    'https://images.example.com/alpha.jpg#hero',
  lat = 33.749,
  lon = -84.388,
  profileStatus = 'draft',
}: {
  id?: unknown
  name?: unknown
  slug?: unknown
  city?: unknown
  category?: unknown
  description?: unknown
  coverImageUrl?: unknown
  lat?: unknown
  lon?: unknown
  profileStatus?: unknown
} = {}) {
  return {
    id,
    name,
    slug,
    city,
    category,
    description,

    cover_image_url:
      coverImageUrl,

    lat,
    lon,

    profile_status:
      profileStatus,
  }
}

/* =========================================================
 * Supabase mock
 * ======================================================= */

function createSupabaseMock({
  profileResult = {
    data:
      createPublishedProfile(),
    error:
      null,
  },

  visitsResult = {
    data:
      [],
    error:
      null,
  },

  venueResults = [],
}: SupabaseMockOptions = {}) {
  const queries:
    RecordedQuery[] = []

  let venueResultIndex = 0

  function from(
    table: string
  ) {
    const query:
      RecordedQuery = {
        table,
        filters: [],
        inFilters: [],
      }

    queries.push(query)

    let selectedColumns:
      string | undefined

    let currentResult:
      QueryResult =
        table === 'profiles'
          ? profileResult
          : table === 'venue_visits'
            ? visitsResult
            : {
                data: [],
                error: null,
              }

    const builder: Record<
      string,
      any
    > = {}

    builder.select =
      vi.fn(
        (
          columns:
            string
        ) => {
          selectedColumns =
            columns

          query.select =
            columns

          return builder
        }
      )

    builder.eq =
      vi.fn(
        (
          column:
            string,
          value:
            unknown
        ) => {
          query.filters.push({
            column,
            value,
          })

          return builder
        }
      )

    builder.in =
      vi.fn(
        (
          column:
            string,
          values:
            unknown[]
        ) => {
          query.inFilters.push({
            column,
            values: [
              ...values,
            ],
          })

          if (
            table ===
            'venues'
          ) {
            currentResult =
              venueResults[
                venueResultIndex
              ] ?? {
                data: [],
                error: null,
              }

            venueResultIndex += 1
          }

          return builder
        }
      )

    builder.maybeSingle =
      vi.fn(
        async () =>
          currentResult
      )

    builder.single =
      vi.fn(
        async () =>
          currentResult
      )

    /**
     * Supabase query builders are PromiseLike. The loader
     * directly awaits visit and venue builders, so the mock
     * must implement `then`.
     */
    builder.then =
      (
        resolve:
          (
            value:
              QueryResult
          ) =>
            unknown,
        reject?:
          (
            reason:
              unknown
          ) =>
            unknown
      ) =>
        Promise.resolve(
          currentResult
        ).then(
          resolve,
          reject
        )

    void selectedColumns

    return builder
  }

  const client = {
    from:
      vi.fn(from),
  }

  return {
    client,
    queries,
  }
}

/* =========================================================
 * Query helpers
 * ======================================================= */

function getQueriesForTable(
  queries:
    RecordedQuery[],
  table:
    string
): RecordedQuery[] {
  return queries.filter(
    (query) =>
      query.table ===
      table
  )
}

function expectLoadError(
  error: unknown,
  code:
    PublicCreatorMapLoadError['code']
): asserts error is PublicCreatorMapLoadError {
  expect(
    error
  ).toBeInstanceOf(
    PublicCreatorMapLoadError
  )

  const loadError =
    error as PublicCreatorMapLoadError

  expect(
    loadError.code
  ).toBe(code)
}

/* =========================================================
 * Tests
 * ======================================================= */

describe(
  'getPublicCreatorMap',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      vi.mocked(
        evaluatePublicVenueEligibility
      ).mockReturnValue(
        {
          eligible:
            true,
        } as ReturnType<
          typeof evaluatePublicVenueEligibility
        >
      )
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it(
      'returns null for an invalid creator user ID without resolving an admin client',
      async () => {
        const result =
          await getPublicCreatorMap({
            userId:
              '   ',
          })

        expect(
          result
        ).toBeNull()

        expect(
          getSupabaseAdmin
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'uses the canonical admin client when no client is injected',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock()

        vi.mocked(
          getSupabaseAdmin
        ).mockReturnValue(
          client as never
        )

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,
          })

        expect(
          getSupabaseAdmin
        ).toHaveBeenCalledTimes(
          1
        )

        expect(
          result
        ).toEqual({
          venues:
            [],

          counts: {
            explored:
              0,

            recommended:
              0,
          },
        })

        expect(
          getQueriesForTable(
            queries,
            'profiles'
          )
        ).toHaveLength(1)
      }
    )

    it(
      'uses an injected trusted client without resolving the global admin client',
      async () => {
        const {
          client,
        } =
          createSupabaseMock()

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result
        ).toEqual({
          venues:
            [],

          counts: {
            explored:
              0,

            recommended:
              0,
          },
        })

        expect(
          getSupabaseAdmin
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'returns null when the profile does not exist',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock({
            profileResult: {
              data:
                null,

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result
        ).toBeNull()

        expect(
          getQueriesForTable(
            queries,
            'venue_visits'
          )
        ).toHaveLength(0)
      }
    )

    it.each([
      {
        label:
          'private profile',

        profile:
          createPublishedProfile({
            isPublic:
              false,
          }),
      },

      {
        label:
          'Creator Mode disabled',

        profile:
          createPublishedProfile({
            creatorModeEnabled:
              false,
          }),
      },

      {
        label:
          'public exploration map opt-in disabled',

        profile:
          createPublishedProfile({
            showPublicExplorationMap:
              false,
          }),
      },
    ])(
      'returns null when publication is blocked by $label',
      async ({
        profile,
      }) => {
        const {
          client,
          queries,
        } =
          createSupabaseMock({
            profileResult: {
              data:
                profile,

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result
        ).toBeNull()

        expect(
          getQueriesForTable(
            queries,
            'venue_visits'
          )
        ).toHaveLength(0)
      }
    )

    it(
      'preserves existing profile semantics by treating null is_public as public',
      async () => {
        const {
          client,
        } =
          createSupabaseMock({
            profileResult: {
              data:
                createPublishedProfile({
                  isPublic:
                    null,
                }),

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result
        ).toEqual({
          venues:
            [],

          counts: {
            explored:
              0,

            recommended:
              0,
          },
        })
      }
    )

    it.each([
      {
        field:
          'id',

        value:
          'different-user-id',
      },

      {
        field:
          'is_public',

        value:
          'true',
      },

      {
        field:
          'creator_mode_enabled',

        value:
          null,
      },

      {
        field:
          'show_public_exploration_map',

        value:
          undefined,
      },

      {
        field:
          'show_public_exploration_map',

        value:
          1,
      },
    ])(
      'fails closed when profile field $field contains malformed data',
      async ({
        field,
        value,
      }) => {
        const malformedProfile = {
          ...createPublishedProfile(),

          [field]:
            value,
        }

        const {
          client,
        } =
          createSupabaseMock({
            profileResult: {
              data:
                malformedProfile,

              error:
                null,
            },
          })

        await expect(
          getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        ).rejects.toMatchObject({
          name:
            'PublicCreatorMapLoadError',

          code:
            'INVALID_DATABASE_DATA',
        })
      }
    )

    it(
      'throws a safe PROFILE_QUERY_FAILED error while preserving the database error as cause',
      async () => {
        const databaseError = {
          code:
            'TEST_PROFILE_ERROR',

          message:
            'Sensitive profile database failure',

          details:
            'Internal database details',

          hint:
            'Internal database hint',
        }

        const {
          client,
        } =
          createSupabaseMock({
            profileResult: {
              data:
                null,

              error:
                databaseError,
            },
          })

        let thrown:
          unknown

        try {
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        } catch (error) {
          thrown =
            error
        }

        expectLoadError(
          thrown,
          'PROFILE_QUERY_FAILED'
        )

        expect(
          thrown.message
        ).toBe(
          'This creator exploration map could not be loaded. Please try again.'
        )

        expect(
          thrown.message
        ).not.toContain(
          databaseError.message
        )

        expect(
          thrown.cause
        ).toBe(
          databaseError
        )
      }
    )

    it(
      'queries only the target creator’s geo-verified visits',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock()

        await getPublicCreatorMap({
          userId:
            CREATOR_USER_ID,

          adminClient:
            client as never,
        })

        const visitQueries =
          getQueriesForTable(
            queries,
            'venue_visits'
          )

        expect(
          visitQueries
        ).toHaveLength(1)

        expect(
          visitQueries[0]
            ?.select
        ).toBe(
          'venue_id'
        )

        expect(
          visitQueries[0]
            ?.filters
        ).toEqual([
          {
            column:
              'user_id',

            value:
              CREATOR_USER_ID,
          },

          {
            column:
              'geo_verified',

            value:
              true,
          },
        ])
      }
    )

    it(
      'throws VISITS_QUERY_FAILED when verified visits cannot be loaded',
      async () => {
        const databaseError = {
          code:
            'TEST_VISITS_ERROR',

          message:
            'Venue visits query failed',
        }

        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data:
                null,

              error:
                databaseError,
            },
          })

        let thrown:
          unknown

        try {
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        } catch (error) {
          thrown =
            error
        }

        expectLoadError(
          thrown,
          'VISITS_QUERY_FAILED'
        )

        expect(
          thrown.cause
        ).toBe(
          databaseError
        )
      }
    )

    it.each([
      {
        label:
          'a non-array visit result',

        data:
          {},
      },

      {
        label:
          'a non-object visit row',

        data:
          [
            'invalid',
          ],
      },

      {
        label:
          'a missing venue identifier',

        data:
          [
            {
              venue_id:
                null,
            },
          ],
      },

      {
        label:
          'an empty venue identifier',

        data:
          [
            {
              venue_id:
                '   ',
            },
          ],
      },
    ])(
      'fails closed when venue visits contain $label',
      async ({
        data,
      }) => {
        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data,
              error:
                null,
            },
          })

        await expect(
          getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        ).rejects.toMatchObject({
          code:
            'INVALID_DATABASE_DATA',
        })
      }
    )

    it(
      'returns an explicitly published empty map when no verified visits exist',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock({
            visitsResult: {
              data:
                [],

              error:
                null,
            },
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result
        ).toEqual({
          venues:
            [],

          counts: {
            explored:
              0,

            recommended:
              0,
          },
        })

        expect(
          getQueriesForTable(
            queries,
            'venues'
          )
        ).toHaveLength(0)
      }
    )

    it(
      'deduplicates visited venue IDs before querying venues',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_TWO,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_ONE,
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_TWO,

                    name:
                      'Beta Bistro',
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        const venueQueries =
          getQueriesForTable(
            queries,
            'venues'
          )

        expect(
          venueQueries
        ).toHaveLength(1)

        expect(
          venueQueries[0]
            ?.inFilters[0]
            ?.values
        ).toEqual([
          VENUE_ID_ONE,
          VENUE_ID_TWO,
        ])

        expect(
          result?.venues
        ).toHaveLength(2)

        expect(
          result?.counts
        ).toEqual({
          explored:
            2,

          recommended:
            0,
        })
      }
    )

    it(
      'applies the venue limit before querying venue rows',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_TWO,
                },

                {
                  venue_id:
                    VENUE_ID_THREE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_ONE,
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_TWO,

                    name:
                      'Beta Bistro',
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            venueLimit:
              2,

            adminClient:
              client as never,
          })

        const venueQueries =
          getQueriesForTable(
            queries,
            'venues'
          )

        expect(
          venueQueries[0]
            ?.inFilters[0]
            ?.values
        ).toEqual([
          VENUE_ID_ONE,
          VENUE_ID_TWO,
        ])

        expect(
          result?.venues
        ).toHaveLength(2)

        expect(
          result?.counts
        ).toEqual({
          explored:
            2,

          recommended:
            0,
        })
      }
    )

    it(
      'clamps venueLimit to a minimum of one',
      async () => {
        const {
          client,
          queries,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_TWO,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_ONE,
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        await getPublicCreatorMap({
          userId:
            CREATOR_USER_ID,

          venueLimit:
            0,

          adminClient:
            client as never,
        })

        const venueQuery =
          getQueriesForTable(
            queries,
            'venues'
          )[0]

        expect(
          venueQuery
            ?.inFilters[0]
            ?.values
        ).toEqual([
          VENUE_ID_ONE,
        ])
      }
    )

    it(
      'uses the default limit for non-integer values',
      async () => {
        const visits =
          Array.from(
            {
              length:
                260,
            },
            (
              _value,
              index
            ) => ({
              venue_id:
                `venue-${String(
                  index
                ).padStart(
                  3,
                  '0'
                )}`,
            })
          )

        const {
          client,
          queries,
        } =
          createSupabaseMock({
            visitsResult: {
              data:
                visits,

              error:
                null,
            },

            venueResults: [
              {
                data:
                  [],

                error:
                  null,
              },

              {
                data:
                  [],

                error:
                  null,
              },

              {
                data:
                  [],

                error:
                  null,
              },
            ],
          })

        await getPublicCreatorMap({
          userId:
            CREATOR_USER_ID,

          venueLimit:
            Number.NaN,

          adminClient:
            client as never,
        })

        const venueQueries =
          getQueriesForTable(
            queries,
            'venues'
          )

        const queriedIds =
          venueQueries.flatMap(
            (query) =>
              query.inFilters[0]
                ?.values ?? []
          )

        expect(
          queriedIds
        ).toHaveLength(250)
      }
    )

    it(
      'chunks venue queries into batches of at most 100 IDs',
      async () => {
        const visits =
          Array.from(
            {
              length:
                205,
            },
            (
              _value,
              index
            ) => ({
              venue_id:
                `venue-${String(
                  index
                ).padStart(
                  3,
                  '0'
                )}`,
            })
          )

        const {
          client,
          queries,
        } =
          createSupabaseMock({
            visitsResult: {
              data:
                visits,

              error:
                null,
            },

            venueResults: [
              {
                data:
                  [],

                error:
                  null,
              },

              {
                data:
                  [],

                error:
                  null,
              },

              {
                data:
                  [],

                error:
                  null,
              },
            ],
          })

        await getPublicCreatorMap({
          userId:
            CREATOR_USER_ID,

          venueLimit:
            205,

          adminClient:
            client as never,
        })

        const venueQueries =
          getQueriesForTable(
            queries,
            'venues'
          )

        expect(
          venueQueries
        ).toHaveLength(3)

        expect(
          venueQueries.map(
            (query) =>
              query.inFilters[0]
                ?.values.length
          )
        ).toEqual([
          100,
          100,
          5,
        ])
      }
    )

    it(
      'throws VENUES_QUERY_FAILED when any venue batch fails',
      async () => {
        const databaseError = {
          code:
            'TEST_VENUES_ERROR',

          message:
            'Venue batch query failed',
        }

        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data:
                  null,

                error:
                  databaseError,
              },
            ],
          })

        let thrown:
          unknown

        try {
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        } catch (error) {
          thrown =
            error
        }

        expectLoadError(
          thrown,
          'VENUES_QUERY_FAILED'
        )

        expect(
          thrown.cause
        ).toBe(
          databaseError
        )
      }
    )

    it(
      'fails closed when a venue batch returns a non-array payload',
      async () => {
        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: {
                  id:
                    VENUE_ID_ONE,
                },

                error:
                  null,
              },
            ],
          })

        await expect(
          getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        ).rejects.toMatchObject({
          code:
            'INVALID_DATABASE_DATA',
        })
      }
    )

    it(
      'fails closed when a returned venue was not present in the verified visit set',
      async () => {
        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_TWO,
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        await expect(
          getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })
        ).rejects.toMatchObject({
          code:
            'INVALID_DATABASE_DATA',
        })
      }
    )

    it(
      'omits structurally unusable and publicly ineligible venue rows',
      async () => {
        vi.mocked(
          evaluatePublicVenueEligibility
        ).mockImplementation(
          (input) =>
            ({
              eligible:
                input.id !==
                VENUE_ID_TWO,
            }) as ReturnType<
              typeof evaluatePublicVenueEligibility
            >
        )

        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_TWO,
                },

                {
                  venue_id:
                    VENUE_ID_THREE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_ONE,
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_TWO,

                    name:
                      'Ineligible Venue',
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_THREE,

                    name:
                      '   ',

                    lat:
                      500,
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result
        ).toEqual({
          venues: [
            {
              id:
                VENUE_ID_ONE,

              name:
                'Alpha Cafe',

              slug:
                'alpha-cafe',

              city:
                'Atlanta',

              category:
                'Tier 1',

              coverImageUrl:
                'https://images.example.com/alpha.jpg',

              lat:
                33.749,

              lon:
                -84.388,

              explored:
                true,

              recommended:
                false,

              publicCollections:
                [],
            },
          ],

          counts: {
            explored:
              1,

            recommended:
              0,
          },
        })

        expect(
          evaluatePublicVenueEligibility
        ).toHaveBeenCalledTimes(
          2
        )
      }
    )

    it(
      'supports structured public-eligibility results',
      async () => {
        vi.mocked(
          evaluatePublicVenueEligibility
        ).mockReturnValue({
          eligible:
            true,
        } as ReturnType<
          typeof evaluatePublicVenueEligibility
        >)

        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow(),
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result?.venues
        ).toHaveLength(1)

        expect(
          result?.counts
        ).toEqual({
          explored:
            1,

          recommended:
            0,
        })
      }
    )

    it(
      'deduplicates duplicate venue rows and returns deterministic city-and-name ordering',
      async () => {
        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_TWO,
                },

                {
                  venue_id:
                    VENUE_ID_THREE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_THREE,

                    name:
                      'Zulu Lounge',

                    city:
                      'Chicago',
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_TWO,

                    name:
                      'Beta Bistro',

                    city:
                      'Atlanta',
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_ONE,

                    name:
                      'Alpha Cafe',

                    city:
                      'Atlanta',
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_ONE,

                    name:
                      'Duplicate Alpha',

                    city:
                      'Miami',
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result?.venues.map(
            (
              venue
            ) =>
              venue.id
          )
        ).toEqual([
          VENUE_ID_ONE,
          VENUE_ID_TWO,
          VENUE_ID_THREE,
        ])

        expect(
          result?.venues
        ).toHaveLength(3)

        expect(
          result?.counts
        ).toEqual({
          explored:
            3,

          recommended:
            0,
        })
      }
    )

    it(
      'returns only the deliberate public venue projection',
      async () => {
        const rawVenue = {
          ...createVenueRow(),

          secret_internal_note:
            'never expose',

          owner_user_id:
            'private-owner',

          visit_rating:
            5,

          visited_at:
            '2026-07-28T12:00:00.000Z',

          user_lat:
            33.75,

          user_lon:
            -84.39,

          device_timestamp:
            '2026-07-28T12:00:00.000Z',
        }

        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  rawVenue,
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          Object.keys(
            result?.venues[0] ??
              {}
          ).sort()
        ).toEqual([
          'category',
          'city',
          'coverImageUrl',
          'explored',
          'id',
          'lat',
          'lon',
          'name',
          'publicCollections',
          'recommended',
          'slug',
        ])

        expect(
          result?.counts
        ).toEqual({
          explored:
            1,

          recommended:
            0,
        })

        expect(
          result?.venues[0]
        ).toMatchObject({
          explored:
            true,

          recommended:
            false,

          publicCollections:
            [],
        })

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          'description'
        )

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          'secret_internal_note'
        )

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          'visited_at'
        )

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          'device_timestamp'
        )

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          'user_lat'
        )

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          'user_lon'
        )
      }
    )

    it(
      'rejects unsafe or malformed cover-image URLs without rejecting the venue',
      async () => {
        const {
          client,
        } =
          createSupabaseMock({
            visitsResult: {
              data: [
                {
                  venue_id:
                    VENUE_ID_ONE,
                },

                {
                  venue_id:
                    VENUE_ID_TWO,
                },

                {
                  venue_id:
                    VENUE_ID_THREE,
                },
              ],

              error:
                null,
            },

            venueResults: [
              {
                data: [
                  createVenueRow({
                    id:
                      VENUE_ID_ONE,

                    coverImageUrl:
                      'http://localhost/private.jpg',
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_TWO,

                    name:
                      'Private Network Venue',

                    coverImageUrl:
                      'http://192.168.1.10/image.jpg',
                  }),

                  createVenueRow({
                    id:
                      VENUE_ID_THREE,

                    name:
                      'Malformed URL Venue',

                    coverImageUrl:
                      'not-a-url',
                  }),
                ],

                error:
                  null,
              },
            ],
          })

        const result =
          await getPublicCreatorMap({
            userId:
              CREATOR_USER_ID,

            adminClient:
              client as never,
          })

        expect(
          result?.venues
        ).toHaveLength(3)

        expect(
          result?.venues.every(
            (
              venue
            ) =>
              venue.coverImageUrl ===
              null
          )
        ).toBe(true)

        expect(
          result?.counts
        ).toEqual({
          explored:
            3,

          recommended:
            0,
        })
      }
    )
  }
)