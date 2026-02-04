// lib/supabase/server.ts
import { createServerClient as _createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import type { NextResponse } from 'next/server'

export function createServerClient(res?: NextResponse) {
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: () => null, // ✅ let Supabase read from request internally
        set: (name, value, options) => {
          res?.cookies.set(name, value, options)
        },
        remove: (name) => {
          res?.cookies.set(name, '', { maxAge: -1 })
        },
      },
    }
  )
}
