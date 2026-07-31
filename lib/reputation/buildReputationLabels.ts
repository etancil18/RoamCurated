import {
  getCityLabel,
} from '@/lib/cities/normalizeCity'

import {
  getReputationLevelDefinition,
} from './policy'

import {
  REPUTATION_CATEGORY_IDS,
  isReputationCategoryId,
  type PublicCategoryReputation,
  type PublicReputationClaim,
  type PublicUserReputation,
  type ReputationCategory,
  type ReputationCategoryId,
  type ReputationLevel,
  type ReputationScope,
  type UserCategoryReputation,
  type UserReputationRank,
} from './types'

/**
 * Canonical reputation-label builder.
 *
 * This module owns public-facing reputation copy for:
 *
 * - public profiles
 * - creator profiles
 * - Passport surfaces
 * - reputation cards
 * - leaderboards
 * - accessible labels
 * - social-share metadata
 *
 * This module intentionally contains:
 *
 * - no Supabase client
 * - no database queries
 * - no React
 * - no score calculation
 * - no tier qualification
 * - no ranking eligibility rules
 * - no percentile eligibility rules
 *
 * Callers must supply reputation data already validated by the
 * canonical reputation policy.
 */

/* =========================================================
 * Canonical fallback category labels
 * ======================================================= */

/**
 * Application fallbacks used when trusted database category
 * metadata is unavailable.
 *
 * These identifiers must remain aligned with:
 *
 * - public.reputation_categories.id
 * - REPUTATION_CATEGORY_IDS
 *
 * Database metadata should remain the preferred source for
 * configurable labels and descriptions.
 */
export const REPUTATION_CATEGORY_LABELS = {
  coffee: {
    name:
      'Coffee',

    label:
      'Coffee Explorer',

    shortLabel:
      'Coffee',
  },

  restaurants: {
    name:
      'Restaurants',

    label:
      'Restaurant Explorer',

    shortLabel:
      'Restaurants',
  },

  cocktail_bars: {
    name:
      'Cocktail Bars',

    label:
      'Cocktail Bar Explorer',

    shortLabel:
      'Cocktail Bars',
  },

  wine_bars: {
    name:
      'Wine Bars',

    label:
      'Wine Bar Explorer',

    shortLabel:
      'Wine Bars',
  },

  bars_pubs: {
    name:
      'Bars & Pubs',

    label:
      'Bar & Pub Explorer',

    shortLabel:
      'Bars & Pubs',
  },

  nightlife: {
    name:
      'Nightlife',

    label:
      'Nightlife Explorer',

    shortLabel:
      'Nightlife',
  },

  bakeries_desserts: {
    name:
      'Bakeries & Desserts',

    label:
      'Bakery & Dessert Explorer',

    shortLabel:
      'Bakeries & Desserts',
  },

  arts_culture: {
    name:
      'Arts & Culture',

    label:
      'Arts & Culture Explorer',

    shortLabel:
      'Arts & Culture',
  },

  books: {
    name:
      'Books & Libraries',

    label:
      'Book & Library Explorer',

    shortLabel:
      'Books & Libraries',
  },

  wellness_fitness: {
    name:
      'Wellness & Fitness',

    label:
      'Wellness & Fitness Explorer',

    shortLabel:
      'Wellness & Fitness',
  },

  outdoors: {
    name:
      'Outdoors',

    label:
      'Outdoor Explorer',

    shortLabel:
      'Outdoors',
  },

  markets_shopping: {
    name:
      'Markets & Shopping',

    label:
      'Market & Shopping Explorer',

    shortLabel:
      'Markets & Shopping',
  },

  activities_entertainment: {
    name:
      'Activities & Entertainment',

    label:
      'Activity & Entertainment Explorer',

    shortLabel:
      'Activities',
  },

  music_venues: {
    name:
      'Live Music',

    label:
      'Live Music Explorer',

    shortLabel:
      'Live Music',
  },
} as const satisfies Record<
  ReputationCategoryId,
  {
    name: string
    label: string
    shortLabel: string
  }
