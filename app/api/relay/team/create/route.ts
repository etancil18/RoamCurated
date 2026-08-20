// app/api/relay/team/create/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  createRelayTeam,
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

type CreateRelayTeamRequest = {
  relayId:
    string
}


type CreateRelayTeamSuccessResponse = {
  ok:
    true

  team: {
    id:
      string

    relayId:
      string

    captainUserId:
      string

    status:
      string
  }
}


type CreateRelayTeamErrorResponse = {
  ok:
    false

  error: {
    code:
      | 'unauthorized'
      | 'invalid_request'
      | 'team_creation_failed'

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
    | CreateRelayTeamSuccessResponse
    | CreateRelayTeamErrorResponse
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
    return NextResponse.json(
      {
        ok:
          false,

        error: {
          code:
            'unauthorized',

          message:
            'You must be signed in to create a Relay team.',
        },
      },
      {
        status:
          401,
      }
    )
  }


  /* ==========================================================
   * INPUT
   * ========================================================== */

  const bodyResult =
    await readJsonBody(
      request
    )


  if (
    !bodyResult.ok
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error: {
          code:
            'invalid_request',

          message:
            bodyResult.message,
        },
      },
      {
        status:
          400,
      }
    )
  }


  const relayId =
    normalizeRequiredString(
      bodyResult.value.relayId
    )


  if (
    !relayId
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error: {
          code:
            'invalid_request',

          message:
            'relayId is required.',
        },
      },
      {
        status:
          400,
      }
    )
  }


  /* ==========================================================
   * CANONICAL TEAM CREATION
   * ==========================================================
   *
   * Do not insert into:
   *
   * - roam_relay_teams
   * - roam_relay_team_members
   * - roam_relay_team_slots
   *
   * from this route.
   *
   * createRelayTeam() is the canonical server abstraction and
   * remains responsible for calling the authoritative database
   * mutation / RPC.
   * ========================================================== */

  try {
    const result =
      await createRelayTeam(
        relayId
      )


    if (
      !result.team ||
      !result.team.id
    ) {
      console.error(
        '[api/relay/team/create] Canonical team creation returned no team.',
        {
          relayId,

          userId:
            user.id,
        }
      )


      return NextResponse.json(
        {
          ok:
            false,

          error: {
            code:
              'team_creation_failed',

            message:
              'The Relay team could not be created.',
          },
        },
        {
          status:
            500,
        }
      )
    }


    /*
     * Return only the fields needed to route the caller into the
     * canonical team experience.
     *
     * Do not expose nested membership, readiness, baton, or other
     * mutable server state unnecessarily from a creation endpoint.
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

          captainUserId:
            result.team.captainUserId,

          status:
            result.team.status,
        },
      },
      {
        status:
          201,

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[api/relay/team/create] Canonical team creation failed.',
      {
        relayId,

        userId:
          user.id,

        error:
          serializeError(
            error
          ),
      }
    )


    /*
     * Do not leak database/RPC error text to the browser.
     *
     * The canonical mutation is authoritative for lifecycle,
     * duplicate-team, eligibility, capacity, and other invariants.
     * Those failures are logged server-side while the public API
     * returns a stable contract.
     */
    return NextResponse.json(
      {
        ok:
          false,

        error: {
          code:
            'team_creation_failed',

          message:
            'The Relay team could not be created.',
        },
      },
      {
        status:
          409,

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
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

async function readJsonBody(
  request:
    Request
): Promise<
  | {
      ok:
        true

      value:
        CreateRelayTeamRequest
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


  let value:
    unknown


  try {
    value =
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
      value
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
    typeof value.relayId !==
      'string'
  ) {
    return {
      ok:
        false,

      message:
        'relayId must be a string.',
    }
  }


  return {
    ok:
      true,

    value: {
      relayId:
        value.relayId,
    },
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
 * RESPONSE HELPERS
 * ============================================================
 */

function methodNotAllowed(): NextResponse<CreateRelayTeamErrorResponse> {
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
        Allow:
          'POST',

        'Cache-Control':
          'no-store',
      },
    }
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