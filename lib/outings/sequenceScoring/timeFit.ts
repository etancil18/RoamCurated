// lib/outings/sequenceScoring/timeFit.ts

import type {
  PlanningContext,
  PlanningSlot,
  VenueRecord,
} from "../types"

import {
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

import {
  normalizeFeatureValues,
} from "../venueFeatures"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type TimeFitAvailability =
  | "confirmed_open"
  | "likely_open"
  | "unknown"
  | "confirmed_closed"

export type TimeFitConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient"

export type TimeFitBreakdown = {
  hoursFit: number
  timeCategoryFit: number
  daypartFit: number
  phaseFit: number
  dataQualityAdjustment: number
  closurePenalty: number
}

export type TimeFitEvidence = {
  timeZone: string
  arrivalAt: string
  departureAt: string
  arrivalWeekday: WeekdayKey
  arrivalMinutes: number
  departureMinutes: number
  daypart: VenueDaypart

  normalizedTimeCategories: string[]
  matchedTimeCategories: string[]
  conflictingTimeCategories: string[]

  hoursKnown: boolean
  hoursSource: "structured" | "json_string" | "unstructured_string" | "missing"
  hoursEntryFound: boolean
  matchedHoursInterval: {
    openMinutes: number
    closeMinutes: number
    sourceWeekday: WeekdayKey
    crossesMidnight: boolean
  } | null

  closesBeforeDeparture: boolean
  opensAfterArrival: boolean
}

export type TimeFitResult = {
  score: number
  availability: TimeFitAvailability
  confidence: TimeFitConfidence
  confidenceScore: number

  isHardClosed: boolean
  hasReliableHours: boolean
  hasTimeCategoryEvidence: boolean

  breakdown: TimeFitBreakdown
  evidence: TimeFitEvidence
}

export type ComputeTimeFitInput = {
  venue: Pick<
    VenueRecord,
    "hours" | "time_category" | "type" | "tags" | "vibe"
  >
  slot: PlanningSlot
  context: PlanningContext
}

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"

type VenueDaypart =
  | "early_morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "late_night"

type HoursEntry = {
  open?: string | null
  close?: string | null
}

type HoursRecord = Partial<Record<WeekdayKey, HoursEntry>>

type ParsedHours = {
  record: HoursRecord | null
  source: TimeFitEvidence["hoursSource"]
  known: boolean
}

type ParsedInterval = {
  openMinutes: number
  closeMinutes: number
  sourceWeekday: WeekdayKey
  crossesMidnight: boolean
}

// -----------------------------------------------------------------------------
// Scoring constants
// -----------------------------------------------------------------------------

const CONFIRMED_OPEN_SCORE = 34
const LIKELY_OPEN_SCORE = 14
const UNKNOWN_HOURS_SCORE = 0
const CONFIRMED_CLOSED_PENALTY = 90

const MATCHED_TIME_CATEGORY_SCORE = 20
const PARTIAL_TIME_CATEGORY_SCORE = 8
const CONFLICTING_TIME_CATEGORY_PENALTY = 20

const PHASE_COMPATIBILITY_SCORE = 4
const MAX_TIME_FIT_SCORE = 70
const MIN_TIME_FIT_SCORE = -100

const WEEKDAYS: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

const DAYPART_CATEGORY_TOKENS: Record<VenueDaypart, string[]> = {
  early_morning: [
    "early morning",
    "breakfast",
    "morning",
    "coffee",
  ],

  morning: [
    "morning",
    "breakfast",
    "brunch",
    "coffee",
    "daytime",
  ],

  midday: [
    "midday",
    "lunch",
    "brunch",
    "daytime",
    "afternoon",
  ],

  afternoon: [
    "afternoon",
    "lunch",
    "daytime",
    "happy hour",
    "early evening",
  ],

  evening: [
    "evening",
    "dinner",
    "happy hour",
    "night",
    "cocktails",
  ],

  late_night: [
    "late night",
    "nightlife",
    "after hours",
    "night",
    "cocktails",
    "bar",
  ],
}

const ADJACENT_DAYPARTS: Record<VenueDaypart, VenueDaypart[]> = {
  early_morning: ["morning"],
  morning: ["early_morning", "midday"],
  midday: ["morning", "afternoon"],
  afternoon: ["midday", "evening"],
  evening: ["afternoon", "late_night"],
  late_night: ["evening"],
}

const STRONG_TIME_CONFLICTS: Record<VenueDaypart, string[]> = {
  early_morning: [
    "late night",
    "after hours",
    "nightlife",
    "dinner only",
  ],

  morning: [
    "late night",
    "after hours",
    "nightlife",
    "dinner only",
  ],

  midday: [
    "late night only",
    "after hours",
    "nightlife only",
  ],

  afternoon: [
    "breakfast only",
    "early morning only",
    "late night only",
  ],

  evening: [
    "breakfast only",
    "morning only",
    "lunch only",
  ],

  late_night: [
    "breakfast",
    "morning only",
    "lunch only",
    "daytime only",
  ],
}

// -----------------------------------------------------------------------------
// Primary API
// -----------------------------------------------------------------------------

export function computeTimeFit({
  venue,
  slot,
  context,
}: ComputeTimeFitInput): TimeFitResult {
  const timeZone = resolvePlannerTimeZone(context)

  const arrivalAt = slot.targetArrivalAt
  const departureAt = slot.targetDepartureAt

  const arrivalWeekday = getWeekdayInTimeZone(arrivalAt, timeZone)
  const previousWeekday = getPreviousWeekday(arrivalWeekday)

  const arrivalMinutes = getLocalMinutesInDay(arrivalAt, timeZone)
  const departureMinutes = getRelativeDepartureMinutes({
    arrivalAt,
    departureAt,
    timeZone,
  })

  const daypart = resolveVenueDaypart(
    getHourFractionInTimeZone(arrivalAt, timeZone)
  )

  const normalizedTimeCategories = normalizeSemanticValues(
    venue.time_category
  )

  const matchedTimeCategories = findTimeCategoryMatches({
    categories: normalizedTimeCategories,
    daypart,
  })

  const conflictingTimeCategories = findMatches(
    normalizedTimeCategories,
    STRONG_TIME_CONFLICTS[daypart]
  )

  const parsedHours = parseVenueHours(venue.hours)

  const todayIntervals = parsedHours.record
    ? parseIntervalsForWeekday({
        record: parsedHours.record,
        weekday: arrivalWeekday,
        relativeDayOffset: 0,
      })
    : []

  const previousDayOvernightIntervals = parsedHours.record
    ? parseIntervalsForWeekday({
        record: parsedHours.record,
        weekday: previousWeekday,
        relativeDayOffset: -1,
      }).filter((interval) => interval.crossesMidnight)
    : []

  const availableIntervals = [
    ...previousDayOvernightIntervals,
    ...todayIntervals,
  ]

  const matchedHoursInterval =
    availableIntervals.find((interval) =>
      intervalCoversSlot({
        interval,
        arrivalMinutes,
        departureMinutes,
      })
    ) ?? null

  const hoursEntryFound =
    parsedHours.record != null &&
    Object.prototype.hasOwnProperty.call(
      parsedHours.record,
      arrivalWeekday
    )

  const weekdayEntry = parsedHours.record?.[arrivalWeekday]
  const explicitlyClosed =
    hoursEntryFound &&
    isExplicitlyClosedEntry(weekdayEntry)

  const opensAfterArrival =
    parsedHours.known &&
    !matchedHoursInterval &&
    availableIntervals.some(
      (interval) =>
        interval.openMinutes > arrivalMinutes &&
        interval.openMinutes < departureMinutes
    )

  const closesBeforeDeparture =
    parsedHours.known &&
    !matchedHoursInterval &&
    availableIntervals.some(
      (interval) =>
        interval.openMinutes <= arrivalMinutes &&
        interval.closeMinutes > arrivalMinutes &&
        interval.closeMinutes < departureMinutes
    )

  const isHardClosed =
    parsedHours.known &&
    (
      explicitlyClosed ||
      (
        hoursEntryFound &&
        availableIntervals.length > 0 &&
        matchedHoursInterval == null
      ) ||
      opensAfterArrival ||
      closesBeforeDeparture
    )

  const hoursFit = resolveHoursFitScore({
    parsedHours,
    matchedHoursInterval,
    isHardClosed,
    matchedTimeCategoryCount: matchedTimeCategories.length,
  })

  const timeCategoryFit = resolveTimeCategoryFitScore({
    categories: normalizedTimeCategories,
    matchedTimeCategories,
    conflictingTimeCategories,
    daypart,
  })

  const daypartFit = resolveAdjacentDaypartScore({
    categories: normalizedTimeCategories,
    daypart,
    exactMatches: matchedTimeCategories,
  })

  const phaseFit = resolvePhaseFitScore({
    slot,
    daypart,
    categories: normalizedTimeCategories,
  })

  const dataQualityAdjustment = resolveDataQualityAdjustment({
    hoursKnown: parsedHours.known,
    hasTimeCategories: normalizedTimeCategories.length > 0,
    hoursSource: parsedHours.source,
  })

  const closurePenalty =
    isHardClosed
      ? CONFIRMED_CLOSED_PENALTY
      : conflictingTimeCategories.length > 0
        ? Math.min(
            conflictingTimeCategories.length *
              CONFLICTING_TIME_CATEGORY_PENALTY,
            40
          )
        : 0

  const breakdown: TimeFitBreakdown = {
    hoursFit,
    timeCategoryFit,
    daypartFit,
    phaseFit,
    dataQualityAdjustment,
    closurePenalty,
  }

  const rawScore =
    hoursFit +
    timeCategoryFit +
    daypartFit +
    phaseFit +
    dataQualityAdjustment -
    closurePenalty

  const score = clamp(
    Math.round(rawScore),
    MIN_TIME_FIT_SCORE,
    MAX_TIME_FIT_SCORE
  )

  const availability = resolveAvailability({
    parsedHours,
    matchedHoursInterval,
    isHardClosed,
    matchedTimeCategoryCount: matchedTimeCategories.length,
    conflictingTimeCategoryCount: conflictingTimeCategories.length,
  })

  const confidenceScore = computeTimeFitConfidenceScore({
    parsedHours,
    hoursEntryFound,
    matchedHoursInterval,
    isHardClosed,
    timeCategoryCount: normalizedTimeCategories.length,
    matchedTimeCategoryCount: matchedTimeCategories.length,
  })

  const confidence = resolveTimeFitConfidence({
    confidenceScore,
    parsedHours,
    timeCategoryCount: normalizedTimeCategories.length,
  })

  return {
    score,
    availability,
    confidence,
    confidenceScore,
    isHardClosed,
    hasReliableHours:
      parsedHours.known &&
      parsedHours.source !== "unstructured_string",
    hasTimeCategoryEvidence:
      normalizedTimeCategories.length > 0,
    breakdown,
    evidence: {
      timeZone,
      arrivalAt: arrivalAt.toISOString(),
      departureAt: departureAt.toISOString(),
      arrivalWeekday,
      arrivalMinutes,
      departureMinutes,
      daypart,
      normalizedTimeCategories,
      matchedTimeCategories,
      conflictingTimeCategories,
      hoursKnown: parsedHours.known,
      hoursSource: parsedHours.source,
      hoursEntryFound,
      matchedHoursInterval: matchedHoursInterval
        ? {
            openMinutes: matchedHoursInterval.openMinutes,
            closeMinutes: matchedHoursInterval.closeMinutes,
            sourceWeekday: matchedHoursInterval.sourceWeekday,
            crossesMidnight: matchedHoursInterval.crossesMidnight,
          }
        : null,
      closesBeforeDeparture,
      opensAfterArrival,
    },
  }
}

/**
 * Convenience wrapper for ranking pipelines that only need a number.
 */
export function scoreTimeFit(
  venue: ComputeTimeFitInput["venue"],
  slot: PlanningSlot,
  context: PlanningContext
): number {
  return computeTimeFit({
    venue,
    slot,
    context,
  }).score
}

/**
 * A confirmed closure should remain a hard constraint in strict and balanced
 * selection passes.
 *
 * Missing hours are intentionally not treated as a hard failure.
 */
export function isVenueConfirmedClosedForSlot(
  venue: ComputeTimeFitInput["venue"],
  slot: PlanningSlot,
  context: PlanningContext
): boolean {
  return computeTimeFit({
    venue,
    slot,
    context,
  }).isHardClosed
}

/**
 * Use this before showing user-facing claims such as "open after the event" or
 * "ideal for a late-night stop."
 */
export function hasConfidentTimeFit(
  result: TimeFitResult,
  minimumConfidence = 0.65
): boolean {
  return (
    result.confidenceScore >= minimumConfidence &&
    result.availability !== "unknown"
  )
}

/**
 * Conservative metadata suitable for candidate diagnostics and persisted stop
 * metadata.
 */
export function getTimeFitMetadata(
  result: TimeFitResult
): {
  timeFitScore: number
  timeFitConfidence: number
  timeFitConfidenceLabel: TimeFitConfidence
  timeFitAvailability: TimeFitAvailability
  timeFitDaypart: VenueDaypart
  timeFitMatchedCategories: string[]
  timeFitConflictingCategories: string[]
  timeFitHoursKnown: boolean
  timeFitIsHardClosed: boolean
  timeFitBreakdown: TimeFitBreakdown
} {
  return {
    timeFitScore: result.score,
    timeFitConfidence: result.confidenceScore,
    timeFitConfidenceLabel: result.confidence,
    timeFitAvailability: result.availability,
    timeFitDaypart: result.evidence.daypart,
    timeFitMatchedCategories:
      result.evidence.matchedTimeCategories,
    timeFitConflictingCategories:
      result.evidence.conflictingTimeCategories,
    timeFitHoursKnown:
      result.evidence.hoursKnown,
    timeFitIsHardClosed:
      result.isHardClosed,
    timeFitBreakdown:
      result.breakdown,
  }
}

// -----------------------------------------------------------------------------
// Score resolution
// -----------------------------------------------------------------------------

function resolveHoursFitScore({
  parsedHours,
  matchedHoursInterval,
  isHardClosed,
  matchedTimeCategoryCount,
}: {
  parsedHours: ParsedHours
  matchedHoursInterval: ParsedInterval | null
  isHardClosed: boolean
  matchedTimeCategoryCount: number
}): number {
  if (isHardClosed) return 0

  if (matchedHoursInterval) {
    return CONFIRMED_OPEN_SCORE
  }

  if (
    !parsedHours.known &&
    matchedTimeCategoryCount > 0
  ) {
    return LIKELY_OPEN_SCORE
  }

  return UNKNOWN_HOURS_SCORE
}

function resolveTimeCategoryFitScore({
  categories,
  matchedTimeCategories,
  conflictingTimeCategories,
  daypart,
}: {
  categories: string[]
  matchedTimeCategories: string[]
  conflictingTimeCategories: string[]
  daypart: VenueDaypart
}): number {
  if (categories.length === 0) return 0

  if (matchedTimeCategories.length > 0) {
    return Math.min(
      matchedTimeCategories.length * 10,
      MATCHED_TIME_CATEGORY_SCORE
    )
  }

  if (conflictingTimeCategories.length > 0) {
    return 0
  }

  const adjacentTokens = ADJACENT_DAYPARTS[daypart]
    .flatMap((adjacentDaypart) =>
      DAYPART_CATEGORY_TOKENS[adjacentDaypart]
    )

  if (
    findMatches(categories, adjacentTokens).length > 0
  ) {
    return PARTIAL_TIME_CATEGORY_SCORE
  }

  return 0
}

function resolveAdjacentDaypartScore({
  categories,
  daypart,
  exactMatches,
}: {
  categories: string[]
  daypart: VenueDaypart
  exactMatches: string[]
}): number {
  if (
    categories.length === 0 ||
    exactMatches.length > 0
  ) {
    return 0
  }

  const adjacentTokens =
    ADJACENT_DAYPARTS[daypart].flatMap(
      (adjacentDaypart) =>
        DAYPART_CATEGORY_TOKENS[adjacentDaypart]
    )

  return findMatches(
    categories,
    adjacentTokens
  ).length > 0
    ? 4
    : 0
}

function resolvePhaseFitScore({
  slot,
  daypart,
  categories,
}: {
  slot: PlanningSlot
  daypart: VenueDaypart
  categories: string[]
}): number {
  if (categories.length === 0) return 0

  if (
    slot.phase === "before" &&
    (
      daypart === "morning" ||
      daypart === "midday" ||
      daypart === "afternoon"
    ) &&
    findMatches(categories, [
      "morning",
      "breakfast",
      "brunch",
      "lunch",
      "daytime",
      "afternoon",
    ]).length > 0
  ) {
    return PHASE_COMPATIBILITY_SCORE
  }

  if (
    slot.phase === "after" &&
    (
      daypart === "evening" ||
      daypart === "late_night"
    ) &&
    findMatches(categories, [
      "evening",
      "night",
      "late night",
      "after hours",
      "dinner",
      "cocktails",
    ]).length > 0
  ) {
    return PHASE_COMPATIBILITY_SCORE
  }

  return 0
}

function resolveDataQualityAdjustment({
  hoursKnown,
  hasTimeCategories,
  hoursSource,
}: {
  hoursKnown: boolean
  hasTimeCategories: boolean
  hoursSource: TimeFitEvidence["hoursSource"]
}): number {
  if (
    hoursKnown &&
    hasTimeCategories &&
    hoursSource === "structured"
  ) {
    return 5
  }

  if (hoursKnown && hasTimeCategories) {
    return 3
  }

  if (hoursKnown || hasTimeCategories) {
    return 0
  }

  return -4
}

// -----------------------------------------------------------------------------
// Availability and confidence
// -----------------------------------------------------------------------------

function resolveAvailability({
  parsedHours,
  matchedHoursInterval,
  isHardClosed,
  matchedTimeCategoryCount,
  conflictingTimeCategoryCount,
}: {
  parsedHours: ParsedHours
  matchedHoursInterval: ParsedInterval | null
  isHardClosed: boolean
  matchedTimeCategoryCount: number
  conflictingTimeCategoryCount: number
}): TimeFitAvailability {
  if (isHardClosed) {
    return "confirmed_closed"
  }

  if (matchedHoursInterval) {
    return "confirmed_open"
  }

  if (
    !parsedHours.known &&
    matchedTimeCategoryCount > 0 &&
    conflictingTimeCategoryCount === 0
  ) {
    return "likely_open"
  }

  return "unknown"
}

function computeTimeFitConfidenceScore({
  parsedHours,
  hoursEntryFound,
  matchedHoursInterval,
  isHardClosed,
  timeCategoryCount,
  matchedTimeCategoryCount,
}: {
  parsedHours: ParsedHours
  hoursEntryFound: boolean
  matchedHoursInterval: ParsedInterval | null
  isHardClosed: boolean
  timeCategoryCount: number
  matchedTimeCategoryCount: number
}): number {
  let confidence = 0

  if (parsedHours.source === "structured") {
    confidence += 0.5
  } else if (parsedHours.source === "json_string") {
    confidence += 0.42
  } else if (parsedHours.source === "unstructured_string") {
    confidence += 0.12
  }

  if (hoursEntryFound) {
    confidence += 0.18
  }

  if (matchedHoursInterval || isHardClosed) {
    confidence += 0.2
  }

  if (timeCategoryCount > 0) {
    confidence += 0.1
  }

  if (matchedTimeCategoryCount > 0) {
    confidence += 0.08
  }

  return Number(
    clamp(confidence, 0, 0.99).toFixed(2)
  )
}

function resolveTimeFitConfidence({
  confidenceScore,
  parsedHours,
  timeCategoryCount,
}: {
  confidenceScore: number
  parsedHours: ParsedHours
  timeCategoryCount: number
}): TimeFitConfidence {
  if (
    !parsedHours.known &&
    timeCategoryCount === 0
  ) {
    return "insufficient"
  }

  if (confidenceScore >= 0.78) return "high"
  if (confidenceScore >= 0.52) return "medium"
  return "low"
}

// -----------------------------------------------------------------------------
// Hours parsing
// -----------------------------------------------------------------------------

function parseVenueHours(
  value: VenueRecord["hours"] | string | null | undefined
): ParsedHours {
  if (!value) {
    return {
      record: null,
      source: "missing",
      known: false,
    }
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const record = normalizeHoursRecord(
      value as Record<string, unknown>
    )

    return {
      record,
      source: "structured",
      known: Object.keys(record).length > 0,
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim()

    if (!trimmed) {
      return {
        record: null,
        source: "missing",
        known: false,
      }
    }

    try {
      const parsed = JSON.parse(trimmed)

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        const record = normalizeHoursRecord(
          parsed as Record<string, unknown>
        )

        return {
          record,
          source: "json_string",
          known: Object.keys(record).length > 0,
        }
      }
    } catch {
      return {
        record: null,
        source: "unstructured_string",
        known: false,
      }
    }
  }

  return {
    record: null,
    source: "missing",
    known: false,
  }
}

function normalizeHoursRecord(
  value: Record<string, unknown>
): HoursRecord {
  const record: HoursRecord = {}

  for (const [rawKey, rawEntry] of Object.entries(value)) {
    const weekday = normalizeWeekdayKey(rawKey)
    if (!weekday) continue

    const entry = normalizeHoursEntry(rawEntry)
    if (!entry) continue

    record[weekday] = entry
  }

  return record
}

function normalizeHoursEntry(
  value: unknown
): HoursEntry | null {
  if (value == null) return null

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const object =
      value as Record<string, unknown>

    const open =
      normalizeOptionalString(object.open) ??
      normalizeOptionalString(object.opens) ??
      normalizeOptionalString(object.start)

    const close =
      normalizeOptionalString(object.close) ??
      normalizeOptionalString(object.closes) ??
      normalizeOptionalString(object.end)

    if (!open && !close) return null

    return {
      open,
      close,
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim()

    if (!normalized) return null

    if (isClosedText(normalized)) {
      return {
        open: "closed",
        close: "closed",
      }
    }

    if (isTwentyFourHourText(normalized)) {
      return {
        open: "00:00",
        close: "24:00",
      }
    }

    const parts = normalized.split(
      /\s*(?:-|–|—|to)\s*/i
    )

    if (parts.length >= 2) {
      return {
        open: parts[0]?.trim() || null,
        close: parts[1]?.trim() || null,
      }
    }
  }

  return null
}

function parseIntervalsForWeekday({
  record,
  weekday,
  relativeDayOffset,
}: {
  record: HoursRecord
  weekday: WeekdayKey
  relativeDayOffset: number
}): ParsedInterval[] {
  const entry = record[weekday]
  if (!entry || isExplicitlyClosedEntry(entry)) {
    return []
  }

  const openMinutes = parseTimeToMinutes(entry.open)
  const closeMinutes = parseTimeToMinutes(entry.close)

  if (
    openMinutes == null ||
    closeMinutes == null
  ) {
    return []
  }

  const baseOffset =
    relativeDayOffset * 1440

  const normalizedOpen =
    baseOffset + openMinutes

  let normalizedClose =
    baseOffset + closeMinutes

  const crossesMidnight =
    closeMinutes <= openMinutes &&
    closeMinutes !== 1440

  if (crossesMidnight) {
    normalizedClose += 1440
  }

  if (closeMinutes === 1440) {
    normalizedClose =
      baseOffset + 1440
  }

  return [
    {
      openMinutes: normalizedOpen,
      closeMinutes: normalizedClose,
      sourceWeekday: weekday,
      crossesMidnight,
    },
  ]
}

function intervalCoversSlot({
  interval,
  arrivalMinutes,
  departureMinutes,
}: {
  interval: ParsedInterval
  arrivalMinutes: number
  departureMinutes: number
}): boolean {
  return (
    interval.openMinutes <= arrivalMinutes &&
    interval.closeMinutes >= departureMinutes
  )
}

// -----------------------------------------------------------------------------
// Time parsing
// -----------------------------------------------------------------------------

function parseTimeToMinutes(
  value?: string | null
): number | null {
  if (!value) return null

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")

  if (!normalized) return null
  if (isClosedText(normalized)) return null

  if (isTwentyFourHourText(normalized)) {
    return 0
  }

  if (
    normalized === "24:00" ||
    normalized === "2400"
  ) {
    return 1440
  }

  const twelveHourMatch = normalized.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/
  )

  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1])
    const minute = Number(
      twelveHourMatch[2] ?? "0"
    )
    const period = twelveHourMatch[3]

    if (
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
    ) {
      return null
    }

    if (hour === 12) hour = 0
    if (period === "pm") hour += 12

    return hour * 60 + minute
  }

  const twentyFourHourMatch =
    normalized.match(/^(\d{1,2}):?(\d{2})$/)

  if (twentyFourHourMatch) {
    const hour = Number(
      twentyFourHourMatch[1]
    )
    const minute = Number(
      twentyFourHourMatch[2]
    )

    if (
      hour === 24 &&
      minute === 0
    ) {
      return 1440
    }

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null
    }

    return hour * 60 + minute
  }

  const hourOnlyMatch =
    normalized.match(/^(\d{1,2})$/)

  if (hourOnlyMatch) {
    const hour = Number(hourOnlyMatch[1])

    if (hour >= 0 && hour <= 23) {
      return hour * 60
    }
  }

  return null
}

