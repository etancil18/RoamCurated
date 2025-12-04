import { NextRequest, NextResponse } from "next/server";
import { generateRoute } from "@/lib/routeEngine";
import { fetchLiveEventsForCity } from "@/lib/events/fetchLiveEvents";
import type { Venue } from "@/types/venue";

/**
 * Map frontend-friendly route “tightness” → backend max allowable distance between stops.
 * Units: meters
 */
const CITY_DISTANCE_THRESHOLDS = {
  atl: {
    tight: 1000,
    medium: 2500,
    loose: 4500,
  },
  nyc: {
    tight: 750,
    medium: 1400,
    loose: 2100,
  },
};

export async function POST(req: NextRequest) {
  let body: any;

  try {
    body = await req.json();
  } catch (err) {
    console.warn("⚠️ Invalid JSON in request body:", err);
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const { venues, options = {}, userLat, userLon, city } = body as {
    venues: Venue[];
    options?: Record<string, any>;
    userLat: number;
    userLon: number;
    city?: "atl" | "nyc";
  };

  /** ----------------------- Validation ----------------------- **/
  if (!Array.isArray(venues) || venues.length === 0) {
    return NextResponse.json({ error: "Venues must be a non-empty array." }, { status: 400 });
  }

  if (
    typeof userLat !== "number" ||
    typeof userLon !== "number" ||
    isNaN(userLat) ||
    isNaN(userLon)
  ) {
    return NextResponse.json({ error: "Invalid or missing user location." }, { status: 400 });
  }

  if (!city || (city !== "atl" && city !== "nyc")) {
    return NextResponse.json({ error: "Missing or invalid city." }, { status: 400 });
  }

  if (options.startTime) {
    options.startTime = new Date(options.startTime);
  }

  /** ----------------------- Custom Start ----------------------- **/
  const customLat = options.customStart?.lat;
  const customLon = options.customStart?.lon;
  const customValid =
    typeof customLat === "number" &&
    typeof customLon === "number" &&
    !isNaN(customLat) &&
    !isNaN(customLon);

  const startLat = customValid ? customLat : userLat;
  const startLon = customValid ? customLon : userLon;

  if (customValid) {
    console.log("📍 Using custom start point:", startLat, startLon);
  }

  /** ----------------------- Distance Threshold Logic ----------------------- **/
  const tightness: "tight" | "medium" | "loose" = options.tightness ?? "medium";
  const maxDistanceMeters =
    CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
    CITY_DISTANCE_THRESHOLDS[city].medium;
  options.maxDistanceMeters = maxDistanceMeters;

  /** ----------------------- Event Logic Flags ----------------------- **/
  const includeEvents = options.includeEvents ?? true;
  const eventOnly = options.eventOnly ?? false;

  /** ----------------------- Fetch & Merge Venues ----------------------- **/
  let eventVenues: Venue[] = [];

  if (includeEvents || eventOnly) {
    const liveEvents = await fetchLiveEventsForCity(city);
    eventVenues = liveEvents.map((ev) => ({
      ...ev,
      type: ev.type || ["event"],
    }));
  }

  let mergedVenues: Venue[];

  if (eventOnly) {
    mergedVenues = eventVenues;
  } else {
    const allVenuesMap = new Map<string, Venue>();
    venues.forEach((v) => allVenuesMap.set(v.id, v));
    eventVenues.forEach((ev) => allVenuesMap.set(ev.id, ev));
    mergedVenues = Array.from(allVenuesMap.values());
  }

  /** ----------------------- Logs ----------------------- **/
  console.log("🧪 Route generation input:", {
    venueCount: mergedVenues.length,
    eventCount: eventVenues.length,
    startLat,
    startLon,
    city,
    options,
  });

  /** ----------------------- Generate Route ----------------------- **/
  try {
    const t0 = performance.now();
    const route = await generateRoute(mergedVenues, startLat, startLon, {
      ...options,
      eventOnly,
    });
    const duration = performance.now() - t0;
    console.log(`✅ Route generated in ${duration.toFixed(1)}ms with ${route.length} stops`);
    return NextResponse.json({ route });
  } catch (err) {
    console.error("❌ Route generation failed:", err);
    return NextResponse.json({ error: "Route generation failed." }, { status: 500 });
  }
}
