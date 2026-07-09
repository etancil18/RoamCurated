// lib/outings/planningRoles.ts

import type {
  LeaveEarlyByHours,
  PlanMode,
  StopRole,
} from "./types"
import { applyVibeRoleBias } from "./vibePresets"

const DINNER_MINIMUM_LOCAL_HOUR = 17.5
const DEFAULT_TIME_ZONE = "America/New_York"

type Daypart =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"
  | "late_night"

export function desiredRolesFor(
  mode: PlanMode,
  archetype: string,
  startsAt: Date,
  estimatedEndAt: Date,
  timeZone?: string | null,
  leaveEarlyByHours?: LeaveEarlyByHours | null,
  vibePresetId?: string | string[] | null
): StopRole[] {
  const resolvedTimeZone = normalizeTimeZone(timeZone)
  const canonicalArchetype = normalizePlanningArchetype(archetype)
  const beforeDaypart = getDaypart(startsAt, resolvedTimeZone)
  const afterDaypart = getDaypart(addMinutes(estimatedEndAt, 30), resolvedTimeZone)
  const lateNightAfterEvent = endsAfterMidnight(
    startsAt,
    estimatedEndAt,
    resolvedTimeZone
  )

  const baseRoles =
    mode === "before"
      ? desiredBeforeRoles(canonicalArchetype, beforeDaypart)
      : mode === "after"
        ? desiredAfterRoles(
            canonicalArchetype,
            afterDaypart,
            lateNightAfterEvent,
            leaveEarlyByHours
          )
        : desiredFullRoles(
            canonicalArchetype,
            beforeDaypart,
            afterDaypart,
            lateNightAfterEvent,
            leaveEarlyByHours
          )

  return applyVibeRoleBias(baseRoles, {
    vibePresetId,
    mode,
  })
}

export function desiredBeforeRoles(
  archetype: string,
  daypart: Daypart
): StopRole[] {
  const canonicalArchetype = normalizePlanningArchetype(archetype)

  if (canonicalArchetype === "networking") {
    if (daypart === "breakfast" || daypart === "brunch" || daypart === "lunch") {
      return ["food"]
    }

    return ["drink"]
  }

  if (canonicalArchetype === "market") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "activity"]
    }

    if (daypart === "lunch") return ["coffee", "activity"]
    if (daypart === "dinner") return ["drink", "activity"]

    return ["drink", "activity"]
  }

  if (canonicalArchetype === "food_drink") {
    if (daypart === "breakfast" || daypart === "brunch") return ["coffee"]
    if (daypart === "lunch") return ["activity", "drink"]
    if (daypart === "dinner") return ["drink", "activity"]
    return ["drink"]
  }

  if (canonicalArchetype === "wellness") {
    if (daypart === "breakfast" || daypart === "brunch") return ["coffee"]
    if (daypart === "lunch") return ["coffee", "food"]
    return ["coffee", "activity"]
  }

  if (daypart === "breakfast") {
    if (canonicalArchetype === "arts_culture") return ["coffee", "activity"]
    if (canonicalArchetype === "market") return ["coffee", "food"]
    if (canonicalArchetype === "music") return ["coffee", "food"]
    if (canonicalArchetype === "social_sports") return ["coffee", "food"]
    return ["coffee", "food"]
  }

  if (daypart === "brunch") {
    if (canonicalArchetype === "arts_culture") return ["coffee", "food"]
    if (canonicalArchetype === "market") return ["food", "activity"]
    if (canonicalArchetype === "music") return ["coffee", "food"]
    if (canonicalArchetype === "social_sports") return ["coffee", "food"]
    return ["coffee", "food"]
  }

  if (daypart === "lunch") {
    if (canonicalArchetype === "arts_culture") return ["activity", "food"]
    if (canonicalArchetype === "social_sports") return ["food", "drink"]
    if (canonicalArchetype === "music") return ["coffee", "food"]
    return ["food", "activity"]
  }

  if (daypart === "dinner") {
    if (canonicalArchetype === "social_sports") return ["food", "drink"]
    if (canonicalArchetype === "music") return ["food", "drink"]
    if (canonicalArchetype === "comedy") return ["food", "drink"]
    if (canonicalArchetype === "nightlife") return ["drink", "food"]
    if (canonicalArchetype === "arts_culture") return ["food", "activity"]
    return ["food", "drink"]
  }

  if (daypart === "late_night") {
    if (canonicalArchetype === "music") return ["food", "drink"]
    if (canonicalArchetype === "comedy") return ["food", "drink"]
    if (canonicalArchetype === "nightlife") return ["drink", "food"]
    if (canonicalArchetype === "social_sports") return ["drink", "food"]
    return ["drink", "food"]
  }

  return ["food", "drink"]
}

