import type { DateTime } from 'luxon'

const TYPE_EMOJI_RULES: Array<{
  emoji: string
  types: string[]
}> = [
  {
    emoji: '☕️',
    types: [
      'coffee',
      'cafe',
      'café',
      'bakery',
      'breakfast',
      'brunch',
      'tea',
    ],
  },
  {
    emoji: '🍸',
    types: [
      'cocktail',
      'cocktails',
      'speakeasy',
      'lounge',
    ],
  },
  {
    emoji: '🍻',
    types: [
      'bar',
      'pub',
      'brewery',
    ],
  },
  {
    emoji: '🍷',
    types: [
      'wine bar',
      'wine',
    ],
  },
  {
    emoji: '🍽️',
    types: [
      'restaurant',
      'dinner',
      'lunch',
      'kitchen',
      'food',
      'bbq',
      'steakhouse',
      'pizza',
      'sushi',
      'tapas',
    ],
  },
  {
    emoji: '🎵',
    types: [
      'music',
      'live music',
      'concert',
      'club',
      'nightclub',
      'dj',
    ],
  },
  {
    emoji: '🖼️',
    types: [
      'gallery',
      'museum',
      'art',
      'exhibition',
      'culture',
    ],
  },
  {
    emoji: '🛍️',
    types: [
      'shopping',
      'shop',
      'retail',
      'boutique',
      'lifestyle',
      'store',
    ],
  },
  {
    emoji: '🧘',
    types: [
      'wellness',
      'fitness',
      'gym',
      'yoga',
      'spa',
      'pilates',
      'recovery',
    ],
  },
  {
    emoji: '🏨',
    types: [
      'hotel',
      'stay',
      'lodging',
      'hostel',
    ],
  },
  {
    emoji: '🌳',
    types: [
      'park',
      'garden',
      'outdoors',
      'outdoor',
    ],
  },
  {
    emoji: '🎭',
    types: [
      'theater',
      'theatre',
      'comedy',
      'performance',
      'show',
    ],
  },
  {
    emoji: '🏟️',
    types: [
      'stadium',
      'arena',
      'sports',
      'fan zone',
    ],
  },
  {
    emoji: '📚',
    types: [
      'bookstore',
      'library',
    ],
  },
  {
    emoji: '🎯',
    types: [
      'activity',
      'games',
      'arcade',
      'bowling',
      'mini golf',
    ],
  },
  {
    emoji: '🍦',
    types: [
      'dessert',
    ],
  },
  {
    emoji: '👩🏻‍🌾',
    types: [
      'market',
    ],
  },
]

const TYPE_NORMALIZATION_ALIASES: Record<string, string> = {
  café: 'cafe',
  cocktails: 'cocktail',
  nightclub: 'club',
  theatre: 'theater',
}

const COFFEE_TYPES = [
  'coffee',
  'cafe',
  'bakery',
  'breakfast',
  'brunch',
  'tea',
] as const

const DINING_TYPES = [
  'restaurant',
  'dinner',
  'lunch',
  'kitchen',
  'food',
  'bbq',
  'steakhouse',
  'pizza',
  'sushi',
  'tapas',
] as const

const WINE_TYPES = [
  'wine bar',
  'wine',
] as const

const COCKTAIL_TYPES = [
  'cocktail',
  'speakeasy',
  'lounge',
] as const

const BAR_TYPES = [
  'bar',
  'pub',
  'brewery',
] as const

function normalizeType(
  value: string
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

  return (
    TYPE_NORMALIZATION_ALIASES[
      normalized
    ] ?? normalized
  )
}

function toTypeArray(
  input?:
    | string
    | string[]
    | null
): string[] {
  if (!input) {
    return []
  }

  const values =
    Array.isArray(input)
      ? input
      : input
          .split(',')
          .map((part) =>
            part.trim()
          )

  return Array.from(
    new Set(
      values
        .map(normalizeType)
        .filter(Boolean)
    )
  )
}

function hasMatchingType(
  normalizedTypes: readonly string[],
  candidates: readonly string[]
): boolean {
  return candidates.some(
    (candidate) =>
      normalizedTypes.includes(
        normalizeType(candidate)
      )
  )
}

function resolveTemporalEmoji(
  normalizedTypes: readonly string[],
  nowForCity?: DateTime | null
): string | null {
  if (
    !nowForCity ||
    !nowForCity.isValid
  ) {
    return null
  }

  const hour = nowForCity.hour

  const isMorning =
    hour >= 5 &&
    hour < 11

  const isDaytime =
    hour >= 11 &&
    hour < 17

  const isEvening =
    hour >= 17 &&
    hour < 22

  const isLateNight =
    hour >= 22 ||
    hour < 5

  const hasCoffee =
    hasMatchingType(
      normalizedTypes,
      COFFEE_TYPES
    )

  const hasDining =
    hasMatchingType(
      normalizedTypes,
      DINING_TYPES
    )

  const hasWine =
    hasMatchingType(
      normalizedTypes,
      WINE_TYPES
    )

  const hasCocktails =
    hasMatchingType(
      normalizedTypes,
      COCKTAIL_TYPES
    )

  const hasBar =
    hasMatchingType(
      normalizedTypes,
      BAR_TYPES
    )

  const hasMultipleTemporalTypes =
    [
      hasCoffee,
      hasDining,
      hasWine,
      hasCocktails,
      hasBar,
    ].filter(Boolean).length > 1

  if (!hasMultipleTemporalTypes) {
    return null
  }

  if (isMorning) {
    if (hasCoffee) {
      return '☕️'
    }

    if (hasDining) {
      return '🍽️'
    }

    if (hasWine) {
      return '🍷'
    }

    if (hasCocktails) {
      return '🍸'
    }

    if (hasBar) {
      return '🍻'
    }
  }

  if (isDaytime) {
    if (hasDining) {
      return '🍽️'
    }

    if (hasCoffee) {
      return '☕️'
    }

    if (hasWine) {
      return '🍷'
    }

    if (hasCocktails) {
      return '🍸'
    }

    if (hasBar) {
      return '🍻'
    }
  }

  if (
    isEvening ||
    isLateNight
  ) {
    if (hasWine) {
      return '🍷'
    }

    if (hasCocktails) {
      return '🍸'
    }

    if (hasBar) {
      return '🍻'
    }

    if (hasDining) {
      return '🍽️'
    }

    if (hasCoffee) {
      return '☕️'
    }
  }

  return null
}

export function getVenueMarkerEmoji(
  input?:
    | string
    | string[]
    | null,
  nowForCity?: DateTime | null
): string {
  const normalizedTypes =
    toTypeArray(input)

  const temporalEmoji =
    resolveTemporalEmoji(
      normalizedTypes,
      nowForCity
    )

  if (temporalEmoji) {
    return temporalEmoji
  }

  for (
    const rule of TYPE_EMOJI_RULES
  ) {
    if (
      rule.types.some((type) =>
        normalizedTypes.includes(
          normalizeType(type)
        )
      )
    ) {
      return rule.emoji
    }
  }

  return '📍'
}