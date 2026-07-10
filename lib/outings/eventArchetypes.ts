// lib/outings/eventArchetypes.ts

export const EVENT_ARCHETYPES = [
  { value: "social_sports", label: "Social Sports" },
  { value: "music", label: "Music / Concert" },
  { value: "networking", label: "Networking" },
  { value: "food_drink", label: "Food & Drink" },
  { value: "arts_culture", label: "Arts & Culture" },
  { value: "wellness", label: "Wellness" },
  { value: "nightlife", label: "Nightlife" },
  { value: "community", label: "Community" },
  { value: "comedy", label: "Comedy" },
  { value: "market", label: "Market / Festival" },
  { value: "other", label: "Other" },
] as const

export type EventArchetype =
  (typeof EVENT_ARCHETYPES)[number]["value"]

export type EventAnchorPosition = "start" | "middle" | "end"

export type EventArchetypePlanningProfile = {
  value: EventArchetype
  label: string
  plannerKey: EventArchetype
  anchorPosition: EventAnchorPosition

  /**
   * Internal slot labels only.
   *
   * These should not be displayed directly to users unless the planner
   * eventually attaches a validated confidence score to them.
   */
  beforeSemanticRoles: string[]
  afterSemanticRoles: string[]

  /**
   * Broad category compatibility.
   *
   * These values should contribute to role and category fit, but should not
   * independently determine whether a venue is contextually appropriate.
   */
  preferredBeforeVenueTypes: string[]
  preferredAfterVenueTypes: string[]
  discouragedVenueTypes: string[]
  stronglyDiscouragedVenueTypes?: string[]

  /**
   * Semantic venue qualities.
   *
   * These should be matched primarily against venue.vibe and secondarily
   * against venue.tags.
   */
  preferredVibes: string[]
  preferredBeforeVibes?: string[]
  preferredAfterVibes?: string[]
  discouragedVibes?: string[]

  /**
   * Contextual venue descriptors.
   *
   * These should be matched primarily against venue.tags and may also be
   * checked against venue.vibe when the stored venue data is inconsistent.
   */
  preferredTags?: string[]
  preferredBeforeTags?: string[]
  preferredAfterTags?: string[]
  discouragedTags?: string[]

  /**
   * Geography remains a feasibility boundary, not the primary relevance
   * signal. Semantic relevance should be scored before distance convenience.
   */
  walkRadiusMeters: number
  rideRadiusMeters: number
}

export function isEventArchetype(
  value: unknown
): value is EventArchetype {
  return EVENT_ARCHETYPES.some(
    (archetype) => archetype.value === value
  )
}

export function getEventArchetypeLabel(
  value: string | null | undefined
): string {
  return (
    EVENT_ARCHETYPES.find(
      (archetype) => archetype.value === value
    )?.label ?? "Other"
  )
}

export function normalizeEventArchetypeForStorage(
  value: unknown
): EventArchetype {
  if (isEventArchetype(value)) return value

  if (value === "art") return "arts_culture"
  if (value === "sports") return "social_sports"
  if (value === "festival") return "market"
  if (value === "general") return "other"

  return "other"
}

export function normalizeEventArchetypeForPlanner(
  value: string | null | undefined
): EventArchetype {
  return normalizeEventArchetypeForStorage(value)
}

export const EVENT_ARCHETYPE_PLANNING_PROFILES: Record<
  EventArchetype,
  EventArchetypePlanningProfile
