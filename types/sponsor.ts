// types/sponsor.ts

// 🏙️ A single venue used in a crawl
export type SponsorVenue = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  city: string;
  instagram_handle?: string | null; // ✅ For Instagram linking
};

// 🧠 Payload for creating or updating a sponsored crawl
export type SponsorCrawlPayload = {
  title: string;
  description: string;
  datetime: string | null; // ISO format or null
  venue_ids: string[];
  city: string;
  vibe_tags: string[]; // Optional — reserved for later use
  rsvp_enabled: boolean;
  slug: string;
  max_capacity?: number | null;
  is_sponsored?: boolean;
  sponsor_name?: string | null; // ✅ For sponsored crawls
  is_public: boolean;
};

// 📋 A crawl fetched from Supabase
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
  max_capacity?: number | null;
  is_sponsored?: boolean;
  sponsor_name?: string | null; // ✅ For sponsored crawls
  slug: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
};

// 👥 RSVP record returned by Supabase
export type SponsorRSVP = {
  id: string;
  crawl_id: string;
  user_id: string;
  instagram_handle?: string | null;
  full_name?: string | null;
  personality_style?: string | null;
  note?: string | null;
  joined_at: string;
};

// 🧩 Joined record from get_crawl_with_attendees (includes user + crawl data)
export type SponsorCrawlWithAttendees = {
  crawl_id: string;
  title: string | null;
  description: string | null;
  vibe_tags: string[] | null;
  datetime: string | null;
  city: string | null;
  venue_ids: string[];
  is_sponsored: boolean | null;
  sponsor_name: string | null; // ✅ Required for consistent enrichment
  max_capacity: number | null; // ✅ Required for consistent enrichment
  rsvp_user_id: string | null;
  instagram_handle: string | null;
  note: string | null;
  joined_at: string | null;
  personality_style?: string | null;
  full_name: string | null; // ✅ Used for attendee display
  creator_id: string; // ✅ Needed for edit access logic
  slug: string | null; // ✅ Needed for routing or editing
};

// ⚙️ Explicit RPC argument definitions (strongly typed)
export type JoinCrawlArgs = {
  input_crawl_id: string;
};

export type LeaveCrawlArgs = {
  crawl_id: string;
};

// ✏️ For creator-only updates
export type UpdateCrawlArgs = Partial<SponsorCrawlPayload> & {
  id: string;
};

// ✅ Crawl progress tracking (new feature)
export type CrawlProgress = {
  id: string;
  crawl_id: string;
  user_id: string;
  venue_id: string;
  completed: boolean;
  updated_at: string;
};

// 💬 Crawl message (chat system)
export type SponsorChatMessage = {
  id: string;
  crawl_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

// 📊 Sponsor crawl state returned from /api/getsponsorcrawl
export type SponsorCrawlState = {
  crawl: SponsorCrawl;
  attendees: {
    rsvp_user_id: string;
    full_name: string | null;
    instagram_handle: string | null;
    personality_style: string | null;
  }[];
  attendeeCount: number;
  remainingCapacity: number | null;
  isGoing: boolean;
  chatEnabled: boolean;
};

// 🔁 RSVP API response
export type SponsorRSVPResponse = {
  message?: string;
  error?: string;
  rsvpStatus: 'going' | null;
};