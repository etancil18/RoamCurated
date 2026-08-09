// types/social-group-dashboard.ts

// ============================================================
// Shared Social Group Dashboard analytics contracts
//
// These types mirror the server response shapes returned by:
//
//   GET /api/social-groups/[groupId]/metrics
//
//   GET /api/social-groups/[groupId]/events/[eventId]/metrics
//
// IMPORTANT:
//   Keep this file presentation-agnostic.
//   Components should consume these contracts rather than
//   redefining analytics types locally.
// ============================================================


// ============================================================
// CORE GROUP
// ============================================================

export type SocialGroupDashboardGroup = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
}


// ============================================================
// ANALYTICS REFRESH
// ============================================================

export type SocialGroupEventRefreshResult = {
  eventId: string
  refreshed: boolean
  error?: string
  result?: unknown
}

export type SocialGroupRefreshSummary = {
  attempted: number
  succeeded: number
  failed: number
  results: SocialGroupEventRefreshResult[]
}


// ============================================================
// GROUP-LEVEL METRICS
//
// Returned by:
//   /api/social-groups/[groupId]/metrics
// ============================================================

export type SocialGroupDashboardMetrics = {
  groupId: string

  // ----------------------------------------------------------
  // Existing / backward-compatible summary metrics
  // ----------------------------------------------------------

  totalEvents: number
  totalCheckins: number
  uniqueAttendees: number
  repeatAttendees: number
  totalXpAwarded: number

  // ----------------------------------------------------------
  // Canonical attendance
  // ----------------------------------------------------------

  explicitEventCheckins: number
  venueOnlyAttendees: number
  bothCheckinAndVenueVisit: number

  // ----------------------------------------------------------
  // Engagement / intent
  // ----------------------------------------------------------

  interestedUsers: number
  ticketClicks: number
  outingPlannerOpens: number

  // ----------------------------------------------------------
  // Observed surrounding movement
  // ----------------------------------------------------------

  attendeesWithBeforeMovement: number
  attendeesWithAfterMovement: number
  attendeesWithBeforeAndAfterMovement: number

  beforeVenueVisits: number
  afterVenueVisits: number

  // ----------------------------------------------------------
  // Group attendance history
  //
  // This is behavioral attendance history.
  // It is NOT social group membership status.
  // ----------------------------------------------------------

  firstTimeAttendees: number

  // ----------------------------------------------------------
  // Proven Roam attribution only
  // ----------------------------------------------------------

  flowStarts: number
  flowCompletions: number
  flowVenueStops: number
}


// ============================================================
// GROUP EVENT ROW
//
// Returned inside the events array by:
//   /api/social-groups/[groupId]/metrics
// ============================================================

export type SocialGroupEventMetric = {
  eventId: string
  title: string | null
  startsAt: string | null

  // ----------------------------------------------------------
  // Backward-compatible fields
  // ----------------------------------------------------------

  checkins: number
  uniqueAttendees: number
  xpAwarded: number

  // ----------------------------------------------------------
  // Attendance breakdown
  // ----------------------------------------------------------

  explicitEventCheckins: number
  venueOnlyAttendees: number
  bothCheckinAndVenueVisit: number

  // ----------------------------------------------------------
  // Engagement
  // ----------------------------------------------------------

  interestedUsers: number
  ticketClicks: number
  outingPlannerOpens: number

  // ----------------------------------------------------------
  // Observed movement
  // ----------------------------------------------------------

  beforeVenueVisitors: number
  afterVenueVisitors: number
  bothBeforeAndAfter: number

  beforeVenueVisitCount: number
  afterVenueVisitCount: number

  // ----------------------------------------------------------
  // Group attendance history
  // ----------------------------------------------------------

  firstTimeGroupAttendees: number
  repeatGroupAttendees: number

  // ----------------------------------------------------------
  // Proven Roam attribution only
  // ----------------------------------------------------------

  flowStarts: number
  flowCompletions: number
  flowVenueStops: number

  // ----------------------------------------------------------
  // Event / analytics context
  // ----------------------------------------------------------

  venueId: string | null

  eventStart: string | null
  eventEnd: string | null
  eventTimezone: string | null

  beforeWindowStart: string | null
  afterWindowEnd: string | null

  calculationVersion: number | null
  calculatedAt: string | null
}


// ============================================================
// GROUP-LEVEL ATTENDEE INSIGHT
//
// Returned inside attendees by:
//   /api/social-groups/[groupId]/metrics
//
// This is deliberately compact.
// ============================================================

