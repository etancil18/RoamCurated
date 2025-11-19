import { NextRequest, NextResponse } from "next/server";
import { generateRoute } from "@/lib/routeEngine";
import type { Venue } from "@/types/venue";

/**
 * Map frontend-friendly route “tightness” → backend max allowable distance between stops.
 * Units: meters
 */
const CITY_DISTANCE_THRESHOLDS = {
  atl: {
    tight: 1000,       // walkable cluster
    medium: 2500,     // balanced
    loose: 4500,      // explore more
  },
  nyc: {
    tight: 750,       // walkable (NYC is denser)
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
    typeof userLat !== "number" || typeof userLon !== "number" ||
    isNaN(userLat) || isNaN(userLon)
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

  options.maxDistanceMeters = maxDistanceMeters; // Pass to route engine

  console.log("📏 Tightness:", tightness);
  console.log("📏 Max distance per hop (m):", maxDistanceMeters);

  /** ----------------------- Logs ----------------------- **/

  console.log("🧪 Route generation input:", {
    venueCount: venues.length,
    startLat,
    startLon,
    city,
    options,
  });

  /** ----------------------- Try Generating Route ----------------------- **/

  try {
    const t0 = performance.now();

    const route = await generateRoute(venues, startLat, startLon, options);

    const duration = performance.now() - t0;

    console.log(`✅ Route generated in ${duration.toFixed(1)}ms with ${route.length} stops`);

    return NextResponse.json({ route });
  } catch (err) {
    console.error("❌ Route generation failed:", err);
    return NextResponse.json({ error: "Route generation failed." }, { status: 500 });
  }
}
