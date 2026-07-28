/**
 * Canonical public-display eligibility for Roam venues.
 *
 * IMPORTANT:
 *
 * This module only validates whether an individual venue row is
 * structurally eligible to appear on a public surface.
 *
 * It does not establish that a creator is authorized to publish or
 * reference the venue. Callers must first derive venue IDs from an
 * approved public source, such as:
 *
 * - the creator's public collections
 * - the creator's geo-verified venue visits
 *
 * Do not use this helper to fetch or expose the complete venues table.
 */

/* =========================================================
 * Current publication semantics
 * ======================================================= */

/**
 * Temporary legacy publication rule.
 *
 * The current venues table contains only the status `draft`, and that
 * status is not yet functioning as a real editorial workflow state.
 *
 * Until venue publication semantics are formally migrated, `draft` is
 * treated as the only known displayable status.
 *
 * This is intentionally fail-closed:
 *
 * - unknown statuses are rejected
 * - null or empty statuses are rejected
 * - future statuses do not become public automatically
 *
 * When the venue lifecycle is formalized, replace this set with the
 * canonical published status, preferably:
 *
 *   new Set(['published'])
 */
export const PUBLIC_VENUE_PROFILE_STATUSES =
  new Set<string>(['draft'])

/* =========================================================
 * Public contracts
 * ======================================================= */

export type PublicVenueEligibilityInput = {
  id: unknown
  name: unknown
  lat: unknown
  lon: unknown
  profile_status?: unknown
}

export type PublicVenueEligibilityFailureReason =
  | 'invalid_id'
  | 'invalid_name'
  | 'invalid_coordinates'
  | 'profile_status_not_public'

export type EligiblePublicVenueIdentity = {
  id: string
  name: string
  lat: number
  lon: number
  profileStatus: string
}

export type PublicVenueEligibilityResult =
  | {
      eligible: true
      venue: EligiblePublicVenueIdentity
    }
  | {
      eligible: false
      reason: PublicVenueEligibilityFailureReason
    }

/* =========================================================
 * Main eligibility evaluator
 * ======================================================= */

/**
 * Evaluates whether a venue has the minimum safe data required for a
 * public map surface.
 *
 * This function:
 *
 * - validates the venue UUID
 * - requires a non-empty venue name
 * - validates latitude and longitude
 * - applies the current fail-closed profile-status rule
 * - returns normalized public-safe identity fields
 *
 * Missing slugs, covers, descriptions, hours, and city values do not
 * make a venue ineligible. Those fields are optional presentation data.
 */
export function evaluatePublicVenueEligibility(
  venue: PublicVenueEligibilityInput
): PublicVenueEligibilityResult {
  const id = normalizeUuid(venue.id)

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

  const lat = normalizeCoordinate(
    venue.lat
  )

  const lon = normalizeCoordinate(
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
    return {
      eligible: false,
      reason:
        'invalid_coordinates',
    }
  }

  const profileStatus =
    normalizeProfileStatus(
      venue.profile_status
    )

  if (
    !profileStatus ||
    !PUBLIC_VENUE_PROFILE_STATUSES.has(
      profileStatus
    )
  ) {
    return {
      eligible: false,
      reason:
        'profile_status_not_public',
    }
  }

  return {
    eligible: true,
    venue: {
      id,
      name,
      lat,
      lon,
      profileStatus,
    },
  }
}

/**
 * Boolean convenience wrapper.
 *
 * Use evaluatePublicVenueEligibility() when the caller needs the
 * normalized venue identity or the rejection reason.
 */
export function isPublicVenueEligible(
  venue: PublicVenueEligibilityInput
): boolean {
  return evaluatePublicVenueEligibility(
    venue
  ).eligible
}

/**
 * Filters venue-like rows and returns their normalized public identities.
 *
 * The original rows are intentionally not returned so malformed or
 * unvalidated values cannot accidentally reach a public map component.
 */
export function getEligiblePublicVenueIdentities(
  venues:
    readonly PublicVenueEligibilityInput[]
): EligiblePublicVenueIdentity[] {
  const eligibleVenues:
    EligiblePublicVenueIdentity[] = []

  for (const venue of venues) {
    const result =
      evaluatePublicVenueEligibility(
        venue
      )

    if (result.eligible) {
      eligibleVenues.push(
        result.venue
      )
    }
  }

  return eligibleVenues
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeUuid(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim().toLowerCase()

  if (
    !UUID_PATTERN.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeRequiredText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeCoordinate(
  value: unknown
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return value
}

function normalizeProfileStatus(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .toLowerCase()

  return normalized.length > 0
    ? normalized
    : null
}

/* =========================================================
 * Internal constants
 * ======================================================= */

/**
 * Accepts canonical UUID strings regardless of UUID version.
 *
 * Database ownership of the identifier remains authoritative; this
 * pattern only rejects malformed public-loader data.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i