// lib/competitions/queries.ts

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COMPETITION_MAX_ENTRIES,
  COMPETITION_STATUS,
  COMPETITION_SUBMISSION_STATUS,
  type CompetitionStatus,
  type CompetitionSubmissionStatus,
} from "./constants";

import type {
  Competition,
  CompetitionEntry,
  CompetitionEntryScoreSnapshot,
  CompetitionParticipation,
  CompetitionResult,
  CompetitionSubmission,
  PublicCompetitionEntry,
  PublicCompetitionResult,
  UUID,
} from "./types";


// ============================================================
// PURPOSE
// ============================================================

/**
 * Shared server-side read helpers for Roam Competitions.
 *
 * Responsibilities:
 *
 *   - public competition lists
 *   - public competition detail
 *   - trusted/admin competition detail
 *   - moderation queue
 *   - competition entries
 *   - competition participation
 *   - competition score snapshots
 *   - competition results
 *
 * SECURITY:
 *
 * This module intentionally distinguishes between:
 *
 *   PUBLIC READ HELPERS
 *
 * and:
 *
 *   TRUSTED / ADMIN READ HELPERS
 *
 * because raw competition entry rows contain user identity.
 *
 * Never expose raw CompetitionEntry rows from anonymous/live
 * competitions through public API responses.
 *
 * The caller remains responsible for supplying the correct
 * Supabase client:
 *
 *   normal authenticated/public server client
 *
 * or:
 *
 *   trusted service-role/admin server client
 *
 * This module never creates a Supabase client itself.
 */


// ============================================================
// SUPABASE TYPE
// ============================================================

/**
 * Keeping the client dependency injectable avoids coupling this
 * module to a specific createClient() implementation.
 *
 * It therefore works with:
 *
 *   - your ordinary server Supabase client
 *   - authenticated request clients
 *   - trusted service-role clients
 */
export type CompetitionSupabaseClient =
  SupabaseClient;


// ============================================================
// QUERY ERROR
// ============================================================

export class CompetitionQueryError extends Error {
  readonly code:
    | "INVALID_ARGUMENT"
    | "NOT_FOUND"
    | "QUERY_FAILED";

  readonly causeMessage: string | null;

  constructor(
    code: CompetitionQueryError["code"],
    message: string,
    causeMessage: string | null = null,
  ) {
    super(message);

    this.name = "CompetitionQueryError";
    this.code = code;
    this.causeMessage = causeMessage;
  }
}


// ============================================================
// PAGINATION
// ============================================================

export const DEFAULT_COMPETITION_PAGE_SIZE = 20;
export const MAX_COMPETITION_PAGE_SIZE = 100;

export interface CompetitionPagination {
  limit?: number;
  offset?: number;
}

interface NormalizedPagination {
  limit: number;
  offset: number;
}


function normalizePagination(
  pagination: CompetitionPagination = {},
): NormalizedPagination {
  const limit =
    pagination.limit
    ?? DEFAULT_COMPETITION_PAGE_SIZE;

  const offset =
    pagination.offset
    ?? 0;

  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_COMPETITION_PAGE_SIZE
  ) {
    throw new CompetitionQueryError(
      "INVALID_ARGUMENT",
      `limit must be an integer between 1 and ${MAX_COMPETITION_PAGE_SIZE}.`,
    );
  }

  if (
    !Number.isSafeInteger(offset)
    || offset < 0
  ) {
    throw new CompetitionQueryError(
      "INVALID_ARGUMENT",
      "offset must be a non-negative integer.",
    );
  }

  return {
    limit,
    offset,
  };
}


// ============================================================
// INPUT ASSERTIONS
// ============================================================

function assertNonBlankId(
  name: string,
  value: string,
): void {
  if (
    typeof value !== "string"
    || value.trim().length === 0
  ) {
    throw new CompetitionQueryError(
      "INVALID_ARGUMENT",
      `${name} is required.`,
    );
  }
}


function cleanOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : undefined;
}


// ============================================================
// CENTRAL SELECTS
// ============================================================

/**
 * Keep table projections centralized.
 *
 * That prevents pages/routes from accidentally adding identity
 * fields to public payloads.
 */

