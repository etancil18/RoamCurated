// lib/competitions/venueParticipationScoring.ts

import 'server-only'

import {
  COMPETITION_ALGORITHM_VERSION,
  COMPETITION_RATING_MAX,
  COMPETITION_RATING_MIN,
  COMPETITION_SCORE_MAX,
  COMPETITION_SCORE_MIN,
} from './constants'

// ============================================================
// VENUE-PARTICIPATION SCORING VERSIONING
// ============================================================

/**
 * Versioned product logic for venue-participation Taste Duels.
 *
 * IMPORTANT:
 *
 * Never silently change the behavior associated with an existing
 * version.
 *
 * Historical competition evidence and score snapshots must remain
 * reproducible.
 *
 * If the depth formula changes later, introduce a new version
 * rather than modifying V1.
 */
export const VENUE_PARTICIPATION_DEPTH_RULE_VERSION = {
  V1: 'venue_participation_depth_v1',
} as const

export type VenueParticipationDepthRuleVersion =
  (typeof VENUE_PARTICIPATION_DEPTH_RULE_VERSION)[keyof typeof VENUE_PARTICIPATION_DEPTH_RULE_VERSION]

export const DEFAULT_VENUE_PARTICIPATION_DEPTH_RULE_VERSION =
  VENUE_PARTICIPATION_DEPTH_RULE_VERSION.V1


// ============================================================
// OFFICIAL VENUE-PARTICIPATION ALGORITHMS
// ============================================================

/**
 * Original venue-participation scoring algorithm.
 *
 * IMPORTANT:
 *
 * This export remains unchanged for compatibility with existing
 * callers that explicitly reference the V1 algorithm.
 */
export const VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION =
  COMPETITION_ALGORITHM_VERSION
    .TASTE_DUEL_VENUE_PARTICIPATION_V1


/**
 * Venue-participation V2.
 *
 * V2 preserves:
 *
 *   - the same canonical evidence contract
 *   - the same V1 diminishing venue-depth rule
 *   - the same Bayesian rating-quality calculation
 *   - the same neutral-score shrinkage philosophy
 *
 * The behavioral change is evidence confidence:
 *
 *   V1 -> capped-linear saturation
 *   V2 -> exponential diminishing-return saturation
 */
export const VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION_V2 =
  COMPETITION_ALGORITHM_VERSION
    .TASTE_DUEL_VENUE_PARTICIPATION_V2


export type VenueParticipationScoringAlgorithmVersion =
  | typeof VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION
  | typeof VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION_V2


// ============================================================
// PUBLIC DEPTH RESULT CONTRACT
// ============================================================

export interface VenueParticipationDepthWeightResult {
  /**
   * Version of the immutable depth rule used.
   */
  version: VenueParticipationDepthRuleVersion

  /**
   * 1-based ordinal of this user's distinct qualifying venue
   * within ONE competition entry / side.
   *
   * Example:
   *
   *   first distinct venue  -> 1
   *   second distinct venue -> 2
   *   third distinct venue  -> 3
   */
  distinctVenueOrdinal: number

  /**
   * Diminishing contribution weight.
   *
   * V1:
   *
   *   1 / sqrt(distinctVenueOrdinal)
   */
  weight: number
}


// ============================================================
// OFFICIAL SCORING INPUT
// ============================================================

/**
 * Canonical aggregated evidence for ONE venue-participation side.
 *
 * This contract is deliberately independent from itinerary
 * CompetitionEntryScoringEvidence.
 *
 * Fields without meaningful venue-participation semantics do not
 * belong here.
 */
export interface VenueParticipationScoringEvidence {
  /**
   * Distinct users who produced at least one accepted immutable
   * venue-participation event for this side.
   */
  uniqueParticipantCount: number

  /**
   * Distinct accepted:
   *
   *   user + venue
   *
   * pairs for this side.
   */
  uniqueVenueVisitorCount: number

  /**
   * Diminishing per-user distinct-venue depth.
   *
   * For each user:
   *
   *   ordinal 1 -> 1 / sqrt(1)
   *   ordinal 2 -> 1 / sqrt(2)
   *   ...
   *
   * then sum every contribution across the side.
   */
  weightedParticipation: number

  /**
   * Number of accepted venue-participation evidence rows whose
   * referenced canonical venue_visits row has a valid rating.
   */
  ratingCount: number

  /**
   * Average of all qualifying canonical venue_visits.rating values.
   *
   * null exactly when ratingCount === 0.
   */
  averageRating: number | null

  /**
   * Number of configured venues belonging to this side.
   */
  venueCount: number

  /**
   * Number of configured side venues with >= 1 accepted
   * participation event.
   */
  visitedVenueCount: number

  /**
   * visitedVenueCount / venueCount.
   *
   * Tracked for evidence quality, analytics, and future algorithms.
   *
   * V1/V2 do NOT assign this metric an official score weight.
   */
  breadthRate: number | null
}


// ============================================================
// OFFICIAL SCORING RESULT
// ============================================================

export interface VenueParticipationScoringResult {
  algorithmVersion:
    VenueParticipationScoringAlgorithmVersion

  // ----------------------------------------------------------
  // Canonical evidence
  // ----------------------------------------------------------

  uniqueParticipantCount: number

  uniqueVenueVisitorCount: number

  weightedParticipation: number

  ratingCount: number

  averageRating: number | null

  venueCount: number

  visitedVenueCount: number

  breadthRate: number | null

  // ----------------------------------------------------------
  // Rating quality
  // ----------------------------------------------------------

