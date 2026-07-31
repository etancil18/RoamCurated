import type {
  PublicReputationClaim,
  ReputationCategoryId,
  ReputationLevel,
  ReputationLevelDefinition,
  ReputationPercentile,
  ReputationScoreComponents,
  ReputationScope,
  UserCategoryReputation,
  UserReputationRank,
} from './types'

/**
 * Canonical Roam reputation policy.
 *
 * This file intentionally contains:
 *
 * - no React
 * - no Supabase client
 * - no database queries
 * - no user-specific state
 * - no mutable runtime configuration
 *
 * This module owns:
 *
 * - score weights
 * - evidence requirements
 * - level thresholds
 * - ranking eligibility
 * - percentile claim thresholds
 * - public-claim suppression rules
 *
 * It does not own:
 *
 * - raw evidence loading
 * - database persistence
 * - ranking queries
 * - public-profile rendering
 * - venue taxonomy mapping
 */

/* =========================================================
 * Policy version
 * ======================================================= */

/**
 * Increment this value whenever a scoring or qualification rule
 * changes in a way that requires persisted reputation data to be
 * rebuilt.
 */
export const REPUTATION_POLICY_VERSION =
  2 as const

/* =========================================================
 * Score weights
 * ======================================================= */

/**
 * Score weights are intentionally conservative.
 *
 * Verified venue breadth is the foundation of reputation.
 * Public curation and completed activity strengthen the signal
 * but must not overpower real-world exploration.
 *
 * Recency and quality are reserved for later versions and remain
 * disabled in V1.
 */
export const REPUTATION_SCORE_WEIGHTS = {
  verifiedVenue:
    10,

  weightedVenue:
    5,

  publicCollection:
    18,

  curatedVenue:
    4,

  publicSnapshot:
    12,

  completedFlow:
    8,

  recency:
    0,

  quality:
    0,
} as const

export type ReputationScoreWeightKey =
  keyof typeof REPUTATION_SCORE_WEIGHTS

/* =========================================================
 * Component caps
 * ======================================================= */

/**
 * Caps prevent a single activity type from dominating forever.
 *
 * The score still increases as users explore and curate, but
 * marginal value declines once a component reaches its cap.
 */
export const REPUTATION_SCORE_COMPONENT_CAPS = {
  verifiedVenueCount:
    250,

  weightedVenueCount:
    250,

  /**
   * Geographic breadth is currently informational and does not
   * contribute to the V1 score, but it remains part of the
   * canonical score-component contract.
   */
  cityCount:
    25,

  publicCollectionCount:
    50,

  curatedVenueCount:
    250,

  publicSnapshotCount:
    100,

  completedFlowCount:
    100,

  recencyScore:
    100,

  qualityScore:
    100,
} as const satisfies Record<
  keyof ReputationScoreComponents,
  number
>

/* =========================================================
 * Qualification requirements
 * ======================================================= */

/**
 * Minimum evidence needed before a category can appear as an
 * earned public reputation category.
 *
 * A user may have internal score data below these thresholds,
 * but the platform must not present that data as public status.
 */
export const MINIMUM_CATEGORY_REPUTATION_REQUIREMENTS = {
  global: {
    verifiedVenueCount:
      3,

    weightedVenueCount:
      2.5,
  },

  city: {
    verifiedVenueCount:
      3,

    weightedVenueCount:
      2.5,
  },
} as const satisfies Record<
  ReputationScope,
  {
    verifiedVenueCount: number
    weightedVenueCount: number
  }
>

/**
 * Minimum evidence needed before a user may appear in a public
 * category leaderboard.
 *
 * This is intentionally stricter than simply appearing with a
 * category on a profile.
 */
export const MINIMUM_LEADERBOARD_REQUIREMENTS = {
  global: {
    verifiedVenueCount:
      5,

    weightedVenueCount:
      4,
  },

  city: {
    verifiedVenueCount:
      5,

    weightedVenueCount:
      4,
  },
} as const satisfies Record<
  ReputationScope,
  {
    verifiedVenueCount: number
    weightedVenueCount: number
  }
