
// lib/routes/experienceRoles.ts

import { DateTime } from 'luxon'

import type {
  RouteStage,
  RouteStageId,
} from './routeStages'

/**
 * RoamCurated — Contextual Experience Roles
 *
 * A venue's type designations describe its capabilities.
 * An experience role describes what the guest is expected
 * to do during one specific visit.
 *
 * This module:
 * - Preserves all existing venue classifications.
 * - Supports venues with multiple overlapping types.
 * - Infers one primary visit role from venue, time and stage.
 * - Uses deterministic, explainable classification.
 * - Exposes role metadata for scheduling and constraints.
 * - Does not perform queries or mutate application state.
 *
 * This module deliberately does NOT enforce itinerary
 * transitions. That belongs in contextualConstraints.ts.
 */

export type ExperienceRole =
  | 'breakfast_brunch'
  | 'lunch'
  | 'dinner'
  | 'coffee_tea'
  | 'bakery_light_bite'
  | 'dessert'
  | 'drinks'
  | 'culture'
  | 'discovery'
  | 'outdoors'
  | 'wellness'
  | 'entertainment'
  | 'unknown'

export type ExperienceFamily =
  | 'substantial_meal'
  | 'light_food'
  | 'drinks'
  | 'culture'
  | 'discovery'
  | 'outdoors'
  | 'wellness'
  | 'entertainment'
  | 'unknown'

export type ExperienceConfidence =
  | 'high'
  | 'medium'
  | 'low'

export type ExperienceVenue = {
  id?: string | null
  name?: string | null

  type?: unknown
  types?: unknown
  venue_type?: unknown
  venue_types?: unknown
  category?: unknown
  categories?: unknown

  tags?: unknown
  vibe?: unknown

  timeCategory?: unknown
  time_category?: unknown
  dayParts?: unknown
}

export type ExperienceRoleDefinition = {
  role: ExperienceRole
  family: ExperienceFamily
  label: string
  shortLabel: string
  description: string

  /**
   * Suggested duration for this experience.
   * These are planning defaults, not venue-specific facts.
   */
  defaultDwellMinutes: number

  /**
   * General local-hour window.
   * A window that ends before it starts crosses midnight.
   */
  preferredStartHour: number
  preferredEndHour: number

  /**
   * Existing Roam route stages compatible with this role.
   */
  stageIds: readonly RouteStageId[]

  /**
   * Whether the role represents a substantial meal.
   */
  isSubstantialMeal: boolean
}

export type ExperienceRoleCandidate = {
  role: ExperienceRole
  family: ExperienceFamily
  score: number
  matchedTypes: string[]
  timeCompatible: boolean
  stageCompatible: boolean
}

export type ExperienceRoleResolution = {
  role: ExperienceRole
  family: ExperienceFamily
  label: string
  confidence: ExperienceConfidence

  /**
   * All supported roles identified from venue metadata.
   * These are capabilities, not visits already scheduled.
   */
  supportedRoles: ExperienceRole[]

  /**
   * Normalized original venue classifications.
   */
  normalizedTypes: string[]

  matchedTypes: string[]

  localHour: number | null
  stageId: RouteStageId | null

  suggestedDwellMinutes: number
  isSubstantialMeal: boolean

  /**
   * Explainability for debugging and future route QA.
   */
  reason: string
  alternatives: ExperienceRoleCandidate[]
}

export type ResolveExperienceRoleParams = {
  venue: ExperienceVenue

  /**
   * Expected arrival at this particular venue.
   */
  arrivalAt?: Date | string | null

  /**
   * IANA timezone, e.g. America/New_York.
   * Prefer passing the city timezone explicitly.
   */
  timezone?: string | null

  /**
   * Existing planned route stage.
   */
  stage?: RouteStage | null
  stageId?: RouteStageId | null

  /**
   * Explicit guest intent, when supported by the venue.
   * Never forces an unsupported capability onto a venue.
   */
  intendedRole?: ExperienceRole | null
}

type RoleMatcher = {
  strongTypes: readonly string[]
  supportingTypes?: readonly string[]
}

const ROLE_DEFINITIONS: Record<
  ExperienceRole,
  ExperienceRoleDefinition
