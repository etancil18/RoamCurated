import { NextResponse } from 'next/server'

import {
  getActiveFlowOpportunityCandidates,
} from '@/lib/active-flow/opportunityCandidates'

import {
  scoreActiveFlowOpportunities,
} from '@/lib/active-flow/opportunityScoring'

import { createServerClient } from '@/lib/supabase/server'

type DismissRequestBody = {
  session_id?: unknown
  event_id?: unknown
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
            'Authentication required.',
        },
        {
          status: 401,
        }
      )
    }

    let body:
      DismissRequestBody

    try {
      body =
        (await req.json()) as DismissRequestBody
    } catch {
      return NextResponse.json(
        {
          error:
            'Invalid request body.',
        },
        {
          status: 400,
        }
      )
    }

    const sessionId =
      typeof body.session_id ===
      'string'
        ? body.session_id.trim()
        : ''

    const eventId =
      typeof body.event_id ===
      'string'
        ? body.event_id.trim()
        : ''

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

    /**
     * Rebuild the current server-owned opportunity context.
     *
     * This independently establishes:
     *
     * - session ownership
     * - active session state
     * - adaptive execution eligibility
     * - canonical runtime route
     * - trusted Community Signal discovery eligibility
     *
     * Dismissal never trusts browser-provided opportunity state.
     */
    const context =
      await getActiveFlowOpportunityCandidates({
        sessionId,
        userId:
          user.id,
      })

    const scoredOpportunities =
      scoreActiveFlowOpportunities(
        context
      )

    const opportunity =
      scoredOpportunities.find(
        (scoredOpportunity) =>
          scoredOpportunity.candidate
            .eventId ===
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

    /**
     * Dismissal is immutable session-scoped presentation state.
     *
     * The unique(session_id, user_id, event_id) constraint makes
     * the persisted identity explicit.
     *
     * upsert + ignoreDuplicates makes repeated dismissal requests
     * idempotent without creating UPDATE semantics.
     *
     * RLS independently requires:
     *
     * - user_id = auth.uid()
     * - session ownership
     * - active session
     */
    const {
      error: dismissalError,
    } = await supabase
      .from(
        'active_flow_opportunity_dismissals'
      )
      .upsert(
        {
          session_id:
            sessionId,

          user_id:
            user.id,

          event_id:
            eventId,
        },
        {
          onConflict:
            'session_id,user_id,event_id',

          ignoreDuplicates:
            true,
        }
      )

    if (dismissalError) {
      console.error(
        '[active-flow/opportunities/dismiss] Dismissal write failed:',
        dismissalError
      )

      return NextResponse.json(
        {
          error:
            'This opportunity could not be dismissed.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      dismissed: true,

      sessionId,

      eventId,
    })
  } catch (error) {
    console.error(
      '[active-flow/opportunities/dismiss] Dismissal failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'This opportunity could not be dismissed.',
      },
      {
        status: 500,
      }
    )
  }
}