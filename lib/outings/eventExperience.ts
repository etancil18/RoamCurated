// lib/outings/eventExperience.ts

import type {
  EventRecord,
  VenueRecord,
} from "./types"

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type ExperienceIntensity =
  | "low"
  | "medium"
  | "high"

export type ConsumptionExposure =
  | "none"
  | "possible"
  | "likely"

export type FoodExposure =
  | "none"
  | "light"
  | "meal"

export type EventExperienceProfile = {
  /**
   * These values describe what the event is reasonably likely to provide.
   *
   * They are planning estimates, not claims about what a specific attendee
   * actually consumed, did, or felt.
   */
  physicalIntensity: ExperienceIntensity
  seatedIntensity: ExperienceIntensity
  socialIntensity: ExperienceIntensity
  conversationIntensity: ExperienceIntensity
  stimulation: ExperienceIntensity

  foodExposure: FoodExposure
  caffeineExposure: ConsumptionExposure
  alcoholExposure: ConsumptionExposure

  indoorLikelihood: ExperienceIntensity

  /**
   * 0–1 estimate of how much event-specific evidence informed the profile.
   *
   * Confidence measures evidence coverage, not certainty about attendee
   * behavior.
   */
  confidence: number

  /**
   * Compact, deterministic diagnostic evidence explaining why the profile
   * moved away from its archetype/default prior.
   */
  evidence: string[]
}

export type ResolveEventExperienceInput = {
  event: EventRecord
  anchorVenue: VenueRecord | null
  eventArchetype: string
  eventTags: string[]
}

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

type NumericExperienceProfile = {
  physicalIntensity: number
  seatedIntensity: number
  socialIntensity: number
  conversationIntensity: number
  stimulation: number

  foodExposure: number
  caffeineExposure: number
  alcoholExposure: number

  indoorLikelihood: number
}

type ProfileAdjustment =
  Partial<NumericExperienceProfile>

type EvidenceStrength =
  | "weak"
  | "moderate"
  | "strong"

type ExperienceSignal = {
  id: string
  tokens: string[]
  phrases?: string[]
  adjustment: ProfileAdjustment
  strength: EvidenceStrength
}