  /**
   * Rating average after neutral-prior shrinkage.
   *
   * Remains on the 1–5 scale.
   *
   * null when no rating evidence exists.
   */
  adjustedAverageRating: number | null

  /**
   * Shrunk rating quality mapped to 0–100.
   *
   * null when no rating evidence exists.
   */
  ratingScore: number | null

  // ----------------------------------------------------------
  // Participation-derived confidence
  // ----------------------------------------------------------

  /**
   * Confidence from independent participant count.
   *
   * Range:
   *
   *   0..1
   */
  participantConfidence: number

  /**
   * Confidence from qualifying canonical rating volume.
   *
   * Range:
   *
   *   0..1
   */
  ratingConfidence: number

  /**
   * Confidence from diminishing venue-depth evidence.
   *
   * Range:
   *
   *   0..1
   */
  depthConfidence: number

  /**
   * Combined evidence confidence.
   *
   * Derived from:
   *
   *   unique participants
   *   rating count
   *   weighted participation
   *
   * Range:
   *
   *   0..1
   */
  confidenceScore: number

  // ----------------------------------------------------------
  // Official score
  // ----------------------------------------------------------

  /**
   * Rating-quality score before confidence shrinkage.
   *
   * No rating evidence is interpreted as unknown rather than bad,
   * so rawScore remains neutral at 50.
   */
  rawScore: number

  /**
   * Official confidence-adjusted 0–100 score.
   */
  finalScore: number

  /**
   * Breadth is explicitly tracked but not scored in V1/V2.
   */
  breadthScore: null
}


// ============================================================
// V1 SCORING CONFIGURATION
// ============================================================

/**
 * Neutral Bayesian-style rating prior.
 *
 * This exists only inside score calculation.
 *
 * It does NOT create synthetic ratings in persistence.
 */
export const VENUE_PARTICIPATION_SCORING_V1_RATING_PRIOR = {
  averageRating:
    3,

  equivalentRatingCount:
    3,
} as const


/**
 * Evidence levels at which each confidence dimension reaches full
 * saturation.
 *
 * These are part of:
 *
 *   taste_duel_venue_participation_v1
 *
 * Changing them changes historical score behavior and therefore
 * requires a new algorithm version.
 */
export const VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_TARGETS = {
  /**
   * Independent people matter most.
   */
  uniqueParticipants:
    10,

  /**
   * Rating volume measures how much direct quality evidence
   * supports the observed rating average.
   */
  ratings:
    8,

  /**
   * Diminishing venue-depth evidence captures deeper physical
   * participation without converting raw traffic into quality.
   */
  weightedParticipation:
    15,
} as const


/**
 * Confidence composition for venue-participation v1.
 *
 * These weights affect confidence only.
 *
 * They do NOT contribute directly to raw quality.
 *
 * Independent participants receive the strongest weight, rating
 * depth measures support for the quality estimate, and weighted
 * participation adds corroborating behavioral depth.
 */
export const VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS = {
  uniqueParticipants:
    0.45,

  ratings:
    0.35,

  weightedParticipation:
    0.20,
} as const


// ============================================================
// V2 SCORING CONFIGURATION
// ============================================================

/**
 * V2 preserves the same Bayesian rating-quality prior as V1.
 *
 * The versioned behavioral change is confidence, not the meaning
 * of rating quality.
 */
export const VENUE_PARTICIPATION_SCORING_V2_RATING_PRIOR =
  VENUE_PARTICIPATION_SCORING_V1_RATING_PRIOR


/**
 * Exponential confidence scales for:
 *
 *   taste_duel_venue_participation_v2
 *
 * Formula:
 *
 *   confidence =
 *     1 - exp(-evidence / scale)
 *
 * Unlike capped-linear saturation, this has diminishing marginal
 * returns at every evidence level.
 *
 * Examples of the intended behavior:
 *
 *   moving from very little evidence to meaningful evidence
 *     -> large confidence gain
 *
 *   moving from already-large evidence to slightly more
 *     -> very small confidence gain
 *
 * These values are immutable behavior once V2 snapshots exist.
 */
export const VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_SCALES = {
  /**
   * Independent people are the strongest evidence dimension.
   */
  uniqueParticipants:
    20,

  /**
   * Canonical ratings strongly support the reliability of the
   * observed quality estimate.
   */
  ratings:
    15,

  /**
   * Same-user exploration still adds corroborating evidence,
   * but its marginal value diminishes aggressively.
   */
  weightedParticipation:
    25,
} as const


/**
 * V2 confidence composition.
 *
 * Independent participants dominate.
 *
 * Ratings remain strongly important because the official quality
 * signal itself is rating-derived.
 *
 * Weighted participation contributes only a small corroborating
 * share, preventing a small number of highly active users from
 * substituting for broad independent participation.
 */
export const VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS = {
  uniqueParticipants:
    0.55,

  ratings:
    0.35,

  weightedParticipation:
    0.10,
} as const


// ============================================================
// INTERNAL SCORE CONSTANTS
// ============================================================

const NEUTRAL_SCORE =
  50

const RATE_MIN =
  0

const RATE_MAX =
  1

/**
 * Evidence adapters may round normalized metrics to 8 decimal
 * places before passing them here.
 *
 * Keep comparison tolerance slightly wider than the maximum
 * 8-decimal rounding error.
 */
const RATE_COMPARISON_TOLERANCE =
  5e-8


// ============================================================
// DOMAIN ERROR
// ============================================================

