export type CrawlStopVM = {
  id: string
  order: number
  venueId: string
  venueName: string
  venueHref: string
  description: string | null
  stageLabel: string
  typeLabel: string | null
  walkTimeFromPreviousLabel: string | null
  distanceFromPreviousMeters: number | null
  isAnchor: boolean
}

export type CrawlVM = {
  id: string
  theme: string
  title: string
  subtitle: string
  chips: string[]
  ctaLabel: string
  href?: string
  stops: CrawlStopVM[]
  totalStopsLabel: string
  estimatedDurationMinutes: number | null
  estimatedDurationLabel: string | null
  totalWalkMinutes: number | null
  totalWalkLabel: string | null
  bestTimeLabel: string | null
}

export type CrawlVenueLike = {
  id?: string | null
  name?: string | null
  link?: string | null
  description?: string | null
}

export type CrawlStopLike = {
  venue?: CrawlVenueLike | null
  matchedType?: string | null
  desiredType?: string | null
  stageType?: string | null
  label?: string | null
  distanceFromPreviousMeters?: number | string | null
  isAnchor?: boolean | null
}

export type CrawlLike = {
  id?: string | null
  theme?: string | null
  title?: string | null
  href?: string | null
  stops?: CrawlStopLike[] | null
  venueIds?: string[] | null
  stopCount?: number | null
  metadata?: {
    estimatedDurationMinutes?: number | null
    bestTimeLabel?: string | null
  } | null
}

export type BuildCrawlVMOptions = {
  fallbackPerStopMinutes?: number
  fallbackTransitionMinutes?: number
  titleOverrides?: Partial<Record<string, string>>
  subtitleOverrides?: Partial<Record<string, string>>
}

const DEFAULT_PER_STOP_MINUTES = 45
const DEFAULT_TRANSITION_MINUTES = 8

const DEFAULT_TITLE_BY_THEME: Record<string, string> = {
  dateNight: 'Date Night',
  nightOut: 'Night Out',
  morningFlow: 'Easy Morning',
  soloExplorer: 'Solo Explore',
}

const DEFAULT_SUBTITLE_BY_THEME: Record<string, string> = {
  dateNight:
    'A polished sequence for drinks, dinner, and an easy final stop.',
  nightOut:
    'Start casual, build energy, and end somewhere lively nearby.',
  morningFlow:
    'Coffee, a light reset, and an easy local flow to start the day.',
  soloExplorer:
    'A flexible local route for browsing, coffee, and a good solo stop.',
}

export function buildCrawlVM(
  crawl: CrawlLike,
  options: BuildCrawlVMOptions = {}
): CrawlVM {
  const fallbackPerStopMinutes =
    options.fallbackPerStopMinutes ?? DEFAULT_PER_STOP_MINUTES
  const fallbackTransitionMinutes =
    options.fallbackTransitionMinutes ?? DEFAULT_TRANSITION_MINUTES

  const theme = normalizeTheme(crawl.theme)
  const rawStops = Array.isArray(crawl.stops) ? crawl.stops : []

  const stops = rawStops.map((stop, index) => buildStopVM(stop, index))
  const totalWalkMinutes = sumEstimatedWalkMinutes(rawStops)

  const estimatedDurationMinutes =
    positiveIntOrNull(crawl.metadata?.estimatedDurationMinutes) ??
    estimateDurationMinutes(
      rawStops.length,
      fallbackPerStopMinutes,
      fallbackTransitionMinutes,
      totalWalkMinutes
    )

  const estimatedDurationLabel =
    estimatedDurationMinutes !== null
      ? formatDurationLabel(estimatedDurationMinutes)
      : null

  const totalWalkLabel =
    totalWalkMinutes > 0 ? `~${totalWalkMinutes} min walking` : null

  const bestTimeLabel =
    cleanText(crawl.metadata?.bestTimeLabel) ||
    inferBestTimeLabel(theme, rawStops)

  const title =
    cleanText(crawl.title) ||
    options.titleOverrides?.[theme] ||
    DEFAULT_TITLE_BY_THEME[theme] ||
    fallbackTitleFromTheme(theme)

  const subtitle =
    options.subtitleOverrides?.[theme] ||
    DEFAULT_SUBTITLE_BY_THEME[theme] ||
    buildSubtitleFromTheme(theme, rawStops.length)

  const chips = buildChips({
    stopCount: rawStops.length,
    estimatedDurationLabel,
    totalWalkLabel,
    bestTimeLabel,
  })

  return {
    id: cleanText(crawl.id) || `${theme}-${rawStops.length}-stops`,
    theme,
    title,
    subtitle,
    chips,
    ctaLabel: 'View Route',
    href: cleanText(crawl.href) || undefined,
    stops,
    totalStopsLabel: formatStopCountLabel(rawStops.length),
    estimatedDurationMinutes,
    estimatedDurationLabel,
    totalWalkMinutes: totalWalkMinutes > 0 ? totalWalkMinutes : null,
    totalWalkLabel,
    bestTimeLabel,
  }
}