>

export type ReputationCategoryLabelDefinition =
  (typeof REPUTATION_CATEGORY_LABELS)[ReputationCategoryId]

/* =========================================================
 * Public label contracts
 * ======================================================= */

export type ReputationCategoryLabels = {
  categoryId: ReputationCategoryId

  name: string
  label: string
  shortLabel: string
}

export type ReputationTierLabels = {
  level: ReputationLevel

  label: string
  shortLabel: string
  description: string
}

export type ReputationScopeLabels = {
  scope: ReputationScope

  cityKey: string | null
  cityLabel: string | null

  label: string
  shortLabel: string
}

export type ReputationStatusLabels = {
  /**
   * Strongest concise public identity label.
   *
   * Examples:
   *
   * - "Atlanta Coffee Expert"
   * - "Established Restaurant Explorer"
   * - "Coffee Explorer"
   */
  headline: string

  /**
   * Supporting evidence label.
   *
   * Example:
   *
   * - "18 verified coffee venues"
   */
  evidenceLabel: string

  /**
   * Optional public ranking label.
   *
   * Examples:
   *
   * - "Top 5% Atlanta Coffee"
   * - "Rank #18 Atlanta Coffee"
   */
  rankingLabel: string | null

  /**
   * Compact label for chips, cards, and metadata.
   */
  compactLabel: string

  /**
   * Full accessible sentence.
   */
  accessibleLabel: string
}

export type ReputationSummaryLabels = {
  headline: string
  subheadline: string | null
  accessibleLabel: string
}

/* =========================================================
 * Category labels
 * ======================================================= */

/**
 * Resolves canonical category labels.
 *
 * Trusted category metadata takes precedence. Invalid or empty
 * metadata falls back to the application-owned definitions.
 */
export function buildReputationCategoryLabels({
  categoryId,
  category,
}: {
  categoryId:
    ReputationCategoryId

  category?:
    Partial<
      Pick<
        ReputationCategory,
        | 'id'
        | 'name'
        | 'label'
        | 'shortLabel'
      >
    > | null
}): ReputationCategoryLabels {
  const fallback =
    REPUTATION_CATEGORY_LABELS[
      categoryId
    ]

  const metadataMatchesCategory =
    category?.id ===
      undefined ||
    category.id ===
      categoryId

  return {
    categoryId,

    name:
      metadataMatchesCategory
        ? normalizeText(
            category?.name
          ) ??
          fallback.name
        : fallback.name,

    label:
      metadataMatchesCategory
        ? normalizeText(
            category?.label
          ) ??
          fallback.label
        : fallback.label,

    shortLabel:
      metadataMatchesCategory
        ? normalizeText(
            category?.shortLabel
          ) ??
          fallback.shortLabel
        : fallback.shortLabel,
  }
}

/**
 * Safely resolves labels from an untrusted category identifier.
 */
export function safelyBuildReputationCategoryLabels(
  categoryId:
    unknown
): ReputationCategoryLabels | null {
  if (
    !isReputationCategoryId(
      categoryId
    )
  ) {
    return null
  }

  return buildReputationCategoryLabels({
    categoryId,
  })
}

/* =========================================================
 * Tier labels
 * ======================================================= */

export function buildReputationTierLabels(
  level:
    ReputationLevel
): ReputationTierLabels {
  const definition =
    getReputationLevelDefinition(
      level
    )

  return {
    level,

    label:
      normalizeRequiredText({
        value:
          definition.label,

        fallback:
          humanizeIdentifier(
            level
          ),
      }),

    shortLabel:
      normalizeRequiredText({
        value:
          definition.shortLabel,

        fallback:
          humanizeIdentifier(
            level
          ),
      }),

    description:
      normalizeRequiredText({
        value:
          definition.description,

        fallback:
          'Reputation earned through verified activity on Roam.',
      }),
  }
}

/* =========================================================
 * Scope labels
 * ======================================================= */

