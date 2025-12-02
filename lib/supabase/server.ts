// lib/supabase/server.ts
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * Server‑side Supabase client (SSR safe).
 * Returns a fully configured Supabase client — MUST be awaited.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value ?? null,
        set: (name, value, options) => {
          try {
            cookieStore.set(name, value, options)
          } catch (err) {
            console.warn('⚠️ Cookie set failed (read-only context):', err)
          }
        },
        remove: (name) => {
          try {
            cookieStore.delete(name)
          } catch {
            // ignore
          }
        },
      },
    }
  )
}