export type SocialGroupAttendeeInsight = {
  userId: string

  // Existing compatibility
  checkins: number
  xpEarned: number
  firstCheckinAt: string | null
  lastCheckinAt: string | null

  // Canonical analytics
  eventsAttended: number
  isRepeatAttendee: boolean

  eventsWithBeforeMovement: number
  eventsWithAfterMovement: number
}


// ============================================================
// GROUP DASHBOARD RESPONSE
//
// GET /api/social-groups/[groupId]/metrics
// ============================================================

export type SocialGroupDashboardResponse = {
  group: SocialGroupDashboardGroup

  metrics: SocialGroupDashboardMetrics

  events: SocialGroupEventMetric[]

  attendees: SocialGroupAttendeeInsight[]

  refresh: SocialGroupRefreshSummary
}


// ============================================================
// MOVEMENT VENUE
// ============================================================

export type SocialGroupMovementVenue = {
  venueId: string
  venueName: string | null
  city: string | null
  attendeeCount: number
}


// ============================================================
// EVENT DETAIL
// ============================================================

export type SocialGroupEventVenue = {
  id: string
  name: string | null
  city: string | null
}

export type SocialGroupEventDetail = {
  id: string
  title: string | null
  description: string | null

  startsAt: string | null
  endsAt: string | null

  venueId: string | null
  venue: SocialGroupEventVenue | null
}


// ============================================================
// EVENT DETAIL — ATTENDANCE
// ============================================================

export type SocialGroupEventAttendanceMetrics = {
  uniqueAttendees: number

  explicitEventCheckins: number

  eventCheckinOnly: number
  venueVisitOnly: number
  bothCheckinAndVenueVisit: number

  firstTimeGroupAttendees: number
  repeatGroupAttendees: number

  // Percent values are expressed as numbers such as:
  //   42.7
  //
  // null means the denominator was zero.
  explicitCheckinRate: number | null
  repeatAttendanceRate: number | null
}


// ============================================================
// EVENT DETAIL — ENGAGEMENT
// ============================================================

export type SocialGroupEventEngagementMetrics = {
  interestedUsers: number
  ticketClicks: number
  outingPlannerOpens: number

  // Percentage, or null when no denominator exists.
  interestToAttendanceRate: number | null
}


// ============================================================
// EVENT DETAIL — OBSERVED MOVEMENT
//
// IMPORTANT:
//   These metrics represent observed movement.
//   They do NOT prove Roam caused the movement.
// ============================================================

export type SocialGroupEventObservedMovementMetrics = {
  attendeesWithBeforeMovement: number
  attendeesWithAfterMovement: number
  attendeesWithBeforeAndAfterMovement: number
  attendeesWithAnyMovement: number

  beforeVenueVisitCount: number
  afterVenueVisitCount: number

  totalAdditionalVenueVisits: number

  averageAdditionalVenueVisitsPerAttendee: number

  // Percentage, or null when no denominator exists.
  surroundingMovementRate: number | null

  topBeforeVenues: SocialGroupMovementVenue[]
  topAfterVenues: SocialGroupMovementVenue[]
}


// ============================================================
// EVENT DETAIL — ROAM ATTRIBUTION
//
// These values should only reflect movement that can be proven
// through Roam Flow/session data.
// ============================================================

export type SocialGroupEventRoamAttributedMetrics = {
  flowStarts: number
  flowCompletions: number
  flowVenueStops: number
}


// ============================================================
// EVENT DETAIL — XP
// ============================================================

export type SocialGroupEventXpMetrics = {
  generated: number
}


// ============================================================
// EVENT DETAIL — COMBINED METRICS
// ============================================================

export type SocialGroupEventDetailMetrics = {
  attendance: SocialGroupEventAttendanceMetrics
  engagement: SocialGroupEventEngagementMetrics
  observedMovement: SocialGroupEventObservedMovementMetrics
  roamAttributed: SocialGroupEventRoamAttributedMetrics
  xp: SocialGroupEventXpMetrics
}


// ============================================================
// EVENT ATTENDEE — ATTENDANCE
// ============================================================

export type SocialGroupEventAttendanceSource =
  | 'event_checkin'
  | 'venue_visit'
  | 'both'

export type SocialGroupEventAttendeeAttendance = {
  source: SocialGroupEventAttendanceSource

  attendanceAt: string

  eventCheckinAt: string | null
  eventVenueVisitAt: string | null
}


// ============================================================
// EVENT ATTENDEE — GROUP ATTENDANCE HISTORY
//
// This is attendance behavior only.
//
// It is NOT:
//   - member status
//   - ownership
//   - admin status
// ============================================================

