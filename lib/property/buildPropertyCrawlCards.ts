import type { DateTime } from 'luxon'

import {
  generatePropertyCrawls,
  type ThemedCrawlResult,
} from '@/lib/crawls/crawlGenerator'
import {
  buildCrawlVM,
  type CrawlVM,
} from '@/lib/view-models/buildCrawlVM'

/* ------------------------------------------------ */
/* Public types                                     */
/* ------------------------------------------------ */

export type PropertyCrawlVenue = {
  id: string
  name: string
  lat: number
  lon: number
  city?: string | null
  slug?: string
  cover?: string | null
  type?: string | string[] | null
  description?: string | null
  link: string
  label?: string | null
  [key: string]: unknown
}

export type PropertyCrawlVenueSource = {
  id: string
  name: string
  lat: number | string
  lon: number | string
  city?: string | null
  slug?: string | null
  cover?: string | null
  type?: string | string[] | null
  description?: string | null
  link?: string | null
  label?: string | null
  [key: string]: unknown
}

export type PropertyCrawlOrigin = {
  id: string
  lat: number
  lon: number
  city: string
  slug: string
}

export type PropertyCrawlCard = {
  id: string
  theme: string
  crawl: ThemedCrawlResult['crawl']
  vm: CrawlVM
}

export type BuildPropertyCrawlCardsParams = {
  nearbyVenues: PropertyCrawlVenue[]
  property: PropertyCrawlOrigin
  now: DateTime
  allCityVenueById: Map<string, PropertyCrawlVenue>
  dbCityVenueById: Map<string, PropertyCrawlVenueSource>
}

/* ------------------------------------------------ */
/* Theme ranking                                    */
/* ------------------------------------------------ */

const THEME_RANK: Record<string, number> = {
  morningFlow: 0,
  soloExplorer: 1,
  dateNight: 2,
  nightOut: 3,
}

/* ------------------------------------------------ */
/* Public builder                                   */
/* ------------------------------------------------ */

export function buildPropertyCrawlCards({
  nearbyVenues,
  property,
  now,
  allCityVenueById,
  dbCityVenueById,
}: BuildPropertyCrawlCardsParams): PropertyCrawlCard[] {
  if (!isValidOrigin(property)) {
    return []
  }

  const validNearbyVenues = nearbyVenues.filter(isValidVenue)

  if (validNearbyVenues.length === 0) {
    return []
  }

  const generatedCrawls = generatePropertyCrawls(
    validNearbyVenues as any,
    property.lat,
    property.lon,
    now
  )

  const validCrawls: ThemedCrawlResult[] = (
    generatedCrawls ?? []
  ).filter(
    (entry): entry is ThemedCrawlResult =>
      Boolean(
        entry &&
          entry.crawl &&
          Array.isArray(entry.crawl.venues)
      )
  )

  const titleOverrides = getTitleOverrides(now)
  const subtitleOverrides = getSubtitleOverrides(now)

  return validCrawls
    .map((entry, index) => {
      const bestTimeLabel = getBestTimeLabelForTheme(
        entry.theme,
        now
      )

      const hydratedVenues = hydrateCrawlVenues({
        venues: entry.crawl.venues ?? [],
        allCityVenueById,
        dbCityVenueById,
      })

      const hydratedCrawl: ThemedCrawlResult['crawl'] = {
        ...entry.crawl,
        venues: hydratedVenues,
      }

      const vm = buildCrawlVM(
        {
          id: `${entry.theme}-${index}`,
          theme: entry.theme,
          stops: hydratedVenues.map((venue, stopIndex) => ({
            venue: {
              id: venue.id,
              name: venue.name,
              link: `/venue-profile/${venue.id}`,
              description:
                getOptionalDescription(venue),
            },
            matchedType:
              hydratedCrawl.stages?.[stopIndex]?.matchedType ??
              null,
            desiredType:
              hydratedCrawl.stages?.[stopIndex]?.stageTypes?.[0] ??
              null,
            stageType:
              hydratedCrawl.stages?.[stopIndex]?.stageTypes?.[0] ??
              null,
            distanceFromPreviousMeters:
              getDistanceFromPreviousMeters({
                property,
                venues: hydratedVenues,
                stopIndex,
              }),
            isAnchor:
              stopIndex === hydratedVenues.length - 1,
          })),
          metadata: {
            bestTimeLabel,
          },
        },
        {
          titleOverrides,
          subtitleOverrides,
        }
      )

      return {
        id: vm.id,
        theme: entry.theme,
        crawl: hydratedCrawl,
        vm,
      }
    })
    .sort((a, b) => {
      const aContextScore = getThemeContextScore(
        a.theme,
        now
      )
      const bContextScore = getThemeContextScore(
        b.theme,
        now
      )

      if (aContextScore !== bContextScore) {
        return aContextScore - bContextScore
      }

      const aRank = THEME_RANK[a.theme] ?? 999
      const bRank = THEME_RANK[b.theme] ?? 999

      return aRank - bRank
    })
}

