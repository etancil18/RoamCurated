import {
  loadEnvConfig,
} from '@next/env'

import {
  isAbsolute,
  resolve,
} from 'node:path'

import {
  pathToFileURL,
} from 'node:url'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  rebuildCreatorReputation,
  type RebuildCreatorReputationOptions,
  type RebuildCreatorReputationResult,
} from '@/lib/reputation/rebuildCreatorReputation'

import {
  rebuildReputationRankings,
  type RebuildReputationRankingsResult,
} from '@/lib/reputation/rebuildReputationRankings'

/**
 * Trusted administrative script for rebuilding canonical
 * creator reputation for every Roam user.
 *
 * The script:
 *
 * - loads all users from Supabase Auth
 * - rebuilds each user's creator reputation
 * - removes stale creator aggregates through the canonical
 *   rebuild service
 * - isolates and records individual user failures
 * - optionally loads collection and snapshot contributions
 * - rebuilds ranking populations after creator rebuilds succeed
 * - exits non-zero when any required operation fails
 *
 * Run from the project root:
 *
 *   npx tsx scripts/rebuild-all-creator-reputation.ts
 *
 * Or through package.json:
 *
 *   npm run reputation:rebuild-all
 *
 * Rebuild one user:
 *
 *   npm run reputation:rebuild-all -- \
 *     --user=b25fbdac-8385-48fa-8133-fe57f03bd4e2
 *
 * Skip ranking rebuild:
 *
 *   npm run reputation:rebuild-all -- --skip-rankings
 */

/* =========================================================
 * Constants
 * ======================================================= */

const DEFAULT_CONCURRENCY =
  4

const MAX_CONCURRENCY =
  20

const DEFAULT_AUTH_PAGE_SIZE =
  500

const MAX_AUTH_PAGE_SIZE =
  1000

const DEFAULT_PROGRESS_INTERVAL =
  10

/* =========================================================
 * Loader contracts
 * ======================================================= */

type CollectionContributionLoader =
  NonNullable<
    RebuildCreatorReputationOptions[
      'loadPublicCollectionContributions'
    ]
  >

type SnapshotContributionLoader =
  NonNullable<
    RebuildCreatorReputationOptions[
      'loadPublicSnapshotContributions'
    ]
  >

type OptionalContributionLoaders = {
  collectionLoader?:
    CollectionContributionLoader

  snapshotLoader?:
    SnapshotContributionLoader
}

/* =========================================================
 * Script contracts
 * ======================================================= */

type ScriptConfiguration = {
  targetUserId:
    string | null

  concurrency:
    number

  authPageSize:
    number

  progressInterval:
    number

  continueOnError:
    boolean

  skipRankings:
    boolean

  rebuildRankingsOnPartialFailure:
    boolean

  requireCollectionLoader:
    boolean

  requireSnapshotLoader:
    boolean

  collectionLoaderModule:
    string | null

  collectionLoaderExport:
    string

  snapshotLoaderModule:
    string | null

  snapshotLoaderExport:
    string
}

type CreatorRebuildFailure = {
  userId:
    string

  message:
    string

  stack:
    string | null
}

type CreatorRebuildTotals = {
  attemptedUsers:
    number

  successfulUsers:
    number

  failedUsers:
    number

  verifiedVisitRows:
    number

  distinctVerifiedVenues:
    number

  venueCategoryAssignments:
    number

  completedFlows:
    number

  publicCollectionContributions:
    number

  publicSnapshotContributions:
    number

  upsertedAggregateCount:
    number

  deletedStaleAggregateCount:
    number
}

type ScriptSummary = {
  startedAt:
    string

  completedAt:
    string

  durationMilliseconds:
    number

  policyVersion:
    number | null

  totals:
    CreatorRebuildTotals

  failures:
    CreatorRebuildFailure[]

  rankings:
    RebuildReputationRankingsResult | null

  rankingsSkippedReason:
    string | null
}

/* =========================================================
 * Process state
 * ======================================================= */

let interruptionRequested =
  false

process.once(
  'SIGINT',
  () => {
    interruptionRequested =
      true

    console.warn(
      '\nInterrupt requested. No new user rebuilds will be started.'
    )
  }
)

