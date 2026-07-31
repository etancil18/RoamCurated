import {
  isReputationCategoryId,
  type ReputationCategoryId,
} from '@/lib/reputation/types'

/**
 * Canonical venue-to-reputation-category mapping utilities.
 *
 * This module intentionally contains:
 *
 * - no Supabase client
 * - no database queries
 * - no React
 * - no environment access
 * - no hardcoded venue taxonomy
 *
 * Database-backed mapping rows remain the source of truth.
 * This module provides deterministic normalization, validation,
 * deduplication, indexing, and lookup behavior shared by rebuild
 * scripts, reputation calculation, and tests.
 */

/* =========================================================
 * Public constants
 * ======================================================= */

/**
 * Mapping weights are normalized to this inclusive range.
 *
 * A weight of:
 *
 * - `1` means full category attribution
 * - a fractional value means partial attribution
 * - `0` is rejected because it contributes no reputation
 */
export const MIN_REPUTATION_CATEGORY_MAPPING_WEIGHT =
  Number.EPSILON

export const MAX_REPUTATION_CATEGORY_MAPPING_WEIGHT =
  1

/**
 * Maximum normalized venue-type key length.
 *
 * This prevents uncontrolled external or malformed values from
 * becoming Map keys or database lookup parameters.
 */
export const MAX_VENUE_TYPE_KEY_LENGTH =
  160

/* =========================================================
 * Public contracts
 * ======================================================= */

/**
 * Raw mapping input accepted from database rows, migrations,
 * import jobs, or application code.
 *
 * Both camelCase and snake_case fields are supported so callers
 * can pass Supabase rows without reshaping them first.
 */
export type VenueCategoryMappingInput = {
  venueType?: unknown
  venue_type?: unknown

  categoryId?: unknown
  category_id?: unknown

  weight?: unknown
  mappingWeight?: unknown
  mapping_weight?: unknown

  priority?: unknown
  sortOrder?: unknown
  sort_order?: unknown

  active?: unknown
  isActive?: unknown
  is_active?: unknown
}

/**
 * Canonical normalized mapping.
 */
export type VenueCategoryMapping = {
  /**
   * Normalized venue-type key.
   *
   * Example:
   *
   * `coffee_shop`
   */
  venueType: string

  /**
   * Canonical reputation-category identifier.
   */
  categoryId: ReputationCategoryId

  /**
   * Attribution weight from greater than zero through one.
   */
  weight: number

  /**
   * Stable non-negative ordering value.
   */
  sortOrder: number
}

/**
 * Resolved reputation-category contribution for one venue type.
 */
export type ReputationCategoryMapping = {
  categoryId: ReputationCategoryId
  weight: number
}

/**
 * Immutable lookup index keyed by normalized venue type.
 */
export type VenueCategoryMappingIndex =
  ReadonlyMap<
    string,
    readonly VenueCategoryMapping[]
  >

/**
 * Detailed normalization result for import, migration, and
 * administrative tooling.
 */
export type NormalizeVenueCategoryMappingsResult = {
  mappings: VenueCategoryMapping[]
  rejected: Array<{
    index: number
    value: unknown
    reason: VenueCategoryMappingRejectionReason
  }>
}

export type VenueCategoryMappingRejectionReason =
  | 'invalid_record'
  | 'inactive'
  | 'invalid_venue_type'
  | 'invalid_category_id'
  | 'invalid_weight'

/* =========================================================
 * Single-row normalization
 * ======================================================= */

/**
 * Normalizes one venue-to-category mapping.
 *
 * Returns `null` when:
 *
 * - the input is not an object
 * - the row is explicitly inactive
 * - the venue type is invalid
 * - the category ID is not canonical
 * - the weight is invalid or non-positive
 */
export function normalizeVenueCategoryMapping(
  value: unknown
): VenueCategoryMapping | null {
  if (!isRecord(value)) {
    return null
  }

  if (isExplicitlyInactive(value)) {
    return null
  }

  const venueType =
    normalizeVenueTypeKey(
      firstDefined(
        value.venueType,
        value.venue_type
      )
    )

  if (!venueType) {
    return null
  }

  const rawCategoryId =
    normalizeRequiredText(
      firstDefined(
        value.categoryId,
        value.category_id
      )
    )

  if (
    !rawCategoryId ||
    !isReputationCategoryId(
      rawCategoryId
    )
  ) {
    return null
  }

  const weight =
    normalizeCategoryMappingWeight(
      firstDefined(
        value.weight,
        value.mappingWeight,
        value.mapping_weight
      )
    )

  if (weight === null) {
    return null
  }

  const sortOrder =
    normalizeNonNegativeInteger(
      firstDefined(
        value.sortOrder,
        value.sort_order,
        value.priority
      )
    ) ?? 0

  return {
    venueType,
    categoryId:
      rawCategoryId,
    weight,
    sortOrder,
  }
}

