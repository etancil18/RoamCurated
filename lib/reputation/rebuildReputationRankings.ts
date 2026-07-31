import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  getCityLabel,
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

import {
  MINIMUM_RANKING_POPULATION,
  REPUTATION_POLICY_VERSION,
  calculatePercentileStanding,
  canPublishPercentile,
  canPublishRank,
} from './policy'

import {
  isEligibleForLeaderboard,
} from './isEligibleForReputation'

import {
  isReputationCategoryId,
  isReputationLevel,
  isReputationScope,
  type ReputationCategoryId,
  type ReputationLevel,
  type ReputationScope,
  type UserReputationRank,
} from './types'

/**
 * Canonical reputation-ranking rebuild service.
 *
 * This module:
 *
 * - reads canonical creator_reputation_stats rows
 * - applies the canonical leaderboard-eligibility policy
 * - deterministically orders eligible creators
 * - calculates one-based ordinal ranks
 * - calculates percentile standing
 * - rebuilds creator_reputation_category_stats
 * - removes stale population-stat rows
 * - returns rank rows for trusted loaders and follow-up jobs
 *
 * This module intentionally does not:
 *
 * - read raw venue visits
 * - calculate creator reputation scores
 * - modify creator_reputation_stats
 * - persist public labels
 * - publish claims directly
 * - expose private evidence
 *
 * Individual ranks are not persisted because no canonical
 * creator-reputation-rank table has been introduced.
 */

/* =========================================================
 * Constants
 * ======================================================= */

const DATABASE_BATCH_SIZE =
  250

const GLOBAL_SCOPE_CITY_KEY =
  '__global__'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type RebuildReputationRankingsOptions = {
  /**
   * Defaults to the active application policy version.
   */
  policyVersion?: number

  /**
   * Optional targeted category rebuild.
   *
   * Omit to rebuild every represented category.
   */
  categoryId?: ReputationCategoryId | null

  /**
   * Optional targeted scope rebuild.
   *
   * Omit to rebuild global and city populations.
   */
  scope?: ReputationScope | null

  /**
   * Required when scope is city.
   *
   * When supplied without scope, only populations for that city
   * are rebuilt.
   */
  cityKey?: string | null

  /**
   * Stable timestamp for every row produced by this rebuild.
   */
  calculatedAt?: string

  /**
   * Optional callback after all database writes succeed.
   */
  onPersisted?: (
    result: RebuildReputationRankingsResult
  ) => void | Promise<void>
}

export type ReputationRankingPopulation = {
  categoryId: ReputationCategoryId
  scope: ReputationScope
  cityKey: string | null
  cityLabel: string | null

  policyVersion: number

  totalUserCount: number
  earnedUserCount: number
  eligibleUserCount: number

  levelCounts: {
    unranked: number
    emerging: number
    established: number
    expert: number
    elite: number
  }

  scoreDistribution: {
    minimumEligibleScore: number | null
    maximumEligibleScore: number | null
    averageEligibleScore: number | null
    medianEligibleScore: number | null

    top25PercentScore: number | null
    top10PercentScore: number | null
    top5PercentScore: number | null
    top1PercentScore: number | null
  }

  evidenceDistribution: {
    averageVerifiedVenueCount: number | null
    medianVerifiedVenueCount: number | null
    maximumVerifiedVenueCount: number | null
  }

  publication: {
    canPublishRank: boolean
    canPublishPercentile: boolean
    canPublishTop10Percent: boolean
    canPublishTop5Percent: boolean
    canPublishTop1Percent: boolean
  }

  calculatedAt: string
}

export type RebuildReputationRankingsResult = {
  policyVersion: number

  populations: ReputationRankingPopulation[]

  /**
   * Deterministically calculated individual ranks.
   *
   * These rows are returned but are not persisted by this
   * service.
   */
  rankings: UserReputationRank[]

  sourceCounts: {
    aggregateRows: number
    representedPopulations: number
    eligibleRankingRows: number
  }

  persistence: {
    upsertedPopulationCount: number
    deletedStalePopulationCount: number
  }

  rebuiltAt: string
}

/* =========================================================
 * Database contracts
 * ======================================================= */

type CreatorReputationStatsRow = {
  user_id?: string | null
  category_id?: string | null
  scope?: string | null
  city_key?: string | null

  verified_venue_count?: number | string | null
  weighted_venue_count?: number | string | null
  city_count?: number | string | null
  public_collection_count?: number | string | null
  curated_venue_count?: number | string | null
  public_snapshot_count?: number | string | null
  completed_flow_count?: number | string | null
  recency_score?: number | string | null
  quality_score?: number | string | null

  reputation_score?: number | string | null
  reputation_level?: string | null

  policy_version?: number | string | null
  calculated_at?: string | null
}

