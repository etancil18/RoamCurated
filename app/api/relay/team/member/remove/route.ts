// app/api/relay/team/member/remove/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  removeRelayTeamMember,
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

type RemoveRelayTeamMemberRequest = {
  team_id:
    string

  user_id:
    string
}


type RemoveRelayTeamMemberSuccessResponse = {
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

  member: {
    memberId:
      string

    userId:
      string

    memberStatus:
      'removed'
  }
}


type RemoveRelayTeamMemberErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'self_removal_not_allowed'
  | 'removal_rejected'
  | 'membership_state_invalid'


type RemoveRelayTeamMemberErrorResponse = {
  ok:
    false

  error: {
    code:
      RemoveRelayTeamMemberErrorCode

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
    | RemoveRelayTeamMemberSuccessResponse
    | RemoveRelayTeamMemberErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * removeRelayTeamMember() authenticates again internally.
   *
   * The HTTP boundary still authenticates here so an unsigned
   * request receives a stable 401 instead of a generic mutation
   * failure.
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
      'You must be signed in to remove a Relay team member.'
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


  const targetUserId =
    normalizeRequiredString(
      bodyResult.value.user_id
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
    !targetUserId
  ) {
    return jsonError(
      400,
      'invalid_request',
      'user_id is required.'
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
      targetUserId
    )
  ) {
    return jsonError(
      400,
      'invalid_request',
      'user_id must be a valid UUID.'
    )
  }


  /*
   * Defensive boundary check only.
   *
   * The database RPC independently enforces that the captain
   * cannot remove themselves.
   */
  if (
    targetUserId ===
    user.id
  ) {
    return jsonError(
      400,
      'self_removal_not_allowed',
      'You cannot remove yourself through the Relay member-removal operation.'
    )
  }


  /* ==========================================================
   * CANONICAL ATOMIC REMOVAL
   * ==========================================================
   *
   * Do NOT perform separate route-level SELECT checks for:
   *
   * - captain ownership
   * - team forming status
   * - target membership
   * - target member_status
   * - captain self-removal
   * - Relay lifecycle
   * - existing slot assignment
   *
   * A SELECT followed by mutation would introduce races.
   *
   * removeRelayTeamMember() calls:
   *
   *   remove_roam_relay_team_member(
   *     p_team_id,
   *     p_user_id
   *   )
   *
   * The database transaction owns:
   *
   * - authenticated captain authorization
   * - forming-only mutation
   * - invited/joined-only target validation
   * - captain protection
   * - assignment cleanup
   * - member_status -> removed
   * ========================================================== */

  try {
    const result =
      await removeRelayTeamMember(
        teamId,
        targetUserId
      )


    /* ========================================================
     * CANONICAL READ-BACK
     * ========================================================
     *
     * removeRelayTeamMember() already reloads and verifies the
     * canonical team after the RPC.
     *
     * Resolve the removed member from that canonical projection
     * before returning HTTP success.
     * ======================================================== */

    const removedMember =
      result.team.members.find(
        (
          member
        ) =>
          member.userId ===
          targetUserId
      ) ??
      null


    if (
      !removedMember ||
      removedMember.memberStatus !==
        'removed'
    ) {
      console.error(
        '[api/relay/team/member/remove] Removal mutation succeeded but canonical membership state is invalid.',
        {
          teamId,

          targetUserId,

          callerUserId:
            user.id,

          resolvedMemberStatus:
            removedMember
              ?.memberStatus ??
            null,
        }
      )


      return jsonError(
        500,
        'membership_state_invalid',
        'The Relay member was removed but the canonical membership state could not be confirmed.'
      )
    }


    /*
     * The action also verifies that no team slot still references
     * the removed contributor.
     *
     * Re-checking from the returned canonical projection is cheap
     * and protects the HTTP success contract from inconsistent
     * presentation state.
     */
    const lingeringAssignment =
      result.team.slots.find(
        (
          slot
        ) =>
          slot.assignedUserId ===
          targetUserId
      ) ??
      null


    if (
      lingeringAssignment
    ) {
      console.error(
        '[api/relay/team/member/remove] Removed member still owns a canonical Relay slot.',
        {
          teamId,

          targetUserId,

          callerUserId:
            user.id,

          teamSlotId:
            lingeringAssignment.id,
        }
      )


      return jsonError(
        500,
        'membership_state_invalid',
        'The Relay member was removed but assignment cleanup could not be confirmed.'
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

        member: {
          memberId:
            removedMember.id,

          userId:
            removedMember.userId,

          memberStatus:
            'removed',
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
     * Canonical rejection may mean:
     *
     * - caller is not the captain
     * - team is no longer forming
     * - target is not on this team
     * - target is already removed/declined/left
     * - target is the captain
     * - Relay lifecycle no longer permits formation changes
     * - concurrent state changed first
     *
     * Raw Postgres/RPC errors are never returned to the browser.
     * ======================================================== */

    console.error(
      '[api/relay/team/member/remove] Canonical Relay member removal rejected.',
      {
        teamId,

        targetUserId,

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
      'removal_rejected',
      'This teammate cannot be removed from the Relay team right now.'
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
        RemoveRelayTeamMemberRequest
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
    typeof body.user_id !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'user_id must be a string.',
    }
  }


  return {
    ok:
      true,

    value: {
      team_id:
        body.team_id,

      user_id:
        body.user_id,
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
    RemoveRelayTeamMemberErrorCode,
  message:
    string
): NextResponse<RemoveRelayTeamMemberErrorResponse> {
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


function methodNotAllowed(): NextResponse<RemoveRelayTeamMemberErrorResponse> {
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