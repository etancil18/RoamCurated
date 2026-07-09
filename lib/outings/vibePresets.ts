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

export type VibeDaypart =
  | "early_morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "late_night"

export type VibeSequenceTemplate = {
  mode: PlanMode | "full"
  roles: StopRole[]
  preferredTypesByRole?: Partial<Record<StopRole, string[]>>
}

export type VibePreset = {
  id: VibePresetId
  label: string
  description: string
  matchTokens: string[]
  preferredTypes: string[]
  discouragedTypes: string[]
  requiredAnyTypes?: string[]
  stronglyDiscouragedTypes?: string[]
  preferredDayparts?: VibeDaypart[]
  discouragedDayparts?: VibeDaypart[]
  preferredRolesBefore?: StopRole[]
  preferredRolesAfter?: StopRole[]
  fallbackTypePriority?: string[]
  sequenceTemplates?: VibeSequenceTemplate[]
}

export const VIBE_PRESETS: Record<VibePresetId, VibePreset> = {
  romantic: {
    id: "romantic",
    label: "Romantic",
    description: "Intimate, polished, date-night energy",
    matchTokens: [
      "romantic",
      "romance",
      "date",
      "dates",
      "date-night",
      "datenight",
      "date night",
      "couples",
      "couple",
      "intimate",
      "cozy",
      "candlelit",
      "moody",
      "atmospheric",
      "ambiance",
      "quiet",
      "private",
      "stylish",
      "elegant",
      "refined",
      "polished",
      "sophisticated",
      "chic",
      "wine",
      "wine-bar",
      "champagne",
      "cocktails",
      "cocktail",
      "martini",
      "lounge",
      "dessert",
      "upscale",
      "evening",
      "nightcap",
      "rooftop",
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
    requiredAnyTypes: ["wine bar", "cocktail", "lounge", "dinner", "dessert", "cafe", "café"],
    discouragedTypes: ["sports bar", "brewery", "club", "market", "fitness", "pilates", "yoga"],
    stronglyDiscouragedTypes: ["sports bar", "club", "dive bar"],
    preferredDayparts: ["evening", "late_night", "afternoon"],
    discouragedDayparts: ["early_morning", "morning"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "dessert"],
    fallbackTypePriority: ["wine bar", "cocktail", "lounge", "dessert", "dinner", "rooftop"],
    sequenceTemplates: [
      { mode: "before", roles: ["food", "drink"] },
      { mode: "after", roles: ["drink", "dessert"] },
      { mode: "full", roles: ["food", "drink", "dessert"] },
    ],
  },

  social: {
    id: "social",
    label: "Social",
    description: "Lively, group-friendly, easy to keep going",
    matchTokens: [
      "social",
      "group",
      "group-friendly",
      "friends",
      "crew",
      "hangout",
      "gathering",
      "communal",
      "shareable",
      "celebration",
      "birthday",
      "buzzy",
      "vibrant",
      "lively",
      "energetic",
      "fun",
      "playful",
      "casual",
      "night-out",
      "nightlife",
      "drinks",
      "bar",
      "cocktails",
      "beer",
      "brewery",
      "rooftop",
      "patio",
      "outdoor",
      "lounge",
      "sports",
      "sports-bar",
      "music",
      "dj",
      "dancing",
    ],
    preferredTypes: [
      "bar",
      "sports bar",
      "brewery",
      "rooftop",
      "lounge",
      "cocktail",
      "dinner",
      "club",
      "restaurant",
    ],
    requiredAnyTypes: ["bar", "brewery", "restaurant", "dinner", "lunch", "sports bar", "rooftop"],
    discouragedTypes: ["library", "spa", "tea", "quiet", "fine dining"],
    stronglyDiscouragedTypes: ["library", "spa"],
    preferredDayparts: ["afternoon", "evening", "late_night"],
    discouragedDayparts: ["early_morning"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "food"],
    fallbackTypePriority: ["brewery", "bar", "restaurant", "sports bar", "rooftop", "cocktail"],
    sequenceTemplates: [
      { mode: "before", roles: ["food", "drink"] },
      { mode: "after", roles: ["drink", "food"] },
      { mode: "full", roles: ["food", "drink", "drink"] },
    ],
  },

  cozy: {
    id: "cozy",
    label: "Cozy",
    description: "Warm, low-pressure, intimate without being formal",
    matchTokens: [
      "cozy",
      "cosy",
      "warm",
      "welcoming",
      "comfortable",
      "soft-lighting",
      "candlelit",
      "intimate",
      "quiet",
      "peaceful",
      "calm",
      "relaxed",
      "low-key",
      "laid-back",
      "ambient",
      "homey",
      "rustic",
      "bookish",
      "reading",
      "wine",
      "tea",
      "matcha",
      "coffee",
      "espresso",
      "latte",
      "dessert",
      "pastry",
      "bakery",
      "neighborhood",
      "local",
      "hidden-gem",
      "charming",
      "lounge",
    ],
    preferredTypes: [
      "cafe",
      "café",
      "coffee",
      "tea",
      "wine bar",
      "dessert",
      "bakery",
      "bookstore",
      "library",
      "lounge",
      "dinner",
    ],
    requiredAnyTypes: ["cafe", "café", "coffee", "tea", "bakery", "dessert", "bookstore", "wine bar", "lounge"],
    discouragedTypes: ["club", "sports bar", "fitness", "market", "brewery", "rooftop"],
    stronglyDiscouragedTypes: ["club", "sports bar", "dive bar"],
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["dessert", "drink"],
    fallbackTypePriority: ["cafe", "café", "coffee", "tea", "bakery", "dessert", "bookstore", "wine bar"],
    sequenceTemplates: [
      { mode: "before", roles: ["coffee", "food"] },
      { mode: "after", roles: ["dessert", "drink"] },
      { mode: "full", roles: ["coffee", "food", "dessert"] },
    ],
  },

  casual: {
    id: "casual",
    label: "Casual",
    description: "Easygoing, unfussy, flexible",
    matchTokens: [
      "casual",
      "easygoing",
      "laid-back",
      "relaxed",
      "comfortable",
      "low-pressure",
      "unpretentious",
      "friendly",
      "approachable",
      "informal",
      "everyday",
      "flexible",
      "chill",
      "neighborhood",
      "local",
      "community",
      "hangout",
      "weeknight",
      "daytime",
      "quick-bite",
      "grab-and-go",
      "walk-in",
      "walkable",
      "easy",
      "affordable",
      "brewery",
      "beer",
      "coffee",
      "brunch",
      "breakfast",
      "lunch",
      "sandwich",
      "burger",
      "tacos",
      "patio",
      "outdoor",
      "park",
      "garden",
      "market",
      "food-hall",
      "counter-service",
      "family-friendly",
      "group-friendly",
      "social",
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
      "restaurant",
      "bar",
    ],
    requiredAnyTypes: ["cafe", "café", "coffee", "breakfast", "brunch", "lunch", "brewery", "restaurant", "market", "park"],
    discouragedTypes: ["club", "speakeasy", "fine dining", "cocktail"],
    stronglyDiscouragedTypes: ["club", "fine dining"],
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["food", "drink"],
    fallbackTypePriority: ["lunch", "brunch", "cafe", "café", "coffee", "brewery", "restaurant", "market"],
    sequenceTemplates: [
      { mode: "before", roles: ["coffee", "food"] },
      { mode: "after", roles: ["food", "drink"] },
      { mode: "full", roles: ["food", "drink", "dessert"] },
    ],
  },

  upscale: {
    id: "upscale",
    label: "Upscale",
    description: "Elevated, polished, splurge-friendly",
    matchTokens: [
      "upscale",
      "luxury",
      "premium",
      "high-end",
      "exclusive",
      "elevated",
      "elegant",
      "refined",
      "polished",
      "sophisticated",
      "classy",
      "chic",
      "stylish",
      "opulent",
      "swanky",
      "trendy",
      "chef-driven",
      "tasting-menu",
      "prix-fixe",
      "omakase",
      "fine-dining",
      "steakhouse",
      "wine",
      "wine-bar",
      "sommelier",
      "champagne",
      "cocktail",
      "martini",
      "mixology",
      "rooftop",
      "lounge",
      "speakeasy",
      "reservation",
      "date-night",
      "white-tablecloth",
      "intimate",
      "moody",
      "dinner-service",
    ],
    preferredTypes: [
      "dinner",
      "cocktail",
      "wine bar",
      "rooftop",
      "lounge",
      "dessert",
      "brunch",
      "speakeasy",
    ],
    requiredAnyTypes: ["dinner", "cocktail", "wine bar", "rooftop", "lounge", "dessert", "speakeasy"],
    discouragedTypes: ["sports bar", "market", "fitness", "library", "brewery", "counter-service"],
    stronglyDiscouragedTypes: ["sports bar", "market", "dive bar"],
    preferredDayparts: ["evening", "late_night", "afternoon"],
    discouragedDayparts: ["early_morning", "morning"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "dessert"],
    fallbackTypePriority: ["dinner", "cocktail", "wine bar", "lounge", "rooftop", "dessert", "speakeasy"],
    sequenceTemplates: [
      { mode: "before", roles: ["food", "drink"] },
      { mode: "after", roles: ["drink", "dessert"] },
      { mode: "full", roles: ["food", "drink", "dessert"] },
    ],
  },

  high_energy: {
    id: "high_energy",
    label: "High Energy",
    description: "Buzzy, nightlife-forward, momentum-heavy",
    matchTokens: [
      "high-energy",
      "energetic",
      "hype",
      "electric",
      "fast-paced",
      "nightlife",
      "night-out",
      "party",
      "turn-up",
      "lit",
      "wild",
      "crowded",
      "packed",
      "busy",
      "buzzy",
      "lively",
      "vibrant",
      "social",
      "music",
      "live-music",
      "dj",
      "dance",
      "dancing",
      "club",
      "bar",
      "cocktail",
      "shots",
      "drinks",
      "brewery",
      "beer",
      "rooftop",
      "lounge",
      "speakeasy",
      "late-night",
      "after-hours",
      "festival",
      "concert",
      "performance",
      "karaoke",
      "celebration",
      "weekend",
      "trendy",
      "scene",
    ],
    preferredTypes: [
      "bar",
      "club",
      "rooftop",
      "lounge",
      "speakeasy",
      "brewery",
      "music",
      "sports bar",
      "cocktail",
    ],
    requiredAnyTypes: ["bar", "club", "rooftop", "lounge", "speakeasy", "brewery", "music", "sports bar", "cocktail"],
    discouragedTypes: ["library", "spa", "tea", "bakery", "coffee", "lunch", "breakfast", "cafe", "café"],
    stronglyDiscouragedTypes: ["library", "spa", "breakfast", "tea"],
    preferredDayparts: ["evening", "late_night"],
    discouragedDayparts: ["early_morning", "morning", "midday"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "activity"],
    fallbackTypePriority: ["bar", "cocktail", "club", "lounge", "rooftop", "speakeasy", "brewery", "music"],
    sequenceTemplates: [
      { mode: "before", roles: ["food", "drink"] },
      { mode: "after", roles: ["drink", "activity"] },
      { mode: "full", roles: ["food", "drink", "drink"] },
    ],
  },

  creative: {
    id: "creative",
    label: "Creative",
    description: "Artful, design-forward, culturally textured",
    matchTokens: [
      "creative",
      "art",
      "artsy",
      "artistic",
      "gallery",
      "museum",
      "exhibit",
      "installation",
      "design",
      "architecture",
      "visual",
      "aesthetic",
      "stylish",
      "curated",
      "thoughtful",
      "craft",
      "maker",
      "studio",
      "atelier",
      "showroom",
      "lifestyle",
      "boutique",
      "concept",
      "fashion",
      "vintage",
      "indie",
      "independent",
      "experimental",
      "music",
      "live-music",
      "vinyl",
      "record-store",
      "bookish",
      "bookstore",
      "poetry",
      "literary",
      "culture",
      "film",
      "cinema",
      "theater",
      "performance",
      "coffeehouse",
      "wine-bar",
      "conversation",
      "inspiring",
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
      "speakeasy",
    ],
    requiredAnyTypes: ["gallery", "museum", "bookstore", "showroom", "lifestyle", "music", "cafe", "café", "wine bar"],
    discouragedTypes: ["sports bar", "club", "fitness", "dive bar"],
    stronglyDiscouragedTypes: ["sports bar", "club"],
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["activity", "coffee"],
    preferredRolesAfter: ["activity", "drink"],
    fallbackTypePriority: ["gallery", "museum", "bookstore", "cafe", "café", "wine bar", "music", "lifestyle"],
    sequenceTemplates: [
      { mode: "before", roles: ["activity", "coffee"] },
      { mode: "after", roles: ["activity", "drink"] },
      { mode: "full", roles: ["coffee", "activity", "drink"] },
    ],
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
      "laid-back",
      "low-key",
      "slow",
      "soft",
      "gentle",
      "minimal",
      "cozy",
      "comfortable",
      "welcoming",
      "ambient",
      "tranquil",
      "serene",
      "zen",
      "mindful",
      "nature",
      "outdoors",
      "garden",
      "park",
      "green-space",
      "patio",
      "courtyard",
      "tea",
      "coffee",
      "cafe",
      "café",
      "matcha",
      "bakery",
      "dessert",
      "bookstore",
      "library",
      "reading",
      "solo-friendly",
      "conversation",
      "daytime",
      "natural-light",
      "unwind",
      "decompress",
      "hidden-gem",
      "neighborhood",
      "wine",
      "wine-bar",
      "cocktail",
      "lounge",
      "low-energy-bar",
      "quiet-bar",
    ],
    preferredTypes: [
      "cafe",
      "café",
      "coffee",
      "tea",
      "dessert",
      "bakery",
      "wine bar",
      "cocktail",
      "lounge",
      "restaurant",
    ],
    requiredAnyTypes: [
      "cafe",
      "café",
      "coffee",
      "tea",
      "dessert",
      "bakery",
      "wine bar",
      "cocktail",
      "lounge",
      "restaurant",
    ],
    discouragedTypes: [
      "club",
      "sports bar",
      "brewery",
      "music",
      "rooftop",
      "dive bar",
      "park",
      "garden",
      "library",
      "gallery",
      "yoga",
      "pilates",
    ],
    stronglyDiscouragedTypes: [
      "club",
      "sports bar",
      "dive bar",
      "park",
      "garden",
    ],
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["dessert", "drink"],
    fallbackTypePriority: [
      "wine bar",
      "cocktail",
      "lounge",
      "dessert",
      "restaurant",
      "cafe",
      "café",
      "coffee",
      "tea",
      "bakery",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["coffee", "food"],
        preferredTypesByRole: {
          coffee: ["cafe", "café", "coffee", "tea", "bakery"],
          food: ["restaurant", "dessert", "wine bar", "cocktail", "lounge"],
        },
      },
      {
        mode: "after",
        roles: ["dessert", "drink"],
        preferredTypesByRole: {
          dessert: ["dessert", "bakery", "cafe", "café"],
          drink: ["wine bar", "cocktail", "lounge"],
        },
      },
      {
        mode: "full",
        roles: ["coffee", "food", "dessert"],
        preferredTypesByRole: {
          coffee: ["cafe", "café", "coffee", "tea", "bakery"],
          food: ["restaurant", "wine bar", "cocktail", "lounge"],
          dessert: ["dessert", "bakery", "cafe", "café"],
        },
      },
    ],
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
      ...(preset.requiredAnyTypes ?? []),
      ...(preset.fallbackTypePriority ?? []),
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

export function getRequiredAnyTypesForVibe(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueStrings(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.requiredAnyTypes ?? [])
  )
}