> = {
  breakfast_brunch: {
    role: 'breakfast_brunch',
    family: 'substantial_meal',
    label: 'Breakfast / Brunch',
    shortLabel: 'Brunch',
    description: 'A substantial morning or late-morning meal.',
    defaultDwellMinutes: 75,
    preferredStartHour: 7,
    preferredEndHour: 14,
    stageIds: ['breakfast_brunch'],
    isSubstantialMeal: true,
  },

  lunch: {
    role: 'lunch',
    family: 'substantial_meal',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'A substantial midday meal.',
    defaultDwellMinutes: 75,
    preferredStartHour: 11,
    preferredEndHour: 16,
    stageIds: ['lunch'],
    isSubstantialMeal: true,
  },

  dinner: {
    role: 'dinner',
    family: 'substantial_meal',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'A substantial evening meal.',
    defaultDwellMinutes: 105,
    preferredStartHour: 17,
    preferredEndHour: 23,
    stageIds: ['dinner'],
    isSubstantialMeal: true,
  },

  coffee_tea: {
    role: 'coffee_tea',
    family: 'drinks',
    label: 'Coffee / Tea',
    shortLabel: 'Coffee',
    description: 'Coffee, tea, matcha or a relaxed café visit.',
    defaultDwellMinutes: 40,
    preferredStartHour: 6,
    preferredEndHour: 19,
    stageIds: ['early_coffee'],
    isSubstantialMeal: false,
  },

  bakery_light_bite: {
    role: 'bakery_light_bite',
    family: 'light_food',
    label: 'Bakery / Light Bite',
    shortLabel: 'Bakery',
    description: 'A pastry, bakery visit or small bite.',
    defaultDwellMinutes: 30,
    preferredStartHour: 7,
    preferredEndHour: 19,
    stageIds: ['early_coffee', 'breakfast_brunch'],
    isSubstantialMeal: false,
  },

  dessert: {
    role: 'dessert',
    family: 'light_food',
    label: 'Dessert',
    shortLabel: 'Dessert',
    description: 'A sweet stop without another full meal.',
    defaultDwellMinutes: 35,
    preferredStartHour: 11,
    preferredEndHour: 1,
    stageIds: [
      'midday_lifestyle',
      'afternoon_explore',
      'early_evening',
      'night_out',
    ],
    isSubstantialMeal: false,
  },

  drinks: {
    role: 'drinks',
    family: 'drinks',
    label: 'Cocktails / Drinks',
    shortLabel: 'Drinks',
    description: 'Happy hour, cocktails, wine or social drinks.',
    defaultDwellMinutes: 65,
    preferredStartHour: 15,
    preferredEndHour: 2,
    stageIds: ['early_evening', 'night_out'],
    isSubstantialMeal: false,
  },

  culture: {
    role: 'culture',
    family: 'culture',
    label: 'Culture',
    shortLabel: 'Culture',
    description: 'A gallery, museum, bookshop or cultural visit.',
    defaultDwellMinutes: 60,
    preferredStartHour: 9,
    preferredEndHour: 21,
    stageIds: ['morning_culture', 'afternoon_explore'],
    isSubstantialMeal: false,
  },

  discovery: {
    role: 'discovery',
    family: 'discovery',
    label: 'Lifestyle / Discovery',
    shortLabel: 'Discovery',
    description: 'Shopping, design, markets or local discovery.',
    defaultDwellMinutes: 50,
    preferredStartHour: 9,
    preferredEndHour: 21,
    stageIds: ['midday_lifestyle', 'afternoon_explore'],
    isSubstantialMeal: false,
  },

  outdoors: {
    role: 'outdoors',
    family: 'outdoors',
    label: 'Outdoor Discovery',
    shortLabel: 'Outdoors',
    description: 'A park, garden, nature or scenic walk.',
    defaultDwellMinutes: 45,
    preferredStartHour: 6,
    preferredEndHour: 20,
    stageIds: [
      'morning_movement',
      'morning_culture',
      'afternoon_explore',
    ],
    isSubstantialMeal: false,
  },

  wellness: {
    role: 'wellness',
    family: 'wellness',
    label: 'Wellness / Movement',
    shortLabel: 'Wellness',
    description: 'Fitness, wellness, yoga, pilates or spa.',
    defaultDwellMinutes: 75,
    preferredStartHour: 6,
    preferredEndHour: 21,
    stageIds: ['morning_movement'],
    isSubstantialMeal: false,
  },

  entertainment: {
    role: 'entertainment',
    family: 'entertainment',
    label: 'Entertainment',
    shortLabel: 'Entertainment',
    description: 'Music, performances, comedy or nightlife.',
    defaultDwellMinutes: 105,
    preferredStartHour: 16,
    preferredEndHour: 3,
    stageIds: [
      'morning_culture',
      'afternoon_explore',
      'night_out',
    ],
    isSubstantialMeal: false,
  },

  unknown: {
    role: 'unknown',
    family: 'unknown',
    label: 'Local Experience',
    shortLabel: 'Explore',
    description: 'An experience whose primary role is unknown.',
    defaultDwellMinutes: 45,
    preferredStartHour: 0,
    preferredEndHour: 0,
    stageIds: [],
    isSubstantialMeal: false,
  },
}

/**
 * Strong types are explicit evidence of a venue capability.
 *
 * Supporting types are weaker and should not, by themselves,
 * override a more specific explicit classification.
 *
 * The mapping uses the existing Roam venue taxonomy.
 */

const ROLE_MATCHERS: Record<
  Exclude<ExperienceRole, 'unknown'>,
  RoleMatcher
> = {
  breakfast_brunch: {
    strongTypes: ['breakfast', 'brunch'],
  },

  lunch: {
    strongTypes: ['lunch'],
    supportingTypes: ['restaurant', 'bistro', 'bistrot'],
  },

  dinner: {
    strongTypes: ['dinner'],
    supportingTypes: ['restaurant', 'bistro', 'bistrot'],
  },

  coffee_tea: {
    strongTypes: [
      'coffee',
      'cafe',
      'tea',
      'afternoon_tea',
      'juice_bar',
      'smoothie',
    ],
  },

  bakery_light_bite: {
    strongTypes: [
      'bakery',
      'pastry',
      'pastries',
      'snack',
      'sandwich',
    ],
  },

  dessert: {
    strongTypes: [
      'dessert',
      'ice_cream',
      'gelato',
      'patisserie',
    ],
  },

  drinks: {
    strongTypes: [
      'cocktail',
      'bar',
      'wine_bar',
      'lounge',
      'speakeasy',
      'happy_hour',
      'rooftop',
      'pub',
      'brewery',
    ],
  },

  culture: {
    strongTypes: [
      'gallery',
      'museum',
      'bookstore',
      'library',
      'art',
      'cultural',
    ],
  },

  discovery: {
    strongTypes: [
      'lifestyle',
      'market',
      'showroom',
      'random_gem',
      'workspace',
      'shopping',
      'design',
      'retail',
    ],
  },

  outdoors: {
    strongTypes: [
      'park',
      'garden',
      'nature',
      'walk',
      'outdoors',
      'scenic',
    ],
  },

  wellness: {
    strongTypes: [
      'fitness',
      'wellness',
      'yoga',
      'pilates',
      'spa',
      'gym',
    ],
  },

  entertainment: {
    strongTypes: [
      'music',
      'live_music',
      'show',
      'comedy',
      'theater',
      'cinema',
      'club',
      'dj',
      'nightlife',
      'event_venue',
      'event_space',
      'stadium',
    ],
  },
}

