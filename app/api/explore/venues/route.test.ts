
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { NextRequest } from 'next/server'

/* =========================================================
 * Server-only and Supabase mocks
 * ======================================================= */

vi.mock('server-only', () => ({}))

type VenueRow = {
  id: string
  name: string | null
  description: string | null
  city: string | null
  canonical_city: string | null
  address: string | null
  cover: string | null
  type: string[] | null
  vibe: string[] | null
  tags: string[] | null
  price: string | null
  lat: number | null
  lon: number | null
  profile_status: string | null
  access_token?: string | null
  contact?: string[] | null
}

type DatabaseError = {
  message: string
}

type QueryResult = {
  data: VenueRow[] | null
  error: DatabaseError | null
}

const mockState = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  queryError: null as { message: string } | null,
  throwOnQuery: false,
  createClientError: false,
  calls: [] as {
    table: string
    select: string | null
    filters: {
      column: string
      value: unknown
      method: string
    }[]
    order: {
      column: string
      ascending: boolean
    } | null
    range: {
      from: number
      to: number
    } | null
  }[],
}))

/**
 * Emulates the PostgREST query chain used by GET:
 *
 * .from('venues')
 * .select(columns)
 * .neq('city', 'oob')
 * .eq('city', city) // optional
 * .order('id', { ascending: true })
 * .range(from, to)
 *
 * Queries resolve at .range().
 */
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => {
    if (mockState.createClientError) {
      throw new Error(
        'Simulated Supabase initialization failure'
      )
    }

    return {
      from(table: string) {
        const call = {
          table,
          select: null as string | null,
          filters: [] as {
            column: string
            value: unknown
            method: string
          }[],
          order: null as {
            column: string
            ascending: boolean
          } | null,
          range: null as {
            from: number
            to: number
          } | null,
        }

        mockState.calls.push(call)

        const builder = {
          select(columns: string) {
            call.select = columns
            return builder
          },

          neq(
            column: string,
            value: unknown
          ) {
            call.filters.push({
              column,
              value,
              method: 'neq',
            })

            return builder
          },

          eq(
            column: string,
            value: unknown
          ) {
            call.filters.push({
              column,
              value,
              method: 'eq',
            })

            return builder
          },

          order(
            column: string,
            options: {
              ascending: boolean
            }
          ) {
            call.order = {
              column,
              ascending: options.ascending,
            }

            return builder
          },

          async range(
            from: number,
            to: number
          ): Promise<QueryResult> {
            call.range = {
              from,
              to,
            }

            if (mockState.throwOnQuery) {
              throw new Error(
                'Simulated query exception'
              )
            }

            if (mockState.queryError) {
              return {
                data: null,
                error: mockState.queryError,
              }
            }

            let rows = [...mockState.rows]

            for (const filter of call.filters) {
              if (filter.method === 'neq') {
                rows = rows.filter(
                  (row) =>
                    row[filter.column] !== filter.value &&
                    row[filter.column] !== null
                )
              }

              if (filter.method === 'eq') {
                rows = rows.filter(
                  (row) =>
                    row[filter.column] === filter.value
                )
              }
            }

            if (call.order) {
              const column = call.order.column

              rows.sort((a, b) => {
                const left = String(a[column] ?? '')
                const right = String(b[column] ?? '')
                const comparison = left.localeCompare(right)

                return call.order?.ascending
                  ? comparison
                  : -comparison
              })
            }

            /**
             * Apply the requested column projection.
             *
             * This protects against accidentally
             * selecting internal database fields.
             */
            const selectedColumns = (call.select ?? '')
              .split(',')
              .map((column) => column.trim())
              .filter(Boolean)

            const projected = rows.map((row) => {
              const result: Record<string, unknown> = {}

              for (const column of selectedColumns) {
                result[column] = row[column] ?? null
              }

              return result
            })

            return {
              data: projected.slice(from, to + 1) as VenueRow[],
              error: null,
            }
          },
        }

        return builder
      },
    }
  }),
}))

/* =========================================================
 * Route under test
 * ======================================================= */

import { GET } from './route'

/* =========================================================
 * Fixtures
 * ======================================================= */

const ATLANTA_COFFEE_ID =
  '11111111-1111-4111-8111-111111111111'

const ATLANTA_DINING_ID =
  '22222222-2222-4222-8222-222222222222'