export class VenueParticipationScoringError extends Error {
  readonly code:
    | 'INVALID_DEPTH_ORDINAL'
    | 'UNSUPPORTED_DEPTH_RULE_VERSION'
    | 'UNSUPPORTED_SCORING_ALGORITHM_VERSION'
    | 'INVALID_COUNT'
    | 'COUNT_INCONSISTENCY'
    | 'INVALID_WEIGHTED_PARTICIPATION'
    | 'INVALID_RATING'
    | 'MISSING_RATING_AVERAGE'
    | 'UNEXPECTED_RATING_AVERAGE'
    | 'INVALID_BREADTH_RATE'
    | 'BREADTH_INCONSISTENCY'
    | 'INVALID_CONFIDENCE_SCALE'
    | 'INVALID_CONFIDENCE_CONFIGURATION'

  readonly context: Readonly<
    Record<string, unknown>
  >

  constructor({
    code,
    message,
    context = {},
  }: {
    code:
      VenueParticipationScoringError['code']

    message: string

    context?: Record<
      string,
      unknown
    >
  }) {
    super(
      message,
    )

    this.name =
      'VenueParticipationScoringError'

    this.code =
      code

    this.context =
      Object.freeze({
        ...context,
      })
  }
}


// ============================================================
// DEPTH INPUT VALIDATION
// ============================================================

function assertValidDistinctVenueOrdinal(
  distinctVenueOrdinal: number,
): void {
  if (
    !Number.isSafeInteger(
      distinctVenueOrdinal,
    ) ||
    distinctVenueOrdinal <
      1
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_DEPTH_ORDINAL',

      message:
        'distinctVenueOrdinal must be a positive safe integer.',

      context: {
        distinctVenueOrdinal,
      },
    })
  }
}


// ============================================================
// V1 DEPTH FORMULA
// ============================================================

/**
 * Canonical venue-participation diminishing-depth rule V1.
 *
 * Formula:
 *
 *   weight = 1 / sqrt(distinctVenueOrdinal)
 *
 * Approximate values:
 *
 *   1 -> 1.000000
 *   2 -> 0.707107
 *   3 -> 0.577350
 *   4 -> 0.500000
 *   5 -> 0.447214
 *
 * Important semantics:
 *
 * The ordinal is calculated PER:
 *
 *   competition
 *   + competition entry / side
 *   + user
 *
 * Therefore:
 *
 *   User visits A1 -> ordinal 1 -> 1.000
 *   User visits A2 -> ordinal 2 -> 0.707
 *   User visits B1 -> ordinal 1 -> 1.000
 *
 * Visiting the opposing side does not inherit depth accumulated
 * on the first side.
 *
 * This function does NOT determine the ordinal itself. The
 * evidence adapter is responsible for ordering distinct venues
 * canonically before calling this function.
 */
export function getVenueParticipationDepthWeightV1(
  distinctVenueOrdinal: number,
): number {
  assertValidDistinctVenueOrdinal(
    distinctVenueOrdinal,
  )

  return (
    1 /
    Math.sqrt(
      distinctVenueOrdinal,
    )
  )
}


// ============================================================
// VERSIONED DEPTH DISPATCH
// ============================================================

/**
 * Canonical version-aware entry point.
 *
 * Prefer this function in general scoring/evidence code when the
 * rule version is carried as data.
 *
 * Code that explicitly implements V1 may call
 * getVenueParticipationDepthWeightV1() directly.
 */
export function getVenueParticipationDepthWeight(
  distinctVenueOrdinal: number,
  version: VenueParticipationDepthRuleVersion =
    DEFAULT_VENUE_PARTICIPATION_DEPTH_RULE_VERSION,
): number {
  switch (
    version
  ) {
    case VENUE_PARTICIPATION_DEPTH_RULE_VERSION.V1:
      return getVenueParticipationDepthWeightV1(
        distinctVenueOrdinal,
      )

    default:
      throw new VenueParticipationScoringError({
        code:
          'UNSUPPORTED_DEPTH_RULE_VERSION',

        message:
          `Unsupported venue-participation depth rule version: ${String(
            version,
          )}`,

        context: {
          version,
          distinctVenueOrdinal,
        },
      })
  }
}


// ============================================================
// STRUCTURED DEPTH RESULT HELPER
// ============================================================

/**
 * Useful when callers need to persist/audit the exact rule version
 * alongside the calculated contribution.
 */
export function evaluateVenueParticipationDepthWeight({
  distinctVenueOrdinal,
  version =
    DEFAULT_VENUE_PARTICIPATION_DEPTH_RULE_VERSION,
}: {
  distinctVenueOrdinal: number

  version?:
    VenueParticipationDepthRuleVersion
}): VenueParticipationDepthWeightResult {
  return {
    version,

    distinctVenueOrdinal,

    weight:
      getVenueParticipationDepthWeight(
        distinctVenueOrdinal,
        version,
      ),
  }
}


// ============================================================
// DEPTH VERSION GUARD
// ============================================================

export function isVenueParticipationDepthRuleVersion(
  value: unknown,
): value is VenueParticipationDepthRuleVersion {
  return (
    typeof value ===
      'string' &&
    (
      Object.values(
        VENUE_PARTICIPATION_DEPTH_RULE_VERSION,
      ) as readonly string[]
    ).includes(
      value,
    )
  )
}


// ============================================================
// OFFICIAL SCORING NUMERIC HELPERS
// ============================================================

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  )
}


function roundTo(
  value: number,
  decimalPlaces: number,
): number {
  const factor =
    10 **
    decimalPlaces

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        factor,
    ) /
    factor
  )
}


