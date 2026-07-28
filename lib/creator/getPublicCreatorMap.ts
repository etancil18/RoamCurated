import 'server-only'

import type {
  SupabaseClient,
} from '@supabase/supabase-js'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin'

import type {
  PublicCreatorMapData,
  PublicCreatorMapVenue,
} from '@/lib/creator/mapTypes'

import {
  evaluatePublicVenueEligibility,
  type PublicVenueEligibilityInput,
} from '@/lib/venues/publicVenueEligibility'

/* =========================================================
 * Public loader contract
 * ======================================================= */

export type PublicCreatorMapLoadErrorCode =
  | 'PROFILE_QUERY_FAILED'
  | 'VISITS_QUERY_FAILED'
  | 'VENUES_QUERY_FAILED'
  | 'INVALID_DATABASE_DATA'

/**
 * Stable application-facing error raised when a public creator
 * exploration map cannot be loaded safely.
 *
 * Database details are logged server-side and are never exposed
 * through the public error message.
 */
export class PublicCreatorMapLoadError extends Error {
  readonly code:
    PublicCreatorMapLoadErrorCode

  constructor({
    code,
    message,
    cause,
  }: {
    code:
      PublicCreatorMapLoadErrorCode
    message: string
    cause?: unknown
  }) {
    super(message, {
      cause,
    })

    this.name =
      'PublicCreatorMapLoadError'

    this.code = code
  }
}

/* =========================================================
 * Internal database row contracts
 * ======================================================= */

type ProfileRow = {
  id?: unknown
  is_public?: unknown
  creator_mode_enabled?: unknown
  show_public_exploration_map?: unknown
}

type VenueVisitRow = {
  venue_id?: unknown
}

type VenueRow = {
  id?: unknown
  name?: unknown
  slug?: unknown
  city?: unknown
  category?: unknown
  description?: unknown
  cover_image_url?: unknown
  lat?: unknown
  lon?: unknown
  profile_status?: unknown
}

type NormalizedPublicVenueEligibilityInput = {
  id: string
  name: string
  lat: number
  lon: number
  profile_status: string | null
}

/* =========================================================
 * Loader options
 * ======================================================= */

export type GetPublicCreatorMapOptions = {
  /**
   * Creator profile owner.
   */
  userId: string

  /**
   * Maximum number of public venues returned.
   *
   * Defaults to 250 and is constrained to a safe range.
   */
  venueLimit?: number

  /**
   * Optional trusted service-role client injection.
   *
   * This exists primarily for automated tests. Production
   * callers should omit it and allow the loader to resolve the
   * canonical Supabase admin client.
   *
   * Never pass a browser or anon client here.
   */
  adminClient?: SupabaseClient
}

/* =========================================================
 * Main loader
 * ======================================================= */

/**
 * Loads the public Creator Exploration Map for one creator.
 *
 * Returns:
 *
 * - `null` when the creator map must not be displayed
 * - `PublicCreatorMapData` when all publication gates pass
 * - throws `PublicCreatorMapLoadError` when a required query
 *   fails or returns structurally invalid data
 *
 * Publication requires all of the following:
 *
 * 1. the profile exists
 * 2. the profile is public
 * 3. Creator Mode is enabled
 * 4. show_public_exploration_map is exactly true
 *
 * Venue visits remain protected by owner-scoped RLS. This
 * trusted server-only loader uses the service-role client to
 * read the creator's verified visits, then returns only a
 * deliberately limited public projection.
 */
export async function getPublicCreatorMap({
  userId,
  venueLimit = 250,
  adminClient,
}: GetPublicCreatorMapOptions): Promise<
  PublicCreatorMapData | null
