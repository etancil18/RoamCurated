import type {
  ActiveFlowOpportunityContext,
  ActiveFlowOpportunityRuntimeStop,
} from '@/lib/active-flow/opportunityCandidates'


export type ActiveFlowInterventionTargets = {
  currentStop:
    ActiveFlowOpportunityRuntimeStop | null

  swapTarget:
    ActiveFlowOpportunityRuntimeStop | null

  detourAnchor:
    ActiveFlowOpportunityRuntimeStop | null
}


/**
 * Resolve the server-owned runtime targets for user-approved
 * Active Flow interventions.
 *
 * Authority:
 *
 * SWAP
 *   current executable stop
 *        ↓
 *   immediate NEXT uncompleted executable stop
 *
 * DETOUR
 *   current executable stop
 *        ↓
 *   first NEXT uncompleted BASE stop
 *   whose immutable base position is non-null
 *
 * This function:
 *
 * - is pure
 * - performs no database reads
 * - performs no writes
 * - does not score opportunities
 * - does not decide event eligibility
 * - does not decide mutation feasibility
 * - does not accept a browser-selected target or anchor
 *
 * The supplied ActiveFlowOpportunityContext is expected to come
 * from the canonical runtime-route-backed 013 context.
 */
export function resolveActiveFlowInterventionTargets(
  context: Pick<
    ActiveFlowOpportunityContext,
    | 'currentStop'
    | 'remainingStops'
  >
): ActiveFlowInterventionTargets {
  const currentStop =
    context.currentStop

  if (!currentStop) {
    return {
      currentStop: null,
      swapTarget: null,
      detourAnchor: null,
    }
  }

  const currentStopIndex =
    context.remainingStops.findIndex(
      (stop) =>
        stop.id ===
        currentStop.id
    )

  if (currentStopIndex === -1) {
    throw new Error(
      'Active Flow runtime context is inconsistent.'
    )
  }

  const subsequentStops =
    context.remainingStops.slice(
      currentStopIndex + 1
    )

  const swapTarget =
    subsequentStops[0] ??
    null

  if (
    swapTarget?.completed
  ) {
    throw new Error(
      'Active Flow next-stop resolution returned a completed stop.'
    )
  }

  const detourAnchor =
    subsequentStops.find(
      (stop) =>
        !stop.completed &&
        stop.kind === 'base' &&
        stop.position != null
    ) ??
    null

  return {
    currentStop,
    swapTarget,
    detourAnchor,
  }
}