function approximatelyEqual(
  left: number,
  right: number,
  tolerance:
    number =
      RATE_COMPARISON_TOLERANCE,
): boolean {
  return (
    Math.abs(
      left -
      right,
    ) <=
    tolerance
  )
}


function assertNonNegativeSafeInteger(
  name: string,
  value: number,
): void {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value <
      0
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_COUNT',

      message:
        `${name} must be a non-negative safe integer.`,

      context: {
        name,
        value,
      },
    })
  }
}


function saturationConfidence(
  value: number,
  target: number,
): number {
  if (
    target <=
      0
  ) {
    return 1
  }

  return clamp(
    value /
      target,
    RATE_MIN,
    RATE_MAX,
  )
}


/**
 * Exponential diminishing-return confidence curve.
 *
 * Formula:
 *
 *   1 - exp(-value / scale)
 *
 * Properties:
 *
 *   value = 0
 *     -> confidence = 0
 *
 *   value increases
 *     -> confidence increases monotonically
 *
 *   very large values
 *     -> confidence asymptotically approaches 1
 *
 * The function never converts evidence directly into quality
 * points. It only controls how strongly observed quality is allowed
 * to move the final score away from neutral.
 */
function exponentialConfidence(
  value: number,
  scale: number,
): number {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_CONFIDENCE_CONFIGURATION',

      message:
        'Exponential confidence evidence value must be finite and non-negative.',

      context: {
        value,
        scale,
      },
    })
  }

  if (
    !Number.isFinite(
      scale,
    ) ||
    scale <=
      0
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_CONFIDENCE_SCALE',

      message:
        'Exponential confidence scale must be a finite positive number.',

      context: {
        value,
        scale,
      },
    })
  }

  return clamp(
    1 -
      Math.exp(
        -value /
          scale,
      ),

    RATE_MIN,
    RATE_MAX,
  )
}


// ============================================================
// OFFICIAL SCORING RATING HELPERS
// ============================================================

function assertValidRating(
  value: number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      COMPETITION_RATING_MIN ||
    value >
      COMPETITION_RATING_MAX
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_RATING',

      message:
        `averageRating must be between ${COMPETITION_RATING_MIN} and ${COMPETITION_RATING_MAX}.`,

      context: {
        averageRating:
          value,
      },
    })
  }
}


function shrinkRating(
  observedAverage: number,
  ratingCount: number,
  priorAverage: number,
  priorEquivalentCount: number,
): number {
  const denominator =
    ratingCount +
    priorEquivalentCount

  if (
    denominator <=
      0
  ) {
    return priorAverage
  }

  return (
    (
      observedAverage *
        ratingCount
      +
      priorAverage *
        priorEquivalentCount
    ) /
    denominator
  )
}


function ratingToScore(
  rating: number,
): number {
  /**
   * Canonical 1–5 mapping:
   *
   *   1 ->   0
   *   2 ->  25
   *   3 ->  50
   *   4 ->  75
   *   5 -> 100
   */
  return (
    (
      rating -
        COMPETITION_RATING_MIN
    ) /
    (
      COMPETITION_RATING_MAX -
        COMPETITION_RATING_MIN
    )
  ) *
    100
}


// ============================================================
// OFFICIAL EVIDENCE VALIDATION
// ============================================================