export function desiredAfterRoles(
  archetype: string,
  daypart: Daypart,
  lateNightAfterEvent = false,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): StopRole[] {
  const canonicalArchetype = normalizePlanningArchetype(archetype)

  if (canonicalArchetype === "networking") {
    if (lateNightAfterEvent || daypart === "late_night") return ["drink"]
    if (daypart === "dinner") return ["food", "drink"]
    return ["drink", "food"]
  }

  if (canonicalArchetype === "market") {
    if (lateNightAfterEvent || daypart === "late_night") return ["drink"]
    if (daypart === "dinner") return ["drink"]
    return ["coffee", "drink"]
  }

  if (canonicalArchetype === "food_drink") {
    if (lateNightAfterEvent || daypart === "late_night") return ["drink"]
    return ["drink", "dessert"]
  }

  if (canonicalArchetype === "wellness") {
    if (daypart === "breakfast" || daypart === "brunch") return ["coffee", "food"]
    if (daypart === "lunch") return ["food", "activity"]
    return ["food", "drink"]
  }

  if (canonicalArchetype === "social_sports") {
    if (lateNightAfterEvent || daypart === "late_night") return ["drink", "food"]
    if (daypart === "breakfast" || daypart === "brunch") return ["coffee", "food"]
    if (daypart === "lunch") return ["food", "drink"]
    return ["drink", "food"]
  }

  if (lateNightAfterEvent && !leaveEarlyByHours) {
    return ["drink"]
  }

  if (leaveEarlyByHours) {
    if (
      lateNightAfterEvent ||
      daypart === "late_night" ||
      canonicalArchetype === "music"
    ) {
      return ["drink"]
    }

    if (daypart === "breakfast") return ["coffee"]

    if (daypart === "brunch" || daypart === "lunch") {
      if (canonicalArchetype === "arts_culture") return ["activity"]
      return ["food"]
    }

    if (daypart === "dinner") {
      if (canonicalArchetype === "arts_culture") return ["food"]
      return ["drink"]
    }

    return ["drink"]
  }

  if (daypart === "breakfast") {
    return ["coffee", "food"]
  }

  if (daypart === "brunch" || daypart === "lunch") {
    if (canonicalArchetype === "arts_culture") return ["activity", "food"]
    return ["food", "drink"]
  }

  if (daypart === "dinner") {
    if (canonicalArchetype === "arts_culture") return ["food", "drink"]
    if (canonicalArchetype === "music") return ["drink", "food"]
    if (canonicalArchetype === "comedy") return ["drink", "food"]
    if (canonicalArchetype === "nightlife") return ["drink", "food"]
    return ["drink", "food"]
  }

  if (daypart === "late_night") {
    if (canonicalArchetype === "music") return ["drink"]
    if (canonicalArchetype === "comedy") return ["drink", "food"]
    if (canonicalArchetype === "social_sports") return ["drink", "food"]
    if (canonicalArchetype === "nightlife") return ["drink", "food"]
    return ["drink"]
  }

  return ["drink", "food"]
}

