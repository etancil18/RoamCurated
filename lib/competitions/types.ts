// lib/competitions/types.ts

/**
 * Central TypeScript contracts for Roam Competitions / Taste Duels.
 *
 * This file intentionally contains:
 *
 * - shared scalar aliases
 * - canonical enum-like constants
 * - database row contracts
 * - safe create/update payload contracts
 * - lightweight API/domain response contracts
 *
 * Keep database-backed unions synchronized with the corresponding
 * PostgreSQL CHECK constraints.
 *
 * PostgreSQL:
 *   uuid        -> string
 *   timestamptz -> ISO string
 *   date        -> YYYY-MM-DD string
 *   numeric     -> number
 *   text[]      -> string[]
 */

// ============================================================
// SHARED SCALARS
// ============================================================

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

/**
 * Venue IDs are canonically text across the competition system.
 *
 * This matches:
 *
 *   active_flow_sessions.venue_ids text[]
 *   active_flow_progress.venue_id  text
 *   competition_entries.venue_ids  text[]
 *   competition_submissions.venue_ids text[]
 */
export type VenueId = string;


// ============================================================
// COMPETITION CONSTANTS + UNIONS
// ============================================================

export const COMPETITION_TYPES = [
  "taste_duel",
] as const;

export type CompetitionType =
  (typeof COMPETITION_TYPES)[number];


export const COMPETITION_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "scoring",
  "completed",
  "cancelled",
] as const;

export type CompetitionStatus =
  (typeof COMPETITION_STATUSES)[number];


export const COMPETITION_RESULT_STATUSES = [
  "pending",
  "winner",
  "tie",
  "insufficient_evidence",
  "void",
] as const;

export type CompetitionResultStatus =
  (typeof COMPETITION_RESULT_STATUSES)[number];


/**
 * competition_results never stores "pending".
 *
 * Pending belongs to competitions.result_status before settlement.
 */
export const SETTLED_COMPETITION_RESULT_STATUSES = [
  "winner",
  "tie",
  "insufficient_evidence",
  "void",
] as const;

export type SettledCompetitionResultStatus =
  (typeof SETTLED_COMPETITION_RESULT_STATUSES)[number];


export const COMPETITION_ENTRY_STATUSES = [
  "pending",
  "approved",
  "withdrawn",
  "disqualified",
] as const;

export type CompetitionEntryStatus =
  (typeof COMPETITION_ENTRY_STATUSES)[number];


export const COMPETITION_SOURCE_TYPES = [
  "active_flow",
  "visit_history",
] as const;

export type CompetitionSourceType =
  (typeof COMPETITION_SOURCE_TYPES)[number];


/**
 * Same semantic values as CompetitionSourceType.
 *
 * Kept as its own alias because the database column is named
 * submission_source on competition_submissions.
 */
export type CompetitionSubmissionSource =
  CompetitionSourceType;


export const COMPETITION_SUBMISSION_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type CompetitionSubmissionStatus =
  (typeof COMPETITION_SUBMISSION_STATUSES)[number];


export const COMPETITION_SNAPSHOT_TYPES = [
  "live",
  "final",
] as const;

export type CompetitionSnapshotType =
  (typeof COMPETITION_SNAPSHOT_TYPES)[number];


export const COMPETITION_XP_AWARD_STATUSES = [
  "pending",
  "awarded",
  "failed",
  "not_applicable",
] as const;

export type CompetitionXpAwardStatus =
  (typeof COMPETITION_XP_AWARD_STATUSES)[number];


export const COMPETITION_CONTENDER_SLOTS = [
  1,
  2,
  3,
  4,
] as const;

export type CompetitionContenderSlot =
  (typeof COMPETITION_CONTENDER_SLOTS)[number];


export type CompetitionOverallRating =
  | 1
  | 2
  | 3
  | 4
  | 5;


// ============================================================
// COMPETITION
// ============================================================

/**
 * Mirrors public.competitions.
 */
export interface Competition {
  id: UUID;

  competition_type: CompetitionType;

  title: string;
  description: string | null;

  city: string | null;
  category: string | null;

  status: CompetitionStatus;

  starts_at: ISODateTime | null;
  ends_at: ISODateTime | null;

  max_entries: number;

  /**
   * V1 defaults to 0.
   * May be raised by future competition configurations.
   */
  minimum_qualified_participants: number;

  /**
   * Populated only when an official winner exists.
   */
  winner_entry_id: UUID | null;

  result_status: CompetitionResultStatus;

  xp_reward: number;

  /**
   * When true, contender identities should remain hidden
   * from public/live competition surfaces until settlement.
   */
  anonymous_entries: boolean;