// -----------------------------------------------------------------------------
// Daypart and local date helpers
// -----------------------------------------------------------------------------

function resolveVenueDaypart(
  hour: number
): VenueDaypart {
  if (hour < 7) return "early_morning"
  if (hour < 11) return "morning"
  if (hour < 14) return "midday"
  if (hour < 17.5) return "afternoon"
  if (hour < 22) return "evening"
  return "late_night"
}

function getRelativeDepartureMinutes({
  arrivalAt,
  departureAt,
  timeZone,
}: {
  arrivalAt: Date
  departureAt: Date
  timeZone: string
}): number {
  const arrivalDayKey =
    getCalendarDayKey(arrivalAt, timeZone)

  const departureDayKey =
    getCalendarDayKey(departureAt, timeZone)

  const localDepartureMinutes =
    getLocalMinutesInDay(departureAt, timeZone)

  if (departureDayKey === arrivalDayKey) {
    return localDepartureMinutes
  }

  const elapsedMinutes =
    Math.max(
      0,
      Math.round(
        (departureAt.getTime() -
          arrivalAt.getTime()) /
          60_000
      )
    )

  const localArrivalMinutes =
    getLocalMinutesInDay(arrivalAt, timeZone)

  const inferredDeparture =
    localArrivalMinutes + elapsedMinutes

  return Math.max(
    localDepartureMinutes + 1440,
    inferredDeparture
  )
}

