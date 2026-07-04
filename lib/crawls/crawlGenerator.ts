// lib/crawls/crawlGenerator.ts
import type { Venue } from '@/types/venue'
import { DateTime } from 'luxon'

import {
  sequencedStagesForNow,
  fallbackFlowFromStage,
} from '@/utils/stageUtils'

import { isVenueOpenNow, daypartAllowedAtTime } from '@/utils/timeUtils'

import { venueMatchesAnyType, getVenueTypes } from '@/lib/venues/typeMatching'

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

type CrawlTheme = 'dateNight' | 'nightOut' | 'morningFlow' | 'soloExplorer'

type MealBucket = 'breakfast' | 'lunch' | 'dinner' | null

type CrawlGenerationOpts = {
  durationHours?: number
  latestEndHour?: number
  theme?: CrawlTheme
  stageIndex?: number
  previousVenue?: Venue | null
  discouragedVenueIds?: Set<string>
  stronglyDiscouragedVenueIds?: Set<string>
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

const LUNCH_LIKE_TYPES = ['lunch', 'restaurant']
const DINNER_LIKE_TYPES = ['dinner', 'restaurant', 'kitchen']

const MEAL_INTENT_TYPES = [
  ...BREAKFAST_LIKE_TYPES,
  ...LUNCH_LIKE_TYPES,
  ...DINNER_LIKE_TYPES,
]

/* ------------------------------------------------ */
/* Stage Type Exclusions                            */
/* ------------------------------------------------ */

const STAGE_TYPE_EXCLUSIONS: Record<string, string[]> = {
  club: ['coffee', 'bakery', 'dessert', 'cafe'],
  bar: ['coffee', 'bakery', 'dessert'],
  cocktail: ['coffee', 'bakery', 'dessert'],
}

/* ------------------------------------------------ */
/* Canonical Roam Day Flow                          */
/* ------------------------------------------------ */

const DEFAULT_DAY_TRAJECTORY: readonly (readonly string[])[] = [
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

const THEME_STAGE_FLOWS: Record<CrawlTheme, readonly (readonly string[])[]> = {
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
    ['breakfast', 'brunch', 'coffee', 'cafe', 'café', 'bakery'],
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
  { vibes: string[]; tags: string[] }
> = {
  dateNight: {
    vibes: ['romantic', 'intimate', 'moody', 'sultry', 'cozy'],
    tags: ['wine', 'dessert', 'cocktail'],
  },

  nightOut: {
    vibes: ['lively', 'energetic', 'social', 'dj', 'beer', 'weekend'],
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
    vibes: ['calm', 'peaceful', 'fresh'],
    tags: ['coffee', 'bakery', 'yoga', 'tea'],
  },

  soloExplorer: {
    vibes: ['cozy', 'quiet', 'introspective', 'exhibit'],
    tags: ['bookstore', 'gallery', 'cafe', 'café'],
  },
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function normalizeStringList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(/[,;/|]/g))
      .map((item) => item.trim().toLowerCase())
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

function venueMatchesTags(venue: Venue, tags: string[]) {
  const venueTags = normalizeStringList(venue.tags)
  return tags.some((tag) => venueTags.includes(tag.toLowerCase()))
}

function venueMatchesVibe(venue: Venue, vibes: string[]) {
  const venueVibes = normalizeStringList(venue.vibe)
  return vibes.some((vibe) => venueVibes.includes(vibe.toLowerCase()))
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3

  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180

  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function getHour(now: DateTime) {
  return now.hour + now.minute / 60
}

function isWeekend(now: DateTime) {
  return now.weekday === 6 || now.weekday === 7
}

function hasAnyType(types: string[], candidates: string[]) {
  return candidates.some((candidate) => types.includes(candidate))
}

function getMatchedStageType(venue: Venue, stageTypes: readonly string[]) {
  const venueTypes = getVenueTypes(venue)

  for (const stageType of stageTypes) {
    if (venueTypes.includes(stageType)) {
      return stageType
    }
  }

  return venueTypes[0] ?? null
}

function isLunchLikeType(value: string | null) {
  if (!value) return false
  return LUNCH_LIKE_TYPES.includes(value.toLowerCase())
}

function isEarlyDayMealType(value: string | null) {
  if (!value) return false
  return BREAKFAST_LIKE_TYPES.includes(value.toLowerCase())
}

function inferMealBucketFromTypes(types: string[], now: DateTime): MealBucket {
  const hour = getHour(now)

  if (hasAnyType(types, ['breakfast'])) return 'breakfast'

  if (hasAnyType(types, ['brunch'])) {
    return isWeekend(now) || hour < 14 ? 'breakfast' : 'lunch'
  }

  if (hasAnyType(types, ['coffee', 'cafe', 'café', 'bakery'])) {
    return hour < 14 ? 'breakfast' : null
  }

  if (hasAnyType(types, ['lunch'])) return 'lunch'
  if (hasAnyType(types, ['dinner'])) return 'dinner'

  if (hasAnyType(types, ['restaurant', 'kitchen'])) {
    if (hour < 11) return 'breakfast'
    if (hour < 16.5) return 'lunch'
    return 'dinner'
  }

  return null
}

function stageHasMealIntent(stageTypes: readonly string[]) {
  return stageTypes.some((type) => MEAL_INTENT_TYPES.includes(type.toLowerCase()))
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
  const bucket = inferMealBucketFromTypes(getVenueTypes(venue), now)
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
  const matchedType = getMatchedStageType(venue, stageTypes)

  const alreadyHadLunch = previousMatchedTypes.some(isLunchLikeType)
  const stageCanBeDinner = stageTypes.some((type) =>
    DINNER_LIKE_TYPES.includes(type.toLowerCase())
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
  const stageIndex = opts?.stageIndex ?? 0

  if (stageIndex > 1) return false

  const stronglyDiscouraged =
    opts?.stronglyDiscouragedVenueIds?.has(venueId) ?? false
  const discouraged = opts?.discouragedVenueIds?.has(venueId) ?? false

  if (stageIndex === 0) return stronglyDiscouraged || discouraged
  if (stageIndex === 1) return stronglyDiscouraged || discouraged

  return false
}

/* ------------------------------------------------ */
/* Contextual Scoring                               */
/* ------------------------------------------------ */

function scoreDistanceFit(distance: number) {
  if (distance < MIN_VENUE_DISTANCE_METERS) return -100
  if (distance >= IDEAL_WALK_MIN_METERS && distance <= IDEAL_WALK_MAX_METERS) {
    return 10
  }
  if (distance < IDEAL_WALK_MIN_METERS) return 3
  if (distance <= SOFT_WALK_MAX_METERS) return 2
  if (distance <= HARD_INTERSTOP_MAX_METERS) return -8
  return -35
}

function scoreThemeTimeFit(theme: CrawlTheme | undefined, now: DateTime) {
  if (!theme) return 0

  const hour = getHour(now)

  if (theme === 'morningFlow') {
    if (hour >= 6 && hour <= 11.5) return 16
    if (hour <= 13) return 6
    return -30
  }

  if (theme === 'dateNight') {
    if (hour >= 17 && hour <= 22.5) return 16
    if (hour >= 15.5 && hour < 17) return 4
    return -22
  }

  if (theme === 'nightOut') {
    if (hour >= 18 || hour <= 2) return 18
    if (hour >= 16.5) return 5
    return -26
  }

  if (theme === 'soloExplorer') {
    if (hour >= 9 && hour <= 18.5) return 12
    if (hour > 18.5 && hour <= 21) return 2
    return -10
  }

  return 0
}

function scoreStageTimeFit(stageTypes: readonly string[], now: DateTime) {
  const hour = getHour(now)
  const types = stageTypes.map((type) => type.toLowerCase())
  let score = 0

  if (hasAnyType(types, ['coffee', 'cafe', 'café', 'bakery', 'breakfast'])) {
    if (hour >= 6 && hour < 11.5) score += 14
    else if (hour < 14) score += 4
    else score -= 18
  }

  if (hasAnyType(types, ['brunch'])) {
    if (isWeekend(now) && hour >= 9 && hour <= 14) score += 12
    else if (hour >= 10 && hour <= 13) score += 4
    else score -= 12
  }

  if (hasAnyType(types, ['lunch'])) {
    if (hour >= 11 && hour <= 15.5) score += 12
    else if (hour >= 10 && hour <= 17) score += 3
    else score -= 10
  }

  if (hasAnyType(types, ['dinner', 'restaurant'])) {
    if (hour >= 17 && hour <= 22) score += 12
    else if (hour >= 15.5 && hour < 17) score -= 4
    else score -= 16
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
    if (hour >= 17 || hour <= 2) score += 14
    else if (hour >= 14) score += 2
    else score -= 20
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
    if (hour >= 10 && hour <= 18.5) score += 10
    else score -= 8
  }

  if (hasAnyType(types, ['fitness', 'yoga', 'pilates', 'spa', 'wellness'])) {
    if (hour >= 6 && hour <= 12.5) score += 12
    else if (hour <= 15) score += 3
    else score -= 14
  }

  return score
}

function scoreSequenceCoherence(
  previousVenue: Venue | null | undefined,
  candidate: Venue
) {
  if (!previousVenue) return 0

  const previousTypes = getVenueTypes(previousVenue)
  const candidateTypes = getVenueTypes(candidate)

  let score = 0

  const previousCoffee = hasAnyType(previousTypes, [
    'coffee',
    'cafe',
    'café',
    'bakery',
    'breakfast',
  ])
  const candidateCoffee = hasAnyType(candidateTypes, [
    'coffee',
    'cafe',
    'café',
    'bakery',
    'breakfast',
  ])

  const previousMeal = hasAnyType(previousTypes, [
    'lunch',
    'dinner',
    'restaurant',
    'brunch',
  ])
  const candidateMeal = hasAnyType(candidateTypes, [
    'lunch',
    'dinner',
    'restaurant',
    'brunch',
  ])

  const previousDrink = hasAnyType(previousTypes, [
    'bar',
    'cocktail',
    'wine bar',
    'lounge',
    'brewery',
    'speakeasy',
  ])
  const candidateDrink = hasAnyType(candidateTypes, [
    'bar',
    'cocktail',
    'wine bar',
    'lounge',
    'brewery',
    'speakeasy',
  ])

  const previousBrowse = hasAnyType(previousTypes, [
    'gallery',
    'museum',
    'bookstore',
    'lifestyle',
    'park',
    'garden',
  ])
  const candidateBrowse = hasAnyType(candidateTypes, [
    'gallery',
    'museum',
    'bookstore',
    'lifestyle',
    'park',
    'garden',
  ])

  if (previousCoffee && candidateMeal) score += 10
  if (previousMeal && candidateDrink) score += 10
  if (previousDrink && candidateDrink) score += 4
  if (previousBrowse && candidateCoffee) score += 4
  if (previousCoffee && candidateBrowse) score += 6

  if (previousCoffee && candidateCoffee) score -= 22
  if (previousMeal && candidateCoffee) score -= 20
  if (previousMeal && candidateMeal) score -= 18
  if (previousBrowse && candidateBrowse) score -= 4

  return score
}

function hasAbsurdTimeMismatch(venue: Venue, now: DateTime) {
  const hour = getHour(now)
  const types = getVenueTypes(venue)

  const isMorningOnly = hasAnyType(types, ['breakfast', 'bakery'])
  const isCoffeeLike = hasAnyType(types, ['coffee', 'cafe', 'café', 'tea'])
  const isDinnerOnly =
    hasAnyType(types, ['dinner']) &&
    !hasAnyType(types, ['bar', 'cocktail', 'wine bar', 'lounge'])
  const isNightlifeLike = hasAnyType(types, [
    'club',
    'speakeasy',
    'late night',
  ])

  if (isMorningOnly && hour >= 12.5) return true
  if (isCoffeeLike && hour >= 18.5) return true
  if (isDinnerOnly && hour < 16.5) return true
  if (isNightlifeLike && hour >= 6 && hour < 17) return true

  return false
}

/* ------------------------------------------------ */
/* Venue Stage Matching                             */
/* ------------------------------------------------ */

function filterStageCandidates(
  venues: Venue[],
  stageTypes: readonly string[],
  now: DateTime
) {
  return venues.filter((v) => {
    if (!venueMatchesAnyType(v, stageTypes)) return false
    if (!isVenueOpenNow(v, now)) return false
    if (hasAbsurdTimeMismatch(v, now)) return false

    return true
  })
}

/* ------------------------------------------------ */
/* Venue Scoring                                    */
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

  const types = getVenueTypes(venue)

  if (types.some((t) => stageTypes.includes(t))) {
    score += 18
  }

  if (venue.energyRamp) {
    score += venue.energyRamp * 0.35
  }

  if (daypartAllowedAtTime(venue, now)) {
    score += 8
  } else {
    score -= 10
  }

  score += scoreStageTimeFit(stageTypes, now)
  score += scoreThemeTimeFit(theme, now)
  score += scoreSequenceCoherence(opts.previousVenue, venue)

  if (
    typeof originLat === 'number' &&
    typeof originLon === 'number' &&
    Number.isFinite(originLat) &&
    Number.isFinite(originLon)
  ) {
    const distance = distanceMeters(originLat, originLon, venue.lat, venue.lon)
    score += scoreDistanceFit(distance)
  }

  if (theme) {
    const signals = CRAWL_THEME_SIGNALS[theme]

    if (venueMatchesTags(venue, signals.tags)) score += 10
    if (venueMatchesVibe(venue, signals.vibes)) score += 14
  }

  return score
}

/* ------------------------------------------------ */
/* Venue Selector                                   */
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
  let candidates = filterStageCandidates(venues, stageTypes, now).filter(
    (v) => !usedIds.has(v.id)
  )

  let usedFallbackTypes = false

  if (candidates.length === 0) {
    const fallbackTypes = stageTypes.flatMap((t) => fallbackFlowFromStage(t))

    candidates = filterStageCandidates(venues, fallbackTypes, now).filter(
      (v) => !usedIds.has(v.id)
    )

    usedFallbackTypes = true
  }

  if (candidates.length === 0) return null

  const scored = candidates
    .map((v) => {
      const dist = distanceMeters(originLat, originLon, v.lat, v.lon)

      return {
        venue: v,
        distance: dist,
        score:
          scoreVenue(v, stageTypes, now, opts?.theme, opts, originLat, originLon) -
          (usedFallbackTypes ? 6 : 0),
      }
    })
    .sort((a, b) => {
      const scoreDelta = b.score - a.score
      if (Math.abs(scoreDelta) > 0.001) return scoreDelta

      return a.distance - b.distance
    })

  const selectionPasses = [
    { enforceDistinctOpeners: true, relaxedDistance: false },
    { enforceDistinctOpeners: false, relaxedDistance: false },
    { enforceDistinctOpeners: false, relaxedDistance: true },
  ]

  for (const pass of selectionPasses) {
    for (const entry of scored) {
      const v = entry.venue
      const venueTypes = getVenueTypes(v)
      const stage = stageTypes[0]

      if (STAGE_TYPE_EXCLUSIONS[stage]?.some((t) => venueTypes.includes(t))) {
        continue
      }

      if (
        pass.enforceDistinctOpeners &&
        shouldSkipForThemeDistinctness(v.id, opts)
      ) {
        continue
      }

      if (entry.distance < MIN_VENUE_DISTANCE_METERS) continue

      if (!pass.relaxedDistance && entry.distance > HARD_INTERSTOP_MAX_METERS) {
        continue
      }

      if (
        stageHasMealIntent(stageTypes) &&
        shouldRejectDuplicateMealBucket({
          venue: v,
          now,
          usedMealBuckets,
        })
      ) {
        continue
      }

      const typeKey = venueTypes[0] ?? 'unknown'

      if ((usedTypes[typeKey] ?? 0) >= 2) continue

      usedTypes[typeKey] = (usedTypes[typeKey] ?? 0) + 1

      const mealBucket = inferMealBucketFromTypes(venueTypes, now)
      if (mealBucket) {
        usedMealBuckets.add(mealBucket)
      }

      return v
    }
  }

  return null
}

/* ------------------------------------------------ */
/* Stage Plan Resolver                              */
/* ------------------------------------------------ */

function resolveStagePlan(
  now: DateTime,
  opts: {
    durationHours?: number
    latestEndHour?: number
    theme?: CrawlTheme
  }
) {
  if (opts?.theme && THEME_STAGE_FLOWS[opts.theme]) {
    return THEME_STAGE_FLOWS[opts.theme]
  }

  const sequenced = sequencedStagesForNow(now.toJSDate(), opts)

  if (sequenced?.length) return sequenced

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
  const stagePlan = resolveStagePlan(now, opts).slice(0, MAX_STAGES)

  const usedIds = new Set<string>()
  const usedTypes: Record<string, number> = {}
  const usedMealBuckets = new Set<MealBucket>()

  const stages: CrawlStageResult[] = []
  const selectedVenues: Venue[] = []

  let currentLat = originLat
  let currentLon = originLon
  let previousVenue: Venue | null = null

  for (let stageIndex = 0; stageIndex < stagePlan.length; stageIndex++) {
    const stageTypes = stagePlan[stageIndex]

    const venue = selectVenueForStage(
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

    if (!venue) continue

    usedIds.add(venue.id)

    const previousMatchedTypes = stages
      .map((stage) => stage.matchedType)
      .filter((value): value is string => Boolean(value))

    const matchedType = resolveContextualMatchedType({
      venue,
      stageTypes,
      previousMatchedTypes,
    })

    stages.push({
      stageTypes,
      venue,
      matchedType,
    })

    selectedVenues.push(venue)

    currentLat = venue.lat
    currentLon = venue.lon
    previousVenue = venue
  }

  if (selectedVenues.length < 1) return null

  return {
    venues: selectedVenues,
    stages,
  }
}

/* ------------------------------------------------ */
/* Multi Crawl Generator                            */
/* ------------------------------------------------ */

export function generatePropertyCrawls(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime
): ThemedCrawlResult[] {
  const crawls: ThemedCrawlResult[] = []

  const themes: CrawlTheme[] = [
    'dateNight',
    'nightOut',
    'morningFlow',
    'soloExplorer',
  ]

  let referenceDateNight: CrawlResult | null = null

  for (const theme of themes) {
    const crawlOpts: CrawlGenerationOpts = { theme }

    if (theme === 'nightOut' && referenceDateNight) {
      const dateNightFirstStop = referenceDateNight.venues[0]?.id
      const dateNightOpeningStops = referenceDateNight.venues
        .slice(0, 2)
        .map((venue) => venue.id)

      crawlOpts.stronglyDiscouragedVenueIds = new Set(
        dateNightFirstStop ? [dateNightFirstStop] : []
      )

      crawlOpts.discouragedVenueIds = new Set(dateNightOpeningStops)
    }

    const crawl = generateCrawl(venues, originLat, originLon, now, crawlOpts)

    if (crawl) {
      crawls.push({ theme, crawl })

      if (theme === 'dateNight') {
        referenceDateNight = crawl
      }
    }
  }

  return crawls.sort((a, b) => {
    const aScore = scoreThemeTimeFit(a.theme, now)
    const bScore = scoreThemeTimeFit(b.theme, now)

    return bScore - aScore
  })
}

export {}