export type GroupableProfileVisit = {
  id: string
  venueId: string
  venueName: string
  city: string
  visitedAt: string
  localDate?: string
  localTime?: string
  rating?: number | null
  lat?: number | null
  lon?: number | null
  geoVerified?: boolean
  checkInSource?: string
  distanceMeters?: number | null
  locationAccuracyMeters?: number | null
}

export type GroupedProfileVisit<
  TVisit extends GroupableProfileVisit = GroupableProfileVisit,
> = TVisit & {
  city: string
  localDate: string
  localTime: string
}

export type VisitDayGroup<
  TVisit extends GroupableProfileVisit = GroupableProfileVisit,
> = {
  date: string
  label: string
  visitCount: number
  canCreateSticker: boolean
  stickerEligibleVisitCount: number
  visits: GroupedProfileVisit<TVisit>[]
}

export type VisitCityGroup<
  TVisit extends GroupableProfileVisit = GroupableProfileVisit,
> = {
  city: string
  visitCount: number
  latestVisitAt: string | null
  days: VisitDayGroup<TVisit>[]
}

export type GroupVisitsOptions = {
  timeZone?: string
  unknownCityLabel?: string
  minimumStickerVisits?: number
}

const DEFAULT_TIME_ZONE = 'UTC'
const DEFAULT_UNKNOWN_CITY_LABEL = 'Other'
const DEFAULT_MINIMUM_STICKER_VISITS = 2

export function groupVisitsByCityAndDay<
  TVisit extends GroupableProfileVisit,
>(
  visits: TVisit[],
  options: GroupVisitsOptions = {}
): VisitCityGroup<TVisit>[] {
  const timeZone = normalizeTimeZone(
    options.timeZone ?? DEFAULT_TIME_ZONE
  )

  const unknownCityLabel =
    normalizeOptionalString(options.unknownCityLabel) ??
    DEFAULT_UNKNOWN_CITY_LABEL

  const minimumStickerVisits = normalizeMinimumStickerVisits(
    options.minimumStickerVisits
  )

  const groupedCities = new Map<
    string,
    {
      city: string
      days: Map<string, GroupedProfileVisit<TVisit>[]>
    }
  >()

  for (const visit of visits) {
    if (!visit || !visit.id || !visit.venueId) {
      continue
    }

    const visitedAt = normalizeVisitedAt(visit.visitedAt)

    if (!visitedAt) {
      continue
    }

    const city = normalizeCityName(
      visit.city,
      unknownCityLabel
    )

    const localDate =
      normalizeDateValue(visit.localDate) ??
      formatLocalDate(visitedAt, timeZone)

    const localTime =
      normalizeOptionalString(visit.localTime) ??
      formatLocalTime(visitedAt, timeZone)

    const normalizedVisit: GroupedProfileVisit<TVisit> = {
      ...visit,
      city,
      visitedAt,
      localDate,
      localTime,
    }

    const cityKey = city.toLocaleLowerCase()

    const cityGroup =
      groupedCities.get(cityKey) ?? {
        city,
        days: new Map<
          string,
          GroupedProfileVisit<TVisit>[]
        >(),
      }

    const dayVisits =
      cityGroup.days.get(localDate) ?? []

    dayVisits.push(normalizedVisit)
    cityGroup.days.set(localDate, dayVisits)
    groupedCities.set(cityKey, cityGroup)
  }

  return [...groupedCities.values()]
    .map((cityGroup): VisitCityGroup<TVisit> => {
      const days = [...cityGroup.days.entries()]
        .map(([date, dayVisits]): VisitDayGroup<TVisit> => {
          const orderedVisits = [...dayVisits].sort(
            compareVisitsAscending
          )

          const stickerEligibleVisitCount =
            orderedVisits.filter(hasValidCoordinates).length

          return {
            date,
            label: formatDayLabel(date, timeZone),
            visitCount: orderedVisits.length,
            canCreateSticker:
              stickerEligibleVisitCount >=
              minimumStickerVisits,
            stickerEligibleVisitCount,
            visits: orderedVisits,
          }
        })
        .sort(compareDaysDescending)

      const latestVisitAt =
        days
          .flatMap((day) => day.visits)
          .sort(compareVisitsDescending)[0]
          ?.visitedAt ?? null

      return {
        city: cityGroup.city,
        visitCount: days.reduce(
          (sum, day) => sum + day.visitCount,
          0
        ),
        latestVisitAt,
        days,
      }
    })
    .sort(compareCitiesByLatestVisit)
}