type NormalizedEventEvidence = {
  eventTokens: string[]
  eventPhrases: string[]
  anchorTokens: string[]
  anchorPhrases: string[]
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_EVIDENCE_ENTRIES = 16

const ARCHETYPE_PRIORS: Record<
  string,
  NumericExperienceProfile
> = {
  social_sports: {
    physicalIntensity: 0.35,
    seatedIntensity: 0.55,
    socialIntensity: 0.85,
    conversationIntensity: 0.55,
    stimulation: 0.8,

    foodExposure: 0.3,
    caffeineExposure: 0.1,
    alcoholExposure: 0.5,

    indoorLikelihood: 0.65,
  },

  music: {
    physicalIntensity: 0.35,
    seatedIntensity: 0.35,
    socialIntensity: 0.7,
    conversationIntensity: 0.25,
    stimulation: 0.9,

    foodExposure: 0.15,
    caffeineExposure: 0.05,
    alcoholExposure: 0.45,

    indoorLikelihood: 0.7,
  },

  networking: {
    physicalIntensity: 0.15,
    seatedIntensity: 0.45,
    socialIntensity: 0.9,
    conversationIntensity: 0.95,
    stimulation: 0.65,

    foodExposure: 0.25,
    caffeineExposure: 0.25,
    alcoholExposure: 0.4,

    indoorLikelihood: 0.85,
  },

  food_drink: {
    physicalIntensity: 0.1,
    seatedIntensity: 0.8,
    socialIntensity: 0.65,
    conversationIntensity: 0.7,
    stimulation: 0.45,

    foodExposure: 0.9,
    caffeineExposure: 0.15,
    alcoholExposure: 0.55,

    indoorLikelihood: 0.85,
  },

  arts_culture: {
    physicalIntensity: 0.3,
    seatedIntensity: 0.4,
    socialIntensity: 0.4,
    conversationIntensity: 0.45,
    stimulation: 0.65,

    foodExposure: 0.05,
    caffeineExposure: 0.05,
    alcoholExposure: 0.1,

    indoorLikelihood: 0.75,
  },

  wellness: {
    physicalIntensity: 0.7,
    seatedIntensity: 0.25,
    socialIntensity: 0.35,
    conversationIntensity: 0.25,
    stimulation: 0.35,

    foodExposure: 0.1,
    caffeineExposure: 0.05,
    alcoholExposure: 0,

    indoorLikelihood: 0.55,
  },

  nightlife: {
    physicalIntensity: 0.45,
    seatedIntensity: 0.3,
    socialIntensity: 0.9,
    conversationIntensity: 0.45,
    stimulation: 0.95,

    foodExposure: 0.2,
    caffeineExposure: 0.05,
    alcoholExposure: 0.85,

    indoorLikelihood: 0.85,
  },

  community: {
    physicalIntensity: 0.25,
    seatedIntensity: 0.45,
    socialIntensity: 0.8,
    conversationIntensity: 0.75,
    stimulation: 0.5,

    foodExposure: 0.2,
    caffeineExposure: 0.2,
    alcoholExposure: 0.2,

    indoorLikelihood: 0.65,
  },

  comedy: {
    physicalIntensity: 0.05,
    seatedIntensity: 0.95,
    socialIntensity: 0.55,
    conversationIntensity: 0.2,
    stimulation: 0.7,

    foodExposure: 0.15,
    caffeineExposure: 0.05,
    alcoholExposure: 0.45,

    indoorLikelihood: 0.95,
  },

  market: {
    physicalIntensity: 0.45,
    seatedIntensity: 0.15,
    socialIntensity: 0.55,
    conversationIntensity: 0.45,
    stimulation: 0.65,

    foodExposure: 0.45,
    caffeineExposure: 0.25,
    alcoholExposure: 0.15,

    indoorLikelihood: 0.35,
  },

  other: {
    physicalIntensity: 0.3,
    seatedIntensity: 0.45,
    socialIntensity: 0.5,
    conversationIntensity: 0.5,
    stimulation: 0.5,

    foodExposure: 0.15,
    caffeineExposure: 0.1,
    alcoholExposure: 0.1,

    indoorLikelihood: 0.6,
  },
}

/**
 * Event-specific evidence deliberately has more authority than the broad
 * archetype prior.
 *
 * These signals describe experiential characteristics only. They must never
 * encode venue recommendations or desired next-stop categories.
 */
const EVENT_SIGNALS: ExperienceSignal[] = [
  {
    id: "coffee_or_cafe",
    tokens: [
      "coffee",
      "cafe",
      "café",
      "espresso",
      "latte",
      "cappuccino",
      "matcha",
      "tea",
    ],
    adjustment: {
      caffeineExposure: 0.95,
      seatedIntensity: 0.7,
      conversationIntensity: 0.65,
      physicalIntensity: 0.1,
      indoorLikelihood: 0.8,
    },
    strength: "strong",
  },

  {
    id: "board_or_card_games",
    tokens: [
      "cards",
      "card",
      "boardgame",
      "boardgames",
      "tabletop",
      "chess",
      "mahjong",
      "dominoes",
    ],
    phrases: [
      "board game",
      "board games",
      "card game",
      "card games",
      "game night",
      "games night",
    ],
    adjustment: {
      physicalIntensity: 0.05,
      seatedIntensity: 0.95,
      socialIntensity: 0.9,
      conversationIntensity: 0.85,
      stimulation: 0.6,
      indoorLikelihood: 0.9,
    },
    strength: "strong",
  },

  {
    id: "discussion_or_book_club",
    tokens: [
      "discussion",
      "conversation",
      "bookclub",
      "reading",
      "salon",
    ],
    phrases: [
      "book club",
      "discussion group",
      "conversation group",
    ],
    adjustment: {
      physicalIntensity: 0.05,
      seatedIntensity: 0.9,
      socialIntensity: 0.75,
      conversationIntensity: 0.95,
      stimulation: 0.5,
      indoorLikelihood: 0.85,
    },
    strength: "strong",
  },

  {
    id: "networking_or_mixer",
    tokens: [
      "networking",
      "mixer",
      "founders",
      "founder",
      "startup",
      "startups",
      "entrepreneur",
      "entrepreneurs",
      "professional",
      "professionals",
      "investor",
      "investors",
    ],
    phrases: [
      "happy hour networking",
      "professional networking",
    ],
    adjustment: {
      physicalIntensity: 0.15,
      seatedIntensity: 0.4,
      socialIntensity: 0.95,
      conversationIntensity: 0.95,
      stimulation: 0.7,
    },
    strength: "strong",
  },

  {
    id: "meal_event",
    tokens: [
      "breakfast",
      "brunch",
      "lunch",
      "dinner",
      "supper",
      "feast",
      "omakase",
      "banquet",
    ],
    adjustment: {
      physicalIntensity: 0.05,
      seatedIntensity: 0.9,
      socialIntensity: 0.65,
      conversationIntensity: 0.7,
      foodExposure: 1,
      indoorLikelihood: 0.85,
    },
    strength: "strong",
  },

  {
    id: "food_tasting",
    tokens: [
      "tasting",
      "culinary",
      "chef",
      "pairing",
    ],
    phrases: [
      "food tasting",
      "chef dinner",
      "tasting menu",
    ],
    adjustment: {
      physicalIntensity: 0.1,
      seatedIntensity: 0.75,
      socialIntensity: 0.6,
      conversationIntensity: 0.55,
      foodExposure: 0.8,
      stimulation: 0.6,
      indoorLikelihood: 0.8,
    },
    strength: "strong",
  },

  {
    id: "alcohol_focused",
    tokens: [
      "cocktail",
      "cocktails",
      "wine",
      "beer",
      "brewery",
      "spirits",
      "whiskey",
      "whisky",
      "bourbon",
      "tequila",
    ],
    phrases: [
      "wine tasting",
      "beer tasting",
      "cocktail class",
      "cocktail tasting",
    ],
    adjustment: {
      alcoholExposure: 0.95,
      socialIntensity: 0.7,
      conversationIntensity: 0.65,
      seatedIntensity: 0.65,
      physicalIntensity: 0.1,
    },
    strength: "strong",
  },

  {
    id: "concert_or_live_music",
    tokens: [
      "concert",
      "music",
      "musician",
      "band",
      "singer",
      "dj",
      "showcase",
    ],
    phrases: [
      "live music",
      "live performance",
    ],
    adjustment: {
      physicalIntensity: 0.35,
      seatedIntensity: 0.3,
      socialIntensity: 0.7,
      conversationIntensity: 0.2,
      stimulation: 0.95,
    },
    strength: "strong",
  },

  {
    id: "comedy_or_improv",
    tokens: [
      "comedy",
      "standup",
      "comedian",
      "improv",
    ],
    phrases: [
      "stand up",
      "stand-up",
    ],
    adjustment: {
      physicalIntensity: 0.05,
      seatedIntensity: 0.95,
      socialIntensity: 0.55,
      conversationIntensity: 0.15,
      stimulation: 0.75,
      indoorLikelihood: 0.95,
    },
    strength: "strong",
  },

  {
    id: "gallery_or_museum",
    tokens: [
      "gallery",
      "museum",
      "exhibit",
      "exhibition",
      "installation",
      "art",
      "arts",
    ],
    phrases: [
      "art show",
      "gallery opening",
    ],
    adjustment: {
      physicalIntensity: 0.35,
      seatedIntensity: 0.2,
      socialIntensity: 0.4,
      conversationIntensity: 0.45,
      stimulation: 0.65,
      indoorLikelihood: 0.85,
    },
    strength: "strong",
  },

  {
    id: "market_or_fair",
    tokens: [
      "market",
      "markets",
      "flea",
      "bazaar",
      "fair",
      "vendors",
      "vendor",
      "makers",
      "maker",
    ],
    phrases: [
      "makers market",
      "farmers market",
      "farmers' market",
    ],
    adjustment: {
      physicalIntensity: 0.45,
      seatedIntensity: 0.1,
      socialIntensity: 0.55,
      conversationIntensity: 0.4,
      stimulation: 0.65,
      foodExposure: 0.35,
      indoorLikelihood: 0.3,
    },
    strength: "strong",
  },

  {
    id: "festival",
    tokens: [
      "festival",
    ],
    adjustment: {
      physicalIntensity: 0.5,
      seatedIntensity: 0.15,
      socialIntensity: 0.75,
      conversationIntensity: 0.35,
      stimulation: 0.9,
      foodExposure: 0.4,
      alcoholExposure: 0.3,
      indoorLikelihood: 0.2,
    },
    strength: "strong",
  },

  {
    id: "running_or_hiking",
    tokens: [
      "run",
      "running",
      "runner",
      "runners",
      "hike",
      "hiking",
      "walk",
      "walking",
      "cycling",
      "bike",
      "biking",
    ],
    phrases: [
      "run club",
      "walking club",
      "bike ride",
      "group ride",
    ],
    adjustment: {
      physicalIntensity: 0.95,
      seatedIntensity: 0.05,
      socialIntensity: 0.55,
      conversationIntensity: 0.35,
      stimulation: 0.6,
      foodExposure: 0.05,
      alcoholExposure: 0,
      indoorLikelihood: 0.05,
    },
    strength: "strong",
  },

  {
    id: "fitness_or_workout",
    tokens: [
      "fitness",
      "workout",
      "training",
      "exercise",
      "pickleball",
      "tennis",
      "basketball",
      "soccer",
      "volleyball",
    ],
    phrases: [
      "fitness class",
      "workout class",
    ],
    adjustment: {
      physicalIntensity: 0.95,
      seatedIntensity: 0.05,
      socialIntensity: 0.5,
      conversationIntensity: 0.25,
      stimulation: 0.7,
      foodExposure: 0.05,
      alcoholExposure: 0,
    },
    strength: "strong",
  },

  {
    id: "yoga_or_meditation",
    tokens: [
      "yoga",
      "pilates",
      "meditation",
      "breathwork",
      "mindfulness",
    ],
    adjustment: {
      physicalIntensity: 0.55,
      seatedIntensity: 0.35,
      socialIntensity: 0.25,
      conversationIntensity: 0.15,
      stimulation: 0.15,
      foodExposure: 0.05,
      alcoholExposure: 0,
      caffeineExposure: 0.05,
      indoorLikelihood: 0.6,
    },
    strength: "strong",
  },

  {
    id: "spectator_sports",
    tokens: [
      "sports",
      "sport",
      "match",
      "matchday",
      "football",
      "fifa",
      "tailgate",
      "pregame",
      "watchparty",
    ],
    phrases: [
      "watch party",
      "game day",
      "gameday",
    ],
    adjustment: {
      physicalIntensity: 0.2,
      seatedIntensity: 0.6,
      socialIntensity: 0.9,
      conversationIntensity: 0.45,
      stimulation: 0.9,
      foodExposure: 0.4,
      alcoholExposure: 0.55,
    },
    strength: "strong",
  },

  {
    id: "workshop_or_class",
    tokens: [
      "workshop",
      "class",
      "lesson",
      "seminar",
      "tutorial",
    ],
    phrases: [
      "hands on",
      "hands-on",
    ],
    adjustment: {
      physicalIntensity: 0.25,
      seatedIntensity: 0.65,
      socialIntensity: 0.5,
      conversationIntensity: 0.55,
      stimulation: 0.65,
      indoorLikelihood: 0.85,
    },
    strength: "moderate",
  },

  {
    id: "dance_or_party",
    tokens: [
      "party",
      "dancing",
      "dance",
      "rave",
      "club",
      "afterparty",
      "afterhours",
    ],
    adjustment: {
      physicalIntensity: 0.7,
      seatedIntensity: 0.1,
      socialIntensity: 0.9,
      conversationIntensity: 0.25,
      stimulation: 1,
      alcoholExposure: 0.7,
      indoorLikelihood: 0.9,
    },
    strength: "strong",
  },

  {
    id: "outdoor_event",
    tokens: [
      "outdoor",
      "outdoors",
      "park",
      "garden",
      "picnic",
      "trail",
    ],
    phrases: [
      "open air",
      "open-air",
    ],
    adjustment: {
      physicalIntensity: 0.4,
      seatedIntensity: 0.25,
      stimulation: 0.45,
      indoorLikelihood: 0.05,
    },
    strength: "moderate",
  },

  {
    id: "community_social",
    tokens: [
      "community",
      "social",
      "meetup",
      "gathering",
      "neighborhood",
    ],
    adjustment: {
      socialIntensity: 0.8,
      conversationIntensity: 0.75,
    },
    strength: "moderate",
  },
]

/**
 * Anchor-venue evidence is intentionally weaker than explicit event evidence.
 *
 * An event hosted at a restaurant is not automatically a meal. Likewise, an
 * event hosted at a brewery is not proof that an attendee consumed alcohol.
 */
const ANCHOR_SIGNALS: ExperienceSignal[] = [
  {
    id: "anchor_coffee_context",
    tokens: [
      "coffee",
      "cafe",
      "café",
      "espresso",
      "tea",
      "matcha",
    ],
    adjustment: {
      caffeineExposure: 0.55,
      seatedIntensity: 0.6,
      indoorLikelihood: 0.8,
    },
    strength: "weak",
  },

  {
    id: "anchor_restaurant_context",
    tokens: [
      "restaurant",
      "dining",
      "brunch",
      "breakfast",
      "lunch",
      "dinner",
      "food",
      "gastropub",
    ],
    adjustment: {
      foodExposure: 0.45,
      seatedIntensity: 0.65,
      indoorLikelihood: 0.8,
    },
    strength: "weak",
  },

  {
    id: "anchor_bar_context",
    tokens: [
      "bar",
      "cocktail",
      "brewery",
      "pub",
      "wine",
      "lounge",
      "speakeasy",
    ],
    adjustment: {
      alcoholExposure: 0.45,
      socialIntensity: 0.65,
      indoorLikelihood: 0.85,
    },
    strength: "weak",
  },

  {
    id: "anchor_gallery_context",
    tokens: [
      "gallery",
      "museum",
      "showroom",
      "exhibition",
      "art",
    ],
    adjustment: {
      physicalIntensity: 0.3,
      seatedIntensity: 0.2,
      stimulation: 0.6,
      indoorLikelihood: 0.85,
    },
    strength: "weak",
  },

  {
    id: "anchor_park_context",
    tokens: [
      "park",
      "garden",
      "trail",
      "outdoor",
      "outdoors",
    ],
    adjustment: {
      physicalIntensity: 0.4,
      seatedIntensity: 0.2,
      indoorLikelihood: 0.05,
    },
    strength: "weak",
  },
]

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Resolves a conservative experience profile for an event.
 *
 * Evidence precedence:
 *
 *   1. Explicit event title / description / tags
 *   2. Anchor venue semantic context
 *   3. Broad event archetype prior
 *   4. Conservative generic defaults
 *
 * The resolver intentionally does not:
 *
 *   - choose venue categories,
 *   - mutate planning roles,
 *   - score candidates,
 *   - enforce hard eligibility,
 *   - assume that attendees consumed available food/alcohol/caffeine.
 *
 * Its only responsibility is to describe the experience the event itself is
 * reasonably likely to have provided.
 */
export function resolveEventExperience(
  input: ResolveEventExperienceInput
): EventExperienceProfile {
  const archetype = normalizeArchetype(
    input.eventArchetype
  )

  const evidence = buildNormalizedEvidence(
    input
  )

  let profile = cloneNumericProfile(
    ARCHETYPE_PRIORS[archetype] ??
      ARCHETYPE_PRIORS.other
  )

  const evidenceEntries: string[] = [
    `archetype:${archetype}`,
  ]

  let explicitSignalCount = 0
  let anchorSignalCount = 0
  let strongSignalCount = 0
  let moderateSignalCount = 0

  for (const signal of EVENT_SIGNALS) {
    if (
      !matchesSignal(
        signal,
        evidence.eventTokens,
        evidence.eventPhrases
      )
    ) {
      continue
    }

    profile = applyAdjustment(
      profile,
      signal.adjustment,
      weightForStrength(signal.strength)
    )

    explicitSignalCount += 1

    if (signal.strength === "strong") {
      strongSignalCount += 1
    } else if (
      signal.strength === "moderate"
    ) {
      moderateSignalCount += 1
    }

    evidenceEntries.push(
      `event:${signal.id}`
    )
  }

  for (const signal of ANCHOR_SIGNALS) {
    if (
      !matchesSignal(
        signal,
        evidence.anchorTokens,
        evidence.anchorPhrases
      )
    ) {
      continue
    }

    profile = applyAdjustment(
      profile,
      signal.adjustment,
      weightForStrength(signal.strength)
    )

    anchorSignalCount += 1

    evidenceEntries.push(
      `anchor:${signal.id}`
    )
  }

  profile = applyCrossSignalCorrections(
    profile,
    evidence
  )

  const confidence =
    computeProfileConfidence({
      archetype,
      explicitSignalCount,
      anchorSignalCount,
      strongSignalCount,
      moderateSignalCount,
      hasEventText:
        evidence.eventTokens.length > 0,
    })

  return {
    physicalIntensity:
      toExperienceIntensity(
        profile.physicalIntensity
      ),

    seatedIntensity:
      toExperienceIntensity(
        profile.seatedIntensity
      ),

    socialIntensity:
      toExperienceIntensity(
        profile.socialIntensity
      ),

    conversationIntensity:
      toExperienceIntensity(
        profile.conversationIntensity
      ),

    stimulation:
      toExperienceIntensity(
        profile.stimulation
      ),

    foodExposure:
      toFoodExposure(
        profile.foodExposure
      ),

    caffeineExposure:
      toConsumptionExposure(
        profile.caffeineExposure
      ),

    alcoholExposure:
      toConsumptionExposure(
        profile.alcoholExposure
      ),

    indoorLikelihood:
      toExperienceIntensity(
        profile.indoorLikelihood
      ),

    confidence,

    evidence: uniqueStrings(
      evidenceEntries
    ).slice(
      0,
      MAX_EVIDENCE_ENTRIES
    ),
  }
}

// -----------------------------------------------------------------------------
// Evidence construction
// -----------------------------------------------------------------------------

function buildNormalizedEvidence(
  input: ResolveEventExperienceInput
): NormalizedEventEvidence {
  const eventTextValues = [
    ...normalizeStringArray(
      (
        input.event as EventRecord & {
          tags?: string[] | string | null
        }
      ).tags
    ),

    ...normalizeStringArray(
      input.eventTags
    ),

    input.event.title ?? "",
    input.event.description ?? "",
  ]

  const anchor = input.anchorVenue

  const anchorTextValues = anchor
    ? [
        anchor.name ?? "",
        anchor.description ?? "",

        ...normalizeStringArray(
          anchor.type
        ),

        ...normalizeStringArray(
          anchor.tags
        ),

        ...normalizeStringArray(
          anchor.vibe
        ),

        ...normalizeStringArray(
          anchor.time_category
        ),
      ]
    : []

  return {
    eventTokens:
      normalizeEvidenceTokens(
        eventTextValues
      ),

    eventPhrases:
      normalizeEvidencePhrases(
        eventTextValues
      ),

    anchorTokens:
      normalizeEvidenceTokens(
        anchorTextValues
      ),

    anchorPhrases:
      normalizeEvidencePhrases(
        anchorTextValues
      ),
  }
}

function normalizeEvidenceTokens(
  values: string[]
): string[] {
  return uniqueStrings(
    values.flatMap((value) =>
      normalizeTokenFragments(
        String(value)
      )
    )
  )
}

function normalizeEvidencePhrases(
  values: string[]
): string[] {
  return uniqueStrings(
    values
      .map((value) =>
        normalizePhrase(
          String(value)
        )
      )
      .filter(Boolean)
  )
}

function normalizeTokenFragments(
  value: string
): string[] {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .split(
      /[\s,./|_\\\-–—()[\]{}:;!?+]+/
    )
    .map((token) => token.trim())
    .filter(Boolean)
}

function normalizePhrase(
  value: string
): string {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[_/\\|]+/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(
      /[^a-z0-9\s]+/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeStringArray(
  value:
    | string[]
    | string
    | number
    | null
    | undefined
): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      String(entry)
    )
  }

  if (value == null) return []

  return [String(value)]
}

