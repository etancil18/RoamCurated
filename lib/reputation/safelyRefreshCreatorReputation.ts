import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin'

import {
  rebuildCreatorReputation,
  type RebuildCreatorReputationOptions,
  type RebuildCreatorReputationResult,
} from './rebuildCreatorReputation'

import {
  rebuildReputationRankings,
  type RebuildReputationRankingsResult,
} from './rebuildReputationRankings'

import {
  isReputationCategoryId,
  isReputationScope,
  type ReputationCategoryId,
  type ReputationScope,
} from './types'

/**
 * Safe creator-reputation refresh boundary.
 *
 * This helper is intended for trusted server-side mutation
 * paths such as:
 *
 * - verified venue check-ins
 * - active Flow check-ins
 * - event check-ins
 * - completed Flow mutations
 * - collection publication changes
 * - public snapshot changes
 *
 * The primary mutation remains authoritative.
 *
 * Reputation refresh failures are:
 *
 * - logged
 * - returned as structured diagnostics
 * - never allowed to invalidate the successful user action
 *
 * This module also:
 *
 * - coalesces concurrent refreshes for the same user
 * - rebuilds the creator before rebuilding rankings
 * - refreshes both old and new affected populations
 * - avoids a full platform ranking rebuild by default
 */

/* =========================================================
 * Public configuration
 * ======================================================= */

export const REPUTATION_RANKING_REFRESH_MODES = [
  'none',
  'affected',
  'all',
] as const

export type ReputationRankingRefreshMode =
  (typeof REPUTATION_RANKING_REFRESH_MODES)[number]

export type CreatorReputationRefreshLogger = {
  info?: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void

  warn?: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void

  error?: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void
}

export type SafelyRefreshCreatorReputationOptions = {
  /**
   * Diagnostic mutation identifier.
   *
   * Examples:
   *
   *   active_flow_check_in
   *   event_check_in
   *   venue_visit
   *   flow_completion
   */
  mutation?: string

  /**
   * Defaults to `affected`.
   *
   * none:
   *   Rebuild only creator_reputation_stats.
   *
   * affected:
   *   Rebuild only category populations that existed before or
   *   after this creator rebuild.
   *
   * all:
   *   Rebuild every ranking population.
   */
  rankingRefreshMode?: ReputationRankingRefreshMode

  /**
   * Stable calculation time shared across creator and ranking
   * rebuilds.
   */
  calculatedAt?: string

  /**
   * Optional explicit primary city supplied to the canonical
   * creator calculator.
   */
  primaryCityKey?: string | null

  /**
   * Optional trusted contribution loaders.
   */
  loadPublicCollectionContributions?:
    RebuildCreatorReputationOptions[
      'loadPublicCollectionContributions'
    ]

  loadPublicSnapshotContributions?:
    RebuildCreatorReputationOptions[
      'loadPublicSnapshotContributions'
    ]

  /**
   * Optional structured logger.
   *
   * Defaults to console logging.
   */
  logger?: CreatorReputationRefreshLogger

  /**
   * Coalesces simultaneous refresh calls for the same user.
   *
   * Defaults to true.
   */
  coalesceConcurrentRefreshes?: boolean
}

/* =========================================================
 * Public results
 * ======================================================= */

export type ReputationPopulationIdentity = {
  categoryId: ReputationCategoryId
  scope: ReputationScope
  cityKey: string | null
}

export type ReputationRankingRefreshFailure = {
  population: ReputationPopulationIdentity | null
  message: string
}

export type ReputationRankingRefreshSummary = {
  mode: ReputationRankingRefreshMode

  attemptedPopulationCount: number
  successfulPopulationCount: number
  failedPopulationCount: number

  failures: ReputationRankingRefreshFailure[]

  /**
   * Full ranking rebuild result when mode is `all`.
   */
  fullRebuild: RebuildReputationRankingsResult | null
}

export type SafeCreatorReputationRefreshSuccess = {
  ok: true

  userId: string
  mutation: string

  creatorReputation:
    RebuildCreatorReputationResult

  rankings:
    ReputationRankingRefreshSummary

  startedAt: string
  completedAt: string
  durationMilliseconds: number

  /**
   * True when this caller reused a refresh already running for
   * the same user.
   */
  coalesced: boolean
}

