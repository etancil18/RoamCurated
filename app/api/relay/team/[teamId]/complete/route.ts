// app/api/relay/team/[teamId]/complete/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayCompletionModel,
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
 * ROUTE CONTEXT
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


/* ============================================================
 * RESPONSE TYPES
 * ============================================================
 */

type CompletedRelayRouteStop = {
  teamSlotId:
    string

  relaySlotId:
    string

  slotIndex:
    number

  contributorUserId:
    string | null

  status:
    'completed'

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


type RelayCompletionSuccessResponse = {
  ok:
    true

  completion: {
    relay: {
      id:
        string

      title:
        string

      city:
        string | null

      theme:
        string | null

      status:
        string
    }

    team: {
      id:
        string

      relayId:
        string

      status:
        'completed'

      completedAt:
        string | null
    }

    finalRoute:
      CompletedRelayRouteStop[]

    artifact: {
      id:
        string

      relayId:
        string

      teamId:
        string

      title:
        string

      city:
        string | null

      theme:
        string | null

      publicFlowSnapshotId:
        string | null

      completedAt:
        string | null

      createdAt:
        string

      canReplay:
        boolean
    } | null

    publication: {
      materialized:
        boolean

      published:
        boolean

      publicFlowSnapshotId:
        string | null

      canReplay:
        boolean
    }
  }
}


type RelayCompletionErrorCode =
  | 'unauthorized'
  | 'invalid_team_id'
  | 'team_not_found'
  | 'team_not_completed'
  | 'completion_state_invalid'
  | 'completion_read_failed'


type RelayCompletionErrorResponse = {
  ok:
    false

  error: {
    code:
      RelayCompletionErrorCode

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
    | RelayCompletionSuccessResponse
    | RelayCompletionErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * This endpoint is the private completed-team projection.
   *
   * Public artifact access belongs to the public artifact surface,
   * not this route.
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
      'You must be signed in to view Relay completion.'
    )
  }


  /* ==========================================================
   * TEAM ID
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
   * CANONICAL COMPLETION MODEL
   * ==========================================================
   *
   * Do NOT independently stitch:
   *
   * - roam_relays
   * - roam_relay_teams
   * - roam_relay_team_members
   * - roam_relay_team_slots
   * - roam_relay_artifacts
   * - roam_relay_artifact_slots
   * - flow_snapshots
   *
   * getRelayCompletionModel() is the canonical aggregate.
   * ========================================================== */

  try {
    const model =
      await getRelayCompletionModel(
        teamId as RelayTeamId
      )


    if (
      !model ||
      !model.team ||
      !model.relay
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
     * Only a canonical joined participant may access this
     * completed-team projection.
     *
     * Return 404 rather than exposing whether a private team ID
     * exists to unrelated authenticated users.
     * ======================================================== */

    const viewerMember =
      model.team.members.find(
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
        404,
        'team_not_found',
        'Relay team not found.'
      )
    }


    /* ========================================================
     * COMPLETED TEAM REQUIREMENT
     * ======================================================== */

    if (
      model.team.status !==
      'completed'
    ) {
      return jsonError(
        409,
        'team_not_completed',
        'This Relay team has not completed its route yet.'
      )
    }


    /* ========================================================
     * ORDERED FINAL ROUTE
     * ========================================================
     *
     * Completion is persisted state.
     *
     * slotIndex is used only for deterministic presentation
     * ordering after completion has already been established.
     * ======================================================== */

    const orderedSlots =
      [
        ...model.team.slots,
      ].sort(
        (
          left,
          right
        ) =>
          left.slotIndex -
          right.slotIndex
      )


    if (
      orderedSlots.length ===
      0
    ) {
      console.error(
        '[api/relay/team/[teamId]/complete] Completed Relay team has no canonical team slots.',
        {
          teamId,

          viewerUserId:
            user.id,
        }
      )


      return jsonError(
        500,
        'completion_state_invalid',
        'The Relay completion state is inconsistent.'
      )
    }


    const invalidSlots =
      orderedSlots.filter(
        (
          slot
        ) =>
          slot.status !==
          'completed'
      )


    if (
      invalidSlots.length >
      0
    ) {
      console.error(
        '[api/relay/team/[teamId]/complete] Completed Relay team contains non-completed slots.',
        {
          teamId,

          viewerUserId:
            user.id,

          invalidSlotCount:
            invalidSlots.length,

          invalidTeamSlotIds:
            invalidSlots.map(
              (
                slot
              ) =>
                slot.id
            ),
        }
      )


      return jsonError(
        500,
        'completion_state_invalid',
        'The Relay completion state is inconsistent.'
      )
    }


    const finalRoute:
      CompletedRelayRouteStop[] =
      orderedSlots.map(
        (
          slot
        ) => ({
          teamSlotId:
            slot.id,

          relaySlotId:
            slot.relaySlotId,

          slotIndex:
            slot.slotIndex,

          contributorUserId:
            slot.assignedUserId,

          status:
            'completed',

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
        })
      )


    /* ========================================================
     * ARTIFACT PUBLICATION
     * ========================================================
     *
     * Important distinction:
     *
     * artifact row exists
     *   !=
     * artifact is publicly replayable
     *
     * getRelayCompletionModel() already owns publication truth
     * through artifactPublished.
     * ======================================================== */

    const artifact =
      model.artifact


    const publication = {
      materialized:
        Boolean(
          artifact
        ),

      published:
        model.artifactPublished,

      publicFlowSnapshotId:
        artifact
          ?.publicFlowSnapshotId ??
        null,

      canReplay:
        artifact
          ?.canReplay ??
        false,
    }


    /* ========================================================
     * RESPONSE
     * ======================================================== */

    const response:
      RelayCompletionSuccessResponse =
      {
        ok:
          true,

        completion: {
          relay: {
            id:
              model.relay.id,

            title:
              model.relay.title,

            city:
              model.relay.city,

            theme:
              model.relay.theme,

            status:
              model.relay.status,
          },

          team: {
            id:
              model.team.id,

            relayId:
              model.team.relayId,

            status:
              'completed',

            completedAt:
              model.team.completedAt,
          },

          finalRoute,

          artifact:
            artifact
              ? {
                  id:
                    artifact.id,

                  relayId:
                    artifact.relayId,

                  teamId:
                    artifact.teamId,

                  title:
                    artifact.title,

                  city:
                    artifact.city,

                  theme:
                    artifact.theme,

                  publicFlowSnapshotId:
                    artifact.publicFlowSnapshotId,

                  completedAt:
                    artifact.completedAt,

                  createdAt:
                    artifact.createdAt,

                  canReplay:
                    artifact.canReplay,
                }
              : null,

          publication,
        },
      }


    return NextResponse.json(
      response,
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
      '[api/relay/team/[teamId]/complete] Canonical Relay completion read failed.',
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
      'completion_read_failed',
      'The Relay completion state could not be loaded.'
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
 * RESPONSE HELPERS
 * ============================================================
 */

function jsonError(
  status:
    number,
  code:
    RelayCompletionErrorCode,
  message:
    string
): NextResponse<RelayCompletionErrorResponse> {
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


function methodNotAllowed(): NextResponse<RelayCompletionErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'completion_read_failed',

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