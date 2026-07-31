/**
 * Canonical Roam reputation domain contracts.
 *
 * This file intentionally contains:
 *
 * - no React
 * - no Supabase client
 * - no database queries
 * - no scoring calculations
 * - no percentile calculations
 * - no UI components
 *
 * Reputation calculation belongs in dedicated server-side
 * builders and rebuild functions.
 *
 * Public reputation loading belongs in dedicated public-safe
 * loaders.
 *
 * Reputation presentation belongs in profile, creator-profile,
 * Passport, and leaderboard components.
 */

/* =========================================================
 * Primitive domain values
 * ======================================================= */

/**
 * ISO-8601 timestamp serialized across the application boundary.
 *
 * Runtime validation must still occur when values originate from
 * the database, an API, or another untrusted source.
 */
export type ReputationIsoTimestamp =
  string

/**
 * Canonical city key.
 *
 * This remains a string rather than importing a city type from
 * another module so the reputation domain does not become
 * tightly coupled to UI or planning configuration.
 *
 * City-specific builders must validate values against Roam's
 * canonical supported-city source before producing public claims.
 */
export type ReputationCityKey =
  string

/* =========================================================
 * Canonical reputation categories
 * ======================================================= */

/**
 * Canonical V1 reputation-category identifiers.
 *
 * These values must remain aligned with:
 *
 * - public.reputation_categories.id
 * - public.venue_type_category_mappings.category_id
 * - public.venue_reputation_categories.category_id
 *
 * Do not rename an identifier after reputation evidence or
 * rankings have been generated. Add a migration and explicit
 * compatibility handling instead.
 */
export const REPUTATION_CATEGORY_IDS = [
  'coffee',
  'restaurants',
  'cocktail_bars',
  'wine_bars',
  'bars_pubs',
  'nightlife',
  'bakeries_desserts',
  'arts_culture',
  'books',
  'wellness_fitness',
  'outdoors',
  'markets_shopping',
  'activities_entertainment',
  'music_venues',
] as const

export type ReputationCategoryId =
  (typeof REPUTATION_CATEGORY_IDS)[number]

/**
 * Canonical category definition.
 *
 * This represents taxonomy metadata, not a user's earned status.
 */
export type ReputationCategory = {
  id: ReputationCategoryId

  /**
   * Internal category name.
   *
   * Example:
   *
   *   "Coffee"
   */
  name: string

  /**
   * Public-facing reputation label.
   *
   * Example:
   *
   *   "Coffee Explorer"
   */
  label: string

  /**
   * Concise plural label for metrics and filters.
   *
   * Example:
   *
   *   "Coffee"
   */
  shortLabel: string

  /**
   * Public-safe explanation of what activity contributes to the
   * category.
   */
  description: string

  /**
   * Stable presentation order.
   */
  sortOrder: number

  /**
   * Inactive categories remain valid historical identifiers but
   * must not receive new attribution or appear in new rankings.
   */
  isActive: boolean
}

/* =========================================================
 * Venue taxonomy assignments
 * ======================================================= */

/**
 * Canonical derived relationship connecting one venue to one
 * reputation category.
 *
 * This answers:
 *
 *   "Can activity at this venue contribute to this category?"
 *
 * It does not prove that a specific user visited the venue.
 */
export type VenueReputationCategoryAssignment = {
  venueId: string
  categoryId: ReputationCategoryId

  /**
   * Taxonomy confidence between 0 and 1.
   *
   * This is not user reputation points.
   */
  mappingWeight: number

  /**
   * Normalized venue types that supported the assignment.
   */
  matchedRawTypes: string[]

  matchedTypeCount: number

  createdAt: ReputationIsoTimestamp
  updatedAt: ReputationIsoTimestamp
}

/* =========================================================
 * Reputation evidence
 * ======================================================= */

/**
 * Canonical source through which reputation evidence was
 * established.
 *
 * Reputation should normally be rebuilt from the canonical
 * venue_visits relationship. The source remains useful for
 * auditing how that relationship originated.
 */
export const REPUTATION_EVIDENCE_SOURCES = [
  'venue_visit',
  'active_flow',
  'event_checkin',
  'crawl_checkin',
  'administrative_backfill',
  'unknown',
] as const

export type ReputationEvidenceSource =
  (typeof REPUTATION_EVIDENCE_SOURCES)[number]

