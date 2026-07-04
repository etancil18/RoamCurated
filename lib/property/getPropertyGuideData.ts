import { DateTime } from 'luxon'

import { createServerClient } from '@/lib/supabase/server'
import { CITY_CONFIGS } from '@/config/cities'
import { loadCityVenues } from '@/lib/venues/loadCityVenues'
import { venueMatchesAnyType } from '@/lib/venues/typeMatching'
import { generateEventJourney } from '@/lib/crawls/generateEventJourney'
import {
  generatePropertyCrawls,
  type ThemedCrawlResult,
} from '@/lib/crawls/crawlGenerator'
import {
  buildCrawlVM,
  type CrawlVM,
} from '@/lib/view-models/buildCrawlVM'

type PropertyRow = {
  id: string
  name: string
  slug: string
  city: string
  lat: number | string
  lon: number | string
  website?: string | null
  address?: string | null
  welcome_description?: string | null
  host_name?: string | null
  [key: string]: unknown
}

type VenueLike = {
  id: string
  name: string
  lat: number | string
  lon: number | string
  city?: string | null
  slug?: string | null
  cover?: string | null
  type?: string | string[] | null
  description?: string | null
  [key: string]: unknown
}

type PropertyFavoriteRow = {
  id: string
  label?: string | null
  description?: string | null
  priority?: number | null
  venues?: VenueLike | VenueLike[] | null
}

type EventJourneyRecord = {
  id: string
  city: string
  title: string
  slug: string
  event_id: string | null
  property_id: string | null
  event_name: string
  event_start_at: string
  event_end_at: string | null
  event_type: string | null
  destination_name: string
  destination_venue_id: string | null
  destination_lat: number | string | null
  destination_lon: number | string | null
  destination_kind: 'venue' | 'custom' | null
  destination_coordinates_source: 'venue' | 'manual' | null
  arrival_policy: 'by_start' | 'midpoint_deadline' | 'window' | 'custom' | null
  arrival_preference: 'early' | 'on_time' | 'fashionably_late' | 'late_ok' | null
  vibes: string[] | null
  tags: string[] | null
  ideal_stop_duration_minutes: number | null
  range_expansion_pct: number | null
  max_dynamic_stops: number | null
  status: string | null
  notes: string | null
  created_at?: string | null
  updated_at?: string | null
}

type EventJourneyStopRow = {
  id: string
  event_journey_id: string
  venue_id: string
  stop_order: number
  role: string
  is_locked: boolean
  created_at?: string | null
}

type EventJourneyPropertyLinkRow = {
  id: string
  event_journey_id: string
  property_id: string
  created_at?: string | null
}

type NearbyEventRow = Record<string, unknown>

export type NormalizedVenue = VenueLike & {
  lat: number
  lon: number
  slug?: string | undefined
  cover?: string | null
  link: string
  label?: string | null
}

type EventJourneyResult = NonNullable<ReturnType<typeof generateEventJourney>>

export type EventJourneyCard = {
  id: string
  title: string
  eventName: string
  eventStartAt: string
  eventEndAt?: string | null
  eventType?: string | null
  destinationName: string
  arrivalPolicy?: 'by_start' | 'midpoint_deadline' | 'window' | 'custom' | null
  arrivalPreference?: 'early' | 'on_time' | 'fashionably_late' | 'late_ok' | null
  status: string
  href?: string
  result: EventJourneyResult
}

export type PropertyCrawlCard = {
  id: string
  theme: string
  crawl: ThemedCrawlResult['crawl']
  vm: CrawlVM
}

export type PropertyGuideData = {
  city: string
  slug: string
  normalizedCity: string
  timezone: string
  nowForCity: DateTime
  property: (PropertyRow & { lat: number; lon: number }) | null
  favoriteVenues: NormalizedVenue[]
  cityVenues: VenueLike[]
  allCityVenues: NormalizedVenue[]
  nearbyVenues: NormalizedVenue[]
  coffeeNearby: NormalizedVenue[]
  barsNearby: NormalizedVenue[]
  dinnerNearby: NormalizedVenue[]
  wellnessNearby: NormalizedVenue[]
  mapVenues: NormalizedVenue[]
  nearbyEvents: NearbyEventRow[]
  eventJourneyCards: EventJourneyCard[]
  propertyCrawlCards: PropertyCrawlCard[]
}

