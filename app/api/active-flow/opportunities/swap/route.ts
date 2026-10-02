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


type SwapRequestBody = {
  session_id?: unknown
  event_id?: unknown
}


type SwapRpcRow = {
  session_id: string
  replaced_flow_stop_id: string
  replacement_flow_stop_id: string
  stop_position: number
  replaced_venue_id: string
  replacement_venue_id: string
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
    //   target stop
    //   position
    //   score
    //   confidence
    //   actionable state
    // ========================================================

    let body:
      SwapRequestBody

    try {
      body =
        await req.json() as
          SwapRequestBody
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
    //   - executable runtime route
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
    // 6. Derive the Swap target server-side.
    //
    // V1 Swap semantics:
    //
    //   current stop
    //        ↓
    //   immediate NEXT uncompleted executable stop
    //
    // The current stop is never replaced.
    //
    // An arbitrary later stop cannot be nominated by the
    // browser.
    //
    // 016G.1A centralizes this already-established targeting
    // rule in the shared pure intervention-target resolver.
    // ========================================================

    const {
      currentStop,
      swapTarget:
        targetStop,
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

    if (!targetStop) {
      return NextResponse.json(
        {
          error:
            'Active Flow has no next stop available to swap.',
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 7. Prevent a meaningless Swap before entering the
    // mutation boundary.
    //
    // 015C independently performs its own same-venue guard.
    // This is only a clearer API-level rejection.
    // ========================================================

    if (
      opportunity.candidate.venueId ===
      targetStop.venueId
    ) {
      return NextResponse.json(
        {
          error:
            'Live Signal venue is already the next stop in this Flow.',
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 8. Enter the trusted mutation boundary.
    //
    // 015C independently re-checks:
    //
    //   - session ownership
    //   - active session
    //   - fixed execution modes
    //   - target membership/status
    //   - completion identity
    //   - Community Signal discoverability
    //   - canonical event venue
    //
    // It then performs the history-preserving atomic Swap.
    // ========================================================

    const admin =
      getSupabaseAdmin()

    const {
      data: swapData,
      error: swapError,
    } =
      await admin.rpc(
        'swap_active_flow_stop_for_community_event',
        {
          p_session_id:
            sessionId,

          p_user_id:
            user.id,

          p_target_flow_stop_id:
            targetStop.id,

          p_event_id:
            eventId,
        }
      )

    if (swapError) {
      console.error(
        '[active-flow/opportunities/swap] Swap RPC rejected:',
        swapError
      )

      return NextResponse.json(
        {
          error:
            'Live Signal Swap could not be completed.',
        },
        {
          status: 409,
        }
      )
    }

    const swapRows =
      (swapData ??
        []) as SwapRpcRow[]

    const swap =
      swapRows[0] ??
      null

    if (!swap) {
      throw new Error(
        'Active Flow Swap returned no mutation result.'
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
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        sessionId:
          swap.session_id,

        eventId:
          swap.event_id,

        replacedStop: {
          id:
            swap.replaced_flow_stop_id,

          venueId:
            swap.replaced_venue_id,

          position:
            swap.stop_position,
        },

        replacementStop: {
          id:
            swap.replacement_flow_stop_id,

          venueId:
            swap.replacement_venue_id,

          position:
            swap.stop_position,

          origin:
            'community_signal',

          originalStopId:
            swap.replaced_flow_stop_id,
        },
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[active-flow/opportunities/swap] Request failed:',
      error
    )

    const message =
      error instanceof Error
        ? error.message
        : 'Could not complete Live Signal Swap.'

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
          'Could not complete Live Signal Swap.',
      },
      {
        status: 500,
      }
    )
  }
}