type ExistingPopulationRow = {
  id?: string | null
  category_id?: string | null
  scope?: string | null
  city_key?: string | null
  policy_version?: number | string | null
}

/* =========================================================
 * Internal normalized contracts
 * ======================================================= */

type NormalizedCreatorReputationRow = {
  userId: string
  categoryId: ReputationCategoryId
  scope: ReputationScope
  cityKey: string | null

  verifiedVenueCount: number
  weightedVenueCount: number
  cityCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  recencyScore: number
  qualityScore: number

  reputationScore: number
  reputationLevel: ReputationLevel

  policyVersion: number
  calculatedAt: string | null
}

type RankingPopulationAccumulator = {
  categoryId: ReputationCategoryId
  scope: ReputationScope
  cityKey: string | null
  rows: NormalizedCreatorReputationRow[]
}

type NormalizedExistingPopulationRow = {
  id: string
  categoryId: ReputationCategoryId
  scope: ReputationScope
  cityKey: string | null
  policyVersion: number
}

/* =========================================================
 * Main rebuild
 * ======================================================= */

export async function rebuildReputationRankings(
  options:
    RebuildReputationRankingsOptions = {}
): Promise<RebuildReputationRankingsResult> {
  const policyVersion =
    normalizePolicyVersion(
      options.policyVersion ??
        REPUTATION_POLICY_VERSION
    )

  const categoryId =
    normalizeOptionalCategoryId(
      options.categoryId
    )

  const scope =
    normalizeOptionalScope(
      options.scope
    )

  const cityKey =
    normalizeOptionalSupportedCityKey(
      options.cityKey
    )

  validateTargetScope({
    scope,
    cityKey,
  })

  const rebuiltAt =
    normalizeTimestamp(
      options.calculatedAt
    ) ??
    new Date().toISOString()

  const supabase =
    getSupabaseAdmin()

  let aggregateQuery =
    supabase
      .from(
        'creator_reputation_stats'
      )
      .select(`
        user_id,
        category_id,
        scope,
        city_key,
        verified_venue_count,
        weighted_venue_count,
        city_count,
        public_collection_count,
        curated_venue_count,
        public_snapshot_count,
        completed_flow_count,
        recency_score,
        quality_score,
        reputation_score,
        reputation_level,
        policy_version,
        calculated_at
      `)
      .eq(
        'policy_version',
        policyVersion
      )

  if (
    categoryId
  ) {
    aggregateQuery =
      aggregateQuery.eq(
        'category_id',
        categoryId
      )
  }

  if (
    scope
  ) {
    aggregateQuery =
      aggregateQuery.eq(
        'scope',
        scope
      )
  }

  if (
    cityKey
  ) {
    aggregateQuery =
      aggregateQuery.eq(
        'city_key',
        cityKey
      )
  }

  const {
    data:
      aggregateRowsData,
    error:
      aggregateRowsError,
  } =
    await aggregateQuery

  throwIfQueryFailed(
    'creator_reputation_stats',
    aggregateRowsError
  )

  const aggregateRows =
    normalizeCreatorReputationRows(
      aggregateRowsData,
      {
        expectedPolicyVersion:
          policyVersion,
      }
    )

  const populationAccumulators =
    groupRowsByPopulation(
      aggregateRows
    )

  const populations:
    ReputationRankingPopulation[] =
    []

  const rankings:
    UserReputationRank[] =
    []

  for (
    const accumulator of
    populationAccumulators
  ) {
    const populationResult =
      buildRankingPopulation({
        accumulator,
        policyVersion,
        calculatedAt:
          rebuiltAt,
      })

    populations.push(
      populationResult.population
    )

    rankings.push(
      ...populationResult.rankings
    )
  }

  populations.sort(
    comparePopulations
  )

  rankings.sort(
    compareRankings
  )

  const persistence =
    await persistPopulationStats({
      supabase,
      populations,
      policyVersion,
      categoryId,
      scope,
      cityKey,
    })

  const result:
    RebuildReputationRankingsResult = {
    policyVersion,

    populations,

    rankings,

    sourceCounts: {
      aggregateRows:
        aggregateRows.length,

      representedPopulations:
        populations.length,

      eligibleRankingRows:
        rankings.length,
    },

    persistence,

    rebuiltAt,
  }

  await options.onPersisted?.(
    result
  )

  return result
}

/* =========================================================
 * Population calculation
 * ======================================================= */

