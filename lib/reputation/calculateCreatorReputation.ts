import {
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

import {
  buildUserCategoryReputation,
  getReputationLevelDefinition,
} from './policy'

import {
  REPUTATION_CATEGORY_IDS,
  createEmptyUserReputationSummary,
  isReputationCategoryId,
  type ReputationCategoryId,
  type ReputationIsoTimestamp,
  type ReputationLevel,
  type ReputationScoreComponents,
  type UserCategoryReputation,
  type UserReputationSummary,
} from './types'

/**
 * Canonical creator-reputation calculator.
 *
 * This module intentionally contains:
 *
 * - no React
 * - no Supabase client
 * - no database queries
 * - no ranking calculations
 * - no percentile calculations
 * - no public-claim generation
 * - no venue taxonomy inference
 *
 * Callers must supply already-sanitized contributions derived
 * from canonical Roam data.
 *
 * The calculator produces:
 *
 * - one global category aggregate per qualifying category
 * - one city category aggregate per qualifying category and city
 * - one overall creator reputation summary
 *
 * Reputation persistence and ranking generation belong in
 * separate trusted server-side modules.
 */

/* =========================================================
 * Public input contracts
 * ======================================================= */

/**
 * One verified venue contribution.
 *
 * A venue may contribute to multiple categories, but duplicate
 * evidence for the same:
 *
 *   user + venue + category
 *
 * is collapsed before scoring.
 */
export type CreatorReputationVenueEvidenceInput = {
  venueId: string
  categoryId: ReputationCategoryId | string

  /**
   * Canonical or normalizable Roam city key.
   *
   * Unsupported values are excluded from city-scoped
   * reputation but may still contribute globally.
   */
  cityKey?: string | null

  /**
   * Taxonomy or attribution confidence between zero and one.
   *
   * Duplicate evidence for the same venue and category retains
   * the strongest weight.
   */
  attributionWeight?: number | null

  /**
   * Timestamp of the qualifying activity.
   *
   * The most recent valid timestamp is retained.
   */
  occurredAt?: string | null
}

/**
 * One public collection's category contribution.
 *
 * A single collection may contribute to multiple categories by
 * supplying multiple input records with the same collectionId.
 */
export type CreatorReputationCollectionContributionInput = {
  collectionId: string
  categoryId: ReputationCategoryId | string

  /**
   * Canonical venue IDs from this public collection that
   * contribute to the category.
   */
  venueIds?: readonly unknown[] | null

  /**
   * Optional city scope for the collection contribution.
   *
   * Null means the contribution affects only the global
   * category aggregate.
   */
  cityKey?: string | null
}

/**
 * One public completed-flow snapshot contribution.
 */
export type CreatorReputationSnapshotContributionInput = {
  snapshotId: string
  categoryId: ReputationCategoryId | string
  cityKey?: string | null
}

/**
 * One completed Flow contribution.
 */
export type CreatorReputationFlowContributionInput = {
  flowId: string
  categoryId: ReputationCategoryId | string
  cityKey?: string | null
}

/**
 * Full canonical calculation input.
 */
export type CalculateCreatorReputationInput = {
  userId: string

  /**
   * Optional explicit primary city.
   *
   * When missing or unsupported, the calculator derives the
   * primary city from distinct verified venues.
   */
  primaryCityKey?: string | null

  venueEvidence?:
    readonly CreatorReputationVenueEvidenceInput[] | null

  publicCollectionContributions?:
    readonly CreatorReputationCollectionContributionInput[] | null

  publicSnapshotContributions?:
    readonly CreatorReputationSnapshotContributionInput[] | null

  completedFlowContributions?:
    readonly CreatorReputationFlowContributionInput[] | null

  /**
   * Stable calculation timestamp.
   *
   * Trusted rebuild jobs should supply one timestamp and reuse
   * it across all persisted rows.
   */
  calculatedAt?: string
}

/* =========================================================
 * Public result contracts
 * ======================================================= */

export type CreatorReputationCalculationResult = {
  userId: string

  summary: UserReputationSummary

  /**
   * One aggregate per category across every city.
   */
  globalCategories: UserCategoryReputation[]

  /**
   * One aggregate per category and canonical city.
   */
  cityCategories: UserCategoryReputation[]

  /**
   * Combined deterministic ordering:
   *
   * - global rows first
   * - city rows second
   * - category ID ascending
   * - city key ascending
   */
  categoryReputations: UserCategoryReputation[]

  calculatedAt: ReputationIsoTimestamp
}

/* =========================================================
 * Internal normalized contracts
 * ======================================================= */

type NormalizedVenueEvidence = {
  venueId: string
  categoryId: ReputationCategoryId
  cityKey: string | null
  attributionWeight: number
  occurredAt: string | null
}

type NormalizedCollectionContribution = {
  collectionId: string
  categoryId: ReputationCategoryId
  cityKey: string | null
  venueIds: string[]
}

type NormalizedSnapshotContribution = {
  snapshotId: string
  categoryId: ReputationCategoryId
  cityKey: string | null
}

type NormalizedFlowContribution = {
  flowId: string
  categoryId: ReputationCategoryId
  cityKey: string | null
}

type CategoryAccumulator = {
  categoryId: ReputationCategoryId
  cityKey: string | null

  venueWeights: Map<string, number>
  venueLatestEvidenceAt: Map<string, string>

  collectionIds: Set<string>
  curatedVenueIds: Set<string>
  snapshotIds: Set<string>
  completedFlowIds: Set<string>

  representedCityKeys: Set<string>
}

/* =========================================================
 * Main calculation
 * ======================================================= */

export function calculateCreatorReputation({
  userId,
  primaryCityKey = null,
  venueEvidence = [],
  publicCollectionContributions = [],
  publicSnapshotContributions = [],
  completedFlowContributions = [],
  calculatedAt = new Date().toISOString(),
}: CalculateCreatorReputationInput): CreatorReputationCalculationResult {
  const normalizedUserId =
    normalizeRequiredIdentifier({
      value:
        userId,

      fieldName:
        'userId',
    })

  const normalizedCalculatedAt =
    normalizeTimestamp(
      calculatedAt
    ) ??
    new Date().toISOString()

  const normalizedVenueEvidence =
    normalizeVenueEvidence(
      venueEvidence
    )

  const normalizedCollections =
    normalizeCollectionContributions(
      publicCollectionContributions
    )

  const normalizedSnapshots =
    normalizeSnapshotContributions(
      publicSnapshotContributions
    )

  const normalizedFlows =
    normalizeFlowContributions(
      completedFlowContributions
    )

  const globalAccumulators =
    createCategoryAccumulatorMap()

  const cityAccumulators =
    createCategoryAccumulatorMap()

  applyVenueEvidence({
    venueEvidence:
      normalizedVenueEvidence,

    globalAccumulators,

    cityAccumulators,
  })

  applyCollectionContributions({
    contributions:
      normalizedCollections,

    globalAccumulators,

    cityAccumulators,
  })

  applySnapshotContributions({
    contributions:
      normalizedSnapshots,

    globalAccumulators,

    cityAccumulators,
  })

  applyFlowContributions({
    contributions:
      normalizedFlows,

    globalAccumulators,

    cityAccumulators,
  })

  const globalCategories =
    buildCategoryReputations({
      userId:
        normalizedUserId,

      accumulators:
        globalAccumulators,

      scope:
        'global',

      calculatedAt:
        normalizedCalculatedAt,
    })

  const cityCategories =
    buildCategoryReputations({
      userId:
        normalizedUserId,

      accumulators:
        cityAccumulators,

      scope:
        'city',

      calculatedAt:
        normalizedCalculatedAt,
    })

  const resolvedPrimaryCityKey =
    resolvePrimaryCityKey({
      explicitPrimaryCityKey:
        primaryCityKey,

      venueEvidence:
        normalizedVenueEvidence,
    })

  const summary =
    buildReputationSummary({
      userId:
        normalizedUserId,

      primaryCityKey:
        resolvedPrimaryCityKey,

      venueEvidence:
        normalizedVenueEvidence,

      collections:
        normalizedCollections,

      snapshots:
        normalizedSnapshots,

      flows:
        normalizedFlows,

      globalCategories,

      calculatedAt:
        normalizedCalculatedAt,
    })

  return {
    userId:
      normalizedUserId,

    summary,

    globalCategories,

    cityCategories,

    categoryReputations: [
      ...globalCategories,
      ...cityCategories,
    ],

    calculatedAt:
      normalizedCalculatedAt,
  }
}

/* =========================================================
 * Evidence application
 * ======================================================= */

function applyVenueEvidence({
  venueEvidence,
  globalAccumulators,
  cityAccumulators,
}: {
  venueEvidence: NormalizedVenueEvidence[]

  globalAccumulators:
    Map<string, CategoryAccumulator>

  cityAccumulators:
    Map<string, CategoryAccumulator>
}): void {
  for (
    const evidence of
    venueEvidence
  ) {
    const globalAccumulator =
      getOrCreateAccumulator({
        accumulators:
          globalAccumulators,

        categoryId:
          evidence.categoryId,

        cityKey:
          null,
      })

    applyVenueToAccumulator({
      accumulator:
        globalAccumulator,

      evidence,
    })

    if (
      evidence.cityKey
    ) {
      globalAccumulator
        .representedCityKeys
        .add(
          evidence.cityKey
        )

      const cityAccumulator =
        getOrCreateAccumulator({
          accumulators:
            cityAccumulators,

          categoryId:
            evidence.categoryId,

          cityKey:
            evidence.cityKey,
        })

      applyVenueToAccumulator({
        accumulator:
          cityAccumulator,

        evidence,
      })

      cityAccumulator
        .representedCityKeys
        .add(
          evidence.cityKey
        )
    }
  }
}

function applyVenueToAccumulator({
  accumulator,
  evidence,
}: {
  accumulator: CategoryAccumulator
  evidence: NormalizedVenueEvidence
}): void {
  const existingWeight =
    accumulator
      .venueWeights
      .get(
        evidence.venueId
      ) ??
    0

  accumulator
    .venueWeights
    .set(
      evidence.venueId,
      Math.max(
        existingWeight,
        evidence.attributionWeight
      )
    )

  if (
    !evidence.occurredAt
  ) {
    return
  }

  const existingTimestamp =
    accumulator
      .venueLatestEvidenceAt
      .get(
        evidence.venueId
      ) ??
    null

  if (
    !existingTimestamp ||
    compareTimestamps(
      evidence.occurredAt,
      existingTimestamp
    ) >
      0
  ) {
    accumulator
      .venueLatestEvidenceAt
      .set(
        evidence.venueId,
        evidence.occurredAt
      )
  }
}

/* =========================================================
 * Collection application
 * ======================================================= */

function applyCollectionContributions({
  contributions,
  globalAccumulators,
  cityAccumulators,
}: {
  contributions:
    NormalizedCollectionContribution[]

  globalAccumulators:
    Map<string, CategoryAccumulator>

  cityAccumulators:
    Map<string, CategoryAccumulator>
}): void {
  for (
    const contribution of
    contributions
  ) {
    const globalAccumulator =
      getOrCreateAccumulator({
        accumulators:
          globalAccumulators,

        categoryId:
          contribution.categoryId,

        cityKey:
          null,
      })

    applyCollectionToAccumulator({
      accumulator:
        globalAccumulator,

      contribution,
    })

    if (
      contribution.cityKey
    ) {
      globalAccumulator
        .representedCityKeys
        .add(
          contribution.cityKey
        )

      const cityAccumulator =
        getOrCreateAccumulator({
          accumulators:
            cityAccumulators,

          categoryId:
            contribution.categoryId,

          cityKey:
            contribution.cityKey,
        })

      applyCollectionToAccumulator({
        accumulator:
          cityAccumulator,

        contribution,
      })

      cityAccumulator
        .representedCityKeys
        .add(
          contribution.cityKey
        )
    }
  }
}

function applyCollectionToAccumulator({
  accumulator,
  contribution,
}: {
  accumulator: CategoryAccumulator

  contribution:
    NormalizedCollectionContribution
}): void {
  accumulator
    .collectionIds
    .add(
      contribution.collectionId
    )

  for (
    const venueId of
    contribution.venueIds
  ) {
    accumulator
      .curatedVenueIds
      .add(
        venueId
      )
  }
}

/* =========================================================
 * Snapshot application
 * ======================================================= */

function applySnapshotContributions({
  contributions,
  globalAccumulators,
  cityAccumulators,
}: {
  contributions:
    NormalizedSnapshotContribution[]

  globalAccumulators:
    Map<string, CategoryAccumulator>

  cityAccumulators:
    Map<string, CategoryAccumulator>
}): void {
  for (
    const contribution of
    contributions
  ) {
    const globalAccumulator =
      getOrCreateAccumulator({
        accumulators:
          globalAccumulators,

        categoryId:
          contribution.categoryId,

        cityKey:
          null,
      })

    globalAccumulator
      .snapshotIds
      .add(
        contribution.snapshotId
      )

    if (
      contribution.cityKey
    ) {
      globalAccumulator
        .representedCityKeys
        .add(
          contribution.cityKey
        )

      const cityAccumulator =
        getOrCreateAccumulator({
          accumulators:
            cityAccumulators,

          categoryId:
            contribution.categoryId,

          cityKey:
            contribution.cityKey,
        })

      cityAccumulator
        .snapshotIds
        .add(
          contribution.snapshotId
        )

      cityAccumulator
        .representedCityKeys
        .add(
          contribution.cityKey
        )
    }
  }
}

/* =========================================================
 * Flow application
 * ======================================================= */

function applyFlowContributions({
  contributions,
  globalAccumulators,
  cityAccumulators,
}: {
  contributions:
    NormalizedFlowContribution[]

  globalAccumulators:
    Map<string, CategoryAccumulator>

  cityAccumulators:
    Map<string, CategoryAccumulator>
}): void {
  for (
    const contribution of
    contributions
  ) {
    const globalAccumulator =
      getOrCreateAccumulator({
        accumulators:
          globalAccumulators,

        categoryId:
          contribution.categoryId,

        cityKey:
          null,
      })

    globalAccumulator
      .completedFlowIds
      .add(
        contribution.flowId
      )

    if (
      contribution.cityKey
    ) {
      globalAccumulator
        .representedCityKeys
        .add(
          contribution.cityKey
        )

      const cityAccumulator =
        getOrCreateAccumulator({
          accumulators:
            cityAccumulators,

          categoryId:
            contribution.categoryId,

          cityKey:
            contribution.cityKey,
        })

      cityAccumulator
        .completedFlowIds
        .add(
          contribution.flowId
        )

      cityAccumulator
        .representedCityKeys
        .add(
          contribution.cityKey
        )
    }
  }
}

/* =========================================================
 * Aggregate construction
 * ======================================================= */

function buildCategoryReputations({
  userId,
  accumulators,
  scope,
  calculatedAt,
}: {
  userId: string

  accumulators:
    Map<string, CategoryAccumulator>

  scope:
    'global' | 'city'

  calculatedAt:
    string
}): UserCategoryReputation[] {
  return [
    ...accumulators.values(),
  ]
    .map(
      (
        accumulator
      ) => {
        const components =
          buildScoreComponents(
            accumulator
          )

        return buildUserCategoryReputation({
          userId,

          categoryId:
            accumulator.categoryId,

          scope,

          cityKey:
            scope ===
            'city'
              ? accumulator.cityKey
              : null,

          components,

          latestEvidenceAt:
            resolveLatestEvidenceAt(
              accumulator
            ),

          calculatedAt,
        })
      }
    )
    .sort(
      compareCategoryReputations
    )
}

/**
 * Builds canonical scoring components.
 *
 * Duplicate venues, collections, snapshots, and flows are
 * counted only once within each category and scope.
 */
function buildScoreComponents(
  accumulator:
    CategoryAccumulator
): ReputationScoreComponents {
  const weightedVenueCount =
    [
      ...accumulator
        .venueWeights
        .values(),
    ].reduce(
      (
        total,
        weight
      ) =>
        total +
        normalizeAttributionWeight(
          weight
        ),
      0
    )

  return {
    verifiedVenueCount:
      accumulator
        .venueWeights
        .size,

    weightedVenueCount:
      roundToPrecision(
        weightedVenueCount,
        4
      ),

    cityCount:
      accumulator
        .representedCityKeys
        .size,

    publicCollectionCount:
      accumulator
        .collectionIds
        .size,

    curatedVenueCount:
      accumulator
        .curatedVenueIds
        .size,

    publicSnapshotCount:
      accumulator
        .snapshotIds
        .size,

    completedFlowCount:
      accumulator
        .completedFlowIds
        .size,

    /**
     * Reserved for a future policy version.
     */
    recencyScore:
      0,

    /**
     * Reserved for a future policy version.
     */
    qualityScore:
      0,
  }
}

/* =========================================================
 * Summary construction
 * ======================================================= */

function buildReputationSummary({
  userId,
  primaryCityKey,
  venueEvidence,
  collections,
  snapshots,
  flows,
  globalCategories,
  calculatedAt,
}: {
  userId: string

  primaryCityKey:
    string | null

  venueEvidence:
    NormalizedVenueEvidence[]

  collections:
    NormalizedCollectionContribution[]

  snapshots:
    NormalizedSnapshotContribution[]

  flows:
    NormalizedFlowContribution[]

  globalCategories:
    UserCategoryReputation[]

  calculatedAt:
    string
}): UserReputationSummary {
  if (
    venueEvidence.length ===
      0 &&
    collections.length ===
      0 &&
    snapshots.length ===
      0 &&
    flows.length ===
      0
  ) {
    return {
      ...createEmptyUserReputationSummary(
        userId
      ),

      primaryCityKey,

      calculatedAt,
    }
  }

  const distinctVerifiedVenueIds =
    new Set(
      venueEvidence.map(
        (
          evidence
        ) =>
          evidence.venueId
      )
    )

  const distinctCollectionIds =
    new Set(
      collections.map(
        (
          contribution
        ) =>
          contribution.collectionId
      )
    )

  const distinctCuratedVenueIds =
    new Set(
      collections.flatMap(
        (
          contribution
        ) =>
          contribution.venueIds
      )
    )

  const distinctSnapshotIds =
    new Set(
      snapshots.map(
        (
          contribution
        ) =>
          contribution.snapshotId
      )
    )

  const distinctFlowIds =
    new Set(
      flows.map(
        (
          contribution
        ) =>
          contribution.flowId
      )
    )

  const qualifyingCityKeys =
    new Set(
      venueEvidence
        .map(
          (
            evidence
          ) =>
            evidence.cityKey
        )
        .filter(
          (
            cityKey
          ): cityKey is string =>
            cityKey !==
            null
        )
    )

  const qualifiedGlobalCategories =
    globalCategories.filter(
      (
        reputation
      ) =>
        reputation.level !==
        'unranked'
    )

  const overallScore =
    roundToPrecision(
      qualifiedGlobalCategories.reduce(
        (
          total,
          reputation
        ) =>
          total +
          normalizeNonNegativeNumber(
            reputation.score
          ),
        0
      ),
      2
    )

  const overallLevel =
    resolveHighestLevel(
      qualifiedGlobalCategories
        .map(
          (
            reputation
          ) =>
            reputation.level
        )
    )

  return {
    userId,

    totalVerifiedVenueCount:
      distinctVerifiedVenueIds
        .size,

    totalPublicCollectionCount:
      distinctCollectionIds
        .size,

    totalCuratedVenueCount:
      distinctCuratedVenueIds
        .size,

    totalCompletedFlowCount:
      distinctFlowIds
        .size,

    totalPublicSnapshotCount:
      distinctSnapshotIds
        .size,

    qualifyingCityCount:
      qualifyingCityKeys
        .size,

    qualifyingCategoryCount:
      qualifiedGlobalCategories
        .length,

    /**
     * Overall score is the sum of earned global category
     * reputation scores.
     *
     * Unranked category scores are intentionally excluded.
     */
    overallScore,

    /**
     * Overall level reflects the creator's highest earned
     * category level.
     *
     * This avoids creating a second, unrelated overall-level
     * threshold system.
     */
    overallLevel,

    primaryCityKey,

    calculatedAt,
  }
}

/* =========================================================
 * Primary-city resolution
 * ======================================================= */

function resolvePrimaryCityKey({
  explicitPrimaryCityKey,
  venueEvidence,
}: {
  explicitPrimaryCityKey:
    string | null

  venueEvidence:
    NormalizedVenueEvidence[]
}): string | null {
  const normalizedExplicitCity =
    normalizeSupportedCityKey(
      explicitPrimaryCityKey
    )

  if (
    normalizedExplicitCity
  ) {
    return normalizedExplicitCity
  }

  /**
   * Count distinct verified venues per city.
   *
   * Multiple category assignments for the same venue must not
   * inflate primary-city selection.
   */
  const venueIdsByCity =
    new Map<
      string,
      Set<string>
    >()

  for (
    const evidence of
    venueEvidence
  ) {
    if (
      !evidence.cityKey
    ) {
      continue
    }

    const existingVenueIds =
      venueIdsByCity.get(
        evidence.cityKey
      ) ??
      new Set<string>()

    existingVenueIds.add(
      evidence.venueId
    )

    venueIdsByCity.set(
      evidence.cityKey,
      existingVenueIds
    )
  }

  return [
    ...venueIdsByCity.entries(),
  ]
    .sort(
      (
        [
          firstCity,
          firstVenues,
        ],
        [
          secondCity,
          secondVenues,
        ]
      ) => {
        const countDifference =
          secondVenues.size -
          firstVenues.size

        if (
          countDifference !==
          0
        ) {
          return countDifference
        }

        return firstCity.localeCompare(
          secondCity,
          'en-US',
          {
            sensitivity:
              'base',
          }
        )
      }
    )[0]?.[0] ??
    null
}

/* =========================================================
 * Input normalization
 * ======================================================= */

function normalizeVenueEvidence(
  value:
    readonly CreatorReputationVenueEvidenceInput[] | null
): NormalizedVenueEvidence[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  /**
   * Collapse duplicate venue-category evidence while retaining:
   *
   * - the strongest attribution weight
   * - the most recent valid timestamp
   * - a supported city when available
   */
  const evidenceByKey =
    new Map<
      string,
      NormalizedVenueEvidence
    >()

  for (
    const entry of
    value
  ) {
    if (
      !entry ||
      typeof entry !==
        'object'
    ) {
      continue
    }

    const venueId =
      normalizeIdentifier(
        entry.venueId
      )

    if (
      !venueId ||
      !isReputationCategoryId(
        entry.categoryId
      )
    ) {
      continue
    }

    const categoryId =
      entry.categoryId

    const cityKey =
      normalizeSupportedCityKey(
        entry.cityKey
      )

    const attributionWeight =
      normalizeAttributionWeight(
        entry.attributionWeight
      )

    const occurredAt =
      normalizeTimestamp(
        entry.occurredAt
      )

    const key =
      createEvidenceKey({
        venueId,
        categoryId,
      })

    const existing =
      evidenceByKey.get(
        key
      )

    if (
      !existing
    ) {
      evidenceByKey.set(
        key,
        {
          venueId,
          categoryId,
          cityKey,
          attributionWeight,
          occurredAt,
        }
      )

      continue
    }

    evidenceByKey.set(
      key,
      {
        venueId,
        categoryId,

        cityKey:
          existing.cityKey ??
          cityKey,

        attributionWeight:
          Math.max(
            existing.attributionWeight,
            attributionWeight
          ),

        occurredAt:
          resolveLatestTimestamp(
            existing.occurredAt,
            occurredAt
          ),
      }
    )
  }

  return [
    ...evidenceByKey.values(),
  ].sort(
    (
      first,
      second
    ) =>
      first.categoryId.localeCompare(
        second.categoryId
      ) ||
      first.venueId.localeCompare(
        second.venueId
      )
  )
}

function normalizeCollectionContributions(
  value:
    readonly CreatorReputationCollectionContributionInput[] | null
): NormalizedCollectionContribution[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const contributionsByKey =
    new Map<
      string,
      NormalizedCollectionContribution
    >()

  for (
    const entry of
    value
  ) {
    if (
      !entry ||
      typeof entry !==
        'object'
    ) {
      continue
    }

    const collectionId =
      normalizeIdentifier(
        entry.collectionId
      )

    if (
      !collectionId ||
      !isReputationCategoryId(
        entry.categoryId
      )
    ) {
      continue
    }

    const categoryId =
      entry.categoryId

    const cityKey =
      normalizeSupportedCityKey(
        entry.cityKey
      )

    const venueIds =
      normalizeIdentifierArray(
        entry.venueIds
      )

    const key = [
      collectionId,
      categoryId,
      cityKey ??
        'global',
    ].join(
      ':'
    )

    const existing =
      contributionsByKey.get(
        key
      )

    if (
      !existing
    ) {
      contributionsByKey.set(
        key,
        {
          collectionId,
          categoryId,
          cityKey,
          venueIds,
        }
      )

      continue
    }

    contributionsByKey.set(
      key,
      {
        ...existing,

        venueIds: [
          ...new Set([
            ...existing.venueIds,
            ...venueIds,
          ]),
        ].sort(),
      }
    )
  }

  return [
    ...contributionsByKey.values(),
  ].sort(
    compareCollectionContributions
  )
}

function normalizeSnapshotContributions(
  value:
    readonly CreatorReputationSnapshotContributionInput[] | null
): NormalizedSnapshotContribution[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const contributions =
    new Map<
      string,
      NormalizedSnapshotContribution
    >()

  for (
    const entry of
    value
  ) {
    if (
      !entry ||
      typeof entry !==
        'object'
    ) {
      continue
    }

    const snapshotId =
      normalizeIdentifier(
        entry.snapshotId
      )

    if (
      !snapshotId ||
      !isReputationCategoryId(
        entry.categoryId
      )
    ) {
      continue
    }

    const cityKey =
      normalizeSupportedCityKey(
        entry.cityKey
      )

    const normalized = {
      snapshotId,
      categoryId:
        entry.categoryId,
      cityKey,
    }

    const key = [
      snapshotId,
      entry.categoryId,
      cityKey ??
        'global',
    ].join(
      ':'
    )

    contributions.set(
      key,
      normalized
    )
  }

  return [
    ...contributions.values(),
  ].sort(
    compareSnapshotContributions
  )
}

function normalizeFlowContributions(
  value:
    readonly CreatorReputationFlowContributionInput[] | null
): NormalizedFlowContribution[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const contributions =
    new Map<
      string,
      NormalizedFlowContribution
    >()

  for (
    const entry of
    value
  ) {
    if (
      !entry ||
      typeof entry !==
        'object'
    ) {
      continue
    }

    const flowId =
      normalizeIdentifier(
        entry.flowId
      )

    if (
      !flowId ||
      !isReputationCategoryId(
        entry.categoryId
      )
    ) {
      continue
    }

    const cityKey =
      normalizeSupportedCityKey(
        entry.cityKey
      )

    const normalized = {
      flowId,
      categoryId:
        entry.categoryId,
      cityKey,
    }

    const key = [
      flowId,
      entry.categoryId,
      cityKey ??
        'global',
    ].join(
      ':'
    )

    contributions.set(
      key,
      normalized
    )
  }

  return [
    ...contributions.values(),
  ].sort(
    compareFlowContributions
  )
}

/* =========================================================
 * Accumulator helpers
 * ======================================================= */

function createCategoryAccumulatorMap():
  Map<
    string,
    CategoryAccumulator
  > {
  return new Map()
}

function getOrCreateAccumulator({
  accumulators,
  categoryId,
  cityKey,
}: {
  accumulators:
    Map<
      string,
      CategoryAccumulator
    >

  categoryId:
    ReputationCategoryId

  cityKey:
    string | null
}): CategoryAccumulator {
  const key =
    createAccumulatorKey({
      categoryId,
      cityKey,
    })

  const existing =
    accumulators.get(
      key
    )

  if (
    existing
  ) {
    return existing
  }

  const accumulator:
    CategoryAccumulator = {
    categoryId,
    cityKey,
    venueWeights:
      new Map(),
    venueLatestEvidenceAt:
      new Map(),
    collectionIds:
      new Set(),
    curatedVenueIds:
      new Set(),
    snapshotIds:
      new Set(),
    completedFlowIds:
      new Set(),
    representedCityKeys:
      new Set(),
  }

  accumulators.set(
    key,
    accumulator
  )

  return accumulator
}

function createAccumulatorKey({
  categoryId,
  cityKey,
}: {
  categoryId:
    ReputationCategoryId

  cityKey:
    string | null
}): string {
  return [
    categoryId,
    cityKey ??
      'global',
  ].join(
    ':'
  )
}

function createEvidenceKey({
  venueId,
  categoryId,
}: {
  venueId: string
  categoryId:
    ReputationCategoryId
}): string {
  return [
    venueId,
    categoryId,
  ].join(
    ':'
  )
}

/* =========================================================
 * Timestamp helpers
 * ======================================================= */

function resolveLatestEvidenceAt(
  accumulator:
    CategoryAccumulator
): string | null {
  return [
    ...accumulator
      .venueLatestEvidenceAt
      .values(),
  ].reduce<
    string | null
  >(
    (
      latest,
      candidate
    ) =>
      resolveLatestTimestamp(
        latest,
        candidate
      ),
    null
  )
}

function resolveLatestTimestamp(
  first:
    string | null,
  second:
    string | null
): string | null {
  if (
    !first
  ) {
    return second
  }

  if (
    !second
  ) {
    return first
  }

  return compareTimestamps(
    first,
    second
  ) >=
    0
    ? first
    : second
}

function compareTimestamps(
  first:
    string,
  second:
    string
): number {
  return (
    Date.parse(
      first
    ) -
    Date.parse(
      second
    )
  )
}

/* =========================================================
 * Level helpers
 * ======================================================= */

function resolveHighestLevel(
  levels:
    readonly ReputationLevel[]
): ReputationLevel {
  if (
    levels.length ===
    0
  ) {
    return 'unranked'
  }

  return levels.reduce<
    ReputationLevel
  >(
    (
      highest,
      candidate
    ) => {
      const highestOrder =
        getReputationLevelDefinition(
          highest
        ).sortOrder

      const candidateOrder =
        getReputationLevelDefinition(
          candidate
        ).sortOrder

      return candidateOrder >
        highestOrder
        ? candidate
        : highest
    },
    'unranked'
  )
}

/* =========================================================
 * Sorting helpers
 * ======================================================= */

function compareCategoryReputations(
  first:
    UserCategoryReputation,
  second:
    UserCategoryReputation
): number {
  const categoryComparison =
    getCategoryOrder(
      first.categoryId
    ) -
    getCategoryOrder(
      second.categoryId
    )

  if (
    categoryComparison !==
    0
  ) {
    return categoryComparison
  }

  return (
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
}

function compareCollectionContributions(
  first:
    NormalizedCollectionContribution,
  second:
    NormalizedCollectionContribution
): number {
  return (
    first.categoryId.localeCompare(
      second.categoryId
    ) ||
    (
      first.cityKey ??
      ''
    ).localeCompare(
      second.cityKey ??
      ''
    ) ||
    first.collectionId.localeCompare(
      second.collectionId
    )
  )
}

function compareSnapshotContributions(
  first:
    NormalizedSnapshotContribution,
  second:
    NormalizedSnapshotContribution
): number {
  return (
    first.categoryId.localeCompare(
      second.categoryId
    ) ||
    (
      first.cityKey ??
      ''
    ).localeCompare(
      second.cityKey ??
      ''
    ) ||
    first.snapshotId.localeCompare(
      second.snapshotId
    )
  )
}

function compareFlowContributions(
  first:
    NormalizedFlowContribution,
  second:
    NormalizedFlowContribution
): number {
  return (
    first.categoryId.localeCompare(
      second.categoryId
    ) ||
    (
      first.cityKey ??
      ''
    ).localeCompare(
      second.cityKey ??
      ''
    ) ||
    first.flowId.localeCompare(
      second.flowId
    )
  )
}

function getCategoryOrder(
  categoryId:
    ReputationCategoryId
): number {
  const index =
    REPUTATION_CATEGORY_IDS.indexOf(
      categoryId
    )

  return index >=
    0
    ? index
    : Number.MAX_SAFE_INTEGER
}

/* =========================================================
 * General normalization helpers
 * ======================================================= */

function normalizeSupportedCityKey(
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
    normalizeCityKey(
      value
    )

  return isSupportedCityKey(
    normalized
  )
    ? normalized
    : null
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
    /[\r\n]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeRequiredIdentifier({
  value,
  fieldName,
}: {
  value:
    unknown

  fieldName:
    string
}): string {
  const normalized =
    normalizeIdentifier(
      value
    )

  if (
    !normalized
  ) {
    throw new Error(
      `[calculateCreatorReputation] ${fieldName} must be a valid identifier.`
    )
  }

  return normalized
}

function normalizeIdentifierArray(
  value:
    readonly unknown[] | null | undefined
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  return [
    ...new Set(
      value
        .map(
          normalizeIdentifier
        )
        .filter(
          (
            identifier
          ): identifier is string =>
            identifier !==
            null
        )
    ),
  ].sort()
}

function normalizeAttributionWeight(
  value:
    unknown
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return 1
  }

  return roundToPrecision(
    Math.min(
      1,
      Math.max(
        0,
        value
      )
    ),
    4
  )
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