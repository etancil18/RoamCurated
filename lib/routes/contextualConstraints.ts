
// lib/routes/contextualConstraints.ts

import {
  getExperienceRoleDefinition,
  isSameExperienceFamily,
  isSubstantialMealRole,
  resolveVenueFormat,
  type ExperienceRole,
  type ExperienceRoleResolution,
  type ExperienceVenue,
  type ExperienceVenueFormatFamily,
} from './experienceRoles'

/**
 * RoamCurated — Contextual Itinerary Constraints
 *
 * Determines whether a proposed experience makes sense
 * given the experiences already selected for a Flow.
 *
 * Responsibilities:
 * - Prevent repeated substantial meals.
 * - Enforce meal spacing when timestamps are available.
 * - Prevent duplicate venues.
 * - Protect chronological itinerary integrity.
 * - Discourage repetitive experiences.
 * - Reward complementary experience transitions.
 * - Discourage repeated venue formats across the route.
 * - Provide explainable, machine-readable decisions.
 *
 * Deliberately does NOT:
 * - Query Supabase.
 * - Determine venue opening hours.
 * - Calculate geographic distance.
 * - Resolve visit roles from raw type arrays.
 * - Mutate previously selected stops.
 * - Modify shared route stages or route scores.
 *
 * Experience roles must be resolved before evaluation
 * using experienceRoles.ts.
 */

export type ContextualFlowIntent =
  | 'standard'
  | 'food_crawl'

export type ContextualConstraintCode =
  | 'duplicate_venue'
  | 'invalid_chronology'
  | 'consecutive_substantial_meals'
  | 'insufficient_meal_spacing'
  | 'repeated_coffee_experience'
  | 'repeated_primary_experience'
  | 'repeated_experience_family'
  | 'limited_experience_variety'
  | 'complementary_transition'
  | 'meal_to_dessert'
  | 'meal_to_drinks'
  | 'meal_to_culture'
  | 'meal_to_discovery'
  | 'meal_to_outdoors'
  | 'meal_to_entertainment'
  | 'coffee_to_discovery'
  | 'drinks_to_meal'
  | 'appropriate_meal_spacing'
  | 'unknown_experience_role'

  /* =====================================================
   * CONTEXTUAL FLOW INTELLIGENCE:
   * Venue-format diversity diagnostics.
   * =================================================== */

  | 'repeated_venue_format'
  | 'limited_venue_format_variety'

export type ContextualConstraintSeverity =
  | 'hard'
  | 'soft'
  | 'positive'
  | 'informational'

export type ContextualConstraintReason = {
  code: ContextualConstraintCode
  severity: ContextualConstraintSeverity
  message: string
  scoreDelta: number
}

export type ContextualExperienceVisit = {
  /**
   * Venue identifier, when available.
   */
  venueId?: string | null

  /**
   * Resolved primary experience for this particular visit.
   */
  role: ExperienceRole | ExperienceRoleResolution

  /**
   * Expected arrival timestamp.
   */
  arriveAt?: Date | string | null

  /**
   * Expected departure timestamp.
   */
  departAt?: Date | string | null

  /**
   * Expected visit duration, when known.
   */
  dwellMinutes?: number | null

  /* =====================================================
   * CONTEXTUAL FLOW INTELLIGENCE:
   *
   * Optional raw venue metadata for format classification.
   *
   * Existing callers without this field behave exactly
   * as before: format-diversity rules are not applied
   * when venue metadata is unavailable.
   *
   * Use the same venue object already loaded by the
   * generator. No additional database query is needed.
   * =================================================== */

  venue?: ExperienceVenue | null
}

export type ContextualConstraintsConfig = {
  /**
   * Minimum time between substantial meal starts.
   *
   * Applied to nonconsecutive meals when both timestamps
   * are valid. Consecutive meals are rejected regardless
   * of spacing in standard Flows.
   */
  minimumMealStartSpacingMinutes: number

  /**
   * Maximum absolute penalty from soft preferences.
   */
  maxSoftPenalty: number

  /**
   * Maximum positive bonus from complementary transitions.
   */
  maxPositiveBonus: number

  /**
   * Whether consecutive coffee/tea experiences should
   * be hard-rejected in an ordinary Flow.
   */
  preventConsecutiveCoffee: boolean
}

