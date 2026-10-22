
import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { generateThemeRoute, generateMultipleThemeRoutes } from "@/lib/theme-engine";
import { fetchLiveEventsForCity } from "@/lib/events/fetchLiveEvents";
import { resolveThemeVenues } from "@/lib/venues/resolveThemeVenues.server";
import type { Venue } from "@/types/venue";
import type { ThemeRouteOptions } from "@/lib/theme-engine/types";
import { CITY_CONFIGS } from "@/config/cities";

// Remove internal scoring metadata from venues returned to the browser.
// This does not modify the venue objects used by the theme engine.
function stripInternalScores(venue: Venue): Venue {
  const { _score, _eventBoost, ...publicVenue } = venue as Venue & {
    _eventBoost?: number;
  };

  return publicVenue as Venue;
}

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
      city?: "atl" | "nyc" | "lisbon" | "porto" | "london" | "la";
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
      (
        city !== "atl" &&
        city !== "nyc" &&
        city !== "lisbon" &&
        city !== "porto" &&
        city !== "london" &&
        city !== "la"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid city (must be atl, nyc, lisbon, porto, london, or la).",
        },
        { status: 400 }
      );
    }

    // Resolve browser-requested IDs against the canonical
    // server-owned venue dataset for the selected city.
    // All client-submitted venue attributes are discarded.
    const requestedVenueIds = venues
      .map((v) => v?.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const canonicalVenues = resolveThemeVenues(city, requestedVenueIds);

    if (canonicalVenues.length === 0) {
      return NextResponse.json(
        {
          error: "No recognized venues were found for the selected city.",
        },
        { status: 422 }
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
      const liveEvents = await fetchLiveEventsForCity(
        city,
        startTime?.toISO() ?? undefined
      );

      eventVenues = liveEvents.map((ev) => ({
        ...ev,
        type: ev.type ?? ["event"],
      }));
    }

    const allVenuesMap = new Map<string, Venue>();
    canonicalVenues.forEach((v) => allVenuesMap.set(v.id, v));
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
      tightness,
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
      route: route.map(stripInternalScores),
      alternatives: altRoutes.map((alternative) =>
        alternative.map(stripInternalScores)
      ),
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
