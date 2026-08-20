// app/api/relay/artifact/materialize/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayCompletionModel,
} from '@/lib/relay/queries'

import type {
  RelayTeamId,
} from '@/lib/relay/types'

import {
  createServerClient,
} from '@/lib/supabase/server'


export const dynamic =
  'force-dynamic'

export const revalidate =
  0


/* ============================================================
 * REQUEST
 * ============================================================
 */

type MaterializeRelayArtifactRequest = {
  team_id:
    string
}


/* ============================================================
 * RPC RESULT
 * ============================================================
 *
 * Exact RPC contract:
 *
 * public.materialize_roam_relay_artifact(
 *   p_team_id uuid
 * )
 *
 * returns table (
 *   artifact_id uuid,
 *   public_flow_snapshot_id uuid,
 *   created boolean
 * )
 * ============================================================
 */

type MaterializeRelayArtifactRpcRow = {
  artifact_id:
    string

  public_flow_snapshot_id:
    string

  created:
    boolean
}


/* ============================================================
 * RESPONSE
 * ============================================================
 */

type MaterializeRelayArtifactSuccessResponse = {
  ok:
    true

  materialization: {
    created:
      boolean

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
    }

    publication: {
      materialized:
        true

      published:
        true

      publicFlowSnapshotId:
        string

      canReplay:
        true
    }
  }
}


type MaterializeRelayArtifactErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'materialization_rejected'
  | 'canonical_state_invalid'


