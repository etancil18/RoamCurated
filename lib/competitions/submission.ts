// lib/competitions/submission.ts

import 'server-only'

import type {
  SupabaseClient,
} from '@supabase/supabase-js'

import {
  COMPETITION_MIN_ROUTE_STOPS,
  COMPETITION_SOURCE_TYPE,
  type CompetitionSourceType,
} from './constants'

import type {
  ISODate,
  ISODateTime,
  UUID,
  VenueId,
} from './types'


// ============================================================
// PURPOSE
// ============================================================

/**
 * Canonical server-side competition submission validation.
 *
 * BOTH supported sources flow through this module:
 *
 *   - completed Active Flow
 *   - Visit History day
 *
 * Shared eligibility rule:
 *
 *   1. source belongs to authenticated user
 *   2. evidence is canonical persisted server data
 *   3. only geo_verified === true visits/check-ins count
 *   4. route contains distinct venues
 *   5. route preserves canonical visit order
 *   6. route contains at least COMPETITION_MIN_ROUTE_STOPS
 *
 * IMPORTANT:
 *
 * This module does NOT:
 *
 *   - create competition_submissions rows
 *   - decide which competition receives the submission
 *   - trust client-supplied venue IDs
 *   - trust client-supplied verified counts
 *   - perform admin moderation
 *   - promote submissions into competition_entries
 *
 * Callers provide only the canonical source identifier.
 */


// ============================================================
// CLIENT
// ============================================================

export type CompetitionSubmissionSupabaseClient =
  SupabaseClient;


// ============================================================
// SOURCE INPUTS
// ============================================================

export interface ActiveFlowCompetitionSubmissionSource {
  submissionSource:
    typeof COMPETITION_SOURCE_TYPE.ACTIVE_FLOW;

  flowSessionId:
    UUID;
}


export interface VisitHistoryCompetitionSubmissionSource {
  submissionSource:
    typeof COMPETITION_SOURCE_TYPE.VISIT_HISTORY;

  visitDate:
    ISODate;
}


export type CompetitionSubmissionSourceInput =
  | ActiveFlowCompetitionSubmissionSource
  | VisitHistoryCompetitionSubmissionSource;


// ============================================================
// CANONICAL RESULT
// ============================================================

export interface ValidatedCompetitionSubmissionRoute {
  userId: UUID;

  submissionSource:
    CompetitionSourceType;

  flowSessionId:
    UUID | null;

  visitDate:
    ISODate | null;

  /**
   * Ordered, distinct, canonically verified venue IDs.
   */
  venueIds:
    VenueId[];

  routeTitle:
    string | null;

  routeCity:
    string | null;

  routeStartedAt:
    ISODateTime | null;

  routeCompletedAt:
    ISODateTime | null;

  verifiedVenueCount:
    number;

  totalVenueCount:
    number;
}


// ============================================================
// DB ROW TYPES
// ============================================================

type ActiveFlowSessionRow = {
  id: string;
  user_id: string;

  title: string | null;
  city: string | null;

  venue_ids: string[];

  status: string;

  started_at: string;
  completed_at: string | null;

  completed_stops: number;
};


type ActiveFlowProgressRow = {
  venue_id: string;

  stop_index: number;

  checked_in_at: string;

  geo_verified: boolean;

  check_in_source: string;
};


type VenueVisitRow = {
  id: string;

  user_id: string;

  venue_id: string;

  visited_at: string;

  visit_date: string | null;

  geo_verified: boolean;

  check_in_source: string;
};


// ============================================================
// ERROR
// ============================================================

export type CompetitionSubmissionValidationErrorCode =
  | 'INVALID_USER_ID'
  | 'INVALID_SOURCE'
  | 'INVALID_FLOW_SESSION_ID'
  | 'INVALID_VISIT_DATE'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_NOT_COMPLETED'
  | 'SOURCE_OWNERSHIP_FAILED'
  | 'INSUFFICIENT_VERIFIED_STOPS'
  | 'INCOMPLETE_ACTIVE_FLOW_EVIDENCE'
  | 'SOURCE_QUERY_FAILED';