/* ------------------------------------------------ */
/* Crawl venue hydration                            */
/* ------------------------------------------------ */

function hydrateCrawlVenues({
  venues,
  allCityVenueById,
  dbCityVenueById,
}: {
  venues: ThemedCrawlResult['crawl']['venues']
  allCityVenueById: Map<string, PropertyCrawlVenue>
  dbCityVenueById: Map<string, PropertyCrawlVenueSource>
}): ThemedCrawlResult['crawl']['venues'] {
  return (venues ?? []).map((venue) => {
    const canonicalVenue = allCityVenueById.get(venue.id)
    const dbVenue = dbCityVenueById.get(venue.id)

    const hydratedType =
      canonicalVenue?.type ??
      dbVenue?.type ??
      venue.type ??
      undefined

    const description = firstNonEmptyText(
      dbVenue?.description,
      canonicalVenue?.description,
      getOptionalDescription(venue)
    )

    const hydratedCover =
      canonicalVenue?.cover ??
      dbVenue?.cover ??
      venue.cover ??
      undefined

    return {
      ...venue,
      ...canonicalVenue,
      type:
        hydratedType === null
          ? undefined
          : hydratedType,
      cover:
        hydratedCover === null
          ? undefined
          : hydratedCover,
      slug:
        canonicalVenue?.slug ??
        dbVenue?.slug ??
        venue.slug ??
        undefined,
      link: `/venue-profile/${venue.id}`,
      description,
    }
  }) as ThemedCrawlResult['crawl']['venues']
}

/* ------------------------------------------------ */
/* Distance calculations                            */
/* ------------------------------------------------ */

function getDistanceFromPreviousMeters({
  property,
  venues,
  stopIndex,
}: {
  property: {
    lat: number
    lon: number
  }
  venues: Array<{
    lat: number
    lon: number
  }>
  stopIndex: number
}) {
  const current = venues[stopIndex]

  if (!current) {
    return null
  }

  const previous =
    stopIndex === 0
      ? property
      : venues[stopIndex - 1]

  if (!previous) {
    return null
  }

  if (
    !isFiniteCoordinate(current.lat) ||
    !isFiniteCoordinate(current.lon) ||
    !isFiniteCoordinate(previous.lat) ||
    !isFiniteCoordinate(previous.lon)
  ) {
    return null
  }

  return distanceMeters(
    previous.lat,
    previous.lon,
    current.lat,
    current.lon
  )
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMeters = 6_371_000

  const latitude1 = degreesToRadians(lat1)
  const latitude2 = degreesToRadians(lat2)
  const latitudeDelta = degreesToRadians(lat2 - lat1)
  const longitudeDelta = degreesToRadians(lon2 - lon1)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )

  return Math.round(
    earthRadiusMeters * angularDistance
  )
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

/* ------------------------------------------------ */
/* Context-aware theme copy                         */
/* ------------------------------------------------ */

