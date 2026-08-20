// lib/competitions/constants.ts

/**
 * Central constants for Roam Competitions / Taste Duels.
 *
 * Keep these values synchronized with:
 *
 *   public.competitions
 *   public.competition_entries
 *   public.competition_submissions
 *   public.competition_entry_score_snapshots
 *   public.competition_results
 *
 * These constants are intended to be imported by:
 *
 *   - API routes
 *   - server actions
 *   - admin tooling
 *   - scoring logic
 *   - UI components
 *   - validation helpers
 *
 * Avoid re-declaring these literals elsewhere.
 */

// ============================================================
// COMPETITION TYPES
// ============================================================

export const COMPETITION_TYPE = {
  TASTE_DUEL: "taste_duel",
} as const;

export type CompetitionType =
  (typeof COMPETITION_TYPE)[keyof typeof COMPETITION_TYPE];

export const COMPETITION_TYPES = [
  COMPETITION_TYPE.TASTE_DUEL,
] as const;


// ============================================================
// COMPETITION STATUSES
// ============================================================

export const COMPETITION_STATUS = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  LIVE: "live",
  SCORING: "scoring",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type CompetitionStatus =
  (typeof COMPETITION_STATUS)[keyof typeof COMPETITION_STATUS];

export const COMPETITION_STATUSES = [
  COMPETITION_STATUS.DRAFT,
  COMPETITION_STATUS.SCHEDULED,
  COMPETITION_STATUS.LIVE,
  COMPETITION_STATUS.SCORING,
  COMPETITION_STATUS.COMPLETED,
  COMPETITION_STATUS.CANCELLED,
] as const;


// ============================================================
// RESULT STATUSES
// ============================================================

/**
 * Mirrors public.competitions.result_status.
 *
 * "pending" exists only before official settlement.
 */
export const COMPETITION_RESULT_STATUS = {
  PENDING: "pending",
  WINNER: "winner",
  TIE: "tie",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
  VOID: "void",
} as const;

export type CompetitionResultStatus =
  (typeof COMPETITION_RESULT_STATUS)[keyof typeof COMPETITION_RESULT_STATUS];

export const COMPETITION_RESULT_STATUSES = [
  COMPETITION_RESULT_STATUS.PENDING,
  COMPETITION_RESULT_STATUS.WINNER,
  COMPETITION_RESULT_STATUS.TIE,
  COMPETITION_RESULT_STATUS.INSUFFICIENT_EVIDENCE,
  COMPETITION_RESULT_STATUS.VOID,
] as const;


/**
 * Mirrors public.competition_results.result_status.
 *
 * Once a row exists in competition_results, "pending" is no
 * longer a valid state.
 */
export const SETTLED_COMPETITION_RESULT_STATUSES = [
  COMPETITION_RESULT_STATUS.WINNER,
  COMPETITION_RESULT_STATUS.TIE,
  COMPETITION_RESULT_STATUS.INSUFFICIENT_EVIDENCE,
  COMPETITION_RESULT_STATUS.VOID,
] as const;


// ============================================================
// ENTRY STATUSES
// ============================================================

export const COMPETITION_ENTRY_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  WITHDRAWN: "withdrawn",
  DISQUALIFIED: "disqualified",
} as const;

export type CompetitionEntryStatus =
  (typeof COMPETITION_ENTRY_STATUS)[keyof typeof COMPETITION_ENTRY_STATUS];

export const COMPETITION_ENTRY_STATUSES = [
  COMPETITION_ENTRY_STATUS.PENDING,
  COMPETITION_ENTRY_STATUS.APPROVED,
  COMPETITION_ENTRY_STATUS.WITHDRAWN,
  COMPETITION_ENTRY_STATUS.DISQUALIFIED,
] as const;


// ============================================================
// SUBMISSION STATUSES
// ============================================================

export const COMPETITION_SUBMISSION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type CompetitionSubmissionStatus =
  (typeof COMPETITION_SUBMISSION_STATUS)[keyof typeof COMPETITION_SUBMISSION_STATUS];

export const COMPETITION_SUBMISSION_STATUSES = [
  COMPETITION_SUBMISSION_STATUS.PENDING,
  COMPETITION_SUBMISSION_STATUS.APPROVED,
  COMPETITION_SUBMISSION_STATUS.REJECTED,
] as const;


// ============================================================
// SOURCE TYPES
// ============================================================