export function getStickerEligibleVisits<
  TVisit extends GroupableProfileVisit,
>(
  visits: TVisit[]
): TVisit[] {
  return visits
    .filter(hasValidCoordinates)
    .sort(compareVisitsAscending)
}

export function hasValidVisitCoordinates(
  visit: Pick<
    GroupableProfileVisit,
    'lat' | 'lon'
  >
): boolean {
  return hasValidCoordinates(visit)
}

export function formatVisitLocalDate(
  visitedAt: string,
  timeZone = DEFAULT_TIME_ZONE
): string {
  const normalizedVisitedAt =
    normalizeVisitedAt(visitedAt)

  if (!normalizedVisitedAt) {
    return ''
  }

  return formatLocalDate(
    normalizedVisitedAt,
    normalizeTimeZone(timeZone)
  )
}

export function formatVisitLocalTime(
  visitedAt: string,
  timeZone = DEFAULT_TIME_ZONE
): string {
  const normalizedVisitedAt =
    normalizeVisitedAt(visitedAt)

  if (!normalizedVisitedAt) {
    return ''
  }

  return formatLocalTime(
    normalizedVisitedAt,
    normalizeTimeZone(timeZone)
  )
}

function compareVisitsAscending<
  TVisit extends GroupableProfileVisit,
>(
  a: TVisit,
  b: TVisit
): number {
  return (
    new Date(a.visitedAt).getTime() -
    new Date(b.visitedAt).getTime()
  )
}

function compareVisitsDescending<
  TVisit extends GroupableProfileVisit,
>(
  a: TVisit,
  b: TVisit
): number {
  return (
    new Date(b.visitedAt).getTime() -
    new Date(a.visitedAt).getTime()
  )
}

function compareDaysDescending<
  TVisit extends GroupableProfileVisit,
>(
  a: VisitDayGroup<TVisit>,
  b: VisitDayGroup<TVisit>
): number {
  return b.date.localeCompare(a.date)
}

function compareCitiesByLatestVisit<
  TVisit extends GroupableProfileVisit,
>(
  a: VisitCityGroup<TVisit>,
  b: VisitCityGroup<TVisit>
): number {
  const aTime = a.latestVisitAt
    ? new Date(a.latestVisitAt).getTime()
    : 0

  const bTime = b.latestVisitAt
    ? new Date(b.latestVisitAt).getTime()
    : 0

  if (aTime !== bTime) {
    return bTime - aTime
  }

  return a.city.localeCompare(b.city)
}

function hasValidCoordinates(
  visit: Pick<
    GroupableProfileVisit,
    'lat' | 'lon'
  >
): boolean {
  return (
    typeof visit.lat === 'number' &&
    Number.isFinite(visit.lat) &&
    visit.lat >= -90 &&
    visit.lat <= 90 &&
    typeof visit.lon === 'number' &&
    Number.isFinite(visit.lon) &&
    visit.lon >= -180 &&
    visit.lon <= 180
  )
}

function normalizeVisitedAt(
  value: string
): string | null {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function normalizeCityName(
  value: string | null | undefined,
  fallback: string
): string {
  const normalized = normalizeOptionalString(value)

  return normalized ?? fallback
}

function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function normalizeDateValue(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : null
}

function normalizeMinimumStickerVisits(
  value: number | undefined
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 2
  ) {
    return DEFAULT_MINIMUM_STICKER_VISITS
  }

  return value
}

function normalizeTimeZone(
  value: string
): string {
  const candidate =
    normalizeOptionalString(value) ??
    DEFAULT_TIME_ZONE

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: candidate,
    }).format(new Date())

    return candidate
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function formatLocalDate(
  value: string,
  timeZone: string
): string {
  const date = new Date(value)

  const parts = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).formatToParts(date)

  const year = parts.find(
    (part) => part.type === 'year'
  )?.value

  const month = parts.find(
    (part) => part.type === 'month'
  )?.value

  const day = parts.find(
    (part) => part.type === 'day'
  )?.value

  if (!year || !month || !day) {
    return value.slice(0, 10)
  }

  return `${year}-${month}-${day}`
}

function formatLocalTime(
  value: string,
  timeZone: string
): string {
  const date = new Date(value)

  return date.toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDayLabel(
  dateValue: string,
  timeZone: string
): string {
  const date = new Date(
    `${dateValue}T12:00:00.000Z`
  )

  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return date.toLocaleDateString('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}