// lib/supabase/server.ts
import { cookies } from "next/headers"
import {
  createRouteHandlerClient,
  createServerComponentClient,
  createServerActionClient,
} from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

/**
 * Server-side Supabase client for API Route Handlers
 */
export async function createServerClient() {
  const cookieStore = cookies()
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore })
}

/**
 * Server-side Supabase client for Server Components
 */
export function supabaseServerComponent() {
  return createServerComponentClient<Database>({ cookies })
}

/**
 * Server-side Supabase client for Server Actions
 */
export function supabaseServerAction() {
  return createServerActionClient<Database>({ cookies })
}

/**
 * Alias: a universal server-side client used for server pages
 * (this is what your portal pages expect)
 */
export async function supabaseServer() {
  return createServerClient()
}
