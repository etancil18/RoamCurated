// lib/competitions/qualification.ts

/**
 * Roam competition participation qualification rules.
 *
 * IMPORTANT:
 *
 * Qualification logic is VERSIONED.
 *
 * Never silently change the behavior of an existing rule version.
 * If qualification logic changes, introduce a new version and keep
 * historical versions intact so old competition evidence remains
 * interpretable and auditable.
 *
 * V1 RULE:
 *
 *   3–4 total stops
 *     -> 100% required
 *
 *   5 total stops
 *     -> 80% required
 *     -> exactly 4 verified stops
 *
 *   6+ total stops
 *     -> 75% required
 *     -> rounded UP to the next whole stop
 *
 *   Routes with 5+ total stops
 *     -> always require at least 4 verified stops
 *
 * Examples:
 *
 *   3 stops -> 3 required
 *   4 stops -> 4 required
 *   5 stops -> 4 required
 *   6 stops -> 5 required
 *   7 stops -> 6 required
 *   8 stops -> 6 required
 *   9 stops -> 7 required
 *  10 stops -> 8 required
 *
 * This file is deliberately pure:
 *
 *   - no Supabase access
 *   - no database writes
 *   - no request/session access
 *   - no Date.now()
 *   - no environment dependencies
 *
 * That makes qualification deterministic and safe to reuse in:
 *
 *   - trusted reconciliation jobs
 *   - API routes
 *   - server actions
 *   - admin tooling
 *   - tests
 *   - scoring/audit code
 */

import { COMPETITION_MIN_ROUTE_STOPS } from "./constants";


// ============================================================
// VERSIONING
// ============================================================

export const COMPETITION_QUALIFICATION_RULE_VERSION = {
  V1: "taste_duel_qualification_v1",
} as const;

export type CompetitionQualificationRuleVersion =
  (typeof COMPETITION_QUALIFICATION_RULE_VERSION)[keyof typeof COMPETITION_QUALIFICATION_RULE_VERSION];


/**
 * Default rule used for newly evaluated Taste Duel participation.
 *
 * Never repoint this constant to a behaviorally different rule
 * without deliberately deciding how new competitions choose their
 * qualification version.
 */
export const DEFAULT_COMPETITION_QUALIFICATION_RULE_VERSION =
  COMPETITION_QUALIFICATION_RULE_VERSION.V1;


// ============================================================
// V1 CONSTANTS
// ============================================================

/**
 * 3–4 stops require perfect completion.
 */
export const QUALIFICATION_V1_SHORT_ROUTE_MAX_STOPS = 4 as const;

export const QUALIFICATION_V1_SHORT_ROUTE_REQUIRED_RATE = 1 as const;


/**
 * 5 stops require 80%.
 */
export const QUALIFICATION_V1_FIVE_STOP_ROUTE_LENGTH = 5 as const;

export const QUALIFICATION_V1_FIVE_STOP_REQUIRED_RATE = 0.8 as const;


/**
 * 6+ stops require 75%, rounded upward.
 */
export const QUALIFICATION_V1_LONG_ROUTE_MIN_STOPS = 6 as const;

export const QUALIFICATION_V1_LONG_ROUTE_REQUIRED_RATE = 0.75 as const;


/**
 * Any route with 5+ stops must require at least 4 verified stops,
 * even if a future percentage calculation would otherwise produce
 * a smaller number.
 */
export const QUALIFICATION_V1_MIN_VERIFIED_STOPS_FOR_5_PLUS = 4 as const;


// ============================================================
// CORE INPUT / OUTPUT CONTRACTS
// ============================================================

export interface CompetitionQualificationInput {
  totalStops: number;
  verifiedStops: number;

  /**
   * Optional explicit version.
   *
   * Defaults to the current default rule for new evaluations.
   */
  version?: CompetitionQualificationRuleVersion;
}


export interface CompetitionQualificationRequirement {
  version: CompetitionQualificationRuleVersion;

  totalStops: number;

  /**
   * Number of verified stops required to qualify.
   */
  requiredVerifiedStops: number;

  /**
   * Effective minimum completion ratio implied by the required
   * integer stop count.
   *
   * Example:
   *
   *   6 total / 5 required
   *     => 0.833333...
   *
   * This may be higher than the nominal 0.75 rule because the
   * result must round upward to a whole stop.
   */
  effectiveRequiredCompletionRatio: number;

  /**
   * Human/domain nominal threshold before whole-stop rounding.
   *
   * V1:
   *
   *   3–4 -> 1.00
   *   5   -> 0.80
   *   6+  -> 0.75
   */
  nominalRequiredCompletionRatio: number;
}


