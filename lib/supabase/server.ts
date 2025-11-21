// lib/supabase/server.ts
import { cookies } from "next/headers"
import {
  createServerActionClient,
  createServerComponentClient,
  createRouteHandlerClient,
} from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

// Route Handlers (API routes)
export function createServerClient() {
  const cookieStore = cookies()
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore })
}

// Server Components
export function supabaseServerComponent() {
  return createServerComponentClient<Database>({ cookies })
}

// Server Actions
export function supabaseServerAction() {
  return createServerActionClient<Database>({ cookies })
}

// Alias used in server-only pages
export function supabaseServer() {
  return createServerClient()
}
