
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  selectVenueVisitWriter: vi.fn(),
  rebuildPassport: vi.fn(),
  getRoamDay: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock(
  '@/lib/active-flow/trustedVenueVisitWriter.server',
  () => ({
    selectActiveFlowVenueVisitWriter:
      mocks.selectVenueVisitWriter,
  })
)

vi.mock(
  '@/lib/passport/rebuildPublicPassportStats',
  () => ({
    rebuildPublicPassportStats:
      mocks.rebuildPassport,
  })
)

vi.mock('@/lib/reputation/safelyRefreshCreatorReputation', () => ({
  safelyRefreshCreatorReputation: vi.fn(),
}))

vi.mock('@/lib/roam/roamDay', () => ({
  getRoamDay: mocks.getRoamDay,
}))

import { POST } from './route'

const USER_ID = 'user-hosted-crawl-test'
const CRAWL_ID = 'crawl-hosted-test'
const VENUE_ID = 'venue-hosted-test'

const LATITUDE = 33.75
const LONGITUDE = -84.39

const ORIGINAL_VISITED_AT =
  '2026-10-19T17:00:00.000Z'

const EXISTING_PROGRESS = {
  id: 'progress-hosted-test',
  crawl_id: CRAWL_ID,
  user_id: USER_ID,
  venue_id: VENUE_ID,
  stop_index: 0,
  completed_at: ORIGINAL_VISITED_AT,
  user_lat: LATITUDE,
  user_lon: LONGITUDE,
  distance_meters: 0,
  location_accuracy_meters: 10,
  geo_verified: true,
  check_in_source: 'geo',
  device_timestamp: null,
}

const CANONICAL_VISIT = {
  id: 'visit-hosted-test',
  venue_id: VENUE_ID,
  rating: 5,
  visited_at: ORIGINAL_VISITED_AT,
  geo_verified: true,
  check_in_source: 'hosted_flow',
}

type Scenario = {
  existingProgress?: boolean
  existingCanonicalVisit?: boolean
  distanceRejected?: boolean
  visitInsertFailure?: boolean
  latestVisitToday?: boolean
}

type RecordedOperation = {
  client: 'authenticated' | 'trusted'
  table: string
  method: string
  payload?: unknown
}

