
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  supabaseServerApi: vi.fn(),
  selectVenueVisitWriter: vi.fn(),
  createClient: vi.fn(),
  rebuildPassport: vi.fn(),
  refreshCreatorReputation: vi.fn(),
  getRoamDay: vi.fn(),
}))

vi.mock('@/lib/supabase/server-api', () => ({
  supabaseServerApi: mocks.supabaseServerApi,
}))

vi.mock(
  '@/lib/active-flow/trustedVenueVisitWriter.server',
  () => ({
    selectActiveFlowVenueVisitWriter:
      mocks.selectVenueVisitWriter,
  })
)

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock(
  '@/lib/passport/rebuildPublicPassportStats',
  () => ({
    rebuildPublicPassportStats:
      mocks.rebuildPassport,
  })
)

vi.mock(
  '@/lib/reputation/safelyRefreshCreatorReputation',
  () => ({
    safelyRefreshCreatorReputation:
      mocks.refreshCreatorReputation,
  })
)

vi.mock('@/lib/roam/roamDay', () => ({
  getRoamDay: mocks.getRoamDay,
}))

import {
  DELETE,
  PATCH,
  POST,
} from './route'

const USER_ID = 'venue-visit-test-user'

const VENUE_ID =
  '00000000-0000-4000-8000-000000000001'

const SESSION_ID =
  '00000000-0000-4000-8000-000000000002'

const LATITUDE = 33.75
const LONGITUDE = -84.39

const ORIGINAL_VISITED_AT =
  '2026-10-18T18:00:00.000Z'

const ORIGINAL_FLAG =
  process.env
    .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

type ClientName =
  | 'authenticated'
  | 'trusted'

type Operation = {
  client: ClientName
  table: string
  method: string
  payload?: unknown
  filters?: Record<string, unknown>
}

type ScenarioOptions = {
  authenticated?: boolean
  rejectGps?: boolean
  existingVisit?: boolean
  activeFlowProof?: boolean
  existingActiveFlowVisit?: boolean
  sameRoamDay?: boolean
}

const EXISTING_VISIT = {
  id: 'existing-venue-visit',
  rating: 4,
  visited_at: ORIGINAL_VISITED_AT,
  created_at: ORIGINAL_VISITED_AT,
  updated_at: ORIGINAL_VISITED_AT,
}

const ACTIVE_FLOW_PROOF = {
  id: 'existing-flow-progress',
  session_id: SESSION_ID,
  checked_in_at: ORIGINAL_VISITED_AT,
  user_lat: LATITUDE,
  user_lon: LONGITUDE,
  distance_meters: 0,
  location_accuracy_meters: 10,
  geo_verified: true,
  check_in_source: 'geo',
  device_timestamp: null,
}

