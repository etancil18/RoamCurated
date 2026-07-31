import {
  MINIMUM_CATEGORY_REPUTATION_REQUIREMENTS,
  MINIMUM_LEADERBOARD_REQUIREMENTS,
  MINIMUM_RANKING_POPULATION,
  REPUTATION_CATEGORY_POLICY_OVERRIDES,
  canPublishPercentile,
  canPublishRank,
  meetsCategoryReputationRequirements,
  meetsLeaderboardRequirements,
  resolvePercentileClaimBand,
} from './policy'

import {
  isReputationCategoryId,
  isReputationLevel,
  isReputationScope,
  type PublicReputationClaim,
  type ReputationCategoryId,
  type ReputationLevel,
  type ReputationScoreComponents,
  type ReputationScope,
  type UserCategoryReputation,
  type UserReputationRank,
} from './types'

/**
 * Canonical reputation eligibility helpers.
 *
 * This module provides a stable decision boundary for:
 *
 * - earned category reputation
 * - leaderboard participation
 * - ordinal-rank publication
 * - percentile publication
 * - public reputation claims
 *
 * This module intentionally contains:
 *
 * - no React
 * - no Supabase client
 * - no database queries
 * - no scoring formula
 * - no independent thresholds
 * - no public-label construction
 *
 * All canonical qualification thresholds remain owned by
 * policy.ts.
 */

/* =========================================================
 * Eligibility concepts
 * ======================================================= */

export const REPUTATION_ELIGIBILITY_KINDS = [
  'category',
  'leaderboard',
  'rank',
  'percentile',
  'claim',
] as const

export type ReputationEligibilityKind =
  (typeof REPUTATION_ELIGIBILITY_KINDS)[number]

export const REPUTATION_INELIGIBILITY_REASONS = [
  'invalid_category',
  'invalid_scope',
  'invalid_level',
  'missing_city',
  'unexpected_city',
  'insufficient_verified_venues',
  'insufficient_weighted_venues',
  'unranked',
  'missing_ranking',
  'ranking_identity_mismatch',
  'invalid_rank',
  'insufficient_ranking_population',
  'insufficient_percentile_population',
  'leaderboard_ineligible',
  'claim_not_publishable',
] as const

export type ReputationIneligibilityReason =
  (typeof REPUTATION_INELIGIBILITY_REASONS)[number]

/* =========================================================
 * Decision contracts
 * ======================================================= */

export type ReputationEligibilityDecision = {
  eligible: boolean

  kind: ReputationEligibilityKind

  reasons: ReputationIneligibilityReason[]

  requirements: ReputationEligibilityRequirements

  actual: ReputationEligibilityActual

  /**
   * Useful for diagnostics, audit logs, and tests.
   *
   * This message is not intended to be shown directly to users.
   */
  diagnostic: string
}

export type ReputationEligibilityRequirements = {
  minimumVerifiedVenueCount: number | null
  minimumWeightedVenueCount: number | null
  minimumEligibleUserCount: number | null
}

export type ReputationEligibilityActual = {
  categoryId: ReputationCategoryId | null
  scope: ReputationScope | null
  cityKey: string | null
  level: ReputationLevel | null

  verifiedVenueCount: number
  weightedVenueCount: number

  rank: number | null
  eligibleUserCount: number
}

/* =========================================================
 * Input contracts
 * ======================================================= */

export type ReputationComponentEligibilityInput = {
  categoryId: ReputationCategoryId | string
  scope: ReputationScope | string
  cityKey?: string | null
  components: ReputationScoreComponents
}

export type ReputationRankingEligibilityInput = {
  reputation: UserCategoryReputation
  ranking: UserReputationRank | null
}

/* =========================================================
 * Category eligibility
 * ======================================================= */

/**
 * Determines whether a category has enough qualifying evidence
 * to appear as earned reputation.
 */
