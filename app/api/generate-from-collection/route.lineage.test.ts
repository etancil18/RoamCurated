
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createClient: vi.fn(),
  generateRoute: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/routes/generateRouteFromCollection', () => ({
  generateRouteFromCollection: mocks.generateRoute,
}))

const USER = '22222222-2222-4222-8222-222222222222'
const CREATOR = '11111111-1111-4111-8111-111111111111'
const COLLECTION = '55555555-5555-4555-8555-555555555555'
const SESSION = '66666666-6666-4666-8666-666666666666'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'

function query(result: any) {
  const q: any = {}
  for (const method of [
    'select', 'eq', 'in', 'order', 'insert',
  ]) {
    q[method] = vi.fn(() => q)
  }
  q.maybeSingle = vi.fn(async () => result)
  q.single = vi.fn(async () => result)
  q.then = (
    resolve: (value: any) => unknown,
    reject?: (error: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject)
  return q
}

function setupDatabase(authenticated = true) {
  const responses: Record<string, any[]> = {
    active_flow_sessions: [
      { data: null, error: null },
      {
        data: { id: SESSION, user_id: USER },
        error: null,
      },
    ],
    creator_collections: [{
      data: {
        id: COLLECTION,
        user_id: CREATOR,
        title: 'Alice Collection',
        city: 'atl',
        visibility: 'public',
      },
      error: null,
    }],
    creator_collection_venues: [{
      data: [
        { venue_id: A, sort_order: 0 },
        { venue_id: B, sort_order: 1 },
      ],
      error: null,
    }],
    venues: [
      {
        data: [A, B].map(venue),
        error: null,
      },
      {
        data: [A, B, C].map(venue),
        error: null,
      },
    ],
    profiles: [{
      data: {
        preferred_vibes: [],
        interest_categories: [],
        home_neighborhood: null,
      },
      error: null,
    }],
    saved_properties: [{ data: [], error: null }],
    venue_visits: [{ data: [], error: null }],
  }

  const db = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: authenticated ? { id: USER } : null,
        },
        error: null,
      })),
    },
    from: vi.fn((name: string) => {
      const response = responses[name]?.shift()
      if (!response) {
        throw new Error(`Unexpected query: ${name}`)
      }
      return query(response)
    }),
  }

  mocks.createServerClient.mockResolvedValue(db)

  mocks.generateRoute.mockReturnValue({
    status: 'success',
    context: {
      city: 'atl',
      plannedStartAt: '2026-10-22T19:00:00.000Z',
    },
    stops: [
      { venue: { id: A }, origin: 'collection', reasons: [] },
      { venue: { id: B }, origin: 'collection', reasons: [] },
      { venue: { id: C }, origin: 'roam_fill', reasons: [] },
    ],
    debug: { internalScore: 100 },
  })

  const rpc = vi.fn<() => Promise<{
    data: string | null
    error: { message: string } | null
  }>>(async () => ({
    data: SESSION,
    error: null,
  }))

  mocks.createClient.mockReturnValue({ rpc })

  return { db, rpc }
}

function venue(id: string) {
  return {
    id,
    name: `Venue ${id.slice(-1)}`,
    slug: null,
    city: 'atl',
    address: null,
    lat: 33.75,
    lon: -84.39,
    type: [],
    tags: [],
    vibe: [],
    price: null,
    hours: null,
    cover: null,
    profile_status: 'active',
  }
}

async function invoke() {
  const { POST } = await import('./route')
  const response = await POST(
    new Request('http://localhost/api/generate-from-collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectionId: COLLECTION,
        travelMode: 'walking',
      }),
    }) as any
  )
  return {
    status: response.status,
    body: await response.json(),
  }
}

describe('Collection permanent lineage API boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-service-key')
    vi.stubEnv('ROAM_CREATOR_COLLECTION_RECEIPTS_ENABLED', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the original legacy insert when the flag is OFF', async () => {
    vi.stubEnv('ROAM_CERTIFIED_COLLECTION_LINEAGE_ENABLED', 'false')
    const { db, rpc } = setupDatabase()

    const result = await invoke()

    expect(result.status).toBe(201)
    expect(result.body.session.id).toBe(SESSION)
    expect(rpc).not.toHaveBeenCalled()

    const flowCalls = db.from.mock.calls.filter(
      ([name]: [string]) => name === 'active_flow_sessions'
    )
    expect(flowCalls).toHaveLength(2)
  })

  it('certifies server-derived origin and verified explorer when ON', async () => {
    vi.stubEnv('ROAM_CERTIFIED_COLLECTION_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase()

    const result = await invoke()

    expect(result.status).toBe(201)
    expect(result.body.redirectTo).toBe(`/flow/${SESSION}`)
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      'create_certified_collection_flow',
      expect.objectContaining({
        p_explorer_user_id: USER,
        p_collection_id: COLLECTION,
        p_travel_mode: 'walking',
        p_venue_ids: [A, B, C],
        p_stop_origins: [
          'collection', 'collection', 'roam_fill',
        ],
      })
    )
    expect(result.body.route.debug).toBeUndefined()
  })

  it('fails closed when certification RPC fails', async () => {
    vi.stubEnv('ROAM_CERTIFIED_COLLECTION_LINEAGE_ENABLED', 'true')
    const { db, rpc } = setupDatabase()
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Simulated RPC rejection' },
    })

    const result = await invoke()

    expect(result.status).toBe(500)
    expect(result.body.session).toBeUndefined()
    expect(rpc).toHaveBeenCalledTimes(1)

    const sessionCalls = db.from.mock.calls.filter(
      ([name]: [string]) => name === 'active_flow_sessions'
    )
    expect(sessionCalls).toHaveLength(1)
  })

  it('rejects unauthenticated generation before calling the RPC', async () => {
    vi.stubEnv('ROAM_CERTIFIED_COLLECTION_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase(false)

    const result = await invoke()

    expect(result.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })
})
