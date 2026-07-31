import { NextResponse } from 'next/server'

import {
  safelyLoadPublicCreatorReputation,
} from '@/lib/reputation/safelyLoadPublicCreatorReputation'
import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin'
import {
  supabaseServerApi,
} from '@/lib/supabase/server-api'

/* =========================================================
 * Owner reputation contracts
 * ======================================================= */

type OwnerReputationScope =
  | 'global'
  | 'city'

type OwnerReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

type OwnerReputationDetail = {
  categoryId: string
  categoryLabel: string
  categoryShortLabel: string

  scope: OwnerReputationScope
  cityKey: string | null

  reputationLevel: OwnerReputationLevel
  reputationScore: number

  verifiedVenueCount: number
  weightedVenueCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  cityCount: number

  rank: number | null
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null

  minimumVerifiedVenueCount: number | null
  eligibilityCurrent: number
  eligibilityRequired: number | null
  eligibilityPercent: number | null
  eligible: boolean
  qualificationLabel: string

  canPublishRank: boolean
  canPublishPercentile: boolean

  policyVersion: number
  calculatedAt: string | null
  rankingCalculatedAt: string | null
}

type CreatorReputationStatsRow =
  Record<string, unknown> & {
    user_id?: unknown
    category_id?: unknown
    scope?: unknown
    city_key?: unknown
    scope_city_key?: unknown

    reputation_level?: unknown
    reputation_score?: unknown

    verified_venue_count?: unknown
    weighted_venue_count?: unknown
    public_collection_count?: unknown
    curated_venue_count?: unknown
    public_snapshot_count?: unknown
    completed_flow_count?: unknown
    city_count?: unknown

    policy_version?: unknown
    calculated_at?: unknown
    updated_at?: unknown
  }

type ReputationCategoryRow =
  Record<string, unknown> & {
    id?: unknown
    label?: unknown
    plural_label?: unknown
    short_label?: unknown
    minimum_venues_for_status?: unknown
    minimum_venues_for_ranking?: unknown
    is_active?: unknown
  }

type CreatorReputationPopulationRow =
  Record<string, unknown> & {
    category_id?: unknown
    scope?: unknown
    city_key?: unknown
    scope_city_key?: unknown
    policy_version?: unknown

    total_user_count?: unknown
    earned_user_count?: unknown
    eligible_user_count?: unknown

    can_publish_rank?: unknown
    can_publish_percentile?: unknown

    calculated_at?: unknown
    updated_at?: unknown
  }

type NormalizedReputationCategory = {
  id: string
  label: string
  shortLabel: string
  minimumVenuesForStatus: number | null
  minimumVenuesForRanking: number | null
}

type NormalizedReputationPopulation = {
  key: string
  categoryId: string
  scope: OwnerReputationScope
  cityKey: string | null
  policyVersion: number

  totalUserCount: number
  earnedUserCount: number
  eligibleUserCount: number

  canPublishRank: boolean
  canPublishPercentile: boolean

  calculatedAt: string | null
}

type NormalizedUserRanking = {
  key: string
  userId: string
  categoryId: string
  scope: OwnerReputationScope
  cityKey: string | null
  policyVersion: number

  rank: number
  eligibleCreatorCount: number
  topPercent: number
  rankLabel: string
}

/* =========================================================
 * Authenticated owner reputation endpoint
 * ======================================================= */

