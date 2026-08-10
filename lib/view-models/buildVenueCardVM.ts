export type VenueCardVM = {
  id: string
  name: string
  href: string
  imageUrl: string | null
  description: string | null
  distanceMeters: number | null
  distanceLabel: string | null
  walkTimeMinutes: number | null
  walkTimeLabel: string | null
  primaryType: string | null
  typeLabel: string | null
  vibeLabel: string | null
  bestForLabel: string | null
  openNowLabel: string | null
  chips: string[]
  isHostPick: boolean
  hostPickLabel: string | null
}

export type VenueCardLike = {
  id: string
  name: string
  lat: number
  lon: number
  link?: string | null
  cover?: string | null
  description?: string | null
  type?: string | string[] | null
  tags?: string[] | string | null
  vibe?: string | null
  vibes?: string[] | string | null
  best_for?: string[] | string | null
  bestFor?: string[] | string | null
  hours?: unknown
  label?: string | null
  slug?: string | null
  city?: string | null
}

export type VenueCardContext =
  | 'nearby'
  | 'coffee'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'drinks'
  | 'wellness'

export type BuildVenueCardVMOptions = {
  origin?: {
    lat: number
    lon: number
  }
  includeWalkTime?: boolean
  includeDistance?: boolean
  includeOpenNowLabel?: boolean
  hostPickIds?: string[]
  maxChips?: number

  /**
   * Optional presentation context for nearby/property surfaces.
   *
   * This allows venues with multiple types to resolve the most relevant
   * primary type for the section in which the card is being displayed.
   *
   * Existing callers do not need to provide this.
   */
  context?: VenueCardContext
}

const CONTEXT_TYPE_PRIORITY: Record<
  Exclude<VenueCardContext, 'nearby'>,
  string[]
> = {
  coffee: [
    'coffee',
    'cafe',
    'café',
    'coffee shop',
    'tea',
    'bakery',
    'breakfast',
  ],

  breakfast: [
    'breakfast',
    'brunch',
    'cafe',
    'café',
    'coffee',
    'coffee shop',
    'bakery',
    'restaurant',
  ],

  lunch: [
    'lunch',
    'restaurant',
    'cafe',
    'café',
    'sandwich',
    'pizza',
    'food',
    'kitchen',
  ],

  dinner: [
    'dinner',
    'restaurant',
    'kitchen',
    'steakhouse',
    'sushi',
    'tapas',
    'pizza',
    'bbq',
    'food',
  ],

  drinks: [
    'cocktail',
    'cocktails',
    'cocktail bar',
    'wine bar',
    'wine',
    'bar',
    'lounge',
    'speakeasy',
    'pub',
    'brewery',
  ],

  wellness: [
    'wellness',
    'spa',
    'yoga',
    'fitness',
    'gym',
    'pilates',
    'recovery',
  ],
}

const DISPLAY_VIBE_PRIORITY = [
  'romantic',
  'date night',
  'intimate',
  'cozy',
  'lively',
  'energetic',
  'buzzing',
  'upscale',
  'elevated',
  'refined',
  'casual',
  'easygoing',
  'laid-back',
  'social',
  'relaxed',
]

