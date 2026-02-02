import type { Venue } from "@/types/venue";
import { _intervalsForDate, daypartAllowedAtTime } from "@/utils/timeUtils";
import { vibeSimilarity } from "@/utils/vibeUtils";
import { hasType, isMealType } from "@/utils/typeUtils";
import { sequencedStagesForNow } from "@/utils/stageUtils";
import { getDistanceMeters } from "@/utils/geoUtils";
import { looseHasType } from "@/lib/prompt-engine/semanticUtils";

export interface RouteOptions {
  startTime?: Date | string;
  maxStops?: number;
  filterOpen?: boolean;
  customStart?: { lat: number; lon: number };
  latestEndHour?: number;
  minVibeSimilarity?: number;
  theme?: string;
  eventOnly?: boolean;
  tightness?: "tight" | "medium" | "loose";
  maxDistMeal?: number;
  maxDistOther?: number;
  city?: "atl" | "nyc";
  relaxedTimeFiltering?: boolean;
  forceStageOrder?: boolean;
  disableStageInference?: boolean;
}

interface Stage {
  type: string[];
  tags?: string[];
  timeCategory?: string;
  vibe_keywords?: string[];
  __stageIndex?: number;
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

function normalizeStagePlan(groups: string[][]): Stage[] {
  return groups.map((g) => ({ type: g }));
}

export async function generateRoute(
  venues: Venue[],
  userLat: number,
  userLon: number,
  opts: RouteOptions = {},
  stages?: Stage[]
): Promise<Venue[]> {
  const startTime =
    opts.startTime instanceof Date
      ? opts.startTime
      : typeof opts.startTime === "string"
      ? new Date(opts.startTime)
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
    forceStageOrder,
    disableStageInference,
  } = opts;

  const cityThresholds =
    CITY_DISTANCE_THRESHOLDS[city] ?? CITY_DISTANCE_THRESHOLDS.atl;

  const maxDistance = cityThresholds[tightness];
  const MAX_MEAL_DISTANCE = maxDistMeal ?? maxDistance;
  const MAX_OTHER_DISTANCE = maxDistOther ?? maxDistance;

  const originLat = customStart?.lat ?? userLat;
  const originLon = customStart?.lon ?? userLon;

  const pool = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lon === "number"
  );
  if (!pool.length) return [];

  // ---------------- STAGE PLAN ----------------
  let stagePlan: Stage[];

  const isAIFlow = Boolean(stages?.[0]?.__stageIndex !== undefined);

  if (forceStageOrder && Array.isArray(stages)) {
    // ✅ AI flow: trust parseprompt output ONLY
    stagePlan = stages;
  } else if (!disableStageInference) {
    // 🧠 Fallback system stages
    stagePlan = normalizeStagePlan(
      sequencedStagesForNow(startTime, {
        durationHours: maxStops,
        latestEndHour,
        theme,
      })
    );
  } else {
    stagePlan = [];
  }

  const route: Venue[] = [];
  let currentTime = new Date(startTime);
  let lastLat = originLat;
  let lastLon = originLon;
  let lastVenue: Venue | null = null;

  const today = startTime.getDay();
  const endHour = latestEndHour ?? (today >= 4 && today <= 6 ? 27 : 24);
  const latestEndTime = new Date(startTime);
  latestEndTime.setHours(endHour, 0, 0, 0);

  // ---------------- MAIN LOOP ----------------
  for (let i = 0; i < stagePlan.length && route.length < maxStops; i++) {
    const stage = stagePlan[i];
    if (!stage.type?.length) continue;

    const arrival = new Date(
      currentTime.getTime() + DEFAULTS.bufferHours * 3600 * 1000
    );
    if (arrival > latestEndTime) break;

    const candidates = pool
      .map((v) => {
        if (route.includes(v)) return null;

        const venueTypes = Array.isArray(v.type) ? v.type : [v.type].filter(Boolean);

        const venueTags =
          typeof v.tags === "string"
            ? v.tags.split(",").map((t) => t.trim().toLowerCase())
            : [];

        // ---------- MATCHING ----------
        const exactTypeMatch =
          stage.type.some((t) => venueTypes.includes(t));

        const looseTypeMatch = looseHasType(v, stage.type);

        const tagMatch =
          stage.tags?.some((tag) => venueTags.includes(tag.toLowerCase())) ??
          false;

        const vibeMatch =
          typeof v.vibe === "string" &&
          stage.vibe_keywords?.some((kw) =>
            v.vibe!.toLowerCase().includes(kw.toLowerCase())
          );

        if (isAIFlow) {
          // ✅ AI logic: type FIRST, tags secondary
          if (!exactTypeMatch && !looseTypeMatch && !tagMatch) return null;
        } else {
          // legacy behavior
          if (!hasType(v, stage.type) && !tagMatch && !vibeMatch) return null;
        }

        // ---------- DISTANCE ----------
        const dist = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
        const maxDist = isMealType(v) ? MAX_MEAL_DISTANCE : MAX_OTHER_DISTANCE;
        if (dist > maxDist) return null;

        // ---------- TIME ----------
        if (!relaxedTimeFiltering) {
          if (filterOpen && !_isOpenAt(v, arrival)) {
            if (!(v as any).liveEvent) return null;
          }
          if (!daypartAllowedAtTime(v, arrival)) return null;
        }

        const similarity = lastVenue ? vibeSimilarity(lastVenue, v) : 1;
        if (lastVenue && similarity < minVibeSimilarity) return null;

        // ---------- SCORING ----------
        let score = 0;
        if (exactTypeMatch) score += 3; // 🔥 explicit intent match
        if (tagMatch) score += 2;
        if (vibeMatch) score += 2;

        (v as any).__score = score * 1000 + similarity * 500 - dist;
        if ((v as any).liveEvent) (v as any).__score += 500;

        return v;
      })
      .filter(Boolean) as Venue[];

    if (!candidates.length) continue;

    candidates.sort((a, b) => (b as any).__score - (a as any).__score);
    const next = candidates[0];

    const duration = next.duration ?? DEFAULTS.durationPerStopHours;
    const end = new Date(currentTime.getTime() + duration * 3600 * 1000);
    if (end > latestEndTime) break;

    route.push(next);
    lastLat = next.lat;
    lastLon = next.lon;
    lastVenue = next;
    currentTime = end;
  }

  return route;
}

function _isOpenAt(venue: Venue, when: Date): boolean {
  const intervals = _intervalsForDate(when, venue.hoursNumeric || {});
  return intervals.some(([open, close]) => when >= open && when < close);
}
