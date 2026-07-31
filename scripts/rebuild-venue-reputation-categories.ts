import {
  loadEnvConfig,
} from '@next/env'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

/**
 * Trusted administrative script for rebuilding:
 *
 *   public.venue_reputation_categories
 *
 * The canonical rebuild logic remains owned by the database
 * function:
 *
 *   public.rebuild_venue_reputation_categories()
 *
 * This script:
 *
 * - loads the appropriate Next.js environment variables
 * - invokes the canonical database rebuild
 * - verifies the resulting assignment totals
 * - reports uncategorized venues
 * - exits non-zero when the rebuild or verification fails
 *
 * Run from the project root with:
 *
 *   npx tsx scripts/rebuild-venue-reputation-categories.ts
 *
 * Production:
 *
 *   NODE_ENV=production \
 *   npx tsx scripts/rebuild-venue-reputation-categories.ts
 */

/* =========================================================
 * Contracts
 * ======================================================= */

type RebuildRpcResult =
  number | string | null

type AssignmentRow = {
  venue_id?: string | null
  category_id?: string | null
}

type UncategorizedVenueRow = {
  id?: string | null
  name?: string | null
  city?: string | null
  type?: unknown
}

type RebuildSummary = {
  rebuiltAssignmentCount: number
  persistedAssignmentCount: number
  categorizedVenueCount: number
  representedCategoryCount: number
  uncategorizedVenueCount: number
  durationMilliseconds: number
}

/* =========================================================
 * Configuration
 * ======================================================= */

const DEFAULT_SAMPLE_LIMIT =
  25

const SAMPLE_LIMIT =
  normalizePositiveInteger(
    process.env
      .REPUTATION_UNCATEGORIZED_SAMPLE_LIMIT
  ) ??
  DEFAULT_SAMPLE_LIMIT

const FAIL_ON_COUNT_MISMATCH =
  parseBooleanEnvironmentValue(
    process.env
      .REPUTATION_FAIL_ON_COUNT_MISMATCH,
    true
  )

const FAIL_ON_UNCATEGORIZED_VENUES =
  parseBooleanEnvironmentValue(
    process.env
      .REPUTATION_FAIL_ON_UNCATEGORIZED_VENUES,
    false
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

  const startedAt =
    Date.now()

  console.log(
    [
      '',
      '=========================================================',
      ' Rebuilding venue reputation-category assignments',
      '=========================================================',
      '',
      `Environment: ${process.env.NODE_ENV ?? 'development'}`,
      `Started:     ${new Date(startedAt).toISOString()}`,
      '',
    ].join(
      '\n'
    )
  )

  const supabase =
    getSupabaseAdmin()

  const {
    data:
      rebuildResult,
    error:
      rebuildError,
  } =
    await supabase.rpc(
      'rebuild_venue_reputation_categories'
    )

  throwIfSupabaseFailed(
    'rebuild_venue_reputation_categories RPC',
    rebuildError
  )

  const rebuiltAssignmentCount =
    normalizeNonNegativeInteger(
      rebuildResult as
        RebuildRpcResult
    )

  if (
    rebuiltAssignmentCount ===
    null
  ) {
    throw new Error(
      '[rebuild venue reputation categories] The rebuild RPC returned an invalid assignment count.'
    )
  }

  const [
    assignmentVerification,
    uncategorizedVerification,
  ] =
    await Promise.all([
      loadAssignmentVerification(),

      loadUncategorizedVenueVerification(),
    ])

  const durationMilliseconds =
    Date.now() -
    startedAt

  const summary:
    RebuildSummary = {
    rebuiltAssignmentCount,

    persistedAssignmentCount:
      assignmentVerification
        .persistedAssignmentCount,

    categorizedVenueCount:
      assignmentVerification
        .categorizedVenueCount,

    representedCategoryCount:
      assignmentVerification
        .representedCategoryCount,

    uncategorizedVenueCount:
      uncategorizedVerification
        .uncategorizedVenueCount,

    durationMilliseconds,
  }

  printSummary({
    summary,

    uncategorizedSample:
      uncategorizedVerification
        .sample,
  })

  if (
    FAIL_ON_COUNT_MISMATCH &&
    summary
      .rebuiltAssignmentCount !==
      summary
        .persistedAssignmentCount
  ) {
    throw new Error(
      [
        '[rebuild venue reputation categories] Verification failed.',
        `RPC reported ${summary.rebuiltAssignmentCount.toLocaleString('en-US')} rebuilt assignments,`,
        `but ${summary.persistedAssignmentCount.toLocaleString('en-US')} assignments are persisted.`,
      ].join(
        ' '
      )
    )
  }

  if (
    FAIL_ON_UNCATEGORIZED_VENUES &&
    summary
      .uncategorizedVenueCount >
      0
  ) {
    throw new Error(
      [
        '[rebuild venue reputation categories] Uncategorized venues remain.',
        `${summary.uncategorizedVenueCount.toLocaleString('en-US')} venues have type values but no canonical reputation-category assignment.`,
      ].join(
        ' '
      )
    )
  }

  console.log(
    [
      '',
      'Rebuild completed successfully.',
      '',
    ].join(
      '\n'
    )
  )
}

