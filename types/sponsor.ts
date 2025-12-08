// A single venue used in a crawl
export type SponsorVenue = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  instagram_handle?: string | null; // ✅ Added for Instagram linking
};

// Payload for creating a sponsor crawl
export type SponsorCrawlPayload = {
  title: string;
  description: string;
  datetime: string | null; // ISO format or null
  venue_ids: string[];
  city: string;
  vibe_tags: string[]; // Optional — reserved for later use
  rsvp_enabled: boolean;
  slug: string;
  max_capacity?: number;
  is_sponsored?: boolean;
  sponsor_name?: string;
};

// A public crawl fetched from Supabase
export type SponsorCrawl = {
  id: string;
  title: string;
  description: string;
  creator_id: string;
  datetime: string | null;
  venue_ids: string[];
  city: string;
  vibe_tags: string[];
  rsvp_enabled: boolean;
  max_capacity?: number;
  is_sponsored?: boolean;
  slug: string;
  created_at: string;
  updated_at: string;
};

// RSVP record returned by Supabase
export type SponsorRSVP = {
  id: string;
  crawl_id: string;
  user_id: string;
  instagram_handle?: string;
  note?: string;
  joined_at: string;
};

// Joined record from get_crawl_with_attendees
export type SponsorCrawlWithAttendees = {
  crawl_id: string;
  title: string | null;
  description: string | null;
  vibe_tags: string[] | null;
  datetime: string | null;
  city: string | null;
  venue_ids: string[];
  is_sponsored: boolean | null;
  max_capacity?: number | null; // ✅ Added for RSVP progress bar support
  rsvp_user_id: string | null;
  instagram_handle: string | null;
  note: string | null;
  joined_at: string | null;
  personality_style?: string | null;
};

// ✅ Explicitly define function param types for RPC calls
export type JoinCrawlArgs = {
  input_crawl_id: string;
};

export type LeaveCrawlArgs = {
  crawl_id: string;
};
