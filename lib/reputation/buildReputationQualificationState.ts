/**
 * Canonical reputation qualification-state builder.
 *
 * Purpose:
 * - translates reputation evidence and policy thresholds into one
 *   deterministic presentation state
 * - explains why a creator is not yet ranked
 * - prevents UI components from inventing eligibility logic
 * - keeps reputation interpretation separate from Passport XP
 *
 * This file intentionally contains:
 * - no React
 * - no Supabase client
 * - no database queries
 * - no environment access
 *
 * All thresholds must be supplied from the active reputation policy.
 */

/* =========================================================
 * Public unions
 * ======================================================= */

export const REPUTATION_QUALIFICATION_STATES = [
  'no_reputation',
  'building_expertise',
  'eligible_for_status',
  'eligible_for_ranking',
  'ranked',
] as const

export type ReputationQualificationState =
  (typeof REPUTATION_QUALIFICATION_STATES)[number]

export const REPUTATION_QUALIFICATION_REASONS = [
  'no_evidence',
  'status_evidence_incomplete',
  'status_calculation_pending',
  'ranking_evidence_incomplete',
  'ranking_calculation_pending',
  'ranking_population_incomplete',
  'ranked',
] as const

export type ReputationQualificationReason =
  (typeof REPUTATION_QUALIFICATION_REASONS)[number]

export const REPUTATION_QUALIFICATION_SCOPES = [
  'global',
  'city',
] as const

export type ReputationQualificationScope =
  (typeof REPUTATION_QUALIFICATION_SCOPES)[number]

export const REPUTATION_QUALIFICATION_LEVELS = [
  'unranked',
  'emerging',
  'established',
  'expert',
  'elite',
] as const

export type ReputationQualificationLevel =
  (typeof REPUTATION_QUALIFICATION_LEVELS)[number]

/* =========================================================
 * Evidence metric contracts
 * ======================================================= */

/**
 * Canonical evidence metrics that may be used by policy
 * thresholds.
 *
 * Add new keys here only when the corresponding metric exists in
 * the canonical reputation evidence model.
 */
export const REPUTATION_EVIDENCE_METRIC_KEYS = [
  'verifiedVenueCount',
  'weightedVenueCount',
  'publicCollectionCount',
  'curatedVenueCount',
  'publicSnapshotCount',
  'completedFlowCount',
  'cityCount',
  'recencyScore',
  'qualityScore',
  'reputationScore',
] as const

export type ReputationEvidenceMetricKey =
  (typeof REPUTATION_EVIDENCE_METRIC_KEYS)[number]

export type ReputationQualificationEvidence = {
  verifiedVenueCount?: number | null
  weightedVenueCount?: number | null
  publicCollectionCount?: number | null
  curatedVenueCount?: number | null
  publicSnapshotCount?: number | null
  completedFlowCount?: number | null
  cityCount?: number | null
  recencyScore?: number | null
  qualityScore?: number | null
  reputationScore?: number | null
}

/* =========================================================
 * Policy contracts
 * ======================================================= */

/**
 * A single policy threshold.
 *
 * `metricLabel` describes the evidence in UI copy.
 *
 * Examples:
 * - "verified venue"
 * - "verified Coffee venue"
 * - "weighted venue point"
 */
export type ReputationQualificationThreshold = {
  metric: ReputationEvidenceMetricKey
  required: number

  metricLabelSingular: string
  metricLabelPlural: string
}

/**
 * Qualification policy for one category/scope combination.
 *
 * Status threshold:
 * - minimum evidence needed before an earned status can exist
 *
 * Ranking threshold:
 * - minimum creator evidence needed before the creator can enter
 *   the ranking population
 *
 * Minimum ranking population:
 * - minimum eligible creators needed before publishing a
 *   defensible rank
 */
export type ReputationQualificationPolicy = {
  status: ReputationQualificationThreshold

  ranking: ReputationQualificationThreshold

  minimumRankingPopulation: number
}

/* =========================================================
 * Builder input
 * ======================================================= */

