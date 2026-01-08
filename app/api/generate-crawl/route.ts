import { NextRequest, NextResponse } from "next/server";
import { generateRoute } from "@/lib/routeEngine";
import { fetchLiveEventsForCity } from "@/lib/events/fetchLiveEvents";
import type { Venue } from "@/types/venue";
import { v4 as uuidv4 } from "uuid";
import { supabaseRouteHandler } from "@/lib/supabase/route-handler";

/**
 * Map frontend-friendly route “tightness” → backend max allowable distance between stops.
 * Units: meters
 */
const CITY_DISTANCE_THRESHOLDS = {
  atl: { tight: 1000, medium: 2500, loose: 4500 },
  nyc: { tight: 750, medium: 1400, loose: 2100 },
};

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
    plannedStartAt, // ⬅️ scheduling signal
  } = body as {
    venues: Venue[];
    options?: Record<string, any>;
    userLat: number;
    userLon: number;
    city?: "atl" | "nyc";
    plannedStartAt?: string;
  };

  /** ---------------- Validation ---------------- **/
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

  /** ---------------- Planned Start / Relaxed Mode ---------------- **/
  let relaxedTimeFiltering = false;

  if (plannedStartAt) {
    const plannedDate = new Date(plannedStartAt);
    if (!isNaN(plannedDate.getTime()) && plannedDate > new Date()) {
      relaxedTimeFiltering = true;
      options.startTime = plannedDate;
    }
  }

  /** ---------------- Custom Start ---------------- **/
  const customLat = options.customStart?.lat;
  const customLon = options.customStart?.lon;

  const startLat =
    typeof customLat === "number" && !isNaN(customLat) ? customLat : userLat;
  const startLon =
    typeof customLon === "number" && !isNaN(customLon) ? customLon : userLon;

  /** ---------------- Distance Threshold ---------------- **/
  const tightness: "tight" | "medium" | "loose" = options.tightness ?? "medium";
  options.maxDistanceMeters =
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    CITY_DISTANCE_THRESHOLDS[city].medium;

  /** ---------------- Events ---------------- **/
  const includeEvents = options.includeEvents ?? true;
  const eventOnly = options.eventOnly ?? false;

  let eventVenues: Venue[] = [];

  if (includeEvents || eventOnly) {
    const liveEvents = await fetchLiveEventsForCity(city);
    eventVenues = liveEvents.map((ev) => ({
      ...ev,
      type: ev.type ?? ["event"],
    }));
  }

  const mergedVenues = eventOnly
    ? eventVenues
    : Array.from(
        new Map([...venues, ...eventVenues].map((v) => [v.id, v])).values()
      );

  /** ---------------- Debug Input ---------------- **/
  console.log("🧠 Manual crawl input", {
    city,
    venueCount: mergedVenues.length,
    relaxedTimeFiltering,
    plannedStartAt: plannedStartAt ?? null,
    maxDistanceMeters: options.maxDistanceMeters,
  });

  /** ---------------- Generate Route ---------------- **/
  let route: Venue[];

  try {
    route = await generateRoute(mergedVenues, startLat, startLon, {
      ...options,
      eventOnly,
      relaxedTimeFiltering, // 🔑 critical fix
    });
  } catch (err) {
    console.error("❌ Route generation failed:", err);
    return NextResponse.json(
      { error: "Route generation failed." },
      { status: 500 }
    );
  }

  if (!route || route.length === 0) {
    return NextResponse.json(
      {
        error: "No viable route found.",
        reason: "Filtering too strict or venue pool too small.",
      },
      { status: 422 }
    );
  }

  /** --------------------------------------------------
   * ✅ SCHEDULED ROUTE SAVE (FUTURE ONLY)
   * -------------------------------------------------- */
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
      // must never break route generation
      console.error("❌ Scheduled crawl save failed:", err);
    }
  }

  /** ---------------- Response ---------------- **/
  return NextResponse.json({ route });
}