export function buildVenueCardVM(
  venue: VenueCardLike,
  options: BuildVenueCardVMOptions = {}
): VenueCardVM {
  const includeDistance =
    options.includeDistance ?? true

  const includeWalkTime =
    options.includeWalkTime ?? true

  const includeOpenNowLabel =
    options.includeOpenNowLabel ?? false

  const maxChips =
    options.maxChips ?? 3

  const context =
    options.context

  const distanceMeters =
    options.origin &&
    isFiniteNumber(venue.lat) &&
    isFiniteNumber(venue.lon)
      ? haversineDistanceMeters(
          options.origin.lat,
          options.origin.lon,
          Number(venue.lat),
          Number(venue.lon)
        )
      : null

  const walkTimeMinutes =
    includeWalkTime &&
    distanceMeters !== null
      ? estimateWalkMinutes(
          distanceMeters
        )
      : null

  const venueTypes =
    normalizeVenueTypes(
      venue.type
    )

  const primaryType =
    resolvePrimaryType(
      venueTypes,
      context
    )

  const typeLabel =
    primaryType
      ? humanizeTypeLabel(
          primaryType
        )
      : null

  const tags =
    asStringArray(
      venue.tags
    )

  const vibeLabel =
    resolveVibeLabel({
      vibe:
        venue.vibe,

      vibes:
        asStringArray(
          venue.vibes
        ),

      tags,
    })

  const contextualBestForLabel =
    getContextBestForLabel(
      context
    )

  const bestForLabel =
    contextualBestForLabel ||
    firstString(
      asStringArray(
        venue.bestFor
      )
    ) ||
    firstString(
      asStringArray(
        venue.best_for
      )
    ) ||
    inferBestForLabel({
      types:
        venueTypes,

      tags,

      vibe:
        vibeLabel,
    })

  const isHostPick =
    Boolean(
      venue.label
    ) ||
    Boolean(
      options.hostPickIds?.includes(
        venue.id
      )
    )

  const hostPickLabel =
    cleanText(
      venue.label
    ) ||
    (
      isHostPick
        ? 'Host pick'
        : null
    )

  const openNowLabel =
    includeOpenNowLabel
      ? inferOpenNowLabel(
          venue.hours
        )
      : null

  const distanceLabel =
    includeDistance
      ? formatDistanceLabel(
          distanceMeters
        )
      : null

  const walkTimeLabel =
    includeWalkTime
      ? formatWalkTimeLabel(
          walkTimeMinutes
        )
      : null

  const chips =
    buildChips(
      {
        distanceLabel,
        walkTimeLabel,
        typeLabel,
        vibeLabel,
        bestForLabel,
        openNowLabel,
        hostPickLabel:
          isHostPick
            ? hostPickLabel
            : null,
        context,
      },
      maxChips
    )

  return {
    id:
      venue.id,

    name:
      venue.name,

    href:
      cleanText(
        venue.link
      ) ||
      `/venue-profile/${venue.id}`,

    imageUrl:
      normalizeImageUrl(
        venue.cover
      ),

    description:
      cleanDescription(
        venue.description
      ),

    distanceMeters,

    distanceLabel,

    walkTimeMinutes,

    walkTimeLabel,

    primaryType,

    typeLabel,

    vibeLabel,

    bestForLabel,

    openNowLabel,

    chips,

    isHostPick,

    hostPickLabel,
  }
}

export function buildVenueCardVMs(
  venues: VenueCardLike[],
  options: BuildVenueCardVMOptions = {}
): VenueCardVM[] {
  return venues.map(
    (venue) =>
      buildVenueCardVM(
        venue,
        options
      )
  )
}

function normalizeVenueTypes(
  value:
    | string
    | string[]
    | null
    | undefined
): string[] {
  return asStringArray(
    value
  )
    .map(
      (type) =>
        normalizeComparableValue(
          type
        )
    )
    .filter(
      Boolean
    )
}

function resolvePrimaryType(
  types: string[],
  context?:
    VenueCardContext
): string | null {
  if (
    types.length === 0
  ) {
    return null
  }

  if (
    context &&
    context !== 'nearby'
  ) {
    const priorities =
      CONTEXT_TYPE_PRIORITY[
        context
      ]

    for (
      const priority of
        priorities
    ) {
      const match =
        types.find(
          (type) =>
            matchesAny(
              type,
              [
                priority,
              ]
            )
        )

      if (
        match
      ) {
        return match
      }
    }
  }

  return (
    types[0] ??
    null
  )
}