export type SafeCreatorReputationRefreshFailure = {
  ok: false

  userId: string | null
  mutation: string

  creatorReputation: null

  rankings:
    ReputationRankingRefreshSummary

  error: {
    stage:
      | 'validation'
      | 'existing-populations'
      | 'creator-rebuild'

    message: string
  }

  startedAt: string
  completedAt: string
  durationMilliseconds: number

  coalesced: boolean
}

export type SafeCreatorReputationRefreshResult =
  | SafeCreatorReputationRefreshSuccess
  | SafeCreatorReputationRefreshFailure

/* =========================================================
 * Internal contracts
 * ======================================================= */

type CreatorReputationIdentityRow = {
  category_id?: string | null
  scope?: string | null
  city_key?: string | null
}

type RefreshExecutionOptions =
  SafelyRefreshCreatorReputationOptions & {
    normalizedUserId: string
    mutation: string
    rankingRefreshMode: ReputationRankingRefreshMode
    calculatedAt: string
    logger: Required<CreatorReputationRefreshLogger>
  }

/* =========================================================
 * Concurrent-refresh coalescing
 * ======================================================= */

/**
 * This map prevents multiple concurrent mutation requests in the
 * same server process from racing the same user's stale-row
 * cleanup and ranking rebuild.
 *
 * In serverless environments this is process-local, not a
 * distributed lock. Database uniqueness constraints remain the
 * final integrity boundary.
 */
const refreshesInFlight =
  new Map<
    string,
    Promise<SafeCreatorReputationRefreshResult>
  >()

/* =========================================================
 * Public API
 * ======================================================= */

/**
 * Safely refreshes canonical creator reputation.
 *
 * This function never throws.
 */
export async function safelyRefreshCreatorReputation(
  userId: string,
  options: SafelyRefreshCreatorReputationOptions = {}
): Promise<SafeCreatorReputationRefreshResult> {
  const startedAtDate =
    new Date()

  const startedAt =
    startedAtDate.toISOString()

  const mutation =
    normalizeMutation(
      options.mutation
    )

  const logger =
    resolveLogger(
      options.logger
    )

  const normalizedUserId =
    normalizeUserId(
      userId
    )

  if (
    !normalizedUserId
  ) {
    const completedAtDate =
      new Date()

    const result:
      SafeCreatorReputationRefreshFailure = {
      ok: false,

      userId: null,

      mutation,

      creatorReputation: null,

      rankings:
        createEmptyRankingSummary(
          normalizeRankingRefreshMode(
            options.rankingRefreshMode
          )
        ),

      error: {
        stage: 'validation',
        message:
          'A valid userId is required to refresh creator reputation.',
      },

      startedAt,
      completedAt:
        completedAtDate.toISOString(),

      durationMilliseconds:
        Math.max(
          0,
          completedAtDate.getTime() -
            startedAtDate.getTime()
        ),

      coalesced: false,
    }

    logger.error(
      '[creator reputation] Refresh rejected because userId was invalid.',
      {
        mutation,
      }
    )

    return result
  }

  const coalesceConcurrentRefreshes =
    options.coalesceConcurrentRefreshes !==
    false

  if (
    coalesceConcurrentRefreshes
  ) {
    const existingRefresh =
      refreshesInFlight.get(
        normalizedUserId
      )

    if (
      existingRefresh
    ) {
      logger.info(
        '[creator reputation] Reusing an in-flight refresh.',
        {
          userId:
            normalizedUserId,

          mutation,
        }
      )

      const existingResult =
        await existingRefresh

      return {
        ...existingResult,
        coalesced: true,
      }
    }
  }

  const executionOptions:
    RefreshExecutionOptions = {
    ...options,

    normalizedUserId,

    mutation,

    rankingRefreshMode:
      normalizeRankingRefreshMode(
        options.rankingRefreshMode
      ),

    calculatedAt:
      normalizeTimestamp(
        options.calculatedAt
      ) ??
      new Date().toISOString(),

    logger,
  }

  const refreshPromise =
    executeRefresh({
      options:
        executionOptions,

      startedAtDate,
    })

  if (
    coalesceConcurrentRefreshes
  ) {
    refreshesInFlight.set(
      normalizedUserId,
      refreshPromise
    )
  }

  try {
    return await refreshPromise
  } finally {
    if (
      coalesceConcurrentRefreshes &&
      refreshesInFlight.get(
        normalizedUserId
      ) === refreshPromise
    ) {
      refreshesInFlight.delete(
        normalizedUserId
      )
    }
  }
}

