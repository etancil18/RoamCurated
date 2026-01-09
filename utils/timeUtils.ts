// utils/timeUtils.ts

import type { Venue } from "@/types/venue";

/** --------------------------------------------------
 * Helpers
 * -------------------------------------------------- */

export function _dayKey(d: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
}

export function _ranges(x: any): any[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/** --------------------------------------------------
 * Open hours resolution (future‑aware)
 * -------------------------------------------------- */

export function _intervalsForDate(
  d: Date,
  hours: Record<string, any>
): [Date, Date][] {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();

  const zero = new Date(y, m, day);
  zero.setHours(0, 0, 0, 0);

  const at = (h: number) => new Date(zero.getTime() + h * 3600 * 1000);
  const out: [Date, Date][] = [];

  // Same‑day intervals
  _ranges(hours[_dayKey(d)] || []).forEach((r: any) => {
    if (r?.open != null && r?.close != null) {
      out.push([at(r.open), at(r.close)]);
    }
  });

  // Previous‑day spillover (e.g. closes at 26 = 2am)
  const yst = new Date(zero);
  yst.setDate(zero.getDate() - 1);

  _ranges(hours[_dayKey(yst)] || []).forEach((r: any) => {
    if (r?.close > 24) {
      const yz = new Date(yst);
      yz.setHours(0, 0, 0, 0);

      out.push([
        new Date(yz.getTime() + r.open * 3600 * 1000),
        new Date(yz.getTime() + r.close * 3600 * 1000),
      ]);
    }
  });

  return out;
}

/** --------------------------------------------------
 * Daypart filtering — FUTURE‑SAFE
 * -------------------------------------------------- */

export function daypartAllowedAtTime(
  loc: { dayParts?: Record<string, string> | null },
  atTime: Date
): boolean {
  const dp =
    typeof loc.dayParts === "object" &&
    loc.dayParts !== null &&
    !Array.isArray(loc.dayParts)
      ? loc.dayParts[_dayKey(atTime)]
      : null;

  if (!dp || dp === "-") return true;

  const hour = atTime.getHours() + atTime.getMinutes() / 60;
  const letter = String(dp).toUpperCase();

  const windowByLetter: Record<string, [number, number]> = {
    M: [5, 12],     // Morning
    MD: [10, 15],   // Midday
    A: [12, 17],    // Afternoon
    HH: [16, 19],   // Happy Hour
    E: [17, 24],    // Evening
    L: [22, 28],    // Late night (→ 4am)
  };

  const w = windowByLetter[letter];
  if (!w) return true;

  const [start, end] = w;

  // Handles windows that pass midnight
  return end <= 24
    ? hour >= start && hour < end
    : hour >= start || hour < end - 24;
}

/** --------------------------------------------------
 * Venue open checks (future‑aware)
 * -------------------------------------------------- */

export function isVenueOpenNow(
  venue: Venue,
  atTime: Date = new Date()
): boolean {
  const intervals = _intervalsForDate(atTime, venue.hoursNumeric || {});
  return intervals.some(([open, close]) => atTime >= open && atTime < close);
}

export function isVenueOpenAtTime(
  venue: Venue,
  atTime: Date
): boolean {
  return isVenueOpenNow(venue, atTime);
}

export function isVenueOpenWithinWindow(
  venue: Venue,
  atTime: Date,
  windowMinutes: number
): boolean {
  const intervals = _intervalsForDate(atTime, venue.hoursNumeric || {});
  const windowEnd = new Date(atTime.getTime() + windowMinutes * 60 * 1000);

  return intervals.some(
    ([open]) => open >= atTime && open <= windowEnd
  );
}

/** --------------------------------------------------
 * ⚠️ Legacy compatibility (DO NOT USE FOR NEW CODE)
 * -------------------------------------------------- */

export function daypartAllowedForNow(
  loc: { dayParts?: Record<string, string> | null },
  now: Date
): boolean {
  // Delegate to future‑safe version
  return daypartAllowedAtTime(loc, now);
}