process.once(
  'SIGTERM',
  () => {
    interruptionRequested =
      true

    console.warn(
      '\nTermination requested. No new user rebuilds will be started.'
    )
  }
)

/* =========================================================
 * Main execution
 * ======================================================= */

async function main():
  Promise<void> {
  const projectDirectory =
    process.cwd()

  loadEnvConfig(
    projectDirectory,
    process.env.NODE_ENV !==
      'production'
  )

  const configuration =
    parseConfiguration(
      process.argv.slice(
        2
      )
    )

  const startedAtDate =
    new Date()

  const startedAt =
    startedAtDate.toISOString()

  printConfiguration({
    configuration,
    startedAt,
  })

  const contributionLoaders =
    await loadContributionLoaders({
      configuration,
      projectDirectory,
    })

  const userIds =
    configuration.targetUserId
      ? [
          configuration
            .targetUserId,
        ]
      : await loadAllAuthUserIds(
          configuration
            .authPageSize
        )

  console.log(
    [
      '',
      `Users selected: ${userIds.length.toLocaleString('en-US')}`,
      '',
    ].join(
      '\n'
    )
  )

  const calculatedAt =
    new Date().toISOString()

  const failures:
    CreatorRebuildFailure[] =
    []

  const successfulResults:
    RebuildCreatorReputationResult[] =
    []

  let processedCount =
    0

  await runWithConcurrency({
    values:
      userIds,

    concurrency:
      configuration
        .concurrency,

    shouldStop:
      () =>
        interruptionRequested,

    worker:
      async (
        userId
      ) => {
        try {
          const result =
            await rebuildCreatorReputation(
              userId,
              {
                calculatedAt,

                loadPublicCollectionContributions:
                  contributionLoaders
                    .collectionLoader,

                loadPublicSnapshotContributions:
                  contributionLoaders
                    .snapshotLoader,
              }
            )

          successfulResults.push(
            result
          )
        } catch (
          error
        ) {
          failures.push(
            createFailure({
              userId,
              error,
            })
          )

          console.error(
            [
              '',
              `[creator reputation] Failed for ${userId}`,
              formatUnknownError(
                error
              ),
              '',
            ].join(
              '\n'
            )
          )

          if (
            !configuration
              .continueOnError
          ) {
            throw error
          }
        } finally {
          processedCount +=
            1

          if (
            processedCount ===
              userIds.length ||
            processedCount %
              configuration
                .progressInterval ===
              0
          ) {
            printProgress({
              processedCount,

              totalCount:
                userIds.length,

              successCount:
                successfulResults.length,

              failureCount:
                failures.length,
            })
          }
        }
      },
  })

  if (
    interruptionRequested
  ) {
    throw new ScriptInterruptedError()
  }

  const hasCreatorFailures =
    failures.length >
    0

  let rankings:
    RebuildReputationRankingsResult | null =
    null

  let rankingsSkippedReason:
    string | null =
    null

  if (
    configuration.skipRankings
  ) {
    rankingsSkippedReason =
      'Ranking rebuild was disabled by configuration.'
  } else if (
    hasCreatorFailures &&
    !configuration
      .rebuildRankingsOnPartialFailure
  ) {
    rankingsSkippedReason =
      'Ranking rebuild was skipped because one or more creator rebuilds failed.'
  } else {
    console.log(
      [
        '',
        'Rebuilding reputation ranking populations…',
        '',
      ].join(
        '\n'
      )
    )

    rankings =
      await rebuildReputationRankings({
        calculatedAt,
      })
  }

  const completedAtDate =
    new Date()

  const summary =
    createScriptSummary({
      startedAtDate,

      completedAtDate,

      attemptedUserCount:
        userIds.length,

      results:
        successfulResults,

      failures,

      rankings,

      rankingsSkippedReason,
    })

  printSummary(
    summary
  )

  if (
    failures.length >
    0
  ) {
    process.exitCode =
      1
  }
}

/* =========================================================
 * Auth user loading
 * ======================================================= */

/**
 * Loading every Auth user ensures stale reputation rows are
 * removed even for users who currently have no qualifying
 * activity.
 */
