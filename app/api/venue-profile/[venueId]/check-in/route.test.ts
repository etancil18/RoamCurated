
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  supabaseServerApi: vi.fn(),
  selectVenueVisitWriter: vi.fn(),
  getCityNow: vi.fn(),
  rebuildPassport: vi.fn(),
}))

vi.mock(
  '@/lib/supabase/server-api',
  () => ({
    supabaseServerApi:
      mocks.supabaseServerApi,
  })
)

vi.mock(
  '@/lib/active-flow/trustedVenueVisitWriter.server',
  () => ({
    selectActiveFlowVenueVisitWriter:
      mocks.selectVenueVisitWriter,
  })
)

vi.mock(
  '@/lib/getCityNow',
  () => ({
    getCityNow:
      mocks.getCityNow,
  })
)

vi.mock(
  '@/lib/passport/rebuildPublicPassportStats',
  () => ({
    rebuildPublicPassportStats:
      mocks.rebuildPassport,
  })
)

import { POST } from './route'

const USER_ID =
  'venue-check-in-test-user'

const VENUE_ID =
  '00000000-0000-4000-8000-000000000001'

const LATITUDE = 33.75
const LONGITUDE = -84.39

const NOW =
  '2026-10-20T18:00:00.000Z'

const VISIT_DATE =
  '2026-10-20'

const ORIGINAL_FLAG =
  process.env
    .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

type ClientName =
  | 'authenticated'
  | 'trusted'

type WriteOperation = {
  client: ClientName
  table: string
  method: string
  payload: unknown
}

type ScenarioOptions = {
  authenticated?: boolean
  distanceRejected?: boolean
  existingVisit?: boolean
  existingVisitToday?: boolean
  insertErrorCode?: string
  insertErrorMessage?: string
}