export async function GET() {
  try {
    const supabase =
      await supabaseServerApi()

    const {
      data: {
        user,
      },
      error:
        authenticationError,
    } =
      await supabase.auth.getUser()

    if (
      authenticationError ||
      !user
    ) {
      return jsonResponse(
        {
          error:
            'Unauthorized',
        },
        401
      )
    }

    const admin =
      getSupabaseAdmin()

    const [
      publicReputationResult,
      internalStatsResult,
      categoryResult,
      populationResult,
      rankingCandidateResult,
    ] = await Promise.all([
      safelyLoadPublicCreatorReputation(
        user.id,
        {
          includeUnranked:
            true,

          includeGlobal:
            true,

          includeCity:
            true,
        }
      ),

      admin
        .from(
          'creator_reputation_stats'
        )
        .select(`
          user_id,
          category_id,
          scope,
          city_key,
          scope_city_key,
          reputation_level,
          reputation_score,
          verified_venue_count,
          weighted_venue_count,
          public_collection_count,
          curated_venue_count,
          public_snapshot_count,
          completed_flow_count,
          city_count,
          policy_version,
          calculated_at,
          updated_at
        `)
        .eq(
          'user_id',
          user.id
        )
        .order(
          'policy_version',
          {
            ascending:
              false,
          }
        )
        .order(
          'reputation_score',
          {
            ascending:
              false,
          }
        ),

      admin
        .from(
          'reputation_categories'
        )
        .select(`
          id,
          label,
          plural_label,
          minimum_venues_for_status,
          minimum_venues_for_ranking,
          is_active
        `)
        .eq(
          'is_active',
          true
        ),

      admin
        .from(
          'creator_reputation_category_stats'
        )
        .select(`
          category_id,
          scope,
          city_key,
          scope_city_key,
          policy_version,
          total_user_count,
          earned_user_count,
          eligible_user_count,
          can_publish_rank,
          can_publish_percentile,
          calculated_at,
          updated_at
        `)
        .order(
          'policy_version',
          {
            ascending:
              false,
          }
        ),

      /**
       * Percentiles require the complete eligible comparison
       * population, not only the authenticated user's rows.
       *
       * This remains server-side and uses the trusted admin
       * client. Only the authenticated user's resulting rank and
       * percentile are returned by this endpoint.
       */
      admin
        .from(
          'creator_reputation_stats'
        )
        .select(`
          user_id,
          category_id,
          scope,
          city_key,
          scope_city_key,
          reputation_level,
          reputation_score,
          verified_venue_count,
          weighted_venue_count,
          public_collection_count,
          curated_venue_count,
          public_snapshot_count,
          completed_flow_count,
          city_count,
          policy_version,
          calculated_at,
          updated_at
        `)
        .order(
          'policy_version',
          {
            ascending:
              false,
          }
        )
        .order(
          'reputation_score',
          {
            ascending:
              false,
          }
        ),
    ])

    if (
      internalStatsResult.error
    ) {
      console.error(
        '[profile/reputation] Failed to load owner reputation details:',
        {
          userId:
            user.id,

          error:
            serializeDatabaseError(
              internalStatsResult.error
            ),
        }
      )

      return jsonResponse(
        {
          reputation:
            publicReputationResult.reputation,

          found:
            publicReputationResult.found,

          details: [],

          policyVersion:
            publicReputationResult
              .reputation
              .policyVersion,

          warning:
            'Detailed reputation information is temporarily unavailable.',
        },
        200
      )
    }

    const warnings:
      string[] = []

    if (
      categoryResult.error
    ) {
      console.error(
        '[profile/reputation] Failed to load reputation category metadata:',
        {
          userId:
            user.id,

          error:
            serializeDatabaseError(
              categoryResult.error
            ),
        }
      )

      warnings.push(
        'Reputation qualification details are temporarily unavailable.'
      )
    }

    if (
      populationResult.error
    ) {
      console.error(
        '[profile/reputation] Failed to load reputation ranking populations:',
        {
          userId:
            user.id,

          error:
            serializeDatabaseError(
              populationResult.error
            ),
        }
      )

      warnings.push(
        'Reputation ranking population details are temporarily unavailable.'
      )
    }

    if (
      rankingCandidateResult.error
    ) {
      console.error(
        '[profile/reputation] Failed to load percentile comparison rows:',
        {
          userId:
            user.id,

          error:
            serializeDatabaseError(
              rankingCandidateResult.error
            ),
        }
      )

      warnings.push(
        'Current percentile standings are temporarily unavailable.'
      )
    }

    const normalizedRows =
      normalizeOwnerReputationRows(
        internalStatsResult.data
      )

    const latestPolicyVersion =
      determineLatestPolicyVersion(
        normalizedRows
      )

    const latestRows =
      latestPolicyVersion ===
      null
        ? []
        : normalizedRows.filter(
            (row) =>
              row.policyVersion ===
              latestPolicyVersion
          )

    const categoriesById =
      normalizeCategoriesById(
        categoryResult.error
          ? []
          : categoryResult.data
      )

    const populationsByKey =
      normalizePopulationsByKey(
        populationResult.error
          ? []
          : populationResult.data,

        latestPolicyVersion
      )

    const rankingRows =
      rankingCandidateResult.error
        ? []
        : normalizeOwnerReputationRows(
            rankingCandidateResult.data
          )

    const rankingsByKey =
      buildUserRankingsByKey({
        rows:
          rankingRows,

        categoriesById,

        policyVersion:
          latestPolicyVersion,
      })

    const details =
      enrichOwnerReputationDetails({
        userId:
          user.id,

        rows:
          latestRows,

        categoriesById,

        populationsByKey,

        rankingsByKey,
      })

    const warning =
      warnings.length > 0
        ? warnings.join(' ')
        : null

    return jsonResponse(
      {
        reputation:
          publicReputationResult.reputation,

        found:
          publicReputationResult.found ||
          details.length > 0,

        details,

        policyVersion:
          latestPolicyVersion ??
          publicReputationResult
            .reputation
            .policyVersion,

        ...(warning
          ? {
              warning,
            }
          : {}),
      },
      200
    )
  } catch (error) {
    console.error(
      '[profile/reputation] Unexpected error:',
      serializeUnknownError(
        error
      )
    )

    return jsonResponse(
      {
        error:
          'Unexpected error loading reputation.',
      },
      500
    )
  }
}

