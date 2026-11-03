
import type { Venue } from '@/types/venue'
import { DateTime } from 'luxon'

import {
  sequencedStagesForNow,
  fallbackFlowFromStage,
} from '@/utils/stageUtils'

import {
  isVenueOpenNow,
  daypartAllowedAtTime,
} from '@/utils/timeUtils'

import {
  venueMatchesAnyType,
  getVenueTypes,
} from '@/lib/venues/typeMatching'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type CrawlStageResult = {
  stageTypes: readonly string[]
  venue: Venue
  matchedType: string | null
}

export type CrawlResult = {
  venues: Venue[]
  stages: CrawlStageResult[]
}

export type ThemedCrawlResult = {
  theme: CrawlTheme
  crawl: CrawlResult
}

type CrawlTheme =
  | 'dateNight'
  | 'nightOut'
  | 'morningFlow'
  | 'soloExplorer'

type MealBucket =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | null

type CrawlGenerationOpts = {
  durationHours?: number
  latestEndHour?: number
  theme?: CrawlTheme
  stageIndex?: number
  previousVenue?: Venue | null
  discouragedVenueIds?: Set<string>
  stronglyDiscouragedVenueIds?: Set<string>

  /**
   * Opts into the dedicated property itinerary planner.
   *
   * Omitted/false retains the original general-purpose
   * generateCrawl() behavior.
   */
  propertyPlanning?: boolean
}

/* ------------------------------------------------ */
/* Config                                           */
/* ------------------------------------------------ */

const MAX_STAGES = 6
const MIN_VENUE_DISTANCE_METERS = 80
const IDEAL_WALK_MIN_METERS = 180
const IDEAL_WALK_MAX_METERS = 950
const SOFT_WALK_MAX_METERS = 1400
const HARD_INTERSTOP_MAX_METERS = 1800

const BREAKFAST_LIKE_TYPES = [
  'breakfast',
  'brunch',
  'coffee',
  'cafe',
  'café',
  'bakery',
]

const LUNCH_LIKE_TYPES = [
  'lunch',
  'restaurant',
]

const DINNER_LIKE_TYPES = [
  'dinner',
  'restaurant',
  'kitchen',
]

const MEAL_INTENT_TYPES = [
  ...BREAKFAST_LIKE_TYPES,
  ...LUNCH_LIKE_TYPES,
  ...DINNER_LIKE_TYPES,
]

/* ------------------------------------------------ */
/* Stage Type Exclusions                            */
/* ------------------------------------------------ */

const STAGE_TYPE_EXCLUSIONS: Record<
  string,
  string[]
> = {
  club: [
    'coffee',
    'bakery',
    'dessert',
    'cafe',
  ],
  bar: [
    'coffee',
    'bakery',
    'dessert',
  ],
  cocktail: [
    'coffee',
    'bakery',
    'dessert',
  ],
}

/* ------------------------------------------------ */
/* Canonical Roam Day Flow                          */
/* ------------------------------------------------ */

const DEFAULT_DAY_TRAJECTORY:
  readonly (readonly string[])[] = [
    ['fitness', 'yoga', 'spa'],
    ['coffee', 'cafe', 'bakery', 'breakfast'],
    ['brunch', 'lunch', 'restaurant'],
    ['gallery', 'park', 'cafe'],
    ['wine bar', 'dinner', 'music'],
    ['bar', 'cocktail', 'speakeasy', 'club'],
  ]

/* ------------------------------------------------ */
/* Theme Stage Flows                                */
/* ------------------------------------------------ */

const THEME_STAGE_FLOWS: Record<
  CrawlTheme,
  readonly (readonly string[])[]
> = {
  dateNight: [
    ['dinner', 'restaurant'],
    ['wine bar', 'cocktail'],
    ['cocktail', 'lounge', 'speakeasy'],
    ['dessert'],
  ],

  nightOut: [
    ['dinner'],
    ['cocktail', 'wine bar'],
    ['bar', 'lounge'],
    ['club', 'dance'],
  ],

  morningFlow: [
    ['fitness', 'yoga', 'pilates'],
    [
      'breakfast',
      'brunch',
      'coffee',
      'cafe',
      'café',
      'bakery',
    ],
    ['park', 'garden', 'market'],
    ['spa', 'bookstore'],
  ],

  soloExplorer: [
    ['coffee', 'cafe', 'bakery'],
    ['gallery', 'bookstore', 'lifestyle'],
    ['park', 'garden'],
    ['lunch', 'wine bar', 'dessert'],
    ['dinner', 'restaurant', 'gallery', 'random gem'],
  ],
}

/* ------------------------------------------------ */
/* Theme Signals                                    */
/* ------------------------------------------------ */

const CRAWL_THEME_SIGNALS: Record<
  CrawlTheme,
  {
    vibes: string[]
    tags: string[]
  }
> = {
  dateNight: {
    vibes: [
      'romantic',
      'intimate',
      'moody',
      'sultry',
      'cozy',
    ],
    tags: [
      'wine',
      'dessert',
      'cocktail',
    ],
  },

  nightOut: {
    vibes: [
      'lively',
      'energetic',
      'social',
      'dj',
      'beer',
      'weekend',
    ],
    tags: [
      'dj',
      'crowded',
      'late',
      'late-night',
      'bar',
      'dance',
      'club',
      'cocktail',
    ],
  },

  morningFlow: {
    vibes: [
      'calm',
      'peaceful',
      'fresh',
    ],
    tags: [
      'coffee',
      'bakery',
      'yoga',
      'tea',
    ],
  },

  soloExplorer: {
    vibes: [
      'cozy',
      'quiet',
      'introspective',
      'exhibit',
    ],
    tags: [
      'bookstore',
      'gallery',
      'cafe',
      'café',
    ],
  },
}

/* ------------------------------------------------ */
/* Property Crawl Intelligence — Phase 1            */
/* ------------------------------------------------ */

/**
 * These stages apply ONLY to property crawls.
 *
 * Each theme has two essential roles and one
 * optional enhancement.
 *
 * General-purpose crawls continue to use
 * THEME_STAGE_FLOWS without modification.
 */

type PropertyCrawlStage = {
  stageTypes: readonly string[]
  required: boolean
}

const PROPERTY_STAGE_PLANS: Record<
  CrawlTheme,
  readonly PropertyCrawlStage[]
> = {
  morningFlow: [
    {
      stageTypes: [
        'coffee',
        'cafe',
        'café',
        'breakfast',
        'brunch',
        'bakery',
        'tea',
      ],
      required: true,
    },
    {
      stageTypes: [
        'park',
        'garden',
        'bookstore',
        'gallery',
        'museum',
        'market',
        'boutique',
      ],
      required: true,
    },
    {
      stageTypes: [
        'park',
        'garden',
        'bookstore',
        'gallery',
        'museum',
        'market',
        'boutique',
      ],
      required: false,
    },
  ],

  soloExplorer: [
    {
      stageTypes: [
        'gallery',
        'museum',
        'bookstore',
        'market',
        'boutique',
        'lifestyle',
      ],
      required: true,
    },
    {
      stageTypes: [
        'coffee',
        'cafe',
        'café',
        'bakery',
        'tea',
        'lunch',
        'deli',
        'dessert',
      ],
      required: true,
    },
    {
      stageTypes: [
        'park',
        'garden',
        'gallery',
        'museum',
        'bookstore',
        'market',
        'boutique',
      ],
      required: false,
    },
  ],

  dateNight: [
    {
      stageTypes: [
        'dinner',
        'restaurant',
        'steakhouse',
        'bistro',
      ],
      required: true,
    },
    {
      stageTypes: [
        'wine bar',
        'cocktail',
        'cocktail bar',
        'speakeasy',
        'lounge',
      ],
      required: true,
    },
    {
      stageTypes: [
        'dessert',
        'gelato',
        'ice cream',
      ],
      required: false,
    },
  ],

  nightOut: [
    {
      stageTypes: [
        'cocktail',
        'cocktail bar',
        'wine bar',
        'speakeasy',
        'lounge',
        'bar',
        'pub',
        'taproom',
      ],
      required: true,
    },
    {
      stageTypes: [
        'live music',
        'music venue',
        'club',
        'nightclub',
        'dance',
        'bar',
        'pub',
        'lounge',
        'speakeasy',
        'cocktail',
        'cocktail bar',
      ],
      required: true,
    },
    {
      stageTypes: [
        'live music',
        'music venue',
        'club',
        'nightclub',
        'dance',
        'lounge',
        'speakeasy',
        'bar',
      ],
      required: false,
    },
  ],
}

/* ------------------------------------------------ */
/* Property-only category equivalences              */
/* ------------------------------------------------ */

const PROPERTY_TYPE_EQUIVALENTS: Record<
  string,
  readonly string[]
> = {
  coffee: [
    'coffee',
    'coffee shop',
    'cafe',
    'café',
  ],
  cafe: [
    'cafe',
    'café',
    'coffee shop',
  ],
  'café': [
    'café',
    'cafe',
    'coffee shop',
  ],
  tea: [
    'tea',
    'tea room',
  ],
  breakfast: [
    'breakfast',
    'brunch',
  ],
  dinner: [
    'dinner',
    'restaurant',
    'steakhouse',
    'bistro',
  ],
  restaurant: [
    'restaurant',
    'steakhouse',
    'bistro',
    'dinner',
  ],
  cocktail: [
    'cocktail',
    'cocktail bar',
  ],
  'cocktail bar': [
    'cocktail bar',
    'cocktail',
  ],
  'wine bar': [
    'wine bar',
  ],
  club: [
    'club',
    'nightclub',
    'dance club',
  ],
  nightclub: [
    'nightclub',
    'club',
    'dance club',
  ],
  dance: [
    'dance',
    'nightclub',
    'dance club',
  ],
  gallery: [
    'gallery',
    'art gallery',
  ],
  museum: [
    'museum',
    'art museum',
  ],
  bookstore: [
    'bookstore',
    'book shop',
    'bookshop',
  ],
  boutique: [
    'boutique',
    'shop',
  ],
  market: [
    'market',
    'local market',
  ],
  'live music': [
    'live music',
    'music venue',
  ],
  'music venue': [
    'music venue',
    'live music',
  ],
  dessert: [
    'dessert',
    'ice cream',
    'gelato',
  ],
  'ice cream': [
    'ice cream',
    'gelato',
    'dessert',
  ],
  gelato: [
    'gelato',
    'ice cream',
    'dessert',
  ],
}

