// lib/outings/vibePresets.ts

import type {
  PlanMode,
  StopRole,
  VibeDaypart,
  VibeSequenceTemplate,
} from "./types"

export type { VibeDaypart, VibeSequenceTemplate } from "./types"

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

  /**
   * Tokens used to recognize the requested preset and semantically compare
   * it against venue tags and vibe values.
   */
  matchTokens: string[]

  /**
   * Semantic venue signals. These should carry more contextual meaning than
   * the venue's broad type.
   */
  preferredVibes?: string[]
  preferredTags?: string[]
  discouragedVibes?: string[]
  discouragedTags?: string[]

  /**
   * Broad venue-category guidance. These remain useful, but should be treated
   * as secondary to venue tags and venue vibe values by the scoring engine.
   */
  preferredTypes: string[]
  discouragedTypes: string[]
  requiredAnyTypes?: string[]
  stronglyDiscouragedTypes?: string[]

  /**
   * Daypart-specific type guidance prevents a preset such as "chill" from
   * meaning the same thing at 10:00 AM and 10:00 PM.
   */
  preferredTypesByDaypart?: Partial<Record<VibeDaypart, string[]>>
  discouragedTypesByDaypart?: Partial<Record<VibeDaypart, string[]>>

  preferredDayparts?: VibeDaypart[]
  discouragedDayparts?: VibeDaypart[]

  preferredRolesBefore?: StopRole[]
  preferredRolesAfter?: StopRole[]

  fallbackTypePriority?: string[]
  sequenceTemplates?: VibeSequenceTemplate[]
}

