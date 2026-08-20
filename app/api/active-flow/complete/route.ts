import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'
import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'

import {
  safelyReconcileCompetitionParticipation,
} from '@/lib/competitions/participation'

type CompleteActiveFlowBody = {
  session_id?: string
}

type CreatorReplayCompletionAttributionRow = {
  attributed: boolean
  event_id: string | null
  creator_user_id: string
  replay_user_id: string
  snapshot_id: string
  session_id: string
  occurred_at: string | null
}

type CompetitionSubmissionCandidate = {
  submissionSource: 'active_flow'
  flowSessionId: string

  venueIds: string[]

  routeTitle: string | null
  routeCity: string | null

  routeStartedAt: string | null
  routeCompletedAt: string | null

  verifiedVenueCount: number
  totalVenueCount: number

  eligibleForCompetitionSubmission: boolean
}

function getCompletionBonus(
  source: string | null | undefined
) {
  if (
    source === 'property_guide' ||
    source === 'property_crawl'
  ) {
    return 150
  }

  if (
    source === 'property_event_journey' ||
    source === 'event_journey'
  ) {
    return 125
  }

  return 100
}

function getBadgeUnlocked(
  source: string | null | undefined
) {
  if (
    source === 'property_guide' ||
    source === 'property_crawl'
  ) {
    return 'Stay Explorer'
  }

  if (
    source === 'property_event_journey' ||
    source === 'event_journey'
  ) {
    return 'Event Explorer'
  }

  return 'Flow Finisher'
}

function buildCompetitionSubmissionCandidate({
  sessionId,
  venueIds,
  title,
  city,
  startedAt,
  completedAt,
  verifiedVenueCount,
}: {
  sessionId: string
  venueIds: string[]
  title: string | null | undefined
  city: string | null | undefined
  startedAt: string | null | undefined
  completedAt: string | null | undefined
  verifiedVenueCount: number
}): CompetitionSubmissionCandidate {
  return {
    submissionSource:
      'active_flow',

    flowSessionId:
      sessionId,

    venueIds,

    routeTitle:
      title ?? null,

    routeCity:
      city ?? null,

    routeStartedAt:
      startedAt ?? null,

    routeCompletedAt:
      completedAt ?? null,

    verifiedVenueCount,

    totalVenueCount:
      venueIds.length,

    /**
     * Competition submissions require at least 3 venues.
     *
     * This is informational only.
     * The competition submission API remains responsible for
     * authoritative validation before creating a submission.
     */
    eligibleForCompetitionSubmission:
      venueIds.length >= 3 &&
      verifiedVenueCount >= 3 &&
      Boolean(completedAt),
  }
}

async function refreshPublicPassportStats(
  userId: string
) {
  try {
    await rebuildPublicPassportStats(
      userId
    )
  } catch (error) {
    console.error(
      '[active-flow/complete] Failed to rebuild public Passport stats:',
      error
    )
  }
}

/**
 * Relay baton completion:
 *
 * Relay team-slot Active Flows remain ordinary one-stop Active
 * Flows for physical execution.
 *
 * Once the Flow itself is canonically completed, delegate the
 * Relay slot transition to the existing hardened database RPC.
 *
 * The RPC independently verifies:
 *
 *   - active baton ownership
 *   - Relay venue constraints
 *   - canonical Flow provenance
 *   - completed Flow evidence
 *   - geo-verified check-in evidence
 *   - sequential baton integrity
 *
 * It then completes the current Relay slot and either activates
 * the next baton or completes the team.
 *
 * The RPC is idempotent for the same completed evidence, so this
 * helper is also safe in the already-completed repair path.
 */
