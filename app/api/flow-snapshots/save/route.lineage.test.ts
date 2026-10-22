
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  supabaseServerApi: vi.fn(),
  createClient: vi.fn(),
  refreshReputation: vi.fn(),
}))

vi.mock('@/lib/supabase/server-api', () => ({
  supabaseServerApi: mocks.supabaseServerApi,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/reputation/safelyRefreshCreatorReputation', () => ({
  safelyRefreshCreatorReputation: mocks.refreshReputation,
}))

const USER = '22222222-2222-4222-8222-222222222222'
const FLOW = '66666666-6666-4666-8666-666666666666'
const SNAPSHOT = '77777777-7777-4777-8777-777777777777'
const VENUES = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
]

function query(result: any) {
  const q: any = {}
  for (const method of [
    'select', 'eq', 'upsert', 'insert', 'delete',
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

function setupDatabase(existing = false) {
  const snapshot = {
    id: SNAPSHOT,
    user_id: USER,
    source_type: 'active_flow',
    source_id: FLOW,
    title: 'Test Flow',
    city: 'atl',
    status: 'completed',
    checked_in_count: 3,
    total_stops: 3,
    visibility: existing ? 'private' : 'public',
  }

  const responses: Record<string, any[]> = {
    flow_snapshots: [
      {
        data: existing
          ? {
              id: SNAPSHOT,
              visibility: 'private',
              cover_image_url: null,
            }
          : null,
        error: null,
      },
      { data: snapshot, error: null },
    ],
    active_flow_sessions: [{
      data: {
        id: FLOW,
        title: 'Test Flow',
        city: 'atl',
        status: 'completed',
        venue_ids: VENUES,
      },
      error: null,
    }],
    active_flow_progress: [{
      data: [
        { stop_index: 0 },
        { stop_index: 1 },
        { stop_index: 2 },
      ],
      error: null,
    }],
    flow_snapshot_stops: [{
      data: null,
      error: null,
    }],
  }

  const upload = vi.fn(async () => ({ error: null }))
  const remove = vi.fn(async () => ({ error: null }))

  const storage = {
    from: vi.fn(() => ({
      upload,
      remove,
      getPublicUrl: vi.fn(() => ({
        data: {
          publicUrl:
            'https://example.test/storage/v1/object/public/' +
            `flow-snapshots/${USER}/active_flow/${FLOW}/snapshot.png`,
        },
      })),
    })),
  }

  const db = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: USER } },
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
    storage,
  }

  mocks.supabaseServerApi.mockResolvedValue(db)
  mocks.refreshReputation.mockResolvedValue(undefined)

  const rpc = vi.fn<() => Promise<{
    data: typeof snapshot | null
    error: { message: string } | null
  }>>(async () => ({
    data: snapshot,
    error: null,
  }))
  mocks.createClient.mockReturnValue({ rpc })

  return { db, rpc, upload, remove }
}

async function invoke(visibility = 'public') {
  const { POST } = await import('./route')
  const form = new FormData()

  form.set('source_type', 'active_flow')
  form.set('source_id', FLOW)
  form.set('status', 'completed')
  form.set('checked_in_count', '3')
  form.set('total_stops', '3')
  form.set('visibility', visibility)
  form.set(
    'file',
    new Blob([new Uint8Array([1, 2, 3])], {
      type: 'image/png',
    }),
    'snapshot.png'
  )

  const result = await POST(
    new Request('http://localhost/api/flow-snapshots/save', {
      method: 'POST',
      body: form,
    })
  )

  return {
    status: result.status,
    body: await result.json(),
  }
}

describe('Snapshot permanent lineage API boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-service-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses legacy Snapshot and stop inserts when flag is OFF', async () => {
    vi.stubEnv('ROAM_SNAPSHOT_LINEAGE_ENABLED', 'false')
    const { db, rpc } = setupDatabase()

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.saved).toBe(true)
    expect(rpc).not.toHaveBeenCalled()

    const tableNames = db.from.mock.calls.map(
      ([name]: [string]) => name
    )
    expect(tableNames).toContain('flow_snapshot_stops')
  })

  it('calls the atomic RPC with verified identity and canonical route', async () => {
    vi.stubEnv('ROAM_SNAPSHOT_LINEAGE_ENABLED', 'true')
    const { db, rpc } = setupDatabase()

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.snapshot.id).toBe(SNAPSHOT)
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      'save_snapshot_with_certified_lineage',
      expect.objectContaining({
        p_explorer_user_id: USER,
        p_source_flow_id: FLOW,
        p_expected_venue_ids: VENUES,
        p_snapshot_payload: expect.objectContaining({
          user_id: USER,
          source_type: 'active_flow',
          source_id: FLOW,
          status: 'completed',
          checked_in_count: 3,
          total_stops: 3,
          visibility: 'public',
        }),
      })
    )

    const tableNames = db.from.mock.calls.map(
      ([name]: [string]) => name
    )
    expect(tableNames).not.toContain('flow_snapshot_stops')
  })

  it('preserves existing PRIVATE visibility on certified resave', async () => {
    vi.stubEnv('ROAM_SNAPSHOT_LINEAGE_ENABLED', 'true')
    const { rpc } = setupDatabase(true)

    const result = await invoke('public')

    expect(result.status).toBe(200)
    expect(result.body.visibilityPreserved).toBe(true)
    expect(rpc).toHaveBeenCalledWith(
      'save_snapshot_with_certified_lineage',
      expect.objectContaining({
        p_snapshot_payload: expect.objectContaining({
          visibility: 'private',
        }),
      })
    )
  })

  it('does not fall back to an ordinary upsert after RPC failure', async () => {
    vi.stubEnv('ROAM_SNAPSHOT_LINEAGE_ENABLED', 'true')
    const { db, rpc, remove } = setupDatabase()

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Simulated lineage transaction failure' },
    })

    const result = await invoke()

    expect(result.status).toBe(500)
    expect(result.body.saved).toBeUndefined()
    expect(rpc).toHaveBeenCalledTimes(1)

    const snapshotCalls = db.from.mock.calls.filter(
      ([name]: [string]) => name === 'flow_snapshots'
    )
    expect(snapshotCalls).toHaveLength(1)
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