type GetPropertyGuideDataParams = {
  city: string
  slug: string
}

const THEME_RANK: Record<string, number> = {
  morningFlow: 0,
  soloExplorer: 1,
  dateNight: 2,
  nightOut: 3,
}

function normalizeCityKey(input?: string | null) {
  const raw = (input ?? '').trim().toLowerCase()

  const aliases: Record<string, string> = {
    atl: 'atl',
    atlanta: 'atl',
    'atlanta ga': 'atl',

    nyc: 'nyc',
    'new york': 'nyc',
    'new york city': 'nyc',
    manhattan: 'nyc',

    la: 'la',
    'los angeles': 'la',
    'los-angeles': 'la',
    hollywood: 'la',
    'west hollywood': 'la',
    weho: 'la',
    venice: 'la',
    'santa monica': 'la',
    dtla: 'la',

    london: 'london',
    ldn: 'london',
    'greater london': 'london',
    shoreditch: 'london',
    camden: 'london',
    hackney: 'london',
    soho: 'london',
    chelsea: 'london',

    porto: 'porto',
    oporto: 'porto',

    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeVenue(v: VenueLike): NormalizedVenue {
  let cover = v.cover

  if (cover && !cover.startsWith('/')) {
    cover = '/' + cover
  }

  return {
    ...v,
    slug: v.slug ?? undefined,
    cover,
    lat: toNumber(v.lat),
    lon: toNumber(v.lon),
    link: `/venue-profile/${v.id}`,
  }
}

function normalizeProperty(
  p: PropertyRow
): PropertyRow & { lat: number; lon: number } {
  return {
    ...p,
    lat: toNumber(p.lat),
    lon: toNumber(p.lon),
  }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }

  return result
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

  return Math.round(R * c)
}

function getDistanceFromPreviousMeters({
  property,
  venues,
  stopIndex,
}: {
  property: { lat: number; lon: number }
  venues: Array<{ lat: number; lon: number }>
  stopIndex: number
}) {
  const current = venues[stopIndex]
  if (!current) return null

  const previous =
    stopIndex === 0
      ? property
      : venues[stopIndex - 1]

  if (!previous) return null

  return distanceMeters(previous.lat, previous.lon, current.lat, current.lon)
}

function getBestTimeLabelForTheme(theme: string, now: DateTime) {
  const hour = now.hour + now.minute / 60

  if (theme === 'morningFlow') {
    return hour < 12 ? 'Best right now' : 'Best tomorrow morning'
  }

  if (theme === 'soloExplorer') {
    if (hour >= 10 && hour < 17) return 'Good right now'
    if (hour < 10) return 'Best late morning'
    return 'Best tomorrow daytime'
  }

  if (theme === 'dateNight') {
    if (hour >= 17 && hour < 21.5) return 'Best tonight'
    if (hour < 17) return 'Best after 6 PM'
    return 'Best tomorrow night'
  }

  if (theme === 'nightOut') {
    if (hour >= 19 && hour <= 23.5) return 'Best tonight'
    if (hour < 19) return 'Best later tonight'
    return 'Best tomorrow night'
  }

  return null
}

function getThemeContextScore(theme: string, now: DateTime) {
  const hour = now.hour + now.minute / 60

  if (theme === 'morningFlow') {
    if (hour >= 6 && hour < 11.5) return 0
    if (hour >= 11.5 && hour < 15) return 4
    return 20
  }

  if (theme === 'soloExplorer') {
    if (hour >= 9 && hour < 18) return 0
    if (hour >= 18 && hour < 21) return 5
    return 14
  }

  if (theme === 'dateNight') {
    if (hour >= 16.5 && hour < 21.5) return 0
    if (hour >= 12 && hour < 16.5) return 6
    return 12
  }

  if (theme === 'nightOut') {
    if (hour >= 18.5 && hour <= 23.5) return 0
    if (hour >= 15 && hour < 18.5) return 7
    return 16
  }

  return 99
}

function getTitleOverrides(now: DateTime): Partial<Record<string, string>> {
  const hour = now.hour + now.minute / 60

  return {
    morningFlow:
      hour < 12 ? 'This Morning Flow' : 'Tomorrow Morning Reset',
    soloExplorer:
      hour >= 10 && hour < 17 ? 'Explore Near Here Now' : 'Easy Local Explore',
    dateNight:
      hour >= 16.5 ? 'Tonight’s Date Night Flow' : 'Date Night Near Here',
    nightOut:
      hour >= 18.5 ? 'Tonight’s Night Out Flow' : 'Night Out Near Here',
  }
}

function getSubtitleOverrides(now: DateTime): Partial<Record<string, string>> {
  const hour = now.hour + now.minute / 60

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

function isJourneyRelevantNow(
  journey: EventJourneyRecord,
  nowForCity: DateTime,
  timezone: string
) {
  const startAt = DateTime.fromISO(journey.event_start_at).setZone(timezone)
  if (!startAt.isValid) return false

  const endAt = journey.event_end_at
    ? DateTime.fromISO(journey.event_end_at).setZone(timezone)
    : null

  if (endAt?.isValid) {
    return endAt >= nowForCity
  }

  return startAt.endOf('day') >= nowForCity
}

function isJourneyAvailableToday(
  journey: EventJourneyRecord,
  nowForCity: DateTime,
  timezone: string
) {
  const startAt = DateTime.fromISO(journey.event_start_at).setZone(timezone)
  const endAt = journey.event_end_at
    ? DateTime.fromISO(journey.event_end_at).setZone(timezone)
    : null

  if (!startAt.isValid) return false

  if (endAt?.isValid) {
    return (
      nowForCity.hasSame(startAt, 'day') ||
      nowForCity.hasSame(endAt, 'day') ||
      (nowForCity >= startAt && nowForCity <= endAt)
    )
  }

  return nowForCity.hasSame(startAt, 'day')
}

function buildPropertyCrawlCards(
  nearbyVenues: NormalizedVenue[],
  property: { id: string; lat: number; lon: number; city: string; slug: string },
  now: DateTime,
  allCityVenueById: Map<string, NormalizedVenue>,
  dbCityVenueById: Map<string, VenueLike>
): PropertyCrawlCard[] {
  const generatedCrawls = generatePropertyCrawls(
    nearbyVenues as any,
    property.lat,
    property.lon,
    now
  )

  const validCrawls: ThemedCrawlResult[] = (generatedCrawls ?? []).filter(
    (entry): entry is ThemedCrawlResult =>
      Boolean(entry && entry.crawl && Array.isArray(entry.crawl.venues))
  )

  const titleOverrides = getTitleOverrides(now)
  const subtitleOverrides = getSubtitleOverrides(now)

  return validCrawls
    .map((entry, index) => {
      const bestTimeLabel = getBestTimeLabelForTheme(entry.theme, now)

      const hydratedVenues: ThemedCrawlResult['crawl']['venues'] = (
  entry.crawl.venues ?? []
).map((venue) => {
  const canonicalVenue = allCityVenueById.get(venue.id)
  const dbVenue = dbCityVenueById.get(venue.id)

  const hydratedType =
    canonicalVenue?.type ?? dbVenue?.type ?? venue.type ?? undefined

  const description =
    typeof dbVenue?.description === 'string' &&
    dbVenue.description.trim().length > 0
      ? dbVenue.description
      : typeof canonicalVenue?.description === 'string' &&
          canonicalVenue.description.trim().length > 0
        ? canonicalVenue.description
        : typeof (venue as { description?: string | null }).description ===
              'string' &&
            (venue as { description?: string | null }).description?.trim().length
          ? (venue as { description?: string | null }).description ?? null
          : null

  const hydratedCover =
    canonicalVenue?.cover ?? dbVenue?.cover ?? venue.cover ?? undefined

  return {
    ...venue,
    ...canonicalVenue,
    type: hydratedType === null ? undefined : hydratedType,
    cover: hydratedCover === null ? undefined : hydratedCover,
    slug: canonicalVenue?.slug ?? dbVenue?.slug ?? venue.slug ?? undefined,
    link: `/venue-profile/${venue.id}`,
    description,
  }
}) as ThemedCrawlResult['crawl']['venues']

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
                (venue as { description?: string | null }).description ?? null,
            },
            matchedType: hydratedCrawl.stages?.[stopIndex]?.matchedType ?? null,
            desiredType: hydratedCrawl.stages?.[stopIndex]?.stageTypes?.[0] ?? null,
            stageType: hydratedCrawl.stages?.[stopIndex]?.stageTypes?.[0] ?? null,
            distanceFromPreviousMeters: getDistanceFromPreviousMeters({
              property,
              venues: hydratedVenues as Array<{ lat: number; lon: number }>,
              stopIndex,
            }),
            isAnchor: stopIndex === hydratedVenues.length - 1,
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
      const aContextScore = getThemeContextScore(a.theme, now)
      const bContextScore = getThemeContextScore(b.theme, now)

      if (aContextScore !== bContextScore) {
        return aContextScore - bContextScore
      }

      const aRank = THEME_RANK[a.theme] ?? 999
      const bRank = THEME_RANK[b.theme] ?? 999
      return aRank - bRank
    })
}

function resolveJourneyDestination(
  journey: EventJourneyRecord,
  cityVenueById: Map<string, VenueLike>,
  allCityVenueById: Map<string, NormalizedVenue>
) {
  const explicitLat = toNumberOrNull(journey.destination_lat)
  const explicitLon = toNumberOrNull(journey.destination_lon)

  if (isFiniteCoordinate(explicitLat) && isFiniteCoordinate(explicitLon)) {
    return {
      name: journey.destination_name,
      lat: explicitLat,
      lon: explicitLon,
      venueId: journey.destination_venue_id,
    }
  }

  const destinationVenue =
    (journey.destination_venue_id
      ? allCityVenueById.get(journey.destination_venue_id) ??
        cityVenueById.get(journey.destination_venue_id)
      : null) ?? null

  if (destinationVenue) {
    const venueLat = toNumberOrNull(destinationVenue.lat)
    const venueLon = toNumberOrNull(destinationVenue.lon)

    if (isFiniteCoordinate(venueLat) && isFiniteCoordinate(venueLon)) {
      return {
        name: journey.destination_name || destinationVenue.name,
        lat: venueLat,
        lon: venueLon,
        venueId: journey.destination_venue_id,
      }
    }
  }

  return null
}

export async function getPropertyGuideData({
  city,
  slug,
}: GetPropertyGuideDataParams): Promise<PropertyGuideData> {
  const supabase = await createServerClient()
  const adminDb = supabase as any

  const normalizedCity = normalizeCityKey(city)
  const timezone =
    CITY_CONFIGS[normalizedCity]?.timezone ??
    CITY_CONFIGS[city]?.timezone ??
    'UTC'

  const nowForCity = DateTime.now().setZone(timezone)

  const { data: propertyData } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', slug)

  const matchedProperty =
    ((propertyData as PropertyRow[] | null) ?? []).find(
      (p) => normalizeCityKey(p.city) === normalizedCity
    ) ?? null

  const property = matchedProperty ? normalizeProperty(matchedProperty) : null

  if (!property) {
    return {
      city,
      slug,
      normalizedCity,
      timezone,
      nowForCity,
      property: null,
      favoriteVenues: [],
      cityVenues: [],
      allCityVenues: [],
      nearbyVenues: [],
      coffeeNearby: [],
      barsNearby: [],
      dinnerNearby: [],
      wellnessNearby: [],
      mapVenues: [],
      nearbyEvents: [],
      eventJourneyCards: [],
      propertyCrawlCards: [],
    }
  }

  const { data: favoritesData } = await supabase
    .from('property_favorites')
    .select(
      `
      id,
      label,
      description,
      priority,
      venues (
        id,
        name,
        description,
        lat,
        lon,
        city,
        slug,
        cover,
        type
      )
    `
    )
    .eq('property_id', property.id)
    .order('priority', { ascending: true })

  const favorites = (favoritesData as PropertyFavoriteRow[] | null) ?? []

  const favoriteVenues = favorites
    .map((favorite) => {
      const rawVenue = Array.isArray(favorite.venues)
        ? favorite.venues[0]
        : favorite.venues

      if (!rawVenue || !rawVenue.id) return null

      return normalizeVenue({
        ...rawVenue,
        label: favorite.label ?? null,
        description: favorite.description ?? null,
      })
    })
    .filter((venue): venue is NormalizedVenue => Boolean(venue))

  const { data: allVenuesData } = await supabase.from('venues').select('*')

  const cityVenues = ((allVenuesData as VenueLike[] | null) ?? []).filter(
    (v) => normalizeCityKey(v.city) === normalizedCity
  )

  const allCityVenues = (loadCityVenues(normalizedCity, cityVenues as any) ?? []).map(
    (venue) => normalizeVenue(venue as VenueLike)
  )

  const dbCityVenueById = new Map(cityVenues.map((venue) => [venue.id, venue]))
  const allCityVenueById = new Map(allCityVenues.map((venue) => [venue.id, venue]))

  const nearbyVenues = allCityVenues.filter((v) => {
    const latDiff = Math.abs(v.lat - property.lat)
    const lonDiff = Math.abs(v.lon - property.lon)
    return latDiff < 0.02 && lonDiff < 0.02
  })

  const coffeeNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v as any, ['coffee', 'cafe', 'café', 'bakery'])
  )

  const barsNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v as any, [
      'bar',
      'wine bar',
      'cocktail',
      'pub',
      'brewery',
    ])
  )

  const dinnerNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v as any, ['restaurant', 'dinner', 'kitchen'])
  )

  const wellnessNearby = nearbyVenues.filter((v) =>
    venueMatchesAnyType(v as any, ['fitness', 'yoga', 'spa'])
  )

  const mapVenues = uniqueById([...favoriteVenues, ...nearbyVenues]).slice(0, 40)

  const { data: nearbyEventsData } = await supabase.rpc('get_nearby_events', {
    property_lat: property.lat,
    property_lon: property.lon,
    radius_meters: 3000,
    limit_count: 25,
  })

  const nearbyEvents = (nearbyEventsData as NearbyEventRow[] | null) ?? []

  const propertyCrawlCards = buildPropertyCrawlCards(
  nearbyVenues,
  {
    id: property.id,
    lat: property.lat,
    lon: property.lon,
    city: property.city,
    slug: property.slug,
  },
  nowForCity,
  allCityVenueById,
  dbCityVenueById
)

  const sevenDaysFromNow = nowForCity.plus({ days: 7 }).toISO()

  const { data: candidateEventJourneysData } = await adminDb
    .from('event_journeys')
    .select('*')
    .eq('status', 'active')
    .lte('event_start_at', sevenDaysFromNow)
    .order('event_start_at', { ascending: true })

  const candidateEventJourneys = (
    (candidateEventJourneysData as EventJourneyRecord[] | null) ?? []
  ).filter(
    (journey) =>
      normalizeCityKey(journey.city) === normalizedCity &&
      isJourneyRelevantNow(journey, nowForCity, timezone)
  )

  let eventJourneys: EventJourneyRecord[] = []

  if (candidateEventJourneys.length > 0) {
    const candidateJourneyIds = candidateEventJourneys.map((journey) => journey.id)

    const { data: eventJourneyPropertyLinksData } = await adminDb
      .from('event_journey_properties')
      .select('*')
      .in('event_journey_id', candidateJourneyIds)

    const eventJourneyPropertyLinks =
      (eventJourneyPropertyLinksData as EventJourneyPropertyLinkRow[] | null) ?? []

    const linksByJourneyId = new Map<string, EventJourneyPropertyLinkRow[]>()

    eventJourneyPropertyLinks.forEach((link) => {
      const existing = linksByJourneyId.get(link.event_journey_id) ?? []
      existing.push(link)
      linksByJourneyId.set(link.event_journey_id, existing)
    })

    eventJourneys = candidateEventJourneys.filter((journey) => {
      const links = linksByJourneyId.get(journey.id) ?? []
      if (links.length === 0) return true
      return links.some((link) => link.property_id === property.id)
    })
  }

  let eventJourneyStops: EventJourneyStopRow[] = []

  if (eventJourneys.length > 0) {
    const eventJourneyIds = eventJourneys.map((journey) => journey.id)

    const { data: eventJourneyStopsData } = await adminDb
      .from('event_journey_stops')
      .select('*')
      .in('event_journey_id', eventJourneyIds)
      .order('stop_order', { ascending: true })

    eventJourneyStops = (eventJourneyStopsData as EventJourneyStopRow[] | null) ?? []
  }

  const eventJourneyCards: EventJourneyCard[] = []

  for (const journey of eventJourneys) {
    const resolvedDestination = resolveJourneyDestination(
      journey,
      dbCityVenueById,
      allCityVenueById
    )

    if (!resolvedDestination) {
      continue
    }

    const lockedStops = eventJourneyStops
      .filter((stop) => stop.event_journey_id === journey.id)
      .map((stop) => ({
        venueId: stop.venue_id,
        stopOrder: stop.stop_order,
        role: stop.role,
        isLocked: stop.is_locked,
      }))

    const result = generateEventJourney({
      property: {
        lat: property.lat,
        lon: property.lon,
        city: normalizeCityKey(property.city),
        name: property.name,
      },
      destination: resolvedDestination,
      eventStartAtISO: journey.event_start_at,
      eventEndAtISO: journey.event_end_at ?? undefined,
      eventType: journey.event_type ?? undefined,
      arrivalPolicy: journey.arrival_policy ?? undefined,
      arrivalPreference: journey.arrival_preference ?? undefined,
      venues: allCityVenues as any,
      now: nowForCity,
      signals: {
        vibes: journey.vibes,
        tags: journey.tags,
      },
      lockedStops,
      idealStopDurationMinutes: journey.ideal_stop_duration_minutes ?? 120,
      rangeExpansionPct: journey.range_expansion_pct ?? 0.3,
      maxDynamicStops: journey.max_dynamic_stops ?? 3,
    })

    if (!result) continue

    const hydratedResult: EventJourneyResult = {
      ...result,
      stops: result.stops.map((stop) => {
        const dbVenue = dbCityVenueById.get(stop.venue.id)

        return {
          ...stop,
          venue: {
            ...stop.venue,
            city: normalizeCityKey(
              (dbVenue?.city as string | null | undefined) ?? stop.venue.city
            ),
            description:
              typeof dbVenue?.description === 'string' ? dbVenue.description : null,
          },
        }
      }),
    }

    const canStartToday = isJourneyAvailableToday(journey, nowForCity, timezone)
    const stopIds = hydratedResult.stops.map((stop) => stop.venue.id).join(',')

    const href = canStartToday
      ? `/property/event-route?city=${encodeURIComponent(
          city
        )}&venues=${encodeURIComponent(
          stopIds
        )}&property_id=${encodeURIComponent(
          property.id
        )}&property_slug=${encodeURIComponent(
          property.slug
        )}&destination_name=${encodeURIComponent(
          resolvedDestination.name
        )}&destination_lat=${encodeURIComponent(
          String(resolvedDestination.lat)
        )}&destination_lon=${encodeURIComponent(
          String(resolvedDestination.lon)
        )}&event_name=${encodeURIComponent(
          journey.event_name
        )}&event_start_at=${encodeURIComponent(
          journey.event_start_at
        )}&event_end_at=${encodeURIComponent(
          journey.event_end_at ?? ''
        )}&route_title=${encodeURIComponent(
          journey.title
        )}&route_style=${encodeURIComponent(
          hydratedResult.routeStyle ?? ''
        )}&recommended_start_at=${encodeURIComponent(
          hydratedResult.recommendedStartAtISO ?? ''
        )}&recommended_arrival_at=${encodeURIComponent(
          hydratedResult.recommendedArrivalAtISO ?? ''
        )}&arrival_buffer_minutes=${encodeURIComponent(
          String(hydratedResult.arrivalBufferMinutes ?? '')
        )}&arrival_policy=${encodeURIComponent(
          journey.arrival_policy ?? ''
        )}&arrival_preference=${encodeURIComponent(
          journey.arrival_preference ?? ''
        )}&selection_reason_summary=${encodeURIComponent(
          hydratedResult.selectionReasonSummary ?? ''
        )}`
      : undefined

    eventJourneyCards.push({
      id: journey.id,
      title: journey.title,
      eventName: journey.event_name,
      eventStartAt: journey.event_start_at,
      eventEndAt: journey.event_end_at,
      eventType: journey.event_type,
      destinationName: resolvedDestination.name,
      arrivalPolicy: journey.arrival_policy,
      arrivalPreference: journey.arrival_preference,
      status: canStartToday ? 'route available today' : 'available day of event',
      result: hydratedResult,
      href,
    })
  }

  return {
    city,
    slug,
    normalizedCity,
    timezone,
    nowForCity,
    property,
    favoriteVenues,
    cityVenues,
    allCityVenues,
    nearbyVenues,
    coffeeNearby,
    barsNearby,
    dinnerNearby,
    wellnessNearby,
    mapVenues,
    nearbyEvents,
    eventJourneyCards,
    propertyCrawlCards,
  }
}