> {
  const normalizedUserId =
    normalizeIdentifier(userId)

  if (!normalizedUserId) {
    return null
  }

  const resolvedVenueLimit =
    clampInteger({
      value: venueLimit,
      minimum: 1,
      maximum: 500,
      fallback: 250,
    })

  const supabase =
    adminClient ??
    getSupabaseAdmin()

  const profileResult =
    await supabase
      .from('profiles')
      .select(`
        id,
        is_public,
        creator_mode_enabled,
        show_public_exploration_map
      `)
      .eq(
        'id',
        normalizedUserId
      )
      .maybeSingle()

  if (profileResult.error) {
    throwQueryError({
      code:
        'PROFILE_QUERY_FAILED',
      operation:
        'creator map publication profile',
      error:
        profileResult.error,
      userId:
        normalizedUserId,
    })
  }

  if (!profileResult.data) {
    return null
  }

  const profile =
    parsePublicationProfile({
      value:
        profileResult.data,
      expectedUserId:
        normalizedUserId,
    })

  if (
    !profile.isPublic ||
    !profile.creatorModeEnabled ||
    !profile.showPublicExplorationMap
  ) {
    return null
  }

  const visitsResult =
    await supabase
      .from('venue_visits')
      .select('venue_id')
      .eq(
        'user_id',
        normalizedUserId
      )
      .eq(
        'geo_verified',
        true
      )

  if (visitsResult.error) {
    throwQueryError({
      code:
        'VISITS_QUERY_FAILED',
      operation:
        'verified creator venue visits',
      error:
        visitsResult.error,
      userId:
        normalizedUserId,
    })
  }

  const venueIds =
    normalizeVisitedVenueIds(
      visitsResult.data
    )

  if (venueIds.length === 0) {
    return {
      venues: [],

      counts: {
        explored: 0,
        recommended: 0,
      },
    }
  }

  /**
   * Cap the number of IDs before issuing venue queries.
   *
   * The final result is also capped after validation and
   * deduplication.
   */
  const limitedVenueIds =
    venueIds.slice(
      0,
      resolvedVenueLimit
    )

  const venueRows =
    await loadVenueRows({
      supabase,
      userId:
        normalizedUserId,
      venueIds:
        limitedVenueIds,
    })

  const venues =
    parsePublicCreatorMapVenues({
      value:
        venueRows,
      expectedVenueIds:
        new Set(
          limitedVenueIds
        ),
      venueLimit:
        resolvedVenueLimit,
    })

  return {
    venues,

    counts: {
      explored:
        venues.filter(
          (venue) =>
            venue.explored
        ).length,

      recommended:
        venues.filter(
          (venue) =>
            venue.recommended
        ).length,
    },
  }
}

/* =========================================================
 * Profile publication parsing
 * ======================================================= */

function parsePublicationProfile({
  value,
  expectedUserId,
}: {
  value: unknown
  expectedUserId: string
}): {
  isPublic: boolean
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
} {
  if (!isRecord(value)) {
    throwInvalidDatabaseData({
      entity:
        'profiles',
      value,
    })
  }

  const row =
    value as ProfileRow

  const id =
    normalizeIdentifier(
      row.id
    )

  if (
    !id ||
    id !== expectedUserId
  ) {
    throwInvalidDatabaseData({
      entity:
        'profiles.id',
      value:
        row.id,
      expectedValue:
        expectedUserId,
    })
  }

  if (
    typeof row.is_public !==
      'boolean' &&
    row.is_public !== null
  ) {
    throwInvalidDatabaseData({
      entity:
        'profiles.is_public',
      value:
        row.is_public,
    })
  }

  if (
    typeof row.creator_mode_enabled !==
    'boolean'
  ) {
    throwInvalidDatabaseData({
      entity:
        'profiles.creator_mode_enabled',
      value:
        row.creator_mode_enabled,
    })
  }

  /**
   * This is an explicit privacy opt-in and therefore must be
   * a real boolean. Missing, null, string, or numeric values
   * are treated as malformed data rather than silently
   * publishing the map.
   */
  if (
    typeof row.show_public_exploration_map !==
    'boolean'
  ) {
    throwInvalidDatabaseData({
      entity:
        'profiles.show_public_exploration_map',
      value:
        row.show_public_exploration_map,
    })
  }

  return {
    /**
     * Existing profile semantics treat null as public.
     */
    isPublic:
      row.is_public !== false,

    creatorModeEnabled:
      row.creator_mode_enabled ===
      true,

    showPublicExplorationMap:
      row.show_public_exploration_map ===
      true,
  }
}

/* =========================================================
 * Verified-visit parsing
 * ======================================================= */

function normalizeVisitedVenueIds(
  value: unknown
): string[] {
  if (
    value === null ||
    value === undefined
  ) {
    return []
  }

  if (!Array.isArray(value)) {
    throwInvalidDatabaseData({
      entity:
        'venue_visits',
      value,
    })
  }

  const venueIds: string[] = []
  const seen =
    new Set<string>()

  value.forEach(
    (
      entry,
      index
    ) => {
      if (!isRecord(entry)) {
        throwInvalidDatabaseData({
          entity:
            `venue_visits[${index}]`,
          value:
            entry,
        })
      }

      const row =
        entry as VenueVisitRow

      const venueId =
        normalizeIdentifier(
          row.venue_id
        )

      if (!venueId) {
        throwInvalidDatabaseData({
          entity:
            `venue_visits[${index}].venue_id`,
          value:
            row.venue_id,
        })
      }

      if (seen.has(venueId)) {
        return
      }

      seen.add(venueId)
      venueIds.push(venueId)
    }
  )

  return venueIds
}