function getContextBestForLabel(
  context?:
    VenueCardContext
): string | null {
  switch (
    context
  ) {
    case 'coffee':
      return 'Good for coffee'

    case 'breakfast':
      return 'Good for breakfast'

    case 'lunch':
      return 'Good for lunch'

    case 'dinner':
      return 'Good for dinner'

    case 'drinks':
      return 'Good for drinks'

    case 'wellness':
      return 'Good for a reset'

    case 'nearby':
    default:
      return null
  }
}

function buildChips(
  values: {
    distanceLabel:
      string | null
    walkTimeLabel:
      string | null
    typeLabel:
      string | null
    vibeLabel:
      string | null
    bestForLabel:
      string | null
    openNowLabel:
      string | null
    hostPickLabel:
      string | null
    context?:
      VenueCardContext
  },
  maxChips: number
) {
  const ordered = [
    values.hostPickLabel,
    values.openNowLabel,
    values.walkTimeLabel,
    values.distanceLabel,
    values.vibeLabel,
    values.typeLabel,
    values.bestForLabel,
  ]

  const deduped:
    string[] = []

  const usedSemanticGroups =
    new Set<string>()

  for (
    const value of
      ordered
  ) {
    const cleaned =
      cleanText(
        value
      )

    if (
      !cleaned
    ) {
      continue
    }

    if (
      isContextRedundantChip(
        cleaned,
        values.context
      )
    ) {
      continue
    }

    const normalized =
      normalizeComparableValue(
        cleaned
      )

    if (
      deduped.some(
        (existing) =>
          normalizeComparableValue(
            existing
          ) ===
          normalized
      )
    ) {
      continue
    }

    const semanticGroup =
      getChipSemanticGroup(
        cleaned
      )

    if (
      semanticGroup &&
      usedSemanticGroups.has(
        semanticGroup
      )
    ) {
      continue
    }

    deduped.push(
      cleaned
    )

    if (
      semanticGroup
    ) {
      usedSemanticGroups.add(
        semanticGroup
      )
    }

    if (
      deduped.length >=
      maxChips
    ) {
      break
    }
  }

  return deduped
}

function isContextRedundantChip(
  value: string,
  context?:
    VenueCardContext
): boolean {
  if (
    !context ||
    context === 'nearby'
  ) {
    return false
  }

  const normalized =
    normalizeComparableValue(
      value
    )

  switch (
    context
  ) {
    case 'coffee':
      return (
        normalized ===
          'good for coffee'
      )

    case 'breakfast':
      return (
        normalized ===
          'good for breakfast' ||
        normalized ===
          'breakfast'
      )

    case 'lunch':
      return (
        normalized ===
          'good for lunch' ||
        normalized ===
          'lunch'
      )

    case 'dinner':
      return (
        normalized ===
          'good for dinner' ||
        normalized ===
          'dinner'
      )

    case 'drinks':
      return (
        normalized ===
          'good for drinks'
      )

    case 'wellness':
      return (
        normalized ===
          'good for a reset'
      )

    default:
      return false
  }
}

function getChipSemanticGroup(
  value: string
): string | null {
  const normalized =
    normalizeComparableValue(
      value
    )

  if (
    matchesAny(
      normalized,
      [
        'good for coffee',
        'coffee',
        'coffee shop',
        'cafe',
        'café',
      ]
    )
  ) {
    return 'coffee'
  }

  if (
    matchesAny(
      normalized,
      [
        'good for breakfast',
        'breakfast',
        'brunch',
      ]
    )
  ) {
    return 'breakfast'
  }

  if (
    matchesAny(
      normalized,
      [
        'good for lunch',
        'lunch',
      ]
    )
  ) {
    return 'lunch'
  }

  if (
    matchesAny(
      normalized,
      [
        'good for dinner',
        'dinner',
        'restaurant',
        'kitchen',
      ]
    )
  ) {
    return 'dinner'
  }

  if (
    matchesAny(
      normalized,
      [
        'good for drinks',
        'cocktail',
        'cocktail bar',
        'wine bar',
        'bar',
        'pub',
        'brewery',
        'lounge',
      ]
    )
  ) {
    return 'drinks'
  }

  if (
    matchesAny(
      normalized,
      [
        'good for a reset',
        'wellness',
        'fitness',
        'spa',
        'yoga',
        'pilates',
      ]
    )
  ) {
    return 'wellness'
  }

  if (
    normalized.includes(
      'min walk'
    )
  ) {
    return 'walk-time'
  }

  if (
    normalized.endsWith(
      ' away'
    )
  ) {
    return 'distance'
  }

  return null
}