export type SocialGroupEventAttendeeGroupAttendance = {
  isFirstTime: boolean
  isRepeat: boolean
}


// ============================================================
// EVENT ATTENDEE — MOVEMENT STOP
// ============================================================

export type SocialGroupEventMovementStop = {
  venueId: string
  venueName: string | null
  visitedAt: string | null
}


// ============================================================
// EVENT ATTENDEE — OBSERVED MOVEMENT
//
// Maximum expected sequence:
//   before: 0–2 venues
//   after:  0–2 venues
//
// Current canonical rules:
//
// BEFORE:
//   Same local calendar day as event.
//
// AFTER:
//   No later than 3:00 AM local time on following day.
// ============================================================

export type SocialGroupEventAttendeeObservedMovement = {
  hadBefore: boolean
  hadAfter: boolean
  hadBeforeAndAfter: boolean

  before: SocialGroupEventMovementStop[]
  after: SocialGroupEventMovementStop[]
}


// ============================================================
// EVENT ATTENDEE — ROAM ATTRIBUTION
// ============================================================

export type SocialGroupEventAttendeeRoamAttributed = {
  flowStarts: number
  flowCompletions: number
  flowVenueStops: number
}


// ============================================================
// EVENT ATTENDEE ACTIVITY
//
// Returned by:
//   /api/social-groups/[groupId]/events/[eventId]/metrics
// ============================================================

export type SocialGroupEventAttendeeActivity = {
  userId: string

  attendance: SocialGroupEventAttendeeAttendance

  groupAttendance: SocialGroupEventAttendeeGroupAttendance

  observedMovement: SocialGroupEventAttendeeObservedMovement

  roamAttributed: SocialGroupEventAttendeeRoamAttributed

  xpGenerated: number
}


// ============================================================
// EVENT ANALYTICS WINDOW
// ============================================================

export type SocialGroupEventAnalyticsWindow = {
  timezone: string | null

  eventStart: string | null
  eventEnd: string | null

  beforeWindowStart: string | null
  afterWindowEnd: string | null

  beforeRule: string
  afterRule: string
}


// ============================================================
// EVENT ANALYTICS REFRESH STATE
// ============================================================

export type SocialGroupEventAnalyticsRefresh = {
  succeeded: boolean
  error: string | null
  result: unknown | null
  servedExistingSnapshot: boolean
}

export type SocialGroupEventAnalyticsMetadata = {
  calculationVersion: number
  calculatedAt: string

  refresh: SocialGroupEventAnalyticsRefresh
}


// ============================================================
// EVENT DETAIL RESPONSE
//
// GET
// /api/social-groups/[groupId]/events/[eventId]/metrics
// ============================================================

export type SocialGroupEventMetricsResponse = {
  group: SocialGroupDashboardGroup

  event: SocialGroupEventDetail

  metrics: SocialGroupEventDetailMetrics

  analyticsWindow: SocialGroupEventAnalyticsWindow

  attendees: SocialGroupEventAttendeeActivity[]

  analytics: SocialGroupEventAnalyticsMetadata
}


// ============================================================
// STANDARD API ERROR
// ============================================================

export type SocialGroupDashboardApiError = {
  error: string
  details?: string
}


// ============================================================
// OPTIONAL API RESPONSE UNIONS
//
// Useful for fetch helpers where you want the success/error
// response represented explicitly.
// ============================================================

export type SocialGroupDashboardApiResponse =
  | SocialGroupDashboardResponse
  | SocialGroupDashboardApiError

export type SocialGroupEventMetricsApiResponse =
  | SocialGroupEventMetricsResponse
  | SocialGroupDashboardApiError


// ============================================================
// TYPE GUARDS
// ============================================================

export function isSocialGroupDashboardApiError(
  value: unknown
): value is SocialGroupDashboardApiError {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'error' in value &&
    typeof (value as { error?: unknown }).error === 'string'
  )
}

export function isSocialGroupDashboardResponse(
  value: unknown
): value is SocialGroupDashboardResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SocialGroupDashboardResponse>

  return Boolean(
    candidate.group &&
      candidate.metrics &&
      Array.isArray(candidate.events) &&
      Array.isArray(candidate.attendees) &&
      candidate.refresh
  )
}

export function isSocialGroupEventMetricsResponse(
  value: unknown
): value is SocialGroupEventMetricsResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SocialGroupEventMetricsResponse>

  return Boolean(
    candidate.group &&
      candidate.event &&
      candidate.metrics &&
      candidate.analyticsWindow &&
      Array.isArray(candidate.attendees) &&
      candidate.analytics
  )
}