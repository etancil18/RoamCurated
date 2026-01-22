import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Fetches the currently logged-in venue user (by email).
 * Returns `null` if the user is not authenticated or not a venue user.
 */
export async function getCurrentVenueUser() {
  const supabase = await createServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return null;
  }

  const userEmail = authData.user.email;
  if (!userEmail) return null;

  const { data: venueUser, error: venueError } = await supabase
    .from('venue_users')
    .select('*')
    .eq('email', userEmail)
    .single();

  if (venueError || !venueUser) {
    return null;
  }

  return venueUser; // { id, email, venue_id, role, created_at }
}