// -----------------------------------------------------------------------------
// Signal matching
// -----------------------------------------------------------------------------

function matchesSignal(
  signal: ExperienceSignal,
  tokens: string[],
  phrases: string[]
): boolean {
  const tokenSet = new Set(tokens)

  if (
    signal.tokens.some((token) =>
      tokenSet.has(
        normalizeSingleToken(token)
      )
    )
  ) {
    return true
  }

  if (
    !signal.phrases ||
    signal.phrases.length === 0
  ) {
    return false
  }

  const normalizedSignalPhrases =
    signal.phrases.map(
      normalizePhrase
    )

  return phrases.some((sourcePhrase) =>
    normalizedSignalPhrases.some(
      (expectedPhrase) =>
        containsNormalizedPhrase(
          sourcePhrase,
          expectedPhrase
        )
    )
  )
}

function containsNormalizedPhrase(
  source: string,
  expected: string
): boolean {
  if (!source || !expected) {
    return false
  }

  return (
    ` ${source} `.includes(
      ` ${expected} `
    )
  )
}

function normalizeSingleToken(
  value: string
): string {
  return (
    normalizeTokenFragments(value)[0] ??
    ""
  )
}

// -----------------------------------------------------------------------------
// Profile mutation
// -----------------------------------------------------------------------------

