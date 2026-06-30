import type { Venue } from "@/types/venue";
import type { CrawlTheme } from "@/lib/theme-engine/types";
import { getDistanceMeters } from "@/utils/geoUtils";
import { vibeSimilarityVerbose } from "@/utils/vibeUtils";
import {
  keywordMatchScore,
  vibeMatchScore,
  tagMatchScore,
} from "@/utils/typeUtils";

type SupportedCity = "nyc" | "atl" | "lisbon" | "porto" | "london" | "la";

/**
 * City-specific curved distance scoring
 */
function distanceScore(
  city: SupportedCity,
  meters: number
): number {
  // 🇺🇸 New York (very dense)
  if (city === "nyc") {
    if (meters < 500) return 1;
    if (meters < 1000) return 0.6;
    if (meters < 1500) return 0.2;
    return -meters / 1000;
  }

  // 🇬🇧 London (dense, transit/walking-friendly)
  if (city === "london") {
    if (meters < 600) return 1;
    if (meters < 1200) return 0.6;
    if (meters < 2000) return 0.2;
    return -meters / 1200;
  }

  // 🇺🇸 Los Angeles (sprawled, looser distance tolerance)
  if (city === "la") {
    if (meters < 1800) return 1;
    if (meters < 4000) return 0.6;
    if (meters < 7000) return 0.2;
    return -meters / 2500;
  }

  // 🇵🇹 Porto (compact but slightly looser than NYC)
  if (city === "porto") {
    if (meters < 600) return 1;
    if (meters < 1200) return 0.6;
    if (meters < 1800) return 0.2;
    return -meters / 1200;
  }

  // 🇵🇹 Lisbon (dense but hill friction + broader sprawl)
  if (city === "lisbon") {
    if (meters < 700) return 1;
    if (meters < 1400) return 0.6;
    if (meters < 2200) return 0.2;
    return -meters / 1400;
  }

  // 🇺🇸 Atlanta (default — sprawled)
  if (meters < 1000) return 1;
  if (meters < 2000) return 0.6;
  if (meters < 3000) return 0.2;
  return -meters / 1600;
}

/**
 * Computes a weighted score for a venue based on theme relevance,
 * vibe continuity, distance, and event timing.
 */
export function computeScore(
  venue: Venue,
  theme: CrawlTheme,
  origin: { lat: number; lon: number },
  lastVenue: Venue | null,
  city: SupportedCity = "atl",
  weight?: {
    vibe?: number;
    tag?: number;
    keyword?: number;
    dist?: number;
  }
): number {
  const {
    vibe = 3,
    tag = 2,
    keyword = 2,
    dist = 1,
  } = weight || {};

  const distMeters = getDistanceMeters(
    origin.lat,
    origin.lon,
    venue.lat,
    venue.lon
  );

  // 🎭 Vibe continuity (semantic, normalized)
  const vibeSim = lastVenue
    ? vibeSimilarityVerbose(lastVenue, venue).score
    : 0.6;

  // 🧠 Thematic relevance
  const keywordHits = keywordMatchScore(venue, theme.keywords);
  const vibeHits = theme.filters?.vibes
    ? vibeMatchScore(venue, theme.filters.vibes)
    : 2;
  const tagHits = theme.filters?.tags
    ? tagMatchScore(venue, theme.filters.tags)
    : 1;

  // 🎉 Live event bonus logic
  let eventBonus = 0;
  if ((venue as any).liveEvent) {
    const startsAt = new Date((venue as any).starts_at).getTime();
    const now = Date.now();
    const timeUntilStart = startsAt - now;

    if (timeUntilStart > 0 && timeUntilStart <= 2 * 60 * 60 * 1000) {
      eventBonus += 3;
    }

    const eventCategory = (venue as any).eventCategory?.toLowerCase();
    const matchesCategory =
      eventCategory &&
      Array.isArray(theme.filters?.eventCategories)
        ? theme.filters.eventCategories.some((cat) =>
            eventCategory.includes(cat.toLowerCase())
          )
        : false;

    if (matchesCategory) {
      eventBonus += 2;
    }
  }

  const score =
    vibeSim * vibe +
    keywordHits * keyword +
    vibeHits * vibe +
    tagHits * tag +
    eventBonus +
    distanceScore(city, distMeters) * dist;

  return score;
}

/**
 * Sorts venues descending by computed score.
 * Adds _score for downstream inspection.
 */
export function sortVenuesByScore(
  venues: Venue[],
  theme: CrawlTheme,
  origin: { lat: number; lon: number },
  lastVenue: Venue | null,
  city: SupportedCity = "atl",
  weight?: {
    vibe?: number;
    tag?: number;
    keyword?: number;
    dist?: number;
  }
): Venue[] {
  return venues
    .map((v) => ({
      ...v,
      _score: computeScore(v, theme, origin, lastVenue, city, weight),
    }))
    .sort((a, b) => (b._score || 0) - (a._score || 0));
}