async function loadAllAuthUserIds(
  pageSize:
    number
): Promise<string[]> {
  const supabase =
    getSupabaseAdmin()

  const userIds =
    new Set<string>()

  let page =
    1

  while (
    true
  ) {
    if (
      interruptionRequested
    ) {
      throw new ScriptInterruptedError()
    }

    const {
      data,
      error,
    } =
      await supabase
        .auth
        .admin
        .listUsers({
          page,
          perPage:
            pageSize,
        })

    throwIfSupabaseFailed(
      `auth.admin.listUsers page ${page}`,
      error
    )

    const users =
      data?.users ??
      []

    for (
      const user of
      users
    ) {
      const userId =
        normalizeIdentifier(
          user.id
        )

      if (
        userId
      ) {
        userIds.add(
          userId
        )
      }
    }

    console.log(
      `Loaded ${userIds.size.toLocaleString('en-US')} Auth users…`
    )

    if (
      users.length <
      pageSize
    ) {
      break
    }

    page +=
      1
  }

  return [
    ...userIds,
  ].sort()
}

/* =========================================================
 * Optional contribution loaders
 * ======================================================= */

/**
 * Collection and snapshot schemas are intentionally not guessed
 * by the canonical rebuild service.
 *
 * Their trusted loader modules may be supplied through:
 *
 *   REPUTATION_COLLECTION_LOADER_MODULE
 *   REPUTATION_COLLECTION_LOADER_EXPORT
 *
 *   REPUTATION_SNAPSHOT_LOADER_MODULE
 *   REPUTATION_SNAPSHOT_LOADER_EXPORT
 *
 * Relative module paths are resolved from the project root.
 */
async function loadContributionLoaders({
  configuration,
  projectDirectory,
}: {
  configuration:
    ScriptConfiguration

  projectDirectory:
    string
}): Promise<OptionalContributionLoaders> {
  const collectionLoader =
    await loadOptionalExport<
      CollectionContributionLoader
    >({
      modulePath:
        configuration
          .collectionLoaderModule,

      exportName:
        configuration
          .collectionLoaderExport,

      projectDirectory,

      required:
        configuration
          .requireCollectionLoader,

      description:
        'public collection contribution loader',
    })

  const snapshotLoader =
    await loadOptionalExport<
      SnapshotContributionLoader
    >({
      modulePath:
        configuration
          .snapshotLoaderModule,

      exportName:
        configuration
          .snapshotLoaderExport,

      projectDirectory,

      required:
        configuration
          .requireSnapshotLoader,

      description:
        'public snapshot contribution loader',
    })

  if (
    !collectionLoader
  ) {
    console.warn(
      [
        '',
        'Warning: no public collection contribution loader is configured.',
        'Collection reputation components will rebuild as zero.',
        '',
      ].join(
        '\n'
      )
    )
  }

  if (
    !snapshotLoader
  ) {
    console.warn(
      [
        '',
        'Warning: no public snapshot contribution loader is configured.',
        'Snapshot reputation components will rebuild as zero.',
        '',
      ].join(
        '\n'
      )
    )
  }

  return {
    ...(collectionLoader
      ? {
          collectionLoader,
        }
      : {}),

    ...(snapshotLoader
      ? {
          snapshotLoader,
        }
      : {}),
  }
}

async function loadOptionalExport<
  T extends (
    ...args: never[]
  ) => unknown,
>({
  modulePath,
  exportName,
  projectDirectory,
  required,
  description,
}: {
  modulePath:
    string | null

  exportName:
    string

  projectDirectory:
    string

  required:
    boolean

  description:
    string
}): Promise<T | undefined> {
  if (
    !modulePath
  ) {
    if (
      required
    ) {
      throw new Error(
        `A ${description} is required but no module path was configured.`
      )
    }

    return undefined
  }

  const importSpecifier =
    resolveImportSpecifier({
      modulePath,
      projectDirectory,
    })

  let importedModule:
    Record<
      string,
      unknown
    >

  try {
    importedModule =
      await import(
        importSpecifier
      ) as Record<
        string,
        unknown
      >
  } catch (
    error
  ) {
    throw new Error(
      `Could not import the ${description} from "${modulePath}".`,
      {
        cause:
          error,
      }
    )
  }

  const exportedValue =
    importedModule[
      exportName
    ]

  if (
    typeof exportedValue !==
    'function'
  ) {
    throw new Error(
      `Module "${modulePath}" does not export a function named "${exportName}".`
    )
  }

  return exportedValue as T
}