/* =========================================================
 * Venue loading
 * ======================================================= */

async function loadVenueRows({
  supabase,
  userId,
  venueIds,
}: {
  supabase: SupabaseClient
  userId: string
  venueIds: string[]
}): Promise<unknown[]> {
  if (venueIds.length === 0) {
    return []
  }

  /**
   * Split large IN queries to avoid oversized request URLs and
   * keep individual database requests predictable.
   */
  const venueIdChunks =
    chunkArray(
      venueIds,
      100
    )

  const queryResults =
    await Promise.all(
      venueIdChunks.map(
        (venueIdChunk) =>
          supabase
            .from('venues')
            .select(`
              id,
              name,
              slug,
              city,
              category:tier,
              description,
              cover_image_url:cover,
              lat,
              lon,
              profile_status
            `)
            .in(
              'id',
              venueIdChunk
            )
      )
    )

  const rows: unknown[] = []

  for (
    let index = 0;
    index <
    queryResults.length;
    index += 1
  ) {
    const result =
      queryResults[index]

    if (result.error) {
      throwQueryError({
        code:
          'VENUES_QUERY_FAILED',
        operation:
          `public creator map venues batch ${index + 1}`,
        error:
          result.error,
        userId,
      })
    }

    if (
      result.data !== null &&
      result.data !== undefined &&
      !Array.isArray(
        result.data
      )
    ) {
      throwInvalidDatabaseData({
        entity:
          `venues batch ${index + 1}`,
        value:
          result.data,
      })
    }

    rows.push(
      ...(
        result.data ??
        []
      )
    )
  }

  return rows
}

/* =========================================================
 * Public venue parsing
 * ======================================================= */

function parsePublicCreatorMapVenues({
  value,
  expectedVenueIds,
  venueLimit,
}: {
  value: unknown
  expectedVenueIds: Set<string>
  venueLimit: number
}): PublicCreatorMapVenue[] {
  if (
    value === null ||
    value === undefined
  ) {
    return []
  }

  if (!Array.isArray(value)) {
    throwInvalidDatabaseData({
      entity:
        'venues',
      value,
    })
  }

  const venuesById =
    new Map<
      string,
      PublicCreatorMapVenue
    >()

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const entry =
      value[index]

    if (!isRecord(entry)) {
      throwInvalidDatabaseData({
        entity:
          `venues[${index}]`,
        value:
          entry,
      })
    }

    const row =
      entry as VenueRow

    const eligibilityInput =
      toPublicVenueEligibilityInput(
        row
      )

    /**
     * Rows that cannot form a valid eligibility input are
     * omitted rather than exposed or allowed to crash the
     * entire creator profile.
     */
    if (!eligibilityInput) {
      continue
    }

    if (
      !expectedVenueIds.has(
        eligibilityInput.id
      )
    ) {
      throwInvalidDatabaseData({
        entity:
          `venues[${index}].id`,
        value:
          eligibilityInput.id,
        expectedValue:
          'A venue ID present in the verified visit set.',
      })
    }

    const eligibility =
      evaluatePublicVenueEligibility({
        id:
          eligibilityInput.id,

        name:
          eligibilityInput.name,

        lat:
          eligibilityInput.lat,

        lon:
          eligibilityInput.lon,

        profile_status:
          eligibilityInput.profile_status,
      } satisfies PublicVenueEligibilityInput)

    if (
      !isEligibilityApproved(
        eligibility
      )
    ) {
      continue
    }

    const venue =
      toPublicCreatorMapVenue(
        row,
        eligibilityInput
      )

    if (!venue) {
      continue
    }

    if (
      !venuesById.has(
        venue.id
      )
    ) {
      venuesById.set(
        venue.id,
        venue
      )
    }

    if (
      venuesById.size >=
      venueLimit
    ) {
      break
    }
  }

  return [
    ...venuesById.values(),
  ].sort(
    comparePublicCreatorMapVenues
  )
}

/**
 * Narrows an untrusted venue row into the exact input required
 * by the canonical public-venue eligibility function.
 *
 * Do not replace this with a type assertion.
 */
