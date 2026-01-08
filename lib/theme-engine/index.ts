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

const CITY_DISTANCE_THRESHOLDS: Record<
  "atl" | "nyc",
  Record<"tight" | "medium" | "loose", number>
> = {
  atl: { tight: 900, medium: 2000, loose: 3500 },
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
  maxDistanceMeters?: number;
  eventOnly?: boolean;

  /** 🔑 Scheduled crawl support */
  startTime?: Date;
  relaxedTimeFiltering?: boolean;
}

export async function generateThemeRoute({
  userLat,
  userLon,
  themeId,
  venues,
  maxStops = DEFAULTS.maxStops,
  filterOpen = true,
  city = "atl",
  tightness = "medium",
  maxDistanceMeters,
  eventOnly = false,
  startTime = new Date(),
  relaxedTimeFiltering = false,
}: ThemeRouteOptions): Promise<Venue[]> {
  const theme = themeById[themeId];
  if (!theme) {
    console.warn("❌ Theme not found:", themeId);
    return [];
  }

  const stageFlow = generateStageFlow(theme);

  let pool = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lon === "number"
  );

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

  const effectiveMaxDistance =
    maxDistanceMeters ??
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    1600;

  console.log("📏 Theme distance threshold:", {
    city,
    tightness,
    effectiveMaxDistance,
    eventOnly,
    relaxedTimeFiltering,
  });

  const route: Venue[] = [];
  let lastLat = userLat;
  let lastLon = userLon;
  let currentTime = new Date(startTime);

  for (let i = 0; i < stageFlow.length && route.length < maxStops; i++) {
    const desiredType = stageFlow[i];

    let candidates = selectCandidates({
      venues: pool,
      stageType: desiredType,
      selected: new Set(route.map((v) => v.id ?? v.name)),
      theme,
      stageArrivalTime: currentTime,
      relaxedMode: relaxedTimeFiltering,
      windowMinutes: DEFAULTS.fallbackWindowMinutes,
    });

    candidates = candidates.filter((v) => {
      const dist = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
      return dist <= effectiveMaxDistance;
    });

    candidates = candidates.map((v) => {
      const base = { ...v } as any;
      const now = new Date();

      if ((v as any).liveEvent || v.type?.includes("event")) {
        const startTime = new Date((v as any).starts_at ?? now);
        const timeDiffHours = Math.abs(startTime.getTime() - now.getTime()) / 3600000;

        let eventBoost = 600;
        if (timeDiffHours <= 2) eventBoost = 1000;
        if (timeDiffHours <= 0.5) eventBoost = 1300;

        base._eventBoost = eventBoost;
      }

      return base;
    });

    let sorted = sortVenuesByScore(
      candidates,
      theme,
      { lat: lastLat, lon: lastLon },
      route[route.length - 1] || null
    );

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
