import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

/**
 * Returns a fully typed Supabase client for server-side usage (Next.js Route Handlers or Server Components).
 * Now correctly handles async cookies() in Next.js 15+.
 */
export async function createServerClient() {
  const cookieStore = cookies()
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore })
}