function buildRankingPopulation({
  accumulator,
  policyVersion,
  calculatedAt,
}: {
  accumulator:
    RankingPopulationAccumulator

  policyVersion:
    number

  calculatedAt:
    string
}): {
  population:
    ReputationRankingPopulation

  rankings:
    UserReputationRank[]
} {
  const rows =
    deduplicatePopulationUsers(
      accumulator.rows
    )

  const eligibleRows =
    rows
      .filter(
        (
          row
        ) =>
          isEligibleForLeaderboard({
            categoryId:
              row.categoryId,

            scope:
              row.scope,

            cityKey:
              row.cityKey,

            components: {
              verifiedVenueCount:
                row.verifiedVenueCount,

              weightedVenueCount:
                row.weightedVenueCount,

              cityCount:
                row.cityCount,

              publicCollectionCount:
                row.publicCollectionCount,

              curatedVenueCount:
                row.curatedVenueCount,

              publicSnapshotCount:
                row.publicSnapshotCount,

              completedFlowCount:
                row.completedFlowCount,

              recencyScore:
                row.recencyScore,

              qualityScore:
                row.qualityScore,
            },
          })
      )
      .sort(
        compareEligibleRows
      )

  const eligibleUserCount =
    eligibleRows.length

  const rankings =
    eligibleRows.map(
      (
        row,
        index
      ): UserReputationRank => {
        const rank =
          index + 1

        return {
          userId:
            row.userId,

          categoryId:
            row.categoryId,

          scope:
            row.scope,

          cityKey:
            row.scope ===
            'city'
              ? row.cityKey
              : null,

          rank,

          eligibleUserCount,

          percentile:
            calculatePercentileStanding({
              rank,
              eligibleUserCount,
            }),

          score:
            roundToPrecision(
              row.reputationScore,
              4
            ),

          level:
            row.reputationLevel,

          calculatedAt,
        }
      }
    )

  const levelCounts =
    countLevels(
      rows
    )

  const earnedUserCount =
    rows.filter(
      (
        row
      ) =>
        row.reputationLevel !==
        'unranked'
    ).length

  const eligibleScores =
    eligibleRows.map(
      (
        row
      ) =>
        row.reputationScore
    )

  const eligibleVenueCounts =
    eligibleRows.map(
      (
        row
      ) =>
        row.verifiedVenueCount
    )

  const canPublishAnyRank =
    eligibleUserCount >=
    MINIMUM_RANKING_POPULATION
      .rank

  const canPublishAnyPercentile =
    eligibleUserCount >=
    MINIMUM_RANKING_POPULATION
      .percentile

  const canPublishTop10Percent =
    eligibleUserCount >=
    MINIMUM_RANKING_POPULATION
      .topTenPercent

  const canPublishTop5Percent =
    eligibleUserCount >=
    MINIMUM_RANKING_POPULATION
      .topFivePercent

  const canPublishTop1Percent =
    eligibleUserCount >=
    MINIMUM_RANKING_POPULATION
      .topOnePercent

  /**
   * Confirm the base rank and percentile gates through the
   * canonical policy helpers as a fail-safe.
   */
  const firstRank =
    eligibleUserCount >
    0
      ? 1
      : 0

  const policyAllowsRank =
    eligibleUserCount >
      0 &&
    canPublishRank({
      rank:
        firstRank,

      eligibleUserCount,
    })

  const policyAllowsPercentile =
    eligibleUserCount >
      0 &&
    canPublishPercentile({
      rank:
        firstRank,

      eligibleUserCount,
    })

  return {
    population: {
      categoryId:
        accumulator.categoryId,

      scope:
        accumulator.scope,

      cityKey:
        accumulator.scope ===
        'city'
          ? accumulator.cityKey
          : null,

      cityLabel:
        accumulator.scope ===
          'city'
          ? getCityLabel(
              accumulator.cityKey
            )
          : null,

      policyVersion,

      totalUserCount:
        rows.length,

      earnedUserCount,

      eligibleUserCount,

      levelCounts,

      scoreDistribution: {
        minimumEligibleScore:
          minimumNumber(
            eligibleScores
          ),

        maximumEligibleScore:
          maximumNumber(
            eligibleScores
          ),

        averageEligibleScore:
          averageNumber(
            eligibleScores
          ),

        medianEligibleScore:
          medianNumber(
            eligibleScores
          ),

        top25PercentScore:
          topPercentScore({
            descendingScores:
              eligibleScores,

            percent:
              25,
          }),

        top10PercentScore:
          topPercentScore({
            descendingScores:
              eligibleScores,

            percent:
              10,
          }),

        top5PercentScore:
          topPercentScore({
            descendingScores:
              eligibleScores,

            percent:
              5,
          }),

        top1PercentScore:
          topPercentScore({
            descendingScores:
              eligibleScores,

            percent:
              1,
          }),
      },

      evidenceDistribution: {
        averageVerifiedVenueCount:
          averageNumber(
            eligibleVenueCounts
          ),

        medianVerifiedVenueCount:
          medianNumber(
            eligibleVenueCounts
          ),

        maximumVerifiedVenueCount:
          maximumInteger(
            eligibleVenueCounts
          ),
      },

      publication: {
        canPublishRank:
          canPublishAnyRank &&
          policyAllowsRank,

        canPublishPercentile:
          canPublishAnyPercentile &&
          policyAllowsPercentile,

        canPublishTop10Percent:
          canPublishTop10Percent &&
          policyAllowsPercentile,

        canPublishTop5Percent:
          canPublishTop5Percent &&
          policyAllowsPercentile,

        canPublishTop1Percent:
          canPublishTop1Percent &&
          policyAllowsPercentile,
      },

      calculatedAt,
    },

    rankings,
  }
}