export type ResolvedVibePresetProfile = {
  presetIds: VibePresetId[]
  requestedTokens: string[]
  expandedTokens: string[]

  preferredVibes: string[]
  preferredTags: string[]
  discouragedVibes: string[]
  discouragedTags: string[]

  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]

  preferredDayparts: VibeDaypart[]
  discouragedDayparts: VibeDaypart[]

  fallbackTypePriority: string[]
  sequenceTemplates: VibeSequenceTemplate[]
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
      "date night",
      "datenight",
      "couple",
      "couples",
      "intimate",
      "candlelit",
      "moody",
      "atmospheric",
      "ambiance",
      "private",
      "stylish",
      "elegant",
      "refined",
      "polished",
      "sophisticated",
      "chic",
      "wine",
      "champagne",
      "cocktail",
      "martini",
      "lounge",
      "dessert",
      "upscale",
      "nightcap",
    ],
    preferredVibes: [
      "romantic",
      "intimate",
      "candlelit",
      "moody",
      "atmospheric",
      "quiet",
      "private",
      "stylish",
      "elegant",
      "refined",
      "polished",
      "sophisticated",
      "chic",
      "cozy",
    ],
    preferredTags: [
      "date night",
      "date-night",
      "couples",
      "candlelit",
      "wine",
      "champagne",
      "cocktails",
      "dessert",
      "nightcap",
      "reservation",
      "table service",
    ],
    discouragedVibes: [
      "rowdy",
      "loud",
      "chaotic",
      "high energy",
      "high-energy",
      "sports focused",
      "sports-focused",
    ],
    discouragedTags: [
      "watch party",
      "game day",
      "gameday",
      "standing room",
      "dance floor",
      "college crowd",
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
    requiredAnyTypes: [
      "wine bar",
      "cocktail",
      "lounge",
      "dinner",
      "dessert",
      "cafe",
      "café",
      "restaurant",
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
    stronglyDiscouragedTypes: [
      "sports bar",
      "club",
      "dive bar",
    ],
    preferredTypesByDaypart: {
      morning: ["cafe", "café", "coffee", "tea", "bakery", "brunch"],
      midday: ["brunch", "lunch", "cafe", "café", "tea"],
      afternoon: ["wine bar", "cafe", "café", "tea", "dessert"],
      evening: [
        "dinner",
        "restaurant",
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
      ],
      late_night: [
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
        "nightcap",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "cocktail", "speakeasy", "late night"],
      morning: ["club", "cocktail", "speakeasy", "late night"],
    },
    preferredDayparts: ["afternoon", "evening", "late_night"],
    discouragedDayparts: ["early_morning", "morning"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "dessert"],
    fallbackTypePriority: [
      "wine bar",
      "cocktail",
      "lounge",
      "dessert",
      "dinner",
      "restaurant",
      "rooftop",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["food", "drink"],
        preferredTypesByRole: {
          food: ["dinner", "restaurant"],
          drink: ["wine bar", "cocktail", "lounge"],
        },
      },
      {
        mode: "after",
        roles: ["drink", "dessert"],
        preferredTypesByRole: {
          drink: ["wine bar", "cocktail", "lounge"],
          dessert: ["dessert", "bakery", "cafe", "café"],
        },
      },
      {
        mode: "full",
        roles: ["food", "drink", "dessert"],
        preferredTypesByRole: {
          food: ["dinner", "restaurant"],
          drink: ["wine bar", "cocktail", "lounge"],
          dessert: ["dessert", "bakery", "cafe", "café"],
        },
      },
    ],
  },

  social: {
    id: "social",
    label: "Social",
    description: "Lively, group-friendly, easy to keep going",
    matchTokens: [
      "social",
      "group",
      "group friendly",
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
      "night out",
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
      "music",
      "dj",
      "dancing",
    ],
    preferredVibes: [
      "social",
      "lively",
      "group friendly",
      "group-friendly",
      "communal",
      "fun",
      "playful",
      "buzzy",
      "vibrant",
      "casual",
      "energetic",
      "welcoming",
    ],
    preferredTags: [
      "friends",
      "groups",
      "group friendly",
      "group-friendly",
      "shareable",
      "communal",
      "birthday",
      "celebration",
      "patio",
      "rooftop",
      "walk in",
      "walk-in",
      "hangout",
    ],
    discouragedVibes: [
      "silent",
      "solitary",
      "meditative",
      "formal",
      "very quiet",
    ],
    discouragedTags: [
      "appointment only",
      "members only",
      "solo workspace",
      "silent",
      "meditation",
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
    requiredAnyTypes: [
      "bar",
      "brewery",
      "restaurant",
      "dinner",
      "lunch",
      "sports bar",
      "rooftop",
      "lounge",
    ],
    discouragedTypes: [
      "library",
      "spa",
      "tea",
      "fine dining",
    ],
    stronglyDiscouragedTypes: [
      "library",
      "spa",
    ],
    preferredTypesByDaypart: {
      morning: ["coffee", "cafe", "café", "breakfast", "brunch"],
      midday: ["brunch", "lunch", "restaurant", "patio", "brewery"],
      afternoon: ["restaurant", "brewery", "bar", "patio", "rooftop"],
      evening: [
        "restaurant",
        "dinner",
        "bar",
        "brewery",
        "cocktail",
        "rooftop",
        "lounge",
      ],
      late_night: [
        "bar",
        "cocktail",
        "club",
        "lounge",
        "rooftop",
        "late night",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "cocktail", "speakeasy", "late night"],
      morning: ["club", "cocktail", "speakeasy", "late night"],
    },
    preferredDayparts: ["afternoon", "evening", "late_night"],
    discouragedDayparts: ["early_morning"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "food"],
    fallbackTypePriority: [
      "brewery",
      "bar",
      "restaurant",
      "sports bar",
      "rooftop",
      "cocktail",
      "lounge",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["food", "drink"],
        preferredTypesByRole: {
          food: ["restaurant", "dinner", "lunch", "brunch"],
          drink: ["bar", "brewery", "cocktail", "rooftop", "lounge"],
        },
      },
      {
        mode: "after",
        roles: ["drink", "food"],
        preferredTypesByRole: {
          drink: ["bar", "brewery", "cocktail", "rooftop", "lounge"],
          food: ["restaurant", "dinner", "late night"],
        },
      },
      {
        mode: "full",
        roles: ["food", "drink", "drink"],
        preferredTypesByRole: {
          food: ["restaurant", "dinner"],
          drink: ["bar", "brewery", "cocktail", "rooftop", "lounge"],
        },
      },
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
      "soft lighting",
      "candlelit",
      "intimate",
      "quiet",
      "peaceful",
      "calm",
      "relaxed",
      "low key",
      "laid back",
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
      "hidden gem",
      "charming",
      "lounge",
    ],
    preferredVibes: [
      "cozy",
      "warm",
      "welcoming",
      "comfortable",
      "soft lighting",
      "soft-lighting",
      "candlelit",
      "intimate",
      "quiet",
      "peaceful",
      "calm",
      "relaxed",
      "low key",
      "low-key",
      "laid back",
      "laid-back",
      "ambient",
      "homey",
      "rustic",
      "charming",
    ],
    preferredTags: [
      "neighborhood",
      "local",
      "hidden gem",
      "hidden-gem",
      "bookish",
      "reading",
      "pastry",
      "coffee",
      "tea",
      "wine",
      "dessert",
      "fireplace",
      "candlelit",
    ],
    discouragedVibes: [
      "rowdy",
      "loud",
      "chaotic",
      "high energy",
      "high-energy",
      "crowded",
    ],
    discouragedTags: [
      "dance floor",
      "standing room",
      "watch party",
      "game day",
      "gameday",
      "after hours",
      "after-hours",
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
    requiredAnyTypes: [
      "cafe",
      "café",
      "coffee",
      "tea",
      "bakery",
      "dessert",
      "bookstore",
      "wine bar",
      "lounge",
      "restaurant",
    ],
    discouragedTypes: [
      "club",
      "sports bar",
      "fitness",
      "market",
      "brewery",
      "rooftop",
    ],
    stronglyDiscouragedTypes: [
      "club",
      "sports bar",
      "dive bar",
    ],
    preferredTypesByDaypart: {
      early_morning: ["coffee", "cafe", "café", "tea", "bakery"],
      morning: ["coffee", "cafe", "café", "tea", "bakery", "breakfast"],
      midday: ["cafe", "café", "tea", "bakery", "brunch", "bookstore"],
      afternoon: [
        "cafe",
        "café",
        "tea",
        "dessert",
        "bakery",
        "bookstore",
      ],
      evening: [
        "wine bar",
        "lounge",
        "dessert",
        "dinner",
        "restaurant",
        "tea",
      ],
      late_night: ["wine bar", "lounge", "dessert"],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "cocktail", "speakeasy", "late night"],
      morning: ["club", "cocktail", "speakeasy", "late night"],
      late_night: ["coffee", "breakfast", "library", "bookstore"],
    },
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["dessert", "drink"],
    fallbackTypePriority: [
      "cafe",
      "café",
      "coffee",
      "tea",
      "bakery",
      "dessert",
      "bookstore",
      "wine bar",
      "lounge",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["coffee", "food"],
        preferredTypesByRole: {
          coffee: ["coffee", "cafe", "café", "tea", "bakery"],
          food: ["breakfast", "brunch", "lunch", "restaurant", "dessert"],
        },
      },
      {
        mode: "after",
        roles: ["dessert", "drink"],
        preferredTypesByRole: {
          dessert: ["dessert", "bakery", "cafe", "café"],
          drink: ["wine bar", "lounge", "tea"],
        },
      },
      {
        mode: "full",
        roles: ["coffee", "food", "dessert"],
        preferredTypesByRole: {
          coffee: ["coffee", "cafe", "café", "tea", "bakery"],
          food: ["restaurant", "brunch", "lunch", "dinner"],
          dessert: ["dessert", "bakery", "cafe", "café"],
        },
      },
    ],
  },

  casual: {
    id: "casual",
    label: "Casual",
    description: "Easygoing, unfussy, flexible",
    matchTokens: [
      "casual",
      "easygoing",
      "laid back",
      "relaxed",
      "comfortable",
      "low pressure",
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
      "quick bite",
      "grab and go",
      "walk in",
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
      "food hall",
      "counter service",
      "family friendly",
      "group friendly",
      "social",
    ],
    preferredVibes: [
      "casual",
      "easygoing",
      "laid back",
      "laid-back",
      "relaxed",
      "comfortable",
      "low pressure",
      "low-pressure",
      "unpretentious",
      "friendly",
      "approachable",
      "informal",
      "flexible",
      "local",
      "neighborhood",
    ],
    preferredTags: [
      "walk in",
      "walk-in",
      "walkable",
      "counter service",
      "counter-service",
      "quick bite",
      "quick-bite",
      "grab and go",
      "grab-and-go",
      "affordable",
      "patio",
      "outdoor",
      "family friendly",
      "family-friendly",
      "group friendly",
      "group-friendly",
    ],
    discouragedVibes: [
      "formal",
      "exclusive",
      "ultra luxury",
      "ultra-luxury",
      "high ceremony",
    ],
    discouragedTags: [
      "prix fixe only",
      "dress code",
      "members only",
      "appointment only",
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
    requiredAnyTypes: [
      "cafe",
      "café",
      "coffee",
      "breakfast",
      "brunch",
      "lunch",
      "brewery",
      "restaurant",
      "market",
      "park",
      "bar",
    ],
    discouragedTypes: [
      "club",
      "speakeasy",
      "fine dining",
    ],
    stronglyDiscouragedTypes: [
      "club",
      "fine dining",
    ],
    preferredTypesByDaypart: {
      early_morning: ["coffee", "cafe", "café", "bakery", "breakfast"],
      morning: ["coffee", "cafe", "café", "bakery", "breakfast", "brunch"],
      midday: [
        "brunch",
        "lunch",
        "restaurant",
        "market",
        "park",
        "garden",
      ],
      afternoon: [
        "lunch",
        "restaurant",
        "brewery",
        "market",
        "park",
        "garden",
        "patio",
      ],
      evening: ["restaurant", "dinner", "brewery", "bar", "patio"],
      late_night: ["bar", "restaurant", "late night"],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "cocktail", "speakeasy", "late night"],
      morning: ["club", "cocktail", "speakeasy", "late night"],
      late_night: ["park", "garden", "market", "breakfast"],
    },
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["coffee", "food"],
    preferredRolesAfter: ["food", "drink"],
    fallbackTypePriority: [
      "lunch",
      "brunch",
      "cafe",
      "café",
      "coffee",
      "brewery",
      "restaurant",
      "market",
      "bar",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["coffee", "food"],
        preferredTypesByRole: {
          coffee: ["coffee", "cafe", "café", "bakery"],
          food: ["breakfast", "brunch", "lunch", "restaurant"],
        },
      },
      {
        mode: "after",
        roles: ["food", "drink"],
        preferredTypesByRole: {
          food: ["restaurant", "lunch", "dinner", "late night"],
          drink: ["brewery", "bar", "patio"],
        },
      },
      {
        mode: "full",
        roles: ["food", "drink", "dessert"],
        preferredTypesByRole: {
          food: ["restaurant", "lunch", "dinner"],
          drink: ["brewery", "bar", "patio"],
          dessert: ["dessert", "bakery", "cafe", "café"],
        },
      },
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
      "high end",
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
      "chef driven",
      "tasting menu",
      "prix fixe",
      "omakase",
      "fine dining",
      "steakhouse",
      "wine",
      "wine bar",
      "sommelier",
      "champagne",
      "cocktail",
      "martini",
      "mixology",
      "rooftop",
      "lounge",
      "speakeasy",
      "reservation",
      "date night",
      "white tablecloth",
      "intimate",
      "moody",
      "dinner service",
    ],
    preferredVibes: [
      "upscale",
      "luxury",
      "premium",
      "high end",
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
    ],
    preferredTags: [
      "chef driven",
      "chef-driven",
      "tasting menu",
      "tasting-menu",
      "prix fixe",
      "prix-fixe",
      "omakase",
      "sommelier",
      "champagne",
      "mixology",
      "reservation",
      "white tablecloth",
      "white-tablecloth",
      "dinner service",
      "dinner-service",
    ],
    discouragedVibes: [
      "rowdy",
      "chaotic",
      "rough",
      "divey",
      "counter service",
      "counter-service",
    ],
    discouragedTags: [
      "watch party",
      "game day",
      "gameday",
      "grab and go",
      "grab-and-go",
      "food court",
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
      "restaurant",
    ],
    requiredAnyTypes: [
      "dinner",
      "restaurant",
      "cocktail",
      "wine bar",
      "rooftop",
      "lounge",
      "dessert",
      "speakeasy",
    ],
    discouragedTypes: [
      "sports bar",
      "market",
      "fitness",
      "library",
      "brewery",
      "counter service",
    ],
    stronglyDiscouragedTypes: [
      "sports bar",
      "market",
      "dive bar",
    ],
    preferredTypesByDaypart: {
      morning: ["brunch", "cafe", "café", "tea"],
      midday: ["brunch", "lunch", "restaurant", "tea"],
      afternoon: ["restaurant", "wine bar", "rooftop", "lounge", "dessert"],
      evening: [
        "dinner",
        "restaurant",
        "cocktail",
        "wine bar",
        "rooftop",
        "lounge",
        "speakeasy",
        "dessert",
      ],
      late_night: [
        "cocktail",
        "wine bar",
        "rooftop",
        "lounge",
        "speakeasy",
        "dessert",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "cocktail", "speakeasy", "late night"],
      morning: ["club", "cocktail", "speakeasy", "late night"],
    },
    preferredDayparts: ["afternoon", "evening", "late_night"],
    discouragedDayparts: ["early_morning", "morning"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "dessert"],
    fallbackTypePriority: [
      "dinner",
      "restaurant",
      "cocktail",
      "wine bar",
      "lounge",
      "rooftop",
      "dessert",
      "speakeasy",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["food", "drink"],
        preferredTypesByRole: {
          food: ["dinner", "restaurant"],
          drink: ["cocktail", "wine bar", "lounge", "rooftop"],
        },
      },
      {
        mode: "after",
        roles: ["drink", "dessert"],
        preferredTypesByRole: {
          drink: ["cocktail", "wine bar", "lounge", "speakeasy", "rooftop"],
          dessert: ["dessert"],
        },
      },
      {
        mode: "full",
        roles: ["food", "drink", "dessert"],
        preferredTypesByRole: {
          food: ["dinner", "restaurant"],
          drink: ["cocktail", "wine bar", "lounge", "speakeasy"],
          dessert: ["dessert"],
        },
      },
    ],
  },

  high_energy: {
    id: "high_energy",
    label: "High Energy",
    description: "Buzzy, nightlife-forward, momentum-heavy",
    matchTokens: [
      "high energy",
      "energetic",
      "hype",
      "electric",
      "fast paced",
      "nightlife",
      "night out",
      "party",
      "turn up",
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
      "live music",
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
      "late night",
      "after hours",
      "festival",
      "concert",
      "performance",
      "karaoke",
      "celebration",
      "weekend",
      "trendy",
      "scene",
    ],
    preferredVibes: [
      "high energy",
      "high-energy",
      "energetic",
      "hype",
      "electric",
      "fast paced",
      "fast-paced",
      "party",
      "wild",
      "crowded",
      "packed",
      "busy",
      "buzzy",
      "lively",
      "vibrant",
      "social",
    ],
    preferredTags: [
      "dj",
      "dance",
      "dancing",
      "dance floor",
      "live music",
      "live-music",
      "late night",
      "late-night",
      "after hours",
      "after-hours",
      "karaoke",
      "weekend",
      "party",
      "nightlife",
    ],
    discouragedVibes: [
      "silent",
      "meditative",
      "tranquil",
      "sleepy",
      "very quiet",
      "low stimulation",
      "low-stimulation",
    ],
    discouragedTags: [
      "reading",
      "meditation",
      "wellness",
      "study",
      "work friendly",
      "work-friendly",
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
    requiredAnyTypes: [
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
    discouragedTypes: [
      "library",
      "spa",
      "tea",
      "bakery",
      "coffee",
      "lunch",
      "breakfast",
      "cafe",
      "café",
    ],
    stronglyDiscouragedTypes: [
      "library",
      "spa",
      "breakfast",
      "tea",
    ],
    preferredTypesByDaypart: {
      afternoon: ["brewery", "bar", "sports bar", "rooftop"],
      evening: [
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
      late_night: [
        "bar",
        "club",
        "rooftop",
        "lounge",
        "speakeasy",
        "music",
        "cocktail",
        "late night",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: [
        "club",
        "bar",
        "cocktail",
        "speakeasy",
        "late night",
      ],
      morning: [
        "club",
        "bar",
        "cocktail",
        "speakeasy",
        "late night",
      ],
      midday: ["club", "speakeasy", "late night"],
    },
    preferredDayparts: ["evening", "late_night"],
    discouragedDayparts: ["early_morning", "morning", "midday"],
    preferredRolesBefore: ["food", "drink"],
    preferredRolesAfter: ["drink", "activity"],
    fallbackTypePriority: [
      "bar",
      "cocktail",
      "club",
      "lounge",
      "rooftop",
      "speakeasy",
      "brewery",
      "music",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["food", "drink"],
        preferredTypesByRole: {
          food: ["restaurant", "dinner"],
          drink: ["bar", "cocktail", "brewery", "rooftop", "lounge"],
        },
      },
      {
        mode: "after",
        roles: ["drink", "activity"],
        preferredTypesByRole: {
          drink: ["bar", "cocktail", "club", "lounge", "speakeasy"],
          activity: ["club", "music", "karaoke"],
        },
      },
      {
        mode: "full",
        roles: ["food", "drink", "drink"],
        preferredTypesByRole: {
          food: ["restaurant", "dinner"],
          drink: ["bar", "cocktail", "club", "lounge", "speakeasy"],
        },
      },
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
      "live music",
      "vinyl",
      "record store",
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
      "wine bar",
      "conversation",
      "inspiring",
    ],
    preferredVibes: [
      "creative",
      "artsy",
      "artistic",
      "design forward",
      "design-forward",
      "aesthetic",
      "stylish",
      "curated",
      "thoughtful",
      "indie",
      "independent",
      "experimental",
      "inspiring",
      "cultural",
      "cultured",
    ],
    preferredTags: [
      "art",
      "gallery",
      "museum",
      "exhibit",
      "installation",
      "design",
      "architecture",
      "studio",
      "maker",
      "atelier",
      "showroom",
      "fashion",
      "vintage",
      "vinyl",
      "record store",
      "record-store",
      "poetry",
      "literary",
      "film",
      "cinema",
      "theater",
      "performance",
    ],
    discouragedVibes: [
      "generic",
      "corporate",
      "sports focused",
      "sports-focused",
      "rowdy",
      "chaotic",
    ],
    discouragedTags: [
      "watch party",
      "game day",
      "gameday",
      "chain",
      "sports screens",
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
    requiredAnyTypes: [
      "gallery",
      "museum",
      "bookstore",
      "showroom",
      "lifestyle",
      "music",
      "cafe",
      "café",
      "wine bar",
      "restaurant",
    ],
    discouragedTypes: [
      "sports bar",
      "club",
      "fitness",
      "dive bar",
    ],
    stronglyDiscouragedTypes: [
      "sports bar",
      "club",
    ],
    preferredTypesByDaypart: {
      early_morning: ["coffee", "cafe", "café", "bookstore"],
      morning: [
        "coffee",
        "cafe",
        "café",
        "gallery",
        "museum",
        "bookstore",
      ],
      midday: [
        "gallery",
        "museum",
        "bookstore",
        "showroom",
        "lifestyle",
        "cafe",
        "café",
      ],
      afternoon: [
        "gallery",
        "museum",
        "bookstore",
        "showroom",
        "lifestyle",
        "cafe",
        "café",
        "wine bar",
      ],
      evening: [
        "gallery",
        "music",
        "wine bar",
        "speakeasy",
        "restaurant",
        "cocktail",
      ],
      late_night: ["music", "wine bar", "speakeasy", "cocktail"],
    },
    discouragedTypesByDaypart: {
      early_morning: ["club", "speakeasy", "late night"],
      morning: ["club", "speakeasy", "late night"],
      late_night: ["library", "bookstore", "museum"],
    },
    preferredDayparts: ["morning", "midday", "afternoon", "evening"],
    discouragedDayparts: ["late_night"],
    preferredRolesBefore: ["activity", "coffee"],
    preferredRolesAfter: ["activity", "drink"],
    fallbackTypePriority: [
      "gallery",
      "museum",
      "bookstore",
      "cafe",
      "café",
      "wine bar",
      "music",
      "lifestyle",
      "restaurant",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["activity", "coffee"],
        preferredTypesByRole: {
          activity: [
            "gallery",
            "museum",
            "bookstore",
            "showroom",
            "lifestyle",
          ],
          coffee: ["coffee", "cafe", "café"],
        },
      },
      {
        mode: "after",
        roles: ["activity", "drink"],
        preferredTypesByRole: {
          activity: ["gallery", "music", "showroom", "lifestyle"],
          drink: ["wine bar", "cocktail", "speakeasy"],
        },
      },
      {
        mode: "full",
        roles: ["coffee", "activity", "drink"],
        preferredTypesByRole: {
          coffee: ["coffee", "cafe", "café"],
          activity: [
            "gallery",
            "museum",
            "bookstore",
            "showroom",
            "lifestyle",
          ],
          drink: ["wine bar", "cocktail", "speakeasy"],
        },
      },
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
      "laid back",
      "low key",
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
      "green space",
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
      "solo friendly",
      "conversation",
      "daytime",
      "natural light",
      "unwind",
      "decompress",
      "hidden gem",
      "neighborhood",
      "wine",
      "wine bar",
      "cocktail",
      "lounge",
      "low energy bar",
      "quiet bar",
    ],
    preferredVibes: [
      "chill",
      "relaxed",
      "calm",
      "quiet",
      "peaceful",
      "easygoing",
      "laid back",
      "laid-back",
      "low key",
      "low-key",
      "soft",
      "gentle",
      "minimal",
      "comfortable",
      "welcoming",
      "ambient",
      "tranquil",
      "serene",
      "conversation friendly",
      "conversation-friendly",
      "low stimulation",
      "low-stimulation",
    ],
    preferredTags: [
      "quiet",
      "conversation",
      "solo friendly",
      "solo-friendly",
      "natural light",
      "natural-light",
      "hidden gem",
      "hidden-gem",
      "neighborhood",
      "courtyard",
      "patio",
      "unwind",
      "decompress",
      "quiet bar",
      "quiet-bar",
      "low energy bar",
      "low-energy-bar",
    ],
    discouragedVibes: [
      "rowdy",
      "loud",
      "chaotic",
      "high energy",
      "high-energy",
      "packed",
      "wild",
      "party",
      "sports focused",
      "sports-focused",
    ],
    discouragedTags: [
      "dance floor",
      "dj",
      "after hours",
      "after-hours",
      "watch party",
      "game day",
      "gameday",
      "standing room",
      "college crowd",
      "shots",
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
      "park",
      "garden",
      "bookstore",
      "library",
      "gallery",
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
      "park",
      "garden",
      "bookstore",
      "gallery",
    ],
    discouragedTypes: [
      "club",
      "sports bar",
      "brewery",
      "music",
      "rooftop",
      "dive bar",
    ],
    stronglyDiscouragedTypes: [
      "club",
      "sports bar",
      "dive bar",
    ],
    preferredTypesByDaypart: {
      early_morning: [
        "coffee",
        "cafe",
        "café",
        "tea",
        "bakery",
        "park",
        "garden",
      ],
      morning: [
        "coffee",
        "cafe",
        "café",
        "tea",
        "bakery",
        "breakfast",
        "brunch",
        "park",
        "garden",
        "bookstore",
      ],
      midday: [
        "cafe",
        "café",
        "coffee",
        "tea",
        "brunch",
        "lunch",
        "bakery",
        "park",
        "garden",
        "bookstore",
        "gallery",
      ],
      afternoon: [
        "cafe",
        "café",
        "tea",
        "dessert",
        "bakery",
        "park",
        "garden",
        "bookstore",
        "gallery",
        "patio",
      ],
      evening: [
        "restaurant",
        "dinner",
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
        "tea",
        "cafe",
        "café",
      ],
      late_night: [
        "wine bar",
        "cocktail",
        "lounge",
        "dessert",
        "late night",
      ],
    },
    discouragedTypesByDaypart: {
      early_morning: [
        "club",
        "sports bar",
        "dive bar",
        "cocktail",
        "speakeasy",
        "late night",
      ],
      morning: [
        "club",
        "sports bar",
        "dive bar",
        "cocktail",
        "speakeasy",
        "late night",
      ],
      midday: [
        "club",
        "dive bar",
        "late night",
      ],
      afternoon: [
        "club",
        "dive bar",
        "late night",
      ],
      evening: [
        "park",
        "garden",
        "library",
        "bookstore",
        "gallery",
        "museum",
        "yoga",
        "pilates",
        "fitness",
        "market",
        "sports bar",
        "dive bar",
        "club",
      ],
      late_night: [
        "park",
        "garden",
        "library",
        "bookstore",
        "gallery",
        "museum",
        "yoga",
        "pilates",
        "fitness",
        "market",
        "coffee",
        "breakfast",
        "brunch",
        "sports bar",
        "dive bar",
      ],
    },
    preferredDayparts: [
      "early_morning",
      "morning",
      "midday",
      "afternoon",
      "evening",
    ],
    discouragedDayparts: [],
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
      "park",
      "garden",
      "bookstore",
    ],
    sequenceTemplates: [
      {
        mode: "before",
        roles: ["coffee", "food"],
        preferredTypesByRole: {
          coffee: [
            "cafe",
            "café",
            "coffee",
            "tea",
            "bakery",
          ],
          food: [
            "restaurant",
            "breakfast",
            "brunch",
            "lunch",
            "dinner",
            "dessert",
          ],
        },
      },
      {
        mode: "after",
        roles: ["dessert", "drink"],
        preferredTypesByRole: {
          dessert: [
            "dessert",
            "bakery",
            "cafe",
            "café",
          ],
          drink: [
            "wine bar",
            "cocktail",
            "lounge",
          ],
        },
      },
      {
        mode: "full",
        roles: ["coffee", "food", "dessert"],
        preferredTypesByRole: {
          coffee: [
            "cafe",
            "café",
            "coffee",
            "tea",
            "bakery",
          ],
          food: [
            "restaurant",
            "breakfast",
            "brunch",
            "lunch",
            "dinner",
          ],
          dessert: [
            "dessert",
            "bakery",
            "cafe",
            "café",
          ],
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
  return normalized ? VIBE_PRESETS[normalized] ?? null : null
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

export function getMatchedVibePresetIds(
  input?: string | string[] | null
): VibePresetId[] {
  return normalizePresetIdInput(input)
}

export function resolveVibePresetProfile(
  input?: string | string[] | null
): ResolvedVibePresetProfile {
  const presetIds = normalizePresetIdInput(input)
  const requestedTokens = normalizeTokenArray(input)

  return {
    presetIds,
    requestedTokens,
    expandedTokens: expandVibeTags(input),

    preferredVibes: getPreferredVibesForVibe(input),
    preferredTags: getPreferredTagsForVibe(input),
    discouragedVibes: getDiscouragedVibesForVibe(input),
    discouragedTags: getDiscouragedTagsForVibe(input),

    preferredTypes: getPreferredTypesForVibe(input),
    requiredAnyTypes: getRequiredAnyTypesForVibe(input),
    discouragedTypes: getDiscouragedTypesForVibe(input),
    stronglyDiscouragedTypes: getStronglyDiscouragedTypesForVibe(input),

    preferredDayparts: getPreferredDaypartsForVibe(input),
    discouragedDayparts: getDiscouragedDaypartsForVibe(input),

    fallbackTypePriority: getFallbackTypePriorityForVibe(input),
    sequenceTemplates: getSequenceTemplatesForVibe(input),
  }
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
      ...(preset.preferredVibes ?? []),
      ...(preset.preferredTags ?? []),
      ...preset.preferredTypes,
    ]
  })

  return normalizeSemanticValues(expanded)
}

export function getPreferredVibesForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.preferredVibes ?? [])
}

export function getPreferredTagsForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.preferredTags ?? [])
}