export interface CompetitionQualificationResult
  extends CompetitionQualificationRequirement {
  verifiedStops: number;

  /**
   * Actual participant completion ratio.
   *
   * Always 0–1.
   */
  completionRatio: number;

  /**
   * Number of additional verified stops required.
   *
   * 0 means the participant has met or exceeded the threshold.
   */
  remainingVerifiedStops: number;

  qualified: boolean;
}


// ============================================================
// DOMAIN ERROR
// ============================================================

export class CompetitionQualificationError extends Error {
  readonly code:
    | "INVALID_TOTAL_STOPS"
    | "INVALID_VERIFIED_STOPS"
    | "VERIFIED_STOPS_EXCEED_TOTAL"
    | "UNSUPPORTED_QUALIFICATION_VERSION";

  constructor(
    code: CompetitionQualificationError["code"],
    message: string,
  ) {
    super(message);

    this.name = "CompetitionQualificationError";
    this.code = code;
  }
}


// ============================================================
// INPUT VALIDATION
// ============================================================

function assertValidTotalStops(
  totalStops: number,
): void {
  if (
    !Number.isSafeInteger(totalStops)
    || totalStops < COMPETITION_MIN_ROUTE_STOPS
  ) {
    throw new CompetitionQualificationError(
      "INVALID_TOTAL_STOPS",
      `Competition routes must contain at least ${COMPETITION_MIN_ROUTE_STOPS} stops and totalStops must be a safe integer.`,
    );
  }
}


function assertValidVerifiedStops(
  verifiedStops: number,
): void {
  if (
    !Number.isSafeInteger(verifiedStops)
    || verifiedStops < 0
  ) {
    throw new CompetitionQualificationError(
      "INVALID_VERIFIED_STOPS",
      "verifiedStops must be a non-negative safe integer.",
    );
  }
}


function assertVerifiedStopsDoNotExceedTotal(
  totalStops: number,
  verifiedStops: number,
): void {
  if (verifiedStops > totalStops) {
    throw new CompetitionQualificationError(
      "VERIFIED_STOPS_EXCEED_TOTAL",
      "verifiedStops cannot exceed totalStops.",
    );
  }
}


// ============================================================
// V1 REQUIREMENT CALCULATION
// ============================================================

/**
 * Returns the required number of verified stops under the
 * immutable Taste Duel qualification v1 rule.
 */
function getRequiredVerifiedStopsV1(
  totalStops: number,
): number {
  assertValidTotalStops(totalStops);

  // ----------------------------------------------------------
  // 3–4 stops:
  // 100% required.
  // ----------------------------------------------------------

  if (
    totalStops
    <= QUALIFICATION_V1_SHORT_ROUTE_MAX_STOPS
  ) {
    return totalStops;
  }


  // ----------------------------------------------------------
  // Exactly 5 stops:
  // 80% required.
  //
  // Explicit branch keeps the business rule obvious rather than
  // relying on a coincidentally equivalent generic formula.
  // ----------------------------------------------------------

  if (
    totalStops
    === QUALIFICATION_V1_FIVE_STOP_ROUTE_LENGTH
  ) {
    return Math.max(
      QUALIFICATION_V1_MIN_VERIFIED_STOPS_FOR_5_PLUS,
      Math.ceil(
        totalStops
        * QUALIFICATION_V1_FIVE_STOP_REQUIRED_RATE,
      ),
    );
  }


  // ----------------------------------------------------------
  // 6+ stops:
  // 75%, rounded upward to a whole stop.
  //
  // Also preserve the hard minimum of 4 verified stops for any
  // route length >= 5.
  // ----------------------------------------------------------

  return Math.max(
    QUALIFICATION_V1_MIN_VERIFIED_STOPS_FOR_5_PLUS,
    Math.ceil(
      totalStops
      * QUALIFICATION_V1_LONG_ROUTE_REQUIRED_RATE,
    ),
  );
}


/**
 * Returns the nominal percentage threshold associated with v1.
 *
 * This is distinct from the effective percentage after rounding.
 *
 * Example:
 *
 *   6 stops:
 *
 *     nominal = 0.75
 *     required stops = ceil(4.5) = 5
 *     effective = 5 / 6 = 0.833333...
 */
function getNominalRequiredCompletionRatioV1(
  totalStops: number,
): number {
  assertValidTotalStops(totalStops);

  if (
    totalStops
    <= QUALIFICATION_V1_SHORT_ROUTE_MAX_STOPS
  ) {
    return QUALIFICATION_V1_SHORT_ROUTE_REQUIRED_RATE;
  }

  if (
    totalStops
    === QUALIFICATION_V1_FIVE_STOP_ROUTE_LENGTH
  ) {
    return QUALIFICATION_V1_FIVE_STOP_REQUIRED_RATE;
  }

  return QUALIFICATION_V1_LONG_ROUTE_REQUIRED_RATE;
}


// ============================================================
// VERSIONED RULE DISPATCH
// ============================================================