function getLocalMinutesInDay(
  date: Date,
  timeZone: string
): number {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)

  let hour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value ?? "0"
  )

  const minute = Number(
    parts.find(
      (part) => part.type === "minute"
    )?.value ?? "0"
  )

  if (hour === 24) hour = 0

  return hour * 60 + minute
}

function getCalendarDayKey(
  date: Date,
  timeZone: string
): string {
  const parts =
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)

  const year =
    parts.find(
      (part) => part.type === "year"
    )?.value ?? "0000"

  const month =
    parts.find(
      (part) => part.type === "month"
    )?.value ?? "00"

  const day =
    parts.find(
      (part) => part.type === "day"
    )?.value ?? "00"

  return `${year}-${month}-${day}`
}

function getWeekdayInTimeZone(
  date: Date,
  timeZone: string
): WeekdayKey {
  const weekday =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    })
      .format(date)
      .toLowerCase()

  return normalizeWeekdayKey(weekday) ??
    "monday"
}

function getPreviousWeekday(
  weekday: WeekdayKey
): WeekdayKey {
  const index = WEEKDAYS.indexOf(weekday)

  return WEEKDAYS[
    (index - 1 + WEEKDAYS.length) %
      WEEKDAYS.length
  ]
}

function normalizeWeekdayKey(
  value: string
): WeekdayKey | null {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")

  if (
    normalized === "mon" ||
    normalized === "monday"
  ) {
    return "monday"
  }

  if (
    normalized === "tue" ||
    normalized === "tues" ||
    normalized === "tuesday"
  ) {
    return "tuesday"
  }

  if (
    normalized === "wed" ||
    normalized === "wednesday"
  ) {
    return "wednesday"
  }

  if (
    normalized === "thu" ||
    normalized === "thur" ||
    normalized === "thurs" ||
    normalized === "thursday"
  ) {
    return "thursday"
  }

  if (
    normalized === "fri" ||
    normalized === "friday"
  ) {
    return "friday"
  }

  if (
    normalized === "sat" ||
    normalized === "saturday"
  ) {
    return "saturday"
  }

  if (
    normalized === "sun" ||
    normalized === "sunday"
  ) {
    return "sunday"
  }

  return null
}