function createScenario(
  options: Scenario = {}
) {
  const operations: RecordedOperation[] = []

  const scenario = {
    existingProgress:
      options.existingProgress ?? false,

    existingCanonicalVisit:
      options.existingCanonicalVisit ?? false,

    distanceRejected:
      options.distanceRejected ?? false,

    visitInsertFailure:
      options.visitInsertFailure ?? false,

    latestVisitToday:
      options.latestVisitToday ?? false,
  }

  const insertedProgress = {
    ...EXISTING_PROGRESS,
    id: 'fresh-progress-hosted-test',
    completed_at:
      '2026-10-20T18:00:00.000Z',
  }

  const insertedVisit = {
    ...CANONICAL_VISIT,
    id: 'fresh-visit-hosted-test',
    visited_at:
      '2026-10-20T18:00:00.000Z',
  }

  function buildClient(
    clientName: 'authenticated' | 'trusted'
  ) {
    function from(table: string) {
      let method = 'select'
      let payload: unknown = undefined

      const filters: Record<string, unknown> = {}

      const query = {
        select: vi.fn((_columns?: string) => query),

        eq: vi.fn(
          (column: string, value: unknown) => {
            filters[column] = value
            return query
          }
        ),

        is: vi.fn(
          (column: string, value: unknown) => {
            filters[column] = value
            return query
          }
        ),

        order: vi.fn(() => query),

        limit: vi.fn(() => query),

        insert: vi.fn((value: unknown) => {
          method = 'insert'
          payload = value

          operations.push({
            client: clientName,
            table,
            method,
            payload,
          })

          return query
        }),

        update: vi.fn((value: unknown) => {
          method = 'update'
          payload = value

          operations.push({
            client: clientName,
            table,
            method,
            payload,
          })

          return query
        }),

        maybeSingle: vi.fn(async () => {
          if (table === 'crawl_events') {
            return {
              data: {
                id: CRAWL_ID,
                venue_ids: [VENUE_ID],
              },
              error: null,
            }
          }

          if (table === 'venues') {
            return {
              data: {
                id: VENUE_ID,
                lat:
                  scenario.distanceRejected
                    ? 34.75
                    : LATITUDE,
                lon: LONGITUDE,
                city: 'Atlanta',
              },
              error: null,
            }
          }

          if (table === 'crawl_progress') {
            return {
              data:
                scenario.existingProgress
                  ? EXISTING_PROGRESS
                  : null,
              error: null,
            }
          }

          if (table === 'venue_visits') {
            if (
              filters.check_in_source ===
              'hosted_flow'
            ) {
              return {
                data:
                  scenario.existingCanonicalVisit
                    ? CANONICAL_VISIT
                    : null,
                error: null,
              }
            }

            if (scenario.latestVisitToday) {
              return {
                data: {
                  visited_at:
                    '2026-10-20T16:00:00.000Z',
                },
                error: null,
              }
            }

            return {
              data: null,
              error: null,
            }
          }

          throw new Error(
            `Unexpected maybeSingle table: ${table}`
          )
        }),

        single: vi.fn(async () => {
          if (
            table === 'crawl_progress' &&
            method === 'insert'
          ) {
            return {
              data: insertedProgress,
              error: null,
            }
          }

          if (
            table === 'venue_visits' &&
            method === 'insert'
          ) {
            if (scenario.visitInsertFailure) {
              return {
                data: null,
                error: {
                  message:
                    'Simulated venue visit failure',
                },
              }
            }

            return {
              data: {
                ...insertedVisit,
                visited_at:
                  (
                    payload as {
                      visited_at?: string
                    }
                  ).visited_at ??
                  insertedVisit.visited_at,
              },
              error: null,
            }
          }

          throw new Error(
            `Unexpected single: ${table}.${method}`
          )
        }),

        then(
          resolve: (
            result: {
              data: unknown
              error: unknown
            }
          ) => unknown,
          reject?: (reason: unknown) => unknown
        ) {
          try {
            if (
              table === 'crawl_progress' &&
              method === 'select'
            ) {
              return Promise.resolve(
                resolve({
                  data: [
                    {
                      stop_index: 0,
                    },
                  ],
                  error: null,
                })
              )
            }

            if (
              table === 'crawl_rsvps' &&
              method === 'update'
            ) {
              return Promise.resolve(
                resolve({
                  data: null,
                  error: null,
                })
              )
            }

            throw new Error(
              `Unexpected awaited query: ${table}.${method}`
            )
          } catch (error) {
            if (reject) {
              return Promise.resolve(
                reject(error)
              )
            }

            return Promise.reject(error)
          }
        },
      }

      return query
    }

    return {
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: USER_ID,
            },
          },
          error: null,
        })),
      },

      from: vi.fn(from),
    }
  }

  const authenticatedClient =
    buildClient('authenticated')

  const trustedClient =
    buildClient('trusted')

  mocks.createServerClient.mockResolvedValue(
    authenticatedClient
  )

  mocks.selectVenueVisitWriter.mockImplementation(
    ({
      enabled,
      authenticatedClient: suppliedClient,
    }: {
      enabled: boolean
      authenticatedClient: unknown
    }) =>
      enabled
        ? trustedClient
        : suppliedClient
  )

  return {
    operations,
    authenticatedClient,
    trustedClient,
  }
}

function createRequest(
  overrides: Record<string, unknown> = {}
): Request {
  return new Request(
    'http://localhost/api/crawl-progress/check-in',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        crawl_id: CRAWL_ID,
        venue_id: VENUE_ID,
        stop_index: 0,
        rating: 5,
        user_lat: LATITUDE,
        user_lon: LONGITUDE,
        location_accuracy_meters: 10,
        device_timestamp:
          '2026-10-20T18:00:00.000Z',
        ...overrides,
      }),
    }
  )
}

async function runCheckIn(
  overrides: Record<string, unknown> = {}
) {
  const response = await POST(
    createRequest(overrides)
  )

  const body = await response.json()

  return {
    response,
    body,
  }
}