export function buildCrawlVMs(
  crawls: CrawlLike[],
  options: BuildCrawlVMOptions = {}
): CrawlVM[] {
  return crawls.map((crawl) => buildCrawlVM(crawl, options))
}

function buildStopVM(stop: CrawlStopLike, index: number): CrawlStopVM {
  const distanceFromPreviousMeters = toNumberOrNull(stop.distanceFromPreviousMeters)
  const venueId = String(stop.venue?.id ?? '')
  const venueName = cleanText(stop.venue?.name) || 'Unknown venue'
  const matchedType = cleanText(stop.matchedType)
  const desiredType = cleanText(stop.desiredType)
  const stageType = cleanText(stop.stageType)
  const rawType = matchedType || desiredType || stageType

  return {
    id: venueId ? `${venueId}-${index + 1}` : `crawl-stop-${index + 1}`,
    order: index + 1,
    venueId,
    venueName,
    venueHref: cleanText(stop.venue?.link) || (venueId ? `/venue-profile/${venueId}` : '#'),
    description: cleanDescription(stop.venue?.description),
    stageLabel: humanizeStageLabel({
      matchedType,
      desiredType,
      stageType,
      label: cleanText(stop.label),
      index,
    }),
    typeLabel: rawType ? humanizeTypeLabel(rawType) : null,
    walkTimeFromPreviousLabel:
      index === 0 ? null : formatWalkTimeLabel(distanceFromPreviousMeters),
    distanceFromPreviousMeters,
    isAnchor: Boolean(stop.isAnchor),
  }
}

function buildChips({
  stopCount,
  estimatedDurationLabel,
  totalWalkLabel,
  bestTimeLabel,
}: {
  stopCount: number
  estimatedDurationLabel: string | null
  totalWalkLabel: string | null
  bestTimeLabel: string | null
}) {
  const chips: string[] = []

  chips.push(formatStopCountLabel(stopCount))

  if (estimatedDurationLabel) {
    chips.push(estimatedDurationLabel)
  }

  if (totalWalkLabel) {
    chips.push(totalWalkLabel)
  }

  if (bestTimeLabel) {
    chips.push(bestTimeLabel)
  }

  return chips.slice(0, 4)
}

function normalizeTheme(theme: string | null | undefined) {
  const normalized = String(theme ?? '').trim()

  if (!normalized) return 'custom'

  const compact = normalized.replace(/[\s_-]+/g, '').toLowerCase()

  if (compact === 'datenight') return 'dateNight'
  if (compact === 'nightout') return 'nightOut'
  if (compact === 'morningflow') return 'morningFlow'
  if (compact === 'soloexplorer') return 'soloExplorer'

  return normalized
}

function humanizeStageLabel({
  matchedType,
  desiredType,
  stageType,
  label,
  index,
}: {
  matchedType: string | null
  desiredType: string | null
  stageType: string | null
  label: string | null
  index: number
}) {
  if (label) return label

  const value = (matchedType || desiredType || stageType || '').toLowerCase()

  if (!value) {
    return index === 0 ? 'Start' : 'Next stop'
  }

  if (matchesAny(value, ['coffee', 'cafe', 'café', 'bakery'])) {
    return index === 0 ? 'Coffee start' : 'Coffee stop'
  }

  if (matchesAny(value, ['restaurant', 'dinner', 'kitchen'])) {
    return 'Dinner'
  }

  if (matchesAny(value, ['bar', 'wine bar', 'cocktail', 'pub', 'brewery'])) {
    return index === 0 ? 'Drinks start' : 'Drinks'
  }

  if (matchesAny(value, ['gallery', 'museum', 'shop', 'retail', 'lifestyle'])) {
    return 'Browse'
  }

  if (matchesAny(value, ['fitness', 'yoga', 'spa', 'wellness'])) {
    return 'Reset'
  }

  if (matchesAny(value, ['dessert', 'ice cream'])) {
    return 'Sweet stop'
  }

  return sentenceCase(value)
}