/* =========================================================
 * Batch normalization
 * ======================================================= */

/**
 * Normalizes and deduplicates mapping rows.
 *
 * Duplicate identity is:
 *
 *   venueType + categoryId
 *
 * When duplicates exist, this function retains:
 *
 * 1. the highest weight
 * 2. then the lowest sort order
 *
 * The output is sorted deterministically by:
 *
 * 1. venue type
 * 2. sort order
 * 3. descending weight
 * 4. category ID
 */
export function normalizeVenueCategoryMappings(
  value: unknown
): VenueCategoryMapping[] {
  return normalizeVenueCategoryMappingsDetailed(
    value
  ).mappings
}

/**
 * Detailed normalization variant that preserves rejected rows
 * and rejection reasons.
 */
export function normalizeVenueCategoryMappingsDetailed(
  value: unknown
): NormalizeVenueCategoryMappingsResult {
  if (!Array.isArray(value)) {
    return {
      mappings: [],
      rejected: [
        {
          index: -1,
          value,
          reason:
            'invalid_record',
        },
      ],
    }
  }

  const byIdentity =
    new Map<
      string,
      VenueCategoryMapping
    >()

  const rejected:
    NormalizeVenueCategoryMappingsResult['rejected'] =
    []

  value.forEach(
    (
      rawMapping,
      index
    ) => {
      const rejectionReason =
        getMappingRejectionReason(
          rawMapping
        )

      if (rejectionReason) {
        rejected.push({
          index,
          value:
            rawMapping,
          reason:
            rejectionReason,
        })

        return
      }

      const mapping =
        normalizeVenueCategoryMapping(
          rawMapping
        )

      if (!mapping) {
        rejected.push({
          index,
          value:
            rawMapping,
          reason:
            'invalid_record',
        })

        return
      }

      const identity =
        buildMappingIdentity(
          mapping
        )

      const existing =
        byIdentity.get(
          identity
        )

      if (
        !existing ||
        shouldReplaceMapping({
          existing,
          candidate:
            mapping,
        })
      ) {
        byIdentity.set(
          identity,
          mapping
        )
      }
    }
  )

  const mappings = [
    ...byIdentity.values(),
  ].sort(
    compareVenueCategoryMappings
  )

  return {
    mappings,
    rejected,
  }
}

/**
 * Compatibility alias for callers that use the longer domain
 * name.
 */
export const normalizeVenueReputationCategoryMappings =
  normalizeVenueCategoryMappings

/* =========================================================
 * Mapping index
 * ======================================================= */

/**
 * Builds an immutable lookup index keyed by normalized venue
 * type.
 */
export function buildVenueCategoryMappingIndex(
  value:
    | readonly VenueCategoryMapping[]
    | unknown
): VenueCategoryMappingIndex {
  const normalizedMappings =
    normalizeVenueCategoryMappings(
      value
    )

  const mutableIndex =
    new Map<
      string,
      VenueCategoryMapping[]
    >()

  for (
    const mapping of
      normalizedMappings
  ) {
    const existing =
      mutableIndex.get(
        mapping.venueType
      )

    if (existing) {
      existing.push(mapping)
    } else {
      mutableIndex.set(
        mapping.venueType,
        [mapping]
      )
    }
  }

  const immutableIndex =
    new Map<
      string,
      readonly VenueCategoryMapping[]
    >()

  for (
    const [
      venueType,
      mappings,
    ] of mutableIndex.entries()
  ) {
    immutableIndex.set(
      venueType,
      Object.freeze(
        [...mappings]
      )
    )
  }

  return immutableIndex
}

/* =========================================================
 * Mapping lookup
 * ======================================================= */

/**
 * Returns canonical category contributions for one venue type.
 *
 * The venue type is normalized before lookup.
 */
export function mapVenueTypeToReputationCategories({
  venueType,
  mappings,
  index,
}: {
  venueType: unknown

  /**
   * Supply either raw/normalized mappings or a prebuilt index.
   *
   * `index` is preferred for repeated lookups.
   */
  mappings?:
    | readonly VenueCategoryMapping[]
    | unknown

  index?:
    VenueCategoryMappingIndex
}): ReputationCategoryMapping[] {
  const normalizedVenueType =
    normalizeVenueTypeKey(
      venueType
    )

  if (!normalizedVenueType) {
    return []
  }

  const mappingIndex =
    index ??
    buildVenueCategoryMappingIndex(
      mappings ?? []
    )

  const matchedMappings =
    mappingIndex.get(
      normalizedVenueType
    ) ?? []

  return matchedMappings.map(
    (mapping) => ({
      categoryId:
        mapping.categoryId,
      weight:
        mapping.weight,
    })
  )
}