export function getCategoryReputationEligibility({
  categoryId,
  scope,
  cityKey = null,
  components,
}: ReputationComponentEligibilityInput): ReputationEligibilityDecision {
  const normalizedCategoryId =
    normalizeCategoryId(
      categoryId
    )

  const normalizedScope =
    normalizeScope(
      scope
    )

  const normalizedCityKey =
    normalizeNullableText(
      cityKey
    )

  const normalizedComponents =
    normalizeScoreComponents(
      components
    )

  const reasons:
    ReputationIneligibilityReason[] = []

  if (
    !normalizedCategoryId
  ) {
    reasons.push(
      'invalid_category'
    )
  }

  if (
    !normalizedScope
  ) {
    reasons.push(
      'invalid_scope'
    )
  }

  appendScopeCityReasons({
    scope:
      normalizedScope,

    cityKey:
      normalizedCityKey,

    reasons,
  })

  const requirements =
    normalizedCategoryId &&
    normalizedScope
      ? resolveComponentRequirements({
          kind:
            'category',

          categoryId:
            normalizedCategoryId,

          scope:
            normalizedScope,
        })
      : createEmptyRequirements()

  if (
    requirements
      .minimumVerifiedVenueCount !==
      null &&
    normalizedComponents
      .verifiedVenueCount <
      requirements
        .minimumVerifiedVenueCount
  ) {
    reasons.push(
      'insufficient_verified_venues'
    )
  }

  if (
    requirements
      .minimumWeightedVenueCount !==
      null &&
    normalizedComponents
      .weightedVenueCount <
      requirements
        .minimumWeightedVenueCount
  ) {
    reasons.push(
      'insufficient_weighted_venues'
    )
  }

  const policyEligible =
    Boolean(
      normalizedCategoryId &&
      normalizedScope
    ) &&
    reasons.length ===
      0 &&
    meetsCategoryReputationRequirements({
      categoryId:
        normalizedCategoryId as ReputationCategoryId,

      scope:
        normalizedScope as ReputationScope,

      components:
        normalizedComponents,
    })

  return buildDecision({
    kind:
      'category',

    eligible:
      policyEligible,

    reasons,

    requirements,

    actual: {
      categoryId:
        normalizedCategoryId,

      scope:
        normalizedScope,

      cityKey:
        normalizedScope ===
        'city'
          ? normalizedCityKey
          : null,

      level:
        null,

      verifiedVenueCount:
        normalizedComponents
          .verifiedVenueCount,

      weightedVenueCount:
        normalizedComponents
          .weightedVenueCount,

      rank:
        null,

      eligibleUserCount:
        0,
    },
  })
}

/**
 * Boolean convenience wrapper.
 */
export function isEligibleForReputation(
  input:
    ReputationComponentEligibilityInput
): boolean {
  return getCategoryReputationEligibility(
    input
  ).eligible
}

/* =========================================================
 * Leaderboard eligibility
 * ======================================================= */

/**
 * Determines whether a category aggregate may participate in a
 * public leaderboard population.
 */