/* =========================================================
 * Verification
 * ======================================================= */

async function loadAssignmentVerification():
  Promise<{
    persistedAssignmentCount: number
    categorizedVenueCount: number
    representedCategoryCount: number
  }> {
  const supabase =
    getSupabaseAdmin()

  const {
    data,
    error,
    count,
  } =
    await supabase
      .from(
        'venue_reputation_categories'
      )
      .select(
        'venue_id, category_id',
        {
          count:
            'exact',
        }
      )

  throwIfSupabaseFailed(
    'venue_reputation_categories verification',
    error
  )

  const rows =
    Array.isArray(
      data
    )
      ? data as AssignmentRow[]
      : []

  const categorizedVenueIds =
    new Set<string>()

  const representedCategoryIds =
    new Set<string>()

  for (
    const row of
    rows
  ) {
    const venueId =
      normalizeIdentifier(
        row.venue_id
      )

    const categoryId =
      normalizeIdentifier(
        row.category_id
      )

    if (
      venueId
    ) {
      categorizedVenueIds.add(
        venueId
      )
    }

    if (
      categoryId
    ) {
      representedCategoryIds.add(
        categoryId
      )
    }
  }

  return {
    persistedAssignmentCount:
      count ??
      rows.length,

    categorizedVenueCount:
      categorizedVenueIds.size,

    representedCategoryCount:
      representedCategoryIds.size,
  }
}

async function loadUncategorizedVenueVerification():
  Promise<{
    uncategorizedVenueCount: number
    sample: UncategorizedVenueRow[]
  }> {
  const supabase =
    getSupabaseAdmin()

  /**
   * Load all venues that currently contain at least one type.
   *
   * The derived assignment table remains the canonical source
   * for determining whether a venue is categorized.
   */
  const [
    venuesResult,
    assignmentsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'venues'
        )
        .select(
          'id, name, city, type'
        )
        .not(
          'type',
          'is',
          null
        ),

      supabase
        .from(
          'venue_reputation_categories'
        )
        .select(
          'venue_id'
        ),
    ])

  throwIfSupabaseFailed(
    'venues uncategorized verification',
    venuesResult.error
  )

  throwIfSupabaseFailed(
    'venue reputation assignments uncategorized verification',
    assignmentsResult.error
  )

  const assignedVenueIds =
    new Set(
      (
        Array.isArray(
          assignmentsResult.data
        )
          ? assignmentsResult.data
          : []
      )
        .map(
          (
            row
          ) =>
            normalizeIdentifier(
              (
                row as {
                  venue_id?: unknown
                }
              ).venue_id
            )
        )
        .filter(
          (
            venueId
          ): venueId is string =>
            venueId !==
            null
        )
    )

  const uncategorized =
    (
      Array.isArray(
        venuesResult.data
      )
        ? venuesResult.data as UncategorizedVenueRow[]
        : []
    )
      .filter(
        (
          venue
        ) => {
          const venueId =
            normalizeIdentifier(
              venue.id
            )

          if (
            !venueId
          ) {
            return false
          }

          if (
            !hasMeaningfulTypeValues(
              venue.type
            )
          ) {
            return false
          }

          return !assignedVenueIds.has(
            venueId
          )
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          (
            normalizeNullableText(
              first.city
            ) ??
            ''
          ).localeCompare(
            normalizeNullableText(
              second.city
            ) ??
            '',
            'en-US',
            {
              sensitivity:
                'base',
            }
          ) ||
          (
            normalizeNullableText(
              first.name
            ) ??
            ''
          ).localeCompare(
            normalizeNullableText(
              second.name
            ) ??
            '',
            'en-US',
            {
              sensitivity:
                'base',
            }
          )
      )

  return {
    uncategorizedVenueCount:
      uncategorized.length,

    sample:
      uncategorized.slice(
        0,
        SAMPLE_LIMIT
      ),
  }
}

