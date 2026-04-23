// lib/outings/planningContext.ts

import type {
  Budget,
  EventRecord,
  LeaveEarlyByHours,
  Mobility,
  PlanMode,
  PlanningContext,
  PlanningSlot,
  SlotPhase,
  StopRole,
  VenueRecord,
} from "./types"

export type BuildPlanningContextInput = {
  mode: PlanMode
  event: EventRecord
  anchorVenue: VenueRecord | null
  groupSize?: number | null
  budget?: Budget | null
  mobility?: Mobility
  vibeTags?: string[]
  timeZone?: string | null
  leaveEarlyByHours?: LeaveEarlyByHours | null
}

const ALLOWED_BUDGETS: Budget[] = ["$", "$$", "$$$", "$$$$"]
const ALLOWED_LEAVE_EARLY_BY_HOURS: LeaveEarlyByHours[] = [1, 2, 3, 4]

const BEFORE_EVENT_BUFFER_MINUTES = 20
const INTERSTOP_TRAVEL_BUFFER_MINUTES = 12
const DEFAULT_TIME_ZONE = "America/New_York"

type Daypart =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"
  | "late_night"

export function buildPlanningContext(
  input: BuildPlanningContextInput
): PlanningContext {
  const groupSize = normalizeGroupSize(input.groupSize)
  const budget = normalizeBudget(input.budget)
  const mobility = normalizeMobility(input.mobility)
  const vibeTags = normalizeVibeTags(input.vibeTags)
  const timeZone = normalizeTimeZone(input.timeZone)
  const leaveEarlyByHours = normalizeLeaveEarlyByHours(input.leaveEarlyByHours)

  const startsAt = input.event.starts_at ? new Date(input.event.starts_at) : new Date()
  const estimatedEndAt = input.event.ends_at
    ? new Date(input.event.ends_at)
    : addMinutes(startsAt, inferEventDurationMinutes(input.event))
  const plannedExitAt =
    leaveEarlyByHours != null
      ? addMinutes(estimatedEndAt, -leaveEarlyByHours * 60)
      : null
  const effectiveExitAt = plannedExitAt ?? estimatedEndAt

  const eventTags = normalizeTags([
    ...normalizeStringArray((input.event as EventRecord & { tags?: string[] | string | null }).tags),
    input.event.title ?? "",
    input.event.description ?? "",
  ])

  const eventArchetype = inferEventArchetype(eventTags)

  const plannedStartAt = inferPlannedStartAt(input.mode, startsAt, effectiveExitAt, timeZone)
  const plannedEndAt = inferPlannedEndAt(input.mode, startsAt, effectiveExitAt, timeZone)

  const desiredRoles = desiredRolesFor(
    input.mode,
    eventArchetype,
    startsAt,
    effectiveExitAt,
    timeZone,
    leaveEarlyByHours
  )

  const slots = buildPlanningSlots({
    mode: input.mode,
    desiredRoles,
    startsAt,
    estimatedEndAt: effectiveExitAt,
    timeZone,
  })

  return {
    mode: input.mode,
    timeZone,
    startsAt,
    estimatedEndAt,
    plannedStartAt,
    plannedEndAt,
    leaveEarlyByHours,
    plannedExitAt,
    effectiveExitAt,
    eventTags,
    eventArchetype,
    desiredRoles,
    slots,
    groupSize,
    budget,
    mobility,
    vibeTags,
    anchorVenue: input.anchorVenue,
  }
}

export function inferEventDurationMinutes(event: EventRecord): number {
  const tags = normalizeTags([
    ...normalizeStringArray((event as EventRecord & { tags?: string[] | string | null }).tags),
    event.title ?? "",
    event.description ?? "",
  ])

  if (tags.some((t) => ["festival", "market", "fair"].includes(t))) return 240
  if (tags.some((t) => ["concert", "music", "show", "comedy", "live"].includes(t))) return 120
  if (tags.some((t) => ["game", "sports", "match"].includes(t))) return 150
  if (tags.some((t) => ["gallery", "art", "exhibit", "museum"].includes(t))) return 90

  return 120
}