const COMPETITION_SELECT = `
  id,
  competition_type,
  taste_duel_execution_mode,
  title,
  description,
  city,
  category,
  status,
  starts_at,
  ends_at,
  max_entries,
  minimum_qualified_participants,
  winner_entry_id,
  result_status,
  xp_reward,
  anonymous_entries,
  created_by,
  created_at,
  updated_at
`;


const COMPETITION_ENTRY_SELECT = `
  id,
  competition_id,
  user_id,
  contender_slot,
  source_type,
  source_flow_session_id,
  source_visit_date,
  venue_ids,
  status,
  submitted_at,
  approved_at,
  withdrawn_at,
  disqualified_at,
  created_at,
  updated_at
`;


/**
 * Public entry projection.
 *
 * Deliberately excludes:
 *
 *   user_id
 *   source_type
 *   source_flow_session_id
 *   source_visit_date
 *   approval/moderation timestamps
 */
const PUBLIC_COMPETITION_ENTRY_SELECT = `
  id,
  competition_id,
  contender_slot,
  venue_ids
`;


const COMPETITION_SUBMISSION_SELECT = `
  id,
  competition_id,
  user_id,
  submission_source,
  flow_session_id,
  visit_date,
  venue_ids,
  route_title,
  route_city,
  route_started_at,
  route_completed_at,
  verified_venue_count,
  status,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  competition_entry_id,
  submitted_at,
  created_at,
  updated_at
`;


const COMPETITION_PARTICIPATION_SELECT = `
  id,
  competition_id,
  competition_entry_id,
  user_id,
  flow_session_id,
  verified_stop_count,
  total_stop_count,
  completion_ratio,
  qualified,
  started_at,
  completed_at,
  created_at,
  updated_at
`;


/**
 * Canonical shared score-snapshot projection.
 *
 * This table serves both:
 *
 *   taste_duel_v1
 *
 * and:
 *
 *   taste_duel_venue_participation_v1
 *
 * The algorithm_version field determines which algorithm-specific
 * evidence columns are authoritative.
 *
 * Do not reinterpret itinerary-only fields for venue participation.
 */
const COMPETITION_ENTRY_SCORE_SNAPSHOT_SELECT = `
  id,
  competition_id,
  entry_id,
  snapshot_type,

  participation_count,
  completed_participant_count,
  qualified_participant_count,
  cross_completer_count,
  completion_rate,

  rating_count,
  average_rating,

  would_repeat_response_count,
  would_repeat_count,
  would_repeat_rate,

  head_to_head_preference_count,
  head_to_head_eligible_count,
  head_to_head_preference_rate,

  replay_count,
  replay_rate,
  save_count,
  save_rate,

  completion_score,
  experience_score,
  repeat_score,
  comparative_score,

  confidence_score,
  final_score,

  unique_venue_participant_count,
  unique_venue_visitor_count,
  weighted_participation,
  visited_venue_count,
  venue_count,
  venue_breadth_rate,

  participation_confidence,
  rating_confidence,
  depth_confidence,

  algorithm_version,
  calculated_at,
  created_at
`;


const COMPETITION_RESULT_SELECT = `
  id,
  competition_id,
  result_status,
  winner_entry_id,
  final_evidence_snapshot_id,
  algorithm_version,
  settled_at,
  settled_by,
  xp_award_status,
  xp_awarded_at,
  created_at,
  updated_at
`;


// ============================================================
// GENERIC ERROR HELPERS
// ============================================================

function throwQueryFailure(
  operation: string,
  error: {
    message?: string | null;
  } | null,
): never {
  throw new CompetitionQueryError(
    "QUERY_FAILED",
    `Competition query failed: ${operation}.`,
    error?.message ?? null,
  );
}


function throwNotFound(
  entity: string,
  id: string,
): never {
  throw new CompetitionQueryError(
    "NOT_FOUND",
    `${entity} not found: ${id}.`,
  );
}


// ============================================================
// PUBLIC COMPETITION LISTS
// ============================================================

