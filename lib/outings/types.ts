// lib/outings/types.ts

// ---------- Core Enums / Primitives ----------

export type PlanMode = "before" | "after" | "full"
export type Budget = "$" | "$$" | "$$$" | "$$$$"
export type Mobility = "walk" | "short_ride" | "any"

export type StopRole =
  | "coffee"
  | "food"
  | "drink"
  | "activity"
  | "dessert"

export type TravelMode = "walk" | "drive" | "transit" | "rideshare"
export type SlotPhase = "before" | "after"

export type SelectionPass =
  | "strict"
  | "balanced"
  | "relaxed"
  | "emergency"

// ---------- Shared Venue Data Shapes ----------

export type VenueStringCollection = string | string[] | null

export type VenueHoursEntry = {
  open?: string | null
  close?: string | null
}

export type VenueHours =
  | Record<string, VenueHoursEntry>
  | string
  | null

// ---------- Vibe-Aware Planning ----------

export type VibeDaypart =
  | "early_morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "late_night"

export type VibeSequenceTemplate = {
  mode: PlanMode | "full"
  roles: StopRole[]
  preferredTypesByRole?: Partial<Record<StopRole, string[]>>
}

export type VibePlanningProfile = {
  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]

  preferredDayparts: VibeDaypart[]
  discouragedDayparts: VibeDaypart[]

  fallbackTypePriority: string[]
  sequenceTemplates: VibeSequenceTemplate[]

  matchedPresetIds?: string[]
  expandedTokens?: string[]
}

// ---------- City-Aware Planning ----------

export type CityPlanningConfig = {
  distances: {
    beforeInterstopMeters: {
      strict: number
      relaxed: number
    }
    afterInterstopMeters: {
      strict: number
      relaxed: number
    }
    maxAnchorDistanceMeters: {
      walk: number
      short_ride: number
      any: number
    }
  }
}

// ---------- Exit-Aware Planning ----------

export type LeaveEarlyByHours = 1 | 2 | 3 | 4

// ---------- Booking Layer ----------

export type BookingProvider =
  | "opentable"
  | "resy"
  | "tock"
  | "sevenrooms"
  | "manual"

export type VenueBookingOption = {
  provider: BookingProvider | string
  url: string
}

// ---------- Core Domain Records ----------

export type VenueRecord = {
  id: string
  name: string | null

  slug?: string | null
  city: string | null

  lat: number | null
  lon: number | null
  address: string | null

  description?: string | null

  /**
   * Database source fields.
   *
   * These intentionally accept both scalar and array forms because legacy
   * records and Supabase payloads may not always share an identical shape.
   */
  tags?: VenueStringCollection
  vibe?: VenueStringCollection
  type?: VenueStringCollection
  time_category?: VenueStringCollection

  /**
   * Optional structured venue characteristics available in the venues table.
   *
   * energy_ramp remains optional and should be treated as weak supporting
   * evidence until venue coverage is sufficiently complete.
   */
  energy_ramp?: number | null
  duration?: number | null
  tier?: string | null
  price?: string | number | null

  hours?: VenueHours

  instagram_handle?: string | null
  website_url?: string | null
  events_url?: string | null
  contact?: VenueStringCollection
  cover?: string | null

  profile_status?: string | null
  last_verified_at?: string | null

  bookingOptions?: VenueBookingOption[] | null
}

export type EventRecord = {
  id: string
  title: string | null
  description: string | null
  archetype?: string | null
  starts_at: string | null
  ends_at: string | null
  tags: string[] | string | null
  venue_id: string | null
}

// ---------- Planning / Slot Intent ----------

export type PlanningSlot = {
  index: number
  role: StopRole
  phase: SlotPhase

  targetArrivalAt: Date
  targetDepartureAt: Date
  dwellMinutes: number

  strictProgression: boolean
  flexibleRole?: StopRole | null

  /**
   * Semantic roles remain internal planner hints until their confidence is
   * high enough to expose directly in the user interface.
   */
  semanticRole?: string | null

  /**
   * Slot-specific vibe requirements.
   */
  vibePreferredTypes?: string[]
  vibeRequiredAnyTypes?: string[]
  vibeDiscouragedTypes?: string[]

  /**
   * Future-safe semantic matching hints.
   *
   * These are optional so existing slot builders continue to compile without
   * requiring immediate changes.
   */
  preferredTags?: string[]
  preferredVibes?: string[]
  discouragedTags?: string[]
  discouragedVibes?: string[]
  targetEnergyRamp?: number | null
  maximumEnergyRamp?: number | null
}

export type PlanningContext = {
  mode: PlanMode
  timeZone: string
  cityPlanning?: CityPlanningConfig | null

  startsAt: Date
  estimatedEndAt: Date
  plannedStartAt: Date
  plannedEndAt: Date

  leaveEarlyByHours?: LeaveEarlyByHours | null
  plannedExitAt?: Date | null
  effectiveExitAt?: Date | null

  eventTags: string[]
  eventArchetype: string

  desiredRoles: StopRole[]
  slots?: PlanningSlot[]

  groupSize: number | null
  budget: Budget | null
  mobility: Mobility

  vibeTags: string[]
  vibePlanning?: VibePlanningProfile | null

  anchorVenue: VenueRecord | null
}

