import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    groupId: string
    eventId: string
  }>
}

type EventRow = {
  id: string
  title: string | null
  description: string | null
  starts_at: string | null
  ends_at: string | null
  venue_id: string | null
  social_group_id: string | null
}

type EventMetricRow = {
  event_id: string
  social_group_id: string
  venue_id: string | null

  event_start: string | null
  event_end: string | null
  event_timezone: string | null

  before_window_start: string | null
  after_window_end: string | null

  unique_attendees: number
  explicit_event_checkins: number
  venue_only_attendees: number
  both_checkin_and_venue_visit: number

  interested_users: number
  ticket_clicks: number
  outing_planner_opens: number

  before_venue_visitors: number
  after_venue_visitors: number
  both_before_and_after: number

  before_venue_visit_count: number
  after_venue_visit_count: number

  repeat_group_attendees: number
  first_time_group_attendees: number

  flow_starts: number
  flow_completions: number
  flow_venue_stops: number

  xp_generated: number

  calculation_version: number
  calculated_at: string
}

type AttendeeActivityRow = {
  event_id: string
  social_group_id: string
  user_id: string
  event_venue_id: string | null

  attendance_source: 'event_checkin' | 'venue_visit' | 'both'
  attendance_at: string

  event_checkin_at: string | null
  event_venue_visit_at: string | null

  before_venue_1_id: string | null
  before_venue_1_at: string | null

  before_venue_2_id: string | null
  before_venue_2_at: string | null

  after_venue_1_id: string | null
  after_venue_1_at: string | null

  after_venue_2_id: string | null
  after_venue_2_at: string | null

  had_before_movement: boolean
  had_after_movement: boolean
  had_before_and_after_movement: boolean

  is_first_time_group_attendee: boolean
  is_repeat_group_attendee: boolean

  roam_flow_starts: number
  roam_flow_completions: number
  roam_flow_venue_stops: number

  xp_generated: number
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
}

