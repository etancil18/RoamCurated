
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { NextRequest } from 'next/server'

/* =========================================================
 * Mocks
 * ======================================================= */

vi.mock('server-only', () => ({}))

type AggregateRow = {
  venue_id: unknown
  current_unique_visitors: unknown
  previous_unique_visitors: unknown
  current_verified_visits: unknown
  previous_verified_visits: unknown
  recent_verified_visits: unknown
  last_verified_visit_at: unknown
  [key: string]: unknown
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
  cover: string | null
  type: string[] | null
  vibe: string[] | null
  tags: string[] | null
  lat: number | null
  lon: number | null
  access_token?: string | null
  contact?: string[] | null
  profile_status?: string | null
  [key: string]: unknown
}

type SupabaseError = {
  message: string
}

type QueryCall = {
  table: string
  columns: string | null
  filterColumn: string | null
  filterValues: unknown[] | null
}

const mockState = vi.hoisted(() => ({
  aggregates: [] as Record<string, unknown>[],
  venues: [] as Record<string, unknown>[],

  rpcError: null as { message: string } | null,
  venueError: null as { message: string } | null,

  rpcThrows: false,
  venueQueryThrows: false,
  invalidRpcShape: false,
  invalidVenueShape: false,
  clientThrows: false,

  rpcCalls: [] as {
    name: string
    args: Record<string, unknown>
  }[],

  queryCalls: [] as {
    table: string
    columns: string | null
    filterColumn: string | null
    filterValues: unknown[] | null
  }[],

  clientCalls: [] as {
    url: string
    key: string
    options: unknown
  }[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(
    (
      url: string,
      key: string,
      options: unknown
    ) => {
      mockState.clientCalls.push({
        url,
        key,
        options,
      })

      if (mockState.clientThrows) {
        throw new Error(
          'Simulated Supabase client initialization failure'
        )
      }

      return {
        async rpc(
          name: string,
          args: Record<string, unknown>
        ) {
          mockState.rpcCalls.push({
            name,
            args,
          })

          if (mockState.rpcThrows) {
            throw new Error(
              'Simulated aggregate query exception'
            )
          }

          if (mockState.rpcError) {
            return {
              data: null,
              error: mockState.rpcError,
            }
          }

          if (mockState.invalidRpcShape) {
            return {
              data: {
                unexpected: true,
              },
              error: null,
            }
          }

          return {
            data: mockState.aggregates,
            error: null,
          }
        },

        from(table: string) {
          const call: QueryCall = {
            table,
            columns: null,
            filterColumn: null,
            filterValues: null,
          }

          mockState.queryCalls.push(call)

          const builder = {
            select(columns: string) {
              call.columns = columns
              return builder
            },

            async in(
              column: string,
              values: unknown[]
            ) {
              call.filterColumn = column
              call.filterValues = values

              if (mockState.venueQueryThrows) {
                throw new Error(
                  'Simulated venue query exception'
                )
              }

              if (mockState.venueError) {
                return {
                  data: null,
                  error: mockState.venueError,
                }
              }

              if (mockState.invalidVenueShape) {
                return {
                  data: {
                    unexpected: true,
                  },
                  error: null,
                }
              }

              const ids = new Set(
                values.map((value) =>
                  String(value).toLowerCase()
                )
              )

              const selectedColumns = (
                call.columns ?? ''
              )
                .split(',')
                .map((column) => column.trim())
                .filter(Boolean)

              const projected = mockState.venues
                .filter((venue) =>
                  ids.has(
                    String(venue.id).toLowerCase()
                  )
                )
                .map((venue) => {
                  const result: Record<string, unknown> = {}

                  for (const field of selectedColumns) {
                    result[field] = venue[field] ?? null
                  }

                  return result
                })

              return {
                data: projected,
                error: null,
              }
            },
          }

          return builder
        },
      }
    }
  ),
}))

/* =========================================================
 * Route under test
 * ======================================================= */

import { GET } from './route'

/* =========================================================
 * Fixtures
 * ======================================================= */

const FIXED_NOW = '2026-10-23T19:00:00.000Z'

const HOUR_MS = 60 * 60 * 1000

const VENUE_A =
  '11111111-1111-4111-8111-111111111111'

const VENUE_B =
  '22222222-2222-4222-8222-222222222222'

const VENUE_C =
  '33333333-3333-4333-8333-333333333333'

const OOB_VENUE =
  '44444444-4444-4444-8444-444444444444'

function hoursAgo(hours: number): string {
  return new Date(
    Date.parse(FIXED_NOW) - hours * HOUR_MS
  ).toISOString()
}

function createAggregate(
  overrides: Partial<AggregateRow> = {}
): AggregateRow {
  return {
    venue_id: VENUE_A,
    current_unique_visitors: 12,
    previous_unique_visitors: 6,
    current_verified_visits: 15,
    previous_verified_visits: 8,
    recent_verified_visits: 4,
    last_verified_visit_at: hoursAgo(2),
    ...overrides,
  }
}

function createVenue(
  overrides: Partial<VenueRow> = {}
): VenueRow {
  return {
    id: VENUE_A,
    name: 'Atlanta Coffee House',
    city: 'atl',
    cover: 'img/venues/coffee.jpg',
    type: ['coffee'],
    vibe: ['cozy'],
    tags: ['espresso'],
    lat: 33.749,
    lon: -84.388,
    access_token: 'SECRET_VENUE_TOKEN',
    contact: ['PRIVATE_CONTACT'],
    profile_status: 'draft',
    ...overrides,
  }
}

function seedQualifyingVenues() {
  mockState.aggregates = [
    createAggregate({
      venue_id: VENUE_A,
      current_unique_visitors: 12,
      previous_unique_visitors: 6,
      current_verified_visits: 15,
      previous_verified_visits: 8,
      recent_verified_visits: 4,
    }),
    createAggregate({
      venue_id: VENUE_B,
      current_unique_visitors: 25,
      previous_unique_visitors: 10,
      current_verified_visits: 30,
      previous_verified_visits: 12,
      recent_verified_visits: 8,
    }),
    createAggregate({
      venue_id: VENUE_C,
      current_unique_visitors: 6,
      previous_unique_visitors: 3,
      current_verified_visits: 7,
      previous_verified_visits: 4,
      recent_verified_visits: 2,
    }),
  ]

  mockState.venues = [
    createVenue({
      id: VENUE_A,
      name: 'Atlanta Coffee House',
    }),
    createVenue({
      id: VENUE_B,
      name: 'The Garden Room',
      type: ['restaurant'],
      vibe: ['romantic'],
      tags: ['dinner'],
      lat: 33.76,
      lon: -84.4,
    }),
    createVenue({
      id: VENUE_C,
      name: 'The Reading Room',
      type: ['cafe'],
      vibe: ['quiet'],
      tags: ['books'],
      lat: 33.755,
      lon: -84.391,
    }),
  ]
}

function createRequest(
  params = ''
): NextRequest {
  return new NextRequest(
    `http://localhost/api/explore/trending${
      params ? `?${params}` : ''
    }`
  )
}

async function callRoute(params = '') {
  const response = await GET(createRequest(params))
  const body = await response.json()

  return {
    response,
    body,
  }
}

function suppressExpectedErrors() {
  return vi
    .spyOn(console, 'error')
    .mockImplementation(() => {})
}

/* =========================================================
 * Setup
 * ======================================================= */

beforeEach(() => {
  vi.useRealTimers()

  mockState.aggregates = []
  mockState.venues = []

  mockState.rpcError = null
  mockState.venueError = null

  mockState.rpcThrows = false
  mockState.venueQueryThrows = false
  mockState.invalidRpcShape = false
  mockState.invalidVenueShape = false
  mockState.clientThrows = false

  mockState.rpcCalls = []
  mockState.queryCalls = []
  mockState.clientCalls = []

  vi.stubEnv(
    'SUPABASE_URL',
    'https://test-project.supabase.co'
  )

  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'https://test-project.supabase.co'
  )

  vi.stubEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'test-server-only-service-role-key'
  )

  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/* =========================================================
 * Tests
 * ======================================================= */

describe('GET /api/explore/trending', () => {
  describe('request validation', () => {
    it('accepts a request without authentication', async () => {
      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.status).toBe('insufficient_data')
    })

    it('uses the default limit of 20', async () => {
      seedQualifyingVenues()

      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.count).toBe(3)
    })

    it('accepts an explicit valid limit', async () => {
      seedQualifyingVenues()

      const { response, body } = await callRoute(
        'limit=2'
      )

      expect(response.status).toBe(200)
      expect(body.venues).toHaveLength(2)
    })

    it.each([
      'limit=0',
      'limit=-1',
      'limit=101',
      'limit=abc',
      'limit=1.5',
      'limit=',
      'limit=%20',
      'limit=99999999999999999999999',
    ])(
      'rejects invalid parameter %s',
      async (params) => {
        const { response, body } = await callRoute(
          params
        )

        expect(response.status).toBe(400)
        expect(body.error).toContain(
          'Limit must be an integer'
        )

        expect(mockState.clientCalls).toHaveLength(0)
        expect(mockState.rpcCalls).toHaveLength(0)
        expect(mockState.queryCalls).toHaveLength(0)
      }
    )

    it('returns no-store cache headers for success', async () => {
      const { response } = await callRoute()

      expect(
        response.headers.get('Cache-Control')
      ).toBe('private, no-store')
    })

    it('returns no-store headers for invalid parameters', async () => {
      const { response } = await callRoute(
        'limit=0'
      )

      expect(
        response.headers.get('Cache-Control')
      ).toBe('private, no-store')
    })
  })

  /* =======================================================
   * Service-role boundary
   * ===================================================== */

  describe('service-role security', () => {
    it('creates a server-side client using the service-role key', async () => {
      await callRoute()

      expect(mockState.clientCalls).toHaveLength(1)

      expect(mockState.clientCalls[0]).toMatchObject({
        url: 'https://test-project.supabase.co',
        key: 'test-server-only-service-role-key',
      })
    })

    it('disables persisted authentication sessions', async () => {
      await callRoute()

      expect(mockState.clientCalls[0].options).toMatchObject({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    })

    it('calls only the protected aggregation RPC', async () => {
      await callRoute()

      expect(mockState.rpcCalls).toHaveLength(1)

      expect(mockState.rpcCalls[0].name).toBe(
        'get_explore_trending_aggregates'
      )
    })

    it('passes the same fixed evaluation time to the database', async () => {
      await callRoute()

      expect(mockState.rpcCalls[0].args).toEqual({
        p_as_of: FIXED_NOW,
      })
    })

    it('does not query the raw venue_visits table', async () => {
      seedQualifyingVenues()

      await callRoute()

      expect(
        mockState.queryCalls.some(
          (call) =>
            call.table === 'venue_visits'
        )
      ).toBe(false)
    })

    it('never returns the service-role key in the public response', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(JSON.stringify(body)).not.toContain(
        'test-server-only-service-role-key'
      )
    })

    it('returns a controlled error if the service-role key is unavailable', async () => {
      vi.stubEnv(
        'SUPABASE_SERVICE_ROLE_KEY',
        ''
      )

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading trending places.'
        )

        expect(mockState.clientCalls).toHaveLength(0)
      } finally {
        spy.mockRestore()
      }
    })

    it('returns a controlled error if the Supabase URL is unavailable', async () => {
      vi.stubEnv('SUPABASE_URL', '')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })
  })

  /* =======================================================
   * Truthful insufficient-data behavior
   * ===================================================== */

  describe('insufficient verified activity', () => {
    it('returns an explicit empty state when there are no aggregates', async () => {
      const { response, body } = await callRoute()

      expect(response.status).toBe(200)

      expect(body).toEqual({
        status: 'insufficient_data',
        venues: [],
        count: 0,
        windowDays: 7,
        asOf: FIXED_NOW,
      })
    })

    it('does not query venue metadata when nothing qualifies', async () => {
      await callRoute()

      expect(mockState.queryCalls).toHaveLength(0)
    })

    it('does not fabricate rankings below five unique visitors', async () => {
      mockState.aggregates = [
        createAggregate({
          current_unique_visitors: 2,
          current_verified_visits: 2,
          recent_verified_visits: 2,
        }),
      ]

      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.status).toBe('insufficient_data')
      expect(body.venues).toEqual([])
      expect(body.count).toBe(0)
    })

    it('does not let repeated visits replace unique visitors', async () => {
      mockState.aggregates = [
        createAggregate({
          current_unique_visitors: 2,
          current_verified_visits: 100,
          recent_verified_visits: 30,
        }),
      ]

      const { body } = await callRoute()

      expect(body.status).toBe('insufficient_data')
      expect(body.venues).toEqual([])
    })

    it('returns an empty state when qualified aggregates have no eligible venue metadata', async () => {
      seedQualifyingVenues()

      mockState.venues = [
        createVenue({
          id: VENUE_A,
          city: 'oob',
        }),
        createVenue({
          id: VENUE_B,
          city: 'oob',
        }),
        createVenue({
          id: VENUE_C,
          city: 'oob',
        }),
      ]

      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.status).toBe('insufficient_data')
      expect(body.venues).toEqual([])
    })
  })

  /* =======================================================
   * Successful trending response
   * ===================================================== */

  describe('qualified trending results', () => {
    it('returns actual qualified venues', async () => {
      seedQualifyingVenues()

      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.status).toBe('trending')
      expect(body.venues).toHaveLength(3)
      expect(body.count).toBe(3)
    })

    it('returns the correct top-ranked venue', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(body.venues[0].id).toBe(VENUE_B)
      expect(body.venues[0].rank).toBe(1)
    })

    it('returns descending trending scores', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      const scores: number[] = body.venues.map(
        (venue: { score: number }) => venue.score
      )

      expect(scores).toEqual(
        [...scores].sort((a, b) => b - a)
      )
    })

    it('assigns contiguous ranks', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(
        body.venues.map(
          (venue: { rank: number }) => venue.rank
        )
      ).toEqual([1, 2, 3])
    })

    it('returns the seven-day window and consistent evaluation timestamp', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(body.windowDays).toBe(7)
      expect(body.asOf).toBe(FIXED_NOW)
    })

    it('maps verified aggregate counts into public results', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      const venueA = body.venues.find(
        (venue: { id: string }) =>
          venue.id === VENUE_A
      )

      expect(venueA).toMatchObject({
        currentUniqueVisitors: 12,
        previousUniqueVisitors: 6,
        currentVerifiedVisits: 15,
        previousVerifiedVisits: 8,
        recentVerifiedVisits: 4,
      })
    })

    it('calculates correct growth using unique visitors', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      const venueA = body.venues.find(
        (venue: { id: string }) =>
          venue.id === VENUE_A
      )

      expect(venueA.growth).toEqual({
        absoluteChange: 6,
        percentageChange: 100,
        newActivity: false,
      })
    })

    it('accepts PostgreSQL bigint decimal strings', async () => {
      mockState.aggregates = [
        createAggregate({
          current_unique_visitors: '12',
          previous_unique_visitors: '6',
          current_verified_visits: '15',
          previous_verified_visits: '8',
          recent_verified_visits: '4',
        }),
      ]

      mockState.venues = [createVenue()]

      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.status).toBe('trending')
      expect(body.venues[0].currentUniqueVisitors).toBe(12)
    })

    it('returns canonical venue-profile links', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(body.venues[0].profileHref).toBe(
        `/venue-profile/${VENUE_B}`
      )
    })

    it('returns venue-ID-based Flow Builder links', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(body.venues[0].flowBuilderHref).toBe(
        `/sponsor-crawl?venueId=${VENUE_B}`
      )
    })

    it('returns only expected public trending fields', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(Object.keys(body.venues[0]).sort()).toEqual([
        'city',
        'cover',
        'currentUniqueVisitors',
        'currentVerifiedVisits',
        'flowBuilderHref',
        'growth',
        'id',
        'lastVerifiedVisitAt',
        'lat',
        'lon',
        'name',
        'previousUniqueVisitors',
        'previousVerifiedVisits',
        'profileHref',
        'rank',
        'recentVerifiedVisits',
        'score',
        'tags',
        'type',
        'vibe',
      ])
    })

    it('does not expose access tokens, contact information, or profile status', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      const serialized = JSON.stringify(body)

      expect(serialized).not.toContain(
        'SECRET_VENUE_TOKEN'
      )

      expect(serialized).not.toContain(
        'PRIVATE_CONTACT'
      )

      expect(body.venues[0]).not.toHaveProperty(
        'access_token'
      )

      expect(body.venues[0]).not.toHaveProperty(
        'contact'
      )

      expect(body.venues[0]).not.toHaveProperty(
        'profile_status'
      )
    })

    it('does not expose raw check-in identities or user coordinates', async () => {
      seedQualifyingVenues()

      mockState.aggregates[0].user_id =
        'PRIVATE_USER_ID'

      mockState.aggregates[0].user_lat =
        33.749

      mockState.aggregates[0].user_lon =
        -84.388

      const { body } = await callRoute()

      const serialized = JSON.stringify(body)

      expect(serialized).not.toContain(
        'PRIVATE_USER_ID'
      )

      expect(serialized).not.toContain(
        'user_lat'
      )

      expect(serialized).not.toContain(
        'user_lon'
      )

      expect(serialized).not.toContain(
        'user_id'
      )
    })

    it('selects only approved venue metadata columns', async () => {
      seedQualifyingVenues()

      await callRoute()

      expect(mockState.queryCalls).toHaveLength(1)

      const call = mockState.queryCalls[0]

      expect(call.table).toBe('venues')
      expect(call.filterColumn).toBe('id')

      expect(call.columns).toBe(
        'id,name,city,cover,type,vibe,tags,lat,lon'
      )

      expect(call.columns).not.toContain(
        'access_token'
      )

      expect(call.columns).not.toContain(
        'contact'
      )
    })

    it('queries metadata only for ranked venue IDs', async () => {
      seedQualifyingVenues()

      await callRoute('limit=2')

      expect(mockState.queryCalls).toHaveLength(1)
      expect(
        mockState.queryCalls[0].filterValues
      ).toHaveLength(2)
    })

    it('excludes OOB venues during metadata revalidation', async () => {
      seedQualifyingVenues()

      mockState.venues[1].city = 'oob'

      const { response, body } = await callRoute()

      expect(response.status).toBe(200)

      expect(
        body.venues.some(
          (venue: { id: string }) =>
            venue.id === VENUE_B
        )
      ).toBe(false)

      expect(
        body.venues.map(
          (venue: { rank: number }) =>
            venue.rank
        )
      ).toEqual([1, 2])
    })

    it('excludes venues with invalid names', async () => {
      seedQualifyingVenues()

      mockState.venues[0].name = null

      const { body } = await callRoute()

      expect(
        body.venues.some(
          (venue: { id: string }) =>
            venue.id === VENUE_A
        )
      ).toBe(false)
    })

    it('keeps otherwise eligible venues without coordinates', async () => {
      seedQualifyingVenues()

      mockState.venues[0].lat = null
      mockState.venues[0].lon = null

      const { body } = await callRoute()

      const venueA = body.venues.find(
        (venue: { id: string }) =>
          venue.id === VENUE_A
      )

      expect(venueA).toBeDefined()
      expect(venueA.lat).toBeNull()
      expect(venueA.lon).toBeNull()
    })

    it('preserves draft-status venue discoverability', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute()

      expect(body.status).toBe('trending')
      expect(body.venues).toHaveLength(3)
    })

    it('preserves the ranking limit', async () => {
      seedQualifyingVenues()

      const { body } = await callRoute('limit=1')

      expect(body.venues).toHaveLength(1)
      expect(body.count).toBe(1)
      expect(body.venues[0].rank).toBe(1)
    })
  })

  /* =======================================================
   * Malformed aggregate protection
   * ===================================================== */

  describe('aggregate validation', () => {
    it.each([
      {
        label: 'missing venue ID',
        changes: {
          venue_id: null,
        },
      },
      {
        label: 'negative unique visitors',
        changes: {
          current_unique_visitors: -1,
        },
      },
      {
        label: 'fractional visit count',
        changes: {
          current_verified_visits: 5.5,
        },
      },
      {
        label: 'NaN visit count',
        changes: {
          current_verified_visits: Number.NaN,
        },
      },
      {
        label: 'infinite visitor count',
        changes: {
          current_unique_visitors:
            Number.POSITIVE_INFINITY,
        },
      },
      {
        label: 'unsafe bigint count',
        changes: {
          current_unique_visitors:
            '9007199254740992',
        },
      },
      {
        label: 'non-numeric count',
        changes: {
          current_verified_visits: 'many',
        },
      },
      {
        label: 'negative string count',
        changes: {
          current_verified_visits: '-5',
        },
      },
      {
        label: 'unique visitors exceeding visits',
        changes: {
          current_unique_visitors: 20,
          current_verified_visits: 10,
        },
      },
      {
        label: 'previous unique visitors exceeding visits',
        changes: {
          previous_unique_visitors: 20,
          previous_verified_visits: 10,
        },
      },
      {
        label: 'recent visits exceeding current visits',
        changes: {
          recent_verified_visits: 20,
          current_verified_visits: 15,
        },
      },
      {
        label: 'invalid timestamp',
        changes: {
          last_verified_visit_at: 'not-a-date',
        },
      },
      {
        label: 'missing timestamp with current visits',
        changes: {
          last_verified_visit_at: null,
        },
      },
      {
        label: 'timestamp without current visits',
        changes: {
          current_unique_visitors: 0,
          current_verified_visits: 0,
          recent_verified_visits: 0,
        },
      },
    ])(
      'returns 502 for $label',
      async ({ changes }) => {
        mockState.aggregates = [
          createAggregate(changes),
        ]

        const spy = suppressExpectedErrors()

        try {
          const { response, body } = await callRoute()

          expect(response.status).toBe(502)
          expect(body.error).toBe(
            'Unable to process trending places.'
          )

          expect(mockState.queryCalls).toHaveLength(0)
        } finally {
          spy.mockRestore()
        }
      }
    )

    it('returns 502 for a non-array RPC response', async () => {
      mockState.invalidRpcShape = true

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(502)
        expect(body.error).toBe(
          'Unable to process trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 502 for a non-object aggregate row', async () => {
      mockState.aggregates = [
        null as unknown as Record<string, unknown>,
      ]

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(502)
        expect(body.error).toBe(
          'Unable to process trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 502 for duplicate venue aggregates', async () => {
      mockState.aggregates = [
        createAggregate({
          venue_id: VENUE_A,
        }),
        createAggregate({
          venue_id: VENUE_A,
        }),
      ]

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(502)
        expect(body.error).toBe(
          'Unable to process trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('rejects duplicate venue IDs case-insensitively', async () => {
      mockState.aggregates = [
        createAggregate({
          venue_id: VENUE_A,
        }),
        createAggregate({
          venue_id: VENUE_A.toUpperCase(),
        }),
      ]

      const spy = suppressExpectedErrors()

      try {
        const { response } = await callRoute()

        expect(response.status).toBe(502)
      } finally {
        spy.mockRestore()
      }
    })
  })

  /* =======================================================
   * Error handling
   * ===================================================== */

  describe('failure handling', () => {
    it('returns 500 when the aggregation RPC fails', async () => {
      mockState.rpcError = {
        message: 'Simulated SQL function error',
      }

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unable to load trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 500 when the aggregation RPC throws', async () => {
      mockState.rpcThrows = true

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 500 when client initialization throws', async () => {
      mockState.clientThrows = true

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 500 when venue metadata query fails', async () => {
      seedQualifyingVenues()

      mockState.venueError = {
        message: 'Simulated venue SELECT error',
      }

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unable to load trending venue details.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 500 when venue metadata query throws', async () => {
      seedQualifyingVenues()

      mockState.venueQueryThrows = true

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading trending places.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns 500 for malformed venue metadata response', async () => {
      seedQualifyingVenues()

      mockState.invalidVenueShape = true

      const spy = suppressExpectedErrors()

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unable to load trending venue details.'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('does not expose internal database errors or secrets', async () => {
      mockState.rpcError = {
        message:
          'SECRET_DATABASE_ERROR_SUPABASE_SERVICE_ROLE_KEY',
      }

      const spy = suppressExpectedErrors()

      try {
        const { body } = await callRoute()

        const serialized = JSON.stringify(body)

        expect(serialized).not.toContain(
          'SECRET_DATABASE_ERROR'
        )

        expect(serialized).not.toContain(
          'test-server-only-service-role-key'
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('returns no-store headers for database errors', async () => {
      mockState.rpcError = {
        message: 'Simulated error',
      }

      const spy = suppressExpectedErrors()

      try {
        const { response } = await callRoute()

        expect(
          response.headers.get('Cache-Control')
        ).toBe('private, no-store')
      } finally {
        spy.mockRestore()
      }
    })
  })
})
