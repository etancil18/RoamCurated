// app/api/relay/team/invitation/accept/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  joinRelayTeam,
} from '@/lib/relay/actions'

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

type AcceptRelayInvitationRequest = {
  team_id:
    string
}


type AcceptRelayInvitationSuccessResponse = {
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

  membership: {
    memberId:
      string

    userId:
      string

    memberStatus:
      'joined'
  }
}


type AcceptRelayInvitationErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'invitation_rejected'
  | 'membership_state_invalid'


type AcceptRelayInvitationErrorResponse = {
  ok:
    false

  error: {
    code:
      AcceptRelayInvitationErrorCode

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
    | AcceptRelayInvitationSuccessResponse
    | AcceptRelayInvitationErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * joinRelayTeam() authenticates again internally.
   *
   * We also authenticate at the HTTP boundary so this API can
   * return a stable 401 rather than treating missing auth as a
   * generic mutation rejection.
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
      'You must be signed in to accept a Relay invitation.'
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
   * CANONICAL ATOMIC ACCEPTANCE
   * ==========================================================
   *
   * Do NOT do route-level read-before-write checks for:
   *
   * - invitation ownership
   * - invited status
   * - team forming state
   * - team capacity
   * - Relay lifecycle
   * - duplicate/open membership
   *
   * Any of those values can change between SELECT and mutation.
   *
   * joinRelayTeam() calls:
   *
   *   join_roam_relay_team(
   *     p_team_id
   *   )
   *
   * Caller identity comes from auth.uid().
   *
   * The database RPC must transactionally revalidate all
   * invitation and capacity invariants.
   * ========================================================== */

  try {
    const result =
      await joinRelayTeam(
        teamId
      )


    /* ========================================================
     * CANONICAL READ-BACK VERIFICATION
     * ========================================================
     *
     * joinRelayTeam() already reloads the canonical Relay team.
     *
     * Do not trust an RPC success alone. Confirm the authenticated
     * caller is now represented as a joined member.
     * ======================================================== */

    const joinedMember =
      result.team.members.find(
        (
          member
        ) =>
          member.userId ===
          user.id
      ) ??
      null


    if (
      !joinedMember ||
      joinedMember.memberStatus !==
        'joined'
    ) {
      console.error(
        '[api/relay/team/invitation/accept] Join mutation succeeded but canonical membership state is invalid.',
        {
          teamId,

          callerUserId:
            user.id,

          resolvedMemberStatus:
            joinedMember
              ?.memberStatus ??
            null,
        }
      )


      return jsonError(
        500,
        'membership_state_invalid',
        'The Relay invitation was accepted but membership could not be confirmed.'
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

        membership: {
          memberId:
            joinedMember.id,

          userId:
            joinedMember.userId,

          memberStatus:
            'joined',
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
     * A canonical rejection may mean:
     *
     * - caller was never invited
     * - invitation belongs to another user
     * - invitation was declined/removed/already consumed
     * - team is no longer forming
     * - team reached capacity
     * - Relay lifecycle no longer permits joining
     * - caller already belongs to a conflicting Relay team
     * - a concurrent request changed state first
     *
     * Do not expose raw RPC/Postgres text to the browser.
     * ======================================================== */

    console.error(
      '[api/relay/team/invitation/accept] Canonical Relay invitation acceptance rejected.',
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
      'invitation_rejected',
      'This Relay invitation can no longer be accepted.'
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
        AcceptRelayInvitationRequest
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
    AcceptRelayInvitationErrorCode,
  message:
    string
): NextResponse<AcceptRelayInvitationErrorResponse> {
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


function methodNotAllowed(): NextResponse<AcceptRelayInvitationErrorResponse> {
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
 * ============================================================
 */

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