/* ------------------------------------------------ */
/* Property geographic limits                       */
/* ------------------------------------------------ */

/**
 * Distances are straight-line screening distances,
 * not verified pedestrian-route measurements.
 */

const PROPERTY_MAX_FIRST_LEG_METERS = 1200
const PROPERTY_MAX_INTERSTOP_METERS = 1000
const PROPERTY_MAX_TOTAL_DISTANCE_METERS = 2400
const PROPERTY_MAX_DISTANCE_FROM_ORIGIN_METERS = 1800
const PROPERTY_MIN_INTERSTOP_METERS = 45
const PROPERTY_OPTIONAL_MAX_LEG_METERS = 650

const PROPERTY_MIN_STOPS = 2
const PROPERTY_MAX_STOPS = 3

/* ------------------------------------------------ */
/* Complete-itinerary planning — Phase 1B           */
/* ------------------------------------------------ */

/**
 * Limit combinatorial work without returning to
 * first-match greedy selection.
 *
 * These are search limits, not guest-facing limits.
 */

const PROPERTY_FIRST_STAGE_CANDIDATES = 10
const PROPERTY_SECOND_STAGE_CANDIDATES = 10
const PROPERTY_OPTIONAL_STAGE_CANDIDATES = 5

const PROPERTY_MAX_ITINERARY_OPTIONS_PER_THEME = 20

/**
 * A third stop must earn its place.
 *
 * The optional-stop bonus is deliberately modest:
 * a weak three-stop route should lose to a strong
 * two-stop route.
 */
const PROPERTY_OPTIONAL_STOP_BONUS = 3

/* ------------------------------------------------ */
/* Property scheduling — Phase 2 — NEW               */
/* ------------------------------------------------ */

/**
 * Intended departure time from the property.
 *
 * This is not a reservation time. It is the start
 * of the proposed outing, expressed in the local
 * time zone already carried by the supplied Luxon
 * DateTime.
 *
 * The next occurrence of this local clock time is
 * used. If today's time has passed, plan tomorrow.
 *
 * No changes are made to generic crawl scheduling.
 */
const PROPERTY_THEME_START_TIMES: Record<
  CrawlTheme,
  {
    hour: number
    minute: number
  }
> = {
  morningFlow: {
    hour: 9,
    minute: 0,
  },
  soloExplorer: {
    hour: 11,
    minute: 0,
  },
  dateNight: {
    hour: 18,
    minute: 30,
  },
  nightOut: {
    hour: 20,
    minute: 30,
  },
}

/**
 * Conservative planning assumptions for an outing.
 *
 * Distances remain straight-line estimates, so the
 * walking calculation includes an indirect-route
 * adjustment. This is not a verified pedestrian ETA.
 *
 * Dwell times represent reasonable time spent at
 * each type of stop, not operating-hours guarantees.
 */
const PROPERTY_WALKING_METERS_PER_MINUTE = 72
const PROPERTY_WALKING_MINIMUM_MINUTES = 2

const PROPERTY_STAGE_DWELL_MINUTES: Record<
  CrawlTheme,
  readonly number[]
> = {
  morningFlow: [40, 35, 25],
  soloExplorer: [40, 40, 30],
  dateNight: [75, 45, 25],
  nightOut: [45, 60, 45],
}

function resolvePropertyPlanningStart(
  now: DateTime,
  theme: CrawlTheme
): DateTime {
  const target =
    PROPERTY_THEME_START_TIMES[theme]

  const today =
    now.set({
      hour: target.hour,
      minute: target.minute,
      second: 0,
      millisecond: 0,
    })

  return today.toMillis() >=
    now.toMillis()
    ? today
    : today.plus({ days: 1 })
}

function getPropertyWalkingMinutes(
  distance: number
): number {
  return Math.max(
    PROPERTY_WALKING_MINIMUM_MINUTES,
    Math.ceil(
      distance /
        PROPERTY_WALKING_METERS_PER_MINUTE
    )
  )
}

function getPropertyStageDwellMinutes(
  theme: CrawlTheme,
  stageIndex: number
): number {
  return (
    PROPERTY_STAGE_DWELL_MINUTES[theme][
      stageIndex
    ] ?? 30
  )
}

/**
 * A venue needs to be open when the guest arrives
 * and through the proposed stay.
 *
 * isVenueOpenNow() uses an exclusive closing bound.
 * The one-minute offset checks just before the
 * estimated departure rather than at closing itself.
 *
 * This does not verify reservations, special hours,
 * temporary closures, or bookability.
 */
function propertyVenueOpenForVisit(
  venue: Venue,
  arrivalAt: DateTime,
  dwellMinutes: number
): boolean {
  const lastVisitMinute =
    arrivalAt.plus({
      minutes:
        Math.max(1, dwellMinutes) -
        1,
    })

  return (
    isVenueOpenNow(
      venue,
      arrivalAt
    ) &&
    isVenueOpenNow(
      venue,
      lastVisitMinute
    )
  )
}

type PropertyStageChoice = {
  venue: Venue
  matchedType: string
  distance: number

  /**
   * NEW: projected arrival for this specific
   * candidate and its preceding route.
   */
  arrivalAt: DateTime
}