type MaterializeRelayArtifactErrorResponse = {
  ok:
    false

  error: {
    code:
      MaterializeRelayArtifactErrorCode

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
    | MaterializeRelayArtifactSuccessResponse
    | MaterializeRelayArtifactErrorResponse
  >
> {
  /* ==========================================================
   * AUTHENTICATION
   * ==========================================================
   *
   * The RPC independently requires auth.uid() and validates
   * canonical joined-team access.
   *
   * Authenticate here as well so the HTTP boundary provides a
   * stable 401 response instead of exposing database errors.
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
      'You must be signed in to materialize a Relay artifact.'
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


  /* ==========================================================
   * ATOMIC MATERIALIZATION
   * ==========================================================
   *
   * Do NOT perform direct writes here to:
   *
   * - roam_relay_artifacts
   * - roam_relay_artifact_slots
   * - flow_snapshots
   * - flow_snapshot_stops
   *
   * The RPC owns the entire transaction:
   *
   * - joined-team authorization
   * - completed-team requirement
   * - team locking / concurrent serialization
   * - one artifact per team
   * - canonical completed-slot validation
   * - immutable artifact identity
   * - immutable public snapshot identity
   * - snapshot stops
   * - artifact slots
   * - authorship validation
   * - public_flow_snapshot_id attachment on initial INSERT
   * - retry idempotency
   * ========================================================== */

  try {
    const rpcResult =
      await supabase.rpc(
        'materialize_roam_relay_artifact',
        {
          p_team_id:
            teamId,
        }
      )


    if (
      rpcResult.error
    ) {
      console.error(
        '[api/relay/artifact/materialize] Canonical materialization RPC rejected.',
        {
          teamId,

          callerUserId:
            user.id,

          error: {
            code:
              rpcResult.error.code,

            message:
              rpcResult.error.message,

            details:
              rpcResult.error.details,

            hint:
              rpcResult.error.hint,
          },
        }
      )


      return jsonError(
        409,
        'materialization_rejected',
        'This Relay artifact cannot be materialized in its current state.'
      )
    }


    /* ========================================================
     * RPC RESULT CONTRACT
     * ========================================================
     *
     * Supabase TABLE-returning functions commonly return an
     * array. Normalize defensively without trusting arbitrary
     * payload shape.
     * ======================================================== */

    const materializationRow =
      resolveMaterializationRow(
        rpcResult.data
      )


    if (
      !materializationRow
    ) {
      console.error(
        '[api/relay/artifact/materialize] Materialization RPC returned an invalid payload.',
        {
          teamId,

          callerUserId:
            user.id,

          rpcData:
            rpcResult.data,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'Relay artifact materialization returned an invalid canonical result.'
      )
    }


    /* ========================================================
     * CANONICAL READ-BACK
     * ========================================================
     *
     * The RPC result identifies what was materialized.
     *
     * It is not treated as the complete UI/read model.
     *
     * Reload through getRelayCompletionModel() so the response
     * uses the same canonical artifact/publication projection as
     * the rest of Relay completion.
     * ======================================================== */

    const completionModel =
      await getRelayCompletionModel(
        teamId as RelayTeamId
      )


    if (
      !completionModel ||
      !completionModel.team ||
      !completionModel.relay
    ) {
      console.error(
        '[api/relay/artifact/materialize] Team disappeared from canonical completion read-back.',
        {
          teamId,

          callerUserId:
            user.id,

          artifactId:
            materializationRow.artifact_id,

          publicFlowSnapshotId:
            materializationRow.public_flow_snapshot_id,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay artifact was materialized but canonical completion state could not be resolved.'
      )
    }


    /* ========================================================
     * COMPLETED TEAM POSTCONDITION
     * ======================================================== */

    if (
      completionModel.team.status !==
      'completed'
    ) {
      console.error(
        '[api/relay/artifact/materialize] Materialized artifact resolved to a non-completed team.',
        {
          teamId,

          callerUserId:
            user.id,

          teamStatus:
            completionModel.team.status,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay artifact publication state is inconsistent.'
      )
    }


    /* ========================================================
     * CANONICAL ARTIFACT POSTCONDITION
     * ======================================================== */

    const artifact =
      completionModel.artifact


    if (
      !artifact
    ) {
      console.error(
        '[api/relay/artifact/materialize] RPC succeeded but canonical artifact is missing.',
        {
          teamId,

          callerUserId:
            user.id,

          artifactId:
            materializationRow.artifact_id,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay artifact was materialized but could not be resolved.'
      )
    }


    if (
      artifact.id !==
        materializationRow.artifact_id
    ) {
      console.error(
        '[api/relay/artifact/materialize] RPC artifact identity does not match canonical artifact identity.',
        {
          teamId,

          callerUserId:
            user.id,

          rpcArtifactId:
            materializationRow.artifact_id,

          canonicalArtifactId:
            artifact.id,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay artifact identity is inconsistent.'
      )
    }


    if (
      artifact.teamId !==
        teamId
    ) {
      console.error(
        '[api/relay/artifact/materialize] Canonical artifact belongs to an unexpected team.',
        {
          teamId,

          callerUserId:
            user.id,

          artifactId:
            artifact.id,

          artifactTeamId:
            artifact.teamId,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay artifact team association is inconsistent.'
      )
    }


    /* ========================================================
     * PUBLIC SNAPSHOT POSTCONDITION
     * ========================================================
     *
     * materialize_roam_relay_artifact() creates or resolves a
     * completed/public/replayable Relay snapshot.
     *
     * Therefore all of the following must agree:
     *
     * - RPC snapshot ID
     * - artifact.publicFlowSnapshotId
     * - artifact.canReplay
     * - completionModel.artifactPublished
     * ======================================================== */

    if (
      !artifact.publicFlowSnapshotId ||
      artifact.publicFlowSnapshotId !==
        materializationRow.public_flow_snapshot_id ||
      artifact.canReplay !==
        true ||
      completionModel.artifactPublished !==
        true
    ) {
      console.error(
        '[api/relay/artifact/materialize] Materialized Relay artifact does not resolve to canonical published replay state.',
        {
          teamId,

          callerUserId:
            user.id,

          artifactId:
            artifact.id,

          rpcPublicFlowSnapshotId:
            materializationRow.public_flow_snapshot_id,

          canonicalPublicFlowSnapshotId:
            artifact.publicFlowSnapshotId,

          canonicalCanReplay:
            artifact.canReplay,

          canonicalArtifactPublished:
            completionModel.artifactPublished,
        }
      )


      return jsonError(
        500,
        'canonical_state_invalid',
        'The Relay artifact publication state is inconsistent.'
      )
    }


    /* ========================================================
     * SUCCESS
     * ========================================================
     *
     * 201:
     *   this request performed first materialization
     *
     * 200:
     *   artifact already existed and the RPC returned the same
     *   immutable canonical artifact
     * ======================================================== */

    const response:
      MaterializeRelayArtifactSuccessResponse =
      {
        ok:
          true,

        materialization: {
          created:
            materializationRow.created,

          artifact: {
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
          },

          publication: {
            materialized:
              true,

            published:
              true,

            publicFlowSnapshotId:
              materializationRow.public_flow_snapshot_id,

            canReplay:
              true,
          },
        },
      }


    return NextResponse.json(
      response,
      {
        status:
          materializationRow.created
            ? 201
            : 200,

        headers:
          noStoreHeaders(),
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[api/relay/artifact/materialize] Unexpected canonical Relay artifact materialization failure.',
      {
        teamId,

        callerUserId:
          user.id,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      500,
      'canonical_state_invalid',
      'The Relay artifact could not be materialized.'
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
        MaterializeRelayArtifactRequest
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


  return {
    ok:
      true,

    value: {
      team_id:
        body.team_id,
    },
  }
}


/* ============================================================
 * RPC RESULT NORMALIZATION
 * ============================================================
 */

function resolveMaterializationRow(
  value:
    unknown
): MaterializeRelayArtifactRpcRow | null {
  const candidate =
    Array.isArray(
      value
    )
      ? value.length ===
          1
        ? value[0]
        : null
      : value


  if (
    !isRecord(
      candidate
    )
  ) {
    return null
  }


  const artifactId =
    candidate.artifact_id

  const publicFlowSnapshotId =
    candidate.public_flow_snapshot_id

  const created =
    candidate.created


  if (
    typeof artifactId !==
      'string' ||
    !isUuid(
      artifactId
    )
  ) {
    return null
  }


  if (
    typeof publicFlowSnapshotId !==
      'string' ||
    !isUuid(
      publicFlowSnapshotId
    )
  ) {
    return null
  }


  if (
    typeof created !==
      'boolean'
  ) {
    return null
  }


  return {
    artifact_id:
      artifactId,

    public_flow_snapshot_id:
      publicFlowSnapshotId,

    created,
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
    MaterializeRelayArtifactErrorCode,
  message:
    string
): NextResponse<MaterializeRelayArtifactErrorResponse> {
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


function methodNotAllowed(): NextResponse<MaterializeRelayArtifactErrorResponse> {
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
      'private, no-store, max-age=0',
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