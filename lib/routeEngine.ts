import type { Venue } from "@/types/venue";
import { _intervalsForDate, daypartAllowedAtTime } from "@/utils/timeUtils";
import { vibeSimilarity } from "@/utils/vibeUtils";
import { isMealType } from "@/utils/typeUtils";
import { sequencedStagesForNow } from "@/utils/stageUtils";
import { getDistanceMeters } from "@/utils/geoUtils";
import { looseHasType } from "@/lib/prompt-engine/semanticUtils";
import { DateTime } from "luxon";

export interface RouteOptions {
  startTime?: DateTime | Date | string;
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
  city?: "atl" | "nyc" | "lisbon" | "porto" | "london" | "la";
  relaxedTimeFiltering?: boolean;
  forceStageOrder?: boolean;
  disableStageInference?: boolean;
  confidenceTier?: "commit" | "constrain";
}

interface Stage {
  type: string[];
  tags?: string[];
  timeCategory?: string;
  vibe?: string[];
  __stageIndex?: number;
}

const DEFAULTS = {
  maxStops: 6,
  durationPerStopHours: 1,
  bufferHours: 1,
};

const CITY_DISTANCE_THRESHOLDS = {
  atl: { tight: 1500, medium: 3000, loose: 4500 },
  nyc: { tight: 400, medium: 1200, loose: 2000 },
  lisbon: { tight: 300, medium: 900, loose: 1500 },
  porto: { tight: 300, medium: 700, loose: 1300 },
  london: { tight: 500, medium: 1400, loose: 2400 },
  la: { tight: 1800, medium: 4000, loose: 7000 },
};

const STRICT_TYPES = new Set([
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "cocktails",
  "wine bar",
  "pilates",
  "yoga",
  "class",
]);

const MEAL_EQUIVALENTS: Record<string, string[]> = {
  lunch: ["lunch", "sandwich", "deli", "salad", "cafe", "café"],
  dinner: ["dinner"],
  brunch: ["brunch", "cafe", "café"],
};

