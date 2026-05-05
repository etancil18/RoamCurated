// lib/outings/sequenceScoring/helpers.ts

import type { Budget, StopRole } from "../types"

type VenueHoursEntry = {
  open?: string | null
  close?: string | null
}

type RawVenueHoursEntry = VenueHoursEntry & {
  open1?: string | null
  close1?: string | null
}

export function normalizePrice(
  value: string | number | null | undefined
): Budget | null {
  const allowedBudgets: Budget[] = ["$", "$$", "$$$", "$$$$"]

  if (typeof value === "number") {
    const n = Math.max(1, Math.min(4, Math.round(value)))
    return "$".repeat(n) as Budget
  }

  if (typeof value === "string") {
    const cleaned = value.trim()
    if (allowedBudgets.includes(cleaned as Budget)) return cleaned as Budget

    const dollarCount = cleaned.replace(/[^$]/g, "").length
    if (dollarCount >= 1 && dollarCount <= 4) {
      return "$".repeat(dollarCount) as Budget
    }
  }

  return null
}

export function priceToInt(value: Budget | null): number {
  return value ? value.length : 0
}

export function normalizeTags(values: string[]): string[] {
  return values
    .flatMap((value) => String(value).toLowerCase().split(/[\s,./|_-]+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function normalizeVenueType(
  value: string | string[] | null | undefined
): string {
  return normalizeVenueTypes(value)[0] ?? ""
}

export function normalizeVenueTypes(
  value: string | string[] | null | undefined
): string[] {
  const rawValues = Array.isArray(value) ? value : [value]

  return uniqueStrings(
    rawValues
      .map((entry) =>
        String(entry ?? "")
          .trim()
          .toLowerCase()
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
      )
      .filter(Boolean)
  )
}

export function normalizeDisplayVenueType(
  value: string | string[] | null | undefined
): string | null {
  const types = normalizeVenueTypes(value)
  return types[0] ?? null
}

export function normalizeStringArray(
  value: string | string[] | null | undefined
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeTags([String(entry)]))
  }

  if (value == null) return []

  return normalizeTags([String(value)])
}

export function normalizeVenueHours(
  value: Record<string, RawVenueHoursEntry> | string | null | undefined
): Record<string, VenueHoursEntry> | null {
  if (!value) return null

  const parsed =
    typeof value === "string"
      ? safeParseVenueHours(value)
      : value

  if (!parsed || typeof parsed !== "object") return null

  return Object.fromEntries(
    Object.entries(parsed).map(([day, entry]) => {
      const normalizedEntry = normalizeVenueHoursEntry(entry)
      return [day, normalizedEntry]
    })
  )
}

export function hasAnyType(
  venueTypes: string[],
  expectedTypes: string[]
): boolean {
  return expectedTypes.some((type) => venueTypes.includes(type))
}

export function isCoffeeLikeVenue(venueTypes: string[]): boolean {
  return hasAnyType(venueTypes, ["coffee", "tea", "cafe", "café", "bakery"])
}

export function isMealLikeVenue(venueTypes: string[]): boolean {
  return hasAnyType(venueTypes, ["breakfast", "brunch", "lunch", "dinner"])
}

export function isDinnerVenue(venueTypes: string[]): boolean {
  return hasAnyType(venueTypes, ["dinner"])
}

export function isDinnerDrinkHybridVenue(venueTypes: string[]): boolean {
  return (
    isDinnerVenue(venueTypes) &&
    hasAnyType(venueTypes, ["cocktail", "bar", "wine bar", "lounge"])
  )
}

export function isEarlyDinnerFallbackDrinkVenue(venueTypes: string[]): boolean {
  return hasAnyType(venueTypes, ["cocktail", "wine bar"])
}

export function isEarlyDinnerCompatibleVenue(venueTypes: string[]): boolean {
  return (
    isDinnerDrinkHybridVenue(venueTypes) ||
    isEarlyDinnerFallbackDrinkVenue(venueTypes)
  )
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

export function uniqueRoles(roles: StopRole[]): StopRole[] {
  return Array.from(new Set(roles))
}

export function humanizeRole(role: StopRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function safeParseVenueHours(
  value: string
): Record<string, RawVenueHoursEntry> | null {
  try {
    const parsed = JSON.parse(value) as Record<string, RawVenueHoursEntry>
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function normalizeVenueHoursEntry(
  entry: RawVenueHoursEntry | null | undefined
): VenueHoursEntry {
  if (!entry || typeof entry !== "object") {
    return {}
  }

  return {
    open: entry.open ?? entry.open1 ?? null,
    close: entry.close ?? entry.close1 ?? null,
  }
}