export function desiredFullRoles(
  archetype: string,
  beforeDaypart: Daypart,
  afterDaypart: Daypart,
  lateNightAfterEvent = false,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): StopRole[] {
  const canonicalArchetype = normalizePlanningArchetype(archetype)
  const beforeRoles = desiredBeforeRoles(canonicalArchetype, beforeDaypart)
  const firstBefore = beforeRoles[0] ?? "food"
  const secondBefore =
    beforeRoles[1] ?? (firstBefore === "food" ? "activity" : "food")

  if (canonicalArchetype === "social_sports") {
    if (beforeDaypart === "breakfast" || beforeDaypart === "brunch") {
      if (lateNightAfterEvent || afterDaypart === "late_night") {
        return ["coffee", "food", "drink"]
      }

      return ["coffee", "food", afterDaypart === "dinner" ? "drink" : "food"]
    }

    if (leaveEarlyByHours || lateNightAfterEvent || afterDaypart === "late_night") {
      return [firstBefore, secondBefore, "drink"]
    }

    return [firstBefore, "drink", "food"]
  }

  if (canonicalArchetype === "networking") {
    const beforeRole: StopRole =
      beforeDaypart === "breakfast" ||
      beforeDaypart === "brunch" ||
      beforeDaypart === "lunch"
        ? "food"
        : "drink"

    if (leaveEarlyByHours || lateNightAfterEvent || afterDaypart === "late_night") {
      return [beforeRole, "drink"]
    }

    return [beforeRole, afterDaypart === "dinner" ? "food" : "drink", "drink"]
  }

  if (canonicalArchetype === "market") {
    return [
      beforeDaypart === "breakfast" || beforeDaypart === "brunch"
        ? "coffee"
        : "drink",
      "activity",
      "drink",
    ]
  }

  if (canonicalArchetype === "food_drink") {
    if (leaveEarlyByHours || lateNightAfterEvent || afterDaypart === "late_night") {
      return [
        beforeDaypart === "breakfast" || beforeDaypart === "brunch"
          ? "coffee"
          : "drink",
        "activity",
        "drink",
      ]
    }

    return [
      beforeDaypart === "breakfast" || beforeDaypart === "brunch"
        ? "coffee"
        : "drink",
      "activity",
      afterDaypart === "dinner" ? "drink" : "dessert",
    ]
  }

  if (canonicalArchetype === "wellness") {
    return [
      beforeDaypart === "breakfast" || beforeDaypart === "brunch"
        ? "coffee"
        : "food",
      "activity",
      "food",
    ]
  }

  if (leaveEarlyByHours) {
    const singleAfterRole =
      desiredAfterRoles(
        canonicalArchetype,
        afterDaypart,
        lateNightAfterEvent,
        leaveEarlyByHours
      )[0] ?? "drink"

    return [firstBefore, secondBefore, singleAfterRole]
  }

  if (lateNightAfterEvent || afterDaypart === "late_night") {
    if (canonicalArchetype === "arts_culture") {
      return [
        beforeDaypart === "breakfast" ? "coffee" : "activity",
        "food",
        "drink",
      ]
    }

    if (canonicalArchetype === "market") {
      return [
        beforeDaypart === "breakfast" ? "coffee" : "food",
        "activity",
        "drink",
      ]
    }

    return [firstBefore, secondBefore, "drink"]
  }

  const second = desiredAfterRoles(canonicalArchetype, afterDaypart)[0] ?? "drink"
  const third = desiredAfterRoles(canonicalArchetype, afterDaypart)[1] ?? "drink"

  const roles: StopRole[] = [firstBefore, second, third]

  if (roles[0] === roles[1]) {
    roles[1] = roles[1] === "food" ? "drink" : "food"
  }

  if (roles[2] === roles[1]) {
    roles[2] = roles[2] === "drink" ? "food" : "drink"
  }

  if (canonicalArchetype === "arts_culture" && beforeDaypart !== "late_night") {
    roles[0] = beforeDaypart === "breakfast" ? "coffee" : "activity"
    roles[1] = "food"
    roles[2] = "dessert"
  }

  if (canonicalArchetype === "market") {
    roles[0] = beforeDaypart === "breakfast" ? "coffee" : "food"
    roles[1] = "activity"
    roles[2] = "dessert"
  }

  return roles
}

export function getDaypart(
  date: Date,
  timeZone?: string | null
): Daypart {
  const hour = getHourFractionInTimeZone(date, normalizeTimeZone(timeZone))

  if (hour < 10.5) return "breakfast"
  if (hour < 12.5) return "brunch"
  if (hour < DINNER_MINIMUM_LOCAL_HOUR) return "lunch"
  if (hour < 22) return "dinner"
  return "late_night"
}

export function endsAfterMidnight(
  startsAt: Date,
  estimatedEndAt: Date,
  timeZone: string
): boolean {
  const startDayKey = getCalendarDayKey(startsAt, timeZone)
  const endDayKey = getCalendarDayKey(estimatedEndAt, timeZone)

  if (startDayKey !== endDayKey) return true

  const endMinutes = getLocalMinutesInDay(estimatedEndAt, timeZone)
  return endMinutes < 4 * 60
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function getHourFractionInTimeZone(
  date: Date,
  timeZone: string
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "0"
  const minutePart = parts.find((part) => part.type === "minute")?.value ?? "0"

  return Number(hourPart) + Number(minutePart) / 60
}

function getLocalMinutesInDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hourPart = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minutePart = Number(parts.find((part) => part.type === "minute")?.value ?? "0")

  return hourPart * 60 + minutePart
}

function getCalendarDayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "00"
  const day = parts.find((part) => part.type === "day")?.value ?? "00"

  return `${year}-${month}-${day}`
}

function normalizePlanningArchetype(archetype: string | null | undefined): string {
  if (archetype === "art") return "arts_culture"
  if (archetype === "sports") return "social_sports"
  if (archetype === "festival") return "market"
  if (archetype === "general") return "other"

  return archetype ?? "other"
}

function normalizeTimeZone(timeZone?: string | null): string {
  return timeZone?.trim() || DEFAULT_TIME_ZONE
}