export interface ListPublicCompetitionsOptions
  extends CompetitionPagination {
  status?: Extract<
    CompetitionStatus,
    "scheduled" | "live" | "scoring" | "completed"
  >;

  city?: string;
  category?: string;

  /**
   * Optional exact competition type.
   *
   * V1 currently uses taste_duel.
   */
  competitionType?: string;
}


export interface PublicCompetitionListResult {
  competitions: Competition[];

  limit: number;
  offset: number;

  hasMore: boolean;
}


/**
 * Public competition discovery list.
 *
 * This function intentionally allows only statuses that are part
 * of the public competition lifecycle.
 *
 * Draft/cancelled competitions are never returned here even if a
 * trusted client happens to be passed accidentally.
 */
export async function listPublicCompetitions(
  supabase: CompetitionSupabaseClient,
  options: ListPublicCompetitionsOptions = {},
): Promise<PublicCompetitionListResult> {
  const {
    limit,
    offset,
  } = normalizePagination(options);

  const city =
    cleanOptionalText(options.city);

  const category =
    cleanOptionalText(options.category);

  const competitionType =
    cleanOptionalText(
      options.competitionType,
    );


  let query = supabase
    .from("competitions")
    .select(COMPETITION_SELECT)
    .in(
      "status",
      options.status
        ? [options.status]
        : [
            COMPETITION_STATUS.SCHEDULED,
            COMPETITION_STATUS.LIVE,
            COMPETITION_STATUS.SCORING,
            COMPETITION_STATUS.COMPLETED,
          ],
    )
    .order(
      "starts_at",
      {
        ascending: false,
        nullsFirst: false,
      },
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    /**
     * Fetch one extra row so callers get hasMore without needing
     * a count query on every feed request.
     */
    .range(
      offset,
      offset + limit,
    );


  if (city) {
    query = query.eq(
      "city",
      city,
    );
  }

  if (category) {
    query = query.eq(
      "category",
      category,
    );
  }

  if (competitionType) {
    query = query.eq(
      "competition_type",
      competitionType,
    );
  }


  const {
    data,
    error,
  } = await query;


  if (error) {
    throwQueryFailure(
      "list public competitions",
      error,
    );
  }


  const rows =
    (data ?? []) as Competition[];

  const hasMore =
    rows.length > limit;

  return {
    competitions:
      hasMore
        ? rows.slice(0, limit)
        : rows,

    limit,
    offset,
    hasMore,
  };
}


// ============================================================
// PUBLIC COMPETITION
// ============================================================

/**
 * Returns one publicly visible competition.
 *
 * Even with a service-role client, this helper refuses to expose
 * draft/cancelled competitions through the public code path.
 */
export async function getPublicCompetition(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<Competition | null> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );

  const {
    data,
    error,
  } = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT)
    .eq(
      "id",
      competitionId,
    )
    .in(
      "status",
      [
        COMPETITION_STATUS.SCHEDULED,
        COMPETITION_STATUS.LIVE,
        COMPETITION_STATUS.SCORING,
        COMPETITION_STATUS.COMPLETED,
      ],
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get public competition",
      error,
    );
  }

  return (
    data
      ? data as Competition
      : null
  );
}


/**
 * Required public competition lookup.
 *
 * Use when a route should treat a missing/non-public competition
 * as a 404.
 */
export async function requirePublicCompetition(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<Competition> {
  const competition =
    await getPublicCompetition(
      supabase,
      competitionId,
    );

  if (!competition) {
    throwNotFound(
      "Competition",
      competitionId,
    );
  }

  return competition;
}


// ============================================================
// TRUSTED COMPETITION LOOKUP
// ============================================================

/**
 * Trusted/admin lookup.
 *
 * Unlike getPublicCompetition(), this intentionally allows:
 *
 *   draft
 *   scheduled
 *   live
 *   scoring
 *   completed
 *   cancelled
 *
 * Supply an appropriately privileged Supabase client.
 */
export async function getCompetitionById(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<Competition | null> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );

  const {
    data,
    error,
  } = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT)
    .eq(
      "id",
      competitionId,
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get competition",
      error,
    );
  }

  return (
    data
      ? data as Competition
      : null
  );
}


