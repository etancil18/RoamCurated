// app/api/relay/team/[teamId]/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayTeamPageModel,
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


type RelayTeamReadSuccessResponse = {
  ok:
    true

  data:
    Awaited<
      ReturnType<
        typeof getRelayTeamPageModel
      >
    >
}


type RelayTeamReadErrorCode =
  | 'unauthorized'
  | 'invalid_team_id'
  | 'team_not_found'
  | 'team_read_failed'


type RelayTeamReadErrorResponse = {
  ok:
    false

  error: {
    code:
      RelayTeamReadErrorCode

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
    | RelayTeamReadSuccessResponse
    | RelayTeamReadErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * This is an authenticated private team-hub endpoint.
   *
   * Never allow the client to provide viewer_user_id.
   * Viewer identity comes exclusively from Supabase auth.
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
      'You must be signed in to view this Relay team.'
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
   * CANONICAL PRIVATE TEAM READ
   * ==========================================================
   *
   * Do NOT independently query:
   *
   * - roam_relay_teams
   * - roam_relay_team_members
   * - roam_relay_team_slots
   * - roam_relay_slots
   * - roam_relays
   *
   * and then stitch them together here.
   *
   * getRelayTeamPageModel() is the canonical private projection
   * for the team hub and is responsible for assembling:
   *
   * - team
   * - Relay
   * - roster
   * - assignments
   * - baton
   * - readiness
   * - viewer-specific state / permissions
   *
   * Viewer identity is derived exclusively from auth.
   * ========================================================== */

  try {
    const model =
      await getRelayTeamPageModel(
        teamId as RelayTeamId,
        user.id as UserId
      )


    /*
     * Treat inaccessible/missing private state identically.
     *
     * This avoids turning the endpoint into a team-ID enumeration
     * oracle for authenticated users.
     */
    if (
      !model
    ) {
      return jsonError(
        404,
        'team_not_found',
        'Relay team not found.'
      )
    }


    /*
     * Return the query model intact.
     *
     * Do not remap or independently recompute readiness, baton,
     * assignments, or viewer permissions in the route. That
     * creates a second presentation contract that can drift from
     * getRelayTeamPageModel().
     */
    return NextResponse.json(
      {
        ok:
          true,

        data:
          model,
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
      '[api/relay/team/[teamId]] Canonical Relay team read failed.',
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
      'team_read_failed',
      'The Relay team could not be loaded.'
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
    RelayTeamReadErrorCode,
  message:
    string
): NextResponse<RelayTeamReadErrorResponse> {
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


function methodNotAllowed(): NextResponse<RelayTeamReadErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'team_read_failed',

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
 * ============================================================
 *
 * Deliberately accepts canonical UUID syntax without restricting
 * the UUID version nibble.
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