function toPublicVenueEligibilityInput(
  row: VenueRow
): NormalizedPublicVenueEligibilityInput | null {
  const id =
    normalizeIdentifier(
      row.id
    )

  const name =
    normalizeRequiredText(
      row.name,
      240
    )

  const lat =
    normalizeLatitude(
      row.lat
    )

  const lon =
    normalizeLongitude(
      row.lon
    )

  if (
    !id ||
    !name ||
    lat === null ||
    lon === null
  ) {
    return null
  }

  return {
    id,
    name,
    lat,
    lon,

    profile_status:
      normalizeOptionalText(
        row.profile_status,
        120
      ),
  }
}

/**
 * Supports both the canonical boolean result and a structured
 * eligibility decision without coupling this loader to
 * presentation-only reason fields.
 */
function isEligibilityApproved(
  value: unknown
): boolean {
  if (
    typeof value ===
    'boolean'
  ) {
    return value
  }

  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.eligible ===
    'boolean'
  ) {
    return value.eligible
  }

  if (
    typeof value.isEligible ===
    'boolean'
  ) {
    return value.isEligible
  }

  if (
    typeof value.publiclyDisplayable ===
    'boolean'
  ) {
    return value.publiclyDisplayable
  }

  if (
    typeof value.allowed ===
    'boolean'
  ) {
    return value.allowed
  }

  return false
}

function toPublicCreatorMapVenue(
  row: VenueRow,
  eligibilityInput:
    NormalizedPublicVenueEligibilityInput
): PublicCreatorMapVenue | null {
  const slug =
    normalizeOptionalText(
      row.slug,
      240
    )

  const city =
    normalizeOptionalText(
      row.city,
      160
    )

  const category =
    normalizeOptionalText(
      row.category,
      160
    )

  const coverImageUrl =
  normalizePublicImageSource(
    row.cover_image_url
  )

  return {
    id:
      eligibilityInput.id,

    name:
      eligibilityInput.name,

    slug,
    city,
    category,
    coverImageUrl,

    lat:
      eligibilityInput.lat,

    lon:
      eligibilityInput.lon,

    explored:
      true,

    recommended:
      false,

    publicCollections:
      [],
  }
}

