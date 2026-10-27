
// app/explore/page.tsx

'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import Link from 'next/link'

import RoamAuthSheet from '@/components/auth/RoamAuthSheet'
import { useUser } from '@/hooks/useUser'
import { getAppDownloadLink } from '@/lib/constants/appLinks'
import { logEvent } from '@/lib/logEvent'

/* =========================================================
 * Explore Places
 *
 * Public, database-backed venue discovery.
 *
 * Data sources:
 *   GET /api/explore/venues
 *   GET /api/explore/trending
 *
 * No static city datasets.
 * No direct Supabase browser queries for venue data.
 * No raw venue_visits access.
 * No authentication required for browsing.
 *
 * All venue eligibility, search ranking, trending
 * scoring, and verified visit aggregation remain
 * on the server.
 * ======================================================= */

/* =========================================================
 * API contracts
 * ======================================================= */

type ExploreVenue = {
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

type ExplorePagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

type ExploreVenuesResponse = {
  venues: ExploreVenue[]
  pagination: ExplorePagination
  filters: {
    q: string
    city: string | null
    category: string | null
    vibe: string | null
    sort: ExploreSort
    locationProvided: boolean
  }
}

type TrendingVenue = {
  id: string
  name: string
  city: string
  cover: string | null
  type: string[]
  vibe: string[]
  tags: string[]
  lat: number | null
  lon: number | null
  rank: number
  score: number
  currentUniqueVisitors: number
  previousUniqueVisitors: number
  currentVerifiedVisits: number
  previousVerifiedVisits: number
  recentVerifiedVisits: number
  growth: {
    absoluteChange: number
    percentageChange: number | null
    newActivity: boolean
  }
  lastVerifiedVisitAt: string
  profileHref: string
  flowBuilderHref: string
}

type TrendingResponse = {
  status: 'trending' | 'insufficient_data'
  venues: TrendingVenue[]
  count: number
  windowDays: number
  asOf: string
}

type ExploreSort =
  | 'relevance'
  | 'name'
  | 'nearest'

type UserCoordinates = {
  lat: number
  lon: number
}

type RequestStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'

type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unavailable'

/* =========================================================
 * Configuration
 * ======================================================= */

const PAGE_SIZE = 24

const SEARCH_DEBOUNCE_MS = 300

const CITY_OPTIONS = [
  { value: '', label: 'All cities' },
  { value: 'atl', label: 'Atlanta' },
  { value: 'nyc', label: 'New York City' },
  { value: 'london', label: 'London' },
  { value: 'los angeles', label: 'Los Angeles' },
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'porto', label: 'Porto' },
] as const

/**
 * These suggestions are optional UI shortcuts.
 * The API accepts category and vibe text independently
 * of these values, so this list is not a venue allowlist.
 */
const CATEGORY_SUGGESTIONS = [
  'coffee',
  'dinner',
  'wine bar',
  'bookstore',
  'cocktail',
  'bakery',
  'gallery',
] as const

const VIBE_SUGGESTIONS = [
  'cozy',
  'romantic',
  'lively',
  'curated',
  'chill',
  'modern',
  'local',
] as const

const EMPTY_PAGINATION: ExplorePagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasMore: false,
}

/* =========================================================
 * Explore analytics
 *
 * Uses the existing user_impressions logger.
 * Analytics must never block a visitor's interaction.
 * ======================================================= */

function safeLogExploreEvent(
  eventName: string,
  metadata: Record<string, unknown> = {},
  venueId?: string
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        ...(venueId ? { venue_id: venueId } : {}),
        metadata: {
          page: 'explore',
          pathname: '/explore',
          ...metadata,
        },
      })
    )
  } catch (error) {
    console.warn(
      '[ExplorePage] Analytics logging failed:',
      error
    )
  }
}

/* =========================================================
 * Public metadata formatting
 * ======================================================= */

function cityLabel(city: string): string {
  const match = CITY_OPTIONS.find(
    (item) => item.value === city.toLowerCase()
  )

  if (match) {
    return match.label
  }

  return city
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(' ')
}

