import 'server-only'

import type {
  PublicCreatorMapData,
} from './mapTypes'

import {
  getPublicCreatorMap,
  PublicCreatorMapLoadError,
  type GetPublicCreatorMapOptions,
} from './getPublicCreatorMap'

/* =========================================================
 * Safe public loader contract
 * ======================================================= */

/**
 * Loads a public Creator Exploration Map without allowing map
 * failures to break the surrounding public profile page.
 *
 * Returns:
 *
 * - `PublicCreatorMapData` when the creator has explicitly
 *   published an accessible exploration map
 * - `null` when publication gates are not satisfied
 * - `null` when the underlying loader encounters a query,
 *   validation, or unexpected server-side failure
 *
 * Privacy and eligibility decisions remain exclusively owned
 * by `getPublicCreatorMap`.
 *
 * This wrapper must never:
 *
 * - bypass the creator's explicit map opt-in
 * - read `venue_visits` through an anon or browser client
 * - expose raw database errors to public callers
 * - convert invalid data into publicly visible map venues
 */
export async function safelyLoadPublicCreatorMap(
  options: GetPublicCreatorMapOptions
): Promise<PublicCreatorMapData | null> {
  try {
    return await getPublicCreatorMap(
      options
    )
  } catch (error) {
    if (
      error instanceof
      PublicCreatorMapLoadError
    ) {
      logExpectedCreatorMapFailure({
        error,
        userId:
          options.userId,
      })

      return null
    }

    logUnexpectedCreatorMapFailure({
      error,
      userId:
        options.userId,
    })

    return null
  }
}

/* =========================================================
 * Logging
 * ======================================================= */

/**
 * The underlying loader already logs the detailed database or
 * validation failure. This wrapper records only the stable
 * application-facing error contract to avoid duplicating raw
 * Supabase details.
 */
function logExpectedCreatorMapFailure({
  error,
  userId,
}: {
  error: PublicCreatorMapLoadError
  userId: string
}): void {
  console.warn(
    '[safelyLoadPublicCreatorMap] Public creator map was omitted:',
    {
      userId:
        normalizeLogIdentifier(
          userId
        ),

      code:
        error.code,

      message:
        error.message,
    }
  )
}

/**
 * Unexpected failures are logged server-side with a serialized,
 * bounded representation.
 *
 * Public callers still receive `null`.
 */
function logUnexpectedCreatorMapFailure({
  error,
  userId,
}: {
  error: unknown
  userId: string
}): void {
  console.error(
    '[safelyLoadPublicCreatorMap] Unexpected public creator map failure:',
    {
      userId:
        normalizeLogIdentifier(
          userId
        ),

      error:
        serializeUnknownError(
          error
        ),
    }
  )
}

/* =========================================================
 * Internal helpers
 * ======================================================= */

function normalizeLogIdentifier(
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

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    200
  )
}

function serializeUnknownError(
  error: unknown
): Record<
  string,
  unknown
> {
  if (
    error instanceof
    Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,

      cause:
        serializeErrorCause(
          error.cause
        ),
    }
  }

  if (isRecord(error)) {
    return {
      code:
        normalizeLogValue(
          error.code
        ),

      message:
        normalizeLogValue(
          error.message
        ),

      details:
        normalizeLogValue(
          error.details
        ),

      hint:
        normalizeLogValue(
          error.hint
        ),
    }
  }

  return {
    value:
      normalizeLogValue(
        error
      ),
  }
}

function serializeErrorCause(
  cause: unknown
): unknown {
  if (
    cause === null ||
    cause === undefined
  ) {
    return undefined
  }

  if (
    cause instanceof
    Error
  ) {
    return {
      name:
        cause.name,

      message:
        cause.message,
    }
  }

  if (isRecord(cause)) {
    return {
      code:
        normalizeLogValue(
          cause.code
        ),

      message:
        normalizeLogValue(
          cause.message
        ),

      details:
        normalizeLogValue(
          cause.details
        ),

      hint:
        normalizeLogValue(
          cause.hint
        ),
    }
  }

  return normalizeLogValue(
    cause
  )
}

function normalizeLogValue(
  value: unknown
): string | number | boolean | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  if (
    typeof value ===
      'string'
  ) {
    return value.slice(
      0,
      1_000
    )
  }

  if (
    typeof value ===
      'number'
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null
  }

  if (
    typeof value ===
      'boolean'
  ) {
    return value
  }

  return String(
    value
  ).slice(
    0,
    1_000
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