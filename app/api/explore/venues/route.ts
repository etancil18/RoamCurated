
import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  evaluateExploreVenueEligibility,
} from '@/lib/explore/venueEligibility'

import type {
  Database,
} from '@/types/supabase'

export const dynamic = 'force-dynamic'

/* =========================================================
 * Configuration
 * ======================================================= */

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 48

/**
 * Supabase/PostgREST commonly applies a per-request row
 * limit. Fetch catalog rows in bounded batches.
 *
 * This first release performs semantic search against a
 * bounded server-side inventory rather than relying on
 * fragile PostgREST array-text search expressions.
 *
 * If the inventory exceeds MAX_CATALOG_ROWS, fail
 * explicitly instead of silently returning incomplete
 * search results.
 */
const DATABASE_BATCH_SIZE = 500
const MAX_CATALOG_ROWS = 10000

const MAX_SEARCH_LENGTH = 120
const MAX_FILTER_LENGTH = 80
const MAX_PAGE = 1000

const EARTH_RADIUS_MILES = 3958.7613

const PUBLIC_VENUE_COLUMNS = [
  'id',
  'name',
  'description',
  'city',
  'canonical_city',
  'address',
  'cover',
  'type',
  'vibe',
  'tags',
  'price',
  'lat',
  'lon',
  'profile_status',
].join(', ')

type VenueRow =
  Database['public']['Tables']['venues']['Row']

type PublicVenueRow = Pick<
  VenueRow,
  | 'id'
  | 'name'
  | 'description'
  | 'city'
  | 'canonical_city'
  | 'address'
  | 'cover'
  | 'type'
  | 'vibe'
  | 'tags'
  | 'price'
  | 'lat'
  | 'lon'
  | 'profile_status'
>

type ExploreSort =
  | 'relevance'
  | 'name'
  | 'nearest'

type ExploreVenueResponse = {
  id: string
  name: string
  description: string | null
  city: string
  canonicalCity: string | null
  address: string | null
  cover: string | null
  type: string[]
  vibe: string[]
  tags: string[]
  price: string | null
  lat: number | null
  lon: number | null
  distanceMiles: number | null
  supportsDistance: boolean
  profileHref: string
  flowBuilderHref: string
}

type ScoredExploreVenue = {
  venue: ExploreVenueResponse
  searchScore: number
}

type ExploreQuery = {
  search: string
  city: string
  category: string
  vibe: string
  page: number
  limit: number
  sort: ExploreSort
  location: {
    lat: number
    lon: number
  } | null
}

