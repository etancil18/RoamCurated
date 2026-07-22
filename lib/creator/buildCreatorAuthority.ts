import type {
  CreatorAuthorityStats,
  ExtendedCreatorAuthorityStats,
} from './types'

/**
 * Raw authority values accepted from Supabase queries and
 * application calculations.
 *
 * Counts may be null or undefined because Supabase aggregate
 * queries and conditional loaders can return either.
 */
export type CreatorAuthorityInput = {
  primaryCity?: string | null

  verifiedVisitCount?: number | null
  completedFlowCount?: number | null
  publicSnapshotCount?: number | null
  publicCollectionCount?: number | null
}

/**
 * Optional richer authority values.
 *
 * Only supply these fields when the underlying geographic and
 * category data is reliable enough to support the claims.
 */
export type ExtendedCreatorAuthorityInput =
  CreatorAuthorityInput & {
    cityCount?: number | null
    neighborhoodCount?: number | null
    topCategories?: readonly unknown[] | null
  }

/**
 * Public authority metric identifiers.
 *
 * Keeping these identifiers centralized prevents UI components
 * from inventing inconsistent labels or ordering.
 */
export const CREATOR_AUTHORITY_METRIC_KEYS = [
  'verifiedVisitCount',
  'completedFlowCount',
  'publicSnapshotCount',
  'publicCollectionCount',
] as const

export type CreatorAuthorityMetricKey =
  (typeof CREATOR_AUTHORITY_METRIC_KEYS)[number]

export type CreatorAuthorityMetric = {
  key: CreatorAuthorityMetricKey
  label: string
  shortLabel: string
  value: number
  description: string
}

/**
 * Canonical public labels and descriptions.
 *
 * These descriptions intentionally avoid claims about reach,
 * influence, conversion, expertise, or audience quality.
 */
export const CREATOR_AUTHORITY_METRIC_DEFINITIONS = {
  verifiedVisitCount: {
    label: 'Verified venue visits',
    shortLabel: 'Verified visits',
    description:
      'Venue visits recorded through activity on Roam.',
  },

  completedFlowCount: {
    label: 'Completed flows',
    shortLabel: 'Flows',
    description:
      'Roam flows completed by this creator.',
  },

  publicSnapshotCount: {
    label: 'Public flow snapshots',
    shortLabel: 'Snapshots',
    description:
      'Completed-flow snapshots shared publicly by this creator.',
  },

  publicCollectionCount: {
    label: 'Public collections',
    shortLabel: 'Collections',
    description:
      'Public creator collections curated on Roam.',
  },
} as const satisfies Record<
  CreatorAuthorityMetricKey,
  {
    label: string
    shortLabel: string
    description: string
  }
>

/**
 * Builds the canonical Creator Mode authority object.
 *
 * This function:
 *
 * - trims and normalizes the primary city
 * - converts invalid counts to zero
 * - prevents negative counts
 * - converts fractional counts to whole numbers
 * - prevents NaN and Infinity from reaching the UI
 *
 * It does not calculate a score, percentile, rank, or other
 * subjective authority claim.
 */
export function buildCreatorAuthority(
  input: CreatorAuthorityInput
): CreatorAuthorityStats {
  return {
    primaryCity: normalizeNullableText(
      input.primaryCity
    ),

    verifiedVisitCount: normalizeCount(
      input.verifiedVisitCount
    ),

    completedFlowCount: normalizeCount(
      input.completedFlowCount
    ),

    publicSnapshotCount: normalizeCount(
      input.publicSnapshotCount
    ),

    publicCollectionCount: normalizeCount(
      input.publicCollectionCount
    ),
  }
}

/**
 * Builds the richer authority object used when Roam has
 * reliable geographic and category data.
 *
 * Empty optional values are omitted rather than represented as
 * misleading zeros or empty arrays.
 */