export async function requireCompetitionById(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<Competition> {
  const competition =
    await getCompetitionById(
      supabase,
      competitionId,
    );

  if (!competition) {
    throwNotFound(
      "Competition",
      competitionId,
    );
  }

  return competition;
}


// ============================================================
// COMPETITION ENTRIES — TRUSTED
// ============================================================

export interface ListCompetitionEntriesOptions {
  status?: CompetitionEntry["status"];
}


/**
 * Identity-bearing entry read.
 *
 * TRUSTED SERVER / ADMIN ONLY.
 *
 * Do not return this result directly from anonymous competition
 * pages.
 */
export async function listCompetitionEntries(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
  options: ListCompetitionEntriesOptions = {},
): Promise<CompetitionEntry[]> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );


  let query = supabase
    .from("competition_entries")
    .select(COMPETITION_ENTRY_SELECT)
    .eq(
      "competition_id",
      competitionId,
    )
    .order(
      "contender_slot",
      {
        ascending: true,
      },
    )
    .limit(
      COMPETITION_MAX_ENTRIES,
    );


  if (options.status) {
    query = query.eq(
      "status",
      options.status,
    );
  }


  const {
    data,
    error,
  } = await query;


  if (error) {
    throwQueryFailure(
      "list competition entries",
      error,
    );
  }

  return (
    data ?? []
  ) as CompetitionEntry[];
}


// ============================================================
// PUBLIC COMPETITION ENTRIES
// ============================================================

/**
 * Sanitized entry read.
 *
 * IMPORTANT:
 *
 * This helper is intended to be called server-side using a
 * trusted client because base competition_entries RLS does not
 * expose contender rows publicly.
 *
 * It strips identity/provenance fields from the returned shape.
 */
export async function listPublicCompetitionEntries(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<PublicCompetitionEntry[]> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );


  const {
    data,
    error,
  } = await supabase
    .from("competition_entries")
    .select(PUBLIC_COMPETITION_ENTRY_SELECT)
    .eq(
      "competition_id",
      competitionId,
    )
    .eq(
      "status",
      "approved",
    )
    .order(
      "contender_slot",
      {
        ascending: true,
      },
    )
    .limit(
      COMPETITION_MAX_ENTRIES,
    );


  if (error) {
    throwQueryFailure(
      "list public competition entries",
      error,
    );
  }


  return (
    data ?? []
  ) as PublicCompetitionEntry[];
}


// ============================================================
// SINGLE ENTRY — TRUSTED
// ============================================================

export async function getCompetitionEntryById(
  supabase: CompetitionSupabaseClient,
  entryId: UUID,
): Promise<CompetitionEntry | null> {
  assertNonBlankId(
    "entryId",
    entryId,
  );


  const {
    data,
    error,
  } = await supabase
    .from("competition_entries")
    .select(COMPETITION_ENTRY_SELECT)
    .eq(
      "id",
      entryId,
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get competition entry",
      error,
    );
  }

  return (
    data
      ? data as CompetitionEntry
      : null
  );
}


// ============================================================
// PUBLIC DETAIL
// ============================================================

export interface PublicCompetitionDetail {
  competition: Competition;

  /**
   * Identity-safe contender rows.
   */
  entries: PublicCompetitionEntry[];

  /**
   * Exists publicly only after the result RLS/public lifecycle
   * allows it.
   */
  result: PublicCompetitionResult | null;
}


/**
 * Public detail page read.
 *
 * Uses sanitized contender rows even after identity-bearing entry
 * rows exist in the underlying database.
 *
 * Creator reveal should be handled explicitly by a future
 * settlement/reveal contract rather than leaking raw entry rows
 * through this helper.
 */