const ROLE_ORDER: readonly Exclude<
  ExperienceRole,
  'unknown'
>[] = [
  'coffee_tea',
  'bakery_light_bite',
  'breakfast_brunch',
  'lunch',
  'dinner',
  'dessert',
  'drinks',
  'culture',
  'discovery',
  'outdoors',
  'wellness',
  'entertainment',
]

const TYPE_ALIASES: Record<string, string> = {
  cafe: 'cafe',
  café: 'cafe',
  cafes: 'cafe',
  coffee_shop: 'coffee',

  cocktails: 'cocktail',
  cocktail_bar: 'cocktail',
  winebar: 'wine_bar',
  wine_bar: 'wine_bar',
  happyhour: 'happy_hour',
  sports_bar: 'bar',

  bookshop: 'bookstore',
  book_store: 'bookstore',

  theatre: 'theater',
  live_music: 'live_music',
  live_music_venue: 'live_music',

  bistro: 'bistro',
  bistrot: 'bistro',

  late_night: 'nightlife',
  nightclub: 'club',

  juicebar: 'juice_bar',
  icecream: 'ice_cream',
}

/**
 * Get metadata for a resolved role.
 *
 * Returned definitions are internal readonly configuration;
 * callers should not mutate their properties or stageIds.
 */
export function getExperienceRoleDefinition(
  role: ExperienceRole
): ExperienceRoleDefinition {
  return ROLE_DEFINITIONS[role]
}

/**
 * Normalize a single raw venue designation.
 *
 * E.g.:
 * "Café"       -> "cafe"
 * "Happy Hour" -> "happy_hour"
 * "Cocktails"  -> "cocktail"
 */
export function normalizeExperienceType(
  value: string
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return TYPE_ALIASES[normalized] ?? normalized
}

/**
 * Extract classifications from the venue's primary type
 * fields, including arrays, strings and JSON array strings.
 *
 * Tags and vibes are deliberately excluded from primary
 * capability detection; they are descriptive metadata
 * and should not automatically authorize a visit role.
 */
export function getNormalizedExperienceTypes(
  venue: ExperienceVenue
): string[] {
  const values = [
    ...extractTypeValues(venue.type),
    ...extractTypeValues(venue.types),
    ...extractTypeValues(venue.venue_type),
    ...extractTypeValues(venue.venue_types),
    ...extractTypeValues(venue.category),
    ...extractTypeValues(venue.categories),
  ]

  return Array.from(
    new Set(
      values
        .map(normalizeExperienceType)
        .filter(Boolean)
    )
  )
}

/**
 * Return every supported role without assuming which
 * one the guest will use during this visit.
 *
 * A restaurant tagged "lunch" and "dinner" supports both.
 * A restaurant tagged "cocktail" may also support drinks.
 */
export function getVenueExperienceCapabilities(
  venue: ExperienceVenue
): ExperienceRole[] {
  const types = new Set(
    getNormalizedExperienceTypes(venue)
  )

  return ROLE_ORDER.filter((role) => {
    const matcher = ROLE_MATCHERS[role]

    if (
      matcher.strongTypes.some((type) =>
        types.has(type)
      )
    ) {
      return true
    }

    // Generic restaurant tags can support a meal role
    // when no explicit meal service is recorded.
    //
    // This remains a fallback capability, not proof
    // that the venue serves every meal period.
    const hasExplicitMealType =
      types.has('breakfast') ||
      types.has('brunch') ||
      types.has('lunch') ||
      types.has('dinner')

    if (
      !hasExplicitMealType &&
      (role === 'lunch' || role === 'dinner')
    ) {
      return Boolean(
        matcher.supportingTypes?.some((type) =>
          types.has(type)
        )
      )
    }

    return false
  })
}

/**
 * Resolve one primary experience role for a specific visit.
 *
 * Priority:
 * 1. Explicit guest intent, when supported.
 * 2. Explicit venue capability.
 * 3. Matching route stage.
 * 4. Local arrival-time suitability.
 * 5. Deterministic fallback ordering.
 *
 * This function does not enforce adjacent-stop constraints
 * and does not infer venue-specific opening hours.
 */
