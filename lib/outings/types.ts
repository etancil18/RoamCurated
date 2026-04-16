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
export type SelectionPass = "strict" | "balanced" | "relaxed"

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
}

export type EventRecord = {
  id: string
  title: string | null
  description: string | null
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
}

export type PlanningContext = {
  mode: PlanMode
  startsAt: Date
  estimatedEndAt: Date
  plannedStartAt: Date
  plannedEndAt: Date

  eventTags: string[]
  eventArchetype: string

  // Backward-compatible with current planner
  desiredRoles: StopRole[]

  // Forward-compatible slot intent for improved sequencing
  slots?: PlanningSlot[]

  groupSize: number | null
  budget: Budget | null
  mobility: Mobility
  vibeTags: string[]

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
  }
  score: number
}

// ---------- Debug / Diagnostics ----------

export type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: SlotPhase
  selectedVenueId: string | null
  selectedPass: SelectionPass | null
  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number
  rejectionCounts: {
    used: number
    role: number
    geometry: number
    temporal: number
    hours: number
    missing_data: number
  }
}

export type PlanDebug = {
  candidatePoolSize: number
  preparedCandidateCount: number
  selectedStopCount: number
  completionRate: number
  slotDiagnostics: SlotSelectionDebug[]
}

// ---------- Generated Stops ----------

export type GeneratedOutingStop = {
  venueId: string
  stopOrder: number

  // Internal planner role used for selection / analytics
  role: StopRole

  // User-facing specificity derived from the actual venue record
  venueType?: string | null
  displayType?: string | null

  title: string
  rationale: string

  plannedArrivalAt: string | null
  plannedDepartureAt: string | null
  dwellMinutes: number

  travelMode: TravelMode
  travelMinutesFromPrev: number | null
  distanceMetersFromPrev: number | null

  metadata: {
    venueName: string | null
    venueAddress: string | null
    score: number
    inferredRoles: StopRole[]

    // Actual venue/display labeling
    venueType?: string | null
    displayType?: string | null

    // Forward-compatible debugging / inspection fields
    normalizedType?: string
    anchorDistanceMeters?: number | null
    selectedPass?: SelectionPass | null
    usedFallback?: boolean
    hoursVerified?: boolean
    scoreComponents?: {
      roleFit?: number
      distance?: number
      budget?: number
      vibe?: number
      archetype?: number
      group?: number
      progression?: number
      modeBias?: number
    }
  }
}

// ---------- Generator Input ----------

export type GenerateEventOutingPlanInput = {
  mode: PlanMode
  event: EventRecord
  anchorVenue: VenueRecord | null
  candidateVenues: VenueRecord[]

  groupSize?: number | null
  budget?: Budget | null
  mobility?: Mobility
  vibeTags?: string[]
}

// ---------- Generator Output ----------

export type GenerateEventOutingPlanResult = {
  source: "event" | "venue_fallback"

  mode: PlanMode
  eventArchetype: string
  eventTags: string[]

  confidenceScore: number

  plannedStartAt: string
  plannedEndAt: string
  estimatedEndAt: string

  summary: string

  stops: GeneratedOutingStop[]

  scoreBreakdown: {
    mode: PlanMode
    city: string | null
    eventTags: string[]
    eventArchetype: string
    candidatePoolSize: number
    selectedStops: number
    preparedCandidateCount?: number
    completionRate?: number
  }

  debug?: PlanDebug
}

// ---------- API Layer Types ----------

export type PlanOutingRequestBody = {
  mode?: PlanMode
  groupSize?: number
  budget?: Budget
  mobility?: Mobility
  vibeTags?: string[]
}

export type PlanOutingResponse = {
  success: boolean
  plannedOutingId: string
  status: string

  mode: PlanMode
  summary: string
  confidenceScore: number

  anchor?: {
    eventId?: string
    title?: string | null
    startsAt?: string | null
    endsAt?: string | null
    venue?: {
      id?: string | null
      name?: string | null
      city?: string | null
      address?: string | null
    } | null
  }

  stops: GeneratedOutingStop[]

  error?: string
  debug?: PlanDebug
}