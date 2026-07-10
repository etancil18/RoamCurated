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
  VibePlanningProfile,
  VibeSequenceTemplate,
} from "./types"

import {
  getSemanticRoleForSlot,
  normalizeEventArchetypeForPlanner,
} from "./eventArchetypes"

import {
  expandVibeTags,
  getDiscouragedDaypartsForVibe,
  getDiscouragedTypesForVibe,
  getFallbackTypePriorityForVibe,
  getPreferredDaypartsForVibe,
  getPreferredTypesForVibe,
  getRequiredAnyTypesForVibe,
  getSequenceTemplatesForVibe,
  getStronglyDiscouragedTypesForVibe,
} from "./vibePresets"

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
const AFTER_EVENT_BUFFER_MINUTES = 20
const INTERSTOP_TRAVEL_BUFFER_MINUTES = 12
const DEFAULT_TIME_ZONE = "America/New_York"

type EventArchetypeScore = {
  archetype:
    | "social_sports"
    | "music"
    | "networking"
    | "food_drink"
    | "arts_culture"
    | "wellness"
    | "nightlife"
    | "community"
    | "comedy"
    | "market"
    | "other"
  score: number
}

export function buildPlanningContext(
  input: BuildPlanningContextInput
): PlanningContext {
  const groupSize = normalizeGroupSize(input.groupSize)
  const budget = normalizeBudget(input.budget)
  const mobility = normalizeMobility(input.mobility)
  const vibeTags = normalizeVibeTags(input.vibeTags)
  const vibePlanning = buildVibePlanningProfile(vibeTags)
  const timeZone = normalizeTimeZone(input.timeZone)
  const leaveEarlyByHours = normalizeLeaveEarlyByHours(
    input.leaveEarlyByHours
  )

  const startsAt = parseValidDate(input.event.starts_at) ?? new Date()

  const estimatedEndAt =
    parseValidDate(input.event.ends_at) ??
    addMinutes(startsAt, inferEventDurationMinutes(input.event))

  const plannedExitAt =
    leaveEarlyByHours != null
      ? addMinutes(estimatedEndAt, -leaveEarlyByHours * 60)
      : null

  const effectiveExitAt = plannedExitAt ?? estimatedEndAt

  const eventTags = normalizeTags([
    ...normalizeStringArray(
      (
        input.event as EventRecord & {
          tags?: string[] | string | null
        }
      ).tags
    ),
    input.event.title ?? "",
    input.event.description ?? "",
  ])

  const eventArchetype = input.event.archetype
    ? normalizeEventArchetypeForPlanner(input.event.archetype)
    : inferEventArchetype(eventTags)

  const desiredRoles = normalizeDesiredRolesForContext(
    desiredRolesFor(
      input.mode,
      eventArchetype,
      startsAt,
      effectiveExitAt,
      timeZone,
      leaveEarlyByHours,
      vibeTags
    ),
    {
      mode: input.mode,
      eventArchetype,
      startsAt,
      effectiveExitAt,
      timeZone,
    }
  )

  const slots = buildPlanningSlots({
    mode: input.mode,
    desiredRoles,
    startsAt,
    effectiveExitAt,
    timeZone,
    archetype: eventArchetype,
    vibePlanning,
  })

  const plannedStartAt =
    slots[0]?.targetArrivalAt ??
    inferFallbackPlannedStartAt(
      input.mode,
      startsAt,
      effectiveExitAt,
      timeZone
    )

  const plannedEndAt =
    slots[slots.length - 1]?.targetDepartureAt ??
    inferFallbackPlannedEndAt(
      input.mode,
      startsAt,
      effectiveExitAt,
      timeZone
    )

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
    vibePlanning,
    anchorVenue: input.anchorVenue,
    cityPlanning: input.cityPlanning ?? null,
  }
}