export class CompetitionSubmissionValidationError
  extends Error {
  readonly code:
    CompetitionSubmissionValidationErrorCode;

  readonly status:
    400 | 403 | 404 | 409 | 500;

  readonly details:
    Record<string, unknown> | null;

  constructor({
    code,
    message,
    status,
    details = null,
  }: {
    code:
      CompetitionSubmissionValidationErrorCode;

    message:
      string;

    status:
      400 | 403 | 404 | 409 | 500;

    details?:
      Record<string, unknown> | null;
  }) {
    super(
      message,
    );

    this.name =
      'CompetitionSubmissionValidationError';

    this.code =
      code;

    this.status =
      status;

    this.details =
      details;
  }
}


// ============================================================
// INPUT VALIDATION
// ============================================================

function isUuid(
  value: unknown,
): value is UUID {
  return (
    typeof value === 'string'
    &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}


export function isCompetitionSubmissionDate(
  value: unknown,
): value is ISODate {
  if (
    typeof value !== 'string'
    ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return false;
  }

  return (
    parsed
      .toISOString()
      .slice(0, 10)
    === value
  );
}


function assertUserId(
  userId: string,
): asserts userId is UUID {
  if (
    !isUuid(
      userId,
    )
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'INVALID_USER_ID',

      message:
        'Invalid authenticated user ID.',

      status:
        400,
    });
  }
}


// ============================================================
// SHARED VERIFICATION RULE
// ============================================================

/**
 * Canonical v1 competition evidence rule.
 *
 * Both Active Flow and Visit History use the SAME rule:
 *
 *   geo_verified === true
 *
 * check_in_source is intentionally NOT sufficient by itself.
 *
 * This prevents:
 *
 *   - manual check-ins
 *   - malformed source values
 *   - non-geographically verified records
 *
 * from becoming competition evidence.
 *
 * If Roam later decides QR or admin_override should independently
 * count as verified competition evidence, introduce an explicit
 * versioned rule rather than changing this silently.
 */
export function isVerifiedCompetitionVisit({
  geoVerified,
}: {
  geoVerified:
    boolean;
  checkInSource?:
    string | null;
}): boolean {
  return (
    geoVerified === true
  );
}


// ============================================================
// ROUTE HELPERS
// ============================================================

function dedupePreservingOrder(
  venueIds:
    readonly string[],
): VenueId[] {
  const seen =
    new Set<string>();

  const result:
    VenueId[] = [];

  for (
    const venueId
    of venueIds
  ) {
    if (
      typeof venueId !== 'string'
      ||
      venueId.length === 0
      ||
      seen.has(
        venueId,
      )
    ) {
      continue;
    }

    seen.add(
      venueId,
    );

    result.push(
      venueId,
    );
  }

  return result;
}


function assertMinimumVerifiedStops({
  venueIds,
  source,
}: {
  venueIds:
    readonly VenueId[];

  source:
    CompetitionSourceType;
}): void {
  if (
    venueIds.length
    < COMPETITION_MIN_ROUTE_STOPS
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'INSUFFICIENT_VERIFIED_STOPS',

      message:
        `Competition routes require at least ${COMPETITION_MIN_ROUTE_STOPS} distinct verified venues.`,

      status:
        409,

      details: {
        source,

        verifiedVenueCount:
          venueIds.length,

        requiredVerifiedVenueCount:
          COMPETITION_MIN_ROUTE_STOPS,
      },
    });
  }
}


// ============================================================
// ACTIVE FLOW
// ============================================================