function resolveImportSpecifier({
  modulePath,
  projectDirectory,
}: {
  modulePath:
    string

  projectDirectory:
    string
}): string {
  if (
    modulePath.startsWith(
      '.'
    ) ||
    isAbsolute(
      modulePath
    )
  ) {
    const absolutePath =
      isAbsolute(
        modulePath
      )
        ? modulePath
        : resolve(
            projectDirectory,
            modulePath
          )

    return pathToFileURL(
      absolutePath
    ).href
  }

  return modulePath
}

/* =========================================================
 * Concurrent execution
 * ======================================================= */

async function runWithConcurrency<
  T,
>({
  values,
  concurrency,
  shouldStop,
  worker,
}: {
  values:
    readonly T[]

  concurrency:
    number

  shouldStop:
    () => boolean

  worker:
    (
      value: T,
      index: number
    ) => Promise<void>
}): Promise<void> {
  if (
    values.length ===
    0
  ) {
    return
  }

  let nextIndex =
    0

  const workerCount =
    Math.min(
      concurrency,
      values.length
    )

  async function runWorker():
    Promise<void> {
    while (
      true
    ) {
      if (
        shouldStop()
      ) {
        return
      }

      const currentIndex =
        nextIndex

      nextIndex +=
        1

      if (
        currentIndex >=
        values.length
      ) {
        return
      }

      await worker(
        values[
          currentIndex
        ],
        currentIndex
      )
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () =>
        runWorker()
    )
  )
}

/* =========================================================
 * Summary aggregation
 * ======================================================= */

function createScriptSummary({
  startedAtDate,
  completedAtDate,
  attemptedUserCount,
  results,
  failures,
  rankings,
  rankingsSkippedReason,
}: {
  startedAtDate:
    Date

  completedAtDate:
    Date

  attemptedUserCount:
    number

  results:
    RebuildCreatorReputationResult[]

  failures:
    CreatorRebuildFailure[]

  rankings:
    RebuildReputationRankingsResult | null

  rankingsSkippedReason:
    string | null
}): ScriptSummary {
  const totals =
    results.reduce<
      CreatorRebuildTotals
    >(
      (
        accumulator,
        result
      ) => {
        accumulator
          .verifiedVisitRows +=
          result
            .sourceCounts
            .verifiedVisitRows

        accumulator
          .distinctVerifiedVenues +=
          result
            .sourceCounts
            .distinctVerifiedVenues

        accumulator
          .venueCategoryAssignments +=
          result
            .sourceCounts
            .venueCategoryAssignments

        accumulator
          .completedFlows +=
          result
            .sourceCounts
            .completedFlows

        accumulator
          .publicCollectionContributions +=
          result
            .sourceCounts
            .publicCollectionContributions

        accumulator
          .publicSnapshotContributions +=
          result
            .sourceCounts
            .publicSnapshotContributions

        accumulator
          .upsertedAggregateCount +=
          result
            .persistence
            .upsertedAggregateCount

        accumulator
          .deletedStaleAggregateCount +=
          result
            .persistence
            .deletedStaleAggregateCount

        return accumulator
      },
      {
        attemptedUsers:
          attemptedUserCount,

        successfulUsers:
          results.length,

        failedUsers:
          failures.length,

        verifiedVisitRows:
          0,

        distinctVerifiedVenues:
          0,

        venueCategoryAssignments:
          0,

        completedFlows:
          0,

        publicCollectionContributions:
          0,

        publicSnapshotContributions:
          0,

        upsertedAggregateCount:
          0,

        deletedStaleAggregateCount:
          0,
      }
    )

  const policyVersion =
    results[0]
      ?.policyVersion ??
    rankings
      ?.policyVersion ??
    null

  return {
    startedAt:
      startedAtDate
        .toISOString(),

    completedAt:
      completedAtDate
        .toISOString(),

    durationMilliseconds:
      Math.max(
        0,
        completedAtDate
          .getTime() -
          startedAtDate
            .getTime()
      ),

    policyVersion,

    totals,

    failures,

    rankings,

    rankingsSkippedReason,
  }
}