export function getLeaderboardEligibility({
  categoryId,
  scope,
  cityKey = null,
  components,
}: ReputationComponentEligibilityInput): ReputationEligibilityDecision {
  const normalizedCategoryId =
    normalizeCategoryId(
      categoryId
    )

  const normalizedScope =
    normalizeScope(
      scope
    )

  const normalizedCityKey =
    normalizeNullableText(
      cityKey
    )

  const normalizedComponents =
    normalizeScoreComponents(
      components
    )

  const reasons:
    ReputationIneligibilityReason[] = []

  if (
    !normalizedCategoryId
  ) {
    reasons.push(
      'invalid_category'
    )
  }

  if (
    !normalizedScope
  ) {
    reasons.push(
      'invalid_scope'
    )
  }

  appendScopeCityReasons({
    scope:
      normalizedScope,

    cityKey:
      normalizedCityKey,

    reasons,
  })

  const requirements =
    normalizedCategoryId &&
    normalizedScope
      ? resolveComponentRequirements({
          kind:
            'leaderboard',

          categoryId:
            normalizedCategoryId,

          scope:
            normalizedScope,
        })
      : createEmptyRequirements()

  if (
    requirements
      .minimumVerifiedVenueCount !==
      null &&
    normalizedComponents
      .verifiedVenueCount <
      requirements
        .minimumVerifiedVenueCount
  ) {
    reasons.push(
      'insufficient_verified_venues'
    )
  }

  if (
    requirements
      .minimumWeightedVenueCount !==
      null &&
    normalizedComponents
      .weightedVenueCount <
      requirements
        .minimumWeightedVenueCount
  ) {
    reasons.push(
      'insufficient_weighted_venues'
    )
  }

  const policyEligible =
    Boolean(
      normalizedCategoryId &&
      normalizedScope
    ) &&
    reasons.length ===
      0 &&
    meetsLeaderboardRequirements({
      categoryId:
        normalizedCategoryId as ReputationCategoryId,

      scope:
        normalizedScope as ReputationScope,

      components:
        normalizedComponents,
    })

  if (
    !policyEligible &&
    reasons.length ===
      0
  ) {
    reasons.push(
      'leaderboard_ineligible'
    )
  }

  return buildDecision({
    kind:
      'leaderboard',

    eligible:
      policyEligible,

    reasons,

    requirements,

    actual: {
      categoryId:
        normalizedCategoryId,

      scope:
        normalizedScope,

      cityKey:
        normalizedScope ===
        'city'
          ? normalizedCityKey
          : null,

      level:
        null,

      verifiedVenueCount:
        normalizedComponents
          .verifiedVenueCount,

      weightedVenueCount:
        normalizedComponents
          .weightedVenueCount,

      rank:
        null,

      eligibleUserCount:
        0,
    },
  })
}

export function isEligibleForLeaderboard(
  input:
    ReputationComponentEligibilityInput
): boolean {
  return getLeaderboardEligibility(
    input
  ).eligible
}

/* =========================================================
 * Rank eligibility
 * ======================================================= */

/**
 * Determines whether a persisted ordinal rank may be published.
 */
export function getRankPublicationEligibility({
  reputation,
  ranking,
}: ReputationRankingEligibilityInput): ReputationEligibilityDecision {
  const base =
    normalizeRankingInput({
      reputation,
      ranking,
    })

  const reasons = [
    ...base.reasons,
  ]

  if (
    base.level ===
    'unranked'
  ) {
    reasons.push(
      'unranked'
    )
  }

  const leaderboardDecision =
    getLeaderboardEligibility({
      categoryId:
        reputation.categoryId,

      scope:
        reputation.scope,

      cityKey:
        reputation.cityKey,

      components:
        reputation.components,
    })

  if (
    !leaderboardDecision
      .eligible
  ) {
    reasons.push(
      'leaderboard_ineligible'
    )
  }

  if (
    ranking &&
    !canPublishRank({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })
  ) {
    if (
      normalizePositiveInteger(
        ranking.rank
      ) ===
      null
    ) {
      reasons.push(
        'invalid_rank'
      )
    }

    if (
      normalizeCount(
        ranking
          .eligibleUserCount
      ) <
      MINIMUM_RANKING_POPULATION
        .rank
    ) {
      reasons.push(
        'insufficient_ranking_population'
      )
    }
  }

  const eligible =
    reasons.length ===
      0 &&
    ranking !==
      null &&
    canPublishRank({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })

  return buildDecision({
    kind:
      'rank',

    eligible,

    reasons,

    requirements: {
      minimumVerifiedVenueCount:
        leaderboardDecision
          .requirements
          .minimumVerifiedVenueCount,

      minimumWeightedVenueCount:
        leaderboardDecision
          .requirements
          .minimumWeightedVenueCount,

      minimumEligibleUserCount:
        MINIMUM_RANKING_POPULATION
          .rank,
    },

    actual: {
      categoryId:
        base.categoryId,

      scope:
        base.scope,

      cityKey:
        base.cityKey,

      level:
        base.level,

      verifiedVenueCount:
        base.verifiedVenueCount,

      weightedVenueCount:
        base.weightedVenueCount,

      rank:
        base.rank,

      eligibleUserCount:
        base.eligibleUserCount,
    },
  })
}

export function isEligibleForPublishedRank(
  input:
    ReputationRankingEligibilityInput
): boolean {
  return getRankPublicationEligibility(
    input
  ).eligible
}