describe(
  'Hosted Crawl trusted venue-visit persistence',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      delete process.env
        .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

      mocks.rebuildPassport.mockResolvedValue(
        undefined
      )

      mocks.getRoamDay.mockImplementation(
        (value: string) =>
          typeof value === 'string'
            ? value.slice(0, 10)
            : null
      )
    })

    it(
      'uses the existing authenticated writer when the flag is absent',
      async () => {
        const scenario = createScenario()

        const {
          response,
          body,
        } = await runCheckIn()

        expect(response.status).toBe(200)
        expect(body.geoVerified).toBe(true)
        expect(body.xpEarned).toBe(25)

        expect(
          mocks.selectVenueVisitWriter
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
            authenticatedClient:
              scenario.authenticatedClient,
          })
        )

        expect(
          scenario.operations.filter(
            operation =>
              operation.table ===
                'venue_visits' &&
              operation.method ===
                'insert'
          )
        ).toEqual([
          expect.objectContaining({
            client: 'authenticated',
            table: 'venue_visits',
            method: 'insert',
            payload:
              expect.objectContaining({
                user_id: USER_ID,
                venue_id: VENUE_ID,
                rating: 5,
                geo_verified: true,
                check_in_source:
                  'hosted_flow',
              }),
          }),
        ])

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(USER_ID)
      }
    )

    it(
      'routes only the canonical visit insert through the trusted client when enabled',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario = createScenario()

        const { response } =
          await runCheckIn()

        expect(response.status).toBe(200)

        expect(
          mocks.selectVenueVisitWriter
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: true,
            authenticatedClient:
              scenario.authenticatedClient,
          })
        )

        expect(
          scenario.operations.filter(
            operation =>
              operation.method === 'insert'
          ).map(operation => ({
            client: operation.client,
            table: operation.table,
          }))
        ).toEqual([
          {
            client: 'authenticated',
            table: 'crawl_progress',
          },
          {
            client: 'trusted',
            table: 'venue_visits',
          },
        ])

        expect(
          scenario.trustedClient.auth
            .getUser
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'does not create duplicate progress or visits on a completed retry',
      async () => {
        const scenario = createScenario({
          existingProgress: true,
          existingCanonicalVisit: true,
        })

        const {
          response,
          body,
        } = await runCheckIn()

        expect(response.status).toBe(200)
        expect(body.xpEarned).toBe(0)
        expect(body.venueVisit).toEqual(
          CANONICAL_VISIT
        )

        expect(
          scenario.operations.some(
            operation =>
              operation.method === 'insert'
          )
        ).toBe(false)

        expect(
          mocks.rebuildPassport
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'uses the trusted writer to repair a missing canonical visit without rewriting progress',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario = createScenario({
          existingProgress: true,
          existingCanonicalVisit: false,
        })

        const {
          response,
          body,
        } = await runCheckIn()

        expect(response.status).toBe(200)
        expect(body.xpEarned).toBe(0)

        const inserts =
          scenario.operations.filter(
            operation =>
              operation.method === 'insert'
          )

        expect(inserts).toHaveLength(1)

        expect(inserts[0]).toEqual(
          expect.objectContaining({
            client: 'trusted',
            table: 'venue_visits',
            payload:
              expect.objectContaining({
                user_id: USER_ID,
                venue_id: VENUE_ID,
                visited_at:
                  ORIGINAL_VISITED_AT,
                check_in_source:
                  'hosted_flow',
              }),
          })
        )

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(USER_ID)
      }
    )

    it(
      'rejects an out-of-range GPS check-in before any trusted write',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario = createScenario({
          distanceRejected: true,
        })

        const { response } =
          await runCheckIn()

        expect(response.status).toBe(400)

        expect(
          scenario.operations
        ).toHaveLength(0)

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'preserves partial-failure behavior when canonical visit persistence fails',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario = createScenario({
          visitInsertFailure: true,
        })

        const {
          response,
          body,
        } = await runCheckIn()

        expect(response.status).toBe(500)

        expect(body.error).toContain(
          'venue visit could not be recorded'
        )

        expect(
          scenario.operations.filter(
            operation =>
              operation.method === 'insert'
          ).map(operation => ({
            client: operation.client,
            table: operation.table,
          }))
        ).toEqual([
          {
            client: 'authenticated',
            table: 'crawl_progress',
          },
          {
            client: 'trusted',
            table: 'venue_visits',
          },
        ])

        expect(
          mocks.rebuildPassport
        ).not.toHaveBeenCalled()
      }
    )
  }
)