function inferBestForLabel({
  types,
  tags,
  vibe,
}: {
  types: string[]
  tags: string[]
  vibe: string | null
}) {
  const normalizedTypes =
    types.map(
      normalizeComparableValue
    )

  const normalizedTags =
    tags.map(
      normalizeComparableValue
    )

  const normalizedVibe =
    normalizeComparableValue(
      vibe ?? ''
    )

  if (
    normalizedTypes.some(
      (type) =>
        matchesAny(
          type,
          [
            'coffee',
            'coffee shop',
            'cafe',
            'café',
            'bakery',
            'tea',
          ]
        )
    ) ||
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'coffee',
            'espresso',
            'coffee shop',
          ]
        )
    )
  ) {
    return 'Good for coffee'
  }

  if (
    normalizedTypes.some(
      (type) =>
        matchesAny(
          type,
          [
            'restaurant',
            'dinner',
            'kitchen',
            'steakhouse',
            'sushi',
            'tapas',
            'pizza',
            'bbq',
          ]
        )
    ) ||
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'dinner',
            'food',
            'meal',
          ]
        )
    )
  ) {
    return 'Good for dinner'
  }

  if (
    normalizedTypes.some(
      (type) =>
        matchesAny(
          type,
          [
            'bar',
            'wine bar',
            'cocktail',
            'cocktail bar',
            'pub',
            'brewery',
            'lounge',
            'speakeasy',
          ]
        )
    ) ||
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'cocktail',
            'cocktails',
            'drinks',
            'bar',
            'wine',
          ]
        )
    )
  ) {
    return 'Good for drinks'
  }

  if (
    normalizedTypes.some(
      (type) =>
        matchesAny(
          type,
          [
            'fitness',
            'yoga',
            'spa',
            'wellness',
            'pilates',
            'recovery',
          ]
        )
    ) ||
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'wellness',
            'reset',
            'fitness',
            'recovery',
          ]
        )
    )
  ) {
    return 'Good for a reset'
  }

  if (
    normalizedVibe.includes(
      'date'
    ) ||
    normalizedVibe.includes(
      'romantic'
    ) ||
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'date night',
            'romantic',
          ]
        )
    )
  ) {
    return 'Good for date night'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'group',
            'friends',
            'social',
          ]
        )
    ) ||
    normalizedVibe.includes(
      'lively'
    ) ||
    normalizedVibe.includes(
      'social'
    )
  ) {
    return 'Good with friends'
  }

  return null
}

function resolveVibeLabel({
  vibe,
  vibes,
  tags,
}: {
  vibe:
    string | null | undefined
  vibes:
    string[]
  tags:
    string[]
}): string | null {
  const explicitValues = [
    ...asStringArray(
      vibe
    ),
    ...vibes,
  ]

  const prioritizedExplicit =
    findPreferredVibe(
      explicitValues
    )

  if (
    prioritizedExplicit
  ) {
    return prioritizedExplicit
  }

  const inferred =
    inferVibeFromTags(
      tags
    )

  if (
    inferred
  ) {
    return inferred
  }

  const firstExplicit =
    firstString(
      explicitValues
    )

  return firstExplicit
    ? humanizeVibeLabel(
        firstExplicit
      )
    : null
}