  created_by: UUID | null;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


/**
 * Trusted/admin creation payload.
 *
 * Server/database defaults may fill omitted values.
 */
export interface CreateCompetitionInput {
  competition_type?: CompetitionType;

  title: string;
  description?: string | null;

  city?: string | null;
  category?: string | null;

  status?: CompetitionStatus;

  starts_at?: ISODateTime | null;
  ends_at?: ISODateTime | null;

  max_entries?: number;
  minimum_qualified_participants?: number;

  xp_reward?: number;
  anonymous_entries?: boolean;

  created_by?: UUID | null;
}


/**
 * Admin-editable competition configuration.
 *
 * Settlement fields are intentionally excluded.
 */
export interface UpdateCompetitionInput {
  title?: string;
  description?: string | null;

  city?: string | null;
  category?: string | null;

  status?: CompetitionStatus;

  starts_at?: ISODateTime | null;
  ends_at?: ISODateTime | null;

  max_entries?: number;
  minimum_qualified_participants?: number;

  xp_reward?: number;
  anonymous_entries?: boolean;
}


// ============================================================
// COMPETITION ENTRY
// ============================================================

/**
 * Mirrors public.competition_entries.
 *
 * Identity-bearing table.
 *
 * Do not expose raw rows publicly during anonymous live duels.
 */
export interface CompetitionEntry {
  id: UUID;

  competition_id: UUID;
  user_id: UUID;

  /**
   * 1 = A
   * 2 = B
   * 3 = C
   * 4 = D
   */
  contender_slot: CompetitionContenderSlot;

  source_type: CompetitionSourceType;

  /**
   * Populated when source_type === "active_flow".
   */
  source_flow_session_id: UUID | null;

  /**
   * Populated when source_type === "visit_history".
   */
  source_visit_date: ISODate | null;

  /**
   * Ordered route snapshot.
   *
   * Canonical venue IDs are text.
   */
  venue_ids: VenueId[];

  status: CompetitionEntryStatus;

  submitted_at: ISODateTime;

  approved_at: ISODateTime | null;
  withdrawn_at: ISODateTime | null;
  disqualified_at: ISODateTime | null;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


/**
 * Trusted/admin entry creation payload.
 *
 * Normally created when an approved submission becomes
 * an official contender.
 */
export interface CreateCompetitionEntryInput {
  competition_id: UUID;
  user_id: UUID;

  contender_slot: CompetitionContenderSlot;

  source_type: CompetitionSourceType;

  source_flow_session_id?: UUID | null;
  source_visit_date?: ISODate | null;

  venue_ids: VenueId[];

  status?: CompetitionEntryStatus;

  submitted_at?: ISODateTime;

  approved_at?: ISODateTime | null;
}


// ============================================================
// COMPETITION SUBMISSION
// ============================================================

/**
 * Mirrors public.competition_submissions.
 *
 * A submission is a candidate route awaiting moderation.
 * It is NOT the same thing as an official competition entry.
 */
export interface CompetitionSubmission {
  id: UUID;

  competition_id: UUID;
  user_id: UUID;

  submission_source: CompetitionSubmissionSource;

  /**
   * Active Flow source.
   */
  flow_session_id: UUID | null;

  /**
   * Visit History source.
   */
  visit_date: ISODate | null;

  /**
   * Ordered route snapshot.
   */
  venue_ids: VenueId[];

  route_title: string | null;
  route_city: string | null;

  route_started_at: ISODateTime | null;
  route_completed_at: ISODateTime | null;

  verified_venue_count: number;

  status: CompetitionSubmissionStatus;

  reviewed_by: UUID | null;
  reviewed_at: ISODateTime | null;

  rejection_reason: string | null;

  /**
   * Populated only when an approved submission has been
   * converted into an official competition entry.
   */
  competition_entry_id: UUID | null;

  submitted_at: ISODateTime;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


/**
 * User-facing submission creation payload.
 *
 * Moderation-controlled fields are intentionally absent.
 */
export interface CreateCompetitionSubmissionInput {
  competition_id: UUID;

  submission_source: CompetitionSubmissionSource;

  flow_session_id?: UUID | null;
  visit_date?: ISODate | null;

  venue_ids: VenueId[];

  route_title?: string | null;
  route_city?: string | null;

  route_started_at?: ISODateTime | null;
  route_completed_at?: ISODateTime | null;

  verified_venue_count: number;
}


/**
 * Trusted moderation payload.
 */
export interface ReviewCompetitionSubmissionInput {
  status: Extract<
    CompetitionSubmissionStatus,
    "approved" | "rejected"
  >;