export function buildExtendedCreatorAuthority(
  input: ExtendedCreatorAuthorityInput
): ExtendedCreatorAuthorityStats {
  const base = buildCreatorAuthority(input)

  const cityCount = normalizeOptionalCount(
    input.cityCount
  )

  const neighborhoodCount =
    normalizeOptionalCount(
      input.neighborhoodCount
    )

  const topCategories =
    normalizeTopCategories(
      input.topCategories
    )

  return {
    ...base,

    ...(cityCount !== null
      ? { cityCount }
      : {}),

    ...(neighborhoodCount !== null
      ? { neighborhoodCount }
      : {}),

    ...(topCategories.length > 0
      ? { topCategories }
      : {}),
  }
}

/**
 * Converts CreatorAuthorityStats into display-ready metrics in
 * canonical order.
 *
 * By default, zero-value metrics are retained so the UI can
 * render a stable layout.
 */
export function getCreatorAuthorityMetrics({
  stats,
  includeZeroValues = true,
}: {
  stats: CreatorAuthorityStats
  includeZeroValues?: boolean
}): CreatorAuthorityMetric[] {
  return CREATOR_AUTHORITY_METRIC_KEYS
    .map((key) => {
      const definition =
        CREATOR_AUTHORITY_METRIC_DEFINITIONS[key]

      return {
        key,
        label: definition.label,
        shortLabel: definition.shortLabel,
        value: normalizeCount(stats[key]),
        description: definition.description,
      }
    })
    .filter(
      (metric) =>
        includeZeroValues ||
        metric.value > 0
    )
}

/**
 * Returns whether the authority section contains at least one
 * meaningful public signal.
 *
 * A primary city counts as a meaningful signal even when all
 * numerical metrics are zero.
 */
export function hasCreatorAuthority(
  stats: CreatorAuthorityStats | null | undefined
): boolean {
  if (!stats) {
    return false
  }

  if (
    normalizeNullableText(
      stats.primaryCity
    ) !== null
  ) {
    return true
  }

  return CREATOR_AUTHORITY_METRIC_KEYS.some(
    (key) => normalizeCount(stats[key]) > 0
  )
}

/**
 * Returns the total amount of recorded public Roam activity
 * represented by the base authority metrics.
 *
 * This is a simple aggregate count for internal presentation
 * purposes. It must not be labeled as an influence score,
 * authority score, ranking, reach, or engagement metric.
 */
export function getCreatorAuthorityActivityTotal(
  stats: CreatorAuthorityStats
): number {
  return CREATOR_AUTHORITY_METRIC_KEYS.reduce(
    (total, key) =>
      total + normalizeCount(stats[key]),
    0
  )
}

/**
 * Produces a concise local-footprint summary suitable for
 * cards, metadata, and accessible labels.
 *
 * Examples:
 *
 *   "Chicago · 24 verified visits · 3 collections"
 *   "8 completed flows · 4 snapshots"
 *
 * Returns null when no meaningful authority values exist.
 */
export function buildCreatorAuthoritySummary(
  stats: CreatorAuthorityStats
): string | null {
  const parts: string[] = []

  const primaryCity =
    normalizeNullableText(stats.primaryCity)

  if (primaryCity) {
    parts.push(primaryCity)
  }

  const prioritizedMetrics: Array<{
    value: number
    singular: string
    plural: string
  }> = [
    {
      value: normalizeCount(
        stats.verifiedVisitCount
      ),
      singular: 'verified visit',
      plural: 'verified visits',
    },
    {
      value: normalizeCount(
        stats.completedFlowCount
      ),
      singular: 'completed flow',
      plural: 'completed flows',
    },
    {
      value: normalizeCount(
        stats.publicCollectionCount
      ),
      singular: 'collection',
      plural: 'collections',
    },
    {
      value: normalizeCount(
        stats.publicSnapshotCount
      ),
      singular: 'snapshot',
      plural: 'snapshots',
    },
  ]

  for (const metric of prioritizedMetrics) {
    if (metric.value <= 0) {
      continue
    }

    parts.push(
      `${metric.value.toLocaleString()} ${
        metric.value === 1
          ? metric.singular
          : metric.plural
      }`
    )

    /**
     * Keep summaries compact.
     *
     * A primary city plus two activity metrics, or three metrics
     * without a city, is enough for most profile surfaces.
     */
    if (parts.length >= 3) {
      break
    }
  }

  return parts.length > 0
    ? parts.join(' · ')
    : null
}