function validateVenueParticipationScoringEvidence(
  evidence:
    VenueParticipationScoringEvidence,
): void {
  const integerCounts:
    ReadonlyArray<
      readonly [
        string,
        number,
      ]
    > =
    [
      [
        'uniqueParticipantCount',
        evidence.uniqueParticipantCount,
      ],
      [
        'uniqueVenueVisitorCount',
        evidence.uniqueVenueVisitorCount,
      ],
      [
        'ratingCount',
        evidence.ratingCount,
      ],
      [
        'venueCount',
        evidence.venueCount,
      ],
      [
        'visitedVenueCount',
        evidence.visitedVenueCount,
      ],
    ]

  for (
    const [
      name,
      value,
    ]
    of integerCounts
  ) {
    assertNonNegativeSafeInteger(
      name,
      value,
    )
  }


  // ----------------------------------------------------------
  // Side configuration
  // ----------------------------------------------------------

  if (
    evidence.venueCount <
      1
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'venueCount must be at least 1 for venue-participation scoring.',

      context: {
        venueCount:
          evidence.venueCount,
      },
    })
  }

  if (
    evidence.visitedVenueCount >
      evidence.venueCount
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'visitedVenueCount cannot exceed venueCount.',

      context: {
        visitedVenueCount:
          evidence.visitedVenueCount,

        venueCount:
          evidence.venueCount,
      },
    })
  }


  // ----------------------------------------------------------
  // Participation hierarchy
  // ----------------------------------------------------------

  if (
    evidence.uniqueParticipantCount >
      evidence.uniqueVenueVisitorCount
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'uniqueParticipantCount cannot exceed uniqueVenueVisitorCount.',

      context: {
        uniqueParticipantCount:
          evidence.uniqueParticipantCount,

        uniqueVenueVisitorCount:
          evidence.uniqueVenueVisitorCount,
      },
    })
  }


  // ----------------------------------------------------------
  // Weighted participation
  // ----------------------------------------------------------

  if (
    !Number.isFinite(
      evidence.weightedParticipation,
    ) ||
    evidence.weightedParticipation <
      0
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_WEIGHTED_PARTICIPATION',

      message:
        'weightedParticipation must be a finite non-negative number.',

      context: {
        weightedParticipation:
          evidence.weightedParticipation,
      },
    })
  }

  /**
   * Every participant's first distinct venue contributes 1.
   *
   * Therefore, when evidence exists:
   *
   *   weightedParticipation
   *   >=
   *   uniqueParticipantCount
   */
  if (
    evidence.weightedParticipation +
      RATE_COMPARISON_TOLERANCE <
    evidence.uniqueParticipantCount
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'weightedParticipation cannot be lower than uniqueParticipantCount under the V1 depth rule.',

      context: {
        weightedParticipation:
          evidence.weightedParticipation,

        uniqueParticipantCount:
          evidence.uniqueParticipantCount,
      },
    })
  }

  /**
   * Every user/venue contribution is <= 1.
   *
   * Therefore:
   *
   *   weightedParticipation
   *   <=
   *   uniqueVenueVisitorCount
   */
  if (
    evidence.weightedParticipation -
      RATE_COMPARISON_TOLERANCE >
    evidence.uniqueVenueVisitorCount
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'weightedParticipation cannot exceed uniqueVenueVisitorCount under the V1 depth rule.',

      context: {
        weightedParticipation:
          evidence.weightedParticipation,

        uniqueVenueVisitorCount:
          evidence.uniqueVenueVisitorCount,
      },
    })
  }


  // ----------------------------------------------------------
  // Ratings
  // ----------------------------------------------------------

  if (
    evidence.ratingCount >
      evidence.uniqueVenueVisitorCount
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'ratingCount cannot exceed uniqueVenueVisitorCount.',

      context: {
        ratingCount:
          evidence.ratingCount,

        uniqueVenueVisitorCount:
          evidence.uniqueVenueVisitorCount,
      },
    })
  }

  if (
    evidence.ratingCount ===
      0 &&
    evidence.averageRating !==
      null
  ) {
    throw new VenueParticipationScoringError({
      code:
        'UNEXPECTED_RATING_AVERAGE',

      message:
        'averageRating must be null when ratingCount is zero.',

      context: {
        ratingCount:
          evidence.ratingCount,

        averageRating:
          evidence.averageRating,
      },
    })
  }

  if (
    evidence.ratingCount >
      0 &&
    evidence.averageRating ===
      null
  ) {
    throw new VenueParticipationScoringError({
      code:
        'MISSING_RATING_AVERAGE',

      message:
        'averageRating is required when ratingCount is greater than zero.',

      context: {
        ratingCount:
          evidence.ratingCount,
      },
    })
  }

  if (
    evidence.averageRating !==
      null
  ) {
    assertValidRating(
      evidence.averageRating,
    )
  }


  // ----------------------------------------------------------
  // Breadth
  // ----------------------------------------------------------

  if (
    evidence.breadthRate ===
      null
  ) {
    throw new VenueParticipationScoringError({
      code:
        'BREADTH_INCONSISTENCY',

      message:
        'breadthRate is required when venueCount is greater than zero.',

      context: {
        venueCount:
          evidence.venueCount,

        visitedVenueCount:
          evidence.visitedVenueCount,

        breadthRate:
          evidence.breadthRate,
      },
    })
  }

  if (
    !Number.isFinite(
      evidence.breadthRate,
    ) ||
    evidence.breadthRate <
      RATE_MIN ||
    evidence.breadthRate >
      RATE_MAX
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_BREADTH_RATE',

      message:
        'breadthRate must be between 0 and 1.',

      context: {
        breadthRate:
          evidence.breadthRate,
      },
    })
  }

  const expectedBreadthRate =
    evidence.visitedVenueCount /
    evidence.venueCount

  if (
    !approximatelyEqual(
      evidence.breadthRate,
      expectedBreadthRate,
    )
  ) {
    throw new VenueParticipationScoringError({
      code:
        'BREADTH_INCONSISTENCY',

      message:
        'breadthRate must equal visitedVenueCount / venueCount.',

      context: {
        breadthRate:
          evidence.breadthRate,

        expectedBreadthRate,

        visitedVenueCount:
          evidence.visitedVenueCount,

        venueCount:
          evidence.venueCount,
      },
    })
  }


  // ----------------------------------------------------------
  // Zero-evidence consistency
  // ----------------------------------------------------------

  if (
    evidence.uniqueParticipantCount ===
      0 &&
    (
      evidence.uniqueVenueVisitorCount !==
        0 ||
      Math.abs(
        evidence.weightedParticipation,
      ) >
        RATE_COMPARISON_TOLERANCE ||
      evidence.ratingCount !==
        0 ||
      evidence.visitedVenueCount !==
        0
    )
  ) {
    throw new VenueParticipationScoringError({
      code:
        'COUNT_INCONSISTENCY',

      message:
        'Zero-participant evidence cannot contain venue visits, rating evidence, weighted depth, or visited venues.',

      context: {
        uniqueParticipantCount:
          evidence.uniqueParticipantCount,

        uniqueVenueVisitorCount:
          evidence.uniqueVenueVisitorCount,

        weightedParticipation:
          evidence.weightedParticipation,

        ratingCount:
          evidence.ratingCount,

        visitedVenueCount:
          evidence.visitedVenueCount,
      },
    })
  }
}


// ============================================================
// V1 RATING QUALITY
// ============================================================

function calculateAdjustedAverageRatingV1(
  averageRating: number | null,
  ratingCount: number,
): number | null {
  if (
    averageRating ===
      null ||
    ratingCount ===
      0
  ) {
    return null
  }

  return shrinkRating(
    averageRating,
    ratingCount,

    VENUE_PARTICIPATION_SCORING_V1_RATING_PRIOR
      .averageRating,

    VENUE_PARTICIPATION_SCORING_V1_RATING_PRIOR
      .equivalentRatingCount,
  )
}