export function getCompetitionQualificationRequirement(
  totalStops: number,
  version: CompetitionQualificationRuleVersion =
    DEFAULT_COMPETITION_QUALIFICATION_RULE_VERSION,
): CompetitionQualificationRequirement {
  assertValidTotalStops(totalStops);

  switch (version) {
    case COMPETITION_QUALIFICATION_RULE_VERSION.V1: {
      const requiredVerifiedStops =
        getRequiredVerifiedStopsV1(totalStops);

      return {
        version,
        totalStops,
        requiredVerifiedStops,

        nominalRequiredCompletionRatio:
          getNominalRequiredCompletionRatioV1(
            totalStops,
          ),

        effectiveRequiredCompletionRatio:
          requiredVerifiedStops / totalStops,
      };
    }

    default: {
      /**
       * Defensive runtime protection.
       *
       * TypeScript should prevent this in typed application code,
       * but API/database input may still contain arbitrary strings.
       */
      throw new CompetitionQualificationError(
        "UNSUPPORTED_QUALIFICATION_VERSION",
        `Unsupported competition qualification version: ${String(
          version,
        )}`,
      );
    }
  }
}


// ============================================================
// PRIMARY QUALIFICATION FUNCTION
// ============================================================

/**
 * Canonical competition qualification evaluator.
 *
 * Prefer this function anywhere code needs to determine whether
 * a participant qualifies.
 */
export function evaluateCompetitionQualification({
  totalStops,
  verifiedStops,
  version =
    DEFAULT_COMPETITION_QUALIFICATION_RULE_VERSION,
}: CompetitionQualificationInput): CompetitionQualificationResult {
  assertValidTotalStops(totalStops);
  assertValidVerifiedStops(verifiedStops);

  assertVerifiedStopsDoNotExceedTotal(
    totalStops,
    verifiedStops,
  );

  const requirement =
    getCompetitionQualificationRequirement(
      totalStops,
      version,
    );

  const qualified =
    verifiedStops
    >= requirement.requiredVerifiedStops;

  return {
    ...requirement,

    verifiedStops,

    completionRatio:
      verifiedStops / totalStops,

    remainingVerifiedStops: Math.max(
      0,
      requirement.requiredVerifiedStops
        - verifiedStops,
    ),

    qualified,
  };
}


// ============================================================
// BOOLEAN CONVENIENCE FUNCTION
// ============================================================

/**
 * Lightweight convenience wrapper.
 *
 * Use evaluateCompetitionQualification() when callers also need
 * threshold metadata for UI, logging, or reconciliation.
 */
export function qualifiesForCompetitionEntry(
  totalStops: number,
  verifiedStops: number,
  version: CompetitionQualificationRuleVersion =
    DEFAULT_COMPETITION_QUALIFICATION_RULE_VERSION,
): boolean {
  return evaluateCompetitionQualification({
    totalStops,
    verifiedStops,
    version,
  }).qualified;
}


// ============================================================
// REQUIRED-STOP CONVENIENCE FUNCTION
// ============================================================

/**
 * Useful for reconciliation code that only needs the required
 * integer stop count.
 */
export function getRequiredVerifiedStops(
  totalStops: number,
  version: CompetitionQualificationRuleVersion =
    DEFAULT_COMPETITION_QUALIFICATION_RULE_VERSION,
): number {
  return getCompetitionQualificationRequirement(
    totalStops,
    version,
  ).requiredVerifiedStops;
}


// ============================================================
// VERSION GUARD
// ============================================================

export function isCompetitionQualificationRuleVersion(
  value: string,
): value is CompetitionQualificationRuleVersion {
  return (
    Object.values(
      COMPETITION_QUALIFICATION_RULE_VERSION,
    ) as readonly string[]
  ).includes(value);
}


// ============================================================
// HUMAN-READABLE RULE DESCRIPTION
// ============================================================

/**
 * Stable wording for admin/debug surfaces.
 *
 * Avoid using this as the only user-facing product copy if the UI
 * needs localized or editorial language.
 */
export function getCompetitionQualificationRuleDescription(
  version: CompetitionQualificationRuleVersion =
    DEFAULT_COMPETITION_QUALIFICATION_RULE_VERSION,
): string {
  switch (version) {
    case COMPETITION_QUALIFICATION_RULE_VERSION.V1:
      return [
        "3–4 stops require 100% completion.",
        "5 stops require 80% completion.",
        "6+ stops require 75% completion rounded up to whole stops.",
        "Routes with 5+ stops always require at least 4 verified stops.",
      ].join(" ");

    default:
      throw new CompetitionQualificationError(
        "UNSUPPORTED_QUALIFICATION_VERSION",
        `Unsupported competition qualification version: ${String(
          version,
        )}`,
      );
  }
}