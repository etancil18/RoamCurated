// lib/competitions/scoring.ts

import "server-only";

import {
  COMPETITION_ALGORITHM_VERSION,
  COMPETITION_SCORE_MAX,
  COMPETITION_SCORE_MIN,
  DEFAULT_COMPETITION_ALGORITHM_VERSION,
} from "./constants";

/**
 * Roam Taste Duel scoring.
 *
 * SERVER-SIDE ONLY.
 *
 * This module intentionally does NOT accept or use:
 *
 *   - follower count
 *   - likes
 *   - profile views
 *   - impressions
 *   - saves in v1
 *   - replay count in v1
 *   - creator audience size
 *   - social reach
 *   - creator reputation
 *
 * V1 scores only verified competition evidence:
 *
 *   1. route completion quality
 *   2. verified participant ratings
 *   3. verified "would repeat" intent
 *   4. verified head-to-head preference
 *   5. confidence based on evidence depth
 *
 * Design goals:
 *
 *   - deterministic
 *   - explainable
 *   - resistant to tiny-sample volatility
 *   - versionable
 *   - safe for immutable score snapshots
 *
 * Raw evidence should be gathered elsewhere from:
 *
 *   competition_participations
 *   competition_entry_ratings
 *   competition_head_to_head_preferences
 *
 * This module only scores the aggregate evidence it receives.
 */


// ============================================================
// ALGORITHM VERSIONING
// ============================================================

export const COMPETITION_SCORING_ALGORITHM_VERSION = {
  /**
   * Existing itinerary Taste Duel scoring.
   *
   * Behavior is immutable.
   */
  V1:
    DEFAULT_COMPETITION_ALGORITHM_VERSION,

  /**
   * Reserved canonical identifier for venue-participation scoring.
   *
   * IMPORTANT:
   *
   * This file does NOT implement this algorithm.
   *
   * Registering it here allows trusted orchestration code to share
   * one canonical algorithm-version type without accidentally
   * routing venue-participation evidence through taste_duel_v1.
   */
  VENUE_PARTICIPATION_V1:
    COMPETITION_ALGORITHM_VERSION
      .TASTE_DUEL_VENUE_PARTICIPATION_V1,
} as const;

export type CompetitionScoringAlgorithmVersion =
  (typeof COMPETITION_SCORING_ALGORITHM_VERSION)[keyof typeof COMPETITION_SCORING_ALGORITHM_VERSION];


// ============================================================
// V1 WEIGHTS
// ============================================================

/**
 * Nominal component weights.
 *
 * Missing optional signals are NOT treated as zero.
 *
 * Instead, available component weights are re-normalized.
 *
 * Example:
 *
 * If no head-to-head evidence exists yet, the contender is not
 * punished with a comparative score of zero.
 *
 * The absence of evidence is reflected through confidence_score.
 */
export const COMPETITION_SCORING_V1_WEIGHTS = {
  completion: 0.25,
  experience: 0.35,
  repeat: 0.15,
  comparative: 0.25,
} as const;


// ============================================================
// V1 NEUTRAL PRIORS
// ============================================================

/**
 * Bayesian-style neutral priors dampen extremely small samples.
 *
 * These are not synthetic votes stored in the database.
 * They exist only inside the scoring calculation.
 *
 * As real evidence grows, their influence rapidly declines.
 */
export const COMPETITION_SCORING_V1_PRIORS = {
  /**
   * Completion:
   *
   * neutral prior = 50%
   * equivalent evidence = 2 participants
   */
  completionRate: 0.5,
  completionEquivalentCount: 2,

  /**
   * Rating:
   *
   * neutral prior = 3 / 5
   * equivalent evidence = 3 ratings
   */
  averageRating: 3,
  ratingEquivalentCount: 3,

  /**
   * Would-repeat:
   *
   * neutral prior = 50%
   * equivalent evidence = 2 responses
   */
  repeatRate: 0.5,
  repeatEquivalentCount: 2,

  /**
   * Comparative preference:
   *
   * neutral prior = 50%
   * equivalent evidence = 3 eligible comparisons
   */
  comparativeRate: 0.5,
  comparativeEquivalentCount: 3,
} as const;


// ============================================================
// CONFIDENCE SATURATION TARGETS
// ============================================================