export function inferEventDurationMinutes(event: EventRecord): number {
  const tags = normalizeTags([
    ...normalizeStringArray(
      (
        event as EventRecord & {
          tags?: string[] | string | null
        }
      ).tags
    ),
    event.title ?? "",
    event.description ?? "",
  ])

  if (
    hasAnyToken(tags, [
      "festival",
      "market",
      "fair",
      "bazaar",
      "flea",
    ])
  ) {
    return 240
  }

  if (
    hasAnyToken(tags, [
      "conference",
      "summit",
      "networking",
      "mixer",
      "panel",
      "meetup",
    ])
  ) {
    return 120
  }

  if (
    hasAnyToken(tags, [
      "game",
      "sports",
      "match",
      "matchday",
      "soccer",
      "football",
      "watchparty",
      "tailgate",
    ])
  ) {
    return 150
  }

  if (
    hasAnyToken(tags, [
      "concert",
      "music",
      "performance",
      "comedy",
      "standup",
      "improv",
      "show",
    ])
  ) {
    return 120
  }

  if (
    hasAnyToken(tags, [
      "gallery",
      "art",
      "exhibit",
      "exhibition",
      "museum",
    ])
  ) {
    return 90
  }

  if (
    hasAnyToken(tags, [
      "wellness",
      "fitness",
      "yoga",
      "pilates",
      "meditation",
      "breathwork",
    ])
  ) {
    return 75
  }

  return 120
}

export function inferEventArchetype(tags: string[]): string {
  const normalizedTags = uniqueStrings(tags.map(normalizeToken))
  const scores: EventArchetypeScore[] = [
    {
      archetype: "market",
      score: scoreTokenMatches(normalizedTags, {
        market: 8,
        markets: 6,
        vendor: 5,
        vendors: 5,
        vintage: 3,
        craft: 3,
        makers: 4,
        maker: 3,
        flea: 8,
        bazaar: 8,
        festival: 5,
        fair: 5,
      }),
    },
    {
      archetype: "networking",
      score: scoreTokenMatches(normalizedTags, {
        networking: 10,
        mixer: 8,
        founders: 6,
        founder: 5,
        startup: 5,
        startups: 5,
        entrepreneur: 5,
        entrepreneurs: 5,
        professional: 4,
        professionals: 4,
        conference: 5,
        summit: 5,
        panel: 4,
        investor: 5,
        investors: 5,
        venture: 4,
        industry: 3,
        business: 2,
        meetup: 3,
      }),
    },
    {
      archetype: "food_drink",
      score: scoreTokenMatches(normalizedTags, {
        dinner: 8,
        lunch: 7,
        brunch: 7,
        breakfast: 7,
        supper: 7,
        tasting: 8,
        pairing: 7,
        chef: 5,
        restaurant: 5,
        meal: 5,
        feast: 5,
        omakase: 8,
        culinary: 6,
      }),
    },
    {
      archetype: "social_sports",
      score: scoreTokenMatches(normalizedTags, {
        sports: 9,
        sport: 7,
        game: 5,
        games: 4,
        match: 8,
        matchday: 9,
        soccer: 9,
        football: 8,
        fifa: 8,
        tailgate: 8,
        pregame: 5,
        watchparty: 8,
        watch: 2,
      }),
    },
    {
      archetype: "comedy",
      score: scoreTokenMatches(normalizedTags, {
        comedy: 10,
        standup: 10,
        improv: 9,
        comedian: 8,
      }),
    },
    {
      archetype: "nightlife",
      score: scoreTokenMatches(normalizedTags, {
        nightlife: 10,
        party: 8,
        club: 8,
        afterparty: 9,
        afterhours: 9,
        dancing: 5,
        dance: 4,
        rave: 9,
        dj: 4,
      }),
    },
    {
      archetype: "music",
      score: scoreTokenMatches(normalizedTags, {
        concert: 10,
        music: 8,
        musician: 7,
        band: 7,
        singer: 6,
        live: 4,
        performance: 5,
        showcase: 4,
        dj: 3,
        show: 2,
      }),
    },
    {
      archetype: "arts_culture",
      score: scoreTokenMatches(normalizedTags, {
        gallery: 10,
        art: 8,
        arts: 8,
        museum: 10,
        exhibit: 9,
        exhibition: 9,
        installation: 7,
        design: 4,
        culture: 4,
        cultural: 4,
        theater: 5,
        theatre: 5,
        film: 4,
        cinema: 4,
      }),
    },
    {
      archetype: "wellness",
      score: scoreTokenMatches(normalizedTags, {
        wellness: 10,
        fitness: 8,
        yoga: 10,
        pilates: 10,
        meditation: 9,
        breathwork: 9,
        run: 4,
        running: 4,
        mindfulness: 7,
      }),
    },
    {
      archetype: "community",
      score: scoreTokenMatches(normalizedTags, {
        community: 7,
        neighborhood: 5,
        local: 2,
        gathering: 4,
        volunteer: 6,
        social: 1,
        meetup: 2,
      }),
    },
  ]

  const ranked = scores
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.archetype ?? "other"
}