/* =========================================================
 * Output
 * ======================================================= */

function printConfiguration({
  configuration,
  startedAt,
}: {
  configuration:
    ScriptConfiguration

  startedAt:
    string
}): void {
  console.log(
    [
      '',
      '=========================================================',
      ' Rebuilding all creator reputation',
      '=========================================================',
      '',
      `Environment:                   ${process.env.NODE_ENV ?? 'development'}`,
      `Started:                       ${startedAt}`,
      `Target user:                   ${configuration.targetUserId ?? 'all Auth users'}`,
      `Concurrency:                   ${configuration.concurrency}`,
      `Auth page size:                ${configuration.authPageSize}`,
      `Continue after user failure:   ${configuration.continueOnError}`,
      `Skip rankings:                 ${configuration.skipRankings}`,
      `Rank on partial failure:       ${configuration.rebuildRankingsOnPartialFailure}`,
      `Collection loader configured:  ${Boolean(configuration.collectionLoaderModule)}`,
      `Snapshot loader configured:    ${Boolean(configuration.snapshotLoaderModule)}`,
      '',
    ].join(
      '\n'
    )
  )
}

function printProgress({
  processedCount,
  totalCount,
  successCount,
  failureCount,
}: {
  processedCount:
    number

  totalCount:
    number

  successCount:
    number

  failureCount:
    number
}): void {
  const progressPercent =
    totalCount >
      0
      ? Math.round(
          (
            processedCount /
            totalCount
          ) *
            100
        )
      : 100

  console.log(
    [
      '[creator reputation]',
      `${processedCount.toLocaleString('en-US')}/${totalCount.toLocaleString('en-US')}`,
      `(${progressPercent}%)`,
      `successful=${successCount.toLocaleString('en-US')}`,
      `failed=${failureCount.toLocaleString('en-US')}`,
    ].join(
      ' '
    )
  )
}

function printSummary(
  summary:
    ScriptSummary
): void {
  const {
    totals,
    rankings,
  } =
    summary

  console.log(
    [
      '',
      '=========================================================',
      ' Creator reputation rebuild summary',
      '=========================================================',
      '',
      `Started:                         ${summary.startedAt}`,
      `Completed:                       ${summary.completedAt}`,
      `Duration:                        ${formatDuration(summary.durationMilliseconds)}`,
      `Policy version:                  ${summary.policyVersion ?? 'unknown'}`,
      '',
      `Users attempted:                 ${totals.attemptedUsers.toLocaleString('en-US')}`,
      `Users successful:                ${totals.successfulUsers.toLocaleString('en-US')}`,
      `Users failed:                    ${totals.failedUsers.toLocaleString('en-US')}`,
      '',
      `Verified visit rows:             ${totals.verifiedVisitRows.toLocaleString('en-US')}`,
      `Distinct verified venues:        ${totals.distinctVerifiedVenues.toLocaleString('en-US')}`,
      `Venue-category assignments:      ${totals.venueCategoryAssignments.toLocaleString('en-US')}`,
      `Completed flows:                 ${totals.completedFlows.toLocaleString('en-US')}`,
      `Collection contributions:        ${totals.publicCollectionContributions.toLocaleString('en-US')}`,
      `Snapshot contributions:          ${totals.publicSnapshotContributions.toLocaleString('en-US')}`,
      '',
      `Creator aggregates upserted:     ${totals.upsertedAggregateCount.toLocaleString('en-US')}`,
      `Stale aggregates deleted:        ${totals.deletedStaleAggregateCount.toLocaleString('en-US')}`,
      '',
      rankings
        ? `Ranking populations rebuilt:    ${rankings.persistence.upsertedPopulationCount.toLocaleString('en-US')}`
        : `Ranking populations rebuilt:    0`,
      rankings
        ? `Stale populations deleted:       ${rankings.persistence.deletedStalePopulationCount.toLocaleString('en-US')}`
        : `Stale populations deleted:       0`,
      rankings
        ? `Eligible ranking rows:           ${rankings.sourceCounts.eligibleRankingRows.toLocaleString('en-US')}`
        : `Eligible ranking rows:           0`,
      summary.rankingsSkippedReason
        ? `Rankings skipped:                 ${summary.rankingsSkippedReason}`
        : 'Rankings skipped:                 no',
      '',
    ].join(
      '\n'
    )
  )

  if (
    summary.failures.length ===
    0
  ) {
    console.log(
      'Rebuild completed successfully.\n'
    )

    return
  }

  console.error(
    [
      'Failed users',
      '---------------------------------------------------------',
    ].join(
      '\n'
    )
  )

  for (
    const failure of
    summary.failures
  ) {
    console.error(
      [
        `- ${failure.userId}`,
        `  ${failure.message}`,
      ].join(
        '\n'
      )
    )
  }

  console.error(
    '\nRebuild completed with failures.\n'
  )
}