/**
 * Counts at which each evidence family reaches full confidence.
 *
 * These are intentionally modest for v1 because Taste Duels may
 * begin with relatively small local audiences.
 *
 * Confidence below these thresholds scales linearly.
 */
export const COMPETITION_SCORING_V1_CONFIDENCE_TARGETS = {
  qualifiedParticipants: 10,
  ratings: 8,
  repeatResponses: 8,
  comparativeEligible: 6,
} as const;


// ============================================================
// SCORE CONSTANTS
// ============================================================

const NEUTRAL_SCORE = 50;

const RATING_MIN = 1;
const RATING_MAX = 5;

const RATE_MIN = 0;
const RATE_MAX = 1;


// ============================================================
// INPUT CONTRACT
// ============================================================

/**
 * Aggregated verified evidence for ONE competition entry.
 *
 * Callers should calculate this from trusted database records.
 *
 * No popularity/audience fields exist by design.
 */
export interface CompetitionEntryScoringEvidence {
  // ----------------------------------------------------------
  // Participation
  // ----------------------------------------------------------

  participationCount: number;

  completedParticipantCount: number;

  qualifiedParticipantCount: number;

  /**
   * Qualified users for this entry who also qualified on at
   * least one competing entry.
   */
  crossCompleterCount: number;

  /**
   * Aggregate completion quality on a 0–1 scale.
   *
   * Recommended definition:
   *
   *   average(
   *     competition_participations.completion_ratio
   *   )
   *
   * across the participation population included in the
   * scoring snapshot.
   *
   * null means there is no participation evidence.
   */
  completionRate: number | null;


  // ----------------------------------------------------------
  // Ratings
  // ----------------------------------------------------------

  ratingCount: number;

  /**
   * Verified overall-rating average on a 1–5 scale.
   *
   * null when ratingCount === 0.
   */
  averageRating: number | null;


  // ----------------------------------------------------------
  // Would-repeat signal
  // ----------------------------------------------------------

  wouldRepeatResponseCount: number;

  wouldRepeatCount: number;

  /**
   * Optional convenience input.
   *
   * If omitted, it is derived from:
   *
   *   wouldRepeatCount / wouldRepeatResponseCount
   */
  wouldRepeatRate?: number | null;


  // ----------------------------------------------------------
  // Head-to-head signal
  // ----------------------------------------------------------

  headToHeadPreferenceCount: number;

  /**
   * Number of verified users in the comparative denominator.
   */
  headToHeadEligibleCount: number;

  /**
   * Optional convenience input.
   *
   * If omitted, it is derived from:
   *
   *   preferenceCount / eligibleCount
   */
  headToHeadPreferenceRate?: number | null;
}


// ============================================================
// COMPONENT OUTPUT
// ============================================================

export interface CompetitionEntryScoreComponents {
  /**
   * 0–100.
   */
  completionScore: number | null;

  /**
   * 0–100.
   */
  experienceScore: number | null;

  /**
   * 0–100.
   */
  repeatScore: number | null;

  /**
   * 0–100.
   */
  comparativeScore: number | null;
}


// ============================================================
// PRIMARY OUTPUT
// ============================================================

export interface CompetitionEntryScoringResult
  extends CompetitionEntryScoreComponents {
  algorithmVersion: CompetitionScoringAlgorithmVersion;

  // ----------------------------------------------------------
  // Canonical normalized metrics
  // ----------------------------------------------------------

  completionRate: number | null;

  averageRating: number | null;

  wouldRepeatRate: number | null;

  headToHeadPreferenceRate: number | null;


  // ----------------------------------------------------------
  // Evidence counts
  // ----------------------------------------------------------

  participationCount: number;

  completedParticipantCount: number;

  qualifiedParticipantCount: number;

  crossCompleterCount: number;

  ratingCount: number;

  wouldRepeatResponseCount: number;

  wouldRepeatCount: number;

  headToHeadPreferenceCount: number;

  headToHeadEligibleCount: number;


  // ----------------------------------------------------------
  // Scores
  // ----------------------------------------------------------

  /**
   * Weighted component score before confidence shrinkage.
   *
   * 0–100.
   */
  rawScore: number;

  /**
   * 0–1.
   */
  confidenceScore: number;

  /**
   * Confidence-adjusted official score.
   *
   * 0–100.
   */
  finalScore: number;


  // ----------------------------------------------------------
  // Future metrics
  // ----------------------------------------------------------

  /**
   * V1 intentionally does not score replay/save behavior.
   */
  replayCount: null;
  replayRate: null;

  saveCount: null;
  saveRate: null;
}


