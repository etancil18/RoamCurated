import type {
  ActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'


export type ActiveFlowInterventionRecommendation =
  | {
      kind: 'detour'
      reason: 'preserve_original_route'
    }
  | {
      kind: 'swap'
      reason: 'detour_unavailable'
    }
  | {
      kind: 'none'
      reason: 'no_feasible_intervention'
    }


/**
 * Select the primary intervention Roam should recommend for an
 * already-scored Active Flow opportunity.
 *
 * This is recommendation policy, not mutation authority.
 *
 * - Feasibility is assumed to have been derived server-side.
 * - Detour is preferred when feasible because it preserves the
 *   user's original Flow.
 * - Swap is recommended only when Detour is unavailable but Swap
 *   remains feasible.
 * - No mutation is performed here.
 * - POST endpoints and database RPCs must revalidate fresh state.
 */
export function recommendActiveFlowIntervention(
  feasibility:
    ActiveFlowInterventionFeasibility
): ActiveFlowInterventionRecommendation {
  if (
    feasibility.detour.feasible ===
    true
  ) {
    return {
      kind: 'detour',
      reason:
        'preserve_original_route',
    }
  }

  if (
    feasibility.swap.feasible ===
    true
  ) {
    return {
      kind: 'swap',
      reason:
        'detour_unavailable',
    }
  }

  return {
    kind: 'none',
    reason:
      'no_feasible_intervention',
  }
}