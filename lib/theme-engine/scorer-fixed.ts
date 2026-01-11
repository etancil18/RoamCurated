import type { Venue } from "@/types/venue";
import type { CrawlTheme } from "@/lib/theme-engine/types";
import { getDistanceMeters } from "@/utils/geoUtils";
import { vibeSimilarity } from "@/utils/vibeUtils";
import { hasVibeOrTagMatch } from "@/utils/typeUtils";

/**
 * Computes a weighted score for a venue based on theme relevance, distance, and timing.
 */
export function computeScore(
  venue: Venue,
  theme: CrawlTheme,
  origin: { lat: number; lon: number },
  lastVenue: Venue | null,
  weight?: {
    vibe?: number;
    tag?: number;
    keyword?: number;
    dist?: number;
  }
): number {
  const {
    vibe = 2,
    tag = 1,
    keyword = 2,
    dist = 1,
  } = weight || {};

  const distMeters = getDistanceMeters(origin.lat, origin.lon, venue.lat, venue.lon);
  const vibeScore = lastVenue ? vibeSimilarity(lastVenue, venue) * vibe : 1;
  const keywordMatch = hasVibeOrTagMatch(venue, theme.keywords) ? keyword : 0;

  // 🎉 Bonus logic for live events
  let eventBonus = 0;
  if ((venue as any).liveEvent) {
    const startsAt = new Date((venue as any).starts_at).getTime();
    const now = Date.now();
    const timeUntilStart = startsAt - now;

    const isSoon = timeUntilStart > 0 && timeUntilStart <= 2 * 60 * 60 * 1000; // next 2 hours
    if (isSoon) {
      eventBonus += 3;
    }

    // 🎯 Bonus for matching eventCategory against theme filters
    const eventCategory = (venue as any).eventCategory?.toLowerCase();
    const matchesCategory = eventCategory && Array.isArray(theme.filters?.eventCategories)
      ? theme.filters.eventCategories.some((cat) =>
          eventCategory.includes(cat.toLowerCase())
        )
      : false;

    if (matchesCategory) {
      eventBonus += 2;
    }
  }

  const score = vibeScore + keywordMatch + eventBonus - (distMeters / 1000) * dist;
  return score;
}

/**
 * Sorts venues descending by computed score.
 */
export function sortVenuesByScore(
  venues: Venue[],
  theme: CrawlTheme,
  origin: { lat: number; lon: number },
  lastVenue: Venue | null
): Venue[] {
  return venues
    .map((v) => ({
      ...v,
      _score: computeScore(v, theme, origin, lastVenue),
    }))
    .sort((a, b) => (b._score || 0) - (a._score || 0));
}