/* =========================================================
 * GET /api/explore/venues
 *
 * Supported parameters:
 *
 * q        Search across public venue metadata
 * city     Database city classification
 * category Filter by venues.type
 * vibe     Filter by venues.vibe
 * sort     relevance | name | nearest
 * page     One-based page number
 * limit    Number of results, maximum 48
 * lat      Optional user latitude
 * lon      Optional user longitude
 *
 * Example:
 *
 * /api/explore/venues?city=atl&q=cozy+coffee
 *
 * No authentication required for venue browsing.
 * No mutations.
 * No service-role access.
 * No raw venue_visits exposure.
 * ======================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const parsed = parseExploreQuery(
      request.nextUrl.searchParams
    )

    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: parsed.error,
        },
        {
          status: 400,
        }
      )
    }

    const query = parsed.value

    /**
     * This client uses the existing application's
     * Supabase server-client integration.
     *
     * The venues SELECT policy already permits
     * public reads under RLS.
     *
     * Do not replace this with a service-role client.
     */
    const supabase =
      await createServerClient()

    const catalog:
      PublicVenueRow[] = []

    let offset = 0

    /*
     * Retrieve only explicitly approved public-facing
     * columns. access_token, contact, and other
     * internal metadata are not selected.
     *
     * Filtering by city and OOB classification happens
     * in the database first, then eligibility is
     * rechecked by the canonical Explore helper.
     */
    while (
      offset < MAX_CATALOG_ROWS
    ) {
      const upperBound =
        offset +
        DATABASE_BATCH_SIZE -
        1

      let databaseQuery = supabase
        .from('venues')
        .select(
          PUBLIC_VENUE_COLUMNS
        )
        .neq(
          'city',
          'oob'
        )

      if (query.city) {
        databaseQuery =
          databaseQuery.eq(
            'city',
            query.city
          )
      }

      const {
        data,
        error,
      } = await databaseQuery
        .order(
          'id',
          {
            ascending: true,
          }
        )
        .range(
          offset,
          upperBound
        )

      if (error) {
        console.error(
          '[api/explore/venues] Venue query failed:',
          error
        )

        return NextResponse.json(
          {
            error:
              'Unable to load places.',
          },
          {
            status: 500,
          }
        )
      }

      const batch =
        (data ?? []) as unknown as
          PublicVenueRow[]

      catalog.push(
        ...batch
      )

      if (
        batch.length <
        DATABASE_BATCH_SIZE
      ) {
        break
      }

      offset +=
        DATABASE_BATCH_SIZE
    }

    /*
     * Detect catalog growth beyond the supported
     * bounded-search range.
     *
     * A partial catalog must never masquerade as
     * a complete search result.
     */
    if (
      catalog.length >=
      MAX_CATALOG_ROWS
    ) {
      return NextResponse.json(
        {
          error:
            'The places catalog exceeds the current search capacity.',
        },
        {
          status: 503,
        }
      )
    }

    const terms =
      tokenizeSearch(
        query.search
      )

    const matching:
      ScoredExploreVenue[] = []

    for (
      const row of catalog
    ) {
      const eligibility =
        evaluateExploreVenueEligibility(
          row
        )

      if (
        !eligibility.eligible
      ) {
        continue
      }

      const identity =
        eligibility.venue

      const types =
        normalizeStringArray(
          row.type
        )

      const vibes =
        normalizeStringArray(
          row.vibe
        )

      const tags =
        normalizeStringArray(
          row.tags
        )

      if (
        query.category &&
        !matchesFilter(
          types,
          query.category
        )
      ) {
        continue
      }

      if (
        query.vibe &&
        !matchesFilter(
          vibes,
          query.vibe
        )
      ) {
        continue
      }

      const description =
        normalizeOptionalText(
          row.description
        )

      const address =
        normalizeOptionalText(
          row.address
        )

      const canonicalCity =
        normalizeOptionalText(
          row.canonical_city
        )

      const searchScore =
        calculateSearchScore({
          search:
            query.search,
          terms,
          name:
            identity.name,
          city:
            identity.city,
          canonicalCity,
          description,
          address,
          types,
          vibes,
          tags,
        })

      if (
        terms.length > 0 &&
        searchScore === null
      ) {
        continue
      }

      const coordinates =
        identity.coordinates

      const distanceMiles =
        query.location &&
        coordinates
          ? calculateDistanceMiles(
              query.location.lat,
              query.location.lon,
              coordinates.lat,
              coordinates.lon
            )
          : null

      const venue:
        ExploreVenueResponse = {
          id:
            identity.id,

          name:
            identity.name,

          description,

          city:
            identity.city,

          canonicalCity,

          address,

          cover:
            normalizeOptionalText(
              row.cover
            ),

          type:
            types,

          vibe:
            vibes,

          tags:
            tags,

          price:
            normalizeOptionalText(
              row.price
            ),

          lat:
            coordinates?.lat ??
            null,

          lon:
            coordinates?.lon ??
            null,

          distanceMiles,

          supportsDistance:
            identity.supportsDistance,

          profileHref:
            `/venue-profile/${encodeURIComponent(
              identity.id
            )}`,

          flowBuilderHref:
            `/sponsor-crawl?venueId=${encodeURIComponent(
              identity.id
            )}`,
        }

      matching.push({
        venue,
        searchScore:
          searchScore ?? 0,
      })
    }

    sortExploreVenues(
      matching,
      query.sort,
      terms.length > 0
    )

    const total =
      matching.length

    const totalPages =
      Math.ceil(
        total /
        query.limit
      )

    const startIndex =
      (query.page - 1) *
      query.limit

    const results =
      matching
        .slice(
          startIndex,
          startIndex +
            query.limit
        )
        .map(
          (item) =>
            item.venue
        )

    return NextResponse.json(
      {
        venues:
          results,

        pagination: {
          page:
            query.page,

          limit:
            query.limit,

          total,

          totalPages,

          hasMore:
            startIndex +
              results.length <
            total,
        },

        filters: {
          q:
            query.search,

          city:
            query.city ||
            null,

          category:
            query.category ||
            null,

          vibe:
            query.vibe ||
            null,

          sort:
            query.sort,

          locationProvided:
            query.location !==
            null,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'private, no-store',
        },
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[api/explore/venues] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error loading places.',
      },
      {
        status: 500,
      }
    )
  }
}

/* =========================================================
 * Query validation
 * ======================================================= */

type ParsedQuery =
  | {
      ok: true
      value: ExploreQuery
    }
  | {
      ok: false
      error: string
    }