// ---------- Candidate / Scoring Layer ----------

export type CandidateVenue = VenueRecord & {
  inferredRoles: StopRole[]
  distanceMeters: number | null
  score: number
}

export type CandidateSemanticMatch = {
  matchedTags: string[]
  matchedVibes: string[]
  matchedTypes: string[]
  matchedTimeCategories: string[]

  semanticScore: number
  vibeScore: number
  tagScore: number
  typeScore: number
  timeCategoryScore: number
  energyScore: number

  confidence: number
}

export type CandidateScoreComponents = {
  /**
   * Existing component names remain required for backward compatibility.
   */
  roleFit: number
  distance: number
  budget: number
  vibe: number
  archetype: number
  group: number

  /**
   * New semantic-first components are optional until the scoring engine is
   * migrated to populate them.
   */
  tags?: number
  venueVibes?: number
  venueType?: number
  timeCategory?: number
  energyRamp?: number
  hours?: number
  sequence?: number

  vibeRequired?: number
  vibeDaypart?: number
  vibePenalty?: number
  semanticFit?: number
}

export type PreparedCandidateVenue = VenueRecord & {
  normalizedType: string
  inferredRoles: StopRole[]

  anchorDistanceMeters: number | null
  hasKnownHours: boolean

  normalizedTags?: string[]
  normalizedVibes?: string[]
  normalizedTypes?: string[]
  normalizedTimeCategories?: string[]

  semanticMatch?: CandidateSemanticMatch | null
  scoreComponents: CandidateScoreComponents

  score: number
}

// ---------- Debug / Diagnostics ----------

export type SlotRejectionCounts = {
  used: number
  role: number
  geometry: number
  temporal: number
  type_time: number
  hours: number
  missing_data: number

  vibe_required?: number
  vibe_discouraged?: number

  semantic_mismatch?: number
  tag_mismatch?: number
  venue_vibe_mismatch?: number
  energy_mismatch?: number
  time_category_mismatch?: number
}

export type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: SlotPhase

  selectedVenueId: string | null
  selectedPass?: SelectionPass | null

  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number

  rejectionCounts: SlotRejectionCounts

  selectedScore?: number | null
  selectedSemanticScore?: number | null
  selectedVibeScore?: number | null
  selectedMatchedTags?: string[]
  selectedMatchedVibes?: string[]
  selectedMatchedTypes?: string[]
}

export type VibeSelectionDiagnostics = {
  requestedVibes: string[]

  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]

  preferredDayparts: VibeDaypart[]
  discouragedDayparts: VibeDaypart[]

  matchedCandidateCount?: number
  rejectedCandidateCount?: number

  routeVibeConfidence?: number | null
}

export type SemanticSelectionDiagnostics = {
  eventTokens: string[]

  matchedCandidateCount?: number
  weakMatchCandidateCount?: number
  rejectedCandidateCount?: number

  averageSemanticScore?: number | null
  routeSemanticConfidence?: number | null

  selectedVenueMatches?: Array<{
    venueId: string
    matchedTags: string[]
    matchedVibes: string[]
    matchedTypes: string[]
    matchedTimeCategories: string[]
    semanticScore: number
  }>
}

export type SelectionDebug = {
  candidatePoolSize: number
  preparedCandidateCount: number
  selectedStopCount: number
  completionRate: number

  slotDiagnostics: SlotSelectionDebug[]

  vibeDiagnostics?: VibeSelectionDiagnostics | null
  semanticDiagnostics?: SemanticSelectionDiagnostics | null
}

// ---------- Generated Stops / Planner Output ----------

export type GeneratedOutingStopMetadata = {
  venueName?: string | null
  venueAddress?: string | null

  score?: number | null
  scoreComponents?: Partial<CandidateScoreComponents> | null

  inferredRoles?: StopRole[]

  venueTypes?: string[]
  venueTags?: string[]
  venueVibes?: string[]
  venueTimeCategories?: string[]

  venueType?: string | null
  displayType?: string | null
  appliedDisplayType?: string | null

  selectedPass?: SelectionPass | null

  eventArchetype?: string | null
  semanticRole?: string | null
  slotPhase?: SlotPhase | null
  slotIndex?: number | null

  vibeTags?: string[]
  vibePreferredTypes?: string[]
  vibeRequiredAnyTypes?: string[]
  vibeDiscouragedTypes?: string[]

  vibeMatchedTypes?: string[]
  vibeMatchedTokens?: string[]
  vibeScore?: number | null
  vibeConfidence?: number | null

  matchedEventTags?: string[]
  matchedVenueTags?: string[]
  matchedVenueVibes?: string[]
  matchedVenueTypes?: string[]
  matchedTimeCategories?: string[]

  /**
   * Aggregate semantic result retained for compatibility with the initial
   * semantic-first planner implementation.
   */
  semanticScore?: number | null
  semanticConfidence?: number | null

  /**
   * Component-level fit values emitted by the reconfigured scoring modules.
   *
   * These remain optional because persisted plans created before the scoring
   * migration will not contain them.
   */
  semanticFitScore?: number | null
  semanticFitConfidence?: number | null

  archetypeFitScore?: number | null
  archetypeFitConfidence?: number | null

  vibeFitScore?: number | null
  vibeFitConfidence?: number | null

  timeFitScore?: number | null
  timeFitConfidence?: number | null

  geometryFitScore?: number | null
  geometryFitConfidence?: number | null

  sequenceFitScore?: number | null
  sequenceFitConfidence?: number | null

  roleFitScore?: number | null
  candidateScore?: number | null

  /**
   * Energy remains weak supporting evidence because venue coverage is partial.
   */
  energyScore?: number | null
  energyEvidenceUsed?: boolean
}

