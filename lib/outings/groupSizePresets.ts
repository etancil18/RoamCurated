// lib/outings/groupSizePresets.ts

import type { PlanMode, StopRole } from "./types"

export type GroupSizePresetId =
  | "solo"
  | "duo"
  | "small_group"
  | "medium_group"
  | "big_group"

export type GroupSizePreset = {
  id: GroupSizePresetId
  label: string
  description: string
  min: number
  max: number
  representativeSize: number
  preferredTypes: string[]
  discouragedTypes: string[]
  preferredRolesBefore?: StopRole[]
  preferredRolesAfter?: StopRole[]
}

export const GROUP_SIZE_PRESETS: Record<GroupSizePresetId, GroupSizePreset> = {
  solo: {
    id: "solo",
    label: "Solo",
    description: "Flexible, low-friction, easy to tuck into niche spots",
    min: 1,
    max: 1,
    representativeSize: 1,
    preferredTypes: [
      "coffee",
      "cafe",
      "café",
      "lifestyle",
      "tea",
      "bookstore",
      "gallery",
      "museum",
      "park",
      "garden",
      "dessert",
      "bakery",
      "library",
      "wine bar",
      "yoga",
      "pilates",
      "spa",
    ],
    discouragedTypes: [
      "club",
      "sports bar",
      "market",
    ],
    preferredRolesBefore: ["coffee", "activity"],
    preferredRolesAfter: ["activity", "dessert"],
  },

  duo: {
    id: "duo",
    label: "2 People",
    description: "Conversation-friendly, date-friendly, intimate",
    min: 2,
    max: 2,
    representativeSize: 2,
    preferredTypes: [
      "wine bar",
      "cocktail",
      "lounge",
      "dessert",
      "dinner",
      "brunch",
      "cafe",
      "café",
      "tea",
      "rooftop",
    ],
    discouragedTypes: [
      "sports bar",
      "brewery",
      "club",
      "market",
      "fitness",
    ],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["drink", "dessert"],
  },

  small_group: {
    id: "small_group",
    label: "3–4",
    description: "Balanced and versatile without needing full group logistics",
    min: 3,
    max: 4,
    representativeSize: 4,
    preferredTypes: [
      "brunch",
      "lunch",
      "dinner",
      "bar",
      "cocktail",
      "brewery",
      "rooftop",
      "market",
      "gallery",
      "park",
      "dessert",
    ],
    discouragedTypes: [
      "library",
      "spa",
      "tea",
    ],
    preferredRolesBefore: ["food", "activity"],
    preferredRolesAfter: ["drink", "food"],
  },

  medium_group: {
    id: "medium_group",
    label: "5–8",
    description: "Social and group-friendly, with easier logistics in bigger venues",
    min: 5,
    max: 8,
    representativeSize: 6,
    preferredTypes: [
      "bar",
      "sports bar",
      "brewery",
      "rooftop",
      "market",
      "dinner",
      "lunch",
      "dessert",
      "club",
      "lounge",
    ],
    discouragedTypes: [
      "tea",
      "library",
      "bookstore",
      "spa",
      "bakery",
    ],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "food"],
  },

  big_group: {
    id: "big_group",
    label: "9+",
    description: "Best with easy logistics, spacious venues, and social momentum",
    min: 9,
    max: 20,
    representativeSize: 10,
    preferredTypes: [
      "sports bar",
      "bar",
      "brewery",
      "rooftop",
      "market",
      "club",
      "dinner",
      "lunch",
      "lounge",
    ],
    discouragedTypes: [
      "tea",
      "library",
      "bookstore",
      "bakery",
      "wine bar",
      "dessert",
      "spa",
    ],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "food"],
  },
}

export const GROUP_SIZE_PRESET_LIST: GroupSizePreset[] = [
  GROUP_SIZE_PRESETS.solo,
  GROUP_SIZE_PRESETS.duo,
  GROUP_SIZE_PRESETS.small_group,
  GROUP_SIZE_PRESETS.medium_group,
  GROUP_SIZE_PRESETS.big_group,
]

export function getGroupSizePreset(
  input?: number | string | null
): GroupSizePreset | null {
  const normalized = normalizeGroupSizeValue(input)
  if (normalized == null) return null

  return (
    GROUP_SIZE_PRESET_LIST.find(
      (preset) => normalized >= preset.min && normalized <= preset.max
    ) ?? null
  )
}

export function getGroupSizePresetById(
  id?: string | null
): GroupSizePreset | null {
  if (!id) return null
  const normalized = normalizePresetId(id)
  if (!normalized) return null
  return GROUP_SIZE_PRESETS[normalized] ?? null
}