function getBestTimeLabelForTheme(
  theme: string,
  now: DateTime
) {
  const hour = getDecimalHour(now)

  if (theme === 'morningFlow') {
    return hour < 12
      ? 'Best right now'
      : 'Best tomorrow morning'
  }

  if (theme === 'soloExplorer') {
    if (hour >= 10 && hour < 17) {
      return 'Good right now'
    }

    if (hour < 10) {
      return 'Best late morning'
    }

    return 'Best tomorrow daytime'
  }

  if (theme === 'dateNight') {
    if (hour >= 17 && hour < 21.5) {
      return 'Best tonight'
    }

    if (hour < 17) {
      return 'Best after 6 PM'
    }

    return 'Best tomorrow night'
  }

  if (theme === 'nightOut') {
    if (hour >= 19 && hour <= 23.5) {
      return 'Best tonight'
    }

    if (hour < 19) {
      return 'Best later tonight'
    }

    return 'Best tomorrow night'
  }

  return null
}

function getThemeContextScore(
  theme: string,
  now: DateTime
) {
  const hour = getDecimalHour(now)

  if (theme === 'morningFlow') {
    if (hour >= 6 && hour < 11.5) {
      return 0
    }

    if (hour >= 11.5 && hour < 15) {
      return 4
    }

    return 20
  }

  if (theme === 'soloExplorer') {
    if (hour >= 9 && hour < 18) {
      return 0
    }

    if (hour >= 18 && hour < 21) {
      return 5
    }

    return 14
  }

  if (theme === 'dateNight') {
    if (hour >= 16.5 && hour < 21.5) {
      return 0
    }

    if (hour >= 12 && hour < 16.5) {
      return 6
    }

    return 12
  }

  if (theme === 'nightOut') {
    if (hour >= 18.5 && hour <= 23.5) {
      return 0
    }

    if (hour >= 15 && hour < 18.5) {
      return 7
    }

    return 16
  }

  return 99
}

function getTitleOverrides(
  now: DateTime
): Partial<Record<string, string>> {
  const hour = getDecimalHour(now)

  return {
    morningFlow:
      hour < 12
        ? 'This Morning Flow'
        : 'Tomorrow Morning Reset',

    soloExplorer:
      hour >= 10 && hour < 17
        ? 'Explore Near Here Now'
        : 'Easy Local Explore',

    dateNight:
      hour >= 16.5
        ? 'Tonight’s Date Night Flow'
        : 'Date Night Near Here',

    nightOut:
      hour >= 18.5
        ? 'Tonight’s Night Out Flow'
        : 'Night Out Near Here',
  }
}

function getSubtitleOverrides(
  now: DateTime
): Partial<Record<string, string>> {
  const hour = getDecimalHour(now)

  return {
    morningFlow:
      hour < 12
        ? 'A timely nearby sequence for coffee, reset, and a clean start to the day.'
        : 'A low-friction morning plan to save for the next good start.',

    soloExplorer:
      hour >= 10 && hour < 17
        ? 'A daytime-friendly route for getting oriented without overcommitting.'
        : 'A flexible local route for browsing, coffee, and an easy solo stop.',

    dateNight:
      hour >= 16.5
        ? 'A dinner-and-drinks sequence that fits the current evening window.'
        : 'A polished nearby evening route for when you want the plan ready.',

    nightOut:
      hour >= 18.5
        ? 'A social route that builds energy while keeping the stops walkable.'
        : 'A higher-energy route to keep in your pocket for later tonight.',
  }
}

function getDecimalHour(now: DateTime) {
  return now.hour + now.minute / 60
}

/* ------------------------------------------------ */
/* Validation and normalization                     */
/* ------------------------------------------------ */

function isValidOrigin(
  property: PropertyCrawlOrigin
) {
  return (
    Boolean(property?.id) &&
    isFiniteCoordinate(property?.lat) &&
    isFiniteCoordinate(property?.lon)
  )
}

function isValidVenue(
  venue: PropertyCrawlVenue
) {
  return (
    Boolean(venue?.id) &&
    Boolean(venue?.name) &&
    isFiniteCoordinate(venue?.lat) &&
    isFiniteCoordinate(venue?.lon)
  )
}

function isFiniteCoordinate(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  )
}

function getOptionalDescription(
  value: unknown
) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('description' in value)
  ) {
    return null
  }

  return cleanText(
    (value as { description?: string | null })
      .description
  )
}

function firstNonEmptyText(
  ...values: Array<string | null | undefined>
) {
  for (const value of values) {
    const cleaned = cleanText(value)

    if (cleaned) {
      return cleaned
    }
  }

  return null
}

function cleanText(
  value: string | null | undefined
) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}