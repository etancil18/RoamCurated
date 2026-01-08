import { NextRequest, NextResponse } from "next/server";
import { themeById } from "@/lib/crawlConfig";
import { generateThemeRoute } from "@/lib/theme-engine";
import { fetchLiveEventsForCity } from "@/lib/events/fetchLiveEvents";
import type { Venue } from "@/types/venue";
import type { ThemeRouteOptions } from "@/lib/theme-engine/types";

/**
 * Per‑city distance thresholds for “tightness”
 */
const CITY_DISTANCE_THRESHOLDS = {
  atl: { tight: 1200, medium: 2500, loose: 4500 },
  nyc: { tight: 850, medium: 1500, loose: 2100 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      themeId,
      venues,
      userLat,
      userLon,
      options = {},
      city,
      plannedStartAt: plannedStartAtTop,
    } = body as {
      themeId: string;
      venues: Venue[];
      userLat: number;
      userLon: number;
      options?: Record<string, any>;
      city?: "atl" | "nyc";
      plannedStartAt?: string;
    };

    /** ------------------ Validation ------------------ **/
    if (!themeId || typeof themeId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid themeId" },
        { status: 400 }
      );
    }

    const theme = themeById[themeId];
    if (!theme) {
      return NextResponse.json(
        { error: `Theme not found: ${themeId}` },
        { status: 404 }
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
        { error: "Missing or invalid city (must be atl or nyc)." },
        { status: 400 }
      );
    }

    /** ------------------ Planned Start / Relaxed Mode ------------------ **/
    const plannedStartAt =
      plannedStartAtTop ?? options.plannedStartAt ?? null;

    let startTime: Date | undefined;
    let relaxedTimeFiltering = false;

    if (plannedStartAt) {
      const parsed = new Date(plannedStartAt);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid plannedStartAt format" },
          { status: 400 }
        );
      }

      startTime = parsed;
      if (parsed > new Date()) {
        relaxedTimeFiltering = true;
      }
    }

    /** ------------------ Tightness → Max Distance ------------------ **/
    const tightness: "tight" | "medium" | "loose" = options.tightness ?? "medium";
    const maxDistanceMeters =
      CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
      CITY_DISTANCE_THRESHOLDS[city].medium;

    /** ------------------ Custom Start Logic ------------------ **/
    const customLat = options.customStart?.lat;
    const customLon = options.customStart?.lon;

    const originLat =
      typeof customLat === "number" && !isNaN(customLat)
        ? customLat
        : userLat;

    const originLon =
      typeof customLon === "number" && !isNaN(customLon)
        ? customLon
        : userLon;

    /** ------------------ Event Logic ------------------ **/
    const includeEvents: boolean = options.includeEvents ?? true;
    const eventOnly: boolean = options.eventOnly ?? false;

    let eventVenues: Venue[] = [];
    if (includeEvents || eventOnly) {
      const liveEvents = await fetchLiveEventsForCity(city);
      eventVenues = liveEvents.map((ev) => ({
        ...ev,
        type: ev.type ?? ["event"],
      }));
    }

    /** ------------------ Merge Venues ------------------ **/
    const allVenuesMap = new Map<string, Venue>();
    venues.forEach((v) => allVenuesMap.set(v.id, v));
    eventVenues.forEach((ev) => allVenuesMap.set(ev.id, ev));
    const mergedVenues = Array.from(allVenuesMap.values());

    /** ------------------ Debug Log ------------------ **/
    console.log("🎨 Theme crawl input", {
      theme: theme.name,
      city,
      totalVenues: mergedVenues.length,
      eventCount: eventVenues.length,
      plannedStartAt,
      relaxedTimeFiltering,
      maxDistanceMeters,
    });

    /** ------------------ Build Route Options ------------------ **/
    const routeOptions: ThemeRouteOptions = {
      themeId,
      venues: mergedVenues,
      userLat: originLat,
      userLon: originLon,
      maxStops: options.maxStops ?? 6,
      filterOpen: options.filterOpen ?? true,
      maxDistanceMeters,
      eventOnly,
      startTime,
      relaxedTimeFiltering, // 🔑 critical fix
    };

    /** ------------------ Primary Route ------------------ **/
    const route = await generateThemeRoute(routeOptions);

    if (!route || route.length === 0) {
      const fallbackRoute = await generateThemeRoute({
        ...routeOptions,
        filterOpen: false,
      });

      if (!fallbackRoute || fallbackRoute.length === 0) {
        return NextResponse.json(
          {
            error: "No viable route could be generated.",
            reason: "Theme filters too strict or venues unavailable at selected time.",
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        route: fallbackRoute,
        fallbackUsed: true,
        plannedStartAt: startTime?.toISOString() ?? null,
      });
    }

    return NextResponse.json({
      route,
      fallbackUsed: false,
      plannedStartAt: startTime?.toISOString() ?? null,
    });
  } catch (err: any) {
    console.error("❌ Theme route generation failed:", err);
    return NextResponse.json(
      {
        error: "Route generation failed.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