/**
 * Creates a safe initial authority object for loading,
 * fallback, and empty states.
 */
export function createEmptyCreatorAuthority(
  primaryCity: string | null = null
): CreatorAuthorityStats {
  return {
    primaryCity:
      normalizeNullableText(primaryCity),
    verifiedVisitCount: 0,
    completedFlowCount: 0,
    publicSnapshotCount: 0,
    publicCollectionCount: 0,
  }
}

/**
 * Compares two authority objects by value.
 *
 * Useful for memoization, cache checks, and avoiding unnecessary
 * client-state updates.
 */
export function creatorAuthorityEquals(
  first: CreatorAuthorityStats,
  second: CreatorAuthorityStats
): boolean {
  return (
    normalizeNullableText(
      first.primaryCity
    ) ===
      normalizeNullableText(
        second.primaryCity
      ) &&
    CREATOR_AUTHORITY_METRIC_KEYS.every(
      (key) =>
        normalizeCount(first[key]) ===
        normalizeCount(second[key])
    )
  )
}

/**
 * Adds authority counts together.
 *
 * The primary city is retained only when both values agree or
 * one side has no primary city.
 *
 * This helper is useful for combining independently loaded
 * activity aggregates without duplicating normalization logic.
 */
export function mergeCreatorAuthorityStats(
  first: CreatorAuthorityStats,
  second: CreatorAuthorityStats
): CreatorAuthorityStats {
  const firstCity = normalizeNullableText(
    first.primaryCity
  )

  const secondCity = normalizeNullableText(
    second.primaryCity
  )

  const primaryCity =
    firstCity &&
    secondCity &&
    firstCity.localeCompare(
      secondCity,
      undefined,
      { sensitivity: 'base' }
    ) !== 0
      ? firstCity
      : firstCity ?? secondCity

  return {
    primaryCity,

    verifiedVisitCount:
      normalizeCount(
        first.verifiedVisitCount
      ) +
      normalizeCount(
        second.verifiedVisitCount
      ),

    completedFlowCount:
      normalizeCount(
        first.completedFlowCount
      ) +
      normalizeCount(
        second.completedFlowCount
      ),

    publicSnapshotCount:
      normalizeCount(
        first.publicSnapshotCount
      ) +
      normalizeCount(
        second.publicSnapshotCount
      ),

    publicCollectionCount:
      normalizeCount(
        first.publicCollectionCount
      ) +
      normalizeCount(
        second.publicCollectionCount
      ),
  }
}

/* =========================================================
 * Internal normalization helpers
 * ======================================================= */

/**
 * Normalizes an aggregate count into a safe non-negative
 * integer.
 */
function normalizeCount(
  value: number | null | undefined
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(0, Math.trunc(value))
}

/**
 * Normalizes an optional aggregate count while preserving the
 * distinction between "not calculated" and zero.
 */
function normalizeOptionalCount(
  value: number | null | undefined
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return Math.max(0, Math.trunc(value))
}

/**
 * Normalizes nullable text fields returned by Supabase or
 * manually assembled loader data.
 */
function normalizeNullableText(
  value: string | null | undefined
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

/**
 * Normalizes top-category labels.
 *
 * Invalid entries, empty strings, and duplicates are removed.
 * Category order is preserved.
 */
function normalizeTopCategories(
  value: readonly unknown[] | null | undefined
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const categories: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const normalized = item
      .trim()
      .replace(/\s+/g, ' ')

    if (!normalized) {
      continue
    }

    const comparisonKey =
      normalized.toLocaleLowerCase()

    if (seen.has(comparisonKey)) {
      continue
    }

    seen.add(comparisonKey)
    categories.push(normalized)

    /**
     * Limit the public authority card to a useful number of
     * categories rather than rendering an uncontrolled list.
     */
    if (categories.length >= 5) {
      break
    }
  }

  return categories
}