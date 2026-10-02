import { loadEnvConfig } from '@next/env'

/**
 * One-time canonical Passport backfill.
 *
 * Usage:
 *
 *   npx tsx scripts/rebuild-public-passport-stats.ts
 *
 * Optional environment variables:
 *
 *   PASSPORT_REBUILD_PAGE_SIZE=1000
 *   PASSPORT_REBUILD_CONCURRENCY=5
 *
 * Behavior:
 *
 * - Loads environment variables before importing server-only modules.
 * - Finds distinct users represented in venue_visits.
 * - Rebuilds each user's canonical profile_public_stats row.
 * - Limits concurrency to avoid overwhelming Supabase.
 * - Continues when an individual user rebuild fails.
 * - Reports success and failure totals.
 * - Sets a non-zero exit code when any rebuild fails.
 * - Never logs raw visit records or location evidence.
 */

const DEFAULT_PAGE_SIZE = 1000
const MAX_PAGE_SIZE = 1000

const DEFAULT_CONCURRENCY = 5
const MAX_CONCURRENCY = 20

type VenueVisitUserRow = {
  user_id?: string | null
}

type SerializedError = {
  name?: string
  message: string
  code?: string
  details?: string
  hint?: string
}

type UserRebuildFailure = {
  userId: string
  error: SerializedError
}

type BackfillSummary = {
  discoveredUsers: number
  processedUsers: number
  succeededUsers: number
  failedUsers: number
  durationMs: number
  failures: UserRebuildFailure[]
}

async function main(): Promise<void> {
  const startedAt = Date.now()

  /**
   * Load .env, .env.local, and environment-specific Next.js
   * environment files before importing modules that validate
   * Supabase environment variables during module evaluation.
   */
  loadEnvConfig(process.cwd())

  const pageSize = readBoundedIntegerEnv({
    name: 'PASSPORT_REBUILD_PAGE_SIZE',
    fallback: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })

  const concurrency = readBoundedIntegerEnv({
    name: 'PASSPORT_REBUILD_CONCURRENCY',
    fallback: DEFAULT_CONCURRENCY,
    minimum: 1,
    maximum: MAX_CONCURRENCY,
  })

  const [
    { getSupabaseAdmin },
    { rebuildPublicPassportStats },
  ] = await Promise.all([
    import('@/lib/supabase/admin'),
    import(
      '@/lib/passport/rebuildPublicPassportStats'
    ),
  ])

  const supabase = getSupabaseAdmin()

  console.info(
    '[rebuild-public-passport-stats] Starting backfill.',
    {
      pageSize,
      concurrency,
    }
  )

  const userIds =
    await loadDistinctVenueVisitUserIds({
      supabase,
      pageSize,
    })

  console.info(
    '[rebuild-public-passport-stats] User discovery complete.',
    {
      discoveredUsers: userIds.length,
    }
  )

  if (userIds.length === 0) {
    console.info(
      '[rebuild-public-passport-stats] No venue-visit users require rebuilding.'
    )

    return
  }

  const failures: UserRebuildFailure[] = []
  let succeededUsers = 0
  let processedUsers = 0

  await runWithConcurrency({
    values: userIds,
    concurrency,

    worker: async (userId) => {
      try {
        await rebuildPublicPassportStats(
          userId
        )

        succeededUsers += 1
      } catch (error) {
        failures.push({
          userId,
          error:
            serializeUnknownError(error),
        })

        console.error(
          '[rebuild-public-passport-stats] User rebuild failed.',
          {
            userId,
            error:
              serializeUnknownError(
                error
              ),
          }
        )
      } finally {
        processedUsers += 1

        if (
          processedUsers ===
            userIds.length ||
          processedUsers % 25 === 0
        ) {
          console.info(
            '[rebuild-public-passport-stats] Progress.',
            {
              processedUsers,
              totalUsers:
                userIds.length,
              succeededUsers,
              failedUsers:
                failures.length,
            }
          )
        }
      }
    },
  })

  const summary: BackfillSummary = {
    discoveredUsers:
      userIds.length,

    processedUsers,

    succeededUsers,

    failedUsers:
      failures.length,

    durationMs:
      Date.now() - startedAt,

    failures,
  }

  logSummary(summary)

  if (failures.length > 0) {
    process.exitCode = 1
  }
}

