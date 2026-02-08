import { NextRequest, NextResponse } from "next/server";
import { generateRoute } from "@/lib/routeEngine";
import { fetchLiveEventsForCity } from "@/lib/events/fetchLiveEvents";
import type { Venue } from "@/types/venue";
import { v4 as uuidv4 } from "uuid";
import { supabaseRouteHandler } from "@/lib/supabase/route-handler";
import { normalizeStages } from "@/lib/prompt-engine/stageUtils";

const CITY_DISTANCE_THRESHOLDS = {
  atl: { tight: 1000, medium: 2500, loose: 4500 },
  nyc: { tight: 750, medium: 1400, loose: 2100 },
};

type Tier = "commit" | "constrain" | "clarify";

export async function POST(req: NextRequest) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const {
    venues,
    options = {},
    userLat,
    userLon,
    city,
    plannedStartAt,
    stages,
    tier,
  } = body as {
    venues: Venue[];
    options?: Record<string, any>;
    userLat: number;
    userLon: number;
    city?: "atl" | "nyc";
    plannedStartAt?: string;
    stages?: any[];
    tier: Tier;
  };

  // ---------------- VALIDATION ----------------

  if (!tier || !["commit", "constrain", "clarify"].includes(tier)) {
    return NextResponse.json(
      { error: "Missing or invalid tier" },
      { status: 400 }
    );
  }

  if (!Array.isArray(venues) || venues.length === 0) {
    return NextResponse.json(
      { error: "Venues must be a non-empty array." },
      { status: 400 }
    );
  }

  if (
    typeof userLat !== "number" ||
    typeof userLon !== "number" ||
    isNaN(userLat) ||
    isNaN(userLon)
  ) {
    return NextResponse.json(
      { error: "Invalid or missing user location." },
      { status: 400 }
    );
  }

  if (!city || (city !== "atl" && city !== "nyc")) {
    return NextResponse.json(
      { error: "Missing or invalid city." },
      { status: 400 }
    );
  }

  // ---------------- TIME HANDLING ----------------

  let relaxedTimeFiltering = false;

  if (plannedStartAt) {
    const plannedDate = new Date(plannedStartAt);
    if (!isNaN(plannedDate.getTime()) && plannedDate > new Date()) {
      relaxedTimeFiltering = true;
      options.startTime = plannedDate;
    }
  }

  // ---------------- START LOCATION ----------------

  const startLat =
    typeof options.customStart?.lat === "number"
      ? options.customStart.lat
      : userLat;

  const startLon =
    typeof options.customStart?.lon === "number"
      ? options.customStart.lon
      : userLon;

  // ---------------- DISTANCE ----------------

  const tightness: "tight" | "medium" | "loose" = options.tightness ?? "medium";
  options.maxDistanceMeters =
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    CITY_DISTANCE_THRESHOLDS[city].medium;

  // ---------------- EVENTS ----------------

  const includeEvents = options.includeEvents ?? true;
  const eventOnly = options.eventOnly ?? false;

  let eventVenues: Venue[] = [];

  if (includeEvents || eventOnly) {
    try {
      const liveEvents = await fetchLiveEventsForCity(city);
      eventVenues = liveEvents.map((ev) => ({
        ...ev,
        type: ev.type ?? ["event"],
      }));
    } catch {
      // events are optional
    }
  }

  const mergedVenues = eventOnly
    ? eventVenues
    : Array.from(
        new Map([...venues, ...eventVenues].map((v) => [v.id, v])).values()
      );

  // ---------------- STAGES ----------------

  let normalizedStages =
    Array.isArray(stages) && stages.length > 0
      ? normalizeStages(stages)
      : [];

  // Guarantee at least one stage
  if (normalizedStages.length === 0) {
    normalizedStages = [{ type: ["activity"], tags: [], vibe: [] }];
  }

  // ---------------- EFFECTIVE TIER ----------------
  // clarify = constrain (low confidence, never blocking)

  const effectiveTier: "commit" | "constrain" =
    tier === "commit" && normalizedStages.length > 1
      ? "commit"
      : "constrain";

  // ---------------- TIER ENFORCEMENT ----------------

  if (effectiveTier === "constrain") {
    options.maxStops = 2;
  } else {
    options.maxStops = Math.min(6, normalizedStages.length);
  }

  // ---------------- ROUTE GENERATION ----------------

  let route: Venue[];

  try {
    route = await generateRoute(
      mergedVenues,
      startLat,
      startLon,
      {
        ...options,
        eventOnly,
        relaxedTimeFiltering,
        forceStageOrder: effectiveTier === "commit",
        disableStageInference: effectiveTier === "commit",
        confidenceTier: effectiveTier,
      },
      normalizedStages
    );
  } catch {
    return NextResponse.json(
      { error: "Route generation failed." },
      { status: 500 }
    );
  }

  // ---------------- GUARANTEES ----------------

  if (!route || route.length === 0) {
    return NextResponse.json(
      { error: "No viable route found." },
      { status: 422 }
    );
  }

  // If commit failed to fully satisfy, downgrade silently
  if (
    effectiveTier === "commit" &&
    route.length < Math.min(4, normalizedStages.length)
  ) {
    return NextResponse.json({
      route,
      tier: "constrain",
    });
  }

  // ---------------- SCHEDULING ----------------

  if (plannedStartAt && relaxedTimeFiltering) {
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) throw new Error("Missing auth");

      const token = authHeader.replace("Bearer ", "").trim();
      const supabase = supabaseRouteHandler(req);
      const { data: authData } = await supabase.auth.getUser(token);

      if (!authData?.user) throw new Error("Unauthorized");

      await supabase.from("scheduled_routes").insert({
        id: uuidv4(),
        user_id: authData.user.id,
        planned_start_at: new Date(plannedStartAt).toISOString(),
        route_data: route,
        status: "scheduled",
      });
    } catch {
      // non-blocking
    }
  }

  // ---------------- RESPONSE ----------------

  return NextResponse.json({
    route,
    tier: effectiveTier,
  });
}
