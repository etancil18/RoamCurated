
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

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

const SNAPSHOT = '77777777-7777-4777-8777-777777777777'
const PUBLISHER = '22222222-2222-4222-8222-222222222222'
const ALICE = '11111111-1111-4111-8111-111111111111'
const STRANGER = '33333333-3333-4333-8333-333333333333'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'

const STOP_A = '88888888-8888-4888-8888-888888888881'
const STOP_B = '88888888-8888-4888-8888-888888888882'
const STOP_C = '88888888-8888-4888-8888-888888888883'

const CONTRIBUTION_A =
  '99999999-9999-4999-8999-999999999991'
const CONTRIBUTION_B =
  '99999999-9999-4999-8999-999999999992'
const CONTRIBUTION_C =
  '99999999-9999-4999-8999-999999999993'

type Scenario = {
  viewerId?: string | null
  visibility?: 'public' | 'private'
  snapshotExists?: boolean
  certified?: boolean
  invalidRoute?: boolean
  brokenMapping?: boolean
  stopCount?: number
  databaseErrorTable?: string
}

function chain(result: {
  data: unknown
  error: { message: string } | null
}) {
  const q: any = {}

  for (const method of ['select', 'eq', 'in', 'order']) {
    q[method] = vi.fn(() => q)
  }

  q.maybeSingle = vi.fn(async () => result)

  q.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject)

  return q
}

function setup(scenario: Scenario = {}) {
  const viewerId =
    scenario.viewerId === undefined
      ? PUBLISHER
      : scenario.viewerId

  const stops = [
    { id: STOP_A, venue_id: A, stop_index: 0 },
    {
      id: STOP_B,
      venue_id: B,
      stop_index: scenario.invalidRoute ? 7 : 1,
    },
    { id: STOP_C, venue_id: C, stop_index: 2 },
  ].slice(0, scenario.stopCount ?? 3)

  const snapshot = {
    id: SNAPSHOT,
    user_id: PUBLISHER,
    visibility: scenario.visibility ?? 'public',
    total_stops: stops.length,
  }

  const rows: Record<string, unknown> = {
    flow_snapshots:
      scenario.snapshotExists === false
        ? null
        : snapshot,

    flow_snapshot_route_certifications:
      scenario.certified === false
        ? null
        : { snapshot_id: SNAPSHOT },

    flow_snapshot_stops: stops,

    flow_snapshot_stop_contributions: [
      {
        snapshot_stop_id: STOP_A,
        contribution_id: CONTRIBUTION_A,
        venue_id: A,
      },
      {
        snapshot_stop_id: STOP_B,
        contribution_id: CONTRIBUTION_B,
        venue_id: B,
      },
      {
        snapshot_stop_id: STOP_C,
        contribution_id: CONTRIBUTION_C,
        venue_id: C,
      },
    ].slice(0, stops.length),

    flow_contributions: [
      {
        id: CONTRIBUTION_A,
        venue_id: A,
        origin: 'collection',
        creator_user_id: ALICE,
      },
      {
        id: CONTRIBUTION_B,
        venue_id: scenario.brokenMapping ? C : B,
        origin: 'collection',
        creator_user_id: ALICE,
      },
      {
        id: CONTRIBUTION_C,
        venue_id: C,
        origin: 'platform',
        creator_user_id: null,
      },
    ].slice(0, stops.length),
  }

  const service = {
    from: vi.fn((table: string) => {
      if (!(table in rows)) {
        throw new Error(`Unexpected table: ${table}`)
      }

      return chain({
        data: rows[table],
        error:
          scenario.databaseErrorTable === table
            ? { message: 'Simulated database error' }
            : null,
      })
    }),
  }

  const viewer = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: viewerId ? { id: viewerId } : null,
        },
        error: null,
      })),
    },
  }

  mocks.createServerClient.mockResolvedValue(viewer)
  mocks.createClient.mockReturnValue(service)

  return { service, viewer }
}

async function invoke(snapshotId = SNAPSHOT) {
  const { GET } = await import('./route')

  const response = await GET(
    new Request(
      `http://localhost/api/flow-snapshots/${snapshotId}/attribution`
    ) as any,
    {
      params: Promise.resolve({ snapshotId }),
    }
  )

  return {
    status: response.status,
    body: await response.json(),
    cacheControl: response.headers.get('Cache-Control'),
  }
}

