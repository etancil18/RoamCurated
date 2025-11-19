import type { CrawlTheme } from "@/lib/theme-engine/types";
import type { Venue } from "@/types/venue";
import { matchesThemeFilters } from "../../utils/typeUtils";
import { isVenueOpenAtTime, isVenueOpenWithinWindow } from "../../utils/timeUtils";


const TYPE_MATCH_MAP: Record<string, string[]> = {
  bar: ["bar", "pub", "tavern", "brewery"],
  cafe: ["cafe", "coffee", "espresso"],
  club: ["club", "nightclub", "disco"],
  lounge: ["lounge", "cocktail"],
  gallery: ["gallery", "art"],
  dessert: ["dessert", "ice cream", "gelato"],
  wine: ["wine", "vintner"],
  fitness: ["gym", "studio", "fitness"],
  // Extend as needed
};

function matchesVenueType(venueType: unknown, desiredCategory: string): boolean {
  if (!venueType) return false;

  const types = Array.isArray(venueType)
    ? venueType
    : [venueType];

  const keywords = TYPE_MATCH_MAP[desiredCategory];

  return types.some((t) => {
    if (typeof t !== 'string') return false;
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
  return venues.filter((v) => {
    if (!matchesVenueType(v.type, stageType)) return false;
    if (selected.has(v.id || v.name)) return false;

    // Time check
    const openNow = isVenueOpenAtTime(v, stageArrivalTime);
    const opensSoon = relaxedMode ? isVenueOpenWithinWindow(v, stageArrivalTime, windowMinutes) : false;
    if (!openNow && !opensSoon) return false;

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
      const matches = theme.filters.tags.some((tag) => tags.includes(tag.toLowerCase()));
      if (!matches) return false;
    }

    // Vibe filter
    if (
      Array.isArray(theme.filters.vibes) &&
      theme.filters.vibes.length > 0 &&
      typeof v.vibe === "string"
    ) {
      const vibe = v.vibe.toLowerCase();
      const matches = theme.filters.vibes.some((vibeKeyword) => vibe.includes(vibeKeyword.toLowerCase()));
      if (!matches) return false;
    }

    return true;
  });
}