/* =========================================================
 * Population persistence
 * ======================================================= */

async function persistPopulationStats({
  supabase,
  populations,
  policyVersion,
  categoryId,
  scope,
  cityKey,
}: {
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >

  populations:
    ReputationRankingPopulation[]

  policyVersion:
    number

  categoryId:
    ReputationCategoryId | null

  scope:
    ReputationScope | null

  cityKey:
    string | null
}): Promise<{
  upsertedPopulationCount: number
  deletedStalePopulationCount: number
}> {
  const rows =
    populations.map(
      createPopulationPersistenceRow
    )

  /**
   * Current rows are upserted before stale rows are deleted.
   *
   * This avoids erasing existing population data when a write
   * fails partway through a rebuild.
   */
  for (
    const batch of
    chunkArray(
      rows,
      DATABASE_BATCH_SIZE
    )
  ) {
    if (
      batch.length ===
      0
    ) {
      continue
    }

    const {
      error,
    } =
      await supabase
        .from(
          'creator_reputation_category_stats'
        )
        .upsert(
          batch as any,
          {
            onConflict:
              'category_id,scope,scope_city_key,policy_version',
          }
        )

    throwIfQueryFailed(
      'creator_reputation_category_stats upsert',
      error
    )
  }

  let existingQuery =
    supabase
      .from(
        'creator_reputation_category_stats'
      )
      .select(`
        id,
        category_id,
        scope,
        city_key,
        policy_version
      `)
      .eq(
        'policy_version',
        policyVersion
      )

  if (
    categoryId
  ) {
    existingQuery =
      existingQuery.eq(
        'category_id',
        categoryId
      )
  }

  if (
    scope
  ) {
    existingQuery =
      existingQuery.eq(
        'scope',
        scope
      )
  }

  if (
    cityKey
  ) {
    existingQuery =
      existingQuery.eq(
        'city_key',
        cityKey
      )
  }

  const {
    data:
      existingRowsData,
    error:
      existingRowsError,
  } =
    await existingQuery

  throwIfQueryFailed(
    'creator_reputation_category_stats stale-row lookup',
    existingRowsError
  )

  const existingRows =
    normalizeExistingPopulationRows(
      existingRowsData
    )

  const currentIdentityKeys =
    new Set(
      populations.map(
        createPopulationIdentityKey
      )
    )

  const staleIds =
    existingRows
      .filter(
        (
          row
        ) =>
          !currentIdentityKeys.has(
            createPopulationIdentityKey(
              row
            )
          )
      )
      .map(
        (
          row
        ) =>
          row.id
      )

  let deletedStalePopulationCount =
    0

  for (
    const batch of
    chunkArray(
      staleIds,
      DATABASE_BATCH_SIZE
    )
  ) {
    if (
      batch.length ===
      0
    ) {
      continue
    }

    const {
      error,
      count,
    } =
      await supabase
        .from(
          'creator_reputation_category_stats'
        )
        .delete({
          count:
            'exact',
        })
        .eq(
          'policy_version',
          policyVersion
        )
        .in(
          'id',
          batch
        )

    throwIfQueryFailed(
      'creator_reputation_category_stats stale-row deletion',
      error
    )

    deletedStalePopulationCount +=
      count ??
      batch.length
  }

  return {
    upsertedPopulationCount:
      rows.length,

    deletedStalePopulationCount,
  }
}

