
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { Mock } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  loadRuntimeRoute: vi.fn(),
  selectWriter: vi.fn(),
  selectVisitWriter: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
    rpc: mocks.rpc,
  })),
}))

vi.mock('@/lib/active-flow/runtimeRoute.server', () => ({
  loadActiveFlowRuntimeRoute: mocks.loadRuntimeRoute,
}))

vi.mock('@/lib/passport/rebuildPublicPassportStats', () => ({
  rebuildPublicPassportStats: vi.fn(),
}))

vi.mock('@/lib/reputation/safelyRefreshCreatorReputation', () => ({
  safelyRefreshCreatorReputation: vi.fn(),
}))

vi.mock('@/lib/roam/roamDay', () => ({
  getRoamDay: vi.fn(),
}))

vi.mock('@/lib/active-flow/trustedProgressWriter.server', () => ({
  selectActiveFlowProgressWriter: mocks.selectWriter,
}))

vi.mock('@/lib/active-flow/trustedVenueVisitWriter.server', () => ({
  selectActiveFlowVenueVisitWriter: mocks.selectVisitWriter,
}))

const replayAttestationMock = vi.hoisted(() => ({
  persist: vi.fn(),
}))

vi.mock('@/lib/active-flow/trustedReplayAttestation.server', () => ({
  persistTrustedReplayAttestation: replayAttestationMock.persist,
}))