async function validateActiveFlowSubmissionSource({
  supabase,
  userId,
  flowSessionId,
}: {
  supabase:
    CompetitionSubmissionSupabaseClient;

  userId:
    UUID;

  flowSessionId:
    UUID;
}): Promise<ValidatedCompetitionSubmissionRoute> {
  const {
    data: sessionData,
    error: sessionError,
  } =
    await supabase
      .from(
        'active_flow_sessions',
      )
      .select(
        `
          id,
          user_id,
          title,
          city,
          venue_ids,
          status,
          started_at,
          completed_at,
          completed_stops
        `,
      )
      .eq(
        'id',
        flowSessionId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();


  if (
    sessionError
  ) {
    console.error(
      '[competitions/submission] Active Flow source query failed:',
      {
        userId,
        flowSessionId,
        error:
          sessionError,
      },
    );

    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_QUERY_FAILED',

      message:
        'Could not validate Active Flow.',

      status:
        500,
    });
  }


  if (
    !sessionData
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_NOT_FOUND',

      message:
        'Active Flow not found.',

      status:
        404,
    });
  }


  const session =
    sessionData as
      ActiveFlowSessionRow;


  if (
    session.user_id
    !== userId
  ) {
    /**
     * Normally unreachable because user_id is included in the DB
     * filter, but preserved as a defense-in-depth invariant.
     */
    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_OWNERSHIP_FAILED',

      message:
        'Active Flow does not belong to this user.',

      status:
        403,
    });
  }


  if (
    session.status
      !== 'completed'
    ||
    !session.completed_at
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_NOT_COMPLETED',

      message:
        'Only completed Active Flows can be submitted to a competition.',

      status:
        409,
    });
  }


  const canonicalRouteVenueIds =
    dedupePreservingOrder(
      Array.isArray(
        session.venue_ids,
      )
        ? session.venue_ids
        : [],
    );


  if (
    canonicalRouteVenueIds.length
    < COMPETITION_MIN_ROUTE_STOPS
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'INSUFFICIENT_VERIFIED_STOPS',

      message:
        `Competition routes require at least ${COMPETITION_MIN_ROUTE_STOPS} distinct venues.`,

      status:
        409,

      details: {
        submissionSource:
          COMPETITION_SOURCE_TYPE.ACTIVE_FLOW,

        routeVenueCount:
          canonicalRouteVenueIds.length,

        requiredVenueCount:
          COMPETITION_MIN_ROUTE_STOPS,
      },
    });
  }


  // ----------------------------------------------------------
  // CANONICAL VERIFIED PROGRESS
  // ----------------------------------------------------------

  const {
    data: progressData,
    error: progressError,
  } =
    await supabase
      .from(
        'active_flow_progress',
      )
      .select(
        `
          venue_id,
          stop_index,
          checked_in_at,
          geo_verified,
          check_in_source
        `,
      )
      .eq(
        'session_id',
        flowSessionId,
      )
      .eq(
        'user_id',
        userId,
      )
      .order(
        'stop_index',
        {
          ascending:
            true,
        },
      )
      .order(
        'checked_in_at',
        {
          ascending:
            true,
        },
      );


  if (
    progressError
  ) {
    console.error(
      '[competitions/submission] Active Flow progress query failed:',
      {
        userId,
        flowSessionId,
        error:
          progressError,
      },
    );

    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_QUERY_FAILED',

      message:
        'Could not validate Active Flow check-ins.',

      status:
        500,
    });
  }


  const routeVenueSet =
    new Set(
      canonicalRouteVenueIds,
    );


  const verifiedVenueSet =
    new Set<string>();


  for (
    const rawRow
    of (
      progressData
      ?? []
    )
  ) {
    const row =
      rawRow as
        ActiveFlowProgressRow;


    if (
      !routeVenueSet.has(
        row.venue_id,
      )
    ) {
      continue;
    }


    if (
      !isVerifiedCompetitionVisit({
        geoVerified:
          row.geo_verified,

        checkInSource:
          row.check_in_source,
      })
    ) {
      continue;
    }


    verifiedVenueSet.add(
      row.venue_id,
    );
  }


  /**
   * Preserve Active Flow route order.
   *
   * Progress row ordering should not become a second source of
   * route truth.
   */
  const verifiedVenueIds =
    canonicalRouteVenueIds
      .filter(
        (
          venueId,
        ) =>
          verifiedVenueSet.has(
            venueId,
          ),
      );


  assertMinimumVerifiedStops({
    venueIds:
      verifiedVenueIds,

    source:
      COMPETITION_SOURCE_TYPE.ACTIVE_FLOW,
  });


  /**
   * A completed Active Flow may technically contain >=3 verified
   * venues while also containing unverified route stops.
   *
   * For competition submission v1, require the route snapshot
   * itself to be fully verified.
   *
   * This keeps an Active Flow submission equivalent to a Visit
   * History route built entirely from verified visits.
   */
  if (
    verifiedVenueIds.length
    !== canonicalRouteVenueIds.length
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'INCOMPLETE_ACTIVE_FLOW_EVIDENCE',

      message:
        'Every Active Flow stop must be verified before the route can be submitted to a competition.',

      status:
        409,

      details: {
        routeVenueCount:
          canonicalRouteVenueIds.length,

        verifiedVenueCount:
          verifiedVenueIds.length,
      },
    });
  }


  return {
    userId,

    submissionSource:
      COMPETITION_SOURCE_TYPE.ACTIVE_FLOW,

    flowSessionId,

    visitDate:
      null,

    venueIds:
      verifiedVenueIds,

    routeTitle:
      session.title
      ?? null,

    routeCity:
      session.city
      ?? null,

    routeStartedAt:
      session.started_at
      ?? null,

    routeCompletedAt:
      session.completed_at,

    verifiedVenueCount:
      verifiedVenueIds.length,

    totalVenueCount:
      verifiedVenueIds.length,
  };
}


