// lib/supabase/session.ts
'use client';

import { supabaseBrowser } from './client';

/**
 * Returns the current user's ID from the Supabase session.
 * If not logged in, returns null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = supabaseBrowser();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Error fetching session:', error.message);
    return null;
  }

  return session?.user?.id ?? null;
}