function createScenario(
  options: ScenarioOptions = {}
) {
  const operations: WriteOperation[] = []

  const scenario = {
    authenticated:
      options.authenticated ?? true,

    distanceRejected:
      options.distanceRejected ?? false,

    existingVisit:
      options.existingVisit ?? false,

    existingVisitToday:
      options.existingVisitToday ?? false,

    insertErrorCode:
      options.insertErrorCode ?? null,

    insertErrorMessage:
      options.insertErrorMessage ??
      'Simulated insert failure',
  }

  const canonicalVisit = {
    id: 'created-venue-visit-id',
    rating: 5,
    visited_at: NOW,
    visit_date: VISIT_DATE,
    created_at: NOW,
    updated_at: NOW,
  }

  const previousVisit = {
    id: 'previous-venue-visit-id',
    rating: 4,
    visited_at:
      '2026-10-18T18:00:00.000Z',
    visit_date:
      '2026-10-18',
    created_at:
      '2026-10-18T18:00:00.000Z',
    updated_at:
      '2026-10-18T18:00:00.000Z',
  }

  let venueVisitLookupCount = 0

  function buildClient(
    clientName: ClientName
  ) {
    function from(table: string) {
      let method = 'select'
      let payload: unknown = null

      const filters: Record<string, unknown> =
        {}

      const query = {
        select: vi.fn(
          (_columns?: string) => query
        ),

        eq: vi.fn(
          (
            column: string,
            value: unknown
          ) => {
            filters[column] = value
            return query
          }
        ),

        not: vi.fn(() => query),

        order: vi.fn(() => query),

        limit: vi.fn(() => query),

        insert: vi.fn(
          (value: unknown) => {
            method = 'insert'
            payload = value

            operations.push({
              client: clientName,
              table,
              method,
              payload,
            })

            return query
          }
        ),

        upsert: vi.fn(
          (value: unknown) => {
            method = 'upsert'
            payload = value

            operations.push({
              client: clientName,
              table,
              method,
              payload,
            })

            return Promise.resolve({
              data: null,
              error: null,
            })
          }
        ),

        maybeSingle: vi.fn(
          async () => {
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
                  name: 'Test Venue',
                },
                error: null,
              }
            }

            if (
              table === 'venue_visits'
            ) {
              venueVisitLookupCount += 1

              /*
               * For a first-time visit:
               *   lookup 1 = oldest existing visit
               *   lookup 2 = same-day visit
               *
               * For a repeat visitor:
               *   lookup 1 = oldest existing visit
               *   lookup 2 = latest rated visit
               *   lookup 3 = same-day visit
               */
              if (
                venueVisitLookupCount ===
                1
              ) {
                return {
                  data:
                    scenario.existingVisit
                      ? previousVisit
                      : null,
                  error: null,
                }
              }

              if (
                scenario.existingVisit &&
                venueVisitLookupCount ===
                  2
              ) {
                return {
                  data: {
                    rating: 4,
                  },
                  error: null,
                }
              }

              if (
                scenario.existingVisitToday
              ) {
                return {
                  data: {
                    ...canonicalVisit,
                    id:
                      'existing-today-visit-id',
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
          }
        ),

        single: vi.fn(
          async () => {
            if (
              table ===
                'venue_visits' &&
              method === 'insert'
            ) {
              if (
                scenario.insertErrorCode
              ) {
                return {
                  data: null,
                  error: {
                    code:
                      scenario.insertErrorCode,
                    message:
                      scenario.insertErrorMessage,
                  },
                }
              }

              return {
                data: {
                  ...canonicalVisit,
                  rating:
                    (
                      payload as {
                        rating?: number | null
                      }
                    ).rating ?? null,
                },
                error: null,
              }
            }

            throw new Error(
              `Unexpected single operation: ${table}.${method}`
            )
          }
        ),
      }

      return query
    }

    return {
      auth: {
        getUser: vi.fn(
          async () => ({
            data: {
              user:
                scenario.authenticated
                  ? {
                      id: USER_ID,
                    }
                  : null,
            },
            error: null,
          })
        ),
      },

      from: vi.fn(from),
    }
  }

  const authenticatedClient =
    buildClient('authenticated')

  const trustedClient =
    buildClient('trusted')

  mocks.supabaseServerApi.mockResolvedValue(
    authenticatedClient
  )

  mocks.selectVenueVisitWriter.mockImplementation(
    ({
      enabled,
      authenticatedClient:
        suppliedClient,
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
    `http://localhost/api/venue-profile/${VENUE_ID}/check-in`,
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify({
        rating: 5,
        user_lat: LATITUDE,
        user_lon: LONGITUDE,
        location_accuracy_meters:
          10,
        device_timestamp: NOW,
        source: 'venue_profile',
        ...overrides,
      }),
    }
  )
}

async function runCheckIn(
  overrides: Record<string, unknown> = {}
) {
  const response = await POST(
    createRequest(
      overrides
    ) as Parameters<typeof POST>[0],
    {
      params: Promise.resolve({
        venueId: VENUE_ID,
      }),
    }
  )

  return {
    response,
    body: await response.json(),
  }
}

function getVisitInserts(
  operations: WriteOperation[]
) {
  return operations.filter(
    operation =>
      operation.table ===
        'venue_visits' &&
      operation.method ===
        'insert'
  )
}

describe(
  'Venue Profile trusted GPS check-in persistence',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      delete process.env
        .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

      mocks.getCityNow.mockReturnValue({
        toUTC: () => ({
          toISO: () => NOW,
        }),
        toISODate: () =>
          VISIT_DATE,
        zoneName:
          'America/New_York',
      })

      mocks.rebuildPassport.mockResolvedValue(
        undefined
      )
    })

    afterEach(() => {
      if (
        ORIGINAL_FLAG === undefined
      ) {
        delete process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED
      } else {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          ORIGINAL_FLAG
      }
    })

    it(
      'uses the authenticated writer when the feature flag is absent',
      async () => {
        const scenario =
          createScenario()

        const {
          response,
          body,
        } = await runCheckIn()

        expect(
          response.status
        ).toBe(200)

        expect(
          body.geoVerified
        ).toBe(true)

        expect(
          body.firstVisit
        ).toBe(true)

        expect(
          body.xpEarned
        ).toBe(10)

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
          getVisitInserts(
            scenario.operations
          )
        ).toEqual([
          expect.objectContaining({
            client:
              'authenticated',
            table:
              'venue_visits',
            payload:
              expect.objectContaining({
                user_id:
                  USER_ID,
                venue_id:
                  VENUE_ID,
                rating: 5,
                geo_verified:
                  true,
                check_in_source:
                  'geo',
                visit_date:
                  VISIT_DATE,
              }),
          }),
        ])

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(
          USER_ID
        )
      }
    )

    it(
      'uses the trusted writer only for the canonical visit insert when enabled',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario()

        const {
          response,
        } = await runCheckIn()

        expect(
          response.status
        ).toBe(200)

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
          getVisitInserts(
            scenario.operations
          )
        ).toEqual([
          expect.objectContaining({
            client:
              'trusted',
            table:
              'venue_visits',
          }),
        ])

        expect(
          scenario.authenticatedClient
            .auth.getUser
        ).toHaveBeenCalledOnce()

        expect(
          scenario.trustedClient
            .auth.getUser
        ).not.toHaveBeenCalled()

        expect(
          scenario.operations
            .filter(
              operation =>
                operation.table ===
                  'event_xp_ledger'
            )
        ).toEqual([
          expect.objectContaining({
            client:
              'authenticated',
            method:
              'upsert',
          }),
        ])
      }
    )

    it(
      'rejects unauthenticated requests before selecting a trusted writer',
      async () => {
        const scenario =
          createScenario({
            authenticated:
              false,
          })

        const {
          response,
        } = await runCheckIn()

        expect(
          response.status
        ).toBe(401)

        expect(
          scenario.operations
        ).toHaveLength(0)

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'rejects out-of-range GPS attempts without creating visits',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            distanceRejected:
              true,
          })

        const {
          response,
          body,
        } = await runCheckIn()

        expect(
          response.status
        ).toBe(400)

        expect(
          body.error
        ).toContain(
          'closer to this venue'
        )

        expect(
          getVisitInserts(
            scenario.operations
          )
        ).toHaveLength(0)

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'preserves same-day duplicate protection before inserting a new visit',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            existingVisit:
              true,
            existingVisitToday:
              true,
          })

        const {
          response,
          body,
        } = await runCheckIn({
          rating: null,
        })

        expect(
          response.status
        ).toBe(409)

        expect(
          body.xpEarned
        ).toBe(0)

        expect(
          body.visitedToday
        ).toBe(true)

        expect(
          getVisitInserts(
            scenario.operations
          )
        ).toHaveLength(0)

        expect(
          mocks.rebuildPassport
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'preserves PostgreSQL duplicate-key conflict handling',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            insertErrorCode:
              '23505',
            insertErrorMessage:
              'Simulated unique constraint violation',
          })

        const {
          response,
          body,
        } = await runCheckIn()

        expect(
          response.status
        ).toBe(409)

        expect(
          body.xpEarned
        ).toBe(0)

        expect(
          body.geoVerified
        ).toBe(true)

        expect(
          getVisitInserts(
            scenario.operations
          )
        ).toHaveLength(1)

        expect(
          mocks.rebuildPassport
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'preserves property-guide XP and Passport refresh on a valid first visit',
      async () => {
        const scenario =
          createScenario()

        const {
          response,
          body,
        } = await runCheckIn({
          source:
            'property_guide',
          property_id:
            'property-test-id',
        })

        expect(
          response.status
        ).toBe(200)

        expect(
          body.xpEarned
        ).toBe(15)

        expect(
          getVisitInserts(
            scenario.operations
          )[0]
        ).toEqual(
          expect.objectContaining({
            payload:
              expect.objectContaining({
                check_in_source:
                  'property_guide',
              }),
          })
        )

        expect(
          scenario.operations
        ).toContainEqual(
          expect.objectContaining({
            table:
              'event_xp_ledger',
            method:
              'upsert',
            payload:
              expect.objectContaining({
                event_type:
                  'property_guide_single_venue_check_in',
                xp: 15,
              }),
          })
        )

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(
          USER_ID
        )
      }
    )
  }
)