function calculateVenueParticipationRatingQualityV1(
  averageRating: number | null,
  ratingCount: number,
): {
  adjustedAverageRating:
    number | null

  ratingScore:
    number | null
} {
  const adjustedAverageRating =
    calculateAdjustedAverageRatingV1(
      averageRating,
      ratingCount,
    )

  if (
    adjustedAverageRating ===
      null
  ) {
    return {
      adjustedAverageRating:
        null,

      ratingScore:
        null,
    }
  }

  return {
    adjustedAverageRating:
      roundTo(
        adjustedAverageRating,
        6,
      ),

    ratingScore:
      roundTo(
        ratingToScore(
          adjustedAverageRating,
        ),
        4,
      ),
  }
}


// ============================================================
// V1 EVIDENCE CONFIDENCE
// ============================================================

/**
 * Venue-participation v1 confidence measures evidence credibility,
 * not quality.
 *
 * It deliberately separates:
 *
 *   QUALITY
 *
 *     canonical venue rating evidence
 *
 * from:
 *
 *   CONFIDENCE
 *
 *     how much credible evidence supports that quality estimate
 *
 * Confidence derives from:
 *
 *   1. unique participants
 *   2. rating count
 *   3. diminishing weighted participation
 *
 * None of these metrics directly add quality points.
 */
function calculateVenueParticipationConfidenceV1(
  evidence:
    VenueParticipationScoringEvidence,
): {
  participantConfidence: number
  ratingConfidence: number
  depthConfidence: number
  confidenceScore: number
} {
  const participantConfidence =
    saturationConfidence(
      evidence.uniqueParticipantCount,

      VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_TARGETS
        .uniqueParticipants,
    )

  const ratingConfidence =
    saturationConfidence(
      evidence.ratingCount,

      VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_TARGETS
        .ratings,
    )

  const depthConfidence =
    saturationConfidence(
      evidence.weightedParticipation,

      VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_TARGETS
        .weightedParticipation,
    )

  const totalWeight =
    VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS
      .uniqueParticipants
    +
    VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS
      .ratings
    +
    VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS
      .weightedParticipation

  const confidenceScore =
    (
      participantConfidence *
        VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS
          .uniqueParticipants
      +
      ratingConfidence *
        VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS
          .ratings
      +
      depthConfidence *
        VENUE_PARTICIPATION_SCORING_V1_CONFIDENCE_WEIGHTS
          .weightedParticipation
    ) /
    totalWeight

  return {
    participantConfidence:
      roundTo(
        participantConfidence,
        8,
      ),

    ratingConfidence:
      roundTo(
        ratingConfidence,
        8,
      ),

    depthConfidence:
      roundTo(
        depthConfidence,
        8,
      ),

    confidenceScore:
      roundTo(
        clamp(
          confidenceScore,
          RATE_MIN,
          RATE_MAX,
        ),
        8,
      ),
  }
}


// ============================================================
// V2 EVIDENCE CONFIDENCE
// ============================================================

/**
 * Venue-participation V2 confidence preserves the same separation
 * between quality and evidence credibility as V1.
 *
 * The behavioral difference is diminishing returns.
 *
 * Each evidence family uses:
 *
 *   1 - exp(-evidence / scale)
 *
 * before weighted composition.
 *
 * Weighting:
 *
 *   unique participants     55%
 *   ratings                 35%
 *   weighted participation  10%
 *
 * This means:
 *
 *   - additional independent people matter most
 *   - additional ratings strongly improve confidence
 *   - deeper exploration helps
 *   - repeat depth cannot overwhelm audience breadth
 *   - very large evidence volumes eventually have very little
 *     marginal impact
 *
 * None of these evidence dimensions directly adds quality points.
 */
function calculateVenueParticipationConfidenceV2(
  evidence:
    VenueParticipationScoringEvidence,
): {
  participantConfidence: number
  ratingConfidence: number
  depthConfidence: number
  confidenceScore: number
} {
  const participantConfidence =
    exponentialConfidence(
      evidence.uniqueParticipantCount,

      VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_SCALES
        .uniqueParticipants,
    )

  const ratingConfidence =
    exponentialConfidence(
      evidence.ratingCount,

      VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_SCALES
        .ratings,
    )

  const depthConfidence =
    exponentialConfidence(
      evidence.weightedParticipation,

      VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_SCALES
        .weightedParticipation,
    )

  const totalWeight =
    VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS
      .uniqueParticipants
    +
    VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS
      .ratings
    +
    VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS
      .weightedParticipation

  if (
    !Number.isFinite(
      totalWeight,
    ) ||
    totalWeight <=
      0
  ) {
    throw new VenueParticipationScoringError({
      code:
        'INVALID_CONFIDENCE_CONFIGURATION',

      message:
        'Venue-participation V2 confidence weights must sum to a positive finite value.',

      context: {
        totalWeight,

        weights:
          VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS,
      },
    })
  }

  const confidenceScore =
    (
      participantConfidence *
        VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS
          .uniqueParticipants
      +
      ratingConfidence *
        VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS
          .ratings
      +
      depthConfidence *
        VENUE_PARTICIPATION_SCORING_V2_CONFIDENCE_WEIGHTS
          .weightedParticipation
    ) /
    totalWeight

  return {
    participantConfidence:
      roundTo(
        participantConfidence,
        8,
      ),

    ratingConfidence:
      roundTo(
        ratingConfidence,
        8,
      ),

    depthConfidence:
      roundTo(
        depthConfidence,
        8,
      ),

    confidenceScore:
      roundTo(
        clamp(
          confidenceScore,
          RATE_MIN,
          RATE_MAX,
        ),
        8,
      ),
  }
}


