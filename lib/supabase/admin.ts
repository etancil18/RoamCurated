// lib/supabase/admin.ts

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[supabaseAdmin] Missing required env var: ${name}`);
  }

  return value;
}

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "[supabaseAdmin] Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY"
  );
}

/**
 * Server-only Supabase admin client.
 *
 * WARNING:
 * - Uses the service role key.
 * - Bypasses Row Level Security.
 * - Never import this from client components.
 * - Never expose this client through API responses.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "roamcurated-server-admin",
      },
    },
  }
);

/**
 * Use this only when you want an explicit function call
 * instead of importing the singleton directly.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return supabaseAdmin;
}