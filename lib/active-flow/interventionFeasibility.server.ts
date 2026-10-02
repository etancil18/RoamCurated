import 'server-only'

import type {
  SupabaseClient,
} from '@supabase/supabase-js'

import type {
  ActiveFlowOpportunityCandidate,
  ActiveFlowOpportunityContext,
} from '@/lib/active-flow/opportunityCandidates'

import {
  resolveActiveFlowInterventionTargets,
} from '@/lib/active-flow/interventionTargets'

import {
  evaluateActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'

import type {
  ActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'


type ActiveDetourRow = {
  before_flow_stop_id: string
}


export async function getActiveFlowInterventionFeasibility({
  context,
  candidate,
  actionable,
  supabase: providedSupabase,
}: {
  context:
    ActiveFlowOpportunityContext

  candidate:
    ActiveFlowOpportunityCandidate

  actionable:
    boolean

  supabase?:
    SupabaseClient
}): Promise<ActiveFlowInterventionFeasibility> {
  const {
    swapTarget,
    detourAnchor,
  } =
    resolveActiveFlowInterventionTargets(
      context
    )

  const targetIds =
    Array.from(
      new Set(
        [
          swapTarget?.id,
          detourAnchor?.id,
        ].filter(
          (
            value
          ): value is string =>
            typeof value ===
              'string' &&
            value.length > 0
        )
      )
    )

  const occupiedDetourAnchorIds =
    new Set<string>()

  if (
    actionable &&
    targetIds.length > 0
  ) {
    const supabase =
      providedSupabase ??
      getSupabaseAdmin()

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'active_flow_detours'
        )
        .select(
          'before_flow_stop_id'
        )
        .eq(
          'session_id',
          context.sessionId
        )
        .eq(
          'status',
          'active'
        )
        .in(
          'before_flow_stop_id',
          targetIds
        )
        .returns<
          ActiveDetourRow[]
        >()

    if (error) {
      console.error(
        '[active-flow/intervention-feasibility] Active Detour lookup failed:',
        error
      )

      throw new Error(
        'Could not determine Active Flow intervention feasibility.'
      )
    }

    for (
      const row of
      data ?? []
    ) {
      occupiedDetourAnchorIds.add(
        row.before_flow_stop_id
      )
    }
  }

  return evaluateActiveFlowInterventionFeasibility({
    context,
    candidate,
    actionable,
    occupiedDetourAnchorIds,
  })
}