
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

const USER = '33333333-3333-4333-8333-333333333333'
const PUBLISHER = '22222222-2222-4222-8222-222222222222'
const SNAPSHOT = '77777777-7777-4777-8777-777777777777'
const SESSION = '88888888-8888-4888-8888-888888888888'

const VENUES = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
]

function query(result: any) {
  const q: any = {}
  for (const method of [
    'select', 'eq', 'order', 'insert',
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

function setupDatabase({
  authenticated = true,
  visibility = 'public',
  invalidRoute = false,
}: {
  authenticated?: boolean
  visibility?: string
  invalidRoute?: boolean
} = {}) {
  const responses: Record<string, any[]> = {
    flow_snapshots: [{
      data: {
        id: SNAPSHOT,
        user_id: PUBLISHER,
        source_type: 'active_flow',
        source_id: '99999999-9999-4999-8999-999999999999',
        title: 'Bob Snapshot',
        city: 'atl',
        status: 'completed',
        visibility,
        replayable: true,
        total_stops: 3,
      },
      error: null,
    }],
    flow_snapshot_stops: [{
      data: VENUES.map((venue_id, index) => ({
        venue_id,
        stop_index:
          invalidRoute && index === 1 ? 9 : index,
      })),
      error: null,
    }],
    active_flow_sessions: [
      { data: null, error: null },
      {
        data: {
          id: SESSION,
          user_id: USER,
          source: 'flow_snapshot',
          source_id: SNAPSHOT,
        },
        error: null,
      },
    ],
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
      const result = responses[name]?.shift()
      if (!result) {
        throw new Error(`Unexpected query: ${name}`)
      }
      return query(result)
    }),
  }

  mocks.createServerClient.mockResolvedValue(db)

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

async function invoke() {
  const { POST } = await import('./route')
  const response = await POST(
    new Request(
      `http://localhost/api/flow-snapshots/${SNAPSHOT}/replay`,
      { method: 'POST' }
    ) as any,
    { params: Promise.resolve({ snapshotId: SNAPSHOT }) }
  )

  return {
    status: response.status,
    body: await response.json(),
  }
}

describe('Replay permanent lineage API boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-service-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('preserves the legacy session insert when flag is OFF', async () => {
    vi.stubEnv('ROAM_REPLAY_LINEAGE_ENABLED', 'false')
    const { db, rpc } = setupDatabase()

    const result = await invoke()

    expect(result.status).toBe(201)
    expect(result.body.session.id).toBe(SESSION)
    expect(rpc).not.toHaveBeenCalled()

    const tableNames = db.from.mock.calls.map(
      ([name]: [string]) => name
    )
    expect(tableNames).toContain('active_flow_sessions')
  })

  it('invokes certified Replay with immutable Snapshot venues', async () => {
    vi.stubEnv('ROAM_REPLAY_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase()

    const result = await invoke()

    expect(result.status).toBe(201)
    expect(result.body.redirectTo).toBe(`/flow/${SESSION}`)
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      'create_replay_with_certified_lineage',
      {
        p_explorer_user_id: USER,
        p_snapshot_id: SNAPSHOT,
        p_expected_venue_ids: VENUES,
      }
    )
  })

  it('rejects tampered Snapshot stop order before creating Replay', async () => {
    vi.stubEnv('ROAM_REPLAY_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase({ invalidRoute: true })

    const result = await invoke()

    expect(result.status).toBe(409)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed if certified Replay creation fails', async () => {
    vi.stubEnv('ROAM_REPLAY_LINEAGE_ENABLED', 'true')
    const { db, rpc } = setupDatabase()

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Simulated certified Replay failure' },
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

  it('rejects private Snapshots before invoking the RPC', async () => {
    vi.stubEnv('ROAM_REPLAY_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase({ visibility: 'private' })

    const result = await invoke()

    expect(result.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated Replay requests', async () => {
    vi.stubEnv('ROAM_REPLAY_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase({ authenticated: false })

    const result = await invoke()

    expect(result.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })
})
