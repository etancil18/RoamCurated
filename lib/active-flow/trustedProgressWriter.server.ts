import 'server-only'

import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

type TrustedProgressWriterOptions = {
  enabled: boolean
  authenticatedClient: SupabaseClient
  supabaseUrl?: string
  serviceRoleKey?: string
}

export function selectActiveFlowProgressWriter({
  enabled,
  authenticatedClient,
  supabaseUrl,
  serviceRoleKey,
}: TrustedProgressWriterOptions): SupabaseClient {
  if (!enabled) {
    return authenticatedClient
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Trusted Active Flow progress persistence configuration missing.'
    )
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}