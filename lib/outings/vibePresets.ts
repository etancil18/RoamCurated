// lib/outings/vibePresets.ts

import type { PlanMode, StopRole } from "./types"

export type VibePresetId =
  | "romantic"
  | "social"
  | "cozy"
  | "casual"
  | "upscale"
  | "high_energy"
  | "creative"
  | "chill"

export type VibePreset = {
  id: VibePresetId
  label: string
  description: string
  matchTokens: string[]
  preferredTypes: string[]
  discouragedTypes: string[]
  preferredRolesBefore?: StopRole[]
  preferredRolesAfter?: StopRole[]
}

export const VIBE_PRESETS: Record<VibePresetId, VibePreset> = {
  romantic: {
    id: "romantic",
    label: "Romantic",
    description: "Intimate, polished, date-night energy",
    matchTokens: [
      "romantic",
      "date",
      "date-night",
      "datenight",
      "intimate",
      "cozy",
      "stylish",
      "wine",
      "cocktails",
      "cocktail",
      "upscale",
      "evening",
      "dessert",
      "moody",
      "elegant",
    ],
    preferredTypes: [
      "wine bar",
      "cocktail",
      "lounge",
      "rooftop",
      "dessert",
      "dinner",
      "brunch",
      "cafe",
      "café",
      "tea",
    ],
    discouragedTypes: [
      "sports bar",
      "brewery",
      "club",
      "market",
      "fitness",
      "pilates",
      "yoga",
    ],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["drink", "dessert"],
  },

  social: {
    id: "social",
    label: "Social",
    description: "Lively, group-friendly, easy to keep going",
    matchTokens: [
      "social",
      "group",
      "group-friendly",
      "groupfriendly",
      "lively",
      "night-out",
      "nightout",
      "nightlife",
      "cocktails",
      "cocktail",
      "rooftop",
      "bar",
      "buzzy",
      "fun",
      "shared",
    ],
    preferredTypes: [
      "bar",
      "sports bar",
      "brewery",
      "rooftop",
      "lounge",
      "cocktail",
      "market",
      "dinner",
      "dessert",
      "club",
    ],
    discouragedTypes: [
      "library",
      "spa",
      "tea",
    ],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "food"],
  },

  cozy: {
    id: "cozy",
    label: "Cozy",
    description: "Warm, low-pressure, intimate without being formal",
    matchTokens: [
      "cozy",
      "warm",
      "intimate",
      "low-key",
      "lowkey",
      "wine",
      "tea",
      "dessert",
      "candlelit",
      "quiet",
      "comfortable",
      "snug",
      "relaxed",
      "soft",
      "bookish",
    ],
    preferredTypes: [
      "cafe",
      "café",
      "tea",
      "wine bar",
      "dessert",
      "bakery",
      "bookstore",
      "library",
      "lounge",
      "dinner",
    ],
    discouragedTypes: [
      "club",
      "sports bar",
      "fitness",
      "market",
    ],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["dessert", "drink"],
  },

  casual: {
    id: "casual",
    label: "Casual",
    description: "Easygoing, unfussy, flexible",
    matchTokens: [
      "casual",
      "laid-back",
      "laidback",
      "easygoing",
      "comfortable",
      "relaxed",
      "neighborhood",
      "unpretentious",
      "simple",
      "friendly",
      "accessible",
      "chill",
    ],
    preferredTypes: [
      "cafe",
      "café",
      "coffee",
      "breakfast",
      "brunch",
      "lunch",
      "brewery",
      "market",
      "park",
      "garden",
    ],
    discouragedTypes: [
      "club",
      "speakeasy",
      "fine dining",
    ],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["food", "drink"],
  },

  upscale: {
    id: "upscale",
    label: "Upscale",
    description: "Elevated, polished, splurge-friendly",
    matchTokens: [
      "upscale",
      "luxury",
      "luxurious",
      "elegant",
      "polished",
      "stylish",
      "refined",
      "high-end",
      "highend",
      "premium",
      "wine",
      "cocktail",
      "chef-driven",
      "chefdriven",
      "sophisticated",
    ],
    preferredTypes: [
      "dinner",
      "cocktail",
      "wine bar",
      "rooftop",
      "lounge",
      "dessert",
      "brunch",
    ],
    discouragedTypes: [
      "sports bar",
      "market",
      "fitness",
      "library",
    ],
    preferredRolesBefore: ["food", "coffee"],
    preferredRolesAfter: ["drink", "dessert"],
  },

  high_energy: {
    id: "high_energy",
    label: "High Energy",
    description: "Buzzy, nightlife-forward, momentum-heavy",
    matchTokens: [
      "high-energy",
      "highenergy",
      "nightlife",
      "night-out",
      "nightout",
      "party",
      "lively",
      "music",
      "dance",
      "social",
      "crowded",
      "late-night",
      "latenight",
      "bar",
      "club",
      "cocktail",
      "rooftop",
    ],
    preferredTypes: [
      "bar",
      "cocktail",
      "club",
      "rooftop",
      "lounge",
      "speakeasy",
      "brewery",
      "music",
    ],
    discouragedTypes: [
      "library",
      "spa",
      "tea",
      "bakery",
    ],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "activity"],
  },

  creative: {
    id: "creative",
    label: "Creative",
    description: "Artful, design-forward, culturally textured",
    matchTokens: [
      "creative",
      "art",
      "artsy",
      "gallery",
      "museum",
      "design",
      "bookish",
      "music",
      "culture",
      "cultural",
      "indie",
      "curated",
      "showroom",
      "lifestyle",
      "thoughtful",
    ],
    preferredTypes: [
      "gallery",
      "museum",
      "bookstore",
      "library",
      "showroom",
      "lifestyle",
      "music",
      "cafe",
      "café",
      "wine bar",
    ],
    discouragedTypes: [
      "sports bar",
      "club",
      "fitness",
    ],
    preferredRolesBefore: ["activity", "coffee"],
    preferredRolesAfter: ["activity", "drink"],
  },

  chill: {
    id: "chill",
    label: "Chill",
    description: "Relaxed, low-stimulation, easy flow",
    matchTokens: [
      "chill",
      "relaxed",
      "calm",
      "quiet",
      "peaceful",
      "easygoing",
      "garden",
      "park",
      "tea",
      "coffee",
      "low-key",
      "lowkey",
      "soft",
      "slow",
      "laid-back",
      "laidback",
    ],
    preferredTypes: [
      "cafe",
      "café",
      "coffee",
      "tea",
      "park",
      "garden",
      "bookstore",
      "library",
      "dessert",
      "bakery",
    ],
    discouragedTypes: [
      "club",
      "sports bar",
      "brewery",
      "music",
    ],
    preferredRolesBefore: ["coffee", "activity"],
    preferredRolesAfter: ["dessert", "drink"],
  },
}

