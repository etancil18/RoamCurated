// lib/outings/planningRoles.ts

import type {
  LeaveEarlyByHours,
  PlanMode,
  StopRole,
} from "./types"
import { applyVibeRoleBias } from "./vibePresets"

const DINNER_MINIMUM_LOCAL_HOUR = 17.5
const DEFAULT_TIME_ZONE = "America/New_York"

export type Daypart =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"
  | "late_night"

type RolePlanningContext = {
  mode: PlanMode
  archetype: string
  beforeDaypart: Daypart
  afterDaypart: Daypart
  lateNightAfterEvent: boolean
  leaveEarlyByHours?: LeaveEarlyByHours | null
}

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
  const afterDaypart = getDaypart(
    addMinutes(estimatedEndAt, 30),
    resolvedTimeZone
  )

  const isLateNightAfterDaypart = afterDaypart === "late_night"

  const lateNightAfterEvent = endsAfterMidnight(
    startsAt,
    estimatedEndAt,
    resolvedTimeZone
  )

  const context: RolePlanningContext = {
    mode,
    archetype: canonicalArchetype,
    beforeDaypart,
    afterDaypart,
    lateNightAfterEvent,
    leaveEarlyByHours,
  }

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
            leaveEarlyByHours,
            isLateNightAfterDaypart
          )

  return applyContextualVibeRoleBias(
    baseRoles,
    vibePresetId,
    context
  )
}