export type EvaluateContextualConstraintsParams = {
  /**
   * Visits already selected, ordered chronologically.
   *
   * Include the anchor venue as the first visit.
   */
  previousVisits: readonly ContextualExperienceVisit[]

  /**
   * Candidate visit being considered for addition.
   */
  candidate: ContextualExperienceVisit

  /**
   * Standard is the safe default.
   * A food crawl requires explicit caller intent.
   */
  flowIntent?: ContextualFlowIntent

  /**
   * Override selected policy thresholds if needed.
   */
  config?: Partial<ContextualConstraintsConfig>
}

export type ContextualConstraintResult = {
  /**
   * Whether this candidate may be included.
   *
   * A negative or positive score alone never changes
   * eligibility. Only hard constraints can reject.
   */
  eligible: boolean

  /**
   * Add this to an existing candidate's final score.
   * Only applicable when eligible is true.
   */
  scoreAdjustment: number

  /**
   * All reasons in evaluation order.
   */
  reasons: ContextualConstraintReason[]

  /**
   * Hard-rejection reasons, if any.
   */
  rejectionReasons: ContextualConstraintReason[]

  /**
   * Convenience identifiers for diagnostics.
   */
  rejectionCodes: ContextualConstraintCode[]

  /**
   * Primary reason for rejection, if any.
   */
  primaryRejectionCode: ContextualConstraintCode | null
}

export const DEFAULT_CONTEXTUAL_CONSTRAINTS_CONFIG:
  Readonly<ContextualConstraintsConfig> = Object.freeze({
    minimumMealStartSpacingMinutes: 180,
    maxSoftPenalty: 36,
    maxPositiveBonus: 20,
    preventConsecutiveCoffee: true,
  })

/**
 * Main contextual policy evaluator.
 *
 * Example:
 *
 * const result = evaluateContextualConstraints({
 *   previousVisits: [
 *     {
 *       venueId: anchorVenue.id,
 *       venue: anchorVenue,
 *       role: anchorExperience,
 *       arriveAt: anchorArrival,
 *       departAt: anchorDeparture,
 *     },
 *   ],
 *   candidate: {
 *     venueId: candidate.id,
 *     venue: candidate,
 *     role: candidateExperience,
 *     arriveAt: proposedArrival,
 *     departAt: proposedDeparture,
 *   },
 * })
 *
 * if (!result.eligible) {
 *   // Exclude candidate before route selection.
 * }
 *
 * finalScore += result.scoreAdjustment
 */
