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
}

export function buildVenueCardVM(
  venue: VenueCardLike,
  options: BuildVenueCardVMOptions = {}
): VenueCardVM {
  const includeDistance = options.includeDistance ?? true
  const includeWalkTime = options.includeWalkTime ?? true
  const includeOpenNowLabel = options.includeOpenNowLabel ?? false
  const maxChips = options.maxChips ?? 3

  const distanceMeters =
    options.origin && isFiniteNumber(venue.lat) && isFiniteNumber(venue.lon)
      ? haversineDistanceMeters(
          options.origin.lat,
          options.origin.lon,
          Number(venue.lat),
          Number(venue.lon)
        )
      : null

  const walkTimeMinutes =
    includeWalkTime && distanceMeters !== null
      ? estimateWalkMinutes(distanceMeters)
      : null

  const primaryType = normalizePrimaryType(venue.type)
  const typeLabel = primaryType ? humanizeTypeLabel(primaryType) : null

  const vibeLabel =
    cleanText(venue.vibe) ||
    firstString(asStringArray(venue.vibes)) ||
    inferVibeFromTags(asStringArray(venue.tags))

  const bestForLabel =
    firstString(asStringArray(venue.bestFor)) ||
    firstString(asStringArray(venue.best_for)) ||
    inferBestForLabel({
      type: primaryType,
      tags: asStringArray(venue.tags),
      vibe: vibeLabel,
    })

  const isHostPick =
    Boolean(venue.label) ||
    Boolean(options.hostPickIds?.includes(venue.id))

  const hostPickLabel =
    cleanText(venue.label) || (isHostPick ? 'Host pick' : null)

  const openNowLabel = includeOpenNowLabel
    ? inferOpenNowLabel(venue.hours)
    : null

  const chips = buildChips(
    {
      distanceLabel: includeDistance ? formatDistanceLabel(distanceMeters) : null,
      walkTimeLabel: includeWalkTime ? formatWalkTimeLabel(walkTimeMinutes) : null,
      typeLabel,
      vibeLabel,
      bestForLabel,
      openNowLabel,
      hostPickLabel: isHostPick ? hostPickLabel : null,
    },
    maxChips
  )

  return {
    id: venue.id,
    name: venue.name,
    href: cleanText(venue.link) || `/venue-profile/${venue.id}`,
    imageUrl: normalizeImageUrl(venue.cover),
    description: cleanDescription(venue.description),
    distanceMeters,
    distanceLabel: includeDistance ? formatDistanceLabel(distanceMeters) : null,
    walkTimeMinutes,
    walkTimeLabel: includeWalkTime ? formatWalkTimeLabel(walkTimeMinutes) : null,
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
  return venues.map((venue) => buildVenueCardVM(venue, options))
}

function normalizePrimaryType(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const cleaned = cleanText(item)
      if (cleaned) return cleaned
    }
    return null
  }

  return cleanText(value)
}

function buildChips(
  values: {
    distanceLabel: string | null
    walkTimeLabel: string | null
    typeLabel: string | null
    vibeLabel: string | null
    bestForLabel: string | null
    openNowLabel: string | null
    hostPickLabel: string | null
  },
  maxChips: number
) {
  const ordered = [
    values.hostPickLabel,
    values.openNowLabel,
    values.bestForLabel,
    values.vibeLabel,
    values.typeLabel,
    values.walkTimeLabel,
    values.distanceLabel,
  ]

  const deduped: string[] = []

  for (const value of ordered) {
    const cleaned = cleanText(value)
    if (!cleaned) continue
    if (deduped.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) {
      continue
    }
    deduped.push(cleaned)
    if (deduped.length >= maxChips) break
  }

  return deduped
}

