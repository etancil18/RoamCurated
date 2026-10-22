
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

import {
  persistTrustedReplayAttestation,
} from './trustedReplayAttestation.server'

const input = {
  sessionId: 'session-1',
  replayUserId: 'user-1',
  snapshotId: 'snapshot-1',
  flowStopId: 'flow-stop-1',
  progressId: 'progress-1',
  venueVisitId: 'visit-1',
  stopIndex: 0,
  venueId: '00000000-0000-4000-8000-000000000001',
  verifiedAt: '2026-10-20T16:00:00.000Z',
}

const snapshotStopId = 'snapshot-stop-1'

function makeQuery(
  result: unknown
) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue(result)

  return query
}

function makeDatabase(options?: {
  visitFound?: boolean
  insertError?: {
    code: string
    message: string
  } | null
  existing?: Record<string, unknown> | null
}) {
  const queries = {
    active_flow_sessions: makeQuery({
      data: {
        id: input.sessionId,
        user_id: input.replayUserId,
        source: 'flow_snapshot',
        source_id: input.snapshotId,
      },
      error: null,
    }),

    flow_snapshot_stops: makeQuery({
      data: {
        id: snapshotStopId,
        snapshot_id: input.snapshotId,
        stop_index: input.stopIndex,
        venue_id: input.venueId,
      },
      error: null,
    }),

    active_flow_stops: makeQuery({
      data: {
        id: input.flowStopId,
        session_id: input.sessionId,
        venue_id: input.venueId,
        position: input.stopIndex,
      },
      error: null,
    }),

    active_flow_progress: makeQuery({
      data: {
        id: input.progressId,
        session_id: input.sessionId,
        user_id: input.replayUserId,
        flow_stop_id: input.flowStopId,
        venue_id: input.venueId,
        stop_index: input.stopIndex,
        geo_verified: true,
        checked_in_at: input.verifiedAt,
      },
      error: null,
    }),

    venue_visits: makeQuery({
      data: options?.visitFound === false
        ? null
        : {
            id: input.venueVisitId,
            user_id: input.replayUserId,
            venue_id: input.venueId,
            geo_verified: true,
            check_in_source: 'active_flow',
          },
      error: null,
    }),

    creator_replay_checkin_attestations:
      makeQuery({
        data: options?.existing ?? null,
        error: null,
      }),
  }

  const insert = vi.fn().mockResolvedValue({
    error: options?.insertError ?? null,
  })

  const attestationTable = {
    ...queries.creator_replay_checkin_attestations,
    insert,
  }

  const from = vi.fn((table: string) => {
    if (
      table ===
      'creator_replay_checkin_attestations'
    ) {
      return attestationTable
    }

    const query = queries[
      table as keyof typeof queries
    ]

    if (!query) {
      throw new Error(
        `Unexpected database table: ${table}`
      )
    }

    return query
  })

  mocks.createClient.mockReturnValue({
    from,
  })

  return {
    queries,
    insert,
    from,
  }
}

function existingAttestation() {
  return {
    id: 'attestation-1',
    session_id: input.sessionId,
    replay_user_id: input.replayUserId,
    snapshot_id: input.snapshotId,
    snapshot_stop_id: snapshotStopId,
    flow_stop_id: input.flowStopId,
    progress_id: input.progressId,
    venue_visit_id: input.venueVisitId,
    stop_index: input.stopIndex,
    venue_id: input.venueId,
    verified_at: input.verifiedAt,
  }
}

describe(
  'Trusted Replay attestation persistence',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      vi.stubEnv(
        'NEXT_PUBLIC_SUPABASE_URL',
        'https://example.supabase.co'
      )

      vi.stubEnv(
        'SUPABASE_SERVICE_ROLE_KEY',
        'test-service-role-key'
      )
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it(
      'persists the exact progress and venue visit identities',
      async () => {
        const db = makeDatabase()

        await persistTrustedReplayAttestation(
          input
        )

        expect(
          mocks.createClient
        ).toHaveBeenCalledOnce()

        expect(
          db.insert
        ).toHaveBeenCalledOnce()

        expect(
          db.insert
        ).toHaveBeenCalledWith({
          session_id: input.sessionId,
          replay_user_id: input.replayUserId,
          snapshot_id: input.snapshotId,
          snapshot_stop_id: snapshotStopId,
          flow_stop_id: input.flowStopId,
          progress_id: input.progressId,
          venue_visit_id: input.venueVisitId,
          stop_index: input.stopIndex,
          venue_id: input.venueId,
          verified_at: input.verifiedAt,
        })

        expect(
          db.queries.venue_visits.eq
        ).toHaveBeenCalledWith(
          'id',
          input.venueVisitId
        )

        expect(
          db.queries.venue_visits.eq
        ).toHaveBeenCalledWith(
          'check_in_source',
          'active_flow'
        )
      }
    )

    it(
      'rejects an unmatched venue visit before inserting',
      async () => {
        const db = makeDatabase({
          visitFound: false,
        })

        await expect(
          persistTrustedReplayAttestation(
            input
          )
        ).rejects.toThrow(
          'Trusted Replay attestation venue-visit verification failed.'
        )

        expect(
          db.insert
        ).not.toHaveBeenCalled()
      }
    )

    it(
      'accepts only an identical existing attestation on unique conflict',
      async () => {
        const db = makeDatabase({
          insertError: {
            code: '23505',
            message: 'duplicate key',
          },
          existing: existingAttestation(),
        })

        await expect(
          persistTrustedReplayAttestation(
            input
          )
        ).resolves.toBeUndefined()

        expect(
          db.insert
        ).toHaveBeenCalledOnce()
      }
    )

    it(
      'rejects a conflicting previously certified venue visit',
      async () => {
        const db = makeDatabase({
          insertError: {
            code: '23505',
            message: 'duplicate key',
          },
          existing: {
            ...existingAttestation(),
            venue_visit_id: 'different-visit',
          },
        })

        await expect(
          persistTrustedReplayAttestation(
            input
          )
        ).rejects.toThrow(
          'Trusted Replay attestation conflicts with existing evidence.'
        )

        expect(
          db.insert
        ).toHaveBeenCalledOnce()
      }
    )
  }
)
