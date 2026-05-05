// lib/outings/sequenceScoring/temporal.ts

import type { PlanningContext, PlanningSlot, StopRole, VenueRecord } from "../types"
import type {
  RoleCompatibleVenue,
  VenueHoursEntry,
  VenueWithHours,
} from "./types"
import {
  hasAnyType,
  normalizeVenueHours,
  normalizeVenueTypes,
} from "./helpers"
import {
  addMinutes,
  getDayKey,
  getHourFractionInTimeZone,
  getLocalMinutesInDay,
  getPreviousDayKey,
} from "./time"
import {
  isLateNightAfterFallbackContext,
  isLateNightNightlifeType,
} from "./lateNight"
import { pickRoleForSlot } from "./roles"

const LATE_NIGHT_MIN_VIABLE_WINDOW_MINUTES = 12
const DINNER_MINIMUM_LOCAL_HOUR = 17.5

type RawVenueHoursEntry = VenueHoursEntry & {
  open1?: string | null
  close1?: string | null
  open2?: string | null
  close2?: string | null
}

type RawVenueHoursRecord = Record<string, RawVenueHoursEntry>

export function isVenueTemporallyEligible(
  venue: RoleCompatibleVenue & VenueRecord,
  role: StopRole,
  arrival: Date,
  departure: Date,
  phase: "before" | "after",
  timeZone: string,
  relaxed = false
): boolean {
  if (!isRoleTemporallyCompatible(venue, role, arrival, phase, timeZone, relaxed)) {
    return false
  }

  const minimumOpenUntil =
    phase === "after" ? addMinutes(arrival, relaxed ? 60 : 90) : departure

  return isVenueOpenForWindow(
    venue as VenueWithHours,
    arrival,
    minimumOpenUntil,
    timeZone,
    relaxed
  )
}

export function isRoleTemporallyCompatible(
  venue: Pick<VenueRecord, "type">,
  role: StopRole,
  arrival: Date,
  phase: "before" | "after",
  timeZone: string,
  relaxed = false
): boolean {
  const hour = getHourFractionInTimeZone(arrival, timeZone)
  const types = normalizeVenueTypes(venue.type)

  const isBeforeDinnerMinimum =
    phase === "before" && hour < DINNER_MINIMUM_LOCAL_HOUR
  const hasDinnerType = hasAnyType(types, ["dinner"])
  const hasDinnerHybridType = hasAnyType(types, [
    "cocktail",
    "bar",
    "wine bar",
    "lounge",
  ])
  const hasEarlyDinnerFallbackDrinkType = hasAnyType(types, [
    "cocktail",
    "wine bar",
  ])

  if (
    isBeforeDinnerMinimum &&
    role === "food" &&
    hasDinnerType &&
    !hasDinnerHybridType
  ) {
    return false
  }

  if (
    isBeforeDinnerMinimum &&
    role === "drink" &&
    !relaxed &&
    hasAnyType(types, ["club", "sports bar", "speakeasy"]) &&
    !hasEarlyDinnerFallbackDrinkType
  ) {
    return false
  }

  if (hasAnyType(types, ["breakfast"])) {
    return hour >= 6 && hour <= (relaxed ? 12.5 : 11.5)
  }

  if (hasAnyType(types, ["lunch"])) {
    if (relaxed) return hour >= 10.5 && hour <= 17.5
    return hour >= 11 && hour <= 15.5
  }

  if (hasDinnerType) {
    return hour >= (relaxed ? 15.5 : 16.5)
  }

  if (hasAnyType(types, ["brunch"])) {
    return hour >= 9 && hour <= (relaxed ? 14 : 13.5)
  }

  if (hasAnyType(types, ["coffee", "cafe", "café", "tea"])) {
    if (!relaxed && phase !== "before" && hour >= 18) return false
    return hour >= 6 && hour <= (relaxed ? 19 : 18)
  }

  if (hasAnyType(types, ["bakery"])) {
    if (relaxed) return hour >= 7 && hour <= 14
    return hour >= 7 && hour <= 12.5
  }

  if (hasAnyType(types, ["dessert"])) {
    return hour >= 12
  }

  if (hasAnyType(types, ["gallery", "museum", "bookstore", "library"])) {
    return hour >= 10 && hour <= (relaxed ? 21 : 20)
  }

  if (hasAnyType(types, ["wellness", "yoga", "pilates"])) {
    return hour >= 6 && hour <= (relaxed ? 13.5 : 12.5)
  }

  if (
    hasAnyType(types, [
      "bar",
      "sports bar",
      "cocktail",
      "lounge",
      "speakeasy",
      "club",
      "brewery",
      "rooftop",
      "wine bar",
    ])
  ) {
    return hour >= (relaxed ? 14 : 15) || hour <= 4
  }

  if (!relaxed && role === "coffee" && hour >= 18) return false

  if (role === "food") {
    if (hour < (relaxed ? 8 : 9)) return false

    const isMorningFoodLike = hasAnyType(types, [
      "breakfast",
      "brunch",
      "bakery",
      "cafe",
      "café",
      "coffee",
      "tea",
      "juice",
      "matcha",
    ])

    if (!relaxed && hour < 11 && !isMorningFoodLike) {
      return false
    }
  }

  if (role === "activity") {
    const isMorningWellnessLike = hasAnyType(types, ["wellness", "yoga", "pilates"])

    if (isMorningWellnessLike) {
      return hour >= 6 && hour <= (relaxed ? 13.5 : 12.5)
    }
  }

  if (role === "drink" && hour < (relaxed ? 13 : 14)) return false

  return true
}