export function evaluateContextualConstraints({
  previousVisits,
  candidate,
  flowIntent = 'standard',
  config = {},
}: EvaluateContextualConstraintsParams): ContextualConstraintResult {
  const policy = resolveConfig(config)
  const reasons: ContextualConstraintReason[] = []

  const history = previousVisits ?? []
  const previousVisit =
    history.length > 0
      ? history[history.length - 1]
      : null

  const candidateRole = readRole(candidate.role)
  const previousRole = previousVisit
    ? readRole(previousVisit.role)
    : null

  const candidateVenueId = normalizeVenueId(
    candidate.venueId
  )

  /* =====================================================
   * 1. Duplicate venue protection
   * =================================================== */

  if (
    candidateVenueId &&
    history.some(
      (visit) =>
        normalizeVenueId(visit.venueId) ===
        candidateVenueId
    )
  ) {
    reasons.push(
      makeReason(
        'duplicate_venue',
        'hard',
        'The venue has already been selected for this Flow.'
      )
    )
  }

  /* =====================================================
   * 2. Chronological integrity
   *
   * Reject only demonstrably inconsistent timestamps.
   * Missing timestamps remain the responsibility of the
   * timeline builder, not grounds for guessed rejection.
   * =================================================== */

  const candidateArrival = parseTimestamp(
    candidate.arriveAt
  )

  const candidateDeparture = getVisitDeparture(
    candidate
  )

  if (
    candidateArrival !== null &&
    candidateDeparture !== null &&
    candidateDeparture < candidateArrival
  ) {
    reasons.push(
      makeReason(
        'invalid_chronology',
        'hard',
        'The candidate departs before it arrives.'
      )
    )
  }

  if (previousVisit) {
    const previousDeparture =
      getVisitDeparture(previousVisit)

    if (
      candidateArrival !== null &&
      previousDeparture !== null &&
      candidateArrival < previousDeparture
    ) {
      reasons.push(
        makeReason(
          'invalid_chronology',
          'hard',
          'The candidate begins before the previous experience ends.'
        )
      )
    }
  }

  /* =====================================================
   * 3. Primary experience continuity
   *
   * In an ordinary Flow, consecutive substantial meals
   * are never an acceptable progression.
   *
   * Food crawls are explicit exceptions.
   * =================================================== */

  if (
    flowIntent !== 'food_crawl' &&
    previousRole &&
    isSubstantialMealRole(previousRole) &&
    isSubstantialMealRole(candidateRole)
  ) {
    reasons.push(
      makeReason(
        'consecutive_substantial_meals',
        'hard',
        'Two substantial meals should not appear back to back in a standard Flow.'
      )
    )
  }

  /* =====================================================
   * 4. Meal spacing across the complete itinerary
   *
   * This catches Lunch -> Gallery -> Dinner when the
   * actual elapsed time is still unreasonably short.
   *
   * Uses meal start-to-start spacing to avoid incorrectly
   * treating a long meal itself as sufficient separation.
   * =================================================== */

  if (
    flowIntent !== 'food_crawl' &&
    isSubstantialMealRole(candidateRole) &&
    candidateArrival !== null
  ) {
    const lastMeal = findLastSubstantialMeal(
      history
    )

    if (lastMeal) {
      const lastMealArrival = parseTimestamp(
        lastMeal.arriveAt
      )

      if (lastMealArrival !== null) {
        const elapsedMinutes =
          (candidateArrival - lastMealArrival) /
          60000

        if (
          elapsedMinutes >= 0 &&
          elapsedMinutes <
            policy.minimumMealStartSpacingMinutes
        ) {
          reasons.push(
            makeReason(
              'insufficient_meal_spacing',
              'hard',
              `Another substantial meal is scheduled less than ${policy.minimumMealStartSpacingMinutes} minutes after the previous meal began.`
            )
          )
        } else if (
          elapsedMinutes >=
          policy.minimumMealStartSpacingMinutes
        ) {
          reasons.push(
            makeReason(
              'appropriate_meal_spacing',
              'informational',
              'The substantial meals are separated by an appropriate planning interval.'
            )
          )
        }
      }
    }
  }

  /* =====================================================
   * 5. Avoid redundant immediate coffee stops
   *
   * This should not reject dessert, bakery visits,
   * or an intentionally food-focused itinerary.
   * =================================================== */

  if (
    policy.preventConsecutiveCoffee &&
    flowIntent !== 'food_crawl' &&
    previousRole === 'coffee_tea' &&
    candidateRole === 'coffee_tea'
  ) {
    reasons.push(
      makeReason(
        'repeated_coffee_experience',
        'hard',
        'Two consecutive coffee or tea stops add little variety to a standard Flow.'
      )
    )
  }

  /* =====================================================
   * 6. Soft experiential repetition
   *
   * Related roles may still be legitimate. These
   * preferences never prohibit selection outright.
   * =================================================== */

  if (
    previousRole &&
    previousRole !== 'unknown' &&
    candidateRole !== 'unknown'
  ) {
    if (previousRole === candidateRole) {
      if (
        !isSubstantialMealRole(candidateRole) &&
        candidateRole !== 'coffee_tea'
      ) {
        reasons.push(
          makeReason(
            'repeated_primary_experience',
            'soft',
            'The next stop repeats the previous primary experience.',
            -24
          )
        )
      }
    } else if (
      isSameExperienceFamily(
        previousRole,
        candidateRole
      )
    ) {
      reasons.push(
        makeReason(
          'repeated_experience_family',
          'soft',
          'The next stop belongs to the same broad experience family.',
          -10
        )
      )
    }
  }

  /* =====================================================
   * 7. Route-wide experience variety
   *
   * Avoid accumulating too many similar experiences
   * even when they are not immediately consecutive.
   * =================================================== */

  if (
    candidateRole !== 'unknown' &&
    flowIntent !== 'food_crawl'
  ) {
    const sameRoleCount = history.filter(
      (visit) =>
        readRole(visit.role) === candidateRole
    ).length

    if (sameRoleCount >= 2) {
      reasons.push(
        makeReason(
          'limited_experience_variety',
          'soft',
          'This experience role is already represented multiple times in the Flow.',
          -18
        )
      )
    }
  }

  /* =====================================================
   * 8. Complementary experience transitions
   *
   * This is a preference system, not a fixed stage
   * progression. Valid transitions remain optional.
   * =================================================== */

  if (
    previousRole &&
    previousRole !== 'unknown' &&
    candidateRole !== 'unknown'
  ) {
    const complementary =
      getComplementaryTransition(
        previousRole,
        candidateRole
      )

    if (complementary) {
      reasons.push(
        complementary
      )
    }
  }

  /* =====================================================
   * 9. Unknown classifications
   *
   * Never pretend that unknown means food, drinks,
   * culture, or something else.
   * =================================================== */

  if (candidateRole === 'unknown') {
    reasons.push(
      makeReason(
        'unknown_experience_role',
        'informational',
        'The venue has no confidently classified primary experience.'
      )
    )
  }

  /* =====================================================
   * CONTEXTUAL FLOW INTELLIGENCE:
   * 9A. Route-wide venue-format diversity
   *
   * A change in the assigned experience role does not
   * guarantee a genuinely different kind of venue.
   *
   * Example:
   *   Restaurant drinks -> Restaurant dinner ->
   *   Restaurant drinks
   *
   * We therefore examine the broader venue formats in
   * addition to the resolved visit roles.
   *
   * - A second consecutive dining-format venue gets
   *   a meaningful soft penalty.
   *
   * - A third dining-format venue anywhere in the route
   *   gets a stronger soft penalty.
   *
   * - Unknown formats are ignored.
   *
   * - Existing callers without the optional venue field
   *   retain their previous scoring behavior.
   *
   * - Explicit food crawls are not penalized under this
   *   format-diversity policy.
   *
   * This never becomes a hard rejection.
   * =================================================== */

  if (
    flowIntent !== 'food_crawl' &&
    candidate.venue
  ) {
    const candidateFormat =
      resolveVenueFormat(candidate.venue)

    if (
      candidateFormat.family === 'dining'
    ) {
      const previousFormatFamily =
        previousVisit?.venue
          ? resolveVenueFormat(
              previousVisit.venue
            ).family
          : null

      const precedingDiningVenueCount =
        history.reduce(
          (count, visit) => {
            if (!visit.venue) {
              return count
            }

            return (
              resolveVenueFormat(
                visit.venue
              ).family === 'dining'
            )
              ? count + 1
              : count
          },
          0
        )

      if (precedingDiningVenueCount >= 2) {
        reasons.push(
          makeReason(
            'limited_venue_format_variety',
            'soft',
            'Multiple dining-oriented venues are already present in this Flow. Another dining-format stop would reduce experiential variety.',
            -34
          )
        )
      } else if (
        previousFormatFamily === 'dining'
      ) {
        reasons.push(
          makeReason(
            'repeated_venue_format',
            'soft',
            'The next venue has the same dining-oriented format as the preceding stop, despite potentially having a different visit role.',
            -22
          )
        )
      }
    }
  }

  /* =====================================================
   * 10. Final decision
   * =================================================== */

  const rejectionReasons = reasons.filter(
    (reason) =>
      reason.severity === 'hard'
  )

  const eligible =
    rejectionReasons.length === 0

  const softPenalty = reasons
    .filter(
      (reason) =>
        reason.severity === 'soft'
    )
    .reduce(
      (sum, reason) =>
        sum + reason.scoreDelta,
      0
    )

  const positiveBonus = reasons
    .filter(
      (reason) =>
        reason.severity === 'positive'
    )
    .reduce(
      (sum, reason) =>
        sum + reason.scoreDelta,
      0
    )

  const boundedPenalty = Math.max(
    -policy.maxSoftPenalty,
    softPenalty
  )

  const boundedBonus = Math.min(
    policy.maxPositiveBonus,
    positiveBonus
  )

  return {
    eligible,
    scoreAdjustment: eligible
      ? boundedPenalty + boundedBonus
      : 0,
    reasons,
    rejectionReasons,
    rejectionCodes: rejectionReasons.map(
      (reason) => reason.code
    ),
    primaryRejectionCode:
      rejectionReasons[0]?.code ?? null,
  }
}

