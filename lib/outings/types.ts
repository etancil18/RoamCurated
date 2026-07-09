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
export type SelectionPass = "strict" | "balanced" | "relaxed" | "emergency"

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

export type BookingProvider = "opentable" | "resy" | "tock" | "sevenrooms" | "manual"

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
  tags?: string[] | null
  vibe?: string[] | null
  type?: string[] | null
  time_category?: string[] | null
  price?: string | number | null
  hours?: Record<string, { open?: string | null; close?: string | null }> | null
  bookingOptions?: VenueBookingOption[] | null
}

export type EventRecord = {
  id: string
  title: string | null
  description: string | null
  archetype?: string | null
  starts_at: string | null
  ends_at: string | null
  tags: string[] | null
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
  semanticRole?: string | null
  vibePreferredTypes?: string[]
  vibeRequiredAnyTypes?: string[]
  vibeDiscouragedTypes?: string[]
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

export type PreparedCandidateVenue = VenueRecord & {
  normalizedType: string
  inferredRoles: StopRole[]
  anchorDistanceMeters: number | null
  hasKnownHours: boolean
  scoreComponents: {
    roleFit: number
    distance: number
    budget: number
    vibe: number
    archetype: number
    group: number
    vibeRequired?: number
    vibeDaypart?: number
    vibePenalty?: number
  }
  score: number
}

// ---------- Debug / Diagnostics ----------

export type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: SlotPhase
  selectedVenueId: string | null
  selectedPass?: SelectionPass | null
  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: {
    used: number
    role: number
    geometry: number
    temporal: number
    type_time: number
    hours: number
    missing_data: number
    vibe_required?: number
    vibe_discouraged?: number
  }
}

export type SelectionDebug = {
  candidatePoolSize: number
  preparedCandidateCount: number
  selectedStopCount: number
  completionRate: number
  slotDiagnostics: SlotSelectionDebug[]
  vibeDiagnostics?: {
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
  } | null
}

// ---------- Generated Stops / Planner Output ----------

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

  metadata?: {
    venueName?: string | null
    venueAddress?: string | null
    score?: number | null
    inferredRoles?: StopRole[]
    venueTypes?: string[]
    venueType?: string | null
    displayType?: string | null
    appliedDisplayType?: string | null
    selectedPass?: SelectionPass | null
    eventArchetype?: string | null
    semanticRole?: string | null
    slotPhase?: SlotPhase | null
    slotIndex?: number | null
    vibeMatchedTypes?: string[]
    vibeScore?: number | null
    vibeConfidence?: number | null
  } | null

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
  scoreBreakdown: {
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
    vibeDiscouragedTypes?: string[]
    routeVibeConfidence?: number | null
  }
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
  metadata?: {
    venueType?: string | null
    displayType?: string | null
    bookingOptions?: VenueBookingOption[] | null
    reservationRecommended?: boolean
    recommendedReservationAt?: string | null
    eventArchetype?: string | null
    semanticRole?: string | null
    slotPhase?: SlotPhase | null
    slotIndex?: number | null
    vibeMatchedTypes?: string[]
    vibeScore?: number | null
    vibeConfidence?: number | null
  } | null
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