type PropertyItineraryCandidate = {
  theme: CrawlTheme
  crawl: CrawlResult
  score: number
  venueIds: Set<string>
  totalDistance: number
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function normalizeStringList(
  value: string | string[] | undefined
): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        String(item).split(/[,;/|]/g)
      )
      .map((item) =>
        item.trim().toLowerCase()
      )
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .toLowerCase()
      .split(/[,;/|]/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function venueMatchesTags(
  venue: Venue,
  tags: string[]
) {
  const venueTags =
    normalizeStringList(venue.tags)

  return tags.some((tag) =>
    venueTags.includes(
      tag.toLowerCase()
    )
  )
}

function venueMatchesVibe(
  venue: Venue,
  vibes: string[]
) {
  const venueVibes =
    normalizeStringList(venue.vibe)

  return vibes.some((vibe) =>
    venueVibes.includes(
      vibe.toLowerCase()
    )
  )
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3

  const φ1 =
    (lat1 * Math.PI) / 180

  const φ2 =
    (lat2 * Math.PI) / 180

  const Δφ =
    ((lat2 - lat1) * Math.PI) / 180

  const Δλ =
    ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

  return R * c
}

function getHour(
  now: DateTime
) {
  return (
    now.hour +
    now.minute / 60
  )
}

function isWeekend(
  now: DateTime
) {
  return (
    now.weekday === 6 ||
    now.weekday === 7
  )
}

function hasAnyType(
  types: string[],
  candidates: string[]
) {
  return candidates.some(
    (candidate) =>
      types.includes(candidate)
  )
}

function getMatchedStageType(
  venue: Venue,
  stageTypes: readonly string[]
) {
  const venueTypes =
    getVenueTypes(venue)

  for (const stageType of stageTypes) {
    if (
      venueTypes.includes(stageType)
    ) {
      return stageType
    }
  }

  return venueTypes[0] ?? null
}

function isLunchLikeType(
  value: string | null
) {
  if (!value) return false

  return LUNCH_LIKE_TYPES.includes(
    value.toLowerCase()
  )
}

function isEarlyDayMealType(
  value: string | null
) {
  if (!value) return false

  return BREAKFAST_LIKE_TYPES.includes(
    value.toLowerCase()
  )
}

function inferMealBucketFromTypes(
  types: string[],
  now: DateTime
): MealBucket {
  const hour = getHour(now)

  if (
    hasAnyType(types, ['breakfast'])
  ) {
    return 'breakfast'
  }

  if (
    hasAnyType(types, ['brunch'])
  ) {
    return isWeekend(now) ||
      hour < 14
      ? 'breakfast'
      : 'lunch'
  }

  if (
    hasAnyType(types, [
      'coffee',
      'cafe',
      'café',
      'bakery',
    ])
  ) {
    return hour < 14
      ? 'breakfast'
      : null
  }

  if (
    hasAnyType(types, ['lunch'])
  ) {
    return 'lunch'
  }

  if (
    hasAnyType(types, ['dinner'])
  ) {
    return 'dinner'
  }

  if (
    hasAnyType(types, [
      'restaurant',
      'kitchen',
    ])
  ) {
    if (hour < 11) return 'breakfast'
    if (hour < 16.5) return 'lunch'

    return 'dinner'
  }

  return null
}

function stageHasMealIntent(
  stageTypes: readonly string[]
) {
  return stageTypes.some(
    (type) =>
      MEAL_INTENT_TYPES.includes(
        type.toLowerCase()
      )
  )
}

function shouldRejectDuplicateMealBucket({
  venue,
  now,
  usedMealBuckets,
}: {
  venue: Venue
  now: DateTime
  usedMealBuckets: Set<MealBucket>
}) {
  const bucket =
    inferMealBucketFromTypes(
      getVenueTypes(venue),
      now
    )

  if (!bucket) return false

  return usedMealBuckets.has(bucket)
}

function resolveContextualMatchedType({
  venue,
  stageTypes,
  previousMatchedTypes,
}: {
  venue: Venue
  stageTypes: readonly string[]
  previousMatchedTypes: string[]
}) {
  const matchedType =
    getMatchedStageType(
      venue,
      stageTypes
    )

  const alreadyHadLunch =
    previousMatchedTypes.some(
      isLunchLikeType
    )

  const stageCanBeDinner =
    stageTypes.some(
      (type) =>
        DINNER_LIKE_TYPES.includes(
          type.toLowerCase()
        )
    )

  if (
    alreadyHadLunch &&
    stageCanBeDinner &&
    !isEarlyDayMealType(matchedType)
  ) {
    return 'dinner'
  }

  return matchedType
}

function shouldSkipForThemeDistinctness(
  venueId: string,
  opts?: CrawlGenerationOpts
) {
  const stageIndex =
    opts?.stageIndex ?? 0

  if (stageIndex > 1) return false

  const stronglyDiscouraged =
    opts?.stronglyDiscouragedVenueIds?.has(
      venueId
    ) ?? false

  const discouraged =
    opts?.discouragedVenueIds?.has(
      venueId
    ) ?? false

  if (stageIndex === 0) {
    return (
      stronglyDiscouraged ||
      discouraged
    )
  }

  if (stageIndex === 1) {
    return (
      stronglyDiscouraged ||
      discouraged
    )
  }

  return false
}

/* ------------------------------------------------ */
/* Contextual Scoring — original                    */
/* ------------------------------------------------ */

function scoreDistanceFit(
  distance: number
) {
  if (
    distance <
    MIN_VENUE_DISTANCE_METERS
  ) {
    return -100
  }

  if (
    distance >=
      IDEAL_WALK_MIN_METERS &&
    distance <=
      IDEAL_WALK_MAX_METERS
  ) {
    return 10
  }

  if (
    distance <
    IDEAL_WALK_MIN_METERS
  ) {
    return 3
  }

  if (
    distance <=
    SOFT_WALK_MAX_METERS
  ) {
    return 2
  }

  if (
    distance <=
    HARD_INTERSTOP_MAX_METERS
  ) {
    return -8
  }

  return -35
}

function scoreThemeTimeFit(
  theme: CrawlTheme | undefined,
  now: DateTime
) {
  if (!theme) return 0

  const hour = getHour(now)

  if (
    theme === 'morningFlow'
  ) {
    if (
      hour >= 6 &&
      hour <= 11.5
    ) {
      return 16
    }

    if (hour <= 13) return 6

    return -30
  }

  if (
    theme === 'dateNight'
  ) {
    if (
      hour >= 17 &&
      hour <= 22.5
    ) {
      return 16
    }

    if (
      hour >= 15.5 &&
      hour < 17
    ) {
      return 4
    }

    return -22
  }

  if (
    theme === 'nightOut'
  ) {
    if (
      hour >= 18 ||
      hour <= 2
    ) {
      return 18
    }

    if (
      hour >= 16.5
    ) {
      return 5
    }

    return -26
  }

  if (
    theme === 'soloExplorer'
  ) {
    if (
      hour >= 9 &&
      hour <= 18.5
    ) {
      return 12
    }

    if (
      hour > 18.5 &&
      hour <= 21
    ) {
      return 2
    }

    return -10
  }

  return 0
}

function scoreStageTimeFit(
  stageTypes: readonly string[],
  now: DateTime
) {
  const hour = getHour(now)

  const types =
    stageTypes.map(
      (type) =>
        type.toLowerCase()
    )

  let score = 0

  if (
    hasAnyType(types, [
      'coffee',
      'cafe',
      'café',
      'bakery',
      'breakfast',
    ])
  ) {
    if (
      hour >= 6 &&
      hour < 11.5
    ) {
      score += 14
    } else if (
      hour < 14
    ) {
      score += 4
    } else {
      score -= 18
    }
  }

  if (
    hasAnyType(types, [
      'brunch',
    ])
  ) {
    if (
      isWeekend(now) &&
      hour >= 9 &&
      hour <= 14
    ) {
      score += 12
    } else if (
      hour >= 10 &&
      hour <= 13
    ) {
      score += 4
    } else {
      score -= 12
    }
  }

  if (
    hasAnyType(types, [
      'lunch',
    ])
  ) {
    if (
      hour >= 11 &&
      hour <= 15.5
    ) {
      score += 12
    } else if (
      hour >= 10 &&
      hour <= 17
    ) {
      score += 3
    } else {
      score -= 10
    }
  }

  if (
    hasAnyType(types, [
      'dinner',
      'restaurant',
    ])
  ) {
    if (
      hour >= 17 &&
      hour <= 22
    ) {
      score += 12
    } else if (
      hour >= 15.5 &&
      hour < 17
    ) {
      score -= 4
    } else {
      score -= 16
    }
  }

  if (
    hasAnyType(types, [
      'bar',
      'cocktail',
      'wine bar',
      'lounge',
      'speakeasy',
      'club',
      'brewery',
    ])
  ) {
    if (
      hour >= 17 ||
      hour <= 2
    ) {
      score += 14
    } else if (
      hour >= 14
    ) {
      score += 2
    } else {
      score -= 20
    }
  }

  if (
    hasAnyType(types, [
      'gallery',
      'museum',
      'bookstore',
      'lifestyle',
      'park',
      'garden',
      'market',
    ])
  ) {
    if (
      hour >= 10 &&
      hour <= 18.5
    ) {
      score += 10
    } else {
      score -= 8
    }
  }

  if (
    hasAnyType(types, [
      'fitness',
      'yoga',
      'pilates',
      'spa',
      'wellness',
    ])
  ) {
    if (
      hour >= 6 &&
      hour <= 12.5
    ) {
      score += 12
    } else if (
      hour <= 15
    ) {
      score += 3
    } else {
      score -= 14
    }
  }

  return score
}

function scoreSequenceCoherence(
  previousVenue: Venue | null | undefined,
  candidate: Venue
) {
  if (!previousVenue) return 0

  const previousTypes =
    getVenueTypes(previousVenue)

  const candidateTypes =
    getVenueTypes(candidate)

  let score = 0

  const previousCoffee = hasAnyType(
    previousTypes,
    [
      'coffee',
      'cafe',
      'café',
      'bakery',
      'breakfast',
    ]
  )

  const candidateCoffee = hasAnyType(
    candidateTypes,
    [
      'coffee',
      'cafe',
      'café',
      'bakery',
      'breakfast',
    ]
  )

  const previousMeal = hasAnyType(
    previousTypes,
    [
      'lunch',
      'dinner',
      'restaurant',
      'brunch',
    ]
  )

  const candidateMeal = hasAnyType(
    candidateTypes,
    [
      'lunch',
      'dinner',
      'restaurant',
      'brunch',
    ]
  )

  const previousDrink = hasAnyType(
    previousTypes,
    [
      'bar',
      'cocktail',
      'wine bar',
      'lounge',
      'brewery',
      'speakeasy',
    ]
  )

  const candidateDrink = hasAnyType(
    candidateTypes,
    [
      'bar',
      'cocktail',
      'wine bar',
      'lounge',
      'brewery',
      'speakeasy',
    ]
  )

  const previousBrowse = hasAnyType(
    previousTypes,
    [
      'gallery',
      'museum',
      'bookstore',
      'lifestyle',
      'park',
      'garden',
    ]
  )

  const candidateBrowse = hasAnyType(
    candidateTypes,
    [
      'gallery',
      'museum',
      'bookstore',
      'lifestyle',
      'park',
      'garden',
    ]
  )

  if (
    previousCoffee &&
    candidateMeal
  ) {
    score += 10
  }

  if (
    previousMeal &&
    candidateDrink
  ) {
    score += 10
  }

  if (
    previousDrink &&
    candidateDrink
  ) {
    score += 4
  }

  if (
    previousBrowse &&
    candidateCoffee
  ) {
    score += 4
  }

  if (
    previousCoffee &&
    candidateBrowse
  ) {
    score += 6
  }

  if (
    previousCoffee &&
    candidateCoffee
  ) {
    score -= 22
  }

  if (
    previousMeal &&
    candidateCoffee
  ) {
    score -= 20
  }

  if (
    previousMeal &&
    candidateMeal
  ) {
    score -= 18
  }

  if (
    previousBrowse &&
    candidateBrowse
  ) {
    score -= 4
  }

  return score
}

function hasAbsurdTimeMismatch(
  venue: Venue,
  now: DateTime
) {
  const hour = getHour(now)
  const types = getVenueTypes(venue)

  const isMorningOnly =
    hasAnyType(types, [
      'breakfast',
      'bakery',
    ])

  const isCoffeeLike =
    hasAnyType(types, [
      'coffee',
      'cafe',
      'café',
      'tea',
    ])

  const isDinnerOnly =
    hasAnyType(types, [
      'dinner',
    ]) &&
    !hasAnyType(types, [
      'bar',
      'cocktail',
      'wine bar',
      'lounge',
    ])

  const isNightlifeLike =
    hasAnyType(types, [
      'club',
      'speakeasy',
      'late night',
    ])

  if (
    isMorningOnly &&
    hour >= 12.5
  ) {
    return true
  }

  if (
    isCoffeeLike &&
    hour >= 18.5
  ) {
    return true
  }

  if (
    isDinnerOnly &&
    hour < 16.5
  ) {
    return true
  }

  if (
    isNightlifeLike &&
    hour >= 6 &&
    hour < 17
  ) {
    return true
  }

  return false
}

/* ------------------------------------------------ */
/* Venue Stage Matching — original                  */
/* ------------------------------------------------ */

function filterStageCandidates(
  venues: Venue[],
  stageTypes: readonly string[],
  now: DateTime
) {
  return venues.filter((v) => {
    if (
      !venueMatchesAnyType(
        v,
        stageTypes
      )
    ) {
      return false
    }

    if (
      !isVenueOpenNow(v, now)
    ) {
      return false
    }

    if (
      hasAbsurdTimeMismatch(
        v,
        now
      )
    ) {
      return false
    }

    return true
  })
}

/* ------------------------------------------------ */
/* Venue Scoring — original                         */
/* ------------------------------------------------ */

function scoreVenue(
  venue: Venue,
  stageTypes: readonly string[],
  now: DateTime,
  theme?: CrawlTheme,
  opts: CrawlGenerationOpts = {},
  originLat?: number,
  originLon?: number
) {
  let score = 0

  const types =
    getVenueTypes(venue)

  if (
    types.some((t) =>
      stageTypes.includes(t)
    )
  ) {
    score += 18
  }

  if (
    venue.energyRamp
  ) {
    score +=
      venue.energyRamp * 0.35
  }

  if (
    daypartAllowedAtTime(
      venue,
      now
    )
  ) {
    score += 8
  } else {
    score -= 10
  }

  score += scoreStageTimeFit(
    stageTypes,
    now
  )

  score += scoreThemeTimeFit(
    theme,
    now
  )

  score += scoreSequenceCoherence(
    opts.previousVenue,
    venue
  )

  if (
    typeof originLat ===
      'number' &&
    typeof originLon ===
      'number' &&
    Number.isFinite(
      originLat
    ) &&
    Number.isFinite(
      originLon
    )
  ) {
    const distance =
      distanceMeters(
        originLat,
        originLon,
        venue.lat,
        venue.lon
      )

    score += scoreDistanceFit(
      distance
    )
  }

  if (theme) {
    const signals =
      CRAWL_THEME_SIGNALS[theme]

    if (
      venueMatchesTags(
        venue,
        signals.tags
      )
    ) {
      score += 10
    }

    if (
      venueMatchesVibe(
        venue,
        signals.vibes
      )
    ) {
      score += 14
    }
  }

  return score
}

/* ------------------------------------------------ */
/* Venue Selector — original                        */
/* ------------------------------------------------ */

function selectVenueForStage(
  venues: Venue[],
  stageTypes: readonly string[],
  usedIds: Set<string>,
  usedTypes: Record<string, number>,
  usedMealBuckets: Set<MealBucket>,
  now: DateTime,
  originLat: number,
  originLon: number,
  opts: CrawlGenerationOpts = {}
) {
  let candidates =
    filterStageCandidates(
      venues,
      stageTypes,
      now
    ).filter(
      (v) =>
        !usedIds.has(v.id)
    )

  let usedFallbackTypes = false

  if (
    candidates.length === 0
  ) {
    const fallbackTypes =
      stageTypes.flatMap(
        (t) =>
          fallbackFlowFromStage(t)
      )

    candidates =
      filterStageCandidates(
        venues,
        fallbackTypes,
        now
      ).filter(
        (v) =>
          !usedIds.has(v.id)
      )

    usedFallbackTypes = true
  }

  if (
    candidates.length === 0
  ) {
    return null
  }

  const scored = candidates
    .map((v) => {
      const dist =
        distanceMeters(
          originLat,
          originLon,
          v.lat,
          v.lon
        )

      return {
        venue: v,
        distance: dist,
        score:
          scoreVenue(
            v,
            stageTypes,
            now,
            opts?.theme,
            opts,
            originLat,
            originLon
          ) -
          (usedFallbackTypes
            ? 6
            : 0),
      }
    })
    .sort((a, b) => {
      const scoreDelta =
        b.score - a.score

      if (
        Math.abs(scoreDelta) >
        0.001
      ) {
        return scoreDelta
      }

      return (
        a.distance -
        b.distance
      )
    })

  const selectionPasses = [
    {
      enforceDistinctOpeners: true,
      relaxedDistance: false,
    },
    {
      enforceDistinctOpeners: false,
      relaxedDistance: false,
    },
    {
      enforceDistinctOpeners: false,
      relaxedDistance: true,
    },
  ]

  for (const pass of selectionPasses) {
    for (const entry of scored) {
      const v = entry.venue

      const venueTypes =
        getVenueTypes(v)

      const stage =
        stageTypes[0]

      if (
        STAGE_TYPE_EXCLUSIONS[
          stage
        ]?.some(
          (t) =>
            venueTypes.includes(t)
        )
      ) {
        continue
      }

      if (
        pass.enforceDistinctOpeners &&
        shouldSkipForThemeDistinctness(
          v.id,
          opts
        )
      ) {
        continue
      }

      if (
        entry.distance <
        MIN_VENUE_DISTANCE_METERS
      ) {
        continue
      }

      if (
        !pass.relaxedDistance &&
        entry.distance >
          HARD_INTERSTOP_MAX_METERS
      ) {
        continue
      }

      if (
        stageHasMealIntent(
          stageTypes
        ) &&
        shouldRejectDuplicateMealBucket({
          venue: v,
          now,
          usedMealBuckets,
        })
      ) {
        continue
      }

      const typeKey =
        venueTypes[0] ??
        'unknown'

      if (
        (usedTypes[typeKey] ??
          0) >= 2
      ) {
        continue
      }

      usedTypes[typeKey] =
        (usedTypes[typeKey] ??
          0) + 1

      const mealBucket =
        inferMealBucketFromTypes(
          venueTypes,
          now
        )

      if (mealBucket) {
        usedMealBuckets.add(
          mealBucket
        )
      }

      return v
    }
  }

  return null
}

/* ------------------------------------------------ */
/* Property-only planning helpers                   */
/* ------------------------------------------------ */

function getPropertyMatchedType(
  venue: Venue,
  stageTypes: readonly string[]
): string | null {
  const venueTypes =
    getVenueTypes(venue)

  for (
    const stageType of stageTypes
  ) {
    const normalizedStageType =
      stageType
        .trim()
        .toLowerCase()

    const equivalents =
      PROPERTY_TYPE_EQUIVALENTS[
        normalizedStageType
      ] ??
      [normalizedStageType]

    if (
      equivalents.some(
        (type) =>
          venueTypes.includes(
            type
          )
      )
    ) {
      return normalizedStageType
    }
  }

  return null
}

function getPropertyExperienceRole(
  venue: Venue
): string {
  const types =
    getVenueTypes(venue)

  if (
    hasAnyType(types, [
      'club',
      'nightclub',
      'dance',
      'dance club',
    ])
  ) {
    return 'dance'
  }

  if (
    hasAnyType(types, [
      'live music',
      'music venue',
      'concert hall',
    ])
  ) {
    return 'music'
  }

  if (
    hasAnyType(types, [
      'cocktail',
      'cocktail bar',
      'wine bar',
      'speakeasy',
    ])
  ) {
    return 'cocktails'
  }

  if (
    hasAnyType(types, [
      'bar',
      'pub',
      'taproom',
      'lounge',
      'brewery',
    ])
  ) {
    return 'social-bar'
  }

  if (
    hasAnyType(types, [
      'dinner',
      'restaurant',
      'steakhouse',
      'bistro',
      'lunch',
      'deli',
    ])
  ) {
    return 'meal'
  }

  if (
    hasAnyType(types, [
      'coffee',
      'coffee shop',
      'cafe',
      'café',
      'tea',
      'tea room',
      'bakery',
      'breakfast',
      'brunch',
    ])
  ) {
    return 'refreshment'
  }

  if (
    hasAnyType(types, [
      'gallery',
      'art gallery',
      'museum',
      'art museum',
    ])
  ) {
    return 'culture'
  }

  if (
    hasAnyType(types, [
      'bookstore',
      'bookshop',
      'book shop',
      'boutique',
      'shop',
      'market',
      'lifestyle',
    ])
  ) {
    return 'browse'
  }

  if (
    hasAnyType(types, [
      'park',
      'garden',
      'trail',
    ])
  ) {
    return 'outdoors'
  }

  if (
    hasAnyType(types, [
      'dessert',
      'ice cream',
      'gelato',
    ])
  ) {
    return 'dessert'
  }

  return types[0] ?? 'other'
}

/* ------------------------------------------------ */
/* Property theme eligibility                       */
/* ------------------------------------------------ */

function propertyVenueFitsTheme(
  venue: Venue,
  theme: CrawlTheme,
  stageIndex: number
): boolean {
  const types =
    getVenueTypes(venue)

  /**
   * Existing hard rule:
   *
   * A venue with the exact normalized "bar" type
   * is never eligible for a property Date Night.
   *
   * A distinct "wine bar" or "cocktail bar" type
   * remains eligible unless "bar" is also present.
   */
  if (
    theme === 'dateNight' &&
    types.includes('bar')
  ) {
    return false
  }

  /**
   * Phase 1B refinement:
   *
   * A generic lounge, pub, or taproom does not
   * automatically qualify as a romantic after-dinner
   * destination.
   *
   * Require an explicit contextual signal unless
   * the venue is classified as a wine bar, cocktail
   * destination, or speakeasy.
   *
   * This also prevents a specialty lounge from
   * qualifying solely because it has "lounge" in
   * its venue types.
   */
  if (
    theme === 'dateNight' &&
    stageIndex === 1 &&
    hasAnyType(types, [
      'lounge',
      'pub',
      'taproom',
    ]) &&
    !hasAnyType(types, [
      'wine bar',
      'cocktail',
      'cocktail bar',
      'speakeasy',
    ])
  ) {
    return (
      venueMatchesVibe(venue, [
        'romantic',
        'intimate',
        'moody',
        'sultry',
        'cozy',
      ]) ||
      venueMatchesTags(venue, [
        'wine',
        'cocktail',
        'date night',
        'intimate',
      ])
    )
  }

  return true
}

function propertyVenueMatchesStage(
  venue: Venue,
  stageTypes: readonly string[],
  theme: CrawlTheme,
  stageIndex: number
): boolean {
  if (
    !getPropertyMatchedType(
      venue,
      stageTypes
    )
  ) {
    return false
  }

  return propertyVenueFitsTheme(
    venue,
    theme,
    stageIndex
  )
}

/* ------------------------------------------------ */
/* Property venue scoring — existing                */
/* ------------------------------------------------ */

/**
 * Prioritize theme fidelity, complementary stop
 * roles, and geographic compactness.
 *
 * Intentionally does NOT read venue.energyRamp.
 */

function scorePropertyVenue({
  venue,
  theme,
  stageTypes,
  selectedVenues,
  distanceFromPrevious,
  distanceFromProperty,
  optional,
}: {
  venue: Venue
  theme: CrawlTheme
  stageTypes: readonly string[]
  selectedVenues: Venue[]
  distanceFromPrevious: number
  distanceFromProperty: number
  optional: boolean
}): number {
  const matchedType =
    getPropertyMatchedType(
      venue,
      stageTypes
    )

  if (!matchedType) {
    return -Infinity
  }

  const matchingStageIndex =
    stageTypes.findIndex(
      (type) =>
        type.toLowerCase() ===
        matchedType
    )

  let score =
    24 -
    Math.max(
      0,
      matchingStageIndex
    ) * 1.5

  const signals =
    CRAWL_THEME_SIGNALS[theme]

  if (
    venueMatchesVibe(
      venue,
      signals.vibes
    )
  ) {
    score += 14
  }

  if (
    venueMatchesTags(
      venue,
      signals.tags
    )
  ) {
    score += 10
  }

  if (
    distanceFromPrevious <=
    350
  ) {
    score += 18
  } else if (
    distanceFromPrevious <=
    650
  ) {
    score += 13
  } else if (
    distanceFromPrevious <=
    850
  ) {
    score += 5
  } else {
    score -= 7
  }

  if (
    distanceFromProperty <=
    650
  ) {
    score += 8
  } else if (
    distanceFromProperty >
    1200
  ) {
    score -= 8
  }

  const candidateRole =
    getPropertyExperienceRole(
      venue
    )

  const previousVenue =
    selectedVenues[
      selectedVenues.length - 1
    ]

  if (previousVenue) {
    const previousRole =
      getPropertyExperienceRole(
        previousVenue
      )

    if (
      previousRole ===
      candidateRole
    ) {
      score -= 24
    } else {
      score += 8
    }
  }

  if (
    selectedVenues.some(
      (selectedVenue) =>
        getPropertyExperienceRole(
          selectedVenue
        ) === candidateRole
    )
  ) {
    score -= 16
  }

  if (optional) {
    score -= 5
  }

  return score
}

/* ------------------------------------------------ */
/* Property stage selector — Phase 2 UPDATED        */
/* ------------------------------------------------ */

function selectPropertyVenueForStage({
  venues,
  stageTypes,
  theme,
  stageIndex,
  now,
  propertyLat,
  propertyLon,
  currentLat,
  currentLon,
  totalDistance,
  selectedVenues,
  usedIds,
  opts,
  optional,
}: {
  venues: Venue[]
  stageTypes: readonly string[]
  theme: CrawlTheme
  stageIndex: number

  /**
   * Phase 2:
   *
   * "now" is the projected departure time from
   * the property or the preceding stop, rather
   * than the original page-load time.
   *
   * The parameter name is retained to avoid
   * disrupting the existing internal call chain.
   */
  now: DateTime

  propertyLat: number
  propertyLon: number
  currentLat: number
  currentLon: number
  totalDistance: number
  selectedVenues: Venue[]
  usedIds: Set<string>
  opts: CrawlGenerationOpts
  optional: boolean
}): PropertyStageChoice | null {
  const usedRoles = new Set(
    selectedVenues.map(
      getPropertyExperienceRole
    )
  )

  const candidates = venues
    .filter((venue) => {
      if (
        !venue?.id ||
        usedIds.has(venue.id)
      ) {
        return false
      }

      if (
        !Number.isFinite(
          venue.lat
        ) ||
        !Number.isFinite(
          venue.lon
        )
      ) {
        return false
      }

      if (
        !propertyVenueMatchesStage(
          venue,
          stageTypes,
          theme,
          stageIndex
        )
      ) {
        return false
      }

      /**
       * Phase 2:
       *
       * Operating-hour checks are performed
       * below, after each candidate's travel
       * distance and arrival time are known.
       */

      const role =
        getPropertyExperienceRole(
          venue
        )

      if (
        usedRoles.has(role)
      ) {
        return false
      }

      return true
    })
    .map((venue) => {
      const distance =
        distanceMeters(
          currentLat,
          currentLon,
          venue.lat,
          venue.lon
        )

      const distanceFromProperty =
        distanceMeters(
          propertyLat,
          propertyLon,
          venue.lat,
          venue.lon
        )

      /**
       * Phase 2:
       *
       * Project the arrival from this specific
       * itinerary branch's departure time.
       *
       * Stops with longer legs are checked later
       * than stops close to the preceding venue.
       */
      const arrivalAt =
        now.plus({
          minutes:
            getPropertyWalkingMinutes(
              distance
            ),
        })

      const matchedType =
        getPropertyMatchedType(
          venue,
          stageTypes
        )

      return {
        venue,
        distance,
        distanceFromProperty,
        matchedType,
        arrivalAt,
        score: scorePropertyVenue({
          venue,
          theme,
          stageTypes,
          selectedVenues,
          distanceFromPrevious:
            distance,
          distanceFromProperty,
          optional,
        }),
      }
    })
    .filter((entry) => {
      if (
        !entry.matchedType
      ) {
        return false
      }

      if (
        entry.distanceFromProperty >
        PROPERTY_MAX_DISTANCE_FROM_ORIGIN_METERS
      ) {
        return false
      }

      const maxLegDistance =
        optional
          ? PROPERTY_OPTIONAL_MAX_LEG_METERS
          : stageIndex === 0
            ? PROPERTY_MAX_FIRST_LEG_METERS
            : PROPERTY_MAX_INTERSTOP_METERS

      if (
        entry.distance >
        maxLegDistance
      ) {
        return false
      }

      if (
        stageIndex > 0 &&
        entry.distance <
          PROPERTY_MIN_INTERSTOP_METERS
      ) {
        return false
      }

      if (
        totalDistance +
          entry.distance >
        PROPERTY_MAX_TOTAL_DISTANCE_METERS
      ) {
        return false
      }

      /**
       * Phase 2:
       *
       * A venue must be open at projected arrival
       * and for the expected duration of the stop.
       *
       * Existing absurd-time-mismatch protection
       * now evaluates the arrival rather than the
       * time the property page was opened.
       */
      if (
        !propertyVenueOpenForVisit(
          entry.venue,
          entry.arrivalAt,
          getPropertyStageDwellMinutes(
            theme,
            stageIndex
          )
        )
      ) {
        return false
      }

      if (
        hasAbsurdTimeMismatch(
          entry.venue,
          entry.arrivalAt
        )
      ) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      const scoreDifference =
        b.score - a.score

      if (
        Math.abs(
          scoreDifference
        ) > 0.001
      ) {
        return scoreDifference
      }

      return (
        a.distance -
        b.distance
      )
    })

  if (
    candidates.length === 0
  ) {
    return null
  }

  const distinctCandidate =
    candidates.find(
      (entry) =>
        !shouldSkipForThemeDistinctness(
          entry.venue.id,
          {
            ...opts,
            stageIndex,
          }
        )
    )

  const selected =
    distinctCandidate ??
    candidates[0]

  if (
    !selected ||
    !selected.matchedType
  ) {
    return null
  }

  return {
    venue:
      selected.venue,
    matchedType:
      selected.matchedType,
    distance:
      selected.distance,
    arrivalAt:
      selected.arrivalAt,
  }
}

/* ------------------------------------------------ */
/* Property candidate enumeration — Phase 1B        */
/* ------------------------------------------------ */

/**
 * Enumerate several valid alternatives at a stage.
 *
 * Reuse the EXISTING property-stage selector and all
 * of its constraints rather than introducing a
 * separate matching system.
 *
 * Excluding a chosen venue on each pass reveals the
 * next eligible choice.
 */

function getPropertyStageChoices({
  venues,
  stageTypes,
  theme,
  stageIndex,
  now,
  propertyLat,
  propertyLon,
  currentLat,
  currentLon,
  totalDistance,
  selectedVenues,
  usedIds,
  opts,
  optional,
  limit,
}: {
  venues: Venue[]
  stageTypes: readonly string[]
  theme: CrawlTheme
  stageIndex: number
  now: DateTime
  propertyLat: number
  propertyLon: number
  currentLat: number
  currentLon: number
  totalDistance: number
  selectedVenues: Venue[]
  usedIds: Set<string>
  opts: CrawlGenerationOpts
  optional: boolean
  limit: number
}): PropertyStageChoice[] {
  const choices:
    PropertyStageChoice[] = []

  const excludedIds =
    new Set(usedIds)

  for (
    let index = 0;
    index < limit;
    index++
  ) {
    const choice =
      selectPropertyVenueForStage({
        venues,
        stageTypes,
        theme,
        stageIndex,
        now,
        propertyLat,
        propertyLon,
        currentLat,
        currentLon,
        totalDistance,
        selectedVenues,
        usedIds:
          excludedIds,
        opts,
        optional,
      })

    if (!choice) {
      break
    }

    choices.push(choice)

    excludedIds.add(
      choice.venue.id
    )
  }

  return choices
}

/* ------------------------------------------------ */
/* Complete itinerary scoring — Phase 1B            */
/* ------------------------------------------------ */

/**
 * Evaluate the finished outing, not just its
 * individual venue choices.
 *
 * The existing venue score remains the foundation.
 * These additions favor:
 *
 * - Theme-specific destination quality
 * - Distinct experiential roles
 * - Compact complete sequences
 * - Optional stops that contribute real value
 *
 * No energyRamp is read here.
 */

function scoreCompletePropertyItinerary({
  theme,
  crawl,
  originLat,
  originLon,
}: {
  theme: CrawlTheme
  crawl: CrawlResult
  originLat: number
  originLon: number
}): {
  score: number
  totalDistance: number
} {
  let scoreSum = 0
  let totalDistance = 0

  const selectedVenues:
    Venue[] = []

  let previousLat =
    originLat

  let previousLon =
    originLon

  for (
    let index = 0;
    index <
      crawl.stages.length;
    index++
  ) {
    const stage =
      crawl.stages[index]

    const venue =
      stage.venue

    const distance =
      distanceMeters(
        previousLat,
        previousLon,
        venue.lat,
        venue.lon
      )

    const distanceFromProperty =
      distanceMeters(
        originLat,
        originLon,
        venue.lat,
        venue.lon
      )

    scoreSum +=
      scorePropertyVenue({
        venue,
        theme,
        stageTypes:
          stage.stageTypes,
        selectedVenues,
        distanceFromPrevious:
          distance,
        distanceFromProperty,
        optional:
          index >= 2,
      })

    totalDistance +=
      distance

    selectedVenues.push(
      venue
    )

    previousLat =
      venue.lat

    previousLon =
      venue.lon
  }

  /**
   * Average venue quality instead of blindly
   * rewarding itineraries for having more stops.
   */
  let score =
    scoreSum /
    crawl.stages.length

  const finalVenue =
    crawl.venues[
      crawl.venues.length - 1
    ]

  const finalTypes =
    finalVenue
      ? getVenueTypes(
          finalVenue
        )
      : []

  const secondVenue =
    crawl.venues[1]

  const secondTypes =
    secondVenue
      ? getVenueTypes(
          secondVenue
        )
      : []

  /**
   * Date Night:
   *
   * A strong after-dinner destination should be
   * explicitly wine-, cocktail-, or
   * speakeasy-oriented rather than a generic lounge.
   */
  if (
    theme === 'dateNight'
  ) {
    if (
      hasAnyType(
        secondTypes,
        [
          'wine bar',
          'cocktail',
          'cocktail bar',
          'speakeasy',
        ]
      )
    ) {
      score += 14
    }

    if (
      secondVenue &&
      venueMatchesVibe(
        secondVenue,
        CRAWL_THEME_SIGNALS
          .dateNight.vibes
      )
    ) {
      score += 8
    }
  }

  /**
   * Night Out:
   *
   * Give genuine music, dance, or nightlife
   * destinations additional preference over
   * interchangeable drinking establishments.
   */
  if (
    theme === 'nightOut'
  ) {
    if (
      hasAnyType(
        secondTypes,
        [
          'live music',
          'music venue',
          'club',
          'nightclub',
          'dance',
          'dance club',
        ]
      )
    ) {
      score += 16
    }
  }

  /**
   * Solo Explorer:
   *
   * Favor meaningful cultural discovery
   * over generic retail when available.
   */
  if (
    theme ===
    'soloExplorer'
  ) {
    const firstTypes =
      getVenueTypes(
        crawl.venues[0]
      )

    if (
      hasAnyType(
        firstTypes,
        [
          'gallery',
          'art gallery',
          'museum',
          'art museum',
          'bookstore',
          'bookshop',
        ]
      )
    ) {
      score += 8
    }
  }

  /**
   * Morning Flow:
   *
   * Reward a second stop that offers
   * an outdoor or cultural experience.
   */
  if (
    theme ===
    'morningFlow'
  ) {
    if (
      hasAnyType(
        secondTypes,
        [
          'park',
          'garden',
          'gallery',
          'museum',
          'bookstore',
        ]
      )
    ) {
      score += 6
    }
  }

  /**
   * Optional third stops should be additive.
   *
   * Their existence alone is not sufficient
   * to justify a longer itinerary.
   */
  if (
    crawl.venues.length >
    PROPERTY_MIN_STOPS
  ) {
    const previous =
      crawl.venues[
        crawl.venues.length - 2
      ]

    const finalLeg =
      distanceMeters(
        previous.lat,
        previous.lon,
        finalVenue.lat,
        finalVenue.lon
      )

    const finalRole =
      getPropertyExperienceRole(
        finalVenue
      )

    const precedingRoles =
      crawl.venues
        .slice(0, -1)
        .map(
          getPropertyExperienceRole
        )

    if (
      !precedingRoles.includes(
        finalRole
      ) &&
      finalLeg <= 450
    ) {
      score +=
        PROPERTY_OPTIONAL_STOP_BONUS
    }

    /**
     * A short dessert finish may be pleasant,
     * but dessert never automatically outweighs
     * the quality of the essential two-stop date.
     */
    if (
      theme === 'dateNight' &&
      hasAnyType(
        finalTypes,
        [
          'dessert',
          'gelato',
          'ice cream',
        ]
      ) &&
      finalLeg <= 350
    ) {
      score += 2
    }
  }

  /**
   * Gentle complete-route penalty.
   *
   * Hard distance limits have already
   * been checked during candidate selection.
   */
  score -=
    totalDistance / 220

  return {
    score,
    totalDistance,
  }
}

/* ------------------------------------------------ */
/* Full itinerary candidates — Phase 2 UPDATED      */
/* ------------------------------------------------ */

/**
 * Generate multiple complete, feasible routes
 * for one property theme.
 *
 * Required stages must all be satisfied.
 * Optional stages may be omitted.
 *
 * Every candidate continues to obey:
 *
 * - Property-only venue eligibility
 * - Projected arrival-time operating-hour checks
 * - Hard geographic budgets
 * - Distinct venue IDs inside a crawl
 * - Distinct experience roles
 * - Date Night's exact "bar" exclusion
 */

function generatePropertyItineraryCandidates(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime,
  opts: CrawlGenerationOpts
): PropertyItineraryCandidate[] {
  const theme = opts.theme

  if (
    !theme ||
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLon)
  ) {
    return []
  }

  /**
   * Capture the validated theme with a non-optional
   * type so nested itinerary-generation functions
   * retain the narrowing.
   */
  const propertyTheme: CrawlTheme = theme

  const plan =
    PROPERTY_STAGE_PLANS[propertyTheme]

  /**
   * Phase 2:
   *
   * Keep the supplied time as the reference date,
   * but build this theme around its next appropriate
   * local outing window.
   *
   * Recursion then advances time independently
   * for every possible itinerary.
   */
  const planningStart =
    resolvePropertyPlanningStart(
      now,
      propertyTheme
    )

  const candidates:
    PropertyItineraryCandidate[] = []

  const candidateKeys =
    new Set<string>()

  function recordCandidate(
    selectedVenues: Venue[],
    selectedStages: CrawlStageResult[]
  ) {
    if (
      selectedVenues.length <
      PROPERTY_MIN_STOPS
    ) {
      return
    }

    if (
      selectedVenues.length >
      PROPERTY_MAX_STOPS
    ) {
      return
    }

    const venueIds =
      new Set(
        selectedVenues.map(
          (venue) =>
            venue.id
        )
      )

    if (
      venueIds.size !==
      selectedVenues.length
    ) {
      return
    }

    const key =
      selectedVenues
        .map(
          (venue) =>
            venue.id
        )
        .join('|')

    if (
      candidateKeys.has(key)
    ) {
      return
    }

    const crawl:
      CrawlResult = {
        venues:
          [...selectedVenues],
        stages:
          [...selectedStages],
      }

    const evaluation =
      scoreCompletePropertyItinerary({
        theme: propertyTheme,
        crawl,
        originLat,
        originLon,
      })

    if (
      !Number.isFinite(
        evaluation.score
      )
    ) {
      return
    }

    candidateKeys.add(
      key
    )

    candidates.push({
      theme: propertyTheme,
      crawl,
      score:
        evaluation.score,
      totalDistance:
        evaluation.totalDistance,
      venueIds,
    })
  }

  function exploreStages({
    stageIndex,
    selectedVenues,
    selectedStages,
    usedIds,
    currentLat,
    currentLon,
    totalDistance,
    departureAt,
  }: {
    stageIndex: number
    selectedVenues: Venue[]
    selectedStages: CrawlStageResult[]
    usedIds: Set<string>
    currentLat: number
    currentLon: number
    totalDistance: number

    /**
     * Phase 2:
     *
     * Time at which the guest is ready to walk
     * to the next stop in this specific branch.
     */
    departureAt: DateTime
  }) {
    if (
      stageIndex >=
        plan.length ||
      selectedVenues.length >=
        PROPERTY_MAX_STOPS
    ) {
      recordCandidate(
        selectedVenues,
        selectedStages
      )

      return
    }

    const stage =
      plan[stageIndex]

    /**
     * An optional stage can be skipped.
     * This makes a complete two-stop crawl
     * a real competitor to three-stop versions.
     */
    if (
      !stage.required
    ) {
      exploreStages({
        stageIndex:
          stageIndex + 1,
        selectedVenues,
        selectedStages,
        usedIds,
        currentLat,
        currentLon,
        totalDistance,
        departureAt,
      })
    }

    const limit =
      stageIndex === 0
        ? PROPERTY_FIRST_STAGE_CANDIDATES
        : stage.required
          ? PROPERTY_SECOND_STAGE_CANDIDATES
          : PROPERTY_OPTIONAL_STAGE_CANDIDATES

    const choices =
      getPropertyStageChoices({
        venues,
        stageTypes:
          stage.stageTypes,
        theme: propertyTheme,
        stageIndex,

        /**
         * Phase 2:
         *
         * The property selector now receives the
         * projected departure of this branch.
         */
        now: departureAt,

        propertyLat:
          originLat,
        propertyLon:
          originLon,
        currentLat,
        currentLon,
        totalDistance,
        selectedVenues,
        usedIds,
        opts,
        optional:
          !stage.required,
        limit,
      })

    for (
      const choice of choices
    ) {
      const nextUsedIds =
        new Set(usedIds)

      nextUsedIds.add(
        choice.venue.id
      )

      /**
       * Phase 2:
       *
       * The guest departs the selected venue after
       * the estimated stay. The next leg's walking
       * time will be added by the stage selector.
       */
      const nextDepartureAt =
        choice.arrivalAt.plus({
          minutes:
            getPropertyStageDwellMinutes(
              propertyTheme,
              stageIndex
            ),
        })

      exploreStages({
        stageIndex:
          stageIndex + 1,
        selectedVenues: [
          ...selectedVenues,
          choice.venue,
        ],
        selectedStages: [
          ...selectedStages,
          {
            stageTypes:
              stage.stageTypes,
            venue:
              choice.venue,
            matchedType:
              choice.matchedType,
          },
        ],
        usedIds:
          nextUsedIds,
        currentLat:
          choice.venue.lat,
        currentLon:
          choice.venue.lon,
        totalDistance:
          totalDistance +
          choice.distance,
        departureAt:
          nextDepartureAt,
      })
    }
  }

  exploreStages({
    stageIndex: 0,
    selectedVenues: [],
    selectedStages: [],
    usedIds:
      new Set<string>(),
    currentLat:
      originLat,
    currentLon:
      originLon,
    totalDistance: 0,
    departureAt:
      planningStart,
  })

  candidates.sort(
    (a, b) => {
      const scoreDifference =
        b.score - a.score

      if (
        Math.abs(
          scoreDifference
        ) > 0.001
      ) {
        return scoreDifference
      }

      return (
        a.totalDistance -
        b.totalDistance
      )
    }
  )

  /**
   * Keep strong alternatives from different
   * starting venues.
   *
   * Without this, the top twenty candidates
   * could all share one opening venue, which
   * would reduce cross-theme allocation options.
   */
  const selected:
    PropertyItineraryCandidate[] = []

  const selectedKeys =
    new Set<string>()

  const startsSeen =
    new Set<string>()

  for (
    const candidate of candidates
  ) {
    const firstId =
      candidate.crawl.venues[0]?.id

    if (
      !firstId ||
      startsSeen.has(firstId)
    ) {
      continue
    }

    selected.push(
      candidate
    )

    startsSeen.add(
      firstId
    )

    selectedKeys.add(
      candidate.crawl.venues
        .map(
          (venue) =>
            venue.id
        )
        .join('|')
    )

    if (
      selected.length >=
      Math.floor(
        PROPERTY_MAX_ITINERARY_OPTIONS_PER_THEME /
          2
      )
    ) {
      break
    }
  }

  for (
    const candidate of candidates
  ) {
    if (
      selected.length >=
      PROPERTY_MAX_ITINERARY_OPTIONS_PER_THEME
    ) {
      break
    }

    const key =
      candidate.crawl.venues
        .map(
          (venue) =>
            venue.id
        )
        .join('|')

    if (
      selectedKeys.has(key)
    ) {
      continue
    }

    selected.push(
      candidate
    )

    selectedKeys.add(
      key
    )
  }

  return selected.sort(
    (a, b) => {
      const difference =
        b.score - a.score

      if (
        Math.abs(difference) >
        0.001
      ) {
        return difference
      }

      return (
        a.totalDistance -
        b.totalDistance
      )
    }
  )
}