export function inferEventArchetype(tags: string[]): string {
  if (tags.some((t) => ["concert", "music", "live", "dj", "show"].includes(t))) {
    return "music"
  }

  if (tags.some((t) => ["comedy", "standup", "improv"].includes(t))) {
    return "comedy"
  }

  if (tags.some((t) => ["game", "sports", "match"].includes(t))) {
    return "sports"
  }

  if (tags.some((t) => ["gallery", "art", "museum", "exhibit"].includes(t))) {
    return "art"
  }

  if (tags.some((t) => ["festival", "market", "fair"].includes(t))) {
    return "festival"
  }

  return "general"
}

export function desiredRolesFor(
  mode: PlanMode,
  archetype: string,
  startsAt: Date,
  estimatedEndAt: Date,
  timeZone?: string | null,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): StopRole[] {
  const resolvedTimeZone = normalizeTimeZone(timeZone)
  const beforeDaypart = getDaypart(startsAt, resolvedTimeZone)
  const afterDaypart = getDaypart(addMinutes(estimatedEndAt, 30), resolvedTimeZone)
  const lateNightAfterEvent = endsAfterMidnight(startsAt, estimatedEndAt, resolvedTimeZone)

  if (mode === "before") {
    return desiredBeforeRoles(archetype, beforeDaypart)
  }

  if (mode === "after") {
    return desiredAfterRoles(
      archetype,
      afterDaypart,
      lateNightAfterEvent,
      leaveEarlyByHours
    )
  }

  return desiredFullRoles(
    archetype,
    beforeDaypart,
    afterDaypart,
    lateNightAfterEvent,
    leaveEarlyByHours
  )
}

export function normalizeBudget(budget?: Budget | null): Budget | null {
  return ALLOWED_BUDGETS.includes(budget as Budget) ? (budget as Budget) : null
}

export function normalizeMobility(mobility?: Mobility): Mobility {
  return mobility === "walk" || mobility === "short_ride" || mobility === "any"
    ? mobility
    : "short_ride"
}

export function normalizeGroupSize(groupSize?: number | null): number | null {
  if (!Number.isFinite(groupSize)) return null

  const n = Math.floor(Number(groupSize))
  if (n < 1) return 1
  if (n > 20) return 20

  return n
}

export function normalizeVibeTags(vibeTags?: string[]): string[] {
  if (!Array.isArray(vibeTags)) return []

  return vibeTags
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8)
}