async function completeRelaySlotFromActiveFlow({
  supabase,
  sessionId,
  source,
  sourceId,
  venueIds,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  sessionId: string
  source: unknown
  sourceId: unknown
  venueIds: unknown
}): Promise<void> {
  if (
    source !==
    'roam_relay_team_slot'
  ) {
    return
  }

  const normalizedSourceId =
    typeof sourceId ===
      'string'
      ? sourceId.trim()
      : ''

  const normalizedVenueIds =
    Array.isArray(
      venueIds
    )
      ? venueIds.filter(
          (
            venueId
          ): venueId is string =>
            typeof venueId ===
              'string' &&
            venueId.trim().length >
              0
        )
      : []

  if (
    !normalizedSourceId ||
    normalizedVenueIds.length !==
      1
  ) {
    throw new Error(
      '[active-flow/complete] Relay team-slot Flow has invalid canonical provenance.'
    )
  }

  const {
    error,
  } = await supabase.rpc(
    'complete_roam_relay_slot',
    {
      p_team_slot_id:
        normalizedSourceId,

      p_venue_id:
        normalizedVenueIds[0],

      p_flow_session_id:
        sessionId,
    }
  )

  if (error) {
    console.error(
      '[active-flow/complete] Relay slot completion failed:',
      {
        sessionId,
        teamSlotId:
          normalizedSourceId,
        venueId:
          normalizedVenueIds[0],
        error,
      }
    )

    throw new Error(
      '[active-flow/complete] Relay slot completion failed.'
    )
  }
}

/**
 * Creator replay attribution:
 *
 * Record creator completion credit only through the hardened
 * canonical Postgres RPC.
 *
 * The application supplies only the replay session ID.
 *
 * Creator identity, replay user identity, snapshot identity,
 * public/replayable eligibility, completed-session evidence,
 * immutable route evidence, verified stop completion, and
 * self-replay suppression are all resolved and enforced by
 * the database function.
 *
 * Attribution is deliberately non-fatal relative to the user's
 * already-successful Flow completion. A temporary attribution
 * failure must never roll back genuine user progress.
 *
 * The RPC is idempotent, so it is also safe to call when an
 * already-completed session reaches this endpoint again. That
 * gives previously missed attribution a repair path without
 * issuing duplicate creator credit.
 */
async function recordCreatorReplayCompletionAttribution({
  supabase,
  sessionId,
  source,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  sessionId: string
  source: unknown
}): Promise<
  CreatorReplayCompletionAttributionRow | null
> {
  if (
    source !==
    'flow_snapshot'
  ) {
    return null
  }

  try {
    const {
      data,
      error,
    } = await supabase.rpc(
      'record_creator_replay_completion',
      {
        p_session_id:
          sessionId,
      }
    )

    if (error) {
      console.error(
        '[active-flow/complete] Creator replay completion attribution failed:',
        {
          sessionId,
          error,
        }
      )

      return null
    }

    const row =
      Array.isArray(data)
        ? data[0]
        : data

    if (
      !row ||
      typeof row !==
        'object'
    ) {
      console.warn(
        '[active-flow/complete] Creator replay completion attribution returned no canonical row:',
        {
          sessionId,
        }
      )

      return null
    }

    return row as
      CreatorReplayCompletionAttributionRow
  } catch (error) {
    console.error(
      '[active-flow/complete] Unexpected creator replay completion attribution failure:',
      {
        sessionId,
        error,
      }
    )

    return null
  }
}