// ============================================================
// VISIT HISTORY
// ============================================================

async function validateVisitHistorySubmissionSource({
  supabase,
  userId,
  visitDate,
}: {
  supabase:
    CompetitionSubmissionSupabaseClient;

  userId:
    UUID;

  visitDate:
    ISODate;
}): Promise<ValidatedCompetitionSubmissionRoute> {
  const {
    data: visitData,
    error: visitError,
  } =
    await supabase
      .from(
        'venue_visits',
      )
      .select(
        `
          id,
          user_id,
          venue_id,
          visited_at,
          visit_date,
          geo_verified,
          check_in_source
        `,
      )
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'visit_date',
        visitDate,
      )
      .order(
        'visited_at',
        {
          ascending:
            true,
        },
      )
      .order(
        'created_at',
        {
          ascending:
            true,
        },
      );


  if (
    visitError
  ) {
    console.error(
      '[competitions/submission] Visit History source query failed:',
      {
        userId,
        visitDate,
        error:
          visitError,
      },
    );

    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_QUERY_FAILED',

      message:
        'Could not validate Visit History route.',

      status:
        500,
    });
  }


  const visits =
    (
      visitData
      ?? []
    ) as
      VenueVisitRow[];


  if (
    visits.length === 0
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'SOURCE_NOT_FOUND',

      message:
        'Visit History day not found.',

      status:
        404,
    });
  }


  // ----------------------------------------------------------
  // VERIFIED VISITS ONLY
  // ----------------------------------------------------------

  const verifiedVisits =
    visits.filter(
      (
        visit,
      ) => {
        if (
          visit.user_id
          !== userId
        ) {
          return false;
        }

        if (
          visit.visit_date
          !== visitDate
        ) {
          return false;
        }

        return (
          isVerifiedCompetitionVisit({
            geoVerified:
              visit.geo_verified,

            checkInSource:
              visit.check_in_source,
          })
        );
      },
    );


  /**
   * Rows were already sorted by visited_at.
   *
   * Deduping now preserves the user's actual route chronology.
   */
  const verifiedVenueIds =
    dedupePreservingOrder(
      verifiedVisits.map(
        (
          visit,
        ) =>
          String(
            visit.venue_id,
          ),
      ),
    );


  assertMinimumVerifiedStops({
    venueIds:
      verifiedVenueIds,

    source:
      COMPETITION_SOURCE_TYPE.VISIT_HISTORY,
  });


  // ----------------------------------------------------------
  // TIMESTAMPS
  // ----------------------------------------------------------

  const firstVerifiedVisit =
    verifiedVisits.find(
      (
        visit,
      ) =>
        verifiedVenueIds.includes(
          String(
            visit.venue_id,
          ),
        ),
    )
    ?? null;


  let lastVerifiedVisit:
    VenueVisitRow | null =
      null;


  for (
    let index =
      verifiedVisits.length - 1;
    index >= 0;
    index -= 1
  ) {
    const visit =
      verifiedVisits[index];


    if (
      verifiedVenueIds.includes(
        String(
          visit.venue_id,
        ),
      )
    ) {
      lastVerifiedVisit =
        visit;

      break;
    }
  }


  return {
    userId,

    submissionSource:
      COMPETITION_SOURCE_TYPE.VISIT_HISTORY,

    flowSessionId:
      null,

    visitDate,

    venueIds:
      verifiedVenueIds,

    /**
     * venue_visits has no canonical route title.
     */
    routeTitle:
      null,

    /**
     * venue_visits also does not contain city directly.
     *
     * The submission route/API may use the competition's city as
     * presentation fallback, but should not fabricate canonical
     * route provenance here.
     */
    routeCity:
      null,

    routeStartedAt:
      firstVerifiedVisit
        ?.visited_at
      ?? null,

    routeCompletedAt:
      lastVerifiedVisit
        ?.visited_at
      ?? null,

    verifiedVenueCount:
      verifiedVenueIds.length,

    totalVenueCount:
      verifiedVenueIds.length,
  };
}