export function normalizeTags(values: string[]): string[] {
  return values
    .flatMap((value) =>
      String(value)
        .toLowerCase()
        .split(/[\s,./|_-]+/)
    )
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function inferPlannedStartAt(
  mode: PlanMode,
  startsAt: Date,
  estimatedEndAt: Date,
  timeZone?: string | null
): Date {
  const startHour = getHourFractionInTimeZone(startsAt, normalizeTimeZone(timeZone))

  if (mode === "after") {
    return addMinutes(estimatedEndAt, 20)
  }

  if (mode === "before") {
    if (startHour < 11) return addMinutes(startsAt, -120)
    if (startHour < 15) return addMinutes(startsAt, -120)
    if (startHour < 19) return addMinutes(startsAt, -105)
    return addMinutes(startsAt, -100)
  }

  if (startHour < 12) return addMinutes(startsAt, -120)
  if (startHour < 18) return addMinutes(startsAt, -90)
  return addMinutes(startsAt, -75)
}

function inferPlannedEndAt(
  mode: PlanMode,
  startsAt: Date,
  estimatedEndAt: Date,
  timeZone?: string | null
): Date {
  const endHour = getHourFractionInTimeZone(estimatedEndAt, normalizeTimeZone(timeZone))

  if (mode === "before") {
    return addMinutes(startsAt, -BEFORE_EVENT_BUFFER_MINUTES)
  }

  if (mode === "after") {
    if (endHour < 17) return addMinutes(estimatedEndAt, 120)
    if (endHour < 21) return addMinutes(estimatedEndAt, 150)
    return addMinutes(estimatedEndAt, 180)
  }

  if (endHour < 17) return addMinutes(estimatedEndAt, 120)
  if (endHour < 21) return addMinutes(estimatedEndAt, 150)
  return addMinutes(estimatedEndAt, 180)
}

function desiredBeforeRoles(
  archetype: string,
  daypart: Daypart
): StopRole[] {
  if (daypart === "breakfast") {
    if (archetype === "art") return ["coffee", "activity"]
    if (archetype === "festival") return ["coffee", "food"]
    if (archetype === "music") return ["coffee", "food"]
    return ["coffee", "food"]
  }

  if (daypart === "brunch") {
    if (archetype === "art") return ["coffee", "food"]
    if (archetype === "festival") return ["food", "activity"]
    if (archetype === "music") return ["coffee", "food"]
    return ["coffee", "food"]
  }

  if (daypart === "lunch") {
    if (archetype === "art") return ["activity", "food"]
    if (archetype === "sports") return ["food", "drink"]
    if (archetype === "music") return ["coffee", "food"]
    return ["food", "activity"]
  }

  if (daypart === "dinner") {
    if (archetype === "sports") return ["food", "drink"]
    if (archetype === "music") return ["food", "drink"]
    if (archetype === "comedy") return ["food", "drink"]
    if (archetype === "art") return ["food", "activity"]
    return ["food", "drink"]
  }

  if (daypart === "late_night") {
    if (archetype === "music") return ["food", "drink"]
    if (archetype === "comedy") return ["food", "drink"]
    return ["drink", "food"]
  }

  return ["food", "drink"]
}

function desiredAfterRoles(
  archetype: string,
  daypart: Daypart,
  lateNightAfterEvent = false,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): StopRole[] {
  if (lateNightAfterEvent && !leaveEarlyByHours) {
    return ["drink"]
  }

  if (leaveEarlyByHours) {
    if (daypart === "breakfast") return ["coffee"]
    if (daypart === "brunch" || daypart === "lunch") {
      if (archetype === "art") return ["activity"]
      return ["food"]
    }
    if (daypart === "dinner") {
      if (archetype === "art") return ["food"]
      return ["drink"]
    }
    if (daypart === "late_night") return ["drink"]
  }

  if (daypart === "breakfast") {
    return ["coffee", "food"]
  }

  if (daypart === "brunch" || daypart === "lunch") {
    if (archetype === "art") return ["activity", "food"]
    return ["food", "drink"]
  }

  if (daypart === "dinner") {
    if (archetype === "art") return ["food", "drink"]
    if (archetype === "music") return ["drink", "food"]
    if (archetype === "comedy") return ["drink", "food"]
    return ["drink", "food"]
  }

  if (daypart === "late_night") {
    if (archetype === "music") return ["drink", "dessert"]
    if (archetype === "comedy") return ["drink", "food"]
    if (archetype === "sports") return ["drink", "food"]
    return ["drink", "dessert"]
  }

  return ["drink", "food"]
}

function desiredFullRoles(
  archetype: string,
  beforeDaypart: Daypart,
  afterDaypart: Daypart,
  lateNightAfterEvent = false,
  leaveEarlyByHours?: LeaveEarlyByHours | null
): StopRole[] {
  const beforeRoles = desiredBeforeRoles(archetype, beforeDaypart)
  const firstBefore = beforeRoles[0] ?? "food"
  const secondBefore =
    beforeRoles[1] ?? (firstBefore === "food" ? "activity" : "food")

  if (leaveEarlyByHours) {
    const singleAfterRole =
      desiredAfterRoles(archetype, afterDaypart, lateNightAfterEvent, leaveEarlyByHours)[0] ??
      "drink"

    return [firstBefore, secondBefore, singleAfterRole]
  }

  // Late full-night fallback:
  // 2 before + 1 after
  if (lateNightAfterEvent || afterDaypart === "late_night") {
    if (archetype === "art") {
      return [beforeDaypart === "breakfast" ? "coffee" : "activity", "food", "drink"]
    }

    if (archetype === "festival") {
      return [beforeDaypart === "breakfast" ? "coffee" : "food", "activity", "drink"]
    }

    return [firstBefore, secondBefore, "drink"]
  }

  const second = desiredAfterRoles(archetype, afterDaypart)[0] ?? "drink"
  const third = desiredAfterRoles(archetype, afterDaypart)[1] ?? "dessert"

  const roles: StopRole[] = [firstBefore, second, third]

  if (roles[0] === roles[1]) {
    roles[1] = roles[1] === "food" ? "drink" : "food"
  }

  if (roles[2] === roles[1]) {
    roles[2] = roles[2] === "drink" ? "dessert" : "drink"
  }

  if (archetype === "art" && beforeDaypart !== "late_night") {
    roles[0] = beforeDaypart === "breakfast" ? "coffee" : "activity"
    roles[1] = "food"
    roles[2] = "dessert"
  }

  if (archetype === "festival") {
    roles[0] = beforeDaypart === "breakfast" ? "coffee" : "food"
    roles[1] = "activity"
    roles[2] = "dessert"
  }

  return roles
}

function buildPlanningSlots({
  mode,
  desiredRoles,
  startsAt,
  estimatedEndAt,
  timeZone,
}: {
  mode: PlanMode
  desiredRoles: StopRole[]
  startsAt: Date
  estimatedEndAt: Date
  timeZone?: string | null
}): PlanningSlot[] {
  if (desiredRoles.length === 0) return []

  if (mode === "before") {
    return buildBeforeSlots(desiredRoles, startsAt)
  }

  if (mode === "after") {
    return buildAfterSlots(desiredRoles, estimatedEndAt)
  }

  const lateNightFullFallback = endsAfterMidnight(
    startsAt,
    estimatedEndAt,
    normalizeTimeZone(timeZone)
  )

  return buildFullSlots(
    desiredRoles,
    startsAt,
    estimatedEndAt,
    lateNightFullFallback
  )
}

function buildBeforeSlots(
  desiredRoles: StopRole[],
  startsAt: Date
): PlanningSlot[] {
  const finalDeparture = addMinutes(startsAt, -BEFORE_EVENT_BUFFER_MINUTES)
  const slots: PlanningSlot[] = new Array(desiredRoles.length)

  let nextBoundary = finalDeparture

  for (let index = desiredRoles.length - 1; index >= 0; index -= 1) {
    const role = desiredRoles[index]
    const dwellMinutes = dwellMinutesForRole(role, "before")
    const departure = nextBoundary
    const arrival = addMinutes(departure, -dwellMinutes)

    slots[index] = {
      index,
      role,
      phase: "before",
      targetArrivalAt: arrival,
      targetDepartureAt: departure,
      dwellMinutes,
      strictProgression: index > 0,
      flexibleRole: flexibleRoleFor(role, "before"),
    }

    nextBoundary = addMinutes(arrival, -INTERSTOP_TRAVEL_BUFFER_MINUTES)
  }

  return slots
}

function buildAfterSlots(
  desiredRoles: StopRole[],
  estimatedEndAt: Date
): PlanningSlot[] {
  return desiredRoles.map((role, index) => {
    const dwellMinutes = dwellMinutesForRole(role, "after")
    const arrival = addMinutes(estimatedEndAt, 20 + index * 80)
    const departure = addMinutes(arrival, dwellMinutes)

    return {
      index,
      role,
      phase: "after",
      targetArrivalAt: arrival,
      targetDepartureAt: departure,
      dwellMinutes,
      strictProgression: index === 0,
      flexibleRole: flexibleRoleFor(role, "after"),
    }
  })
}

function buildFullSlots(
  desiredRoles: StopRole[],
  startsAt: Date,
  estimatedEndAt: Date,
  lateNightFullFallback = false
): PlanningSlot[] {
  if (lateNightFullFallback) {
    const beforeRoles = desiredRoles.slice(0, 2)
    const afterRoles = desiredRoles.slice(2)

    const beforeSlots = buildBeforeSlots(beforeRoles, startsAt).map((slot, index) => ({
      ...slot,
      index,
      strictProgression: index > 0,
    }))

    const afterSlots = buildAfterSlots(afterRoles, estimatedEndAt).map((slot, index) => ({
      ...slot,
      index: index + beforeRoles.length,
      strictProgression: index === 0,
    }))

    return [...beforeSlots, ...afterSlots]
  }

  return desiredRoles.map((role, index) => {
    const phase: SlotPhase = index === 0 ? "before" : "after"
    const dwellMinutes = dwellMinutesForRole(role, phase)

    if (index === 0) {
      const departure = addMinutes(startsAt, -BEFORE_EVENT_BUFFER_MINUTES)
      const arrival = addMinutes(departure, -dwellMinutes)

      return {
        index,
        role,
        phase,
        targetArrivalAt: arrival,
        targetDepartureAt: departure,
        dwellMinutes,
        strictProgression: false,
        flexibleRole: flexibleRoleFor(role, phase),
      }
    }

    const arrival = addMinutes(estimatedEndAt, 20 + (index - 1) * 80)
    const departure = addMinutes(arrival, dwellMinutes)

    return {
      index,
      role,
      phase,
      targetArrivalAt: arrival,
      targetDepartureAt: departure,
      dwellMinutes,
      strictProgression: index === 1,
      flexibleRole: flexibleRoleFor(role, phase),
    }
  })
}

function dwellMinutesForRole(
  role: StopRole,
  phase: SlotPhase
): number {
  if (phase === "before") {
    if (role === "food") return 50
    if (role === "drink") return 40
    if (role === "activity") return 45
    if (role === "dessert") return 30
    return 35
  }

  if (role === "food") return 75
  if (role === "drink") return 60
  if (role === "activity") return 60
  if (role === "dessert") return 40
  return 45
}

function flexibleRoleFor(
  role: StopRole,
  phase: SlotPhase
): StopRole | null {
  if (phase === "before") {
    if (role === "coffee") return "food"
    return null
  }

  if (role === "drink") return "dessert"
  if (role === "dessert") return "drink"
  if (role === "food") return "drink"

  return null
}

function getDaypart(date: Date, timeZone?: string | null): Daypart {
  const hour = getHourFractionInTimeZone(date, normalizeTimeZone(timeZone))

  if (hour < 10.5) return "breakfast"
  if (hour < 12.5) return "brunch"
  if (hour < 16) return "lunch"
  if (hour < 22) return "dinner"
  return "late_night"
}

function endsAfterMidnight(
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

function getHourFractionInTimeZone(date: Date, timeZone: string): number {
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

function normalizeTimeZone(timeZone?: string | null): string {
  return timeZone?.trim() || DEFAULT_TIME_ZONE
}

function normalizeLeaveEarlyByHours(
  value?: LeaveEarlyByHours | number | null
): LeaveEarlyByHours | null {
  if (!Number.isFinite(value)) return null

  const n = Math.floor(Number(value)) as LeaveEarlyByHours
  return ALLOWED_LEAVE_EARLY_BY_HOURS.includes(n) ? n : null
}

function normalizeStringArray(
  value: string[] | string | null | undefined
): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry))
  }

  if (value == null) return []

  return [String(value)]
}