/* ------------------------------------------------ */
/* Property-only crawl construction — existing      */
/* ------------------------------------------------ */

/**
 * Direct propertyPlanning calls select the
 * strongest complete itinerary.
 *
 * General-purpose generateCrawl() remains unchanged.
 */

function generatePropertyPlannedCrawl(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime,
  opts: CrawlGenerationOpts
): CrawlResult | null {
  const candidates =
    generatePropertyItineraryCandidates(
      venues,
      originLat,
      originLon,
      now,
      opts
    )

  return (
    candidates[0]?.crawl ??
    null
  )
}

/* ------------------------------------------------ */
/* Cross-theme itinerary allocation — Phase 1B      */
/* ------------------------------------------------ */

/**
 * Select the strongest compatible set of crawls
 * across the four themes.
 *
 * Hard rule: a venue ID cannot occur in two
 * selected property crawls.
 *
 * Optimize in this order:
 *
 * 1. Number of complete themes represented
 * 2. Combined itinerary quality
 * 3. Lower total straight-line route distance
 */

function allocatePropertyItineraries(
  optionsByTheme: Map<
    CrawlTheme,
    PropertyItineraryCandidate[]
  >
): PropertyItineraryCandidate[] {
  const themes: CrawlTheme[] = [
    'dateNight',
    'nightOut',
    'morningFlow',
    'soloExplorer',
  ]

  let bestSelection:
    PropertyItineraryCandidate[] = []

  let bestThemeCount =
    -1

  let bestScore =
    -Infinity

  let bestDistance =
    Infinity

  function search({
    index,
    usedIds,
    selected,
    score,
    distance,
  }: {
    index: number
    usedIds: Set<string>
    selected: PropertyItineraryCandidate[]
    score: number
    distance: number
  }) {
    if (
      index >=
      themes.length
    ) {
      const themeCount =
        selected.length

      const isBetter =
        themeCount >
          bestThemeCount ||
        (
          themeCount ===
            bestThemeCount &&
          score >
            bestScore + 0.001
        ) ||
        (
          themeCount ===
            bestThemeCount &&
          Math.abs(
            score -
            bestScore
          ) <= 0.001 &&
          distance <
            bestDistance
        )

      if (
        isBetter
      ) {
        bestThemeCount =
          themeCount

        bestScore =
          score

        bestDistance =
          distance

        bestSelection = [
          ...selected,
        ]
      }

      return
    }

    /**
     * No branch can outperform the best coverage
     * if too few themes remain.
     */
    const themesRemaining =
      themes.length - index

    if (
      selected.length +
        themesRemaining <
      bestThemeCount
    ) {
      return
    }

    const theme =
      themes[index]

    const options =
      optionsByTheme.get(
        theme
      ) ?? []

    for (
      const candidate of options
    ) {
      let conflicts =
        false

      for (
        const id of
        candidate.venueIds
      ) {
        if (
          usedIds.has(id)
        ) {
          conflicts = true
          break
        }
      }

      if (
        conflicts
      ) {
        continue
      }

      const nextUsedIds =
        new Set(usedIds)

      for (
        const id of
        candidate.venueIds
      ) {
        nextUsedIds.add(id)
      }

      search({
        index:
          index + 1,
        usedIds:
          nextUsedIds,
        selected: [
          ...selected,
          candidate,
        ],
        score:
          score +
          candidate.score,
        distance:
          distance +
          candidate.totalDistance,
      })
    }

    /**
     * A theme can be omitted when no compatible
     * complete itinerary exists.
     *
     * Never manufacture a poor or incomplete crawl
     * merely to fill a fourth card.
     */
    search({
      index:
        index + 1,
      usedIds,
      selected,
      score,
      distance,
    })
  }

  search({
    index: 0,
    usedIds:
      new Set<string>(),
    selected: [],
    score: 0,
    distance: 0,
  })

  return bestSelection
}

