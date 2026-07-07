// lib/routes/routeStages.ts

export type RouteStageId =
  | 'early_coffee'
  | 'morning_movement'
  | 'breakfast_brunch'
  | 'morning_culture'
  | 'midday_lifestyle'
  | 'lunch'
  | 'afternoon_explore'
  | 'early_evening'
  | 'dinner'
  | 'night_out'

export type RouteStageIntensity = 'low' | 'medium' | 'high'

export type RouteStage = {
  id: RouteStageId
  order: number
  label: string
  shortLabel: string
  description: string
  types: string[]
  preferredStartHour: number
  preferredEndHour: number
  dwellMinutes: number
  intensity: RouteStageIntensity
  maxRepeats?: number
}

export const ROUTE_STAGES: RouteStage[] = [
  {
    id: 'early_coffee',
    order: 1,
    label: 'Coffee / Bakery',
    shortLabel: 'Coffee',
    description: 'A light first stop for coffee, tea, pastry, or an easy neighborhood start.',
    types: ['coffee', 'cafe', 'bakery', 'tea', 'juice_bar', 'smoothie'],
    preferredStartHour: 7,
    preferredEndHour: 11,
    dwellMinutes: 35,
    intensity: 'low',
  },
  {
    id: 'morning_movement',
    order: 2,
    label: 'Movement / Wellness',
    shortLabel: 'Wellness',
    description: 'Fitness, yoga, pilates, spa, wellness, or light movement before the day opens up.',
    types: ['fitness', 'yoga', 'pilates', 'spa', 'wellness', 'walk', 'nature'],
    preferredStartHour: 7,
    preferredEndHour: 12,
    dwellMinutes: 60,
    intensity: 'medium',
  },
  {
    id: 'breakfast_brunch',
    order: 3,
    label: 'Breakfast / Brunch',
    shortLabel: 'Brunch',
    description: 'A proper morning or late-morning food stop.',
    types: ['breakfast', 'brunch', 'market', 'food_court'],
    preferredStartHour: 8,
    preferredEndHour: 14,
    dwellMinutes: 75,
    intensity: 'medium',
  },
  {
    id: 'morning_culture',
    order: 4,
    label: 'Morning Culture',
    shortLabel: 'Culture',
    description: 'Bookstores, galleries, museums, gardens, parks, and easy cultural stops.',
    types: ['park', 'garden', 'bookstore', 'bookshop', 'library', 'gallery', 'museum'],
    preferredStartHour: 10,
    preferredEndHour: 16,
    dwellMinutes: 50,
    intensity: 'low',
  },
  {
    id: 'midday_lifestyle',
    order: 5,
    label: 'Lifestyle / Hidden Gem',
    shortLabel: 'Lifestyle',
    description: 'A flexible discovery stop for shopping, design, showroom, lifestyle, or random gems.',
    types: ['lifestyle', 'showroom', 'random_gem', 'market', 'workspace'],
    preferredStartHour: 11,
    preferredEndHour: 18,
    dwellMinutes: 45,
    intensity: 'low',
  },
  {
    id: 'lunch',
    order: 6,
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'A midday meal anchor.',
    types: ['lunch', 'restaurant', 'bistro', 'bistrot', 'cafe', 'café'],
    preferredStartHour: 11,
    preferredEndHour: 15,
    dwellMinutes: 75,
    intensity: 'medium',
  },
  {
    id: 'afternoon_explore',
    order: 7,
    label: 'Afternoon Explore',
    shortLabel: 'Explore',
    description: 'An afternoon stop that keeps the route moving without forcing another meal too soon.',
    types: [
      'park',
      'garden',
      'bookstore',
      'bookshop',
      'library',
      'gallery',
      'museum',
      'activity',
      'class',
      'theater',
      'cinema',
      'show',
      'comedy',
      'lifestyle',
      'random_gem',
    ],
    preferredStartHour: 12,
    preferredEndHour: 18,
    dwellMinutes: 55,
    intensity: 'medium',
  },
  {
    id: 'early_evening',
    order: 8,
    label: 'Early Evening',
    shortLabel: 'Drinks',
    description: 'Cocktail, wine, rooftop, patio, lounge, happy hour, or a transitional pre-dinner stop.',
    types: [
      'cocktail',
      'cocktails',
      'wine_bar',
      'wine bar',
      'rooftop',
      'patio',
      'lounge',
      'happy_hour',
      'happy hour',
      'brewery',
      'pub',
    ],
    preferredStartHour: 16,
    preferredEndHour: 20,
    dwellMinutes: 60,
    intensity: 'medium',
  },
  {
    id: 'dinner',
    order: 9,
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'A primary evening meal stop.',
    types: ['dinner', 'restaurant', 'bistro', 'bistrot'],
    preferredStartHour: 17,
    preferredEndHour: 22,
    dwellMinutes: 90,
    intensity: 'medium',
  },
  {
    id: 'night_out',
    order: 10,
    label: 'Night Out',
    shortLabel: 'Night',
    description: 'Bars, lounges, clubs, speakeasies, music, late-night, and after-dark energy.',
    types: [
      'bar',
      'sports_bar',
      'sports bar',
      'cocktail',
      'cocktails',
      'speakeasy',
      'lounge',
      'club',
      'music',
      'live_music',
      'live music',
      'dj',
      'late_night',
      'late night',
      'late-night',
      'event_venue',
      'event venue',
      'event_space',
      'event space',
      'stadium',
    ],
    preferredStartHour: 19,
    preferredEndHour: 2,
    dwellMinutes: 75,
    intensity: 'high',
  },
]

