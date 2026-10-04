import type {
  ActiveFlowInterventionFeasibility,
} from '@/lib/active-flow/interventionFeasibility'

import type {
  ActiveFlowInterventionSuitabilityResult,
} from '@/lib/active-flow/interventionSuitability'


export type ActiveFlowInterventionRecommendation =
  | {
      kind: 'detour'
      reason: 'preserve_original_route'
    }
  | {
      kind: 'swap'
      reason:
        | 'detour_unavailable'
        | 'detour_contextually_unsuitable'
    }
  | {
      kind: 'none'
      reason:
        | 'no_feasible_intervention'
        | 'no_suitable_intervention'
    }


/**
 * Select the primary intervention Roam should recommend for an
 * already-scored Active Flow opportunity.
 *
 * This is recommendation policy, not mutation authority.
 *
 * 017 historical behavior:
 *
 * - Feasibility is derived server-side.
 * - Detour is preferred when feasible because it preserves the
 *   user's original Flow.
 * - Swap is recommended only when Detour is unavailable but Swap
 *   remains feasible.
 * - No mutation is performed here.
 * - POST endpoints and database RPCs must revalidate fresh state.
 *
 * 022E additive behavior:
 *
 * - Suitability is optional so historical callers retain frozen
 *   017 behavior.
 * - "unsuitable" removes an otherwise-feasible intervention from
 *   recommendation consideration.
 * - "suitable" and "uncertain" remain recommendation-eligible.
 * - Suitability never makes an infeasible intervention eligible.
 * - Suitability never authorizes a mutation.
 */
export function recommendActiveFlowIntervention(
  feasibility:
    ActiveFlowInterventionFeasibility,

  suitability?:
    ActiveFlowInterventionSuitabilityResult
): ActiveFlowInterventionRecommendation {
  /**
   * Preserve frozen 017 behavior when the 022E suitability layer
   * has not been supplied.
   */
  if (!suitability) {
    if (
      feasibility.detour.feasible ===
      true
    ) {
      return {
        kind:
          'detour',

        reason:
          'preserve_original_route',
      }
    }

    if (
      feasibility.swap.feasible ===
      true
    ) {
      return {
        kind:
          'swap',

        reason:
          'detour_unavailable',
      }
    }

    return {
      kind:
        'none',

      reason:
        'no_feasible_intervention',
    }
  }

  /**
   * Feasibility remains structural authority.
   *
   * Suitability can only remove an otherwise-feasible intervention
   * from recommendation consideration. It can never resurrect an
   * infeasible intervention.
   *
   * Conservative uncertainty remains permissive.
   */
  const detourEligible =
    feasibility.detour.feasible ===
      true &&
    suitability.detour.suitability !==
      'unsuitable'

  const swapEligible =
    feasibility.swap.feasible ===
      true &&
    suitability.swap.suitability !==
      'unsuitable'

  /**
   * Preserve the frozen 017 Detour-first policy whenever Detour
   * remains both structurally feasible and contextually eligible.
   *
   * This includes:
   *
   * - suitable
   * - uncertain
   *
   * Missing/weak semantic evidence therefore cannot silently force
   * a destructive Swap.
   */
  if (detourEligible) {
    return {
      kind:
        'detour',

      reason:
        'preserve_original_route',
    }
  }

  /**
   * Swap is recommended only when:
   *
   * - Swap remains structurally feasible,
   * - Swap is not affirmatively unsuitable, and
   * - Detour is either structurally unavailable or affirmatively
   *   contextually unsuitable.
   */
  if (swapEligible) {
    return {
      kind:
        'swap',

      reason:
        feasibility.detour.feasible ===
          true
          ? 'detour_contextually_unsuitable'
          : 'detour_unavailable',
    }
  }

  /**
   * Distinguish structural impossibility from contextual suppression.
   *
   * If neither intervention was structurally feasible, retain the
   * frozen 017 reason.
   *
   * Otherwise at least one intervention could technically be
   * performed, but every feasible option was affirmatively rejected
   * by suitability.
   */
  const hasFeasibleIntervention =
    feasibility.detour.feasible ===
      true ||
    feasibility.swap.feasible ===
      true

  return {
    kind:
      'none',

    reason:
      hasFeasibleIntervention
        ? 'no_suitable_intervention'
        : 'no_feasible_intervention',
  }
}