// ============================================================
// V1 CONFIDENCE SHRINKAGE
// ============================================================

function applyVenueParticipationConfidenceV1(
  rawScore: number,
  confidenceScore: number,
): number {
  return clamp(
    NEUTRAL_SCORE
    +
    confidenceScore *
      (
        rawScore -
        NEUTRAL_SCORE
      ),

    COMPETITION_SCORE_MIN,
    COMPETITION_SCORE_MAX,
  )
}


// ============================================================
// V2 CONFIDENCE SHRINKAGE
// ============================================================

/**
 * V2 intentionally preserves the same neutral-score shrinkage
 * formula as V1.
 *
 * The algorithm change occurs only in how confidence itself is
 * derived.
 */
function applyVenueParticipationConfidenceV2(
  rawScore: number,
  confidenceScore: number,
): number {
  return clamp(
    NEUTRAL_SCORE
    +
    confidenceScore *
      (
        rawScore -
        NEUTRAL_SCORE
      ),

    COMPETITION_SCORE_MIN,
    COMPETITION_SCORE_MAX,
  )
}


// ============================================================
// OFFICIAL V1 SCORER
// ============================================================

/**
 * Official:
 *
 *   taste_duel_venue_participation_v1
 *
 * scoring contract.
 *
 * ============================================================
 * QUALITY
 * ============================================================
 *
 * V1 quality is ONLY:
 *
 *   canonical venue_visits.rating
 *
 * The observed average is Bayesian-shrunk toward neutral 3/5,
 * then mapped onto 0–100.
 *
 * No participation count, traffic, visit volume, venue breadth,
 * or depth metric directly contributes quality points.
 *
 * Missing rating evidence means quality is unknown rather than
 * bad, so:
 *
 *   rawScore = 50
 *
 * when ratingCount = 0.
 *
 *
 * ============================================================
 * CONFIDENCE
 * ============================================================
 *
 * Confidence measures how much credible evidence supports the
 * rating-quality estimate.
 *
 * V1 confidence combines:
 *
 *   uniqueParticipantCount
 *   ratingCount
 *   weightedParticipation
 *
 * Each dimension uses capped-linear saturation before weighted
 * combination.
 *
 *
 * ============================================================
 * FINAL SCORE
 * ============================================================
 *
 *   finalScore =
 *
 *     50
 *     +
 *     confidence
 *     *
 *     (
 *       ratingQuality
 *       -
 *       50
 *     )
 *
 * Therefore:
 *
 *   small evidence sample
 *     -> score remains close to neutral
 *
 *   large credible evidence sample
 *     -> observed quality is allowed to express itself
 *
 *
 * ============================================================
 * BREADTH
 * ============================================================
 *
 * breadthRate remains part of canonical evidence and the result
 * contract for analytics, diagnostics, and future algorithms.
 *
 * It contributes zero direct score weight in V1.
 */
export function scoreVenueParticipationEntryV1(
  evidence:
    VenueParticipationScoringEvidence,
): VenueParticipationScoringResult {
  validateVenueParticipationScoringEvidence(
    evidence,
  )

  // ----------------------------------------------------------
  // Rating quality
  // ----------------------------------------------------------

  const {
    adjustedAverageRating,
    ratingScore,
  } =
    calculateVenueParticipationRatingQualityV1(
      evidence.averageRating,
      evidence.ratingCount,
    )


  // ----------------------------------------------------------
  // Evidence confidence
  // ----------------------------------------------------------

  const {
    participantConfidence,
    ratingConfidence,
    depthConfidence,
    confidenceScore,
  } =
    calculateVenueParticipationConfidenceV1(
      evidence,
    )


  // ----------------------------------------------------------
  // Raw quality
  // ----------------------------------------------------------

  const rawScore =
    ratingScore ??
    NEUTRAL_SCORE


  // ----------------------------------------------------------
  // Official score
  // ----------------------------------------------------------

  const finalScore =
    applyVenueParticipationConfidenceV1(
      rawScore,
      confidenceScore,
    )


  // ----------------------------------------------------------
  // Result
  // ----------------------------------------------------------

  return {
    algorithmVersion:
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION,

    uniqueParticipantCount:
      evidence.uniqueParticipantCount,

    uniqueVenueVisitorCount:
      evidence.uniqueVenueVisitorCount,

    weightedParticipation:
      roundTo(
        evidence.weightedParticipation,
        8,
      ),

    ratingCount:
      evidence.ratingCount,

    averageRating:
      evidence.averageRating ===
        null
        ? null
        : roundTo(
            evidence.averageRating,
            4,
          ),

    venueCount:
      evidence.venueCount,

    visitedVenueCount:
      evidence.visitedVenueCount,

    breadthRate:
      evidence.breadthRate ===
        null
        ? null
        : roundTo(
            evidence.breadthRate,
            8,
          ),

    adjustedAverageRating,

    ratingScore,

    participantConfidence,

    ratingConfidence,

    depthConfidence,

    confidenceScore,

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

    breadthScore:
      null,
  }
}


// ============================================================
// OFFICIAL V2 SCORER
// ============================================================

