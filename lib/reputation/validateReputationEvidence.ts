import {
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

import {
  isReputationAttributionMethod,
  isReputationCategoryId,
  isReputationEvidenceSource,
  type ReputationAttributionMethod,
  type ReputationCategoryId,
  type ReputationCityKey,
  type ReputationEvidenceSource,
  type ReputationIsoTimestamp,
  type UserReputationEvidence,
} from './types'

/**
 * Canonical reputation-evidence validation.
 *
 * This module is the runtime trust boundary for evidence used by:
 *
 * - reputation rebuild jobs
 * - evidence persistence
 * - reputation aggregation
 * - migration and backfill tooling
 * - audit and diagnostics
 *
 * This module intentionally contains:
 *
 * - no React
 * - no Supabase client
 * - no database queries
 * - no scoring rules
 * - no ranking rules
 * - no public-label generation
 *
 * It validates structure and canonical domain invariants only.
 */

/* =========================================================
 * Validation policy
 * ======================================================= */

/**
 * Evidence timestamps may be slightly ahead of server time
 * because of ordinary client-clock drift.
 */
export const MAX_EVIDENCE_FUTURE_SKEW_MILLISECONDS =
  5 * 60 * 1000

/**
 * Identifier limit shared across evidence IDs, user IDs,
 * venue IDs, and canonical visit IDs.
 */
export const MAX_REPUTATION_EVIDENCE_IDENTIFIER_LENGTH =
  200

/* =========================================================
 * Validation reasons
 * ======================================================= */

export const REPUTATION_EVIDENCE_VALIDATION_REASONS = [
  'invalid_evidence',
  'invalid_id',
  'invalid_user_id',
  'invalid_venue_id',
  'invalid_category_id',
  'invalid_city_key',
  'invalid_source',
  'invalid_attribution_method',
  'invalid_attribution_weight',
  'invalid_occurred_at',
  'future_occurred_at',
  'invalid_venue_visit_id',
  'invalid_created_at',
  'invalid_updated_at',
  'updated_before_created',
  'occurred_after_updated',
  'duplicate_evidence',
  'conflicting_duplicate_evidence',
] as const

export type ReputationEvidenceValidationReason =
  (typeof REPUTATION_EVIDENCE_VALIDATION_REASONS)[number]

/* =========================================================
 * Validation contracts
 * ======================================================= */

export type ReputationEvidenceValidationIssue = {
  reason: ReputationEvidenceValidationReason

  /**
   * Dot-separated path into the validated value.
   *
   * Examples:
   *
   *   "categoryId"
   *   "evidence[4].occurredAt"
   */
  path: string

  /**
   * Diagnostic message for logs and tests.
   *
   * Do not expose this directly to public users.
   */
  message: string
}

export type ValidReputationEvidenceResult = {
  valid: true

  evidence: UserReputationEvidence

  issues: []
}

export type InvalidReputationEvidenceResult = {
  valid: false

  evidence: null

  issues: ReputationEvidenceValidationIssue[]
}

export type ReputationEvidenceValidationResult =
  | ValidReputationEvidenceResult
  | InvalidReputationEvidenceResult

export type ReputationEvidenceBatchValidationResult = {
  valid: boolean

  /**
   * Valid, normalized, and deduplicated evidence.
   */
  evidence: UserReputationEvidence[]

  /**
   * Every validation issue, including rejected rows and
   * conflicting duplicate evidence.
   */
  issues: ReputationEvidenceValidationIssue[]

  inputCount: number
  validInputCount: number
  invalidInputCount: number
  duplicateCount: number
  conflictingDuplicateCount: number
  outputCount: number
}

/* =========================================================
 * Trusted normalized input
 * ======================================================= */

/**
 * Runtime evidence input accepted by this module.
 *
 * Every field remains unknown because database and API data must
 * be validated at runtime rather than trusted through casts.
 */
export type ReputationEvidenceInput = {
  id?: unknown
  userId?: unknown
  venueId?: unknown
  categoryId?: unknown
  cityKey?: unknown
  source?: unknown
  attributionMethod?: unknown
  attributionWeight?: unknown
  occurredAt?: unknown
  venueVisitId?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

/* =========================================================
 * Single-row validation
 * ======================================================= */

/**
 * Validates and normalizes one reputation-evidence row.
 *
 * The function fails closed:
 *
 * - invalid fields are never silently replaced with defaults
 * - unsupported cities are rejected rather than treated as
 *   global evidence
 * - invalid timestamps are rejected
 * - attribution weight must remain within zero and one
 */
export function validateReputationEvidence(
  value: unknown,
  {
    now = new Date(),
    path = 'evidence',
  }: {
    now?: Date
    path?: string
  } = {}
): ReputationEvidenceValidationResult {
  const issues: ReputationEvidenceValidationIssue[] =
    []

  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(value)
  ) {
    return {
      valid:
        false,

      evidence:
        null,

      issues: [
        createIssue({
          reason:
            'invalid_evidence',

          path,

          message:
            'Reputation evidence must be a non-null object.',
        }),
      ],
    }
  }

  const input =
    value as ReputationEvidenceInput

  const id =
    validateRequiredIdentifier({
      value:
        input.id,

      path:
        `${path}.id`,

      reason:
        'invalid_id',

      issues,
    })

  const userId =
    validateRequiredIdentifier({
      value:
        input.userId,

      path:
        `${path}.userId`,

      reason:
        'invalid_user_id',

      issues,
    })

  const venueId =
    validateRequiredIdentifier({
      value:
        input.venueId,

      path:
        `${path}.venueId`,

      reason:
        'invalid_venue_id',

      issues,
    })

  const categoryId =
    validateCategoryId({
      value:
        input.categoryId,

      path:
        `${path}.categoryId`,

      issues,
    })

  const cityKey =
    validateCityKey({
      value:
        input.cityKey,

      path:
        `${path}.cityKey`,

      issues,
    })

  const source =
    validateEvidenceSource({
      value:
        input.source,

      path:
        `${path}.source`,

      issues,
    })

  const attributionMethod =
    validateAttributionMethod({
      value:
        input.attributionMethod,

      path:
        `${path}.attributionMethod`,

      issues,
    })

  const attributionWeight =
    validateAttributionWeight({
      value:
        input.attributionWeight,

      path:
        `${path}.attributionWeight`,

      issues,
    })

  const occurredAt =
    validateRequiredTimestamp({
      value:
        input.occurredAt,

      path:
        `${path}.occurredAt`,

      invalidReason:
        'invalid_occurred_at',

      issues,
    })

  const venueVisitId =
    validateNullableIdentifier({
      value:
        input.venueVisitId,

      path:
        `${path}.venueVisitId`,

      reason:
        'invalid_venue_visit_id',

      issues,
    })

  const createdAt =
    validateRequiredTimestamp({
      value:
        input.createdAt,

      path:
        `${path}.createdAt`,

      invalidReason:
        'invalid_created_at',

      issues,
    })

  const updatedAt =
    validateRequiredTimestamp({
      value:
        input.updatedAt,

      path:
        `${path}.updatedAt`,

      invalidReason:
        'invalid_updated_at',

      issues,
    })

  const nowMilliseconds =
    normalizeNowMilliseconds(
      now
    )

  if (
    occurredAt &&
    Date.parse(
      occurredAt
    ) >
      nowMilliseconds +
        MAX_EVIDENCE_FUTURE_SKEW_MILLISECONDS
  ) {
    issues.push(
      createIssue({
        reason:
          'future_occurred_at',

        path:
          `${path}.occurredAt`,

        message:
          'Evidence occurredAt is too far in the future.',
      })
    )
  }

  if (
    createdAt &&
    updatedAt &&
    Date.parse(
      updatedAt
    ) <
      Date.parse(
        createdAt
      )
  ) {
    issues.push(
      createIssue({
        reason:
          'updated_before_created',

        path:
          `${path}.updatedAt`,

        message:
          'Evidence updatedAt cannot be earlier than createdAt.',
      })
    )
  }

  if (
    occurredAt &&
    updatedAt &&
    Date.parse(
      occurredAt
    ) >
      Date.parse(
        updatedAt
      ) +
        MAX_EVIDENCE_FUTURE_SKEW_MILLISECONDS
  ) {
    issues.push(
      createIssue({
        reason:
          'occurred_after_updated',

        path:
          `${path}.occurredAt`,

        message:
          'Evidence occurredAt cannot materially exceed updatedAt.',
      })
    )
  }

  if (
    issues.length >
    0 ||
    !id ||
    !userId ||
    !venueId ||
    !categoryId ||
    !source ||
    !attributionMethod ||
    attributionWeight ===
      null ||
    !occurredAt ||
    !createdAt ||
    !updatedAt
  ) {
    return {
      valid:
        false,

      evidence:
        null,

      issues,
    }
  }

  return {
    valid:
      true,

    evidence: {
      id,
      userId,
      venueId,
      categoryId,
      cityKey,
      source,
      attributionMethod,
      attributionWeight,
      occurredAt,
      venueVisitId,
      createdAt,
      updatedAt,
    },

    issues: [],
  }
}

/* =========================================================
 * Batch validation
 * ======================================================= */

/**
 * Validates, normalizes, and deduplicates a batch of evidence.
 *
 * Duplicate identity:
 *
 *   userId + venueId + categoryId
 *
 * Exact semantic duplicates are collapsed.
 *
 * Conflicting duplicates are rejected from the output because
 * silently selecting one would make the rebuild non-auditable.
 */
export function validateReputationEvidenceBatch(
  value: unknown,
  {
    now = new Date(),
    path = 'evidence',
  }: {
    now?: Date
    path?: string
  } = {}
): ReputationEvidenceBatchValidationResult {
  if (
    !Array.isArray(
      value
    )
  ) {
    return {
      valid:
        false,

      evidence:
        [],

      issues: [
        createIssue({
          reason:
            'invalid_evidence',

          path,

          message:
            'Reputation evidence batch must be an array.',
        }),
      ],

      inputCount:
        0,

      validInputCount:
        0,

      invalidInputCount:
        0,

      duplicateCount:
        0,

      conflictingDuplicateCount:
        0,

      outputCount:
        0,
    }
  }

  const issues:
    ReputationEvidenceValidationIssue[] =
    []

  const evidenceByIdentity =
    new Map<
      string,
      {
        evidence: UserReputationEvidence
        index: number
        conflicted: boolean
      }
    >()

  let validInputCount =
    0

  let invalidInputCount =
    0

  let duplicateCount =
    0

  let conflictingDuplicateCount =
    0

  value.forEach(
    (
      entry,
      index
    ) => {
      const entryPath =
        `${path}[${index}]`

      const result =
        validateReputationEvidence(
          entry,
          {
            now,
            path:
              entryPath,
          }
        )

      if (
        !result.valid
      ) {
        invalidInputCount +=
          1

        issues.push(
          ...result.issues
        )

        return
      }

      validInputCount +=
        1

      const identityKey =
        createEvidenceIdentityKey(
          result.evidence
        )

      const existing =
        evidenceByIdentity.get(
          identityKey
        )

      if (
        !existing
      ) {
        evidenceByIdentity.set(
          identityKey,
          {
            evidence:
              result.evidence,

            index,

            conflicted:
              false,
          }
        )

        return
      }

      duplicateCount +=
        1

      if (
        evidenceSemanticallyEqual(
          existing.evidence,
          result.evidence
        )
      ) {
        issues.push(
          createIssue({
            reason:
              'duplicate_evidence',

            path:
              entryPath,

            message:
              `Duplicate reputation evidence matches ${path}[${existing.index}] and was collapsed.`,
          })
        )

        /**
         * Retain the row with the most recently updated
         * persistence metadata.
         */
        if (
          Date.parse(
            result.evidence
              .updatedAt
          ) >
          Date.parse(
            existing.evidence
              .updatedAt
          )
        ) {
          existing.evidence =
            result.evidence

          existing.index =
            index
        }

        return
      }

      conflictingDuplicateCount +=
        1

      existing.conflicted =
        true

      issues.push(
        createIssue({
          reason:
            'conflicting_duplicate_evidence',

          path:
            entryPath,

          message:
            `Evidence conflicts with ${path}[${existing.index}] for the same user, venue, and category identity.`,
        })
      )
    }
  )

  const evidence =
    [
      ...evidenceByIdentity
        .values(),
    ]
      .filter(
        (
          entry
        ) =>
          !entry.conflicted
      )
      .map(
        (
          entry
        ) =>
          entry.evidence
      )
      .sort(
        compareReputationEvidence
      )

  const hasBlockingIssues =
    issues.some(
      (
        issue
      ) =>
        issue.reason !==
        'duplicate_evidence'
    )

  return {
    valid:
      !hasBlockingIssues,

    evidence,

    issues,

    inputCount:
      value.length,

    validInputCount,

    invalidInputCount,

    duplicateCount,

    conflictingDuplicateCount,

    outputCount:
      evidence.length,
  }
}

/* =========================================================
 * Assertion helpers
 * ======================================================= */

/**
 * Returns normalized evidence or throws a diagnostic error.
 *
 * Use only inside trusted server rebuild code where malformed
 * evidence must abort the operation.
 */
export function assertValidReputationEvidence(
  value: unknown,
  options?: {
    now?: Date
    path?: string
  }
): UserReputationEvidence {
  const result =
    validateReputationEvidence(
      value,
      options
    )

  if (
    result.valid
  ) {
    return result.evidence
  }

  throw new ReputationEvidenceValidationError({
    message:
      'Invalid reputation evidence.',

    issues:
      result.issues,
  })
}

/**
 * Returns a normalized evidence batch or throws when any
 * blocking validation issue exists.
 *
 * Exact duplicates are allowed and collapsed.
 */
export function assertValidReputationEvidenceBatch(
  value: unknown,
  options?: {
    now?: Date
    path?: string
  }
): UserReputationEvidence[] {
  const result =
    validateReputationEvidenceBatch(
      value,
      options
    )

  if (
    result.valid
  ) {
    return result.evidence
  }

  throw new ReputationEvidenceValidationError({
    message:
      'Invalid reputation evidence batch.',

    issues:
      result.issues,
  })
}

/* =========================================================
 * Validation error
 * ======================================================= */

export class ReputationEvidenceValidationError
  extends Error {
  readonly issues:
    ReputationEvidenceValidationIssue[]

  constructor({
    message,
    issues,
    cause,
  }: {
    message: string

    issues:
      ReputationEvidenceValidationIssue[]

    cause?: unknown
  }) {
    super(
      message,
      {
        cause,
      }
    )

    this.name =
      'ReputationEvidenceValidationError'

    this.issues = [
      ...issues,
    ]
  }
}

/* =========================================================
 * Type guard
 * ======================================================= */

/**
 * Runtime type guard for already-normalized evidence.
 */
export function isValidReputationEvidence(
  value: unknown
): value is UserReputationEvidence {
  return validateReputationEvidence(
    value
  ).valid
}

/* =========================================================
 * Identity and comparison helpers
 * ======================================================= */

/**
 * Creates the canonical evidence identity used for
 * deduplication.
 *
 * A single visit may produce multiple category evidence rows,
 * but never multiple rows for the same venue and category.
 */
export function createReputationEvidenceIdentityKey(
  evidence:
    Pick<
      UserReputationEvidence,
      | 'userId'
      | 'venueId'
      | 'categoryId'
    >
): string {
  return createEvidenceIdentityKey(
    evidence
  )
}

/**
 * Compares normalized evidence in stable rebuild order.
 */
export function compareReputationEvidence(
  first:
    UserReputationEvidence,
  second:
    UserReputationEvidence
): number {
  return (
    first.userId.localeCompare(
      second.userId
    ) ||
    first.categoryId.localeCompare(
      second.categoryId
    ) ||
    first.venueId.localeCompare(
      second.venueId
    ) ||
    Date.parse(
      first.occurredAt
    ) -
      Date.parse(
        second.occurredAt
      ) ||
    first.id.localeCompare(
      second.id
    )
  )
}

/* =========================================================
 * Field validation
 * ======================================================= */

function validateRequiredIdentifier({
  value,
  path,
  reason,
  issues,
}: {
  value: unknown
  path: string

  reason:
    ReputationEvidenceValidationReason

  issues:
    ReputationEvidenceValidationIssue[]
}): string | null {
  const normalized =
    normalizeIdentifier(
      value
    )

  if (
    normalized
  ) {
    return normalized
  }

  issues.push(
    createIssue({
      reason,
      path,
      message:
        'A valid non-empty identifier is required.',
    })
  )

  return null
}

function validateNullableIdentifier({
  value,
  path,
  reason,
  issues,
}: {
  value: unknown
  path: string

  reason:
    ReputationEvidenceValidationReason

  issues:
    ReputationEvidenceValidationIssue[]
}): string | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  const normalized =
    normalizeIdentifier(
      value
    )

  if (
    normalized
  ) {
    return normalized
  }

  issues.push(
    createIssue({
      reason,
      path,
      message:
        'The optional identifier was malformed.',
    })
  )

  return null
}