function createScenario(
  options: ScenarioOptions = {}
) {
  const operations: Operation[] = []

  const scenario = {
    authenticated:
      options.authenticated ?? true,

    rejectGps:
      options.rejectGps ?? false,

    existingVisit:
      options.existingVisit ?? false,

    activeFlowProof:
      options.activeFlowProof ?? false,

    existingActiveFlowVisit:
      options.existingActiveFlowVisit ??
      false,

    sameRoamDay:
      options.sameRoamDay ?? false,
  }

  const insertedVisit = {
    id: 'inserted-venue-visit',
    rating: 5,
    visited_at:
      '2026-10-20T18:00:00.000Z',
    created_at:
      '2026-10-20T18:00:00.000Z',
    updated_at:
      '2026-10-20T18:00:00.000Z',
  }

  function buildClient(
    clientName: ClientName
  ) {
    function from(table: string) {
      let method = 'select'
      let payload: unknown

      const filters:
        Record<string, unknown> = {}

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

        update: vi.fn(
          (value: unknown) => {
            method = 'update'
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

        delete: vi.fn(() => {
          method = 'delete'

          operations.push({
            client: clientName,
            table,
            method,
            filters,
          })

          return query
        }),

        maybeSingle: vi.fn(
          async () => {
            if (table === 'venues') {
              return {
                data: {
                  id: VENUE_ID,
                  lat:
                    scenario.rejectGps
                      ? 34.75
                      : LATITUDE,
                  lon: LONGITUDE,
                  city: 'Atlanta',
                },
                error: null,
              }
            }

            if (
              table ===
              'active_flow_progress'
            ) {
              return {
                data:
                  scenario.activeFlowProof
                    ? ACTIVE_FLOW_PROOF
                    : null,
                error: null,
              }
            }

            if (
              table === 'venue_visits'
            ) {
              if (method === 'update') {
                return {
                  data: {
                    ...EXISTING_VISIT,
                    rating:
                      (
                        payload as {
                          rating: number
                        }
                      ).rating,
                  },
                  error: null,
                }
              }

              if (
                filters.check_in_source ===
                'active_flow'
              ) {
                return {
                  data:
                    scenario
                      .existingActiveFlowVisit
                      ? EXISTING_VISIT
                      : null,
                  error: null,
                }
              }

              return {
                data:
                  scenario.existingVisit
                    ? EXISTING_VISIT
                    : null,
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
              return {
                data: {
                  ...insertedVisit,
                  rating:
                    (
                      payload as {
                        rating?: number | null
                      }
                    ).rating ?? null,
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
          }
        ),

        then(
          resolve: (
            result: {
              data: unknown
              error: unknown
            }
          ) => unknown,
          reject?: (
            reason: unknown
          ) => unknown
        ) {
          try {
            if (
              table ===
                'venue_visits' &&
              method === 'delete'
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
        getUser: vi.fn(
          async () => ({
            data: {
              user:
                scenario.authenticated
                  ? { id: USER_ID }
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

  mocks.getRoamDay.mockImplementation(
    (value: string) => {
      if (scenario.sameRoamDay) {
        return '2026-10-20'
      }

      return typeof value === 'string'
        ? value.slice(0, 10)
        : null
    }
  )

  return {
    operations,
    authenticatedClient,
    trustedClient,
  }
}

function request(
  method: 'POST' | 'PATCH' | 'DELETE',
  overrides: Record<string, unknown> = {}
) {
  return new Request(
    `http://localhost/api/venue-profile/${VENUE_ID}/visit`,
    {
      method,
      headers: {
        'content-type':
          'application/json',
      },
      ...(method === 'DELETE'
        ? {}
        : {
            body: JSON.stringify({
              rating: 5,
              user_lat: LATITUDE,
              user_lon: LONGITUDE,
              location_accuracy_meters:
                10,
              device_timestamp:
                '2026-10-20T18:00:00.000Z',
              ...overrides,
            }),
          }),
    }
  )
}

function routeContext() {
  return {
    params: Promise.resolve({
      venueId: VENUE_ID,
    }),
  }
}

async function runPost(
  overrides: Record<string, unknown> = {}
) {
  const response = await POST(
    request(
      'POST',
      overrides
    ) as Parameters<typeof POST>[0],
    routeContext()
  )

  return {
    response,
    body: await response.json(),
  }
}

async function runPatch(
  overrides: Record<string, unknown> = {}
) {
  const response = await PATCH(
    request(
      'PATCH',
      overrides
    ) as Parameters<typeof PATCH>[0],
    routeContext()
  )

  return {
    response,
    body: await response.json(),
  }
}

async function runDelete() {
  const response = await DELETE(
    request(
      'DELETE'
    ) as Parameters<typeof DELETE>[0],
    routeContext()
  )

  return {
    response,
    body: await response.json(),
  }
}

function operationsFor(
  operations: Operation[],
  table: string,
  method: string
) {
  return operations.filter(
    operation =>
      operation.table === table &&
      operation.method === method
  )
}

describe(
  'Venue Profile visit trusted-writer boundaries',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      delete process.env
        .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

      mocks.rebuildPassport.mockResolvedValue(
        undefined
      )

      mocks.refreshCreatorReputation
        .mockResolvedValue(undefined)

      mocks.createClient.mockReturnValue({
        rpc: vi.fn(
          async () => ({
            data: null,
            error: null,
          })
        ),
      })
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
      'POST uses the original authenticated writer when the flag is absent',
      async () => {
        const scenario =
          createScenario()

        const { response, body } =
          await runPost()

        expect(response.status).toBe(200)
        expect(body.visited).toBe(true)
        expect(body.geoVerified).toBe(true)

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
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toEqual([
          expect.objectContaining({
            client: 'authenticated',
            payload:
              expect.objectContaining({
                user_id: USER_ID,
                venue_id: VENUE_ID,
                rating: 5,
                geo_verified: true,
                check_in_source: 'geo',
              }),
          }),
        ])

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(
          USER_ID
        )

        expect(
          mocks.refreshCreatorReputation
        ).toHaveBeenCalledWith(
          USER_ID,
          expect.objectContaining({
            mutation: 'venue_visit_post',
          })
        )
      }
    )

    it(
      'POST uses only the trusted client for a validated visit insert',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario()

        const { response } =
          await runPost()

        expect(response.status).toBe(200)

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toEqual([
          expect.objectContaining({
            client: 'trusted',
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
          mocks.selectVenueVisitWriter
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: true,
            authenticatedClient:
              scenario.authenticatedClient,
          })
        )
      }
    )

    it(
      'POST rejects invalid GPS before selecting a privileged writer',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            rejectGps: true,
          })

        const { response } =
          await runPost()

        expect(response.status).toBe(400)

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toHaveLength(0)

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'POST preserves the existing same-Roam-day duplicate restriction',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            existingVisit: true,
            sameRoamDay: true,
          })

        const { response } =
          await runPost()

        expect(response.status).toBe(409)

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toHaveLength(0)

        expect(
          mocks.rebuildPassport
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'PATCH updates an existing rating using the authenticated client only',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            existingVisit: true,
          })

        const { response, body } =
          await runPatch({
            rating: 3,
          })

        expect(response.status).toBe(200)
        expect(body.rating).toBe(3)

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'update'
          )
        ).toEqual([
          expect.objectContaining({
            client: 'authenticated',
            payload: {
              rating: 3,
              updated_at:
                expect.any(String),
            },
          }),
        ])

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toHaveLength(0)

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'PATCH rates an existing Active Flow visit without creating another visit',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            activeFlowProof: true,
            existingActiveFlowVisit:
              true,
          })

        const { response, body } =
          await runPatch({
            rating: 4,
          })

        expect(response.status).toBe(200)
        expect(body.rating).toBe(4)

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'update'
          )
        ).toEqual([
          expect.objectContaining({
            client: 'authenticated',
            payload:
              expect.objectContaining({
                rating: 4,
              }),
          }),
        ])

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toHaveLength(0)

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'PATCH repairs a missing Active Flow visit through the trusted writer while preserving its timestamp',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario({
            activeFlowProof: true,
            existingActiveFlowVisit:
              false,
          })

        const { response, body } =
          await runPatch({
            rating: 5,
          })

        expect(response.status).toBe(200)
        expect(
          body.proofSource
        ).toBe('active_flow_progress')

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'insert'
          )
        ).toEqual([
          expect.objectContaining({
            client: 'trusted',
            payload:
              expect.objectContaining({
                user_id: USER_ID,
                venue_id: VENUE_ID,
                rating: 5,
                visited_at:
                  ORIGINAL_VISITED_AT,
                geo_verified: true,
                check_in_source:
                  'active_flow',
              }),
          }),
        ])

        expect(
          operationsFor(
            scenario.operations,
            'venue_visits',
            'update'
          )
        ).toHaveLength(0)

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(
          USER_ID
        )

        expect(
          mocks.refreshCreatorReputation
        ).toHaveBeenCalledWith(
          USER_ID,
          expect.objectContaining({
            mutation:
              'venue_visit_patch_active_flow',
          })
        )
      }
    )

    it(
      'DELETE retains authenticated ownership-scoped deletion and refreshes derived data',
      async () => {
        process.env
          .ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          'true'

        const scenario =
          createScenario()

        const { response, body } =
          await runDelete()

        expect(response.status).toBe(200)
        expect(body.visited).toBe(false)

        const deletes =
          operationsFor(
            scenario.operations,
            'venue_visits',
            'delete'
          )

        expect(deletes).toHaveLength(1)

        expect(deletes[0]).toEqual(
          expect.objectContaining({
            client: 'authenticated',
            filters:
              expect.objectContaining({
                venue_id: VENUE_ID,
                user_id: USER_ID,
              }),
          })
        )

        expect(
          mocks.selectVenueVisitWriter
        ).not.toHaveBeenCalled()

        expect(
          mocks.rebuildPassport
        ).toHaveBeenCalledWith(
          USER_ID
        )

        expect(
          mocks.refreshCreatorReputation
        ).toHaveBeenCalledWith(
          USER_ID,
          expect.objectContaining({
            mutation:
              'venue_visit_delete',
          })
        )
      }
    )
  }
)