function createPopulationPersistenceRow(
  population:
    ReputationRankingPopulation
) {
  return {
    category_id:
      population.categoryId,

    scope:
      population.scope,

    city_key:
      population.scope ===
      'city'
        ? population.cityKey
        : null,

    policy_version:
      population.policyVersion,

    total_user_count:
      population.totalUserCount,

    earned_user_count:
      population.earnedUserCount,

    eligible_user_count:
      population.eligibleUserCount,

    unranked_user_count:
      population
        .levelCounts
        .unranked,

    emerging_user_count:
      population
        .levelCounts
        .emerging,

    established_user_count:
      population
        .levelCounts
        .established,

    expert_user_count:
      population
        .levelCounts
        .expert,

    elite_user_count:
      population
        .levelCounts
        .elite,

    minimum_eligible_score:
      population
        .scoreDistribution
        .minimumEligibleScore,

    maximum_eligible_score:
      population
        .scoreDistribution
        .maximumEligibleScore,

    average_eligible_score:
      population
        .scoreDistribution
        .averageEligibleScore,

    median_eligible_score:
      population
        .scoreDistribution
        .medianEligibleScore,

    top_25_percent_score:
      population
        .scoreDistribution
        .top25PercentScore,

    top_10_percent_score:
      population
        .scoreDistribution
        .top10PercentScore,

    top_5_percent_score:
      population
        .scoreDistribution
        .top5PercentScore,

    top_1_percent_score:
      population
        .scoreDistribution
        .top1PercentScore,

    average_verified_venue_count:
      population
        .evidenceDistribution
        .averageVerifiedVenueCount,

    median_verified_venue_count:
      population
        .evidenceDistribution
        .medianVerifiedVenueCount,

    maximum_verified_venue_count:
      population
        .evidenceDistribution
        .maximumVerifiedVenueCount,

    can_publish_rank:
      population
        .publication
        .canPublishRank,

    can_publish_percentile:
      population
        .publication
        .canPublishPercentile,

    can_publish_top_10_percent:
      population
        .publication
        .canPublishTop10Percent,

    can_publish_top_5_percent:
      population
        .publication
        .canPublishTop5Percent,

    can_publish_top_1_percent:
      population
        .publication
        .canPublishTop1Percent,

    calculated_at:
      population.calculatedAt,

    updated_at:
      population.calculatedAt,
  }
}

/* =========================================================
 * Row normalization
 * ======================================================= */