/* ------------------------------------------------ */
/* Property crawl diagnostics — Phase 2 UPDATED     */
/* ------------------------------------------------ */

/**
 * Observe the existing planning pipeline without
 * changing selection, scores, candidate limits,
 * allocation, or returned results.
 *
 * Counts for essential stages are INDEPENDENT
 * stage-level counts. They do not prove that two
 * venues can form a valid consecutive route.
 *
 * All diagnostics are disabled in production.
 */

function logPropertyCrawlDiagnostics({
  venues,
  originLat,
  originLon,
  now,
  themes,
  optionsByTheme,
  allocated,
}: {
  venues: Venue[]
  originLat: number
  originLon: number
  now: DateTime
  themes: readonly CrawlTheme[]
  optionsByTheme: Map<
    CrawlTheme,
    PropertyItineraryCandidate[]
  >
  allocated: PropertyItineraryCandidate[]
}): void {
  if (
    process.env.NODE_ENV !==
    'development'
  ) {
    return
  }

  const selectedThemes =
    new Set(
      allocated.map(
        (candidate) =>
          candidate.theme
      )
    )

  const allocatedVenueIds =
    new Set(
      allocated.flatMap(
        (candidate) =>
          candidate.crawl.venues.map(
            (venue) => venue.id
          )
      )
    )

  console.groupCollapsed(
    '[PropertyCrawls] Planner diagnostics'
  )

  console.info(
    '[PropertyCrawls] Context',
    {
      evaluationTime:
        now.toISO(),

      /**
       * Phase 2:
       *
       * These are the distinct local departure
       * times used by the property planner.
       */
      plannedDepartures:
        Object.fromEntries(
          themes.map(
            (theme) => [
              theme,
              resolvePropertyPlanningStart(
                now,
                theme
              ).toISO(),
            ]
          )
        ),

      inputVenueCount:
        venues.length,
      selectedThemeCount:
        allocated.length,
      selectedThemes:
        allocated.map(
          (candidate) =>
            candidate.theme
        ),
      candidateLimitPerTheme:
        PROPERTY_MAX_ITINERARY_OPTIONS_PER_THEME,
    }
  )

  console.table(
    themes.map((theme) => {
      const options =
        optionsByTheme.get(
          theme
        ) ?? []

      return {
        theme,
        plannedStart:
          resolvePropertyPlanningStart(
            now,
            theme
          ).toFormat(
            'ccc h:mm a'
          ),
        retainedCandidates:
          options.length,
        distinctFirstStops:
          new Set(
            options.map(
              (candidate) =>
                candidate.crawl.venues[0]
                  ?.id
            )
          ).size,
        distinctSecondStops:
          new Set(
            options.map(
              (candidate) =>
                candidate.crawl.venues[1]
                  ?.id
            )
          ).size,
        selected:
          selectedThemes.has(
            theme
          ),
        bestCandidateScore:
          options.length
            ? Number(
                options[0].score.toFixed(
                  2
                )
              )
            : null,
      }
    })
  )

  for (
    const theme of themes
  ) {
    const options =
      optionsByTheme.get(
        theme
      ) ?? []

    if (
      selectedThemes.has(
        theme
      )
    ) {
      continue
    }

    if (
      options.length > 0
    ) {
      const conflictingOptions =
        options.filter(
          (candidate) =>
            [...candidate.venueIds].some(
              (id) =>
                allocatedVenueIds.has(
                  id
                )
            )
        )

      console.warn(
        `[PropertyCrawls] ${theme}: candidates exist but theme was not allocated`,
        {
          retainedCandidates:
            options.length,
          candidatesOverlappingSelectedCrawls:
            conflictingOptions.length,
          candidatesNotOverlappingSelectedCrawls:
            options.length -
            conflictingOptions.length,
          note:
            'Overlap is measured against the final allocation. It does not by itself prove that a different four-theme allocation exists.',
          topCandidateStops:
            options[0]?.crawl.venues.map(
              (venue) =>
                venue.name
            ),
        }
      )

      continue
    }

    /**
     * No complete candidate survived generation.
     *
     * Inspect each required stage independently
     * to identify likely eligibility bottlenecks.
     *
     * Phase 2:
     *
     * Stage-level screening uses the theme's planned
     * departure and an individually estimated walk
     * from the property. These counts remain
     * independent diagnostics, not route validation.
     */
    const planningStart =
      resolvePropertyPlanningStart(
        now,
        theme
      )

    const requiredStages =
      PROPERTY_STAGE_PLANS[
        theme
      ]
        .map(
          (stage, index) => ({
            ...stage,
            index,
          })
        )
        .filter(
          (stage) =>
            stage.required
        )

    const stageDiagnostics =
      requiredStages.map(
        (stage) => {
          const matchedByType =
            venues.filter(
              (venue) =>
                Boolean(
                  getPropertyMatchedType(
                    venue,
                    stage.stageTypes
                  )
                )
            )

          const eligibleForTheme =
            matchedByType.filter(
              (venue) =>
                propertyVenueFitsTheme(
                  venue,
                  theme,
                  stage.index
                )
            )

          const validCoordinates =
            eligibleForTheme.filter(
              (venue) =>
                Number.isFinite(
                  venue.lat
                ) &&
                Number.isFinite(
                  venue.lon
                )
            )

          const withEstimatedArrival =
            validCoordinates.map(
              (venue) => {
                const distance =
                  distanceMeters(
                    originLat,
                    originLon,
                    venue.lat,
                    venue.lon
                  )

                return {
                  venue,
                  distance,
                  arrivalAt:
                    planningStart.plus({
                      minutes:
                        getPropertyWalkingMinutes(
                          distance
                        ),
                    }),
                }
              }
            )

          const openForEstimatedVisit =
            withEstimatedArrival.filter(
              (entry) =>
                propertyVenueOpenForVisit(
                  entry.venue,
                  entry.arrivalAt,
                  getPropertyStageDwellMinutes(
                    theme,
                    stage.index
                  )
                )
            )

          const timePlausible =
            openForEstimatedVisit.filter(
              (entry) =>
                !hasAbsurdTimeMismatch(
                  entry.venue,
                  entry.arrivalAt
                )
            )

          const withinPropertyRadius =
            timePlausible.filter(
              (entry) =>
                entry.distance <=
                PROPERTY_MAX_DISTANCE_FROM_ORIGIN_METERS
            )

          const feasibleFirstLeg =
            withinPropertyRadius.filter(
              (entry) =>
                entry.distance <=
                PROPERTY_MAX_FIRST_LEG_METERS
            )

          return {
            stage:
              stage.index + 1,
            stageTypes:
              stage.stageTypes.join(
                ', '
              ),
            typeMatches:
              matchedByType.length,
            themeEligible:
              eligibleForTheme.length,
            validCoordinates:
              validCoordinates.length,
            openForEstimatedVisit:
              openForEstimatedVisit.length,
            plausibleAtArrival:
              timePlausible.length,
            withinPropertyRadius:
              withinPropertyRadius.length,
            withinFirstLegBudget:
              feasibleFirstLeg.length,
          }
        }
      )

    console.warn(
      `[PropertyCrawls] ${theme}: zero retained complete candidates`,
      {
        plannedStart:
          planningStart.toISO(),
        explanation:
          'Stage counts are independent, with estimated direct departures from the property. They are not actual second-stop arrival times. Missing candidates may also result from interstop distance, accumulated travel and dwell time, total route budget, duplicate venue IDs, duplicate experience roles, or bounded enumeration.',
        requiredStageDiagnostics:
          stageDiagnostics,
      }
    )

    console.table(
      stageDiagnostics
    )
  }

  console.info(
    '[PropertyCrawls] Final allocation',
    allocated.map(
      (candidate) => {
        /**
         * Phase 2:
         *
         * Reconstruct approximate selected stop
         * times for observability only.
         *
         * This does not alter candidate selection
         * or the returned CrawlResult shape.
         */
        let departureAt =
          resolvePropertyPlanningStart(
            now,
            candidate.theme
          )

        let previousLat =
          originLat

        let previousLon =
          originLon

        const scheduledStops =
          candidate.crawl.venues.map(
            (venue, index) => {
              const distance =
                distanceMeters(
                  previousLat,
                  previousLon,
                  venue.lat,
                  venue.lon
                )

              const arrivalAt =
                departureAt.plus({
                  minutes:
                    getPropertyWalkingMinutes(
                      distance
                    ),
                })

              departureAt =
                arrivalAt.plus({
                  minutes:
                    getPropertyStageDwellMinutes(
                      candidate.theme,
                      index
                    ),
                })

              previousLat =
                venue.lat

              previousLon =
                venue.lon

              return {
                venue:
                  venue.name,
                estimatedArrival:
                  arrivalAt.toFormat(
                    'ccc h:mm a'
                  ),
                estimatedDeparture:
                  departureAt.toFormat(
                    'ccc h:mm a'
                  ),
              }
            }
          )

        return {
          theme:
            candidate.theme,
          score:
            Number(
              candidate.score.toFixed(
                2
              )
            ),
          stops:
            candidate.crawl.venues.map(
              (venue) =>
                venue.name
            ),
          scheduledStops,
        }
      }
    )
  )

  console.groupEnd()
}