/**
 * Attribution method used when a venue belongs to multiple
 * reputation categories.
 */
export const REPUTATION_ATTRIBUTION_METHODS = [
  'direct',
  'multi_category',
  'time_context',
  'manual_override',
] as const

export type ReputationAttributionMethod =
  (typeof REPUTATION_ATTRIBUTION_METHODS)[number]

/**
 * One auditable piece of user reputation evidence.
 *
 * Evidence records should be deterministic and rebuildable from
 * canonical source data.
 *
 * A single verified venue visit may produce multiple evidence
 * rows when the venue legitimately belongs to multiple
 * reputation categories.
 */
export type UserReputationEvidence = {
  id: string

  userId: string
  venueId: string
  categoryId: ReputationCategoryId

  /**
   * Canonical city used for city-scoped reputation.
   *
   * Null means the evidence may contribute globally but is not
   * eligible for a city-specific ranking.
   */
  cityKey: ReputationCityKey | null

  source: ReputationEvidenceSource

  attributionMethod:
    ReputationAttributionMethod

  /**
   * Final attribution confidence between 0 and 1.
   *
   * This may incorporate venue taxonomy confidence and later
   * contextual rules.
   */
  attributionWeight: number

  /**
   * Time at which the qualifying activity occurred.
   */
  occurredAt: ReputationIsoTimestamp

  /**
   * Stable canonical visit identifier when available.
   *
   * This allows evidence to be traced back to venue_visits
   * without exposing the identifier publicly.
   */
  venueVisitId: string | null

  createdAt: ReputationIsoTimestamp
  updatedAt: ReputationIsoTimestamp
}

/* =========================================================
 * Reputation scope
 * ======================================================= */

export const REPUTATION_SCOPES = [
  'global',
  'city',
] as const

export type ReputationScope =
  (typeof REPUTATION_SCOPES)[number]

/**
 * Identifies one ranking population.
 *
 * Global scopes must use cityKey = null.
 * City scopes must use a validated canonical city key.
 */
export type ReputationScopeDescriptor =
  | {
      scope: 'global'
      cityKey: null
    }
  | {
      scope: 'city'
      cityKey: ReputationCityKey
    }

/* =========================================================
 * Reputation score components
 * ======================================================= */

/**
 * Transparent component values used to produce a user's category
 * reputation score.
 *
 * The exact formula belongs in the scoring module, not here.
 */
export type ReputationScoreComponents = {
  /**
   * Number of distinct verified venues attributed to the
   * category and scope.
   */
  verifiedVenueCount: number

  /**
   * Sum of normalized attribution weights.
   */
  weightedVenueCount: number

  /**
   * Number of distinct qualifying cities.
   *
   * City-scoped rows will normally contain one.
   */
  cityCount: number

  /**
   * Public collections containing venues in this category.
   */
  publicCollectionCount: number

  /**
   * Distinct public collection venues in this category.
   */
  curatedVenueCount: number

  /**
   * Public completed-flow snapshots associated with the
   * category when that relationship is reliably available.
   */
  publicSnapshotCount: number

  /**
   * Completed flows containing at least one attributed venue in
   * the category.
   */
  completedFlowCount: number

  /**
   * Optional recency component controlled by the scoring layer.
   *
   * V1 may leave this at zero.
   */
  recencyScore: number

  /**
   * Optional quality component controlled by the scoring layer.
   *
   * V1 may leave this at zero.
   */
  qualityScore: number
}

/* =========================================================
 * Reputation levels
 * ======================================================= */

/**
 * Stable level identifiers.
 *
 * Public copy may evolve independently from these identifiers.
 *
 * The scoring layer owns the qualification thresholds.
 */
export const REPUTATION_LEVELS = [
  'unranked',
  'emerging',
  'established',
  'expert',
  'elite',
] as const

export type ReputationLevel =
  (typeof REPUTATION_LEVELS)[number]

export type ReputationLevelDefinition = {
  id: ReputationLevel
  label: string
  shortLabel: string
  description: string
  sortOrder: number
}

/* =========================================================
 * Canonical reputation aggregates
 * ======================================================= */

/**
 * Canonical reputation aggregate for one user, category, and
 * ranking scope.
 */