/**
 * Compatibility alias for direct category-mapping lookup.
 */
export const getReputationCategoryMappingsForVenueType =
  mapVenueTypeToReputationCategories

/**
 * Returns complete normalized mapping records for one venue
 * type, including sort order.
 */
export function getVenueCategoryMappings({
  venueType,
  mappings,
  index,
}: {
  venueType: unknown
  mappings?:
    | readonly VenueCategoryMapping[]
    | unknown
  index?:
    VenueCategoryMappingIndex
}): VenueCategoryMapping[] {
  const normalizedVenueType =
    normalizeVenueTypeKey(
      venueType
    )

  if (!normalizedVenueType) {
    return []
  }

  const mappingIndex =
    index ??
    buildVenueCategoryMappingIndex(
      mappings ?? []
    )

  return [
    ...(
      mappingIndex.get(
        normalizedVenueType
      ) ?? []
    ),
  ]
}

/**
 * Returns whether a normalized mapping exists between one venue
 * type and one canonical reputation category.
 */
export function hasVenueCategoryMapping({
  venueType,
  categoryId,
  mappings,
  index,
}: {
  venueType: unknown
  categoryId: unknown
  mappings?:
    | readonly VenueCategoryMapping[]
    | unknown
  index?:
    VenueCategoryMappingIndex
}): boolean {
  const normalizedVenueType =
    normalizeVenueTypeKey(
      venueType
    )

  const normalizedCategoryId =
    normalizeRequiredText(
      categoryId
    )

  if (
    !normalizedVenueType ||
    !normalizedCategoryId ||
    !isReputationCategoryId(
      normalizedCategoryId
    )
  ) {
    return false
  }

  const mappingIndex =
    index ??
    buildVenueCategoryMappingIndex(
      mappings ?? []
    )

  return (
    mappingIndex
      .get(
        normalizedVenueType
      )
      ?.some(
        (mapping) =>
          mapping.categoryId ===
          normalizedCategoryId
      ) ??
    false
  )
}

/* =========================================================
 * Category aggregation
 * ======================================================= */

/**
 * Combines category contributions from multiple venue types.
 *
 * Each venue type contributes at most once to each category.
 * Duplicate input venue types are ignored.
 *
 * Category weights are summed and rounded to avoid floating-point
 * drift. The result is sorted by descending total weight and then
 * category ID.
 */
export function aggregateVenueTypeCategoryMappings({
  venueTypes,
  mappings,
  index,
}: {
  venueTypes:
    readonly unknown[]
  mappings?:
    | readonly VenueCategoryMapping[]
    | unknown
  index?:
    VenueCategoryMappingIndex
}): ReputationCategoryMapping[] {
  if (!Array.isArray(venueTypes)) {
    return []
  }

  const mappingIndex =
    index ??
    buildVenueCategoryMappingIndex(
      mappings ?? []
    )

  const seenVenueTypes =
    new Set<string>()

  const totals =
    new Map<
      ReputationCategoryId,
      number
    >()

  for (
    const rawVenueType of
      venueTypes
  ) {
    const venueType =
      normalizeVenueTypeKey(
        rawVenueType
      )

    if (
      !venueType ||
      seenVenueTypes.has(
        venueType
      )
    ) {
      continue
    }

    seenVenueTypes.add(
      venueType
    )

    const categoryMappings =
      mappingIndex.get(
        venueType
      ) ?? []

    for (
      const mapping of
        categoryMappings
    ) {
      totals.set(
        mapping.categoryId,
        roundMappingWeight(
          (
            totals.get(
              mapping.categoryId
            ) ?? 0
          ) +
            mapping.weight
        )
      )
    }
  }

  return [
    ...totals.entries(),
  ]
    .map(
      ([
        categoryId,
        weight,
      ]) => ({
        categoryId,
        weight,
      })
    )
    .sort(
      (
        first,
        second
      ) => {
        if (
          first.weight !==
          second.weight
        ) {
          return (
            second.weight -
            first.weight
          )
        }

        return first.categoryId.localeCompare(
          second.categoryId
        )
      }
    )
}

/* =========================================================
 * Validation helpers
 * ======================================================= */