function parseExploreQuery(
  params: URLSearchParams
): ParsedQuery {
  const search =
    (
      params.get('q') ??
      ''
    ).trim()

  const city =
    (
      params.get('city') ??
      ''
    )
      .trim()
      .toLowerCase()

  const category =
    (
      params.get('category') ??
      ''
    )
      .trim()
      .toLowerCase()

  const vibe =
    (
      params.get('vibe') ??
      ''
    )
      .trim()
      .toLowerCase()

  if (
    search.length >
      MAX_SEARCH_LENGTH ||
    city.length >
      MAX_FILTER_LENGTH ||
    category.length >
      MAX_FILTER_LENGTH ||
    vibe.length >
      MAX_FILTER_LENGTH
  ) {
    return {
      ok: false,
      error:
        'One or more search parameters are too long.',
    }
  }

  if (
    city === 'oob'
  ) {
    return {
      ok: false,
      error:
        'The selected city is not available for exploration.',
    }
  }

  const page =
    parsePositiveInteger(
      params.get('page'),
      1
    )

  const limit =
    parsePositiveInteger(
      params.get('limit'),
      DEFAULT_PAGE_SIZE
    )

  if (
    page === null ||
    page > MAX_PAGE
  ) {
    return {
      ok: false,
      error:
        'Invalid page number.',
    }
  }

  if (
    limit === null ||
    limit >
      MAX_PAGE_SIZE
  ) {
    return {
      ok: false,
      error:
        'Invalid page size.',
    }
  }

  const requestedSort =
    (
      params.get('sort') ??
      'relevance'
    )
      .trim()
      .toLowerCase()

  if (
    requestedSort !==
      'relevance' &&
    requestedSort !==
      'name' &&
    requestedSort !==
      'nearest'
  ) {
    return {
      ok: false,
      error:
        'Invalid sort option.',
    }
  }

  const latParam =
    params.get('lat')

  const lonParam =
    params.get('lon')

  const hasLatitude =
    latParam !== null

  const hasLongitude =
    lonParam !== null

  if (
    hasLatitude !==
    hasLongitude
  ) {
    return {
      ok: false,
      error:
        'Latitude and longitude must be provided together.',
    }
  }

  let location:
    ExploreQuery['location'] =
    null

  if (
    hasLatitude &&
    hasLongitude
  ) {
    const lat =
      parseCoordinate(
        latParam,
        -90,
        90
      )

    const lon =
      parseCoordinate(
        lonParam,
        -180,
        180
      )

    if (
      lat === null ||
      lon === null
    ) {
      return {
        ok: false,
        error:
          'Invalid location coordinates.',
      }
    }

    location = {
      lat,
      lon,
    }
  }

  if (
    requestedSort ===
      'nearest' &&
    !location
  ) {
    return {
      ok: false,
      error:
        'Nearest sorting requires a valid location.',
    }
  }

  return {
    ok: true,

    value: {
      search,
      city,
      category,
      vibe,
      page,
      limit,
      sort:
        requestedSort,
      location,
    },
  }
}

function parsePositiveInteger(
  value: string | null,
  fallback: number
): number | null {
  if (
    value === null
  ) {
    return fallback
  }

  const normalized =
    value.trim()

  if (
    !/^[1-9]\d*$/.test(
      normalized
    )
  ) {
    return null
  }

  const parsed =
    Number(normalized)

  return (
    Number.isSafeInteger(
      parsed
    )
      ? parsed
      : null
  )
}

function parseCoordinate(
  value: string | null,
  minimum: number,
  maximum: number
): number | null {
  if (
    value === null ||
    !value.trim()
  ) {
    return null
  }

  const parsed =
    Number(value)

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null
  }

  return parsed
}

/* =========================================================
 * Venue metadata normalization
 * ======================================================= */

function normalizeOptionalText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

function normalizeStringArray(
  value: unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const results:
    string[] = []

  const seen =
    new Set<string>()

  for (
    const item of value
  ) {
    if (
      typeof item !==
      'string'
    ) {
      continue
    }

    for (
      const part of
        item.split(',')
    ) {
      const normalized =
        part.trim()

      if (
        !normalized
      ) {
        continue
      }

      const key =
        normalized.toLowerCase()

      if (
        seen.has(
          key
        )
      ) {
        continue
      }

      seen.add(
        key
      )

      results.push(
        normalized
      )
    }
  }

  return results
}

/* =========================================================
 * Search
 * ======================================================= */

/**
 * Search requires all entered terms to match at least
 * one searchable public metadata field.
 *
 * Example:
 *
 * "cozy coffee"
 *
 * can match:
 *
 * type = ["coffee"]
 * vibe = ["cozy"]
 *
 * even when the terms appear in different fields.
 */