/* =========================================================
 * Percentile eligibility
 * ======================================================= */

/**
 * Determines whether percentile-based reputation status may be
 * published.
 */
export function getPercentilePublicationEligibility({
  reputation,
  ranking,
}: ReputationRankingEligibilityInput): ReputationEligibilityDecision {
  const rankDecision =
    getRankPublicationEligibility({
      reputation,
      ranking,
    })

  const reasons = [
    ...rankDecision.reasons,
  ]

  if (
    ranking &&
    !canPublishPercentile({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })
  ) {
    if (
      normalizeCount(
        ranking
          .eligibleUserCount
      ) <
      MINIMUM_RANKING_POPULATION
        .percentile
    ) {
      reasons.push(
        'insufficient_percentile_population'
      )
    }
  }

  const eligible =
    reasons.length ===
      0 &&
    ranking !==
      null &&
    canPublishPercentile({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })

  return buildDecision({
    kind:
      'percentile',

    eligible,

    reasons,

    requirements: {
      ...rankDecision.requirements,

      minimumEligibleUserCount:
        MINIMUM_RANKING_POPULATION
          .percentile,
    },

    actual:
      rankDecision.actual,
  })
}

export function isEligibleForPublishedPercentile(
  input:
    ReputationRankingEligibilityInput
): boolean {
  return getPercentilePublicationEligibility(
    input
  ).eligible
}

/* =========================================================
 * Public-claim eligibility
 * ======================================================= */

/**
 * Determines whether any public rank-based reputation claim may
 * be generated for this category aggregate.
 *
 * A claim may use either:
 *
 * - an ordinal rank label
 * - a percentile band label
 *
 * Percentile bands remain subject to the stricter population
 * requirements owned by policy.ts.
 */
export function getPublicClaimEligibility({
  reputation,
  ranking,
}: ReputationRankingEligibilityInput): ReputationEligibilityDecision {
  const rankDecision =
    getRankPublicationEligibility({
      reputation,
      ranking,
    })

  const reasons = [
    ...rankDecision.reasons,
  ]

  const percentileBand =
    ranking
      ? resolvePercentileClaimBand({
          rank:
            ranking.rank,

          eligibleUserCount:
            ranking
              .eligibleUserCount,
        })
      : null

  /**
   * A percentile band is optional. A valid ordinal rank may
   * still produce a public claim when the population is large
   * enough for ranks but not percentile labels.
   */
  const eligible =
    rankDecision.eligible

  if (
    !eligible &&
    !reasons.includes(
      'claim_not_publishable'
    )
  ) {
    reasons.push(
      'claim_not_publishable'
    )
  }

  return buildDecision({
    kind:
      'claim',

    eligible,

    reasons,

    requirements:
      rankDecision.requirements,

    actual:
      rankDecision.actual,

    diagnosticSuffix:
      percentileBand
        ? ` Percentile band: ${percentileBand.label}.`
        : '',
  })
}

export function isEligibleForPublicReputationClaim(
  input:
    ReputationRankingEligibilityInput
): boolean {
  return getPublicClaimEligibility(
    input
  ).eligible
}

/* =========================================================
 * Existing-claim validation
 * ======================================================= */

/**
 * Performs structural validation on an already-built public
 * claim.
 *
 * This does not replace policy-based claim eligibility. It is a
 * final fail-safe for API and UI boundaries.
 */
export function isValidPublicReputationClaim(
  value:
    unknown
): value is PublicReputationClaim {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const claim =
    value as Partial<
      PublicReputationClaim
    >

  if (
    !isReputationCategoryId(
      claim.categoryId
    ) ||
    !isReputationScope(
      claim.scope
    ) ||
    !isReputationLevel(
      claim.level
    )
  ) {
    return false
  }

  const label =
    normalizeNullableText(
      claim.label
    )

  if (
    !label
  ) {
    return false
  }

  if (
    claim.scope ===
      'global' &&
    claim.cityKey !==
      null
  ) {
    return false
  }

  if (
    claim.scope ===
      'city' &&
    !normalizeNullableText(
      claim.cityKey
    )
  ) {
    return false
  }

  const rank =
    claim.rank ===
      null
      ? null
      : normalizePositiveInteger(
          claim.rank
        )

  const percentile =
    claim.percentile ===
      null
      ? null
      : normalizePercent(
          claim.percentile
        )

  if (
    rank ===
      null &&
    percentile ===
      null
  ) {
    return false
  }

  return (
    normalizeCount(
      claim.eligibleUserCount
    ) >
      0 &&
    normalizeCount(
      claim.verifiedVenueCount
    ) >
      0
  )
}

