import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    marker: 'trusted-service-role-client',
  })),
}))

import { createClient } from '@supabase/supabase-js'
import { selectActiveFlowProgressWriter } from './trustedProgressWriter.server'

const mockedCreateClient = vi.mocked(createClient)

describe('selectActiveFlowProgressWriter', () => {
  const authenticatedClient = {
    marker: 'authenticated-client',
  } as unknown as ReturnType<typeof createClient>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves the authenticated writer when disabled', () => {
    const result = selectActiveFlowProgressWriter({
      enabled: false,
      authenticatedClient,
    })

    expect(result).toBe(authenticatedClient)
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('constructs an independent trusted writer when enabled', () => {
    const result = selectActiveFlowProgressWriter({
      enabled: true,
      authenticatedClient,
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'test-only-service-role-key',
    })

    expect(result).not.toBe(authenticatedClient)

    expect(mockedCreateClient).toHaveBeenCalledExactlyOnceWith(
      'https://example.supabase.co',
      'test-only-service-role-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  })

  it('rejects missing trusted credentials without fallback', () => {
    expect(() =>
      selectActiveFlowProgressWriter({
        enabled: true,
        authenticatedClient,
        supabaseUrl: 'https://example.supabase.co',
      })
    ).toThrow(
      'Trusted Active Flow progress persistence configuration missing.'
    )

    expect(mockedCreateClient).not.toHaveBeenCalled()
  })
})