  reviewed_by: UUID;
  reviewed_at?: ISODateTime;

  rejection_reason?: string | null;

  /**
   * Required by the database when the submission becomes
   * linked to the approved competition entry.
   */
  competition_entry_id?: UUID | null;
}


// ============================================================
// COMPETITION FLOW SESSION BRIDGE
// ============================================================

/**
 * Mirrors public.competition_flow_sessions.
 *
 * Bridges a generic Active Flow session into a specific
 * competition contender without contaminating Active Flow
 * with competition-specific state.
 */
export interface CompetitionFlowSession {
  id: UUID;

  competition_id: UUID;
  competition_entry_id: UUID;

  flow_session_id: UUID;

  user_id: UUID;

  created_at: ISODateTime;
}


// ============================================================
// COMPETITION PARTICIPATION
// ============================================================

/**
 * Mirrors public.competition_participations.
 *
 * This is the canonical aggregated competition participation
 * record.
 *
 * Raw venue-level proof remains in Active Flow / visit evidence.
 */
export interface CompetitionParticipation {
  id: UUID;

  competition_id: UUID;
  competition_entry_id: UUID;

  user_id: UUID;

  /**
   * Nullable because participation may eventually be sourced
   * from evidence other than an Active Flow bridge.
   */
  flow_session_id: UUID | null;

  verified_stop_count: number;
  total_stop_count: number;

  /**
   * PostgreSQL generated column:
   *
   * verified_stop_count / total_stop_count
   *
   * Stored on a 0–1 scale.
   */
  completion_ratio: number;

  /**
   * Trusted-server qualification result.
   */
  qualified: boolean;

  started_at: ISODateTime;
  completed_at: ISODateTime | null;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


/**
 * Trusted participation creation payload.
 *
 * completion_ratio is excluded because PostgreSQL generates it.
 */
export interface CreateCompetitionParticipationInput {
  competition_id: UUID;
  competition_entry_id: UUID;

  user_id: UUID;

  flow_session_id?: UUID | null;

  verified_stop_count?: number;
  total_stop_count: number;

  qualified?: boolean;

  started_at?: ISODateTime;
  completed_at?: ISODateTime | null;
}


/**
 * Trusted reconciliation update.
 *
 * Identity/provenance fields are intentionally excluded.
 */
export interface UpdateCompetitionParticipationEvidenceInput {
  verified_stop_count?: number;

  qualified?: boolean;

  completed_at?: ISODateTime | null;
}


// ============================================================
// COMPETITION ENTRY RATING
// ============================================================

/**
 * Mirrors public.competition_entry_ratings.
 *
 * Every rating must be backed by the same user's qualified
 * participation in the same competition entry.
 */
export interface CompetitionEntryRating {
  id: UUID;

  competition_id: UUID;

  /**
   * Named entry_id in the ratings table.
   */
  entry_id: UUID;

  user_id: UUID;
  participation_id: UUID;

  overall_rating: CompetitionOverallRating;

  /**
   * null = unanswered
   */
  would_repeat: boolean | null;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


/**
 * User-facing rating payload.
 *
 * user_id should generally be derived from the authenticated
 * session server-side rather than trusted from arbitrary input.
 */
export interface CreateCompetitionEntryRatingInput {
  competition_id: UUID;
  entry_id: UUID;
  participation_id: UUID;

  overall_rating: CompetitionOverallRating;

  would_repeat?: boolean | null;
}


export interface UpdateCompetitionEntryRatingInput {
  overall_rating?: CompetitionOverallRating;
  would_repeat?: boolean | null;
}


// ============================================================
// HEAD-TO-HEAD PREFERENCE
// ============================================================

/**
 * Mirrors public.competition_head_to_head_preferences.
 *
 * Only valid once the user has qualified participation in at
 * least two distinct competing entries.
 */
export interface CompetitionHeadToHeadPreference {
  id: UUID;

  competition_id: UUID;
  user_id: UUID;

  preferred_entry_id: UUID;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


export interface UpsertCompetitionHeadToHeadPreferenceInput {
  competition_id: UUID;
  preferred_entry_id: UUID;
}


// ============================================================
// SCORE SNAPSHOT
// ============================================================

/**
 * Mirrors public.competition_entry_score_snapshots.
 *
 * Score snapshots are immutable and append-only.
 */
export interface CompetitionEntryScoreSnapshot {
  id: UUID;

  competition_id: UUID;
  entry_id: UUID;

  snapshot_type: CompetitionSnapshotType;

  // ----------------------------------------------------------
  // Participation evidence
  // ----------------------------------------------------------