/* =========================================================
 * Requirement resolution
 * ======================================================= */

function resolveComponentRequirements({
  kind,
  categoryId,
  scope,
}: {
  kind:
    'category' | 'leaderboard'

  categoryId:
    ReputationCategoryId

  scope:
    ReputationScope
}): ReputationEligibilityRequirements {
  const override =
    REPUTATION_CATEGORY_POLICY_OVERRIDES[
      categoryId
    ]

  if (
    kind ===
    'leaderboard'
  ) {
    const base =
      MINIMUM_LEADERBOARD_REQUIREMENTS[
        scope
      ]

    return {
      minimumVerifiedVenueCount:
        override
          ?.minimumLeaderboardVerifiedVenues ??
        base.verifiedVenueCount,

      minimumWeightedVenueCount:
        base.weightedVenueCount,

      minimumEligibleUserCount:
        null,
    }
  }

  const base =
    MINIMUM_CATEGORY_REPUTATION_REQUIREMENTS[
      scope
    ]

  return {
    minimumVerifiedVenueCount:
      override
        ?.minimumCategoryVerifiedVenues ??
      base.verifiedVenueCount,

    minimumWeightedVenueCount:
      base.weightedVenueCount,

    minimumEligibleUserCount:
      null,
  }
}

/* =========================================================
 * Ranking normalization
 * ======================================================= */

function normalizeRankingInput({
  reputation,
  ranking,
}: ReputationRankingEligibilityInput): {
  categoryId:
    ReputationCategoryId | null

  scope:
    ReputationScope | null

  cityKey:
    string | null

  level:
    ReputationLevel | null

  verifiedVenueCount:
    number

  weightedVenueCount:
    number

  rank:
    number | null

  eligibleUserCount:
    number

  reasons:
    ReputationIneligibilityReason[]
} {
  const reasons:
    ReputationIneligibilityReason[] = []

  const categoryId =
    normalizeCategoryId(
      reputation
        .categoryId
    )

  const scope =
    normalizeScope(
      reputation.scope
    )

  const cityKey =
    normalizeNullableText(
      reputation.cityKey
    )

  const level =
    isReputationLevel(
      reputation.level
    )
      ? reputation.level
      : null

  if (
    !categoryId
  ) {
    reasons.push(
      'invalid_category'
    )
  }

  if (
    !scope
  ) {
    reasons.push(
      'invalid_scope'
    )
  }

  if (
    !level
  ) {
    reasons.push(
      'invalid_level'
    )
  }

  appendScopeCityReasons({
    scope,
    cityKey,
    reasons,
  })

  if (
    !ranking
  ) {
    reasons.push(
      'missing_ranking'
    )
  } else if (
    ranking.userId !==
      reputation.userId ||
    ranking.categoryId !==
      reputation.categoryId ||
    ranking.scope !==
      reputation.scope ||
    normalizeNullableText(
      ranking.cityKey
    ) !==
      cityKey
  ) {
    reasons.push(
      'ranking_identity_mismatch'
    )
  }

  return {
    categoryId,

    scope,

    cityKey:
      scope ===
      'city'
        ? cityKey
        : null,

    level,

    verifiedVenueCount:
      normalizeCount(
        reputation
          .components
          .verifiedVenueCount
      ),

    weightedVenueCount:
      normalizeNonNegativeNumber(
        reputation
          .components
          .weightedVenueCount
      ),

    rank:
      ranking
        ? normalizePositiveInteger(
            ranking.rank
          )
        : null,

    eligibleUserCount:
      ranking
        ? normalizeCount(
            ranking
              .eligibleUserCount
          )
        : 0,

    reasons,
  }
}