>

/**
 * Minimum comparison-population sizes required before Roam may
 * publish ranks or percentile values.
 *
 * Rank and exact percentile position are available whenever at
 * least one eligible creator exists.
 *
 * Branded percentile claims such as Top 10%, Top 5%, and Top 1%
 * retain larger population requirements because those labels
 * imply a more meaningful comparison population.
 */
export const MINIMUM_RANKING_POPULATION = {
  rank:
    1,

  percentile:
    1,

  topTenPercent:
    50,

  topFivePercent:
    75,

  topOnePercent:
    100,
} as const

/* =========================================================
 * Reputation levels
 * ======================================================= */

/**
 * Level definitions are public identity milestones.
 *
 * They are not percentile claims and do not depend on other
 * users.
 */
export const REPUTATION_LEVEL_DEFINITIONS = {
  unranked: {
    id:
      'unranked',

    label:
      'Unranked',

    shortLabel:
      'Unranked',

    description:
      'Not enough qualifying reputation evidence has been recorded yet.',

    sortOrder:
      0,
  },

  emerging: {
    id:
      'emerging',

    label:
      'Emerging Explorer',

    shortLabel:
      'Emerging',

    description:
      'Building a verified exploration footprint in this category.',

    sortOrder:
      1,
  },

  established: {
    id:
      'established',

    label:
      'Established Explorer',

    shortLabel:
      'Established',

    description:
      'Has developed a meaningful verified footprint in this category.',

    sortOrder:
      2,
  },

  expert: {
    id:
      'expert',

    label:
      'Category Expert',

    shortLabel:
      'Expert',

    description:
      'Has demonstrated substantial verified experience and curation in this category.',

    sortOrder:
      3,
  },

  elite: {
    id:
      'elite',

    label:
      'Elite Explorer',

    shortLabel:
      'Elite',

    description:
      'Has built an exceptional verified reputation in this category.',

    sortOrder:
      4,
  },
} as const satisfies Record<
  ReputationLevel,
  ReputationLevelDefinition
>

/**
 * Minimum score required for each earned level.
 *
 * `unranked` is assigned when public category qualification
 * requirements are not satisfied.
 */
export const REPUTATION_LEVEL_SCORE_THRESHOLDS = {
  emerging:
    30,

  established:
    100,

  expert:
    250,

  elite:
    500,
} as const satisfies Record<
  Exclude<
    ReputationLevel,
    'unranked'
  >,
  number
>

/**
 * Minimum verified venue breadth required for each level.
 *
 * Score alone is insufficient. This prevents users from earning
 * expertise through curation or flow activity without enough
 * real-world venue evidence.
 */
export const REPUTATION_LEVEL_VENUE_REQUIREMENTS = {
  emerging:
    3,

  established:
    8,

  expert:
    20,

  elite:
    50,
} as const satisfies Record<
  Exclude<
    ReputationLevel,
    'unranked'
  >,
  number
>

/* =========================================================
 * Percentile claim bands
 * ======================================================= */

export const REPUTATION_PERCENTILE_CLAIM_BANDS = [
  {
    maximumPercentileRank:
      1,

    label:
      'Top 1%',

    minimumPopulation:
      MINIMUM_RANKING_POPULATION
        .topOnePercent,
  },

  {
    maximumPercentileRank:
      5,

    label:
      'Top 5%',

    minimumPopulation:
      MINIMUM_RANKING_POPULATION
        .topFivePercent,
  },

  {
    maximumPercentileRank:
      10,

    label:
      'Top 10%',

    minimumPopulation:
      MINIMUM_RANKING_POPULATION
        .topTenPercent,
  },

  {
    maximumPercentileRank:
      25,

    label:
      'Top 25%',

    minimumPopulation:
      MINIMUM_RANKING_POPULATION
        .percentile,
  },
] as const

export type ReputationPercentileClaimBand =
  (typeof REPUTATION_PERCENTILE_CLAIM_BANDS)[number]

/* =========================================================
 * Category-specific policy
 * ======================================================= */

