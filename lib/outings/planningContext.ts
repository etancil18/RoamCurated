// lib/outings/planningContext.ts

import {
  addMinutes,
  desiredRolesFor,
  endsAfterMidnight,
  getDaypart,
  getHourFractionInTimeZone,
} from "./planningRoles"

import type {
  Budget,
  CityPlanningConfig,
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
  cityPlanning?: CityPlanningConfig | null
}

const ALLOWED_BUDGETS: Budget[] = ["$", "$$", "$$$", "$$$$"]
const ALLOWED_LEAVE_EARLY_BY_HOURS: LeaveEarlyByHours[] = [1, 2, 3, 4]

const BEFORE_EVENT_BUFFER_MINUTES = 20
const INTERSTOP_TRAVEL_BUFFER_MINUTES = 12
const DEFAULT_TIME_ZONE = "America/New_York"
const DINNER_MINIMUM_LOCAL_HOUR = 17.5

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
    ...normalizeStringArray(
      (input.event as EventRecord & { tags?: string[] | string | null }).tags
    ),
    input.event.title ?? "",
    input.event.description ?? "",
  ])

  const eventArchetype = inferEventArchetype(eventTags)

  const plannedStartAt = inferPlannedStartAt(
    input.mode,
    startsAt,
    effectiveExitAt,
    timeZone
  )

  const plannedEndAt = inferPlannedEndAt(
    input.mode,
    startsAt,
    effectiveExitAt,
    timeZone
  )

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
    archetype: eventArchetype,
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
    cityPlanning: input.cityPlanning ?? null,
  }
}

export function inferEventDurationMinutes(event: EventRecord): number {
  const tags = normalizeTags([
    ...normalizeStringArray(
      (event as EventRecord & { tags?: string[] | string | null }).tags
    ),
    event.title ?? "",
    event.description ?? "",
  ])

  if (tags.some((t) => ["festival", "market", "fair"].includes(t))) return 240

  if (
    tags.some((t) =>
      [
        "networking",
        "mixer",
        "meetup",
        "founders",
        "founder",
        "startup",
        "startups",
        "entrepreneur",
        "entrepreneurs",
        "professional",
        "professionals",
        "industry",
        "business",
        "conference",
        "summit",
        "panel",
        "investor",
        "investors",
        "vc",
        "venture",
        "community",
        "social",
      ].includes(t)
    )
  ) {
    return 120
  }

  if (tags.some((t) => ["concert", "music", "show", "comedy", "live"].includes(t))) {
    return 120
  }

  if (tags.some((t) => ["game", "sports", "match"].includes(t))) return 150

  if (tags.some((t) => ["gallery", "art", "exhibit", "museum"].includes(t))) {
    return 90
  }

  return 120
}

export function inferEventArchetype(tags: string[]): string {
  if (
    tags.some((t) =>
      [
        "market",
        "markets",
        "vendor",
        "vendors",
        "vintage",
        "apparel",
        "books",
        "tarot",
        "craft",
        "makers",
        "maker",
        "flea",
        "bazaar",
      ].includes(t)
    )
  ) {
    return "market"
  }

  if (
    tags.some((t) =>
      [
        "networking",
        "mixer",
        "meetup",
        "founders",
        "founder",
        "startup",
        "startups",
        "entrepreneur",
        "entrepreneurs",
        "professional",
        "professionals",
        "industry",
        "business",
        "conference",
        "summit",
        "panel",
        "investor",
        "investors",
        "vc",
        "venture",
        "community",
        "social",
      ].includes(t)
    )
  ) {
    return "networking"
  }

  if (
    tags.some((t) =>
      [
        "dinner",
        "lunch",
        "brunch",
        "breakfast",
        "supper",
        "tasting",
        "pairing",
        "chef",
        "restaurant",
        "meal",
        "feast",
        "prix",
        "menu",
        "omakase",
      ].includes(t)
    )
  ) {
    return "food_drink"
  }

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

  if (tags.some((t) => ["festival", "fair"].includes(t))) {
    return "festival"
  }

  return "general"
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

function buildPlanningSlots({
  mode,
  desiredRoles,
  startsAt,
  estimatedEndAt,
  timeZone,
  archetype,
}: {
  mode: PlanMode
  desiredRoles: StopRole[]
  startsAt: Date
  estimatedEndAt: Date
  timeZone?: string | null
  archetype: string
}): PlanningSlot[] {
  if (desiredRoles.length === 0) return []

  const resolvedTimeZone = normalizeTimeZone(timeZone)

  if (mode === "before") {
    return buildBeforeSlots(desiredRoles, startsAt, resolvedTimeZone)
  }

  if (mode === "after") {
    return buildAfterSlots(desiredRoles, estimatedEndAt, resolvedTimeZone, archetype)
  }

  const lateNightFullFallback = endsAfterMidnight(
    startsAt,
    estimatedEndAt,
    resolvedTimeZone
  )

  return buildFullSlots(
    desiredRoles,
    startsAt,
    estimatedEndAt,
    lateNightFullFallback,
    resolvedTimeZone,
    archetype
  )
}

function buildBeforeSlots(
  desiredRoles: StopRole[],
  startsAt: Date,
  timeZone?: string | null
): PlanningSlot[] {
  const finalDeparture = addMinutes(startsAt, -BEFORE_EVENT_BUFFER_MINUTES)
  const slots: PlanningSlot[] = new Array(desiredRoles.length)
  const resolvedTimeZone = normalizeTimeZone(timeZone)

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
      flexibleRole: flexibleRoleForPlanningSlot(
        role,
        "before",
        arrival,
        resolvedTimeZone,
        "general"
      ),
    }

    nextBoundary = addMinutes(arrival, -INTERSTOP_TRAVEL_BUFFER_MINUTES)
  }

  return slots
}