function validateCategoryId({
  value,
  path,
  issues,
}: {
  value: unknown
  path: string

  issues:
    ReputationEvidenceValidationIssue[]
}): ReputationCategoryId | null {
  if (
    isReputationCategoryId(
      value
    )
  ) {
    return value
  }

  issues.push(
    createIssue({
      reason:
        'invalid_category_id',

      path,

      message:
        'Evidence categoryId is not a canonical reputation category.',
    })
  )

  return null
}

function validateCityKey({
  value,
  path,
  issues,
}: {
  value: unknown
  path: string

  issues:
    ReputationEvidenceValidationIssue[]
}): ReputationCityKey | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  if (
    typeof value !==
    'string'
  ) {
    issues.push(
      createIssue({
        reason:
          'invalid_city_key',

        path,

        message:
          'Evidence cityKey must be a string or null.',
      })
    )

    return null
  }

  const normalized =
    normalizeCityKey(
      value
    )

  if (
    !normalized ||
    !isSupportedCityKey(
      normalized
    )
  ) {
    issues.push(
      createIssue({
        reason:
          'invalid_city_key',

        path,

        message:
          'Evidence cityKey is not a supported canonical Roam city.',
      })
    )

    return null
  }

  return normalized
}

function validateEvidenceSource({
  value,
  path,
  issues,
}: {
  value: unknown
  path: string

  issues:
    ReputationEvidenceValidationIssue[]
}): ReputationEvidenceSource | null {
  if (
    isReputationEvidenceSource(
      value
    )
  ) {
    return value
  }

  issues.push(
    createIssue({
      reason:
        'invalid_source',

      path,

      message:
        'Evidence source is not canonical.',
    })
  )

  return null
}