// ============================================================
// PRIMARY VALIDATOR
// ============================================================

/**
 * Canonical competition submission-source validator.
 *
 * Route handlers should use this rather than querying
 * active_flow_sessions / active_flow_progress / venue_visits
 * independently.
 */
export async function validateCompetitionSubmissionSource({
  supabase,
  userId,
  source,
}: {
  supabase:
    CompetitionSubmissionSupabaseClient;

  userId:
    UUID;

  source:
    CompetitionSubmissionSourceInput;
}): Promise<ValidatedCompetitionSubmissionRoute> {
  assertUserId(
    userId,
  );


  switch (
    source.submissionSource
  ) {
    case COMPETITION_SOURCE_TYPE.ACTIVE_FLOW: {
      if (
        !isUuid(
          source.flowSessionId,
        )
      ) {
        throw new CompetitionSubmissionValidationError({
          code:
            'INVALID_FLOW_SESSION_ID',

          message:
            'Invalid Active Flow session ID.',

          status:
            400,
        });
      }


      return (
        validateActiveFlowSubmissionSource({
          supabase,

          userId,

          flowSessionId:
            source.flowSessionId,
        })
      );
    }


    case COMPETITION_SOURCE_TYPE.VISIT_HISTORY: {
      if (
        !isCompetitionSubmissionDate(
          source.visitDate,
        )
      ) {
        throw new CompetitionSubmissionValidationError({
          code:
            'INVALID_VISIT_DATE',

          message:
            'Invalid Visit History date. Expected YYYY-MM-DD.',

          status:
            400,
        });
      }


      return (
        validateVisitHistorySubmissionSource({
          supabase,

          userId,

          visitDate:
            source.visitDate,
        })
      );
    }


    default: {
      const exhaustive:
        never =
          source;

      throw new CompetitionSubmissionValidationError({
        code:
          'INVALID_SOURCE',

        message:
          `Unsupported competition submission source: ${String(
            exhaustive,
          )}`,

        status:
          400,
      });
    }
  }
}


// ============================================================
// REQUEST-BODY PARSER
// ============================================================

