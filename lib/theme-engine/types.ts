import type { Venue } from "@/types/venue";
import type { StageFlow } from "@/lib/theme-engine/planner-fixed";
import { DateTime } from "luxon";


export type CrawlTheme = {
  themeId: string;
  name: string;
  description: string;
  stageFlow?: StageFlow; // Ordered types of venues (e.g., coffee → gallery → dinner)
  filters: {
    vibes?: string[];
    tags?: string[];
    price?: number[]; // $ = 1, $$ = 2, $$$ = 3, $$$$ = 4
    timeOfDay?: (
      | "morning"
      | "afternoon"
      | "midday"
      | "happyhour"
      | "happy hour"
      | "day"
      | "evening"
      | "late"
      | "late-night"
    )[];
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
  startTime?: DateTime;
  maxStops?: number;
  filterOpen?: boolean; // true = strict (must be open at arrival), false = relaxed (can open within 90 mins)
  maxDistanceMeters?: number;
  eventOnly?: boolean;
  relaxedTimeFiltering?: boolean;
  city?: "atl" | "nyc" | "lisbon" | "porto" | "london" | "la";
  tightness?: "tight" | "medium" | "loose";
};

export type Stage = {
  type: string;
  index: number;
  when: Date;
};

export type ScoredCandidate = {
  venue: Venue;
  score: number;
  distance: number;
  keywordHits: number;
  vibeMatch: number;
  tagMatch: number;
};

/**
 * Extended candidate with breakdowns for logging/debugging
 */
export type ScoredCandidateVerbose = ScoredCandidate & {
  breakdown: {
    vibe: number;
    keyword: number;
    tag: number;
    distance: number;
    eventBonus: number;
    energy: number;
  };
  matchedVibes?: string[];
  fallbackUsed?: string;
};

/**
 * Optional per-theme weight overrides for scoring logic
 */
export type ScoringWeights = {
  vibe?: number;
  keyword?: number;
  tag?: number;
  dist?: number;
  energy?: number;
};