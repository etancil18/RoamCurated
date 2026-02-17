import type { CrawlTheme } from "@/lib/theme-engine/types";
import type { Venue } from "@/types/venue";
import { DateTime } from "luxon";
import { matchesThemeFilters } from "../../utils/typeUtils";
import {
  isVenueOpenAtTime,
  isVenueOpenWithinWindow,
  daypartAllowedAtTime,
} from "../../utils/timeUtils";

const TYPE_MATCH_MAP: Record<string, string[]> = {
  bar: ["bar", "pub", "tavern", "brewery", "gastropub", "taproom", "sports bar", "happy hour"],
  lounge: ["lounge", "cocktail", "speakeasy", "rooftop bar", "hotel bar"],
  club: ["club", "nightclub", "disco", "dance hall"],
  coffee: ["cafe", "coffee", "espresso", "bakery", "café"],
  "wine bar": ["wine", "wine bar", "somm", "vintner", "tasting room"],
  dessert: ["dessert", "ice cream", "gelato", "pastry", "sweets"],
  dinner: ["dinner", "restaurant", "diner", "tapas", "bistro", "brasserie", "grill", "eatery"],
  lunch: ["lunch", "lunch spot", "cafe", "deli", "sandwich", "salad", "casual dining"],
  cocktail: ["cocktail", "spirit", "mixology", "bar", "speakeasy", "rooftop"],
  "late-night": ["late night", "late", "after hours", "food truck", "24 hour", "night bite"],
  breakfast: [
    "breakfast",
    "brunch",
    "morning",
    "brunch spot",
    "breakfast cafe",
    "pancakes",
    "eggs",
    "brunch restaurant",
    "all-day breakfast"
  ],

  brunch: [
    "brunch",
    "breakfast",
    "daytime",
    "mimosas",
    "bloody mary",
    "weekend brunch",
    "cafe",
    "bistro"
  ],

  speakeasy: [
    "speakeasy",
    "hidden bar",
    "secret bar",
    "password",
    "underground",
    "back room",
    "cocktail den",
    "prohibition"
  ],

  "happy hour": [
    "happy hour",
    "after work",
    "drink specials",
    "bar",
    "cocktail",
    "wine bar",
    "pub",
    "taproom",
    "lounge"
  ],

  gallery: ["gallery", "art", "exhibit", "exhibition", "installation"],
  bookstore: ["bookstore", "books", "reading room", "literary"],
  museum: ["museum", "history", "exhibit", "science center"],
  lifestyle: ["boutique", "clothing", "fashion", "records", "vinyl", "home goods", "concept store", "retail", "design"],
  random: ["hidden gem", "quirky", "unexpected", "eclectic", "offbeat"],

  park: ["park", "green space", "botanical", "garden", "outdoor"],
  market: ["market", "farmers market", "bazaar", "flea market", "street market"],
  rooftop: ["rooftop", "viewpoint", "skyline", "terrace", "high-rise"],

  spa: ["spa", "massage", "facial", "sauna", "retreat"],
  fitness: ["gym", "studio", "fitness", "yoga", "pilates", "spin", "workout"],
  wellness: ["wellness", "meditation", "breathwork", "infrared", "sound bath"],

  screening: ["screening", "watch party", "theater", "cinema", "sports bar"],
  event: ["event", "festival", "performance", "live music", "comedy"],

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
    return keywords?.some((kw) => normalized.includes(kw)) ?? normalized.includes(desiredCategory);
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
  stageArrivalTime: DateTime;
  relaxedMode?: boolean;
  windowMinutes?: number;
}): Venue[] {
  const now = DateTime.now().setZone(stageArrivalTime.zone);
  const isFutureCrawl = stageArrivalTime.toMillis() > now.toMillis();


  return venues.filter((v) => {
    const venueId = v.id || v.name;
    if (selected.has(venueId)) return false;

    const isEventVenue = v.type?.includes("event") || (v as any).liveEvent === true;

    // Filter event categories if defined
    if (isEventVenue && Array.isArray(theme.filters?.eventCategories)) {
      const eventCategory = (v as any).eventCategory?.toLowerCase();
      const match = eventCategory &&
        theme.filters.eventCategories.some((cat) =>
          eventCategory.includes(cat.toLowerCase())
        );
      if (!match) return false;
    }

    // Type check (skip event category match — that's handled above)
    if (!isEventVenue && !matchesVenueType(v.type, stageType)) return false;

    // Time gating (open now, opens soon, relaxed future crawl)
    const openNow = isVenueOpenAtTime(v, stageArrivalTime);
    const opensSoon = isVenueOpenWithinWindow(
      v,
      stageArrivalTime,
      windowMinutes
    );
    
    if (!(openNow || opensSoon || (relaxedMode && isFutureCrawl))) return false;

    if (!daypartAllowedAtTime(v, stageArrivalTime)) return false;

    // Core filters — vibes, tags, price, timeOfDay
    if (!matchesThemeFilters(v, theme.filters ?? {})) return false;

    return true;
  });
}
