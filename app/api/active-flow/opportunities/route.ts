import { NextResponse } from 'next/server'

import {
  getActiveFlowOpportunityCandidates,
} from '@/lib/active-flow/opportunityCandidates'

import {
  scoreActiveFlowOpportunities,
} from '@/lib/active-flow/opportunityScoring'

import {
  getActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility.server'

import {
  evaluateActiveFlowInterventionSuitability,
} from '@/lib/active-flow/interventionSuitability'

import {
  resolveActiveFlowInterventionTargets,
} from '@/lib/active-flow/interventionTargets'

import {
  recommendActiveFlowIntervention,
} from '@/lib/active-flow/interventionRecommendation'

import { createServerClient } from '@/lib/supabase/server'

export async function GET(
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

    const url =
      new URL(req.url)

    const sessionId =
      url.searchParams
        .get('session_id')
        ?.trim()

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

    const scoredOpportunitiesWithInterventions =
      await Promise.all(
        scoredOpportunities.map(
          async (
            opportunity
          ) => {
            const interventions =
              await getActiveFlowInterventionFeasibility({
                context,

                candidate:
                  opportunity.candidate,

                actionable:
                  opportunity.actionable ===
                  true &&
                  opportunity.score != null,
              })

            /**
             * 022E.4 — Deterministic intervention suitability.
             *
             * Suitability is evaluated only when the authoritative
             * semantic evidence established by the opportunity pipeline
             * is present.
             *
             * Missing semantic evidence deliberately yields no
             * suitability result here. The recommendation primitive then
             * preserves frozen 017 feasibility-only behavior through its
             * optional suitability contract.
             *
             * Structural intervention targets remain server-owned and
             * are resolved from the canonical runtime context.
             */
            const suitability =
              opportunity.candidate.eventSemantics &&
              opportunity.candidate.contextualFit &&
              context.semanticContext
                ? evaluateActiveFlowInterventionSuitability({
                    event:
                      opportunity.candidate.eventSemantics,

                    contextualFit:
                      opportunity.candidate.contextualFit,

                    semanticContext: {
                      remainingStops:
                        context.semanticContext.remainingStops,
                    },

                    targets:
                      resolveActiveFlowInterventionTargets(
                        context
                      ),
                  })
                : undefined

            const recommendation =
              recommendActiveFlowIntervention(
                interventions,
                suitability
              )

            return {
              ...opportunity,
              interventions,
              suitability,
              recommendation,
            }
          }
        )
      )

    /**
     * 018D — Session-scoped opportunity presentation suppression.
     *
     * Dismissal is user presentation state only.
     *
     * It deliberately does not alter:
     *
     * - Community Signal trust
     * - discovery eligibility
     * - candidate eligibility
     * - opportunity scoring
     * - intervention feasibility
     * - intervention recommendation
     *
     * The authenticated RLS boundary independently limits this read
     * to dismissals owned by the current user and Flow session.
     */
    const {
      data: dismissalData,
      error: dismissalError,
    } = await supabase
      .from(
        'active_flow_opportunity_dismissals'
      )
      .select(
        'event_id'
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )

    if (dismissalError) {
      console.error(
        '[active-flow/opportunities] Dismissal lookup failed:',
        dismissalError
      )

      /**
       * Fail closed for presentation.
       *
       * If Roam cannot establish which opportunities the user has
       * dismissed, it must not risk resurfacing dismissed signals.
       */
      throw new Error(
        'Could not determine Live Signal opportunity dismissals.'
      )
    }

    const dismissedEventIds =
      new Set(
        (dismissalData ?? [])
          .map(
            (dismissal) =>
              typeof dismissal.event_id ===
              'string'
                ? dismissal.event_id
                : null
          )
          .filter(
            (
              eventId
            ): eventId is string =>
              eventId != null
          )
      )

    const presentedScoredOpportunities =
      scoredOpportunitiesWithInterventions.filter(
        (opportunity) =>
          !dismissedEventIds.has(
            opportunity.candidate.eventId
          )
      )

    return NextResponse.json({
      ...context,
      scoredOpportunities:
        presentedScoredOpportunities,
    })
  } catch (error) {
    console.error(
      '[active-flow/opportunities] Candidate lookup failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load Live Signal opportunities.',
      },
      {
        status: 500,
      }
    )
  }
}