function applyAdjustment(
  profile: NumericExperienceProfile,
  adjustment: ProfileAdjustment,
  weight: number
): NumericExperienceProfile {
  const next = {
    ...profile,
  }

  for (
    const key of Object.keys(
      adjustment
    ) as Array<
      keyof NumericExperienceProfile
    >
  ) {
    const target =
      adjustment[key]

    if (
      target == null ||
      !Number.isFinite(target)
    ) {
      continue
    }

    const current = next[key]

    next[key] = clamp01(
      current +
        (clamp01(target) - current) *
          weight
    )
  }

  return next
}

/**
 * Handles combinations where multiple independent pieces of event evidence
 * provide a clearer experiential interpretation than either signal alone.
 *
 * These corrections still describe the event itself. They do not encode what
 * venue should come next.
 */
function applyCrossSignalCorrections(
  profile: NumericExperienceProfile,
  evidence: NormalizedEventEvidence
): NumericExperienceProfile {
  let next = {
    ...profile,
  }

  const eventTokenSet = new Set(
    evidence.eventTokens
  )

  const hasCoffeeSignal =
    hasAnyToken(
      eventTokenSet,
      [
        "coffee",
        "cafe",
        "café",
        "espresso",
        "latte",
        "cappuccino",
        "matcha",
        "tea",
      ]
    )

  const hasTabletopSignal =
    hasAnyToken(
      eventTokenSet,
      [
        "cards",
        "card",
        "boardgame",
        "boardgames",
        "tabletop",
        "chess",
        "mahjong",
        "dominoes",
      ]
    ) ||
    hasAnyPhrase(
      evidence.eventPhrases,
      [
        "board game",
        "board games",
        "card game",
        "card games",
        "game night",
      ]
    )

  /**
   * A coffee-centered tabletop/social event is materially different from a
   * generic community event or spectator-sports event: it is strongly seated,
   * conversational, social, and caffeine-exposed while remaining physically
   * light.
   */
  if (
    hasCoffeeSignal &&
    hasTabletopSignal
  ) {
    next = applyAdjustment(
      next,
      {
        physicalIntensity: 0.05,
        seatedIntensity: 0.98,
        socialIntensity: 0.92,
        conversationIntensity: 0.9,
        stimulation: 0.58,
        caffeineExposure: 0.98,
        indoorLikelihood: 0.92,
      },
      0.9
    )
  }

  const hasMealSignal =
    hasAnyToken(
      eventTokenSet,
      [
        "breakfast",
        "brunch",
        "lunch",
        "dinner",
        "supper",
        "feast",
        "omakase",
        "banquet",
      ]
    )

  const hasTastingSignal =
    hasAnyToken(
      eventTokenSet,
      [
        "tasting",
        "culinary",
        "pairing",
      ]
    )

  if (
    hasMealSignal &&
    hasTastingSignal
  ) {
    next = applyAdjustment(
      next,
      {
        foodExposure: 1,
        seatedIntensity: 0.9,
      },
      0.85
    )
  }

  const hasPhysicalSignal =
    hasAnyToken(
      eventTokenSet,
      [
        "run",
        "running",
        "hike",
        "hiking",
        "cycling",
        "bike",
        "biking",
        "fitness",
        "workout",
        "training",
        "pickleball",
        "tennis",
        "basketball",
        "soccer",
        "volleyball",
      ]
    )

  /**
   * Explicit participation language overrides a broad social-sports prior.
   * This keeps an actual run, workout, or recreational sport from inheriting
   * the seated/spectator assumptions of a watch-party style event.
   */
  if (hasPhysicalSignal) {
    next = applyAdjustment(
      next,
      {
        physicalIntensity: 0.95,
        seatedIntensity: 0.05,
      },
      0.9
    )
  }

  return clampNumericProfile(next)
}

