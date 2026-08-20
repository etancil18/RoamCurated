// app/api/relay/leg/start/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  startRelaySlotFlow,
} from '@/lib/relay/actions'

import type {
  RelayTeamSlotId,
  VenueId,
} from '@/lib/relay/types'

import {
  createServerClient,
} from '@/lib/supabase/server'


export const dynamic =
  'force-dynamic'

export const revalidate =
  0


/* ============================================================
 * TYPES
 * ============================================================
 */

type StartRelayLegRequest = {
  team_slot_id:
    string

  venue_id:
    string
}


type StartRelayLegSuccessResponse = {
  ok:
    true

  team: {
    id:
      string

    relayId:
      string

    status:
      string
  }

  flow: {
    sessionId:
      string

    source:
      'roam_relay_team_slot'

    sourceId:
      string
  }
}


type StartRelayLegErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'start_rejected'
  | 'flow_state_invalid'


type StartRelayLegErrorResponse = {
  ok:
    false

  error: {
    code:
      StartRelayLegErrorCode

    message:
      string
  }
}


/* ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request:
    Request
): Promise<
  NextResponse<
    | StartRelayLegSuccessResponse
    | StartRelayLegErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * startRelaySlotFlow() authenticates internally as well.
   *
   * The API boundary authenticates here so unauthenticated
   * callers receive a stable 401 response.
   * ========================================================== */

  const supabase =
    await createServerClient()


  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser()


  if (
    authError ||
    !user
  ) {
    return jsonError(
      401,
      'unauthorized',
      'You must be signed in to start a Relay leg.'
    )
  }


  /* ==========================================================
   * REQUEST BODY
   * ========================================================== */

  const bodyResult =
    await readRequestBody(
      request
    )


  if (
    !bodyResult.ok
  ) {
    return jsonError(
      400,
      'invalid_request',
      bodyResult.message
    )
  }


  const teamSlotId =
    normalizeRequiredString(
      bodyResult.value.team_slot_id
    )


  const venueId =
    normalizeRequiredString(
      bodyResult.value.venue_id
    )


  if (
    !teamSlotId
  ) {
    return jsonError(
      400,
      'invalid_request',
      'team_slot_id is required.'
    )
  }


  if (
    !venueId
  ) {
    return jsonError(
      400,
      'invalid_request',
      'venue_id is required.'
    )
  }


  if (
    !isUuid(
      teamSlotId
    )
  ) {
    return jsonError(
      400,
      'invalid_request',
      'team_slot_id must be a valid UUID.'
    )
  }


  if (
    !isUuid(
      venueId
    )
  ) {
    return jsonError(
      400,
      'invalid_request',
      'venue_id must be a valid UUID.'
    )
  }


  /* ==========================================================
   * CANONICAL ACTIVE FLOW START
   * ==========================================================
   *
   * Do NOT create:
   *
   * - a Relay-specific flow/session table
   * - a second execution engine
   * - a parallel GPS/check-in system
   *
   * startRelaySlotFlow() calls:
   *
   *   start_roam_relay_slot_flow(
   *     p_team_slot_id,
   *     p_venue_id
   *   )
   *
   * The database/Active Flow system owns:
   *
   * - assigned-user authorization
   * - active baton requirement
   * - venue eligibility
   * - canonical session creation/reuse
   * - source = roam_relay_team_slot
   * - source_id = team_slot.id
   * - persistence of flow_session_id back into Relay state
   *
   * After mutation, the action resolves the canonical
   * active_flow_sessions row from Relay provenance.
   * ========================================================== */

  try {
    const result =
      await startRelaySlotFlow(
        teamSlotId as RelayTeamSlotId,
        venueId as VenueId
      )


    if (
      !result.sessionId
    ) {
      console.error(
        '[api/relay/leg/start] Relay leg start succeeded but no canonical Active Flow session was returned.',
        {
          teamSlotId,

          venueId,

          callerUserId:
            user.id,
        }
      )


      return jsonError(
        500,
        'flow_state_invalid',
        'The Relay leg started but its Active Flow session could not be confirmed.'
      )
    }


    /*
     * Verify the canonical Relay team read-back references the
     * same Active Flow session for this exact team slot.
     */
    const canonicalTeamSlot =
      result.team.slots.find(
        (
          slot
        ) =>
          slot.id ===
          teamSlotId
      ) ??
      null


    if (
      !canonicalTeamSlot ||
      canonicalTeamSlot.flowSessionId !==
        result.sessionId
    ) {
      console.error(
        '[api/relay/leg/start] Canonical Relay team slot does not reference the resolved Active Flow session.',
        {
          teamSlotId,

          venueId,

          callerUserId:
            user.id,

          resolvedSessionId:
            result.sessionId,

          canonicalFlowSessionId:
            canonicalTeamSlot
              ?.flowSessionId ??
            null,
        }
      )


      return jsonError(
        500,
        'flow_state_invalid',
        'The Relay leg started but its canonical flow association is inconsistent.'
      )
    }


    return NextResponse.json(
      {
        ok:
          true,

        team: {
          id:
            result.team.id,

          relayId:
            result.team.relayId,

          status:
            result.team.status,
        },

        flow: {
          sessionId:
            result.sessionId,

          source:
            'roam_relay_team_slot',

          sourceId:
            teamSlotId,
        },
      },
      {
        status:
          200,

        headers:
          noStoreHeaders(),
      }
    )
  } catch (
    error
  ) {
    /* ========================================================
     * SAFE FAILURE
     * ========================================================
     *
     * Canonical rejection may represent:
     *
     * - caller is not assigned to the active leg
     * - team slot is not the active baton
     * - venue violates slot constraints
     * - Relay/team is not executable
     * - canonical Active Flow provenance is invalid
     * - concurrent execution state changed first
     *
     * Never expose raw RPC/Postgres error text to the client.
     * ======================================================== */

    console.error(
      '[api/relay/leg/start] Canonical Relay Active Flow start rejected.',
      {
        teamSlotId,

        venueId,

        callerUserId:
          user.id,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      409,
      'start_rejected',
      'This Relay leg cannot be started in its current state.'
    )
  }
}


