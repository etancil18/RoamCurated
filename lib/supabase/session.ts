// lib/supabase/session.ts
'use client';

import { supabaseBrowser } from './client';

/**
 * Returns the current authenticated user's ID.
 * If not logged in, returns null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = supabaseBrowser();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error fetching user:', error.message);
    return null;
  }

  return user?.id ?? null;
}