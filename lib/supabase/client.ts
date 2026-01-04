// lib/supabase/client.ts

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

/**
 * ✅ Supabase client for client-side components
 * Automatically uses browser cookies and session storage
 */
export function supabaseBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * 🙋‍♂️ Get the currently logged-in user's ID (client-side only)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('getCurrentUserId error:', error.message);
    return null;
  }

  return data.user?.id ?? null;
}