export type GeneratedOutingStop = {
  id?: string
  venueId: string
  stopOrder: number

  role: StopRole
  phase?: SlotPhase | null

  venueType?: string | null
  displayType?: string | null

  title: string
  rationale?: string | null

  plannedArrivalAt?: string | null
  plannedDepartureAt?: string | null

  dwellMinutes?: number | null
  travelMode?: TravelMode | null
  distanceMetersFromPrev?: number | null
  travelMinutesFromPrev?: number | null

  lat?: number | null
  lon?: number | null
  address?: string | null

  metadata?: GeneratedOutingStopMetadata | null

  bookingOptions?: VenueBookingOption[] | null
  reservationRecommended?: boolean
  recommendedReservationAt?: string | null
}

export type BuildPlanSummaryInput = {
  mode: PlanMode
  eventTitle: string | null
  venueName: string | null
  stops: GeneratedOutingStop[]
  planningContext: PlanningContext
}

export type GenerateEventOutingPlanInput = {
  mode: PlanMode
  event: EventRecord
  anchorVenue: VenueRecord | null
  candidateVenues: VenueRecord[]

  groupSize?: number | null
  budget?: Budget | null
  mobility?: Mobility

  vibeTags?: string[]

  timeZone?: string | null
  cityPlanning?: CityPlanningConfig | null
  leaveEarlyByHours?: LeaveEarlyByHours | null
}

export type GenerateEventOutingScoreBreakdown = {
  mode: PlanMode
  city: string | null

  eventTags: string[]
  eventArchetype: string

  candidatePoolSize: number
  selectedStops: number
  preparedCandidateCount: number

  intendedStopCount: number
  effectiveIntendedStopCount: number
  completionRate: number

  failedToGenerateStops: boolean
  reducedBeforeSingleStopFallbackApplied: boolean

  leaveEarlyByHours: LeaveEarlyByHours | null
  plannedExitAt: string | null
  effectiveExitAt: string | null

  vibeTags?: string[]
  vibePreferredTypes?: string[]
  vibeRequiredAnyTypes?: string[]
  vibeDiscouragedTypes?: string[]
  vibeStronglyDiscouragedTypes?: string[]

  routeVibeConfidence?: number | null
  routeSemanticConfidence?: number | null

  averageSelectedSemanticScore?: number | null
  averageSelectedVibeScore?: number | null
  averageSelectedTagScore?: number | null
}

export type GenerateEventOutingPlanResult = {
  source: "event" | "venue_fallback"
  mode: PlanMode

  eventArchetype: string
  eventTags: string[]

  confidenceScore: number

  plannedStartAt: string
  plannedEndAt: string
  estimatedEndAt: string

  leaveEarlyByHours?: LeaveEarlyByHours | null
  plannedExitAt?: string | null
  effectiveExitAt?: string | null

  summary: string
  stops: GeneratedOutingStop[]

  debug?: SelectionDebug | null

  scoreBreakdown: GenerateEventOutingScoreBreakdown
}

// ---------- API Contracts ----------

export type PlanOutingRequestBody = {
  mode?: PlanMode
  groupSize?: number
  budget?: Budget
  mobility?: Mobility
  vibeTags?: string[] | string
  leaveEarlyByHours?: LeaveEarlyByHours | null
}

export type PlannedOutingStopRecord = {
  id: string
  planned_outing_id: string
  venue_id: string | null

  stop_order: number | null
  role: StopRole | null

  title: string | null
  rationale: string | null

  planned_arrival_at: string | null
  planned_departure_at: string | null

  distance_meters_from_prev: number | null
  travel_minutes_from_prev: number | null

  metadata?: GeneratedOutingStopMetadata | null
}

export type PlannedOutingRecord = {
  id: string

  user_id?: string | null
  event_id?: string | null

  mode: PlanMode | null
  summary: string | null
  confidence_score: number | null

  planned_start_at: string | null
  planned_end_at: string | null
  estimated_end_at: string | null

  metadata?: Record<string, unknown> | null
}

export type PersistGeneratedOutingPlanInput = {
  userId: string
  eventId: string
  plan: GenerateEventOutingPlanResult

  leaveEarlyByHours?: LeaveEarlyByHours | null
  plannedExitAt?: string | null
}