  participation_count: number;
  completed_participant_count: number;
  qualified_participant_count: number;
  cross_completer_count: number;

  /**
   * 0–1.
   */
  completion_rate: number | null;

  // ----------------------------------------------------------
  // Rating evidence
  // ----------------------------------------------------------

  rating_count: number;

  /**
   * 1–5 when rating_count > 0.
   */
  average_rating: number | null;

  // ----------------------------------------------------------
  // Repeat intent
  // ----------------------------------------------------------

  would_repeat_response_count: number;
  would_repeat_count: number;

  /**
   * 0–1.
   */
  would_repeat_rate: number | null;

  // ----------------------------------------------------------
  // Comparative evidence
  // ----------------------------------------------------------

  head_to_head_preference_count: number;
  head_to_head_eligible_count: number;

  /**
   * 0–1.
   */
  head_to_head_preference_rate: number | null;

  // ----------------------------------------------------------
  // Reserved future metrics
  // ----------------------------------------------------------

  replay_count: number | null;
  replay_rate: number | null;

  save_count: number | null;
  save_rate: number | null;

  // ----------------------------------------------------------
  // Component scores — 0–100
  // ----------------------------------------------------------

  completion_score: number | null;
  experience_score: number | null;
  repeat_score: number | null;
  comparative_score: number | null;

  /**
   * 0–1.
   */
  confidence_score: number;

  /**
   * 0–100.
   */
  final_score: number;

  algorithm_version: string;

  calculated_at: ISODateTime;
  created_at: ISODateTime;
}


/**
 * Trusted scorer insertion payload.
 *
 * Snapshot IDs/timestamps may be database generated.
 */
export interface CreateCompetitionEntryScoreSnapshotInput {
  competition_id: UUID;
  entry_id: UUID;

  snapshot_type?: CompetitionSnapshotType;

  participation_count?: number;
  completed_participant_count?: number;
  qualified_participant_count?: number;
  cross_completer_count?: number;

  completion_rate?: number | null;

  rating_count?: number;
  average_rating?: number | null;

  would_repeat_response_count?: number;
  would_repeat_count?: number;
  would_repeat_rate?: number | null;

  head_to_head_preference_count?: number;
  head_to_head_eligible_count?: number;
  head_to_head_preference_rate?: number | null;

  replay_count?: number | null;
  replay_rate?: number | null;

  save_count?: number | null;
  save_rate?: number | null;

  completion_score?: number | null;
  experience_score?: number | null;
  repeat_score?: number | null;
  comparative_score?: number | null;

  confidence_score?: number;

  final_score: number;

  algorithm_version: string;

  calculated_at?: ISODateTime;
}


// ============================================================
// COMPETITION RESULT
// ============================================================

/**
 * Mirrors public.competition_results.
 *
 * One canonical settlement record exists per competition.
 *
 * Settlement fields are immutable after creation.
 * Only XP delivery state may legitimately change afterward.
 */
export interface CompetitionResult {
  id: UUID;

  competition_id: UUID;

  result_status: SettledCompetitionResultStatus;

  winner_entry_id: UUID | null;

  /**
   * Winner outcomes point to the exact immutable final score
   * snapshot used as settlement evidence.
   *
   * Non-winner outcomes keep this null.
   */
  final_evidence_snapshot_id: UUID | null;

  /**
   * Required for winner/tie/insufficient_evidence.
   * May be null for void.
   */
  algorithm_version: string | null;

  settled_at: ISODateTime;

  /**
   * Nullable for automated settlement.
   */
  settled_by: UUID | null;

  xp_award_status: CompetitionXpAwardStatus;

  xp_awarded_at: ISODateTime | null;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}


// ============================================================
// DISCRIMINATED RESULT CREATION CONTRACTS
// ============================================================

/**
 * Using discriminated unions here prevents impossible settlement
 * combinations from reaching application code.
 */

export interface CreateWinnerCompetitionResultInput {
  competition_id: UUID;

  result_status: "winner";

  winner_entry_id: UUID;
  final_evidence_snapshot_id: UUID;

  algorithm_version: string;

  settled_at?: ISODateTime;
  settled_by?: UUID | null;

  xp_award_status?: Extract<
    CompetitionXpAwardStatus,
    "pending" | "failed"
  >;
}


export interface CreateTieCompetitionResultInput {
  competition_id: UUID;

  result_status: "tie";

  winner_entry_id?: never;
  final_evidence_snapshot_id?: never;

  algorithm_version: string;

  settled_at?: ISODateTime;
  settled_by?: UUID | null;

