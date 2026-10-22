
import "server-only";

import type { Venue } from "@/types/venue";
import { normalizeRawVenue } from "@/lib/venues/normalizeVenue";

import atlantaData from "@/data/atlanta";
import nycData from "@/data/nyc";
import portoData from "@/data/porto";
import lisbonData from "@/data/lisbon";
import londonData from "@/data/london";
import losAngelesData from "@/data/losangeles";

export type ThemeCity =
  | "atl"
  | "nyc"
  | "porto"
  | "lisbon"
  | "london"
  | "la";

const RAW_CITY_DATA: Record<ThemeCity, readonly unknown[]> = {
  atl: atlantaData,
  nyc: nycData,
  porto: portoData,
  lisbon: lisbonData,
  london: londonData,
  la: losAngelesData,
};

// Cache normalized, canonical records per server process.
// No request-specific or user-specific data enters this cache.
const venueIndexCache = new Map<
  ThemeCity,
  Map<string, Venue>
>();

function getVenueIndex(city: ThemeCity): Map<string, Venue> {
  const cached = venueIndexCache.get(city);

  if (cached) {
    return cached;
  }

  const index = new Map<string, Venue>();

  for (const raw of RAW_CITY_DATA[city]) {
    const venue = normalizeRawVenue(raw, { city });

    if (!venue || typeof venue.id !== "string" || !venue.id) {
      continue;
    }

    // Canonical data comes only from the server-owned dataset.
    index.set(venue.id, venue);
  }

  venueIndexCache.set(city, index);

  return index;
}

/**
 * Resolve caller-requested venue IDs into authoritative
 * server-owned Venue records.
 *
 * Never merges any client-submitted venue attributes.
 * Unknown IDs and IDs from other cities are ignored.
 */
export function resolveThemeVenues(
  city: ThemeCity,
  requestedIds: readonly string[]
): Venue[] {
  const index = getVenueIndex(city);
  const seen = new Set<string>();
  const resolved: Venue[] = [];

  for (const id of requestedIds) {
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);

    const canonical = index.get(id);

    if (canonical) {
      resolved.push({ ...canonical });
    }
  }

  return resolved;
}
