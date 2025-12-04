// lib/routeEngine.ts

import type { Venue } from "@/types/venue";
import { _intervalsForDate, daypartAllowedForNow } from "@/utils/timeUtils";
import { vibeSimilarity } from "@/utils/vibeUtils";
import { hasType, isMealType } from "@/utils/typeUtils";
import { sequencedStagesForNow } from "@/utils/stageUtils";
import { getDistanceMeters } from "@/utils/geoUtils";

export interface RouteOptions {
  startTime?: Date;
  maxStops?: number;
  filterOpen?: boolean;
  customStart?: { lat: number; lon: number };
  latestEndHour?: number;
  minVibeSimilarity?: number;
  theme?: string;
   eventOnly?: boolean;

  /** NEW — distance tightness */
  tightness?: "tight" | "medium" | "loose";

  /** OPTIONAL overrides (still allowed but usually replaced by tightness) */
  maxDistMeal?: number;
  maxDistOther?: number;

  /** NEW — city so we can apply proper scaling */
  city?: "atl" | "nyc";
}

const DEFAULTS = {
  maxStops: 6,
  durationPerStopHours: 1,
  bufferHours: 1,
};

/** NEW — city‑based distance thresholds */
const CITY_DISTANCE_THRESHOLDS = {
  atl: { tight: 800, medium: 1600, loose: 2500 },
  nyc: { tight: 400, medium: 1200, loose: 2000 },
};

export async function generateRoute(
  venues: Venue[],
  userLat: number,
  userLon: number,
  opts: RouteOptions = {}
): Promise<Venue[]> {
  const {
    startTime = new Date(),
    maxStops = DEFAULTS.maxStops,
    filterOpen = true,
    customStart,
    latestEndHour,
    minVibeSimilarity = 0,
    theme,

    /** NEW */
    tightness = "medium",
    city = "atl",

    /** Legacy overrides still accepted */
    maxDistMeal,
    maxDistOther,
  } = opts;

  /** -------------------------------------------------------
   * 1) Compute max distances based on tightness & city
   * ------------------------------------------------------ */
  const cityThresholds = CITY_DISTANCE_THRESHOLDS[city] ?? CITY_DISTANCE_THRESHOLDS["atl"];

  const derivedMaxDistance = cityThresholds[tightness] ?? cityThresholds.medium;

  // If user provided direct overrides, respect them — else use tightness-based.
  const MAX_MEAL_DISTANCE = typeof maxDistMeal === "number" ? maxDistMeal : derivedMaxDistance;
  const MAX_OTHER_DISTANCE = typeof maxDistOther === "number" ? maxDistOther : derivedMaxDistance;

  console.log("📏 Distance tightness resolution:", {
    tightness,
    city,
    maxDistMeal: MAX_MEAL_DISTANCE,
    maxDistOther: MAX_OTHER_DISTANCE,
  });

  /** -------------------------------------------------------
   * 2) Prep venue pool
   * ------------------------------------------------------ */
  const originLat = customStart?.lat ?? userLat;
  const originLon = customStart?.lon ?? userLon;

  // Filter out invalid coordinates
  const pool = venues.filter((v) => typeof v.lat === "number" && typeof v.lon === "number");
  if (pool.length === 0) {
    console.warn("generateRoute: no venues with valid lat/lon", venues.length);
    return [];
  }

  /** -------------------------------------------------------
   * 3) Build stage plan (morning → lunch → drinks, etc.)
   * ------------------------------------------------------ */
  const stagePlan = sequencedStagesForNow(startTime, {
    durationHours: maxStops,
    latestEndHour,
    theme,
  });

  const route: Venue[] = [];
  let currentTime = new Date(startTime);
  let lastLat = originLat;
  let lastLon = originLon;
  let lastVenue: Venue | null = null;

  const today = startTime.getDay();
  const endHour = latestEndHour ?? (today >= 4 && today <= 6 ? 27 : 24);
  const latestEndTime = new Date(startTime);
  latestEndTime.setHours(endHour, 0, 0, 0);

  /** -------------------------------------------------------
   * 4) Main routing loop
   * ------------------------------------------------------ */
  for (let i = 0; i < stagePlan.length && route.length < maxStops; i++) {
    const desiredTypes = stagePlan[i];

    const arrival = new Date(currentTime.getTime() + DEFAULTS.bufferHours * 3600 * 1000);
    if (arrival > latestEndTime) break;

    const candidates = pool
      .map((v) => {
        if (route.includes(v)) return null;
        if (!hasType(v, desiredTypes)) return null;

        /** --- Distance Filtering (NEW) --- */
        const dist = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
        const maxDist = isMealType(v) ? MAX_MEAL_DISTANCE : MAX_OTHER_DISTANCE;
        if (dist > maxDist) return null;

        /** Time, daypart & vibe filters */
        // If the venue has a `liveEvent` field, you could optionally skip _isOpenAt check for live events.
        if (filterOpen && !_isOpenAt(v, arrival)) {
          // Example: allow if v.liveEvent exists and starts near 'arrival'
          if (!v.liveEvent) return null;
        }
        if (!daypartAllowedForNow(v, arrival)) return null;

        const similarity = lastVenue ? vibeSimilarity(lastVenue, v) : 1;
        if (lastVenue && similarity < minVibeSimilarity) return null;

        /** Score = vibe similarity - distance weight */
        (v as any).__score = similarity * 1000 - dist;

        // ✅ BONUS: boost live events slightly (if flagged)
        if ((v as any).liveEvent) {
          (v as any).__score += 500;  // arbitrary boost — adjust as desired
        }

        return v;
      })
      .filter(Boolean) as Venue[];

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => (b as any).__score - (a as any).__score);
    const next = candidates[0];

    const estDuration = next.duration ?? DEFAULTS.durationPerStopHours;
    const estimatedEnd = new Date(currentTime.getTime() + estDuration * 3600 * 1000);
    if (estimatedEnd > latestEndTime) break;

    route.push(next);
    lastLat = next.lat;
    lastLon = next.lon;
    lastVenue = next;
    currentTime = estimatedEnd;
  }

  return route;
}

function _isOpenAt(venue: Venue, when: Date): boolean {
  const intervals = _intervalsForDate(when, venue.hoursNumeric || {});
  return intervals.some(([openTs, closeTs]) => when >= openTs && when < closeTs);
}

