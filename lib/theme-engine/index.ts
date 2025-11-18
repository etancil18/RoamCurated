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
  atl: { tight: 800, medium: 1600, loose: 2500 },
  nyc: { tight: 400, medium: 1200, loose: 2000 },
};

interface ThemeRouteOptions {
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
}

/**
 * Generates a themed crawl route from a user's location and theme ID.
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
}: ThemeRouteOptions): Promise<Venue[]> {
  const theme = themeById[themeId];
  if (!theme) {
    console.warn("❌ Theme not found:", themeId);
    return [];
  }

  const stageFlow = generateStageFlow(theme);

  const pool = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lon === "number"
  );
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

    const sorted = sortVenuesByScore(
      candidates,
      theme,
      { lat: lastLat, lon: lastLon },
      route[route.length - 1] || null
    );

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

  return route;
}