export type ReputationCategoryPolicyOverride = {
  minimumCategoryVerifiedVenues?: number
  minimumLeaderboardVerifiedVenues?: number
  minimumExpertVerifiedVenues?: number
  minimumEliteVerifiedVenues?: number
}

/**
 * Most categories use the global defaults.
 *
 * Sparse or broad categories may receive stricter requirements
 * later without changing the public category identifiers.
 */
export const REPUTATION_CATEGORY_POLICY_OVERRIDES:
  Partial<
    Record<
      ReputationCategoryId,
      ReputationCategoryPolicyOverride
    >
  > = {
  restaurants: {
    minimumExpertVerifiedVenues:
      25,

    minimumEliteVerifiedVenues:
      60,
  },

  outdoors: {
    minimumCategoryVerifiedVenues:
      4,

    minimumLeaderboardVerifiedVenues:
      6,
  },

  markets_shopping: {
    minimumCategoryVerifiedVenues:
      4,

    minimumLeaderboardVerifiedVenues:
      6,
  },
}

/* =========================================================
 * Score calculation
 * ======================================================= */

/**
 * Calculates the canonical category reputation score.
 *
 * Every input is normalized and capped before weighting.
 *
 * The function is deterministic and has no external state.
 */
export function calculateReputationScore(
  components:
    ReputationScoreComponents
): number {
  const verifiedVenueCount =
    normalizeCappedNumber({
      value:
        components
          .verifiedVenueCount,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .verifiedVenueCount,
    })

  const weightedVenueCount =
    normalizeCappedNumber({
      value:
        components
          .weightedVenueCount,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .weightedVenueCount,
    })

  const publicCollectionCount =
    normalizeCappedNumber({
      value:
        components
          .publicCollectionCount,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .publicCollectionCount,
    })

  const curatedVenueCount =
    normalizeCappedNumber({
      value:
        components
          .curatedVenueCount,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .curatedVenueCount,
    })

  const publicSnapshotCount =
    normalizeCappedNumber({
      value:
        components
          .publicSnapshotCount,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .publicSnapshotCount,
    })

  const completedFlowCount =
    normalizeCappedNumber({
      value:
        components
          .completedFlowCount,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .completedFlowCount,
    })

  const recencyScore =
    normalizeCappedNumber({
      value:
        components
          .recencyScore,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .recencyScore,
    })

  const qualityScore =
    normalizeCappedNumber({
      value:
        components
          .qualityScore,

      cap:
        REPUTATION_SCORE_COMPONENT_CAPS
          .qualityScore,
    })

  const rawScore =
    verifiedVenueCount *
      REPUTATION_SCORE_WEIGHTS
        .verifiedVenue +
    weightedVenueCount *
      REPUTATION_SCORE_WEIGHTS
        .weightedVenue +
    publicCollectionCount *
      REPUTATION_SCORE_WEIGHTS
        .publicCollection +
    curatedVenueCount *
      REPUTATION_SCORE_WEIGHTS
        .curatedVenue +
    publicSnapshotCount *
      REPUTATION_SCORE_WEIGHTS
        .publicSnapshot +
    completedFlowCount *
      REPUTATION_SCORE_WEIGHTS
        .completedFlow +
    recencyScore *
      REPUTATION_SCORE_WEIGHTS
        .recency +
    qualityScore *
      REPUTATION_SCORE_WEIGHTS
        .quality

  return normalizeScore(
    rawScore
  )
}

/* =========================================================
 * Category qualification
 * ======================================================= */

export function meetsCategoryReputationRequirements({
  categoryId,
  scope,
  components,
}: {
  categoryId:
    ReputationCategoryId

  scope:
    ReputationScope

  components:
    ReputationScoreComponents
}): boolean {
  const baseRequirements =
    MINIMUM_CATEGORY_REPUTATION_REQUIREMENTS[
      scope
    ]

  const override =
    REPUTATION_CATEGORY_POLICY_OVERRIDES[
      categoryId
    ]

  const minimumVerifiedVenues =
    override
      ?.minimumCategoryVerifiedVenues ??
    baseRequirements
      .verifiedVenueCount

  return (
    normalizeCount(
      components
        .verifiedVenueCount
    ) >=
      minimumVerifiedVenues &&
    normalizeNonNegativeNumber(
      components
        .weightedVenueCount
    ) >=
      baseRequirements
        .weightedVenueCount
  )
}

