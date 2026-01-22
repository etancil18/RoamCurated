// types/dash.ts

/**
 * Mirrors the row from the `venue_users` table
 */
export type VenueUser = {
  id: string;
  email: string;
  venue_id: string;
  role: 'admin' | 'staff' | string;
  created_at: string;
};

/**
 * Mirrors the row from the `venue_live_status` table
 */
export type VenueLiveStatus = {
  id: string;
  venue_id: string;
  is_open_for_dropins: boolean;
  status_tags: string[] | null;
  message: string | null;
  updated_at: string;
};

/**
 * Mirrors the row from the `venue_messages` table
 */
export type VenueMessage = {
  id: string;
  venue_id: string;
  user_id: string | null;
  message: string;
  direction: 'from_user' | 'from_venue';
  created_at: string;
};

/**
 * Mirrors the row from the `venue_rsvps_view` view
 */
export type VenueRSVP = {
  crawl_rsvp_id: string;
  user_id: string;
  crawl_id: string;
  instagram_handle: string | null;
  note: string | null;
  joined_at: string;
  venue_id: string;
  datetime: string;
  vibe_tags: string[] | null;
};
