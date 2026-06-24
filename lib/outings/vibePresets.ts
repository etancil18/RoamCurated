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
    "romance",
    "date",
    "dates",
    "date-night",
    "datenight",
    "date night",
    "couples",
    "couple",
    "intimate",
    "intimacy",
    "cozy",
    "candlelit",
    "candlelight",
    "dim",
    "dimly-lit",
    "moody",
    "atmospheric",
    "ambiance",
    "ambience",
    "soft-lighting",
    "low-light",
    "stylish",
    "elegant",
    "refined",
    "polished",
    "sophisticated",
    "chic",
    "sexy",
    "sensual",
    "quiet",
    "private",
    "special-occasion",
    "anniversary",
    "valentine",
    "wine",
    "wine-bar",
    "champagne",
    "cocktails",
    "cocktail",
    "martini",
    "lounge",
    "dessert",
    "sweet",
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
  discouragedTypes: [
    "sports bar",
    "brewery",
    "club",
    "market",
    "fitness",
    "pilates",
    "yoga",
    "bar",
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
    "sociable",
    "group",
    "groups",
    "group-friendly",
    "groupfriendly",
    "friends",
    "friend",
    "crew",
    "hangout",
    "hang-out",
    "gathering",
    "gather",
    "meetup",
    "meet-up",
    "communal",
    "shared",
    "shareable",
    "shareables",
    "table",
    "large-party",
    "party",
    "parties",
    "celebration",
    "celebrate",
    "birthday",
    "buzzy",
    "buzzing",
    "vibrant",
    "lively",
    "energetic",
    "fun",
    "playful",
    "easygoing",
    "casual",
    "night-out",
    "nightout",
    "nightlife",
    "drinks",
    "drink",
    "bar",
    "bars",
    "cocktails",
    "cocktail",
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
  ],
  discouragedTypes: [
    "library",
    "spa",
    "tea",
    "dessert",
    "market",
    "garden",
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
    "cosy",
    "warm",
    "welcoming",
    "inviting",
    "comfortable",
    "comforting",
    "snug",
    "soft",
    "soft-lighting",
    "candlelit",
    "candlelight",
    "intimate",
    "quiet",
    "peaceful",
    "calm",
    "relaxed",
    "relaxing",
    "low-key",
    "lowkey",
    "laid-back",
    "laidback",
    "slow",
    "slow-paced",
    "ambient",
    "atmospheric",
    "homey",
    "homestyle",
    "rustic",
    "bookish",
    "reading",
    "wine",
    "wine-bar",
    "tea",
    "tea-house",
    "matcha",
    "coffee",
    "espresso",
    "latte",
    "dessert",
    "pastry",
    "pastries",
    "bakery",
    "baked-goods",
    "sweet",
    "fireside",
    "neighborhood",
    "local",
    "hidden-gem",
    "charming",
    "coffeeshop",
    "lounge",
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
    "bar",
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
    "easygoing",
    "easy-going",
    "laid-back",
    "laidback",
    "relaxed",
    "comfortable",
    "low-pressure",
    "unpretentious",
    "simple",
    "simple-food",
    "friendly",
    "welcoming",
    "accessible",
    "approachable",
    "informal",
    "everyday",
    "flexible",
    "chill",
    "neighborhood",
    "local",
    "community",
    "hangout",
    "hang-out",
    "weeknight",
    "daytime",
    "quick-bite",
    "grab-and-go",
    "walk-in",
    "walkable",
    "easy",
    "affordable",
    "budget-friendly",
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
    "cafeteria",
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
  ],
  discouragedTypes: [
    "club",
    "speakeasy",
    "fine dining",
    "activity",
    "cocktail",
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
    "premium",
    "high-end",
    "highend",
    "exclusive",
    "elevated",
    "elegant",
    "refined",
    "refinement",
    "polished",
    "sophisticated",
    "classy",
    "chic",
    "stylish",
    "designer",
    "fashionable",
    "tasteful",
    "opulent",
    "lavish",
    "swanky",
    "trendy",
    "beautiful",
    "aesthetic",
    "curated",
    "chef-driven",
    "chefdriven",
    "tasting-menu",
    "prix-fixe",
    "omakase",
    "fine-dining",
    "fine dining",
    "steakhouse",
    "wine",
    "wine-bar",
    "sommelier",
    "champagne",
    "cocktail",
    "cocktails",
    "martini",
    "mixology",
    "craft-cocktail",
    "rooftop",
    "lounge",
    "speakeasy",
    "reservation",
    "reservations",
    "date-night",
    "datenight",
    "white-tablecloth",
    "velvet",
    "intimate",
    "ambient",
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
  ],
  discouragedTypes: [
    "sports bar",
    "market",
    "fitness",
    "library",
    "bar",
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
    "energetic",
    "hype",
    "hyped",
    "electric",
    "fast-paced",
    "nightlife",
    "nightlife-heavy",
    "night-out",
    "nightout",
    "party",
    "parties",
    "turn-up",
    "turnup",
    "lit",
    "wild",
    "crowded",
    "packed",
    "busy",
    "buzzy",
    "buzzing",
    "lively",
    "vibrant",
    "social",
    "social-scene",
    "music",
    "live-music",
    "dj",
    "dance",
    "dancing",
    "dancefloor",
    "club",
    "bar",
    "bars",
    "cocktail",
    "cocktails",
    "shots",
    "drinks",
    "brewery",
    "beer",
    "rooftop",
    "lounge",
    "speakeasy",
    "late-night",
    "latenight",
    "after-hours",
    "festival",
    "concert",
    "performance",
    "karaoke",
    "celebration",
    "birthday",
    "weekend",
    "young",
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
  ],
  discouragedTypes: [
    "library",
    "spa",
    "tea",
    "bakery",
    "coffee",
    "lunch",
    "breakfast",
    "cafe",
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
    "artistic",
    "gallery",
    "museum",
    "exhibit",
    "exhibition",
    "installation",
    "design",
    "design-forward",
    "designer",
    "architecture",
    "interior-design",
    "visual",
    "visuals",
    "aesthetic",
    "beautiful",
    "stylish",
    "curated",
    "thoughtful",
    "intentional",
    "craft",
    "craftsmanship",
    "maker",
    "makers",
    "studio",
    "atelier",
    "showroom",
    "lifestyle",
    "boutique",
    "concept",
    "conceptual",
    "fashion",
    "vintage",
    "indie",
    "independent",
    "alternative",
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
    "cultural",
    "creative-scene",
    "community",
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
  discouragedTypes: [
    "sports bar",
    "club",
    "fitness",
    "bar",
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
    "relaxing",
    "calm",
    "quiet",
    "peaceful",
    "easygoing",
    "easy-going",
    "laid-back",
    "laidback",
    "low-key",
    "lowkey",
    "slow",
    "slow-paced",
    "soft",
    "gentle",
    "minimal",
    "minimalist",
    "cozy",
    "comfortable",
    "welcoming",
    "ambient",
    "atmospheric",
    "tranquil",
    "serene",
    "zen",
    "mindful",
    "restful",
    "nature",
    "outdoors",
    "garden",
    "park",
    "green-space",
    "patio",
    "courtyard",
    "tea",
    "tea-house",
    "coffee",
    "cafe",
    "café",
    "matcha",
    "espresso",
    "bakery",
    "dessert",
    "pastry",
    "bookstore",
    "library",
    "reading",
    "study",
    "solo-friendly",
    "conversation",
    "daytime",
    "sunny",
    "natural-light",
    "unwind",
    "decompress",
    "escape",
    "hidden-gem",
    "neighborhood",
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
    "yoga",
    "pilates",
    "gallery",
  ],
  discouragedTypes: [
    "club",
    "sports bar",
    "brewery",
    "music",
    "rooftop",
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