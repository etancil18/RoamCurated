// lib/routeEngine.ts

import type { Venue } from "@/types/venue";
import {
  _intervalsForDate,
  daypartAllowedAtTime, // ✅ FIXED — future‑aware
} from "@/utils/timeUtils";
import { vibeSimilarity } from "@/utils/vibeUtils";
import { hasType, isMealType } from "@/utils/typeUtils";
import { sequencedStagesForNow } from "@/utils/stageUtils";
import { getDistanceMeters } from "@/utils/geoUtils";

export interface RouteOptions {
  startTime?: Date | string;
  maxStops?: number;
  filterOpen?: boolean;
  customStart?: { lat: number; lon: number };
  latestEndHour?: number;
  minVibeSimilarity?: number;
  theme?: string;
  eventOnly?: boolean;

  /** Distance control */
  tightness?: "tight" | "medium" | "loose";
  maxDistMeal?: number;
  maxDistOther?: number;

  /** City scaling */
  city?: "atl" | "nyc";

  /** Scheduling mode */
  relaxedTimeFiltering?: boolean;
}

const DEFAULTS = {
  maxStops: 6,
  durationPerStopHours: 1,
  bufferHours: 1,
};

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
  /** ---------------------------------------------
   * 0) Normalize startTime (CRITICAL)
   * -------------------------------------------- */
  const rawStartTime = opts.startTime;
  const startTime =
    rawStartTime instanceof Date
      ? rawStartTime
      : typeof rawStartTime === "string"
      ? new Date(rawStartTime)
      : new Date();

  const {
    maxStops = DEFAULTS.maxStops,
    filterOpen = true,
    customStart,
    latestEndHour,
    minVibeSimilarity = 0,
    theme,
    tightness = "medium",
    city = "atl",
    maxDistMeal,
    maxDistOther,
    relaxedTimeFiltering = false,
  } = opts;

  /** ---------------------------------------------
   * 1) Distance resolution
   * -------------------------------------------- */
  const cityThresholds =
    CITY_DISTANCE_THRESHOLDS[city] ?? CITY_DISTANCE_THRESHOLDS.atl;

  const derivedMaxDistance =
    cityThresholds[tightness] ?? cityThresholds.medium;

  const MAX_MEAL_DISTANCE =
    typeof maxDistMeal === "number" ? maxDistMeal : derivedMaxDistance;

  const MAX_OTHER_DISTANCE =
    typeof maxDistOther === "number" ? maxDistOther : derivedMaxDistance;

  console.log("📏 RouteEngine config", {
    city,
    tightness,
    relaxedTimeFiltering,
    startTime: startTime.toISOString(),
    MAX_MEAL_DISTANCE,
    MAX_OTHER_DISTANCE,
  });

  /** ---------------------------------------------
   * 2) Venue pool
   * -------------------------------------------- */
  const originLat = customStart?.lat ?? userLat;
  const originLon = customStart?.lon ?? userLon;

  const pool = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lon === "number"
  );

  if (pool.length === 0) {
    console.warn("generateRoute: no valid venues");
    return [];
  }

  /** ---------------------------------------------
   * 3) Stage plan (BASED ON startTime)
   * -------------------------------------------- */
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

  /** ---------------------------------------------
   * 4) Routing loop
   * -------------------------------------------- */
  for (let i = 0; i < stagePlan.length && route.length < maxStops; i++) {
    const desiredTypes = stagePlan[i];

    const arrival = new Date(
      currentTime.getTime() + DEFAULTS.bufferHours * 3600 * 1000
    );

    if (arrival > latestEndTime) break;

    const candidates = pool
      .map((v) => {
        if (route.includes(v)) return null;
        if (!hasType(v, desiredTypes)) return null;

        const dist = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
        const maxDist = isMealType(v)
          ? MAX_MEAL_DISTANCE
          : MAX_OTHER_DISTANCE;

        if (dist > maxDist) return null;

        /** ⏰ TIME FILTERING — FULLY FUTURE‑AWARE */
        if (!relaxedTimeFiltering) {
          if (filterOpen && !_isOpenAt(v, arrival)) {
            if (!(v as any).liveEvent) return null;
          }

          // ✅ FIXED: uses scheduled arrival time
          if (!daypartAllowedAtTime(v, arrival)) return null;
        }

        const similarity = lastVenue ? vibeSimilarity(lastVenue, v) : 1;
        if (lastVenue && similarity < minVibeSimilarity) return null;

        (v as any).__score = similarity * 1000 - dist;

        if ((v as any).liveEvent) {
          (v as any).__score += 500;
        }

        return v;
      })
      .filter(Boolean) as Venue[];

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => (b as any).__score - (a as any).__score);
    const next = candidates[0];

    const estDuration = next.duration ?? DEFAULTS.durationPerStopHours;
    const estimatedEnd = new Date(
      currentTime.getTime() + estDuration * 3600 * 1000
    );

    if (estimatedEnd > latestEndTime) break;

    route.push(next);
    lastLat = next.lat;
    lastLon = next.lon;
    lastVenue = next;
    currentTime = estimatedEnd;
  }

  return route;
}

/** ---------------------------------------------
 * Open‑hours helper (future‑aware)
 * -------------------------------------------- */
function _isOpenAt(venue: Venue, when: Date): boolean {
  const intervals = _intervalsForDate(when, venue.hoursNumeric || {});
  return intervals.some(([openTs, closeTs]) => when >= openTs && when < closeTs);
}