export function desiredBeforeRoles(
  archetype: string,
  daypart: Daypart
): StopRole[] {
  const canonicalArchetype = normalizePlanningArchetype(archetype)

  if (canonicalArchetype === "networking") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food"]
    }

    return ["drink"]
  }

  if (canonicalArchetype === "market") {
    if (daypart === "breakfast") {
      return ["coffee", "food"]
    }

    if (daypart === "brunch" || daypart === "lunch") {
      return ["coffee", "food"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "food_drink") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee"]
    }

    if (daypart === "lunch") {
      return ["coffee", "food"]
    }

    if (daypart === "dinner") {
      return ["drink", "food"]
    }

    return ["drink"]
  }

  if (canonicalArchetype === "wellness") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee"]
    }

    if (daypart === "lunch") {
      return ["coffee", "food"]
    }

    if (daypart === "dinner") {
      return ["food"]
    }

    return ["food"]
  }

  if (canonicalArchetype === "arts_culture") {
    if (daypart === "breakfast") {
      return ["coffee", "food"]
    }

    if (daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["coffee", "food"]
    }

    if (daypart === "dinner") {
      return ["food", "drink"]
    }

    return ["drink", "food"]
  }

  if (canonicalArchetype === "music") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["coffee", "food"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "social_sports") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food", "drink"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "nightlife") {
    if (
      daypart === "breakfast" ||
      daypart === "brunch" ||
      daypart === "lunch"
    ) {
      return ["coffee", "food"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "comedy") {
    if (
      daypart === "breakfast" ||
      daypart === "brunch" ||
      daypart === "lunch"
    ) {
      return ["coffee", "food"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "community") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["coffee", "food"]
    }

    return ["food", "drink"]
  }

  if (daypart === "breakfast" || daypart === "brunch") {
    return ["coffee", "food"]
  }

  if (daypart === "lunch") {
    return ["food", "coffee"]
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
  const reducedCoverage =
    Boolean(leaveEarlyByHours) ||
    lateNightAfterEvent ||
    daypart === "late_night"

  if (canonicalArchetype === "networking") {
    if (reducedCoverage) return ["drink"]

    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food", "coffee"]
    }

    return ["drink", "food"]
  }

  if (canonicalArchetype === "market") {
    if (reducedCoverage) return ["drink"]

    if (
      daypart === "breakfast" ||
      daypart === "brunch" ||
      daypart === "lunch"
    ) {
      return ["food", "coffee"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "food_drink") {
    if (reducedCoverage) return ["drink"]

    if (
      daypart === "breakfast" ||
      daypart === "brunch" ||
      daypart === "lunch"
    ) {
      return ["dessert", "coffee"]
    }

    return ["drink", "dessert"]
  }

  if (canonicalArchetype === "wellness") {
    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food", "coffee"]
    }

    if (reducedCoverage) {
      return ["food"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "social_sports") {
    if (reducedCoverage) {
      return daypart === "late_night"
        ? ["drink", "food"]
        : ["food"]
    }

    if (daypart === "breakfast" || daypart === "brunch") {
      return ["food", "coffee"]
    }

    if (daypart === "lunch") {
      return ["food", "drink"]
    }

    return ["drink", "food"]
  }

  if (canonicalArchetype === "arts_culture") {
    if (reducedCoverage) {
      return daypart === "late_night" ? ["drink"] : ["food"]
    }

    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food", "dessert"]
    }

    return ["food", "drink"]
  }

  if (canonicalArchetype === "music") {
    if (reducedCoverage) return ["drink"]

    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food", "drink"]
    }

    return ["drink", "food"]
  }

  if (canonicalArchetype === "nightlife") {
    if (reducedCoverage) return ["drink"]

    return ["drink", "food"]
  }

  if (canonicalArchetype === "comedy") {
    if (reducedCoverage) return ["drink"]

    if (
      daypart === "breakfast" ||
      daypart === "brunch" ||
      daypart === "lunch"
    ) {
      return ["food", "coffee"]
    }

    return ["drink", "food"]
  }

  if (canonicalArchetype === "community") {
    if (reducedCoverage) {
      return daypart === "late_night" ? ["drink"] : ["food"]
    }

    if (daypart === "breakfast" || daypart === "brunch") {
      return ["coffee", "food"]
    }

    if (daypart === "lunch") {
      return ["food", "coffee"]
    }

    return ["food", "drink"]
  }

  if (reducedCoverage) {
    return daypart === "late_night" ? ["drink"] : ["food"]
  }

  if (daypart === "breakfast" || daypart === "brunch") {
    return ["coffee", "food"]
  }

  if (daypart === "lunch") {
    return ["food", "drink"]
  }

  return ["drink", "food"]
}

export function desiredFullRoles(
  archetype: string,
  beforeDaypart: Daypart,
  afterDaypart: Daypart,
  lateNightAfterEvent = false,
  leaveEarlyByHours?: LeaveEarlyByHours | null,
  isLateNightAfterDaypart = afterDaypart === "late_night"
): StopRole[] {
  const canonicalArchetype = normalizePlanningArchetype(archetype)

  const beforeRoles = desiredBeforeRoles(
    canonicalArchetype,
    beforeDaypart
  )

  const afterRoles = desiredAfterRoles(
    canonicalArchetype,
    afterDaypart,
    lateNightAfterEvent,
    leaveEarlyByHours
  )

  const firstBefore =
    beforeRoles[0] ??
    defaultRoleForDaypart(beforeDaypart)

  const secondBefore =
    beforeRoles[1] ??
    complementaryRoleFor(firstBefore, beforeDaypart)

  const firstAfter =
    afterRoles[0] ??
    defaultRoleForDaypart(afterDaypart)

  const reducedAfterCoverage =
    Boolean(leaveEarlyByHours) ||
    lateNightAfterEvent ||
    isLateNightAfterDaypart

  if (canonicalArchetype === "networking") {
    const beforeRole =
      beforeDaypart === "breakfast" ||
      beforeDaypart === "brunch"
        ? "coffee"
        : beforeDaypart === "lunch"
          ? "food"
          : "drink"

    if (reducedAfterCoverage) {
      return [beforeRole, "drink"]
    }

    return ensureContextualRoleSequence(
      [
        beforeRole,
        afterDaypart === "dinner" ? "food" : "drink",
        "drink",
      ],
      beforeDaypart,
      afterDaypart
    )
  }

  if (canonicalArchetype === "social_sports") {
    if (
      beforeDaypart === "breakfast" ||
      beforeDaypart === "brunch"
    ) {
      return reducedAfterCoverage
        ? ["coffee", "food", "drink"]
        : ["coffee", "food", firstAfter]
    }

    return ensureContextualRoleSequence(
      [firstBefore, secondBefore, firstAfter],
      beforeDaypart,
      afterDaypart
    )
  }

  if (canonicalArchetype === "arts_culture") {
    if (reducedAfterCoverage) {
      return [
        beforeDaypart === "breakfast" ||
        beforeDaypart === "brunch"
          ? "coffee"
          : "food",
        firstAfter,
      ]
    }

    return ensureContextualRoleSequence(
      [
        beforeDaypart === "breakfast" ||
        beforeDaypart === "brunch"
          ? "coffee"
          : "food",
        firstAfter,
        isLateNightAfterDaypart
          ? "drink"
          : "dessert",
      ],
      beforeDaypart,
      afterDaypart
    )
  }

  if (canonicalArchetype === "market") {
    return ensureContextualRoleSequence(
      [
        beforeDaypart === "breakfast" ||
        beforeDaypart === "brunch"
          ? "coffee"
          : "food",
        firstAfter,
        isLateNightAfterDaypart
          ? "drink"
          : "dessert",
      ],
      beforeDaypart,
      afterDaypart
    )
  }

  if (canonicalArchetype === "food_drink") {
    if (reducedAfterCoverage) {
      return [
        beforeDaypart === "breakfast" ||
        beforeDaypart === "brunch"
          ? "coffee"
          : "drink",
        firstAfter,
      ]
    }

    return ensureContextualRoleSequence(
      [
        beforeDaypart === "breakfast" ||
        beforeDaypart === "brunch"
          ? "coffee"
          : "drink",
        firstAfter,
        isLateNightAfterDaypart
          ? "drink"
          : "dessert",
      ],
      beforeDaypart,
      afterDaypart
    )
  }

  if (canonicalArchetype === "wellness") {
    return ensureContextualRoleSequence(
      [
        beforeDaypart === "breakfast" ||
        beforeDaypart === "brunch"
          ? "coffee"
          : "food",
        firstAfter,
        isLateNightAfterDaypart
          ? "food"
          : "coffee",
      ],
      beforeDaypart,
      afterDaypart
    )
  }

  if (reducedAfterCoverage) {
    return ensureContextualRoleSequence(
      [firstBefore, secondBefore, firstAfter],
      beforeDaypart,
      afterDaypart
    )
  }

  const secondAfter =
    afterRoles[1] ??
    complementaryRoleFor(firstAfter, afterDaypart)

  return ensureContextualRoleSequence(
    [firstBefore, firstAfter, secondAfter],
    beforeDaypart,
    afterDaypart
  )
}

export function getDaypart(
  date: Date,
  timeZone?: string | null
): Daypart {
  const hour = getHourFractionInTimeZone(
    date,
    normalizeTimeZone(timeZone)
  )

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
  const startDayKey = getCalendarDayKey(
    startsAt,
    timeZone
  )

  const endDayKey = getCalendarDayKey(
    estimatedEndAt,
    timeZone
  )

  if (startDayKey !== endDayKey) return true

  const endMinutes = getLocalMinutesInDay(
    estimatedEndAt,
    timeZone
  )

  return endMinutes < 4 * 60
}

export function addMinutes(
  date: Date,
  minutes: number
): Date {
  return new Date(
    date.getTime() + minutes * 60_000
  )
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

  const rawHour = Number(
    parts.find((part) => part.type === "hour")?.value ?? "0"
  )

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0"
  )

  const hour = rawHour === 24 ? 0 : rawHour

  return hour + minute / 60
}

