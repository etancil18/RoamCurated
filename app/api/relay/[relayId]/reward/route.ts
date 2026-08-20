// app/api/relay/[relayId]/reward/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayRewardPolicyDisplay,
} from '@/lib/relay/queries'

import type {
  RelayId,
} from '@/lib/relay/types'


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
 * CANONICAL QUERY TYPE
 * ============================================================
 *
 * Do not duplicate or manually reconstruct the reward-policy
 * return shape here.
 *
 * The query is the canonical display model.
 * ============================================================
 */

type RelayRewardPolicyDisplay =
  Awaited<
    ReturnType<
      typeof getRelayRewardPolicyDisplay
    >
  >


type NonNullableRelayRewardPolicyDisplay =
  NonNullable<
    RelayRewardPolicyDisplay
  >


/* ============================================================
 * RESPONSE TYPES
 * ============================================================
 */

type RelayRewardSuccessResponse = {
  ok:
    true

  reward:
    NonNullableRelayRewardPolicyDisplay
}


type RelayRewardErrorCode =
  | 'invalid_relay_id'
  | 'reward_not_found'
  | 'reward_read_failed'


type RelayRewardErrorResponse = {
  ok:
    false

  error: {
    code:
      RelayRewardErrorCode

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
    | RelayRewardSuccessResponse
    | RelayRewardErrorResponse
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
   * CANONICAL REWARD DISPLAY
   * ==========================================================
   *
   * This route is intentionally public and read-only.
   *
   * Do NOT independently query:
   *
   * - competitions
   * - relay reward mode columns
   * - XP reward columns
   * - partner campaign tables
   *
   * getRelayRewardPolicyDisplay() owns the canonical reward
   * presentation model.
   * ========================================================== */

  try {
    const reward =
      await getRelayRewardPolicyDisplay(
        relayId as RelayId
      )


    if (
      !reward
    ) {
      return jsonError(
        404,
        'reward_not_found',
        'Relay reward policy not found.'
      )
    }


    const response:
      RelayRewardSuccessResponse =
      {
        ok:
          true,

        reward,
      }


    return NextResponse.json(
      response,
      {
        status:
          200,

        headers:
          publicReadHeaders(),
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[api/relay/[relayId]/reward] Canonical Relay reward-policy read failed.',
      {
        relayId,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      500,
      'reward_read_failed',
      'The Relay reward policy could not be loaded.'
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
    RelayRewardErrorCode,
  message:
    string
): NextResponse<RelayRewardErrorResponse> {
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
        status ===
          404
          ? publicNotFoundHeaders()
          : noStoreHeaders(),
    }
  )
}


function methodNotAllowed(): NextResponse<RelayRewardErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'reward_read_failed',

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
 * CACHE HEADERS
 * ============================================================
 *
 * Reward presentation is public and viewer-independent.
 *
 * Unlike /api/relay/[relayId], this endpoint does not include
 * authenticated viewer team state, so shared caching is safe.
 * ============================================================
 */

function publicReadHeaders(): Record<
  string,
  string
> {
  return {
    'Cache-Control':
      'public, s-maxage=300, stale-while-revalidate=1800',
  }
}


function publicNotFoundHeaders(): Record<
  string,
  string
> {
  return {
    'Cache-Control':
      'public, max-age=0, s-maxage=30',
  }
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