/* =========================================================
 * Response helper
 * ======================================================= */

function jsonResponse(
  body: unknown,
  status: number
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        'Cache-Control':
          'private, no-store, max-age=0',

        Pragma:
          'no-cache',
      },
    }
  )
}

/* =========================================================
 * Owner-detail normalization
 * ======================================================= */

type NormalizedOwnerReputationRow = {
  userId: string

  categoryId: string
  scope: OwnerReputationScope
  cityKey: string | null

  reputationLevel: OwnerReputationLevel
  reputationScore: number

  verifiedVenueCount: number
  weightedVenueCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  cityCount: number

  policyVersion: number
  calculatedAt: string | null
}

function normalizeOwnerReputationRows(
  value: unknown
): NormalizedOwnerReputationRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows:
    NormalizedOwnerReputationRow[] = []

  for (
    const rawRow of
      value
  ) {
    if (
      !isRecord(
        rawRow
      )
    ) {
      continue
    }

    const row =
      rawRow as
        CreatorReputationStatsRow

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

    const reputationLevel =
      normalizeReputationLevel(
        row.reputation_level
      )

    const policyVersion =
      normalizePositiveInteger(
        row.policy_version
      )

    if (
      !userId ||
      !categoryId ||
      !scope ||
      !reputationLevel ||
      policyVersion ===
        null
    ) {
      continue
    }

    const cityKey =
      scope === 'city'
        ? normalizeRequiredText(
            row.city_key
          )
        : null

    if (
      scope === 'city' &&
      !cityKey
    ) {
      continue
    }

    rows.push({
      userId,

      categoryId,

      scope,

      cityKey,

      reputationLevel,

      reputationScore:
        normalizeNonNegativeNumber(
          row.reputation_score
        ),

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

      policyVersion,

      calculatedAt:
        normalizeIsoDate(
          row.calculated_at
        ) ??
        normalizeIsoDate(
          row.updated_at
        ),
    })
  }

  return rows.sort(
    (
      first,
      second
    ) => {
      if (
        first.policyVersion !==
        second.policyVersion
      ) {
        return (
          second.policyVersion -
          first.policyVersion
        )
      }

      if (
        first.reputationScore !==
        second.reputationScore
      ) {
        return (
          second.reputationScore -
          first.reputationScore
        )
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

      const categoryDifference =
        first.categoryId.localeCompare(
          second.categoryId
        )

      if (
        categoryDifference !==
        0
      ) {
        return categoryDifference
      }

      return first.userId.localeCompare(
        second.userId
      )
    }
  )
}

function determineLatestPolicyVersion(
  rows: NormalizedOwnerReputationRow[]
): number | null {
  let latest:
    number | null = null

  for (const row of rows) {
    if (
      latest === null ||
      row.policyVersion >
        latest
    ) {
      latest =
        row.policyVersion
    }
  }

  return latest
}

/* =========================================================
 * Category metadata normalization
 * ======================================================= */

function normalizeCategoriesById(
  value: unknown
): Map<
  string,
  NormalizedReputationCategory