/* =========================================================
 * Configuration
 * ======================================================= */

function parseConfiguration(
  argumentsList:
    string[]
): ScriptConfiguration {
  const argumentMap =
    parseCommandLineArguments(
      argumentsList
    )

  if (
    argumentMap.has(
      'help'
    )
  ) {
    printHelp()
    process.exit(
      0
    )
  }

  const targetUserId =
    normalizeIdentifier(
      argumentMap.get(
        'user'
      ) ??
      process.env
        .REPUTATION_REBUILD_USER_ID
    )

  const concurrency =
    clampInteger({
      value:
        argumentMap.get(
          'concurrency'
        ) ??
        process.env
          .REPUTATION_REBUILD_CONCURRENCY,

      fallback:
        DEFAULT_CONCURRENCY,

      minimum:
        1,

      maximum:
        MAX_CONCURRENCY,
    })

  const authPageSize =
    clampInteger({
      value:
        process.env
          .REPUTATION_AUTH_PAGE_SIZE,

      fallback:
        DEFAULT_AUTH_PAGE_SIZE,

      minimum:
        1,

      maximum:
        MAX_AUTH_PAGE_SIZE,
    })

  const progressInterval =
    clampInteger({
      value:
        process.env
          .REPUTATION_PROGRESS_INTERVAL,

      fallback:
        DEFAULT_PROGRESS_INTERVAL,

      minimum:
        1,

      maximum:
        10000,
    })

  return {
    targetUserId,

    concurrency,

    authPageSize,

    progressInterval,

    continueOnError:
      argumentMap.has(
        'fail-fast'
      )
        ? false
        : parseBooleanEnvironmentValue(
            process.env
              .REPUTATION_CONTINUE_ON_ERROR,
            true
          ),

    skipRankings:
      argumentMap.has(
        'skip-rankings'
      ) ||
      parseBooleanEnvironmentValue(
        process.env
          .REPUTATION_SKIP_RANKINGS,
        false
      ),

    rebuildRankingsOnPartialFailure:
      argumentMap.has(
        'rank-on-partial'
      ) ||
      parseBooleanEnvironmentValue(
        process.env
          .REPUTATION_REBUILD_RANKINGS_ON_PARTIAL,
        false
      ),

    requireCollectionLoader:
      parseBooleanEnvironmentValue(
        process.env
          .REPUTATION_REQUIRE_COLLECTION_LOADER,
        false
      ),

    requireSnapshotLoader:
      parseBooleanEnvironmentValue(
        process.env
          .REPUTATION_REQUIRE_SNAPSHOT_LOADER,
        false
      ),

    collectionLoaderModule:
      normalizeNullableText(
        process.env
          .REPUTATION_COLLECTION_LOADER_MODULE
      ),

    collectionLoaderExport:
      normalizeNullableText(
        process.env
          .REPUTATION_COLLECTION_LOADER_EXPORT
      ) ??
      'loadCreatorCollectionReputationContributions',

    snapshotLoaderModule:
      normalizeNullableText(
        process.env
          .REPUTATION_SNAPSHOT_LOADER_MODULE
      ),

    snapshotLoaderExport:
      normalizeNullableText(
        process.env
          .REPUTATION_SNAPSHOT_LOADER_EXPORT
      ) ??
      'loadCreatorSnapshotReputationContributions',
  }
}

function parseCommandLineArguments(
  argumentsList:
    string[]
): Map<
  string,
  string
