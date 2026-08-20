// app/api/relay/leg/complete/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  completeRelaySlot,
} from '@/lib/relay/actions'

import type {
  ActiveFlowSessionId,
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
 * REQUEST / RESPONSE TYPES
 * ============================================================
 */

type CompleteRelayLegRequest = {
  team_slot_id:
    string

  venue_id:
    string

  flow_session_id:
    string
}


type RelayLegProjection = {
  teamSlotId:
    string

  relaySlotId:
    string

  slotIndex:
    number

  assignedUserId:
    string | null

  status:
    string

  venueId:
    string | null

  flowSessionId:
    string | null

  checkedInAt:
    string | null

  completedAt:
    string | null

  geoVerified:
    boolean
}


type CompleteRelayLegSuccessResponse = {
  ok:
    true

  completion: {
    completedTeamSlotId:
      string

    team: {
      id:
        string

      relayId:
        string

      status:
        string

      completedAt:
        string | null
    }

    baton: {
      advanced:
        boolean

      activeSlot:
        RelayLegProjection | null
    }
  }
}


type CompleteRelayLegErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'completion_rejected'
  | 'canonical_state_invalid'


type CompleteRelayLegErrorResponse = {
  ok:
    false

  error: {
    code:
      CompleteRelayLegErrorCode

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
    | CompleteRelayLegSuccessResponse
    | CompleteRelayLegErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * completeRelaySlot() authenticates internally as well.
   *
   * Authenticate here so the HTTP contract returns a stable 401
   * rather than leaking action/RPC error semantics.
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
      'You must be signed in to complete a Relay leg.'
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

  const flowSessionId =
    normalizeRequiredString(
      bodyResult.value.flow_session_id
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
    !flowSessionId
  ) {
    return jsonError(
      400,
      'invalid_request',
      'flow_session_id is required.'
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


  if (
    !isUuid(
      flowSessionId
    )
  ) {
    return jsonError(
      400,
      'invalid_request',
      'flow_session_id must be a valid UUID.'
    )
  }


  /* ==========================================================
   * CANONICAL RELAY COMPLETION
   * ==========================================================
   *
   * Do NOT:
   *
   * - mark the team slot complete directly
   * - set geo_verified directly
   * - write checked_in_at directly
   * - advance the next slot in application code
   * - complete the team in application code
   * - recalculate GPS here
   *
   * completeRelaySlot() delegates to:
   *
   *   complete_roam_relay_slot(
   *     p_team_slot_id,
   *     p_venue_id,
   *     p_flow_session_id
   *   )
   *
   * The DB RPC owns the transaction containing:
   *
   * - assigned-user authorization
   * - current active-baton validation
   * - Active Flow provenance validation
   * - canonical geo-verified evidence validation
   * - venue-constraint validation
   * - current leg completion
   * - exactly-one next baton activation
   * - final team completion
   * - idempotency / concurrent protection
   * ========================================================== */

  try {
    const result =
      await completeRelaySlot(
        teamSlotId as RelayTeamSlotId,
        venueId as VenueId,
        flowSessionId as ActiveFlowSessionId
      )


    /* ========================================================
     * CANONICAL COMPLETED SLOT
     * ======================================================== */

    const completedSlot =
      result.team.slots.find(
        (
          slot
        ) =>
          slot.id ===
          result.completedTeamSlotId
      ) ??
      null


    if (
      !completedSlot ||
      completedSlot.id !==
        teamSlotId ||
      completedSlot.status !==
        'completed'
    ) {
      console.error(
        '[api/relay/leg/complete] RPC returned success but canonical completed slot state is invalid.',
        {
          callerUserId:
            user.id,

          teamSlotId,

          venueId,

          flowSessionId,

          returnedCompletedTeamSlotId:
            result.completedTeamSlotId,

          canonicalCompletedSlotId:
            completedSlot
              ?.id ??
            null,

          canonicalCompletedSlotStatus:
            completedSlot
              ?.status ??
            null,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay leg completed, but its canonical state is inconsistent.'
      )
    }


    /* ========================================================
     * BATON / TEAM POSTCONDITION
     * ========================================================
     *
     * Exactly two valid post-mutation shapes exist:
     *
     * 1. Team remains active
     *      -> exactly one slot is active
     *
     * 2. Team is completed
     *      -> zero slots are active
     *      -> every slot is completed
     *
     * Do not infer the next baton from slotIndex.
     * Persisted slot.status is authoritative.
     * ======================================================== */

    const activeSlots =
      result.team.slots.filter(
        (
          slot
        ) =>
          slot.status ===
          'active'
      )


    if (
      result.team.status ===
      'active'
    ) {
      if (
        activeSlots.length !==
        1
      ) {
        console.error(
          '[api/relay/leg/complete] Active Relay team does not have exactly one active baton after completion.',
          {
            callerUserId:
              user.id,

            teamId:
              result.team.id,

            completedTeamSlotId:
              result.completedTeamSlotId,

            activeTeamSlotIds:
              activeSlots.map(
                (
                  slot
                ) =>
                  slot.id
              ),
          }
        )


        return jsonError(
          500,
          'canonical_state_invalid',
          'The Relay baton state is inconsistent after leg completion.'
        )
      }


      const activeSlot =
        activeSlots[0]


      if (
        !activeSlot.assignedUserId
      ) {
        console.error(
          '[api/relay/leg/complete] Active Relay baton has no assigned contributor.',
          {
            callerUserId:
              user.id,

            teamId:
              result.team.id,

            activeTeamSlotId:
              activeSlot.id,
          }
        )


        return jsonError(
          500,
          'canonical_state_invalid',
          'The Relay baton state is inconsistent after leg completion.'
        )
      }


      return NextResponse.json(
        {
          ok:
            true,

          completion: {
            completedTeamSlotId:
              result.completedTeamSlotId,

            team: {
              id:
                result.team.id,

              relayId:
                result.team.relayId,

              status:
                result.team.status,

              completedAt:
                result.team.completedAt,
            },

            baton: {
              advanced:
                true,

              activeSlot:
                projectRelayLeg(
                  activeSlot
                ),
            },
          },
        },
        {
          status:
            200,

          headers:
            noStoreHeaders(),
        }
      )
    }


    if (
      result.team.status ===
      'completed'
    ) {
      if (
        activeSlots.length !==
        0
      ) {
        console.error(
          '[api/relay/leg/complete] Completed Relay team still has an active baton.',
          {
            callerUserId:
              user.id,

            teamId:
              result.team.id,

            completedTeamSlotId:
              result.completedTeamSlotId,

            activeTeamSlotIds:
              activeSlots.map(
                (
                  slot
                ) =>
                  slot.id
              ),
          }
        )


        return jsonError(
          500,
          'canonical_state_invalid',
          'The Relay completion state is inconsistent.'
        )
      }


      const nonCompletedSlots =
        result.team.slots.filter(
          (
            slot
          ) =>
            slot.status !==
            'completed'
        )


      if (
        result.team.slots.length ===
          0 ||
        nonCompletedSlots.length >
          0
      ) {
        console.error(
          '[api/relay/leg/complete] Completed Relay team contains unresolved slots.',
          {
            callerUserId:
              user.id,

            teamId:
              result.team.id,

            completedTeamSlotId:
              result.completedTeamSlotId,

            slotCount:
              result.team.slots.length,

            unresolvedTeamSlotIds:
              nonCompletedSlots.map(
                (
                  slot
                ) =>
                  slot.id
              ),
          }
        )


        return jsonError(
          500,
          'canonical_state_invalid',
          'The Relay completion state is inconsistent.'
        )
      }


      return NextResponse.json(
        {
          ok:
            true,

          completion: {
            completedTeamSlotId:
              result.completedTeamSlotId,

            team: {
              id:
                result.team.id,

              relayId:
                result.team.relayId,

              status:
                result.team.status,

              completedAt:
                result.team.completedAt,
            },

            baton: {
              advanced:
                false,

              activeSlot:
                null,
            },
          },
        },
        {
          status:
            200,

          headers:
            noStoreHeaders(),
        }
      )
    }


    /* ========================================================
     * IMPOSSIBLE POST-MUTATION TEAM STATE
     * ========================================================
     *
     * A successful leg completion may only leave the team active
     * or completed.
     * ======================================================== */

    console.error(
      '[api/relay/leg/complete] Successful Relay leg completion left team in an invalid lifecycle state.',
      {
        callerUserId:
          user.id,

        teamId:
          result.team.id,

        completedTeamSlotId:
          result.completedTeamSlotId,

        teamStatus:
          result.team.status,
      }
    )


    return jsonError(
      500,
      'canonical_state_invalid',
      'The Relay team state is inconsistent after leg completion.'
    )
  } catch (
    error
  ) {
    /* ========================================================
     * SAFE CANONICAL REJECTION
     * ========================================================
     *
     * Typical rejection causes include:
     *
     * - caller is not the assigned active contributor
     * - team slot is not currently active
     * - flow session does not belong to this Relay leg
     * - flow session belongs to another user
     * - venue is not valid for the Relay slot
     * - canonical Active Flow check-in is not geo-verified
     * - required completion evidence is missing
     * - Relay/team lifecycle no longer permits completion
     * - concurrent completion already advanced the baton
     *
     * Do not leak raw RPC/Postgres errors to the client.
     * ======================================================== */

    console.error(
      '[api/relay/leg/complete] Canonical Relay leg completion rejected.',
      {
        callerUserId:
          user.id,

        teamSlotId,

        venueId,

        flowSessionId,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      409,
      'completion_rejected',
      'This Relay leg cannot be completed in its current state.'
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
        CompleteRelayLegRequest
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


  if (
    typeof body.flow_session_id !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'flow_session_id must be a string.',
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

      flow_session_id:
        body.flow_session_id,
    },
  }
}


/* ============================================================
 * PROJECTION
 * ============================================================
 */

function projectRelayLeg(
  slot:
    {
      id:
        string

      relaySlotId:
        string

      slotIndex:
        number

      assignedUserId:
        string | null

      status:
        string

      venueId:
        string | null

      flowSessionId:
        string | null

      checkedInAt:
        string | null

      completedAt:
        string | null

      geoVerified:
        boolean
    }
): RelayLegProjection {
  return {
    teamSlotId:
      slot.id,

    relaySlotId:
      slot.relaySlotId,

    slotIndex:
      slot.slotIndex,

    assignedUserId:
      slot.assignedUserId,

    status:
      slot.status,

    venueId:
      slot.venueId,

    flowSessionId:
      slot.flowSessionId,

    checkedInAt:
      slot.checkedInAt,

    completedAt:
      slot.completedAt,

    geoVerified:
      slot.geoVerified,
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
    CompleteRelayLegErrorCode,
  message:
    string
): NextResponse<CompleteRelayLegErrorResponse> {
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


function methodNotAllowed(): NextResponse<CompleteRelayLegErrorResponse> {
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
 * UUID VALIDATION
 * ============================================================
 */

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