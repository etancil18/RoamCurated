
/**
 * lib/explore/venueEligibility.ts
 *
 * Canonical venue eligibility rules for RoamCurated's
 * Explore Places initiative.
 *
 * Explore-specific business rules:
 *
 * - The public.venues table is the live venue inventory.
 * - Venues classified with city = 'oob' are excluded.
 * - profile_status is NOT a publication gate for Explore.
 * - A valid venue identity and non-empty name are required.
 * - Missing coordinates do not prevent discovery.
 * - Invalid coordinates prevent distance-based features.
 *
 * This module is pure:
 *
 * - No database queries
 * - No authentication or authorization changes
 * - No venue mutations
 * - No dependency on creator reputation eligibility
 *
 * Callers must fetch venues through an appropriately
 * authorized database client and project only public-safe
 * metadata into guest-facing responses.
 */

/* =========================================================
 * Contracts
 * ======================================================= */

export type ExploreVenueEligibilityInput = {
  id: unknown
  name: unknown
  city: unknown
  lat?: unknown
  lon?: unknown
  profile_status?: unknown
}

export type ExploreVenueEligibilityFailureReason =
  | 'invalid_id'
  | 'invalid_name'
  | 'invalid_city'
  | 'out_of_bounds'

export type ExploreVenueIdentity = {
  id: string
  name: string
  city: string
}

export type ExploreVenueCoordinates = {
  lat: number
  lon: number
}

export type EligibleExploreVenue = ExploreVenueIdentity & {
  coordinates: ExploreVenueCoordinates | null
  supportsDistance: boolean
}

export type ExploreVenueEligibilityResult =
  | {
      eligible: true
      venue: EligibleExploreVenue
    }
  | {
      eligible: false
      reason: ExploreVenueEligibilityFailureReason
    }

/* =========================================================
 * Configuration
 * ======================================================= */

/**
 * The only explicitly excluded city classification.
 *
 * Keep this separate from venue types, vibes, tags, tiers,
 * and profile statuses.
 */
export const EXPLORE_EXCLUDED_CITY =
  'oob' as const

/**
 * UUID validation for canonical venues.id values.
 *
 * Supports standard UUID formats with valid variant and
 * version bits, including versions 1-8.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/* =========================================================
 * City eligibility
 * ======================================================= */

/**
 * Returns whether a venue's city classification is
 * eligible for Explore Places.
 *
 * Excludes:
 * - "oob", case-insensitively
 * - null or undefined city
 * - empty or whitespace-only city
 *
 * Does not restrict venues to a hardcoded list of cities.
 * Newly added live city classifications can participate
 * without requiring code changes.
 */
export function isExploreCityEligible(
  city: unknown
): boolean {
  const normalized = normalizeCity(city)

  return (
    normalized !== null &&
    normalized.toLowerCase() !==
      EXPLORE_EXCLUDED_CITY
  )
}

/**
 * Normalizes a database city classification while
 * preserving its actual stored spelling.
 *
 * Example:
 * " los angeles " -> "los angeles"
 *
 * City display labels should be handled separately by
 * the Explore interface.
 */
export function normalizeExploreCity(
  city: unknown
): string | null {
  return normalizeCity(city)
}

/* =========================================================
 * Coordinate validation
 * ======================================================= */

/**
 * Returns valid geographic coordinates or null.
 *
 * Coordinates are optional for catalog discovery.
 * They are required only for location-dependent features,
 * such as distance calculations and nearest sorting.
 *
 * Does not interpret missing coordinates as (0, 0).
 */
export function getExploreVenueCoordinates(
  venue: {
    lat?: unknown
    lon?: unknown
  }
): ExploreVenueCoordinates | null {
  const lat = normalizeFiniteCoordinate(
    venue.lat
  )

  const lon = normalizeFiniteCoordinate(
    venue.lon
  )

  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null
  }

  return {
    lat,
    lon,
  }
}

/* =========================================================
 * Primary eligibility evaluator
 * ======================================================= */

/**
 * Evaluates whether a venue can participate in the
 * Explore Places catalog.
 *
 * This is a discovery-specific business-rule check,
 * not a replacement for database access control.
 *
 * Eligibility:
 *
 * 1. Valid canonical UUID
 * 2. Non-empty venue name
 * 3. Non-empty city classification
 * 4. City is not classified as "oob"
 *
 * Not used as exclusion criteria:
 *
 * - profile_status
 * - cover
 * - description
 * - tags
 * - vibe
 * - type
 * - price
 * - coordinates
 *
 * Venue coordinates are separately validated and
 * exposed only when usable.
 */
export function evaluateExploreVenueEligibility(
  venue: ExploreVenueEligibilityInput
): ExploreVenueEligibilityResult {
  const id = normalizeUuid(
    venue.id
  )

  if (!id) {
    return {
      eligible: false,
      reason: 'invalid_id',
    }
  }

  const name = normalizeRequiredText(
    venue.name
  )

  if (!name) {
    return {
      eligible: false,
      reason: 'invalid_name',
    }
  }

  const city = normalizeCity(
    venue.city
  )

  if (!city) {
    return {
      eligible: false,
      reason: 'invalid_city',
    }
  }

  if (
    city.toLowerCase() ===
    EXPLORE_EXCLUDED_CITY
  ) {
    return {
      eligible: false,
      reason: 'out_of_bounds',
    }
  }

  const coordinates =
    getExploreVenueCoordinates(
      venue
    )

  return {
    eligible: true,
    venue: {
      id,
      name,
      city,
      coordinates,
      supportsDistance:
        coordinates !== null,
    },
  }
}

/* =========================================================
 * Convenience helpers
 * ======================================================= */

/**
 * Boolean wrapper for Explore eligibility.
 */
export function isExploreVenueEligible(
  venue: ExploreVenueEligibilityInput
): boolean {
  return evaluateExploreVenueEligibility(
    venue
  ).eligible
}

/**
 * Filters a collection of venue-like records into
 * normalized Explore-safe identities.
 *
 * The original database rows are deliberately not
 * returned. This prevents the eligibility helper
 * from accidentally forwarding private metadata
 * such as venues.access_token.
 *
 * Additional public metadata must be explicitly
 * projected by the calling API.
 */
export function getEligibleExploreVenues(
  venues:
    readonly ExploreVenueEligibilityInput[]
): EligibleExploreVenue[] {
  const results: EligibleExploreVenue[] = []

  for (const venue of venues) {
    const evaluation =
      evaluateExploreVenueEligibility(
        venue
      )

    if (
      evaluation.eligible
    ) {
      results.push(
        evaluation.venue
      )
    }
  }

  return results
}

/* =========================================================
 * Internal normalization
 * ======================================================= */

function normalizeRequiredText(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeCity(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeUuid(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized = value
    .trim()
    .toLowerCase()

  return UUID_PATTERN.test(
    normalized
  )
    ? normalized
    : null
}

function normalizeFiniteCoordinate(
  value: unknown
): number | null {
  if (
    typeof value === 'number'
  ) {
    return Number.isFinite(value)
      ? value
      : null
  }

  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  const parsed =
    Number(normalized)

  return Number.isFinite(parsed)
    ? parsed
    : null
}