export function buildReputationScopeLabels({
  scope,
  cityKey,
}: {
  scope:
    ReputationScope

  cityKey:
    string | null
}): ReputationScopeLabels {
  if (
    scope ===
    'global'
  ) {
    return {
      scope:
        'global',

      cityKey:
        null,

      cityLabel:
        null,

      label:
        'Global',

      shortLabel:
        'Global',
    }
  }

  const normalizedCityKey =
    normalizeText(
      cityKey
    )

  const cityLabel =
    normalizedCityKey
      ? normalizeText(
          getCityLabel(
            normalizedCityKey
          )
        )
      : null

  return {
    scope:
      'city',

    cityKey:
      normalizedCityKey,

    cityLabel,

    label:
      cityLabel ??
      'City',

    shortLabel:
      cityLabel ??
      'City',
  }
}

/* =========================================================
 * Verified-venue labels
 * ======================================================= */

export function buildVerifiedVenueCountLabel({
  count,
  categoryId,
  includeCategory = true,
}: {
  count:
    number

  categoryId?:
    ReputationCategoryId | null

  includeCategory?:
    boolean
}): string {
  const normalizedCount =
    normalizeCount(
      count
    )

  const categoryLabels =
    categoryId
      ? buildReputationCategoryLabels({
          categoryId,
        })
      : null

  const categoryPrefix =
    includeCategory &&
    categoryLabels
      ? `${categoryLabels.shortLabel.toLocaleLowerCase(
          'en-US'
        )} `
      : ''

  return `${normalizedCount.toLocaleString(
    'en-US'
  )} verified ${categoryPrefix}${
    normalizedCount ===
    1
      ? 'venue'
      : 'venues'
  }`
}

/* =========================================================
 * Rank and percentile labels
 * ======================================================= */

/**
 * Returns the trusted public label already attached to a
 * canonical public claim.
 *
 * This function does not recalculate whether the claim is
 * eligible for publication.
 */
export function buildPublicClaimLabel(
  claim:
    PublicReputationClaim | null | undefined
): string | null {
  if (
    !claim
  ) {
    return null
  }

  return normalizeText(
    claim.label
  )
}

/**
 * Creates a rank label from a trusted canonical ranking.
 *
 * Callers must use policy.ts to confirm the rank is publishable
 * before presenting this label publicly.
 */
export function buildReputationRankLabel({
  ranking,
  categoryLabel,
  cityLabel,
}: {
  ranking:
    Pick<
      UserReputationRank,
      | 'rank'
      | 'scope'
      | 'cityKey'
    >

  categoryLabel:
    string

  cityLabel?:
    string | null
}): string | null {
  const rank =
    normalizePositiveCount(
      ranking.rank
    )

  if (
    rank ===
    null
  ) {
    return null
  }

  const normalizedCategoryLabel =
    normalizeText(
      categoryLabel
    )

  if (
    !normalizedCategoryLabel
  ) {
    return null
  }

  const resolvedCityLabel =
    ranking.scope ===
      'city'
      ? normalizeText(
          cityLabel
        ) ??
        normalizeText(
          getCityLabel(
            ranking.cityKey
          )
        )
      : null

  return [
    `Rank #${rank.toLocaleString(
      'en-US'
    )}`,

    resolvedCityLabel,

    normalizedCategoryLabel,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    )
    .join(
      ' '
    )
}

/* =========================================================
 * Category status labels
 * ======================================================= */

/**
 * Builds a display-ready identity label from canonical
 * reputation data.
 *
 * Public claims take precedence over tier-based identity copy.
 *
 * Examples:
 *
 * - "Top 5% Atlanta Coffee"
 * - "Rank #18 Atlanta Coffee"
 * - "Atlanta Coffee Expert"
 * - "Established Restaurant Explorer"
 */