function normalizeCreatorReputationRows(
  value:
    unknown,
  {
    expectedPolicyVersion,
  }: {
    expectedPolicyVersion:
      number
  }
): NormalizedCreatorReputationRow[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  return value
    .map(
      (
        raw
      ):
        NormalizedCreatorReputationRow | null => {
        const row =
          raw as CreatorReputationStatsRow

        const userId =
          normalizeIdentifier(
            row.user_id
          )

        const categoryId =
          row.category_id

        const scope =
          row.scope

        const reputationLevel =
          row.reputation_level

        const policyVersion =
          normalizePositiveInteger(
            row.policy_version
          )

        if (
          !userId ||
          !isReputationCategoryId(
            categoryId
          ) ||
          !isReputationScope(
            scope
          ) ||
          !isReputationLevel(
            reputationLevel
          ) ||
          policyVersion !==
            expectedPolicyVersion
        ) {
          return null
        }

        const cityKey =
          scope ===
          'city'
            ? normalizeOptionalSupportedCityKey(
                row.city_key
              )
            : null

        if (
          scope ===
            'city' &&
          !cityKey
        ) {
          return null
        }

        return {
          userId,
          categoryId,
          scope,
          cityKey,

          verifiedVenueCount:
            normalizeCount(
              row.verified_venue_count
            ),

          weightedVenueCount:
            normalizeNonNegativeNumber(
              row.weighted_venue_count
            ),

          cityCount:
            normalizeCount(
              row.city_count
            ),

          publicCollectionCount:
            normalizeCount(
              row.public_collection_count
            ),

          curatedVenueCount:
            normalizeCount(
              row.curated_venue_count
            ),

          publicSnapshotCount:
            normalizeCount(
              row.public_snapshot_count
            ),

          completedFlowCount:
            normalizeCount(
              row.completed_flow_count
            ),

          recencyScore:
            normalizeNonNegativeNumber(
              row.recency_score
            ),

          qualityScore:
            normalizeNonNegativeNumber(
              row.quality_score
            ),

          reputationScore:
            normalizeNonNegativeNumber(
              row.reputation_score
            ),

          reputationLevel,

          policyVersion,

          calculatedAt:
            normalizeTimestamp(
              row.calculated_at
            ),
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedCreatorReputationRow =>
        row !==
        null
    )
}

function normalizeExistingPopulationRows(
  value:
    unknown
): NormalizedExistingPopulationRow[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  return value
    .map(
      (
        raw
      ):
        NormalizedExistingPopulationRow | null => {
        const row =
          raw as ExistingPopulationRow

        const id =
          normalizeIdentifier(
            row.id
          )

        const categoryId =
          row.category_id

        const scope =
          row.scope

        const policyVersion =
          normalizePositiveInteger(
            row.policy_version
          )

        if (
          !id ||
          !isReputationCategoryId(
            categoryId
          ) ||
          !isReputationScope(
            scope
          ) ||
          policyVersion ===
            null
        ) {
          return null
        }

        const cityKey =
          scope ===
          'city'
            ? normalizeOptionalSupportedCityKey(
                row.city_key
              )
            : null

        if (
          scope ===
            'city' &&
          !cityKey
        ) {
          return null
        }

        return {
          id,
          categoryId,
          scope,
          cityKey,
          policyVersion,
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedExistingPopulationRow =>
        row !==
        null
    )
}

/* =========================================================
 * Grouping and deduplication
 * ======================================================= */

function groupRowsByPopulation(
  rows:
    NormalizedCreatorReputationRow[]
): RankingPopulationAccumulator[] {
  const accumulators =
    new Map<
      string,
      RankingPopulationAccumulator
    >()

  for (
    const row of
    rows
  ) {
    const key =
      createPopulationIdentityKey(
        row
      )

    const accumulator =
      accumulators.get(
        key
      ) ??
      {
        categoryId:
          row.categoryId,

        scope:
          row.scope,

        cityKey:
          row.scope ===
          'city'
            ? row.cityKey
            : null,

        rows: [],
      }

    accumulator.rows.push(
      row
    )

    accumulators.set(
      key,
      accumulator
    )
  }

  return [
    ...accumulators.values(),
  ].sort(
    (
      first,
      second
    ) =>
      comparePopulationIdentity(
        first,
        second
      )
  )
}

/**
 * The database identity constraint should already enforce one
 * aggregate per user and population.
 *
 * This fail-safe retains the most recently calculated row if
 * malformed historical data contains duplicates.
 */
function deduplicatePopulationUsers(
  rows:
    NormalizedCreatorReputationRow[]
): NormalizedCreatorReputationRow[] {
  const rowsByUserId =
    new Map<
      string,
      NormalizedCreatorReputationRow
    >()

  for (
    const row of
    rows
  ) {
    const existing =
      rowsByUserId.get(
        row.userId
      )

    if (
      !existing
    ) {
      rowsByUserId.set(
        row.userId,
        row
      )

      continue
    }

    const existingTime =
      existing.calculatedAt
        ? Date.parse(
            existing.calculatedAt
          )
        : 0

    const candidateTime =
      row.calculatedAt
        ? Date.parse(
            row.calculatedAt
          )
        : 0

    if (
      candidateTime >
      existingTime
    ) {
      rowsByUserId.set(
        row.userId,
        row
      )
    }
  }

  return [
    ...rowsByUserId.values(),
  ]
}

/* =========================================================
 * Ranking order
 * ======================================================= */

/**
 * Canonical deterministic ranking order:
 *
 * 1. reputation score descending
 * 2. verified venue count descending
 * 3. weighted venue count descending
 * 4. public collection count descending
 * 5. curated venue count descending
 * 6. user ID ascending
 *
 * The final user-ID tie-break guarantees one stable ordinal
 * position for every eligible creator.
 */
function compareEligibleRows(
  first:
    NormalizedCreatorReputationRow,
  second:
    NormalizedCreatorReputationRow
): number {
  return (
    second.reputationScore -
      first.reputationScore ||
    second.verifiedVenueCount -
      first.verifiedVenueCount ||
    second.weightedVenueCount -
      first.weightedVenueCount ||
    second.publicCollectionCount -
      first.publicCollectionCount ||
    second.curatedVenueCount -
      first.curatedVenueCount ||
    first.userId.localeCompare(
      second.userId,
      'en-US',
      {
        sensitivity:
          'base',
      }
    )
  )
}

function compareRankings(
  first:
    UserReputationRank,
  second:
    UserReputationRank
): number {
  return (
    comparePopulationIdentity(
      first,
      second
    ) ||
    first.rank -
      second.rank ||
    first.userId.localeCompare(
      second.userId
    )
  )
}

function comparePopulations(
  first:
    ReputationRankingPopulation,
  second:
    ReputationRankingPopulation
): number {
  return comparePopulationIdentity(
    first,
    second
  )
}

function comparePopulationIdentity(
  first: {
    categoryId:
      ReputationCategoryId

    scope:
      ReputationScope

    cityKey:
      string | null
  },
  second: {
    categoryId:
      ReputationCategoryId

    scope:
      ReputationScope

    cityKey:
      string | null
  }
): number {
  const scopeDifference =
    getScopeSortOrder(
      first.scope
    ) -
    getScopeSortOrder(
      second.scope
    )

  if (
    scopeDifference !==
    0
  ) {
    return scopeDifference
  }

  const cityDifference =
    (
      first.cityKey ??
      ''
    ).localeCompare(
      second.cityKey ??
      '',
      'en-US',
      {
        sensitivity:
          'base',
      }
    )

  if (
    cityDifference !==
    0
  ) {
    return cityDifference
  }

  return first.categoryId.localeCompare(
    second.categoryId
  )
}

function getScopeSortOrder(
  scope:
    ReputationScope
): number {
  return scope ===
    'global'
    ? 0
    : 1
}

/* =========================================================
 * Distribution calculations
 * ======================================================= */

function countLevels(
  rows:
    NormalizedCreatorReputationRow[]
): ReputationRankingPopulation['levelCounts'] {
  const counts:
    ReputationRankingPopulation['levelCounts'] = {
    unranked:
      0,

    emerging:
      0,

    established:
      0,

    expert:
      0,

    elite:
      0,
  }

  for (
    const row of
    rows
  ) {
    counts[
      row.reputationLevel
    ] +=
      1
  }

  return counts
}

function minimumNumber(
  values:
    readonly number[]
): number | null {
  const normalized =
    normalizeNumberArray(
      values
    )

  if (
    normalized.length ===
    0
  ) {
    return null
  }

  return roundToPrecision(
    Math.min(
      ...normalized
    ),
    4
  )
}

function maximumNumber(
  values:
    readonly number[]
): number | null {
  const normalized =
    normalizeNumberArray(
      values
    )

  if (
    normalized.length ===
    0
  ) {
    return null
  }

  return roundToPrecision(
    Math.max(
      ...normalized
    ),
    4
  )
}

function maximumInteger(
  values:
    readonly number[]
): number | null {
  const maximum =
    maximumNumber(
      values
    )

  return maximum ===
    null
    ? null
    : Math.floor(
        maximum
      )
}

function averageNumber(
  values:
    readonly number[]
): number | null {
  const normalized =
    normalizeNumberArray(
      values
    )

  if (
    normalized.length ===
    0
  ) {
    return null
  }

  const total =
    normalized.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    )

  return roundToPrecision(
    total /
      normalized.length,
    4
  )
}

function medianNumber(
  values:
    readonly number[]
): number | null {
  const normalized =
    normalizeNumberArray(
      values
    ).sort(
      (
        first,
        second
      ) =>
        first -
        second
    )

  if (
    normalized.length ===
    0
  ) {
    return null
  }

  const middleIndex =
    Math.floor(
      normalized.length /
        2
    )

  if (
    normalized.length %
      2 ===
    1
  ) {
    return roundToPrecision(
      normalized[
        middleIndex
      ],
      4
    )
  }

  return roundToPrecision(
    (
      normalized[
        middleIndex -
          1
      ] +
      normalized[
        middleIndex
      ]
    ) /
      2,
    4
  )
}

/**
 * Returns the lowest score still occupying the requested top
 * share of the eligible population.
 *
 * Examples:
 *
 * - top 25 percent of 100 users -> score at rank 25
 * - top 10 percent of 51 users  -> score at rank 6
 * - top 1 percent of 100 users  -> score at rank 1
 *
 * Population-readiness rules determine whether these thresholds
 * may be used for public claims.
 */
function topPercentScore({
  descendingScores,
  percent,
}: {
  descendingScores:
    readonly number[]

  percent:
    number
}): number | null {
  const normalized =
    normalizeNumberArray(
      descendingScores
    ).sort(
      (
        first,
        second
      ) =>
        second -
        first
    )

  if (
    normalized.length ===
    0
  ) {
    return null
  }

  const normalizedPercent =
    Math.min(
      100,
      Math.max(
        0,
        percent
      )
    )

  if (
    normalizedPercent <=
    0
  ) {
    return null
  }

  const qualifyingCount =
    Math.max(
      1,
      Math.ceil(
        normalized.length *
          (
            normalizedPercent /
            100
          )
      )
    )

  return roundToPrecision(
    normalized[
      qualifyingCount -
        1
    ],
    4
  )
}

function normalizeNumberArray(
  values:
    readonly number[]
): number[] {
  return values.filter(
    (
      value
    ) =>
      typeof value ===
        'number' &&
      Number.isFinite(
        value
      ) &&
      value >=
        0
  )
}

/* =========================================================
 * Identity helpers
 * ======================================================= */

function createPopulationIdentityKey(
  value: {
    categoryId:
      ReputationCategoryId

    scope:
      ReputationScope

    cityKey:
      string | null

    policyVersion?:
      number
  }
): string {
  return [
    value.categoryId,
    value.scope,
    value.scope ===
      'city'
      ? value.cityKey ??
        '__missing_city__'
      : GLOBAL_SCOPE_CITY_KEY,
    value.policyVersion ??
      '',
  ].join(
    ':'
  )
}

/* =========================================================
 * Target validation
 * ======================================================= */

function validateTargetScope({
  scope,
  cityKey,
}: {
  scope:
    ReputationScope | null

  cityKey:
    string | null
}): void {
  if (
    scope ===
      'city' &&
    !cityKey
  ) {
    throw new Error(
      '[rebuildReputationRankings] cityKey is required when scope is city.'
    )
  }

  if (
    scope ===
      'global' &&
    cityKey
  ) {
    throw new Error(
      '[rebuildReputationRankings] cityKey must be omitted when scope is global.'
    )
  }
}

/* =========================================================
 * General normalization
 * ======================================================= */

function normalizeOptionalCategoryId(
  value:
    unknown
): ReputationCategoryId | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  if (
    !isReputationCategoryId(
      value
    )
  ) {
    throw new Error(
      '[rebuildReputationRankings] categoryId is invalid.'
    )
  }

  return value
}

function normalizeOptionalScope(
  value:
    unknown
): ReputationScope | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  if (
    !isReputationScope(
      value
    )
  ) {
    throw new Error(
      '[rebuildReputationRankings] scope is invalid.'
    )
  }

  return value
}

function normalizeOptionalSupportedCityKey(
  value:
    unknown
): string | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  if (
    typeof value !==
      'string'
  ) {
    throw new Error(
      '[rebuildReputationRankings] cityKey is invalid.'
    )
  }

  const normalized =
    normalizeCityKey(
      value
    )

  if (
    !isSupportedCityKey(
      normalized
    )
  ) {
    throw new Error(
      '[rebuildReputationRankings] cityKey is not a supported canonical city.'
    )
  }

  return normalized
}