function applyContextualVibeRoleBias(
  baseRoles: StopRole[],
  vibePresetId: string | string[] | null | undefined,
  context: RolePlanningContext
): StopRole[] {
  if (!vibePresetId || baseRoles.length === 0) {
    return baseRoles
  }

  const vibeBiasedRoles = applyVibeRoleBias(
    baseRoles,
    {
      vibePresetId,
      mode: context.mode,
    }
  )

  const result: StopRole[] = []

  for (
    let index = 0;
    index < baseRoles.length;
    index += 1
  ) {
    const baseRole = baseRoles[index]
    const proposedRole =
      vibeBiasedRoles[index] ?? baseRole

    const phase = resolveRolePhaseForIndex(
      index,
      baseRoles.length,
      context.mode
    )

    const daypart =
      phase === "before"
        ? context.beforeDaypart
        : context.afterDaypart

    result.push(
      isRoleContextuallyValid({
        role: proposedRole,
        baseRole,
        archetype: context.archetype,
        phase,
        daypart,
        lateNightAfterEvent:
          context.lateNightAfterEvent,
      })
        ? proposedRole
        : baseRole
    )
  }

  return preserveRoleCountAndSequence(
    result,
    baseRoles,
    context
  )
}

function isRoleContextuallyValid({
  role,
  baseRole,
  archetype,
  phase,
  daypart,
  lateNightAfterEvent,
}: {
  role: StopRole
  baseRole: StopRole
  archetype: string
  phase: "before" | "after"
  daypart: Daypart
  lateNightAfterEvent: boolean
}): boolean {
  if (role === baseRole) return true

  if (
    role === "coffee" &&
    (daypart === "dinner" ||
      daypart === "late_night")
  ) {
    return false
  }

  if (
    role === "dessert" &&
    (daypart === "breakfast" ||
      daypart === "brunch")
  ) {
    return false
  }

  if (
    role === "activity" &&
    (
      daypart === "late_night" ||
      lateNightAfterEvent ||
      archetype === "nightlife" ||
      archetype === "music" ||
      archetype === "comedy" ||
      archetype === "networking"
    )
  ) {
    return false
  }

  if (
    role === "drink" &&
    daypart === "breakfast" &&
    archetype !== "social_sports"
  ) {
    return false
  }

  if (
    phase === "after" &&
    daypart === "late_night" &&
    role !== "drink" &&
    role !== "food"
  ) {
    return false
  }

  if (
    phase === "before" &&
    archetype === "wellness" &&
    role === "drink"
  ) {
    return false
  }

  return true
}