export function normalizeBudget(
  budget?: Budget | null
): Budget | null {
  return ALLOWED_BUDGETS.includes(budget as Budget)
    ? (budget as Budget)
    : null
}

export function normalizeMobility(
  mobility?: Mobility
): Mobility {
  return mobility === "walk" ||
    mobility === "short_ride" ||
    mobility === "any"
    ? mobility
    : "short_ride"
}

export function normalizeGroupSize(
  groupSize?: number | null
): number | null {
  if (!Number.isFinite(groupSize)) return null

  const normalized = Math.floor(Number(groupSize))

  if (normalized < 1) return 1
  if (normalized > 20) return 20

  return normalized
}

export function normalizeVibeTags(
  vibeTags?: string[]
): string[] {
  if (!Array.isArray(vibeTags)) return []

  /*
   * This input may already contain expanded preset tokens. Do not truncate it
   * to eight entries here, because doing so discards useful vibe signals before
   * candidate scoring. The API layer remains responsible for limiting raw user
   * selections.
   */
  return uniqueStrings(
    vibeTags
      .flatMap((tag) => normalizeTokenFragments(String(tag)))
      .filter(Boolean)
  ).slice(0, 96)
}

export function normalizeTags(
  values: string[]
): string[] {
  return uniqueStrings(
    values
      .flatMap((value) => normalizeTokenFragments(String(value)))
      .filter(Boolean)
  )
}

function buildPlanningSlots({
  mode,
  desiredRoles,
  startsAt,
  effectiveExitAt,
  timeZone,
  archetype,
  vibePlanning,
}: {
  mode: PlanMode
  desiredRoles: StopRole[]
  startsAt: Date
  effectiveExitAt: Date
  timeZone?: string | null
  archetype: string
  vibePlanning?: VibePlanningProfile | null
}): PlanningSlot[] {
  if (desiredRoles.length === 0) return []

  const resolvedTimeZone = normalizeTimeZone(timeZone)

  if (mode === "before") {
    return buildBeforeSlots(
      desiredRoles,
      startsAt,
      resolvedTimeZone,
      archetype,
      vibePlanning,
      mode
    )
  }

  if (mode === "after") {
    return buildAfterSlots(
      desiredRoles,
      effectiveExitAt,
      resolvedTimeZone,
      archetype,
      vibePlanning,
      mode
    )
  }

  return buildFullSlots(
    desiredRoles,
    startsAt,
    effectiveExitAt,
    resolvedTimeZone,
    archetype,
    vibePlanning
  )
}

function buildBeforeSlots(
  desiredRoles: StopRole[],
  startsAt: Date,
  timeZone: string,
  archetype: string,
  vibePlanning: VibePlanningProfile | null | undefined,
  mode: PlanMode
): PlanningSlot[] {
  const finalDeparture = addMinutes(
    startsAt,
    -BEFORE_EVENT_BUFFER_MINUTES
  )

  const slots: PlanningSlot[] = new Array(desiredRoles.length)
  let nextBoundary = finalDeparture

  for (
    let index = desiredRoles.length - 1;
    index >= 0;
    index -= 1
  ) {
    const role = desiredRoles[index]
    const departure = nextBoundary

    const dwellMinutes = dwellMinutesForRole(
      role,
      "before",
      departure,
      timeZone,
      archetype
    )

    const arrival = addMinutes(
      departure,
      -dwellMinutes
    )

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
        timeZone,
        archetype
      ),
      semanticRole: getSemanticRoleForSlot({
        archetype,
        phase: "before",
        index,
      }),
      ...getVibeSlotHints({
        role,
        mode,
        vibePlanning,
      }),
    }

    nextBoundary = addMinutes(
      arrival,
      -INTERSTOP_TRAVEL_BUFFER_MINUTES
    )
  }

  return slots
}