export const VIBE_PRESET_LIST: VibePreset[] = [
  VIBE_PRESETS.romantic,
  VIBE_PRESETS.social,
  VIBE_PRESETS.cozy,
  VIBE_PRESETS.casual,
  VIBE_PRESETS.upscale,
  VIBE_PRESETS.high_energy,
  VIBE_PRESETS.creative,
  VIBE_PRESETS.chill,
]

export function getVibePreset(
  id?: string | null
): VibePreset | null {
  if (!id) return null

  const normalized = normalizePresetId(id)
  if (!normalized) return null

  return VIBE_PRESETS[normalized] ?? null
}

export function getVibePresetOptions(): Array<{
  id: VibePresetId
  label: string
  description: string
}> {
  return VIBE_PRESET_LIST.map((preset) => ({
    id: preset.id,
    label: preset.label,
    description: preset.description,
  }))
}

export function expandVibeTags(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  if (presetIds.length === 0) {
    return normalizeTokenArray(input)
  }

  const expanded = presetIds.flatMap((presetId) => {
    const preset = VIBE_PRESETS[presetId]
    if (!preset) return []

    return [
      preset.id,
      preset.label,
      ...preset.matchTokens,
      ...preset.preferredTypes,
    ]
  })

  return uniqueStrings(normalizeTokenArray(expanded))
}

export function getPreferredTypesForVibe(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueStrings(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.preferredTypes ?? [])
  )
}

export function getDiscouragedTypesForVibe(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueStrings(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.discouragedTypes ?? [])
  )
}

export function getPreferredRolesForVibe(
  input: {
    vibePresetId?: string | string[] | null
    mode: PlanMode
  }
): StopRole[] {
  const presetIds = normalizePresetIdInput(input.vibePresetId)

  if (presetIds.length === 0) return []

  const roles = presetIds.flatMap((presetId) => {
    const preset = VIBE_PRESETS[presetId]
    if (!preset) return []

    return input.mode === "before"
      ? (preset.preferredRolesBefore ?? [])
      : (preset.preferredRolesAfter ?? [])
  })

  return uniqueRoles(roles)
}

export function applyVibeRoleBias(
  desiredRoles: StopRole[],
  input: {
    vibePresetId?: string | string[] | null
    mode: PlanMode
  }
): StopRole[] {
  const preferredRoles = getPreferredRolesForVibe(input)
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

export function matchesVibePreset(
  candidateTokens: string[] | null | undefined,
  vibePresetId?: string | null
): boolean {
  const preset = getVibePreset(vibePresetId)
  if (!preset) return false

  const normalizedCandidateTokens = uniqueStrings(normalizeTokenArray(candidateTokens))
  const presetTokens = uniqueStrings(normalizeTokenArray([
    preset.id,
    preset.label,
    ...preset.matchTokens,
    ...preset.preferredTypes,
  ]))

  return presetTokens.some((token) => normalizedCandidateTokens.includes(token))
}

function normalizePresetId(
  value: string
): VibePresetId | null {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  if (
    normalized === "romantic" ||
    normalized === "social" ||
    normalized === "cozy" ||
    normalized === "casual" ||
    normalized === "upscale" ||
    normalized === "high_energy" ||
    normalized === "creative" ||
    normalized === "chill"
  ) {
    return normalized
  }

  return null
}

function normalizePresetIdInput(
  input?: string | string[] | null
): VibePresetId[] {
  if (Array.isArray(input)) {
    return uniquePresetIds(
      input
        .map((value) => normalizePresetId(String(value)))
        .filter((value): value is VibePresetId => value != null)
    )
  }

  if (input == null) return []

  const normalized = normalizePresetId(String(input))
  return normalized ? [normalized] : []
}

function normalizeTokenArray(
  input?: string | string[] | null
): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((value) => normalizeTokens(String(value)))
  }

  if (input == null) return []

  return normalizeTokens(String(input))
}

function normalizeTokens(value: string): string[] {
  return String(value)
    .toLowerCase()
    .split(/[\s,./|_\-–—]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function uniqueRoles(values: StopRole[]): StopRole[] {
  return Array.from(new Set(values))
}

function uniquePresetIds(values: VibePresetId[]): VibePresetId[] {
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