> {
  const categories =
    new Map<
      string,
      NormalizedReputationCategory
    >()

  if (!Array.isArray(value)) {
    return categories
  }

  for (
    const rawCategory of
      value
  ) {
    if (
      !isRecord(
        rawCategory
      )
    ) {
      continue
    }

    const category =
      rawCategory as
        ReputationCategoryRow

    if (
      category.is_active ===
      false
    ) {
      continue
    }

    const id =
      normalizeRequiredText(
        category.id
      )

    if (!id) {
      continue
    }

    const label =
      normalizeRequiredText(
        category.label
      ) ??
      formatIdentifier(
        id
      )

    categories.set(
      id,
      {
        id,

        label,

        shortLabel:
          buildCategoryShortLabel(
            label
          ),

        minimumVenuesForStatus:
          normalizePositiveInteger(
            category.minimum_venues_for_status
          ),

        minimumVenuesForRanking:
          normalizePositiveInteger(
            category.minimum_venues_for_ranking
          ),
      }
    )
  }

  return categories
}

function buildCategoryShortLabel(
  label: string
): string {
  const normalized =
    label
      .replace(
        /\s+explorer$/i,
        ''
      )
      .trim()

  return normalized ||
    label
}

/* =========================================================
 * Population normalization
 * ======================================================= */

function normalizePopulationsByKey(
  value: unknown,
  policyVersion: number | null
): Map<
  string,
  NormalizedReputationPopulation
> {
  const populations =
    new Map<
      string,
      NormalizedReputationPopulation
    >()

  if (
    !Array.isArray(value) ||
    policyVersion === null
  ) {
    return populations
  }

  for (
    const rawPopulation of
      value
  ) {
    if (
      !isRecord(
        rawPopulation
      )
    ) {
      continue
    }

    const population =
      rawPopulation as
        CreatorReputationPopulationRow

    const categoryId =
      normalizeRequiredText(
        population.category_id
      )

    const scope =
      normalizeScope(
        population.scope
      )

    const normalizedPolicyVersion =
      normalizePositiveInteger(
        population.policy_version
      )

    if (
      !categoryId ||
      !scope ||
      normalizedPolicyVersion !==
        policyVersion
    ) {
      continue
    }

    const cityKey =
      scope === 'city'
        ? normalizeRequiredText(
            population.city_key
          )
        : null

    if (
      scope === 'city' &&
      !cityKey
    ) {
      continue
    }

    const key =
      buildPopulationKey({
        categoryId,
        scope,
        cityKey,
        policyVersion:
          normalizedPolicyVersion,
      })

    populations.set(
      key,
      {
        key,

        categoryId,

        scope,

        cityKey,

        policyVersion:
          normalizedPolicyVersion,

        totalUserCount:
          normalizeNonNegativeInteger(
            population.total_user_count
          ),

        earnedUserCount:
          normalizeNonNegativeInteger(
            population.earned_user_count
          ),

        eligibleUserCount:
          normalizeNonNegativeInteger(
            population.eligible_user_count
          ),

        canPublishRank:
          population.can_publish_rank ===
          true,

        canPublishPercentile:
          population.can_publish_percentile ===
          true,

        calculatedAt:
          normalizeIsoDate(
            population.calculated_at
          ) ??
          normalizeIsoDate(
            population.updated_at
          ),
      }
    )
  }

  return populations
}

function buildPopulationKey({
  categoryId,
  scope,
  cityKey,
  policyVersion,
}: {
  categoryId: string
  scope: OwnerReputationScope
  cityKey: string | null
  policyVersion: number
}): string {
  return [
    categoryId,
    scope,
    scope === 'city'
      ? cityKey ??
        ''
      : '__global__',
    policyVersion.toString(),
  ].join(':')
}

/* =========================================================
 * Percentile and rank calculation
 * ======================================================= */

/**
 * Builds an owner-safe ranking lookup from the complete
 * comparison population.
 *
 * Eligibility is calculated with the same evidence requirements
 * already used by this route:
 *
 * - the category's minimum verified venue requirement
 * - at least 4 weighted venues
 *
 * Equal scores receive the same competition rank. For example:
 *
 *   120, 120, 90
 *
 * becomes:
 *
 *   1, 1, 3
 *
 * This avoids inventing a superiority claim between equal
 * reputation scores.
 */