// ============================================================
// DOMAIN ERROR
// ============================================================

export class CompetitionScoringError extends Error {
  readonly code:
    | "INVALID_COUNT"
    | "COUNT_INCONSISTENCY"
    | "INVALID_RATE"
    | "INVALID_RATING"
    | "MISSING_RATING_AVERAGE"
    | "UNEXPECTED_RATING_AVERAGE"
    | "ALGORITHM_REQUIRES_VENUE_PARTICIPATION_SCORER"
    | "INVALID_ALGORITHM_VERSION";

  constructor(
    code: CompetitionScoringError["code"],
    message: string,
  ) {
    super(message);

    this.name = "CompetitionScoringError";
    this.code = code;
  }
}


// ============================================================
// INTERNAL NUMERIC HELPERS
// ============================================================

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}


function roundTo(
  value: number,
  decimalPlaces: number,
): number {
  const factor = 10 ** decimalPlaces;

  return Math.round(
    (value + Number.EPSILON) * factor,
  ) / factor;
}


function assertNonNegativeSafeInteger(
  name: string,
  value: number,
): void {
  if (
    !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new CompetitionScoringError(
      "INVALID_COUNT",
      `${name} must be a non-negative safe integer.`,
    );
  }
}


function assertRate(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value)
    || value < RATE_MIN
    || value > RATE_MAX
  ) {
    throw new CompetitionScoringError(
      "INVALID_RATE",
      `${name} must be between 0 and 1.`,
    );
  }
}


function assertRating(
  value: number,
): void {
  if (
    !Number.isFinite(value)
    || value < RATING_MIN
    || value > RATING_MAX
  ) {
    throw new CompetitionScoringError(
      "INVALID_RATING",
      "averageRating must be between 1 and 5.",
    );
  }
}


// ============================================================
// EVIDENCE VALIDATION
// ============================================================

function validateEvidence(
  evidence: CompetitionEntryScoringEvidence,
): void {
  const counts: ReadonlyArray<
    readonly [string, number]
  > = [
    [
      "participationCount",
      evidence.participationCount,
    ],
    [
      "completedParticipantCount",
      evidence.completedParticipantCount,
    ],
    [
      "qualifiedParticipantCount",
      evidence.qualifiedParticipantCount,
    ],
    [
      "crossCompleterCount",
      evidence.crossCompleterCount,
    ],
    [
      "ratingCount",
      evidence.ratingCount,
    ],
    [
      "wouldRepeatResponseCount",
      evidence.wouldRepeatResponseCount,
    ],
    [
      "wouldRepeatCount",
      evidence.wouldRepeatCount,
    ],
    [
      "headToHeadPreferenceCount",
      evidence.headToHeadPreferenceCount,
    ],
    [
      "headToHeadEligibleCount",
      evidence.headToHeadEligibleCount,
    ],
  ];

  for (const [name, value] of counts) {
    assertNonNegativeSafeInteger(
      name,
      value,
    );
  }


  // ----------------------------------------------------------
  // Participation hierarchy
  // ----------------------------------------------------------

  if (
    evidence.completedParticipantCount
    > evidence.participationCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "completedParticipantCount cannot exceed participationCount.",
    );
  }

  if (
    evidence.qualifiedParticipantCount
    > evidence.completedParticipantCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "qualifiedParticipantCount cannot exceed completedParticipantCount.",
    );
  }

  if (
    evidence.crossCompleterCount
    > evidence.qualifiedParticipantCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "crossCompleterCount cannot exceed qualifiedParticipantCount.",
    );
  }


  // ----------------------------------------------------------
  // Ratings
  // ----------------------------------------------------------

  if (
    evidence.ratingCount
    > evidence.qualifiedParticipantCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "ratingCount cannot exceed qualifiedParticipantCount.",
    );
  }

  if (
    evidence.ratingCount === 0
    && evidence.averageRating !== null
  ) {
    throw new CompetitionScoringError(
      "UNEXPECTED_RATING_AVERAGE",
      "averageRating must be null when ratingCount is zero.",
    );
  }

  if (
    evidence.ratingCount > 0
    && evidence.averageRating === null
  ) {
    throw new CompetitionScoringError(
      "MISSING_RATING_AVERAGE",
      "averageRating is required when ratingCount is greater than zero.",
    );
  }

  if (evidence.averageRating !== null) {
    assertRating(evidence.averageRating);
  }


  // ----------------------------------------------------------
  // Repeat response hierarchy
  // ----------------------------------------------------------

  if (
    evidence.wouldRepeatResponseCount
    > evidence.ratingCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "wouldRepeatResponseCount cannot exceed ratingCount.",
    );
  }

  if (
    evidence.wouldRepeatCount
    > evidence.wouldRepeatResponseCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "wouldRepeatCount cannot exceed wouldRepeatResponseCount.",
    );
  }


  // ----------------------------------------------------------
  // Head-to-head hierarchy
  // ----------------------------------------------------------

  if (
    evidence.headToHeadPreferenceCount
    > evidence.headToHeadEligibleCount
  ) {
    throw new CompetitionScoringError(
      "COUNT_INCONSISTENCY",
      "headToHeadPreferenceCount cannot exceed headToHeadEligibleCount.",
    );
  }


  // ----------------------------------------------------------
  // Explicit rates
  // ----------------------------------------------------------

  if (evidence.completionRate !== null) {
    assertRate(
      "completionRate",
      evidence.completionRate,
    );
  }

  if (
    evidence.wouldRepeatRate !== undefined
    && evidence.wouldRepeatRate !== null
  ) {
    assertRate(
      "wouldRepeatRate",
      evidence.wouldRepeatRate,
    );
  }

  if (
    evidence.headToHeadPreferenceRate !== undefined
    && evidence.headToHeadPreferenceRate !== null
  ) {
    assertRate(
      "headToHeadPreferenceRate",
      evidence.headToHeadPreferenceRate,
    );
  }
}