export function getDiscouragedVibesForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.discouragedVibes ?? [])
}

export function getDiscouragedTagsForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.discouragedTags ?? [])
}

export function getPreferredTypesForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.preferredTypes)
}

export function getRequiredAnyTypesForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.requiredAnyTypes ?? [])
}

export function getDiscouragedTypesForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(input, (preset) => preset.discouragedTypes)
}

export function getStronglyDiscouragedTypesForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(
    input,
    (preset) => preset.stronglyDiscouragedTypes ?? []
  )
}

export function getPreferredTypesForVibeDaypart(
  input: string | string[] | null | undefined,
  daypart: VibeDaypart
): string[] {
  return collectPresetValues(
    input,
    (preset) => preset.preferredTypesByDaypart?.[daypart] ?? []
  )
}

export function getDiscouragedTypesForVibeDaypart(
  input: string | string[] | null | undefined,
  daypart: VibeDaypart
): string[] {
  return collectPresetValues(
    input,
    (preset) => preset.discouragedTypesByDaypart?.[daypart] ?? []
  )
}

export function getPreferredTypesForVibeRole(
  input: {
    vibePresetId?: string | string[] | null
    mode: PlanMode
    role: StopRole
  }
): string[] {
  const presetIds = normalizePresetIdInput(input.vibePresetId)

  const values = presetIds.flatMap((presetId) => {
    const preset = VIBE_PRESETS[presetId]
    if (!preset) return []

    return (preset.sequenceTemplates ?? [])
      .filter((template) => template.mode === input.mode)
      .flatMap(
        (template) =>
          template.preferredTypesByRole?.[input.role] ?? []
      )
  })

  return normalizeSemanticValues(values)
}