function inferBestForLabel({
  type,
  tags,
  vibe,
}: {
  type: string | null
  tags: string[]
  vibe: string | null
}) {
  const normalizedType = (type || '').toLowerCase()
  const normalizedTags = tags.map((tag) => tag.toLowerCase())
  const normalizedVibe = (vibe || '').toLowerCase()

  if (
    matchesAny(normalizedType, ['coffee', 'cafe', 'café', 'bakery']) ||
    normalizedTags.some((tag) => matchesAny(tag, ['coffee', 'espresso', 'breakfast']))
  ) {
    return 'Good for coffee'
  }

  if (
    matchesAny(normalizedType, ['restaurant', 'dinner', 'kitchen']) ||
    normalizedTags.some((tag) => matchesAny(tag, ['dinner', 'food', 'meal']))
  ) {
    return 'Good for dinner'
  }

  if (
    matchesAny(normalizedType, ['bar', 'wine bar', 'cocktail', 'pub', 'brewery']) ||
    normalizedTags.some((tag) => matchesAny(tag, ['cocktails', 'drinks', 'bar']))
  ) {
    return 'Good for drinks'
  }

  if (
    matchesAny(normalizedType, ['fitness', 'yoga', 'spa', 'wellness']) ||
    normalizedTags.some((tag) => matchesAny(tag, ['wellness', 'reset', 'fitness']))
  ) {
    return 'Good for a reset'
  }

  if (
    normalizedVibe.includes('date') ||
    normalizedTags.some((tag) => matchesAny(tag, ['date night', 'romantic']))
  ) {
    return 'Good for date night'
  }

  if (
    normalizedTags.some((tag) => matchesAny(tag, ['group', 'friends', 'social'])) ||
    normalizedVibe.includes('lively')
  ) {
    return 'Good with friends'
  }

  return null
}

function inferVibeFromTags(tags: string[]) {
  const normalizedTags = tags.map((tag) => tag.toLowerCase())

  if (normalizedTags.some((tag) => matchesAny(tag, ['romantic', 'date night']))) {
    return 'Romantic'
  }

  if (normalizedTags.some((tag) => matchesAny(tag, ['lively', 'energetic', 'buzzing']))) {
    return 'Lively'
  }

  if (normalizedTags.some((tag) => matchesAny(tag, ['cozy', 'intimate', 'warm']))) {
    return 'Cozy'
  }

  if (normalizedTags.some((tag) => matchesAny(tag, ['casual', 'easygoing', 'laid-back']))) {
    return 'Casual'
  }

  if (normalizedTags.some((tag) => matchesAny(tag, ['upscale', 'elevated']))) {
    return 'Upscale'
  }

  return null
}

function inferOpenNowLabel(hours: unknown) {
  if (!hours) return null

  return 'Hours available'
}

function humanizeTypeLabel(type: string) {
  const value = type.trim().toLowerCase()

  if (value === 'wine bar') return 'Wine bar'
  if (value === 'cocktail') return 'Cocktail bar'
  if (value === 'cafe' || value === 'café') return 'Cafe'
  if (value === 'restaurant') return 'Restaurant'
  if (value === 'fitness') return 'Fitness'
  if (value === 'lifestyle') return 'Lifestyle'
  if (value === 'brewery') return 'Brewery'
  if (value === 'bakery') return 'Bakery'
  if (value === 'spa') return 'Spa'
  if (value === 'yoga') return 'Yoga'

  return sentenceCase(value)
}

function normalizeImageUrl(value: string | null | undefined) {
  const cleaned = cleanText(value)
  if (!cleaned) return null

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned
  }

  if (cleaned.startsWith('/')) {
    return cleaned
  }

  return `/${cleaned}`
}

function formatDistanceLabel(distanceMeters: number | null) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) return null

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m away`
  }

  const km = Math.round((distanceMeters / 1000) * 10) / 10
  return `${km} km away`
}

function formatWalkTimeLabel(walkTimeMinutes: number | null) {
  if (walkTimeMinutes === null || !Number.isFinite(walkTimeMinutes)) return null
  if (walkTimeMinutes <= 1) return '1 min walk'
  return `${walkTimeMinutes} min walk`
}

function estimateWalkMinutes(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0

  const rawMinutes = distanceMeters / 80
  return Math.max(1, Math.round(rawMinutes))
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

function asStringArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item))
  }

  const cleaned = cleanText(value)
  if (!cleaned) return []

  return cleaned
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstString(values: string[]) {
  return values.length > 0 ? values[0] : null
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}