const DRINK_EQUIVALENTS: Record<string, string[]> = {
  cocktails: ["cocktails", "bar", "lounge", "speakeasy", "rooftop"],
  wine: ["wine bar"],
  bar: ["bar", "cocktails", "lounge", "speakeasy"],
  beer: ["bar", "brewery", "beer garden"],
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
  const startTimeLuxon =
    opts.startTime instanceof DateTime
      ? opts.startTime
      : opts.startTime instanceof Date
      ? DateTime.fromJSDate(opts.startTime)
      : typeof opts.startTime === "string"
      ? DateTime.fromISO(opts.startTime)
      : DateTime.now();

  const startTime = startTimeLuxon.toJSDate();

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

  const confidenceTier: "commit" | "constrain" =
    opts.confidenceTier === "constrain" ? "constrain" : "commit";

  const cityThresholds =
    CITY_DISTANCE_THRESHOLDS[city] ?? CITY_DISTANCE_THRESHOLDS.atl;

  const baseMaxDistance = cityThresholds[tightness];
  const MAX_MEAL_DISTANCE = maxDistMeal ?? baseMaxDistance;
  const MAX_OTHER_DISTANCE = maxDistOther ?? baseMaxDistance;

  const originLat = customStart?.lat ?? userLat;
  const originLon = customStart?.lon ?? userLon;

  const pool = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lon === "number"
  );
  if (!pool.length) return [];

  let stagePlan: Stage[];

  if (forceStageOrder && Array.isArray(stages) && stages.length > 0) {
    stagePlan = stages;
  } else if (!disableStageInference) {
    stagePlan =
      Array.isArray(stages) && stages.length > 0
        ? stages
        : normalizeStagePlan(
            sequencedStagesForNow(startTime, {
              durationHours: maxStops,
              latestEndHour,
              theme,
            })
          );
  } else {
    stagePlan = Array.isArray(stages) && stages.length > 0 ? stages : [];
  }

  if (!stagePlan.length) {
    stagePlan = [{ type: ["activity"] }];
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

  for (let i = 0; i < stagePlan.length && route.length < maxStops; i++) {
    const stage = stagePlan[i];
    if (!stage.type?.length) continue;

    const arrival = new Date(
      currentTime.getTime() + DEFAULTS.bufferHours * 3600 * 1000
    );

    if (arrival > latestEndTime) break;

    const arrivalLuxon = DateTime.fromJSDate(arrival);

    const isStrictStage = stage.type.some((t) => STRICT_TYPES.has(t));
    const isActivityStage = stage.type.includes("activity");

    const candidates = pool
      .map((v) => {
        if (route.includes(v)) return null;

        const venueTypes = Array.isArray(v.type)
          ? v.type
          : [v.type].filter(Boolean);

        const venueTags =
          typeof v.tags === "string"
            ? v.tags.split(",").map((t) => t.trim().toLowerCase())
            : [];

        const venueVibes =
          typeof v.vibe === "string"
            ? v.vibe.split(",").map((s) => s.trim().toLowerCase())
            : [];

        const stageVibes = Array.isArray(stage.vibe)
          ? stage.vibe.map((s) => s.toLowerCase())
          : [];

        const exactTypeMatch = stage.type.some((t) => {
          if (venueTypes.includes(t)) return true;
          if (MEAL_EQUIVALENTS[t]) {
            return MEAL_EQUIVALENTS[t].some((alt) =>
              venueTypes.includes(alt)
            );
          }
          if (DRINK_EQUIVALENTS[t]) {
            return DRINK_EQUIVALENTS[t].some((alt) =>
              venueTypes.includes(alt)
            );
          }
          return false;
        });

        const looseTypeMatch = looseHasType(v, stage.type);

        const tagMatch =
          stage.tags?.some((tag) =>
            venueTags.includes(tag.toLowerCase())
          ) ?? false;

        const vibeMatch =
          stageVibes.length > 0 &&
          stageVibes.some((kw) =>
            venueVibes.some((vv) => vv.includes(kw) || kw.includes(vv))
          );

        if (isStrictStage) {
          if (!exactTypeMatch && !looseTypeMatch) return null;
        } else if (
          !exactTypeMatch &&
          !looseTypeMatch &&
          !tagMatch &&
          !vibeMatch &&
          !isActivityStage
        ) {
          return null;
        }

        const dist = getDistanceMeters(lastLat, lastLon, v.lat, v.lon);
        const maxDist = isMealType(v)
          ? MAX_MEAL_DISTANCE
          : MAX_OTHER_DISTANCE;

        const hardCapMultiplier = confidenceTier === "commit" ? 1.25 : 1.0;
        const hardCap = maxDist * hardCapMultiplier;
        if (dist > hardCap) return null;

        if (!relaxedTimeFiltering) {
          if (filterOpen && !_isOpenAt(v, arrivalLuxon)) {
            if (!(v as any).liveEvent) return null;
          }
          if (!daypartAllowedAtTime(v, arrivalLuxon)) return null;
        }

        const similarity = lastVenue ? vibeSimilarity(lastVenue, v) : 1;
        if (lastVenue && similarity < minVibeSimilarity) return null;

        let score = 0;

        if (exactTypeMatch) score += 8;
        if (looseTypeMatch) score += 3;
        if (tagMatch) score += 3;
        if (vibeMatch && !isStrictStage) score += 4;

        if (isActivityStage && !isStrictStage) {
          score += 2;
          if (route.length === 0) score += 3;
        }

        const distancePenalty =
          route.length === 0 ? dist * 0.0006 : dist * 0.0012;

        (v as any).__score =
          score * 1000 + similarity * 500 - distancePenalty;

        if ((v as any).liveEvent) (v as any).__score += 500;

        return v;
      })
      .filter(Boolean) as Venue[];

    if (!candidates.length) {
      if (confidenceTier === "constrain") {
        stage.type = ["activity"];
        i--;
        continue;
      }
      continue;
    }

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

function _isOpenAt(venue: Venue, when: DateTime): boolean {
  const intervals = _intervalsForDate(when, venue.hoursNumeric || {});
  const whenMillis = when.toMillis();

  return intervals.some(([open, close]) => {
    return whenMillis >= open.toMillis() && whenMillis < close.toMillis();
  });
}