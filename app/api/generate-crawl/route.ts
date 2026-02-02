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

export async function POST(req: NextRequest) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    console.error("❌ JSON parsing error in request body");
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
  } = body as {
    venues: Venue[];
    options?: Record<string, any>;
    userLat: number;
    userLon: number;
    city?: "atl" | "nyc";
    plannedStartAt?: string;
    stages?: any[];
  };

  if (!Array.isArray(venues) || venues.length === 0) {
    console.warn("❌ No venues provided in request");
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
    console.warn("❌ Invalid or missing user coordinates");
    return NextResponse.json(
      { error: "Invalid or missing user location." },
      { status: 400 }
    );
  }

  if (!city || (city !== "atl" && city !== "nyc")) {
    console.warn("❌ Invalid or missing city");
    return NextResponse.json(
      { error: "Missing or invalid city." },
      { status: 400 }
    );
  }

  console.log(`📦 Received ${venues.length} venues`);

  let relaxedTimeFiltering = false;

  if (plannedStartAt) {
    const plannedDate = new Date(plannedStartAt);
    if (!isNaN(plannedDate.getTime()) && plannedDate > new Date()) {
      relaxedTimeFiltering = true;
      options.startTime = plannedDate;
    }
  }

  const startLat =
    typeof options.customStart?.lat === "number"
      ? options.customStart.lat
      : userLat;

  const startLon =
    typeof options.customStart?.lon === "number"
      ? options.customStart.lon
      : userLon;

  const tightness: "tight" | "medium" | "loose" = options.tightness ?? "medium";
  options.maxDistanceMeters =
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    CITY_DISTANCE_THRESHOLDS[city].medium;

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
      console.log(`🎟️  Loaded ${eventVenues.length} event venues`);
    } catch (err) {
      console.warn("⚠️ Failed to fetch live events", err);
    }
  }

  const mergedVenues = eventOnly
    ? eventVenues
    : Array.from(
        new Map([...venues, ...eventVenues].map((v) => [v.id, v])).values()
      );

  console.log(`📊 Final venue pool: ${mergedVenues.length} venues`);

  const finalStages =
    Array.isArray(stages) && stages.length > 0
      ? normalizeStages(stages)
      : undefined;

  const hasValidStages =
    Array.isArray(finalStages) &&
    finalStages.some((s) => Array.isArray(s.type) && s.type.length > 0);

  console.log("🎯 Using stages in crawl:", hasValidStages ? finalStages : "NONE (manual fallback)");
  if (hasValidStages && finalStages) {
    finalStages.forEach((stage, idx) => {
      console.log(`🔎 Stage ${idx}:`, stage);
    });
  }

  let route: Venue[];

  try {
    console.log("⚙️ Starting route generation with options:", {
      ...options,
      eventOnly,
      relaxedTimeFiltering,
      forceStageOrder: hasValidStages,
      disableStageInference: hasValidStages,
      stages: finalStages,
    });

    route = await generateRoute(
      mergedVenues,
      startLat,
      startLon,
      {
        ...options,
        eventOnly,
        relaxedTimeFiltering,
        forceStageOrder: hasValidStages,
        disableStageInference: hasValidStages,
      },
      hasValidStages ? finalStages : undefined
    );
  } catch (err) {
    console.error("❌ Route generation failed:", err);
    return NextResponse.json(
      { error: "Route generation failed." },
      { status: 500 }
    );
  }

  if (!route || route.length === 0) {
    console.warn("🛑 No viable route found");
    return NextResponse.json(
      {
        error: "No viable route found.",
        reason: hasValidStages
          ? "AI stages too strict or no matching venues."
          : "Filtering too strict or venue pool too small.",
      },
      { status: 422 }
    );
  }

  console.log(`✅ Route generated with ${route.length} stops`);

  if (plannedStartAt && relaxedTimeFiltering) {
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) throw new Error("Missing auth header");

      const token = authHeader.replace("Bearer ", "").trim();
      const supabase = supabaseRouteHandler(req);
      const { data: authData, error: authError } =
        await supabase.auth.getUser(token);

      if (authError || !authData?.user) throw new Error("Unauthorized");

      await supabase.from("scheduled_routes").insert({
        id: uuidv4(),
        user_id: authData.user.id,
        planned_start_at: new Date(plannedStartAt).toISOString(),
        route_data: route,
        status: "scheduled",
      });

      console.log("📅 Scheduled crawl saved:", plannedStartAt);
    } catch (err) {
      console.error("❌ Scheduled crawl save failed:", err);
    }
  }

  return NextResponse.json({ route });
}