function findPreferredVibe(
  values: string[]
): string | null {
  const normalizedValues =
    values.map(
      (value) => ({
        original:
          value,

        normalized:
          normalizeComparableValue(
            value
          ),
      })
    )

  for (
    const preferred of
      DISPLAY_VIBE_PRIORITY
  ) {
    const match =
      normalizedValues.find(
        ({
          normalized,
        }) =>
          matchesAny(
            normalized,
            [
              preferred,
            ]
          )
      )

    if (
      match
    ) {
      return humanizeVibeLabel(
        preferred
      )
    }
  }

  return null
}

function humanizeVibeLabel(
  value: string
): string {
  const normalized =
    normalizeComparableValue(
      value
    )

  if (
    normalized ===
      'date night'
  ) {
    return 'Date night'
  }

  if (
    normalized ===
      'easygoing'
  ) {
    return 'Easygoing'
  }

  if (
    normalized ===
      'laid-back'
  ) {
    return 'Laid-back'
  }

  return sentenceCase(
    normalized
  )
}

function inferVibeFromTags(
  tags: string[]
) {
  const normalizedTags =
    tags.map(
      normalizeComparableValue
    )

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'romantic',
            'date night',
          ]
        )
    )
  ) {
    return 'Romantic'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'lively',
            'energetic',
            'buzzing',
          ]
        )
    )
  ) {
    return 'Lively'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'cozy',
            'intimate',
            'warm',
          ]
        )
    )
  ) {
    return 'Cozy'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'casual',
            'easygoing',
            'laid-back',
          ]
        )
    )
  ) {
    return 'Casual'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'upscale',
            'elevated',
            'refined',
          ]
        )
    )
  ) {
    return 'Upscale'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'social',
            'friends',
          ]
        )
    )
  ) {
    return 'Social'
  }

  if (
    normalizedTags.some(
      (tag) =>
        matchesAny(
          tag,
          [
            'relaxed',
            'chill',
          ]
        )
    )
  ) {
    return 'Relaxed'
  }

  return null
}

function inferOpenNowLabel(
  hours: unknown
) {
  if (
    !hours
  ) {
    return null
  }

  return 'Hours available'
}

function humanizeTypeLabel(
  type: string
) {
  const value =
    normalizeComparableValue(
      type
    )

  if (
    value ===
      'wine bar'
  ) {
    return 'Wine bar'
  }

  if (
    value ===
      'cocktail' ||
    value ===
      'cocktail bar'
  ) {
    return 'Cocktail bar'
  }

  if (
    value ===
      'coffee' ||
    value ===
      'coffee shop'
  ) {
    return 'Coffee'
  }

  if (
    value ===
      'cafe' ||
    value ===
      'café'
  ) {
    return 'Cafe'
  }

  if (
    value ===
      'restaurant'
  ) {
    return 'Restaurant'
  }

  if (
    value ===
      'breakfast'
  ) {
    return 'Breakfast'
  }

  if (
    value ===
      'brunch'
  ) {
    return 'Brunch'
  }

  if (
    value ===
      'lunch'
  ) {
    return 'Lunch'
  }

  if (
    value ===
      'dinner'
  ) {
    return 'Dinner'
  }

  if (
    value ===
      'fitness'
  ) {
    return 'Fitness'
  }

  if (
    value ===
      'lifestyle'
  ) {
    return 'Lifestyle'
  }

  if (
    value ===
      'brewery'
  ) {
    return 'Brewery'
  }

  if (
    value ===
      'bakery'
  ) {
    return 'Bakery'
  }

  if (
    value ===
      'spa'
  ) {
    return 'Spa'
  }

  if (
    value ===
      'yoga'
  ) {
    return 'Yoga'
  }

  if (
    value ===
      'wellness'
  ) {
    return 'Wellness'
  }

  return sentenceCase(
    value
  )
}

function normalizeImageUrl(
  value:
    | string
    | null
    | undefined
) {
  const cleaned =
    cleanText(
      value
    )

  if (
    !cleaned
  ) {
    return null
  }

  if (
    cleaned.startsWith(
      'http://'
    ) ||
    cleaned.startsWith(
      'https://'
    )
  ) {
    return cleaned
  }

  if (
    cleaned.startsWith(
      '/'
    )
  ) {
    return cleaned
  }

  return `/${cleaned}`
}