function validateAttributionMethod({
  value,
  path,
  issues,
}: {
  value: unknown
  path: string

  issues:
    ReputationEvidenceValidationIssue[]
}): ReputationAttributionMethod | null {
  if (
    isReputationAttributionMethod(
      value
    )
  ) {
    return value
  }

  issues.push(
    createIssue({
      reason:
        'invalid_attribution_method',

      path,

      message:
        'Evidence attributionMethod is not canonical.',
    })
  )

  return null
}

function validateAttributionWeight({
  value,
  path,
  issues,
}: {
  value: unknown
  path: string

  issues:
    ReputationEvidenceValidationIssue[]
}): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >
      0 &&
    value <=
      1
  ) {
    return roundToPrecision(
      value,
      4
    )
  }

  issues.push(
    createIssue({
      reason:
        'invalid_attribution_weight',

      path,

      message:
        'Evidence attributionWeight must be greater than zero and no greater than one.',
    })
  )

  return null
}

function validateRequiredTimestamp({
  value,
  path,
  invalidReason,
  issues,
}: {
  value: unknown
  path: string

  invalidReason:
    ReputationEvidenceValidationReason

  issues:
    ReputationEvidenceValidationIssue[]
}): ReputationIsoTimestamp | null {
  const normalized =
    normalizeTimestamp(
      value
    )

  if (
    normalized
  ) {
    return normalized
  }

  issues.push(
    createIssue({
      reason:
        invalidReason,

      path,

      message:
        'A valid ISO-8601 timestamp is required.',
    })
  )

  return null
}