function buildAfterSlots(
  desiredRoles: StopRole[],
  effectiveExitAt: Date,
  timeZone: string,
  archetype: string,
  vibePlanning: VibePlanningProfile | null | undefined,
  mode: PlanMode
): PlanningSlot[] {
  const slots: PlanningSlot[] = []
  let nextArrival = addMinutes(
    effectiveExitAt,
    AFTER_EVENT_BUFFER_MINUTES
  )

  for (
    let index = 0;
    index < desiredRoles.length;
    index += 1
  ) {
    const role = desiredRoles[index]
    const arrival = nextArrival

    const dwellMinutes = dwellMinutesForRole(
      role,
      "after",
      arrival,
      timeZone,
      archetype
    )

    const departure = addMinutes(
      arrival,
      dwellMinutes
    )

    slots.push({
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
        timeZone,
        archetype
      ),
      semanticRole: getSemanticRoleForSlot({
        archetype,
        phase: "after",
        index,
      }),
      ...getVibeSlotHints({
        role,
        mode,
        vibePlanning,
      }),
    })

    nextArrival = addMinutes(
      departure,
      INTERSTOP_TRAVEL_BUFFER_MINUTES
    )
  }

  return slots
}

function buildFullSlots(
  desiredRoles: StopRole[],
  startsAt: Date,
  effectiveExitAt: Date,
  timeZone: string,
  archetype: string,
  vibePlanning?: VibePlanningProfile | null
): PlanningSlot[] {
  /*
   * A full route is event-centered:
   *
   * before stop → event → after stop(s)
   *
   * The prior implementation assigned two of three roles to the before phase,
   * which frequently produced two pre-event stops and only one post-event stop.
   */
  const beforeCount = desiredRoles.length > 0 ? 1 : 0

  const beforeRoles = desiredRoles.slice(0, beforeCount)
  const afterRoles = desiredRoles.slice(beforeCount)

  const beforeSlots = buildBeforeSlots(
    beforeRoles,
    startsAt,
    timeZone,
    archetype,
    vibePlanning,
    "full"
  ).map((slot, index) => ({
    ...slot,
    index,
    strictProgression: false,
  }))

  const afterSlots = buildAfterSlots(
    afterRoles,
    effectiveExitAt,
    timeZone,
    archetype,
    vibePlanning,
    "full"
  ).map((slot, localIndex) => ({
    ...slot,
    index: localIndex + beforeRoles.length,
    strictProgression: localIndex === 0,
  }))

  return [...beforeSlots, ...afterSlots]
}

function normalizeDesiredRolesForContext(
  roles: StopRole[],
  context: {
    mode: PlanMode
    eventArchetype: string
    startsAt: Date
    effectiveExitAt: Date
    timeZone: string
  }
): StopRole[] {
  if (roles.length === 0) return []

  const startHour = getHourFractionInTimeZone(
    context.startsAt,
    context.timeZone
  )

  const exitHour = getHourFractionInTimeZone(
    context.effectiveExitAt,
    context.timeZone
  )

  if (context.eventArchetype === "social_sports") {
    const morningOrMiddayStart = startHour < 13
    const daytimeExit = exitHour < 17

    if (
      context.mode === "before" &&
      morningOrMiddayStart
    ) {
      return roles.map((role, index) => {
        if (index === 0 && role === "drink") {
          return "coffee"
        }

        if (role === "drink") {
          return "food"
        }

        return role
      })
    }

    if (
      context.mode === "after" &&
      daytimeExit
    ) {
      return roles.map((role) =>
        role === "drink" ? "food" : role
      )
    }

    if (
      context.mode === "full" &&
      morningOrMiddayStart
    ) {
      return roles.map((role, index) => {
        if (index === 0) return "coffee"

        if (
          role === "drink" &&
          daytimeExit
        ) {
          return "food"
        }

        return role
      })
    }
  }

  return roles
}