/* ============================================================
 * METHOD GUARDS
 * ============================================================
 */

export function GET() {
  return methodNotAllowed()
}


export function PUT() {
  return methodNotAllowed()
}


export function PATCH() {
  return methodNotAllowed()
}


export function DELETE() {
  return methodNotAllowed()
}


/* ============================================================
 * REQUEST PARSING
 * ============================================================
 */

async function readRequestBody(
  request:
    Request
): Promise<
  | {
      ok:
        true

      value:
        StartRelayLegRequest
    }
  | {
      ok:
        false

      message:
        string
    }
> {
  const contentType =
    request.headers
      .get(
        'content-type'
      )
      ?.toLowerCase() ??
    ''


  if (
    !contentType.includes(
      'application/json'
    )
  ) {
    return {
      ok:
        false,

      message:
        'Content-Type must be application/json.',
    }
  }


  let body:
    unknown


  try {
    body =
      await request.json()
  } catch {
    return {
      ok:
        false,

      message:
        'Request body must contain valid JSON.',
    }
  }


  if (
    !isRecord(
      body
    )
  ) {
    return {
      ok:
        false,

      message:
        'Request body must be a JSON object.',
    }
  }


  if (
    typeof body.team_slot_id !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'team_slot_id must be a string.',
    }
  }


  if (
    typeof body.venue_id !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'venue_id must be a string.',
    }
  }


  return {
    ok:
      true,

    value: {
      team_slot_id:
        body.team_slot_id,

      venue_id:
        body.venue_id,
    },
  }
}


/* ============================================================
 * RESPONSE HELPERS
 * ============================================================
 */

function jsonError(
  status:
    number,
  code:
    StartRelayLegErrorCode,
  message:
    string
): NextResponse<StartRelayLegErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code,

        message,
      },
    },
    {
      status,

      headers:
        noStoreHeaders(),
    }
  )
}


function methodNotAllowed(): NextResponse<StartRelayLegErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'invalid_request',

        message:
          'Method not allowed.',
      },
    },
    {
      status:
        405,

      headers: {
        ...noStoreHeaders(),

        Allow:
          'POST',
      },
    }
  )
}


function noStoreHeaders(): Record<
  string,
  string
> {
  return {
    'Cache-Control':
      'no-store, max-age=0',
  }
}


/* ============================================================
 * NORMALIZATION
 * ============================================================ */

function normalizeRequiredString(
  value:
    string
): string | null {
  const normalized =
    value.trim()


  return normalized.length >
    0
    ? normalized
    : null
}


/* ============================================================
 * UUID VALIDATION
 * ============================================================ */

function isUuid(
  value:
    string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}


/* ============================================================
 * ERROR SERIALIZATION
 * ============================================================ */

function serializeError(
  error:
    unknown
): {
  name:
    string

  message:
    string
} {
  if (
    error instanceof
      Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,
    }
  }


  return {
    name:
      'UnknownError',

    message:
      'Unknown error',
  }
}


/* ============================================================
 * TYPE GUARD
 * ============================================================ */

function isRecord(
  value:
    unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  )
}