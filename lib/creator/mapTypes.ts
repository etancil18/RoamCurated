/**
 * Public Creator Exploration Map domain contracts.
 *
 * This file intentionally contains:
 *
 * - no React
 * - no Supabase client
 * - no database queries
 * - no raw check-in evidence
 * - no viewer-specific state
 *
 * Public map loading belongs in:
 *
 *   lib/creator/getPublicCreatorMap.ts
 *
 * Public map rendering belongs in:
 *
 *   components/public-profile/creator/CreatorExplorationMap.tsx
 *
 * Keep this contract narrow. Anything added here may eventually
 * be serialized and sent to anonymous viewers.
 */

/* =========================================================
 * Map modes
 * ======================================================= */

/**
 * Public Creator Exploration Map modes.
 *
 * Explored:
 * Venues connected to the creator through a qualifying,
 * geo-verified Roam visit.
 *
 * Recommended:
 * Venues intentionally published through one or more public
 * creator collections.
 */
export const CREATOR_MAP_MODES = [
  'explored',
  'recommended',
] as const

export type CreatorMapMode =
  (typeof CREATOR_MAP_MODES)[number]

/* =========================================================
 * Public collection projection
 * ======================================================= */

/**
 * Minimal public collection information attached to a map venue.
 *
 * Ownership fields, visibility state, timestamps, creator notes,
 * and internal relationship identifiers are intentionally omitted.
 */
export type PublicCreatorMapCollection = {
  id: string
  title: string
  slug: string
}

/* =========================================================
 * Public venue projection
 * ======================================================= */

/**
 * Canonical public-safe venue record used by the Creator
 * Exploration Map.
 *
 * Coordinates are canonical venue coordinates from `venues`.
 * They must never be sourced from:
 *
 * - venue_visits.user_lat
 * - venue_visits.user_lon
 * - active_flow_progress.user_lat
 * - active_flow_progress.user_lon
 *
 * A venue may belong to either or both map modes.
 */
export type PublicCreatorMapVenue = {
  /**
   * Canonical Roam venue identifier.
   */
  id: string

  /**
   * Canonical public venue name.
   */
  name: string

  /**
   * Optional canonical venue slug.
   *
   * Venue navigation should continue to prefer the canonical venue
   * ID unless the existing venue routing layer explicitly requires
   * a slug.
   */
  slug: string | null

  /**
   * Canonical venue latitude.
   *
   * The loader must verify:
   *
   * - finite number
   * - latitude between -90 and 90
   */
  lat: number

  /**
   * Canonical venue longitude.
   *
   * The loader must verify:
   *
   * - finite number
   * - longitude between -180 and 180
   */
  lon: number

  /**
   * Public venue geography and presentation fields.
   */
  city: string | null
  category: string | null
  coverImageUrl: string | null

  /**
   * True only when the creator has a qualifying geo-verified
   * venue relationship.
   */
  explored: boolean

  /**
   * True only when the venue belongs to at least one public
   * collection owned by the creator.
   */
  recommended: boolean

  /**
   * Public collections through which this venue is recommended.
   *
   * This must contain only public collections owned by the
   * creator whose map is being loaded.
   *
   * Explored-only venues return an empty array.
   */
  publicCollections: PublicCreatorMapCollection[]
}

/* =========================================================
 * Public aggregate contract
 * ======================================================= */

export type PublicCreatorMapCounts = {
  /**
   * Number of unique venues where `explored === true`.
   */
  explored: number

  /**
   * Number of unique venues where `recommended === true`.
   */
  recommended: number
}

/**
 * Complete public Creator Exploration Map payload.
 *
 * The loader must return one record per canonical venue ID.
 *
 * Counts must be derived from the final, validated, deduplicated
 * `venues` array rather than from raw database relationship rows.
 */
export type PublicCreatorMapData = {
  venues: PublicCreatorMapVenue[]
  counts: PublicCreatorMapCounts
}

/* =========================================================
 * Loader result semantics
 * ======================================================= */