/**
 * Convenience function for eligibility-only callers.
 */
export function isContextuallyEligible(
  params: EvaluateContextualConstraintsParams
): boolean {
  return evaluateContextualConstraints(
    params
  ).eligible
}

/**
 * Convenience function to obtain scoring adjustments.
 *
 * A rejected candidate receives zero here, but callers
 * must still inspect eligibility and exclude it.
 */
export function getContextualScoreAdjustment(
  params: EvaluateContextualConstraintsParams
): number {
  return evaluateContextualConstraints(
    params
  ).scoreAdjustment
}

/**
 * Publicly reusable substantial meal classifier.
 */
export function isSubstantialMealExperience(
  role: ExperienceRole | ExperienceRoleResolution
): boolean {
  return isSubstantialMealRole(
    readRole(role)
  )
}

/**
 * Return the last substantial meal in a route, if present.
 */
export function findLastSubstantialMeal(
  visits: readonly ContextualExperienceVisit[]
): ContextualExperienceVisit | null {
  for (
    let index = visits.length - 1;
    index >= 0;
    index -= 1
  ) {
    const visit = visits[index]

    if (
      isSubstantialMealRole(
        readRole(visit.role)
      )
    ) {
      return visit
    }
  }

  return null
}

/**
 * Return the primary role of the last visit,
 * without mutating the itinerary.
 */
