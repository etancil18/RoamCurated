// lib/routes/routeUtils.ts

export type RouteTravelMode = 'walking' | 'cycling' | 'driving'

export type CoordinateLike = {
  lat?: number | null
  lon?: number | null
  lng?: number | null
}

export function hasValidCoordinates(value: CoordinateLike | null | undefined) {
  const lon = getLongitude(value)

  return (
    typeof value?.lat === 'number' &&
    Number.isFinite(value.lat) &&
    Math.abs(value.lat) <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    Math.abs(lon) <= 180
  )
}

export function getLongitude(value: CoordinateLike | null | undefined) {
  if (typeof value?.lon === 'number') return value.lon
  if (typeof value?.lng === 'number') return value.lng
  return null
}

export function calculateDistanceMeters({
  fromLat,
  fromLon,
  toLat,
  toLon,
}: {
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}) {
  const earthRadiusMeters = 6371000

  const fromLatRad = degreesToRadians(fromLat)
  const toLatRad = degreesToRadians(toLat)
  const deltaLatRad = degreesToRadians(toLat - fromLat)
  const deltaLonRad = degreesToRadians(toLon - fromLon)

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

export function distanceBetween(
  from: CoordinateLike | null | undefined,
  to: CoordinateLike | null | undefined
) {
  if (!from || !to) return null

  if (!hasValidCoordinates(from) || !hasValidCoordinates(to)) return null

  return calculateDistanceMeters({
    fromLat: from.lat as number,
    fromLon: getLongitude(from) as number,
    toLat: to.lat as number,
    toLon: getLongitude(to) as number,
  })
}

export function estimateTravelMinutes(
  distanceMeters: number,
  travelMode: RouteTravelMode = 'walking'
) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 1

  const metersPerMinute =
    travelMode === 'walking' ? 80 : travelMode === 'cycling' ? 240 : 500

  return Math.max(1, Math.round(distanceMeters / metersPerMinute))
}

export function dedupeById<T extends { id?: string | null; slug?: string | null }>(
  values: T[]
) {
  const seen = new Set<string>()

  return values.filter((value) => {
    const key = value.id ?? value.slug
    if (!key) return true
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export function sortByDistance<T extends CoordinateLike>(
  values: T[],
  origin: CoordinateLike
) {
  return [...values].sort((a, b) => {
    const aDistance = distanceBetween(origin, a)
    const bDistance = distanceBetween(origin, b)

    if (aDistance === null && bDistance === null) return 0
    if (aDistance === null) return 1
    if (bDistance === null) return -1

    return aDistance - bDistance
  })
}

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

export function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

export function normalizeString(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function normalizeSearchKey(value: unknown) {
  if (typeof value !== 'string') return ''

  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[–—-]/g, '-')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function extractStringList(value: unknown): string[] {
  if (!value) return []

  if (typeof value === 'string') {
    return value
      .split(/[,/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractStringList)
  }

  return []
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function shuffleWithinTier<T>(values: T[], seed = Date.now()) {
  const result = [...values]
  let currentIndex = result.length
  let randomSeed = seed

  while (currentIndex !== 0) {
    randomSeed = seededRandom(randomSeed)
    const randomIndex = Math.floor((randomSeed % 1) * currentIndex)
    currentIndex -= 1

    const temporaryValue = result[currentIndex]
    result[currentIndex] = result[randomIndex]
    result[randomIndex] = temporaryValue
  }

  return result
}

export function takeTop<T>(values: T[], count: number) {
  return values.slice(0, Math.max(0, count))
}

export function groupBy<T, K extends string | number>(
  values: T[],
  getKey: (value: T) => K
) {
  return values.reduce<Record<K, T[]>>(
    (acc, value) => {
      const key = getKey(value)
      acc[key] = acc[key] ?? []
      acc[key].push(value)
      return acc
    },
    {} as Record<K, T[]>
  )
}

export function addMinutes(date: Date | string, minutes: number) {
  const safeDate = coerceDate(date)
  const safeMinutes = Number.isFinite(minutes) ? Math.round(minutes) : 0

  return new Date(safeDate.getTime() + safeMinutes * 60 * 1000)
}

export function coerceDate(value: Date | string | null | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return new Date()
}

export function formatRouteDistance(distanceMeters: number | null | undefined) {
  if (!distanceMeters || !Number.isFinite(distanceMeters)) return null

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`
}

export function formatRouteMinutes(minutes: number | null | undefined) {
  if (!minutes || !Number.isFinite(minutes)) return null

  if (minutes < 60) return `${Math.round(minutes)} min`

  const hours = Math.floor(minutes / 60)
  const remainder = Math.round(minutes % 60)

  return remainder > 0 ? `${hours} hr ${remainder} min` : `${hours} hr`
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}