export async function getPublicCompetitionDetail(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<PublicCompetitionDetail | null> {
  const competition =
    await getPublicCompetition(
      supabase,
      competitionId,
    );

  if (!competition) {
    return null;
  }


  const [
    entries,
    result,
  ] = await Promise.all([
    listPublicCompetitionEntries(
      supabase,
      competitionId,
    ),

    competition.status
      === COMPETITION_STATUS.COMPLETED
      ? getPublicCompetitionResult(
          supabase,
          competitionId,
        )
      : Promise.resolve(null),
  ]);


  return {
    competition,
    entries,
    result,
  };
}


// ============================================================
// TRUSTED / ADMIN DETAIL
// ============================================================

export interface CompetitionAdminDetail {
  competition: Competition;
  entries: CompetitionEntry[];
  result: CompetitionResult | null;
}


/**
 * Full trusted competition detail for venue-admin or internal
 * server workflows.
 */
export async function getCompetitionAdminDetail(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<CompetitionAdminDetail | null> {
  const competition =
    await getCompetitionById(
      supabase,
      competitionId,
    );

  if (!competition) {
    return null;
  }


  const [
    entries,
    result,
  ] = await Promise.all([
    listCompetitionEntries(
      supabase,
      competitionId,
    ),

    getCompetitionResult(
      supabase,
      competitionId,
    ),
  ]);


  return {
    competition,
    entries,
    result,
  };
}


// ============================================================
// MODERATION QUEUE
// ============================================================

export interface ListCompetitionSubmissionsOptions
  extends CompetitionPagination {
  competitionId?: UUID;

  status?: CompetitionSubmissionStatus;

  source?: CompetitionSubmission["submission_source"];

  userId?: UUID;

  /**
   * Oldest-first is useful for moderation fairness.
   */
  oldestFirst?: boolean;
}


export interface CompetitionSubmissionPage {
  submissions: CompetitionSubmission[];

  limit: number;
  offset: number;

  hasMore: boolean;
}


/**
 * Trusted/admin moderation queue.
 *
 * This table contains:
 *
 *   user_id
 *   provenance
 *   route evidence
 *   review state
 *
 * so it must not be exposed through a public client.
 */
export async function listCompetitionSubmissionsForModeration(
  supabase: CompetitionSupabaseClient,
  options: ListCompetitionSubmissionsOptions = {},
): Promise<CompetitionSubmissionPage> {
  const {
    limit,
    offset,
  } = normalizePagination(options);


  let query = supabase
    .from("competition_submissions")
    .select(COMPETITION_SUBMISSION_SELECT)
    .order(
      "submitted_at",
      {
        ascending:
          options.oldestFirst
          ?? true,
      },
    )
    .range(
      offset,
      offset + limit,
    );


  if (options.competitionId) {
    assertNonBlankId(
      "competitionId",
      options.competitionId,
    );

    query = query.eq(
      "competition_id",
      options.competitionId,
    );
  }


  if (options.status) {
    query = query.eq(
      "status",
      options.status,
    );
  }


  if (options.source) {
    query = query.eq(
      "submission_source",
      options.source,
    );
  }


  if (options.userId) {
    assertNonBlankId(
      "userId",
      options.userId,
    );

    query = query.eq(
      "user_id",
      options.userId,
    );
  }


  const {
    data,
    error,
  } = await query;


  if (error) {
    throwQueryFailure(
      "list competition moderation submissions",
      error,
    );
  }


  const rows =
    (data ?? []) as CompetitionSubmission[];

  const hasMore =
    rows.length > limit;


  return {
    submissions:
      hasMore
        ? rows.slice(0, limit)
        : rows,

    limit,
    offset,
    hasMore,
  };
}


// ============================================================
// PENDING MODERATION QUEUE CONVENIENCE
// ============================================================

export async function listPendingCompetitionSubmissions(
  supabase: CompetitionSupabaseClient,
  options: Omit<
    ListCompetitionSubmissionsOptions,
    "status"
  > = {},
): Promise<CompetitionSubmissionPage> {
  return listCompetitionSubmissionsForModeration(
    supabase,
    {
      ...options,
      status:
        COMPETITION_SUBMISSION_STATUS.PENDING,
    },
  );
}


// ============================================================
// USER SUBMISSIONS
// ============================================================

export async function listUserCompetitionSubmissions(
  supabase: CompetitionSupabaseClient,
  userId: UUID,
  pagination: CompetitionPagination = {},
): Promise<CompetitionSubmissionPage> {
  assertNonBlankId(
    "userId",
    userId,
  );

  return listCompetitionSubmissionsForModeration(
    supabase,
    {
      ...pagination,
      userId,
      oldestFirst: false,
    },
  );
}


// ============================================================
// PARTICIPATION
// ============================================================

export interface ListCompetitionParticipationsOptions
  extends CompetitionPagination {
  competitionId?: UUID;
  entryId?: UUID;
  userId?: UUID;
  qualified?: boolean;
  completedOnly?: boolean;
}


export interface CompetitionParticipationPage {
  participations: CompetitionParticipation[];

  limit: number;
  offset: number;

  hasMore: boolean;
}


/**
 * Shared trusted participation query.
 *
 * ITINERARY MODE ONLY.
 *
 * Venue-participation evidence is queried through its dedicated
 * evidence adapter and should not be projected into this contract.
 *
 * The caller's Supabase client/RLS determines which rows it may
 * actually read.
 */
export async function listCompetitionParticipations(
  supabase: CompetitionSupabaseClient,
  options: ListCompetitionParticipationsOptions = {},
): Promise<CompetitionParticipationPage> {
  const {
    limit,
    offset,
  } = normalizePagination(options);


  let query = supabase
    .from("competition_participations")
    .select(COMPETITION_PARTICIPATION_SELECT)
    .order(
      "started_at",
      {
        ascending: false,
      },
    )
    .range(
      offset,
      offset + limit,
    );


  if (options.competitionId) {
    assertNonBlankId(
      "competitionId",
      options.competitionId,
    );

    query = query.eq(
      "competition_id",
      options.competitionId,
    );
  }


  if (options.entryId) {
    assertNonBlankId(
      "entryId",
      options.entryId,
    );

    query = query.eq(
      "competition_entry_id",
      options.entryId,
    );
  }


  if (options.userId) {
    assertNonBlankId(
      "userId",
      options.userId,
    );

    query = query.eq(
      "user_id",
      options.userId,
    );
  }


  if (
    options.qualified
    !== undefined
  ) {
    query = query.eq(
      "qualified",
      options.qualified,
    );
  }


  if (options.completedOnly) {
    query = query.not(
      "completed_at",
      "is",
      null,
    );
  }


  const {
    data,
    error,
  } = await query;


  if (error) {
    throwQueryFailure(
      "list competition participations",
      error,
    );
  }


  const rows =
    (data ?? []) as CompetitionParticipation[];

  const hasMore =
    rows.length > limit;


  return {
    participations:
      hasMore
        ? rows.slice(0, limit)
        : rows,

    limit,
    offset,
    hasMore,
  };
}


// ============================================================
// USER PARTICIPATION
// ============================================================

export async function listUserCompetitionParticipations(
  supabase: CompetitionSupabaseClient,
  userId: UUID,
  pagination: CompetitionPagination = {},
): Promise<CompetitionParticipationPage> {
  assertNonBlankId(
    "userId",
    userId,
  );

  return listCompetitionParticipations(
    supabase,
    {
      ...pagination,
      userId,
    },
  );
}


// ============================================================
// PARTICIPATION BY ENTRY + USER
// ============================================================

/**
 * Finds the canonical participation for a user on a specific
 * contender.
 *
 * competition_participations has a unique
 * (competition_entry_id, user_id) invariant.
 *
 * ITINERARY MODE ONLY.
 */
export async function getCompetitionParticipationForEntry(
  supabase: CompetitionSupabaseClient,
  entryId: UUID,
  userId: UUID,
): Promise<CompetitionParticipation | null> {
  assertNonBlankId(
    "entryId",
    entryId,
  );

  assertNonBlankId(
    "userId",
    userId,
  );


  const {
    data,
    error,
  } = await supabase
    .from("competition_participations")
    .select(COMPETITION_PARTICIPATION_SELECT)
    .eq(
      "competition_entry_id",
      entryId,
    )
    .eq(
      "user_id",
      userId,
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get competition participation for entry",
      error,
    );
  }

  return (
    data
      ? data as CompetitionParticipation
      : null
  );
}


// ============================================================
// PARTICIPATION BY ID
// ============================================================

export async function getCompetitionParticipationById(
  supabase: CompetitionSupabaseClient,
  participationId: UUID,
): Promise<CompetitionParticipation | null> {
  assertNonBlankId(
    "participationId",
    participationId,
  );


  const {
    data,
    error,
  } = await supabase
    .from("competition_participations")
    .select(COMPETITION_PARTICIPATION_SELECT)
    .eq(
      "id",
      participationId,
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get competition participation",
      error,
    );
  }

  return (
    data
      ? data as CompetitionParticipation
      : null
  );
}