export function buildReputationStatusLabels({
  reputation,
  category,
  claim = null,
}: {
  reputation:
    Pick<
      PublicCategoryReputation,
      | 'categoryId'
      | 'scope'
      | 'cityKey'
      | 'cityLabel'
      | 'level'
      | 'verifiedVenueCount'
    >

  category?:
    Partial<
      Pick<
        ReputationCategory,
        | 'id'
        | 'name'
        | 'label'
        | 'shortLabel'
      >
    > | null

  claim?:
    PublicReputationClaim | null
}): ReputationStatusLabels {
  const categoryLabels =
    buildReputationCategoryLabels({
      categoryId:
        reputation.categoryId,

      category,
    })

  const tierLabels =
    buildReputationTierLabels(
      reputation.level
    )

  const scopeLabels =
    buildReputationScopeLabels({
      scope:
        reputation.scope,

      cityKey:
        reputation.cityKey,
    })

  const cityLabel =
    normalizeText(
      reputation.cityLabel
    ) ??
    scopeLabels.cityLabel

  const rankingLabel =
    buildPublicClaimLabel(
      claim
    )

  const evidenceLabel =
    buildVerifiedVenueCountLabel({
      count:
        reputation
          .verifiedVenueCount,

      categoryId:
        reputation.categoryId,

      includeCategory:
        true,
    })

  const tierIdentityLabel =
    buildTierIdentityLabel({
      level:
        reputation.level,

      tierLabel:
        tierLabels.shortLabel,

      categoryLabel:
        categoryLabels
          .shortLabel,

      cityLabel:
        reputation.scope ===
        'city'
          ? cityLabel
          : null,
    })

  const headline =
    rankingLabel ??
    tierIdentityLabel

  const compactLabel =
    rankingLabel ??
    buildCompactTierLabel({
      level:
        reputation.level,

      categoryLabel:
        categoryLabels
          .shortLabel,

      cityLabel:
        reputation.scope ===
        'city'
          ? cityLabel
          : null,
    })

  return {
    headline,

    evidenceLabel,

    rankingLabel,

    compactLabel,

    accessibleLabel:
      `${headline}. ${evidenceLabel}.`,
  }
}

/**
 * Builds labels from the internal category aggregate.
 *
 * This path does not invent a public rank claim. Supply a
 * policy-approved claim explicitly when available.
 */
export function buildInternalReputationStatusLabels({
  reputation,
  category,
  claim = null,
}: {
  reputation:
    Pick<
      UserCategoryReputation,
      | 'categoryId'
      | 'scope'
      | 'cityKey'
      | 'level'
      | 'components'
    >

  category?:
    Partial<
      Pick<
        ReputationCategory,
        | 'id'
        | 'name'
        | 'label'
        | 'shortLabel'
      >
    > | null

  claim?:
    PublicReputationClaim | null
}): ReputationStatusLabels {
  return buildReputationStatusLabels({
    reputation: {
      categoryId:
        reputation.categoryId,

      scope:
        reputation.scope,

      cityKey:
        reputation.cityKey,

      cityLabel:
        reputation.scope ===
        'city'
          ? getCityLabel(
              reputation.cityKey
            )
          : null,

      level:
        reputation.level,

      verifiedVenueCount:
        reputation.components
          .verifiedVenueCount,
    },

    category,

    claim,
  })
}

/* =========================================================
 * Profile summary labels
 * ======================================================= */

/**
 * Builds the primary public reputation identity for one profile.
 *
 * Claim priority:
 *
 * 1. first canonical public ranking claim
 * 2. strongest earned category reputation
 * 3. overall reputation level
 */
