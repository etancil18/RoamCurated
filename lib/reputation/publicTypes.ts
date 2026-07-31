/**
 * Public reputation contracts.
 *
 * These types define the reputation data that may safely cross
 * the server-to-client boundary and appear on public profile,
 * Passport, authority, status, and leaderboard surfaces.
 *
 * Internal calculation inputs, evidence rows, scoring weights,
 * database implementation details, and administrative metadata
 * do not belong in this file.
 */

/* =========================================================
 * Core public primitives
 * ======================================================= */

/**
 * Reputation scopes currently supported by Roam.
 *
 * `global`
 *   Reputation calculated across the entire platform.
 *
 * `city`
 *   Reputation calculated within one normalized city.
 */
export type PublicReputationScope =
  | 'global'
  | 'city'

/**
 * Public reputation levels.
 *
 * `unranked` means the creator has not yet satisfied the
 * minimum eligibility requirements for a ranked status.
 */
export type PublicReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

/**
 * Rank direction used by public leaderboard surfaces.
 */
export type PublicReputationRankDirection =
  | 'ascending'
  | 'descending'

/**
 * Public rank presentation mode.
 *
 * `exact`
 *   Show an exact position such as "#18".
 *
 * `percentile`
 *   Show a percentile such as "Top 5%".
 *
 * `hidden`
 *   Do not display a public ranking claim.
 */
export type PublicReputationRankDisplay =
  | 'exact'
  | 'percentile'
  | 'hidden'

/* =========================================================
 * Public reputation-category metadata
 * ======================================================= */

/**
 * Canonical reputation-category metadata safe for public use.
 */
export type PublicReputationCategory = {
  /**
   * Stable canonical category identifier.
   *
   * Examples:
   *
   * - `coffee`
   * - `restaurants`
   * - `arts_culture`
   */
  id: string

  /**
   * Full public category label.
   *
   * Example:
   *
   * `Coffee Explorer`
   */
  label: string

  /**
   * Compact category label suitable for cards and chips.
   *
   * Example:
   *
   * `Coffee`
   */
  shortLabel: string

  /**
   * Public description of what activity contributes to the
   * category.
   */
  description: string | null

  /**
   * Stable display order controlled by the platform.
   */
  sortOrder: number
}

/* =========================================================
 * Public score components
 * ======================================================= */

/**
 * Sanitized public activity components that support a creator's
 * reputation.
 *
 * These are evidence summaries, not raw scoring internals.
 *
 * Do not add:
 *
 * - internal weights
 * - fraud signals
 * - moderation flags
 * - raw evidence identifiers
 * - hidden eligibility thresholds
 * - administrative notes
 */
export type PublicReputationEvidence = {
  /**
   * Number of distinct geo-verified venues contributing to the
   * reputation scope.
   */
  verifiedVenueCount: number

  /**
   * Weighted venue contribution after canonical category
   * attribution.
   *
   * This may be fractional because one venue can contribute to
   * multiple categories with different taxonomy weights.
   */
  weightedVenueCount: number

  /**
   * Number of public creator collections contributing to the
   * reputation scope.
   */
  publicCollectionCount: number

  /**
   * Number of distinct venues curated across qualifying public
   * collections.
   */
  curatedVenueCount: number

  /**
   * Number of qualifying public Flow snapshots.
   */
  publicSnapshotCount: number

  /**
   * Number of completed Flows contributing to reputation.
   */
  completedFlowCount: number

  /**
   * Number of normalized cities represented by the creator's
   * qualifying reputation activity.
   */
  cityCount: number
}

/* =========================================================
 * Public ranking
 * ======================================================= */

/**
 * Sanitized public ranking metadata.
 *
 * A ranking object may be omitted when the creator is ineligible,
 * the ranking population is too small, or the platform elects not
 * to expose a ranking claim.
 */
export type PublicReputationRanking = {
  /**
   * Exact one-based leaderboard position.
   *
   * Example:
   *
   * `18`
   */
  rank: number | null

  /**
   * Number of eligible creators in the relevant ranking
   * population.
   */
  eligibleCreatorCount: number

  /**
   * Percentile position represented from zero through 100.
   *
   * A value of `1` means Top 1%.
   */
  topPercent: number | null

  /**
   * Determines how the ranking should be presented publicly.
   */
  display: PublicReputationRankDisplay

  /**
   * Human-readable public rank label.
   *
   * Examples:
   *
   * - `#18`
   * - `Top 5%`
   * - `null`
   */
  label: string | null

  /**
   * ISO timestamp representing when this ranking population was
   * calculated.
   */
  calculatedAt: string | null
}

/* =========================================================
 * Public tier/status presentation
 * ======================================================= */

