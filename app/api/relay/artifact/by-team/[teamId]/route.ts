// app/api/relay/artifact/by-team/[teamId]/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getCompletedRelayArtifactByTeam,
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

type RelayArtifactByTeamSuccessResponse = {
  ok:
    true

  lookup: {
    teamId:
      string

    hasArtifact:
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


type RelayArtifactByTeamErrorCode =
  | 'unauthorized'
  | 'invalid_team_id'
  | 'team_not_found'
  | 'artifact_lookup_failed'


type RelayArtifactByTeamErrorResponse = {
  ok:
    false

  error: {
    code:
      RelayArtifactByTeamErrorCode

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
    | RelayArtifactByTeamSuccessResponse
    | RelayArtifactByTeamErrorResponse
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
      'You must be signed in to view Relay artifact state.'
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


  try {
    /* ========================================================
     * PRIVATE TEAM ACCESS
     * ========================================================
     *
     * This endpoint answers a private question:
     *
     *   "Does this completed team already have an artifact?"
     *
     * Do not let arbitrary authenticated users probe team IDs.
     *
     * Resolve the canonical team first and require the viewer to
     * be a joined team participant.
     * ======================================================== */

    const team =
      await getRelayTeam(
        teamId as RelayTeamId
      )


    if (!team) {
      return jsonError(
        404,
        'team_not_found',
        'Relay team not found.'
      )
    }


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


    if (!viewerMember) {
      /*
       * Fail closed with the same 404 as a missing team so this
       * endpoint does not become a private team-ID enumeration
       * oracle.
       */
      return jsonError(
        404,
        'team_not_found',
        'Relay team not found.'
      )
    }


    /* ========================================================
     * CANONICAL ARTIFACT LOOKUP
     * ========================================================
     *
     * Do NOT infer artifact existence from:
     *
     * - team.status
     * - completed_at
     * - public_flow_snapshot_id
     * - raw table counts
     *
     * getCompletedRelayArtifactByTeam() is the canonical lookup.
     * ======================================================== */

    const artifact =
      await getCompletedRelayArtifactByTeam(
        teamId as RelayTeamId
      )


    /* ========================================================
     * CANONICAL CONSISTENCY
     * ======================================================== */

    if (
      artifact &&
      artifact.teamId !==
        team.id
    ) {
      console.error(
        '[api/relay/artifact/by-team/[teamId]] Canonical artifact resolved to an unexpected team.',
        {
          requestedTeamId:
            teamId,

          canonicalTeamId:
            team.id,

          artifactId:
            artifact.id,

          artifactTeamId:
            artifact.teamId,

          viewerUserId:
            user.id,
        }
      )


      return jsonError(
        500,
        'artifact_lookup_failed',
        'The Relay artifact state is inconsistent.'
      )
    }


    /* ========================================================
     * PUBLICATION STATE
     * ========================================================
     *
     * Artifact materialization and public replay publication are
     * distinct concepts.
     *
     * The artifact mapper already exposes canReplay from the
     * canonical snapshot relationship.
     * ======================================================== */

    const publicFlowSnapshotId =
      artifact
        ?.publicFlowSnapshotId ??
      null


    const canReplay =
      artifact
        ?.canReplay ??
      false


    const published =
      Boolean(
        artifact &&
        publicFlowSnapshotId &&
        canReplay
      )


    /* ========================================================
     * RESPONSE
     * ======================================================== */

    const response:
      RelayArtifactByTeamSuccessResponse =
      {
        ok:
          true,

        lookup: {
          teamId:
            team.id,

          hasArtifact:
            Boolean(
              artifact
            ),

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

          publication: {
            materialized:
              Boolean(
                artifact
              ),

            published,

            publicFlowSnapshotId,

            canReplay,
          },
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
      '[api/relay/artifact/by-team/[teamId]] Canonical Relay artifact lookup failed.',
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
      'artifact_lookup_failed',
      'The Relay artifact state could not be loaded.'
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
    RelayArtifactByTeamErrorCode,
  message:
    string
): NextResponse<RelayArtifactByTeamErrorResponse> {
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


function methodNotAllowed(): NextResponse<RelayArtifactByTeamErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'artifact_lookup_failed',

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