/* =========================================================
 * Output
 * ======================================================= */

function printSummary({
  summary,
  uncategorizedSample,
}: {
  summary:
    RebuildSummary

  uncategorizedSample:
    UncategorizedVenueRow[]
}): void {
  console.log(
    [
      '',
      'Rebuild summary',
      '---------------------------------------------------------',
      `RPC assignments rebuilt:      ${summary.rebuiltAssignmentCount.toLocaleString('en-US')}`,
      `Persisted assignments:        ${summary.persistedAssignmentCount.toLocaleString('en-US')}`,
      `Categorized venues:           ${summary.categorizedVenueCount.toLocaleString('en-US')}`,
      `Represented categories:       ${summary.representedCategoryCount.toLocaleString('en-US')}`,
      `Uncategorized typed venues:   ${summary.uncategorizedVenueCount.toLocaleString('en-US')}`,
      `Duration:                      ${formatDuration(summary.durationMilliseconds)}`,
    ].join(
      '\n'
    )
  )

  if (
    uncategorizedSample.length ===
    0
  ) {
    return
  }

  console.log(
    [
      '',
      `Uncategorized venue sample (${uncategorizedSample.length.toLocaleString('en-US')} shown)`,
      '---------------------------------------------------------',
    ].join(
      '\n'
    )
  )

  for (
    const venue of
    uncategorizedSample
  ) {
    const id =
      normalizeIdentifier(
        venue.id
      ) ??
      'unknown-id'

    const name =
      normalizeNullableText(
        venue.name
      ) ??
      'Unnamed venue'

    const city =
      normalizeNullableText(
        venue.city
      ) ??
      'unknown-city'

    const types =
      normalizeTypeValues(
        venue.type
      )

    console.log(
      [
        `- ${name}`,
        `  id:    ${id}`,
        `  city:  ${city}`,
        `  types: ${types.length > 0 ? types.join(', ') : 'none'}`,
      ].join(
        '\n'
      )
    )
  }
}

/* =========================================================
 * Error handling
 * ======================================================= */

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
    `[rebuild venue reputation categories] ${operation} failed: ${details}`
  )
}

/* =========================================================
 * Normalization helpers
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

function normalizeTypeValues(
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
          (
            item
          ) =>
            normalizeNullableText(
              item
            )
        )
        .filter(
          (
            item
          ): item is string =>
            item !==
            null
        )
        .map(
          (
            item
          ) =>
            item.toLocaleLowerCase(
              'en-US'
            )
        )
    ),
  ].sort(
    (
      first,
      second
    ) =>
      first.localeCompare(
        second,
        'en-US',
        {
          sensitivity:
            'base',
        }
      )
  )
}

function hasMeaningfulTypeValues(
  value:
    unknown
): boolean {
  return normalizeTypeValues(
    value
  ).length >
    0
}

function normalizeNonNegativeInteger(
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

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <
      0 ||
    !Number.isInteger(
      parsed
    )
  ) {
    return null
  }

  return parsed
}

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const normalized =
    normalizeNonNegativeInteger(
      value
    )

  return normalized !==
      null &&
    normalized >
      0
    ? normalized
    : null
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
  const normalizedMilliseconds =
    Math.max(
      0,
      Math.trunc(
        milliseconds
      )
    )

  if (
    normalizedMilliseconds <
    1000
  ) {
    return `${normalizedMilliseconds.toLocaleString('en-US')} ms`
  }

  return `${(
    normalizedMilliseconds /
    1000
  ).toFixed(
    2
  )} seconds`
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
      console.error(
        [
          '',
          'Venue reputation-category rebuild failed.',
          '',
          error instanceof
          Error
            ? error.stack ??
              error.message
            : String(
                error
              ),
          '',
        ].join(
          '\n'
        )
      )

      process.exitCode =
        1
    }
  )