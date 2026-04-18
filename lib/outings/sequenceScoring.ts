// lib/outings/sequenceScoring.ts

export type {
  CandidateVenue,
  RoleCompatibleVenue,
  VenueHoursEntry,
  VenueWithHours,
} from "./sequenceScoring/types"

export {
  rankVenueCandidates,
} from "./sequenceScoring/rank"

export {
  generatePlanStops,
  computeStopTiming,
  buildPlanSummary,
  computeConfidenceScore,
  buildRationale,
  minimumStopsForMode,
} from "./sequenceScoring/output"

export {
  buildSelectionDebug,
  selectCandidates,
  evaluateCandidateEligibilityForSlot,
  evaluateTemporalEligibility,
  isCandidateEligibleForSlot,
} from "./sequenceScoring/selection"

export {
  inferVenueRoles,
  pickRoleForSlot,
  pickRoleForIndex,
  candidateSupportsSlot,
  getAcceptableRolesForSlot,
  computeSlotRoleFitBonus,
  pickBestDisplayTypeForRole,
  getPrimaryDisplayVenueType,
} from "./sequenceScoring/roles"

export {
  isVenueTemporallyEligible,
  isRoleTemporallyCompatible,
  isVenueOpenForWindow,
  isVenueOpenUntilAtLeastTwoAm,
  isLateNightFallbackVenueTemporallyEligible,
  parseTimeToMinutes,
} from "./sequenceScoring/temporal"

export {
  qualifiesForLateNightSingleStopFallback,
  qualifiesForLateNightReducedFullFallback,
  isLateNightAfterFallbackContext,
  isLateNightNightlifeType,
  endsAfterMidnight,
} from "./sequenceScoring/lateNight"

export {
  computeSequentialCandidateScore,
  computeBeforeFirstStopDistanceBonus,
  computeBeforeProgressionBonus,
  computeBeforeConsumptionProgressionScore,
  computeAfterFirstStopDistanceBonus,
  computeAfterExpansionBonus,
  computeAfterDirectionalConsistencyBonus,
  computeModeSpecificVenueBias,
  scoreDistanceFromAnchor,
  scoreBudgetFit,
  scoreVibeFit,
  scoreGroupFit,
  scoreArchetypeFit,
} from "./sequenceScoring/bias"

export {
  haversineMeters,
  getDistanceBetweenVenues,
  inferTravelMode,
  estimateTravelMinutes,
  isTooFarForBeforeFirstStop,
  isTooFarForAfterFirstStop,
  getMaxAfterInterstopMeters,
  getMaxAfterLocalFallbackMeters,
  getFirstPostEventSelectedStop,
  isAfterSequenceDirectionallyConsistent,
} from "./sequenceScoring/geometry"

export {
  DEFAULT_TIME_ZONE,
  resolvePlannerTimeZone,
  resolvePlannerTimeZoneFromCity,
  addMinutes,
  getHourFractionInTimeZone,
  getLocalMinutesInDay,
  getDayKey,
  getPreviousDayKey,
  getCalendarDayKey,
} from "./sequenceScoring/time"

export {
  normalizePrice,
  priceToInt,
  normalizeTags,
  normalizeVenueType,
  normalizeVenueTypes,
  normalizeDisplayVenueType,
  normalizeStringArray,
  normalizeVenueHours,
  hasAnyType,
  isCoffeeLikeVenue,
  isMealLikeVenue,
  uniqueStrings,
  uniqueRoles,
  humanizeRole,
} from "./sequenceScoring/helpers"