/* ------------------------------------------------ */
/* Stage Plan Resolver — original                   */
/* ------------------------------------------------ */

function resolveStagePlan(
  now: DateTime,
  opts: {
    durationHours?: number
    latestEndHour?: number
    theme?: CrawlTheme
  }
) {
  if (
    opts?.theme &&
    THEME_STAGE_FLOWS[
      opts.theme
    ]
  ) {
    return THEME_STAGE_FLOWS[
      opts.theme
    ]
  }

  const sequenced =
    sequencedStagesForNow(
      now.toJSDate(),
      opts
    )

  if (
    sequenced?.length
  ) {
    return sequenced
  }

  return DEFAULT_DAY_TRAJECTORY
}

/* ------------------------------------------------ */
/* Main Crawl Generator                             */
/* ------------------------------------------------ */

export function generateCrawl(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime,
  opts: CrawlGenerationOpts = {}
): CrawlResult | null {
  /**
   * Property-only planning path.
   *
   * All existing non-property calls continue through
   * the original implementation below unchanged.
   */
  if (
    opts.propertyPlanning &&
    opts.theme
  ) {
    return generatePropertyPlannedCrawl(
      venues,
      originLat,
      originLon,
      now,
      opts
    )
  }

  const stagePlan =
    resolveStagePlan(
      now,
      opts
    ).slice(
      0,
      MAX_STAGES
    )

  const usedIds =
    new Set<string>()

  const usedTypes:
    Record<string, number> = {}

  const usedMealBuckets =
    new Set<MealBucket>()

  const stages:
    CrawlStageResult[] = []

  const selectedVenues:
    Venue[] = []

  let currentLat =
    originLat

  let currentLon =
    originLon

  let previousVenue:
    Venue | null = null

  for (
    let stageIndex = 0;
    stageIndex <
      stagePlan.length;
    stageIndex++
  ) {
    const stageTypes =
      stagePlan[stageIndex]

    const venue =
      selectVenueForStage(
        venues,
        stageTypes,
        usedIds,
        usedTypes,
        usedMealBuckets,
        now,
        currentLat,
        currentLon,
        {
          ...opts,
          stageIndex,
          previousVenue,
        }
      )

    if (
      !venue
    ) {
      continue
    }

    usedIds.add(
      venue.id
    )

    const previousMatchedTypes =
      stages
        .map(
          (stage) =>
            stage.matchedType
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )

    const matchedType =
      resolveContextualMatchedType({
        venue,
        stageTypes,
        previousMatchedTypes,
      })

    stages.push({
      stageTypes,
      venue,
      matchedType,
    })

    selectedVenues.push(
      venue
    )

    currentLat =
      venue.lat

    currentLon =
      venue.lon

    previousVenue =
      venue
  }

  if (
    selectedVenues.length <
    1
  ) {
    return null
  }

  return {
    venues:
      selectedVenues,
    stages,
  }
}

