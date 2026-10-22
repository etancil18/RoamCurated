
import 'server-only'

import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

type TrustedVenueVisitWriterOptions = {
  enabled: boolean
  authenticatedClient: SupabaseClient
  supabaseUrl?: string
  serviceRoleKey?: string
}

export function selectActiveFlowVenueVisitWriter({
  enabled,
  authenticatedClient,
  supabaseUrl,
  serviceRoleKey,
}: TrustedVenueVisitWriterOptions): SupabaseClient {
  if (!enabled) {
    return authenticatedClient
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Trusted Active Flow venue-visit persistence configuration missing.'
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