export function buildPublicReputationSummaryLabels(
  reputation:
    PublicUserReputation
): ReputationSummaryLabels {
  const primaryClaim =
    reputation.claims
      .map(
        buildPublicClaimLabel
      )
      .find(
        (
          label
        ): label is string =>
          label !==
          null
      ) ??
    null

  const strongestCategory =
    selectStrongestPublicCategory(
      reputation.categories
    )

  const overallTier =
    buildReputationTierLabels(
      reputation.overallLevel
    )

  let headline:
    string

  if (
    primaryClaim
  ) {
    headline =
      primaryClaim
  } else if (
    strongestCategory
  ) {
    headline =
      buildReputationStatusLabels({
        reputation:
          strongestCategory,

        claim:
          strongestCategory
            .publicClaim,
      }).headline
  } else {
    headline =
      overallTier.label
  }

  const activityParts:
    string[] = []

  const verifiedVenueCount =
    normalizeCount(
      reputation
        .totalVerifiedVenueCount
    )

  if (
    verifiedVenueCount >
    0
  ) {
    activityParts.push(
      `${verifiedVenueCount.toLocaleString(
        'en-US'
      )} verified ${
        verifiedVenueCount ===
        1
          ? 'venue'
          : 'venues'
      }`
    )
  }

  const collectionCount =
    normalizeCount(
      reputation
        .totalPublicCollectionCount
    )

  if (
    collectionCount >
    0
  ) {
    activityParts.push(
      `${collectionCount.toLocaleString(
        'en-US'
      )} public ${
        collectionCount ===
        1
          ? 'collection'
          : 'collections'
      }`
    )
  }

  const completedFlowCount =
    normalizeCount(
      reputation
        .totalCompletedFlowCount
    )

  if (
    completedFlowCount >
    0
  ) {
    activityParts.push(
      `${completedFlowCount.toLocaleString(
        'en-US'
      )} completed ${
        completedFlowCount ===
        1
          ? 'flow'
          : 'flows'
      }`
    )
  }

  const subheadline =
    activityParts.length >
    0
      ? activityParts
          .slice(
            0,
            3
          )
          .join(
            ' · '
          )
      : null

  return {
    headline,

    subheadline,

    accessibleLabel:
      subheadline
        ? `${headline}. ${subheadline}.`
        : `${headline}.`,
  }
}

/* =========================================================
 * Reputation collection labels
 * ======================================================= */

/**
 * Produces compact public category labels in deterministic
 * canonical category order.
 */
export function buildReputationCategoryChipLabels(
  categories:
    readonly Pick<
      PublicCategoryReputation,
      | 'categoryId'
      | 'level'
      | 'scope'
      | 'cityKey'
      | 'cityLabel'
      | 'verifiedVenueCount'
      | 'publicClaim'
    >[]
): string[] {
  return [
    ...categories,
  ]
    .sort(
      comparePublicCategories
    )
    .map(
      (
        category
      ) =>
        buildReputationStatusLabels({
          reputation:
            category,

          claim:
            category
              .publicClaim,
        }).compactLabel
    )
}

/* =========================================================
 * Internal identity builders
 * ======================================================= */

function buildTierIdentityLabel({
  level,
  tierLabel,
  categoryLabel,
  cityLabel,
}: {
  level:
    ReputationLevel

  tierLabel:
    string

  categoryLabel:
    string

  cityLabel:
    string | null
}): string {
  if (
    level ===
    'unranked'
  ) {
    return [
      cityLabel,
      categoryLabel,
      'Explorer',
    ]
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            normalizeText(
              value
            )
          )
      )
      .join(
        ' '
      )
  }

  if (
    level ===
    'expert'
  ) {
    return [
      cityLabel,
      categoryLabel,
      'Expert',
    ]
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            normalizeText(
              value
            )
          )
      )
      .join(
        ' '
      )
  }

  if (
    level ===
    'elite'
  ) {
    return [
      'Elite',
      cityLabel,
      categoryLabel,
      'Explorer',
    ]
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            normalizeText(
              value
            )
          )
      )
      .join(
        ' '
      )
  }

    return [
    tierLabel,
    cityLabel,
    categoryLabel,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          normalizeText(
            value
          )
        )
    )
    .join(
      ' '
    )
}