export async function POST(
  req: Request
) {
  try {
    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'User not authenticated',
        },
        {
          status:
            401,
        }
      )
    }

    const body =
      (await req.json()) as
        CompleteActiveFlowBody

    const sessionId =
      body.session_id

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'Missing session_id.',
        },
        {
          status:
            400,
        }
      )
    }

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .select(
        'id, user_id, venue_ids, status, started_at, completed_at, source, source_id, title, city, metadata, completed_stops'
      )
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle()

    if (sessionError) {
      console.error(
        '[active-flow/complete] Session fetch failed:',
        sessionError
      )

      return NextResponse.json(
        {
          error:
            'Could not fetch active flow.',
        },
        {
          status:
            500,
        }
      )
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            'Flow not found.',
        },
        {
          status:
            404,
        }
      )
    }

    if (
      session.status ===
      'completed'
    ) {
      /**
       * Relay baton repair / idempotency:
       *
       * A previously completed Relay team-slot Flow may have
       * missed its Relay slot transition because of an older
       * application version or a transient downstream failure.
       *
       * The canonical completion RPC is idempotent for identical
       * completion evidence, so it is safe to retry here.
       */
      await completeRelaySlotFromActiveFlow({
        supabase,
        sessionId,
        source:
          session.source,
        sourceId:
          session.source_id,
        venueIds:
          session.venue_ids,
      })

      /**
       * Competition participation repair / idempotency:
       *
       * A previously completed competition-linked Flow may have
       * missed participation finalization because of an older
       * application version or a transient downstream failure.
       *
       * The canonical reconciliation helper resolves the bridge,
       * derives verified evidence, applies competition
       * qualification, and finalizes the linked participation.
       *
       * Ordinary non-competition Active Flows are a no-op.
       */
      await safelyReconcileCompetitionParticipation({
        flowSessionId:
          sessionId,

        userId:
          user.id,
      })

      /**
       * Replay attribution repair / idempotency:
       *
       * A previously completed replay may have missed creator
       * attribution because of an older application version or
       * transient RPC failure.
       *
       * Calling the hardened RPC again is safe because the
       * database uniqueness boundary prevents duplicate creator
       * completion credit.
       */
      const replayAttribution =
        await recordCreatorReplayCompletionAttribution({
          supabase,
          sessionId,
          source:
            session.source,
        })

      const completedVenueIds =
        Array.isArray(
          session.venue_ids
        )
          ? session.venue_ids.filter(
              Boolean
            )
          : []

      const verifiedVenueCount =
        typeof session.completed_stops ===
          'number'
          ? session.completed_stops
          : completedVenueIds.length

      const competitionSubmissionCandidate =
        buildCompetitionSubmissionCandidate({
          sessionId,

          venueIds:
            completedVenueIds,

          title:
            session.title,

          city:
            session.city,

          startedAt:
            session.started_at,

          completedAt:
            session.completed_at,

          verifiedVenueCount,
        })

      return NextResponse.json(
        {
          session,
          message:
            'Flow already completed.',

          competitionSubmissionCandidate,

          replayAttribution:
            replayAttribution
              ? {
                  attributed:
                    replayAttribution.attributed,

                  creatorUserId:
                    replayAttribution.creator_user_id,

                  snapshotId:
                    replayAttribution.snapshot_id,

                  eventId:
                    replayAttribution.event_id,
                }
              : null,
        },
        {
          status:
            200,
        }
      )
    }

    if (
      session.status !==
      'active'
    ) {
      return NextResponse.json(
        {
          error:
            'Only active flows can be completed.',
        },
        {
          status:
            400,
        }
      )
    }

    const venueIds =
      Array.isArray(
        session.venue_ids
      )
        ? session.venue_ids.filter(
            Boolean
          )
        : []

    const isRelayTeamSlotFlow =
      session.source ===
      'roam_relay_team_slot'

    if (
      venueIds.length <
        2 &&
      !isRelayTeamSlotFlow
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid flow: not enough stops.',
        },
        {
          status:
            400,
        }
      )
    }

    const {
      data: progressRows,
      error: progressError,
    } = await supabase
      .from(
        'active_flow_progress'
      )
      .select(
        'venue_id'
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )

    if (progressError) {
      console.error(
        '[active-flow/complete] Progress fetch failed:',
        progressError
      )

      return NextResponse.json(
        {
          error:
            'Could not verify flow progress.',
        },
        {
          status:
            500,
        }
      )
    }

    const completedVenueIds =
      new Set(
        (
          progressRows ??
          []
        )
          .map(
            (
              row
            ) =>
              row.venue_id
          )
          .filter(
            Boolean
          )
      )

    const missingVenueIds =
      venueIds.filter(
        (
          venueId
        ) =>
          !completedVenueIds.has(
            venueId
          )
      )

    if (
      missingVenueIds.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            'Flow is not complete yet.',

          completedStops:
            completedVenueIds.size,

          totalStops:
            venueIds.length,

          missingVenueIds,
        },
        {
          status:
            409,
        }
      )
    }

    const completedAt =
      new Date()
        .toISOString()

    const completedStops =
      completedVenueIds.size

    const completionBonus =
      getCompletionBonus(
        session.source
      )

    const xpEarned =
      venueIds.length *
        25 +
      completionBonus

    const badgeUnlocked =
      getBadgeUnlocked(
        session.source
      )

    const {
      data: updatedSession,
      error: updateError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .update({
        status:
          'completed',

        completed_at:
          completedAt,

        updated_at:
          completedAt,

        completed_stops:
          completedStops,
      } as any)
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .select(
        '*'
      )
      .single()

    if (
      updateError ||
      !updatedSession
    ) {
      console.error(
        '[active-flow/complete] Completion update failed:',
        updateError
      )

      return NextResponse.json(
        {
          error:
            'Could not complete flow.',
        },
        {
          status:
            500,
        }
      )
    }

    /**
     * Relay baton completion:
     *
     * The Active Flow is now canonically completed.
     *
     * Relay team-slot sessions must now delegate their Relay
     * transition to the hardened completion RPC so the current
     * slot is completed and the next baton is activated.
     */
    await completeRelaySlotFromActiveFlow({
      supabase,
      sessionId,
      source:
        session.source,
      sourceId:
        session.source_id,
      venueIds,
    })

    /**
     * Competition participation finalization:
     *
     * The Active Flow is now canonically completed.
     *
     * If this session is linked through competition_flow_sessions,
     * the canonical competition reconciliation helper:
     *
     *   - derives verified stops from canonical evidence
     *   - applies qualification
     *   - marks the linked participation qualified when warranted
     *   - sets participation.completed_at
     *
     * Ordinary non-competition Active Flows are a no-op.
     *
     * Reconciliation is deliberately best-effort relative to the
     * already-successful physical Flow completion. The completed
     * retry path above provides an idempotent repair mechanism.
     */
    await safelyReconcileCompetitionParticipation({
      flowSessionId:
        sessionId,

      userId:
        user.id,
    })

    /**
     * Creator replay attribution:
     *
     * The replay session is now canonically completed.
     *
     * For flow_snapshot sessions, give the hardened database RPC
     * the opportunity to record lifetime-idempotent completion
     * attribution for the original creator.
     *
     * Attribution failure remains non-fatal to the user's
     * successful Flow completion.
     */
    const replayAttribution =
      await recordCreatorReplayCompletionAttribution({
        supabase,
        sessionId,
        source:
          session.source,
      })

    await refreshPublicPassportStats(
      user.id
    )

    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          'active_flow_completed',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          completedAt,
      }
    )

    const competitionSubmissionCandidate =
      buildCompetitionSubmissionCandidate({
        sessionId,

        venueIds,

        title:
          session.title,

        city:
          session.city,

        startedAt:
          session.started_at,

        completedAt,

        verifiedVenueCount:
          completedStops,
      })

    return NextResponse.json(
      {
        session:
          updatedSession,

        xpEarned,

        badgeUnlocked,

        completedStops,

        totalStops:
          venueIds.length,

        source:
          session.source ??
          null,

        sourceId:
          session.source_id ??
          null,

        competitionSubmissionCandidate,

        replayAttribution:
          replayAttribution
            ? {
                attributed:
                  replayAttribution.attributed,

                creatorUserId:
                  replayAttribution.creator_user_id,

                snapshotId:
                  replayAttribution.snapshot_id,

                eventId:
                  replayAttribution.event_id,
              }
            : null,
      },
      {
        status:
          200,
      }
    )
  } catch (err) {
    console.error(
      '[active-flow/complete] Unexpected error:',
      err
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error completing flow.',
      },
      {
        status:
          500,
      }
    )
  }
}