function formatDistanceLabel(distanceMeters: number | null) {
  if (
    distanceMeters === null ||
    !Number.isFinite(distanceMeters)
  ) {
    return null
  }

  const miles =
    distanceMeters / 1609.344

  if (miles < 0.1) {
    return '<0.1 mi away'
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi away`
  }

  return `${Math.round(miles)} mi away`
}

function formatWalkTimeLabel(
  walkTimeMinutes:
    number | null
) {
  if (
    walkTimeMinutes ===
      null ||
    !Number.isFinite(
      walkTimeMinutes
    )
  ) {
    return null
  }

  if (
    walkTimeMinutes <=
    1
  ) {
    return '1 min walk'
  }

  return `${walkTimeMinutes} min walk`
}

function estimateWalkMinutes(
  distanceMeters: number
) {
  if (
    !Number.isFinite(
      distanceMeters
    ) ||
    distanceMeters <= 0
  ) {
    return 0
  }

  const rawMinutes =
    distanceMeters / 80

  return Math.max(
    1,
    Math.round(
      rawMinutes
    )
  )
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R =
    6371000

  const toRad =
    (deg: number) =>
      (
        deg *
        Math.PI
      ) / 180

  const dLat =
    toRad(
      lat2 -
      lat1
    )

  const dLon =
    toRad(
      lon2 -
      lon1
    )

  const a =
    Math.sin(
      dLat / 2
    ) *
      Math.sin(
        dLat / 2
      ) +
    Math.cos(
      toRad(
        lat1
      )
    ) *
      Math.cos(
        toRad(
          lat2
        )
      ) *
      Math.sin(
        dLon / 2
      ) *
      Math.sin(
        dLon / 2
      )

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        a
      ),
      Math.sqrt(
        1 - a
      )
    )

  return Math.round(
    R * c
  )
}

function asStringArray(
  value:
    | string[]
    | string
    | null
    | undefined
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        (item) =>
          cleanText(
            item
          )
      )
      .filter(
        (
          item
        ): item is string =>
          Boolean(
            item
          )
      )
  }

  const cleaned =
    cleanText(
      value
    )

  if (
    !cleaned
  ) {
    return []
  }

  return cleaned
    .split(
      ','
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(
      Boolean
    )
}

function firstString(
  values: string[]
) {
  return (
    values.length >
      0
      ? values[0]
      : null
  )
}

function cleanText(
  value:
    | string
    | null
    | undefined
) {
  const trimmed =
    String(
      value ?? ''
    ).trim()

  return (
    trimmed.length >
      0
      ? trimmed
      : null
  )
}

function cleanDescription(
  value:
    | string
    | null
    | undefined
) {
  const trimmed =
    cleanText(
      value
    )

  return (
    trimmed &&
    trimmed.length >
      0
      ? trimmed
      : null
  )
}

function normalizeComparableValue(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /&/g,
      'and'
    )
    .replace(
      /\s+/g,
      ' '
    )
}

function matchesAny(
  value: string,
  candidates: string[]
) {
  const normalizedValue =
    normalizeComparableValue(
      value
    )

  if (
    !normalizedValue
  ) {
    return false
  }

  return candidates.some(
    (
      candidate
    ) => {
      const normalizedCandidate =
        normalizeComparableValue(
          candidate
        )

      if (
        !normalizedCandidate
      ) {
        return false
      }

      return (
        normalizedValue ===
          normalizedCandidate ||
        normalizedValue.includes(
          normalizedCandidate
        )
      )
    }
  )
}

function sentenceCase(
  value: string
) {
  if (
    !value
  ) {
    return value
  }

  return (
    value
      .charAt(
        0
      )
      .toUpperCase() +
    value.slice(
      1
    )
  )
}

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    )
  )
}