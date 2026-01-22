import { createServerClient } from '@/lib/supabase/server';
import { getCurrentVenueUser } from './dash-auth';

/**
 * Returns all crawl RSVPs associated with the current venue
 * via the `venue_rsvps_view`.
 */
export async function getVenueRSVPs() {
  const venueUser = await getCurrentVenueUser();
  if (!venueUser) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('venue_rsvps_view')
    .select('*')
    .eq('venue_id', venueUser.venue_id)
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch RSVPs:', error.message);
    return [];
  }

  return data;
}

/**
 * Fetches the current venue's live status row
 */
export async function getLiveStatus() {
  const venueUser = await getCurrentVenueUser();
  if (!venueUser) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('venue_live_status')
    .select('*')
    .eq('venue_id', venueUser.venue_id)
    .single();

  if (error) {
    console.error('Failed to fetch live status:', error.message);
    return null;
  }

  return data;
}

/**
 * Fetches the last 20 messages associated with the venue
 */
export async function getVenueMessages(limit = 20) {
  const venueUser = await getCurrentVenueUser();
  if (!venueUser) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('venue_messages')
    .select('*')
    .eq('venue_id', venueUser.venue_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch messages:', error.message);
    return [];
  }

  return data;
}