function buildVibePlanningProfile(
  vibeTags: string[]
): VibePlanningProfile | null {
  if (vibeTags.length === 0) return null

  const expandedTags = expandVibeTags(vibeTags)
  const preferredTypes = getPreferredTypesForVibe(vibeTags)
  const requiredAnyTypes = getRequiredAnyTypesForVibe(vibeTags)
  const discouragedTypes = getDiscouragedTypesForVibe(vibeTags)
  const stronglyDiscouragedTypes =
    getStronglyDiscouragedTypesForVibe(vibeTags)
  const preferredDayparts =
    getPreferredDaypartsForVibe(vibeTags)
  const discouragedDayparts =
    getDiscouragedDaypartsForVibe(vibeTags)
  const fallbackTypePriority =
    getFallbackTypePriorityForVibe(vibeTags)
  const sequenceTemplates =
    getSequenceTemplatesForVibe(vibeTags)

  return {
    preferredTypes: uniqueStrings(preferredTypes),
    requiredAnyTypes: uniqueStrings(requiredAnyTypes),
    discouragedTypes: uniqueStrings(discouragedTypes),
    stronglyDiscouragedTypes: uniqueStrings(
      stronglyDiscouragedTypes
    ),
    preferredDayparts:
      preferredDayparts.length > 0
        ? preferredDayparts
        : inferPreferredDaypartsForVibes(expandedTags),
    discouragedDayparts:
      discouragedDayparts.length > 0
        ? discouragedDayparts
        : inferDiscouragedDaypartsForVibes(expandedTags),
    fallbackTypePriority:
      fallbackTypePriority.length > 0
        ? uniqueStrings(fallbackTypePriority)
        : uniqueStrings(preferredTypes),
    sequenceTemplates: sequenceTemplates.map(
      normalizeVibeSequenceTemplate
    ),
  }
}

function getVibeSlotHints({
  role,
  mode,
  vibePlanning,
}: {
  role: StopRole
  mode: PlanMode
  vibePlanning?: VibePlanningProfile | null
}): Pick<
  PlanningSlot,
  | "vibePreferredTypes"
  | "vibeRequiredAnyTypes"
  | "vibeDiscouragedTypes"
> {
  if (!vibePlanning) return {}

  const template = selectVibeSequenceTemplate(
    vibePlanning.sequenceTemplates,
    mode
  )

  const rolePreferredTypes =
    template?.preferredTypesByRole?.[role] ?? []

  return {
    vibePreferredTypes:
      rolePreferredTypes.length > 0
        ? uniqueStrings(rolePreferredTypes)
        : vibePlanning.preferredTypes,

    /*
     * Required-any values remain part of aggregate scoring, but are not copied
     * into every slot as a hard candidate gate. Applying a global required type
     * list to each slot was eliminating otherwise strong venues whose tags and
     * vibes fit the intent.
     */
    vibeRequiredAnyTypes: [],

    vibeDiscouragedTypes:
      vibePlanning.stronglyDiscouragedTypes.length > 0
        ? uniqueStrings([
            ...vibePlanning.discouragedTypes,
            ...vibePlanning.stronglyDiscouragedTypes,
          ])
        : vibePlanning.discouragedTypes,
  }
}

function selectVibeSequenceTemplate(
  templates: VibeSequenceTemplate[],
  mode: PlanMode
): VibeSequenceTemplate | null {
  if (templates.length === 0) return null

  return (
    templates.find((template) => template.mode === mode) ??
    templates.find(
      (template) =>
        mode === "full" &&
        template.mode === "full"
    ) ??
    null
  )
}

