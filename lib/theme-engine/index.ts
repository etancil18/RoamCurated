import type { Venue } from "@/types/venue";
import { themeById } from "@/lib/crawlConfig";
import { sortVenuesByScore } from "@/lib/theme-engine/scorer-fixed";
import { selectCandidates } from "@/lib/theme-engine/selector";
import { generateStageFlow, resolveStageEntry } from "@/lib/theme-engine/planner-fixed";
import { getDistanceMeters } from "@/utils/geoUtils";
import { DateTime } from "luxon";

const DEFAULTS = {
  maxStops: 6,
  fallbackWindowMinutes: 90,
};

const CITY_DISTANCE_THRESHOLDS: Record<
  "atl" | "nyc" | "lisbon" | "porto",
  Record<"tight" | "medium" | "loose", number>
> = {
  atl: { tight: 1000, medium: 2000, loose: 3500 },
  nyc: { tight: 350, medium: 800, loose: 1200 },
  lisbon: { tight: 250, medium: 700, loose: 1100 },
  porto: { tight: 175, medium: 550, loose: 950 },
};

export interface ThemeRouteOptions {
  userLat: number;
  userLon: number;
  themeId: string;
  venues: Venue[];
  maxStops?: number;
  filterOpen?: boolean;
  city?: "atl" | "nyc" | "lisbon" | "porto";
  tightness?: "tight" | "medium" | "loose";
  maxDistanceMeters?: number;
  eventOnly?: boolean;
  startTime?: DateTime;
  relaxedTimeFiltering?: boolean;
}

export async function generateThemeRoute({
  userLat,
  userLon,
  themeId,
  venues,
  maxStops = DEFAULTS.maxStops,
  filterOpen = false,
  city = "atl",
  tightness = "medium",
  maxDistanceMeters,
  eventOnly = false,
  startTime,
  relaxedTimeFiltering = true,
}: ThemeRouteOptions): Promise<Venue[]> {
  const theme = themeById[themeId];
  if (!theme) {
    console.warn("❌ Theme not found:", themeId);
    return [];
  }

  const { flow: stageFlow, isFallback, reason } = generateStageFlow(theme);
  if (isFallback) {
    console.info("🧭 Using fallback stageFlow:", reason);
  }

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
  let currentTime = startTime ?? DateTime.now();

  for (let i = 0; i < stageFlow.length && route.length < maxStops; i++) {
    const stageEntry = stageFlow[i];
    const desiredType = resolveStageEntry(stageEntry);
    if (!desiredType) {
      console.warn(`⚠️ Invalid stage entry at index ${i}:`, stageEntry);
      continue;
    }

    let candidates = selectCandidates({
      venues: pool,
      stageType: desiredType,
      selected: new Set(route.map((v) => v.id ?? v.name)),
      theme,
      stageArrivalTime: currentTime, // 🔥 Luxon-native
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
        const eventStart = new Date((v as any).starts_at ?? now);
        const timeDiffHours = Math.abs(eventStart.getTime() - now.getTime()) / 3600000;

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
    currentTime = currentTime.plus({
      hours: next.duration || 1,
    });
  }

  console.log(
    `✅ Theme route generated with ${route.length} stops (includes live event logic + eventOnly support)`
  );

  return route;
}

// 🔁 Generate multiple alternative routes with randomization
export async function generateMultipleThemeRoutes({
  userLat,
  userLon,
  themeId,
  venues,
  maxStops = DEFAULTS.maxStops,
  filterOpen = false,
  city = "atl",
  tightness = "medium",
  maxDistanceMeters,
  eventOnly = false,
  startTime,
  relaxedTimeFiltering = true,
  variants = 5,
}: ThemeRouteOptions & { variants?: number }): Promise<Venue[][]> {
  const results: Venue[][] = [];

  for (let i = 0; i < variants; i++) {
    const shuffledVenues = [...venues].sort(() => Math.random() - 0.5);
    const route = await generateThemeRoute({
      userLat,
      userLon,
      themeId,
      venues: shuffledVenues,
      maxStops,
      filterOpen,
      city,
      tightness,
      maxDistanceMeters,
      eventOnly,
      startTime,
      relaxedTimeFiltering,
    });

    if (route.length > 0) results.push(route);
  }

  return results;
}