/**
 * Converts an untrusted API request body into the small canonical
 * source contract this validation layer accepts.
 *
 * The browser is never permitted to supply:
 *
 *   venueIds
 *   verifiedVenueCount
 *   routeTitle
 *   routeCity
 *   routeStartedAt
 *   routeCompletedAt
 */
export function parseCompetitionSubmissionSource(
  value:
    unknown,
): CompetitionSubmissionSourceInput {
  if (
    !value
    ||
    typeof value !== 'object'
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'INVALID_SOURCE',

      message:
        'Invalid competition submission request.',

      status:
        400,
    });
  }


  const body =
    value as
      Record<
        string,
        unknown
      >;


  const submissionSource =
    body.submission_source;


  if (
    submissionSource
    === COMPETITION_SOURCE_TYPE.ACTIVE_FLOW
  ) {
    if (
      !isUuid(
        body.flow_session_id,
      )
    ) {
      throw new CompetitionSubmissionValidationError({
        code:
          'INVALID_FLOW_SESSION_ID',

        message:
          'Invalid or missing flow_session_id.',

        status:
          400,
      });
    }


    return {
      submissionSource:
        COMPETITION_SOURCE_TYPE.ACTIVE_FLOW,

      flowSessionId:
        body.flow_session_id,
    };
  }


  if (
    submissionSource
    === COMPETITION_SOURCE_TYPE.VISIT_HISTORY
  ) {
    if (
      !isCompetitionSubmissionDate(
        body.visit_date,
      )
    ) {
      throw new CompetitionSubmissionValidationError({
        code:
          'INVALID_VISIT_DATE',

        message:
          'Invalid or missing visit_date. Expected YYYY-MM-DD.',

        status:
          400,
      });
    }


    return {
      submissionSource:
        COMPETITION_SOURCE_TYPE.VISIT_HISTORY,

      visitDate:
        body.visit_date,
    };
  }


  throw new CompetitionSubmissionValidationError({
    code:
      'INVALID_SOURCE',

    message:
      'submission_source must be active_flow or visit_history.',

    status:
      400,
  });
}


// ============================================================
// DATABASE INSERT MAPPER
// ============================================================

/**
 * Converts validated evidence into the canonical immutable
 * competition_submissions route snapshot.
 *
 * competitionId remains outside source validation because source
 * evidence and competition lifecycle are separate concerns.
 */
export function toCompetitionSubmissionInsert({
  competitionId,
  route,
  routeCityFallback = null,
}: {
  competitionId:
    UUID;

  route:
    ValidatedCompetitionSubmissionRoute;

  /**
   * Visit History currently has no city stored directly on
   * venue_visits, so the route handler may use competition.city
   * purely as snapshot presentation metadata.
   */
  routeCityFallback?:
    string | null;
}) {
  if (
    !isUuid(
      competitionId,
    )
  ) {
    throw new CompetitionSubmissionValidationError({
      code:
        'INVALID_SOURCE',

      message:
        'Invalid competition ID.',

      status:
        400,
    });
  }


  return {
    competition_id:
      competitionId,

    user_id:
      route.userId,

    submission_source:
      route.submissionSource,

    flow_session_id:
      route.flowSessionId,

    visit_date:
      route.visitDate,

    venue_ids:
      [...route.venueIds],

    route_title:
      route.routeTitle,

    route_city:
      route.routeCity
      ?? routeCityFallback,

    route_started_at:
      route.routeStartedAt,

    route_completed_at:
      route.routeCompletedAt,

    verified_venue_count:
      route.verifiedVenueCount,

    status:
      'pending' as const,

    reviewed_by:
      null,

    reviewed_at:
      null,

    rejection_reason:
      null,

    competition_entry_id:
      null,
  };
}


// ============================================================
// ERROR GUARD
// ============================================================

export function isCompetitionSubmissionValidationError(
  error:
    unknown,
): error is CompetitionSubmissionValidationError {
  return (
    error
    instanceof
      CompetitionSubmissionValidationError
  );
}