function formatDistance(
  miles: number | null
): string | null {
  if (
    miles === null ||
    !Number.isFinite(miles) ||
    miles < 0
  ) {
    return null
  }

  if (miles < 0.1) {
    return 'Under 0.1 mi away'
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi away`
  }

  return `${Math.round(miles).toLocaleString()} mi away`
}

function compactDescription(
  description: string | null,
  maxLength = 155
): string | null {
  if (!description) {
    return null
  }

  const normalized = description
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  const excerpt = normalized.slice(0, maxLength)
  const lastSpace = excerpt.lastIndexOf(' ')

  return `${
    lastSpace > maxLength * 0.6
      ? excerpt.slice(0, lastSpace)
      : excerpt
  }…`
}

/**
 * Explore-to-map Flow handoff.
 *
 * Uses the existing map's city and venue URL parameters.
 * buildFlow=1 identifies the request to generate an
 * itinerary from the selected venue once the map is ready.
 *
 * Explore stores Los Angeles as "los angeles", while the
 * map uses the city slug "la".
 *
 * The matching map-side auto-generation handler must
 * consume buildFlow=1 for the itinerary to be generated.
 */
function getMapFlowHref(
  venue: {
    id: string
    city: string
  }
): string {
  const normalizedCity =
    venue.city.trim().toLowerCase()

  const mapCity =
    normalizedCity === 'los angeles'
      ? 'la'
      : normalizedCity

  const params = new URLSearchParams({
    city: mapCity,
    venue: venue.id,
    buildFlow: '1',
  })

  return `/?${params.toString()}`
}

/**
 * Database cover values may be stored as paths such as:
 *
 * img/venues/example.jpg
 *
 * Restrict images to same-origin relative paths or
 * explicitly http(s) URLs.
 *
 * Encode each relative path segment so filenames with
 * spaces, hashes, etc. resolve correctly.
 */
function resolveCoverUrl(
  cover: string | null
): string | null {
  if (!cover) {
    return null
  }

  const value = cover.trim()

  if (!value) {
    return null
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)

      if (
        url.protocol === 'https:' ||
        url.protocol === 'http:'
      ) {
        return url.toString()
      }
    } catch {
      return null
    }

    return null
  }

  if (
    value.startsWith('//') ||
    value.startsWith('\\') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return null
  }

  const segments = value
    .split('/')
    .filter(Boolean)

  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === '.' ||
        segment === '..' ||
        segment.includes('\\')
    )
  ) {
    return null
  }

  return `/${segments
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
}

function isExploreVenue(
  value: unknown
): value is ExploreVenue {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const venue = value as Partial<ExploreVenue>

  return (
    typeof venue.id === 'string' &&
    typeof venue.name === 'string' &&
    typeof venue.city === 'string' &&
    Array.isArray(venue.type) &&
    Array.isArray(venue.vibe) &&
    Array.isArray(venue.tags) &&
    typeof venue.profileHref === 'string' &&
    typeof venue.flowBuilderHref === 'string'
  )
}

function isExploreResponse(
  value: unknown
): value is ExploreVenuesResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const response =
    value as Partial<ExploreVenuesResponse>

  return (
    Array.isArray(response.venues) &&
    response.venues.every(isExploreVenue) &&
    response.pagination !== undefined &&
    typeof response.pagination.total === 'number' &&
    typeof response.pagination.page === 'number' &&
    typeof response.pagination.totalPages === 'number'
  )
}

function isTrendingResponse(
  value: unknown
): value is TrendingResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const response = value as Partial<TrendingResponse>

  return (
    (
      response.status === 'trending' ||
      response.status === 'insufficient_data'
    ) &&
    Array.isArray(response.venues) &&
    typeof response.count === 'number'
  )
}

/* =========================================================
 * Small presentation components
 * ======================================================= */

function VenueCover({
  cover,
  name,
  className = '',
}: {
  cover: string | null
  name: string
  className?: string
}) {
  const source = resolveCoverUrl(cover)

  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [source])

  return (
    <div
      className={`relative overflow-hidden bg-white/[0.035] ${className}`}
    >
      {source && !failed ? (
        // Database-driven public images are intentionally
        // rendered without imposing a Next image-domain
        // configuration on existing venue assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-6 text-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-3 h-8 w-8 text-zinc-500"
          >
            <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="m3 16 5-4 4 3 3-2 6 4" />
          </svg>
          <span className="max-w-[220px] text-sm font-medium text-zinc-400">
            {name}
          </span>
        </div>
      )}
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </svg>
  )
}