/**
 * The check-in route also constructs a service-role client for
 * best-effort downstream synchronization.
 *
 * This mock prevents that separate helper from connecting to
 * the real Supabase project during the success-path test.
 */
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(async () => ({
          data: null,
          error: null,
        })),
      }

      builder.select.mockReturnValue(builder)
      builder.eq.mockReturnValue(builder)

      return builder
    }),
  })),
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/active-flow/check-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('Active Flow check-in security boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.selectVisitWriter.mockImplementation(
      ({ authenticatedClient }) => authenticatedClient
    )
  })

  it('rejects unauthenticated users before querying Flow data', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const response = await POST(
      request({
        session_id: 'session-1',
        venue_id: 'venue-1',
        user_lat: 40,
        user_lon: -73,
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing GPS coordinates without querying Flow data', async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
      },
      error: null,
    })

    const response = await POST(
      request({
        session_id: 'session-1',
        venue_id: 'venue-1',
      })
    )

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('reuses existing verified progress without creating another check-in or venue visit', async () => {
    const sessionId = 'session-1'
    const venueId = 'venue-1'
    const userId = 'user-1'
    const checkedInAt = '2026-10-20T12:00:00.000Z'

    mocks.getUser.mockResolvedValue({
        data: {
        user: { id: userId },
        },
        error: null,
    })

    const progress = {
        id: 'progress-1',
        session_id: sessionId,
        user_id: userId,
        venue_id: venueId,
        flow_stop_id: 'stop-1',
        stop_index: 0,
        checked_in_at: checkedInAt,
        geo_verified: true,
        distance_meters: 12,
    }

    const existingVisit = {
        id: 'visit-1',
        venue_id: venueId,
        rating: 5,
        visited_at: checkedInAt,
        geo_verified: true,
        check_in_source: 'active_flow',
    }

    const query = (result: unknown) => {
        const builder: Record<string, unknown> = {}

        for (const method of [
        'select',
        'eq',
        'order',
        'limit',
        'update',
        ]) {
        builder[method] = vi.fn(() => builder)
        }

        builder.maybeSingle = vi.fn(async () => result)

        return builder
    }

    const sessionQuery = query({
        data: {
        id: sessionId,
        user_id: userId,
        venue_ids: [venueId],
        status: 'active',
        source: 'active_flow',
        source_id: null,
        title: 'Test Flow',
        city: 'New York',
        metadata: {},
        completed_stops: 1,
        },
        error: null,
    })

    const venueQuery = query({
        data: {
        id: venueId,
        lat: 40.7128,
        lon: -74.006,
        city: 'New York',
        },
        error: null,
    })

    const progressQuery = query({
        data: progress,
        error: null,
    })

    const visitQuery = query({
        data: existingVisit,
        error: null,
    })

    mocks.from.mockImplementation((table: string) => {
        if (table === 'active_flow_sessions') {
        return sessionQuery
        }

        if (table === 'venues') {
        return venueQuery
        }

        if (table === 'active_flow_progress') {
        return progressQuery
        }

        if (table === 'venue_visits') {
        return visitQuery
        }

        throw new Error(`Unexpected table: ${table}`)
    })

mocks.loadRuntimeRoute.mockResolvedValue([
        {
        id: 'stop-1',
        sessionId,
        venueId,
        position: 0,
        kind: 'base',
        completed: true,
        },
    ])

const response = await POST(
        request({
        session_id: sessionId,
        venue_id: venueId,
        stop_index: 0,
        user_lat: 40.7128,
        user_lon: -74.006,
        rating: 5,
        })
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.progress.id).toBe(progress.id)
    expect(body.xpEarned).toBe(0)
    expect(body.geoVerified).toBe(true)

    expect(mocks.from).toHaveBeenCalledWith(
        'active_flow_progress'
    )

    expect(
        (progressQuery as Record<string, Mock>).upsert
    ).toBeUndefined()

    expect(
        (visitQuery as Record<string, Mock>).insert
    ).toBeUndefined()
    })

  /**
   * Trusted writer security regression test.
   *
   * The production route is exercised with entirely mocked
   * Supabase clients and fictional GPS coordinates.
   *
   * This verifies the order and authority of the two writes:
   *
   * 1. Verified Active Flow progress through the trusted writer.
   * 2. Canonical venue visit through the authenticated client.
   *
   * No real database access or production mutation occurs.
   */
  it('uses the trusted writer for verified progress before creating the venue visit', async () => {
    const previousFlag =
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED

    const previousUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const previousKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    try {
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
        'true'

      process.env.NEXT_PUBLIC_SUPABASE_URL =
        'https://example.supabase.co'

      process.env.SUPABASE_SERVICE_ROLE_KEY =
        'dummy-test-key'

      /**
       * The flag is evaluated at module initialization.
       * Reload the route after enabling it for this test.
       */
      vi.resetModules()

      const { POST: trustedPOST } =
        await import('./route')

      const sessionId = 'session-1'
      const venueId = 'venue-1'
      const userId = 'user-1'

      const operations: string[] = []

      mocks.getUser.mockResolvedValue({
        data: {
          user: { id: userId },
        },
        error: null,
      })

      const progress = {
        id: 'progress-1',
        session_id: sessionId,
        user_id: userId,
        venue_id: venueId,
        flow_stop_id: 'stop-1',
        stop_index: 0,
        checked_in_at: '2026-10-20T12:00:00.000Z',
        geo_verified: true,
        check_in_source: 'geo',
        distance_meters: 0,
      }

      const venueVisit = {
        id: 'visit-1',
        venue_id: venueId,
        rating: 5,
        visited_at: progress.checked_in_at,
        geo_verified: true,
        check_in_source: 'active_flow',
      }

      function query(result: unknown) {
        const builder: Record<string, any> = {}

        for (const method of [
          'select',
          'eq',
          'order',
          'limit',
          'update',
        ]) {
          builder[method] = vi.fn(() => builder)
        }

        builder.maybeSingle =
          vi.fn(async () => result)

        builder.single =
          vi.fn(async () => result)

        return builder
      }

      let sessionReads = 0
      let venueVisitReads = 0

      mocks.from.mockImplementation((table: string) => {
        if (table === 'active_flow_sessions') {
          sessionReads += 1

          if (sessionReads === 1) {
            return query({
              data: {
                id: sessionId,
                user_id: userId,
                venue_ids: [venueId],
                status: 'active',
                source: 'active_flow',
                source_id: null,
                title: 'Test Flow',
                city: 'New York',
                metadata: {},
                completed_stops: 0,
              },
              error: null,
            })
          }

return query({
            error: null,
          })
        }

        if (table === 'venues') {
          return query({
            data: {
              id: venueId,
              lat: 40.7128,
              lon: -74.006,
              city: 'New York',
            },
            error: null,
          })
        }

        if (table === 'active_flow_progress') {
          return query({
            data: null,
            error: null,
          })
        }

        if (table === 'venue_visits') {
          venueVisitReads += 1

          /**
           * First call: historical visit eligibility lookup.
           */
          if (venueVisitReads === 1) {
            return query({
              data: null,
              error: null,
            })
          }

          /**
           * Second call: canonical venue visit insertion.
           */
          const builder = query({
            data: venueVisit,
            error: null,
          })

          builder.insert = vi.fn(() => {
            operations.push('venue_visit_insert')
            return builder
          })

          return builder
        }

        throw new Error(
          `Unexpected authenticated table: ${table}`
        )
      })

      const trustedProgressQuery = query({
        data: progress,
        error: null,
      })

trustedProgressQuery.upsert =
        vi.fn((payload: Record<string, unknown>) => {
          operations.push('trusted_progress_upsert')

          expect(payload).toMatchObject({
            session_id: sessionId,
            user_id: userId,
            venue_id: venueId,
            flow_stop_id: 'stop-1',
            stop_index: 0,
            geo_verified: true,
            check_in_source: 'geo',
          })

          return trustedProgressQuery
        })

      const trustedFrom = vi.fn((table: string) => {
        expect(table).toBe('active_flow_progress')

        return trustedProgressQuery
      })

      mocks.selectWriter.mockReturnValue({
        from: trustedFrom,
      })

      /**
       * First projection: the stop has not been checked in.
       * Second projection: persisted progress completes it.
       */
      mocks.loadRuntimeRoute
        .mockResolvedValueOnce([
          {
            id: 'stop-1',
            sessionId,
            venueId,
            position: 0,
            kind: 'base',
            completed: false,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'stop-1',
            sessionId,
            venueId,
            position: 0,
            kind: 'base',
            completed: true,
          },
        ])

      const response = await trustedPOST(
        request({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: 0,
          user_lat: 40.7128,
          user_lon: -74.006,
          rating: 5,
        })
      )

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.geoVerified).toBe(true)
      expect(body.progress.id).toBe(progress.id)
      expect(body.venueVisit.id).toBe(venueVisit.id)
      expect(body.completedStops).toBe(1)
      expect(body.totalStops).toBe(1)
      expect(body.flowCompleted).toBe(true)

      expect(mocks.selectWriter).toHaveBeenCalledOnce()

      expect(trustedFrom).toHaveBeenCalledWith(
        'active_flow_progress'
      )

      expect(
        trustedProgressQuery.upsert
      ).toHaveBeenCalledOnce()

      expect(operations).toEqual([
        'trusted_progress_upsert',
        'venue_visit_insert',
      ])
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
          previousFlag
      }

      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL =
          previousUrl
      }

      if (previousKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY =
          previousKey
      }

      vi.resetModules()
    }
  })

  /**
   * Trusted progress-write failure regression.
   *
   * A failed canonical progress write must stop the request
   * before any venue_visits insertion.
   *
   * All database clients are mocked.
   */
  it('does not create a venue visit when the trusted progress write fails', async () => {
    const previousFlag =
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED

    const previousUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const previousKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    try {
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
        'true'

      process.env.NEXT_PUBLIC_SUPABASE_URL =
        'https://example.supabase.co'

      process.env.SUPABASE_SERVICE_ROLE_KEY =
        'dummy-test-key'

      vi.resetModules()

      const { POST: trustedPOST } =
        await import('./route')

      const sessionId = 'session-failure'
      const venueId = 'venue-failure'
      const userId = 'user-failure'

      mocks.getUser.mockResolvedValue({
        data: {
          user: { id: userId },
        },
        error: null,
      })

      function query(result: unknown) {
        const builder: Record<string, any> = {}

        for (const method of [
          'select',
          'eq',
          'order',
          'limit',
          'update',
        ]) {
          builder[method] = vi.fn(() => builder)
        }

        builder.maybeSingle =
          vi.fn(async () => result)

        builder.single =
          vi.fn(async () => result)

        return builder
      }

      const venueVisitInsert = vi.fn()
      const venueVisitAccess = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'active_flow_sessions') {
          return query({
            data: {
              id: sessionId,
              user_id: userId,
              venue_ids: [venueId],
              status: 'active',
              source: 'active_flow',
              source_id: null,
              title: 'Failure Test Flow',
              city: 'New York',
              metadata: {},
              completed_stops: 0,
            },
            error: null,
          })
        }

        if (table === 'venues') {
          return query({
            data: {
              id: venueId,
              lat: 40.7128,
              lon: -74.006,
              city: 'New York',
            },
            error: null,
          })
        }

        if (table === 'active_flow_progress') {
          return query({
            data: null,
            error: null,
          })
        }

        if (table === 'venue_visits') {
          venueVisitAccess()

          const builder = query({
            data: null,
            error: null,
          })

          builder.insert = venueVisitInsert

          return builder
        }

        throw new Error(
          `Unexpected authenticated table: ${table}`
        )
      })