function preserveRoleCountAndSequence(
  roles: StopRole[],
  baseRoles: StopRole[],
  context: RolePlanningContext
): StopRole[] {
  const result: StopRole[] = []

  for (
    let index = 0;
    index < baseRoles.length;
    index += 1
  ) {
    const role =
      roles[index] ??
      baseRoles[index]

    const phase = resolveRolePhaseForIndex(
      index,
      baseRoles.length,
      context.mode
    )

    const daypart =
      phase === "before"
        ? context.beforeDaypart
        : context.afterDaypart

    const previous = result[result.length - 1] ?? null

    if (
      previous === role &&
      shouldAvoidConsecutiveDuplicateRole(
        role,
        phase,
        daypart
      )
    ) {
      result.push(
        complementaryRoleFor(role, daypart)
      )
      continue
    }

    result.push(role)
  }

  return result
}

function ensureContextualRoleSequence(
  roles: StopRole[],
  beforeDaypart: Daypart,
  afterDaypart: Daypart
): StopRole[] {
  return roles.map((role, index) => {
    const previous =
      index > 0 ? roles[index - 1] : null

    if (
      previous === role &&
      shouldAvoidConsecutiveDuplicateRole(
        role,
        index === 0 ? "before" : "after",
        index === 0
          ? beforeDaypart
          : afterDaypart
      )
    ) {
      return complementaryRoleFor(
        role,
        index === 0
          ? beforeDaypart
          : afterDaypart
      )
    }

    return role
  })
}

function shouldAvoidConsecutiveDuplicateRole(
  role: StopRole,
  phase: "before" | "after",
  daypart: Daypart
): boolean {
  if (role === "drink" && phase === "after") {
    return false
  }

  if (
    role === "food" &&
    daypart === "late_night"
  ) {
    return false
  }

  return true
}

function complementaryRoleFor(
  role: StopRole,
  daypart: Daypart
): StopRole {
  if (
    daypart === "breakfast" ||
    daypart === "brunch"
  ) {
    if (role === "coffee") return "food"
    if (role === "food") return "coffee"
    return "food"
  }

  if (daypart === "lunch") {
    if (role === "food") return "coffee"
    if (role === "coffee") return "food"
    if (role === "drink") return "food"
    return "food"
  }

  if (daypart === "dinner") {
    if (role === "food") return "drink"
    if (role === "drink") return "food"
    if (role === "dessert") return "drink"
    return "food"
  }

  if (role === "drink") return "food"
  if (role === "food") return "drink"

  return "drink"
}

function defaultRoleForDaypart(
  daypart: Daypart
): StopRole {
  if (
    daypart === "breakfast" ||
    daypart === "brunch"
  ) {
    return "coffee"
  }

  if (daypart === "lunch") {
    return "food"
  }

  return "drink"
}

function resolveRolePhaseForIndex(
  index: number,
  totalRoles: number,
  mode: PlanMode
): "before" | "after" {
  if (mode === "before") return "before"
  if (mode === "after") return "after"

  if (totalRoles <= 1) {
    return index === 0 ? "before" : "after"
  }

  if (totalRoles === 2) {
    return index === 0 ? "before" : "after"
  }

  return index < 2 ? "before" : "after"
}

function getLocalMinutesInDay(
  date: Date,
  timeZone: string
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const rawHour = Number(
    parts.find((part) => part.type === "hour")?.value ?? "0"
  )

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0"
  )

  const hour = rawHour === 24 ? 0 : rawHour

  return hour * 60 + minute
}

function getCalendarDayKey(
  date: Date,
  timeZone: string
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year =
    parts.find((part) => part.type === "year")?.value ??
    "0000"

  const month =
    parts.find((part) => part.type === "month")?.value ??
    "00"

  const day =
    parts.find((part) => part.type === "day")?.value ??
    "00"

  return `${year}-${month}-${day}`
}

function normalizePlanningArchetype(
  archetype: string | null | undefined
): string {
  if (archetype === "art") {
    return "arts_culture"
  }

  if (archetype === "sports") {
    return "social_sports"
  }

  if (archetype === "festival") {
    return "market"
  }

  if (archetype === "general") {
    return "other"
  }

  return archetype ?? "other"
}

function normalizeTimeZone(
  timeZone?: string | null
): string {
  return timeZone?.trim() || DEFAULT_TIME_ZONE
}