function PlaceCard({
  venue,
  isAuthenticated,
  authLoading,
  onGuestBuildFlow,
}: {
  venue: ExploreVenue
  isAuthenticated: boolean
  authLoading: boolean
  onGuestBuildFlow: (venue: ExploreVenue) => void
}) {
  const distance = formatDistance(
    venue.distanceMiles
  )

  const description = compactDescription(
    venue.description
  )

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.065] to-white/[0.025] shadow-[0_18px_50px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.075] transition duration-200 hover:-translate-y-0.5 hover:ring-cyan-300/25">
      <Link
        href={venue.profileHref}
        aria-label={`View ${venue.name}`}
        onClick={() => {
          safeLogExploreEvent(
            'explore_view_place_clicked',
            {
              city: venue.city,
              source: 'card_image',
            },
            venue.id
          )
        }}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <VenueCover
          cover={venue.cover}
          name={venue.name}
          className="aspect-[16/10] w-full"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500">
          <span>{cityLabel(venue.city)}</span>

          {distance && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <LocationIcon />
                {distance}
              </span>
            </>
          )}

          {venue.price && (
            <>
              <span aria-hidden="true">·</span>
              <span>{venue.price}</span>
            </>
          )}
        </div>

        <Link
          href={venue.profileHref}
          onClick={() => {
            safeLogExploreEvent(
              'explore_view_place_clicked',
              {
                city: venue.city,
                source: 'card_title',
              },
              venue.id
            )
          }}
          className="w-fit rounded-sm text-lg font-semibold leading-snug tracking-tight text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          {venue.name}
        </Link>

        {venue.address && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
            {venue.address}
          </p>
        )}

        {description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-400">
            {description}
          </p>
        )}

        {(venue.type.length > 0 ||
          venue.vibe.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {venue.type.slice(0, 2).map((type) => (
              <span
                key={`type-${type}`}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.085] px-2.5 py-1 text-[11px] font-medium text-cyan-200"
              >
                {type}
              </span>
            ))}

            {venue.vibe.slice(0, 2).map((vibe) => (
              <span
                key={`vibe-${vibe}`}
                className="rounded-full border border-white/[0.075] bg-white/[0.045] px-2.5 py-1 text-[11px] font-medium text-neutral-300"
              >
                {vibe}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          <Link
            href={venue.profileHref}
            onClick={() => {
              safeLogExploreEvent(
                'explore_view_place_clicked',
                {
                  city: venue.city,
                  source: 'view_place_button',
                },
                venue.id
              )
            }}
            className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] px-3 text-center text-sm font-semibold text-white transition hover:bg-white/[0.085] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            View Place
          </Link>

          {isAuthenticated ? (
            <Link
              href={getMapFlowHref(venue)}
              onClick={() => {
                safeLogExploreEvent(
                  'explore_build_flow_clicked',
                  {
                    city: venue.city,
                    authenticated: true,
                    source: 'place_card',
                  },
                  venue.id
                )
              }}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 px-3 text-center text-sm font-black text-white shadow-[0_12px_30px_rgba(34,211,238,0.12)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Build a Flow
              <ArrowIcon />
            </Link>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={() => {
                safeLogExploreEvent(
                  'explore_build_flow_clicked',
                  {
                    city: venue.city,
                    authenticated: false,
                    source: 'place_card',
                  },
                  venue.id
                )

                onGuestBuildFlow(venue)
              }}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 px-3 text-center text-sm font-black text-white shadow-[0_12px_30px_rgba(34,211,238,0.12)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
            >
              Build a Flow
              <ArrowIcon />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function TrendingCard({
  venue,
}: {
  venue: TrendingVenue
}) {
  const growth = venue.growth.percentageChange

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.065] to-white/[0.025] shadow-[0_18px_50px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.075]">
      <Link
        href={venue.profileHref}
        onClick={() => {
          safeLogExploreEvent(
            'explore_view_place_clicked',
            {
              city: venue.city,
              source: 'trending_card_image',
            },
            venue.id
          )
        }}
        className="relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        aria-label={`View ${venue.name}`}
      >
        <VenueCover
          cover={venue.cover}
          name={venue.name}
          className="aspect-[16/10]"
        />

        <span className="absolute left-3 top-3 rounded-full border border-cyan-300/25 bg-zinc-950/90 px-3 py-1.5 text-xs font-bold text-cyan-200 shadow-sm backdrop-blur-md">
          #{venue.rank} Trending
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-xs font-medium text-neutral-500">
          {cityLabel(venue.city)}
        </span>

        <Link
          href={venue.profileHref}
          onClick={() => {
            safeLogExploreEvent(
              'explore_view_place_clicked',
              {
                city: venue.city,
                source: 'trending_card_title',
              },
              venue.id
            )
          }}
          className="mt-1 text-base font-semibold text-white hover:underline"
        >
          {venue.name}
        </Link>

        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          {venue.currentUniqueVisitors.toLocaleString()}{' '}
          verified unique{' '}
          {venue.currentUniqueVisitors === 1
            ? 'visitor'
            : 'visitors'}{' '}
          in 7 days
        </p>

        {growth !== null && growth > 0 && (
          <span className="mt-2 w-fit rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            +{growth.toLocaleString()}% vs. prior week
          </span>
        )}

        {venue.growth.newActivity && (
          <span className="mt-2 w-fit rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
            New verified activity
          </span>
        )}

        <Link
          href={venue.profileHref}
          onClick={() => {
            safeLogExploreEvent(
              'explore_view_place_clicked',
              {
                city: venue.city,
                source: 'trending_card_button',
              },
              venue.id
            )
          }}
          className="mt-auto flex min-h-11 items-center gap-2 pt-4 text-sm font-semibold text-cyan-200 hover:text-cyan-100 hover:underline"
        >
          Explore place
          <ArrowIcon />
        </Link>
      </div>
    </article>
  )
}

function LoadingCards() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Loading places"
      role="status"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl bg-white/[0.035] ring-1 ring-white/[0.075]"
        >
          <div className="aspect-[16/10] animate-pulse bg-white/[0.06]" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="mt-6 h-10 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
        selected
          ? 'border-cyan-300/35 bg-cyan-300/[0.12] text-cyan-200'
          : 'border-white/10 bg-white/[0.035] text-neutral-300 hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      {label}
    </button>
  )
}

/* =========================================================
 * Main page
 * ======================================================= */

export default function ExplorePage() {
  /* =======================================================
   * Guest authentication for venue-based Flow building
   *
   * Browsing Explore remains public.
   * Signed-in users retain direct map navigation.
   * Guest users authenticate before proceeding to the
   * exact venue-specific Flow URL.
   * ===================================================== */

  const {
    user,
    loading: authLoading,
  } = useUser()

  const [
    pendingFlowVenue,
    setPendingFlowVenue,
  ] = useState<ExploreVenue | null>(null)

  const [
    authSheetOpen,
    setAuthSheetOpen,
  ] = useState(false)

  const handleGuestBuildFlow = useCallback(
    (venue: ExploreVenue) => {
      setPendingFlowVenue(venue)
      setAuthSheetOpen(true)
    },
    []
  )

  const handleFlowAuthenticated = useCallback(
    async () => {
      if (!pendingFlowVenue) {
        return
      }

      window.location.assign(
        getMapFlowHref(pendingFlowVenue)
      )
    },
    [pendingFlowVenue]
  )

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] =
    useState('')

  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [vibe, setVibe] = useState('')

  const [sort, setSort] =
    useState<ExploreSort>('relevance')

  const [page, setPage] = useState(1)

  const [venues, setVenues] = useState<ExploreVenue[]>([])
  const [pagination, setPagination] =
    useState<ExplorePagination>(EMPTY_PAGINATION)

  const [venuesStatus, setVenuesStatus] =
    useState<RequestStatus>('idle')

  const [venuesError, setVenuesError] =
    useState<string | null>(null)

  const [venuesRetry, setVenuesRetry] = useState(0)

  const [trending, setTrending] =
    useState<TrendingVenue[]>([])

  const [trendingStatus, setTrendingStatus] =
    useState<RequestStatus>('idle')

  const [trendingInsufficient, setTrendingInsufficient] =
    useState(false)

  const [location, setLocation] =
    useState<UserCoordinates | null>(null)

  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>('idle')

  const [locationMessage, setLocationMessage] =
    useState<string | null>(null)

  /* =======================================================
   * Explore page-view analytics
   * ===================================================== */

  const pageViewLoggedRef = useRef(false)

  useEffect(() => {
    if (pageViewLoggedRef.current) {
      return
    }

    pageViewLoggedRef.current = true

    safeLogExploreEvent('explore_page_viewed')
  }, [])

  /* =======================================================
   * Debounced server search
   * ===================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [search])

  /* =======================================================
   * Debounced search analytics
   *
   * Only log a completed, non-empty search after the
   * existing debounce has settled. Do not log each key.
   * ===================================================== */

  const lastLoggedSearchRef = useRef('')

  useEffect(() => {
    if (!debouncedSearch) {
      lastLoggedSearchRef.current = ''
      return
    }

    if (lastLoggedSearchRef.current === debouncedSearch) {
      return
    }

    lastLoggedSearchRef.current = debouncedSearch

    safeLogExploreEvent(
      'explore_search_performed',
      {
        query: debouncedSearch,
        city: city || null,
        category: category || null,
        vibe: vibe || null,
        sort,
      }
    )
  }, [debouncedSearch, city, category, vibe, sort])

  /**
   * Search/filter changes reset pagination.
   * Page changes themselves do not affect filtering.
   */
  const updateSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const updateCity = useCallback((value: string) => {
    safeLogExploreEvent(
      'explore_city_filter_changed',
      { city: value || null }
    )

    setCity(value)
    setPage(1)
  }, [])

  const updateCategory = useCallback((value: string) => {
    safeLogExploreEvent(
      'explore_category_filter_changed',
      { category: value || null }
    )

    setCategory(value)
    setPage(1)
  }, [])

  const updateVibe = useCallback((value: string) => {
    safeLogExploreEvent(
      'explore_vibe_filter_changed',
      { vibe: value || null }
    )

    setVibe(value)
    setPage(1)
  }, [])

  const updateSort = useCallback((value: ExploreSort) => {
    safeLogExploreEvent(
      'explore_sort_changed',
      { sort: value }
    )

    setSort(value)
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    safeLogExploreEvent(
      'explore_filters_cleared',
      { source: 'clear_filters' }
    )

    setSearch('')
    setDebouncedSearch('')
    setCity('')
    setCategory('')
    setVibe('')
    setSort('relevance')
    setPage(1)
  }, [])

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(city) ||
    Boolean(category) ||
    Boolean(vibe) ||
    sort !== 'relevance'

  /* =======================================================
   * Optional geolocation
   *
   * Never request location on initial page load.
   * The visitor must explicitly activate it.
   *
   * No coordinates are persisted to local storage.
   * ===================================================== */

  const requestLocation = useCallback(() => {
    safeLogExploreEvent(
      'explore_location_requested',
      { source: 'use_my_location_button' }
    )

    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setLocationStatus('unavailable')
      setLocationMessage(
        'Location is unavailable in this browser. You can still browse by city.'
      )
      return
    }

    setLocationStatus('requesting')
    setLocationMessage(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          lat < -90 ||
          lat > 90 ||
          lon < -180 ||
          lon > 180
        ) {
          setLocationStatus('unavailable')
          setLocationMessage(
            'Your location could not be determined. Browse by city instead.'
          )
          return
        }

        setLocation({ lat, lon })
        setLocationStatus('ready')
        setLocationMessage(null)
        setSort('nearest')
        setPage(1)
      },
      (error) => {
        setLocation(null)

        setLocationStatus(
          error.code === 1 ? 'denied' : 'unavailable'
        )

        setLocationMessage(
          error.code === 1
            ? 'Location permission was declined. City browsing still works.'
            : 'We could not retrieve your location. You can still browse by city.'
        )

        setSort((current) =>
          current === 'nearest' ? 'relevance' : current
        )
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }, [])

  const clearLocation = useCallback(() => {
    safeLogExploreEvent(
      'explore_location_removed',
      { source: 'remove_location_button' }
    )

    setLocation(null)
    setLocationStatus('idle')
    setLocationMessage(null)
    setPage(1)

    setSort((current) =>
      current === 'nearest' ? 'relevance' : current
    )
  }, [])

  /* =======================================================
   * Server-side venue discovery
   * ===================================================== */

  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    params.set('sort', sort)

    if (debouncedSearch) {
      params.set('q', debouncedSearch)
    }

    if (city) {
      params.set('city', city)
    }

    if (category) {
      params.set('category', category)
    }

    if (vibe) {
      params.set('vibe', vibe)
    }

    if (location) {
      params.set('lat', String(location.lat))
      params.set('lon', String(location.lon))
    }

    return params.toString()
  }, [
    page,
    sort,
    debouncedSearch,
    city,
    category,
    vibe,
    location,
  ])

  useEffect(() => {
    const controller = new AbortController()

    async function loadVenues() {
      setVenuesStatus('loading')
      setVenuesError(null)

      try {
        const response = await fetch(
          `/api/explore/venues?${queryString}`,
          {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          throw new Error(
            'We could not load places right now.'
          )
        }

        const result: unknown = await response.json()

        if (!isExploreResponse(result)) {
          throw new Error(
            'The places response was incomplete.'
          )
        }

        if (controller.signal.aborted) {
          return
        }

        setVenues(result.venues)
        setPagination(result.pagination)
        setVenuesStatus('success')
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setVenuesStatus('error')
        setVenues([])
        setPagination(EMPTY_PAGINATION)

        setVenuesError(
          error instanceof Error
            ? error.message
            : 'Unable to load places.'
        )
      }
    }

    void loadVenues()

    return () => {
      controller.abort()
    }
  }, [queryString, venuesRetry])

  /* =======================================================
   * Verified Trending Places
   *
   * This endpoint returns no venues when verified activity
   * falls below the server's minimum evidence threshold.
   *
   * The request and eligibility handling remain unchanged.
   * Rendering is gated on successful, eligible results.
   * ===================================================== */

  useEffect(() => {
    const controller = new AbortController()

    async function loadTrending() {
      setTrendingStatus('loading')
      setTrendingInsufficient(false)

      try {
        const response = await fetch(
          '/api/explore/trending?limit=6',
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          throw new Error('Trending request failed.')
        }

        const result: unknown = await response.json()

        if (!isTrendingResponse(result)) {
          throw new Error('Invalid trending response.')
        }

        if (controller.signal.aborted) {
          return
        }

        if (result.status === 'insufficient_data') {
          setTrending([])
          setTrendingInsufficient(true)
          setTrendingStatus('success')
          return
        }

        setTrending(result.venues)
        setTrendingInsufficient(false)
        setTrendingStatus('success')
      } catch {
        if (controller.signal.aborted) {
          return
        }

        setTrending([])
        setTrendingStatus('error')
      }
    }

    void loadTrending()

    return () => {
      controller.abort()
    }
  }, [])

  /* =======================================================
   * Pagination controls
   * ===================================================== */

  const goToPage = useCallback(
    (nextPage: number) => {
      if (
        nextPage < 1 ||
        nextPage > pagination.totalPages ||
        nextPage === page
      ) {
        return
      }

      setPage(nextPage)

      document.getElementById('explore-results')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    },
    [page, pagination.totalPages]
  )

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages

    if (total <= 1) {
      return []
    }

    const start = Math.max(
      1,
      Math.min(page - 2, total - 4)
    )

    const end = Math.min(total, start + 4)

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    )
  }, [page, pagination.totalPages])

  const displayedStart =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1

  const displayedEnd = Math.min(
    pagination.page * pagination.limit,
    pagination.total
  )

  const searchPending =
    search.trim() !== debouncedSearch

  const isLoading =
    venuesStatus === 'loading' ||
    venuesStatus === 'idle' ||
    searchPending

  /* =======================================================
   * Render
   * ===================================================== */

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />
        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />
        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        {/* -------------------------------------------------
         * Header
         * ------------------------------------------------- */}

        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.06] via-white/[0.028] to-indigo-400/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />
            <div className="absolute -bottom-28 right-[-4rem] h-72 w-72 rounded-full bg-indigo-400/[0.05] blur-[110px]" />
          </div>

          <div className="relative z-10 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300 sm:text-xs">
                Explore Places
              </p>
            </div>

            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.03]">
              Find somewhere worth going.
            </h1>
          </div>
        </header>

        {/* -------------------------------------------------
         * Search and filters
         * ------------------------------------------------- */}

        <section
          aria-labelledby="explore-search-heading"
          className="mt-9 rounded-[1.75rem] bg-white/[0.035] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.07] backdrop-blur-xl sm:p-6"
        >
          <h2
            id="explore-search-heading"
            className="sr-only"
          >
            Search and filter places
          </h2>

          <label
            htmlFor="explore-search-input"
            className="mb-2 block text-sm font-semibold text-white"
          >
            What are you looking for?
          </label>

          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
              <SearchIcon />
            </div>

            <input
              id="explore-search-input"
              type="search"
              value={search}
              onChange={(event) =>
                updateSearch(event.target.value)
              }
              maxLength={120}
              autoComplete="off"
              placeholder="Search coffee, rooftops, cozy, date night..."
              className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-12 pr-4 !text-[16px] text-white outline-none transition placeholder:text-neutral-500 focus:border-cyan-300/50 focus:bg-white/[0.045] focus:ring-2 focus:ring-cyan-300/10"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="explore-city"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                City
              </label>

              <select
                id="explore-city"
                value={city}
                onChange={(event) =>
                  updateCity(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              >
                {CITY_OPTIONS.map((option) => (
                  <option
                    key={option.value || 'all'}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="explore-category"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Category
              </label>

              <input
                id="explore-category"
                type="text"
                value={category}
                onChange={(event) =>
                  updateCategory(event.target.value)
                }
                maxLength={80}
                placeholder="Any category"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-white outline-none placeholder:text-neutral-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              />
            </div>

            <div>
              <label
                htmlFor="explore-vibe"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Vibe
              </label>

              <input
                id="explore-vibe"
                type="text"
                value={vibe}
                onChange={(event) =>
                  updateVibe(event.target.value)
                }
                maxLength={80}
                placeholder="Any vibe"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-white outline-none placeholder:text-neutral-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              />
            </div>

            <div>
              <label
                htmlFor="explore-sort"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Sort by
              </label>

              <select
                id="explore-sort"
                value={sort}
                onChange={(event) =>
                  updateSort(
                    event.target.value as ExploreSort
                  )
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              >
                <option value="relevance">
                  Most relevant
                </option>

                <option value="name">
                  Name A–Z
                </option>

                {location && (
                  <option value="nearest">
                    Nearest to me
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-white/[0.065] pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-neutral-500">
                Categories
              </span>

              {CATEGORY_SUGGESTIONS.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  selected={category.toLowerCase() === item}
                  onClick={() =>
                    updateCategory(
                      category.toLowerCase() === item
                        ? ''
                        : item
                    )
                  }
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-neutral-500">
                Vibes
              </span>

              {VIBE_SUGGESTIONS.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  selected={vibe.toLowerCase() === item}
                  onClick={() =>
                    updateVibe(
                      vibe.toLowerCase() === item
                        ? ''
                        : item
                    )
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.065] pt-5">
            <div className="flex flex-wrap items-center gap-3">
              {location ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                    <LocationIcon />
                    Location enabled
                  </span>

                  <button
                    type="button"
                    onClick={clearLocation}
                    className="text-xs font-semibold text-neutral-400 underline-offset-4 hover:text-white hover:underline"
                  >
                    Remove location
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locationStatus === 'requesting'}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.055] px-4 text-xs font-semibold text-white transition hover:border-cyan-300/30 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
                >
                  <LocationIcon />
                  {locationStatus === 'requesting'
                    ? 'Finding your location...'
                    : 'Use my location'}
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-10 text-xs font-semibold text-neutral-300 underline underline-offset-4 hover:text-cyan-200"
              >
                Clear all filters
              </button>
            )}
          </div>

          {locationMessage && (
            <p
              role="status"
              className="mt-3 text-sm text-neutral-400"
            >
              {locationMessage}
            </p>
          )}
        </section>

        {/* -------------------------------------------------
         * Verified trending
         *
         * Only show when the server returns qualifying
         * trending venues. Hide the entire section for
         * loading, errors, and insufficient data.
         * ------------------------------------------------- */}

        {trendingStatus === 'success' &&
          !trendingInsufficient &&
          trending.length > 0 && (
            <section
              aria-labelledby="explore-trending-heading"
              className="mt-12"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-px w-5 bg-cyan-300/60" />

                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                      Verified activity
                    </p>
                  </div>

                  <h2
                    id="explore-trending-heading"
                    className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]"
                  >
                    Trending Places
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                    Ranked from verified venue visits over the
                    past seven days—not paid placements or
                    invented popularity.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trending.map((venue) => (
                  <TrendingCard
                    key={venue.id}
                    venue={venue}
                  />
                ))}
              </div>
            </section>
          )}

        {/* -------------------------------------------------
         * All Places
         * ------------------------------------------------- */}

        <section
          id="explore-results"
          aria-labelledby="explore-results-heading"
          className="mt-14 scroll-mt-32"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Roam directory
                </p>
              </div>

              <h2
                id="explore-results-heading"
                className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]"
              >
                Explore All Places
              </h2>

              <p
                className="mt-2 text-sm text-neutral-500"
                aria-live="polite"
              >
                {isLoading
                  ? 'Finding places...'
                  : venuesStatus === 'error'
                    ? 'Places are temporarily unavailable.'
                    : pagination.total === 0
                      ? 'No matching places found.'
                      : `Showing ${displayedStart.toLocaleString()}–${displayedEnd.toLocaleString()} of ${pagination.total.toLocaleString()} places`}
              </p>
            </div>

            {location && (
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-medium text-neutral-400">
                Straight-line distances in miles
              </span>
            )}
          </div>

          <div className="mt-6">
            {isLoading ? (
              <LoadingCards />
            ) : venuesStatus === 'error' ? (
              <div className="rounded-2xl bg-white/[0.035] px-6 py-12 text-center ring-1 ring-white/[0.07]">
                <h3 className="text-lg font-semibold text-white">
                  We couldn't load places.
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
                  {venuesError ??
                    'Please try loading the directory again.'}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setVenuesRetry((count) => count + 1)
                  }
                  className="mt-5 min-h-11 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.12] px-5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Try again
                </button>
              </div>
            ) : venues.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.035] px-6 py-14 text-center ring-1 ring-white/[0.07]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.055] text-neutral-400">
                  <SearchIcon />
                </div>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  No places match those filters.
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-400">
                  Try a broader search, another city, or
                  clear the category and vibe filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 min-h-11 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.12] px-5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {venues.map((venue) => (
                  <PlaceCard
                    key={venue.id}
                    venue={venue}
                    isAuthenticated={Boolean(user)}
                    authLoading={authLoading}
                    onGuestBuildFlow={handleGuestBuildFlow}
                  />
                ))}
              </div>
            )}
          </div>

          {/* -----------------------------------------------
           * Pagination
           * ----------------------------------------------- */}

          {!isLoading &&
            venuesStatus === 'success' &&
            pagination.totalPages > 1 && (
              <nav
                aria-label="Explore Places pagination"
                className="mt-10 flex flex-wrap items-center justify-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-neutral-200 transition hover:border-cyan-300/25 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {pageNumbers.map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => goToPage(number)}
                    aria-label={`Go to page ${number}`}
                    aria-current={
                      number === page ? 'page' : undefined
                    }
                    className={`min-h-11 min-w-11 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      number === page
                        ? 'border-cyan-300/35 bg-cyan-300/[0.13] text-cyan-200'
                        : 'border-white/10 bg-white/[0.035] text-neutral-300 hover:border-white/20 hover:bg-white/[0.07]'
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={!pagination.hasMore}
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-neutral-200 transition hover:border-cyan-300/25 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
        </section>
      </div>

      {/* -------------------------------------------------
       * Guest Flow authentication and app download
       * ------------------------------------------------- */}

      <RoamAuthSheet
        open={authSheetOpen}
        onClose={() => {
          setAuthSheetOpen(false)
          setPendingFlowVenue(null)
        }}
        onAuthenticated={handleFlowAuthenticated}
        title="Your next Flow starts here"
        description={
          pendingFlowVenue
            ? `Sign in or create your Roam account to build a personalized Flow starting at ${pendingFlowVenue.name}.`
            : 'Sign in or create your Roam account to build a personalized Flow.'
        }
        submitLabel="Continue to your Flow"
        postAuthPath={
          pendingFlowVenue
            ? getMapFlowHref(pendingFlowVenue)
            : undefined
        }
      >
        <div className="mt-4 border-t border-white/10 pt-4 text-center">
          <p className="mb-3 text-xs leading-5 text-neutral-400">
            Prefer to explore on your phone?
          </p>

          <button
            type="button"
            onClick={() => {
              window.open(
                getAppDownloadLink(),
                '_blank',
                'noopener,noreferrer'
              )
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.09] px-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            Get the RoamCurated App
          </button>
        </div>
      </RoamAuthSheet>
    </main>
  )
}