> = {
  social_sports: {
    value: "social_sports",
    label: "Social Sports",
    plannerKey: "social_sports",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "easy_group_start",
      "pre_event_food",
      "casual_gathering",
    ],

    afterSemanticRoles: [
      "post_event_food",
      "group_hangout",
      "casual_drinks",
    ],

    preferredBeforeVenueTypes: [
      "coffee",
      "cafe",
      "café",
      "bakery",
      "breakfast",
      "brunch",
      "tea",
      "juice",
      "lunch",
      "restaurant",
      "food hall",
      "sports bar",
      "brewery",
      "pub",
      "bar",
      "patio",
    ],

    preferredAfterVenueTypes: [
      "brunch",
      "lunch",
      "restaurant",
      "food hall",
      "sports bar",
      "brewery",
      "bar",
      "pub",
      "patio",
      "beer garden",
      "casual food",
      "late night",
    ],

    discouragedVenueTypes: [
      "spa",
      "library",
      "showroom",
      "gallery",
      "museum",
      "fine dining",
      "speakeasy",
    ],

    stronglyDiscouragedVenueTypes: [
      "club",
      "fitness",
      "yoga",
      "pilates",
    ],

    preferredVibes: [
      "lively",
      "casual",
      "social",
      "group-friendly",
      "welcoming",
      "easygoing",
      "energetic",
      "local",
    ],

    preferredBeforeVibes: [
      "daytime",
      "casual",
      "easygoing",
      "group-friendly",
      "welcoming",
      "walkable",
    ],

    preferredAfterVibes: [
      "social",
      "lively",
      "communal",
      "group-friendly",
      "celebratory",
      "easygoing",
    ],

    discouragedVibes: [
      "silent",
      "formal",
      "exclusive",
      "solitary",
      "meditative",
    ],

    preferredTags: [
      "sports",
      "matchday",
      "game-day",
      "watch-party",
      "group-friendly",
      "communal",
      "shareable",
      "patio",
      "local",
      "walkable",
    ],

    preferredBeforeTags: [
      "breakfast",
      "brunch",
      "coffee",
      "quick-bite",
      "counter-service",
      "walk-in",
      "patio",
    ],

    preferredAfterTags: [
      "watch-party",
      "beer",
      "pub",
      "brewery",
      "shareable",
      "late-night-food",
      "group-seating",
    ],

    discouragedTags: [
      "members-only",
      "silent",
      "meditation",
      "tasting-menu",
      "white-tablecloth",
    ],

    walkRadiusMeters: 1600,
    rideRadiusMeters: 4500,
  },

  music: {
    value: "music",
    label: "Music / Concert",
    plannerKey: "music",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "pre_event_meal",
      "pre_event_drinks",
    ],

    afterSemanticRoles: [
      "post_event_drinks",
      "late_night_food",
    ],

    preferredBeforeVenueTypes: [
      "restaurant",
      "lunch",
      "dinner",
      "cocktail",
      "wine bar",
      "bar",
      "lounge",
      "rooftop",
    ],

    preferredAfterVenueTypes: [
      "bar",
      "cocktail",
      "lounge",
      "rooftop",
      "club",
      "speakeasy",
      "late night",
      "dessert",
      "restaurant",
    ],

    discouragedVenueTypes: [
      "breakfast",
      "library",
      "spa",
      "gallery",
      "museum",
    ],

    stronglyDiscouragedVenueTypes: [
      "yoga",
      "pilates",
      "fitness",
    ],

    preferredVibes: [
      "lively",
      "social",
      "energetic",
      "music-friendly",
      "stylish",
      "atmospheric",
    ],

    preferredBeforeVibes: [
      "social",
      "welcoming",
      "buzzy",
      "stylish",
      "conversation-friendly",
      "anticipatory",
    ],

    preferredAfterVibes: [
      "lively",
      "energetic",
      "late-night",
      "buzzy",
      "celebratory",
      "music-forward",
    ],

    discouragedVibes: [
      "silent",
      "meditative",
      "clinical",
      "formal-daytime",
    ],

    preferredTags: [
      "music",
      "live-music",
      "dj",
      "concert",
      "nightlife",
      "late-night",
      "cocktails",
      "bar",
      "lounge",
    ],

    preferredBeforeTags: [
      "pre-show",
      "dinner",
      "cocktails",
      "wine",
      "walk-in",
      "reservation",
    ],

    preferredAfterTags: [
      "late-night",
      "after-hours",
      "dj",
      "dancing",
      "nightcap",
      "late-night-food",
    ],

    discouragedTags: [
      "meditation",
      "silent",
      "study-space",
      "children-focused",
    ],

    walkRadiusMeters: 1200,
    rideRadiusMeters: 4000,
  },

  networking: {
    value: "networking",
    label: "Networking",
    plannerKey: "networking",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "easy_conversation_start",
      "low_pressure_meal",
    ],

    afterSemanticRoles: [
      "conversation_continuation",
      "casual_followup",
    ],

    preferredBeforeVenueTypes: [
      "coffee",
      "cafe",
      "café",
      "lunch",
      "restaurant",
      "dinner",
      "coworking",
      "wine bar",
      "hotel lobby",
      "hotel bar",
    ],

    preferredAfterVenueTypes: [
      "cocktail",
      "wine bar",
      "bar",
      "lounge",
      "rooftop",
      "hotel bar",
      "hotel lobby",
      "restaurant",
    ],

    discouragedVenueTypes: [
      "club",
      "sports bar",
      "fitness",
      "spa",
      "library",
      "showroom",
    ],

    stronglyDiscouragedVenueTypes: [
      "dive bar",
      "concert venue",
      "dance club",
    ],

    preferredVibes: [
      "conversation-friendly",
      "professional",
      "polished",
      "social",
      "comfortable",
      "welcoming",
      "low-pressure",
    ],

    preferredBeforeVibes: [
      "quiet",
      "comfortable",
      "professional",
      "approachable",
      "conversation-friendly",
      "well-lit",
    ],

    preferredAfterVibes: [
      "social",
      "polished",
      "conversation-friendly",
      "relaxed",
      "intimate",
      "comfortable",
    ],

    discouragedVibes: [
      "deafening",
      "rowdy",
      "chaotic",
      "high-pressure",
      "exclusive",
    ],

    preferredTags: [
      "networking",
      "professional",
      "founders",
      "startup",
      "business",
      "community",
      "conversation",
      "meetup",
      "industry",
    ],

    preferredBeforeTags: [
      "coffee",
      "lunch",
      "coworking",
      "hotel-lobby",
      "quiet",
      "wifi",
      "seating",
    ],

    preferredAfterTags: [
      "cocktails",
      "wine",
      "lounge",
      "hotel-bar",
      "conversation",
      "small-groups",
    ],

    discouragedTags: [
      "dancing",
      "mosh",
      "watch-party",
      "karaoke",
      "standing-room-only",
    ],

    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },

  food_drink: {
    value: "food_drink",
    label: "Food & Drink",
    plannerKey: "food_drink",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "light_bite_or_drink",
      "pre_event_drink",
    ],

    afterSemanticRoles: [
      "post_event_drink",
      "dessert_or_nightcap",
    ],

    preferredBeforeVenueTypes: [
      "wine bar",
      "cocktail",
      "bar",
      "cafe",
      "café",
      "bakery",
      "restaurant",
      "lounge",
    ],

    preferredAfterVenueTypes: [
      "dessert",
      "wine bar",
      "cocktail",
      "lounge",
      "bar",
      "restaurant",
      "late night",
    ],

    discouragedVenueTypes: [
      "fitness",
      "library",
      "showroom",
    ],

    stronglyDiscouragedVenueTypes: [
      "yoga",
      "pilates",
      "spa",
    ],

    preferredVibes: [
      "culinary",
      "cozy",
      "social",
      "intimate",
      "welcoming",
      "stylish",
      "food-focused",
    ],

    preferredBeforeVibes: [
      "appetizing",
      "welcoming",
      "social",
      "stylish",
      "casual",
      "intimate",
    ],

    preferredAfterVibes: [
      "indulgent",
      "cozy",
      "intimate",
      "relaxed",
      "dessert-friendly",
      "nightcap",
    ],

    discouragedVibes: [
      "clinical",
      "fitness-focused",
      "silent",
    ],

    preferredTags: [
      "food",
      "drink",
      "culinary",
      "chef-driven",
      "cocktails",
      "wine",
      "dessert",
      "tasting",
    ],

    preferredBeforeTags: [
      "aperitif",
      "small-plates",
      "wine",
      "cocktails",
      "bakery",
      "light-bite",
    ],

    preferredAfterTags: [
      "dessert",
      "digestif",
      "nightcap",
      "wine",
      "cocktails",
      "late-night-food",
    ],

    discouragedTags: [
      "workout",
      "meditation",
      "study-space",
    ],

    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },

  arts_culture: {
    value: "arts_culture",
    label: "Arts & Culture",
    plannerKey: "arts_culture",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "easy_cultural_start",
      "pre_event_food_or_drink",
    ],

    afterSemanticRoles: [
      "post_event_meal",
      "relaxed_followup",
    ],

    preferredBeforeVenueTypes: [
      "gallery",
      "museum",
      "bookstore",
      "cafe",
      "café",
      "coffee",
      "wine bar",
      "cocktail",
      "restaurant",
    ],

    preferredAfterVenueTypes: [
      "restaurant",
      "dinner",
      "wine bar",
      "cocktail",
      "lounge",
      "dessert",
      "cafe",
      "café",
    ],

    discouragedVenueTypes: [
      "sports bar",
      "club",
      "fitness",
    ],

    stronglyDiscouragedVenueTypes: [
      "dive bar",
      "dance club",
    ],

    preferredVibes: [
      "creative",
      "cultured",
      "thoughtful",
      "intimate",
      "design-forward",
      "conversation-friendly",
      "atmospheric",
    ],

    preferredBeforeVibes: [
      "creative",
      "thoughtful",
      "daytime",
      "calm",
      "inspiring",
      "design-forward",
    ],

    preferredAfterVibes: [
      "intimate",
      "reflective",
      "conversation-friendly",
      "stylish",
      "relaxed",
      "atmospheric",
    ],

    discouragedVibes: [
      "rowdy",
      "sports-focused",
      "chaotic",
      "deafening",
    ],

    preferredTags: [
      "art",
      "design",
      "culture",
      "gallery",
      "museum",
      "bookstore",
      "literary",
      "architecture",
      "creative",
    ],

    preferredBeforeTags: [
      "gallery",
      "museum",
      "bookstore",
      "coffeehouse",
      "design",
      "exhibit",
      "independent",
    ],

    preferredAfterTags: [
      "wine",
      "cocktails",
      "dinner",
      "dessert",
      "lounge",
      "conversation",
      "intimate",
    ],

    discouragedTags: [
      "watch-party",
      "sports",
      "dancing",
      "shots",
      "fitness",
    ],

    walkRadiusMeters: 1200,
    rideRadiusMeters: 3500,
  },

  wellness: {
    value: "wellness",
    label: "Wellness",
    plannerKey: "wellness",
    anchorPosition: "start",

    beforeSemanticRoles: [
      "light_fuel",
      "calm_start",
    ],

    afterSemanticRoles: [
      "healthy_refuel",
      "gentle_reset",
    ],

    preferredBeforeVenueTypes: [
      "coffee",
      "tea",
      "cafe",
      "café",
      "juice",
      "smoothie",
      "bakery",
      "breakfast",
      "healthy",
    ],

    preferredAfterVenueTypes: [
      "healthy",
      "salad",
      "juice",
      "smoothie",
      "coffee",
      "tea",
      "park",
      "garden",
      "restaurant",
    ],

    discouragedVenueTypes: [
      "club",
      "sports bar",
      "dive bar",
      "cocktail",
      "speakeasy",
    ],

    stronglyDiscouragedVenueTypes: [
      "dance club",
      "late night",
    ],

    preferredVibes: [
      "healthy",
      "calm",
      "peaceful",
      "outdoors",
      "low-alcohol",
      "light",
      "restorative",
    ],

    preferredBeforeVibes: [
      "calm",
      "healthy",
      "light",
      "daytime",
      "peaceful",
      "natural",
    ],

    preferredAfterVibes: [
      "restorative",
      "healthy",
      "peaceful",
      "outdoors",
      "casual",
      "light",
    ],

    discouragedVibes: [
      "rowdy",
      "deafening",
      "party",
      "high-alcohol",
      "chaotic",
    ],

    preferredTags: [
      "wellness",
      "healthy",
      "juice",
      "smoothie",
      "salad",
      "outdoors",
      "garden",
      "mindful",
    ],

    preferredBeforeTags: [
      "breakfast",
      "coffee",
      "tea",
      "juice",
      "smoothie",
      "light-bite",
    ],

    preferredAfterTags: [
      "healthy",
      "salad",
      "juice",
      "outdoor",
      "park",
      "garden",
      "low-alcohol",
    ],

    discouragedTags: [
      "shots",
      "party",
      "dancing",
      "after-hours",
      "late-night",
    ],

    walkRadiusMeters: 1000,
    rideRadiusMeters: 2500,
  },

  nightlife: {
    value: "nightlife",
    label: "Nightlife",
    plannerKey: "nightlife",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "pre_event_drinks",
      "pre_event_meal",
    ],

    afterSemanticRoles: [
      "post_event_drinks",
      "late_night_finish",
    ],

    preferredBeforeVenueTypes: [
      "cocktail",
      "bar",
      "restaurant",
      "dinner",
      "wine bar",
      "rooftop",
      "lounge",
    ],

    preferredAfterVenueTypes: [
      "club",
      "bar",
      "cocktail",
      "lounge",
      "speakeasy",
      "late night",
      "rooftop",
      "restaurant",
    ],

    discouragedVenueTypes: [
      "breakfast",
      "library",
      "spa",
      "park",
      "garden",
      "museum",
      "gallery",
    ],

    stronglyDiscouragedVenueTypes: [
      "yoga",
      "pilates",
      "fitness",
      "day spa",
    ],

    preferredVibes: [
      "lively",
      "social",
      "stylish",
      "nightlife",
      "buzzy",
      "atmospheric",
      "late-night",
    ],

    preferredBeforeVibes: [
      "social",
      "stylish",
      "conversation-friendly",
      "anticipatory",
      "buzzy",
      "low-pressure",
    ],

    preferredAfterVibes: [
      "lively",
      "energetic",
      "late-night",
      "celebratory",
      "music-forward",
      "buzzy",
    ],

    discouragedVibes: [
      "silent",
      "meditative",
      "daytime-only",
      "family-daytime",
      "clinical",
    ],

    preferredTags: [
      "nightlife",
      "cocktails",
      "bar",
      "lounge",
      "late-night",
      "dj",
      "dancing",
      "nightcap",
    ],

    preferredBeforeTags: [
      "dinner",
      "cocktails",
      "wine",
      "pre-game",
      "lounge",
      "reservation",
    ],

    preferredAfterTags: [
      "late-night",
      "after-hours",
      "dj",
      "dancing",
      "nightcap",
      "late-night-food",
    ],

    discouragedTags: [
      "daytime-only",
      "meditation",
      "study-space",
      "children-focused",
      "morning",
    ],

    walkRadiusMeters: 1200,
    rideRadiusMeters: 4500,
  },

  community: {
    value: "community",
    label: "Community",
    plannerKey: "community",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "casual_meetup",
      "easy_neighborhood_start",
    ],

    afterSemanticRoles: [
      "group_followup",
      "casual_social_stop",
    ],

    preferredBeforeVenueTypes: [
      "coffee",
      "cafe",
      "café",
      "restaurant",
      "park",
      "bookstore",
      "bakery",
      "food hall",
    ],

    preferredAfterVenueTypes: [
      "restaurant",
      "bar",
      "brewery",
      "coffee",
      "dessert",
      "food hall",
      "patio",
    ],

    discouragedVenueTypes: [
      "club",
      "speakeasy",
    ],

    stronglyDiscouragedVenueTypes: [
      "members club",
      "exclusive club",
    ],

    preferredVibes: [
      "casual",
      "local",
      "group-friendly",
      "welcoming",
      "inclusive",
      "neighborhood",
      "social",
    ],

    preferredBeforeVibes: [
      "welcoming",
      "casual",
      "daytime",
      "local",
      "easygoing",
      "inclusive",
    ],

    preferredAfterVibes: [
      "social",
      "casual",
      "group-friendly",
      "neighborhood",
      "relaxed",
      "communal",
    ],

    discouragedVibes: [
      "exclusive",
      "formal",
      "members-only",
      "intimidating",
    ],

    preferredTags: [
      "community",
      "local",
      "neighborhood",
      "group-friendly",
      "inclusive",
      "meetup",
      "communal",
    ],

    preferredBeforeTags: [
      "coffee",
      "bakery",
      "bookstore",
      "park",
      "walkable",
      "family-friendly",
    ],

    preferredAfterTags: [
      "group-seating",
      "patio",
      "brewery",
      "restaurant",
      "dessert",
      "shareable",
    ],

    discouragedTags: [
      "members-only",
      "exclusive",
      "dress-code",
      "private-club",
    ],

    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },

  comedy: {
    value: "comedy",
    label: "Comedy",
    plannerKey: "comedy",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "pre_event_meal",
      "pre_event_drinks",
    ],

    afterSemanticRoles: [
      "post_event_drinks",
      "late_night_food",
    ],

    preferredBeforeVenueTypes: [
      "restaurant",
      "dinner",
      "bar",
      "cocktail",
      "brewery",
      "pub",
      "lounge",
    ],

    preferredAfterVenueTypes: [
      "bar",
      "cocktail",
      "lounge",
      "dessert",
      "late night",
      "restaurant",
      "pub",
    ],

    discouragedVenueTypes: [
      "breakfast",
      "library",
      "spa",
    ],

    stronglyDiscouragedVenueTypes: [
      "yoga",
      "pilates",
      "fitness",
    ],

    preferredVibes: [
      "fun",
      "social",
      "casual",
      "lively",
      "playful",
      "easygoing",
    ],

    preferredBeforeVibes: [
      "casual",
      "social",
      "fun",
      "welcoming",
      "easygoing",
      "lively",
    ],

    preferredAfterVibes: [
      "social",
      "playful",
      "lively",
      "relaxed",
      "late-night",
      "casual",
    ],

    discouragedVibes: [
      "silent",
      "formal",
      "meditative",
      "clinical",
    ],

    preferredTags: [
      "comedy",
      "standup",
      "improv",
      "fun",
      "drinks",
      "late-night",
      "social",
    ],

    preferredBeforeTags: [
      "dinner",
      "brewery",
      "pub",
      "cocktails",
      "casual",
      "walk-in",
    ],

    preferredAfterTags: [
      "late-night",
      "dessert",
      "cocktails",
      "pub",
      "bar",
      "late-night-food",
    ],

    discouragedTags: [
      "meditation",
      "silent",
      "study-space",
    ],

    walkRadiusMeters: 1200,
    rideRadiusMeters: 4000,
  },

  market: {
    value: "market",
    label: "Market / Festival",
    plannerKey: "market",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "coffee_or_light_bite",
      "easy_daytime_start",
    ],

    afterSemanticRoles: [
      "post_event_meal",
      "neighborhood_followup",
    ],

    preferredBeforeVenueTypes: [
      "coffee",
      "cafe",
      "café",
      "bakery",
      "breakfast",
      "brunch",
      "tea",
      "juice",
    ],

    preferredAfterVenueTypes: [
      "brunch",
      "lunch",
      "cafe",
      "café",
      "bookstore",
      "park",
      "garden",
      "gallery",
      "dessert",
      "restaurant",
      "food hall",
    ],

    discouragedVenueTypes: [
      "club",
      "speakeasy",
      "sports bar",
    ],

    stronglyDiscouragedVenueTypes: [
      "dive bar",
      "dance club",
    ],

    preferredVibes: [
      "daytime",
      "walkable",
      "local",
      "casual",
      "creative",
      "outdoors",
      "neighborhood",
    ],

    preferredBeforeVibes: [
      "daytime",
      "calm",
      "local",
      "walkable",
      "casual",
      "welcoming",
    ],

    preferredAfterVibes: [
      "casual",
      "local",
      "outdoors",
      "creative",
      "relaxed",
      "neighborhood",
    ],

    discouragedVibes: [
      "exclusive",
      "formal-nightlife",
      "rowdy",
      "late-night-only",
    ],

    preferredTags: [
      "market",
      "festival",
      "vendors",
      "makers",
      "local",
      "outdoor",
      "walkable",
      "neighborhood",
    ],

    preferredBeforeTags: [
      "coffee",
      "bakery",
      "breakfast",
      "brunch",
      "quick-bite",
      "walkable",
    ],

    preferredAfterTags: [
      "brunch",
      "lunch",
      "park",
      "garden",
      "bookstore",
      "gallery",
      "dessert",
    ],

    discouragedTags: [
      "after-hours",
      "nightclub",
      "sports",
      "watch-party",
    ],

    walkRadiusMeters: 1000,
    rideRadiusMeters: 2500,
  },

  other: {
    value: "other",
    label: "Other",
    plannerKey: "other",
    anchorPosition: "middle",

    beforeSemanticRoles: [
      "easy_start",
      "pre_event_stop",
    ],

    afterSemanticRoles: [
      "easy_followup",
      "post_event_stop",
    ],

    preferredBeforeVenueTypes: [
      "coffee",
      "cafe",
      "café",
      "restaurant",
      "bar",
      "bakery",
      "lunch",
      "dinner",
    ],

    preferredAfterVenueTypes: [
      "restaurant",
      "bar",
      "dessert",
      "coffee",
      "cafe",
      "café",
      "lounge",
    ],

    discouragedVenueTypes: [],

    stronglyDiscouragedVenueTypes: [],

    preferredVibes: [
      "welcoming",
      "social",
      "convenient",
      "comfortable",
      "local",
      "easygoing",
    ],

    preferredBeforeVibes: [
      "welcoming",
      "comfortable",
      "convenient",
      "easygoing",
    ],

    preferredAfterVibes: [
      "social",
      "comfortable",
      "relaxed",
      "convenient",
    ],

    discouragedVibes: [],

    preferredTags: [
      "local",
      "walkable",
      "convenient",
      "welcoming",
    ],

    preferredBeforeTags: [
      "coffee",
      "food",
      "walkable",
      "quick-bite",
    ],

    preferredAfterTags: [
      "restaurant",
      "bar",
      "dessert",
      "late-night",
    ],

    discouragedTags: [],

    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },
}