async function loadDistinctVenueVisitUserIds({
  supabase,
  pageSize,
}: {
  supabase: Awaited<
    ReturnType<
      typeof import(
        '@/lib/supabase/admin'
      ).getSupabaseAdmin
    >
  >
  pageSize: number
}): Promise<string[]> {
  const uniqueUserIds =
    new Set<string>()

  let offset = 0

  while (true) {
    const upperBound =
      offset + pageSize - 1

    const {
      data,
      error,
    } = await supabase
      .from('venue_visits')
      .select('user_id')
      .order('user_id', {
        ascending: true,
      })
      .range(
        offset,
        upperBound
      )

    if (error) {
      throw new Error(
        buildSupabaseErrorMessage({
          operation:
            'venue_visits user discovery',
          error,
        })
      )
    }

    const rows =
      (data ?? []) as VenueVisitUserRow[]

    for (const row of rows) {
      const userId =
        normalizeIdentifier(
          row.user_id
        )

      if (userId) {
        uniqueUserIds.add(userId)
      }
    }

    console.info(
      '[rebuild-public-passport-stats] Scanned venue-visit page.',
      {
        offset,
        rowsScanned:
          rows.length,
        distinctUsers:
          uniqueUserIds.size,
      }
    )

    if (
      rows.length <
      pageSize
    ) {
      break
    }

    offset += pageSize
  }

  return [
    ...uniqueUserIds,
  ].sort((first, second) =>
    first.localeCompare(second)
  )
}

async function runWithConcurrency<T>({
  values,
  concurrency,
  worker,
}: {
  values: readonly T[]
  concurrency: number
  worker: (
    value: T,
    index: number
  ) => Promise<void>
}): Promise<void> {
  if (values.length === 0) {
    return
  }

  let nextIndex = 0

  const workerCount =
    Math.min(
      concurrency,
      values.length
    )

  const workers =
    Array.from(
      {
        length: workerCount,
      },
      async () => {
        while (true) {
          const currentIndex =
            nextIndex

          nextIndex += 1

          if (
            currentIndex >=
            values.length
          ) {
            return
          }

          await worker(
            values[currentIndex],
            currentIndex
          )
        }
      }
    )

  await Promise.all(workers)
}

function normalizeIdentifier(
  value: unknown
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
    normalized.length > 200 ||
    /[\r\n]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function readBoundedIntegerEnv({
  name,
  fallback,
  minimum,
  maximum,
}: {
  name: string
  fallback: number
  minimum: number
  maximum: number
}): number {
  const rawValue =
    process.env[name]

  if (
    !rawValue ||
    rawValue.trim().length === 0
  ) {
    return fallback
  }

  const parsed =
    Number(rawValue)

  if (
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(
      `[rebuild-public-passport-stats] ${name} must be an integer between ${minimum} and ${maximum}.`
    )
  }

  return parsed
}

function buildSupabaseErrorMessage({
  operation,
  error,
}: {
  operation: string
  error: {
    message?: string
    code?: string
    details?: string
    hint?: string
  }
}): string {
  const details = [
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
    .filter(Boolean)
    .join(' | ')

  return [
    '[rebuild-public-passport-stats]',
    `${operation} failed:`,
    details ||
      'Unknown Supabase error',
  ].join(' ')
}

function serializeUnknownError(
  error: unknown
): SerializedError {
  if (
    error instanceof Error
  ) {
    const record =
      error as Error & {
        code?: unknown
        details?: unknown
        hint?: unknown
      }

    return {
      name:
        error.name,

      message:
        error.message,

      ...(typeof record.code ===
      'string'
        ? {
            code:
              record.code,
          }
        : {}),

      ...(typeof record.details ===
      'string'
        ? {
            details:
              record.details,
          }
        : {}),

      ...(typeof record.hint ===
      'string'
        ? {
            hint:
              record.hint,
          }
        : {}),
    }
  }

  if (
    typeof error ===
      'object' &&
    error !== null
  ) {
    const record =
      error as Record<
        string,
        unknown
      >

    return {
      message:
        typeof record.message ===
        'string'
          ? record.message
          : 'Unknown error',

      ...(typeof record.code ===
      'string'
        ? {
            code:
              record.code,
          }
        : {}),

      ...(typeof record.details ===
      'string'
        ? {
            details:
              record.details,
          }
        : {}),

      ...(typeof record.hint ===
      'string'
        ? {
            hint:
              record.hint,
          }
        : {}),
    }
  }

  return {
    message:
      String(error),
  }
}

function logSummary(
  summary: BackfillSummary
): void {
  console.info(
    '[rebuild-public-passport-stats] Backfill complete.',
    {
      discoveredUsers:
        summary.discoveredUsers,

      processedUsers:
        summary.processedUsers,

      succeededUsers:
        summary.succeededUsers,

      failedUsers:
        summary.failedUsers,

      durationMs:
        summary.durationMs,

      durationSeconds:
        Number(
          (
            summary.durationMs /
            1000
          ).toFixed(2)
        ),
    }
  )

  if (
    summary.failures.length ===
    0
  ) {
    return
  }

  console.error(
    '[rebuild-public-passport-stats] Failed user rebuilds.',
    summary.failures
  )
}

void main().catch(
  (error: unknown) => {
    console.error(
      '[rebuild-public-passport-stats] Fatal backfill failure.',
      serializeUnknownError(
        error
      )
    )

    process.exitCode = 1
  }
)