/* ------------------------------------------------ */
/* Multi Crawl Generator — Phase 1B                 */
/* ------------------------------------------------ */

export function generatePropertyCrawls(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime
): ThemedCrawlResult[] {
  const themes: CrawlTheme[] = [
    'dateNight',
    'nightOut',
    'morningFlow',
    'soloExplorer',
  ]

  /**
   * Generate a bounded set of complete itinerary
   * alternatives for EACH theme using the original
   * full property venue pool.
   *
   * No theme preemptively consumes venues.
   */
  const optionsByTheme =
    new Map<
      CrawlTheme,
      PropertyItineraryCandidate[]
    >()

  for (
    const theme of themes
  ) {
    const crawlOpts:
      CrawlGenerationOpts = {
        theme,
        propertyPlanning: true,
      }

    const candidates =
      generatePropertyItineraryCandidates(
        venues,
        originLat,
        originLon,
        now,
        crawlOpts
      )

    optionsByTheme.set(
      theme,
      candidates
    )
  }

  /**
   * Choose the best compatible combination.
   *
   * All selected crawls have:
   *
   * - At least two essential stops
   * - Distinct internal venue IDs
   * - No venue IDs shared with other crawls
   * - Existing geographic constraints
   * - Projected arrival-time checks
   * - The Date Night exact "bar" exclusion
   *
   * No energyRamp is used.
   */
  const allocated =
    allocatePropertyItineraries(
      optionsByTheme
    )

  /**
   * Development-only diagnostics.
   *
   * Runs after allocation and does not alter
   * candidate pools, venue eligibility, the
   * selected crawls, or their display order.
   */
  if (
    process.env.NODE_ENV ===
    'development'
  ) {
    logPropertyCrawlDiagnostics({
      venues,
      originLat,
      originLon,
      now,
      themes,
      optionsByTheme,
      allocated,
    })
  }

  const crawls:
    ThemedCrawlResult[] =
      allocated.map(
        (candidate) => ({
          theme:
            candidate.theme,
          crawl:
            candidate.crawl,
        })
      )

  /**
   * Preserve the existing time-context sorting
   * of the finished property crawl cards.
   */
  return crawls.sort(
    (a, b) => {
      const aScore =
        scoreThemeTimeFit(
          a.theme,
          now
        )

      const bScore =
        scoreThemeTimeFit(
          b.theme,
          now
        )

      return (
        bScore -
        aScore
      )
    }
  )
}

export {}