function normalizePolicyVersion(
  value:
    unknown
): number {
  const normalized =
    normalizePositiveInteger(
      value
    )

  if (
    normalized ===
    null
  ) {
    throw new Error(
      '[rebuildReputationRankings] policyVersion must be a positive integer.'
    )
  }

  return normalized
}

function normalizeIdentifier(
  value:
    unknown
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
    /[\r\n\t\0]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeCount(
  value:
    unknown
): number {
  const parsed =
    parseNumber(
      value
    )

  if (
    parsed ===
      null ||
    parsed <=
      0
  ) {
    return 0
  }

  return Math.floor(
    parsed
  )
}

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const parsed =
    parseNumber(
      value
    )

  if (
    parsed ===
      null ||
    parsed <=
      0 ||
    !Number.isInteger(
      parsed
    )
  ) {
    return null
  }

  return parsed
}

function normalizeNonNegativeNumber(
  value:
    unknown
): number {
  const parsed =
    parseNumber(
      value
    )

  if (
    parsed ===
      null ||
    parsed <=
      0
  ) {
    return 0
  }

  return parsed
}

function parseNumber(
  value:
    unknown
): number | null {
  const parsed =
    typeof value ===
      'number'
      ? value
      : typeof value ===
          'string' &&
        value.trim()
          .length >
          0
        ? Number(
            value
          )
        : Number.NaN

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null
}

