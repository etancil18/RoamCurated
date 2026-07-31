import {
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  calculateCreatorReputation,
  type CalculateCreatorReputationInput,
  type CreatorReputationCalculationResult,
  type CreatorReputationCollectionContributionInput,
  type CreatorReputationFlowContributionInput,
  type CreatorReputationSnapshotContributionInput,
  type CreatorReputationVenueEvidenceInput,
} from './calculateCreatorReputation'

import {
  REPUTATION_POLICY_VERSION,
} from './policy'

import {
  isReputationCategoryId,
  type ReputationCategoryId,
  type ReputationEvidenceSource,
  type UserCategoryReputation,
} from './types'

import {
  assertValidReputationEvidenceBatch,
} from './validateReputationEvidence'

/**
 * Canonical creator-reputation rebuild service.
 *
 * This module:
 *
 * - uses the Supabase service-role client
 * - loads canonical verified venue visits
 * - expands venues into canonical reputation categories
 * - loads completed Flow contributions
 * - calculates global and city category reputation
 * - upserts canonical creator_reputation_stats rows
 * - removes stale aggregates no longer represented
 *
 * This module intentionally does not:
 *
 * - calculate leaderboard ranks
 * - calculate population statistics
 * - publish percentile claims
 * - expose raw evidence publicly
 * - infer venue categories from venues.type
 * - query viewer-dependent data through browser RLS
 *
 * Venue taxonomy must already be materialized in:
 *
 *   public.venue_reputation_categories
 *
 * Category-population statistics should be rebuilt separately
 * after creator aggregates change.
 */

/* =========================================================
 * Constants
 * ======================================================= */

const DATABASE_BATCH_SIZE =
  250

const MAX_USER_ID_LENGTH =
  200

/* =========================================================
 * Public contracts
 * ======================================================= */

export type RebuildCreatorReputationOptions = {
  /**
   * Stable calculation time for this rebuild.
   *
   * Rebuild jobs processing multiple users should create one
   * timestamp and pass it through each invocation.
   */
  calculatedAt?: string

  /**
   * Optional explicit primary city.
   *
   * When missing or unsupported, the calculator derives the
   * primary city from distinct verified venue evidence.
   */
  primaryCityKey?: string | null

  /**
   * Optional trusted public-collection contribution loader.
   *
   * This remains injectable because collection table schemas
   * vary across Roam surfaces and must not be guessed here.
   */
  loadPublicCollectionContributions?: (
    userId: string
  ) =>
    | Promise<
        readonly CreatorReputationCollectionContributionInput[]
      >
    | readonly CreatorReputationCollectionContributionInput[]

  /**
   * Optional trusted public-snapshot contribution loader.
   */
  loadPublicSnapshotContributions?: (
    userId: string
  ) =>
    | Promise<
        readonly CreatorReputationSnapshotContributionInput[]
      >
    | readonly CreatorReputationSnapshotContributionInput[]

  /**
   * Optional callback after persistence succeeds.
   *
   * This can be used to enqueue or invoke category-population
   * and leaderboard rebuilds without coupling those systems to
   * this module.
   */
  onPersisted?: (
    result: RebuildCreatorReputationResult
  ) => void | Promise<void>
}

export type RebuildCreatorReputationResult = {
  userId: string

  policyVersion: number

  calculation:
    CreatorReputationCalculationResult

  sourceCounts: {
    verifiedVisitRows: number
    distinctVerifiedVenues: number
    venueCategoryAssignments: number
    completedFlows: number
    publicCollectionContributions: number
    publicSnapshotContributions: number
  }

  persistence: {
    upsertedAggregateCount: number
    deletedStaleAggregateCount: number
  }

  rebuiltAt: string
}

/* =========================================================
 * Database row contracts
 * ======================================================= */

type VenueVisitRow = {
  id?: string | null
  venue_id?: string | null
  visited_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  geo_verified?: boolean | null
  check_in_source?: string | null
}

type VenueRow = {
  id?: string | null
  canonical_city?: string | null
  city?: string | null
}

type VenueCategoryAssignmentRow = {
  venue_id?: string | null
  category_id?: string | null
  mapping_weight?: number | string | null
}