/* =========================================================
 * Scope validation
 * ======================================================= */

function appendScopeCityReasons({
  scope,
  cityKey,
  reasons,
}: {
  scope:
    ReputationScope | null

  cityKey:
    string | null

  reasons:
    ReputationIneligibilityReason[]
}): void {
  if (
    scope ===
      'city' &&
    !cityKey
  ) {
    reasons.push(
      'missing_city'
    )
  }

  if (
    scope ===
      'global' &&
    cityKey
  ) {
    reasons.push(
      'unexpected_city'
    )
  }
}

/* =========================================================
 * Decision construction
 * ======================================================= */

function buildDecision({
  kind,
  eligible,
  reasons,
  requirements,
  actual,
  diagnosticSuffix = '',
}: {
  kind:
    ReputationEligibilityKind

  eligible:
    boolean

  reasons:
    ReputationIneligibilityReason[]

  requirements:
    ReputationEligibilityRequirements

  actual:
    ReputationEligibilityActual

  diagnosticSuffix?:
    string
}): ReputationEligibilityDecision {
  const uniqueReasons =
    [
      ...new Set(
        reasons
      ),
    ]

  const normalizedEligible =
    eligible &&
    uniqueReasons.length ===
      0

  return {
    eligible:
      normalizedEligible,

    kind,

    reasons:
      uniqueReasons,

    requirements,

    actual,

    diagnostic:
      normalizedEligible
        ? `Eligible for reputation ${kind}.${diagnosticSuffix}`
        : `Not eligible for reputation ${kind}: ${
            uniqueReasons.length >
            0
              ? uniqueReasons.join(
                  ', '
                )
              : 'policy requirements were not satisfied'
          }.${diagnosticSuffix}`,
  }
}

function createEmptyRequirements():
  ReputationEligibilityRequirements {
  return {
    minimumVerifiedVenueCount:
      null,

    minimumWeightedVenueCount:
      null,

    minimumEligibleUserCount:
      null,
  }
}

/* =========================================================
 * Normalization helpers
 * ======================================================= */

function normalizeCategoryId(
  value:
    unknown
): ReputationCategoryId | null {
  return isReputationCategoryId(
    value
  )
    ? value
    : null
}

function normalizeScope(
  value:
    unknown
): ReputationScope | null {
  return isReputationScope(
    value
  )
    ? value
    : null
}

function normalizeScoreComponents(
  components:
    ReputationScoreComponents
): ReputationScoreComponents {
  return {
    verifiedVenueCount:
      normalizeCount(
        components
          .verifiedVenueCount
      ),

    weightedVenueCount:
      normalizeNonNegativeNumber(
        components
          .weightedVenueCount
      ),

    cityCount:
      normalizeCount(
        components
          .cityCount
      ),

    publicCollectionCount:
      normalizeCount(
        components
          .publicCollectionCount
      ),

    curatedVenueCount:
      normalizeCount(
        components
          .curatedVenueCount
      ),

    publicSnapshotCount:
      normalizeCount(
        components
          .publicSnapshotCount
      ),

    completedFlowCount:
      normalizeCount(
        components
          .completedFlowCount
      ),

    recencyScore:
      normalizeNonNegativeNumber(
        components
          .recencyScore
      ),

    qualityScore:
      normalizeNonNegativeNumber(
        components
          .qualityScore
      ),
  }
}

function normalizeCount(
  value:
    unknown
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value <=
      0
  ) {
    return 0
  }

  return Math.floor(
    value
  )
}

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const normalized =
    normalizeCount(
      value
    )

  return normalized >
    0
    ? normalized
    : null
}

function normalizeNonNegativeNumber(
  value:
    unknown
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value <=
      0
  ) {
    return 0
  }

  return value
}

function normalizePercent(
  value:
    unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < 0 ||
    value > 100
  ) {
    return null
  }

  return value
}

function normalizeNullableText(
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
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized ||
    null
}