/**
 * Canonical route provenance.
 *
 * active_flow:
 *   User submits a completed Active Flow.
 *
 * visit_history:
 *   User submits a qualifying Visit History day.
 */
export const COMPETITION_SOURCE_TYPE = {
  ACTIVE_FLOW: "active_flow",
  VISIT_HISTORY: "visit_history",
} as const;

export type CompetitionSourceType =
  (typeof COMPETITION_SOURCE_TYPE)[keyof typeof COMPETITION_SOURCE_TYPE];

export const COMPETITION_SOURCE_TYPES = [
  COMPETITION_SOURCE_TYPE.ACTIVE_FLOW,
  COMPETITION_SOURCE_TYPE.VISIT_HISTORY,
] as const;


// ============================================================
// SNAPSHOT TYPES
// ============================================================

export const COMPETITION_SNAPSHOT_TYPE = {
  LIVE: "live",
  FINAL: "final",
} as const;

export type CompetitionSnapshotType =
  (typeof COMPETITION_SNAPSHOT_TYPE)[keyof typeof COMPETITION_SNAPSHOT_TYPE];

export const COMPETITION_SNAPSHOT_TYPES = [
  COMPETITION_SNAPSHOT_TYPE.LIVE,
  COMPETITION_SNAPSHOT_TYPE.FINAL,
] as const;


// ============================================================
// XP AWARD STATUSES
// ============================================================

export const COMPETITION_XP_AWARD_STATUS = {
  PENDING: "pending",
  AWARDED: "awarded",
  FAILED: "failed",
  NOT_APPLICABLE: "not_applicable",
} as const;

export type CompetitionXpAwardStatus =
  (typeof COMPETITION_XP_AWARD_STATUS)[keyof typeof COMPETITION_XP_AWARD_STATUS];

export const COMPETITION_XP_AWARD_STATUSES = [
  COMPETITION_XP_AWARD_STATUS.PENDING,
  COMPETITION_XP_AWARD_STATUS.AWARDED,
  COMPETITION_XP_AWARD_STATUS.FAILED,
  COMPETITION_XP_AWARD_STATUS.NOT_APPLICABLE,
] as const;


// ============================================================
// ENTRY LIMITS
// ============================================================

/**
 * Database-enforced hard ceiling.
 *
 * public.competitions.max_entries is constrained to 2–4.
 */
export const COMPETITION_MIN_ENTRIES = 2 as const;
export const COMPETITION_MAX_ENTRIES = 4 as const;

/**
 * Default competition size.
 *
 * V1 defaults to a direct 2-contender duel while preserving
 * support for 3- and 4-way competitions.
 */
export const DEFAULT_COMPETITION_MAX_ENTRIES =
  COMPETITION_MIN_ENTRIES;


// ============================================================
// CONTENDER SLOTS
// ============================================================

export const COMPETITION_CONTENDER_SLOT = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
} as const;

export type CompetitionContenderSlot =
  (typeof COMPETITION_CONTENDER_SLOT)[keyof typeof COMPETITION_CONTENDER_SLOT];

export const COMPETITION_CONTENDER_SLOTS = [
  COMPETITION_CONTENDER_SLOT.A,
  COMPETITION_CONTENDER_SLOT.B,
  COMPETITION_CONTENDER_SLOT.C,
  COMPETITION_CONTENDER_SLOT.D,
] as const;

export const COMPETITION_CONTENDER_LABEL = {
  [COMPETITION_CONTENDER_SLOT.A]: "A",
  [COMPETITION_CONTENDER_SLOT.B]: "B",
  [COMPETITION_CONTENDER_SLOT.C]: "C",
  [COMPETITION_CONTENDER_SLOT.D]: "D",
} as const;


// ============================================================
// ROUTE / SUBMISSION LIMITS
// ============================================================

/**
 * Competition routes require at least 3 venues.
 *
 * Mirrors the database checks on:
 *
 *   competition_entries.venue_ids
 *   competition_submissions.venue_ids
 *   competition_participations.total_stop_count
 */
export const COMPETITION_MIN_ROUTE_STOPS = 3 as const;


// ============================================================
// PARTICIPATION DEFAULTS
// ============================================================

/**
 * V1 intentionally allows competitions to operate without a
 * minimum qualified-participant threshold.
 *
 * The schema supports increasing this later.
 */
export const DEFAULT_MINIMUM_QUALIFIED_PARTICIPANTS = 0 as const;


