// lib/outings/sequenceScoring/time.ts

import type { PlanningContext } from "../types"
import { CITY_CONFIGS } from "@/config/cities"

export const DEFAULT_TIME_ZONE = "America/New_York"

export function resolvePlannerTimeZone(context: PlanningContext): string {
  return context.timeZone ?? resolvePlannerTimeZoneFromCity(context)
}

export function resolvePlannerTimeZoneFromCity(
  context: Pick<PlanningContext, "anchorVenue">
): string {
  const cityKey = context.anchorVenue?.city?.trim().toLowerCase()
  if (!cityKey) return DEFAULT_TIME_ZONE
  return CITY_CONFIGS[cityKey]?.timezone ?? DEFAULT_TIME_ZONE
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function getHourFractionInTimeZone(date: Date, timeZone: string): number {
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

export function getLocalMinutesInDay(date: Date, timeZone: string): number {
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

export function getDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date)
}

export function getPreviousDayKey(date: Date, timeZone: string): string {
  const previous = new Date(date.getTime() - 24 * 60 * 60 * 1000)
  return getDayKey(previous, timeZone)
}

export function getCalendarDayKey(date: Date, timeZone: string): string {
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

export function endsAfterMidnight(
  context: Pick<PlanningContext, "startsAt" | "estimatedEndAt">,
  timeZone: string
): boolean {
  const startDayKey = getCalendarDayKey(context.startsAt, timeZone)
  const endDayKey = getCalendarDayKey(context.estimatedEndAt, timeZone)

  if (startDayKey !== endDayKey) return true

  const endMinutes = getLocalMinutesInDay(context.estimatedEndAt, timeZone)
  return endMinutes < 4 * 60
}