function tokenizeSearch(
  search: string
): string[] {
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function matchesFilter(
  values: string[],
  filter: string
): boolean {
  return values.some(
    (value) =>
      value
        .toLowerCase()
        .includes(
          filter
        )
  )
}

function calculateSearchScore({
  search,
  terms,
  name,
  city,
  canonicalCity,
  description,
  address,
  types,
  vibes,
  tags,
}: {
  search: string
  terms: string[]
  name: string
  city: string
  canonicalCity: string | null
  description: string | null
  address: string | null
  types: string[]
  vibes: string[]
  tags: string[]
}): number | null {
  if (
    terms.length === 0
  ) {
    return 0
  }

  const normalizedSearch =
    search
      .trim()
      .toLowerCase()

  const normalizedName =
    name.toLowerCase()

  const normalizedTypes =
    types.join(' ').toLowerCase()

  const normalizedVibes =
    vibes.join(' ').toLowerCase()

  const normalizedTags =
    tags.join(' ').toLowerCase()

  const normalizedDescription =
    (
      description ?? ''
    ).toLowerCase()

  const normalizedAddress =
    (
      address ?? ''
    ).toLowerCase()

  const normalizedCity =
    city.toLowerCase()

  const normalizedCanonicalCity =
    (
      canonicalCity ?? ''
    ).toLowerCase()

  const searchableFields = [
    normalizedName,
    normalizedTypes,
    normalizedVibes,
    normalizedTags,
    normalizedDescription,
    normalizedAddress,
    normalizedCity,
    normalizedCanonicalCity,
  ]

  for (
    const term of terms
  ) {
    if (
      !searchableFields.some(
        (field) =>
          field.includes(
            term
          )
      )
    ) {
      return null
    }
  }

  let score = 0

  if (
    normalizedName ===
    normalizedSearch
  ) {
    score += 1000
  } else if (
    normalizedName.startsWith(
      normalizedSearch
    )
  ) {
    score += 500
  } else if (
    normalizedName.includes(
      normalizedSearch
    )
  ) {
    score += 300
  }

  for (
    const term of terms
  ) {
    if (
      normalizedName.includes(
        term
      )
    ) {
      score += 100
    }

    if (
      normalizedTypes.includes(
        term
      )
    ) {
      score += 50
    }

    if (
      normalizedVibes.includes(
        term
      )
    ) {
      score += 40
    }

    if (
      normalizedTags.includes(
        term
      )
    ) {
      score += 30
    }

    if (
      normalizedDescription.includes(
        term
      )
    ) {
      score += 15
    }

    if (
      normalizedCity.includes(
        term
      ) ||
      normalizedCanonicalCity.includes(
        term
      )
    ) {
      score += 10
    }

    if (
      normalizedAddress.includes(
        term
      )
    ) {
      score += 5
    }
  }

  return score
}

/* =========================================================
 * Sorting
 * ======================================================= */

function sortExploreVenues(
  rows: ScoredExploreVenue[],
  sort: ExploreSort,
  hasSearch: boolean
): void {
  rows.sort(
    (a, b) => {
      if (
        sort ===
        'nearest'
      ) {
        const distanceA =
          a.venue.distanceMiles

        const distanceB =
          b.venue.distanceMiles

        if (
          distanceA === null &&
          distanceB !== null
        ) {
          return 1
        }

        if (
          distanceB === null &&
          distanceA !== null
        ) {
          return -1
        }

        if (
          distanceA !== null &&
          distanceB !== null &&
          distanceA !==
            distanceB
        ) {
          return (
            distanceA -
            distanceB
          )
        }
      }

      if (
        sort ===
          'relevance' &&
        hasSearch &&
        a.searchScore !==
          b.searchScore
      ) {
        return (
          b.searchScore -
          a.searchScore
        )
      }

      const nameComparison =
        a.venue.name.localeCompare(
          b.venue.name
        )

      if (
        nameComparison !==
        0
      ) {
        return nameComparison
      }

      return a.venue.id.localeCompare(
        b.venue.id
      )
    }
  )
}

/* =========================================================
 * Distance calculation
 * ======================================================= */

/**
 * Great-circle distance in miles.
 *
 * This represents approximate straight-line distance,
 * not driving or walking route distance.
 *
 * Calculated only when the caller supplies valid
 * coordinates. Coordinates are not stored by this route.
 */
function calculateDistanceMiles(
  originLat: number,
  originLon: number,
  destinationLat: number,
  destinationLon: number
): number {
  const latitudeDifference =
    toRadians(
      destinationLat -
      originLat
    )

  const longitudeDifference =
    toRadians(
      destinationLon -
      originLon
    )

  const originLatitudeRadians =
    toRadians(
      originLat
    )

  const destinationLatitudeRadians =
    toRadians(
      destinationLat
    )

  const haversine =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(
      originLatitudeRadians
    ) *
      Math.cos(
        destinationLatitudeRadians
      ) *
      Math.sin(
        longitudeDifference / 2
      ) ** 2

  const boundedHaversine =
    Math.min(
      1,
      Math.max(
        0,
        haversine
      )
    )

  return (
    2 *
    EARTH_RADIUS_MILES *
    Math.asin(
      Math.sqrt(
        boundedHaversine
      )
    )
  )
}

function toRadians(
  degrees: number
): number {
  return (
    degrees *
    Math.PI
  ) / 180
}
