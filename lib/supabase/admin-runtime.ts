import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

let supabaseAdminClient:
  SupabaseClient | null =
  null

function getRequiredSupabaseUrl():
  string {
  const value =
    process.env
      .SUPABASE_URL ??
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  if (
    !value ||
    value.trim().length ===
      0
  ) {
    throw new Error(
      '[supabaseAdmin] Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL'
    )
  }

  return value.trim()
}

function getRequiredServiceRoleKey():
  string {
  const value =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY

  if (
    !value ||
    value.trim().length ===
      0
  ) {
    throw new Error(
      '[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return value.trim()
}

/**
 * Returns the trusted Supabase service-role client.
 *
 * The client is initialized lazily so standalone Node scripts
 * can load Next.js environment variables before this function
 * reads process.env.
 *
 * WARNING:
 *
 * - Uses the service-role key.
 * - Bypasses Row Level Security.
 * - Must never be imported by client components.
 * - Must never be exposed through API responses.
 */
export function getSupabaseAdmin():
  SupabaseClient {
  if (
    supabaseAdminClient
  ) {
    return supabaseAdminClient
  }

  const supabaseUrl =
    getRequiredSupabaseUrl()

  const serviceRoleKey =
    getRequiredServiceRoleKey()

  supabaseAdminClient =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,

          detectSessionInUrl:
            false,
        },

        global: {
          headers: {
            'X-Client-Info':
              'roamcurated-server-admin',
          },
        },
      }
    )

  return supabaseAdminClient
}

/**
 * Backward-compatible lazy proxy for code that imports the
 * singleton directly.
 *
 * Prefer getSupabaseAdmin() in new server-side code.
 */
export const supabaseAdmin =
  new Proxy(
    {} as SupabaseClient,
    {
      get(
        _target,
        property,
        receiver
      ) {
        const client =
          getSupabaseAdmin()

        const value =
          Reflect.get(
            client,
            property,
            receiver
          )

        return typeof value ===
          'function'
          ? value.bind(
              client
            )
          : value
      },
    }
  )