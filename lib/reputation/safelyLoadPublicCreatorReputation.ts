import 'server-only'

import {
  getPublicCreatorReputation,
  type GetPublicCreatorReputationOptions,
  type GetPublicCreatorReputationResult,
} from '@/lib/reputation/getPublicCreatorReputation'
import {
  createEmptyPublicCreatorReputationSnapshot,
} from '@/lib/reputation/publicTypes'

/**
 * Safely loads one creator's canonical public reputation.
 *
 * This wrapper:
 *
 * - preserves the return contract of getPublicCreatorReputation()
 * - prevents profile and Passport surfaces from crashing
 * - logs loader failures only on the server
 * - returns a stable empty reputation snapshot on failure
 * - never recalculates reputation
 * - never exposes database errors to public clients
 */
export async function safelyLoadPublicCreatorReputation(
  userId: string,
  options: GetPublicCreatorReputationOptions = {}
): Promise<GetPublicCreatorReputationResult> {
  const normalizedUserId =
    normalizeUserId(userId)

  const fallbackPolicyVersion =
    normalizePolicyVersion(
      options.policyVersion
    )

  if (!normalizedUserId) {
    console.error(
      '[safelyLoadPublicCreatorReputation] Reputation load skipped because userId was invalid.'
    )

    return createFallbackResult({
      userId: '',
      policyVersion:
        fallbackPolicyVersion,
    })
  }

  try {
    return await getPublicCreatorReputation(
      normalizedUserId,
      options
    )
  } catch (error) {
    console.error(
      '[safelyLoadPublicCreatorReputation] Failed to load public creator reputation:',
      {
        userId:
          normalizedUserId,

        requestedPolicyVersion:
          options.policyVersion ??
          null,

        includeUnranked:
          options.includeUnranked ??
          false,

        includeGlobal:
          options.includeGlobal ??
          true,

        includeCity:
          options.includeCity ??
          true,

        error:
          serializeError(
            error
          ),
      }
    )

    return createFallbackResult({
      userId:
        normalizedUserId,

      policyVersion:
        fallbackPolicyVersion,
    })
  }
}

/* =========================================================
 * Safe fallback
 * ======================================================= */

function createFallbackResult({
  userId,
  policyVersion,
}: {
  userId: string
  policyVersion: number
}): GetPublicCreatorReputationResult {
  return {
    reputation:
      createEmptyPublicCreatorReputationSnapshot({
        userId,
        policyVersion,
      }),

    found: false,
  }
}

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizeUserId(
  value: unknown
): string {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value.trim()
}

function normalizePolicyVersion(
  value: unknown
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

  return Math.trunc(
    value
  )
}

/* =========================================================
 * Error serialization
 * ======================================================= */

function serializeError(
  error: unknown
): Record<string, unknown> {
  if (
    error instanceof Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,

      stack:
        error.stack ??
        null,
    }
  }

  if (
    isRecord(
      error
    )
  ) {
    return {
      code:
        error.code ??
        null,

      message:
        error.message ??
        null,

      details:
        error.details ??
        null,

      hint:
        error.hint ??
        null,
    }
  }

  return {
    value:
      String(
        error
      ),
  }
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