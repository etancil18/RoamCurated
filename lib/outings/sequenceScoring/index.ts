// lib/outings/sequenceScoring/index.ts

// -----------------------------------------------------------------------------
// Shared sequence-scoring types
// -----------------------------------------------------------------------------

export type {
  CandidateVenue,
  RoleCompatibleVenue,
  VenueHoursEntry,
  VenueWithHours,
} from "./types"

// -----------------------------------------------------------------------------
// Primary planner output API
// -----------------------------------------------------------------------------

export {
  buildPlanSummary,
  buildRationale,
  computeConfidenceScore,
  computeStopTiming,
  generatePlanStops,
  minimumStopsForMode,
} from "./output"

// -----------------------------------------------------------------------------
// Candidate preparation and base ranking
// -----------------------------------------------------------------------------

export {
  rankVenueCandidates,
} from "./candidateScore"

export * from "./semanticFit"
export * from "./timeFit"
export * from "./archetypeFit"
export * from "./vibeFit"
export * from "./geometryFit"
export * from "./sequenceFit"

// -----------------------------------------------------------------------------
// Sequential scoring and transition logic
// -----------------------------------------------------------------------------

export {
  computeSequentialCandidateScore,
  computeBeforeFirstStopDistanceBonus,
  computeBeforeProgressionBonus,
  computeBeforeConsumptionProgressionScore,
  computeAfterFirstStopDistanceBonus,
  computeAfterExpansionBonus,
  computeAfterDirectionalConsistencyBonus,
  computeVenueSequenceCoherenceScore,
  computeModeSpecificVenueBias,
  scoreDistanceFromAnchor,
  scoreBudgetFit,
  scoreVibeFit,
  scoreGroupFit,
  scoreArchetypeFit,
} from "./bias"

export * from "./transitions"

// -----------------------------------------------------------------------------
// Candidate selection and route search
// -----------------------------------------------------------------------------

export {
  evaluateCandidateEligibilityForSlot,
  evaluateTemporalEligibility,
  isCandidateEligibleForSlot,
  selectCandidates,
} from "./selection"

export type {
  SelectedSlotVenue,
  SelectionDebugResult,
  SlotSelectionDebug as InternalSlotSelectionDebug,
} from "./selection"

export * from "./sequenceSearch"

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

export * from "./validation"

// -----------------------------------------------------------------------------
// Planner diagnostics
// -----------------------------------------------------------------------------

export {
  buildCandidateDebugSnapshots,
  buildPlannerDebugSummary,
  buildSelectionDebug,
  computeRouteVibeConfidence,
  summarizeRejections,
  summarizeSelectionPasses,
} from "./debug"

export type {
  CandidateDebugSnapshot,
  PlannerDebugSummary,
  RejectionSummary,
  SelectionPassSummary,
} from "./debug"

// -----------------------------------------------------------------------------
// Role interpretation
// -----------------------------------------------------------------------------

export {
  candidateSupportsSlot,
  computeSlotRoleFitBonus,
  inferVenueRoles,
  pickBestDisplayTypeForRole,
  pickRoleForSlot,
} from "./roles"

// -----------------------------------------------------------------------------
// Geometry and travel utilities
// -----------------------------------------------------------------------------

export {
  estimateTravelMinutes,
  getDistanceBetweenVenues,
  getMaxAfterInterstopMeters,
  getMaxAfterLocalFallbackMeters,
  getMaxBeforeInterstopMeters,
  inferTravelMode,
  isAfterSequenceDirectionallyConsistent,
  isSpatiallyCoherentInterstop,
  isTooFarForAfterFirstStop,
  isTooFarForBeforeFirstStop,
} from "./geometry"

// -----------------------------------------------------------------------------
// Time and temporal eligibility
// -----------------------------------------------------------------------------

export {
  addMinutes,
  getHourFractionInTimeZone,
  resolvePlannerTimeZone,
} from "./time"

export {
  computeTemporalFitPenalty,
  isLateNightFallbackVenueTemporallyEligible,
  isRoleTemporallyCompatible,
  isVenueOpenForWindow,
  isVenueOpenUntilAtLeastTwoAm,
} from "./temporal"

// -----------------------------------------------------------------------------
// Late-night and reduced-coverage fallbacks
// -----------------------------------------------------------------------------

export {
  isLateNightAfterFallbackContext,
  isLateNightNightlifeType,
  qualifiesForLateNightReducedFullFallback,
  qualifiesForLateNightSingleStopFallback,
} from "./lateNight"

export {
  qualifiesForDaytimeCultureReducedFullFallback,
  qualifiesForReducedBeforeSingleStopFallback,
} from "./daytime"

// -----------------------------------------------------------------------------
// Normalization and shared scoring helpers
// -----------------------------------------------------------------------------

export {
  hasAnyType,
  isCoffeeLikeVenue,
  isMealLikeVenue,
  normalizeDisplayVenueType,
  normalizePrice,
  normalizeStringArray,
  normalizeVenueTypes,
  priceToInt,
  uniqueStrings,
} from "./helpers"