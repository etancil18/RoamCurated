import 'server-only'

import {
  getCityLabel,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'
import {
  createEmptyPublicCreatorReputationSnapshot,
  type PublicCreatorReputationCategorySummary,
  type PublicCreatorReputationSnapshot,
  type PublicReputationCategory,
  type PublicReputationEvidence,
  type PublicReputationLevel,
  type PublicReputationRankDisplay,
  type PublicReputationScope,
} from '@/lib/reputation/publicTypes'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type PublicCreatorReputationEvidence =
  PublicReputationEvidence

type PublicCreatorReputationLevel =
  PublicReputationLevel

type PublicCreatorReputationRankDisplay =
  PublicReputationRankDisplay

type PublicCreatorReputationScope =
  PublicReputationScope

/* =========================================================
 * Public loader contracts
 * ======================================================= */

export type GetPublicCreatorReputationOptions = {
  /**
   * Restricts the response to one reputation policy version.
   *
   * When omitted, the newest policy version available for the
   * creator is selected automatically.
   */
  policyVersion?: number

  /**
   * Includes unranked category records in the public category
   * collection.
   *
   * Defaults to false so public profile surfaces emphasize
   * earned status.
   */
  includeUnranked?: boolean

  /**
   * Includes global reputation rows when available.
   *
   * Defaults to true.
   */
  includeGlobal?: boolean

  /**
   * Includes city-scoped reputation rows when available.
   *
   * Defaults to true.
   */
  includeCity?: boolean
}

export type GetPublicCreatorReputationResult = {
  reputation: PublicCreatorReputationSnapshot
  found: boolean
}

/* =========================================================
 * Database row contracts
 * ======================================================= */

/**
 * Reputation stats are selected with `*` intentionally.
 *
 * The public loader remains tolerant of additive database
 * migrations while explicitly reading and sanitizing only the
 * fields approved for public use.
 */
type CreatorReputationStatsRow =
  Record<string, unknown> & {
    user_id?: unknown
    category_id?: unknown
    scope?: unknown
    city_key?: unknown
    policy_version?: unknown
    reputation_level?: unknown
    reputation_score?: unknown
    verified_venue_count?: unknown
    weighted_venue_count?: unknown
    public_collection_count?: unknown
    curated_venue_count?: unknown
    public_snapshot_count?: unknown
    completed_flow_count?: unknown
    city_count?: unknown
    rank?: unknown
    eligible_user_count?: unknown
    eligible_creator_count?: unknown
    top_percent?: unknown
    percentile?: unknown
    rank_label?: unknown
    ranking_calculated_at?: unknown
    calculated_at?: unknown
    updated_at?: unknown
  }

type ReputationCategoryRow =
  Record<string, unknown> & {
    id?: unknown
    label?: unknown
    plural_label?: unknown
    description?: unknown
    sort_order?: unknown
    is_active?: unknown
  }

/* =========================================================
 * Internal normalized records
 * ======================================================= */

type NormalizedReputationRow = {
  userId: string
  categoryId: string
  scope: PublicCreatorReputationScope
  cityKey: string | null
  cityLabel: string | null
  policyVersion: number
  reputationLevel: PublicCreatorReputationLevel
  reputationScore: number
  evidence: PublicCreatorReputationEvidence
  rank: number | null
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null
  rankDisplay: PublicCreatorReputationRankDisplay
  calculatedAt: string
}

const REPUTATION_LEVEL_PRIORITY:
  Record<PublicCreatorReputationLevel, number> = {
    unranked: 0,
    emerging: 1,
    established: 2,
    expert: 3,
    elite: 4,
  }

/* =========================================================
 * Public loader
 * ======================================================= */

/**
 * Loads the canonical public reputation snapshot for one
 * creator.
 *
 * This function:
 *
 * - uses the trusted Supabase service-role client
 * - reads previously calculated reputation rows
 * - selects the newest available policy version by default
 * - excludes inactive or missing categories
 * - prevents duplicate category presentation
 * - derives one defensible primary status
 * - sanitizes every value crossing into public UI
 *
 * It does not:
 *
 * - rebuild creator reputation
 * - recalculate rankings
 * - expose internal score weights
 * - expose raw evidence rows
 * - expose moderation or fraud signals
 */
export async function getPublicCreatorReputation(
  userId: string,
  options: GetPublicCreatorReputationOptions = {}
): Promise<GetPublicCreatorReputationResult> {
  const normalizedUserId =
    normalizeRequiredText(userId)

  const requestedPolicyVersion =
    normalizeOptionalPositiveInteger(
      options.policyVersion
    )

  const includeUnranked =
    options.includeUnranked === true

  const includeGlobal =
    options.includeGlobal !== false

  const includeCity =
    options.includeCity !== false

  const fallbackPolicyVersion =
    requestedPolicyVersion ?? 0

  if (!normalizedUserId) {
    return {
      reputation:
        createEmptyPublicCreatorReputationSnapshot({
          userId: '',
          policyVersion:
            fallbackPolicyVersion,
        }),
      found: false,
    }
  }

  if (
    !includeGlobal &&
    !includeCity
  ) {
    return {
      reputation:
        createEmptyPublicCreatorReputationSnapshot({
          userId:
            normalizedUserId,
          policyVersion:
            fallbackPolicyVersion,
        }),
      found: false,
    }
  }

  const supabase =
    getSupabaseAdmin()

  let statsQuery =
    supabase
      .from(
        'creator_reputation_stats'
      )
      .select('*')
      .eq(
        'user_id',
        normalizedUserId
      )

  if (
    requestedPolicyVersion !==
    null
  ) {
    statsQuery =
      statsQuery.eq(
        'policy_version',
        requestedPolicyVersion
      )
  }

  const statsResult =
    await statsQuery

  if (statsResult.error) {
    throw new Error(
      buildDatabaseErrorMessage(
        'creator reputation stats',
        statsResult.error
      )
    )
  }

  const rawStatsRows =
    Array.isArray(
      statsResult.data
    )
      ? (
          statsResult.data as
            CreatorReputationStatsRow[]
        )
      : []

  const availablePolicyVersion =
    requestedPolicyVersion ??
    findNewestPolicyVersion(
      rawStatsRows
    )

  if (
    availablePolicyVersion ===
    null
  ) {
    return {
      reputation:
        createEmptyPublicCreatorReputationSnapshot({
          userId:
            normalizedUserId,
          policyVersion:
            fallbackPolicyVersion,
        }),
      found: false,
    }
  }

  const normalizedRows =
    rawStatsRows
      .map(
        (row) =>
          normalizeReputationRow(
            row
          )
      )
      .filter(
        (
          row
        ): row is NormalizedReputationRow =>
          row !== null &&
          row.userId ===
            normalizedUserId &&
          row.policyVersion ===
            availablePolicyVersion &&
          (
            row.scope ===
              'global'
              ? includeGlobal
              : includeCity
          ) &&
          (
            includeUnranked ||
            row.reputationLevel !==
              'unranked'
          )
      )

  if (
    normalizedRows.length ===
    0
  ) {
    return {
      reputation:
        createEmptyPublicCreatorReputationSnapshot({
          userId:
            normalizedUserId,
          policyVersion:
            availablePolicyVersion,
        }),
      found: false,
    }
  }

  const categoryIds = [
    ...new Set(
      normalizedRows.map(
        (row) =>
          row.categoryId
      )
    ),
  ]

  const categoryResult =
  await supabase
    .from(
      'reputation_categories'
    )
    .select(`
      id,
      label,
      plural_label,
      description,
      sort_order,
      is_active
    `)
    .in(
      'id',
      categoryIds
    )
    .eq(
      'is_active',
      true
    )

  if (categoryResult.error) {
    throw new Error(
      buildDatabaseErrorMessage(
        'reputation categories',
        categoryResult.error
      )
    )
  }

  const categoriesById =
    normalizeCategoriesById(
      categoryResult.data
    )

  const rowsWithCategories =
    normalizedRows.filter(
      (row) =>
        categoriesById.has(
          row.categoryId
        )
    )

  if (
    rowsWithCategories.length ===
    0
  ) {
    return {
      reputation:
        createEmptyPublicCreatorReputationSnapshot({
          userId:
            normalizedUserId,
          policyVersion:
            availablePolicyVersion,
        }),
      found: false,
    }
  }

  const primaryCityKey =
    determinePrimaryCityKey(
      rowsWithCategories
    )

  const selectedRows =
    selectBestRowPerCategory({
      rows:
        rowsWithCategories,
      primaryCityKey,
    })

  const categorySummaries =
    selectedRows
      .map((row) => {
        const category =
          categoriesById.get(
            row.categoryId
          )

        return category
          ? buildCategorySummary({
              row,
              category,
            })
          : null
      })
      .filter(
        (
          summary
        ): summary is PublicCreatorReputationCategorySummary =>
          summary !== null
      )
      .sort(
        (
          first,
          second
        ) => {
          const firstCategory =
            categoriesById.get(
              first.categoryId
            )

          const secondCategory =
            categoriesById.get(
              second.categoryId
            )

          const levelDifference =
            REPUTATION_LEVEL_PRIORITY[
              second.reputationLevel
            ] -
            REPUTATION_LEVEL_PRIORITY[
              first.reputationLevel
            ]

          if (
            levelDifference !== 0
          ) {
            return levelDifference
          }

          const scoreDifference =
            second.reputationScore -
            first.reputationScore

          if (
            scoreDifference !== 0
          ) {
            return scoreDifference
          }

          const rankDifference =
            compareNullableRanks(
              first.rank,
              second.rank
            )

          if (
            rankDifference !== 0
          ) {
            return rankDifference
          }

          return (
            (
              firstCategory
                ?.sortOrder ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              secondCategory
                ?.sortOrder ??
              Number.MAX_SAFE_INTEGER
            )
          )
        }
      )

  const primaryCategory =
    categorySummaries[0] ??
    null

  const evidence =
    buildCreatorWideEvidence(
      rowsWithCategories
    )

  const highestLevel =
    primaryCategory
      ?.reputationLevel ??
    'unranked'

  const calculatedAt =
    findNewestCalculatedAt(
      rowsWithCategories
    )

  const primaryCityLabel =
    primaryCityKey
      ? getCityLabel(
          primaryCityKey
        )
      : null

  return {
    reputation: {
      userId:
        normalizedUserId,

      primaryCityKey,

      primaryCityLabel,

      primaryCategory,

      categories:
        categorySummaries,

      evidence,

      highestLevel,

      headline:
        primaryCategory
          ?.primaryLabel ??
        null,

      summary:
        buildPublicSummary(
          evidence
        ),

      policyVersion:
        availablePolicyVersion,

      calculatedAt,
    },

    found: true,
  }
}

/* =========================================================
 * Row normalization
 * ======================================================= */

function normalizeReputationRow(
  row: CreatorReputationStatsRow
): NormalizedReputationRow | null {
  const userId =
    normalizeRequiredText(
      row.user_id
    )

  const categoryId =
    normalizeRequiredText(
      row.category_id
    )

  const scope =
    normalizeScope(
      row.scope
    )

  const policyVersion =
    normalizeOptionalPositiveInteger(
      row.policy_version
    )

  const reputationLevel =
    normalizeReputationLevel(
      row.reputation_level
    )

  const calculatedAt =
    normalizeIsoDate(
      row.calculated_at
    ) ??
    normalizeIsoDate(
      row.updated_at
    )

  if (
    !userId ||
    !categoryId ||
    !scope ||
    policyVersion === null ||
    !reputationLevel ||
    !calculatedAt
  ) {
    return null
  }

  const rawCityKey =
    normalizeNullableText(
      row.city_key
    )

  const cityKey =
    scope === 'city' &&
    rawCityKey
      ? normalizeCityKey(
          rawCityKey
        )
      : null

  if (
    scope === 'city' &&
    !cityKey
  ) {
    return null
  }

  const rank =
    normalizeNullablePositiveInteger(
      row.rank
    )

  const eligibleCreatorCount =
    normalizeNonNegativeInteger(
      firstDefinedValue(
        row.eligible_creator_count,
        row.eligible_user_count
      )
    )

  const topPercent =
    normalizeTopPercent(
      firstDefinedValue(
        row.top_percent,
        row.percentile
      )
    )

  const rankLabel =
    normalizeNullableText(
      row.rank_label
    ) ??
    buildRankLabel({
      rank,
      topPercent,
      eligibleCreatorCount,
    })

  return {
    userId,
    categoryId,
    scope,
    cityKey,
    cityLabel:
      cityKey
        ? getCityLabel(
            cityKey
          )
        : null,
    policyVersion,
    reputationLevel,
    reputationScore:
      normalizeNonNegativeNumber(
        row.reputation_score
      ),
    evidence: {
      verifiedVenueCount:
        normalizeNonNegativeInteger(
          row.verified_venue_count
        ),
      weightedVenueCount:
        normalizeNonNegativeNumber(
          row.weighted_venue_count
        ),
      publicCollectionCount:
        normalizeNonNegativeInteger(
          row.public_collection_count
        ),
      curatedVenueCount:
        normalizeNonNegativeInteger(
          row.curated_venue_count
        ),
      publicSnapshotCount:
        normalizeNonNegativeInteger(
          row.public_snapshot_count
        ),
      completedFlowCount:
        normalizeNonNegativeInteger(
          row.completed_flow_count
        ),
      cityCount:
        normalizeNonNegativeInteger(
          row.city_count
        ),
    },
    rank,
    eligibleCreatorCount,
    topPercent,
    rankLabel,
    rankDisplay:
      determineRankDisplay({
        rank,
        topPercent,
        eligibleCreatorCount,
      }),
    calculatedAt,
  }
}

/* =========================================================
 * Category normalization
 * ======================================================= */

function normalizeCategoriesById(
  value: unknown
): Map<
  string,
  PublicReputationCategory
> {
  const categories =
    new Map<
      string,
      PublicReputationCategory
    >()

  if (!Array.isArray(value)) {
    return categories
  }

  for (
    const rawCategory of
      value as ReputationCategoryRow[]
  ) {
    const id =
      normalizeRequiredText(
        rawCategory.id
      )

    const label =
      normalizeRequiredText(
        rawCategory.label
      )

    if (
      !id ||
      !label ||
      rawCategory.is_active ===
        false
    ) {
      continue
    }

    const shortLabel =
  removeExplorerSuffix(
    label
  )

    categories.set(
      id,
      {
        id,
        label,
        shortLabel,
        description:
          normalizeNullableText(
            rawCategory.description
          ),
        sortOrder:
          normalizeNonNegativeInteger(
            rawCategory.sort_order
          ),
      }
    )
  }

  return categories
}

/* =========================================================
 * Record selection
 * ======================================================= */

function findNewestPolicyVersion(
  rows: CreatorReputationStatsRow[]
): number | null {
  let newestVersion:
    number | null = null

  for (const row of rows) {
    const version =
      normalizeOptionalPositiveInteger(
        row.policy_version
      )

    if (
      version !== null &&
      (
        newestVersion === null ||
        version >
          newestVersion
      )
    ) {
      newestVersion =
        version
    }
  }

  return newestVersion
}

function determinePrimaryCityKey(
  rows: NormalizedReputationRow[]
): string | null {
  const cityRows =
    rows
      .filter(
        (
          row
        ): row is NormalizedReputationRow & {
          cityKey: string
        } =>
          row.scope ===
            'city' &&
          typeof row.cityKey ===
            'string' &&
          row.cityKey.length > 0
      )
      .sort(
        compareNormalizedRows
      )

  return (
    cityRows[0]
      ?.cityKey ??
    null
  )
}

function selectBestRowPerCategory({
  rows,
  primaryCityKey,
}: {
  rows: NormalizedReputationRow[]
  primaryCityKey: string | null
}): NormalizedReputationRow[] {
  const groupedRows =
    new Map<
      string,
      NormalizedReputationRow[]
    >()

  for (const row of rows) {
    const existing =
      groupedRows.get(
        row.categoryId
      )

    if (existing) {
      existing.push(row)
    } else {
      groupedRows.set(
        row.categoryId,
        [row]
      )
    }
  }

  const selectedRows:
    NormalizedReputationRow[] = []

  for (
    const categoryRows of
      groupedRows.values()
  ) {
    const primaryCityRow =
      primaryCityKey
        ? categoryRows.find(
            (row) =>
              row.scope ===
                'city' &&
              row.cityKey ===
                primaryCityKey
          )
        : null

    if (primaryCityRow) {
      selectedRows.push(
        primaryCityRow
      )
      continue
    }

    const sortedRows = [
      ...categoryRows,
    ].sort(
      compareNormalizedRows
    )

    if (sortedRows[0]) {
      selectedRows.push(
        sortedRows[0]
      )
    }
  }

  return selectedRows
}

function compareNormalizedRows(
  first: NormalizedReputationRow,
  second: NormalizedReputationRow
): number {
  const levelDifference =
    REPUTATION_LEVEL_PRIORITY[
      second.reputationLevel
    ] -
    REPUTATION_LEVEL_PRIORITY[
      first.reputationLevel
    ]

  if (
    levelDifference !== 0
  ) {
    return levelDifference
  }

  const scoreDifference =
    second.reputationScore -
    first.reputationScore

  if (
    scoreDifference !== 0
  ) {
    return scoreDifference
  }

  const rankDifference =
    compareNullableRanks(
      first.rank,
      second.rank
    )

  if (
    rankDifference !== 0
  ) {
    return rankDifference
  }

  const venueDifference =
    second.evidence
      .verifiedVenueCount -
    first.evidence
      .verifiedVenueCount

  if (
    venueDifference !== 0
  ) {
    return venueDifference
  }

  if (
    first.scope !==
    second.scope
  ) {
    return first.scope ===
      'city'
      ? -1
      : 1
  }

  return first.categoryId.localeCompare(
    second.categoryId
  )
}

/* =========================================================
 * Public presentation
 * ======================================================= */

function buildCategorySummary({
  row,
  category,
}: {
  row: NormalizedReputationRow
  category: PublicReputationCategory
}): PublicCreatorReputationCategorySummary {
  const levelLabel =
    getLevelLabel(
      row.reputationLevel
    )

  const locationAndCategory =
    [
      row.cityLabel,
      category.shortLabel,
    ]
      .filter(
        (
          value
        ): value is string =>
          typeof value ===
            'string' &&
          value.length > 0
      )
      .join(' ')

  const primaryLabel =
    row.reputationLevel ===
      'unranked'
      ? (
          locationAndCategory ||
          category.label
        )
      : [
          locationAndCategory ||
            category.shortLabel,
          levelLabel,
        ]
          .filter(Boolean)
          .join(' ')

  const compactLabel =
    row.reputationLevel ===
      'unranked'
      ? category.shortLabel
      : `${category.shortLabel} ${levelLabel}`

  return {
    categoryId:
      category.id,

    categoryLabel:
      category.label,

    categoryShortLabel:
      category.shortLabel,

    scope:
      row.scope,

    cityKey:
      row.cityKey,

    cityLabel:
      row.cityLabel,

    reputationLevel:
      row.reputationLevel,

    reputationScore:
      row.reputationScore,

    primaryLabel,

    compactLabel,

    verifiedVenueCount:
      row.evidence
        .verifiedVenueCount,

    weightedVenueCount:
      row.evidence
        .weightedVenueCount,

    rank:
      row.rank,

    eligibleCreatorCount:
      row.eligibleCreatorCount,

    topPercent:
      row.topPercent,

    rankLabel:
      row.rankDisplay ===
        'hidden'
        ? null
        : row.rankLabel,

    calculatedAt:
      row.calculatedAt,
  }
}

/**
 * Category rows may repeat creator-wide evidence values.
 *
 * Maximum values are used instead of summation to prevent
 * inflated totals when the same public collection, snapshot, or
 * completed Flow contributes to multiple category rows.
 */
function buildCreatorWideEvidence(
  rows: NormalizedReputationRow[]
): PublicReputationEvidence {
  return rows.reduce<
    PublicReputationEvidence
  >(
    (
      totals,
      row
    ) => ({
      verifiedVenueCount:
        Math.max(
          totals
            .verifiedVenueCount,
          row.evidence
            .verifiedVenueCount
        ),

      weightedVenueCount:
        Math.max(
          totals
            .weightedVenueCount,
          row.evidence
            .weightedVenueCount
        ),

      publicCollectionCount:
        Math.max(
          totals
            .publicCollectionCount,
          row.evidence
            .publicCollectionCount
        ),

      curatedVenueCount:
        Math.max(
          totals
            .curatedVenueCount,
          row.evidence
            .curatedVenueCount
        ),

      publicSnapshotCount:
        Math.max(
          totals
            .publicSnapshotCount,
          row.evidence
            .publicSnapshotCount
        ),

      completedFlowCount:
        Math.max(
          totals
            .completedFlowCount,
          row.evidence
            .completedFlowCount
        ),

      cityCount:
        Math.max(
          totals.cityCount,
          row.evidence
            .cityCount
        ),
    }),
    {
      verifiedVenueCount: 0,
      weightedVenueCount: 0,
      publicCollectionCount: 0,
      curatedVenueCount: 0,
      publicSnapshotCount: 0,
      completedFlowCount: 0,
      cityCount: 0,
    }
  )
}

function buildPublicSummary(
  evidence: PublicReputationEvidence
): string | null {
  const parts: string[] = []

  if (
    evidence.verifiedVenueCount >
    0
  ) {
    parts.push(
      formatCountLabel(
        evidence
          .verifiedVenueCount,
        'verified venue',
        'verified venues'
      )
    )
  }

  if (
    evidence.publicCollectionCount >
    0
  ) {
    parts.push(
      formatCountLabel(
        evidence
          .publicCollectionCount,
        'public collection',
        'public collections'
      )
    )
  }

  if (
    evidence.publicSnapshotCount >
    0
  ) {
    parts.push(
      formatCountLabel(
        evidence
          .publicSnapshotCount,
        'public snapshot',
        'public snapshots'
      )
    )
  }

  if (
    evidence.completedFlowCount >
    0
  ) {
    parts.push(
      formatCountLabel(
        evidence
          .completedFlowCount,
        'completed Flow',
        'completed Flows'
      )
    )
  }

  return parts.length > 0
    ? parts
        .slice(0, 3)
        .join(' · ')
    : null
}

function getLevelLabel(
  level: PublicCreatorReputationLevel
): string {
  if (level === 'elite') {
    return 'Elite'
  }

  if (level === 'expert') {
    return 'Expert'
  }

  if (
    level === 'established'
  ) {
    return 'Established'
  }

  if (
    level === 'emerging'
  ) {
    return 'Emerging'
  }

  return 'Explorer'
}

function determineRankDisplay({
  rank,
  topPercent,
  eligibleCreatorCount,
}: {
  rank: number | null
  topPercent: number | null
  eligibleCreatorCount: number
}): PublicCreatorReputationRankDisplay {
  if (
    eligibleCreatorCount <= 0
  ) {
    return 'hidden'
  }

  if (
    rank !== null &&
    eligibleCreatorCount >= 10
  ) {
    return 'exact'
  }

  if (
    topPercent !== null &&
    eligibleCreatorCount >= 5
  ) {
    return 'percentile'
  }

  return 'hidden'
}

function buildRankLabel({
  rank,
  topPercent,
  eligibleCreatorCount,
}: {
  rank: number | null
  topPercent: number | null
  eligibleCreatorCount: number
}): string | null {
  const display =
    determineRankDisplay({
      rank,
      topPercent,
      eligibleCreatorCount,
    })

  if (
    display === 'exact' &&
    rank !== null
  ) {
    return `#${rank.toLocaleString(
      'en-US'
    )}`
  }

  if (
    display ===
      'percentile' &&
    topPercent !== null
  ) {
    return `Top ${formatTopPercent(
      topPercent
    )}%`
  }

  return null
}

function formatTopPercent(
  value: number
): string {
  if (
    Number.isInteger(value)
  ) {
    return value.toLocaleString(
      'en-US'
    )
  }

  return value.toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }
  )
}