export type UserCategoryReputation = {
  userId: string
  categoryId: ReputationCategoryId

  scope: ReputationScope
  cityKey: ReputationCityKey | null

  score: number
  level: ReputationLevel

  components: ReputationScoreComponents

  /**
   * Timestamp of the user's latest qualifying evidence.
   */
  latestEvidenceAt: ReputationIsoTimestamp | null

  /**
   * Timestamp at which this aggregate was calculated.
   */
  calculatedAt: ReputationIsoTimestamp
}

/**
 * Overall reputation summary for one user.
 *
 * This is separate from category rankings and Passport XP.
 */
export type UserReputationSummary = {
  userId: string

  totalVerifiedVenueCount: number
  totalPublicCollectionCount: number
  totalCuratedVenueCount: number
  totalCompletedFlowCount: number
  totalPublicSnapshotCount: number

  qualifyingCityCount: number
  qualifyingCategoryCount: number

  overallScore: number
  overallLevel: ReputationLevel

  primaryCityKey: ReputationCityKey | null

  calculatedAt: ReputationIsoTimestamp
}

/* =========================================================
 * Ranking contracts
 * ======================================================= */

/**
 * Percentile values use a zero-to-100 scale.
 *
 * Example:
 *
 *   99.2 means the user ranks above approximately 99.2% of the
 *   eligible comparison population.
 */
export type ReputationPercentile =
  number

/**
 * Rank for one user in one category and scope.
 */
export type UserReputationRank = {
  userId: string
  categoryId: ReputationCategoryId

  scope: ReputationScope
  cityKey: ReputationCityKey | null

  /**
   * One-based ordinal rank.
   */
  rank: number

  eligibleUserCount: number

  percentile: ReputationPercentile

  score: number
  level: ReputationLevel

  calculatedAt: ReputationIsoTimestamp
}

/**
 * Public-safe ranking claim.
 *
 * This is intentionally separate from the raw rank object so
 * public loaders can suppress claims that do not meet minimum
 * population or evidence requirements.
 */
export type PublicReputationClaim = {
  categoryId: ReputationCategoryId

  scope: ReputationScope
  cityKey: ReputationCityKey | null

  /**
   * Public display label.
   *
   * Examples:
   *
   *   "Top 1% Atlanta Coffee Explorer"
   *   "Rank #18 Atlanta Coffee"
   */
  label: string

  rank: number | null
  percentile: ReputationPercentile | null
  eligibleUserCount: number

  verifiedVenueCount: number
  level: ReputationLevel
}

/* =========================================================
 * Public profile projection
 * ======================================================= */

/**
 * Public-safe category reputation displayed on a user's profile.
 *
 * Internal score components and private evidence identifiers are
 * intentionally excluded.
 */
export type PublicCategoryReputation = {
  categoryId: ReputationCategoryId
  categoryLabel: string

  scope: ReputationScope
  cityKey: ReputationCityKey | null
  cityLabel: string | null

  level: ReputationLevel
  levelLabel: string

  verifiedVenueCount: number
  curatedVenueCount: number
  publicCollectionCount: number

  rank: number | null
  percentile: ReputationPercentile | null
  eligibleUserCount: number | null

  publicClaim: PublicReputationClaim | null
}

/**
 * Complete public reputation payload for one public profile.
 *
 * The payload intentionally excludes:
 *
 * - user location evidence
 * - raw check-in coordinates
 * - visit ratings
 * - private collections
 * - private flow activity
 * - internal scoring components
 * - private database identifiers
 */
export type PublicUserReputation = {
  userId: string

  overallLevel: ReputationLevel
  overallLevelLabel: string

  totalVerifiedVenueCount: number
  totalPublicCollectionCount: number
  totalCuratedVenueCount: number
  totalCompletedFlowCount: number

  primaryCityKey: ReputationCityKey | null
  primaryCityLabel: string | null

  categories: PublicCategoryReputation[]
  claims: PublicReputationClaim[]

  calculatedAt: ReputationIsoTimestamp
}

/* =========================================================
 * Leaderboard contracts
 * ======================================================= */

export type ReputationLeaderboardEntry = {
  userId: string

  /**
   * Public username or stable profile slug.
   */
  username: string

  displayName: string
  avatarUrl: string | null

  categoryId: ReputationCategoryId

  scope: ReputationScope
  cityKey: ReputationCityKey | null

  rank: number
  percentile: ReputationPercentile
  eligibleUserCount: number

  level: ReputationLevel
  score: number

  verifiedVenueCount: number
  curatedVenueCount: number
  publicCollectionCount: number
}

