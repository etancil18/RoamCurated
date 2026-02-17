import type { Venue } from "@/types/venue";
import { DateTime } from "luxon";

/** --------------------------------------------------
 * Helpers
 * -------------------------------------------------- */

export function _dayKey(d: DateTime): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.weekday % 7];
}

export function _ranges(x: any): any[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/** --------------------------------------------------
 * Open hours resolution (FULLY TZ-SAFE — Luxon native)
 * -------------------------------------------------- */

export function _intervalsForDate(
  atTime: DateTime,
  hours: Record<string, any>
): [DateTime, DateTime][] {

  const startOfDay = atTime.startOf("day");
  const out: [DateTime, DateTime][] = [];

  const at = (h: number) =>
    startOfDay.plus({ hours: h });

  // Same-day intervals
  _ranges(hours[_dayKey(atTime)] || []).forEach((r: any) => {
    if (r?.open != null && r?.close != null) {
      out.push([
        at(r.open),
        at(r.close),
      ]);
    }
  });

  // Previous-day spillover (e.g. closes at 26 = 2am)
  const yesterday = atTime.minus({ days: 1 });
  const startOfYesterday = yesterday.startOf("day");

  _ranges(hours[_dayKey(yesterday)] || []).forEach((r: any) => {
    if (r?.close > 24) {
      out.push([
        startOfYesterday.plus({ hours: r.open }),
        startOfYesterday.plus({ hours: r.close }),
      ]);
    }
  });

  return out;
}

/** --------------------------------------------------
 * Daypart filtering — FUTURE-SAFE (Luxon)
 * -------------------------------------------------- */

export function daypartAllowedAtTime(
  loc: { dayParts?: Record<string, string> | null },
  atTime: DateTime
): boolean {

  const dp =
    typeof loc.dayParts === "object" &&
    loc.dayParts !== null &&
    !Array.isArray(loc.dayParts)
      ? loc.dayParts[_dayKey(atTime)]
      : null;

  if (!dp || dp === "-") return true;

  const hour = atTime.hour + atTime.minute / 60;
  const letter = String(dp).toUpperCase();

  const windowByLetter: Record<string, [number, number]> = {
    M: [5, 12],
    MD: [10, 15],
    A: [12, 17],
    HH: [16, 19],
    E: [17, 24],
    L: [22, 28],
  };

  const w = windowByLetter[letter];
  if (!w) return true;

  const [start, end] = w;

  return end <= 24
    ? hour >= start && hour < end
    : hour >= start || hour < end - 24;
}

/** --------------------------------------------------
 * Venue open checks (STRICT LUXON INJECTION)
 * -------------------------------------------------- */

/**
 * Canonical open check.
 * Must pass Luxon DateTime.
 */
export function isVenueOpenNow(
  venue: Venue,
  atTime: DateTime
): boolean {
  const intervals = _intervalsForDate(atTime, venue.hoursNumeric || {});
  return intervals.some(
    ([open, close]) => atTime >= open && atTime < close
  );
}

export function isVenueOpenAtTime(
  venue: Venue,
  atTime: DateTime
): boolean {
  return isVenueOpenNow(venue, atTime);
}

export function isVenueOpenWithinWindow(
  venue: Venue,
  atTime: DateTime,
  windowMinutes: number
): boolean {

  const intervals = _intervalsForDate(atTime, venue.hoursNumeric || {});
  const windowEnd = atTime.plus({ minutes: windowMinutes });

  return intervals.some(
    ([open]) => open >= atTime && open <= windowEnd
  );
}

/** --------------------------------------------------
 * ⚠️ Legacy compatibility (avoid new usage)
 * -------------------------------------------------- */

export function daypartAllowedForNow(
  loc: { dayParts?: Record<string, string> | null },
  now: DateTime
): boolean {
  return daypartAllowedAtTime(loc, now);
}