/**
 * Public loader result.
 *
 * `null` means the creator is not eligible to expose a public map,
 * including cases such as:
 *
 * - private base profile
 * - Creator Mode disabled
 * - public map opt-in disabled
 * - missing creator profile
 *
 * An empty `PublicCreatorMapData` means the creator is eligible
 * and opted in, but no venues currently satisfy the selected
 * public eligibility rules.
 */
export type PublicCreatorMapResult =
  | PublicCreatorMapData
  | null

/* =========================================================
 * Public loader error contract
 * ======================================================= */

/**
 * Stable application-facing error identifiers for public map
 * loading failures.
 *
 * Detailed database errors must remain server-side.
 */
export type PublicCreatorMapLoadErrorCode =
  | 'ELIGIBILITY_QUERY_FAILED'
  | 'VERIFIED_VISITS_QUERY_FAILED'
  | 'PUBLIC_COLLECTIONS_QUERY_FAILED'
  | 'COLLECTION_VENUES_QUERY_FAILED'
  | 'VENUES_QUERY_FAILED'
  | 'INVALID_DATABASE_DATA'

/* =========================================================
 * Type guards
 * ======================================================= */

export function isCreatorMapMode(
  value: unknown
): value is CreatorMapMode {
  return (
    typeof value === 'string' &&
    (
      CREATOR_MAP_MODES as readonly string[]
    ).includes(value)
  )
}

/* =========================================================
 * Empty-state helpers
 * ======================================================= */

/**
 * Creates a fresh empty public map payload.
 *
 * A function is used instead of a shared object so callers cannot
 * accidentally mutate state shared between requests.
 */
export function createEmptyPublicCreatorMapData(): PublicCreatorMapData {
  return {
    venues: [],
    counts: {
      explored: 0,
      recommended: 0,
    },
  }
}

/* =========================================================
 * Public venue helpers
 * ======================================================= */

/**
 * Returns whether a public map venue belongs to the requested mode.
 */
export function publicCreatorMapVenueMatchesMode({
  venue,
  mode,
}: {
  venue: PublicCreatorMapVenue
  mode: CreatorMapMode
}): boolean {
  return mode === 'explored'
    ? venue.explored
    : venue.recommended
}

/**
 * Returns venues belonging to one public map mode.
 *
 * The original array is not mutated.
 */
export function filterPublicCreatorMapVenuesByMode({
  venues,
  mode,
}: {
  venues: readonly PublicCreatorMapVenue[]
  mode: CreatorMapMode
}): PublicCreatorMapVenue[] {
  return venues.filter((venue) =>
    publicCreatorMapVenueMatchesMode({
      venue,
      mode,
    })
  )
}

/**
 * Recalculates canonical counts from a finalized public venue array.
 *
 * Loader code should use this only after:
 *
 * - invalid venue coordinates are removed
 * - duplicate venue IDs are merged
 * - public collection relationships are deduplicated
 */
export function countPublicCreatorMapVenues(
  venues: readonly PublicCreatorMapVenue[]
): PublicCreatorMapCounts {
  let explored = 0
  let recommended = 0

  for (const venue of venues) {
    if (venue.explored) {
      explored += 1
    }

    if (venue.recommended) {
      recommended += 1
    }
  }

  return {
    explored,
    recommended,
  }
}

/* =========================================================
 * Privacy boundary documentation
 * ======================================================= */

/**
 * Fields intentionally excluded from all public map contracts:
 *
 * - user_id
 * - venue_visits.id
 * - venue_visits.user_lat
 * - venue_visits.user_lon
 * - venue_visits.distance_meters
 * - venue_visits.location_accuracy_meters
 * - venue_visits.device_timestamp
 * - venue_visits.visited_at
 * - venue_visits.visit_date
 * - venue_visits.rating
 * - venue_visits.check_in_source
 * - venue_visits.geo_verified
 * - private collection identifiers
 * - private collection membership
 * - raw active-flow check-in evidence
 *
 * Eligibility may depend on private source fields server-side,
 * but those fields must never be copied into this public contract.
 */