export const DEFAULT_ROUTE_STAGE_COUNT = 5

export function getRouteStageById(stageId: RouteStageId) {
  return ROUTE_STAGES.find((stage) => stage.id === stageId) ?? null
}

export function getRouteStageByOrder(order: number) {
  return ROUTE_STAGES.find((stage) => stage.order === order) ?? null
}

export function getRouteStageForHour(hour: number) {
  const normalizedHour = normalizeHour(hour)

  return (
    ROUTE_STAGES.find((stage) =>
      isHourWithinStageWindow(normalizedHour, stage)
    ) ?? ROUTE_STAGES[0]
  )
}

export function getCandidateStagesAfter({
  stageId,
  maxStages = DEFAULT_ROUTE_STAGE_COUNT,
  includeCurrentStage = false,
}: {
  stageId: RouteStageId
  maxStages?: number
  includeCurrentStage?: boolean
}) {
  const currentStage = getRouteStageById(stageId)

  if (!currentStage) {
    return ROUTE_STAGES.slice(0, maxStages)
  }

  return ROUTE_STAGES
    .filter((stage) =>
      includeCurrentStage
        ? stage.order >= currentStage.order
        : stage.order > currentStage.order
    )
    .slice(0, maxStages)
}

export function getStagesForHourWindow({
  startHour,
  endHour,
}: {
  startHour: number
  endHour: number
}) {
  const normalizedStart = normalizeHour(startHour)
  const normalizedEnd = normalizeHour(endHour)

  return ROUTE_STAGES.filter((stage) =>
    hoursOverlap({
      aStart: stage.preferredStartHour,
      aEnd: stage.preferredEndHour,
      bStart: normalizedStart,
      bEnd: normalizedEnd,
    })
  )
}

export function isHourWithinStageWindow(hour: number, stage: RouteStage) {
  const normalizedHour = normalizeHour(hour)
  const start = normalizeHour(stage.preferredStartHour)
  const end = normalizeHour(stage.preferredEndHour)

  if (start <= end) {
    return normalizedHour >= start && normalizedHour < end
  }

  return normalizedHour >= start || normalizedHour < end
}

export function getStageTypeSet(stage: RouteStage) {
  return new Set(stage.types.map(normalizeStageType))
}

export function normalizeStageType(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll('-', '-')
    .replaceAll('&', 'and')
    .replace(/[\s-]+/g, '_')
}

function normalizeHour(hour: number) {
  if (!Number.isFinite(hour)) return 0

  const rounded = Math.floor(hour)
  return ((rounded % 24) + 24) % 24
}

function hoursOverlap({
  aStart,
  aEnd,
  bStart,
  bEnd,
}: {
  aStart: number
  aEnd: number
  bStart: number
  bEnd: number
}) {
  const aHours = expandHourWindow(aStart, aEnd)
  const bHours = new Set(expandHourWindow(bStart, bEnd))

  return aHours.some((hour) => bHours.has(hour))
}

function expandHourWindow(startHour: number, endHour: number) {
  const start = normalizeHour(startHour)
  const end = normalizeHour(endHour)

  const hours: number[] = []
  let cursor = start

  while (true) {
    hours.push(cursor)

    cursor = normalizeHour(cursor + 1)

    if (cursor === end) break

    if (hours.length >= 24) break
  }

  return hours
}