// -----------------------------------------------------------------------------
// Time-category matching
// -----------------------------------------------------------------------------

function findTimeCategoryMatches({
  categories,
  daypart,
}: {
  categories: string[]
  daypart: VenueDaypart
}): string[] {
  return findMatches(
    categories,
    DAYPART_CATEGORY_TOKENS[daypart]
  )
}

function normalizeSemanticValues(
  value: unknown
): string[] {
  const normalizedInput:
    | string
    | number
    | string[]
    | null
    | undefined =
    typeof value === "string" ||
    typeof value === "number" ||
    value == null
      ? value
      : Array.isArray(value)
        ? value
            .filter(
              (entry): entry is string | number =>
                typeof entry === "string" ||
                typeof entry === "number"
            )
            .map((entry) => String(entry))
        : undefined

  return uniqueStrings(
    normalizeFeatureValues(normalizedInput)
      .map(canonicalizeToken)
      .filter((value): value is string => Boolean(value))
  )
}

function findMatches(
  source: string[],
  targets: string[]
): string[] {
  if (
    source.length === 0 ||
    targets.length === 0
  ) {
    return []
  }

  const normalizedSource = uniqueStrings(
    source
      .map(canonicalizeToken)
      .filter(Boolean)
  )

  const normalizedTargets = uniqueStrings(
    targets
      .map(canonicalizeToken)
      .filter(Boolean)
  )

  return uniqueStrings(
    normalizedTargets.filter((target) =>
      normalizedSource.some((sourceValue) =>
        tokensAreEquivalent(
          sourceValue,
          target
        )
      )
    )
  )
}

