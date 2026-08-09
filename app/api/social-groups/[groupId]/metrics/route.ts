import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServerApi } from '@/lib/supabase/server-api'

type RouteContext = {
  params: Promise<{
    groupId: string
  }>
}

type EventRow = {
  id: string
  title: string | null
  starts_at: string | null
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { groupId } = await context.params

    if (!groupId) {
      return NextResponse.json(
        { error: 'Missing groupId' },
        { status: 400 }
      )
    }

    // ============================================================
    // 1. AUTHENTICATE REQUESTING USER
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
    // 2. AUTHORIZE SOCIAL GROUP ACCESS
    // ============================================================

    const { data: membership, error: membershipError } = await supabase
      .from('social_group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error(
        'Group metrics membership lookup error:',
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
    // 3. SERVER-ONLY ANALYTICS CLIENT
    //
    // Required because:
    //
    // - social_group_event_metrics has RLS enabled
    // - social_group_event_attendee_activity has RLS enabled
    // - refresh_social_group_event_metrics(uuid) is service-role only
    //
    // Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
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
    // 4. LOAD GROUP + ITS EVENTS
    // ============================================================

    const [
      { data: group, error: groupError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      supabase
        .from('social_groups')
        .select('id, name, slug, description, logo_url')
        .eq('id', groupId)
        .maybeSingle(),

      supabase
        .from('events')
        .select('id, title, starts_at')
        .eq('social_group_id', groupId)
        .order('starts_at', { ascending: false }),
    ])

    if (groupError) {
      console.error(
        'Group metrics group lookup error:',
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

    if (eventsError) {
      console.error(
        'Group metrics events lookup error:',
        eventsError
      )

      return NextResponse.json(
        {
          error: 'Failed to load group events',
          details: eventsError.message,
        },
        { status: 500 }
      )
    }

    const safeEvents = (events ?? []) as EventRow[]
    const eventIds = safeEvents.map((event) => event.id)

    // ============================================================
    // 5. REFRESH CANONICAL ANALYTICS FOR EACH EVENT
    //
    // This intentionally happens before reading the snapshot tables.
    //
    // One bad historical event does NOT destroy the entire group
    // dashboard. We record its refresh failure and continue.
    // ============================================================

    const refreshResults = await Promise.all(
      safeEvents.map(async (event) => {
        const { data, error } = await analyticsSupabase.rpc(
          'refresh_social_group_event_metrics',
          {
            target_event_id: event.id,
          }
        )

        if (error) {
          console.error(
            `Failed to refresh metrics for event ${event.id}:`,
            error
          )

          return {
            eventId: event.id,
            refreshed: false,
            error: error.message,
          }
        }

        return {
          eventId: event.id,
          refreshed: true,
          result: data,
        }
      })
    )

    // ============================================================
    // 6. EMPTY GROUP
    // ============================================================

    if (eventIds.length === 0) {
      return NextResponse.json({
        group,
        metrics: {
          groupId,

          totalEvents: 0,

          totalCheckins: 0,
          uniqueAttendees: 0,
          repeatAttendees: 0,
          totalXpAwarded: 0,

          explicitEventCheckins: 0,
          venueOnlyAttendees: 0,
          bothCheckinAndVenueVisit: 0,

          interestedUsers: 0,

          attendeesWithBeforeMovement: 0,
          attendeesWithAfterMovement: 0,
          attendeesWithBeforeAndAfterMovement: 0,

          beforeVenueVisits: 0,
          afterVenueVisits: 0,

          firstTimeAttendees: 0,

          flowStarts: 0,
          flowCompletions: 0,
          flowVenueStops: 0,
        },

        events: [],
        attendees: [],
        refresh: {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          results: [],
        },
      })
    }

    // ============================================================
    // 7. LOAD CANONICAL EVENT METRICS + ATTENDEE ACTIVITY
    // ============================================================

    const [
      { data: metricsRows, error: metricsError },
      { data: attendeeRows, error: attendeeError },
    ] = await Promise.all([
      analyticsSupabase
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
        .eq('social_group_id', groupId)
        .in('event_id', eventIds)
        .order('event_start', { ascending: false }),

      analyticsSupabase
        .from('social_group_event_attendee_activity')
        .select(`
          event_id,
          social_group_id,
          user_id,
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
        .eq('social_group_id', groupId)
        .in('event_id', eventIds)
        .order('attendance_at', { ascending: false }),
    ])

    if (metricsError) {
      console.error(
        'Group analytics metrics lookup error:',
        metricsError
      )

      return NextResponse.json(
        {
          error: 'Failed to load canonical event metrics',
          details: metricsError.message,
        },
        { status: 500 }
      )
    }

    if (attendeeError) {
      console.error(
        'Group analytics attendee lookup error:',
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

    const safeMetrics = (metricsRows ?? []) as EventMetricRow[]
    const safeAttendees =
      (attendeeRows ?? []) as AttendeeActivityRow[]

    // ============================================================
    // 8. LOOKUP MAPS
    // ============================================================

    const metricsByEventId = new Map(
      safeMetrics.map((metric) => [
        metric.event_id,
        metric,
      ])
    )

    // ============================================================
    // 9. GROUP-LEVEL UNIQUE ATTENDANCE
    //
    // IMPORTANT:
    // Sum(event.unique_attendees) would double-count users who attend
    // multiple events.
    //
    // Group unique attendees are deduplicated by user_id here.
    // ============================================================

    const uniqueAttendeeIds = new Set(
      safeAttendees.map((row) => row.user_id)
    )

    // ============================================================
    // 10. GROUP-LEVEL REPEAT ATTENDANCE
    //
    // We derive this from distinct event attendance rather than
    // blindly summing per-event repeat flags.
    // ============================================================

    const eventsByUser = new Map<string, Set<string>>()

    for (const row of safeAttendees) {
      const existing =
        eventsByUser.get(row.user_id) ?? new Set<string>()

      existing.add(row.event_id)
      eventsByUser.set(row.user_id, existing)
    }

    const repeatAttendees = Array.from(
      eventsByUser.values()
    ).filter((eventSet) => eventSet.size > 1).length

    // ============================================================
    // 11. GROUP AGGREGATES
    // ============================================================

    const explicitEventCheckins = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.explicit_event_checkins ?? 0),
      0
    )

    const venueOnlyAttendees = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.venue_only_attendees ?? 0),
      0
    )

    const bothCheckinAndVenueVisit = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.both_checkin_and_venue_visit ?? 0),
      0
    )

    const totalXpAwarded = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.xp_generated ?? 0),
      0
    )

    const interestedUsers = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.interested_users ?? 0),
      0
    )

    const ticketClicks = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.ticket_clicks ?? 0),
      0
    )

    const outingPlannerOpens = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.outing_planner_opens ?? 0),
      0
    )

    const attendeesWithBeforeMovement =
      safeMetrics.reduce(
        (sum, row) =>
          sum + (row.before_venue_visitors ?? 0),
        0
      )

    const attendeesWithAfterMovement =
      safeMetrics.reduce(
        (sum, row) =>
          sum + (row.after_venue_visitors ?? 0),
        0
      )

    const attendeesWithBeforeAndAfterMovement =
      safeMetrics.reduce(
        (sum, row) =>
          sum + (row.both_before_and_after ?? 0),
        0
      )

    const beforeVenueVisits = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.before_venue_visit_count ?? 0),
      0
    )

    const afterVenueVisits = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.after_venue_visit_count ?? 0),
      0
    )

    const firstTimeAttendees = safeAttendees.filter(
      (row) => row.is_first_time_group_attendee
    ).length

    const flowStarts = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.flow_starts ?? 0),
      0
    )

    const flowCompletions = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.flow_completions ?? 0),
      0
    )

    const flowVenueStops = safeMetrics.reduce(
      (sum, row) =>
        sum + (row.flow_venue_stops ?? 0),
      0
    )

    // ============================================================
    // 12. EVENT-BY-EVENT METRICS
    //
    // Backward-compatible fields:
    //
    //   checkins
    //   uniqueAttendees
    //   xpAwarded
    //
    // remain in the response.
    // ============================================================

    const eventMetrics = safeEvents.map((event) => {
      const metric = metricsByEventId.get(event.id)

      return {
        eventId: event.id,
        title: event.title,
        startsAt: event.starts_at,

        // Existing response contract
        checkins:
          metric?.explicit_event_checkins ?? 0,

        uniqueAttendees:
          metric?.unique_attendees ?? 0,

        xpAwarded:
          metric?.xp_generated ?? 0,

        // Canonical attendance breakdown
        explicitEventCheckins:
          metric?.explicit_event_checkins ?? 0,

        venueOnlyAttendees:
          metric?.venue_only_attendees ?? 0,

        bothCheckinAndVenueVisit:
          metric?.both_checkin_and_venue_visit ?? 0,

        // Engagement
        interestedUsers:
          metric?.interested_users ?? 0,

        ticketClicks:
          metric?.ticket_clicks ?? 0,

        outingPlannerOpens:
          metric?.outing_planner_opens ?? 0,

        // Movement
        beforeVenueVisitors:
          metric?.before_venue_visitors ?? 0,

        afterVenueVisitors:
          metric?.after_venue_visitors ?? 0,

        bothBeforeAndAfter:
          metric?.both_before_and_after ?? 0,

        beforeVenueVisitCount:
          metric?.before_venue_visit_count ?? 0,

        afterVenueVisitCount:
          metric?.after_venue_visit_count ?? 0,

        // Attendance history
        firstTimeGroupAttendees:
          metric?.first_time_group_attendees ?? 0,

        repeatGroupAttendees:
          metric?.repeat_group_attendees ?? 0,

        // Proven Roam attribution only
        flowStarts:
          metric?.flow_starts ?? 0,

        flowCompletions:
          metric?.flow_completions ?? 0,

        flowVenueStops:
          metric?.flow_venue_stops ?? 0,

        // Calculation context
        venueId:
          metric?.venue_id ?? null,

        eventStart:
          metric?.event_start ?? event.starts_at,

        eventEnd:
          metric?.event_end ?? null,

        eventTimezone:
          metric?.event_timezone ?? null,

        beforeWindowStart:
          metric?.before_window_start ?? null,

        afterWindowEnd:
          metric?.after_window_end ?? null,

        calculationVersion:
          metric?.calculation_version ?? null,

        calculatedAt:
          metric?.calculated_at ?? null,
      }
    })

    // ============================================================
    // 13. ATTENDEE INSIGHTS
    //
    // We keep this relatively compact while exposing enough data
    // for future event drill-downs.
    //
    // This route is authorized and server-backed; these records
    // are not exposed through direct browser Supabase access.
    // ============================================================

    const attendeeInsights = Array.from(
      eventsByUser.entries()
    )
      .map(([userId, userEventIds]) => {
        const userActivity = safeAttendees
          .filter((row) => row.user_id === userId)
          .sort((a, b) => {
            return (
              new Date(a.attendance_at).getTime() -
              new Date(b.attendance_at).getTime()
            )
          })

        const totalXp = userActivity.reduce(
          (sum, row) =>
            sum + (row.xp_generated ?? 0),
          0
        )

        const beforeMovementEvents =
          userActivity.filter(
            (row) => row.had_before_movement
          ).length

        const afterMovementEvents =
          userActivity.filter(
            (row) => row.had_after_movement
          ).length

        return {
          userId,

          // Existing-style compatibility
          checkins: userEventIds.size,
          xpEarned: totalXp,

          firstCheckinAt:
            userActivity[0]?.attendance_at ?? null,

          lastCheckinAt:
            userActivity[
              userActivity.length - 1
            ]?.attendance_at ?? null,

          // New analytics
          eventsAttended: userEventIds.size,

          isRepeatAttendee:
            userEventIds.size > 1,

          eventsWithBeforeMovement:
            beforeMovementEvents,

          eventsWithAfterMovement:
            afterMovementEvents,
        }
      })
      .sort((a, b) => {
        return b.eventsAttended - a.eventsAttended
      })

    // ============================================================
    // 14. REFRESH DIAGNOSTICS
    // ============================================================

    const refreshSucceeded =
      refreshResults.filter(
        (result) => result.refreshed
      ).length

    const refreshFailed =
      refreshResults.length - refreshSucceeded

    // ============================================================
    // 15. RESPONSE
    // ============================================================

    return NextResponse.json({
      group,

      metrics: {
        groupId,

        totalEvents:
          safeEvents.length,

        // Backward-compatible summary fields
        totalCheckins:
          explicitEventCheckins,

        uniqueAttendees:
          uniqueAttendeeIds.size,

        repeatAttendees,

        totalXpAwarded,

        // Canonical attendance
        explicitEventCheckins,
        venueOnlyAttendees,
        bothCheckinAndVenueVisit,

        // Intent
        interestedUsers,
        ticketClicks,
        outingPlannerOpens,

        // Observed surrounding movement
        attendeesWithBeforeMovement,
        attendeesWithAfterMovement,
        attendeesWithBeforeAndAfterMovement,

        beforeVenueVisits,
        afterVenueVisits,

        // Group return behavior
        firstTimeAttendees,

        // Proven Roam attribution only
        flowStarts,
        flowCompletions,
        flowVenueStops,
      },

      events: eventMetrics,

      attendees: attendeeInsights,

      refresh: {
        attempted: refreshResults.length,
        succeeded: refreshSucceeded,
        failed: refreshFailed,
        results: refreshResults,
      },
    })
  } catch (error) {
    console.error(
      'Unexpected group metrics error:',
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