export function resolveExperienceRole({
  venue,
  arrivalAt = null,
  timezone = null,
  stage = null,
  stageId = null,
  intendedRole = null,
}: ResolveExperienceRoleParams): ExperienceRoleResolution {
  const normalizedTypes =
    getNormalizedExperienceTypes(venue)

  const typeSet = new Set(normalizedTypes)

  const supportedRoles =
    getVenueExperienceCapabilities(venue)

  const resolvedStageId =
    stage?.id ?? stageId ?? null

  const localHour = resolveLocalHour(
    arrivalAt,
    timezone
  )

  if (supportedRoles.length === 0) {
    return buildUnknownResolution({
      normalizedTypes,
      localHour,
      stageId: resolvedStageId,
    })
  }

  if (
    intendedRole &&
    intendedRole !== 'unknown' &&
    supportedRoles.includes(intendedRole)
  ) {
    const definition =
      ROLE_DEFINITIONS[intendedRole]

    return {
      role: intendedRole,
      family: definition.family,
      label: definition.label,
      confidence: 'high',
      supportedRoles,
      normalizedTypes,
      matchedTypes: getMatchedTypes(
        intendedRole,
        typeSet
      ),
      localHour,
      stageId: resolvedStageId,
      suggestedDwellMinutes:
        definition.defaultDwellMinutes,
      isSubstantialMeal:
        definition.isSubstantialMeal,
      reason:
        `Explicit visit intent selected ${definition.label}, ` +
        'which the venue supports.',
      alternatives: [],
    }
  }

  const candidates: ExperienceRoleCandidate[] =
    supportedRoles.map((role) => {
      const definition =
        ROLE_DEFINITIONS[role]

      const matchedTypes =
        getMatchedTypes(role, typeSet)

      const hasStrongTypeMatch =
        ROLE_MATCHERS[
          role as Exclude<ExperienceRole, 'unknown'>
        ].strongTypes.some((type) =>
          typeSet.has(type)
        )

      const timeCompatible =
        localHour === null ||
        isHourInWindow(
          localHour,
          definition.preferredStartHour,
          definition.preferredEndHour
        )

      const stageCompatible =
        resolvedStageId !== null &&
        definition.stageIds.includes(resolvedStageId)

      let score = hasStrongTypeMatch ? 60 : 20

      // Direct alignment with the assigned route stage
      // should have substantial influence, especially
      // for multi-role venues such as 5Church.
      if (stageCompatible) {
        score += 45
      }

      if (localHour !== null) {
        score += timeCompatible ? 20 : -35

        score += getRoleTimeAffinity(
          role,
          localHour
        )
      }

      // Multiple explicit matching types provide modest
      // extra confidence, without allowing excessively
      // tagged venues to dominate classification.
      if (hasStrongTypeMatch) {
        score += Math.min(
          8,
          Math.max(0, matchedTypes.length - 1) * 4
        )
      }

      return {
        role,
        family: definition.family,
        score,
        matchedTypes,
        timeCompatible,
        stageCompatible,
      }
    })

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    return (
      ROLE_ORDER.indexOf(
        a.role as Exclude<ExperienceRole, 'unknown'>
      ) -
      ROLE_ORDER.indexOf(
        b.role as Exclude<ExperienceRole, 'unknown'>
      )
    )
  })

  const winner = candidates[0]
  const definition =
    ROLE_DEFINITIONS[winner.role]

  const secondScore =
    candidates[1]?.score ?? null

  const margin =
    secondScore === null
      ? Infinity
      : winner.score - secondScore

  const confidence: ExperienceConfidence =
    winner.matchedTypes.some((type) =>
      ROLE_MATCHERS[
        winner.role as Exclude<
          ExperienceRole,
          'unknown'
        >
      ].strongTypes.includes(type)
    ) &&
    winner.timeCompatible &&
    (
      winner.stageCompatible ||
      margin >= 20
    )
      ? 'high'
      : margin >= 10
        ? 'medium'
        : 'low'

  const reasons: string[] = [
    `Venue supports ${definition.label}.`,
  ]

  if (winner.stageCompatible) {
    reasons.push(
      'The assigned route stage supports this experience.'
    )
  }

  if (
    localHour !== null &&
    winner.timeCompatible
  ) {
    reasons.push(
      `The visit fits the local arrival hour (${localHour}:00).`
    )
  }

  if (
    supportedRoles.length > 1
  ) {
    reasons.push(
      `Selected from ${supportedRoles.length} supported venue roles.`
    )
  }

  return {
    role: winner.role,
    family: definition.family,
    label: definition.label,
    confidence,
    supportedRoles,
    normalizedTypes,
    matchedTypes: winner.matchedTypes,
    localHour,
    stageId: resolvedStageId,
    suggestedDwellMinutes:
      definition.defaultDwellMinutes,
    isSubstantialMeal:
      definition.isSubstantialMeal,
    reason: reasons.join(' '),
    alternatives: candidates.slice(1),
  }
}

/**
 * Check whether a role is a substantial meal.
 *
 * This provides the contextual-constraints layer with
 * a stable signal for preventing duplicate major meals.
 */
export function isSubstantialMealRole(
  role: ExperienceRole
): boolean {
  return ROLE_DEFINITIONS[role].isSubstantialMeal
}

/**
 * Check whether two resolved roles belong to the same
 * broad experience family.
 *
 * This is descriptive, not an automatic hard rejection.
 * For example, coffee and cocktails both fall under
 * "drinks" but should not always be treated identically.
 */
export function isSameExperienceFamily(
  first: ExperienceRole,
  second: ExperienceRole
): boolean {
  if (
    first === 'unknown' ||
    second === 'unknown'
  ) {
    return false
  }

  return (
    ROLE_DEFINITIONS[first].family ===
    ROLE_DEFINITIONS[second].family
  )
}