// ============================================================
// SCORE SNAPSHOTS — TRUSTED
// ============================================================

/**
 * Canonical immutable score-snapshot lookup.
 *
 * The returned algorithm_version determines which fields are
 * authoritative.
 *
 * taste_duel_v1:
 *
 *   itinerary participation/completion/repeat/comparative fields
 *   retain their existing semantics.
 *
 * taste_duel_venue_participation_v1:
 *
 *   venue-participation-specific evidence and confidence fields
 *   are authoritative.
 *
 * Never infer venue-participation meaning from itinerary-only
 * snapshot columns.
 */
export async function getCompetitionEntryScoreSnapshotById(
  supabase: CompetitionSupabaseClient,
  snapshotId: UUID,
): Promise<CompetitionEntryScoreSnapshot | null> {
  assertNonBlankId(
    "snapshotId",
    snapshotId,
  );


  const {
    data,
    error,
  } = await supabase
    .from(
      "competition_entry_score_snapshots",
    )
    .select(
      COMPETITION_ENTRY_SCORE_SNAPSHOT_SELECT,
    )
    .eq(
      "id",
      snapshotId,
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get competition entry score snapshot",
      error,
    );
  }


  return (
    data
      ? data as CompetitionEntryScoreSnapshot
      : null
  );
}