/**
 * Fire-and-forget convenience boundary for mutation routes.
 *
 * The returned promise is intentionally consumed, and failures
 * are already handled by safelyRefreshCreatorReputation().
 */
export function queueCreatorReputationRefresh(
  userId: string,
  options: SafelyRefreshCreatorReputationOptions = {}
): void {
  void safelyRefreshCreatorReputation(
    userId,
    options
  )
}

/* =========================================================
 * Refresh execution
 * ======================================================= */

async function executeRefresh({
  options,
  startedAtDate,
}: {
  options: RefreshExecutionOptions
  startedAtDate: Date
}): Promise<SafeCreatorReputationRefreshResult> {
  const {
    normalizedUserId:
      userId,

    mutation,

    rankingRefreshMode,

    calculatedAt,

    logger,
  } =
    options

  logger.info(
    '[creator reputation] Refresh started.',
    {
      userId,
      mutation,
      rankingRefreshMode,
      calculatedAt,
    }
  )

  let previousPopulations:
    ReputationPopulationIdentity[] =
    []

  if (
    rankingRefreshMode ===
    'affected'
  ) {
    try {
      previousPopulations =
        await loadExistingPopulationIdentities(
          userId
        )
    } catch (
      error
    ) {
      const completedAtDate =
        new Date()

      const message =
        formatUnknownError(
          error
        )

      logger.error(
        '[creator reputation] Failed to load existing population identities.',
        {
          userId,
          mutation,
          message,
        }
      )

      return {
        ok: false,

        userId,

        mutation,

        creatorReputation: null,

        rankings:
          createEmptyRankingSummary(
            rankingRefreshMode
          ),

        error: {
          stage:
            'existing-populations',

          message,
        },

        startedAt:
          startedAtDate.toISOString(),

        completedAt:
          completedAtDate.toISOString(),

        durationMilliseconds:
          Math.max(
            0,
            completedAtDate.getTime() -
              startedAtDate.getTime()
          ),

        coalesced: false,
      }
    }
  }

  let creatorReputation:
    RebuildCreatorReputationResult

  try {
    creatorReputation =
      await rebuildCreatorReputation(
        userId,
        {
          calculatedAt,

          primaryCityKey:
            options.primaryCityKey,

          loadPublicCollectionContributions:
            options
              .loadPublicCollectionContributions,

          loadPublicSnapshotContributions:
            options
              .loadPublicSnapshotContributions,
        }
      )
  } catch (
    error
  ) {
    const completedAtDate =
      new Date()

    const message =
      formatUnknownError(
        error
      )

    logger.error(
      '[creator reputation] Creator rebuild failed.',
      {
        userId,
        mutation,
        message,
      }
    )

    return {
      ok: false,

      userId,

      mutation,

      creatorReputation: null,

      rankings:
        createEmptyRankingSummary(
          rankingRefreshMode
        ),

      error: {
        stage:
          'creator-rebuild',

        message,
      },

      startedAt:
        startedAtDate.toISOString(),

      completedAt:
        completedAtDate.toISOString(),

      durationMilliseconds:
        Math.max(
          0,
          completedAtDate.getTime() -
            startedAtDate.getTime()
        ),

      coalesced: false,
    }
  }

  const currentPopulations =
    getCalculationPopulationIdentities(
      creatorReputation
    )

  const affectedPopulations =
    deduplicatePopulationIdentities([
      ...previousPopulations,
      ...currentPopulations,
    ])

  const rankings =
    await safelyRefreshRankings({
      mode:
        rankingRefreshMode,

      policyVersion:
        creatorReputation
          .policyVersion,

      calculatedAt,

      affectedPopulations,

      logger,

      userId,

      mutation,
    })

  const completedAtDate =
    new Date()

  const result:
    SafeCreatorReputationRefreshSuccess = {
    ok: true,

    userId,

    mutation,

    creatorReputation,

    rankings,

    startedAt:
      startedAtDate.toISOString(),

    completedAt:
      completedAtDate.toISOString(),

    durationMilliseconds:
      Math.max(
        0,
        completedAtDate.getTime() -
          startedAtDate.getTime()
      ),

    coalesced: false,
  }

  if (
    rankings.failedPopulationCount >
    0
  ) {
    logger.warn(
      '[creator reputation] Creator rebuild succeeded, but one or more ranking refreshes failed.',
      {
        userId,
        mutation,

        failedPopulationCount:
          rankings
            .failedPopulationCount,
      }
    )
  } else {
    logger.info(
      '[creator reputation] Refresh completed.',
      {
        userId,
        mutation,

        aggregateCount:
          creatorReputation
            .persistence
            .upsertedAggregateCount,

        rankingPopulationCount:
          rankings
            .successfulPopulationCount,

        durationMilliseconds:
          result.durationMilliseconds,
      }
    )
  }

  return result
}