export function getPreviousExperienceRole(
  visits: readonly ContextualExperienceVisit[]
): ExperienceRole | null {
  if (visits.length === 0) {
    return null
  }

  return readRole(
    visits[visits.length - 1].role
  )
}

/* =========================================================
 * Internal helpers
 * ======================================================= */

function readRole(
  value: ExperienceRole | ExperienceRoleResolution
): ExperienceRole {
  return typeof value === 'string'
    ? value
    : value.role
}

function normalizeVenueId(
  value: string | null | undefined
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function parseTimestamp(
  value: Date | string | null | undefined
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value)

  const timestamp =
    date.getTime()

  return Number.isFinite(timestamp)
    ? timestamp
    : null
}

function getVisitDeparture(
  visit: ContextualExperienceVisit
): number | null {
  const explicitDeparture =
    parseTimestamp(visit.departAt)

  if (explicitDeparture !== null) {
    return explicitDeparture
  }

  const arrival =
    parseTimestamp(visit.arriveAt)

  if (arrival === null) {
    return null
  }

  if (
    typeof visit.dwellMinutes !== 'number' ||
    !Number.isFinite(visit.dwellMinutes) ||
    visit.dwellMinutes < 0
  ) {
    return null
  }

  return (
    arrival +
    visit.dwellMinutes * 60000
  )
}

function makeReason(
  code: ContextualConstraintCode,
  severity: ContextualConstraintSeverity,
  message: string,
  scoreDelta = 0
): ContextualConstraintReason {
  return {
    code,
    severity,
    message,
    scoreDelta,
  }
}