function humanizeTypeLabel(type: string) {
  const value = type.trim().toLowerCase()

  if (value === 'wine bar') return 'Wine bar'
  if (value === 'cocktail') return 'Cocktail bar'
  if (value === 'cafe' || value === 'café') return 'Cafe'
  if (value === 'restaurant') return 'Restaurant'
  if (value === 'lifestyle') return 'Lifestyle'
  if (value === 'fitness') return 'Fitness'

  return sentenceCase(value)
}

function inferBestTimeLabel(theme: string, stops: CrawlStopLike[]) {
  if (theme === 'morningFlow') return 'Best in the morning'
  if (theme === 'dateNight') return 'Best after 6 PM'
  if (theme === 'nightOut') return 'Best later in the evening'
  if (theme === 'soloExplorer') return 'Good anytime'

  const types = stops
    .map((stop) =>
      cleanText(stop.matchedType || stop.desiredType || stop.stageType)?.toLowerCase()
    )
    .filter((value): value is string => Boolean(value))

  if (types.some((value) => matchesAny(value, ['coffee', 'cafe', 'café', 'bakery']))) {
    return 'Best earlier in the day'
  }

  if (
    types.some((value) =>
      matchesAny(value, ['bar', 'wine bar', 'cocktail', 'pub', 'brewery'])
    )
  ) {
    return 'Best after 6 PM'
  }

  return null
}

function buildSubtitleFromTheme(theme: string, stopCount: number) {
  if (theme === 'dateNight') {
    return 'A polished route for dinner, drinks, and an easy close.'
  }

  if (theme === 'nightOut') {
    return 'A livelier sequence that builds naturally through the evening.'
  }

  if (theme === 'morningFlow') {
    return 'An easy nearby flow for coffee, a stroll, and a light reset.'
  }

  if (theme === 'soloExplorer') {
    return 'A flexible solo route with strong local picks close by.'
  }

  if (stopCount <= 1) {
    return 'A quick nearby stop to get you out the door fast.'
  }

  return 'A nearby route that strings together the best next stops.'
}

function fallbackTitleFromTheme(theme: string) {
  if (!theme || theme === 'custom') return 'Nearby Route'
  return sentenceCase(theme.replace(/([a-z])([A-Z])/g, '$1 $2'))
}

function estimateDurationMinutes(
  stopCount: number,
  fallbackPerStopMinutes: number,
  fallbackTransitionMinutes: number,
  totalWalkMinutes: number
) {
  if (stopCount <= 0) return null

  const dwellMinutes = stopCount * fallbackPerStopMinutes
  const transitionCount = Math.max(stopCount - 1, 0)
  const overheadMinutes = transitionCount * fallbackTransitionMinutes

  return dwellMinutes + overheadMinutes + totalWalkMinutes
}

function sumEstimatedWalkMinutes(stops: CrawlStopLike[]) {
  return stops.reduce((sum, stop, index) => {
    if (index === 0) return sum

    const distance = toNumberOrNull(stop.distanceFromPreviousMeters)
    if (distance === null) return sum

    return sum + estimateWalkMinutes(distance)
  }, 0)
}

function formatDurationLabel(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null

  if (minutes < 60) {
    return `~${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (remainder === 0 || remainder < 15) {
    return `~${hours} hr`
  }

  return `~${hours} hr ${remainder} min`
}

function formatStopCountLabel(stopCount: number) {
  if (stopCount <= 0) return 'Direct route'
  if (stopCount === 1) return '1 stop'
  return `${stopCount} stops`
}

function formatWalkTimeLabel(distanceFromPreviousMeters: number | null) {
  if (distanceFromPreviousMeters === null || distanceFromPreviousMeters <= 0) {
    return null
  }

  const minutes = estimateWalkMinutes(distanceFromPreviousMeters)

  if (minutes <= 1) return '1 min walk'
  return `${minutes} min walk`
}

function estimateWalkMinutes(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0

  const rawMinutes = distanceMeters / 80
  return Math.max(1, Math.round(rawMinutes))
}

function positiveIntOrNull(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.round(value)
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function cleanText(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanDescription(value: string | null | undefined) {
  const trimmed = cleanText(value)
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function matchesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value === candidate)
}

function sentenceCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}