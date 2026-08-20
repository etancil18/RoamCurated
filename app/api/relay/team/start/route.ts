// app/api/relay/team/start/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  startRelayTeam,
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

type StartRelayTeamRequest = {
  team_id:
    string
}


type StartRelayTeamSuccessResponse = {
  ok:
    true

  team: {
    id:
      string

    relayId:
      string

    status:
      'active'
  }

  baton: {
    teamSlotId:
      string

    relaySlotId:
      string

    slotIndex:
      number

    assignedUserId:
      string
  }
}


type StartRelayTeamErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'start_rejected'
  | 'start_state_invalid'


type StartRelayTeamErrorResponse = {
  ok:
    false

  error: {
    code:
      StartRelayTeamErrorCode

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
    | StartRelayTeamSuccessResponse
    | StartRelayTeamErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * startRelayTeam() authenticates internally as well.
   *
   * The route authenticates here so unsigned callers receive a
   * stable 401 instead of a generic canonical mutation failure.
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
      'You must be signed in to start a Relay team.'
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
   * CANONICAL START TRANSITION
   * ==========================================================
   *
   * Do NOT perform route-level preflight reads for:
   *
   * - captain ownership
   * - team.status = ready
   * - Relay.status = live
   * - Relay starts_at / ends_at window
   * - roster validity
   * - slot assignment validity
   * - first baton candidate
   *
   * Those checks can go stale before mutation.
   *
   * startRelayTeam() performs one canonical RPC call:
   *
   *   start_roam_relay_team(
   *     p_team_id
   *   )
   *
   * The database transaction must own:
   *
   *   ready -> active
   *   Relay live/window validation
   *   first baton activation
   * ========================================================== */

  try {
    const result =
      await startRelayTeam(
        teamId as RelayTeamId
      )


    /* ========================================================
     * CANONICAL READ-BACK VERIFICATION
     * ========================================================
     *
     * startRelayTeam() reloads the canonical team after mutation.
     *
     * A valid active Relay must contain exactly one active team
     * slot. Do not infer the baton from slot_index ordering.
     * ======================================================== */

    if (
      result.team.status !==
      'active'
    ) {
      console.error(
        '[api/relay/team/start] Start mutation succeeded but canonical team state is not active.',
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
        'start_state_invalid',
        'The Relay team start transition could not be confirmed.'
      )
    }


    const activeSlots =
      result.team.slots.filter(
        (
          slot
        ) =>
          slot.status ===
          'active'
      )


    if (
      activeSlots.length !==
      1
    ) {
      console.error(
        '[api/relay/team/start] Canonical active Relay does not contain exactly one active baton slot.',
        {
          teamId,

          callerUserId:
            user.id,

          activeSlotCount:
            activeSlots.length,
        }
      )


      return jsonError(
        500,
        'start_state_invalid',
        'The Relay team started but the active baton state could not be confirmed.'
      )
    }


    const activeSlot =
      activeSlots[0]


    if (
      !activeSlot.assignedUserId
    ) {
      console.error(
        '[api/relay/team/start] Canonical active baton slot has no assigned contributor.',
        {
          teamId,

          callerUserId:
            user.id,

          teamSlotId:
            activeSlot.id,
        }
      )


      return jsonError(
        500,
        'start_state_invalid',
        'The Relay team started but the active baton assignment is invalid.'
      )
    }


    /*
     * The first baton is identified by persisted canonical
     * status, not by positional inference.
     *
     * This prevents the API from inventing execution state.
     */
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
            'active',
        },

        baton: {
          teamSlotId:
            activeSlot.id,

          relaySlotId:
            activeSlot.relaySlotId,

          slotIndex:
            activeSlot.slotIndex,

          assignedUserId:
            activeSlot.assignedUserId,
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
     * Canonical rejection may represent:
     *
     * - caller is not captain
     * - team is not ready
     * - Relay is not live
     * - Relay has not started yet
     * - Relay window has ended
     * - roster/slot state became invalid
     * - first baton could not be activated
     * - concurrent state changed first
     *
     * Never expose raw RPC/Postgres error messages.
     * ======================================================== */

    console.error(
      '[api/relay/team/start] Canonical Relay start transition rejected.',
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
      'start_rejected',
      'This Relay team cannot be started in its current state.'
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
        StartRelayTeamRequest
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
    StartRelayTeamErrorCode,
  message:
    string
): NextResponse<StartRelayTeamErrorResponse> {
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


function methodNotAllowed(): NextResponse<StartRelayTeamErrorResponse> {
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
 * ============================================================
 */

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
 * ============================================================
 */

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
 * ============================================================
 */

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