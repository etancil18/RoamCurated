// app/api/relay/artifact/[artifactId]/route.ts

import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  getRelayArtifactReplayLookup,
} from '@/lib/relay/queries'


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
        artifactId:
          string
      }
    | Promise<{
        artifactId:
          string
      }>
}


/* ============================================================
 * RESPONSE TYPES
 * ============================================================
 */

type PublicRelayArtifactSlot = {
  id:
    string

  relaySlotId:
    string

  slotIndex:
    number

  contributorUserId:
    string

  venueId:
    string

  completedAt:
    string
}


type PublicRelayArtifactSuccessResponse = {
  ok:
    true

  artifact: {
    id:
      string

    relayId:
      string

    title:
      string

    city:
      string | null

    theme:
      string | null

    completedAt:
      string

    createdAt:
      string

    venueIds:
      string[]

    contributorUserIds:
      string[]

    slots:
      PublicRelayArtifactSlot[]

    replay: {
      snapshotId:
        string

      title:
        string | null

      city:
        string | null

      totalStops:
        number

      checkedInCount:
        number

      status:
        'completed'

      visibility:
        'public'

      replayable:
        true
    }
  }
}


type PublicRelayArtifactErrorCode =
  | 'invalid_artifact_id'
  | 'artifact_not_found'
  | 'artifact_read_failed'


type PublicRelayArtifactErrorResponse = {
  ok:
    false

  error: {
    code:
      PublicRelayArtifactErrorCode

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
    | PublicRelayArtifactSuccessResponse
    | PublicRelayArtifactErrorResponse
  >
> {
  /* ==========================================================
   * ARTIFACT ID
   * ========================================================== */

  const params =
    await context.params


  const artifactId =
    normalizeRequiredString(
      params.artifactId
    )


  if (
    !artifactId ||
    !isUuid(
      artifactId
    )
  ) {
    return jsonError(
      400,
      'invalid_artifact_id',
      'artifactId must be a valid UUID.'
    )
  }


  /* ==========================================================
   * CANONICAL PUBLIC REPLAY LOOKUP
   * ==========================================================
   *
   * This endpoint is intentionally public.
   *
   * Do NOT read:
   *
   * - roam_relay_teams
   * - roam_relay_team_members
   * - live Relay slot state
   * - private completion state
   *
   * getRelayArtifactReplayLookup() is expected to resolve:
   *
   *   artifact
   *   +
   *   completed/public/replayable Relay flow snapshot
   *
   * If either side is missing or invalid, return 404.
   * ========================================================== */

  try {
    const lookup =
      await getRelayArtifactReplayLookup(
        artifactId
      )


    if (
      !lookup ||
      !lookup.artifact ||
      !lookup.snapshot
    ) {
      return jsonError(
        404,
        'artifact_not_found',
        'Published Relay artifact not found.'
      )
    }


    const {
      artifact,
      snapshot,
    } =
      lookup


    /* ========================================================
     * PUBLICATION POSTCONDITIONS
     * ========================================================
     *
     * getRelayArtifactReplayLookup() should already enforce these,
     * but the route fails closed if the returned projection ever
     * drifts.
     * ======================================================== */

    if (
      artifact.publicFlowSnapshotId !==
        snapshot.id ||
      artifact.canReplay !==
        true
    ) {
      console.error(
        '[api/relay/artifact/[artifactId]] Artifact replay identity mismatch.',
        {
          artifactId,

          artifactPublicFlowSnapshotId:
            artifact.publicFlowSnapshotId,

          snapshotId:
            snapshot.id,

          artifactCanReplay:
            artifact.canReplay,
        }
      )


      return jsonError(
        404,
        'artifact_not_found',
        'Published Relay artifact not found.'
      )
    }


    if (
      snapshot.status !==
        'completed' ||
      snapshot.visibility !==
        'public' ||
      snapshot.replayable !==
        true
    ) {
      console.error(
        '[api/relay/artifact/[artifactId]] Snapshot is not canonically public/replayable.',
        {
          artifactId,

          snapshotId:
            snapshot.id,

          status:
            snapshot.status,

          visibility:
            snapshot.visibility,

          replayable:
            snapshot.replayable,
        }
      )


      return jsonError(
        404,
        'artifact_not_found',
        'Published Relay artifact not found.'
      )
    }


    /* ========================================================
     * ORDERED PUBLIC ARTIFACT ROUTE
     * ======================================================== */

    const orderedSlots =
      [
        ...artifact.slots,
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
        '[api/relay/artifact/[artifactId]] Published artifact has no immutable slots.',
        {
          artifactId,

          snapshotId:
            snapshot.id,
        }
      )


      return jsonError(
        404,
        'artifact_not_found',
        'Published Relay artifact not found.'
      )
    }


    const publicSlots:
      PublicRelayArtifactSlot[] =
      orderedSlots.map(
        (
          slot
        ) => ({
          id:
            slot.id,

          relaySlotId:
            slot.relaySlotId,

          slotIndex:
            slot.slotIndex,

          contributorUserId:
            slot.contributorUserId,

          venueId:
            slot.venueId,

          completedAt:
            slot.completedAt,
        })
      )


    /* ========================================================
     * PUBLIC RESPONSE
     * ========================================================
     *
     * Deliberately omit:
     *
     * - teamId
     * - teamSlotId
     * - flowSessionId
     * - checkedInAt
     *
     * Those are execution/provenance internals and are not
     * required to replay the public artifact.
     * ======================================================== */

    const response:
      PublicRelayArtifactSuccessResponse =
      {
        ok:
          true,

        artifact: {
          id:
            artifact.id,

          relayId:
            artifact.relayId,

          title:
            artifact.title,

          city:
            artifact.city,

          theme:
            artifact.theme,

          completedAt:
            artifact.completedAt,

          createdAt:
            artifact.createdAt,

          venueIds:
            artifact.venueIds,

          contributorUserIds:
            artifact.contributorUserIds,

          slots:
            publicSlots,

          replay: {
            snapshotId:
              snapshot.id,

            title:
              snapshot.title,

            city:
              snapshot.city,

            totalStops:
              snapshot.totalStops,

            checkedInCount:
              snapshot.checkedInCount,

            status:
              'completed',

            visibility:
              'public',

            replayable:
              true,
          },
        },
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
      '[api/relay/artifact/[artifactId]] Canonical public Relay artifact read failed.',
      {
        artifactId,

        error:
          serializeError(
            error
          ),
      }
    )


    return jsonError(
      500,
      'artifact_read_failed',
      'The published Relay artifact could not be loaded.'
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
    PublicRelayArtifactErrorCode,
  message:
    string
): NextResponse<PublicRelayArtifactErrorResponse> {
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


function methodNotAllowed(): NextResponse<PublicRelayArtifactErrorResponse> {
  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          'artifact_read_failed',

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
 * Artifact + snapshot rows are immutable/public once published.
 *
 * This endpoint can therefore be cached publicly.
 *
 * The modest s-maxage keeps CDN behavior conservative while
 * still avoiding repeated canonical reads for hot artifacts.
 * ============================================================
 */

function publicReadHeaders(): Record<
  string,
  string
> {
  return {
    'Cache-Control':
      'public, s-maxage=300, stale-while-revalidate=3600',
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