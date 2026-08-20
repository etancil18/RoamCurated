// app/api/relay/team/invite/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  inviteRelayTeamMember,
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

type InviteRelayTeamMemberRequest = {
  team_id:
    string

  invitee_user_id:
    string
}


type InviteRelayTeamMemberSuccessResponse = {
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

  invitation: {
    memberId:
      string

    userId:
      string

    memberStatus:
      'invited'
  }
}


type InviteRelayTeamMemberErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'self_invite_not_allowed'
  | 'invite_rejected'
  | 'invite_state_invalid'


type InviteRelayTeamMemberErrorResponse = {
  ok:
    false

  error: {
    code:
      InviteRelayTeamMemberErrorCode

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
    | InviteRelayTeamMemberSuccessResponse
    | InviteRelayTeamMemberErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * Authentication is intentionally checked here even though the
   * canonical server action revalidates it.
   *
   * The API layer needs to distinguish an unauthenticated request
   * from an authenticated mutation rejected by the database.
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
      'You must be signed in to invite someone to a Relay team.'
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


  const inviteeUserId =
    normalizeRequiredString(
      bodyResult.value.invitee_user_id
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
    !inviteeUserId
  ) {
    return jsonError(
      400,
      'invalid_request',
      'invitee_user_id is required.'
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


  if (
    !isUuid(
      inviteeUserId
    )
  ) {
    return jsonError(
      400,
      'invalid_request',
      'invitee_user_id must be a valid UUID.'
    )
  }


  /*
   * This check is safe at the HTTP boundary.
   *
   * It is not a substitute for database authorization.
   */
  if (
    inviteeUserId ===
    user.id
  ) {
    return jsonError(
      400,
      'self_invite_not_allowed',
      'You cannot invite yourself to your own Relay team.'
    )
  }


  /* ==========================================================
   * CANONICAL ATOMIC MUTATION
   * ==========================================================
   *
   * Do NOT perform separate route-level reads for:
   *
   * - captain ownership
   * - forming status
   * - team capacity
   * - duplicate invitation/member state
   * - Relay lifecycle/window eligibility
   *
   * A read-then-write sequence here would introduce race
   * conditions.
   *
   * inviteRelayTeamMember() calls:
   *
   *   invite_roam_relay_team_member(
   *     p_team_id,
   *     p_user_id
   *   )
   *
   * The RPC is the transactional authority for those invariants.
   * ========================================================== */

  try {
    const result =
      await inviteRelayTeamMember(
        teamId,
        inviteeUserId
      )


    const invitedMember =
      result.team.members.find(
        (
          member
        ) =>
          member.userId ===
          inviteeUserId
      ) ??
      null


    /*
     * The server action performs a canonical read-back after the
     * RPC. A successful invite API response therefore requires the
     * resulting canonical membership to actually be "invited".
     */
    if (
      !invitedMember ||
      invitedMember.memberStatus !==
        'invited'
    ) {
      console.error(
        '[api/relay/team/invite] Invite mutation succeeded but canonical invitation state is invalid.',
        {
          teamId,

          inviteeUserId,

          resolvedMemberStatus:
            invitedMember
              ?.memberStatus ??
            null,
        }
      )


      return jsonError(
        500,
        'invite_state_invalid',
        'The invitation could not be confirmed.'
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

        invitation: {
          memberId:
            invitedMember.id,

          userId:
            invitedMember.userId,

          memberStatus:
            'invited',
        },
      },
      {
        status:
          201,

        headers:
          noStoreHeaders(),
      }
    )
  } catch (
    error
  ) {
    /*
     * Do not expose raw Postgres/RPC errors to the browser.
     *
     * Rejections can include:
     *
     * - caller is not captain
     * - team is no longer forming
     * - team is full
     * - invitee is already invited
     * - invitee is already joined
     * - Relay lifecycle no longer permits team formation
     * - another concurrent request won the race
     *
     * The database remains authoritative for the exact reason.
     */
    console.error(
      '[api/relay/team/invite] Canonical Relay invitation rejected.',
      {
        teamId,

        inviteeUserId,

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
      'invite_rejected',
      'This teammate cannot be invited to the Relay team right now.'
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
 * BODY PARSING
 * ============================================================ */

async function readRequestBody(
  request:
    Request
): Promise<
  | {
      ok:
        true

      value:
        InviteRelayTeamMemberRequest
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


  if (
    typeof body.invitee_user_id !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'invitee_user_id must be a string.',
    }
  }


  return {
    ok:
      true,

    value: {
      team_id:
        body.team_id,

      invitee_user_id:
        body.invitee_user_id,
    },
  }
}


/* ============================================================
 * RESPONSE HELPERS
 * ============================================================ */

function jsonError(
  status:
    number,
  code:
    InviteRelayTeamMemberErrorCode,
  message:
    string
): NextResponse<InviteRelayTeamMemberErrorResponse> {
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


function methodNotAllowed(): NextResponse<InviteRelayTeamMemberErrorResponse> {
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