const NYC_COFFEE_ID =
  '33333333-3333-4333-8333-333333333333'

const OOB_VENUE_ID =
  '44444444-4444-4444-8444-444444444444'

const LONDON_VENUE_ID =
  '55555555-5555-4555-8555-555555555555'

const PORTO_VENUE_ID =
  '66666666-6666-4666-8666-666666666666'

const COFFEE_DESCRIPTION_ID =
  '77777777-7777-4777-8777-777777777777'

function createVenue(
  overrides: Partial<VenueRow> = {}
): VenueRow {
  return {
    id: ATLANTA_COFFEE_ID,
    name: 'Atlanta Coffee House',
    description: 'A friendly neighborhood cafe.',
    city: 'atl',
    canonical_city: 'atl',
    address: '123 Main Street, Atlanta',
    cover: 'img/venues/coffee.jpg',
    type: ['coffee'],
    vibe: ['cozy', 'casual'],
    tags: ['espresso', 'local'],
    price: '$',
    lat: 33.749,
    lon: -84.388,
    profile_status: 'draft',
    access_token: 'private-venue-token',
    contact: ['private-contact'],
    ...overrides,
  }
}

function createDefaultVenues(): VenueRow[] {
  return [
    createVenue({
      id: ATLANTA_COFFEE_ID,
      name: 'Atlanta Coffee House',
    }),

    createVenue({
      id: ATLANTA_DINING_ID,
      name: 'The Garden Room',
      description: 'A romantic dinner destination.',
      type: ['restaurant'],
      vibe: ['romantic', 'intimate'],
      tags: ['dinner', 'date night'],
      lat: 33.76,
      lon: -84.4,
    }),

    createVenue({
      id: NYC_COFFEE_ID,
      name: 'Manhattan Coffee Bar',
      city: 'nyc',
      canonical_city: 'nyc',
      address: 'New York, NY',
      lat: 40.7128,
      lon: -74.006,
      type: ['coffee'],
      vibe: ['modern'],
    }),

    createVenue({
      id: OOB_VENUE_ID,
      name: 'Out of Bounds Venue',
      city: 'oob',
      canonical_city: 'oob',
    }),

    createVenue({
      id: LONDON_VENUE_ID,
      name: 'London Social',
      city: 'london',
      canonical_city: 'london',
      type: ['bar'],
      vibe: ['lively'],
      lat: 51.5074,
      lon: -0.1278,
    }),

    createVenue({
      id: PORTO_VENUE_ID,
      name: 'Porto Hidden Gem',
      city: 'porto',
      canonical_city: 'porto',
      type: ['wine bar'],
      vibe: ['cozy'],
      lat: 41.1579,
      lon: -8.6291,
    }),

    createVenue({
      id: COFFEE_DESCRIPTION_ID,
      name: 'The Reading Room',
      description: 'A quiet place to enjoy specialty coffee.',
      type: ['library lounge'],
      vibe: ['calm'],
      tags: ['books'],
      lat: 33.755,
      lon: -84.391,
    }),
  ]
}