function normalizeVibeSequenceTemplate(
  template: VibeSequenceTemplate
): VibeSequenceTemplate {
  const preferredTypesByRole =
    template.preferredTypesByRole
      ? Object.fromEntries(
          Object.entries(
            template.preferredTypesByRole
          ).map(([role, types]) => [
            role,
            uniqueStrings(types ?? []),
          ])
        )
      : undefined

  return {
    mode: template.mode,
    roles: [...template.roles],
    preferredTypesByRole:
      preferredTypesByRole as VibeSequenceTemplate["preferredTypesByRole"],
  }
}

function inferPreferredDaypartsForVibes(
  tokens: string[]
): VibePlanningProfile["preferredDayparts"] {
  const tokenSet = new Set(
    tokens.map(normalizeToken)
  )

  if (
    hasAnyTokenSet(tokenSet, [
      "high_energy",
      "high-energy",
      "nightlife",
      "party",
      "club",
      "late",
      "late-night",
    ])
  ) {
    return ["evening", "late_night"]
  }

  if (
    hasAnyTokenSet(tokenSet, [
      "romantic",
      "upscale",
      "wine",
      "dinner",
      "cocktail",
      "lounge",
    ])
  ) {
    return ["afternoon", "evening", "late_night"]
  }

  if (
    hasAnyTokenSet(tokenSet, [
      "creative",
      "gallery",
      "museum",
      "bookstore",
      "market",
    ])
  ) {
    return ["midday", "afternoon", "evening"]
  }

  if (
    hasAnyTokenSet(tokenSet, [
      "cozy",
      "chill",
      "casual",
      "coffee",
      "cafe",
      "brunch",
      "daytime",
    ])
  ) {
    return ["morning", "midday", "afternoon", "evening"]
  }

  return []
}

function inferDiscouragedDaypartsForVibes(
  tokens: string[]
): VibePlanningProfile["discouragedDayparts"] {
  const tokenSet = new Set(
    tokens.map(normalizeToken)
  )

  if (
    hasAnyTokenSet(tokenSet, [
      "high_energy",
      "high-energy",
      "nightlife",
      "party",
      "club",
    ])
  ) {
    return ["early_morning", "morning"]
  }

  if (
    hasAnyTokenSet(tokenSet, [
      "chill",
      "cozy",
      "coffee",
      "brunch",
      "daytime",
    ])
  ) {
    return ["late_night"]
  }

  return []
}

function dwellMinutesForRole(
  role: StopRole,
  phase: SlotPhase,
  referenceAt: Date,
  timeZone: string,
  archetype: string
): number {
  const referenceHour =
    getHourFractionInTimeZone(
      referenceAt,
      timeZone
    )

  const socialSportsDaytime =
    archetype === "social_sports" &&
    referenceHour < 17

  if (socialSportsDaytime) {
    if (role === "food") {
      return phase === "before" ? 60 : 70
    }

    if (role === "drink") {
      return phase === "before" ? 50 : 60
    }

    if (role === "coffee") return 35
    if (role === "activity") return 45
    if (role === "dessert") return 35
  }

  if (role === "food") {
    return phase === "before" ? 70 : 80
  }

  if (role === "drink") {
    return phase === "before" ? 55 : 70
  }

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
  archetype: string
): StopRole | null {
  const daypart = getDaypart(
    arrival,
    timeZone
  )

  const arrivalHour =
    getHourFractionInTimeZone(
      arrival,
      timeZone
    )

  if (archetype === "social_sports") {
    if (arrivalHour < 11) {
      if (role === "food") return "coffee"
      if (role === "drink") return "coffee"
    }

    if (arrivalHour < 15) {
      if (role === "drink") return "food"
    }

    if (
      phase === "after" &&
      arrivalHour < 17 &&
      role === "drink"
    ) {
      return "food"
    }
  }

  if (
    phase === "after" &&
    daypart === "late_night"
  ) {
    if (role === "drink") return null
    if (role === "food") return "drink"

    return null
  }

  if (
    phase === "before" &&
    role === "coffee"
  ) {
    return "food"
  }

  if (
    phase === "before" &&
    role === "food" &&
    (
      daypart === "breakfast" ||
      daypart === "brunch"
    )
  ) {
    return "coffee"
  }

  if (
    phase === "after" &&
    archetype === "food_drink" &&
    role === "food"
  ) {
    return "drink"
  }

  return flexibleRoleFor(
    role,
    phase,
    daypart
  )
}