// ============================================================
// RATE NORMALIZATION
// ============================================================

function resolveWouldRepeatRate(
  evidence: CompetitionEntryScoringEvidence,
): number | null {
  if (
    evidence.wouldRepeatResponseCount === 0
  ) {
    return null;
  }

  const derived =
    evidence.wouldRepeatCount
    / evidence.wouldRepeatResponseCount;

  /**
   * Counts remain canonical.
   *
   * Even when a caller supplies a convenience rate, we derive the
   * value from the underlying integer evidence to avoid drift.
   */
  return clamp(
    derived,
    RATE_MIN,
    RATE_MAX,
  );
}


function resolveHeadToHeadPreferenceRate(
  evidence: CompetitionEntryScoringEvidence,
): number | null {
  if (
    evidence.headToHeadEligibleCount === 0
  ) {
    return null;
  }

  const derived =
    evidence.headToHeadPreferenceCount
    / evidence.headToHeadEligibleCount;

  return clamp(
    derived,
    RATE_MIN,
    RATE_MAX,
  );
}


// ============================================================
// BAYESIAN SHRINKAGE HELPERS
// ============================================================

/**
 * Shrinks a 0–1 observed rate toward a neutral prior.
 */
function shrinkRate(
  observedRate: number,
  observedCount: number,
  priorRate: number,
  priorEquivalentCount: number,
): number {
  const denominator =
    observedCount
    + priorEquivalentCount;

  if (denominator <= 0) {
    return priorRate;
  }

  return (
    (
      observedRate * observedCount
      + priorRate * priorEquivalentCount
    )
    / denominator
  );
}


/**
 * Shrinks a 1–5 rating average toward a neutral rating.
 */
function shrinkRating(
  observedAverage: number,
  ratingCount: number,
  priorAverage: number,
  priorEquivalentCount: number,
): number {
  const denominator =
    ratingCount
    + priorEquivalentCount;

  if (denominator <= 0) {
    return priorAverage;
  }

  return (
    (
      observedAverage * ratingCount
      + priorAverage * priorEquivalentCount
    )
    / denominator
  );
}


// ============================================================
// NORMALIZATION
// ============================================================