// -----------------------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------------------

function computeProfileConfidence({
  archetype,
  explicitSignalCount,
  anchorSignalCount,
  strongSignalCount,
  moderateSignalCount,
  hasEventText,
}: {
  archetype: string
  explicitSignalCount: number
  anchorSignalCount: number
  strongSignalCount: number
  moderateSignalCount: number
  hasEventText: boolean
}): number {
  let confidence =
    archetype !== "other"
      ? 0.48
      : 0.3

  if (hasEventText) {
    confidence += 0.06
  }

  confidence += Math.min(
    strongSignalCount * 0.16,
    0.32
  )

  confidence += Math.min(
    moderateSignalCount * 0.09,
    0.18
  )

  const remainingExplicitSignals =
    Math.max(
      0,
      explicitSignalCount -
        strongSignalCount -
        moderateSignalCount
    )

  confidence += Math.min(
    remainingExplicitSignals * 0.05,
    0.1
  )

  confidence += Math.min(
    anchorSignalCount * 0.035,
    0.07
  )

  return roundToTwo(
    clamp(
      confidence,
      0.2,
      0.95
    )
  )
}

// -----------------------------------------------------------------------------
// Output conversion
// -----------------------------------------------------------------------------

function toExperienceIntensity(
  value: number
): ExperienceIntensity {
  const normalized = clamp01(value)

  if (normalized >= 0.67) {
    return "high"
  }

  if (normalized >= 0.34) {
    return "medium"
  }

  return "low"
}

