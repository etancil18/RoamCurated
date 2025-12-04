import { supabaseServerApi } from "@/lib/supabase/server-api";
import type { Venue, DateEvent } from "@/types/venue";

type EventRecord = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  category: string | null;
  venue_id: string;
  venue: Venue;
};

/**
 * Fetch upcoming live events for the given city,
 * and return them as enriched Venue objects for crawl logic.
 */
export async function fetchLiveEventsForCity(
  city: "atl" | "nyc"
): Promise<Venue[]> {
  const supabase = await supabaseServerApi();

  const now = new Date();
  const nowISO = now.toISOString();

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      start_time,
      end_time,
      category,
      venue_id,
      venue:venue_id (
        id,
        name,
        lat,
        lon,
        link,
        slug,
        vibe,
        type,
        tags,
        cover,
        instagram_handle,
        city,
        neighborhood,
        hoursNumeric,
        dayParts,
        timeCategory,
        energyRamp,
        price,
        duration
      )
    `
    )
    .eq("city", city)
    .gte("start_time", nowISO)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("❌ Failed to fetch live events:", error);
    return [];
  }
  if (!data) return [];

  // Transform results, filter out invalid venues, and enrich for crawl logic
  const events = (data as unknown as EventRecord[])
    .filter(
      (rec): rec is EventRecord =>
        !!rec.venue &&
        typeof rec.venue.lat === "number" &&
        typeof rec.venue.lon === "number"
    )
    .map((rec) => {
      const v = rec.venue;

      // Format date/time for UI or downstream use
      const eventDate: DateEvent = {
        date: rec.start_time,
        title: rec.title,
        time: new Date(rec.start_time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const enriched: Venue = {
        ...v,
        id: `event-${rec.id}`, // Ensure ID uniqueness
        name: `${rec.title} @ ${v.name}`,
        duration: v.duration ?? 1,
        dateEvents: [eventDate],
        _has_upcoming_events: true,

        // Mark event metadata
        liveEvent: true,
        event_id: rec.id,
        eventCategory: rec.category ?? undefined,
        starts_at: rec.start_time,
        ends_at: rec.end_time ?? undefined,
      };

      return enriched;
    });

  return events;
}
