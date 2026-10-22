
import {
  beforeEach,
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

import { selectActiveFlowVenueVisitWriter } from './trustedVenueVisitWriter.server'

describe('Trusted Active Flow venue-visit writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the authenticated client when disabled', () => {
    const authenticatedClient = {
      from: vi.fn(),
    }

    const writer = selectActiveFlowVenueVisitWriter({
      enabled: false,
      authenticatedClient: authenticatedClient as any,
    })

    expect(writer).toBe(authenticatedClient)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('fails closed when enabled without service-role configuration', () => {
    const authenticatedClient = {
      from: vi.fn(),
    }

    expect(() =>
      selectActiveFlowVenueVisitWriter({
        enabled: true,
        authenticatedClient: authenticatedClient as any,
        supabaseUrl: 'https://example.supabase.co',
      })
    ).toThrow(
      'Trusted Active Flow venue-visit persistence configuration missing.'
    )

    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('constructs an isolated service-role client when enabled', () => {
    const authenticatedClient = {
      from: vi.fn(),
    }

    const trustedClient = {
      from: vi.fn(),
    }

    mocks.createClient.mockReturnValue(trustedClient)

    const writer = selectActiveFlowVenueVisitWriter({
      enabled: true,
      authenticatedClient: authenticatedClient as any,
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'dummy-test-key',
    })

    expect(writer).toBe(trustedClient)

    expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith(
      'https://example.supabase.co',
      'dummy-test-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    expect(authenticatedClient.from).not.toHaveBeenCalled()
  })
})
