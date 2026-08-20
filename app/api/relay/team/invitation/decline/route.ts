// app/api/relay/team/invitation/decline/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  declineRelayTeamInvitation,
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

type DeclineRelayInvitationRequest = {
  team_id:
    string
}


type DeclineRelayInvitationSuccessResponse = {
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
      'declined'
  }
}


type DeclineRelayInvitationErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'decline_rejected'
  | 'membership_state_invalid'


type DeclineRelayInvitationErrorResponse = {
  ok:
    false

  error: {
    code:
      DeclineRelayInvitationErrorCode

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
    | DeclineRelayInvitationSuccessResponse
    | DeclineRelayInvitationErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * declineRelayTeamInvitation() authenticates internally too.
   *
   * The API layer still authenticates here so unauthenticated
   * callers receive a stable 401 response rather than a generic
   * mutation failure.
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
      'You must be signed in to decline a Relay invitation.'
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
   * CANONICAL ATOMIC DECLINE
   * ==========================================================
   *
   * Do NOT look up an invitation row and then update it here.
   *
   * declineRelayTeamInvitation() calls:
   *
   *   decline_roam_relay_team_invitation(
   *     p_team_id
   *   )
   *
   * Caller identity comes exclusively from auth.uid().
   *
   * The database must transactionally prove:
   *
   * - the caller has a membership on this team
   * - that membership currently has status "invited"
   * - the invitation belongs to the authenticated caller
   * - the invitation has not already been consumed/declined
   * - the transition invited -> declined is valid
   * ========================================================== */

  try {
    const result =
      await declineRelayTeamInvitation(
        teamId
      )


    /* ========================================================
     * CANONICAL READ-BACK
     * ========================================================
     *
     * The action reloads the canonical team after the mutation.
     *
     * Confirm the caller's membership is now actually declined
     * before returning success.
     * ======================================================== */

    const declinedMember =
      result.team.members.find(
        (
          member
        ) =>
          member.userId ===
          user.id
      ) ??
      null


    if (
      !declinedMember ||
      declinedMember.memberStatus !==
        'declined'
    ) {
      console.error(
        '[api/relay/team/invitation/decline] Decline mutation succeeded but canonical membership state is invalid.',
        {
          teamId,

          callerUserId:
            user.id,

          resolvedMemberStatus:
            declinedMember
              ?.memberStatus ??
            null,
        }
      )


      return jsonError(
        500,
        'membership_state_invalid',
        'The Relay invitation was declined but the membership state could not be confirmed.'
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
            declinedMember.id,

          userId:
            declinedMember.userId,

          memberStatus:
            'declined',
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
     * Rejection can mean:
     *
     * - the caller was never invited
     * - the invitation belongs to another user
     * - the invitation was already joined
     * - the invitation was already declined
     * - the membership was removed/left
     * - concurrent state changed before this request completed
     *
     * Never expose raw RPC/Postgres error text to the browser.
     * ======================================================== */

    console.error(
      '[api/relay/team/invitation/decline] Canonical Relay invitation decline rejected.',
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
      'decline_rejected',
      'This Relay invitation can no longer be declined.'
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
        DeclineRelayInvitationRequest
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
    DeclineRelayInvitationErrorCode,
  message:
    string
): NextResponse<DeclineRelayInvitationErrorResponse> {
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


function methodNotAllowed(): NextResponse<DeclineRelayInvitationErrorResponse> {
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