/* =========================================================
 * Duplicate semantics
 * ======================================================= */

function createEvidenceIdentityKey(
  evidence:
    Pick<
      UserReputationEvidence,
      | 'userId'
      | 'venueId'
      | 'categoryId'
    >
): string {
  return [
    evidence.userId,
    evidence.venueId,
    evidence.categoryId,
  ].join(
    ':'
  )
}

/**
 * Persistence IDs and persistence timestamps are deliberately
 * excluded from semantic equality.
 *
 * Two rows are equivalent when they represent the same
 * canonical reputation fact.
 */
function evidenceSemanticallyEqual(
  first:
    UserReputationEvidence,
  second:
    UserReputationEvidence
): boolean {
  return (
    first.userId ===
      second.userId &&
    first.venueId ===
      second.venueId &&
    first.categoryId ===
      second.categoryId &&
    first.cityKey ===
      second.cityKey &&
    first.source ===
      second.source &&
    first.attributionMethod ===
      second.attributionMethod &&
    roundToPrecision(
      first.attributionWeight,
      4
    ) ===
      roundToPrecision(
        second.attributionWeight,
        4
      ) &&
    first.occurredAt ===
      second.occurredAt &&
    first.venueVisitId ===
      second.venueVisitId
  )
}

/* =========================================================
 * General normalization
 * ======================================================= */

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
    normalized.length >
      MAX_REPUTATION_EVIDENCE_IDENTIFIER_LENGTH ||
    /[\r\n\t\0]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeTimestamp(
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
    !normalized
  ) {
    return null
  }

  const milliseconds =
    Date.parse(
      normalized
    )

  if (
    Number.isNaN(
      milliseconds
    )
  ) {
    return null
  }

  return new Date(
    milliseconds
  ).toISOString()
}

function normalizeNowMilliseconds(
  value: Date
): number {
  const milliseconds =
    value.getTime()

  return Number.isFinite(
    milliseconds
  )
    ? milliseconds
    : Date.now()
}

function createIssue({
  reason,
  path,
  message,
}: ReputationEvidenceValidationIssue):
  ReputationEvidenceValidationIssue {
  return {
    reason,
    path,
    message,
  }
}

function roundToPrecision(
  value: number,
  decimalPlaces: number
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