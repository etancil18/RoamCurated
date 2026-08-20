// app/api/relay/team/[teamId]/execution/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayTeam,
} from '@/lib/relay/queries'

import type {
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

type RouteContext = {
  params:
    | {
        teamId:
          string
      }
    | Promise<{
        teamId:
          string
      }>
}


type ExecutionSlotProjection = {
  teamSlotId:
    string

  relaySlotId:
    string

  slotIndex:
    number

  assignedUserId:
    string | null

  status:
    'locked'
    | 'active'
    | 'completed'
    | 'skipped'

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


type RelayExecutionSuccessResponse = {
  ok:
    true

  execution: {
    team: {
      id:
        string

      relayId:
        string

      status:
        string
    }

    activeSlot:
      ExecutionSlotProjection | null

    batonHolder: {
      userId:
        string

      teamSlotId:
        string

      relaySlotId:
        string

      slotIndex:
        number
    } | null

    viewerAssignment:
      ExecutionSlotProjection | null

    completedLegs:
      ExecutionSlotProjection[]

    lockedLegs:
      ExecutionSlotProjection[]
  }
}


type RelayExecutionErrorCode =
  | 'unauthorized'
  | 'invalid_team_id'
  | 'team_not_found'
  | 'forbidden'
  | 'execution_state_invalid'
  | 'execution_read_failed'


type RelayExecutionErrorResponse = {
  ok:
    false

  error: {
    code:
      RelayExecutionErrorCode

    message:
      string
  }
}


/* ============================================================
 * GET
 * ============================================================
 */

export async function GET(
  _request:
    Request,
  context:
    RouteContext
): Promise<
  NextResponse<
    | RelayExecutionSuccessResponse
    | RelayExecutionErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
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
      'You must be signed in to view Relay execution.'
    )
  }


  /* ==========================================================
   * ROUTE PARAMETER
   * ========================================================== */

  const params =
    await context.params


  const teamId =
    normalizeRequiredString(
      params.teamId
    )


  if (
    !teamId ||
    !isUuid(
      teamId
    )
  ) {
    return jsonError(
      400,
      'invalid_team_id',
      'teamId must be a valid UUID.'
    )
  }


  /* ==========================================================
   * CANONICAL TEAM READ
   * ==========================================================
   *
   * This endpoint is read-only.
   *
   * It never:
   *
   * - starts a leg
   * - performs check-in
   * - completes a leg
   * - advances the baton
   * - mutates slot status
   *
   * Execution state comes exclusively from canonical persisted
   * Relay team-slot state.
   * ========================================================== */

  try {
    const team =
      await getRelayTeam(
        teamId as RelayTeamId
      )


    if (
      !team
    ) {
      return jsonError(
        404,
        'team_not_found',
        'Relay team not found.'
      )
    }


    /* ========================================================
     * PRIVATE TEAM ACCESS
     * ========================================================
     *
     * Execution is private team state.
     *
     * Require the authenticated viewer to be a canonical joined
     * participant. Do not accept viewer identity from the client.
     * ======================================================== */

    const viewerMember =
      team.members.find(
        (
          member
        ) =>
          member.userId ===
            (user.id as UserId) &&
          member.memberStatus ===
            'joined'
      ) ??
      null


    if (
      !viewerMember
    ) {
      return jsonError(
        403,
        'forbidden',
        'You do not have access to this Relay team execution.'
      )
    }


    /* ========================================================
     * CANONICAL ACTIVE BATON
     * ========================================================
     *
     * Never infer the active leg from ordering.
     *
     * Persisted slot.status = "active" is authoritative.
     * ======================================================== */

    const activeSlots =
      team.slots.filter(
        (
          slot
        ) =>
          slot.status ===
          'active'
      )


    /*
     * Once a team is active, exactly one persisted baton slot
     * must be active.
     */
    if (
      team.status ===
        'active' &&
      activeSlots.length !==
        1
    ) {
      console.error(
        '[api/relay/team/[teamId]/execution] Active Relay team has invalid canonical baton state.',
        {
          teamId,

          viewerUserId:
            user.id,

          activeSlotCount:
            activeSlots.length,
        }
      )


      return jsonError(
        500,
        'execution_state_invalid',
        'The Relay execution state is inconsistent.'
      )
    }


    /*
     * Non-active teams must not expose multiple active slots
     * either. One would also be invalid because activation belongs
     * to the active lifecycle.
     */
    if (
      team.status !==
        'active' &&
      activeSlots.length >
        0
    ) {
      console.error(
        '[api/relay/team/[teamId]/execution] Non-active Relay team contains an active baton slot.',
        {
          teamId,

          viewerUserId:
            user.id,

          teamStatus:
            team.status,

          activeSlotCount:
            activeSlots.length,
        }
      )


      return jsonError(
        500,
        'execution_state_invalid',
        'The Relay execution state is inconsistent.'
      )
    }


    const activeSlot =
      activeSlots[0] ??
      null


    if (
      activeSlot &&
      !activeSlot.assignedUserId
    ) {
      console.error(
        '[api/relay/team/[teamId]/execution] Active baton slot has no assigned contributor.',
        {
          teamId,

          viewerUserId:
            user.id,

          teamSlotId:
            activeSlot.id,
        }
      )


      return jsonError(
        500,
        'execution_state_invalid',
        'The active Relay baton has no assigned contributor.'
      )
    }


    /* ========================================================
     * VIEWER ASSIGNMENT
     * ========================================================
     *
     * Relay requires one slot per contributor.
     *
     * Detect impossible canonical duplicate assignment rather
     * than silently picking one.
     * ======================================================== */

    const viewerSlots =
      team.slots.filter(
        (
          slot
        ) =>
          slot.assignedUserId ===
          user.id
      )


    if (
      viewerSlots.length >
      1
    ) {
      console.error(
        '[api/relay/team/[teamId]/execution] Viewer owns multiple canonical Relay slots.',
        {
          teamId,

          viewerUserId:
            user.id,

          viewerSlotCount:
            viewerSlots.length,
        }
      )


      return jsonError(
        500,
        'execution_state_invalid',
        'The Relay assignment state is inconsistent.'
      )
    }


    const viewerSlot =
      viewerSlots[0] ??
      null


    /* ========================================================
     * EXECUTION PROJECTIONS
     * ======================================================== */

    const canonicalActiveSlot =
      activeSlot
        ? projectSlot(
            activeSlot
          )
        : null


    const viewerAssignment =
      viewerSlot
        ? projectSlot(
            viewerSlot
          )
        : null


    const completedLegs =
      team.slots
        .filter(
          (
            slot
          ) =>
            slot.status ===
            'completed'
        )
        .sort(
          (
            a,
            b
          ) =>
            a.slotIndex -
            b.slotIndex
        )
        .map(
          projectSlot
        )


    const lockedLegs =
      team.slots
        .filter(
          (
            slot
          ) =>
            slot.status ===
            'locked'
        )
        .sort(
          (
            a,
            b
          ) =>
            a.slotIndex -
            b.slotIndex
        )
        .map(
          projectSlot
        )


    const batonHolder =
      (
        activeSlot &&
        activeSlot.assignedUserId
      )
        ? {
            userId:
              activeSlot.assignedUserId,

            teamSlotId:
              activeSlot.id,

            relaySlotId:
              activeSlot.relaySlotId,

            slotIndex:
              activeSlot.slotIndex,
          }
        : null


    return NextResponse.json(
      {
        ok:
          true,

        execution: {
          team: {
            id:
              team.id,

            relayId:
              team.relayId,

            status:
              team.status,
          },

          activeSlot:
            canonicalActiveSlot,

          batonHolder,

          viewerAssignment,

          completedLegs,

          lockedLegs,
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
    console.error(
      '[api/relay/team/[teamId]/execution] Canonical Relay execution read failed.',
      {
        teamId,

        viewerUserId:
          user.id,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      500,
      'execution_read_failed',
      'The Relay execution state could not be loaded.'
    )
  }
}


/* ============================================================
 * METHOD GUARDS
 * ============================================================
 */

export function POST() {
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
 * SLOT PROJECTION
 * ============================================================
 */

function projectSlot(
  slot: {
    id:
      string

    relaySlotId:
      string

    slotIndex:
      number

    assignedUserId:
      string | null

    status:
      'locked'
      | 'active'
      | 'completed'
      | 'skipped'

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
): ExecutionSlotProjection {
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
 * ============================================================ */

function jsonError(
  status:
    number,
  code:
    RelayExecutionErrorCode,
  message:
    string
): NextResponse<RelayExecutionErrorResponse> {
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


function methodNotAllowed(): NextResponse<RelayExecutionErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'execution_read_failed',

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
          'GET',
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
      'private, no-store, max-age=0',
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