function buildUserRankingsByKey({
  rows,
  categoriesById,
  policyVersion,
}: {
  rows:
    NormalizedOwnerReputationRow[]

  categoriesById:
    Map<
      string,
      NormalizedReputationCategory
    >

  policyVersion:
    number | null
}): Map<
  string,
  NormalizedUserRanking
> {
  const rankings =
    new Map<
      string,
      NormalizedUserRanking
    >()

  if (
    policyVersion ===
    null
  ) {
    return rankings
  }

  const eligibleRows =
    rows.filter(
      (
        row
      ) => {
        if (
          row.policyVersion !==
          policyVersion
        ) {
          return false
        }

        const category =
          categoriesById.get(
            row.categoryId
          )

        const minimumVerifiedVenueCount =
          category
            ?.minimumVenuesForRanking ??
          null

        if (
          minimumVerifiedVenueCount ===
          null
        ) {
          return false
        }

        return (
          row.verifiedVenueCount >=
            minimumVerifiedVenueCount &&
          row.weightedVenueCount >=
            4
        )
      }
    )

  const rowsByPopulation =
    new Map<
      string,
      NormalizedOwnerReputationRow[]
    >()

  for (
    const row of
      eligibleRows
  ) {
    const populationKey =
      buildPopulationKey({
        categoryId:
          row.categoryId,

        scope:
          row.scope,

        cityKey:
          row.cityKey,

        policyVersion:
          row.policyVersion,
      })

    const currentRows =
      rowsByPopulation.get(
        populationKey
      ) ??
      []

    currentRows.push(
      row
    )

    rowsByPopulation.set(
      populationKey,
      currentRows
    )
  }

  for (
    const populationRows of
      rowsByPopulation.values()
  ) {
    const sortedRows =
      populationRows
        .slice()
        .sort(
          (
            first,
            second
          ) => {
            if (
              first.reputationScore !==
              second.reputationScore
            ) {
              return (
                second.reputationScore -
                first.reputationScore
              )
            }

            return first.userId.localeCompare(
              second.userId
            )
          }
        )

    const eligibleCreatorCount =
      sortedRows.length

    for (
      let index =
        0;
      index <
      sortedRows.length;
      index +=
        1
    ) {
      const row =
        sortedRows[
          index
        ]

      /**
       * Competition rank:
       *
       * rank = one plus the number of users with a strictly
       * higher reputation score.
       */
      const rank =
        1 +
        sortedRows.filter(
          (
            candidate
          ) =>
            candidate.reputationScore >
            row.reputationScore
        ).length

      /**
       * Top-percent placement uses rank position divided by the
       * eligible population.
       *
       * Examples:
       *
       * - rank 1 of 1   -> Top 100%
       * - rank 1 of 2   -> Top 50%
       * - rank 1 of 100 -> Top 1%
       * - rank 5 of 100 -> Top 5%
       */
      const topPercent =
        calculateTopPercent({
          rank,
          eligibleCreatorCount,
        })

      const rankingKey =
        buildUserRankingKey({
          userId:
            row.userId,

          categoryId:
            row.categoryId,

          scope:
            row.scope,

          cityKey:
            row.cityKey,

          policyVersion:
            row.policyVersion,
        })

      rankings.set(
        rankingKey,
        {
          key:
            rankingKey,

          userId:
            row.userId,

          categoryId:
            row.categoryId,

          scope:
            row.scope,

          cityKey:
            row.cityKey,

          policyVersion:
            row.policyVersion,

          rank,

          eligibleCreatorCount,

          topPercent,

          rankLabel:
            buildPercentileRankLabel({
              rank,
              eligibleCreatorCount,
              topPercent,
            }),
        }
      )
    }
  }

  return rankings
}

function buildUserRankingKey({
  userId,
  categoryId,
  scope,
  cityKey,
  policyVersion,
}: {
  userId: string
  categoryId: string
  scope: OwnerReputationScope
  cityKey: string | null
  policyVersion: number
}): string {
  return [
    userId,
    categoryId,
    scope,
    scope === 'city'
      ? cityKey ??
        ''
      : '__global__',
    policyVersion.toString(),
  ].join(':')
}