function request(params = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/explore/venues${
      params ? `?${params}` : ''
    }`
  )
}

async function callRoute(params = '') {
  const response = await GET(request(params))
  const body = await response.json()

  return {
    response,
    body,
  }
}

/* =========================================================
 * Setup
 * ======================================================= */

beforeEach(() => {
  mockState.rows = createDefaultVenues()
  mockState.queryError = null
  mockState.throwOnQuery = false
  mockState.createClientError = false
  mockState.calls = []

  vi.clearAllMocks()
})

/* =========================================================
 * Public endpoint and response contract
 * ======================================================= */

describe('GET /api/explore/venues', () => {
  describe('public browsing', () => {
    it('returns venues without requiring authentication', async () => {
      const { response, body } = await callRoute()

      expect(response.status).toBe(200)
      expect(body.venues).toHaveLength(6)
      expect(body.pagination.total).toBe(6)
    })

    it('returns the established response contract', async () => {
      const { body } = await callRoute(
        'city=atl&limit=2'
      )

      expect(Object.keys(body).sort()).toEqual([
        'filters',
        'pagination',
        'venues',
      ])

      // Three Atlanta fixtures, not four.
      expect(body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasMore: true,
      })

      expect(body.filters).toEqual({
        q: '',
        city: 'atl',
        category: null,
        vibe: null,
        sort: 'relevance',
        locationProvided: false,
      })
    })

    it('returns only explicitly public-facing venue fields', async () => {
      const { body } = await callRoute(
        'city=atl&limit=1'
      )

      const venue = body.venues[0]

      expect(Object.keys(venue).sort()).toEqual([
        'address',
        'canonicalCity',
        'city',
        'cover',
        'description',
        'distanceMiles',
        'flowBuilderHref',
        'id',
        'lat',
        'lon',
        'name',
        'price',
        'profileHref',
        'supportsDistance',
        'tags',
        'type',
        'vibe',
      ])

      expect('access_token' in venue).toBe(false)
      expect('contact' in venue).toBe(false)
      expect('profile_status' in venue).toBe(false)
    })

    it('selects only explicitly approved database columns', async () => {
      await callRoute()

      expect(mockState.calls.length).toBeGreaterThan(0)

      for (const call of mockState.calls) {
        expect(call.table).toBe('venues')
        expect(call.select).not.toBeNull()
        expect(call.select).not.toContain('*')
        expect(call.select).toContain('id')
        expect(call.select).toContain('name')
        expect(call.select).toContain('description')
        expect(call.select).toContain('profile_status')
        expect(call.select).not.toContain('access_token')
        expect(call.select).not.toContain('contact')
      }
    })

    it('returns no-store cache headers', async () => {
      const { response } = await callRoute()

      expect(
        response.headers.get('Cache-Control')
      ).toBe('private, no-store')
    })
  })

  /* =======================================================
   * Explore eligibility
   * ===================================================== */

  describe('venue eligibility', () => {
    it('excludes OOB venues', async () => {
      const { body } = await callRoute()

      expect(
        body.venues.some(
          (venue: { id: string }) =>
            venue.id === OOB_VENUE_ID
        )
      ).toBe(false)
    })

    it('rejects explicit OOB city requests', async () => {
      const { response, body } = await callRoute(
        'city=oob'
      )

      expect(response.status).toBe(400)
      expect(body.error).toContain('not available')
      expect(mockState.calls).toHaveLength(0)
    })

    it('does not exclude venues because profile_status is draft', async () => {
      const { body } = await callRoute('city=atl')

      expect(body.venues).toHaveLength(3)
      expect(body.pagination.total).toBe(3)
    })

    it('excludes invalid canonical venue IDs', async () => {
      mockState.rows.push(
        createVenue({
          id: 'not-a-uuid',
          name: 'Invalid Venue',
        })
      )

      const { body } = await callRoute('city=atl')

      expect(
        body.venues.some(
          (venue: { id: string }) =>
            venue.id === 'not-a-uuid'
        )
      ).toBe(false)

      expect(body.pagination.total).toBe(3)
    })

    it('excludes venues with missing names', async () => {
      mockState.rows.push(
        createVenue({
          id: '88888888-8888-4888-8888-888888888888',
          name: null,
        })
      )

      const { body } = await callRoute('city=atl')

      expect(body.venues).toHaveLength(3)
      expect(body.pagination.total).toBe(3)
    })

    it('keeps live venues without coordinates discoverable', async () => {
      mockState.rows.push(
        createVenue({
          id: '99999999-9999-4999-8999-999999999999',
          name: 'Coordinates Missing',
          lat: null,
          lon: null,
        })
      )

      const { body } = await callRoute(
        'q=Coordinates+Missing'
      )

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].supportsDistance).toBe(false)
      expect(body.venues[0].lat).toBeNull()
      expect(body.venues[0].lon).toBeNull()
      expect(body.venues[0].distanceMiles).toBeNull()
    })
  })

  /* =======================================================
   * Search
   * ===================================================== */

  describe('search', () => {
    it('searches venue names', async () => {
      const { body } = await callRoute('q=Garden')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].name).toBe('The Garden Room')
    })

    it('searches description text', async () => {
      const { body } = await callRoute('q=specialty')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].name).toBe('The Reading Room')
    })

    it('searches category/type', async () => {
      const { body } = await callRoute('q=wine')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].name).toBe('Porto Hidden Gem')
    })

    it('searches vibe', async () => {
      const { body } = await callRoute('q=romantic')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].name).toBe('The Garden Room')
    })

    it('searches tags using a unique fixture value', async () => {
      mockState.rows.push(
        createVenue({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Unique Tag Venue',
          description: 'A neighborhood gathering space.',
          type: ['cafe'],
          vibe: ['quiet'],
          tags: ['uniquetagxyz'],
        })
      )

      const { body } = await callRoute(
        'q=uniquetagxyz'
      )

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].name).toBe(
        'Unique Tag Venue'
      )
    })

    it('searches city', async () => {
      const { body } = await callRoute('q=london')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].name).toBe('London Social')
    })

    it('matches multiple terms across different fields', async () => {
      const { body } = await callRoute(
        'q=cozy+coffee&city=atl'
      )

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].id).toBe(
        ATLANTA_COFFEE_ID
      )
    })

    it('rejects results missing any search term', async () => {
      const { body } = await callRoute(
        'q=cozy+nightclub'
      )

      expect(body.venues).toHaveLength(0)
    })

    it('prioritizes exact venue-name matches', async () => {
      mockState.rows.push(
        createVenue({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Coffee',
        })
      )

      const { body } = await callRoute('q=Coffee')

      expect(body.venues[0].name).toBe('Coffee')
    })

    it('performs case-insensitive search', async () => {
      const lower = await callRoute(
        'q=atlanta+coffee'
      )

      const upper = await callRoute(
        'q=ATLANTA+COFFEE'
      )

      const lowerIds = lower.body.venues.map(
        (venue: { id: string }) => venue.id
      )

      const upperIds = upper.body.venues.map(
        (venue: { id: string }) => venue.id
      )

      expect(upperIds).toEqual(lowerIds)
      expect(upperIds).toContain(
        ATLANTA_COFFEE_ID
      )
    })
  })

  /* =======================================================
   * Filtering
   * ===================================================== */

  describe('filters', () => {
    it('filters by city', async () => {
      const { body } = await callRoute('city=nyc')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].id).toBe(NYC_COFFEE_ID)
    })

    it('filters by category', async () => {
      const { body } = await callRoute(
        'category=restaurant'
      )

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].id).toBe(
        ATLANTA_DINING_ID
      )
    })

    it('filters by vibe', async () => {
      const { body } = await callRoute('vibe=lively')

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].id).toBe(
        LONDON_VENUE_ID
      )
    })

    it('combines city, category, vibe, and search', async () => {
      const { body } = await callRoute(
        'city=atl&category=coffee&vibe=cozy&q=espresso'
      )

      expect(body.venues).toHaveLength(1)
      expect(body.venues[0].id).toBe(
        ATLANTA_COFFEE_ID
      )
    })

    it('sends city filtering into the database query', async () => {
      await callRoute('city=atl')

      expect(mockState.calls[0].filters).toContainEqual({
        method: 'eq',
        column: 'city',
        value: 'atl',
      })

      expect(mockState.calls[0].filters).toContainEqual({
        method: 'neq',
        column: 'city',
        value: 'oob',
      })
    })
  })

  /* =======================================================
   * Pagination
   * ===================================================== */

  describe('pagination', () => {
    it('uses page 1 and limit 24 by default', async () => {
      const { body } = await callRoute()

      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(24)
    })

    it('paginates matching results deterministically', async () => {
      const first = await callRoute(
        'city=atl&limit=2&page=1&sort=name'
      )

      const second = await callRoute(
        'city=atl&limit=2&page=2&sort=name'
      )

      // Three Atlanta fixtures: 2 on page 1, 1 on page 2.
      expect(first.body.venues).toHaveLength(2)
      expect(second.body.venues).toHaveLength(1)

      expect(first.body.pagination.total).toBe(3)
      expect(second.body.pagination.total).toBe(3)

      const firstIds = first.body.venues.map(
        (venue: { id: string }) => venue.id
      )

      const secondIds = second.body.venues.map(
        (venue: { id: string }) => venue.id
      )

      expect(
        firstIds.some((id: string) =>
          secondIds.includes(id)
        )
      ).toBe(false)

      expect(first.body.pagination.hasMore).toBe(true)
      expect(second.body.pagination.hasMore).toBe(false)
    })

    it('returns an empty page beyond available results', async () => {
      const { body } = await callRoute(
        'city=nyc&page=10&limit=2'
      )

      expect(body.venues).toEqual([])
      expect(body.pagination).toMatchObject({
        page: 10,
        total: 1,
        totalPages: 1,
        hasMore: false,
      })
    })

    it('limits result size to 48 records', async () => {
      const { response, body } = await callRoute(
        'limit=49'
      )

      expect(response.status).toBe(400)
      expect(body.error).toContain(
        'Invalid page size'
      )
    })

    it('fetches database rows in bounded batches', async () => {
      const rows: VenueRow[] = []

      for (let index = 0; index < 501; index += 1) {
        rows.push(
          createVenue({
            id: `00000000-0000-4000-8000-${String(
              index + 1
            ).padStart(12, '0')}`,
            name: `Venue ${index}`,
          })
        )
      }

      mockState.rows = rows

      const { response, body } = await callRoute(
        'limit=1'
      )

      expect(response.status).toBe(200)
      expect(body.pagination.total).toBe(501)
      expect(mockState.calls).toHaveLength(2)

      expect(mockState.calls[0].range).toEqual({
        from: 0,
        to: 499,
      })

      expect(mockState.calls[1].range).toEqual({
        from: 500,
        to: 999,
      })
    })

    it('fails explicitly when catalog reaches the safety limit', async () => {
      const rows: VenueRow[] = []

      for (let index = 0; index < 10000; index += 1) {
        rows.push(
          createVenue({
            id: `00000000-0000-4000-8000-${String(
              index + 1
            ).padStart(12, '0')}`,
            name: `Venue ${index}`,
          })
        )
      }

      mockState.rows = rows

      const { response, body } = await callRoute()

      expect(response.status).toBe(503)
      expect(body.error).toContain(
        'exceeds the current search capacity'
      )
    })
  })

  /* =======================================================
   * Sorting and distance
   * ===================================================== */

  describe('sorting and distance', () => {
    it('sorts alphabetically by name', async () => {
      const { body } = await callRoute(
        'city=atl&sort=name'
      )

      const names = body.venues.map(
        (venue: { name: string }) => venue.name
      )

      expect(names).toEqual(
        [
          'Atlanta Coffee House',
          'The Garden Room',
          'The Reading Room',
        ].sort((a, b) => a.localeCompare(b))
      )
    })

    it('returns null distances without user coordinates', async () => {
      const { body } = await callRoute()

      expect(
        body.venues.every(
          (venue: { distanceMiles: number | null }) =>
            venue.distanceMiles === null
        )
      ).toBe(true)
    })

    it('returns zero miles at the exact venue coordinates', async () => {
      const { body } = await callRoute(
        'q=Atlanta+Coffee+House&lat=33.749&lon=-84.388'
      )

      expect(body.venues).toHaveLength(1)
      expect(
        body.venues[0].distanceMiles
      ).toBeCloseTo(0, 8)
    })

    it('calculates realistic straight-line distances in miles', async () => {
      const { body } = await callRoute(
        'city=atl&lat=33.749&lon=-84.388'
      )

      const garden = body.venues.find(
        (venue: { id: string }) =>
          venue.id === ATLANTA_DINING_ID
      )

      expect(garden).toBeDefined()
      expect(garden.distanceMiles).toBeGreaterThan(0.5)
      expect(garden.distanceMiles).toBeLessThan(2)
    })

    it('sorts nearest venues by distance', async () => {
      const { body } = await callRoute(
        'city=atl&sort=nearest&lat=33.749&lon=-84.388'
      )

      expect(body.venues[0].id).toBe(
        ATLANTA_COFFEE_ID
      )

      const distances = body.venues.map(
        (venue: { distanceMiles: number }) =>
          venue.distanceMiles
      )

      expect(distances).toEqual(
        [...distances].sort(
          (a: number, b: number) => a - b
        )
      )
    })

    it('places venues without coordinates after venues with distances', async () => {
      mockState.rows.push(
        createVenue({
          id: '99999999-9999-4999-8999-999999999999',
          name: 'Zero Coordinates',
          lat: null,
          lon: null,
        })
      )

      const { body } = await callRoute(
        'city=atl&sort=nearest&lat=33.749&lon=-84.388'
      )

      expect(body.venues.at(-1).name).toBe(
        'Zero Coordinates'
      )

      expect(
        body.venues.at(-1).distanceMiles
      ).toBeNull()
    })
  })

  /* =======================================================
   * Input validation
   * ===================================================== */

  describe('request validation', () => {
    it.each([
      {
        query: 'page=0',
        error: 'Invalid page number',
      },
      {
        query: 'page=-1',
        error: 'Invalid page number',
      },
      {
        query: 'page=abc',
        error: 'Invalid page number',
      },
      {
        query: 'page=1001',
        error: 'Invalid page number',
      },
      {
        query: 'limit=0',
        error: 'Invalid page size',
      },
      {
        query: 'limit=-3',
        error: 'Invalid page size',
      },
      {
        query: 'limit=abc',
        error: 'Invalid page size',
      },
      {
        query: 'limit=49',
        error: 'Invalid page size',
      },
      {
        query: 'sort=trending',
        error: 'Invalid sort option',
      },
      {
        query: 'sort=nearest',
        error: 'Nearest sorting requires a valid location',
      },
      {
        query: 'lat=33.749',
        error:
          'Latitude and longitude must be provided together',
      },
      {
        query: 'lon=-84.388',
        error:
          'Latitude and longitude must be provided together',
      },
      {
        query: 'lat=91&lon=0',
        error: 'Invalid location coordinates',
      },
      {
        query: 'lat=0&lon=181',
        error: 'Invalid location coordinates',
      },
      {
        query: 'lat=NaN&lon=0',
        error: 'Invalid location coordinates',
      },
      {
        query: 'lat=&lon=0',
        error: 'Invalid location coordinates',
      },
      {
        query: 'city=oob',
        error:
          'The selected city is not available for exploration',
      },
    ])(
      'rejects $query',
      async ({ query, error }) => {
        const { response, body } = await callRoute(query)

        expect(response.status).toBe(400)
        expect(body.error).toContain(error)
        expect(mockState.calls).toHaveLength(0)
      }
    )

    it('rejects excessively long search strings', async () => {
      const { response } = await callRoute(
        `q=${'a'.repeat(121)}`
      )

      expect(response.status).toBe(400)
    })

    it('rejects excessively long city filters', async () => {
      const { response } = await callRoute(
        `city=${'a'.repeat(81)}`
      )

      expect(response.status).toBe(400)
    })

    it('accepts valid location coordinates with nearest sorting', async () => {
      const { response } = await callRoute(
        'city=atl&sort=nearest&lat=33.749&lon=-84.388'
      )

      expect(response.status).toBe(200)
    })
  })

  /* =======================================================
   * Database failure paths
   * ===================================================== */

  describe('failure handling', () => {
    it('returns 500 when the venue query fails', async () => {
      mockState.queryError = {
        message: 'Simulated database error',
      }

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe('Unable to load places.')
      } finally {
        consoleSpy.mockRestore()
      }
    })

    it('returns 500 when the Supabase client cannot initialize', async () => {
      mockState.createClientError = true

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading places.'
        )
      } finally {
        consoleSpy.mockRestore()
      }
    })

    it('returns 500 when the query unexpectedly throws', async () => {
      mockState.throwOnQuery = true

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      try {
        const { response, body } = await callRoute()

        expect(response.status).toBe(500)
        expect(body.error).toBe(
          'Unexpected error loading places.'
        )
      } finally {
        consoleSpy.mockRestore()
      }
    })

    it('does not expose internal database error details to callers', async () => {
      mockState.queryError = {
        message: 'access_token=SECRET_DATABASE_VALUE',
      }

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      try {
        const { body } = await callRoute()

        expect(
          JSON.stringify(body)
        ).not.toContain('SECRET_DATABASE_VALUE')
      } finally {
        consoleSpy.mockRestore()
      }
    })
  })

  /* =======================================================
   * Link contracts
   * ===================================================== */

  describe('venue action destinations', () => {
    it('returns canonical venue-profile links', async () => {
      const { body } = await callRoute(
        'q=Atlanta+Coffee+House'
      )

      expect(body.venues[0].profileHref).toBe(
        `/venue-profile/${ATLANTA_COFFEE_ID}`
      )
    })

    it('returns venue-ID-based Flow Builder links', async () => {
      const { body } = await callRoute(
        'q=Atlanta+Coffee+House'
      )

      expect(body.venues[0].flowBuilderHref).toBe(
        `/sponsor-crawl?venueId=${ATLANTA_COFFEE_ID}`
      )
    })
  })
})