export function computeTemporalFitPenalty(
  venue: Pick<VenueRecord, "type">,
  role: StopRole,
  arrival: Date,
  phase: "before" | "after",
  timeZone: string
): number {
  const hour = getHourFractionInTimeZone(arrival, timeZone)
  const types = normalizeVenueTypes(venue.type)

  let penalty = 0

  if (hasAnyType(types, ["breakfast"]) && hour > 12) penalty += 12
  if (hasAnyType(types, ["brunch"]) && hour > 14) penalty += 10
  if (hasAnyType(types, ["lunch"]) && hour > 16.5) penalty += 8

  if (hasAnyType(types, ["dinner"]) && hour < DINNER_MINIMUM_LOCAL_HOUR) {
    const hybrid = hasAnyType(types, ["cocktail", "bar", "wine bar", "lounge"])
    penalty += hybrid ? 3 : 14
  }

  if (hasAnyType(types, ["bakery"]) && hour > 12.5) {
    penalty += hour > 17 ? 18 : 8
  }

  if (role === "coffee" && hour >= 18) penalty += 10
  if (role === "drink" && hour < 14) penalty += 8

  if (
    hasAnyType(types, ["gallery", "museum", "bookstore", "library"]) &&
    (hour < 10 || hour > 21)
  ) {
    penalty += 10
  }

  return penalty
}

export function isVenueOpenForWindow(
  venue: VenueWithHours,
  start: Date,
  end: Date,
  timeZone: string,
  relaxed = false
): boolean {
  const hours = normalizeVenueHours(venue.hours)
  if (!hours) return true

  const entry = hours[getDayKey(start, timeZone)]
  if (!entry?.open || !entry?.close) return false

  const openMinutes = parseTimeToMinutes(entry.open)
  let closeMinutes = parseTimeToMinutes(entry.close)
  if (openMinutes == null || closeMinutes == null) return false

  const startMinutes = getLocalMinutesInDay(start, timeZone)
  let endMinutes = getLocalMinutesInDay(end, timeZone)

  const crossesMidnight =
    closeMinutes <= openMinutes || entry.close.toLowerCase().includes("12:00 am")

  if (crossesMidnight) {
    closeMinutes += 24 * 60

    if (startMinutes < openMinutes) {
      endMinutes += 24 * 60
      const shiftedStart = startMinutes + 24 * 60

      return relaxed
        ? shiftedStart >= openMinutes && shiftedStart <= closeMinutes
        : shiftedStart >= openMinutes && endMinutes <= closeMinutes
    }

    return relaxed
      ? startMinutes >= openMinutes && startMinutes <= closeMinutes
      : startMinutes >= openMinutes && endMinutes <= closeMinutes
  }

  return relaxed
    ? startMinutes >= openMinutes && startMinutes <= closeMinutes
    : startMinutes >= openMinutes && endMinutes <= closeMinutes
}

export function isVenueOpenUntilAtLeastTwoAm(
  venue: VenueWithHours,
  arrival: Date,
  timeZone: string
): boolean {
  const arrivalAbsoluteMinutes = getLateNightAbsoluteArrivalMinutes(arrival, timeZone)
  const twoAmAbsoluteThreshold = 24 * 60 + 2 * 60
  const windows = getLateNightEvaluationWindows(venue, arrival, timeZone)

  return windows.some(
    (window) =>
      arrivalAbsoluteMinutes >= window.open &&
      arrivalAbsoluteMinutes <= window.close &&
      window.close >= twoAmAbsoluteThreshold
  )
}