function ratingToScore(
  rating: number,
): number {
  /**
   * Map:
   *
   *   1 ->   0
   *   2 ->  25
   *   3 ->  50
   *   4 ->  75
   *   5 -> 100
   */
  return (
    (
      rating - RATING_MIN
    )
    / (
      RATING_MAX - RATING_MIN
    )
  ) * 100;
}


function rateToScore(
  rate: number,
): number {
  return rate * 100;
}


// ============================================================
// V1 COMPONENT CALCULATION
// ============================================================

function calculateCompletionScoreV1(
  completionRate: number | null,
  participationCount: number,
): number | null {
  if (
    completionRate === null
    || participationCount === 0
  ) {
    return null;
  }

  const adjustedRate =
    shrinkRate(
      completionRate,
      participationCount,
      COMPETITION_SCORING_V1_PRIORS.completionRate,
      COMPETITION_SCORING_V1_PRIORS.completionEquivalentCount,
    );

  return roundTo(
    rateToScore(adjustedRate),
    4,
  );
}


function calculateExperienceScoreV1(
  averageRating: number | null,
  ratingCount: number,
): number | null {
  if (
    averageRating === null
    || ratingCount === 0
  ) {
    return null;
  }

  const adjustedRating =
    shrinkRating(
      averageRating,
      ratingCount,
      COMPETITION_SCORING_V1_PRIORS.averageRating,
      COMPETITION_SCORING_V1_PRIORS.ratingEquivalentCount,
    );

  return roundTo(
    ratingToScore(adjustedRating),
    4,
  );
}


function calculateRepeatScoreV1(
  wouldRepeatRate: number | null,
  responseCount: number,
): number | null {
  if (
    wouldRepeatRate === null
    || responseCount === 0
  ) {
    return null;
  }

  const adjustedRate =
    shrinkRate(
      wouldRepeatRate,
      responseCount,
      COMPETITION_SCORING_V1_PRIORS.repeatRate,
      COMPETITION_SCORING_V1_PRIORS.repeatEquivalentCount,
    );

  return roundTo(
    rateToScore(adjustedRate),
    4,
  );
}


function calculateComparativeScoreV1(
  preferenceRate: number | null,
  eligibleCount: number,
): number | null {
  if (
    preferenceRate === null
    || eligibleCount === 0
  ) {
    return null;
  }

  const adjustedRate =
    shrinkRate(
      preferenceRate,
      eligibleCount,
      COMPETITION_SCORING_V1_PRIORS.comparativeRate,
      COMPETITION_SCORING_V1_PRIORS.comparativeEquivalentCount,
    );

  return roundTo(
    rateToScore(adjustedRate),
    4,
  );
}


// ============================================================
// WEIGHTED COMPONENT SCORE
// ============================================================

interface WeightedComponent {
  score: number | null;
  weight: number;
}


/**
 * Missing evidence does NOT produce a zero.
 *
 * Available weights are re-normalized.
 *
 * This prevents:
 *
 *   "nobody has unlocked H2H yet"
 *
 * from becoming:
 *
 *   "comparative quality = 0/100"
 */
function calculateWeightedScore(
  components: readonly WeightedComponent[],
): number {
  let weightedScore = 0;
  let availableWeight = 0;

  for (const component of components) {
    if (component.score === null) {
      continue;
    }

    weightedScore +=
      component.score
      * component.weight;

    availableWeight += component.weight;
  }

  if (availableWeight === 0) {
    return NEUTRAL_SCORE;
  }

  return clamp(
    weightedScore / availableWeight,
    COMPETITION_SCORE_MIN,
    COMPETITION_SCORE_MAX,
  );
}


// ============================================================
// CONFIDENCE
// ============================================================

function saturationConfidence(
  count: number,
  target: number,
): number {
  if (target <= 0) {
    return 1;
  }

  return clamp(
    count / target,
    0,
    1,
  );
}


/**
 * Confidence is evidence depth, not popularity.
 *
 * It uses only verified competition evidence.
 */