export function meetsLeaderboardRequirements({
  categoryId,
  scope,
  components,
}: {
  categoryId:
    ReputationCategoryId

  scope:
    ReputationScope

  components:
    ReputationScoreComponents
}): boolean {
  const baseRequirements =
    MINIMUM_LEADERBOARD_REQUIREMENTS[
      scope
    ]

  const override =
    REPUTATION_CATEGORY_POLICY_OVERRIDES[
      categoryId
    ]

  const minimumVerifiedVenues =
    override
      ?.minimumLeaderboardVerifiedVenues ??
    baseRequirements
      .verifiedVenueCount

  return (
    normalizeCount(
      components
        .verifiedVenueCount
    ) >=
      minimumVerifiedVenues &&
    normalizeNonNegativeNumber(
      components
        .weightedVenueCount
    ) >=
      baseRequirements
        .weightedVenueCount
  )
}

/* =========================================================
 * Level resolution
 * ======================================================= */

export function resolveReputationLevel({
  categoryId,
  scope,
  score,
  components,
}: {
  categoryId:
    ReputationCategoryId

  scope:
    ReputationScope

  score:
    number

  components:
    ReputationScoreComponents
}): ReputationLevel {
  if (
    !meetsCategoryReputationRequirements({
      categoryId,
      scope,
      components,
    })
  ) {
    return 'unranked'
  }

  const normalizedScore =
    normalizeScore(
      score
    )

  const verifiedVenueCount =
    normalizeCount(
      components
        .verifiedVenueCount
    )

  const override =
    REPUTATION_CATEGORY_POLICY_OVERRIDES[
      categoryId
    ]

  const eliteVenueRequirement =
    override
      ?.minimumEliteVerifiedVenues ??
    REPUTATION_LEVEL_VENUE_REQUIREMENTS
      .elite

  if (
    normalizedScore >=
      REPUTATION_LEVEL_SCORE_THRESHOLDS
        .elite &&
    verifiedVenueCount >=
      eliteVenueRequirement
  ) {
    return 'elite'
  }

  const expertVenueRequirement =
    override
      ?.minimumExpertVerifiedVenues ??
    REPUTATION_LEVEL_VENUE_REQUIREMENTS
      .expert

  if (
    normalizedScore >=
      REPUTATION_LEVEL_SCORE_THRESHOLDS
        .expert &&
    verifiedVenueCount >=
      expertVenueRequirement
  ) {
    return 'expert'
  }

  if (
    normalizedScore >=
      REPUTATION_LEVEL_SCORE_THRESHOLDS
        .established &&
    verifiedVenueCount >=
      REPUTATION_LEVEL_VENUE_REQUIREMENTS
        .established
  ) {
    return 'established'
  }

  return 'emerging'
}

export function buildUserCategoryReputation({
  userId,
  categoryId,
  scope,
  cityKey,
  components,
  latestEvidenceAt,
  calculatedAt =
    new Date().toISOString(),
}: {
  userId:
    string

  categoryId:
    ReputationCategoryId

  scope:
    ReputationScope

  cityKey:
    string | null

  components:
    ReputationScoreComponents

  latestEvidenceAt:
    string | null

  calculatedAt?:
    string
}): UserCategoryReputation {
  const score =
    calculateReputationScore(
      components
    )

  const level =
    resolveReputationLevel({
      categoryId,
      scope,
      score,
      components,
    })

  return {
    userId:
      normalizeRequiredText(
        userId
      ),

    categoryId,

    scope,

    cityKey:
      scope ===
      'global'
        ? null
        : normalizeNullableText(
            cityKey
          ),

    score,

    level,

    components:
      normalizeReputationScoreComponents(
        components
      ),

    latestEvidenceAt:
      normalizeNullableText(
        latestEvidenceAt
      ),

    calculatedAt:
      normalizeTimestamp(
        calculatedAt
      ),
  }
}