export function getGroupSizePresetOptions(): Array<{
  id: GroupSizePresetId
  label: string
  description: string
  min: number
  max: number
  representativeSize: number
}> {
  return GROUP_SIZE_PRESET_LIST.map((preset) => ({
    id: preset.id,
    label: preset.label,
    description: preset.description,
    min: preset.min,
    max: preset.max,
    representativeSize: preset.representativeSize,
  }))
}

export function getRepresentativeGroupSize(
  input?: number | string | GroupSizePresetId | null
): number | null {
  const preset =
    typeof input === "string" && normalizePresetId(input)
      ? getGroupSizePresetById(input)
      : getGroupSizePreset(input as number | string | null)

  return preset?.representativeSize ?? null
}

export function getPreferredTypesForGroupSize(
  input?: number | string | GroupSizePresetId | null
): string[] {
  const preset = resolvePreset(input)
  return preset ? uniqueStrings(preset.preferredTypes) : []
}

export function getDiscouragedTypesForGroupSize(
  input?: number | string | GroupSizePresetId | null
): string[] {
  const preset = resolvePreset(input)
  return preset ? uniqueStrings(preset.discouragedTypes) : []
}

export function getPreferredRolesForGroupSize(
  input: {
    groupSize?: number | string | GroupSizePresetId | null
    mode: PlanMode
  }
): StopRole[] {
  const preset = resolvePreset(input.groupSize)
  if (!preset) return []

  return uniqueRoles(
    input.mode === "before"
      ? (preset.preferredRolesBefore ?? [])
      : (preset.preferredRolesAfter ?? [])
  )
}

export function applyGroupSizeRoleBias(
  desiredRoles: StopRole[],
  input: {
    groupSize?: number | string | GroupSizePresetId | null
    mode: PlanMode
  }
): StopRole[] {
  const preferredRoles = getPreferredRolesForGroupSize(input)
  if (preferredRoles.length === 0 || desiredRoles.length === 0) {
    return desiredRoles
  }

  const result = [...desiredRoles]

  for (let index = 0; index < result.length; index += 1) {
    const currentRole = result[index]
    const preferredRole = preferredRoles[index]

    if (!preferredRole) continue
    if (currentRole === preferredRole) continue

    if (!result.includes(preferredRole)) {
      result[index] = preferredRole
      continue
    }

    const preferredRoleIndex = result.indexOf(preferredRole)
    if (preferredRoleIndex !== -1 && preferredRoleIndex !== index) {
      const temp = result[index]
      result[index] = result[preferredRoleIndex]
      result[preferredRoleIndex] = temp
    }
  }

  return uniqueRolesPreservingOrder(result, desiredRoles.length)
}

export function matchesGroupSizePresetTypes(
  candidateTypes: string[] | null | undefined,
  input?: number | string | GroupSizePresetId | null
): boolean {
  const preset = resolvePreset(input)
  if (!preset) return false

  const normalizedCandidateTypes = uniqueStrings(normalizeTokenArray(candidateTypes))
  const preferredTypes = uniqueStrings(normalizeTokenArray(preset.preferredTypes))

  return preferredTypes.some((type) => normalizedCandidateTypes.includes(type))
}

function resolvePreset(
  input?: number | string | GroupSizePresetId | null
): GroupSizePreset | null {
  if (typeof input === "string") {
    const byId = getGroupSizePresetById(input)
    if (byId) return byId
  }

  return getGroupSizePreset(input as number | string | null)
}

function normalizePresetId(
  value: string
): GroupSizePresetId | null {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  if (
    normalized === "solo" ||
    normalized === "duo" ||
    normalized === "small_group" ||
    normalized === "medium_group" ||
    normalized === "big_group"
  ) {
    return normalized
  }

  return null
}

function normalizeGroupSizeValue(
  input?: number | string | null
): number | null {
  if (input == null) return null

  const numeric =
    typeof input === "number"
      ? input
      : Number.parseInt(String(input).trim(), 10)

  if (!Number.isFinite(numeric)) return null

  const clamped = Math.max(1, Math.min(20, Math.floor(numeric)))
  return clamped
}

function normalizeTokenArray(
  input?: string | string[] | null
): string[] {
  if (Array.isArray(input)) {
    return input
      .map((value) => normalizeTypeToken(String(value)))
      .filter(Boolean)
  }

  if (input == null) return []

  return [normalizeTypeToken(String(input))].filter(Boolean)
}

function normalizeTypeToken(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function uniqueRoles(values: StopRole[]): StopRole[] {
  return Array.from(new Set(values))
}

function uniqueRolesPreservingOrder(
  values: StopRole[],
  maxLength: number
): StopRole[] {
  const seen = new Set<StopRole>()
  const result: StopRole[] = []

  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
    if (result.length >= maxLength) break
  }

  return result
}