function comparePublicCreatorMapVenues(
  first: PublicCreatorMapVenue,
  second: PublicCreatorMapVenue
): number {
  const cityComparison =
    (
      first.city ??
      ''
    ).localeCompare(
      second.city ??
      '',
      undefined,
      {
        sensitivity:
          'base',
      }
    )

  if (
    cityComparison !== 0
  ) {
    return cityComparison
  }

  const nameComparison =
    first.name.localeCompare(
      second.name,
      undefined,
      {
        sensitivity:
          'base',
      }
    )

  if (
    nameComparison !== 0
  ) {
    return nameComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

/* =========================================================
 * Error helpers
 * ======================================================= */

function throwQueryError({
  code,
  operation,
  error,
  userId,
}: {
  code:
    Exclude<
      PublicCreatorMapLoadErrorCode,
      'INVALID_DATABASE_DATA'
    >
  operation: string
  error: unknown
  userId: string
}): never {
  console.error(
    `[getPublicCreatorMap] Failed to load ${operation}:`,
    {
      userId,
      error:
        serializeUnknownError(
          error
        ),
    }
  )

  throw new PublicCreatorMapLoadError({
    code,

    message:
      'This creator exploration map could not be loaded. Please try again.',

    cause:
      error,
  })
}

function throwInvalidDatabaseData({
  entity,
  value,
  expectedValue,
}: {
  entity: string
  value: unknown
  expectedValue?: unknown
}): never {
  console.error(
    '[getPublicCreatorMap] Invalid database data:',
    {
      entity,
      value,
      expectedValue,
    }
  )

  throw new PublicCreatorMapLoadError({
    code:
      'INVALID_DATABASE_DATA',

    message:
      'This creator exploration map contains invalid data and cannot currently be displayed.',

    cause: {
      entity,
      expectedValue,
    },
  })
}

/* =========================================================
 * Normalization helpers
 * ======================================================= */

function normalizeIdentifier(
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

  if (
    !normalized ||
    normalized.length >
      200 ||
    /[\r\n]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeRequiredText(
  value: unknown,
  maximumLength: number
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (
    !normalized ||
    normalized.length >
      maximumLength
  ) {
    return null
  }

  return normalized
}

function normalizeOptionalText(
  value: unknown,
  maximumLength: number
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    maximumLength
  )
}

function normalizeLatitude(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < -90 ||
    value > 90
  ) {
    return null
  }

  return value
}

function normalizeLongitude(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < -180 ||
    value > 180
  ) {
    return null
  }

  return value
}

function normalizePublicImageSource(
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

  if (!normalized) {
    return null
  }

  /**
   * Venue cover values are stored as public application-relative
   * paths such as:
   *
   *   img/venues/3THYME COFFEE.jpg
   *
   * Normalize them into browser-safe root-relative URLs without
   * deriving anything from the venue slug or venue name.
   */
  const relativeVenueImagePath =
    normalized.startsWith(
      '/img/venues/'
    )
      ? normalized
      : normalized.startsWith(
            'img/venues/'
          )
        ? `/${normalized}`
        : null

  if (
    relativeVenueImagePath
  ) {
    if (
      relativeVenueImagePath.includes(
        '..'
      ) ||
      relativeVenueImagePath.includes(
        '\\'
      ) ||
      /[\r\n]/.test(
        relativeVenueImagePath
      )
    ) {
      return null
    }

    return encodePublicImagePath(
      relativeVenueImagePath
    )
  }

  return normalizePublicUrl(
    normalized
  )
}

function encodePublicImagePath(
  path: string
): string {
  return path
    .split('/')
    .map(
      (
        segment,
        index
      ) =>
        index === 0
          ? ''
          : encodeURIComponent(
              decodeURIComponentSafe(
                segment
              )
            )
    )
    .join('/')
}

function decodeURIComponentSafe(
  value: string
): string {
  try {
    return decodeURIComponent(
      value
    )
  } catch {
    return value
  }
}

function normalizePublicUrl(
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

  if (!normalized) {
    return null
  }

  try {
    const parsed =
      new URL(
        normalized
      )

    if (
      parsed.protocol !==
        'https:' &&
      parsed.protocol !==
        'http:'
    ) {
      return null
    }

    if (
      parsed.username ||
      parsed.password ||
      !parsed.hostname ||
      isPrivateOrLocalHostname(
        parsed.hostname
      )
    ) {
      return null
    }

    parsed.hash = ''

    return parsed.toString()
  } catch {
    return null
  }
}

function isPrivateOrLocalHostname(
  hostname: string
): boolean {
  const normalized =
    hostname
      .trim()
      .toLowerCase()
      .replace(
        /^\[|\]$/g,
        ''
      )
      .replace(
        /\.$/,
        ''
      )

  if (
    !normalized ||
    normalized ===
      'localhost' ||
    normalized.endsWith(
      '.localhost'
    ) ||
    normalized.endsWith(
      '.local'
    )
  ) {
    return true
  }

  if (
    /^10\./.test(
      normalized
    ) ||
    /^127\./.test(
      normalized
    ) ||
    /^169\.254\./.test(
      normalized
    ) ||
    /^192\.168\./.test(
      normalized
    ) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      normalized
    )
  ) {
    return true
  }

  if (
    normalized ===
      '::1' ||
    normalized.startsWith(
      'fc'
    ) ||
    normalized.startsWith(
      'fd'
    ) ||
    normalized.startsWith(
      'fe80'
    )
  ) {
    return true
  }

  return false
}

function clampInteger({
  value,
  minimum,
  maximum,
  fallback,
}: {
  value: number
  minimum: number
  maximum: number
  fallback: number
}): number {
  if (
    !Number.isFinite(
      value
    ) ||
    !Number.isInteger(
      value
    )
  ) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  )
}

function chunkArray<T>(
  values: T[],
  size: number
): T[][] {
  if (
    values.length === 0
  ) {
    return []
  }

  const safeSize =
    Math.max(
      1,
      Math.trunc(
        size
      )
    )

  const chunks: T[][] =
    []

  for (
    let index = 0;
    index <
    values.length;
    index +=
    safeSize
  ) {
    chunks.push(
      values.slice(
        index,
        index +
          safeSize
      )
    )
  }

  return chunks
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function serializeUnknownError(
  error: unknown
): Record<
  string,
  unknown
> {
  if (
    error instanceof
    Error
  ) {
    return {
      name:
        error.name,
      message:
        error.message,
    }
  }

  if (isRecord(error)) {
    return {
      code:
        error.code,
      message:
        error.message,
      details:
        error.details,
      hint:
        error.hint,
    }
  }

  return {
    value:
      String(error),
  }
}