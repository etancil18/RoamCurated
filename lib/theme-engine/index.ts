import type { Venue } from "@/types/venue";
import { themeById } from "@/lib/crawlConfig";
import { sortVenuesByScore } from "@/lib/theme-engine/scorer-fixed";
import { selectCandidates } from "@/lib/theme-engine/selector";
import { generateStageFlow } from "@/lib/theme-engine/planner-fixed";
import { getDistanceMeters } from "@/utils/geoUtils";

const DEFAULTS = {
  maxStops: 6,
  fallbackWindowMinutes: 90,
};

/**
 * These match the thresholds used in generate-crawl.
 */
const CITY_DISTANCE_THRESHOLDS: Record<
  "atl" | "nyc",
  Record<"tight" | "medium" | "loose", number>
> = {
  atl: { tight: 900, medium: 1700, loose: 3500 },
  nyc: { tight: 400, medium: 1200, loose: 2000 },
};

export interface ThemeRouteOptions {
  userLat: number;
  userLon: number;
  themeId: string;
  venues: Venue[];
  maxStops?: number;
  filterOpen?: boolean;

  /** NEW 👇 */
  city?: "atl" | "nyc";
  tightness?: "tight" | "medium" | "loose";
  maxDistanceMeters?: number; // Allows API to directly pass
  eventOnly?: boolean; // ✅ NEW — limit generation strictly to event venues
}

/**
 * Generates a themed crawl route from a user's location and theme ID.
 * Includes dynamic event prioritization and optional event-only filtering.
 */
export async function generateThemeRoute({
  userLat,
  userLon,
  themeId,
  venues,
  maxStops = DEFAULTS.maxStops,
  filterOpen = true,

  /** NEW defaults */
  city = "atl",
  tightness = "medium",
  maxDistanceMeters,
  eventOnly = false,
}: ThemeRouteOptions): Promise<Venue[]> {
  const theme = themeById[themeId];
  if (!theme) {
    console.warn("❌ Theme not found:", themeId);
    return [];
  }

  const stageFlow = generateStageFlow(theme);

  // 🧩 Filter base venue pool
  let pool = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lon === "number"
  );

  // 🧩 If eventOnly flag is true, narrow pool strictly to event venues
  if (eventOnly) {
    pool = pool.filter(
      (v) =>
        (v as any).liveEvent === true ||
        (Array.isArray(v.type) && v.type.includes("event"))
    );
  }

  if (pool.length === 0) {
    console.warn("❌ No valid venue coordinates found.");
    return [];
  }

  /**
   * Final distance threshold:
   * - Prefer explicit maxDistanceMeters passed from API
   * - Otherwise compute via city + tightness
   */
  const effectiveMaxDistance =
    maxDistanceMeters ??
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    1600;

  console.log("📏 Theme distance threshold:", {
    city,
    tightness,
    effectiveMaxDistance,
    eventOnly,
  });

  const route: Venue[] = [];
  let lastLat = userLat;
  let lastLon = userLon;
  let currentTime = new Date();

  for (let i = 0; i < stageFlow.length && route.length < maxStops; i++) {
    const desiredType = stageFlow[i];

    let candidates = selectCandidates({
      venues: pool,
      stageType: desiredType,
      selected: new Set(route.map((v) => v.id ?? v.name)),
      theme,
      stageArrivalTime: currentTime,
      relaxedMode: !filterOpen,
      windowMinutes: DEFAULTS.fallbackWindowMinutes,
    });

    /** 🚀 Filter by max hop distance */
    candidates = candidates.filter((v) => {
      const dist = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
      return dist <= effectiveMaxDistance;
    });

    /** 🎭 Dynamic event logic injection */
    candidates = candidates.map((v) => {
      const base = { ...v } as any;
      const now = new Date();

      if ((v as any).liveEvent || v.type?.includes("event")) {
        const startTime = new Date((v as any).starts_at ?? now);
        const timeDiffHours = Math.abs(startTime.getTime() - now.getTime()) / 3600000;

        // Stronger boost if event is happening within next 2h
        let eventBoost = 600;
        if (timeDiffHours <= 2) eventBoost = 1000;
        if (timeDiffHours <= 0.5) eventBoost = 1300;

        base._eventBoost = eventBoost;
      }

      return base;
    });

    /** 🎯 Apply final scoring */
    let sorted = sortVenuesByScore(
      candidates,
      theme,
      { lat: lastLat, lon: lastLon },
      route[route.length - 1] || null
    );

    // Apply event boosts after sorting
    sorted = sorted.map((v) => {
      const boostedScore = (v._score ?? 0) + (v._eventBoost ?? 0);
      return { ...v, _score: boostedScore };
    });

    sorted.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

    if (sorted.length === 0) {
      console.warn(`⚠️ No candidates for stage ${i} (${desiredType}). Skipping...`);
      continue;
    }

    const next = sorted[0];
    route.push(next);

    lastLat = next.lat;
    lastLon = next.lon;
    currentTime = new Date(
      currentTime.getTime() + (next.duration || 1) * 60 * 60 * 1000
    );
  }

  console.log(
    `✅ Theme route generated with ${route.length} stops (includes live event logic + eventOnly support)`
  );

  return route;
}
