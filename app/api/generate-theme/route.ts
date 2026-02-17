import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { generateThemeRoute, generateMultipleThemeRoutes } from "@/lib/theme-engine";
import { fetchLiveEventsForCity } from "@/lib/events/fetchLiveEvents";
import type { Venue } from "@/types/venue";
import type { ThemeRouteOptions } from "@/lib/theme-engine/types";
import { CITY_CONFIGS } from "@/config/cities";

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
      city?: "atl" | "nyc" | "lisbon" | "porto";
      plannedStartAt?: string;
    };

    if (!themeId || typeof themeId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid themeId" },
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

    if (
      !city ||
      (city !== "atl" &&
        city !== "nyc" &&
        city !== "lisbon" &&
        city !== "porto")
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid city (must be atl, nyc, lisbon, or porto).",
        },
        { status: 400 }
      );
    }

    const timezone = CITY_CONFIGS[city].timezone;

    const plannedStartAt =
      plannedStartAtTop ?? options.plannedStartAt ?? null;

    let startTime: DateTime | undefined;
    let relaxedTimeFiltering = true;

    if (plannedStartAt) {
      const parsed = DateTime.fromISO(plannedStartAt, {
        zone: timezone,
      });

      if (parsed.isValid) {
        startTime = parsed;

        if (parsed > DateTime.now().setZone(timezone)) {
          relaxedTimeFiltering = true;
        }
      }
    }

    const tightness: "tight" | "medium" | "loose" =
      options.tightness ?? "medium";

    const maxDistanceMeters = options.maxDistanceMeters ?? undefined;

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

    const allVenuesMap = new Map<string, Venue>();
    venues.forEach((v) => allVenuesMap.set(v.id, v));
    eventVenues.forEach((ev) => allVenuesMap.set(ev.id, ev));
    const mergedVenues = Array.from(allVenuesMap.values());

    const routeOptions: ThemeRouteOptions = {
      themeId,
      venues: mergedVenues,
      userLat: originLat,
      userLon: originLon,
      maxStops: options.maxStops ?? 6,
      filterOpen: options.filterOpen ?? true,
      maxDistanceMeters,
      eventOnly,
      city,
      startTime,
      relaxedTimeFiltering,
    };

    const route = await generateThemeRoute(routeOptions);
    const altRoutes = await generateMultipleThemeRoutes(routeOptions);

    if (!route || route.length === 0) {
      return NextResponse.json(
        {
          error: "No viable route could be generated.",
          reason:
            "This sometimes happens when places matching your theme aren’t open at the time you picked, or your filters are too specific. Try adjusting the crawl time, loosening filters, or picking a different theme to explore more options.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      route,
      alternatives: altRoutes,
      fallbackUsed: false,
      plannedStartAt: startTime?.toISO() ?? null,
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

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}