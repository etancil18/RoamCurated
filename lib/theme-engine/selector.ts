import type { CrawlTheme } from "@/lib/theme-engine/types";
import type { Venue } from "@/types/venue";
import { matchesThemeFilters } from "../../utils/typeUtils";
import {
  isVenueOpenAtTime,
  isVenueOpenWithinWindow,
  daypartAllowedAtTime,
} from "../../utils/timeUtils";

const TYPE_MATCH_MAP: Record<string, string[]> = { 
   // Food & Drink
  bar: ["bar", "pub", "tavern", "brewery", "gastropub", "taproom", "sports bar", "happy hour"],
  lounge: ["lounge", "cocktail", "speakeasy", "rooftop bar", "hotel bar"],
  club: ["club", "nightclub", "disco", "dance hall"],
  cafe: ["cafe", "coffee", "espresso", "bakery", "café"],
  wine: ["wine", "wine bar", "vintner", "tasting room"],
  dessert: ["dessert", "ice cream", "gelato", "pastry", "sweets"],
  dinner: ["restaurant", "diner", "tapas", "bistro", "brasserie", "grill", "eatery"],
  lunch: ["lunch spot", "cafe", "deli", "sandwich", "salad", "casual dining"],
  cocktail: ["cocktail", "spirit", "mixology", "bar", "speakeasy", "rooftop"],
  "late-night": ["late night", "after hours", "food truck", "24 hour", "night bite"],

  // Cultural & Creative
  gallery: ["gallery", "art", "exhibit", "exhibition", "installation"],
  bookstore: ["bookstore", "books", "reading room", "literary"],
  museum: ["museum", "history", "exhibit", "science center"],
  lifestyle: ["boutique", "clothing", "fashion", "records", "vinyl", "home goods", "concept store", "retail", "design"],
  random: ["hidden gem", "quirky", "unexpected", "eclectic", "offbeat"],

  // Outdoor & Leisure
  park: ["park", "green space", "botanical", "garden", "outdoor"],
  market: ["market", "farmers market", "bazaar", "flea market", "street market"],
  rooftop: ["rooftop", "viewpoint", "skyline", "terrace", "high-rise"],

  // Wellness & Fitness
  spa: ["spa", "massage", "facial", "sauna", "retreat"],
  fitness: ["gym", "studio", "fitness", "yoga", "pilates", "spin", "workout"],
  wellness: ["wellness", "meditation", "breathwork", "infrared", "sound bath"],

  // Events & Entertainment
  screening: ["screening", "watch party", "theater", "cinema", "sports bar"],
  event: ["event", "festival", "performance", "live music", "comedy"],

  // Specific Activities
  game: ["arcade", "game night", "ping pong", "pool hall", "sports lounge"],
  tea: ["tea", "matcha", "herbal", "tea room", "chai"],
  juice: ["juice", "smoothie", "acai", "cleanse", "organic"],
};

function matchesVenueType(venueType: unknown, desiredCategory: string): boolean {
  if (!venueType) return false;

  const types = Array.isArray(venueType) ? venueType : [venueType];
  const keywords = TYPE_MATCH_MAP[desiredCategory];

  return types.some((t) => {
    if (typeof t !== "string") return false;
    const normalized = t.toLowerCase();

    if (!keywords) {
      return normalized.includes(desiredCategory);
    }

    return keywords.some((kw) => normalized.includes(kw));
  });
}

export function selectCandidates({
  venues,
  stageType,
  selected,
  theme,
  stageArrivalTime,
  relaxedMode = false,
  windowMinutes = 90,
}: {
  venues: Venue[];
  stageType: string;
  selected: Set<string>;
  theme: CrawlTheme;
  stageArrivalTime: Date;
  relaxedMode?: boolean;
  windowMinutes?: number;
}): Venue[] {
  const isFutureCrawl = stageArrivalTime.getTime() > Date.now();

  return venues.filter((v) => {
    const venueId = v.id || v.name;

    const isEventVenue =
      v.type?.includes("event") || (v as any).liveEvent === true;

    // Filter by event category if applicable
    if (isEventVenue && Array.isArray(theme.filters?.eventCategories)) {
      const eventCategory = (v as any).eventCategory?.toLowerCase();
      const matchesCategory = eventCategory
        ? theme.filters.eventCategories.some((cat) =>
            eventCategory.includes(cat.toLowerCase())
          )
        : false;
      if (!matchesCategory) return false;
    }

    // Match non-event types
    if (!isEventVenue && !matchesVenueType(v.type, stageType)) return false;

    // Skip already selected
    if (selected.has(venueId)) return false;

    // Time filters (open now, opens soon, or relaxed if future)
    const openNow = isVenueOpenAtTime(v, stageArrivalTime);
    const opensSoon = isVenueOpenWithinWindow(v, stageArrivalTime, windowMinutes);

    if (!(openNow || opensSoon || (isFutureCrawl && relaxedMode))) return false;

    // Daypart filter — ensure time-accurate filtering
    if (!daypartAllowedAtTime(v, stageArrivalTime)) return false;

    // Price filter
    if (
      Array.isArray(theme.filters.price) &&
      theme.filters.price.length > 0 &&
      typeof v.price === "string"
    ) {
      const priceValue = v.price.length;
      if (!theme.filters.price.includes(priceValue)) return false;
    }

    // Tag filter
    if (
      Array.isArray(theme.filters.tags) &&
      theme.filters.tags.length > 0 &&
      typeof v.tags === "string"
    ) {
      const tags = v.tags.toLowerCase();
      const matches = theme.filters.tags.some((tag) =>
        tags.includes(tag.toLowerCase())
      );
      if (!matches) return false;
    }

    // Vibe filter
    if (
      Array.isArray(theme.filters.vibes) &&
      theme.filters.vibes.length > 0 &&
      typeof v.vibe === "string"
    ) {
      const vibe = v.vibe.toLowerCase();
      const matches = theme.filters.vibes.some((vibeKeyword) =>
        vibe.includes(vibeKeyword.toLowerCase())
      );
      if (!matches) return false;
    }

    return true;
  });
}
