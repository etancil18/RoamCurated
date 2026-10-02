import type {
  ActiveFlowOpportunityCandidate,
  ActiveFlowOpportunityContext,
} from '@/lib/active-flow/opportunityCandidates'

import {
  resolveActiveFlowInterventionTargets,
} from '@/lib/active-flow/interventionTargets'


export type ActiveFlowInterventionFeasibilityReason =
  | 'opportunity_not_actionable'
  | 'no_target'
  | 'same_venue'
  | 'venue_already_executable'
  | 'target_has_active_detour'


export type ActiveFlowInterventionActionFeasibility = {
  feasible: boolean

  reason:
    ActiveFlowInterventionFeasibilityReason | null
}


export type ActiveFlowInterventionFeasibility = {
  swap:
    ActiveFlowInterventionActionFeasibility

  detour:
    ActiveFlowInterventionActionFeasibility
}


const FEASIBLE:
  ActiveFlowInterventionActionFeasibility = {
    feasible: true,
    reason: null,
  }


function infeasible(
  reason:
    ActiveFlowInterventionFeasibilityReason
): ActiveFlowInterventionActionFeasibility {
  return {
    feasible: false,
    reason,
  }
}


export function evaluateActiveFlowInterventionFeasibility({
  context,
  candidate,
  actionable,
  occupiedDetourAnchorIds,
}: {
  context:
    ActiveFlowOpportunityContext

  candidate:
    ActiveFlowOpportunityCandidate

  actionable:
    boolean

  occupiedDetourAnchorIds:
    ReadonlySet<string>
}): ActiveFlowInterventionFeasibility {
  if (!actionable) {
    return {
      swap:
        infeasible(
          'opportunity_not_actionable'
        ),

      detour:
        infeasible(
          'opportunity_not_actionable'
        ),
    }
  }

  const {
    swapTarget,
    detourAnchor,
  } =
    resolveActiveFlowInterventionTargets(
      context
    )

  const executableVenueIds =
    new Set(
      context.runtimeStops.map(
        (stop) =>
          stop.venueId
      )
    )


  let swap:
    ActiveFlowInterventionActionFeasibility

  if (!swapTarget) {
    swap =
      infeasible(
        'no_target'
      )
  } else if (
    candidate.venueId ===
    swapTarget.venueId
  ) {
    swap =
      infeasible(
        'same_venue'
      )
  } else if (
    executableVenueIds.has(
      candidate.venueId
    )
  ) {
    swap =
      infeasible(
        'venue_already_executable'
      )
  } else if (
    occupiedDetourAnchorIds.has(
      swapTarget.id
    )
  ) {
    swap =
      infeasible(
        'target_has_active_detour'
      )
  } else {
    swap =
      FEASIBLE
  }


  let detour:
    ActiveFlowInterventionActionFeasibility

  if (!detourAnchor) {
    detour =
      infeasible(
        'no_target'
      )
  } else if (
    candidate.venueId ===
    detourAnchor.venueId
  ) {
    detour =
      infeasible(
        'same_venue'
      )
  } else if (
    executableVenueIds.has(
      candidate.venueId
    )
  ) {
    detour =
      infeasible(
        'venue_already_executable'
      )
  } else if (
    occupiedDetourAnchorIds.has(
      detourAnchor.id
    )
  ) {
    detour =
      infeasible(
        'target_has_active_detour'
      )
  } else {
    detour =
      FEASIBLE
  }

  return {
    swap,
    detour,
  }
}