function normalizeTimestamp(
  value:
    unknown
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
    !normalized
  ) {
    return null
  }

  const timestamp =
    Date.parse(
      normalized
    )

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

function chunkArray<
  T,
>(
  values:
    readonly T[],
  size:
    number
): T[][] {
  const safeSize =
    Math.max(
      1,
      Math.trunc(
        size
      )
    )

  const chunks:
    T[][] = []

  for (
    let index =
      0;
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

function roundToPrecision(
  value:
    number,
  decimalPlaces:
    number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0
  }

  const safeDecimalPlaces =
    Math.min(
      8,
      Math.max(
        0,
        Math.trunc(
          decimalPlaces
        )
      )
    )

  const factor =
    10 **
    safeDecimalPlaces

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        factor
    ) /
    factor
  )
}

function throwIfQueryFailed(
  queryName:
    string,
  error:
    | {
        message?: string
        code?: string
        details?: string
        hint?: string
      }
    | null
    | undefined
): void {
  if (
    !error
  ) {
    return
  }

  const details =
    [
      error.message,

      error.code
        ? `code=${error.code}`
        : null,

      error.details
        ? `details=${error.details}`
        : null,

      error.hint
        ? `hint=${error.hint}`
        : null,
    ]
      .filter(
        Boolean
      )
      .join(
        ' | '
      )

  throw new Error(
    `[rebuildReputationRankings] ${queryName} failed: ${details}`
  )
}