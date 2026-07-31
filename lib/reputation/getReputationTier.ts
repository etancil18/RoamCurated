import {
  getNextReputationLevel,
  getReputationLevelDefinition,
  getReputationLevelProgress,
  resolveReputationLevel,
} from './policy'

import type {
  ReputationCategoryId,
  ReputationLevel,
  ReputationLevelDefinition,
  ReputationScoreComponents,
  ReputationScope,
} from './types'

/**
 * Canonical reputation-tier projection.
 *
 * This module translates already-calculated reputation data into
 * stable tier metadata suitable for:
 *
 * - public profiles
 * - creator profiles
 * - Passport surfaces
 * - leaderboard rows
 * - reputation cards
 * - progress indicators
 *
 * This module intentionally contains:
 *
 * - no Supabase client
 * - no database queries
 * - no React
 * - no independent scoring rules
 * - no percentile or rank calculations
 *
 * Tier qualification remains exclusively owned by policy.ts.
 */

/* =========================================================
 * Public contracts
 * ======================================================= */

/**
 * Stable display-ready tier result.
 *
 * `tier` and `level` intentionally reference the same canonical
 * value. `tier` is retained for presentation-oriented callers,
 * while `level` remains aligned with the reputation domain.
 */
export type ReputationTierResult = {
  tier: ReputationLevel
  level: ReputationLevel

  label: string
  shortLabel: string
  description: string

  /**
   * Stable ascending tier order.
   *
   * unranked   -> 0
   * emerging   -> 1
   * established -> 2
   * expert     -> 3
   * elite      -> 4
   */
  sortOrder: number

  /**
   * True only after the user satisfies the minimum public
   * category-reputation requirements.
   */
  isEarned: boolean

  /**
   * True only for the highest available tier.
   */
  isMaximumTier: boolean

  nextTier: ReputationLevel | null
  nextTierLabel: string | null

  currentThreshold: number
  nextThreshold: number | null

  score: number
  scoreProgress: number
  scoreRemaining: number
  progressPercent: number

  verifiedVenueCount: number
  weightedVenueCount: number
}

/**
 * Minimal input required when the caller already knows the
 * canonical reputation level.
 */
export type GetReputationTierFromLevelInput = {
  level: ReputationLevel

  /**
   * Optional score and evidence metadata.
   *
   * These values are presentation-only in this path and do not
   * recalculate qualification.
   */
  score?: number
  verifiedVenueCount?: number
  weightedVenueCount?: number
}

/**
 * Full policy-aware tier calculation input.
 *
 * Use this when the caller has reputation components and wants
 * this module to resolve the canonical tier through policy.ts.
 */
export type GetReputationTierInput = {
  categoryId: ReputationCategoryId
  scope: ReputationScope
  score: number
  components: ReputationScoreComponents
}

/* =========================================================
 * Canonical tier resolution
 * ======================================================= */

/**
 * Resolves a display-ready reputation tier from score components.
 *
 * This is the preferred entry point when the caller has the
 * canonical score components available.
 *
 * The function delegates all qualification and threshold logic
 * to policy.ts.
 */
export function getReputationTier({
  categoryId,
  scope,
  score,
  components,
}: GetReputationTierInput): ReputationTierResult {
  const normalizedComponents =
    normalizeScoreComponents(
      components
    )

  const normalizedScore =
    normalizeNonNegativeNumber(
      score
    )

  const progress =
    getReputationLevelProgress({
      categoryId,
      scope,
      score:
        normalizedScore,
      components:
        normalizedComponents,
    })

  const definition =
    getReputationLevelDefinition(
      progress.currentLevel
    )

  const nextDefinition =
    progress.nextLevel
      ? getReputationLevelDefinition(
          progress.nextLevel
        )
      : null

  return buildTierResult({
    definition,

    nextDefinition,

    score:
      normalizedScore,

    currentThreshold:
      progress.currentThreshold,

    nextThreshold:
      progress.nextThreshold,

    scoreProgress:
      progress.scoreProgress,

    scoreRemaining:
      progress.scoreRemaining,

    progressPercent:
      progress.progressPercent,

    verifiedVenueCount:
      normalizedComponents
        .verifiedVenueCount,

    weightedVenueCount:
      normalizedComponents
        .weightedVenueCount,
  })
}

