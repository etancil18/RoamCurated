
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('server-only', () => ({}))

import {
  prepareTrustedReplayAttestation,
} from './trustedReplayAttestation.server'

const validInput = {
  sessionId: 'session-1',
  replayUserId: 'user-1',
  snapshotId: 'snapshot-1',
  flowStopId: 'stop-1',
  progressId: 'progress-1',
  stopIndex: 0,
  venueId: 'venue-1',
  verifiedAt: '2026-10-20T16:00:00.000Z',
}

describe('Trusted Replay attestation payload', () => {
  it('maps validated identities to database columns', () => {
    expect(
      prepareTrustedReplayAttestation(validInput)
    ).toEqual({
      session_id: 'session-1',
      replay_user_id: 'user-1',
      snapshot_id: 'snapshot-1',
      flow_stop_id: 'stop-1',
      progress_id: 'progress-1',
      stop_index: 0,
      venue_id: 'venue-1',
      verified_at: '2026-10-20T16:00:00.000Z',
    })
  })

  it('rejects missing Replay identity', () => {
    expect(() =>
      prepareTrustedReplayAttestation({
        ...validInput,
        progressId: '',
      })
    ).toThrow(
      'Trusted Replay attestation identity is incomplete.'
    )
  })

  it('rejects invalid canonical stop indices', () => {
    expect(() =>
      prepareTrustedReplayAttestation({
        ...validInput,
        stopIndex: -1,
      })
    ).toThrow(
      'Trusted Replay attestation stop index is invalid.'
    )
  })

  it('rejects invalid verification timestamps', () => {
    expect(() =>
      prepareTrustedReplayAttestation({
        ...validInput,
        verifiedAt: 'not-a-timestamp',
      })
    ).toThrow(
      'Trusted Replay attestation timestamp is invalid.'
    )
  })
})
