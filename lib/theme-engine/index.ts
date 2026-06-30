import type { Venue } from "@/types/venue";
import { themeById } from "@/lib/crawlConfig";
import { sortVenuesByScore } from "@/lib/theme-engine/scorer-fixed";
import { selectCandidates } from "@/lib/theme-engine/selector";
import { generateStageFlow, resolveStageEntry } from "@/lib/theme-engine/planner-fixed";
import { applyTransitionScore } from "@/lib/theme-engine/transitions";
import { getDistanceMeters } from "@/utils/geoUtils";
import { DateTime } from "luxon";

const DEFAULTS = {
  maxStops: 6,
  fallbackWindowMinutes: 60,
};

const CITY_DISTANCE_THRESHOLDS: Record<
  "atl" | "nyc" | "lisbon" | "porto" | "london" | "la",
  Record<"tight" | "medium" | "loose", number>
> = {
  atl: { tight: 1200, medium: 3000, loose: 4500 },
  nyc: { tight: 350, medium: 800, loose: 1200 },
  lisbon: { tight: 300, medium: 700, loose: 1000 },
  porto: { tight: 255, medium: 550, loose: 1000 },
  london: { tight: 500, medium: 1100, loose: 1800 },
  la: { tight: 1800, medium: 4000, loose: 7000 },
};

const CANDIDATE_PASSES = [
  {
    name: "strict",
    relaxationLevel: "strict",
    legMultiplier: 1,
    radiusMultiplier: 1,
  },
  {
    name: "relax-theme",
    relaxationLevel: "relax-theme",
    legMultiplier: 1.25,
    radiusMultiplier: 1.15,
  },
  {
    name: "relax-daypart",
    relaxationLevel: "relax-daypart",
    legMultiplier: 1.5,
    radiusMultiplier: 1.3,
  },
  {
    name: "relax-type",
    relaxationLevel: "relax-type",
    legMultiplier: 1.75,
    radiusMultiplier: 1.5,
  },
] as const;

function estimateTravelMinutes(distanceMeters: number): number {
  return Math.max(5, Math.round(distanceMeters / 80));
}

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

function venueIsEvent(venue: Venue): boolean {
  const venueTypes = normalizeStringList(venue.type);
  return venueTypes.includes("event") || (venue as any).liveEvent === true;
}

export interface ThemeRouteOptions {
  userLat: number;
  userLon: number;
  themeId: string;
  venues: Venue[];
  maxStops?: number;
  filterOpen?: boolean;
  city?: "atl" | "nyc" | "lisbon" | "porto" | "london" | "la";
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
  relaxedTimeFiltering = false,
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
    pool = pool.filter((v) => venueIsEvent(v));
  }

  if (pool.length === 0) {
    console.warn("❌ No valid venue coordinates found.");
    return [];
  }

  const effectiveMaxDistance =
    maxDistanceMeters ??
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    1600;

  const routeRadiusMultiplier = {
    tight: 1.25,
    medium: 1.75,
    loose: 2.5,
  }[tightness];

  const effectiveRouteRadius = effectiveMaxDistance * routeRadiusMultiplier;

  console.log("📏 Theme distance threshold:", {
    city,
    tightness,
    effectiveMaxDistance,
    effectiveRouteRadius,
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

    let sorted: Venue[] = [];
    let matchedPassName: string | null = null;

    for (const pass of CANDIDATE_PASSES) {
      let candidates = selectCandidates({
        venues: pool,
        stageType: desiredType,
        selected: new Set(route.map((v) => v.id ?? v.name)),
        theme,
        stageArrivalTime: currentTime,
        relaxedMode: relaxedTimeFiltering,
        windowMinutes: DEFAULTS.fallbackWindowMinutes,
        currentLat: lastLat,
        currentLon: lastLon,
        relaxationLevel: pass.relaxationLevel,
      });

      candidates = candidates.filter((v) => {
        const legDistance = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
        const originDistance = getDistanceMeters(userLat, userLon, v.lat, v.lon);

        return (
          legDistance <= effectiveMaxDistance * pass.legMultiplier &&
          originDistance <= effectiveRouteRadius * pass.radiusMultiplier
        );
      });

      candidates = candidates.map((v) => {
        const base = { ...v } as any;
        const now = new Date();

        if (venueIsEvent(v)) {
          const eventStart = new Date((v as any).starts_at ?? now);
          const timeDiffHours =
            Math.abs(eventStart.getTime() - now.getTime()) / 3600000;

          let eventBoost = 3;
          if (timeDiffHours <= 2) eventBoost = 5;
          if (timeDiffHours <= 0.5) eventBoost = 7;

          base._eventBoost = eventBoost;
        }

        return base;
      });

      sorted = sortVenuesByScore(
        candidates,
        theme,
        { lat: lastLat, lon: lastLon },
        route[route.length - 1] || null
      );

      sorted = sorted.map((v) => {
        const boostedScore = (v._score ?? 0) + ((v as any)._eventBoost ?? 0);
        return { ...v, _score: boostedScore };
      });

      sorted = sorted.map((v) =>
        applyTransitionScore(
          v,
          route[route.length - 1] || null,
          desiredType
        )
      );

      sorted.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

      if (sorted.length > 0) {
        matchedPassName = pass.name;
        break;
      }
    }

    if (sorted.length === 0) {
      console.warn(`⚠️ No candidates for stage ${i} (${desiredType}). Skipping...`);
      continue;
    }

    if (matchedPassName && matchedPassName !== "strict") {
      console.info(`🪜 Stage ${i} (${desiredType}) matched via fallback pass: ${matchedPassName}`);
    }

    const next = sorted[0];
    const travelMinutes = estimateTravelMinutes(
      getDistanceMeters(lastLat, lastLon, next.lat, next.lon)
    );

    route.push(next);

    lastLat = next.lat;
    lastLon = next.lon;
    currentTime = currentTime.plus({
      minutes: travelMinutes + ((next.duration || 1) * 60),
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
  relaxedTimeFiltering = false,
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