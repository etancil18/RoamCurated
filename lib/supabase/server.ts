// lib/supabase/server.ts
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import type { NextResponse } from 'next/server'

/**
 * Server‑side Supabase client (SSR safe).
 * Supports cookie persistence in middleware/auth callbacks via optional `res`.
 */
export async function createServerClient(res?: NextResponse) {
  const cookieStore = await cookies()

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value ?? null,
        set: (name, value, options) => {
          if (res?.cookies) {
            res.cookies.set(name, value, options)
          } else {
            try {
              cookieStore.set(name, value, options)
            } catch (err) {
              console.warn('⚠️ Cookie set failed (read-only context):', err)
            }
          }
        },
        remove: (name) => {
          if (res?.cookies) {
            res.cookies.set(name, '', { maxAge: -1 })
          } else {
            try {
              cookieStore.delete(name)
            } catch {
              // ignore
            }
          }
        },
      },
    }
  )
}