function buildCompactTierLabel({
  level,
  categoryLabel,
  cityLabel,
}: {
  level:
    ReputationLevel

  categoryLabel:
    string

  cityLabel:
    string | null
}): string {
  switch (
    level
  ) {
    case 'elite':
      return [
        'Elite',
        cityLabel,
        categoryLabel,
      ]
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              normalizeText(
                value
              )
            )
        )
        .join(
          ' '
        )

    case 'expert':
      return [
        cityLabel,
        categoryLabel,
        'Expert',
      ]
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              normalizeText(
                value
              )
            )
        )
        .join(
          ' '
        )

    case 'established':
      return [
        'Established',
        cityLabel,
        categoryLabel,
      ]
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              normalizeText(
                value
              )
            )
        )
        .join(
          ' '
        )

    case 'emerging':
      return [
        'Emerging',
        cityLabel,
        categoryLabel,
      ]
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              normalizeText(
                value
              )
            )
        )
        .join(
          ' '
        )

    case 'unranked':
      return [
        cityLabel,
        categoryLabel,
      ]
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              normalizeText(
                value
              )
            )
        )
        .join(
          ' '
        )
  }
}

/* =========================================================
 * Category selection and ordering
 * ======================================================= */

function selectStrongestPublicCategory(
  categories:
    readonly PublicCategoryReputation[]
): PublicCategoryReputation | null {
  return [
    ...categories,
  ]
    .filter(
      (
        category
      ) =>
        category.level !==
        'unranked'
    )
    .sort(
      (
        first,
        second
      ) => {
        const claimDifference =
          Number(
            Boolean(
              second.publicClaim
            )
          ) -
          Number(
            Boolean(
              first.publicClaim
            )
          )

        if (
          claimDifference !==
          0
        ) {
          return claimDifference
        }

        const levelDifference =
          getReputationLevelDefinition(
            second.level
          ).sortOrder -
          getReputationLevelDefinition(
            first.level
          ).sortOrder

        if (
          levelDifference !==
          0
        ) {
          return levelDifference
        }

        const venueDifference =
          normalizeCount(
            second
              .verifiedVenueCount
          ) -
          normalizeCount(
            first
              .verifiedVenueCount
          )

        if (
          venueDifference !==
          0
        ) {
          return venueDifference
        }

        return (
          getCategorySortOrder(
            first.categoryId
          ) -
          getCategorySortOrder(
            second.categoryId
          )
        )
      }
    )[0] ??
    null
}

function comparePublicCategories(
  first:
    Pick<
      PublicCategoryReputation,
      | 'categoryId'
      | 'level'
      | 'verifiedVenueCount'
    >,
  second:
    Pick<
      PublicCategoryReputation,
      | 'categoryId'
      | 'level'
      | 'verifiedVenueCount'
    >
): number {
  const levelDifference =
    getReputationLevelDefinition(
      second.level
    ).sortOrder -
    getReputationLevelDefinition(
      first.level
    ).sortOrder

  if (
    levelDifference !==
    0
  ) {
    return levelDifference
  }

  const venueDifference =
    normalizeCount(
      second
        .verifiedVenueCount
    ) -
    normalizeCount(
      first
        .verifiedVenueCount
    )

  if (
    venueDifference !==
    0
  ) {
    return venueDifference
  }

  return (
    getCategorySortOrder(
      first.categoryId
    ) -
    getCategorySortOrder(
      second.categoryId
    )
  )
}

function getCategorySortOrder(
  categoryId:
    ReputationCategoryId
): number {
  const index =
    REPUTATION_CATEGORY_IDS
      .indexOf(
        categoryId
      )

  return index >=
    0
    ? index
    : Number.MAX_SAFE_INTEGER
}

/* =========================================================
 * General helpers
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
    value <=
      0
  ) {
    return 0
  }

  return Math.floor(
    value
  )
}

function normalizePositiveCount(
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

function normalizeText(
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

function normalizeRequiredText({
  value,
  fallback,
}: {
  value:
    unknown

  fallback:
    string
}): string {
  return (
    normalizeText(
      value
    ) ??
    fallback
  )
}

function humanizeIdentifier(
  value:
    string
): string {
  return value
    .trim()
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toLocaleUpperCase(
          'en-US'
        )
    )
}