/**
 * Official:
 *
 *   taste_duel_venue_participation_v2
 *
 * scoring contract.
 *
 * V2 deliberately preserves the V1 definition of quality:
 *
 *   canonical venue_visits.rating
 *
 * with the same Bayesian neutral prior.
 *
 * V2 changes only the confidence model.
 *
 * ============================================================
 * QUALITY
 * ============================================================
 *
 *   rating quality
 *
 *     =
 *
 *   Bayesian-shrunk canonical venue rating
 *
 *     mapped to
 *
 *   0..100
 *
 *
 * ============================================================
 * CONFIDENCE
 * ============================================================
 *
 * Each evidence dimension uses:
 *
 *   confidence =
 *
 *     1
 *     -
 *     exp(
 *       -evidence / scale
 *     )
 *
 * with:
 *
 *   unique participants:
 *     scale 20
 *     weight 55%
 *
 *   rating count:
 *     scale 15
 *     weight 35%
 *
 *   weighted participation:
 *     scale 25
 *     weight 10%
 *
 * This creates diminishing marginal returns:
 *
 *   early evidence
 *     -> meaningful confidence gains
 *
 *   already-large evidence
 *     -> progressively smaller gains
 *
 *
 * ============================================================
 * FINAL SCORE
 * ============================================================
 *
 *   finalScore =
 *
 *     50
 *     +
 *     confidenceScore
 *     *
 *     (
 *       ratingQuality
 *       -
 *       50
 *     )
 *
 *
 * ============================================================
 * BREADTH
 * ============================================================
 *
 * breadthRate remains tracked and returned.
 *
 * It contributes zero direct score weight in V2.
 */
export function scoreVenueParticipationEntryV2(
  evidence:
    VenueParticipationScoringEvidence,
): VenueParticipationScoringResult {
  validateVenueParticipationScoringEvidence(
    evidence,
  )

  // ----------------------------------------------------------
  // Rating quality
  // ----------------------------------------------------------
  //
  // Intentionally preserves the V1 rating-quality contract.
  // ----------------------------------------------------------

  const {
    adjustedAverageRating,
    ratingScore,
  } =
    calculateVenueParticipationRatingQualityV1(
      evidence.averageRating,
      evidence.ratingCount,
    )


  // ----------------------------------------------------------
  // Diminishing-return evidence confidence
  // ----------------------------------------------------------

  const {
    participantConfidence,
    ratingConfidence,
    depthConfidence,
    confidenceScore,
  } =
    calculateVenueParticipationConfidenceV2(
      evidence,
    )


  // ----------------------------------------------------------
  // Raw quality
  // ----------------------------------------------------------

  const rawScore =
    ratingScore ??
    NEUTRAL_SCORE


  // ----------------------------------------------------------
  // Official score
  // ----------------------------------------------------------

  const finalScore =
    applyVenueParticipationConfidenceV2(
      rawScore,
      confidenceScore,
    )


  // ----------------------------------------------------------
  // Result
  // ----------------------------------------------------------

  return {
    algorithmVersion:
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION_V2,

    uniqueParticipantCount:
      evidence.uniqueParticipantCount,

    uniqueVenueVisitorCount:
      evidence.uniqueVenueVisitorCount,

    weightedParticipation:
      roundTo(
        evidence.weightedParticipation,
        8,
      ),

    ratingCount:
      evidence.ratingCount,

    averageRating:
      evidence.averageRating ===
        null
        ? null
        : roundTo(
            evidence.averageRating,
            4,
          ),

    venueCount:
      evidence.venueCount,

    visitedVenueCount:
      evidence.visitedVenueCount,

    breadthRate:
      evidence.breadthRate ===
        null
        ? null
        : roundTo(
            evidence.breadthRate,
            8,
          ),

    adjustedAverageRating,

    ratingScore,

    participantConfidence,

    ratingConfidence,

    depthConfidence,

    confidenceScore,

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

    breadthScore:
      null,
  }
}


// ============================================================
// VERSIONED OFFICIAL SCORING DISPATCH
// ============================================================

/**
 * Canonical version-aware venue-participation scoring entry point.
 *
 * Existing callers that explicitly require historical V1 behavior
 * may continue calling scoreVenueParticipationEntryV1().
 *
 * New orchestration code should prefer this dispatcher whenever
 * algorithmVersion is selected from persisted/configured data.
 *
 * IMPORTANT:
 *
 * The default deliberately remains V1.
 *
 * Merely registering V2 must not silently change production
 * behavior for existing callers.
 */
export function scoreVenueParticipationEntry(
  evidence:
    VenueParticipationScoringEvidence,

  version:
    VenueParticipationScoringAlgorithmVersion =
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION,
): VenueParticipationScoringResult {
  switch (
    version
  ) {
    case VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION:
      return scoreVenueParticipationEntryV1(
        evidence,
      )

    case VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION_V2:
      return scoreVenueParticipationEntryV2(
        evidence,
      )

    default:
      throw new VenueParticipationScoringError({
        code:
          'UNSUPPORTED_SCORING_ALGORITHM_VERSION',

        message:
          `Unsupported venue-participation scoring algorithm version: ${String(
            version,
          )}`,

        context: {
          version,
        },
      })
  }
}


// ============================================================
// SCORING VERSION GUARD
// ============================================================

export function isVenueParticipationScoringAlgorithmVersion(
  value: unknown,
): value is VenueParticipationScoringAlgorithmVersion {
  return (
    value ===
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION ||
    value ===
      VENUE_PARTICIPATION_SCORING_ALGORITHM_VERSION_V2
  )
}