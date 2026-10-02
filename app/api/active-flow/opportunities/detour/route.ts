import { NextResponse } from 'next/server'

import {
  getActiveFlowOpportunityCandidates,
} from '@/lib/active-flow/opportunityCandidates'

import {
  scoreActiveFlowOpportunities,
} from '@/lib/active-flow/opportunityScoring'

import {
  resolveActiveFlowInterventionTargets,
} from '@/lib/active-flow/interventionTargets'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  createServerClient,
} from '@/lib/supabase/server'


type DetourRequestBody = {
  session_id?: unknown
  event_id?: unknown
}


type DetourRpcRow = {
  session_id: string
  detour_flow_stop_id: string
  before_flow_stop_id: string
  detour_venue_id: string
  event_id: string
}


function normalizeRequiredString(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}


export async function POST(
  req: Request
) {
  try {
    // ========================================================
    // 1. Authenticate.
    //
    // The browser never supplies user_id.
    // ========================================================

    const supabase =
      await createServerClient()

    const {
      data: {
        user,
      },
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
            'Authentication required.',
        },
        {
          status: 401,
        }
      )
    }


    // ========================================================
    // 2. Parse the minimal approval request.
    //
    // Browser authority:
    //
    //   session_id
    //   event_id
    //
    // Browser does NOT choose:
    //
    //   user_id
    //   venue_id
    //   anchor stop
    //   position
    //   execution order
    //   score
    //   confidence
    //   actionable state
    // ========================================================

    let body:
      DetourRequestBody

    try {
      body =
        await req.json() as
          DetourRequestBody
    } catch {
      return NextResponse.json(
        {
          error:
            'Invalid JSON body.',
        },
        {
          status: 400,
        }
      )
    }

    const sessionId =
      normalizeRequiredString(
        body.session_id
      )

    const eventId =
      normalizeRequiredString(
        body.event_id
      )

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'session_id is required.',
        },
        {
          status: 400,
        }
      )
    }

    if (!eventId) {
      return NextResponse.json(
        {
          error:
            'event_id is required.',
        },
        {
          status: 400,
        }
      )
    }


    // ========================================================
    // 3. Establish one fresh decision timestamp.
    //
    // Candidate assembly and scoring operate from the same
    // authoritative instant.
    // ========================================================

    const asOf =
      new Date()


    // ========================================================
    // 4. Rebuild the frozen 013 opportunity context.
    //
    // This re-establishes:
    //
    //   - session ownership
    //   - active session state
    //   - execution-policy eligibility
    //   - canonical executable runtime route
    //   - progress identity
    //   - trusted Community Signal discovery eligibility
    //
    // No mutation occurs here.
    // ========================================================

    const context =
      await getActiveFlowOpportunityCandidates({
        sessionId,

        userId:
          user.id,

        asOf,
      })


    // ========================================================
    // 5. Re-run the frozen 013C scorer.
    //
    // The client cannot approve a stale score.
    // ========================================================

    const scoredOpportunities =
      scoreActiveFlowOpportunities(
        context
      )

    const opportunity =
      scoredOpportunities.find(
        (item) =>
          item.candidate.eventId ===
          eventId
      )

    if (!opportunity) {
      return NextResponse.json(
        {
          error:
            'Live Signal opportunity is no longer available.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      opportunity.actionable !==
        true ||
      opportunity.score == null
    ) {
      return NextResponse.json(
        {
          error:
            'Live Signal opportunity is no longer actionable.',

          reason:
            opportunity.ineligibleReason,
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 6. Derive the Detour anchor server-side.
    //
    // V1 Detour semantics:
    //
    //   current executable stop
    //            ↓
    //   first NEXT uncompleted BASE stop
    //
    // The anchor survives the mutation.
    //
    // Detours never consume or reuse the base-position
    // namespace, so a Detour cannot itself be the V1 anchor.
    //
    // The browser cannot nominate an arbitrary anchor.
    //
    // 016G.1A centralizes this already-established targeting
    // rule in the shared pure intervention-target resolver.
    // ========================================================

    const {
      currentStop,
      detourAnchor:
        anchorStop,
    } =
      resolveActiveFlowInterventionTargets(
        context
      )

    if (!currentStop) {
      return NextResponse.json(
        {
          error:
            'Active Flow has no current stop.',
        },
        {
          status: 409,
        }
      )
    }

    if (!anchorStop) {
      return NextResponse.json(
        {
          error:
            'Active Flow has no next base stop available for a Detour.',
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 7. Prevent a meaningless Detour before entering the
    // mutation boundary.
    //
    // 016E independently performs its own same-venue guard.
    // This is only a clearer API-level rejection.
    // ========================================================

    if (
      opportunity.candidate.venueId ===
      anchorStop.venueId
    ) {
      return NextResponse.json(
        {
          error:
            'Live Signal venue is already the Detour anchor in this Flow.',
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 8. Enter the trusted mutation boundary.
    //
    // 016E independently re-checks:
    //
    //   - session ownership
    //   - active session
    //   - fixed execution modes
    //   - exact anchor membership/status
    //   - base-anchor identity
    //   - completion identity
    //   - existing active Detour for the anchor
    //   - Community Signal discoverability
    //   - canonical event venue
    //   - executable venue uniqueness
    //
    // It then inserts:
    //
    //   - one executable position=NULL runtime stop
    //   - one active Detour ordering relation
    //
    // The anchor remains executable.
    // ========================================================

    const admin =
      getSupabaseAdmin()

    const {
      data: detourData,
      error: detourError,
    } =
      await admin.rpc(
        'create_active_flow_detour_for_community_event',
        {
          p_session_id:
            sessionId,

          p_user_id:
            user.id,

          p_before_flow_stop_id:
            anchorStop.id,

          p_event_id:
            eventId,
        }
      )

    if (detourError) {
      console.error(
        '[active-flow/opportunities/detour] Detour RPC rejected:',
        detourError
      )

      return NextResponse.json(
        {
          error:
            'Live Signal Detour could not be completed.',
        },
        {
          status: 409,
        }
      )
    }

    const detourRows =
      (detourData ??
        []) as DetourRpcRow[]

    const detour =
      detourRows[0] ??
      null

    if (!detour) {
      throw new Error(
        'Active Flow Detour returned no mutation result.'
      )
    }


    // ========================================================
    // 9. Return only useful mutation identities.
    //
    // This endpoint does NOT create:
    //
    //   - progress
    //   - venue_visit
    //   - event participation
    //   - event check-in
    //   - event interest
    //   - event report
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        sessionId:
          detour.session_id,

        eventId:
          detour.event_id,

        anchorStop: {
          id:
            detour.before_flow_stop_id,

          venueId:
            anchorStop.venueId,

          position:
            anchorStop.position,
        },

        detourStop: {
          id:
            detour.detour_flow_stop_id,

          venueId:
            detour.detour_venue_id,

          position:
            null,

          origin:
            'community_signal',

          beforeFlowStopId:
            detour.before_flow_stop_id,
        },
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[active-flow/opportunities/detour] Request failed:',
      error
    )

    const message =
      error instanceof Error
        ? error.message
        : 'Could not complete Live Signal Detour.'

    // Known context failures are client-state conflicts rather
    // than generic server failures.
    if (
      message ===
        'Active Flow session not found.' ||
      message ===
        'Live Signal opportunities require an active Flow.' ||
      message ===
        'This Active Flow is fixed and is not eligible for Live Signal opportunities.'
    ) {
      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status: 409,
        }
      )
    }

    return NextResponse.json(
      {
        error:
          'Could not complete Live Signal Detour.',
      },
      {
        status: 500,
      }
    )
  }
}