/* =========================================================
 * Safe ranking refresh
 * ======================================================= */

async function safelyRefreshRankings({
  mode,
  policyVersion,
  calculatedAt,
  affectedPopulations,
  logger,
  userId,
  mutation,
}: {
  mode: ReputationRankingRefreshMode
  policyVersion: number
  calculatedAt: string

  affectedPopulations:
    ReputationPopulationIdentity[]

  logger:
    Required<CreatorReputationRefreshLogger>

  userId: string
  mutation: string
}): Promise<ReputationRankingRefreshSummary> {
  if (
    mode ===
    'none'
  ) {
    return createEmptyRankingSummary(
      mode
    )
  }

  if (
    mode ===
    'all'
  ) {
    try {
      const fullRebuild =
        await rebuildReputationRankings({
          policyVersion,
          calculatedAt,
        })

      return {
        mode,

        attemptedPopulationCount:
          fullRebuild
            .sourceCounts
            .representedPopulations,

        successfulPopulationCount:
          fullRebuild
            .sourceCounts
            .representedPopulations,

        failedPopulationCount:
          0,

        failures: [],

        fullRebuild,
      }
    } catch (
      error
    ) {
      const message =
        formatUnknownError(
          error
        )

      logger.error(
        '[creator reputation] Full ranking refresh failed.',
        {
          userId,
          mutation,
          message,
        }
      )

      return {
        mode,

        attemptedPopulationCount:
          1,

        successfulPopulationCount:
          0,

        failedPopulationCount:
          1,

        failures: [
          {
            population:
              null,

            message,
          },
        ],

        fullRebuild:
          null,
      }
    }
  }

  const failures:
    ReputationRankingRefreshFailure[] =
    []

  let successfulPopulationCount =
    0

  /**
   * Run targeted refreshes sequentially.
   *
   * A single creator normally affects a small number of
   * category populations. Sequential execution avoids
   * overlapping stale-row deletion queries against the same
   * population-stat table.
   */
  for (
    const population of
    affectedPopulations
  ) {
    try {
      await rebuildReputationRankings({
        policyVersion,

        categoryId:
          population.categoryId,

        scope:
          population.scope,

        cityKey:
          population.scope ===
          'city'
            ? population.cityKey
            : null,

        calculatedAt,
      })

      successfulPopulationCount +=
        1
    } catch (
      error
    ) {
      const message =
        formatUnknownError(
          error
        )

      failures.push({
        population,
        message,
      })

      logger.error(
        '[creator reputation] Affected ranking population refresh failed.',
        {
          userId,
          mutation,

          categoryId:
            population.categoryId,

          scope:
            population.scope,

          cityKey:
            population.cityKey,

          message,
        }
      )
    }
  }

  return {
    mode,

    attemptedPopulationCount:
      affectedPopulations.length,

    successfulPopulationCount,

    failedPopulationCount:
      failures.length,

    failures,

    fullRebuild:
      null,
  }
}

/* =========================================================
 * Existing population loading
 * ======================================================= */

async function loadExistingPopulationIdentities(
  userId: string
): Promise<
  ReputationPopulationIdentity[]
> {
  const supabase =
    getSupabaseAdmin()

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'creator_reputation_stats'
      )
      .select(`
        category_id,
        scope,
        city_key
      `)
      .eq(
        'user_id',
        userId
      )

  if (
    error
  ) {
    throw new Error(
      [
        '[safelyRefreshCreatorReputation]',
        'Failed to load existing reputation populations.',
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
    )
  }

  if (
    !Array.isArray(
      data
    )
  ) {
    return []
  }

  return deduplicatePopulationIdentities(
    data
      .map(
        (
          raw
        ):
          | ReputationPopulationIdentity
          | null => {
          const row =
            raw as CreatorReputationIdentityRow

          const categoryId =
            row.category_id

          const scope =
            row.scope

          if (
            !isReputationCategoryId(
              categoryId
            ) ||
            !isReputationScope(
              scope
            )
          ) {
            return null
          }

          const cityKey =
            scope ===
            'city'
              ? normalizeNullableText(
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
            categoryId,
            scope,
            cityKey,
          }
        }
      )
      .filter(
        (
          value
        ): value is ReputationPopulationIdentity =>
          value !==
          null
      )
  )
}