  xp_award_status?: "not_applicable";
}


export interface CreateInsufficientEvidenceCompetitionResultInput {
  competition_id: UUID;

  result_status: "insufficient_evidence";

  winner_entry_id?: never;
  final_evidence_snapshot_id?: never;

  algorithm_version: string;

  settled_at?: ISODateTime;
  settled_by?: UUID | null;

  xp_award_status?: "not_applicable";
}


export interface CreateVoidCompetitionResultInput {
  competition_id: UUID;

  result_status: "void";

  winner_entry_id?: never;
  final_evidence_snapshot_id?: never;

  algorithm_version?: string | null;

  settled_at?: ISODateTime;
  settled_by?: UUID | null;

  xp_award_status?: "not_applicable";
}


export type CreateCompetitionResultInput =
  | CreateWinnerCompetitionResultInput
  | CreateTieCompetitionResultInput
  | CreateInsufficientEvidenceCompetitionResultInput
  | CreateVoidCompetitionResultInput;


// ============================================================
// XP DELIVERY
// ============================================================

/**
 * Settlement itself is immutable.
 *
 * These are the only result fields expected to change after
 * settlement.
 */
export type UpdateCompetitionResultXpInput =
  | {
      xp_award_status: "awarded";
      xp_awarded_at: ISODateTime;
    }
  | {
      xp_award_status: "failed";
      xp_awarded_at?: null;
    };


// ============================================================
// SANITIZED / PUBLIC COMPETITION CONTRACTS
// ============================================================

/**
 * Public contender representation for anonymous live duels.
 *
 * Intentionally excludes:
 *
 *   user_id
 *   source identity
 *   creator identity
 *
 * Identity reveal can be added by a settlement-specific response.
 */
export interface PublicCompetitionEntry {
  id: UUID;

  competition_id: UUID;
  contender_slot: CompetitionContenderSlot;

  venue_ids: VenueId[];
}


/**
 * Public competition result after settlement.
 */
export interface PublicCompetitionResult {
  competition_id: UUID;

  result_status: SettledCompetitionResultStatus;

  winner_entry_id: UUID | null;

  algorithm_version: string | null;

  settled_at: ISODateTime;
}


// ============================================================
// API RESPONSE SHAPES
// ============================================================

export interface CompetitionWithEntries {
  competition: Competition;
  entries: CompetitionEntry[];
}


export interface PublicCompetitionWithEntries {
  competition: Competition;
  entries: PublicCompetitionEntry[];
}


export interface CompetitionSubmissionWithEntry {
  submission: CompetitionSubmission;
  entry: CompetitionEntry | null;
}


export interface CompetitionParticipationWithRating {
  participation: CompetitionParticipation;
  rating: CompetitionEntryRating | null;
}


export interface CompetitionSettlement {
  competition: Competition;
  result: CompetitionResult;
  winner_entry: CompetitionEntry | null;
  final_evidence_snapshot: CompetitionEntryScoreSnapshot | null;
}


// ============================================================
// TYPE GUARDS
// ============================================================

export function isCompetitionStatus(
  value: string,
): value is CompetitionStatus {
  return (
    COMPETITION_STATUSES as readonly string[]
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


export function isCompetitionOverallRating(
  value: number,
): value is CompetitionOverallRating {
  return (
    Number.isInteger(value)
    && value >= 1
    && value <= 5
  );
}


export function isSettledCompetitionResultStatus(
  value: string,
): value is SettledCompetitionResultStatus {
  return (
    SETTLED_COMPETITION_RESULT_STATUSES as readonly string[]
  ).includes(value);
}


// ============================================================
// CONVENIENCE HELPERS
// ============================================================

export function contenderSlotLabel(
  slot: CompetitionContenderSlot,
): "A" | "B" | "C" | "D" {
  switch (slot) {
    case 1:
      return "A";

    case 2:
      return "B";

    case 3:
      return "C";

    case 4:
      return "D";
  }
}


export function isCompetitionActive(
  competition: Pick<Competition, "status">,
): boolean {
  return (
    competition.status === "live"
    || competition.status === "scoring"
  );
}


export function isCompetitionSettled(
  competition: Pick<
    Competition,
    "result_status"
  >,
): boolean {
  return competition.result_status !== "pending";
}


export function hasCompetitionWinner(
  result: CompetitionResult,
): result is CompetitionResult & {
  result_status: "winner";
  winner_entry_id: UUID;
  final_evidence_snapshot_id: UUID;
  algorithm_version: string;
} {
  return (
    result.result_status === "winner"
    && result.winner_entry_id !== null
    && result.final_evidence_snapshot_id !== null
    && result.algorithm_version !== null
  );
}