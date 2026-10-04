import {
  evaluateActiveFlowContextualFit,
} from '@/lib/active-flow/contextualFit'

import type {
  ActiveFlowContextualFitResult,
} from '@/lib/active-flow/contextualFit'

import type {
  ActiveFlowEventSemantics,
  ActiveFlowSemanticRouteStop,
} from '@/lib/active-flow/contextualIntelligence'

import type {
  ActiveFlowInterventionTargets,
} from '@/lib/active-flow/interventionTargets'


export type ActiveFlowInterventionSuitability =
  | 'suitable'
  | 'uncertain'
  | 'unsuitable'


export type ActiveFlowInterventionSuitabilityReason =
  | 'contextually_coherent'
  | 'insufficient_context'
  | 'additive_context_conflict'
  | 'replacement_context_conflict'


export type ActiveFlowInterventionActionSuitability = {
  suitability:
    ActiveFlowInterventionSuitability

  reason:
    ActiveFlowInterventionSuitabilityReason
}


export type ActiveFlowInterventionSuitabilityResult = {
  detour:
    ActiveFlowInterventionActionSuitability

  swap:
    ActiveFlowInterventionActionSuitability
}


/**
 * 022E.4A — Minimum canonical semantic route evidence required by
 * intervention suitability.
 *
 * The opportunity pipeline already owns semantic hydration. This
 * evaluator consumes only the canonical remaining semantic runtime
 * route it actually needs for exact Swap-target evaluation.
 *
 * It deliberately does not require callers to fabricate a complete
 * ActiveFlowSemanticContext containing local-neighbor or Flow fields
 * that are not used by the current suitability policy.
 */
export type ActiveFlowInterventionSemanticContext = {
  remainingStops:
    ActiveFlowSemanticRouteStop[]
}


export type EvaluateActiveFlowInterventionSuitabilityInput = {
  /**
   * Canonical semantic representation of the Community Event.
   *
   * The caller owns event hydration authority. This evaluator does not
   * read event, occurrence, venue, trust, or discovery state.
   */
  event:
    ActiveFlowEventSemantics

  /**
   * Broad 022D contextual judgment for the candidate against the
   * canonical remaining Active Flow.
   *
   * This result is supplied rather than recomputed so broad contextual
   * authority remains exactly where the opportunity pipeline established
   * it.
   */
  contextualFit:
    ActiveFlowContextualFitResult

  /**
   * Optional canonical semantic runtime context.
   *
   * Only the canonical remaining semantic route is required by the
   * current 022E policy.
   *
   * Absence must never be interpreted as incompatibility.
   */
  semanticContext:
    ActiveFlowInterventionSemanticContext | null | undefined

  /**
   * Server-owned structural intervention targets.
   *
   * Target identity is resolved by interventionTargets.ts. This
   * evaluator does not choose or reconstruct mutation targets.
   */
  targets:
    ActiveFlowInterventionTargets
}


const SUITABLE:
  ActiveFlowInterventionActionSuitability = {
    suitability:
      'suitable',

    reason:
      'contextually_coherent',
  }


const UNCERTAIN:
  ActiveFlowInterventionActionSuitability = {
    suitability:
      'uncertain',

    reason:
      'insufficient_context',
  }


const ADDITIVE_CONTEXT_CONFLICT:
  ActiveFlowInterventionActionSuitability = {
    suitability:
      'unsuitable',

    reason:
      'additive_context_conflict',
  }


const REPLACEMENT_CONTEXT_CONFLICT:
  ActiveFlowInterventionActionSuitability = {
    suitability:
      'unsuitable',

    reason:
      'replacement_context_conflict',
  }


/**
 * Find the semantic representation of an exact server-owned runtime
 * target.
 *
 * Identity is matched only through immutable runtime stop identity:
 *
 *   semanticStop.flowStopId === runtimeStop.id
 *
 * We deliberately do not fall back to:
 *
 * - executionIndex
 * - base position
 * - venue ID
 * - original_stop_id
 * - array position
 *
 * Those values are not interchangeable with immutable runtime-stop
 * identity.
 */
function findSemanticTargetStop({
  semanticStops,
  flowStopId,
}: {
  semanticStops:
    ActiveFlowSemanticRouteStop[]

  flowStopId:
    string
}): ActiveFlowSemanticRouteStop | null {
  return (
    semanticStops.find(
      (stop) =>
        stop.flowStopId ===
        flowStopId
    ) ??
    null
  )
}


/**
 * Convert the existing broad contextual judgment into additive Detour
 * suitability.
 *
 * A Detour preserves the original route, so its contextual burden is
 * intentionally low:
 *
 * compatible
 *   → suitable
 *
 * insufficient_context
 *   → uncertain
 *
 * incompatible
 *   → unsuitable
 *
 * No new semantic judgment is manufactured here.
 */