export type ReputationLeaderboard = {
  categoryId: ReputationCategoryId
  categoryLabel: string

  scope: ReputationScope
  cityKey: ReputationCityKey | null
  cityLabel: string | null

  eligibleUserCount: number
  entries: ReputationLeaderboardEntry[]

  calculatedAt: ReputationIsoTimestamp
}

/* =========================================================
 * Rebuild result contracts
 * ======================================================= */

export type ReputationEvidenceRebuildResult = {
  userId: string

  evidenceCount: number
  distinctVenueCount: number
  categoryCount: number
  cityCount: number

  rebuiltAt: ReputationIsoTimestamp
}

export type ReputationAggregateRebuildResult = {
  userId: string

  categoryAggregateCount: number
  cityAggregateCount: number

  summary: UserReputationSummary

  rebuiltAt: ReputationIsoTimestamp
}

export type ReputationRankingRebuildResult = {
  scope: ReputationScope
  cityKey: ReputationCityKey | null

  categoryCount: number
  rankedUserCount: number

  rebuiltAt: ReputationIsoTimestamp
}

/* =========================================================
 * Type guards
 * ======================================================= */

export function isReputationCategoryId(
  value: unknown
): value is ReputationCategoryId {
  return (
    typeof value === 'string' &&
    (
      REPUTATION_CATEGORY_IDS as readonly string[]
    ).includes(value)
  )
}

export function isReputationEvidenceSource(
  value: unknown
): value is ReputationEvidenceSource {
  return (
    typeof value === 'string' &&
    (
      REPUTATION_EVIDENCE_SOURCES as readonly string[]
    ).includes(value)
  )
}

export function isReputationAttributionMethod(
  value: unknown
): value is ReputationAttributionMethod {
  return (
    typeof value === 'string' &&
    (
      REPUTATION_ATTRIBUTION_METHODS as readonly string[]
    ).includes(value)
  )
}

export function isReputationScope(
  value: unknown
): value is ReputationScope {
  return (
    typeof value === 'string' &&
    (
      REPUTATION_SCOPES as readonly string[]
    ).includes(value)
  )
}

export function isReputationLevel(
  value: unknown
): value is ReputationLevel {
  return (
    typeof value === 'string' &&
    (
      REPUTATION_LEVELS as readonly string[]
    ).includes(value)
  )
}

/* =========================================================
 * Empty-state helpers
 * ======================================================= */

export function createEmptyReputationScoreComponents():
  ReputationScoreComponents {
  return {
    verifiedVenueCount: 0,
    weightedVenueCount: 0,
    cityCount: 0,
    publicCollectionCount: 0,
    curatedVenueCount: 0,
    publicSnapshotCount: 0,
    completedFlowCount: 0,
    recencyScore: 0,
    qualityScore: 0,
  }
}

export function createEmptyUserReputationSummary(
  userId: string
): UserReputationSummary {
  return {
    userId,
    totalVerifiedVenueCount: 0,
    totalPublicCollectionCount: 0,
    totalCuratedVenueCount: 0,
    totalCompletedFlowCount: 0,
    totalPublicSnapshotCount: 0,
    qualifyingCityCount: 0,
    qualifyingCategoryCount: 0,
    overallScore: 0,
    overallLevel: 'unranked',
    primaryCityKey: null,
    calculatedAt:
      new Date(0).toISOString(),
  }
}

/* =========================================================
 * Public contract helpers
 * ======================================================= */

export function hasPublicReputation(
  reputation:
    PublicUserReputation | null | undefined
): reputation is PublicUserReputation {
  if (!reputation) {
    return false
  }

  return (
    reputation.totalVerifiedVenueCount > 0 ||
    reputation.totalPublicCollectionCount > 0 ||
    reputation.totalCuratedVenueCount > 0 ||
    reputation.totalCompletedFlowCount > 0 ||
    reputation.categories.length > 0 ||
    reputation.claims.length > 0
  )
}

export function hasPublishableReputationClaim(
  claim:
    PublicReputationClaim | null | undefined
): claim is PublicReputationClaim {
  if (!claim) {
    return false
  }

  return (
    claim.eligibleUserCount > 0 &&
    claim.verifiedVenueCount > 0 &&
    claim.label.trim().length > 0
  )
}