mocks.loadRuntimeRoute.mockResolvedValue([
        {
          id: 'stop-failure',
          sessionId,
          venueId,
          position: 0,
          kind: 'base',
          completed: false,
        },
      ])

      const trustedProgressQuery = query({
        data: null,
        error: {
          message: 'Simulated database failure',
        },
      })

      trustedProgressQuery.upsert =
        vi.fn(() => trustedProgressQuery)

      const trustedFrom = vi.fn((table: string) => {
        expect(table).toBe('active_flow_progress')

        return trustedProgressQuery
      })

      mocks.selectWriter.mockReturnValue({
        from: trustedFrom,
      })

      const response = await trustedPOST(
        request({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: 0,
          user_lat: 40.7128,
          user_lon: -74.006,
          rating: 5,
        })
      )

      expect(response.status).toBe(500)

      expect(await response.json()).toMatchObject({
        error: 'Could not check in.',
      })

      expect(mocks.selectWriter).toHaveBeenCalledOnce()

      expect(
        trustedProgressQuery.upsert
      ).toHaveBeenCalledOnce()

      /**
       * The historical visit lookup may run before the
       * progress upsert. But an INSERT must never occur
       * after the progress write fails.
       */
      expect(venueVisitAccess).toHaveBeenCalledOnce()

      expect(
        venueVisitInsert
      ).not.toHaveBeenCalled()
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
          previousFlag
      }

      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL =
          previousUrl
      }

      if (previousKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY =
          previousKey
      }

      vi.resetModules()
    }
  })

  /**
   * Venue-visit partial-failure regression.
   *
   * The verified progress upsert succeeds, but the next
   * authenticated venue_visits insertion returns an error.
   *
   * The route must retain its existing HTTP 500 response
   * without silently claiming the full check-in completed.
   *
   * The database is entirely mocked. This test cannot
   * establish real transaction durability or retry repair.
   */
  it('preserves the partial-failure response when venue-visit persistence fails', async () => {
    const previousFlag =
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED

    const previousUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const previousKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    try {
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
        'true'

      process.env.NEXT_PUBLIC_SUPABASE_URL =
        'https://example.supabase.co'

      process.env.SUPABASE_SERVICE_ROLE_KEY =
        'dummy-test-key'

      vi.resetModules()

      const { POST: trustedPOST } =
        await import('./route')

      const sessionId = 'session-partial'
      const venueId = 'venue-partial'
      const userId = 'user-partial'

      mocks.getUser.mockResolvedValue({
        data: {
          user: { id: userId },
        },
        error: null,
      })

      function query(result: unknown) {
        const builder: Record<string, any> = {}

        for (const method of [
          'select',
          'eq',
          'order',
          'limit',
          'update',
        ]) {
          builder[method] = vi.fn(() => builder)
        }

        builder.maybeSingle =
          vi.fn(async () => result)

        builder.single =
          vi.fn(async () => result)

        return builder
      }

let venueVisitReads = 0
      const venueVisitInsert = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'active_flow_sessions') {
          return query({
            data: {
              id: sessionId,
              user_id: userId,
              venue_ids: [venueId],
              status: 'active',
              source: 'active_flow',
              source_id: null,
              title: 'Partial Failure Flow',
              city: 'New York',
              metadata: {},
              completed_stops: 0,
            },
            error: null,
          })
        }

        if (table === 'venues') {
          return query({
            data: {
              id: venueId,
              lat: 40.7128,
              lon: -74.006,
              city: 'New York',
            },
            error: null,
          })
        }

        if (table === 'active_flow_progress') {
          return query({
            data: null,
            error: null,
          })
        }

        if (table === 'venue_visits') {
          venueVisitReads += 1

          if (venueVisitReads === 1) {
            return query({
              data: null,
              error: null,
            })
          }

          const builder = query({
            data: null,
            error: {
              message: 'Simulated venue-visit failure',
            },
          })

          builder.insert = vi.fn((payload: unknown) => {
            venueVisitInsert(payload)
            return builder
          })

          return builder
        }

        throw new Error(
          `Unexpected authenticated table: ${table}`
        )
      })

      mocks.loadRuntimeRoute.mockResolvedValue([
        {
          id: 'stop-partial',
          sessionId,
          venueId,
          position: 0,
          kind: 'base',
          completed: false,
        },
      ])

      const progress = {
        id: 'progress-partial',
        session_id: sessionId,
        user_id: userId,
        venue_id: venueId,
        flow_stop_id: 'stop-partial',
        stop_index: 0,
        geo_verified: true,
        check_in_source: 'geo',
      }

      const trustedProgressQuery = query({
        data: progress,
        error: null,
      })

      trustedProgressQuery.upsert =
        vi.fn(() => trustedProgressQuery)

      const trustedFrom = vi.fn((table: string) => {
        expect(table).toBe('active_flow_progress')

        return trustedProgressQuery
      })

      mocks.selectWriter.mockReturnValue({
        from: trustedFrom,
      })

      const response = await trustedPOST(
        request({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: 0,
          user_lat: 40.7128,
          user_lon: -74.006,
          rating: 5,
        })
      )

      expect(response.status).toBe(500)

      expect(await response.json()).toMatchObject({
        error:
          'The check-in was verified, but the venue visit could not be recorded.',
      })

      expect(mocks.selectWriter).toHaveBeenCalledOnce()

      expect(
        trustedProgressQuery.upsert
      ).toHaveBeenCalledOnce()

      expect(venueVisitReads).toBe(2)

      expect(venueVisitInsert).toHaveBeenCalledOnce()

      expect(venueVisitInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          venue_id: venueId,
          geo_verified: true,
          check_in_source: 'active_flow',
        })
      )

      /**
       * Progress was submitted before the visit write failed.
       * No real database durability is asserted by this mock.
       */
      expect(trustedFrom).toHaveBeenCalledWith(
        'active_flow_progress'
      )
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
          previousFlag
      }

      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL =
          previousUrl
      }

      if (previousKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY =
          previousKey
      }

      vi.resetModules()
    }
  })

  /**
   * Trusted venue-visit persistence — fresh check-in.
   *
   * The progress writer's separate feature flag remains
   * disabled in this test. The authenticated client performs
   * the progress upsert, and the trusted client performs
   * the canonical venue_visits INSERT.
   *
   * All database clients and GPS values are mocked.
   */
  it('uses the trusted venue-visit writer after fresh verified progress persists', async () => {
    const previousVisitFlag =
      process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

    const previousProgressFlag =
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED

    const previousUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const previousKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    try {
      process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
        'true'

      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
        'false'

      process.env.NEXT_PUBLIC_SUPABASE_URL =
        'https://example.supabase.co'

      process.env.SUPABASE_SERVICE_ROLE_KEY =
        'dummy-test-key'

      vi.resetModules()

      const { POST: trustedPOST } =
        await import('./route')

      const sessionId = 'session-trusted-visit'
      const venueId = 'venue-trusted-visit'
      const userId = 'user-trusted-visit'

      const operations: string[] = []

      mocks.getUser.mockResolvedValue({
        data: {
          user: { id: userId },
        },
        error: null,
      })

      function query(result: unknown) {
        const builder: Record<string, any> = {}

        for (const method of [
          'select',
          'eq',
          'order',
          'limit',
          'update',
        ]) {
          builder[method] = vi.fn(() => builder)
        }

        builder.maybeSingle =
          vi.fn(async () => result)

        builder.single =
          vi.fn(async () => result)

        return builder
      }

      const progress = {
        id: 'progress-trusted-visit',
        session_id: sessionId,
        user_id: userId,
        venue_id: venueId,
        flow_stop_id: 'stop-trusted-visit',
        stop_index: 0,
        checked_in_at: '2026-10-20T12:00:00.000Z',
        geo_verified: true,
        check_in_source: 'geo',
        distance_meters: 0,
      }

      const venueVisit = {
        id: 'visit-trusted-visit',
        venue_id: venueId,
        rating: 5,
        visited_at: progress.checked_in_at,
        geo_verified: true,
        check_in_source: 'active_flow',
      }

      let sessionAccesses = 0
      let progressAccesses = 0
      let visitReads = 0

      const authenticatedProgressQuery = query({
        data: progress,
        error: null,
      })

      authenticatedProgressQuery.upsert = vi.fn(
        (payload: Record<string, unknown>) => {
          operations.push('authenticated_progress_upsert')

          expect(payload).toMatchObject({
            session_id: sessionId,
            user_id: userId,
            venue_id: venueId,
            flow_stop_id: 'stop-trusted-visit',
            geo_verified: true,
          })

          return authenticatedProgressQuery
        }
      )

      const authenticatedVisitInsert = vi.fn(() => {
        throw new Error(
          'Venue visit INSERT must use trusted client'
        )
      })

      mocks.from.mockImplementation((table: string) => {
        if (table === 'active_flow_sessions') {
          sessionAccesses += 1

          if (sessionAccesses === 1) {
            return query({
              data: {
                id: sessionId,
                user_id: userId,
                venue_ids: [venueId],
                status: 'active',
                source: 'active_flow',
                source_id: null,
                title: 'Trusted Visit Test Flow',
                city: 'New York',
                metadata: {},
                completed_stops: 0,
              },
              error: null,
            })
          }

          return query({
            error: null,
          })
        }

        if (table === 'venues') {
          return query({
            data: {
              id: venueId,
              lat: 40.7128,
              lon: -74.006,
              city: 'New York',
            },
            error: null,
          })
        }

        if (table === 'active_flow_progress') {
          progressAccesses += 1

          if (progressAccesses === 1) {
            return query({
              data: null,
              error: null,
            })
          }

          return authenticatedProgressQuery
        }

        if (table === 'venue_visits') {
          visitReads += 1

          const builder = query({
            data: null,
            error: null,
          })

          builder.insert = authenticatedVisitInsert

          return builder
        }

        throw new Error(
          `Unexpected authenticated table: ${table}`
        )
      })

      const trustedVisitQuery = query({
        data: venueVisit,
        error: null,
      })

      trustedVisitQuery.insert = vi.fn(
        (payload: Record<string, unknown>) => {
          operations.push('trusted_venue_visit_insert')

          expect(payload).toMatchObject({
            user_id: userId,
            venue_id: venueId,
            rating: 5,
            geo_verified: true,
            check_in_source: 'active_flow',
          })

          return trustedVisitQuery
        }
      )

      const trustedFrom = vi.fn((table: string) => {
        expect(table).toBe('venue_visits')

        return trustedVisitQuery
      })

      mocks.selectVisitWriter.mockReturnValue({
        from: trustedFrom,
      })

      mocks.loadRuntimeRoute
        .mockResolvedValueOnce([
          {
            id: 'stop-trusted-visit',
            sessionId,
            venueId,
            position: 0,
            kind: 'base',
            completed: false,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'stop-trusted-visit',
            sessionId,
            venueId,
            position: 0,
            kind: 'base',
            completed: true,
          },
        ])

      const response = await trustedPOST(
        request({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: 0,
          user_lat: 40.7128,
          user_lon: -74.006,
          rating: 5,
        })
      )

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.geoVerified).toBe(true)
      expect(body.progress.id).toBe(progress.id)
      expect(body.venueVisit.id).toBe(venueVisit.id)
      expect(body.completedStops).toBe(1)
      expect(body.totalStops).toBe(1)
      expect(body.flowCompleted).toBe(true)

      expect(mocks.selectVisitWriter).toHaveBeenCalledOnce()

      expect(mocks.selectVisitWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          supabaseUrl: 'https://example.supabase.co',
          serviceRoleKey: 'dummy-test-key',
        })
      )

      expect(visitReads).toBe(1)

      expect(
        authenticatedProgressQuery.upsert
      ).toHaveBeenCalledOnce()

      expect(
        authenticatedVisitInsert
      ).not.toHaveBeenCalled()

      expect(
        trustedVisitQuery.insert
      ).toHaveBeenCalledOnce()

      expect(operations).toEqual([
        'authenticated_progress_upsert',
        'trusted_venue_visit_insert',
      ])

      expect(mocks.selectWriter).not.toHaveBeenCalled()
    } finally {
      if (previousVisitFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          previousVisitFlag
      }

      if (previousProgressFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
          previousProgressFlag
      }

      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL =
          previousUrl
      }

      if (previousKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY =
          previousKey
      }

      vi.resetModules()
    }
  })

  /**
   * Trusted venue-visit persistence — existing progress repair.
   *
   * Reads continue through the authenticated client.
   * If the matching canonical visit is missing, the repair
   * INSERT uses the separate trusted writer.
   *
   * Existing progress must not be upserted again.
   */
  it('uses the trusted venue-visit writer to repair existing progress without another progress upsert', async () => {
    const previousVisitFlag =
      process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED

    const previousProgressFlag =
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED

    const previousUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const previousKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    try {
      process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
        'true'

      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
        'false'

      process.env.NEXT_PUBLIC_SUPABASE_URL =
        'https://example.supabase.co'

      process.env.SUPABASE_SERVICE_ROLE_KEY =
        'dummy-test-key'

      vi.resetModules()

      const { POST: trustedPOST } =
        await import('./route')

      const sessionId = 'session-trusted-repair'
      const venueId = 'venue-trusted-repair'
      const userId = 'user-trusted-repair'
      const checkedInAt = '2026-10-20T12:00:00.000Z'

      mocks.getUser.mockResolvedValue({
        data: {
          user: { id: userId },
        },
        error: null,
      })

      function query(result: unknown) {
        const builder: Record<string, any> = {}

        for (const method of [
          'select',
          'eq',
          'order',
          'limit',
          'update',
        ]) {
          builder[method] = vi.fn(() => builder)
        }

        builder.maybeSingle =
          vi.fn(async () => result)

        builder.single =
          vi.fn(async () => result)

        return builder
      }

      const progress = {
        id: 'progress-trusted-repair',
        session_id: sessionId,
        user_id: userId,
        venue_id: venueId,
        flow_stop_id: 'stop-trusted-repair',
        stop_index: 0,
        checked_in_at: checkedInAt,
        geo_verified: true,
        user_lat: 40.7128,
        user_lon: -74.006,
        distance_meters: 0,
        location_accuracy_meters: 10,
        device_timestamp: null,
      }

      const repairedVisit = {
        id: 'visit-trusted-repair',
        venue_id: venueId,
        rating: 5,
        visited_at: checkedInAt,
        geo_verified: true,
        check_in_source: 'active_flow',
      }

      const progressQuery = query({
        data: progress,
        error: null,
      })

      const authenticatedProgressUpsert = vi.fn(() => {
        throw new Error(
          'Existing progress must not be upserted'
        )
      })

      progressQuery.upsert = authenticatedProgressUpsert

      const existingVisitQuery = query({
        data: null,
        error: null,
      })

      const authenticatedVisitInsert = vi.fn(() => {
        throw new Error(
          'Repair INSERT must use trusted client'
        )
      })

      existingVisitQuery.insert = authenticatedVisitInsert

      let sessionAccesses = 0

      mocks.from.mockImplementation((table: string) => {
        if (table === 'active_flow_sessions') {
          sessionAccesses += 1

          if (sessionAccesses === 1) {
            return query({
              data: {
                id: sessionId,
                user_id: userId,
                venue_ids: [venueId],
                status: 'active',
                source: 'active_flow',
                source_id: null,
                title: 'Trusted Repair Flow',
                city: 'New York',
                metadata: {},
                completed_stops: 1,
              },
              error: null,
            })
          }

          return query({
            error: null,
          })
        }

        if (table === 'venues') {
          return query({
            data: {
              id: venueId,
              lat: 40.7128,
              lon: -74.006,
              city: 'New York',
            },
            error: null,
          })
        }

        if (table === 'active_flow_progress') {
          return progressQuery
        }

        if (table === 'venue_visits') {
          return existingVisitQuery
        }

        throw new Error(
          `Unexpected authenticated table: ${table}`
        )
      })

      const trustedRepairQuery = query({
        data: repairedVisit,
        error: null,
      })

      trustedRepairQuery.insert = vi.fn(
        (payload: Record<string, unknown>) => {
          expect(payload).toMatchObject({
            user_id: userId,
            venue_id: venueId,
            visited_at: checkedInAt,
            geo_verified: true,
            check_in_source: 'active_flow',
          })

          return trustedRepairQuery
        }
      )

      const trustedFrom = vi.fn((table: string) => {
        expect(table).toBe('venue_visits')

        return trustedRepairQuery
      })

      mocks.selectVisitWriter.mockReturnValue({
        from: trustedFrom,
      })

      mocks.loadRuntimeRoute
        .mockResolvedValueOnce([
          {
            id: 'stop-trusted-repair',
            sessionId,
            venueId,
            position: 0,
            kind: 'base',
            completed: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'stop-trusted-repair',
            sessionId,
            venueId,
            position: 0,
            kind: 'base',
            completed: true,
          },
        ])

      const response = await trustedPOST(
        request({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: 0,
          user_lat: 40.7128,
          user_lon: -74.006,
          rating: 5,
        })
      )

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.progress.id).toBe(progress.id)
      expect(body.venueVisit.id).toBe(repairedVisit.id)
      expect(body.xpEarned).toBe(0)
      expect(body.geoVerified).toBe(true)
      expect(body.completedStops).toBe(1)
      expect(body.flowCompleted).toBe(true)

      expect(
        mocks.selectVisitWriter
      ).toHaveBeenCalledOnce()

      expect(
        mocks.selectVisitWriter
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          supabaseUrl: 'https://example.supabase.co',
          serviceRoleKey: 'dummy-test-key',
        })
      )

      expect(
        trustedRepairQuery.insert
      ).toHaveBeenCalledOnce()

      expect(
        trustedFrom
      ).toHaveBeenCalledWith('venue_visits')

      expect(
        authenticatedProgressUpsert
      ).not.toHaveBeenCalled()

      expect(
        authenticatedVisitInsert
      ).not.toHaveBeenCalled()

      expect(mocks.selectWriter).not.toHaveBeenCalled()
    } finally {
      if (previousVisitFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
          previousVisitFlag
      }

      if (previousProgressFlag === undefined) {
        delete process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED
      } else {
        process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
          previousProgressFlag
      }

      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL =
          previousUrl
      }

      if (previousKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY =
          previousKey
      }

      vi.resetModules()
    }
  })
})