// ============================================================
// FINAL WINNER EVIDENCE SNAPSHOT
// ============================================================

/**
 * Resolves the exact immutable score snapshot referenced by a
 * winner result.
 *
 * Tie / insufficient-evidence / void results have no singular
 * final_evidence_snapshot_id and therefore return null.
 *
 * The database foreign key already binds:
 *
 *   competition_id
 *   winner_entry_id
 *   final_evidence_snapshot_id
 *
 * to the same immutable snapshot row.
 *
 * This helper additionally checks competition_id defensively so
 * callers cannot accidentally combine a result and snapshot from
 * different competitions.
 */
export async function getCompetitionFinalEvidenceSnapshot(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<CompetitionEntryScoreSnapshot | null> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );


  const result =
    await getCompetitionResult(
      supabase,
      competitionId,
    );


  if (
    !result
    || result.result_status !==
      "winner"
    || !result.final_evidence_snapshot_id
  ) {
    return null;
  }


  const snapshot =
    await getCompetitionEntryScoreSnapshotById(
      supabase,
      result.final_evidence_snapshot_id,
    );


  if (!snapshot) {
    throw new CompetitionQueryError(
      "QUERY_FAILED",
      "Competition winner references a missing final evidence snapshot.",
    );
  }


  if (
    snapshot.competition_id !==
      competitionId
  ) {
    throw new CompetitionQueryError(
      "QUERY_FAILED",
      "Competition final evidence snapshot belongs to a different competition.",
    );
  }


  if (
    snapshot.entry_id !==
      result.winner_entry_id
  ) {
    throw new CompetitionQueryError(
      "QUERY_FAILED",
      "Competition final evidence snapshot does not belong to the winner entry.",
    );
  }


  if (
    snapshot.algorithm_version !==
      result.algorithm_version
  ) {
    throw new CompetitionQueryError(
      "QUERY_FAILED",
      "Competition final evidence snapshot algorithm does not match the settlement result.",
    );
  }


  return snapshot;
}


// ============================================================
// COMPETITION RESULTS — TRUSTED
// ============================================================

/**
 * Canonical result lookup.
 *
 * One result exists per competition.
 */