/**
 * Returns whether a value can be normalized into a valid mapping.
 */
export function isVenueCategoryMapping(
  value: unknown
): value is VenueCategoryMapping {
  return (
    normalizeVenueCategoryMapping(
      value
    ) !== null
  )
}

/**
 * Normalizes a venue-type taxonomy key.
 *
 * Examples:
 *
 * - `Coffee Shop` → `coffee_shop`
 * - `coffee-shop` → `coffee_shop`
 * - `  NIGHT CLUB  ` → `night_club`
 */
export function normalizeVenueTypeKey(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim()
      .toLowerCase()
      .replace(
        /['’]/g,
        ''
      )
      .replace(
        /[^a-z0-9]+/g,
        '_'
      )
      .replace(
        /^_+|_+$/g,
        ''
      )
      .replace(
        /_+/g,
        '_'
      )
      .slice(
        0,
        MAX_VENUE_TYPE_KEY_LENGTH
      )
      .replace(
        /_+$/g,
        ''
      )

  return normalized.length > 0
    ? normalized
    : null
}

/**
 * Normalizes a mapping weight into the canonical range.
 *
 * Stringified numeric database values are accepted.
 */
export function normalizeCategoryMappingWeight(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0 ||
    normalized >
      MAX_REPUTATION_CATEGORY_MAPPING_WEIGHT
  ) {
    return null
  }

  return roundMappingWeight(
    normalized
  )
}

/* =========================================================
 * Internal rejection analysis
 * ======================================================= */

function getMappingRejectionReason(
  value: unknown
): VenueCategoryMappingRejectionReason | null {
  if (!isRecord(value)) {
    return 'invalid_record'
  }

  if (isExplicitlyInactive(value)) {
    return 'inactive'
  }

  const venueType =
    normalizeVenueTypeKey(
      firstDefined(
        value.venueType,
        value.venue_type
      )
    )

  if (!venueType) {
    return 'invalid_venue_type'
  }

  const categoryId =
    normalizeRequiredText(
      firstDefined(
        value.categoryId,
        value.category_id
      )
    )

  if (
    !categoryId ||
    !isReputationCategoryId(
      categoryId
    )
  ) {
    return 'invalid_category_id'
  }

  const weight =
    normalizeCategoryMappingWeight(
      firstDefined(
        value.weight,
        value.mappingWeight,
        value.mapping_weight
      )
    )

  if (weight === null) {
    return 'invalid_weight'
  }

  return null
}

function isExplicitlyInactive(
  value: Record<
    string,
    unknown
  >
): boolean {
  const activeValue =
    firstDefined(
      value.active,
      value.isActive,
      value.is_active
    )

  return activeValue === false
}

/* =========================================================
 * Deduplication and ordering
 * ======================================================= */

function buildMappingIdentity(
  mapping: VenueCategoryMapping
): string {
  return [
    mapping.venueType,
    mapping.categoryId,
  ].join(':')
}

function shouldReplaceMapping({
  existing,
  candidate,
}: {
  existing:
    VenueCategoryMapping
  candidate:
    VenueCategoryMapping
}): boolean {
  if (
    candidate.weight >
    existing.weight
  ) {
    return true
  }

  if (
    candidate.weight <
    existing.weight
  ) {
    return false
  }

  return (
    candidate.sortOrder <
    existing.sortOrder
  )
}

function compareVenueCategoryMappings(
  first:
    VenueCategoryMapping,
  second:
    VenueCategoryMapping
): number {
  const venueTypeDifference =
    first.venueType.localeCompare(
      second.venueType
    )

  if (
    venueTypeDifference !== 0
  ) {
    return venueTypeDifference
  }

  if (
    first.sortOrder !==
    second.sortOrder
  ) {
    return (
      first.sortOrder -
      second.sortOrder
    )
  }

  if (
    first.weight !==
    second.weight
  ) {
    return (
      second.weight -
      first.weight
    )
  }

  return first.categoryId.localeCompare(
    second.categoryId
  )
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeRequiredText(
  value: unknown
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

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    )
  ) {
    return value
  }

  if (
    typeof value ===
      'string' &&
    value.trim().length >
      0
  ) {
    const parsed =
      Number(value)

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function normalizeNonNegativeInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function roundMappingWeight(
  value: number
): number {
  return (
    Math.round(
      value *
        1_000_000
    ) /
    1_000_000
  )
}

function firstDefined(
  ...values: unknown[]
): unknown {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined
    ) {
      return value
    }
  }

  return null
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
    !Array.isArray(value)
  )
}