function formatCountLabel(
  value: number,
  singular: string,
  plural: string
): string {
  return `${value.toLocaleString(
    'en-US'
  )} ${
    value === 1
      ? singular
      : plural
  }`
}

/* =========================================================
 * Date selection
 * ======================================================= */

function findNewestCalculatedAt(
  rows: NormalizedReputationRow[]
): string | null {
  let newestTimestamp =
    Number.NEGATIVE_INFINITY

  let newestValue:
    string | null = null

  for (const row of rows) {
    const timestamp =
      Date.parse(
        row.calculatedAt
      )

    if (
      Number.isNaN(
        timestamp
      )
    ) {
      continue
    }

    if (
      timestamp >
      newestTimestamp
    ) {
      newestTimestamp =
        timestamp
      newestValue =
        row.calculatedAt
    }
  }

  return newestValue
}

/* =========================================================
 * Database errors
 * ======================================================= */

function buildDatabaseErrorMessage(
  resource: string,
  error: {
    message?: string
    code?: string
    details?: string
    hint?: string
  } | null
): string {
  const details = [
    error?.message,
    error?.code
      ? `code=${error.code}`
      : null,
    error?.details
      ? `details=${error.details}`
      : null,
    error?.hint
      ? `hint=${error.hint}`
      : null,
  ]
    .filter(Boolean)
    .join(' | ')

  return (
    `[getPublicCreatorReputation] Failed to load ${resource}` +
    (
      details
        ? `: ${details}`
        : '.'
    )
  )
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeScope(
  value: unknown
): PublicCreatorReputationScope | null {
  if (
    value === 'global' ||
    value === 'city'
  ) {
    return value
  }

  return null
}

function normalizeReputationLevel(
  value: unknown
): PublicCreatorReputationLevel | null {
  if (
    value === 'unranked' ||
    value === 'emerging' ||
    value === 'established' ||
    value === 'expert' ||
    value === 'elite'
  ) {
    return value
  }

  return null
}

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
      .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeNullableText(
  value: unknown
): string | null {
  return normalizeRequiredText(
    value
  )
}

function normalizeOptionalPositiveInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizeNullablePositiveInteger(
  value: unknown
): number | null {
  return normalizeOptionalPositiveInteger(
    value
  )
}

function normalizeNonNegativeInteger(
  value: unknown
): number {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return 0
  }

  return Math.trunc(
    normalized
  )
}

function normalizeNonNegativeNumber(
  value: unknown
): number {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return 0
  }

  return normalized
}

function normalizeTopPercent(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

function normalizeFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  if (
    typeof value ===
    'string' &&
    value.trim().length > 0
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

function normalizeIsoDate(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const timestamp =
    Date.parse(value)

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}

function firstDefinedValue(
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

function compareNullableRanks(
  first: number | null,
  second: number | null
): number {
  if (
    first === null &&
    second === null
  ) {
    return 0
  }

  if (first === null) {
    return 1
  }

  if (second === null) {
    return -1
  }

  return first - second
}

function removeExplorerSuffix(
  value: string
): string {
  const normalized =
    value
      .replace(
        /\s+explorer$/i,
        ''
      )
      .trim()

  return normalized || value
}