export type BuildReputationQualificationStateInput = {
  scope: ReputationQualificationScope

  /**
   * Category identity.
   *
   * Null is allowed for an overall/general reputation state.
   */
  categoryId?: string | null
  categoryLabel?: string | null

  /**
   * City identity.
   *
   * Required for meaningful city-scoped copy, but the builder
   * safely falls back when it is unavailable.
   */
  cityKey?: string | null
  cityLabel?: string | null

  /**
   * Canonical evidence values.
   */
  evidence: ReputationQualificationEvidence

  /**
   * Active reputation policy thresholds.
   *
   * Never infer these values from current evidence.
   */
  policy: ReputationQualificationPolicy

  /**
   * Current calculated status.
   *
   * `unranked` means no earned status has been materialized yet.
   */
  reputationLevel?: ReputationQualificationLevel | null

  /**
   * Current rank, if ranking has been successfully calculated.
   *
   * Must be one-based.
   */
  rank?: number | null

  /**
   * Number of eligible creators in this exact ranking
   * population.
   */
  eligibleCreatorCount?: number | null

  /**
   * Optional top-percent value for a ranked creator.
   *
   * Expected range: 0 through 100.
   */
  topPercent?: number | null

  /**
   * Optional human-readable rank label already produced by the
   * ranking system.
   *
   * Example:
   * "Top 10% Atlanta Coffee Explorer"
   */
  rankLabel?: string | null

  /**
   * Calculation timestamps are used to distinguish:
   * - evidence threshold met but status calculation pending
   * - creator eligible but ranking calculation pending
   */
  statusCalculatedAt?: string | null
  rankingCalculatedAt?: string | null
}

/* =========================================================
 * Builder output
 * ======================================================= */

export type ReputationQualificationProgress = {
  state: ReputationQualificationState
  reason: ReputationQualificationReason

  title: string
  description: string

  scope: ReputationQualificationScope

  categoryId: string | null
  categoryLabel: string | null

  cityKey: string | null
  cityLabel: string | null

  reputationLevel: ReputationQualificationLevel

  /**
   * Progress for the threshold currently blocking advancement.
   *
   * Ranked states report complete progress.
   */
  current: number
  required: number
  remaining: number
  progressPercent: number

  /**
   * Threshold currently represented by the progress values.
   */
  progressMetric: ReputationEvidenceMetricKey
  progressMetricLabelSingular: string
  progressMetricLabelPlural: string

  statusEligible: boolean
  rankingEvidenceEligible: boolean
  rankingPopulationEligible: boolean
  ranked: boolean

  rank: number | null
  eligibleCreatorCount: number
  minimumRankingPopulation: number
  topPercent: number | null
  rankLabel: string | null

  statusCalculatedAt: string | null
  rankingCalculatedAt: string | null
}

/* =========================================================
 * Main builder
 * ======================================================= */