function calculateTopPercent({
  rank,
  eligibleCreatorCount,
}: {
  rank: number
  eligibleCreatorCount: number
}): number {
  const normalizedRank =
    Math.max(
      1,
      Math.trunc(
        rank
      )
    )

  const normalizedPopulation =
    Math.max(
      1,
      Math.trunc(
        eligibleCreatorCount
      )
    )

  return roundToPrecision(
    Math.min(
      100,
      (
        normalizedRank /
        normalizedPopulation
      ) *
        100
    ),
    2
  )
}

function buildPercentileRankLabel({
  rank,
  eligibleCreatorCount,
  topPercent,
}: {
  rank: number
  eligibleCreatorCount: number
  topPercent: number
}): string {
  return [
    `Top ${formatPercentile(
      topPercent
    )}%`,

    `#${rank.toLocaleString(
      'en-US'
    )} of ${eligibleCreatorCount.toLocaleString(
      'en-US'
    )}`,
  ].join(' · ')
}

function formatPercentile(
  value: number
): string {
  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        value < 1
          ? 2
          : value < 10
            ? 1
            : 0,
    }
  )
}

/* =========================================================
 * Owner-detail enrichment
 * ======================================================= */

function enrichOwnerReputationDetails({
  userId,
  rows,
  categoriesById,
  populationsByKey,
  rankingsByKey,
}: {
  userId:
    string

  rows:
    NormalizedOwnerReputationRow[]

  categoriesById:
    Map<
      string,
      NormalizedReputationCategory
    >

  populationsByKey:
    Map<
      string,
      NormalizedReputationPopulation
    >

  rankingsByKey:
    Map<
      string,
      NormalizedUserRanking
    >
}): OwnerReputationDetail[] {
  return rows.map(
    (
      row
    ): OwnerReputationDetail => {
      const category =
        categoriesById.get(
          row.categoryId
        )

      const population =
        populationsByKey.get(
          buildPopulationKey({
            categoryId:
              row.categoryId,

            scope:
              row.scope,

            cityKey:
              row.cityKey,

            policyVersion:
              row.policyVersion,
          })
        ) ??
        null

      const ranking =
        rankingsByKey.get(
          buildUserRankingKey({
            userId,

            categoryId:
              row.categoryId,

            scope:
              row.scope,

            cityKey:
              row.cityKey,

            policyVersion:
              row.policyVersion,
          })
        ) ??
        null

      const minimumVerifiedVenueCount =
        category
          ?.minimumVenuesForRanking ??
        null

      const eligibilityCurrent =
        row.verifiedVenueCount

      const meetsVerifiedVenueRequirement =
        minimumVerifiedVenueCount !==
          null &&
        eligibilityCurrent >=
          minimumVerifiedVenueCount

      const meetsWeightedVenueRequirement =
        row.weightedVenueCount >=
        4

      const eligible =
        meetsVerifiedVenueRequirement &&
        meetsWeightedVenueRequirement

      const eligibilityPercent =
        minimumVerifiedVenueCount !==
        null
          ? Math.min(
              100,
              Math.round(
                (
                  eligibilityCurrent /
                  minimumVerifiedVenueCount
                ) *
                  100
              )
            )
          : null

      return {
        categoryId:
          row.categoryId,

        categoryLabel:
          category?.label ??
          formatIdentifier(
            row.categoryId
          ),

        categoryShortLabel:
          category
            ?.shortLabel ??
          formatIdentifier(
            row.categoryId
          ),

        scope:
          row.scope,

        cityKey:
          row.cityKey,

        reputationLevel:
          row.reputationLevel,

        reputationScore:
          row.reputationScore,

        verifiedVenueCount:
          row.verifiedVenueCount,

        weightedVenueCount:
          row.weightedVenueCount,

        publicCollectionCount:
          row.publicCollectionCount,

        curatedVenueCount:
          row.curatedVenueCount,

        publicSnapshotCount:
          row.publicSnapshotCount,

        completedFlowCount:
          row.completedFlowCount,

        cityCount:
          row.cityCount,

        rank:
          ranking
            ?.rank ??
          null,

        eligibleCreatorCount:
          ranking
            ?.eligibleCreatorCount ??
          population
            ?.eligibleUserCount ??
          0,

        topPercent:
          ranking
            ?.topPercent ??
          null,

        rankLabel:
          ranking
            ?.rankLabel ??
          null,

        minimumVerifiedVenueCount,

        eligibilityCurrent,

        eligibilityRequired:
          minimumVerifiedVenueCount,

        eligibilityPercent,

        eligible,

        qualificationLabel:
          buildQualificationLabel({
            row,

            category:
              category ??
              null,

            eligible,

            population,

            ranking,
          }),

        /**
         * Once the user is eligible and a comparison population
         * exists, the owner endpoint may return rank and
         * percentile values regardless of the old population
         * publication flags.
         */
        canPublishRank:
          ranking !==
          null,

        canPublishPercentile:
          ranking !==
          null,

        policyVersion:
          row.policyVersion,

        calculatedAt:
          row.calculatedAt,

        rankingCalculatedAt:
          population
            ?.calculatedAt ??
          row.calculatedAt,
      }
    }
  )
}