// ============================================================
// RATING CONSTANTS
// ============================================================

export const COMPETITION_RATING_MIN = 1 as const;
export const COMPETITION_RATING_MAX = 5 as const;


// ============================================================
// SCORE SCALES
// ============================================================

export const COMPETITION_RATE_MIN = 0 as const;
export const COMPETITION_RATE_MAX = 1 as const;

export const COMPETITION_SCORE_MIN = 0 as const;
export const COMPETITION_SCORE_MAX = 100 as const;


// ============================================================
// ALGORITHM VERSION
// ============================================================

/**
 * Default scoring algorithm identifier for v1.
 *
 * Never change the behavior of an existing algorithm version.
 * Introduce a new version string instead.
 */
export const DEFAULT_COMPETITION_ALGORITHM_VERSION =
  "taste_duel_v1" as const;


// ============================================================
// XP REWARD DEFAULTS
// ============================================================

/**
 * Database default currently permits zero reward.
 *
 * Keep zero as the safe platform default so merely creating a
 * competition never accidentally creates an XP liability.
 *
 * Admin/configuration may override this per competition.
 */
export const DEFAULT_COMPETITION_XP_REWARD = 0 as const;

export const MIN_COMPETITION_XP_REWARD = 0 as const;


// ============================================================
// ANONYMITY
// ============================================================

/**
 * Taste Duel competitors are anonymous while the competition is
 * live by default.
 *
 * Identity-bearing base tables should not be exposed publicly
 * during the anonymous competition lifecycle.
 */
export const DEFAULT_COMPETITION_ANONYMOUS_ENTRIES = true as const;

export const COMPETITION_ANONYMITY = {
  ANONYMOUS: true,
  REVEALED: false,
} as const;


// ============================================================
// DEFAULT COMPETITION CONFIG
// ============================================================

/**
 * Canonical defaults for new Taste Duel competitions.
 *
 * Use this from trusted creation logic rather than duplicating
 * defaults in API routes or admin forms.
 */
export const DEFAULT_COMPETITION_CONFIG = {
  competitionType: COMPETITION_TYPE.TASTE_DUEL,
  status: COMPETITION_STATUS.DRAFT,
  resultStatus: COMPETITION_RESULT_STATUS.PENDING,

  maxEntries: DEFAULT_COMPETITION_MAX_ENTRIES,

  minimumQualifiedParticipants:
    DEFAULT_MINIMUM_QUALIFIED_PARTICIPANTS,

  xpReward: DEFAULT_COMPETITION_XP_REWARD,

  anonymousEntries:
    DEFAULT_COMPETITION_ANONYMOUS_ENTRIES,
} as const;


// ============================================================
// STATUS GROUPS
// ============================================================

/**
 * Competition statuses visible through the current public
 * competitions RLS policy.
 */
export const PUBLIC_COMPETITION_STATUSES = [
  COMPETITION_STATUS.SCHEDULED,
  COMPETITION_STATUS.LIVE,
  COMPETITION_STATUS.SCORING,
  COMPETITION_STATUS.COMPLETED,
] as const;


/**
 * Statuses where participation / competitive evidence may be
 * actively accumulating.
 */
export const ACTIVE_COMPETITION_STATUSES = [
  COMPETITION_STATUS.LIVE,
  COMPETITION_STATUS.SCORING,
] as const;


/**
 * Competition status required when a new competition-linked
 * Active Flow bridge / participation begins.
 */
export const COMPETITION_PARTICIPATION_START_STATUSES = [
  COMPETITION_STATUS.LIVE,
] as const;


/**
 * Statuses from which ordinary scored settlement can occur.
 */
export const COMPETITION_SETTLEMENT_STATUSES = [
  COMPETITION_STATUS.SCORING,
  COMPETITION_STATUS.COMPLETED,
] as const;


/**
 * Statuses from which a competition may be formally voided.
 */
export const COMPETITION_VOIDABLE_STATUSES = [
  COMPETITION_STATUS.SCORING,
  COMPETITION_STATUS.COMPLETED,
  COMPETITION_STATUS.CANCELLED,
] as const;


// ============================================================
// XP TRANSITIONS
// ============================================================

/**
 * Explicit state-transition map for winner XP delivery.
 *
 * Mirrors the database trigger behavior.
 */