function calculateConfidenceV1(
  evidence: CompetitionEntryScoringEvidence,
): number {
  const participationConfidence =
    saturationConfidence(
      evidence.qualifiedParticipantCount,
      COMPETITION_SCORING_V1_CONFIDENCE_TARGETS
        .qualifiedParticipants,
    );

  const ratingConfidence =
    saturationConfidence(
      evidence.ratingCount,
      COMPETITION_SCORING_V1_CONFIDENCE_TARGETS
        .ratings,
    );

  const repeatConfidence =
    saturationConfidence(
      evidence.wouldRepeatResponseCount,
      COMPETITION_SCORING_V1_CONFIDENCE_TARGETS
        .repeatResponses,
    );

  const comparativeConfidence =
    saturationConfidence(
      evidence.headToHeadEligibleCount,
      COMPETITION_SCORING_V1_CONFIDENCE_TARGETS
        .comparativeEligible,
    );


  /**
   * Confidence weights broadly mirror score importance.
   *
   * Missing optional signals contribute low confidence rather than
   * lowering the raw quality score itself.
   */
  const confidence =
    (
      participationConfidence
        * COMPETITION_SCORING_V1_WEIGHTS.completion
      +
      ratingConfidence
        * COMPETITION_SCORING_V1_WEIGHTS.experience
      +
      repeatConfidence
        * COMPETITION_SCORING_V1_WEIGHTS.repeat
      +
      comparativeConfidence
        * COMPETITION_SCORING_V1_WEIGHTS.comparative
    )
    /
    (
      COMPETITION_SCORING_V1_WEIGHTS.completion
      + COMPETITION_SCORING_V1_WEIGHTS.experience
      + COMPETITION_SCORING_V1_WEIGHTS.repeat
      + COMPETITION_SCORING_V1_WEIGHTS.comparative
    );

  return clamp(
    confidence,
    0,
    1,
  );
}


// ============================================================
// CONFIDENCE-ADJUSTED FINAL SCORE
// ============================================================

/**
 * Pull small-sample scores toward neutral.
 *
 * Formula:
 *
 *   final =
 *     neutral
 *     + confidence * (raw - neutral)
 *
 * Examples:
 *
 * raw = 90, confidence = 0.20
 * final = 58
 *
 * raw = 90, confidence = 1.00
 * final = 90
 *
 * This prevents one enthusiastic participant from producing an
 * apparently dominant 90+ score.
 */
function applyConfidenceToScore(
  rawScore: number,
  confidenceScore: number,
): number {
  return clamp(
    NEUTRAL_SCORE
    + confidenceScore
      * (
        rawScore
        - NEUTRAL_SCORE
      ),
    COMPETITION_SCORE_MIN,
    COMPETITION_SCORE_MAX,
  );
}


// ============================================================
// V1 ALGORITHM
// ============================================================

