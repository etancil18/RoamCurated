// app/api/relay/[relayId]/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayPublicDetail,
} from '@/lib/relay/queries'

import type {
  RelayId,
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
        relayId:
          string
      }
    | Promise<{
        relayId:
          string
      }>
}


/* ============================================================
 * RESPONSE TYPES
 * ============================================================
 *
 * Deliberately do not duplicate the return type of
 * getRelayPublicDetail() here.
 *
 * The query already owns the canonical aggregate containing:
 *
 *   - Relay definition
 *   - reward policy
 *   - public team counts
 *   - viewer team state when viewerUserId is supplied
 *
 * ReturnType keeps this API contract synchronized with the
 * canonical query instead of maintaining a second hand-written
 * copy.
 * ============================================================
 */

type RelayPublicDetail =
  Awaited<
    ReturnType<
      typeof getRelayPublicDetail
    >
  >


type NonNullableRelayPublicDetail =
  NonNullable<
    RelayPublicDetail
  >


type RelayPublicDetailSuccessResponse = {
  ok:
    true

  authenticated:
    boolean

  detail:
    NonNullableRelayPublicDetail
}


type RelayPublicDetailErrorCode =
  | 'invalid_relay_id'
  | 'relay_not_found'
  | 'relay_read_failed'


type RelayPublicDetailErrorResponse = {
  ok:
    false

  error: {
    code:
      RelayPublicDetailErrorCode

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
    | RelayPublicDetailSuccessResponse
    | RelayPublicDetailErrorResponse
  >
> {
  /* ==========================================================
   * RELAY ID
   * ========================================================== */

  const params =
    await context.params


  const relayId =
    normalizeRequiredString(
      params.relayId
    )


  if (
    !relayId ||
    !isUuid(
      relayId
    )
  ) {
    return jsonError(
      400,
      'invalid_relay_id',
      'relayId must be a valid UUID.'
    )
  }


  /* ==========================================================
   * OPTIONAL AUTHENTICATION
   * ==========================================================
   *
   * This is a public endpoint.
   *
   * Authentication enriches the response with viewer-specific
   * Relay team state; it is not required to read public Relay
   * definition/reward/count information.
   *
   * A missing/expired session therefore degrades to anonymous
   * public access rather than turning this route into a private
   * endpoint.
   * ========================================================== */

  const supabase =
    await createServerClient()


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  const viewerUserId =
    user
      ? user.id as UserId
      : undefined


  /* ==========================================================
   * CANONICAL PUBLIC DETAIL
   * ==========================================================
   *
   * Do NOT independently query:
   *
   * - roam_relays
   * - roam_relay_slots
   * - roam_relay_teams
   * - roam_relay_team_members
   * - competitions
   * - reward policy tables
   *
   * getRelayPublicDetail() owns the public Relay aggregate and
   * viewer enrichment.
   * ========================================================== */

  try {
    const detail =
      await getRelayPublicDetail(
        relayId as RelayId,
        viewerUserId
      )


    if (!detail) {
      return jsonError(
        404,
        'relay_not_found',
        'Relay not found.'
      )
    }


    /* ========================================================
     * RESPONSE
     * ========================================================
     *
     * Keep the aggregate structurally identical to the canonical
     * query result.
     *
     * This ensures any exact Relay definition/reward/team-count/
     * viewer-state contract already established in queries.ts
     * remains authoritative.
     * ======================================================== */

    const response:
      RelayPublicDetailSuccessResponse =
      {
        ok:
          true,

        authenticated:
          Boolean(
            viewerUserId
          ),

        detail,
      }


    return NextResponse.json(
      response,
      {
        status:
          200,

        headers:
          viewerAwareHeaders(),
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[api/relay/[relayId]] Canonical Relay public-detail read failed.',
      {
        relayId,

        viewerUserId:
          viewerUserId ??
          null,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      500,
      'relay_read_failed',
      'The Relay could not be loaded.'
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
    RelayPublicDetailErrorCode,
  message:
    string
): NextResponse<RelayPublicDetailErrorResponse> {
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


function methodNotAllowed(): NextResponse<RelayPublicDetailErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'relay_read_failed',

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


/* ============================================================
 * CACHE / VIEWER ISOLATION
 * ============================================================
 *
 * The endpoint is public but may become viewer-specific whenever
 * an authenticated session is present.
 *
 * Do not allow an authenticated response containing viewer team
 * state to be served to another user from a shared cache.
 * ============================================================
 */

function viewerAwareHeaders(): Record<
  string,
  string
> {
  return {
    'Cache-Control':
      'private, no-store, max-age=0',

    Vary:
      'Cookie',
  }
}


function noStoreHeaders(): Record<
  string,
  string
> {
  return {
    'Cache-Control':
      'no-store, max-age=0',

    Vary:
      'Cookie',
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