type CompletedFlowRow = {
  id?: string | null
  venue_ids?: unknown
  city?: string | null
  completed_at?: string | null
  updated_at?: string | null
}

type ExistingAggregateRow = {
  id?: string | null
  category_id?: string | null
  scope?: string | null
  city_key?: string | null
}

/* =========================================================
 * Main rebuild
 * ======================================================= */

export async function rebuildCreatorReputation(
  userId: string,
  options:
    RebuildCreatorReputationOptions = {}
): Promise<RebuildCreatorReputationResult> {
  const normalizedUserId =
    normalizeRequiredUserId(
      userId
    )

  const rebuiltAt =
    normalizeTimestamp(
      options.calculatedAt
    ) ??
    new Date().toISOString()

  const supabase =
    getSupabaseAdmin()

  const [
    venueVisitsResult,
    completedFlowsResult,
    publicCollectionContributions,
    publicSnapshotContributions,
  ] =
    await Promise.all([
      supabase
        .from(
          'venue_visits'
        )
        .select(`
          id,
          venue_id,
          visited_at,
          created_at,
          updated_at,
          geo_verified,
          check_in_source
        `)
        .eq(
          'user_id',
          normalizedUserId
        )
        .eq(
          'geo_verified',
          true
        ),

      supabase
        .from(
          'active_flow_sessions'
        )
        .select(`
          id,
          venue_ids,
          city,
          completed_at,
          updated_at
        `)
        .eq(
          'user_id',
          normalizedUserId
        )
        .eq(
          'status',
          'completed'
        ),

      loadOptionalContributions({
        userId:
          normalizedUserId,

        loader:
          options
            .loadPublicCollectionContributions,
      }),

      loadOptionalContributions({
        userId:
          normalizedUserId,

        loader:
          options
            .loadPublicSnapshotContributions,
      }),
    ])

  throwIfQueryFailed(
    'venue_visits',
    venueVisitsResult.error
  )

  throwIfQueryFailed(
    'active_flow_sessions',
    completedFlowsResult.error
  )

  const venueVisits =
    normalizeVenueVisitRows(
      venueVisitsResult.data
    )

  const completedFlows =
    normalizeCompletedFlowRows(
      completedFlowsResult.data
    )

  const allVenueIds =
    collectDistinctVenueIds({
      venueVisits,
      completedFlows,
    })

  const [
    venues,
    categoryAssignments,
  ] =
    await Promise.all([
      loadVenuesByIds({
        supabase,
        venueIds:
          allVenueIds,
      }),

      loadVenueCategoryAssignments({
        supabase,
        venueIds:
          allVenueIds,
      }),
    ])

  const venuesById =
    new Map(
      venues.map(
        (
          venue
        ) => [
          venue.id,
          venue,
        ]
      )
    )

  const assignmentsByVenueId =
    groupAssignmentsByVenueId(
      categoryAssignments
    )

  const venueEvidence =
    buildVenueEvidence({
      userId:
        normalizedUserId,

      venueVisits,

      venuesById,

      assignmentsByVenueId,

      rebuiltAt,
    })

  const completedFlowContributions =
    buildCompletedFlowContributions({
      completedFlows,

      venuesById,

      assignmentsByVenueId,
    })

  const calculationInput:
    CalculateCreatorReputationInput = {
    userId:
      normalizedUserId,

    primaryCityKey:
      normalizeSupportedCityKey(
        options.primaryCityKey
      ),

    venueEvidence,

    publicCollectionContributions,

    publicSnapshotContributions,

    completedFlowContributions,

    calculatedAt:
      rebuiltAt,
  }

  const calculation =
    calculateCreatorReputation(
      calculationInput
    )

  const persistence =
    await persistCreatorReputation({
      supabase,

      userId:
        normalizedUserId,

      categoryReputations:
        calculation
          .categoryReputations,

      calculatedAt:
        rebuiltAt,
    })

  const result:
    RebuildCreatorReputationResult = {
    userId:
      normalizedUserId,

    policyVersion:
      REPUTATION_POLICY_VERSION,

    calculation,

    sourceCounts: {
      verifiedVisitRows:
        venueVisits.length,

      distinctVerifiedVenues:
        new Set(
          venueVisits.map(
            (
              visit
            ) =>
              visit.venueId
          )
        ).size,

      venueCategoryAssignments:
        categoryAssignments.length,

      completedFlows:
        completedFlows.length,

      publicCollectionContributions:
        publicCollectionContributions
          .length,

      publicSnapshotContributions:
        publicSnapshotContributions
          .length,
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
 * Canonical venue-evidence construction
 * ======================================================= */

function buildVenueEvidence({
  userId,
  venueVisits,
  venuesById,
  assignmentsByVenueId,
  rebuiltAt,
}: {
  userId: string

  venueVisits:
    NormalizedVenueVisit[]

  venuesById:
    Map<
      string,
      NormalizedVenue
    >

  assignmentsByVenueId:
    Map<
      string,
      NormalizedVenueCategoryAssignment[]
    >

  rebuiltAt: string
}): CreatorReputationVenueEvidenceInput[] {
  const rawEvidence =
    venueVisits.flatMap(
      (
        visit
      ) => {
        const venue =
          venuesById.get(
            visit.venueId
          )

        const assignments =
          assignmentsByVenueId.get(
            visit.venueId
          ) ??
          []

        if (
          !venue ||
          assignments.length ===
            0
        ) {
          return []
        }

        return assignments.map(
          (
            assignment
          ) => ({
            id:
              createEvidenceId({
                venueVisitId:
                  visit.id,

                categoryId:
                  assignment
                    .categoryId,
              }),

            userId,

            venueId:
              visit.venueId,

            categoryId:
              assignment.categoryId,

            cityKey:
              venue.canonicalCity,

            source:
              resolveEvidenceSource(
                visit
                  .checkInSource
              ),

            attributionMethod:
              assignments.length >
              1
                ? 'multi_category'
                : 'direct',

            attributionWeight:
              assignment
                .mappingWeight,

            occurredAt:
              visit.visitedAt,

            venueVisitId:
              visit.id,

            createdAt:
              visit.createdAt ??
              visit.visitedAt,

            updatedAt:
              resolveLatestTimestamp([
                visit.updatedAt,
                visit.createdAt,
                visit.visitedAt,
                rebuiltAt,
              ]) ??
              rebuiltAt,
          })
        )
      }
    )

  /**
   * Validation is deliberately applied before the pure
   * calculator.
   *
   * Malformed evidence aborts the rebuild rather than silently
   * contaminating reputation aggregates.
   */
  const validatedEvidence =
    assertValidReputationEvidenceBatch(
      rawEvidence,
      {
        now:
          new Date(
            rebuiltAt
          ),

        path:
          'venueEvidence',
      }
    )

  return validatedEvidence.map(
    (
      evidence
    ) => ({
      venueId:
        evidence.venueId,

      categoryId:
        evidence.categoryId,

      cityKey:
        evidence.cityKey,

      attributionWeight:
        evidence
          .attributionWeight,

      occurredAt:
        evidence.occurredAt,
    })
  )
}

/* =========================================================
 * Completed-Flow contributions
 * ======================================================= */

function buildCompletedFlowContributions({
  completedFlows,
  venuesById,
  assignmentsByVenueId,
}: {
  completedFlows:
    NormalizedCompletedFlow[]

  venuesById:
    Map<
      string,
      NormalizedVenue
    >

  assignmentsByVenueId:
    Map<
      string,
      NormalizedVenueCategoryAssignment[]
    >
}): CreatorReputationFlowContributionInput[] {
  const contributions =
    new Map<
      string,
      CreatorReputationFlowContributionInput
    >()

  for (
    const flow of
    completedFlows
  ) {
    const categoryIds =
      new Set<
        ReputationCategoryId
      >()

    const cityVenueCounts =
      new Map<
        string,
        number
      >()

    for (
      const venueId of
      flow.venueIds
    ) {
      const venue =
        venuesById.get(
          venueId
        )

      const assignments =
        assignmentsByVenueId.get(
          venueId
        ) ??
        []

      for (
        const assignment of
        assignments
      ) {
        categoryIds.add(
          assignment.categoryId
        )
      }

      if (
        venue?.canonicalCity
      ) {
        cityVenueCounts.set(
          venue.canonicalCity,
          (
            cityVenueCounts.get(
              venue.canonicalCity
            ) ??
            0
          ) + 1
        )
      }
    }

    const resolvedFlowCity =
      normalizeSupportedCityKey(
        flow.city
      ) ??
      selectDominantCity(
        cityVenueCounts
      )

    for (
      const categoryId of
      categoryIds
    ) {
      const globalKey = [
        flow.id,
        categoryId,
        'global',
      ].join(
        ':'
      )

      contributions.set(
        globalKey,
        {
          flowId:
            flow.id,

          categoryId,

          cityKey:
            null,
        }
      )

      if (
        resolvedFlowCity
      ) {
        const cityKey = [
          flow.id,
          categoryId,
          resolvedFlowCity,
        ].join(
          ':'
        )

        contributions.set(
          cityKey,
          {
            flowId:
              flow.id,

            categoryId,

            cityKey:
              resolvedFlowCity,
          }
        )
      }
    }
  }

  return [
    ...contributions.values(),
  ].sort(
    (
      first,
      second
    ) =>
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

/* =========================================================
 * Aggregate persistence
 * ======================================================= */

async function persistCreatorReputation({
  supabase,
  userId,
  categoryReputations,
  calculatedAt,
}: {
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >

  userId: string

  categoryReputations:
    UserCategoryReputation[]

  calculatedAt: string
}): Promise<{
  upsertedAggregateCount: number
  deletedStaleAggregateCount: number
}> {
  const rows =
    categoryReputations.map(
      (
        reputation
      ) =>
        createAggregatePersistenceRow({
          reputation,
          calculatedAt,
        })
    )

  /**
   * Upsert current rows before deleting stale rows.
   *
   * This ordering prevents a transient calculation or database
   * error from erasing valid existing reputation data.
   */
  if (
    rows.length >
    0
  ) {
    for (
      const batch of
      chunkArray(
        rows,
        DATABASE_BATCH_SIZE
      )
    ) {
      const {
        error,
      } =
        await supabase
          .from(
            'creator_reputation_stats'
          )
          .upsert(
            batch as any,
            {
              onConflict:
                'user_id,category_id,scope,scope_city_key',
            }
          )

      throwIfQueryFailed(
        'creator_reputation_stats upsert',
        error
      )
    }
  }

  const {
    data:
      existingRowsData,
    error:
      existingRowsError,
  } =
    await supabase
      .from(
        'creator_reputation_stats'
      )
      .select(`
        id,
        category_id,
        scope,
        city_key
      `)
      .eq(
        'user_id',
        userId
      )

  throwIfQueryFailed(
    'creator_reputation_stats stale-row lookup',
    existingRowsError
  )

  const existingRows =
    normalizeExistingAggregateRows(
      existingRowsData
    )

  const currentIdentityKeys =
    new Set(
      categoryReputations.map(
        createAggregateIdentityKey
      )
    )

  const staleIds =
    existingRows
      .filter(
        (
          row
        ) =>
          !currentIdentityKeys.has(
            createAggregateIdentityKey({
              categoryId:
                row.categoryId,

              scope:
                row.scope,

              cityKey:
                row.cityKey,
            })
          )
      )
      .map(
        (
          row
        ) =>
          row.id
      )

  let deletedStaleAggregateCount =
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
          'creator_reputation_stats'
        )
        .delete({
          count:
            'exact',
        })
        .in(
          'id',
          batch
        )
        .eq(
          'user_id',
          userId
        )

    throwIfQueryFailed(
      'creator_reputation_stats stale-row deletion',
      error
    )

    deletedStaleAggregateCount +=
      count ??
      batch.length
  }

  return {
    upsertedAggregateCount:
      rows.length,

    deletedStaleAggregateCount,
  }
}

function createAggregatePersistenceRow({
  reputation,
  calculatedAt,
}: {
  reputation:
    UserCategoryReputation

  calculatedAt:
    string
}) {
  return {
    user_id:
      reputation.userId,

    category_id:
      reputation.categoryId,

    scope:
      reputation.scope,

    city_key:
      reputation.scope ===
      'city'
        ? reputation.cityKey
        : null,

    verified_venue_count:
      reputation
        .components
        .verifiedVenueCount,

    weighted_venue_count:
      reputation
        .components
        .weightedVenueCount,

    city_count:
      reputation
        .components
        .cityCount,

    public_collection_count:
      reputation
        .components
        .publicCollectionCount,

    curated_venue_count:
      reputation
        .components
        .curatedVenueCount,

    public_snapshot_count:
      reputation
        .components
        .publicSnapshotCount,

    completed_flow_count:
      reputation
        .components
        .completedFlowCount,

    recency_score:
      reputation
        .components
        .recencyScore,

    quality_score:
      reputation
        .components
        .qualityScore,

    reputation_score:
      reputation.score,

    reputation_level:
      reputation.level,

    policy_version:
      REPUTATION_POLICY_VERSION,

    latest_evidence_at:
      reputation
        .latestEvidenceAt,

    calculated_at:
      calculatedAt,

    updated_at:
      calculatedAt,
  }
}

/* =========================================================
 * Database loading
 * ======================================================= */

async function loadVenuesByIds({
  supabase,
  venueIds,
}: {
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >

  venueIds:
    string[]
}): Promise<
  NormalizedVenue[]
> {
  if (
    venueIds.length ===
    0
  ) {
    return []
  }

  const rows:
    VenueRow[] = []

  for (
    const batch of
    chunkArray(
      venueIds,
      DATABASE_BATCH_SIZE
    )
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'venues'
        )
        .select(`
          id,
          canonical_city,
          city
        `)
        .in(
          'id',
          batch
        )

    throwIfQueryFailed(
      'venues reputation lookup',
      error
    )

    rows.push(
      ...(
        Array.isArray(
          data
        )
          ? data as VenueRow[]
          : []
      )
    )
  }

  return normalizeVenueRows(
    rows
  )
}

async function loadVenueCategoryAssignments({
  supabase,
  venueIds,
}: {
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >

  venueIds:
    string[]
}): Promise<
  NormalizedVenueCategoryAssignment[]
> {
  if (
    venueIds.length ===
    0
  ) {
    return []
  }

  const rows:
    VenueCategoryAssignmentRow[] =
    []

  for (
    const batch of
    chunkArray(
      venueIds,
      DATABASE_BATCH_SIZE
    )
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'venue_reputation_categories'
        )
        .select(`
          venue_id,
          category_id,
          mapping_weight
        `)
        .in(
          'venue_id',
          batch
        )

    throwIfQueryFailed(
      'venue_reputation_categories',
      error
    )

    rows.push(
      ...(
        Array.isArray(
          data
        )
          ? data as VenueCategoryAssignmentRow[]
          : []
      )
    )
  }

  return normalizeVenueCategoryAssignments(
    rows
  )
}

/* =========================================================
 * Normalized internal models
 * ======================================================= */

type NormalizedVenueVisit = {
  id: string
  venueId: string
  visitedAt: string
  createdAt: string | null
  updatedAt: string | null
  checkInSource: string | null
}

type NormalizedVenue = {
  id: string
  canonicalCity: string | null
}

type NormalizedVenueCategoryAssignment = {
  venueId: string
  categoryId: ReputationCategoryId
  mappingWeight: number
}

type NormalizedCompletedFlow = {
  id: string
  venueIds: string[]
  city: string | null
  completedAt: string | null
  updatedAt: string | null
}

type NormalizedExistingAggregate = {
  id: string
  categoryId: ReputationCategoryId
  scope: 'global' | 'city'
  cityKey: string | null
}

/* =========================================================
 * Row normalization
 * ======================================================= */

function normalizeVenueVisitRows(
  value:
    unknown
): NormalizedVenueVisit[] {
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
        NormalizedVenueVisit | null => {
        const row =
          raw as VenueVisitRow

        const id =
          normalizeIdentifier(
            row.id
          )

        const venueId =
          normalizeIdentifier(
            row.venue_id
          )

        const visitedAt =
          normalizeTimestamp(
            row.visited_at
          )

        if (
          !id ||
          !venueId ||
          !visitedAt ||
          row.geo_verified !==
            true
        ) {
          return null
        }

        return {
          id,
          venueId,
          visitedAt,

          createdAt:
            normalizeTimestamp(
              row.created_at
            ),

          updatedAt:
            normalizeTimestamp(
              row.updated_at
            ),

          checkInSource:
            normalizeNullableText(
              row.check_in_source
            ),
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedVenueVisit =>
        row !==
        null
    )
    .sort(
      (
        first,
        second
      ) =>
        first.venueId.localeCompare(
          second.venueId
        ) ||
        Date.parse(
          first.visitedAt
        ) -
          Date.parse(
            second.visitedAt
          )
    )
}

function normalizeVenueRows(
  value:
    VenueRow[]
): NormalizedVenue[] {
  return value
    .map(
      (
        row
      ):
        NormalizedVenue | null => {
        const id =
          normalizeIdentifier(
            row.id
          )

        if (
          !id
        ) {
          return null
        }

        return {
          id,

          canonicalCity:
            normalizeSupportedCityKey(
              row.canonical_city
            ) ??
            normalizeSupportedCityKey(
              row.city
            ),
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedVenue =>
        row !==
        null
    )
}

function normalizeVenueCategoryAssignments(
  value:
    VenueCategoryAssignmentRow[]
): NormalizedVenueCategoryAssignment[] {
  const assignments =
    new Map<
      string,
      NormalizedVenueCategoryAssignment
    >()

  for (
    const row of
    value
  ) {
    const venueId =
      normalizeIdentifier(
        row.venue_id
      )

    const categoryId =
      row.category_id

    const mappingWeight =
      normalizeWeight(
        row.mapping_weight
      )

    if (
      !venueId ||
      !isReputationCategoryId(
        categoryId
      ) ||
      mappingWeight ===
        null
    ) {
      continue
    }

    const key = [
      venueId,
      categoryId,
    ].join(
      ':'
    )

    const existing =
      assignments.get(
        key
      )

    if (
      !existing ||
      mappingWeight >
        existing.mappingWeight
    ) {
      assignments.set(
        key,
        {
          venueId,
          categoryId,
          mappingWeight,
        }
      )
    }
  }

  return [
    ...assignments.values(),
  ].sort(
    (
      first,
      second
    ) =>
      first.venueId.localeCompare(
        second.venueId
      ) ||
      first.categoryId.localeCompare(
        second.categoryId
      )
  )
}

function normalizeCompletedFlowRows(
  value:
    unknown
): NormalizedCompletedFlow[] {
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
        NormalizedCompletedFlow | null => {
        const row =
          raw as CompletedFlowRow

        const id =
          normalizeIdentifier(
            row.id
          )

        if (
          !id
        ) {
          return null
        }

        return {
          id,

          venueIds:
            normalizeIdentifierArray(
              row.venue_ids
            ),

          city:
            normalizeNullableText(
              row.city
            ),

          completedAt:
            normalizeTimestamp(
              row.completed_at
            ),

          updatedAt:
            normalizeTimestamp(
              row.updated_at
            ),
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedCompletedFlow =>
        row !==
        null
    )
}

function normalizeExistingAggregateRows(
  value:
    unknown
): NormalizedExistingAggregate[] {
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
        NormalizedExistingAggregate | null => {
        const row =
          raw as ExistingAggregateRow

        const id =
          normalizeIdentifier(
            row.id
          )

        const categoryId =
          row.category_id

        const scope =
          row.scope

        if (
          !id ||
          !isReputationCategoryId(
            categoryId
          ) ||
          (
            scope !==
              'global' &&
            scope !==
              'city'
          )
        ) {
          return null
        }

        return {
          id,
          categoryId,
          scope,

          cityKey:
            scope ===
            'city'
              ? normalizeSupportedCityKey(
                  row.city_key
                )
              : null,
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedExistingAggregate =>
        row !==
        null
    )
}

/* =========================================================
 * Grouping and identity helpers
 * ======================================================= */

function groupAssignmentsByVenueId(
  assignments:
    NormalizedVenueCategoryAssignment[]
): Map<
  string,
  NormalizedVenueCategoryAssignment[]
> {
  const result =
    new Map<
      string,
      NormalizedVenueCategoryAssignment[]
    >()

  for (
    const assignment of
    assignments
  ) {
    const existing =
      result.get(
        assignment.venueId
      ) ??
      []

    existing.push(
      assignment
    )

    result.set(
      assignment.venueId,
      existing
    )
  }

  return result
}

function collectDistinctVenueIds({
  venueVisits,
  completedFlows,
}: {
  venueVisits:
    NormalizedVenueVisit[]

  completedFlows:
    NormalizedCompletedFlow[]
}): string[] {
  return [
    ...new Set([
      ...venueVisits.map(
        (
          visit
        ) =>
          visit.venueId
      ),

      ...completedFlows.flatMap(
        (
          flow
        ) =>
          flow.venueIds
      ),
    ]),
  ].sort()
}

function createAggregateIdentityKey(
  value: {
    categoryId:
      ReputationCategoryId

    scope:
      'global' | 'city'

    cityKey:
      string | null
  }
): string {
  return [
    value.categoryId,
    value.scope,
    value.scope ===
    'city'
      ? value.cityKey ??
        '__missing_city__'
      : '__global__',
  ].join(
    ':'
  )
}

function createEvidenceId({
  venueVisitId,
  categoryId,
}: {
  venueVisitId: string
  categoryId:
    ReputationCategoryId
}): string {
  return [
    venueVisitId,
    categoryId,
  ].join(
    ':'
  )
}

/* =========================================================
 * Source resolution
 * ======================================================= */

function resolveEvidenceSource(
  value:
    string | null
): ReputationEvidenceSource {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        '_'
      ) ??
    ''

  if (
    normalized.includes(
      'active_flow'
    )
  ) {
    return 'active_flow'
  }

  if (
    normalized.includes(
      'event'
    )
  ) {
    return 'event_checkin'
  }

  if (
    normalized.includes(
      'crawl'
    )
  ) {
    return 'crawl_checkin'
  }

  if (
    normalized.includes(
      'backfill'
    ) ||
    normalized.includes(
      'admin'
    )
  ) {
    return 'administrative_backfill'
  }

  if (
    normalized ===
      'geo' ||
    normalized ===
      'venue_visit'
  ) {
    return 'venue_visit'
  }

  return 'unknown'
}

/* =========================================================
 * Optional source loading
 * ======================================================= */

async function loadOptionalContributions<
  T,
>({
  userId,
  loader,
}: {
  userId: string

  loader?:
    (
      userId: string
    ) =>
      | Promise<
          readonly T[]
        >
      | readonly T[]
}): Promise<T[]> {
  if (
    !loader
  ) {
    return []
  }

  const result =
    await loader(
      userId
    )

  return Array.isArray(
    result
  )
    ? [
        ...result,
      ]
    : []
}

/* =========================================================
 * General helpers
 * ======================================================= */

function normalizeRequiredUserId(
  value:
    unknown
): string {
  const normalized =
    normalizeIdentifier(
      value
    )

  if (
    !normalized ||
    normalized.length >
      MAX_USER_ID_LENGTH
  ) {
    throw new Error(
      '[rebuildCreatorReputation] A valid userId is required.'
    )
  }

  return normalized
}

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
    /[\r\n\t\0]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeIdentifierArray(
  value:
    unknown
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

function resolveLatestTimestamp(
  values:
    Array<
      string | null
    >
): string | null {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        !Number.isNaN(
          Date.parse(
            value
          )
        )
    )
    .sort(
      (
        first,
        second
      ) =>
        Date.parse(
          second
        ) -
        Date.parse(
          first
        )
    )[0] ??
    null
}

function normalizeWeight(
  value:
    unknown
): number | null {
  const parsed =
    typeof value ===
      'number'
      ? value
      : typeof value ===
          'string'
        ? Number(
            value
          )
        : Number.NaN

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <=
      0 ||
    parsed >
      1
  ) {
    return null
  }

  return Math.round(
    parsed *
      10000
  ) /
    10000
}

function selectDominantCity(
  counts:
    Map<
      string,
      number
    >
): string | null {
  return [
    ...counts.entries(),
  ]
    .sort(
      (
        [
          firstCity,
          firstCount,
        ],
        [
          secondCity,
          secondCount,
        ]
      ) =>
        secondCount -
          firstCount ||
        firstCity.localeCompare(
          secondCity,
          'en-US',
          {
            sensitivity:
              'base',
          }
        )
    )[0]?.[0] ??
    null
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
    `[rebuildCreatorReputation] ${queryName} failed: ${details}`
  )
}