export function getPreferredDaypartsForVibe(
  input?: string | string[] | null
): VibeDaypart[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueDayparts(
    presetIds.flatMap(
      (presetId) => VIBE_PRESETS[presetId]?.preferredDayparts ?? []
    )
  )
}

export function getDiscouragedDaypartsForVibe(
  input?: string | string[] | null
): VibeDaypart[] {
  const presetIds = normalizePresetIdInput(input)

  return uniqueDayparts(
    presetIds.flatMap(
      (presetId) => VIBE_PRESETS[presetId]?.discouragedDayparts ?? []
    )
  )
}

export function getFallbackTypePriorityForVibe(
  input?: string | string[] | null
): string[] {
  return collectPresetValues(
    input,
    (preset) => preset.fallbackTypePriority ?? []
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

    if (input.mode === "before") {
      return preset.preferredRolesBefore ?? []
    }

    if (input.mode === "after") {
      return preset.preferredRolesAfter ?? []
    }

    const fullTemplate = (preset.sequenceTemplates ?? []).find(
      (template) => template.mode === "full"
    )

    return fullTemplate?.roles ?? [
      ...(preset.preferredRolesBefore ?? []),
      ...(preset.preferredRolesAfter ?? []),
    ]
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
    const preferredRole = preferredRoles[index]

    if (!preferredRole || result[index] === preferredRole) {
      continue
    }

    const existingPreferredRoleIndex = result.indexOf(preferredRole)

    if (existingPreferredRoleIndex === -1) {
      result[index] = preferredRole
      continue
    }

    if (existingPreferredRoleIndex !== index) {
      const currentRole = result[index]
      result[index] = result[existingPreferredRoleIndex]
      result[existingPreferredRoleIndex] = currentRole
    }
  }

  return uniqueRolesPreservingOrder(result, desiredRoles.length)
}