function resolveConfig(
  overrides: Partial<ContextualConstraintsConfig>
): ContextualConstraintsConfig {
  const defaults =
    DEFAULT_CONTEXTUAL_CONSTRAINTS_CONFIG

  return {
    minimumMealStartSpacingMinutes:
      positiveFiniteNumberOrFallback(
        overrides.minimumMealStartSpacingMinutes,
        defaults.minimumMealStartSpacingMinutes
      ),

    maxSoftPenalty:
      nonnegativeFiniteNumberOrFallback(
        overrides.maxSoftPenalty,
        defaults.maxSoftPenalty
      ),

    maxPositiveBonus:
      nonnegativeFiniteNumberOrFallback(
        overrides.maxPositiveBonus,
        defaults.maxPositiveBonus
      ),

    preventConsecutiveCoffee:
      typeof overrides.preventConsecutiveCoffee ===
      'boolean'
        ? overrides.preventConsecutiveCoffee
        : defaults.preventConsecutiveCoffee,
  }
}

function positiveFiniteNumberOrFallback(
  value: number | undefined,
  fallback: number
): number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0
  )
    ? value
    : fallback
}

function nonnegativeFiniteNumberOrFallback(
  value: number | undefined,
  fallback: number
): number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? value
    : fallback
}

/**
 * Recognize naturally complementary experiences.
 *
 * Rewards are deliberately modest: the main venue
 * scoring system continues to determine quality,
 * personalization, location and opening-hours fit.
 */
function getComplementaryTransition(
  previous: ExperienceRole,
  next: ExperienceRole
): ContextualConstraintReason | null {
  if (isSubstantialMealRole(previous)) {
    switch (next) {
      case 'dessert':
        return makeReason(
          'meal_to_dessert',
          'positive',
          'Dessert complements the preceding meal without repeating it.',
          20
        )

      case 'drinks':
        return makeReason(
          'meal_to_drinks',
          'positive',
          'Drinks provide a natural post-meal experience.',
          14
        )

      case 'culture':
        return makeReason(
          'meal_to_culture',
          'positive',
          'A cultural experience provides contrast after a meal.',
          16
        )

      case 'discovery':
        return makeReason(
          'meal_to_discovery',
          'positive',
          'Local discovery offers a change of pace after dining.',
          14
        )

      case 'outdoors':
        return makeReason(
          'meal_to_outdoors',
          'positive',
          'An outdoor experience can provide a change of pace after dining.',
          14
        )

      case 'entertainment':
        return makeReason(
          'meal_to_entertainment',
          'positive',
          'Entertainment naturally complements a completed meal.',
          18
        )

      default:
        return null
    }
  }

  if (
    previous === 'coffee_tea' &&
    (
      next === 'culture' ||
      next === 'discovery' ||
      next === 'outdoors'
    )
  ) {
    return makeReason(
      'coffee_to_discovery',
      'positive',
      'A coffee stop followed by exploration creates a natural progression.',
      14
    )
  }

  if (
    previous === 'drinks' &&
    isSubstantialMealRole(next)
  ) {
    return makeReason(
      'drinks_to_meal',
      'positive',
      'A social drinks experience can transition naturally into a meal when scheduling permits.',
      12
    )
  }

  if (
    previous !== next &&
    !isSameExperienceFamily(previous, next)
  ) {
    return makeReason(
      'complementary_transition',
      'positive',
      'The next stop introduces a different experience family.',
      8
    )
  }

  return null
}

/**
 * Optional helper for user-visible or diagnostic labels.
 */
export function describeExperienceTransition(
  previousRole: ExperienceRole,
  candidateRole: ExperienceRole
): string {
  const previousDefinition =
    getExperienceRoleDefinition(previousRole)

  const candidateDefinition =
    getExperienceRoleDefinition(candidateRole)

  return (
    `${previousDefinition.shortLabel} → ` +
    candidateDefinition.shortLabel
  )
}