export function getDiscouragedTypesForVibe(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueStrings(
    presetIds.flatMap((presetId) => [
      ...(VIBE_PRESETS[presetId]?.discouragedTypes ?? []),
      ...(VIBE_PRESETS[presetId]?.stronglyDiscouragedTypes ?? []),
    ])
  )
}

export function getStronglyDiscouragedTypesForVibe(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueStrings(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.stronglyDiscouragedTypes ?? [])
  )
}

export function getPreferredDaypartsForVibe(
  input?: string | string[] | null
): VibeDaypart[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueDayparts(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.preferredDayparts ?? [])
  )
}

export function getDiscouragedDaypartsForVibe(
  input?: string | string[] | null
): VibeDaypart[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueDayparts(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.discouragedDayparts ?? [])
  )
}

export function getFallbackTypePriorityForVibe(
  input?: string | string[] | null
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueStrings(
    presetIds.flatMap((presetId) => VIBE_PRESETS[presetId]?.fallbackTypePriority ?? [])
  )
}

export function getSequenceTemplatesForVibe(
  input?: string | string[] | null
): VibeSequenceTemplate[] {
  const presetIds = normalizePresetIdInput(input)

  return presetIds.flatMap(
    (presetId) => VIBE_PRESETS[presetId]?.sequenceTemplates ?? []
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
    ...(preset.requiredAnyTypes ?? []),
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

function uniqueDayparts(values: VibeDaypart[]): VibeDaypart[] {
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