function flexibleRoleFor(
  role: StopRole,
  phase: SlotPhase,
  daypart: ReturnType<typeof getDaypart>
): StopRole | null {
  if (phase === "before") {
    if (role === "coffee") return "food"

    if (
      role === "food" &&
      (
        daypart === "breakfast" ||
        daypart === "brunch"
      )
    ) {
      return "coffee"
    }

    if (
      role === "drink" &&
      daypart === "lunch"
    ) {
      return "food"
    }

    return null
  }

  if (role === "drink") return "dessert"
  if (role === "dessert") return "drink"
  if (role === "food") return "drink"
  if (role === "coffee") return "food"

  return null
}

function inferFallbackPlannedStartAt(
  mode: PlanMode,
  startsAt: Date,
  effectiveExitAt: Date,
  timeZone: string
): Date {
  const startHour =
    getHourFractionInTimeZone(
      startsAt,
      timeZone
    )

  if (mode === "after") {
    return addMinutes(
      effectiveExitAt,
      AFTER_EVENT_BUFFER_MINUTES
    )
  }

  if (startHour < 11) {
    return addMinutes(startsAt, -105)
  }

  if (startHour < 15) {
    return addMinutes(startsAt, -115)
  }

  if (startHour < 19) {
    return addMinutes(startsAt, -105)
  }

  return addMinutes(startsAt, -100)
}

function inferFallbackPlannedEndAt(
  mode: PlanMode,
  startsAt: Date,
  effectiveExitAt: Date,
  timeZone: string
): Date {
  const exitHour =
    getHourFractionInTimeZone(
      effectiveExitAt,
      timeZone
    )

  if (mode === "before") {
    return addMinutes(
      startsAt,
      -BEFORE_EVENT_BUFFER_MINUTES
    )
  }

  if (exitHour < 11) {
    return addMinutes(effectiveExitAt, 95)
  }

  if (exitHour < 17) {
    return addMinutes(effectiveExitAt, 120)
  }

  if (exitHour < 21) {
    return addMinutes(effectiveExitAt, 150)
  }

  return addMinutes(effectiveExitAt, 180)
}

function parseValidDate(
  value?: string | null
): Date | null {
  if (!value) return null

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed
}

function normalizeTimeZone(
  timeZone?: string | null
): string {
  const normalized =
    timeZone?.trim() || DEFAULT_TIME_ZONE

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: normalized,
    }).format(new Date())

    return normalized
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function normalizeLeaveEarlyByHours(
  value?: LeaveEarlyByHours | number | null
): LeaveEarlyByHours | null {
  if (!Number.isFinite(value)) return null

  const normalized =
    Math.floor(Number(value)) as LeaveEarlyByHours

  return ALLOWED_LEAVE_EARLY_BY_HOURS.includes(
    normalized
  )
    ? normalized
    : null
}

function normalizeStringArray(
  value: string[] | string | null | undefined
): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      String(entry)
    )
  }

  if (value == null) return []

  return [String(value)]
}

function normalizeTokenFragments(
  value: string
): string[] {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[\s,./|_\-–—()[\]{}:;!?+]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function normalizeToken(
  value: string
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

function scoreTokenMatches(
  tags: string[],
  weights: Record<string, number>
): number {
  return tags.reduce(
    (score, tag) =>
      score + (weights[tag] ?? 0),
    0
  )
}

function hasAnyToken(
  tags: string[],
  expected: string[]
): boolean {
  const tagSet = new Set(tags)

  return expected.some((token) =>
    tagSet.has(token)
  )
}

function hasAnyTokenSet(
  tokenSet: Set<string>,
  expected: string[]
): boolean {
  return expected.some((token) =>
    tokenSet.has(normalizeToken(token))
  )
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(new Set(values))
}

export { addMinutes }