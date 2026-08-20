// app/api/relay/team/slots/assign/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  assignRelayTeamSlots,
} from '@/lib/relay/actions'

import type {
  RelaySlotId,
  RelayTeamId,
  UserId,
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

type AssignRelayTeamSlotsRequest = {
  team_id:
    string

  assignments:
    Array<{
      slotId:
        string

      userId:
        string
    }>
}


type AssignRelayTeamSlotsSuccessResponse = {
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

  assignments:
    Array<{
      teamSlotId:
        string

      slotId:
        string

      userId:
        string
    }>
}


type AssignRelayTeamSlotsErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'duplicate_slot'
  | 'duplicate_user'
  | 'assignment_rejected'
  | 'assignment_state_invalid'


type AssignRelayTeamSlotsErrorResponse = {
  ok:
    false

  error: {
    code:
      AssignRelayTeamSlotsErrorCode

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
    | AssignRelayTeamSlotsSuccessResponse
    | AssignRelayTeamSlotsErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * assignRelayTeamSlots() authenticates again internally.
   *
   * Authenticate at the API boundary as well so unsigned callers
   * receive a stable HTTP 401 rather than a generic RPC failure.
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
      'You must be signed in to assign a Relay team roster.'
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


  if (
    bodyResult.value.assignments.length ===
    0
  ) {
    return jsonError(
      400,
      'invalid_request',
      'assignments must contain at least one assignment.'
    )
  }


  const normalizedAssignments:
    Array<{
      slotId:
        RelaySlotId

      userId:
        UserId
    }> =
    []


  for (
    let index =
      0;
    index <
      bodyResult.value.assignments.length;
    index +=
      1
  ) {
    const assignment =
      bodyResult.value.assignments[
        index
      ]


    const slotId =
      normalizeRequiredString(
        assignment.slotId
      )


    const userId =
      normalizeRequiredString(
        assignment.userId
      )


    if (
      !slotId
    ) {
      return jsonError(
        400,
        'invalid_request',
        `assignments[${index}].slotId is required.`
      )
    }


    if (
      !userId
    ) {
      return jsonError(
        400,
        'invalid_request',
        `assignments[${index}].userId is required.`
      )
    }


    if (
      !isUuid(
        slotId
      )
    ) {
      return jsonError(
        400,
        'invalid_request',
        `assignments[${index}].slotId must be a valid UUID.`
      )
    }


    if (
      !isUuid(
        userId
      )
    ) {
      return jsonError(
        400,
        'invalid_request',
        `assignments[${index}].userId must be a valid UUID.`
      )
    }


    normalizedAssignments.push(
      {
        slotId:
          slotId as RelaySlotId,

        userId:
          userId as UserId,
      }
    )
  }


  /* ==========================================================
   * DEFENSIVE DUPLICATE VALIDATION
   * ==========================================================
   *
   * These checks improve the HTTP error contract.
   *
   * They are NOT the authority for uniqueness. The canonical RPC
   * independently enforces the same invariants transactionally.
   * ========================================================== */

  const slotIds =
    normalizedAssignments.map(
      (
        assignment
      ) =>
        assignment.slotId
    )


  if (
    new Set(
      slotIds
    ).size !==
    slotIds.length
  ) {
    return jsonError(
      400,
      'duplicate_slot',
      'Each Relay slot may appear only once in assignments.'
    )
  }


  const userIds =
    normalizedAssignments.map(
      (
        assignment
      ) =>
        assignment.userId
    )


  if (
    new Set(
      userIds
    ).size !==
    userIds.length
  ) {
    return jsonError(
      400,
      'duplicate_user',
      'Each Relay team member may appear only once in assignments.'
    )
  }


  /* ==========================================================
   * CANONICAL ATOMIC MUTATION
   * ==========================================================
   *
   * Do NOT perform route-level SELECT checks for:
   *
   * - captain ownership
   * - team status
   * - exact slot ownership
   * - joined-member status
   * - complete slot coverage
   * - complete joined-roster coverage
   *
   * Those checks would become stale between SELECT and UPDATE.
   *
   * assignRelayTeamSlots() performs one RPC call:
   *
   *   assign_roam_relay_team_slots(
   *     p_team_id,
   *     p_assignments
   *   )
   *
   * The database transaction owns the complete invariant set.
   * ========================================================== */

  try {
    const result =
      await assignRelayTeamSlots(
        teamId as RelayTeamId,
        normalizedAssignments
      )


    /* ========================================================
     * CANONICAL READ-BACK VERIFICATION
     * ========================================================
     *
     * The action already reloads and verifies canonical team
     * state after the RPC.
     *
     * Build the HTTP response only from that canonical state.
     * ======================================================== */

    const canonicalAssignments =
      normalizedAssignments.map(
        (
          requestedAssignment
        ) => {
          const teamSlot =
            result.team.slots.find(
              (
                slot
              ) =>
                slot.relaySlotId ===
                requestedAssignment.slotId
            ) ??
            null


          if (
            !teamSlot ||
            teamSlot.assignedUserId !==
              requestedAssignment.userId
          ) {
            return null
          }


          return {
            teamSlotId:
              teamSlot.id,

            slotId:
              teamSlot.relaySlotId,

            userId:
              teamSlot.assignedUserId,
          }
        }
      )


    if (
      canonicalAssignments.some(
        (
          assignment
        ) =>
          assignment ===
          null
      )
    ) {
      console.error(
        '[api/relay/team/slots/assign] Atomic assignment succeeded but canonical assignment state is inconsistent.',
        {
          teamId,

          callerUserId:
            user.id,
        }
      )


      return jsonError(
        500,
        'assignment_state_invalid',
        'The Relay roster was assigned but canonical assignment state could not be confirmed.'
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

        assignments:
          canonicalAssignments as Array<{
            teamSlotId:
              string

            slotId:
              string

            userId:
              string
          }>,
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
     * Rejection may represent:
     *
     * - caller is not captain
     * - team is no longer forming
     * - supplied slot does not belong to team
     * - supplied user is not joined
     * - a joined member was omitted
     * - a team slot was omitted
     * - roster/slot cardinality mismatch
     * - duplicate state won a concurrent race
     * - lifecycle changed before transaction lock
     *
     * Do not expose raw PostgreSQL/RPC messages.
     * ======================================================== */

    console.error(
      '[api/relay/team/slots/assign] Canonical Relay roster assignment rejected.',
      {
        teamId,

        callerUserId:
          user.id,

        assignmentCount:
          normalizedAssignments.length,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      409,
      'assignment_rejected',
      'This Relay roster cannot be assigned in its current state.'
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
        AssignRelayTeamSlotsRequest
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
    !Array.isArray(
      body.assignments
    )
  ) {
    return {
      ok:
        false,

      message:
        'assignments must be an array.',
    }
  }


  const assignments:
    AssignRelayTeamSlotsRequest['assignments'] =
    []


  for (
    let index =
      0;
    index <
      body.assignments.length;
    index +=
      1
  ) {
    const assignment =
      body.assignments[
        index
      ]


    if (
      !isRecord(
        assignment
      )
    ) {
      return {
        ok:
          false,

        message:
          `assignments[${index}] must be an object.`,
      }
    }


    if (
      typeof assignment.slotId !==
        'string'
    ) {
      return {
        ok:
          false,

        message:
          `assignments[${index}].slotId must be a string.`,
      }
    }


    if (
      typeof assignment.userId !==
        'string'
    ) {
      return {
        ok:
          false,

        message:
          `assignments[${index}].userId must be a string.`,
      }
    }


    assignments.push(
      {
        slotId:
          assignment.slotId,

        userId:
          assignment.userId,
      }
    )
  }


  return {
    ok:
      true,

    value: {
      team_id:
        body.team_id,

      assignments,
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
    AssignRelayTeamSlotsErrorCode,
  message:
    string
): NextResponse<AssignRelayTeamSlotsErrorResponse> {
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


function methodNotAllowed(): NextResponse<AssignRelayTeamSlotsErrorResponse> {
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