function buildAfterSlots(
  desiredRoles: StopRole[],
  estimatedEndAt: Date,
  timeZone?: string | null,
  archetype = "general"
): PlanningSlot[] {
  const resolvedTimeZone = normalizeTimeZone(timeZone)

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
      flexibleRole: flexibleRoleForPlanningSlot(
        role,
        "after",
        arrival,
        resolvedTimeZone,
        archetype
      ),
    }
  })
}

function buildFullSlots(
  desiredRoles: StopRole[],
  startsAt: Date,
  estimatedEndAt: Date,
  lateNightFullFallback = false,
  timeZone?: string | null,
  archetype = "general"
): PlanningSlot[] {
  const resolvedTimeZone = normalizeTimeZone(timeZone)

  const beforeCount = desiredRoles.length >= 3 ? 2 : 1
  const beforeRoles = desiredRoles.slice(0, beforeCount)
  const afterRoles = desiredRoles.slice(beforeCount)

  const beforeSlots = buildBeforeSlots(beforeRoles, startsAt, resolvedTimeZone).map(
    (slot, index) => ({
      ...slot,
      index,
      strictProgression: index > 0,
    })
  )

  const afterSlots = buildAfterSlots(
    afterRoles,
    estimatedEndAt,
    resolvedTimeZone,
    archetype
  ).map((slot, index) => ({
    ...slot,
    index: index + beforeRoles.length,
    strictProgression: index === 0,
  }))

  return [...beforeSlots, ...afterSlots]
}

function dwellMinutesForRole(role: StopRole, phase: SlotPhase): number {
  if (role === "food") return phase === "before" ? 75 : 90
  if (role === "drink") return phase === "before" ? 60 : 90
  if (role === "coffee") return 40
  if (role === "activity") return 55
  if (role === "dessert") return 40

  return 45
}

function flexibleRoleForPlanningSlot(
  role: StopRole,
  phase: SlotPhase,
  arrival: Date,
  timeZone: string,
  archetype = "general"
): StopRole | null {
  const daypart = getDaypart(arrival, timeZone)

  if (
    phase === "before" &&
    role === "food" &&
    getHourFractionInTimeZone(arrival, timeZone) < DINNER_MINIMUM_LOCAL_HOUR
  ) {
    return "drink"
  }

  if (
    phase === "after" &&
    role === "drink" &&
    (archetype === "music" || archetype === "food_drink" || archetype === "market") &&
    daypart === "late_night"
  ) {
    return null
  }

  if (
    phase === "after" &&
    role === "drink" &&
    daypart === "late_night"
  ) {
    return null
  }

  if (
    phase === "after" &&
    archetype === "food_drink" &&
    role === "food"
  ) {
    return "drink"
  }

  return flexibleRoleFor(role, phase)
}

function flexibleRoleFor(role: StopRole, phase: SlotPhase): StopRole | null {
  if (phase === "before") {
    if (role === "coffee") return "food"
    return null
  }

  if (role === "drink") return "dessert"
  if (role === "dessert") return "drink"
  if (role === "food") return "drink"

  return null
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

export { addMinutes }