function scoreCompetitionEntryV1(
  evidence: CompetitionEntryScoringEvidence,
): CompetitionEntryScoringResult {
  validateEvidence(evidence);

  const completionRate =
    evidence.completionRate;

  const wouldRepeatRate =
    resolveWouldRepeatRate(evidence);

  const headToHeadPreferenceRate =
    resolveHeadToHeadPreferenceRate(
      evidence,
    );


  // ----------------------------------------------------------
  // Component scores
  // ----------------------------------------------------------

  const completionScore =
    calculateCompletionScoreV1(
      completionRate,
      evidence.participationCount,
    );

  const experienceScore =
    calculateExperienceScoreV1(
      evidence.averageRating,
      evidence.ratingCount,
    );

  const repeatScore =
    calculateRepeatScoreV1(
      wouldRepeatRate,
      evidence.wouldRepeatResponseCount,
    );

  const comparativeScore =
    calculateComparativeScoreV1(
      headToHeadPreferenceRate,
      evidence.headToHeadEligibleCount,
    );


  // ----------------------------------------------------------
  // Raw quality score
  // ----------------------------------------------------------

  const rawScore =
    calculateWeightedScore([
      {
        score: completionScore,
        weight:
          COMPETITION_SCORING_V1_WEIGHTS
            .completion,
      },
      {
        score: experienceScore,
        weight:
          COMPETITION_SCORING_V1_WEIGHTS
            .experience,
      },
      {
        score: repeatScore,
        weight:
          COMPETITION_SCORING_V1_WEIGHTS
            .repeat,
      },
      {
        score: comparativeScore,
        weight:
          COMPETITION_SCORING_V1_WEIGHTS
            .comparative,
      },
    ]);


  // ----------------------------------------------------------
  // Evidence confidence
  // ----------------------------------------------------------

  const confidenceScore =
    calculateConfidenceV1(evidence);


  // ----------------------------------------------------------
  // Official score
  // ----------------------------------------------------------

  const finalScore =
    applyConfidenceToScore(
      rawScore,
      confidenceScore,
    );


  return {
    algorithmVersion:
      COMPETITION_SCORING_ALGORITHM_VERSION.V1,

    participationCount:
      evidence.participationCount,

    completedParticipantCount:
      evidence.completedParticipantCount,

    qualifiedParticipantCount:
      evidence.qualifiedParticipantCount,

    crossCompleterCount:
      evidence.crossCompleterCount,

    completionRate:
      completionRate === null
        ? null
        : roundTo(
            completionRate,
            8,
          ),

    ratingCount:
      evidence.ratingCount,

    averageRating:
      evidence.averageRating === null
        ? null
        : roundTo(
            evidence.averageRating,
            3,
          ),

    wouldRepeatResponseCount:
      evidence.wouldRepeatResponseCount,

    wouldRepeatCount:
      evidence.wouldRepeatCount,

    wouldRepeatRate:
      wouldRepeatRate === null
        ? null
        : roundTo(
            wouldRepeatRate,
            8,
          ),

    headToHeadPreferenceCount:
      evidence.headToHeadPreferenceCount,

    headToHeadEligibleCount:
      evidence.headToHeadEligibleCount,

    headToHeadPreferenceRate:
      headToHeadPreferenceRate === null
        ? null
        : roundTo(
            headToHeadPreferenceRate,
            8,
          ),

    completionScore,

    experienceScore,

    repeatScore,

    comparativeScore,

    confidenceScore:
      roundTo(
        confidenceScore,
        8,
      ),

    rawScore:
      roundTo(
        rawScore,
        4,
      ),

    finalScore:
      roundTo(
        finalScore,
        4,
      ),

    /**
     * Explicitly unused in taste_duel_v1.
     *
     * A future algorithm version may begin calculating them.
     */
    replayCount: null,
    replayRate: null,

    saveCount: null,
    saveRate: null,
  };
}


// ============================================================
// PUBLIC VERSIONED DISPATCH
// ============================================================

/**
 * Canonical scoring entry point for the existing itinerary Taste
 * Duel evidence contract.
 *
 * IMPORTANT:
 *
 * The venue-participation algorithm identifier is deliberately
 * recognized here but cannot execute through this function.
 *
 * Venue-participation has a fundamentally different evidence
 * contract:
 *
 *   - no route completion
 *   - no competition_entry_ratings
 *   - no would-repeat signal
 *   - no explicit head-to-head preference
 *
 * Routing that mode through scoreCompetitionEntryV1() would attach
 * the wrong semantics to an immutable algorithm version.
 */
export function scoreCompetitionEntry(
  evidence: CompetitionEntryScoringEvidence,
  version: CompetitionScoringAlgorithmVersion =
    COMPETITION_SCORING_ALGORITHM_VERSION.V1,
): CompetitionEntryScoringResult {
  switch (version) {
    case COMPETITION_SCORING_ALGORITHM_VERSION.V1:
      return scoreCompetitionEntryV1(
        evidence,
      );

    case COMPETITION_SCORING_ALGORITHM_VERSION
      .VENUE_PARTICIPATION_V1:
      throw new CompetitionScoringError(
        "ALGORITHM_REQUIRES_VENUE_PARTICIPATION_SCORER",
        `Scoring algorithm "${COMPETITION_SCORING_ALGORITHM_VERSION.VENUE_PARTICIPATION_V1}" requires the dedicated venue-participation scoring path.`,
      );

    default:
      throw new CompetitionScoringError(
        "INVALID_ALGORITHM_VERSION",
        `Unsupported competition scoring algorithm version: ${String(
          version,
        )}`,
      );
  }
}


// ============================================================
// ALGORITHM VERSION GUARD
// ============================================================

/**
 * Returns true for every registered Taste Duel scoring algorithm,
 * including algorithms whose evidence contract is intentionally
 * implemented by a separate scorer.
 */
export function isCompetitionScoringAlgorithmVersion(
  value: string,
): value is CompetitionScoringAlgorithmVersion {
  return (
    Object.values(
      COMPETITION_SCORING_ALGORITHM_VERSION,
    ) as readonly string[]
  ).includes(value);
}


