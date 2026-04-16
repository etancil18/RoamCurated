// lib/outings/planningContext.ts

import type {
  Budget,
  EventRecord,
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
}

const ALLOWED_BUDGETS: Budget[] = ["$", "$$", "$$$", "$$$$"]

const BEFORE_EVENT_BUFFER_MINUTES = 20
const INTERSTOP_TRAVEL_BUFFER_MINUTES = 12

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

  const startsAt = input.event.starts_at ? new Date(input.event.starts_at) : new Date()
  const estimatedEndAt = input.event.ends_at
    ? new Date(input.event.ends_at)
    : addMinutes(startsAt, inferEventDurationMinutes(input.event))

  const eventTags = normalizeTags([
    ...normalizeStringArray((input.event as EventRecord & { tags?: string[] | string | null }).tags),
    input.event.title ?? "",
    input.event.description ?? "",
  ])

  const eventArchetype = inferEventArchetype(eventTags)

  const plannedStartAt = inferPlannedStartAt(input.mode, startsAt, estimatedEndAt)
  const plannedEndAt = inferPlannedEndAt(input.mode, startsAt, estimatedEndAt)

  const desiredRoles = desiredRolesFor(
    input.mode,
    eventArchetype,
    startsAt,
    estimatedEndAt
  )

  const slots = buildPlanningSlots({
    mode: input.mode,
    desiredRoles,
    startsAt,
    estimatedEndAt,
  })

  return {
    mode: input.mode,
    startsAt,
    estimatedEndAt,
    plannedStartAt,
    plannedEndAt,
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
  estimatedEndAt: Date
): StopRole[] {
  const beforeDaypart = getDaypart(startsAt)
  const afterDaypart = getDaypart(addMinutes(estimatedEndAt, 30))

  if (mode === "before") {
    return desiredBeforeRoles(archetype, beforeDaypart)
  }

  if (mode === "after") {
    return desiredAfterRoles(archetype, afterDaypart)
  }

  return desiredFullRoles(archetype, beforeDaypart, afterDaypart)
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
  estimatedEndAt: Date
): Date {
  const startHour = startsAt.getHours() + startsAt.getMinutes() / 60

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
  estimatedEndAt: Date
): Date {
  const endHour = estimatedEndAt.getHours() + estimatedEndAt.getMinutes() / 60

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
    return ["coffee", "food"]
  }

  if (daypart === "brunch") {
    if (archetype === "art") return ["coffee", "food"]
    if (archetype === "festival") return ["food", "activity"]
    return ["coffee", "food"]
  }

  if (daypart === "lunch") {
    if (archetype === "art") return ["activity", "food"]
    if (archetype === "sports") return ["food", "drink"]
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
  daypart: Daypart
): StopRole[] {
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
  afterDaypart: Daypart
): StopRole[] {
  const first = desiredBeforeRoles(archetype, beforeDaypart)[0] ?? "food"
  const second = desiredAfterRoles(archetype, afterDaypart)[0] ?? "drink"
  const third = desiredAfterRoles(archetype, afterDaypart)[1] ?? "dessert"

  const roles: StopRole[] = [first, second, third]

  if (roles[0] === roles[1]) {
    roles[1] = roles[1] === "food" ? "drink" : "food"
  }

  if (roles[2] === roles[1]) {
    roles[2] = roles[2] === "drink" ? "dessert" : "drink"
  }

  if (archetype === "art" && beforeDaypart !== "late_night") {
    roles[0] = beforeDaypart === "breakfast" ? "coffee" : "activity"
    roles[1] = "food"
    roles[2] = afterDaypart === "late_night" ? "drink" : "dessert"
  }

  if (archetype === "festival") {
    roles[0] = beforeDaypart === "breakfast" ? "coffee" : "food"
    roles[1] = "activity"
    roles[2] = afterDaypart === "late_night" ? "drink" : "dessert"
  }

  return roles
}

function buildPlanningSlots({
  mode,
  desiredRoles,
  startsAt,
  estimatedEndAt,
}: {
  mode: PlanMode
  desiredRoles: StopRole[]
  startsAt: Date
  estimatedEndAt: Date
}): PlanningSlot[] {
  if (desiredRoles.length === 0) return []

  if (mode === "before") {
    return buildBeforeSlots(desiredRoles, startsAt)
  }

  if (mode === "after") {
    return buildAfterSlots(desiredRoles, estimatedEndAt)
  }

  return buildFullSlots(desiredRoles, startsAt, estimatedEndAt)
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
  estimatedEndAt: Date
): PlanningSlot[] {
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

function getDaypart(date: Date): Daypart {
  const hour = date.getHours() + date.getMinutes() / 60

  if (hour < 10.5) return "breakfast"
  if (hour < 12.5) return "brunch"
  if (hour < 16) return "lunch"
  if (hour < 22) return "dinner"
  return "late_night"
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