/**
 * Resolves only the canonical level identifier.
 *
 * This is useful for persistence and comparison code that does
 * not need display labels or progress metadata.
 */
export function getReputationLevel({
  categoryId,
  scope,
  score,
  components,
}: GetReputationTierInput): ReputationLevel {
  return resolveReputationLevel({
    categoryId,
    scope,
    score:
      normalizeNonNegativeNumber(
        score
      ),
    components:
      normalizeScoreComponents(
        components
      ),
  })
}

/* =========================================================
 * Existing-level projection
 * ======================================================= */

/**
 * Builds a display-ready tier projection from an already-known
 * canonical level.
 *
 * This function does not recalculate qualification. Use it only
 * when the level originated from trusted canonical reputation
 * data.
 */
export function getReputationTierFromLevel({
  level,
  score = 0,
  verifiedVenueCount = 0,
  weightedVenueCount = 0,
}: GetReputationTierFromLevelInput): ReputationTierResult {
  const definition =
    getReputationLevelDefinition(
      level
    )

  const nextLevel =
    getNextReputationLevel(
      level
    )

  const nextDefinition =
    nextLevel
      ? getReputationLevelDefinition(
          nextLevel
        )
      : null

  const normalizedScore =
    normalizeNonNegativeNumber(
      score
    )

  return buildTierResult({
    definition,

    nextDefinition,

    score:
      normalizedScore,

    /**
     * This path intentionally avoids reconstructing policy
     * thresholds from duplicated constants.
     *
     * Callers needing exact threshold progress must use
     * getReputationTier().
     */
    currentThreshold:
      0,

    nextThreshold:
      null,

    scoreProgress:
      normalizedScore,

    scoreRemaining:
      0,

    progressPercent:
      level ===
        'elite'
        ? 100
        : 0,

    verifiedVenueCount:
      normalizeCount(
        verifiedVenueCount
      ),

    weightedVenueCount:
      normalizeNonNegativeNumber(
        weightedVenueCount
      ),
  })
}

/* =========================================================
 * Tier metadata helpers
 * ======================================================= */

/**
 * Returns the canonical public definition for one reputation
 * level.
 */
export function getReputationTierDefinition(
  level: ReputationLevel
): ReputationLevelDefinition {
  return getReputationLevelDefinition(
    level
  )
}

/**
 * Returns the next canonical tier or null when the user is
 * already elite.
 */
export function getNextReputationTier(
  level: ReputationLevel
): ReputationLevel | null {
  return getNextReputationLevel(
    level
  )
}

/**
 * Returns whether the level represents earned public
 * reputation.
 */
export function isEarnedReputationTier(
  level: ReputationLevel
): boolean {
  return level !==
    'unranked'
}

/**
 * Returns whether the user has reached the maximum canonical
 * reputation tier.
 */
export function isMaximumReputationTier(
  level: ReputationLevel
): boolean {
  return level ===
    'elite'
}

/**
 * Compares two reputation levels using the canonical tier order.
 *
 * Returns:
 *
 * - a negative value when first is lower
 * - zero when equal
 * - a positive value when first is higher
 */
export function compareReputationTiers(
  first: ReputationLevel,
  second: ReputationLevel
): number {
  const firstDefinition =
    getReputationLevelDefinition(
      first
    )

  const secondDefinition =
    getReputationLevelDefinition(
      second
    )

  return (
    firstDefinition.sortOrder -
    secondDefinition.sortOrder
  )
}

/**
 * Returns the higher of two canonical reputation levels.
 */
export function getHigherReputationTier(
  first: ReputationLevel,
  second: ReputationLevel
): ReputationLevel {
  return compareReputationTiers(
    first,
    second
  ) >= 0
    ? first
    : second
}

/**
 * Returns whether `current` meets or exceeds `minimum`.
 */
export function meetsMinimumReputationTier({
  current,
  minimum,
}: {
  current: ReputationLevel
  minimum: ReputationLevel
}): boolean {
  return compareReputationTiers(
    current,
    minimum
  ) >= 0
}

/* =========================================================
 * Safe fallback
 * ======================================================= */