export async function getCompetitionResult(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<CompetitionResult | null> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );


  const {
    data,
    error,
  } = await supabase
    .from("competition_results")
    .select(COMPETITION_RESULT_SELECT)
    .eq(
      "competition_id",
      competitionId,
    )
    .maybeSingle();


  if (error) {
    throwQueryFailure(
      "get competition result",
      error,
    );
  }

  return (
    data
      ? data as CompetitionResult
      : null
  );
}


// ============================================================
// PUBLIC RESULT
// ============================================================

/**
 * Public result contract.
 *
 * The database RLS already restricts competition_results public
 * access to completed competitions, but this helper additionally
 * verifies parent competition status so a service-role client
 * cannot accidentally bypass the intended public lifecycle.
 */
export async function getPublicCompetitionResult(
  supabase: CompetitionSupabaseClient,
  competitionId: UUID,
): Promise<PublicCompetitionResult | null> {
  assertNonBlankId(
    "competitionId",
    competitionId,
  );


  const competition =
    await getPublicCompetition(
      supabase,
      competitionId,
    );


  if (
    !competition
    || competition.status
      !== COMPETITION_STATUS.COMPLETED
  ) {
    return null;
  }


  const result =
    await getCompetitionResult(
      supabase,
      competitionId,
    );


  if (!result) {
    return null;
  }


  return {
    competition_id:
      result.competition_id,

    result_status:
      result.result_status,

    winner_entry_id:
      result.winner_entry_id,

    algorithm_version:
      result.algorithm_version,

    settled_at:
      result.settled_at,
  };
}


// ============================================================
// RESULT HISTORY / ADMIN LIST
// ============================================================

export interface ListCompetitionResultsOptions
  extends CompetitionPagination {
  resultStatus?: CompetitionResult["result_status"];

  xpAwardStatus?: CompetitionResult["xp_award_status"];
}


export interface CompetitionResultPage {
  results: CompetitionResult[];

  limit: number;
  offset: number;

  hasMore: boolean;
}


/**
 * Trusted result list for admin/operations.
 */
export async function listCompetitionResults(
  supabase: CompetitionSupabaseClient,
  options: ListCompetitionResultsOptions = {},
): Promise<CompetitionResultPage> {
  const {
    limit,
    offset,
  } = normalizePagination(options);


  let query = supabase
    .from("competition_results")
    .select(COMPETITION_RESULT_SELECT)
    .order(
      "settled_at",
      {
        ascending: false,
      },
    )
    .range(
      offset,
      offset + limit,
    );


  if (options.resultStatus) {
    query = query.eq(
      "result_status",
      options.resultStatus,
    );
  }


  if (options.xpAwardStatus) {
    query = query.eq(
      "xp_award_status",
      options.xpAwardStatus,
    );
  }


  const {
    data,
    error,
  } = await query;


  if (error) {
    throwQueryFailure(
      "list competition results",
      error,
    );
  }


  const rows =
    (data ?? []) as CompetitionResult[];

  const hasMore =
    rows.length > limit;


  return {
    results:
      hasMore
        ? rows.slice(0, limit)
        : rows,

    limit,
    offset,
    hasMore,
  };
}


// ============================================================
// PENDING / FAILED XP RESULTS
// ============================================================

/**
 * Operational helper for the XP delivery worker.
 *
 * Call with a trusted service-role client.
 */
export async function listCompetitionResultsNeedingXpAward(
  supabase: CompetitionSupabaseClient,
  limit = 50,
): Promise<CompetitionResult[]> {
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_COMPETITION_PAGE_SIZE
  ) {
    throw new CompetitionQueryError(
      "INVALID_ARGUMENT",
      `limit must be an integer between 1 and ${MAX_COMPETITION_PAGE_SIZE}.`,
    );
  }


  const {
    data,
    error,
  } = await supabase
    .from("competition_results")
    .select(COMPETITION_RESULT_SELECT)
    .eq(
      "result_status",
      "winner",
    )
    .in(
      "xp_award_status",
      [
        "pending",
        "failed",
      ],
    )
    .order(
      "settled_at",
      {
        ascending: true,
      },
    )
    .limit(limit);


  if (error) {
    throwQueryFailure(
      "list competition results needing XP award",
      error,
    );
  }


  return (
    data ?? []
  ) as CompetitionResult[];
}