> {
  const result =
    new Map<
      string,
      string
    >()

  for (
    const argument of
    argumentsList
  ) {
    if (
      !argument.startsWith(
        '--'
      )
    ) {
      continue
    }

    const normalized =
      argument.slice(
        2
      )

    const separatorIndex =
      normalized.indexOf(
        '='
      )

    if (
      separatorIndex ===
      -1
    ) {
      result.set(
        normalized,
        'true'
      )

      continue
    }

    const key =
      normalized
        .slice(
          0,
          separatorIndex
        )
        .trim()

    const value =
      normalized
        .slice(
          separatorIndex +
            1
        )
        .trim()

    if (
      key
    ) {
      result.set(
        key,
        value
      )
    }
  }

  return result
}

function printHelp():
  void {
  console.log(`
Rebuild canonical creator reputation for all users.

Usage:
  npx tsx scripts/rebuild-all-creator-reputation.ts [options]

Options:
  --user=<uuid>          Rebuild only one user
  --concurrency=<number> Concurrent user rebuilds
  --skip-rankings        Do not rebuild ranking populations
  --rank-on-partial      Rebuild rankings even if users fail
  --fail-fast            Stop after the first user failure
  --help                 Show this help
`)
}

/* =========================================================
 * Error handling
 * ======================================================= */

class ScriptInterruptedError
  extends Error {
  constructor() {
    super(
      'Creator reputation rebuild was interrupted.'
    )

    this.name =
      'ScriptInterruptedError'
  }
}

function createFailure({
  userId,
  error,
}: {
  userId:
    string

  error:
    unknown
}): CreatorRebuildFailure {
  return {
    userId,

    message:
      error instanceof
        Error
        ? error.message
        : String(
            error
          ),

    stack:
      error instanceof
        Error
        ? error.stack ??
          null
        : null,
  }
}

function throwIfSupabaseFailed(
  operation:
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
    `[rebuild-all-creator-reputation] ${operation} failed: ${details}`
  )
}

function formatUnknownError(
  error:
    unknown
): string {
  if (
    error instanceof
    Error
  ) {
    return error.stack ??
      error.message
  }

  return String(
    error
  )
}

/* =========================================================
 * General helpers
 * ======================================================= */

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

function clampInteger({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value:
    unknown

  fallback:
    number

  minimum:
    number

  maximum:
    number
}): number {
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

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.trunc(
        parsed
      )
    )
  )
}

function parseBooleanEnvironmentValue(
  value:
    string | undefined,
  fallback:
    boolean
): boolean {
  if (
    typeof value !==
      'string'
  ) {
    return fallback
  }

  const normalized =
    value
      .trim()
      .toLocaleLowerCase(
        'en-US'
      )

  if (
    [
      '1',
      'true',
      'yes',
      'on',
    ].includes(
      normalized
    )
  ) {
    return true
  }

  if (
    [
      '0',
      'false',
      'no',
      'off',
    ].includes(
      normalized
    )
  ) {
    return false
  }

  return fallback
}

function formatDuration(
  milliseconds:
    number
): string {
  const normalized =
    Math.max(
      0,
      Math.trunc(
        milliseconds
      )
    )

  if (
    normalized <
    1000
  ) {
    return `${normalized.toLocaleString('en-US')} ms`
  }

  const seconds =
    normalized /
    1000

  if (
    seconds <
    60
  ) {
    return `${seconds.toFixed(2)} seconds`
  }

  const minutes =
    Math.floor(
      seconds /
      60
    )

  const remainingSeconds =
    Math.round(
      seconds %
      60
    )

  return `${minutes.toLocaleString('en-US')}m ${remainingSeconds.toLocaleString('en-US')}s`
}

/* =========================================================
 * Process boundary
 * ======================================================= */

void main()
  .catch(
    (
      error:
        unknown
    ) => {
      const interrupted =
        error instanceof
          ScriptInterruptedError

      console.error(
        [
          '',
          interrupted
            ? 'Creator reputation rebuild interrupted.'
            : 'Creator reputation rebuild failed.',
          '',
          formatUnknownError(
            error
          ),
          '',
        ].join(
          '\n'
        )
      )

      process.exitCode =
        interrupted
          ? 130
          : 1
    }
  )