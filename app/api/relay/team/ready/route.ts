// app/api/relay/team/ready/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  setRelayTeamReady,
} from '@/lib/relay/actions'

import type {
  RelayTeamId,
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

type SetRelayTeamReadyRequest = {
  team_id:
    string
}


type SetRelayTeamReadySuccessResponse = {
  ok:
    true

  team: {
    id:
      string

    relayId:
      string

    status:
      'ready'
  }
}


type SetRelayTeamReadyErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'ready_rejected'
  | 'ready_state_invalid'


type SetRelayTeamReadyErrorResponse = {
  ok:
    false

  error: {
    code:
      SetRelayTeamReadyErrorCode

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
    | SetRelayTeamReadySuccessResponse
    | SetRelayTeamReadyErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * setRelayTeamReady() authenticates internally as well.
   *
   * The API boundary authenticates here so unsigned requests
   * receive a stable 401 instead of a generic mutation failure.
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
      'You must be signed in to mark a Relay team ready.'
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


  const teamId =
    normalizeRequiredString(
      bodyResult.value.team_id
    )


  if (
    !teamId
  ) {
    return jsonError(
      400,
      'invalid_request',
      'team_id is required.'
    )
  }


  if (
    !isUuid(
      teamId
    )
  ) {
    return jsonError(
      400,
      'invalid_request',
      'team_id must be a valid UUID.'
    )
  }


  /* ==========================================================
   * CANONICAL READY TRANSITION
   * ==========================================================
   *
   * Do NOT perform route-level SELECT checks for:
   *
   * - captain ownership
   * - team.status = forming
   * - minimum/maximum roster size
   * - pending invitation state
   * - joined-member count
   * - slot coverage
   * - one user per slot
   * - one slot per joined member
   * - Relay lifecycle/window eligibility
   *
   * Those values may change between a preflight read and the
   * mutation.
   *
   * setRelayTeamReady() calls exactly one canonical RPC:
   *
   *   set_roam_relay_team_ready(
   *     p_team_id
   *   )
   *
   * The database transaction must revalidate all readiness
   * invariants at mutation time.
   * ========================================================== */

  try {
    const result =
      await setRelayTeamReady(
        teamId as RelayTeamId
      )


    /* ========================================================
     * CANONICAL READ-BACK VERIFICATION
     * ========================================================
     *
     * setRelayTeamReady() reloads the canonical team after the
     * RPC.
     *
     * A successful HTTP response requires that canonical state
     * to actually be "ready".
     * ======================================================== */

    if (
      result.team.status !==
      'ready'
    ) {
      console.error(
        '[api/relay/team/ready] Ready mutation succeeded but canonical team state is invalid.',
        {
          teamId,

          callerUserId:
            user.id,

          resolvedTeamStatus:
            result.team.status,
        }
      )


      return jsonError(
        500,
        'ready_state_invalid',
        'The Relay team readiness transition could not be confirmed.'
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
            'ready',
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
     * SAFE MUTATION FAILURE
     * ========================================================
     *
     * Canonical rejection may mean:
     *
     * - caller is not the captain
     * - team is no longer forming
     * - roster is below/above allowed size
     * - invited members are still unresolved
     * - not every joined member has exactly one slot
     * - not every team slot has exactly one joined contributor
     * - assignment state changed concurrently
     * - Relay lifecycle/window no longer permits readiness
     *
     * Do not expose raw PostgreSQL/RPC messages to the client.
     * ======================================================== */

    console.error(
      '[api/relay/team/ready] Canonical Relay readiness transition rejected.',
      {
        teamId,

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
      'ready_rejected',
      'This Relay team cannot be marked ready in its current state.'
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
        SetRelayTeamReadyRequest
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
    typeof body.team_id !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'team_id must be a string.',
    }
  }


  return {
    ok:
      true,

    value: {
      team_id:
        body.team_id,
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
    SetRelayTeamReadyErrorCode,
  message:
    string
): NextResponse<SetRelayTeamReadyErrorResponse> {
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


function methodNotAllowed(): NextResponse<SetRelayTeamReadyErrorResponse> {
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
 * UUID
 * ============================================================ */

function isUuid(
  value:
    string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
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