function buildQualificationLabel({
  row,
  category,
  eligible,
  population,
  ranking,
}: {
  row:
    NormalizedOwnerReputationRow

  category:
    NormalizedReputationCategory | null

  eligible:
    boolean

  population:
    NormalizedReputationPopulation | null

  ranking:
    NormalizedUserRanking | null
}): string {
  const categoryLabel =
    category
      ?.shortLabel ??
    formatIdentifier(
      row.categoryId
    )

  const scopeLabel =
    row.scope === 'city' &&
    row.cityKey
      ? `${formatIdentifier(
          row.cityKey
        )} ${categoryLabel}`
      : categoryLabel

  if (ranking) {
    return `${ranking.rankLabel} in ${scopeLabel}.`
  }

  if (
    population
      ?.canPublishRank
  ) {
    return `${scopeLabel} ranking is available.`
  }

  if (eligible) {
    const eligibleCreatorCount =
      population
        ?.eligibleUserCount ??
      0

    if (
      eligibleCreatorCount <=
      0
    ) {
      return `${scopeLabel} ranking eligibility earned. A comparison population has not been recorded yet.`
    }

    return `${scopeLabel} ranking eligibility earned. Current comparison data is being refreshed.`
  }

  const required =
    category
      ?.minimumVenuesForRanking ??
    null

  if (required === null) {
    return `Continue recording verified ${scopeLabel} activity to build ranking eligibility.`
  }

  const remaining =
    Math.max(
      0,
      required -
        row.verifiedVenueCount
    )

  if (remaining > 0) {
    return `${row.verifiedVenueCount.toLocaleString(
      'en-US'
    )} verified ${
      row.scope === 'city' &&
      row.cityKey
        ? `${formatIdentifier(
            row.cityKey
          )} `
        : ''
    }${categoryLabel.toLocaleLowerCase(
      'en-US'
    )} ${
      row.verifiedVenueCount ===
      1
        ? 'venue'
        : 'venues'
    } — ${remaining.toLocaleString(
      'en-US'
    )} more to enter ranking eligibility.`
  }

  if (
    row.weightedVenueCount <
    4
  ) {
    return `${scopeLabel} has enough venue breadth, but more canonical category relevance is needed for ranking eligibility.`
  }

  return `Continue recording verified ${scopeLabel} activity to build ranking eligibility.`
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeScope(
  value: unknown
): OwnerReputationScope | null {
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
): OwnerReputationLevel | null {
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
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
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

function normalizePositiveInteger(
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

function normalizePercentage(
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
    Date.parse(
      value
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

function roundToPrecision(
  value: number,
  decimalPlaces: number
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

function formatIdentifier(
  value: string
): string {
  return value
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    )
}

/* =========================================================
 * Error serialization
 * ======================================================= */

function serializeDatabaseError(
  error: unknown
): Record<string, unknown> {
  if (
    isRecord(
      error
    )
  ) {
    return {
      code:
        error.code ??
        null,

      message:
        error.message ??
        null,

      details:
        error.details ??
        null,

      hint:
        error.hint ??
        null,
    }
  }

  return {
    value:
      String(
        error
      ),
  }
}

function serializeUnknownError(
  error: unknown
): Record<string, unknown> {
  if (
    error instanceof Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,

      stack:
        error.stack ??
        null,
    }
  }

  return serializeDatabaseError(
    error
  )
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