export function getEventArchetypePlanningProfile(
  value: string | null | undefined
): EventArchetypePlanningProfile {
  return EVENT_ARCHETYPE_PLANNING_PROFILES[
    normalizeEventArchetypeForStorage(value)
  ]
}

export function getPreferredVenueTypesForArchetypePhase(input: {
  archetype: string | null | undefined
  phase: "before" | "after"
}): string[] {
  const profile = getEventArchetypePlanningProfile(
    input.archetype
  )

  return input.phase === "before"
    ? profile.preferredBeforeVenueTypes
    : profile.preferredAfterVenueTypes
}

export function getPreferredVibesForArchetypePhase(input: {
  archetype: string | null | undefined
  phase: "before" | "after"
}): string[] {
  const profile = getEventArchetypePlanningProfile(
    input.archetype
  )

  return uniqueStrings([
    ...profile.preferredVibes,
    ...(input.phase === "before"
      ? profile.preferredBeforeVibes ?? []
      : profile.preferredAfterVibes ?? []),
  ])
}

export function getPreferredTagsForArchetypePhase(input: {
  archetype: string | null | undefined
  phase: "before" | "after"
}): string[] {
  const profile = getEventArchetypePlanningProfile(
    input.archetype
  )

  return uniqueStrings([
    ...(profile.preferredTags ?? []),
    ...(input.phase === "before"
      ? profile.preferredBeforeTags ?? []
      : profile.preferredAfterTags ?? []),
  ])
}

export function getDiscouragedVenueTypesForArchetype(
  archetype: string | null | undefined
): string[] {
  const profile = getEventArchetypePlanningProfile(archetype)

  return uniqueStrings([
    ...profile.discouragedVenueTypes,
    ...(profile.stronglyDiscouragedVenueTypes ?? []),
  ])
}

export function getStronglyDiscouragedVenueTypesForArchetype(
  archetype: string | null | undefined
): string[] {
  return (
    getEventArchetypePlanningProfile(archetype)
      .stronglyDiscouragedVenueTypes ?? []
  )
}

export function getSemanticRoleForSlot(input: {
  archetype: string | null | undefined
  phase: "before" | "after"
  index: number
}): string | null {
  const profile = getEventArchetypePlanningProfile(
    input.archetype
  )

  const roles =
    input.phase === "before"
      ? profile.beforeSemanticRoles
      : profile.afterSemanticRoles

  return (
    roles[input.index] ??
    roles[roles.length - 1] ??
    null
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeSignal(value))
        .filter(Boolean)
    )
  )
}

function normalizeSignal(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[_/|]+/g, " ")
    .replace(/-+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}