/* =========================================================
 * Ranking math
 * ======================================================= */

/**
 * Converts a one-based rank into the percentage of the
 * population occupied by that rank.
 *
 * Examples:
 *
 * - rank 1 of 100 -> 1
 * - rank 5 of 100 -> 5
 * - rank 18 of 200 -> 9
 *
 * Lower values are better.
 */
export function calculatePercentileRank({
  rank,
  eligibleUserCount,
}: {
  rank:
    number

  eligibleUserCount:
    number
}): ReputationPercentile {
  const normalizedPopulation =
    normalizeCount(
      eligibleUserCount
    )

  if (
    normalizedPopulation <=
    0
  ) {
    return 100
  }

  const normalizedRank =
    Math.min(
      normalizedPopulation,
      Math.max(
        1,
        normalizeCount(
          rank
        )
      )
    )

  const percentileRank =
    (
      normalizedRank /
      normalizedPopulation
    ) * 100

  return roundToPrecision(
    percentileRank,
    2
  )
}

/**
 * Converts the rank-position percentile into the share of the
 * population ranked below the user.
 *
 * Example:
 *
 * rank 1 of 100:
 *
 *   percentile rank = 1
 *   percentile standing = 99
 */
export function calculatePercentileStanding({
  rank,
  eligibleUserCount,
}: {
  rank:
    number

  eligibleUserCount:
    number
}): ReputationPercentile {
  const normalizedPopulation =
    normalizeCount(
      eligibleUserCount
    )

  if (
    normalizedPopulation <=
    1
  ) {
    return 0
  }

  const normalizedRank =
    Math.min(
      normalizedPopulation,
      Math.max(
        1,
        normalizeCount(
          rank
        )
      )
    )

  const usersBelow =
    normalizedPopulation -
    normalizedRank

  return roundToPrecision(
    (
      usersBelow /
      normalizedPopulation
    ) * 100,
    2
  )
}

/* =========================================================
 * Ranking publication
 * ======================================================= */

export function canPublishRank({
  rank,
  eligibleUserCount,
}: {
  rank:
    number

  eligibleUserCount:
    number
}): boolean {
  const population =
    normalizeCount(
      eligibleUserCount
    )

  const normalizedRank =
    normalizeCount(
      rank
    )

  return (
    population >=
      MINIMUM_RANKING_POPULATION
        .rank &&
    normalizedRank >=
      1 &&
    normalizedRank <=
      population
  )
}

export function canPublishPercentile({
  rank,
  eligibleUserCount,
}: {
  rank:
    number

  eligibleUserCount:
    number
}): boolean {
  const population =
    normalizeCount(
      eligibleUserCount
    )

  return (
    canPublishRank({
      rank,
      eligibleUserCount,
    }) &&
    population >=
      MINIMUM_RANKING_POPULATION
        .percentile
  )
}

export function resolvePercentileClaimBand({
  rank,
  eligibleUserCount,
}: {
  rank:
    number

  eligibleUserCount:
    number
}): ReputationPercentileClaimBand | null {
  if (
    !canPublishPercentile({
      rank,
      eligibleUserCount,
    })
  ) {
    return null
  }

  const percentileRank =
    calculatePercentileRank({
      rank,
      eligibleUserCount,
    })

  return (
    REPUTATION_PERCENTILE_CLAIM_BANDS
      .find(
        (
          band
        ) =>
          normalizeCount(
            eligibleUserCount
          ) >=
            band.minimumPopulation &&
          percentileRank <=
            band.maximumPercentileRank
      ) ??
    null
  )
}

/* =========================================================
 * Public claim policy
 * ======================================================= */

/**
 * Public rank claims require:
 *
 * - an earned public reputation level
 * - enough verified venues
 * - leaderboard eligibility
 * - a sufficiently large comparison population
 */