/**
 * Return whether a role's preferred time window contains
 * the specified local hour.
 *
 * This does not determine whether a specific venue is open.
 */
export function isExperienceRoleTimeCompatible(
  role: ExperienceRole,
  localHour: number
): boolean {
  if (
    role === 'unknown' ||
    !Number.isFinite(localHour)
  ) {
    return false
  }

  const definition =
    ROLE_DEFINITIONS[role]

  return isHourInWindow(
    localHour,
    definition.preferredStartHour,
    definition.preferredEndHour
  )
}

function getMatchedTypes(
  role: ExperienceRole,
  types: Set<string>
): string[] {
  if (role === 'unknown') {
    return []
  }

  const matcher = ROLE_MATCHERS[role]

  return [
    ...matcher.strongTypes,
    ...(matcher.supportingTypes ?? []),
  ].filter((type) => types.has(type))
}

function buildUnknownResolution({
  normalizedTypes,
  localHour,
  stageId,
}: {
  normalizedTypes: string[]
  localHour: number | null
  stageId: RouteStageId | null
}): ExperienceRoleResolution {
  const definition =
    ROLE_DEFINITIONS.unknown

  return {
    role: 'unknown',
    family: 'unknown',
    label: definition.label,
    confidence: 'low',
    supportedRoles: [],
    normalizedTypes,
    matchedTypes: [],
    localHour,
    stageId,
    suggestedDwellMinutes:
      definition.defaultDwellMinutes,
    isSubstantialMeal: false,
    reason:
      'No recognized experience capability was found ' +
      'in the venue classification fields.',
    alternatives: [],
  }
}

function resolveLocalHour(
  arrivalAt: Date | string | null,
  timezone: string | null
): number | null {
  if (arrivalAt === null) {
    return null
  }

  const date =
    arrivalAt instanceof Date
      ? arrivalAt
      : new Date(arrivalAt)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  const dateTime =
    DateTime.fromJSDate(date)

  const zonedDateTime =
    timezone
      ? dateTime.setZone(timezone)
      : dateTime

  return zonedDateTime.isValid
    ? zonedDateTime.hour
    : null
}

function isHourInWindow(
  hour: number,
  startHour: number,
  endHour: number
): boolean {
  const normalizedHour =
    normalizeHour(hour)

  const start =
    normalizeHour(startHour)

  const end =
    normalizeHour(endHour)

  // 0–0 means no time restriction.
  if (start === end) {
    return true
  }

  if (start < end) {
    return (
      normalizedHour >= start &&
      normalizedHour < end
    )
  }

  // Overnight windows, e.g. 15:00–02:00.
  return (
    normalizedHour >= start ||
    normalizedHour < end
  )
}

function normalizeHour(
  hour: number
): number {
  return (
    (Math.floor(hour) % 24 + 24) % 24
  )
}

function getRoleTimeAffinity(
  role: ExperienceRole,
  hour: number
): number {
  if (!Number.isFinite(hour)) {
    return 0
  }

  switch (role) {
    case 'breakfast_brunch':
      return hour >= 8 && hour < 12
        ? 16
        : 0

    case 'lunch':
      return hour >= 11 && hour < 15
        ? 16
        : 0

    case 'dinner':
      return hour >= 18 && hour < 22
        ? 18
        : 0

    case 'coffee_tea':
      return hour >= 6 && hour < 12
        ? 12
        : 0

    case 'bakery_light_bite':
      return hour >= 7 && hour < 12
        ? 10
        : 0

    case 'dessert':
      return hour >= 19 || hour < 1
        ? 14
        : 0

    case 'drinks':
      return hour >= 16 || hour < 2
        ? 16
        : 0

    case 'entertainment':
      return hour >= 19 || hour < 2
        ? 12
        : 0

    case 'culture':
    case 'discovery':
    case 'outdoors':
    case 'wellness':
    case 'unknown':
      return 0
  }
}