function toConsumptionExposure(
  value: number
): ConsumptionExposure {
  const normalized = clamp01(value)

  if (normalized >= 0.67) {
    return "likely"
  }

  if (normalized >= 0.25) {
    return "possible"
  }

  return "none"
}

function toFoodExposure(
  value: number
): FoodExposure {
  const normalized = clamp01(value)

  if (normalized >= 0.7) {
    return "meal"
  }

  if (normalized >= 0.25) {
    return "light"
  }

  return "none"
}

// -----------------------------------------------------------------------------
// Archetype normalization
// -----------------------------------------------------------------------------

function normalizeArchetype(
  value: string
): string {
  const normalized = String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  if (
    normalized &&
    Object.prototype.hasOwnProperty.call(
      ARCHETYPE_PRIORS,
      normalized
    )
  ) {
    return normalized
  }

  return "other"
}

// -----------------------------------------------------------------------------
// General helpers
// -----------------------------------------------------------------------------

function weightForStrength(
  strength: EvidenceStrength
): number {
  if (strength === "strong") {
    return 0.82
  }

  if (strength === "moderate") {
    return 0.62
  }

  return 0.38
}

function cloneNumericProfile(
  profile: NumericExperienceProfile
): NumericExperienceProfile {
  return {
    ...profile,
  }
}