export function canPublishReputationClaim({
  reputation,
  ranking,
}: {
  reputation:
    UserCategoryReputation

  ranking:
    UserReputationRank | null
}): boolean {
  if (
    reputation.level ===
    'unranked'
  ) {
    return false
  }

  if (
    !meetsLeaderboardRequirements({
      categoryId:
        reputation.categoryId,

      scope:
        reputation.scope,

      components:
        reputation.components,
    })
  ) {
    return false
  }

  if (
    !ranking
  ) {
    return false
  }

  if (
    ranking.userId !==
      reputation.userId ||
    ranking.categoryId !==
      reputation.categoryId ||
    ranking.scope !==
      reputation.scope ||
    normalizeNullableText(
      ranking.cityKey
    ) !==
      normalizeNullableText(
        reputation.cityKey
      )
  ) {
    return false
  }

  return canPublishRank({
    rank:
      ranking.rank,

    eligibleUserCount:
      ranking
        .eligibleUserCount,
  })
}

/**
 * Builds a public-safe reputation claim.
 *
 * Category and city display labels must be supplied by trusted
 * canonical metadata rather than reconstructed from identifiers.
 *
 * Exact rank and top-percent position are returned whenever a
 * valid eligible comparison population exists.
 *
 * Branded claims such as Top 10%, Top 5%, and Top 1% continue to
 * require their larger policy-defined comparison populations.
 */
export function buildPublicReputationClaim({
  reputation,
  ranking,
  categoryLabel,
  cityLabel,
}: {
  reputation:
    UserCategoryReputation

  ranking:
    UserReputationRank | null

  categoryLabel:
    string

  cityLabel:
    string | null
}): PublicReputationClaim | null {
  if (
    !canPublishReputationClaim({
      reputation,
      ranking,
    }) ||
    !ranking
  ) {
    return null
  }

  const normalizedCategoryLabel =
    normalizeRequiredText(
      categoryLabel
    )

  const normalizedCityLabel =
    normalizeNullableText(
      cityLabel
    )

  const scopeLabel =
    reputation.scope ===
      'city' &&
    normalizedCityLabel
      ? `${normalizedCityLabel} `
      : ''

  const publicRank =
    canPublishRank({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })
      ? normalizeCount(
          ranking.rank
        )
      : null

  const publicPercentile =
    canPublishPercentile({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })
      ? calculatePercentileRank({
          rank:
            ranking.rank,

          eligibleUserCount:
            ranking
              .eligibleUserCount,
        })
      : null

  const percentileBand =
    resolvePercentileClaimBand({
      rank:
        ranking.rank,

      eligibleUserCount:
        ranking
          .eligibleUserCount,
    })

  const comparisonLabel =
    percentileBand
      ?.label ??
    (
      publicPercentile !==
      null
        ? `Top ${formatPublicPercentile(
            publicPercentile
          )}%`
        : publicRank !==
          null
          ? `Rank #${publicRank}`
          : null
    )

  if (!comparisonLabel) {
    return null
  }

  return {
    categoryId:
      reputation.categoryId,

    scope:
      reputation.scope,

    cityKey:
      reputation.scope ===
      'city'
        ? reputation.cityKey
        : null,

    label:
      `${comparisonLabel} ${scopeLabel}${normalizedCategoryLabel}`,

    rank:
      publicRank,

    percentile:
      publicPercentile,

    eligibleUserCount:
      normalizeCount(
        ranking
          .eligibleUserCount
      ),

    verifiedVenueCount:
      normalizeCount(
        reputation
          .components
          .verifiedVenueCount
      ),

    level:
      reputation.level,
  }
}

/* =========================================================
 * Level helpers
 * ======================================================= */

export function getReputationLevelDefinition(
  level:
    ReputationLevel
): ReputationLevelDefinition {
  return (
    REPUTATION_LEVEL_DEFINITIONS[
      level
    ]
  )
}

export function getNextReputationLevel(
  level:
    ReputationLevel
): ReputationLevel | null {
  switch (
    level
  ) {
    case 'unranked':
      return 'emerging'

    case 'emerging':
      return 'established'

    case 'established':
      return 'expert'

    case 'expert':
      return 'elite'

    case 'elite':
      return null
  }
}