/**
 * Creates the canonical empty reputation tier.
 *
 * Use for loading, missing-data, and fail-safe states.
 */
export function createEmptyReputationTier():
  ReputationTierResult {
  return getReputationTierFromLevel({
    level:
      'unranked',
  })
}

/* =========================================================
 * Internal result builder
 * ======================================================= */

function buildTierResult({
  definition,
  nextDefinition,
  score,
  currentThreshold,
  nextThreshold,
  scoreProgress,
  scoreRemaining,
  progressPercent,
  verifiedVenueCount,
  weightedVenueCount,
}: {
  definition:
    ReputationLevelDefinition

  nextDefinition:
    ReputationLevelDefinition | null

  score:
    number

  currentThreshold:
    number

  nextThreshold:
    number | null

  scoreProgress:
    number

  scoreRemaining:
    number

  progressPercent:
    number

  verifiedVenueCount:
    number

  weightedVenueCount:
    number
}): ReputationTierResult {
  const level =
    definition.id

  return {
    tier:
      level,

    level,

    label:
      normalizeRequiredText(
        definition.label
      ),

    shortLabel:
      normalizeRequiredText(
        definition.shortLabel
      ),

    description:
      normalizeRequiredText(
        definition.description
      ),

    sortOrder:
      normalizeCount(
        definition.sortOrder
      ),

    isEarned:
      isEarnedReputationTier(
        level
      ),

    isMaximumTier:
      isMaximumReputationTier(
        level
      ),

    nextTier:
      nextDefinition
        ?.id ??
      null,

    nextTierLabel:
      nextDefinition
        ? normalizeRequiredText(
            nextDefinition.label
          )
        : null,

    currentThreshold:
      normalizeNonNegativeNumber(
        currentThreshold
      ),

    nextThreshold:
      nextThreshold ===
        null
        ? null
        : normalizeNonNegativeNumber(
            nextThreshold
          ),

    score:
      roundToPrecision(
        score,
        2
      ),

    scoreProgress:
      roundToPrecision(
        scoreProgress,
        2
      ),

    scoreRemaining:
      roundToPrecision(
        scoreRemaining,
        2
      ),

    progressPercent:
      normalizePercent(
        progressPercent
      ),

    verifiedVenueCount:
      normalizeCount(
        verifiedVenueCount
      ),

    weightedVenueCount:
      roundToPrecision(
        normalizeNonNegativeNumber(
          weightedVenueCount
        ),
        4
      ),
  }
}

/* =========================================================
 * Internal normalization
 * ======================================================= */

function normalizeScoreComponents(
  components:
    ReputationScoreComponents
): ReputationScoreComponents {
  return {
    verifiedVenueCount:
      normalizeCount(
        components
          .verifiedVenueCount
      ),

    weightedVenueCount:
      normalizeNonNegativeNumber(
        components
          .weightedVenueCount
      ),

    cityCount:
      normalizeCount(
        components
          .cityCount
      ),

    publicCollectionCount:
      normalizeCount(
        components
          .publicCollectionCount
      ),

    curatedVenueCount:
      normalizeCount(
        components
          .curatedVenueCount
      ),

    publicSnapshotCount:
      normalizeCount(
        components
          .publicSnapshotCount
      ),

    completedFlowCount:
      normalizeCount(
        components
          .completedFlowCount
      ),

    recencyScore:
      normalizeNonNegativeNumber(
        components
          .recencyScore
      ),

    qualityScore:
      normalizeNonNegativeNumber(
        components
          .qualityScore
      ),
  }
}

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
    value <= 0
  ) {
    return 0
  }

  return Math.floor(
    value
  )
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

function normalizePercent(
  value:
    unknown
): number {
  return roundToPrecision(
    Math.min(
      100,
      Math.max(
        0,
        normalizeNonNegativeNumber(
          value
        )
      )
    ),
    2
  )
}

function normalizeRequiredText(
  value:
    unknown
): string {
  if (
    typeof value !==
      'string'
  ) {
    throw new Error(
      '[getReputationTier] Required tier text was invalid.'
    )
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (
    !normalized
  ) {
    throw new Error(
      '[getReputationTier] Required tier text was empty.'
    )
  }

  return normalized
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