describe('Snapshot attribution read security boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    vi.stubEnv(
      'ROAM_SNAPSHOT_ATTRIBUTION_READ_ENABLED',
      'true'
    )
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      'http://localhost:54321'
    )
    vi.stubEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      'test-only-service-role-key'
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('remains inaccessible when the read flag is OFF', async () => {
    vi.stubEnv(
      'ROAM_SNAPSHOT_ATTRIBUTION_READ_ENABLED',
      'false'
    )
    const { service } = setup()

    const result = await invoke()

    expect(result.status).toBe(404)
    expect(service.from).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('allows anonymous access to a public Snapshot', async () => {
    setup({ viewerId: null })

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.publisherUserId).toBe(PUBLISHER)
    expect(result.body.certifiedRoute).toBe(true)
    expect(result.cacheControl).toContain('no-store')
  })

  it('allows the owner to read a private Snapshot', async () => {
    setup({
      viewerId: PUBLISHER,
      visibility: 'private',
    })

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.publisherUserId).toBe(PUBLISHER)
  })

  it('conceals a private Snapshot from another user', async () => {
    const { service } = setup({
      viewerId: STRANGER,
      visibility: 'private',
    })

    const result = await invoke()

    expect(result.status).toBe(404)
    expect(
      service.from.mock.calls.map(([name]) => name)
    ).toEqual(['flow_snapshots'])
  })

  it('conceals a private Snapshot from anonymous viewers', async () => {
    const { service } = setup({
      viewerId: null,
      visibility: 'private',
    })

    const result = await invoke()

    expect(result.status).toBe(404)
    expect(service.from).toHaveBeenCalledTimes(1)
  })

  it('never treats Snapshot publisher as original creator', async () => {
    setup()

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.publisherUserId).toBe(PUBLISHER)

    expect(result.body.stops[0]).toMatchObject({
      venueId: A,
      stopIndex: 0,
      attributionOrigin: 'collection',
      originalCreatorUserId: ALICE,
      attributionCertified: true,
    })

    expect(result.body.stops[1]).toMatchObject({
      originalCreatorUserId: ALICE,
      attributionOrigin: 'collection',
    })

    expect(result.body.stops[0].originalCreatorUserId)
      .not.toBe(PUBLISHER)
  })

  it('never credits a platform-fill stop to a human', async () => {
    setup()

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.stops[2]).toMatchObject({
      venueId: C,
      attributionOrigin: 'platform',
      originalCreatorUserId: null,
      attributionCertified: true,
    })
  })

  it('leaves uncertified legacy stops unattributed', async () => {
    const { service } = setup({ certified: false })

    const result = await invoke()

    expect(result.status).toBe(200)
    expect(result.body.certifiedRoute).toBe(false)
    expect(result.body.stops).toHaveLength(3)

    for (const stop of result.body.stops) {
      expect(stop.attributionOrigin).toBe('unknown')
      expect(stop.originalCreatorUserId).toBeNull()
      expect(stop.attributionCertified).toBe(false)
    }

    expect(
      service.from.mock.calls.map(([name]) => name)
    ).not.toContain('flow_contributions')
  })

  it('rejects malformed canonical Snapshot stop order', async () => {
    const { service } = setup({ invalidRoute: true })

    const result = await invoke()

    expect(result.status).toBe(409)
    expect(
      service.from.mock.calls.map(([name]) => name)
    ).not.toContain('flow_contributions')
  })

  it('rejects inconsistent contribution venue mappings', async () => {
    setup({ brokenMapping: true })

    const result = await invoke()

    expect(result.status).toBe(409)
    expect(result.body.stops).toBeUndefined()
  })

  it('fails closed when certification lookup fails', async () => {
    setup({
      databaseErrorTable:
        'flow_snapshot_route_certifications',
    })

    const result = await invoke()

    expect(result.status).toBe(500)
    expect(result.body.stops).toBeUndefined()
  })

  it('does not expose a missing Snapshot', async () => {
    setup({ snapshotExists: false })

    const result = await invoke()

    expect(result.status).toBe(404)
  })

  it('rejects invalid IDs before database access', async () => {
    const { service } = setup()

    const result = await invoke('not-a-uuid')

    expect(result.status).toBe(400)
    expect(service.from).not.toHaveBeenCalled()
  })
})
