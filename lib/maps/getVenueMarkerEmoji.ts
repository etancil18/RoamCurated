const TYPE_EMOJI_RULES: Array<{
  emoji: string
  types: string[]
}> = [
  {
    emoji: '☕️',
    types: ['coffee', 'cafe', 'café', 'bakery', 'breakfast', 'brunch', 'tea'],
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
    types: ['music', 'live music', 'concert', 'club', 'nightclub', 'dj'],
  },
  {
    emoji: '🖼️',
    types: ['gallery', 'museum', 'art', 'exhibition', 'culture'],
  },
  {
    emoji: '🛍️',
    types: ['shopping', 'shop', 'retail', 'boutique', 'lifestyle', 'store'],
  },
  {
    emoji: '🧘',
    types: ['wellness', 'fitness', 'gym', 'yoga', 'spa', 'pilates', 'recovery'],
  },
  {
    emoji: '🏨',
    types: ['hotel', 'stay', 'lodging', 'hostel'],
  },
  {
    emoji: '🌳',
    types: ['park', 'garden', 'outdoors', 'outdoor'],
  },
  {
    emoji: '🎭',
    types: ['theater', 'theatre', 'comedy', 'performance', 'show'],
  },
  {
    emoji: '🏟️',
    types: ['stadium', 'arena', 'sports', 'fan zone'],
  },
  {
    emoji: '📚',
    types: ['bookstore', 'library'],
  },
  {
    emoji: '🎯',
    types: ['activity', 'games', 'arcade', 'bowling', 'mini golf'],
  },
   {
    emoji: '🍦',
    types: ['dessert'],
  },
  {
    emoji: '👩🏻‍🌾',
    types: ['market'],
  },
]

const TYPE_NORMALIZATION_ALIASES: Record<string, string> = {
  café: 'cafe',
  cocktails: 'cocktail',
  nightclub: 'club',
  theatre: 'theater',
}

function normalizeType(value: string): string {
  const normalized = value.trim().toLowerCase()
  return TYPE_NORMALIZATION_ALIASES[normalized] ?? normalized
}

function toTypeArray(input?: string | string[] | null): string[] {
  if (!input) return []

  const values = Array.isArray(input)
    ? input
    : input.split(',').map((part) => part.trim())

  return values
    .map(normalizeType)
    .filter(Boolean)
}

export function getVenueMarkerEmoji(input?: string | string[] | null): string {
  const normalizedTypes = toTypeArray(input)

  for (const rule of TYPE_EMOJI_RULES) {
    if (rule.types.some((type) => normalizedTypes.includes(normalizeType(type)))) {
      return rule.emoji
    }
  }

  return '📍'
}