function extractTypeValues(
  value: unknown
): string[] {
  if (
    value === null ||
    value === undefined
  ) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(
      extractTypeValues
    )
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  if (
    trimmed.startsWith('[') &&
    trimmed.endsWith(']')
  ) {
    try {
      const parsed: unknown =
        JSON.parse(trimmed)

      if (Array.isArray(parsed)) {
        return extractTypeValues(parsed)
      }
    } catch {
      // Fall through to ordinary string handling.
    }
  }

  return trimmed
    .split(/[,|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/* =========================================================
 * CONTEXTUAL FLOW INTELLIGENCE:
 * VENUE FORMAT & ROLE SUITABILITY
 *
 * Additive only. Existing role inference is unchanged.
 *
 * A venue's role describes a particular visit.
 * A venue's format describes its broader offering.
 *
 * Example:
 * - A restaurant can support cocktails.
 * - A dedicated cocktail bar is generally a stronger
 *   destination for a post-dinner drinks experience.
 *
 * These functions expose that distinction without
 * adding hard exclusions or changing stored venue types.
 * ======================================================= */

export type ExperienceVenueFormat =
  | 'dining'
  | 'dining_and_drinks'
  | 'drinks_destination'
  | 'cafe'
  | 'bakery'
  | 'dessert_destination'
  | 'culture'
  | 'discovery'
  | 'outdoors'
  | 'wellness'
  | 'entertainment'
  | 'mixed_other'
  | 'unknown'

export type ExperienceVenueFormatFamily =
  | 'dining'
  | 'drinks'
  | 'light_food'
  | 'culture'
  | 'discovery'
  | 'outdoors'
  | 'wellness'
  | 'entertainment'
  | 'unknown'

export type ExperienceVenueFormatResolution = {
  format: ExperienceVenueFormat
  family: ExperienceVenueFormatFamily
  confidence: ExperienceConfidence
  normalizedTypes: string[]
  matchedTypes: string[]
  reason: string
}

export type ExperienceSuitability = {
  role: ExperienceRole
  venueFormat: ExperienceVenueFormat
  venueFormatFamily: ExperienceVenueFormatFamily
  confidence: ExperienceConfidence

  /**
   * Whether the intended experience appears central
   * to the venue's format, rather than merely available.
   *
   * This is a metadata-based inference, not a verified
   * statement about the venue's business operations.
   */
  isPrimaryExperience: boolean

  /**
   * Bounded scoring contribution.
   *
   * Intended for addition to venue scoring after normal
   * eligibility and contextual constraints are evaluated.
   * It does not itself reject any venue.
   */
  scoreAdjustment: number

  /**
   * Whether the original venue classifications indicate
   * that the requested experience is supported.
   */
  isSupportedRole: boolean

  matchedTypes: string[]
  reason: string
}

export type EvaluateExperienceSuitabilityParams = {
  venue: ExperienceVenue
  role: ExperienceRole | ExperienceRoleResolution
}

/**
 * Explicit classification signals.
 *
 * Format inference is deliberately separate from the
 * role matchers above so existing role resolution and
 * compatibility calculations remain completely unchanged.
 */

const FORMAT_MEAL_TYPES = new Set([
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
])

const FORMAT_DINING_TYPES = new Set([
  'restaurant',
  'bistro',
  'bistrot',
])

const FORMAT_DRINKS_TYPES = new Set([
  'cocktail',
  'bar',
  'wine_bar',
  'lounge',
  'speakeasy',
  'happy_hour',
  'rooftop',
  'pub',
  'brewery',
])

const FORMAT_CAFE_TYPES = new Set([
  'coffee',
  'cafe',
  'tea',
  'afternoon_tea',
  'juice_bar',
  'smoothie',
])

const FORMAT_BAKERY_TYPES = new Set([
  'bakery',
  'pastry',
  'pastries',
  'snack',
  'sandwich',
])

const FORMAT_DESSERT_TYPES = new Set([
  'dessert',
  'ice_cream',
  'gelato',
  'patisserie',
])

const FORMAT_CULTURE_TYPES = new Set([
  'gallery',
  'museum',
  'bookstore',
  'library',
  'art',
  'cultural',
])

const FORMAT_DISCOVERY_TYPES = new Set([
  'lifestyle',
  'market',
  'showroom',
  'random_gem',
  'workspace',
  'shopping',
  'design',
  'retail',
])

const FORMAT_OUTDOORS_TYPES = new Set([
  'park',
  'garden',
  'nature',
  'walk',
  'outdoors',
  'scenic',
])

const FORMAT_WELLNESS_TYPES = new Set([
  'fitness',
  'wellness',
  'yoga',
  'pilates',
  'spa',
  'gym',
])

const FORMAT_ENTERTAINMENT_TYPES = new Set([
  'music',
  'live_music',
  'show',
  'comedy',
  'theater',
  'cinema',
  'club',
  'dj',
  'nightlife',
  'event_venue',
  'event_space',
  'stadium',
])

const VENUE_FORMAT_FAMILIES: Record<
  ExperienceVenueFormat,
  ExperienceVenueFormatFamily
> = {
  dining: 'dining',
  dining_and_drinks: 'dining',
  drinks_destination: 'drinks',
  cafe: 'drinks',
  bakery: 'light_food',
  dessert_destination: 'light_food',
  culture: 'culture',
  discovery: 'discovery',
  outdoors: 'outdoors',
  wellness: 'wellness',
  entertainment: 'entertainment',
  mixed_other: 'unknown',
  unknown: 'unknown',
}

const SUITABILITY_MIN_SCORE = -32
const SUITABILITY_MAX_SCORE = 18

/**
 * Classify the likely broader format of a venue.
 *
 * Important:
 *
 * A dining venue tagged with both "dinner" and
 * "cocktail" is treated as dining_and_drinks.
 *
 * It is NOT automatically treated as a dedicated
 * cocktail destination merely because it serves drinks.
 *
 * The algorithm uses only venue classification fields,
 * not names, tags, vibes, descriptions or popularity.
 *
 * When multiple unrelated formats have equally strong
 * evidence, the result is mixed_other rather than an
 * unjustifiably confident designation.
 */
export function resolveVenueFormat(
  venue: ExperienceVenue
): ExperienceVenueFormatResolution {
  const normalizedTypes =
    getNormalizedExperienceTypes(venue)

  const types = new Set(normalizedTypes)

  const matchedMeals = findFormatMatches(
    types,
    FORMAT_MEAL_TYPES
  )

  const matchedDining = findFormatMatches(
    types,
    FORMAT_DINING_TYPES
  )

  const matchedDrinks = findFormatMatches(
    types,
    FORMAT_DRINKS_TYPES
  )

  const hasDiningEvidence =
    matchedMeals.length > 0 ||
    matchedDining.length > 0

  const hasDrinksEvidence =
    matchedDrinks.length > 0

  if (
    hasDiningEvidence &&
    hasDrinksEvidence
  ) {
    return makeVenueFormatResolution({
      format: 'dining_and_drinks',
      confidence: 'medium',
      normalizedTypes,
      matchedTypes: [
        ...matchedMeals,
        ...matchedDining,
        ...matchedDrinks,
      ],
      reason:
        'Venue classifications indicate both substantial ' +
        'dining and drinks capabilities. It is treated ' +
        'as a dining-and-drinks venue rather than a ' +
        'dedicated drinks destination.',
    })
  }

  if (hasDiningEvidence) {
    return makeVenueFormatResolution({
      format: 'dining',
      confidence:
        matchedMeals.length > 0
          ? 'high'
          : 'medium',
      normalizedTypes,
      matchedTypes: [
        ...matchedMeals,
        ...matchedDining,
      ],
      reason:
        'Venue classifications indicate a primarily ' +
        'dining-oriented experience.',
    })
  }

  if (hasDrinksEvidence) {
    return makeVenueFormatResolution({
      format: 'drinks_destination',
      confidence: 'medium',
      normalizedTypes,
      matchedTypes: matchedDrinks,
      reason:
        'Venue has drinks classifications without ' +
        'explicit substantial-meal classifications.',
    })
  }

  const formatGroups = ([
    {
      format: 'cafe',
      matches: findFormatMatches(
        types,
        FORMAT_CAFE_TYPES
      ),
    },
    {
      format: 'bakery',
      matches: findFormatMatches(
        types,
        FORMAT_BAKERY_TYPES
      ),
    },
    {
      format: 'dessert_destination',
      matches: findFormatMatches(
        types,
        FORMAT_DESSERT_TYPES
      ),
    },
    {
      format: 'culture',
      matches: findFormatMatches(
        types,
        FORMAT_CULTURE_TYPES
      ),
    },
    {
      format: 'discovery',
      matches: findFormatMatches(
        types,
        FORMAT_DISCOVERY_TYPES
      ),
    },
    {
      format: 'outdoors',
      matches: findFormatMatches(
        types,
        FORMAT_OUTDOORS_TYPES
      ),
    },
    {
      format: 'wellness',
      matches: findFormatMatches(
        types,
        FORMAT_WELLNESS_TYPES
      ),
    },
    {
      format: 'entertainment',
      matches: findFormatMatches(
        types,
        FORMAT_ENTERTAINMENT_TYPES
      ),
      },
    ] satisfies {
    format: ExperienceVenueFormat
    matches: string[]
    }[]).filter((group) => group.matches.length > 0)

  if (formatGroups.length === 0) {
    return makeVenueFormatResolution({
      format: 'unknown',
      confidence: 'low',
      normalizedTypes,
      matchedTypes: [],
      reason:
        'No recognized primary venue format could be ' +
        'inferred from the venue classifications.',
    })
  }

  if (formatGroups.length === 1) {
    const group = formatGroups[0]

    return makeVenueFormatResolution({
      format: group.format,
      confidence:
        group.matches.length >= 2
          ? 'high'
          : 'medium',
      normalizedTypes,
      matchedTypes: group.matches,
      reason:
        `Venue classifications indicate a ` +
        `${group.format.replace(/_/g, ' ')} format.`,
    })
  }

  const rankedGroups = [...formatGroups].sort(
    (a, b) =>
      b.matches.length - a.matches.length
  )

  const leading = rankedGroups[0]
  const runnerUp = rankedGroups[1]

  if (
    leading.matches.length >
    runnerUp.matches.length
  ) {
    return makeVenueFormatResolution({
      format: leading.format,
      confidence: 'low',
      normalizedTypes,
      matchedTypes: leading.matches,
      reason:
        'Multiple venue formats are indicated. ' +
        'The leading format has more explicit ' +
        'classification evidence.',
    })
  }

  return makeVenueFormatResolution({
    format: 'mixed_other',
    confidence: 'low',
    normalizedTypes,
    matchedTypes: formatGroups.flatMap(
      (group) => group.matches
    ),
    reason:
      'Multiple different venue formats have equal ' +
      'classification evidence. No single dominant ' +
      'format is assumed.',
  })
}

/**
 * Return the venue's broad format family.
 *
 * Intended for future route-wide format-diversity
 * scoring without needing to compare specific strings
 * like "dining" and "dining_and_drinks".
 */
export function getVenueFormatFamily(
  venue: ExperienceVenue
): ExperienceVenueFormatFamily {
  return resolveVenueFormat(venue).family
}

/**
 * Evaluate how well a specific venue supports the
 * primary experience assigned to one visit.
 *
 * Positive scores reward purpose-fit destinations.
 * Negative scores discourage incidental capabilities.
 *
 * Examples:
 * - Dedicated cocktail destination + drinks: positive.
 * - Restaurant with cocktail service + drinks: negative.
 * - Dining venue + dinner: positive.
 *
 * This function does NOT enforce hard exclusions.
 * The contextual-constraints layer retains ownership
 * of itinerary eligibility decisions.
 */
export function evaluateExperienceSuitability({
  venue,
  role,
}: EvaluateExperienceSuitabilityParams): ExperienceSuitability {
  const experienceRole =
    typeof role === 'string'
      ? role
      : role.role

  const formatResolution =
    resolveVenueFormat(venue)

  const supportedRoles =
    getVenueExperienceCapabilities(venue)

  const isSupportedRole =
    experienceRole !== 'unknown' &&
    supportedRoles.includes(experienceRole)

  const matchedTypes =
    experienceRole === 'unknown'
      ? []
      : getMatchedTypes(
          experienceRole,
          new Set(
            formatResolution.normalizedTypes
          )
        )

  if (experienceRole === 'unknown') {
    return {
      role: experienceRole,
      venueFormat: formatResolution.format,
      venueFormatFamily: formatResolution.family,
      confidence: 'low',
      isPrimaryExperience: false,
      scoreAdjustment: 0,
      isSupportedRole: false,
      matchedTypes: [],
      reason:
        'No primary experience role is available, ' +
        'so venue-format suitability is neutral.',
    }
  }

  if (!isSupportedRole) {
    return {
      role: experienceRole,
      venueFormat: formatResolution.format,
      venueFormatFamily: formatResolution.family,
      confidence: 'low',
      isPrimaryExperience: false,
      scoreAdjustment: SUITABILITY_MIN_SCORE,
      isSupportedRole: false,
      matchedTypes,
      reason:
        'The intended experience is not supported by ' +
        'the venue classification metadata.',
    }
  }

  const primary =
    isPrimaryRoleForVenueFormat(
      formatResolution.format,
      experienceRole
    )

  let scoreAdjustment = 0
  let reason = ''

  if (primary) {
    scoreAdjustment = 16

    reason =
      'The assigned experience is a strong fit for ' +
      'the venue format.'
  } else if (
    formatResolution.format === 'dining_and_drinks' &&
    experienceRole === 'drinks'
  ) {
    scoreAdjustment = -26

    reason =
      'The venue supports drinks but is also ' +
      'substantially dining-oriented. A dedicated ' +
      'drinks destination is preferred when available.'
  } else if (
    formatResolution.format === 'mixed_other' ||
    formatResolution.format === 'unknown'
  ) {
    scoreAdjustment = 0

    reason =
      'Venue format evidence is ambiguous, so no ' +
      'strong suitability preference is applied.'
  } else {
    scoreAdjustment = -12

    reason =
      'The venue supports this experience, but ' +
      'its broader format suggests another primary use.'
  }

  const boundedAdjustment = Math.max(
    SUITABILITY_MIN_SCORE,
    Math.min(
      SUITABILITY_MAX_SCORE,
      scoreAdjustment
    )
  )

  return {
    role: experienceRole,
    venueFormat: formatResolution.format,
    venueFormatFamily: formatResolution.family,
    confidence:
      primary
        ? formatResolution.confidence
        : formatResolution.confidence === 'high'
          ? 'medium'
          : 'low',
    isPrimaryExperience: primary,
    scoreAdjustment: boundedAdjustment,
    isSupportedRole,
    matchedTypes,
    reason,
  }
}

/**
 * Convenience function for scoring a candidate.
 *
 * This remains a soft preference only.
 */
export function getExperienceSuitabilityScore(
  params: EvaluateExperienceSuitabilityParams
): number {
  return evaluateExperienceSuitability(
    params
  ).scoreAdjustment
}

/**
 * Compare the broader formats of two venues.
 *
 * Unknown formats never count as a confirmed match.
 *
 * The result is descriptive. Whether repeated formats
 * should be penalized depends on the full itinerary
 * and belongs in contextualConstraints.ts.
 */
export function shareVenueFormatFamily(
  first: ExperienceVenue,
  second: ExperienceVenue
): boolean {
  const firstFamily =
    getVenueFormatFamily(first)

  const secondFamily =
    getVenueFormatFamily(second)

  return (
    firstFamily !== 'unknown' &&
    secondFamily !== 'unknown' &&
    firstFamily === secondFamily
  )
}

/* =========================================================
 * Venue-format internal helpers
 * ======================================================= */

function findFormatMatches(
  types: ReadonlySet<string>,
  knownTypes: ReadonlySet<string>
): string[] {
  return [...knownTypes].filter(
    (type) => types.has(type)
  )
}

function makeVenueFormatResolution({
  format,
  confidence,
  normalizedTypes,
  matchedTypes,
  reason,
}: {
  format: ExperienceVenueFormat
  confidence: ExperienceConfidence
  normalizedTypes: string[]
  matchedTypes: string[]
  reason: string
}): ExperienceVenueFormatResolution {
  return {
    format,
    family: VENUE_FORMAT_FAMILIES[format],
    confidence,
    normalizedTypes,
    matchedTypes: Array.from(
      new Set(matchedTypes)
    ),
    reason,
  }
}

function isPrimaryRoleForVenueFormat(
  format: ExperienceVenueFormat,
  role: ExperienceRole
): boolean {
  switch (format) {
    case 'dining':
    case 'dining_and_drinks':
      return isSubstantialMealRole(role)

    case 'drinks_destination':
      return role === 'drinks'

    case 'cafe':
      return role === 'coffee_tea'

    case 'bakery':
      return role === 'bakery_light_bite'

    case 'dessert_destination':
      return role === 'dessert'

    case 'culture':
      return role === 'culture'

    case 'discovery':
      return role === 'discovery'

    case 'outdoors':
      return role === 'outdoors'

    case 'wellness':
      return role === 'wellness'

    case 'entertainment':
      return role === 'entertainment'

    case 'mixed_other':
    case 'unknown':
      return false
  }
}