export const COMPETITION_XP_AWARD_TRANSITIONS = {
  [COMPETITION_XP_AWARD_STATUS.PENDING]: [
    COMPETITION_XP_AWARD_STATUS.AWARDED,
    COMPETITION_XP_AWARD_STATUS.FAILED,
  ],

  [COMPETITION_XP_AWARD_STATUS.FAILED]: [
    COMPETITION_XP_AWARD_STATUS.FAILED,
    COMPETITION_XP_AWARD_STATUS.AWARDED,
  ],

  [COMPETITION_XP_AWARD_STATUS.AWARDED]: [],

  [COMPETITION_XP_AWARD_STATUS.NOT_APPLICABLE]: [],
} as const;


// ============================================================
// TYPE-SAFE MEMBERSHIP HELPERS
// ============================================================

export function isCompetitionType(
  value: string,
): value is CompetitionType {
  return (
    COMPETITION_TYPES as readonly string[]
  ).includes(value);
}


export function isCompetitionStatus(
  value: string,
): value is CompetitionStatus {
  return (
    COMPETITION_STATUSES as readonly string[]
  ).includes(value);
}


export function isCompetitionResultStatus(
  value: string,
): value is CompetitionResultStatus {
  return (
    COMPETITION_RESULT_STATUSES as readonly string[]
  ).includes(value);
}


export function isCompetitionEntryStatus(
  value: string,
): value is CompetitionEntryStatus {
  return (
    COMPETITION_ENTRY_STATUSES as readonly string[]
  ).includes(value);
}


export function isCompetitionSubmissionStatus(
  value: string,
): value is CompetitionSubmissionStatus {
  return (
    COMPETITION_SUBMISSION_STATUSES as readonly string[]
  ).includes(value);
}


export function isCompetitionSourceType(
  value: string,
): value is CompetitionSourceType {
  return (
    COMPETITION_SOURCE_TYPES as readonly string[]
  ).includes(value);
}


export function isCompetitionSnapshotType(
  value: string,
): value is CompetitionSnapshotType {
  return (
    COMPETITION_SNAPSHOT_TYPES as readonly string[]
  ).includes(value);
}


export function isCompetitionXpAwardStatus(
  value: string,
): value is CompetitionXpAwardStatus {
  return (
    COMPETITION_XP_AWARD_STATUSES as readonly string[]
  ).includes(value);
}


export function isCompetitionContenderSlot(
  value: number,
): value is CompetitionContenderSlot {
  return (
    COMPETITION_CONTENDER_SLOTS as readonly number[]
  ).includes(value);
}


// ============================================================
// SMALL DOMAIN HELPERS
// ============================================================

export function getCompetitionContenderLabel(
  slot: CompetitionContenderSlot,
): "A" | "B" | "C" | "D" {
  return COMPETITION_CONTENDER_LABEL[slot];
}


export function isPublicCompetitionStatus(
  status: CompetitionStatus,
): boolean {
  return (
    PUBLIC_COMPETITION_STATUSES as readonly CompetitionStatus[]
  ).includes(status);
}


export function isActiveCompetitionStatus(
  status: CompetitionStatus,
): boolean {
  return (
    ACTIVE_COMPETITION_STATUSES as readonly CompetitionStatus[]
  ).includes(status);
}


export function isValidCompetitionEntryCount(
  value: number,
): boolean {
  return (
    Number.isInteger(value)
    && value >= COMPETITION_MIN_ENTRIES
    && value <= COMPETITION_MAX_ENTRIES
  );
}


export function isValidCompetitionRating(
  value: number,
): boolean {
  return (
    Number.isInteger(value)
    && value >= COMPETITION_RATING_MIN
    && value <= COMPETITION_RATING_MAX
  );
}


export function isValidCompetitionRate(
  value: number,
): boolean {
  return (
    Number.isFinite(value)
    && value >= COMPETITION_RATE_MIN
    && value <= COMPETITION_RATE_MAX
  );
}


export function isValidCompetitionScore(
  value: number,
): boolean {
  return (
    Number.isFinite(value)
    && value >= COMPETITION_SCORE_MIN
    && value <= COMPETITION_SCORE_MAX
  );
}


export function canTransitionCompetitionXpAwardStatus(
  from: CompetitionXpAwardStatus,
  to: CompetitionXpAwardStatus,
): boolean {
  if (from === to) {
    return true;
  }

  return (
    COMPETITION_XP_AWARD_TRANSITIONS[from] as readonly string[]
  ).includes(to);
}