/**
 * Public reputation-tier metadata.
 */
export type PublicReputationTier = {
  level: PublicReputationLevel

  /**
   * Public tier label.
   *
   * Examples:
   *
   * - `Emerging Explorer`
   * - `Established Explorer`
   * - `Expert Explorer`
   * - `Elite Explorer`
   */
  label: string

  /**
   * Compact tier label.
   *
   * Examples:
   *
   * - `Emerging`
   * - `Expert`
   */
  shortLabel: string

  /**
   * Public explanation of the tier.
   */
  description: string | null

  /**
   * Whether the creator currently satisfies ranking
   * eligibility requirements.
   */
  ranked: boolean
}

/**
 * Display-ready status labels generated from canonical
 * reputation data.
 */
export type PublicReputationLabels = {
  /**
   * Primary public status label.
   *
   * Examples:
   *
   * - `Atlanta Coffee Expert`
   * - `Elite Restaurant Explorer`
   * - `Emerging Explorer`
   */
  primary: string

  /**
   * Optional compact status label.
   */
  compact: string | null

  /**
   * Optional city-focused status label.
   *
   * Example:
   *
   * `Atlanta Explorer`
   */
  city: string | null

  /**
   * Optional category-focused status label.
   *
   * Example:
   *
   * `Coffee Expert`
   */
  category: string | null

  /**
   * Optional ranking-focused label.
   *
   * Examples:
   *
   * - `#18 Atlanta Coffee`
   * - `Top 5% Atlanta Explorer`
   */
  ranking: string | null
}

/* =========================================================
 * Public category reputation record
 * ======================================================= */

/**
 * Canonical public reputation result for one creator, category,
 * and scope.
 */
export type PublicCreatorCategoryReputation = {
  /**
   * Canonical creator user ID.
   *
   * This is safe for application transport but should not be
   * displayed as public profile copy.
   */
  userId: string

  category: PublicReputationCategory

  scope: PublicReputationScope

  /**
   * Normalized city key for city-scoped reputation.
   *
   * Must be null for global scope.
   */
  cityKey: string | null

  /**
   * Human-readable city label.
   *
   * Example:
   *
   * `Atlanta`
   */
  cityLabel: string | null

  tier: PublicReputationTier

  labels: PublicReputationLabels

  evidence: PublicReputationEvidence

  /**
   * Sanitized final reputation score.
   *
   * This is suitable for ordering and public progress
   * presentation, but the internal component weights remain
   * private.
   */
  reputationScore: number

  /**
   * Ranking metadata, omitted when no defensible public ranking
   * is available.
   */
  ranking: PublicReputationRanking | null

  /**
   * Version of the reputation policy used to produce this
   * result.
   */
  policyVersion: number

  /**
   * ISO timestamp representing when the reputation record was
   * calculated.
   */
  calculatedAt: string
}

/* =========================================================
 * Public creator reputation summary
 * ======================================================= */

/**
 * Compact category summary used for profile cards, Passport
 * cards, chips, and lists.
 */
export type PublicCreatorReputationCategorySummary = {
  categoryId: string
  categoryLabel: string
  categoryShortLabel: string

  scope: PublicReputationScope
  cityKey: string | null
  cityLabel: string | null

  reputationLevel: PublicReputationLevel
  reputationScore: number

  primaryLabel: string
  compactLabel: string | null

  verifiedVenueCount: number
  weightedVenueCount: number

  rank: number | null
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null

  calculatedAt: string
}

/**
 * Public creator-wide reputation snapshot.
 *
 * This is the primary contract for profile and Passport
 * reputation surfaces.
 */
export type PublicCreatorReputationSnapshot = {
  userId: string

  /**
   * Creator's primary normalized city when one can be
   * defensibly determined.
   */
  primaryCityKey: string | null

  /**
   * Human-readable primary city.
   */
  primaryCityLabel: string | null

  /**
   * Strongest qualifying public reputation category.
   */
  primaryCategory:
    | PublicCreatorReputationCategorySummary
    | null

  /**
   * All qualifying public category statuses in canonical display
   * order.
   */
  categories:
    PublicCreatorReputationCategorySummary[]

  /**
   * Creator-wide reputation evidence totals.
   */
  evidence: PublicReputationEvidence

  /**
   * Strongest public tier earned across qualifying category
   * records.
   */
  highestLevel: PublicReputationLevel

  /**
   * Display-ready creator reputation headline.
   *
   * Examples:
   *
   * - `Atlanta Coffee Expert`
   * - `Top 5% Atlanta Explorer`
   * - `Emerging Explorer`
   */
  headline: string | null

  /**
   * Optional supporting public summary.
   *
   * Example:
   *
   * `47 verified venues · 6 public collections`
   */
  summary: string | null

  policyVersion: number
  calculatedAt: string | null
}