export function getReputationLevelProgress({
  categoryId,
  scope,
  score,
  components,
}: {
  categoryId:
    ReputationCategoryId

  scope:
    ReputationScope

  score:
    number

  components:
    ReputationScoreComponents
}): {
  currentLevel:
    ReputationLevel

  nextLevel:
    ReputationLevel | null

  currentThreshold:
    number

  nextThreshold:
    number | null

  scoreProgress:
    number

  scoreRemaining:
    number

  progressPercent:
    number
} {
  const currentLevel =
    resolveReputationLevel({
      categoryId,
      scope,
      score,
      components,
    })

  const nextLevel =
    getNextReputationLevel(
      currentLevel
    )

  const normalizedScore =
    normalizeScore(
      score
    )

  const currentThreshold =
    currentLevel ===
    'unranked'
      ? 0
      : REPUTATION_LEVEL_SCORE_THRESHOLDS[
          currentLevel
        ]

  const nextThreshold =
    nextLevel &&
    nextLevel !==
      'unranked'
      ? REPUTATION_LEVEL_SCORE_THRESHOLDS[
          nextLevel
        ]
      : null

  if (
    nextThreshold ===
    null
  ) {
    return {
      currentLevel,
      nextLevel:
        null,
      currentThreshold,
      nextThreshold:
        null,
      scoreProgress:
        normalizedScore,
      scoreRemaining:
        0,
      progressPercent:
        100,
    }
  }

  const thresholdRange =
    Math.max(
      1,
      nextThreshold -
        currentThreshold
    )

  const scoreProgress =
    Math.max(
      0,
      normalizedScore -
        currentThreshold
    )

  const progressPercent =
    Math.min(
      100,
      (
        scoreProgress /
        thresholdRange
      ) * 100
    )

  return {
    currentLevel,
    nextLevel,
    currentThreshold,
    nextThreshold,
    scoreProgress:
      roundToPrecision(
        scoreProgress,
        2
      ),

    scoreRemaining:
      roundToPrecision(
        Math.max(
          0,
          nextThreshold -
            normalizedScore
        ),
        2
      ),

    progressPercent:
      roundToPrecision(
        progressPercent,
        2
      ),
  }
}

/* =========================================================
 * Component normalization
 * ======================================================= */

export function normalizeReputationScoreComponents(
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

/* =========================================================
 * Internal helpers
 * ======================================================= */

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
    value <= 0
  ) {
    return 0
  }

  return Math.floor(
    value
  )
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
    value <= 0
  ) {
    return 0
  }

  return value
}

function normalizeCappedNumber({
  value,
  cap,
}: {
  value:
    unknown

  cap:
    number
}): number {
  return Math.min(
    Math.max(
      0,
      cap
    ),
    normalizeNonNegativeNumber(
      value
    )
  )
}

function normalizeScore(
  value:
    unknown
): number {
  return roundToPrecision(
    normalizeNonNegativeNumber(
      value
    ),
    2
  )
}

function normalizeRequiredText(
  value:
    unknown
): string {
  if (
    typeof value !==
    'string'
  ) {
    throw new Error(
      '[reputation policy] A required text value was invalid.'
    )
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (
    !normalized
  ) {
    throw new Error(
      '[reputation policy] A required text value was empty.'
    )
  }

  return normalized
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

function normalizeTimestamp(
  value:
    unknown
): string {
  if (
    typeof value ===
      'string'
  ) {
    const normalized =
      value.trim()

    const timestamp =
      Date.parse(
        normalized
      )

    if (
      normalized &&
      !Number.isNaN(
        timestamp
      )
    ) {
      return new Date(
        timestamp
      ).toISOString()
    }
  }

  return new Date(
    0
  ).toISOString()
}

function formatPublicPercentile(
  value:
    number
): string {
  const normalized =
    Math.min(
      100,
      Math.max(
        0,
        normalizeNonNegativeNumber(
          value
        )
      )
    )

  return normalized
    .toLocaleString(
      'en-US',
      {
        maximumFractionDigits:
          normalized <
          1
            ? 2
            : normalized <
                10
              ? 1
              : 0,
      }
    )
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