/* =========================================================
 * Calculation population extraction
 * ======================================================= */

function getCalculationPopulationIdentities(
  result:
    RebuildCreatorReputationResult
): ReputationPopulationIdentity[] {
  return deduplicatePopulationIdentities(
    result
      .calculation
      .categoryReputations
      .map(
        (
          reputation
        ):
          ReputationPopulationIdentity => ({
          categoryId:
            reputation.categoryId,

          scope:
            reputation.scope,

          cityKey:
            reputation.scope ===
            'city'
              ? reputation.cityKey
              : null,
        })
      )
  )
}

/* =========================================================
 * Identity helpers
 * ======================================================= */

function deduplicatePopulationIdentities(
  values:
    readonly ReputationPopulationIdentity[]
): ReputationPopulationIdentity[] {
  const identities =
    new Map<
      string,
      ReputationPopulationIdentity
    >()

  for (
    const value of
    values
  ) {
    if (
      value.scope ===
        'city' &&
      !value.cityKey
    ) {
      continue
    }

    identities.set(
      createPopulationIdentityKey(
        value
      ),
      {
        categoryId:
          value.categoryId,

        scope:
          value.scope,

        cityKey:
          value.scope ===
          'city'
            ? value.cityKey
            : null,
      }
    )
  }

  return [
    ...identities.values(),
  ].sort(
    comparePopulationIdentities
  )
}

function createPopulationIdentityKey(
  population:
    ReputationPopulationIdentity
): string {
  return [
    population.categoryId,
    population.scope,
    population.scope ===
      'city'
      ? population.cityKey ??
        '__missing_city__'
      : '__global__',
  ].join(
    ':'
  )
}

function comparePopulationIdentities(
  first:
    ReputationPopulationIdentity,
  second:
    ReputationPopulationIdentity
): number {
  return (
    getScopeOrder(
      first.scope
    ) -
      getScopeOrder(
        second.scope
      ) ||
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
    ) ||
    first.categoryId.localeCompare(
      second.categoryId,
      'en-US',
      {
        sensitivity:
          'base',
      }
    )
  )
}

function getScopeOrder(
  scope:
    ReputationScope
): number {
  return scope ===
    'global'
    ? 0
    : 1
}

/* =========================================================
 * Logging
 * ======================================================= */

function resolveLogger(
  logger:
    CreatorReputationRefreshLogger | undefined
): Required<CreatorReputationRefreshLogger> {
  return {
    info:
      logger?.info ??
      (
        (
          message,
          metadata
        ) => {
          console.info(
            message,
            metadata ??
              {}
          )
        }
      ),

    warn:
      logger?.warn ??
      (
        (
          message,
          metadata
        ) => {
          console.warn(
            message,
            metadata ??
              {}
          )
        }
      ),

    error:
      logger?.error ??
      (
        (
          message,
          metadata
        ) => {
          console.error(
            message,
            metadata ??
              {}
          )
        }
      ),
  }
}

/* =========================================================
 * General normalization
 * ======================================================= */

function normalizeUserId(
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

function normalizeMutation(
  value:
    unknown
): string {
  if (
    typeof value !==
      'string'
  ) {
    return 'unknown'
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_:-]+/g,
        '_'
      )
      .replace(
        /^_+|_+$/g,
        ''
      )
      .slice(
        0,
        100
      )

  return normalized ||
    'unknown'
}

function normalizeRankingRefreshMode(
  value:
    unknown
): ReputationRankingRefreshMode {
  return REPUTATION_RANKING_REFRESH_MODES.includes(
    value as ReputationRankingRefreshMode
  )
    ? value as ReputationRankingRefreshMode
    : 'affected'
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

function createEmptyRankingSummary(
  mode:
    ReputationRankingRefreshMode
): ReputationRankingRefreshSummary {
  return {
    mode,

    attemptedPopulationCount:
      0,

    successfulPopulationCount:
      0,

    failedPopulationCount:
      0,

    failures: [],

    fullRebuild:
      null,
  }
}

function formatUnknownError(
  error:
    unknown
): string {
  if (
    error instanceof
      Error
  ) {
    return error.message
  }

  return String(
    error
  )
}