import type { CrawlTheme } from "@/lib/theme-engine/types";
import type { Venue } from "@/types/venue";
import { DateTime } from "luxon";
import { matchesThemeFilters } from "../../utils/typeUtils";
import { getDistanceMeters } from "../../utils/geoUtils";
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
  "wine bar": ["wine", "wine bar", "somm", "vintner", "tasting room", "naturalwine", "vines", "grapes"],
  dessert: ["dessert", "ice cream", "gelato", "pastry", "sweets"],
  dinner: ["dinner", "restaurant", "diner", "tapas", "bistro", "brasserie", "grill", "eatery"],
  lunch: ["lunch", "lunch spot", "cafe", "deli", "sandwich", "salad", "casual dining", "pizza"],
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
  park: ["park", "nature", "green space", "botanical", "garden", "outdoor"],
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

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .flatMap((item) => item.split(","))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function matchesVenueType(venueType: unknown, desiredCategory: string): boolean {
  const types = normalizeStringList(venueType);
  const desired = desiredCategory.toLowerCase();
  const keywords = TYPE_MATCH_MAP[desired] ?? [];

  return types.some((t) =>
    keywords.some((kw) => t.includes(kw.toLowerCase())) || t.includes(desired)
  );
}

function estimateTravelMinutes(distanceMeters: number): number {
  return Math.max(5, Math.round(distanceMeters / 80));
}

export function selectCandidates({
  venues,
  stageType,
  selected,
  theme,
  stageArrivalTime,
  relaxedMode = false,
  windowMinutes = 90,
  currentLat,
  currentLon,
}: {
  venues: Venue[];
  stageType: string;
  selected: Set<string>;
  theme: CrawlTheme;
  stageArrivalTime: DateTime;
  relaxedMode?: boolean;
  windowMinutes?: number;
  currentLat?: number;
  currentLon?: number;
}): Venue[] {
  const now = DateTime.now().setZone(stageArrivalTime.zone);
  const isFutureCrawl = stageArrivalTime.toMillis() > now.toMillis();
  const effectiveWindowMinutes =
    relaxedMode && isFutureCrawl
      ? Math.max(windowMinutes, 45)
      : windowMinutes;

  return venues.filter((v) => {
    const venueId = v.id || v.name;
    if (selected.has(venueId)) return false;

    const venueTypes = normalizeStringList(v.type);
    const isEventVenue =
      venueTypes.includes("event") || (v as any).liveEvent === true;

    if (isEventVenue && Array.isArray(theme.filters?.eventCategories)) {
      const eventCategory = (v as any).eventCategory?.toLowerCase();
      const match = eventCategory &&
        theme.filters.eventCategories.some((cat) =>
          eventCategory.includes(cat.toLowerCase())
        );
      if (!match) return false;
    }

    if (!isEventVenue && !matchesVenueType(v.type, stageType)) return false;

    const candidateArrivalTime =
      typeof currentLat === "number" && typeof currentLon === "number"
        ? stageArrivalTime.plus({
            minutes: estimateTravelMinutes(
              getDistanceMeters(currentLat, currentLon, v.lat, v.lon)
            ),
          })
        : stageArrivalTime;

    const openNow = isVenueOpenAtTime(v, candidateArrivalTime);
    const opensSoon = isVenueOpenWithinWindow(
      v,
      candidateArrivalTime,
      effectiveWindowMinutes
    );

    if (!(openNow || opensSoon)) return false;

    if (!daypartAllowedAtTime(v, candidateArrivalTime)) return false;

    if (!matchesThemeFilters(v, theme.filters ?? {})) return false;

    return true;
  });
}