export function isLateNightFallbackVenueTemporallyEligible(
  candidate: RoleCompatibleVenue & VenueRecord,
  slot: PlanningSlot,
  context: PlanningContext,
  timeZone: string
): boolean {
  if (!isLateNightAfterFallbackContext(context, slot)) return false
  if (!isLateNightNightlifeType(candidate)) return false

  const role = pickRoleForSlot(slot, candidate.inferredRoles)
  const arrival = slot.targetArrivalAt

  if (
    !isRoleTemporallyCompatible(
      candidate,
      role,
      arrival,
      slot.phase,
      timeZone,
      true
    )
  ) {
    return false
  }

  if (isVenueOpenUntilAtLeastTwoAm(candidate as VenueWithHours, arrival, timeZone)) {
    return true
  }

  return isVenueOpenForLateNightFallbackWindow(
    candidate as VenueWithHours,
    arrival,
    timeZone,
    LATE_NIGHT_MIN_VIABLE_WINDOW_MINUTES
  )
}

export function parseTimeToMinutes(value: string): number | null {
  const raw = value.trim().toLowerCase()
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3]

  if (hours === 12) {
    hours = period === "am" ? 0 : 12
  } else if (period === "pm") {
    hours += 12
  }

  return hours * 60 + minutes
}

function isVenueOpenForLateNightFallbackWindow(
  venue: VenueWithHours,
  arrival: Date,
  timeZone: string,
  minimumWindowMinutes: number
): boolean {
  const arrivalAbsoluteMinutes = getLateNightAbsoluteArrivalMinutes(arrival, timeZone)
  const windows = getLateNightEvaluationWindows(venue, arrival, timeZone)

  return windows.some(
    (window) =>
      arrivalAbsoluteMinutes >= window.open &&
      arrivalAbsoluteMinutes <= window.close &&
      window.close >= arrivalAbsoluteMinutes + minimumWindowMinutes
  )
}

function getLateNightAbsoluteArrivalMinutes(
  arrival: Date,
  timeZone: string
): number {
  return 24 * 60 + getLocalMinutesInDay(arrival, timeZone)
}

function getLateNightEvaluationWindows(
  venue: VenueWithHours,
  arrival: Date,
  timeZone: string
): Array<{ open: number; close: number }> {
  const rawHours = normalizeRawVenueHours(venue.hours)
  if (!rawHours) return []

  const currentDayKey = getDayKey(arrival, timeZone)
  const previousDayKey = getPreviousDayKey(arrival, timeZone)

  const windows: Array<{ open: number; close: number }> = []

  const previousEntry = rawHours[previousDayKey]
  if (previousEntry) {
    windows.push(...extractAbsoluteWindowsForEntry(previousEntry, "previous_day"))
  }

  const currentEntry = rawHours[currentDayKey]
  if (currentEntry) {
    windows.push(...extractAbsoluteWindowsForEntry(currentEntry, "current_day"))
  }

  return windows
}

function normalizeRawVenueHours(
  value: VenueWithHours["hours"]
): RawVenueHoursRecord | null {
  if (!value) return null

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as RawVenueHoursRecord
      return parsed && typeof parsed === "object" ? parsed : null
    } catch {
      return null
    }
  }

  return value as RawVenueHoursRecord
}

function extractAbsoluteWindowsForEntry(
  entry: RawVenueHoursEntry,
  dayContext: "previous_day" | "current_day"
): Array<{ open: number; close: number }> {
  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [entry.open, entry.close],
    [entry.open1, entry.close1],
    [entry.open2, entry.close2],
  ]

  const windows: Array<{ open: number; close: number }> = []

  for (const [openRaw, closeRaw] of pairs) {
    if (!openRaw || !closeRaw) continue

    const openMinutes = parseTimeToMinutes(openRaw)
    const closeMinutes = parseTimeToMinutes(closeRaw)

    if (openMinutes == null || closeMinutes == null) continue

    const crossesMidnight =
      closeMinutes <= openMinutes || closeRaw.toLowerCase().includes("12:00 am")

    if (dayContext === "previous_day") {
      const open = openMinutes
      const close = crossesMidnight ? closeMinutes + 24 * 60 : closeMinutes
      windows.push({ open, close })
      continue
    }

    const open = 24 * 60 + openMinutes
    const close =
      24 * 60 + closeMinutes + (crossesMidnight ? 24 * 60 : 0)

    windows.push({ open, close })
  }

  return windows
}