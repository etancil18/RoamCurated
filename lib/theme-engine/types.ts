import type { Venue } from "@/types/venue";

export type CrawlTheme = {
  themeId: string;
  name: string;
  description: string;
  stageFlow: string[]; // Ordered types of venues (e.g., coffee → gallery → dinner)
  filters: {
    vibes?: string[];
    tags?: string[];
    price?: number[]; // $ = 1, $$ = 2, $$$ = 3, $$$$ = 4
    timeOfDay?: ("morning" | "day" | "evening" | "night" | "late-night")[];
    eventCategories?: string[]; // NEW — categories used to match live events
  };
  keywords: string[]; // Keywords used to score how well a venue fits the theme
};

export type ThemeRouteOptions = {
  themeId: string;
  venues: Venue[];
  userLat: number;
  userLon: number;
  customStart?: { lat: number; lon: number };
  startTime?: Date;
  maxStops?: number;
  filterOpen?: boolean; // true = strict (must be open at arrival), false = relaxed (can open within 90 mins)
  maxDistanceMeters?: number;
  eventOnly?: boolean; // NEW — limit to events only
  relaxedTimeFiltering?: boolean; // 🔑 NEW — allows openSoon or future fallback in tighter filters
};

export type Stage = {
  type: string;     // e.g., "coffee", "gallery", etc.
  index: number;    // order in crawl
  when: Date;       // estimated arrival time
};

export type ScoredCandidate = {
  venue: Venue;
  score: number;
  distance: number;
  keywordHits: number;
  vibeMatch: number;
  tagMatch: number;
};

// Each venue should have:
// - hoursNumeric: { mon: { open: number, close: number } }
// - duration: number (hours, float or int)