function clampNumericProfile(
  profile: NumericExperienceProfile
): NumericExperienceProfile {
  return {
    physicalIntensity:
      clamp01(
        profile.physicalIntensity
      ),

    seatedIntensity:
      clamp01(
        profile.seatedIntensity
      ),

    socialIntensity:
      clamp01(
        profile.socialIntensity
      ),

    conversationIntensity:
      clamp01(
        profile.conversationIntensity
      ),

    stimulation:
      clamp01(
        profile.stimulation
      ),

    foodExposure:
      clamp01(
        profile.foodExposure
      ),

    caffeineExposure:
      clamp01(
        profile.caffeineExposure
      ),

    alcoholExposure:
      clamp01(
        profile.alcoholExposure
      ),

    indoorLikelihood:
      clamp01(
        profile.indoorLikelihood
      ),
  }
}

function hasAnyToken(
  tokenSet: Set<string>,
  expected: string[]
): boolean {
  return expected.some((token) =>
    tokenSet.has(
      normalizeSingleToken(token)
    )
  )
}

function hasAnyPhrase(
  sourcePhrases: string[],
  expectedPhrases: string[]
): boolean {
  const normalizedExpected =
    expectedPhrases.map(
      normalizePhrase
    )

  return sourcePhrases.some(
    (source) =>
      normalizedExpected.some(
        (expected) =>
          containsNormalizedPhrase(
            source,
            expected
          )
      )
  )
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values.filter(Boolean)
    )
  )
}

function clamp01(
  value: number
): number {
  return clamp(value, 0, 1)
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(value)
        ? value
        : minimum
    )
  )
}

function roundToTwo(
  value: number
): number {
  return Math.round(value * 100) / 100
}