export function buildReputationQualificationState(
  input: BuildReputationQualificationStateInput
): ReputationQualificationProgress {
  const scope =
    normalizeScope(input.scope)

  const categoryId =
    normalizeNullableText(
      input.categoryId
    )

  const categoryLabel =
    normalizeNullableText(
      input.categoryLabel
    )

  const cityKey =
    normalizeNullableText(
      input.cityKey
    )

  const cityLabel =
    normalizeNullableText(
      input.cityLabel
    )

  const reputationLevel =
    normalizeReputationLevel(
      input.reputationLevel
    )

  const rank =
    normalizePositiveInteger(
      input.rank
    )

  const eligibleCreatorCount =
    normalizeNonNegativeInteger(
      input.eligibleCreatorCount
    ) ?? 0

  const topPercent =
    normalizePercentage(
      input.topPercent
    )

  const rankLabel =
    normalizeNullableText(
      input.rankLabel
    )

  const statusCalculatedAt =
    normalizeIsoTimestamp(
      input.statusCalculatedAt
    )

  const rankingCalculatedAt =
    normalizeIsoTimestamp(
      input.rankingCalculatedAt
    )

  const statusThreshold =
    normalizeThreshold(
      input.policy.status,
      'verified venue',
      'verified venues'
    )

  const rankingThreshold =
    normalizeThreshold(
      input.policy.ranking,
      'verified venue',
      'verified venues'
    )

  const minimumRankingPopulation =
    normalizePositiveInteger(
      input.policy
        .minimumRankingPopulation
    ) ?? 1

  const statusCurrent =
    readEvidenceMetric(
      input.evidence,
      statusThreshold.metric
    )

  const rankingCurrent =
    readEvidenceMetric(
      input.evidence,
      rankingThreshold.metric
    )

  const statusEligible =
    statusCurrent >=
    statusThreshold.required

  const hasEarnedStatus =
    reputationLevel !==
    'unranked'

  const rankingEvidenceEligible =
    rankingCurrent >=
    rankingThreshold.required

  const rankingPopulationEligible =
    eligibleCreatorCount >=
    minimumRankingPopulation

  const hasPublishedRank =
    rank !== null &&
    eligibleCreatorCount > 0

  const hasEvidence =
    hasMeaningfulEvidence(
      input.evidence
    )

  if (hasPublishedRank) {
    return buildRankedState({
      scope,
      categoryId,
      categoryLabel,
      cityKey,
      cityLabel,
      reputationLevel,
      rank,
      eligibleCreatorCount,
      topPercent,
      rankLabel,
      statusCalculatedAt,
      rankingCalculatedAt,
      statusThreshold,
      rankingThreshold,
      statusEligible,
      rankingEvidenceEligible,
      rankingPopulationEligible,
      minimumRankingPopulation,
    })
  }

  if (!hasEvidence) {
    return buildNoReputationState({
      scope,
      categoryId,
      categoryLabel,
      cityKey,
      cityLabel,
      reputationLevel,
      eligibleCreatorCount,
      topPercent,
      rankLabel,
      statusCalculatedAt,
      rankingCalculatedAt,
      statusThreshold,
      statusEligible,
      rankingEvidenceEligible,
      rankingPopulationEligible,
      minimumRankingPopulation,
    })
  }

  if (!statusEligible) {
    return buildStatusEvidenceIncompleteState({
      scope,
      categoryId,
      categoryLabel,
      cityKey,
      cityLabel,
      reputationLevel,
      eligibleCreatorCount,
      topPercent,
      rankLabel,
      statusCalculatedAt,
      rankingCalculatedAt,
      statusThreshold,
      statusCurrent,
      rankingEvidenceEligible,
      rankingPopulationEligible,
      minimumRankingPopulation,
    })
  }

  if (!hasEarnedStatus) {
    return buildStatusCalculationPendingState({
      scope,
      categoryId,
      categoryLabel,
      cityKey,
      cityLabel,
      reputationLevel,
      eligibleCreatorCount,
      topPercent,
      rankLabel,
      statusCalculatedAt,
      rankingCalculatedAt,
      statusThreshold,
      statusCurrent,
      rankingEvidenceEligible,
      rankingPopulationEligible,
      minimumRankingPopulation,
    })
  }

  if (!rankingEvidenceEligible) {
    return buildRankingEvidenceIncompleteState({
      scope,
      categoryId,
      categoryLabel,
      cityKey,
      cityLabel,
      reputationLevel,
      eligibleCreatorCount,
      topPercent,
      rankLabel,
      statusCalculatedAt,
      rankingCalculatedAt,
      rankingThreshold,
      rankingCurrent,
      statusEligible,
      rankingPopulationEligible,
      minimumRankingPopulation,
    })
  }

  if (!rankingPopulationEligible) {
    return buildRankingPopulationIncompleteState({
      scope,
      categoryId,
      categoryLabel,
      cityKey,
      cityLabel,
      reputationLevel,
      eligibleCreatorCount,
      topPercent,
      rankLabel,
      statusCalculatedAt,
      rankingCalculatedAt,
      rankingThreshold,
      rankingCurrent,
      statusEligible,
      rankingEvidenceEligible,
      minimumRankingPopulation,
    })
  }

  return buildRankingCalculationPendingState({
    scope,
    categoryId,
    categoryLabel,
    cityKey,
    cityLabel,
    reputationLevel,
    eligibleCreatorCount,
    topPercent,
    rankLabel,
    statusCalculatedAt,
    rankingCalculatedAt,
    rankingThreshold,
    rankingCurrent,
    statusEligible,
    rankingEvidenceEligible,
    rankingPopulationEligible,
    minimumRankingPopulation,
  })
}

/* =========================================================
 * State builders
 * ======================================================= */