/* =========================================================
 * Public leaderboard contracts
 * ======================================================= */

/**
 * Public creator identity shown in reputation leaderboards.
 *
 * This contract intentionally excludes private profile fields.
 */
export type PublicReputationCreatorIdentity = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  profileHref: string
}

/**
 * One public leaderboard entry.
 */
export type PublicReputationLeaderboardEntry = {
  creator: PublicReputationCreatorIdentity

  category: PublicReputationCategory

  scope: PublicReputationScope
  cityKey: string | null
  cityLabel: string | null

  reputationLevel: PublicReputationLevel
  reputationScore: number

  verifiedVenueCount: number
  weightedVenueCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number

  rank: number
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string

  statusLabel: string
  calculatedAt: string
}

/**
 * Public leaderboard response contract.
 */
export type PublicReputationLeaderboard = {
  category: PublicReputationCategory

  scope: PublicReputationScope
  cityKey: string | null
  cityLabel: string | null

  policyVersion: number

  eligibleCreatorCount: number

  entries: PublicReputationLeaderboardEntry[]

  calculatedAt: string | null
}

/* =========================================================
 * Public reputation population metadata
 * ======================================================= */

/**
 * Public-safe aggregate metadata for one ranking population.
 *
 * This can support eligibility explanations and leaderboard
 * context without exposing private users or internal scoring
 * details.
 */
export type PublicReputationPopulation = {
  categoryId: string

  scope: PublicReputationScope
  cityKey: string | null
  cityLabel: string | null

  totalCreatorCount: number
  earnedCreatorCount: number
  eligibleCreatorCount: number
  unrankedCreatorCount: number

  emergingCreatorCount: number
  establishedCreatorCount: number
  expertCreatorCount: number
  eliteCreatorCount: number

  policyVersion: number
  calculatedAt: string | null
}

/* =========================================================
 * Public reputation API contracts
 * ======================================================= */

/**
 * Successful public reputation API payload.
 */
export type PublicCreatorReputationResponse = {
  reputation: PublicCreatorReputationSnapshot
}

/**
 * Successful category-detail API payload.
 */
export type PublicCreatorCategoryReputationResponse = {
  reputation: PublicCreatorCategoryReputation
}

/**
 * Successful leaderboard API payload.
 */
export type PublicReputationLeaderboardResponse = {
  leaderboard: PublicReputationLeaderboard
}

/**
 * Standard public reputation error payload.
 */
export type PublicReputationErrorResponse = {
  error: string
  details?: string
}

/* =========================================================
 * Type guards
 * ======================================================= */

export function isPublicReputationScope(
  value: unknown
): value is PublicReputationScope {
  return (
    value === 'global' ||
    value === 'city'
  )
}

export function isPublicReputationLevel(
  value: unknown
): value is PublicReputationLevel {
  return (
    value === 'unranked' ||
    value === 'emerging' ||
    value === 'established' ||
    value === 'expert' ||
    value === 'elite'
  )
}

export function isSnapshotVisibilityCompatibleScope({
  scope,
  cityKey,
}: {
  scope: PublicReputationScope
  cityKey: string | null
}): boolean {
  if (scope === 'global') {
    return cityKey === null
  }

  return (
    typeof cityKey === 'string' &&
    cityKey.trim().length > 0
  )
}

/* =========================================================
 * Safe empty values
 * ======================================================= */

export const EMPTY_PUBLIC_REPUTATION_EVIDENCE:
  PublicReputationEvidence = {
    verifiedVenueCount: 0,
    weightedVenueCount: 0,
    publicCollectionCount: 0,
    curatedVenueCount: 0,
    publicSnapshotCount: 0,
    completedFlowCount: 0,
    cityCount: 0,
  }

export function createEmptyPublicCreatorReputationSnapshot({
  userId,
  policyVersion,
}: {
  userId: string
  policyVersion: number
}): PublicCreatorReputationSnapshot {
  return {
    userId,
    primaryCityKey: null,
    primaryCityLabel: null,
    primaryCategory: null,
    categories: [],
    evidence: {
      ...EMPTY_PUBLIC_REPUTATION_EVIDENCE,
    },
    highestLevel: 'unranked',
    headline: null,
    summary: null,
    policyVersion:
      normalizeNonNegativeInteger(
        policyVersion
      ),
    calculatedAt: null,
  }
}

/* =========================================================
 * Internal normalization
 * ======================================================= */

function normalizeNonNegativeInteger(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0
  }

  return Math.trunc(value)
}