function tokensAreEquivalent(
  source: string,
  target: string
): boolean {
  if (source === target) return true

  if (
    source.length >= 5 &&
    target.length >= 5
  ) {
    if (source.includes(target)) return true
    if (target.includes(source)) return true
  }

  return false
}

function canonicalizeToken(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[_–—-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// -----------------------------------------------------------------------------
// General helpers
// -----------------------------------------------------------------------------

function isExplicitlyClosedEntry(
  entry?: HoursEntry | null
): boolean {
  if (!entry) return false

  const open = entry.open?.trim() ?? ""
  const close = entry.close?.trim() ?? ""

  return (
    isClosedText(open) ||
    isClosedText(close)
  )
}

function isClosedText(
  value: string
): boolean {
  const normalized = value
    .trim()
    .toLowerCase()

  return (
    normalized === "closed" ||
    normalized === "close" ||
    normalized === "unavailable" ||
    normalized === "n/a"
  )
}

function isTwentyFourHourText(
  value: string
): boolean {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

  return (
    normalized === "24hours" ||
    normalized === "24hour" ||
    normalized === "open24hours" ||
    normalized === "open24hour"
  )
}

function normalizeOptionalString(
  value: unknown
): string | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null
  }

  const normalized =
    String(value).trim()

  return normalized.length > 0
    ? normalized
    : null
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(values.filter(Boolean))
  )
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum
  )
}