function evaluateDetourSuitability(
  contextualFit:
    ActiveFlowContextualFitResult
): ActiveFlowInterventionActionSuitability {
  if (
    contextualFit.fit ===
    'compatible'
  ) {
    return SUITABLE
  }

  if (
    contextualFit.fit ===
    'incompatible'
  ) {
    return ADDITIVE_CONTEXT_CONFLICT
  }

  return UNCERTAIN
}


/**
 * Evaluate whether the candidate Community Event can plausibly assume
 * the experiential role of the exact stop a Swap would replace.
 *
 * Replacement compatibility deliberately reuses the frozen 022D
 * contextual-fit authority against one exact semantic runtime stop.
 *
 * This does not create:
 *
 * - a PlanningSlot
 * - a new semantic ontology
 * - a weighted suitability score
 * - fuzzy semantic matching
 * - synonym expansion
 * - browser authority
 *
 * Missing semantic evidence remains uncertain rather than unsuitable.
 */
function evaluateSwapSuitability({
  event,
  semanticContext,
  targets,
}: {
  event:
    ActiveFlowEventSemantics

  semanticContext:
    ActiveFlowInterventionSemanticContext | null | undefined

  targets:
    ActiveFlowInterventionTargets
}): ActiveFlowInterventionActionSuitability {
  const swapTarget =
    targets.swapTarget

  /**
   * Structural target absence belongs to feasibility.
   *
   * Suitability therefore remains uncertain rather than duplicating
   * feasibility's "no_target" authority.
   */
  if (!swapTarget) {
    return UNCERTAIN
  }

  if (!semanticContext) {
    return UNCERTAIN
  }

  const semanticSwapTarget =
    findSemanticTargetStop({
      semanticStops:
        semanticContext.remainingStops,

      flowStopId:
        swapTarget.id,
    })

  /**
   * Never reconstruct or guess target semantics from venue identity,
   * execution order, base position, or other supporting fields.
   */
  if (!semanticSwapTarget) {
    return UNCERTAIN
  }

  const replacementFit =
    evaluateActiveFlowContextualFit({
      event,

      remainingStops: [
        semanticSwapTarget,
      ],
    })

  if (
    replacementFit.fit ===
    'compatible'
  ) {
    return SUITABLE
  }

  if (
    replacementFit.fit ===
    'incompatible'
  ) {
    return REPLACEMENT_CONTEXT_CONFLICT
  }

  return UNCERTAIN
}


/**
 * 022E — Deterministic Active Flow intervention suitability.
 *
 * This evaluator answers:
 *
 *   "Given the contextual evidence already established for this
 *    Community Event, is Detour or Swap an experientially appropriate
 *    intervention form?"
 *
 * It deliberately does NOT answer:
 *
 * - whether the event is trusted
 * - whether the event is discoverable
 * - whether the event is fresh
 * - whether the event is within 350m
 * - whether the opportunity is temporally actionable
 * - whether route cost is acceptable
 * - whether Swap or Detour is structurally feasible
 * - which intervention should be recommended
 * - whether any route mutation should occur
 *
 * Those decisions remain with their existing authority boundaries.
 *
 * DETOUR
 *
 * Detour is additive and preserves the original route. Its suitability
 * therefore follows the already-established broad contextual judgment.
 *
 * SWAP
 *
 * Swap is substitutive and destroys an executable route stop. Broad
 * Flow compatibility is not sufficient to prove replacement
 * compatibility, so the event is evaluated against the exact semantic
 * Swap target using the frozen contextual-fit primitive.
 *
 * CONSERVATIVE UNCERTAINTY
 *
 * Missing semantic context, missing semantic target identity, or
 * insufficient semantic evidence always yields "uncertain". This
 * evaluator never converts missing evidence into a contextual veto.
 *
 * This function is:
 *
 * - pure
 * - deterministic
 * - read-free
 * - write-free
 * - mutation-free
 * - independent of structural feasibility
 * - independent of recommendation policy
 */
export function evaluateActiveFlowInterventionSuitability({
  event,
  contextualFit,
  semanticContext,
  targets,
}: EvaluateActiveFlowInterventionSuitabilityInput): ActiveFlowInterventionSuitabilityResult {
  /**
   * Broad affirmative incompatibility applies to both intervention
   * forms.
   *
   * If the event does not belong in the remaining Active Flow at all,
   * neither adding it nor substituting it for a stop should be
   * contextually recommended.
   *
   * We intentionally short-circuit before target-specific evaluation so
   * a locally compatible target cannot override an affirmative broad
   * Flow contradiction.
   */
  if (
    contextualFit.fit ===
    'incompatible'
  ) {
    return {
      detour:
        ADDITIVE_CONTEXT_CONFLICT,

      swap:
        REPLACEMENT_CONTEXT_CONFLICT,
    }
  }

  const detour =
    evaluateDetourSuitability(
      contextualFit
    )

  const swap =
    evaluateSwapSuitability({
      event,
      semanticContext,
      targets,
    })

  return {
    detour,
    swap,
  }
}