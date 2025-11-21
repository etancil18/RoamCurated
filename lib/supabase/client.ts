// lib/supabase/client.ts

import {
  createPagesBrowserClient,
  createServerComponentClient,
  createServerActionClient,
} from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

/**
 * Legacy export—your project already uses this.
 * Still safe to keep.
 */
export const supabaseBrowser = createPagesBrowserClient<Database>()

/**
 * ⭐ NEW — Provides the missing `createBrowserClient()` API
 * so pages can safely import it:
 * 
 * import { createBrowserClient } from "@/lib/supabase/client"
 */
export function createBrowserClient() {
  return createPagesBrowserClient<Database>()
}

/**
 * Server component client
 */
export function supabaseServerComponent() {
  return createServerComponentClient<Database>({ cookies })
}

/**
 * Server action client
 */
export function supabaseServerAction() {
  return createServerActionClient<Database>({ cookies })
}