type NormalizedStateContext = {
  scope: ReputationQualificationScope

  categoryId: string | null
  categoryLabel: string | null

  cityKey: string | null
  cityLabel: string | null

  reputationLevel: ReputationQualificationLevel

  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null

  statusCalculatedAt: string | null
  rankingCalculatedAt: string | null

  statusEligible: boolean
  rankingEvidenceEligible: boolean
  rankingPopulationEligible: boolean

  minimumRankingPopulation: number
}

function buildNoReputationState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  statusThreshold,
  statusEligible,
  rankingEvidenceEligible,
  rankingPopulationEligible,
  minimumRankingPopulation,
}: NormalizedStateContext & {
  statusThreshold: NormalizedThreshold
}): ReputationQualificationProgress {
  return {
    state:
      'no_reputation',

    reason:
      'no_evidence',

    title:
      'No reputation yet',

    description:
      buildNoEvidenceDescription({
        scope,
        categoryLabel,
        cityLabel,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current: 0,
    required:
      statusThreshold.required,
    remaining:
      statusThreshold.required,
    progressPercent: 0,

    progressMetric:
      statusThreshold.metric,

    progressMetricLabelSingular:
      statusThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      statusThreshold
        .metricLabelPlural,

    statusEligible,
    rankingEvidenceEligible,
    rankingPopulationEligible,
    ranked: false,

    rank: null,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

function buildStatusEvidenceIncompleteState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  statusThreshold,
  statusCurrent,
  rankingEvidenceEligible,
  rankingPopulationEligible,
  minimumRankingPopulation,
}: Omit<
  NormalizedStateContext,
  'statusEligible'
> & {
  statusThreshold: NormalizedThreshold
  statusCurrent: number
}): ReputationQualificationProgress {
  const remaining =
    calculateRemaining(
      statusCurrent,
      statusThreshold.required
    )

  return {
    state:
      'building_expertise',

    reason:
      'status_evidence_incomplete',

    title:
      buildExpertiseTitle({
        scope,
        categoryLabel,
        cityLabel,
      }),

    description:
      buildStatusProgressDescription({
        current:
          statusCurrent,

        remaining,

        scope,

        categoryLabel,
        cityLabel,

        threshold:
          statusThreshold,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current:
      statusCurrent,

    required:
      statusThreshold.required,

    remaining,

    progressPercent:
      calculateProgressPercent(
        statusCurrent,
        statusThreshold.required
      ),

    progressMetric:
      statusThreshold.metric,

    progressMetricLabelSingular:
      statusThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      statusThreshold
        .metricLabelPlural,

    statusEligible: false,
    rankingEvidenceEligible,
    rankingPopulationEligible,
    ranked: false,

    rank: null,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

function buildStatusCalculationPendingState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  statusThreshold,
  statusCurrent,
  rankingEvidenceEligible,
  rankingPopulationEligible,
  minimumRankingPopulation,
}: Omit<
  NormalizedStateContext,
  'statusEligible'
> & {
  statusThreshold: NormalizedThreshold
  statusCurrent: number
}): ReputationQualificationProgress {
  return {
    state:
      'eligible_for_status',

    reason:
      'status_calculation_pending',

    title:
      'Eligible for status',

    description:
      buildStatusEligibleDescription({
        scope,
        categoryLabel,
        cityLabel,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current:
      statusCurrent,

    required:
      statusThreshold.required,

    remaining: 0,
    progressPercent: 100,

    progressMetric:
      statusThreshold.metric,

    progressMetricLabelSingular:
      statusThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      statusThreshold
        .metricLabelPlural,

    statusEligible: true,
    rankingEvidenceEligible,
    rankingPopulationEligible,
    ranked: false,

    rank: null,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

function buildRankingEvidenceIncompleteState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  rankingThreshold,
  rankingCurrent,
  statusEligible,
  rankingPopulationEligible,
  minimumRankingPopulation,
}: Omit<
  NormalizedStateContext,
  'rankingEvidenceEligible'
> & {
  rankingThreshold: NormalizedThreshold
  rankingCurrent: number
}): ReputationQualificationProgress {
  const remaining =
    calculateRemaining(
      rankingCurrent,
      rankingThreshold.required
    )

  return {
    state:
      'eligible_for_ranking',

    reason:
      'ranking_evidence_incomplete',

    title:
      'Eligible for ranking',

    description:
      buildRankingEvidenceDescription({
        current:
          rankingCurrent,

        remaining,

        scope,

        categoryLabel,
        cityLabel,

        threshold:
          rankingThreshold,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current:
      rankingCurrent,

    required:
      rankingThreshold.required,

    remaining,

    progressPercent:
      calculateProgressPercent(
        rankingCurrent,
        rankingThreshold.required
      ),

    progressMetric:
      rankingThreshold.metric,

    progressMetricLabelSingular:
      rankingThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      rankingThreshold
        .metricLabelPlural,

    statusEligible,
    rankingEvidenceEligible: false,
    rankingPopulationEligible,
    ranked: false,

    rank: null,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

function buildRankingPopulationIncompleteState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  rankingThreshold,
  rankingCurrent,
  statusEligible,
  rankingEvidenceEligible,
  minimumRankingPopulation,
}: Omit<
  NormalizedStateContext,
  'rankingPopulationEligible'
> & {
  rankingThreshold: NormalizedThreshold
  rankingCurrent: number
}): ReputationQualificationProgress {
  const remainingPopulation =
    calculateRemaining(
      eligibleCreatorCount,
      minimumRankingPopulation
    )

  return {
    state:
      'eligible_for_ranking',

    reason:
      'ranking_population_incomplete',

    title:
      'Eligible for ranking',

    description:
      buildRankingPopulationDescription({
        categoryLabel,
        cityLabel,
        eligibleCreatorCount,
        minimumRankingPopulation,
        remainingPopulation,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current:
      rankingCurrent,

    required:
      rankingThreshold.required,

    remaining: 0,
    progressPercent: 100,

    progressMetric:
      rankingThreshold.metric,

    progressMetricLabelSingular:
      rankingThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      rankingThreshold
        .metricLabelPlural,

    statusEligible,
    rankingEvidenceEligible,
    rankingPopulationEligible: false,
    ranked: false,

    rank: null,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

function buildRankingCalculationPendingState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  rankingThreshold,
  rankingCurrent,
  statusEligible,
  rankingEvidenceEligible,
  rankingPopulationEligible,
  minimumRankingPopulation,
}: NormalizedStateContext & {
  rankingThreshold: NormalizedThreshold
  rankingCurrent: number
}): ReputationQualificationProgress {
  return {
    state:
      'eligible_for_ranking',

    reason:
      'ranking_calculation_pending',

    title:
      'Eligible for ranking',

    description:
      buildRankingPendingDescription({
        categoryLabel,
        cityLabel,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current:
      rankingCurrent,

    required:
      rankingThreshold.required,

    remaining: 0,
    progressPercent: 100,

    progressMetric:
      rankingThreshold.metric,

    progressMetricLabelSingular:
      rankingThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      rankingThreshold
        .metricLabelPlural,

    statusEligible,
    rankingEvidenceEligible,
    rankingPopulationEligible,
    ranked: false,

    rank: null,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

function buildRankedState({
  scope,
  categoryId,
  categoryLabel,
  cityKey,
  cityLabel,
  reputationLevel,
  rank,
  eligibleCreatorCount,
  topPercent,
  rankLabel,
  statusCalculatedAt,
  rankingCalculatedAt,
  rankingThreshold,
  statusEligible,
  rankingEvidenceEligible,
  rankingPopulationEligible,
  minimumRankingPopulation,
}: NormalizedStateContext & {
  rank: number
  statusThreshold: NormalizedThreshold
  rankingThreshold: NormalizedThreshold
}): ReputationQualificationProgress {
  return {
    state:
      'ranked',

    reason:
      'ranked',

    title:
      rankLabel ??
      'Ranked',

    description:
      buildRankedDescription({
        rank,
        eligibleCreatorCount,
        topPercent,
        categoryLabel,
        cityLabel,
      }),

    scope,

    categoryId,
    categoryLabel,

    cityKey,
    cityLabel,

    reputationLevel,

    current:
      rankingThreshold.required,

    required:
      rankingThreshold.required,

    remaining: 0,
    progressPercent: 100,

    progressMetric:
      rankingThreshold.metric,

    progressMetricLabelSingular:
      rankingThreshold
        .metricLabelSingular,

    progressMetricLabelPlural:
      rankingThreshold
        .metricLabelPlural,

    statusEligible,
    rankingEvidenceEligible,
    rankingPopulationEligible,
    ranked: true,

    rank,
    eligibleCreatorCount,
    minimumRankingPopulation,
    topPercent,
    rankLabel,

    statusCalculatedAt,
    rankingCalculatedAt,
  }
}

/* =========================================================
 * Presentation-copy builders
 * ======================================================= */

function buildNoEvidenceDescription({
  scope,
  categoryLabel,
  cityLabel,
}: {
  scope: ReputationQualificationScope
  categoryLabel: string | null
  cityLabel: string | null
}): string {
  if (
    scope === 'city' &&
    cityLabel &&
    categoryLabel
  ) {
    return `Build your ${cityLabel} ${categoryLabel} reputation by recording verified venue visits.`
  }

  if (
    scope === 'city' &&
    cityLabel
  ) {
    return `Build your ${cityLabel} reputation by recording verified venue visits.`
  }

  if (categoryLabel) {
    return `Build your ${categoryLabel} reputation by recording verified venue visits.`
  }

  return 'Build your Roam reputation by recording verified venue visits.'
}

function buildExpertiseTitle({
  scope,
  categoryLabel,
  cityLabel,
}: {
  scope: ReputationQualificationScope
  categoryLabel: string | null
  cityLabel: string | null
}): string {
  if (
    scope === 'city' &&
    cityLabel &&
    categoryLabel
  ) {
    return `Building ${cityLabel} ${categoryLabel} expertise`
  }

  if (
    scope === 'city' &&
    cityLabel
  ) {
    return `Building ${cityLabel} expertise`
  }

  if (categoryLabel) {
    return `Building ${categoryLabel} expertise`
  }

  return 'Building local expertise'
}

function buildStatusProgressDescription({
  current,
  remaining,
  scope,
  categoryLabel,
  cityLabel,
  threshold,
}: {
  current: number
  remaining: number

  scope: ReputationQualificationScope

  categoryLabel: string | null
  cityLabel: string | null

  threshold: NormalizedThreshold
}): string {
  const currentEvidence =
    formatMetricCount(
      current,
      threshold
    )

  const remainingEvidence =
    formatMetricCount(
      remaining,
      threshold
    )

  if (
    scope === 'city' &&
    cityLabel &&
    categoryLabel
  ) {
    return `${currentEvidence} in ${cityLabel} ${categoryLabel} — ${remainingEvidence} more to qualify for city status.`
  }

  if (
    scope === 'city' &&
    cityLabel
  ) {
    return `${currentEvidence} in ${cityLabel} — ${remainingEvidence} more to qualify for city status.`
  }

  if (categoryLabel) {
    return `${currentEvidence} in ${categoryLabel} — ${remainingEvidence} more to qualify for category status.`
  }

  return `${currentEvidence} — ${remainingEvidence} more to qualify for reputation status.`
}

function buildStatusEligibleDescription({
  scope,
  categoryLabel,
  cityLabel,
}: {
  scope: ReputationQualificationScope
  categoryLabel: string | null
  cityLabel: string | null
}): string {
  if (
    scope === 'city' &&
    cityLabel &&
    categoryLabel
  ) {
    return `You have enough verified ${cityLabel} ${categoryLabel} activity to receive a city reputation status.`
  }

  if (
    scope === 'city' &&
    cityLabel
  ) {
    return `You have enough verified ${cityLabel} activity to receive a city reputation status.`
  }

  if (categoryLabel) {
    return `You have enough verified ${categoryLabel} activity to receive a category reputation status.`
  }

  return 'You have enough verified activity to receive a reputation status.'
}

function buildRankingEvidenceDescription({
  current,
  remaining,
  scope,
  categoryLabel,
  cityLabel,
  threshold,
}: {
  current: number
  remaining: number

  scope: ReputationQualificationScope

  categoryLabel: string | null
  cityLabel: string | null

  threshold: NormalizedThreshold
}): string {
  const currentEvidence =
    formatMetricCount(
      current,
      threshold
    )

  const remainingEvidence =
    formatMetricCount(
      remaining,
      threshold
    )

  const rankingName =
    buildRankingName({
      scope,
      categoryLabel,
      cityLabel,
    })

  return `${currentEvidence} — ${remainingEvidence} more to enter ${rankingName}.`
}

function buildRankingPopulationDescription({
  categoryLabel,
  cityLabel,
  eligibleCreatorCount,
  minimumRankingPopulation,
  remainingPopulation,
}: {
  categoryLabel: string | null
  cityLabel: string | null

  eligibleCreatorCount: number
  minimumRankingPopulation: number
  remainingPopulation: number
}): string {
  const rankingName =
    buildRankingName({
      scope:
        cityLabel
          ? 'city'
          : 'global',

      categoryLabel,
      cityLabel,
    })

  const creatorLabel =
    eligibleCreatorCount === 1
      ? 'eligible creator'
      : 'eligible creators'

  const remainingLabel =
    remainingPopulation === 1
      ? 'eligible creator'
      : 'eligible creators'

  return `Your status qualifies for ${rankingName}. The population currently has ${eligibleCreatorCount.toLocaleString(
    'en-US'
  )} ${creatorLabel}; ${remainingPopulation.toLocaleString(
    'en-US'
  )} more ${remainingLabel} ${
    remainingPopulation === 1
      ? 'is'
      : 'are'
  } needed before ranks are published. Minimum population: ${minimumRankingPopulation.toLocaleString(
    'en-US'
  )}.`
}

function buildRankingPendingDescription({
  categoryLabel,
  cityLabel,
}: {
  categoryLabel: string | null
  cityLabel: string | null
}): string {
  const rankingName =
    buildRankingName({
      scope:
        cityLabel
          ? 'city'
          : 'global',

      categoryLabel,
      cityLabel,
    })

  return `You meet the evidence and population requirements for ${rankingName}. Your rank will appear after the next ranking calculation succeeds.`
}

function buildRankedDescription({
  rank,
  eligibleCreatorCount,
  topPercent,
  categoryLabel,
  cityLabel,
}: {
  rank: number
  eligibleCreatorCount: number
  topPercent: number | null
  categoryLabel: string | null
  cityLabel: string | null
}): string {
  const scopeLabel = [
    cityLabel,
    categoryLabel,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(value)
    )
    .join(' ')

  const explorerLabel =
    scopeLabel
      ? `${scopeLabel} explorers`
      : 'eligible creators'

  const parts = [
    `#${rank.toLocaleString(
      'en-US'
    )} of ${eligibleCreatorCount.toLocaleString(
      'en-US'
    )} ${explorerLabel}`,
  ]

  if (topPercent !== null) {
    parts.push(
      `Top ${formatPercentage(
        topPercent
      )}%`
    )
  }

  return parts.join(' · ')
}

function buildRankingName({
  scope,
  categoryLabel,
  cityLabel,
}: {
  scope: ReputationQualificationScope
  categoryLabel: string | null
  cityLabel: string | null
}): string {
  if (
    scope === 'city' &&
    cityLabel &&
    categoryLabel
  ) {
    return `${cityLabel} ${categoryLabel} rankings`
  }

  if (
    scope === 'city' &&
    cityLabel
  ) {
    return `${cityLabel} rankings`
  }

  if (categoryLabel) {
    return `${categoryLabel} rankings`
  }

  return 'Roam reputation rankings'
}

/* =========================================================
 * Public helper predicates
 * ======================================================= */

export function isReputationQualificationState(
  value: unknown
): value is ReputationQualificationState {
  return (
    typeof value ===
      'string' &&
    (
      REPUTATION_QUALIFICATION_STATES as readonly string[]
    ).includes(value)
  )
}

export function isReputationQualificationReason(
  value: unknown
): value is ReputationQualificationReason {
  return (
    typeof value ===
      'string' &&
    (
      REPUTATION_QUALIFICATION_REASONS as readonly string[]
    ).includes(value)
  )
}

export function isReputationQualificationRanked(
  value:
    | ReputationQualificationProgress
    | null
    | undefined
): boolean {
  return (
    value?.state ===
      'ranked' &&
    value.rank !== null
  )
}

export function isReputationQualificationPending(
  value:
    | ReputationQualificationProgress
    | null
    | undefined
): boolean {
  return (
    value?.reason ===
      'status_calculation_pending' ||
    value?.reason ===
      'ranking_calculation_pending'
  )
}

/* =========================================================
 * Evidence helpers
 * ======================================================= */

function hasMeaningfulEvidence(
  evidence: ReputationQualificationEvidence
): boolean {
  return REPUTATION_EVIDENCE_METRIC_KEYS.some(
    (metric) =>
      readEvidenceMetric(
        evidence,
        metric
      ) > 0
  )
}

function readEvidenceMetric(
  evidence: ReputationQualificationEvidence,
  metric: ReputationEvidenceMetricKey
): number {
  return (
    normalizeNonNegativeNumber(
      evidence[metric]
    ) ?? 0
  )
}

/* =========================================================
 * Threshold normalization
 * ======================================================= */

type NormalizedThreshold = {
  metric: ReputationEvidenceMetricKey
  required: number

  metricLabelSingular: string
  metricLabelPlural: string
}

function normalizeThreshold(
  threshold: ReputationQualificationThreshold,
  fallbackSingular: string,
  fallbackPlural: string
): NormalizedThreshold {
  return {
    metric:
      normalizeEvidenceMetricKey(
        threshold.metric
      ),

    required:
      normalizePositiveNumber(
        threshold.required
      ) ?? 1,

    metricLabelSingular:
      normalizeNullableText(
        threshold.metricLabelSingular
      ) ??
      fallbackSingular,

    metricLabelPlural:
      normalizeNullableText(
        threshold.metricLabelPlural
      ) ??
      fallbackPlural,
  }
}

function normalizeEvidenceMetricKey(
  value: unknown
): ReputationEvidenceMetricKey {
  if (
    typeof value ===
      'string' &&
    (
      REPUTATION_EVIDENCE_METRIC_KEYS as readonly string[]
    ).includes(value)
  ) {
    return value as ReputationEvidenceMetricKey
  }

  return 'verifiedVenueCount'
}

/* =========================================================
 * Numeric helpers
 * ======================================================= */

function calculateRemaining(
  current: number,
  required: number
): number {
  return Math.max(
    0,
    required - current
  )
}

function calculateProgressPercent(
  current: number,
  required: number
): number {
  if (required <= 0) {
    return 100
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (
          current /
          required
        ) * 100
      )
    )
  )
}

function normalizeFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  if (
    typeof value ===
      'string' &&
    value.trim().length > 0
  ) {
    const parsed =
      Number(value)

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function normalizeNonNegativeNumber(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(value)

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return normalized
}

function normalizePositiveNumber(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(value)

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return null
  }

  return normalized
}

function normalizeNonNegativeInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeNonNegativeNumber(
      value
    )

  return normalized === null
    ? null
    : Math.trunc(normalized)
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized =
    normalizePositiveNumber(
      value
    )

  return normalized === null
    ? null
    : Math.trunc(normalized)
}

function normalizePercentage(
  value: unknown
): number | null {
  const normalized =
    normalizeNonNegativeNumber(
      value
    )

  if (normalized === null) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

/* =========================================================
 * Text and timestamp helpers
 * ======================================================= */

function normalizeScope(
  value: unknown
): ReputationQualificationScope {
  return value === 'city'
    ? 'city'
    : 'global'
}

function normalizeReputationLevel(
  value: unknown
): ReputationQualificationLevel {
  if (
    typeof value !==
    'string'
  ) {
    return 'unranked'
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        '_'
      )

  if (
    (
      REPUTATION_QUALIFICATION_LEVELS as readonly string[]
    ).includes(normalized)
  ) {
    return normalized as ReputationQualificationLevel
  }

  return 'unranked'
}

function normalizeNullableText(
  value: unknown
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
      .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeIsoTimestamp(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const timestamp =
    Date.parse(value)

  if (
    Number.isNaN(timestamp)
  ) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}

/* =========================================================
 * Formatting helpers
 * ======================================================= */

function formatMetricCount(
  value: number,
  threshold: Pick<
    NormalizedThreshold,
    | 'metricLabelSingular'
    | 'metricLabelPlural'
  >
): string {
  const normalized =
    Math.max(
      0,
      value
    )

  const label =
    normalized === 1
      ? threshold
          .metricLabelSingular
      : threshold
          .metricLabelPlural

  return `${formatEvidenceNumber(
    normalized
  )} ${label}`
}

function formatEvidenceNumber(
  value: number
): string {
  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        Number.isInteger(value)
          ? 0
          : 1,
    }
  )
}

function formatPercentage(
  value: number
): string {
  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        value < 1
          ? 1
          : 0,
    }
  )
}