/**
 * Forward-only Snapshot Replay attestation integration.
 *
 * All Supabase interactions are mocked.
 * These tests do not create real GPS check-ins.
 */
describe('Active Flow trusted Replay attestation integration', () => {
  const originalEnv = {
    progress:
      process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED,
    visit:
      process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED,
    replay:
      process.env.ROAM_TRUSTED_REPLAY_ATTESTATIONS_ENABLED,
    url:
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  function setEnv(
    key: string,
    value: string | undefined
  ) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  async function runScenario(options: {
    source?: 'flow_snapshot' | 'active_flow'
    existingProgress?: boolean
    attestationFails?: boolean
  } = {}) {
    const sessionId = 'replay-session-1'
    const venueId =
      '00000000-0000-4000-8000-000000000001'
    const snapshotId =
      '00000000-0000-4000-8000-000000000002'
    const userId = 'replay-user-1'
    const stopId = 'replay-stop-1'
    const checkedInAt =
      '2026-10-20T16:00:00.000Z'

    const progress = {
      id: 'replay-progress-1',
      session_id: sessionId,
      user_id: userId,
      venue_id: venueId,
      flow_stop_id: stopId,
      stop_index: 0,
      checked_in_at: checkedInAt,
      geo_verified: true,
      check_in_source: 'geo',
      distance_meters: 0,
      user_lat: 40.7128,
      user_lon: -74.006,
      location_accuracy_meters: 10,
      device_timestamp: null,
    }

    const venueVisit = {
      id: 'replay-visit-1',
      venue_id: venueId,
      rating: 5,
      visited_at: checkedInAt,
      geo_verified: true,
      check_in_source: 'active_flow',
    }

    const operations: string[] = []

    function query(result: unknown) {
      const builder: Record<string, any> = {}

      for (const method of [
        'select',
        'eq',
        'order',
        'limit',
        'update',
      ]) {
        builder[method] = vi.fn(() => builder)
      }

      builder.maybeSingle = vi.fn(
        async () => result
      )

      builder.single = vi.fn(
        async () => result
      )

      return builder
    }

    vi.clearAllMocks()

    mocks.rpc.mockResolvedValue({
        data: null,
        error: null,
     })

    process.env.ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED =
      'true'

    process.env.ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED =
      'true'

    process.env.ROAM_TRUSTED_REPLAY_ATTESTATIONS_ENABLED =
      'true'

    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://example.supabase.co'

    process.env.SUPABASE_SERVICE_ROLE_KEY =
      'dummy-test-key'

    vi.resetModules()

    const { POST: replayPOST } =
      await import('./route')

    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })

    const session = {
      id: sessionId,
      user_id: userId,
      venue_ids: [venueId],
      status: 'active',
      source: options.source ?? 'flow_snapshot',
      source_id:
        options.source === 'active_flow'
          ? null
          : snapshotId,
      title: 'Test Replay',
      city: 'New York',
      metadata: {},
      completed_stops:
        options.existingProgress ? 1 : 0,
    }

    let sessionReads = 0
    let visitReads = 0

    const progressQuery = query({
      data: options.existingProgress
        ? progress
        : null,
      error: null,
    })

    const existingVisitQuery = query({
      data: options.existingProgress
        ? venueVisit
        : null,
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'active_flow_sessions') {
        sessionReads += 1

        return query(
          sessionReads === 1
            ? {
                data: session,
                error: null,
              }
            : {
                error: null,
              }
        )
      }

      if (table === 'venues') {
        return query({
          data: {
            id: venueId,
            lat: 40.7128,
            lon: -74.006,
            city: 'New York',
          },
          error: null,
        })
      }

      if (table === 'active_flow_progress') {
        return progressQuery
      }

      if (table === 'venue_visits') {
        visitReads += 1

        if (options.existingProgress) {
          return existingVisitQuery
        }

        return query({
          data: null,
          error: null,
        })
      }

      throw new Error(
        `Unexpected authenticated table: ${table}`
      )
    })

    const trustedProgressQuery = query({
      data: progress,
      error: null,
    })

    trustedProgressQuery.upsert = vi.fn(() => {
      operations.push('progress')
      return trustedProgressQuery
    })

    const trustedProgressFrom = vi.fn(
      (table: string) => {
        expect(table).toBe(
          'active_flow_progress'
        )

        return trustedProgressQuery
      }
    )

    mocks.selectWriter.mockReturnValue({
      from: trustedProgressFrom,
    })

    const trustedVisitQuery = query({
      data: venueVisit,
      error: null,
    })

    trustedVisitQuery.insert = vi.fn(() => {
      operations.push('visit')
      return trustedVisitQuery
    })

    const trustedVisitFrom = vi.fn(
      (table: string) => {
        expect(table).toBe('venue_visits')
        return trustedVisitQuery
      }
    )

    mocks.selectVisitWriter.mockReturnValue({
      from: trustedVisitFrom,
    })

    replayAttestationMock.persist.mockImplementation(
      async () => {
        operations.push('attestation')

        if (options.attestationFails) {
          throw new Error(
            'Simulated Replay attestation failure'
          )
        }
      }
    )

    mocks.loadRuntimeRoute
      .mockResolvedValueOnce([
        {
          id: stopId,
          sessionId,
          venueId,
          position: 0,
          kind: 'base',
          completed:
            options.existingProgress === true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: stopId,
          sessionId,
          venueId,
          position: 0,
          kind: 'base',
          completed: true,
        },
      ])

    const response = await replayPOST(
      request({
        session_id: sessionId,
        venue_id: venueId,
        stop_index: 0,
        user_lat: 40.7128,
        user_lon: -74.006,
        rating: 5,
      })
    )

    return {
      response,
      progress,
      venueVisit,
      sessionId,
      snapshotId,
      userId,
      stopId,
      venueId,
      operations,
      trustedProgressQuery,
      trustedVisitQuery,
      visitReads,
    }
  }

  afterEach(() => {
    setEnv(
      'ROAM_TRUSTED_FLOW_PROGRESS_WRITES_ENABLED',
      originalEnv.progress
    )

    setEnv(
      'ROAM_TRUSTED_FLOW_VENUE_VISIT_WRITES_ENABLED',
      originalEnv.visit
    )

    setEnv(
      'ROAM_TRUSTED_REPLAY_ATTESTATIONS_ENABLED',
      originalEnv.replay
    )

    setEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      originalEnv.url
    )

    setEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      originalEnv.key
    )

    vi.resetModules()
  })

  it('attests only after fresh trusted progress and visit persistence', async () => {
    const result = await runScenario()

    expect(result.response.status).toBe(200)

    expect(result.operations).toEqual([
      'progress',
      'visit',
      'attestation',
    ])

    expect(
      replayAttestationMock.persist
    ).toHaveBeenCalledOnce()

    
    expect(
      replayAttestationMock.persist
    ).toHaveBeenCalledWith({
      sessionId: result.sessionId,
      replayUserId: result.userId,
      snapshotId: result.snapshotId,
      flowStopId: result.stopId,
      progressId: result.progress.id,
      venueVisitId: result.venueVisit.id,
      stopIndex: 0,
      venueId: result.venueId,
      verifiedAt: result.progress.checked_in_at,
    })

    // Verify the existing Replay attribution RPC remains wired.
    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_creator_replay_stop',
      {
        p_session_id: result.sessionId,
        p_stop_index: 0,
      }
    )

    const body = await result.response.json()


    expect(body.progress.id).toBe(
      result.progress.id
    )

    expect(body.venueVisit.id).toBe(
      result.venueVisit.id
    )

    expect(body.geoVerified).toBe(true)
  })

  it('never attests existing verified progress on retry', async () => {
    const result = await runScenario({
      existingProgress: true,
    })

    expect(result.response.status).toBe(200)

    expect(
      replayAttestationMock.persist
    ).not.toHaveBeenCalled()

    expect(
      result.trustedProgressQuery.upsert
    ).not.toHaveBeenCalled()

    expect(
      result.trustedVisitQuery.insert
    ).not.toHaveBeenCalled()
  })

  it('does not create Replay attestations for ordinary Flows', async () => {
    const result = await runScenario({
      source: 'active_flow',
    })

    expect(result.response.status).toBe(200)

    expect(result.operations).toEqual([
      'progress',
      'visit',
    ])

    expect(
      replayAttestationMock.persist
    ).not.toHaveBeenCalled()
  })

  it('preserves a successful physical check-in when Replay attestation fails', async () => {
    const result = await runScenario({
      attestationFails: true,
    })

    expect(result.response.status).toBe(200)

    expect(result.operations).toEqual([
      'progress',
      'visit',
      'attestation',
    ])

    expect(
      replayAttestationMock.persist
    ).toHaveBeenCalledOnce()

    const body = await result.response.json()

    expect(body.progress.id).toBe(
      result.progress.id
    )

    expect(body.venueVisit.id).toBe(
      result.venueVisit.id
    )

    expect(body.geoVerified).toBe(true)
  })
})
