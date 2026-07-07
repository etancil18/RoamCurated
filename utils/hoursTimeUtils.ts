import { DateTime } from 'luxon'

type HoursVenue = {
  hours?: unknown
}

type ParsedInterval = [DateTime, DateTime]

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
}

function dayIndexFromDateTime(atTime: DateTime): number {
  return atTime.weekday % 7
}

function normalizeDash(value: string): string {
  return value
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function getHoursLines(hours: unknown): string[] {
  if (!hours) return []

  if (Array.isArray(hours)) {
    return hours
      .map((line) => String(line).trim())
      .filter(Boolean)
  }

  if (typeof hours === 'string') {
    return hours
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
  }

  if (typeof hours === 'object') {
    return Object.entries(hours as Record<string, unknown>)
      .flatMap(([day, value]) => {
        const windows = normalizeObjectDayHours(value)
        if (windows.length === 0) return []
        return [`${day}: ${windows.join(', ')}`]
      })
      .filter(Boolean)
  }

  return []
}

function normalizeObjectDayHours(value: unknown): string[] {
  if (!value) return []

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap(normalizeObjectDayHours)
  }

  if (typeof value !== 'object') return []

  const obj = value as Record<string, unknown>

  const directOpen = getStringValue(obj.open ?? obj.opens)
  const directClose = getStringValue(obj.close ?? obj.closes)

  if (directOpen && directClose) {
    return [`${directOpen} - ${directClose}`]
  }

  const windows: string[] = []

  for (let index = 1; index <= 4; index += 1) {
    const open = getStringValue(obj[`open${index}`] ?? obj[`opens${index}`])
    const close = getStringValue(obj[`close${index}`] ?? obj[`closes${index}`])

    if (open && close) {
      windows.push(`${open} - ${close}`)
    }
  }

  return windows
}

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseLineDay(line: string): { dayIndex: number; rest: string } | null {
  const normalized = normalizeDash(line)
  const colonIndex = normalized.indexOf(':')

  if (colonIndex === -1) {
    const firstToken = normalized.split(' ')[0]?.toLowerCase()
    const dayIndex = DAY_ALIASES[firstToken]

    if (dayIndex == null) return null

    return {
      dayIndex,
      rest: normalized.slice(firstToken.length).trim(),
    }
  }

  const dayPart = normalized.slice(0, colonIndex).trim().toLowerCase()
  const rest = normalized.slice(colonIndex + 1).trim()

  const dayIndex = DAY_ALIASES[dayPart]

  if (dayIndex == null) return null

  return { dayIndex, rest }
}

function parseTimeToMinutes(value: string): number | null {
  const raw = value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw) return null

  if (raw === 'noon') return 12 * 60
  if (raw === 'midnight') return 0

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)

  if (!match) return null

  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (minute < 0 || minute > 59) return null

  if (meridiem === 'am') {
    if (hour === 12) hour = 0
  } else if (meridiem === 'pm') {
    if (hour !== 12) hour += 12
  }

  if (hour < 0 || hour > 24) return null

  return hour * 60 + minute
}

function splitWindows(rest: string): string[] {
  return normalizeDash(rest)
    .split(/\s*,\s*|\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseWindow(windowText: string): { openMinutes: number; closeMinutes: number } | null {
  const normalized = normalizeDash(windowText)

  if (
    /closed/i.test(normalized) ||
    /not open/i.test(normalized) ||
    /unavailable/i.test(normalized)
  ) {
    return null
  }

  if (/24\s*hours|open\s*24/i.test(normalized)) {
    return {
      openMinutes: 0,
      closeMinutes: 24 * 60,
    }
  }

  const parts = normalized.split(/\s*-\s*/)

  if (parts.length < 2) return null

  const openText = parts[0].trim()
  const closeText = parts.slice(1).join('-').trim()

  const openMinutes = parseTimeToMinutes(openText)
  let closeMinutes = parseTimeToMinutes(closeText)

  if (openMinutes == null || closeMinutes == null) return null

  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60
  }

  return { openMinutes, closeMinutes }
}

function intervalsForDay(
  atTime: DateTime,
  dayIndex: number,
  windowsText: string
): ParsedInterval[] {
  const intervals: ParsedInterval[] = []
  const startOfTargetDay = atTime
    .startOf('week')
    .plus({ days: dayIndex === 0 ? 6 : dayIndex - 1 })
    .startOf('day')

  const windows = splitWindows(windowsText)

  for (const windowText of windows) {
    const parsed = parseWindow(windowText)
    if (!parsed) continue

    const open = startOfTargetDay.plus({ minutes: parsed.openMinutes })
    const close = startOfTargetDay.plus({ minutes: parsed.closeMinutes })

    if (open.isValid && close.isValid && close > open) {
      intervals.push([open, close])
    }
  }

  return intervals
}

export function intervalsForDateFromHours(
  atTime: DateTime,
  hours: unknown
): ParsedInterval[] {
  if (!atTime?.isValid) return []

  const targetDayIndex = dayIndexFromDateTime(atTime)
  const previousDayIndex = targetDayIndex === 0 ? 6 : targetDayIndex - 1
  const lines = getHoursLines(hours)
  const intervals: ParsedInterval[] = []

  for (const line of lines) {
    const parsedLine = parseLineDay(line)
    if (!parsedLine) continue

    const { dayIndex, rest } = parsedLine

    if (dayIndex !== targetDayIndex && dayIndex !== previousDayIndex) {
      continue
    }

    const dayIntervals = intervalsForDay(atTime, dayIndex, rest)

    for (const [open, close] of dayIntervals) {
      if (dayIndex === previousDayIndex && close <= atTime.startOf('day')) {
        continue
      }

      intervals.push([open, close])
    }
  }

  return intervals
}

export function isOpenAtTimeFromHours(
  hours: unknown,
  atTime: DateTime
): boolean {
  const intervals = intervalsForDateFromHours(atTime, hours)

  return intervals.some(([open, close]) => {
    return atTime >= open && atTime < close
  })
}

export function isVenueOpenAtTimeFromHours(
  venue: HoursVenue,
  atTime: DateTime
): boolean {
  return isOpenAtTimeFromHours(venue.hours, atTime)
}

export function isVenueOpenWithinWindowFromHours(
  venue: HoursVenue,
  atTime: DateTime,
  windowMinutes: number
): boolean {
  if (!atTime?.isValid) return false

  const intervals = intervalsForDateFromHours(atTime, venue.hours)
  const windowEnd = atTime.plus({ minutes: Math.max(0, windowMinutes) })

  return intervals.some(([open, close]) => {
    const alreadyOpen = atTime >= open && atTime < close
    const opensSoon = open >= atTime && open <= windowEnd

    return alreadyOpen || opensSoon
  })
}

export function hasHoursForDayFromHours(
  hours: unknown,
  atTime: DateTime
): boolean {
  const targetDayIndex = dayIndexFromDateTime(atTime)
  const lines = getHoursLines(hours)

  return lines.some((line) => {
    const parsedLine = parseLineDay(line)
    return parsedLine?.dayIndex === targetDayIndex
  })
}

export function getTodayHoursLabelFromHours(
  hours: unknown,
  atTime: DateTime
): string | null {
  const targetDayIndex = dayIndexFromDateTime(atTime)
  const lines = getHoursLines(hours)

  for (const line of lines) {
    const parsedLine = parseLineDay(line)
    if (parsedLine?.dayIndex === targetDayIndex) {
      return parsedLine.rest || null
    }
  }

  return null
}

export function getDayNameForTime(atTime: DateTime): string {
  return DAY_NAMES[dayIndexFromDateTime(atTime)]
}