type MovementVenueSummary = {
  venueId: string
  venueName: string | null
  city: string | null
  attendeeCount: number
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null

  return Math.round((numerator / denominator) * 1000) / 10
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { groupId, eventId } = await context.params

    // ============================================================
    // 1. VALIDATE ROUTE PARAMETERS
    // ============================================================

    if (!groupId) {
      return NextResponse.json(
        { error: 'Missing groupId' },
        { status: 400 }
      )
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing eventId' },
        { status: 400 }
      )
    }

    if (!isUuid(groupId)) {
      return NextResponse.json(
        { error: 'Invalid groupId' },
        { status: 400 }
      )
    }

    if (!isUuid(eventId)) {
      return NextResponse.json(
        { error: 'Invalid eventId' },
        { status: 400 }
      )
    }

    // ============================================================
    // 2. AUTHENTICATE REQUESTING USER
    // ============================================================

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ============================================================
    // 3. AUTHORIZE GROUP ACCESS
    // ============================================================

    const { data: membership, error: membershipError } = await supabase
      .from('social_group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error(
        'Event metrics membership lookup error:',
        membershipError
      )

      return NextResponse.json(
        {
          error: 'Failed to verify group access',
          details: membershipError.message,
        },
        { status: 500 }
      )
    }

    if (
      !membership ||
      !['owner', 'admin', 'member'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // ============================================================
    // 4. LOAD GROUP
    // ============================================================

    const { data: group, error: groupError } = await supabase
      .from('social_groups')
      .select(`
        id,
        name,
        slug,
        description,
        logo_url
      `)
      .eq('id', groupId)
      .maybeSingle()

    if (groupError) {
      console.error(
        'Event metrics group lookup error:',
        groupError
      )

      return NextResponse.json(
        {
          error: 'Failed to load group',
          details: groupError.message,
        },
        { status: 500 }
      )
    }

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // ============================================================
    // 5. VERIFY EVENT BELONGS TO THIS GROUP
    // ============================================================

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        starts_at,
        ends_at,
        venue_id,
        social_group_id
      `)
      .eq('id', eventId)
      .eq('social_group_id', groupId)
      .maybeSingle()

    if (eventError) {
      console.error(
        'Event metrics event lookup error:',
        eventError
      )

      return NextResponse.json(
        {
          error: 'Failed to load event',
          details: eventError.message,
        },
        { status: 500 }
      )
    }

    if (!event) {
      return NextResponse.json(
        {
          error: 'Event not found for this social group',
        },
        { status: 404 }
      )
    }

    const safeEvent = event as EventRow

    // ============================================================
    // 6. CREATE SERVER-ONLY ANALYTICS CLIENT
    //
    // Analytics tables use RLS and the refresh RPC is service-role
    // restricted.
    //
    // SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed client-side.
    // ============================================================

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      )

      return NextResponse.json(
        {
          error: 'Server analytics configuration is incomplete',
        },
        { status: 500 }
      )
    }

    const analyticsSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    // ============================================================
    // 7. REFRESH CANONICAL ANALYTICS
    //
    // If refresh fails, we attempt to serve the latest existing
    // snapshot rather than automatically destroying the dashboard.
    // ============================================================

    const {
      data: refreshData,
      error: refreshError,
    } = await analyticsSupabase.rpc(
      'refresh_social_group_event_metrics',
      {
        target_event_id: eventId,
      }
    )

    if (refreshError) {
      console.error(
        `Failed to refresh analytics for event ${eventId}:`,
        refreshError
      )
    }

    // ============================================================
    // 8. LOAD EVENT METRICS SNAPSHOT
    // ============================================================

    const {
      data: metric,
      error: metricError,
    } = await analyticsSupabase
      .from('social_group_event_metrics')
      .select(`
        event_id,
        social_group_id,
        venue_id,
        event_start,
        event_end,
        event_timezone,
        before_window_start,
        after_window_end,
        unique_attendees,
        explicit_event_checkins,
        venue_only_attendees,
        both_checkin_and_venue_visit,
        interested_users,
        ticket_clicks,
        outing_planner_opens,
        before_venue_visitors,
        after_venue_visitors,
        both_before_and_after,
        before_venue_visit_count,
        after_venue_visit_count,
        repeat_group_attendees,
        first_time_group_attendees,
        flow_starts,
        flow_completions,
        flow_venue_stops,
        xp_generated,
        calculation_version,
        calculated_at
      `)
      .eq('event_id', eventId)
      .eq('social_group_id', groupId)
      .maybeSingle()

    if (metricError) {
      console.error(
        'Event metrics snapshot lookup error:',
        metricError
      )

      return NextResponse.json(
        {
          error: 'Failed to load event analytics',
          details: metricError.message,
        },
        { status: 500 }
      )
    }

    if (!metric) {
      return NextResponse.json(
        {
          error: 'No analytics snapshot exists for this event',
          details:
            refreshError?.message ??
            'The event analytics refresh did not produce a snapshot.',
        },
        { status: 500 }
      )
    }

    const safeMetric = metric as EventMetricRow

    // ============================================================
    // 9. LOAD ATTENDEE-LEVEL ANALYTICS
    // ============================================================

    const {
      data: attendeeRows,
      error: attendeeError,
    } = await analyticsSupabase
      .from('social_group_event_attendee_activity')
      .select(`
        event_id,
        social_group_id,
        user_id,
        event_venue_id,
        attendance_source,
        attendance_at,
        event_checkin_at,
        event_venue_visit_at,
        before_venue_1_id,
        before_venue_1_at,
        before_venue_2_id,
        before_venue_2_at,
        after_venue_1_id,
        after_venue_1_at,
        after_venue_2_id,
        after_venue_2_at,
        had_before_movement,
        had_after_movement,
        had_before_and_after_movement,
        is_first_time_group_attendee,
        is_repeat_group_attendee,
        roam_flow_starts,
        roam_flow_completions,
        roam_flow_venue_stops,
        xp_generated
      `)
      .eq('event_id', eventId)
      .eq('social_group_id', groupId)
      .order('attendance_at', { ascending: true })

    if (attendeeError) {
      console.error(
        'Event attendee analytics lookup error:',
        attendeeError
      )

      return NextResponse.json(
        {
          error: 'Failed to load attendee analytics',
          details: attendeeError.message,
        },
        { status: 500 }
      )
    }

    const safeAttendees =
      (attendeeRows ?? []) as AttendeeActivityRow[]

    // ============================================================
    // 10. COLLECT ALL VENUE IDS NEEDED FOR ENRICHMENT
    // ============================================================

    const movementVenueIds = new Set<string>()

    if (safeEvent.venue_id) {
      movementVenueIds.add(safeEvent.venue_id)
    }

    for (const attendee of safeAttendees) {
      if (attendee.before_venue_1_id) {
        movementVenueIds.add(attendee.before_venue_1_id)
      }

      if (attendee.before_venue_2_id) {
        movementVenueIds.add(attendee.before_venue_2_id)
      }

      if (attendee.after_venue_1_id) {
        movementVenueIds.add(attendee.after_venue_1_id)
      }

      if (attendee.after_venue_2_id) {
        movementVenueIds.add(attendee.after_venue_2_id)
      }
    }

    // ============================================================
    // 11. LOAD VENUE NAMES
    // ============================================================

    let safeVenues: VenueRow[] = []

    if (movementVenueIds.size > 0) {
      const {
        data: venueRows,
        error: venueError,
      } = await analyticsSupabase
        .from('venues')
        .select('id, name, city')
        .in('id', Array.from(movementVenueIds))

      if (venueError) {
        console.error(
          'Event movement venue lookup error:',
          venueError
        )

        return NextResponse.json(
          {
            error: 'Failed to load movement venues',
            details: venueError.message,
          },
          { status: 500 }
        )
      }

      safeVenues = (venueRows ?? []) as VenueRow[]
    }

    const venueById = new Map(
      safeVenues.map((venue) => [
        venue.id,
        venue,
      ])
    )

    // ============================================================
    // 12. BUILD BEFORE / AFTER VENUE FREQUENCIES
    // ============================================================

    const beforeVenueCounts = new Map<string, number>()
    const afterVenueCounts = new Map<string, number>()

    for (const attendee of safeAttendees) {
      const beforeIds = [
        attendee.before_venue_1_id,
        attendee.before_venue_2_id,
      ].filter((value): value is string => Boolean(value))

      const afterIds = [
        attendee.after_venue_1_id,
        attendee.after_venue_2_id,
      ].filter((value): value is string => Boolean(value))

      for (const venueId of beforeIds) {
        beforeVenueCounts.set(
          venueId,
          (beforeVenueCounts.get(venueId) ?? 0) + 1
        )
      }

      for (const venueId of afterIds) {
        afterVenueCounts.set(
          venueId,
          (afterVenueCounts.get(venueId) ?? 0) + 1
        )
      }
    }

    function buildVenueSummary(
      counts: Map<string, number>
    ): MovementVenueSummary[] {
      return Array.from(counts.entries())
        .map(([venueId, attendeeCount]) => {
          const venue = venueById.get(venueId)

          return {
            venueId,
            venueName: venue?.name ?? null,
            city: venue?.city ?? null,
            attendeeCount,
          }
        })
        .sort((a, b) => {
          if (b.attendeeCount !== a.attendeeCount) {
            return b.attendeeCount - a.attendeeCount
          }

          return (a.venueName ?? '').localeCompare(
            b.venueName ?? ''
          )
        })
    }

    const topBeforeVenues =
      buildVenueSummary(beforeVenueCounts)

    const topAfterVenues =
      buildVenueSummary(afterVenueCounts)

    // ============================================================
    // 13. ATTENDANCE SOURCE BREAKDOWN
    // ============================================================

    const eventCheckinOnlyCount = safeAttendees.filter(
      (attendee) =>
        attendee.attendance_source === 'event_checkin'
    ).length

    const venueVisitOnlyCount = safeAttendees.filter(
      (attendee) =>
        attendee.attendance_source === 'venue_visit'
    ).length

    const bothCount = safeAttendees.filter(
      (attendee) =>
        attendee.attendance_source === 'both'
    ).length

    // ============================================================
    // 14. MOVEMENT SUMMARY
    // ============================================================

    const attendeesWithBeforeMovement =
      safeAttendees.filter(
        (attendee) =>
          attendee.had_before_movement
      ).length

    const attendeesWithAfterMovement =
      safeAttendees.filter(
        (attendee) =>
          attendee.had_after_movement
      ).length

    const attendeesWithBothMovement =
      safeAttendees.filter(
        (attendee) =>
          attendee.had_before_and_after_movement
      ).length

    const attendeesWithAnyMovement =
      safeAttendees.filter(
        (attendee) =>
          attendee.had_before_movement ||
          attendee.had_after_movement
      ).length

    const totalObservedAdditionalVenueVisits =
      (safeMetric.before_venue_visit_count ?? 0) +
      (safeMetric.after_venue_visit_count ?? 0)

    const averageAdditionalVenueVisitsPerAttendee =
      safeMetric.unique_attendees > 0
        ? Math.round(
            (
              totalObservedAdditionalVenueVisits /
              safeMetric.unique_attendees
            ) *
              100
          ) / 100
        : 0

    // ============================================================
    // 15. OPTIONAL CONVERSION METRICS
    //
    // These are derived only from known counts.
    // ============================================================

    const interestToAttendanceRate = safeRate(
      safeMetric.unique_attendees,
      safeMetric.interested_users
    )

    const explicitCheckinRate = safeRate(
      safeMetric.explicit_event_checkins,
      safeMetric.unique_attendees
    )

    const surroundingMovementRate = safeRate(
      attendeesWithAnyMovement,
      safeMetric.unique_attendees
    )

    const repeatAttendanceRate = safeRate(
      safeMetric.repeat_group_attendees,
      safeMetric.unique_attendees
    )

    // ============================================================
    // 16. ENRICH ATTENDEE ACTIVITY
    //
    // Movement stays explicitly labeled as observed.
    //
    // We do NOT claim Roam caused these venue visits.
    // ============================================================

    const attendees = safeAttendees.map((attendee) => ({
      userId: attendee.user_id,

      attendance: {
        source: attendee.attendance_source,
        attendanceAt: attendee.attendance_at,
        eventCheckinAt: attendee.event_checkin_at,
        eventVenueVisitAt:
          attendee.event_venue_visit_at,
      },

      groupAttendance: {
        isFirstTime:
          attendee.is_first_time_group_attendee,

        isRepeat:
          attendee.is_repeat_group_attendee,
      },

      observedMovement: {
        hadBefore:
          attendee.had_before_movement,

        hadAfter:
          attendee.had_after_movement,

        hadBeforeAndAfter:
          attendee.had_before_and_after_movement,

        before: [
          attendee.before_venue_1_id
            ? {
                venueId:
                  attendee.before_venue_1_id,

                venueName:
                  venueById.get(
                    attendee.before_venue_1_id
                  )?.name ?? null,

                visitedAt:
                  attendee.before_venue_1_at,
              }
            : null,

          attendee.before_venue_2_id
            ? {
                venueId:
                  attendee.before_venue_2_id,

                venueName:
                  venueById.get(
                    attendee.before_venue_2_id
                  )?.name ?? null,

                visitedAt:
                  attendee.before_venue_2_at,
              }
            : null,
        ].filter(Boolean),

        after: [
          attendee.after_venue_1_id
            ? {
                venueId:
                  attendee.after_venue_1_id,

                venueName:
                  venueById.get(
                    attendee.after_venue_1_id
                  )?.name ?? null,

                visitedAt:
                  attendee.after_venue_1_at,
              }
            : null,

          attendee.after_venue_2_id
            ? {
                venueId:
                  attendee.after_venue_2_id,

                venueName:
                  venueById.get(
                    attendee.after_venue_2_id
                  )?.name ?? null,

                visitedAt:
                  attendee.after_venue_2_at,
              }
            : null,
        ].filter(Boolean),
      },

      roamAttributed: {
        flowStarts:
          attendee.roam_flow_starts ?? 0,

        flowCompletions:
          attendee.roam_flow_completions ?? 0,

        flowVenueStops:
          attendee.roam_flow_venue_stops ?? 0,
      },

      xpGenerated:
        attendee.xp_generated ?? 0,
    }))

    // ============================================================
    // 17. RESPONSE
    // ============================================================

    return NextResponse.json({
      group,

      event: {
        id: safeEvent.id,
        title: safeEvent.title,
        description: safeEvent.description,
        startsAt: safeEvent.starts_at,
        endsAt: safeEvent.ends_at,

        venueId: safeEvent.venue_id,

        venue:
          safeEvent.venue_id
            ? {
                id: safeEvent.venue_id,
                name:
                  venueById.get(
                    safeEvent.venue_id
                  )?.name ?? null,

                city:
                  venueById.get(
                    safeEvent.venue_id
                  )?.city ?? null,
              }
            : null,
      },

      metrics: {
        attendance: {
          uniqueAttendees:
            safeMetric.unique_attendees,

          explicitEventCheckins:
            safeMetric.explicit_event_checkins,

          eventCheckinOnly:
            eventCheckinOnlyCount,

          venueVisitOnly:
            venueVisitOnlyCount,

          bothCheckinAndVenueVisit:
            bothCount,

          firstTimeGroupAttendees:
            safeMetric.first_time_group_attendees,

          repeatGroupAttendees:
            safeMetric.repeat_group_attendees,

          explicitCheckinRate,
          repeatAttendanceRate,
        },

        engagement: {
          interestedUsers:
            safeMetric.interested_users,

          ticketClicks:
            safeMetric.ticket_clicks,

          outingPlannerOpens:
            safeMetric.outing_planner_opens,

          interestToAttendanceRate,
        },

        observedMovement: {
          attendeesWithBeforeMovement,
          attendeesWithAfterMovement,

          attendeesWithBeforeAndAfterMovement:
            attendeesWithBothMovement,

          attendeesWithAnyMovement,

          beforeVenueVisitCount:
            safeMetric.before_venue_visit_count,

          afterVenueVisitCount:
            safeMetric.after_venue_visit_count,

          totalAdditionalVenueVisits:
            totalObservedAdditionalVenueVisits,

          averageAdditionalVenueVisitsPerAttendee,

          surroundingMovementRate,

          topBeforeVenues,
          topAfterVenues,
        },

        roamAttributed: {
          flowStarts:
            safeMetric.flow_starts,

          flowCompletions:
            safeMetric.flow_completions,

          flowVenueStops:
            safeMetric.flow_venue_stops,
        },

        xp: {
          generated:
            safeMetric.xp_generated,
        },
      },

      analyticsWindow: {
        timezone:
          safeMetric.event_timezone,

        eventStart:
          safeMetric.event_start,

        eventEnd:
          safeMetric.event_end,

        beforeWindowStart:
          safeMetric.before_window_start,

        afterWindowEnd:
          safeMetric.after_window_end,

        beforeRule:
          'Same local calendar day as event; maximum two distinct venues before attendance.',

        afterRule:
          'Maximum two distinct venues after attendance; no later than 3:00 AM local time the following day.',
      },

      attendees,

      analytics: {
        calculationVersion:
          safeMetric.calculation_version,

        calculatedAt:
          safeMetric.calculated_at,

        refresh: {
          succeeded: !refreshError,

          error:
            refreshError?.message ?? null,

          result:
            refreshData ?? null,

          servedExistingSnapshot:
            Boolean(refreshError),
        },
      },
    })
  } catch (error) {
    console.error(
      'Unexpected social group event metrics error:',
      error
    )

    return NextResponse.json(
      {
        error: 'Unexpected server error',

        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}