export function matchesVibePreset(
  candidateTokens: string[] | string | null | undefined,
  vibePresetId?: string | null
): boolean {
  const preset = getVibePreset(vibePresetId)
  if (!preset) return false

  const normalizedCandidateTokens = new Set(
    normalizeTokenArray(candidateTokens)
  )

  const presetTokens = normalizeTokenArray([
    preset.id,
    preset.label,
    ...preset.matchTokens,
    ...(preset.preferredVibes ?? []),
    ...(preset.preferredTags ?? []),
    ...preset.preferredTypes,
  ])

  return presetTokens.some((token) =>
    normalizedCandidateTokens.has(token)
  )
}

function collectPresetValues(
  input: string | string[] | null | undefined,
  selector: (preset: VibePreset) => string[]
): string[] {
  const presetIds = normalizePresetIdInput(input)

  return normalizeSemanticValues(
    presetIds.flatMap((presetId) => {
      const preset = VIBE_PRESETS[presetId]
      return preset ? selector(preset) : []
    })
  )
}

function normalizePresetId(
  value: string
): VibePresetId | null {
  const normalized = normalizePresetKey(value)

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
  const values = Array.isArray(input)
    ? input
    : input == null
      ? []
      : [input]

  const directlyMatched = values
    .map((value) => normalizePresetId(String(value)))
    .filter((value): value is VibePresetId => value != null)

  if (directlyMatched.length > 0) {
    return uniquePresetIds(directlyMatched)
  }

  const normalizedInputTokens = new Set(normalizeTokenArray(values))

  const inferredMatches = VIBE_PRESET_LIST.filter((preset) => {
    const recognitionTokens = normalizeTokenArray([
      preset.id,
      preset.label,
      ...preset.matchTokens,
    ])

    return recognitionTokens.some((token) =>
      normalizedInputTokens.has(token)
    )
  }).map((preset) => preset.id)

  return uniquePresetIds(inferredMatches)
}

function normalizeTokenArray(
  input?: string | string[] | null
): string[] {
  const values = Array.isArray(input)
    ? input
    : input == null
      ? []
      : [input]

  return uniqueStrings(
    values.flatMap((value) => {
      const phrase = normalizePhrase(String(value))
      if (!phrase) return []

      const individualTokens = phrase
        .split(" ")
        .map((token) => token.trim())
        .filter(Boolean)

      return [phrase, ...individualTokens]
    })
  )
}

function normalizeSemanticValues(values: string[]): string[] {
  return uniqueStrings(
    values
      .map((value) => normalizePhrase(value))
      .filter(Boolean)
  )
}

function normalizePhrase(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[_/|]+/g, " ")
    .replace(/-+/g, " ")
    .replace(/[.,;:!?()[\]{}"'`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizePresetKey(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[–—-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
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
  const result: StopRole[] = []
  const seen = new Set<StopRole>()

  for (const value of values) {
    if (seen.has(value)) continue

    seen.add(value)
    result.push(value)

    if (result.length >= maxLength) {
      break
    }
  }

  return result
}