// ============================================================
// SCORE SNAPSHOT INSERT MAPPER
// ============================================================

/**
 * Exact insert-ready scoring fields for:
 *
 *   public.competition_entry_score_snapshots
 *
 * The caller remains responsible for:
 *
 *   competition_id
 *   entry_id
 *   snapshot_type
 *   calculated_at
 *
 * Keeping those outside the scoring algorithm preserves the
 * separation between:
 *
 *   calculation
 *
 * and:
 *
 *   persistence / lifecycle
 */
export interface CompetitionScoreSnapshotFields {
  participation_count: number;
  completed_participant_count: number;
  qualified_participant_count: number;
  cross_completer_count: number;

  completion_rate: number | null;

  rating_count: number;
  average_rating: number | null;

  would_repeat_response_count: number;
  would_repeat_count: number;
  would_repeat_rate: number | null;

  head_to_head_preference_count: number;
  head_to_head_eligible_count: number;
  head_to_head_preference_rate: number | null;

  replay_count: null;
  replay_rate: null;

  save_count: null;
  save_rate: null;

  completion_score: number | null;
  experience_score: number | null;
  repeat_score: number | null;
  comparative_score: number | null;

  confidence_score: number;
  final_score: number;

  algorithm_version:
    CompetitionScoringAlgorithmVersion;
}


export function toCompetitionScoreSnapshotFields(
  result: CompetitionEntryScoringResult,
): CompetitionScoreSnapshotFields {
  return {
    participation_count:
      result.participationCount,

    completed_participant_count:
      result.completedParticipantCount,

    qualified_participant_count:
      result.qualifiedParticipantCount,

    cross_completer_count:
      result.crossCompleterCount,

    completion_rate:
      result.completionRate,

    rating_count:
      result.ratingCount,

    average_rating:
      result.averageRating,

    would_repeat_response_count:
      result.wouldRepeatResponseCount,

    would_repeat_count:
      result.wouldRepeatCount,

    would_repeat_rate:
      result.wouldRepeatRate,

    head_to_head_preference_count:
      result.headToHeadPreferenceCount,

    head_to_head_eligible_count:
      result.headToHeadEligibleCount,

    head_to_head_preference_rate:
      result.headToHeadPreferenceRate,

    replay_count: null,
    replay_rate: null,

    save_count: null,
    save_rate: null,

    completion_score:
      result.completionScore,

    experience_score:
      result.experienceScore,

    repeat_score:
      result.repeatScore,

    comparative_score:
      result.comparativeScore,

    confidence_score:
      result.confidenceScore,

    final_score:
      result.finalScore,

    algorithm_version:
      result.algorithmVersion,
  };
}


// ============================================================
// OPTIONAL COMPARISON HELPER
// ============================================================

export interface RankedCompetitionEntryScore {
  entryId: string;

  finalScore: number;
  confidenceScore: number;

  qualifiedParticipantCount: number;
}


/**
 * Stable deterministic ordering helper.
 *
 * Primary:
 *   final score descending
 *
 * Tie-breaker 1:
 *   confidence descending
 *
 * Tie-breaker 2:
 *   qualified participant count descending
 *
 * Tie-breaker 3:
 *   entry ID lexical order
 *
 * IMPORTANT:
 *
 * This function does NOT declare an official winner.
 *
 * Settlement logic must still decide whether score differences
 * constitute:
 *
 *   winner
 *   tie
 *   insufficient_evidence
 *
 * according to explicit settlement rules.
 */
export function rankCompetitionEntryScores(
  scores: readonly RankedCompetitionEntryScore[],
): RankedCompetitionEntryScore[] {
  return [...scores].sort(
    (a, b) => {
      if (b.finalScore !== a.finalScore) {
        return (
          b.finalScore
          - a.finalScore
        );
      }

      if (
        b.confidenceScore
        !== a.confidenceScore
      ) {
        return (
          b.confidenceScore
          - a.confidenceScore
        );
      }

      if (
        b.qualifiedParticipantCount
        !== a.qualifiedParticipantCount
      ) {
        return (
          b.qualifiedParticipantCount
          - a.qualifiedParticipantCount
        );
      }

      return a.entryId.localeCompare(
        b.entryId,
      );
    },
  );
}