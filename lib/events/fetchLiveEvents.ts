import { supabaseServerApi } from "@/lib/supabase/server-api";
import type { Venue, DateEvent } from "@/types/venue";

type EventRecord = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  source_type: string | null;
  venue_id: string;
  venue: Venue;
};

/**
 * Fetch upcoming live events for the given city,
 * and return them as enriched Venue objects for crawl logic.
 */
export async function fetchLiveEventsForCity(
  city: "atl" | "nyc" | "lisbon" | "porto" | "london" | "la"
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
      starts_at,
      ends_at,
      source_type,
      venue_id,
      venue:venue_id!inner (
        id,
        name,
        lat,
        lon,
        slug,
        vibe,
        type,
        tags,
        cover,
        instagram_handle,
        city,
        timeCategory:time_category,
        energyRamp:energy_ramp,
        price,
        duration
      )
    `
    )
    .eq("venue.city", city)
    .or("source_type.is.null,source_type.neq.community_signal")
    .gte("starts_at", nowISO)
    .order("starts_at", { ascending: true });

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
        date: rec.starts_at,
        title: rec.title,
        time: new Date(rec.starts_at).toLocaleTimeString([], {
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
        eventCategory: undefined,
        starts_at: rec.starts_at,
        ends_at: rec.ends_at ?? undefined,
      };

      return enriched;
    });

  return events;
}