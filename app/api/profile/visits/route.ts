import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import {
  formatVisitLocalDate,
  formatVisitLocalTime,
  groupVisitsByCityAndDay,
} from '@/lib/profile/groupVisitsByCityAndDay'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const DEFAULT_TIME_ZONE = 'UTC'

type VenueVisitRow = {
  id: string
  user_id: string
  venue_id: string
  rating: number | null
  visited_at: string
  created_at: string
  updated_at: string
  user_lat: number | null
  user_lon: number | null
  distance_meters: number | null
  location_accuracy_meters: number | null
  geo_verified: boolean
  check_in_source: string
  device_timestamp: string | null
}

type VenueRow = {
  id: string
  name: string
  city: string | null
  lat: number | null
  lon: number | null
}

type ProfileVisit = {
  id: string
  venueId: string
  venueName: string
  city: string
  visitedAt: string
  localDate: string
  localTime: string
  rating: number | null
  lat: number | null
  lon: number | null
  geoVerified: boolean
  checkInSource: string
  distanceMeters: number | null
  locationAccuracyMeters: number | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)

    const requestedCity = normalizeOptionalString(
      url.searchParams.get('city')
    )

    const requestedDate = normalizeDateFilter(
      url.searchParams.get('date')
    )

    const timeZone = normalizeTimeZone(
      url.searchParams.get('timezone')
    )

    const limit = normalizeLimit(
      url.searchParams.get('limit')
    )

    const { data: visitRows, error: visitsError } =
      await supabase
        .from('venue_visits')
        .select(`
          id,
          user_id,
          venue_id,
          rating,
          visited_at,
          created_at,
          updated_at,
          user_lat,
          user_lon,
          distance_meters,
          location_accuracy_meters,
          geo_verified,
          check_in_source,
          device_timestamp
        `)
        .eq('user_id', user.id)
        .order('visited_at', { ascending: false })
        .limit(limit)

    if (visitsError) {
      console.error(
        '[profile/visits][GET] Visit history fetch failed:',
        visitsError
      )

      return NextResponse.json(
        { error: 'Failed to load visit history.' },
        { status: 500 }
      )
    }

    const typedVisitRows =
      (visitRows ?? []) as VenueVisitRow[]

    if (typedVisitRows.length === 0) {
      return NextResponse.json(
        {
          cities: [],
          visits: [],
          totalVisits: 0,
          returnedVisits: 0,
          filters: {
            city: requestedCity,
            date: requestedDate,
            timezone: timeZone,
            limit,
          },
        },
        { status: 200 }
      )
    }

    const venueIds = [
      ...new Set(
        typedVisitRows
          .map((row) => row.venue_id)
          .filter(
            (venueId): venueId is string =>
              typeof venueId === 'string' &&
              venueId.trim().length > 0
          )
      ),
    ]

    if (venueIds.length === 0) {
      return NextResponse.json(
        {
          cities: [],
          visits: [],
          totalVisits: typedVisitRows.length,
          returnedVisits: 0,
          filters: {
            city: requestedCity,
            date: requestedDate,
            timezone: timeZone,
            limit,
          },
        },
        { status: 200 }
      )
    }

    const { data: venueRows, error: venuesError } =
      await supabase
        .from('venues')
        .select('id, name, city, lat, lon')
        .in('id', venueIds)

    if (venuesError) {
      console.error(
        '[profile/visits][GET] Venue details fetch failed:',
        venuesError
      )

      return NextResponse.json(
        { error: 'Failed to load venue details.' },
        { status: 500 }
      )
    }

    const venueMap = new Map<string, VenueRow>(
      ((venueRows ?? []) as VenueRow[]).map((venue) => [
        venue.id,
        venue,
      ])
    )

    const visits = typedVisitRows
      .map((visit): ProfileVisit | null => {
        const venue = venueMap.get(visit.venue_id)

        if (!venue) {
          console.warn(
            '[profile/visits][GET] Missing venue for visit:',
            {
              visitId: visit.id,
              venueId: visit.venue_id,
            }
          )

          return null
        }

        const visitedAt = normalizeVisitedAt(
          visit.visited_at
        )

        if (!visitedAt) {
          console.warn(
            '[profile/visits][GET] Invalid visited_at value:',
            {
              visitId: visit.id,
              visitedAt: visit.visited_at,
            }
          )

          return null
        }

        const localDate = formatVisitLocalDate(
          visitedAt,
          timeZone
        )

        const localTime = formatVisitLocalTime(
          visitedAt,
          timeZone
        )

        return {
          id: visit.id,
          venueId: visit.venue_id,
          venueName:
            normalizeOptionalString(venue.name) ??
            'Roam venue',
          city: normalizeCityName(venue.city),
          visitedAt,
          localDate,
          localTime,
          rating: normalizeRating(visit.rating),
          lat: normalizeLatitude(venue.lat),
          lon: normalizeLongitude(venue.lon),
          geoVerified: visit.geo_verified === true,
          checkInSource:
            normalizeOptionalString(
              visit.check_in_source
            ) ?? 'unknown',
          distanceMeters: normalizeNonNegativeNumber(
            visit.distance_meters
          ),
          locationAccuracyMeters:
            normalizeNonNegativeNumber(
              visit.location_accuracy_meters
            ),
        }
      })
      .filter(
        (visit): visit is ProfileVisit =>
          visit !== null
      )
      .filter((visit) => {
        if (
          requestedCity &&
          visit.city.toLocaleLowerCase() !==
            requestedCity.toLocaleLowerCase()
        ) {
          return false
        }

        if (
          requestedDate &&
          visit.localDate !== requestedDate
        ) {
          return false
        }

        return true
      })

    const cities = groupVisitsByCityAndDay(visits, {
      timeZone,
      minimumStickerVisits: 2,
      unknownCityLabel: 'Other',
    })

    return NextResponse.json(
      {
        cities,
        visits,
        totalVisits: typedVisitRows.length,
        returnedVisits: visits.length,
        filters: {
          city: requestedCity,
          date: requestedDate,
          timezone: timeZone,
          limit,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      '[profile/visits][GET] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error: 'Unexpected error loading visit history.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function normalizeLimit(
  value: string | null
): number {
  if (!value) {
    return DEFAULT_LIMIT
  }

  const parsed = Number(value)

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return DEFAULT_LIMIT
  }

  return Math.min(parsed, MAX_LIMIT)
}

function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function normalizeDateFilter(
  value: string | null
): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)
  ) {
    return null
  }

  const date = new Date(
    `${trimmed}T12:00:00.000Z`
  )

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return trimmed
}

function normalizeTimeZone(
  value: string | null
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

function normalizeCityName(
  city: string | null
): string {
  return (
    normalizeOptionalString(city) ??
    'Other'
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

function normalizeRating(
  value: number | null
): number | null {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
    ? value
    : null
}

function normalizeLatitude(
  value: number | null
): number | null {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  )
    ? value
    : null
}

function normalizeLongitude(
  value: number | null
): number | null {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  )
    ? value
    : null
}

function normalizeNonNegativeNumber(
  value: number | null
): number | null {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? value
    : null
}